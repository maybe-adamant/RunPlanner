# Repository Cleanup Implementation Plan

## Status

Locked for execution at `c6f7e6ff` on 2026-08-25 from clean room-features base
`be69efd3`. This document is the temporary execution contract for one bounded
cleanup phase. It is not a stable authority, must not be linked from
`README.md`, and must be deleted in the final closure gate after durable facts
have received their final disposition. Gate A was clarified during execution:
a retired plan needs added absorption prose only when it contains a unique
durable fact not already owned elsewhere.

The plan is intentionally behavior-preserving. It cleans the documentation
surface and decomposes three application-layer gravity wells whose current
responsibilities already have visible ownership seams. It does not use file
length as a mandate to split coherent declaration data or chronological engine
orchestration.

## Objective

Leave the repository easier to orient in and safer to change without altering
the authored schema, catalog, simulation, candidate behavior, editor workflow,
or compiled product.

At closure:

- `README.md` is a lean product entry point for the current schema-59 product,
  not an audit index or delivery-history dump;
- `docs/audits/README.md` owns the audit taxonomy and routes readers through
  purpose-based audit folders;
- completed temporary delivery plans are gone after their durable outcomes are
  preserved;
- the long-lived implementation plan and progress record describe the current
  frontier and durable phase outcomes instead of duplicating Git history;
- overlapping room-feature, lifecycle, editor-language, and small biome audit
  notes have one clear authority each without losing source contacts,
  uncertainties, or planner dispositions;
- occurrence presentation, occurrence projection assembly, and workspace
  interaction binding each have smaller named owners with explicit inputs and
  one deliberate composer;
- no compatibility path, forwarding-only layer, generic context object,
  service registry, or duplicate test matrix remains; and
- a fresh gravity inventory identifies the next justified cleanup frontier
  rather than allowing this phase to expand indefinitely.

## Baseline Inventory

These counts are diagnostic baselines from `be69efd3`, not acceptance quotas.
They help expose unexplained growth and confirm that superseded paths were
actually removed.

### Documentation

| Surface                      |                Baseline | Observation                                                                                                                                                             |
| ---------------------------- | ----------------------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                  |               345 lines | Still names schema 58, describes implemented features as future work, and carries an exhaustive documentation listing better owned by section indexes.                  |
| `docs/progress/`             |   9 files / 8,917 lines | Five completed feature plans and an empty polish queue remain beside two long chronological trackers.                                                                   |
| `IMPLEMENTATION_PLAN.md`     |             2,310 lines | Phases 0-8 are completed history; only Phase 9 and Phase 10 are forward-looking.                                                                                        |
| `IMPLEMENTATION_PROGRESS.md` |             3,262 lines | The current frontier is accurate, but the file also retains a large commit-by-commit narrative already owned by Git.                                                    |
| `MIGRATION_PROVENANCE.md`    |               408 lines | A durable evidence ledger with distinct value; retain it.                                                                                                               |
| `docs/audits/`               | 30 files / 12,872 lines | All audits are dumped into one flat directory; several room-feature and interaction audits overlap, while dense reward/trait audits should not be blindly concatenated. |

The completed temporary progress documents currently total 2,834 lines:

- `CHAOS_TRAITS_IMPLEMENTATION.md`;
- `TRAIT_EFFECT_INTERACTIONS_IMPLEMENTATION.md`;
- `TRAIT_LEVELS_AND_POMS.md`;
- `UNRESOLVED_REWARD_AND_TRAIT_AUTHORING_IMPLEMENTATION.md`; and
- `I_BIOME_RECONCILIATION.md`.

`PRODUCT_POLISH.md` adds another 103 lines but has no queued correctness,
presentation, or foundational work and retains a stale room-feature frontier.

### Production gravity

Production TypeScript/TSX totals approximately 135,000 lines. Thirty-six
non-test production files exceed 1,000 lines. The count alone does not make all
of them cleanup targets: explicit room, trait, and weapon declarations are
readable game data, and the simulator's chronological biome evaluator may be
more coherent as one orchestrator.

The first phase targets these application seams:

| Owner                     | Production | Primary test | Existing responsibilities                                                                                |
| ------------------------- | ---------: | -----------: | -------------------------------------------------------------------------------------------------------- |
| `OccurrenceWorkbench.tsx` |      2,755 |        3,430 | Encounter/reward controls, room actions, room features, direct/ship controls, and tab composition.       |
| `occurrence-assembly.ts`  |      3,855 |        1,641 | Reward controls, timeline/actions, room features, local occurrence presentation, and final composition.  |
| `interaction-binding.ts`  |      3,275 |        2,648 | Occurrence-local, batch, Hub, topology, route-start/takeover, reward-child, and final workspace binding. |

The following large engine files are recorded but excluded from implementation
in this phase:

| Owner                                | Lines | Disposition                                                                                                                                        |
| ------------------------------------ | ----: | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `simulation/rewards/biome.ts`        | 7,268 | Preserve its chronological coordinator until an engine-specific responsibility and data-flow audit proves complete extractable products.           |
| `simulation/rewards/processing.ts`   | 5,141 | Candidate for a later engine slice separating acquisition-site and Shop settlement, after consumer and hidden-state inventory.                     |
| `simulation/traits.ts`               | 3,373 | Candidate for a later engine slice separating history folding, offer evaluation, and level/target effects, after primary test ownership is mapped. |
| `authored-project/topology/codec.ts` | 2,497 | Candidate for a later pure-codec slice, not bundled with application cleanup.                                                                      |

## Locked Decisions

### Git is the archive

Completed temporary plans are deleted after absorption. They are not moved to
an `archive/` directory, renamed with a completed prefix, or retained through
README links. Git already preserves the exact delivery record.

The durable progress record preserves important shipped phase outcomes,
schema/catalog milestones, meaningful validation claims, and the current
frontier. It does not need to preserve every executor pass, review round, or
commit narrative.

### Evidence is retained by authority, not filename

Audit consolidation may change filenames and section layout, but it must
preserve:

- exact game-source contacts and the facts they support;
- distinctions between observed facts, derived conclusions, planner
  simplifications, and remaining uncertainties;
- known source/model discrepancies;
- the current implemented planner disposition; and
- links from every durable consumer.

No audit is deleted merely because another document covers a similar topic.
Before deletion, its distinct claims must be mapped to a surviving section.

### Audit navigation has one owner

`docs/audits/README.md` is the durable audit directory map. It explains the
folder taxonomy, gives each surviving audit a one-line question or scope, and
routes cross-cutting topics to their primary authority. It does not repeat
source evidence or planner dispositions from the audits themselves.

The root `README.md` links to that index once instead of maintaining an
audit-by-audit list. It also stops carrying delivery chronology, large feature
matrices, or detailed game-rule summaries that already have durable homes.
Its retained responsibilities are product identity and scope, current
schema/catalog status, quickstart, a compact architecture/documentation map,
and development commands.

Audit folders express reader-facing subject ownership, not package boundaries.
Moving a document changes no semantic authority. Cross-cutting documents live
under the subject of the question they primarily answer and link to adjacent
authorities rather than being copied into multiple folders.

### Line count is diagnostic

This phase adds no repository-wide `max-lines` rule and promises no arbitrary
target size. A split is accepted only when it gives a named owner explicit
inputs, a returned product, clear consumers, primary tests, and deletion of the
superseded implementation path.

Long explicit catalog declarations are out of scope. Assembly and composition
modules may remain substantial when they visibly coordinate complete products.
A chronological engine orchestrator may remain long when splitting it would
create a mutable context bag or conceal event order.

### Movement does not change behavior

Each code gate preserves public contracts, persisted schema, semantic command
vocabulary, focus behavior, findings, candidate support, rendering, and test
meaning. Any defect discovered while moving code is characterized and fixed in
a separate focused follow-up, not hidden in the refactor commit.

The phase introduces no generic `common`, `shared`, `helpers`, or `services`
directory; no dependency-injection container; no mutable service table; no
catch-all workspace context; and no compatibility barrels whose only purpose
is to preserve old internal imports.

## Included Scope

- current-state correction of `README.md` and the durable progress surface;
- retirement of completed temporary plans after absorption;
- conservative consolidation of overlapping room-feature/lifecycle audits;
- conservative consolidation of editor-language and small biome findings;
- organization of every surviving audit into a purpose-based subdirectory,
  with one audit index and repaired inbound links;
- reduction of the project README to product orientation, current status,
  quickstart, architecture/documentation entry points, and development
  commands;
- application-only decomposition of occurrence presentation;
- application-only decomposition of occurrence semantic assembly;
- application-only decomposition of interaction binding;
- focused architecture/import checks where a new boundary is mechanically
  enforceable; and
- final gravity and documentation measurements plus one phase-closure gate.

## Excluded Scope

- authored schema or codec behavior changes;
- catalog declaration, game-rule, simulator, candidate, validation, or command
  behavior changes;
- editor redesign, new controls, interaction convenience, or CSS polish;
- refactoring declaration-data files solely because they exceed 1,000 lines;
- splitting the engine reward/trait orchestrators before a separate live-code
  audit;
- merging all reward/trait audits into one mega-document;
- a permanent documentation manifest or archive directory;
- test rewrites that reduce semantic coverage; and
- unrelated dependency, build, lint, or formatting policy changes.

## Documentation Disposition

### Durable progress surface

| Current document             | Disposition                                                                                                                                                                                                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `IMPLEMENTATION_PLAN.md`     | Rewrite as the current product roadmap. Replace completed Phase 0-8 mechanics with a concise completed-phase index pointing to stable authorities and the durable progress record. Preserve and refresh Phase 9 Simulation Conformance/Game Protocol and Phase 10 Hardening as the forward plan. |
| `IMPLEMENTATION_PROGRESS.md` | Rewrite as a current snapshot plus concise durable phase closures. Preserve schema/catalog milestones, major architectural transitions, truthful complete-gate results, and current blockers/frontier. Remove executor/reviewer narration and commit-by-commit duplication.                      |
| `MIGRATION_PROVENANCE.md`    | Retain. Update only if rewritten progress links require a current description.                                                                                                                                                                                                                   |
| Five completed feature plans | Review for unique durable outcomes, add only facts not already present in stable audits/design/progress, repair inbound links, then delete. A plan with no unique durable fact requires no absorption prose.                                                                                     |
| `PRODUCT_POLISH.md`          | Remove its stale room-feature frontier and delete the empty queue. Any real future item belongs in the current roadmap, not a second queue.                                                                                                                                                      |

The rewrite must not imply live game validation where only automated planner
validation exists. Historical gate results retain dates and exact claims only
when those claims remain useful for understanding a shipped boundary.

### Room-feature and lifecycle evidence

Create one durable `ROOM_FEATURES_GAME_DATA_AUDIT.md` with clearly separated
sections for Natural Resources, Pools of Purging, Shrines of Hermes, and
Stygian Wells. Absorb the distinct evidence and implemented dispositions from:

- `NATURAL_RESOURCE_ELEMENT_GAME_DATA_AUDIT.md`;
- `PURGING_POOL_GAME_DATA_AUDIT.md`;
- `HERMES_SHRINE_DELIVERY_GAME_DATA_AUDIT.md`;
- `STYGIAN_WELL_GAME_DATA_AUDIT.md`; and
- the feature-specific portions of
  `SHOP_AND_WELL_INTERACTION_LIFECYCLE.md`.

Shared acquisition/delivery chronology stays with
`ACQUISITION_DELIVERY_AND_ROOM_SETTLEMENT.md` and room action ordering stays
with `ROOM_ACTION_ORDER_GAME_DATA_AUDIT.md`. Do not reproduce those complete
matrices inside the new feature audit; link them and retain only the
feature-specific source contacts and dispositions.

The Shop-specific remainder of `SHOP_AND_WELL_INTERACTION_LIFECYCLE.md` is
absorbed into the acquisition/delivery authority. Delete the old combined file
only after both its Shop and Well claims have surviving homes.

Map the distinct claims in `BOSS_COMPLETION_REWARD_LIFECYCLE.md` and
`FOUNTAIN_AND_POSTBOSS_INTERACTION_LIFECYCLE.md` into the room-action authority
and new room-feature audit, then delete the narrower files. Boss/postboss room
occurrences and automatic transitions remain design/model facts, while feature
availability and source evidence remain audit facts.

### Editor and small route evidence

Consolidate `CROSS_BIOME_EDITOR_UX_AUDIT.md` and
`USER_FACING_VOCABULARY_AUDIT.md` into one `EDITOR_UX_AUDIT.md`. Preserve the
distinction between domain terminology, application projection, and React
presentation; stable ownership rules remain in design authorities rather than
being copied into the audit.

Absorb the 32-line `N_SIDE_ROOM_FINDINGS.md` into the appropriate N biome and
encounter-selection authorities, repair links, and delete it.

### Audit directory taxonomy

After the consolidation gates have removed superseded documents, move every
surviving audit into this closed top-level taxonomy:

| Folder                     | Question it owns                                                                                                          | Surviving audits after consolidation                                                                                                                                                                                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rooms-and-routes/`        | Which rooms, encounters, route transitions, and room-local action sequences can occur?                                    | `ENCOUNTER_SELECTION_AND_COMPOSITION_FINDINGS.md`, `I_Q_WORLD_SHOP_PHASE_GAME_DATA_AUDIT.md`, `ROOM_ACTION_ORDER_GAME_DATA_AUDIT.md`, `ROUTE_DETOUR_FINDINGS.md`                                                                                                                                                 |
| `rewards-and-acquisition/` | Which rewards can appear, how are they authored, and how do acquisition, delivery, fallback, and settlement work?         | `ACQUISITION_DELIVERY_AND_ROOM_SETTLEMENT.md`, `AUTHORED_REWARD_AND_TRAIT_DEFAULTS_AUDIT.md`, `FIELDS_OPTIONAL_REWARDS_AND_ARTIFICER_GAME_DATA_AUDIT.md`, `REWARD_GAME_DATA_AUDIT.md`, `RUNTIME_OFFER_FALLBACK_AUDIT.md`                                                                                         |
| `traits/`                  | Which trait pools, offer rules, rarity transitions, and run-impacting trait effects are supported?                        | `ALL_TOGETHER_AND_SHOP_TRAITS_GAME_DATA_AUDIT.md`, `BOON_RARITY_LEDGER_GAME_DATA_AUDIT.md`, `CHAOS_TRAIT_GAME_DATA_AUDIT.md`, `RUN_IMPACTING_TRAIT_EFFECTS_GAME_DATA_AUDIT.md`, `SELENE_SPELL_GAME_DATA_AUDIT.md`, `TRAIT_OFFER_COMPOSITION_AND_FEAR_PRESSURE_AUDIT.md`, `TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md` |
| `loadout-and-progression/` | Which Arcana, Fear, keepsake, and starting-loadout facts affect the modeled run?                                          | `ARCANA_AND_FEAR_GAME_DATA_AUDIT.md`, `CHERISHED_HEIRLOOM_KEEPSAKE_AUDIT.md`, `ECHO_GIFT_GIFT_GIFT_KEEPSAKE_AUDIT.md`, `KEEPSAKE_GAME_DATA_AUDIT.md`                                                                                                                                                             |
| `room-features/`           | Which optional or automatic room features exist, where can they occur, and what simulation-relevant effects do they have? | consolidated `ROOM_FEATURES_GAME_DATA_AUDIT.md`                                                                                                                                                                                                                                                                  |
| `editor/`                  | Which user-facing vocabulary and cross-biome presentation conclusions are source-backed?                                  | consolidated `EDITOR_UX_AUDIT.md`                                                                                                                                                                                                                                                                                |

This mapping is the expected final state, not a license to force a document
into the wrong subject. If claim-level consolidation reveals that a listed
audit primarily answers another question, Gate D may change one destination
with a written disposition. It may not add generic `misc`, `other`, or
`archive` folders.

`docs/audits/README.md` contains:

1. the purpose of source audits and their distinction from design authorities
   and temporary implementation plans;
2. the six-folder taxonomy and a one-sentence routing rule for each folder;
3. a concise link and one-line scope for every surviving audit;
4. guidance for cross-cutting topics: choose one primary audit and link to
   adjacent evidence instead of duplicating the fact matrix; and
5. the rule that unsettled facts remain explicit in an audit rather than
   becoming permissive production values.

Do not add a second permanent manifest, generated index, or per-folder README
set. The single audit index and the filesystem layout are enough.

### Reward and trait audits

Do not consolidate these by length. `TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md`,
`TRAIT_OFFER_COMPOSITION_AND_FEAR_PRESSURE_AUDIT.md`,
`AUTHORED_REWARD_AND_TRAIT_DEFAULTS_AUDIT.md`,
`ALL_TOGETHER_AND_SHOP_TRAITS_GAME_DATA_AUDIT.md`, and
`RUN_IMPACTING_TRAIT_EFFECTS_GAME_DATA_AUDIT.md` answer related but not
identical questions.

During closure, record only concrete duplicate-authority findings. A future
trait/reward consolidation gets its own source-to-disposition map if the live
documents still force readers to consult parallel authorities. This cleanup
phase must not create a 2,000-line trait mega-audit simply to reduce file count.

## Code Ownership Target

### Occurrence presentation

`OccurrenceWorkbench.tsx` remains the top-level occurrence tab composer. Move
complete presentation owners into its immediate feature neighborhood:

- encounter and local reward controls, including visits, encounter phases,
  Fields wheels, World Shop, and ship/direct room controls;
- room-action and room-timeline presentation;
- room-feature presentation, including exits, Chaos/Anomaly/Nemesis,
  resources, Pool, Shrine, and Well; and
- the existing tab/shell composition.

Each child consumes the already-projected presentation contract and complete
bound intents. It must not derive room legality, lifecycle order, candidate
policy, or semantic commands. Split the current test matrix by the same
presentation owner; retain only representative composition witnesses in the
parent test.

### Occurrence semantic assembly

`occurrence-assembly.ts` remains the supported composer of occurrence
presentation products. Extract complete assembly owners in its immediate
neighborhood for:

- reward/local-room controls;
- room actions and timeline;
- room features; and
- final room-local occurrence presentation.

Inputs are the existing authored source, matching evaluation products,
catalog/query capabilities, and already-owned application dependencies. Each
extraction returns its complete immutable presentation product. No module may
stash facts in initialization order, a sidecar map, or a shared mutable
builder. Tests move with the primary product matrix; the composer test retains
contact, ordering, and omission witnesses.

### Workspace interaction binding

`interaction-binding.ts` remains the deliberate supported composer/export
surface for the bound workspace. Extract named binders for the responsibility
groups already present in the live file:

- occurrence-local interactions;
- batch interactions;
- Hub interactions;
- topology, route-start, and takeover interactions; and
- reward/trait/level child interactions.

The central binder supplies explicit narrow capabilities and returns the
complete bound interaction catalog. The split must not create command policy
inside React, reconstruct semantic commands from presentation state, allocate
domain identities outside the existing owner, or duplicate the exhaustive
binding matrix. Primary tests follow the binder that owns each matrix; the
composer retains representative cross-owner closure and focus witnesses.

## Delivery Gates

Every gate starts from the preceding committed gate, inventories any user work,
and uses a fresh executor and fresh independent reviewer under the repository's
multi-agent routine. The reviewer is read-only. The main session owns plan
interpretation, finding disposition, holistic diff review, and Git operations.

### Gate A — Durable progress retirement

Deliverables:

1. Rewrite the durable implementation roadmap around the current frontier.
2. Rewrite the durable progress record around current status and concise phase
   closures.
3. Review and delete completed temporary plans and the empty polish queue,
   carrying forward only unique durable facts not already owned elsewhere.
4. Remove or redirect any root README link whose target is retired in this
   gate; the full lean-README rewrite remains Gate D after audit destinations
   are stable.
5. Retain migration provenance and every still-useful historical validation
   claim without presenting it as current or live-game evidence.

Audit against: all progress documents, current schema/catalog constants, Git
history, the README's progress links, and the implemented room-feature surface.

Verification: link/path search, schema/frontier search, Markdown formatting,
and `git diff --check`. No test suite is required for a documentation-only
gate.

Intended commit: `docs(project): retire completed delivery scaffolding`

### Gate B — Room-feature and lifecycle audit consolidation

Deliverables:

1. Build a claim-level source/disposition map before deleting any input audit.
2. Create the consolidated room-feature audit.
3. Absorb boss/postboss and shared interaction chronology into their correct
   surviving authorities without duplicating full lifecycle matrices.
4. Rewrite every inbound durable link and delete only fully absorbed files.

Audit against: all named source audits, room-action and acquisition/delivery
authorities, current schema-59 declarations/engine contacts, and the
room-features closure record.

Verification: old-filename reference closure, exact source-contact spot checks,
Markdown formatting, and `git diff --check`.

Intended commit: `docs(audits): consolidate room feature evidence`

### Gate C — Editor and route audit consolidation

Deliverables:

1. Create the consolidated editor UX audit without turning it into a second
   architecture document.
2. Absorb N side-room findings into their owning biome/encounter authorities.
3. Rewrite inbound links and delete fully absorbed source files.
4. Review reward/trait audit overlap and record only actionable future
   consolidation, with no speculative mega-merge.

Audit against: editor/workspace design authorities, N biome rules,
encounter-selection audit, and README map.

Verification: old-filename reference closure, Markdown formatting, and
`git diff --check`.

Intended commit: `docs(audits): consolidate editor and route findings`

### Gate D — Audit taxonomy and lean project README

Deliverables:

1. Create the six audit subdirectories and move every surviving audit according
   to the locked taxonomy.
2. Create `docs/audits/README.md` as the single durable audit map, with one-line
   scopes and cross-cutting routing guidance.
3. Rewrite all repository Markdown links and source comments that reference
   moved audit paths.
4. Reduce the root README to its retained entry-point responsibilities and
   replace the exhaustive audit list with one link to the audit index.
5. Correct the README's schema-59 status and remove stale future-feature and
   delivery-history prose while preserving quickstart and useful development
   commands.

Acceptance:

- every surviving audit is present exactly once under one subject folder;
- no flat audit file remains beside `docs/audits/README.md`;
- no old audit path or deleted progress filename has an inbound reference;
- the audit index describes where a reader should look without copying source
  facts or planner dispositions;
- the root README is usable as a product entry point without becoming a second
  audit index or progress ledger; and
- no generic, miscellaneous, archive, or package-shaped audit folder exists.

Audit against: every surviving audit, all Markdown/source inbound references,
the README documentation map, current schema/catalog constants, and current
package scripts.

Verification: an exact audit file inventory, old-path reference closure,
Markdown link/path checks, Markdown formatting, and `git diff --check`. No test
suite is required for this documentation-only movement gate.

Intended commit: `docs(audits): organize durable evidence by subject`

### Gate E — Occurrence presentation decomposition

Deliverables:

1. Move the encounter/reward, room-action, and room-feature presentation owners
   into named immediate-neighborhood modules.
2. Keep `OccurrenceWorkbench.tsx` as the clear tab/shell composer.
3. Split the primary React test matrix along the same ownership boundaries.
4. Remove superseded component/helper definitions in the same gate.

Acceptance:

- rendered behavior, labels, focus, disclosure, and bound-intent calls are
  unchanged;
- React consumes supported presentation products and contains no new domain
  policy or command construction;
- there is one implementation path for each moved component; and
- production growth is limited to imports and explicit component interfaces,
  with any net growth explained in review.

Narrow validation: focused occurrence-workbench UI tests, `npm run test:ui`,
`npm run typecheck`, ESLint on changed TypeScript/TSX files,
`npx prettier --check` on changed files, and `git diff --check`. Use
`npm run test:changed` if the configured selector covers the complete moved
test neighborhood.

Intended commit: `refactor(planner): split occurrence presentation ownership`

### Gate F — Occurrence assembly decomposition

Deliverables:

1. Extract reward/local-room, room-action/timeline, and room-feature assembly as
   complete immutable products.
2. Keep one occurrence assembly composer and deliberate supported surface.
3. Move primary policy/product tests with their owner and keep representative
   composition witnesses.
4. Remove the superseded inline assembly paths in the same gate.

Acceptance:

- application projection remains authored-first and uses the matching
  evaluation assembly;
- no semantic policy moves from the engine/catalog into the application;
- no hidden registration, sidecar semantic state, catch-all context, or
  forwarding-only module is introduced;
- public presentation contracts and React consumers remain unchanged; and
- every extracted owner has explicit inputs and a complete returned product.

Narrow validation: occurrence-assembly tests, `npm run test:planner`,
`npm run typecheck`, architecture/import checks, ESLint and Prettier on changed
files, and `git diff --check`.

Intended commit: `refactor(planner): split occurrence projection assembly`

### Gate G — Workspace interaction-binding decomposition

Deliverables:

1. Extract the existing occurrence, batch, Hub, topology/start/takeover, and
   reward-child binding groups.
2. Keep one deliberate workspace-binding composer/export surface.
3. Move each exhaustive binding matrix to one primary test owner and retain
   representative composer closure/focus witnesses.
4. Delete all superseded inline binder paths in the same gate.

Acceptance:

- every effective edit still dispatches the same complete semantic intent and
  history transition;
- allocation, focus, closure, and command-variant decisions stay with their
  existing authority;
- no binder becomes a dependency bag or generic service registry;
- application import direction remains valid; and
- there is one path from supported interaction product to Redux dispatch.

Narrow validation: interaction-binding tests, `npm run test:planner`,
`npm run typecheck`, architecture/import checks, ESLint and Prettier on changed
files, and `git diff --check`.

Intended commit: `refactor(planner): split workspace interaction binding`

### Gate H — Reassessment and closure

Deliverables:

1. Recount documentation and production gravity and compare it with this
   baseline as diagnostic evidence.
2. Review the final application path end to end for contract fidelity, import
   direction, hidden state, duplicate paths, test ownership, and unexplained
   production growth.
3. Update durable architecture/progress/README text only where the refactor
   changed an ownership description; do not narrate temporary gate mechanics.
4. Record an evidence-backed next frontier. If engine or codec cleanup is still
   justified, write a new, separately reviewable plan grounded in their live
   producer/consumer and hidden-state inventory; do not implement it here.
5. Delete this temporary plan.

Run one complete `npm run check` after all narrow tests and review fixes are
stable. Record its truthful result in the durable progress history. Do not run
the complete gate merely to generate evidence earlier in the phase.

Intended commit: `docs(project): close repository cleanup phase`

## Review Questions

Every gate review must answer the questions relevant to its scope:

1. Did the gate move one complete responsibility, its consumers, and its
   primary tests, or merely add a wrapper?
2. Is any old implementation path, old filename reference, copied matrix, or
   compatibility layer still live?
3. Did an explicit input or returned product become a generic context object or
   hidden side channel?
4. Did application code acquire catalog, simulation, lifecycle, candidate,
   finding, topology-repair, or command-selection policy?
5. Did React start constructing semantic commands or inspecting authored state
   to reproduce a projection?
6. Were source facts, uncertainties, discrepancies, or implementation
   dispositions lost during documentation consolidation?
7. Does a retained long file still have one coherent authority, or is its
   continued size hiding a concrete mixed responsibility?
8. Is any net production or test growth necessary for an enforceable boundary,
   and is that reason visible in the diff?
9. Are test matrices owned once, with only representative witnesses at facade
   and product boundaries?
10. Does the gate remain behavior-preserving and inside this phase's explicit
    exclusions?

An executor or reviewer stops when the live code contradicts this contract or
when a material ownership choice remains unsettled. The main session amends the
plan or narrows the gate; an agent must not broaden the refactor to make an
acceptance row pass.

## Closure Definition

This cleanup phase is complete only when:

- Gates A-G are committed as coherent vertical slices;
- every accepted review finding has one documented disposition;
- README and durable progress are current;
- deleted audit and progress filenames have no inbound references;
- each decomposed application owner has one supported path and one primary
  test owner;
- the final bird's-eye diff review finds no semantic change, hidden state,
  parallel path, generic dependency bag, or unexplained production growth;
- the one final `npm run check` passes and its exact result is recorded; and
- this temporary plan is deleted in Gate H.
