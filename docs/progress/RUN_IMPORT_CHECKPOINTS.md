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

   **Result (2026-11-03).** Witness: `packages/run-import/test/import-room-buckets.test.ts`
   (fixtures; `RUN_IMPORT_MEASURE=1` prints the table, `=rooms` the rooms). Each
   room is judged at its next entry save: _mismatch_ = the room introduced or
   changed a difference, _carried_ = only an earlier one persists.

   | Run                | Rooms   | Exact | Solved | Guessed (order only) | Mismatch | Carried | Unchecked                            | First mismatch |
   | ------------------ | ------- | ----- | ------ | -------------------- | -------- | ------- | ------------------------------------ | -------------- |
   | 333 UW             | 41      | 13    | 0      | 8 (4)                | 8        | 7       | 5 (4 unreached past an Anomaly door) | r25            |
   | 334 Surface        | 49      | 4     | 0      | 0                    | 15       | 22      | 8 (7 Hub/revisit)                    | r7             |
   | 930 UW             | 41      | 17    | 0      | 11 (2)               | 4        | 8       | 1                                    | r28            |
   | 931 Surface        | 49      | 9     | 0      | 4 (2)                | 18       | 10      | 8 (7 Hub/revisit)                    | r20            |
   | 932 Dream ×2       | 11 + 40 | –     | –      | –                    | –        | –       | all (Dream route unsupported)        | –              |
   | 933 UW (a)         | 41      | 11    | 0      | 6 (1)                | 5        | 18      | 1                                    | r17            |
   | 933 UW (b)         | 41      | 5     | 0      | 4 (1)                | 4        | 27      | 1                                    | r9             |
   | fx surface         | 29      | 8     | 0      | 11 (2)               | 0        | 0       | 10                                   | –              |
   | fx surface-victory | 51      | 22    | 0      | 19 (11)              | 0        | 0       | 10                                   | –              |
   | fx underworld      | 42      | 15    | 0      | 13 (4)               | 3        | 10      | 1                                    | r28            |
   | fx underworld-1010 | 30      | 17    | 0      | 9 (4)                | 1        | 2       | 1                                    | r26            |
   | fx underworld-live | 42      | –     | –      | –                    | –        | –       | all (no entry saves)                 | –              |
   | **Total**          | 507     | 121   | 0      | 85 (31)              | 58       | 104     | 139                                  |                |

   Over the 414 rooms with entry saves on an importable route: 29% exact,
   21% guessed, 14% mismatch, 25% carried, 11% unchecked. _Solved_ is empty:
   every room a solver applies to (18: wheels, door/cage rerolls, max-health
   rolls) also carries a guess or a difference.

   Introduced families, by rooms: traits.missing 27, traits.extra 23 (mostly
   together: the plan picked another row or giver), elements 20 (follow the
   traits), stores 18 (`RunProgress` at H_Bridge01 in 4 of 5 Underworld runs,
   `FieldsOptionalRewards`, N `SubRoomRewards`), traits.rarity 14,
   traits.level 7, pathOfStars 3, wheel solver 3, keepsake 1. Guesses by
   rooms: room action order 120, unsupported trait screens 30, conversion
   target 29, trait offer refused/notInRecord/assumed 59, Fields 31, shop 25.

   Timing (authoring session, per run): import 8–12 s; ~350–400 applies at
   median 20–30 ms, p95 45–90 ms, which are 95% of the import; per record
   room, every apply naming it sums to median 180–270 ms, p95 0.5–1.0 s; one
   cold whole-plan evaluation 110–175 ms.

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
  Found (DeathLoopLogic `KillHero` Dream branch): the ending room and its
  encounter are renamed, the originals kept as `OriginalName` /
  `OriginalRoomSetName` / `Encounter.OriginalName`; `BiomesReached`,
  `BossHealthBarRecord`, `EncounterClearStats`, `EncountersCompletedCache`,
  `EncountersOccurredCache`, `EnemyKills`, `ResourcesSpent`, `RoomCountCache`,
  `RoomsEntered`, `SpawnRecord` and run `UseRecord` are emptied; `Cleared` is
  nil (`DreamCleared` holds the clear). The room's own departure record
  keeps its `UseRecord` and `Kills`. The importer refuses Dream routes anyway.
- Steady Growth counter jumped 2 → 5 in one room of run 930: explained. Each
  Fields cage encounter ends through `EndEncounterEffects` →
  `CheckChamberTraits`, so a three-cage room credits three (H_Combat02 4 →
  wrap → 1 the same way). The counter is per encounter, not per room.
- Owner questions: where an unreachable room leaves the plan (stop, or keep a
  disconnected reference tail); whether equivalent choices are flagged per
  room; which save facts are deliberately outside the comparison set.

## Verification

- `npm run test:run-import` at each slice; the measurement witness before and
  after each slice (buckets may only move toward exact/solved).
- Engine lanes only when the engine changes (step 5).
