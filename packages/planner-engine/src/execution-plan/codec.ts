import {
  EXECUTION_CATALOG_VERSION,
  EXECUTION_PLAN_FORMAT,
  EXECUTION_PROTOCOL_VERSION,
  type ExecutionPlan,
  type ExecutionStartingKeepsake,
} from './model';
import {
  ExecutionPlanCodecError,
  array,
  exact,
  fail,
  fingerprint,
  object,
  stringArray,
  stringValue,
  type Dict,
} from './codec/primitives';
import { diagnosticSections, expandDiagnosticFrames, wireDiagnostic } from './codec/diagnostics';
import { equipResults } from './codec/rewards';
import { occurrence } from './codec/occurrence';
import { validateExecutionReferences } from './codec/references';
import { startingLoadout } from './codec/loadout';
import { resources } from './codec/resources';

export { ExecutionPlanCodecError };

export function encodeExecutionPlan(plan: ExecutionPlan): string {
  decodeExecutionPlan(plan);
  let frame = 0;
  let prior: Dict | undefined;
  const occurrences = plan.occurrences.map((entry) => {
    if (entry.diagnostics === undefined) return entry;
    const diagnostics: Dict = {};
    for (const checkpoint of ['roomEntered', 'beforeRoomExit'] as const) {
      const state = entry.diagnostics[checkpoint];
      if (state === undefined) continue;
      diagnostics[checkpoint] = wireDiagnostic(state, frame, prior);
      prior = Object.fromEntries(
        diagnosticSections.map((section) => [section, (state as unknown as Dict)[section]]),
      );
      frame += 1;
    }
    return { ...entry, diagnostics };
  });
  return JSON.stringify({ ...plan, occurrences });
}

export function decodeExecutionPlan(value: unknown): ExecutionPlan {
  const record = expandDiagnosticFrames(value);
  exact(
    record,
    [
      'format',
      'protocolVersion',
      'catalogVersion',
      'projectId',
      'planFingerprint',
      'routeKey',
      'startingLoadout',
      'startingKeepsake',
      'extent',
      'selectedOccurrenceIds',
      'resources',
      'occurrences',
    ],
    [],
    'execution plan',
  );
  if (record.format !== EXECUTION_PLAN_FORMAT) fail('execution plan.format is unsupported');
  if (record.protocolVersion !== EXECUTION_PROTOCOL_VERSION)
    fail('execution plan.protocolVersion is unsupported');
  if (record.catalogVersion !== EXECUTION_CATALOG_VERSION)
    fail('execution plan.catalogVersion is unsupported');
  if (record.routeKey !== 'Underworld') fail('execution plan.routeKey is unsupported');
  const extent = object(record.extent, 'execution plan.extent');
  exact(extent, ['kind', 'biomeKeys', 'terminalBiomeKey'], [], 'execution plan.extent');
  if (extent.kind !== 'configuredPrefix') fail('execution plan.extent.kind is unsupported');
  const biomeKeys = stringArray(extent.biomeKeys, 'execution plan.extent.biomeKeys', 2);
  if (
    !(biomeKeys.length === 1 && biomeKeys[0] === 'F') &&
    !(biomeKeys.length === 2 && biomeKeys[0] === 'F' && biomeKeys[1] === 'G')
  )
    fail('execution plan.extent.biomeKeys is unsupported');
  if (extent.terminalBiomeKey !== biomeKeys[biomeKeys.length - 1])
    fail('execution plan.extent.terminalBiomeKey disagrees with biomeKeys');
  const decodedStartingLoadout = startingLoadout(record.startingLoadout);
  const starting = object(record.startingKeepsake, 'execution plan.startingKeepsake');
  exact(starting, ['keepsakeKey'], ['equipResults'], 'execution plan.startingKeepsake');
  const startingKeepsake: ExecutionStartingKeepsake = Object.freeze({
    keepsakeKey: stringValue(starting.keepsakeKey, 'execution plan.startingKeepsake.keepsakeKey'),
    ...(starting.equipResults === undefined
      ? {}
      : {
          equipResults: equipResults(
            starting.equipResults,
            'execution plan.startingKeepsake.equipResults',
          ),
        }),
  });
  const occurrences = Object.freeze(
    array(record.occurrences, 'execution plan.occurrences').map((entry, index) =>
      occurrence(entry, index),
    ),
  );
  const plan = Object.freeze({
    format: EXECUTION_PLAN_FORMAT,
    protocolVersion: EXECUTION_PROTOCOL_VERSION,
    catalogVersion: EXECUTION_CATALOG_VERSION,
    projectId: stringValue(record.projectId, 'execution plan.projectId'),
    planFingerprint: stringValue(record.planFingerprint, 'execution plan.planFingerprint', 64),
    routeKey: 'Underworld' as const,
    startingLoadout: decodedStartingLoadout,
    startingKeepsake,
    extent: Object.freeze({
      kind: 'configuredPrefix' as const,
      biomeKeys: Object.freeze(biomeKeys) as readonly ['F'] | readonly ['F', 'G'],
      terminalBiomeKey: biomeKeys[biomeKeys.length - 1] as 'F' | 'G',
    }),
    selectedOccurrenceIds: Object.freeze(
      stringArray(record.selectedOccurrenceIds, 'execution plan.selectedOccurrenceIds'),
    ),
    resources: resources(record.resources, 'execution plan.resources'),
    occurrences,
  });
  validateExecutionReferences(plan);
  const body = Object.freeze({
    format: plan.format,
    protocolVersion: plan.protocolVersion,
    catalogVersion: plan.catalogVersion,
    projectId: plan.projectId,
    routeKey: plan.routeKey,
    startingLoadout: plan.startingLoadout,
    startingKeepsake: plan.startingKeepsake,
    extent: plan.extent,
    selectedOccurrenceIds: plan.selectedOccurrenceIds,
    resources: plan.resources,
    occurrences: plan.occurrences,
  });
  if (fingerprint(body) !== plan.planFingerprint)
    fail('execution plan.planFingerprint does not match its contents');
  return plan;
}
