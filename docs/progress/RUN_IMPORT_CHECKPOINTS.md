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
   - Mystery Boon: a trait pickup entry the plan holds at its default is
     named from its trait's declared pickup, so Narcissus's box is collected,
     and the box opens on the god of the room's otherwise unused screen
     (there was no such answer before; the screen is then consumed). Raw 933a
     11/4/19 → 23/0/0; fixtures unchanged.

3. **One bounded search.** Replace the four solvers with one per-room search
   over the remaining unknowns, pinned by markers (trait timestamps, upgrade
   names, use counts) and narrowed by compared facts; equivalent outcomes take
   a canonical choice and are reported as such.

   **Search** (`room-search.ts`). One room's candidates are authored in
   canonical order on a probe; the room's own questions are answered from
   the record, its actions take their stamped order, and the room is judged
   at its next entry save. The first accepted fit is authored; equally good
   fits of another exit state are reported as alternatives; without an
   accepted fit the solver's earlier rule stands. At most 32 candidates per
   room, a capped search reported as an assumption. A probe now also restores
   the record facts it used.

   - Wheels and Artificer jointly: a ship room's Artificer waits for the
     wheel solve (its other conversions keep their targets and go first), and
     its replacement is one RunProgress draw of the window, searched with
     the unpicked offers. Raw 334 r20 and 931 r20 accepted (first mismatch
     r20 → r21 and r20 → r27; mismatch 13 → 10 and 18 → 9); the fixture conversions
     the save settles lose their assumption entry. Bracket rerolls whose
     stores admit several multisets take the accepted one. Cost over the
     corpus: 13 searches, 1–4 candidates, at most 0.4 s; import time
     unchanged.
   - Twin doors: when a source's doors to the entered room are alike in
     room, reward and god, each is placed as taken and the source judged at
     its next entry save (a candidate's own and created rooms' questions are
     answered until that save is reached); the first accepted twin is taken,
     native order without one, several accepted reported. The corpus has one
     such source, fx underworld's H_Bridge01: the second door in native order
     is taken, so its sibling's cages draw before the refill (r28 accepted,
     first mismatch r28 → r29, buckets 15/2/11 → 16/1/11, bound tightened;
     its pool refusal and cage-screen guesses gone). Cost 2 candidates, 1.1 s.

   **Next-layer fixes** (buckets as exact / guessed / mismatch / carried):

   - Anomaly doors: a door to an Anomaly map is a G target the game swapped,
     so it is authored as the first G room the engine admits there (no save
     names the displaced room, reported as an assumption per door) and
     switched to the recorded map as it is placed; the entered map's
     challenge failed when its reward has no pickup use. Raw 333
     13/8/7/8 → 17/11/4/8, first mismatch r25 → r28; r21–24 reached and
     accepted. Fixtures unchanged (none crosses an Anomaly).

   - Hidden gods: a box's god prefers a giver of the room's screens that no
     answer has taken and no other box of the room already opened on, so two
     Shrine boxes delivered to one room open on its two screens' gods (both
     took the first named god in catalog order, leaving a screen unused and
     the ship's wheel search without an accepted fit). Raw 334 16/5/10/17 →
     33/14/1/0, first mismatch r21 → r47. Fixtures unchanged.

   - Phial fountains: a fountain room's one recorded rarity rise is the
     fountain's (fountain rooms hold no encounter, so Steady Growth cannot
     fire there). It times the fountain, so a rack that equipped the Phial
     goes first and the fountain's question is asked, and Steady Growth no
     longer takes it: raw 931's r27 rise had gone to Steady Growth's fifth
     cycle, which then refused the fountain's own answer and missed r32's
     rise. Raw 931 19/8/9/12 → 26/11/4/7, first mismatch r27 → r37.
     Fixtures unchanged.

   - Fields optional pickups: an optional reward the record collected (picked
     up after combat, or shown only by the room's uses) is picked up once its
     slot holds a reward; before, the walk drew it but never collected it, so
     fx underworld's r29 Minor Talent bought no Path of Stars node. Fx
     underworld 16/13/1/11 → 23/18/0/0 (bound tightened, its last mismatch
     gone). Raws unchanged.
   - Engine (E): commands validate a room's biome membership only where they
     choose an ordinary room (start, target, Hub slot, Preboss, replacement);
     a room already in the topology is read by name. `CreateTarget` beside an
     Anomaly sibling was refused because it re-checked its siblings' room
     set; Zagreus contract and Chaos siblings had ad-hoc exceptions, now
     gone. The importer's deferred Anomaly switch went with it. Equivalence
     157/157, buckets unchanged.
   - Unseen Fields rolls: a source whose doors show no cage count (a
     MiniBoss's lone Bridge door) takes a provisional roll; when a later
     source's recorded roll is supported only with that roll the other way
     (each Max counts toward the biome's two-Max ceiling), the earlier roll
     is switched, latest first, and reported. Raw 333's Bridge rolled Min at
     depth 4 because r26 and r27 had both rolled Max; the plan's r27 Min made
     Max required there, refused the recorded Min and drew a third cage per
     door. Raw 333 17/11/4/8 → 17/13/2/8, first mismatch r28 → r30.
     Fixtures unchanged.
   - Shop rooms (R): every room rolls the Well and Shrine chances, so the
     recorder now keeps a Shop room's stock as its World Shop even when the
     Shrine chance succeeded, as it already did for the Well. Raw 334's
     Typhon shop had been recorded as a Shrine, its presence refused and its
     six offers guessed, so the Mystery box was never bought. Raw 334
     33/14/1/0 → 34/14/0/0, no mismatch left. Fixtures unchanged.
   - Travel Deal refill beside a box: a box now opens on the giver of the
     room's earliest unclaimed screen (record order), and the refill's god
     reads the god the box was answered with before falling back to the
     first screen. Raw 931's Preboss box had opened on Ares (catalog order)
     while the refill assumed the box took the first (Hera) screen, so both
     were Ares and the Hera screen went unanswered. Raw 931 26/11/4/7 →
     32/14/2/0, first mismatch r37 → r46. Fixture underworld-live's H Preboss
     box now opens on its screen's god: four screen refusals and a Pool
     refusal gone (bound tightened).
   - Shop purchase order (I): the record keeps purchases in slot order, so
     Echo's duplicate (the first paid purchase's) doubled whichever slot came
     first. A purchase whose giver's screen picked a stamped trait now goes
     in its giver's earliest stamp order; unstamped purchases keep their
     positions. Raw 333's Preboss bought its Hammer before the Hera boon, and
     Echo had doubled the boon, guessing a Hera screen and leaving the second
     Hammer screen unused. Raw 333 17/13/2/8 → 23/17/0/0, no mismatch left.
     Fixtures unchanged.
   - Triple Pom (I): its level-up screen (`StackUpgradeTriple`) was not read
     as a Pom screen, so raw 931's r46 level-up took the first eligible
     target. Raw 931 32/14/2/0 → 33/14/1/0, first mismatch r46 → r47.
     Neither 931 r46/r47 nor 333 r30 involved a challenge switch (see Open).
   - Bought Travel Deal refill and blind box (I): a bought refill is an
     ordinary purchase once restocked, so it goes before the first later
     purchase its giver's screen stamp precedes (never before the purchase
     that restocked it), and a blind box takes the earliest stamp of a giver
     no purchase names; level-up screens stamp the trait they raised. Raw
     931's Q_PreBoss01 bought the box and the Ares refill (1844, 1849)
     before the Big Pom (1853), whose screen offered the refill's boon; the
     refill had been appended last, so the Pom's recorded answer was refused
     and its target guessed. Raw 931 33/14/1/0 → 33/15/0/0, no mismatch
     left. Fixtures unchanged.
   - Store roll behind a forced-store door (I): a door to a room that
     forces its store (F_Combat01 `ForcedRewardStore = "RunProgress"`)
     overrides the batch's roll for every door (`DoUnlockRoomExits`), so the
     doors do not show the roll. Where no supported store holds the doors'
     rewards, the roll is the one store the engine supports (raw 1012
     Chaos_05: the save's `NextRewardStoreName` is MetaProgress, ratio 0/2).
     A door's reward is judged only once every door of its batch is placed,
     since a later door's room may force the store. Raw 1012's r1 no longer
     needs a guess. Fixtures unchanged.
   - Echo's last-reward replay (I): the engine fixes the replayed reward
     and asks its trait offer, but the pickup entry itself was never
     authored, so the screen's answer was refused and the walk stopped (the
     Draft guess could not settle it either). The entry now takes the
     engine's fixed reward with the screen's answer. Raw 1012 stopped at
     r28 → complete; its first mismatch is r29 (below).
   - Conversions that share a solver's store (owner request). An Artificer
     replacement is one `RunProgress` draw, so it is searched with any solver
     reading that store across the same save window:
     - Ship rooms: the wheel solve (above).
     - Fields rooms: the untaken doors' cage solve. A Fields room converts
       its pickups the uses do not show (in practice a Meta optional reward;
       cages hold `RunProgress` rewards, which Artificer cannot convert); its
       Artificer waits while a door the record gives no cages for remains,
       and that solve, now a room search, draws the cages and the
       replacement together, judged at the next entry save. The window's
       known draws now include the source's recorded door rewards (a
       MiniBoss door's boon), without which no bracket balanced.
     - Bracket rerolls in a room whose room reward converts: the placed
       replacement is one more draw of the bracket, added back to the loss,
       and each multiset is tried with each of its run-store draws as the
       replacement (re-pinned) and the rest as presses; the first fit the
       next entry save accepts is kept. Before, the replacement the room's
       uses named first stood, and the press solve then found no balanced
       bracket. Ship rooms join through the wheel solve and Fields rooms
       through the cage solve. No corpus room has both; synthetic witness:
       the 1010 capture's F_Combat22 with The Enchantress, a door press and
       a misleading Max Health use (`import-rerolls`). Corpus unchanged.
     - Shops (own stores, purchases never convert) and N side rooms
       (`SubRoomRewards`) share no store with a replacement.
       Synthetic witness: the 1010 capture's first Fields room converting its
       Bone optional (F_Combat22's use moved there, its Nectar then raising
       its one boon a level, the unspent use and undrawn Magick carried in
       the saves between); it fails without the join. Corpus buckets
       unchanged.

4. **No manufactured outcomes.** Remove the two Draft guesses; run import no
   longer depends on Draft. An unreachable room ends the plan with its nearest
   miss.

   **Result (2026-11-03).** The Draft repairer and the Nemesis guess are gone,
   with run import's dependency on Draft (the repairer is deleted from Draft;
   ESLint and the package boundary test forbid the edge). A question the
   record does not answer takes, by `open-questions.ts`, the first
   engine-legal answer whose room the next entry save accepts (each candidate
   authored on a probe, the walk's sweep and the room's later questions
   answered until that save is reached); other accepted answers are reported
   as alternatives. Domains: a Shop slot's or refill's options, a Fields cage
   roll, a batch store, a fountain, Steady Growth or random level-up target, a
   Fields point, and Nemesis's family and interaction. Without an accepted
   answer the question stays open and the plan stops there; rooms before a
   stop still take their stamped action order, and a stop past the record
   judges every recorded room.

   Stops (raw and fixtures; bucket bounds unchanged, the fixtures' rooms move
   only to unchecked where the record ends):
   - Last room, no next save: raw 930 r40 (exit target), raw 1010 and fx
     underworld-1010 r29 (Fields point). Buckets unchanged.
   - Past the record: fx surface's O_PostBoss01 Shrine stock. Buckets
     unchanged.
   - No entry saves at all: fx underworld-live and record 1008 stop at r27
     H_Combat07's unseen cage roll (its Unseen Sigil is not modelled either).
     Every room was already unchecked; fixture tests lost I_MiniBoss02's pick,
     the I Preboss pedestal and Steady Growth's second cycle (the Echo Pom
     target keeps its witness by authoring the roll in the test).
   - Raw 1012 r29 (resolved, I): the untaken H_Bridge01 door's Boon cage
     took Apollo (first god), which a batch's doors never share with r29's
     recorded Apollo cage, so r29's cage was refused and the walk stopped
     (16 unchecked). An untaken door's cages are now a room search: each
     roll order with each offer the engine admits per slot, authored with
     the entered room's questions answered and the walk's sweep (its
     recorded cages, a reroll redrawing a cage), fitting only when the
     entered room holds every recorded cage; the first the source's next
     entry save accepts is kept, other accepted gods reported as
     alternatives (an untaken cage's god leaves no trace; owner), none
     accepted leaves the cages open. Raw 1012 → complete 29/14/0/0.
     RunProgress declares four Boon entries, so a batch holds at most four
     Boon cages; with fewer eligible gods than Boon cages the distinct-god
     rule could be unsatisfiable (not seen). Synthetic fallout: the Travel
     Deal synthetic now renames the boon in its entry saves; the Natural
     Selection refusal synthetic stops at r27's untaken door (r27 is
     deliberately unaccepted).
     Raws 333, 334, 931, 933 a/b, 1010-1330, 1012 and 1013, and fx
     underworld and surface-victory, complete.

   **Patience audit** (a decision group is judged only once every piece
   that can override it is authored):

   - Unrecorded untaken-door cages (changed): the solve pinned the entered
     Fields room's recorded cages inside its author, before that room
     exists, so its fit test was vacuous and no fit could be accepted (fx
     underworld's Bridge sibling: 0 of 2 accepted, first fit taken). It now
     answers the entered room's questions and runs the walk's sweep on the
     probe, fits only when that room holds its recorded cages, and searches
     a boon cage's god as the recorded untaken door does. Fx underworld's
     fits are now accepted (2 of 2); corpus rooms unchanged.
   - Batch door peers: `authorNewGodsFirst` authors every peer bringing a
     new god before a door repeating one, and a door's reward waits for
     every batch door (forced stores); no change. An untaken Trial's god
     order leaves no trace (equivalent, reported).
   - Ship wheels: offers carry no peers (`peers: []`), so an unpicked
     offer's provisional god cannot refuse a pick; the solve replaces it
     after the window closes. No change.
   - Forced rewards: forced Boon draws skip the peer check by design, and
     forced stores are read once every batch door is placed (above). No
     change.
   - Takeover Preboss doors: the batch is created at once, doors paired in
     native order, its rewards answered with every batch door placed. No
     change.
   - Fields rolls: an unseen earlier roll is switched when a later recorded
     roll needs it (above). Entered-room cages take the first slot order
     the plan draws, re-placed on every probe that depends on them. No
     change.
   - Strictness (owner): the remaining canonical-first answers are gone.
     A room search authors only an accepted fit (`chooseRoomFit`), so
     without one a ship's wheel solve reports its store mismatch and
     provisional offers, a bracket's presses beside an Artificer
     replacement stay unplaced, and an untaken door's unrecorded cages stay
     open (the first-eligible `answerUnrecordedCage` is gone; its fill only
     measures a door's cage count on a probe). Tied twin doors without an
     accepted twin, or without a next entry save, leave the source's doors
     open. A Fields optional reward is never natively a boon (game
     `FieldsOptionalRewards` holds none; catalog agrees), so a boon one shows
     came from an Artificer replacement and opens on the god of the room's
     unanswered recorded screen, else stays open. No corpus or fixture room
     moved: every search the corpus runs has an accepted fit.

   **Dream runs** (owner: Chaos is legal on Dream and the engine supports
   it). A Dream record imports on the Dream route: its itinerary is the
   visited biomes, filled to four with the first legal choices of the
   engine's public itinerary assessment, and only the visited ones are
   configured; visited biomes no legal itinerary admits stop the import
   (`unsupportedRoute`). `Dream_Intro`, the record's first room, is the
   native prologue the engine installs as history: it belongs to no biome
   and holds no occurrence, its entry save and the first biome's are both
   compared at the first biome's opening, and the starting reward is the
   first biome room's. `Dream_PostBoss0N` bind to the route's postboss
   links as any PostBoss does. Witnesses: the cleared run (p3-…10530, Q P O
   H) is now a capture fixture (`dream`); its partial first biome stands in
   for the abandoned run. Raw p3-…10294 (G only): complete 6/4/0/0,
   1 unchecked (last room). Raw p3-…10530 stopped at r8 Q_PreBoss01 (8
   exact, 32 unchecked) on a blind box (I, not Dream-specific): the Shop
   sold two Hera boons, one Aphrodite boon and the box, with two screens
   each. The box opened on the earliest unclaimed screen's god (Hera),
   leaving the second Hera purchase without a screen, and kept its slot
   position first, so the Aphrodite pick it took held a Special the Hera
   screen's Common HeraSpecialBoon then had to replace at Rare. A box now
   leaves the screens its room's named boon purchases still need, and its
   stamp is the earliest screen those purchases leave. Raw p3-…10530 →
   complete 20/19/0/0, 1 unchecked (last room); no other corpus room moved.
   PostBoss ordinals and the Chaos room inside P import with no Dream
   special case.

   **Twin doors** (owner rule; study: duplicate door targets). Any of 223
   rooms can be offered twice in one batch. The taken door among doors to
   the entered room is the one offering its reward type, then its god: one
   left is exact (no search, no note). Doors alike in both, or none alike
   (a reward the record lost), are searched at the next entry save: one
   accepted is pinned, several are reported and the first in native order
   taken, none accepted or no next entry state leaves the source's doors
   open and the plan stops. Twins with no reward and no cages leave one
   state either way and take the first in native order silently. A room
   entered without its reward reads the taken twin's, not the first door by
   name. Synthetic witnesses on the surface-victory Q_Combat14 twins and
   the underworld Bridge (`import-twin-doors`); corpus unchanged (every
   corpus twin separates by reward, the Bridge's search accepts).

   **Fresh-profile first attempt.** A new profile's first attempt loads
   `F_Opening01` directly (`StartNewGame`), so no save precedes it: no
   `Hub_PreRun` save, and its first save is the entry save of the second room
   (run count 0, depth 1). The recorder opens the run there and reads the
   opening room's entry from that save's departure record (the room grants
   nothing). `GameState.PrimaryWeaponName` is unset before a kit is ever
   picked, so the record's weapon is optional. The import authors no loadout
   on the Fresh File route, which fixes it. Synthetic witnesses only; no real
   fresh capture yet.

   **Chaos unpicked curses** (owner rule). They matter only under Vow of
   Denial, which bans both into `BannedTraits`. Under Denial the room's two
   banned curses are the unpicked pair, in catalog order, the other order
   reported as the alternative; any other banned count leaves the screen
   open and the plan stops. Without Denial the first legal pair stands
   (inert, noted only as the unsaved durations). The rotating
   unbanned-curse fallback is gone.

   **Purging Pool sales** (owner rule). The Pool stands only in F/G/H
   PostBoss rooms, where no trait can be gained, so every sale shows among
   the room's lost traits. A sale they do not explain leaves its slot open
   and stops the plan (`pool`/`unexplainedSale`); the first-eligible-trait
   fallback is gone. Corpus: never fires.

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
  keeps its `UseRecord` and `Kills`.
- Steady Growth counter jumped 2 → 5 in one room of run 930: explained. Each
  Fields cage encounter ends through `EndEncounterEffects` →
  `CheckChamberTraits`, so a three-cage room credits three (H_Combat02 4 →
  wrap → 1 the same way). The counter is per encounter, not per room.
- Challenge switches (C, unmodelled): Infernal Troves and Unseen Sigils
  (`ObstacleData` `TimeChallengeSwitch_Money`, `PerfectClearChallengeSwitch_Pom`
  / `_MaxHealth`, `EliteChallengeSwitch_Talent` / `_MaxMana`). `CreateRoom`
  rolls `ChallengeChanceSuccess` (base 0.15, F 0.25; 0 in Anomaly, Chaos,
  Dream and some declared rooms); `RoomLogic` places one on a free
  `ChallengeSwitchBase` after the Well, Pool and Shrine take theirs, from
  biome depth 5, at least three rooms after the last, each kind behind its
  world upgrade. Using it after the room clears starts `CurrentRoom.ChallengeEncounter`
  (a Generated `TimeChallenge`/`PerfectClearChallenge`/`EliteChallenge` per
  biome); the reward is gold, a Pom, a max health drop, a Talent or a max
  Magick drop, the Perfect Clear one a consolation prize if hit. A save shows
  the spawned switch as `CurrentRoom.ChallengeSwitch` at entry; a used one
  adds the switch name to the room's `UseRecord` and, later,
  `StartedChallengeEncounter`/`Completed`. The catalog and engine declare
  none of it, so the import reports a room whose uses name a switch
  (`other`, unsupported). The switch's own uses and its pickups
  (`HandleChallengeLoot`: the reward object, or a hit Perfect Clear's
  `RoomRewardConsolationPrize`, and the challenge's 5% `GiftDrop`) are
  left out of the uses the import must explain: no save says which
  dropped, so each absorbs at most one use the plan's pickups leave, in the
  Sea Star and generated-drop count and the Fields optional count (a
  Trove's Nectar was read as an optional collected in combat; synthetic
  witness on fx underworld's H_Combat15). A Fields optional Nectar
  collected in combat beside a used switch is read as the switch's. Corpus: spawned in 14 rooms across 11 raw runs; used in
  only two: raw 1013 r48 Q_Combat09 (Elite, max Magick; the room compares
  exact because no compared fact moves) and the live capture / record 1008
  r27 H_Combat07 (Perfect Clear, max health; no entry saves).
- Open questions stay strict (owner, 2026-11-03), records without entry saves
  included: no canonical-first fallback. Revisit if unsolvable save states
  appear.
- Owner questions: where an unreachable room leaves the plan (stop, or keep a
  disconnected reference tail); whether equivalent choices are flagged per
  room; which save facts are deliberately outside the comparison set.

## Verification

- `npm run test:run-import` at each slice; the measurement witness before and
  after each slice (buckets may only move toward exact/solved).
- Engine lanes only when the engine changes (step 5).
