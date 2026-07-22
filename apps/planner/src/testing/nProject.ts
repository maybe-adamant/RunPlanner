import { catalog } from '@run-planner/catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createIncomingRewardAddress,
  createLocalChildAddress,
  createLocalChildGroupAddress,
  createLocalRewardAddress,
  createOccurrenceId,
  createProjectDocument,
  createShopOfferAddress,
  type HubBiomePlan,
  type ProjectDocument,
} from '@run-planner/core';
import type { ResolvedRewardOffer } from '@run-planner/core/reward-kernel';

export const nBiome = createBiomeAddress('Surface', 'N');
export const nFixedOccurrenceIds = Object.freeze({
  opening: createOccurrenceId('editor-n-opening'),
  preHub: createOccurrenceId('editor-n-prehub'),
  preboss: createOccurrenceId('editor-n-preboss'),
});
export const nOpenSlotKeys = Object.freeze([
  'combat11',
  'combat10',
  'combat09',
  'combat05',
  'combat03',
  'combat02',
  'combat01',
  'miniBoss01',
  'combat23',
] as const);
export const nVisitSlotKeys = Object.freeze([
  'combat05',
  'miniBoss01',
  'combat02',
  'combat11',
  'combat23',
  'combat09',
] as const);

export function nOccurrenceId(slotKey: string) {
  return createOccurrenceId(`editor-n-${slotKey}`);
}

export function requireNPlan(project: ProjectDocument): HubBiomePlan {
  const plan = project.routes
    .find((route) => route.routeKey === nBiome.routeKey)
    ?.biomes.find((candidate) => candidate.biomeKey === nBiome.biomeKey);
  if (plan?.kind !== 'HubBiome') {
    throw new Error('N product fixture has no Hub plan');
  }
  return plan;
}

function replaceIncoming(
  project: ProjectDocument,
  slotKey: string,
  value: ResolvedRewardOffer,
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(nBiome, nOccurrenceId(slotKey)),
    value,
  });
}

function replaceLocal(
  project: ProjectDocument,
  parentSlotKey: string,
  sideSlotKey: string,
  rewardType: string,
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceLocalReward',
    reward: createLocalRewardAddress(
      nBiome,
      nOccurrenceId(parentSlotKey),
      'sideRooms',
      sideSlotKey,
    ),
    value: { rewardType },
  });
}

function configureSideRooms(project: ProjectDocument): ProjectDocument {
  let configured = project;
  for (const [parentSlotKey, sideSlotKeys] of Object.entries({
    combat05: ['sideDoor1', 'sideDoor2', 'sideDoor3'],
    combat02: ['sideDoor1', 'sideDoor2'],
    combat11: ['sideDoor1'],
  })) {
    for (const sideSlotKey of sideSlotKeys) {
      configured = applyProjectCommand(configured, catalog, {
        kind: 'ReplaceSideRoomGeneration',
        sideRoom: createLocalChildAddress(
          nBiome,
          nOccurrenceId(parentSlotKey),
          'sideRooms',
          sideSlotKey,
        ),
        generation: 'generated',
      });
    }
  }
  for (const [parentSlotKey, enteredSlotKeys] of [
    ['combat05', ['sideDoor2', 'sideDoor1']],
    ['combat02', ['sideDoor1']],
    ['combat11', ['sideDoor1']],
  ] as const) {
    configured = applyProjectCommand(configured, catalog, {
      kind: 'ReplaceSideRoomEntryOrder',
      group: createLocalChildGroupAddress(nBiome, nOccurrenceId(parentSlotKey), 'sideRooms'),
      enteredSlotKeys,
    });
  }
  configured = replaceLocal(configured, 'combat05', 'sideDoor1', 'MaxManaDropSmall');
  configured = replaceLocal(configured, 'combat05', 'sideDoor2', 'MaxHealthDropSmall');
  configured = replaceLocal(configured, 'combat05', 'sideDoor3', 'EmptyMaxHealthSmallDrop');
  configured = replaceLocal(configured, 'combat02', 'sideDoor1', 'RoomMoneyTinyDrop');
  configured = replaceLocal(configured, 'combat02', 'sideDoor2', 'AirBoost');
  return replaceLocal(configured, 'combat11', 'sideDoor1', 'EarthBoost');
}

export function createEmptyNProject(): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: 'n-product-loop',
    name: 'N Product Loop',
    configuredBiomeCounts: { Surface: 1 },
  });
}

export function createRepresentativeNProject(): ProjectDocument {
  let project = applyProjectCommand(createEmptyNProject(), catalog, {
    kind: 'CreateHubTopology',
    biome: nBiome,
    fixedOccurrenceIds: nFixedOccurrenceIds,
  });
  for (const hubSlotKey of nOpenSlotKeys) {
    project = applyProjectCommand(project, catalog, {
      kind: 'OpenHubSlot',
      slot: createHubSlotAddress(nBiome, hubSlotKey),
      occurrenceId: nOccurrenceId(hubSlotKey),
    });
  }
  for (const [index, hubSlotKey] of nVisitSlotKeys.entries()) {
    project = applyProjectCommand(project, catalog, {
      kind: 'AppendHubVisit',
      visit: createHubVisitAddress(nBiome, index + 1),
      hubSlotKey,
    });
  }
  for (const [slotKey, offer] of Object.entries({
    combat01: { rewardType: 'MaxHealthDropBig' },
    combat02: { rewardType: 'MaxManaDropBig' },
    combat03: { rewardType: 'WeaponUpgrade' },
    combat05: { rewardType: 'HermesUpgrade' },
    combat09: { rewardType: 'SpellDrop' },
    combat10: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'AphroditeUpgrade' },
    },
    combat11: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'AresUpgrade' },
    },
    combat23: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
    },
    miniBoss01: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'HephaestusUpgrade' },
    },
  } satisfies Readonly<Record<string, ResolvedRewardOffer>>)) {
    project = replaceIncoming(project, slotKey, offer);
  }
  project = configureSideRooms(project);
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopOffer',
    offer: createShopOfferAddress(nBiome, nFixedOccurrenceIds.preboss, 'MajorNonBoon'),
    value: { rewardType: 'MaxHealthDrop' },
  });
}
