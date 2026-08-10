import type { Catalog, RoomDeclaration } from '../../catalog-schema';
import { semanticAddressKey } from '../../authored-project/addresses';
import type { RequirementEvaluationContext } from '../../requirements/evaluator';
import {
  factsWithHistory,
  type RewardHistoryState,
  type RewardKernelFacts,
} from '../../reward-kernel';
import type { HistoryStateView, RoomCreationSource } from '../history';
import { projectRecentEncounterEnvelopeSlots } from '../history';
import type { CanonicalLifecycleRoom } from '../history/lifecycleInput';

function countByGameName(
  entries: readonly { readonly gameName: string }[],
): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    counts[entry.gameName] = (counts[entry.gameName] ?? 0) + 1;
  }
  return Object.freeze(counts);
}

interface StaticRewardViewFacts {
  readonly peerGameNamesBySourceParent: Map<RoomCreationSource, Map<string, readonly string[]>>;
  readonly recentEncounterEnvelopeSlots: ReturnType<typeof projectRecentEncounterEnvelopeSlots>;
  readonly roomsEntered: Readonly<Record<string, number>>;
}

const staticRewardFactsByCatalog = new WeakMap<
  Catalog,
  WeakMap<HistoryStateView, StaticRewardViewFacts>
>();

function staticRewardViewFacts(catalog: Catalog, view: HistoryStateView): StaticRewardViewFacts {
  let byView = staticRewardFactsByCatalog.get(catalog);
  if (byView === undefined) {
    byView = new WeakMap();
    staticRewardFactsByCatalog.set(catalog, byView);
  }
  const existing = byView.get(view);
  if (existing !== undefined) {
    return existing;
  }
  const facts = Object.freeze({
    peerGameNamesBySourceParent: new Map<RoomCreationSource, Map<string, readonly string[]>>(),
    recentEncounterEnvelopeSlots: projectRecentEncounterEnvelopeSlots(view),
    roomsEntered: countByGameName(view.ledgers.roomAppearances),
  });
  byView.set(view, facts);
  return facts;
}

export function createdPeerGameNames(
  catalog: Catalog,
  view: HistoryStateView,
  parentOrigin: CanonicalLifecycleRoom['origin'],
  source: RoomCreationSource,
): readonly string[] {
  const facts = staticRewardViewFacts(catalog, view);
  const parentKey = semanticAddressKey(parentOrigin);
  let byParent = facts.peerGameNamesBySourceParent.get(source);
  if (byParent === undefined) {
    byParent = new Map();
    facts.peerGameNamesBySourceParent.set(source, byParent);
  }
  const existing = byParent.get(parentKey);
  if (existing !== undefined) {
    return existing;
  }
  const names = Object.freeze(
    view.ledgers.roomCreations
      .filter(
        (creation) =>
          creation.source === source &&
          'parentOrigin' in creation &&
          semanticAddressKey(creation.parentOrigin) === parentKey,
      )
      .map((creation) => creation.gameName),
  );
  byParent.set(parentKey, names);
  return names;
}

interface RewardFactsOptions {
  readonly catalog: Catalog;
  readonly currentRoom: CanonicalLifecycleRoom | undefined;
  readonly sourceDeclaration: RoomDeclaration;
  readonly view: HistoryStateView;
  readonly history: RewardHistoryState;
  readonly enteredBiomeCount: number;
  readonly currentBatchRoomGameNames: readonly string[];
  readonly currentRoomShopOptionNames?: ReadonlySet<string>;
  readonly rewardLookups?: Readonly<Record<string, ReadonlySet<string>>>;
  readonly fail: (detail: string) => never;
}

export function createRewardFacts({
  catalog,
  currentRoom,
  sourceDeclaration,
  view,
  history,
  enteredBiomeCount,
  currentBatchRoomGameNames,
  currentRoomShopOptionNames = new Set(),
  rewardLookups = Object.freeze({}),
  fail,
}: RewardFactsOptions): RewardKernelFacts {
  const staticFacts = staticRewardViewFacts(catalog, view);
  const goalsRemaining = view.ledgers.counters.clockworkGoalsRemaining;
  const nonGoalRewardsAcquired = view.ledgers.counters.clockworkNonGoalRewardsAcquired;
  const maxNonGoalRewards = view.ledgers.counters.clockworkMaxNonGoalRewards;
  const clockworkValues = [goalsRemaining, nonGoalRewardsAcquired, maxNonGoalRewards];
  const hasClockwork = clockworkValues.every((value) => value !== undefined);
  if (!hasClockwork && clockworkValues.some((value) => value !== undefined)) {
    return fail('history has partial Clockwork facts');
  }
  const requirements: RequirementEvaluationContext = Object.freeze({
    counters: Object.freeze({
      biomeDepthCache: view.ledgers.counters.biomeDepthCache,
      biomeEncounterDepth: view.ledgers.counters.biomeEncounterDepth,
      encounterDepth: view.ledgers.counters.routeEncounterDepth,
      enteredBiomes: enteredBiomeCount,
      // The trait ledger owns this derived count.  Reward history remains the
      // consumer of that immutable fold and never re-counts loot sources.
      upgradableTraitCount: history.traitFacts.upgradableTraitCount,
    }),
    records: Object.freeze({
      biomeUseRecord: history.biomeUseRecord,
      lootTypeHistory: history.lootTypeHistory,
      roomsEntered: staticFacts.roomsEntered,
      useRecord: history.useRecord,
    }),
    currentRoomShopOptionNames,
    currentRoomRewardType:
      currentRoom !== undefined && 'incomingReward' in currentRoom
        ? currentRoom.incomingReward?.offer.rewardType
        : undefined,
    currentRoomStructuralTags: sourceDeclaration.structuralTags,
    rewardLookups,
    runDepthCache: view.ledgers.counters.roomHistoryOrdinal + 1,
    lastEventRunDepthCaches: Object.freeze(
      history.lastDevotionDepth === undefined ? {} : { Devotion: history.lastDevotionDepth },
    ),
    recentEncounterEnvelopeSlots: staticFacts.recentEncounterEnvelopeSlots,
    offeredExitCount: sourceDeclaration.exits.length,
    currentBatchRoomGameNames,
    clockwork: hasClockwork
      ? {
          remainingGoals: goalsRemaining!,
          nonGoalRewardsAcquired: nonGoalRewardsAcquired!,
          maxNonGoalRewards: maxNonGoalRewards!,
        }
      : undefined,
    flags: Object.freeze({ allSpellInvested: false, pendingSpellDrop: false }),
    authoredConditions:
      currentRoom?.kind === 'authored' &&
      currentRoom.entryState?.kind === 'shop' &&
      currentRoom.entryState.deathDefianceConditionMet !== undefined
        ? Object.freeze({
            deathDefianceConditionMet: currentRoom.entryState.deathDefianceConditionMet,
          })
        : Object.freeze({}),
  });
  return factsWithHistory(Object.freeze({ requirements }), history, currentRoomShopOptionNames);
}
