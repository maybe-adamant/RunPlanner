import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAcquisitionRoleAddress,
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createTargetAddress,
  createTraitOfferAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';

import { createFConversionFrontierProject, goldenFBiome, goldenFOccurrenceId } from './underworld';

/**
 * Sanitized reconstruction of run-plan.runplanner(3) through Decision 3. The
 * attachment's UUIDs, natural Chaos detour, and later route are omitted; its
 * selected door chronology and reward acquisitions are retained.
 */
export function createCombat08ArtificerRegressionProject(): ProjectDocument {
  const fixture = createFConversionFrontierProject('MetaCardPointsCommonDrop');
  const first = goldenFOccurrenceId(1, 1);
  const secondSelected = goldenFOccurrenceId(2, 1);
  const secondUnselected = goldenFOccurrenceId(2, 2);
  const thirdUnselected = goldenFOccurrenceId(3, 1);
  const thirdSelected = goldenFOccurrenceId(3, 2);
  let project = applyProjectCommand(fixture.project, catalog, {
    kind: 'ReplaceOccurrenceRoom',
    occurrence: createOccurrenceAddress(goldenFBiome, first),
    gameName: 'F_Combat06',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceAcquisitionDisposition',
    acquisition: createAcquisitionRoleAddress(
      createIncomingRewardAddress(goldenFBiome, first),
      'self',
    ),
    value: {
      kind: 'artificer',
      replacement: {
        offer: {
          rewardType: 'Boon',
          payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
        },
        traitOffersByAcquisitionRole: {
          source: {
            kind: 'traits',
            giverKey: 'Apollo',
            options: [
              { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
              { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
              { traitKey: 'ApolloCastBoon', rarity: 'Common' },
            ],
            selectedOptionKey: 'option1',
            rarificationActions: [],
          },
        },
        dispositionByAcquisitionRole: { source: { kind: 'normal' } },
      },
    },
  });

  const secondDecision = createExitDecisionAddress(goldenFBiome, {
    kind: 'occurrence',
    occurrenceId: first,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    decision: secondDecision,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(goldenFBiome, secondDecision.source),
    storeKey: 'RunProgress',
  });
  for (const [exitKey, occurrenceId, gameName] of [
    ['exit1', secondSelected, 'F_Combat03'],
    ['exit2', secondUnselected, 'F_Combat08'],
  ] as const) {
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(goldenFBiome, secondDecision.source, exitKey),
      occurrenceId,
      gameName,
    });
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(goldenFBiome, secondSelected),
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(
      createIncomingRewardAddress(goldenFBiome, secondSelected),
      'source',
    ),
    value: {
      kind: 'traits',
      giverKey: 'Apollo',
      options: [
        { traitKey: 'ApolloSprintBoon', rarity: 'Common' },
        { traitKey: 'ApolloManaBoon', rarity: 'Common' },
        { traitKey: 'DoubleStrikeChanceBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(goldenFBiome, secondUnselected),
    value: { rewardType: 'RoomMoneyDrop' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(goldenFBiome, secondDecision.source),
    value: { kind: 'normal', exitKey: 'exit1' },
  });

  const thirdDecision = createExitDecisionAddress(goldenFBiome, {
    kind: 'occurrence',
    occurrenceId: secondSelected,
  });
  project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision: thirdDecision });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(goldenFBiome, thirdDecision.source),
    storeKey: 'MetaProgress',
  });
  for (const [exitKey, occurrenceId, gameName, rewardType] of [
    ['exit1', thirdUnselected, 'F_Combat04', 'MetaCurrencyDrop'],
    ['exit2', thirdSelected, 'F_Combat08', 'MetaCardPointsCommonDrop'],
  ] as const) {
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(goldenFBiome, thirdDecision.source, exitKey),
      occurrenceId,
      gameName,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(goldenFBiome, occurrenceId),
      value: { rewardType },
    });
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(goldenFBiome, thirdDecision.source),
    value: { kind: 'normal', exitKey: 'exit2' },
  });
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceAcquisitionDisposition',
    acquisition: createAcquisitionRoleAddress(
      createIncomingRewardAddress(goldenFBiome, thirdSelected),
      'self',
    ),
    value: { kind: 'timePiece' },
  });
}
