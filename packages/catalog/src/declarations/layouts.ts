import type { RawLinearBiomeLayoutDeclaration } from './types';

export const biomeLayouts = [
  {
    biomeStepKey: 'Underworld_F',
    kind: 'LinearBiome',
    start: {
      kind: 'authoredStart',
      mode: 'oneOf',
      roomGameNames: ['F_Opening01', 'F_Opening02', 'F_Opening03'],
    },
    entries: [],
    continuation: {
      progressionPolicy: { kind: 'eligibilityDriven' },
      batchPolicy: { kind: 'standard', fields: [] },
      rewardStorePolicy: {
        kind: 'authoredBaseStore',
        storeKeys: ['RunProgress', 'MetaProgress'],
        defaultStoreKey: 'RunProgress',
      },
      rewardStoreOverrides: [],
    },
    terminal: {
      kind: 'forkedTransition',
      roomGameName: 'F_PreBoss01',
      exitPolicy: { kind: 'allExitsTerminal' },
    },
    completion: {
      rooms: [
        { role: 'boss', roomGameName: 'F_Boss01' },
        { role: 'postboss', roomGameName: 'F_PostBoss01' },
      ],
      routeTransition: { kind: 'nextBiome' },
    },
    fields: [],
    bounds: { maxBatches: 10, maxTargets: 20 },
  },
  {
    biomeStepKey: 'Underworld_G',
    kind: 'LinearBiome',
    start: {
      kind: 'authoredStart',
      mode: 'fixed',
      roomGameNames: ['G_Intro'],
    },
    entries: [],
    continuation: {
      progressionPolicy: { kind: 'eligibilityDriven' },
      batchPolicy: { kind: 'standard', fields: [] },
      rewardStorePolicy: {
        kind: 'authoredBaseStore',
        storeKeys: ['RunProgress', 'MetaProgress'],
        defaultStoreKey: 'RunProgress',
      },
      rewardStoreOverrides: [],
    },
    terminal: {
      kind: 'forkedTransition',
      roomGameName: 'G_PreBoss01',
      exitPolicy: { kind: 'allExitsTerminal' },
    },
    completion: {
      rooms: [
        { role: 'boss', roomGameName: 'G_Boss01' },
        { role: 'postboss', roomGameName: 'G_PostBoss01' },
      ],
      routeTransition: { kind: 'nextBiome' },
    },
    fields: [],
    bounds: { maxBatches: 8, maxTargets: 21 },
  },
  {
    biomeStepKey: 'Surface_P',
    kind: 'LinearBiome',
    start: {
      kind: 'authoredStart',
      mode: 'fixed',
      roomGameNames: ['P_Intro'],
    },
    entries: [],
    continuation: {
      progressionPolicy: { kind: 'eligibilityDriven' },
      batchPolicy: { kind: 'standard', fields: [] },
      rewardStorePolicy: {
        kind: 'authoredBaseStore',
        storeKeys: ['RunProgress', 'MetaProgress'],
        defaultStoreKey: 'RunProgress',
      },
      rewardStoreOverrides: [],
    },
    terminal: {
      kind: 'forkedTransition',
      roomGameName: 'P_PreBoss01',
      exitPolicy: { kind: 'allExitsTerminal' },
    },
    completion: {
      rooms: [
        { role: 'boss', roomGameName: 'P_Boss01' },
        { role: 'postboss', roomGameName: 'P_PostBoss01' },
      ],
      routeTransition: { kind: 'nextBiome' },
    },
    fields: [],
    bounds: { maxBatches: 9, maxTargets: 18 },
  },
] as const satisfies readonly RawLinearBiomeLayoutDeclaration[];
