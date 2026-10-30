# Engine Consumer Extraction

Status: locked 2026-10-30. Base commit: `6f19a34c6`. No authored schema
change, no `schemaRevision`, no plan-wire or execution-fixture change.

## Objective

The engine becomes a platform with declared tiers. Draft and the run import
leave `packages/planner-engine` and become packages that consume only declared
engine exports. Users see no change: the Draft corpus baseline, the run-import
fixture reports and the app behave as before.

Packages and the dependency DAG:

```text
hades2-catalog -> engine <- draft <- run-import <- apps/planner
```

- `packages/draft` → `@run-planner/draft`.
- `packages/run-import` → `@run-planner/run-import`, with the run record as its
  own entry `@run-planner/run-import/run-record`. The app recorder
  (`runRecordBuilder`, `runRecorder`) stays in `apps/planner` and depends on
  that entry.
- Persisted Draft settings (`AuthoredDraftSpec`, `draft-spec.ts`,
  `draft-share-code.ts` and their tests) stay in the engine's authored model.

## Current shape (facts)

- Draft (`src/simulation/draft/`, 16 files) uses about 21 undeclared engine
  internals; the run import (`src/simulation/run-import/`, 25 files) about 17
  more, plus Draft internals (`DraftWalk`, `draftWorld`, `draftGodSchedule`,
  carrier-child helpers). `src/run-record/` imports only `catalog-schema`.
- `DraftWalk` and `RunImportWalk` each reimplement one authoring cursor: a
  current `ProjectEvaluationAssembly`, a memoised candidate session, `apply`
  through `settleCommandUnlessRefused`, and a "no new finding" variant keyed by
  `code + semanticAddressKey(origin)`.
- `settleCommandUnlessRefused` drops `ProjectEditSettlement.fault` and merges
  three outcomes into `undefined`: refused before evaluation, the private
  `RerollPoolRefusal` after evaluation, and a command that changes nothing.
- Draft's basket checks build a synthetic `SimulationState` and call
  `checkRequirement` directly (`basket.ts`).
- The only reverse dependencies: `simulation/index.ts` re-exports Draft and the
  import (lines 648–720), and `encounters/encounter-inverse.ts` imports
  `RunRecordEncounter`/`RunRecordSpawn`.
- `test/simulation/run-import/import.test.ts` holds 111 serial tests that
  re-import full captures per test: 450–590 s on one core.

## Settled decisions (owner, 2026-10-30)

1. **Tiers.** (1) authored model: existing entries plus read-only authored
   queries exported as-is; (2) read-only queries: `./simulation` stays one
   entry; (3) new `./authoring` entry for programmatic authoring.
2. **Authoring session** (`./authoring`). The engine owns settlement, refusal
   classification, fault pass-through and candidate freshness:

   ```ts
   createAuthoringSession(catalog, start: ProjectEvaluationAssembly): AuthoringSession
   // current(), candidates() memoised by assembly identity,
   // apply(command, admission?: 'settled' | 'noNewFinding'): AuthoringOutcome,
   // restore(assembly), probe(run) restoring engine state only
   AuthoringOutcome = { kind: 'applied'; assembly; fault? } | { kind: 'refused'; refusal }
   AuthoringRefusal = command | rerollPool | unchanged | newFinding
   ```

   Any other contract error thrown after evaluation still throws (engine
   defect). `findingsAddedSince(before, after)` publishes the shared new-finding
   key in `./simulation`.

3. **"Unchanged" stays a refusal.** Settlement faults are passed through and
   accepted by both consumers, as today. Reporting them is a later change.
4. **Carrier-child completion is engine-owned** (`./authoring`):
   `completeTraitCarrierChild`, `completeTraitCarrierChildren` and the pure
   edit `withoutTraitCarrierChild` (`./authored-project`). Consumers supply only
   a `CarrierChildChoice { order, allowsTrait, prefersTrait }`; the import uses
   `FIRST_ELIGIBLE_CARRIER_CHILD_CHOICE`, Draft its rng order and steering.
   Preference sorts a copy of `order`'s result.
5. **Encounter inversion stays in the engine** behind a phase-level query,
   `observedEncounterCustomizationForProjectEvaluationAssembly`, taking the
   catalog, assembly, phase address and an `ObservedEncounterPhase`. That type
   is a neutral input (waves, spawns, Fangs); the run record is structurally
   assignable to it. The two inverse functions become module-private.
6. **Route-start requirements query** (`./simulation`):
   `prepareRouteStartTraitRequirements(catalog, route, loadout)` returns the
   held route-start traits and counts, a god's core first-offer keys, and
   `assess(traitKey, assumedTraitKeys)` → failures plus contextual kinds. The
   contract judges requirements against **the route-start traits plus the
   assumed set**. Owner and orchestrator verified this is output-identical
   today: the only non-boon trait any held/not-held requirement names is
   `SpellMoonBeamTrait`, never held at route start, and element counts are not
   static requirements. The Draft corpus must show no change.
   `BASE_TRAIT_ELEMENTS`, `highestBaseElementCount` and `TraitEquipmentSlot`
   move to `catalog-schema`.
7. **Draft publishes a narrow repairer** for the import, not `DraftWalk`,
   `draftWorld` or the schedule:

   ```ts
   createDraftIssueRepairer(catalog, session: AuthoringSession,
     options: { occurrenceIdPrefix: string }): { repairIssue(): readonly ProjectCommand[] | undefined }
   ```

   The import keeps `occurrenceIdPrefix: 'guess'` (fixture occurrence IDs depend
   on it) and falls back to `guessNemesisEvent` on `undefined`.

8. **Import moves before Draft.** For exactly one slice (S7),
   `createDraftIssueRepairer` is exported from the engine's existing Draft
   re-export block in `./simulation`; S8 removes it.
9. **Run-state queries.** `heldKeepsakeRanks` is exported as-is;
   `hubDepartureTraitInventory` is exported as `snapshotTraitInventory`.
   `advanceCurrentKeepsake` is wrapped as
   `keepsakesAfterCurrentKeepsakeAdvance`; `rerolledLevelScreensGuess` as the
   level-resolution capability's `rerolledScreensGuess`.
10. **Root lane names stay** (`test:draft-corpus`, `test:run-import`,
    `fixtures:run-record`) with new paths.
11. **Sequencing.** Package moves start after the in-flight Supply Chain Sea
    Star work lands. S0 splits the import test first so lanes are fast before
    the move.

Remaining as-is exports and their homes follow the design inventory: authored
queries (`hermesShrineInitialSlotKey`, `exitDecisionForSource`,
`routeSaveFileGodHistory`, `biomeStartRoomGameNames`, `resolveBiomeStart`,
`customizationDecisionOnRoute`, `authoredTraitOfferAt`,
`AuthoredAcquisitionSource`, `acquisitionSourceIsParticipating`,
`FIELDS_CAGE_GROUP_KEY`, `requireShipCombatWheels`) to `./authored-project`;
`reachedEncounterPhasesForProjectEvaluationAssembly`,
`isRequiredMissingInputFinding`, `assessmentRepairOwner` (not equivalent to
`AssessmentIssue.owner`) and the `RewardProducerCandidateResult` type to
`./simulation`. `latestModelHammerRows` is not exported; its import test uses
literal rows.

## Rules for every slice

- One authority moves with its consumers and primary tests; the superseded path
  is deleted in the same commit. No export-only commit: an export is added in
  the slice whose consumer first imports it from outside the engine
  (`./authoring` and the as-is exports land in S7/S8).
- Behaviour-preserving throughout. **Run `test:draft-corpus` and
  `test:run-import` before and after each slice; the corpus baseline and the
  fixture import reports must not change.**
- No local timeout or retry overrides. Narrow lanes during work; the full
  `npm run check` gate once each at S7, S8 and S9.
- Another executor's engine work may be in flight: inspect the worktree first
  and touch only the slice's files.

## Slices

| #   | Slice                        | Needs     | Est.    |
| --- | ---------------------------- | --------- | ------- |
| S0  | Split the import test        | Sea Star  | 0.5 d   |
| S1  | Authoring session            | S0        | 1–1.5 d |
| S2  | Route-start requirements     | S1        | 0.5–1 d |
| S3  | Carrier-child completion     | S1        | 0.5–1 d |
| S4  | Observed encounter           | S1        | 0.5 d   |
| S5  | Level-screen, keepsake query | S1        | 0.5 d   |
| S6  | Draft issue repairer         | S1        | 0.5 d   |
| S7  | `packages/run-import`        | S1, S3–S6 | 1.5–2 d |
| S8  | `packages/draft`             | S2, S7    | 1.5–2 d |
| S9  | Consumer guide and closure   | S8        | 0.5 d   |

Total about 7.5–9.5 days. S2–S6 are independent of each other after S1.

### S0 — Split the import test

- Split `import.test.ts` into area files following its `describe` groups
  (captures, Rarify, Sea Star, outcome children, live recording and attempt
  reset, rerolls, Fig Leaf, route and doors, keepsakes and Chaos, synthetic
  Erebus, ship wheels, unsaved rolls).
- Within a file, share each **unmodified** full import via `beforeAll`; a test
  that edits its record keeps its own import. Assertions, names and the test
  count stay the same.
- Lane: `test:run-import` before and after; record wall time in the commit body.
- Risk: a shared import mutated by one test. Imports are pure products; any
  test that alters inputs keeps a private import.

### S1 — Authoring session

- Add `simulation/authoring/session.ts` beside `edit-settlement.ts`, and
  `findingsAddedSince` in the findings neighbourhood. Delete
  `settleCommandUnlessRefused` and `settleCommandWithoutNewFinding`.
- Migrate `DraftWalk`, `draftEncounters`, `draftProject`, and `RunImportWalk`
  (`RunImportContext` keeps its shape and delegates `assembly`, `candidates`,
  `apply`; the import's `probe` restores its bookkeeping around
  `session.probe`).
- Primary test `authoring-session.test.ts` takes the settlement-fault and
  reroll-refusal assertions; rewrite `draft/encounters.test.ts:152-155`.
- Lanes: `test:engine`, `test:draft-corpus`, `test:run-import`,
  `test:equivalence`, the app `draftRun`/`runImport` tests.
- Risk: candidate memo keyed by assembly identity must stay behaviour-neutral.

### S2 — Route-start requirements query

- Add `traits/authoring/route-start-requirements.ts` (decision 6). Move the
  element helpers to `catalog-schema/traits.ts`; `traits/history/fold.ts`
  imports them from there.
- Migrate `basket.ts`, `prerequisites.ts`, `draftStartTraits` callers,
  `draftPendingFirstPick`, `draftFirstBoonRule`; `DraftHeldTraits` aliases the
  query's `held`. Delete the synthetic state code. `offerDependsOnDeathDefiance`
  stays in Draft.
- Primary test in the engine; Draft basket tests keep witnesses;
  `draft.test.ts` uses the query.
- Lanes: `test:engine`, `test:draft-corpus`, `test:equivalence`,
  `test:planner` (RouteDraftPanel).

### S3 — Carrier-child completion

- Move `draft/carrier-children.ts` to
  `candidates/trait-offer/carrier-child-completion.ts`;
  `withoutTraitCarrierChild` goes to `authored-project/traits/carrier-children.ts`.
- Draft's `trait-offers` builds a `CarrierChildChoice`; the import's
  `completeRecordedCarrierChildren` keeps its record-first loop.
- `draft/carrier-children.test.ts` becomes the engine primary test; the import
  test uses literal rows.
- Lanes: `test:engine`, `test:draft-corpus`, `test:run-import`.
- Risk: copy-before-sort ordering.

### S4 — Observed encounter

- Add `ObservedEncounterPhase` and the phase query in `encounter-inverse.ts`;
  drop its `run-record/model` import. Export the inverse result and issue types
  with the query (S7).
- Shrink the import's `customizeEncounter`; `encounter-inverse.test.ts` stays
  in the engine with `ObservedEncounterPhase` literals.
- Lanes: `test:engine`, `test:run-import`.

### S5 — Level-screen guess and keepsake advance

- Add the capability's `rerolledScreensGuess` and
  `keepsakesAfterCurrentKeepsakeAdvance`; the free functions become private.
- Migrate the import's `trait-offers` and `rarify`; `rerolled-screens.test.ts`
  goes through the capability.
- Lanes: `test:engine`, `test:run-import`.

### S6 — Draft issue repairer

- Add `draft/repair.ts` (decision 7) with the unsteered spec moved from
  `run-import/guess.ts`, `draftWorld`, the `firstInOrder` schedule draw, one
  session-bound `DraftWalk`, and the resume rule (clear `hooked` and
  `authoredRewards` when `session.current()` is not the walk's last result).
  Delete `guess.ts`. The repairer drives the import's own session.
- Lanes: `test:engine`, `test:run-import`, `test:draft-corpus`.
- Risk: occurrence-ID prefix and resume identity; the fixture reports are the
  witness.

### S7 — `packages/run-import`

- Move the 25 import files, 4 run-record files, their tests and the 5 fixtures.
  Package entries `.` and `./run-record`; own `tsconfig.json`; engine as
  dependency, catalog as devDependency.
- Engine `package.json`: drop `./run-record`, add `./authoring`. Add the
  import's as-is exports (decision 9 and the list above). Temporarily export
  `createDraftIssueRepairer` from the Draft block (decision 8).
- App: run-record consumers (7 src, 4 tests), import consumers (3 src, 2
  tests), the `main.tsx` worker, `apps/planner/package.json`, the two hardcoded
  fixture paths; root `test:run-import` and `fixtures:run-record` paths and the
  regenerate script's wording. `npm install` links the workspace.
- Boundary enforcement for the package (below).
- Docs: AGENTS.md lanes and testing list; ARCHITECTURE lane table and Imports;
  record/import path claims in AUTHORED_PROJECT_MODEL, RUN_START_INSTALLATION
  and the save-file run record audit.
- Lanes: `test:run-import`, `test:engine`, `test:planner`, lint, typecheck,
  `npm run build` (worker bundle), `fixtures:run-record` with no diff, then
  `npm run check`.
- Risk: lockfile churn; collision on `authored-project/index.ts` and
  `acquisition-sources.ts` if Sea Star work has not landed.

### S8 — `packages/draft`

- Move 16 source files, 11 tests, `test/draft-corpus/**` and
  `test/support/draft-*`. Remove `simulation/index.ts:648-720` from the engine,
  including the S7 repairer export. Add Draft's as-is exports.
- `packages/run-import` imports `@run-planner/draft` in the same commit.
- App: 6 src, 2 tests, the Draft worker. `vitest.config.ts` exclude,
  `vitest.draft-corpus.config.ts` (baseline and `globalSetup`),
  `testExecutionPolicy.test.ts:203-245`.
- Boundary enforcement for Draft; extend the boundary test.
- Docs: DRAFT_MODE ownership and steering location; SIMULATION_AND_VALIDATION
  (Draft leaves the engine-stages diagram and becomes a downstream consumer);
  TESTING (Draft corpus paths); CONTRIBUTING (map and lanes); AGENTS.md lanes.
- Lanes: `test:draft-corpus` (same baseline), `test:engine`, `test:planner`,
  `test:run-import`, lint, typecheck, build, then `npm run check`.
- Risk: corpus baseline path and the `globalSetup` move.

### S9 — Consumer guide and closure

- Add `docs/design/ENGINE_CONSUMERS.md` and a short consumer section in
  SIMULATION_AND_VALIDATION, as meaning, not code: who consumes the engine; the
  tier table; interactive history uses `settleProjectEdit`, programmatic
  building uses the authoring session; refusal kinds; faults are engine
  defects; consumers never build simulation state or re-derive chronology,
  keepsake, level or inventory facts; hypothetical queries are engine-owned
  with a consumer choice policy; how to add an export (owner, tier, primary
  test, no export-only commit); how the rules are enforced. Link it from
  CONTRIBUTING's map.
- Delete this plan. `npm run check` once.

## Boundary enforcement

- **ESLint.** Blocks for `packages/{draft,run-import}/{src,test}/**` ban
  platform and planner-app imports, `@run-planner/hades2-catalog` (src only),
  `**/planner-engine/**` ("use declared @run-planner/engine entries"),
  `@run-planner/engine/*/**`, and relative climbs out of the package. Draft
  additionally bans `@run-planner/run-import{,/**}`. `engineBoundaryImports`
  adds `@run-planner/draft{,/**}` and `@run-planner/run-import{,/**}`.
- **`apps/planner/test/architecture/packageBoundaries.test.ts`** (pattern of
  `engineRuntimeImportGraph.test.ts`), over `packages/{draft,run-import}` and
  `apps/planner/src`: every engine specifier is an engine `exports` key;
  relative specifiers resolve inside their package; the package graph follows
  the DAG above; every import is a declared dependency. Extend the cycle test to
  the new `src` roots. Introduced in S7, extended in S8.

## Non-goals

- Splitting `./simulation` into narrower entries.
- Reporting or refusing settlement faults.
- Any change to Draft or import output, the authored schema, the plan wire or
  the game module.

## Open follow-ups

- Report settlement faults in the Draft and import reports (behaviour change,
  separate commit).
- Optionally split `./simulation` later.
- Decide `docs/progress/RECORD_MODE.md`'s fate: promote its durable result and
  delete it, or keep it while it owns open work.
- Optional `runStateSnapshotAt(assembly, checkpoint)` if the import's own
  snapshot index becomes a burden.
