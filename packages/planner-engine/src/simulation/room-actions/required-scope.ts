import { roomActionKey } from '../../authored-project/room-actions/state';
import { timedPickupDueBounds } from '../../authored-project/room-actions/domain';
import {
  cagePhase,
  fieldsRoom,
  nextWheelsOpen,
  phaseOfWheel,
  playsPhase,
  roomActionOpeningPoint,
  wheelOfPhase,
  roomEventPlaces,
  type RoomActionBounds,
  type RoomEventGraph,
} from '../../authored-project/room-actions/event-graph';
import type { RoomActionContact, RoomActionRow, RoomActionRowLabel } from './model';

/** A row before its contact, label and required scope are named. */
export type RoomActionRowFacts = Omit<RoomActionRow, 'contact' | 'label'>;

/** The one classification of a row's bounds; the first rule that matches wins. */
function roomActionContact(bounds: RoomActionBounds, graph: RoomEventGraph): RoomActionContact {
  const last = graph.phases.at(-1)?.phaseKey;
  const phase = (phaseKey: string | undefined) => (phaseKey === undefined ? {} : { phaseKey });
  const played = (phaseKey: string) => phase(playsPhase(graph, phaseKey) ? phaseKey : undefined);
  const { spawn, enabler } = bounds;
  if (enabler?.kind === 'doorsOpened' || enabler?.kind === 'exitsReady')
    return Object.freeze({ kind: 'afterDoorsOpen', ...phase(last) });
  if (enabler?.kind === 'gate') {
    const wheelKey = wheelOfPhase(graph, enabler.phaseKey);
    if (wheelKey !== undefined)
      return Object.freeze({ kind: 'beforeWheelPhase', wheelKey, ...played(enabler.phaseKey) });
    // A wheel row whose phase the room no longer plays stays at its wheel's roll.
    if (spawn.kind !== 'wheelsOpen')
      return Object.freeze({ kind: 'beforeCombat', ...played(enabler.phaseKey) });
  }
  switch (spawn.kind) {
    case 'wheelsOpen':
      return Object.freeze({
        kind: 'beforeWheelChoice',
        wheelKey: spawn.wheelKey,
        ...phase(phaseOfWheel(graph, spawn.wheelKey)),
      });
    case 'endEffects': {
      const endedPhaseKey = spawn.phaseKey;
      const phaseKey = playsPhase(graph, endedPhaseKey)
        ? (nextWheelsOpen(graph, endedPhaseKey)?.phaseKey ?? endedPhaseKey)
        : undefined;
      // A Fields cage's due pickups stand with the room's free cage rows.
      return Object.freeze({
        kind: cagePhase(graph, endedPhaseKey)
          ? ('fields' as const)
          : ('afterEncounterEnd' as const),
        endedPhaseKey,
        ...phase(phaseKey),
      });
    }
    case 'encounterEnd': {
      const wheelKey = wheelOfPhase(graph, spawn.phaseKey);
      const phaseKey = playsPhase(graph, spawn.phaseKey) ? spawn.phaseKey : last;
      if (wheelKey !== undefined)
        return Object.freeze({ kind: 'afterWheelPhase', wheelKey, ...phase(phaseKey) });
      return Object.freeze(
        fieldsRoom(graph)
          ? { kind: 'fields', endedPhaseKey: spawn.phaseKey, ...phase(phaseKey) }
          : { kind: 'afterCombat', ...phase(last) },
      );
    }
    default:
      return Object.freeze({ kind: fieldsRoom(graph) ? 'fields' : 'afterCombat', ...phase(last) });
  }
}

/** The contact as the editor names it. */
function contactLabel(contact: RoomActionContact): RoomActionRowLabel {
  switch (contact.kind) {
    case 'beforeWheelPhase':
    case 'beforeWheelChoice':
    case 'afterWheelPhase':
      return contact;
    case 'afterEncounterEnd':
      // Its phase is the next one when that phase's wheel waits on it.
      return Object.freeze({
        kind: contact.kind,
        phaseKey: contact.endedPhaseKey,
        ...(contact.phaseKey === undefined || contact.phaseKey === contact.endedPhaseKey
          ? {}
          : { beforeWheelChoicePhaseKey: contact.phaseKey }),
      });
    default:
      return Object.freeze({ kind: contact.kind });
  }
}

/** A row's contact and label, classified from its bounds. */
export function roomActionRowContact(
  bounds: RoomActionBounds,
  graph: RoomEventGraph,
): { readonly contact: RoomActionContact; readonly label: RoomActionRowLabel } {
  const contact = roomActionContact(bounds, graph);
  return Object.freeze({ contact, label: contactLabel(contact) });
}

/**
 * Where a due delivery or clocked drop meets the room: the phase it groups
 * with (the next wheel phase when that wheel's choice waits on it), its
 * contact and its label.
 */
export interface TimedPickupDueContact {
  readonly phaseKey?: string;
  readonly contact: RoomActionContact;
  readonly label: RoomActionRowLabel;
}

/**
 * The contact of a delivery or clocked drop at its due spawn: the phase whose
 * end effects spawned it, or none for a Preboss flush.
 */
export function timedPickupDueContact(
  graph: RoomEventGraph,
  endedPhaseKey: string | undefined,
): TimedPickupDueContact {
  const { contact, label } = roomActionRowContact(
    timedPickupDueBounds(graph, endedPhaseKey),
    graph,
  );
  return Object.freeze({
    ...(contact.phaseKey === undefined ? {} : { phaseKey: contact.phaseKey }),
    contact,
    label,
  });
}

/**
 * Classifies existing obligations and names each row's contact, with its phase
 * and label; it does not add ordering or participation constraints.
 */
export function withRequiredScopes(
  rows: readonly RoomActionRowFacts[],
  structure: RoomEventGraph,
): readonly RoomActionRow[] {
  const phaseBound = new Set<string>();
  const active = rows.filter(
    (row) => !row.stale && (row.participation === 'required' || row.rank !== null),
  );
  const place = roomEventPlaces(structure);
  const last = structure.phases.at(-1)?.phaseKey;
  const roomEnd =
    last === undefined ? 1 : place(Object.freeze({ kind: 'encounterEnd', phaseKey: last }));
  const fields = fieldsRoom(structure);
  const contacts = new Map(rows.map((row) => [row, roomActionContact(row.bounds, structure)]));
  for (const row of active) {
    const contact = contacts.get(row)!;
    if (
      row.reference.kind === 'completeFieldsCage' ||
      contact.kind === 'beforeWheelPhase' ||
      contact.kind === 'beforeWheelChoice' ||
      contact.kind === 'afterWheelPhase' ||
      (!fields &&
        contact.kind !== 'afterDoorsOpen' &&
        structure.phases.length > 0 &&
        place(roomActionOpeningPoint(row.bounds)) < roomEnd)
    )
      phaseBound.add(row.key);
  }
  // A prerequisite inherits an encounter deadline from the action that needs it.
  // In Fields this captures Gorgon/NPC barriers without treating cage rewards as phase-local.
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of active) {
      if (!phaseBound.has(row.key)) continue;
      for (const dependency of row.dependencies) {
        const key = roomActionKey(dependency.action);
        if (phaseBound.has(key)) continue;
        phaseBound.add(key);
        changed = true;
      }
    }
  }
  return Object.freeze(
    rows.map((previous) => {
      const row = { ...previous };
      delete row.requiredScope;
      const contact = contacts.get(previous)!;
      return Object.freeze({
        ...row,
        contact,
        label: contactLabel(contact),
        ...(row.stale || row.participation !== 'required'
          ? {}
          : {
              requiredScope: phaseBound.has(row.key) ? ('phase' as const) : ('room' as const),
            }),
      });
    }),
  );
}
