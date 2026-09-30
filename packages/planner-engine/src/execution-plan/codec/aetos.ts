import type { ExecutionOlympusAetos, ExecutionOccurrence } from '../model';
import { exact, fail, object, stringValue } from './primitives';

export function olympusAetos(
  value: unknown,
  biomeKeys: readonly string[],
  selected: readonly string[],
  occurrences: readonly ExecutionOccurrence[],
): ExecutionOlympusAetos | undefined {
  if (!biomeKeys.includes('P')) {
    if (value !== undefined) fail('execution plan.olympusAetos is outside extent');
    return undefined;
  }
  const record = object(value, 'execution plan.olympusAetos');
  if (record.kind === 'none') {
    exact(record, ['kind'], [], 'execution plan.olympusAetos');
    return Object.freeze({ kind: 'none' });
  }
  exact(record, ['kind', 'occurrenceId', 'phaseKey', 'wave'], [], 'execution plan.olympusAetos');
  if (
    record.kind !== 'target' ||
    !Number.isInteger(record.wave) ||
    (record.wave !== 2 && record.wave !== 3)
  )
    fail('execution plan.olympusAetos target is invalid');
  const occurrenceId = stringValue(record.occurrenceId, 'execution plan.olympusAetos.occurrenceId');
  const phaseKey = stringValue(record.phaseKey, 'execution plan.olympusAetos.phaseKey');
  const room = occurrences.find((entry) => entry.id === occurrenceId);
  if (
    !selected.includes(occurrenceId) ||
    room?.biomeKey !== 'P' ||
    !room.overview.encounterPhases.some((phase) => phase.slotKey === phaseKey)
  )
    fail('execution plan.olympusAetos target is unresolved');
  return Object.freeze({ kind: 'target', occurrenceId, phaseKey, wave: record.wave as number });
}
