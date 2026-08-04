import type { RawEncounterDefinitionDeclaration, RawEncounterSetDeclaration } from '../types';

export const gEncounterDefinitions = [
  { key: 'GeneratedG', label: 'Combat', kind: 'combat', countsEncounterDepth: true },
  {
    key: 'Story_Narcissus_01',
    label: 'Narcissus story',
    kind: 'story',
    countsEncounterDepth: false,
  },
  {
    key: 'MiniBossWaterUnit',
    label: 'Water unit',
    kind: 'miniboss',
    countsEncounterDepth: true,
  },
  {
    key: 'MiniBossCrawler',
    label: 'Crawler',
    kind: 'miniboss',
    countsEncounterDepth: false,
  },
  {
    key: 'MiniBossJellyfish',
    label: 'Jellyfish',
    kind: 'miniboss',
    countsEncounterDepth: true,
  },
  { key: 'BossScylla01', label: 'Scylla', kind: 'boss', countsEncounterDepth: false },
] as const satisfies readonly RawEncounterDefinitionDeclaration[];

export const gEncounterSets = [
  {
    key: 'GEncountersDefault',
    encounterDefinitionKeys: ['GeneratedG'],
    defaultEncounterDefinitionKey: 'GeneratedG',
  },
] as const satisfies readonly RawEncounterSetDeclaration[];
