import {
  createBiomeAddress,
  createRoomActionAddress,
  createRoomFeatureAddress,
  semanticAddressKey,
  type RoomActionAddress,
} from '../../../authored-project/addresses';
import {
  INITIAL_ROLL_KEY,
  STYGIAN_WELL_SLOT_KEYS,
  parseStygianWellGenerationKey,
  purgingPoolRollTraitKey,
  purgingPoolSaleRollKey,
  stygianWellGenerationItemKey,
  stygianWellGenerationKey,
  type RollFeature,
} from '../../../authored-project/feature-rolls';
import type {
  PurgingPoolSlotKey,
  RoomActionReference,
  StygianWellGenerationKey,
} from '../../../authored-project/model';
import { roomActionKey } from '../../../authored-project/room-actions/key';
import { rerollKindEnabled } from '../../arcana-fear';
import {
  featureRollWalkKey,
  initialPurgingPoolRollWalk,
  initialStygianWellRollWalk,
  purgingPoolAfterReroll,
  purgingPoolAfterSale,
  purgingPoolOfferedSlots,
  purgingPoolRerollSlots,
  rollPosition,
  rollRepeatsAllOffers,
  stygianWellAfterPurchase,
  stygianWellAfterReroll,
  stygianWellLiveRefillSlot,
  stygianWellOfferedSlots,
  stygianWellRestockedSlots,
  stygianWellSomethingLeft,
  type FeatureRollWalk,
  type FeatureRerollOption,
} from '../../commerce/feature-rolls';
import {
  agreedPurgingPoolCandidates,
  assessPurgingPoolList,
  isPurgingPoolEligibleTrait,
  type PurgingPoolInteraction,
} from '../../commerce/purging-pool';
import {
  assessStygianWellRoll,
  stygianWellRestockCandidates,
  type StygianWellInteraction,
} from '../../commerce/stygian-well';
import {
  ownerRegion,
  type FindingChronology,
  type FindingRegionEntry,
} from '../../finding-regions';
import type { HistoryEvent } from '../../history';
import type { CanonicalAuthoredRoom } from '../../materialization';
import type { RewardBranchState } from '../branch-primitives';
import { addRewardFinding, rewardFinding } from '../findings';
import { settleFeatureReroll } from '../screen-rerolls';
import { settledFindings, type ChronologyEmission } from './chronology-accumulator';
import {
  withKeyed,
  type ChronologySeamHandler,
  type ChronologyWalkContext,
  type ChronologyWalkState,
} from './chronology-walk';
import { rewardFindingChronologyForRoom } from './finding-chronology';
import { wellOccurrenceView } from './encounter-acquisition/well-purchase';
import { lowestRerollPool } from './lifecycle-transitions/reward-rerolled';

function authoredRoom(
  context: ChronologyWalkContext,
  roomKey: string,
): CanonicalAuthoredRoom | undefined {
  const room = context.rooms.get(roomKey);
  return room?.kind === 'authored' ? room : undefined;
}

/** The room's actions in authored order. */
function rankedReferences(room: CanonicalAuthoredRoom): readonly RoomActionReference[] {
  return room.roomActionRoster.rows
    .filter((row) => !row.stale && row.rank !== null)
    .sort((left, right) => left.rank! - right.rank!)
    .map((row) => row.reference);
}

function actionOwner(
  room: CanonicalAuthoredRoom,
  reference: RoomActionReference,
): RoomActionAddress {
  return createRoomActionAddress(
    createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
    room.occurrenceId,
    roomActionKey(reference),
  );
}

function stygianWellWalk(state: ChronologyWalkState, roomKey: string) {
  const walk = state.featureRolls.get(featureRollWalkKey(roomKey, 'stygianWell'));
  return walk?.feature === 'stygianWell' ? walk : initialStygianWellRollWalk();
}

function purgingPoolWalk(
  state: ChronologyWalkState,
  roomKey: string,
  room: CanonicalAuthoredRoom,
): Extract<FeatureRollWalk, { readonly feature: 'purgingPool' }> | undefined {
  const walk = state.featureRolls.get(featureRollWalkKey(roomKey, 'purgingPool'));
  if (walk?.feature === 'purgingPool') return walk;
  const initial = state.purgingPoolAssessments.get(roomKey)?.assessments ?? [];
  return room.purgingPool === undefined
    ? undefined
    : initialPurgingPoolRollWalk(
        room.purgingPool,
        initial.length === 0
          ? 0
          : Math.min(...initial.map((assessment) => assessment.eligibleTraitKeys.length)),
      );
}

function withWalk(
  state: ChronologyWalkState,
  roomKey: string,
  walk: FeatureRollWalk,
): ChronologyWalkState['featureRolls'] {
  return withKeyed(state.featureRolls, featureRollWalkKey(roomKey, walk.feature), walk);
}

/**
 * One Well or Pool reroll at its rank. The k-th reroll of the same feature in
 * the room costs k; a Well reroll restocks every slot not bought earlier, and
 * a Pool reroll redraws the list from the current traits. Each pinned slot is
 * assessed against the branch state at the reroll.
 */
export const featureRerolled: ChronologySeamHandler<'featureRerolled'> = (
  context,
  state,
  event,
) => {
  const roomKey = semanticAddressKey(event.origin);
  const room = authoredRoom(context, roomKey);
  const timeline: ChronologyEmission = {
    kind: 'timelineFacts',
    facts: { nodes: [{ owner: event.owner, included: true }] },
  };
  // A feature its room never reached has its Overview finding; the reroll does nothing.
  const reached =
    room !== undefined &&
    (event.feature === 'stygianWell'
      ? room.stygianWell !== undefined && state.stygianWellAssessments.has(roomKey)
      : room.purgingPool !== undefined && state.purgingPoolAssessments.has(roomKey));
  if (!reached || state.branches.length === 0) return { state, emissions: [timeline] };
  const chronology = rewardFindingChronologyForRoom(
    context.snapshot,
    room.origin,
    event.sequence,
    'localRoomLifecycle',
  );
  const reference = room.roomActionRoster.rows.find(
    (row) => row.key === roomActionKey(rerollReference(event.feature, event.rerollId)),
  )?.reference;
  const findings = new Map<string, FindingRegionEntry>();
  const region = ownerRegion(event.owner);
  if (event.feature === 'stygianWell') {
    const walk = stygianWellWalk(state, roomKey);
    const settled = settleFeatureReroll(context.catalog, state.branches, {
      cost: walk.rerollCount + 1,
      somethingLeft: stygianWellSomethingLeft(walk),
      owner: event.owner,
      chronology,
    });
    const offered = stygianWellRestockedSlots(walk);
    const pins = reference?.kind === 'rerollStygianWell' ? reference.offerKeyBySlot : {};
    const view = wellOccurrenceView(room);
    const refillSlot = stygianWellLiveRefillSlot(walk);
    const onShow = [
      ...stygianWellOfferedSlots(walk).map(
        (slotKey) =>
          stygianWellGenerationItemKey(view, stygianWellGenerationKey(walk.rollKey, slotKey)) ??
          null,
      ),
      ...(refillSlot === undefined ? [] : [room.stygianWell?.travelDealRefillKey ?? null]),
    ];
    reportRepeatsAllOffers(
      findings,
      event.owner,
      onShow,
      Object.values(pins).filter((itemKey): itemKey is string => itemKey !== undefined),
      region,
      chronology,
    );
    const rolls = settled.branches.map((branch) =>
      assessStygianWellRoll(
        context.catalog,
        room.origin.routeKey,
        event.rerollId,
        pins,
        offered,
        branch.state.stygianWell,
        branch.state.traitHistory,
      ),
    );
    for (const roll of rolls)
      for (const issue of roll.issues)
        addRewardFinding(
          findings,
          rewardFinding(
            issue.kind === 'notOffered'
              ? 'rollOfferUnavailable'
              : issue.kind === 'duplicate'
                ? 'stygianWellDuplicate'
                : 'stygianWellWrongGroup',
            createRoomFeatureAddress(room.origin, {
              kind: 'stygianWellOffer',
              generationKey: stygianWellGenerationKey(event.rerollId, issue.slotKey),
            }),
            issue.kind === 'notOffered'
              ? { reason: 'slotNotOffered' }
              : issue.kind === 'duplicate'
                ? { reason: issue.kind, slotKey: issue.slotKey }
                : { reason: issue.kind },
          ),
          region,
          chronology,
        );
    const existing = state.stygianWellAssessments.get(roomKey)!;
    return {
      state: Object.freeze({
        ...state,
        branches: settled.branches,
        featureRolls: withWalk(state, roomKey, stygianWellAfterReroll(walk, event.rerollId)),
        stygianWellAssessments: new Map(state.stygianWellAssessments).set(
          roomKey,
          Object.freeze({
            origin: existing.origin,
            assessments: Object.freeze([
              ...existing.assessments,
              ...rolls.map((roll) => Object.freeze({ roll })),
            ]),
          }),
        ),
      }),
      emissions: [settledFindings([...settled.findings, ...findings.values()]), timeline],
    };
  }
  const walk = purgingPoolWalk(state, roomKey, room)!;
  const settled = settleFeatureReroll(context.catalog, state.branches, {
    cost: walk.rerollCount + 1,
    somethingLeft: purgingPoolOfferedSlots(walk).length > 0,
    owner: event.owner,
    chronology,
  });
  const pins = reference?.kind === 'rerollPurgingPool' ? reference.traitKeyBySlot : {};
  // The ban applies only when the previous draw left eligible traits unshown.
  if (walk.eligibleCount > walk.offeredSlotKeys.length) {
    const view = { purgingPool: room.purgingPool, roomActions: { order: rankedReferences(room) } };
    reportRepeatsAllOffers(
      findings,
      event.owner,
      purgingPoolOfferedSlots(walk).map(
        (slotKey) => purgingPoolRollTraitKey(view, walk.rollKey, slotKey) ?? null,
      ),
      Object.values(pins).filter((traitKey): traitKey is string => traitKey !== undefined),
      region,
      chronology,
    );
  }
  const assessments = Object.freeze(
    settled.branches.map((branch) =>
      assessPurgingPoolList(context.catalog, pins, branch.state.traitHistory.equippedTraits),
    ),
  );
  for (const assessment of assessments)
    for (const finding of assessment.findings)
      addRewardFinding(
        findings,
        rewardFinding(
          finding.code,
          createRoomFeatureAddress(room.origin, {
            kind: 'purgingPoolOffer',
            slotKey: finding.slotKey,
            rollKey: event.rerollId,
          }),
          { ...finding.evidence, slotKey: finding.slotKey },
        ),
        region,
        chronology,
      );
  const offeredSlotKeys = purgingPoolRerollSlots(
    pins,
    Math.min(...assessments.map((assessment) => assessment.eligibleTraitKeys.length)),
  );
  const existing = state.purgingPoolAssessments.get(roomKey)!;
  return {
    state: Object.freeze({
      ...state,
      branches: settled.branches,
      featureRolls: withWalk(
        state,
        roomKey,
        purgingPoolAfterReroll(
          walk,
          event.rerollId,
          offeredSlotKeys,
          Math.min(...assessments.map((assessment) => assessment.eligibleTraitKeys.length)),
        ),
      ),
      purgingPoolAssessments: new Map(state.purgingPoolAssessments).set(
        roomKey,
        Object.freeze({
          ...existing,
          rolls: Object.freeze({
            ...existing.rolls,
            [event.rerollId]: Object.freeze({ offeredSlotKeys, assessments }),
          }),
        }),
      ),
    }),
    emissions: [settledFindings([...settled.findings, ...findings.values()]), timeline],
  };
};

function reportRepeatsAllOffers(
  findings: Map<string, FindingRegionEntry>,
  owner: RoomActionAddress,
  onShow: readonly (string | null)[],
  pins: readonly string[],
  region: string,
  chronology: FindingChronology,
): void {
  if (rollRepeatsAllOffers(onShow, pins))
    addRewardFinding(
      findings,
      rewardFinding('rollRepeatsAllOffers', owner, {
        itemKeys: onShow.filter((key): key is string => key !== null),
      }),
      region,
      chronology,
    );
}

function rerollReference(feature: RollFeature, rerollId: string): RoomActionReference {
  return feature === 'stygianWell'
    ? { kind: 'rerollStygianWell', rerollId, offerKeyBySlot: {} }
    : { kind: 'rerollPurgingPool', rerollId, traitKeyBySlot: {} };
}

/**
 * Where one Well purchase stands against the roll on show, and the Well's
 * roll state after it. The room's first purchase under Travel Deal restocks
 * its slot; every other bought slot stays blank in later rolls.
 */
export function wellPurchaseRoll(
  context: ChronologyWalkContext,
  state: ChronologyWalkState,
  event: Extract<HistoryEvent, { readonly kind: 'wellPurchase' }>,
): {
  readonly roll: {
    readonly refused?: 'missing' | 'replaced' | 'notReached' | 'slotNotOffered';
    readonly firstPurchase?: {
      readonly slotKey: import('../../../authored-project/model').StygianWellSlotKey;
      readonly rollItemKeys: readonly string[];
    };
  };
  readonly featureRolls: ChronologyWalkState['featureRolls'];
} {
  const roomKey = semanticAddressKey(event.origin);
  const room = authoredRoom(context, roomKey);
  if (room === undefined) return { roll: {}, featureRolls: state.featureRolls };
  const walk = stygianWellWalk(state, roomKey);
  if (event.generationKey === 'travelDealRefill') {
    const live = stygianWellLiveRefillSlot(walk) !== undefined;
    // A refill never created is the refill's own finding.
    return {
      roll: walk.refill !== undefined && !live ? { refused: 'replaced' } : {},
      featureRolls: withWalk(state, roomKey, stygianWellAfterPurchase(walk, { kind: 'refill' })),
    };
  }
  const parsed = parseStygianWellGenerationKey(event.generationKey);
  if (parsed === undefined) return { roll: {}, featureRolls: state.featureRolls };
  const position = rollPosition(
    rankedReferences(room),
    'stygianWell',
    parsed.rollKey,
    walk.rollKey,
  );
  const refused =
    position !== 'current'
      ? position
      : !stygianWellOfferedSlots(walk).includes(parsed.slotKey)
        ? ('slotNotOffered' as const)
        : undefined;
  const first = walk.purchaseCount === 0;
  const restocked =
    first &&
    state.branches.length > 0 &&
    state.branches.every(
      (branch) => branch.state.traitHistory.equippedTraits.RestockBoon !== undefined,
    );
  const view = wellOccurrenceView(room);
  const rollItemKeys = STYGIAN_WELL_SLOT_KEYS.flatMap((slotKey) => {
    const itemKey = stygianWellGenerationItemKey(
      view,
      stygianWellGenerationKey(walk.rollKey, slotKey),
    );
    return itemKey === null || itemKey === undefined || walk.blanked.includes(slotKey)
      ? []
      : [itemKey];
  });
  return {
    roll: {
      ...(refused === undefined ? {} : { refused }),
      ...(first && refused === undefined
        ? { firstPurchase: { slotKey: parsed.slotKey, rollItemKeys } }
        : {}),
    },
    featureRolls: withWalk(
      state,
      roomKey,
      stygianWellAfterPurchase(walk, { kind: 'slot', slotKey: parsed.slotKey, restocked }),
    ),
  };
}

/**
 * One Pool sale at its rank: its list must be the one on show and the slot
 * still offered, and its trait pinned, validly listed and still equipped.
 * Only a sale that passes removes its trait.
 */
export function purgingPoolSale(
  context: ChronologyWalkContext,
  state: ChronologyWalkState,
  event: Extract<HistoryEvent, { readonly kind: 'acquisitionPointReached' }>,
  sale: Extract<RoomActionReference, { readonly kind: 'sellPurgingPoolTrait' }>,
): {
  readonly sold?: { readonly traitKey: string; readonly owner: RoomActionAddress };
  readonly findings: readonly FindingRegionEntry[];
  readonly featureRolls: ChronologyWalkState['featureRolls'];
} {
  const roomKey = semanticAddressKey(event.origin);
  const room = authoredRoom(context, roomKey);
  const assessment = state.purgingPoolAssessments.get(roomKey);
  const none = { findings: Object.freeze([]), featureRolls: state.featureRolls };
  if (room === undefined || assessment === undefined || room.purgingPool === undefined) return none;
  const walk = purgingPoolWalk(state, roomKey, room)!;
  const owner = actionOwner(room, sale);
  const rollKey = purgingPoolSaleRollKey(sale);
  const chronology = rewardFindingChronologyForRoom(
    context.snapshot,
    room.origin,
    event.sequence,
    'localRoomLifecycle',
  );
  const findings = new Map<string, FindingRegionEntry>();
  const featureRolls = withWalk(state, roomKey, purgingPoolAfterSale(walk, sale.slotKey));
  const refuse = (reason: string) => {
    addRewardFinding(
      findings,
      rewardFinding('rollOfferUnavailable', owner, { reason }),
      ownerRegion(owner),
      chronology,
    );
    return { findings: Object.freeze([...findings.values()]), featureRolls };
  };
  const position = rollPosition(rankedReferences(room), 'purgingPool', rollKey, walk.rollKey);
  if (position !== 'current') return refuse(position);
  if (!purgingPoolOfferedSlots(walk).includes(sale.slotKey)) return refuse('slotNotOffered');
  const traitKey = purgingPoolRollTraitKey(
    { purgingPool: room.purgingPool, roomActions: { order: rankedReferences(room) } },
    rollKey,
    sale.slotKey,
  );
  if (traitKey === null || traitKey === undefined) {
    addRewardFinding(
      findings,
      rewardFinding(
        'purgingPoolTraitMissing',
        createRoomFeatureAddress(room.origin, {
          kind: 'purgingPoolOffer',
          slotKey: sale.slotKey,
          ...(rollKey === INITIAL_ROLL_KEY ? {} : { rollKey }),
        }),
        { slotKey: sale.slotKey },
      ),
      ownerRegion(owner),
      chronology,
    );
    return { findings: Object.freeze([...findings.values()]), featureRolls };
  }
  // An incomplete list or invalid pin is its own finding; the sale has no effect.
  const listed =
    (rollKey === INITIAL_ROLL_KEY
      ? assessment.assessments
      : assessment.rolls?.[rollKey]?.assessments
    )?.every((entry) => !entry.findings.some((finding) => finding.slotKey === sale.slotKey)) ??
    false;
  const equipped = state.branches.every((branch) => {
    const trait = branch.state.traitHistory.equippedTraits[traitKey];
    return trait !== undefined && isPurgingPoolEligibleTrait(context.catalog, trait);
  });
  return listed && equipped
    ? { sold: { traitKey, owner }, findings: Object.freeze([]), featureRolls }
    : { findings: Object.freeze([]), featureRolls };
}

/** Closing events of a room: its actions all precede them. */
const SEQUENCE_CLOSED_BY = new Set<HistoryEvent['kind']>([
  'roomCommitted',
  'roomCountersAdvanced',
  'enteredRewardStoreRecorded',
  'roomExited',
  'roomDeparted',
  'roomRestored',
]);

/** Records a Well or Pool room's latest reached point before its actions close. */
export function captureFeatureRollEnd(
  context: ChronologyWalkContext,
  state: ChronologyWalkState,
  event: HistoryEvent,
): ChronologyWalkState {
  if (!('origin' in event) || SEQUENCE_CLOSED_BY.has(event.kind) || state.branches.length === 0)
    return state;
  const roomKey = semanticAddressKey(event.origin);
  const room = authoredRoom(context, roomKey);
  if (room?.stygianWell === undefined && room?.purgingPool === undefined) return state;
  return Object.freeze({
    ...state,
    featureRollEnds: new Map(state.featureRollEnds).set(
      roomKey,
      Object.freeze({ historySequence: event.sequence, branches: state.branches }),
    ),
  });
}

function rerollOption(
  context: ChronologyWalkContext,
  branches: readonly RewardBranchState[],
  rerollCount: number,
  available: boolean,
): FeatureRerollOption {
  return Object.freeze({
    cost: rerollCount + 1,
    enabled: branches.every((branch) =>
      rerollKindEnabled(context.catalog, branch.state.arcanaFear, 'screens'),
    ),
    available,
    poolRemaining: lowestRerollPool(branches),
  });
}

/** What can be done at the end of each reached Well's sequence, by room. */
export function stygianWellInteractions(
  context: ChronologyWalkContext,
  state: ChronologyWalkState,
): ReadonlyMap<string, StygianWellInteraction> {
  const interactions = new Map<string, StygianWellInteraction>();
  for (const [roomKey, end] of state.featureRollEnds) {
    const room = authoredRoom(context, roomKey);
    if (room?.stygianWell === undefined || !state.stygianWellAssessments.has(roomKey)) continue;
    const walk = stygianWellWalk(state, roomKey);
    const view = wellOccurrenceView(room);
    const refillSlot = stygianWellLiveRefillSlot(walk);
    const offers: StygianWellInteraction['offers'][number][] = stygianWellOfferedSlots(walk).map(
      (slotKey) => {
        const generationKey = stygianWellGenerationKey(walk.rollKey, slotKey);
        return Object.freeze({
          generationKey,
          slotKey,
          itemKey: stygianWellGenerationItemKey(view, generationKey) ?? null,
        });
      },
    );
    if (refillSlot !== undefined)
      offers.push(
        Object.freeze({
          generationKey: 'travelDealRefill' as StygianWellGenerationKey,
          slotKey: refillSlot,
          itemKey: room.stygianWell.travelDealRefillKey ?? null,
        }),
      );
    const candidates = end.branches.map((branch) =>
      stygianWellRestockCandidates(
        context.catalog,
        room.origin.routeKey,
        branch.state.stygianWell,
        branch.state.traitHistory,
      ),
    );
    interactions.set(
      roomKey,
      Object.freeze({
        historySequence: end.historySequence,
        rollKey: walk.rollKey,
        offers: Object.freeze(offers),
        reroll: rerollOption(
          context,
          end.branches,
          walk.rerollCount,
          stygianWellSomethingLeft(walk),
        ),
        pendingRoll: Object.freeze({
          offeredSlotKeys: stygianWellRestockedSlots(walk),
          candidateItemKeysBySlot: Object.freeze(
            Object.fromEntries(
              STYGIAN_WELL_SLOT_KEYS.map((slotKey) => {
                const [first, ...rest] = candidates;
                return [
                  slotKey,
                  Object.freeze(
                    (first?.[slotKey] ?? []).filter((key) =>
                      rest.every((record) => record[slotKey].includes(key)),
                    ),
                  ),
                ];
              }),
            ),
          ) as StygianWellInteraction['pendingRoll']['candidateItemKeysBySlot'],
        }),
      }),
    );
  }
  return interactions;
}

/** What can be done at the end of each reached Pool's sequence, by room. */
export function purgingPoolInteractions(
  context: ChronologyWalkContext,
  state: ChronologyWalkState,
): ReadonlyMap<string, PurgingPoolInteraction> {
  const interactions = new Map<string, PurgingPoolInteraction>();
  for (const [roomKey, end] of state.featureRollEnds) {
    const room = authoredRoom(context, roomKey);
    if (room?.purgingPool === undefined || !state.purgingPoolAssessments.has(roomKey)) continue;
    const walk = purgingPoolWalk(state, roomKey, room)!;
    const view = { purgingPool: room.purgingPool, roomActions: { order: rankedReferences(room) } };
    const pending = end.branches.map((branch) =>
      assessPurgingPoolList(context.catalog, {}, branch.state.traitHistory.equippedTraits),
    );
    interactions.set(
      roomKey,
      Object.freeze({
        historySequence: end.historySequence,
        rollKey: walk.rollKey,
        offers: Object.freeze(
          purgingPoolOfferedSlots(walk).map((slotKey: PurgingPoolSlotKey) =>
            Object.freeze({
              slotKey,
              traitKey: purgingPoolRollTraitKey(view, walk.rollKey, slotKey) ?? null,
              sale: Object.freeze({
                kind: 'sellPurgingPoolTrait' as const,
                slotKey,
                ...(walk.rollKey === INITIAL_ROLL_KEY ? {} : { rollKey: walk.rollKey }),
              }),
            }),
          ),
        ),
        reroll: rerollOption(
          context,
          end.branches,
          walk.rerollCount,
          purgingPoolOfferedSlots(walk).length > 0,
        ),
        pendingRoll: Object.freeze({
          offeredSlotKeys: purgingPoolRerollSlots(
            {},
            Math.min(...pending.map((assessment) => assessment.eligibleTraitKeys.length)),
          ),
          candidateTraitKeysBySlot: agreedPurgingPoolCandidates(pending),
        }),
      }),
    );
  }
  return interactions;
}
