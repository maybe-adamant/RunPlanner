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
| route status   | authored path / Hub board   | selected decision, room,  |
| biome status   | offers and coverage         | reward, finding, or       |
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
`WorkspaceBiome` projection. Its exhaustive workspace-node union presents
ordinary decisions, linked exits, takeover and mixed Preboss batches,
completion, and the Hub decision without React inspecting authored topology.
`HubDecisionWorkbench` is the one N-specific workbench and is nested inside
that shared workspace; it does not create a second editor surface.

The center region does not attempt to make ordinary decision topology and the
Hub board look structurally identical. It does give both the same route rail,
semantic focus, finding navigation, coverage, and focused-inspector language.

### Focused Inspector

The inspector renders one focused semantic owner and the controls that belong to
it. A decision focus may include its batch policy, physical exits, picked state,
and compact target summaries. A room or local-child focus renders its concrete
room, reward, shop, wheel, cage, side-room, or other owned state.

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

Creation establishes explicit transient semantic focus through the existing
semantic-owner action. Every authored start selects its created Room Occurrence,
and creating an ordinary batch, a takeover Preboss batch, or a completed-Hub
handoff from the visible frontier first selects that frontier's owning
workbench. Later edits retain that resolvable owner even when they reveal a new
authoring frontier.

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

## Ordinary Decision Workspace

For F/G/H/I/O/P/Q, the center region presents a structured decision rail:

- the authored start or fixed entries;
- each picked continuation as the trunk;
- each generated decision as one stop;
- the active continuation frontier;
- retained downstream structure after an invalid upstream edit;
- layout-owned Preboss-batch and completion structure;
- completion rooms as derived, read-only endpoints where applicable.

The rail is not a freeform graph. Its visual position is derived from semantic
topology and never persisted.

### Picked Continuation and Generated Leaves

The picked exit receives the strongest visual connection because it continues
the entered route. Unpicked targets remain real generated offers and are not
discarded presentation details. They may affect reward bags, sibling conflicts,
source support, and possibility evaluation.

An unpicked target may collapse to one compact leaf summary, but the summary
must retain:

- its room label and incoming reward summary;
- assessed, unassessed, invalid, or finding state;
- a direct focus or expansion action;
- enough distinction to locate sibling and bag conflicts.

Picked and unpicked targets use the same occurrence identity and semantic
addresses. Visual weight does not change ownership.

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

The inspector and compact leaves compose the shared contextual controls from
`CONTEXTUAL_EDITOR_UX.md`:

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

- ordinary-decision biomes show the picked continuation, generated leaves,
  active frontier, Preboss structure, coverage, and findings without a long
  equal-weight card stack;
- N shows its board and visit timeline through `HubDecisionWorkbench` without
  acquiring ordinary-decision semantics;
- every compact leaf remains inspectable and preserves reward and finding state;
- finding navigation focuses the exact semantic owner in the inspector;
- empty and partial biomes show only truthful declared or projected structure;
- no expected length, probability, invented exit, or hypothetical future room is
  presented as a game fact;
- removal and repair interactions use explicit labels and dispatch only
  existing semantic commands;
- the layout remains keyboard operable, screen-reader legible, and responsive;
- no persisted authored contract, simulation rule, or topology identity is introduced for
  presentation convenience.
