import {
  semanticAddressKey,
  type ExitDecisionAddress,
  type HubDecisionAddress,
  type RoomRunStateCheckpointAddress,
} from '../../authored-project/addresses';
import { optionIndex } from '../../authored-project/traits';
import type { Catalog, TraitElement } from '../../catalog-schema';
import type { RequirementExpression } from '../../requirements/model';
import { evaluateRequirement } from '../../requirements/evaluator';
import {
  ordinarySourceGameNames,
  supportedPayloads,
  type RewardHistoryState,
  type RewardKernelFacts,
  type RewardStoreDeclaration,
  type RewardTypeDeclaration,
} from '../../reward-kernel';
import type { HistoryCounters, HistoryStateView } from '../history';
import type { TraitHistoryState } from '../trait-history';
import type { RewardBranchState } from './processing';

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

export interface RunStateSnapshot {
  readonly owner: RunStateOwner;
  readonly historySequence: number;
  readonly checkpoint:
    'beforeTargetGeneration' | 'roomEntered' | 'beforeEncounterStart' | 'beforeRoomExit';
  readonly godPool: DecisionGodPoolState;
  readonly traits: DecisionTraitState;
  readonly counters: DecisionCounterState;
  readonly arcanaFear: RewardBranchState['arcanaFear'];
  /** Branch-derived identity chronology; effects are introduced by later gates. */
  readonly keepsakes: RewardBranchState['keepsakes'];
  readonly forfeitStatus: 'inactive' | 'available' | 'consumed';
  readonly bags: readonly DecisionRewardBagState[];
}

export function forfeitStatus(
  state: RewardBranchState['arcanaFear'],
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
  readonly owner: RunStateOwner;
  readonly historyView: HistoryStateView;
  readonly branches: readonly RewardBranchState[];
  readonly enteredBiomeCount: number;
  readonly rewardFacts: (history: RewardHistoryState) => RewardKernelFacts;
  readonly derivationCache?: RunStateDerivationCache;
  /** Exact source/view/shop/peer closure used by rewardFacts. Required with a shared cache. */
  readonly factsContextToken?: object;
}

interface RunStateDerivationCache {
  readonly objectIds: WeakMap<object, number>;
  readonly traitsByHistory: WeakMap<TraitHistoryState, DecisionTraitState>;
  readonly bagsByBranchState: Map<string, readonly DecisionRewardBagState[]>;
  readonly bagCountsByState: WeakMap<RewardBranchState['bags'], string>;
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
      readonly arcanaFear: RewardBranchState['arcanaFear'];
      readonly keepsakes: RewardBranchState['keepsakes'];
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

function rewardBagCountSignature(catalog: Catalog, bags: RewardBranchState['bags']): string {
  return catalog.rewards.stores.values
    .map((store) => (bags[store.key]?.remainingEntryCounts ?? store.entries.map(() => 1)).join(','))
    .join('|');
}

export function aggregateDecisionRewardBag(
  store: RewardStoreDeclaration,
  branches: readonly Pick<RewardBranchState, 'bags'>[],
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
  if (branches.length === 1) {
    const branch = branches[0];
    const facts = factsByBranch[0];
    if (branch === undefined || facts === undefined) {
      throw new Error(`run-state store ${store.key} has no branch facts`);
    }
    const counts = branch.bags[store.key]?.remainingEntryCounts ?? store.entries.map(() => 1);
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
  const storeTotals = new Float64Array(branches.length);
  for (const [branchIndex, branch] of branches.entries()) {
    const facts = factsByBranch[branchIndex];
    if (facts === undefined) {
      throw new Error(`run-state store ${store.key} has no facts for branch ${branchIndex}`);
    }
    const bag = branch.bags[store.key];
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
          totalsByBranch: new Float64Array(branches.length),
          conditions: new Map(),
        };
        groups.set(key, group);
      }
      group.totalsByBranch[branchIndex] = (group.totalsByBranch[branchIndex] ?? 0) + remaining;
      const condition = group.conditions.get(conditionKey);
      if (condition === undefined) {
        const countsByBranch = new Float64Array(branches.length);
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

function traitState(catalog: Catalog, history: TraitHistoryState | undefined): DecisionTraitState {
  if (history === undefined) {
    return Object.freeze({
      equippedTraits: Object.freeze({}),
      equippedSlots: Object.freeze({}),
      elementCounts: Object.freeze({ Aether: 0, Earth: 0, Air: 0, Fire: 0, Water: 0 }),
      godBoonRarityCounts: Object.freeze({}),
      upgradableTraitCount: 0,
      bannedTraitKeys: Object.freeze([]),
      chaos: Object.freeze({ active: Object.freeze([]), matured: Object.freeze([]) }),
    });
  }
  const source = history;
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
            clockLabel:
              entry.clock === 'godBoonScreens'
                ? 'God boon screens'
                : entry.clock === 'locations'
                  ? 'Locations'
                  : 'Encounters',
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

function historyCounters(
  view: HistoryStateView,
  history: RewardHistoryState,
  enteredBiomeCount: number,
): DecisionCounterState {
  const counters = view.ledgers.counters;
  return Object.freeze({
    ...counters,
    runDepthCache: counters.roomHistoryOrdinal + 1,
    enteredBiomes: enteredBiomeCount,
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
  if (context.branches.length === 0) return undefined;
  const derivationCache = context.derivationCache;
  if (derivationCache !== undefined && context.factsContextToken === undefined) {
    throw new Error('run-state shared derivation cache requires an exact facts context token');
  }
  const contextHistoryKeys = context.branches.map((branch) =>
    derivationCache === undefined
      ? undefined
      : `${objectId(derivationCache, context.factsContextToken!)}:${objectId(derivationCache, branch.history)}`,
  );
  const factsByBranch = context.branches.map((branch, branchIndex) => {
    const contextHistoryKey = contextHistoryKeys[branchIndex];
    const cached =
      contextHistoryKey === undefined
        ? undefined
        : derivationCache?.factsByContextHistory.get(contextHistoryKey);
    if (cached !== undefined) return cached;
    const facts = context.rewardFacts(branch.history);
    if (contextHistoryKey !== undefined) {
      derivationCache?.factsByContextHistory.set(contextHistoryKey, facts);
    }
    return facts;
  });
  const branchStates = context.branches.map((branch, index) => {
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
            branch.traitHistory === undefined ? 0 : objectId(cache, branch.traitHistory),
            objectId(cache, branch.arcanaFear),
            objectId(cache, branch.keepsakes),
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
      const cachedTraits =
        branch.traitHistory === undefined
          ? undefined
          : cache?.traitsByHistory.get(branch.traitHistory);
      const traits = cachedTraits ?? traitState(context.catalog, branch.traitHistory);
      if (branch.traitHistory !== undefined && cachedTraits === undefined) {
        cache?.traitsByHistory.set(branch.traitHistory, traits);
      }
      const forfeit = forfeitStatus(branch.arcanaFear);
      derived = Object.freeze({
        godPool,
        traits,
        arcanaFear: branch.arcanaFear,
        keepsakes: branch.keepsakes,
        forfeitStatus: forfeit,
      });
      if (identityKey !== undefined) {
        cache?.branchStateByIdentity.set(identityKey, derived);
      }
    }
    const counters = historyCounters(
      context.historyView,
      branch.history,
      context.enteredBiomeCount,
    );
    return Object.freeze({
      ...derived,
      counters,
    });
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
  const bagEligibilityByBranch = context.branches.map((branch, index) => {
    const contextHistoryKey = contextHistoryKeys[index];
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
  const bagCountsByBranch = context.branches.map((branch) => {
    const cached = derivationCache?.bagCountsByState.get(branch.bags);
    if (cached !== undefined) return cached;
    const signature = rewardBagCountSignature(context.catalog, branch.bags);
    derivationCache?.bagCountsByState.set(branch.bags, signature);
    return signature;
  });
  const bagCacheKey =
    derivationCache === undefined
      ? undefined
      : context.branches
          .map(
            (_branch, index) =>
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
          context.branches,
          factsByBranch,
          bagEligibilityByBranch.map((eligibility) => eligibility.byStore.get(store.key) ?? []),
        ),
      ),
    );
    if (bagCacheKey !== undefined) {
      derivationCache?.bagsByBranchState.set(bagCacheKey, bags);
    }
  }
  return Object.freeze({
    owner: context.owner,
    historySequence: context.historyView.sequence,
    checkpoint:
      context.owner.kind === 'roomRunStateCheckpoint'
        ? context.owner.checkpoint.kind
        : 'beforeTargetGeneration',
    godPool: first.godPool,
    traits: first.traits,
    counters: first.counters,
    arcanaFear: first.arcanaFear,
    keepsakes: first.keepsakes,
    forfeitStatus: first.forfeitStatus,
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
