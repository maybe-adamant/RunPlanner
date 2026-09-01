import { exact, object, stringValue } from './primitives';

export function roomReference(value: unknown, label: string) {
  const record = object(value, label);
  exact(record, ['id', 'biomeKey', 'gameName'], [], label);
  return Object.freeze({
    id: stringValue(record.id, `${label}.id`, 256),
    biomeKey: stringValue(record.biomeKey, `${label}.biomeKey`),
    gameName: stringValue(record.gameName, `${label}.gameName`),
  });
}
