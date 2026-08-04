import type { RawEncounterDefinitionDeclaration, RawEncounterSetDeclaration } from '../types';

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
    encounterDefinitionKeys: ['GeneratedN'],
    defaultEncounterDefinitionKey: 'GeneratedN',
  },
  {
    key: 'NEncountersSmaller',
    encounterDefinitionKeys: ['GeneratedN_Smaller'],
    defaultEncounterDefinitionKey: 'GeneratedN_Smaller',
  },
  {
    key: 'NEncountersBigger',
    encounterDefinitionKeys: ['GeneratedN_Bigger'],
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
