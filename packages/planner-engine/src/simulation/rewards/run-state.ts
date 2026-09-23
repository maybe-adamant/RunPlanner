import {
  semanticAddressKey,
  type ExitDecisionAddress,
  type HubDecisionAddress,
  type RoomRunStateCheckpointAddress,
} from '../../authored-project/addresses';
import { optionIndex } from '../../authored-project/traits/state';
import type { BiomeLayout, Catalog, TraitElement } from '../../catalog-schema';
import type { RequirementExpression } from '../../requirements/model';
import { evaluateRequirement } from '../../requirements/evaluator';
import {
  ordinarySourceGameNames,
  supportedPayloads,
  type RewardKernelFacts,
  type RewardStoreDeclaration,
  type RewardTypeDeclaration,
} from '../../reward-kernel';
import type { HistoryCounters } from '../history';
import {
  bankableRewardStoreKeys,
  enteredRewardStoreTally,
  rolledRewardStoreTargetRatio,
  type EnteredRewardStoreTally,
} from './biome/reward-store-support';
import type { TraitHistoryState } from '../traits/history/model';
import type { SimulationState } from '../state/model';
import { artificerStatus, attestEffectiveHordesRank } from '../arcana-fear';

export type RunStateOwner =
  ExitDecisionAddress | HubDecisionAddress | RoomRunStateCheckpointAddress;

export interface DecisionGodPoolState {
  readonly acquiredSourceKeys: readonly string[];
  readonly effectiveSourceKeys: readonly string[];
  readonly capNarrowed: boolean;
}

export interface DecisionTraitState {
  readonly equippedTraits: TraitHistoryState['equippedTraits'];
  /** The complete six-slot equipment ledger, including the rarityless Spell slot. */
  readonly equippedSlots: TraitHistoryState['equippedSlots'];
  readonly elementCounts: Readonly<Record<TraitElement, number>>;
  readonly godBoonRarityCounts: TraitHistoryState['godBoonRarityCounts'];
  readonly upgradableTraitCount: number;
  readonly bannedTraitKeys: TraitHistoryState['bannedTraitKeys'];
  readonly properUpbringingActive?: TraitHistoryState['properUpbringingActive'];
  readonly echoShopDuplicateStatus?: 'pending' | 'consumed';
  /** Engine-derived Steady Growth progress and current rarity interval. */
  readonly steadyGrowth?: Readonly<
    Record<string, { readonly progress: number; readonly interval: number }>
  >;
  /** Derived selected-pair chronology; presentation does not replay lifecycle events. */
  readonly chaos: {
    readonly active: readonly DecisionActiveChaosState[];
    readonly matured: readonly DecisionMaturedChaosState[];
  };
}

export interface DecisionActiveChaosState {
  readonly curseKey: string;
  readonly curseLabel: string;
  readonly blessingKey: string;
  readonly blessingLabel: string;
  readonly rarity: string;
  readonly clock: 'encounters' | 'locations' | 'godBoonScreens';
  readonly clockLabel: string;
  readonly initial: number;
  readonly remaining: number;
  readonly curseValues: Readonly<Record<string, number>>;
  readonly blessingValues: Readonly<Record<string, number>>;
  readonly derivedOutcome?: import('../../catalog-schema').ChaosDerivedOutcome;
}
export interface DecisionMaturedChaosState {
  readonly blessingKey: string;
  readonly blessingLabel: string;
  readonly rarity: string;
  readonly blessingValues: Readonly<Record<string, number>>;
  readonly derivedOutcome?: import('../../catalog-schema').ChaosDerivedOutcome;
}

export interface DecisionCounterState extends HistoryCounters {
  readonly runDepthCache: number;
  readonly enteredBiomes: number;
  readonly upgradableTraitCount: number;
  readonly lastDevotionDepth?: number;
}

export type DecisionRewardBagCount =
  | { readonly kind: 'exact'; readonly count: number }
  | { readonly kind: 'range'; readonly min: number; readonly max: number };

export interface DecisionRewardBagConditionGroup {
  readonly requirement?: RequirementExpression;
  readonly remaining: DecisionRewardBagCount;
}

export interface DecisionRewardBagEntryGroup {
  readonly rewardType: string;
  readonly eligibility: 'eligible' | 'ineligible';
  readonly remaining: DecisionRewardBagCount;
  readonly conditions: readonly DecisionRewardBagConditionGroup[];
}

export interface DecisionRewardBagState {
  readonly storeKey: string;
  readonly remaining: DecisionRewardBagCount;
  readonly entries: readonly DecisionRewardBagEntryGroup[];
}

/** The base-store controller's inputs at this checkpoint, for comparison against the live game. */
export interface RunStateRewardStoreController extends EnteredRewardStoreTally {
  /** The biome's rolled target, or `bankableStoreKeys` instead where no door rolls. */
  readonly targetMetaRewardsRatio?: number;
  readonly bankableStoreKeys?: readonly string[];
}

export interface RunStateSnapshot {
  readonly owner: RunStateOwner;
  readonly historySequence: number;
  readonly checkpoint:
    'beforeTargetGeneration' | 'roomEntered' | 'beforeEncounterStart' | 'beforeRoomExit';
  readonly godPool: DecisionGodPoolState;
  readonly traits: DecisionTraitState;
  readonly counters: DecisionCounterState;
  readonly arcanaFear: SimulationState['arcanaFear'];
  /** Attested at this lifecycle checkpoint; generated encounters consume this exact rank. */
  readonly effectiveHordesRank?: number;
  /** Branch-derived identity chronology; effects are introduced by later gates. */
  readonly keepsakes: SimulationState['keepsakes'];
  readonly rewardPriorities: SimulationState['rewardPriorities'];
  /** Cross-room Shrine orders, including their exact maturity clocks and due hosts. */
  readonly pendingHermesShrineDeliveries: SimulationState['pendingHermesShrineDeliveries'];
  /** Consequential Well effects retained after the purchase room closes. */
  readonly stygianWell: SimulationState['stygianWell'];
  readonly hexProgress: SimulationState['hexProgress'];
  /** Game-facing Hex identity, resolved while the normalized catalog is available. */
  readonly hexObserver: {
    readonly spellTraitKey?: string;
    readonly layoutKey?: string;
    readonly talentKeys: readonly string[];
    readonly closed: boolean;
    readonly bankedPathPoints: number;
    readonly investedPathPoints: number;
  };
  /** Normalized Artificer counters, derived where the catalog is available. */
  readonly artificer?: {
    readonly usedCount: number;
    readonly remainingCount: number;
  };
  readonly forfeitStatus: 'inactive' | 'available' | 'consumed';
  readonly rewardStoreController: RunStateRewardStoreController;
  readonly bags: readonly DecisionRewardBagState[];
}

export function forfeitStatus(
  state: SimulationState['arcanaFear'],
): 'inactive' | 'available' | 'consumed' {
  if (state.fear.forfeitConsumed) return 'consumed';
  return (state.fear.effectiveRanks.BoonSkipShrineUpgrade ?? 0) > 0 ? 'available' : 'inactive';
}

export interface RunStateAvailability {
  readonly owner: RunStateOwner;
  readonly availability: 'available' | 'unavailable';
  readonly reason?: 'coverageNotReached';
}

export interface RunStatePublication {
  readonly snapshots: readonly RunStateSnapshot[];
  readonly availability: readonly RunStateAvailability[];
}

interface RunStateContext {
  readonly catalog: Catalog;
  /** This checkpoint's biome; the controller's target is a biome declaration, not a run fact. */
  readonly layout: BiomeLayout;
  readonly owner: RunStateOwner;
  /**
   * The exact reached snapshots this checkpoint projects, in branch order. Each
   * already carries the checkpoint's history view and route position, so the
   * projection never receives a second copy of either. Every state must have
   * been reached at the same view and position: one checkpoint has one history
   * sequence, and the projection reads it from the first state.
   */
  readonly states: readonly SimulationState[];
  readonly rewardFacts: (state: SimulationState) => RewardKernelFacts;
  readonly derivationCache?: RunStateDerivationCache;
  /** Exact source/view/shop/peer closure used by rewardFacts. Required with a shared cache. */
  readonly factsContextToken?: object;
}

interface RunStateDerivationCache {
  readonly objectIds: WeakMap<object, number>;
  readonly traitsByHistory: WeakMap<TraitHistoryState, DecisionTraitState>;
  readonly bagsByBranchState: Map<string, readonly DecisionRewardBagState[]>;
  readonly bagCountsByState: WeakMap<SimulationState['bags'], string>;
  readonly factsByContextHistory: Map<string, RewardKernelFacts>;
  readonly godPoolByContextHistory: Map<string, DecisionGodPoolState>;
  readonly bagEligibilityByContextHistory: Map<
    string,
    {
      readonly signature: string;
      readonly byStore: ReadonlyMap<string, readonly boolean[]>;
    }
  >;
  readonly branchStateByIdentity: Map<
    string,
    {
      readonly godPool: DecisionGodPoolState;
      readonly traits: DecisionTraitState;
      readonly arcanaFear: SimulationState['arcanaFear'];
      readonly keepsakes: SimulationState['keepsakes'];
      readonly rewardPriorities: SimulationState['rewardPriorities'];
      readonly pendingHermesShrineDeliveries: SimulationState['pendingHermesShrineDeliveries'];
      readonly stygianWell: SimulationState['stygianWell'];
      readonly hexProgress: SimulationState['hexProgress'];
      readonly forfeitStatus: 'inactive' | 'available' | 'consumed';
    }
  >;
  nextObjectId: number;
}

export function createRunStateDerivationCache(): RunStateDerivationCache {
  return {
    objectIds: new WeakMap(),
    traitsByHistory: new WeakMap(),
    bagsByBranchState: new Map(),
    bagCountsByState: new WeakMap(),
    factsByContextHistory: new Map(),
    godPoolByContextHistory: new Map(),
    bagEligibilityByContextHistory: new Map(),
    branchStateByIdentity: new Map(),
    nextObjectId: 1,
  };
}

function objectId(cache: RunStateDerivationCache, value: object): number {
  const existing = cache.objectIds.get(value);
  if (existing !== undefined) return existing;
  const id = cache.nextObjectId;
  cache.nextObjectId += 1;
  cache.objectIds.set(value, id);
  return id;
}

function rewardBagEligibilitySignature(
  catalog: Catalog,
  facts: RewardKernelFacts,
): { readonly signature: string; readonly byStore: ReadonlyMap<string, readonly boolean[]> } {
  const byStore = new Map(
    catalog.rewards.stores.values.map(
      (store) =>
        [
          store.key,
          Object.freeze(
            store.entries.map((entry) =>
              entry.requirement === undefined ||
              evaluateRequirement(entry.requirement, facts.requirements)
                ? true
                : false,
            ),
          ),
        ] as const,
    ),
  );
  return Object.freeze({
    signature: catalog.rewards.stores.values
      .flatMap((store) => byStore.get(store.key)?.map((eligible) => (eligible ? '1' : '0')) ?? [])
      .join(''),
    byStore,
  });
}

function rewardBagCountSignature(catalog: Catalog, bags: SimulationState['bags']): string {
  return catalog.rewards.stores.values
    .map((store) => (bags[store.key]?.remainingEntryCounts ?? store.entries.map(() => 1)).join(','))
    .join('|');
}

export function aggregateDecisionRewardBag(
  store: RewardStoreDeclaration,
  states: readonly Pick<SimulationState, 'bags'>[],
  factsByBranch: readonly RewardKernelFacts[],
  eligibilityByBranch?: readonly (readonly boolean[])[],
): DecisionRewardBagState {
  type BranchCondition = { readonly requirement?: RequirementExpression; count: number };
  type BranchGroup = {
    readonly rewardType: string;
    readonly eligibility: 'eligible' | 'ineligible';
    total: number;
    readonly conditions: Map<string, BranchCondition>;
  };
  const entryDescriptors = store.entries.map((entry) => ({
    entry,
    conditionKey: JSON.stringify(entry.requirement),
    eligibleKey: JSON.stringify([entry.rewardType, 'eligible']),
    ineligibleKey: JSON.stringify([entry.rewardType, 'ineligible']),
  }));
  if (states.length === 1) {
    const state = states[0];
    const facts = factsByBranch[0];
    if (state === undefined || facts === undefined) {
      throw new Error(`run-state store ${store.key} has no branch facts`);
    }
    const counts = state.bags[store.key]?.remainingEntryCounts ?? store.entries.map(() => 1);
    const groups = new Map<string, BranchGroup>();
    let storeTotal = 0;
    for (const [entryIndex, descriptor] of entryDescriptors.entries()) {
      const { entry } = descriptor;
      const requirement = entry.requirement;
      const eligibility =
        eligibilityByBranch?.[0]?.[entryIndex] === true ||
        (eligibilityByBranch === undefined &&
          (requirement === undefined || evaluateRequirement(requirement, facts.requirements)))
          ? 'eligible'
          : 'ineligible';
      const key = eligibility === 'eligible' ? descriptor.eligibleKey : descriptor.ineligibleKey;
      const conditionKey = descriptor.conditionKey;
      const remaining = counts[entryIndex] ?? 0;
      storeTotal += remaining;
      let group = groups.get(key);
      if (group === undefined) {
        group = {
          rewardType: entry.rewardType,
          eligibility,
          total: 0,
          conditions: new Map(),
        };
        groups.set(key, group);
      }
      group.total += remaining;
      const condition = group.conditions.get(conditionKey);
      if (condition === undefined) {
        group.conditions.set(conditionKey, {
          ...(requirement === undefined ? {} : { requirement }),
          count: remaining,
        });
      } else {
        condition.count += remaining;
      }
    }
    return Object.freeze({
      storeKey: store.key,
      remaining: Object.freeze({ kind: 'exact' as const, count: storeTotal }),
      entries: Object.freeze(
        [...groups.values()].map((group) =>
          Object.freeze({
            rewardType: group.rewardType,
            eligibility: group.eligibility,
            remaining: Object.freeze({ kind: 'exact' as const, count: group.total }),
            conditions: Object.freeze(
              [...group.conditions.values()].map((condition) =>
                Object.freeze({
                  ...(condition.requirement === undefined
                    ? {}
                    : { requirement: condition.requirement }),
                  remaining: Object.freeze({ kind: 'exact' as const, count: condition.count }),
                }),
              ),
            ),
          }),
        ),
      ),
    });
  }
  const groups = new Map<
    string,
    {
      readonly rewardType: string;
      readonly eligibility: 'eligible' | 'ineligible';
      readonly totalsByBranch: Float64Array;
      readonly conditions: Map<
        string,
        { readonly requirement?: RequirementExpression; countsByBranch: Float64Array }
      >;
    }
  >();
  const storeTotals = new Float64Array(states.length);
  for (const [branchIndex, state] of states.entries()) {
    const facts = factsByBranch[branchIndex];
    if (facts === undefined) {
      throw new Error(`run-state store ${store.key} has no facts for branch ${branchIndex}`);
    }
    const bag = state.bags[store.key];
    const counts = bag?.remainingEntryCounts ?? store.entries.map(() => 1);
    for (const [entryIndex, descriptor] of entryDescriptors.entries()) {
      const { entry } = descriptor;
      const requirement = entry.requirement;
      const eligibility =
        eligibilityByBranch?.[branchIndex]?.[entryIndex] === true ||
        (eligibilityByBranch === undefined &&
          (requirement === undefined || evaluateRequirement(requirement, facts.requirements)))
          ? 'eligible'
          : 'ineligible';
      const key = eligibility === 'eligible' ? descriptor.eligibleKey : descriptor.ineligibleKey;
      const conditionKey = descriptor.conditionKey;
      const remaining = counts[entryIndex] ?? 0;
      storeTotals[branchIndex] = (storeTotals[branchIndex] ?? 0) + remaining;
      let group = groups.get(key);
      if (group === undefined) {
        group = {
          rewardType: entry.rewardType,
          eligibility,
          totalsByBranch: new Float64Array(states.length),
          conditions: new Map(),
        };
        groups.set(key, group);
      }
      group.totalsByBranch[branchIndex] = (group.totalsByBranch[branchIndex] ?? 0) + remaining;
      const condition = group.conditions.get(conditionKey);
      if (condition === undefined) {
        const countsByBranch = new Float64Array(states.length);
        countsByBranch[branchIndex] = remaining;
        group.conditions.set(conditionKey, {
          ...(requirement === undefined ? {} : { requirement }),
          countsByBranch,
        });
      } else {
        condition.countsByBranch[branchIndex] =
          (condition.countsByBranch[branchIndex] ?? 0) + remaining;
      }
    }
  }

  const count = (counts: ArrayLike<number>): DecisionRewardBagCount => {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < counts.length; index += 1) {
      const value = counts[index] ?? 0;
      if (value < min) min = value;
      if (value > max) max = value;
    }
    return min === max
      ? Object.freeze({ kind: 'exact' as const, count: min })
      : Object.freeze({ kind: 'range' as const, min, max });
  };

  return Object.freeze({
    storeKey: store.key,
    remaining: count(storeTotals),
    entries: Object.freeze(
      [...groups.values()].map((group) => {
        return Object.freeze({
          rewardType: group.rewardType,
          eligibility: group.eligibility,
          remaining: count(group.totalsByBranch),
          conditions: Object.freeze(
            [...group.conditions.values()].map((condition) =>
              Object.freeze({
                ...(condition.requirement === undefined
                  ? {}
                  : { requirement: condition.requirement }),
                remaining: count(condition.countsByBranch),
              }),
            ),
          ),
        });
      }),
    ),
  });
}

function traitState(catalog: Catalog, source: TraitHistoryState): DecisionTraitState {
  const echoShopTrait = catalog.traits.values.find(
    (trait) =>
      trait.selectedDisposition.kind === 'echo' &&
      trait.selectedDisposition.effect === 'doubleShop',
  );
  const echoShopAcquired =
    echoShopTrait !== undefined &&
    source.events.some((event) => {
      if (event.kind !== 'traitOffer') return false;
      return event.options[optionIndex(event.selectedOptionKey)]?.traitKey === echoShopTrait.key;
    });
  const steadyGrowth = Object.fromEntries(
    Object.values(source.equippedTraits).flatMap((equipped) => {
      const disposition = catalog.traits.byKey[equipped.traitKey]?.selectedDisposition;
      if (disposition?.kind !== 'steadyGrowth') return [];
      const rarity = equipped.rarity;
      if (rarity === undefined || !(rarity in disposition.intervalsByRarity)) return [];
      return [
        [
          equipped.traitKey,
          Object.freeze({
            interval:
              disposition.intervalsByRarity[rarity as keyof typeof disposition.intervalsByRarity],
            progress: equipped.steadyGrowthProgress ?? 0,
          }),
        ] as const,
      ];
    }),
  );
  return Object.freeze({
    equippedTraits: Object.freeze({ ...source.equippedTraits }),
    equippedSlots: Object.freeze({ ...source.equippedSlots }),
    elementCounts: Object.freeze({ ...source.elementCounts }),
    godBoonRarityCounts: Object.freeze({ ...source.godBoonRarityCounts }),
    upgradableTraitCount: source.upgradableTraitCount,
    bannedTraitKeys: source.bannedTraitKeys,
    ...(Object.keys(steadyGrowth).length === 0
      ? {}
      : { steadyGrowth: Object.freeze(steadyGrowth) }),
    chaos: Object.freeze({
      active: Object.freeze(
        source.activeChaosCurses.map((entry) => {
          const curse = catalog.chaos.curses.byKey[entry.curseKey];
          const blessing = catalog.chaos.blessings.byKey[entry.blessingKey];
          return Object.freeze({
            curseKey: entry.curseKey,
            curseLabel: curse?.label ?? entry.curseKey,
            blessingKey: entry.blessingKey,
            blessingLabel: blessing?.label ?? entry.blessingKey,
            rarity: entry.rarity,
            clock: entry.clock,
            clockLabel: curse?.duration.label ?? entry.clock,
            initial: entry.duration,
            remaining: entry.remaining,
            curseValues: entry.curseValues,
            blessingValues: entry.blessingValues,
            ...(blessing?.derivedOutcome === undefined
              ? {}
              : { derivedOutcome: blessing.derivedOutcome }),
          });
        }),
      ),
      matured: Object.freeze(
        source.maturedChaosBlessings.map((entry) =>
          Object.freeze({
            blessingKey: entry.blessingKey,
            blessingLabel:
              catalog.chaos.blessings.byKey[entry.blessingKey]?.label ?? entry.blessingKey,
            rarity: entry.rarity,
            blessingValues: entry.blessingValues,
            ...(catalog.chaos.blessings.byKey[entry.blessingKey]?.derivedOutcome === undefined
              ? {}
              : {
                  derivedOutcome: catalog.chaos.blessings.byKey[entry.blessingKey]!.derivedOutcome,
                }),
          }),
        ),
      ),
    }),
    ...(echoShopTrait === undefined || !echoShopAcquired
      ? {}
      : {
          echoShopDuplicateStatus:
            source.equippedTraits[echoShopTrait.key] === undefined
              ? ('consumed' as const)
              : ('pending' as const),
        }),
    ...(source.properUpbringingActive === undefined
      ? {}
      : { properUpbringingActive: source.properUpbringingActive }),
  });
}

function historyCounters(state: SimulationState): DecisionCounterState {
  const history = state.rewardHistory;
  const counters = state.reached.historyView.ledgers.counters;
  return Object.freeze({
    ...counters,
    runDepthCache: counters.roomHistoryOrdinal + 1,
    enteredBiomes: state.reached.routePosition.ordinal,
    upgradableTraitCount: history.traitFacts.upgradableTraitCount,
    ...(history.lastDevotionDepth === undefined
      ? {}
      : { lastDevotionDepth: history.lastDevotionDepth }),
  });
}

function sourcePool(
  catalog: RunStateContext['catalog'],
  facts: RewardKernelFacts,
): DecisionGodPoolState {
  const ordinarySources = ordinarySourceGameNames(catalog.rewards);
  const ordinaryType = catalog.rewards.rewardTypes.values.find(
    (rewardType: RewardTypeDeclaration) =>
      rewardType.sourceSupport === 'ordinaryBoonPeer' ||
      rewardType.sourceSupport === 'ordinaryNoPeer',
  );
  if (ordinaryType === undefined) {
    throw new Error('reward kernel has no ordinary source declaration');
  }
  const effectiveSourceKeys = supportedPayloads(catalog.rewards, ordinaryType, facts).flatMap(
    (payload) => (payload.kind === 'BoonSource' ? [payload.source] : []),
  );
  const acquiredSourceKeys = ordinarySources.filter(
    (source) => (facts.requirements.records.lootTypeHistory[source] ?? 0) > 0,
  );
  return Object.freeze({
    acquiredSourceKeys: Object.freeze([...acquiredSourceKeys]),
    effectiveSourceKeys: Object.freeze(
      ordinarySources.filter((source) => effectiveSourceKeys.includes(source)),
    ),
    capNarrowed: effectiveSourceKeys.length < ordinarySources.length,
  });
}

export function createRunState(context: RunStateContext): RunStateSnapshot | undefined {
  const firstState = context.states[0];
  if (firstState === undefined) return undefined;
  // One checkpoint has one history sequence and one route position, and the
  // published snapshot reads both from the first state. The branch-agreement
  // throw below compares derived counters, which carry the ledger counts and
  // the entered-biome ordinal but not the view's sequence.
  for (const state of context.states) {
    if (
      state.reached.historyView !== firstState.reached.historyView ||
      state.reached.routePosition !== firstState.reached.routePosition
    ) {
      throw new Error('run-state branches were not reached at one exact view and route position');
    }
  }
  const derivationCache = context.derivationCache;
  if (derivationCache !== undefined && context.factsContextToken === undefined) {
    throw new Error('run-state shared derivation cache requires an exact facts context token');
  }
  const contextHistoryKeys = context.states.map((state) =>
    derivationCache === undefined
      ? undefined
      : [
          objectId(derivationCache, context.factsContextToken!),
          objectId(derivationCache, state.rewardHistory),
          objectId(derivationCache, state.pendingHermesShrineDeliveries),
          objectId(derivationCache, state.hexProgress),
          objectId(derivationCache, state.rewardLookups),
        ].join(':'),
  );
  const factsByBranch = context.states.map((state, branchIndex) => {
    const contextHistoryKey = contextHistoryKeys[branchIndex];
    const cached =
      contextHistoryKey === undefined
        ? undefined
        : derivationCache?.factsByContextHistory.get(contextHistoryKey);
    if (cached !== undefined) return cached;
    const facts = context.rewardFacts(state);
    if (contextHistoryKey !== undefined) {
      derivationCache?.factsByContextHistory.set(contextHistoryKey, facts);
    }
    return facts;
  });
  const branchStates = context.states.map((state, index) => {
    const facts = factsByBranch[index];
    const contextHistoryKey = contextHistoryKeys[index];
    if (facts === undefined) {
      throw new Error('run-state branch has no reward facts');
    }
    const cache = context.derivationCache;
    const identityKey =
      cache === undefined
        ? undefined
        : [
            contextHistoryKey,
            objectId(cache, state.traitHistory),
            objectId(cache, state.arcanaFear),
            objectId(cache, state.keepsakes),
            objectId(cache, state.rewardPriorities),
            objectId(cache, state.pendingHermesShrineDeliveries),
            objectId(cache, state.stygianWell),
            objectId(cache, state.hexProgress),
          ].join(':');
    let derived =
      identityKey === undefined ? undefined : cache?.branchStateByIdentity.get(identityKey);
    if (derived === undefined) {
      const cachedGodPool =
        contextHistoryKey === undefined
          ? undefined
          : cache?.godPoolByContextHistory.get(contextHistoryKey);
      const godPool = cachedGodPool ?? sourcePool(context.catalog, facts);
      if (cachedGodPool === undefined && contextHistoryKey !== undefined) {
        cache?.godPoolByContextHistory.set(contextHistoryKey, godPool);
      }
      const cachedTraits = cache?.traitsByHistory.get(state.traitHistory);
      const traits = cachedTraits ?? traitState(context.catalog, state.traitHistory);
      if (cachedTraits === undefined) cache?.traitsByHistory.set(state.traitHistory, traits);
      derived = Object.freeze({
        godPool,
        traits,
        arcanaFear: state.arcanaFear,
        keepsakes: state.keepsakes,
        rewardPriorities: state.rewardPriorities,
        pendingHermesShrineDeliveries: state.pendingHermesShrineDeliveries,
        stygianWell: state.stygianWell,
        hexProgress: state.hexProgress,
        forfeitStatus: forfeitStatus(state.arcanaFear),
      });
      if (identityKey !== undefined) {
        cache?.branchStateByIdentity.set(identityKey, derived);
      }
    }
    return Object.freeze({ ...derived, counters: historyCounters(state) });
  });
  const first = branchStates[0];
  if (first === undefined) return undefined;
  for (const state of branchStates.slice(1)) {
    if (JSON.stringify(state) !== JSON.stringify(first)) {
      throw new Error(
        'run-state non-bag facts vary across exact reward branches and require an explicit product',
      );
    }
  }
  const bagEligibilityByBranch = contextHistoryKeys.map((contextHistoryKey, index) => {
    const cached =
      contextHistoryKey === undefined
        ? undefined
        : derivationCache?.bagEligibilityByContextHistory.get(contextHistoryKey);
    if (cached !== undefined) return cached;
    const facts = factsByBranch[index];
    if (facts === undefined) throw new Error('run-state branch has no reward facts');
    const signature = rewardBagEligibilitySignature(context.catalog, facts);
    if (contextHistoryKey !== undefined) {
      derivationCache?.bagEligibilityByContextHistory.set(contextHistoryKey, signature);
    }
    return signature;
  });
  const bagCountsByBranch = context.states.map((state) => {
    const cached = derivationCache?.bagCountsByState.get(state.bags);
    if (cached !== undefined) return cached;
    const signature = rewardBagCountSignature(context.catalog, state.bags);
    derivationCache?.bagCountsByState.set(state.bags, signature);
    return signature;
  });
  const bagCacheKey =
    derivationCache === undefined
      ? undefined
      : context.states
          .map(
            (_state, index) =>
              `${bagCountsByBranch[index] ?? ''}:${bagEligibilityByBranch[index]?.signature ?? ''}`,
          )
          .join('|');
  let bags =
    bagCacheKey === undefined ? undefined : derivationCache?.bagsByBranchState.get(bagCacheKey);
  if (bags === undefined) {
    bags = Object.freeze(
      context.catalog.rewards.stores.values.map((store) =>
        aggregateDecisionRewardBag(
          store,
          context.states,
          factsByBranch,
          bagEligibilityByBranch.map((eligibility) => eligibility.byStore.get(store.key) ?? []),
        ),
      ),
    );
    if (bagCacheKey !== undefined) {
      derivationCache?.bagsByBranchState.set(bagCacheKey, bags);
    }
  }
  const currentArtificerStatus = artificerStatus(context.catalog, first.arcanaFear);
  const targetMetaRewardsRatio = rolledRewardStoreTargetRatio(context.layout);
  return Object.freeze({
    owner: context.owner,
    historySequence: firstState.reached.historyView.sequence,
    checkpoint:
      context.owner.kind === 'roomRunStateCheckpoint'
        ? context.owner.checkpoint.kind
        : 'beforeTargetGeneration',
    godPool: first.godPool,
    traits: first.traits,
    counters: first.counters,
    arcanaFear: first.arcanaFear,
    effectiveHordesRank: attestEffectiveHordesRank(context.states),
    keepsakes: first.keepsakes,
    rewardPriorities: first.rewardPriorities,
    pendingHermesShrineDeliveries: first.pendingHermesShrineDeliveries,
    stygianWell: first.stygianWell,
    hexProgress: first.hexProgress,
    hexObserver: Object.freeze({
      ...(first.hexProgress.spellTraitKey === undefined
        ? {}
        : { spellTraitKey: first.hexProgress.spellTraitKey }),
      ...(first.hexProgress.tree === undefined
        ? {}
        : { layoutKey: first.hexProgress.tree.layoutKey }),
      talentKeys: Object.freeze([
        ...(first.hexProgress.tree?.rareTalentKeys ?? []),
        ...(first.hexProgress.tree?.epicTalentKeys ?? []),
        ...(first.hexProgress.godSentAdded === true && first.hexProgress.spellTraitKey !== undefined
          ? (() => {
              const godSent = context.catalog.hexes.byKey[first.hexProgress.spellTraitKey]?.godSent;
              return godSent === undefined
                ? []
                : [godSent.olympianTalentKey, godSent.lineageTalentKey];
            })()
          : []),
      ]),
      closed: first.hexProgress.talentDropsClosed === true,
      bankedPathPoints: first.hexProgress.bankedPathPoints,
      investedPathPoints: first.hexProgress.investedPathPoints,
    }),
    ...(currentArtificerStatus === undefined
      ? {}
      : {
          artificer: Object.freeze({
            usedCount: currentArtificerStatus.spent,
            remainingCount: currentArtificerStatus.remaining,
          }),
        }),
    forfeitStatus: first.forfeitStatus,
    rewardStoreController: Object.freeze({
      // No `currentStoreKey`: a checkpoint reports the ledger at its own settled boundary.
      ...enteredRewardStoreTally(firstState.reached.historyView),
      ...(targetMetaRewardsRatio === undefined
        ? { bankableStoreKeys: bankableRewardStoreKeys(context.catalog, context.layout) }
        : { targetMetaRewardsRatio }),
    }),
    bags,
  });
}

/**
 * Keeps the full reward walk available for authored diagnostics while making
 * the public Run State surface obey the progressive validation frontier.
 * Every discovered decision is explicit about whether that frontier reached
 * its pre-generation checkpoint; consumers never infer unavailability from a
 * missing snapshot.
 */
export function publishRunStateThroughCoverage(
  discovered: readonly RunStateSnapshot[],
  covered: readonly RunStateSnapshot[],
  owners: readonly RunStateOwner[] = discovered.map((snapshot) => snapshot.owner),
): RunStatePublication {
  const coveredByOwner = new Map(
    covered.map((snapshot) => [semanticAddressKey(snapshot.owner), snapshot]),
  );
  const knownOwners = new Set<string>();
  const availability: RunStateAvailability[] = [];
  for (const owner of owners) {
    const ownerKey = semanticAddressKey(owner);
    if (knownOwners.has(ownerKey)) continue;
    knownOwners.add(ownerKey);
    availability.push(
      coveredByOwner.has(ownerKey)
        ? Object.freeze({ owner, availability: 'available' })
        : Object.freeze({
            owner,
            availability: 'unavailable',
            reason: 'coverageNotReached',
          }),
    );
  }
  for (const snapshot of covered) {
    const ownerKey = semanticAddressKey(snapshot.owner);
    if (knownOwners.has(ownerKey)) continue;
    knownOwners.add(ownerKey);
    availability.push(Object.freeze({ owner: snapshot.owner, availability: 'available' }));
  }
  return Object.freeze({
    snapshots: Object.freeze([...covered]),
    availability: Object.freeze(availability),
  });
}
