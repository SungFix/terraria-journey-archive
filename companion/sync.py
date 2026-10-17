"""Terraria Journey Archive companion - read-only Windows local-sync service.

Uses only the selected player's .plr file; does not access Terraria's memory,
modify saves, send files to external servers, or need administrator privileges.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import struct
import sys
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Optional

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

PORT = 47838
KEY = "h3y_gUyZ".encode("utf-16le")
ALLOWED_ORIGINS = {"https://sungfix.github.io", "null", "http://localhost:8000", "http://127.0.0.1:8000"}
LOCK = threading.Lock()
STATE = {"app": "journey-archive-companion", "protocol": 1, "ok": False,
         "message": "Aguardando o personagem...", "player": "", "version": None,
         "countsById": {}, "unknownByKey": {}, "unknownCount": 0, "updatedAt": None}


def app_base() -> Path:
    return Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parents[1]))


def config_path() -> Path:
    return Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "JourneyArchive" / "sync-config.json"


def load_items() -> dict[str, tuple[int, int]]:
    path = app_base() / "data" / "persistent-items.json"
    if not path.is_file():
        path = config_path().parent / "persistent-items.json"
        if not path.is_file():
            # Downloads ONLY the public item-name dictionary, never player data.
            from urllib.request import urlopen
            url = "https://raw.githubusercontent.com/SungFix/terraria-journey-archive/main/data/persistent-items.json"
            try:
                with urlopen(url, timeout=15) as response:
                    content = response.read(1_000_000)
                if len(content) >= 1_000_000:
                    raise ValueError("Arquivo de IDs grande demais")
                temporary = json.loads(content.decode("utf-8"))
                if len(temporary.get("items", {})) < 1000:
                    raise ValueError("Mapa de itens inválido")
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(content)
            except Exception as exc:
                raise RuntimeError("Sem mapa de itens: conecte-se à internet e tente novamente") from exc
    raw = json.loads(path.read_text(encoding="utf-8"))
    entries = raw.get("items", {})
    if not isinstance(entries, dict) or len(entries) < 1000:
        raise RuntimeError("O mapa de itens está incompleto")
    return {str(k): (int(v[0]), int(v[1])) for k, v in entries.items()}


def decrypt_player(blob: bytes) -> bytes:
    if not 32 <= len(blob) <= 20_000_000 or len(blob) % 16:
        raise ValueError("Arquivo .plr vazio, corrompido ou incompleto")
    decryptor = Cipher(algorithms.AES(KEY), modes.CBC(KEY)).decryptor()
    result = decryptor.update(blob) + decryptor.finalize()
    pad = result[-1]
    if 0 < pad <= 16 and result.endswith(bytes([pad]) * pad):
        result = result[:-pad]
    if len(result) < 32 or result[4:11] != b"relogic":
        raise ValueError("Formato .plr não reconhecido (Terraria original do PC)")
    return result


def read_string(data: bytes, offset: int) -> tuple[str, int]:
    size = 0
    shift = 0
    for _ in range(5):
        if offset >= len(data):
            raise ValueError("String fora do arquivo")
        byte = data[offset]
        offset += 1
        size |= (byte & 127) << shift
        if not byte & 128:
            break
        shift += 7
    else:
        raise ValueError("Tamanho de string inválido")
    if not 0 <= size <= 1024 or offset + size > len(data):
        raise ValueError("String fora do arquivo")
    return data[offset:offset + size].decode("utf-8", "strict"), offset + size


def header(data: bytes) -> tuple[int, str, int]:
    version = struct.unpack_from("<i", data, 0)[0]
    if not 230 <= version <= 500:
        raise ValueError(f"Versão de personagem não suportada: {version}")
    # Header: version (4), signature (7), type (1), revision (4), favorite (8).
    player, pos = read_string(data, 24)
    if not player or len(player) > 80:
        raise ValueError("Nome de personagem inválido")
    mode = data[pos] if pos < len(data) else -1
    if mode != 3:
        raise ValueError("Selecione um personagem do Modo Jornada")
    return version, player, mode


_RE_PERSISTENT = re.compile(r"^[A-Za-z][A-Za-z0-9_:]{0,90}$")


def research_at(data: bytes, offset: int, items: dict[str, tuple[int, int]]) -> Optional[tuple[dict, int, int]]:
    """Validate a count-prefixed research list and the following slot-flags byte.

    Never silently interpret arbitrary binary matches as researched items.
    """
    n = struct.unpack_from("<i", data, offset)[0]
    if n < 1 or n > 9000 or offset + 4 + 6 * n + 1 > len(data):
        return None
    pos = offset + 4
    counts: dict[int, int] = {}
    known = 0
    unknown = 0
    unknown_keys = {}
    first_known = False
    for i in range(n):
        try:
            name, pos = read_string(data, pos)
        except (ValueError, UnicodeDecodeError):
            return None
        if not _RE_PERSISTENT.fullmatch(name) or pos + 4 > len(data):
            return None
        quantity = struct.unpack_from("<i", data, pos)[0]
        pos += 4
        if not 0 <= quantity <= 100000:
            return None
        item_key = name.split(":", 1)[-1]
        if item_key in items:
            if i == 0:
                first_known = True
            item_id, _ = items[item_key]
            counts[item_id] = quantity
            known += 1
        else:
            unknown += 1
            unknown_keys[name] = quantity
        if unknown > max(3, (n * 95) // 100):
            return None
    # Terraria saves four optional temporary slots using FOUR BITS of ONE BYTE.
    # The previous implementation incorrectly required four literal 0/1 bytes,
    # which rejects normal modern (1.4.5) character files.
    if pos >= len(data) or data[pos] & 0xF0:
        return None
    if known < 1:
        return None
    if n == 1 and not first_known:
        return None
    return counts, unknown_keys, n


def research_tail_quality(data: bytes, pos: int, version: int) -> int:
    """Validate fields immediately following a research list.

    Terraria 1.4.x: 1 byte flags (4 optional 9-byte item slots), journey
    settings bool/key/value list, super-cart flags, then loadout index.
    Each validated structure increases confidence without guessing items.
    Returns 0 for malformed continuation, 1..3 for validated sections.
    """
    if pos >= len(data):
        return 0
    flags = data[pos]
    pos += 1
    if flags & 0xf0:
        return 0
    for i in range(4):
        if flags & (1 << i):
            if pos + 9 > len(data):
                return 0
            item_id, stack = struct.unpack_from("<ii", data, pos)
            prefix = data[pos + 8]
            if not -1 <= item_id <= 10000 or not 0 <= stack <= 1000000 or prefix > 120:
                return 0
            pos += 9
    quality = 1
    if version >= 220:
        seen_keys = set()
        for _ in range(8):
            if pos >= len(data) or data[pos] not in (0, 1):
                return quality
            has_next = data[pos]
            pos += 1
            if not has_next:
                quality = 2
                break
            if pos + 2 > len(data):
                return quality
            key = struct.unpack_from('<h', data, pos)[0]
            pos += 2
            if key in seen_keys or key not in (5, 11, 14):
                return quality
            seen_keys.add(key)
            if key == 14:
                if pos + 4 > len(data):
                    return quality
                value = struct.unpack_from('<f', data, pos)[0]
                if not -1000 <= value <= 1000:
                    return quality
                pos += 4
            else:
                if pos >= len(data) or data[pos] not in (0, 1):
                    return quality
                pos += 1
        else:
            return quality
    if version >= 253:
        if pos >= len(data) or data[pos] & 0xfc:
            return quality
        pos += 1
    if version >= 262:
        if pos + 4 > len(data):
            return quality
        selected = struct.unpack_from('<i', data, pos)[0]
        if selected not in (0, 1, 2):
            return quality
    return 3 if version >= 262 else quality


def extract_research(data: bytes, items: dict[str, tuple[int, int]]) -> tuple[dict[int, int], dict[str, int]]:
    # Look for a self-consistent research table, then validate the following
    # Terraria structures to disambiguate repeated binary candidates.
    version = struct.unpack_from('<i', data, 0)[0]
    minimum = max(30, int(len(data) * .20))
    candidates = []
    for pos in range(minimum, len(data) - 12):
        n = struct.unpack_from('<i', data, pos)[0]
        if not 1 <= n <= 9000 or pos + 4 + n * 6 + 1 > len(data):
            continue
        first_length = data[pos + 4]
        if first_length < 2 or first_length > 91 or pos + 5 + first_length > len(data):
            continue
        try:
            name = data[pos + 5:pos + 5 + first_length].decode('ascii')
        except UnicodeDecodeError:
            continue
        if name.split(':', 1)[-1] not in items and n <= 2:
            continue
        result = research_at(data, pos, items)
        if result is None:
            continue
        counts, unknown_keys, found = result
        # Compute end offset exactly; don't assume a fixed list byte length.
        cursor = pos + 4
        for _ in range(found):
            _, cursor = read_string(data, cursor)
            cursor += 4
        quality = research_tail_quality(data, cursor, version)
        if quality == 0:
            continue
        known = found - len(unknown_keys)
        signature = (tuple(sorted(counts.items())), tuple(sorted(unknown_keys.items())))
        candidates.append((known, found, quality, pos, signature, counts, unknown_keys))

    if not candidates:
        raise ValueError('Lista de pesquisas não reconhecida neste save. Nada foi marcado.')
    # Prefer the biggest coherent list; structural validation breaks ties.
    candidates.sort(key=lambda c: (c[0], c[1], c[2]), reverse=True)
    best = candidates[0]
    ties = [candidate for candidate in candidates if candidate[:3] == best[:3]]
    # Duplicate occurrences with exactly the same item quantities are NOT
    # ambiguous: they would produce precisely the same site progress.
    distinct_signatures = {candidate[4] for candidate in ties}
    if len(distinct_signatures) > 1:
        raise ValueError(
            f'Lista de pesquisas ambígua: {len(ties)} candidatos, '
            f'{best[1]} registros e qualidade {best[2]}. Nada foi marcado.'
        )
    return best[5], best[6]


def decode_save(blob: bytes, items: dict[str, tuple[int, int]]) -> dict:
    raw = decrypt_player(blob)
    version, player, _ = header(raw)
    counts, unknown_keys = extract_research(raw, items)
    return {"player": player, "version": version,
            "countsById": {str(k): v for k, v in counts.items()},
            "unknownByKey": unknown_keys, "unknownCount": len(unknown_keys)}



def parser_database(items: dict[str, tuple[int, int]]) -> Path:
    """Write a local item-name lookup, never any character/save contents."""
    target = config_path().parent / "parser-items.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    # Public IDs from our catalog are enough for the independent player parser.
    records = {
        str(item_id): {"name": key, "internalName": key}
        for key, (item_id, _needed) in items.items() if item_id > 0
    }
    if len(records) < 1000:
        raise ValueError("Catálogo de IDs insuficiente para leitura segura")
    # Avoid write churn; this file has only public item mappings.
    if not target.exists():
        target.write_text(json.dumps(records, ensure_ascii=False), encoding="utf-8")
    return target


class PlayerReadTrace:
    """Capture *numeric offsets*, never contents, while parsing v326.

    The Terraria 1.4.5.6 library may fail after it has successfully decoded
    the entire Journey research table. A local trace can distinguish that
    from a corrupt or misaligned research list.
    """
    def __init__(self):
        self.line = None
        self.offset = None
        self.string_error_offset = None
        self.partial_research = None

    def tracer(self, frame, event, arg):
        module = frame.f_globals.get("__name__", "")
        function = frame.f_code.co_name
        if module == "terraria_player.parser.player" and function == "parse":
            if event in ("line", "exception"):
                self.line = frame.f_lineno
                reader = frame.f_locals.get("reader")
                if reader is not None:
                    try:
                        self.offset = reader.tell()
                    except Exception:
                        pass
                if event == "exception":
                    candidate = frame.f_locals.get("player")
                    if isinstance(candidate, dict):
                        research = candidate.get("researched_items")
                        # This field is assigned only when all entries have
                        # been read successfully by the external parser.
                        if isinstance(research, dict) and research:
                            self.partial_research = {
                                "name": candidate.get("name"),
                                "difficulty": candidate.get("difficulty"),
                                "version": candidate.get("version"),
                                "researched_items": dict(research),
                            }
        elif module == "terraria_player.binary.reader" and function == "read_7bit_int":
            if event == "exception":
                reader = frame.f_locals.get("self")
                if reader is not None:
                    try:
                        self.string_error_offset = reader.tell()
                    except Exception:
                        pass
        return self.tracer

    def public_summary(self, data_size: int) -> str:
        line = self.line if self.line is not None else "?"
        position = self.offset if self.offset is not None else "?"
        string_pos = (self.string_error_offset if self.string_error_offset is not None
                      else "?")
        if isinstance(position, int):
            percent = round(position * 100 / max(1, data_size), 1)
            pos_text = f"{position}/{data_size} ({percent}%)"
        else:
            pos_text = f"{position}/{data_size}"
        status = "completa" if self.partial_research else "não alcançada"
        return (f"parser_linha={line}, offset={pos_text}, "
                f"string_offset={string_pos}, tabela_pesquisa={status}")


def decode_character_file(path: Path, items: dict[str, tuple[int, int]]) -> dict:
    """Read player data without altering any file.

    For save v326 use an *experimental guarded parse* with the v319 field
    definitions. Only publish counters when multiple independent validations
    pass. Do not silently downgrade saves or guess research offsets.
    """
    encrypted = path.read_bytes()
    raw = decrypt_player(encrypted)
    version, player, _ = header(raw)
    if version > 326:
        raise ValueError(
            f"Save versão {version}: formato superior ao 326; "
            "aguarde atualização do leitor. Nenhum item foi marcado."
        )
    try:
        from terraria_player import PlayerParser
        from terraria_player.parser import player as player_parser_impl
    except ImportError as exc:
        raise RuntimeError("Biblioteca de leitura 1.4.5 ausente no executável") from exc

    compatibility_probe = version >= 320
    supported_before = player_parser_impl.SUPPORTED_VERSIONS
    previous_trace = sys.gettrace()
    trace = PlayerReadTrace() if compatibility_probe else None
    partial_tail_parse = False
    try:
        if compatibility_probe:
            # Attempt a read with the prior version's schema. This is only
            # used for a guarded compatibility check, not proof of support.
            player_parser_impl.SUPPORTED_VERSIONS = range(0, 327)
            sys.settrace(trace.tracer)
        if compatibility_probe:
            from v326_reader import Terraria326Parser
            parser_cls = Terraria326Parser
        else:
            parser_cls = PlayerParser
        parsed = parser_cls(path, parser_database(items)).parse()
    except Exception as exc:
        # A future Terraria version may add fields AFTER the research table.
        # In that one case, preserve *completed* table values from parser
        # locals, never a partially parsed research dictionary.
        if (trace is not None and trace.partial_research is not None
                and isinstance(trace.offset, int)
                and len(raw) // 3 < trace.offset <= len(raw)):
            parsed = dict(trace.partial_research)
            parsed["_parser_offset"] = trace.offset
            parsed["_remaining_bytes"] = len(raw) - trace.offset
            partial_tail_parse = True
        else:
            details = trace.public_summary(len(raw)) if trace else "leitor anterior"
            raise ValueError(
                f"Leitura estrutural do save v{version} falhou "
                f"({type(exc).__name__}); {details}. "
                "Nenhum item foi marcado."
            ) from exc
    finally:
        sys.settrace(previous_trace)
        player_parser_impl.SUPPORTED_VERSIONS = supported_before

    if parsed.get("name") != player or parsed.get("version") != version:
        raise ValueError("Dados de cabeçalho inconsistentes. Nada foi marcado.")
    if parsed.get("difficulty") != "Journey":
        raise ValueError("O leitor não confirmou Modo Jornada; nada foi marcado.")

    # The parser exposes exactly how far it read. Prevent partial reads with
    # implausibly large trailing payloads from being interpreted as research.
    consumed = parsed.get("_parser_offset")
    trailing = parsed.get("_remaining_bytes")
    if not isinstance(consumed, int) or not isinstance(trailing, int):
        raise ValueError("Leitor não informou os limites da leitura. Nada foi marcado.")
    if not (len(raw) // 3 < consumed <= len(raw)) or trailing != len(raw) - consumed:
        raise ValueError("Limites da estrutura incompatíveis com o save. Nada foi marcado.")
    # For partial-tail parsing the research table was fully assigned by the
    # trusted versioned reader. Unknown post-research bytes are never read.
    if compatibility_probe:
        limit = max(16384, len(raw) // 2) if partial_tail_parse else max(4096, len(raw) // 10)
        if trailing > limit:
            raise ValueError(
                f"Save v{version}: {trailing} bytes finais não interpretados; "
                "leitura inconclusiva. Nada foi marcado."
            )

    researched = parsed.get("researched_items")
    if not isinstance(researched, dict):
        raise ValueError("Leitor não encontrou tabela de pesquisas. Nada foi marcado.")
    counts: dict[str, int] = {}
    unknown_keys: dict[str, int] = {}
    recognized = 0
    for code_name, quantity in researched.items():
        if not isinstance(code_name, str) or not isinstance(quantity, int):
            raise ValueError("Dados de pesquisa inválidos. Nada foi marcado.")
        if quantity < 0 or quantity > 1000000:
            raise ValueError("Quantidade de pesquisa inválida. Nada foi marcado.")
        key = code_name.split(":", 1)[-1]
        match = items.get(key)
        if match:
            recognized += 1
            item_id, _ = match
            counts[str(item_id)] = max(counts.get(str(item_id), 0), quantity)
        else:
            unknown_keys[code_name] = quantity
    if compatibility_probe:
        # v326 has not been validated using this user's actual save. The
        # structural parse must retain known vanilla persistent item IDs.
        if not researched or recognized < 1:
            raise ValueError(
                "Save v326: nenhuma pesquisa reconhecida com segurança. "
                "Nada foi marcado."
            )
        if recognized * 10 < len(researched) * 7:
            raise ValueError(
                f"Save v326: identificados apenas {recognized}/"
                f"{len(researched)} IDs conhecidos; leitura inconclusiva. Nada foi marcado."
            )
    return {
        "player": player, "version": version,
        "countsById": counts, "unknownByKey": unknown_keys,
        "unknownCount": len(unknown_keys),
        "compatibility": ("v326-pesquisas-completas-salvas-antes-de-campo-novo" if partial_tail_parse
                          else "v326-experimental-validado-estruturalmente" if compatibility_probe
                          else "conhecido"),
        "diagnostic": {
            "version": version, "entries": len(researched),
            "recognized": recognized, "unrecognized": len(unknown_keys),
            "trailingBytes": trailing,
            "partial": partial_tail_parse,
            "parserLine": trace.line if trace else None,
            "stringOffset": trace.string_error_offset if trace else None,
        }
    }


def candidate_paths() -> list[Path]:
    homes = [Path.home() / "Documents" / "My Games" / "Terraria" / "Players",
             Path.home() / "OneDrive" / "Documents" / "My Games" / "Terraria" / "Players"]
    onedrive = os.environ.get("OneDrive")
    if onedrive:
        homes.append(Path(onedrive) / "Documents" / "My Games" / "Terraria" / "Players")
    for steam in (Path(os.environ.get("PROGRAMFILES(X86)", "C:/Program Files (x86)")) / "Steam",
                  Path("C:/Program Files/Steam")):
        user_dir = steam / "userdata"
        if user_dir.is_dir():
            homes.extend(user_dir.glob("*/105600/remote/players"))
            homes.extend(user_dir.glob("*/105600/remote/Players"))
    paths = set()
    for folder in homes:
        if folder.is_dir():
            paths.update(f.resolve() for f in folder.glob("*.plr") if f.is_file())
    return sorted(paths, key=lambda p: str(p).lower())


def choose_player(force: bool = False) -> Path:
    cfg = config_path()
    if not force and cfg.is_file():
        try:
            p = Path(json.loads(cfg.read_text(encoding="utf-8"))["player"])
            if p.is_file() and p.suffix.lower() == ".plr":
                return p
        except (ValueError, OSError, KeyError, TypeError):
            pass
    files = candidate_paths()
    if len(files) == 1 and not force:
        chosen = files[0]
    else:
        print("\nEscolha o personagem do Terraria (somente .plr):")
        for n, f in enumerate(files, start=1):
            print(f"  {n}. {f.name}  [{f.parent}]")
        print("  A. Escolher outra pasta/arquivo")
        if not files:
            print("Nenhum save local encontrado. Escolha o .plr manualmente.")
        response = input("Número (ou A): ").strip().lower() if sys.stdin.isatty() else "a"
        if response.isdecimal() and 1 <= int(response) <= len(files):
            chosen = files[int(response)-1]
        else:
            try:
                import tkinter as tk
                from tkinter import filedialog
                root = tk.Tk()
                root.withdraw()
                path = filedialog.askopenfilename(title="Escolha seu personagem do Modo Jornada",
                                                 filetypes=[("Terraria save", "*.plr")])
                root.destroy()
                if not path:
                    raise RuntimeError("Nenhum personagem selecionado")
                chosen = Path(path)
            except ImportError as exc:
                raise RuntimeError("Interface gráfica indisponível; informe o caminho com --player") from exc
    if not chosen.is_file() or chosen.suffix.lower() != ".plr":
        raise RuntimeError("Escolha um arquivo de personagem .plr válido")
    cfg.parent.mkdir(parents=True, exist_ok=True)
    cfg.write_text(json.dumps({"player": str(chosen)}, ensure_ascii=False, indent=2), encoding="utf-8")
    return chosen


class SyncService:
    def __init__(self, player: Path, items: dict[str, tuple[int, int]]):
        self.player = player
        self.items = items
        self.signature = None
        self.last_error = None

    def refresh(self):
        try:
            st = self.player.stat()
            signature = (st.st_mtime_ns, st.st_size)
            if signature == self.signature:
                return
            # Windows/game can briefly hold this file open; retry next poll.
            result = decode_character_file(self.player, self.items)
            result.update({"app": "journey-archive-companion", "protocol": 1,
                           "ok": True, "message": "Save sincronizado",
                           "updatedAt": datetime.now(timezone.utc).isoformat()})
            with LOCK:
                STATE.clear()
                STATE.update(result)
            self.signature = signature
            self.last_error = None
            print(f"[{datetime.now():%H:%M:%S}] {result['player']}: {len(result['countsById'])} pesquisas identificadas")
        except Exception as exc:
            # Preserve last valid counts, but stop the website from applying them
            # until another valid save is successfully decoded.
            with LOCK:
                STATE["ok"] = False
                STATE["message"] = str(exc)
            self.signature = None
            if str(exc) != self.last_error:
                print(f"[{datetime.now():%H:%M:%S}] Aguardando save válido: {exc}")
                self.last_error = str(exc)


def monitor(service: SyncService, stop: threading.Event):
    while not stop.is_set():
        service.refresh()
        stop.wait(3)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def origin_valid(self):
        origin = self.headers.get("Origin")
        # Direct browser diagnostic requests without Origin do not expose any
        # absolute paths, raw saves, or tokens.
        return origin is None or origin in ALLOWED_ORIGINS

    def respond(self, status, data):
        payload = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        origin = self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self):
        if not self.origin_valid():
            return self.respond(403, {"ok": False, "message": "Origem não autorizada"})
        self.send_response(204)
        origin = self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.send_header("Vary", "Origin")
        self.end_headers()

    def do_GET(self):
        if not self.origin_valid() or self.headers.get("Host", "").split(":")[0] not in ("127.0.0.1", "localhost"):
            return self.respond(403, {"ok": False, "message": "Origem não autorizada"})
        if self.path.split("?")[0] != "/status":
            return self.respond(404, {"ok": False, "message": "Rota inexistente"})
        with LOCK:
            snapshot = dict(STATE)
        self.respond(200, snapshot)


def startup(install: bool, exe: Path) -> None:
    if os.name != "nt":
        raise RuntimeError("Inicialização automática disponível apenas no Windows")
    import winreg
    name = "JourneyArchiveSync"
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER,
                        r"Software\Microsoft\Windows\CurrentVersion\Run",
                        0, winreg.KEY_SET_VALUE) as key:
        if install:
            if not getattr(sys, "frozen", False):
                raise RuntimeError("Use o executável .exe para ativar a inicialização automática")
            winreg.SetValueEx(key, name, 0, winreg.REG_SZ, f'"{exe}" --start')
        else:
            try:
                winreg.DeleteValue(key, name)
            except FileNotFoundError:
                pass


def main():
    parser = argparse.ArgumentParser(description="Sincronização local de pesquisas do Terraria")
    parser.add_argument("--player", help="Caminho para .plr, opcional")
    parser.add_argument("--select", action="store_true", help="Trocar personagem monitorado")
    parser.add_argument("--install-startup", action="store_true", help="Iniciar com Windows")
    parser.add_argument("--remove-startup", action="store_true", help="Remover início com Windows")
    parser.add_argument("--start", action="store_true", help="Iniciar usando seleção anterior")
    parser.add_argument("--diagnose", action="store_true", help="Conferir localmente formato e leitura do save sem alterar nada")
    args = parser.parse_args()
    if args.install_startup or args.remove_startup:
        startup(args.install_startup, Path(sys.executable).resolve())
        print("Inicialização automática configurada." if args.install_startup else "Inicialização automática desativada.")
        return
    items = load_items()
    player = Path(args.player).resolve() if args.player else choose_player(force=args.select)
    if not player.is_file():
        raise RuntimeError("Arquivo .plr inexistente")
    if args.diagnose:
        encrypted = player.read_bytes()
        raw = decrypt_player(encrypted)
        version, _player_name, _ = header(raw)
        print(f"Diagnóstico: v{version}; tamanho={len(encrypted)} bytes; modo=Jornada")
        try:
            results = decode_character_file(player, items)
            report = results.get("diagnostic", {})
            print(f"Leitura OK: {results.get('compatibility', 'conhecido')}; "
                  f"pesquisas={report.get('entries')}, "
                  f"identificadas={report.get('recognized')}, "
                  f"novas/desconhecidas={report.get('unrecognized')}, "
                  f"bytes finais={report.get('trailingBytes')}; "
                  f"parcial={report.get('partial')}; "
                  f"linha={report.get('parserLine')}; "
                  f"stringOffset={report.get('stringOffset')}")
        except Exception as exc:
            print(f"Leitura indisponível: {exc}")
        return
    service = SyncService(player, items)
    service.refresh()
    stop = threading.Event()
    threading.Thread(target=monitor, args=(service, stop), daemon=True).start()
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"\nJourney Archive: {player.name}")
    print(f"Sincronização em execução em http://127.0.0.1:{PORT}/status")
    print("Abra https://sungfix.github.io/terraria-journey-archive/")
    print("Não feche esta janela enquanto quiser sincronizar. Ctrl+C para parar.\n")
    try:
        server.serve_forever(poll_interval=.5)
    except KeyboardInterrupt:
        pass
    finally:
        stop.set()
        server.server_close()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("Erro:", exc)
        if sys.stdin.isatty():
            input("Pressione Enter para sair...")
        sys.exit(1)