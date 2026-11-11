import { roomActionKey } from '@run-planner/engine/authored-project';
import type {
  RoomEvent,
  RoomEventTrigger,
} from '../../src/authored-project/room-actions/event-graph';
import { compactActionKey } from './lifecycle-snapshots';

function triggerText(trigger: RoomEventTrigger): string {
  return trigger.kind === 'action' ? compactActionKey(roomActionKey(trigger.action)) : trigger.kind;
}

/** One graph event: its kind and phase or wheel, then what fires it. */
export function roomEventText(event: RoomEvent): string {
  const record = event as unknown as Record<string, unknown>;
  const key = event.kind === 'wheelsOpen' ? event.wheelKey : record.phaseKey;
  return `${event.kind}${typeof key === 'string' ? `(${key})` : ''} <- ${triggerText(event.trigger)}`;
}

/** One expected encounter phase; each event is automatic unless a row is named. */
export interface ExpectedGraphPhase {
  readonly phaseKey: string;
  /** The wheel whose Wheels open precedes the phase. */
  readonly wheelKey?: string;
  /** The compact key of the row that starts Combat. */
  readonly startedBy?: string;
  readonly bossDefeated?: true;
}

/** The expected event texts: entry, each phase in order, then Doors open. */
export function expectedRoomEventGraph(
  phases: readonly ExpectedGraphPhase[] = [],
): readonly string[] {
  return [
    'roomEntered <- automatic',
    ...phases.flatMap((phase) => [
      ...(phase.wheelKey === undefined ? [] : [`wheelsOpen(${phase.wheelKey}) <- automatic`]),
      `encounterBegun(${phase.phaseKey}) <- automatic`,
      `encounterStarted(${phase.phaseKey}) <- ${phase.startedBy ?? 'automatic'}`,
      ...(phase.bossDefeated === true ? [`bossDefeated(${phase.phaseKey}) <- automatic`] : []),
      `encounterEnd(${phase.phaseKey}) <- automatic`,
    ]),
    'doorsOpened <- doorsPredicate',
  ];
}
