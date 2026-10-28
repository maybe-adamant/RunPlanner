import type { ResolvedRewardOffer } from '../reward-kernel/model';
import {
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createRewardWheelOfferAddress,
  semanticAddressKey,
  type BiomeAddress,
  type HubDecisionAddress,
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
  RerollRoomAction,
  RerollTarget,
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
export type RerollPressTarget = RerollTarget | HubSlotRerollTarget;

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
    const visits = hub.actions.flatMap((action, index) =>
      action.kind === 'roomVisit' ? [index] : [],
    );
    return visits[surface.precedingVisitCount] ?? hub.actions.length;
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

/** The reward owner a room reroll of this target redraws. */
export function rerollTargetOwner(
  biome: BiomeAddress,
  sourceOccurrenceId: OccurrenceId,
  target: RerollTarget,
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

/** One owner's rerolls in authored order: its effective offer is the last one's. */
export interface OwnerRerolls {
  readonly owner: RerolledRewardOwner;
  readonly rerolls: readonly (RerollRoomAction | HubRerollAction)[];
  readonly effectiveOffer: ResolvedRewardOffer;
}

type RerollPress = RerollRoomAction | HubRerollAction;

function collectOwners(
  entries: readonly { readonly owner: RerolledRewardOwner; readonly reroll: RerollPress }[],
): ReadonlyMap<string, OwnerRerolls> {
  const byOwner = new Map<string, { owner: RerolledRewardOwner; rerolls: RerollPress[] }>();
  for (const { owner, reroll } of entries) {
    const key = semanticAddressKey(owner);
    const entry = byOwner.get(key) ?? { owner, rerolls: [] };
    entry.rerolls.push(reroll);
    byOwner.set(key, entry);
  }
  return new Map(
    [...byOwner].map(([key, entry]) => [
      key,
      Object.freeze({
        owner: entry.owner,
        rerolls: Object.freeze(entry.rerolls),
        effectiveOffer: entry.rerolls.at(-1)!.reward,
      }),
    ]),
  );
}

/** The owners one room's rerolls redraw: its doors' rooms, their cages and its wheel offers. */
export function sourceRerolledOwners(
  biome: BiomeAddress,
  source: RoomOccurrence,
): ReadonlyMap<string, OwnerRerolls> {
  return collectOwners(
    source.roomActions.order.flatMap((action) =>
      action.kind === 'reroll'
        ? [{ owner: rerollTargetOwner(biome, source.occurrenceId, action.target), reroll: action }]
        : [],
    ),
  );
}

/**
 * The board-door rooms one Hub's rerolls redraw; a closed slot's reroll names
 * no owner, and a reroll after its slot's visit redraws nothing that visit saw.
 */
export function hubRerolledOwners(
  biome: BiomeAddress,
  hub: HubDecision,
): ReadonlyMap<string, OwnerRerolls> {
  const entered = new Set<string>();
  return collectOwners(
    hub.actions.flatMap((action) => {
      if (action.kind === 'roomVisit') entered.add(action.hubSlotKey);
      if (action.kind !== 'reroll' || entered.has(action.hubSlotKey)) return [];
      const target = hub.openTargets.find(
        (candidate) => candidate.hubSlotKey === action.hubSlotKey,
      );
      return target === undefined
        ? []
        : [{ owner: createIncomingRewardAddress(biome, target.occurrenceId), reroll: action }];
    }),
  );
}

/**
 * Every rerolled owner of one biome topology, keyed by owner. Structural only:
 * whether each press is legal is the simulation's question.
 */
export function biomeRerolledOwners(
  biome: BiomeAddress,
  topology: BiomeTopology,
): ReadonlyMap<string, OwnerRerolls> {
  const owners = new Map<string, OwnerRerolls>();
  for (const occurrence of topology.occurrences)
    for (const [key, entry] of sourceRerolledOwners(biome, occurrence)) owners.set(key, entry);
  for (const decision of topology.decisions)
    if (decision.kind === 'hub')
      for (const [key, entry] of hubRerolledOwners(biome, decision)) owners.set(key, entry);
  return owners;
}

/** The occurrence-held rerolled reward of an owner, when one is authored. */
export function rerolledRewardOf(
  occurrence: RoomOccurrence,
  owner: SemanticAddress,
): AuthoredRewardState | undefined {
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

/** Sets or drops one owner's rerolled reward; other state is untouched. */
export function withRerolledReward(
  occurrence: RoomOccurrence,
  owner: RerolledRewardOwner,
  reward: AuthoredRewardState | undefined,
): RoomOccurrence {
  switch (owner.kind) {
    case 'incomingReward': {
      const { rerolledIncomingReward: _previous, ...rest } = occurrence;
      void _previous;
      return Object.freeze(
        reward === undefined ? rest : { ...rest, rerolledIncomingReward: reward },
      );
    }
    case 'localReward': {
      if (occurrence.state.kind !== 'fieldsCombat') return occurrence;
      const { rerolledCages: _previous, ...state } = occurrence.state;
      void _previous;
      const cages = withoutKey(occurrence.state.rerolledCages, owner.slotKey, reward);
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
      const offers = withoutKey(wheel.rerolledOffers, owner.offerKey, reward);
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

/** The smallest reroll id no present reroll of this owner list uses. */
export function nextRerollId(present: readonly { readonly rerollId: string }[]): string {
  const used = new Set(present.map((reroll) => reroll.rerollId));
  for (let index = 1; ; index += 1) if (!used.has(`r${index}`)) return `r${index}`;
}

function authoredRerollCount(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(authoredRerollCount);
  if (value === null || typeof value !== 'object') return false;
  return Object.entries(value).some(
    ([key, entry]) =>
      (key === 'rerollCount' && typeof entry === 'number') ||
      (key === 'kind' &&
        (entry === 'reroll' || entry === 'rerollStygianWell' || entry === 'rerollPurgingPool')) ||
      authoredRerollCount(entry),
  );
}

/** Whether the plan authors any reroll press, Well or Pool reroll, or screen reroll count. */
export function projectAuthorsRerolls(document: import('./model').ProjectDocument): boolean {
  return authoredRerollCount(document.route.biomes);
}
