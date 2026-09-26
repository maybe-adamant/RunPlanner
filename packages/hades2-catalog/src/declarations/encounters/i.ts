import { generatedEncounterChoices } from './generated/policies';
import type { RawEncounterDefinitionDeclaration, RawEncounterSetDeclaration } from './types';
import {
  nemesisEncounterKeys,
  nemesisIncomingRewardExclusions,
  supportedFieldNpcEncounterKeys,
} from './shared';

export const iEncounterDefinitions = [
  {
    key: 'GeneratedIChronosIntro',
    customization: [generatedEncounterChoices.GeneratedIChronosIntro],
    label: 'Combat',
    kind: 'combat',
    countsEncounterDepth: true,
    hostsGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'GeneratedI_SmallChronosIntro',
    customization: [generatedEncounterChoices.GeneratedI_SmallChronosIntro],
    label: 'Combat',
    kind: 'combat',
    countsEncounterDepth: true,
    hostsGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'GeneratedI',
    customization: [generatedEncounterChoices.GeneratedI],
    label: 'Combat',
    kind: 'combat',
    countsEncounterDepth: true,
    hostsGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'GeneratedI_GoalReward',
    customization: [generatedEncounterChoices.GeneratedI_GoalReward],
    label: 'Combat',
    kind: 'combat',
    countsEncounterDepth: true,
    hostsGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'GeneratedI_Small',
    customization: [generatedEncounterChoices.GeneratedI_Small],
    label: 'Combat',
    kind: 'combat',
    countsEncounterDepth: true,
    hostsGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'GeneratedI_Small_GoalReward',
    customization: [generatedEncounterChoices.GeneratedI_Small_GoalReward],
    label: 'Combat',
    kind: 'combat',
    countsEncounterDepth: true,
    hostsGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'DevotionTestI',
    customization: [generatedEncounterChoices.DevotionTestI],
    label: 'Devotion combat',
    kind: 'combat',
    countsEncounterDepth: true,
    blocksGorgon: true,
  },
  {
    key: 'NemesisCombatI',
    customization: [generatedEncounterChoices.NemesisCombatI],
    label: 'Nemesis combat',
    kind: 'combat',
    countsEncounterDepth: true,
    blocksGorgon: true,
    npcPresentationKey: 'Nemesis',
    npcShoppingProtection: { family: 'Nemesis', roomWindow: 12 },
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
    key: 'Story_Hades_01',
    label: 'Hades story',
    kind: 'story',
    countsEncounterDepth: false,
    npcPresentationKey: 'Hades',
    traitOfferProducer: { kind: 'traitOffer', giverKey: 'Hades' },
  },
  {
    key: 'MiniBossRatCatcher',
    label: 'Rat catcher',
    kind: 'miniboss',
    countsEncounterDepth: true,
    blocksGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'MiniBossGoldElemental',
    label: 'Gold elemental',
    kind: 'miniboss',
    countsEncounterDepth: true,
    blocksGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'BossChronos01',
    label: 'Chronos',
    kind: 'boss',
    countsEncounterDepth: false,
    blocksGorgon: true,
    customization: [
      {
        key: 'lateSummon',
        label: 'Late summon',
        selection: {
          kind: 'single',
          choices: [
            { key: 'satyrHoplites', label: 'Elite Satyr Hoplites', nativeId: 'ChronosEliteSpawn1' },
            { key: 'goldwraiths', label: 'Elite Goldwraiths', nativeId: 'ChronosEliteSpawn2' },
            {
              key: 'satyrVierophants',
              label: 'Elite Satyr Vierophants',
              nativeId: 'ChronosEliteSpawn3',
            },
          ],
        },
      },
    ],
  },
  {
    key: 'BossChronos02',
    label: 'Chronos',
    kind: 'boss',
    countsEncounterDepth: false,
    blocksGorgon: true,
    customization: [
      {
        key: 'lateSummon',
        label: 'Late summon',
        selection: {
          kind: 'single',
          choices: [
            { key: 'dreadWailer', label: 'Dread-Wailer', nativeId: 'Screamer2_SuperElite' },
            { key: 'brushStalker', label: 'Brush-Stalker', nativeId: 'Treant2_SuperElite' },
            { key: 'octofish', label: 'Octofish', nativeId: 'Octofish_SuperElite' },
            { key: 'vampire', label: 'Vampire', nativeId: 'Vampire_SuperElite' },
            { key: 'lamia', label: 'Lamia', nativeId: 'Lamia_SuperElite' },
            {
              key: 'wretchedThug',
              label: 'Wretched Thug',
              nativeId: 'ClockworkHeavyMelee_SuperElite',
            },
            {
              key: 'satyrVierophant',
              label: 'Satyr Vierophant',
              nativeId: 'SatyrRatCatcher_SuperElite',
            },
          ],
        },
      },
    ],
  },
] as const satisfies readonly RawEncounterDefinitionDeclaration[];

export const iEncounterSets = [
  {
    key: 'IEncountersDefault',
    encounterDefinitionKeys: [
      'GeneratedIChronosIntro',
      'GeneratedI',
      'GeneratedI_GoalReward',
      'DevotionTestI',
      'NemesisCombatI',
    ],
    defaultAuthoringProfileKey: 'GeneratedI',
    authoringProfiles: [
      {
        key: 'GeneratedI',
        label: 'Combat',
        encounterDefinitionKeys: [
          'GeneratedI',
          'GeneratedI_GoalReward',
          'DevotionTestI',
          'GeneratedIChronosIntro',
        ],
        resolution: {
          kind: 'rewardContext',
          firstBiomeEncounterDefinitionKey: 'GeneratedIChronosIntro',
          defaultEncounterDefinitionKey: 'GeneratedI',
          encounterDefinitionKeyByRewardType: {
            ClockworkGoal: 'GeneratedI_GoalReward',
            Devotion: 'DevotionTestI',
          },
        },
      },
      { key: 'NemesisCombatI', encounterDefinitionKeys: ['NemesisCombatI'] },
    ],
  },
  {
    key: 'IEncountersSmaller',
    encounterDefinitionKeys: [
      'GeneratedI_SmallChronosIntro',
      'GeneratedI_Small',
      'GeneratedI_Small_GoalReward',
      'DevotionTestI',
      'NemesisCombatI',
    ],
    defaultAuthoringProfileKey: 'GeneratedI_Small',
    authoringProfiles: [
      {
        key: 'GeneratedI_Small',
        encounterDefinitionKeys: [
          'GeneratedI_SmallChronosIntro',
          'GeneratedI_Small',
          'GeneratedI_Small_GoalReward',
          'DevotionTestI',
        ],
        label: 'Combat',
        resolution: {
          kind: 'rewardContext',
          firstBiomeEncounterDefinitionKey: 'GeneratedI_SmallChronosIntro',
          defaultEncounterDefinitionKey: 'GeneratedI_Small',
          encounterDefinitionKeyByRewardType: {
            ClockworkGoal: 'GeneratedI_Small_GoalReward',
            Devotion: 'DevotionTestI',
          },
        },
      },
      { key: 'NemesisCombatI', encounterDefinitionKeys: ['NemesisCombatI'] },
    ],
  },
] as const satisfies readonly RawEncounterSetDeclaration[];
