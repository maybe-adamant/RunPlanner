# Keepsakes, loadout, and abilities

This file inventories all planner-modeled run-start and equip-time abilities.
The current execution plan realizes a starting keepsake and later rack changes;
other loadout fields presently appear only in diagnostic state.

## Source index

- Catalog loadout declarations: `packages/hades2-catalog/src/declarations/keepsakes.ts`,
  `packages/hades2-catalog/src/declarations/arcana-fear.ts`, and
  `packages/hades2-catalog/src/declarations/traits/index.ts`
- Keepsake equip and rack: `Scripts/KeepsakeLogic.lua:106-180` and
  `Scripts/KeepsakeLogic.lua:546-1210`
- Random keepsake results: `Scripts/PowersLogic.lua:4840-4910`
- Run start: `Scripts/RunLogic.lua:439-620`
- Current start/equip adapter: `src/mods/logic.lua` in the Plan Executor

## Keepsake native lifecycle

`Scripts/KeepsakeLogic.lua:EquipKeepsake` is the common equip contact. Effects
that grant a random trait have additional native contacts in
`Scripts/PowersLogic.lua`: `AddRandomHammer`, `AddRandomChaosBlessing`, and
`GiveRandomHadesBoonAndBoostBoons`. The same equip adapter covers starting
equipment during `StartNewRun` and a later rack change. Echo Gift Gift Gift is
not a separate effect implementation; it replays the declared keepsake effect
at the effect's own native contact.

## Complete keepsake inventory

| Family              | Keepsakes                                                                                                                                                                              | Execution disposition                                                                                                                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Simulation-neutral  | Silver Wheel, Knuckle Bones, Luckier Tooth, Ghost Onion, Evil Eye, Gold Purse, Engraved Pin, Discordant Bell, Metallic Droplet, White Antler, Silken Sash, Lion Fang, Blackened Fleece | Native pass-through after exact equip identity. Combat, health, gold, and damage effects are outside the current simulation.                                                                                             |
| Olympian pressure   | Cloud Bangle, Iridescent Fan, Vivid Sea, Barley Sheaf, Harmonic Photon, Beautiful Mirror, Adamant Shard, Everlasting Ember, Sword Hilt                                                 | Adapter gap for full execution: the resulting offer source/rarity is published on each later trait offer, but the executor does not yet establish or settle the native keepsake pressure itself as a first-class result. |
| Moon Beam           | Moon Beam                                                                                                                                                                              | Deferred route; later Talent drops must receive the published additional Path points.                                                                                                                                    |
| Gorgon Amulet       | Gorgon Amulet                                                                                                                                                                          | Deferred route; encounter selection carries the resolved Athena encounter rather than asking the executor to re-evaluate the keepsake.                                                                                   |
| Fig Leaf            | Fig Leaf                                                                                                                                                                               | Deferred route; skipped encounter state is planner-owned and needs a room/encounter contact.                                                                                                                             |
| Aromatic Phial      | Aromatic Phial                                                                                                                                                                         | Covered by the `fountainUse` transaction and `UseHealthFountain`; only the published target matters.                                                                                                                     |
| Concave Stone       | Concave Stone                                                                                                                                                                          | Adapter gap outside current F/G fixture coverage: the second frozen offer is a distinct trait-offer transaction and should use the ordinary trait carrier.                                                               |
| Crystal Figurine    | Crystal Figurine                                                                                                                                                                       | Covered by `automatic:crystalFigurine` at boss defeat and `AddRandomMetaUpgrades`.                                                                                                                                       |
| Experimental Hammer | Experimental Hammer                                                                                                                                                                    | Covered at equip through the published selected Hammer and `AddRandomHammer`; later expiration remains a conformance concern.                                                                                            |
| Jeweled Pom         | Jeweled Pom                                                                                                                                                                            | Covered at equip through the published Hades trait and `GiveRandomHadesBoonAndBoostBoons`; later level contribution is already folded into effective levels.                                                             |
| Calling Card        | Calling Card                                                                                                                                                                           | The selected offer already carries its rarity; retained charges are conformance data. No second rarity policy belongs in the executor.                                                                                   |
| Time Piece          | Time Piece                                                                                                                                                                             | Acquisition disposition and retained charges are published; conversion uses the acquisition producer/contact.                                                                                                            |
| Transcendent Embryo | Transcendent Embryo                                                                                                                                                                    | Covered both at equip and at its eight-encounter automatic replacement through `AddRandomChaosBlessing`.                                                                                                                 |

The exact keys, rank-III values, and Echo availability are owned by
[Keepsakes](../loadout-and-progression/KEEPSAKE_GAME_DATA_AUDIT.md),
[Cherished Heirloom](../loadout-and-progression/CHERISHED_HEIRLOOM_KEEPSAKE_AUDIT.md),
and [Echo Gift Gift Gift](../loadout-and-progression/ECHO_GIFT_GIFT_GIFT_KEEPSAKE_AUDIT.md).

## Weapons and aspects

The catalog contains six weapons and 24 aspects:

- Witch's Staff: Melinoë, Circe, Momus, Anubis
- Sister Blades: Melinoë, Pan, Artemis, Morrigan
- Moonstone Axe: Melinoë, Charon, Thanatos, Nergal
- Umbral Flames: Melinoë, Eos, Moros, Supay
- Argent Skull: Melinoë, Medea, Persephone, Hel
- Black Coat: Melinoë, Nyx, Selene, Shiva

Current status is **protocol gap for realization**. The execution plan does not
publish weapon or aspect as a start contract; they are not recoverable from the
starting keepsake. If the product continues to require the player to prepare
the loadout manually, that prerequisite must be explicit. If execution is
expected to force it, it needs a first-class starting-loadout product rather
than reading diagnostic state.

Two aspect consequences are already modeled by the planner:

- Aspect of Persephone contributes 0–5 offered levels, or 0–8 with Premium
  Service. The executor consumes the final `effectiveLevel`; it must not
  recompute the aspect rule.
- Aspect of Selene starts with Sky Fall and routes the first Spell reward to a
  Talent drop. The resolved room reward and spell state should be published;
  executor-side aspect policy would duplicate the planner.

## Arcana

The 25 Arcana cards are The Sorceress, The Wayward Son, The Huntress, Eternity,
The Moon, The Furies, Persistence, The Messenger, The Unseen, Night, The Swift
Runner, Death, The Centaur, Origination, The Lovers, The Enchantress, The
Boatman, The Artificer, Excellence, The Queen, The Fates, The Champions,
Strength, Divinity, and Judgment.

| Arcana concern                                        | Execution disposition                                                                                                 |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Starting active board and rarity                      | Protocol gap for realization; currently diagnostic only.                                                              |
| Rarity contributions from Excellence, Queen, Divinity | Covered indirectly because each trait offer publishes its final rarity table outcome.                                 |
| Artificer capacity and conversions                    | Conversion disposition, producer relation, and uses are published; the executor must not recalculate Arcana capacity. |
| Judgment                                              | Covered by `automatic:judgment` and `AddRandomMetaUpgrades`.                                                          |
| Crystal Figurine temporary cards                      | Covered by its separate automatic transaction.                                                                        |
| Proper Upbringing element threshold                   | The selected trait offer already carries the final rarity floor; element collection remains a room-feature contact.   |

## Fear Vows

All 17 Vows are cataloged. Vow of Forfeit, Vow of Denial, Vow of Void, and Vow
of Rivals change modeled reward, offer, loadout, or boss identity. The other 13
are currently simulation-neutral combat/economy modifiers, including Hordes,
Return, Menace, and Fangs.

Current status is **protocol gap for start realization**: configured and
effective ranks are diagnostic state, not a start contract. Downstream planner
results remain usable:

- Forfeit publishes the onion substitution and retained consumption.
- Denial publishes the rejected trait option.
- Void affects the planner's legal starting Arcana board.
- Rivals changes the persisted boss room variant before compilation.

The executor should consume those resolved facts, not reimplement Vow rules.
See [Arcana and Fear](../loadout-and-progression/ARCANA_AND_FEAR_GAME_DATA_AUDIT.md)
and [Enemy formation and Fear Vows](../rooms-and-routes/ENEMY_FORMATION_AND_FEAR_VOW_GAME_DATA_AUDIT.md).

## Hexes and Path abilities

The eight spell traits are Total Eclipse, Dark Side, Lunar Ray, Wolf Howl,
Night Bloom, Phase Shift, Twilight Curse, and Moon Water. The planner owns the
selected layout, Rare/Epic node identities, God Sent node, banked points,
invested points, and closed-tree state.

This family is deferred route in the F/G execution extent. Future execution
needs two contacts rather than per-node combat behavior:

1. force the selected Spell at the Spell offer;
2. force/observe the published node investment when Path points are spent.

Individual Hex combat effects remain outside the run-planning simulation.

## Gathering tools

Pickaxe, Exorcism Book, Shovel, and Fishing Rod reach the modeled element roll
through `GrantElementFromTool`. The Overview publishes the successful resource
and its exact element contribution. Which tool is equipped is not independently
modeled as a loadout requirement; automatic gathering is the planner
simplification.
