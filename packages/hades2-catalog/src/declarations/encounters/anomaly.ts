import type { RawEncounterDefinitionDeclaration } from '../types';

export const anomalyEncounterDefinitions = [
  {
    key: 'GeneratedAnomalyB',
    label: 'Anomaly combat',
    kind: 'combat',
    countsEncounterDepth: true,
    blocksGorgon: true,
  },
] as const satisfies readonly RawEncounterDefinitionDeclaration[];
