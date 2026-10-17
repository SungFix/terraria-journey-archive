"""Windows tray UI for the Terraria Journey Archive local synchronizer.

No Command Prompt window is required. Terraria saves are read only, on this
computer, using the same existing companion backend and port (47838).

Run with a windowed PyInstaller build: JourneyArchiveSync.exe
Keep companion/sync.py as an optional console diagnostic executable.
"""
from __future__ import annotations

import argparse
import logging
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path
import sys
import threading
import webbrowser

from PIL import Image, ImageDraw
import pystray

try:
    from companion import sync as backend
except ImportError:
    import sync as backend

WEBSITE = "https://sungfix.github.io/terraria-journey-archive/"
APP_NAME = "Journey Archive"
LOGGER = logging.getLogger("journey_archive")


def _configure_logging():
    """Ensure --windowed runs correctly when stdout and stderr are None."""
    logs = backend.config_path().parent
    logs.mkdir(parents=True, exist_ok=True)
    handler = RotatingFileHandler(logs / "tray.log", maxBytes=180_000, backupCount=1, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    LOGGER.setLevel(logging.INFO)
    LOGGER.addHandler(handler)
    # Console backend uses print during the save poll; a windowed exe has no
    # stdout, so route it to devnull rather than crashing after first save.
    if sys.stdout is None:
        sys.stdout = open(os.devnull, "w", encoding="utf-8")
    if sys.stderr is None:
        sys.stderr = open(os.devnull, "w", encoding="utf-8")


def _show_message(title: str, message: str, *, error: bool = False):
    """Show a single native Windows dialog; no persistent console."""
    import tkinter as tk
    from tkinter import messagebox
    root = tk.Tk()
    root.withdraw()
    try:
        if error:
            messagebox.showerror(title, message, parent=root)
        else:
            messagebox.showinfo(title, message, parent=root)
    finally:
        root.destroy()


def _tray_image():
    """Tiny status icon for the Windows notification area."""
    size = 64
    pic = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(pic)
    d.rounded_rectangle((4, 4, 60, 60), radius=12,
                        fill=(43, 83, 51, 255), outline=(178, 219, 130, 255), width=3)
    # A simple pixel-like J so it remains identifiable at 16px.
    d.rectangle((18, 16, 48, 22), fill=(246, 218, 139, 255))
    d.rectangle((38, 22, 45, 45), fill=(246, 218, 139, 255))
    d.rectangle((18, 39, 38, 46), fill=(246, 218, 139, 255))
    d.rectangle((18, 33, 24, 39), fill=(246, 218, 139, 255))
    return pic


def _autostart_enabled() -> bool:
    if os.name != "nt":
        return False
    try:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER,
                            r"Software\Microsoft\Windows\CurrentVersion\Run") as reg:
            value, _ = winreg.QueryValueEx(reg, "JourneyArchiveSync")
        return str(Path(sys.executable).resolve()).lower() in value.lower()
    except (OSError, ValueError):
        return False


class TrayApp:
    def __init__(self):
        self.items = None
        self.service = None
        self.player = None
        self.icon = None
        self.server = None
        self.server_thread = None
        self.monitor_thread = None
        self.stop = threading.Event()
        self.service_lock = threading.RLock()
        self.last_label = None

    def _status(self):
        if self.service is None:
            return "Escolha um personagem"
        with backend.LOCK:
            state = dict(backend.STATE)
        if state.get("ok"):
            return f"Sincronizado · {len(state.get('countsById', {}))} itens"
        if state.get("message"):
            # Keep errors out of the taskbar tooltip; readable via the menu.
            return "Aguardando save válido"
        return "Aguardando save"

    def _status_info(self, *_):
        with backend.LOCK:
            state = dict(backend.STATE)
        person = self.player.name if self.player is not None else "Não selecionado"
        status = "Sincronizado" if state.get("ok") else "Aguardando"
        details = str(state.get("message", ""))
        if not state.get("ok") and self.service is not None:
            details = details[:260] if details else "Aguardando um save válido"
        text = (
            f"Personagem: {person}\n"
            f"Status: {status}\n"
            f"Pesquisas identificadas: {len(state.get('countsById', {})) if state.get('ok') else '—'}\n"
            f"{details}\n\n"
            "A sincronização funciona em segundo plano.\n"
            "Os arquivos do personagem não são modificados nem enviados."
        )
        _show_message(APP_NAME, text)

    def _refresh_icon(self):
        icon = self.icon
        if icon is None:
            return
        title = APP_NAME + " — " + self._status()
        if title == self.last_label:
            return
        self.last_label = title
        icon.title = title
        try:
            icon.update_menu()
        except Exception as exc:
            LOGGER.debug("Menu indisponível para atualização: %s", type(exc).__name__)

    def _select_character(self, _icon=None, _item=None, *, force=True):
        # Uses the original, safe .plr picker. Running without console makes
        # it open a Windows file dialog instead of asking for terminal input.
        try:
            selected = backend.choose_player(force=force)
            with self.service_lock:
                self.player = selected
                self.service = backend.SyncService(selected, self.items)
                with backend.LOCK:
                    backend.STATE.update({
                        "ok": False, "message": "Aguardando leitura do novo personagem",
                        "player": selected.stem, "countsById": {},
                        "unknownByKey": {}, "unknownCount": 0,
                        "updatedAt": None,
                    })
                self.service.refresh()
            LOGGER.info("Personagem escolhido: %s", selected.name)
        except RuntimeError as exc:
            if "Nenhum personagem selecionado" not in str(exc):
                LOGGER.warning("Seleção de personagem: %s", exc)
                _show_message(APP_NAME, str(exc), error=True)
        except Exception as exc:
            LOGGER.exception("Falha ao selecionar personagem")
            _show_message(APP_NAME, f"Não foi possível selecionar o personagem:\n{exc}", error=True)
        self._refresh_icon()

    def _toggle_startup(self, *_):
        try:
            enabled = _autostart_enabled()
            backend.startup(not enabled, Path(sys.executable).resolve())
            self._refresh_icon()
        except Exception as exc:
            LOGGER.exception("Não foi possível alterar a inicialização automática")
            _show_message(APP_NAME, f"Não foi possível configurar o Windows:\n{exc}", error=True)

    def _menu(self):
        return pystray.Menu(
            pystray.MenuItem(lambda _: self._status(), self._status_info, default=True),
            pystray.MenuItem(lambda _: "Personagem: " + (self.player.name if self.player else "não selecionado"),
                             None, enabled=False),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Abrir Journey Archive", lambda *_: webbrowser.open(WEBSITE)),
            pystray.MenuItem("Escolher personagem...", self._select_character),
            pystray.MenuItem("Iniciar com Windows", self._toggle_startup,
                             checked=lambda _: _autostart_enabled()),
            pystray.MenuItem("Ver status", self._status_info),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Sair do sincronizador", self._quit),
        )

    def _monitor(self):
        while not self.stop.is_set():
            with self.service_lock:
                if self.service is not None:
                    try:
                        self.service.refresh()
                    except Exception:
                        LOGGER.exception("Falha inesperada de monitoramento")
            self._refresh_icon()
            self.stop.wait(3)

    def _quit(self, icon=None, _item=None):
        self.stop.set()
        # Called from tray main message loop, while serve_forever runs in a
        # worker; shutdown therefore cannot deadlock.
        if self.server is not None:
            try:
                self.server.shutdown()
            except Exception:
                LOGGER.exception("Falha ao desligar servidor")
            self.server.server_close()
            self.server = None
        if icon is not None:
            icon.stop()
        elif self.icon is not None:
            self.icon.stop()

    def start(self, *, select=False, automatic=False):
        self.items = backend.load_items()
        # Bind before asking for files so a second instance doesn't present
        # duplicate dialogs and cannot unexpectedly overwrite status.
        try:
            self.server = backend.ThreadingHTTPServer(("127.0.0.1", backend.PORT), backend.Handler)
        except OSError as exc:
            raise RuntimeError(
                "O sincronizador já está em execução ou a porta 47838 está ocupada.\n"
                "Confira os ícones ocultos perto do relógio do Windows."
            ) from exc
        self.server_thread = threading.Thread(target=self.server.serve_forever,
                                               name="JourneyArchiveHTTP", daemon=True)
        self.server_thread.start()
        self.icon = pystray.Icon("JourneyArchiveSync", _tray_image(), APP_NAME, self._menu())
        try:
            if automatic:
                # Never display a file-picker unexpectedly on Windows login.
                cfg = backend.config_path()
                if cfg.is_file():
                    try:
                        data = backend.json.loads(cfg.read_text(encoding="utf-8"))
                        player = Path(data["player"])
                        if player.is_file() and player.suffix.lower() == ".plr":
                            self.player = player
                            self.service = backend.SyncService(player, self.items)
                    except (OSError, ValueError, KeyError, TypeError):
                        pass
            else:
                self._select_character(force=select)
            self.monitor_thread = threading.Thread(target=self._monitor,
                                                    name="JourneyArchiveMonitor", daemon=True)
            self.monitor_thread.start()
            self._refresh_icon()
            # No CMD window: the Windows notification area owns the lifecycle.
            self.icon.run()
        finally:
            self.stop.set()
            if self.server is not None:
                try:
                    self.server.shutdown()
                finally:
                    self.server.server_close()
                    self.server = None


def main(argv=None):
    parser = argparse.ArgumentParser(description="Journey Archive sem console")
    parser.add_argument("--start", action="store_true", help="Iniciar com Windows, sem diálogos")
    parser.add_argument("--select", action="store_true", help="Trocar personagem na inicialização")
    parser.add_argument("--install-startup", action="store_true", help="Ligar início automático")
    parser.add_argument("--remove-startup", action="store_true", help="Desligar início automático")
    parser.add_argument("--self-test", action="store_true", help="Verificar componentes sem iniciar sincronização")
    args = parser.parse_args(argv)
    _configure_logging()
    if args.self_test:
        # Usable from Windows CI even when stdout is absent.
        icon = pystray.Icon("JourneyArchiveSelfTest", _tray_image(), "Test", pystray.Menu(
            pystray.MenuItem("Sair", lambda icon, _: icon.stop())))
        if icon.icon.size != (64, 64):
            raise RuntimeError("Ícone do tray inválido")
        return
    if args.install_startup or args.remove_startup:
        backend.startup(args.install_startup, Path(sys.executable).resolve())
        _show_message(APP_NAME, "Inicialização automática " +
                      ("ativada." if args.install_startup else "desativada."))
        return
    app = TrayApp()
    app.start(select=args.select, automatic=args.start)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        LOGGER.exception("Erro ao executar sincronizador na bandeja")
        try:
            _show_message(APP_NAME, str(exc), error=True)
        except Exception:
            pass
        sys.exit(1)
