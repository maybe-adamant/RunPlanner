import {
  createBiomeAddress,
  createInfernalContractPedestalAddress,
  createRoomActionAddress,
  createShopOfferAddress,
  semanticAddressKey,
} from '../../../authored-project/addresses';
import {
  extraExitLockHost,
  lockableExitKeys,
  unlockExitAction,
} from '../../../authored-project/locked-exits';
import { roomActionKey } from '../../../authored-project/room-actions/key';
import type { PreparedUnlockExitEncounter } from '../../encounters/unlock-exit';
import { hermesShrinePurchaseAction } from '../../../authored-project/hermes-shrine-delivery';
import {
  hermesShrineInitialGenerationKey,
  type HermesShrineGenerationKey,
  type HermesShrineInventoryOffer,
  type HermesShrineSlotKey,
} from '../../../authored-project/model';
import {
  shopOfferOptionValues,
  TRAVEL_DEAL_REFILL_ENTRY_KEY,
} from '../../../authored-project/shop';
import type { Catalog } from '../../../catalog-schema';
import type { ShopOptionSelection } from '../../../reward-kernel';
import {
  eliteChallengeAttributeOptions,
  type ChallengeSwitchEntryAssessment,
} from '../../commerce/challenge-switch';
import type {
  ChallengeSwitchInteraction,
  ChallengeSwitchOutcomeInteraction,
  ChampionItemInteraction,
  HermesShrineInteraction,
  HermesShrineInteractionOffer,
  LockedDoorsInteraction,
  RoomObjectInteractions,
  WorldShopInteraction,
} from '../../commerce/object-interactions';
import type { RealizedHermesShrineTravelDealRefill } from '../../commerce/hermes-shrine';
import type { HistoryEvent } from '../../history';
import type { CanonicalAuthoredRoom } from '../../materialization';
import type { PreparedChallengeSwitchEncounter } from '../../encounters/challenge-switch';
import {
  challengeSwitchOutcomeDropsNectar,
  challengeSwitchOutcomes,
  resolveChallengeSwitch,
} from '../../../authored-project/acquisition/challenge-switch';
import type { RewardBranchState } from '../branch-primitives';
import { attestDerivedAcquisitionEntryCandidateCapability } from '../acquisition/artifacts';
import type { DerivedAcquisitionEntryFrontier } from '../acquisition/contracts';
import type { ChronologyWalkContext, ChronologyWalkState } from './chronology-walk';

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

/**
 * A Well, Pool, World Shop, Shrine, Contract pedestal or locked door is
 * interacted with through room actions.
 */
function hasInteractiveObject(catalog: Catalog, room: CanonicalAuthoredRoom): boolean {
  return (
    extraExitLockHost(catalog, room.gameName) !== undefined ||
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
  if (!('origin' in event) || SEQUENCE_CLOSED_BY.has(event.kind) || state.branch === undefined)
    return state;
  const roomKey = semanticAddressKey(event.origin);
  const room = authoredRoom(context, roomKey);
  if (room === undefined || !hasInteractiveObject(context.catalog, room)) return state;
  return Object.freeze({
    ...state,
    roomActionEnds: new Map(state.roomActionEnds).set(
      roomKey,
      Object.freeze({ historySequence: event.sequence, branch: state.branch }),
    ),
  });
}

type DerivedEntryFrontiers = ReadonlyMap<string, DerivedAcquisitionEntryFrontier>;

/** The refilled slot's items the reached state can stock without a finding. */
function travelDealRefillValues(
  catalog: Catalog,
  profileKey: string,
  slotIndex: number | undefined,
  frontier: DerivedAcquisitionEntryFrontier,
): readonly ShopOptionSelection[] {
  const slot =
    slotIndex === undefined
      ? undefined
      : catalog.rewards.shops.byKey[profileKey]?.slots.values[slotIndex];
  if (slot === undefined) return Object.freeze([]);
  return Object.freeze(
    shopOfferOptionValues(catalog, profileKey, slot.key).filter((value) => {
      const result = frontier.evaluateShopOption?.(value);
      return result?.supported === true && result.findings.length === 0;
    }),
  );
}

function worldShopInteraction(
  catalog: Catalog,
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
  // The first normal paid purchase made with Travel Deal seeds the refill.
  const refillFrontier = derivedEntries.get(
    semanticAddressKey(
      createShopOfferAddress(
        createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
        room.occurrenceId,
        TRAVEL_DEAL_REFILL_ENTRY_KEY,
      ),
    ),
  );
  const seeded = attestDerivedAcquisitionEntryCandidateCapability(refillFrontier);
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
            values: travelDealRefillValues(
              catalog,
              shop.profileKey,
              seeded?.slotIndex,
              refillFrontier!,
            ),
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
  realized: RealizedHermesShrineTravelDealRefill | undefined,
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
  // The first rush made with Travel Deal realizes the refill.
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
            candidateRewardTypes: realized.assessment?.candidateRewardTypes ?? Object.freeze([]),
          }),
        }),
  });
}

function championItemInteraction(
  room: CanonicalAuthoredRoom,
  historySequence: number,
  branch: RewardBranchState,
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
  // The item spawns with the room when the state holds Champion of Elysium.
  const spawned = branch.events.some(
    (event) => event.kind === 'rewardOffered' && semanticAddressKey(event.origin) === ownerKey,
  );
  // An unchosen item of a spawned pedestal blocks its room's Overview, so it never reaches here.
  return Object.freeze({
    historySequence,
    collect: Object.freeze(
      pedestal !== null && spawned
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

function challengeSwitchOutcomeInteraction(
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
): ChallengeSwitchOutcomeInteraction | undefined {
  const observed = room.challengeSwitch;
  const resolved =
    observed === undefined ? undefined : resolveChallengeSwitch(catalog, observed.variantKey);
  if (observed === undefined || resolved === undefined || room.origin.kind !== 'occurrence')
    return undefined;
  const occurrence = room.origin;
  const command = (outcome: ChallengeSwitchOutcomeInteraction['current'], nectarDropped: boolean) =>
    Object.freeze({
      kind: 'ReplaceChallengeSwitchOutcome' as const,
      occurrence,
      outcome,
      nectarDropped,
      ...(outcome === observed.outcome && observed.gold !== undefined
        ? { gold: observed.gold }
        : {}),
    });
  const nectarAllowed = challengeSwitchOutcomeDropsNectar(observed.outcome);
  const gold = catalog.challengeSwitches.gold;
  return Object.freeze({
    current: observed.outcome,
    choices: Object.freeze(
      challengeSwitchOutcomes(resolved.kind).map((outcome) =>
        Object.freeze({
          outcome,
          command: command(
            outcome,
            observed.nectarDropped && challengeSwitchOutcomeDropsNectar(outcome),
          ),
        }),
      ),
    ),
    nectarAllowed,
    goldApplies: observed.gold !== undefined,
    ...(nectarAllowed ? { nectarCommand: command(observed.outcome, !observed.nectarDropped) } : {}),
    ...(observed.gold === undefined
      ? {}
      : {
          gold: Object.freeze({
            value: observed.gold,
            minimum: gold.minimumValue,
            maximum: gold.startingValue,
          }),
        }),
  });
}

/** The switch variants a host's entry could hold, each with the command that observes it. */
function challengeSwitchInteraction(
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
  assessment: ChallengeSwitchEntryAssessment,
  prepared: PreparedChallengeSwitchEncounter | undefined,
): ChallengeSwitchInteraction | undefined {
  const origin = room.origin;
  const host = catalog.challengeSwitches.hosts.byKey[room.gameName];
  const encounter =
    host === undefined
      ? undefined
      : catalog.challengeSwitches.eliteEncounters.byKey[host.encounterKeyBySwitchKind.elite];
  const roomSetKey = catalog.rooms.byKey[room.gameName]?.roomSetKey;
  if (encounter === undefined || roomSetKey === undefined) return undefined;
  const outcome = challengeSwitchOutcomeInteraction(catalog, room);
  const pinned =
    room.challengeSwitch !== undefined &&
    catalog.challengeSwitches.variants.byKey[room.challengeSwitch.variantKey]?.switchKind ===
      'elite'
      ? room.challengeSwitch.elite
      : undefined;
  const observeCommand = (variantKey: string) =>
    Object.freeze({
      kind: 'ReplaceChallengeSwitch' as const,
      occurrence: origin,
      variantKey,
    });
  // A room observed with locked doors never held a switch.
  const sharedIssues: ChallengeSwitchEntryAssessment['sharedIssues'] = Object.freeze([
    ...((room.lockedExits ?? []).length === 0
      ? []
      : [Object.freeze({ reason: 'lockedDoors' as const })]),
    ...assessment.sharedIssues,
  ]);
  const rollable = (variant: ChallengeSwitchEntryAssessment['variants'][number]) =>
    sharedIssues.length === 0 && variant.lock === undefined;
  const kinds = catalog.challengeSwitches.kinds.values.map((kind) => {
    const variants = assessment.variants.filter((variant) => variant.switchKind === kind.key);
    const chosen =
      variants.find(
        (variant) => variant.variantKey === kind.defaultVariantKey && rollable(variant),
      ) ?? variants.find(rollable);
    const lock = chosen === undefined ? (sharedIssues[0] ?? variants[0]?.issue) : undefined;
    return Object.freeze({
      switchKind: kind.key,
      ...(chosen === undefined ? {} : { observe: observeCommand(chosen.variantKey) }),
      ...(lock === undefined ? {} : { lock }),
    });
  });
  return Object.freeze({
    kinds: Object.freeze(kinds),
    elite: Object.freeze({
      encounterKey: encounter.encounterKey,
      roomSetKey,
      attributeCount: encounter.attributeCount,
      enemies: Object.freeze(
        encounter.enemies.map((enemy) =>
          Object.freeze({
            enemyKey: enemy.key,
            label: enemy.label,
            attributeKeys: eliteChallengeAttributeOptions(encounter, enemy.key, roomSetKey, []),
          }),
        ),
      ),
      attributeLabels: Object.freeze(
        Object.fromEntries(
          Object.entries(encounter.attributes).map(([key, attribute]) => [key, attribute.label]),
        ),
      ),
      ...(pinned === undefined
        ? {}
        : {
            pinnedDraws: Object.freeze(
              Array.from({ length: encounter.attributeCount }, (_, index) =>
                Object.freeze({
                  attributeKeys:
                    index > pinned.attributeKeys.length
                      ? Object.freeze([])
                      : eliteChallengeAttributeOptions(
                          encounter,
                          pinned.enemyKey,
                          roomSetKey,
                          pinned.attributeKeys.slice(0, index),
                        ),
                }),
              ),
            ),
          }),
    }),
    ...(prepared === undefined
      ? {}
      : {
          encounter: Object.freeze({
            switchKind: prepared.switchKind,
            selectedEncounterDefinitionKey: prepared.phase.encounterKey,
            label: prepared.phase.label,
            customization: Object.freeze(
              (prepared.phase.customization ?? []).map((decision) =>
                Object.freeze({
                  key: decision.key,
                  label: decision.label,
                  selection: decision.selection,
                  ...(decision.value === undefined ? {} : { value: decision.value }),
                  valueSupported: decision.valueSupported,
                  ...(decision.value === undefined
                    ? {}
                    : {
                        reset: Object.freeze({
                          kind: 'ReplaceChallengeSwitchCustomization' as const,
                          occurrence: origin,
                          decisionKey: decision.key,
                          value: null,
                        }),
                      }),
                }),
              ),
            ),
          }),
        }),
    ...(outcome === undefined ? {} : { outcome }),
    sharedIssues,
    variants: Object.freeze(
      assessment.variants.map((variant) =>
        Object.freeze({
          ...variant,
          rollable: rollable(variant),
          command: observeCommand(variant.variantKey),
        }),
      ),
    ),
  });
}

/**
 * An entered lock host's doors: each door that can lock with the command
 * flipping it (refused beside a challenge switch), and once its Timeline is
 * reached, each locked door's press, appended where its actions end, or its
 * fight once pressed.
 */
function lockedDoorsInteraction(
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
  timelineReached: boolean,
  unlockEncounters: ReadonlyMap<string, PreparedUnlockExitEncounter>,
): LockedDoorsInteraction | undefined {
  if (room.origin.kind !== 'occurrence') return undefined;
  const origin = room.origin;
  const locked = room.lockedExits ?? [];
  const doors = lockableExitKeys(catalog, room.gameName).map((exitKey) =>
    Object.freeze({
      exitKey,
      locked: locked.includes(exitKey),
      ...(room.challengeSwitch !== undefined && !locked.includes(exitKey)
        ? { lock: 'challengeSwitch' as const }
        : {
            command: Object.freeze({
              kind: 'ReplaceLockedExit' as const,
              occurrence: origin,
              exitKey,
              locked: !locked.includes(exitKey),
            }),
          }),
    }),
  );
  const biome = createBiomeAddress(origin.routeKey, origin.biomeKey);
  const order = room.roomActionRoster.rows.flatMap((row) =>
    row.rank === null ? [] : [row.reference],
  );
  const unlocks = locked.map((exitKey) => {
    const reference = unlockExitAction(exitKey);
    const action = createRoomActionAddress(biome, origin.occurrenceId, roomActionKey(reference));
    const pressed = order.some(
      (candidate) => candidate.kind === 'unlockExit' && candidate.exitKey === exitKey,
    );
    const prepared = unlockEncounters.get(semanticAddressKey(action));
    return Object.freeze({
      exitKey,
      action,
      ...(pressed
        ? {}
        : {
            append: Object.freeze({
              kind: 'InsertRoomAction' as const,
              action,
              reference,
              index: order.length,
            }),
          }),
      ...(prepared === undefined
        ? {}
        : {
            encounter: Object.freeze({
              selectedEncounterDefinitionKey: prepared.phase.encounterKey,
              label: prepared.phase.label,
              customization: Object.freeze(
                (prepared.phase.customization ?? []).map((decision) =>
                  Object.freeze({
                    key: decision.key,
                    label: decision.label,
                    selection: decision.selection,
                    ...(decision.value === undefined ? {} : { value: decision.value }),
                    valueSupported: decision.valueSupported,
                    ...(decision.value === undefined
                      ? {}
                      : {
                          reset: Object.freeze({
                            kind: 'ReplaceUnlockExitCustomization' as const,
                            action,
                            decisionKey: decision.key,
                            value: null,
                          }),
                        }),
                  }),
                ),
              ),
            }),
          }),
    });
  });
  return Object.freeze({
    doors: Object.freeze(doors),
    lockedAtLeave: Object.freeze(
      unlocks.flatMap((unlock) => (unlock.append === undefined ? [] : [unlock.exitKey])),
    ),
    ...(timelineReached ? { unlocks: Object.freeze(unlocks) } : {}),
  });
}

/**
 * What can be done with each reached room's World Shop, Shrine and Contract
 * pedestal, and which switch its entry could hold, by room.
 */
export function roomObjectInteractions(
  context: ChronologyWalkContext,
  state: ChronologyWalkState,
  derivedEntries: DerivedEntryFrontiers,
): ReadonlyMap<string, RoomObjectInteractions> {
  const interactions = new Map<string, RoomObjectInteractions>();
  for (const [roomKey, end] of state.roomActionEnds) {
    const room = authoredRoom(context, roomKey);
    if (room === undefined) continue;
    const worldShop = worldShopInteraction(
      context.catalog,
      room,
      end.historySequence,
      derivedEntries,
    );
    const hermesShrine = hermesShrineInteraction(
      room,
      end.historySequence,
      state.hermesShrineTravelDealRefills.get(roomKey),
    );
    const championItem = championItemInteraction(room, end.historySequence, end.branch);
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
  // The switch is an Overview fact of entry, available even where the Timeline is unreached.
  for (const [roomKey, assessment] of state.challengeSwitchAssessments) {
    const room = authoredRoom(context, roomKey);
    if (room === undefined) continue;
    const challengeSwitch = challengeSwitchInteraction(
      context.catalog,
      room,
      assessment,
      state.challengeSwitchEncounters.get(roomKey),
    );
    if (challengeSwitch === undefined) continue;
    interactions.set(roomKey, Object.freeze({ ...interactions.get(roomKey), challengeSwitch }));
  }
  for (const roomKey of state.enteredLockHosts) {
    const room = authoredRoom(context, roomKey);
    if (room === undefined) continue;
    const lockedDoors = lockedDoorsInteraction(
      context.catalog,
      room,
      state.roomActionEnds.has(roomKey),
      state.unlockExitEncounters,
    );
    if (lockedDoors === undefined) continue;
    interactions.set(roomKey, Object.freeze({ ...interactions.get(roomKey), lockedDoors }));
  }
  return interactions;
}
