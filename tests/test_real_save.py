"""Regression test using a real, publicly licensed Terraria 1.4.3.2 save.

Source: https://github.com/iagox86/terraria-research-tracker/tree/main/test/testdata
MIT license; test save is not from our users.
"""
import base64
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

DATA = "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"

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("journey_sync_sample", ROOT / "companion" / "sync.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class RealTerrariaSaveTest(unittest.TestCase):
    def test_complete_player_parser_and_research_integration(self):
        items_data = json.loads((ROOT / "data" / "persistent-items.json").read_text(encoding="utf-8"))["items"]
        items = {key: (int(row[0]), int(row[1])) for key, row in items_data.items()}
        with tempfile.TemporaryDirectory() as tmp:
            sample = Path(tmp) / "TestChar.plr"
            sample.write_bytes(base64.b64decode(DATA))
            result = module.decode_character_file(sample, items)
            self.assertIsInstance(result["countsById"], dict)
            self.assertGreaterEqual(result["version"], 230)
            self.assertIn("player", result)
            self.assertIn("unknownCount", result)


if __name__ == "__main__":
    unittest.main()
