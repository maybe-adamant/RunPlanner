import type { RawEncounterDefinitionDeclaration, RawEncounterSetDeclaration } from '../types';

export const qEncounterDefinitions = [
  { key: 'GeneratedQ', label: 'Combat', kind: 'combat', countsEncounterDepth: true },
  {
    key: 'GeneratedQ_Islands',
    label: 'Islands combat',
    kind: 'combat',
    countsEncounterDepth: true,
  },
  {
    key: 'GeneratedQ_Large',
    label: 'Preboss combat',
    kind: 'combat',
    countsEncounterDepth: true,
  },
  { key: 'MiniBossBrute', label: 'Brute', kind: 'miniboss', countsEncounterDepth: true },
  {
    key: 'MiniBossStalker',
    label: 'Stalker',
    kind: 'miniboss',
    countsEncounterDepth: true,
  },
  {
    key: 'BossTyphonTail01',
    label: 'Typhon tail',
    kind: 'miniboss',
    countsEncounterDepth: true,
  },
  {
    key: 'BossTyphonEye01',
    label: 'Typhon eye',
    kind: 'miniboss',
    countsEncounterDepth: false,
  },
  {
    key: 'BossTyphonHead01',
    label: 'Typhon',
    kind: 'boss',
    countsEncounterDepth: false,
  },
] as const satisfies readonly RawEncounterDefinitionDeclaration[];

export const qEncounterSets = [] as const satisfies readonly RawEncounterSetDeclaration[];
