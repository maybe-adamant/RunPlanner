import {
  createRoomRunStateCheckpointAddress,
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
import { screenRerollCost } from '../../authored-project/screen-rerolls';
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

/** One more reroll of a screen in this room, from its current count. */
export interface ScreenRerollSpend {
  readonly kind: 'screen';
  readonly occurrence: OccurrenceAddress;
  readonly fromCount: number;
}

/** A new spend from the run's reroll pool. */
export type RerollSpend =
  /** One press appended to a surface (`rerollAppendIndex`). */
  | { readonly kind: 'press'; readonly surface: RerollSurface }
  | ScreenRerollSpend
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
      /** The run's pool at the spend's own point, before it. */
      readonly remaining: number;
      /** False when the pool there cannot pay the spend; later spends it starves report. */
      readonly allowed: boolean;
    };

/** Why a screen's rerolls stop at their highest count. */
export type ScreenRerollLimit =
  /** No held card enables screen rerolls at the room's entry. */
  | 'notEnabled'
  /** The pool there is spent exactly. */
  | 'poolEmpty'
  /** The pool there has some left, less than the next reroll costs. */
  | 'poolShort';

/** A screen's next reroll, with how far the pool at its own point can take it. */
export type ScreenRerollAllowance =
  | { readonly kind: 'unreached' }
  | (Extract<RerollSpendAllowance, { readonly kind: 'reached' }> & {
      /** Whether a held card enables screen rerolls at the room's entry. */
      readonly enabled: boolean;
      /** The highest count the pool there pays for; never below the current count. */
      readonly maxCount: number;
      readonly limit: ScreenRerollLimit;
    });

/** The run's reroll pool at one history event of a biome; undefined when none is known there. */
function poolAt(
  assembly: ProjectEvaluationAssembly,
  biomeKey: string,
  historySequence: number,
): number | undefined {
  const own = assembly.evaluation.route.biomes.find((biome) => biome.biomeKey === biomeKey);
  if (own === undefined || !('rewards' in own)) return undefined;
  return own.rewards.rerollPool.findLast((point) => point.historySequence <= historySequence)
    ?.remaining;
}

/**
 * Whether a new spend fits the run's reroll pool at its own point, the fixed
 * budget the edit settlement enforces. An earlier spend takes precedence: one
 * that starves later spends is allowed, and those report the over-spend. A
 * press of a target the game refuses spends nothing; that is the surface's
 * question. A screen is placed at its room's entry, so a pool grant later in
 * that room before the screen can only make the answer stricter.
 */
export function rerollSpendAllowanceForProjectEvaluationAssembly(
  assembly: ProjectEvaluationAssembly,
  spend: ScreenRerollSpend,
): ScreenRerollAllowance;
export function rerollSpendAllowanceForProjectEvaluationAssembly(
  assembly: ProjectEvaluationAssembly,
  spend: RerollSpend,
): RerollSpendAllowance;
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
  const atPoint = poolAt(assembly, biomeKey, historySequence);
  if (atPoint === undefined) return unreached;
  // A screen spends at its own point, after the room's entry: its own rerolls
  // so far are not yet spent there.
  const remaining = spend.kind === 'screen' ? atPoint - screenRerollCost(spend.fromCount) : atPoint;
  const reached = { kind: 'reached' as const, cost, remaining, allowed: remaining >= cost };
  if (spend.kind !== 'screen') return Object.freeze(reached);
  return Object.freeze({ ...reached, ...screenRerollReach(assembly, spend, remaining) });
}

/** How many rerolls of a screen the pool left at its point pays for, beyond its current count. */
function screenRerollReach(
  assembly: ProjectEvaluationAssembly,
  spend: ScreenRerollSpend,
  remaining: number,
): { readonly enabled: boolean; readonly maxCount: number; readonly limit: ScreenRerollLimit } {
  const entered = semanticAddressKey(
    createRoomRunStateCheckpointAddress(spend.occurrence, { kind: 'roomEntered' }),
  );
  const enabled =
    rewardsOf(assembly, spend.occurrence.biomeKey)?.runStateSnapshots.find(
      (snapshot) => semanticAddressKey(snapshot.owner) === entered,
    )?.rerolls.screensEnabled === true;
  if (!enabled) return { enabled, maxCount: spend.fromCount, limit: 'notEnabled' };
  const extra = (count: number) => screenRerollCost(count) - screenRerollCost(spend.fromCount);
  let maxCount = spend.fromCount;
  while (extra(maxCount + 1) <= remaining) maxCount += 1;
  return { enabled, maxCount, limit: remaining - extra(maxCount) > 0 ? 'poolShort' : 'poolEmpty' };
}
