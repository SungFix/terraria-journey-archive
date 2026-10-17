"""Synthetic regression tests. No personal Terraria saves are used."""
import importlib.util
import struct
import unittest
from pathlib import Path
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

spec = importlib.util.spec_from_file_location("journey_sync", Path(__file__).resolve().parents[1] / "companion" / "sync.py")
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)

ITEMS = {"IronPickaxe": (1, 1), "DirtBlock": (2, 100), "StoneBlock": (3, 100), "Torch": (8, 100)}


def pack_list(entries):
    data = struct.pack("<i", len(entries))
    for name, quantity in entries:
        name = name.encode("ascii")
        data += bytes([len(name)]) + name + struct.pack("<i", quantity)
    return data


def fake_save(entries, *, prefix=b"", suffix=b"\0" * 110, game_mode=3, version=310):
    name = b"Tester"
    payload = struct.pack("<i", version) + b"relogic" + b"\x03" + b"\0" * 12
    payload += bytes([len(name)]) + name + bytes([game_mode])
    payload += b"\0" * 3000 + prefix + pack_list(entries) + suffix
    padding = 16 - len(payload) % 16
    payload += bytes([padding]) * padding
    enc = Cipher(algorithms.AES(sync.KEY), modes.CBC(sync.KEY)).encryptor()
    return enc.update(payload) + enc.finalize()


class SaveReaderTests(unittest.TestCase):
    def test_basic_research(self):
        result = sync.decode_save(fake_save([("IronPickaxe", 1), ("DirtBlock", 80)]), ITEMS)
        self.assertEqual(result["countsById"], {"1": 1, "2": 80})

    def test_duplicate_research_lists_with_same_data(self):
        entries = [("IronPickaxe", 1), ("DirtBlock", 100)]
        extra = pack_list(entries) + b"\0" * 250
        result = sync.decode_save(fake_save(entries, prefix=extra), ITEMS)
        self.assertEqual(result["countsById"], {"1": 1, "2": 100})

    def test_conflicting_valid_lists_are_rejected(self):
        extra = pack_list([("IronPickaxe", 1), ("DirtBlock", 70)]) + b"\0" * 250
        with self.assertRaisesRegex(ValueError, "ambígua"):
            sync.decode_save(fake_save([("IronPickaxe", 1), ("DirtBlock", 100)], prefix=extra), ITEMS)

    def test_bad_continuation_loses_tiebreak(self):
        extra = pack_list([("IronPickaxe", 1), ("DirtBlock", 70)]) + b"\0\x02" + b"\0" * 250
        result = sync.decode_save(fake_save([("IronPickaxe", 1), ("DirtBlock", 100)], prefix=extra), ITEMS)
        self.assertEqual(result["countsById"], {"1": 1, "2": 100})

    def test_modern_optional_slots_and_new_items(self):
        suffix = b"\x05" + struct.pack("<iiB", 8, 25, 0) + struct.pack("<iiB", 10, 1, 0) + b"\0" * 120
        result = sync.decode_save(fake_save([("IronPickaxe", 1), ("FutureItem", 4)], suffix=suffix, version=312), ITEMS)
        self.assertEqual(result["countsById"], {"1": 1})
        self.assertEqual(result["unknownCount"], 1)

    def test_invalid_data_never_marks(self):
        with self.assertRaises(ValueError):
            sync.decode_save(fake_save([("IronPickaxe", 1)], suffix=b"\xf0" + b"\0" * 100), ITEMS)
        with self.assertRaises(ValueError):
            sync.decode_save(fake_save([("IronPickaxe", 1)], game_mode=0), ITEMS)


if __name__ == "__main__":
    unittest.main()
