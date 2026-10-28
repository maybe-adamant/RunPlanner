import type { ResolvedRewardOffer } from '../reward-kernel/model';
import {
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createRewardWheelOfferAddress,
  semanticAddressKey,
  type BiomeAddress,
  type IncomingRewardAddress,
  type LocalRewardAddress,
  type RewardWheelOfferAddress,
  type SemanticAddress,
} from './addresses';
import type {
  AuthoredRewardState,
  BiomeTopology,
  HubDecision,
  HubRerollAction,
  OccurrenceId,
  RerollRoomAction,
  RoomOccurrence,
} from './model';

/** A reroll target's reward owner: a door's room, a cage slot or a wheel offer. */
export type RerolledRewardOwner =
  IncomingRewardAddress | LocalRewardAddress | RewardWheelOfferAddress;

export const FIELDS_CAGE_GROUP_KEY = 'cages';

/** The reward owner one room reroll redraws. */
export function rerollTargetOwner(
  biome: BiomeAddress,
  sourceOccurrenceId: OccurrenceId,
  reroll: RerollRoomAction,
): RerolledRewardOwner {
  const target = reroll.target;
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
        ? [{ owner: rerollTargetOwner(biome, source.occurrenceId, action), reroll: action }]
        : [],
    ),
  );
}

/** The board-door rooms one Hub's rerolls redraw; a closed slot's reroll names no owner. */
export function hubRerolledOwners(
  biome: BiomeAddress,
  hub: HubDecision,
): ReadonlyMap<string, OwnerRerolls> {
  return collectOwners(
    hub.actions.flatMap((action) => {
      if (action.kind !== 'reroll') return [];
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
