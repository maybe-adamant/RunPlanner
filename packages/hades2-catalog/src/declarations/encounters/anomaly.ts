import { infiniteRosterEnemyPools } from './generated/enemies';
import type { RawEncounterDefinitionDeclaration } from './types';
import { generatedMoneyStore } from './money-stores';

export const anomalyEncounterDefinitions = [
  {
    key: 'GeneratedAnomalyB',
    moneyStore: generatedMoneyStore,
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
    // EncounterLogic.lua:2148-2181 EndCapturePointChallengeEncounter (run by
    // EncounterSets.lua:700-708 EncounterEventsAnomaly): with no challenge
    // switch, which an Anomaly room never has (RoomDataAnomaly.lua BaseAnomaly
    // ChallengeSpawnChance 0), the success reward spawns with CanDuplicate =
    // false; an Artificer replacement inherits it (GiftLogic.lua:24-36).
    incomingRewardCannotDuplicate: true,
  },
] as const satisfies readonly RawEncounterDefinitionDeclaration[];
