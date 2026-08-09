import {
  semanticAddressKey,
  type ExitDecisionAddress,
  type HubDecisionAddress,
} from '../../authored-project/addresses';
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
import type { TraitHistoryState } from '../traits';
import type { RewardBranchState } from './processing';

export type DecisionRunStateOwner = ExitDecisionAddress | HubDecisionAddress;

export interface DecisionGodPoolState {
  readonly acquiredSourceKeys: readonly string[];
  readonly effectiveSourceKeys: readonly string[];
  readonly capNarrowed: boolean;
}

export interface DecisionTraitState {
  readonly equippedTraits: TraitHistoryState['equippedTraits'];
  readonly ordinaryBoonSlots: TraitHistoryState['ordinaryBoonSlots'];
  readonly elementCounts: Readonly<Record<TraitElement, number>>;
  readonly godBoonRarityCounts: TraitHistoryState['godBoonRarityCounts'];
  readonly upgradableTraitCount: number;
  readonly minimumScalableGodTraitRarity?: TraitHistoryState['minimumScalableGodTraitRarity'];
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

export interface DecisionRunStateSnapshot {
  readonly owner: DecisionRunStateOwner;
  readonly historySequence: number;
  readonly checkpoint: 'beforeTargetGeneration';
  readonly godPool: DecisionGodPoolState;
  readonly traits: DecisionTraitState;
  readonly counters: DecisionCounterState;
  readonly bags: readonly DecisionRewardBagState[];
}

export interface DecisionRunStateAvailability {
  readonly owner: DecisionRunStateOwner;
  readonly availability: 'available' | 'unavailable';
  readonly reason?: 'coverageNotReached';
}

export interface DecisionRunStatePublication {
  readonly snapshots: readonly DecisionRunStateSnapshot[];
  readonly availability: readonly DecisionRunStateAvailability[];
}

interface RunStateContext {
  readonly catalog: Catalog;
  readonly owner: DecisionRunStateOwner;
  readonly historyView: HistoryStateView;
  readonly branches: readonly RewardBranchState[];
  readonly enteredBiomeCount: number;
  readonly rewardFacts: (history: RewardHistoryState) => RewardKernelFacts;
}

export function aggregateDecisionRewardBag(
  store: RewardStoreDeclaration,
  branches: readonly Pick<RewardBranchState, 'bags'>[],
  factsByBranch: readonly RewardKernelFacts[],
): DecisionRewardBagState {
  type BranchCondition = { readonly requirement?: RequirementExpression; count: number };
  type BranchGroup = {
    readonly rewardType: string;
    readonly eligibility: 'eligible' | 'ineligible';
    total: number;
    readonly conditions: Map<string, BranchCondition>;
  };
  const branchGroups: Map<string, BranchGroup>[] = [];
  const storeTotals: number[] = [];
  for (const [branchIndex, branch] of branches.entries()) {
    const facts = factsByBranch[branchIndex];
    if (facts === undefined) continue;
    const bag = branch.bags[store.key];
    const counts = bag?.remainingEntryCounts ?? store.entries.map(() => 1);
    const effectiveGroups = new Map<string, BranchGroup>();
    let storeTotal = 0;
    for (const [entryIndex, entry] of store.entries.entries()) {
      const requirement = entry.requirement;
      const eligibility =
        requirement === undefined || evaluateRequirement(requirement, facts.requirements)
          ? 'eligible'
          : 'ineligible';
      const key = JSON.stringify([entry.rewardType, eligibility]);
      const conditionKey = JSON.stringify(requirement);
      const remaining = counts[entryIndex] ?? 0;
      storeTotal += remaining;
      let branchGroup = effectiveGroups.get(key);
      if (branchGroup === undefined) {
        branchGroup = {
          rewardType: entry.rewardType,
          eligibility,
          total: 0,
          conditions: new Map(),
        };
        effectiveGroups.set(key, branchGroup);
      }
      branchGroup.total += remaining;
      const condition = branchGroup.conditions.get(conditionKey);
      if (condition === undefined) {
        branchGroup.conditions.set(conditionKey, {
          ...(requirement === undefined ? {} : { requirement }),
          count: remaining,
        });
      } else {
        condition.count += remaining;
      }
    }
    branchGroups.push(effectiveGroups);
    storeTotals.push(storeTotal);
  }
  const groups = new Map<
    string,
    {
      readonly rewardType: string;
      readonly eligibility: 'eligible' | 'ineligible';
      readonly totalsByBranch: number[];
      readonly conditions: Map<
        string,
        { readonly requirement?: RequirementExpression; countsByBranch: number[] }
      >;
    }
  >();
  for (const effectiveGroups of branchGroups) {
    for (const [key, branchGroup] of effectiveGroups) {
      if (!groups.has(key)) {
        groups.set(key, {
          rewardType: branchGroup.rewardType,
          eligibility: branchGroup.eligibility,
          totalsByBranch: Array(branchGroups.length).fill(0),
          conditions: new Map(),
        });
      }
      for (const [conditionKey, condition] of branchGroup.conditions) {
        const group = groups.get(key)!;
        if (!group.conditions.has(conditionKey)) {
          group.conditions.set(conditionKey, {
            ...(condition.requirement === undefined ? {} : { requirement: condition.requirement }),
            countsByBranch: Array(branchGroups.length).fill(0),
          });
        }
      }
    }
  }
  for (const [branchIndex, effectiveGroups] of branchGroups.entries()) {
    for (const [key, branchGroup] of effectiveGroups) {
      const group = groups.get(key)!;
      group.totalsByBranch[branchIndex] = branchGroup.total;
      for (const [conditionKey, condition] of branchGroup.conditions) {
        group.conditions.get(conditionKey)!.countsByBranch[branchIndex] = condition.count;
      }
    }
  }

  const count = (counts: readonly number[]): DecisionRewardBagCount => {
    const min = Math.min(...counts);
    const max = Math.max(...counts);
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

function traitState(history: TraitHistoryState | undefined): DecisionTraitState {
  if (history === undefined) {
    return Object.freeze({
      equippedTraits: Object.freeze({}),
      ordinaryBoonSlots: Object.freeze({}),
      elementCounts: Object.freeze({ Aether: 0, Earth: 0, Air: 0, Fire: 0, Water: 0 }),
      godBoonRarityCounts: Object.freeze({}),
      upgradableTraitCount: 0,
    });
  }
  const source = history;
  return Object.freeze({
    equippedTraits: Object.freeze({ ...source.equippedTraits }),
    ordinaryBoonSlots: Object.freeze({ ...source.ordinaryBoonSlots }),
    elementCounts: Object.freeze({ ...source.elementCounts }),
    godBoonRarityCounts: Object.freeze({ ...source.godBoonRarityCounts }),
    upgradableTraitCount: source.upgradableTraitCount,
    ...(source.minimumScalableGodTraitRarity === undefined
      ? {}
      : { minimumScalableGodTraitRarity: source.minimumScalableGodTraitRarity }),
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

export function createRunState(context: RunStateContext): DecisionRunStateSnapshot | undefined {
  if (context.branches.length === 0) return undefined;
  const factsByBranch = context.branches.map((branch) => context.rewardFacts(branch.history));
  const branchStates = context.branches.map((branch, index) => {
    const facts = factsByBranch[index];
    if (facts === undefined) {
      throw new Error('run-state branch has no reward facts');
    }
    return Object.freeze({
      godPool: sourcePool(context.catalog, facts),
      traits: traitState(branch.traitHistory),
      counters: historyCounters(context.historyView, branch.history, context.enteredBiomeCount),
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
  return Object.freeze({
    owner: context.owner,
    historySequence: context.historyView.sequence,
    checkpoint: 'beforeTargetGeneration',
    godPool: first.godPool,
    traits: first.traits,
    counters: first.counters,
    bags: Object.freeze(
      context.catalog.rewards.stores.values.map((store) =>
        aggregateDecisionRewardBag(store, context.branches, factsByBranch),
      ),
    ),
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
  discovered: readonly DecisionRunStateSnapshot[],
  covered: readonly DecisionRunStateSnapshot[],
  owners: readonly DecisionRunStateOwner[] = discovered.map((snapshot) => snapshot.owner),
): DecisionRunStatePublication {
  const coveredByOwner = new Map(
    covered.map((snapshot) => [semanticAddressKey(snapshot.owner), snapshot]),
  );
  const knownOwners = new Set<string>();
  const availability: DecisionRunStateAvailability[] = [];
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
