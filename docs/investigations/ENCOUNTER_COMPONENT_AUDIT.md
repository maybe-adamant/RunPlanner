# Encounter component audit — catalog, engine, planner, game module vs native

Four independent adversarial audits of the delivered encounter component,
run at planner `e42bf61d` against the native scripts and the Plan Executor.
Question: mismodeling, mismatches, undermodeling, or other weakness anywhere
from catalog declarations through the engine and planner to the in-game
installer. This file is temporary pre-plan analysis; delete at disposition.

## Overall verdict

The six-question follow-up below supersedes the corresponding initial findings
and proposed remedies. In particular, unknown active Fangs values are repairable,
application caps are not selection limits, and generation errors propagate.

The core model is faithful. The engine's generation algorithm survived a
line-by-line re-derivation of `GenerateEncounter` / `FillEnemyTypes` /
`FillEnemyCounts` / `IsEnemyEligible` with zero semantic defects, including
the three native quirks easiest to get wrong. The catalog matched on ~700
individually verified composition field/native pairs (all 39 customization
policies, all 114 supported enemy identities, all pools, Fangs, Menace,
depth gates, census). The executor's eligibility emulation is faithful,
leave-native is a true no-op at every hook, and version mismatch degrades
bilaterally to full native.

The defects cluster in three places: the budget fact (the newest addition,
and the one domain with no audit table and no test owner), one planner UI
seam, and the executor's assurance layer (what its tests actually touch).

Baselines at audit time: `test:engine` 168 files / 2187 tests green;
`test:catalog` 34 / 285 green; executor `lua tests/all.lua` 632/632 green,
luacheck clean; all three opt-in native probes pass against the current
scripts (no live drift today).

---

## Tier 1 — game-truth mismodeling and a crash path

### 1. `DifficultyModifier` is absent from the budget model (catalog + schema)

Native: `DifficultyRating = (BaseDifficulty + depth * DepthDifficultyRamp +
DifficultyModifier) * DifficultyMultiplier`, then Hordes, then the minimum
clamp (`RunLogic.lua:1182,1202-1204`). The engine budget schema
(`catalog-schema/encounter-generation.ts:79-86`) has no modifier term, and
`policies.ts` never folds it into `base`. Nine of the thirteen field-NPC
policies understate their native budget:

| Policy          | catalog | native @ min depth | error |
| --------------- | ------: | -----------------: | ----- |
| ArtemisCombatF  |     115 |                175 | −34%  |
| NemesisCombatF  |     115 |                175 | −34%  |
| ArtemisCombatG  |     300 |                445 | −33%  |
| NemesisCombatG  |     300 |                360 | −17%  |
| NemesisCombatH  |     372 |                432 | −14%  |
| NemesisCombatI  |     745 |                805 | −7%   |
| ArtemisCombatN  |     200 |                260 | −23%  |
| HeraclesCombatN |     110 |                260 | −58%  |
| HeraclesCombatO |     115 |                270 | −57%  |

Modifier sources: `EncounterData_Artemis.lua:55,160`,
`EncounterData_Nemesis.lua:57`, `EncounterData_Heracles.lua:64,130`.
Inheritance resolution verified against `RunData.lua:1363-1416`.
`DevotionTest*` (modifier 0), Heracles/Athena P, Icarus, and every
`DifficultyMultiplier` are correct.

Consequence: `totalBudget` feeds `previewFor`, whose counts become
`operands.waves[].counts` — the roster the Plan Executor installs. The
planner clamps authored allocations to a too-small budget, so the exact
native composition is not authorable for these nine encounters; Heracles
N/O are off by more than 2x. Contradicts the locked plan's own text
("Difficulty consumes exact depth, hard/Dream profile, modifiers, Hordes
and minimums").

### 2. H passive cages use the wrong budget depth axis

`policies.ts:99-105` declare `depthAxis: 'biomeEncounterDepth'` for
`GeneratedH_Passive` / `GeneratedH_PassiveSmall`. Native declares no
`UseEncounterDepth` on either (or their parents), so both resolve to
`BiomeDepthCache` (`RunLogic.lua:1196-1201`; `UseEncounterDepth` occurs at
exactly four sites, none of them these). Because H passives set
`CountsForRoomEncounterDepth = false` while cages count, encounter depth
runs far ahead: at the 5th H room with ~12 counted cages the planner
budgets 900 against a native 480 (+88%) — over-permissive authoring the
game cannot produce. The type-ramp axis for the same rows is correct; this
is strictly the budget axis.

### 3. Shared Enemy picker fabricates an invalid selection; one branch crashes the app

`generated-encounter-projection.ts:82` passes `selected: selected ?? ''`
into `projectStableIdentityPicker`, whose contract treats any non-undefined
value with no matching choice as a stale retained selection.

- Assessed branch: the picker renders `aria-invalid`, state `impossible`,
  and a visible "This current choice is no longer available here." during
  the mainline flow (Customize → Edit → set waves, before picking a shared
  enemy) while the dialog simultaneously invites the choice.
- Unassessed branch: the phantom item is enabled with `value: ''`;
  selecting it dispatches `ReplaceEncounterCustomization` with a blank
  `highlightKey`, the engine throws
  `ProjectCommandContractError: ... must not be blank`, the reducer has no
  catch (`projectWorkspaceSlice.ts:117`), and the editor is replaced by the
  application-fault screen. Confirmed by execution.

Fix belongs in the projection (pass `undefined`; supply "Select shared
enemy" only as the trigger placeholder).

### 4. Executor assurance is hollow exactly where the new surface lives

- No mirrored execution fixture contains a `"kind": "generated"`
  customization; the entire protocol-45 generated surface (waves, types,
  counts, baseRoll, highlight, fangs, menace) is validated only against
  hand-authored JSON literals in the module's decoder tests — which the
  repository's own generated-fixture discipline forbids. Any encoder or
  decoder drift ships green on both suites and then fails whole-plan decode
  at runtime, visible to the user only as the mod silently doing nothing.
  (Example asymmetry already present: the planner always emits
  `"menace": []`; the module treats it as optional.)
- The 622-line real-native fidelity probe suite (loads unmodified native
  function bodies for `ChooseEncounter`, `GenerateEncounter`,
  `FillEnemyTypes`, `FillEnemyCounts`, `IsEnemyEligible`,
  `HandleNextSpawn`, `SpawnUnitGroup`, `PickEncounterEliteAttributes`,
  `ApplyEliteAttribute`, `SetupUnit`) is not referenced by `tests/all.lua`
  and not run in CI. The 632 green tests therefore never touch real game
  source; a game patch is invisible until a user hits it.

---

## Tier 2 — robustness and boundary defects

### 5. Executor partial installation has no rollback

`room/timeline/encounters/generated.lua:304-313`: the `FillEnemyTypes`
wrapper rewrites each wave's `Spawns` in place as native iterates; the
completeness check runs only after native returns. On `missing-fill-contact`
or `generation-error` the module declines ownership but leaves the already
rewritten waves installed — planner rosters on some waves, native on
others, with native Fangs and random Menace applied over planner spawns.
The only signal is an observational diagnostic that never escalates to
mismatch or desync. Reachable only under native drift today — the exact
scenario finding 4 leaves undetected.

### 6. Executor drift-trust asymmetry

The installer re-verifies enemy existence, set membership,
`IsEnemyEligible`, templates and fixed counts against the live game — and
then trusts the stale catalog for three facts it could also re-check:

- Menace swap targets are taken from the plan; native's live
  `SwapMap` / `BiomeEnemySets` (`EncounterLogic.lua:795-807`) is read only
  for spawn-point metadata. After a patch retargeting one SwapMap row, the
  module spawns an enemy native could never produce, silently.
- `IgnoreShrineOverrides = true` on every owned spawn suppresses native's
  Menace gates (`BlockNextBiomeEnemyShrineUpgrade` at both levels, and the
  `NextRoomSets` / `BiomeVisits` unlock) without re-checking any of them.
- Install-time type/count caps (`MaxTypesCap`, `MaxTypes + ramp*depth`,
  `GeneratorData.MaxCount`) are never re-derived; the installer writes
  `wave.TypeCount` and per-type `TotalCount` verbatim.

### 7. Engine: dead exported wrapper throws on a decode-reachable state

`simulation/encounters/candidates.ts:395-414`, re-exported from the
barrel: `evaluateEncounterCandidates` forwards without history/snapshots/
reward evidence, so a Devotion phase with authored customization throws
("lost its reward-generation checkpoint") and every other generated phase
silently skips validation (`valueSupported` stays true). Zero callers in
src, test, or apps; both production call sites pass full evidence. Delete
it or require the evidence in its signature.

### 8. Planner: React-invented allocation clamp contradicting the engine

`GeneratedEncounterCustomizationControl.tsx:96-135,842-846`: typed enemy
budgets are silently rewritten to `min(parsed, waveBudget)` for exact
budgets and not capped at all for range budgets, while the engine's model
is `min(requested, remaining after earlier members)`
(`generation.ts:276-280`). Saved oversized values are preserved, so the
same number behaves differently from the keyboard than from the file. The
adjacent Menace count input silently discards out-of-range values instead
of authoring them and letting the engine raise the finding — the opposite
convention on the same seam.

### 9. Planner: encounter-phase findings with no DOM claimant

Fields `Passive` slot: `customizable` is forced false while the phase goes
through the multi-choice branch that can emit `encounterUnavailable`; the
section-level finding target only binds when no customization control
exists, and the actual repair control (the Nemesis Event checkbox) binds no
finding target. Navigation opens the right node but nothing highlights or
focuses.

---

## Tier 3 — edges, schema slack, and documentation

Engine:

- `budget.depthAxis: 'runDepthCache'` admitted by schema, never populated —
  a future `UseRunDepth` encounter would silently price from depth 0.
  The compiler validates `types.depthAxis` but copies `budget.depthAxis`
  through unchecked (also catalog finding 3 below).
- Five-wave policies compile but cannot be priced (engine has native's
  four wave patterns, not five); the only surfaced issue is a misleading
  generic `required: allocations`. Bound waveCount to 4 or add the row.
- Native's forced-encounter preference (`AlwaysForce`,
  `ForceIfEncounterNotCompleted`, `ForceIfRoomReward`) has no
  representation; soundness rests on documented catalog omissions
  (`GeneratedIChronosIntro` etc.) with no regression test enforcing the
  invariant.
- Fangs `maxPerRoom` is normalized but unenforced (multi-encounter rooms
  can author a capped perk on several phases; native applies it once per
  room, and to one unit). Enforce or move to audit disposition and drop.
- `customizationValueKnown` validates every generated sub-field except
  `fangs.typeKey` / `fangs.perkKeys` — the one payload field that can hold
  an unrecognized identifier indefinitely with no repair signal.
- `equalAllocations` subtracts fixed-template cost from the sampled mean;
  native does not (`RunLogic.lua:1530-1532`). Affects only the H fixed
  templates' deterministic default; no legality impact. Match or annotate.
- Published Menace targets reuse the nativeId as `choiceKey` — the one
  wire field whose meaning silently shifts. Consider a nativeId-only shape.
- Migration 86→87 is correct and preserve-and-repair is honored. The
  `weights` drop is deliberate and right: weights were relative shares, not
  absolute allocations, so a mechanical conversion would fabricate intent —
  no action (owner ruling, 2026-09-24). Remaining note: transitions match
  on catalogVersion as well as schemaVersion, so an 86 document under any
  other catalog version is rejected rather than migrated — fine only if 86
  never shipped under another catalog.

Planner:

- Authored-value carryover policy (what survives an enemy replacement,
  highlight allocation migration, key pruning) lives in the React
  component because the engine exposes only whole-value
  `ReplaceEncounterCustomization`. Decide: accept as composition
  explicitly, or move the carryover rule engine-side beside the codec.
- The once-per-run warning re-derives active-wave membership and highlight
  applicability from the authored value and catalog flags, ignoring
  `additionalTypeCount.max` and broken compositions; the engine assessment
  is already in hand one binding away. Textbook second derivation that
  agrees today by luck (the only blacklist enemy is blockSolo).
- Menace findings drop the source `key`, so the findings panel names the
  wave but not the column.
- Stale repair copy: `evaluationProjection.ts:110-113` tells users to
  "restore Default", a control the editor deliberately removed;
  `contextualOptions.ts:226-229` already carries accurate wording.
- Dead surfaces: `WorkspaceGeneratedFangsDraft.triggerLabel` (never
  produced or read); the full `fangs` (8 fields) and `menace` (3 fields)
  objects cross into React which reads only `.active`; an unreachable
  "Vow of Fangs is inactive" branch; an always-false Reset disable.
- Ordered-prefix encounter selects re-derive the engine's known-value rule
  as UI affordances and use plain selects with a fabricated "Default"
  option where the rest of the editor uses contextual pickers.

Executor:

- Menace conversion count assumes `RemainingSpawns == TotalCount` at wave
  start; native seeds RemainingSpawns with depth/run/spawn multipliers.
  Currently safe (no shipped data sets any multiplier) but undefended, and
  the probe harness hardcodes the assumption it should test.
- Reward-destination generation hardcodes phase index 1; bounded by the
  encounter-name guard, wrong only when two phases in one room share an
  encounter key — then the wrong wave composition installs silently.
- Hard-encounter overlay is a shallow copy, not `OverwriteTableKeys` (the
  `"nil"` delete sentinel would surface as a spurious fail-safe rejection);
  preflight reads `InfiniteSpawns`/`SpawnWaves` off the raw encounter while
  the template applies overrides.
- Published Fangs replace `encounter.EliteAttributes` wholesale, bypassing
  native's eligibility filters (`BannedEliteAttributes`,
  `IsEliteAttributeEligible`, mutual exclusion); near-harmless today.
  The no-fangs empty-table suppression is correct only by inference from
  the shrine-rank sync proof; `ForceEliteAttrubuteCount` and
  `EliteTypeUpgradeCount > 1` are unhandled (unset in shipped data).
- Decoded-plan table aliasing on `unmodeledEncounterKeys` (safe only
  because both codecs reject the empty array).
- Intro substitution is detected post-mutation and desyncs; a
  `HasEncounterBeenCompleted` preflight would convert it to a clean native
  fallback.
- Codec asymmetries with identical accepted sets (waves bound 5-then-4 vs
  4; counts object-vs-table), different rejection messages only.

Catalog documentation (`COMBAT_ENCOUNTER_COMPOSITION_MATRIX.md`):

- No budget table exists at all — which is why findings 1 and 2 had no
  audit owner to contradict them.
- Census gap: the `SpeechRecord["/VO/MelinoeField_0387"]` profile gate on
  Carrion/Mudman/Zombie/ZombieAssassin (+2 inherited) is omitted from the
  qualification table (correctly excluded from data; evidence table
  incomplete). Smaller: the P `RoomSetName` gates on Dragon/HarpyDropper/
  Satyr rows; `ActiveEnemyCapBonus` carriers unnamed; `Screamer2`'s
  inherited intro identity.
- Four citation errors: Arachne F at :213 not :24; Nemesis base at :3;
  Heracles base at :3; run-blacklist write at RunLogic.lua:1405-1407.

---

## Verified clean (do not re-audit)

- Engine generation core: budget order of operations, Hordes ladder,
  minimum clamp, wave shares 1–4, highlight branch (including the
  `EscalateTypeCount` override and wave-1-only `BlockHighlightEliteTypes`),
  ordered `MaxTypesPerGroup` post-add gate, placeholder-path skip of the
  ordinary post-add block, `BlockTypesAcrossWaves` direction, one-way
  exclusion, elite-cap pruning (native's RemoveValue-during-pairs does not
  leak), count allocation including the spawn-table-index sampling rule,
  remainder/cap/transfer semantics, elite-attribute pricing inertness,
  Fangs bag model and room sets, Menace per-request bounding, chronology
  split (budget at preparation/reward checkpoint, Fangs/Menace at
  roomEntered, ShipCombat per-phase owners).
- Catalog: all 39 policies' composition fields, 114/114 enemy ratings,
  MaxCount/BlockSolo/excludes/blacklist/isElite/unitGroupSize, all depth
  gates, all 15 pools with multiplicity, Menace 114/114 dispositions,
  Fangs generic + 30 overrides + 13 blocks, census reconciliation with
  documented exclusions, all 52 P vignette rosters, zero save/profile
  predicates in production data, compiler validation-and-freeze only.
- Planner: no reproduced budget/eligibility/composition math; engine
  bounds consumed for every domain; single whole-value command per edit;
  drafts and dialog state out of authored history; findings structurally
  always route (assertion at projection time); launcher gating and
  no-auto-open behavior; Reset as the only reset.
- Executor: version gating bilateral no-op (44↔45), leave-native no-op at
  every hook with scoped neutral frames, marker hygiene across reloads and
  occurrence changes, no mutation before preflight+eligibility, faithful
  eligibility emulation, spawn-order non-issue (rekeyed by name), count
  installation via preset TotalCount matching native's accumulate branch,
  Menace source accounting including re-entrancy, fixtures byte-mirrored
  15/15, diagnostic frame compression round-trip.

## Six-question follow-up — 2026-09-24

Read-only inspection of the current planner, executor and local native scripts;
no implementation changes. The existing real-native generated encounter probe
was rerun: 16/16 passed. Direct calls to `assessFangs` with an unknown target and
unknown perk returned `typeUnavailable` and `perkUnavailable`, respectively.

### 1. Partial installation: bounded risk, not a demonstrated current fallback bug

`generated.lua:302-311` distinguishes two cases the original report conflated:
generation errors are diagnosed and rethrown; only missing fill contacts return
the native result without an ownership marker. Neither path restores mutations.
The native probe explicitly asserts propagation of a generation error, although
its injected error occurs before installation, not after the first wave.

Current `GenerateEncounter` (`RunLogic.lua:1222-1315`) calls FillEnemyTypes for
every newly generated wave. The adapter rejects preexisting waves and disables
native highlight generation, so the supported clean preparation path has no
identified missing-contact case. A future changed loop or competing hook could
still leave a partially installed roster. The hard-override/preexisting-wave
check also deserves an effective-declaration witness before claiming general
coverage beyond the current catalog.

Disposition: do not prescribe rollback/replay. Installation also changes run
blacklists, encounter blacklists and cap bonuses; native generation consumes RNG
and performs other work. Copying back Spawns alone is not atomic rollback, and
running native generation again would create a different execution. Keep a
focused failure-contact witness and effective-input preflight check in scope;
broader transaction machinery requires a demonstrated supported failure first.
Do not describe an unexpected missing contact as successful native fallback.

### 2. Executor admission: separate live eligibility from a second generator

Native `HandleNextSpawn` (`EncounterLogic.lua:782-811`) checks encounter/source
Menace blocks, the next-biome visit gate, and the shrine chance before selecting
a SwapMap target or current-room-set random pool. Owned execution suppresses
that branch and currently checks only target existence at preflight. Positive
authored conversions therefore merit bounded live gate/target-membership checks;
zero conversions need no positive-roll permission. This includes the visit gate
even though the planner intentionally assumes mature external progression.

Native `PickEliteAttributes` / `IsEliteAttributeEligible`
(`ShrineLogic.lua:687-742`) check encounter bans, run bans, enemy blocks and
attribute requirements. Owned Fangs bypasses those selection checks. Run ban
selection is commented out in current `RunLogic.lua:503`, so do not inflate this
into an observed widespread failure. A narrow ordered-pool admission check is
appropriate; per-room application counts are a different matter (question 3).

Native SetupEncounter can substitute an unfinished enemy introduction after
generation (`RunLogic.lua:1126-1145`), even when IsEnemyEligible admitted it.
The existing native probe demonstrates substitution. An early check must honor
SkipIntroEncounterCheck, completion and the introduction's own requirements;
blanket rejection of every unfinished introduction would be wrong. The choice
hook itself diagnoses substitution; it does not directly issue a mismatch.
Any later lifecycle mismatch is a separate contact and must not be conflated.

Disposition: keep these bounded runtime admission checks. Do not rebuild budget,
type-ramp or count-generation arithmetic in Lua merely for hypothetical data
drift. Native active caps and spawn pacing remain untouched.

### 3. Fangs maxPerRoom: retain native application, not planner selection quotas

`PickEliteAttributes` does not consult EliteAttributeCount or MaxPerRoom.
`ApplyEliteAttribute` (`ShrineLogic.lua:617-628`) checks/increments the room
counter when applying the perk to an actual unit. Fog, Hex and Metallic declare
MaxPerRoom = 1 (`EnemyData.lua:485-515`). Two encounters can legally select the
same capped perk; a later unit simply does not receive it after consumption.
Native and authored encounters can also compete for that application allowance.

Disposition: no cross-encounter planner rejection or application clock. The
existing contract already leaves application caps native (formation audit,
Planner disposition). Keep declaration evidence; unused metadata is not grounds
to redefine legality. A UI claim that every unit receives the perk would need
correction, but no such new claim is established here.

### 4. Unknown Fangs identifiers: structural inconsistency, not a missing active repair

`customizationValueKnown` omits Fangs identity checks, but `assessFangs` resolves
the selected target against composed eligible elites and checks the ordered perk
prefix. Unknown values produce typeUnavailable/perkUnavailable whenever Fangs
selection is applicable. `generation.ts:502-503` carries those into issues.
Existing tests cover phase-owned active repairs and dormant inactive selections.
The direct unknown-identifier probe above confirms the actual assessment path.

When Fangs is inactive, blocked or has no candidate, the value is dormant. That
is not an indefinitely unrepairable active state. Disposition: drop the claim of
missing findings. Add exact unknown-key coverage if useful; do not tighten save
decoding just for symmetry and thereby reject previously retained documents.

### 5. Reward-destination phase 1: no current wrong-phase witness

`navigation/hooks.lua:125` scopes native SetupRoomReward. Within RewardLogic.lua
its sole SetupEncounter call is the Devotion branch (:259-265), which installs
the room's single main encounter. H cage rewards exclude Devotion; O ships do
not generate it there, while O_Devotion01 declares one Encounter slot. The
generated adapter additionally requires the prepared encounter name to match.
Repeated same-name cage/ship phases use the normal encounter assembly contacts,
not this reward-owned setup contact.

Disposition: remove the proposed generic phase resolver from this correction.
Keep a representative destination-owned Devotion witness and the explicit
single-owner assumption. No supported duplicate-phase reward contact was found.

### 6. Schema86 catalog matching: no shipped compatibility gap found

Checked the GitHub release list and each available release tag's authored schema
and catalog declaration. Schema86 releases v0.5.0, v0.7.0/1/2/4/5/6/8/9/10,
v0.8.0, v0.9.0/1 and v0.10.0 all use `0.55.0-anvil-of-fates`.
v0.10.0 was checked through GitHub's contents API because that tag was not local.
Earlier released schemas are below the documented migration support floor.
The local v0.7.14 tag uses schema87 and is not a schema86 counterexample.

Disposition: keep exact schema/catalog matching. No extra migration edge or
catalog-agnostic decoder is warranted. The deliberate relative-weight drop
remains unchanged.

## Fix slices — revised per the follow-up dispositions

- A. Budget correction (catalog + engine schema), unchanged: add the
  modifier term (or fold with named source), fix the two H-passive axes,
  validate `budget.depthAxis` in the compiler, add the budget row-table
  test, regenerate + re-mirror affected execution fixtures.
- B. Planner seam, unchanged: picker phantom-selection crash, remove the
  allocation clamp (preserve legal over-requests and show effective results;
  invalid representable Menace counts receive engine findings), DOM claimants
  for the Fields Passive slot, Menace finding column identity, stale copy.
  Keep editor-owned positional budget carryover; simplify shared-enemy
  replacement to transfer only from an explicit previous highlight, not an
  inferred orphan allocation key. Preserve ambiguous retained values for repair.
- C. Executor: governed by `ENCOUNTER_EXECUTOR_TRUST_POLICY.md` (the
  one-admission-gate policy), which supersedes this slice's earlier
  admission-check list. Delivery items under that policy: the supplied
  variable base roll with range validation and RNG isolation; the
  whole-encounter admission gate at the generation-scoped
  `CalculateActiveEnemyCap` seam — final budget vs the exported
  engine-derived expectation, wave bounds, composition eligibility with
  preselection context reviewed against exactly the facts the gate needs,
  Fangs perk compatibility, positive-Menace target admissibility with its
  availability gates; install-completely-or-continue-native with the
  documented retained-roll qualification; the expected-budget export carry
  (wire representation and protocol compatibility settled explicitly
  first; no authored-schema bump); real generated-composition fixtures
  through `encodeExecutionPlan` + Prettier, mirrored, keeping the
  hand-authored malformed-input decoder cases; native probes as an
  explicit source-backed lane (a skipped probe is not drift coverage);
  truthful missing-contact diagnostics (never "clean native fallback"
  after mutation); native errors propagate. The admission seam is
  Lua-verified: RunLogic ~1214 — DifficultyRating final (Hordes and
  minimum applied), cap call, then the wave-count draw — so admission
  precedes all roster mutation, and the wrapper must bind to the
  generation scope (the cap function has three other call sites).
  Encounter identity keeps its direct `IsEncounterEligible` contact; the
  standalone intro-substitution preflight and the Devotion destination
  witness fall away with the earlier shape.
- D. Engine edges, revised: delete the dead wrapper; close the
  `runDepthCache` and five-wave schema slack; forced-encounter regression
  test. Carryover ownership is settled below; no engine migration. Fangs `maxPerRoom` stays a
  declaration-evidence field with native-owned application (disposition 3
  — no planner selection quota); unknown-Fangs-key handling needs no
  decode tightening (disposition 4) — optional exact unknown-key test
  coverage only.
- E. Documentation, unchanged: matrix budget table, census/citation
  corrections.

Withdrawn by the follow-up: executor rollback (1), catalog-trust re-checks
beyond the bounded admission set (2), Fangs maxPerRoom enforcement (3), the
unknown-Fangs-identifier finding claim (4), the generic reward-phase
resolver (5), any 86-migration catalog-matching relaxation (6).

### Remaining trim and ownership dispositions

- Weight migration is settled: preserve the deliberate drop; no further work.
- Equal-allocation initialization chooses a convenient valid authored
  distribution, not a native random draw. Preserve it; test validity and
  determinism rather than equivalence to native sampling.
- Optional `menace` and an emitted empty array are compatible if both mean zero
  conversions. No stricter decoder is needed merely for wire symmetry.
- Menace `choiceKey` naming does not warrant protocol reshaping. Clarify its
  meaning only where necessary; reopen only for an actual identity/mapping defect.
- Reject catalog declarations the engine cannot support, such as unsupported
  budget axes or five-wave policies. Do not implement hypothetical future spawn
  multipliers or extra Fangs targets; keep the supported domain explicit.
- Safe table aliasing and codecs accepting identical value sets are out of
  scope absent a reachable behavioral defect. Different rejection wording is
  not a correctness gap.
- Plain selects versus contextual pickers is separate UX work. Only a fabricated
  invalid option or incorrect dispatched value belongs in this correction.
- Carryover remains editor-owned complete-edit construction. Wave-count edits
  retain rows and dependent leaves; enemy replacement inherits allocations by
  position; Fangs target edits retain perks; Menace settings remain keyed to
  their source identity rather than transferring to a replacement enemy.
  Explicit enemy removal removes its allocation and omits an empty map.
  The engine already supplies sampled allocation keys and owns effective counts,
  legality, dormancy, findings and structural validation. No parallel policy or
  new command family is required. Retain existing carryover witnesses and add
  focused missing ones, not tests asserting implementation shape.
- The one carryover correction is the shared-enemy recovery heuristic:
  allocation keys outside `typeKeys` do not prove a former highlight identity.
  Transfer from an explicit prior `highlightKey` only; otherwise retain authored
  allocations for normal assessment/repair rather than guessing or inventing a
  zero allocation. This is a bounded editor behavior correction, not a reason to
  move all carryover into the engine.

### Verification of these dispositions — 2026-09-24, code-checked

Every disposition above was verified against both repos (planner `e42bf61d`,
executor `e256562`) with UI-level and engine-level probes. All hold. Two
findings came back worse than the audit body records, and one decision is
still open:

- Shared-enemy heuristic (confirmed defect, upgraded to the mainline flow):
  in `locals/GeneratedEncounterCustomizationControl.tsx:696-731` +
  `:182-192`, the transfer always writes `inherited` onto the new key, and
  `inherited` is 0 whenever the prior highlight had no allocation. Probed
  through the real UI on golden F: Edit (1-wave init `{Guard: 65}`) → set
  3 waves → pick shared enemy destroys the authored 65 with a written 0
  (scenario A); an explicit prior highlight without an allocation invents a
  0 that hides the "Set each editable enemy budget" finding (B); a single
  stale orphan is silently moved onto the new highlight (C). The proposed
  rule is implementable purely in the editor with existing engine products:
  transfer only when `highlightKey` is explicit AND holds an allocation,
  else retain allocations as authored — `required allocations` and
  `allocationMembers` findings already own the repair. Open decision:
  when the new highlight is already a listed type with its own allocation
  (E), skip the transfer or overwrite and rely on `enemyUnavailable`.
- Five-wave policies (upgraded from misleading finding to silent no-op): a
  fully authored 5-wave value assesses `supported: true`, `issues: []`,
  with no operands — no finding, silently unpublished, native fallback with
  no signal. The compiler bound to 4 is the fix; the authored save codec's
  `waveCount <= 5` stays (retained-value representability).
- Equal-allocation initialization: valid and deterministic across 6,552
  probe runs (39 profiles x 168 contexts, zero invalid, zero mismatches).
  One test change owed: `generated-composition.test.ts:135-150` pins the
  exact formula output (baking in the fixed-cost subtraction) and should
  become a validity/determinism check.
- Menace `[]`-vs-absent, `choiceKey` consumers, table aliasing, codec
  accepted-set equivalences: all confirmed safe; no consumer reads
  `target.choiceKey` for identity anywhere in either repo.
- Compiler-accepted-but-unevaluated, exact list: `budget.depthAxis` accepts
  any string (only `runDepthCache` is schema-visible); `waveCount.max` 5 vs
  engine patterns 1-4. `types.hardCap` (~30 rows) and `budget.hardDepthRamp`
  are dormant conditional facts (production hardcodes `hard: false`), owner
  call, not defects.
- Carryover inventory: all five behaviors implemented as stated. Witness
  gaps: nothing pins wave-count retention of dependent leaves, Fangs
  target-change keeping perks, Menace non-transfer on source/highlight
  replacement, or the empty-allocations-map omission. Wording refinements:
  the highlight carries by identity (positional inheritance is for the
  generated tail); removal is offered only for the last excess enemy.

Focused witnesses called for (beyond the fixes): scenarios A/B/C (and the
E decision) pinned through the UI; wave-count retention; Fangs perk
retention across a target change; Menace dormancy on replacement; the
empty-map branch; initialization validity/determinism across contexts; the
compiler rejections (with the silently-unpublished 5-wave value as the
regression witness).
