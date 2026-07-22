import type { RawEncounterProfileDeclaration } from '../types';

export const pEncounterProfiles = [
  {
    key: 'OlympusCombat',
    phases: [{ key: 'Combat', kind: 'combat', countsEncounterDepth: true }],
  },
  {
    key: 'P_Story01',
    phases: [
      {
        key: 'P_Story01',
        kind: 'story',
        countsEncounterDepth: false,
        baselineEncounterKey: 'Story_Dionysus_01',
      },
    ],
  },
  {
    key: 'P_MiniBoss01',
    phases: [
      {
        key: 'P_MiniBoss01',
        kind: 'miniboss',
        countsEncounterDepth: false,
        baselineEncounterKey: 'MiniBossTalos',
      },
    ],
  },
  {
    key: 'P_MiniBoss02',
    phases: [
      {
        key: 'P_MiniBoss02',
        kind: 'miniboss',
        countsEncounterDepth: true,
        baselineEncounterKey: 'MiniBossDragon',
      },
    ],
  },
  {
    key: 'P_Boss01',
    phases: [
      {
        key: 'P_Boss01',
        kind: 'boss',
        countsEncounterDepth: false,
        baselineEncounterKey: 'BossPrometheus01',
      },
    ],
  },
  {
    key: 'P_PostBoss01',
    phases: [
      {
        key: 'P_PostBoss01',
        kind: 'nonCombat',
        countsEncounterDepth: false,
        baselineEncounterKey: 'Empty',
      },
    ],
  },
] as const satisfies readonly RawEncounterProfileDeclaration[];
