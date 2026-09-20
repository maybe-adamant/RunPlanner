import type { Catalog, RoomDeclaration } from '../../catalog-schema';
import {
  semanticAddressKey,
  type StartingRewardAddress,
  type SemanticAddress,
} from '../../authored-project/addresses';
import type { RequirementEvaluationContext } from '../../requirements/evaluator';
import {
  factsWithHistory,
  type RewardHistoryState,
  type RewardKernelFacts,
} from '../../reward-kernel';
import type { HistoryStateView, RoomCreationSource } from '../history';
import { projectOfferedExitCount, projectRecentEncounterEnvelopeSlots } from '../history';
import type { CanonicalLifecycleRoom } from '../history/lifecycleInput';
import type { HermesShrineCandidateContext } from '../commerce/hermes-shrine';
import type { RewardBranchState } from './branch-primitives';
import { BiomeRewardSimulationContractError } from './biome/biome-contract';

/** Visible store names that participate in RequiredNotInStore at room entry. */
export function visibleStoreOptionNames(
  source: CanonicalLifecycleRoom,
  shrineAssessments?: readonly HermesShrineCandidateContext[],
): ReadonlySet<string> {
  const names = new Set<string>();
  if (source.kind !== 'authored') return names;
  for (const offer of source.entryState?.kind === 'shop' ? source.entryState.offers : [])
    names.add(offer.offer.rewardType);
  const shrineInventoryVisible =
    shrineAssessments !== undefined &&
    shrineAssessments.length > 0 &&
    shrineAssessments.every((assessment) => assessment.inventory?.complete === true);
  if (source.hermesShrine !== undefined && shrineInventoryVisible) {
    for (const offer of Object.values(source.hermesShrine.offerBySlot))
      names.add(offer!.rewardType);
  }
  return names;
}

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
  parentOrigin: SemanticAddress,
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
  readonly sourceOrigin: CanonicalLifecycleRoom['origin'] | StartingRewardAddress;
  readonly currentRoom: CanonicalLifecycleRoom | undefined;
  /** Undefined only for the route-start reward, which has no room identity. */
  readonly sourceDeclaration?: RoomDeclaration;
  readonly view: HistoryStateView;
  readonly history: RewardHistoryState;
  readonly enteredBiomeCount: number;
  readonly currentBatchRoomGameNames: readonly string[];
  readonly currentRoomShopOptionNames?: ReadonlySet<string>;
  readonly rewardLookups?: Readonly<Record<string, ReadonlySet<string>>>;
  /** Branch-local delayed Shrine Spell reservation. */
  readonly pendingSpellDrop?: boolean;
  readonly allSpellInvested?: boolean;
  readonly fail: (detail: string) => never;
}

export function createRewardFacts({
  catalog,
  sourceOrigin,
  currentRoom,
  sourceDeclaration,
  view,
  history,
  enteredBiomeCount,
  currentBatchRoomGameNames,
  currentRoomShopOptionNames = new Set(),
  rewardLookups = Object.freeze({}),
  pendingSpellDrop = false,
  allSpellInvested = false,
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
    routeKey: sourceOrigin.routeKey,
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
    currentRoomStructuralTags: sourceDeclaration?.structuralTags ?? Object.freeze([]),
    rewardLookups,
    runDepthCache: view.ledgers.counters.roomHistoryOrdinal + 1,
    lastEventRunDepthCaches: Object.freeze(
      history.lastDevotionDepth === undefined ? {} : { Devotion: history.lastDevotionDepth },
    ),
    recentEncounterEnvelopeSlots: staticFacts.recentEncounterEnvelopeSlots,
    offeredExitCount:
      sourceDeclaration === undefined
        ? 0
        : projectOfferedExitCount(
            view,
            sourceOrigin as CanonicalLifecycleRoom['origin'],
            sourceDeclaration.exits.length,
          ),
    currentBatchRoomGameNames,
    clockwork: hasClockwork
      ? {
          remainingGoals: goalsRemaining!,
          nonGoalRewardsAcquired: nonGoalRewardsAcquired!,
          maxNonGoalRewards: maxNonGoalRewards!,
        }
      : undefined,
    flags: Object.freeze({
      allSpellInvested,
      pendingSpellDrop,
    }),
  });
  return factsWithHistory(Object.freeze({ requirements }), history, currentRoomShopOptionNames);
}

/** Exact reward-evaluation facts for one reached source and history view. */
export function createBiomeRewardFacts(
  catalog: Catalog,
  source: CanonicalLifecycleRoom,
  currentRoom: CanonicalLifecycleRoom | undefined,
  sourceDeclaration: RoomDeclaration,
  view: HistoryStateView,
  history: RewardHistoryState,
  enteredBiomeCount: number,
  currentRoomShopOptionNames: ReadonlySet<string> = new Set(),
  peerParentOrigin = source.origin,
  peerCreationSource: RoomCreationSource = 'generatedTarget',
  rewardLookups: Readonly<Record<string, ReadonlySet<string>>> = Object.freeze({}),
  branch?: RewardBranchState,
): RewardKernelFacts {
  return createRewardFacts({
    catalog,
    sourceOrigin: source.origin,
    currentRoom,
    sourceDeclaration,
    view,
    history,
    enteredBiomeCount,
    currentBatchRoomGameNames: createdPeerGameNames(
      catalog,
      view,
      peerParentOrigin,
      peerCreationSource,
    ),
    currentRoomShopOptionNames,
    rewardLookups,
    pendingSpellDrop: Object.values(branch?.state.pendingHermesShrineDeliveries ?? {}).some(
      (delivery) => delivery.rewardType === 'SpellDrop',
    ),
    allSpellInvested: branch?.state.hexProgress.talentDropsClosed === true,
    fail: (detail) => {
      throw new BiomeRewardSimulationContractError(detail);
    },
  });
}

/**
 * Exact reward facts at route start, before an entry-room identity exists.
 * This is deliberately a no-room context: it carries the real initialized
 * branch history and loadout effects without fabricating a room declaration.
 */
export function createRouteStartRewardFacts(
  catalog: Catalog,
  route: StartingRewardAddress,
  history: RewardHistoryState,
  branch?: RewardBranchState,
): RewardKernelFacts {
  const requirements: RequirementEvaluationContext = Object.freeze({
    routeKey: route.routeKey,
    counters: Object.freeze({
      biomeDepthCache: 0,
      biomeEncounterDepth: 0,
      encounterDepth: 0,
      enteredBiomes: 0,
      upgradableTraitCount: history.traitFacts.upgradableTraitCount,
    }),
    records: Object.freeze({
      biomeUseRecord: history.biomeUseRecord,
      lootTypeHistory: history.lootTypeHistory,
      roomsEntered: Object.freeze({}),
      useRecord: history.useRecord,
    }),
    currentRoomShopOptionNames: new Set<string>(),
    currentRoomRewardType: undefined,
    currentRoomStructuralTags: Object.freeze([]),
    rewardLookups: Object.freeze({}),
    runDepthCache: 1,
    lastEventRunDepthCaches: Object.freeze(
      history.lastDevotionDepth === undefined ? {} : { Devotion: history.lastDevotionDepth },
    ),
    recentEncounterEnvelopeSlots: Object.freeze([]),
    offeredExitCount: 0,
    currentBatchRoomGameNames: Object.freeze([]),
    clockwork: undefined,
    flags: Object.freeze({
      allSpellInvested: branch?.state.hexProgress.talentDropsClosed === true,
      pendingSpellDrop: Object.values(branch?.state.pendingHermesShrineDeliveries ?? {}).some(
        (delivery) => delivery.rewardType === 'SpellDrop',
      ),
    }),
  });
  return factsWithHistory(Object.freeze({ requirements }), history, new Set<string>());
}
