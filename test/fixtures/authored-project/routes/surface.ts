import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createBiomeAddress,
  createLocalVisitOrderAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  createEncounterPhaseAddress,
  createFountainRarityOutcomeAddress,
  createHubDecisionAddress,
  createHubFountainAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRouteAddress,
  createRoomActionAddress,
  createRouteStartKeepsakeSelectionAddress,
  createAcquisitionRoleAddress,
  createShopOfferAddress,
  createTraitOfferAddress,
  roomActionKey,
  hermesShrineDeliveryEntryKey,
  semanticAddressKey,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import {
  derivedAcquisitionEntriesForProjectEvaluationAssembly,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import {
  authorLegalTraitOffers,
  hubVisitActions,
  replaceTestShopOfferActions,
  supportedTraitOffer,
  purchaseTestHermesShrineOffer,
} from '../shared';
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

/** Purchased Q World Shop Anvil on the complete Surface route. */
export function surfaceAnvilProject(): ProjectDocument {
  const anvilShop = createOccurrenceAddress(qBiome, qOccurrenceIds.preboss);
  const anvilOffer = createShopOfferAddress(qBiome, qOccurrenceIds.preboss, 'PremiumProgress');
  let project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
    kind: 'ReplaceShopOffer',
    offer: anvilOffer,
    value: { rewardType: 'ChaosWeaponUpgrade' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceAnvilResult',
    acquisition: createAcquisitionRoleAddress(anvilOffer, 'self'),
    value: {
      kind: 'anvilOfFates',
      removedTraitKey: 'StaffDoubleAttackTrait',
      addedTraitKeys: ['StaffLongAttackTrait', 'StaffJumpSpecialTrait'],
    },
  });
  project = replaceTestShopOfferActions(project, catalog, anvilShop, ['PremiumProgress']);
  return authorLegalTraitOffers(project);
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

export function createSurfaceNOHermesShrineDeliveryCheckpoint(options?: {
  readonly placeDelayedDelivery?: boolean;
}): ProjectDocument {
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
  project = purchaseTestHermesShrineOffer(project, catalog, shrine, 'initial:first', {
    delay: 2,
    rushed: true,
  });
  project = purchaseTestHermesShrineOffer(project, catalog, shrine, 'initial:secondLeft', {
    delay: 3,
    rushed: false,
  });
  const deliveryHost = createOccurrenceAddress(oBiome, oOccurrenceIds.devotion);
  if (options?.placeDelayedDelivery === false) return project;
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
 * N/O route with two authored Mystery deliveries due in O Combat01: the N
 * Postboss Shrine's at Intro and the O Combat07 Shrine's at Combat1. Later O
 * reward authorship is not revalidated against the added boons.
 */
export function createSurfaceOSameRoomHermesDeliveriesCheckpoint(): {
  readonly project: ProjectDocument;
  readonly introEntry: ReturnType<typeof createAcquisitionEntryAddress>;
  readonly combatEntry: ReturnType<typeof createAcquisitionEntryAddress>;
} {
  const introSource = createOccurrenceAddress(
    nBiome,
    createOccurrenceId('surface-n-preboss:postboss'),
  );
  const combatSource = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
  const site = createAcquisitionSiteAddress(
    createOccurrenceAddress(oBiome, oOccurrenceIds.combat01),
    'hermesShrineDelivery',
  );
  const introEntry = createAcquisitionEntryAddress(
    site,
    hermesShrineDeliveryEntryKey(introSource, 'initial:secondLeft'),
  );
  const combatEntry = createAcquisitionEntryAddress(
    site,
    hermesShrineDeliveryEntryKey(combatSource, 'initial:secondLeft'),
  );
  let project = createSurfaceNOHermesShrineDeliveryCheckpoint({ placeDelayedDelivery: false });
  for (const [occurrence, delay, entry, encounterPhaseKey, source] of [
    [introSource, 5, introEntry, 'Intro', 'ApolloUpgrade'],
    [combatSource, 2, combatEntry, 'Combat1', 'HeraUpgrade'],
  ] as const) {
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceHermesShrineOffer',
      occurrence,
      slotKey: 'secondLeft',
      value: { rewardType: 'BlindBoxLoot' },
    });
    project = purchaseTestHermesShrineOffer(project, catalog, occurrence, 'initial:secondLeft', {
      delay,
      rushed: false,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'PlaceHermesShrineDelivery',
      entry,
      encounterPhaseKey,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry,
      value: { rewardType: 'BlindBoxLoot', payload: { kind: 'BoonSource', source } },
    });
    const trait = createTraitOfferAddress(entry, 'hiddenSource');
    const value = supportedTraitOffer(project, trait, source.replace('Upgrade', ''));
    if (value === undefined) throw new Error(`${source} has no supported Mystery offer`);
    project = applyProjectCommand(project, catalog, { kind: 'ReplaceTraitOffer', trait, value });
  }
  return Object.freeze({ project, introEntry, combatEntry });
}

/**
 * Complete N/O route with a purchased N Shrine Travel Deal and its placed O
 * Combat1 delivery.
 */
export function surfaceShrineTravelDealProject(): ProjectDocument {
  const shrine = createOccurrenceAddress(nBiome, createOccurrenceId('surface-n-preboss:postboss'));
  const travelDealSource = createIncomingRewardAddress(nBiome, nOccurrenceId('combat09'));
  let project = loadSurfaceNOProject();
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat05')),
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'AresUpgrade' } },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: travelDealSource,
    value: { rewardType: 'HermesUpgrade' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(travelDealSource, 'self'),
    value: {
      kind: 'traits',
      giverKey: 'Hermes',
      options: [
        { traitKey: 'RestockBoon', rarity: 'Epic' },
        { traitKey: 'HermesWeaponBoon', rarity: 'Rare' },
        { traitKey: 'SprintShieldBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceHermesShrineTravelDealRefill',
    occurrence: shrine,
    value: { rewardType: 'ArmorBoost' },
  });
  project = purchaseTestHermesShrineOffer(project, catalog, shrine, 'initial:first', {
    delay: 2,
    rushed: true,
  });
  project = purchaseTestHermesShrineOffer(project, catalog, shrine, 'travelDealRefill', {
    delay: 2,
    rushed: false,
  });
  return authorLegalTraitOffers(
    applyProjectCommand(project, catalog, {
      kind: 'PlaceHermesShrineDelivery',
      entry: createAcquisitionEntryAddress(
        createAcquisitionSiteAddress(
          createOccurrenceAddress(oBiome, oOccurrenceIds.combat04),
          'hermesShrineDelivery',
        ),
        hermesShrineDeliveryEntryKey(shrine, 'travelDealRefill'),
      ),
      encounterPhaseKey: 'Combat1',
    }),
  );
}

/** The Shrine sources of the complete-route delivery fixture. */
export const surfaceShrineDeliverySources = Object.freeze({
  nSideRoom: createOccurrenceAddress(nBiome, nLocalOccurrenceId('combat11', 'sideDoor1')),
  oShrine: createOccurrenceAddress(oBiome, oOccurrenceIds.combat07),
  pPostboss: createOccurrenceAddress(pBiome, createOccurrenceId('surface-p-preboss-shop:postboss')),
});

function authorOrdinaryShrine(
  project: ProjectDocument,
  occurrence: ReturnType<typeof createOccurrenceAddress>,
): ProjectDocument {
  let next = applyProjectCommand(project, catalog, {
    kind: 'SetHermesShrinePresence',
    occurrence,
    present: true,
  });
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

/** Places each due delivery at the host and phase the engine derives, in route order. */
function placeDueHermesShrineDeliveries(project: ProjectDocument): ProjectDocument {
  let next = project;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const assembly = simulateProjectAssembly(catalog, next);
    const required = assembly.evaluation.findings.find(
      (finding) => finding.code === 'hermesShrineDeliveryPlacementRequired',
    );
    if (required === undefined) return next;
    const origin = required.origin;
    if (origin.kind !== 'acquisitionEntry')
      throw new Error('Shrine delivery placement finding has no entry origin');
    const contact = derivedAcquisitionEntriesForProjectEvaluationAssembly(
      assembly,
      origin.site,
    ).find(
      (entry) =>
        entry.kind === 'hermesShrineDelivery' && entry.address.entryKey === origin.entryKey,
    );
    if (contact === undefined || contact.kind !== 'hermesShrineDelivery')
      throw new Error(`Shrine delivery ${origin.entryKey} has no derived due contact`);
    next = applyProjectCommand(next, catalog, {
      kind: 'PlaceHermesShrineDelivery',
      entry: contact.address,
      ...(contact.encounterPhaseKey === undefined
        ? {}
        : { encounterPhaseKey: contact.encounterPhaseKey }),
    });
  }
  throw new Error('Shrine delivery placement exceeded its bound');
}

/**
 * Complete N/O/P/Q route with every Shrine delivery contact: cross-biome
 * countdowns, a rushed ranked pickup, its Travel Deal refill, two deliveries
 * into one O host, and a P Postboss purchase flushed at Q Preboss.
 */
export function surfaceShrineDeliveriesProject(): ProjectDocument {
  const { nSideRoom, oShrine, pPostboss } = surfaceShrineDeliverySources;
  let project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(
      createIncomingRewardAddress(nBiome, nOccurrenceId('combat05')),
      'self',
    ),
    value: {
      kind: 'traits',
      giverKey: 'Hermes',
      options: [
        { traitKey: 'RestockBoon', rarity: 'Epic' },
        { traitKey: 'HermesWeaponBoon', rarity: 'Rare' },
        { traitKey: 'SprintShieldBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  project = authorLegalTraitOffers(project);
  project = authorOrdinaryShrine(project, nSideRoom);
  project = authorOrdinaryShrine(project, oShrine);
  for (const [occurrence, generationKey, delay, rushed] of [
    [nSideRoom, 'initial:secondLeft', 5, false],
    [nSideRoom, 'initial:secondRight', 8, false],
    [oShrine, 'initial:first', 2, true],
  ] as const) {
    project = purchaseTestHermesShrineOffer(project, catalog, occurrence, generationKey, {
      delay,
      rushed,
    });
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceHermesShrineTravelDealRefill',
    occurrence: oShrine,
    value: { rewardType: 'ArmorBoost' },
  });
  project = purchaseTestHermesShrineOffer(project, catalog, oShrine, 'travelDealRefill', {
    delay: 2,
    rushed: false,
  });
  project = purchaseTestHermesShrineOffer(project, catalog, pPostboss, 'initial:secondRight', {
    delay: 8,
    rushed: false,
  });
  return placeDueHermesShrineDeliveries(project);
}

/**
 * The complete delivery route with its rushed O pickup left unranked; the
 * rushed purchase still realizes its Travel Deal refill.
 */
export function surfaceShrineRushedUnrankedProject(): ProjectDocument {
  const project = surfaceShrineDeliveriesProject();
  const source = surfaceShrineDeliverySources.oShrine;
  const rushedKey = hermesShrineDeliveryEntryKey(source, 'initial:first');
  const rushed = project.route.biomes
    .find((biome) => biome.biomeKey === oBiome.biomeKey)
    ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === source.occurrenceId)
    ?.roomActions.order.find(
      (reference) =>
        reference.kind === 'interactAcquisitionEntry' && reference.entryKey === rushedKey,
    );
  if (rushed === undefined) throw new Error('rushed O Shrine pickup is not ranked');
  return applyProjectCommand(project, catalog, {
    kind: 'RemoveRoomAction',
    action: createRoomActionAddress(oBiome, source.occurrenceId, roomActionKey(rushed)),
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
  return purchaseTestHermesShrineOffer(project, catalog, source, 'initial:secondLeft', {
    delay: 2,
    rushed: false,
  });
}

/**
 * The same visited side-room Shrine with an unresolved Hermes delivery at the
 * fixed N Boss. Preboss has completed, Boss is the repair owner, and Postboss
 * has not been reached.
 */
export function createSurfaceNUnresolvedBossHermesDeliveryCheckpoint(): ProjectDocument {
  const source = createOccurrenceAddress(nBiome, nLocalOccurrenceId('combat11', 'sideDoor1'));
  let project = createSurfaceNShrineSideRoomDeliveryCheckpoint();
  project = applyProjectCommand(project, catalog, {
    kind: 'SetHermesShrinePurchase',
    occurrence: source,
    generationKey: 'initial:secondLeft',
    purchase: null,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceHermesShrineOffer',
    occurrence: source,
    slotKey: 'secondRight',
    value: { rewardType: 'BlindBoxLoot' },
  });
  project = purchaseTestHermesShrineOffer(project, catalog, source, 'initial:secondRight', {
    delay: 3,
    rushed: false,
  });
  const boss = createOccurrenceAddress(
    nBiome,
    createOccurrenceId(`${nOccurrenceIds.preboss}:boss`),
  );
  return applyProjectCommand(project, catalog, {
    kind: 'PlaceHermesShrineDelivery',
    entry: createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(boss, 'hermesShrineDelivery'),
      hermesShrineDeliveryEntryKey(source, 'initial:secondRight'),
    ),
    encounterPhaseKey: 'Encounter',
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

function authorSurfaceGeneratedPreCombat(project: ProjectDocument): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceEncounterCustomization',
    phase: createEncounterPhaseAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId: pOccurrenceId('P_Combat07', 4, 1) },
      'Intro',
    ),
    decisionKey: 'generatedComposition',
    value: {
      kind: 'generated',
      waveCount: 1,
      baseRoll: 412,
      waves: [{ waveIndex: 1, typeKeys: ['SentryBot', 'Dragon'], allocations: { SentryBot: 206 } }],
    },
  });
}

/** The variable-budget P pre-combat encounter with an authored native base roll. */
export function surfaceGeneratedPreCombatProject(): ProjectDocument {
  return applyProjectCommand(authorSurfaceGeneratedPreCombat(loadSurfaceNOPProject()), catalog, {
    kind: 'ReplaceAetosWave',
    phase: createEncounterPhaseAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId: pOccurrenceId('P_Combat03', 1, 1) },
      'Combat',
    ),
    value: 2,
  });
}

/** Q Boss egg choices retained as the producer for the existing N/O/P/Q execution wire. */
export function typhonCustomizationProject(): ProjectDocument {
  let project = loadSurfaceNOPQProject();
  const boss = project.route.biomes
    .find((biome) => biome.biomeKey === 'Q')
    ?.topology?.occurrences.find((occurrence) => occurrence.gameName === 'Q_Boss01');
  if (boss === undefined) throw new Error('Typhon fixture is missing its normal Head occurrence');
  const phase = createEncounterPhaseAddress(
    qBiome,
    { kind: 'occurrence', occurrenceId: boss.occurrenceId },
    'Encounter',
  );
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceEncounterCustomization',
    phase,
    decisionKey: 'firstEggWave',
    value: { kind: 'single', choiceKey: 'eidolons' },
  });
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceEncounterCustomization',
    phase,
    decisionKey: 'secondEggWave',
    value: { kind: 'single', choiceKey: 'lurkers' },
  });
}

/** A complete P/Q route with P's authored variable base roll and Q's egg choices. */
export function surfaceEncounterShowcaseProject(): ProjectDocument {
  return authorSurfaceGeneratedPreCombat(typhonCustomizationProject());
}

export const phialFountainPrecedingVisits = 3;
export const phialFountainTargetTraitKey = 'AresSpecialBoon';

/** Surface N with Aromatic Phial, used at the Hub after three visits on the Pre-Hub boon. */
export function surfaceNPhialIntermediateFountainProject(): ProjectDocument {
  let project = applyProjectCommand(loadSurfaceNProject(), catalog, {
    kind: 'ReplaceStartingKeepsake',
    selection: createRouteStartKeepsakeSelectionAddress('Surface'),
    keepsakeKey: 'FountainRarityKeepsake',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceHubActionOrder',
    hub: createHubDecisionAddress(nBiome, 'hub'),
    actions: hubVisitActions(nVisitSlotKeys, phialFountainPrecedingVisits),
  });
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceFountainRarityTarget',
    outcome: createFountainRarityOutcomeAddress(createHubFountainAddress(nBiome, 'hub')),
    targetTraitKey: phialFountainTargetTraitKey,
  });
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
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat03')),
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
  });
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

export const surfaceTravelDealRefillAnvilResult = Object.freeze({
  kind: 'anvilOfFates' as const,
  removedTraitKey: 'StaffDoubleAttackTrait',
  addedTraitKeys: Object.freeze(['StaffLongAttackTrait', 'StaffJumpSpecialTrait'] as const),
});

/**
 * Complete N/O/P/Q route whose N Combat09 Travel Deal reaches the Q Preboss
 * Shop; the purchased Health refill is replaced by an authored Anvil.
 */
export function surfaceTravelDealRefillAnvilProject(): ProjectDocument {
  const travelDealSource = createIncomingRewardAddress(nBiome, nOccurrenceId('combat09'));
  const shop = createOccurrenceAddress(qBiome, qOccurrenceIds.preboss);
  const refill = createShopOfferAddress(qBiome, qOccurrenceIds.preboss, 'travelDealRefill');
  let project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat05')),
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'AresUpgrade' } },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: travelDealSource,
    value: { rewardType: 'HermesUpgrade' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(travelDealSource, 'self'),
    value: {
      kind: 'traits',
      giverKey: 'Hermes',
      options: [
        { traitKey: 'RestockBoon', rarity: 'Epic' },
        { traitKey: 'HermesWeaponBoon', rarity: 'Rare' },
        { traitKey: 'SprintShieldBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopOffer',
    offer: createShopOfferAddress(qBiome, qOccurrenceIds.preboss, 'PremiumProgress'),
    value: { rewardType: 'MaxHealthDropBig' },
  });
  project = replaceTestShopOfferActions(project, catalog, shop, ['PremiumProgress']);
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopOffer',
    offer: refill,
    value: { rewardType: 'ChaosWeaponUpgrade' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceAnvilResult',
    acquisition: createAcquisitionRoleAddress(refill, 'self'),
    value: surfaceTravelDealRefillAnvilResult,
  });
  const reference = {
    kind: 'interactAcquisitionEntry' as const,
    siteKey: 'roomExit' as const,
    entryKey: 'travelDealRefill',
  };
  project = applyProjectCommand(project, catalog, {
    kind: 'InsertRoomAction',
    action: createRoomActionAddress(qBiome, qOccurrenceIds.preboss, roomActionKey(reference)),
    reference,
    index: 1,
  });
  return authorLegalTraitOffers(project);
}

/** The Path screen a reward's `self` role opens. */
function pathScreen(biome: typeof nBiome, occurrenceId: OccurrenceId) {
  return createAcquisitionRoleAddress(createIncomingRewardAddress(biome, occurrenceId), 'self');
}

/** A reached outdoor P combat with an Icarus-compatible incoming reward. */
export function reachedPOutdoorIcarusFixture() {
  const occurrenceId = pOccurrenceId('P_Combat07', 4, 1);
  let project = loadSurfaceNOPQProject();
  for (const [original, batch, slot, replacement] of [
    ['P_Combat11', 4, 2, 'P_Combat07'],
    ['P_Combat07', 4, 1, 'P_Combat11'],
    ['P_Combat09', 5, 2, 'P_Combat13'],
    ['P_Combat13', 6, 2, 'P_Combat09'],
  ] as const) {
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(pBiome, pOccurrenceId(original, batch, slot)),
      gameName: replacement,
    });
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(pBiome, occurrenceId),
    value: { rewardType: 'TalentDrop' },
  });
  // The Path drop's screen is authored like any other choice.
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceHexActivation',
    acquisition: pathScreen(pBiome, occurrenceId),
    value: { selectedNodeKeys: ['1:2', '1:4', '2:2'] },
  });
  return Object.freeze({
    project,
    occurrenceId,
    encounter: createEncounterPhaseAddress(pBiome, { kind: 'occurrence', occurrenceId }, 'Combat'),
  });
}

/** Complete N/O/P/Q route with an installed ordinary Hex and reached P Path grant. */
export function surfaceOrdinaryHexPathProject(): ProjectDocument {
  return authorLegalTraitOffers(reachedPOutdoorIcarusFixture().project);
}

/** Complete N/O/P/Q route with Aspect of Selene's installed Hex and reached Path grants. */
export function surfaceSeleneHexPathProject(): ProjectDocument {
  const fixture = reachedPOutdoorIcarusFixture();
  let project = applyProjectCommand(fixture.project, catalog, {
    kind: 'ReplaceRouteLoadout',
    route: createRouteAddress('Surface'),
    weaponKey: 'WeaponSuit',
    aspectKey: 'SuitHexAspect',
  });
  // Selene's N Spell Drop opens the first screen; P continues from it.
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceHexActivation',
    acquisition: pathScreen(pBiome, fixture.occurrenceId),
    value: { selectedNodeKeys: ['2:4', '3:1', '3:2'] },
  });
  return authorLegalTraitOffers(project, {
    [semanticAddressKey(pathScreen(nBiome, nOccurrenceId('combat09')))]: ['1:2', '1:4', '2:2'],
  });
}

export { authorLegalTraitOffers };
export type { ResolvedRewardOffer };

/** Portable loaded-save fixture retaining a delivery from an unvisited N side room. */
export function createStaleSurfaceHermesDeliveryPlacement() {
  const source = createOccurrenceAddress(nBiome, nLocalOccurrenceId('combat11', 'sideDoor1'));
  const host = createOccurrenceAddress(oBiome, oOccurrenceIds.devotion);
  const entryKey = hermesShrineDeliveryEntryKey(source, 'initial:first');
  let project = loadSurfaceNOProject();
  project = applyProjectCommand(project, catalog, {
    kind: 'SetHermesShrinePresence',
    occurrence: source,
    present: true,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceHermesShrineOffer',
    occurrence: source,
    slotKey: 'first',
    value: { rewardType: 'HealBigDrop' },
  });
  project = purchaseTestHermesShrineOffer(project, catalog, source, 'initial:first', {
    delay: 2,
    rushed: false,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'PlaceHermesShrineDelivery',
    entry: createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(host, 'hermesShrineDelivery'),
      entryKey,
    ),
    encounterPhaseKey: 'Encounter',
  });
  const placedHost = project.route.biomes
    .find((plan) => plan.biomeKey === host.biomeKey)
    ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === host.occurrenceId);
  if (placedHost === undefined) throw new Error('delivery fixture host missing');
  const withdrawn = applyProjectCommand(project, catalog, {
    kind: 'ReplaceLocalVisitOrder',
    order: createLocalVisitOrderAddress(nBiome, nOccurrenceId('combat11'), 'sideRooms'),
    occurrenceIds: [],
  });
  const loaded = decodeProjectDocument(
    JSON.parse(
      encodeProjectDocument({
        ...withdrawn,
        route: {
          ...withdrawn.route,
          biomes: withdrawn.route.biomes.map((plan) =>
            plan.biomeKey !== host.biomeKey || plan.topology === null
              ? plan
              : {
                  ...plan,
                  topology: {
                    ...plan.topology,
                    occurrences: plan.topology.occurrences.map((occurrence) =>
                      occurrence.occurrenceId === host.occurrenceId ? placedHost : occurrence,
                    ),
                  },
                },
          ),
        },
      }),
    ) as unknown,
    catalog,
  );
  return { project: loaded, source, host, entryKey };
}

export function createTwoStaleSurfaceHermesDeliveryPlacements() {
  const { project, host, source, entryKey } = createStaleSurfaceHermesDeliveryPlacement();
  const originalHost = project.route.biomes
    .find((biome) => biome.biomeKey === host.biomeKey)!
    .topology!.occurrences.find((room) => room.occurrenceId === host.occurrenceId)!;
  let second = applyProjectCommand(project, catalog, {
    kind: 'ReplaceHermesShrineOffer',
    occurrence: source,
    slotKey: 'secondLeft',
    value: { rewardType: 'MaxHealthDrop' },
  });
  second = purchaseTestHermesShrineOffer(second, catalog, source, 'initial:secondLeft', {
    delay: 2,
    rushed: false,
  });
  const secondEntryKey = hermesShrineDeliveryEntryKey(source, 'initial:secondLeft');
  second = applyProjectCommand(second, catalog, {
    kind: 'PlaceHermesShrineDelivery',
    entry: createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(host, 'hermesShrineDelivery'),
      secondEntryKey,
    ),
    encounterPhaseKey: 'Encounter',
  });
  // Retain both production-built placements to represent a loaded snapshot.
  const loaded = {
    ...second,
    route: {
      ...second.route,
      biomes: second.route.biomes.map((biome) =>
        biome.biomeKey !== host.biomeKey || biome.topology === null
          ? biome
          : {
              ...biome,
              topology: {
                ...biome.topology,
                occurrences: biome.topology.occurrences.map((room) =>
                  room.occurrenceId !== host.occurrenceId
                    ? room
                    : {
                        ...room,
                        roomActions: {
                          order: [
                            ...originalHost.roomActions.order,
                            ...room.roomActions.order.filter(
                              (reference) =>
                                !originalHost.roomActions.order.some(
                                  (original) =>
                                    roomActionKey(original) === roomActionKey(reference),
                                ),
                            ),
                          ],
                        },
                        acquisitionSites: {
                          ...room.acquisitionSites,
                          hermesShrineDelivery: {
                            pickupEntries: {
                              ...originalHost.acquisitionSites?.hermesShrineDelivery?.pickupEntries,
                              ...room.acquisitionSites?.hermesShrineDelivery?.pickupEntries,
                            },
                          },
                        },
                      },
                ),
              },
            },
      ),
    },
  };
  return {
    project: decodeProjectDocument(JSON.parse(encodeProjectDocument(loaded)) as unknown, catalog),
    host,
    source,
    entryKey,
    secondEntryKey,
  };
}
