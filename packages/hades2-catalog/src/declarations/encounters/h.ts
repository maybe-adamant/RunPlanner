import type { RawEncounterProfileDeclaration } from '../types';

export const hEncounterProfiles = [
  {
    key: 'H_FieldsCombatCage2',
    phases: [
      { key: 'Passive', kind: 'combat', countsEncounterDepth: false },
      {
        key: 'Cage01',
        kind: 'combat',
        countsEncounterDepth: true,
        baselineEncounterKey: 'GeneratedH',
      },
      {
        key: 'Cage02',
        kind: 'combat',
        countsEncounterDepth: true,
        baselineEncounterKey: 'GeneratedH',
      },
    ],
  },
  {
    key: 'H_FieldsCombatCage3',
    phases: [
      { key: 'Passive', kind: 'combat', countsEncounterDepth: false },
      {
        key: 'Cage01',
        kind: 'combat',
        countsEncounterDepth: true,
        baselineEncounterKey: 'GeneratedH',
      },
      {
        key: 'Cage02',
        kind: 'combat',
        countsEncounterDepth: true,
        baselineEncounterKey: 'GeneratedH',
      },
      {
        key: 'Cage03',
        kind: 'combat',
        countsEncounterDepth: true,
        baselineEncounterKey: 'GeneratedH',
      },
    ],
  },
  {
    key: 'H_MiniBoss01',
    phases: [
      {
        key: 'H_MiniBoss01',
        kind: 'miniboss',
        countsEncounterDepth: true,
        baselineEncounterKey: 'MiniBossVampire',
      },
    ],
  },
  {
    key: 'H_MiniBoss02',
    phases: [
      {
        key: 'H_MiniBoss02',
        kind: 'miniboss',
        countsEncounterDepth: true,
        baselineEncounterKey: 'MiniBossLamia',
      },
    ],
  },
  {
    key: 'H_Bridge01',
    phases: [
      {
        key: 'H_Bridge01',
        kind: 'story',
        countsEncounterDepth: false,
        baselineEncounterKey: 'Story_Echo_01',
      },
    ],
  },
  {
    key: 'H_Boss01',
    phases: [
      {
        key: 'H_Boss01',
        kind: 'boss',
        countsEncounterDepth: false,
        baselineEncounterKey: 'BossInfestedCerberus01',
      },
    ],
  },
  {
    key: 'H_PostBoss01',
    phases: [
      {
        key: 'H_PostBoss01',
        kind: 'nonCombat',
        countsEncounterDepth: false,
        baselineEncounterKey: 'Empty',
      },
    ],
  },
] as const satisfies readonly RawEncounterProfileDeclaration[];
