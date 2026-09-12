# Planner Application and Editor

## Responsibility

`apps/planner` composes the catalog and engine into an editable application.
It owns persistence, state coordination, projections, interaction binding,
navigation and React presentation. It does not own room legality, topology
repair, reward bags, lifecycle clocks or candidate policy.

[Architecture](ARCHITECTURE.md) defines package direction.
[Planner Engine](SIMULATION_AND_VALIDATION.md) defines semantic products.
[Structured Editor Workspace](STRUCTURED_EDITOR_WORKSPACE.md) owns concrete
layout and workbenches; [Contextual Editor UX](CONTEXTUAL_EDITOR_UX.md) owns
picker and draft presentation.

The editor must preserve incomplete and invalid authored choices. Rendering
a tidy view is not permission to repair, hide or silently replace user intent.

## Composition and Atomic Publication

The composition root at
`apps/planner/src/composition/createApplication.ts` constructs the catalog,
evaluation/candidate capabilities, projection services, persistence adapters
and application coordination. Collaborators are complete at construction and
passed explicitly; no mutable registry assembles itself during use.

```text
new route / accepted profile / semantic command / Undo / Redo
  → immutable authored snapshot
  → matching exact evaluation assembly
  → prepared workspace and bound interactions
  → atomic application publication
  → React presentation
```

A new snapshot is evaluated synchronously. A restored immutable identity may
reuse its cached assembly. Public evaluation data alone cannot recreate
candidate capabilities; workspace preparation receives the exact assembly.
No component launches another project evaluation to fill a missing projection.

Redux coordinates authored history and transient session state. Domain changes
remain semantic commands. One effective user intent creates one history step;
no-ops do not. Navigation, focus, search, disclosure and derived results do
not enter Undo/Redo.

Before route choice or accepted loading there is no project, history,
evaluation or autosave publication. The route chooser does not create a
placeholder document. One accepted project owns one route; the shell does not
retain sibling route runs.

## Workspace Projection

The supported application surface is the deliberate
`projections/structured-workspace` entry. React and composition consume its
exported products and interactions, not private contract/projector modules.
Private implementation modules do not import their own public entry.

The internal dependency direction is:

```text
project + matching evaluation + normalized catalog
  → WorkspaceBiomeSource
  → complete semantic assembly
      ├→ presentation and final destinations
      └→ interaction binding and candidate contact
  → exact finding routing
  → immutable workspace service
```

Presentation and binding are sibling consumers. Presentation may read labels
for already-resolved identities; it does not revisit authored policy or obtain
facts by executing interactions. Binding owns executable command adapters; it
does not depend on presentation to decide their semantics.

Occurrence assembly joins complete local reward, workbench, action and feature
products. The final service composes those products rather than constructing
another occurrence/decision/Hub model. Generic markers cannot substitute for
typed semantic owners.

Keep a workspace product family's descriptors, controls and interaction types
together under `structured-workspace/contracts/`; internal consumers import the
owning family directly. The public entry remains deliberate and stable. The
root contract composes families and owns shared intent/lookup contracts, not a
second set of family declarations. A complete occurrence summary or chronological
assembly may remain large when its job is joining these products atomically.

### Authored-First Assembly

Persisted topology determines which decisions, occurrences and offer-time
leaves exist. Evaluation overlays only reached facts by semantic owner.

A complete-valid biome may use its canonical snapshot. Other biomes use the
clamped assessment prefix when present, otherwise their reached materialized
prefix. Retained materialization beyond assessment cannot supply entered
state, Clockwork outcomes or other evaluated facts.

`WorkspaceBiomeSource` acquires context-free completeness once for semantic
and interaction assembly. The full document remains the structural base.
Candidate support and findings decorate controls; they do not determine whether
a mandatory authored control exists.

Walk the authored start and selected topology, with selected subtrees before
retained peers and peers in current physical-exit order. Do not substitute
history-array order for topology. Retained unavailable targets remain visible
even when a new declaration exposes fewer exits; do not invent blank controls
for merely potential exits.

Offer-time and entry-time activation are different. Incoming and free rewards
remain editable on unpicked offered rooms. Shop inventory and optional
picked-room details appear only when structurally active; retained dormant
values are not evidence of entry. Fields facts and other shared activation
products come from the engine, not a second local lifecycle table.

### Readiness, availability and coverage

The engine's [authoring horizon](SIMULATION_AND_VALIDATION.md#authoring-readiness)
disables controls beyond required incompleteness. It does not hide them.
Invalidity alone leaves repair interactions usable even when their contextual
evidence is unavailable.

Apply the bound availability at the interaction root, including label-triggered
activation, rather than accepting a click and rejecting its command afterward.
A retained invalid value still has an explicit repair path; a low-level command
remaining structurally valid does not authorize the UI to bypass readiness.

Current selection, contextual possibility and structural support are separate:
a selected impossible choice stays visible; an unassessed domain does not
pretend to be validated; a structurally absent feature has no false control.

## Bound Interactions

For policy-bearing controls, application binding returns complete intents:
the semantic command, availability and declared focus behavior. React does not
choose a command variant, allocate occurrence IDs or reconstruct creation
focus. Deliberately retained fixed owner-plus-value mappings may still dispatch
directly; do not add wrappers merely to claim uniformity.

A projected empty outgoing workbench is not a persisted decision.
Its first pool, Fields outcome, room or takeover edit is one atomic
initialization intent. Takeover evidence can be decision-owned while the
visible Door 1 control is target-addressed. Binding preserves that distinction;
React does not create a decision and then issue a second edit.

Room replacement dispatches one command against the stable occurrence.
The engine decides compatible retention, defaults and structural cleanup.
React renders the returned state without follow-up resets. Changing a selected
continuation likewise invokes engine-owned reanchoring, not descendant walking
in the application.

Membership and chronological movement use different contacts. A Purchased or
Picked Up toggle adds/removes the participant. Move controls assess its proposed
position. Do not require valid chronological settlement merely to toggle the
action needed for repair.

A purchase row owns the inventory identity; its timeline row owns reached
trait, level or acquisition children. Mystery Boon source resolution belongs
to that acquisition child, not to unpurchased inventory. A fixed producer's
pickup has no invented identity editor, while a genuinely authored pickup
payload retains its own editor. The source trait dialog does not contain the
later pickup's acquisition controls.

## Drafts and Contextual Queries

Opening or rendering a workspace/dialog does not evaluate every candidate
domain. Picker activation invokes a prepared, address-bound capability.
Application projections translate its evidence into grouped/searchable options;
React neither constructs engine queries nor recomputes legality.

Local compound progress is session state. A complete reward or trait edit
dispatches one semantic command. Candidate availability, selected assessment
and structural child discovery are engine products, including nested targets.

The same typed child collection travels through persisted workspace and unsaved
draft projection. Each specialized binding supplies its domain, findings and
completed update; intermediate components must not enumerate every trait's
payload fields. An invalid selected child cannot remove the control needed
to fix it.

Trait dialogs retain a complete local draft. Focused queries hold siblings
fixed and use the exact outer prepared capability with the child selector.
An externally changed authored offer replaces that draft using the complete
authored value, not a handwritten subset of its payload fields. A changed
evaluation context alone retains unsaved edits and rebinds their candidate
capability to the new exact assembly. Keep the draft and its activated binding
coherent so refreshing context does not temporarily remove repair controls.
Sibling findings may prevent saving the complete outcome without disabling an
unrelated focused repair. Supported Start Over and draft-shape transitions are
engine-provided, not ad hoc UI-generated valid traits.

Cache query results by exact assembly, owner, complete draft and focused domain.
Reopening unchanged controls reuses results; edits invalidate the relevant
draft identity, and stale async results cannot replace newer state. Candidate
work must not scale with the number of controls rendered.

Ordinary offers, Echo Boon Boon Boon and Concave Stone reuse shared trait/payload
editors through distinct typed bindings. They do not share eligibility policy
by virtue of sharing a component. Their precise draft behavior and effective
value presentation belong to [Contextual Editor UX](CONTEXTUAL_EDITOR_UX.md#trait-offer-domains).

## Findings and Navigation

The engine emits semantic findings and evidence. The application resolves each
to one completed repair destination used both for navigation and inline
feedback. It never scans for a matching game room name or uses rendered
position as identity.

The destination selects route, biome, rail stop, inspector, tab and dialog as
needed. Navigation must work when entering from another biome and when already
inside the same occurrence on the wrong tab. Redirected focus scrolls/focuses
that same repair target rather than independently rerouting the finding.

Current findings apply a persistent red border to the existing control or the
smallest truthful container. No numbered inline badge requires separate
placement. Several findings may share a target; their individual explanations
remain in the route-scoped Findings panel. Aggregate counts are navigation
summaries, not replacement control identities.

Fine-grained findings require exact existing destinations. A truly coarse
finding may belong to its biome shell, but a missing child destination is a
projection failure, not grounds for silently falling back to the Timeline tab.

For example, a missing optional reward choice belongs to its Overview control;
the later pickup action does not inherit the border merely because simulation
encountered the missing value there. A nested trait finding can open its dialog
through the timeline launcher without hiding that launcher's occurrence.

After authored publication, reconcile stale session selections against exact
live owners. Clear a vanished finding selection independently from vanished
semantic focus. Do not select a substitute owner, change route/panel or create
an Undo entry. Native keyboard focus remains local React behavior.

An open Run State sheet similarly clears if its exact snapshot/launcher
disappears. Opening, closing or navigating the sheet uses published snapshots
and creates no authored command, candidate preparation or simulation.

## Project, File and Recovery State

These are separate authorities:

| State                                        | Owner                                       |
| -------------------------------------------- | ------------------------------------------- |
| Semantic choices and schema/catalog identity | Authored project                            |
| Undo/Redo snapshots                          | Authored history coordinated by application |
| Current file reference and saved fingerprint | Application file session                    |
| Raw recovery copy                            | Autosave adapter                            |
| Route panel, focus, open dialogs and drafts  | UI session                                  |
| Evaluation, findings and workspace           | Replaceable derived products                |

The normalized `ProjectDocument` is the profile file. Paths, filenames, save
baselines, Redux state and recovery metadata never enter it.

### File operations

The file menu provides New, Load, Save, desktop Save As and Publish to Game.
Publish opens its own profile/slot dialog and does not change the project file.

Browser Load uses file input; Save downloads a file. Browser Save As would be
the same operation and is omitted. Tauri uses native dialogs and a remembered
accepted file reference. Save writes that file, Save As writes and activates
another, and New clears the association when creating the replacement project.

`ProfileFileAdapter` owns explicit file operations and restoring the remembered
reference. A `ProfileFileReference` supplies its display name, activation and
write capability. It lives outside Redux, authored JSON and history.
`AutosaveRecoveryAdapter` independently reads, writes and clears recovery.
Platform globals are confined to adapters and composition.

Activate a selected file only after accepting its document or successfully
writing the intended snapshot. Cancellation, bad input, preparation failure or
write failure leaves the previous association and baseline unchanged.

### Atomic replacement

Loading prepares the whole document before publication: strict decode,
evaluation and immediate workspace projection must all succeed. Only then
replace the project/history, establish the clean baseline, activate the file
and queue autosave. Failure leaves the current project, history, evaluation,
file target and recovery value untouched.

The host stores path metadata and raw bytes, not planner semantics.
Desktop startup reconciles remembered disk content and recovery before
constructing the synchronous application; the application owns decoding and
canonical comparison.

### Dirty state and restart

Dirty state compares the current normalized project fingerprint with the last
explicitly loaded or successfully saved snapshot. Autosave never establishes a
clean baseline. If editing continues during a save, success marks the serialized
snapshot as saved while newer content remains dirty. Undo back to the saved
snapshot is clean without another write.

| Startup inputs                                             | Result                                                   |
| ---------------------------------------------------------- | -------------------------------------------------------- |
| Valid remembered file, no recovery                         | Open the file clean                                      |
| Equivalent valid file and recovery                         | Open clean with that file association                    |
| Different valid recovery and file                          | Open recovered work, keep disk baseline and Save target  |
| Missing/unreadable/invalid remembered file, valid recovery | Recover anonymously and clear stale association          |
| Browser recovery                                           | Recover anonymously, unsaved                             |
| Corrupt recovery                                           | Preserve/export raw content and block recovery overwrite |

Corrupt recovery does not erase a valid remembered source file. When no valid
project can open, show the route chooser and failure without creating a
placeholder. Successful explicit Load or Discard Autosave clears the recovery
blockade; simply choosing a route must not overwrite the corrupt value.

Autosave is debounced and observes effective authored replacements, including
edits, Undo/Redo, route creation and accepted Load. Navigation, findings and
derived publication do not trigger it. Autosave failures are reported without
blocking continued editing.

A shell fault boundary remains available after rendering or unhandled browser
failure. It does not continue an unknown partial interaction. It preserves the
source and allows another profile through the same preparation boundary.
Raw recovery export does not decode, migrate, activate a file or clear recovery.
Explicit discard removes only recovery, never the user's source profile.

## Presentation and Accessibility

The shell presents route identity, file/history operations, route overview,
ordered biome navigation and nonempty route-local indexes. Index visibility
comes from the same rows as its panel, not a separate availability query.
If an active index becomes empty after an edit, return to Route overview.
No route-specific reducer or second authored navigation tree is needed.

Use game labels for rooms, traits, rewards and features. Internal IDs and
terms such as frontier or canonical remain implementation vocabulary.
An authored continuation is selected; only evaluated history proves it entered.
Explain unavailable evidence without inventing a local error.

Use accessible dialogs, menus, tabs, comboboxes and ordinary React/CSS
composition. Preserve reason text independently of color, keyboard traversal
and nested Escape/focus behavior. Graph layout, if ever needed, is a projection
rather than topology authority; a generic form generator should not obscure
game semantics.

Commands use Primary, Secondary, Quiet or Danger treatment, or a named
specialized surface. At most one local Primary marks the forward/commit
action. Danger communicates subtraction but adds no distinct command or
recovery protocol. Green is status language. Layout helpers arrange controls;
they do not alter command behavior.

## Verification and Safe Extension

Keep policy in its engine/catalog owner. Application tests prove correct
consumption and reachability:

- exact project/evaluation pairing and atomic publication;
- one bound semantic intent per user edit;
- mandatory controls present despite missing or invalid values;
- precise finding navigation and the same inline repair target;
- readiness at every activation path, including label triggers;
- cancellation, async save races and recovery precedence;
- representative nested-target, hub, generated-pickup and Undo workflows.

Production enforces local construction invariants: declaration contacts,
duplicate semantic keys, coverage overlays and exact required lookups.
Test support independently enumerates expected owners, leaves and controls
from catalog plus persisted state. It must not import the projector to generate
its own expectations or duplicate engine eligibility. There is no production
shadow workspace traversed solely to prove the real one.

When extending a feature, obtain the complete supported engine product first,
adapt it into the appropriate projection/binding, and render it. A missing
engine fact is not permission to inspect history in React. A missing repair
destination is not permission to hide the control or invent a broad fallback.
