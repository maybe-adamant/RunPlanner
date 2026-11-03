# Run Import Checkpoints

Status: started 2026-11-03 after the single-state simulation closed. Temporary
plan; delete at delivery after promoting the durable result.

## Objective

Each recorded room-entry save is ground truth. The importer walks the run room
by room from the engine's one reached state, fixes every fact the record gives
exactly, searches only the remaining in-room choices, and accepts a room only
when the simulated state at the next room's entry matches the next save on a
declared comparison set. It never manufactures an outcome: a room no choice set
reproduces is reported with its nearest miss and the plan stops there.

## Settled conclusions

1. Door order is exact. The catalog declares every multi-exit room's door
   setup order and the engine's shared Lua table emulation yields the native
   order for the open set; door-order assumptions are 0 across the corpus.
2. Offer history is recoverable: the saved `LootTypeHistory` equals the summed
   use record the run record already carries.
3. Not saved, so true unknowns: the unpicked wheel god, pre-reroll options,
   reroll press targets and order, shop purchase order, Sea Star duplicates,
   untaken-door cage gods, Aetos/Gorgon phase, collected optional points.
4. A per-room comparison already exists (`conformance.ts`, ~14 fact families)
   but only reports after the walk; four importer-local solvers already search
   for a saved-state fit (wheels, bracket reroll draws, max-health roll, pool
   spend). The work is to promote the comparison to the walk's acceptance test
   and generalize the solvers.
5. Draft is used in two places only (the general `guess()` repairer and the
   Nemesis event guess); both are manufactured outcomes and go.
6. Gold compares as plausibility against the ledger's range, never exactly.

## Work

0. **Measure.** Over every raw run and capture fixture: per room, bucket as
   exact / solved by an existing solver / mismatch / no entry save, with the
   failing fact families; time one room's re-evaluation through the authoring
   session. Output: a committed measurement witness (test support) and a table
   here.
1. **Record extension** (run-import's own model; no authored schema change):
   per-room resources gained and spent, Steady Growth room counter, max Magick,
   next reward store, Fated status, banked Path of Stars points; read the
   remaining-uses the record already carries (Fig Leaf, pending Hermes
   deliveries, Well items). Verify each against a capture.
2. **Per-room acceptance.** Run the comparison as each room is accepted, not
   after the walk; add Hub stays and repeated rooms, which are skipped today.
3. **One bounded search.** Replace the four solvers with one per-room search
   over the remaining unknowns, pinned by markers (trait timestamps, upgrade
   names, use counts) and narrowed by compared facts; equivalent outcomes take
   a canonical choice and are reported as such.
4. **No manufactured outcomes.** Remove the two Draft guesses; run import no
   longer depends on Draft. An unreachable room ends the plan with its nearest
   miss.
5. **Engine room-from-state entry** only if step 0 shows per-room
   re-evaluation is too slow for the search. Owner decision.
6. **Recorded room** (authored outcome replayed as canonical events) only for
   rooms still unreachable after 1–4. Needs owner schema approval; not started
   without it.

## Open

- Dream runs: the post-death hub save renames the room to
  `NameErasedForDreamRun`, failing the record build (raw p3-932 …10530).
  Establish which fields Dream erases before accepting it.
- Steady Growth counter jumped 2 → 5 in one room of run 930; explain before
  using the counter as a pin.
- Owner questions: where an unreachable room leaves the plan (stop, or keep a
  disconnected reference tail); whether equivalent choices are flagged per
  room; which save facts are deliberately outside the comparison set.

## Verification

- `npm run test:run-import` at each slice; the measurement witness before and
  after each slice (buckets may only move toward exact/solved).
- Engine lanes only when the engine changes (step 5).
