import type { RawEncounterDefinitionDeclaration, RawEncounterSetDeclaration } from '../types';
import {
  nemesisEncounterKeys,
  nemesisIncomingRewardExclusions,
  supportedFieldNpcEncounterKeys,
} from './shared';

export const hEncounterDefinitions = [
  {
    key: 'GeneratedH_Passive',
    label: 'Passive combat',
    kind: 'combat',
    countsEncounterDepth: false,
  },
  {
    key: 'GeneratedH_PassiveSmall',
    label: 'Small passive combat',
    kind: 'combat',
    countsEncounterDepth: false,
  },
  {
    key: 'GeneratedH',
    label: 'Combat',
    kind: 'combat',
    countsEncounterDepth: true,
    canEncounterSkip: true,
  },
  {
    key: 'GeneratedH_Treant2',
    label: 'Treant combat',
    kind: 'combat',
    countsEncounterDepth: true,
    canEncounterSkip: true,
  },
  {
    key: 'GeneratedH_Screamer2',
    label: 'Screamer combat',
    kind: 'combat',
    countsEncounterDepth: true,
    canEncounterSkip: true,
  },
  {
    key: 'NemesisCombatH',
    label: 'Nemesis combat',
    kind: 'combat',
    countsEncounterDepth: true,
    npcPresentationKey: 'Nemesis',
    requirements: {
      kind: 'all',
      requirements: [
        { kind: 'counterRange', axis: 'biomeEncounterDepth', range: { min: 1 } },
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
    key: 'MiniBossVampire',
    label: 'Vampire',
    kind: 'miniboss',
    countsEncounterDepth: true,
  },
  { key: 'MiniBossLamia', label: 'Lamia', kind: 'miniboss', countsEncounterDepth: true },
  {
    key: 'Story_Echo_01',
    label: 'Echo story',
    kind: 'story',
    countsEncounterDepth: false,
  },
  {
    key: 'BossInfestedCerberus01',
    label: 'Cerberus',
    kind: 'boss',
    countsEncounterDepth: false,
  },
] as const satisfies readonly RawEncounterDefinitionDeclaration[];

export const hEncounterSets = [
  {
    key: 'HEncountersDefault',
    encounterDefinitionKeys: [
      'GeneratedH',
      'GeneratedH_Treant2',
      'GeneratedH_Screamer2',
      'NemesisCombatH',
    ],
    defaultEncounterDefinitionKey: 'GeneratedH',
  },
  {
    key: 'HEncountersPassive',
    encounterDefinitionKeys: ['GeneratedH_Passive'],
    defaultEncounterDefinitionKey: 'GeneratedH_Passive',
  },
  {
    key: 'HEncountersPassiveSmall',
    encounterDefinitionKeys: ['GeneratedH_PassiveSmall'],
    defaultEncounterDefinitionKey: 'GeneratedH_PassiveSmall',
  },
] as const satisfies readonly RawEncounterSetDeclaration[];
