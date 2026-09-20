import { generatedEncounterChoices } from './generated/policies';
import type { RawEncounterDefinitionDeclaration, RawEncounterSetDeclaration } from './types';
import {
  arachneEncounterKeys,
  arachneIncomingRewardExclusions,
  artemisEncounterKeys,
  artemisIncomingRewardExclusions,
  nemesisEncounterKeys,
  nemesisIncomingRewardExclusions,
  supportedFieldNpcEncounterKeys,
} from './shared';

export const fEncounterDefinitions = [
  {
    key: 'OpeningGeneratedF',
    label: 'Opening combat',
    kind: 'combat',
    countsEncounterDepth: true,
    blocksGorgon: true,
  },
  {
    key: 'GeneratedF',
    customization: [generatedEncounterChoices.GeneratedF],
    label: 'Combat',
    kind: 'combat',
    countsEncounterDepth: true,
    hostsGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'DevotionTestF',
    customization: [generatedEncounterChoices.DevotionTestF],
    label: 'Devotion combat',
    kind: 'combat',
    countsEncounterDepth: true,
    blocksGorgon: true,
  },
  {
    key: 'ArtemisCombatF',
    customization: [generatedEncounterChoices.ArtemisCombatF],
    label: 'Artemis combat',
    kind: 'combat',
    countsEncounterDepth: true,
    blocksGorgon: true,
    npcPresentationKey: 'Artemis',
    traitOfferProducer: { kind: 'traitOffer', giverKey: 'Artemis' },
    requirements: {
      kind: 'all',
      requirements: [
        { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 4 } },
        {
          kind: 'currentRoomRewardExcludes',
          rewardTypes: artemisIncomingRewardExclusions,
        },
        {
          kind: 'encounterKeyCount',
          scope: 'route',
          encounterKeys: artemisEncounterKeys,
          range: { max: 0 },
        },
        {
          kind: 'previousRoomEncounterKeyCount',
          encounterKeys: supportedFieldNpcEncounterKeys,
          roomWindow: 6,
          range: { max: 0 },
        },
      ],
    },
  },
  {
    key: 'ArachneCombatF',
    label: 'Arachne cocoon',
    kind: 'combat',
    countsEncounterDepth: false,
    blocksGorgon: true,
    npcPresentationKey: 'Arachne',
    requirements: {
      kind: 'all',
      requirements: [
        { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 4, max: 8 } },
        {
          kind: 'currentRoomRewardExcludes',
          rewardTypes: arachneIncomingRewardExclusions,
        },
        {
          kind: 'encounterKeyCount',
          scope: 'biome',
          encounterKeys: ['ArachneCombatF'],
          range: { max: 0 },
        },
        {
          kind: 'previousRoomEncounterKeyCount',
          encounterKeys: arachneEncounterKeys,
          roomWindow: 5,
          range: { max: 0 },
        },
      ],
    },
  },
  {
    key: 'NemesisCombatF',
    customization: [generatedEncounterChoices.NemesisCombatF],
    label: 'Nemesis combat',
    kind: 'combat',
    countsEncounterDepth: true,
    blocksGorgon: true,
    npcPresentationKey: 'Nemesis',
    requirements: {
      kind: 'all',
      requirements: [
        { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 4 } },
        {
          kind: 'currentRoomRewardExcludes',
          rewardTypes: nemesisIncomingRewardExclusions,
        },
        {
          kind: 'encounterKeyCount',
          scope: 'route',
          encounterKeys: nemesisEncounterKeys,
          range: { max: 0 },
        },
        {
          kind: 'previousRoomEncounterKeyCount',
          encounterKeys: supportedFieldNpcEncounterKeys,
          roomWindow: 6,
          range: { max: 0 },
        },
      ],
    },
  },
  {
    key: 'NemesisRandomEvent',
    label: 'Nemesis event',
    kind: 'nonCombat',
    countsEncounterDepth: false,
    blocksGorgon: true,
    npcPresentationKey: 'Nemesis',
    requiresInteraction: true,
    suppressesIncomingReward: true,
    nemesisRandomEvent: {
      freeItem: {
        resultRewardTypes: ['EmptyMaxHealthDrop', 'HealDrop', 'LastStandDrop', 'ArmorBoost'],
        conditionalResultRewardType: 'LastStandDrop',
        response: 'none',
        pickupRequired: false,
      },
      goldTrade: {
        variants: [
          {
            rewardType: 'MaxHealthDrop',
            enteredBiome: { max: 2 },
            requirement: 'none',
          },
          {
            rewardType: 'MaxHealthDropBig',
            enteredBiome: { min: 3 },
            requirement: 'none',
          },
          {
            rewardType: 'MaxManaDrop',
            enteredBiome: { max: 2 },
            requirement: 'none',
          },
          {
            rewardType: 'MaxManaDropBig',
            enteredBiome: { min: 3 },
            requirement: 'none',
          },
          {
            rewardType: 'StackUpgrade',
            enteredBiome: { max: 1 },
            requirement: 'pomLegal',
          },
          {
            rewardType: 'StackUpgradeBig',
            enteredBiome: { min: 2 },
            requirement: 'pomLegal',
          },
          {
            rewardType: 'WeaponUpgrade',
            enteredBiome: {},
            requirement: 'hammerEarlyOrLate',
          },
        ],
        response: ['accept', 'decline'],
        pickupRequiredOnAccept: true,
      },
      damageTrade: {
        variants: [
          {
            rewardType: 'MaxHealthDrop',
            enteredBiome: { max: 2 },
            requirement: 'none',
          },
          {
            rewardType: 'MaxHealthDropBig',
            enteredBiome: { min: 3 },
            requirement: 'none',
          },
          {
            rewardType: 'MaxManaDrop',
            enteredBiome: { max: 2 },
            requirement: 'none',
          },
          {
            rewardType: 'MaxManaDropBig',
            enteredBiome: { min: 3 },
            requirement: 'none',
          },
          {
            rewardType: 'StackUpgrade',
            enteredBiome: { max: 1 },
            requirement: 'pomLegal',
          },
          {
            rewardType: 'StackUpgradeBig',
            enteredBiome: { min: 2 },
            requirement: 'pomLegal',
          },
          {
            rewardType: 'RoomMoneyDrop',
            enteredBiome: { max: 1 },
            requirement: 'none',
          },
          {
            rewardType: 'RoomMoneyDrop',
            enteredBiome: { min: 2 },
            requirement: 'none',
          },
          {
            rewardType: 'TalentDrop',
            enteredBiome: {},
            requirement: 'talentLegal',
          },
        ],
        response: ['accept', 'decline'],
        pickupRequiredOnAccept: true,
      },
      traitTrade: {
        response: ['accept', 'decline'],
        pickupRequiredOnAccept: true,
        fixedResultRewardType: 'RoomMoneyTripleDrop',
        traitSelection: 'eligibleGodTraitCommonPriority',
      },
      damageContest: {
        successResultRewardTypes: [
          'MaxHealthDrop',
          'MaxManaDrop',
          'StackUpgrade',
          'RoomMoneyDrop',
          'TalentDrop',
        ],
        failureResultRewardType: 'RoomRewardConsolationPrize',
        response: 'none',
        pickupRequired: false,
      },
      hOptionalCapacityReservation: 1,
    },
    requirements: {
      kind: 'all',
      requirements: [
        { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 4 } },
        { kind: 'currentRoomRewardExcludes', rewardTypes: nemesisIncomingRewardExclusions },
        {
          kind: 'encounterKeyCount',
          scope: 'route',
          encounterKeys: nemesisEncounterKeys,
          range: { max: 0 },
        },
        {
          kind: 'previousRoomEncounterKeyCount',
          encounterKeys: supportedFieldNpcEncounterKeys,
          roomWindow: 6,
          range: { max: 0 },
        },
      ],
    },
  },
  {
    key: 'Story_Arachne_01',
    label: 'Arachne story',
    kind: 'story',
    countsEncounterDepth: false,
    npcPresentationKey: 'Arachne',
    traitOfferProducer: { kind: 'traitOffer', giverKey: 'Arachne' },
  },
  {
    key: 'MiniBossTreant',
    label: 'Treant',
    kind: 'miniboss',
    countsEncounterDepth: true,
    blocksGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'MiniBossFogEmitter',
    label: 'Fog emitter',
    kind: 'miniboss',
    countsEncounterDepth: true,
    blocksGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'MiniBossAssassin',
    label: 'Assassin',
    kind: 'miniboss',
    countsEncounterDepth: true,
    blocksGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'MiniBossTreant_Shrine',
    label: 'Treant',
    kind: 'miniboss',
    countsEncounterDepth: true,
    blocksGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'MiniBossFogEmitter_Shrine',
    label: 'Fog emitter',
    kind: 'miniboss',
    countsEncounterDepth: true,
    blocksGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'BossHecate01',
    label: 'Hecate',
    kind: 'boss',
    countsEncounterDepth: false,
    blocksGorgon: true,
    customization: [
      {
        key: 'interlude',
        label: 'Interlude pattern',
        selection: {
          kind: 'single',
          choices: [
            { key: 'largeMeteors', label: 'Large meteors', nativeId: 'HecateMeteorShower' },
            { key: 'smallMeteors', label: 'Small meteors', nativeId: 'HecateMeteorSmallShower' },
            { key: 'rings', label: 'Expanding Ring', nativeId: 'HecateRangedTorchesRingPhase' },
            { key: 'spirals', label: 'Torch Orbs', nativeId: 'HecateRangedTorchesSpiralsPhase' },
            { key: 'laser', label: 'Lunar Ray', nativeId: 'HecateLaser' },
            { key: 'cones', label: 'Arc Projectiles', nativeId: 'HecateRangedTorchesConePhase' },
          ],
        },
      },
    ],
  },
  {
    key: 'BossHecate02',
    label: 'Hecate',
    kind: 'boss',
    countsEncounterDepth: false,
    blocksGorgon: true,
    customization: [
      {
        key: 'interlude',
        label: 'Interlude pattern',
        selection: {
          kind: 'single',
          choices: [
            { key: 'largeMeteors', label: 'Large meteors', nativeId: 'HecateMeteorShower_EM' },
            { key: 'smallMeteors', label: 'Small meteors', nativeId: 'HecateMeteorSmallShower_EM' },
            { key: 'rings', label: 'Expanding Ring', nativeId: 'HecateRangedTorchesRingPhase_EM' },
            { key: 'spirals', label: 'Torch Orbs', nativeId: 'HecateRangedTorchesSpiralsPhase_EM' },
            { key: 'laser', label: 'Lunar Ray', nativeId: 'HecateLaser_EM' },
            { key: 'cones', label: 'Arc Projectiles', nativeId: 'HecateRangedTorchesConePhase_EM' },
          ],
        },
      },
    ],
  },
] as const satisfies readonly RawEncounterDefinitionDeclaration[];

export const fEncounterSets = [
  {
    key: 'FEncountersDefault',
    encounterDefinitionKeys: [
      'GeneratedF',
      'DevotionTestF',
      'ArtemisCombatF',
      'ArachneCombatF',
      'NemesisCombatF',
      'NemesisRandomEvent',
    ],
    defaultAuthoringProfileKey: 'GeneratedF',
    authoringProfiles: [
      {
        key: 'GeneratedF',
        label: 'Combat',
        encounterDefinitionKeys: ['GeneratedF', 'DevotionTestF'],
        resolution: {
          kind: 'rewardContext',
          defaultEncounterDefinitionKey: 'GeneratedF',
          encounterDefinitionKeyByRewardType: { Devotion: 'DevotionTestF' },
        },
      },
      { key: 'ArtemisCombatF', encounterDefinitionKeys: ['ArtemisCombatF'] },
      { key: 'ArachneCombatF', encounterDefinitionKeys: ['ArachneCombatF'] },
      { key: 'NemesisCombatF', encounterDefinitionKeys: ['NemesisCombatF'] },
      { key: 'NemesisRandomEvent', encounterDefinitionKeys: ['NemesisRandomEvent'] },
    ],
  },
] as const satisfies readonly RawEncounterSetDeclaration[];
