import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createProjectDocument,
  createShopOfferAddress,
  createTargetAddress,
  createTraitOfferAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';

export const fBiome = createBiomeAddress('Underworld', 'F');
export const fStartId = createOccurrenceId('f-takeover-start');
export const fCombatId = createOccurrenceId('f-takeover-combat');

export function createFProject(projectId = 'f-takeover-project'): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId,
    name: projectId,
    configuredBiomeCounts: { Underworld: 1 },
  });
}

export function createFStart(project = createFProject()): ProjectDocument {
  const started = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: fBiome,
    occurrenceId: fStartId,
    gameName: 'F_Opening01',
  });
  const rewarded = applyProjectCommand(started, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(fBiome, fStartId),
    value: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
    },
  });
  return applyProjectCommand(rewarded, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(createIncomingRewardAddress(fBiome, fStartId), 'source'),
    value: {
      kind: 'traits',
      giverKey: 'Apollo',
      options: [
        { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
}

export function fDecision(occurrenceId = fStartId) {
  return createExitDecisionAddress(fBiome, { kind: 'occurrence', occurrenceId });
}

export function createFOpeningBatch(
  project = createFStart(),
  storeKey: 'MetaProgress' | 'RunProgress' | undefined = 'MetaProgress',
): ProjectDocument {
  const decision = fDecision();
  let next = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
  if (storeKey !== undefined) {
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, decision.source),
      storeKey,
    });
  }
  return next;
}

export function createUnresolvedFOpeningBatch(project = createFStart()): ProjectDocument {
  return applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision: fDecision() });
}

export function createFOpeningTarget(
  project = createFOpeningBatch(),
  gameName = 'F_Combat02',
): ProjectDocument {
  const targeted = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(fBiome, fDecision().source, 'exit1'),
    occurrenceId: fCombatId,
    gameName,
  });
  return applyProjectCommand(targeted, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(fBiome, fCombatId),
    value: { rewardType: gameName === 'F_Combat01' ? 'MaxHealthDrop' : 'MetaCurrencyDrop' },
  });
}

export function createFCombatBatch(
  project = createFOpeningTarget(),
  storeKey: 'MetaProgress' | 'RunProgress' | undefined = 'RunProgress',
): ProjectDocument {
  const decision = fDecision(fCombatId);
  let next = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
  if (storeKey !== undefined) {
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, decision.source),
      storeKey,
    });
  }
  return next;
}

export function createFCombatTarget(
  project: ProjectDocument,
  exitKey: 'exit1' | 'exit2',
  occurrenceId: string,
  gameName: string,
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(fBiome, fDecision(fCombatId).source, exitKey),
    occurrenceId: createOccurrenceId(occurrenceId),
    gameName,
  });
}

export function selectFCombatExit(
  project: ProjectDocument,
  exitKey: 'exit1' | 'exit2',
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(fBiome, fDecision(fCombatId).source),
    value: { kind: 'normal', exitKey },
  });
}

export function createCompleteFTakeoverProject(
  selectedExitKey: 'exit1' | 'exit2' = 'exit1',
): ProjectDocument {
  let project = createFOpeningTarget();
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(fBiome, fCombatId),
    value: { rewardType: 'MetaCurrencyDrop' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: fDecision(fCombatId),
    gameName: 'F_PreBoss01',
    targetOccurrenceIds: {
      exit1: createOccurrenceId('f-takeover-preboss-shop'),
      exit2: createOccurrenceId('f-takeover-preboss-free'),
    },
  });
  project = selectFCombatExit(project, selectedExitKey);
  if (selectedExitKey === 'exit1') {
    for (const [offerKey, value] of Object.entries({
      Boon: {
        rewardType: 'RandomLoot' as const,
        payload: { kind: 'BoonSource' as const, source: 'ApolloUpgrade' },
      },
      MajorNonBoon: { rewardType: 'RoomRewardHealDrop' as const },
      Minor: { rewardType: 'MaxManaDrop' as const },
    })) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceShopOffer',
        offer: createShopOfferAddress(
          fBiome,
          createOccurrenceId('f-takeover-preboss-shop'),
          offerKey,
        ),
        value,
      });
    }
  }
  if (selectedExitKey === 'exit2') {
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(fBiome, createOccurrenceId('f-takeover-preboss-free')),
      value: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
      },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(
        createIncomingRewardAddress(fBiome, createOccurrenceId('f-takeover-preboss-free')),
        'source',
      ),
      value: {
        kind: 'traits',
        giverKey: 'Apollo',
        options: [
          { traitKey: 'ApolloManaBoon', rarity: 'Common' },
          { traitKey: 'ApolloRetaliateBoon', rarity: 'Common' },
          { traitKey: 'PerfectDamageBonusBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
    });
  }
  return project;
}

/** A complete physical takeover batch whose normal exit remains unselected. */
export function createUnselectedFTakeoverProject(): ProjectDocument {
  let project = createFOpeningTarget();
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(fBiome, fCombatId),
    value: { rewardType: 'MetaCurrencyDrop' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: fDecision(fCombatId),
    gameName: 'F_PreBoss01',
    targetOccurrenceIds: {
      exit1: createOccurrenceId('f-takeover-preboss-shop'),
      exit2: createOccurrenceId('f-takeover-preboss-free'),
    },
  });
  return project;
}
