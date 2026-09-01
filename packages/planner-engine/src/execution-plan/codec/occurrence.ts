import type { ExecutionAnomalyReplacement, ExecutionOccurrence } from '../model';
import { booleanValue, exact, object, stringValue } from './primitives';
import { runState } from './diagnostics';
import { doors } from './doors';
import { overview } from './overview';
import { timeline } from './timeline';

export function occurrence(value: unknown, index: number): ExecutionOccurrence {
  const label = `occurrences[${index}]`;
  const record = object(value, label);
  exact(
    record,
    ['id', 'owner', 'biomeKey', 'gameName', 'kind', 'overview', 'timeline', 'doors'],
    ['anomaly', 'diagnostics'],
    label,
  );
  const anomaly =
    record.anomaly === undefined ? undefined : object(record.anomaly, `${label}.anomaly`);
  if (anomaly !== undefined)
    exact(anomaly, ['replacedRoomGameName', 'success'], [], `${label}.anomaly`);
  const parsedAnomaly: ExecutionAnomalyReplacement | undefined =
    anomaly === undefined
      ? undefined
      : Object.freeze({
          replacedRoomGameName: stringValue(
            anomaly.replacedRoomGameName,
            `${label}.anomaly.replacedRoomGameName`,
          ),
          success: booleanValue(anomaly.success, `${label}.anomaly.success`),
        });
  const diagnostics =
    record.diagnostics === undefined
      ? undefined
      : object(record.diagnostics, `${label}.diagnostics`);
  if (diagnostics !== undefined)
    exact(diagnostics, [], ['roomEntered', 'beforeRoomExit'], `${label}.diagnostics`);
  return Object.freeze({
    id: stringValue(record.id, `${label}.id`, 256),
    owner: stringValue(record.owner, `${label}.owner`, 256),
    biomeKey: stringValue(record.biomeKey, `${label}.biomeKey`),
    gameName: stringValue(record.gameName, `${label}.gameName`),
    kind: stringValue(record.kind, `${label}.kind`),
    ...(parsedAnomaly === undefined ? {} : { anomaly: parsedAnomaly }),
    overview: overview(record.overview, `${label}.overview`),
    timeline: timeline(record.timeline, `${label}.timeline`),
    doors: doors(record.doors, `${label}.doors`),
    ...(diagnostics === undefined
      ? {}
      : {
          diagnostics: Object.freeze({
            ...(diagnostics.roomEntered === undefined
              ? {}
              : {
                  roomEntered: runState(
                    diagnostics.roomEntered,
                    `${label}.diagnostics.roomEntered`,
                  ),
                }),
            ...(diagnostics.beforeRoomExit === undefined
              ? {}
              : {
                  beforeRoomExit: runState(
                    diagnostics.beforeRoomExit,
                    `${label}.diagnostics.beforeRoomExit`,
                  ),
                }),
          }),
        }),
  });
}
