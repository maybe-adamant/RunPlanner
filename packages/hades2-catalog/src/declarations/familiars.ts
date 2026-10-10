import type { RawFamiliarDeclaration } from './familiars-types';

/**
 * FamiliarShopData.lua gives each of a familiar's three upgraded traits three
 * levels; each owned level adds one stack (FamiliarShopLogic.lua
 * GetFamiliarTraitStacks). A mature save owns every level.
 */
export const familiars: readonly RawFamiliarDeclaration[] = [
  {
    key: 'FrogFamiliar',
    label: 'Frinos',
    matureTraitUpgradeCount: 3,
    // HealthFamiliar: MaxHealth +10 per stack.
    maxStatPerStack: { stat: 'maxHealth', amount: 10 },
  },
  { key: 'CatFamiliar', label: 'Toula', matureTraitUpgradeCount: 3 },
  { key: 'RavenFamiliar', label: 'Raki', matureTraitUpgradeCount: 3 },
  {
    key: 'HoundFamiliar',
    label: 'Hecuba',
    matureTraitUpgradeCount: 3,
    // DigFamiliar: MaxMana +15 per stack.
    maxStatPerStack: { stat: 'maxMana', amount: 15 },
  },
  { key: 'PolecatFamiliar', label: 'Gale', matureTraitUpgradeCount: 3 },
];

/** A new mature-save route's familiar. */
export const defaultFamiliarKey = 'FrogFamiliar';
