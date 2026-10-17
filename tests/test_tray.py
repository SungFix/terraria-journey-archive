"""Tray regression tests, including mode without a visible Command Prompt."""
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import MagicMock, patch

from companion import sync, tray


class WindowsTrayTests(unittest.TestCase):
    def test_tray_image_and_menu_are_available(self):
        image = tray._tray_image()
        self.assertEqual(image.size, (64, 64))
        self.assertEqual(image.mode, "RGBA")
        app = tray.TrayApp()
        menu = app._menu()
        self.assertGreaterEqual(len(list(menu)), 6)

    def test_no_service_prompts_for_character(self):
        app = tray.TrayApp()
        self.assertIn("Escolha", app._status())
        self.assertIsNone(app.player)

    def test_silently_load_existing_selected_character(self):
        with tempfile.TemporaryDirectory() as directory:
            fake_player = Path(directory) / "Traveler.plr"
            fake_player.write_bytes(b"fake-data")
            config = Path(directory) / "sync-config.json"
            config.write_text(json.dumps({"player": str(fake_player)}), encoding="utf-8")
            app = tray.TrayApp()
            mock_server = MagicMock()
            mock_backend_service = MagicMock()
            with patch.object(sync, "config_path", return_value=config), \
                 patch.object(sync, "load_items", return_value={"Torch": (8, 100)}), \
                 patch.object(sync, "SyncService", return_value=mock_backend_service), \
                 patch.object(sync, "ThreadingHTTPServer", return_value=mock_server), \
                 patch.object(tray.pystray, "Icon") as icon_class:
                icon_class.return_value.run.return_value = None
                app.start(automatic=True)
                self.assertEqual(app.player, fake_player)
                self.assertIs(app.service, mock_backend_service)
                mock_server.shutdown.assert_called()
                mock_server.server_close.assert_called()

    def test_switch_character_resets_progress_and_uses_new_service(self):
        with tempfile.TemporaryDirectory() as directory:
            character = Path(directory) / "Different.plr"
            character.write_bytes(b"x")
            app = tray.TrayApp()
            app.items = {"Torch": (8, 100)}
            app.icon = MagicMock()
            with patch.object(sync, "choose_player", return_value=character), \
                 patch.object(sync, "SyncService") as mock_service:
                with sync.LOCK:
                    snapshot = dict(sync.STATE)
                    sync.STATE.update({"ok": True, "countsById": {"8": 100}, "unknownByKey": {}})
                try:
                    app._select_character()
                    self.assertEqual(app.player, character)
                    mock_service.return_value.refresh.assert_called_once()
                    # Prevent old character progress from leaking after switch.
                    with sync.LOCK:
                        self.assertEqual(sync.STATE["countsById"], {})
                finally:
                    with sync.LOCK:
                        sync.STATE.clear()
                        sync.STATE.update(snapshot)

    def test_old_console_selector_handles_absent_stdin(self):
        with tempfile.TemporaryDirectory() as directory:
            character = Path(directory) / "Chosen.plr"
            character.write_bytes(b"fake")
            config = Path(directory) / "sync-config.json"
            mock_tk = MagicMock()
            mock_tk.Tk.return_value = MagicMock()
            mock_picker = MagicMock()
            mock_picker.askopenfilename.return_value = str(character)
            with patch.object(sync, "candidate_paths", return_value=[]), \
                 patch.object(sync, "config_path", return_value=config), \
                 patch.object(sync.sys, "stdin", None), \
                 patch.dict("sys.modules", {"tkinter": mock_tk, "tkinter.filedialog": mock_picker}), \
                 patch("builtins.print"):
                selected = sync.choose_player(force=True)
            self.assertEqual(selected, character)
            self.assertTrue(config.is_file())
            self.assertEqual(json.loads(config.read_text(encoding="utf-8"))["player"], str(character))


if __name__ == "__main__":
    unittest.main()
