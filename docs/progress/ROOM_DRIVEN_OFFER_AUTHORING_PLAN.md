# Room-Driven Offer Authoring Plan

## Status

- **State:** locked for implementation; Gate A has not started
- **Base commit:** `d9e72e03cc6206c38d5e05b260bd9999e3e488cc`
- **Current persistence boundary:** schema 68
- **Current catalog boundary:** `0.49.0-completion-topology`
- **Planned persistence boundary:** unchanged
- **Planned catalog boundary:** unchanged

This is a temporary execution contract. It must be deleted during closure after
its lasting ownership and presentation decisions have been absorbed by the
smallest durable catalog, editor, structured-workspace, and progress
authorities.

## Objective

Make room selection and reward authoring read as one continuous configuration
for both biome starts and normal-door offers. The selected Room Declaration,
not a biome key, room-name condition, React branch, or rail summary, determines
which reward controls belong to that offer.

The user-visible outcomes are:

- an Opening starts with **Configure starting room**;
- an Intro starts with **Configure Intro room**;
- both surfaces always show `Room` and `Reward`, even before the room exists;
- every normal physical offer uses **Configure door offer** and always shows
  the same two rows;
- an unresolved room says `Choose room to show reward`;
- a resolved room shows `No reward`, one reward editor, or every reward editor
  declared for that room's offer surface;
- F exposes its multiple Opening candidates, while N Opening and each fixed
  Intro expose their one real candidate through the same picker language;
- H combat doors expose their active two- or three-cage reward surface while
  Fields optional MetaProgress rewards remain inside the entered room;
- O ShipCombat doors resolve to no incoming offer reward while their wheels
  remain on their declaration-owned room phases; and
- the rail continues to show a reward token only for one visible resolved
  reward, without constraining editor authoring.

## Problem Statement

The current editor progressively reveals structurally related controls without
preserving their visual continuity:

- the start frontier uses a contextual picker only for F and substitutes a
  special `Start biome` action for every fixed Opening or Intro;
- a missing normal target renders only its room picker;
- selecting that room makes a reward editor appear later in the resolved card,
  so room selection visually resembles completion even when reward authoring is
  still unfinished;
- a zero-reward surface renders nothing rather than an explicit resolved state;
  and
- the complete door reward product is named `rewardPreview` and is consumed by
  editors, markers, navigation, Hub cards, occurrence context, and the rail,
  even though only the rail intentionally suppresses multi-reward surfaces.

The live implementation already retains important correct behavior:

- `projectWorkspaceDoorContract` includes the full active Fields cage prefix;
- `DoorRewardEditor` can render more than one reward;
- `mainRailRewardForDoor` and selected-target rail presentation independently
  require exactly one visible resolved reward; and
- fixed start interactions already expose their one-room candidate domain even
  though React does not render it.

This plan preserves those products while giving their ownership and UI states
one explicit shape.

## Locked Modeling Decisions

### The selected room owns the offer-reward binding

The normalized `RoomDeclaration` publishes one closed offer-reward binding:

```ts
type RoomOfferRewardBinding =
  | { readonly kind: 'none' }
  | { readonly kind: 'incomingReward' }
  | { readonly kind: 'localRewardGroup'; readonly groupKey: string };
```

The name may be adjusted to the repository's established catalog vocabulary,
but the three meanings and their owner are locked.

The compiler derives the ordinary cases directly from that same room's
`incomingReward` declaration:

- `incomingReward.kind === 'none'` normalizes to `none`;
- every other incoming producer normalizes to `incomingReward`; and
- a raw room declaration may explicitly select one of its own bounded local
  reward groups when the offer surface is not its incoming binding.

The explicit group form is required for H Fields cage surfaces. It references
the existing `cages` bounded-reward descriptor on each Fields combat Room
Declaration. It does not reference `optionalRewards`.

The compiler validates that an explicit group exists on that exact room, is a
supported reward-bearing group, and is not an encounter wheel, Shop inventory,
fixed-room slot group, or Fields optional-reward descriptor. It performs no
dispatch on biome key, game-name prefix, or room-template key.

Concrete declaration outcomes include:

| Room declaration family                              | Normalized offer-reward binding |
| ---------------------------------------------------- | ------------------------------- |
| F and N Opening                                      | `incomingReward`                |
| ordinary counted/fixed reward rooms                  | `incomingReward`                |
| Intro, ShipCombat, Shop, and other no-incoming rooms | `none`                          |
| H Fields combat                                      | `localRewardGroup: cages`       |

O wheel offers remain attached to their Encounter Envelope phases. H optional
MetaProgress rewards remain attached to `fieldsOptionalRewards`. Neither is
silently promoted into the room's selected-offer surface.

### One exhaustive application reward surface

The occurrence/decision assembly resolves the normalized room binding against
the exact authored occurrence and already-projected reward controls. It returns
one immutable, exhaustive product:

```ts
interface WorkspaceOfferRewardSurface {
  readonly visibility: 'hidden' | 'visible';
  readonly rewards: readonly WorkspaceOfferReward[];
}
```

The exact type names may follow current workspace conventions. The contract is:

- `rewards` contains every active authoring reward for this selected offer;
- an empty array means the room has no offer reward;
- an incoming binding resolves the exact incoming reward control or fixed
  summary;
- a local-group binding resolves the active group prefix already established by
  canonical context, including H's two or three cage controls;
- reward values, controls, markers, and semantic addresses are reused from the
  occurrence reward assembly rather than reconstructed; and
- exit preview visibility is applied after reward-surface resolution and never
  deletes authorable controls.

The complete surface replaces `WorkspaceDoorContract.rewardPreview` as the
shared editor/navigation product. The old ambiguous property is deleted rather
than retained as an alias. The dedicated `WorkspaceRoomSummary.entryReward`
shortcut is also retired once the selected start consumes the same complete
room surface.

Fields `roomLocal` continues to carry cages for encounter chronology and
optional rewards for the entered-room workbench. It is not the authority for
deciding which subset forms the offer surface. Both views reference the same
projected controls.

### Rail lossiness remains presentation-only

The biome presentation derives `WorkspaceRailReward` from the complete offer
surface. It emits one token only when all of these are true:

1. the offer is game-visible on that exit;
2. the surface contains exactly one reward; and
3. that reward has one resolved offer.

Zero, unresolved, hidden, and multi-reward surfaces emit no rail token. Rail
selection, label density, and token omission cannot change editor controls,
marker ownership, focus destinations, or room semantics.

The N Hub board retains its dedicated topology and visit composition. Its main
room cards may consume the same exhaustive reward surface, but the rail's
single-token rule and the Hub's Overview-versus-Timeline split remain
unchanged.

### One start configuration language

The start frontier no longer branches into a fixed `Start biome` card versus an
authored-choice picker. Every authored start renders:

```text
Configure starting room | Configure Intro room
Room    [contextual room picker]
Reward  Choose room to show reward
```

The application projection supplies the title and field labels from the start
candidate Room Declarations. React does not inspect a biome key or game-name
prefix. Opening candidates produce `Configure starting room`; Intro candidates
produce `Configure Intro room`. A mixed candidate-kind start is a projection
contract error because no supported layout declares one.

Candidate cardinality changes only the picker contents:

- F shows its three Opening declarations;
- N shows its one Opening declaration; and
- G/H/I/O/P/Q each show their one Intro declaration.

The one-option cases are not auto-selected and do not become a different
button. Selecting the option still dispatches the existing complete
`CreateStart` semantic command.

After creation, the occurrence-owned start identity surface keeps the same
Room/Reward composition. It resolves the selected room's complete surface to
`No reward`, one editor, or multiple editors. F retains its supported start-room
replacement picker; declaration-fixed starts retain a fixed selected room row
rather than inventing a replacement command.

### One normal-door offer language

Every normal target card renders the same stable composition:

```text
Configure door offer
Room    [room picker or selected room]
Reward  [pending, none, one, or many]
```

Before room selection, the Reward row remains visible and says
`Choose room to show reward`. Existing prerequisites still govern the room
picker: unresolved batch store, Fields outcome, earlier physical offer, staged
progression, and retained-invalid support are not bypassed.

After room selection or replacement, the selected Room Declaration's binding is
resolved again. The Reward row renders:

- `No reward` for an empty surface;
- one ordinary editor or fixed summary for one reward;
- all labeled sibling editors for a multi-reward surface; or
- the established hidden-door statement plus any authorable hidden controls.

The batch heading no longer changes from `Choose a room` to
`Choose a room and reward`. Door numbering, picked state, retained-invalid
state, O's read-only store consequence, Anomaly identity, additional exits, and
selected-continuation navigation remain separate existing products.

### Selection continuity is UI-session behavior

Selecting a room does not add authored gating or a second semantic command.
After the existing room command succeeds, the UI keeps the containing
configuration visible, scrolls the resolved Reward row into view, and moves DOM
focus to its first editable control. It does not automatically open a picker.

When the resolved surface is empty or fixed, focus moves to an accessible
Reward status rather than to a nonexistent control. Start creation follows the
same rule after the new occurrence is projected. This focus/announcement state
is transient UI-session behavior and never enters authored history.

## Current-State Inventory and Required Deletions

The implementation currently spreads this presentation across:

- raw and normalized Room Declarations in `packages/hades2-catalog` and the
  planner-engine catalog schema;
- occurrence reward and room-fact assembly;
- `WorkspaceRoomSummary.entryReward`;
- `WorkspaceDoorContract.rewardPreview` and `door-contract.ts`;
- marker ownership, Hub assembly, occurrence incoming context, and biome rail
  presentation;
- fixed and choice branches in `StartFrontier`;
- `StartRoomIdentityEditor`;
- `MissingTargetRow`, `TargetRow`, and the conditional batch heading; and
- `DoorRewardEditor`, which currently returns `null` for zero rewards.

Completion requires deleting or replacing:

- the fixed-start `Start biome` presentation branch;
- the silent zero-reward return;
- the conditional `Choose a room` / `Choose a room and reward` heading;
- `WorkspaceDoorContract.rewardPreview` and its old hidden/none/visible union;
- the start-only `entryReward` presentation shortcut; and
- any editor or rail code that reconstructs rewards from `roomLocal.kind` after
  the normalized room binding and complete surface exist.

No compatibility alias, parallel preview array, or biome/game-name dispatch may
remain after Gate B.

## Ownership

### Hades II catalog

Owns the raw optional local-group override, normalized closed binding, H cage
declaration facts, compiler derivation from each room's incoming binding, and
validation of exact group references.

It does not own authored values, active Fields prefix evaluation, rail density,
focus, or React layout.

### Planner engine

Owns only the normalized catalog-schema vocabulary consumed by the application.
This plan adds no authored field, codec, command, lifecycle transition,
simulation rule, candidate policy, or migration.

The catalog-schema addition earns its keep through the compiler validation
matrix and the application H/ordinary/O contact tests. No generic reward-surface
resolver is added to the engine because the engine does not own React-facing
controls.

### Planner application and React

Owns resolving the normalized binding into exact projected controls, composing
start and door configuration products, transient selection focus, responsive
zero/one/many presentation, and the intentionally lossy rail adapter.

It does not decide a room's binding from biome, template, game name, incoming
reward type, or rendered component state.

## Persistence and Version Disposition

This change adds no persisted authored value and changes no simulation meaning.
The room binding is normalized catalog metadata derived from existing room
reward declarations plus an explicit H group reference. Therefore:

- `PROJECT_DOCUMENT_SCHEMA_VERSION` remains 68;
- the catalog version remains `0.49.0-completion-topology`;
- no migration is added; and
- existing checkpoint fixtures change only if their UI assertions consume the
  corrected presentation contract.

A later implementation finding that requires persisted state or changes reward
simulation is a plan blocker, not permission to bump versions inside a gate.

## Delivery Gates

### Gate A — Room declaration authority and complete surface

**Commit boundary:** one vertical catalog-to-application contract correction.

Deliverables:

1. Add the closed normalized room offer-reward binding and the narrow raw local-
   group override.
2. Derive ordinary `none`/`incomingReward` bindings from each room's own incoming
   declaration.
3. Declare H Fields cages as the exact local group and validate every explicit
   group reference during catalog compilation.
4. Project one complete workspace reward surface from the selected room binding
   and existing occurrence controls.
5. Replace `rewardPreview` and the start-only entry shortcut across door, Hub,
   marker, navigation, occurrence-context, and rail consumers.
6. Preserve the rail's exact-one-token rule as a downstream biome-presentation
   derivation.
7. Delete the superseded parallel properties and room-local reconstruction path.

Primary tests:

- catalog compiler/declaration matrix for ordinary incoming, none, valid cage
  group, missing group, wrong group kind, and optional-group rejection;
- application assembly witnesses for F/N incoming, Intro none, H two/three
  cages, and O ShipCombat none;
- marker/destination witnesses proving every H cage remains addressable; and
- rail presentation witnesses for zero, one, hidden, unresolved, and multiple
  rewards.

Narrow validation:

```bash
npm run test:catalog
npm run test:contract
npm run typecheck
npm run lint
npm run format:check
```

### Gate B — Unified start and door configuration

**Commit boundary:** one application/React presentation slice using the Gate A
surface; no reward-policy changes.

Deliverables:

1. Replace fixed `Start biome` and choice-only start rendering with the shared
   Room/Reward configuration language.
2. Publish declaration-derived Opening/Intro titles and render one-option
   contextual pickers without auto-selection.
3. Keep the selected start occurrence in the same Room/Reward visual language.
4. Render the pending Reward row on every unresolved normal target.
5. Render explicit no-reward, single-reward, and multi-reward resolved states.
6. Replace the conditional batch heading with `Configure door offer`.
7. Add transient focus/scroll/announcement continuity after successful room
   selection without opening another picker or adding authored state.
8. Preserve H optional rewards, O wheels, N Hub ownership, additional exits,
   retained-invalid repair, and existing O consequence copy.

Primary UI/product witnesses:

- F Opening: three candidates -> pending Reward -> one entry reward editor;
- N Opening: one visible candidate -> pending Reward -> RunProgress entry reward;
- one Intro: one visible candidate -> explicit `No reward`;
- ordinary missing target -> selected zero-reward target;
- ordinary missing target -> selected single-reward target;
- H Min and Max: two and three cage editors on the outgoing door offer, with no
  Fields optional reward in that card;
- O ShipCombat: `No reward`, with its phase/wheel workbench unchanged;
- room replacement recalculates the same Reward row in place;
- keyboard focus reaches the resolved Reward row without opening its picker;
  and
- N Hub Overview reward authoring and visit Timeline detail remain unchanged.

Narrow validation:

```bash
npm run test:ui
npm run test:planner
npm run test:product
npm run typecheck
npm run lint
npm run format:check
npm run build
```

### Gate C — Closure

**Commit boundary:** one documentation and closure commit.

Deliverables:

1. Update `CATALOG_MODEL.md` with room-owned offer-reward bindings and compiler
   validation.
2. Update `EDITOR_MODEL.md` and `STRUCTURED_EDITOR_WORKSPACE.md` with the shared
   start/door Room/Reward composition and explicit rail lossiness.
3. Correct the durable H wording so cage rewards are presented on the outgoing
   door offer while optional MetaProgress rewards remain entered-room controls.
4. Record the completed delivery and truthful validation in
   `IMPLEMENTATION_PROGRESS.md`.
5. Delete this temporary plan.
6. Run the complete repository gate once after reviewed narrow lanes are stable.

Closure validation:

```bash
npm run check
git diff --check
```

Per repository policy, a passing sequential set of the complete gate's
constituent lanes without intervening production changes is sufficient; it is
not rerun merely to create duplicate evidence.

## Review Gates

Each implementation gate uses a fresh executor and a fresh independent reviewer
under the repository's multi-agent delivery routine when execution begins. The
main session retains catalog, engine, application, and UI oversight and performs
the final holistic diff review before each authorized commit.

Review must explicitly reject:

- any `biomeKey`, room-name prefix, or exact game-name reward-surface dispatch;
- template-driven application inference when the normalized room binding is
  available;
- duplicated reward arrays or marker products;
- moving O wheels, H optional rewards, Shops, or later room interactions into
  the selected-offer surface;
- hiding one-option room candidates;
- auto-selecting fixed starts;
- persisted focus or incomplete picker state;
- a schema/catalog bump without a newly identified compatibility requirement;
  and
- production growth that leaves the old preview/entry paths alongside the new
  complete surface.

## Explicit Non-Goals

This plan does not change:

- room eligibility, force, generation, reward bags, store selection, store
  history, or reward resolution;
- H Min/Max support, cage counts, cage chronology, or optional reward counts;
- O encounter count, wheel stores, wheel offers, or outgoing-store consequence;
- N Hub open-set, visit, side-room, or reward-lookup behavior;
- Opening/Intro topology commands or normal-target command semantics;
- additional Chaos/Zagreus exits, Anomaly takeover, Boss/Postboss fixed links,
  or selected continuation;
- trait, Pom, acquisition, Artificer, Time Piece, Sea Star, Shop, Shrine, Well,
  Pool, or room-action editors; or
- the rail's current compact one-token visual density.

## Completion Criteria

The plan is complete only when:

- every supported Room Declaration normalizes one validated offer-reward
  binding;
- the application resolves reward surfaces without biome, game-name, or
  template dispatch;
- starts and normal doors always render stable Room and Reward rows;
- zero, one, and multiple reward surfaces are explicit and authorable;
- H cage rewards appear on outgoing door offers and optional rewards do not;
- O ShipCombat remains a no-reward door whose wheels stay room-lifecycle-owned;
- the rail remains intentionally single-reward and cannot suppress editor
  authoring;
- superseded preview/entry paths are deleted;
- representative F, H, N, O, zero/one/many, hidden, rail, focus, and Hub
  witnesses pass; and
- durable authorities absorb the decisions and this temporary plan is removed.
