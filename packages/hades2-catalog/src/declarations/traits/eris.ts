import type { RawTraitDeclaration } from './types';

export const erisTraits = [
  {
    // TraitData.lua ErisCurseTrait: applied by talking to Eris, never removed.
    key: 'ErisCurseTrait',
    label: 'Blessing of Strife',
    rarityDomain: 'none',
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
    elementContributions: {},
    usesBoonRarity: false,
    blockStacking: true,
    blockInRunRarify: true,
    excludeFromRarityCount: true,
  },
] as const satisfies readonly RawTraitDeclaration[];
