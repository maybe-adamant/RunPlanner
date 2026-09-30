# Fresh File — enemy introduction resolution and history

Status: source audit and proposed disposition, 2026-09-29. Not an implementation
plan. This investigation is separate from the concurrent I/J work. Code baseline:
`0bdee5d7`; the live worktree contains Slice I changes, which this audit does not
edit or assume completed.

## Question and conclusion

Can complete authored encounter compositions plus the existing encountered-enemy
history determine Fresh File enemy introductions?

**Not from enemy history alone.** Native selection asks whether an **introduction
encounter completed**, and some H introductions ask whether other introduction
encounters **occurred**. It does not ask whether the enemy has been seen. The
planner already has separate encounter-record and encounter-completion ledgers;
those are the appropriate authorities. The known-enemy set remains useful but
must not substitute for either ledger.

The existing history architecture is sufficient as a foundation, not a finished
introduction resolver. Missing work is declaration coverage, completion queries,
profile-aware resolution, fixed/mixed roster evidence, and explicit handling of
unknown native compositions. The remaining unresolved ordering question is
bounded below; it does not justify a second general save-state simulator.

All source references below are relative to the inspected local game scripts:
`/home/ayyatma/wsl-projects/modding/1GameData/Scripts`.

## Native selection pipeline

| Stage                  | Source                              | Actual rule                                                                                                                                                                                                        | Modeling consequence                                                                                                                                               |
| ---------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Choose encounter       | `RunLogic.lua:1036–1093`            | Filter legal encounter candidates, prefer forced candidates, then set up the chosen declaration.                                                                                                                   | Deterministic F/G/I introductory encounters are distinct from enemy-triggered replacements.                                                                        |
| ForceIntroduction pass | `RunLogic.lua:1079–1089`            | On the ordinary selection path, scan `EnemySet` for `ForceIntroduction` and unfinished intro identities.                                                                                                           | Separate mechanism; no active `ForceIntroduction` declaration was found in the inspected `EnemyData*.lua` files. Do not invent this as the F/G/H trigger.          |
| Generate proposal      | `RunLogic.lua:1099–1122`            | Copy declaration, generate its waves if `Generated`, run setup events.                                                                                                                                             | Replacement is based on the generated spawn descriptors, not the entire eligible pool.                                                                             |
| Resolve introduction   | `RunLogic.lua:1125–1148`            | Unless `SkipIntroEncounterCheck`, scan `SpawnWaves` and `wave.Spawns` with `pairs`. If an enemy has an unfinished `IntroEncounterName` and that intro's `GameStateRequirements` pass, replace the whole encounter. | A roster containing an unintroduced enemy is not enough: the intro itself must qualify.                                                                            |
| Generated replacement  | Same contact                        | Run replacement setup events, generate the replacement, and immediately return if it is `Generated`.                                                                                                               | Scoped F/G/H enemy intros inherit `Generated = true`, including H's entirely fixed rosters. Exactly one wins; replacement is not recursively scanned by this call. |
| Record identity        | `RoomLogic.lua:4376–4388,4453–4462` | Record the returned encounter identity before entering the next room. H cages are chosen and recorded one at a time during this preparation.                                                                       | Later prepared cages see earlier **recorded** identities, not their completions.                                                                                   |
| Complete identity      | `RoomLogic.lua:1921–1927`           | Increment current-run and lifetime completion caches after encounter events finish.                                                                                                                                | Completion is later than preparation and is not inferred from a spawn proposal.                                                                                    |

`HasEncounterBeenCompleted` (`RunLogic.lua:1741–1752`) checks both current-run
and lifetime encounter-completion caches. On Fresh File, lifetime starts empty
but changes during the run. This does not mean all lifetime predicates can be
replaced by a permanent false value.

### Enemy admission happens before replacement

`GenerateEncounter` (`RunLogic.lua:1263–1271`) requires completed introductions
when the room/encounter requests it or `GetBiomeDepth(CurrentRun)` is below the
room's minimum. `BaseRoom.MinDepthBeforeIntros = 3` (`RoomData.lua:648`);
`BaseH.MinDepthBeforeIntros = 0` (`RoomDataH.lua:334`). Keep native depth separate
from biome encounter depth.

`IsEnemyEligible` (`RunLogic.lua:1576–1646`) rejects unfinished-intro types for
`IneligibleIfUncompletedIntroEncounter` or a wave's `RequireCompletedIntro`, and
also checks ordinary enemy requirements, blacklist and composition constraints.
Consequently the preliminary authoring roster cannot freely select every
unintroduced enemy and rely on replacement to legalize it.

The `RequireCompletedIntro` guard filters **added candidates**. A named seed
already present in an intro's wave template is not reselected through that guard;
this allows the introduction's own enemy in its generated suffix while it is
still unfinished. See `FillEnemyTypes`, `RunLogic.lua:1317–1425`.

## Scoped F/G/H/I matrix

Base/elite variants inherit the same intro link unless a declaration overrides
it. Their ordinary eligibility constraints still apply independently. Counts
below describe native fixed spawn descriptors, not general configurable budgets.

| Region / trigger                | Resolved identity  | Additional introduction gate                                                                                        | Resolved wave content                                                                                | Fresh File disposition                                                                                                                                                        |
| ------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Forced second room `F_Combat01` | `FIntroFight`      | Native first-Apollo progression/forced-room conditions                                                              | Four fixed waves: Brawler ×1; Guard ×4; Mage ×3; Brawler ×1 + Guard ×3 + Mage ×1                     | Deterministic first sequence, already Slice H.                                                                                                                                |
| F Radiator / Radiator_Elite     | `RadiatorIntro`    | No local intro requirement beyond unfinished completion and upstream enemy admission                                | W1 Radiator ×5; W2 generated with Radiator seed                                                      | Reachable enemy-triggered introduction.                                                                                                                                       |
| F Screamer / Screamer_Elite     | `ScreamerIntro`    | Same                                                                                                                | W1 Screamer ×2; W2 generated with Screamer seed                                                      | Reachable enemy-triggered introduction.                                                                                                                                       |
| First eligible G combat         | `FishmanIntro`     | `AlwaysForce`; lifetime completion absent                                                                           | W1 FishmanMelee ×1; W2 FishmanMelee ×2 + FishmanRanged ×1; W3 both ×3                                | Deterministic first G sequence, owned by Slice I. Guard2/Radiator2 also link to this identity, not separate introductions.                                                    |
| G FishSwarmerSquad / elite      | `FishSwarmerIntro` | No local intro requirement beyond unfinished completion and upstream enemy admission                                | W1 FishSwarmerSquad ×4; W2 generated with squad seed                                                 | Reachable enemy-triggered introduction. Record native identities deliberately; a squad descriptor is not interchangeable with its spawned child units.                        |
| G Turtle / Turtle_Elite         | `TurtleIntro`      | Ordinary Turtle requires lifetime `RoomCountCache.G_Intro >= 2`; `Turtle_Elite` takes `Elite`'s depth gate instead  | W1 Turtle ×2; W2/W3 generated with Turtle seed                                                       | **Reachable via `Turtle_Elite` at G depth ≥3** (`EnemyData_Turtle.lua:100-102`, `EnemyData.lua:253`, `RunData.lua:1363`); ordinary Turtle is never drawn on a single G entry. |
| H Mourner / elite               | `MournerIntro`     | No prior current-run occurrence of `MournerIntro`                                                                   | W1 Mourner ×2; W2 Mourner ×4 + BrokenHearted ×2; W3 Mourner_Elite ×1                                 | Reachable; all three waves fixed.                                                                                                                                             |
| H Lamia / elite                 | `LamiaIntro`       | No prior current-run occurrence of `LamiaIntro`                                                                     | W1 Lamia ×1 + BrokenHearted ×4; W2 Lamia ×4 + BrokenHearted ×6; W3 Lamia_Elite ×1 + BrokenHearted ×4 | Reachable; all three waves fixed.                                                                                                                                             |
| H Lovesick / elite              | `LovesickIntro`    | No prior current-run occurrence of `LovesickIntro`                                                                  | W1 Lovesick ×2; W2 Lovesick ×4 + BrokenHearted ×5; W3 Lovesick_Elite ×2                              | Reachable; all three waves fixed.                                                                                                                                             |
| H Lycanthrope / elite           | `LycanthropeIntro` | No prior current-run occurrence; lifetime **occurrences** of MournerIntro, LovesickIntro and LamiaIntro all present | W1 Lycanthrope ×1; W2 Lycanthrope ×3; W3 Lycanthrope_Elite ×1                                        | Reachable only after prerequisite records. The ordinary base enemy can appear before those prerequisites; that does not complete its intro.                                   |
| First eligible I combat         | `ClockworkIntro`   | `AlwaysForce`; lifetime completion absent                                                                           | Three fixed waves                                                                                    | Deterministic first I sequence, owned by Slice I. No additional intro links in ordinary BiomeI/BiomeIOptional pools.                                                          |

Declaration evidence: `EncounterData.lua:257–388` and `FIntroFight`;
`EncounterData_Intro.lua:8–168,289–608`;
`EncounterData_Opening.lua:111` onward;
`EnemyData_Radiator.lua:6,118`, `EnemyData_Screamer.lua:7`,
`EnemyData_Guard.lua:127`, `EnemyData_FishSwarmer.lua:157`,
`EnemyData_Turtle.lua:7–15,100–103`, `EnemyData_Mourner.lua:11`,
`EnemyData_Lamia.lua:11`, `EnemyData_Lovesick.lua:14`,
`EnemyData_Lycanthrope.lua:14`; pools in `EnemySets.lua`.

### Boundaries and related consumers

- Guard has no active `GuardIntro` link. SiegeVine/WaterUnit links are commented
  out. Do not offer those intro declarations merely because they exist.
- Vampire is outside the ordinary H cage pool; `MiniBossVampire` sets
  `SkipIntroEncounterCheck` (`EncounterData_MiniBoss.lua:260–288`). Its presence
  does not introduce a supported `VampireIntro` customization path.
- LycanSwarmer links to LycanthropeIntro but is outside `EnemySets.BiomeH`.
  Summoned enemies are not traversed as hypothetical future summons by
  `SetupEncounter`'s initial spawn-table scan.
- `GeneratedH_Screamer2` itself requires **ScreamerIntro completed**, as well as
  depth and once-run conditions (`EncounterData_Generated.lua:373–394`). Its
  Screamer2 seed inherits the Screamer intro link, but that gate already prevents
  unfinished replacement through that seed. Added H types can still trigger H
  intros. `GeneratedH_Treant2` likewise has added H types; do not scope replacement
  only to the default `GeneratedH` identity.
- Delivered: `GeneratedH_Screamer2` requires ScreamerIntro completed on Fresh
  File through `encounterCompletionCount`; mature saves satisfy it.
- Fresh File excludes vows, NPC combat events and cocoons. No Menace-based
  introduction path needs to be invented for this profile.

## Is current history enough?

| Required fact                                      | Existing planner product                                            | Assessment                                                                                                                                                                   |
| -------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A resolved intro has been recorded                 | `HistoryLedgers.encounterRecords`; `projectRouteEncounterKeyCounts` | Exists, with preparation ordering. Fresh lifetime occurrences can use reached route records because initial history is empty.                                                |
| A resolved intro has completed                     | `HistoryLedgers.encounterCompletions`                               | Ledger exists. Expose/use a completion-specific query; the occurrence-count helper is not sufficient. Mature satisfaction is a profile fact, not an invented run completion. |
| Unknown native ordinary roster                     | No exact enemy keys or native replacement identity                  | Cannot support exact downstream intro predictions. Full authored mode cannot mix arbitrary native gaps with claimed complete introduction history.                           |
| H later cage sees earlier prepared intro           | Sequential `encounterRecorded` prefix                               | Correct architecture already exists. Must consume records at preparation, not promote them to completions.                                                                   |
| Prepared cage changes after another cage completes | Existing frozen preparation product                                 | It must **not** change. Only later preparation sees the new completion.                                                                                                      |

Code evidence: `simulation/history/model.ts` (`HistoryLedgers`),
`history/facts.ts` (`projectRouteEncounterKeyCounts`,
`projectRouteEncounterCompletionCounts`), `history/fold.ts`
(`encounterRecorded`, `encounterCompleted`),
`encounters/generation-preparation.ts`, and `encounters/generation.ts`, under
`packages/planner-engine/src/`. Existing lifecycle authority:
`docs/design/ROOM_LIFECYCLE_MODEL.md`, encounter preparation/history section.

### Counterexamples to replacing completion with enemy-seen

1. Lycanthrope appears while its three prerequisite intro occurrences are
   absent. Native keeps the ordinary encounter. After that combat the enemy is
   seen, but LycanthropeIntro is still unfinished and may trigger later.
2. MournerIntro is recorded for cage 1. Cage 2's setup sees its occurrence and
   suppresses another MournerIntro, although cage 1 has not started. A
   completion-only or enemy-seen-only model misses this suppression.
3. The discarded original proposal contains two unintroduced types. Only one
   intro wins. Neither the losing intro nor all discarded enemy types gain
   completion/seen facts merely from the proposal.

## Competition and fixed/mixed generation

Source establishes **first qualifying candidate in actual native traversal** for
the generated replacement family. Both loops use `pairs`; it does not establish
a public alphabetical, click-order, or editor-order precedence. Normal generated
spawn entries are appended with `AddToSpawnTable` (`RunLogic.lua:1463–1466`), but
that alone is not evidence for a cross-runtime traversal guarantee.

Thus the existence of two qualifying types is not an error and does not create
two intro encounters. The local probe below establishes ordered selection for
the inspected dense numeric arrays on Lua 5.2.4, not selection from an unordered
set or a random draw. Embedded-runtime confirmation remains required before
promising that order as the execution contract. Arbitrary user selection among
intros is not automatically legal either: reachability needs proof.

### Local native-function probe, 2026-09-29

Executed the unmodified native `SetupEncounter`, `HasEncounterBeenCompleted`
and `AddToSpawnTable` under local PUC Lua 5.2.4. Loaded encounter declarations
with native inheritance via the existing lifecycle probe's loader and loaded
the actual Radiator/Screamer/Mourner/Lamia/Lovesick/Lycanthrope enemy data.

Generation was deliberately stubbed: it logged each encountered identity and
preserved the supplied proposal so the experiment isolates the post-generation
scan, rather than random enemy generation. Setup events were inert. The
eligibility helper evaluated only the actual intro declarations' boolean
`PathTrue`/`PathFalse` cache requirements. No claim of a full native eligibility
or gameplay harness follows from that stub. Common random helpers were replaced
with error traps; no trap fired.

Each case ran 1,000 times, alternating native append construction and reverse
insertion into the same dense numeric slots. All 10,000 passed:

| Supplied proposal / state                                       | Returned identity |
| --------------------------------------------------------------- | ----------------- |
| W1 Radiator, Screamer                                           | RadiatorIntro     |
| W1 Screamer, Radiator                                           | ScreamerIntro     |
| W1 Screamer; W2 Radiator                                        | ScreamerIntro     |
| W1 Radiator, Screamer; RadiatorIntro completed                  | ScreamerIntro     |
| W1 Mourner, Lamia                                               | MournerIntro      |
| W1 Lamia, Mourner                                               | LamiaIntro        |
| W1 Mourner, Lamia; MournerIntro recorded but not completed      | LamiaIntro        |
| W1 Lycanthrope, Mourner; prerequisites absent                   | MournerIntro      |
| W1 Lycanthrope only; prerequisites absent                       | Original proposal |
| W1 Lycanthrope, Mourner; all three prerequisite intros recorded | LycanthropeIntro  |

For every replacement case, generation was called once for the proposal and
once for the winner. No second introduction was generated. Reverse insertion
without changing numeric slot identities did not change the winner; swapping
the slot contents did. Repetition is a stability observation on this runtime,
not a statistical proof or a Lua language guarantee.

**Disposition:** there is no evidence here for uniformly random introduction
selection. Ordered waves/types are a viable resolver input on the tested
runtime. Confirm dense-table traversal in the embedded game, with the real
published spawn construction, before locking editor order as native precedence.
The game scripts contain no `pairs` replacement found by the source search;
that does not prove the host has no override. This probe did not run in Hades II.

The generated replacement is generated once and returned, not recursively
replaced. Existing fixed waves retain their counts; generated suffixes keep the
full encounter's native shares. With a fixed first wave, a two-wave profile
generates only the 50% suffix. Any pre-existing waves suppress automatic shared
highlight generation (`RunLogic.lua:1230–1314`). H's three fixed waves fill no
generated suffix despite `Generated = true`.

Existing mixed-generation function probes in `FRESH_FILE_ENCOUNTERS.md` remain
valid as bounded control-flow evidence. They are not live proof of ordering or
installation. FishSwarmer is the primary G live case; `TurtleIntro` (through
`Turtle_Elite`) is a second, three-wave mixed profile.

## Disposition (locked 2026-09-29)

- Identity is settled in the encounter selector: each reachable introduction is
  a set member gated on exact completion/occurrence facts from the existing
  ledgers, not inferred enemy-seen booleans. Customize edits only a settled
  identity; fixed waves are read-only and mixed profiles own their suffix.
- The ordinary identity's type domain excludes a type only where its
  introduction would trigger here (its gate passes at this room); native
  admission applies independently, and an introduction's suffix follows the
  same rules except its own seed. A member needs its gate and an admissible
  trigger enemy. Competing
  introductions therefore never occur in authored mode; traversal order is a
  live diagnostic, not a contract.
- On `FreshFile` customization is required on every generated phase and mixed
  suffix, so introduction history is exact for the route; native mode is not
  publishable there.
- Eligibility consumers of intro completion (`GeneratedH_Screamer2`) gain the
  native predicate. H cage members are evaluated in cage-preparation order
  against recorded identities.
- The known-encountered-enemy ledger (Gate E) is retired; no duplicate history
  ledger. Narrow queries extend the canonical ledgers.

This audit performed source/code inspection and the bounded local-function
probe above, not live game testing. Embedded-runtime ordering confirmation and
mixed-profile installation acceptance remain open as live diagnostics.
