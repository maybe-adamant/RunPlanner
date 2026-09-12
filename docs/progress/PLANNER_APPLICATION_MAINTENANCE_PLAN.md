# Planner Application Maintenance

Status: locked; approved for implementation through closure and reassessment.
Source and phase performance baseline: `fb1d0bfc`.

## Objective

Finish the catalog/engine/application maintenance sequence with one cohesive
pass over the React application and its engine bridge. Make a feature's change
neighborhood explicit from engine product to editor interaction, feedback and
presentation, without replacing the existing editing model.

The user-visible result is the same editor, with reliable draft refresh and
preserved repairability, navigation, responsiveness and file behavior. The
maintenance result is smaller responsibility-aligned modules, complete products
at handoffs, fewer field-by-field transport obligations, and tests beside their
actual owners. This is not a mandate to change every inspected component.

## Authorities and evidence

- `docs/design/ARCHITECTURE.md`: dependency direction, construction, imports,
  feature extension and maintenance discipline.
- `docs/design/EDITOR_MODEL.md`: complete application ownership contract.
- `docs/design/STRUCTURED_EDITOR_WORKSPACE.md`: concrete layout, occurrence/Hub
  workbenches, coverage, removal and repair.
- `docs/design/CONTEXTUAL_EDITOR_UX.md`: selected-value/control-existence
  invariants, candidate presentation, compound rewards and trait drafts.
- `docs/investigations/PLANNER_APPLICATION_AND_ENGINE_BRIDGE.md`: temporary
  inventory and evidence, not a replacement authority.

There are no new game facts or planner simplifications in this plan. Existing
catalog and engine products remain authoritative. If a missing engine product
or domain defect is discovered, characterize it and request a bounded amendment;
do not silently add semantics to the application. Before any engine work, read
the full engine guide as required by `AGENTS.md`.

## Locked direction upon approval

```text
immutable authored snapshot + exact evaluation assembly
  -> authored-first workspace source and complete assembly products
  -> presentation + bound interactions
  -> React controls and local drafts
  -> semantic intent -> replacement snapshot
```

Preserve:

- catalog construction in composition and pure engine ownership of meaning;
- exact assembly/candidate provenance and identity-based evaluation reuse;
- explicit returned facts/capabilities, with no ambient registration;
- authored topology as the visibility base, assessment only as an overlay;
- one completed finding destination for navigation and red-border feedback;
- engine-owned incompleteness horizon and root-level interaction locking;
- complete semantic edits and one effective history step, including compound
  engine-proposed delivery rescheduling;
- typed trait children, focused repair, engine-produced draft transitions;
- separate file, recovery, authored-history and UI-session state;
- unchanged execution publication and browser/desktop behavior.

## Included and excluded scope

Included: application composition/publication; workspace source, contracts,
assembly, presentation and interaction binding; candidate adapters and React
loading; draft identity; findings and navigation; editor component and stylesheet
organization; verification of persistence/host contacts; associated tests/import
rules/documentation.

Excluded: new authoring policy, UI redesign, tabs or workflow changes, engine
settlement/topology redesign, schema/catalog/protocol bumps, fixture migration,
game-module changes, new state/form/graph frameworks, DI containers, workers,
speculative incremental evaluation, exhaustive production shadow workspaces.

Inspection coverage is broad; implementation authority is bounded. Gates A and
D and the host portion of F may close with evidence and no production edits.
Existing correct code does not need a refactor to demonstrate completion.

## Ownership and target organization

| Owner                                    | Input -> product                                                                        | Must not take over                     |
| ---------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------- |
| Composition/state/workspace coordination | Commands/snapshots/host capabilities -> coherent publication and session reconciliation | Engine legality, clocks, repair        |
| Workspace source/assembly                | Authored structure + exact assessed facts -> complete editor facts                      | New evaluation or authored repair      |
| Presentation                             | Complete facts + catalog labels -> visible model and destinations                       | Candidate execution or semantic policy |
| Interaction binding                      | Exact owner/capability -> loadable domains and complete intents                         | Rendering, navigation-state storage    |
| React                                    | Bound model/intents -> controls, local drafts, focus                                    | Query construction or domain inference |
| Persistence adapters                     | Explicit file/recovery operations -> transport results                                  | Parsing planner semantics in host code |

Keep current top-level ownership roots. Within projections, consolidate candidate
session/adapters, contextual presentation, reward/trait domains, and route feedback
indexes into coherent neighborhoods as their owning slices land. Keep the
deliberate `structured-workspace` public entry; consumers must not gain private
imports during decomposition.

Within structured workspace retain source, assembly, presentation, navigation
and interaction roles. Split contracts by product family: shared primitives,
navigation/structure, trait/reward editing, room features/commerce, Run State,
and final composition. A family's controls and bound interactions may live
together. Final names depend on the import graph, not a file-count target.

Within React keep shell, project operations, controls and feedback separate from
feature editors. Group room features/inventories and reward-editor families in
their final neighborhoods during their slice. Do not move all files first and
then move them again after decomposition.

Contract decomposition is incremental with its owning family and consumers.
There is no standalone interface-only gate, temporary compatibility barrel or
old/new forwarding path. Keep large coordinators where their sequence is the
coherent responsibility; extract complete products, not shared mutable contexts.

## Delivery rules

Use the repository executor/reviewer routine for implementation gates. The main
session supplies exact starting symbols, governing sections, changed ownership,
expected deletions and tests; it owns disposition and commits. Reuse executors
for remediation. Only one writer; independent review after a stable slice.

Before each gate, record a compact current-to-target responsibility map in this
plan: inputs, product, consumers, primary tests and displaced path. This is a
focused packet, not another whole-repository investigation. Uncertain cosmetic
splits are optional; contract changes require approval. Keep review findings
and truthful verification concise here until closure.

Each gate lands coherent, independently type-correct vertical slices. Separate
behavior corrections from movement commits. Never commit a half-migrated
contract expecting the next gate to restore correctness. A gate may have multiple
bounded commits, but no scaffolding-only commits.

## Gates

### A — Publication and session boundary

Start: `composition/createApplication.ts`, `state/projectWorkspaceSlice.ts`,
`state/store.ts`, `workspace/editorSessionReconciliation.ts`.

Verify exact snapshot/assembly pairing, effective/no-op history behavior,
Undo reuse, publication-to-session reconciliation and disposal. Preserve
engine-owned placement queries; their presence in orchestration is not domain
leakage. Distinguish evaluation publication from subsequent cached projection;
do not impose an extra eagerly rebuilt workspace merely to match a diagram.

Record baseline evaluation/candidate work counts using existing observers and
the existing performance witness before construction changes. Retain the phase
baseline ref for final comparison. Do not create new telemetry infrastructure.

Primary evidence: `state/projectWorkspaceSlice.test.ts`,
`workspace/editorSessionReconciliation.test.ts`, architecture candidate-boundary
and render-purity tests. Run relevant existing cases; add only missing concrete
boundary witnesses. No required deletion or production change if this boundary
already conforms. Commit only justified cleanup/tests, not an artificial wrapper.

### B — Workspace products and structural bridge

Start: `projections/structured-workspace/{contract,projector,source-index}.ts`,
`assembly/{biome-semantic-assembly,decision-assembly,occurrence-assembly}.ts`,
`interactions/interaction-binding.ts` and their direct consumers.

Decompose structure/navigation/Run State contracts with the owning assembly,
presentation and binding consumers. Leave trait and feature families for C/E.
Preserve exact evaluated-owner coverage and authored-first traversal. Examine
the decision assembly's optional persistence/default path against real callers;
remove only if superseded. Do not rebuild Hub or ordinary topology policy.

Acceptance: existing workspace contract/closure tests and source-index tests;
one ordinary decision and one N main/side-room retained-prefix workflow; current
physical peer order and selected subtree retained; missing child does not erase
its control; no duplicate evaluation or candidate work merely from rendering.

Expected deletion: moved contract blocks and genuinely superseded adapters;
no replacement all-purpose contract blob, source shadow or compatibility shim.
Primary owners remain source-index, assembly/binding tests and
`structuredWorkspace.contract.test.ts`, not new policy matrices in React.

### C — Candidate interactions and draft ownership

First deliver the focused behavioral correction separately: characterize an
external persisted Chaos magnitude-only edit while the dialog is open, then
replace `TraitOfferEditor.tsx:traitOfferRevision`'s partial field enumeration.
Refresh must cover complete authored value. A changed candidate context with
unchanged persisted value must not automatically reset the user's unsaved draft.
Refresh candidate evidence against the current assembly without publishing stale
results. Do not reset on every render or add persisted revision metadata.

Then decompose `interactions/trait-offer-interactions.ts` and its family contracts
with their consumers: ordinary offer orchestration, Chaos, Hex and typed child
bindings (including Echo/Stone). Reuse existing child dispatch and engine draft
capabilities. Consolidate candidate session/adapters and contextual projection
neighborhoods where it reduces cross-feature navigation; retain the one React
interaction loader and its stale-response rules.

Start also at `candidateProjection{,Session}.ts`, `candidateTraitAdapters.ts`,
`traitDomainProjection.ts`, `ui/controls/useWorkspaceInteraction.ts`,
`TraitOfferEditorShell.tsx`, `TraitOfferEchoLastRunBoon.tsx` and shared selected
outcome editors. Read Contextual Editor UX's trait-domain/presentation sections.

Acceptance: focused editor refresh witness plus existing persisted Persephone
refresh; unsaved draft preservation under new context; ordinary/Chaos/Spell
editing; nested Stone or Echo target repair and save/reopen; Start Over; candidate
activation/cache/stale-response tests. Keep comprehensive legality in engine.

Expected deletion: handwritten per-payload refresh fingerprint and displaced
multi-family binding bodies. No second draft representation or redundant loader.

### D — Navigation, findings and readiness

Start: structured-workspace `navigation/`, `evaluationProjection.ts`,
`editorNavigation.ts`, `ui/feedback/`, `state/editorSessionSlice.ts`,
`ui/editor/biome/{BiomeWorkspace,BiomeInspectorControls}.tsx`.

Verify the full consumer path after B/C: one destination, correct rail selection,
same-occurrence tab navigation, exact nested launcher, shared red feedback,
and root locking including labels/keyboard. Keep invalidity distinct from missing
input and assessed coverage. Reorganize feedback copy/index projections only
where the ownership is clearer; explicit finding copy may remain large.

Acceptance: `useFindingTarget.test.tsx`, relevant Biome workspace/inspector and
session tests, representative source-redirected finding and loadout-to-opening
lock. Confirm the owning incomplete region remains repairable and an N hub
repair does not borrow an unrelated occurrence's readiness.

No new finding system, border language, prerequisite banners or chronology.
No removal target unless a concrete duplicate path is identified. This gate
can close as verification of the retained implementation.

### E — Room and reward React composition

Start: `assembly/{occurrence-room-facts,occurrence-reward-assembly}.ts`,
feature/commerce interaction bindings, `OccurrenceRoomFeatures.tsx`,
`OccurrenceRoomActions.tsx`, `OccurrenceEncounterWorkbench.tsx`,
`DecisionWorkbench.tsx`, `ShopOfferEditor.tsx`, `RewardControlEditor.tsx`.

Move complete room-feature/inventory presentation families and matching contract
products into their final neighborhoods. Keep Overview, Timeline and Doors
composers as coordinators; acquisition children remain timeline-owned, inventory
identity remains inventory-owned. Keep fixed owner/value dispatch where truthful.
Do not replace specialized editors with a generic form engine.

Include explicit dispositions for loadout/keepsake controls, generated/automatic
action rows, H Layout, O wheel/multiphase views, N Hub and shell indexes: reuse
healthy components, consolidate mixed files where warranted, no biome redesign.

Acceptance: existing room-feature, Stygian Well, Hermes Shrine, encounter,
timeline and reward editor tests; representative shop Mystery Boon settlement,
generated pickup repair, H placement without reward ownership changes, O wheel
and N side-room controls. Do not duplicate all engine mechanic permutations.

Expected deletion: displaced mixed feature/slot/editor bodies and moved contract
blocks; imports point directly at final owners, not forwarding files. The old
Overview component may remain a small composer, not a second implementation.

### F — CSS, accessibility and host contacts

F1: inventory `ui/styles.css` selector ownership, specificity and ordering before
splitting it. Group shell, shared controls, feature layouts and feedback styling;
keep one explicit ordered stylesheet entry. Preserve relative cascade order,
responsive overrides and final finding styling. Do not globally reorder CSS,
rename all classes, switch CSS frameworks or redesign presentation.

Check desktop and narrow-width layouts using the existing application: shell,
loadout/Embryo, trait dialog, room features/inventory and Hub/Fields/Wheel surfaces.
Check focus, labels, nested dialog Escape and disabled interactions as affected.
Unit layout assertions do not substitute for visual inspection. If preview or
desktop access is unavailable, report the unverified surface before closure.

F2: inspect `workspace/projectOperations.ts`, `persistence/`, `main.tsx`,
`ui/project/ProjectFileControls.tsx` and shell recovery contacts. Verify existing
save snapshot, cancellation/failure, load preparation, autosave and active-file
contracts using adapter tests. Preserve browser vs Tauri behavior and game
publication isolation. No native-host rewrite or new recovery policy; native
changes require separate concrete evidence and approval.

Expected deletion: displaced monolithic stylesheet sections; host code may stay
unchanged. Keep visual movement separate from any reproduced functional fix.

### G — Combined closure

Review the resulting application as one editing loop, not just passing files.
Confirm every inventory finding and gate has an explicit delivered/retained
disposition. Review final directory and dependency map, test ownership, removed
paths, production growth and exact engine/app ownership. There must be no
unfinished contract migration or compatibility path.

Use existing Golden Underworld/Surface product loops and focused witnesses
rather than authoring a new giant route. Run the complete repository gate once
after narrow checks and review are stable: `npm run check` includes `test`, so
do not run both redundantly. Set `RUN_PLANNER_PERFORMANCE_BASE_REF` to the phase
baseline instead of comparing only the last gate; use repository thresholds.
Record truthful results, including unavailable visual/native checks, before
declaring closure. Broad failures are not waived as stale without investigation.

Promote only new durable ownership/extension guidance into `EDITOR_MODEL.md`
and relevant specialist sections. Update code-path references affected by moves.
Delete this plan and its investigation at closure; leave the unrelated postboss
plan untouched. The durable progress-history owner is the phase closure Git
commit: its message must record the baseline ref, exact full-gate command and
result, performance comparison result and any unavailable visual/native checks.
This keeps verification retrievable after deleting temporary documents without
reintroducing the retired implementation-history tracker. Do not link this
temporary plan from README or stable documents.

## Test and change-budget discipline

Gate verification uses these existing commands. Paths shown here are the current
owners; update them in the same slice if their owning tests move. Commands are
not a demand to rerun unrelated suites after every edit.

- A: `npm run test:correctness -- apps/planner/src/state/projectWorkspaceSlice.test.ts apps/planner/src/workspace/editorSessionReconciliation.test.ts apps/planner/test/architecture/candidateBoundary.test.ts apps/planner/test/architecture/candidateRenderPurity.interaction.test.tsx`.
- B: `npm run test:contract` and `npm run test:correctness -- apps/planner/src/projections/structured-workspace/source-index.test.ts apps/planner/src/projections/structured-workspace/assembly apps/planner/src/projections/structured-workspace/interactions`.
- C: `npm run test:correctness -- apps/planner/src/ui/editor/rewards apps/planner/src/ui/controls apps/planner/src/projections/candidateProjectionSession.test.ts apps/planner/src/projections/candidateProjection.test.ts apps/planner/src/projections/structured-workspace/interactions/trait-offer-interactions.test.ts apps/planner/test/architecture/candidateRenderPurity.interaction.test.tsx`.
- D: `npm run test:correctness -- apps/planner/src/ui/feedback apps/planner/src/ui/editor/biome/BiomeWorkspace.test.tsx apps/planner/src/ui/editor/biome/BiomeInspectorControls.test.tsx apps/planner/src/state/editorSessionSlice.test.ts apps/planner/src/workspace/editorSessionReconciliation.test.ts apps/planner/src/projections/structured-workspace/navigation`.
- E: `npm run test:correctness -- apps/planner/src/ui/editor/biome apps/planner/src/ui/editor/rewards apps/planner/src/projections/structured-workspace/assembly apps/planner/src/projections/structured-workspace/interactions`.
- F: `npm run test:correctness -- apps/planner/src/persistence apps/planner/src/workspace/projectOperations.test.ts apps/planner/src/ui/project apps/planner/src/ui/shell`; affected layout tests from E plus the explicit visual checks above for F1.

Production TS changes also run `npm run typecheck`; moved/import-boundary files
run ESLint and Prettier on the changed paths. The complete repository gate,
combined Golden product workflows and phase-baseline performance judgment are
deferred to G, not repeated at every gate. Existing focused tests fulfill a
listed witness when they genuinely exercise it; add a missing witness at its
primary owner rather than duplicating it across these commands.

Use the narrowest truthful existing lane per slice: planner/contract for bridge
work, UI for components, product loops for representative handoffs. Follow shared
watchdogs and fixture formatting rules. Preserve existing checkpoints; no schema
or execution fixture regeneration is expected. If emitted execution bytes change,
treat that as unexpected behavior, not routine fixture refresh.

Each behavior matrix has one primary owner. Consumer tests prove handoff and
reachability, not reimplement engine rules. Strengthen import restrictions only
for real mechanically observable boundaries; avoid filename-count/line-count
tests, historical absence assertions and a production manifest of every control.

Before review, each slice reports changed responsibility, removed path, test
evidence, work-count impact and remaining uncertainty. File/line counts are
diagnostics: no target reduction or mandatory decomposition of coherent code.

## Plan acceptance checks

- All six investigation findings have an owner: refresh C; contracts B/C/E;
  trait binding C; feature assembly/UI E; grouping/CSS B/C/E/F; sensitive joins B
  with explicit retention review.
- Broad coverage does not mandate production edits in healthy boundaries.
- Contract movement occurs with real consumers, not preparatory scaffolding.
- Behavior correction and movement are separate; no semantic leak into React.
- Root availability, draft repair and exact finding paths remain intact.
- Scope changes are amended before execution, not accumulated as ad hoc gates.

## Delivery record

All gates pending. User approved implementation on 2026-09-12. Independent plan review found no ownership/scope/coverage
blocker. Accepted its request for executable per-gate validation commands above.
Its suggestion to create a durable verification document was not adopted: Git
history is durable and the project deliberately retired the redundant progress
tracker. The closure record requirements are explicit above.

Gate A packet: inspect snapshot/history publication and session reconciliation
from the four named starting modules; preserve current boundaries unless a
concrete defect appears. Inputs are semantic commands and exact assemblies;
products are coherent workspace state and cleared stale UI targets. Primary
tests are the four A suites; no displaced production path is currently justified.
