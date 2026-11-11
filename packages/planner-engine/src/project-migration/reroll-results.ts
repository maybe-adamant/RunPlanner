import type { Catalog } from '../catalog-schema';
import { unresolvedRerolledReward } from '../authored-project/rerolled-acquisition';
import type { RoomOccurrence } from '../authored-project/model';
import type { RerolledRewardOwner } from '../authored-project/rerolls';
import { resolveRoutePosition } from '../authored-project/route-context';
import type { ResolvedRewardOffer } from '../reward-kernel/model';

type RawRecord = Record<string, unknown>;

function rawRecord(value: unknown): RawRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as RawRecord)
    : undefined;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, entry: unknown) =>
    entry !== null && typeof entry === 'object' && !Array.isArray(entry)
      ? Object.fromEntries(
          Object.entries(entry as Record<string, unknown>).sort(([left], [right]) =>
            left.localeCompare(right),
          ),
        )
      : entry,
  );
}

/** Where a rerolled owner's record lives: a door's room, one of its cages, or a wheel offer. */
type OwnerPlace =
  | { readonly kind: 'incoming'; readonly occurrenceId: string }
  | { readonly kind: 'cage'; readonly occurrenceId: string; readonly slotKey: string }
  | {
      readonly kind: 'wheelOffer';
      readonly occurrenceId: string;
      readonly wheelKey: string;
      readonly offerKey: string;
    };

function placeKey(place: OwnerPlace): string {
  switch (place.kind) {
    case 'incoming':
      return `incoming ${place.occurrenceId}`;
    case 'cage':
      return `cage ${place.occurrenceId} ${place.slotKey}`;
    case 'wheelOffer':
      return `wheel ${place.occurrenceId} ${place.wheelKey} ${place.offerKey}`;
  }
}

interface Press {
  readonly rerollId: string;
  readonly reward: unknown;
  /** A Hub press after its slot's visit redraws nothing that visit saw. */
  readonly effective: boolean;
}

function rewardOwner(place: OwnerPlace): RerolledRewardOwner {
  const address = { routeKey: '', biomeKey: '', occurrenceId: place.occurrenceId };
  switch (place.kind) {
    case 'incoming':
      return { kind: 'incomingReward', ...address } as unknown as RerolledRewardOwner;
    case 'cage':
      return {
        kind: 'localReward',
        ...address,
        groupKey: 'cages',
        slotKey: place.slotKey,
      } as unknown as RerolledRewardOwner;
    case 'wheelOffer':
      return {
        kind: 'rewardWheelOffer',
        ...address,
        wheelKey: place.wheelKey,
        offerKey: place.offerKey,
      } as unknown as RerolledRewardOwner;
  }
}

/** The stored record at a place, read from a mutable occurrence copy. */
function recordAt(occurrence: RawRecord, place: OwnerPlace): unknown {
  const state = rawRecord(occurrence.state);
  switch (place.kind) {
    case 'incoming':
      return occurrence.rerolledIncomingReward;
    case 'cage':
      return rawRecord(state?.rerolledCages)?.[place.slotKey];
    case 'wheelOffer':
      return rawRecord(rawRecord(rawRecord(state?.wheels)?.[place.wheelKey])?.rerolledOffers)?.[
        place.offerKey
      ];
  }
}

/** Every stored record of an occurrence, by place. */
function recordsOf(occurrence: RawRecord): OwnerPlace[] {
  const occurrenceId = String(occurrence.occurrenceId);
  const places: OwnerPlace[] = [];
  if (Object.hasOwn(occurrence, 'rerolledIncomingReward'))
    places.push({ kind: 'incoming', occurrenceId });
  const state = rawRecord(occurrence.state);
  for (const slotKey of Object.keys(rawRecord(state?.rerolledCages) ?? {}))
    places.push({ kind: 'cage', occurrenceId, slotKey });
  for (const [wheelKey, wheel] of Object.entries(rawRecord(state?.wheels) ?? {}))
    for (const offerKey of Object.keys(rawRecord(rawRecord(wheel)?.rerolledOffers) ?? {}))
      places.push({ kind: 'wheelOffer', occurrenceId, wheelKey, offerKey });
  return places;
}

/** The occurrence with the record at this place set, or removed when undefined. */
function withRecordAt(occurrence: RawRecord, place: OwnerPlace, record: unknown): RawRecord {
  const set = (container: RawRecord | undefined, key: string): RawRecord | undefined => {
    const next = { ...container };
    if (record === undefined) delete next[key];
    else next[key] = record;
    return Object.keys(next).length === 0 ? undefined : next;
  };
  const without = (container: RawRecord, key: string, value: RawRecord | undefined) => {
    const next = { ...container };
    if (value === undefined) delete next[key];
    else next[key] = value;
    return next;
  };
  if (place.kind === 'incoming') {
    const next = { ...occurrence };
    if (record === undefined) delete next.rerolledIncomingReward;
    else next.rerolledIncomingReward = record;
    return next;
  }
  const state = rawRecord(occurrence.state) ?? {};
  if (place.kind === 'cage')
    return {
      ...occurrence,
      state: without(state, 'rerolledCages', set(rawRecord(state.rerolledCages), place.slotKey)),
    };
  const wheels = rawRecord(state.wheels) ?? {};
  const wheel = rawRecord(wheels[place.wheelKey]) ?? {};
  return {
    ...occurrence,
    state: {
      ...state,
      wheels: {
        ...wheels,
        [place.wheelKey]: without(
          wheel,
          'rerolledOffers',
          set(rawRecord(wheel.rerolledOffers), place.offerKey),
        ),
      },
    },
  };
}

/** Whether a stored row picks up the reward at this place, so its content names its item. */
function picksUp(action: RawRecord, place: OwnerPlace): boolean {
  switch (place.kind) {
    case 'incoming':
      return action.kind === 'interactIncomingReward';
    case 'cage':
      return (
        action.kind === 'interactLocalReward' &&
        action.groupKey === 'cages' &&
        action.slotKey === place.slotKey
      );
    case 'wheelOffer':
      return action.kind === 'interactWheelReward' && action.wheelKey === place.wheelKey;
  }
}

function withoutPickupContent(occurrence: RawRecord, place: OwnerPlace): RawRecord {
  const roomActions = rawRecord(occurrence.roomActions);
  const order = roomActions?.order;
  if (roomActions === undefined || !Array.isArray(order)) return occurrence;
  return {
    ...occurrence,
    roomActions: {
      ...roomActions,
      order: order.map((entry) => {
        const action = rawRecord(entry);
        if (action === undefined || !picksUp(action, place) || !Object.hasOwn(action, 'content'))
          return entry;
        const { content: _content, ...rest } = action;
        void _content;
        return rest;
      }),
    },
  };
}

/** A room press's place, or none when its door, its room or its cage is gone. */
function roomPressPlace(
  source: RawRecord,
  target: RawRecord,
  occurrences: ReadonlyMap<string, RawRecord>,
  decisions: readonly unknown[],
): OwnerPlace | undefined {
  const sourceId = String(source.occurrenceId);
  if (target.kind === 'wheelOffer') {
    const wheel = rawRecord(rawRecord(rawRecord(source.state)?.wheels)?.[String(target.wheelKey)]);
    return wheel !== undefined &&
      Object.hasOwn(rawRecord(wheel.offers) ?? {}, String(target.offerKey))
      ? {
          kind: 'wheelOffer',
          occurrenceId: sourceId,
          wheelKey: String(target.wheelKey),
          offerKey: String(target.offerKey),
        }
      : undefined;
  }
  const occurrenceId = String(target.occurrenceId);
  const door = decisions.some((entry) => {
    const decision = rawRecord(entry);
    const from = rawRecord(decision?.source);
    const targets = rawRecord(decision?.normal)?.targets;
    return (
      decision?.kind === 'exit' &&
      from?.kind === 'occurrence' &&
      from.occurrenceId === sourceId &&
      Array.isArray(targets) &&
      targets.some(
        (candidate) =>
          rawRecord(candidate)?.exitKey === target.exitKey &&
          rawRecord(candidate)?.occurrenceId === occurrenceId,
      )
    );
  });
  const room = occurrences.get(occurrenceId);
  if (!door || room === undefined) return undefined;
  if (target.kind === 'door') return { kind: 'incoming', occurrenceId };
  const state = rawRecord(room.state);
  const slotKey = String(target.slotKey);
  return state?.kind === 'fieldsCombat' && Object.hasOwn(rawRecord(state.cages) ?? {}, slotKey)
    ? { kind: 'cage', occurrenceId, slotKey }
    : undefined;
}

/** Whether the biome still holds any row or record in the earlier reroll shape. */
function heldInEarlierShape(occurrences: readonly RawRecord[], decisions: readonly unknown[]) {
  const pressHolds = (action: RawRecord | undefined) =>
    action?.kind === 'reroll' && Object.hasOwn(action, 'reward');
  return (
    occurrences.some(
      (occurrence) =>
        (Array.isArray(rawRecord(occurrence.roomActions)?.order) &&
          (rawRecord(occurrence.roomActions)!.order as unknown[]).some((entry) =>
            pressHolds(rawRecord(entry)),
          )) ||
        recordsOf(occurrence).some(
          (place) => !Object.hasOwn(rawRecord(recordAt(occurrence, place)) ?? {}, 'results'),
        ),
    ) ||
    decisions.some((entry) => {
      const actions = rawRecord(entry)?.actions;
      return Array.isArray(actions) && actions.some((action) => pressHolds(rawRecord(action)));
    })
  );
}

function moveBiome(
  catalog: Catalog,
  route: { readonly routeKey: string; readonly itineraryBiomeKeys: readonly string[] },
  biome: unknown,
): unknown {
  const record = rawRecord(biome);
  const topology = rawRecord(record?.topology);
  const rawOccurrences = topology?.occurrences;
  const decisions = Array.isArray(topology?.decisions) ? (topology.decisions as unknown[]) : [];
  if (record === undefined || topology === undefined || !Array.isArray(rawOccurrences))
    return biome;
  const occurrenceList: RawRecord[] = rawOccurrences.flatMap((entry: unknown) => {
    const occurrence = rawRecord(entry);
    return occurrence === undefined ? [] : [occurrence];
  });
  if (!heldInEarlierShape(occurrenceList, decisions)) return biome;
  const occurrences = new Map(
    occurrenceList.map((occurrence) => [String(occurrence.occurrenceId), occurrence]),
  );
  const presses = new Map<string, { place: OwnerPlace; presses: Press[] }>();
  const press = (place: OwnerPlace, entry: Press) => {
    const key = placeKey(place);
    const owner = presses.get(key) ?? { place, presses: [] };
    owner.presses.push(entry);
    presses.set(key, owner);
  };
  // Each room press loses its reward and its cage slot; a press whose target is gone goes (OD5).
  for (const source of occurrenceList) {
    const roomActions = rawRecord(source.roomActions);
    const order = roomActions?.order;
    if (roomActions === undefined || !Array.isArray(order)) continue;
    const kept = order.flatMap((entry) => {
      const action = rawRecord(entry);
      const target = rawRecord(action?.target);
      if (action?.kind !== 'reroll' || !Object.hasOwn(action, 'reward') || target === undefined)
        return [entry];
      const place = roomPressPlace(source, target, occurrences, decisions);
      if (place === undefined) return [];
      press(place, { rerollId: String(action.rerollId), reward: action.reward, effective: true });
      const { reward: _reward, ...rest } = action;
      void _reward;
      const { slotKey: _slotKey, ...thinTarget } = target;
      void _slotKey;
      return [{ ...rest, target: thinTarget }];
    });
    occurrences.set(String(source.occurrenceId), {
      ...source,
      roomActions: { ...roomActions, order: kept },
    });
  }
  // Each Hub press loses its reward; a press of a closed slot has no door to redraw (OD5).
  const nextDecisions = decisions.map((entry) => {
    const decision = rawRecord(entry);
    const actions = decision?.actions;
    if (decision?.kind !== 'hub' || !Array.isArray(actions)) return entry;
    const openTargets = Array.isArray(decision.openTargets) ? decision.openTargets : [];
    const entered = new Set<string>();
    return {
      ...decision,
      actions: actions.flatMap((value) => {
        const action = rawRecord(value);
        if (action?.kind === 'roomVisit') entered.add(String(action.hubSlotKey));
        if (action?.kind !== 'reroll' || !Object.hasOwn(action, 'reward')) return [value];
        const slot = openTargets
          .map(rawRecord)
          .find((target) => target?.hubSlotKey === action.hubSlotKey);
        if (slot === undefined) return [];
        press(
          { kind: 'incoming', occurrenceId: String(slot.occurrenceId) },
          {
            rerollId: String(action.rerollId),
            reward: action.reward,
            effective: !entered.has(String(action.hubSlotKey)),
          },
        );
        const { reward: _reward, ...rest } = action;
        void _reward;
        return [rest];
      }),
    };
  });
  let routePosition: ReturnType<typeof resolveRoutePosition> | undefined;
  try {
    routePosition = resolveRoutePosition(catalog, route, String(record.biomeKey));
  } catch {
    routePosition = undefined;
  }
  // Every held record: one with no press goes (OD4); the rest take their presses' results.
  const places = new Map<string, OwnerPlace>();
  for (const occurrence of occurrences.values())
    for (const place of recordsOf(occurrence)) places.set(placeKey(place), place);
  for (const { place } of presses.values()) places.set(placeKey(place), place);
  for (const [key, place] of places) {
    const occurrence = occurrences.get(place.occurrenceId);
    if (occurrence === undefined) continue;
    const stored = rawRecord(recordAt(occurrence, place));
    // Already in the current shape.
    if (stored !== undefined && Object.hasOwn(stored, 'results')) continue;
    const owned = presses.get(key)?.presses ?? [];
    if (owned.length === 0) {
      occurrences.set(place.occurrenceId, withRecordAt(occurrence, place, undefined));
      continue;
    }
    const results: Record<string, unknown> = Object.fromEntries(
      owned.map(({ rerollId, reward }) => [rerollId, reward]),
    );
    const effectivePress = owned.filter((entry) => entry.effective).at(-1);
    const last = (effectivePress ?? owned.at(-1))!.rerollId;
    // The unresolved item the owner acquires from this result; none when it cannot draw it.
    const drawn = (offer: unknown) => {
      if (routePosition === undefined || effectivePress === undefined) return undefined;
      try {
        return unresolvedRerolledReward(
          catalog,
          routePosition,
          occurrence as unknown as RoomOccurrence,
          rewardOwner(place),
          offer as ResolvedRewardOffer,
        );
      } catch {
        return undefined;
      }
    };
    let next: RawRecord;
    let adopted = false;
    if (stored === undefined) {
      // A press with no entered reward: its item's outcomes start unresolved.
      const unresolved = drawn(results[last]);
      const acquisition =
        unresolved === undefined
          ? undefined
          : (({ offer: _offer, ...rest }) => {
              void _offer;
              return JSON.parse(JSON.stringify(rest)) as RawRecord;
            })(unresolved);
      next = { results, pressId: last, ...(acquisition === undefined ? {} : { acquisition }) };
    } else {
      const { offer, pressId, ...acquisition } = stored;
      const recorded =
        typeof pressId === 'string' && Object.hasOwn(results, pressId) ? pressId : last;
      // OD3: an entered reward the press did not draw becomes that press's result.
      if (canonicalJson(results[recorded]) !== canonicalJson(offer)) {
        results[recorded] = offer;
        adopted = true;
      }
      // With no effective press the owner acquires its first draw, and a reward the
      // owner cannot draw holds none: the outcomes go.
      next = {
        results,
        pressId: recorded,
        ...(drawn(results[recorded]) === undefined ? {} : { acquisition }),
      };
    }
    let updated = withRecordAt(occurrence, place, next);
    // An adopted result is another item: its pickup rows record it afresh.
    if (adopted) updated = withoutPickupContent(updated, place);
    occurrences.set(place.occurrenceId, updated);
  }
  return {
    ...record,
    topology: {
      ...topology,
      occurrences: rawOccurrences.map((entry) => {
        const id = rawRecord(entry)?.occurrenceId;
        return id === undefined ? entry : (occurrences.get(String(id)) ?? entry);
      }),
      ...(Array.isArray(topology.decisions) ? { decisions: nextDecisions } : {}),
    },
  };
}

/**
 * Schema 103 keeps each door, cage, wheel and Hub press's redraw on the item
 * it redraws, keyed by the press, with the outcomes of the item the owner
 * acquires. A press loses its reward and a cage press its slot. A rerolled
 * reward takes its presses' results and keeps its outcomes on the press it
 * recorded, else on the owner's last press; an entered reward that press did
 * not draw becomes its result (OD3), and its pickup rows are stamped again. A
 * press with no entered reward starts unresolved; a rerolled reward with no
 * press (OD4) and a press whose door, room, cage or Hub slot is gone (OD5) go,
 * as do the outcomes of a reward its owner cannot draw or whose presses are
 * all Hub presses after their slot's visit.
 * A plan already in that shape passes unchanged.
 */
export function moveRerollResultsOntoItems(raw: unknown, catalog: Catalog): unknown {
  const document = rawRecord(raw);
  const route = rawRecord(document?.route);
  const biomes = route?.biomes;
  if (
    document === undefined ||
    route === undefined ||
    !Array.isArray(biomes) ||
    typeof route.routeKey !== 'string'
  )
    return raw;
  const itinerary = Array.isArray(route.itineraryBiomeKeys)
    ? (route.itineraryBiomeKeys as string[])
    : [];
  return {
    ...document,
    route: {
      ...route,
      biomes: biomes.map((biome) =>
        moveBiome(
          catalog,
          { routeKey: route.routeKey as string, itineraryBiomeKeys: itinerary },
          biome,
        ),
      ),
    },
  };
}
