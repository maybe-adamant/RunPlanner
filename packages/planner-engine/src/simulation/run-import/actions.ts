import {
  createBiomeAddress,
  createRoomActionAddress,
  roomActionKey,
  type OccurrenceId,
  type RoomActionReference,
} from '../../authored-project';
import {
  roomActionDomainForOccurrence,
  scheduleRequiredRoomActions,
} from '../../authored-project/room-actions/defaults';
import type { RunImportContext } from './import';

/** The address of one room action of an occurrence. */
export function roomActionAddress(
  context: RunImportContext,
  biomeKey: string,
  occurrenceId: string,
  reference: RoomActionReference,
) {
  return createRoomActionAddress(
    createBiomeAddress(context.assembly().project.route.routeKey, biomeKey),
    occurrenceId as OccurrenceId,
    roomActionKey(reference),
  );
}

/** Inserts an optional room action at its native default position, unless that adds a finding. */
export function insertRoomAction(
  context: RunImportContext,
  biomeKey: string,
  occurrenceId: string,
  reference: RoomActionReference,
): boolean {
  const project = context.assembly().project;
  const host = roomActionDomainForOccurrence(
    project,
    context.catalog,
    createBiomeAddress(project.route.routeKey, biomeKey),
    occurrenceId as OccurrenceId,
  );
  if (host === undefined) return false;
  const key = roomActionKey(reference);
  if (host.occurrence.roomActions.order.some((entry) => roomActionKey(entry) === key)) return true;
  const scheduled = scheduleRequiredRoomActions({
    catalog: context.catalog,
    domain: host.domain,
    order: host.occurrence.roomActions.order,
    requiredKeys: new Set([key]),
    participation: 'any',
  });
  const index = scheduled.findIndex((entry) => roomActionKey(entry) === key);
  return (
    index >= 0 &&
    context.applyValid({
      kind: 'InsertRoomAction',
      action: roomActionAddress(context, biomeKey, occurrenceId, reference),
      reference,
      index,
    })
  );
}

/** Removes a room action, unless that adds a finding. */
export function removeRoomAction(
  context: RunImportContext,
  biomeKey: string,
  occurrenceId: string,
  reference: RoomActionReference,
): boolean {
  return context.applyValid({
    kind: 'RemoveRoomAction',
    action: roomActionAddress(context, biomeKey, occurrenceId, reference),
  });
}
