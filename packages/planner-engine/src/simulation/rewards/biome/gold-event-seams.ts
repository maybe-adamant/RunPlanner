import type { Catalog, InRunTraitRarity } from '../../../catalog-schema';
import {
  createBiomeAddress,
  createEncounterPhaseAddress,
  createRoomActionAddress,
  semanticAddressKey,
  type OccurrenceAddress,
  type RoomActionAddress,
  type SemanticAddress,
} from '../../../authored-project/addresses';
import { INFERNAL_CONTRACT_PEDESTAL_SITE_KEY } from '../../../authored-project/infernal-contract-pedestal';
import { purgingPoolSalePoint } from '../../commerce/feature-rolls';
import type { RouteLoadout } from '../../../authored-project/model';
import { stygianWellGenerationItemKey } from '../../../authored-project/feature-rolls';
import { urnAttempts } from '../../commerce/gold/enemy-gold-policy';
import {
  goldGainPublication,
  goldMultipliers,
  goldOnKillFacts,
  goldSpawnReading,
  moneyMultiplierSources,
  type GoldSpawnReading,
  type GoldEventPublication,
  type GoldGain,
  type GoldMultipliers,
} from '../../commerce/gold/gain-context';
import { knownEncounterRoster } from '../../commerce/gold/known-roster';
import { GoldLedgerContractError } from '../../commerce/gold/ledger';
import type { PurchasePriceUnpriced } from '../../commerce/gold/price-context';
import type { HistoryEvent } from '../../history';
import { keepsakeRankForEquip } from '../../keepsakes/state';
import type { CanonicalAuthoredRoom } from '../../materialization';
import type { RoomActionRow } from '../../room-actions';
import type { SimulationState } from '../../state/model';
import { producingTraitPickup } from '../../state/pending-resource-pickups';
import type { RewardEvent } from '../model';
import type {
  ChronologyWalkContext,
  ChronologyWalkState,
  GoldRecordedRoster,
} from './chronology-walk';
import { wellOccurrenceView } from './encounter-acquisition/well-purchase';
import { routeInitialProfile, routeRoomDeclaration } from '../../../authored-project/route-profile';

/** One gold contact a branch settled, or why it has no gold reading. */
type Detection =
  | { readonly gain: GoldGain; readonly multipliers?: GoldMultipliers | undefined }
  | { readonly unpriced: PurchasePriceUnpriced };

interface Detected {
  readonly owner?: SemanticAddress;
  readonly detection: Detection;
}

function authoredRoom(
  context: ChronologyWalkContext,
  origin: SemanticAddress,
): CanonicalAuthoredRoom | undefined {
  const room = context.rooms.get(semanticAddressKey(origin));
  return room?.kind === 'authored' ? room : undefined;
}

/** The required action whose settlement makes the room's exit usable, when one is ranked. */
function exitUsableRow(room: CanonicalAuthoredRoom): RoomActionRow | undefined {
  const afterRank = room.roomActionRoster.checkpoints.find(
    (checkpoint) => checkpoint.checkpointKey === 'exitUsable',
  )?.afterRank;
  return room.roomActionRoster.rows.find(
    (candidate) =>
      !candidate.stale &&
      candidate.rank !== null &&
      candidate.rank === afterRank &&
      candidate.participation === 'required',
  );
}

/** Whether a walked event is the one a ranked row's player action emits. */
function rowSettledBy(event: HistoryEvent, row: RoomActionRow): boolean {
  const reference = row.reference;
  switch (reference.kind) {
    case 'interactAcquisitionEntry':
      return (
        event.kind === 'acquisitionPointReached' &&
        event.siteKey === reference.siteKey &&
        event.entryKey === reference.entryKey
      );
    case 'interactShopOffer':
      return (
        event.kind === 'acquisitionPointReached' &&
        event.point === `shopOffer:${reference.offerKey}`
      );
    case 'interactLocalReward':
      return (
        event.kind === 'acquisitionPointReached' &&
        event.point === `localReward:${reference.groupKey}:${reference.slotKey}`
      );
    case 'interactInfernalContractPedestal':
      return (
        event.kind === 'acquisitionPointReached' &&
        event.point === INFERNAL_CONTRACT_PEDESTAL_SITE_KEY
      );
    case 'sellPurgingPoolTrait':
      return (
        event.kind === 'acquisitionPointReached' && event.point === purgingPoolSalePoint(reference)
      );
    case 'interactIncomingReward':
      return (
        event.kind === 'producerRoleAdvanced' &&
        event.lifecyclePoint === reference.producerPoint &&
        event.role === reference.acquisitionRole
      );
    case 'interactWheelReward':
      return event.kind === 'offerPointAcquired' && event.offerPoint === reference.wheelKey;
    case 'interactEncounter':
    case 'interactGorgon':
      return (
        event.kind === 'encounterInteractionReached' &&
        event.interaction === (reference.kind === 'interactEncounter' ? 'encounter' : 'gorgon') &&
        event.phaseKey === reference.phaseKey
      );
    case 'purchaseStygianWellOffer':
      return event.kind === 'wellPurchase' && event.generationKey === reference.generationKey;
    case 'purchaseHermesShrineOffer':
      return (
        event.kind === 'hermesShrinePurchaseReached' &&
        event.generationKey === reference.generationKey
      );
    case 'useFountain':
    case 'interactKeepsakeRack':
    case 'interactEris':
    case 'reroll':
    case 'rerollStygianWell':
    case 'rerollPurgingPool':
      return (
        (event.kind === 'fountainUsed' ||
          event.kind === 'keepsakeRackUsed' ||
          event.kind === 'erisInteracted' ||
          event.kind === 'rewardRerolled' ||
          event.kind === 'featureRerolled') &&
        semanticAddressKey(event.owner) === semanticAddressKey(row.owner)
      );
    // Native room completion, a cage's fight and a wheel's choice emit no player action.
    case 'collectRequiredReward':
    case 'completeFieldsCage':
    case 'chooseRewardWheel':
      return false;
  }
}

/** The ranked action the walked event settles: the timeline row whose gold it pays. */
function walkedRoomAction(
  room: CanonicalAuthoredRoom,
  event: HistoryEvent,
): RoomActionAddress | undefined {
  const row = room.roomActionRoster.rows.find(
    (candidate) => candidate.rank !== null && rowSettledBy(event, candidate),
  );
  return row === undefined
    ? undefined
    : createRoomActionAddress(
        createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
        room.occurrenceId,
        row.key,
      );
}

/** The exit rows whose settlement the doors-open marker reads. */
const DOOR_EXIT_ACTIONS: ReadonlySet<RoomActionRow['reference']['kind']> = new Set([
  'interactAcquisitionEntry',
  'interactShopOffer',
  'interactLocalReward',
  'interactEncounter',
  'purchaseStygianWellOffer',
]);

/**
 * Whether the doors open at this walked event: at outgoing generation, unless
 * a required action ranked after it (a flushed Shrine delivery) or a room with
 * no outgoing generation makes the exit usable at that action instead.
 */
function doorsOpenAt(room: CanonicalAuthoredRoom, event: HistoryEvent): boolean {
  const generates = room.roomActionRoster.checkpoints.some(
    (checkpoint) => checkpoint.checkpointKey === 'outgoingGeneration',
  );
  const exit = exitUsableRow(room);
  const atExitRow = exit !== undefined && (!generates || exit.window.kind === 'postOutgoing');
  return atExitRow
    ? DOOR_EXIT_ACTIONS.has(exit.reference.kind) && rowSettledBy(event, exit)
    : event.kind === 'outgoingGenerationCheckpoint';
}

/**
 * Native `RunDepthCache` when the room's door was taken: the room's own run
 * depth; undefined when the walked room has no preparation view.
 */
function runDepthAt(context: ChronologyWalkContext, roomKey: string): number | undefined {
  const view = context.views.get(roomKey)?.preparation;
  return view === undefined ? undefined : view.ledgers.counters.roomHistoryOrdinal + 1;
}

/** Loot spawned in a room with a boon rarity override is boosted (`AddBoostedAnimation`). */
function boostedRoom(context: ChronologyWalkContext, room: CanonicalAuthoredRoom): boolean {
  return (
    routeRoomDeclaration(context.catalog.rooms.byKey[room.gameName], room.origin.routeKey)
      ?.boonRarityOverride !== undefined
  );
}

function boostedConversionBonus(catalog: Catalog): number {
  for (const keepsake of catalog.keepsakes.values)
    if (keepsake.effect?.kind === 'timePiece') return keepsake.effect.boostedConversionBonus;
  return 0;
}

/** Echo's biome-start keepsake copy: a captured Gold Purse pays its Common gold. */
export function withEchoKeepsakeGold(
  context: ChronologyWalkContext,
  before: ChronologyWalkState,
  after: ChronologyWalkState,
): ChronologyWalkState {
  const { branch } = after;
  if (branch === undefined) return after;
  const seen = new Set(before.branch?.state.traitHistory.events ?? []);
  const firstEntered = context.history.events.find((event) => event.kind === 'roomEntered');
  const firstRoom =
    firstEntered === undefined
      ? undefined
      : context.rooms.get(semanticAddressKey(firstEntered.origin));
  const replays = branch.state.traitHistory.events.filter(
    (traitEvent): traitEvent is Extract<typeof traitEvent, { kind: 'echoKeepsakeReplay' }> =>
      !seen.has(traitEvent) && traitEvent.kind === 'echoKeepsakeReplay',
  );
  const replay = replays.length === 1 ? replays[0] : undefined;
  const gold =
    replay === undefined
      ? undefined
      : context.catalog.keepsakes.byKey[replay.capturedKeepsakeKey]?.goldByRank?.Common;
  if (replay === undefined || gold === undefined) return after;
  return withGoldPublications(after, [
    goldGainPublication({
      sequence: replay.sequence,
      ...(firstRoom?.origin.kind === 'occurrence' ? { room: firstRoom.origin } : {}),
      owner: replay.owner,
      reading: {
        gain: Object.freeze({ kind: 'keepsakeGold' as const, gold }),
        multipliers: goldMultipliers(context.catalog, branch.state),
      },
    }),
  ]);
}

function optionalRoomAction(roomAction: RoomActionAddress | undefined): {
  readonly roomAction?: RoomActionAddress;
} {
  return roomAction === undefined ? {} : { roomAction };
}

function withGoldPublications(
  state: ChronologyWalkState,
  publications: readonly GoldEventPublication[],
): ChronologyWalkState {
  return publications.length === 0
    ? state
    : Object.freeze({
        ...state,
        goldEvents: Object.freeze([...state.goldEvents, ...publications]),
      });
}

/** The held loan traits: rarity and whether a boss already paid them back. */
function heldLoans(
  catalog: Catalog,
  state: SimulationState,
): ReadonlyMap<string, { readonly rarity: string | undefined; readonly paid: boolean }> {
  const loans = new Map<string, { readonly rarity: string | undefined; readonly paid: boolean }>();
  for (const equipped of Object.values(state.traitHistory.equippedTraits))
    if (catalog.traits.byKey[equipped.traitKey]?.gold?.kind === 'loan')
      loans.set(equipped.traitKey, {
        rarity: equipped.rarity,
        paid: equipped.rarityBlockedInRun === true,
      });
  return loans;
}

function loanReturn(catalog: Catalog, traitKey: string, rarity: string | undefined): number {
  const gold = catalog.traits.byKey[traitKey]?.gold;
  return gold?.kind === 'loan' && rarity !== undefined
    ? (gold.returnByRarity[rarity as InRunTraitRarity] ?? 0)
    : 0;
}

/** The gold the active starting-gold Arcana pay at their current rarity. */
function arcanaGold(catalog: Catalog, state: SimulationState): number {
  let gold = 0;
  for (const card of state.arcanaFear.arcana.active) {
    const byRarity = catalog.arcanaCards.byKey[card.key]?.startingGoldByRarity;
    if (byRarity !== undefined && card.unequipped !== true) gold += byRarity[card.rarity];
  }
  return gold;
}

function keepsakeGold(catalog: Catalog, key: string, state: SimulationState): number | undefined {
  const byRank = catalog.keepsakes.byKey[key]?.goldByRank;
  return byRank === undefined
    ? undefined
    : byRank[keepsakeRankForEquip(catalog, key, state.traitHistory)];
}

/** Gold the Currency pickup's producing trait declares at its acquisition ordinal. */
function currencyGold(
  catalog: Catalog,
  state: SimulationState,
  producerLifecycleKey: string,
  entryKey: string | undefined,
): number | undefined {
  const produced = producingTraitPickup(
    catalog,
    state.traitHistory,
    producerLifecycleKey,
    entryKey,
  );
  return produced?.pickup.goldByAcquisitionOrdinal?.[produced.acquisitionOrdinal - 1];
}

/** Native spawns a selected trait's coins (`GiveRandomConsumables`) as its screen closes. */
const SCREEN_SPAWNED_COIN_PRODUCERS = new Set(['GeneratedTraitPickup', 'NarcissusPickup']);

/** Run-start gold: the starting Arcana and keepsake pay their gold, unmultiplied. */
export function withRunStartGold(
  context: ChronologyWalkContext,
  walk: ChronologyWalkState,
  loadout: Pick<RouteLoadout, 'startingKeepsakeKey'>,
): ChronologyWalkState {
  const { branch } = walk;
  if (branch === undefined) return walk;
  const keepsake =
    loadout.startingKeepsakeKey === null
      ? undefined
      : keepsakeGold(context.catalog, loadout.startingKeepsakeKey, branch.state);
  const gold = arcanaGold(context.catalog, branch.state) + (keepsake ?? 0);
  if (gold === 0) return walk;
  return withGoldPublications(walk, [
    goldGainPublication({
      sequence: 0,
      reading: {
        gain: Object.freeze({ kind: 'startingGold' as const, gold }),
        multipliers: goldMultipliers(context.catalog, branch.state),
      },
    }),
  ]);
}

/** A Pool of Purging sale, read from the state it settles from. */
export function withPoolSaleGold(
  context: ChronologyWalkContext,
  state: ChronologyWalkState,
  event: HistoryEvent,
  sold: { readonly traitKey: string; readonly owner: SemanticAddress },
): ChronologyWalkState {
  const room = authoredRoom(context, event.origin);
  const { branch } = state;
  if (room === undefined || branch === undefined) return state;
  const equipped = branch.state.traitHistory.equippedTraits[sold.traitKey];
  const infusion = context.catalog.traits.byKey[sold.traitKey]?.unityTrait === true;
  const rarity =
    equipped?.rarity === undefined ? 'unranked' : infusion ? 'infusion' : equipped.rarity;
  const reading = {
    gain: Object.freeze({
      kind: 'poolSale' as const,
      traitKey: sold.traitKey,
      rarity: rarity as Extract<GoldGain, { kind: 'poolSale' }>['rarity'],
      level: equipped?.level ?? 1,
    }),
    multipliers: goldMultipliers(context.catalog, branch.state),
  };
  return withGoldPublications(state, [
    goldGainPublication({
      sequence: event.sequence,
      room: room.origin,
      owner: sold.owner,
      ...optionalRoomAction(walkedRoomAction(room, event)),
      reading,
    }),
  ]);
}

/**
 * Gold the walked event settled, read from the state it received and the
 * state it produced: new reward and trait-history entries, held loans,
 * keepsakes and Arcana, and the event's own gold contact.
 */
export function withGoldEvents(
  context: ChronologyWalkContext,
  received: ChronologyWalkState,
  next: ChronologyWalkState,
  event: HistoryEvent,
): ChronologyWalkState {
  const { catalog } = context;
  const room = authoredRoom(context, event.origin);
  const roomOrigin: OccurrenceAddress | undefined = room?.origin;
  let state = next;
  // Recorded too: a Fields Passive encounter is prepared but never run as a phase.
  if (
    (event.kind === 'encounterStarted' || event.kind === 'encounterRecorded') &&
    room !== undefined
  )
    state = Object.freeze({
      ...state,
      goldEncounterKeys: new Map(state.goldEncounterKeys).set(
        `${semanticAddressKey(room.origin)}::${event.phaseKey}`,
        event.encounterKey,
      ),
    });
  if (event.kind === 'encounterRecorded' && room !== undefined) {
    // A phase whose roster nothing leaves to native pays from that roster; a
    // broken roster contract faults its gold, never the walk.
    let recorded: GoldRecordedRoster | undefined;
    try {
      const roster = knownEncounterRoster(
        catalog,
        event.encounterKey,
        event.generatedCustomization?.operands,
      );
      if (roster !== undefined) recorded = { encounterKey: event.encounterKey, roster };
    } catch (error) {
      if (!(error instanceof GoldLedgerContractError)) throw error;
      recorded = { encounterKey: event.encounterKey, fault: error.message };
    }
    if (recorded !== undefined)
      state = Object.freeze({
        ...state,
        goldEncounterRosters: new Map(state.goldEncounterRosters).set(
          `${semanticAddressKey(room.origin)}::${event.phaseKey}`,
          Object.freeze(recorded),
        ),
      });
  }
  const enteredRoom = context.rooms.get(semanticAddressKey(event.origin));
  if (
    event.kind === 'roomEntered' &&
    enteredRoom?.origin.kind === 'occurrence' &&
    received.branch !== undefined
  ) {
    // Native draws every store of the room at the door into it, before entry.
    const entry = goldMultipliers(catalog, received.branch.state) ?? ('unresolved' as const);
    state = Object.freeze({
      ...state,
      goldRoomEntryMultipliers: new Map(state.goldRoomEntryMultipliers).set(
        semanticAddressKey(enteredRoom.origin),
        entry,
      ),
    });
  }
  const roomKey = room === undefined ? undefined : semanticAddressKey(room.origin);
  // Spawn contacts a room object's coins are valued at: the room's entry
  // (Fields cages and optionals) and each encounter end (its reward).
  if (
    (event.kind === 'roomEntered' ||
      (event.kind === 'encounterCompleted' && event.execution === 'normal')) &&
    roomKey !== undefined &&
    next.branch !== undefined
  )
    state = Object.freeze({
      ...state,
      goldSpawnReadings: new Map(state.goldSpawnReadings).set(
        `${roomKey}::${event.kind === 'roomEntered' ? 'entry' : 'encounterEnd'}`,
        goldSpawnReading(catalog, next.branch.state) ?? 'unresolved',
      ),
    });
  if (next.branch !== undefined) {
    // A selected trait's own coins spawn as its screen closes, after it is equipped.
    const screens = new Map<string, SimulationState>();
    for (const evaluation of next.branch.traitEvaluations ?? []) {
      if (received.branch?.traitEvaluations?.includes(evaluation)) continue;
      const key = `trait::${semanticAddressKey(evaluation.address)}::${evaluation.acquisitionRole}`;
      screens.set(key, next.branch.state);
    }
    if (screens.size > 0) {
      const readings = new Map(state.goldSpawnReadings);
      for (const [key, screenState] of screens)
        readings.set(key, goldSpawnReading(catalog, screenState) ?? 'unresolved');
      state = Object.freeze({ ...state, goldSpawnReadings: readings });
    }
  }
  const completedKey =
    event.kind === 'encounterCompleted' && event.execution === 'normal' && roomKey !== undefined
      ? state.goldEncounterKeys.get(`${roomKey}::${event.phaseKey}`)
      : undefined;
  const recorded =
    event.kind === 'encounterCompleted' && roomKey !== undefined
      ? state.goldEncounterRosters.get(`${roomKey}::${event.phaseKey}`)
      : undefined;
  const completedRecord =
    recorded !== undefined && recorded.encounterKey === completedKey ? recorded : undefined;
  if (completedKey !== undefined)
    state = Object.freeze({
      ...state,
      goldCompletedEncounters: new Map(state.goldCompletedEncounters).set(roomKey!, [
        ...(state.goldCompletedEncounters.get(roomKey!) ?? []),
        completedRecord ?? Object.freeze({ encounterKey: completedKey }),
      ]),
    });
  // The first completed phase that drains another slot's store pays that store, once.
  const drainedSlotKey =
    completedKey === undefined || event.kind !== 'encounterCompleted'
      ? undefined
      : catalog.encounterEnvelopes.byKey[room!.encounterEnvelopeKey]?.slots.find(
          (slot) => slot.key === event.phaseKey,
        )?.moneyStoreSlotKey;
  const firstDrain =
    drainedSlotKey !== undefined &&
    !state.goldPaidSharedStores.has(`${roomKey}::${drainedSlotKey}`);
  if (firstDrain)
    state = Object.freeze({
      ...state,
      goldPaidSharedStores: new Set(state.goldPaidSharedStores).add(
        `${roomKey}::${drainedSlotKey}`,
      ),
    });
  if (event.kind === 'roomEntered' && enteredRoom?.origin.kind === 'occurrence')
    state = withGoldPublications(state, [
      Object.freeze({
        kind: 'roomEntered' as const,
        sequence: event.sequence,
        room: enteredRoom.origin,
      }),
    ]);
  const doorsOpenHere = room !== undefined && doorsOpenAt(room, event);
  const roomAction = room === undefined ? undefined : walkedRoomAction(room, event);
  const doorsOpen: readonly GoldEventPublication[] = doorsOpenHere
    ? [Object.freeze({ kind: 'doorsOpen' as const, sequence: event.sequence, room: roomOrigin! })]
    : [];
  const { branch } = next;
  if (received.branch === undefined || branch === undefined)
    return withGoldPublications(state, doorsOpen);

  const prior = received.branch.state;
  const before = goldMultipliers(catalog, prior);
  const receivedEvents = new Set(received.branch.events);
  const receivedEvaluations = new Set(received.branch.traitEvaluations ?? []);
  const detected = new Map<string, Detected>();
  const detect = (key: string, owner: SemanticAddress | undefined, detection: Detection) => {
    detected.set(key, { ...(owner === undefined ? {} : { owner }), detection });
  };

  /**
   * How a collected coin object was valued: a trait's coins at its screen's
   * close, never re-multiplied (`NotRequiredPickup`, RoomLogic.lua:1944-1985);
   * a room reward at its spawn, re-multiplied by each money multiplier taken
   * before collection (`MapState.RoomRequiredObjects` and `OptionalRewards`,
   * TraitLogic.lua:1045-1058; GOLD_ESTIMATE_ASSUMPTIONS.md "Coin spawn contacts").
   * Undefined where it is valued at collection.
   */
  const coinSpawn = (
    rewardEvent: Extract<RewardEvent, { readonly kind: 'concreteAcquisition' }>,
    after: SimulationState,
  ):
    | { readonly multipliers: GoldSpawnReading['multipliers']; readonly remultipliers: number[] }
    | 'unresolved'
    | undefined => {
    if (room === undefined || roomKey === undefined) return undefined;
    const producerKey = rewardEvent.source.producerLifecycleKey;
    let reading: GoldSpawnReading | 'unresolved' | undefined;
    let roomObject = false;
    if (SCREEN_SPAWNED_COIN_PRODUCERS.has(producerKey)) {
      const pointKey = rewardEvent.settlement?.site.pointKey;
      const producer = room.pickupProducers?.find((candidate) => candidate.siteKey === pointKey);
      if (producer?.source.kind !== 'traitOffer') return undefined;
      reading = state.goldSpawnReadings.get(
        `trait::${semanticAddressKey(producer.source.owner)}::${producer.source.acquisitionRole}`,
      );
    } else if (producerKey === 'RoomReward') {
      // Only an object spawned in the room it is collected in lies among its objects.
      const origin = rewardEvent.origin as { readonly occurrenceId?: string };
      if (origin.occurrenceId !== room.occurrenceId) return undefined;
      roomObject = true;
      reading =
        rewardEvent.origin.kind === 'incomingReward' || rewardEvent.origin.kind === 'rewardWheel'
          ? (state.goldSpawnReadings.get(`${roomKey}::encounterEnd`) ??
            state.goldSpawnReadings.get(`${roomKey}::entry`))
          : state.goldSpawnReadings.get(`${roomKey}::entry`);
    }
    if (reading === undefined || reading === 'unresolved') return reading;
    if (!roomObject) return { multipliers: reading.multipliers, remultipliers: [] };
    const now = moneyMultiplierSources(catalog, after);
    if (now === undefined) return 'unresolved';
    const held = new Set(reading.sources.map((source) => source.key));
    return {
      multipliers: reading.multipliers,
      remultipliers: now.filter((source) => !held.has(source.key)).map((source) => source.value),
    };
  };

  {
    const after = branch.state;
    for (const rewardEvent of branch.events) {
      if (receivedEvents.has(rewardEvent)) continue;
      if (rewardEvent.kind !== 'concreteAcquisition' && rewardEvent.kind !== 'conversionToGold')
        continue;
      const owner = rewardEvent.settlement?.entry ?? rewardEvent.origin;
      const key = `${rewardEvent.kind}:${semanticAddressKey(owner)}`;
      const gameName = rewardEvent.acquisition.acquisition.gameName;
      const declaration = catalog.rewards.acquisitions.byKey[gameName];
      if (rewardEvent.kind === 'conversionToGold') {
        detect(
          key,
          owner,
          declaration?.goldifyValue === undefined
            ? { unpriced: { kind: 'contractFailure', detail: `${gameName} has no GoldifyValue` } }
            : {
                gain: {
                  kind: 'timePiece',
                  gold:
                    declaration.goldifyValue +
                    (declaration.kind === 'loot' && room !== undefined && boostedRoom(context, room)
                      ? boostedConversionBonus(catalog)
                      : 0),
                },
              },
        );
        continue;
      }
      const spawned = coinSpawn(rewardEvent, after);
      if (declaration?.goldGrant !== undefined) {
        const producer =
          catalog.rewards.producerLifecycles.byKey[rewardEvent.source.producerLifecycleKey];
        detect(
          key,
          owner,
          spawned === 'unresolved'
            ? { unpriced: { kind: 'itemUnresolved' } }
            : {
                gain: {
                  kind: 'moneyPickup',
                  gold: declaration.goldGrant,
                  npcDrop: producer?.resourceBonusExempt === true,
                  ...(spawned === undefined
                    ? {}
                    : {
                        spawn: spawned.multipliers,
                        ...(spawned.remultipliers.length === 0
                          ? {}
                          : { remultipliers: spawned.remultipliers }),
                      }),
                },
              },
        );
      } else if (gameName === 'Currency') {
        const gold = currencyGold(
          catalog,
          after,
          rewardEvent.source.producerLifecycleKey,
          rewardEvent.settlement?.entry.entryKey,
        );
        detect(
          key,
          owner,
          gold === undefined
            ? {
                unpriced: { kind: 'contractFailure', detail: 'a Currency pickup declares no gold' },
              }
            : spawned === 'unresolved'
              ? { unpriced: { kind: 'itemUnresolved' } }
              : {
                  gain: {
                    kind: 'currencyPickup',
                    gold,
                    ...(spawned === undefined ? {} : { spawn: spawned.multipliers }),
                  },
                },
        );
      }
    }
    for (const evaluation of branch.traitEvaluations ?? []) {
      if (receivedEvaluations.has(evaluation) || evaluation.offer.kind !== 'fallbackGold') continue;
      detect(`fallbackGold:${semanticAddressKey(evaluation.address)}`, evaluation.address, {
        gain: { kind: 'fallbackGold', gold: catalog.gold.fallbackGold },
        multipliers: goldMultipliers(catalog, evaluation.state),
      });
    }
    const loans = heldLoans(catalog, after);
    {
      const held = heldLoans(catalog, prior);
      for (const [traitKey, loan] of loans) {
        const was = held.get(traitKey);
        const key = `loan:${traitKey}`;
        if (was === undefined)
          detect(key, undefined, {
            gain: {
              kind: 'loanTake',
              traitKey,
              returnGold: loanReturn(catalog, traitKey, loan.rarity),
            },
          });
        else if (!was.paid && loan.paid)
          detect(key, undefined, { gain: { kind: 'loanPayback', traitKey } });
        else if (!loan.paid && was.rarity !== loan.rarity)
          detect(key, undefined, {
            gain: {
              kind: 'loanCredit',
              traitKey,
              returnGold:
                loanReturn(catalog, traitKey, loan.rarity) -
                loanReturn(catalog, traitKey, was.rarity),
            },
          });
      }
    }
    const current = after.keepsakes.currentKey;
    if (current !== null && current !== prior.keepsakes.currentKey) {
      const gold = keepsakeGold(catalog, current, after);
      if (gold !== undefined)
        detect(`keepsake:${current}`, undefined, { gain: { kind: 'keepsakeGold', gold } });
    }
    const raised = arcanaGold(catalog, after) - arcanaGold(catalog, prior);
    if (raised > 0) detect('arcana', undefined, { gain: { kind: 'arcanaGold', gold: raised } });
    if (room !== undefined) {
      const biome = createBiomeAddress(room.origin.routeKey, room.origin.biomeKey);
      if (event.kind === 'wellPurchase' && room.stygianWell !== undefined) {
        const itemKey = stygianWellGenerationItemKey(wellOccurrenceView(room), event.generationKey);
        const option = catalog.rewards.shops.byKey.RoomShop?.groups.values
          .flatMap((group) => group.options.values)
          .find((candidate) => candidate.key === itemKey);
        if (itemKey !== undefined && itemKey !== null && option?.goldPayout !== undefined)
          detect(`midas:${event.generationKey}`, undefined, {
            gain: { kind: 'midasPayout', itemKey },
          });
      }
      if (completedKey !== undefined && event.kind === 'encounterCompleted') {
        const definition = catalog.encounterDefinitions.byKey[completedKey];
        const phase = createEncounterPhaseAddress(
          biome,
          { kind: 'occurrence', occurrenceId: room.occurrenceId },
          event.phaseKey,
        );
        // Room entry attests the Hordes rank every phase of the room reads.
        const hordesRank = state.encounterEntryVowRanks.get(roomKey!)?.hordes;
        // A phase whose kills drain another slot's store (a Fields cage) pays
        // nothing itself; the room's first such fight pays that store, by its
        // policy rather than a roster, since every draining phase feeds it.
        const slots = catalog.encounterEnvelopes.byKey[room.encounterEnvelopeKey]?.slots ?? [];
        const storeSlotKey = slots.find((slot) => slot.key === event.phaseKey)?.moneyStoreSlotKey;
        const sharedStore = slots.some((slot) => slot.moneyStoreSlotKey === event.phaseKey);
        const paid =
          storeSlotKey !== undefined
            ? firstDrain
              ? {
                  phaseKey: storeSlotKey,
                  encounterKey: state.goldEncounterKeys.get(`${roomKey}::${storeSlotKey}`),
                  record: undefined,
                }
              : undefined
            : !sharedStore &&
                (definition?.kind === 'combat' ||
                  definition?.kind === 'miniboss' ||
                  (definition?.kind === 'boss' && definition.bossRoster !== undefined))
              ? { phaseKey: event.phaseKey, encounterKey: completedKey, record: completedRecord }
              : undefined;
        const missingHordes: Detection = {
          unpriced: {
            kind: 'contractFailure',
            detail: `${completedKey} has no Hordes rank attested at its room's entry`,
          },
        };
        if (paid !== undefined) {
          const entry = state.goldRoomEntryMultipliers.get(roomKey!);
          const runDepth = runDepthAt(context, roomKey!);
          const paidKey = paid.encounterKey;
          detect(
            `enemyGold:${paid.phaseKey}`,
            createEncounterPhaseAddress(
              biome,
              { kind: 'occurrence', occurrenceId: room.occurrenceId },
              paid.phaseKey,
            ),
            paidKey === undefined ||
              (storeSlotKey !== undefined &&
                catalog.encounterDefinitions.byKey[paidKey]?.moneyStore === undefined)
              ? {
                  unpriced: {
                    kind: 'contractFailure',
                    detail: `${room.gameName} ${paid.phaseKey} has no recorded store`,
                  },
                }
              : paid.record !== undefined && 'fault' in paid.record
                ? { unpriced: { kind: 'contractFailure', detail: paid.record.fault } }
                : entry === undefined
                  ? {
                      unpriced: {
                        kind: 'contractFailure',
                        detail: `${paidKey} has no gold multiplier at its room's door`,
                      },
                    }
                  : entry === 'unresolved'
                    ? { unpriced: { kind: 'itemUnresolved' } }
                    : runDepth === undefined
                      ? {
                          unpriced: {
                            kind: 'contractFailure',
                            detail: `${paidKey} has no run depth at its room's door`,
                          },
                        }
                      : hordesRank === undefined
                        ? missingHordes
                        : {
                            gain: {
                              kind: 'enemyGold',
                              encounterKey: paidKey,
                              biomeKey: room.origin.biomeKey,
                              runDepth,
                              hordesRank,
                              ...(paid.record !== undefined && 'roster' in paid.record
                                ? { roster: paid.record.roster }
                                : {}),
                            },
                            multipliers: entry,
                          },
          );
        }
        if (definition?.killBounty !== undefined)
          detect(`heraclesBounty:${event.phaseKey}`, phase, {
            gain: { kind: 'heraclesBounty', encounterKey: completedKey },
          });
        const fights = ({ encounterKey }: { readonly encounterKey: string }) => {
          const kind = catalog.encounterDefinitions.byKey[encounterKey]?.kind;
          return kind === 'combat' || kind === 'miniboss' || kind === 'boss';
        };
        const completed = state.goldCompletedEncounters.get(roomKey!) ?? [];
        const rosterFault = completed.find(
          (encounter): encounter is Extract<GoldRecordedRoster, { readonly fault: string }> =>
            'fault' in encounter,
        );
        const medea = goldOnKillFacts(catalog, after);
        // Each fight adds its kills to the room's capped drops; the ledger pays the increase.
        if (medea !== undefined && fights({ encounterKey: completedKey }))
          detect(
            `medeaGold:${event.phaseKey}`,
            phase,
            hordesRank === undefined
              ? missingHordes
              : rosterFault !== undefined
                ? { unpriced: { kind: 'contractFailure', detail: rosterFault.fault } }
                : {
                    gain: {
                      kind: 'medeaGold',
                      ...medea,
                      encounters: completed.filter(fights).map((encounter) => ({
                        encounterKey: encounter.encounterKey,
                        biomeKey: room.origin.biomeKey,
                        hordesRank,
                        ...('roster' in encounter ? { roster: encounter.roster } : {}),
                      })),
                    },
                    multipliers: goldMultipliers(catalog, after),
                  },
          );
      }
      // GOLD_ESTIMATE_ASSUMPTIONS.md "Urn upgrade owned", "Urns per occurrence".
      const declaration = catalog.rooms.byKey[room.gameName];
      if (
        event.kind === 'roomEntered' &&
        declaration !== undefined &&
        routeInitialProfile(catalog, room.origin.routeKey).kind !== 'freshFile' &&
        urnAttempts(declaration) !== undefined
      )
        detect('urnGold', undefined, {
          gain: { kind: 'urnGold', roomGameName: room.gameName },
          multipliers: goldMultipliers(catalog, after),
        });
      if (event.kind === 'encounterCompleted' && event.execution === 'normal') {
        const encounterKey = state.goldEncounterKeys.get(
          `${semanticAddressKey(room.origin)}::${event.phaseKey}`,
        );
        const bet =
          encounterKey === undefined
            ? undefined
            : catalog.encounterDefinitions.byKey[encounterKey]?.goldBet;
        const outcome =
          bet === undefined ? undefined : room.encounters.nemesisBetOutcomeByPhase[event.phaseKey];
        if (bet !== undefined && outcome === undefined)
          throw new Error(`${event.phaseKey} fielded a Nemesis bet without an authored outcome`);
        if (bet !== undefined && outcome !== undefined)
          detect(
            `nemesisBet:${event.phaseKey}`,
            createEncounterPhaseAddress(
              biome,
              { kind: 'occurrence', occurrenceId: room.occurrenceId },
              event.phaseKey,
            ),
            {
              gain: {
                kind: 'nemesisBet',
                maxBet: bet.maxBet,
                outcome,
              },
            },
          );
      }
      if (event.kind === 'encounterInteractionReached' && event.interaction === 'encounter') {
        const outcome = room.encounters.nemesisRandomEventByPhase?.[event.phaseKey];
        if (outcome?.kind === 'goldTrade' && outcome.response === 'accept') {
          const rewardType =
            room.acquisitionSites?.[`nemesisGenerated:${encodeURIComponent(event.phaseKey)}`]
              ?.entries.result?.offer.rewardType;
          const variant =
            catalog.encounterDefinitions.byKey.NemesisRandomEvent?.nemesisRandomEvent?.goldTrade.variants.find(
              (candidate) => candidate.rewardType === rewardType,
            );
          detect(
            `nemesisTrade:${event.phaseKey}`,
            createEncounterPhaseAddress(
              biome,
              { kind: 'occurrence', occurrenceId: room.occurrenceId },
              event.phaseKey,
            ),
            variant === undefined
              ? { unpriced: { kind: 'itemUnresolved' } }
              : {
                  gain: {
                    kind: 'nemesisTrade',
                    min: variant.goldCost.min,
                    max: variant.goldCost.max,
                  },
                },
          );
        }
      }
    }
  }

  const publications: GoldEventPublication[] = [];
  for (const { owner, detection } of detected.values())
    publications.push(
      goldGainPublication({
        sequence: event.sequence,
        ...(roomOrigin === undefined ? {} : { room: roomOrigin }),
        ...(owner === undefined ? {} : { owner }),
        ...optionalRoomAction(roomAction),
        ...('unpriced' in detection
          ? { unpriced: detection.unpriced }
          : {
              reading: {
                gain: detection.gain,
                multipliers: 'multipliers' in detection ? detection.multipliers : before,
              },
            }),
      }),
    );
  return withGoldPublications(state, [...publications, ...doorsOpen]);
}
