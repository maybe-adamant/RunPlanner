# Test-suite redundancy and cost inventory

Status: investigation; no test deletions or implementation authorized here.
Inspected baseline: `7dea8cfe`, September 26, 2026.

## Question and scope

Can the suite become smaller and cheaper without losing distinct regression
coverage? Count is diagnostic, not a reduction target. A test is redundant only
when another retained witness protects the same failure at the same boundary.

This pass inventories all test-file neighborhoods and the latest full-run timing
output, then reads selected high-cost and heavily revised suites: execution
fixtures/compiler, encounter customization, Hub/fountain, detours, architecture,
and layout tests. A read-only Terra/high review independently inspected encounter
and architecture coverage. This is not an assertion-by-assertion review of all
3,837 tests, nor a mutation-tested deletion proposal.

## Baseline

The immediately preceding correctness run passed 354 files / 3,837 tests in
117.19 seconds with eight workers. Separate fixture-integrity checks passed
23 tests. Performance comparison, typecheck, lint, formatting, and build passed.
The full check initially stopped on formatting; formatting was corrected and
the remaining format/build steps passed separately.

| Owner       | Correctness cases | Test files on disk | Test source lines, approximately |
| ----------- | ----------------: | -----------------: | -------------------------------: |
| Catalog     |               294 |                 34 |                           10,496 |
| Engine      |             2,355 |                180 |                           98,609 |
| Application |             1,188 |                141 |                           55,395 |

The application file count includes the separate performance witness; hence
355 files on disk versus 354 in correctness. Lines exclude support files and
fixtures. Cases include parameterized expansion. These counts are not estimates
of redundant coverage. Node/script tests and migration suites are outside this
case count and were not audited in depth here.

Observed slowest correctness files:

| File                                                    | Reported duration |
| ------------------------------------------------------- | ----------------: |
| Engine `execution-plan/compiler.test.ts`                |           31.56 s |
| UI `OccurrenceEncounterWorkbench.test.tsx`              |           25.65 s |
| UI `App.interaction.test.tsx`                           |           21.31 s |
| UI `GeneratedEncounterWorkbench.test.tsx`               |           18.92 s |
| UI `BiomeWorkspace.test.tsx`                            |           18.22 s |
| UI `DecisionWorkbench.test.tsx`                         |           16.62 s |
| Engine `execution-plan/assembler.test.ts`               |           15.47 s |
| Engine `execution-plan/execution-fixture-bytes.test.ts` |           12.16 s |

These are one concurrent run's file durations, not isolated benchmarks. Their
sum is not wall time, and it cannot predict the savings from any proposal below.
Do not change worker counts, watchdogs, retries, or correctness coverage to make
these numbers smaller.

## Concrete candidates

Paths below are repository-relative; line references describe the inspected base.

### 1. Consolidate repeated execution-fixture construction — high confidence

`packages/planner-engine/test/execution-plan/compiler.test.ts:1796-1817` builds
twelve fixture projects, simulates/assembles/compiles them, compares decoded
committed fixtures with the result, and checks encode/decode round trips.
`execution-fixture-bytes.test.ts:22-35`, through
`support/execution-fixtures.ts`, rebuilds the same twelve among twenty fixtures
to compare formatted encoded bytes.

The properties are distinct: byte equality does not prove decoder fidelity.
However, the expensive producer path is repeated. Give the existing fixture lane
one per-case build product carrying the compiled plan and formatted bytes, and
retain byte equality, decoded-fixture equality, and round-trip equality there.
Remove only the displaced compiler fixture matrix. Keep targeted compiler and
malformed-wire tests. Preserve the fixture generator's formatting and write-mode
behavior; do not introduce global mutable caches or hand-authored wire fixtures.

This is the strongest concrete runtime opportunity found. Measure before/after;
the inventory does not claim a particular time saving.

### 2. Trim retired-name assertions — high confidence, modest runtime value

| Location                                                                               | Candidate trim                                                                          | Retained protection                                              |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `apps/planner/test/architecture/candidateBoundary.test.ts:98-107`                      | Literal negatives for `completeInvalidSoleOwnerSource` and `hubRegionRepairForSideRoom` | Current authority/import rules at 54-95                          |
| `packages/hades2-catalog/test/catalog/encounters.test.ts:642`                          | Absence of retired `encounterProfiles` property                                         | Positive envelope/slot closure at 644-657                        |
| Same file, 867                                                                         | Absence of `NEncountersSubRoomHeavy`                                                    | Direct `N_Sub09` → `GeneratedNSubRoom_Bigger` binding at 857-865 |
| `apps/planner/test/ui/shell/App.test.tsx:84-97`                                        | Old title/navigation strings such as `Hades II Run Director` and `Planner sections`     | Positive current shell/navigation assertions in those tests      |
| `apps/planner/test/ui/editor/biome/GeneratedEncounterWorkbench.test.tsx:352-389`       | Retired Native/budget-control wording negatives                                         | Initialize/reset/undo workflow                                   |
| `packages/planner-engine/test/authored-project/commands/route-detours.test.ts:750-757` | Type-only absence of `GenerateChaos` and `RemoveGeneratedChaos`                         | Current semantic-command and topology behavior tests             |

The last case is checked by TypeScript, not a meaningful runtime regression
test. Remove it only if those historical command spellings are no longer a
deliberately forbidden public contract; keep actual authored/generated ownership
constraints. Likewise, do not blanket-remove negative assertions: absent internal
trait names in rendered UI, forbidden imports, and illegal input rejection protect
current behavior.

`testExecutionPolicy.test.ts:172-185,210` also memorializes retired regular/heavy
script and config names. Consider dropping those exact names while retaining the
positive correctness entry point, lane-selection rules, shared watchdog settings,
and no-local-override checks. This is a small maintainability decision, not an
argument against the policy suite.

### 3. Narrow repeated UI workflows — medium confidence

`apps/planner/test/ui/editor/biome/HubMapOverview.test.tsx:17-54` runs the entire
reset/Undo/Redo/reopen workflow for both List and Map. Keep both controls' binding,
placement, disabled-state and rendered-state witnesses, but run the complete
history round trip once. Engine reset semantics remain primarily owned by
`packages/planner-engine/test/authored-project/commands/hub-actions.test.ts:145-173`.

`hub-map/HubMapTimeline.test.tsx:205-255` creates the completed handoff by clicking
through Hub Exit before testing reset. `HubCompletionHandoff.test.tsx:30-75`
already owns handoff creation/navigation/Undo. Consider preparing that handoff
through the real semantic command in the reset test, preserving reset's downstream
cleanup and restoration assertions. This trims setup, not reset coverage.

Neither is a reason to eliminate integrated UI history witnesses entirely.

### 4. Replace brittle layout evidence deliberately — assessment needed

`HubLayoutContract.test.ts:22-58` pins exact CSS declarations, pixel values, and
container-query text using a first-block string parser. Related files are
`ORewardWheelLayoutContract`, `RoomActionLayoutContract`, `BiomeRailLayoutContract`,
and `RewardLayoutContract` under `apps/planner/test/ui/editor/`.

These checks reject equivalent CSS refactors and do not establish actual browser
geometry or cascade behavior. They are cheap, so this is a reliability/maintenance
issue, not a major speed opportunity. Decide which layout properties deserve a
small real-browser geometry/visual witness and which are manual design acceptance.
Do not claim deleting these is coverage-neutral without that explicit disposition.
No browser test framework expansion is proposed by this inventory.

### 5. Reduce construction cost before deleting useful cases — profile first

The compiler suite mixes production compilation and codec tests. `planFor` at
129 simulates and assembles on every call; `fOnlyProject` at 119 constructs a
complete F/G project before slicing it. Some malformed-wire tests already clone
committed generated fixtures (for example 2288-2330); others build a fresh valid
product just to mutate one wire field (for example 2851 onward).

Where the behavior under test is solely decoding, reuse an appropriate generated
fixture and clone before mutation. Preserve real producer→consumer witnesses and
tests whose actual purpose is assembly. Profile fixture setup separately before
changing builders. Do not replace a needed upstream chronology with a Dream route
merely to shorten setup.

The 25.65-second encounter-workbench file contains NPC pickup placement, special
encounters, Ship phases, and finding navigation in addition to customization.
Its size alone does not establish duplicate coverage. Splitting files alone would
not remove work and may add imports/setup; investigate setup cost first.

## Coverage that should stay

- Encounter catalog declarations, engine eligibility/pricing, application
  projections, and UI command binding answer different questions. The inspected
  generated-encounter suites do not justify wholesale matrix deletion across lanes.
- Malformed catalog declarations and malformed authored payloads are different
  input boundaries. Keep both.
- `GeneratedEncounterWorkbench.test.tsx:195-260` versus `769-803`: the first
  invalidates a previously valid Menace count through a budget change and retains
  intent across context edits; the second directly authors an excessive count,
  repairs it, and undoes it. Similar findings do not make these duplicates.
- Same file, 156-194 versus 746-768: removing an excess enemy while retaining other
  allocations versus removing the last allocation/map are distinct branches.
  The latter could move to an application binding test only if that exact witness
  moves with it; do not simply delete it.
- Hub command order/cleanup, simulation timing/Phial settlement, export contacts,
  finding destinations, and map clicks each protect a separate boundary. Recent
  failures in retained-Hub rendering illustrate why the UI witnesses still matter.
- Detour command reanchoring, selected-spine materialization, outgoing-authoring
  status, and exact workspace destinations are not interchangeable. Retain the
  recent Zagreus witnesses rather than treating a shared input as duplicate policy.
- Candidate render purity, engine import cycles, no domain authority in React,
  and no workspace model in the engine are ongoing architecture rules. Keep them.
- Catalog exclusions for `BridgeNemesisRandomEvent` / `NemesisShopping` are audited
  domain scope, unlike absence checks for retired internal data structures.

## Recommended disposition

Start with the repeated fixture producer path and the specific retired-name
assertions. Then narrow repeated UI setup and investigate codec fixture costs.
Treat CSS checks and exact public-surface key snapshots
(`candidateBoundary.test.ts:32-52`) as explicit contract decisions, not automatic
deletions. A closed supported API may intentionally warrant an exact key set.

Before implementing each consolidation, name the distinct regression and its
surviving test. For sensitive consolidations, inject a focused deliberate defect
locally and confirm the retained witness fails, then restore the code. Do not
introduce a permanent mutation framework merely for this pass.

No percentage or test-count reduction target is supported by this evidence.
Likely benefits are fewer duplicate fixture builds, less historical coupling,
and clearer ownership—not hundreds of obviously useless tests. Remaining work is
to approve candidate dispositions and measure bounded changes; this document is
not a locked implementation plan.
