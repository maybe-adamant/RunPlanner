# Implementation Progress

## Purpose

This is the concise factual delivery record for the delivered planner. Stable
game facts,
ownership rules, and modeling decisions belong in the catalog, design, biome,
and audit authorities. Git preserves the complete commit and review history;
this file keeps only milestones, durable transitions, validation claims, and
the active frontier needed to orient the next delivery.

## Current Snapshot

The current persisted contract is strict authored schema 73 with catalog
`0.52.0-boss-preboss-variants`. Each project contains one selected route;
the browser product supports the eight catalog biomes across the two current
route choices:

```text
Underworld: F -> G -> H -> I
Surface:    N -> O -> P -> Q
```

The catalog, authored project, materialization/history, simulation, validation,
candidate evaluation, findings, structured workspace, Redux coordination,
profile persistence, recovery, and React editor form one connected product
loop. Room Declarations are unique catalog identities; Room Occurrences are
repeatable authored instances with stable persisted IDs.

The delivered room/lifecycle surface includes ordinary and generated rewards,
shops and exact purchase order, Fields, Clockwork, Hub and side rooms, Echo,
All Together, Travel Deal, Gold, Contract, Narcissus pickups, Artificer,
Selene spells, keepsake effects, Chaos, run-impacting traits, Nemesis random
events, fixed Boss/Postboss occurrences, Resources, Pools of Purging,
Hermes Shrines, and Stygian Wells. The engine models supported possibility,
not probability; unresolved and context-invalid authored state remains visible
and repairable.

The Phase 8 permission-minimal Tauri 2 Windows preview is complete. Its native
profile flow now retains an opened or first-saved project target for in-place
Save, while the browser retains upload/download behavior. The game module
remains a later declarative consumer and runtime auditor, not a second planner
or simulator.

## Active Frontier and Blockers

The single-route project delivery is complete. Schema 73, its focused
schema-72 splitter, no-project startup, catalog-driven route choice, singular
evaluation/workspace pipeline, and owning product witnesses are closed with no
recorded blocker.

The next product boundary is Phase 9, Simulation Conformance and Game
Protocol. It is gated by the readiness conditions in
[`GAME_INTEGRATION_BOUNDARY.md`](../design/GAME_INTEGRATION_BOUNDARY.md).
The application-to-game execution-plan schema, compiler, importer, runtime
auditor, and conformance traces have not started.

There is no recorded active correctness queue in the former polish tracker.
Future product observations must first identify their owning authority and,
when cross-layer, receive a focused audit and locked plan. Probability/RNG,
health/gold accounting, unsupported NPC/shop paths, and other explicit game
integration exclusions remain outside the current simulation contract.

## Schema and Catalog Milestones

The following table preserves the major persisted-contract and catalog
milestones without repeating the delivery chronology.

| Contract milestone | Durable outcome                                                                                                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema 1           | Initial strict `ProjectDocument`, F/G route spine, semantic addresses, authored occurrence identity, and JSON boundary.                                                                  |
| Schema 2           | Batch-owned reward stores and the first connected reward authority; the pre-release leaf-store model was rejected.                                                                       |
| Schema 3           | Global biome declarations, route placement, shared layout vocabulary, and dormant cross-biome declaration isolation.                                                                     |
| Schema 7           | I's authored Entrance, generated Story peer, and explicit bounded non-goal roll.                                                                                                         |
| Schema 8           | Batch authoring defaults and strict replacement of the prior latent-default contract.                                                                                                    |
| Schema 9           | Unified biome decisions, common exits/batches, and the application capability boundary.                                                                                                  |
| Schema 11          | Exact authored Shop purchase order replaced the purchased-set contract.                                                                                                                  |
| Schema 20          | Canonical acquisition settlement across ordinary rewards, O wheels, Fields, N rooms, and Shops.                                                                                          |
| Schema 30          | Keepsake identity/equip chronology and supported-rank effect transitions.                                                                                                                |
| Schema 35          | Echo's complete player-rarityless provider and replay child products.                                                                                                                    |
| Schemas 36-38      | All Together, Infernal Contract, Travel Deal, Gold, Shop-trait effects, and one acquisition chronology.                                                                                  |
| Schemas 39-41      | Narcissus pickups, Fields cage/optional chronology, Artificer conversion, and source-owned replacement acquisition.                                                                      |
| Schemas 42-43      | Unresolved-or-complete authored rewards and encounter-owned trait offers, with strict retained invalidity.                                                                               |
| Schemas 44-45      | Atomic direct selected-trait outcomes and generated-pickup ownership for Reward Reward Reward/Boon Boon Boon.                                                                            |
| Schema 47          | The occurrence-owned Room Action order absorbed the prior acquisition chronology.                                                                                                        |
| Schema 48          | Required Room Action defaults, explicit Shop/optional participation, fixture-integrity checkpoint corpus, and no private purchase order.                                                 |
| Schema 49          | Fountain/Postboss completion lifecycle, required fountain use, optional keepsake rack, and derived `bossDefeated`.                                                                       |
| Schema 50          | Selene's rarityless spells, Spell Drop lifecycle, equipped-slot ledger, and Echo replay correction.                                                                                      |
| Schema 51          | Chaos Trial Upgrade paired traits, closed curse/blessing pools, and maturation effects.                                                                                                  |
| Schema 52          | Natural Selection, King's/Queen's Ransom, Steady Growth, shared Hephaestus cooldown limits, and retained offer history.                                                                  |
| Schema 53          | Nemesis combat/random-event authoring and generated-pickup settlement.                                                                                                                   |
| Schemas 54-59      | Runtime fallback policy, fixed completion-room feature occurrences, Resources, Pools, Hermes Shrines, and Stygian Wells.                                                                 |
| Schemas 60-63      | Aromatic Phial fountain rarity, Crystal Figurine Boss activation, Concave Stone residual boons, and Transcendent Embryo transformations.                                                 |
| Schema 64          | Optional frozen Aspect of Persephone offer contributions, chronological Premium Service range expansion, and derived effective trait levels.                                             |
| Schema 65          | Frozen selected-Hex layouts and high-value identities, finite Path capacity, latched Talent Drop closure, and persistent God Sent extension.                                             |
| Schema 66          | Three-option Chaos Trial Upgrade envelopes, selected-pair settlement, exact Denial peer-curse bans, and ordinary Rejected row locking.                                                   |
| Schema 67          | Sparse Postboss Keepsake Rack changes: declaration-owned availability, explicit add/change/delete, and no authored retain no-op.                                                         |
| Schema 68          | Boss and Postboss completion rooms became ordinary topology occurrences connected by fixed links; unreachable terminal I/Q Postboss drafts retired.                                      |
| Schema 73          | Each project became a single selected-route document; the legacy schema-72 dual-route shape is converted by a lossless two-document splitter, and the older migration chain was retired. |

Catalog versions advanced alongside these boundaries. The current catalog is
`0.52.0-boss-preboss-variants`; exact declaration facts and source contacts
remain in the catalog package and focused audits rather than this status
ledger.

## Durable Architecture Transitions

- The dependency direction is `catalog construction -> pure planner engine <-
application composition -> React UI`.
- Catalog normalization replaced room-name and raw-game-table switches with
  declaration-owned facts and closed policy unions.
- Authored topology and room-local leaves became separate owners; downstream
  retention and destructive reconciliation are semantic commands.
- Materialization, game-language history, validation, candidates, findings,
  and UI projections are replaceable products over authored state, not another
  persisted model.
- Acquisition, pickup, purchase, delivery, and room cleanup use one
  occurrence-owned lifecycle chronology where the game facts require it.
- The structured workspace and candidate session became the application
  boundary for lazy contextual products; React renders projections and
  dispatches complete semantic intents.
- Editor controls use four explicit command tones while specialized navigation
  and selection surfaces retain named treatments. Domain identities use the
  contextual-picker product when search, evidence, or repair matters; small
  closed scalar parameters remain native controls.
- Named JSON checkpoints and a typed manifest replaced permanent command-built
  full-route fixture machinery. Command tests remain command-driven and
  fixture integrity owns canonical bytes, metadata, and cached-base identity.
- The Phase 8 desktop shell wraps the browser product without moving domain or
  simulation behavior into Rust.

## Feature Closures

### Foundational catalog, authored model, and cross-biome product

The initial F/G implementation established strict catalog normalization,
authored topology, semantic commands, reward stores, materialization/history,
validation, and the browser composition root. Cross-biome closure then added
the shared layout/decision vocabulary and dormant declarations for H, I, N, O,
P, and Q before each biome became authorable and simulatable through its own
vertical slice. The current biome authorities own the resulting rules;
historical greenfield checklists are retired.

### Echo, Shop, keepsake, reward, and acquisition lifecycle

Echo's eight closed player-rarityless outcomes, World Shop replay, captured
keepsakes, Gift, and last-reward behavior use existing reward, trait,
acquisition-site, candidate, finding, and Run State authorities. All Together,
Infernal Contract, Travel Deal, Gold, Shops, Narcissus, Fields, and Artificer
share the canonical settlement and Room Action products. Direct purchases are
atomic paid acquisitions; free generated pickups retain pickup capabilities.

Vow of Forfeit now preserves the qualifying Boon/Hermes offer and reward-store
history while materializing the required Red Onion through ordinary pickup
settlement. The same RoomReward boundary covers Artificer-generated
Boon/Hermes replacements; Devotion and direct `GiveLoot` paths remain outside
it. Time Piece and Sea Star assess the realized Onion, and the workspace
presents that outcome without exposing a dormant trait screen.

The remaining keepsake catalog is closed. Aromatic Phial, Crystal Figurine,
Concave Stone, and Transcendent Embryo author their random results at existing
fountain, Boss-defeated, trait-offer, and encounter-threshold owners. The nine
Olympian keepsakes share one ordered exact-reward priority and provider-specific
force/rarification ledger; Moon Beam reuses that priority and feeds the finite
Hex Path account. Ordinary equip, Cherished Heirloom, and Gift Gift Gift
contacts are explicit for every implemented effect. Individual Hex tree
topology, node reachability, and effects remain outside the supported
simulation scope.

### Hex talent layout closure

The 2026-08-27 Hex closure added four frozen layouts and exact Rare/Epic
identity sets for every selected Hex, including Aspect of Selene's fixed Sky
Fall tree. Schema 65 validates and migrates complete tree configurations. The
simulator installs the tree before Path settlement, clamps investment to finite
capacity, preserves banked overflow, latches future ordinary Talent Drops when
a writable screen fills the tree, and retains committed Hermes delivery. God
Sent adds its audited two capacity once and does not reopen a closed tree. Task
Force requires an earlier concrete Spell Drop but retains its graph-local
Olympian-node predicate as an execution-time fallback concern. Run State shows
the selected layout, capacity, God Sent, points, and open/closed status.

The 2026-08-27 Persephone effective-level closure added the declaration-owned
`0..5`/`0..8` offer contribution bounds and the strict schema-64 optional
`persephoneLevelBonus` row result. Omission is the authored default `+0`, while
nonzero outcomes remain frozen with their generated option. One engine
resolver serves candidate projection and selected settlement: fresh rows add
Jeweled Pom and Persephone contributions, replacements inherit their prior
level and any Sacrificial Hymn bonus, and Calling Card/Concave Stone preserve
the generated row. Premium Service is chronological and expands only later
screens; same-screen siblings remain frozen. The application renders the
engine-derived effective level and the bounded editor without reimplementing
eligibility or arithmetic.

### Trait and generated-pickup closures

Chaos, Natural Selection, both Ransoms, Steady Growth, Sea Star, Buried
Treasure, and Quick Buck are declaration-backed and simulated where their
effects alter the run. Schema 66 gives Trial Upgrade its source-shaped
three-option envelope: the author selects three curses and requirements, then
one complete selected curse/blessing outcome. The two peer blessings remain
game-generated; Denial's unselected peer bans are curse-only. Ordinary and Rejected
effects flow from the reached engine candidate into one exact ordinary-offer
projection, so the editor can retain and repair a blocked option without
reconstructing Chaos rules. Trial Upgrade is not an Echo last-reward source,
and an ordinary Transcendent Embryo replacement removes its marked direct
blessing before later Chaos history observes it.

`BlockOfferIfPreviouslyPicked` history survives later trait removal. Artificer
replacements, Narcissus, Echo, Quick Buck, Buried Treasure, and Sea Star use
source-scoped generated-pickup products without a generic clone tree, second
chronology, timer model, or resource ledger.

### Room-feature closure

The room-feature phase is complete from locked plan `74f70a7f`. It replaced
general authored Death Defiance conditions with declaration-owned one-step
runtime fallbacks, retained Gorgon's phase-local trigger, made Boss/Postboss
fixed-link occurrences, and added selected-success Resources, F/G/H Pools,
Hermes Shrines, and Stygian Wells. Five manifest-backed checkpoints remain the
representative full-lane witnesses:

- `surface-n-resources` — selected resource timing and side-room placement;
- `underworld-f-pool` — stacked-trait removal and retained prior-pick history;
- `surface-no-hermes-shrine-delivery` — rushed and delayed Shrine delivery;
- `surface-n-shrine-side-room-delivery` — visited side-room Shrine source with
  an unplaced later main-room delivery host;
- `underworld-f-stygian-well` — Travel Deal refill and consequential Well effects.

Pools and Wells alone allow runtime-random inventory at Interact. World Shops
and Shrines author every visible inventory identity.

The 2026-08-28 room-feature availability and resource-presentation delivery,
implemented from the locked two-gate plan, completed the application-side
Resource disclosure slice. Resource rows now project declaration-derived
successful outcome labels, explain the route-wide one-placement limit, and
disclose the prior occurrence with a semantic navigation link on internal move
rows. Add, remove, illegal-target disabling, replacement, and Undo
remain the existing single semantic-command path. The focused
`BiomeInspectorControls.test.tsx` witness covers all four labels, move
disclosure/navigation, illegal-target protection, one-edit replacement, and
Undo. No authored schema, catalog, or simulation behavior changed.

### Sparse Keepsake Rack authoring

Schema 67 separates the physical Postboss rack from authored use. An unused
rack has no occurrence leaf, Room Action, lifecycle event, or derived history
entry. The editor offers **Add keepsake change**; a selected replacement can be
changed in place or removed with **Delete keepsake change**. Changing preserves
the ranked action and dormant immediate equip-result detail, while deletion
clears the complete owned subtree. Run State history records only the starting
equip and real replacements, with each entry carrying its actual effective
biome so skipped racks do not collapse chronology labels.

### O reward presentation closure

The 2026-08-28 O reward-presentation work, delivered in commits `13f525b7` and
`adb54f49`, keeps existing O catalog, authored, lifecycle, candidate, and
simulation behavior intact while clarifying its two store-bearing editor
surfaces. Target cards now receive one application-projected outgoing-store
consequence: ShipCombat discards its inherited store, Miniboss and Devotion
show their forced RunProgress rewards, Reprieve draws its ordinary reward from
the resolved store, and fixed Story/Shop targets distinguish entered-store
provenance from reward-bag consumption. A non-Ship source exposes its single
editable `Next store roll`; a Ship source retains the final active wheel as its
only editable outgoing-store authority.

Each active O reward wheel now presents its one or two simultaneous offers as
bounded cards within that wheel's existing phase. Two offers are equal sibling
columns that collapse in a narrow container, dormant offers retain their
authored values, and two active cards expose the picked offer as a direct radio
choice. The chronological Choose action remains ordered on the Timeline without
a duplicate dropdown. Selecting a generated offer is no longer blocked by its
newly exposed acquisition child; the picked reward's trait screen is authored
on its following pickup action. Fixed O Trial rooms also recover an unresolved
Devotion payload from their declaration-owned reward type instead of publishing
an empty reward picker. The cards neither become exits nor acquire topology
controls.

Gate A focused Vitest passed `decision-assembly.test.ts` and
`DecisionWorkbench.test.tsx` (2 files, 56 tests), alongside full workspace and
fixture typechecking plus changed-file ESLint, Prettier, and diff checks. Gate
B `npm run test:ui` passed 30 files and 287 tests; typechecking, production
build, lint, format checking, and diff checks also passed. After review
remediation, `ORewardWheelLayoutContract.test.ts` and changed-file lint,
Prettier, and diff checks passed; production code was unchanged, so the full
UI lane was not rerun. The complete repository closure gate then passed:
typechecking; fixture integrity (3 files and 20 tests); correctness (256 files
and 2,537 tests); performance-policy coverage (17 tests); the relative
performance comparison with every product target in bounds; lint; formatting;
and the production build.

### Hub editor navigation and layout closure

The 2026-08-28 Hub editor correction, delivered in commits `9af264cf` and
`6631a378`, preserves the existing N ownership split while making its
destinations and presentation explicit. Hub Overview owns fixed-slot
membership and main incoming-reward identity; Hub Timeline owns the main visit
and ordering roster; entered main-room lifecycle and incoming-reward
acquisition details remain in that occurrence's Timeline. Parent main-room
Overviews own side generation, entry order, and side reward identity, while
entered side occurrences appear as nested rail children and own their own
Timeline acquisition details. Generated but unentered side rooms remain off the
rail, and side entries never alter the six-main-visit count.

The Hub Overview board now uses three, two, and one columns at normal,
intermediate, and narrow container widths. Hub Timeline cards reserve stable
columns for drag handle, rank, identity, visit metadata, Room details, and
reorder controls; long labels wrap within identity without shifting later
controls. These are presentation-only changes with no authored, simulation, or
UI-session persistence changes.

Gate A and Gate B were committed separately as the navigation/destination and
board/layout slices. This closure pass absorbed the durable editor rules,
formatted the remaining locked O presentation plan, and completed the repository
closure gate. Typechecking, fixture integrity (3 files and 20 tests), correctness
(255 files and 2,531 tests), performance unit coverage (17 tests), relative
performance comparison, lint, formatting, and the production build all passed.

### Room-driven offer authoring closure

The 2026-08-28 room-driven offer-authoring delivery, implemented in commits
`c0d777f1` and `3b12fb24` from locked plan `8079172f`, made the selected Room
Declaration the authority for the complete start and door reward surface. The
catalog now derives ordinary `none`/`incomingReward` bindings from each room's
incoming declaration and validates the explicit H Fields `cages` group. The
application resolves one exhaustive surface for zero, one, or multiple active
rewards; the rail remains an intentionally lossy exact-one presentation.

The follow-up start-flow correction keeps the topology-free frontier as one
generic `Start biome` action and moves all Room/Reward editing to the created
Opening or Intro occurrence. Normal doors retain their pending, no-reward,
single-reward, and multi-reward states. H cage rewards are exposed on the
outgoing offer while optional Fields MetaProgress remains entered-room state;
O ShipCombat remains a no-reward offer with its wheels room-local. The old
preview and start-only reward shortcuts were removed without changing the
authored schema or catalog version. Gate A catalog/contract witnesses and Gate
B UI/planner/product witnesses passed with the documented typecheck, lint,
format, build, and diff checks. The one closure `npm run check` passed: fixture
integrity covered 3 files and 21 tests; correctness covered 256 files and 2,549
tests; the 17-test performance comparison suite and same-host relative
comparison passed; ESLint, repository-wide Prettier, and the production build
passed. The build retained only the existing greater-than-500-kB chunk advisory.

### Repository cleanup closure

The 2026-08-25 repository cleanup made the root README a stable product and
quickstart entry point, moved audit navigation into a subject-organized audit
index, consolidated overlapping evidence without erasing source contacts, and
retired completed delivery scaffolding. The progress directory now contains
only this delivery record, the forward roadmap, and migration provenance.

Occurrence presentation, occurrence semantic assembly, and workspace
interaction binding now each use one deliberate composer over named complete
products. The old inline paths and monolithic test matrices were removed in the
same slices; public workspace contracts, authored schema, simulator behavior,
focus policy, and editor workflows did not change. Shared Vitest lanes now
report active and completed test modules so long runs expose live progress.

The closure gravity review preserved large declaration, contract, and
chronological coordinator files where their size reflects one readable
authority. Evidence-backed planner, engine, codec, and catalog compiler
frontiers are recorded in the roadmap and require independent locked slices.

### Maintainability decomposition closure

The 2026-08-25 Plan 1 decomposition moved the catalog compiler, planner
projection/presentation, engine trait/reward, persistence decoder, generation,
and progressive-product families into complete semantic owners with their
primary tests. Supported entry modules now compose those products instead of
retaining parallel implementations or forwarding private APIs.

Representative mixed-responsibility entry files became substantially smaller:
catalog trait compilation moved from 1,880 to 60 lines and reward normalization
from 1,211 to 112; planner candidate projection moved from 1,281 to 458 and the
trait-offer editor from 1,760 to 291; engine trait simulation moved from 3,373
to 9, reward processing from 5,141 to 808, topology codec assembly from 2,497
to 23, biome generation from 2,310 to 252, and progressive biome assembly from
2,255 to 492. These measurements describe entry ownership, not line-count
quotas; the extracted modules retain the complete policies and explicit
products.

The split test monoliths were retired in favor of owner-specific matrices plus
one representative assembly or product witness at each affected boundary.
Authored schema, catalog version, semantic commands, findings, candidate
results, and editor behavior did not change.

The 2026-08-26 Plan 2 closure completed the audit-proven room/layout compiler,
batch materialization, project-evaluation, and reward-chronology seams.
Catalog compilation now closes local declarations only after their immutable
collections exist; engine evaluation keeps complete batch construction,
per-biome composition, exact private artifacts, route orchestration, and final
reward publication as explicit products. Reward event families return complete
transitions to one exhaustive chronology, which remains the only authority for
event order, branch advancement, emission application, and final publication.
The planner application remains an unchanged downstream consumer. Superseded
inline paths and duplicate primary cases were removed with their replacement
owners; public catalog and engine contacts, authored schema 59, catalog
version, simulation results, candidates, findings, persistence, and editor
behavior remain unchanged.

### Boss and Preboss variant correction closure

Catalog `0.52.0-boss-preboss-variants` now contains the distinct F/G/H/N/O/Q
Boss02 rooms and encounters. Biome completion declarations own their normal
and optional Rivals Boss identities, while route declarations own one exact
Preboss identity per position. Fixed completion creation resolves Rivals by
one-based route position; changing the Vow rank reconciles already-created Boss
occurrences without changing their IDs, links, compatible state, or resource
addresses. Underworld selects `I_PreBoss02`; the same route contract supports a
future Dream mapping to `I_PreBoss01` without exposing both to authoring.

The planner/catalog implementation is recorded in `4c88b45f`. Its focused
closure evidence includes catalog 24 files/247 tests, engine 136 files/1,639
tests, the nine-test completion-variant suite, execution-compiler and
schema-splitter witnesses, workspace and fixture typechecking, application
candidate contacts, ESLint, and repository formatting. The final `npm run
check` passed 22 fixture-integrity tests, 263 correctness files/2,669 tests,
the relative performance comparison, ESLint, repository formatting, and the
production build; the build retained only the existing greater-than-500-kB
chunk advisory. Plan Executor commit `2511bc1` advances the strict catalog
contact and byte-identical canonical fixtures with 50/50 Lua tests; shell
commit `0f6ef40` pins that consumer.

### Outgoing-batch progressive retention closure

The 2026-08-29 outgoing-batch correction groups ordinary generation evidence
under its real decision owner: Fields support belongs to the source decision,
while ordered target assessments carry target pressure and target-local
generation evidence. Progressive retention now follows the frozen lifecycle
boundary. A generation-time block retains only the reached physical prefix and
its bounded repair contact; a later acquisition or room-lifecycle block keeps
the complete already-generated source batch while withholding the unresolved
child's effect and downstream capabilities. The prior flat generation ledgers
and selected-pressure-only retention path were removed; no authored schema,
catalog fact, or UI fallback was added.

The implementation is recorded in commit `b2e64e39`. Focused pre-review
verification ran sequentially across seven owning engine/planner files and 88
tests. Accepted review remediation then reran the affected two files and 33
tests; no production changes occurred between the split focused passes except
the explicitly accepted Chaos/additional-exit remediation before that 33-test
pass. Composite closure evidence includes successful cross-workspace and
fixture typechecking, 22 fixture-integrity tests, the 17-test performance
policy suite and relative eight-metric comparison, lint, formatting, and the
production build. The correctness lane passed 255 of 257 files and 2,625 of
2,627 tests; its two stale Preboss-envelope witnesses were updated for the
earlier eligibility-driven progression correction and their two owning files
then passed all 20 tests sequentially without rerunning the unchanged 255
files. The retained witnesses cover the H Fields
reproduction, generation-time prefix cutoff, targeted-trait and Pom child
horizons, complete physical peers, no lifecycle leakage, and the application
projection of the preserved Fields maximum.

### Editor control system closure

The editor now has one explicit four-tone command hierarchy: Primary for the
local commit or forward action, Secondary for reversible support mutations,
Quiet for dismissal, navigation, history, ordering, and local-draft cleanup,
and Danger for destructive authored or project replacement. The former green
success-action path was retired, every production button has an explicit
command or specialized-surface classification, and an architecture test guards
that closure without introducing a generic button wrapper.

Identity controls that need search, candidate evidence, unassessed state, or
selected-invalid repair now consume application-owned contextual-picker
models. Compact closed parameters remain native selects, including the
Persephone level bonus and existing candidate-backed scalar controls. Stable
room-feature identities distinguish unreached unassessed declaration domains
from reached invalid selections; no new engine query, authored schema, catalog,
simulation, persistence, or semantic-command behavior was introduced.

### Test execution stability closure

The testing-policy delivery completed Gates A and B in commits `b29db68b`
(`test: unify correctness execution policy`) and `0c0fcb8f`
(`test: compare performance against repository base`). The former retired the
regular/heavy split, removed local timeout overrides and prohibited local
retries, added shared watchdogs and progress diagnostics, and made the
performance snapshot a separate raw witness. The latter added the same-host
base/candidate comparison, detached base-worktree bootstrap and cleanup,
strict percentage plus inclusive absolute regression thresholds, and explicit
report-only versus absolute performance commands.

Sequential correctness calibration was stable at each tested worker count:

```text
4 workers: 391.51 s wall time
6 workers: 276.89 s wall time
8 workers: 240.20 s wall time
```

The selected repository policy is eight workers. The calibration correctness
lane passed 254 files and 2,510 tests without worker, memory, or teardown
failures. Fixture integrity passed 3 files and 20 tests. Focused Gate A policy
and reporter tests passed 2 files and 20 tests; Gate B's comparison unit suite
passed 17 tests.

The Gate B comparison against `b29db68b` passed on the same host. Its
report-rounded values and deltas were:

| Metric                                       | Base → candidate (ms) | Delta (ms) |  Change |
| -------------------------------------------- | --------------------: | ---------: | ------: |
| `underworld.fullRebuildMs`                   |   1,494.52 → 1,293.29 |    -201.22 | -13.46% |
| `underworld.coldCandidateProjectionMs`       |           0.55 → 0.49 |      -0.06 | -11.75% |
| `underworld.representativeEditPublicationMs` |       175.01 → 167.17 |      -7.85 |  -4.48% |
| `underworld.cachedUndoPublicationMs`         |           0.19 → 0.07 |      -0.12 | -64.47% |
| `surface.fullRebuildMs`                      |   1,387.67 → 1,251.91 |    -135.77 |  -9.78% |
| `surface.coldCandidateProjectionMs`          |           0.70 → 0.51 |      -0.19 | -27.49% |
| `surface.representativeEditPublicationMs`    |         70.18 → 66.28 |      -3.90 |  -5.56% |
| `surface.cachedUndoPublicationMs`            |           0.04 → 0.04 |      +0.00 |  +0.62% |

Relative verdict: PASS.

The single final `npm run check` passed on 2026-08-27 after independent Gate C
review remediation: workspace, catalog, engine, and fixture typechecks;
fixture integrity at 3 files/20 tests; the unified correctness lane at 254
files/2,524 tests in 225.84 seconds; the 17-test comparison unit suite; a
same-host relative comparison with no regression verdicts; ESLint;
repository-wide Prettier; and the production build. The closure comparison's
largest increase was 31.65 ms on Underworld representative-edit publication,
which exceeded the percentage threshold but remained below the required
100 ms absolute increase. The build retained only the existing greater-than-
500-kB application chunk advisory.

### Single-route project closure

The single-route project delivery completed Gate A in commit `bb009caa`
(`feat(planner): make projects single-route`). Schema 73 now stores exactly
one selected catalog route per document. Engine evaluation, candidates,
findings, structured workspace projection, and application history are
singular through that route; a fresh or blocked-recovery application remains
in a no-project state until the user selects a route or successfully loads a
profile. The catalog still supplies the available route choices and the route
qualified semantic addresses remain unchanged.

The schema boundary is intentionally narrow. The retired schema-49-through-72
linear migration chain is not supported; the standalone schema-72-to-73
splitter emits both complete route documents, copies each route subtree
without inference or mutation, and refuses silent overwrite. Canonical
checkpoint fixtures were split once and each manifest row retains only its
declared route. No Dream Dive route was introduced.

Gate A owning-lane and review remediation passed the engine and planner suites,
the focused splitter and fixture-integrity suites, workspace and fixture
typechecking, ESLint, formatting, diff checks, and the production build. Gate B
absorbed the route contract into the authored-model, simulation, architecture,
editor, and structured-workspace authorities, corrected their current schema
references, and removed the temporary plan. The single post-absorption
`npm run check` passed workspace, catalog, engine, and fixture typechecking and
fixture integrity at 3 files/22 tests. Correctness then passed 256 files and
2,639 tests before exposing five stale Gate A product-loop assertions in the
remaining three files: they still assumed immediate New replacement,
implicitly open startup projects, or retained DOM navigation after project
replacement. Those witnesses were reconciled to the single-route lifecycle,
and the focused three-file lane then passed all 21 tests, completing cumulative
correctness coverage at 259 files/2,644 tests without rerunning the unchanged
passing files. The 17-test performance policy suite and same-host comparison,
ESLint, repository-wide Prettier, and the production build all passed; the
build retained only the existing greater-than-500-kB chunk advisory. No
production behavior changed during closure remediation.

## Validation Record

Validation claims below are the executed checks retained because they establish
important closure boundaries. They are not a promise that every historical
intermediate suite was green.

- The Boss/Postboss topology correction closed on 2026-08-28 with canonical
  schema-68/catalog-0.49.0 checkpoint fixtures, a nonterminal F Postboss Pool
  witness, and I/Q Boss-only terminal witnesses. The final `npm run check`
  passed workspace and fixture typechecks, checkpoint integrity at 3 files/21
  tests, correctness at 256 files/2,543 tests, the performance unit and
  relative-comparison lanes, ESLint, repository-wide formatting, and the
  production build. Its product-loop finding witnesses assert the current
  timeline-first routing; the build retained only the existing
  greater-than-500-kB application chunk advisory.
- The schema-67 sparse Keepsake Rack closure completed on 2026-08-28 with all
  workspace and fixture typechecks; checkpoint integrity at 3 files/20 tests;
  253 unchanged correctness files at 2,525 passing tests; and the corrected
  stale schema-migration file at 1 file/6 passing tests. The complete
  correctness run's only failure was that file's obsolete schema-66 expected
  value; after its schema-67 correction, the focused file passed without
  rerunning the unchanged 253 files. The 17-test performance-comparison unit
  lane, same-host relative performance comparison, ESLint, repository-wide
  Prettier check, and production build all passed. The relative performance
  verdict was PASS; the build retained only the existing greater-than-500-kB
  application chunk advisory.
- The Chaos authoring recovery closed on 2026-08-27 with workspace, catalog,
  engine, and fixture typechecking; checkpoint integrity at 3 files/20 tests;
  the 195-file regular lane at 1,939 tests; the 57-file heavy lane at 570
  tests; ESLint; repository-wide Prettier; and production build. Closure fixed
  one catalog test's unsupported `structuredClone`, advanced all canonical
  checkpoint bytes and the manifest to schema 66, moved eleven route-scale
  test files from the five-second regular budget into the bounded heavy lane,
  and removed one stale Athena assertion that contradicted Task Force's earlier
  Spell Drop requirement. The test evidence was composed from the complete
  unaffected lane inventories plus sequential passes for the moved files; no
  redundant monolithic rerun followed those unchanged witnesses. The isolated
  performance lane measured 1.139/1.104 seconds against its one-second rebuild
  budget. The unchanged pre-authoring base measured 1.258/1.083 seconds on the
  same host, so the gate did not loosen the contract or attribute the host-level
  miss to this delivery. The build retained only the existing greater-than-
  500-kB application chunk advisory.
- The editor-control closure ran the complete repository sequence on
  2026-08-27: workspace and fixture typechecks; fixture integrity at 3 files/20
  tests; regular tests at 204 files/2,013 tests; heavy tests at 46 files/441
  tests; the isolated performance lane at 1 file/2 tests; and ESLint all
  passed. The sequence then exposed two formatting-only Gate C drifts before
  build. After formatting those files, the repository-wide Prettier check and
  production build passed without rerunning the already-green tests. The build
  retained only the existing greater-than-500-kB chunk advisory.
- The schema-48 lifecycle/Shop closure initially exposed fixture-runtime
  timeout limits; the named-checkpoint fixture correction `84db578` removed
  command-built full-route machinery and its final complete gate passed with
  three workspace typechecks, fixture integrity 6/6, regular 129 files/1,558
  tests, heavy 27 files/389 tests, lint, formatting, and production build.
- The schema-49/50 Fountain, Postboss, and Selene closure passed the complete
  repository gate after durable absorption; the retained record deliberately
  omits aggregate lane totals that the terminal wrapper did not preserve.
- The Chaos and run-impacting-trait closures passed their owning catalog,
  engine, fixture, application, typecheck, lint, formatting, and build lanes;
  the final complete repository gates passed after review remediation.
- The generated-pickup closure passed the final complete gate on 2026-08-23:
  workspace and fixture typechecking, fixture integrity 2 files/13 tests,
  regular 135 files/1,720 tests, heavy 27 files/418 tests, lint, formatting,
  and production build. The only build note was the existing greater-than-
  500-kB application chunk advisory.
- The Nemesis closure passed its final complete gate with the same repository
  quality surfaces and retained the ordinary Nemesis integration witness's
  explicit ten-second budget after a measured contention failure; assertions
  and production behavior were unchanged.
- The room-feature closure completed one authorized `npm run check` on
  2026-08-25 after documentation and review stabilization: workspace,
  catalog, engine, and fixture typechecks; fixture integrity; regular and
  heavy tests; ESLint; repository-wide Prettier; and production build all
  passed. The build retained only the existing chunk advisory.
- The repository-cleanup closure passed one final `npm run check` on the final
  2026-08-25 worktree: workspace, catalog, engine, and fixture
  typechecks; fixture integrity at 3 files/20 tests; regular tests at 150
  files/1,855 tests; heavy tests at 33 files/426 tests; the isolated performance
  lane at 1 file/2 tests; ESLint; repository-wide Prettier; and production
  build. The gate exposed and removed one stale Shrine fixture, ten dead
  references, two contention-sensitive integration timeouts, and eight tracked
  formatting drifts before closure. The performance witness now uses a
  three-sample median and an 800 ms sub-second rebuild budget for the expanded
  canonical checkpoints. The build retained only the existing greater-than-
  500-kB application chunk advisory.
- Plan 1's integrated engine boundary passed 120 files/1,397 tests after the
  final decoder and progressive-product merges. The one authorized closure
  `npm run check` passed workspace/catalog/engine/fixture typechecking,
  checkpoint integrity at 3 files/20 tests, regular tests at 185 files/1,863
  tests, and all 46 heavy-test files. The isolated Surface performance witness
  passed; Underworld measured an 811.7 ms median against the 800 ms budget. An
  unchanged-base comparison had already measured 825.4 ms, so the refactor did
  not loosen the budget or rerun Vitest to manufacture a green result. The
  short-circuited gate then exposed 223 stale split imports during standalone
  lint; one bounded deletion/import remediation cleared full ESLint, workspace
  typechecking, repository-wide Prettier, and production build without another
  test run. The build retained only the existing greater-than-500-kB application
  chunk advisory.
- Plan 2's one authorized closure `npm run check` passed on 2026-08-26:
  workspace, catalog, engine, and fixture typechecking; checkpoint integrity at
  3 files/20 tests; regular tests at 194 files/1,870 tests; heavy tests at 46
  files/430 tests; the isolated performance lane at 1 file/2 tests; ESLint;
  repository-wide Prettier; and production build. The gate exposed and removed
  four stale declarations left by the completed decompositions and one
  formatting drift in the reward chronology before the successful rerun. The
  build retained only the existing greater-than-500-kB application chunk
  advisory.
- The remaining-keepsake closure passed checkpoint integrity at 3 files/20
  tests, regular tests at 202 files/1,972 tests, heavy tests at 46 files/433
  tests, the isolated performance lane at 1 file/2 tests, workspace/catalog/
  engine/fixture typechecking, ESLint, repository-wide Prettier, and production
  build. Closure exposed and fixed a generic interaction-loader loop for a
  completed `undefined` result and reduced one P encounter witness from seven
  full route assemblies to two. The former 800 ms performance threshold also
  failed the unchanged pre-keepsake base at 853.5/824.2 ms; inactive Olympian
  pressure paths were short-circuited and the gate now enforces the stated
  sub-second contract at 1,000 ms. The build retained only the existing
  greater-than-500-kB application chunk advisory.
- The Vow of Forfeit Red Onion correction closed on 2026-08-26 with workspace,
  catalog, engine, and fixture typechecking; checkpoint integrity at 3 files/20
  tests; regular tests at 202 files/1,978 tests; heavy tests at 46 files/435
  tests; the isolated performance lane at 1 file/2 tests; ESLint;
  repository-wide Prettier; and production build. The closure gate exposed one
  stale schema-63 catalog-version migration and one existing UI interaction
  witness that measured 4.8 seconds in isolation against its five-second
  timeout; the migration was advanced and that witness received a focused
  ten-second budget without changing its assertions. The build retained only
  the existing greater-than-500-kB application chunk advisory.
- The Persephone effective-level closure reached the complete-check test
  surfaces on 2026-08-27: workspace/catalog/engine/fixture typechecking,
  checkpoint integrity at 3 files/20 tests, regular tests at 203 files/2,011
  tests, heavy tests at 46 files/438 tests, and the isolated performance lane
  at 1 file/2 tests all passed. The single `npm run check` then stopped at lint
  on an unused destructured zero-selection variable in the Persephone editor;
  that narrow defect was fixed. The parent subsequently ran standalone
  `npm run lint`, `npm run format:check`, and `npm run build`, each of which
  passed; `npm run check` itself was not rerun.
- The Hex talent-layout closure ran its one authorized `npm run check` on
  2026-08-27. Workspace, catalog, engine, and fixture typechecking passed, as
  did checkpoint integrity at 3 files/20 tests. The regular lane then completed
  205 files/2,048 tests with four failures: two stale pre-capacity fixtures, one
  stale Task Force requirement-family matrix, and one direct Hex-domain loader
  that violated the single React interaction-adapter boundary. The four owners
  were corrected without adding production fallback behavior; focused
  verification passed the affected files, including the final 19/19 Artificer
  witness, and standalone engine/planner typechecking passed. After the exposed
  lint defects were repaired, standalone ESLint, repository-wide Prettier, and
  the production build passed; the build retained only the existing
  greater-than-500-kB chunk advisory. The full test gate was not rerun.

- The room-driven offer-authoring closure ran its one authorized `npm run check`
  on 2026-08-28 after Gate A/B review: workspace, catalog, engine, and fixture
  typechecks; fixture integrity at 3 files/21 tests; correctness at 256
  files/2,549 tests; the 17-test performance unit suite and same-host relative
  comparison; ESLint; repository-wide Prettier; and production build all
  passed. The comparison remained within every configured threshold, and the
  build retained only the existing greater-than-500-kB chunk advisory.
- The Shrine-delivery chronology closure ran its one authorized `npm run check`
  on 2026-08-29. Workspace/catalog/engine/fixture typechecking and checkpoint
  integrity at 3 files/22 tests passed; correctness reached 253 passing files
  and 2,580 passing tests before five failures exposed one generic
  `afterCombat` ordinal regression plus stale schema-69 and removed-Features-tab
  assertions. The ordinal was corrected without changing Shrine's exact
  encounter-end window, and focused verification then passed the five
  Pool/Shrine chronology files at 52 tests, the six-test migration owner, and
  the 12-test Underworld product loop. The complete correctness lane was not
  rerun. Standalone performance policy tests at 17/17, the same-host eight-metric
  comparison, ESLint, repository-wide Prettier, and production build all
  passed; the build retained only the existing greater-than-500-kB chunk
  advisory.
- The reward-bag equivalence correction closed on 2026-08-30 with exact store
  entries and requirements retained while `RunProgress` declaration data
  certified the Health, Magick, Gold, and Pom multiplicities as
  future-interchangeable when coeligible. Its one `npm run check` passed all
  workspace and fixture typechecks, fixture integrity at 3 files/22 tests,
  correctness at 258 files/2,635 tests, the 17-test performance policy suite,
  ESLint, repository-wide Prettier, and the production build. The same-host
  comparison passed all eight metrics and measured full rebuild reductions of
  54% for Underworld and 82% for Surface; the build retained only the existing
  greater-than-500-kB chunk advisory.
- The trait-offer state inspector closed the missing offer-local generation
  view on 2026-08-30. The engine now publishes exact branch-correlated ordered
  rarity checks and replacement composition through the existing trait-offer
  candidate capability. The application only deduplicates equivalent complete
  states and formats values; reached Olympian and Hermes dialogs disclose the
  live draft state without adding persisted schema or a global rarity ledger.
  Its one `npm run check` passed workspace and fixture typechecking, fixture
  integrity at 3 files/22 tests, correctness at 258 files/2,640 tests, the
  17-test performance policy suite, the same-host eight-metric comparison,
  ESLint, repository-wide Prettier, and the production build. The build retained
  only the existing greater-than-500-kB chunk advisory.

Focused validation remains the normal implementation practice. A complete
`npm run check` is reserved for the declared phase closure or a shared
configuration/schema change; it is not rerun merely to create review evidence.

## Retired Delivery Scaffolding

Completed feature plans were reviewed and deleted; Git is the archive. The
former Chaos, trait-effect, trait-level/Pom, unresolved-authoring, I-biome, and
Product Polish trackers are no longer progress authorities. Unique durable
facts, where any existed, are represented above or in stable
catalog/design/audit documents; deletion does not require adding redundant
absorption prose. The repository-cleanup execution plan was deleted at closure
after its durable ownership, maintenance outcomes, and validation results were
recorded. The remaining-keepsake execution plan was likewise retired after its
catalog closure, three-contact lifecycle, Hex boundary, and validation evidence
were absorbed here and in the focused keepsake audits.
