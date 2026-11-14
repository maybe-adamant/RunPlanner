import type { ResolvedRewardOffer } from '../reward-kernel/model';
import {
  createBiomeAddress,
  createHubFountainAddress,
  createHubRerollAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createRewardWheelOfferAddress,
  semanticAddressKey,
  type BiomeAddress,
  type HubDecisionAddress,
  type HubFountainAddress,
  type HubRerollAddress,
  type IncomingRewardAddress,
  type LocalRewardAddress,
  type OccurrenceAddress,
  type RewardWheelAddress,
  type RewardWheelOfferAddress,
  type SemanticAddress,
} from './addresses';
import type {
  AuthoredRewardState,
  BiomeTopology,
  HubDecision,
  HubRerollAction,
  OccurrenceId,
  ProjectDocument,
  RerolledRewardState,
  ResolvedRerollTarget,
  RerollRoomAction,
  RoomOccurrence,
} from './model';

/** A reroll target's reward owner: a door's room, a cage slot or a wheel offer. */
export type RerolledRewardOwner =
  IncomingRewardAddress | LocalRewardAddress | RewardWheelOfferAddress;

export const FIELDS_CAGE_GROUP_KEY = 'cages';

/**
 * Where a new reroll press is appended: after a room's doors unlock (its
 * doors and their cages), among one ship wheel's offers before its use, or at
 * the end of one Hub stay.
 */
export type RerollSurface =
  | { readonly kind: 'doors'; readonly occurrence: OccurrenceAddress }
  | { readonly kind: 'rewardWheel'; readonly wheel: RewardWheelAddress }
  | {
      readonly kind: 'hubStay';
      readonly hub: HubDecisionAddress;
      /** Room visits returned before the stay; 0 is the Hub's first entry. */
      readonly precedingVisitCount: number;
    };

/** A Hub board door a press names by its slot. */
export interface HubSlotRerollTarget {
  readonly kind: 'hubSlot';
  readonly hubSlotKey: string;
}

/** What one press redraws: a room's door, cage or wheel offer, or a Hub board door. */
export type RerollPressTarget = ResolvedRerollTarget | HubSlotRerollTarget;

/** The room, wheel or Hub that owns a surface. */
export function rerollSurfaceOwner(
  surface: RerollSurface,
): OccurrenceAddress | RewardWheelAddress | HubDecisionAddress {
  switch (surface.kind) {
    case 'doors':
      return surface.occurrence;
    case 'rewardWheel':
      return surface.wheel;
    case 'hubStay':
      return surface.hub;
  }
}

export function rerollSurfaceKey(surface: RerollSurface): string {
  switch (surface.kind) {
    case 'doors':
      return `doors ${semanticAddressKey(surface.occurrence)}`;
    case 'rewardWheel':
      return `rewardWheel ${semanticAddressKey(surface.wheel)}`;
    case 'hubStay':
      return `hubStay ${semanticAddressKey(surface.hub)} ${surface.precedingVisitCount}`;
  }
}

/** One action a Hub stay holds between two visits, at its index in the Hub's actions. */
export type HubStayRow =
  | {
      readonly kind: 'reroll';
      readonly address: HubRerollAddress;
      readonly actionIndex: number;
      readonly action: HubRerollAction;
    }
  | {
      readonly kind: 'useFountain';
      readonly address: HubFountainAddress;
      readonly actionIndex: number;
    };

/** One Hub stay's presses and fountain use in authored order. */
export interface HubStayRows {
  /** Room visits returned before the stay; 0 is the Hub's first entry. */
  readonly precedingVisitCount: number;
  readonly rows: readonly HubStayRow[];
  /** Where an action added at the end of the stay goes: before its next visit. */
  readonly appendIndex: number;
}

function hubStayAppendIndex(hub: Pick<HubDecision, 'actions'>, precedingVisitCount: number) {
  const visits = hub.actions.flatMap((action, index) =>
    action.kind === 'roomVisit' ? [index] : [],
  );
  return visits[precedingVisitCount] ?? hub.actions.length;
}

/**
 * Every stay the Hub's authored visits delimit, from its first entry to the
 * return from its last authored visit, each with its rows in authored order.
 * The fountain use may stand anywhere among a stay's presses.
 */
export function hubStayRows(
  owner: HubDecisionAddress,
  hub: Pick<HubDecision, 'actions'>,
): readonly HubStayRows[] {
  const biome = createBiomeAddress(owner.routeKey, owner.biomeKey);
  const stays: HubStayRow[][] = [[]];
  hub.actions.forEach((action, actionIndex) => {
    if (action.kind === 'roomVisit') {
      stays.push([]);
      return;
    }
    stays.at(-1)!.push(
      action.kind === 'reroll'
        ? Object.freeze({
            kind: 'reroll' as const,
            address: createHubRerollAddress(biome, owner.hubKey, action.rerollId),
            actionIndex,
            action,
          })
        : Object.freeze({
            kind: 'useFountain' as const,
            address: createHubFountainAddress(biome, owner.hubKey),
            actionIndex,
          }),
    );
  });
  return Object.freeze(
    stays.map((rows, precedingVisitCount) =>
      Object.freeze({
        precedingVisitCount,
        rows: Object.freeze(rows),
        appendIndex: hubStayAppendIndex(hub, precedingVisitCount),
      }),
    ),
  );
}

/**
 * The index of `InsertReroll` or `InsertHubReroll` that appends a press to the
 * surface: the end of the room's action order, after the wheel's last press
 * (else before its use), or before the Hub's next room visit. Undefined when
 * the surface's room or Hub is not authored.
 */
export function rerollAppendIndex(
  document: ProjectDocument,
  surface: RerollSurface,
): number | undefined {
  const address = rerollSurfaceOwner(surface);
  const topology = document.route.biomes.find(
    (biome) => biome.biomeKey === address.biomeKey,
  )?.topology;
  if (topology === undefined || topology === null) return undefined;
  if (surface.kind === 'hubStay') {
    const hub = topology.decisions.find(
      (decision): decision is HubDecision =>
        decision.kind === 'hub' && decision.hubKey === surface.hub.hubKey,
    );
    if (hub === undefined) return undefined;
    return hubStayAppendIndex(hub, surface.precedingVisitCount);
  }
  const occurrenceId =
    surface.kind === 'doors' ? surface.occurrence.occurrenceId : surface.wheel.occurrenceId;
  const order = topology.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId)
    ?.roomActions.order;
  if (order === undefined) return undefined;
  if (surface.kind === 'doors') return order.length;
  const wheelKey = surface.wheel.wheelKey;
  const lastPress = order.findLastIndex(
    (action) =>
      action.kind === 'reroll' &&
      action.target.kind === 'wheelOffer' &&
      action.target.wheelKey === wheelKey,
  );
  if (lastPress >= 0) return lastPress + 1;
  const use = order.findIndex(
    (action) => action.kind === 'chooseRewardWheel' && action.wheelKey === wheelKey,
  );
  return use < 0 ? order.length : use;
}

type RerollTopology = Pick<BiomeTopology, 'decisions' | 'occurrences'>;

/** One press of a room or of a Hub. */
export type RerollPress = RerollRoomAction | HubRerollAction;

function occurrenceIn(
  topology: Pick<BiomeTopology, 'occurrences'>,
  occurrenceId: OccurrenceId,
): RoomOccurrence | undefined {
  return topology.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
}

/** The cage slot of a Fields room whose redraws hold this press's result. */
export function rerolledCageSlotOf(
  occurrence: RoomOccurrence | undefined,
  rerollId: string,
): string | undefined {
  if (occurrence?.state.kind !== 'fieldsCombat') return undefined;
  return Object.entries(occurrence.state.rerolledCages ?? {}).find(([, record]) =>
    Object.hasOwn(record.results, rerollId),
  )?.[0];
}

/**
 * A room press's target with the cage slot it redrew, read from where the
 * target holds its result; undefined for a cage press no cage holds.
 */
export function resolveRerollTarget(
  topology: Pick<BiomeTopology, 'occurrences'>,
  press: RerollRoomAction,
): ResolvedRerollTarget | undefined {
  const target = press.target;
  if (target.kind !== 'cage') return target;
  const slotKey = rerolledCageSlotOf(occurrenceIn(topology, target.occurrenceId), press.rerollId);
  return slotKey === undefined ? undefined : Object.freeze({ ...target, slotKey });
}

/** Whether the source room's exit holds this door into its room. */
export function sourceHasDoor(
  topology: Pick<BiomeTopology, 'decisions'>,
  sourceOccurrenceId: OccurrenceId,
  door: { readonly exitKey: string; readonly occurrenceId: OccurrenceId },
): boolean {
  const exit = topology.decisions.find(
    (decision) =>
      decision.kind === 'exit' &&
      decision.source.kind === 'occurrence' &&
      decision.source.occurrenceId === sourceOccurrenceId,
  );
  return (
    exit?.kind === 'exit' &&
    exit.normal.targets.some(
      (candidate) =>
        candidate.exitKey === door.exitKey && candidate.occurrenceId === door.occurrenceId,
    )
  );
}

/**
 * What a door or cage reroll's target lacks in the authored topology: the
 * source's door into that room, or that room's cage slot holding the press's
 * result. A wheel offer is the source room's own.
 */
export function missingRerollTarget(
  topology: RerollTopology,
  sourceOccurrenceId: OccurrenceId,
  press: RerollRoomAction,
): 'door' | 'cage' | undefined {
  const target = press.target;
  if (target.kind === 'wheelOffer') return undefined;
  if (!sourceHasDoor(topology, sourceOccurrenceId, target)) return 'door';
  if (target.kind === 'door') return undefined;
  const destination = occurrenceIn(topology, target.occurrenceId);
  const slotKey = rerolledCageSlotOf(destination, press.rerollId);
  return destination?.state.kind === 'fieldsCombat' &&
    slotKey !== undefined &&
    Object.hasOwn(destination.state.cages, slotKey)
    ? undefined
    : 'cage';
}

/** The reward owner a room reroll of this target redraws. */
export function rerollTargetOwner(
  biome: BiomeAddress,
  sourceOccurrenceId: OccurrenceId,
  target: ResolvedRerollTarget,
): RerolledRewardOwner {
  switch (target.kind) {
    case 'door':
      return createIncomingRewardAddress(biome, target.occurrenceId);
    case 'cage':
      return createLocalRewardAddress(
        biome,
        target.occurrenceId,
        FIELDS_CAGE_GROUP_KEY,
        target.slotKey,
      );
    case 'wheelOffer':
      return createRewardWheelOfferAddress(
        biome,
        sourceOccurrenceId,
        target.wheelKey,
        target.offerKey,
      );
  }
}

/** The owner a room press redraws, or none when no cage holds a cage press's result. */
export function roomRerollOwner(
  biome: BiomeAddress,
  topology: Pick<BiomeTopology, 'occurrences'>,
  sourceOccurrenceId: OccurrenceId,
  press: RerollRoomAction,
): RerolledRewardOwner | undefined {
  const target = resolveRerollTarget(topology, press);
  return target === undefined ? undefined : rerollTargetOwner(biome, sourceOccurrenceId, target);
}

/** The board-door room a Hub press redraws, or none while its slot is closed. */
export function hubRerollOwner(
  biome: BiomeAddress,
  hub: Pick<HubDecision, 'openTargets'>,
  press: HubRerollAction,
): IncomingRewardAddress | undefined {
  const target = hub.openTargets.find((candidate) => candidate.hubSlotKey === press.hubSlotKey);
  return target === undefined ? undefined : createIncomingRewardAddress(biome, target.occurrenceId);
}

/**
 * The reward a press drew, held by its owner; undefined while its target holds
 * none or the owner has not set it.
 */
export function rerollResult(
  topology: Pick<BiomeTopology, 'occurrences'>,
  owner: RerolledRewardOwner | undefined,
  rerollId: string,
): ResolvedRewardOffer | undefined {
  if (owner === undefined) return undefined;
  const occurrence = occurrenceIn(topology, owner.occurrenceId);
  return occurrence === undefined
    ? undefined
    : (rerolledRecordOf(occurrence, owner)?.results[rerollId] ?? undefined);
}

/** Whether a press's target holds its result slot, set or not. */
export function rerollPressHeld(
  topology: Pick<BiomeTopology, 'occurrences'>,
  owner: RerolledRewardOwner | undefined,
  rerollId: string,
): boolean {
  if (owner === undefined) return false;
  const occurrence = occurrenceIn(topology, owner.occurrenceId);
  const results =
    occurrence === undefined ? undefined : rerolledRecordOf(occurrence, owner)?.results;
  return results !== undefined && Object.hasOwn(results, rerollId);
}

/** One room press as the walk reads it: the target it redrew and the reward it drew. */
export interface ResolvedRerollPress {
  readonly target: ResolvedRerollTarget;
  /** Absent while the owner has not set the press's result yet. */
  readonly result?: ResolvedRewardOffer;
}

/** A room's presses whose target holds their result, set or not, by reroll id. */
export function resolvedRoomRerollPresses(
  biome: BiomeAddress,
  topology: Pick<BiomeTopology, 'occurrences'>,
  source: RoomOccurrence,
): ReadonlyMap<string, ResolvedRerollPress> {
  const presses = new Map<string, ResolvedRerollPress>();
  for (const action of source.roomActions.order) {
    if (action.kind !== 'reroll') continue;
    const target = resolveRerollTarget(topology, action);
    if (target === undefined) continue;
    const owner = rerollTargetOwner(biome, source.occurrenceId, target);
    if (!rerollPressHeld(topology, owner, action.rerollId)) continue;
    const result = rerollResult(topology, owner, action.rerollId);
    presses.set(
      action.rerollId,
      Object.freeze(result === undefined ? { target } : { target, result }),
    );
  }
  return presses;
}

/** One owner's rerolls in authored order: its effective offer is the last one's result. */
export interface OwnerRerolls {
  readonly owner: RerolledRewardOwner;
  readonly rerolls: readonly RerollPress[];
  readonly effectiveOffer: ResolvedRewardOffer;
}

function collectOwners(
  topology: Pick<BiomeTopology, 'occurrences'>,
  entries: readonly { readonly owner: RerolledRewardOwner; readonly reroll: RerollPress }[],
): ReadonlyMap<string, OwnerRerolls> {
  const byOwner = new Map<
    string,
    { owner: RerolledRewardOwner; rerolls: RerollPress[]; effectiveOffer: ResolvedRewardOffer }
  >();
  for (const { owner, reroll } of entries) {
    // A press whose result is not held or not set redraws nothing the walk reads.
    const result = rerollResult(topology, owner, reroll.rerollId);
    if (result === undefined) continue;
    const key = semanticAddressKey(owner);
    const entry = byOwner.get(key) ?? { owner, rerolls: [], effectiveOffer: result };
    entry.rerolls.push(reroll);
    entry.effectiveOffer = result;
    byOwner.set(key, entry);
  }
  return new Map(
    [...byOwner].map(([key, entry]) => [
      key,
      Object.freeze({
        owner: entry.owner,
        rerolls: Object.freeze(entry.rerolls),
        effectiveOffer: entry.effectiveOffer,
      }),
    ]),
  );
}

/**
 * The owners one room's rerolls redraw: its doors' rooms, their cages and its
 * wheel offers, with each press's result read from its target.
 */
export function sourceRerolledOwners(
  biome: BiomeAddress,
  topology: Pick<BiomeTopology, 'occurrences'>,
  source: RoomOccurrence,
): ReadonlyMap<string, OwnerRerolls> {
  return collectOwners(
    topology,
    source.roomActions.order.flatMap((action) => {
      if (action.kind !== 'reroll') return [];
      const owner = roomRerollOwner(biome, topology, source.occurrenceId, action);
      return owner === undefined ? [] : [{ owner, reroll: action }];
    }),
  );
}

/**
 * The board-door rooms one Hub's rerolls redraw; a closed slot's reroll names
 * no owner, and a reroll after its slot's visit redraws nothing that visit saw.
 */
export function hubRerolledOwners(
  biome: BiomeAddress,
  topology: Pick<BiomeTopology, 'occurrences'>,
  hub: HubDecision,
): ReadonlyMap<string, OwnerRerolls> {
  const entered = new Set<string>();
  return collectOwners(
    topology,
    hub.actions.flatMap((action) => {
      if (action.kind === 'roomVisit') entered.add(action.hubSlotKey);
      if (action.kind !== 'reroll' || entered.has(action.hubSlotKey)) return [];
      const owner = hubRerollOwner(biome, hub, action);
      return owner === undefined ? [] : [{ owner, reroll: action }];
    }),
  );
}

const rerolledOwnersByTopology = new WeakMap<object, ReadonlyMap<string, OwnerRerolls>>();

/**
 * Every rerolled owner of one biome topology, keyed by owner. Structural only:
 * whether each press is legal is the simulation's question. Memoized only for
 * a frozen topology: a decoded one cannot change under its identity, while a
 * raw one being migrated can.
 */
export function biomeRerolledOwners(
  biome: BiomeAddress,
  topology: RerollTopology,
): ReadonlyMap<string, OwnerRerolls> {
  const immutable =
    Object.isFrozen(topology) &&
    Object.isFrozen(topology.occurrences) &&
    Object.isFrozen(topology.decisions);
  if (!immutable) return collectBiomeRerolledOwners(biome, topology);
  let owners = rerolledOwnersByTopology.get(topology);
  if (owners === undefined) {
    owners = collectBiomeRerolledOwners(biome, topology);
    rerolledOwnersByTopology.set(topology, owners);
  }
  return owners;
}

function collectBiomeRerolledOwners(
  biome: BiomeAddress,
  topology: RerollTopology,
): ReadonlyMap<string, OwnerRerolls> {
  const owners = new Map<string, OwnerRerolls>();
  for (const occurrence of topology.occurrences)
    for (const [key, entry] of sourceRerolledOwners(biome, topology, occurrence))
      owners.set(key, entry);
  for (const decision of topology.decisions)
    if (decision.kind === 'hub')
      for (const [key, entry] of hubRerolledOwners(biome, topology, decision))
        owners.set(key, entry);
  return owners;
}

/**
 * Every press naming each owner, by owner key, whatever its order: a room's
 * presses whose target can hold a result, and a Hub's presses of open slots,
 * entered or not. The results an owner holds name exactly these.
 */
export function biomeRerollPressesByOwner(
  biome: BiomeAddress,
  topology: RerollTopology,
): ReadonlyMap<string, { readonly owner: RerolledRewardOwner; readonly rerollIds: string[] }> {
  const byOwner = new Map<string, { owner: RerolledRewardOwner; rerollIds: string[] }>();
  const add = (owner: RerolledRewardOwner, rerollId: string) => {
    const key = semanticAddressKey(owner);
    const entry = byOwner.get(key) ?? { owner, rerollIds: [] };
    entry.rerollIds.push(rerollId);
    byOwner.set(key, entry);
  };
  for (const source of topology.occurrences)
    for (const action of source.roomActions.order) {
      if (action.kind !== 'reroll') continue;
      const owner = roomRerollOwner(biome, topology, source.occurrenceId, action);
      if (owner !== undefined) add(owner, action.rerollId);
    }
  for (const decision of topology.decisions) {
    if (decision.kind !== 'hub') continue;
    for (const action of decision.actions) {
      if (action.kind !== 'reroll') continue;
      const owner = hubRerollOwner(biome, decision, action);
      if (owner !== undefined) add(owner, action.rerollId);
    }
  }
  return byOwner;
}

/** The redraws and outcomes an owner's room holds, when it was rerolled. */
export function rerolledRecordOf(
  occurrence: RoomOccurrence,
  owner: SemanticAddress,
): RerolledRewardState | undefined {
  switch (owner.kind) {
    case 'incomingReward':
      return owner.occurrenceId === occurrence.occurrenceId
        ? occurrence.rerolledIncomingReward
        : undefined;
    case 'localReward':
      return owner.occurrenceId === occurrence.occurrenceId &&
        owner.groupKey === FIELDS_CAGE_GROUP_KEY &&
        occurrence.state.kind === 'fieldsCombat'
        ? occurrence.state.rerolledCages?.[owner.slotKey]
        : undefined;
    case 'rewardWheelOffer':
      return owner.occurrenceId === occurrence.occurrenceId &&
        occurrence.state.kind === 'shipCombat'
        ? occurrence.state.wheels[owner.wheelKey]?.rerolledOffers?.[owner.offerKey]
        : undefined;
    default:
      return undefined;
  }
}

/**
 * A rerolled owner's effective item as a reward state: the reward its recorded
 * press drew with that item's outcomes; undefined when it holds no outcomes.
 */
export function rerolledRewardOf(
  occurrence: RoomOccurrence,
  owner: SemanticAddress,
): AuthoredRewardState | undefined {
  const record = rerolledRecordOf(occurrence, owner);
  const offer = record?.results[record.pressId];
  return record?.acquisition === undefined || offer == null
    ? undefined
    : Object.freeze({ offer, ...record.acquisition });
}

/** An owner's first native draw, as its room holds it. */
function nativeRewardOf(
  occurrence: RoomOccurrence,
  owner: RerolledRewardOwner,
): AuthoredRewardState | null | undefined {
  if (owner.occurrenceId !== occurrence.occurrenceId) return undefined;
  const state = occurrence.state;
  switch (owner.kind) {
    case 'incomingReward':
      return state.kind === 'counted' ||
        state.kind === 'fixed' ||
        state.kind === 'anomaly' ||
        state.kind === 'ephyraCombat' ||
        state.kind === 'freeReward'
        ? state.reward
        : undefined;
    case 'localReward':
      return state.kind === 'fieldsCombat' && owner.groupKey === FIELDS_CAGE_GROUP_KEY
        ? state.cages[owner.slotKey]
        : undefined;
    case 'rewardWheelOffer':
      return state.kind === 'shipCombat'
        ? state.wheels[owner.wheelKey]?.offers[owner.offerKey]
        : undefined;
  }
}

/**
 * The reward an owner acquires: its rerolled effective item when that holds
 * outcomes, else its first native draw.
 */
export function effectiveRewardAt(
  occurrence: RoomOccurrence,
  owner: RerolledRewardOwner,
): AuthoredRewardState | null | undefined {
  return rerolledRewardOf(occurrence, owner) ?? nativeRewardOf(occurrence, owner);
}

function withoutKey<V>(
  record: Readonly<Record<string, V>> | undefined,
  key: string,
  value: V | undefined,
): Readonly<Record<string, V>> | undefined {
  const next: Record<string, V> = { ...record };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return Object.keys(next).length === 0 ? undefined : Object.freeze(next);
}

/** Sets or drops one owner's rerolled record; other state is untouched. */
export function withRerolledRecord(
  occurrence: RoomOccurrence,
  owner: RerolledRewardOwner,
  record: RerolledRewardState | undefined,
): RoomOccurrence {
  switch (owner.kind) {
    case 'incomingReward': {
      const { rerolledIncomingReward: _previous, ...rest } = occurrence;
      void _previous;
      return Object.freeze(
        record === undefined ? rest : { ...rest, rerolledIncomingReward: record },
      );
    }
    case 'localReward': {
      if (occurrence.state.kind !== 'fieldsCombat') return occurrence;
      const { rerolledCages: _previous, ...state } = occurrence.state;
      void _previous;
      const cages = withoutKey(occurrence.state.rerolledCages, owner.slotKey, record);
      return Object.freeze({
        ...occurrence,
        state: Object.freeze(cages === undefined ? state : { ...state, rerolledCages: cages }),
      });
    }
    case 'rewardWheelOffer': {
      if (occurrence.state.kind !== 'shipCombat') return occurrence;
      const wheel = occurrence.state.wheels[owner.wheelKey];
      if (wheel === undefined) return occurrence;
      const { rerolledOffers: _previous, ...rest } = wheel;
      void _previous;
      const offers = withoutKey(wheel.rerolledOffers, owner.offerKey, record);
      return Object.freeze({
        ...occurrence,
        state: Object.freeze({
          ...occurrence.state,
          wheels: Object.freeze({
            ...occurrence.state.wheels,
            [owner.wheelKey]: Object.freeze(
              offers === undefined ? rest : { ...rest, rerolledOffers: offers },
            ),
          }),
        }),
      });
    }
  }
}

/** A rerolled record holding these outcomes for its effective item; the offer is its press's. */
export function withRerolledAcquisition(
  record: RerolledRewardState,
  reward: AuthoredRewardState | undefined,
): RerolledRewardState {
  const { acquisition: _previous, ...rest } = record;
  void _previous;
  if (reward === undefined) return Object.freeze(rest);
  const { offer: _offer, ...acquisition } = reward;
  void _offer;
  return Object.freeze({ ...rest, acquisition: Object.freeze(acquisition) });
}

/** Writes outcomes onto an owner's effective item; the same occurrence when it holds none. */
export function withRerolledReward(
  occurrence: RoomOccurrence,
  owner: RerolledRewardOwner,
  reward: AuthoredRewardState,
): RoomOccurrence {
  const record = rerolledRecordOf(occurrence, owner);
  return record === undefined
    ? occurrence
    : withRerolledRecord(occurrence, owner, withRerolledAcquisition(record, reward));
}

/** Every rerolled record a topology holds, by owner. */
export function heldRerolledRecords(
  biome: BiomeAddress,
  topology: Pick<BiomeTopology, 'occurrences'>,
): { readonly owner: RerolledRewardOwner; readonly record: RerolledRewardState }[] {
  return topology.occurrences.flatMap((occurrence) => occurrenceRerolledRecords(biome, occurrence));
}

/** Every rerolled record one room holds, by owner. */
function occurrenceRerolledRecords(
  biome: BiomeAddress,
  occurrence: RoomOccurrence,
): { readonly owner: RerolledRewardOwner; readonly record: RerolledRewardState }[] {
  const held: { owner: RerolledRewardOwner; record: RerolledRewardState }[] = [];
  if (occurrence.rerolledIncomingReward !== undefined)
    held.push({
      owner: createIncomingRewardAddress(biome, occurrence.occurrenceId),
      record: occurrence.rerolledIncomingReward,
    });
  if (occurrence.state.kind === 'fieldsCombat')
    for (const [slotKey, record] of Object.entries(occurrence.state.rerolledCages ?? {}))
      held.push({
        owner: createLocalRewardAddress(
          biome,
          occurrence.occurrenceId,
          FIELDS_CAGE_GROUP_KEY,
          slotKey,
        ),
        record,
      });
  if (occurrence.state.kind === 'shipCombat')
    for (const [wheelKey, wheel] of Object.entries(occurrence.state.wheels))
      for (const [offerKey, record] of Object.entries(wheel.rerolledOffers ?? {}))
        held.push({
          owner: createRewardWheelOfferAddress(biome, occurrence.occurrenceId, wheelKey, offerKey),
          record,
        });
  return held;
}

/**
 * A rebuilt room with each rerolled record of its former state wherever the
 * rebuild kept that owner's first draw: the item a press redrew survives with
 * it. A record the rebuilt room already holds stays.
 */
export function carryRerolledRecords(
  biome: BiomeAddress,
  previous: RoomOccurrence,
  next: RoomOccurrence,
): RoomOccurrence {
  let carried = next;
  for (const { owner, record } of occurrenceRerolledRecords(biome, previous)) {
    if (rerolledRecordOf(carried, owner) !== undefined) continue;
    const first = nativeRewardOf(previous, owner);
    // A room with no first draw here (a Shop door) keeps its record while it keeps its kind.
    if (
      first !== nativeRewardOf(carried, owner) ||
      (first === undefined && previous.state.kind !== carried.state.kind)
    )
      continue;
    carried = withRerolledRecord(carried, owner, record);
  }
  return carried;
}

/**
 * Whether a room press's target can hold its result: its door's room stands
 * (a cage's as a Fields room), or it is the source's own wheel.
 */
export function rerollPressNeedsResult(
  topology: Pick<BiomeTopology, 'occurrences'>,
  source: RoomOccurrence,
  press: RerollRoomAction,
): boolean {
  if (press.target.kind === 'wheelOffer') return true;
  const target = occurrenceIn(topology, press.target.occurrenceId);
  return (
    target !== undefined && (press.target.kind !== 'cage' || target.state.kind === 'fieldsCombat')
  );
}

/** The smallest reroll id none of the ids still in use takes. */
export function nextRerollId(inUse: Iterable<string>): string {
  const used = new Set(inUse);
  for (let index = 1; ; index += 1) if (!used.has(`r${index}`)) return `r${index}`;
}
