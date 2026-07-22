import type { RawEncounterProfileDeclaration } from '../types';

export const gStoryEncounterProfiles = [
  {
    key: 'G_Story01',
    phases: [
      {
        key: 'G_Story01',
        kind: 'story',
        countsEncounterDepth: false,
        baselineEncounterKey: 'Story_Narcissus_01',
      },
    ],
  },
] as const satisfies readonly RawEncounterProfileDeclaration[];

export const gMinibossEncounterProfiles = [
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

export const gCompletionEncounterProfiles = [
  {
    key: 'G_Boss01',
    phases: [
      {
        key: 'G_Boss01',
        kind: 'boss',
        countsEncounterDepth: false,
        baselineEncounterKey: 'BossScylla01',
      },
    ],
  },
  {
    key: 'G_PostBoss01',
    phases: [
      {
        key: 'G_PostBoss01',
        kind: 'nonCombat',
        countsEncounterDepth: false,
        baselineEncounterKey: 'Empty',
      },
    ],
  },
] as const satisfies readonly RawEncounterProfileDeclaration[];
