import {
  semanticAddressKey,
  type HubDecisionAddress,
  type OccurrenceAddress,
} from '../../authored-project/addresses';
import {
  rerollSurfaceKey,
  rerollSurfaceOwner,
  type RerollSurface,
} from '../../authored-project/rerolls';
import type { RerollSurfaceSettlement } from '../rewards/model';
import type { ProjectEvaluationAssembly } from './evaluation-products';
import type { RollFeature } from '../../authored-project/feature-rolls';
import {
  purgingPoolCandidateForProjectEvaluationAssembly,
  stygianWellCandidateForProjectEvaluationAssembly,
} from './project-evaluation-assembly';

function rewardsOf(assembly: ProjectEvaluationAssembly, biomeKey: string) {
  const biome = assembly.evaluation.route.biomes.find(
    (candidate) => candidate.biomeKey === biomeKey,
  );
  return biome === undefined || !('rewards' in biome) ? undefined : biome.rewards;
}

/**
 * One reached reroll surface at its append point: the pool there, whether a
 * held card enabled its rerolls, and each target's assigned and settled
 * current reward with why a press of it is refused. Undefined while unreached.
 */
export function rerollSurfaceForProjectEvaluationAssembly(
  assembly: ProjectEvaluationAssembly,
  surface: RerollSurface,
): RerollSurfaceSettlement | undefined {
  const key = rerollSurfaceKey(surface);
  return rewardsOf(assembly, rerollSurfaceOwner(surface).biomeKey)?.rerollSurfaces.find(
    (candidate) => rerollSurfaceKey(candidate.surface) === key,
  );
}

/**
 * Every reached stay of one Hub in visit order, each with its board: every
 * door's reward as the stay assigned it and after the stay's presses, and
 * which doors are closed because their room was entered.
 */
export function hubStaysForProjectEvaluationAssembly(
  assembly: ProjectEvaluationAssembly,
  hub: HubDecisionAddress,
): readonly RerollSurfaceSettlement[] {
  const key = semanticAddressKey(hub);
  return Object.freeze(
    (rewardsOf(assembly, hub.biomeKey)?.rerollSurfaces ?? [])
      .filter(
        (candidate) =>
          candidate.surface.kind === 'hubStay' && semanticAddressKey(candidate.surface.hub) === key,
      )
      .sort(
        (left, right) =>
          (left.surface.kind === 'hubStay' ? left.surface.precedingVisitCount : 0) -
          (right.surface.kind === 'hubStay' ? right.surface.precedingVisitCount : 0),
      ),
  );
}

/** A new spend from the run's reroll pool. */
export type RerollSpend =
  /** One press appended to a surface (`rerollAppendIndex`). */
  | { readonly kind: 'press'; readonly surface: RerollSurface }
  /** One more reroll of a screen in this room, from its current count. */
  | { readonly kind: 'screen'; readonly occurrence: OccurrenceAddress; readonly fromCount: number }
  /** One Well or Pool reroll appended at the end of its room's actions. */
  | {
      readonly kind: 'featureReroll';
      readonly occurrence: OccurrenceAddress;
      readonly feature: RollFeature;
    };

export type RerollSpendAllowance =
  | { readonly kind: 'unreached' }
  | {
      readonly kind: 'reached';
      /** What the spend adds: 1 for a press, the next count for a screen or Well or Pool. */
      readonly cost: number;
      /** The run's lowest pool from the spend to the end of the reached run, before it. */
      readonly lowestRemaining: number;
      /** False when the spend would leave the pool short anywhere from there on. */
      readonly allowed: boolean;
    };

/**
 * The run's lowest reroll pool from one history event of a biome to the end
 * of the reached run, later biomes included; undefined when no pool is known
 * at that event.
 */
function lowestPoolFrom(
  assembly: ProjectEvaluationAssembly,
  biomeKey: string,
  historySequence: number,
): number | undefined {
  const biomes = assembly.evaluation.route.biomes;
  const index = biomes.findIndex((biome) => biome.biomeKey === biomeKey);
  const own = biomes[index];
  if (own === undefined || !('rewards' in own)) return undefined;
  const points = own.rewards.rerollPool;
  const at = points.findLast((point) => point.historySequence <= historySequence);
  if (at === undefined) return undefined;
  let lowest = at.remaining;
  for (const point of points)
    if (point.historySequence > historySequence) lowest = Math.min(lowest, point.remaining);
  for (const later of biomes.slice(index + 1))
    if ('rewards' in later)
      for (const point of later.rewards.rerollPool) lowest = Math.min(lowest, point.remaining);
  return lowest;
}

/**
 * Whether a new spend fits the run's reroll pool, the fixed budget the edit
 * settlement enforces: no spend from there on may be left short. A press of a
 * target the game refuses spends nothing; that is the surface's question.
 * A screen is placed at its room's entry, so a pool grant later in that room
 * before the screen can only make the answer stricter than the settlement.
 */
export function rerollSpendAllowanceForProjectEvaluationAssembly(
  assembly: ProjectEvaluationAssembly,
  spend: RerollSpend,
): RerollSpendAllowance {
  const unreached = Object.freeze({ kind: 'unreached' as const });
  let biomeKey: string;
  let historySequence: number | undefined;
  let cost: number;
  if (spend.kind === 'press') {
    const surface = rerollSurfaceForProjectEvaluationAssembly(assembly, spend.surface);
    biomeKey = rerollSurfaceOwner(spend.surface).biomeKey;
    historySequence = surface?.historySequence;
    cost = 1;
  } else if (spend.kind === 'featureReroll') {
    const interaction = (
      spend.feature === 'stygianWell'
        ? stygianWellCandidateForProjectEvaluationAssembly(assembly, spend.occurrence)
        : purgingPoolCandidateForProjectEvaluationAssembly(assembly, spend.occurrence)
    )?.interaction;
    biomeKey = spend.occurrence.biomeKey;
    historySequence = interaction?.historySequence;
    cost = interaction?.reroll.cost ?? 1;
  } else {
    biomeKey = spend.occurrence.biomeKey;
    const key = semanticAddressKey(spend.occurrence);
    const biome = assembly.evaluation.route.biomes.find(
      (candidate) => candidate.biomeKey === biomeKey,
    );
    historySequence =
      biome === undefined || !('history' in biome)
        ? undefined
        : biome.history.events.find(
            (event) => event.kind === 'roomEntered' && semanticAddressKey(event.origin) === key,
          )?.sequence;
    cost = spend.fromCount + 1;
  }
  if (historySequence === undefined) return unreached;
  const lowestRemaining = lowestPoolFrom(assembly, biomeKey, historySequence);
  if (lowestRemaining === undefined) return unreached;
  return Object.freeze({
    kind: 'reached',
    cost,
    lowestRemaining,
    allowed: lowestRemaining >= cost,
  });
}
