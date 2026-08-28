# Hub Editor Navigation and Layout Plan

Status: locked for implementation

Base commit: `d612e4ec`

Scope owner: planner application projections, navigation products, and React
presentation

## Objective

Make Ephyra's Hub editor behave as one coherent authoring workspace without
erasing the existing distinction between board-owned reward authoring and
occurrence-owned acquisition authoring.

The user-visible result is:

- Hub Overview remains the only place that opens or closes main rooms and
  chooses each open room's incoming reward;
- entering a main room exposes that occurrence on the rail, and editing the
  reward's trait, Pom, spell, or other acquisition detail stays in that room's
  Timeline;
- generated side-room topology is managed from its parent main room's
  Overview, with findings opening the exact generation control;
- every entered side room appears beneath its parent main visit on the rail
  and owns its own Timeline editing context;
- Hub Timeline cards use stable columns instead of shifting controls according
  to title length; and
- the Hub open/closed board uses three cards per row when space permits, with
  responsive two- and one-column fallbacks.

This is an application/editor correction. It does not change Ephyra game
rules, authored topology, reward settlement, visit counts, simulation,
candidates, persistence, or catalog declarations.

## Current mismatch

### Side generation findings lose their destination

The occurrence projection already places side-room generation and visit-order
controls on the visited parent main room's Overview. `hub-assembly.ts` then
redirects all local-visit slot markers to the Hub decision. As a result, a
`sideRoomGenerationUnavailable` finding leaves the parent room, opens Hub
context that contains no matching control, and only exposes the red control
after the user manually returns to the room and interacts with the side table.

### Main reward identity and acquisition detail are collapsed

`workspaceHubMainRewardMarkers` currently returns both the incoming reward
root and every nested trait/acquisition/level marker. Hub assembly redirects
that entire family to Hub Overview. The incoming reward is correctly
board-owned, but its nested acquisition editors are occurrence lifecycle
detail. Opening or saving a trait dialog therefore changes the semantic focus
back to the Hub instead of retaining the visited main room.

### Entered side occurrences are hidden from the rail

Generated side rooms already have ordinary occurrence workbenches. Hub
assembly marks every one `inspectorOnly`, while the Hub rail projection only
publishes authored main visits. Entered side rooms are therefore editable only
through indirect parent controls and cannot be revisited from the route rail.

### Hub cards have content-sized placement

Timeline cards use a grid for their outer row, but the identity region uses a
wrapping flex layout and `display: contents`. Room state, details, and actions
therefore begin at different horizontal positions as room labels and status
text change.

### The Overview board is unnecessarily sparse

The open/closed board is fixed at two columns until it collapses to one. The
available Hub workbench width can support three compact cards without changing
the fixed-slot board or its membership behavior.

## Locked destination and rail model

### Exact authoring destinations

The application projection owns this matrix. React renders it and must not
infer destination ownership from address kinds, current tabs, or rendered
ancestry.

| Semantic owner | Inspector destination | Tab | Selected rail stop |
| --- | --- | --- | --- |
| Hub decision and open/closed membership | Hub workbench | Overview | Hub |
| Main room incoming reward identity | Hub workbench | Overview | Hub |
| Main room visit/order owner | Hub workbench | Timeline | Main visit |
| Entered main room occurrence and lifecycle detail | Main occurrence workbench | Timeline | Main visit |
| Main incoming reward acquisition children | Main occurrence workbench | Timeline | Main visit |
| Side generation, entry order, and side reward identity | Parent main occurrence workbench | Overview | Parent main visit |
| Entered side occurrence and acquisition children | Side occurrence workbench | Timeline | Side visit |

"Acquisition children" means the existing nested products under a reward
control: trait offers and their result markers, Pom/level resolutions, spell
selection detail, and any other acquisition-resolution marker already
published by that room. The plan does not introduce a second reward editor or
move the incoming reward picker into the room Timeline.

An encounter trait or other occurrence-local trait continues to belong to the
owning room Timeline independently of the incoming reward source.

### Main reward marker families

Replace the current all-or-nothing Hub-main-reward redirect with two explicit
application-owned marker families:

- the outer incoming reward marker remains redirected to Hub Overview; and
- nested acquisition-resolution markers retain the main occurrence workbench
  and its Timeline destination.

The split must reuse the complete existing reward-control projection. It must
not enumerate game reward kinds in React, reconstruct trait ownership from
semantic-address strings, or add a parallel marker registry.

### Parent-owned side topology

Local generation and order stay parent-owned even after a side room is
entered. A side-generation finding therefore targets the exact local-slot
marker while opening the parent main occurrence on Room Overview. The focused
control must immediately display its finding state; clicking the control is
not required to make the problem visible.

The side reward's identity remains in that same parent-local table. Once a
side occurrence is entered, only its lifecycle/acquisition detail belongs to
the side occurrence Timeline.

### Nested side-room rail entries

Extend the existing N-specific Hub visit rail product with entered side-room
children. Do not introduce a generic recursive rail tree: Ephyra already has
the complete parent visit and local visit products needed for this one bounded
presentation.

The rendered shape is:

```text
Hub
  Visit 1 - Combat 05
    Side 1 - Side Room 02
    Side 2 - Side Room 07
  Visit 2 - Combat 10
```

Locked rules:

- only side occurrences present in the authored local `visitOrder` appear;
- generated but unentered side rooms remain visible only in the parent room's
  local table;
- side entries are nested under their owning main visit and follow the exact
  authored side-entry order;
- side entries do not increment or relabel the Hub's six required main visits;
- main visit ordering and side visit ordering remain separate commands;
- clicking a side entry opens the side occurrence workbench;
- side occurrence-owned markers select that side entry, while parent-owned
  generation/order/reward markers select the parent main visit; and
- side rewards do not acquire a second editable surface or a primary-reward
  token on the rail.

Rail selection must use the complete marker family already owned by the main
or side occurrence, including reward acquisition children. It must not rely
only on the current `marker` plus `localDetailMarkers` subset when that subset
omits incoming-reward acquisition detail.

## Locked layout model

### Timeline roster columns

Hub Timeline main-room cards receive one shared explicit column layout for:

- drag handle;
- rank;
- room identity/title;
- room state and visit metadata;
- Room details; and
- reorder controls.

Columns reserve their positions across every card. Long room names may wrap
inside the identity column, but must not move Room details or reorder controls
horizontally. The existing semantic buttons, keyboard labels, drag behavior,
and responsive stacking remain intact.

This is a CSS/React structure correction, not a new reusable card framework.
Overview membership cards may retain their distinct compact header because
they do not present timeline rank/reorder controls.

### Three-column Overview board

The Hub Overview fixed-slot grid uses:

- three equal columns at the normal Hub workbench width;
- two columns at an intermediate container width; and
- one column on narrow layouts.

All 26 declaration-fixed slots remain in declaration order. Opening or closing
a slot does not move its card, alter the number of slots, or change reward
authoring ownership.

## Included changes

- application-owned marker grouping for outer rewards versus acquisition
  children;
- exact Hub/main/side inspector destinations and tabs;
- finding routing for side generation and entry controls;
- an N-specific nested side-visit rail presentation;
- complete main/side rail-selection marker mapping;
- Hub Timeline card structure and stable column CSS;
- three/two/one-column Hub Overview grid behavior;
- focused projection, navigation, React, and layout contract tests;
- durable editor-authority and delivery-record updates at closure; and
- deletion of this temporary plan at closure.

## Excluded scope

- catalog, authored schema, codec, migration, engine, simulation, candidate,
  reward-bag, lifecycle, or finding-policy changes;
- changing which Ephyra rooms or side rooms exist, generate, or can be entered;
- changing the six-main-visit completion rule;
- moving the main incoming reward picker out of Hub Overview;
- adding side reward pickers or editable reward tokens to the rail;
- showing generated-but-unentered side rooms on the rail;
- a generic recursive navigation tree or new global focus framework;
- persisting active tabs, rail expansion, or visual layout state;
- changing Hub membership, main visit, or side visit commands;
- redesigning ordinary-biome rails or occurrence workbenches; and
- unrelated Hub visual restyling.

## Gate A - destination ownership and nested side rail

Correct the complete navigation product in one application vertical slice.

Primary projection and navigation witnesses:

- Hub membership and a main incoming-reward root still resolve to Hub Overview
  with the Hub rail stop selected;
- a main reward's trait offer and representative acquisition child resolve to
  that main occurrence's Timeline with its main visit selected;
- opening, saving, and closing the trait editor does not change that
  occurrence destination;
- `sideRoomGenerationUnavailable` resolves to the parent main occurrence's
  Overview, retains the local-slot owner, and selects the parent main visit;
- a generated-but-unentered side occurrence is absent from the rail;
- every entered side occurrence appears once beneath its parent main visit in
  authored local order;
- clicking an entered side entry opens the side occurrence Timeline;
- a side acquisition child resolves to the side occurrence Timeline and
  selects the side rail entry;
- parent-owned side generation/order/reward markers still resolve to the
  parent Overview and select the parent visit;
- changing side-entry order changes only the nested side order;
- side entries do not alter the Hub `N of 6 visits` count; and
- an impossible orphan or mismatched side occurrence still fails the existing
  projection contract rather than being silently omitted.

Representative product-loop witness:

1. choose a Boon as a main room reward from Hub Overview;
2. enter that room through the authored Hub visit order;
3. open its Timeline and edit the Boon's trait;
4. save and close the dialog; and
5. remain on the same main room and selected main rail visit.

A second witness enters a generated side room, selects it from the nested
rail, edits its acquisition detail, and remains on the side occurrence.

Focused verification:

- Hub assembly and marker-ownership tests;
- inspector destination and rail-selection tests;
- biome presentation and structured-workspace contract tests;
- focused Hub workspace React interaction tests;
- planner application typechecking; and
- changed-file lint, formatting, and diff checks.

Intended commit:

```text
fix(hub): keep room editing in occurrence context
```

## Gate B - Hub board and timeline layout

Apply the bounded presentation correction after Gate A's navigation product is
stable.

Primary UI witnesses:

- Timeline cards publish the same named structural regions in the same order;
- representative short and long room titles retain one aligned Room details
  column and one aligned reorder-controls column;
- keyboard move buttons and the drag handle retain their accessible names and
  behavior;
- the Overview board exposes three columns at normal width, two at the chosen
  intermediate container width, and one at narrow width; and
- open and closed cards remain in fixed declaration order with the existing
  reserved reward region.

Prefer DOM structure and focused component contracts over screenshots that
encode incidental colors or pixel rendering. Use a narrow browser/layout
witness only if computed column behavior cannot be established truthfully in
the component and stylesheet tests.

Focused verification:

- Hub membership-board and visit-ranking component tests;
- focused Hub workspace UI tests;
- planner application typechecking;
- changed-file lint, formatting, and diff checks; and
- production build because React structure and stylesheet wiring change.

Intended commit:

```text
fix(hub): align board and timeline layout
```

## Gate C - durable closure

- update `EDITOR_MODEL.md` and `STRUCTURED_EDITOR_WORKSPACE.md` with the final
  destination split and nested entered-side rail behavior;
- record the completed Hub editor correction and truthful validation in
  `IMPLEMENTATION_PROGRESS.md`;
- delete this temporary plan; and
- run one complete `npm run check` after independent review remediation.

No game-data audit changes are expected because this plan changes no game fact
or planner simplification.

Intended commit:

```text
docs(hub): close editor navigation and layout work
```

## Review requirements

Each implementation gate receives a fresh executor and an independent reviewer.
The main session retains plan interpretation, finding disposition, final
bird's-eye diff review, and Git ownership. Review must confirm:

- the Hub board still exclusively owns main reward identity authoring;
- no second main or side reward picker was introduced;
- acquisition children are routed by their owning occurrence rather than by
  address-string inspection in React;
- side generation findings open an actually rendered parent control and retain
  exact finding focus;
- only entered side occurrences appear on the rail and each appears beneath
  the correct parent;
- side entries cannot affect the six-main-visit completion summary;
- main and side rail selection includes the complete owned marker family;
- no authored or UI-session persistence was added;
- the layout change reserves meaningful columns without creating a generic
  card abstraction; and
- every new application product or branch has a concrete test named in this
  plan.

Only one complete repository gate runs at closure. Narrow application and UI
lanes are used during implementation and bounded review remediation.
