import {
  EXECUTION_CATALOG_VERSION,
  EXECUTION_PLAN_FORMAT,
  EXECUTION_PROTOCOL_VERSION,
  type ExecutionPlan,
} from './model';

export class ExecutionPlanCodecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExecutionPlanCodecError';
  }
}

function fail(message: string): never {
  throw new ExecutionPlanCodecError(message);
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) {
    fail(`${label} must be a bounded non-empty string`);
  }
  return value;
}

function array(value: unknown, label: string, maximum: number): readonly unknown[] {
  if (!Array.isArray(value) || value.length > maximum) fail(`${label} must be a bounded array`);
  return value;
}

function exactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  label: string,
  optional: readonly string[] = [],
): void {
  for (const key of required) if (!(key in value)) fail(`${label} is missing ${key}`);
  for (const key of Object.keys(value)) {
    if (!required.includes(key) && !optional.includes(key))
      fail(`${label} has unknown field ${key}`);
  }
}

function parseReward(
  value: unknown,
): NonNullable<ExecutionPlan['rooms'][number]['contents']['incomingReward']> {
  const reward = object(value, 'incomingReward');
  exactKeys(reward, ['rewardType', 'producerLifecycleKey'], 'incomingReward', [
    'resolvedStoreKey',
    'source',
  ]);
  return Object.freeze({
    rewardType: stringValue(reward.rewardType, 'incomingReward.rewardType'),
    producerLifecycleKey: stringValue(
      reward.producerLifecycleKey,
      'incomingReward.producerLifecycleKey',
    ),
    ...(reward.resolvedStoreKey === undefined
      ? {}
      : {
          resolvedStoreKey: stringValue(reward.resolvedStoreKey, 'incomingReward.resolvedStoreKey'),
        }),
    ...(reward.source === undefined
      ? {}
      : { source: stringValue(reward.source, 'incomingReward.source') }),
  });
}

function parseRoom(value: unknown, index: number): ExecutionPlan['rooms'][number] {
  const record = object(value, `rooms[${index}]`);
  exactKeys(
    record,
    ['id', 'owner', 'biomeKey', 'gameName', 'contents', 'trace', 'outgoing'],
    `rooms[${index}]`,
  );

  const contents = object(record.contents, `rooms[${index}].contents`);
  exactKeys(contents, ['incomingReward'], `rooms[${index}].contents`);

  const trace = array(record.trace, `rooms[${index}].trace`, 64).map((entry, traceIndex) => {
    const step = object(entry, `trace[${traceIndex}]`);
    exactKeys(step, ['id', 'kind', 'checkpoint', 'owner'], `trace[${traceIndex}]`);
    if (step.kind !== 'roomEntered' || step.checkpoint !== 'roomEntered') {
      fail(`trace[${traceIndex}] kind unsupported`);
    }
    return Object.freeze({
      id: stringValue(step.id, `trace[${traceIndex}].id`),
      kind: 'roomEntered' as const,
      checkpoint: 'roomEntered' as const,
      owner: stringValue(step.owner, `trace[${traceIndex}].owner`),
    });
  });
  const roomOwner = stringValue(record.owner, `rooms[${index}].owner`);
  if (trace.length !== 1 || trace[0]?.owner !== roomOwner) {
    fail(`rooms[${index}].trace must contain its owned room-entry step`);
  }

  const outgoing = object(record.outgoing, `rooms[${index}].outgoing`);
  exactKeys(outgoing, ['owner', 'targets', 'selectedExitKey'], `rooms[${index}].outgoing`);
  const targets = array(outgoing.targets, `rooms[${index}].outgoing.targets`, 16).map(
    (target, targetIndex) => {
      const targetRecord = object(target, `target[${targetIndex}]`);
      exactKeys(
        targetRecord,
        ['exitKey', 'index', 'type', 'room', 'picked'],
        `target[${targetIndex}]`,
      );
      if (
        !Number.isInteger(targetRecord.index) ||
        (targetRecord.index as number) < 1 ||
        (targetRecord.index as number) > 16
      ) {
        fail(`target[${targetIndex}].index invalid`);
      }
      if (typeof targetRecord.picked !== 'boolean') fail(`target[${targetIndex}].picked invalid`);
      const targetRoom = object(targetRecord.room, `target[${targetIndex}].room`);
      exactKeys(targetRoom, ['id', 'biomeKey', 'gameName'], `target[${targetIndex}].room`);
      return Object.freeze({
        exitKey: stringValue(targetRecord.exitKey, `target[${targetIndex}].exitKey`),
        index: targetRecord.index as number,
        type: stringValue(targetRecord.type, `target[${targetIndex}].type`),
        room: Object.freeze({
          id: stringValue(targetRoom.id, `target[${targetIndex}].room.id`),
          biomeKey: stringValue(targetRoom.biomeKey, `target[${targetIndex}].room.biomeKey`),
          gameName: stringValue(targetRoom.gameName, `target[${targetIndex}].room.gameName`),
        }),
        picked: targetRecord.picked,
      });
    },
  );
  if (new Set(targets.map((target) => target.exitKey)).size !== targets.length) {
    fail(`rooms[${index}].outgoing.targets has duplicate exit keys`);
  }
  if (new Set(targets.map((target) => target.index)).size !== targets.length) {
    fail(`rooms[${index}].outgoing.targets has duplicate indices`);
  }
  if (typeof outgoing.selectedExitKey !== 'string') {
    fail(`rooms[${index}].outgoing.selectedExitKey invalid`);
  }
  const pickedTargets = targets.filter((target) => target.picked);
  if (pickedTargets.length !== 1 || pickedTargets[0]?.exitKey !== outgoing.selectedExitKey) {
    fail(`rooms[${index}].outgoing must select exactly one picked target`);
  }

  return Object.freeze({
    id: stringValue(record.id, `rooms[${index}].id`),
    owner: roomOwner,
    biomeKey: stringValue(record.biomeKey, `rooms[${index}].biomeKey`),
    gameName: stringValue(record.gameName, `rooms[${index}].gameName`),
    contents: Object.freeze({ incomingReward: parseReward(contents.incomingReward) }),
    trace: Object.freeze(trace),
    outgoing: Object.freeze({
      owner: stringValue(outgoing.owner, `rooms[${index}].outgoing.owner`),
      targets: Object.freeze(targets),
      selectedExitKey: stringValue(
        outgoing.selectedExitKey,
        `rooms[${index}].outgoing.selectedExitKey`,
      ),
    }),
  });
}

export function encodeExecutionPlan(plan: ExecutionPlan): string {
  return JSON.stringify(plan);
}

export function decodeExecutionPlan(value: unknown): ExecutionPlan {
  const record = object(value, 'execution plan');
  exactKeys(
    record,
    [
      'format',
      'protocolVersion',
      'catalogVersion',
      'projectId',
      'planFingerprint',
      'routeKey',
      'extent',
      'rooms',
    ],
    'execution plan',
  );
  if (record.format !== EXECUTION_PLAN_FORMAT) fail('unsupported execution plan format');
  if (record.protocolVersion !== EXECUTION_PROTOCOL_VERSION) {
    fail('unsupported execution protocol version');
  }
  if (record.catalogVersion !== EXECUTION_CATALOG_VERSION) {
    fail('unsupported execution catalog version');
  }
  if (record.routeKey !== 'Underworld') fail('unsupported execution route');

  const extent = object(record.extent, 'extent');
  exactKeys(extent, ['kind', 'biomeKeys', 'terminalBiomeKey'], 'extent');
  if (extent.kind !== 'configuredPrefix' || extent.terminalBiomeKey !== 'F') {
    fail('unsupported execution extent');
  }
  const biomeKeys = array(extent.biomeKeys, 'extent.biomeKeys', 1);
  if (biomeKeys.length !== 1 || biomeKeys[0] !== 'F') fail('unsupported execution biome prefix');

  const rooms = array(record.rooms, 'rooms', 1);
  if (rooms.length !== 1) fail('Gate A requires one opening room');
  const planFingerprint = stringValue(record.planFingerprint, 'planFingerprint');
  if (!/^[0-9a-f]{8}$/.test(planFingerprint)) {
    fail('planFingerprint must be an eight-character lowercase hexadecimal value');
  }
  return Object.freeze({
    format: EXECUTION_PLAN_FORMAT,
    protocolVersion: EXECUTION_PROTOCOL_VERSION,
    catalogVersion: stringValue(record.catalogVersion, 'catalogVersion'),
    projectId: stringValue(record.projectId, 'projectId'),
    planFingerprint,
    routeKey: 'Underworld',
    extent: Object.freeze({
      kind: 'configuredPrefix',
      biomeKeys: ['F'] as const,
      terminalBiomeKey: 'F' as const,
    }),
    rooms: Object.freeze([parseRoom(rooms[0], 0)] as [ExecutionPlan['rooms'][number]]),
  });
}
