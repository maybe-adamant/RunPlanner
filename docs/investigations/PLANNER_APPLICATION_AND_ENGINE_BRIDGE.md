# Planner application and engine bridge assessment

Status: pre-plan investigation. Source baseline: `fb1d0bfc`.

## Question and scope

What application maintenance would materially shrink the change neighborhood
without rebuilding the engine/editor bridge or changing authoring behavior?

This is a structural inventory and representative source-path assessment, not
an exhaustive UI correctness audit. No runtime defect was reproduced and no
production code was changed. The intended authorities are
`docs/design/ARCHITECTURE.md` and `docs/design/EDITOR_MODEL.md`.

## Inventory

The application has 164 production TS/TSX/CSS files. Notable concentrations:

| Neighborhood         | Production files |  Lines | Interpretation                         |
| -------------------- | ---------------: | -----: | -------------------------------------- |
| Structured workspace |               53 | 20,869 | Main application adaptation boundary   |
| React editor         |               55 | 12,886 | Many distinct authoring surfaces       |
| Stylesheet           |                1 |  5,028 | Cross-feature cascade ownership        |
| Workspace contract   |                1 |  3,019 | Included in structured workspace above |

Counts exclude colocated tests and diagnose concentration, not quality. The
composition root is 172 lines; the workspace reducer is 162. Neither warrants
a framework or a decomposition project based on size.

## Current producer/consumer paths

Paths below are relative to `apps/planner/src/`.

1. `composition/createApplication.ts` constructs the catalog, evaluation cache,
   candidate factory, workspace projection, persistence adapters and store.
   Evaluation is memoized by immutable project identity; workspace projection
   is memoized by exact evaluation assembly identity.
2. `state/projectWorkspaceSlice.ts` publishes matching history and assembly.
   Commands use engine readiness and semantic history operations. Hermes
   rescheduling intentionally evaluates a proposal and requests an engine-owned
   placement before publishing the compound history edit. This is orchestration,
   not an application implementation of the delivery clock.
3. `projections/structured-workspace/source-index.ts` joins authored structure,
   assessed overlays and completeness. Assembly constructs products consumed
   by presentation and interaction binding. `projector.ts` returns the workspace
   and bound interactions; these maps are explicit products, not an ambient
   dependency registry.
4. Candidate projection binds one engine candidate session to the assembly.
   `ui/controls/useWorkspaceInteraction.ts` owns activation, asynchronous result
   identity and stale-response handling. Feature UI renders the projected result.
5. `navigation/finding-routing.ts` completes destinations before
   `finding-highlights.ts` indexes their repair targets. `useFindingTarget.tsx`
   consumes that index and engine readiness, including root `inert` behavior.
   `workspace/editorSessionReconciliation.ts` separately clears vanished session
   targets. There is no evidence here warranting another finding-path redesign.
6. `workspace/projectOperations.ts` keeps the active file reference outside
   authored history. Save captures a snapshot before asynchronous IO; load
   prepares the project before publication. Persistence adapters own host IO.

These are the foundations to retain. In particular, do not replace exact
assemblies with a broad React context, move legality into projections, or turn
the supported workspace entry into a collection of engine-aware components.

## Findings and recommended dispositions

### 1. Draft refresh has an incomplete handwritten value fingerprint

`ui/editor/rewards/TraitOfferEditor.tsx:traitOfferRevision` separately enumerates
ordinary option payloads and Chaos fields. The Chaos branch includes curse
options, selected option, blessing identity and rarity, but omits
`selectedCurseValues` and `blessingValues`. Both are persisted offer fields.

`TraitOfferEditorShell.tsx` initializes local value from `initialValue` using
`useState`; the parent uses this fingerprint as its React key. An external
persisted magnitude-only edit therefore does not change this reset key. The
existing test for externally changed Persephone results establishes that refresh
is an intended workflow, not merely speculative synchronization.

Disposition: first write the corresponding external Chaos-value-change witness,
then make refresh account for the complete authored value without enumerating
each targeted trait field. Keep draft identity separate from candidate-context
identity: a new evaluation alone must not blindly discard unsaved edits.
Do not introduce a persisted revision or generic form-state framework.

### 2. Workspace contracts combine unrelated product families

`projections/structured-workspace/contract.ts` contains trait/Hex/Chaos domains,
commerce interactions, room and topology presentation, Run State, navigation,
shared intents and the final workspace service. Its public entry already hides
the implementation, so changing the internal organization need not spread new
imports through React.

Disposition: group contracts by owned product family, keeping shared primitives
small and preserving the deliberate public entry. Co-locate a family's control
and interaction types where they genuinely evolve together. Do not create one
file per interface or a new generic registration system. Map type dependencies
before moving them; file splitting alone does not remove coupling.

### 3. Trait binding remains a multi-family construction body

`interactions/trait-offer-interactions.ts` has 1,097 lines. Its main binding loop
constructs ordinary offer support, Chaos drafts, Hex domains, selected typed
children, Echo draft support and Stone behavior. The typed-child path is real:
it uses `traitCarrierChildDomain` and transports child products. Replacing it
with another payload abstraction would repeat completed engine work.

Disposition: retain one offer binder, extracting cohesive family binders with
explicit inputs and complete returned capabilities. Keep child dispatch visible
and exhaustive. Move their primary tests with them, rather than duplicating the
same eligibility matrix at React, projection and engine layers.

### 4. Room feature changes span broad assembly and UI files

`assembly/occurrence-room-facts.ts` joins local rewards, Fields placement,
room-state variants and supplemental shop offers. The 901-line
`ui/editor/biome/OccurrenceRoomFeatures.tsx` combines resource controls,
Chaos/Contract presence, Anomaly controls, inventory slot editors and encounter
structure. Some Anomaly controls are exported to other workbenches, so the file
is not simply one self-contained Overview component.

Disposition: group room feature and inventory views by responsibility and
extract matching assembly products where separable. Keep the Overview composer
small, but do not redesign tabs or move purchase/acquisition ownership. Engine
declaration inspection in projection is not itself duplicated game policy.

### 5. Directory and stylesheet ownership lag behind the feature structure

Root-level projection files mix candidate sessions, reward/trait domains,
contextual copy and navigation/index projections. The stylesheet mixes shell,
controls, feature layouts, multiple responsive blocks and final finding
overrides. This makes an otherwise local edit harder to inspect.

Disposition: consolidate projection neighborhoods during their owning slice,
not in a preliminary mass move. Separate CSS by feature/shared visual authority
only after recording import and cascade order. Preserve late finding overrides
and responsive behavior. A CSS move is not permission for a visual redesign or
a component-library replacement.

### 6. Preserve sensitive joins; do not split every large coordinator

`source-index.ts` (912 lines), `decision-assembly.ts` (1,205) and
`biome-semantic-assembly.ts` (888) are sensitive because they join authored and
assessed structure, physical peers and selected traversal. Their length alone
does not establish an ownership defect. `evaluationProjection.ts` is also large
partly because it owns explicit finding copy; that is legitimate application work.

Disposition: retain the chronological/topology orchestration. Extract only a
complete owned product, not context wrappers or forwarding helpers. In
particular, do not conflate authored visibility with evaluated-prefix coverage.
The optional `persistence` default described as supporting legacy callers in
decision assembly is a small follow-up candidate: inspect callers before
removing it, rather than assuming the comment proves a live compatibility layer.

## Verification and open questions before implementation

Existing protection includes `test/architecture/unifiedWorkspaceOwnership`,
`candidateBoundary`, `candidateRenderPurity.interaction`, ESLint restrictions on
workspace internals, focused binding tests, workspace contract tests and real
trait-repair UI witnesses. Preserve their ownership rather than adding another
production self-audit.

An implementation plan should retain representative witnesses for:

- persisted trait refresh versus unsaved draft preservation;
- one ordinary room and an N hub/side-room publication;
- incomplete outgoing controls remaining repairable without unlocking later rooms;
- one nested trait target and one shop Mystery Boon acquisition;
- exact finding navigation and matching visible feedback;
- candidate activation work counts and stale asynchronous responses.

No performance regression is asserted from this inventory. Before changing
workspace construction, capture the existing application evaluation/candidate
work counts and use the repository performance comparison for closure.
Persistence and post-publication session reconciliation were inspected at their
coordination boundaries, not subjected to a new concurrency or browser audit.

## Proposed maintenance scope

Start with the bounded draft-refresh correction. Then perform complete family
slices for workspace contracts/binding and room feature presentation, settling
directory placement in those same slices. Treat CSS as a separate
behavior-preserving pass with visual checks. Leave engine schema, game-module
protocol, authoring policy, persistence behavior and topology traversal outside
this maintenance scope unless a separately characterized defect demands them.

The evidence supports targeted application decomposition, not a bridge rewrite.
Retire this investigation when its accepted scope is delivered; retain only
new durable ownership conclusions in the application design guide.
