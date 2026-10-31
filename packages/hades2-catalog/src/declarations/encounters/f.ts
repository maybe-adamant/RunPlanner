import {
  assassinRoster,
  fogEmitterRoster,
  treantRoster,
  treantShrineRoster,
  hecateRivalsRoster,
  hecateRoster,
} from './boss-rosters';
import { generatedEncounterChoices } from './generated/policies';
import { notFreshFileRoute } from '../routes';
import type { RawEncounterDefinitionDeclaration, RawEncounterSetDeclaration } from './types';
import {
  arachneCombatCocoonCount,
  arachneCombatCocoonRewardPoint,
  arachneIncomingRewardExclusions,
  artemisEncounterKeys,
  introductionGate,
  artemisIncomingRewardExclusions,
  nemesisEncounterKeys,
  nemesisIncomingRewardExclusions,
  spawn,
  supportedFieldNpcEncounterKeys,
} from './shared';
import {
  devotionMoneyStore,
  generatedMoneyStore,
  nemesisEventMoneyStore,
  godCombatMoneyStore,
  minibossMoneyStore,
} from './money-stores';

export const fEncounterDefinitions = [
  {
    key: 'OpeningGeneratedF',
    moneyStore: generatedMoneyStore,
    customization: [generatedEncounterChoices.OpeningGeneratedF],
    label: 'Opening combat',
    kind: 'combat',
    countsEncounterDepth: true,
    blocksGorgon: true,
  },
  {
    key: 'GeneratedF',
    moneyStore: generatedMoneyStore,
    customization: [generatedEncounterChoices.GeneratedF],
    label: 'Combat',
    kind: 'combat',
    countsEncounterDepth: true,
    hostsGorgon: true,
    canEncounterSkip: true,
  },
  {
    // EncounterData.lua:515 FIntroFight. It inherits no base, so it does not
    // count encounter depth and cannot be skipped.
    key: 'FIntroFight',
    label: 'Intro combat',
    kind: 'combat',
    countsEncounterDepth: false,
    hostsGorgon: true,
    fixedRoster: [
      [spawn('Brawler', 1)],
      [spawn('Guard', 4)],
      [spawn('Mage', 3)],
      [spawn('Brawler', 1), spawn('Guard', 3), spawn('Mage', 1)],
    ],
  },
  {
    // Radiator and its elite introduce through RadiatorIntro (EnemyData_Radiator.lua:6):
    // a fixed wave of five Radiators, then a generated wave seeded with Radiator.
    key: 'RadiatorIntro',
    moneyStore: generatedMoneyStore,
    customization: [generatedEncounterChoices.RadiatorIntro],
    label: 'Spindle introduction',
    kind: 'combat',
    countsEncounterDepth: true,
    hostsGorgon: true,
    canEncounterSkip: true,
    enemyTriggeredIntroduction: true,
    requirements: introductionGate('RadiatorIntro', []),
  },
  {
    // EnemyData_Screamer.lua:7; two fixed Screamers, then a Screamer-seeded wave.
    key: 'ScreamerIntro',
    moneyStore: generatedMoneyStore,
    customization: [generatedEncounterChoices.ScreamerIntro],
    label: 'Wailer introduction',
    kind: 'combat',
    countsEncounterDepth: true,
    hostsGorgon: true,
    canEncounterSkip: true,
    enemyTriggeredIntroduction: true,
    requirements: introductionGate('ScreamerIntro', []),
  },
  {
    key: 'DevotionTestF',
    moneyStore: devotionMoneyStore,
    customization: [generatedEncounterChoices.DevotionTestF],
    label: 'Devotion combat',
    kind: 'combat',
    countsEncounterDepth: true,
    blocksGorgon: true,
  },
  {
    key: 'ArtemisCombatF',
    moneyStore: godCombatMoneyStore,
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
        notFreshFileRoute,
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
    customization: [arachneCombatCocoonCount, arachneCombatCocoonRewardPoint],
    label: 'Arachne cocoon',
    kind: 'combat',
    countsEncounterDepth: false,
    blocksGorgon: true,
    npcPresentationKey: 'Arachne',
    requirements: {
      kind: 'all',
      requirements: [
        notFreshFileRoute,
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
      ],
    },
  },
  {
    key: 'NemesisCombatF',
    moneyStore: godCombatMoneyStore,
    // BaseNemesisCombat: NemesisChallenge objective, HandleNemesisEncounterReward MaxBetAmount 100
    // (EncounterData_Nemesis.lua:3-53, InteractLogic.lua:545-590).
    goldBet: { maxBet: 100 },
    customization: [generatedEncounterChoices.NemesisCombatF],
    label: 'Nemesis combat',
    kind: 'combat',
    countsEncounterDepth: true,
    blocksGorgon: true,
    npcPresentationKey: 'Nemesis',
    npcShoppingProtection: { family: 'Nemesis', roomWindow: 12 },
    requirements: {
      kind: 'all',
      requirements: [
        notFreshFileRoute,
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
    // Fields cage kills drain it when the event is the room's Passive encounter.
    moneyStore: nemesisEventMoneyStore,
    kind: 'nonCombat',
    countsEncounterDepth: false,
    blocksGorgon: true,
    npcPresentationKey: 'Nemesis',
    npcShoppingProtection: { family: 'Nemesis', roomWindow: 12 },
    requiresInteraction: true,
    suppressesIncomingReward: true,
    nemesisRandomEvent: {
      freeItem: {
        resultRewardTypes: ['EmptyMaxHealthDrop', 'HealDrop', 'LastStandDrop', 'ArmorBoost'],
        conditionalResultRewardType: 'LastStandDrop',
        response: 'none',
        pickupRequired: false,
      },
      // NPCData.lua:5560-5650 GetOptions CostResourceMin/Max, drawn by RandomInt (TradeLogic.lua:21).
      goldTrade: {
        variants: [
          {
            rewardType: 'MaxHealthDrop',
            enteredBiome: { max: 2 },
            requirement: 'none',
            goldCost: { min: 105, max: 130 },
          },
          {
            rewardType: 'MaxHealthDropBig',
            enteredBiome: { min: 3 },
            requirement: 'none',
            goldCost: { min: 230, max: 255 },
          },
          {
            rewardType: 'MaxManaDrop',
            enteredBiome: { max: 2 },
            requirement: 'none',
            goldCost: { min: 80, max: 105 },
          },
          {
            rewardType: 'MaxManaDropBig',
            enteredBiome: { min: 3 },
            requirement: 'none',
            goldCost: { min: 180, max: 205 },
          },
          {
            rewardType: 'StackUpgrade',
            enteredBiome: { max: 1 },
            requirement: 'pomLegal',
            goldCost: { min: 80, max: 105 },
          },
          {
            rewardType: 'StackUpgradeBig',
            enteredBiome: { min: 2 },
            requirement: 'pomLegal',
            goldCost: { min: 280, max: 305 },
          },
          {
            rewardType: 'WeaponUpgrade',
            enteredBiome: {},
            requirement: 'hammerEarlyOrLate',
            goldCost: { min: 180, max: 205 },
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
        requiredResultRewardTypes: ['StackUpgrade'],
      },
      hOptionalCapacityReservation: 1,
    },
    requirements: {
      kind: 'all',
      requirements: [
        notFreshFileRoute,
        { kind: 'not', requirement: { kind: 'routeKeyEquals', routeKey: 'Dream' } },
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
  // Native F postboss carrier; inherits Empty and adds progression conversations.
  {
    key: 'Story_Chronos_01',
    label: 'Chronos story',
    kind: 'nonCombat',
    countsEncounterDepth: false,
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
    bossRoster: treantRoster,
    moneyStore: minibossMoneyStore,
    label: 'Treant',
    kind: 'miniboss',
    countsEncounterDepth: true,
    blocksGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'MiniBossFogEmitter',
    bossRoster: fogEmitterRoster,
    moneyStore: minibossMoneyStore,
    label: 'Fog emitter',
    kind: 'miniboss',
    countsEncounterDepth: true,
    blocksGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'MiniBossAssassin',
    bossRoster: assassinRoster,
    moneyStore: minibossMoneyStore,
    label: 'Assassin',
    kind: 'miniboss',
    countsEncounterDepth: true,
    blocksGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'MiniBossTreant_Shrine',
    bossRoster: treantShrineRoster,
    moneyStore: minibossMoneyStore,
    label: 'Treant',
    kind: 'miniboss',
    countsEncounterDepth: true,
    blocksGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'MiniBossFogEmitter_Shrine',
    moneyStore: minibossMoneyStore,
    label: 'Fog emitter',
    kind: 'miniboss',
    countsEncounterDepth: true,
    blocksGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'BossHecate01',
    bossRoster: hecateRoster,
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
          // Every alternative to the meteor shower needs an earlier completed Hecate fight.
          choices: [
            { key: 'largeMeteors', label: 'Large meteors', nativeId: 'HecateMeteorShower' },
            {
              key: 'smallMeteors',
              label: 'Small meteors',
              nativeId: 'HecateMeteorSmallShower',
              excludedRouteKeys: ['FreshFile'],
            },
            {
              key: 'rings',
              label: 'Expanding Ring',
              nativeId: 'HecateRangedTorchesRingPhase',
              excludedRouteKeys: ['FreshFile'],
            },
            {
              key: 'spirals',
              label: 'Torch Orbs',
              nativeId: 'HecateRangedTorchesSpiralsPhase',
              excludedRouteKeys: ['FreshFile'],
            },
            {
              key: 'laser',
              label: 'Lunar Ray',
              nativeId: 'HecateLaser',
              excludedRouteKeys: ['FreshFile'],
            },
            {
              key: 'cones',
              label: 'Arc Projectiles',
              nativeId: 'HecateRangedTorchesConePhase',
              excludedRouteKeys: ['FreshFile'],
            },
          ],
        },
      },
    ],
  },
  {
    key: 'BossHecate02',
    bossRoster: hecateRivalsRoster,
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
      'RadiatorIntro',
      'ScreamerIntro',
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
      {
        key: 'RadiatorIntro',
        encounterDefinitionKeys: ['RadiatorIntro'],
        routeKeys: ['FreshFile'],
      },
      {
        key: 'ScreamerIntro',
        encounterDefinitionKeys: ['ScreamerIntro'],
        routeKeys: ['FreshFile'],
      },
      { key: 'ArtemisCombatF', encounterDefinitionKeys: ['ArtemisCombatF'] },
      { key: 'ArachneCombatF', encounterDefinitionKeys: ['ArachneCombatF'] },
      { key: 'NemesisCombatF', encounterDefinitionKeys: ['NemesisCombatF'] },
      { key: 'NemesisRandomEvent', encounterDefinitionKeys: ['NemesisRandomEvent'] },
    ],
  },
] as const satisfies readonly RawEncounterSetDeclaration[];
