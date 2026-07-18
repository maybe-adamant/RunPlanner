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
] as const satisfies readonly RawLinearBiomeLayoutDeclaration[];
