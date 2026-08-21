import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createShopOfferAddress,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { authorLegalTraitOffers, replaceTestShopOfferActions } from '../shared';
import {
  loadSurfaceNCheckpoint,
  loadSurfaceNCompleteHubFrontierCheckpoint,
  loadSurfaceNEntryFrontierCheckpoint,
  loadSurfaceNEntryFrontierResolvedCheckpoint,
  loadSurfaceNPartialHubCheckpoint,
  loadSurfaceNStoryBoardCheckpoint,
  loadSurfaceNTenOpenInvalidCheckpoint,
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

export function loadSurfaceNProject(): ProjectDocument {
  return loadSurfaceNCheckpoint();
}

export function loadSurfaceNEntryFrontierProject(): ProjectDocument {
  return loadSurfaceNEntryFrontierCheckpoint();
}

export function loadSurfaceNEntryFrontierResolvedProject(): ProjectDocument {
  return loadSurfaceNEntryFrontierResolvedCheckpoint();
}

export function loadSurfaceNCompleteHubFrontierProject(): ProjectDocument {
  return loadSurfaceNCompleteHubFrontierCheckpoint();
}

export function loadSurfaceNPartialHubProject(): ProjectDocument {
  return loadSurfaceNPartialHubCheckpoint();
}

export function loadSurfaceNStoryBoardProject(): ProjectDocument {
  return loadSurfaceNStoryBoardCheckpoint();
}

export function loadSurfaceNTenOpenInvalidProject(): ProjectDocument {
  return loadSurfaceNTenOpenInvalidCheckpoint();
}

export function loadSurfaceNOProject(): ProjectDocument {
  return loadSurfaceNOCheckpoint();
}

export function loadSurfaceNOPProject(): ProjectDocument {
  return loadSurfaceNOPCheckpoint();
}

export function loadSurfaceNOPQProject(): ProjectDocument {
  return loadSurfaceNOPQCheckpoint();
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
  let project = loadSurfaceNOPQProject();
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

export { authorLegalTraitOffers };
export type { ResolvedRewardOffer };
