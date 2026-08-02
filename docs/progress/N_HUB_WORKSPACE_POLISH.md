# N Hub Workspace Polish

Status: proposed implementation slice

## Purpose

Biome N's Hub workspace has the correct authored model but the wrong visual
hierarchy. It truthfully presents the persistent 26-slot board, the nine or ten
open rooms and their incoming rewards, and the ordered six-room visit plan.
However, all 26 slots currently receive similarly weighted cards before the
visit plan. The result is an exhaustive inventory surface rather than a concise
decision workspace.

This slice reorganizes the existing projected facts and bound interactions. It
does not change the catalog, authored topology, commands, evaluation,
simulation, reward ownership, or persistence.

## UX Contract

The Hub page should present, in order:

1. the open Hub rooms and their incoming rewards;
2. the six-position Pylon visit order;
3. the completed-Hub handoff when it is available; and
4. the remaining closed rooms in a compact disclosure.

The intended authored-state layout is:

```text
Ephyra Hub

Open rooms                                      9 open · 9–10 required
┌ Combat 01 ─────┐ ┌ Combat 02 ─────┐ ┌ MiniBoss 01 ───┐
│ Combat    Open │ │ Combat    Open │ │ MiniBoss  Open │
│ [Reward]       │ │ [Reward]       │ │ [Reward]       │
│                │ │ Visited        │ │ Visited        │
│                │ │ Room details   │ │ Room details   │
└────────────────┘ └────────────────┘ └────────────────┘

Pylon visit order                               4 of 6 planned
1  Combat 02 · Reward: [summary]  [room selector]  [Remove from here]
2  MiniBoss 01 · Reward: [summary] [room selector]  [Remove from here]
3  ...
4  Choose next room   [room selector]
5  Complete prior visit
6  Complete prior visit

[Continue to Preboss — only when available]

▶ Closed rooms (17)
```

The open board uses the full inspector width. It is not placed beside the
visit timeline: a side-by-side layout would prevent the requested three-room
desktop grid and would squeeze inline reward controls. With only nine or ten
open rooms, three columns reduce the primary board to three or four rows, so
the visit timeline is no longer buried beneath thirteen rows of open and closed
cards.

## Current Problems

### Equal weight for open and closed slots

Every declaration-fixed slot currently receives a full card. Sixteen or
seventeen closed rooms therefore consume most of the visible board even though
they own no active reward control and are only needed when changing board
membership.

### Visit decisions are buried

The six-room traversal appears after the complete 26-slot board. A user
choosing or replacing a visit must scroll away from the open-room reward
context that informs that choice.

### Repeated low-value information

The board repeats:

- six-digit physical door IDs;
- `Evaluated` on normal slots;
- `This room is closed.` on every closed slot; and
- `Inspect room` on every open slot, including rooms with no additional
  authored detail to inspect.

These facts either remain available in source-backed data or are already
communicated by control state and styling. Their repetition obscures findings,
rewards, membership, and traversal.

### Main-reward context disappears away from the board

The Hub board is correctly the one batch surface for choosing the open rooms'
main rewards. But a selected visit row and the occurrence-local detail surface
currently make the user remember that reward or navigate back to the board to
reconfirm it. They need a concise read-only view of the same authored value,
not a second reward editor.

## Presentation Changes

### 1. Partition projected slots for presentation

`HubDecisionWorkbench` should group the already-projected slots without
re-deriving membership policy:

```ts
const openSlots = node.slots.filter((slot) => slot.open);
const closedSlots = node.slots.filter((slot) => !slot.open);
```

This grouping is React-owned presentation. `slot.open` remains the projection's
authoritative fact, and both groups retain declaration order. The UI must not
sort rooms into a simulated sequence or imply that board order is visit order.

Replace the single exhaustive grid with three presentation regions:

- `hub-open-room-grid`;
- `hub-closed-room-disclosure`; and
- `hub-closed-room-grid`.

### 2. Split open cards from closed options

Replace the multi-state `HubSlotCard` presentation with two focused local
components:

- `OpenHubRoomCard`;
- `ClosedHubRoomOption`.

`HubSlotMembership` remains shared and retains its lazy candidate interaction,
provisional opening identity, and complete semantic command intent.

#### Open room card

An open card contains:

- room label;
- room kind;
- open membership control;
- incoming reward control or fixed reward presentation;
- authored visit/details-active state when applicable;
- exceptional assessment or findings; and
- `Room details` only after the room is in the authored visit order and has
  meaningful room-local authored detail.

The incoming reward remains inline on the Hub board before and after the room
is visited. The Hub board is the sole editable main-reward batch surface; a
visit row or occurrence-local workbench may present the same value read-only,
but must not own a second editor, command path, reward policy, or picker state.

The existing `Inspect room` control becomes `Room details`. It is rendered only
when `slot.visited` is true, the projected room exists, and the same UI-owned
local-detail presentation predicate used by the occurrence workbench says that
the room has meaningful local detail. It must not use evaluated entry as its
condition: `slot.visited` represents authored details activation, which can be
true while evaluation has not entered the room. The button's accessible name
remains room-specific (for example, `Open details for Combat 02`) even though
its visible text is simply `Room details`.

For the current N Hub, this excludes fixed/miniboss/story cards that would only
lead to `No additional room details`; a visited combat room with Ephyra
side-room detail remains linked. The nested Hub visit rail remains the other
route to the same occurrence-local workbench.

An open card does not visibly render:

- its six-digit physical door ID;
- a normal `Evaluated` label; or
- an inspect/details link before the visit activates local details.

#### Read-only reward context away from the board

Each authored visit whose room projects a main Hub reward shows one compact,
read-only `Reward: {summary}` line. This helps compare the chosen visit order
without turning the timeline into a second reward-selection surface. Next and
locked visit positions do not reserve empty reward rows.

An occurrence-local workbench that is reached through `Room details` also
starts with a small `Hub reward` context row. It presents the same summary and,
when that main reward is editable, a quiet `Edit Hub reward` action. A fixed
non-editable reward presents its fixed summary without a false edit affordance.

`Edit Hub reward` dispatches semantic focus for the existing main-reward owner;
it does not dispatch a semantic command. Existing Hub focus routing returns to
the Hub board. The board then reveals and visually identifies the matching open
card and reward trigger, without automatically opening the picker. This exact
return behavior is UI-session presentation only: it neither changes authored
history nor adds a new focus destination.

Use the existing reward interaction's summary presentation for editable offers
and the projected fixed summary for fixed offers. Do not introduce a second
offer formatter, projection field, or duplicate reward ownership model merely
for this read-only context.

#### Closed room option

A closed room is a compact membership option rather than a reward-sized card.
It contains only:

- room label;
- room kind;
- open membership control; and
- exceptional assessment or findings.

It does not render reward controls, visit state, room-detail navigation,
physical door IDs, or a repeated closed-state sentence. When opened, the next
projection moves it into the open grid. When an eligible open room is closed,
the next projection moves it into the closed group.

### 3. Put closed rooms in an accessible disclosure

Closed rooms live after the visit plan and completed-Hub handoff in a native
`details` disclosure:

```tsx
<details className="hub-closed-room-disclosure">
  <summary>Closed rooms ({closedSlots.length})</summary>
  <div className="hub-closed-room-grid">...</div>
</details>
```

The disclosure is closed by default. Native disclosure semantics provide
keyboard operation without adding authored state, Redux session state, or a
custom accordion abstraction.

The closed default must not hide a semantic navigation destination. The local
presentation state may expand the disclosure when the focused semantic owner or
selected finding belongs to a closed slot or one of its descendants, including
after a successful close action. It must otherwise preserve the user's native
open/closed choice. This is transient reveal behavior, not persisted or Redux
state. Slot markers remain mounted inside their compact option so exact owner
and finding addressing is retained.

At the maximum open count, closed-room opening controls retain their projected
disabled/candidate behavior. At the minimum open count, open-room closing
controls do the same. The presentation must not infer either boundary.

### 4. Tighten the open-room grid

The normal desktop layout is three equal-width open cards per row:

```css
.hub-open-room-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding: 12px;
}
```

Responsive behavior is:

- three columns when the inspector provides comfortable reward-card width;
- two columns at intermediate inspector widths; and
- one column on narrow/mobile layouts.

The breakpoint should follow the inspector's available width rather than only
the outer viewport where practical. A container query on
`hub-decision-workbench` is preferred if it behaves consistently in the
supported browser host:

```css
.hub-decision-workbench {
  container-type: inline-size;
}

@container (max-width: 760px) {
  .hub-open-room-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@container (max-width: 500px) {
  .hub-open-room-grid {
    grid-template-columns: 1fr;
  }
}
```

If container queries prove unsuitable for the application host, use explicit
media breakpoints and verify the 1200–1400px viewport range, where the route
rail and biome rail consume a substantial share of the available width.

Retain an explicit narrow-viewport fallback that forces the open grid to one
column at the existing mobile workspace breakpoint. A 500px container threshold
alone can leave a one-column mobile workspace with an inspector wide enough to
remain at two columns.

The closed-room grid is denser than the open board. It may use four columns at
wide widths and progressively reduce to three, two, and one. Closed options
must retain usable labels and membership controls rather than meeting a column
target at the expense of legibility.

The `summary` is a deliberately styled, generously sized control with a visible
`summary:focus-visible` treatment and enough surrounding space that its focus
outline is never clipped.

### 5. Show assessment only when exceptional

Hub assessment presentation follows this exact table:

- assessed with no findings: render nothing;
- assessed with findings: render the finding count only, never `Evaluated`;
- blocked: render `Blocked` and any finding count; and
- unassessed: render `Not evaluated` and any finding count.

This applies to open cards, closed options, visit rows, and the open-set header.
Exact semantic markers and finding navigation remain intact. The route rail,
biome rail, and inspector already communicate overall evaluation, so hiding
repeated success labels does not remove semantic state.

### 6. Clarify counts and action copy

Replace ambiguous fractions with explicit copy:

- `9 / 9–10` becomes `9 open · 9–10 required`;
- `4 / 6` becomes `4 of 6 planned`; and
- `Remove From Here` becomes `Remove from here`.

Retain `Pylon visit order`; it is a genuine player-facing Ephyra concept.
Retain `Open Ephyra rooms` unless a later dedicated vocabulary pass identifies
a better heading. Hierarchy and density are the concern of this slice.

### 7. Keep the pre-setup state concise

The non-authored Hub has two distinct presentation states:

- when the Hub is the actual authoring frontier, `Set up Hub rooms` remains the
  primary action; and
- when the Hub is earlier than the frontier or blocked, the outline is
  read-only and does not invent that unavailable action.

In either state, render the declaration-fixed domain as one initially closed
`Possible Hub rooms (26)` disclosure containing a compact label-and-kind list,
not 26 full cards repeating `Set up Hub rooms first`. Render a concise,
truthful empty visit state rather than disabled visit controls. No membership,
reward, room-detail, or other unavailable interaction appears before setup.

## Required Section Order

For an authored Hub, the DOM and visual order is:

```text
open rooms
-> Pylon visit order
-> completed-Hub handoff, when available
-> closed-room disclosure
```

The handoff precedes the closed-room disclosure so the primary continuation is
not buried beneath optional board reconfiguration.

## Ownership and Scope Guardrails

This slice must not change:

- catalog Hub declarations or slot order;
- Hub persistence or authored topology;
- `OpenHubSlot`, `CloseHubSlot`, visit, or completed-Hub commands;
- lazy candidate evaluation or provisional opening identity;
- the nine-or-ten open-room constraint;
- the six distinct visits and their authored order;
- incoming reward ownership or reward legality;
- the Hub board as the only editable main-reward surface;
- side-room or Shop-local ownership;
- the completed-Hub handoff;
- the nested Hub visit rail;
- undo/redo or confirmation behavior; or
- semantic owner markers, finding addresses, and focus resolution.

This slice must not add:

- arbitrary Hub room replacement;
- drag-and-drop visit ordering;
- React-generated multi-command swaps;
- a second board or traversal model;
- reward editors, commands, or picker state inside visit rows or
  occurrence-local Hub detail;
- side-room controls on the main Hub board; or
- production validation or audit structures created only to test the layout.

No engine or catalog change is expected. Do not expand the projection contract
unless implementation exposes one concrete missing presentation fact that
cannot be represented truthfully from the current Hub product.

## Implementation Surface

Primary files:

- `apps/planner/src/ui/editor/biome/HubDecisionWorkbench.tsx`;
- `apps/planner/src/ui/editor/biome/HubDecisionWorkbench.test.tsx`;
- `apps/planner/src/ui/editor/biome/OccurrenceWorkbench.tsx`;
- `apps/planner/src/ui/editor/biome/OccurrenceWorkbench.test.tsx`; and
- `apps/planner/src/ui/styles.css`.

Representative workspace tests may require query updates in:

- `apps/planner/src/ui/editor/biome/BiomeWorkspace.test.tsx`.

Do not change stable design documents while implementing this temporary plan.
After the slice is accepted, absorb any durable presentation contract into the
owning editor/workspace design document and retire this progress document.

## Test Deliverables

Focused tests must prove:

1. for an authored Hub, all 26 projected slots remain represented across the
   open and closed regions, while the outline state has its own compact-domain
   witness;
2. the representative project renders the expected open and closed counts;
3. every open room retains its incoming reward control or fixed reward
   presentation, as appropriate to its projected room-local state;
4. closed rooms do not render reward controls or room-detail links;
5. closed rooms live inside the disclosure;
6. opening a closed room moves it to the open grid and updates both counts;
7. closing an eligible open room moves it to the closed section;
8. only authored-visit-active rooms with meaningful local detail expose `Room
details`, including when details are active but evaluated entry is false;
9. normal assessed slots do not repeat `Evaluated`;
10. blocked and unassessed closed options remain visibly represented, while an
    incoming-reward finding on an open, unvisited room retains its visible
    marker and exact Hub-board focus destination;
11. section DOM order is open rooms, visit order, optional handoff, then closed
    rooms; and
12. visit replacement, truncation, undo, and completed-Hub handoff behavior is
    unchanged; and
13. semantic focus into a closed slot, including after closing one, reveals the
    disclosure without changing authored state;
14. each authored visit shows the current main-reward summary but no reward
    editor, and a board edit updates that summary without changing visit order;
    and
15. a detail workbench shows the same main-reward context, while `Edit Hub
reward` returns to and visibly identifies the exact Hub card without
    opening the picker or changing authored history. Fixed non-editable rewards
    show no false edit action.

Existing integration witnesses must continue proving:

- Hub main rewards remain reachable from the Hub inspector;
- a nested visit rail child reaches exact occurrence-local details;
- board and visit focus remain synchronized;
- side-room and Shop-local workbenches retain their owners; and
- the completed-Hub handoff focuses and authors the fixed Preboss transition.

Do not test exact CSS column counts in JSDOM. Component tests should validate
semantic grouping and interactions; responsive layout requires visual
verification.

## Visual Acceptance Matrix

Verify these authored states:

- Hub not yet set up;
- nine-room board;
- ten-room board;
- partial visit order;
- completed six-visit order with the Preboss handoff;
- blocked or unassessed board members;
- finding-bearing open room and a blocked or unassessed closed option;
- authored visits with editable and fixed main-reward summaries;
- visited combat room with side-room details;
- visited miniboss or story room without a redundant room-detail link;
- authored details active while evaluated entry remains false;
- minimum membership where closing is unavailable; and
- maximum membership where opening is unavailable.

Verify these layouts:

- full desktop inspector with three open cards per row;
- intermediate inspector with two open cards per row;
- mobile inspector with one open card per row;
- expanded closed-room disclosure at each width;
- long reward labels;
- visit and local reward-context summaries that match the Hub-board reward;
- finding/status badges without card overflow; and
- keyboard access to the disclosure, membership controls, reward controls,
  visit selectors, removal actions, and room-detail links.

## Validation

During implementation, use the narrowest truthful lane:

```text
npm run test:ui
```

Before closing the slice, run:

```text
npm run typecheck
npm run test
npm run lint
npm run format:check
npm run build
```

The browser product should also be inspected at the visual acceptance widths.

## Commit Shape

This is one complete React/CSS vertical slice. JSX grouping and styling should
land together rather than as separate unstyled or forwarding commits.

Suggested commit:

```text
feat(editor): streamline Ephyra Hub workspace
```

Acceptance is a shorter and clearer change neighborhood in the Hub renderer,
with no engine churn, no parallel interaction path, and no loss of semantic
owner reachability.
