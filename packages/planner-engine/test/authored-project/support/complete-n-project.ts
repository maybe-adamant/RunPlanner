import { catalog } from '@run-planner/hades2-catalog';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures';
import {
  applyProjectCommand,
  createBiomeAddress,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  createIncomingRewardAddress,
  createLocalChildAddress,
  createLocalChildGroupAddress,
  createLocalRewardAddress,
  createOccurrenceId,
  createProjectDocument,
  createTargetAddress,
  createTraitOfferAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';

const nBiome = createBiomeAddress('Surface', 'N');

export function createCompleteNProject(): ProjectDocument {
  let document = applyProjectCommand(
    createProjectDocument(catalog, {
      projectId: 'authored-complete-n',
      name: 'Authored Complete N',
      configuredBiomeCounts: { Surface: 1 },
    }),
    catalog,
    {
      kind: 'CreateStart',
      biome: nBiome,
      occurrenceId: createOccurrenceId('round-trip-n-opening'),
    },
  );
  const openingDecision = createExitDecisionAddress(nBiome, {
    kind: 'occurrence',
    occurrenceId: createOccurrenceId('round-trip-n-opening'),
  });
  document = applyProjectCommand(document, catalog, {
    kind: 'CreateBatch',
    decision: openingDecision,
  });
  document = applyProjectCommand(document, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(nBiome, openingDecision.source, 'prehub'),
    occurrenceId: createOccurrenceId('round-trip-n-prehub'),
    gameName: 'N_PreHub01',
  });
  const preHubDecision = createExitDecisionAddress(nBiome, {
    kind: 'occurrence',
    occurrenceId: createOccurrenceId('round-trip-n-prehub'),
  });
  document = applyProjectCommand(document, catalog, {
    kind: 'CreateBatch',
    decision: preHubDecision,
  });
  document = applyProjectCommand(document, catalog, {
    kind: 'ReplaceWithHubDecision',
    decision: preHubDecision,
    hub: createHubDecisionAddress(nBiome, 'hub'),
  });
  for (let index = 1; index <= 9; index += 1) {
    const slotKey = `combat${String(index).padStart(2, '0')}`;
    document = applyProjectCommand(document, catalog, {
      kind: 'OpenHubSlot',
      slot: createHubSlotAddress(nBiome, 'hub', slotKey),
      occurrenceId: createOccurrenceId(`round-trip-n-${slotKey}`),
    });
  }
  for (const [slotKey, value] of Object.entries({
    combat01: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource' as const, source: 'AphroditeUpgrade' },
    },
    combat02: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource' as const, source: 'AresUpgrade' },
    },
    combat03: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource' as const, source: 'ApolloUpgrade' },
    },
    combat04: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource' as const, source: 'ZeusUpgrade' },
    },
    combat05: { rewardType: 'MaxHealthDropBig' },
    combat06: { rewardType: 'MaxManaDropBig' },
    combat07: { rewardType: 'WeaponUpgrade' },
    combat08: { rewardType: 'HermesUpgrade' },
    combat09: { rewardType: 'SpellDrop' },
  } as const)) {
    document = applyProjectCommand(document, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, createOccurrenceId(`round-trip-n-${slotKey}`)),
      value,
    });
  }
  document = applyProjectCommand(document, catalog, {
    kind: 'ReplaceHubVisitOrder',
    hub: createHubDecisionAddress(nBiome, 'hub'),
    hubSlotKeys: ['combat01', 'combat02', 'combat03', 'combat04', 'combat05', 'combat06'],
  });
  return applyProjectCommand(document, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: createExitDecisionAddress(nBiome, {
      kind: 'hubDecision',
      decisionKey: 'hub',
    }),
    gameName: 'N_PreBoss01',
    targetOccurrenceIds: { preboss: createOccurrenceId('round-trip-n-preboss') },
  });
}

/** Complete N setup with one entered side-room child for local lifecycle tests. */
export function createEnteredNLocalProject(): ProjectDocument {
  const nCombatId = createOccurrenceId('round-trip-n-combat02');
  let project = createCompleteNProject();
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(
      createIncomingRewardAddress(nBiome, createOccurrenceId('round-trip-n-prehub')),
      'source',
    ),
    value: {
      kind: 'traits',
      giverKey: 'Apollo',
      options: [
        { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
        { traitKey: 'ApolloSprintBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(nBiome, nCombatId),
    value: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' },
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceSideRoomGeneration',
    sideRoom: createLocalChildAddress(nBiome, nCombatId, 'sideRooms', 'sideDoor2'),
    generation: 'generated',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceSideRoomGeneration',
    sideRoom: createLocalChildAddress(nBiome, nCombatId, 'sideRooms', 'sideDoor1'),
    generation: 'generated',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceLocalReward',
    reward: createLocalRewardAddress(nBiome, nCombatId, 'sideRooms', 'sideDoor1'),
    value: { rewardType: 'MaxHealthDropSmall' },
  });
  return authorLegalTraitOffers(
    applyProjectCommand(project, catalog, {
      kind: 'ReplaceSideRoomEntryOrder',
      group: createLocalChildGroupAddress(nBiome, nCombatId, 'sideRooms'),
      enteredSlotKeys: ['sideDoor1'],
    }),
  );
}
