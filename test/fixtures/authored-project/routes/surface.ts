import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  createIncomingRewardAddress,
  createLocalVisitSlotAddress,
  createLocalVisitOrderAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createShopOfferAddress,
  createTargetAddress,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import {
  authorLegalTraitOffers,
  authorRequiredTestRoomActions,
  replaceTestShopOfferActions,
} from '../shared';
import {
  loadSurfaceNCheckpoint,
  loadSurfaceNOCheckpoint,
  loadSurfaceNOPCheckpoint,
  loadSurfaceNOPQCheckpoint,
} from '../checkpoints/surface';

export const nBiome = createBiomeAddress('Surface', 'N');
export const oBiome = createBiomeAddress('Surface', 'O');
export const pBiome = createBiomeAddress('Surface', 'P');
export const qBiome = createBiomeAddress('Surface', 'Q');
export const nOccurrenceIds = Object.freeze({
  opening: createOccurrenceId('surface-n-opening'),
  preHub: createOccurrenceId('surface-n-prehub'),
  preboss: createOccurrenceId('surface-n-preboss'),
});
export const nFixedOccurrenceIds = nOccurrenceIds;
export const oOccurrenceIds = Object.freeze({
  intro: createOccurrenceId('surface-o-intro'),
  combat04: createOccurrenceId('surface-o-combat04'),
  combat07: createOccurrenceId('surface-o-combat07'),
  combat01: createOccurrenceId('surface-o-combat01'),
  devotion: createOccurrenceId('surface-o-devotion'),
  story: createOccurrenceId('surface-o-story'),
  combat02: createOccurrenceId('surface-o-combat02'),
  preboss: createOccurrenceId('surface-o-preboss'),
});
export const pOccurrenceIds = Object.freeze({
  intro: createOccurrenceId('surface-p-intro'),
  prebossShop: createOccurrenceId('surface-p-preboss-shop'),
  prebossReward: createOccurrenceId('surface-p-preboss-reward'),
});
export const qOccurrenceIds = Object.freeze({
  intro: createOccurrenceId('surface-q-intro'),
  foyer: createOccurrenceId('surface-q-foyer'),
  firstFork: createOccurrenceId('surface-q-first-fork'),
  firstMiniboss1: createOccurrenceId('surface-q-first-miniboss-1'),
  firstMiniboss2: createOccurrenceId('surface-q-first-miniboss-2'),
  ordinary: createOccurrenceId('surface-q-ordinary'),
  secondFork: createOccurrenceId('surface-q-second-fork'),
  secondMiniboss1: createOccurrenceId('surface-q-second-miniboss-1'),
  secondMiniboss2: createOccurrenceId('surface-q-second-miniboss-2'),
  preboss: createOccurrenceId('surface-q-preboss'),
});
export const nOpenSlotKeys = [
  'combat11',
  'combat10',
  'combat09',
  'combat05',
  'combat03',
  'combat02',
  'combat01',
  'miniBoss01',
  'combat23',
] as const;
export const nVisitSlotKeys = [
  'combat05',
  'miniBoss01',
  'combat02',
  'combat11',
  'combat23',
  'combat09',
] as const;

export function nOccurrenceId(slotKey: string): OccurrenceId {
  return createOccurrenceId(`surface-n-${slotKey}`);
}
export function nLocalOccurrenceId(slotKey: string, localSlotKey: string): OccurrenceId {
  return createOccurrenceId(`surface-n-${slotKey}-${localSlotKey}`);
}
export function nLocalOccurrenceIdsBySlot(slotKey: string): Readonly<Record<string, OccurrenceId>> {
  const hub = catalog.biomeLayouts.byKey.N?.progression;
  const hubSlot =
    hub?.kind === 'hub' ? hub.slots.find((slot) => slot.slotKey === slotKey) : undefined;
  const room = hubSlot === undefined ? undefined : catalog.rooms.byKey[hubSlot.roomGameName];
  const group = room?.localChildren[0];
  return Object.freeze(
    Object.fromEntries(
      group?.kind === 'fixedRoomSlots'
        ? group.slots.map((slot) => [slot.slotKey, nLocalOccurrenceId(slotKey, slot.slotKey)])
        : [],
    ),
  );
}
export function pOccurrenceId(
  gameName: string,
  batchIndex: number,
  exitIndex: number,
): OccurrenceId {
  return createOccurrenceId(`surface-p-${batchIndex}-${exitIndex}-${gameName.toLowerCase()}`);
}

export function createRepresentativeNProject(
  options: CompleteNFixtureOptions = {},
): ProjectDocument {
  if (Object.keys(options).length === 0) return loadSurfaceNCheckpoint();
  let project = loadSurfaceNCheckpoint();
  const openSlotKeys = options.openSlotKeys ?? nOpenSlotKeys;
  const visitSlotKeys = options.visitSlotKeys ?? nVisitSlotKeys;
  project = applyProjectCommand(project, catalog, {
    kind: 'RemoveHubDecision',
    hub: createHubDecisionAddress(nBiome, 'hub'),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceWithHubDecision',
    decision: createExitDecisionAddress(nBiome, source(nOccurrenceIds.preHub)),
    hub: createHubDecisionAddress(nBiome, 'hub'),
  });
  for (const slotKey of openSlotKeys) {
    project = applyProjectCommand(project, catalog, {
      kind: 'OpenHubSlot',
      slot: createHubSlotAddress(nBiome, 'hub', slotKey),
      occurrenceId: nOccurrenceId(slotKey),
      localOccurrenceIdsBySlot: nLocalOccurrenceIdsBySlot(slotKey),
    });
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceHubVisitOrder',
    hub: createHubDecisionAddress(nBiome, 'hub'),
    hubSlotKeys: visitSlotKeys,
  });
  project = configureNSideRooms(project);
  for (const [slotKey, value] of Object.entries({
    combat01: { rewardType: 'MaxHealthDropBig' },
    combat02: { rewardType: 'MaxManaDropBig' },
    combat03: { rewardType: 'WeaponUpgrade' },
    combat05: { rewardType: 'HermesUpgrade' },
    combat09: { rewardType: 'SpellDrop' },
    combat10: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource' as const, source: 'AphroditeUpgrade' },
    },
    combat11: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource' as const, source: 'AresUpgrade' },
    },
    combat23: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource' as const, source: 'ApolloUpgrade' },
    },
    miniBoss01: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource' as const, source: 'HephaestusUpgrade' },
    },
  } satisfies Readonly<Record<string, ResolvedRewardOffer>>)) {
    if (!openSlotKeys.includes(slotKey)) continue;
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, nOccurrenceId(slotKey)),
      value,
    });
  }
  if (options.includePreboss !== false) {
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTakeoverBatch',
      decision: createExitDecisionAddress(nBiome, { kind: 'hubDecision', decisionKey: 'hub' }),
      gameName: 'N_PreBoss01',
      targetOccurrenceIds: { preboss: nOccurrenceIds.preboss },
    });
    project = authorSurfaceWorldShop(project, nBiome, nOccurrenceIds.preboss);
  }
  return authorRequiredTestRoomActions(authorLegalTraitOffers(project), catalog);
}
export function createRepresentativeNOProject(): ProjectDocument {
  return loadSurfaceNOCheckpoint();
}
export function createRepresentativeNOPProject(): ProjectDocument {
  return loadSurfaceNOPCheckpoint();
}
export function createRepresentativeNOPQProject(): ProjectDocument {
  return loadSurfaceNOPQCheckpoint();
}

function source(occurrenceId: OccurrenceId) {
  return { kind: 'occurrence' as const, occurrenceId };
}

export function appendNEntry(project: ProjectDocument): ProjectDocument {
  let next = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: nBiome,
    occurrenceId: nOccurrenceIds.opening,
  });
  next = applyProjectCommand(next, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(nBiome, nOccurrenceIds.opening),
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
  });
  const openingDecision = createExitDecisionAddress(nBiome, source(nOccurrenceIds.opening));
  next = applyProjectCommand(next, catalog, {
    kind: 'CreateBatch',
    decision: openingDecision,
  });
  next = applyProjectCommand(next, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(nBiome, openingDecision.source, 'prehub'),
    occurrenceId: nOccurrenceIds.preHub,
    gameName: 'N_PreHub01',
  });
  next = applyProjectCommand(next, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(nBiome, nOccurrenceIds.preHub),
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'AresUpgrade' } },
  });
  return applyProjectCommand(next, catalog, {
    kind: 'CreateBatch',
    decision: createExitDecisionAddress(nBiome, source(nOccurrenceIds.preHub)),
  });
}

export interface CompleteNFixtureOptions {
  readonly includePreboss?: boolean;
  readonly openSlotKeys?: readonly string[];
  readonly visitSlotKeys?: readonly string[];
}

export function appendCompleteN(
  project: ProjectDocument,
  options: CompleteNFixtureOptions = {},
): ProjectDocument {
  const openSlotKeys = options.openSlotKeys ?? nOpenSlotKeys;
  const visitSlotKeys = options.visitSlotKeys ?? nVisitSlotKeys;
  let next = appendNEntry(project);
  next = applyProjectCommand(next, catalog, {
    kind: 'ReplaceWithHubDecision',
    decision: createExitDecisionAddress(nBiome, source(nOccurrenceIds.preHub)),
    hub: createHubDecisionAddress(nBiome, 'hub'),
  });
  for (const hubSlotKey of openSlotKeys) {
    next = applyProjectCommand(next, catalog, {
      kind: 'OpenHubSlot',
      slot: createHubSlotAddress(nBiome, 'hub', hubSlotKey),
      occurrenceId: nOccurrenceId(hubSlotKey),
      localOccurrenceIdsBySlot: nLocalOccurrenceIdsBySlot(hubSlotKey),
    });
  }
  next = applyProjectCommand(next, catalog, {
    kind: 'ReplaceHubVisitOrder',
    hub: createHubDecisionAddress(nBiome, 'hub'),
    hubSlotKeys: visitSlotKeys,
  });
  next = configureNSideRooms(next);
  for (const [slotKey, value] of Object.entries({
    combat01: { rewardType: 'MaxHealthDropBig' },
    combat02: { rewardType: 'MaxManaDropBig' },
    combat03: { rewardType: 'WeaponUpgrade' },
    combat05: { rewardType: 'HermesUpgrade' },
    combat09: { rewardType: 'SpellDrop' },
    combat10: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource' as const, source: 'AphroditeUpgrade' },
    },
    combat11: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource' as const, source: 'AresUpgrade' },
    },
    combat23: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource' as const, source: 'ApolloUpgrade' },
    },
    miniBoss01: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource' as const, source: 'HephaestusUpgrade' },
    },
  } satisfies Readonly<Record<string, ResolvedRewardOffer>>)) {
    if (!openSlotKeys.includes(slotKey)) continue;
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, nOccurrenceId(slotKey)),
      value,
    });
  }
  if (options.includePreboss === false) return authorLegalTraitOffers(next);
  next = applyProjectCommand(next, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: createExitDecisionAddress(nBiome, { kind: 'hubDecision', decisionKey: 'hub' }),
    gameName: 'N_PreBoss01',
    targetOccurrenceIds: { preboss: nOccurrenceIds.preboss },
  });
  return authorLegalTraitOffers(authorSurfaceWorldShop(next, nBiome, nOccurrenceIds.preboss));
}

export function authorSurfaceWorldShop(
  project: ProjectDocument,
  biome: ReturnType<typeof createBiomeAddress>,
  occurrenceId: OccurrenceId,
): ProjectDocument {
  let next = project;
  for (const [offerKey, value] of Object.entries({
    Boon: {
      rewardType: 'RandomLoot',
      payload: { kind: 'BoonSource' as const, source: 'ApolloUpgrade' },
    },
    MajorNonBoon: { rewardType: 'MaxHealthDrop' },
    Minor: { rewardType: 'MaxManaDrop' },
  } satisfies Readonly<Record<string, ResolvedRewardOffer>>)) {
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceShopOffer',
      offer: createShopOfferAddress(biome, occurrenceId, offerKey),
      value,
    });
  }
  return next;
}

export function createRepresentativeNOPQShopTraitProject(): ProjectDocument {
  let project = createRepresentativeNOPQProject();
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopOffer',
    offer: createShopOfferAddress(pBiome, pOccurrenceIds.prebossShop, 'MajorNonBoon'),
    value: { rewardType: 'WeaponUpgradeDrop' },
  });
  project = replaceTestShopOfferActions(
    project,
    catalog,
    createOccurrenceAddress(pBiome, pOccurrenceIds.prebossShop),
    ['MajorNonBoon'],
  );
  return authorLegalTraitOffers(project);
}

function configureNSideRooms(project: ProjectDocument): ProjectDocument {
  let next = project;
  for (const [parentSlotKey, sideSlotKeys] of Object.entries({
    combat05: ['sideDoor1', 'sideDoor2', 'sideDoor3'],
    combat02: ['sideDoor1', 'sideDoor2'],
    combat11: ['sideDoor1'],
  })) {
    for (const sideSlotKey of sideSlotKeys) {
      next = applyProjectCommand(next, catalog, {
        kind: 'SetLocalVisitGeneration',
        slot: createLocalVisitSlotAddress(
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
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceLocalVisitOrder',
      order: createLocalVisitOrderAddress(nBiome, nOccurrenceId(parentSlotKey), 'sideRooms'),
      occurrenceIds: enteredSlotKeys.map((slotKey) => nLocalOccurrenceId(parentSlotKey, slotKey)),
    });
  }
  for (const [parentSlotKey, sideSlotKey, rewardType] of [
    ['combat05', 'sideDoor1', 'MaxManaDropSmall'],
    ['combat05', 'sideDoor2', 'MaxHealthDropSmall'],
    ['combat05', 'sideDoor3', 'EmptyMaxHealthSmallDrop'],
    ['combat02', 'sideDoor1', 'RoomMoneyTinyDrop'],
    ['combat02', 'sideDoor2', 'AirBoost'],
    ['combat11', 'sideDoor1', 'EarthBoost'],
  ] as const) {
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, nLocalOccurrenceId(parentSlotKey, sideSlotKey)),
      value: { rewardType },
    });
  }
  return next;
}

export type { ResolvedRewardOffer };
export { authorLegalTraitOffers, authorRequiredTestRoomActions };
