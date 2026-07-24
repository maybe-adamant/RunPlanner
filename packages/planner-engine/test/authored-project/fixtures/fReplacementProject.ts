import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createContinuationAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createPickedAddress,
  createProjectDocument,
  createTargetAddress,
} from '@run-planner/engine/authored-project';

import { catalog } from '@run-planner/hades2-catalog';

const biome = createBiomeAddress('Underworld', 'F');

export const fReplacementOccurrenceIds = Object.freeze({
  start: createOccurrenceId('room-state-f-replacement-start'),
  combat: createOccurrenceId('room-state-f-replacement-combat'),
  continuationCombat: createOccurrenceId('room-state-f-replacement-continuation-combat'),
  miniboss: createOccurrenceId('room-state-f-replacement-miniboss'),
});

/**
 * Minimal real-catalog F topology containing one Meta-store combat and one
 * Run-store Miniboss. It is deliberately incomplete: room-state commands do
 * not require a completed route to exercise replacement reconciliation.
 */
export function createFReplacementProject() {
  let project = createProjectDocument(catalog, {
    projectId: 'room-state-f-replacement',
    name: 'F replacement fixture',
    configuredBiomeCounts: { Underworld: 1 },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: fReplacementOccurrenceIds.start,
    gameName: 'F_Opening01',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    continuation: createContinuationAddress(biome, fReplacementOccurrenceIds.start),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(biome, fReplacementOccurrenceIds.start),
    storeKey: 'MetaProgress',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, fReplacementOccurrenceIds.start, 1),
    occurrenceId: fReplacementOccurrenceIds.combat,
    gameName: 'F_Combat02',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetPicked',
    picked: createPickedAddress(biome, fReplacementOccurrenceIds.start),
    exitIndex: 1,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    continuation: createContinuationAddress(biome, fReplacementOccurrenceIds.combat),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(biome, fReplacementOccurrenceIds.combat),
    storeKey: 'RunProgress',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, fReplacementOccurrenceIds.combat, 1),
    occurrenceId: fReplacementOccurrenceIds.continuationCombat,
    gameName: 'F_Combat03',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, fReplacementOccurrenceIds.combat, 2),
    occurrenceId: fReplacementOccurrenceIds.miniboss,
    gameName: 'F_MiniBoss02',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(biome, fReplacementOccurrenceIds.miniboss),
    value: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' },
    },
  });
  return project;
}
