import type { RawEncounterDefinitionDeclaration, RawEncounterSetDeclaration } from '../types';
import {
  nemesisEncounterKeys,
  nemesisIncomingRewardExclusions,
  supportedFieldNpcEncounterKeys,
} from './shared';

const excludesClockworkGoal = {
  kind: 'currentRoomRewardExcludes',
  rewardTypes: ['ClockworkGoal'],
} as const;

export const iEncounterDefinitions = [
  {
    key: 'GeneratedI',
    label: 'Combat',
    kind: 'combat',
    countsEncounterDepth: true,
    hostsGorgon: true,
    canEncounterSkip: true,
    requirements: excludesClockworkGoal,
  },
  {
    key: 'GeneratedI_GoalReward',
    label: 'Goal combat',
    kind: 'combat',
    countsEncounterDepth: true,
    hostsGorgon: true,
    canEncounterSkip: true,
    requirements: { kind: 'not', requirement: excludesClockworkGoal },
  },
  {
    key: 'GeneratedI_Small',
    label: 'Small combat',
    kind: 'combat',
    countsEncounterDepth: true,
    hostsGorgon: true,
    canEncounterSkip: true,
    requirements: excludesClockworkGoal,
  },
  {
    key: 'GeneratedI_Small_GoalReward',
    label: 'Small goal combat',
    kind: 'combat',
    countsEncounterDepth: true,
    hostsGorgon: true,
    canEncounterSkip: true,
    requirements: { kind: 'not', requirement: excludesClockworkGoal },
  },
  {
    key: 'NemesisCombatI',
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
] as const satisfies readonly RawEncounterDefinitionDeclaration[];

export const iEncounterSets = [
  {
    key: 'IEncountersDefault',
    encounterDefinitionKeys: ['GeneratedI', 'GeneratedI_GoalReward', 'NemesisCombatI'],
    defaultEncounterDefinitionKey: 'GeneratedI',
  },
  {
    key: 'IEncountersSmaller',
    encounterDefinitionKeys: ['GeneratedI_Small', 'GeneratedI_Small_GoalReward', 'NemesisCombatI'],
    defaultEncounterDefinitionKey: 'GeneratedI_Small',
  },
] as const satisfies readonly RawEncounterSetDeclaration[];
