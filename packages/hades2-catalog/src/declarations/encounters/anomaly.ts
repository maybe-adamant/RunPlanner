import { infiniteRosterEnemyPools } from './generated/enemies';
import type { RawEncounterDefinitionDeclaration } from './types';

export const anomalyEncounterDefinitions = [
  {
    key: 'GeneratedAnomalyB',
    // EncounterData_Challenge.lua GeneratedAnomalyBase: one InfiniteSpawns wave,
    // MinTypes 2, MaxTypes/MaxTypesCap 3, TypeCountDepthRamp 0, MaxEliteTypes 1.
    customization: [
      {
        key: 'infiniteRoster',
        label: 'Enemy roster',
        selection: {
          kind: 'infiniteRoster',
          choices: infiniteRosterEnemyPools.b,
          types: { min: 2, max: 3 },
          maxEliteTypes: 1,
        },
      },
    ],
    label: 'Anomaly combat',
    kind: 'combat',
    countsEncounterDepth: true,
    blocksGorgon: true,
  },
] as const satisfies readonly RawEncounterDefinitionDeclaration[];
