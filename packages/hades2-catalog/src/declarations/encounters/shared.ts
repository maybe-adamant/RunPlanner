import type { RawEncounterProfileDeclaration } from '../types';

export const sharedEncounterProfiles = [
  {
    key: 'StandardCombat',
    phases: [{ key: 'Combat', kind: 'combat', countsEncounterDepth: true }],
  },
  {
    key: 'FixedIntro',
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
  {
    key: 'Preboss',
    phases: [{ key: 'Preboss', kind: 'nonCombat', countsEncounterDepth: false }],
  },
] as const satisfies readonly RawEncounterProfileDeclaration[];
