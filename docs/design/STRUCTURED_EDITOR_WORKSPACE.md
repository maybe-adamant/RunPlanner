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
| Route rail     | Biome structure             | Focused inspector         |
|                |                             |                           |
| route status   | decision points / Hub board | selected decision, room,  |
| biome status   | picked summaries / coverage | reward, finding, or       |
| navigation     | active frontier             | repair surface            |
+----------------+-----------------------------+---------------------------+
```

These are presentation regions, not persisted panels. The exact responsive
composition may become two columns, stacked regions, or an inspector drawer at
narrow widths.

### Desktop Sizing and Scroll Ownership

At desktop widths, an active biome workspace fills the editor height remaining
after findings and any route-context message. The workspace shell itself is
not a vertical scrollport. Its Biome structure and Focused inspector regions
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
ordinary decisions, linked exits, takeover and mixed Preboss batches,
completion, occurrence-local workbenches, and the Hub decision without React
inspecting authored topology. The projected rail deliberately exposes only
player-facing biome stages and decision points; exhaustive node ownership does
not imply one rail stop per node. `HubDecisionWorkbench` is the one N-specific
workbench and is nested inside that shared workspace; it does not create a
second editor surface.

The rail is a selective decision-highlight and navigation projection, not
workspace authority. Omitting a semantic owner from the rail changes neither
its authored data nor its workspace node, findings, contextual controls, focus
destination, or editability. Room rewards and any future encounters, features,
items, or other room-local products remain available through the containing
decision or fixed-stage inspector unless a separate player-facing navigation
need justifies another rail highlight.

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
service, interaction helpers, and closure-audit seam are the stable projection
contract. Contract declarations and projector assembly are private modules:
the projector may consume the contract, but neither module may depend on the
public entry or become an alternate consumer import path. This keeps workspace
construction replaceable without making React or application composition depend
on its internal assembly order.

### Internal Projection Production Line

The private workspace implementation preserves one directed production line:

```text
WorkspaceBiomeSource
  -> WorkspaceBiomeSemanticAssembly
       ├-> biome presentation (rail, default inspector, exact destinations)
       └-> project-wide interaction binding
catalog + persisted authored state
  -> independent authored-owner expectations
semantic assembly + presentation + bound interactions + expectations
  -> final-product closure
  -> cached structured-workspace service
```

The semantic assembly owns complete biome facts: authored structural nodes,
room-local products, controls, preliminary destinations, and interaction
requirements. Biome presentation and interaction binding are sibling consumers
of that immutable product. Presentation owns the selective rail, Hub visit
grouping, default inspector, and final inspector/rail destinations; interaction
binding owns executable command adapters and does not consume presentation.
Independently derived authored-owner expectations remain a separate catalog plus
persisted-state audit path. The cached service composes these returned products,
project and route markers, coarse finding fallbacks, and the final immutable
workspace; it does not construct occurrence, decision, Hub, rail, or audit
families itself.

Creation establishes explicit transient semantic focus through the existing
semantic-owner action. Every authored start selects its created Room Occurrence.
Creating an ordinary target selects its target owner while remaining in the
owning decision workbench. Creating an ordinary batch, a takeover Preboss
batch, or a completed-Hub handoff from the visible frontier first selects that
frontier's owning workbench. Later edits retain that resolvable owner even when
they reveal a new authoring frontier.

The newly revealed frontier remains visible in the rail without stealing
inspector focus. The workspace may attach that exact frontier marker only to
its direct predecessor entry or decision; that selected workbench exposes
`Move to Next Decision`. The nearby action and rail frontier dispatch the
same semantic focus address. It is navigation only: it creates no authored
edit, history entry, evaluation, or candidate work. There is no separate
completion-navigation action; the frontier retains its declaration-owned
ordinary, Preboss, or Hub controls.

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

### Projection Closure

Before React renders the workspace, the application independently enumerates
the semantic owners and declaration-required editable leaves implied by the
authored state. It verifies that:

- every decision, target, occurrence, and active declaration-owned leaf has one
  reachable projection;
- every exact semantic address resolves to its containing inspector and exact
  interaction;
- advertised interactions exist and conflicting or duplicate authored owners
  fail the projection contract;
- fine-grained findings resolve to their exact owner rather than a biome-level
  fallback.

A target's room and reward may be nested inside its decision workbench. Closure
therefore validates semantic-owner reachability, not a count or shape of
standalone UI nodes. Candidate support and findings decorate reachable
controls; they never decide whether a mandatory authored control exists. React
must not silently omit a required control because an interaction lookup failed.

## Ordinary Decision Workspace

For F/G/H/I/O/P/Q, the center region presents a concise decision-point rail:

- the authored start or fixed entries;
- each generated decision as exactly one stop, with a brief picked room and
  reward summary;
- the active continuation frontier;
- retained downstream structure after an invalid upstream edit;
- a layout-owned Preboss stage where it is distinct from an ordinary decision;
- completion rooms as a separate derived, read-only outline.

The rail is not a freeform graph. Its visual position is derived from semantic
topology and never persisted.

### Decision Offers and Picked Summary

Selecting a decision shows all of its physical offers together. Every authored
offer keeps its room selector and reward editor at the same visual level,
because the room and incoming reward jointly describe the offered door.
Single-choice controls live on those cards, and the picked card receives the
strongest emphasis because it is the authored selected route. Evaluated entry
is shown separately when materialization has actually reached that room.

Unpicked targets remain fully visible in the decision workbench because they
still affect reward bags, sibling conflicts, source support, and possibility
evaluation. They do not become equal-weight stops on the biome rail. The rail
shows only the picked room and reward as the decision's compact summary, while
target, occurrence, reward, and finding focus all resolve to the exact control
inside the decision.

Picked and unpicked targets use the same occurrence identity and semantic
addresses. Visual grouping does not change ownership.

The one-stop-per-decision rule applies only to rail presentation. It does not
collapse, delete, or coarsen the decision's target, occurrence, reward,
room-local, or finding products.

### Variant-Owned Structure

- F/G/P retain ordinary generated decisions and declaration-owned takeover
  Preboss batches.
- H retains exactly four Fields decisions before its takeover Preboss batch.
- I retains one generated-decision frontier; its Preboss is a generated peer
  after Goal completion and closes the biome only when picked.
- O retains six one-exit decisions and a declaration-fixed width-one Preboss
  batch.
- Q retains six declaration-owned stages and a declaration-fixed width-one
  Preboss batch.

The shared rail and inspector do not invent one universal authoring frontier or
Preboss action.

## Hub Decision Workspace

N uses the same route rail, inspector, semantic focus, finding, and coverage
language, but its center is not an ordinary decision spine. The
`HubDecisionWorkbench` projects:

- fixed Opening and PreHub entries;
- the persistent board over 26 declaration-fixed Hub slots, with nine or ten
  open members;
- one complete room and incoming reward for each open slot;
- the ordered six-visit pylon timeline;
- side-room generation and entry state under visited parents;
- derived Hub returns and parent restores;
- the fixed completed-Hub handoff to the width-one Preboss Shop and its derived
  completion sequence.

The board remains a joint generation region. Rendered board order must not
pretend to be a simulation prefix. Open-set membership and visit order remain
separate semantic controls.

Compact board cells may focus their room and reward state in the inspector, but
N never acquires arbitrary room replacement merely to reuse an ordinary room
picker. Membership, visits, and the completed-Hub handoff remain Hub-owned
semantic interactions.

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
specific action that needs it. Commit 5a does not add a new post-edit focus
rule.

The authored-project core calculates the pure removal impact once, and command
execution consumes that same result. The application projection carries that
impact for command behavior, but neither it nor React walks authored
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

The structured workspace is complete when:

- ordinary-decision biomes show one rail stop per decision, a picked room and
  reward summary, active frontier, Preboss structure, coverage, and findings
  without adding every room offer to the rail;
- N shows its board and visit timeline through `HubDecisionWorkbench` without
  acquiring ordinary-decision semantics;
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
