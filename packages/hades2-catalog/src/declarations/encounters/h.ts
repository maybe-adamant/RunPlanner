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
    hostsGorgon: true,
  },
  {
    key: 'GeneratedH_PassiveSmall',
    label: 'Small passive combat',
    kind: 'combat',
    countsEncounterDepth: false,
    hostsGorgon: true,
  },
  {
    key: 'GeneratedH',
    label: 'Combat',
    kind: 'combat',
    countsEncounterDepth: true,
    hostsGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'GeneratedH_Treant2',
    label: 'Treant combat',
    kind: 'combat',
    countsEncounterDepth: true,
    hostsGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'GeneratedH_Screamer2',
    label: 'Screamer combat',
    kind: 'combat',
    countsEncounterDepth: true,
    hostsGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'NemesisCombatH',
    label: 'Nemesis combat',
    kind: 'combat',
    countsEncounterDepth: true,
    blocksGorgon: true,
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
    blocksGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'MiniBossLamia',
    label: 'Lamia',
    kind: 'miniboss',
    countsEncounterDepth: true,
    blocksGorgon: true,
    canEncounterSkip: true,
  },
  {
    key: 'Story_Echo_01',
    label: 'Echo story',
    kind: 'story',
    countsEncounterDepth: false,
    npcPresentationKey: 'Echo',
    traitOfferProducer: { kind: 'traitOffer', giverKey: 'Echo' },
  },
  {
    key: 'BossInfestedCerberus01',
    label: 'Cerberus',
    kind: 'boss',
    countsEncounterDepth: false,
    blocksGorgon: true,
  },
  {
    key: 'BossInfestedCerberus02',
    label: 'Cerberus',
    kind: 'boss',
    countsEncounterDepth: false,
    blocksGorgon: true,
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
    defaultAuthoringProfileKey: 'GeneratedH',
  },
  {
    key: 'HEncountersPassive',
    encounterDefinitionKeys: ['GeneratedH_Passive', 'NemesisRandomEvent'],
    defaultAuthoringProfileKey: 'GeneratedH_Passive',
  },
  {
    key: 'HEncountersPassiveSmall',
    encounterDefinitionKeys: ['GeneratedH_PassiveSmall', 'NemesisRandomEvent'],
    defaultAuthoringProfileKey: 'GeneratedH_PassiveSmall',
  },
] as const satisfies readonly RawEncounterSetDeclaration[];
