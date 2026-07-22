import type { RawEncounterProfileDeclaration } from '../types';

export const nEncounterProfiles = [
  {
    key: 'N_Opening',
    phases: [
      {
        key: 'OpeningGeneratedN',
        kind: 'combat',
        countsEncounterDepth: true,
        baselineEncounterKey: 'OpeningGeneratedN',
      },
    ],
  },
  {
    key: 'N_PreHub',
    phases: [
      {
        key: 'PreHubGeneratedN',
        kind: 'combat',
        countsEncounterDepth: false,
        baselineEncounterKey: 'PreHubGeneratedN',
      },
    ],
  },
  {
    key: 'EphyraCombat',
    phases: [
      {
        key: 'Combat',
        kind: 'combat',
        countsEncounterDepth: true,
        baselineEncounterKey: 'GeneratedN',
      },
    ],
  },
  {
    key: 'EphyraSideRoom',
    phases: [
      {
        key: 'Combat',
        kind: 'combat',
        countsEncounterDepth: false,
        baselineEncounterKey: 'GeneratedNSubRoom',
      },
    ],
  },
  {
    key: 'EphyraSideRoomHard',
    phases: [
      {
        key: 'Combat',
        kind: 'combat',
        countsEncounterDepth: false,
        baselineEncounterKey: 'GeneratedNSubRoomBigger',
      },
    ],
  },
  {
    key: 'N_MiniBoss01',
    phases: [
      {
        key: 'N_MiniBoss01',
        kind: 'miniboss',
        countsEncounterDepth: true,
        baselineEncounterKey: 'MiniBossSatyrCrossbow',
      },
    ],
  },
  {
    key: 'N_MiniBoss02',
    phases: [
      {
        key: 'N_MiniBoss02',
        kind: 'miniboss',
        countsEncounterDepth: true,
        baselineEncounterKey: 'MiniBossBoar',
      },
    ],
  },
  {
    key: 'N_Story01',
    phases: [
      {
        key: 'N_Story01',
        kind: 'story',
        countsEncounterDepth: false,
        baselineEncounterKey: 'Story_Medea_01',
      },
    ],
  },
  {
    key: 'N_Boss01',
    phases: [
      {
        key: 'N_Boss01',
        kind: 'boss',
        countsEncounterDepth: false,
        baselineEncounterKey: 'BossPolyphemus01',
      },
    ],
  },
  {
    key: 'N_PostBoss01',
    phases: [
      {
        key: 'N_PostBoss01',
        kind: 'nonCombat',
        countsEncounterDepth: false,
        baselineEncounterKey: 'Empty',
      },
    ],
  },
] as const satisfies readonly RawEncounterProfileDeclaration[];
