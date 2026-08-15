import type { RawTraitDeclaration } from '../traits';

export const infernalContractTraits = [
  {
    key: 'InfernalContractBoon',
    label: 'Infernal Contract',
    rarityDomain: 'none',
    offerRequirements: [],
    elementContributions: {},
    usesBoonRarity: false,
    blockStacking: true,
    blockInRunRarify: true,
    excludeFromRarityCount: true,
  },
] as const satisfies readonly RawTraitDeclaration[];
