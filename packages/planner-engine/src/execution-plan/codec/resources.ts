import type { ExecutionResourcePolicy } from '../model';
import { array, exact, fail, object, stringValue } from './primitives';

const families = ['Pickaxe', 'Exorcism', 'Shovel', 'Fishing'] as const;

export function resources(value: unknown, label: string): ExecutionResourcePolicy {
  const record = object(value, label);
  exact(record, ['occurrences'], [], label);
  const occurrences = array(record.occurrences, `${label}.occurrences`).map((value, index) => {
    const rowLabel = `${label}.occurrences[${index}]`;
    const row = object(value, rowLabel);
    exact(row, ['occurrenceId', 'pointDispositions'], [], rowLabel);
    const pointsRecord = object(row.pointDispositions, `${rowLabel}.pointDispositions`);
    exact(pointsRecord, families, [], `${rowLabel}.pointDispositions`);
    const pointDispositions = Object.freeze(
      Object.fromEntries(
        families.map((key) => {
          const disposition = stringValue(
            pointsRecord[key],
            `${rowLabel}.pointDispositions.${key}`,
          );
          if (disposition !== 'native' && disposition !== 'suppress' && disposition !== 'force')
            fail(`${rowLabel}.pointDispositions.${key} is unsupported`);
          return [key, disposition];
        }),
      ) as ExecutionResourcePolicy['occurrences'][number]['pointDispositions'],
    );
    return Object.freeze({
      occurrenceId: stringValue(row.occurrenceId, `${rowLabel}.occurrenceId`),
      pointDispositions,
    });
  });
  return Object.freeze({
    occurrences: Object.freeze(occurrences),
  });
}
