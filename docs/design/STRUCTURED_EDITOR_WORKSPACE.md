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
- Linear and Hub workspace presentation;
- picked-path and unpicked-offer visual hierarchy;
- progressive coverage and finding placement;
- empty-biome outlines;
- destructive dialogs, repair presentation, accessibility, and responsive
  behavior.

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
- React implements no eligibility, force, reward-store, bag, sibling, terminal,
  or route-gating rule.
- One visible user intent dispatches one semantic command and creates one undo
  entry.
- Focus, expansion, search, disclosure, viewport, and dialog state remain
  transient UI-session state.
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

The center region is selected by normalized layout kind. It does not attempt to
make Linear and Hub biomes look structurally identical.

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
  -> layout-specific structured workspace view
```

The projection owns visual grouping, ordering, compact summaries, coverage
markers, terminal-outline facts, and semantic focus destinations. React renders
that projection and dispatches semantic commands.

Linear creation establishes explicit transient semantic focus through the
existing semantic-owner action. Every authored start selects its created Room
Occurrence, and creating a batch or terminal from the visible frontier first
selects that frontier's continuation workbench. Later edits retain that
resolvable owner even when they reveal a new continuation frontier.

The newly revealed frontier remains visible in the rail without stealing
inspector focus. The workspace may attach that exact frontier marker only to
its direct predecessor entry or decision; that selected workbench exposes
`Move to Next Decision`. The nearby action and rail frontier dispatch the
same semantic focus address. It is navigation only: it creates no authored
edit, history entry, evaluation, or candidate work. There is no separate
terminal-navigation action; the frontier retains its declaration-owned
terminal controls.

Incomplete-biome structure is an authored-topology projection enriched by
progressive evaluation. It must not be described as canonical topology.

## Linear Workspace

For F/G/H/I/O/P/Q, the center region presents a structured Linear rail:

- the authored start or fixed entries;
- each picked continuation as the trunk;
- each generated decision as one stop;
- the active continuation frontier;
- retained downstream structure after an invalid upstream edit;
- layout-owned terminal structure;
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

- F/G/P retain ordinary generated decisions and independent forked terminals.
- H retains exactly four Fields decisions before its independent terminal.
- I retains one generated-decision frontier; its Preboss is a generated peer
  after Goal completion and closes the biome only when picked.
- O retains six one-exit decisions and a direct terminal.
- Q retains six declaration-owned stages and a direct terminal.

The shared rail and inspector do not invent one universal frontier or terminal
action.

## Hub Workspace

N uses the same route rail, inspector, semantic focus, finding, and coverage
language, but its center is not a Linear spine. It projects:

- fixed Opening and PreHub entries;
- the persistent nine-or-ten-member open Hub board;
- one complete room and incoming reward for each open slot;
- the ordered six-visit pylon timeline;
- side-room generation and entry state under visited parents;
- derived Hub returns and parent restores;
- the fixed Preboss shop and derived completion sequence.

The board remains a joint generation region. Rendered board order must not
pretend to be a simulation prefix. Open-set membership and visit order remain
separate semantic controls.

Compact board cells may focus their room and reward state in the inspector, but
N never acquires arbitrary room replacement merely to reuse the Linear picker.

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

- declared start, fixed entry, terminal, Boss, and PostBoss roles may appear as
  concrete read-only landmarks;
- fixed-count layouts may show their exact remaining stage count;
- variable-length layouts may show only a simulation-provided terminal horizon;
- when no truthful horizon exists, the UI says that the route length varies and
  does not invent an approximate count;
- I presents its eventual completion role without pretending that an independent
  Preboss slot is currently authorable;
- N presents an empty Hub board and visit structure, not a false Linear rail;
- only the current semantic frontier is interactive.

Any terminal-horizon or remaining-structure summary must reach the application
projection as a normalized layout fact or simulation result. Neither the
application presentation layer nor React interprets force or timing declarations
to calculate it.

## Contextual Controls

The inspector and compact leaves compose the shared contextual controls from
`CONTEXTUAL_EDITOR_UX.md`:

- grouped room selection for replaceable Linear occurrences;
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

## Destructive Actions and Repair

Replace browser-native confirmation with accessible application dialogs.
Destructive actions name their exact visible scope, such as the number of
downstream decisions and occurrences removed.

Retained-overflow and terminal repairs remain explicit:

1. show unavailable retained targets at their semantic owner;
2. show which picked target or terminal realization is no longer available;
3. let the user select a representable continuation;
4. expose the owning reconciliation command;
5. remove retained structure only after explicit confirmation.

Dialogs describe commands; they do not calculate deletion scope or repair the
project themselves.

## Component Foundation

Use accessible primitives for popovers, dialogs, radio groups, disclosures, and
keyboard navigation. The contextual picker uses Radix Popover plus `cmdk`,
styled through the existing hand-written CSS. The later destructive-dialog
slice will add Radix Dialog at that contact point. Tailwind adoption and literal
shadcn component copying are out of scope.

Dependency choice remains subordinate to the ownership contract. A component
library must not hide semantic commands, make caller-owned option models mutable,
or move presentation policy into generic wrappers.

## Acceptance

The structured workspace is complete when:

- Linear biomes show the picked continuation, generated leaves, active frontier,
  terminal structure, coverage, and findings without a long equal-weight card
  stack;
- N shows its board and visit timeline without acquiring Linear semantics;
- every compact leaf remains inspectable and preserves reward and finding state;
- finding navigation focuses the exact semantic owner in the inspector;
- empty and partial biomes show only truthful declared or projected structure;
- no expected length, probability, invented exit, or hypothetical future room is
  presented as a game fact;
- destructive and repair interactions state scope and dispatch only existing
  semantic commands;
- the layout remains keyboard operable, screen-reader legible, and responsive;
- no authored schema, simulation rule, or topology identity is introduced for
  presentation convenience.
