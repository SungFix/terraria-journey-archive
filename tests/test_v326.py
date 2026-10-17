"""Guarded v326 compatibility probe tests; uses synthetic saves ONLY.

These tests exercise safe rejection/acceptance behavior, NOT proof that a
real Terraria v326 save parses successfully. Real-save validation still needed.
"""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from test_companion import ITEMS, fake_save, sync


class Version326Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from terraria_player.parser import player as parser_mod
        cls.parser_mod = parser_mod
        cls.orig_supported = parser_mod.SUPPORTED_VERSIONS

    @classmethod
    def tearDownClass(cls):
        cls.parser_mod.SUPPORTED_VERSIONS = cls.orig_supported

    def make_sample(self, *, version=326, prefix=b""):
        temporary = tempfile.TemporaryDirectory()
        path = Path(temporary.name) / "Synthetic.plr"
        path.write_bytes(fake_save([("DirtBlock", 100)], version=version, prefix=prefix))
        raw = sync.decrypt_player(path.read_bytes())
        self.addCleanup(temporary.cleanup)
        return path, len(raw)

    def payload(self, length, researched=None, **changes):
        response = {
            "name": "Tester",
            "version": 326,
            "difficulty": "Journey",
            "_parser_offset": length,
            "_remaining_bytes": 0,
            "researched_items": researched if researched is not None else {"DirtBlock": 100, "StoneBlock": 10},
        }
        response.update(changes)
        return response

    def parse_fake(self, path, length, response):
        def fake_parse(_self):
            self.assertIn(326, self.parser_mod.SUPPORTED_VERSIONS)
            return response
        with tempfile.TemporaryDirectory() as tmp:
            database = Path(tmp) / "items.json"
            database.write_text('{"2": {"name": "Dirt", "internalName": "DirtBlock"}}', encoding="utf-8")
            with patch.object(sync, "parser_database", return_value=database), patch(
                "terraria_player.PlayerParser.parse", new=fake_parse
            ):
                return sync.decode_character_file(path, ITEMS)

    def test_326_can_sync_only_after_consistent_structural_parse(self):
        path, length = self.make_sample()
        result = self.parse_fake(path, length, self.payload(length))
        self.assertEqual(result["countsById"], {"2": 100, "3": 10})
        self.assertEqual(result["diagnostic"]["version"], 326)
        self.assertEqual(self.parser_mod.SUPPORTED_VERSIONS, self.orig_supported)

    def test_wrong_name_does_not_sync(self):
        path, length = self.make_sample()
        with self.assertRaisesRegex(ValueError, "cabeçalho"):
            self.parse_fake(path, length, self.payload(length, name="AnotherPlayer"))

    def test_unknown_items_are_not_guessed(self):
        path, length = self.make_sample()
        with self.assertRaisesRegex(ValueError, "IDs conhecidos"):
            self.parse_fake(path, length, self.payload(length, researched={
                "DirtBlock": 100, "Nonexistent1": 4, "Nonexistent2": 4,
            }))

    def test_mismatched_consumed_offset_does_not_sync(self):
        path, length = self.make_sample()
        with self.assertRaisesRegex(ValueError, "Limites"):
            self.parse_fake(path, length, self.payload(length, _parser_offset=length - 20))

    def test_no_research_is_inconclusive_for_326(self):
        path, length = self.make_sample()
        with self.assertRaisesRegex(ValueError, "nenhuma pesquisa"):
            self.parse_fake(path, length, self.payload(length, researched={}))

    def test_future_version_stays_blocked(self):
        path, length = self.make_sample(version=327)
        with self.assertRaisesRegex(ValueError, "superior ao 326"):
            sync.decode_character_file(path, ITEMS)


if __name__ == "__main__":
    unittest.main()
