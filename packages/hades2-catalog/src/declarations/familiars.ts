import type { RawFamiliarDeclaration } from './familiars-types';

/**
 * FamiliarData.lua: each familiar's first trait gains one stack per owned
 * FamiliarShopData stat upgrade (FamiliarShopLogic.lua GetFamiliarTraitStacks);
 * a mature save owns all three.
 */
export const familiars: readonly RawFamiliarDeclaration[] = [
  {
    key: 'FrogFamiliar',
    label: 'Frinos',
    matureStatUpgradeCount: 3,
    // HealthFamiliar: MaxHealth +10 per stack.
    maxStatPerStack: { stat: 'maxHealth', amount: 10 },
  },
  { key: 'CatFamiliar', label: 'Toula', matureStatUpgradeCount: 3 },
  { key: 'RavenFamiliar', label: 'Raki', matureStatUpgradeCount: 3 },
  {
    key: 'HoundFamiliar',
    label: 'Hecuba',
    matureStatUpgradeCount: 3,
    // DigFamiliar: MaxMana +15 per stack.
    maxStatPerStack: { stat: 'maxMana', amount: 15 },
  },
  { key: 'PolecatFamiliar', label: 'Gale', matureStatUpgradeCount: 3 },
];

/** A new mature-save route's familiar. */
export const defaultFamiliarKey = 'FrogFamiliar';
