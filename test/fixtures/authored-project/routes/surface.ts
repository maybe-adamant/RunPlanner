import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createShopOfferAddress,
  hermesShrineDeliveryEntryKey,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { authorLegalTraitOffers, replaceTestShopOfferActions } from '../shared';
import {
  loadSurfaceNCheckpoint,
  loadSurfaceNNaturalSelectionFrontierCheckpoint,
  loadSurfaceNQueensRansomCheckpoint,
  loadSurfaceNSteadyGrowthFrontierCheckpoint,
  loadSurfaceNCompleteHubFrontierCheckpoint,
  loadSurfaceNEntryFrontierCheckpoint,
  loadSurfaceNEntryFrontierResolvedCheckpoint,
  loadSurfaceNPartialHubCheckpoint,
  loadSurfaceNResourcesCheckpoint,
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

export function createSurfaceNOHermesShrineDeliveryCheckpoint(): ProjectDocument {
  let project = loadSurfaceNOProject();
  const shrine = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
  project = applyProjectCommand(project, catalog, {
    kind: 'SetHermesShrinePresence',
    occurrence: shrine,
    present: true,
  });
  for (const [slotKey, rewardType] of [
    ['first', 'HealBigDrop'],
    ['secondLeft', 'MaxHealthDrop'],
    ['secondRight', 'MaxManaDrop'],
  ] as const) {
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceHermesShrineOffer',
      occurrence: shrine,
      slotKey,
      value: { rewardType },
    });
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'SetHermesShrinePurchase',
    occurrence: shrine,
    generationKey: 'initial:first',
    purchase: { delay: 2, rushed: true },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetHermesShrinePurchase',
    occurrence: shrine,
    generationKey: 'initial:secondLeft',
    purchase: { delay: 2, rushed: false },
  });
  const deliveryHost = createOccurrenceAddress(oBiome, oOccurrenceIds.devotion);
  return applyProjectCommand(project, catalog, {
    kind: 'PlaceHermesShrineDelivery',
    entry: createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(deliveryHost, 'hermesShrineDelivery'),
      hermesShrineDeliveryEntryKey(shrine, 'initial:secondLeft'),
    ),
    encounterPhaseKey: 'Encounter',
  });
}

/**
 * A reached N Hub checkpoint whose visited side-room Shrine schedules a later
 * main-room delivery. The delivery remains intentionally unplaced so the
 * workspace can witness the required host footprint before materialization.
 */
export function createSurfaceNShrineSideRoomDeliveryCheckpoint(): ProjectDocument {
  const source = createOccurrenceAddress(nBiome, nLocalOccurrenceId('combat11', 'sideDoor1'));
  let project = loadSurfaceNProject();
  project = applyProjectCommand(project, catalog, {
    kind: 'SetHermesShrinePresence',
    occurrence: source,
    present: true,
  });
  for (const [slotKey, rewardType] of [
    ['first', 'HealBigDrop'],
    ['secondLeft', 'MaxHealthDrop'],
    ['secondRight', 'MaxManaDrop'],
  ] as const) {
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceHermesShrineOffer',
      occurrence: source,
      slotKey,
      value: { rewardType },
    });
  }
  return applyProjectCommand(project, catalog, {
    kind: 'SetHermesShrinePurchase',
    occurrence: source,
    generationKey: 'initial:secondLeft',
    purchase: { delay: 2, rushed: false },
  });
}

export function loadSurfaceNNaturalSelectionFrontierProject(): ProjectDocument {
  return loadSurfaceNNaturalSelectionFrontierCheckpoint();
}

export function loadSurfaceNQueensRansomProject(): ProjectDocument {
  return loadSurfaceNQueensRansomCheckpoint();
}

export function loadSurfaceNSteadyGrowthFrontierProject(): ProjectDocument {
  return loadSurfaceNSteadyGrowthFrontierCheckpoint();
}

export function loadSurfaceNResourcesProject(): ProjectDocument {
  return loadSurfaceNResourcesCheckpoint();
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
  return authorForcedShrines(loadSurfaceNOCheckpoint(), [nBiome, oBiome]);
}

/** Schema-58 completion detail for forced Postboss Shrines reached by this fixture. */
function authorForcedShrines(
  project: ProjectDocument,
  biomes: readonly ReturnType<typeof createBiomeAddress>[],
): ProjectDocument {
  let next = project;
  for (const biome of biomes) {
    next = authorForcedShrine(next, biome);
  }
  return next;
}

function authorForcedShrine(
  project: ProjectDocument,
  biome: ReturnType<typeof createBiomeAddress>,
): ProjectDocument {
  const occurrence = createOccurrenceAddress(
    biome,
    createOccurrenceId(
      `${
        {
          N: 'surface-n-preboss',
          O: 'surface-o-preboss',
          P: 'surface-p-preboss-shop',
        }[biome.biomeKey] ?? `surface-${biome.biomeKey.toLowerCase()}-preboss`
      }:postboss`,
    ),
  );
  let next = project;
  for (const [slotKey, rewardType] of [
    ['first', 'HealBigDrop'],
    ['secondLeft', 'MaxHealthDrop'],
    ['secondRight', 'MaxManaDrop'],
  ] as const) {
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceHermesShrineOffer',
      occurrence,
      slotKey,
      value: { rewardType },
    });
  }
  return next;
}

export function loadSurfaceNOPProject(): ProjectDocument {
  return authorForcedShrines(loadSurfaceNOPCheckpoint(), [nBiome, oBiome, pBiome]);
}

export function loadSurfaceNOPQProject(): ProjectDocument {
  return authorForcedShrines(loadSurfaceNOPQCheckpoint(), [nBiome, oBiome, pBiome]);
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
