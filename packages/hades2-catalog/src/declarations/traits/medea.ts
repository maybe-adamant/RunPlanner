import type { RawTraitDeclaration, RawTraitGiverDeclaration } from './types';

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
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    key: 'MoneyOnDeathCurse',
    label: 'Wealth from the Dead',
    ...raritylessNpcTrait,
    // TraitData_Medea.lua:98-155 DropOnKill Chance 0.1, DropCap 2, DropMoney BaseValue 20 x the
    // RarityLevels multiplier 1 / 1.5 / 2 / 3; the cap is per room (CombatLogic.lua:4225-4285).
    gold: {
      kind: 'goldOnKill',
      chance: 0.1,
      dropCap: 2,
      goldByAcquisitionOrdinal: [20, 30, 40, 60],
    },
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    key: 'ManaOverTimeCurse',
    label: 'Traces of Spirit',
    ...raritylessNpcTrait,
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
    // MaxMana 5 x rarity 1, 7/5, 10/5, 20/5; Dream menus use the entered-biome rarity.
    roomsPerUpgradeGrowth: { interval: 1, maxManaByAcquisitionOrdinal: [5, 7, 10, 20] },
  },
  {
    key: 'SpawnDamageCurse',
    label: 'Suffering on Sight',
    ...raritylessNpcTrait,
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    key: 'ArmorPenaltyCurse',
    label: 'Corrosion on Sight',
    ...raritylessNpcTrait,
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    key: 'SlowProjectileCurse',
    label: 'Enfeeblement of Cowards',
    ...raritylessNpcTrait,
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    key: 'DeathDefianceRetaliateCurse',
    label: 'Malice in Kind',
    // NPCData.lua: requires a held Last Stand.
    offerDependsOnDeathDefiance: true,
    ...raritylessNpcTrait,
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
  {
    key: 'NewStatusDamage',
    label: 'Harm for the Afflicted',
    ...raritylessNpcTrait,
    linkedBoonRequirements: [],
    eligibilityRequirements: [],
  },
] as const satisfies readonly RawTraitDeclaration[];

export const medeaGiver = {
  key: 'Medea',
  screenReroll: false,
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
  // EventLogic.MedeaCurseChoice.
  acquisitionOrdinalMenu: true,
} as const satisfies RawTraitGiverDeclaration;
