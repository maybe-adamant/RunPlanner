import type { SemanticAddress } from '../authored-project/addresses';
import { authoringBoundaryReadiness, resolveAuthoringBoundary } from './authoring-boundary';
import type { ProjectBiomeEvaluation, ProjectEvaluationAssembly } from './evaluation-products';
import type { CanonicalBiome, MaterializedBiomePrefix } from './materialization';
import { assertExactProjectEvaluationAssembly } from './project-evaluation-assembly';

export type AuthoringReadiness = 'editable' | 'locked';

function materialization(
  evaluation: ProjectBiomeEvaluation,
): CanonicalBiome | MaterializedBiomePrefix | undefined {
  return 'snapshot' in evaluation
    ? evaluation.snapshot
    : 'materializedPrefix' in evaluation
      ? evaluation.materializedPrefix
      : undefined;
}

/**
 * Answers one semantic edit against the exact project evaluation. The horizon
 * and owner use the same engine chronology; callers do not interpret region
 * keys or reconstruct route order.
 */
export function authoringReadinessAt(
  assembly: ProjectEvaluationAssembly,
  owner: SemanticAddress,
): AuthoringReadiness {
  assertExactProjectEvaluationAssembly(assembly);
  const horizon = assembly.evaluation.authoringHorizon;
  if (horizon.kind === 'open') return 'editable';

  if (owner.kind === 'project' || owner.kind === 'route') return 'editable';
  if (owner.kind === 'keepsakeSelection' && owner.owner === 'routeStart') return 'editable';
  if (!('biomeKey' in owner) || !('biomeKey' in horizon.blockedAfter)) return 'locked';
  if (owner.biomeKey === 'routeStart') return 'editable';

  const route = assembly.project.route;
  const horizonBiomeKey = horizon.blockedAfter.biomeKey;
  const ownerBiomeIndex = route.biomes.findIndex((biome) => biome.biomeKey === owner.biomeKey);
  const horizonBiomeIndex = route.biomes.findIndex((biome) => biome.biomeKey === horizonBiomeKey);
  if (ownerBiomeIndex !== horizonBiomeIndex) {
    return ownerBiomeIndex >= 0 && ownerBiomeIndex < horizonBiomeIndex ? 'editable' : 'locked';
  }
  if (owner.kind === 'biome' || owner.kind === 'biomeField') return 'editable';

  const evaluation = assembly.evaluation.route.biomes.find(
    (biome) => biome.biomeKey === owner.biomeKey,
  );
  const prefix = evaluation === undefined ? undefined : materialization(evaluation);
  if (prefix === undefined) return 'locked';
  return authoringBoundaryReadiness(
    prefix,
    resolveAuthoringBoundary(prefix, owner),
    horizon.blockedAfter,
    evaluation?.requiredInputLocation,
  );
}
