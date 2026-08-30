import {
  EXECUTION_CATALOG_VERSION,
  EXECUTION_PLAN_FORMAT,
  EXECUTION_PROTOCOL_VERSION,
  type ExecutionPlan,
  type ExecutionRunStateCount,
  type ExecutionTraceStep,
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

function stringValue(value: unknown, label: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0) || value.length > 512) {
    fail(`${label} must be a bounded ${allowEmpty ? '' : 'non-empty '}string`);
  }
  return value;
}

function integer(
  value: unknown,
  label: string,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    fail(`${label} must be an integer in range`);
  }
  return value as number;
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

function parseCount(value: unknown, label: string): ExecutionRunStateCount {
  const count = object(value, label);
  exactKeys(count, ['kind'], label, ['count', 'min', 'max']);
  if (count.kind === 'exact') {
    exactKeys(count, ['kind', 'count'], label);
    return Object.freeze({ kind: 'exact', count: integer(count.count, `${label}.count`) });
  }
  if (count.kind === 'range') {
    exactKeys(count, ['kind', 'min', 'max'], label);
    const min = integer(count.min, `${label}.min`);
    const max = integer(count.max, `${label}.max`);
    if (min > max) fail(`${label}.min must not exceed max`);
    return Object.freeze({ kind: 'range', min, max });
  }
  fail(`${label}.kind unsupported`);
}

function parseReward(
  value: unknown,
  label: string,
): NonNullable<ExecutionPlan['rooms'][number]['contents']['incomingReward']> {
  const reward = object(value, label);
  exactKeys(reward, ['rewardType', 'producerLifecycleKey'], label, [
    'resolvedStoreKey',
    'source',
    'spurnedSource',
  ]);
  return Object.freeze({
    rewardType: stringValue(reward.rewardType, `${label}.rewardType`),
    producerLifecycleKey: stringValue(reward.producerLifecycleKey, `${label}.producerLifecycleKey`),
    ...(reward.resolvedStoreKey === undefined
      ? {}
      : { resolvedStoreKey: stringValue(reward.resolvedStoreKey, `${label}.resolvedStoreKey`) }),
    ...(reward.source === undefined
      ? {}
      : { source: stringValue(reward.source, `${label}.source`) }),
    ...(reward.spurnedSource === undefined
      ? {}
      : { spurnedSource: stringValue(reward.spurnedSource, `${label}.spurnedSource`) }),
  });
}

function parseDiagnostic(value: unknown, label: string) {
  const diagnostic = object(value, label);
  exactKeys(diagnostic, ['owner', 'checkpoint', 'counters', 'bags'], label);
  const checkpoint = diagnostic.checkpoint;
  if (checkpoint !== 'roomEntered' && checkpoint !== 'beforeRoomExit')
    fail(`${label}.checkpoint unsupported`);
  const counters = object(diagnostic.counters, `${label}.counters`);
  exactKeys(
    counters,
    ['biomeDepthCache', 'biomeEncounterDepth', 'routeEncounterDepth', 'roomHistoryOrdinal'],
    `${label}.counters`,
  );
  const bags = array(diagnostic.bags, `${label}.bags`, 64).map((value, index) => {
    const bag = object(value, `${label}.bags[${index}]`);
    exactKeys(bag, ['storeKey', 'remaining'], `${label}.bags[${index}]`);
    return Object.freeze({
      storeKey: stringValue(bag.storeKey, `${label}.bags[${index}].storeKey`),
      remaining: parseCount(bag.remaining, `${label}.bags[${index}].remaining`),
    });
  });
  if (new Set(bags.map((bag) => bag.storeKey)).size !== bags.length)
    fail(`${label}.bags has duplicate stores`);
  return Object.freeze({
    owner: stringValue(diagnostic.owner, `${label}.owner`),
    checkpoint,
    counters: Object.freeze({
      biomeDepthCache: integer(counters.biomeDepthCache, `${label}.counters.biomeDepthCache`),
      biomeEncounterDepth: integer(
        counters.biomeEncounterDepth,
        `${label}.counters.biomeEncounterDepth`,
      ),
      routeEncounterDepth: integer(
        counters.routeEncounterDepth,
        `${label}.counters.routeEncounterDepth`,
      ),
      roomHistoryOrdinal: integer(
        counters.roomHistoryOrdinal,
        `${label}.counters.roomHistoryOrdinal`,
      ),
    }),
    bags: Object.freeze(bags),
  });
}

function parseRoom(value: unknown, index: number): ExecutionPlan['rooms'][number] {
  const label = `rooms[${index}]`;
  const record = object(value, label);
  exactKeys(
    record,
    ['id', 'owner', 'biomeKey', 'gameName', 'kind', 'entered', 'contents', 'trace', 'outgoing'],
    label,
  );
  const roomOwner = stringValue(record.owner, `${label}.owner`);
  const contents = object(record.contents, `${label}.contents`);
  exactKeys(contents, ['encounterPhases', 'requiredObjects'], `${label}.contents`, [
    'incomingReward',
  ]);
  const phases = array(contents.encounterPhases, `${label}.contents.encounterPhases`, 16).map(
    (value, phaseIndex) => {
      const phase = object(value, `${label}.contents.encounterPhases[${phaseIndex}]`);
      exactKeys(
        phase,
        ['slotKey', 'encounterKey', 'kind'],
        `${label}.contents.encounterPhases[${phaseIndex}]`,
      );
      return Object.freeze({
        slotKey: stringValue(
          phase.slotKey,
          `${label}.contents.encounterPhases[${phaseIndex}].slotKey`,
        ),
        encounterKey: stringValue(
          phase.encounterKey,
          `${label}.contents.encounterPhases[${phaseIndex}].encounterKey`,
        ),
        kind: stringValue(phase.kind, `${label}.contents.encounterPhases[${phaseIndex}].kind`),
      });
    },
  );
  const requiredObjects = array(
    contents.requiredObjects,
    `${label}.contents.requiredObjects`,
    32,
  ).map((value, objectIndex) =>
    stringValue(value, `${label}.contents.requiredObjects[${objectIndex}]`),
  );
  const trace: readonly ExecutionTraceStep[] = array(record.trace, `${label}.trace`, 8).map(
    (value, traceIndex) => {
      const step = object(value, `${label}.trace[${traceIndex}]`);
      exactKeys(
        step,
        ['id', 'kind', 'checkpoint', 'owner', 'runState'],
        `${label}.trace[${traceIndex}]`,
      );
      if (step.kind !== 'roomEntered' && step.kind !== 'beforeRoomExit')
        fail(`${label}.trace[${traceIndex}].kind unsupported`);
      if (step.checkpoint !== step.kind) fail(`${label}.trace[${traceIndex}] checkpoint mismatch`);
      const owner = stringValue(step.owner, `${label}.trace[${traceIndex}].owner`);
      if (owner !== roomOwner) fail(`${label}.trace[${traceIndex}] owner mismatch`);
      const runState = parseDiagnostic(step.runState, `${label}.trace[${traceIndex}].runState`);
      if (runState.checkpoint !== step.checkpoint)
        fail(`${label}.trace runState checkpoint mismatch`);
      return Object.freeze({
        id: stringValue(step.id, `${label}.trace[${traceIndex}].id`),
        kind: step.kind as ExecutionTraceStep['kind'],
        checkpoint: step.checkpoint as ExecutionTraceStep['checkpoint'],
        owner,
        runState,
      });
    },
  );
  if (record.entered) {
    if (
      trace.length !== 2 ||
      trace[0]?.checkpoint !== 'roomEntered' ||
      trace[1]?.checkpoint !== 'beforeRoomExit'
    ) {
      fail(`${label} must contain owned room-entry step and before-room-exit step`);
    }
  } else if (trace.length !== 0) {
    fail(`${label} cannot contain trace steps when not entered`);
  }
  const baseRoom = {
    id: stringValue(record.id, `${label}.id`),
    owner: roomOwner,
    biomeKey: stringValue(record.biomeKey, `${label}.biomeKey`),
    gameName: stringValue(record.gameName, `${label}.gameName`),
    kind: stringValue(record.kind, `${label}.kind`),
    entered:
      record.entered === true
        ? true
        : record.entered === false
          ? false
          : fail(`${label}.entered invalid`),
    contents: Object.freeze({
      ...(contents.incomingReward === undefined
        ? {}
        : {
            incomingReward: parseReward(
              contents.incomingReward,
              `${label}.contents.incomingReward`,
            ),
          }),
      encounterPhases: Object.freeze(phases),
      requiredObjects: Object.freeze(requiredObjects),
    }),
    trace: Object.freeze(trace),
  };
  const outgoing = object(record.outgoing, `${label}.outgoing`);
  exactKeys(outgoing, ['owner', 'kind'], `${label}.outgoing`, [
    'targets',
    'selectedExitKey',
    'target',
    'resolvedSharedRewardStoreKey',
  ]);
  stringValue(outgoing.owner, `${label}.outgoing.owner`);
  if (outgoing.kind === 'batch') {
    exactKeys(outgoing, ['owner', 'kind', 'targets', 'selectedExitKey'], `${label}.outgoing`, [
      'resolvedSharedRewardStoreKey',
    ]);
    const targets = array(outgoing.targets, `${label}.outgoing.targets`, 16).map(
      (value, targetIndex) => {
        const target = object(value, `${label}.outgoing.targets[${targetIndex}]`);
        exactKeys(
          target,
          ['exitKey', 'index', 'type', 'room', 'picked'],
          `${label}.outgoing.targets[${targetIndex}]`,
        );
        const targetRoom = object(target.room, `${label}.outgoing.targets[${targetIndex}].room`);
        exactKeys(
          targetRoom,
          ['id', 'biomeKey', 'gameName'],
          `${label}.outgoing.targets[${targetIndex}].room`,
        );
        return Object.freeze({
          exitKey: stringValue(target.exitKey, `${label}.outgoing.targets[${targetIndex}].exitKey`),
          index: integer(target.index, `${label}.outgoing.targets[${targetIndex}].index`, 1, 16),
          type: stringValue(target.type, `${label}.outgoing.targets[${targetIndex}].type`),
          room: Object.freeze({
            id: stringValue(targetRoom.id, `${label}.outgoing.targets[${targetIndex}].room.id`),
            biomeKey: stringValue(
              targetRoom.biomeKey,
              `${label}.outgoing.targets[${targetIndex}].room.biomeKey`,
            ),
            gameName: stringValue(
              targetRoom.gameName,
              `${label}.outgoing.targets[${targetIndex}].room.gameName`,
            ),
          }),
          picked:
            target.picked === true
              ? true
              : target.picked === false
                ? false
                : fail(`${label}.outgoing.targets[${targetIndex}].picked invalid`),
        });
      },
    );
    if (targets.length === 0) fail(`${label}.outgoing.targets cannot be empty`);
    if (
      new Set(targets.map((target) => target.exitKey)).size !== targets.length ||
      new Set(targets.map((target) => target.index)).size !== targets.length
    )
      fail(`${label}.outgoing.targets has duplicate identities`);
    if (targets.some((target, targetIndex) => target.index !== targetIndex + 1))
      fail(`${label}.outgoing.targets must preserve physical order`);
    const selectedExitKey = stringValue(
      outgoing.selectedExitKey,
      `${label}.outgoing.selectedExitKey`,
    );
    if (
      targets.filter((target) => target.picked).length !== 1 ||
      targets.find((target) => target.picked)?.exitKey !== selectedExitKey
    )
      fail(`${label}.outgoing must select exactly one picked target`);
    return Object.freeze({
      ...baseRoom,
      outgoing: Object.freeze({
        owner: stringValue(outgoing.owner, `${label}.outgoing.owner`),
        kind: 'batch' as const,
        targets: Object.freeze(targets),
        selectedExitKey,
        ...(outgoing.resolvedSharedRewardStoreKey === undefined
          ? {}
          : {
              resolvedSharedRewardStoreKey: stringValue(
                outgoing.resolvedSharedRewardStoreKey,
                `${label}.outgoing.resolvedSharedRewardStoreKey`,
              ),
            }),
      }),
    });
  }
  if (outgoing.kind === 'fixed') {
    exactKeys(outgoing, ['owner', 'kind', 'target'], `${label}.outgoing`);
    const target = object(outgoing.target, `${label}.outgoing.target`);
    exactKeys(target, ['id', 'biomeKey', 'gameName'], `${label}.outgoing.target`);
    return Object.freeze({
      ...baseRoom,
      outgoing: Object.freeze({
        owner: stringValue(outgoing.owner, `${label}.outgoing.owner`),
        kind: 'fixed' as const,
        target: Object.freeze({
          id: stringValue(target.id, `${label}.outgoing.target.id`),
          biomeKey: stringValue(target.biomeKey, `${label}.outgoing.target.biomeKey`),
          gameName: stringValue(target.gameName, `${label}.outgoing.target.gameName`),
        }),
      }),
    });
  }
  if (outgoing.kind === 'terminal') {
    exactKeys(outgoing, ['owner', 'kind'], `${label}.outgoing`);
    return Object.freeze({
      ...baseRoom,
      outgoing: Object.freeze({
        owner: stringValue(outgoing.owner, `${label}.outgoing.owner`),
        kind: 'terminal' as const,
      }),
    });
  }
  fail(`${label}.outgoing.kind unsupported`);
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
  if (record.protocolVersion !== EXECUTION_PROTOCOL_VERSION)
    fail('unsupported execution protocol version');
  if (record.catalogVersion !== EXECUTION_CATALOG_VERSION)
    fail('unsupported execution catalog version');
  if (record.routeKey !== 'Underworld') fail('unsupported execution route');
  const extent = object(record.extent, 'extent');
  exactKeys(extent, ['kind', 'biomeKeys', 'terminalBiomeKey'], 'extent');
  if (extent.kind !== 'configuredPrefix') fail('unsupported execution extent');
  const biomeKeys = array(extent.biomeKeys, 'extent.biomeKeys', 2);
  if (
    !(biomeKeys.length === 1 && biomeKeys[0] === 'F') &&
    !(biomeKeys.length === 2 && biomeKeys[0] === 'F' && biomeKeys[1] === 'G')
  )
    fail('unsupported execution biome prefix');
  const terminalBiomeKey = extent.terminalBiomeKey;
  if (terminalBiomeKey !== biomeKeys[biomeKeys.length - 1]) fail('extent terminal biome mismatch');
  const rooms = array(record.rooms, 'rooms', 256);
  if (rooms.length === 0) fail('execution plan requires rooms');
  const parsedRooms = rooms.map(parseRoom);
  if (new Set(parsedRooms.map((room) => room.id)).size !== parsedRooms.length)
    fail('execution plan has duplicate room ids');
  if (!parsedRooms[0]?.entered || parsedRooms[0].biomeKey !== 'F')
    fail('execution plan must start with entered F room');
  const roomsById = new Map(parsedRooms.map((room) => [room.id, room] as const));
  for (const room of parsedRooms) {
    if (!biomeKeys.includes(room.biomeKey as 'F' | 'G'))
      fail(`rooms contains unsupported biome ${room.biomeKey}`);
    if (room.outgoing.kind === 'batch')
      for (const target of room.outgoing.targets) {
        const referenced = roomsById.get(target.room.id);
        if (!referenced) fail(`rooms.${room.id} references unknown target room`);
        if (
          referenced.biomeKey !== target.room.biomeKey ||
          referenced.gameName !== target.room.gameName
        )
          fail(`rooms.${room.id} target room identity mismatch`);
      }
    if (room.outgoing.kind === 'fixed') {
      const referenced = roomsById.get(room.outgoing.target.id);
      if (!referenced) fail(`rooms.${room.id} references unknown fixed target room`);
      if (
        referenced.biomeKey !== room.outgoing.target.biomeKey ||
        referenced.gameName !== room.outgoing.target.gameName
      )
        fail(`rooms.${room.id} fixed target room identity mismatch`);
    }
  }
  const planFingerprint = stringValue(record.planFingerprint, 'planFingerprint');
  if (!/^[0-9a-f]{8}$/.test(planFingerprint))
    fail('planFingerprint must be an eight-character lowercase hexadecimal value');
  return Object.freeze({
    format: EXECUTION_PLAN_FORMAT,
    protocolVersion: EXECUTION_PROTOCOL_VERSION,
    catalogVersion: stringValue(record.catalogVersion, 'catalogVersion'),
    projectId: stringValue(record.projectId, 'projectId'),
    planFingerprint,
    routeKey: 'Underworld',
    extent: Object.freeze({
      kind: 'configuredPrefix',
      biomeKeys: Object.freeze(biomeKeys) as readonly ['F'] | readonly ['F', 'G'],
      terminalBiomeKey: terminalBiomeKey as 'F' | 'G',
    }),
    rooms: Object.freeze(parsedRooms),
  });
}
