import type { RawEncounterProfileDeclaration } from '../types';

export const qEncounterProfiles = [
  {
    key: 'SummitCombat',
    phases: [{ key: 'Combat', kind: 'combat', countsEncounterDepth: true }],
  },
  {
    key: 'Q_MiniBoss02',
    phases: [
      {
        key: 'Q_MiniBoss02',
        kind: 'miniboss',
        countsEncounterDepth: true,
        baselineEncounterKey: 'MiniBossBrute',
      },
    ],
  },
  {
    key: 'Q_MiniBoss05',
    phases: [
      {
        key: 'Q_MiniBoss05',
        kind: 'miniboss',
        countsEncounterDepth: true,
        baselineEncounterKey: 'MiniBossStalker',
      },
    ],
  },
  {
    key: 'Q_MiniBoss03',
    phases: [
      {
        key: 'Q_MiniBoss03',
        kind: 'miniboss',
        countsEncounterDepth: true,
        baselineEncounterKey: 'BossTyphonTail01',
      },
    ],
  },
  {
    key: 'Q_MiniBoss04',
    phases: [
      {
        key: 'Q_MiniBoss04',
        kind: 'miniboss',
        countsEncounterDepth: false,
        baselineEncounterKey: 'BossTyphonEye01',
      },
    ],
  },
  {
    key: 'Q_Boss01',
    phases: [
      {
        key: 'Q_Boss01',
        kind: 'boss',
        countsEncounterDepth: false,
        baselineEncounterKey: 'BossTyphonHead01',
      },
    ],
  },
] as const satisfies readonly RawEncounterProfileDeclaration[];
