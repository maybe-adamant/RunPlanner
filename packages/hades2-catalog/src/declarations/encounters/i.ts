import type { RawEncounterProfileDeclaration } from '../types';

export const iEncounterProfiles = [
  {
    key: 'ClockworkCombat',
    phases: [{ key: 'Combat', kind: 'combat', countsEncounterDepth: true }],
  },
  {
    key: 'I_Story01',
    phases: [
      {
        key: 'I_Story01',
        kind: 'story',
        countsEncounterDepth: false,
        baselineEncounterKey: 'Story_Hades_01',
      },
    ],
  },
  {
    key: 'I_MiniBoss01',
    phases: [
      {
        key: 'I_MiniBoss01',
        kind: 'miniboss',
        countsEncounterDepth: true,
        baselineEncounterKey: 'MiniBossRatCatcher',
      },
    ],
  },
  {
    key: 'I_MiniBoss02',
    phases: [
      {
        key: 'I_MiniBoss02',
        kind: 'miniboss',
        countsEncounterDepth: true,
        baselineEncounterKey: 'MiniBossGoldElemental',
      },
    ],
  },
  {
    key: 'I_Boss01',
    phases: [
      {
        key: 'I_Boss01',
        kind: 'boss',
        countsEncounterDepth: false,
        baselineEncounterKey: 'BossChronos01',
      },
    ],
  },
  {
    key: 'I_PostBoss01',
    phases: [
      {
        key: 'I_PostBoss01',
        kind: 'nonCombat',
        countsEncounterDepth: false,
        baselineEncounterKey: 'Empty',
      },
    ],
  },
] as const satisfies readonly RawEncounterProfileDeclaration[];
