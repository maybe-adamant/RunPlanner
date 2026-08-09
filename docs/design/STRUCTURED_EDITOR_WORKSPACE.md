# Structured Editor Workspace

## Status

This is ratified Phase 7 presentation authority.

## Purpose

This document defines the Phase 7 presentation structure for route and biome
authoring. It combines the existing contextual-editor contracts with a more
legible structured workspace without changing the authored-project model,
simulation, validation, semantic commands, or persistence.

This document owns:

- route, biome-structure, and inspector composition;
- shared ordinary-decision and Hub workspace presentation;
- picked-path and unpicked-offer visual hierarchy;
- progressive coverage and finding placement;
- empty-biome outlines;
- prompt-free removal editing, repair presentation, accessibility, and
  responsive behavior.

[`CONTEXTUAL_EDITOR_UX.md`](CONTEXTUAL_EDITOR_UX.md) owns contextual room and
reward selector behavior. [`EDITOR_MODEL.md`](EDITOR_MODEL.md) owns the broader
projection, navigation, command, finding, and persistence boundaries.

## Product Goal

The editor should present a biome as a game-structured route rather than a
database form. A user should be able to see:

- where they are in the route and biome;
- which authored decisions form the picked continuation;
- which generated offers are unpicked leaves;
- how far progressive evaluation has reached;
- where the first blocking or invalid owner is;
- which semantic owner is currently being edited;
- what remains structurally possible without inventing future game facts.

The workspace is a projection and command surface. It never becomes a second
serialized topology.

## Preserved Contracts

- Authored topology and Room Occurrences remain the only topology authority.
- Progressive evaluation enriches an incomplete authored prefix without
  publishing a canonical biome snapshot.
- Only a complete-valid biome publishes canonical products and seeds the next
  route biome.
- UI destinations use occurrence IDs and semantic addresses, never rendered
  indexes.
- Context-invalid authored values remain visible until explicitly replaced or
  removed by an owning structural command.
- React implements no eligibility, force, reward-store, bag, sibling,
  Preboss-handoff, or route-gating rule.
- One visible user intent dispatches one semantic command and creates one undo
  entry.
- Focus, expansion, search, disclosure, and viewport state remain transient
  UI-session state.
- The simulator models possibility, not probability. The workspace does not
  display likelihood or an expected route length.

## Desktop Composition

The primary authoring surface uses three conceptual regions:

```text
+----------------+-----------------------------+---------------------------+
| Route rail     | Route structure             | Details                   |
|                |                             |                           |
| route status   | door choices / Hub          | selected decision, room,  |
| biome status   | decision labels / status    | reward, finding, or       |
| navigation     | next step                   | repair surface            |
+----------------+-----------------------------+---------------------------+
```

These are presentation regions, not persisted panels. The exact responsive
composition may become two columns, stacked regions, or an inspector drawer at
narrow widths.

### Desktop Sizing and Scroll Ownership

At desktop widths, an active biome workspace fills the editor height remaining
after findings and any route-context message. The workspace shell itself is
not a vertical scrollport. Its Route structure and Details regions
are independently sized vertical scrollports, so scrolling one never moves the
other. A short structure rail does not advertise overflow merely because its
connector decoration extends beyond a terminal stop.

The route overview remains ordinary editor-panel content and may use that
panel's scroll container. At narrow widths the layout intentionally returns to
one document-flow column rather than retaining nested scrollports. These are
CSS presentation boundaries only: scroll position remains transient and no
layout state enters the authored project or semantic commands.

The existing horizontal route tabs remain the top-level route/Settings
navigation. The route rail is the selected route's local overview and biome
navigation, not a competing second route selector.

### Route Rail

The route rail projects the normalized catalog route order and current project
evaluation. It shows route settings, each configured biome, its status, and
whether contextual evaluation is active, complete, or blocked by an earlier
biome.

Selecting a biome changes UI-session navigation only. A downstream biome remains
editable when blocked, but its contextual state remains unassessed.

### Biome Structure

Every configured biome renders through one `BiomeWorkspace` composition over a
`WorkspaceBiome` projection. Its exhaustive workspace-node union retains
ordinary decisions, takeover and mixed Preboss batches, completion,
occurrence-local workbenches, and the Hub decision without React inspecting
authored topology. N's exact terminal decision carries a projected Hub
takeover control rather than another node family. The projected rail
deliberately exposes only player-facing biome stages and decision points;
exhaustive node ownership does not imply one rail stop per node.
`HubDecisionWorkbench` is the one N-specific workbench and is nested inside
that shared workspace; it does not create a second editor surface.

The rail is a selective decision-highlight and navigation projection, not
workspace authority. Omitting a semantic owner from the rail changes neither
its authored data nor its workspace node, findings, contextual controls, focus
destination, or editability. Room rewards, encounter phases, and any future
features, items, or other room-local products remain available through the containing
decision or fixed-stage inspector unless a separate player-facing navigation
need justifies another rail highlight.

### Run State Join and Outer-Decision Placement

The workspace joins each engine-published decision Run State snapshot to its
exact semantic decision owner. A structurally eligible decision projects one
launcher: an available launcher binds that exact snapshot, while an unreached
launcher carries the engine coverage reason and binds no invented state.
Presentation owns structural titles, catalog-backed labels, section ordering,
and compact requirement copy; it does not evaluate requirements, fold traits,
derive bags, or infer availability.

The launcher belongs in the selected decision workbench header, never in the
rail or on every room card. Ordinary generated decisions, including generated
Preboss, follow the same owner rule. N has an explicit two-layer presentation:
its outer chronology is Opening -> PreHub -> Hub -> Preboss, while Hub visits,
slots, side rooms, restores, and local children are inner chronology. Opening
remains a fixed stage. Run State checkpoints occur before PreHub, before Hub,
and before Preboss; the one Hub launcher is owned by the Hub decision before
board generation. The visible completed-Hub handoff remains the outer transition
to Preboss, and any future outer decision follows the same generic owner rule.
React consumes these projected owners and never distinguishes them from room
names or rendered nesting.

The center region does not attempt to make ordinary decision topology and the
Hub board look structurally identical. It does give both the same route rail,
semantic focus, finding navigation, coverage, and focused-inspector language.

### Focused Inspector

The inspector renders the workbench containing the focused semantic owner and
the controls that belong to it. An ordinary decision workbench includes its
batch policy and every physical offer's picked state, room selector, and reward
controls together. Focusing an ordinary target, occurrence, or reward opens that
same decision workbench at its exact semantic control; it does not create a
parallel room stop in the rail. Fixed entries and N visit-local details retain
occurrence workbenches where they are player-facing stages or subordinate Hub
navigation.

Finding navigation selects the owning route and biome, focuses the semantic
owner, and brings its inspector surface into view. The inspector never searches
for a rendered room label or decision number.

### Encounter Phase Products

Each structurally active pool-backed encounter phase is a first-class
workspace owner. Its exact `EncounterPhaseAddress` resolves to the containing
occurrence or local-child inspector, one marker, one focus destination, and—if
the declared set has meaningful choice cardinality—one bound selection
interaction. The projector consumes engine candidate support and lifecycle
activation facts; it never derives phase activity from a rendered ordinal,
finding, or room template.

The workspace publishes active phases even behind an invalid evaluated prefix,
so a retained invalid selection can be corrected. A dormant potential phase
retains its persisted selection but has no live interaction, marker, finding,
or route-NPC index entry. Singleton phases preserve their exact semantic
destination without producing no-op controls. This gives finding navigation and
closure the same phase identity regardless of whether the presentation has a
visible picker.

## Application Projection Boundary

The application projects a structured workspace from:

```text
authored topology
  + normalized layout
  + room declarations
  + progressive or canonical biome evaluation
  + addressed findings and contextual options
  -> WorkspaceBiome structured workspace view
```

The projection owns visual grouping, ordering, compact summaries, coverage
markers, Preboss and completion-outline facts, and semantic focus destinations.
React renders that projection and dispatches semantic commands.

### Public Workspace Entry

Application composition and React consume the structured workspace only through
the `projections/structured-workspace` public entry. Its exported vocabulary,
service, and deliberate interaction helpers are the stable projection contract.
Independent closure helpers are test support, not a production public seam.
Contract declarations and projector assembly are private modules: the projector
may consume the contract, but neither module may depend on the public entry or
become an alternate consumer import path. This keeps workspace construction
replaceable without making React or application composition depend on its
internal assembly order.

### Internal Projection Production Line

The private workspace implementation preserves one directed production line:

```text
WorkspaceBiomeSource
  -> WorkspaceBiomeSemanticAssembly
       ├-> biome presentation (rail, default inspector, exact destinations)
       └-> project-wide interaction binding
biome presentation + evaluated findings
  -> exact finding routing
semantic assembly + presentation + exact finding routing + bound interactions
  -> cached structured-workspace service (with local construction invariants)

test support: catalog + persisted authored state
  -> independent expected owners, leaves, and structural controls
production workspace products + expectations
  -> test-time closure
```

The semantic assembly owns complete biome facts: authored structural nodes,
room-local products, controls, preliminary destinations, and interaction
requirements. Biome presentation and interaction binding are sibling consumers
of that immutable product. Presentation may also read immutable catalog display
metadata for an already-resolved reward token; it never revisits authored source
or interaction binding. Presentation owns the selective rail, Hub visit
grouping, default inspector, and final inspector/rail destinations; interaction
binding owns executable command adapters and does not consume presentation.
For the policy-bearing families it binds, it returns complete command intents;
the shared React adapter dispatches only that intent and, when declared, its
focus timing. React does not allocate occurrence identities or reconstruct
creation focus. Simple declaration-projected fields and intentionally retained fixed
owner-plus-value controls remain direct semantic mappings rather than being
wrapped merely for uniformity. `WorkspaceBiome` carries its typed biome owner
only because React needs it to scope global semantic focus; generic markers do
not become a route back to typed control owners.
Independently derived authored-owner expectations live in test support and
derive identity and visibility from catalog plus persisted state without
importing assembly, marker ownership, presentation, binding, or facade
products. The cached service composes the returned products, project and route
markers, legitimate coarse finding fallbacks, and the final immutable workspace;
it does not construct occurrence, decision, Hub, rail, or test-closure
families itself.

Creation establishes explicit transient semantic focus through the existing
semantic-owner action. Every authored start selects its created Room Occurrence.
An ordinary target selects its target owner while remaining in the owning
decision workbench. The direct predecessor of a generated continuation exposes
`Add next decision`: its complete bound `CreateBatch` intent creates the empty
decision envelope and focuses that decision owner before publication. React
only dispatches that intent; it neither reconstructs a command nor treats
frontier navigation as an alternate edit.

An empty generated decision publishes one Door 1 room control inside its own
workbench. The control is target-addressed, but its picker can contain both
target-owned ordinary candidates and decision-owned takeover Preboss evidence.
Binding returns the chosen, complete `CreateTarget` or
`ReplaceWithTakeoverBatch` intent lazily, allocating takeover occurrence IDs
only on activation. Both the target route and the decision-owned takeover route
resolve independently to the same containing decision inspector. Later doors
remain ordinary sequential target controls; a populated ordinary decision
never publishes a retroactive takeover control.

The rail may retain a truthful continuation marker without stealing inspector
focus, but generated continuation has no navigation-only `Go to next step`
action or separate `Add Preboss doors` control. A completed-Hub handoff and
repair of an already-authored takeover remain distinct declared interactions.

Incomplete-biome structure is an authored-topology projection enriched by
progressive evaluation. It must not be described as canonical topology.

### Authored-First Assembly

Persisted authored topology determines workspace membership and order.
Evaluation is an optional overlay indexed by semantic owner; it may add
assessment, availability, Goal state, simulated entry, and derived lifecycle
facts. Evaluation must not create, remove, or replace a persisted decision,
target, occurrence, or editable offer-time leaf.

The projector walks the authored start and then authored exit decisions or the
Hub in selected-topology order. A selected target subtree precedes retained
physical peers. Peers follow the current physical-exit order with a stable
semantic tie-breaker. Disconnected or malformed but structurally representable
state remains reachable through the same deterministic ordering; the codec and
semantic commands, not projection, remain responsible for structural validity.
Simulation order never substitutes for authored topology order.

The physical exits for a decision are those resolved from its current authored
batch and layout state. A current exit without an authored target is projected
as a missing offer. A retained authored target outside that current set remains
visible as an unavailable offer; projection does not discard it or promise
blank rows for merely potential or policy-gated exits.

Room-local activation follows the hierarchy and source rules in
[`EDITOR_MODEL.md`](EDITOR_MODEL.md#decision-and-room-data-hierarchy).
Mandatory room and reward leaves do not depend on activation, findings,
candidate support, or evaluation coverage. Optional picked-room details may
depend on authored `detailsActive`, while evaluated `entered` remains a
separate fact.

Occurrence assembly consumes narrow authored activation facts.
`FieldsBatchFacts` is one shared engine-derived input for both occurrence and
decision assembly, rather than a room-local lifecycle table or duplicated
calculation. Persisted room-state schema coherence belongs to engine codec,
default, and semantic-command boundaries; the workspace projector deliberately
does not preflight a complete document. It retains only exact declaration and
product-contact assertions needed to publish a concrete control, including
dormant optional detail.

### Projection Integrity and Independent Test Closure

Production enforces invariants where products are constructed: exact
project/evaluation provenance, declaration lookup, impossible evaluated-overlay
rejection, duplicate semantic-key rejection, and required exact lookups. A
live finding must publish an exact owner destination; a coarse finding may
inherit its biome shell, while a fine-grained finding must resolve to an
existing exact inspector subject and may not be converted into a default-
inspector or biome-shell fallback. These are local production contracts, not a
second traversal that reconstructs an expected workspace after the product is
built.

Test support independently enumerates the semantic owners, declaration-required
editable leaves, and structural controls implied by catalog plus persisted
authored state. It verifies that:

- every decision, target, occurrence, Hub slot/visit, and active
  declaration-owned leaf has one reachable projection;
- every exact semantic address resolves to its containing inspector, marker,
  and exact interaction;
- advertised structural controls and frontier capabilities have the expected
  kind, key, owner, and bound interaction;
- fine-grained findings resolve to their exact owner rather than a biome-level
  fallback.

A target's room and reward may be nested inside its decision workbench. Test
closure therefore validates semantic-owner reachability, not a count or shape
of standalone UI nodes. Candidate support and findings decorate reachable
controls; they never decide whether a mandatory authored control exists. React
renders projected facts and does not recreate topology, containment, lifecycle,
or interaction policy.

## Ordinary Decision Workspace

For F/G/H/I/O/P/Q, the center region presents a concise decision-point rail:

- the authored start or fixed entries;
- each generated decision as exactly one labeled stop;
- the active continuation frontier;
- retained downstream structure after an invalid upstream edit;
- a layout-owned Preboss stage where it is distinct from an ordinary decision;
- completion rooms as a separate derived, read-only outline.

The rail is not a freeform graph. Its visual position is derived from semantic
topology and never persisted.

### Empty Decision Entry

The empty decision is already a decision workbench, not an intermediate mode
card. It shows declared batch setup when present, the Door 1 Room picker, and
later physical doors waiting for sequential generation. A required reward pool
or Fields roll can disable ordinary mutation locally, but it cannot hide a
supported takeover option in that same Door 1 picker. Selecting an ordinary
room reveals its mandatory room/reward leaves; selecting takeover replaces the
envelope atomically with the declaration's Shop/free-offer shape. Findings
decorate those controls and never decide whether the structural control is
projected.

### Decision Offers and Picked State

Selecting a decision shows all of its physical offers together. Every authored
offer keeps its room selector and reward editor at the same visual level,
because the room and incoming reward jointly describe the offered door.
Single-choice controls live on those cards, and the picked card receives the
strongest emphasis because it is the authored selected route. Evaluated entry
is shown separately when materialization has actually reached that room.
For an authored RunProgress/MetaProgress decision, the batch control is labeled
as the base reward pool. When a declaration-owned forced room changes the
evaluated final shared pool, the decision also presents that effective pool and
briefly identifies the forced-room override; React does not derive the result.

Unpicked targets remain fully visible in the decision workbench because they
still affect reward bags, sibling conflicts, source support, and possibility
evaluation. They do not become equal-weight stops on the biome rail. A numbered
decision stop always shows its decision identity and semantic assessment. When
exactly one target is authored as selected, it may progressively add that room
label; if its room-local surface has exactly one direct compact reward, it may
add a structured reward token. The selected room remains useful context when
the reward surface is multiple or not compactly representable, so room and
reward cardinality are deliberately independent. Findings, evaluated entry,
and physical availability never suppress this authored-selection context.

The rail product retains the resolved reward offer plus its current text
fallback. React currently renders the fallback, while a later compact icon or
token renderer can consume the same structured offer without recreating reward
or selection policy. Fields, Ship, and Shop surfaces do not infer a token by
counting nested controls. Ephyra opts in only through its explicit incoming
main reward; its side-room offers never become an aggregate rail token. Target,
occurrence, reward, and finding focus continue to resolve to the exact control
inside the decision.

Picked and unpicked targets use the same occurrence identity and semantic
addresses. Visual grouping does not change ownership.

The one-stop-per-decision rule applies only to rail presentation. It does not
collapse, delete, or coarsen the decision's target, occurrence, reward,
room-local, or finding products.

### Variant-Owned Structure

- F/G/P use the same Door 1 flow for ordinary rooms and their required atomic
  normal-door takeover at the declaration-admitted terminal source.
- H retains four realized Fields decisions; its fifth empty decision can only
  resolve to the required takeover, even if its ordinary Fields setup is still
  unresolved.
- I's Preboss remains a generated ordinary peer after Goal completion; it has
  no over-bound terminal envelope and closes the biome only when picked.
- O and Q each add a terminal empty decision after their six ordinary units;
  only the declaration-fixed width-one Preboss is authorable there. The
  ordinary declaration domain may remain visible as disabled options rather
  than being hidden by terminal invalidity.

The shared rail and inspector share a direct room-choice surface, not a
universal ownership model or a separate Preboss action.

## Hub Decision Workspace

N uses the same route rail, inspector, semantic focus, finding, and coverage
language, but its center is not an ordinary decision spine. The
`HubDecisionWorkbench` projects:

- fixed Opening and PreHub entries;
- the persistent board over 26 declaration-fixed Hub slots, with nine or ten
  open members;
- one complete room and incoming reward for each open slot;
- one ranked open-room board: the exact dense authored visit prefix (through
  six positions), one compact next-position target for every remaining visit
  owner when incomplete, and a presentation-only unvisited tail;
- side-room generation and entry state under visited parents;
- derived Hub returns and parent restores;
- the fixed completed-Hub handoff to the width-one Preboss Shop and its derived
  completion sequence.

The board remains a joint generation region. Its authored prefix is the only
traversal order; its unvisited tail is React-local presentation state and is
not persisted, evaluated, or placed in Undo history. A visible boundary keeps
that distinction explicit. Open-set membership and visit order remain separate
semantic controls.

One Hub-decision-owned interaction supplies complete visit-prefix proposals.
It never replaces the exact `HubVisitAddress` markers, inspector destinations,
or positional assessment products: those remain reachable for both authored
and unplanned visit positions. Tail-only moves are presentation changes;
any prefix change dispatches one aggregate semantic command after the bound
candidate interaction has evaluated the complete proposed prefix.

Open Hub slots render as one ranked roster rather than a multi-column grid.
The row's ordering and membership controls occupy its first line; its existing
main-reward control occupies a second line so room-local detail can expand
without changing a peer row's height. A visible pointer drag grip is an
optional direct-manipulation surface, with named arrow controls retained for
keyboard operation. Closed slots remain in their compact three-column
disclosure grid.

The N rail gives its fixed Opening and PreHub stages and each authored Hub
visit one read-only primary-reward token when the room projects one. This is
the same resolved token product used by ordinary selected-room context: fixed,
incoming, and Ephyra incoming rewards are eligible, while side-room offers are
not. The token neither changes focus nor creates another edit path; the Hub
board remains the sole editable main-reward surface.

Compact board cells may focus their room and reward state in the inspector, but
N never acquires arbitrary room replacement merely to reuse an ordinary room
picker. Membership, visits, and the completed-Hub handoff remain Hub-owned
semantic interactions.

Hub membership changes are batch composition rather than navigation. Their
bound `OpenHubSlot` and `CloseHubSlot` intents have no semantic-focus product:
opening or closing a room must not select the moved slot or jump the inspector
to its room configuration. Pointer and touch changes preserve the current
viewport. Keyboard changes use transient React-local continuity to move to the
nearest enabled membership control in the source region (then its documented
local fallback), never the card that just moved. This focus continuity is not
persisted or stored in Redux. Explicit Room details, reward, and finding
actions continue to use their exact semantic owner destinations.

## Progressive Coverage and Findings

The workspace consumes the single atomic project evaluation:

- evaluated owners render their contextual support and findings;
- the coverage frontier is visible at its semantic stop or Hub region;
- retained later authored owners remain editable but are marked unassessed;
- a downstream biome blocked by an earlier biome shows the upstream gate rather
  than fabricated local invalidity;
- invalidity propagates to biome, route, and project summaries without losing
  the exact semantic owner.

Color is supplementary. Icons, labels, grouping, descriptions, and accessible
names carry the same state.

The default presentation uses compact owner markers and inspector detail rather
than repeating full inline error sentences beside every control.

## Empty and Future Outline

A configured biome with no authored topology should show its declared structure
and live authoring frontier rather than a blank form. This is a read-only outline,
not preallocated authored state.

The outline follows these rules:

- declared start, fixed entry, Preboss, Boss, and PostBoss roles may appear as
  concrete read-only landmarks;
- fixed-count layouts may show their exact remaining stage count;
- variable-length layouts may show only a simulation-provided completion
  horizon;
- when no truthful horizon exists, the UI says that the route length varies and
  does not invent an approximate count;
- I presents its eventual completion role without pretending that an independent
  Preboss slot is currently authorable;
- N presents an empty Hub board and visit structure, not a false ordinary rail;
- only the current semantic frontier is interactive.

Any completion-horizon or remaining-structure summary must reach the application
projection as a normalized layout fact or simulation result. Neither the
application presentation layer nor React interprets force or timing declarations
to calculate it.

## Contextual Controls

The inspector's decision offers and fixed-stage workbenches compose the shared
contextual controls from `CONTEXTUAL_EDITOR_UX.md`:

- grouped room selection for replaceable ordinary occurrences;
- required-first and unavailable disclosures;
- selected-invalid retention;
- producer-resolved reward domains;
- sibling, source, and counted-bag guidance;
- one compound reward interaction over a complete resolved offer.

The application owns picker grouping, ordering, and player-facing explanation
policy. React owns accessible interaction, search, disclosure, and incomplete
popover progress.

After `ReplaceOccurrenceRoom`, the workspace projects the one reconciled
authored snapshot. It does not retain or reset leaves by rendered position:
compatible values remain at their stable semantic owners, newly introduced
leaves show declaration defaults, and retained context-invalid values receive
ordinary finding presentation.

## Removal Actions and Repair

Commit 5a removes browser-native confirmation from the existing immediate
semantic-command paths without replacing it with an application dialog. Every
current in-project structural edit already has one semantic command and one
history entry; existing Undo/Redo remains its recovery mechanism. Controls
that remove existing authored structure use the red danger affordance only to
communicate that subtractive effect. They do not receive a different command,
history, confirmation, or recovery path. This follow-up does not add a generic
removal-action abstraction, completion status, or post-edit focus policy.

Retained-overflow and Preboss-handoff repairs remain explicit:

1. show unavailable retained targets at their semantic owner;
2. show which picked target or Preboss realization is no longer available;
3. let the user select a representable continuation;
4. expose the owning reconciliation command;
5. reconcile immediately when the user invokes that explicit action;
6. rely on the existing Undo/Redo history controls for recovery when needed.

Existing action labels invoke semantic commands; they do not calculate
deletion scope or repair the project themselves. Persistent deletion-scope
copy is intentionally absent from the editor until user research identifies a
specific action that needs it. Commit 5a does not add a command-specific
post-edit focus rule. The application-wide session liveness reconciliation may
clear a deleted finding or focus reference after a new workspace publication,
but never rehomes it or supplies command focus.

The authored-project core calculates the pure removal impact when it executes
the semantic command. The workspace exposes a complete removal or repair
command-intent capability with its declared before-focus behavior, not a
projected impact closure. Neither the projection nor React walks authored
descendants to infer deletion.

For a completed Hub, closing an unvisited slot that crosses the declared
open-set minimum includes both the detached slot subtree and the Hub-owned
completed-handoff subtree in that one engine-owned impact. The resulting board
remains visible as incomplete with its authored visits retained.

## Component Foundation

Use accessible primitives for popovers, radio groups, disclosures, status
announcements, and keyboard navigation. The contextual picker uses Radix
Popover plus `cmdk`, styled through the existing hand-written CSS. No
removal-confirmation dialog dependency is required for in-project editing.
Confirmation is reserved for a future operation that is both externally
consequential and not recoverable through project history. Tailwind adoption
and literal shadcn component copying are out of scope.

Dependency choice remains subordinate to the ownership contract. A component
library must not hide semantic commands, make caller-owned option models mutable,
or move presentation policy into generic wrappers.

## Acceptance

### Trait Offer Closure

Each active trait-bearing acquisition role is an expected workspace leaf with
one `TraitOfferAddress`, one containing inspector, one bound interaction, and
one exact finding destination. The occurrence assembler derives these leaves
from normalized acquisition roles; it does not switch on Hammer names or
reconstruct lifecycle order. Room, local, wheel, Devotion, and Shop
projections all reuse the same interaction package. A materialized Shop
publishes the same authored trait controls for purchased and unpurchased
offers; an unpurchased control is authoring surface only and has no reached
acquisition, trait event, or equipped-state fold until its purchase role is
selected.

The shared trait editor is a projection over the engine's three-option
assessment. It dispatches complete semantic replacements and selected-option
commands; it never evaluates prerequisites, slots, rarity counts, element
thresholds, loadout compatibility, or chronology. The route Traits panel is a
second reference to those controls, not a persisted route-wide model. Dialog
target and focus restoration remain transient editor-session state.

Complete-offer first-Olympian composition findings are projected through the
same leaf and destination. They do not add a workspace mode or marker; the
engine derives empty ordinary-boon slots from equipped state, and dormant,
unpicked, or unpurchased leaves remain non-consuming authoring surfaces.

Replacement evidence uses that same leaf and interaction. A reached
Olympian replacement carries its exact engine transition and promoted rarity
into the option annotation and selected chronological summary. The workspace
does not add a replacement editor or checkbox, and React never reconstructs
slot occupancy, promotion, shortage limits, or branch legality. Heroic appears
only when the bound engine candidate is an Epic-to-Heroic replacement; findings
leave all trait and rarity controls available for repair.

The structured workspace is complete when:

- ordinary-decision biomes show one labeled rail stop per decision, active
  frontier, Preboss structure, coverage, and findings without adding every
  room offer to the rail;
- N shows one ranked board with an explicit visit-prefix cutoff through
  `HubDecisionWorkbench` without acquiring ordinary-decision semantics;
- every ordinary decision exposes room, reward, and picked state together while
  preserving unpicked reward and finding state;
- finding navigation focuses the exact semantic owner inside its owning
  decision or N visit-local workbench;
- empty and partial biomes show only truthful declared or projected structure;
- no expected length, probability, invented exit, or hypothetical future room is
  presented as a game fact;
- removal and repair interactions use explicit labels and dispatch only
  existing semantic commands;
- the layout remains keyboard operable, screen-reader legible, and responsive;
- no persisted authored contract, simulation rule, or topology identity is introduced for
  presentation convenience.
