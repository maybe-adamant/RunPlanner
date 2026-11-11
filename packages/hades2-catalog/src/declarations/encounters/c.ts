import type { RawEncounterDefinitionDeclaration } from './types';

export const cEncounterDefinitions = [
  {
    key: 'BossZagreus01',
    // DelayedStart, EncounterData_Boss.lua:1577.
    script: { delayedStart: true },
    label: 'Zagreus',
    kind: 'boss',
    countsEncounterDepth: false,
    blocksGorgon: true,
  },
] as const satisfies readonly RawEncounterDefinitionDeclaration[];
