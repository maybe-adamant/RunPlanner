import type { Catalog } from '../catalog-schema';
import type { RequirementExpression } from '../requirements';

function requirementUsesDeathDefianceCondition(
  requirement: RequirementExpression | undefined,
): boolean {
  if (requirement === undefined) return false;
  switch (requirement.kind) {
    case 'all':
    case 'any':
      return requirement.requirements.some(requirementUsesDeathDefianceCondition);
    case 'not':
      return requirementUsesDeathDefianceCondition(requirement.requirement);
    case 'authoredCondition':
      return requirement.condition === 'deathDefianceConditionMet';
    default:
      return false;
  }
}

/** Engine-owned authoring query for the one source-local Shop condition. */
export function shopProfileUsesDeathDefianceCondition(
  catalog: Catalog,
  profileKey: string,
): boolean {
  const profile = catalog.rewards.shops.byKey[profileKey];
  return (
    profile?.groups.values.some((group) =>
      group.options.values.some(
        (option) =>
          requirementUsesDeathDefianceCondition(option.requirement) ||
          requirementUsesDeathDefianceCondition(option.purchaseRequirement),
      ),
    ) ?? false
  );
}
