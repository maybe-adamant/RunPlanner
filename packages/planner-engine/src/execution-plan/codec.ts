import {
  EXECUTION_RUN_MODIFIER_DECLARATIONS,
  isRunModifierValue,
  type ExecutionRunModifiers,
} from '../authored-project/run-modifiers';
import {
  EXECUTION_CATALOG_VERSION,
  EXECUTION_PLAN_FORMAT,
  type ExecutionPlan,
  type ExecutionKeepsakeRarity,
  type ExecutionStartingKeepsake,
} from './model';
import {
  ExecutionPlanCodecError,
  array,
  exact,
  fail,
  object,
  oneOf,
  RARITY_UPGRADE_ORDER,
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
import { fingerprint } from './fingerprint';
import { olympusAetos } from './codec/aetos';
import { startState } from './codec/start-state';

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

/** Bound on the presentation-only plan name, in Unicode code points (at most 800 UTF-8 bytes). */
export const EXECUTION_DISPLAY_NAME_MAX = 200;

function displayNameValue(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    Array.from(value).length > EXECUTION_DISPLAY_NAME_MAX
  )
    fail('execution plan.displayName must be a bounded non-empty string');
  return value;
}

/** The complete declared record; an optional modifier is present only while enabled. */
function runModifiersRecord(value: unknown): ExecutionRunModifiers {
  const label = 'execution plan.runModifiers';
  const record = object(value, label);
  const declarations = EXECUTION_RUN_MODIFIER_DECLARATIONS;
  exact(
    record,
    declarations.filter((d) => d.kind !== 'optionalPercentage').map((d) => d.key),
    declarations.filter((d) => d.kind === 'optionalPercentage').map((d) => d.key),
    label,
  );
  const decoded: Record<string, boolean | number> = {};
  for (const declaration of declarations) {
    if (!(declaration.key in record)) continue;
    const raw = record[declaration.key];
    if (!isRunModifierValue(declaration, raw))
      fail(`${label}.${declaration.key} is outside its declared domain`);
    decoded[declaration.key] = raw as boolean | number;
  }
  return Object.freeze(decoded) as ExecutionRunModifiers;
}

export function decodeExecutionPlan(value: unknown): ExecutionPlan {
  const record = expandDiagnosticFrames(value);
  exact(
    record,
    [
      'format',
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
    ['displayName', 'olympusAetos', 'runModifiers', 'startState'],
    'execution plan',
  );
  if (record.format !== EXECUTION_PLAN_FORMAT) fail('execution plan.format is unsupported');
  if (record.catalogVersion !== EXECUTION_CATALOG_VERSION)
    fail('execution plan.catalogVersion is unsupported');
  if (
    record.routeKey !== 'Underworld' &&
    record.routeKey !== 'FreshFile' &&
    record.routeKey !== 'Surface' &&
    record.routeKey !== 'Dream'
  )
    fail('execution plan.routeKey is unsupported');
  const extent = object(record.extent, 'execution plan.extent');
  exact(extent, ['kind', 'biomeKeys', 'terminalBiomeKey'], [], 'execution plan.extent');
  if (extent.kind !== 'configuredPrefix') fail('execution plan.extent.kind is unsupported');
  const biomeKeys = stringArray(extent.biomeKeys, 'execution plan.extent.biomeKeys', 4);
  const dreamBiomes = new Set(['F', 'G', 'H', 'I', 'N', 'O', 'P', 'Q']);
  const boundedDreamExtent =
    biomeKeys.length >= 1 &&
    biomeKeys.length <= 4 &&
    biomeKeys.every((key, index) => dreamBiomes.has(key) && biomeKeys.indexOf(key) === index);
  const equalBiomePrefix = (expected: readonly string[]) =>
    biomeKeys.length === expected.length &&
    expected.every((key, index) => biomeKeys[index] === key);
  const validUnderworldPrefix = [['F'], ['F', 'G'], ['F', 'G', 'H'], ['F', 'G', 'H', 'I']].some(
    equalBiomePrefix,
  );
  const validSurfacePrefix = [['N'], ['N', 'O'], ['N', 'O', 'P'], ['N', 'O', 'P', 'Q']].some(
    equalBiomePrefix,
  );
  if (
    ((record.routeKey === 'Underworld' || record.routeKey === 'FreshFile') &&
      !validUnderworldPrefix) ||
    (record.routeKey === 'Surface' && !validSurfacePrefix) ||
    (record.routeKey === 'Dream' && !boundedDreamExtent)
  )
    fail('execution plan.routeKey disagrees with extent');
  if (extent.terminalBiomeKey !== biomeKeys[biomeKeys.length - 1])
    fail('execution plan.extent.terminalBiomeKey disagrees with biomeKeys');
  const runModifiers =
    'runModifiers' in record ? runModifiersRecord(record.runModifiers) : undefined;
  const decodedStartingLoadout = startingLoadout(record.startingLoadout);
  const starting = object(record.startingKeepsake, 'execution plan.startingKeepsake');
  exact(starting, [], ['keepsakeKey', 'rarity', 'equipResults'], 'execution plan.startingKeepsake');
  if (
    starting.keepsakeKey === undefined &&
    (starting.rarity !== undefined || starting.equipResults !== undefined)
  )
    fail('execution plan.startingKeepsake.rarity and equipResults require keepsakeKey');
  let startingKeepsake: ExecutionStartingKeepsake = Object.freeze({});
  if (starting.keepsakeKey !== undefined) {
    const keepsakeKey = stringValue(
      starting.keepsakeKey,
      'execution plan.startingKeepsake.keepsakeKey',
    );
    startingKeepsake = Object.freeze({
      keepsakeKey,
      rarity: oneOf<ExecutionKeepsakeRarity>(
        starting.rarity,
        RARITY_UPGRADE_ORDER,
        'execution plan.startingKeepsake.rarity',
      ),
      ...(starting.equipResults === undefined
        ? {}
        : {
            equipResults: equipResults(
              starting.equipResults,
              'execution plan.startingKeepsake.equipResults',
            ),
          }),
    });
  }
  const occurrences = Object.freeze(
    array(record.occurrences, 'execution plan.occurrences').map((entry, index) =>
      occurrence(entry, index),
    ),
  );
  if (occurrences.some((entry) => !biomeKeys.includes(entry.biomeKey)))
    fail('execution plan.occurrences contains a biome outside extent');
  const selectedOccurrenceIds = Object.freeze(
    stringArray(record.selectedOccurrenceIds, 'execution plan.selectedOccurrenceIds'),
  );
  const aetos = olympusAetos(record.olympusAetos, biomeKeys, selectedOccurrenceIds, occurrences);
  const plan = Object.freeze({
    format: EXECUTION_PLAN_FORMAT,
    catalogVersion: EXECUTION_CATALOG_VERSION,
    projectId: stringValue(record.projectId, 'execution plan.projectId'),
    planFingerprint: stringValue(record.planFingerprint, 'execution plan.planFingerprint', 64),
    ...(record.displayName === undefined
      ? {}
      : {
          displayName: displayNameValue(record.displayName),
        }),
    routeKey: record.routeKey,
    startingLoadout: decodedStartingLoadout,
    ...(runModifiers === undefined ? {} : { runModifiers }),
    startingKeepsake,
    extent: Object.freeze({
      kind: 'configuredPrefix' as const,
      biomeKeys: Object.freeze(biomeKeys),
      terminalBiomeKey: biomeKeys[biomeKeys.length - 1],
    }) as ExecutionPlan['extent'],
    selectedOccurrenceIds,
    ...(aetos === undefined ? {} : { olympusAetos: aetos }),
    resources: resources(record.resources, 'execution plan.resources'),
    ...(record.startState === undefined ? {} : { startState: startState(record.startState) }),
    occurrences,
  });
  validateExecutionReferences(plan);
  const body = Object.freeze({
    format: plan.format,
    catalogVersion: plan.catalogVersion,
    projectId: plan.projectId,
    routeKey: plan.routeKey,
    startingLoadout: plan.startingLoadout,
    ...(plan.runModifiers === undefined ? {} : { runModifiers: plan.runModifiers }),
    startingKeepsake: plan.startingKeepsake,
    extent: plan.extent,
    selectedOccurrenceIds: plan.selectedOccurrenceIds,
    resources: plan.resources,
    ...(plan.olympusAetos === undefined ? {} : { olympusAetos: plan.olympusAetos }),
    ...(plan.startState === undefined ? {} : { startState: plan.startState }),
    occurrences: plan.occurrences,
  });
  if (fingerprint(body) !== plan.planFingerprint)
    fail('execution plan.planFingerprint does not match its contents');
  return plan;
}
