# Draft Duo Hosts

Status: locked 2026-10-24. Base commit: `ec0b4b377`.

## Objective

A Duo becomes an ordinary member of one god's ordered basket queue. Its timing
comes from the order the player authors, and pacing spreads it like any trait.
Today Duos sit outside every queue, in a shared Duos section, and either god may
offer one once its prerequisites are held.

## Model

1. **Host by choice.** A Duo shows in both of its gods' basket lists. Picking it
   in one list makes that god its host; the other list shows it as taken by the
   host (visible text, not a hover). Only the host offers it.
2. **Queue position.** The Duo sits in the host's queue at its basket position,
   like any trait of that god.
3. **Prerequisites by deferral.** When the host's queue reaches the Duo before
   both prerequisites are held, the walk takes the host's next queued trait and
   returns to the Duo once they are held — the deferral already used for
   element- and rarity-gated traits (`nextQueued`), extended to the Duo's
   held-trait prerequisites. The static `prerequisiteAfter` order refusal does
   not apply to a Duo, since deferral makes it satisfiable.
4. **Cap.** The Duo counts toward its host's traits-per-god cap and no longer
   toward neither god.
5. **Storage.** The draft spec gains an optional `duoHostByTrait` map
   (`traitKey → godKey`). A Duo without an entry is hosted by the first pool god
   (in pool order) that lists it, so existing baskets keep decoding. Minor
   schema revision 98.1 → 98.2, announced; an existing basket whose default
   host's cap is now exceeded is refused like any over-cap basket.
6. **Share codes.** Layout 3 carries the host per Duo; layout 2 codes are
   refused as from an older planner.

## Ownership

- **Planner engine:** spec field, codec, defaults and equality; queues
  (`draftSourceQueues`, `draftCappedGiver`), refusals, budget, schedule,
  steering (`readyDuos` retired in favour of queue membership, `nextQueued`
  deferral), trait offers; share-code layout 3.
- **Planner application:** basket projection (Duo rows in both god sections,
  taken-by state, order numbers and reorder chips for Duos), the shared Duos
  section removed; picking a Duo in a god list sets its host through
  `ReplaceDraftSpec`.

## Gates

0. **Basket mock-up** for owner review: a god section with a hosted Duo in
   order, the other god's section showing it taken, and an unpicked Duo
   available in both.
1. **Engine:** model items 1–6, tests at their owners (the Duo tests that pin
   "outside every queue" and "counts toward neither god" flip), execution
   fixtures' schema-revision edit, equivalence and corpus deltas (Duo-met
   should hold or rise).
2. **Application:** basket UI from the approved mock-up; UI tests.
3. **Closure:** docs (authored model draft spec, draft steering), delete this
   plan.

## Non-goals

- Changing which Duos exist or their prerequisites.
- Letting both gods offer a hosted Duo.
