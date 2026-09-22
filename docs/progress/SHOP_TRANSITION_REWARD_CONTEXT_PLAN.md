# World Shop Transition Reward Context

Status: approved and locked; implementation not started.
Base: `e4247644`.

## Objective

Reject an ordinary World Shop Spell Drop when the door batch leading into
that Shop already offered Spell Drop, including an unchosen door. Inventory
validation and the contextual picker must agree, and the exclusion must not
persist into unrelated later inventory generation.

This is a planner correctness change. No authored schema or execution protocol
bump, executor change, new mismatch, or UI-specific policy is required.

## Evidence and Existing Seam

Native source root: `/home/ayyatma/wsl-projects/modding/1GameData/Scripts`.

- `StoreData.lua`, ordinary `WorldShop` SpellDrop entry: requires
  `MapState.OfferedRewards.SpellDrop` to be absent, in addition to its other
  requirements. Do not generalize this to every Spell Drop producer.
- `RoomLogic.lua:4013`: outgoing generation rebuilds `MapState.OfferedRewards`
  from all offered exit rooms, including their cage rewards; selection is not
  the filter.
- `RoomLogic.lua:4394`: after changing `CurrentRoom` to the selected next room,
  `RunShopGeneration` runs before the next map is loaded. The previous map's
  offered-reward set is therefore still the relevant contact.
- Map initialization clears `MapState`. Later inventory generation must read
  the newly reached map state, not inherit the preceding transition forever.
- `StoreLogic.lua:436` owns initial shop generation; dynamic refills are a
  separate generation contact. Recheck their exact native timing during Gate A.

The observed G preboss case offered Spell Drop on the unchosen free-reward
door and authored Spell Drop in the chosen Shop. Native inventory generation
failed that slot and the executor fell back to native inventory. The log proves
the missing Spell Drop; the source explains this exclusion.

Current implementation:

- `simulation/state/model.ts` carries authoritative branch state.
- `simulation/state/reward-lookups.ts` implements persistent Hub lookup union.
  That lifetime is wrong for this transient map fact; do not reuse its union
  transition or turn this into a permanent run ban.
- `simulation/rewards/facts.ts` adapts exact state and contact into kernel facts.
- `simulation/rewards/shop/inventory.ts` and its candidate consumers already
  share inventory support evaluation.
- Catalog `declarations/rewards/requirements.ts` and `shops.ts` own option rules.
- The existing World Shop lifecycle already places inventory generation before
  room entry and before the Shop's own outgoing generation. Preserve that order.

Authorities: `SIMULATION_AND_VALIDATION.md` (chronology, state, candidates),
`ROOM_LIFECYCLE_MODEL.md` (World Shop, generation and entry), and
`REWARD_MODEL.md` (Shops and persistent Hub lookup), all under `docs/design/`.

## Accepted Shape and Guardrails

1. Represent the current map's offered reward set as a narrow immutable
   simulation fact, unless an existing exact history product already supplies
   it without reconstructing policy. Choose one authority, not parallel paths.
2. Publish/replace it after the complete outgoing batch is generated. Include
   unselected offered targets and native-equivalent cage reward identities.
   Do not read future authored doors or partially assessed siblings.
3. Initial next-room inventory consumes that transition snapshot. Room entry
   clears the preceding map fact; the current room's completed outgoing batch
   may then replace it. Empty batches must not retain stale values.
4. Dynamic inventory, including Travel Deal, consumes its own reached contact.
   It must not borrow the initial Shop snapshot. In particular, a Shop's own
   outgoing Spell Drop may constrain a later refill even though it could not
   constrain that Shop's initial inventory.
5. Add the requirement only to source-confirmed inventory entries. Preserve
   persistent Hub exclusions, acquired/pending Hex checks, and producer-specific
   rules independently. No G/preboss/SpellDrop conditional in the lifecycle fold.
6. Use the same facts for selected validation and alternative candidates. Keep
   invalid inventory authorable and repairable through existing findings.

No new generic event bus, lookup declaration framework, topology scan in React,
separate candidate simulation, acquisition rule, or inventory fallback change.
Do not migrate unrelated eligibility predicates or rewrite Shop settlement.

## Delivery

### Gate A — Exact context and catalog consumer

Before edits, identify the actual outgoing-batch completion, room-entry reset,
and initial/refill capture symbols. Confirm fixed links, extra exits and Hub
restore timing against native source. If the existing chronology cannot express
these contacts without changing lifecycle order, stop and amend this plan.

Implement the transient product, transition/reset and catalog consumer as one
vertical slice. Update caches or branch equivalence only where the new fact is
consumed; do not add a second eligibility path. Keep schema/protocol unchanged.

Primary tests belong to the engine inventory/generation neighborhood, notably
`test/simulation/shop-inventory-generation.test.ts`; catalog tests own the
producer inclusion/exclusion matrix. Required cases:

- Unchosen Spell Drop door blocks the immediate ordinary Shop Spell Drop.
- A different sibling reward leaves it supported, subject to existing rules.
- Removing/changing that sibling restores support after a normal rebuild.
- Initial inventory does not observe the Shop's future outgoing batch.
- A subsequent map does not inherit stale offered rewards; fixed-link and
  inserted-room transitions retain their actual native reset semantics.
- Travel Deal reads the current contact, with both cleared predecessor offers
  and newly generated current-room offers represented.
- Persistent Hub exclusion still survives map resets independently.
- Shrine and I/Q Shop entries are not newly restricted without source evidence.

### Gate B — Product witness, review and closure

Add one real authored split witness through supported commands and production
simulation/candidate APIs, in the cheapest biome whose fixtures express the
shape with a covered, non-terminal Shop. Assert the inventory finding and picker
unavailability, then replace the sibling reward and verify repair. Keep the
complete policy matrix in primary tests rather than duplicating it in React.

Use one executor across adjacent implementation/remediation and one independent
reviewer after the slice stabilizes. Review especially premature reset, stale
inheritance, future-door leakage, and initial-versus-refill context.

Run focused catalog/engine tests during implementation and one full repository
`npm run check` at closure. No fixture regeneration unless its semantic product
actually changes; apply standard generated-fixture formatting if needed.

Promote the source fact into
`docs/audits/rewards-and-acquisition/REWARD_GAME_DATA_AUDIT.md` and revise only
the affected lifecycle/reward explanation if necessary. Remove this temporary
plan at closure; record verification in the closure commit. Do not add a
bug-fix narrative across the documentation set.

## Commit Boundaries

Commit the accepted plan before implementation. Prefer one implementation
commit containing context, consumer and primary tests, followed by closure
only if review/product verification creates a meaningful separate change.
Do not land context-only scaffolding or a catalog rule with fabricated facts.
