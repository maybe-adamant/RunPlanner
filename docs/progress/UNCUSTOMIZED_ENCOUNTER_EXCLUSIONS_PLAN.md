# Uncustomized Encounter Exclusions Plan

Status: locked. Base commit: `b4ce836ae`.

## Objective

Stop requiring authored compositions for generated combat on a fresh profile,
and stop warning that an uncustomized encounter may use up a once-per-run enemy.
The planner publishes, for every uncustomized generated combat, the enemies the
native roll must not draw there. The game module writes that list into the
encounter's own native blacklist, so the native roll can neither trigger an
introduction behind a selected combat identity nor consume an enemy that a later
authored composition needs.

User-visible outcome: Fresh File routes publish with uncustomized generated
combat; authored introductions and authored once-per-run enemies stay exact.

## Source facts

- `SetupEncounter` (`RunLogic.lua:1125-1145`) scans every spawn after
  generation and replaces the whole encounter with the first spawn's unfinished
  introduction whose `GameStateRequirements` pass. A spawn whose introduction is
  unfinished but gated appears without an introduction.
- `IsEnemyEligible` (`RunLogic.lua:1576-1596`) gates every generated draw,
  including the highlight. It already rejects unfinished introductions under
  `RequireCompletedIntro` or below `MinDepthBeforeIntros` (3; H 0), profile-gated
  enemies, and any enemy in `encounter.Blacklist` or `CurrentRun.Blacklist`.
- `encounter.Blacklist` is per encounter copy and native generation already
  writes it (`RunLogic.lua:1291, 1431`). `CurrentRun.Blacklist` receives an enemy
  with `BlacklistAfterFirstAppearance` when it is drawn (`RunLogic.lua:1405-1406`;
  `FogEmitter2`, `EnemyData_FogEmitter.lua:198`).
- Named fixed spawns bypass `IsEnemyEligible` but are still scanned for
  substitution.

## Planner policy (unchanged)

Identity and composition are separate. A selected ordinary combat identity
excludes exactly its trigger set: admissible enemies whose introduction is
unfinished and whose introduction gate passes at that checkpoint
(`ROOM_LIFECYCLE_MODEL.md` §Enemy introductions). Introductions are selected
identities. H cages evaluate in cage-preparation order. The composition picker
already offers only this policy's admissible, non-triggering enemies.

## Decision

For each reached generated phase without an authored composition, and for the
runtime fallback of a declined authored composition, the planner publishes an
excluded-enemy list:

1. the phase's trigger-exclusion set at its checkpoint (empty on mature routes,
   where every introduction is complete); plus
2. every `BlacklistAfterFirstAppearance` enemy that a later authored composition
   in the run uses and that is not already known run-blacklisted.

The list never repeats what native admission already rejects (depth,
`RequireCompletedIntro`, profile gates) and never includes gated unfinished
introductions, which native spawns without substitution. The module assigns the
list to `encounter.Blacklist` on the generation copy before native generation and
on both decline continuations. Nothing is restored afterwards; the run blacklist
keeps only native additions.

Planner simplification: the native roll is still unmodelled beyond identity;
only its excluded set is published.

## Ownership

- **Catalog:** none expected. `BlacklistAfterFirstAppearance` must already be a
  declared enemy fact (verify; add the declaration if it is only implied by the
  current warning).
- **Engine:** one owner computes the list from the existing trigger-exclusion
  admission (`simulation/encounters/preparation.ts` `admissionAt`) and the
  authored-composition blacklist facts (`generation-preparation.ts`
  `knownRunBlacklist`, `knownRunBlacklistAdditions`). Retire
  `encounterCustomizationRequired` and
  `routeStartsWithUnfinishedIntroductions` (`route-profile.ts`) with their
  consumers (`preparation.ts`, `composition-view.ts`). Execution-plan assembly and
  codec publish the list per uncustomized generated phase.
- **Planner app:** remove the finding's consumers
  (`evaluationProjection.ts`, `contextualOptions.ts`, `EncounterPhaseControl.tsx`,
  `encounterPhaseFindings.ts`) and the once-per-run warning
  (`generated-encounter-projection.ts:332`). No new policy.
- **Game module:** strict decoding of the field; the uncustomized scope in
  `room/timeline/encounters/generated.lua` (`{ kind = "native" }`) carries the
  list and assigns `encounter.Blacklist` in the `GenerateEncounter` wrap and the
  base-roll and admission decline paths.
- **Authored schema:** unchanged. Existing customizations stay valid.

## Gates

1. **Engine product and protocol.** The list owner, finding retirement,
   execution-plan field and codec, regenerated execution fixtures, equivalence
   rewrite (Fresh File findings and plan digests move; mature plans move only
   where a once-per-run enemy is authored later). Planner consumers removed in
   the same commit.
2. **Game module.** Decoder and blacklist application, both decline paths.
3. **Closure.** Docs, live checklist, plan retirement.

## Tests

- Engine (primary owner of the matrix): trigger set equals the picker's
  exclusions; gated unfinished introductions absent; mature list empty except
  reservations; reservation only for later authored once-per-run enemies; H cage
  order; introduction suffixes publish nothing.
- Execution fixtures: one Fresh File route with an uncustomized combat whose list
  is non-empty; one mature H route reserving `FogEmitter2`.
- Module: list assigned on the generation copy, both decline paths, absent list
  leaves native untouched, strict decode rejects malformed lists.
- Live (`docs/testing/`): fresh-profile run with uncustomized F depth 3+ and H
  cages shows no unplanned introduction; a planned `FogEmitter2` is not consumed
  earlier.

## Docs at closure

`ROOM_LIFECYCLE_MODEL.md` §Enemy introductions (replace the customization
paragraph), `GAME_INTEGRATION_BOUNDARY.md` uncustomized-encounter delegation,
biome Fresh File paragraphs (F, G, H, I), the FogEmitter2 audit row.

## Non-goals

- Modelling the native roll's types, counts or waves.
- Restricting uncustomized rolls to anything beyond the published list.
- Changing identity selection or the composition picker.
