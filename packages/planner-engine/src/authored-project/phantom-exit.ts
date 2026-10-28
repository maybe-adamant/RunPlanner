import type { Catalog, PhantomPlaceholderSet, RoomDeclaration } from '../catalog-schema';
import type { CountedRewardBinding } from '../reward-kernel/bindings';
import type { PhantomExitState } from './model';

/** Whether this room's hidden return door fills a placeholder when its doors first unlock. */
export function roomHasPhantomExit(room: RoomDeclaration | undefined): boolean {
  return room?.phantomExit !== undefined;
}

/** An unpinned exit: the simulation settles both fields. */
export function createDefaultPhantomExit(): PhantomExitState {
  return Object.freeze({ placeholderRoomGameName: null, rewardType: null });
}

/** The placeholder rooms this room's phantom exit may draw, in settlement order. */
export function phantomPlaceholderSet(
  catalog: Catalog,
  room: RoomDeclaration,
): PhantomPlaceholderSet | undefined {
  const setKey = room.phantomExit?.placeholderRoomSetKey;
  const progression = catalog.biomeLayouts.byKey[room.roomSetKey]?.progression;
  if (setKey === undefined || progression?.kind !== 'hub') return undefined;
  return progression.phantomExits.placeholderSets.byKey[setKey];
}

/** The draw a placeholder takes: its individual, else forced, store under its own binding. */
export interface PhantomPlaceholderDraw {
  readonly storeKey: string;
  readonly binding: CountedRewardBinding;
}

/** Undefined for a placeholder whose fixed or Shop reward returns before any store draw. */
export function phantomPlaceholderDraw(
  catalog: Catalog,
  placeholderRoomGameName: string,
): PhantomPlaceholderDraw | undefined {
  const room = catalog.rooms.byKey[placeholderRoomGameName];
  const binding = room?.incomingReward;
  const storeKey = room?.individualRewardStoreKey ?? room?.forcedRewardStoreKey;
  if (binding?.kind !== 'countedChoice' || storeKey === undefined) return undefined;
  return Object.freeze({ storeKey, binding });
}

/** Every reward type the placeholder's store can offer under its binding, in store order. */
export function phantomPlaceholderRewardTypes(
  catalog: Catalog,
  placeholderRoomGameName: string,
): readonly string[] {
  const draw = phantomPlaceholderDraw(catalog, placeholderRoomGameName);
  const store = draw === undefined ? undefined : catalog.rewards.stores.byKey[draw.storeKey];
  if (draw === undefined || store === undefined) return Object.freeze([]);
  const { eligibleRewardTypes, ineligibleRewardTypes } = draw.binding;
  return Object.freeze([
    ...new Set(
      store.entries
        .map((entry) => entry.rewardType)
        .filter(
          (rewardType) =>
            (eligibleRewardTypes.length === 0 || eligibleRewardTypes.includes(rewardType)) &&
            !ineligibleRewardTypes.includes(rewardType),
        ),
    ),
  ]);
}

/**
 * The static domain of an authored phantom exit: a pinned room from the
 * room's set other than itself, and a pinned reward only beside a pinned room
 * whose store offers it. Eligibility at the unlock is the simulation's.
 */
export function phantomExitDomainError(
  catalog: Catalog,
  room: RoomDeclaration,
  value: PhantomExitState,
): string | undefined {
  const set = phantomPlaceholderSet(catalog, room);
  if (set === undefined) return `${room.gameName} declares no phantom exit`;
  const placeholder = value.placeholderRoomGameName;
  if (placeholder !== null) {
    if (placeholder === room.gameName) return 'a room is never its own placeholder';
    if (!set.roomGameNames.includes(placeholder))
      return `${placeholder} is not a ${set.key} placeholder`;
  }
  if (value.rewardType === null) return undefined;
  if (placeholder === null) return 'a pinned reward requires a pinned placeholder room';
  if (!phantomPlaceholderRewardTypes(catalog, placeholder).includes(value.rewardType))
    return `${placeholder} draws no ${value.rewardType}`;
  return undefined;
}
