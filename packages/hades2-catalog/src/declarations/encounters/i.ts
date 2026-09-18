import { generatedEncounterChoices } from './generated/policies';
import type { RawEncounterDefinitionDeclaration, RawEncounterSetDeclaration } from './types';
import {
  nemesisEncounterKeys,
  nemesisIncomingRewardExclusions,
  supportedFieldNpcEncounterKeys,
} from './shared';

export const iEncounterDefinitions = [
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
  },
  {
    key: 'BossChronos02',
    label: 'Chronos',
    kind: 'boss',
    countsEncounterDepth: false,
    blocksGorgon: true,
  },
] as const satisfies readonly RawEncounterDefinitionDeclaration[];

export const iEncounterSets = [
  {
    key: 'IEncountersDefault',
    encounterDefinitionKeys: [
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
        encounterDefinitionKeys: ['GeneratedI', 'GeneratedI_GoalReward', 'DevotionTestI'],
        resolution: {
          kind: 'rewardContext',
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
          'GeneratedI_Small',
          'GeneratedI_Small_GoalReward',
          'DevotionTestI',
        ],
        label: 'Combat',
        resolution: {
          kind: 'rewardContext',
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
