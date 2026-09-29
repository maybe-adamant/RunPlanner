# Fresh File — encounters outline

Status: design outline, not a locked delivery plan or schema approval.
The [introduction resolution matrix](FRESH_FILE_ENEMY_INTRODUCTION_MATRIX.md)
owns the current source inventory, history sufficiency assessment and bounded
competition question. The [viability investigation](FRESH_FILE_PROJECT_VIABILITY.md)
retains the wider feature context.

## Outcome and model

First delivery enables the Fresh File route without ordinary encounter
composition customization. Native generation owns enemies, waves and
enemy-triggered introduction replacements. Do not require fully authored
generated outcomes or claim exact downstream enemy-introduction history.

Deterministic first-combat identities use the existing contextual encounter
resolution pattern, not a new composition editor. Pin the proven identities
per biome; do not classify enemy-triggered H introductions as deterministic
first-room substitutions. Exclude unavailable NPC/cocoon encounters. Existing
boss support remains separately governed by the agreed first-run restrictions.

The executor must preserve legitimate native introduction replacements in this
profile: neither force ordinary Combat over them nor treat them as an unexpected
identity mismatch. This is a bounded delivery contact to audit, not permission
to disable encounter checks globally or admit unrelated encounter families.
Planner preparation/lifecycle and reward chronology remain modeled.

The sections below preserve research and the proposed future editor for a
separate follow-up after the Fresh File spine is stable. Competing intro order,
mixed-wave installation and draft UX are not first-delivery prerequisites.

## Settled authoring model (2026-09-29)

Identity is settled in the encounter selector; Customize edits only a settled
identity, exactly as on mature. There is no preliminary draft, banner, or
resolution step in the dialog.

1. Each reachable introduction is a member of its biome set with its native
   gate as a requirement (route `FreshFile`; not completed on the route; H:
   not occurred this run; Lycanthrope: the three prerequisite introductions
   recorded). The picker lists ineligible members with the reason. On mature
   saves every introduction member is ineligible, so nothing changes there.
2. Customize on the ordinary identity excludes any enemy type whose
   introduction is unfinished, naming the introduction to select. An
   introduction's generated suffix applies the same exclusion except for its
   own seed (`RequireCompletedIntro` filters added candidates only). Fixed
   waves render read-only; all-fixed H introductions expose no controls.
3. Retained states report findings and are never stripped: an unintroduced
   type under an ordinary identity, or an introduction identity whose gate no
   longer holds after an upstream edit.
4. On `FreshFile` every generated combat phase and every mixed introduction's
   suffix must be customized, so completion and occurrence history is exact
   for the whole route. Uncustomized phases report a finding and block
   execution eligibility. Native (uncustomized) mode is not publishable on
   this route.

Because no authored composition can hold two unfinished introduction types,
competing introductions never arise in authored mode and native traversal
order is not a planner contract; it remains a live diagnostic only.

## Native constraints and open resolution decision

Native setup scans the original generated spawns. All scoped F/G/H enemy
introductions inherit Generated setup and return on the first qualifying
candidate, including the fixed-roster H profiles. A genuinely non-generated
intro could be overwritten by later entries, but that synthetic probe branch
must not be attributed to the scoped H introductions. Multiple candidates do
not imply a combined introduction. The local Lua 5.2.4 probe in the
[resolution matrix](FRESH_FILE_ENEMY_INTRODUCTION_MATRIX.md) consistently selects
the first eligible numeric wave/type slot. Embedded-game confirmation remains
open; `pairs` is not an explicit random draw.

Mixed profiles have no automatic shared highlight and keep their native
generated-suffix shares. Under the settled model the ordering question does not
reach authored compositions; it stays a live diagnostic for native generation.

## Required extension and ownership

### Source/probe follow-up

`BaseIntroEncounter.Generated = true`, inherited by the scoped F/G/H enemy
introductions. Even the H profiles whose three wave rosters are all fixed
therefore take SetupEncounter's immediate return after GenerateEncounter.
The earlier synthetic non-generated/fixed replacement case does not establish
that behavior for these H profiles. The relevant unresolved ordering is the
first eligible intro encountered in the actual native spawn traversal.

A bounded probe ran the unmodified native GenerateEncounter with helper stubs,
a 100-point budget, native wave patterns and synthetic fixed prefixes:

| Total waves / fixed prefix | Assigned budgets | FillEnemyTypes/Counts calls |
| -------------------------- | ---------------- | --------------------------- |
| 2 / 1                      | 50, 50           | Wave 2 only                 |
| 3 / 1                      | 30, 15, 55       | Waves 2 and 3 only          |
| 3 / 3                      | 30, 15, 55       | None                        |

Native generation counts pre-existing waves, disables automatic shared-highlight
generation when any exist, and fills only the suffix. Fixed roster counts do
not get regenerated from their assigned budgets. Consequently:

- Total wave count includes the fixed prefix; generated shares remain 50%, or
  15% and 55% for the three-wave pattern, not redistributed to consume 100%.
- Shared-highlight mode cannot be inferred from multiple total waves.
- Fixed profiles can still have Generated setup; model wave content separately
  from that native setup flag.
- `RequireCompletedIntro` on generated templates and the minimum intro depth
  must participate in candidates. Do not offer all unintroduced types merely
  to let the later resolution step fix them.
- The current executor's explicit `preexisting-waves` rejection must be replaced
  with bounded profile-aware admission for these supported declarations, not
  removed globally. Native fixed waves stay untouched; installation uses the
  original wave indices at existing fill contacts for the generated suffix.

Probe scope: source-function control flow with synthetic inputs, not native
enemy eligibility, actual game runtime traversal or a live installation test.

### Live acceptance probes before locking editor transitions

1. From the same first-run checkpoint, trigger pairs of eligible unfinished
   introductions in opposite proposed spawn orders; log original SpawnWaves,
   resolved identity, and occurrence/completion facts. Include fixed-roster H
   profiles, and a candidate whose introduction requirements fail.
2. Capture one F mixed profile, G FishSwarmerIntro and one all-fixed H profile:
   effective declaration, Generated flag, pre-existing waves, total budget,
   per-wave budget, fill contacts and final spawns.
3. Confirm a later H cage does not change after an earlier cage introduction
   completes. Preserve preparation-time eligibility versus completion history.

These probes are not yet run in game. Do not settle re-editing/automatic
winner UX from the synthetic function witnesses alone.

- Catalog: explicit fixed/generated wave profiles, intro requirements and boss
  option restrictions. Existing `fixedEnemies` is only a generated-wave seed,
  not a representation of full fixed waves.
- Engine: encounter resolution and preparation, history, complete generated
  authoring, budget assessment and export. Preserve native full-encounter wave
  shares; do not renormalize because a prefix is fixed.
- Application: encounter selector with introduction members and their reasons,
  and fixed/mixed editor presentation consuming engine products; no policy.
- Executor: resolved identity and bounded mixed-wave installation. Current
  generated admission rejects existing SpawnWaves, so this is not catalog-only.
  Keep native fixed content native; do not persist/export duplicate fixed counts
  merely to reconstruct an already-declared encounter.

Starting seams: engine `simulation/encounters/resolve.ts`, `preparation.ts`,
`simulation/history/composition.ts`, generated-composition contracts and their
catalog compiler; executor `room/timeline/encounters/generated.lua`.

## Chronology and dependencies

Engine history supplies initial and reached facts; [rooms](FRESH_FILE_ROOMS.md) supplies legal placements.
Record occurrence and completion at their distinct native boundaries. H cage
encounters are prepared sequentially before entry, each recording its resolved
identity before the next is prepared. Later cages see those records but not
completions; completing one must not regenerate the rest.

## Representative acceptance cases

- Mandatory first F/G/I profiles resolve without ordinary composition editing.
- Preliminary ordinary composition survives entry into the detailed editor.
- Intro replacement discards the proposal explicitly; no accidental history
  is credited to discarded enemies or losing intro candidates.
- Mixed profiles preserve fixed content and native generated-wave shares.
- Completed introductions change later candidates, not already-prepared cages.
- Fixed Hecate/Scylla domains are enforced while mature choices remain unchanged.
- Native fixed and generated/mixed execution paths receive appropriate products.

Primary tests: catalog profile normalization and engine resolution/preparation,
then representative UI transitions and producer-to-executor witnesses.

## Excluded

General save history, arbitrary fixed-wave authoring, simultaneous combined
introductions, simulated boss presentation, and a second Lua planner.

## Executor encounter binding

`mods/room/timeline/encounters/hooks.lua:ChooseEncounter` forces the published
declaration, then binds whatever native encounter setup returns when
`encounters/compatibility.lua` finds it lifecycle-compatible in the same
room/phase role; a different name logs `lifecycle-substitution` and installs no
customization, while an incompatible choice logs `lifecycle-conflict`.
`encounters/phases.lua:prove` applies the same comparator at room entry and
reload, retaining phase count, order and occurrence ownership. Native intro
replacement (for example GeneratedF→GuardIntro) therefore binds without an
allowed-identity list; leaving customization empty is no longer required.
