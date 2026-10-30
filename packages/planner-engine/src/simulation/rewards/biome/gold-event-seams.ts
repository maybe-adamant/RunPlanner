import type { Catalog, InRunTraitRarity } from '../../../catalog-schema';
import {
  createBiomeAddress,
  createEncounterPhaseAddress,
  semanticAddressKey,
  type OccurrenceAddress,
  type SemanticAddress,
} from '../../../authored-project/addresses';
import type { RouteLoadout } from '../../../authored-project/model';
import { stygianWellGenerationItemKey } from '../../../authored-project/feature-rolls';
import {
  goldGainPublication,
  goldMultipliers,
  type GoldEventPublication,
  type GoldGain,
  type GoldMultipliers,
} from '../../commerce/gold/gain-context';
import type { PurchasePriceUnpriced } from '../../commerce/gold/price-context';
import type { HistoryEvent } from '../../history';
import { keepsakeRankForEquip } from '../../keepsakes/state';
import type { CanonicalAuthoredRoom } from '../../materialization';
import type { RoomActionRow } from '../../room-actions';
import type { SimulationState } from '../../state/model';
import type { RewardBranchState } from '../branch-primitives';
import type { ChronologyWalkContext, ChronologyWalkState } from './chronology-walk';
import { wellOccurrenceView } from './encounter-acquisition/well-purchase';
import { routeRoomDeclaration } from '../../../authored-project/route-profile';

/** One gold contact a branch settled, or why it has no gold reading. */
type Detection =
  | { readonly gain: GoldGain; readonly multipliers?: GoldMultipliers | undefined }
  | { readonly unpriced: PurchasePriceUnpriced };

interface Detected {
  readonly owner?: SemanticAddress;
  readonly byBranch: Detection[];
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

/** Whether a walked event settles one ranked action row. */
function settlesRow(event: HistoryEvent, row: RoomActionRow): boolean {
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
    case 'interactEncounter':
      return (
        event.kind === 'encounterInteractionReached' &&
        event.interaction === 'encounter' &&
        event.phaseKey === reference.phaseKey
      );
    case 'purchaseStygianWellOffer':
      return event.kind === 'wellPurchase' && event.generationKey === reference.generationKey;
    default:
      return false;
  }
}

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
  return atExitRow ? settlesRow(event, exit) : event.kind === 'outgoingGenerationCheckpoint';
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

/**
 * Echo's biome-start keepsake copy: a captured Gold Purse pays its Common gold.
 * Reached branches that disagree on the copy or its gold fail the contract.
 */
export function withEchoKeepsakeGold(
  context: ChronologyWalkContext,
  before: ChronologyWalkState,
  after: ChronologyWalkState,
): ChronologyWalkState {
  if (after.branches.length === 0) return after;
  const seen = new Set(before.branches.flatMap((branch) => branch.state.traitHistory.events));
  const firstEntered = context.history.events.find((event) => event.kind === 'roomEntered');
  const firstRoom =
    firstEntered === undefined
      ? undefined
      : context.rooms.get(semanticAddressKey(firstEntered.origin));
  const replays = after.branches.map((branch) =>
    branch.state.traitHistory.events.filter(
      (traitEvent): traitEvent is Extract<typeof traitEvent, { kind: 'echoKeepsakeReplay' }> =>
        !seen.has(traitEvent) && traitEvent.kind === 'echoKeepsakeReplay',
    ),
  );
  const golds = replays.map((events) =>
    events.length === 1
      ? context.catalog.keepsakes.byKey[events[0]!.capturedKeepsakeKey]?.goldByRank?.Common
      : undefined,
  );
  const paid = replays.flatMap((events, index) =>
    golds[index] === undefined ? [] : [{ replay: events[0]!, gold: golds[index] }],
  );
  const first = paid[0];
  if (first === undefined) return after;
  const agree =
    replays.every((events) => events.length === 1) &&
    golds.every((gold) => gold === first.gold) &&
    paid.every(({ replay }) => replay.sequence === first.replay.sequence);
  return withGoldPublications(after, [
    goldGainPublication({
      sequence: first.replay.sequence,
      ...(firstRoom?.origin.kind === 'occurrence' ? { room: firstRoom.origin } : {}),
      owner: first.replay.owner,
      readings: agree
        ? after.branches.map((branch) => ({
            gain: Object.freeze({ kind: 'keepsakeGold' as const, gold: first.gold }),
            multipliers: goldMultipliers(context.catalog, branch.state),
          }))
        : [],
      ...(agree
        ? {}
        : {
            unpriced: {
              kind: 'contractFailure' as const,
              detail: "reached branches disagree on Echo's keepsake gold",
            },
          }),
    }),
  ]);
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
  for (const equipped of Object.values(state.traitHistory.equippedTraits)) {
    const disposition = catalog.traits.byKey[equipped.traitKey]?.selectedDisposition;
    if (
      disposition?.kind !== 'producePickups' ||
      disposition.producerLifecycleKey !== producerLifecycleKey
    )
      continue;
    const pickup = disposition.pickups.find(
      (candidate) => candidate.key === entryKey && candidate.goldByAcquisitionOrdinal !== undefined,
    );
    const ordinal = Math.min(Math.max(equipped.acquisitionOrdinal ?? 1, 1), 4);
    if (pickup?.goldByAcquisitionOrdinal !== undefined)
      return pickup.goldByAcquisitionOrdinal[ordinal - 1];
  }
  return undefined;
}

/** Run-start gold: the starting Arcana and keepsake pay their gold, unmultiplied. */
export function withRunStartGold(
  context: ChronologyWalkContext,
  walk: ChronologyWalkState,
  loadout: Pick<RouteLoadout, 'startingKeepsakeKey'>,
): ChronologyWalkState {
  if (walk.branches.length === 0) return walk;
  const readings = walk.branches.map((branch) => {
    const keepsake =
      loadout.startingKeepsakeKey === null
        ? undefined
        : keepsakeGold(context.catalog, loadout.startingKeepsakeKey, branch.state);
    return {
      gain: Object.freeze({
        kind: 'startingGold' as const,
        gold: arcanaGold(context.catalog, branch.state) + (keepsake ?? 0),
      }),
      multipliers: goldMultipliers(context.catalog, branch.state),
    };
  });
  if (readings.every((reading) => reading.gain.gold === 0)) return walk;
  return withGoldPublications(walk, [goldGainPublication({ sequence: 0, readings })]);
}

/** A Pool of Purging sale, read from the branches it settles from. */
export function withPoolSaleGold(
  context: ChronologyWalkContext,
  state: ChronologyWalkState,
  event: HistoryEvent,
  sold: { readonly traitKey: string; readonly owner: SemanticAddress },
): ChronologyWalkState {
  const room = authoredRoom(context, event.origin);
  if (room === undefined || state.branches.length === 0) return state;
  const readings = state.branches.map((branch) => {
    const equipped = branch.state.traitHistory.equippedTraits[sold.traitKey];
    const infusion = context.catalog.traits.byKey[sold.traitKey]?.unityTrait === true;
    const rarity =
      equipped?.rarity === undefined ? 'unranked' : infusion ? 'infusion' : equipped.rarity;
    return {
      gain: Object.freeze({
        kind: 'poolSale' as const,
        traitKey: sold.traitKey,
        rarity: rarity as Extract<GoldGain, { kind: 'poolSale' }>['rarity'],
        level: equipped?.level ?? 1,
      }),
      multipliers: goldMultipliers(context.catalog, branch.state),
    };
  });
  return withGoldPublications(state, [
    goldGainPublication({
      sequence: event.sequence,
      room: room.origin,
      owner: sold.owner,
      readings,
    }),
  ]);
}

/**
 * Gold the walked event settled, read from the branches it received and the
 * branches it produced: new reward and trait-history entries, held loans,
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
  if (event.kind === 'encounterStarted' && room !== undefined)
    state = Object.freeze({
      ...state,
      goldEncounterKeys: new Map(state.goldEncounterKeys).set(
        `${semanticAddressKey(room.origin)}::${event.phaseKey}`,
        event.encounterKey,
      ),
    });
  const enteredRoom = context.rooms.get(semanticAddressKey(event.origin));
  if (event.kind === 'roomEntered' && enteredRoom?.origin.kind === 'occurrence')
    state = withGoldPublications(state, [
      Object.freeze({
        kind: 'roomEntered' as const,
        sequence: event.sequence,
        room: enteredRoom.origin,
      }),
    ]);
  const doorsOpenHere = room !== undefined && doorsOpenAt(room, event);
  const doorsOpen: readonly GoldEventPublication[] = doorsOpenHere
    ? [Object.freeze({ kind: 'doorsOpen' as const, sequence: event.sequence, room: roomOrigin! })]
    : [];
  if (received.branches.length === 0 || next.branches.length === 0)
    return withGoldPublications(state, doorsOpen);

  const receivedStates = received.branches.map((branch) => branch.state);
  const before = receivedStates.map((received) => goldMultipliers(catalog, received));
  const receivedEvents = new Set(received.branches.flatMap((branch) => branch.events));
  const receivedEvaluations = new Set(
    received.branches.flatMap((branch) => branch.traitEvaluations ?? []),
  );
  const detected = new Map<string, Detected>();
  const detect = (
    branchIndex: number,
    key: string,
    owner: SemanticAddress | undefined,
    detection: Detection,
  ) => {
    const entry = detected.get(key) ?? { ...(owner === undefined ? {} : { owner }), byBranch: [] };
    entry.byBranch[branchIndex] = detection;
    detected.set(key, entry);
  };
  const distinctPriors = <T>(read: (received: SimulationState) => T): readonly T[] => {
    const priors = new Map<string, T>();
    for (const received of receivedStates) {
      const value = read(received);
      priors.set(JSON.stringify(value ?? null), value);
    }
    return [...priors.values()];
  };
  // Held loans, keepsakes and Arcana are compared with the received branches, which must agree.
  const priorLoans = distinctPriors((received) => [...heldLoans(catalog, received)]);
  const priorKeepsakes = distinctPriors((received) => received.keepsakes.currentKey);
  const priorArcana = distinctPriors((received) => arcanaGold(catalog, received));
  const divergentPrior = new Set(
    [
      ['loan', priorLoans.length],
      ['keepsake', priorKeepsakes.length],
      ['arcana', priorArcana.length],
    ].flatMap(([family, count]) => ((count as number) > 1 ? [family as string] : [])),
  );

  next.branches.forEach((branch: RewardBranchState, index) => {
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
          index,
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
      if (declaration?.goldGrant !== undefined) {
        const producer =
          catalog.rewards.producerLifecycles.byKey[rewardEvent.source.producerLifecycleKey];
        detect(index, key, owner, {
          gain: {
            kind: 'moneyPickup',
            gold: declaration.goldGrant,
            npcDrop: producer?.resourceBonusExempt === true,
          },
        });
      } else if (gameName === 'Currency') {
        const gold = currencyGold(
          catalog,
          after,
          rewardEvent.source.producerLifecycleKey,
          rewardEvent.settlement?.entry.entryKey,
        );
        detect(
          index,
          key,
          owner,
          gold === undefined
            ? {
                unpriced: { kind: 'contractFailure', detail: 'a Currency pickup declares no gold' },
              }
            : { gain: { kind: 'currencyPickup', gold } },
        );
      }
    }
    for (const evaluation of branch.traitEvaluations ?? []) {
      if (receivedEvaluations.has(evaluation) || evaluation.offer.kind !== 'fallbackGold') continue;
      detect(index, `fallbackGold:${semanticAddressKey(evaluation.address)}`, evaluation.address, {
        gain: { kind: 'fallbackGold', gold: catalog.gold.fallbackGold },
        multipliers: goldMultipliers(catalog, evaluation.state),
      });
    }
    const loans = heldLoans(catalog, after);
    {
      const held = new Map(priorLoans[0]);
      for (const [traitKey, loan] of loans) {
        const was = held.get(traitKey);
        const key = `loan:${traitKey}`;
        if (was === undefined)
          detect(index, key, undefined, {
            gain: {
              kind: 'loanTake',
              traitKey,
              returnGold: loanReturn(catalog, traitKey, loan.rarity),
            },
          });
        else if (!was.paid && loan.paid)
          detect(index, key, undefined, { gain: { kind: 'loanPayback', traitKey } });
        else if (!loan.paid && was.rarity !== loan.rarity)
          detect(index, key, undefined, {
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
    if (current !== null && current !== priorKeepsakes[0]) {
      const gold = keepsakeGold(catalog, current, after);
      if (gold !== undefined)
        detect(index, `keepsake:${current}`, undefined, { gain: { kind: 'keepsakeGold', gold } });
    }
    const raised = arcanaGold(catalog, after) - (priorArcana[0] ?? 0);
    if (raised > 0)
      detect(index, 'arcana', undefined, { gain: { kind: 'arcanaGold', gold: raised } });
    if (room !== undefined) {
      const biome = createBiomeAddress(room.origin.routeKey, room.origin.biomeKey);
      if (event.kind === 'wellPurchase' && room.stygianWell !== undefined) {
        const itemKey = stygianWellGenerationItemKey(wellOccurrenceView(room), event.generationKey);
        const option = catalog.rewards.shops.byKey.RoomShop?.groups.values
          .flatMap((group) => group.options.values)
          .find((candidate) => candidate.key === itemKey);
        if (itemKey !== undefined && itemKey !== null && option?.goldPayout !== undefined)
          detect(index, `midas:${event.generationKey}`, undefined, {
            gain: { kind: 'midasPayout', itemKey },
          });
      }
      if (event.kind === 'encounterCompleted' && event.execution === 'normal') {
        const encounterKey = state.goldEncounterKeys.get(
          `${semanticAddressKey(room.origin)}::${event.phaseKey}`,
        );
        const bet =
          encounterKey === undefined
            ? undefined
            : catalog.encounterDefinitions.byKey[encounterKey]?.goldBet;
        if (bet !== undefined)
          detect(
            index,
            `nemesisBet:${event.phaseKey}`,
            createEncounterPhaseAddress(
              biome,
              { kind: 'occurrence', occurrenceId: room.occurrenceId },
              event.phaseKey,
            ),
            { gain: { kind: 'nemesisBet', maxBet: bet.maxBet } },
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
            index,
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
  });

  const publications: GoldEventPublication[] = [];
  for (const [key, entry] of detected) {
    const detections = next.branches.map((_, index) => entry.byBranch[index]);
    const common = {
      sequence: event.sequence,
      ...(roomOrigin === undefined ? {} : { room: roomOrigin }),
      ...(entry.owner === undefined ? {} : { owner: entry.owner }),
    };
    const family = key.split(':')[0]!;
    const missing =
      detections.some((detection) => detection === undefined) || divergentPrior.has(family);
    const unpriced = detections.find(
      (detection): detection is { readonly unpriced: PurchasePriceUnpriced } =>
        detection !== undefined && 'unpriced' in detection,
    );
    if (missing || unpriced !== undefined) {
      publications.push(
        goldGainPublication({
          ...common,
          readings: [],
          unpriced: missing
            ? { kind: 'contractFailure', detail: `${key} settled in only some reached branches` }
            : unpriced!.unpriced,
        }),
      );
      continue;
    }
    publications.push(
      goldGainPublication({
        ...common,
        readings: detections.flatMap((detection) => {
          const gained = detection as Extract<Detection, { readonly gain: GoldGain }>;
          return 'multipliers' in gained
            ? [{ gain: gained.gain, multipliers: gained.multipliers }]
            : before.map((multipliers) => ({ gain: gained.gain, multipliers }));
        }),
      }),
    );
  }
  return withGoldPublications(state, [...publications, ...doorsOpen]);
}
