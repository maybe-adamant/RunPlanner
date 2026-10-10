# Keepsakes, loadout, and abilities

This file inventories all planner-modeled run-start and equip-time abilities.
The execution boundary now has an explicit disposition for all 33 selectable
keepsakes: it checks identity and retained planner-visible state, steers only
exact authored volatile results, and otherwise hands deterministic or
simulation-neutral behavior back to the game. The starting loadout is
installed for the run rather than checked.

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
  `src/mods/loadout/` in the Run Planner game module

## Keepsake native lifecycle

`Scripts/KeepsakeLogic.lua:EquipKeepsake` is the common equip contact. Effects
that grant a random trait have additional native contacts in
`Scripts/PowersLogic.lua`: `AddRandomHammer`, `AddRandomChaosBlessing`, and
`GiveRandomHadesBoonAndBoostBoons`. The same equip adapter covers starting
equipment during `StartNewRun` and a later rack change. Echo Gift Gift Gift is
not a separate effect implementation; it replays the declared keepsake effect
at the effect's own native contact.

## Planner modeling is not an execution instruction

The planner models a keepsake effect whenever that effect changes later
eligibility, chronology, or derived state. That does not imply that the
executor should reproduce the effect. The execution boundary has three distinct
responses:

1. **Native pass-through.** Deterministic game behavior runs unchanged. The
   planner models its consequence so later simulation remains correct.
2. **Generic downstream realization.** The keepsake changes a later door,
   trait offer, Path acquisition, fountain use, or pickup. The normal owner of
   that later object realizes the already-resolved result; there is no
   keepsake-specific actuator.
3. **Bounded volatile steering.** Native code asks for a random decision whose
   exact outcome was authored. Only that selector is constrained, while the
   native acquire/equip/encounter function retains mutation and presentation.

Room-exit conformance observes planner-visible retained state and charges. It
is not a reason to trace or reimplement every native callback. Likewise, an
effect that is simulation-neutral must not become a mismatch merely because
the game still applies its health, damage, armor, gold, or real-time behavior.

## Common identity contract

All 33 selectable keepsakes share one identity boundary regardless of effect:

- the starting loadout declares one exact keepsake, which the module installs
  at its planned rank for the run;
- an authored postboss change binds the exact `EquipKeepsake` call to one
  `keepsakeChange` transaction;
- opening and closing a rack without changing keepsake creates no transaction;
  and
- once the identity is accepted, native `EquipKeepsake` remains responsible for
  installing the declaration and running its equip behavior.

Only Experimental Hammer, Jeweled Pom, and Transcendent Embryo add an authored
immediate random result beneath that common equip contact. Other keepsakes do
not need an empty effect transaction merely to prove that they were equipped.

## Complete keepsake execution inventory

| Family                       | Keepsakes                                                                                                                                                                              | Planner-owned meaning                                                                                                                                                                                                          | Executor boundary                                                                                                                                                                                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Simulation-neutral identity  | Silver Wheel, Knuckle Bones, Luckier Tooth, Ghost Onion, Evil Eye, Gold Purse, Engraved Pin, Discordant Bell, Metallic Droplet, White Antler, Silken Sash, Lion Fang, Blackened Fleece | Selection history, active interval, removal/blocking, and rank-III identity. Their effects alter no planner legality; Discordant Bell, Lion Fang, Silver Wheel and White Antler values are tracked only for Run State display. | Common identity contact only. Native effects pass through and are excluded from conformance.                                                                                                                                                                               |
| Olympian reward pressure     | Cloud Bangle, Iridescent Fan, Vivid Sea, Barley Sheaf, Harmonic Photon, Beautiful Mirror, Adamant Shard, Everlasting Ember, Sword Hilt                                                 | Provider pressure, one reward-force use, one provider rarification use, and retained source state. Later doors and offers are already resolved with the correct provider and rarity.                                           | Native equip owns pressure and charge consumption. Navigation realizes the resolved door; the ordinary trait adapter realizes the resolved offer. No god-keepsake actuator exists. Retained charge/source state is checked at room exit.                                   |
| Path reward pressure         | Moon Beam                                                                                                                                                                              | Talent-drop pressure and the exact added Path points on the next Talent acquisition.                                                                                                                                           | Native equip owns pressure and point addition. Navigation and the generic Path acquisition contact consume the resolved fixed-route products. There is no Moon Beam actuator; complete live proof remains pending.                                                         |
| Conditional encounter        | Gorgon Amulet                                                                                                                                                                          | Pending/consumed keepsake state, the qualifying Athena encounter, and its exact offer when the modeled Death Defiance condition is met.                                                                                        | Native eligibility, spawn, and use consumption remain authoritative. `AthenaUse` only binds the physical interaction to the published encounter; the ordinary trait adapter realizes the offer. No trigger steering or Athena spawning is reimplemented.                   |
| Encounter skip               | Fig Leaf                                                                                                                                                                               | One exact phase-local skip/no-skip result plus retained uses and the biome activation latch.                                                                                                                                   | The executor steers only the bounded Fig Leaf `RandomChance`; native encounter code owns skipped spawning, use consumption, propagation, and presentation. Room-exit keepsake conformance proves the retained state.                                                       |
| Fountain rarity              | Aromatic Phial                                                                                                                                                                         | Pending/consumed use and the exact eligible trait upgraded at the next fountain.                                                                                                                                               | `fountainUse.aromaticPhialTarget` scopes the native rarity selector to the exact target. Native fountain use and rarity mutation remain authoritative.                                                                                                                     |
| Residual boon choice         | Concave Stone                                                                                                                                                                          | Exact proc/no-proc and, on proc, the frozen residual option selected from the original god offer.                                                                                                                              | The ordinary trait adapter scopes the Stone roll and recursive residual selection inside the outer acquisition. Native code equips the second trait and consumes the use; no second physical acquisition or Stone-owned transaction is invented.                           |
| Boss Arcana grant            | Crystal Figurine                                                                                                                                                                       | Pending/consumed use and the exact ordered Arcana set activated after the boss.                                                                                                                                                | `automatic:crystalFigurine` constrains `AddRandomMetaUpgrades`; native code activates the cards and consumes the use. Arcana conformance observes the result.                                                                                                              |
| Temporary Hammer             | Experimental Hammer                                                                                                                                                                    | Exact compatible Hammer granted on equip, its remaining encounter duration, and eventual removal.                                                                                                                              | The equip scope constrains `AddRandomHammer`; native code equips and expires the Hammer. The ordinary trait ledger observes the resulting add/remove state.                                                                                                                |
| Hades boon and future levels | Jeweled Pom                                                                                                                                                                            | Exact Hades trait granted on equip, retained level-provider state, and its contribution to later effective trait levels.                                                                                                       | The equip scope constrains `GiveRandomHadesBoonAndBoostBoons`. Later offers already publish final effective levels and are realized by the ordinary trait adapter; no Jeweled Pom level loop exists in the executor.                                                       |
| Offer rarification           | Calling Card                                                                                                                                                                           | Exact row-local base/effective rarity decisions and retained charges.                                                                                                                                                          | Native offer interaction owns the player's rarification click and charge consumption. The ordinary trait adapter installs the final authored rows; trait and keepsake conformance observe the selected result and remaining charge. No rarify-button cursor is maintained. |
| Reward destruction           | Time Piece                                                                                                                                                                             | Exact acquisition suppressed by conversion and retained charges; gold amount is simulation-neutral.                                                                                                                            | Publication omits the destroyed acquisition and does not publish a Time Piece transaction. Native interaction owns the conversion; room-exit Time Piece charges are the blocking modeled conformance fact.                                                                 |
| Chaos blessing lifecycle     | Transcendent Embryo                                                                                                                                                                    | Exact blessing, rarity, magnitude values, eight-encounter replacement result, and removal of the prior blessing.                                                                                                               | The equip scope and `automatic:transcendentEmbryo` each constrain `AddRandomChaosBlessing` and processed values. Native code owns the clock, replacement, trait mutation, and presentation.                                                                                |

The exact keys, rank-III values, and Echo availability are owned by
[Keepsakes](../loadout-and-progression/KEEPSAKE_GAME_DATA_AUDIT.md),
[Cherished Heirloom](../loadout-and-progression/CHERISHED_HEIRLOOM_KEEPSAKE_AUDIT.md),
and [Echo Gift Gift Gift](../loadout-and-progression/ECHO_GIFT_GIFT_GIFT_KEEPSAKE_AUDIT.md).

## Cross-keepsake modifiers

Cherished Heirloom is a native deterministic reconstruction of the current
keepsake at an increased effective rank. The planner models the changed
charges, values, or future result so chronology stays correct; the executor
does not reconstruct the keepsake itself. Any later volatile result still uses
the ordinary contact named above—for example, a later Embryo transformation or
Fig Leaf decision.

Gift Gift Gift records the captured keepsake and lets Echo install its native
replay. It is not a second keepsake implementation. A replayed effect should
reach the same downstream owner as its ordinary counterpart: reward pressure
remains navigation/offer work and later generated objects remain independently
owned acquisitions. Only a reached later-biome Experimental Hammer or
Transcendent Embryo replay publishes a dedicated biome-start transaction,
carrying the exact result already resolved by the planner. The executor binds
the native replay separately from a rack change and reuses the ordinary
Hammer/Embryo selector. Passive replays publish no empty transaction.

## Closed execution disposition

The keepsake boundary is closed without a general effect interpreter:

- Aromatic Phial constrains only its native target choice.
- The native retained-state reader covers every planner-visible
  `PendingKeepsakeEffects` field, including active temporary Hammer and Embryo
  traits; unrelated health, damage, Gold, and real-time effects stay outside
  conformance.
- Gift Gift Gift publishes only a reached volatile Hammer or Embryo replay.
  Its transaction remains pending across `EquipKeepsake` and completes at the
  result-producing native terminal. Native acquired callbacks begin immediately
  on `thread` dispatch; presentation after an actual yield must not extend an
  unrelated RNG scope.

Immediate Hammer, Jeweled Pom and Embryo outcomes retain the equip owner's
published result only for their named callback. The native callback lacks a
complete target input: candidate selection stays scoped to that callback,
while native code owns expiry tags, dictionaries, addition and removal.
Embryo also inserts the published magnitude through processed-trait data.
Automatic Embryo resolves its due owner directly; it needs no executor clock.

Phial is different: native `UseHealthFountain` reaches a later rarity callback.
The room- or Hub-bound target survives until that contact supplies native
`ForceUpgrade`; fountain healing, consumption and rarity application remain
native. A fountain-use-return-only scope would lose this target.

Moon Beam is not a separate keepsake actuator: the fixed-route product reaches
Talent rewards through the existing generic navigation and Path contacts.

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

The identifying native sequence is `IsTraitActive` for
`PersistentDionysusSkipKeepsake`, then `GetTotalHeroTraitValue("LuckMultiplier",
{ IsMultiplier = true })`, then `RandomChance`. The executor retains only this
one-shot contact within the current spawning coroutine. Native readiness and
luck calculation remain unchanged; the roll is not armed by merely entering a
spawn handler. This matters when pre-spawning has cleared `CanEncounterSkip`:
the later Vow enemy-substitution roll must remain native. Native validation is
evaluated before this sequence but its result is the final `and` operand after
the roll; a false validation result must not change which RNG call is identified.

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

## Run-scoped loadout install

The module installs the plan's starting loadout for one run
([Loadout install](../../design/GAME_INTEGRATION_BOUNDARY.md#loadout-install)).
These are the native facts that shape it.

**Chaos Trial precedent.** A Chaos Trial backs up `PrimaryWeaponName`,
`LastWeaponUpgradeName`, `LastAwardTrait`, `EquippedFamiliar`,
`ShrineUpgrades`, `ActiveShrineBounty` and `MetaUpgradeState`
(`StoredGameStateInit`, `BountyLogic.lua:513-521`), writes the trial's loadout
into GameState before the run starts (`BountyLogic.lua:524-731`) and holds it
for the whole run. `StoredGameState` is save-whitelisted (`SaveLogic.lua:4`).
The hub load restores it and re-extracts the Vows and point caches
(`RestorePackagedBountyGameState`, `BountyLogic.lua:734-753`, called from
`HubPostBountyLoad`, `DeathLoopLogic.lua:398-405`).

**The override lasts the whole run.** Fear, Aspect identity, Arcana
`Equipped`, the keepsake and the familiar are read from GameState throughout
the run, not only at its start: about 60 files read Vow values, and Barren's
expiry re-equip, Circe, keepsake rack swaps and `AdvanceKeepsake` read the
loadout mid-run. Restoring inside `StartNewRun` would change them.

**Install and restore contacts.**

- `StartNewRun` replaces `CurrentRun` (`RunLogic.lua:445`) and extracts every
  Vow from the profile (`RunLogic.lua:453-455`); `CreateNewHero` reads the
  EnemyDamage Vow (`RunLogic.lua:25-29`). The install therefore precedes base
  `CreateNewHero` and re-extracts the Vows.
- The run-start keepsake equip reads `LastAwardTrait` and the familiar equip
  reads `EquippedFamiliar` (`RunLogic.lua:481-482`).
- `EquipPlayerWeapon` writes `WeaponsUnlocked` (`CombatLogic.lua:4719-4722`),
  so the hero's weapon table is changed directly.
- `RecordRunCleared` calls `RecordRunStats` and then credits the cleared
  loadout from GameState and the hero (`ClearedWith*`,
  `RunLogic.lua:2037-2081`). `KillHero` skips `RecordRunStats` for a cleared
  run (`DeathLoopLogic.lua:65-67`) and saves at `DeathLoopLogic.lua:238`.
- A clear happens in the boss room, but the run continues through linked
  rooms (for example `I_Boss01` to `I_PostBoss01`, `I_ChronosFlashback01` and
  `I_DeathAreaRestored`, `RoomDataI.lua:1260`, `3472`, `3887`). Each room's
  hero setup re-equips from `CurrentRun.Hero.Weapons`
  (`GatherAndEquipWeapons`, `UpgradeLogic.lua:801`), so the planned loadout
  must hold until `KillHero`.

**Unlock-all-cards quest.** `QuestUnlockAllCards` completes when
`GameState.MetaUpgradeUnlockedCountCache` reaches 14 (`QuestData.lua:5172-5184`).
Only the Arcana screens recompute that cache
(`UpdateMetaUpgradeUnlockedCountCache`, `MetaUpgradeCardScreenLogic.lua:784-796`;
`MetaUpgradeCardUpgradeScreenLogic.lua:104`), so card `Unlocked` is set only
for the duration of each `AddRandomMetaUpgrades` call.

**Native rank formulas.** Each rank is derived from profile progression, so
the install overrides the getter instead of writing progression:

| Getter                   | Native source                                                                                                               |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `GetWeaponUpgradeLevel`  | Counts purchased `WeaponsUnlocked` upgrades for the Aspect (`WeaponUpgradeLogic.lua:478`).                                  |
| `GetMetaUpgradeLevel`    | The card's saved `Level` (`MetaUpgradeLogic.lua:51`); the maximum is `#UpgradeResourceCost + 1` (`:21`).                    |
| `GetKeepsakeLevel`       | Cumulative `ChamberThresholds` against `KeepsakeChambers`, plus `KeepsakeLevelBonus` (`KeepsakeLogic.lua:1-40`).            |
| `GetFamiliarTraitStacks` | One plus each purchased `FamiliarUpgrades` entry for the trait (`FamiliarShopLogic.lua:445`, `FamiliarShopData.lua:11-41`). |

## Weapons and aspects

The catalog contains six weapons and 24 aspects:

- Witch's Staff: Melinoë, Circe, Momus, Anubis
- Sister Blades: Melinoë, Pan, Artemis, Morrigan
- Moonstone Axe: Melinoë, Charon, Thanatos, Nergal
- Umbral Flames: Melinoë, Eos, Moros, Supay
- Argent Skull: Melinoë, Medea, Persephone, Hel
- Black Coat: Melinoë, Nyx, Selene, Shiva

Weapon and aspect are part of the installed starting loadout: the module gives
the hero the planned weapon and records the planned aspect at its planned rank
for the run, and never unlocks either
([Loadout install](../../design/GAME_INTEGRATION_BOUNDARY.md#loadout-install)).

Two aspect consequences are already modeled by the planner:

- Aspect of Persephone rolls native values `0, 2..6`, or `0, 2..9` with Premium
  Service. The planner composes these with Jeweled Pom following the
  [offered-level audit](../traits/PERSEPHONE_PREMIUM_EFFECTIVE_LEVEL_AUDIT.md).
  The executor consumes the final `effectiveLevel`; it must not recompute the
  aspect rule.
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
| Starting active board and rarity                      | Installed for the run with the starting loadout; the card ranks are overridden for the run and never written to the profile save. |
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

The configured ranks are installed for the run with the starting loadout and
the profile's Vows return after it. Downstream planner results remain usable:

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
selected layout, the talent on every non-Olympian node, modeled God Sent availability,
banked points, invested points, and closed-tree state. Eligible God Sent adds
two nodes to the planner's accounting for Path availability; this simulation
fact does not authorize executor steering of those nodes.

Spell/Hex selection and Path acquisition are covered by focused contacts;
Moon Beam remains native-authoritative. The fixed-route product reaches those
pickups, while complete live native probes remain pending. The product does not
model individual Hex combat effects or player-selected node positions. The two
bounded contacts are:

1. realize Spell offers, the selected Hex's layout and its node talents, written
   over the native tree after `CreateTalentTree` returns;
2. retain native Path spending and node selection, with published state checked
   through the existing conformance boundary.

God Sent eligibility, talent selection, initial insertion and later updates
remain entirely native. The Hex adapter neither suppresses
`ServeDuoGameRequirements` nor selects a published God Sent talent. It does not
diagnose an unconsumed God Sent selector because it owns no such selector.

Individual Hex combat effects remain outside the run-planning simulation.

The published layout and special-node identities are not a complete native
tree: ordinary nodes, connections and native talent application are not an
exported object graph. Bounded native construction selectors therefore remain
the smaller adapter; assembling a tree from scratch would recreate missing
game machinery.

`SpellScreenLogic.lua:AcceptAndCloseSpellScreen` yields during presentation
before `CreateTalentTree`, then waits again after construction. The owner
supplies the native construction's spell-trait identity alongside the published
partial tree; starting Selene supplies its starting spell identity. Only the
matching `CreateTalentTree` consumes that context. Random construction scope
ends with that non-yielding native function, not the surrounding presentation.
This does not compare or automate the player's Spell selection. Path's accepted
item and aspect-routed item instead retain their bindings through the direct
`OpenTalentScreen` call and release them on return; its screen waits do not
require an additional producer chain.

## Gathering tools

Pickaxe, Exorcism Book, Shovel, and Fishing Rod reach the modeled element roll
through `GrantElementFromTool`. The route execution product publishes one
physical-point disposition for every entered occurrence and family: `native`
preserves the point while forcing that roll to fail, `suppress` prevents the
point, and `force` preserves the point while forcing success. Exact five-element
counts are a separate ordinary room-exit conformance fact. A contribution made
while leaving one occurrence is consequently observed at the next authored
occurrence's exit. Which tool is equipped is not independently modeled as a
loadout requirement; automatic gathering is the planner simplification.
