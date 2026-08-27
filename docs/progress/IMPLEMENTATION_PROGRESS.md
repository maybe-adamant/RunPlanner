# Implementation Progress

## Purpose

This is the concise factual delivery record for
[`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md). Stable game facts,
ownership rules, and modeling decisions belong in the catalog, design, biome,
and audit authorities. Git preserves the complete commit and review history;
this file keeps only milestones, durable transitions, validation claims, and
the active frontier needed to orient the next delivery.

## Current Snapshot

The current persisted contract is strict authored schema 65 with catalog
`0.48.0-hex-talent-layouts`. The browser product supports all eight route biomes:

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
events, automatic Boss/Postboss occurrences, Resources, Pools of Purging,
Hermes Shrines, and Stygian Wells. The engine models supported possibility,
not probability; unresolved and context-invalid authored state remains visible
and repairable.

The Phase 8 permission-minimal Tauri 2 Windows preview is complete. The game
module remains a later declarative consumer and runtime auditor, not a second
planner or simulator.

## Active Frontier and Blockers

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

| Contract milestone | Durable outcome                                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema 1           | Initial strict `ProjectDocument`, F/G route spine, semantic addresses, authored occurrence identity, and JSON boundary.                      |
| Schema 2           | Batch-owned reward stores and the first connected reward authority; the pre-release leaf-store model was rejected.                           |
| Schema 3           | Global biome declarations, route placement, shared layout vocabulary, and dormant cross-biome declaration isolation.                         |
| Schema 7           | I's authored Entrance, generated Story peer, and explicit bounded non-goal roll.                                                             |
| Schema 8           | Batch authoring defaults and strict replacement of the prior latent-default contract.                                                        |
| Schema 9           | Unified biome decisions, common exits/batches, and the application capability boundary.                                                      |
| Schema 11          | Exact authored Shop purchase order replaced the purchased-set contract.                                                                      |
| Schema 20          | Canonical acquisition settlement across ordinary rewards, O wheels, Fields, N rooms, and Shops.                                              |
| Schema 30          | Keepsake identity/equip chronology and supported-rank effect transitions.                                                                    |
| Schema 35          | Echo's complete player-rarityless provider and replay child products.                                                                        |
| Schemas 36-38      | All Together, Infernal Contract, Travel Deal, Gold, Shop-trait effects, and one acquisition chronology.                                      |
| Schemas 39-41      | Narcissus pickups, Fields cage/optional chronology, Artificer conversion, and source-owned replacement acquisition.                          |
| Schemas 42-43      | Unresolved-or-complete authored rewards and encounter-owned trait offers, with strict retained invalidity.                                   |
| Schemas 44-45      | Atomic direct selected-trait outcomes and generated-pickup ownership for Reward Reward Reward/Boon Boon Boon.                                |
| Schema 47          | The occurrence-owned Room Action order absorbed the prior acquisition chronology.                                                            |
| Schema 48          | Required Room Action defaults, explicit Shop/optional participation, fixture-integrity checkpoint corpus, and no private purchase order.     |
| Schema 49          | Fountain/Postboss completion lifecycle, required fountain use, optional keepsake rack, and derived `bossDefeated`.                           |
| Schema 50          | Selene's rarityless spells, Spell Drop lifecycle, equipped-slot ledger, and Echo replay correction.                                          |
| Schema 51          | Chaos Trial Upgrade paired traits, closed curse/blessing pools, and maturation effects.                                                      |
| Schema 52          | Natural Selection, King's/Queen's Ransom, Steady Growth, shared Hephaestus cooldown limits, and retained offer history.                      |
| Schema 53          | Nemesis combat/random-event authoring and generated-pickup settlement.                                                                       |
| Schemas 54-59      | Runtime fallback policy, automatic Boss/Postboss occurrences, Resources, Pools, Hermes Shrines, and Stygian Wells.                           |
| Schemas 60-63      | Aromatic Phial fountain rarity, Crystal Figurine Boss activation, Concave Stone residual boons, and Transcendent Embryo transformations.     |
| Schema 64          | Optional frozen Aspect of Persephone offer contributions, chronological Premium Service range expansion, and derived effective trait levels. |
| Schema 65          | Frozen selected-Hex layouts and high-value identities, finite Path capacity, latched Talent Drop closure, and persistent God Sent extension. |

Catalog versions advanced alongside these boundaries. The current catalog is
`0.48.0-hex-talent-layouts`; exact declaration facts and source contacts
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
effects alter the run. `BlockOfferIfPreviouslyPicked` history survives later
trait removal. Artificer replacements, Narcissus, Echo, Quick Buck, Buried
Treasure, and Sea Star use source-scoped generated-pickup products without a
generic clone tree, second chronology, timer model, or resource ledger.

### Room-feature closure

The room-feature phase is complete from locked plan `74f70a7f`. It replaced
general authored Death Defiance conditions with declaration-owned one-step
runtime fallbacks, retained Gorgon's phase-local trigger, made Boss/Postboss
automatic occurrences, and added selected-success Resources, F/G/H Pools,
Hermes Shrines, and Stygian Wells. Four manifest-backed checkpoints remain the
representative full-lane witnesses:

- `surface-n-resources` — selected resource timing and side-room placement;
- `underworld-f-pool` — stacked-trait removal and retained prior-pick history;
- `surface-no-hermes-shrine-delivery` — rushed and delayed Shrine delivery;
- `underworld-f-stygian-well` — Travel Deal refill and consequential Well effects.

Pools and Wells alone allow runtime-random inventory at Interact. World Shops
and Shrines author every visible inventory identity.

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

## Validation Record

Validation claims below are the executed checks retained because they establish
important closure boundaries. They are not a promise that every historical
intermediate suite was green.

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
