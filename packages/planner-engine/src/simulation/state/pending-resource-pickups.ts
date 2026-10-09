import { semanticAddressKey, type SemanticAddress } from '../../authored-project/addresses';
import type { Catalog, InRunTraitRarity } from '../../catalog-schema';
import {
  resolveAcquisitionRole,
  type MaxStatGrant,
  type ResolvedRewardOffer,
  type ResourceAmounts,
} from '../../reward-kernel';
import type { TraitHistoryState } from '../traits/history/model';
import type { SimulationState } from './model';
import {
  spawnPendingTraitOffers,
  traitOfferRoomKey,
  type SpawnedTraitOffer,
} from './pending-trait-offers';

/** `GetHeroTraitValues("RoomRewardBonus")`: each equipped bonus adds its excess over one. */
function resourceBonusMultipliers(
  catalog: Catalog,
  traitHistory: TraitHistoryState,
): Readonly<Record<string, number>> {
  const multipliers: Record<string, number> = {};
  for (const trait of Object.values(traitHistory.equippedTraits)) {
    const bonus = catalog.traits.byKey[trait.traitKey]?.resourceRewardBonus;
    if (bonus === undefined) continue;
    for (const [resource, byRarity] of Object.entries(bonus)) {
      // Buried Treasure always carries a ranked rarity; an unranked instance has no bonus value.
      const value = byRarity[trait.rarity as InRunTraitRarity] as number | undefined;
      if (value !== undefined) multipliers[resource] = (multipliers[resource] ?? 1) + (value - 1);
    }
  }
  return multipliers;
}

/**
 * The resources one produced object stores (`ApplyConsumableItemResourceMultiplier`):
 * its producer's or declaration's `AddResources`, each scaled by the bonuses
 * equipped now and rounded per object (`round` is `floor(v + 0.5)`). `NPCDrop`
 * producers keep the base. Undefined when the object grants no tracked resource.
 */
export function resolveProducedResourceAmounts(
  catalog: Catalog,
  acquisitionGameName: string,
  producerLifecycleKey: string,
  traitHistory: TraitHistoryState,
): ResourceAmounts | undefined {
  const producer = catalog.rewards.producerLifecycles.byKey[producerLifecycleKey];
  const base =
    producer?.resourceGrantOverrides?.[acquisitionGameName] ??
    catalog.rewards.acquisitions.byKey[acquisitionGameName]?.resourceGrant;
  if (base === undefined) return undefined;
  if (producer?.resourceBonusExempt === true) return base;
  const multipliers = resourceBonusMultipliers(catalog, traitHistory);
  return Object.freeze(
    Object.fromEntries(
      Object.entries(base).map(([resource, amount]) => {
        const multiplier = multipliers[resource];
        return [
          resource,
          multiplier === undefined ? amount : Math.floor(amount * multiplier + 0.5),
        ];
      }),
    ),
  );
}

/**
 * The flat maximum one produced object grants. A run-progress-eligible
 * producer's object takes its `RunProgress` override where the route owns the
 * unlock; a purchase is never run-progress eligible.
 */
export function resolveProducedMaxStatGrant(
  catalog: Catalog,
  acquisitionGameName: string,
  producerLifecycleKey: string,
  routeKey: string,
): MaxStatGrant | undefined {
  const acquisition = catalog.rewards.acquisitions.byKey[acquisitionGameName];
  const runProgress = acquisition?.runProgressMaxStatGrant;
  if (
    runProgress !== undefined &&
    catalog.rewards.producerLifecycles.byKey[producerLifecycleKey]?.runProgressUpgradeEligible ===
      true &&
    !runProgress.excludedRouteKeys.includes(routeKey)
  )
    return Object.freeze({ stat: runProgress.stat, amount: runProgress.amount });
  return acquisition?.maxStatGrant;
}

/** One spawned object whose resource roles store their amount now. */
export interface ProducedResourcePickup {
  readonly origin: SemanticAddress;
  readonly offer: ResolvedRewardOffer;
  readonly producerLifecycleKey: string;
}

/** One object spawned at a native creation contact, with both of its spawn-time products. */
export type SpawnedPickup = SpawnedTraitOffer & ProducedResourcePickup;

/** Spawned objects store their resource amounts and build their options from this state. */
export function spawnPickups(
  catalog: Catalog,
  state: SimulationState,
  spawned: readonly SpawnedPickup[],
  roles?: readonly string[],
): SimulationState {
  return spawnPendingTraitOffers(
    catalog,
    producePendingResourcePickups(catalog, state, spawned, roles),
    spawned,
    roles,
  );
}

function roleKey(owner: SemanticAddress, role: string): string {
  return `${semanticAddressKey(owner)}\u0000${role}`;
}

function withRoom(
  state: SimulationState,
  room: string,
  records: Readonly<Record<string, ResourceAmounts>>,
): SimulationState {
  const { [room]: _previous, ...rest } = state.pendingResourcePickups;
  void _previous;
  return Object.freeze({
    ...state,
    pendingResourcePickups: Object.freeze(
      Object.keys(records).length === 0 ? rest : { ...rest, [room]: Object.freeze(records) },
    ),
  });
}

/**
 * Stores each spawned resource object's amount from the state it spawns in; a
 * later trait change does not rewrite it. A respawn before collection replaces it.
 */
export function producePendingResourcePickups(
  catalog: Catalog,
  state: SimulationState,
  produced: readonly ProducedResourcePickup[],
  roles?: readonly string[],
): SimulationState {
  let next = state;
  for (const pickup of produced) {
    const room = traitOfferRoomKey(pickup.origin);
    const rewardType = catalog.rewards.rewardTypes.byKey[pickup.offer.rewardType];
    if (room === undefined || rewardType === undefined) continue;
    const records: Record<string, ResourceAmounts> = {};
    for (const role of rewardType.acquisitionRoles.values) {
      if (roles !== undefined && !roles.includes(role.key)) continue;
      // A hidden source (Blind Box) has no identity until it is unwrapped.
      if (
        role.resolution.kind === 'payloadSource' &&
        (pickup.offer.payload === undefined || !(role.resolution.field in pickup.offer.payload))
      )
        continue;
      const acquisition = resolveAcquisitionRole(
        catalog.rewards,
        pickup.offer,
        role.key,
        'roomRewardPickup',
      ).acquisition;
      const amounts = resolveProducedResourceAmounts(
        catalog,
        acquisition.gameName,
        pickup.producerLifecycleKey,
        next.traitHistory,
      );
      if (amounts !== undefined) records[roleKey(pickup.origin, role.key)] = amounts;
    }
    if (Object.keys(records).length > 0)
      next = withRoom(next, room, { ...(next.pendingResourcePickups[room] ?? {}), ...records });
  }
  return next;
}

/**
 * Collects one object's stored amount, or resolves it from the current state
 * when no earlier contact spawned it. A Sea Star-retained object keeps its
 * record so the duplicate grants the same amount again.
 */
export function collectPendingResourcePickup(
  catalog: Catalog,
  state: SimulationState,
  object: {
    readonly owner: SemanticAddress;
    readonly role: string;
    readonly acquisitionGameName: string;
    readonly producerLifecycleKey: string;
  },
  retained: boolean,
): { readonly state: SimulationState; readonly amounts: ResourceAmounts | undefined } {
  const room = traitOfferRoomKey(object.owner);
  const key = roleKey(object.owner, object.role);
  const records = room === undefined ? undefined : state.pendingResourcePickups[room];
  const amounts =
    records?.[key] ??
    resolveProducedResourceAmounts(
      catalog,
      object.acquisitionGameName,
      object.producerLifecycleKey,
      state.traitHistory,
    );
  if (room === undefined || amounts === undefined) return { state, amounts };
  const { [key]: _collected, ...rest } = records ?? {};
  void _collected;
  return {
    state: withRoom(state, room, retained ? { ...rest, [key]: amounts } : rest),
    amounts,
  };
}

/** Every object left in a room disappears with it. */
export function closePendingResourcePickupRoom(
  state: SimulationState,
  room: string,
): SimulationState {
  return state.pendingResourcePickups[room] === undefined ? state : withRoom(state, room, {});
}

/** Serializable projection used for branch equivalence. */
export function pendingResourcePickupsProjection(state: SimulationState): readonly unknown[] {
  return Object.keys(state.pendingResourcePickups)
    .sort()
    .map((room) => {
      const records = state.pendingResourcePickups[room]!;
      return [
        room,
        Object.keys(records)
          .sort()
          .map((key) => [
            key,
            Object.entries(records[key]!).sort(([a], [b]) => a.localeCompare(b)),
          ]),
      ];
    });
}
