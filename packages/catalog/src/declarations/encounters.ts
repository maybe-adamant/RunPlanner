import type { RawEncounterProfileDeclaration } from './types';

export const encounterProfiles = [
  {
    key: 'F_Opening',
    phases: [
      {
        key: 'OpeningGeneratedF',
        kind: 'combat',
        countsEncounterDepth: true,
        baselineEncounterKey: 'OpeningGeneratedF',
      },
    ],
  },
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
  {
    key: 'F_MiniBoss01',
    phases: [
      {
        key: 'F_MiniBoss01',
        kind: 'miniboss',
        countsEncounterDepth: true,
        baselineEncounterKey: 'MiniBossTreant',
      },
    ],
  },
  {
    key: 'F_MiniBoss02',
    phases: [
      {
        key: 'F_MiniBoss02',
        kind: 'miniboss',
        countsEncounterDepth: true,
        baselineEncounterKey: 'MiniBossFogEmitter',
      },
    ],
  },
  {
    key: 'F_MiniBoss03',
    phases: [
      {
        key: 'F_MiniBoss03',
        kind: 'miniboss',
        countsEncounterDepth: true,
        baselineEncounterKey: 'MiniBossAssassin',
      },
    ],
  },
  {
    key: 'G_MiniBoss01',
    phases: [
      {
        key: 'G_MiniBoss01',
        kind: 'miniboss',
        countsEncounterDepth: true,
        baselineEncounterKey: 'MiniBossWaterUnit',
      },
    ],
  },
  {
    key: 'G_MiniBoss02',
    phases: [
      {
        key: 'G_MiniBoss02',
        kind: 'miniboss',
        countsEncounterDepth: false,
        baselineEncounterKey: 'MiniBossCrawler',
      },
    ],
  },
  {
    key: 'G_MiniBoss03',
    phases: [
      {
        key: 'G_MiniBoss03',
        kind: 'miniboss',
        countsEncounterDepth: true,
        baselineEncounterKey: 'MiniBossJellyfish',
      },
    ],
  },
] as const satisfies readonly RawEncounterProfileDeclaration[];
