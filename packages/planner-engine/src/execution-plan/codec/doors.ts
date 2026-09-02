import type { ExecutionDoors } from '../model';
import { MAX_OWNER_STRING, array, exact, fail, integer, object, stringValue } from './primitives';
import { reward } from './rewards';
import { roomReference } from './room';

export function doors(value: unknown, label: string): ExecutionDoors {
  const record = object(value, label);
  if (record.kind === 'batch') {
    exact(record, ['kind', 'owner', 'targets'], ['resolvedSharedRewardStoreKey'], label);
    const targets = array(record.targets, `${label}.targets`).map((entry, index) => {
      const row = object(entry, `${label}.targets[${index}]`);
      exact(row, ['exitKey', 'index', 'room'], ['reward'], `${label}.targets[${index}]`);
      return Object.freeze({
        exitKey: stringValue(row.exitKey, `${label}.targets[${index}].exitKey`),
        index: integer(row.index, `${label}.targets[${index}].index`),
        room: roomReference(row.room, `${label}.targets[${index}].room`),
        ...(row.reward === undefined
          ? {}
          : { reward: reward(row.reward, `${label}.targets[${index}].reward`) }),
      });
    });
    return Object.freeze({
      kind: 'batch',
      owner: stringValue(record.owner, `${label}.owner`, MAX_OWNER_STRING),
      targets: Object.freeze(targets),
      ...(record.resolvedSharedRewardStoreKey === undefined
        ? {}
        : {
            resolvedSharedRewardStoreKey: stringValue(
              record.resolvedSharedRewardStoreKey,
              `${label}.resolvedSharedRewardStoreKey`,
            ),
          }),
    });
  }
  if (record.kind === 'fixed') {
    exact(record, ['kind', 'owner', 'target'], [], label);
    return Object.freeze({
      kind: 'fixed',
      owner: stringValue(record.owner, `${label}.owner`, MAX_OWNER_STRING),
      target: roomReference(record.target, `${label}.target`),
    });
  }
  if (record.kind === 'terminal') {
    exact(record, ['kind', 'owner'], [], label);
    return Object.freeze({
      kind: 'terminal',
      owner: stringValue(record.owner, `${label}.owner`, MAX_OWNER_STRING),
    });
  }
  fail(`${label}.kind is unsupported`);
}
