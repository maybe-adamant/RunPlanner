import type { RawEncounterDefinitionDeclaration, RawEncounterSetDeclaration } from '../types';

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
  { key: 'GeneratedH', label: 'Combat', kind: 'combat', countsEncounterDepth: true },
  {
    key: 'GeneratedH_Treant2',
    label: 'Treant combat',
    kind: 'combat',
    countsEncounterDepth: true,
  },
  {
    key: 'GeneratedH_Screamer2',
    label: 'Screamer combat',
    kind: 'combat',
    countsEncounterDepth: true,
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
    encounterDefinitionKeys: ['GeneratedH', 'GeneratedH_Treant2', 'GeneratedH_Screamer2'],
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
