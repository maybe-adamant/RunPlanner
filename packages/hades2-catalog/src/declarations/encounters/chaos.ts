import type { RawEncounterDefinitionDeclaration } from '../types';

export const chaosEncounterDefinitions = [
  {
    key: 'Empty_Chaos',
    label: 'Chaos',
    kind: 'nonCombat',
    countsEncounterDepth: false,
  },
] as const satisfies readonly RawEncounterDefinitionDeclaration[];
