# Shop Mystery Boon Acquisition Plan

## Status

Locked for implementation from base commit `62e7b94a`.

## Objective

Make an initial World Shop Mystery Boon follow its real two-stage lifecycle:
the Shop inventory owns only the visible `BlindBoxLoot` identity, while a
participating purchase owns the eventual ordinary-god source and trait offer
at the room's timeline acquisition point.

The editor must no longer ask for a hidden source while authoring unpurchased
Shop inventory. After `Purchased` is selected, the timeline must expose the
same source-and-trait authoring language used by other acquired Mystery Boons,
with source support evaluated at that exact acquisition frontier.

## Authority and source facts

- `docs/audits/rewards-and-acquisition/REWARD_GAME_DATA_AUDIT.md` establishes
  that Shop generation emits the box without resolving its source. Purchase
  records the box and the later unwrap calls ordinary god selection without
  peer exclusion.
- `docs/audits/rewards-and-acquisition/ACQUISITION_DELIVERY_AND_ROOM_SETTLEMENT.md`
  establishes that a produced pickup owns its Mystery Boon source and trait
  offer, rather than its outer producer.
- `docs/design/REWARD_MODEL.md` owns reward identity, source-resolution timing,
  and Shop settlement. Its current statement that initial Shop state persists
  dormant Blind Box source intent is superseded by this plan and must be
  corrected at closure.
- `docs/design/STRUCTURED_EDITOR_WORKSPACE.md` already states that unpurchased
  initial inventory exposes only inventory identity and participation, while
  purchased rows expose acquisition-resolution children.

## Locked model

1. An initial Shop slot may persist a type-only `BlindBoxLoot` inventory
   identity. It does not persist a source, trait offer, acquisition
   disposition, or level child.
2. Selecting `Purchased` for that slot atomically creates one sparse
   room-exit acquisition entry addressed by the purchase slot and places the
   existing Shop purchase action in Room Timeline.
3. The acquisition entry begins unresolved because `BlindBoxLoot` has several
   locally valid sources. Its timeline row owns the eventual source picker,
   hidden-source trait offer, and acquisition dispositions.
4. Source candidates come from the engine's exact acquisition frontier after
   prior room actions. The application must not reconstruct the four-god cap.
5. Clearing `Purchased`, replacing the inventory item, or removing the Shop
   removes the purchase-owned acquisition entry and its nested state
   atomically. Other inventory slots and downstream chronology remain intact.
6. Ordinary `RandomLoot` keeps its source at Shop generation. Payload-free and
   fixed-source purchases keep their current behavior.
7. Travel Deal, Echo Gold, Infernal Contract, Hermes Shrine delivery, and
   Narcissus-produced Mystery Boons retain their existing acquisition-entry
   ownership. The implementation may reuse their common machinery but must not
   rewrite their semantics.

## Delivery gate

Deliver one vertical slice and one atomic implementation commit:

- bump the authored schema once and add the adjacent migration;
- represent initial Shop Mystery Boon inventory separately from its purchased
  acquisition entry;
- update Shop commands, codec, topology cleanup, simulation settlement,
  candidate products, findings, and execution-plan publication at their
  existing ownership boundaries;
- bind the purchased timeline row to the acquisition entry and reuse the
  standard Mystery Boon source/trait editors;
- migrate legacy purchased initial Shop Mystery Boons by moving their complete
  authored reward state to the purchase entry; discard dormant hidden-source
  detail from legacy unpurchased inventory because it never resolves;
- update the stable reward and editor authorities, absorb the durable result
  into implementation progress, and delete this temporary plan at closure.

## Primary verification

- Engine command/codec tests own atomic creation, cleanup, migration, and
  round-trip behavior.
- Shop chronology tests own source resolution after preceding purchases, the
  four-source cap, and no source validation for an unpurchased box.
- Structured-workspace/UI tests own type-only inventory authoring, timeline
  source resolution, exact-field findings, repair of a retained invalid source,
  and purchase removal.
- Existing Hermes Shrine, Narcissus, Travel Deal, Echo Gold, and execution-plan
  witnesses must remain unchanged except for schema/fixture migration.
- Run `npm run test:changed`, the relevant engine and UI lanes, typecheck,
  lint, format check, and one complete `npm run check` at closure.

## Non-goals

- No Shop reroll modeling.
- No new source-support policy.
- No editor-side god-pool calculation.
- No change to ordinary Shop Boons or Mystery Boons already owned by
  acquisition entries.
