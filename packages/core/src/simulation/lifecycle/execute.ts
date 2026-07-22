import type {
  Catalog,
  EncounterPhase,
  EncounterProfile,
  RoomLifecycleEffectKind,
  RoomLifecycleOperation,
  RoomLifecycleProfile,
} from '../../catalog';
import type { ProducerRewardLifecycleDeclaration } from '../../rewardKernel/model';
import type { RoomHistoryFragment, RoomLifecycleEvent, RoomLifecycleExecutionInput } from './model';

type RoomLifecycleOperationKind = RoomLifecycleOperation['kind'];

interface ExecutionContext {
  readonly input: RoomLifecycleExecutionInput;
  readonly profile: RoomLifecycleProfile;
  readonly encounter: EncounterProfile;
  readonly producerRewardLifecycle?: ProducerRewardLifecycleDeclaration;
}

interface OperationContext extends ExecutionContext {
  readonly operationIndex: number;
  readonly encounterPhase?: EncounterPhase;
}

interface ExecutionState {
  readonly events: readonly RoomLifecycleEvent[];
}

type EventData<Event extends RoomLifecycleEvent = RoomLifecycleEvent> =
  Event extends RoomLifecycleEvent ? Omit<Event, 'operationIndex' | 'origin' | 'sequence'> : never;

type EffectHandler = (context: OperationContext, state: ExecutionState) => ExecutionState;
type OperationHandler = (
  operation: RoomLifecycleOperation,
  context: ExecutionContext,
  operationIndex: number,
  state: ExecutionState,
) => ExecutionState;

export class LifecycleExecutionContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'LifecycleExecutionContractError';
  }
}

function appendEvent(
  state: ExecutionState,
  context: OperationContext,
  data: EventData,
): ExecutionState {
  const event = Object.freeze({
    ...data,
    sequence: state.events.length + 1,
    operationIndex: context.operationIndex,
    origin: context.input.origin,
  }) as RoomLifecycleEvent;
  return Object.freeze({ events: Object.freeze([...state.events, event]) });
}

function requireOperation<Kind extends RoomLifecycleOperationKind>(
  context: OperationContext,
  kind: Kind,
): Extract<RoomLifecycleOperation, { readonly kind: Kind }> {
  const operation = context.profile.operations[context.operationIndex];
  if (operation?.kind !== kind) {
    throw new LifecycleExecutionContractError(
      `effect expected ${kind} at operation ${context.operationIndex}`,
    );
  }
  return operation as Extract<RoomLifecycleOperation, { readonly kind: Kind }>;
}

function requireEncounterPhase(context: OperationContext): EncounterPhase {
  if (context.encounterPhase === undefined) {
    throw new LifecycleExecutionContractError(
      `operation ${context.operationIndex} has no resolved encounter phase`,
    );
  }
  return context.encounterPhase;
}

const lifecycleEffectRegistry = Object.freeze({
  recordPreparation: (context, state) => appendEvent(state, context, { kind: 'roomPrepared' }),
  recordOfferPoint: (context, state) => {
    const operation = requireOperation(context, 'materializeOfferPoint');
    return appendEvent(state, context, {
      kind: 'offerPointMaterialized',
      offerPoint: operation.offerPoint,
    });
  },
  recordPhaseOfferPoint: (context, state) => {
    const offerPoint = requireEncounterPhase(context).offerPoint;
    return offerPoint === undefined
      ? state
      : appendEvent(state, context, {
          kind: 'offerPointMaterialized',
          offerPoint: offerPoint.key,
        });
  },
  recordAppearance: (context, state) => appendEvent(state, context, { kind: 'roomEntered' }),
  recordRequiredObjectSpawns: (context, state) => {
    const requiredObjects = context.input.requiredObjects;
    if (requiredObjects === undefined || requiredObjects.length === 0) {
      throw new LifecycleExecutionContractError(
        `${context.profile.key} spawned missing required objects`,
      );
    }
    let next = state;
    for (const object of requiredObjects) {
      next = appendEvent(next, context, {
        kind: 'requiredObjectSpawned',
        objectKey: object.key,
        completionRequirement: object.completionRequirement,
      });
    }
    return next;
  },
  recordEncounterStart: (context, state) => {
    const phase = requireEncounterPhase(context);
    return appendEvent(state, context, {
      kind: 'encounterStarted',
      phaseKey: phase.key,
      phaseKind: phase.kind,
      ...(phase.baselineEncounterKey === undefined
        ? {}
        : { baselineEncounterKey: phase.baselineEncounterKey }),
    });
  },
  advanceEncounterDepth: (context, state) => {
    const phase = requireEncounterPhase(context);
    if (!phase.countsEncounterDepth) {
      return state;
    }
    return appendEvent(state, context, {
      kind: 'encounterDepthAdvanced',
      phaseKey: phase.key,
      roomEncounterDepthDelta: 1,
      biomeEncounterDepthDelta: 1,
      routeEncounterDepthDelta: 1,
    });
  },
  recordEncounterCompletion: (context, state) =>
    appendEvent(state, context, {
      kind: 'encounterCompleted',
      phaseKey: requireEncounterPhase(context).key,
    }),
  recordPhaseOfferAcquisition: (context, state) => {
    const offerPoint = requireEncounterPhase(context).offerPoint;
    return offerPoint === undefined
      ? state
      : appendEvent(state, context, {
          kind: 'offerPointAcquired',
          offerPoint: offerPoint.key,
        });
  },
  recordRequiredObjectCompletions: (context, state) => {
    const requiredObjects = context.input.requiredObjects;
    if (requiredObjects === undefined || requiredObjects.length === 0) {
      throw new LifecycleExecutionContractError(
        `${context.profile.key} completed missing required objects`,
      );
    }
    let next = state;
    for (const object of requiredObjects) {
      next = appendEvent(next, context, {
        kind: 'requiredObjectCompleted',
        objectKey: object.key,
      });
    }
    return next;
  },
  recordProducerPoint: (context, state) => {
    const operation = requireOperation(context, 'advanceProducer');
    const producer = context.input.producer;
    const lifecycle = context.producerRewardLifecycle;
    if (producer === undefined || lifecycle === undefined) {
      throw new LifecycleExecutionContractError(
        `${context.profile.key} advanced a missing producer`,
      );
    }
    let next = state;
    for (const binding of lifecycle.acquisitionLifecycle) {
      if (binding.lifecyclePoint === operation.point) {
        next = appendEvent(next, context, {
          kind: 'producerRoleAdvanced',
          producerLifecycleKey: producer.lifecycleProfileKey,
          rewardType: producer.offer.rewardType,
          role: binding.role,
          lifecyclePoint: binding.lifecyclePoint,
        });
      }
    }
    return next;
  },
  recordOutgoingGeneration: (context, state) =>
    appendEvent(state, context, { kind: 'outgoingGenerationCheckpoint' }),
  recordShopPurchases: (context, state) => {
    const operation = requireOperation(context, 'applyShopPurchases');
    return appendEvent(state, context, {
      kind: 'shopPurchasesApplied',
      offerPoint: operation.offerPoint,
    });
  },
  recordCommit: (context, state) => appendEvent(state, context, { kind: 'roomCommitted' }),
  advanceRoomCounters: (context, state) =>
    appendEvent(state, context, {
      kind: 'roomCountersAdvanced',
      biomeDepthCacheDelta: context.input.counterEffects.biomeDepthCache,
      roomHistoryOrdinalDelta: context.input.counterEffects.roomHistoryOrdinal,
    }),
  recordEnteredRewardStore: (context, state) =>
    context.input.enteredRewardStoreKey === undefined
      ? state
      : appendEvent(state, context, {
          kind: 'enteredRewardStoreRecorded',
          storeKey: context.input.enteredRewardStoreKey,
        }),
  recordExit: (context, state) => appendEvent(state, context, { kind: 'roomExited' }),
}) satisfies Readonly<Record<RoomLifecycleEffectKind, EffectHandler>>;

function applyEffects(
  operation: RoomLifecycleOperation,
  context: OperationContext,
  state: ExecutionState,
): ExecutionState {
  let next = state;
  for (const effect of operation.effects) {
    next = lifecycleEffectRegistry[effect](context, next);
  }
  return next;
}

function resolveOnlyEncounter(context: ExecutionContext): EncounterPhase {
  const phase = context.encounter.phases[0];
  if (context.encounter.phases.length !== 1 || phase === undefined) {
    throw new LifecycleExecutionContractError(
      `${context.encounter.key} does not expose exactly one encounter phase`,
    );
  }
  return phase;
}

function defaultOperationHandler(
  operation: RoomLifecycleOperation,
  context: ExecutionContext,
  operationIndex: number,
  state: ExecutionState,
): ExecutionState {
  return applyEffects(operation, { ...context, operationIndex }, state);
}

function encounterOperationHandler(
  operation: RoomLifecycleOperation,
  context: ExecutionContext,
  operationIndex: number,
  state: ExecutionState,
): ExecutionState {
  return applyEffects(
    operation,
    { ...context, operationIndex, encounterPhase: resolveOnlyEncounter(context) },
    state,
  );
}

function encounterSequenceOperationHandler(
  operation: RoomLifecycleOperation,
  context: ExecutionContext,
  operationIndex: number,
  state: ExecutionState,
): ExecutionState {
  let next = state;
  for (const encounterPhase of context.encounter.phases) {
    next = applyEffects(operation, { ...context, operationIndex, encounterPhase }, next);
  }
  return next;
}

const operationDispatchRegistry = Object.freeze({
  prepareRoom: defaultOperationHandler,
  materializeOfferPoint: defaultOperationHandler,
  enterRoom: defaultOperationHandler,
  spawnRequiredObjects: defaultOperationHandler,
  startEncounter: encounterOperationHandler,
  completeEncounter: encounterOperationHandler,
  completeRequiredObjects: defaultOperationHandler,
  runEncounterSequence: encounterSequenceOperationHandler,
  runRewardEncounterSequence: encounterSequenceOperationHandler,
  advanceProducer: defaultOperationHandler,
  generateOutgoingBatch: defaultOperationHandler,
  applyShopPurchases: defaultOperationHandler,
  commitRoom: defaultOperationHandler,
  exitRoom: defaultOperationHandler,
}) satisfies Readonly<Record<RoomLifecycleOperationKind, OperationHandler>>;

function resolveExecutionContext(
  catalog: Catalog,
  input: RoomLifecycleExecutionInput,
): ExecutionContext {
  if (
    input.enteredRewardStoreKey !== undefined &&
    catalog.rewards.stores.byKey[input.enteredRewardStoreKey] === undefined
  ) {
    throw new LifecycleExecutionContractError(
      `unknown entered reward store ${input.enteredRewardStoreKey}`,
    );
  }
  const profile = catalog.roomLifecycleProfiles.byKey[input.lifecycleProfileKey];
  if (profile === undefined) {
    throw new LifecycleExecutionContractError(
      `unknown room lifecycle profile ${input.lifecycleProfileKey}`,
    );
  }
  const declaredEncounter = catalog.encounterProfiles.byKey[input.encounterProfileKey];
  if (declaredEncounter === undefined) {
    throw new LifecycleExecutionContractError(
      `unknown encounter profile ${input.encounterProfileKey}`,
    );
  }
  if (!profile.encounterProfileKeys.includes(declaredEncounter.key)) {
    throw new LifecycleExecutionContractError(
      `${declaredEncounter.key} is incompatible with ${profile.key}`,
    );
  }
  const selectedPhases = input.encounterPhases ?? declaredEncounter.phases;
  if (
    (selectedPhases.length === 0 && declaredEncounter.phases.length !== 0) ||
    selectedPhases.length > declaredEncounter.phases.length ||
    selectedPhases.some((phase, index) => phase.key !== declaredEncounter.phases[index]?.key) ||
    declaredEncounter.phases
      .slice(selectedPhases.length)
      .some((phase) => phase.presence === undefined)
  ) {
    throw new LifecycleExecutionContractError(
      `${declaredEncounter.key} selected an invalid active encounter-phase prefix`,
    );
  }
  const encounter: EncounterProfile =
    selectedPhases === declaredEncounter.phases
      ? declaredEncounter
      : Object.freeze({ ...declaredEncounter, phases: Object.freeze([...selectedPhases]) });

  const hasRequiredObjects = (input.requiredObjects?.length ?? 0) > 0;
  const hasRequiredObjectOperations = profile.operations.some(
    (operation) =>
      operation.kind === 'spawnRequiredObjects' || operation.kind === 'completeRequiredObjects',
  );
  if (hasRequiredObjects !== hasRequiredObjectOperations) {
    throw new LifecycleExecutionContractError(
      `${profile.key} required-object operations do not match lifecycle input`,
    );
  }

  if (profile.producer.kind === 'none') {
    if (input.producer !== undefined) {
      throw new LifecycleExecutionContractError(`${profile.key} does not accept a producer`);
    }
    return { input, profile, encounter };
  }
  const producer = input.producer;
  if (producer === undefined) {
    throw new LifecycleExecutionContractError(`${profile.key} requires a producer`);
  }
  if (!profile.producer.lifecycleProfileKeys.includes(producer.lifecycleProfileKey)) {
    throw new LifecycleExecutionContractError(
      `${producer.lifecycleProfileKey} is incompatible with ${profile.key}`,
    );
  }
  const producerLifecycle = catalog.rewards.producerLifecycles.byKey[producer.lifecycleProfileKey];
  if (producerLifecycle === undefined) {
    throw new LifecycleExecutionContractError(
      `unknown producer lifecycle ${producer.lifecycleProfileKey}`,
    );
  }
  const producerRewardLifecycle = producerLifecycle.rewardTypes.byKey[producer.offer.rewardType];
  if (producerRewardLifecycle === undefined) {
    throw new LifecycleExecutionContractError(
      `${producer.offer.rewardType} is unsupported by ${producerLifecycle.key}`,
    );
  }
  const profilePoints = new Set(
    profile.operations.flatMap((operation) =>
      operation.kind === 'advanceProducer' ? [operation.point] : [],
    ),
  );
  for (const binding of producerRewardLifecycle.acquisitionLifecycle) {
    if (!profilePoints.has(binding.lifecyclePoint)) {
      throw new LifecycleExecutionContractError(
        `${profile.key} has no ${binding.lifecyclePoint} point for ${producer.offer.rewardType}.${binding.role}`,
      );
    }
  }
  return { input, profile, encounter, producerRewardLifecycle };
}

export function executeRoomLifecycle(
  catalog: Catalog,
  input: RoomLifecycleExecutionInput,
): RoomHistoryFragment {
  const context = resolveExecutionContext(catalog, input);
  let state: ExecutionState = Object.freeze({ events: Object.freeze([]) });
  for (const [operationIndex, operation] of context.profile.operations.entries()) {
    state = operationDispatchRegistry[operation.kind](operation, context, operationIndex, state);
  }
  return Object.freeze({
    origin: input.origin,
    lifecycleProfileKey: context.profile.key,
    encounterProfileKey: context.encounter.key,
    events: state.events,
  });
}
