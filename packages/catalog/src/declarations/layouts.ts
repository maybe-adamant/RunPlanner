import type { RawLinearBiomeLayoutDeclaration } from './types';

export const biomeLayouts = [
  {
    biomeStepKey: 'Underworld_F',
    kind: 'LinearBiome',
    start: {
      mode: 'oneOf',
      roomGameNames: ['F_Opening01', 'F_Opening02', 'F_Opening03'],
    },
    continuation: { defaultBatchRuleKey: 'Standard' },
    terminal: {
      roomGameName: 'F_PreBoss01',
      transitionRuleKey: 'PrebossEntry',
      exitPolicy: { kind: 'allExitsTerminal' },
    },
    bounds: { maxBatches: 10, maxTargets: 20 },
  },
  {
    biomeStepKey: 'Underworld_G',
    kind: 'LinearBiome',
    start: {
      mode: 'fixed',
      roomGameNames: ['G_Intro'],
    },
    continuation: { defaultBatchRuleKey: 'Standard' },
    terminal: {
      roomGameName: 'G_PreBoss01',
      transitionRuleKey: 'PrebossEntry',
      exitPolicy: { kind: 'allExitsTerminal' },
    },
    bounds: { maxBatches: 8, maxTargets: 21 },
  },
] as const satisfies readonly RawLinearBiomeLayoutDeclaration[];
