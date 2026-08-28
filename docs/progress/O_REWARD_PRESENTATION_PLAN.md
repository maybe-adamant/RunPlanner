# O Reward Presentation Plan

Status: locked for implementation

Base commit: `d612e4ec`

Scope owner: planner application projection and React presentation

## Objective

Make Thessaly's two store-bearing editor surfaces describe the game model
without looking like duplicate choices or a vertical list of unrelated reward
rows.

This plan contains exactly two user-visible changes:

1. clarify what an outgoing RunProgress/MetaProgress result does for the
   selected O target; and
2. render the one or two active offers inside each individual reward wheel as
   offer cards, side by side when there are two.

The O authored model and simulation are already correct. The final active Ship
wheel remains the source of a ShipCombat room's outgoing store, non-Ship
sources retain their authored outgoing-store roll, and target declarations
remain authoritative for whether that store is consumed, overridden,
discarded, or retained only as entered-store provenance.

This plan is independent of
`HUB_EDITOR_NAVIGATION_AND_LAYOUT_PLAN.md`. Neither plan may absorb or depend on
the other's implementation.

## Current mismatch

### Outgoing stores look universally reward-bearing

The outgoing decision presents an authored base store through the generic
**Reward Pool** control, while a Ship source derives the same fact from its
final active wheel. Target cards then show only their reward editor or no
reward at all. This makes a derived or selected RunProgress value look as if it
must control the next room's visible reward, even though O target behavior is
mixed:

| Selected O target | Actual outgoing-store consequence                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| ShipCombat        | target has no incoming reward; the inherited store is discarded                                              |
| Miniboss          | target forces RunProgress and Boon; inherited store is overridden                                            |
| Devotion          | target forces RunProgress and Devotion; inherited store is overridden                                        |
| Reprieve          | inherited store draws the ordinary reward and records that store                                             |
| Story             | reward is fixed Story; inherited store records Run/Meta provenance                                           |
| Midshop           | reward is fixed Shop; inherited store records Run/Meta provenance                                            |
| Preboss Shop      | reward is fixed Shop; inherited store records Run/Meta provenance and continues into the completion boundary |

The provenance rows matter. `CalcRoomRewardStores` counts a fixed Story or Shop
when it has both `ChosenRewardType` and `RewardStoreName`; the resulting ratio
and O's adjustment speed can force a later outgoing store. A truly discarded
ShipCombat target store records nothing. The editor needs to expose this
distinction without teaching reward generation in React.

### Wheel offers read as full-width sequential rows

`RewardWheelWorkbench` correctly keeps each wheel inside its declaration-owned
Ship phase. Within that wheel, however, `.reward-wheel-offers` is a one-column
grid, so a two-offer wheel renders Offer 1 and Offer 2 as separate full-width
rows. These offers are one simultaneous choice set and benefit from the same
compact card language as door alternatives, without becoming physical exits
or acquiring door topology.

## Locked model

### No semantic correction

- Keep O's `authoredBaseStore` policy for non-Ship sources.
- Keep the ShipCombat `sourceOfferPoint` override and its
  `lastActiveWheel` selector.
- Keep each wheel's independent store, offer count, concrete offers, picked
  index, lifecycle actions, and entered-store history.
- Keep the target-level forced-store and incoming-reward declarations.
- Keep the speed-adjusted store support and the distinction between reward
  consumption and entered-store provenance.
- Do not add schema fields, authored state, lifecycle events, simulation
  branches, or candidate services.

### Outgoing-store presentation

The application projection publishes one presentation-ready consequence for
each O normal target from already-supported products:

- the canonical target's resolved incoming reward, if one exists;
- its resolved store provenance;
- the declaration-owned incoming producer kind; and
- any declaration-owned forced store.

The consequence is read-only and belongs to the target card. It does not
become a semantic address, authored leaf, candidate, finding, or second reward
control. React renders the complete projected statement and does not inspect
room game names, reward-type keys, catalog declarations, or store-policy
internals.

The supported statements are concise and target-specific:

- **No incoming reward · outgoing store discarded** for ShipCombat;
- **Boon · RunProgress forced** for Miniboss;
- **Devotion · RunProgress forced** for Devotion;
- **Reward drawn from RunProgress/MetaProgress** for Reprieve;
- **Story fixed · counts as RunProgress/MetaProgress** for Story;
- **Shop fixed · counts as RunProgress/MetaProgress** for Midshop and Preboss;
  and
- an explicit unavailable/retained-invalid statement when the evaluated target
  cannot publish a resolved consequence.

Do not invent a probability display. The existing candidate state remains the
authority for whether RunProgress, MetaProgress, or both are supported.

For a non-Ship O source, relabel the editable batch selector **Next store
roll**. This is the one authored `ChooseNextRewardStore` outcome, not a claim
that every target draws a visible reward from that bag.

For a ShipCombat source, continue to expose no outgoing selector. The target
consequence may identify the resolved store as **derived from the final active
wheel** when that provenance matters. The final wheel's existing store control
remains the only editable authority.

The consequence augments rather than replaces the existing reward editor:

- Reprieve retains its ordinary reward editor;
- fixed Story, Shop, Devotion, and Miniboss reward editors remain unchanged;
  and
- ShipCombat retains no incoming reward editor.

### Per-wheel offer-card layout

Each reward wheel remains in its current phase and retains its current heading,
store selector, offer-count selector, semantic markers, and Timeline-owned
picked-offer control.

Only the active offers inside that one wheel change presentation:

```text
Combat 1 reward
Reward pool: RunProgress    Offers: 2

+----------------------+  +----------------------+
| Offer 1              |  | Offer 2              |
| [reward editor]      |  | [reward editor]      |
+----------------------+  +----------------------+
```

Locked behavior:

- one active offer occupies the full available row;
- two active offers occupy equal side-by-side columns;
- a narrow container collapses two offers to one column;
- inactive retained offer values remain hidden and reappear unchanged when the
  offer count increases;
- the offer cards may use the visual language of exit cards but must not render
  door numbers, exit selection controls, room state, or topology actions;
- the existing `Picked offer` control remains in the exact wheel acquisition
  action on the Room Timeline; and
- the structural cards may show a read-only selected marker derived from
  `pickedOfferIndex`, but must not introduce a second way to change the picked
  offer.

Wheel 1 and Wheel 2 remain separate sequential sections. They are not placed
beside one another by this plan.

## Included changes

- O target-store consequence projection and target-card presentation;
- O-specific batch selector wording supplied by application projection;
- focused O decision, destination, and React witnesses for the consequence
  matrix;
- one/two-column active-offer layout inside `RewardWheelWorkbench`;
- selected-offer read-only styling if it improves card legibility;
- responsive CSS and focused wheel component tests;
- durable O/editor authority and progress updates at closure; and
- deletion of this temporary plan at closure.

## Excluded scope

- catalog declarations or normalization;
- authored schema, codec, migration, commands, Undo behavior, or defaults;
- reward-store support, adjustment-speed math, bag consumption, entered-store
  history, wheel settlement, or target reward simulation;
- changing when an outgoing store is required or conditionally hiding authored
  store state based on the selected target;
- adding or removing reward-wheel offers;
- moving Wheel 1 and Wheel 2 beside one another;
- moving the picked-offer selector out of the Room Timeline;
- making wheel offers behave as exits;
- changing ordinary biome exit-card layout;
- changing the Hub editor plan; and
- unrelated O editor styling.

## Gate A - outgoing-store consequence

Add the complete read-only O target consequence in one application vertical
slice.

Primary projection witnesses:

- a ShipCombat target publishes no incoming reward and an explicit discarded
  outgoing-store consequence;
- a Miniboss target publishes forced RunProgress Boon independently of the
  batch base store;
- a Devotion target publishes forced RunProgress Devotion independently of the
  batch base store;
- a Reprieve target publishes the actual resolved RunProgress or MetaProgress
  store used by its ordinary reward;
- Story and Midshop publish their fixed identity plus the actual resolved store
  recorded as provenance;
- Preboss Shop publishes its fixed identity and retained store provenance;
- changing the source final active wheel changes a consequential target's
  derived store statement without creating a batch-store interaction;
- a non-Ship O source labels its one editable store control **Next store roll**;
  and
- retained-invalid or progressively unavailable targets do not receive a false
  resolved-store claim.

Representative UI witnesses:

- `Combat -> Combat` visibly says that no incoming reward uses the outgoing
  store;
- `Combat -> Reprieve` shows the derived final-wheel store beside the existing
  reward editor;
- `Story -> Reprieve` exposes one editable **Next store roll** and the selected
  store appears as the Reprieve consequence; and
- `Combat -> Story` shows fixed Story plus store-history provenance, without a
  second store selector.

Focused verification:

- decision assembly and workspace contract tests;
- focused O decision-workbench React tests;
- planner application typechecking; and
- changed-file lint, formatting, and diff checks.

Intended commit:

```text
fix(o): clarify outgoing store consequences
```

## Gate B - wheel offer cards

Render active offers within each existing wheel as a bounded responsive card
grid.

Primary UI witnesses:

- a one-offer wheel renders one full-row offer card;
- a two-offer wheel renders two sibling offer cards in one grid;
- the grid collapses to one column at the selected container breakpoint;
- each card retains its exact reward control and semantic marker;
- the picked offer is visually identifiable without gaining an interactive
  structural selector;
- changing `Offers` from two to one hides only Offer 2 and preserves its value;
- restoring two offers restores the exact Offer 2 control and value;
- Wheel 1 and Wheel 2 remain in their existing phase sections; and
- the Timeline retains the only interactive `Picked offer` control.

Use DOM structure and explicit data attributes for the one-versus-two card
contract. Do not add screenshot tests for incidental colors or pixel spacing.

Focused verification:

- `OccurrenceEncounterWorkbench` wheel tests;
- focused Ship phase and Room Timeline interaction tests;
- planner UI tests;
- planner application typechecking;
- changed-file lint, formatting, and diff checks; and
- production build because React structure and responsive CSS change.

Intended commit:

```text
fix(o): present wheel offers as choice cards
```

## Gate C - durable closure

- add the target consequence matrix and store-history clarification to
  `O_GAME_RULES.md`;
- update `EDITOR_MODEL.md` with the final O outgoing and per-wheel offer
  presentation;
- record the completed editor work and truthful validation in
  `IMPLEMENTATION_PROGRESS.md`;
- delete this temporary plan; and
- run one complete `npm run check` after independent review remediation.

No reward audit change is expected unless implementation review finds that the
existing durable reward audit does not already preserve the distinction between
reward consumption and entered-store provenance.

Intended commit:

```text
docs(o): close reward presentation work
```

## Review requirements

Each implementation gate receives a fresh executor and an independent reviewer.
The main session retains plan interpretation, finding disposition, final
bird's-eye diff review, and Git ownership. Review must confirm:

- no catalog, authored, simulation, candidate, or lifecycle behavior changed;
- `sourceOfferPoint` and the final-active-wheel authority remain intact;
- target consequence text comes from application projection rather than React
  reconstructing game policy;
- Reprieve remains the only listed O target whose ordinary reward identity is
  drawn from the inherited store;
- fixed Story/Shop provenance remains distinct from bag consumption;
- truly discarded ShipCombat target stores are not claimed as recorded;
- forced Miniboss/Devotion stores do not display the inherited store;
- wheel offer cards do not gain exit semantics or a second picked-offer
  command;
- one-offer and two-offer layouts preserve dormant offer state; and
- every new application branch has a concrete test named in this plan.

Only one complete repository gate runs at closure. Narrow planner and UI lanes
are used during implementation and bounded review remediation.
