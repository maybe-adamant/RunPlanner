# Hub and Shop Ordering UX

## Status

This is an isolated implementation plan for the direct follow-up to commit
`7af7121` (`feat(shop): author exact purchase order`). It is intentionally not
linked from the stable design documents or the repository delivery index while
the work is active. On completion, durable behavior will be absorbed into the
owning design authorities and this file will be retired.

The active work is one complete Hub vertical slice: replace N's separate Hub
board and visit timeline with one ranked room board.

The Shop proposal below is deliberately deferred. It records a possible later
follow-up, but it authorizes no Shop implementation, test migration, or
acceptance work in this change. The Hub slice changes one engine authoring and
candidate contract. Side-room generation and entry order are explicitly outside
this work.

## Why This Work Exists

The current Hub workbench presents one semantic choice through three visible
structures:

1. open room cards with their rewards;
2. a separate six-position visit timeline; and
3. the closed-room disclosure.

Choosing a room and then selecting the same room again in a distant visit
control is avoidable duplication. The Hub's core choice is which six of the
open rooms will be visited and in what order. One ranked board can communicate
both facts while keeping every room and reward together.

The Shop now authors one exact purchase order, but its table remains in
declaration order and exposes order mainly through an ordinal selector. Moving
purchased offers to the top and allowing direct reordering makes the authored
sequence visible without changing its schema-11 meaning.

The two surfaces share a useful interaction language:

```text
active prefix
  -> ordered by the player
inactive remainder
  -> still visible and available
```

They do not share a domain model. Hub visits are topology-owned traversal;
Shop purchases are occurrence-local reward lifecycle. This plan does not
create a generic engine ordering abstraction to force them together.

## Preserved Authorities

- N's open board and ordered `visitOrder` remain authored by the Hub decision.
- Exactly six distinct open Hub slots complete the Hub visit predicate.
- Every open Hub offer exists and contributes to the full-board reward lookup,
  including rooms outside the visit order.
- A Hub target occurrence, incoming reward, and side-room state remain owned
  by its fixed Hub slot occurrence.
- Open/closed Hub membership remains separate from visit order.
- A visited Hub slot cannot be closed until it is removed from `visitOrder`.
- Shop `purchaseOrder` remains the only purchase membership and order
  authority. Unpurchased offers remain declaration-ordered inventory.
- One completed semantic edit dispatches one command and creates one Undo
  entry.
- React renders projected state and complete bound intents. It does not decide
  Hub validity, candidate support, reward legality, or Shop execution order.
- Invalid authored state and its findings remain visible and repairable.
- Findings and focus continue to resolve through exact semantic owners rather
  than rendered positions.

## Target Hub Experience

### One ranked open-room board

The Hub workbench renders:

1. one ranked board containing every open Hub room exactly once; and
2. the existing closed-room disclosure below it.

The separate visit timeline is deleted. Each open card continues to contain
its room identity, assessment, membership control, main reward control, and
room-local navigation when applicable.

The board has a visible six-room cutoff:

```text
positions 1-6     visited, in authored traversal order
positions 7-10    open and offered, but not visited
```

The open board is one ranked roster, one room per line, at every width. Each
row keeps ordering legible on its first line: pointer drag grip, authored rank
or remaining marker, room identity, authored/evaluated status, membership, and
compact order actions. Its second line keeps the existing selected main-reward
control and summary exactly as it is today; it does not invent a new
major/minor reward taxonomy. Room-local details may expand below that row
without stretching unrelated rooms as a multi-column grid would.

The closed-room disclosure remains a compact three-column grid because its
members have neither active traversal order nor an editable main reward. A
labelled boundary separates the open roster's visit prefix from its remaining
rooms at every width.

Pointer/touch dragging is a direct-manipulation convenience; compact arrow
buttons remain the complete keyboard fallback. Dragging or otherwise moving a
room:

- within positions 1-6 changes traversal order;
- from below the cutoff into positions 1-6 makes it visited and displaces a
  room into the unvisited tail;
- from positions 1-6 below the cutoff removes it from the visit order and
  promotes the next ranked room when six visits were already authored; and
- wholly within the unvisited tail changes presentation order only.

The arrow labels express their actual boundary semantics rather than pretending
every row moves one ordinal step: inside a prefix or tail they move earlier or
later; at a full boundary they exchange the final visit and first remaining
room; the first remaining room in an incomplete board becomes `Add as visit
N`; and the final incomplete visit becomes `Remove from visit order`. The
full boundary deliberately exchanges its final visit and first remaining room.
That lets a specific visited room leave the prefix and become closable without
reintroducing the old `Clear from here` control or a second bulk-order surface.

The nested Hub visit rail remains navigation to the visited rooms' local
details. It is not a second visit-order authoring surface.

### Incomplete authored visit order

An incomplete `visitOrder` remains truthful incomplete authorship. The UI must
not silently treat the first available unvisited rooms as authored visits.

For a prefix shorter than six:

- authored rooms occupy numbered positions starting at 1;
- one compact next-position drop target states `Drop a room here for Visit N`
  and that later visits remain unplanned;
- that target retains a compact, individually assessed marker for every
  remaining visit position, rather than letting later positional state vanish;
- every other open room remains available below the cutoff;
- moving a room into the next empty position appends it to the dense prefix;
- positions after the first empty position cannot be populated; and
- removing an authored room truncates or replaces the prefix through one
  complete proposed order, never by leaving an ordinal gap.

The compact target must still make `three visits authored` distinct from `the
first six open rooms are visited`; it is not a visual stand-in for four
authored visits.

### Semantic prefix and presentation tail

Only the first six positions have game-execution meaning. The persisted Hub
contract therefore remains:

```ts
visitOrder: readonly string[]; // dense, distinct, 0..requiredVisits
```

No schema version is added and no order is persisted for unvisited open rooms.
The complete visible ranking follows these rules:

- its prefix is the exact authored `visitOrder`;
- its tail contains every other open slot exactly once;
- initial and replaced-project tail order follows declaration order;
- within the mounted editor session, tail-only moves may remain transient
  presentation state;
- project publication reconciles by taking the authored prefix as authority,
  retaining surviving tail keys in their current presentation order, removing
  closed keys, and appending newly opened keys in declaration order; and
- load, recovery, or project replacement may reset the tail to declaration
  order because tail order is neither saved nor part of Undo/redo.

A tail-only move must not dispatch a project command, run semantic candidate
evaluation, or create an Undo entry. A move that changes the prefix must
dispatch one exact aggregate Hub command. React may retain the full visual
ranking as local presentation state, but it must derive membership solely from
the projected open slots and must not reproduce Hub topology rules.

### Membership transitions

Opening or closing a Hub room remains an explicit membership control:

- opening a room appends it to the presentation tail;
- a room in the authored prefix cannot close;
- moving a room below the cutoff makes it eligible to close after the command
  publication succeeds; and
- closing removes its card and occurrence through the existing semantic
  command and reconciliation path.

The existing native-focus continuity for membership controls remains. A
reorder keeps focus on the moved room's reorder control at its new position.
Finding selection must reveal and focus the exact containing card after any
reorder.

## Hub Engine Contract Correction

### One whole-order command

The current production command family is position-shaped:

```ts
AppendHubVisit;
ReplaceHubVisit;
RemoveHubVisitsFrom;
```

That family is suitable for sequential selects but cannot express a drag move
or cross-cutoff swap as one atomic authored intent. Replace it with:

```ts
ReplaceHubVisitOrder {
  hub: HubDecisionAddress;
  hubSlotKeys: readonly string[];
}
```

The handler validates the complete proposal:

- the address identifies the current biome's declared Hub;
- every key is an open Hub slot;
- keys are distinct;
- length is between zero and `requiredVisits`; and
- the list is dense by construction.

This is structural validation only. A distinct, open, bounded proposal remains
authorable even when its full ordered replay produces side-room, reward, or
later lifecycle findings. The command records the exact authored order; it
must not reject, rewrite, or silently retain a prior order because evaluation
marks the new one invalid.

Replacing a complete six-room order with a shorter prefix removes the
completed-Hub handoff exactly as `RemoveHubVisitsFrom` does today. A complete
valid order continues to enable that handoff through the existing completion
authority.

Audit all production consumers and remove the superseded append, replace, and
truncate commands from the supported command union in the same vertical
slice. Do not retain forwarding handlers or two production edit paths merely
for compatibility with old tests.

`HubVisitAddress` remains the positional owner of evaluated visit lifecycle,
findings, history, and visit-rail navigation. Its `visitIndex` deliberately
refers to an ordered traversal position and can therefore resolve to a
different Hub slot after a reorder. The Hub slot and its occurrence remain the
stable room-card, reward, and local-detail identities. The aggregate command
does not erase per-visit addresses; it only changes how their ordered
collection is authored.

### Whole-order candidate evaluation

Replace the scalar `hubVisit` candidate proposal with an aggregate candidate:

```ts
HubVisitOrderCandidateQuery {
  kind: 'hubVisitOrder';
  hub: HubDecisionAddress;
  hubSlotKeys: readonly string[];
}
```

Candidate evaluation applies the exact aggregate command to the same prepared
N candidate region and replays the _entire_ proposed prefix through
`hubSlotKeys.length`. It assesses that full order through the existing Hub
visit, side-room, reward, history, and completion authorities; it must not
only replay the actively moved position. Reordering can change the visit index
and side-room pressure of every displaced room.

The result retains exact findings for every affected proposed visit and its
room-local descendants. Those findings are evidence, not a reason to suppress
a structurally valid proposal: an order that is distinct, open, and bounded
remains possible to author even when its replay is invalid. `impossible` is
reserved for a structurally invalid proposal, and `unavailable` only for a Hub
region without candidate coverage. The application never infers either status
or produces its own repair order.

The workspace interaction exposes complete prefix proposals for one active
move. It does not eagerly evaluate all permutations of nine or ten rooms.
For a dragged or keyboard-selected room, deduplicate positions that produce
the same semantic prefix and evaluate only the bounded alternatives relevant
to that move. Tail-only alternatives need no engine query.

The interaction and candidate product are Hub-decision-owned while finding
evidence retains its exact per-visit or room-local owner. One aggregate
interaction owns candidate loading and the complete order intent. The
application may attach that interaction to a room card through a
presentation-only key, but rendered card position does not become semantic
identity.

`HubVisitAddress` markers and exact inspector destinations remain reachable
for every authored visit. Workspace closure must instead require the one
Hub-decision aggregate interaction; it must not require a separate exact
interaction for every visit marker.

## Target Shop Experience

### Purchased-first presentation

One Shop table or list renders every offer exactly once in two contiguous
groups:

1. purchased offers in exact `purchaseOrder`; and
2. unpurchased offers in declaration order.

The purchased group exposes its authored ordinal clearly. The unpurchased
group remains complete inventory and keeps its reward editor and findings.
Checking an unpurchased offer appends it to the purchased group. Unchecking a
purchased offer removes it and compacts the remaining order. These continue to
use the complete schema-11 purchase-order proposals already projected by the
application.

### Reordering purchased offers

Purchased offers can be directly reordered. One completed move dispatches the
existing `ReplaceShopPurchaseOrder` command with the complete proposed order
and creates one Undo entry.

The existing ordinal selector remains available as the accessible direct
control and keyboard fallback. Dragging is an additional convenience, not the
only means of ordering. Candidate-impossible destinations remain unavailable
and retain their projected explanation; React does not derive which purchase
positions are legal.

Focus remains on the same offer after a successful move. Reordering must not
hide an offer's reward control, semantic finding, or assessment.

No Shop engine, schema, codec, simulation, materialization, or candidate-policy
change is expected. If implementation discovers one is required, stop and
amend this plan before broadening the slice.

## Accessibility and Interaction Rules

The active Hub surface must support pointer, touch, and keyboard use without
relying on visual drag alone:

- every movable item has a named reorder control;
- current ordinal and active/inactive status are exposed in accessible text;
- keyboard users can move an item to every semantically available position;
- a completed keyboard move is announced and focus stays with the moved
  semantic item, while pointer dragging preserves native pointer continuation;
- impossible proposals remain disabled with their existing candidate evidence;
- cancel leaves authored state and Undo history unchanged; and
- the UI does not dispatch intermediate commands while a pointer is moving.

Use the smallest accessible sortable mechanism that satisfies these rules.
Do not introduce a graph library or a repository-wide drag framework. A small
presentation primitive may be shared only after multiple implemented consumers
prove the same focus, announcement, and input behavior; their proposal
construction and semantic commands remain feature-owned.

## Delivery Slices

### Slice 1: Hub ranked board

Deliver one complete vertical slice:

1. add the aggregate Hub visit-order command and replace the old command
   family;
2. add aggregate candidate evaluation and replace scalar candidate binding;
3. project bounded whole-prefix proposals and exact owner destinations;
4. replace the separate Hub visit timeline with the ranked open-room board;
5. add transient tail reconciliation and accessible reorder controls;
6. preserve membership, rewards, findings, room-local navigation, completion,
   focus, and Undo behavior; and
7. revise workspace closure so every visit marker/destination remains closed
   while one Hub-decision interaction owns complete order proposals; and
8. delete superseded React, projection, interaction, command, candidate, and
   test paths in the same commit.

Primary implementation neighborhoods include:

- `packages/planner-engine/src/authored-project/commands/`;
- `packages/planner-engine/src/simulation/candidates/hub.ts` and its candidate
  session surface;
- `apps/planner/src/projections/candidateProjection.ts`;
- `apps/planner/src/projections/structured-workspace/assembly/hub-assembly.ts`;
- structured-workspace interaction requirements, binding, and contract;
- `apps/planner/src/ui/editor/biome/HubDecisionWorkbench.tsx`; and
- the owning engine, projection, interaction, React, architecture, and product
  witnesses.

This slice must be green by itself. Do not land an interface-only or dual-path
preparatory commit.

### Deferred proposal: Shop purchased-first ordering

This is not an active delivery slice. Reconsider it only after a separate
product decision authorizes Shop work.

Deliver one complete application/UI slice:

1. order Shop rows as purchased prefix plus declaration-ordered remainder;
2. add direct purchased-offer reordering through existing complete proposals;
3. retain checkbox and ordinal-select behavior;
4. preserve reward controls, findings, focus, responsive behavior, and Undo;
   and
5. add focused projection and React/product witnesses.

Primary implementation neighborhoods include:

- `apps/planner/src/projections/structured-workspace/assembly/occurrence-assembly.ts`;
- the structured-workspace Shop room-local contract;
- `apps/planner/src/ui/editor/rooms/ShopPurchaseControl.tsx`;
- `apps/planner/src/ui/editor/biome/OccurrenceWorkbench.tsx`;
- the owning styles; and
- their focused tests.

Do not reopen the completed schema-11 purchase-order implementation unless a
failing authority test demonstrates an actual semantic defect.

### Closure

A separate closure commit is optional. Use it only for material responsive,
accessibility, or documentation corrections discovered after the Hub slice. Do
not create a cleanup commit solely to move code introduced by the same work.

After the Hub implementation and manual visual review:

- absorb the durable Hub presentation contract into
  `STRUCTURED_EDITOR_WORKSPACE.md` and `EDITOR_MODEL.md`;
- update `CANDIDATE_EVALUATION_MODEL.md` if the aggregate Hub candidate becomes
  the stable engine contract;
- update `N_GAME_RULES.md` only if a durable game-rule clarification is
  actually discovered; this presentation change does not require one;
- record the completed Hub delivery in the ordinary progress history; and
- leave the deferred Shop proposal here or retire it through a later planning
  decision rather than treating it as a completed design authority.

## Explicit Non-Goals

- changing N board generation, open-count rules, side-room rules, reward
  lookup, pylon behavior, or completed-Hub Preboss handoff;
- persisting the relative order of unvisited Hub rooms;
- adding project schema 12 for presentation order;
- combining Hub and Shop into one engine collection model;
- changing Shop execution, candidate, reward, materialization, or codec policy;
- redesigning N's nested visit rail or the general biome structure rail;
- changing room or reward eligibility;
- replacing Hub membership controls;
- redesigning side-room generation, visit membership, priority, or entry order;
- creating a generic drag-and-drop service, ordering registry, DI container, or
  sortable domain framework; or
- adding Natural Chaos, optional exits, or another biome feature.

## Acceptance and Audit Against

### Hub semantic acceptance

- `visitOrder` remains the only persisted Hub traversal order.
- A partial dense prefix from zero through five remains authorable and visibly
  incomplete.
- A complete order contains exactly six distinct open slot keys.
- One whole-order command can reorder, replace, append, or shorten the prefix.
- Shortening a complete order removes the completed-Hub handoff.
- Candidate evaluation applies and replays the complete proposed prefix against
  the same N authorities as selected simulation, returning exact affected
  visit/room-local findings without making a structurally valid order
  unauthorable.
- Invalid current authorship remains visible and can be repaired.
- No tail order enters persistence, simulation, findings, candidate history,
  or Undo.

### Hub presentation acceptance

- Every open room and main reward appears once in one ranked board.
- The open board is a one-row-per-room ranked roster at desktop and narrow
  widths, while closed rooms remain a three-column disclosure grid.
- The first-six boundary is obvious at desktop and narrow widths.
- Each open row preserves the existing selected main-reward control on its
  own second line; no presentation-only reward taxonomy is introduced.
- Cross-boundary moves update visited membership and order together.
- Tail-only moves remain transient and dispatch no semantic command.
- Opening appends a room to the tail; closing removes it from the board.
- Visited rooms cannot close until they leave the authored prefix.
- The old visit timeline, duplicate reward summary, and `Clear from here`
  control are absent.
- Hub room-local navigation and side-room editing still work for visited rooms.
- Exact findings reveal the containing room card after reorder or membership
  change.
- Pointer and keyboard focus remain on the relevant room/control.
- Pointer/touch dragging is available through a visible row grip; named arrow
  controls remain available without dragging.
- Every Hub visit marker and destination remains reachable, while one
  Hub-decision-owned interaction supplies all order proposals.

### Deferred Shop acceptance

The following remains a future proposal and is not part of the active Hub
acceptance gate.

- Purchased offers render first in exact authored purchase order.
- Unpurchased offers render once below them in declaration order.
- Checking appends; unchecking removes and compacts.
- Direct reorder and ordinal selection dispatch the same complete semantic
  proposal.
- Candidate-invalid positions remain unavailable with projected evidence.
- Rewards and findings never disappear because an offer moves groups.
- Shop schema, codec, simulation, and lifecycle output remain unchanged.

### Boundary and maintenance audit

- React constructs no Hub-validity policy.
- The application does not persist or semantically evaluate Hub tail order.
- One supported Hub visit-edit command and candidate path remains after the
  slice; no compatibility path shadows it.
- No production test manifests, self-audits, or shadow ordering models are
  added.
- Shared UI code, if any, contains only proven interaction mechanics and no
  feature policy.
- Side-room controls and their tests are unchanged except for unavoidable
  neighboring presentation adjustments.
- Production growth is explained by retained product behavior, and the old
  timeline/select-specific paths are deleted rather than left beside the new
  surface.

## Validation

During implementation use the narrowest truthful lane for each authority:

- `npm run test:engine` for the Hub command and candidate correction;
- `npm run test:planner` for structured-workspace binding and projection;
- `npm run test:ui` for the Hub interaction surface; and
- `npm run test:product` for representative reorder, Undo/redo, finding, and
  persistence workflows.

Run `npm run check` before declaring the Hub cross-layer slice complete. Manual
review must cover desktop and narrow layouts plus pointer and keyboard moves.
