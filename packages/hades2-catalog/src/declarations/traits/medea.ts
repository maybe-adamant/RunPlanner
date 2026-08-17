import type { RawTraitDeclaration, RawTraitGiverDeclaration } from '../traits';

const raritylessNpcTrait = {
  rarityDomain: 'none',
  elementContributions: {},
  usesBoonRarity: false,
  blockStacking: false,
  blockInRunRarify: false,
  excludeFromRarityCount: false,
} as const;

/** Medea's player-rarityless Story-room curse choices. */
export const medeaTraits = [
  {
    key: 'HealingOnDeathCurse',
    label: 'Life from the Dead',
    ...raritylessNpcTrait,
    offerRequirements: [],
  },
  {
    key: 'MoneyOnDeathCurse',
    label: 'Wealth from the Dead',
    ...raritylessNpcTrait,
    offerRequirements: [],
  },
  {
    key: 'ManaOverTimeCurse',
    label: 'Traces of Spirit',
    ...raritylessNpcTrait,
    offerRequirements: [],
  },
  {
    key: 'SpawnDamageCurse',
    label: 'Suffering on Sight',
    ...raritylessNpcTrait,
    offerRequirements: [],
  },
  {
    key: 'ArmorPenaltyCurse',
    label: 'Corrosion on Sight',
    ...raritylessNpcTrait,
    offerRequirements: [],
  },
  {
    key: 'SlowProjectileCurse',
    label: 'Enfeeblement of Cowards',
    ...raritylessNpcTrait,
    offerRequirements: [],
  },
  {
    key: 'DeathDefianceRetaliateCurse',
    label: 'Malice in Kind',
    ...raritylessNpcTrait,
    offerRequirements: [
      {
        kind: 'offerContext',
        context: 'deathDefianceConditionMet',
        required: true,
      },
    ],
  },
  {
    key: 'NewStatusDamage',
    label: 'Harm for the Afflicted',
    ...raritylessNpcTrait,
    offerRequirements: [],
  },
] as const satisfies readonly RawTraitDeclaration[];

export const medeaGiver = {
  key: 'Medea',
  label: 'Medea',
  providerKind: 'npc',
  priorityTraitKeys: [],
  traitKeys: [
    'HealingOnDeathCurse',
    'MoneyOnDeathCurse',
    'ManaOverTimeCurse',
    'SpawnDamageCurse',
    'ArmorPenaltyCurse',
    'SlowProjectileCurse',
    'DeathDefianceRetaliateCurse',
    'NewStatusDamage',
  ],
  rarityPolicy: { kind: 'none' },
} as const satisfies RawTraitGiverDeclaration;
