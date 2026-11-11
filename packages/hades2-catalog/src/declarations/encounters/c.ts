import type { RawEncounterDefinitionDeclaration } from './types';

export const cEncounterDefinitions = [
  {
    key: 'BossZagreus01',
    label: 'Zagreus',
    kind: 'boss',
    // SkipBossTraits (EncounterData_Boss.lua:1563).
    skipBossTraits: true,
    countsEncounterDepth: false,
    blocksGorgon: true,
  },
] as const satisfies readonly RawEncounterDefinitionDeclaration[];
