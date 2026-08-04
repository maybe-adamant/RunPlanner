import type { RawEncounterDefinitionDeclaration, RawEncounterSetDeclaration } from '../types';

export const fEncounterDefinitions = [
  {
    key: 'OpeningGeneratedF',
    label: 'Opening combat',
    kind: 'combat',
    countsEncounterDepth: true,
  },
  { key: 'GeneratedF', label: 'Combat', kind: 'combat', countsEncounterDepth: true },
  {
    key: 'Story_Arachne_01',
    label: 'Arachne story',
    kind: 'story',
    countsEncounterDepth: false,
  },
  {
    key: 'MiniBossTreant',
    label: 'Treant',
    kind: 'miniboss',
    countsEncounterDepth: true,
  },
  {
    key: 'MiniBossFogEmitter',
    label: 'Fog emitter',
    kind: 'miniboss',
    countsEncounterDepth: true,
  },
  {
    key: 'MiniBossAssassin',
    label: 'Assassin',
    kind: 'miniboss',
    countsEncounterDepth: true,
  },
  { key: 'BossHecate01', label: 'Hecate', kind: 'boss', countsEncounterDepth: false },
  {
    key: 'Story_Chronos_01',
    label: 'Chronos story',
    kind: 'story',
    countsEncounterDepth: false,
  },
] as const satisfies readonly RawEncounterDefinitionDeclaration[];

export const fEncounterSets = [
  {
    key: 'FEncountersDefault',
    encounterDefinitionKeys: ['GeneratedF'],
    defaultEncounterDefinitionKey: 'GeneratedF',
  },
] as const satisfies readonly RawEncounterSetDeclaration[];
