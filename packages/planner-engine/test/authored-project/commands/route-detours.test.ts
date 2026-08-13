import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createAdditionalExitAddress,
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectHistory,
  decodeProjectDocument,
  encodeProjectDocument,
  createTargetAddress,
  redoProjectHistory,
  undoProjectHistory,
} from '@run-planner/engine/authored-project';

import { createDefaultConversionByAcquisitionRole } from '../../../src/authored-project/reward-state';

import {
  fBiome,
  fProject,
  gBiome,
  gProject,
  nBiome,
  nProject,
} from '../support/configured-projects';

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
    expect(() =>
      applyProjectCommand(edited, catalog, {
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(gBiome, target),
        value: { rewardType: 'InfernalContractBoon' },
      }),
    ).toThrow(/InfernalContractBoon is filtered from this room/);

    const encoded = JSON.parse(encodeProjectDocument(switched)) as {
      routes: Array<{
        biomes: Array<{
          topology?: {
            occurrences: Array<{ occurrenceId: string; state: Record<string, unknown> }>;
          };
        }>;
      }>;
    };
    const encodedAnomaly = encoded.routes
      .flatMap((route) => route.biomes)
      .flatMap((biome) => biome.topology?.occurrences ?? [])
      .find((occurrence) => occurrence.occurrenceId === target);
    if (encodedAnomaly === undefined) throw new Error('encoded Anomaly occurrence is missing');
    const encodedReward = encodedAnomaly.state.reward as Record<string, unknown>;
    const infernalContractOffer = { rewardType: 'InfernalContractBoon' } as const;
    encodedReward.offer = infernalContractOffer;
    encodedReward.conversionByAcquisitionRole = createDefaultConversionByAcquisitionRole(
      catalog,
      infernalContractOffer,
    );
    encodedReward.traitOffersByAcquisitionRole = {};
    expect(() => decodeProjectDocument(encoded, catalog)).toThrow(
      /InfernalContractBoon is filtered from this room/,
    );

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
    const revertedOccurrence = biomeTopology(reverted, 'Underworld', 'G').occurrences.find(
      (occurrence) => occurrence.occurrenceId === target,
    );
    expect(revertedOccurrence).toMatchObject({
      occurrenceId: target,
      gameName: 'G_Combat01',
    });
    expect(revertedOccurrence?.state).toMatchObject({
      kind: 'counted',
      reward: {
        offer: {
          rewardType: 'Devotion',
          payload: {
            kind: 'DevotionPair',
            chosenSource: 'AphroditeUpgrade',
            spurnedSource: 'ApolloUpgrade',
          },
        },
      },
    });
  });

  it('adds the contract beside an incomplete normal envelope, preserves the normal lane, and removes its descendant return', () => {
    const { project: initial, shop } = fSelectedMidshop();
    const source = { kind: 'occurrence' as const, occurrenceId: shop };
    const additional = createAdditionalExitAddress(fBiome, source.occurrenceId, 'zagreusContract');
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
      selection: { kind: 'unresolved' },
    });
    expect(
      biomeTopology(project, 'Underworld', 'F').occurrences.find(
        (occurrence) => occurrence.occurrenceId === shop,
      )?.additionalExits,
    ).toEqual([{ kind: 'zagreusContract', key: 'zagreusContract', occurrenceId: contract }]);

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

    const history = createProjectHistory(project);
    const removed = applyProjectHistoryCommand(history, catalog, {
      kind: 'RemoveZagreusContract',
      additional,
    });
    const restored = undoProjectHistory(removed);
    const redone = redoProjectHistory(restored);
    expect(restored.present).toEqual(project);
    expect(redone.present).toEqual(removed.present);

    project = removed.present;
    const topology = biomeTopology(project, 'Underworld', 'F');
    decision = topology.decisions.find(
      (candidate) =>
        candidate.kind === 'exit' &&
        candidate.source.kind === 'occurrence' &&
        candidate.source.occurrenceId === shop,
    );
    expect(decision).toMatchObject({
      normal: { targets: [{ occurrenceId: normalTarget }] },
      selection: { kind: 'derived' },
    });
    expect(
      topology.occurrences.find((occurrence) => occurrence.occurrenceId === shop)?.additionalExits,
    ).toEqual([]);
    expect(topology.occurrences.map((occurrence) => occurrence.occurrenceId)).not.toContain(
      contract,
    );
    expect(topology.occurrences.map((occurrence) => occurrence.occurrenceId)).not.toContain(
      returnTarget,
    );
  });

  it('authors, replaces, removes, and codec-round-trips an occurrence-owned natural Chaos gate', () => {
    const opening = createOccurrenceId('natural-chaos-opening');
    const chaos = createOccurrenceId('natural-chaos-target');
    const additional = createAdditionalExitAddress(fBiome, opening, 'naturalChaos');
    let project = applyProjectCommand(fProject(), catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: opening,
      gameName: 'F_Opening01',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'AddNaturalChaos',
      additional,
      occurrenceId: chaos,
    });
    expect(
      biomeTopology(project, 'Underworld', 'F').occurrences.find(
        (occurrence) => occurrence.occurrenceId === opening,
      )?.additionalExits,
    ).toEqual([{ kind: 'naturalChaos', key: 'naturalChaos', occurrenceId: chaos }]);
    expect(
      biomeTopology(project, 'Underworld', 'F').occurrences.find(
        (occurrence) => occurrence.occurrenceId === chaos,
      ),
    ).toMatchObject({ gameName: 'Chaos_01', state: { kind: 'fixed' } });

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceNaturalChaosMap',
      occurrence: createOccurrenceAddress(fBiome, chaos),
      gameName: 'Chaos_06',
    });
    expect(
      biomeTopology(project, 'Underworld', 'F').occurrences.find(
        (occurrence) => occurrence.occurrenceId === chaos,
      )?.gameName,
    ).toBe('Chaos_06');
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );

    const history = createProjectHistory(project);
    const removed = applyProjectHistoryCommand(history, catalog, {
      kind: 'RemoveNaturalChaos',
      additional,
    });
    const restored = undoProjectHistory(removed);
    const redone = redoProjectHistory(restored);
    expect(restored.present).toEqual(project);
    expect(redone.present).toEqual(removed.present);
    expect(
      biomeTopology(removed.present, 'Underworld', 'F').occurrences.map(
        (occurrence) => occurrence.occurrenceId,
      ),
    ).not.toContain(chaos);
  });

  it('rejects a natural Chaos map outside N’s declared target domain', () => {
    const opening = createOccurrenceId('natural-chaos-n-opening');
    const chaos = createOccurrenceId('natural-chaos-n-target');
    const additional = createAdditionalExitAddress(nBiome, opening, 'naturalChaos');
    let project = applyProjectCommand(nProject(), catalog, {
      kind: 'CreateStart',
      biome: nBiome,
      occurrenceId: opening,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'AddNaturalChaos',
      additional,
      occurrenceId: chaos,
    });
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceNaturalChaosMap',
        occurrence: createOccurrenceAddress(nBiome, chaos),
        gameName: 'Chaos_01',
      }),
    ).toThrow(/outside the N Chaos map domain/);
  });

  it('removes a retained natural Chaos gate after its selected G source becomes an Anomaly', () => {
    const intro = createOccurrenceId('natural-chaos-anomaly-intro');
    const target = createOccurrenceId('natural-chaos-anomaly-target');
    const chaos = createOccurrenceId('natural-chaos-anomaly-target-room');
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
    const additional = createAdditionalExitAddress(gBiome, target, 'naturalChaos');
    project = applyProjectCommand(project, catalog, {
      kind: 'AddNaturalChaos',
      additional,
      occurrenceId: chaos,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SwitchTargetToAnomaly',
      target: createTargetAddress(gBiome, source, 'exit1'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'RemoveNaturalChaos',
      additional,
    });
    const topology = biomeTopology(project, 'Underworld', 'G');
    expect(
      topology.occurrences.find((occurrence) => occurrence.occurrenceId === target),
    ).toMatchObject({
      gameName: 'B_Combat01',
      additionalExits: [],
    });
    expect(topology.occurrences.map((occurrence) => occurrence.occurrenceId)).not.toContain(chaos);
  });

  it('rejects switching away from a selected Midshop contract with a downstream decision', () => {
    const { project: initial, shop } = fSelectedMidshop();
    const source = { kind: 'occurrence' as const, occurrenceId: shop };
    const additional = createAdditionalExitAddress(fBiome, source.occurrenceId, 'zagreusContract');
    const contract = createOccurrenceId('detour-switch-selected-contract');
    const normalTarget = createOccurrenceId('detour-switch-normal-target');
    let project = applyProjectCommand(initial, catalog, {
      kind: 'AddZagreusContract',
      additional,
      occurrenceId: contract,
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
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: createExitDecisionAddress(fBiome, {
        kind: 'occurrence',
        occurrenceId: contract,
      }),
    });

    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'SetExitSelection',
        selection: createExitSelectionAddress(fBiome, source),
        value: { kind: 'normal', exitKey: 'exit1' },
      }),
    ).toThrow(/remove the prior selected target’s downstream decision first/);
  });

  it('retains a source-owned contract when its normal selection re-anchors to a peer', () => {
    const opening = createOccurrenceId('detour-reanchor-opening');
    const fork = createOccurrenceId('detour-reanchor-fork');
    const shop = createOccurrenceId('detour-reanchor-shop');
    const peer = createOccurrenceId('detour-reanchor-peer');
    const contract = createOccurrenceId('detour-reanchor-contract');
    const openingSource = { kind: 'occurrence' as const, occurrenceId: opening };
    let project = applyProjectCommand(fProject(), catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: opening,
      gameName: 'F_Opening01',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: createExitDecisionAddress(fBiome, openingSource),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, openingSource),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, openingSource, 'exit1'),
      occurrenceId: fork,
      gameName: 'F_Combat02',
    });
    const forkSource = { kind: 'occurrence' as const, occurrenceId: fork };
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: createExitDecisionAddress(fBiome, forkSource),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, forkSource),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, forkSource, 'exit1'),
      occurrenceId: shop,
      gameName: 'F_Shop01',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, forkSource, 'exit2'),
      occurrenceId: peer,
      gameName: 'F_Combat01',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(fBiome, forkSource),
      value: { kind: 'normal', exitKey: 'exit1' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'AddZagreusContract',
      additional: createAdditionalExitAddress(fBiome, shop, 'zagreusContract'),
      occurrenceId: contract,
    });

    const reanchored = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(fBiome, forkSource),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    expect(
      biomeTopology(reanchored, 'Underworld', 'F').occurrences.find(
        (occurrence) => occurrence.occurrenceId === shop,
      )?.additionalExits,
    ).toEqual([{ kind: 'zagreusContract', key: 'zagreusContract', occurrenceId: contract }]);
    const restored = applyProjectCommand(reanchored, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(fBiome, forkSource),
      value: { kind: 'normal', exitKey: 'exit1' },
    });
    const restoredTopology = biomeTopology(restored, 'Underworld', 'F');
    expect(
      restoredTopology.decisions.some(
        (decision) =>
          decision.kind === 'exit' &&
          decision.source.kind === 'occurrence' &&
          decision.source.occurrenceId === shop,
      ),
    ).toBe(true);
    expect(
      restoredTopology.occurrences.find((occurrence) => occurrence.occurrenceId === shop)
        ?.additionalExits,
    ).toEqual([{ kind: 'zagreusContract', key: 'zagreusContract', occurrenceId: contract }]);
  });
});
