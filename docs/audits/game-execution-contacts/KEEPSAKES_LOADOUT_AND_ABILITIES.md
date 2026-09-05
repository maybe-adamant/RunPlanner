# Keepsakes, loadout, and abilities

This file inventories all planner-modeled run-start and equip-time abilities.
The current execution plan checks starting weapon, aspect, Arcana, Fear, and
keepsake, realizes the named start/equip results, and handles later rack
changes. It never repairs the player's selected loadout.

## Source index

- Catalog loadout declarations: `packages/hades2-catalog/src/declarations/keepsakes.ts`,
  `packages/hades2-catalog/src/declarations/arcana-fear.ts`, and
  `packages/hades2-catalog/src/declarations/traits/index.ts`
- Keepsake equip and rack: `Scripts/KeepsakeLogic.lua:106-180` and
  `Scripts/KeepsakeLogic.lua:546-1210`
- Random keepsake results: `Scripts/PowersLogic.lua:4840-4910`
- Fig Leaf decisions: `Scripts/EncounterLogic.lua` functions
  `HandleEncounterPreSpawns`, `CanDionysusSkip`, and `HandleEnemySpawns`
- Gorgon dispatch and interaction: `Scripts/RoomLogic.lua` functions
  `StartEncounter` and `StartEncounterEffects`, plus
  `Scripts/EncounterLogic.lua` functions `HandleAthenaSpawn` and `AthenaUse`
- Run start: `Scripts/RunLogic.lua:439-620`
- Current start/equip adapter: the focused adapters beneath
  `src/mods/loadout/` in the Plan Executor

## Keepsake native lifecycle

`Scripts/KeepsakeLogic.lua:EquipKeepsake` is the common equip contact. Effects
that grant a random trait have additional native contacts in
`Scripts/PowersLogic.lua`: `AddRandomHammer`, `AddRandomChaosBlessing`, and
`GiveRandomHadesBoonAndBoostBoons`. The same equip adapter covers starting
equipment during `StartNewRun` and a later rack change. Echo Gift Gift Gift is
not a separate effect implementation; it replays the declared keepsake effect
at the effect's own native contact.

## Complete keepsake inventory

| Family              | Keepsakes                                                                                                                                                                              | Execution disposition                                                                                                                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Simulation-neutral  | Silver Wheel, Knuckle Bones, Luckier Tooth, Ghost Onion, Evil Eye, Gold Purse, Engraved Pin, Discordant Bell, Metallic Droplet, White Antler, Silken Sash, Lion Fang, Blackened Fleece | Native pass-through after exact equip identity. Combat, health, gold, and damage effects are outside the current simulation.                                                                                      |
| Olympian pressure   | Cloud Bangle, Iridescent Fan, Vivid Sea, Barley Sheaf, Harmonic Photon, Beautiful Mirror, Adamant Shard, Everlasting Ember, Sword Hilt                                                 | Native-authoritative pass-through: native equip owns pressure and charges; each later offer carries its exact giver and base rarity, and room-exit conformance owns the charge ledger.                            |
| Moon Beam           | Moon Beam                                                                                                                                                                              | Native-authoritative pass-through: native equip, reward priority, and point addition remain native while the Path carrier and room-exit conformance observe modeled state.                                        |
| Gorgon Amulet       | Gorgon Amulet                                                                                                                                                                          | Covered: native eligibility, spawn, and use consumption remain authoritative; the published Athena interaction binds at `AthenaUse` and hands off to the focused trait offer.                                     |
| Fig Leaf            | Fig Leaf                                                                                                                                                                               | Covered: the planner's phase-local skip/no-skip result steers the bounded native decision while native code owns skipped-spawn lifecycle, use consumption, and biome latch.                                       |
| Aromatic Phial      | Aromatic Phial                                                                                                                                                                         | Covered by the `fountainUse` transaction and `UseHealthFountain`; only the published target matters.                                                                                                              |
| Concave Stone       | Concave Stone                                                                                                                                                                          | Covered: v17 publishes exact proc/no-proc and the frozen residual inside the outer acquisition; the focused adapter scopes the native roll and recursive selected row without a second transaction or dependency. |
| Crystal Figurine    | Crystal Figurine                                                                                                                                                                       | Covered by `automatic:crystalFigurine` at boss defeat and `AddRandomMetaUpgrades`.                                                                                                                                |
| Experimental Hammer | Experimental Hammer                                                                                                                                                                    | Covered at equip through the published selected Hammer and `AddRandomHammer`; later expiration remains a conformance concern.                                                                                     |
| Jeweled Pom         | Jeweled Pom                                                                                                                                                                            | Covered at equip through the published Hades trait and `GiveRandomHadesBoonAndBoostBoons`; later level contribution is already folded into effective levels.                                                      |
| Calling Card        | Calling Card                                                                                                                                                                           | Native-authoritative pass-through: the offer carries its exact base rarity, native rarification consumes charges, and room-exit keepsake conformance owns the retained ledger.                                    |
| Time Piece          | Time Piece                                                                                                                                                                             | Authored conversion remains planner-simulated, but its acquisition is omitted from execution publication; aggregate intended acquisitions and retained-charge conformance prove the room outcome.                 |
| Transcendent Embryo | Transcendent Embryo                                                                                                                                                                    | Covered both at equip and at its eight-encounter automatic replacement through `AddRandomChaosBlessing`.                                                                                                          |

The exact keys, rank-III values, and Echo availability are owned by
[Keepsakes](../loadout-and-progression/KEEPSAKE_GAME_DATA_AUDIT.md),
[Cherished Heirloom](../loadout-and-progression/CHERISHED_HEIRLOOM_KEEPSAKE_AUDIT.md),
and [Echo Gift Gift Gift](../loadout-and-progression/ECHO_GIFT_GIFT_GIFT_KEEPSAKE_AUDIT.md).

## Encounter-altering keepsake contacts

The broad keepsake audit owns the eligibility matrices and planner rules. The
additional execution question is where the native game decides and completes
each published phase-local result.

### Fig Leaf

The native skip decision has two paths in `Scripts/EncounterLogic.lua`:

- `HandleEncounterPreSpawns` rolls before pre-spawned enemies are assembled.
  A failed roll clears `encounter.CanEncounterSkip` so the later path does not
  roll again.
- `HandleEnemySpawns` rolls for encounters that reach ordinary spawning. It
  also receives a skip already selected by the pre-spawn path.

Both paths call the trait-owned validation function, `CanDionysusSkip`, before
a positive result. That function rejects biome-start rooms, encounters that
block the keepsake, and a second activation in the same biome. Native code then
owns `SpawnsSkipped`, multi-encounter propagation, the presentation, use
consumption, and `ActivatedThisBiome`.

The stable positive terminal is the skipped branch of `HandleEnemySpawns`,
after the use and latch are applied. Steering only a generic `RandomChance`
call would be too broad, while steering only the pre-spawn path would miss
ordinary encounters. The execution contact must be scoped to this exact
keepsake decision across both paths and leave the surrounding native lifecycle
intact.

### Gorgon Amulet

The keepsake's `UniqueEncounterArgs` eligibility and dispatch occur on two
native start paths:

- `StartEncounterEffects` handles the ordinary encounter-start path.
- `StartEncounter` handles declarations marked
  `CheckAthenaEncounterKeepsakeOnSkipEncounterStart` when ordinary start
  effects are skipped.

Both paths evaluate the same trait-owned requirements and, on success, thread
`HandleAthenaSpawn`. This is deterministic keepsake behavior once the native
Death Defiance and encounter conditions are met. Execution must not steer the
eligibility check, schedule `HandleAthenaSpawn` itself, or suppress its native
dispatch. Native `HandleAthenaSpawn` remains responsible for waiting on the
encounter, refusing a skipped or blocked encounter, consuming the use only on
a successful spawn, and invoking the Athena presentation.

The spawned Athena uses `AthenaUse` and then the ordinary `UseLoot` carrier.
The physical Athena can therefore bind to the published Gorgon interaction at
`AthenaUse`; its trait menu then hands off to the ordinary trait-offer adapter.
The executor does not need a separate provenance relation from the spawn
presentation to the trait screen.

### Execution disposition

The planner publishes an exact Fig Leaf skip/no-skip result only at a
structurally relevant phase. Absence is not inferred by the executor. A
negative result suppresses only the Fig Leaf roll so native RNG cannot
contradict the authored outcome. A positive result steers that roll and lets
native game code execute its deterministic consequences.

Gorgon adds no comparable trigger/defer steering result. When its modeled
Death Defiance condition is met, the planner already publishes the required
Gorgon interaction and Athena offer. Execution observes the native Athena,
binds `AthenaUse` to that transaction, and forces only the offer. If native
eligibility disagrees with the modeled condition, the missing or unexpected
interaction and room-exit `keepsakeEffects` conformance expose the mismatch;
the executor does not correct it by reimplementing the keepsake.

Fig Leaf has no player interaction and does not become a generic effect
transaction. Room-exit `keepsakeEffects` conformance proves its retained use
and latch state. If Fig Leaf skips the phase, native `HandleAthenaSpawn` returns
before consuming Gorgon, which preserves the planner's documented ordering.

## Weapons and aspects

The catalog contains six weapons and 24 aspects:

- Witch's Staff: Melinoë, Circe, Momus, Anubis
- Sister Blades: Melinoë, Pan, Artemis, Morrigan
- Moonstone Axe: Melinoë, Charon, Thanatos, Nergal
- Umbral Flames: Melinoë, Eos, Moros, Supay
- Argent Skull: Melinoë, Medea, Persephone, Hel
- Black Coat: Melinoë, Nyx, Selene, Shiva

Weapon and aspect are covered by the explicit checked starting-loadout product.
The executor observes the player's equipped identities at run start and never
equips, unlocks, or repairs them.

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

| Arcana concern                                        | Execution disposition                                                                                                             |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Starting active board and rarity                      | Covered by the checked starting-loadout product; the executor compares the native active board and rarities without rewriting it. |
| Rarity contributions from Excellence, Queen, Divinity | Covered indirectly because each trait offer publishes its final rarity table outcome.                                             |
| Artificer capacity and conversions                    | Conversion disposition, producer relation, and uses are published; the executor must not recalculate Arcana capacity.             |
| Judgment                                              | Covered by `automatic:judgment` and `AddRandomMetaUpgrades`.                                                                      |
| Crystal Figurine temporary cards                      | Covered by its separate automatic transaction.                                                                                    |
| Proper Upbringing element threshold                   | The selected trait offer already carries the final rarity floor; element collection remains a room-feature contact.               |

## Fear Vows

All 17 Vows are cataloged. Vow of Forfeit, Vow of Denial, Vow of Void, and Vow
of Rivals change modeled reward, offer, loadout, or boss identity. The other 13
are currently simulation-neutral combat/economy modifiers, including Hordes,
Return, Menace, and Fangs.

Configured and effective ranks are covered by the checked starting-loadout
product. The executor compares them and never rewrites Vows. Downstream
planner results remain usable:

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

Spell/Hex selection and Path acquisition are covered by focused v17 contacts;
Moon Beam remains native-authoritative. Their ordinary route activation and
live native probes remain deferred because F/G cannot reach those pickups. The
product does not model individual Hex combat effects or player-selected node
positions. The two bounded contacts are:

1. force the selected Spell at the Spell offer;
2. force/observe the published node investment when Path points are spent.

Individual Hex combat effects remain outside the run-planning simulation.

## Gathering tools

Pickaxe, Exorcism Book, Shovel, and Fishing Rod reach the modeled element roll
through `GrantElementFromTool`. The Overview publishes the successful resource
and its exact element contribution. Which tool is equipped is not independently
modeled as a loadout requirement; automatic gathering is the planner
simplification.
