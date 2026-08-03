# Authored Shop Purchase Order

## Status

Implementation is complete and its automated delivery gates are green. This
document remains the delivery record for Phase 7 Commit 5c; the durable Shop
contracts now live in their owning design and audit authorities. The four
presentation-only Commit 5b slices, their visual review, and the pre-5c
re-anchor program are closed. Their delivery record remains in
[`IMPLEMENTATION_PROGRESS.md`](IMPLEMENTATION_PROGRESS.md).

Commit 5c deliberately changed the persisted Shop contract: the authored plan
records one exact purchase sequence rather than a boolean purchased set whose
order simulation selected later. It introduced project schema 11 and was
delivered as a domain correction rather than presentation polish.

Automated validation passed on the completed product: `npm run test:changed`
passed 88 files / 762 tests, and `npm run check` passed 100 files / 891 tests,
all workspace typechecks, lint, formatting, and the production build. Desktop
and narrow visual sign-off remains the final manual Phase 7 acceptance input.

Stable authority remains with
[`AUTHORED_PROJECT_MODEL.md`](../design/AUTHORED_PROJECT_MODEL.md),
[`CANDIDATE_EVALUATION_MODEL.md`](../design/CANDIDATE_EVALUATION_MODEL.md),
[`EDITOR_MODEL.md`](../design/EDITOR_MODEL.md),
[`REWARD_MODEL.md`](../design/REWARD_MODEL.md),
[`ROOM_LIFECYCLE_MODEL.md`](../design/ROOM_LIFECYCLE_MODEL.md), and
[`SIMULATION_AND_VALIDATION.md`](../design/SIMULATION_AND_VALIDATION.md). Those
documents and the current interpretation in
[`REWARD_GAME_DATA_AUDIT.md`](../audits/REWARD_GAME_DATA_AUDIT.md) must be
reconciled as the owning slices land.

## Original Problem

Before this delivery, the schema-10 model stored:

```ts
interface ShopOfferState {
  readonly offer: ResolvedRewardOffer;
  readonly purchased: boolean;
}

interface ShopState {
  readonly profileKey: string;
  readonly offers: Readonly<Record<string, ShopOfferState>>;
}
```

The simulator collects the purchased offers, evaluates every permutation,
merges equivalent histories, and retains a witness order. Consequently, the
editor cannot truthfully display a selected order because the authored project
does not contain one.

That contract is useful for possibility-only planning but cannot represent the
order in which purchased loot enters reward history. Purchase sequence is a
real player choice and can affect purchase requirements and later history
checks. The authored Shop therefore needs to supply that sequence instead of
letting simulation choose one.

The contract correction is:

```text
schema 10: author a purchased set -> accept if any order is supported
schema 11: author one purchase order -> require that exact order to be supported
```

This is a narrow occurrence-leaf and reward-lifecycle correction, not another
architecture campaign. It changes no catalog declaration, topology, lifecycle
phase, history representation, semantic address family, Redux ownership, or
candidate subsystem. Its apparent file breadth comes from propagating one
persisted Shop value through the existing engine, application projection, and
React product loop.

## Target Authored Contract

### State

Shop order is owned once by the materialized Shop occurrence:

```ts
interface ShopOfferState {
  readonly offer: ResolvedRewardOffer;
}

interface ShopState {
  readonly profileKey: string;
  readonly offers: Readonly<Record<string, ShopOfferState>>;
  readonly purchaseOrder: readonly string[];
}
```

Each `purchaseOrder` entry is a stable declaration-owned Shop slot key.
Purchase membership and ordinal are derived from that list; they are not
duplicated on the offer.

An empty order is complete authored state and means that the player purchases
nothing. Declaration order is not a default purchase order.

### Structural Validity

- Every purchase key must exist in the Shop profile and materialized offer map.
- Keys are distinct; one offer can be purchased at most once.
- The list is dense by construction. There are no persisted ordinal gaps.
- Structurally malformed orders are rejected by commands and decoding.
- A structurally valid but context-invalid order remains representable and
  receives ordinary simulation findings.
- Shop profile slot order continues to own inventory display and generation
  order. It does not imply purchase order.

### Semantic Ownership

- The Shop occurrence owns the aggregate `purchaseOrder`.
- Existing `ShopPurchaseAddress` values remain the stable per-offer owners for
  row interaction markers, specific findings, and purchase acquisition events.
- The exact-order candidate query is occurrence-owned because its candidate
  value replaces the aggregate list. Its result may still contain evidence at
  a specific offer's `ShopPurchaseAddress`.
- No separate persisted purchase occurrence or UI ordinal identity is added.
- No new semantic address is required solely to wrap the aggregate list unless
  implementation proves that the occurrence address cannot carry its command
  and candidate ownership.
- The visible per-row `Purchased` state is derived from membership in
  `purchaseOrder`; it is not retained as a second persisted authority.

## Commands and Defaults

Remove:

```ts
SetShopPurchase {
  purchase: ShopPurchaseAddress;
  purchased: boolean;
}
```

Add one atomic command:

```ts
ReplaceShopPurchaseOrder {
  shop: OccurrenceAddress;
  offerKeys: readonly string[];
}
```

The command validates the complete order and replaces it in one authored
transition. It does not toggle one boolean and then repair peer ordinals.

Initialization installs:

```ts
purchaseOrder: [];
```

`ReplaceShopOffer` continues to replace only the selected slot's resolved
offer. Room replacement continues to use declaration-owned Shop defaults; it
does not infer purchases from a prior profile or declaration order.

## Schema and Codec Policy

- Increment `PROJECT_DOCUMENT_SCHEMA_VERSION` from 10 to 11.
- Encode `purchaseOrder` once on `ShopState`.
- Remove `purchased` from every encoded Shop offer.
- Validate exact Shop keys, distinct order entries, and profile membership.
- Schema 11 rejects schema 10. Add no compatibility decoder, migration shim, or
  mixed-shape runtime branch.
- Update project factories and fixtures to author explicit orders.
- Catalog version does not change because Shop declarations and slot identities
  are unchanged.

## Materialization Contract

The canonical Shop entry carries inventory and order separately:

```ts
interface CanonicalShopOffer {
  readonly offerKey: string;
  readonly offerOrigin: ShopOfferAddress;
  readonly purchaseOrigin: ShopPurchaseAddress;
  readonly offer: ResolvedRewardOffer;
}

interface CanonicalShopEntryState {
  readonly kind: 'shop';
  readonly profileKey: string;
  readonly offers: readonly CanonicalShopOffer[];
  readonly purchaseOrder: readonly string[];
}
```

Inventory remains declaration-ordered. `purchaseOrder` remains authored order.
Materialization must not turn the order back into per-offer booleans.

## Reward Kernel and Simulation

Shop lifecycle timing does not change:

```text
materialize inventory
  -> generate outgoing batch against the complete pre-purchase inventory
  -> execute authored purchases in exact order
  -> carry resulting histories through the already-generated picked target
```

The reward kernel must:

1. validate the existing Shop generation witness;
2. accept one exact, already-resolved inventory-index sequence from the
   simulation adapter;
3. execute only that index sequence;
4. evaluate each purchase requirement and acquisition role against history
   produced by earlier authored purchases;
5. remove each purchased option from the active current-Shop set in sequence;
6. preserve reward-source possibility branches within that fixed order; and
7. merge equivalent result histories without exploring another purchase
   permutation.

### Exact-Order Execution

Remove the permutation loop from `evaluateShopPurchases`. The emitted
`shopPurchasesSupported.purchaseOrder` is now the authored order, not a witness
chosen from a set.

`AuthoredShopOffer` in the reward kernel loses its `purchased` boolean. The
simulation adapter resolves each canonical `purchaseOrder` key against
`entry.offers` once, rejects missing or duplicate keys as a materialization
contract failure, and passes the resulting index list separately to
`evaluateShopPurchases`. Stable semantic keys do not leak into the otherwise
slot-indexed reward kernel.

The existing `RewardHistoryState`, `applyConcreteAcquisition`, lifecycle phase,
and ordered reward-event emission remain unchanged. This work selects the one
sequence passed through those mechanisms; it does not add a purchase ledger or
another ordered-history representation.

Exact affordability and resource inventory remain deferred under the existing
sufficient-resource policy.

### Failure Evidence

- If one specific authored purchase fails in every reward branch, retain
  `shopPurchaseUnavailable` at that offer's `ShopPurchaseAddress`.
- If failure is sequence-dependent across branches and cannot be assigned to
  one slot, retain the existing aggregate finding at the Shop occurrence but
  rename its evidence from `jointPurchaseSet` to `jointPurchaseOrder`.
  `offerKeys` carries the authored order; no richer evidence model is added.
- Findings must never retry another permutation to rescue the authored order.
- A reordered proposal may be valid even when the current authored order is
  invalid; candidate evaluation exposes that distinction.

## Candidate Contract

Adapt the existing room-lifecycle candidate path locally. Rename its boolean,
per-offer query to the aggregate exact-order family:

```ts
interface ShopPurchaseOrderCandidateQuery {
  readonly kind: 'shopPurchaseOrder';
  readonly shop: OccurrenceAddress;
  readonly offerKeys: readonly string[];
}
```

- Each engine query is owned by the Shop occurrence and carries one complete
  proposed ordered slot-key list.
- Candidate evaluation obtains the occurrence capability from the current
  exact evaluation's existing `RoomLifecycleCandidateArtifacts.shopAt(...)`
  product and applies the proposal through its existing `evaluateState`
  boundary. It does not replay or reconstruct reward policy in the application.
- Candidate evaluation applies the same exact-order simulator path used by
  canonical validation.
- The engine result retains the existing room-lifecycle
  `{ supported, findings }` shape. The application pairs that result with the
  proposed list in `CandidateOptionProjection`; Shop order choices are
  possible, impossible, or unavailable, never forced.
- One row activation batches only that row's complete toggle/order proposals.
  React does not simulate purchases or repair order arrays.
- Candidate context remains unavailable beyond the progressive frontier exactly
  as other room-local candidate families do.
- Do not introduce a second Shop candidate subsystem, generic ordered-candidate
  framework, or new support vocabulary.

### Candidate Work Contract

- Rendering a Shop performs no candidate evaluation.
- Activating one row evaluates only that row's proposals. A six-slot profile
  requires at most seven distinct exact-order queries across that row's two
  controls.
- Repeat activation of the same proposal domain uses the prepared-session
  cache.
- Editing publishes one ordinary project evaluation; the candidate layer does
  not add a second project evaluation or production audit pass.

## Non-Goals

- Do not add money, affordability, reroll, or resource-inventory state.
- Do not reorder declaration-owned Shop inventory rows.
- Do not add multiple purchases of one offer.
- Do not change Shop declarations, profile slot identities, offer payloads, or
  room lifecycle timing.
- Do not change `RewardHistoryState`, add a purchase-history ledger, add a
  lifecycle phase, or add a reward-event type.
- Do not introduce a new semantic address or a generic ordered-collection
  command/control abstraction.
- Do not add drag-and-drop as the only ordering interaction.
- Do not implement an execution-plan compiler; the authored order merely
  remains available to future consumers.
- Do not add a schema-10 decoder, compatibility adapter, or catalog-version
  change.

## Editor Contract

### Presentation

Every materialized Shop renders:

```text
Offer               Purchased    Purchase order
Offer 1             Yes          2nd
Offer 2             No           —
Offer 3             Yes          1st
```

The two controls are one UI language over the single persisted
`purchaseOrder`:

- `Purchased` is checked exactly when the row key belongs to the order;
- checking an unpurchased row appends it to the end of the current order;
- unchecking a purchased row removes it and compacts the remaining order;
- the order select is disabled for an unpurchased row;
- a purchased row in an order of length `k` exposes positions `1` through `k`;
  and
- selecting a position removes the offer from its previous position, inserts
  it at the selected position, and shifts peers atomically.

Every toggle and position maps to one complete proposed `offerKeys` list.
Duplicate positions and gaps never appear. One interaction dispatches one
`ReplaceShopPurchaseOrder` command and creates one Undo entry.

The Shop controls should be purpose-built row interactions, analogous to the
direct Ephyra side-room generation and visit-order controls. Do not force
array-valued orders through the scalar `CandidateSelect`, add drag-only
interaction, or calculate validity in React.

### Presentation Details

- Preserve declaration order for offer rows regardless of purchase order.
- Show the selected purchase ordinal beside each purchased offer.
- Keep reward offer editing and purchase ordering distinct.
- Include the offer label in both controls' accessible names.
- Candidate-impossible positions remain visible but disabled with evidence.
- Three-, five-, and six-slot Shop profiles must remain legible at desktop and
  narrow widths.

### Future Shared Ordering Presentation

Shop purchases, Hub main rooms, and Ephyra side rooms share a useful visual
language: options first become active, then some or all active options receive
an activation/visit order. A later presentation slice may render ordered active
items at the top, active-but-unordered items next, and inactive items last, with
drag handles plus keyboard-accessible move controls.

That future convergence is an application/React projection only. It does not
make the three persisted contracts identical:

- Shop membership and order are the same fact, so one `purchaseOrder` is
  authoritative and there is no active-but-unordered Shop state;
- Hub open membership and visit order remain independent because open rooms may
  be unvisited; and
- side-room generation and visit order remain independent because generated
  rooms may be unvisited.

Commit 5c does not introduce the generic sortable component or replace the
existing Hub and side-room controls. Its two Shop controls should leave that
future presentation possible without adding a generic domain command or
persisted wrapper now.

## Replacement of Existing Authority

Commit 5c must revise current statements that:

- `purchased: false` is the complete Shop default;
- purchase order is derived simulation state;
- the simulator explores every semantically distinct order; and
- a later compiler selects a witness order.

The replacement authority is:

- `purchaseOrder: []` is the complete Shop default;
- the editor authors one exact order;
- simulation validates only that order; and
- the persisted order remains available to future consumers without simulation
  choosing a different witness.

## Delivery Slices

### Commit 5c.1: Deliver the Exact-Order Product Slice — complete

Suggested subject:

```text
feat(shop): author exact purchase order
```

Owns one complete vertical slice: persisted state, exact-order simulation,
candidate adaptation, workspace projection, the two row controls, and primary
tests land together. The commit must leave the repository type-correct and the
Shop product usable; it is not an engine-only checkpoint for later commits to
repair.

Likely files:

- authored-project model, command, codec, initialization, and fixtures;
- materialization Shop products;
- reward-kernel Shop model and evaluator;
- simulation reward processing, events, findings, room-lifecycle candidate
  artifacts, candidate query/session exports, and focused tests;
- `apps/planner/src/projections/candidateProjection.ts` for complete-order
  proposal batching through the prepared session;
- `apps/planner/src/projections/structured-workspace/contract.ts`,
  `assembly/occurrence-assembly.ts`,
  `interactions/interaction-requirements.ts`, and
  `interactions/interaction-binding.ts` for occurrence-owned order candidates
  and per-row controls;
- `ShopPurchaseControl.tsx`, `OccurrenceWorkbench.tsx`, and `styles.css` for the
  derived Purchased toggle and position select;
- independent workspace closure support under
  `apps/planner/test/support/structured-workspace/`, including expected leaves,
  observed products, and leaf interaction closure;
- `evaluationProjection.ts`, `contextualOptions.ts`, and the deferred Shop rows
  in `USER_FACING_VOCABULARY_AUDIT.md` for exact-order wording;
- architecture, interaction-binding, occurrence-assembly, workspace-contract,
  and focused React tests;
- app project/profile/recovery factories affected by schema 11;
- planner-engine public exports and focused tests;
- `AUTHORED_PROJECT_MODEL.md`, `CANDIDATE_EVALUATION_MODEL.md`,
  `REWARD_MODEL.md`, `ROOM_LIFECYCLE_MODEL.md`,
  `SIMULATION_AND_VALIDATION.md`, `EDITOR_MODEL.md`, and
  `REWARD_GAME_DATA_AUDIT.md` as their owned behavior changes land.

Gate:

- all workspace typechecks;
- `npm run test:engine`;
- focused candidate, projection, workspace-contract, and React tests;
- `npm run test:changed` as a final affected-graph check;
- lint, format check, and `git diff --check`.

No temporary boolean adapter, dual schema, or permutation fallback may be added
to stage the change. Green status comes from landing the complete vertical
product slice, not from retaining the old contract beside it.

Tests stay with their semantic owners: command and codec coverage remains in
authored-project tests, exact-order execution remains in reward-kernel and
simulation tests, and candidate behavior remains in candidate tests. Do not
create a catch-all test file named after schema 11.

### Commit 5c.2: Close Exact-Order Coverage and Phase 7 — automated closure complete

Suggested subject:

```text
test(shop): close exact purchase-order product
```

Owns cross-profile and persistence confidence, final responsive presentation,
visual review, durable documentation absorption, and phase closure. The
cross-profile, persistence, candidate-cache, documentation, and automated
repository closure are complete. Desktop and narrow visual sign-off remains
the one pending acceptance activity; it does not introduce a second
implementation path or broaden the Shop model.

Likely files:

- three-, five-, and six-slot editor/product witnesses;
- order-sensitive valid and invalid reward fixtures;
- one-command Undo/Redo, profile round-trip, autosave/recovery, and stale-schema
  rejection coverage;
- lazy candidate work-count and repeat-cache witnesses;
- desktop and narrow presentation adjustments and visual review;
- README and progress closure; and
- final absorption into the owning stable design/audit documents, followed by
  retirement of this temporary implementation plan.

Gate:

- desktop and narrow visual review;
- `npm run check`;
- `git diff --check`.

## Final Acceptance

The implemented product satisfies the automated Commit 5c acceptance criteria:

- schema 11 has one Shop-owned ordered list and no per-offer purchased boolean;
- `SetShopPurchase`, boolean Shop candidate contracts, and purchase permutation
  search are absent from production;
- simulation validity depends on the exact authored order;
- the editor derives its Purchased toggle and direct atomic order positions
  from the one list without React-owned repair;
- Shop candidate work remains lazy, row-scoped, and cached through the existing
  prepared session;
- dormant or context-invalid authored order remains representable when
  structurally valid;
- existing reward-history, lifecycle, event, semantic-address, and candidate
  infrastructure is adapted locally rather than replaced or generalized;
- the persisted order remains available to future consumers without selecting
  a witness;
- no catalog declaration or deferred affordability model is changed;
- the complete repository gate passes.

Phase 7 advances after the recorded Commit 5b closure and final desktop/narrow
visual sign-off for this completed Shop product.
