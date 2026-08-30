import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createTargetAddress,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { Catalog, RoomDeclaration } from '@run-planner/engine/catalog-schema';
import {
  createPreparedProjectCandidateSession,
  composeBiomeHistoryPrefix,
  evaluateBiomeRoomGeneration,
  materializeBiomePrefix,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { createCompleteFGProject, goldenGBiome } from '@run-planner/test-fixtures/underworld';
import { createExitDecisionAddress } from '@run-planner/engine/authored-project';
import { evaluateTakeoverPrebossBatchCandidate } from '@run-planner/engine/simulation';
import {
  fGenerationBaselineBatches,
  fGenerationBiome,
  fGenerationOccurrenceId,
} from './support/f-generation-project';
import { evaluate } from './support/f-generation-evaluation';
import {
  buildAnomalyCapProject,
  buildArtemisSourceAnomalyProject,
  buildBelowDepthAnomalyProject,
  buildShopSourceAnomalyProject,
  detourGBiome,
} from './support/detour-generation-fixtures';

function prefix(project: ProjectDocument) {
  const plan = project.routes
    .find((route) => route.routeKey === detourGBiome.routeKey)
    ?.biomes.find((biome) => biome.biomeKey === detourGBiome.biomeKey);
  const route = project.routes.find((candidate) => candidate.routeKey === detourGBiome.routeKey);
  if (plan === undefined || route === undefined) throw new Error('G detour fixture is missing');
  const snapshot = materializeBiomePrefix(catalog, detourGBiome, plan, route.loadout);
  if (snapshot === null || snapshot.entryRoom === undefined)
    throw new Error('G detour prefix is absent');
  const history = composeBiomeHistoryPrefix(catalog, snapshot);
  if (history === null) throw new Error('G detour history is absent');
  return { snapshot: { ...snapshot, entryRoom: snapshot.entryRoom }, history };
}

function catalogWithRoom(room: RoomDeclaration): Catalog {
  return Object.freeze({
    ...catalog,
    rooms: Object.freeze({
      ...catalog.rooms,
      values: Object.freeze(
        catalog.rooms.values.map((candidate) =>
          candidate.gameName === room.gameName ? room : candidate,
        ),
      ),
      byKey: Object.freeze({ ...catalog.rooms.byKey, [room.gameName]: room }),
    }),
  });
}

describe('first-target and takeover generation support', () => {
  it('groups each ordinary decision and preserves its physical target order', () => {
    const result = evaluate();
    const batches = result.generation.ordinaryBatches;

    expect(batches).toHaveLength(fGenerationBaselineBatches.length);
    expect(new Set(batches.map((batch) => semanticAddressKey(batch.origin))).size).toBe(
      batches.length,
    );
    for (const [index, authored] of fGenerationBaselineBatches.entries()) {
      const batch = batches[index];
      if (batch === undefined) throw new Error(`missing generation batch ${index + 1}`);
      expect(batch.targets).toHaveLength(authored.targets.length);
      expect(batch.targets.map((target) => target.origin.exitKey)).toEqual(
        authored.targets.map((_, targetIndex) => `exit${targetIndex + 1}`),
      );
      expect(
        batch.targets.every(
          (target) =>
            semanticAddressKey(target.pressure.targetOrigin) === semanticAddressKey(target.origin),
        ),
      ).toBe(true);
      expect(batch).not.toHaveProperty('forcePressure');
      expect(batch).not.toHaveProperty('anomalyTakeovers');
      expect(batch).not.toHaveProperty('fieldsCageOutcomes');
    }
    expect(result.generation).not.toHaveProperty('forcePressure');
    expect(result.generation).not.toHaveProperty('anomalyTakeovers');
    expect(result.generation).not.toHaveProperty('fieldsCageOutcomes');
    expect(evaluate().generation.ordinaryBatches).toEqual(batches);
  });

  it('reaches the takeover Preboss at the declared depth without treating force maximum as a ceiling', () => {
    const result = evaluate();
    const takeover = evaluateTakeoverPrebossBatchCandidate(
      catalog,
      result.snapshot,
      result.history,
      createExitDecisionAddress(fGenerationBiome, {
        kind: 'occurrence',
        occurrenceId: fGenerationOccurrenceId(10, 1),
      }),
      'F_PreBoss01',
      1,
    );

    expect(takeover.pressure.map((entry) => entry.beforeSequence)).toEqual(
      expect.arrayContaining([expect.any(Number)]),
    );
    expect(takeover.pressure).toHaveLength(2);
    expect(takeover.pressure.every((entry) => entry.biomeDepthCache === 10)).toBe(true);
    expect(takeover.pressure.every((entry) => entry.selectedPossible)).toBe(true);
    expect(
      takeover.pressure.every((entry) => entry.requiredForcedRoomGameNames.includes('F_PreBoss01')),
    ).toBe(true);
    expect(result.history.rooms.at(-4)?.preOutgoing?.ledgers.counters.biomeDepthCache).toBe(10);
  });
  it('does not let an aggregate-invalid three-door takeover suppress ordinary Door 1 support', () => {
    let project = createCompleteFGProject();
    const plan = project.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'G');
    if (plan?.topology === null || plan === undefined) throw new Error('G topology is missing');
    const takeover = plan.topology.decisions.find(
      (candidate) =>
        candidate.kind === 'exit' &&
        candidate.normal.kind === 'batch' &&
        candidate.normal.targets.some(
          (target) =>
            plan.topology?.occurrences.find(
              (occurrence) => occurrence.occurrenceId === target.occurrenceId,
            )?.gameName === 'G_PreBoss01',
        ),
    );
    if (takeover?.kind !== 'exit') throw new Error('G takeover decision is missing');
    const decision = createExitDecisionAddress(goldenGBiome, takeover.source);
    const target = createTargetAddress(goldenGBiome, takeover.source, 'exit1');
    project = applyProjectCommand(project, catalog, { kind: 'RemoveExitDecision', decision });
    project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(goldenGBiome, takeover.source),
      storeKey: 'RunProgress',
    });

    const preboss = catalog.rooms.byKey.G_PreBoss01;
    if (preboss === undefined) throw new Error('G Preboss declaration is missing');
    const cappedCatalog = catalogWithRoom(
      Object.freeze({
        ...preboss,
        caps: Object.freeze({ ...preboss.caps, maxCreationsThisRun: 1 }),
      }),
    );
    const session = createPreparedProjectCandidateSession(
      cappedCatalog,
      simulateProjectAssembly(cappedCatalog, project),
    );
    const ordinaryGameNames = cappedCatalog.rooms.values
      .filter(
        (room) =>
          room.roomSetKey === 'G' &&
          room.mode.kind === 'authored' &&
          room.prebossBatchPolicy?.kind !== 'takeOverNormalDoors',
      )
      .map((room) => room.gameName);
    const [takeoverCandidate, ...ordinaryCandidates] = session.evaluate([
      { kind: 'takeoverPrebossBatch' as const, source: decision, gameName: 'G_PreBoss01' },
      ...ordinaryGameNames.map((gameName) =>
        Object.freeze({ kind: 'roomTarget' as const, target, gameName }),
      ),
    ]);

    expect(takeoverCandidate).toMatchObject({
      kind: 'takeoverPrebossBatch',
      result: {
        support: 'impossible',
        selectedPossible: false,
        pressure: expect.arrayContaining([
          expect.objectContaining({
            selectedExclusionReasons: expect.arrayContaining(['maxCreationsThisRun']),
          }),
        ]),
      },
    });
    expect(
      ordinaryCandidates.some(
        (candidate) =>
          candidate.kind === 'roomTarget' &&
          candidate.result.pressure.selectedPossible &&
          !candidate.result.pressure.requiredForcedRoomGameNames.includes('G_PreBoss01'),
      ),
      JSON.stringify(ordinaryCandidates),
    ).toBe(true);
  });

  it.each([false, true])(
    'treats an earlier Anomaly as cap-consuming only when it has entered (entered=%s)',
    (firstAnomalySelected) => {
      const { project, laterTarget } = buildAnomalyCapProject(firstAnomalySelected);
      const { snapshot, history } = prefix(project);
      const generation = evaluateBiomeRoomGeneration(catalog, snapshot, history, 2);
      const unavailable = generation.findings.find(
        (finding) =>
          finding.code === 'targetRoomUnavailable' &&
          semanticAddressKey(finding.origin) === semanticAddressKey(laterTarget),
      );
      const takeover = generation.ordinaryBatches
        .flatMap((batch) => batch.targets.map((target) => target.anomaly))
        .find(
          (support) =>
            support !== undefined &&
            semanticAddressKey(support.origin) === semanticAddressKey(laterTarget),
        );
      expect(takeover).toBeDefined();
      if (!firstAnomalySelected) {
        expect(takeover).toMatchObject({ selectedPossible: true, failedConditions: [] });
        expect(unavailable).not.toMatchObject({
          evidence: expect.objectContaining({
            anomalyReplacement: expect.objectContaining({
              failedConditions: expect.arrayContaining(['enteredReplacementCap']),
            }),
          }),
        });
        return;
      }
      expect(takeover).toMatchObject({
        selectedPossible: false,
        priorEnteredReplacementCount: 1,
        maximumEnteredReplacementsThisRoute: 0,
        failedConditions: expect.arrayContaining(['enteredReplacementCap']),
      });
      expect(unavailable).toMatchObject({
        evidence: expect.objectContaining({
          anomalyReplacement: expect.objectContaining({
            priorEnteredReplacementCount: 1,
            maximumEnteredReplacementsThisRoute: 0,
            failedConditions: expect.arrayContaining(['enteredReplacementCap']),
          }),
        }),
      });
    },
  );

  it('publishes a below-depth normal target takeover as unavailable before it is authored', () => {
    const { project, earlyTarget } = buildBelowDepthAnomalyProject();
    const { snapshot, history } = prefix(project);
    const generation = evaluateBiomeRoomGeneration(catalog, snapshot, history, 2);
    expect(
      generation.ordinaryBatches.flatMap((batch) =>
        batch.targets.flatMap((target) => (target.anomaly === undefined ? [] : [target.anomaly])),
      ),
    ).toContainEqual(
      expect.objectContaining({
        origin: earlyTarget,
        selectedPossible: false,
        failedConditions: expect.arrayContaining(['minimumBiomeDepthCache']),
      }),
    );
  });

  it('keeps an Anomaly authored and finding-backed when its G_Shop source is excluded', () => {
    const { project, target } = buildShopSourceAnomalyProject();
    const { snapshot, history } = prefix(project);
    const generation = evaluateBiomeRoomGeneration(catalog, snapshot, history, 2);
    expect(
      generation.ordinaryBatches.flatMap((batch) =>
        batch.targets.flatMap((target) => (target.anomaly === undefined ? [] : [target.anomaly])),
      ),
    ).toContainEqual(
      expect.objectContaining({
        origin: target,
        selectedPossible: false,
        failedConditions: expect.arrayContaining(['sourceRoomExcluded']),
      }),
    );
    expect(generation.findings).toContainEqual(
      expect.objectContaining({
        code: 'targetRoomUnavailable',
        origin: target,
        evidence: expect.objectContaining({
          anomalyReplacement: expect.objectContaining({
            failedConditions: expect.arrayContaining(['sourceRoomExcluded']),
          }),
        }),
      }),
    );
  });

  it('keeps an Anomaly authored and finding-backed when its source selected Artemis', () => {
    const { project, target } = buildArtemisSourceAnomalyProject();
    const { snapshot, history } = prefix(project);
    const generation = evaluateBiomeRoomGeneration(catalog, snapshot, history, 2);
    expect(generation.findings).toContainEqual(
      expect.objectContaining({
        code: 'targetRoomUnavailable',
        origin: target,
        evidence: expect.objectContaining({
          anomalyReplacement: expect.objectContaining({
            excludedSourceEncounterKeys: ['ArtemisCombatG'],
            failedConditions: expect.arrayContaining(['sourceEncounterExcluded']),
          }),
        }),
      }),
    );
  });
});
