# Dream Dive: remaining work after route foundation

## Question and baseline

What remains before a fixed-itinerary Dream project can be authored and executed
correctly? This reassessment is grounded in planner `daca6903` and downstream
game module `26c2feb`. It is an investigation, not an implementation plan.
Game citations are relative to the installed Hades II `Scripts` directory;
source inspection is not live-game verification.

The completed foundation already supplies:

- full saved itinerary, ordinal, neighbors and terminality, distinct from the
  configured prefix;
- first/later starting-room profiles, with initial room/reward editing in
  Loadout and acquisition remaining on the room Timeline;
- acquisition-ordinal NPC effects, including retained Supply Chain intervals;
- contextual Preboss/Boss/Postboss resolution and the three Dream Postboss
  declarations and captured maps.

The source authority is
[Route-position profiles](../audits/rooms-and-routes/ROUTE_POSITION_GAME_DATA_AUDIT.md).
Do not reopen those mechanisms or introduce a second route context.
Public Dream creation/loading and execution publication are still disabled.

## 1. Next bounded work: content and availability rules

| Boundary                     | Native Dream rule                                                                                       | Current gap / owning change                                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ordinary World Shop, group 2 | Exclude Ash, Psyche and Nectar; add Fire/Air/Earth/Water Boost (`StoreData.lua:260–268`).               | Catalog Shop option membership needs route-conditioned requirements. Reuse inventory generation for both initial slots and Travel Deal.                                  |
| I/Q World Shops, group 5     | Replace Nightmare, Moon Dust and Obol Points with ElementalBoost (`StoreData.lua:405–446,538–579`).     | Extend the shared resource-option declaration. Keep mode membership separate from first/second-half inventory.                                                           |
| I/Q first/second half        | `EnteredBiomes <= 2` versus `> 2` (`RequirementsData.lua:3181–3196`).                                   | Already declared and fed by resolved ordinal. Verify reordered Dream generation and refill contacts; no new ordinal mechanism.                                           |
| Element acquisitions         | Individual boosts add one corresponding element; ElementalBoost adds one of each.                       | Already declared in `rewards/acquisitions.ts` and settled through acquisition-owned element contributions. Add shop membership, not an element simulator.                |
| Spark of Ixion               | Excluded by `IsDreamRun` requirement (`TraitData_Store.lua:301–313`).                                   | Initial Well and Travel Deal Well refill eligibility both need route context.                                                                                            |
| Plentiful Forage             | Excluded; its independent BlockGiftBoons restriction still applies (`TraitData_Demeter.lua:1812–1832`). | Add route restriction through trait eligibility, shared by selected validation and candidates.                                                                           |
| Discovery                    | Excluded (`TraitData_Chaos.lua:634–646`).                                                               | Same trait-eligibility owner, including Chaos outcome candidates.                                                                                                        |
| Resource hosts               | Native harvest/tool/fishing setup is behind the non-Dream guard (`RunLogic.lua:656–744`).               | Catalog availability consumed by engine resource authoring/assessment and execution-policy derivation; UI reflects unavailable support. No executor spawning workaround. |
| Meta Reward Stands           | Excluded independently (`RoomData.lua:552–565`).                                                        | Keep this distinct from resource tools and ordinary room rewards; do not add unsupported authoring for stands.                                                           |
| G Anomaly doors              | `AnomalyDoorRequirements` explicitly excludes Dream (`RoomData.lua:607–615`).                           | Missing from G takeover support. Apply the mode rule through existing Anomaly generation/candidate authority. No new topology.                                           |

### Scope limits

These are **source-specific exclusions, not a global metaprogression reward
ban**. Ordinary door/optional reward pools are not removed by the World Shop
rules. Wells and Fateful Twist retain their resource consumables. Hermes Shrine
inventory must not inherit World Shop exclusions merely because both sell items.

Fateful Twist cannot award Spark of Ixion: the native whitelist
(`ConsumableData.lua:1505–1528`) and catalog `twistWellItemKeys` both exclude it.
Do not invent a Twist-to-Ixion regression case. Native random trait selection
does check its own trait requirements (`StoreLogic.lua:1366–1371`).

Natural Chaos is not globally prohibited by Dream: base `SecretDoorRequirements`
retain their room/biome/history restrictions (`RoomData.lua:495–515`). Excluding
Ixion and Anomaly must not become an indiscriminate extra-door ban.

The trait-data Dream scan found the three exclusions above. Hades' Dream
conditions (`TraitData_Hades.lua:216,273`) change names/stat-line presentation,
not eligibility. Dialogue suppression, shopping-NPC narrative events and
combat scaling do not justify new planner products.

### Concrete code seams

Paths here are relative to their named package/application `src/`.

- Catalog: `declarations/rewards/shops.ts`, `declarations/traits/demeter.ts`,
  `declarations/traits/chaos.ts`, `declarations/resources.ts`, and
  `declarations/layouts/g.ts` own the facts.
- Engine `requirements/model.ts` has no route predicate today. Trait eligibility
  is a separate expression family in `catalog-schema/traits.ts`; it also lacks
  mode support. Extend existing authorities with the same explicit route fact,
  not a new universal rule engine or a persisted `isDream` flag.
- Well assessment in `simulation/commerce/stygian-well.ts` currently handles
  its own inactive/empty-slot restrictions rather than generic Shop requirements.
  Adding only a Shop option requirement would miss this contact. Cover selected
  inventory, refill and exact candidate contexts together.
- `simulation/rewards/biome/chronology.ts` already supplies
  `routePosition.ordinal`; reward facts and generation receive it. Mode must
  likewise come from supplied route identity, never physical biome inference.
- `simulation/resources.ts` owns legal placements, retained-invalid findings,
  effective placements and the execution envelope. Its complete product should
  express Dream unavailability; UI hiding alone cannot protect imported state
  or prevent an invalid resource force from entering the execution product.
- `simulation/generation/first-target-takeover.ts` owns Anomaly support. Its
  existing condition list has depth, room, encounter and usage checks but no
  route restriction.

Recommended acceptance owners: catalog Shop/trait/resource declarations;
engine Shop chronology, Well/refill assessment, trait candidates, resource
legality and Anomaly generation. Keep the full ordinary/Dream membership matrix
at these owners and use representative application workflows, not duplicate
matrices in React tests. Include mode × ordinal independence for I/Q and an
allowed minor-resource outcome to catch overbroad exclusions. Retained invalid
choices must remain repairable, not silently disappear.

## 2. Public authored Dream project

User direction remains: select four biomes once during creation; no later
reorder command. A different order means a new project.

`DreamRunLogic.lua:SelectNextDreamBiome` declares:

- first pool G/H/I/O/P/Q; F/N join only for later positions;
- no repeated biome;
- a later biome cannot be the current biome's natural successor, using
  `RoomSets.lua:NextRoomSets` (F→G→H→I and N→O→P→Q);
- this successor exclusion is directional, not a symmetric adjacency ban.

`GameData.FullRunBiomeCount` is four. First-ever forced H and previous-run
starting-biome avoidance are external save predicates, excluded by the agreed
fully progressed/profile-independent model.

The authored model already stores `itineraryBiomeKeys`. Current internal
defaults/codec accept one to four unique known biomes and do not enforce Dream
start/adjacency rules. Existing foundation tests deliberately exercise some
non-public itineraries. Public creation/admission needs one engine-owned
legality policy, with UI selecting from it; do not treat those internal test
inputs as proof of legal Dream routes.

Application contacts are `composition/projectBootstrap.ts`,
`workspace/projectOperations.ts`, `workspace/project-admission.ts`,
`projections/editorNavigation.ts` and `ui/project/ProjectFileControls.tsx`.
Creation currently supplies only a route key. Pass the complete chosen
itinerary once, preserve it across load/autosave/Undo, and keep the existing
configured-prefix workflow. Public admission must agree with creation.

The existing schema already represents itinerary identity; do not assume a
fresh authored-schema bump is necessary merely to expose Dream. Assess actual
persisted changes when the plan is written. Execution is a separate closed
contract and will need an explicit extension.

## 3. Remaining lifecycle and runtime work

### Supply Chain is due-drop deferral, not a non-counting boss

`TraitLogic.lua:CheckChamberTraits` increments the counter, then when a drop is
due in `SkipTimedDropResourceInDream && IsDreamRun`, retains interval−1 instead
of dropping (`2888–2902`). Do not stop every boss advance or suppress Steady
Growth/Embryo/Judgement with it.

The room schema/compiler currently expose only unconditional
`skipTimedDropResources`. `simulation/rewards/biome/lifecycle-transitions/encounter-end-effects.ts`
consumes that fact, and `simulation/traits/history/transitions.ts` already
implements interval−1 deferral. Add the mode-conditioned declaration at this
seam, retaining the producer's acquisition-time interval. No new clock or
scheduler is warranted.

### Hermes terminal maturity already has the right policy

The engine flushes pending delivery at resolved terminal Preboss in
`simulation/rewards/biome/lifecycle-transitions/room-entered.ts`. Native Dream
`ShopRoomEvents` checks `AutocompleteSurfaceShopDelivery` and ordinal four
(`EncounterSets.lua:415–430`). F/G/H/I/N/O/P Preboss declarations provide it;
Dream I uses `I_PreBoss01`.

Q uses a different contact: its ordinal-four distance trigger invokes
`SpawnHermesInPerson` (`RoomDataQ.lua:1275–1300`). That function removes pending
delivery traits, triggering their expiry deliveries
(`EventPresentation.lua:3526–3563`); Dream skips dialogue checks, not delivery.
Thus final Q works for ordinary and Dream. Non-final Q must not flush early.
Add representative reordered-route/runtime witnesses, not a new maturity rule.

### Publication is not just admitting another route string

Planner execution model/codec/assembler and downstream protocol decoder still
accept only Underworld/Surface. Downstream first-biome checks are also ordinary
route-specific. Required integration witnesses:

- Native `Dream_Intro` prologue remains outside authored chronology. Native
  startup uses an explicit room and bypasses initial `ChooseStartingRoom`
  (`RunLogic.lua:511–515`, `DeathLoopData.lua:7062–7067`). The current game module
  synchronizes around `StartNewRun` and expects the first published occurrence
  at `StartRoom`; that admission boundary needs deliberate handling.
- Native `SelectNextDreamBiome` chooses the itinerary. Steering must supply
  authored choices while preserving native `EnterNextDreamBiome`/entry work.
  The existing `ChooseStartingRoom` override applies only while session state
  is `starting`, not later synchronized Dream transitions.
- Dream Points spawning/use, ordinal Postboss transition and fourth-biome ending
  belong to the game (`RewardLogic.lua:71–72`, `DreamRunLogic.lua:63–83`). They
  replace boss material drops; no planner points economy is needed.
- Reuse postboss occurrence admission/resync and existing NPC outcome steering,
  but verify Dream identities, ordinal effects and onward itinerary steering.
- Keep native combat scaling, presentations and difficulty. The inspected
  Dream encounter overlays do not establish a new wave/type/highlight authoring
  domain; preserve native inheritance suppression as well.

Public authoring can be a development milestone before runtime delivery.
Publication should remain unavailable until lifecycle corrections and runtime
integration are delivered and exercised. Do not confuse a valid editor route
with a supported playable execution plan.

## Recommended plan boundary

The next plan should cover section 1: mode-aware content/feature availability,
including Anomaly, through existing catalog and engine authorities, with UI
consuming their products. Fold in Supply Chain's small declaration-driven
deferral extension and coverage for the existing Hermes terminal rule. Keep
Dream public admission closed during this work.

Then enable fixed-itinerary authored projects, followed by the runtime work
above. No new route framework, shop engine, element simulator,
scheduler or mutable mode registry is indicated by this reassessment.

Remove this investigation as its remaining questions are delivered or promoted
to the smallest durable source owners; it must not become a second design manual.
