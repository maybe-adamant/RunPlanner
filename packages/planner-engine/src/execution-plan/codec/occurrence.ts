import type {
  ExecutionAnomalyReplacement,
  ExecutionBiomeKey,
  ExecutionOccurrence,
  ExecutionRoomExitConformanceFactKind,
} from '../model';
import {
  MAX_OWNER_STRING,
  array,
  booleanValue,
  exact,
  fail,
  object,
  stringValue,
} from './primitives';
import type { ExecutionFieldsLayout } from '../model';
import { runState } from './diagnostics';
import { doors } from './doors';
import { overview } from './overview';
import { timeline } from './timeline';

function validateFieldsCageSlots(
  layout: ExecutionFieldsLayout,
  encounterPhases: readonly { readonly slotKey: string }[],
  label: string,
): void {
  const activeCagePhases = encounterPhases.filter((phase) => /^Cage\d+$/.test(phase.slotKey));
  if (activeCagePhases.length !== layout.cagePoints.length)
    fail(`${label}.cagePoints must match the active cage encounter phases`);
  activeCagePhases.forEach((phase, index) => {
    const expectedPhase = `Cage${String(index + 1).padStart(2, '0')}`;
    const expectedSlot = `cage${index + 1}`;
    if (phase.slotKey !== expectedPhase || layout.cagePoints[index]?.slotKey !== expectedSlot)
      fail(`${label}.cagePoints must use canonical ordered cage slots`);
  });
}

export function occurrence(value: unknown, index: number): ExecutionOccurrence {
  const label = `occurrences[${index}]`;
  const record = object(value, label);
  exact(
    record,
    ['id', 'owner', 'biomeKey', 'gameName', 'kind', 'overview', 'timeline', 'doors'],
    ['anomaly', 'roomExitConformance', 'diagnostics'],
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
  const conformance =
    record.roomExitConformance === undefined
      ? undefined
      : object(record.roomExitConformance, `${label}.roomExitConformance`);
  if (conformance !== undefined) exact(conformance, ['facts'], [], `${label}.roomExitConformance`);
  const allowedConformanceKinds = new Set<ExecutionRoomExitConformanceFactKind>([
    'traitInventory',
    'elementCounts',
    'echoShopDuplicate',
    'steadyGrowth',
    'chaos',
    'keepsakeEffects',
    'rewardPriorities',
    'pathOfStars',
    'forfeit',
    'hermesShrineDeliveries',
    'stygianWell',
  ]);
  const conformanceFacts =
    conformance === undefined
      ? undefined
      : array(conformance.facts, `${label}.roomExitConformance.facts`).map((value, factIndex) => {
          const fact = object(value, `${label}.roomExitConformance.facts[${factIndex}]`);
          exact(fact, ['kind'], [], `${label}.roomExitConformance.facts[${factIndex}]`);
          const kind = stringValue(
            fact.kind,
            `${label}.roomExitConformance.facts[${factIndex}].kind`,
          ) as ExecutionRoomExitConformanceFactKind;
          if (!allowedConformanceKinds.has(kind))
            fail(`${label}.roomExitConformance.facts[${factIndex}].kind is unsupported`);
          return Object.freeze({ kind });
        });
  const parsedOverview = overview(record.overview, `${label}.overview`);
  const isFieldsEncounter = record.kind === 'FieldsEncounter';
  const hasFieldsLayout = parsedOverview.fields !== undefined;
  if (isFieldsEncounter !== hasFieldsLayout)
    fail(`${label}.overview.fields is required exactly for H Fields encounters`);
  if (hasFieldsLayout && record.biomeKey !== 'H')
    fail(`${label}.overview.fields is only valid for H Fields encounters`);
  if (parsedOverview.fields !== undefined)
    validateFieldsCageSlots(
      parsedOverview.fields,
      parsedOverview.encounterPhases,
      `${label}.overview.fields`,
    );
  const biomeKey = stringValue(record.biomeKey, `${label}.biomeKey`);
  if (!['F', 'G', 'H', 'I', 'N', 'O', 'P', 'Q'].includes(biomeKey))
    fail(`${label}.biomeKey is unsupported`);
  return Object.freeze({
    id: stringValue(record.id, `${label}.id`, 256),
    owner: stringValue(record.owner, `${label}.owner`, MAX_OWNER_STRING),
    biomeKey: biomeKey as ExecutionBiomeKey,
    gameName: stringValue(record.gameName, `${label}.gameName`),
    kind: stringValue(record.kind, `${label}.kind`),
    ...(parsedAnomaly === undefined ? {} : { anomaly: parsedAnomaly }),
    overview: parsedOverview,
    timeline: timeline(record.timeline, `${label}.timeline`),
    doors: doors(record.doors, `${label}.doors`),
    ...(conformanceFacts === undefined
      ? {}
      : { roomExitConformance: Object.freeze({ facts: Object.freeze(conformanceFacts) }) }),
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
