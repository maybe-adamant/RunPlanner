# Optional Generated Encounter Customization

## Status and delivery boundary

Locked for implementation following user approval and independent plan review.

- Planner base: `317dc863ded0ef90558b469e4d4d29251e9437a7`.
- Game-module base: `91a1c6934f8f9801d486478b2fbe312343200459`.
- The accompanying encounter audits and their index links establish the source
  baseline for this plan.
- Commit the agreed audit/plan before implementation. Do not publish or deploy
  an intermediate cross-repository contract as a completed feature.
- The user selected an explicit highlight before exact per-wave composition.
  Count-only or highlight-only overrides may leave the remaining generation
  native. Default never requires opening the editor.

## Outcome and non-goals

An existing Timeline encounter can optionally customize its wave count, shared
highlight, per-wave enemy types and requested type-budget weights through the
existing **Customize encounter** dialog. A user who never opens that dialog has
a complete native Default configuration. This is not a required outcome editor
like a trait offer.

The supported inventory is the 39 generator-family identities in the
[composition matrix](../audits/rooms-and-routes/COMBAT_ENCOUNTER_COMPOSITION_MATRIX.md):
20 ordinary/passive/phase generators, 13 primary field-NPC combats, four
Devotion encounters and two H fixed-plus-generated templates. Room scope is
biome Combat rooms plus `O_Devotion01`, not just the default Combat selection.

Keep H Treant/Screamer's fixed enemy and customize only the generated companion.
Do not customize the 52 prescribed P vignettes, Arachne cocoons, or Nemesis
noncombat events. Actual miniboss rooms, bosses, opening/biome-intro rooms,
side rooms, Anomaly and incidental challenges are outside this addition.
Existing boss customization continues unchanged. Native-only introductions and
NPC selection-weight duplicates are not new planner encounters.

Do not simulate combat, health loss, duration, enemy quantities, perks, spawn
positions, NPC assistance, Menace substitutions or Return respawns. Do not add
an encounter execution ledger, transaction lifecycle, scheduler, generic form
language or final-live-roster validator.

## Governing authorities

- [Formation audit](../audits/rooms-and-routes/ENEMY_FORMATION_AND_FEAR_VOW_GAME_DATA_AUDIT.md):
  generation, wave budgets, ordered type selection, native count allocation and
  Vow intervention order.
- [Composition matrix](../audits/rooms-and-routes/COMBAT_ENCOUNTER_COMPOSITION_MATRIX.md):
  exact supported identities, inherited policies, pools and exclusions.
- [Engine guide](../design/SIMULATION_AND_VALIDATION.md), especially chronology,
  retained authoring, findings and exact candidate context.
- [Catalog model](../design/CATALOG_MODEL.md#encounter-composition),
  [authored model](../design/AUTHORED_PROJECT_MODEL.md), and
  [lifecycle preparation](../design/ROOM_LIFECYCLE_MODEL.md#concrete-encounter-preparation).
- [Candidate model](../design/CANDIDATE_EVALUATION_MODEL.md),
  [phase workspace](../design/STRUCTURED_EDITOR_WORKSPACE.md#encounter-phase-products),
  and [integration boundary](../design/GAME_INTEGRATION_BOUNDARY.md), especially
  encounter customization and mismatch classification.

## Contract

### Optional by construction

1. Absence is native Default, not an unresolved value. Opening/closing the
   dialog does not dispatch an edit or materialize selections.
2. Default exists independently at each supported customization boundary.
   Setting wave count does not require a highlight, types or weights; setting
   types does not require weights. Unchanged waves remain native.
3. Fixed wave counts and fixed template enemies are read-only game facts, not
   mandatory authored values. Every editable override can return to Default;
   resetting the customization removes its sparse payload and is undoable.
4. Retain structurally representable choices after upstream changes. Known
   contextual incompatibility gets an ordinary repairable planner finding at
   the exact encounter launcher; it does not delete choices or auto-open the
   dialog. Default is always a repair. No finding demands optional authorship.
5. Omitted customization adds no simulation effects, candidate enumeration,
   execution obligations or extra game RNG calls.

### Wave, highlight and composition relationship

Wave count stays within the concrete encounter's native range. Fixed counts
remain fixed. A shared highlight, when the native branch uses one, occupies a
slot in every generated wave; it is not an extra type or a per-wave choice.
Type capacity is resolved from the actual declaration and preparation context,
including escalation, depth and hard context—not a universal 1/2/3 pattern.

Default interaction:

- Full per-wave composition editing requires a known wave count (declaration
  fixed or explicitly authored), and an explicit shared highlight when that
  generation branch uses one. These are local editing prerequisites, not
  required route authorship; leaving them Default leaves composition native.
- A user can author only a count or only a highlight. Default wave count never
  becomes an implicit request to spawn enough waves for a retained row.
  A highlight-only override applies if native generation activates that branch;
  a native one-wave result does not owe a highlight or a failure diagnostic.
- Returning a prerequisite to Default retains dependent authored values as
  dormant and omits them from execution; the dialog explains why they are not
  active. Returning to a concrete prerequisite restores those values for
  assessment. A known concrete change that conflicts with active authored
  composition stays visible for repair.

For an active wave, the picker confirms highlight/fixed template members before
selecting the remaining types. Completed members appear as badges. The engine exposes total and
additional type bounds, seeded identities, ordered candidate domains and precise
composition issues. Candidate availability does not create another type slot:
the engine's wave capacity limits editable positions. React does not calculate
quotas or enemy eligibility. Existing native type identities keep
normal and elite variants distinct; this is not Fangs-perk authoring.

An exact composition also fixes its type count within the native possibilities.
Where that count is random, steer the count to the authored list's size;
deterministic highlight/escalation targets and fixed templates are not relaxed.
Do not silently append native types to an allegedly exact composition or turn
this into another independent type-count control.

Validate ordered possibility against modeled preparation facts and explicit
earlier selections. Respect seeded entries, pair exclusions, elite limits, P
group pruning and cross-wave effects at their native contacts. Do not apply a
blanket final-set cap that rejects a native-valid seeded composition. Missing
native-only knowledge is not invented certainty: preceding Default rosters
remain unknown, not a new branch simulation or a guessed run blacklist.

The catalog's fully progressed, non-bounty baseline continues to own external
profile assumptions. Do not add prior-run/save inputs or new progression
overrides for this feature. A live intro/profile conflict produces a bounded
customization diagnostic and native continuation, not eligibility
reimplementation. An actual replacement of the encounter identity remains
subject to the existing identity checkpoint; customization does not exempt it.

### Weights are best-effort requests

- Weights are optional positive relative weights over an explicit generated
  composition, with bounded finite values. Default means the unchanged native
  allocation. Zero is not a back door to remove a type.
- The engine derives normalized requested shares; the UI edits relative weights.
  The user need not manually make weights sum to 100. Initializing custom
  weights is an explicit edit, not a side effect of opening the dialog.
- For all-generated waves, shares request portions of that wave's native
  difficulty budget, including the generated highlight. Fixed H template
  spawns keep their native counts and cost; they are not weighted members.
  A sole generated companion has no meaningful relative-weight control.
- Native rounding, minimum counts, caps, fixed costs, redistribution and the
  final-remainder branch determine realized quantities. Neither planner nor
  executor validates that the realized result equals the requested shares.
- Steer the allocation input; do not change enemy difficulty ratings, replace
  the complete count allocator or redistribute budgets between waves.

### Diagnostics, never customization mismatches

Failure to realize wave count, highlight, types or weights is diagnostic only.
It does not desynchronize, leave an outstanding transaction, or add a room-exit
conformance fact. Skipped/unreached combat does not owe realization.

Diagnostics identify occurrence, exact phase, concrete encounter, relevant wave,
requested override and the reason it could not apply. Observe at the actuator
boundary where practical; do not monitor every later spawn or compare achieved
percentages. Reuse the existing bounded diagnostic channel.

Native encounter identity, room routing and existing lifecycle/conformance
contracts retain their current policy; this feature does not weaken them.
Malformed protocol and missing/throwing required host functions remain admission
errors or infrastructure faults, not customization mismatches. Restore scoped
state before propagating faults; do not swallow arbitrary exceptions as native
fallback. In-game testing establishes enforcement quality.

## Ownership and existing seams

| Owner                 | Product and starting points                                                                                                                                                                                                                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalog               | Explicit composition policies and bounded enemy/pool facts with friendly labels. Extend `src/declarations/encounters/` and `src/compiler/encounters/{definitions,closure}.ts`; the engine owns the normalized contract in `catalog-schema/index.ts`. Keep family-specific normalization here, not in consumers. |
| Engine authored state | Extend the existing closed customization family and sparse `RoomEncounterState.customizationByPhase`; use `ReplaceEncounterCustomization`, `room-state/encounter-customization.ts`, the encounter codec and reconciliation. No room-feature payload or second customization address.                            |
| Engine assessment     | `simulation/encounters/{model,authoring-domain,preparation}.ts` owns resolved policy, optional-state assessment and exact contextual capability. Put composition rules in this neighborhood, not the large preparation coordinator or React. No enemy-count/history simulator.                                  |
| Application           | Extend encounter phase projections and bound interactions under `projections/structured-workspace/`; adapt engine products rather than rebuild rule tables.                                                                                                                                                     |
| React                 | Extend the existing dialog in `ui/editor/biome/locals/EncounterPhaseControl.tsx`, extracting a focused composition editor if warranted. Immediate semantic edits and Undo; no new Save/Discard draft. Preserve existing boss controls and stable launcher finding target.                                       |
| Publication           | Extend `execution-plan/{model,assembly/overview,codec/overview}.ts`. Publish only active explicit operands in the matching `overview.encounterPhases` record. No DAG node, transaction, conformance fact or next-room search.                                                                                   |
| Game module           | `src/mods/protocol/overview.lua` decodes the product. `room/timeline/encounters/hooks.lua` already resolves the phase before native selection; generation-specific steering belongs beside it, separate from boss-specific modules. Use existing session diagnostics.                                           |

Paths in the table are relative to the owning package/application; game-module
paths are relative to `../run-planner-modpack/Submodules/adamantRunPlanner-Run_Planner`.
Declare explicit inputs and returned products. Do not introduce a service
locator, raw game-data importer, generic plugin registry or blanket RNG manager.

### Runtime contact to prove

The existing `ChooseEncounter` wrapper knows the exact phase before invoking
native selection; only the resulting-object binding happens afterward. Carry
that same identity through a bounded preparation scope to the copied encounter
before `GenerateEncounter` runs. Never modify shared `EncounterData` tables.

Devotion also enters through `SetupRoomReward`: native `SetupEncounter` can be
called without the destination room argument. Bridge the already-stamped
destination from navigation's reward-setup scope rather than borrowing the
currently active predecessor session. Preserve native difficulty/context
semantics; this feature does not silently repair unrelated preparation rules.

Candidate contacts are copied `MinWaves/MaxWaves` before generation, the native
highlight draw, `FillEnemyTypes` for ordinary additions/placeholders, and
`FillEnemyCounts` for requested allocation slices. The exact narrow draw/sample
contacts are established by Gate A's opt-in native-source probes:

- Carry occurrence/phase from the existing encounter selector into synchronous
  `SetupEncounter` preparation; match the concrete declaration, then follow its
  copied encounter and actual wave objects. Native intro replacement or nested
  unowned work runs under a neutral scope, not the parent's override.
- Override wave bounds on that copy. Observe the initial highlight eligibility
  pass before steering its draw; type-filling draws belong to their exact wave.
  An unseeded random type count can use the authored list size, without changing
  deterministic escalation or highlight counts. Native filling retains its
  blacklist, group-pruning and active-cap side effects.
- Map allocation samples from the native spawn-array branches, including fixed
  entries, already-counted entries and the full-index remainder rule. The
  mapping belongs only to that `FillEnemyCounts` invocation; the native allocator
  still performs rounding, caps and remainder allocation.

These probes establish contacts, not a shipped adapter or authored schema.
Engine normalization of relative weights and live enforcement remain later gates.

Do not prepopulate `SpawnWaves` to bypass native generation, replace completed
rosters after counts are calculated, or preseed arbitrary types and lose native
blacklist/group/active-cap effects. Shared native RNG hooks are acceptable only
under a proven exact synchronous generation/fill scope, with unrelated calls
delegated unchanged and restoration under nesting/errors. No thread-retained
scope or matching by function arguments alone. Intro replacement must not
inherit customization intended for a different encounter.

## Delivery gates and commit boundaries

### A — Prove contacts and freeze the narrow contract

Read-only/source-backed probes first; no application implementation yet.

- Prove the agreed Default/highlight prerequisites at the native contacts.
- Exercise real inspected generation/fill bodies in a bounded test-only harness,
  not mocks that simply return the requested roster. Establish sample-to-entry
  mapping, native selection side effects and scope restoration.
- Cover ordinary preparation, reward-owned Devotion, distinct repeated H/O/P
  phases, escalating NPC composition, an H mixed template and unrelated calls.
- Demonstrate Default parity and intentional conflict → diagnostic/native
  continuation. Prove unequal requested weights affect the intended allocation
  samples without asserting final percentages.
- Pin exact depth/hard-context inputs and native sample ordering. No inferred
  room ordinal or generic next-RNG-call counter is acceptance evidence.

Commit boundary: bounded contact evidence/tests and final plan decisions. If
the approach requires whole-function recreation or wider interception than
allowed, report the concrete conflict and amend the plan before production.

### B — Catalog, engine and publication contract

Deliver the complete pure feature: declarations, sparse authored state,
commands/decoding/reconciliation, assessment/candidates and lossless publication.
Extend both strict wire decoders together, using one protocol bump for the final
payload shape. No authored-schema bump merely to install optional defaults;
if existing authored meaning must change, stop and justify a migration first.
Update catalog identity through the existing mechanism.

The existing authoring domain exposes customization for direct encounter
profiles. Extend it to consume the engine's resolved identity for reward-owned
Combat/Devotion profiles too; do not add a second resolver in the application.
Retained edits must still have a visible repair/reset surface when contextual
assessment cannot finish.

Primary owners: catalog declaration/compiler tests; engine encounter command,
codec, preparation/candidate and execution-plan tests. The complete policy
matrix lives here; application tests should not duplicate every native row.

Acceptance includes old all-Default projects, partial overrides, clearing,
Undo/Redo, concrete encounter/reward changes, dormant phases, fixed versus
generated slots, seeded/exclusion rules, native-unknown inputs, and stable
repair of explicit invalid selections. An otherwise valid untouched route must
remain valid without opening any new control.

Regenerate only affected execution fixtures through the owning builder and
Prettier; mirror byte-for-byte to the game module and compare. A protocol scalar
change is mechanical, not a reason to regenerate unrelated fixture content.
No deployment with new customization is ready until D passes.

### C — Optional encounter editor

Adapt the existing phase product, dialog and bound semantic commands. Publish
the current generated assessment with the authored snapshot; ordinary picker
candidates remain lazy. After the count/highlight prerequisites are known, show
each wave's selected enemies as wrapping badges within its picker surface, with
weights attached to their corresponding badges. Identify highlight and fixed
members explicitly; fixed members have no weight input. Clicking a badge reopens
the whole-wave draft. Use one staged contextual picker per wave.
The draft confirms fixed/highlight members in their own stages with only the
declared seed available, then selects generated additions against the engine's
current prefix domain. Each selection advances within that wave only. As soon as
the engine accepts that composition, put **Finish Wave** first in a separate
section with a separator beneath it, before enemy options. Even a full wave is
committed by Finish Wave, not automatically. Cancel discards the draft.

The application adapts the existing exact-phase assessment capability for local
draft queries; React must not reproduce count or eligibility rules. Intermediate
choices do not dispatch authored commands or rebuild the route. Finish publishes
one wave edit and one Undo entry. After completion, show the roster in the existing
badges with inline weights. Keep the global highlight as an independent
contextual picker and wave count as Default plus supported-count radio choices
(fixed counts remain read-only). No generic wizard or
new scheduler is needed.

The staged picker distinguishes required from optional additions and offers Finish
Wave when the composition is valid. Default remains the whole-wave native
configuration; a partial picker draft is not a request for native filling inside
an exact authored composition. Setting prerequisites or
opening the dialog must not author wave selections. Keep each independent reset.

Place compact weight inputs beside generated enemy controls, including the
highlight. Show `NA` while weights are native; the first weight edit initializes
the other generated members to 1. Explain native versus relative weighting once
above the waves. Fixed scripted members have no weight control. Align red-tinted weight
and wave resets with the wave heading, and customization reset with the section
heading. Show the resolved native encounter identity beside the section heading.
Panel each wave; place Select/Edit enemies beside its title. Show neither
percentage badges nor a duplicate type-count summary outside the picker.

Retain invalid choices, including excess stored types, in an explicit removable
repair area rather than silently discarding or hiding them. Do not reinterpret
persisted choices while drafting. A completed replacement wave explicitly replaces
that wave; Cancel leaves its old values intact. Preserve per-position weight
inheritance on replacement, initialize added members to 1 only when custom weights
already exist, and drop removed members. Existing excess-removal repair can remain.
A range/eligibility conflict must remain repairable without a full reset.

Give issues typed semantic evidence at the engine authority (wave, relevant type
or position, actual count and allowed bounds as appropriate). Project concise,
actionable messages beside the affected wave/control rather than concatenating
generic sentences at the dialog bottom. For example, a highlight-only first wave
with two stored additions says to remove those two additions. This tightens B's
assessment product; it changes no catalog rules, persisted schema or execution
protocol and introduces no generic form framework.

Primary owners: focused projection/interaction tests and UI tests beside the
encounter workbench. Representative real-plan workflows cover ordinary combat,
an NPC, H mixed composition and a multi-phase O or P occurrence; verify opening
and closing changes no authored state, untouched defaults need no findings,
explicit invalid values remain repairable, and finding navigation targets the
launcher without opening the dialog. Check narrow-width layout manually.
Include the user's P_Combat08 shape: two waves with a Satyr Goldpike highlight
and Harpy Raptor/Auto-Seeker additions in both. Report 3 versus 1/2 total types,
retain removable excess, and reach valid state by removing both additions from
wave 1 and either from wave 2. Cover fixed H seeds, required/optional slots,
staged eligibility, Cancel and single-edit Finish/Undo, Finish Wave ordering and
separator, and no trailing candidate stage once the wave is full. Keep the complete slot/evidence matrix in engine tests and
representative repair workflows in application tests.

Commit boundary: complete application presentation over B's supported engine
product, with existing boss customization unchanged.

### D — Scoped game realization and diagnostics

Implement only Gate A's proven contacts. Reuse the exact occurrence/phase
selection already owned by encounter preparation; add the narrow Devotion
destination handoff without creating another route cursor. Keep wave/type/share
helpers with generated encounters rather than multiplying per-biome adapters.

Primary owners: Lua protocol/contact tests under `tests/room/`, using the shared
native harness plus Gate A's source-backed witnesses. Cover same-name adjacent
phases, nested/unrelated contacts, native Default calls, fixed H preservation,
Fig Leaf/native skip, intro replacement, Hordes/Fangs interaction, rounding/caps,
and a deliberate failed override that records diagnostics while remaining synced.
Do not assert actual type-budget percentages.

Commit boundary: complete realization of the published optional product, with
no new transaction/conformance/mismatch paths and no stale forcing after return.

### E — Independent closure and in-game acceptance

Use focused executors and independent reviewers under `AGENTS.md`; one writer
at a time. Give the high-risk composition rules and scoped runtime interception
independent scrutiny, not just UI review. The main session owns findings,
cross-repository integration and final closure.

After narrow tests stabilize, run one full planner `npm run check`, plus game
module `lua tests/all.lua` and `luacheck src/`. Check fixture mirrors and the
all-Default path. Review dependency direction, existing boss regressions,
superseded paths, diff growth and accidental required authorship.

In-game evidence must include an untouched Default encounter, variable waves
with highlight, a fixed-wave NPC, an H cage and mixed template, O repeated ship
phases, P's supported generated phases, Devotion reward preparation, and unequal
weights under native count constraints. Group compatible witnesses into a small
number of plans; do not require one new fixture or run per matrix row. Record
what actually passed. Code/test completion is not live acceptance; keep this
gate pending until the user supplies the runtime results.

## Deletion and closure disposition

No existing encounter selection, boss customization, lifecycle, transaction or
conformance path is replaced by this addition. Extend the current supported
surface; remove any provisional alternate path before its gate commits.
Temporary probe artifacts stay outside production. Promote only reusable
contact tests and established facts; delete scratch probes and this plan at
closure. Update the smallest owning design/audit sections and the feature-to-hook
map for the accepted contract, without copying the matrix or adding a bug log.

## Progress

Gate A verification uses the game module's opt-in
`tests/probes/test_generated_encounter_native.lua`, which loads unmodified native
function bodies from `HADES2_SCRIPTS_PATH` (or an explicit Scripts-directory
argument). It does not vendor game source or add a local-game dependency to the
ordinary test suite. The prepared inputs are controlled generator examples,
not an exhaustive test of the catalog's 39 concrete identities.

Recorded checks:

- Native-source probe: 10 passing witnesses, covering Default parity, copied
  count/highlight/type steering, exact ordinary fill side effects, allocation
  mapping and native caps/remainders, H mixed templates, Devotion destination
  versus native context, repeated phases through existing encounter hooks,
  integrated diagnostic continuation, nested/native-fault cleanup, and native
  intro replacement.
- Existing module suite: 528 passing tests.
- `luacheck src/ tests/probes/`: no warnings or errors.
- Initial independent review identified four contact-evidence gaps; the bounded
  remediation replaced disconnected assertions with the native call chains.
  Independent follow-up verification closed all four with no remaining material
  findings. Production realization and in-game acceptance are still pending.

Gate B delivers all 39 normalized declarations, sparse phase-owned authored
customization, exact preparation assessment/candidates, and lossless execution
operands. Known ordinary-addition blacklist consequences travel through the
existing encounter record; native Default rosters remain unknown. Devotion uses
the source target-generation checkpoint rather than destination entry. The
application currently retains its boss editor; generated controls belong to C.

Recorded Gate B checks:

- Catalog: 34 files / 268 tests passed, including updated normalized snapshots.
- Focused engine: 9 files / 179 tests passed, covering authored codec/history,
  reconciliation, ordered composition, exact candidate repair, existing boss
  behavior, real-route publication and execution fixture compatibility.
- Game protocol: 47 tests passed. Both decoders admit the same closed sparse
  generated payload under execution protocol 40; no authored-schema bump.
- All workspace/fixture typechecks and affected TypeScript lint passed; protocol
  production Lua is warning-free.
- All 13 execution fixtures changed only version and fingerprint; their game
  mirrors are byte-identical. Temporary fixture-refresh code was removed.
- Independent declaration/order review and final integration review reported
  no remaining actionable findings. Broad phase closure and in-game validation
  remain E; no intermediate feature deployment was performed.

Gate C delivers the existing Timeline customization dialog with count radios,
a shared-highlight picker, whole-wave staged pickers, and completed enemy badges
with relative weights. Exact-phase assessment is published atomically; intermediate
wave choices remain local until Finish Wave publishes one authored edit.
Default retains dormant composition and weights, independent resets remove
overrides, and invalid retained values remain repairable. Findings target the
Timeline launcher without opening the dialog, with detailed repair messages beside
the affected controls inside it. Existing boss editors remain unchanged.

Verification and remaining obligations:

- Focused engine and application checks cover ordinary, NPC, H mixed, O/P phase
  and Devotion contacts, retained repair, weight inheritance, reset/Undo, and
  unchanged opening/closing. Picker witnesses cover staged eligibility, Cancel,
  single-edit Finish, and Finish Wave ordering.
- Browser checks covered desktop/narrow layouts, staged P-wave completion,
  retained weights, and scaled popup stability. The user's exact `(51)` save
  was repaired without modifying the original file.
- Coherent review covers Slice B `79e90e5e` through the entire Gate C worktree,
  including checkpoint `15c8035f`. Remediation preserves weights through
  Default/highlight round trips and removes obsolete app-projection fields.
  Ambiguous retained weight maps remain intact for explicit repair rather than
  guessing which key belonged to the dormant highlight.
- Remediation verification: generated/occurrence workbenches passed 45 tests;
  the final generated workbench passed 12 tests after adding the ambiguous-weight
  repair witness. Application typecheck, affected ESLint, formatting and diff
  checks passed. The independent review findings are addressed.
- The prior workspace contract run had 75 passes and one pre-existing
  button-classification failure in `RunStateSheet.tsx:190` (introduced by
  `321fcb66`). This remains a closure obligation.
- No schema, protocol or fixture migration; no deployment or game realization
  is claimed. Gate D realization and Gate E broad closure/in-game checks remain.
  The user approved committing Gate C and proceeding to Gate D.

Gate D realizes the optional generated operands through one composition-owned
synchronous preparation scope shared by navigation and encounter selection.
Native generation retains difficulty, eligibility, type side effects, rounding,
caps and spawning. Unsupported selections record bounded diagnostics without
adding mismatch or transaction obligations.

- Independent review and remediation addressed neutral nested scopes, void-return
  call cardinality, generated-identity share mapping, and composition test wiring.
- Game-module suite: 534 tests passed. Production-hook native-source probes:
  13 tests passed, including fixed-entry/remainder allocation, native caps,
  Hordes and later Fangs contact. Production Lua lint and diff checks passed.
- No deployment or live acceptance is claimed. Gate D is committed in the game module;
  Gate E still owns full planner closure and the required in-game witnesses.

| Gate | Status                                          |
| ---- | ----------------------------------------------- |
| A    | Complete; independently reviewed                |
| B    | Complete; independently reviewed                |
| C    | Complete; review findings addressed             |
| D    | Complete; independently reviewed                |
| E    | Closure checks started; live acceptance pending |
