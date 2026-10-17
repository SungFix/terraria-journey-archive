"""Regression against an independently published real Terraria v326 player save.

Source: Live-yum/TerraWasm, tests/files/烟花.plr
Pinned upstream revision: 40df1fefa236330c6f906434c99db8ce19eedab3
This test does not upload personal user data or change the example save.
"""
import json
import tempfile
import unittest
from pathlib import Path
from urllib.request import urlopen

from test_companion import sync

FIXTURE_URL = (
    "https://raw.githubusercontent.com/Live-yum/TerraWasm/"
    "40df1fefa236330c6f906434c99db8ce19eedab3/"
    "tests/files/%E7%83%9F%E8%8A%B1.plr"
)


class Real326SaveTests(unittest.TestCase):
    def test_parse_real_v326_save(self):
        with urlopen(FIXTURE_URL, timeout=35) as response:
            blob = response.read(80_000)
        self.assertGreater(len(blob), 500)
        records = json.loads(
            (Path(__file__).resolve().parents[1] / "data" / "persistent-items.json")
            .read_text(encoding="utf-8")
        )["items"]
        items = {key: (int(v[0]), int(v[1])) for key, v in records.items()}
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "real-v326.plr"
            path.write_bytes(blob)
            from terraria_player.parser import player as upstream
            from companion.v326_reader import Terraria326Parser
            raw = sync.decrypt_player(blob)
            version = int.from_bytes(raw[:4], "little", signed=True)
            self.assertEqual(version, 326)
            # The published sample is a normal (non-Journey) character.
            # Validate the real 326 layout independently of character mode.
            original = upstream.SUPPORTED_VERSIONS
            upstream.SUPPORTED_VERSIONS = range(0, 327)
            try:
                database = Path(root) / "items.json"
                entries = {
                    str(item_id): {"name": name, "internalName": name}
                    for name, (item_id, _) in items.items()
                }
                database.write_text(json.dumps(entries), encoding="utf-8")
                parsed = Terraria326Parser(path, database).parse()
            finally:
                upstream.SUPPORTED_VERSIONS = original
        self.assertEqual(parsed["version"], 326)
        self.assertIn(parsed["difficulty"], ("SoftCore", "MediumCore", "Hardcore", "Journey"))
        self.assertIsInstance(parsed["researched_items"], dict)
        self.assertGreater(parsed["_parser_offset"], len(raw) // 2)
        self.assertLess(parsed["_remaining_bytes"], max(4096, len(raw) // 10))


if __name__ == "__main__":
    unittest.main()
