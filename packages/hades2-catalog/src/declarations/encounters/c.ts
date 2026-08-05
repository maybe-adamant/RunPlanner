import type { RawEncounterDefinitionDeclaration } from '../types';

export const cEncounterDefinitions = [
  {
    key: 'BossZagreus01',
    label: 'Zagreus',
    kind: 'boss',
    countsEncounterDepth: false,
  },
] as const satisfies readonly RawEncounterDefinitionDeclaration[];
