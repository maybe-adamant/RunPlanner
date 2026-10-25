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

Before route choice or an accepted open there is no project, history,
evaluation or library write. The route chooser does not create a
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
assessment prefix of their
[selected cut](SIMULATION_AND_VALIDATION.md#selected-cut) when present,
otherwise their reached materialized prefix. Retained materialization beyond
assessment cannot supply entered state, Clockwork outcomes or other evaluated
facts.

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
The engine decides compatible retention, defaults, structural cleanup and
timed-effect reconciliation before publishing one Undo step. Required Hermes
deliveries appear automatically at established contacts and expose Move and
reward controls. Imported missing deliveries retain an explicit Restore delivery
repair; opening a project does not insert them.
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

The application publishes one transient exact assembly and retrieves its
[candidate session](CANDIDATE_EVALUATION_MODEL.md#candidate-session) from it;
the ordinary evaluation selector returns only the data-only evaluation:

```text
Redux authored project + published exact assembly
  -> data-only ProjectEvaluation selector
  -> project-bound candidate projection session
  -> contextual option and picker projection
  -> structured workspace interaction catalog
  -> single UI interaction adapter
  -> React rendering and activation
```

Passing the exact assembly, rather than a general `evaluateProject(project)`
callback or artifacts recovered from public evaluation, keeps identity,
ownership and invalidation explicit. The assembly never enters stored plans or
authored history, and React does not inspect its callable artifacts.

The structured workspace owns the bound session and carries a typed interaction
descriptor for every live candidate control: its semantic owner,
declaration-owned choice domain, labels, authored selection and a
zero-argument lazy loader. React receives neither the session, the unbound
candidate service, a general evaluation callback, nor an API that accepts an
owner and arbitrary domain values. One UI interaction adapter is the only
React-side caller of those loaders. It invokes them on open, focus, pointer or
other explicit activation, caches results against the immutable workspace
interaction identity, and rejects pending results after an edit, Undo, Redo or
profile replacement. React does not walk topology to discover candidate
owners, rebuild grouping, choose a replay horizon or construct queries; room,
reward, batch-store, Fields-outcome, O-wheel, Hub, side-room and Room Action
order controls share this contract. I's bounded non-goal limit is a direct
declaration-owned authored field rather than a contextual candidate
interaction; room-target candidates read its value from their prepared
generation context.

The Route panel's Run modifiers section renders the released run-modifier
declarations by declared kind, including in Fresh File: a toggle or a checkbox
with a 0–100% slider. The Practice mode start point follows them in the same
section; its picker domain is evaluated when it opens. An
unchecked percentage modifier is native; its slider is disabled and shows no
value. Development builds, and release builds made with
`VITE_INTERNAL_FEATURES=1`, also render `internal` declarations. Application binding reads
engine-owned defaults and validates a complete replacement through the engine
before dispatch. Slider adjustments remain local until pointer release, navigation-key release,
blur or Enter, producing one history edit per gesture. Stored values outside
the declared domain clamp to the nearest bound on decode. Explanatory text
is each option’s hint, with accessible descriptions on its control.
Sibling and unrelated
edits retain that draft, and committing it uses the current authored siblings.
An authored multiplier change refreshes it; accepted document replacement clears
it even when the loaded project has the same persisted ID and multiplier.
The editor-session replacement revision is transient and does not enter history.

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

### Popup editors

A popup editor keeps a local draft and saves once when it edits one atomic
authored value whose intermediate states are not meaningful plans (trait
offers and their nested outcomes, Pom, Anvil, Judgment, Crystal Figurine).
Otherwise each control commits immediately (encounter customization, Loadout
Arcana and Fear, Hub room popover, keepsake equip results). A nested editor
saves into its parent draft; only the outer Save commits.

Every popup editor uses one dialog shell: eyebrow and title; an always-mounted
"Feedback" region; a sticky footer with Cancel and Save for drafts or Done for
live editors; Escape as Cancel or Done. Initial focus lands on the exact repair
control, else the first enabled control; focus returns to the launcher after
close. A draft editor's open state lives in the editor session, its draft is
replaced when the authored value changes and kept when only context changes, it
closes when its owner leaves reached context, and history shortcuts are off
while it is open. Its Feedback region reflects the draft through the engine's
draft assessment and matches the launcher at rest. Reset is "Clear" for a
draft-only reset and "Reset to unresolved" or "Reset to default" when it commits.

The selected trait outcome renders as "Selected outcome · {trait}" with one
labelled row per real choice and no repeated name or explanatory text. A
secondary effect such as Concave Stone gets its own block after the pick, with
its granted trait's follow-ups nested under its Grants row. A grouped outcome
(All Together sets, Natural Selection first-pass order) holds partial picks in
its rows and enters the draft only as a complete engine-published value, so a
partial group never enables Save. Row choices, gating and resulting values come
from the engine; React does not derive them.

Ordinary offers, Echo Boon Boon Boon and Concave Stone reuse shared trait/payload
editors through distinct typed bindings. They do not share eligibility policy
by virtue of sharing a component. Their precise draft behavior and effective
value presentation belong to [Contextual Editor UX](CONTEXTUAL_EDITOR_UX.md#trait-offer-domains).

## Findings and Navigation

The engine publishes one assessment issue for a blocked route, with its
semantic repair owner and detailed reasons. The application consumes that
selection directly; it does not sort findings into its own repair agenda.
Issue and reason owners resolve through the same destination map for navigation
and inline feedback, never through matching game names or rendered positions.

The destination selects route, biome, rail stop, inspector, tab and dialog as
needed. Navigation must work when entering from another biome and when already
inside the same occurrence on the wrong tab. Redirected focus scrolls/focuses
that same repair target rather than independently rerouting the finding.
Finding navigation updates the selected tab; clearing or advancing the issue
removes its selection without restoring an earlier tab or overriding later
manual navigation. Explicit navigation still selects its requested destination.

Timeline navigation follows the application-owned presentation that contains
its control, including nested reward and trait controls. A Ship phase publishes
its tab together with its rows and lifecycle entries; React consumes that
selection without rebuilding phase ownership. Rendering selects an ordinary
room timeline, one explicit Ship phase, or Ship repairs. An omitted phase does
not mean all phases, and a missing action destination does not imply repairs.
Inactive wheel choices navigate to Overview to restore their phase; retained
action rows navigate to their repair controls.
Stale session tabs may recover to Overview after an edit; newly assembled
semantic destinations must name an existing presentation target and an explicit
room tab when hosted by an occurrence. Placement findings target the existing
placement repair row (Restore delivery for Hermes); inline Item and Phial findings target their own controls.

The compact repair banner shows a title, its location below, and optional detail
only when it adds a constraint or repair choice. It sits above the biome title
in the structure rail, or across the content width on Route and read-only index
panels. A valid route reserves no empty banner. Multiple reasons for one repair
do not become multiple tasks or an expanded findings list.

Global counts, highlights and selected-repair identity use this one issue;
detailed explanations and exact child feedback remain in their local editors.
Repair feedback marks the control whose edit repairs the finding; containers
are navigation anchors and never paint. No numbered inline badge requires
separate placement, and later detailed findings do not become additional
highlighted route tasks.

The engine names the exact repair, and the projection maps it to a control:

- a sequential repair (batch rule, then doors one by one, then the door
  selection) names only its next edit;
- one choice spread over several controls (door or wheel pick radios) rings
  each enabled control;
- a requirement spread across a map marks that map's requirement box;
- an action that should not exist marks its Delete, a misplaced action its
  Move, and an unplaced action its Restore or Add; removing the offending
  action is preferred over requiring an unrelated one;
- a duplicate in an unordered or sequential draw marks the slot that repeats
  an earlier slot;
- a finding that only restates another finding is not published.

An addressless row control is named by the projection (`WorkspaceFindingControl`),
never inferred in React. Guard tests keep finding paint on controls.

Fine-grained findings require exact existing destinations. A truly coarse
finding may belong to its biome shell, but a missing child destination is a
projection failure, not grounds for silently falling back to the Timeline tab.

For example, a missing optional reward choice belongs to its Overview control;
the later pickup action does not inherit the border merely because simulation
encountered the missing value there. Findings repaired inside a dialog fold
into one outer finding per dialog owner; that outer finding navigates to the
launcher without hiding the occurrence or opening the dialog, and the dialog's
own feedback entries navigate to the control they correct once it is open.
Opening the dialog remains an explicit editing action. Advancing to the next
issue does not steal focus, navigate, change authorship or create an Undo entry.

After authored publication, reconcile stale session selections against exact
live owners. Clear a vanished finding selection independently from vanished
semantic focus. Do not select a substitute owner, change route/panel or create
an Undo entry. Native keyboard focus remains local React behavior.

An open Run State sheet similarly clears if its exact snapshot/launcher
disappears. Opening, closing or navigating the sheet uses published snapshots
and creates no authored command, candidate preparation or simulation.

## Project, Library and Session State

These are separate authorities:

| State                                        | Owner                                       |
| -------------------------------------------- | ------------------------------------------- |
| Semantic choices and schema/catalog identity | Authored project                            |
| Undo/Redo snapshots                          | Authored history coordinated by application |
| Stored plans                                 | Project library adapter                     |
| Open item key and pending writes             | Library saver                               |
| Opened snapshot and the latest write failure | Library session slice                       |
| Home tab or editor, Library folder shown     | Library session slice (UI session)          |
| Route panel, focus, open dialogs and drafts  | UI session                                  |
| Evaluation, findings and workspace           | Replaceable derived products                |

The normalized `ProjectDocument` is the stored plan. Keys, file names, Redux
state and session metadata never enter it.

Application scale is a local presentation preference, independent of plans and
Undo/Redo. The shell owns keyboard/wheel shortcuts and CSS
scaling; a browser-storage adapter persists the preference for web and desktop.
Map zoom remains independent. Responsive layout uses the scaled available space;
pointer gestures and floating overlays account for screen versus layout coordinates.

### App home

The app opens on Home with no plan open. Home's header has the brand and About
(version, build, schema, catalog, the update check, a bug report and the
keyboard shortcuts) on one row, and the Library, Catalog (desktop only), Game
and Settings tabs on the next, with the Library's New folder, Import… and New
plan at the row's end. Screens have no page titles: panels start under the tab
row at one place on every tab, and the first panel's heading carries the
screen's context from its projection ("Library · 10 plans · 3 in game" for the whole library, with "· 4 shown"
while a search or chip filters it, "Catalog · 4 plans" for the entries shown, "Game module" with
"Ready · 4 slots filled · Slot 2 plays next" leaving out what is not known); the Game tab says "· update" or
"· event" in visible text while the game module has an update or a community
event is active. Which Home tab shows, or whether the editor shows, and the
Library folder shown are UI-session state in the library session slice; opening
any plan shows its editor, and closing it (its item deleted) returns to the
Library. Going Home keeps the open plan open. Settings holds the app scale and
the Arcana and Vow presets.
App notices (an update, an ended event) show under the shown screen's header.

Arcana and Vow presets are planner settings, kept beside the app scale in
device-local storage by `createBrowserLoadoutPresets`; they are never project
state, history or plan data. Their own versioned format holds named manual Arcana
selections and named Vow ranks as separate kinds; on load, cards and Vows the
catalog does not declare are dropped and Settings says so. Settings lists each
kind with Add, Edit, Rename and Delete (Undo restores the preset where it was).
Add and Edit open the Loadout's own Arcana or Fear board on a loadout of the
preset's own through the engine's edit domain, an Arcana preset with no Vows and
a Vow preset with no Arcana. While presets of its kind exist, the editor's Arcana
or Fear picker shows them as chips above the board: `planManualArcanaReplacement`
and `planFearRanksReplacement` turn one into the loadout commands, applied as one
undoable step, or refuse it, with the reason in visible text, when the plan's
starting Grasp could not hold the result. Fresh File has no pickers, so no
presets.

Navigation is mirrored into the History API by `installNavigationHistory`: each
change of Home tab, Library folder, open plan or editor section (Route, Draft,
Loadout, a biome, settings) that follows the user's input (a pointer press, key
or click) pushes one entry, a change that leaves the location as it is pushes
none, and the first location replaces the initial entry. A change the app makes
by itself, with no input since the last entry was written or restored (a
restored editor correcting its section, say), rewrites the shown entry, so it
never discards the entries ahead of it. Back
and forward (the browser's, the mouse's back and forward buttons, Alt+←/→)
restore the entry's location: a Home entry shows that tab and folder, writing
the open plan's pending edits when leaving the editor; an editor entry reopens
its plan, found by key or by `projectId` after a rename or move, and shows its
section. A plan no longer in the library lands on the Library with a short
notice, and the entry is rewritten to where it landed. Navigation stays
UI-session state; authored history and Undo are untouched. In the desktop app
the mouse buttons and Alt+←/→ also step history when the WebView has not done
so itself within a moment.

### Plan operations

Every open plan is a library item, and every authored edit is saved: there is
no Save, no unsaved state and no recovery copy. The Library offers New plan (a
route chooser), Import…, New folder, Open folder and Browse catalog (to the
Catalog tab), and per plan Duplicate, Move to…, Delete and Open as icon buttons
whose hint names the action; the Catalog
offers Add to library; the editor offers Discard changes. `ProjectOperations`
owns them:

- **New plan** creates the route's project, files it in the folder shown and
  opens it.
- **Import…** files each picked file in the folder shown without opening any,
  with one summary notice.
- **Duplicate** writes the plan's pending edits when it is open, then files a
  copy named "X (copy)" with a new `projectId` from `reidentifyProjectHistory`
  in the same folder, without opening it.
- **Delete** moves the item to the recycle bin and keeps its content in memory
  for the notice's Undo; deleting the open plan, or a folder holding it, closes
  it. Folders are created, renamed and deleted the same way, a deleted folder
  keeping its subfolders and plans for Undo; **Move to…** refiles a plan in
  another folder, and the saver follows the open plan wherever it moves.
- **Discard changes** replaces the project with the document it was opened as,
  through one undoable history step.
- An event's project opens the same way as an imported copy that always takes
  its own identity.
- **Add to library** files a catalog entry's verified plan at the library's
  top level as a copy with its own identity, renamed to the entry's title
  (template plans predate plan names), without opening it, and records the
  entry's id with the copy's `projectId` in the library session.

Opening any plan first writes the open one's pending edits; if that write
fails, the open plan stays and the failure is reported. The opened plan starts
a new history. Opening the plan already open only shows its editor.

### Library screen

`projectLibraryView` turns the listing into one screen: the breadcrumb, the
shown folder's subfolders (with their plan counts) above its plans, and per
plan its route and loadout, biomes planned, the slots it is in and when it was
edited; a file the planner cannot open shows why. A search or a chip (All, one
per route in the route chooser's names, In game) searches the whole library,
and each result names its folder. Sort is kept per folder. The slots come from
`projectLibrarySlotLinks`, which links a slot to the plan holding its
`projectId`: current when the slot's fingerprint is the plan's as it is now,
older with the reason otherwise ("edited since sent", or "needs rebuild" or
"send again" for the module). `ProjectOperations.inspectLibraryGamePlans` compiles only the
plans a slot holds, cached by key and modified time, and the open plan as it
is now. The In game column is the shared split send control, quiet and of fixed
width, from `projectLibrarySendButton`; its picker reads the plan through
`ProjectOperations.inspectLibraryGamePlan` only when opened, and its sends go
through `publishLibraryPlan`, which sends the open plan through the editor's
path (see [Plan Slots and Publication](PLAN_SLOTS_AND_PUBLICATION.md)). A deleted plan's
notice names the slots that still hold it.

### Catalog screen

`CatalogFeedController` holds the host's verified catalog index (loading,
ready, offline from the cached index, could not load, or off without a catalog
key); the start-up read and showing the Catalog refresh it, the latter
retrying a failed fetch. `projectCatalogView` turns it into the screen:
category tabs with their entry counts (All first), the categories and their
labels coming from the index in its order and a category without entries
having no tab, then
the shown category's entries searched by title, description, author and tags,
filtered by a route chip (Any route, then each route in the route chooser's
names) and a tag, and sorted by name or route. Each row shows the title and
description, route and biomes ("4 biomes · to Tartarus"), tags and author,
and offers Add to library, "In library" with Open, or "Needs a newer planner"
for an entry saved in a schema the loader does not open. An entry is in the
library while a library plan holds the `projectId` recorded when it was added,
so renaming or moving the copy keeps the link and deleting it offers the entry
again; a copy made by Duplicate is a plan of its own. A category change clears
the tag filter.

### Game screen and the editor's send control

The Game tab holds the game module (status, its install or update as the one
primary action, and its facts), the game location, the community event card
and the table of every slot. `GameStatusController` shares the latest host
status between Home and the editor and is refreshed when either shows, on
window focus and after every game action. `GameModuleHost` is the desktop
adapter over the host's target, status, install, remove and publish commands;
the host persists the game target and owns every compatibility and install
decision. `projectGamePanel` groups the reported facts into the location, one
overall state, ordered steps (each issue once) and the facts list;
`projectGameProfileChoices` feeds the profile picker. `projectHomeSlots` lists
the event slot and the twelve plan slots with the library plan each holds (or
"Not in library"), why an older one differs, which plays next and the outdated
slots a rebuild would write. Home plays a slot next and opens a linked plan;
it never sends or clears slots, except that development builds keep Import
event folder and Clear event.

The editor's split send button, shared with the Library's rows as
`GameSendSplit` and `SendSlotsPanel`, sends the open plan. `projectGameSendButton`
picks its slot (the plan's own slot, the one that plays next when it has
several; else the slot last sent this session while still empty; else the
first empty one) and its label ("Send to slot N", a quiet "Slot N · up to
date" that opens the picker when that slot holds the plan as it is now, or
"Send to game…" with no slot), from the evaluation's eligibility without compiling unless the plan is
in a slot. Its ▾ opens the slot picker, `projectSendSlots`: the plan's own
slots with Update for an older one, every slot to send to (Replace asks
first), why the plan cannot be sent with Show findings, and the last send's
failure. A send compiles the open plan as it stands and writes nothing; it adds
no authored edit or history step. The `gameSendSession` slice holds the
loaded project's last sent slot and the latest send failure as UI-session
state, cleared by any document replacement. The button's transient Sending and
three-second result labels are component state. The game target is neither
authored state nor Redux state and never enters history.

The host owns the [distribution](GAME_MODULE_DISTRIBUTION.md) and
[slot](PLAN_SLOTS_AND_PUBLICATION.md) contracts; the Game tab presents them:

- **Game location** offers the platform's r2modman profiles (none on macOS)
  and a folder picker, and Forget. Switching away from a planner install asks
  whether to keep or remove that copy. Replacing a copy the planner did not
  install, or one r2modman manages, asks first and explains r2modman's effect
  on it. The ModpackLib step links to its Thunderstore page. About offers the
  desktop bug report and reveals the last one written.
- **Slot table.** The event row (while slot 0 holds a plan, marked as the
  community event, with no send action) and the twelve plan slots share fixed
  columns (slot, library plan, route, aspect, sent, next run, Clear and Open)
  in one-line rows of one height, so no change of state moves the table. A
  linked slot shows its library plan as current or older with the reason in a
  few words, shortening the name first and never the state; any other slot
  shows its plan's name and that it is not in the library. Next run is a radio
  group: the slot that plays next is filled, a playable slot hollow, an
  outdated or unreadable one disabled; choosing one sets the active slot
  without resending and re-reads the slots, and a failed write leaves a short
  notice under the table. The route comes from the catalog and the loadout
  reads as the weapon's short label and the aspect without "Aspect of"; sent
  is a compact relative time and an unreadable slot shows only that.
- **Rebuild** shows under the table while an outdated slot has a source, with
  how many need it and the last rebuild's summary; a slot that could not be
  rebuilt says so in its row with one reason line under the table.
- **Clear** leaves a floating notice with Undo for about eight seconds.
- **Event notice.** The notice area shows one notice, an app update first,
  otherwise the active event with its title and end, Set as active, Details
  (title, description and rules), Open project, Copy link and Dismiss. Set as
  active is absent while the notice says why the event cannot be played, and
  reads Active, disabled at the same width, while the event slot is active and
  holds a plan the module admits. A dismissal is remembered per event id in
  the browser profile; the event slot is still written. When an event ends
  while its slot was active, the notice says which slot the next run uses, or
  that it has no plan.

The send button's states:

| State                              | Label                         | Clicking                                  |
| ---------------------------------- | ----------------------------- | ----------------------------------------- |
| Module not ready                   | Send to game                  | nothing (Set up the game on the Game tab) |
| Engine reports the plan ineligible | Send to game                  | nothing (the picker's reason)             |
| The slot holds the plan as it is   | Slot N · up to date (quiet)   | opens the slot picker                     |
| A slot to send to                  | Send to slot N                | sends                                     |
| No slot to choose                  | Send to game…                 | opens the slot picker                     |
| Sending                            | Sending…                      | nothing                                   |
| Result, for 3 seconds              | ✓ Sent · Slot N or ! Not sent | nothing                                   |

The picker explains a plan that cannot compile from the compiler's error code:
a known route, extent or opening code gets its own sentence, and any other
failure asks to resolve the plan's findings, never showing raw compiler text.
A hidden status region announces each result. A failed send, or a send whose
slot was not made active, is kept as UI-session state until the next send or a
document replacement and shown in the picker. A Library row's copy of the
button names the plan's default slot (the one that plays next, else its first)
with "+N" for its others, and learns whether the plan can be sent only when
asked: opening the picker or sending loads, simulates and compiles the stored
file as a public project opened and sent would be, and a send reuses that
compile while the file is unchanged. A plan that cannot be sent opens the
picker with the reason and Open in editor; a file the planner cannot open has
no button. A Library send leaves the editor's send session alone, and deleting
a library plan never touches a slot.

### Project library

`ProjectLibraryAdapter` stores plans as complete documents addressed by an
opaque key in a folder (a `/`-separated path, `""` at the top), lists every
plan and folder, creates, renames, moves and deletes folders, moves a plan
between folders, and keeps the library session (whether the pre-library file
was offered, and the copy each catalog entry was added as). The desktop host keeps plans as plain `.runplanner.json` files in
`RunPlanner/Projects/` under the platform documents folder and its subfolders
of any depth, created on demand; the key is the file's path inside the library,
its name `<plan name> (<8 hex digits of the projectId's SHA-256>)`, made
portable, and folder names are plain portable names. The host scans
recursively, reading only each file's head (a bounded prefix), reports a
subfolder it cannot read instead of failing the scan, writes atomically, refuses a
document without a project identity and name, renames a file within its folder
only when the plan's name or identity changes (never over another file), and
deletes plans and folders to the system recycle bin. It keeps the session in
the configuration folder. The browser host keeps the same model in IndexedDB,
a plan's folder a path field and folders their own records, without a folder to
reveal or a bin. Listing scans each time; there is no index.

Library meaning stays in the application. `createProjectLibraryOperations`
classifies entries as openable, too new or unreadable against the loader's
supported schemas, never dropping one, and names a plan from before plans had
names by its file stem. Identity follows the engine across the whole library:
a stored copy sharing an older plan's `projectId` (oldest by modified time
keeps it; the open plan always keeps its own), or an imported file whose
identity the library already holds, is loaded, given a new identity through
`reidentifyProjectHistory` and written whole; a copy stored in an older schema
keeps its original first, as its first edit would. Only a listing
re-identifies; lookups for other operations read the library as stored, and
library operations run one at a time. A deleted file's bytes are kept in
memory, readable as a plan or not, so undo puts them back at the same key on
every platform; undoing a folder deletion restores all of it or nothing. The
recycle bin is the longer-term net.

### Continuous save

`LibrarySaver` watches the present project. An effective authored change
(edit, Undo/Redo, discard) schedules a debounced write of the open item;
changes coalesce, one write runs at a time and each writes the newest
snapshot, so the last edit wins in order. A write that refiles the plan under a
new key moves the saver to it; while the open plan or its folder moves, writes
wait and then resume at the new key. Nothing says the plan is saved; a failed write
is recorded in the library session and shown as "Not saved · Details" in a slot
the editor header keeps for it; the next edit or flush retries it, and a
success clears it. Navigation, findings and derived publication do not write.

A plan opened from an older schema keeps its original before the first write
replaces it: the desktop library recycles a copy of the file, and the write
waits until that succeeds.

Pending writes are flushed before another plan opens, before an update
installs, when the page is hidden, and before the desktop window closes: the
host holds a close request while the planner writes, closing silently once the
write succeeds. Further close requests meanwhile are absorbed. A planner that
does not take up the request within a few seconds is closed; once it has, its
write gets a longer bound that covers keeping an original. Only a write that
still fails asks "Not saved — close anyway?" (Close anyway / Keep open), and
the host keeps the window open while the user answers. The browser asks before
unloading while the open plan has an edit not yet written.

### Atomic replacement

Opening prepares the whole document before publication: the shared application
loader's compatibility check and strict engine parsing, evaluation, and
immediate workspace projection must all succeed. The
[authored-document boundary](AUTHORED_PROJECT_MODEL.md#authored-document-boundary)
owns migration support. Only then is the project replaced, with a new history
and the opened snapshot. Failure leaves the current project, history,
evaluation and library unchanged, except that an import or New files its item
before it opens.

### Startup

Startup shows the Library with no plan open. The file the planner kept open
before plans lived in the library is offered once on the Library for import;
importing or declining it is remembered. An unsaved project the pre-library
planner autosaved is offered alongside it as "Recovered unsaved plan" when it
differs from that file, and kept until it is imported or declined.

A shell fault boundary remains available after rendering or unhandled browser
failure. It does not continue an unknown partial interaction. It offers a
return to the Library when a plan is open, a bug report in the desktop
application, and a reload, which starts on Home.

## Presentation and Accessibility

The shell presents route identity, file/history operations, the Route, Draft
and Loadout panels, ordered biome navigation and nonempty route-local
indexes. Index visibility
comes from the same rows as its panel, not a separate availability query.
If an active index becomes empty after an edit, return to Route.
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

Focused tests live under `apps/planner/test/`, mirroring their production
neighborhood in `src/`. Architecture and product-loop suites remain separate
test neighborhoods; fixtures and reusable harnesses stay under test support.
Production directories contain no test files.

Keep policy in its engine/catalog owner. Application tests prove correct
consumption and reachability:

- exact project/evaluation pairing and atomic publication;
- one bound semantic intent per user edit;
- mandatory controls present despite missing or invalid values;
- precise finding navigation and the same inline repair target;
- readiness at every activation path, including label triggers;
- cancellation, ordered library writes and their failures;
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
