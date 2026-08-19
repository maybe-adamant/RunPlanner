# Direct Room Workbench Presentation

Status: Locked for implementation  
Implementation base: `b4be69f`  
Scope: focused planner application and React presentation cut  
Intended delivery: one reviewed Conventional Commit

This is a temporary implementation plan. It is intentionally not linked from
`README.md` or stable design documents. After implementation, the durable
presentation contract belongs in `docs/design/EDITOR_MODEL.md` and
`docs/design/STRUCTURED_EDITOR_WORKSPACE.md`.

## Objective

Replace the generic collapsed `Customize` surface with direct, truthful room
workbenches. Every entered or otherwise inspectable occurrence presents its
owned content in a stable order without an extra disclosure step.

The product should read like the room itself:

```text
Room — Combat 01
Incoming reward — Gold

Encounter
Room features
Room Actions
```

Only sections supported by that occurrence are rendered. H, O, N, and Shops
receive deliberate compositions over the same existing semantic products;
they do not become separate authored models or acquire private chronology.

## Problem

The current workbench mixes two presentation systems:

- room-local reward, Fields, Ship, Shop, and Room Actions products render
  directly; while
- encounter selection and additional room exits are hidden under a generic
  `Customize` disclosure.

This makes equivalent room-owned controls look as though they have different
ownership, adds an unnecessary navigation step, and leaves O's phase-based
room structure flattened into one Ship panel plus one global encounter panel.
The `Customize` label also says nothing about which game-domain product the
user is editing.

The existing engine model is already stronger than this presentation:

- one occurrence owns one room-action order;
- each action and checkpoint carries an engine-owned lifecycle window;
- O publishes active encounter phases and reward wheels;
- H publishes Fields cages, optionals, encounters, and one interleavable action
  roster;
- N main occurrences own their local-visit/side-room topology; and
- Shops publish their specialized inventory separately from purchase and
  pickup chronology.

This slice exposes those products directly. It does not reinterpret them.

## Locked Product Decisions

### 1. `Customize` Is Fully Retired

There is no `Customize` button, disclosure, dialog, heading, or presentation
capability after this slice. Room-owned controls render directly in the
occurrence workbench.

Semantic focus navigates to the exact already-rendered control. It does not
open local disclosure state. Navigation and expansion remain absent from
authored history.

### 2. Incoming Identity Remains Read-Only

An entered workbench may summarize:

- its room identity; and
- its visible incoming door reward or rewards.

It cannot replace either value. The predecessor's outgoing door card remains
the editor for an incoming room identity and door-visible reward. Hidden and
`none` door previews remain hidden.

The route start has no predecessor door. Its existing separate Start room
identity surface and exact occurrence-owned opening reward interaction retain
their current ownership; this plan does not move them or invent an incoming
door.

O ShipCombat continues to show no invented incoming door reward. H shows the
door-owned cage rewards as read-only context; concrete cage pickups remain
Room Actions.

### 3. Standard Workbench Composition

F, G, I, P, Q, ordinary N side occurrences, and other rooms without a
specialized composition use this order:

```text
Room / incoming context
Encounter, when present
Room features, when present
Room Actions, when present
Outgoing doors
```

Rules:

- `Encounter` appears only when the application projection provides at least
  one active editable or diagnostic encounter phase.
- A room with no encounter surface renders no empty Encounter heading.
- `Room features` appears only when at least one exact feature control exists.
- `Room Actions` consumes the existing occurrence roster and interaction.
- Outgoing doors remain the occurrence-stage sibling below the workbench; they
  are not absorbed into the room body.

### 4. Room Features

`Room features` is the direct home for room-owned additions:

- Add Chaos gate;
- Add Zagreus Contract; and
- future declaration-backed room additions.

The initial closed product contains only the two currently supported feature
controls. It is not a string-keyed feature registry and React does not infer
availability from room names, biome names, or rendered labels. Each feature
continues to dispatch its existing complete bound intent.

Adding or removing the resulting door remains on that door's outgoing card.
Anomaly identity/revert controls remain door-transition controls and are not
reclassified as Room features.

### 5. N Main-Room Composition

An N main occurrence inserts its existing side-room topology before Room
features:

```text
Room / incoming context
Encounter, when present
Side rooms
Room features, when present
Room Actions, when present
Outgoing doors or Hub restore context
```

The Side rooms section retains current generation, door reward, and visit-order
ownership. Each generated side room remains an ordinary addressable occurrence
with its own direct workbench and Room Actions.

This is presentation only. It does not change the locked N engine walk:

```text
Hub board generation
Main Room first entry
Side Room first entry
Main Room restore
Hub restore
next Main Room
```

Main- or side-room findings continue to block the progressive engine walk at
their exact occurrence and chronology position. They do not retroactively hide
or invalidate the Hub board editors.

### 6. H Fields Composition

H uses one Fields workbench, not one workbench per cage:

```text
Room / incoming cage-reward context
Encounter, when present
Fields setup
Room features, when present
Room Actions
Outgoing doors
```

`Fields setup` retains the current optional-reward generation controls. Cage,
optional, encounter/NPC, and Artificer actions remain interleavable in one
engine-owned Room Actions order.

The UI must not partition H actions by cage or create per-cage persisted
orders. Such a partition would falsely constrain legal timing between already
available Fields objects.

### 7. O ShipCombat Composition

O receives a deliberate phase-oriented workbench:

```text
Room — ShipCombat
Combat phase count

Intro
  Encounter
  Actions

Combat 1
  Encounter
  Reward wheel structure
  Actions

Combat 2                 # only when active
  Encounter
  Reward wheel structure
  Actions

Room features, when present
Outgoing doors
```

The active encounter envelope determines whether Combat 2 exists. A two-phase
room renders no Combat 2 heading, controls, action rows, or checkpoints.

Reward-wheel identity remains phase-local structure. Choosing a wheel result,
picking its reward, and resolving any trait/Pom/conversion child remain on the
exact Room Action row.

The phase sections are views over one occurrence-owned room-action order:

- ranks remain global and are shown once;
- every row and checkpoint appears exactly once;
- insert, move, remove, pointer-drag, keyboard, and Undo use the existing one
  Room Action interaction;
- fixed engine windows determine the section containing each row;
- an unavailable cross-window move stays unavailable; and
- React does not calculate lifecycle barriers or derive a second order.

The application projection may adapt the engine's existing
`RoomActionWindow`, active encounter phases, and reward-wheel attachments into
closed O presentation groups. If those existing products cannot identify a
group without semantic inference, the engine must expose the narrow missing
group fact; React may not reproduce Ship chronology.

In the intended grouping, choosing Wheel 1 is visible with the Intro-to-Combat
1 transition, Wheel 1's post-combat interaction is visible under Combat 1,
choosing Wheel 2 is visible with the Combat 1-to-Combat 2 transition, and Wheel
2's post-combat interaction is visible under Combat 2. The underlying global
rank remains authoritative.

### 8. Shop Composition

Shops retain their current specialized inventory presentation:

```text
Room / incoming context
Shop inventory and conditions
Room features, when present
Room Actions
Outgoing doors
```

Offer identity remains in the Shop inventory. Purchase, pickup, trait, Pom,
Time Piece, Artificer, Travel Deal, Contract, Echo, and other chronology remain
on their exact Room Action rows. This slice does not restore the retired Shop
purchase or Acquisitions order paths.

### 9. Empty Sections Stay Absent

Direct rendering does not mean rendering placeholders. No room gets an empty
Encounter, Side rooms, Fields setup, Room features, Shop, or Room Actions
section merely to preserve a universal template.

Retained-invalid active values remain visible in their owning section.
Structurally dormant values remain persisted but publish no control, finding,
or section until active.

## Ownership and Data Flow

### Catalog

No catalog change is expected. Existing declarations continue to own room
kind, encounter phases, lifecycle profiles, feature availability, Fields
structure, Shop structure, and Ship phase/wheel structure.

If implementation discovers that a presentation distinction requires a new
game fact, stop and amend this plan rather than inferring it in React.

### Planner Engine

No authored schema, codec, default, command, candidate, simulation, finding,
or chronology behavior changes are intended.

The engine remains the authority for:

- active encounter phases;
- active Room Action rows;
- global ranks and proposals;
- lifecycle windows and dependencies;
- checkpoints;
- progressive coverage; and
- exact semantic finding owners.

The current roster already carries `RoomActionWindow` on rows and checkpoints.
The application may consume that existing evidence for O grouping. Any engine
change must be limited to exposing an already-derived grouping fact that is
otherwise unavailable; it must not add UI section names or presentation state.

### Planner Application Projection

The application owns one closed occurrence presentation product. It composes
the existing semantic controls into deliberate standard, Fields, Ship, and
Shop shapes. N side-room topology is an optional standard/Fields insertion,
not a second room model.

The projection must provide React with:

- read-only room and incoming-reward context;
- active encounter sections;
- exact Room feature controls;
- optional N local-visit presentation;
- Fields or Shop specialized content;
- O's ordered active phase sections; and
- either one ordinary Room Actions presentation or O's complete phase-grouped
  view over the same Room Actions interaction.

The product is closed and exhaustive. React does not select the shape by
checking biome keys, room labels, lifecycle-profile strings, or arbitrary
feature names.

### React

React renders the projected composition and invokes complete bound intents. It
may own CSS layout, headings, accessibility structure, pointer state, and
transient announcements. It does not own activation, encounter eligibility,
feature availability, action grouping policy, chronology, or topology.

The existing reorder implementation remains one shared component. O may render
group headings around that board, but must not fork the reorder algorithm or
introduce a Ship-specific command path.

## Current Paths and Expected Changes

Primary implementation neighborhood:

- `apps/planner/src/projections/structured-workspace/contract.ts`
- `apps/planner/src/projections/structured-workspace/assembly/occurrence-assembly.ts`
- `apps/planner/src/projections/structured-workspace/navigation/marker-ownership.ts`
- `apps/planner/src/ui/editor/biome/OccurrenceWorkbench.tsx`
- `apps/planner/src/ui/editor/biome/HubDecisionWorkbench.tsx`
- `apps/planner/src/ui/styles.css`

Expected test owners:

- `apps/planner/src/projections/structured-workspace/assembly/occurrence-assembly.test.ts`
- `apps/planner/src/ui/editor/biome/OccurrenceWorkbench.test.tsx`
- `apps/planner/src/ui/editor/biome/HubDecisionWorkbench.test.tsx`
- representative `apps/planner/test/product-loops/*`
- exact finding/focus witnesses where disclosure opening is currently asserted

Expected retirement:

- `RoomCustomizationDisclosure`;
- `hasRoomLocalCustomization` and its UI-capability meaning;
- `WorkspaceRoomSummary.hasRoomLocalCustomization`;
- `WorkspaceRoomSummary.customizationMarkers` and the disclosure-specific
  marker helper/comment;
- `.room-customization`, its summary/content CSS, and disclosure-only layout;
- every UI/test query or action that opens `Customize`; and
- active stable-document language that places Encounter or room additions
  inside `Customize`.

`localDetailMarkers` remains the semantic containment/focus product unless the
implementation proves a narrower rename is necessary. Focus routing must not
depend on whether a collapsible element exists.

Hub room inspection must no longer depend on
`hasRoomLocalCustomization`. A visited Hub room with a projected occurrence
workbench remains directly inspectable even when its only current content is
Side rooms or Room Actions.

## Implementation Gate

Deliver this as one complete application-facing vertical slice.

1. Establish the closed application presentation product and O phase grouping
   from engine-owned facts.
2. Recompose Standard, N, H, O, and Shop workbenches around that product.
3. Preserve one shared Room Actions interaction/reorder implementation.
4. Remove the Customize disclosure, obsolete application fields, focus-opening
   state, CSS, tests, and active documentation language.
5. Add representative projection, React, navigation, Undo, and product-loop
   witnesses.
6. Run an independent adversarial review, remediate accepted findings once,
   perform the main-session ownership/deletion review, then run the complete
   repository gate.
7. Commit one coherent change, expected message:
   `feat(planner): render direct room workbenches`.

Implementation must stop for plan amendment if live code requires:

- a new persisted room-workbench state;
- a new room-action order or command family;
- game-rule changes to O, H, N, Shops, encounters, or features;
- moving room/reward identity back into an entered workbench; or
- a generic semantic feature registry.

## Primary Acceptance Witnesses

### Standard

- A representative ordinary combat room shows read-only room/incoming context,
  Encounter when supported, Room features when supported, Room Actions, then
  outgoing doors.
- A room without an encounter or features renders neither empty heading.
- Changing encounter selection remains one semantic command and one Undo.
- Adding Chaos or Contract remains one bound room-feature action; removal stays
  on the resulting door card.

### N

- A visited N main room renders Encounter, Side rooms, Room features, and Room
  Actions in that exact order for the sections that exist.
- Local generation, door reward, and visit-order controls remain on the parent
  main occurrence.
- Opening a generated side room reaches its own direct occurrence workbench.
- A side-room finding focuses its exact direct control without changing Hub
  board validity or requiring disclosure state.

### H

- An entered Fields room shows read-only cage-reward context and its optional
  generation control.
- Cage, optional, NPC/Gorgon, and Artificer rows remain in one globally ranked
  Room Actions board.
- Reordering a legal interleaving behaves identically before and after the UI
  recompose.
- No cage gets a private action order.

### O

- A two-phase Ship room renders Intro and Combat 1 only.
- A three-phase Ship room renders Intro, Combat 1, and Combat 2 in declaration
  order.
- Each active encounter, wheel structure, action row, and checkpoint renders
  exactly once in its projected phase.
- Rank numbers remain global across phase headings.
- Legal moves, illegal cross-window moves, pointer drag, arrow controls, and
  Undo continue to use the shared Room Action interaction.
- Wheel offer identity appears in phase structure while picked offer and nested
  acquisition resolution appear only on the exact Room Action row.

### Shop

- Current Shop inventory/condition controls remain present and retain their
  existing commands.
- Room features appear after Shop content.
- Purchase/pickup chronology appears only in Room Actions.
- No retired Shop purchase or Acquisitions order UI returns.

### Retirement and Accessibility

- No application surface contains a `Customize` button, disclosure, dialog, or
  accessibility label.
- Finding navigation focuses visible Encounter, feature, side-room, Shop,
  Fields, Ship, and Room Action controls directly.
- Section headings and regions have stable accessible names.
- DOM-order witnesses cover Standard, N, H, O, and Shop compositions.
- A static deletion scan finds no disclosure component, obsolete capability,
  disclosure-only CSS, or active product-loop click on `Customize`.

## Validation

During implementation, use the narrow owning lanes:

- focused occurrence projection tests;
- focused `OccurrenceWorkbench` and `HubDecisionWorkbench` tests;
- `npm run test:planner`;
- `npm run test:ui`;
- `npm run test:contract` when the workspace shape changes; and
- representative `npm run test:product` workflows.

Because the structured workspace contract and shared React workbench change,
phase closure requires one complete `npm run check`, followed by `git
diff --check`. Do not repeatedly run the full gate during remediation.

## Documentation Disposition

At implementation completion:

- replace active `Customize` ownership in `docs/design/EDITOR_MODEL.md` with
  direct workbench composition;
- record the closed Standard/Fields/Ship/Shop projection in
  `docs/design/STRUCTURED_EDITOR_WORKSPACE.md`;
- update the cross-biome and vocabulary audits only where they describe the
  active surface;
- preserve historical evidence only when clearly marked as superseded; and
- delete this temporary plan after its accepted facts have been absorbed into
  stable authorities, unless it is still needed by a larger unfinished gate.

## Explicit Non-Goals

- No authored schema or codec change.
- No catalog or game-data audit.
- No new encounter, Room feature, side-room, Fields, Ship, or Shop behavior.
- No door-card or incoming-reward ownership change.
- No room-action legality, dependency, checkpoint, settlement, or engine-walk
  change.
- No N Hub board redesign.
- No new graph, modal, tab, or persisted UI state.
- No broad visual redesign outside the room workbench composition.
