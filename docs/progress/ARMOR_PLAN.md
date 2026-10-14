# Armor Plan

Status: locked. Base commit: `feb3b6bbe`.

## Objective

Model the hero's lasting armor under a no-damage assumption:

- Practice starts install armor bought or picked up as items, and Silken Sash
  armor.
- The planner's Run State shows an Armor figure beside max health and Magick.

## Source facts

- **Representation.** Every lasting armor source is a `CostumeTrait` holding
  its own `CurrentArmor`. `CostumeArmor` sets it to `BaseAmount` only when it
  is nil (`CostumeLogic.lua:201-227`). `SetupHeroObject` re-runs trait setups
  each room (`RoomLogic.lua:1724`).
- **Armor items.**
  - `ArmorBoost` (20), `ArmorBigBoost` (40) and the Well's `ArmorBoostStore`
    (20) (`ConsumableData.lua:898-968`) call `AddArmor`. It creates or adds to
    one hidden `MinorArmorBoon` (`RoomLogic.lua:2772-2793`,
    `TraitData_Essence.lua:4-27`).
  - They reach the hero through room and Fields rewards, World Shops, Hermes
    Shrines, the Well and Nemesis's free item. The Well purchase also enters
    `ConsumableRecord` (`StoreLogic.lua:1228-1232`, `InteractLogic.lua:1018`).
- **Silken Sash** (`ArmorGainKeepsake`, `TraitData_Keepsake.lua:1204-1257`).
  - It is fresh at 30 on every equip, a plain number that does not scale with
    rank.
  - `DoorArmor` is 2 × the rank multiplier: Common 2, Rare 3, Epic 4, Heroic 6.
  - The gain is added on `LeaveRoom` into a first-visit room
    (`RoomLogic.lua:4229-4238`, `CostumeLogic.lua:18-33`). No room sets
    `BlockDoorHealFromPrevious`.
  - Returns to an existing room do not gain: the N Hub and sub-room returns
    (`RoomLogic.lua:839, 856`).
  - The run's first room is loaded without `LeaveRoom`
    (`DeathLoopLogic.lua:579`). `StartNewRun` re-equips the keepsake on a fresh
    hero, so the run starts at 30 (`RunLogic.lua:481`).
  - Unequipping moves the remaining armor into `MinorArmorBoon`
    (`KeepsakeLogic.lua:173-182`).
  - A Cherished Heirloom advance runs that transfer and then restores
    `CurrentArmor` on the re-equipped Sash, duplicating the armor
    (`KeepsakeLogic.lua:276-306`). Later gains use Heroic.
  - The Echo copy from Gift Gift Gift is Common.
- **Trait armor** (Run State only; these traits install themselves at full):
  - Trusty Shield: 10/15/20/25 by rarity, then +5, +3, +2, +2 and +2 for each
    later Pom level, unscaled.
  - Heavy Metal: 50/75/100/125, and it cannot be Pommed.
  - Arachne dresses: Lavender 30, Fuchsia 20, Azure 40, Emerald 50, Onyx 60,
    Gilded 10, Moonlight 55, Crimson 5. Onyx scales natively to 80/100/140 at
    higher rarities (`TraitData_Arachne.lua:259-306`).
  - Icarus coatings: Volatile 50, Protective 100. Protective is 140 at Heroic
    (`TraitData_Icarus.lua:423-428`).
  - Dream dives can offer these at higher rarity. Their armor is declared by
    rarity where native scales it, through the existing Dream rarity
    infrastructure. Gate 3 confirms each rarity value against the source.
  - Security System, Selene Hex armor and the Axe armor-damage trait are
    excluded.

## Decisions (owner-confirmed)

- **No damage.** Armor is never consumed, so the Sash always gains in eligible
  rooms. Practice already refills health and starts trait armor full.
- **Heirloom duplication** is modelled faithfully.
- **The Well armor** also counts in the consumable record, as the game does.
- **Time Piece.** Items it converts to gold give no armor. The credit sits
  beside `creditMaxStatGain`, after the conversion branch
  (`role-settlement.ts:341-361`).
- **No authored schema change.**

## Ownership

- **Catalog:** armor amounts on item acquisitions, the Sash effect (base
  armor, door gain by rank) and trait armor declarations including the Trusty
  Shield Pom table. Onyx and Protective Coating armor is declared by rarity
  for Dream offers.
- **Engine:**
  - an item-armor total folded where max-stat gains are credited;
  - Sash state on keepsake state, following the Lion Fang origin, Heirloom and
    Echo patterns. It is created through `createKeepsakeState`, rack
    replacement and the Echo replay;
  - the door gain on `roomEntered`, excluding the route's first room and
    `roomRestored`;
  - the unequip and Heirloom transfers into the item-armor total;
  - an armor derivation beside `deriveMaxStats`.
- **Protocol:** an item-armor total on the start state and `currentArmor` on
  the Sash keepsake row.
  - The Sash value includes the gain for entering the start room, because
    Practice enters it without `LeaveRoom`.
- **Game module:**
  - install one processed `MinorArmorBoon` with `BaseAmount` set to the total,
    skipped at 0;
  - write `CurrentArmor` in `keepsakeCounters`.
- **Planner app:** one Armor row in Run State with its sources, mirroring
  `maxStatsPresentation`.

## Gates

1. **Items.** Catalog amounts, the Well consumable change, the engine fold,
   the protocol field, the module install, regenerated Practice fixtures and
   the equivalence rewrite.
2. **Silken Sash.** Catalog effect, engine state (route start, rack, Echo,
   Heirloom, door gain, transfers), the protocol row field, the module write,
   fixtures and equivalence.
3. **Run State Armor.** Trait armor declarations, engine derivation and app
   row.
4. **Closure.** Docs and live checklist by the gate 3 executor, then plan
   retirement.
   - Docs: `GAME_INTEGRATION_BOUNDARY.md` §Practice mode start, the reward and
     keepsake audits that call armor or the Sash unmodelled
     (`ROOM_FEATURES_GAME_DATA_AUDIT.md`, `REWARDS_AND_ITEMS.md`,
     `KEEPSAKE_GAME_DATA_AUDIT.md`, `ECHO_GIFT_GIFT_GIFT_KEEPSAKE_AUDIT.md`,
     `CHERISHED_HEIRLOOM_KEEPSAKE_AUDIT.md`), and the Run State design doc.

## Tests

- **Engine:**
  - item totals across reward, Shop, Shrine, Well and Nemesis, with Time Piece
    conversion excluded;
  - Sash gains per first visit, no gain on revisits or the first room;
  - rank by origin;
  - rack swap and Echo transfers;
  - Heirloom duplication;
  - the Practice value including the start-room entry;
  - the armor derivation.
- **Module:** decoder strictness for the new fields; the install of
  `MinorArmorBoon` and the Sash `CurrentArmor`.
- **Live:** a Practice start after buying armor; a Sash held across several
  rooms; a Sash swapped at a rack; Gift Gift Gift; a Heirloom advance; the Run
  State Armor figure.

## Non-goals

- Simulating damage or armor loss.
- Temporary or combat-only armor.
- Door-heal keepsakes.
- Natural keepsake rank-ups.
