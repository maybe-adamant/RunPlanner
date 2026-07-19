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
  {
    key: 'F_Boss01',
    phases: [
      {
        key: 'F_Boss01',
        kind: 'boss',
        countsEncounterDepth: false,
        baselineEncounterKey: 'BossHecate01',
      },
    ],
  },
  {
    key: 'F_PostBoss01',
    phases: [
      {
        key: 'F_PostBoss01',
        kind: 'story',
        countsEncounterDepth: false,
        baselineEncounterKey: 'Story_Chronos_01',
      },
    ],
  },
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
  {
    key: 'OlympusCombat',
    phases: [{ key: 'Combat', kind: 'combat', countsEncounterDepth: true }],
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
