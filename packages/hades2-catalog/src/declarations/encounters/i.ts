import type { RawEncounterDefinitionDeclaration, RawEncounterSetDeclaration } from '../types';

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
    requirements: excludesClockworkGoal,
  },
  {
    key: 'GeneratedI_GoalReward',
    label: 'Goal combat',
    kind: 'combat',
    countsEncounterDepth: true,
    requirements: { kind: 'not', requirement: excludesClockworkGoal },
  },
  {
    key: 'GeneratedI_Small',
    label: 'Small combat',
    kind: 'combat',
    countsEncounterDepth: true,
    requirements: excludesClockworkGoal,
  },
  {
    key: 'GeneratedI_Small_GoalReward',
    label: 'Small goal combat',
    kind: 'combat',
    countsEncounterDepth: true,
    requirements: { kind: 'not', requirement: excludesClockworkGoal },
  },
  {
    key: 'Story_Hades_01',
    label: 'Hades story',
    kind: 'story',
    countsEncounterDepth: false,
  },
  {
    key: 'MiniBossRatCatcher',
    label: 'Rat catcher',
    kind: 'miniboss',
    countsEncounterDepth: true,
  },
  {
    key: 'MiniBossGoldElemental',
    label: 'Gold elemental',
    kind: 'miniboss',
    countsEncounterDepth: true,
  },
  { key: 'BossChronos01', label: 'Chronos', kind: 'boss', countsEncounterDepth: false },
] as const satisfies readonly RawEncounterDefinitionDeclaration[];

export const iEncounterSets = [
  {
    key: 'IEncountersDefault',
    encounterDefinitionKeys: ['GeneratedI', 'GeneratedI_GoalReward'],
    defaultEncounterDefinitionKey: 'GeneratedI',
  },
  {
    key: 'IEncountersSmaller',
    encounterDefinitionKeys: ['GeneratedI_Small', 'GeneratedI_Small_GoalReward'],
    defaultEncounterDefinitionKey: 'GeneratedI_Small',
  },
] as const satisfies readonly RawEncounterSetDeclaration[];
