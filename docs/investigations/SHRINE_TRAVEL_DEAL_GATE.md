# Shrine Travel Deal gate

Status: open; pending one live probe. Owner direction: probe before deciding,
because the answer can correct the Shrine refill model.

## Question

When must Travel Deal (`RestockBoon`, `FirstPurchaseDiscount`) be held for a
rushed Shrine of Hermes purchase to refill its slot: on entering the room, or
at the moment of the rush?

## Evidence

- Shrine refill check: `SurfaceShopLogic.lua:450` tests
  `not CurrentRoom.FirstSpeedUpPurchase and HasHeroTraitValue("FirstPurchaseDiscount")`
  when the rush happens. `FirstSpeedUpPurchase` is set only inside that branch
  (`:473`), so a rush without the trait does not spend the opportunity. Read
  literally, gaining the trait in the room before a later rush would refill.
- World Shop: every purchase sets the room's shared `FirstPurchase`
  (`StoreLogic.lua:356`; the Shrine sets the same flag at
  `SurfaceShopLogic.lua:356`). In a shop room the trait can only be gained by
  buying it, which spends the first purchase, so World Shop Travel Deal works
  only when the trait is held on entry. The planner models this as
  `travelActiveAtEntry` (`rewards/shop/settlement.ts:170-172`).
- Owner's in-game experience: entering a Shrine or shop room without Travel
  Deal means Travel Deal does not work there.
- Planner Shrine gate today: Travel Deal held on every branch at Shrine
  scheduling, after the room's other actions
  (`encounter-acquisition/acquisition-point-reached.ts`, refill block). That
  accepts a trait gained in the room before scheduling.

The two readings differ only when Travel Deal comes from a non-purchase source
in the same Shrine room before the rush.

## Probe

Setup: a Surface run without Travel Deal on entering an O or P combat room that
has a Shrine and whose room reward is a Hermes boon offering Travel Deal.

1. Clear the room, take the Hermes reward and select Travel Deal.
2. Open the Shrine, buy slot 1 and rush it.
3. Observe whether the vacated slot 1 refills with a new item.

Variant: in a similar room, rush one purchase before taking the reward, then
take Travel Deal, then rush a second purchase. Observe whether the second rush
refills.

Control: hold Travel Deal on entry and rush; the slot refills.

## Disposition by outcome

- **Refill in step 3 (and in the variant's second rush):** the gate is "held at
  the rush". The planner checks the trait at the rushed purchase's timeline
  position, which requires the authored purchase order of the proposed Shrine
  purchase actions.
- **No refill:** the gate is "held on entry". Align the Shrine with the World
  Shop's entry check; the current scheduling-time check over-permits and is
  corrected.

Promote the result to
`docs/audits/rewards-and-acquisition/ACQUISITION_DELIVERY_AND_ROOM_SETTLEMENT.md`
and delete this note.
