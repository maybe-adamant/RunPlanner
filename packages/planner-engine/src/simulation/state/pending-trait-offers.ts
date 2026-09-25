import {
  createBiomeAddress,
  createOccurrenceAddress,
  createLevelResolutionAddress,
  createTraitOfferAddress,
  semanticAddressKey,
  type OccurrenceAddress,
  type SemanticAddress,
  type TraitOfferOwnerAddress,
} from '../../authored-project/addresses';
import type { Catalog } from '../../catalog-schema';
import type { PendingTraitOfferContext, PendingTraitOfferRecord, SimulationState } from './model';

/**
 * The events that natively touch a spawned, unopened loot's options. A screen
 * completion rebuilds every live loot in the room at once; the others clear
 * the options so the loot regenerates when opened.
 */
export type TraitOfferContextTransition =
  | { readonly kind: 'screenCompleted'; readonly room: string }
  | {
      readonly kind: 'invalidated';
      readonly room: string;
      readonly source:
        | 'steadyGrowthInterval'
        | 'transcendentEmbryoInterval'
        | 'fountainRarity'
        | 'nemesisTraitTrade';
    };

/**
 * The occurrence (map) that owns a loot, a screen or one of its nested
 * outcomes, or undefined outside one.
 */
export function traitOfferRoomOccurrence(address: SemanticAddress): OccurrenceAddress | undefined {
  if ('occurrenceId' in address && typeof address.occurrenceId === 'string')
    return createOccurrenceAddress(
      createBiomeAddress(address.routeKey, address.biomeKey),
      address.occurrenceId,
    );
  switch (address.kind) {
    case 'encounterPhase':
      return createOccurrenceAddress(
        createBiomeAddress(address.routeKey, address.biomeKey),
        address.owner.occurrenceId,
      );
    case 'gorgonPhase':
      return traitOfferRoomOccurrence(address.encounter);
    case 'acquisitionEntry':
      return traitOfferRoomOccurrence(address.site);
    case 'acquisitionSite':
      return traitOfferRoomOccurrence(address.owner);
    case 'traitOffer':
    case 'acquisitionRole':
    case 'levelResolution':
    case 'steadyGrowthOutcome':
    case 'transcendentEmbryoOutcome':
      return traitOfferRoomOccurrence(address.owner);
    case 'fountainRarityOutcome':
      return traitOfferRoomOccurrence(address.action);
    case 'keepsakeEquipResult':
      return traitOfferRoomOccurrence(address.selection);
    case 'traitAcquisitionTarget':
    case 'circeResolution':
    case 'echoPomTarget':
    case 'naturalSelectionResult':
    case 'echoLastReward':
    case 'echoLastRunBoon':
    case 'allTogetherSet':
      return traitOfferRoomOccurrence(address.trait);
    case 'nemesisRandomEvent':
      return traitOfferRoomOccurrence(address.encounter);
    default:
      return undefined;
  }
}

export function traitOfferRoomKey(address: SemanticAddress): string | undefined {
  const occurrence = traitOfferRoomOccurrence(address);
  return occurrence === undefined ? undefined : semanticAddressKey(occurrence);
}

function contextOf(state: SimulationState): PendingTraitOfferContext {
  return Object.freeze({
    traitHistory: state.traitHistory,
    arcanaFear: state.arcanaFear,
    keepsakes: state.keepsakes,
    equipment: state.equipment,
    stygianWell: state.stygianWell,
    rewardHistory: state.rewardHistory,
  });
}

function withRoom(
  state: SimulationState,
  room: string,
  records: Readonly<Record<string, PendingTraitOfferRecord>> | undefined,
): SimulationState {
  const { [room]: _previous, ...rest } = state.pendingTraitOffers;
  void _previous;
  return Object.freeze({
    ...state,
    pendingTraitOffers: Object.freeze(
      records === undefined || Object.keys(records).length === 0
        ? rest
        : { ...rest, [room]: Object.freeze(records) },
    ),
  });
}

/** One spawned loot's trait-bearing roles, keyed by their offer or Pom address. */
export interface SpawnedTraitOffer {
  readonly origin: TraitOfferOwnerAddress;
  readonly offer: { readonly rewardType: string };
  readonly traitOffersByAcquisitionRole?: Readonly<Record<string, unknown>> | undefined;
  readonly levelResolutionsByAcquisitionRole?: Readonly<Record<string, unknown>> | undefined;
}

/**
 * Roles whose loot does not exist until its container is unwrapped: a Mystery
 * Box's god loot is created and opened in one step (`UnwrapRandomLoot`).
 */
function rolesBuiltAtUnwrap(catalog: Catalog, rewardType: string): ReadonlySet<string> {
  const bindings = [
    ...catalog.rewards.producerLifecycles.values.flatMap(
      (profile) => profile.rewardTypes.byKey[rewardType]?.acquisitionLifecycle ?? [],
    ),
    ...catalog.rewards.shops.values.flatMap((profile) =>
      profile.groups.values.flatMap((group) =>
        group.options.values.flatMap((option) =>
          option.rewardType === rewardType ? option.acquisitionLifecycle : [],
        ),
      ),
    ),
  ];
  return new Set(
    bindings.filter((binding) => binding.lifecyclePoint === 'afterUnwrap').map((b) => b.role),
  );
}

function spawnedKeys(
  catalog: Catalog,
  spawned: SpawnedTraitOffer,
  roles?: readonly string[],
): readonly string[] {
  const unwrapped = rolesBuiltAtUnwrap(catalog, spawned.offer.rewardType);
  const include = (role: string) =>
    !unwrapped.has(role) && (roles === undefined || roles.includes(role));
  return [
    ...Object.keys(spawned.traitOffersByAcquisitionRole ?? {})
      .filter(include)
      .map((role) => semanticAddressKey(createTraitOfferAddress(spawned.origin, role))),
    ...Object.keys(spawned.levelResolutionsByAcquisitionRole ?? {})
      .filter(include)
      .map((role) => semanticAddressKey(createLevelResolutionAddress(spawned.origin, role))),
  ];
}

/** Records loot whose options native builds now, from the current state. */
export function spawnPendingTraitOffers(
  catalog: Catalog,
  state: SimulationState,
  spawned: readonly SpawnedTraitOffer[],
  roles?: readonly string[],
): SimulationState {
  let next = state;
  for (const loot of spawned) {
    const room = traitOfferRoomKey(loot.origin);
    const keys = spawnedKeys(catalog, loot, roles);
    if (room === undefined || keys.length === 0) continue;
    const record = Object.freeze({ context: contextOf(next), stale: false });
    next = withRoom(next, room, {
      ...(next.pendingTraitOffers[room] ?? {}),
      ...Object.fromEntries(keys.map((key) => [key, record])),
    });
  }
  return next;
}

/** Removes an opened loot; its options were read when the screen opened. */
export function openPendingTraitOffer(
  state: SimulationState,
  address: SemanticAddress,
): SimulationState {
  const room = traitOfferRoomKey(address);
  const records = room === undefined ? undefined : state.pendingTraitOffers[room];
  const key = semanticAddressKey(address);
  if (room === undefined || records?.[key] === undefined) return state;
  const { [key]: _opened, ...rest } = records;
  void _opened;
  return withRoom(state, room, rest);
}

/** Every loot left in a room disappears with it. */
export function closePendingTraitOfferRoom(state: SimulationState, room: string): SimulationState {
  return state.pendingTraitOffers[room] === undefined ? state : withRoom(state, room, undefined);
}

export function applyTraitOfferContextTransition(
  state: SimulationState,
  transition: TraitOfferContextTransition,
): SimulationState {
  const records = state.pendingTraitOffers[transition.room];
  if (records === undefined) return state;
  switch (transition.kind) {
    case 'screenCompleted': {
      const record = Object.freeze({ context: contextOf(state), stale: false });
      return withRoom(
        state,
        transition.room,
        Object.fromEntries(Object.keys(records).map((key) => [key, record])),
      );
    }
    case 'invalidated':
      return withRoom(
        state,
        transition.room,
        Object.fromEntries(
          Object.entries(records).map(([key, record]) => [
            key,
            record.stale ? record : Object.freeze({ ...record, stale: true }),
          ]),
        ),
      );
  }
}

/**
 * The state an offer's options were built from: its spawn or last rebuild, or
 * the open-time state when it was invalidated or never spawned earlier.
 */
export function traitOfferGenerationState(
  state: SimulationState,
  address: SemanticAddress,
): SimulationState {
  const room = traitOfferRoomKey(address);
  const record =
    room === undefined ? undefined : state.pendingTraitOffers[room]?.[semanticAddressKey(address)];
  return record === undefined || record.stale
    ? state
    : Object.freeze({ ...state, ...record.context });
}

/** Serializable semantic projection used for branch equivalence and context identity. */
export function traitOfferContextProjection(context: PendingTraitOfferContext): readonly unknown[] {
  return Object.freeze([
    context.traitHistory,
    context.arcanaFear,
    context.keepsakes,
    context.equipment,
    context.rewardHistory.useRecord.SpellDrop ?? 0,
    context.rewardHistory.lastRewardRecreation ?? null,
    context.stygianWell.yarnUses,
    context.stygianWell.hymnUses,
  ]);
}

export function pendingTraitOffersProjection(state: SimulationState): readonly unknown[] {
  return Object.keys(state.pendingTraitOffers)
    .sort()
    .map((room) => {
      const records = state.pendingTraitOffers[room]!;
      return [
        room,
        Object.keys(records)
          .sort()
          .map((key) => {
            const record = records[key]!;
            return [
              key,
              record.stale,
              record.stale ? null : traitOfferContextProjection(record.context),
            ];
          }),
      ];
    });
}
