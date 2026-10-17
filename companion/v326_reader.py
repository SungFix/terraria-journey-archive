"""Read-only Terraria player parser compatibility bridge for save versions 322-326.

Based on version transitions documented by TerraWasm (Live-yum/TerraWasm):
  - v322: armor/dye slots (including additional loadouts) carry a favorite byte.
  - v324: one reserved byte between artisan bread and permanent upgrades.

This does NOT modify files. We only need complete Journey research information;
unrelated stats parsed immediately before the reserved byte are not used.

Upstream base parser: royalrizen/Terraria-Plr-Editor (MIT).
"""
from terraria_player import PlayerParser


class Terraria326Parser(PlayerParser):
    def __init__(self, player_file, items_file):
        super().__init__(player_file, items_file)
        self._initial_equipment_slots = 0
        self._read_first_color = False
        self._reading_loadout = False

    def read_color(self, reader):
        # The upstream v319 parser expects colors directly after the upgrade
        # flags and counters. v324 inserts one reserved byte before the upgrade
        # flags. Skipping at first color realigns all subsequent item sections;
        # the misdecoded unused prior stats are never trusted for research.
        if self.version >= 324 and not self._read_first_color:
            reader.u8()
            self._read_first_color = True
        return super().read_color(reader)

    def read_single_item_slot(self, reader):
        item = super().read_single_item_slot(reader)
        # The first 30 single-item slots are initial armor/vanity/dyes.
        # No favorites in the 10 misc equipment/dye slots that follow.
        if self.version >= 322 and self._initial_equipment_slots < 30:
            reader.boolean()
            self._initial_equipment_slots += 1
        return item

    def read_item_slot(self, reader):
        item = super().read_item_slot(reader)
        # Only the extra equipment loadouts have a new favorite byte.
        # Containers/banks/temporary slots retain their old layout.
        if self.version >= 322 and self._reading_loadout:
            reader.boolean()
        return item

    def read_loadout(self, reader):
        self._reading_loadout = True
        try:
            return super().read_loadout(reader)
        finally:
            self._reading_loadout = False
