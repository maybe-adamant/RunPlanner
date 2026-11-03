import type { Catalog } from '../../catalog-schema';
import {
  createRewardBagState,
  type ResolvedRewardOffer,
  type RewardBagState,
} from '../../reward-kernel';
import type { FindingEvidence } from '../model';
import type { RewardEvent } from './model';
import type { ReachedLevelResolutionEvaluation, ReachedTraitOfferEvaluation } from '../traits';
import type { SimulationState } from '../state/model';

export interface PendingShopTravelRefillCapability {
  readonly evaluateOffer: (
    offer: ResolvedRewardOffer,
  ) => import('./producer-frontiers').RewardProducerCandidateResult;
  readonly evaluateShopOption: (
    selection: import('../../reward-kernel').ShopOptionSelection,
  ) => import('./producer-frontiers').RewardProducerCandidateResult;
}

export interface PendingShopContinuation {
  readonly travelRefill?: PendingShopTravelRefillCapability;
}

export interface RewardBranchState {
  readonly state: SimulationState;
  readonly events: readonly RewardEvent[];
  readonly pendingShopContinuations: Readonly<Record<string, PendingShopContinuation>>;
  readonly processedThroughHistorySequence: number;
  readonly traitEvaluations?: readonly ReachedTraitOfferEvaluation[];
  readonly levelResolutionEvaluations?: readonly ReachedLevelResolutionEvaluation[];
  /**
   * Sea Star eligibility is decided at a source role's pre-acquisition
   * frontier, then carried until its separately authored duplicate action.
   * This deliberately survives later room actions which can change traits.
   */
  readonly seaStarDuplicateEligibilityBySource?: Readonly<
    Record<string, { readonly supported: boolean; readonly evidence: FindingEvidence }>
  >;
}

/** Applies a transition to the reached state, if any. */
export function mapReached(
  branch: RewardBranchState | undefined,
  transition: (reached: RewardBranchState) => RewardBranchState | undefined,
): RewardBranchState | undefined {
  return branch === undefined ? undefined : transition(branch);
}

export type RewardEventData<Event extends RewardEvent = RewardEvent> = Event extends RewardEvent
  ? Omit<Event, 'historySequence' | 'rewardSequence'>
  : never;

export function freezeRecord<T>(value: Readonly<Record<string, T>>): Readonly<Record<string, T>> {
  return Object.freeze({ ...value });
}

/** Lazily creates one counted bag while retaining every other branch product. */
export function withBag(
  catalog: Catalog,
  branch: RewardBranchState,
  storeKey: string,
): { readonly branch: RewardBranchState; readonly bag: RewardBagState } | undefined {
  const store = catalog.rewards.stores.byKey[storeKey];
  if (store === undefined) return undefined;
  const current = branch.state.bags[storeKey];
  if (current !== undefined) return { branch, bag: current };
  const bag = createRewardBagState(store, branch.state.reached.routePosition.routeKey);
  return {
    branch: Object.freeze({
      ...branch,
      state: Object.freeze({
        ...branch.state,
        bags: freezeRecord({ ...branch.state.bags, [storeKey]: bag }),
      }),
    }),
    bag,
  };
}

export function appendRewardEvent(
  branch: RewardBranchState,
  historySequence: number,
  event: RewardEventData,
): RewardBranchState {
  const next = Object.freeze({
    ...event,
    rewardSequence: branch.events.length + 1,
    historySequence,
  }) as RewardEvent;
  return Object.freeze({
    ...branch,
    events: Object.freeze([...branch.events, next]),
    processedThroughHistorySequence: historySequence,
  });
}

export function offerEvidence(offer: ResolvedRewardOffer): FindingEvidence {
  const payload = offer.payload;
  return {
    rewardType: offer.rewardType,
    ...(payload?.kind === 'BoonSource' ? { source: payload.source } : {}),
    ...(payload?.kind === 'DevotionPair'
      ? { chosenSource: payload.chosenSource, spurnedSource: payload.spurnedSource }
      : {}),
  };
}
