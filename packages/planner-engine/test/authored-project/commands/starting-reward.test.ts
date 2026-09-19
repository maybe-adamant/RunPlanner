import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createAcquisitionRoleAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createOccurrenceAddress,
  createProjectDocument,
  createRouteStartKeepsakeSelectionAddress,
  createStartingRewardAddress,
  createTraitOfferAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  resolveRoutePosition,
} from '@run-planner/engine/authored-project';
import { materializeBiomePrefix } from '@run-planner/engine/simulation';
import {
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';

describe('starting reward ownership', () => {
  it('evaluates the route-owned reward before entry identity and reports its absence on the route', () => {
    const reward = createStartingRewardAddress('Underworld');
    const empty = createProjectDocument(catalog, {
      projectId: 'unselected-starting-reward',
      routeKey: 'Underworld',
      configuredBiomeCount: 0,
    });
    const emptyAssembly = simulateProjectAssembly(catalog, empty);
    expect(emptyAssembly.evaluation.status).toBe('empty');
    expect(emptyAssembly.evaluation.findings).not.toContainEqual(
      expect.objectContaining({ code: 'rewardMissing' }),
    );
    expect(
      createPreparedProjectCandidateSession(catalog, emptyAssembly).evaluate({
        kind: 'startingReward',
        reward,
        value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
      }),
    ).toMatchObject({ kind: 'startingReward', result: { supported: true, findings: [] } });

    const configured = createProjectDocument(catalog, {
      projectId: 'missing-configured-starting-reward',
      routeKey: 'Underworld',
      configuredBiomeCount: 1,
    });
    expect(simulateProjectAssembly(catalog, configured).evaluation).toMatchObject({
      status: 'incomplete',
      issue: { owner: reward },
    });
  });

  it('withholds the captured start frontier until a required keepsake result is authored', () => {
    let project = createProjectDocument(catalog, {
      projectId: 'start-reward-keepsake-prerequisite',
      routeKey: 'Underworld',
      configuredBiomeCount: 0,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'HadesAndPersephoneKeepsake',
    });
    const reward = createStartingRewardAddress('Underworld');
    expect(
      createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, project),
      ).evaluate({
        kind: 'startingReward',
        reward,
        value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
      }),
    ).toMatchObject({
      kind: 'unavailable',
      reason: 'producerFrontierUnavailable',
      evidence: { producer: reward },
    });
  });

  it('retains a route choice selected before an entry exists and binds it once on creation', () => {
    const biome = createBiomeAddress('Underworld', 'F');
    const occurrenceId = createOccurrenceId('F:deferred-start');
    let project = createProjectDocument(catalog, {
      projectId: 'deferred-starting-reward',
      routeKey: 'Underworld',
      configuredBiomeCount: 0,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingReward',
      reward: createStartingRewardAddress('Underworld'),
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
    });
    expect(project.route.biomes).toEqual([]);
    project = applyProjectCommand(project, catalog, {
      kind: 'ConfigureRoutePrefix',
      route: { kind: 'route', routeKey: 'Underworld' },
      configuredBiomeCount: 1,
    });
    expect(project.route.biomes[0]!.topology).toBeNull();
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateStart',
      biome,
      occurrenceId,
      gameName: 'F_Opening01',
    });
    const entry = project.route.biomes[0]!.topology!.occurrences.find(
      (occurrence) => occurrence.occurrenceId === occurrenceId,
    )!;
    expect(entry.state).toEqual({ kind: 'none' });
    expect(entry.startingRewardAcquisition).toBeDefined();
    expect(entry.roomActions.order).toContainEqual({
      kind: 'interactIncomingReward',
      producerPoint: 'roomRewardPickup',
      acquisitionRole: 'source',
    });
  });

  it('creates an entry, composes its acquisition payload, and round-trips it without a room offer', () => {
    const biome = createBiomeAddress('Underworld', 'F');
    const occurrenceId = createOccurrenceId('F:start');
    let project = applyProjectCommand(
      createProjectDocument(catalog, {
        projectId: 'starting-reward',
        routeKey: 'Underworld',
        configuredBiomeCount: 1,
      }),
      catalog,
      { kind: 'CreateStart', biome, occurrenceId, gameName: 'F_Opening01' },
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingReward',
      reward: createStartingRewardAddress('Underworld'),
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' } },
    });
    expect(
      project.route.biomes[0]!.topology!.occurrences.find(
        (occurrence) => occurrence.occurrenceId === occurrenceId,
      )!.startingRewardAcquisition,
    ).toBeDefined();
    const incoming = createIncomingRewardAddress(biome, occurrenceId);
    expect(
      project.route.biomes[0]!.topology!.occurrences.find(
        (occurrence) => occurrence.occurrenceId === occurrenceId,
      )!.roomActions.order,
    ).toContainEqual({
      kind: 'interactIncomingReward',
      producerPoint: 'roomRewardPickup',
      acquisitionRole: 'source',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(incoming, 'source'),
      value: {
        kind: 'traits',
        giverKey: 'Poseidon',
        options: [
          { traitKey: 'PoseidonWeaponBoon', rarity: 'Common' },
          { traitKey: 'PoseidonSpecialBoon', rarity: 'Common' },
          { traitKey: 'PoseidonCastBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    const occurrence = project.route.biomes[0]!.topology!.occurrences[0]!;
    expect(project.route.loadout.startingReward).toMatchObject({ rewardType: 'Boon' });
    expect(occurrence.state).toEqual({ kind: 'none' });
    expect(occurrence.startingRewardAcquisition?.traitOffersByAcquisitionRole.source).toMatchObject(
      {
        giverKey: 'Poseidon',
      },
    );
    const prefix = materializeBiomePrefix(
      catalog,
      biome,
      resolveRoutePosition(catalog, project.route, 'F'),
      project.route.biomes[0]!,
      project.route.loadout,
    );
    expect(prefix?.entryRoom).toMatchObject({
      incomingRewardBinding: { kind: 'countedChoice' },
      incomingReward: { offer: { rewardType: 'Boon' } },
      enteredRewardStoreKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(biome, occurrenceId),
      gameName: 'F_Opening02',
    });
    expect(
      project.route.biomes[0]!.topology!.occurrences.find(
        (occurrence) => occurrence.occurrenceId === occurrenceId,
      )!.startingRewardAcquisition?.traitOffersByAcquisitionRole.source,
    ).toMatchObject({ giverKey: 'Poseidon' });
    project = applyProjectCommand(project, catalog, { kind: 'ClearTopology', biome });
    expect(project.route.loadout.startingReward).toMatchObject({ rewardType: 'Boon' });
    expect(project.route.biomes[0]!.topology).toBeNull();
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateStart',
      biome,
      occurrenceId,
      gameName: 'F_Opening03',
    });
    expect(
      project.route.biomes[0]!.topology!.occurrences.find(
        (occurrence) => occurrence.occurrenceId === occurrenceId,
      )!.startingRewardAcquisition?.traitOffersByAcquisitionRole.source,
    ).toBeNull();
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );
  });

  it('keeps a start acquisition conversion on the composed entry source', () => {
    const biome = createBiomeAddress('Underworld', 'F');
    const occurrenceId = createOccurrenceId('F:start-conversion');
    let project = createProjectDocument(catalog, {
      projectId: 'starting-reward-conversion',
      routeKey: 'Underworld',
      configuredBiomeCount: 1,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateStart',
      biome,
      occurrenceId,
      gameName: 'F_Opening01',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingReward',
      reward: createStartingRewardAddress('Underworld'),
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
    });
    const incoming = createIncomingRewardAddress(biome, occurrenceId);
    const acquisition = createAcquisitionRoleAddress(incoming, 'source');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition,
      value: { kind: 'timePiece' },
    });
    let entry = project.route.biomes[0]!.topology!.occurrences[0]!;
    expect(entry.state).toEqual({ kind: 'none' });
    expect(entry.startingRewardAcquisition?.dispositionByAcquisitionRole.source).toEqual({
      kind: 'timePiece',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(biome, occurrenceId),
      gameName: 'F_Opening02',
    });
    entry = project.route.biomes[0]!.topology!.occurrences[0]!;
    expect(entry.startingRewardAcquisition?.dispositionByAcquisitionRole.source).toEqual({
      kind: 'timePiece',
    });
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );
  });

  it('reports a forced-provider mismatch for the route-owned starting offer', () => {
    const biome = createBiomeAddress('Underworld', 'F');
    let project = createProjectDocument(catalog, {
      projectId: 'starting-reward-forced-provider',
      routeKey: 'Underworld',
      configuredBiomeCount: 1,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateStart',
      biome,
      occurrenceId: createOccurrenceId('F:start-forced-provider'),
      gameName: 'F_Opening01',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'ForceApolloBoonKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingReward',
      reward: createStartingRewardAddress('Underworld'),
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
    });
    expect(simulateProjectAssembly(catalog, project).evaluation.findings).toContainEqual(
      expect.objectContaining({
        code: 'rewardSourceUnavailable',
        origin: createStartingRewardAddress('Underworld'),
        evidence: expect.objectContaining({ source: 'ZeusUpgrade' }),
      }),
    );
  });

  it('records the resolved run-start store only when the entry declaration requires it', () => {
    const materializeEntry = (
      routeKey: 'Underworld' | 'Surface',
      biomeKey: 'F' | 'N',
      gameName: 'F_Opening01' | 'N_Opening01',
    ) => {
      const biome = createBiomeAddress(routeKey, biomeKey);
      let project = createProjectDocument(catalog, {
        projectId: `${biomeKey}-entry-store-history`,
        routeKey,
        configuredBiomeCount: 1,
      });
      if (project.route.biomes[0]!.topology === null) {
        project = applyProjectCommand(project, catalog, {
          kind: 'CreateStart',
          biome,
          occurrenceId: createOccurrenceId(`${biomeKey}:history`),
          gameName,
        });
      }
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceStartingReward',
        reward: createStartingRewardAddress(routeKey),
        value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
      });
      return materializeBiomePrefix(
        catalog,
        biome,
        resolveRoutePosition(catalog, project.route, biomeKey),
        project.route.biomes[0]!,
        project.route.loadout,
      )?.entryRoom;
    };

    expect(materializeEntry('Underworld', 'F', 'F_Opening01')).toMatchObject({
      enteredRewardStoreKey: 'RunProgress',
    });
    expect(materializeEntry('Surface', 'N', 'N_Opening01')).not.toHaveProperty(
      'enteredRewardStoreKey',
    );
  });
});
