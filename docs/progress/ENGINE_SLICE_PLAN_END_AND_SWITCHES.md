# Engine Slice: Plan End and Challenge Switches

Status: started 2026-11-03 on branch `engine-slice-plan-end-switches` (from
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
10. **Importer cuts** (owner to confirm): victory → no cut; death or abandon →
    cut at the last settled room (its exit doors recorded), else the room
    before; an entry-mismatch stop → cut before the stopping room; the cut
    room's acceptance is `unchecked` (it has no next-entry save).

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

(Filled as commits land.)

## Equivalence characterization per phase

| Phase | Entries changed | Why               |
| ----- | --------------- | ----------------- |
| P1    | —               | (filled when run) |

## Open decisions for the owner

1. Past-cut content: keep dormant (default) vs refuse vs destroy on set; and
   whether to add "Remove everything after the plan end" later.
2. Marker: route-level `planEnd { biomeKey, occurrenceId }` and one
   `ReplacePlanEnd` command (default) vs two commands.
3. Dangling marker: strict decode plus removal reconciliation (default) vs
   tolerant "absent" like `practiceStart`.
4. Cut at the Postboss/Boss: allowed, as the biome end with later biomes
   dormant (default), or forbidden in favour of route scope.
5. Importer death/abandon cut: at the last settled room (default) vs a new
   "ended at entry" kind that keeps the previous room judged.
6. Importer cut-room acceptance: `unchecked` (default) vs judged on a reduced
   fact set at its exit snapshot.
7. Hub: cuts at side rooms allowed (default); Hub-stay actions after a visit
   can never be the last thing (default).
8. Minor `schemaRevision` 0 → 1 at merge outdates every sent slot (default
   yes).
9. Challenge-switch outcome: optional with a success default (default) vs
   required.
10. Off-spine marker: finding `planEndUnreached` at the route (default) vs
    silently ignoring it.
