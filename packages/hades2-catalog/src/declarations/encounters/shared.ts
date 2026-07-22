import type { RawEncounterProfileDeclaration } from '../types';

export const sharedEncounterProfiles = [
  {
    key: 'SingleCountedCombat',
    phases: [{ key: 'Combat', kind: 'combat', countsEncounterDepth: true }],
  },
  {
    key: 'NoEncounter',
    phases: [],
  },
  {
    key: 'HealthRestore',
    phases: [
      {
        key: 'HealthRestore',
        kind: 'nonCombat',
        countsEncounterDepth: false,
        baselineEncounterKey: 'HealthRestore',
      },
    ],
  },
  {
    key: 'Shop',
    phases: [
      {
        key: 'Shop',
        kind: 'nonCombat',
        countsEncounterDepth: false,
        baselineEncounterKey: 'Shop',
      },
    ],
  },
] as const satisfies readonly RawEncounterProfileDeclaration[];
