import { describe, expect, expectTypeOf, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createAdditionalExitAddress,
  createBatchRewardStoreAddress,
  createInitialExitDecision,
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
  normalDecisionProgressionForLayout,
  type ProjectCommand,
} from '@run-planner/engine/authored-project';

import { createNormalDispositionByAcquisitionRole } from '../../../src/authored-project/reward-state';

import {
  fBiome,
  fProject,
  gBiome,
  gProject,
  nBiome,
  nProject,
} from '../support/configured-projects';
import {
  createCompleteFGProject,
  goldenGBiome,
  goldenGOccurrenceId,
} from '@run-planner/test-fixtures/underworld';

function biomeTopology(
  project: ReturnType<typeof fProject>,
  routeKey: 'Underworld',
  biomeKey: 'F' | 'G',
) {
  const topology = project.route.biomes.find((biome) => biome.biomeKey === biomeKey)?.topology;
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
    const returned = createOccurrenceId('detour-g-anomaly-return');
    const returnedPeer = createOccurrenceId('detour-g-anomaly-return-peer');
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
    const targetSource = { kind: 'occurrence' as const, occurrenceId: target };
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: createExitDecisionAddress(gBiome, targetSource),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(gBiome, targetSource),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(gBiome, targetSource, 'exit1'),
      occurrenceId: returned,
      gameName: 'G_Shop01',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(gBiome, targetSource, 'exit2'),
      occurrenceId: returnedPeer,
      gameName: 'G_Combat03',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(gBiome, targetSource),
      value: { kind: 'normal', exitKey: 'exit2' },
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
    const anomalyOutgoing = biomeTopology(switched, 'Underworld', 'G').decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.source.kind === 'occurrence' &&
        decision.source.occurrenceId === target,
    );
    expect(anomalyOutgoing).toMatchObject({
      normal: { targets: [{ exitKey: 'exit1', occurrenceId: returned }] },
      selection: { kind: 'derived' },
    });
    expect(
      biomeTopology(switched, 'Underworld', 'G').occurrences.some(
        (occurrence) => occurrence.occurrenceId === returned,
      ),
    ).toBe(true);
    expect(
      biomeTopology(switched, 'Underworld', 'G').occurrences.find(
        (occurrence) => occurrence.occurrenceId === returned,
      )?.state,
    ).toMatchObject({ kind: 'shop', shop: expect.any(Object) });
    expect(
      biomeTopology(switched, 'Underworld', 'G').occurrences.some(
        (occurrence) => occurrence.occurrenceId === returnedPeer,
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
      route: {
        biomes: Array<{
          topology?: {
            occurrences: Array<{ occurrenceId: string; state: Record<string, unknown> }>;
          };
        }>;
      };
    };
    const encodedAnomaly = encoded.route.biomes
      .flatMap((biome) => biome.topology?.occurrences ?? [])
      .find((occurrence) => occurrence.occurrenceId === target);
    if (encodedAnomaly === undefined) throw new Error('encoded Anomaly occurrence is missing');
    const infernalContractOffer = { rewardType: 'InfernalContractBoon' } as const;
    encodedAnomaly.state.reward = {
      offer: infernalContractOffer,
      dispositionByAcquisitionRole: createNormalDispositionByAcquisitionRole(
        catalog,
        infernalContractOffer,
      ),
      traitOffersByAcquisitionRole: {},
    };
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
    expect(
      biomeTopology(reverted, 'Underworld', 'G').decisions.find(
        (decision) =>
          decision.kind === 'exit' &&
          decision.source.kind === 'occurrence' &&
          decision.source.occurrenceId === target,
      ),
    ).toEqual(anomalyOutgoing);
  });

  it('reanchors one preserved continuation between a normal G target and an Anomaly target', () => {
    const intro = createOccurrenceId('anomaly-reanchor-intro');
    const fork = createOccurrenceId('anomaly-reanchor-fork');
    const normalTarget = createOccurrenceId('anomaly-reanchor-normal');
    const anomalyTarget = createOccurrenceId('anomaly-reanchor-target');
    const returned = createOccurrenceId('anomaly-reanchor-return');
    const returnedPeer = createOccurrenceId('anomaly-reanchor-return-peer');
    const introSource = { kind: 'occurrence' as const, occurrenceId: intro };
    let project = applyProjectCommand(gProject(), catalog, {
      kind: 'CreateStart',
      biome: gBiome,
      occurrenceId: intro,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: createExitDecisionAddress(gBiome, introSource),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(gBiome, introSource),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(gBiome, introSource, 'exit1'),
      occurrenceId: fork,
      gameName: 'G_Combat02',
    });
    const forkSource = { kind: 'occurrence' as const, occurrenceId: fork };
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: createExitDecisionAddress(gBiome, forkSource),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(gBiome, forkSource),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(gBiome, forkSource, 'exit1'),
      occurrenceId: normalTarget,
      gameName: 'G_Combat01',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(gBiome, forkSource, 'exit2'),
      occurrenceId: anomalyTarget,
      gameName: 'G_Combat03',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SwitchTargetToAnomaly',
      target: createTargetAddress(gBiome, forkSource, 'exit2'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(gBiome, forkSource),
      value: { kind: 'normal', exitKey: 'exit1' },
    });
    const normalSource = { kind: 'occurrence' as const, occurrenceId: normalTarget };
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: createExitDecisionAddress(gBiome, normalSource),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(gBiome, normalSource),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(gBiome, normalSource, 'exit1'),
      occurrenceId: returned,
      gameName: 'G_Combat04',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(gBiome, normalSource, 'exit2'),
      occurrenceId: returnedPeer,
      gameName: 'G_Combat05',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(gBiome, normalSource),
      value: { kind: 'normal', exitKey: 'exit1' },
    });

    const onAnomaly = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(gBiome, forkSource),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    const anomalyOutgoing = biomeTopology(onAnomaly, 'Underworld', 'G').decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.source.kind === 'occurrence' &&
        decision.source.occurrenceId === anomalyTarget,
    );
    expect(anomalyOutgoing).toMatchObject({
      source: { kind: 'occurrence', occurrenceId: anomalyTarget },
      normal: { targets: [{ exitKey: 'exit1', occurrenceId: returned }] },
      selection: { kind: 'derived' },
    });
    expect(
      biomeTopology(onAnomaly, 'Underworld', 'G').occurrences.some(
        (occurrence) => occurrence.occurrenceId === returned,
      ),
    ).toBe(true);
    expect(
      biomeTopology(onAnomaly, 'Underworld', 'G').occurrences.some(
        (occurrence) => occurrence.occurrenceId === returnedPeer,
      ),
    ).toBe(false);

    const restored = applyProjectCommand(onAnomaly, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(gBiome, forkSource),
      value: { kind: 'normal', exitKey: 'exit1' },
    });
    expect(
      biomeTopology(restored, 'Underworld', 'G').decisions.find(
        (decision) =>
          decision.kind === 'exit' &&
          decision.source.kind === 'occurrence' &&
          decision.source.occurrenceId === normalTarget,
      ),
    ).toEqual({
      ...anomalyOutgoing,
      source: { kind: 'occurrence', occurrenceId: normalTarget },
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

  it('authors, replaces, removes, and codec-round-trips an occurrence-owned Chaos gate', () => {
    const opening = createOccurrenceId('natural-chaos-opening');
    const chaos = createOccurrenceId('natural-chaos-target');
    const additional = createAdditionalExitAddress(fBiome, opening, 'chaos');
    const started = applyProjectCommand(fProject(), catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: opening,
      gameName: 'F_Opening01',
    });
    const added = applyProjectHistoryCommand(createProjectHistory(started), catalog, {
      kind: 'AddChaos',
      additional,
      occurrenceId: chaos,
    });
    let project = added.present;
    const layout = catalog.biomeLayouts.byKey.F;
    if (layout === undefined) throw new Error('missing F layout');
    const progression = normalDecisionProgressionForLayout(layout);
    if (progression === undefined) throw new Error('missing F progression');
    expect(
      biomeTopology(project, 'Underworld', 'F').decisions.find(
        (decision) =>
          decision.kind === 'exit' &&
          decision.source.kind === 'occurrence' &&
          decision.source.occurrenceId === opening,
      ),
    ).toEqual(
      createInitialExitDecision(
        progression,
        { kind: 'occurrence', occurrenceId: opening },
        'Opening',
      ),
    );
    expect(undoProjectHistory(added).present).toBe(started);
    expect(
      biomeTopology(project, 'Underworld', 'F').occurrences.find(
        (occurrence) => occurrence.occurrenceId === opening,
      )?.additionalExits,
    ).toEqual([{ kind: 'chaos', key: 'chaos', occurrenceId: chaos }]);
    expect(
      biomeTopology(project, 'Underworld', 'F').occurrences.find(
        (occurrence) => occurrence.occurrenceId === chaos,
      ),
    ).toMatchObject({ gameName: 'Chaos_01', state: { kind: 'fixed' } });

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceChaosMap',
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
      kind: 'RemoveChaos',
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

  it('reanchors one preserved continuation between a normal target and Chaos', () => {
    const opening = createOccurrenceId('chaos-reanchor-opening');
    const chaos = createOccurrenceId('chaos-reanchor-detour');
    const normalTarget = createOccurrenceId('chaos-reanchor-normal');
    const returned = createOccurrenceId('chaos-reanchor-return');
    const source = { kind: 'occurrence' as const, occurrenceId: opening };
    const additional = createAdditionalExitAddress(fBiome, opening, 'chaos');
    let project = applyProjectCommand(fProject(), catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: opening,
      gameName: 'F_Opening01',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'AddChaos',
      additional,
      occurrenceId: chaos,
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
      value: { kind: 'additional', additionalExitKey: 'chaos' },
    });
    const chaosSource = { kind: 'occurrence' as const, occurrenceId: chaos };
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: createExitDecisionAddress(fBiome, chaosSource),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, chaosSource),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, chaosSource, 'exit1'),
      occurrenceId: returned,
      gameName: 'F_Combat02',
    });
    const chaosOutgoing = biomeTopology(project, 'Underworld', 'F').decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.source.kind === 'occurrence' &&
        decision.source.occurrenceId === chaos,
    );

    const onNormal = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(fBiome, source),
      value: { kind: 'normal', exitKey: 'exit1' },
    });
    expect(
      biomeTopology(onNormal, 'Underworld', 'F').decisions.find(
        (decision) =>
          decision.kind === 'exit' &&
          decision.source.kind === 'occurrence' &&
          decision.source.occurrenceId === normalTarget,
      ),
    ).toEqual({
      ...chaosOutgoing,
      source: { kind: 'occurrence', occurrenceId: normalTarget },
    });
    expect(
      biomeTopology(onNormal, 'Underworld', 'F').decisions.some(
        (decision) =>
          decision.kind === 'exit' &&
          decision.source.kind === 'occurrence' &&
          decision.source.occurrenceId === chaos,
      ),
    ).toBe(false);

    const restored = applyProjectCommand(onNormal, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(fBiome, source),
      value: { kind: 'additional', additionalExitKey: 'chaos' },
    });
    expect(
      biomeTopology(restored, 'Underworld', 'F').decisions.find(
        (decision) =>
          decision.kind === 'exit' &&
          decision.source.kind === 'occurrence' &&
          decision.source.occurrenceId === chaos,
      ),
    ).toEqual(chaosOutgoing);
    expect(
      biomeTopology(restored, 'Underworld', 'F').occurrences.some(
        (occurrence) => occurrence.occurrenceId === returned,
      ),
    ).toBe(true);
  });

  it('initializes a selected Chaos return after G reaches its ordinary batch bound', () => {
    const sourceId = goldenGOccurrenceId(7, 1);
    const source = { kind: 'occurrence' as const, occurrenceId: sourceId };
    const chaos = createOccurrenceId('terminal-g-natural-chaos');
    const additional = createAdditionalExitAddress(goldenGBiome, sourceId, 'chaos');
    let project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'AddChaos',
      additional,
      occurrenceId: chaos,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenGBiome, source),
      value: { kind: 'additional', additionalExitKey: 'chaos' },
    });
    const decision = createExitDecisionAddress(goldenGBiome, {
      kind: 'occurrence',
      occurrenceId: chaos,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'InitializeExitDecision',
      decision,
      edit: { kind: 'rewardStore', storeKey: 'RunProgress' },
    });

    expect(
      biomeTopology(project, 'Underworld', 'G').decisions.find(
        (candidate) =>
          candidate.kind === 'exit' &&
          candidate.source.kind === 'occurrence' &&
          candidate.source.occurrenceId === chaos,
      ),
    ).toMatchObject({
      normal: {
        kind: 'batch',
        rewardStore: { kind: 'authoredBaseStore', baseRewardStoreKey: 'RunProgress' },
        targets: [],
      },
      selection: { kind: 'unresolved' },
    });
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );
  });

  it('does not expose generated topology creation or removal as author commands', () => {
    expectTypeOf<
      Extract<ProjectCommand, { readonly kind: 'GenerateChaos' }>
    >().toEqualTypeOf<never>();
    expectTypeOf<
      Extract<ProjectCommand, { readonly kind: 'RemoveGeneratedChaos' }>
    >().toEqualTypeOf<never>();
  });

  it('rejects a Chaos map outside N’s declared target domain', () => {
    const opening = createOccurrenceId('natural-chaos-n-opening');
    const chaos = createOccurrenceId('natural-chaos-n-target');
    const additional = createAdditionalExitAddress(nBiome, opening, 'chaos');
    let project = applyProjectCommand(nProject(), catalog, {
      kind: 'CreateStart',
      biome: nBiome,
      occurrenceId: opening,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'AddChaos',
      additional,
      occurrenceId: chaos,
    });
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceChaosMap',
        occurrence: createOccurrenceAddress(nBiome, chaos),
        gameName: 'Chaos_01',
      }),
    ).toThrow(/outside the N Chaos map domain/);
  });

  it('removes an incompatible Chaos gate when its G source becomes an Anomaly', () => {
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
    const additional = createAdditionalExitAddress(gBiome, target, 'chaos');
    project = applyProjectCommand(project, catalog, {
      kind: 'AddChaos',
      additional,
      occurrenceId: chaos,
    });
    const targetSource = { kind: 'occurrence' as const, occurrenceId: target };
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(gBiome, targetSource),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(gBiome, targetSource, 'exit1'),
      occurrenceId: createOccurrenceId('natural-chaos-anomaly-return'),
      gameName: 'G_Combat02',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(gBiome, targetSource),
      value: { kind: 'additional', additionalExitKey: 'chaos' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SwitchTargetToAnomaly',
      target: createTargetAddress(gBiome, source, 'exit1'),
    });
    const anomalyOutgoing = biomeTopology(project, 'Underworld', 'G').decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.source.kind === 'occurrence' &&
        decision.source.occurrenceId === target,
    );
    expect(anomalyOutgoing?.kind === 'exit' ? anomalyOutgoing.selection : undefined).toEqual({
      kind: 'derived',
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

  it('reanchors one preserved continuation between a normal target and Zagreus Contract', () => {
    const { project: initial, shop } = fSelectedMidshop();
    const source = { kind: 'occurrence' as const, occurrenceId: shop };
    const additional = createAdditionalExitAddress(fBiome, source.occurrenceId, 'zagreusContract');
    const contract = createOccurrenceId('detour-switch-selected-contract');
    const normalTarget = createOccurrenceId('detour-switch-normal-target');
    const returned = createOccurrenceId('detour-switch-return-target');
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
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, {
        kind: 'occurrence',
        occurrenceId: contract,
      }),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, { kind: 'occurrence', occurrenceId: contract }, 'exit1'),
      occurrenceId: returned,
      gameName: 'F_Combat02',
    });
    const contractOutgoing = biomeTopology(project, 'Underworld', 'F').decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.source.kind === 'occurrence' &&
        decision.source.occurrenceId === contract,
    );
    const onNormal = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(fBiome, source),
      value: { kind: 'normal', exitKey: 'exit1' },
    });
    expect(
      biomeTopology(onNormal, 'Underworld', 'F').decisions.find(
        (decision) =>
          decision.kind === 'exit' &&
          decision.source.kind === 'occurrence' &&
          decision.source.occurrenceId === normalTarget,
      ),
    ).toEqual({
      ...contractOutgoing,
      source: { kind: 'occurrence', occurrenceId: normalTarget },
    });
    const restored = applyProjectCommand(onNormal, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(fBiome, source),
      value: { kind: 'additional', additionalExitKey: 'zagreusContract' },
    });
    expect(
      biomeTopology(restored, 'Underworld', 'F').decisions.find(
        (decision) =>
          decision.kind === 'exit' &&
          decision.source.kind === 'occurrence' &&
          decision.source.occurrenceId === contract,
      ),
    ).toEqual(contractOutgoing);
    expect(
      biomeTopology(restored, 'Underworld', 'F').occurrences.some(
        (occurrence) => occurrence.occurrenceId === returned,
      ),
    ).toBe(true);
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
