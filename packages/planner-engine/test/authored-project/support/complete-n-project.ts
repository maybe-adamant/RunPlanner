import { catalog } from '@run-planner/hades2-catalog';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
import {
  applyProjectCommand,
  createBiomeAddress,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  createIncomingRewardAddress,
  createLocalVisitSlotAddress,
  createLocalVisitOrderAddress,
  createOccurrenceId,
  createProjectDocument,
  createShopOfferAddress,
  createTargetAddress,
  createTraitOfferAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';

const nBiome = createBiomeAddress('Surface', 'N');

export function nLocalOccurrenceId(slotKey: string, localSlotKey: string) {
  return createOccurrenceId(`round-trip-n-${slotKey}-${localSlotKey}`);
}

export function nLocalOccurrenceIdsBySlot(
  slotKey: string,
): Readonly<Record<string, ReturnType<typeof createOccurrenceId>>> {
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

export function createCompleteNProject(): ProjectDocument {
  let document = applyProjectCommand(
    createProjectDocument(catalog, {
      projectId: 'authored-complete-n',
      routeKey: 'Surface',
      configuredBiomeCount: 1,
    }),
    catalog,
    {
      kind: 'CreateStart',
      biome: nBiome,
      occurrenceId: createOccurrenceId('round-trip-n-opening'),
    },
  );
  document = applyProjectCommand(document, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(nBiome, createOccurrenceId('round-trip-n-opening')),
    value: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'AphroditeUpgrade' },
    },
  });
  document = applyProjectCommand(document, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(
      createIncomingRewardAddress(nBiome, createOccurrenceId('round-trip-n-opening')),
      'source',
    ),
    value: {
      kind: 'traits',
      giverKey: 'Aphrodite',
      options: [
        { traitKey: 'AphroditeWeaponBoon', rarity: 'Common' },
        { traitKey: 'AphroditeSpecialBoon', rarity: 'Common' },
        { traitKey: 'AphroditeCastBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
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
  document = applyProjectCommand(document, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(nBiome, createOccurrenceId('round-trip-n-prehub')),
    value: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
    },
  });
  document = applyProjectCommand(document, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(
      createIncomingRewardAddress(nBiome, createOccurrenceId('round-trip-n-prehub')),
      'source',
    ),
    value: {
      kind: 'traits',
      giverKey: 'Apollo',
      options: [
        { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option2',
    },
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
      localOccurrenceIdsBySlot: nLocalOccurrenceIdsBySlot(slotKey),
    });
  }
  for (const [slotKey, value] of Object.entries({
    combat01: { rewardType: 'MaxHealthDropBig' },
    combat02: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource' as const, source: 'AphroditeUpgrade' },
    },
    combat03: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource' as const, source: 'ZeusUpgrade' },
    },
    combat04: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource' as const, source: 'ApolloUpgrade' },
    },
    combat05: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource' as const, source: 'AresUpgrade' },
    },
    combat06: { rewardType: 'HermesUpgrade' },
    combat07: { rewardType: 'WeaponUpgrade' },
    combat08: { rewardType: 'MaxManaDropBig' },
    combat09: { rewardType: 'SpellDrop' },
  } as const)) {
    document = applyProjectCommand(document, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, createOccurrenceId(`round-trip-n-${slotKey}`)),
      value,
    });
  }
  for (const [slotKey, giverKey, options] of [
    ['combat02', 'Aphrodite', ['AphroditeWeaponBoon', 'AphroditeSpecialBoon', 'AphroditeCastBoon']],
    ['combat03', 'Zeus', ['ZeusManaBoltBoon', 'BoltRetaliateBoon', 'FocusLightningBoon']],
    ['combat04', 'Apollo', ['ApolloCastBoon', 'ApolloSprintBoon', 'ApolloManaBoon']],
    [
      'combat05',
      'Ares',
      ['MissingHealthCritBoon', 'LowHealthLifestealBoon', 'OmegaDelayedDamageBoon'],
    ],
    ['combat06', 'Hermes', ['SprintShieldBoon', 'SorcerySpeedBoon', 'DodgeChanceBoon']],
  ] as const) {
    document = applyProjectCommand(document, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(
        createIncomingRewardAddress(nBiome, createOccurrenceId(`round-trip-n-${slotKey}`)),
        slotKey === 'combat06' ? 'self' : 'source',
      ),
      value: {
        kind: 'traits',
        giverKey,
        options: [
          { traitKey: options[0], rarity: 'Common' },
          { traitKey: options[1], rarity: 'Common' },
          { traitKey: options[2], rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
    });
  }
  document = applyProjectCommand(document, catalog, {
    kind: 'ReplaceHubVisitOrder',
    hub: createHubDecisionAddress(nBiome, 'hub'),
    hubSlotKeys: ['combat01', 'combat02', 'combat03', 'combat04', 'combat05', 'combat06'],
  });
  document = applyProjectCommand(document, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: createExitDecisionAddress(nBiome, {
      kind: 'hubDecision',
      decisionKey: 'hub',
    }),
    gameName: 'N_PreBoss01',
    targetOccurrenceIds: { preboss: createOccurrenceId('round-trip-n-preboss') },
  });
  for (const [offerKey, value] of Object.entries({
    Boon: {
      rewardType: 'RandomLoot' as const,
      payload: { kind: 'BoonSource' as const, source: 'ApolloUpgrade' as const },
    },
    MajorNonBoon: { rewardType: 'MaxHealthDrop' as const },
    Minor: { rewardType: 'MaxManaDrop' as const },
  })) {
    document = applyProjectCommand(document, catalog, {
      kind: 'ReplaceShopOffer',
      offer: createShopOfferAddress(nBiome, createOccurrenceId('round-trip-n-preboss'), offerKey),
      value,
    });
  }
  return applyProjectCommand(document, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(
      createShopOfferAddress(nBiome, createOccurrenceId('round-trip-n-preboss'), 'Boon'),
      'source',
    ),
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

/** Complete N setup with one entered local room for lifecycle tests. */
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
      payload: { kind: 'BoonSource', source: 'AphroditeUpgrade' },
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetLocalVisitGeneration',
    slot: createLocalVisitSlotAddress(nBiome, nCombatId, 'sideRooms', 'sideDoor2'),
    generation: 'generated',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetLocalVisitGeneration',
    slot: createLocalVisitSlotAddress(nBiome, nCombatId, 'sideRooms', 'sideDoor1'),
    generation: 'generated',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(nBiome, nLocalOccurrenceId('combat02', 'sideDoor1')),
    value: { rewardType: 'MaxHealthDropSmall' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(nBiome, nLocalOccurrenceId('combat02', 'sideDoor2')),
    value: { rewardType: 'MaxManaDropSmall' },
  });
  return authorLegalTraitOffers(
    applyProjectCommand(project, catalog, {
      kind: 'ReplaceLocalVisitOrder',
      order: createLocalVisitOrderAddress(nBiome, nCombatId, 'sideRooms'),
      occurrenceIds: [nLocalOccurrenceId('combat02', 'sideDoor1')],
    }),
  );
}
