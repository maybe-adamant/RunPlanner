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
    key: 'Story',
    phases: [{ key: 'Story', kind: 'story', countsEncounterDepth: false }],
  },
  {
    key: 'HealthRestore',
    phases: [{ key: 'HealthRestore', kind: 'nonCombat', countsEncounterDepth: false }],
  },
  {
    key: 'Shop',
    phases: [{ key: 'Shop', kind: 'nonCombat', countsEncounterDepth: false }],
  },
  {
    key: 'Preboss',
    phases: [{ key: 'Preboss', kind: 'nonCombat', countsEncounterDepth: false }],
  },
] as const satisfies readonly RawEncounterProfileDeclaration[];
