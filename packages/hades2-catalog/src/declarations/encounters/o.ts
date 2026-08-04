import type { RawEncounterDefinitionDeclaration, RawEncounterSetDeclaration } from '../types';

export const oEncounterDefinitions = [
  {
    key: 'GeneratedO_Intro01',
    label: 'Ship intro',
    kind: 'combat',
    countsEncounterDepth: false,
  },
  { key: 'GeneratedO', label: 'Ship combat', kind: 'combat', countsEncounterDepth: true },
  {
    key: 'MiniBossCharybdis',
    label: 'Charybdis',
    kind: 'miniboss',
    countsEncounterDepth: false,
  },
  {
    key: 'MiniBossCaptain',
    label: 'Captain',
    kind: 'miniboss',
    countsEncounterDepth: true,
  },
  {
    key: 'Story_Circe_01',
    label: 'Circe story',
    kind: 'story',
    countsEncounterDepth: false,
  },
  {
    key: 'DevotionTestO',
    label: 'Devotion combat',
    kind: 'combat',
    countsEncounterDepth: true,
  },
  { key: 'BossEris01', label: 'Eris', kind: 'boss', countsEncounterDepth: false },
] as const satisfies readonly RawEncounterDefinitionDeclaration[];

export const oEncounterSets = [
  {
    key: 'OEncountersIntros',
    encounterDefinitionKeys: ['GeneratedO_Intro01'],
    defaultEncounterDefinitionKey: 'GeneratedO_Intro01',
  },
  {
    key: 'OEncountersDefault',
    encounterDefinitionKeys: ['GeneratedO'],
    defaultEncounterDefinitionKey: 'GeneratedO',
  },
] as const satisfies readonly RawEncounterSetDeclaration[];
