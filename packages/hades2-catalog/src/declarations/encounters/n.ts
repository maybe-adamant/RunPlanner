import type { RawEncounterDefinitionDeclaration, RawEncounterSetDeclaration } from '../types';
import {
  artemisEncounterKeys,
  artemisIncomingRewardExclusions,
  heraclesEncounterKeys,
  heraclesIncomingRewardExclusions,
  supportedFieldNpcEncounterKeys,
} from './shared';

export const nEncounterDefinitions = [
  {
    key: 'OpeningGeneratedN',
    label: 'Opening combat',
    kind: 'combat',
    countsEncounterDepth: true,
  },
  {
    key: 'PreHubGeneratedN',
    label: 'Pre-Hub combat',
    kind: 'combat',
    countsEncounterDepth: false,
  },
  { key: 'GeneratedN', label: 'Combat', kind: 'combat', countsEncounterDepth: true },
  {
    key: 'ArtemisCombatN',
    label: 'Artemis combat',
    kind: 'combat',
    countsEncounterDepth: true,
    npcPresentationKey: 'Artemis',
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
    key: 'HeraclesCombatN',
    label: 'Heracles combat',
    kind: 'combat',
    countsEncounterDepth: true,
    npcPresentationKey: 'Heracles',
    requirements: {
      kind: 'all',
      requirements: [
        {
          kind: 'currentRoomRewardExcludes',
          rewardTypes: heraclesIncomingRewardExclusions,
        },
        {
          kind: 'encounterKeyCount',
          scope: 'route',
          encounterKeys: heraclesEncounterKeys,
          range: { max: 0 },
        },
        {
          kind: 'previousRoomEncounterKeyCount',
          encounterKeys: heraclesEncounterKeys,
          roomWindow: 20,
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
    key: 'GeneratedN_Smaller',
    label: 'Small combat',
    kind: 'combat',
    countsEncounterDepth: true,
  },
  {
    key: 'GeneratedN_Bigger',
    label: 'Large combat',
    kind: 'combat',
    countsEncounterDepth: true,
  },
  {
    key: 'GeneratedNSubRoom',
    label: 'Side-room combat',
    kind: 'combat',
    countsEncounterDepth: false,
  },
  {
    key: 'GeneratedNSubRoom_Bigger',
    label: 'Large side-room combat',
    kind: 'combat',
    countsEncounterDepth: false,
  },
  {
    key: 'MiniBossSatyrCrossbow',
    label: 'Satyr crossbow',
    kind: 'miniboss',
    countsEncounterDepth: true,
  },
  { key: 'MiniBossBoar', label: 'Boar', kind: 'miniboss', countsEncounterDepth: true },
  {
    key: 'Story_Medea_01',
    label: 'Medea story',
    kind: 'story',
    countsEncounterDepth: false,
  },
  {
    key: 'BossPolyphemus01',
    label: 'Polyphemus',
    kind: 'boss',
    countsEncounterDepth: false,
  },
] as const satisfies readonly RawEncounterDefinitionDeclaration[];

export const nEncounterSets = [
  {
    key: 'NEncountersDefault',
    encounterDefinitionKeys: ['GeneratedN', 'ArtemisCombatN', 'HeraclesCombatN'],
    defaultEncounterDefinitionKey: 'GeneratedN',
  },
  {
    key: 'NEncountersSmaller',
    encounterDefinitionKeys: ['GeneratedN_Smaller', 'ArtemisCombatN', 'HeraclesCombatN'],
    defaultEncounterDefinitionKey: 'GeneratedN_Smaller',
  },
  {
    key: 'NEncountersBigger',
    encounterDefinitionKeys: ['GeneratedN_Bigger', 'ArtemisCombatN', 'HeraclesCombatN'],
    defaultEncounterDefinitionKey: 'GeneratedN_Bigger',
  },
  {
    key: 'NEncountersSubRoom',
    encounterDefinitionKeys: ['GeneratedNSubRoom', 'GeneratedNSubRoom_Bigger'],
    defaultEncounterDefinitionKey: 'GeneratedNSubRoom',
  },
  {
    key: 'NEncountersSubRoomLight',
    encounterDefinitionKeys: ['GeneratedNSubRoom', 'Empty'],
    defaultEncounterDefinitionKey: 'GeneratedNSubRoom',
  },
] as const satisfies readonly RawEncounterSetDeclaration[];
