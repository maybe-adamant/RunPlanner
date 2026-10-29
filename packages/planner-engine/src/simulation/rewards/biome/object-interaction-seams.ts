import {
  createBiomeAddress,
  createInfernalContractPedestalAddress,
  createShopOfferAddress,
  semanticAddressKey,
} from '../../../authored-project/addresses';
import { hermesShrinePurchaseAction } from '../../../authored-project/hermes-shrine-delivery';
import {
  hermesShrineInitialGenerationKey,
  type HermesShrineGenerationKey,
  type HermesShrineInventoryOffer,
  type HermesShrineSlotKey,
} from '../../../authored-project/model';
import { TRAVEL_DEAL_REFILL_ENTRY_KEY } from '../../../authored-project/shop';
import type {
  ChampionItemInteraction,
  HermesShrineInteraction,
  HermesShrineInteractionOffer,
  RoomObjectInteractions,
  WorldShopInteraction,
} from '../../commerce/object-interactions';
import type { HermesShrineTravelDealRefillAssessment } from '../../commerce/hermes-shrine';
import type { HistoryEvent } from '../../history';
import type { CanonicalAuthoredRoom } from '../../materialization';
import type { RewardBranchState } from '../branch-primitives';
import { attestDerivedAcquisitionEntryCandidateCapability } from '../acquisition/artifacts';
import type { DerivedAcquisitionEntryFrontier } from '../acquisition/contracts';
import type { ChronologyWalkContext, ChronologyWalkState } from './chronology-walk';
import { infernalContractHeld } from './offer-lifecycle/infernal-contract-pedestal';

const SHRINE_SLOT_KEYS: readonly HermesShrineSlotKey[] = ['first', 'secondLeft', 'secondRight'];

/** Closing events of a room: its actions all precede them. */
const SEQUENCE_CLOSED_BY = new Set<HistoryEvent['kind']>([
  'roomCommitted',
  'roomCountersAdvanced',
  'enteredRewardStoreRecorded',
  'roomExited',
  'roomDeparted',
  'roomRestored',
]);

function authoredRoom(
  context: ChronologyWalkContext,
  roomKey: string,
): CanonicalAuthoredRoom | undefined {
  const room = context.rooms.get(roomKey);
  return room?.kind === 'authored' ? room : undefined;
}

/** A Well, Pool, World Shop, Shrine or Contract pedestal is interacted with through room actions. */
function hasInteractiveObject(room: CanonicalAuthoredRoom): boolean {
  return (
    room.stygianWell !== undefined ||
    room.purgingPool !== undefined ||
    room.hermesShrine !== undefined ||
    room.entryState?.kind === 'shop' ||
    room.infernalContractPedestal !== undefined
  );
}

/** Records an interactive object room's latest reached point before its actions close. */
export function captureRoomActionEnd(
  context: ChronologyWalkContext,
  state: ChronologyWalkState,
  event: HistoryEvent,
): ChronologyWalkState {
  if (!('origin' in event) || SEQUENCE_CLOSED_BY.has(event.kind) || state.branches.length === 0)
    return state;
  const roomKey = semanticAddressKey(event.origin);
  const room = authoredRoom(context, roomKey);
  if (room === undefined || !hasInteractiveObject(room)) return state;
  return Object.freeze({
    ...state,
    roomActionEnds: new Map(state.roomActionEnds).set(
      roomKey,
      Object.freeze({ historySequence: event.sequence, branches: state.branches }),
    ),
  });
}

/** The values every list holds, in the first list's order. */
function agreed(lists: readonly (readonly string[])[]): readonly string[] {
  const [first, ...rest] = lists;
  return Object.freeze((first ?? []).filter((value) => rest.every((list) => list.includes(value))));
}

type DerivedEntryFrontiers = ReadonlyMap<string, readonly DerivedAcquisitionEntryFrontier[]>;

function worldShopInteraction(
  room: CanonicalAuthoredRoom,
  historySequence: number,
  derivedEntries: DerivedEntryFrontiers,
): WorldShopInteraction | undefined {
  const shop = room.entryState;
  if (shop?.kind !== 'shop') return undefined;
  const order = room.roomActions.order;
  const bought = new Set(
    order.flatMap((reference) =>
      reference.kind === 'interactShopOffer' ? [reference.offerKey] : [],
    ),
  );
  const refillBought = order.some(
    (reference) =>
      reference.kind === 'interactAcquisitionEntry' &&
      reference.siteKey === 'roomExit' &&
      reference.entryKey === TRAVEL_DEAL_REFILL_ENTRY_KEY,
  );
  // The first normal paid purchase made with Travel Deal seeds the refill on every branch.
  const seeded = attestDerivedAcquisitionEntryCandidateCapability(
    derivedEntries.get(
      semanticAddressKey(
        createShopOfferAddress(
          createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
          room.occurrenceId,
          TRAVEL_DEAL_REFILL_ENTRY_KEY,
        ),
      ),
    ) ?? [],
  );
  const live = seeded?.kind === 'travelDealRefill';
  const refill = shop.travelDealRefill ?? null;
  return Object.freeze({
    historySequence,
    offers: Object.freeze(
      shop.offers
        .filter((offer) => !bought.has(offer.offerKey))
        .map((offer) =>
          Object.freeze({
            offerKey: offer.offerKey,
            command: Object.freeze({
              kind: 'ReplaceShopPurchaseParticipation' as const,
              offer: offer.offerOrigin,
              purchased: true,
            }),
          }),
        ),
    ),
    ...(!live || refillBought
      ? {}
      : {
          travelDealRefill: Object.freeze({
            rewardType: refill?.offer.rewardType ?? null,
            optionKey: refill?.optionKey ?? null,
            rewardTypes: seeded?.rewardTypes ?? Object.freeze([]),
            command: Object.freeze({
              kind: 'PurchaseShopTravelDealRefill' as const,
              occurrence: room.origin,
            }),
          }),
        }),
  });
}

function shrineOffer(
  room: CanonicalAuthoredRoom,
  generationKey: HermesShrineGenerationKey,
  offer: HermesShrineInventoryOffer | null | undefined,
): HermesShrineInteractionOffer {
  const command = (rushed: boolean) =>
    Object.freeze({
      kind: 'PurchaseHermesShrineOffer' as const,
      occurrence: room.origin,
      generationKey,
      rushed,
    });
  return Object.freeze({
    generationKey,
    rewardType: offer?.rewardType ?? null,
    delay: offer?.delay ?? null,
    buy: command(false),
    rush: command(true),
  });
}

function hermesShrineInteraction(
  room: CanonicalAuthoredRoom,
  historySequence: number,
  realized: readonly HermesShrineTravelDealRefillAssessment[] | undefined,
): HermesShrineInteraction | undefined {
  const shrine = room.hermesShrine;
  if (shrine === undefined) return undefined;
  const order = room.roomActions.order;
  const unbought = (generationKey: HermesShrineGenerationKey) =>
    hermesShrinePurchaseAction(order, generationKey) === undefined;
  const offers = SHRINE_SLOT_KEYS.flatMap((slotKey) => {
    const generationKey = hermesShrineInitialGenerationKey(slotKey);
    const offer = shrine.offerBySlot[slotKey];
    return offer === null || !unbought(generationKey)
      ? []
      : [shrineOffer(room, generationKey, offer)];
  });
  // The first rush made with Travel Deal on every branch realizes the refill.
  const live = realized !== undefined;
  return Object.freeze({
    historySequence,
    offers: Object.freeze(offers),
    travelDealRefillLive: live,
    ...(!live || !unbought('travelDealRefill')
      ? {}
      : {
          travelDealRefill: Object.freeze({
            ...shrineOffer(room, 'travelDealRefill', shrine.travelDealRefill?.offer),
            candidateRewardTypes: agreed(
              realized.map((assessment) => assessment.candidateRewardTypes),
            ),
          }),
        }),
  });
}

function championItemInteraction(
  room: CanonicalAuthoredRoom,
  historySequence: number,
  branches: readonly RewardBranchState[],
): ChampionItemInteraction | undefined {
  const pedestal = room.infernalContractPedestal;
  if (pedestal === undefined) return undefined;
  if (
    room.roomActions.order.some(
      (reference) => reference.kind === 'interactInfernalContractPedestal',
    )
  )
    return Object.freeze({ historySequence });
  const address = createInfernalContractPedestalAddress(
    createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
    room.origin.occurrenceId,
  );
  const ownerKey = semanticAddressKey(address);
  // The item spawns with the room on each branch holding Champion of Elysium.
  const spawned = branches.every((branch) =>
    branch.events.some(
      (event) => event.kind === 'rewardOffered' && semanticAddressKey(event.origin) === ownerKey,
    ),
  );
  const held = branches.every((branch) => infernalContractHeld(branch.state));
  return Object.freeze({
    historySequence,
    collect: Object.freeze(
      pedestal === null
        ? { locked: held ? ('itemUnchosen' as const) : ('inactive' as const) }
        : spawned
          ? {
              command: Object.freeze({
                kind: 'SetInfernalContractPedestalCollected' as const,
                pedestal: address,
                collected: true,
              }),
            }
          : { locked: 'inactive' as const },
    ),
  });
}

/** What can be done with each reached room's World Shop, Shrine and Contract pedestal, by room. */
export function roomObjectInteractions(
  context: ChronologyWalkContext,
  state: ChronologyWalkState,
  derivedEntries: DerivedEntryFrontiers,
): ReadonlyMap<string, RoomObjectInteractions> {
  const interactions = new Map<string, RoomObjectInteractions>();
  for (const [roomKey, end] of state.roomActionEnds) {
    const room = authoredRoom(context, roomKey);
    if (room === undefined) continue;
    const worldShop = worldShopInteraction(room, end.historySequence, derivedEntries);
    const hermesShrine = hermesShrineInteraction(
      room,
      end.historySequence,
      state.hermesShrineTravelDealRefills.get(roomKey),
    );
    const championItem = championItemInteraction(room, end.historySequence, end.branches);
    if (worldShop === undefined && hermesShrine === undefined && championItem === undefined)
      continue;
    interactions.set(
      roomKey,
      Object.freeze({
        ...(worldShop === undefined ? {} : { worldShop }),
        ...(hermesShrine === undefined ? {} : { hermesShrine }),
        ...(championItem === undefined ? {} : { championItem }),
      }),
    );
  }
  return interactions;
}
