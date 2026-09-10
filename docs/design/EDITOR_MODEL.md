# Editor Model

## Purpose

This document defines how the external React application presents and edits
the authored project while consuming simulation results. It owns UI language
and interaction policy, not game rules or persisted topology structure.

## Editor Principle

The editor is a projection and command surface:

```text
authored project + simulation result
  -> WorkspaceBiome presentation projection
  -> React components
  -> semantic command
  -> replacement authored project
  -> fresh simulation result
```

The UI may tolerate incomplete and invalid authored plans. It must not hide,
repair, or silently delete them merely to keep the view visually legal.

The batch-level projection follows the selected-route project contract.
F/G/P author an ordinary batch Reward Pool, H authors its Fields outcome, I
authors one biome-wide Clockwork limit without a base store, O may derive its
outgoing store from a source wheel, and Q owns no ordinary base store. N first
projects its bounded PreHub decision with Hub as the sole Door 1 room choice,
then its fixed Hub board. All variants use the same semantic command and finding
ownership rules.

## Application Shell

The shell keeps route choice at the project boundary and exposes:

- a compact header with route identity, file operations, history, and About;
- route-local navigation beginning with Route and the configured biomes;
- nonempty NPC, Traits, Resources, Shrines, and Wells indexes after a
  separator;
- one shared route-structure workspace;
- a route status and findings surface;
- one focused semantic inspector.

The exact desktop composition may evolve. Tabs and panels are presentation,
not project identity.

Route and panel navigation is one generic UI-session model. Before a project is
open, the application presents a catalog-driven route chooser. Once open, the
active route is the document's `route.routeKey`; the session retains one tagged
route panel: overview, one catalog biome, or a route-local read-only index. The
navigation presents Route followed by the ordered biome rail as the primary
run structure. A separator then introduces only the nonempty NPC, Traits,
Resources, Shrines, and Wells indexes. Index visibility uses the same
application-projected rows as its panel; it does not create an empty authoring
destination. If project replacement or Undo removes the active index's last
row, the route overview is the safe fallback.

Application state and React composition do not define separate Underworld,
Surface, F, G, NPC, or other route-specific navigation fields. The selected
route label, valid biome panels, and initial route contents come from the
normalized catalog and the open document. A semantic finding selects its
owning biome through the same generic session action; route-owned findings
select the route overview and project-owned findings retain the current
top-level location. A separate exact-owner navigation action moves from the
NPC index to the containing biome and opens its existing room-local detail
surface without creating authored history.

## Product Language Boundary

Product-language policy belongs at the presentation boundary. React owns the
static labels and accessible names that describe its components; projection
presentation functions own evidence-dependent route feedback, finding
destinations, and candidate explanations. Together they use routes, biomes,
rooms, doors, rewards, reward pools, Shops, Preboss, Hub rooms, findings, and
evaluation status. Internal model terms such as `occurrence`, `batch`,
`frontier`, `topology`, `canonical`, and `progressive` remain valid
implementation vocabulary but do not become unexplained product copy.

Authored selection and evaluated entry remain distinct in both the model and
the UI: a selected continuation is a `Room selected`; only an evaluated entry
is a `Door taken`. The projection presents evidence-dependent explanations in
the same language. React renders that projected evidence rather than translating
semantic evidence, topology state, or candidate support locally.

## Workspace Projection

The application projects every configured biome into one exhaustive
`WorkspaceBiome` envelope. It preserves semantic owner and occurrence
identity, attaches engine-backed interactions and findings, exposes progressive
coverage and the first incomplete authoring horizon, and references every
active occurrence workbench. React renders that product; it does not traverse
authored topology, decode semantic addresses, or infer room and reward
capabilities.

The projection distinguishes selected authorship from evaluated history. A
selected continuation is a `Room selected`; only an evaluated entry is a
`Door taken`. Incomplete and context-invalid material remains visible at its
stable owner, while candidate evidence and findings appear only where the
engine's coverage reaches them.

Normalized declarations select the supported start, ordinary-decision,
Preboss, Hub, side-room, encounter-phase, and completion products. The
application may compose those products into one workspace but must not create a
second topology, reward, lifecycle, or candidate policy. Every semantic owner
has one interaction path and one finding destination even when several views
reference it.

`STRUCTURED_EDITOR_WORKSPACE.md` owns the concrete route rail,
Overview/Layout/Timeline/Doors placement, ordinary and Hub workbenches,
responsive layout, and focus behavior. `CONTEXTUAL_EDITOR_UX.md` owns
selector presentation. This document owns the application-state and semantic
projection boundary shared by both.

## Rows Versus Domain Language

Rows, cards, lanes, graph nodes, and columns are valid UI concepts. They do
not enter authored state, canonical snapshots, history, or findings.

The UI may produce a decision-card series for F and a Hub-oriented surface for N
while both consume the same semantic ownership conventions.

Room components use the persisted domain `occurrenceId` as their React key.
Structural components without a room occurrence use their stable semantic
address. The UI does not invent a second occurrence identity.

## Topology Editing

All topology edits dispatch commands from `AUTHORED_PROJECT_MODEL.md`.

Room replacement uses one grouped contextual picker:

```text
Combat
  Combat 03
  Combat 06
Miniboss
  Shadow-Spiller
```

Room kind is transient grouping and search vocabulary, not a required first
selection. An authored target is one stable Room Occurrence whose current
selection is a concrete `gameName`. Choosing a concrete replacement dispatches
one atomic `ReplaceOccurrenceRoom` command and preserves its `occurrenceId`.
The command retains declaration-bounded compatible room-local leaves; React
does not decide which values survive or dispatch follow-up resets. Contextual
support, grouping, zero/one-candidate behavior, and selected-invalid retention
are defined in `CONTEXTUAL_EDITOR_UX.md`.

Creating a previously absent target allocates an occurrence ID and installs
the declaration's complete offer-time defaults in the same semantic command.
If it is also picked, the command installs any required entry-time defaults.
Once that target exists, its ordinary selector has no empty value. Its game
name can be replaced, while the occurrence itself can be removed only through
an explicit owning structural command.

Selectors do not hide a game name merely because another occurrence already
uses it. Repeated game names are legal authored structure; creation caps,
appearance caps, and eligibility are simulation results.

Picked continuation should use a single-choice interaction visually aligned
with physical exit targets. Radio semantics are appropriate because exactly
one target continues. A single-exit decision may select its newly specified
target in the same semantic command group.

F/G/H/P takeover Preboss batches use the same normal-exit language. They
create one Preboss occurrence per eligible physical exit, with the
declaration-owned Shop or Free Reward role aligned to that exit. Selecting the
entered Preboss target is ordinary exit-selection topology; the editor does not
add a second entry-mode selector. O/Q use the same evaluated takeover flow with
a declaration-owned width-one physical shape, while N exposes its fixed
width-one Preboss Shop only through the completed-Hub handoff in
`HubDecisionWorkbench`.

I keeps its post-goal preboss and ordinary peer in one decision card because
they are one game batch. `Add Next Decision` is I's only frontier-advance
action: before Goal completion it derives a Goal on the first exit, and after
Goal completion it derives `I_PreBoss02` there. A second exit, when present,
renders an ordinary room leaf. Both targets are directly pickable through the
same single-choice interaction. Picking the Preboss visually closes the biome,
while picking the peer exposes its downstream decision. I never renders a
separate Preboss action because its Preboss is a generated peer in the same
ordinary decision.

Shop editors follow the shared entry-materialization rule. An unpicked shop
target renders as a dead leaf without requiring or exposing shop inventory.
Picking it atomically installs the profile's complete defaults when absent and
exposes its shop editor. Switching the pick away may retain those values
dormantly, but the editor hides them because they produce no current game
facts. Incoming and free-reward editors remain visible on unpicked targets
because those offers materialize on their doors.

An Anomaly-capable selected G target exposes one bound `Replace with Anomaly`
action on its target card. The engine continues to project target-local
capability for every door, while the editor reserves one stable action footer
across sibling cards and exposes the action only on the picked door. The
resulting occurrence retains its reward editor, presents its Anomaly map as
the door's Room control before Reward, and exposes its authored success and
exact revert action from the same aligned footer. Fixed `GeneratedAnomalyB`
remains a catalog and lifecycle fact rather than a redundant editor control.
On the selected spine, the Anomaly occurrence exposes its declaration-owned
width-one outgoing decision through the ordinary door workbench. Its concrete
target and reward remain editable while selection is declaration-derived, so
React adds neither a player branch selector nor a special return control.

A selected, details-active declared Midshop with materialized Shop state
exposes the bound Zagreus Add action from its Room features. Once authored,
the same feature surface exposes the corresponding Remove action. The persisted
contract remains a sibling continuation in the containing decision, where the
normal lane and fixed `C_Boss01` card are independently inspectable and
selectable. Findings never hide an already-active selected source control;
unpicked Midshops have no active contract control. `C_Boss01` uses the same ordinary
width-one continuation presentation. React supplies no eligibility, topology,
reward, or return policy.

A selected, details-active N/F/G/P room with declared natural-Chaos capability
exposes one bound Add action in Room features. Once authored, the same feature
surface exposes its bound Remove action. Adding an optional room-local
gate configures the current room and is not itself a peer of the primary
route-navigation choice. Once authored, however, the gate is a genuine
sibling continuation in the containing decision, where the normal lane and
concrete Chaos room are independently inspectable and use the same single-choice
interaction. The Chaos card exposes its declaration-owned map domain and fixed
encounter and reward facts without inventing editable fixed leaves. Invalid
active gates retain those controls. Selecting
Chaos publishes its downstream continuation as the ordinary next-step frontier.
React supplies no source, spacing, depth, map, reward, or return policy.

A materialized Shop preserves declaration order for inventory rows while
deriving `Purchased` membership from exact `interactShopOffer` references in
its one occurrence-owned `roomActions.order`. Each inventory row exposes only
that membership toggle; Room Timeline owns ranked move controls over
participating purchases. It uses the same ranked-prefix presentation as the
other room actions: numbered participant cards, compact arrow controls, and
pointer reordering. Unpurchased initial offers remain editable in Overview and
do not appear as active or generic repair rows in Actions.
Membership changes are structural set edits and do not activate chronological candidate evaluation;
the same rule applies to declaration-produced pickup and Fields interaction
checkboxes. Candidate support is evaluated only for move proposals; impossible positions remain visible
with their evidence, and a selected invalid order remains editable for repair.
Per-offer Shop-purchase markers and finding destinations remain stable. A stale
base purchase repairs through the same Purchased interaction, including after
room replacement removes the active Shop owner; it never gains a second generic
remove control. An individual purchase or generated-pickup failure remains
owned by its exact action or acquisition-entry address.
The Shop inventory row remains the sole editor for what was bought. Its
Room Timeline row may edit acquisition-time trait, Pom, or disposition children,
but cannot change the purchased reward identity. A producer-owned pickup retains
an outer reward editor only when its payload remains authorable. A declaration-
fixed Narcissus pickup has no false identity picker, while an unresolved Blind
Box payload remains editable on its canonical Room Timeline row.
The Timeline action title names the stable pickup interaction and does not change
when Time Piece or Artificer is selected. That acquisition disposition is shown
separately as `Pickup outcome`; trait and Pom launchers share one aligned compact
trailing control strip and one unspecified/invalid/valid color language. Every
Timeline action reserves the same compact deletion slot: an engine- or
interaction-projected removal is red and enabled, while required actions and
Overview-owned participation remain visibly grey and disabled.

Every generated I preboss offer is a distinct Room Occurrence and follows that
same contract; it does not introduce an I-specific shop mode.

A declaration-produced optional pickup uses the same Room Timeline chronology
as a Shop purchase: membership and position come from the exact action
reference, while the pickup row owns any reward, trait, or Pom repair controls.
The Story or other producer control owns only the source choice. React never
derives produced items from a selected trait key and never nests acquisition
children inside the producer's trait dialog.

Travel Deal and Gold Gold Gold source selection remains chronology-derived.
Overview does not add a source selector or generated-payload approximation.
Any future presentation that authors their dependent payload must consume the
candidate frontier at the exact triggering action prefix; Shop-entry history
and a first-purchase slot alone are insufficient when earlier same-room actions
can change eligibility.

An I combat target renders its derived Goal marker instead of a reward editor
when the current simulation resolves Goal. Its complete potential Tartarus
reward remains dormant in authored state. When an upstream edit makes that
same occurrence NonGoal, the editor exposes the retained reward value; it does
not install a new default or ask the user to author Goal versus NonGoal.

Generated continuation is direct rather than a persistent `Next Step` mode.
When a selected room directly precedes the next generated decision, the room's
outgoing section already renders the ordinary empty door workbench. This is a
pure projection, not a phantom authored decision. Its first reward-store,
Fields-outcome, ordinary-room, or takeover edit dispatches one complete atomic
command. React neither reconstructs the command nor chains decision creation
with another edit, and one undo returns to the provisional cards.

The provisional frontier and an authored empty decision use the ordinary
decision layout immediately. Their Door 1
Room picker offers the declaration-supported ordinary room choices and, where
the source admits it, a takeover Preboss choice. Selecting an ordinary room
(including I's `retainNormalPeers` Preboss) creates one target. Selecting a
`takeOverNormalDoors` Preboss dispatches decision-owned atomic creation at an
uncommitted frontier or atomic replacement for an authored envelope. The
shared picker does not flatten their
ownership: Door 1 remains target-addressed, while takeover evidence and its
intent remain decision-addressed.

An empty envelope may be the declaration-admitted terminal decision after the
ordinary progression bound. That still presents the same Door 1 picker; it is
not a separate Preboss authoring card. Ordinary setup can explain why an
ordinary room is unavailable, but neither setup nor findings hide a supported
takeover option. Fixed linked transitions and N's completed-Hub handoff remain
their own declaration-owned controls.

There is no generated `Add doors`, `Add Preboss doors`, `Check Preboss rooms`,
or navigation-only `Go to next step` action. An existing populated ordinary
batch does not expose retroactive conversion to Preboss. An authored takeover
batch continues to expose its exact reconciliation action when it needs
repair.

React may share the decision container, but it does not reinterpret takeover,
mixed, declaration-fixed width-one, or completed-Hub Preboss semantics.

### Room feature presence and resource placement

Room-feature controls consume one application-projected presence state. A room
without declaration-owned support omits the control; a supported absent feature
is unchecked and enabled only when its exact engine assessment permits the
authoring command, otherwise it remains visible and disabled; an authored
optional feature stays checked and removable even when its retained state is
currently invalid; and a game-forced feature is checked and locked. React
renders this closed state and does not infer support, chronology, spacing, or
forced status from room or route data.

Resource controls remain checkbox-based, but their labels describe the selected
successful outcome: `Successful Mining — Fire`, `Successful Spirit — Air`,
`Successful Seed — Earth`, and `Successful Fishing — Water`. The application
projection obtains each element from the selected room declaration's
`resourcePointSupport.rules[family].element` and combines it with the existing
family vocabulary. The Resources heading carries the inline note: `Each
successful element outcome can be placed once across the route.`

An absent resource uses the existing add command, an authored resource at its
current room uses the existing remove command, and another legal room uses the
existing replacement command as a move. Only that move row includes a second
column identifying the current placement and linking to that occurrence.
Illegal targets remain disabled. No confirmation dialog is needed; one semantic
edit and ordinary Undo provide the mutation safety contract. React renders the
projected destination and never searches the authored route for it. The
room-local disclosure and route Resources index both use the room label resolved
from the entered placement record; persisted occurrence IDs remain navigation
identity and do not become product copy.

## Downstream Editing

Upstream replacement retains downstream state whenever the semantic structure
can remain represented.

The UI must visibly represent overflow targets after exit-capacity shrink. It
does not detach, hide, or auto-delete the picked continuation. The repair flow
is:

1. show retained unavailable targets and the associated structural finding;
2. require the user to choose an available picked exit;
3. re-anchor an ordinary continuation or Preboss realization through
   `SetExitSelection`;
4. enable an explicit Remove Unavailable Exits action;
5. reconcile only after the user invokes it.

Restoring capacity before reconciliation restores those targets as available.

In-project authored commands execute immediately when the user invokes an
explicitly labeled action. Commands that remove existing authored structure use
the red danger treatment as a visual affordance only: adding, changing, and
removing all create one semantic-command history entry and share Undo/Redo
recovery. The UI does not persistently display projected deletion scope. The
command layer, not React, defines the actual deletion scope.

Semantic action styling is an explicit React/CSS convention rather than a
generic button abstraction. A local scope has at most one Primary command: the
commit or forward action such as Save, Start biome, or Open next room.
Secondary commands make reversible supporting changes such as adding,
restoring, or rarifying. Quiet commands cover dismissal, navigation, history,
ordering, and low-emphasis local-draft cleanup. Danger commands remove authored
structure or replace or discard a project or recovery snapshot. Green remains
status language; it is not a second forward-action treatment.

Every production button carries either one of those four command treatments or
a named specialized-surface class. Contextual-picker triggers, tabs, rail and
completion nodes, semantic focus links, findings, trait and timeline launchers,
and icon-only ordering controls keep their specialized interaction treatments.
An architecture test guards explicit classification; semantic correctness
remains a review responsibility. Shared action rows only arrange co-located
controls (danger actions before a right-aligned primary continuation on wide
screens, in the same DOM order on narrow screens); they do not alter the
command, history, recovery, or confirmation contract.

## Room and Reward Editors

Room editors are selected by room template and receive:

- immutable declaration and labels;
- current complete offer-time state and any active entry-time state;
- semantic replacement callbacks;
- room-local findings and candidate results;
- immutable topology context only where the template genuinely requires it.

They do not receive mutable biome topology.

After a room replacement, its inline offer card renders the reconciled authored
snapshot: compatible incoming and local values remain selected, new or
structurally incompatible leaves show replacement defaults, and leaves no
longer admitted by the declaration disappear. A retained value that is
context-invalid displays ordinary finding and candidate guidance at its stable
leaf address. The room selection remains one undoable command; the editor
performs no secondary repair or confirmation step.

Compatibility is limited to catalog-backed production leaf contracts. The
current replacement surface covers counted rewards plus H cage and O wheel
members; fixed, shop, and Ephyra values receive replacement defaults. Preboss
Shops remain topology-owned roles, independent of ordinary midshops.

The declaration-bounded compatibility rule belongs to
`AUTHORED_PROJECT_MODEL.md`.

Reward composition remains bottom-up:

```text
payload domain
  -> reward type and complete resolved-offer default
  -> counted store domain or fixed binding
  -> batch-resolved reward offer / shop / room-local offer point
  -> room template
```

A source-fixed child may install its complete declaration-owned value. A
player-selected reward, offer, or trait result instead begins unresolved; the
editor must not turn the first declaration member or currently valid candidate
into authored intent. Once the player authors a complete value, later context
changes preserve it as selected-invalid repair state rather than clearing,
rerolling, or replacing it silently. Missing authorship and invalid authorship
are therefore distinct states.

The UI never commits an intermediate partial payload. A compound picker keeps
its progress in session state and dispatches one complete semantic value.

Reward type and payload project through one compact compound picker. A
payload-free reward commits immediately; Boon advances to one source choice;
Devotion advances through chosen and spurned sources. Partial picker progress
is transient session state, and only the complete `ResolvedRewardOffer`
dispatches one semantic replacement command. The contextual store, sibling,
bag, and source rules are defined in `CONTEXTUAL_EDITOR_UX.md`.
For a declaration-fixed reward with unresolved authored state, the application
seeds that same payload flow from the declaration-owned reward type. The user
therefore repairs the missing payload directly instead of encountering an empty
reward-type domain.

Blind Box deliberately exposes its intended eventual Boon source as planner
intent even though the in-game shop hides that result. The editor labels it as
an eventual result, not as visible shop information. An unpurchased box retains
the complete source payload dormantly; contextual validation does not require
that source to be possible until purchase.

Every ordinary generated decision projects its store according to policy. Its
physical offer cards place each room selector beside that room's resolved reward
editor, including for unpicked offers. An `authoredBaseStore` batch renders one
batch-owned `Reward Pool` selector for
its `baseRewardStoreKey`. A new authored selector displays an explicit
unresolved placeholder and keeps dependent room controls inactive until one
semantic replacement command selects the pool. A `sourceOfferPoint` batch
renders that store only at its owning room-local offer point; the outgoing
batch may show derived provenance but exposes no second editor. A `none` batch
renders no placeholder store field. Each target room then renders only its
resolved-offer editor. A declaration-forced target may display the derived pool
as read-only context, but it does not gain another persisted store selector.
This keeps batch, declaration, and leaf ownership visible in the UI.

O gives its non-ShipCombat `authoredBaseStore` selector the product label
`Next store roll`: it remains the one authored `ChooseNextRewardStore` outcome,
not a claim that every selected target draws a visible reward from that bag.
For every O normal target, the application projects one read-only target-card
consequence from the canonical incoming reward, resolved store provenance,
declaration-owned producer, and any forced store. React renders that complete
product without inspecting O game names, reward keys, declarations, or store
policy. ShipCombat says that it has no incoming reward and the outgoing store
is discarded; Miniboss and Devotion show their forced RunProgress Boon or
Devotion; Reprieve says its reward is drawn from the resolved RunProgress or
MetaProgress store; and Story, Midshop, and Preboss Shop show their fixed
identity plus the resolved RunProgress or MetaProgress provenance that counts
as entered-store history. An unavailable or retained-invalid target publishes
an explicit unresolved consequence instead of a false store claim. A Ship
source has no outgoing selector: where relevant, its consequence identifies
the store as derived from the final active wheel, whose existing wheel control
is the only editable authority. These statements augment their existing reward
editors and never become addresses, candidates, findings, or a second reward
control.

Replacing the batch reward pool retains every target reward. Candidate and
selected-plan validation mark a retained reward invalid when its newly resolved
store cannot produce it; the editor does not reset it. The UI never displays
probability percentages, likelihood scores, or warnings for merely unlikely
but possible outcomes.

An H ordinary batch has no Reward Pool selector because its observable rewards
use declaration-owned RunProgress bindings. It instead renders one batch-owned
Fields door-roll selector with Min and Max semantic values. The view shows the
derived per-door cage count and current two-Max ceiling as read-only context,
but persists neither. A new decision displays `Select roll` until one explicit
selection replaces the unresolved state. A special-only batch keeps the
selector visible because a Max result still affects later rolls, while
explanatory copy makes clear that the current targets do not consume the Fields
multi-cage count. Each combat occurrence renders its three room-owned cage
values in its complete projection product; the batch projection marks only the
derived active prefix as participating. The editor renders that active prefix
only, while retaining a dormant third authored value so it reappears unchanged
when a later Fields result activates it. Active cage rewards are mandatory room
structure and render directly on the room surface for picked and unpicked
targets. Concrete encounter identities render in the direct Encounter section.
A non-combat target renders
no cage editor, and deferred
`FieldsOptionalRewards` render no controls.

An O ShipCombat occurrence renders one encounter-count selector and both
declaration-bounded reward wheels in its complete projection product. The
selected two- or three-phase value marks `wheel2` dormant or active without
deleting its retained state. The editor renders active wheels only, so a
dormant wheel reappears unchanged when the third encounter phase is restored.
Encounter count and active reward wheels are mandatory room structure. The
application groups the active Ship envelope as Intro, Combat 1, and optional
Combat 2 from declaration-owned phase/wheel attachments plus engine-owned Room
Action windows. Each group renders its Encounter, wheel structure when present,
and its view of the single global Room Timeline chronology. A reward-wheel
structural editor appears in the phase immediately before the combat named by
its declaration-owned `encounterPhaseKey`: Wheel 1 under Intro and active Wheel
2 under Combat 1. Its choose and pickup actions remain grouped by their own
engine windows rather than by the editor's structural placement. Ranks remain global,
and every active row and checkpoint appears exactly once under its active
phase. A retained action owned by a now-dormant Ship phase appears exactly once
in the Ship repair surface outside the active phase groups. Semantic focus
targets the already-rendered exact control.
Each rendered wheel owns its Run/Meta store, active offer count, ordered
maximum-capacity offers, and one picked active offer. The editor renders only
offers marked active by that complete projection product. Reducing the active
offer count hides the surplus offer editors without deleting their authored
values; restoring the count reveals those values again. The picked index
remains constrained to an active offer.
Within one active wheel, its offers render as simultaneous offer cards: one
active offer fills the available row, while two render as equal sibling columns
and collapse to one column in a narrow container. The cards may share the
compact exit-card visual language, but they are not exits: they render no door
number, room state, or topology action. They reuse the exit-card selection shell
and its yellow selected-state styling: when two offers are active, each card
owns a left-side radio backed by the wheel's existing picked-offer interaction;
one active offer retains the neutral marker and needs no choice control. The
pick interaction validates the generated wheel through that choice point. It
does not require the newly selected offer's acquisition child to be complete;
that child becomes authorable on the following combat phase's pickup action.
Earlier wheels and the selected wheel's complete generated cohort remain part
of candidate validation. The chronological `Choose` action remains on the Room
Timeline for ordering, but it
does not duplicate the card selection with a dropdown. Wheel 1 and Wheel 2
remain separate sequential phase sections.
The outgoing decision exposes no duplicate store selector because its
`sourceOfferPoint` policy derives from the last active wheel. The editor
dispatches only ship and reward-wheel semantic commands and does not encode
phase timing.

Display labels remain separate from persisted game identifiers:

```ts
interface LabeledGameValue {
  gameName: string;
  label: string;
}
```

Selectors render labels. Authored state persists stable semantic/game keys.
Internal names such as `AresUpgrade` must not leak into player-facing text
when the declaration provides `Ares`.

## Findings and Feedback

The simulator returns semantic findings. The application indexes them by
owner address and projects them into UI destinations:

| Semantic owner          | Presentation                           |
| ----------------------- | -------------------------------------- |
| Biome                   | biome status and findings summary      |
| Start                   | start selector marker                  |
| Parent batch            | decision card and batch marker         |
| Batch reward store      | decision Reward Pool selector          |
| Batch policy state      | policy-specific batch selector         |
| Parent plus exit index  | target selector or physical exit       |
| Picked continuation     | single-choice surface                  |
| Preboss batch / handoff | batch, handoff, and realization        |
| Preboss target          | physical exit and selection            |
| Mixed Preboss target    | target row and biome-completion marker |
| Room occurrence         | room editor                            |
| Occurrence plus slot    | local reward/child editor              |
| Reward wheel            | wheel count, store, and picked offer   |
| Reward wheel offer      | ordered wheel reward editor            |

Finding resolution is direct lookup. It never scans rows for a matching game
room name.

The visible `Findings` panel is route-scoped and lists that route evaluation's
findings across its configured biomes. Project and route status summaries may
still expose aggregate counts. A project-owned finding requires an explicit
presentation destination rather than an unrelated panel fallback.

Context-invalid authored values remain visible and are decorated.
Declaration-impossible values may be absent. Contextual pickers ordinarily
omit unselected impossible values while keeping them inspectable through an
unavailable disclosure. Before contextual candidate simulation is available,
selectors show stable declaration-derived domains without pretending they are
validated. `CONTEXTUAL_EDITOR_UX.md` owns the detailed presentation policy;
simulation continues to own support and exclusion reasons.

The active biome consumes progressive evaluation coverage from
`SIMULATION_AND_VALIDATION.md`. A missing downstream decision or Preboss batch
does not suppress findings and candidate support for an earlier covered owner. The
page renders that one atomic prefix result; it does not request or assemble a
separate partial history.

Published validation stops at the first blocked atomic region. Every co-owned
finding there and the exact repair interaction remain navigable, while later
findings and candidate context remain unavailable. If an earlier reached value
is invalid and authorship is also incomplete, invalid presentation takes
precedence without hiding the later authored frontier.

Later biomes remain visible when an earlier biome blocks evaluation. Required
incompleteness publishes an engine-owned authoring horizon and disables later
semantic controls; invalidity alone leaves them editable for repair. Their
contextual validity remains unavailable because the required history does not
exist, without inventing local errors.

Finding navigation and inline feedback consume one completed destination. Its
resolved repair target owns the persistent red border and focus destination;
React does not independently route raw finding origins or render numbered
inline badges. Multiple findings may share one target while their individual
explanations remain in the Findings panel.

## Undo and Redo UX

Undo/redo applies to semantic authored commands. One visible user intent is one
history entry, including compound default installation.

Expected examples:

- replacing a room is one undo step;
- selecting a reward type and installing its complete offer payload is one undo
  step;
- removing a decision and its downstream topology is one undo step;
- clearing a biome is one undo step;
- navigation and panel expansion are not undoable project edits.

The command history owns reliable undo and redo; no edit-log product is
defined.

## Project and Session State

Persisted project state includes semantic authored choices only.

Session state may include:

- active route and biome;
- selected room or finding;
- inspector tab;
- panel expansion;
- selector category and search text;
- zoom or viewport if a graph projection is introduced;
- an exact open Run State semantic owner—decision-generation or room-lifecycle
  checkpoint—and its local disclosures.

Session state must never be required to reconstruct the authored project.

After every effective authored-project publication, application coordination
reconciles transient semantic navigation against that publication's findings
and exact workspace destinations. A finding selection whose exact finding no
longer exists clears independently from a semantic focus whose owner no longer
has a destination. Reconciliation never chooses a replacement owner, changes
the current route or panel, or enters authored history. A finding that remains
live without an exact workspace destination is a workspace-projection contract
failure, not ordinary stale session state. Native keyboard focus remains a
local React concern and is not reconstructed from this session cleanup.

An open Run State target is reconciled against the newly published set of
available snapshot owners. If its exact decision-generation or lifecycle-
checkpoint launcher or snapshot disappears, it clears rather than rehoming to
another owner. Route, panel, and semantic navigation also close the read-only
sheet. Opening and closing it publish no authored command, persistence value,
undo entry, candidate-session preparation, or project evaluation; the editor
reads its already-published workspace product.

## Profile Files, Autosave, and Dirty State

The user-facing project lifecycle has one explicit file workflow:

- **New** opens the catalog-driven route chooser and creates a fresh project
  only after a route is selected;
- **Load…** decodes one selected profile file and replaces the project only
  after the entire document passes catalog validation and immediate workspace
  preparation;
- **Save** writes the normalized `ProjectDocument` through the platform
  profile-file adapter;
- **Save As…** is exposed by the desktop host, writes another file, and makes
  it the active Save target; and
- **Publish to Game…** opens the existing profile-and-slot publication dialog
  without changing the active project file.

Local Save/Load and Export/Import are not retained as two public persistence
concepts. Browser Save uses a download and Browser Load uses an upload; because
browser Save As would be the same operation, it is not exposed separately. The
desktop host uses native dialogs and remembers one accepted project file across
restarts. Save overwrites that file, Save As switches to a new file, and New
clears the association before publishing a fresh project. The filename and
native path never enter the authored document, Redux, undo history, autosave
JSON, or dirty-state comparison.

Explicit profile replacement is atomic: successful load resets undo/redo,
runs one fresh simulation, proves the immediate structured workspace can be
projected, installs that prepared workspace as the clean baseline, and then
queues recovery autosave. Only then does the selected desktop file become the
active Save target, and only then is blocked recovery cleared. Cancellation is
a no-op. Read, decode, simulation, or immediate-projection failure leaves the
current project, history, evaluation, clean baseline, host file target, and
recovery value untouched.

A production shell-level fault boundary remains available after a later render
or unhandled browser failure. It does not attempt to continue an unknown partial
interaction. It preserves the source profile, presents technical details, and
allows another profile to pass through the same preparation boundary before the
editor is remounted. Both this surface and blocked startup recovery allow the
untouched raw autosave value to be exported through the host's normal Save As
flow for diagnosis. Export neither decodes nor migrates the value, does not make
the exported file the active project target, and does not clear recovery. The
user may also explicitly discard only the autosave recovery copy. With no
desktop file association, restart returns to the route chooser. A valid
remembered desktop file remains associated and can reopen after recovery is
discarded; discard never modifies that source file.

Autosave is a distinct recovery channel, not an implicit Save action.
It observes effective authored changes only and is debounced. Navigation,
finding selection, panel state, and simulation publication do not trigger it.
Autosave failure is presented without blocking continued editing.

The visible dirty state follows the normalized authored document rather than
an imperative flag:

| Action                      | Explicit profile baseline | Resulting status               |
| --------------------------- | ------------------------- | ------------------------------ |
| Fresh startup               | none                      | No project before route choice |
| Open New chooser            | unchanged                 | Unchanged until route choice   |
| Select route through New    | none                      | Unsaved                        |
| Save succeeds               | serialized snapshot       | Clean only if still equal      |
| Semantic edit               | unchanged                 | Dirty if unequal               |
| Undo/redo                   | unchanged                 | Clean exactly when equal again |
| Load succeeds               | loaded project            | Clean                          |
| Restore autosave at startup | recovered project         | Recovered / Unsaved            |
| Autosave write              | unchanged                 | No dirty-state change          |

On startup, a valid recovery document is decoded and prepared through the same
catalog-aware project boundary and receives a fresh history, simulation, and
immediate workspace projection. Browser recovery remains anonymous. Desktop
startup also reads its remembered file: equivalent recovery opens that file
clean, while different recovery retains the disk document as baseline and the
same active Save target. An invalid remembered file falls back to valid
recovery anonymously and clears the unsafe association. Before a route is
selected, no authored project, history, evaluation, or dirty status exists. If
recovery is corrupt, the editor reports the failure, preserves the raw value,
and suspends further autosave. The route chooser remains available when no
valid desktop file can open; the user may explicitly Discard Autosave, or
successfully load a profile, to clear that blockade. The app must never
overwrite corrupt recovery merely because the chooser is visible.

## Topology Visualization Policy

Do not begin with a freeform graph canvas. Ordinary decision topology and Hub
topology have stronger semantic structure than arbitrary nodes and edges, and a
structured editor is easier to make readable and accessible.

The structured workspace in `STRUCTURED_EDITOR_WORKSPACE.md` is the primary
authoring surface. Any topology visualization is an optional overview
projection rather than a prerequisite for showing the picked path or Hub visit
structure. It must consume semantic topology; viewport, coordinates, and
selection remain transient unless a separately designed semantic command owns
a durable change.

## Accessibility and Keyboard Interaction

Use standard accessible primitives for tabs, dialogs, comboboxes, radio
groups, menus, and tooltips. The editor should support:

- full keyboard traversal of decisions and controls;
- typeahead/search for room and reward selectors;
- visible focus state;
- labels independent of color;
- labels that clearly name removal actions without relying on color alone;
- navigation from a finding to its semantic owner;
- predictable undo/redo shortcuts.

## Trait Offer Presentation

Trait offers are projected from reached engine evaluations, never recomputed
in React. A room/reward summary, the chronological route Traits panel, and a
finding destination all reference the same `TraitOfferAddress` and bound
interaction. The shared modal renders the one to three materialized option
rows, their selected option, and contextual trait pickers, or the mutually
exclusive Fallback Gold outcome. When fewer than three dependable ordinary
boons remain, engine-projected controls may add or remove only a trailing
optional Duo/Legendary outcome; otherwise the shape controls are absent. The
engine likewise owns fallback availability and the supported draft for
returning to traits. Selectable-rarity traits receive a contextual rarity
picker; declaration-fixed Duo/Legendary traits retain their rarity as read-only
text, while rarityless NPC and Hammer rows omit rarity entirely. Giver
labels, selected trait labels, contextual support,
and findings are presentation products derived from catalog and engine outputs.

The same surface presents an active Selene `SpellDrop` as `Edit Spell`: three
rarityless rows and no fallback, sparse, rarity, replacement, target, or
god-pool controls. It still binds the existing complete `ReplaceTraitOffer`
semantic edit and exact finding destination. Opening the dialog does not
evaluate a candidate domain; focused editing invokes the already-bound engine
capability lazily. Aspect of Selene instead owns its frozen Sky Fall tree in
the route loadout; its later Spell Drop has no trait-offer child, control, or
missing-offer finding. The ordinary rows expose their position-owned Path of
Stars bonus as Crescent, Half, and Full Moonglow for the first, second, and
third slots respectively. The launcher summarizes only the selected spell. The
selected spell's Hex layout and high-value nodes are available from the live
dialog draft before its first save; reopening the dialog is not an authoring
prerequisite.

First-Olympian composition findings use the same `TraitOfferAddress` and
existing finding presentation path. The editor adds no mode or persisted state:
whether the rule applies comes from the engine's selected-offer assessment
published through coverage. Alternative assessment remains behind the exact
bound replacement interaction. The editor neither reads nor reconstructs
pre-offer histories or contexts and does not rerun selected-path evaluation.

The same modal presents an engine-derived Olympian replacement as an option
annotation with its exact old trait, slot transition, and promoted rarity. The
application binds address-scoped candidate evidence and React renders it; the
editor does not infer occupied slots, rarity promotion, replacement limits, or
eligibility. Structurally supported but context-invalid rarities remain visible
for repair, while Heroic is offered only when the engine exposes an
Epic-to-Heroic replacement.

An active Aspect-of-Persephone row may also present the engine's bounded
Persephone contribution picker and the derived effective level. Each applicable
ordinary option presents effective rarity and effective level in the same compact,
fixed summary; an inapplicable value retains its row as an em dash so option-card
geometry does not depend on trait capability. The picker offers the exact active integer range
(`+0..+5`, or `+0..+8` after a prior Premium Service acquisition). An omitted
authored value is displayed and settled as `+0`; selecting zero removes the
optional persisted detail. The application writes the complete trait offer
through the existing semantic replacement intent and does not calculate the
level, inspect history, or let a same-screen Premium Service selection alter
sibling or Concave Stone rows. Context-invalid explicit values retain the
focused engine finding for repair.

When a declaration-owned option targets another equipped trait, the same row
renders a generic engine-backed target picker. Catalog labels present the exact
target domain; a missing or stale selected target remains visible for repair
and keeps Save disabled. React does not infer a target, traverse equipped
history, or switch on Bridal Glow, Latest Model, Icarus, or Hammer names.

Natural Selection reuses the existing selected-trait compound-outcome language:
one complete ordered target sequence is edited beneath the selected option and
saved through the ordinary `ReplaceTraitOffer` command. The engine capability
decides the next legal round-robin position and whether a short sequence is
complete; React does not derive target exclusion or early exhaustion. Ransom
offers render a read-only engine-derived removal/level preview with no
persisted result or editor. Steady Growth renders a fixed automatic timeline
effect with the existing contextual target picker; it is not a Pom, a Room
Action, or a draggable/removable authored effect. The distinct
`previouslyPicked` finding uses the normal trait-offer feedback path.

Run State presents Steady Growth's derived progress and rarity interval from
the equipped trait ledger; React does not count checkpoints or predict future
thresholds.

Picker activation evaluates one focused option domain with every materialized
sibling held fixed. Sibling findings therefore remain visible in the complete
feedback panel without falsely disabling unrelated focused repairs. Trait and
rarity selection changes only the local complete draft; Save still dispatches
one `ReplaceTraitOffer` command and creates one authored undo entry. An
unassessed option remains selectable, an impossible alternative remains
inspectable but disabled, and a selected impossible value remains pinned until
the user repairs it.

The editor never derives the ordinary/high-tier/replacement domains, sparse
fill, or Fallback Gold availability. A fallback outcome has no rarity,
targeted-acquisition, Circe, Death Defiance, or selected-option child, and the
modal does not render those controls until the engine supplies a trait draft.

Trait dialog visibility and focus handoff are UI-session state. Opening from a
room, Shop, route Traits row, or semantic finding does not enter authored
history or undo/redo. Escape first dismisses an open nested picker and restores
its trigger; a later Escape may dismiss the dialog and restore its launcher.
The route projection groups branch evidence by semantic
owner while preserving engine chronology; it does not create a route-wide
trait model. Dormant descendants remain withheld until their parent lifecycle
reaches the role, and invalid reached offers stay editable with their exact
finding.

Circe uses the same trait dialog and one selected-option child control. Red
Citrine shows one engine-derived inactive Arcana picker, Lapis shows an
engine-derived unordered bounded multi-select of active non-Heroic cards, and
Black Night shows one engine-derived removable active Vow picker. Switching a
draft between direct and effect-backed options must immediately project the
corresponding child without reopening the dialog; dormant authored detail is
preserved by the engine. React does not calculate target eligibility, manually
active Arcana cost, Fear totals, or Circe removal policy.

Route Overview owns the starting loadout controls: manual Arcana toggles and
declaration-bounded Fear ranks. The engine supplies current starting Grasp
cost/capacity and assesses each proposed Arcana toggle or Void rank; React only
disables proposals that the engine rejects. Ordinary automatic Arcana
indicators and the derived Fear total are read-only engine products. The same
workspace exposes a reached Judgment completion control only at its exact
fixed Boss occurrence; there is no route-level Judgment editor. The fixed
Boss and Postboss entries in the completion outline are selectable inspector
destinations, so a completed Judgment result remains reopenable after its
finding disappears. The Judgment picker renders one Arcana choice per row.

Run State presents the engine-folded banned-trait labels and Forfeit's
current-biome inactive, available, or consumed status. React neither accumulates
unselected Denial options nor infers Forfeit eligibility from rendered rooms.

The existing trait-offer surface presents the engine's generic
`rarityRollUnavailable` finding as ordinary option feedback. A retained
authored value remains visible and repairable when its exact room, generated
item, Arcana, or active-Proper context makes that fresh rarity impossible;
structurally unsupported values continue to use `freshRarityUnavailable`.
Contextual picker availability comes from the bound candidate artifact, so
React does not calculate percentages, inspect Proper Upbringing, infer
Miniboss or Shop context, or introduce an activation control. Reached Olympian
and Hermes dialogs may disclose the engine's branch-correlated **Offer State**:
the exact ordered Rare, Epic, Duo, and Legendary check values plus effective
replacement chance, eligible/allowed/required replacement counts, and the
forced-roll versus shortage source of any requirement. These checks are not
normalized final-outcome probabilities. Equivalent complete branch states may
collapse for presentation; disagreeing states remain separate. The disclosure
observes the live draft but does not persist any new authored data. Run State
may show the engine-derived `Proper Upbringing active` status, but it does not
display a global rarity or replacement ledger.

## Rejected Editor Shapes

Do not introduce:

- topology mutation through arbitrary object writes;
- empty sentinels for existing room or reward selections;
- UI-local eligibility rules;
- per-room store selectors that compete with batch store authority;
- probability or likelihood decoration for valid possible choices;
- findings keyed by rendered index;
- a second serialized UI tree;
- hiding a currently authored invalid choice;
- automatic surviving-exit selection;
- graph coordinates as domain topology;
- a large generic form generator that obscures room semantics.
