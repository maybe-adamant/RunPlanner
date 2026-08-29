import type { ResourceFamily } from '@run-planner/engine/catalog-schema';

function resourceFamilyLabel(family: ResourceFamily): string {
  switch (family) {
    case 'Pickaxe':
      return 'Mining';
    case 'Exorcism':
      return 'Spirit';
    case 'Shovel':
      return 'Seed';
    case 'Fishing':
      return 'Fishing';
  }
}

/** Project the user-facing successful outcome from the declaration-owned rule. */
export function resourceOutcomeLabel(
  family: ResourceFamily,
  element: 'Fire' | 'Air' | 'Earth' | 'Water',
): string {
  return `Successful ${resourceFamilyLabel(family)} — ${element}`;
}
