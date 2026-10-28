import type { Catalog, RoomDeclaration } from '../../catalog-schema';
import { phantomPlaceholderSet } from '../../authored-project/phantom-exit';
import type { HistoryStateView } from '../history/model';

/** Why `IsRoomEligible` turns a declared placeholder away at this unlock. */
export type PhantomPlaceholderExclusion = 'currentRoom' | 'creationCap';

export interface PhantomPlaceholderCandidate {
  readonly roomGameName: string;
  readonly exclusion?: PhantomPlaceholderExclusion;
}

/** Native `RoomCreations`: board and side doors count with every earlier placeholder. */
function creationCount(view: HistoryStateView, gameName: string): number {
  return (
    view.ledgers.roomCreations.filter((creation) => creation.gameName === gameName).length +
    view.ledgers.phantomExitCreations.filter(
      (creation) => creation.placeholderRoomGameName === gameName,
    ).length
  );
}

/**
 * `ChooseNextRoomData` over the room's placeholder set at its doors unlock,
 * in declared settlement order. The planner's entered-appearance caps do not
 * apply: only the current room and `MaxCreationsThisRun` exclude a candidate.
 * No Ephyra placeholder is forced under the canonical baseline.
 */
export function phantomPlaceholderCandidates(
  catalog: Catalog,
  room: RoomDeclaration,
  view: HistoryStateView,
): readonly PhantomPlaceholderCandidate[] {
  const set = phantomPlaceholderSet(catalog, room);
  if (set === undefined) return Object.freeze([]);
  return Object.freeze(
    set.roomGameNames.map((roomGameName) => {
      const cap = catalog.rooms.byKey[roomGameName]?.caps.maxCreationsThisRun;
      const exclusion: PhantomPlaceholderExclusion | undefined =
        roomGameName === room.gameName
          ? 'currentRoom'
          : cap !== undefined && creationCount(view, roomGameName) >= cap
            ? 'creationCap'
            : undefined;
      return Object.freeze({ roomGameName, ...(exclusion === undefined ? {} : { exclusion }) });
    }),
  );
}

/** The pinned room, else the first eligible candidate; undefined only when none is eligible. */
export function settlePhantomPlaceholder(
  catalog: Catalog,
  room: RoomDeclaration,
  pinned: string | null,
  view: HistoryStateView,
): string | undefined {
  if (pinned !== null) return pinned;
  return phantomPlaceholderCandidates(catalog, room, view).find(
    (candidate) => candidate.exclusion === undefined,
  )?.roomGameName;
}
