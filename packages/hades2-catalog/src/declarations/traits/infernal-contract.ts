import type { RawTraitDeclaration } from './types';

export const infernalContractTraits = [
  {
    key: 'InfernalContractBoon',
    label: 'Champion of Elysium',
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
