import type {
  Catalog,
  EncounterCustomizationDecision,
  ExtraExitLockHostDeclaration,
} from '../catalog-schema';
import type { AuthoredEncounterCustomization, RoomOccurrence, UnlockExitRoomAction } from './model';
import { customizationValueKnown } from './room-state/encounter-customization';
import { physicalExitKey } from './topology/query';

export function extraExitLockHost(
  catalog: Catalog,
  gameName: string,
): ExtraExitLockHostDeclaration | undefined {
  return catalog.extraExitLocks.hosts.byKey[gameName];
}

/** The room's doors that can lock, by exit key in exit order; none outside a lock host. */
export function lockableExitKeys(catalog: Catalog, gameName: string): readonly string[] {
  return Object.freeze(
    (extraExitLockHost(catalog, gameName)?.lockableExits ?? []).map((exit) =>
      physicalExitKey(exit.index),
    ),
  );
}

/** An exit key list in exit order, as the authored leaf stores it. */
export function orderedLockedExits(
  catalog: Catalog,
  gameName: string,
  exitKeys: readonly string[],
): readonly string[] {
  const order = lockableExitKeys(catalog, gameName);
  return Object.freeze(
    [...new Set(exitKeys)].sort((left, right) => order.indexOf(left) - order.indexOf(right)),
  );
}

/**
 * Why these doors cannot be authored locked: the room must be a lock host,
 * each door one that can lock (never the first), and no challenge switch may
 * stand in the room, since the game rolls the lock only where none spawned.
 */
export function lockedExitsIssue(
  catalog: Catalog,
  occurrence: Pick<RoomOccurrence, 'gameName' | 'challengeSwitch'>,
  exitKeys: readonly string[],
): string | undefined {
  if (exitKeys.length === 0) return undefined;
  if (extraExitLockHost(catalog, occurrence.gameName) === undefined)
    return `${occurrence.gameName} cannot lock its doors`;
  const lockable = new Set(lockableExitKeys(catalog, occurrence.gameName));
  const unlockable = exitKeys.find((exitKey) => !lockable.has(exitKey));
  if (unlockable !== undefined)
    return unlockable === physicalExitKey(1)
      ? 'the first door never locks'
      : `${unlockable} is not a door of ${occurrence.gameName} that can lock`;
  if (occurrence.challengeSwitch !== undefined)
    return 'a room with a challenge switch never locks its doors';
  return undefined;
}

/** The locked-door fight a host's press starts. */
export function unlockExitEncounterKey(catalog: Catalog, gameName: string): string | undefined {
  return extraExitLockHost(catalog, gameName)?.encounterKey;
}

/** The customization decisions that fight declares. */
export function unlockExitCustomizationDecisions(
  catalog: Catalog,
  gameName: string,
): readonly EncounterCustomizationDecision[] {
  const key = unlockExitEncounterKey(catalog, gameName);
  return (
    (key === undefined ? undefined : catalog.encounterDefinitions.byKey[key]?.customization) ?? []
  );
}

/** Why one decision value of a locked door's fight cannot be authored at this host. */
export function unlockExitCustomizationIssue(
  catalog: Catalog,
  gameName: string,
  decisionKey: string,
  value: AuthoredEncounterCustomization,
): string | undefined {
  const decisions = unlockExitCustomizationDecisions(catalog, gameName);
  if (!decisions.some((decision) => decision.key === decisionKey))
    return `${decisionKey} is not a declared decision of the locked door's fight`;
  if (!customizationValueKnown(decisions, decisionKey, value))
    return `${decisionKey} is outside its declaration domain`;
  return undefined;
}

/** The press of one locked exit, as it enters the room's order. */
export function unlockExitAction(exitKey: string): UnlockExitRoomAction {
  return Object.freeze({ kind: 'unlockExit', exitKey });
}

/** Each authored press of a locked exit, in order. */
export function unlockExitActions(
  occurrence: Pick<RoomOccurrence, 'roomActions'>,
): readonly UnlockExitRoomAction[] {
  return occurrence.roomActions.order.flatMap((reference) =>
    reference.kind === 'unlockExit' ? [reference] : [],
  );
}
