# Finding control targets

Status: locked 2026-10-06. Base: `115f195c0`. No schema change.

## Objective

A finding marks the control that repairs it, never a broad container. Where a
finding has no single repairing control, the engine names the exact next edit
instead of an aggregate owner. Containers stay navigation anchors and paint
nothing.

## Repair policy

- A finding marks the control whose edit repairs it.
- When repair is a sequence, the finding names the next edit only.
- One choice spread over several controls (door selection, wheel choice, Hub
  open set) rings each enabled control of that choice; the container paints
  nothing.
- A finding never asks for an unrelated action. Removing the offending action
  is the preferred repair, so a Timeline row whose action should not exist
  marks Delete.
- A duplicate in an unordered or sequential draw marks the slot that repeats
  an earlier slot.
- A finding that only restates an earlier finding is removed.

## Facts

- Door authoring is sequential: the batch rule (reward pool or Fields roll)
  blocks ordinary target creation (`completeness.ts` `evaluateBatchCompleteness`),
  and only the first missing door is authorable; later doors are
  `awaitingPriorExit` (`decision-assembly.ts` `missingTargetsForPhysicalExits`).
- Shop slots roll independently. Draw-without-replacement linkage exists only
  in two-offer groups (`reward-kernel/shop.ts` `assignments`): `RoomShop`
  (Stygian Well), `SurfaceShop` (Hermes Shrine) and `Q_WorldShop`
  MixedProgress. `jointOfferSet` (`shop/inventory.ts`) is reachable only for
  Q's pair and means its second draw repeats the first option.
- `pickedShopStateMissing` is unreachable: Shop inventory presence equals
  entry activity in defaults, decode (`room-state/codec.ts`), door selection
  (`topology/ordinary.ts`), takeover (`topology/takeover.ts`), Hub membership
  (`room-replacement.ts`) and detours, and completeness only walks entered
  rooms.
- `purgingPoolSaleUnavailable` restates Overview Pool findings: its causes are
  an incomplete Pool assessment or an empty slot (both Overview findings), or
  the sold name not equipped at the sale, which nothing between fountain use
  and the Pool can cause (`ROOM_FEATURES_GAME_DATA_AUDIT.md`, Pools of
  Purging).
- A Hub entry has two whole-owner `continuationMissing` findings
  (`completeness.ts`: missing Hub decision; exact terminal takeover envelope).
  Their first edit is the Hub open set. The completed-Hub handoff
  `continuationMissing` already marks "Open next room".

## Gate 1 — engine: next-edit door and Hub entry findings

- `evaluateBatchCompleteness` reports only the next edit: the missing batch
  rule when the policy has one, otherwise `targetMissing` for the first
  unfilled declared door.
- An ordinary room with no exit decision is assessed over its initial
  envelope (`createInitialExitDecision`) and reports the same next edit; it
  no longer reports `continuationMissing`.
- Fields `batchStateMissing` is owned by the Fields roll address, the control
  that sets it.
- A missing Hub decision and an exact terminal takeover envelope report
  `hubOpenSetIncomplete` at the Hub open set.
- `continuationMissing` remains only for the completed-Hub handoff.
- Primary tests: `biomes/f/completeness.test.ts`,
  `progressive-prefix-frontier.test.ts`, selected-cut and Hub completeness
  witnesses. `npm run test:equivalence`: rewrite only entries whose change is
  this product.
- Commit: `fix(engine): report the next door and Hub entry edit`.

## Gate 2 — engine: per-slot duplicates and restating findings

- `hermesShrineInventoryDuplicate`, `stygianWellDuplicate` and the Well
  refill duplicate name the repeating slot.
- Q `jointOfferSet` becomes a per-offer `shopOfferUnavailable` on the second
  MixedProgress slot with evidence naming the repeated offer; the room-owned
  form is removed.
- Delete `purgingPoolSaleUnavailable` with an engine witness that a sold name
  stays equipped through its sale; delete `pickedShopStateMissing` and
  `findPickedShopState`. Remove their planner copy.
- Primary tests: Shrine, Well, Shop inventory and Pool sale suites;
  equivalence as in Gate 1.
- Commit: `fix(engine): report inventory duplicates per slot`.

## Gate 3 — planner: marks on controls

Finding targets on controls:

- Timeline row categories. Invalid edit: Nemesis "Boon offered", "Reward" and
  Accept; Well Twist result; pickup outcome picker. Should not exist: Delete
  (Well/Shrine refill unavailable, Shop `travelDealInvalid` and
  `echoDoubleShopInvalid`, invalid-placement acquisition rows, order
  unavailable at an unknown checkpoint). Wrong position: Move. Not placed:
  "Restore required action", "Add…", Echo Gold "Take/Restore pickup".
- Hidden-offer rows: reward findings mark the Overview item picker that sets
  the reward when reachable; otherwise the row binding for them is removed.
- Purchase, Sold and Interact controls (Shop "Purchased", Pool Sold, Well
  Interact) carry their owner addresses.
- Ring every enabled control of a multi-control choice: door pick radios,
  Ship wheel pick radios, Hub open-set membership toggles.
- Fixed-phase `encounterUnavailable` and `encounterSlotActivationUnavailable`
  redirect to the upstream choice that repairs them.
- Ship wheel "Reward pool" picker binds its store; inactive-wheel findings
  mark the "Combat phases" picker.
- Route Overview equip results mark their `KeepsakeEquipResultPicker`s.

Removed paint (anchors keep navigation and lock): whole Timeline row, Room
Timeline section, room card, Hub card, `.hub-overview-room-grid`, Doors card
and exit list, disabled door rows, locked Hub exit row, Side Rooms section,
`.ephyra-side-controls`, Hub fountain section, Shrine and Well fieldsets,
Route Overview.

Guard tests: a DOM witness that every painted finding element is a control
or an approved container, and a CSS check that finding colors style only
controls. Dialog sections remain the approved containers pending their own
policy.

Screenshots for owner approval before commit.
Commit: `fix(planner): mark findings on their repairing controls`.

## Exclusions

- Dialog section policy, heading badge, and the finding visual style (gold
  selected ring, "!" marker, rail and route borders, pink versus danger red).
- Mixed text on grouped finding cards.

## Closure

Run `npm run test` and `npm run check` once after Gate 3. Promote any new
durable rule to `docs/design/`, then delete this plan in the closure commit.
