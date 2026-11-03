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

   **Result (2026-11-03).** The walk judges each room as coverage first reaches
   its next entry save, and the report's `rooms` holds every room's final
   verdict: _accepted_, _mismatch_ (introduced and carried differences, with
   families) or _unchecked_ (reason), plus the verdict at reach where later
   authoring changed it. The walk's context exposes the judgement, so a probe
   can test a room's candidate authoring against the next save. Hub stays
   compare at the engine's Hub departure snapshots (a new engine query), a
   main room's first visit at its own exit; a restored room's later departure
   captures no state and stays unchecked, and elements stay unchecked where
   the entered room publishes no entry state (Hub stay, restored room, Ship
   room). The bracket solvers read the same entry moments. Only the wheel
   solver changed a choice rule (an accepted fit goes first); no fixture or raw
   room moved by it. Unreachable rooms do not stop the plan yet.

   | Run                | Rooms   | Exact | Solved | Guessed (order only) | Mismatch | Carried | Unchecked                                 | First mismatch |
   | ------------------ | ------- | ----- | ------ | -------------------- | -------- | ------- | ----------------------------------------- | -------------- |
   | 333 UW             | 41      | 13    | 0      | 8 (4)                | 8        | 7       | 5 (4 unreached past an Anomaly door)      | r25            |
   | 334 Surface        | 49      | 7     | 0      | 0                    | 15       | 26      | 1                                         | r7             |
   | 930 UW             | 41      | 17    | 0      | 11 (2)               | 4        | 8       | 1                                         | r28            |
   | 931 Surface        | 49      | 16    | 0      | 4 (2)                | 18       | 10      | 1                                         | r20            |
   | 932 Dream ×2       | 11 + 40 | –     | –      | –                    | –        | –       | all (Dream route unsupported; both build) | –              |
   | 933 UW (a)         | 41      | 11    | 0      | 6 (1)                | 5        | 18      | 1                                         | r17            |
   | 933 UW (b)         | 41      | 5     | 0      | 4 (1)                | 4        | 27      | 1                                         | r9             |
   | fx surface         | 29      | 15    | 0      | 12 (2)               | 0        | 0       | 2 (1 restored departure)                  | –              |
   | fx surface-victory | 51      | 30    | 0      | 19 (11)              | 0        | 0       | 2 (1 restored departure)                  | –              |
   | fx underworld      | 42      | 15    | 0      | 13 (4)               | 3        | 10      | 1                                         | r28            |
   | fx underworld-1010 | 30      | 17    | 0      | 9 (4)                | 1        | 2       | 1                                         | r26            |
   | fx underworld-live | 42      | –     | –      | –                    | –        | –       | all (no entry saves)                      | –              |
   | **Total**          | 507     | 146   | 0      | 86 (31)              | 58       | 108     | 109                                       |                |

   Over the 414 rooms with entry saves on an importable route: 35% exact,
   21% guessed, 14% mismatch, 26% carried, 4% unchecked (10 last rooms, 4
   unreached, 2 restored departures; was 11%). The 30 Hub stays and repeated
   rooms now compared introduce no difference, so the introduced families are
   unchanged from step 0. Seven rooms, all Shops or a Story room, mismatched
   when first reached and were accepted after the walk's closing action-order
   pass. Import time is unchanged (8–13 s per run).

   **Triage fixes** (first-mismatch triage; buckets as exact / mismatch / carried):

   - Dresses leave the held-trait comparison (armor breaks remove them; every
     corpus removal coincides with `LastBrokenArmorTraitName`). fx underworld
     mismatch 3 → 2; raw 333 mismatch 8 → 7, 933a 5 → 4, 933b 5/4/27 → 19/3/9
     with its first mismatch r9 → r28.
   - Fields cages: an entered room's recorded cages take the first slot order
     the plan draws (slots are draw order; the record keeps opening order,
     and completion follows it), and an untaken door the record cannot
     attribute takes the cages its source room's two entry saves explain,
     kept when the room adds no store difference. The record builder is
     unchanged: no save holds an untaken door's cages, and after a refill
     only the declaration fills the gap. Raw 930 mismatch 4 → 1 (first r28 →
     r29), 933b 19/3/9 → 27/0/0; fixtures unchanged (fx underworld's Bridge
     has twin doors to one room, the taken one not told apart).
   - N side rooms: every visited main room's side slots take the generation
     its saves show, asked or not. Raw 334 7/15/26 → 16/13/15, first mismatch
     r7 → r20; r11's refused `sideDoor2` generation was downstream of r7 (the
     side-room store still held what r7's ungenerated rooms should have
     drawn) and no longer refuses. Fixtures unchanged.
   - Fields optional count: the importer already set it, but read the
     admitted reward types from a local child the catalog no longer
     declares, so a reward collected in combat went uncounted; it now reads
     the room's optional-reward declaration. Raw 930 → 25/0/0; fx
     underworld-1010 mismatch 1 → 0, carried 2 → 0 (bound tightened); fx
     underworld's r30 optional store difference gone.

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
  `NameErasedForDreamRun`; the recorder now reads the original names and
  `DreamCleared`, so the record builds (raw p3-932 …10530). Found (DeathLoopLogic `KillHero` Dream branch): the ending room and its
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
