import { catalog } from '@run-planner/hades2-catalog';
import { createOccurrenceId, type OccurrenceId } from '@run-planner/engine/authored-project';

/** Exact declaration-owned local identities required by one N Hub target fixture. */
export function nLocalOccurrenceIds(
  hubSlotKey: string,
  prefix: string,
): Readonly<Record<string, OccurrenceId>> {
  const progression = catalog.biomeLayouts.byKey.N?.progression;
  const slot =
    progression?.kind === 'hub'
      ? progression.slots.find((candidate) => candidate.slotKey === hubSlotKey)
      : undefined;
  const group =
    slot === undefined ? undefined : catalog.rooms.byKey[slot.roomGameName]?.localChildren[0];
  return Object.freeze(
    Object.fromEntries(
      group?.kind === 'fixedRoomSlots'
        ? group.slots.map((local) => [
            local.slotKey,
            createOccurrenceId(`${prefix}-${hubSlotKey}-${local.slotKey}`),
          ])
        : [],
    ),
  );
}
