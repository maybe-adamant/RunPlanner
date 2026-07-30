# Authored Shop Purchase Order

## Status

This is the planned implementation authority for Phase 7 Commit 5c. It follows
the four presentation-only Commit 5b slices in
[`WORKSPACE_PRESENTATION_POLISH.md`](WORKSPACE_PRESENTATION_POLISH.md) and the
remaining pre-5c campaigns in
[`REANCHOR_AND_REORGANIZE.md`](REANCHOR_AND_REORGANIZE.md).

Commit 5c deliberately changes the persisted Shop contract: the authored plan
will record one exact purchase sequence rather than a boolean purchased set
whose order is selected later by simulation. This requires project schema 10
and must not be hidden inside presentation polish.

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

## Problem

The current schema-9 model stores:

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
schema 9: author a purchased set -> accept if any order is supported
schema 10: author one purchase order -> require that exact order to be supported
```

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

- Increment `PROJECT_DOCUMENT_SCHEMA_VERSION` from 9 to 10.
- Encode `purchaseOrder` once on `ShopState`.
- Remove `purchased` from every encoded Shop offer.
- Validate exact Shop keys, distinct order entries, and profile membership.
- Schema 10 rejects schema 9. Add no compatibility decoder, migration shim, or
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

Retain the existing Shop purchase candidate path and candidate envelope, but
replace its boolean proposal with one complete proposed order.

- Each engine query is owned by the Shop occurrence and carries one complete
  proposed ordered slot-key list. The application session may batch several
  such queries to populate one row's choices.
- Candidate evaluation applies the same exact-order simulator path used by
  canonical validation.
- Results preserve the proposed list as the candidate value and report
  possible/forced/impossible support through the existing candidate envelope.
- The application projection maps those order candidates into row-local
  `Not purchased / 1st / 2nd / ...` choices. React does not simulate purchases
  or repair order arrays.
- Candidate context remains unavailable beyond the progressive frontier exactly
  as other room-local candidate families do.
- Do not introduce a second Shop candidate subsystem, generic ordered-candidate
  framework, or new support vocabulary.

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
- Do not add a schema-9 decoder, compatibility adapter, or catalog-version
  change.

## Editor Contract

### Presentation

Every materialized Shop renders:

```text
Offer                             Purchase order
Offer 1                           2nd
Offer 2                           Not purchased
Offer 3                           1st
```

For a current order of length `k`:

- an already purchased offer exposes `Not purchased` and positions `1` through
  `k`;
- a not-purchased offer exposes `Not purchased` and insertion positions `1`
  through `k + 1`;
- selecting `Not purchased` removes and compacts;
- selecting a position removes the offer from its previous position if needed,
  inserts it at the selected position, and shifts peers atomically.

Each choice maps to one complete proposed `offerKeys` list. Duplicate positions
and gaps never appear. One selection dispatches one
`ReplaceShopPurchaseOrder` command and creates one Undo entry.

The Shop order control should be a purpose-built row interaction, analogous to
the direct Ephyra side-room position control. Do not force array-valued orders
through the scalar `CandidateSelect`, add drag-only interaction, or calculate
validity in React.

### Presentation Details

- Preserve declaration order for offer rows regardless of purchase order.
- Show the selected purchase ordinal beside each purchased offer.
- Keep reward offer editing and purchase ordering distinct.
- Include the offer label in the order control's accessible name.
- Candidate-impossible positions remain visible but disabled with evidence.
- Three-, five-, and six-slot Shop profiles must remain legible at desktop and
  narrow widths.

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

### Commit 5c.1: Author Ordered Shop Purchases

Suggested subject:

```text
feat(project): author shop purchase order
```

Owns the persisted model, schema, commands, defaults, codec, materialization,
reward-kernel execution, simulation findings, candidate queries, and their
owning tests. It deliberately lands the complete engine semantic contract
before the UI consumes it.

Likely files:

- authored-project model, command, codec, initialization, and fixtures;
- materialization Shop products;
- reward-kernel Shop model and evaluator;
- simulation reward processing, events, findings, and candidates;
- planner-engine public exports and focused tests;
- `AUTHORED_PROJECT_MODEL.md`, `CANDIDATE_EVALUATION_MODEL.md`,
  `REWARD_MODEL.md`, `ROOM_LIFECYCLE_MODEL.md`,
  `SIMULATION_AND_VALIDATION.md`, and `REWARD_GAME_DATA_AUDIT.md`.

Gate:

- planner-engine typecheck;
- `npm run test:engine`;
- lint, format check, and `git diff --check`;
- explicitly record expected planner-application type/test failures caused by
  removal of the boolean interaction contract.

No temporary boolean adapter, dual schema, or permutation fallback may be added
to keep the application green between slices.

Tests stay with their semantic owners: command and codec coverage remains in
authored-project tests, exact-order execution remains in reward-kernel and
simulation tests, and candidate behavior remains in candidate tests. Do not
create a catch-all test file named after schema 10.

### Commit 5c.2: Project Ordered Shop Interactions

Suggested subject:

```text
refactor(editor): project shop purchase order
```

Owns the application projection and candidate-session adaptation before visual
replacement.

Likely files:

- candidate projection/session types and tests;
- `structuredWorkspace.ts` Shop descriptors and interactions;
- architecture-boundary fixtures;
- app test factories affected by schema 10.

Gate:

- planner typecheck;
- focused projection and contract tests;
- lint, format check, and `git diff --check`;
- record any remaining expected React fixture failures until Commit 5c.3.

### Commit 5c.3: Edit Shop Purchase Order and Close Phase 7

Suggested subject:

```text
feat(editor): edit shop purchase order
```

Owns the row-order control, removal of the purchased checkbox, responsive
presentation, product/profile/Undo coverage, final documentation, and phase
closure.

Likely files:

- `ShopPurchaseControl.tsx`, renamed or replaced to match ordered semantics;
- `OccurrenceWorkbench.tsx`;
- focused Shop, workspace, product-loop, profile, and autosave fixtures;
- `styles.css`;
- `EDITOR_MODEL.md`, README, and progress closure.

Gate:

- exact order editing for three-, five-, and six-slot profiles;
- order-sensitive valid/invalid fixtures;
- one-command Undo/Redo and profile round trips;
- desktop and narrow visual review;
- `npm run check`;
- `git diff --check`.

## Final Acceptance

Commit 5c is complete only when:

- schema 10 has one Shop-owned ordered list and no per-offer purchased boolean;
- `SetShopPurchase`, boolean Shop candidate contracts, and purchase permutation
  search are absent from production;
- simulation validity depends on the exact authored order;
- the editor exposes direct atomic order positions without React-owned repair;
- dormant or context-invalid authored order remains representable when
  structurally valid;
- existing reward-history, lifecycle, event, semantic-address, and candidate
  infrastructure is adapted locally rather than replaced or generalized;
- the persisted order remains available to future consumers without selecting
  a witness;
- no catalog declaration or deferred affordability model is changed;
- the complete repository gate passes; and
- Phase 7 advances only after Commit 5b and Commit 5c closure are both recorded.
