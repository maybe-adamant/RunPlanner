import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAdditionalExitAddress,
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createTargetAddress,
} from '@run-planner/engine/authored-project';

import { fBiome, fProject, gBiome, gProject } from '../support/configured-projects';

function biomeTopology(
  project: ReturnType<typeof fProject>,
  routeKey: 'Underworld',
  biomeKey: 'F' | 'G',
) {
  const topology = project.routes
    .find((route) => route.routeKey === routeKey)
    ?.biomes.find((biome) => biome.biomeKey === biomeKey)?.topology;
  if (topology === null || topology === undefined) throw new Error(`missing ${biomeKey} topology`);
  return topology;
}

function fSelectedMidshop() {
  const opening = createOccurrenceId('detour-f-opening');
  const shop = createOccurrenceId('detour-f-shop');
  const source = { kind: 'occurrence' as const, occurrenceId: opening };
  let project = applyProjectCommand(fProject(), catalog, {
    kind: 'CreateStart',
    biome: fBiome,
    occurrenceId: opening,
    gameName: 'F_Opening01',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    decision: createExitDecisionAddress(fBiome, source),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(fBiome, source),
    storeKey: 'RunProgress',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(fBiome, source, 'exit1'),
    occurrenceId: shop,
    gameName: 'F_Shop01',
  });
  return { project, shop };
}

describe('authored-project route detour commands', () => {
  it('takes a normal G target over as Anomaly, retains its offer and identity, and reverts exactly', () => {
    const intro = createOccurrenceId('detour-g-intro');
    const target = createOccurrenceId('detour-g-target');
    const source = { kind: 'occurrence' as const, occurrenceId: intro };
    let project = applyProjectCommand(gProject(), catalog, {
      kind: 'CreateStart',
      biome: gBiome,
      occurrenceId: intro,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: createExitDecisionAddress(gBiome, source),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(gBiome, source),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(gBiome, source, 'exit1'),
      occurrenceId: target,
      gameName: 'G_Combat01',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: createExitDecisionAddress(gBiome, { kind: 'occurrence', occurrenceId: target }),
    });

    const switched = applyProjectCommand(project, catalog, {
      kind: 'SwitchTargetToAnomaly',
      target: createTargetAddress(gBiome, source, 'exit1'),
    });
    const anomaly = biomeTopology(switched, 'Underworld', 'G').occurrences.find(
      (occurrence) => occurrence.occurrenceId === target,
    );
    expect(anomaly).toMatchObject({
      occurrenceId: target,
      gameName: 'B_Combat01',
      anomalyReplacement: { replacedRoomGameName: 'G_Combat01' },
      state: { kind: 'anomaly', success: true },
    });
    expect(
      biomeTopology(switched, 'Underworld', 'G').decisions.some(
        (decision) =>
          decision.kind === 'exit' &&
          decision.source.kind === 'occurrence' &&
          decision.source.occurrenceId === target,
      ),
    ).toBe(false);

    const edited = applyProjectCommand(switched, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(gBiome, target),
      value: {
        rewardType: 'Devotion',
        payload: {
          kind: 'DevotionPair',
          chosenSource: 'AphroditeUpgrade',
          spurnedSource: 'ApolloUpgrade',
        },
      },
    });
    const remapped = applyProjectCommand(edited, catalog, {
      kind: 'ReplaceAnomalyMap',
      occurrence: createOccurrenceAddress(gBiome, target),
      gameName: 'B_Combat05',
    });
    const failed = applyProjectCommand(remapped, catalog, {
      kind: 'ReplaceAnomalySuccess',
      occurrence: createOccurrenceAddress(gBiome, target),
      success: false,
    });
    const reverted = applyProjectCommand(failed, catalog, {
      kind: 'RevertAnomaly',
      occurrence: createOccurrenceAddress(gBiome, target),
    });
    expect(
      biomeTopology(reverted, 'Underworld', 'G').occurrences.find(
        (occurrence) => occurrence.occurrenceId === target,
      ),
    ).toMatchObject({
      occurrenceId: target,
      gameName: 'G_Combat01',
      state: { kind: 'counted' },
    });
  });

  it('adds the contract beside an incomplete normal envelope, preserves the normal lane, and removes its descendant return', () => {
    const { project: initial, shop } = fSelectedMidshop();
    const source = { kind: 'occurrence' as const, occurrenceId: shop };
    const additional = createAdditionalExitAddress(fBiome, source, 'zagreusContract');
    const contract = createOccurrenceId('detour-contract');
    const normalTarget = createOccurrenceId('detour-contract-normal');
    const returnTarget = createOccurrenceId('detour-contract-return');
    let project = applyProjectCommand(initial, catalog, {
      kind: 'AddZagreusContract',
      additional,
      occurrenceId: contract,
    });
    let decision = biomeTopology(project, 'Underworld', 'F').decisions.find(
      (candidate) =>
        candidate.kind === 'exit' &&
        candidate.source.kind === 'occurrence' &&
        candidate.source.occurrenceId === shop,
    );
    expect(decision).toMatchObject({
      normal: { targets: [] },
      additional: [{ kind: 'zagreusContract', occurrenceId: contract }],
      selection: { kind: 'unresolved' },
    });

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, source),
      storeKey: 'RunProgress',
    });

    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, source, 'exit1'),
      occurrenceId: normalTarget,
      gameName: 'F_Combat01',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(fBiome, source),
      value: { kind: 'additional', additionalExitKey: 'zagreusContract' },
    });
    const contractSource = { kind: 'occurrence' as const, occurrenceId: contract };
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: createExitDecisionAddress(fBiome, contractSource),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, contractSource),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, contractSource, 'exit1'),
      occurrenceId: returnTarget,
      gameName: 'F_Combat02',
    });

    project = applyProjectCommand(project, catalog, {
      kind: 'RemoveZagreusContract',
      additional,
    });
    const topology = biomeTopology(project, 'Underworld', 'F');
    decision = topology.decisions.find(
      (candidate) =>
        candidate.kind === 'exit' &&
        candidate.source.kind === 'occurrence' &&
        candidate.source.occurrenceId === shop,
    );
    expect(decision).toMatchObject({
      normal: { targets: [{ occurrenceId: normalTarget }] },
      additional: [],
      selection: { kind: 'derived' },
    });
    expect(topology.occurrences.map((occurrence) => occurrence.occurrenceId)).not.toContain(
      contract,
    );
    expect(topology.occurrences.map((occurrence) => occurrence.occurrenceId)).not.toContain(
      returnTarget,
    );
  });
});
