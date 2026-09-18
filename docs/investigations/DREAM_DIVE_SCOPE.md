# Dream Dive: source and ownership inventory

## Question and status

Assess the work required for a third route mode with four biomes selected once
at project creation. This is an investigation for discussion, not a locked
implementation plan. No production changes are authorized by this document.

User direction:

- Choose the four-biome itinerary before entering normal authoring; do not
  support itinerary reordering afterward. A different order is a new project.
- Move opening-room identity and reward controls to Loadout.
- Prefer one ordinal-based policy for the scaled NPC effects, including normal
  routes at their existing positions.
- Add Dream inventory/eligibility and special completion rooms explicitly.

Current audit boundary: investigate four prerequisite consumers together:
contextual opening rooms/rewards, acquisition-ordinal NPC effects, contextual
Postboss derivation, and route-owned chronology. Ordinary routes must consume
the same products immediately. Dream is only a mode applied to a supplied
route context here; choosing or validating its biome order, enabling New
Project, inventory/exclusion/resource changes, and special lifecycle exceptions
are later work. Native order restrictions below are evidence for that later
work, not acceptance requirements for this foundation.

The read covered native route selection/entry/completion, relevant existing
source audits, opening and completion declarations, shop/resource rules, the six
scaled NPC menus, timed-drop behavior, generated encounter overlays, and current
catalog/engine/application route ownership. Dialogue, cinematics, enemy combat
stats, cosmetic differences, and meta-progression rewards are not proposals for
new planner simulation. Source inspection is not in-game verification.

Native paths below are relative to the local source root
`/home/ayyatma/wsl-projects/modding/1GameData/`.

## 1. Route legality and the actual native spine

`Scripts/DreamRunLogic.lua:SelectNextDreamBiome` establishes:

- First biome: G, H, I, O, P, or Q. F and N are added to the pool only afterward.
- Selected biomes are removed from the pool: no repeated biome.
- A later choice cannot be the current biome's natural successor.
  `Scripts/RoomSets.lua:NextRoomSets` defines F→G, G→H, H→I, N→O, O→P, P→Q.
  This is directional, not a ban on adjacent biomes in either order.
- The first-ever forced H start and avoiding the previous Dream starting biome
  are external profile predicates, separate from route-local legality. The
  existing fully progressed baseline does not model previous-run history.
- `GameData.FullRunBiomeCount = 4` (`Scripts/NarrativeData.lua:9077`);
  `CheckDreamBiomeCompletion` ends the run after the fourth biome.

The native route is not simply four ordinary biome completions:

```text
Dream_Intro → first biome intro (opening reward)
  → boss + required Dream Points pickup → Dream_PostBoss01
  → second biome intro → boss + Dream Points → Dream_PostBoss02
  → third biome intro → boss + Dream Points → Dream_PostBoss03
  → fourth biome intro → boss + Dream Points → end
```

`Scripts/DeathLoopData.lua:7053–7070` starts `Dream_Intro` with `IsDreamRun=true`
and initializes `BiomeDepthCache=1`. `Dream_Intro` is a rewardless native
prologue, not the first playable biome and not a ninth chosen biome.
`DreamRunLogic.lua:EnterNextDreamBiome` calls `ChooseStartingRoom` with a Dream
entrance function. `CheckDreamBiomeCompletion` uses the recorded Dream Points
pickup to select the ordinal Dream Postboss or finish the run.

Agreed disposition: retain normal biome-local topology and derive completion
links from mode plus itinerary position. Do not attach Dream Postboss identity
to the preceding biome name. The matured-state planner does not author or
simulate the native prologue. Dream Points replace the ordinary boss material
drop; they do not introduce a points economy or another authoring system.
Any runtime startup adaptation belongs to later executor integration.

## 2. Opening controls and opening semantics

G/H/I/O/P/Q intro declarations use `ForcedRewardStore="RunProgress"`, opening
reward bans, and reward requirements `IsDreamRun && EnteredBiomes == 0`.
See `Scripts/RoomData{G,H,I,O,P,Q}.lua` intro declarations, particularly
`RoomDataH.lua:505–543`, `RoomDataP.lua:448–472`, and
`RoomDataI.lua:460–478`. The count is zero at reward construction, before
`RoomLogic.lua:1280–1283` records entry into the first biome.

Later Dream transitions explicitly skip reward selection
(`DreamRunLogic.lua:AttemptUseDreamRunExit`). A later F/N opening must not receive
the normal route-start reward just because that map normally starts a route.
P first additionally forces `PIntroDreamRunEmpty`
(`EncounterData_Opening.lua:964–980`); later P retains its normal intro encounter
selection. F/N use `OpeningEmpty`: it inherits `NonCombat`, is `AlwaysForce`,
and has Dream eligibility (`EncounterData.lua:437–464`). Thus later F/N starts
are rewardless and combatless; N's separate PreHub is unaffected.

The proposed Loadout placement is suitable as a presentation change. Reuse
`StartRoomIdentityEditor` in
`apps/planner/src/ui/editor/biome/BiomeInspectorControls.tsx` and the
existing semantic commands/products; adapt the destination bindings. Keep the
opening occurrence, acquisition timeline, and reward settlement room-owned.
Do not move reward effects into pre-run loadout simulation merely because the
controls move. Room/reward findings must find their new controls; trait/pickup
findings still find the room Timeline. Incomplete loadout must still gate entry.

## 3. Mode and ordinal are independent inputs

An immutable itinerary still requires a first-class resolved route context:
mode, full order, current ordinal, first/last position, and declaration-resolved
start/Preboss/Boss/Postboss facts. Do not make each consumer reconstruct this
from a route label or biome name.

| Concern             | Current contract / affected seam                                                                                                 | Required direction                                                                                                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Route declaration   | `packages/hades2-catalog/src/declarations/routes.ts`, `compiler/routes.ts` own two fixed orders and positional completion arrays | Catalog owns permitted biome/mode facts; authored Dream itinerary owns the selected order. No catalog entry per permutation or application-mutated catalog.                                      |
| Authored route      | `createProjectDocument`, strict decoder, `ConfigureRoutePrefix` expect catalog order                                             | Persist the full itinerary independently of the currently configured prefix. Validate it at creation/decoding; no reorder command. Decide separately whether prefix authoring remains available. |
| Identity            | `(routeKey, biomeKey, occurrenceId)` assumes unique biomes                                                                       | Reusable with four distinct biomes. No repeated-biome identity redesign needed.                                                                                                                  |
| Ordinal             | `authored-project/completion-boss.ts`, `simulation/encounters/preparation.ts` recover index from catalog route                   | Consume actual itinerary position. `evaluation/project.ts` already passes `enteredBiomeCount=index+1`, but its prefix checks still assume the fixed catalog route.                               |
| Completion          | Topology decoding/takeover resolve exact fixed Preboss/Postboss names from route                                                 | Contextual completion links; I/Q can now be nonterminal and other biomes terminal.                                                                                                               |
| Last-biome rules    | Room action domains/state, acquisition commands, room-entered lifecycle use catalog route `.at(-1)`                              | Use full itinerary terminal position, never the last currently configured prefix biome.                                                                                                          |
| Prior-room context  | `simulation/rewards/biome/chronology.ts` infers a previous Postboss Moon Beam Big Path override from current I/Q                 | Carry the actual preceding owner's fact; H→I/P→Q is no longer guaranteed.                                                                                                                        |
| Creation/navigation | `ProjectFileControls`, `editorNavigation`, session validation read fixed catalog order                                           | Creation collects itinerary before creating the project; navigation reads the committed itinerary.                                                                                               |
| Execution wire      | `execution-plan/model.ts`, assembler and codec close route keys/prefixes to Underworld/Surface                                   | Explicit Dream support and itinerary-aware admission; this is not protocol-neutral like the boss-choice extension.                                                                               |

Vow of Rivals already means rank versus ordinal, not fixed boss identity.
`Scripts/ShrineLogic.lua:IsBossDifficultyShrineUpgradeActive` additionally checks
prior seen/completed enhanced bosses in Dream. The existing fully progressed
baseline already treats that profile requirement as satisfied; no new profile
editor is implied. Preserve biome-specific H cages, N hub, G anomaly and O
wheels as biome-specific facts rather than converting everything into ordinal
rules.

## 4. NPC scaling: modeled impact

`Scripts/EventLogic.lua:909–1245` selects eligible menu choices, then rewrites
their internal rarity in Dream using `RarityUpgradeOrder[EnteredBiomes]`:
Common/Rare/Epic/Heroic (`TraitData.lua:715`). That is a scaling mechanism, not
a new player-authored rarity roll for these menus.

| Family    | Position-dependent work within current planner scope                                                                                                                                                           |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arachne   | Numeric costume/armor effects scale; most are not simulated. Do not expand combat simulation just to expose every number.                                                                                      |
| Narcissus | Pom, Magick and Life pickup counts: 1/1/2/4; ElementalBoost pickup counts: 2/2/3/4; Last Stand pickups: 1/1/2/3. Mystery Box remains one. Generated pickup cardinality must follow acquisition-time scaling.   |
| Medea     | Numeric curses scale; most changes remain native because combat/resource amounts are outside the modeled contract.                                                                                             |
| Circe     | Random Arcana activation and Fear suppression counts: 1/1/2/3. Arcana promotion target count: 2/2/3/5. Existing literal counts need declaration-owned scaled values.                                           |
| Echo      | Death Defiance refill, diminishing dodge and health/magick values scale. Reward replay, BBB, doubled levels, Gold duplicate and keepsake replay do not acquire new target/cardinality rules from this scaling. |
| Icarus    | Ingenious Strike/Flourish levels: 3/3/3/5. Supply Chain interval: 7/7/7/3. Latest Model hammer target count: 1/1/1/2. The last is a real multi-target authoring/settlement extension.                          |

Sources: `TraitData_Narcissus.lua` A/D/E/G/H, `TraitData_Circe.lua` corresponding
effects, `TraitData_Icarus.lua:29,90,462–488,539–571`, and
`TraitData_Echo.lua:81,145,212`.

The normal-position numeric rows match the existing modeled effects, supporting
the user's common ordinal policy. They are **not identical internal rarity
state**: normal Narcissus/Circe are Common despite position 2, and normal Icarus
is Common despite position 3; Echo is explicitly Epic. Normalize effect scaling
without casually changing persisted trait rarity or rarity-sensitive predicates.
Capture producer scaling at acquisition, not where a later generated pickup
appears. Hades and the actual rarity-bearing Artemis/Athena/Dionysus screens do
not use this six-menu rewrite; do not blanket-scale every NPC by ordinal.

Current hardcoded seams include catalog Icarus `levelCount=3`, Supply Chain's
compiler-enforced interval 7, singular Latest Model targeting, engine Circe
counts in `simulation/arcana-fear.ts`, and Narcissus producer cardinalities.

## 5. Inventory, eligibility and resources

| Boundary                     | Verified Dream behavior                                                                                                                                   | Implementation scope                                                                                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ordinary World Shop          | Group 2 excludes Ash/Psyche/Nectar and admits four individual elemental boosts; other options retain their normal guards (`StoreData.lua:260–268`)        | Add mode-aware option memberships, including the refill path; not a new Shop implementation.                                                                          |
| I/Q World Shops              | Group 5 replaces rare-resource options with ElementalBoost (`StoreData.lua:405–446,538–579`)                                                              | Mode-sensitive membership separate from ordinal first/second-half inventory.                                                                                          |
| I/Q first/second half        | `EnteredBiomes <=2` versus `>2` (`RequirementsData.lua:3181–3196`)                                                                                        | Already modeled; feed actual itinerary ordinal.                                                                                                                       |
| Elements                     | Individual boosts grant +1; ElementalBoost grants all four elements                                                                                       | Already implemented in planner acquisition settlement. Existing I/Q audit's prospective ElementalBoost-settlement wording is stale.                                   |
| Spark of Ixion               | Unavailable in Dream (`TraitData_Store.lua:301–313`)                                                                                                      | Shared mode predicate must reach Well candidates and indirect/random outcomes, not only a picker.                                                                     |
| Plentiful Forage / Discovery | Unavailable (`TraitData_Demeter.lua:1812–1832`, `TraitData_Chaos.lua:634–646`)                                                                            | Mode-aware trait eligibility through existing requirement authority.                                                                                                  |
| Resource hosts               | Harvest/shovel/pickaxe/exorcism/fishing successes are not generated (`RunLogic.lua:658+`); Meta Reward Stands also exclude Dream (`RoomData.lua:552–565`) | Suppress authoring/native resource enforcement obligations, including tool-generated element pickups. This does not establish a global ban on all minor room rewards. |
| Travel Deal                  | No Dream exclusion                                                                                                                                        | Existing acquisition/refill ordering; consume mode-correct inventories rather than creating a Dream-only mechanism.                                                   |
| Hermes delivery              | Last-biome Preboss completion event in Dream (`EncounterSets.lua:415–430`)                                                                                | Reuse existing delivery policy with actual terminal itinerary position and source-backed Preboss alternatives.                                                        |
| Timed resource drops         | `CheckChamberTraits` defers due `DropResources` in `SkipTimedDropResourceInDream` rooms, setting clock to interval−1 (`TraitLogic.lua:2880–2903`)         | Supply Chain must wait through these Dream boss rooms. Do not apply this to every timed effect or change Steady Growth/Embryo clocks indiscriminately.                |

## 6. Dream completion rooms

`Scripts/RoomDataDream.lua` declares three ordinal Postboss rooms with a Well,
keepsake rack, and fountain; purging and natural Chaos chances are zero. The
rooms run `EndAllBiomeStates` and select the next Dream biome. They are not copies
of whichever biome's normal Postboss map preceded them.

The inspected Lua does **not** establish a Hermes shrine in these rooms:
Dream Postboss has neither `ForceSurfaceShop` nor an increased spawn chance;
the default is zero. `DreamPostBossEntrancePresentation` is visual-only, and
normal obstacle setup still calls `IsSurfaceShopEligible`
(`RoomLogic.lua:4921,5169`; `RunLogic.lua:635`; `RoomData.lua:588`).

The user confirmed this correction: model Wells, not Hermes Shrines or purging
pools, in Dream Postboss rooms.

Boss reward replacement is established: `RewardLogic.lua:66–73` selects
`DreamPointsDrop` for `CanSpawnDreamReward` rooms. `CheckDreamBiomeCompletion`
waits for its use record. Add the identity/completion contact without turning
Dream Points into a simulated combat resource. There is no fourth Postboss.

## 7. What should remain native

`SetupEncounter` applies `DreamBiomeData` before generation. The inspected F–Q
generated overlays change money limits and concurrent active-enemy caps, not
wave/type/highlight domains. These do not justify new encounter-customization
controls. Enemy combat scaling and Dream boss visuals also remain native.

Preserve explicit inheritance suppression (`DreamBiomeData="nil"`) on openings,
some minibosses, G extra-door combat and N subrooms. Do not introduce a generic
executor reimplementation of Dream scaling. Executor work should earn its scope
through Dream startup, fixed itinerary selection, reward/completion handoff,
new Postboss admission/resync, and emitted outcome operands.

## Delivery separation under discussion

The immediate investigation is the four-part route foundation described above.
Later delivery covers mode-sensitive inventory/eligibility/resources, then
creation-time locked Dream itinerary authoring, then remaining special lifecycle
interactions and runtime integration. Dream publication remains unavailable until
its semantic and executor support is complete. The proposed four-part foundation
plan is `docs/progress/ROUTE_CONTEXT_FOUNDATION_PLAN.md`; it awaits approval and
commit. No product implementation or schema migration has started.

## 8. Current-code audit: four-part foundation

This inventory is the immediate audit result, not an implementation gate list.
Paths in this section are relative to the repository root. Existing ordinary
routes are the first consumers, not compatibility branches beside a Dream path.

### Shared route-position authority

`RouteDeclaration` in `packages/planner-engine/src/catalog-schema/index.ts`
currently combines route identity, a fixed `biomeKeys` order, and parallel
Preboss/Postboss arrays. `AuthoredRoutePlan` in `authored-project/model.ts`
stores only its configured biome prefix, not a separate complete itinerary.

The minimal missing product is an engine-owned resolved route position, derived
from explicit route identity and complete supplied order: biome identity, ordinal,
previous/next position, first/last status, and declaration-backed completion
identities. It is not a dependency-injection context or a registry of simulation
services. Catalog owns game mappings; the engine resolves their applicability.
Consumers must not infer the full route from its currently authored prefix.

How an order was chosen is outside this product. The foundation needs neither
Dream ordering restrictions nor a player-facing order picker. Separate the
internal route identity from selectable project presets: today
`apps/planner/src/projections/editorNavigation.ts` enumerates every catalog route
and `ui/shell/App.tsx` passes those directly to `ui/project/ProjectFileControls.tsx`.
Adding an unfinished Dream catalog preset would expose it immediately.

### 8.1 Opening identity, reward and acquisition

Current declaration-to-editor chain:

- `packages/hades2-catalog/src/declarations/rooms/f.ts` and `rooms/n/fixed.ts`
  declare `FixedOpening`, counted RunProgress rewards and generated opening
  encounters. Other Intro declarations use `FixedIntro` with no incoming reward.
- `compiler/rooms/core-facts.ts` enforces these static template/reward pairings.
  They currently prevent a normally rewardless Intro from having an opening
  reward. `declarations/lifecycles/standard.ts` already separates opening pickup
  from encounter start: `OpeningRewardRoom` acquires the reward before combat.
- Engine `authored-project/room-state/{defaults,codec}.ts`,
  `commands/occurrence/incoming-reward.ts`, and
  `room-actions/lifecycle-structure.ts` consume that shape. Materialization in
  `simulation/materialization/rooms/templates.ts` resolves the producer;
  `simulation/rewards/biome/generation/incoming-generation.ts`, acquisition
  settlement and `simulation/candidates/reward-producer.ts` retain its exact
  offer/acquisition frontiers.
- Application `occurrence-reward-assembly.ts::controlsForOccurrence` still reads
  static counted binding facts. `BiomeInspectorControls.tsx::StartRoomIdentityEditor`
  renders for every biome entry, not just the route opening.

Disposition: one context-resolved starting-room reward/encounter product must
reach defaults, codecs, action roster, materialization and candidate consumers.
Do not add a UI-only reward override or loadout acquisition simulator. First-room
identity/reward controls move to `ui/shell/RouteOverview.tsx`; the occurrence,
its child addresses and timeline remain intact. Remove their old editable mount
for that same opening; later biome-entry controls are a separate concern.

Finding destinations require real application work:
`state/editorSessionSlice.ts::panelForOrigin` sends biome owners to biome panels,
while `navigation/finding-routing.ts::assertFineGrainedFindingDestination`
requires the current structure/node destination. Route identity/reward repairs
to Loadout without moving nested trait/Pom repairs out of the Timeline.
Existing loadout incompleteness must continue to lock opening edits.

Primary witnesses: F/N materialization and reward candidates, occurrence incoming
reward commands, authoring-readiness/progressive-findings, RouteOverview and
BiomeInspectorControls UI, and exact finding destinations. Preserve ordinary
F/N's different entered-store history and keep N PreHub separate.

### 8.2 NPC effect variant lifetime

Use acquisition ordinal to resolve the supported effect variant, not a new
player-authored rarity or a blanket change to equipment rarity. Current gaps
include producer cardinality, Circe outcome counts, and Icarus upgrades/timing.
Some are structural rather than replacing constants: Circe Fear suppression
stores one `vowKey`, and Latest Model stores one hammer `targetTraitKey`.
Higher-ordinal variants need corresponding multi-target outcome contracts.

Supply Chain currently retains acquisition identity and progress but rereads
static catalog interval and pickup declarations at future maturities. Its
acquired variant must survive across biome changes. Do not read the maturity
room's ordinal or retrofit a general dynamic rarity engine.

Concrete owner/consumer inventory:

- `simulation/evaluation/project.ts` supplies `enteredBiomeCount` and
  `simulation/rewards/facts.ts` exposes it, but `TraitOfferContext`,
  `TraitOfferEvent` and `EquippedTrait` do not retain an NPC effect variant.
  Resolve the immediate effect at its acquisition contact and retain the
  necessary complete values for ongoing effects; do not stamp unrelated traits
  merely because they share a carrier.
- Catalog `declarations/traits/narcissus.ts` lists physical pickup descriptors.
  `authored-project/acquisition/pickup-producers.ts::producerForTraitOffer` maps
  those into generated source/entry/action ownership before settlement. Scaled
  cardinality must reach that authority, not just the final trait simulation.
  Preserve stable producer and per-pickup identities when unrelated chronology
  changes; reconcile changed active output counts through existing commands.
- `simulation/arcana-fear.ts::circeResolutionDomain` fixes activation/promotion/
  suppression counts at 1/2/1. Selected child settlement and candidate capture
  must share the resolved domain. `TraitOfferCirceResolution.tsx` also writes a
  singleton activation list and renders a singular Fear selector. Multi-card
  activation needs joint draw eligibility, not repeated singleton validation.
- Catalog `catalog-schema/traits.ts` and `compiler/traits/dispositions.ts`
  literally restrict Ingenious `levelCount` to 3;
  `compiler/traits/declarations.ts` requires Supply Chain interval 7.
  `simulation/traits/offers.ts::recordReachedTraitOffer` applies the immediate
  level effect; `history/transitions.ts::advancePickupProducerProgress` rereads
  the clock at every tick. Keep the existing encounter-end/maturity pipeline.
- Latest Model's singular target is shared through trait payloads, authoring
  assessment, history transitions, candidate products and
  `TraitOfferSelectedOutcome.tsx`. Extend its own multi-target semantics without
  changing Bridal Glow merely because they share targeted-acquisition machinery.
- Execution `model.ts` and `codec/rewards.ts` also assume singular Circe Fear and
  Latest Model targets. Carrying expanded outcomes to the game is a real wire
  contract change even if public Dream project creation is still disabled.
  A later plan must explicitly stage or include that contact rather than
  promising this entire NPC change is protocol-neutral.

No new Arachne/Medea armor/combat arithmetic or Echo numeric simulation is
justified: those quantities are intentionally not modeled. Their existing
rarityless identities and modeled replay effects remain on the same paths.

Primary tests: catalog trait-disposition/compiler suites; authored pickup-producer
and trait-carrier child suites; `narcissus-pickups.test.ts`, `arcana-fear.test.ts`,
`circe-traits.test.ts`, `trait-level-effects.test.ts`; representative focused
candidate, selected-special-outcome UI and execution compiler witnesses.
Include acquisition → biome transition → later Supply Chain maturity, with
ordinary-route output unchanged.

### 8.3 Contextual completion rooms

`packages/hades2-catalog/src/compiler/routes.ts::normalizeRoutes` currently
requires Postboss `roomSetKey` to equal the corresponding biome key.
`authored-project/commands/topology/takeover.ts::completionChainForSelection`
also requires that physical room to belong to the host biome. Both conflict
with a Dream Postboss that is selected by ordinal but owned by the preceding
biome's authored completion chain.

Resolve the exact permitted completion identity through route context and
validate against it; do not relax room membership globally. Keep existing
Preboss → Boss → optional Postboss fixed links, occurrence IDs and closure.
`authored-project/topology/decoding/coordinator.ts` independently resolves the
expected chain twice; takeover, replacement, materialization and decoding
should consume the same completion resolution. Boss maps remain biome-owned;
Rivals activation consumes ordinal. Preboss identity remains contextual too
(notably the existing I normal/Dream physical-map distinction).

Primary witnesses: catalog route normalization, `completion-boss.test.ts`,
topology structure/relational decoding and takeover commands. Test exact allowed
cross-family Postboss identity without allowing arbitrary foreign rooms.

### 8.4 Chronology and adjacency consumers

| Current consumer                                                                                                                                                                                | Current source / issue                               | Disposition                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `authored-project/completion-boss.ts::rivalsActiveForBiome`                                                                                                                                     | Catalog index + 1                                    | Shared position ordinal                                                                                      |
| `simulation/encounters/preparation.ts`                                                                                                                                                          | Separately computes entered biome count              | Same position used by reward/project evaluation                                                              |
| `simulation/evaluation/project.ts` and `biome-evaluation.ts`                                                                                                                                    | Loop index and replay predecessor derivations        | Preserve valid-prefix handoff, consume resolved positions                                                    |
| `simulation/occurrence-outgoing.ts`                                                                                                                                                             | Next configured biome                                | Keep configured availability distinct from next full-itinerary biome                                         |
| `authored-project/room-actions/{domain,state}.ts`, `commands/acquisition/acquisition-site.ts`, `topology/occurrence-codec.ts`; `simulation/rewards/biome/lifecycle-transitions/room-entered.ts` | Repeated catalog last-biome checks for delivery      | Full-itinerary finality, not configured suffix                                                               |
| `simulation/rewards/biome/encounter-acquisition/encounter-settlement.ts`                                                                                                                        | Entered count versus full run count for Boss effects | Same authoritative finality                                                                                  |
| `simulation/rewards/biome/chronology.ts` Moon Beam replay                                                                                                                                       | I/Q implies previous H/P Postboss                    | Actual preceding resolved Postboss effect                                                                    |
| `simulation/history/compose.ts::initialCounters`                                                                                                                                                | Layout start baselines: F/N zero, other biomes one   | Trace source timing and separate route-entry policy from genuine biome-local counters before changing values |

The direct rack path in `lifecycle-transitions/keepsake-rack-used.ts` checks the
actual H/P Postboss room for its Big Path effect. That is a physical room fact,
not automatically an ordinal rule. Replay must consult the preceding resolved
room and reuse that policy rather than guessing from the current biome name.

Keep H cages, N Hub/restore, I Clockwork rules, local encounter envelopes and
biome-specific resets with their existing authorities. Do not replace every
biome-name check mechanically. Retire only name checks that encode position or
adjacency and independent reconstructions of the shared route facts.

Primary witnesses: project evaluation/replay context agreement, terminal
delivery domains and lifecycle, ordinal Rivals, and `echo-gift-keepsake.test.ts`
with a predecessor independent of the current biome name. Truncated authoring
must not turn the current last configured biome into the run's terminal biome.

### Boundaries deliberately not opened

Execution `model.ts`, `assembler.ts` and `codec.ts` currently admit only the two
ordinary routes and their prefixes. Keep unsupported Dream publication explicit
until its later delivery; never disguise Dream as an ordinary route key. No
protocol bump or new project-order schema is prescribed by this audit alone.
Public Dream creation, legal permutation rules, resource suppression, inventory
changes and timed-drop deferral remain outside this foundational audit.
