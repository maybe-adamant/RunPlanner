import {
  createBiomeAddress,
  createRoomActionAddress,
  roomActionKey,
  type OccurrenceId,
  type RoomActionReference,
  roomActionDomainForOccurrence,
  scheduleRequiredRoomActions,
} from '@run-planner/engine/authored-project';
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

/**
 * Where an optional room action enters the occurrence's order at its native
 * default position: its current index when already ordered, undefined when
 * the occurrence holds no room actions or the schedule places none.
 */
export function nativeRoomActionIndex(
  context: RunImportContext,
  biomeKey: string,
  occurrenceId: string,
  reference: RoomActionReference,
): { readonly index: number; readonly present: boolean } | undefined {
  const project = context.assembly().project;
  const host = roomActionDomainForOccurrence(
    project,
    context.catalog,
    createBiomeAddress(project.route.routeKey, biomeKey),
    occurrenceId as OccurrenceId,
  );
  if (host === undefined) return undefined;
  const key = roomActionKey(reference);
  const current = host.occurrence.roomActions.order.findIndex(
    (entry) => roomActionKey(entry) === key,
  );
  if (current >= 0) return { index: current, present: true };
  const scheduled = scheduleRequiredRoomActions({
    catalog: context.catalog,
    domain: host.domain,
    order: host.occurrence.roomActions.order,
    requiredKeys: new Set([key]),
    participation: 'any',
  });
  const index = scheduled.findIndex((entry) => roomActionKey(entry) === key);
  return index >= 0 ? { index, present: false } : undefined;
}

/** Inserts an optional room action at its native default position, unless that adds a finding. */
export function insertRoomAction(
  context: RunImportContext,
  biomeKey: string,
  occurrenceId: string,
  reference: RoomActionReference,
): boolean {
  const native = nativeRoomActionIndex(context, biomeKey, occurrenceId, reference);
  if (native === undefined) return false;
  return (
    native.present ||
    context.applyValid({
      kind: 'InsertRoomAction',
      action: roomActionAddress(context, biomeKey, occurrenceId, reference),
      reference,
      index: native.index,
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
