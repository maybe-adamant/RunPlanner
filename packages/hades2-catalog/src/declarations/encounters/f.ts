import type { RawEncounterProfileDeclaration } from '../types';

export const fOpeningEncounterProfiles = [
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
] as const satisfies readonly RawEncounterProfileDeclaration[];

export const fMinibossEncounterProfiles = [
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
] as const satisfies readonly RawEncounterProfileDeclaration[];

export const fCompletionEncounterProfiles = [
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
] as const satisfies readonly RawEncounterProfileDeclaration[];
