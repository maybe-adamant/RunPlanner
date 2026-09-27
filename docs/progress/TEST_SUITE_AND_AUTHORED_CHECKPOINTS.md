# Test-suite cleanup and authored checkpoint coverage

Status: Gates A–C implemented and reviewed; review findings resolved.
Gate D closure remains pending.
Base: `7dea8cfe` (September 26, 2026).

## Objective

Reduce redundant test work and historical implementation coupling while making
checked-in authored JSON collectively demonstrate the planner's major features.
Consumer tests should load a meaningful checkpoint, apply the semantic edit under
test, and assert its consequences rather than repeatedly construct unrelated
history. This is not a test-count reduction exercise.

Four workstreams define the scope:

1. **Cleanup:** retire obsolete assertions and genuinely duplicated workflows.
2. **Infrastructure/reuse:** use existing JSON and avoid repeated fixture builds.
3. **Enrichment:** author coherent saved success plans for missing major features.
4. **Checkpoint regressions:** exercise those plans through edits, persistence,
   repair and export. This ships alongside enrichment, not in a later test-only gate.

## Authorities and evidence

- `AGENTS.md`: lane ownership, testing, generated fixture discipline, orchestration,
  documentation and schema approval.
- `docs/design/ARCHITECTURE.md`, “Verify the handoff, not only the happy path”:
  current-schema frozen checkpoints, static imports, primary policy ownership.
- `docs/design/SIMULATION_AND_VALIDATION.md`: reached coverage, immutable state,
  semantic commands, exact repair capabilities and extension verification.
- `docs/design/AUTHORED_PROJECT_MODEL.md`: persisted representation and schema
  approval; domain-specific sections govern the edits made by fixture recipes.
- `docs/design/EDITOR_MODEL.md`, testing guidance: application tests prove binding
  and navigation, not duplicate domain rules.
- `docs/design/GAME_INTEGRATION_BOUNDARY.md`: publication remains a downstream
  declarative product, not authority for authored state.

Supporting inventories are
`docs/investigations/TEST_SUITE_REDUNDANCY_INVENTORY.md` and
`docs/investigations/AUTHORED_CHECKPOINT_TEST_MATRIX.md`. They contain inspected
locations, current consumers and the feature matrix. This plan owns delivery;
inventories do not authorize additional refactors.

Baseline: 354 correctness files / 3,837 tests; 29 authored checkpoints; 20
generated execution fixtures. The last correctness run took 117.19 seconds with
eight workers. That single concurrent run is diagnostic, not a performance limit
or a promised speedup. Existing dirty Chaos audit edits are outside this plan.

## Locked boundaries

- No catalog rules, simulation semantics, authored schema, protocol, app behavior,
  release CI or executor implementation changes. A discovered production defect
  is characterized and proposed separately, not hidden in fixture cleanup.
- No weaker watchdogs, more retries, reduced lane selection, new mocking of domain
  evaluation, or replacement of real history with invented simulation state.
- No target percentage or count of tests/files to remove. Similar names or inputs
  do not establish redundancy. Distinct malformed-input boundaries remain tested.
- Preserve simple shared baselines and intentional invalid/incomplete frontiers.
  Rich showcase variants do not silently replace their meaning.
- JSON demonstrates stable authored history. Commands remain the mechanism for
  the edit under test; TS rule matrices stay with their engine/catalog owners.
- Every new success checkpoint lands with its integrity registration, positive
  feature witness and representative consumer edits in the same slice.
- Preserve some full authoring journeys. Loading saved input cannot prove initial
  creation or UI interaction wiring.
- No generic feature-detection framework, shadow validator, dependency-injection
  layer, whole-project mutable cache, or browser-testing framework expansion.
- Existing encounter/trait live-acceptance trackers remain open and untouched.
  Passing these tests does not certify game runtime enforcement.

## Ownership and products

| Owner                                                                             | Work                                                                                                                |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `test/fixtures/authored-project/checkpoints/`                                     | Saved current-schema input, lazy frozen loaders, manifest/registry and central integrity/scenario witnesses         |
| `test/fixtures/authored-project/routes/`                                          | Reusable semantic-command recipes and focused variants; never an alternate decoder or simulator                     |
| Engine `test/authored-project/`, `test/simulation/`                               | Command/codec/history and complete policy matrices; exact settled-state assertions                                  |
| Engine `test/execution-plan/`                                                     | Real producer→consumer and malformed-wire witnesses; one owner for generated fixture construction/bytes/round trips |
| Application `test/projections/`, `test/state/`, `test/ui/`, `test/product-loops/` | Binding, repair navigation, persistence/history integration and representative user workflows                       |
| Catalog `test/catalog/`                                                           | Source declaration and normalization coverage; only proven obsolete assertions are trimmed                          |

New test support belongs beside its owner. Promote a recipe out of an execution
test's private support only when another lane really consumes it. Move its
consumers and remove the displaced path together; avoid forwarding barrels.

## Delivery gates and commit boundaries

### Gate A — test cleanup

Disposition: implemented against `ed74bdcb` (September 26, 2026); independent
review passed without findings. Retired-name and historical-command assertions were removed
while current closed API snapshots, positive catalog/shell/encounter contracts,
both Hub control bindings, and one complete Hub history witness remain. CSS
layout contracts remain unchanged; Menace and allocation branch witnesses
remain distinct. Focused tests (8 files / 100 tests) and `npm run typecheck`
passed.

Included:

- Review the inventory's specific retired-name assertions in candidate boundaries,
  encounter catalog tests, shell/generated-editor copy, and test-execution policy.
  Keep positive supported contracts and live architecture restrictions.
- Dispose explicitly of type-only removed-command checks and exact public API key
  snapshots; do not remove a deliberately closed interface constraint by accident.
- Narrow duplicated Hub List/Map reset history workflows and repeated handoff setup
  while preserving both UI bindings and at least one complete history witness.
- Review CSS-string layout checks. Retain meaningful checks or explicitly identify
  manual visual acceptance before retiring implementation-specific declarations.
  Do not claim equivalent automatic coverage where none exists.

Acceptance: each behavioral deletion records its protected regression and surviving
test, or its explicit obsolete-contract disposition in the gate report. Menace
direct-overrequest versus downstream invalidation and allocation-empty versus
allocation-retained cases remain distinct. No blanket negative-test removal.

Primary checks: affected catalog/architecture/UI tests and typecheck for type
assertion changes. Commit cleanup independently of fixture enrichment.

### Gate B — existing fixture reuse and execution construction

Disposition: implemented against `1fd0207f` (September 26, 2026); independent
review completed and its decoder-setup finding resolved. Equivalent Pool, placed Shrine, side-room Shrine and F-only Well
consumers load their saved checkpoints, while their central recipes remain the
provenance witnesses. The Well F/G-tail and unplaced-delivery recipe variants
remain because their states differ deliberately; raw Surface prefix loaders and
their forced-Shrine completion wrappers also remain distinct. The fixture lane
now builds each execution fixture once for bytes, decoded equality and wire
round trips; no execution JSON changed. The duplicate-Pool decoder mutation
retains its producer because no committed wire has an interacted Pool inventory;
the G-only Anomaly decoder mutation now clones saved F and Anomaly wire instead
of compiling an artificial product.
Focused tests passed: 62 compiler, 20 execution-fixture, 135 engine-consumer,
93 application-consumer and 24 checkpoint-integrity tests. Full typechecking,
changed-file lint, formatting and diff checks passed. The fixture matrix now
requires 20 producer builds rather than 32, retaining all three checks for each.
The pre-change compiler timing did not complete in the command window,
so no speedup claim is made.

Starting contacts:

- Pool/Shrine recipes in `routes/underworld.ts` and `routes/surface.ts`; their
  saved equality witnesses in `checkpoints/check.test.ts`.
- Well recipe variants and Surface `authorForcedShrines` wrappers.
- Engine `execution-plan/compiler.test.ts:1796` fixture matrix,
  `execution-fixture-bytes.test.ts`, `support/execution-fixtures.ts`.

Deliverables:

1. Replace equivalent downstream Pool and Shrine setup with saved loaders. Retain
   central command-recipe evidence and purposeful unplaced-delivery variants.
2. Compare Well default/F-G-tail states and raw/completed Surface inputs. Switch
   only equivalent consumers. Do not fabricate an authored G tail by configuring
   a new biome, or change raw-frontier consumers silently. Keep a bounded recipe
   where equivalence cannot be achieved cleanly; record that disposition.
3. Consolidate the twelve duplicated execution-fixture producer builds into the
   existing fixture lane. One per-case result must carry everything needed for
   byte comparison, decoded-fixture equality and encode/decode round trips.
   Keep all three properties, the generator path, and malformed-wire cases.
4. Use existing generated wire fixtures for decoder-only mutation tests where
   compilation is unrelated. Preserve actual assembly/producer witnesses.

Acceptance: loaded starting states remain equivalent; tests still apply the
transition they claim to test; no circular recipe attestation; no unchanged
execution JSON churn. Delete superseded repeated build paths in the same commit.

Primary checks: fixture integrity, affected engine export/command/simulation and
application consumer tests. Measure fixture-build work and affected file timing
without adding permanent production counters. Gate B can use separate commits
for authored reuse and execution-fixture consolidation.

### Gate C — enrichment and checkpoint regressions, delivered together

Each subgate is a vertical slice. First settle the exact legal scenario and name
its consumers, then generate JSON through real commands/codec, register it, and
move/add its representative tests. No fixture-only commits awaiting later tests.

#### C1 — established recipe promotions

Disposition: completed against `daf729ac` (September 26, 2026). C1 now has
saved Dream mixed-handoff; Underworld generated-composition with positive
Menace, Fangs and an H cage; one legal combined Surface P/Q encounter showcase;
Surface scheduled lifecycle; and intermediate Hub Phial checkpoints. Each uses
the manifest/registry/static loader, a non-circular recipe attestation, reached
export evidence, and a narrow semantic edit/codec reload/Undo witness. Existing
P-only and Q-only execution producers remain to preserve their distinct wire
fixtures. C2 and C3 remain pending.
Independent review remediation tightened the checkpoint witnesses to exact
addressed export and repair products, including the settled Steady Growth reset.
Verification passed: checkpoint integrity (29 tests), compiler/Hub/export fixtures
(109 tests), clocked-pickup cleanup (3 tests), and the four new checkpoint
scenarios. The final remediation reran the compiler and checkpoint scenarios
(66 tests), full typechecking and lint. Formatting and diff checks passed;
execution fixture bytes remain unchanged.

- Dream mixed-handoff: default configured Q/F/N prefix; retain the parameterized
  F-batch-order recipe for tests whose subject is reordered history.
- Underworld generated encounters: waves/highlight/budget, active Fangs and positive
  Menace, including an H cage contact from the existing composition builder.
- Surface encounter example: P variable base roll and Q boss choice; combine only
  after proving compatibility rather than stacking raw JSON fragments.
- Surface scheduled lifecycle: settled Embryo, Growth, Supply Chain and Hermes
  delivery from the existing complete route builder.
- Hub Phial: existing interleaved-fountain recipe with its actual target effect.

Use the named consumers in the fixture matrix. Extend the test manifest/registry
to Dream; its current route union and literal checkpoint count need updating.
No production route/schema work is needed. Keep existing recipe construction
witnesses bounded and separate from ordinary consumers.

#### C2 — detours, special encounters and commerce

Disposition: completed across bounded C2 slices, culminating in the final
Contract implementation against `563291ed` (September 26, 2026).
The completed bounded detour slice adds independent saved checkpoints for the
settled Spark of Ixion G Chaos route, successful G Anomaly with its ordered
infinite roster and fixed native return, and selected F/G Arachne encounters
with the explicit F cocoon count. Each has central recipe attestation, an exact
reached export witness, and a semantic edit/codec reload/Undo witness. Ordinary
equivalent engine consumers and their existing wire producers now load these
saved documents; the parameterized Anomaly recipe remains for its order-invalid
matrix. Execution fixture bytes are unchanged.

The completed bounded follow-up adds a purchased Q Anvil; a reached Fateful
Twist with selected rival Scylla performer; an acquired F World Shop Travel Deal
replacement; and an N Shrine Travel Deal acquired at its placed O Combat1
delivery. Each Travel Deal carrier remains an independent complete checkpoint
because its purchase and delivery chronology differ. It also adds the selected G
Zagreus Contract, its reached G Miniboss return, and an acquired later G Preboss
Contract `StackUpgrade` item with the selected Pom target. The partial Contract
availability helper remains a distinct frontier input. The existing Well refill
and Pool checkpoint retain their ownership.

Travel Deal follow-up verification passed: fixture integrity (4 files / 36
tests), focused assembler and authored-checkpoint scenarios (54 tests), workspace
and fixture typechecks, and full ESLint. The independent review found no remaining
actionable issue after the consumer cleanup; execution fixture bytes remain unchanged.

The Contract follow-up passed fixture integrity (4 files / 37 tests) and focused
assembler and authored-checkpoint scenarios (56 tests). Full typechecking, lint,
formatting and diff checks passed; its independent review found no actionable
findings. Execution fixture bytes remain unchanged.

Detour-slice verification: fixture integrity (32 tests), focused C2 engine consumers and
scenario witnesses (113 tests), and execution-fixture byte checks (20 tests)
passed. Workspace and fixture typechecks, full ESLint, changed-file Prettier,
and diff checks passed. The Anvil/Twist/Scylla follow-up passed fixture integrity
(34 tests), its assembler export consumer and checkpoint scenarios (52 tests),
full typechecking, lint, formatting and diff checks. The Anvil consumer now loads
the saved checkpoint; smaller Twist baselines remain distinct from the combined
Scylla scenario. Independent review is complete, with its unused-import finding
resolved.

Author a coherent Underworld success plan (or separate semantic variants where
necessary) covering settled Chaos, selected Zagreus/return and Contract item,
G Anomaly/return with roster, and cocoon customization. Include a representative
World Shop and Shrine Travel Deal acquisition, Fateful Twist and Anvil in compatible
portfolio plans; the existing Well refill and Pool checkpoint remain their owners.
Add a representative Underworld boss choice so Q alone does not stand in for the
different ordered/single-choice control families.

The outcome is collective coverage, not a demand to force every mechanism into
one route. Before authoring, assign these rows to exact plans and consumers and
check eligibility/timing with current commands and evaluation. Split only for a
real scenario/compatibility boundary. Preserve unresolved Chaos as a repair input.

#### C3 — advanced loadout, traits and Hex

Disposition: the automatic-Boss slice is implemented against `b6dce276`
(September 26, 2026) and independently reviewed. It promotes a saved F/G
checkpoint with reached Judgment and Crystal Figurine outcomes, including central
recipe attestation, exact execution witnesses, and a Figurine edit/reload/Undo
repair witness. The next Fig Leaf/Gorgon slice is implemented against `f321956c`
and independently reviewed: separate saved F/G checkpoints reach the legal Fig
Leaf skip and Epic selected Gorgon Athena child, respectively. Their semantic
edits reload to the exact addressed Fig Leaf repair and suppressed Gorgon
interaction, then Undo to the saved checkpoint. The
ordinary Hex/Path slice is implemented against `4d932a74` and independently
reviewed: a complete N/O/P/Q checkpoint installs `SpellPotionTrait` at N and
reaches a P `TalentDrop` with three invested Lung points; replacing that reward
reloads to the exact addressed unavailable-bag repair and Undo restores the
checkpoint. The next combined slice is implemented against `396291cf` and
independently reviewed: `surface-selene-hex-path` reaches six
Lung points with Aspect of Selene's installed Moon Beam; the compatible
`underworld-persephone-calling-card` combines Aspect of Persephone's positive
Apollo level contribution with Calling Card's Common-to-Rare increase; and
`surface-n-natural-selection` settles its selected eight-target child from the
engine candidate domain. Each has static loading, recipe attestation, reached
consumer evidence, and an edit/reload/Undo witness. Execution fixture bytes are
unchanged.

The combined Selene/Persephone/Natural Selection slice passed 18 authored-checkpoint
tests, 44 fixture-integrity tests, full typechecking, lint, formatting and diff
checks. Review corrections completed Natural Selection's exact repair witness,
publication eligibility, and registry bookkeeping.

Verification passed: 77 focused engine tests (including all 20 execution-fixture
byte checks), 38 fixture-integrity tests, full typechecking, lint, formatting and
diff checks. Independent review is complete; its stale private-helper import
finding was resolved. Execution fixture bytes are unchanged.

The Fig Leaf/Gorgon slice passed 59 focused execution-plan tests, 40
fixture-integrity tests, full typechecking, lint, formatting and Git diff checks.
Independent review is complete; its Fig Leaf repair witness now asserts the exact
`alreadyUsed` evaluation evidence. Execution fixture bytes remain unchanged.

The ordinary Hex/Path slice passed 16 focused checkpoint tests, 41
fixture-integrity tests, full typechecking, lint, formatting and Git diff checks.
Independent review is complete without findings. Execution fixture bytes remain
unchanged.

The final advanced-trait slice promotes `dream-h-artificer-echo`: the supplied
user-authored H Hera/Artificer prefix reaches All Together's four grants and
Concave Stone residual, then an actual Echo Last Reward MaxMana replay. Its
semantic Echo-entry edit reloads to the exact source-unavailable repair and
Undo restores the saved checkpoint. Execution fixture bytes remain unchanged.
Verification passed 41 focused execution tests (including all 20 execution-fixture
byte checks), 44 fixture-integrity tests, full typechecking, lint, formatting and
diff checks. Independent review completed; its transaction-narrowing and exact
Echo-repair-evidence findings are resolved. This completes Gate C.

The delivered portfolio covers these feature rows:

- non-base weapon/aspect with explicit positive level/rarity behavior;
- selected targeted/nested outcomes: representative All Together, Natural
  Selection success, secondary Concave Stone acquisition and Echo replay/duplicate
  mechanism; don't create one JSON per trait;
- active automatic keepsake/Arcana effects missing from the saved inputs:
  Fig Leaf, Gorgon and Figurine, with rarity-changing effects where compatible;
- Hex installation followed by actual Path acquisition; aspect Hex and Persephone
  bonus require different loadouts and must not be claimed by one saved aspect.

Use existing rule/interaction test recipes as source evidence, not synthetic
equipped-state injection. The portfolio must explicitly account for the matrix's
missing major mechanisms. If a row needs materially new modeling or cannot be
combined legally, report it for plan amendment rather than silently omit it or
expand production scope. Exhaustive trait/perk variants remain excluded.

Verified portfolio assignment:

- `underworld-automatic-boss` promotes the existing complete F/G automatic-outcome
  recipe for reached Judgment and Crystal Figurine. This reviewed first C3 slice
  remains its own starting-keepsake scenario.
- Separate `underworld-fig-leaf` and `underworld-gorgon-athena` checkpoints now
  own the actual legal F skip and the G first-combat Athena starting-keepsake,
  condition, selected child and Epic rarity. They cannot share the one
  starting-keepsake slot.
- `surface-ordinary-hex-path` owns the normal installed SpellPotion/Lung tree;
  `surface-selene-hex-path` separately owns Aspect of Selene's Moon Beam and
  reached Path allocation. The loadouts remain intentionally distinct.
- `underworld-persephone-calling-card` combines compatible loadout and
  starting-keepsake effects: Aspect of Persephone supplies the positive level
  contribution while Calling Card changes the selected Apollo rarity. It is one
  F/G checkpoint rather than two duplicate recipes.
- `surface-n-natural-selection` promotes the prior selected-trait frontier by
  authoring its child from the real candidate domain.
- `dream-h-artificer-echo` completes the supplied user-authored H prefix through
  semantic Echo and H-tail commands, retaining its reached All Together and
  Concave Stone chronology instead of reconstructing a parallel recipe.

Each candidate needs its own static checkpoint, independent provenance
(command-recipe attestation or canonical user-authored source), reached
consumer/export witness and edit/reload result before the matrix moves to
Present.

#### Acceptance shared by C1–C3

For each success checkpoint:

1. Central test loads the actual JSON; strict decode/frozen identity and canonical
   bytes remain owned by the existing integrity suite.
2. The advertised feature's owner is reached on the selected route, with concrete
   active choices—not merely a retained room, unselected option or default field.
3. Evaluation settles the advertised effect and the configured prefix is eligible
   for execution publication.
4. Export contains its meaningful nonempty choice/outcome, or a narrow evaluated
   state assertion proves a simulation-only feature. Do not invent wire fields.
5. A representative semantic edit survives encode/decode/reload and produces its
   expected result or exact repair finding. Exercise reset/Undo when meaningful.
6. Reuse a UI witness for each distinct control family, adding one only where the
   new saved-plan path exposes a gap. Do not run a complete UI journey per JSON.

Existing repair checkpoints keep expected findings rather than being forced to
export. Do not re-prove every past acquisition in each consumer. Focused command
and rule tests retain their authoritative matrices.

Primary checks per slice: central integrity/scenario tests and named consumer
tests across engine/application boundaries, then independent review. Record the
rows now covered and remaining rows after each commit.

### Gate D — closure

- Add `fixtures:checkpoints:regenerate` for recipe-backed checkpoints through
  `encodeProjectDocument`. Share the recipe mapping with equality verification;
  preserve static-import reachability and prove regeneration is byte-neutral.
  This does not migrate recipe inputs or reconstruct user-authored checkpoints:
  migrate saved inputs first when schema changes require it. Keep the existing
  reward-store repair command separate and explicitly scoped.
- Remove the hard-coded manifest count; retain exact disk/manifest/registry
  closure and duplicate-identity checks.
- Split `execution-plan/authored-checkpoints.test.ts` by domain, preserving every
  witness. Keep reached simulation assertions with their export workflows rather
  than duplicating them across lanes. Correct the ownership table: central
  checkpoint support owns integrity, engine consumers own scenario witnesses.
- Review the full diff for deleted witnesses, duplicated policy, dead recipes,
  circular construction, changed baseline meanings and fixture-only additions.
- Every agreed major-feature row is either backed by a reached success witness,
  deliberately covered as repair-only, or explicitly deferred by the owner.
- Verify no production behavior/schema/protocol change slipped into test work.
- Run one full `npm run check` after narrow checks and review fixes stabilize.
  Compare correctness timing under the same host/worker settings with a controlled
  base/candidate run if claiming a speed improvement. The normal performance
  comparison measures app operations, not test-suite throughput; report separately.
- Report removed duplicate work, new saved-feature coverage, total test/fixture
  counts and measured timings without asserting a count reduction target.
- Promote only lasting fixture ownership/usage guidance to the existing architecture
  testing section. Delete both temporary inventories and this plan at closure;
  retain verification evidence in commit history, not durable design prose.

## Fixture generation and compatibility

Authored checkpoint bytes must satisfy their existing `encodeProjectDocument`
integrity contract. Do not confuse them with execution fixtures, which use
`encodeExecutionPlan` plus repository Prettier formatting. Preserve current
static-import reachability for changed-test selection.

Only regenerate execution JSON if its semantic product actually changes. An
equivalent test refactor should not rewrite it. If new/changed execution fixtures
are needed, mirror the planner-owned bytes to the executor and verify each with
`cmp`; inventory that external worktree before touching it. No executor source
changes or deployment are included.

## Orchestration and review

Use the repository multi-agent gate routine during delivery: one write-capable
executor at a time with an exact packet, a fresh independent reviewer after the
slice stabilizes, and one bounded remediation pass. Reuse the executor for adjacent
coherent work. Main session owns scope, disposition, Git and full closure checks.

Commit this agreed plan and its supporting inventories before implementation.
Each gate must leave its affected tests runnable; no intentionally broken
intermediate schema/fixture commits are authorized. If review discovers a lost
distinct regression, retain or relocate its witness before committing.

## Pre-execution challenge outcomes

- Overlap is not duplication: keep direct Menace overrequest and later invalidation,
  both allocation-pruning branches, and command/simulation/UI ownership witnesses.
- Saved JSON does not prove all its features executed: central success witnesses
  must establish reached settlement and publication, not substring presence.
- Cheap TS setup can still justify a saved showcase: enrichment is a separate
  objective from speed. Conversely, no new JSON is needed for every cheap variant.
- Recipe equality is meaningful only when the recipe does not load its own output.
- Retained production defects or incompatible feature combinations block only the
  affected proposal; they are not permission to change domain behavior in this plan.
- CSS test retirement and public API snapshot changes require an explicit contract
  decision. Their mere brittleness does not make removal coverage-neutral.
