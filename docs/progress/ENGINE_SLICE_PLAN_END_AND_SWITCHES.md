# Engine Slice: Plan End and Challenge Switches

Status: P1, P3 and P2 delivered; started 2026-11-03 on branch `engine-slice-plan-end-switches` (from
main `606f8e588`). Temporary plan; delete at delivery after promoting the
durable result into the design documents named per phase.

## Objective

One combined slice, one minor `schemaRevision` bump at merge:

- **A. End plan here.** A plan may end after any settled room, not only at a
  biome boundary. Nothing past the end is authored, assessed or published, and
  the run import can say "this run ended here".
- **B. Challenge switches.** The optional room objects (Time, PerfectClear,
  Elite) become authorable observations with their encounter, start and claim
  actions and their outcome; the import authors a used switch instead of
  reporting it as an unsupported area.
- **C. Plan-wire additions.** A planner-published room-exit reward-store
  conformance fact, and each Fields cage roll's published Min/Max outcome.
- **D. Fields/Hub god fallback witness** past exhaustion.

## Owner instructions for the slice (2026-11-03)

- Game-module parts of A–C wait until branch `game-module-cage-draw` (native
  cage and wheel draws) merges to main; they are the last phase (P7).
- Hold every fixture regeneration, equivalence re-record and Draft-corpus
  re-record until the slice is ready to merge. During phases, equivalence runs
  only to characterize: each phase records here which entries it changes and
  why; the single regeneration happens at merge (P6), together with the
  execution fixtures and the `schemaRevision` bump.
- The owner answers the [open decisions](#open-decisions-for-the-owner); until
  then the defaults below stand.

## Settled facts and evidence

The studies live outside the repository
(`~/run-planner-investigations/`); the evidence the slice depends on is copied
here. Game script paths are under `Hades II/Content/Scripts`.

### A. Plan end (study `PLAN_END.md`)

1. A plan already ends, but only at a biome boundary: the route is a
   contiguous configured prefix, and status is `valid` only when every
   configured biome is complete-valid (`eligibleForExecutionPlan` =
   complete-valid prefix length equals configured count). Publication gates on
   that flag.
2. The game module already ends at "no next occurrence": `routeSession.enter`
   with `expected == nil` sets `configured-prefix-complete`, and the wire's
   `doors: {kind:'terminal'}` already means "the native doors beyond are not
   part of the plan". The release point needs no new wire key; what changes is
   what the decoder and graph validator accept (a terminal room that is not a
   biome completion room, a partial Hub block).
3. Preboss → Boss → Postboss is a structural, always-materialized chain. A cut
   stops evaluation; the chain stays intact and its unreached part dormant.
4. The engine has the pieces of a "room settled, no outgoing doors" lifecycle:
   a progressive frontier whose outgoing decision has no targets composes the
   room through its post-doors-open actions and stops before commit.
5. `practiceStart` is the symmetric precedent: a route-level optional field set
   by one command, cleared with its biome, eligibility as an engine query.

### B. Challenge switches (study `CHALLENGE_SWITCHES.md`, corrected)

1. Three types, five variants: `TimeChallengeSwitch_Money` (gold);
   `PerfectClearChallengeSwitch_Pom` (`StackUpgrade`, needs an upgradable
   trait) and `_MaxHealth`; `EliteChallengeSwitch_Talent` (Path of Stars,
   needs `TalentLegal`) and `_MaxMana`. Draw weights Time 4; PerfectClear 3 Pom
   - 1 MaxHealth; Elite 5 Talent + 2 MaxMana, over the variants eligible at the
     time (ObstacleData.lua:3040–3274, EncounterSets.lua:760–790).
2. Existence, type, variant, encounter, its generated roster and its
   `MoneyDropStore` are all rolled at room **entry** (`HandleSecretSpawns`,
   RoomLogic.lua:4870–4995), confirmed by save 1013. The chance flag is rolled
   at room creation: base 0.15, Fields-era F rooms 0.25, 0 on special rooms.
3. Spawn needs a free `ChallengeSwitchBase` anchor after the secret door,
   Well, Pool and Surface shop took theirs; no active bounty;
   `BiomeDepthCache >= 5`; at least 3 rooms since the last switch
   (`LastChallengeDepth`, set at entry); Elite also biome depth ≥ 3. The
   world-upgrade unlocks are profile progression, outside the model.
4. The switch is usable only once the doors open (`DoUnlockRoomExits` sets
   `ReadyToUse`; `RandomSynchronize()` runs first, so switch RNG does not shift
   the modeled door draws). Use 1 starts the already-built encounter; use 2
   claims.
5. Outcome at claim (`HandleChallengeLoot`, EventLogic.lua:507–575):
   PerfectClear hit → `RoomRewardConsolationPrize` (the Onion); Time → gold,
   100 for 8 s then falling to a floor of 10, times the money multiplier
   (approximate, never exact); Elite → no fail state. A clean clear also rolls
   a 5% bonus Nectar (`GiftDrop`) with its random +1 level target. The reward
   is spawned directly: no counted store draw, no offer history.
6. Not an encounter end: the challenge encounter is neither the room's
   encounter nor an override, so no Steady Growth tick, trait uses, keepsake
   advance or Experimental Hammer decay; it is recorded in the encounter
   caches.
7. Sea Star duplicates apply to the consumable rewards (Pom, Max Health,
   Max Magick, Path of Stars, Onion), not to Time's gold gush.
8. Corpus: 14 switch rooms in 11 save folders; one triggered (1013, Elite
   MaxMana). Hit and Time-gold outcomes rest on source only.

### C. Plan-wire items (studies `ROUND_TRIP_1014_1016.md`, `GAME_MODULE_DRAW_REVIEW.md`)

1. Store divergence (1014–1016: cage rewards realized without the RunProgress
   draw) is invisible in game: no conformance fact covers store contents. The
   import's `storeCounts` (run-import `conformance.ts`) already compares
   stores, leaving out entries declared for another route (the game's fill
   keeps them, the simulation does not).
2. Fields Max/Min clamp: real rooms declare `MaxCageRewards = 2`
   (RoomDataH.lua:2182), so a clamped Max equals Min. The module, knowing only
   the count, takes Min while the engine counts Max; `FieldsMaxDoorsRolled`
   then lags and the import reads "min" for a plan that said "max". Publishing
   each cage roll's Min/Max outcome makes the steering exact.

### D. Fields/Hub god fallback (study `FIELDS_CAGE_GODS.md`)

Game: per-batch Boon gods exclude every earlier Boon of the batch; when the
eligible pool empties the game retries `ChooseLoot()` with no exclusions, which
can repeat a god already shown and exceed the cap. The engine's
`ordinaryPeerSupport` falls back to `ordinaryBaseSupport` the same way. Witness
to add: a Fields batch at the 4-god cap with 5–6 Boons; cages 1–4 the four
acquired gods, cage 5 a repeat is accepted; a repeat at cage 4 while an unshown
acquired god remains is refused. Same for the Ephyra board.

## Decisions (defaults; "owner to confirm" where marked)

### Plan end

1. **Marker** (owner to confirm): route-level optional
   `planEnd: { biomeKey, occurrenceId }`, the Practice-start pattern. Occurrence
   IDs are the persisted topology identity; a Hub visit's end is its last
   entered occurrence, so no visit ordinal is stored.
2. **Command** (owner to confirm): one `ReplacePlanEnd { route, planEnd | null }`;
   null clears, an equal value keeps identity, a malformed value is refused,
   one history step per effective edit. The UI's "End plan here" and "Remove
   plan end" bind to it.
3. **Decode** (default): strict. The biome must be configured and the
   occurrence must exist in its topology; anything else fails decoding like
   other structural ownership errors. Every command that removes the named
   occurrence or its biome clears the marker in the same step, the way a
   route-owned resource placement is retracted: one route-wide reconciliation
   after every command, plus `ClearTopology` of the marker's biome.
4. **Past-cut content kept dormant** (owner to confirm): rooms authored past a
   new end stay, are not assessed, raise no findings, publish nothing and are
   read-only; removing the end restores them losslessly. No destructive "remove
   everything after the end" command in this slice.
5. **Chain intact** (owner to confirm): Preboss → Boss → Postboss stays
   structural. Cuts are allowed at the Preboss, the Boss and the Postboss. A
   cut at the biome's terminal completion room (the Postboss, or the Boss where
   the route position has no Postboss) is the ordinary biome end with every
   later biome dormant; any other cut ends the biome mid-way.
6. **Hub cuts** (owner to confirm): allowed at a main room (ends that visit
   before its side rooms) and at a side room (ends after that side room). Hub
   actions after the cut (later visits, fountain, board rerolls) are dormant.
   Cuts are rooms, never a Hub action.
7. **Settled meaning** (default): the cut room is assessed through its whole
   Timeline, including the actions after the doors open, but with no outgoing
   door generation, no exit decision and no departure. Its own doors,
   additional exits and door rerolls are dormant. In-flight effects (pending
   Hermes deliveries, Steady Growth/Embryo cycles that would land later, unspent
   rerolls) are simply untracked after the end.
8. **Off-spine marker** (default): a marker naming an occurrence that is not on
   the biome's selected spine is a finding, `planEndUnreached`, owned by the
   route (repair: move or remove the end). The biome is then assessed as if
   unmarked, and the route still stops after it.
9. **Practice start after the end** (default): start-point eligibility gains a
   reason when the start lies past the end (P3).
10. **Importer cuts** (settled, see below): victory → no cut; death or
    abandon → cut at the last fully settled room; an entry-mismatch stop → cut
    before the stopping room; the cut room is judged normally at the next
    room's entry save.

### Challenge switches

11. **Shape** (default): an optional occurrence leaf (absent = none), the
    Eris/Hermes Shrine pattern: an Overview presence checkbox with the variant
    and the entry-time encounter; Timeline actions `startChallengeSwitch` and
    `claimChallengeSwitch` in the doors-open window; the claim carries the
    outcome (PerfectClear hit, Time approximate gold, Elite none, the bonus
    Nectar and its +1 level target). Never steered by the game module; proven
    by resulting state.
12. **Lifecycle** (default): a side encounter that records its encounter caches
    but fires no encounter-end effects; the reward is a direct acquisition with
    no counted store draw; Sea Star applies to the consumables.
13. **Spawn rules as findings** (default): depth ≥ 5, 3-room spacing (a new
    carried run counter), 15%/25%/0 chance (0 refuses presence), anchor
    capacity shared with Well/Pool/Shrine, Elite depth and Talent gates. The
    world-upgrade unlocks are profile facts and are not modeled.
14. **Draft** (default): never authors a switch.

### Plan wire

15. **Store fact** (default): a room-exit `rewardStores` conformance fact the
    planner publishes per comparable store: entries declared for another route
    and Secrets excluded, as `storeCounts` does. Rides the P6 bump.
16. **Cage outcome** (default): each Fields cage roll publishes its Min/Max
    outcome beside the count.

### Process

17. One minor `schemaRevision` bump (0 → 1) at merge (P6), announced in the
    commit; no major bump, no migration. Until then this branch writes
    `planEnd` under revision 0; it is local and never ships before P6.
18. Interim: in P1 a project ended mid-biome is `valid` but not yet
    `eligibleForExecutionPlan` (the canonical truncated product and the wire
    land in P3). A cut at a biome's terminal completion room with no later
    biome configured is identical to an unmarked plan.

## Phases

| Phase | Scope                                                                                                                                                                                                                                                                                          | Lanes                                                                                                                              |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| P1    | Plan end in the authored model: field, strict decode, `ReplacePlanEnd`, removal reconciliation; engine assessment with a cut (completeness, progressive evaluation through the cut room's Timeline, ended biome product, route stop and dormant suffix, authoring horizon, `planEndUnreached`) | engine, catalog if touched, equivalence (characterize: unchanged), draft, run-import, planner (typecheck), typecheck, lint, format |
| P2    | Plan-end editor: engine availability query (settled room, valid prefix, on spine) and the "End plan here" / "Remove plan end" actions on every outgoing kind, rail/timeline end marker, read-only past-end regions with their own hint                                                         | planner, ui, contract, product (representative)                                                                                    |
| P3    | Plan-end execution assembly (truncated canonical product: cut room exit work without departure, `doors: terminal`, extent ending at the cut, partial Hub block), `eligibleForExecutionPlan` through the cut, Practice-start reason, run-import cuts and report `end`                           | engine, equivalence (characterize), run-import, planner                                                                            |
| P4    | Challenge-switch catalog declarations and engine model/lifecycle/findings                                                                                                                                                                                                                      | catalog, engine, equivalence (characterize), draft                                                                                 |
| P5    | Switch editor and importer recognition (replacing the `unsupportedArea` report)                                                                                                                                                                                                                | planner, ui, run-import                                                                                                            |
| P6    | Wire additions (store fact, cage outcome), `schemaRevision` bump, single regeneration of execution fixtures, equivalence and Draft corpus; Fields/Hub fallback witness (D)                                                                                                                     | engine, equivalence, draft-corpus, full `npm run check`                                                                            |
| P7    | Game-module consumption of A–C after `game-module-cage-draw` merges: decoder acceptance of a mid-biome terminal and partial Hub, the switch observation and conformance, store fact, exact cage-count steering                                                                                 | game-module                                                                                                                        |

D's witness is engine-only and may land in any phase; it is listed in P6 so it
travels with the equivalence regeneration if it moves any entry.

## Progress

### P1 — plan end in the engine

Delivered (2026-11-03):

- Authored model: `route.planEnd?: { biomeKey, occurrenceId }`, strict decode
  (configured biome, existing occurrence), `ReplacePlanEnd` (null clears, an
  equal value keeps identity, a dangling value is refused). One route-wide
  reconciliation after every command clears the marker when its occurrence or
  biome is gone, and `ClearTopology` of its biome clears it even though the
  reset start reuses the start occurrence ID. Dream itinerary replacement lists
  the end's biome among the discarded content.
- Engine: `resolveBiomePlanEnd` classifies the end per biome as `terminal`
  (the terminal completion room: the ordinary biome end), `cut` (any other
  structurally entered room) or `unreached` (off the selected spine). A cut
  evaluates an explicit projection of the authored plan that leaves out the
  end room's exit decision, the fixed link it opens and, in a Hub, every
  action after the end's visit and the side rooms after it; it is memoized per
  plan and occurrence so the route cache still hits.
- Completeness takes the optional end and returns `ended` when the walk reaches
  it with nothing missing before it (including inside a selected Preboss's
  chain and inside a Hub stay once its board is open).
- A completion chain stopped before its terminal room publishes that room as a
  no-door outgoing frontier beside its fixed links; history composes the chain
  to it. Every end room settles up to its commit: its Timeline including the
  actions after the doors open, but no commit, exit, departure or door
  generation.
- New biome evaluation `authoring: 'ended'` (`EndedBiomeProjectEvaluation`):
  valid, prefix coverage, the end room's address, no canonical snapshot.
- Route: the walk stops at the end's biome; `processing.afterPlanEnd` lists the
  configured biomes after it. A terminal end keeps its canonical biome in the
  complete-valid prefix. Authoring horizon `{ kind: 'ended', blockedAfter }`:
  the end room stays editable, its own exit and everything after it lock.
- `planEndUnreached` (completeness, route-owned, evidence biome and
  occurrence): status invalid, the biome is assessed unmarked and the route
  still stops there; the horizon stays open.
- App: compile-only adaptations (finding copy, status type, the workspace's
  completeness narrowing, a test literal). No UI behaviour yet.

Lanes (2026-11-03): typecheck, lint, format:check pass; `test:engine`
3904/3904, `test:draft` 164/164, `test:run-import` 342 (+1 skipped),
`test:planner` 2143 (+1 skipped), `test:equivalence` 157/157 unchanged.
Catalog not touched.

Engineering choices made without an owner ruling:

- `ended` is its own authoring kind rather than `complete` with prefix
  coverage, so every consumer that reads a canonical snapshot from a
  complete-valid biome stays exact and the type system names each consumer
  that must learn about ends.
- The end room's exit work (Shop close at exit, resource element grants, the
  `beforeRoomExit` snapshot) is not composed in P1. P3 decides how the
  published end room conforms; a progressive frontier with a post-outgoing
  acquisition point stops at that point, as an unauthored decision does today.
- A Hub visit is atomic: an end at a main room or side room composes that
  visit through its restore to the Hub.
- `eligibleForExecutionPlan` stays false for a mid-biome end or any configured
  biome after the end until P3 publishes them.

What P2 needs:

- An engine availability query for the button (the room is settled — its
  interior complete and valid — the prefix before it valid, and the room on the
  spine), placed with the plan-end neighbourhood, plus the end room's address
  on the route evaluation if the projection needs it beyond the ended biome's
  `planEnd`.
- The workspace's own `evaluateBiomeCompleteness` call
  (`source-index.ts`, `biome-semantic-assembly.ts`) passes no end, so it still
  shows the end room's missing exit as the next frontier; it must pass the
  route's end (or read the evaluation) and treat `ended` as complete.
- Feedback/status projection for `authoring: 'ended'` and for
  `processing.afterPlanEnd` biomes (read-only "past the plan end", not the
  unreached hint), the "Plan ends here" / "Remove plan end" actions on every
  outgoing kind, rail and Hub Timeline markers, and the
  `planEndUnreached` finding's repair destination (the route's end control).
- Witnessed in P1: a route-owned resource placement on a dormant room inside
  the ended biome raises no finding (even one invalid unmarked); P2 should
  present it as inactive rather than hide it.

### P3 — plan-end publication, Practice start, import cuts (before P2)

Ordered by the coordinator ahead of the P2 UI, with the engine query P2 needs.

Delivered (2026-11-03):

- **Availability query** `planEndAvailability(catalog, assembly, room)`
  (`./simulation`, owner `simulation/plan-end-availability.ts`): `available`,
  or unavailable with `notOnRoute` (not on the biome's selected path or biome
  unconfigured) or `notSettled` (the plan ending there would not be valid: the
  room or something before it is incomplete or invalid). It answers by
  evaluating the plan as if it ended there; the biome cache keeps the
  predecessors cheap. First consumer: the run import's cut (below); the app
  binds it in P2.
- **End room exit work.** The end room now settles through commit and exit:
  its outgoing checkpoint generates nothing (`emptyOutgoingGenerationCompleted`)
  and it records no departure. Its Shop close, resource element grants and
  `beforeRoomExit` Run State are therefore published. The progressive frontier
  carries `planEnd` so history composes it this way; the materializer receives
  the end through the biome evaluation context. Supersedes P1's "up to commit".
- **Publication.** An ended biome publishes `snapshot`: its selected structure
  through the end room (the ended prefix as a canonical biome).
  `PublishedBiomeEvaluation` (complete-valid or ended) is what execution
  assembly consumes; `eligibleForExecutionPlan` is true when the route is
  valid through its end. The wire's `extent` ends at the end's biome, the
  selected occurrences end at the end room, whose `doors` are `terminal` (no
  batch or fixed link exists for it), and no later biome is published. A Hub
  ended inside its stay publishes a partial block: no `finalHandoff`,
  `requiredVisitCount` = visits through the end, `fountain` only if used by
  then, and one departure per visit (none after the last). The codec and graph
  validation accept that shape and still require the fountain whenever a final
  handoff is present. No new wire key; the extent and the terminal end room
  carry the end.
- **Practice start:** reason `afterPlanEnd` when the start's biome follows the
  end's, or a Preboss/Boss start lies past the end inside the ended biome.
- **Run import cuts.** Every room is judged first, on the plan the walk built,
  so the end room is judged normally at its next entry save with its doors
  drawn. Then:
  - death or abandonment: the plan ends after the latest record room before
    the last room that the availability query accepts; a question the walk
    could not settle in the last room or past it (the death room, an unseen
    Postboss) is no longer a stop, since the run never settled that room;
  - entry mismatch at room M: the plan ends after the latest acceptable room
    before M; the stop, M's `mismatch` verdict and its entries stay;
  - a question stop before the last room: no cut (the plan stays open at the
    question, as before);
  - victory: no cut.
    The report gains `end: { cause: 'death' | 'abandoned' | 'entryMismatch',
record }`. Room verdicts are unchanged.

Decisions made without an owner ruling:

- Question stops before the last room do not cut: the coordinator listed
  deaths, abandons and entry mismatches, and the owner's settled (6) names
  deaths and abandons. Cutting there would hide an open question behind a
  valid plan.
- An entry mismatch ends before the mismatching room (its exit state is known
  to differ), not at it.
- The end room's own door draws are not simulated, so its `beforeRoomExit`
  Run State lacks them. The import judges the end room on the walk's plan
  before the cut (doors drawn); the game module's end-room conformance must
  not compare stores (P7).
- Hub: a plan ending inside a Hub stay publishes no departure after its last
  visit (the plan does not leave the Hub); P7's module treats the stay's end as
  the plan's end.

Raw measurement (scratch harness copied in, run, removed; 2026-11-03): every
death or abandonment now ends cleanly one room before its last room — 930,
932-0294, 933-1612, 1018, 1010-4329 and both fresh-file raws (0-0272, 0-1339 =
fresh-oceanus) — where 930, 1010-4329 and 0-1339 were `stopped` at their last
room before. 1015/1016/1017 still stop at their r25 entry mismatch and now end
at r24. Victories are unchanged. Room buckets are identical to before (rooms
are judged before the cut). Capture fixtures: `surface`, `underworld-1010` and
`fresh-oceanus` become clean ends; `underworld-live` (no entry saves) still
stops at its r27 question.

Lanes (2026-11-03): typecheck, lint, format:check pass; `test:engine`
3910/3910 (execution fixture bytes unchanged), `test:equivalence` 157/157
unchanged, `test:draft` 164/164, `test:run-import` 342 (+1 skipped),
`test:planner` 2143 (+1 skipped), `test:game-module` 1067/1067 with Luacheck
clean (no game-module change).

Owed at merge (with P6): promote the plan-end contract into the design
documents (Route Scope in `AUTHORED_PROJECT_MODEL.md`, the ended biome and
horizon in `SIMULATION_AND_VALIDATION.md`, departures in
`ROOM_LIFECYCLE_MODEL.md`, the partial Hub block and terminal end room in
`EXECUTION_PROTOCOL.md`, `afterPlanEnd` in `RUN_START_INSTALLATION.md`, the
import's `end` in the run-import documentation), regenerate execution
fixtures, re-record equivalence and bump `schemaRevision`.

### P2 — plan-end editor

Delivered (2026-11-04), planner only:

- **Workspace source.** `evaluateBiomeCompleteness` receives the route's end,
  so an ended biome has no frontier and the end room no "missing exit" next
  step. Each biome source publishes `planEndRelation(room)` (`end` for the
  horizon's end room; `pastEnd` for rooms the ended evaluation does not cover,
  Hub main rooms whose visit follows the end, and every room of an
  `afterPlanEnd` biome) and a lazy, memoized `planEndAvailability(room)` bound
  to the engine query.
- **Products.** Every room workbench carries `planEnd` (relation, availability,
  `endIntent` and `removeIntent`, both `ReplacePlanEnd`); rail stops, Hub
  visits and side visits carry the relation; a Hub the plan ends in carries
  `planEnd: 'end'`; biomes carry `end`/`pastEnd`; the route carries a
  `planEnd` summary (room, biome, `unreached`, remove intent). An end room
  without doors has a new outgoing kind `planEnd`. Resource placements on a
  room past the end are flagged inactive.
- **Actions.** Every door footer (ordinary and frontier batches, fixed exits
  of Preboss, Boss and Postboss, Hub main and side rooms, unentered rooms, the
  Hub's completed exit) has one layout: at the start one contextual action —
  the batch's targeted repair ("Remove unavailable doors" / "Add missing
  Preboss doors") when the projection supplies one, otherwise "Remove these
  doors", never both; at the end "Open next room" and a lavender "End plan
  here", disabled per the query with a hint only for `notSettled`. A fixed exit
  to a room projects that room as its continuation, so Preboss and Boss doors
  also open the next room. The end room hides the way on and the contextual
  action; its footer, outside its locked doors, holds only a lavender
  "Continue planning" (`ReplacePlanEnd` null, one undo step) — the header pill
  and the rail marker say where the plan ends. A room past the end keeps only
  "End plan here" below its read-only doors.
- **Past the end.** Rail stops, completion nodes, Hub visits and map markers
  are dimmed and labelled; the Hub Timeline gets an end row after the end
  visit and its requirement box names the visit. A room past the end stays
  browsable (tabs work) with read-only panels and keeps "End plan here", so
  the end can move later. A biome after the end is labelled, dimmed in the
  navigation and read-only (fields, Clear biome, Hub). A Hub whose stay the
  plan ends in explains its locked visit order with "Remove the plan end to
  change visits." instead of the unreached hint.
- **Route.** The Route panel shows where the plan ends ("Ends in …" status,
  a "Plan ends" row with Open room and Remove plan end). The route-owned
  `planEndUnreached` routes to that row (`presentationPanel: 'route'`) and no
  longer counts against the Loadout.

Lanes (2026-11-04): typecheck, lint, format:check pass; `test:planner`
(incl. `test:ui`) green with new projection and UI witnesses
(`test/projections/structured-workspace/plan-end.test.ts`,
`test/ui/editor/biome/PlanEnd.test.tsx`). Engine untouched. The
owner-approved footer layout followed the same day, on the same lanes.

Engine follow-ups observed (not fixed; planner lane):

- `authoringReadinessAt` with an ended horizon locks the entered side rooms of
  an end visit (settled: an end at a main room includes its side rooms) and
  leaves the main rooms of later Hub visits editable; the editor makes rooms
  past the end read-only itself, but cannot unlock the end visit's side rooms.
- In an ended biome the unpicked sibling targets of the end room's own decision
  (for example `golden-f-b5-e2`) read as locked.
- An ended Hub's action order is not a reached candidate context, so its visit
  order and Reset visits are locked until the end is removed.

Owed at merge (with P6): describe the plan-end editor in
`STRUCTURED_EDITOR_WORKSPACE.md` (actions, past-the-end state, Hub end row)
and `EDITOR_MODEL.md` (route-owned repair on the Route panel).

## Equivalence characterization per phase

| Phase | Entries changed | Why                                                                                                                        |
| ----- | --------------- | -------------------------------------------------------------------------------------------------------------------------- |
| P1    | none (157/157)  | A project without `planEnd` evaluates identically; `processing.afterPlanEnd` is present only when an end applies.          |
| P3    | none (157/157)  | The end room's exit work, the partial Hub block and the ended extent apply only with `planEnd`; no corpus project has one. |
| P2    | not run         | Planner only; no engine change.                                                                                            |

## Owner-settled decisions (2026-11-03)

These supersede the defaults above where they differ.

Plan end:

1. SETTLED: rooms past the end stay, inactive and read-only, so the marker can
   be moved freely (decision 4 above).
2. SETTLED: one route-level marker with a single set/clear command
   (decisions 1–2).
3. SETTLED: deleting the named room clears the marker in the same history step
   (decision 3).
4. SETTLED: cuts are allowed after the Preboss, the Boss and the Postboss; the
   chain stays intact and is inactive past the cut (decision 5).
5. SETTLED: Hub granularity is the end of any main-room visit; repeated
   occurrences do not exist, so a cut can land at an intermediate Hub state.
   Side-room cuts are a nice-to-have, not required. Applied: an end named at a
   main room ends that whole visit, its entered side rooms included; an end at
   a side room still ends after that side room (it costs nothing extra).
6. SETTLED: the importer cuts deaths and abandons at the last fully settled
   room (decision 10).
7. SETTLED: no special "cut room unchecked": the next (death) room's entry save
   exists, so the cut room is judged normally. Decision 10's `unchecked` clause
   is withdrawn.
8. SETTLED: one `schemaRevision` bump for the whole slice (plan end, the
   `rewardStores` fact, the Fields cage Min/Max outcome and switches), done at
   merge (decision 17).

Challenge switches (replace decisions 11–14 where they differ):

9. SETTLED: Overview carries a presence checkbox and the switch type; for
   PerfectClear (hitless) and Elite (big enemy) switches also the encounter,
   its customization and the reward, all rolled at room entry.
10. SETTLED: Time-switch gold defaults to about 90 gold, approximate, a
    plausibility fact only.
11. SETTLED (game code): the bonus Nectar exists for all three switch
    encounters (`TimeChallenge`, `PerfectClear`, `EliteChallenge`: `LootDrops`
    `GiftDrop` with `DropChance` 0.05, spawned only when not
    `PlayerTookDamage`, EventLogic.lua:531–546).
12. SETTLED: Timeline has one interaction action with the switch in the
    doors-open phase, with outcome fields "hitless" (all three types) and, when
    hitless, "Nectar dropped". The outcome creates pickups on the Timeline,
    collected later like any pickup: the PerfectClear reward (or the Onion on a
    hit), the Elite reward, the Time gold, and the Nectar with its random +1
    level target. Sea Star and other pickup effects apply as usual.
13. SETTLED: every Crossroads unlock is owned (mature profile). Switches share
    object slots with Shrines and Wells and use the same placement rule as
    resources: one object takes the only eligible slot.
14. SETTLED: Draft never authors switches.
15. SETTLED (P7): the game module steers the switch's existence, its encounter
    and its reward (hitless and Elite types) and nothing else; end-room
    conformance catches the rest.

Still open: none from the owner. Engineering choices made in P1 without an
owner ruling are listed under P1 below.
