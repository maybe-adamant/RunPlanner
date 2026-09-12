# Engine structure cleanup

Status: A–C complete and independently reviewed; D pending.
Production baseline: `85c7a875`.

## Objective and invariants

Make the remaining engine change neighborhoods easier to navigate without
changing authored documents, simulation results, candidate policy, findings,
execution bytes, or editor behavior. This is structural cleanup, not a new
game model. No catalog, schema, protocol, or UI feature changes are included.

Evidence is recorded in `docs/investigations/ENGINE_STRUCTURE_AND_BOUNDARIES.md`.
Authorities are ARCHITECTURE's Code Placement, Product Construction and
Reorganization Contract; AUTHORED_PROJECT_MODEL's Commands and Persistence;
SIMULATION_AND_VALIDATION's Ordered State-Flow Ownership; and
CANDIDATE_EVALUATION_MODEL's exact-context contract.

Keep atomic command reconciliation, lifecycle execution, history folding,
reward chronology, structural topology decoding and exact candidate capture
intact. Their chronological order is a responsibility, not decomposition debt.
Progressive owner location and execution transaction dispatch are review-against
boundaries, not extraction deliverables. No new registries, compatibility
forwarders, convenience barrels, generic contexts, or intermediate destinations.

## A — Authored neighborhoods (mechanical commit)

Move these existing files with every import/export consumer, preserving bodies:

- `authored-project/acquisition/`: acquisition-entry, acquisition-sources,
  reward-state, artificer, pickup-producers, sea-star (retain basenames).
- `authored-project/commands/acquisition/`: acquisition-site,
  acquisition-conversion, reward-source, sea-star.
- `authored-project/commands/occurrence/`: occurrence becomes `dispatch.ts`;
  occurrence-encounter, -fields, -incoming-reward, -leaf-value, -local-reward,
  -mutation, -ship and -shop lose the occurrence prefix.
- `authored-project/traits/`: traits becomes `state.ts`,
  trait-carrier-children becomes `carrier-children.ts`, hex-tree retains its name.
- `authored-project/room-state/decoding/`: move existing specialized `*-codec`
  siblings (not the room-state codec coordinator), plus topology's well-codec,
  acquisition-site-codec and room-action-codec. Retain basenames.

Root keepsake-equip-codec remains shared with loadout; fountain-rarity-codec
also stays put rather than creating a one-file feature group. Topology's
occurrence-codec retains complete attachment and closure. Do not extract its
private feature decoders in this move-only slice. Root contracts, commands'
atomic dispatcher, replacement and detour commands stay where they are.

Public package export names and supported import paths remain unchanged.
Tests retain current locations and assertions; only direct internal imports
change. Primary verification: authored-project tests, engine TypeScript and
runtime-import architecture test. One-off import-resolved body comparison
must establish that this slice changed paths, not implementation.

## B — Finish directory grouping (mechanical commit)

The user-approved final directory review is recorded in
`docs/investigations/ENGINE_SOURCE_DIRECTORY_MAP.md`. Finish five authored
placements alongside the simulation moves, preserving complete file bodies:

- Move room-state/all-together, echo-last-run, encounters and
  encounter-trait-offers into room-state/decoding as all-together-codec,
  echo-last-run-codec, encounter-state-codec and encounter-trait-offer-codec.
  Keep encounter-envelope as shared binding policy. The trait-offer decoder's
  legalTraitOfferEncounterKeys helper remains with its sole decoder consumer.
- Move commands/fields-spatial into commands/occurrence/fields-spatial.

- `simulation/evaluation/`: project, biome-evaluation,
  project-evaluation-assembly, evaluation-products, candidate-artifacts.
- Move authoring-boundary and authoring-readiness into existing progressive.
  Keep completeness and finding-regions at simulation root: shared products
  do not become composition merely because composition consumes them.
- Move candidate trait-offer into `candidates/trait-offer/query.ts`;
  trait-offer-capability, -availability and -selected-effects into that existing
  directory without the prefix. Keep echo-draft and public candidate surface.
- Move rewards/trait-settlement into its existing directory as coordinator.
  Keep run-state and run-state-conformance together at their current root;
  two adjacent files do not require another folder.

Preserve the exact assembly token/attestation and complete candidate artifacts.
No new evaluation stage. Verify engine TypeScript, candidate/progressive tests,
representative project and execution assembly tests, authored decoder and Fields
command tests, and runtime-import graph.
Use the same one-off mechanical comparison as A.

## C — Room materialization (extraction commit)

Use the existing `MaterializedRoomLeaf` boundary in materialization/rooms.ts.
Final neighborhood is `materialization/rooms/`: common occurrence assembly in
`assemble.ts`, leaf contract and closed template construction in `templates.ts`.
Only separate Fields/Ship/Shop templates further if they form complete leaf
producers with explicit inputs; no per-template tiny modules.

Template construction returns the complete existing leaf. Common assembly
continues to own features, acquisition sites, action roster and required-action
scheduling in the same order. No additional passes, refolds or cache changes.
Remove old rooms.ts and update consumers in the same slice.

Preserve the separately consumed `materializeShipCombatState` export as well
as common room assembly; reward authoring consumes that product directly.
Before editing, pin the concrete exports/consumers and materialization test
paths in the executor packet. Existing room-state assembly, materialization,
lifecycle and Hub/Ship/Fields witnesses own behavior; add tests only for an
uncovered real boundary, not to prove a historical filename disappeared.

## D — Generation ownership (extraction commit and closure)

Separate shared context/candidate assessment currently exported from
generation/normal-targets.ts into `generation/target-policy.ts`. Separate its
Chaos/Contract additional-exit assessment into `generation/additional-exits.ts`.
Keep ordinary and first-target/takeover orchestration visibly distinct.

The extraction moves existing complete helper products; it must not invent a
generation service or bundle the whole mutable evaluator into a context.
Before implementation, inventory helper dependencies, exact consumer imports,
and call counts in the focused packet. If a proposed helper cannot move without
policy duplication or a circular dependency, leave it with its authority and
record the narrower disposition. No semantic simplification of staged pools,
peer exclusion, takeover pressure or exact reward checkpoints is authorized.

Primary tests: existing normal-target, takeover, Hub, Fields and reward-history
generation witnesses. Review progressive repair and execution publication as
consumers without reproducing their policy matrices.

## Delivery and acceptance

A verification: repository typecheck passed; engine tests passed (143 files,
1,861 tests); runtime import-graph tests passed (2 tests); touched ESLint,
Prettier and diff checks passed. Independent review reported no findings.
A one-off TypeScript comparison resolved module references to baseline
identities and ignored formatting trivia/optional trailing commas: all 124
changed files matched across the 31 moves. No assertions or fixtures changed.
The complete phase gate and baseline performance comparison remain for D.

B verification: repository typecheck, 143 engine test files (1,861 tests),
2 runtime import-graph tests, touched ESLint/Prettier and diff checks passed.
Independent review reported no findings. All 96 changed TypeScript files matched
the baseline after module-identity normalization across the 17 moves; no
assertions, public export names or fixtures changed. Directory grouping is done;
the remaining slices are bounded ownership extractions, not more folder cleanup.

C verification: repository typecheck and 10 focused correctness files (135
tests, including the runtime import graph) passed; touched lint, formatting and
diff checks passed. Independent review found two stale imports, removed and
verified in a bounded remediation. One-off comparison preserved all 31 original
declarations' bodies/contracts and the closed template map. Only the trivial
local throwing helper is present in both files. No fixtures or semantics changed.
Common assembly and the separately consumed Ship state product retain their
previous order and consumers; no additional processing pass was introduced.

Each slice is a complete reviewed commit; A/B never mix behavior changes with
movement. Main owns docs, Git and broad verification; one executor owns source
and affected test imports. Use focused Terra-high execution, reuse for adjacent
remediation, and fresh independent review after each stabilized slice. Packets
name exact files/symbols and suites, so agents need not rediscover the engine.

No fixture regeneration is expected. Preserve test ownership and assertions;
package APIs, function bodies (for moves), closed dispatch coverage and import
resolution are the mechanical audit. Any discovered defect is characterized
and deferred to a separate fix, not silently corrected here.

At final closure run one complete `npm run check` and the established
eight-operation performance comparison against `85c7a875`. Do not introduce
new budgets or repeat the complete gate for each movement. Record truthful
results before retiring this plan and its investigation. Promote only concise
durable ownership facts to existing design documents. Leave the unrelated
postboss plan untouched.
