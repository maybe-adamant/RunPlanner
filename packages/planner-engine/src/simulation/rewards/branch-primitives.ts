import type { Catalog } from '../../catalog-schema';
import { semanticAddressKey } from '../../authored-project/addresses';
import {
  createRewardBagState,
  type ResolvedRewardOffer,
  type RewardBagState,
} from '../../reward-kernel';
import type { FindingEvidence } from '../model';
import type { RewardEvent } from './model';
import {
  traitOfferAssessmentIdentity,
  type ReachedLevelResolutionEvaluation,
  type ReachedTraitOfferEvaluation,
} from '../traits';
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
  const bag = createRewardBagState(store);
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

function orderedRecord<T>(value: Readonly<Record<string, T>>): readonly (readonly [string, T])[] {
  return Object.freeze(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => Object.freeze([key, entry] as const)),
  );
}

function equivalentBranchStateKey(branch: RewardBranchState): string {
  const state = branch.state;
  const history = state.rewardHistory;
  return JSON.stringify({
    state: {
      equipment: state.equipment,
      reached: {
        routeKey: state.reached.routePosition.routeKey,
        ordinal: state.reached.routePosition.ordinal,
      },
      bags: orderedRecord(state.bags),
      rewardPriorities: state.rewardPriorities,
      hexProgress: state.hexProgress,
      history: {
        offerHistory: history.offerHistory,
        useRecord: orderedRecord(history.useRecord),
        biomeUseRecord: orderedRecord(history.biomeUseRecord),
        currentRoomUseRecord: orderedRecord(history.currentRoomUseRecord),
        lootTypeHistory: orderedRecord(history.lootTypeHistory),
        lootBiomeRecord: orderedRecord(history.lootBiomeRecord),
        consumableRecord: orderedRecord(history.consumableRecord),
        lastRewardRecreation: history.lastRewardRecreation,
        traitFacts: history.traitFacts,
        lastDevotionDepth: history.lastDevotionDepth,
      },
      pendingShops: orderedRecord(state.pendingShops),
      pendingHermesShrineDeliveries: orderedRecord(state.pendingHermesShrineDeliveries),
      stygianWell: state.stygianWell,
      traitHistory: state.traitHistory,
      arcanaFear: state.arcanaFear,
      keepsakes: state.keepsakes,
      rewardLookups: orderedRecord(state.rewardLookups),
    },
    rewardForfeited: branch.events
      .filter((event) => event.kind === 'rewardForfeited')
      .map((event) =>
        Object.freeze({
          origin: semanticAddressKey(event.origin),
          rewardType: event.rewardType,
          replacementRewardType: event.replacementRewardType,
        }),
      ),
    ...(branch.seaStarDuplicateEligibilityBySource === undefined
      ? {}
      : {
          seaStarDuplicateEligibilityBySource: orderedRecord(
            branch.seaStarDuplicateEligibilityBySource,
          ),
        }),
    processedThroughHistorySequence: branch.processedThroughHistorySequence,
  });
}

function mergeTraitEvaluations(
  left: readonly ReachedTraitOfferEvaluation[] | undefined,
  right: readonly ReachedTraitOfferEvaluation[] | undefined,
): readonly ReachedTraitOfferEvaluation[] | undefined {
  const values = [...(left ?? []), ...(right ?? [])];
  if (values.length === 0) return undefined;
  const unique = new Map<string, ReachedTraitOfferEvaluation>();
  for (const value of values) {
    const key = JSON.stringify([
      semanticAddressKey(value.address),
      value.acquisitionRole,
      value.chronologicalIndex,
      ...traitOfferAssessmentIdentity(value),
    ]);
    unique.set(key, value);
  }
  return Object.freeze([...unique.values()]);
}

function mergeLevelResolutionEvaluations(
  left: readonly ReachedLevelResolutionEvaluation[] | undefined,
  right: readonly ReachedLevelResolutionEvaluation[] | undefined,
): readonly ReachedLevelResolutionEvaluation[] | undefined {
  const values = [...(left ?? []), ...(right ?? [])];
  if (values.length === 0) return undefined;
  const unique = new Map<string, ReachedLevelResolutionEvaluation>();
  for (const value of values) {
    unique.set(
      JSON.stringify([
        semanticAddressKey(value.address),
        value.chronologicalIndex,
        value.before,
        value.value,
      ]),
      value,
    );
  }
  return Object.freeze([...unique.values()]);
}

export function mergeEquivalentRewardBranches(
  branches: readonly RewardBranchState[],
): readonly RewardBranchState[] {
  const merged = new Map<string, RewardBranchState>();
  for (const branch of branches) {
    const key = equivalentBranchStateKey(branch);
    const previous = merged.get(key);
    if (previous === undefined) {
      merged.set(key, branch);
    } else {
      const traitEvaluations = mergeTraitEvaluations(
        previous.traitEvaluations,
        branch.traitEvaluations,
      );
      const levelResolutionEvaluations = mergeLevelResolutionEvaluations(
        previous.levelResolutionEvaluations,
        branch.levelResolutionEvaluations,
      );
      merged.set(
        key,
        traitEvaluations === undefined && levelResolutionEvaluations === undefined
          ? previous
          : Object.freeze({
              ...previous,
              ...(traitEvaluations === undefined ? {} : { traitEvaluations }),
              ...(levelResolutionEvaluations === undefined ? {} : { levelResolutionEvaluations }),
            }),
      );
    }
  }
  return Object.freeze([...merged.values()]);
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
