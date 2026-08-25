import type {
  Catalog,
  RoomLifecycleEffectKind,
  RoomLifecycleOperation,
  RoomLifecycleProfile,
} from '../../catalog-schema';
import type { ProducerRewardLifecycleDeclaration } from '../../reward-kernel/model';
import type { ResolvedEncounterPhase } from '../encounters';
import type { RoomHistoryFragment, RoomLifecycleEvent, RoomLifecycleExecutionInput } from './model';
import { createBiomeAddress, createRoomActionAddress } from '../../authored-project/addresses';
import type { RoomActionReference } from '../../authored-project/model';
import { roomActionKey } from '../../authored-project/room-actions';
import { roomLifecycleWindowOrdinal } from '../../authored-project/room-action-domain';
import type { RoomActionRow } from '../room-actions';

type RoomLifecycleOperationKind = RoomLifecycleOperation['kind'];

interface ExecutionContext {
  readonly input: RoomLifecycleExecutionInput;
  readonly profile: RoomLifecycleProfile;
  readonly encounterPhases: readonly ResolvedEncounterPhase[];
  readonly producerRewardLifecycle?: ProducerRewardLifecycleDeclaration;
}

interface OperationContext extends ExecutionContext {
  readonly operationIndex: number;
  readonly encounterPhase?: ResolvedEncounterPhase;
  readonly figLeafSkipOwner?: boolean;
  readonly figLeafSkipped?: boolean;
}

interface ExecutionState {
  readonly events: readonly RoomLifecycleEvent[];
  readonly blockedAt?: import('../../authored-project/addresses').RoomActionSemanticAddress;
}

interface RoomActionSchedule {
  readonly encounterPhases: (
    phases: readonly ResolvedEncounterPhase[],
  ) => readonly ResolvedEncounterPhase[];
  readonly beforeOperation: (
    operation: RoomLifecycleOperation,
    operationIndex: number,
    state: ExecutionState,
  ) => ExecutionState;
  readonly beforeEncounterPhase: (
    phase: ResolvedEncounterPhase,
    operationIndex: number,
    state: ExecutionState,
  ) => ExecutionState;
  readonly afterEncounterPhase: (
    phase: ResolvedEncounterPhase,
    operationIndex: number,
    state: ExecutionState,
  ) => ExecutionState;
}

type EventData<Event extends RoomLifecycleEvent = RoomLifecycleEvent> =
  Event extends RoomLifecycleEvent ? Omit<Event, 'operationIndex' | 'origin' | 'sequence'> : never;

type EffectHandler = (context: OperationContext, state: ExecutionState) => ExecutionState;
type OperationHandler = (
  operation: RoomLifecycleOperation,
  context: ExecutionContext,
  operationIndex: number,
  state: ExecutionState,
  schedule?: RoomActionSchedule,
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
  return Object.freeze({ ...state, events: Object.freeze([...state.events, event]) });
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

function requireEncounterPhase(context: OperationContext): ResolvedEncounterPhase {
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
    const attachment = requireEncounterPhase(context).rewardAttachment;
    return attachment?.kind !== 'rewardWheel'
      ? state
      : appendEvent(state, context, {
          kind: 'offerPointMaterialized',
          offerPoint: attachment.key,
        });
  },
  recordAppearance: (context, state) =>
    appendEvent(state, context, {
      kind: 'roomEntered',
      surfaceShopPresent: context.input.surfaceShopPresent === true,
      roomShopPresent: context.input.roomShopPresent === true,
    }),
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
  recordEncounter: (context, state) => {
    let next = state;
    for (const phase of context.encounterPhases) {
      next = appendEvent(next, context, {
        kind: 'encounterRecorded',
        phaseKey: phase.slotKey,
        encounterEnvelopeKey: phase.envelopeKey,
        encounterKey: phase.encounterKey,
        phaseKind: phase.kind,
      });
    }
    return next;
  },
  recordEncounterStart: (context, state) => {
    const phase = requireEncounterPhase(context);
    return appendEvent(state, context, {
      kind: 'encounterStarted',
      phaseKey: phase.slotKey,
      encounterEnvelopeKey: phase.envelopeKey,
      encounterKey: phase.encounterKey,
      phaseKind: phase.kind,
      execution: context.figLeafSkipped === true ? 'skippedByFigLeaf' : 'normal',
      figLeafSkipOwner: context.figLeafSkipOwner === true,
    });
  },
  advanceEncounterDepth: (context, state) => {
    const phase = requireEncounterPhase(context);
    if (!phase.countsEncounterDepth) {
      return state;
    }
    return appendEvent(state, context, {
      kind: 'encounterDepthAdvanced',
      phaseKey: phase.slotKey,
      roomEncounterDepthDelta: 1,
      biomeEncounterDepthDelta: 1,
      routeEncounterDepthDelta: 1,
    });
  },
  recordEncounterCompletion: (context, state) => {
    const phase = requireEncounterPhase(context);
    const completion = {
      kind: 'encounterCompleted',
      phaseKey: phase.slotKey,
      execution: context.figLeafSkipped === true ? 'skippedByFigLeaf' : 'normal',
      figLeafSkipOwner: context.figLeafSkipOwner === true,
    } as const;
    const completed =
      context.input.lifecycleProfileKey === 'BossRoom'
        ? appendEvent(
            appendEvent(state, context, { ...completion, kind: 'bossDefeated' }),
            context,
            completion,
          )
        : appendEvent(state, context, completion);
    return phase.kind === 'nonCombat' || phase.skipEndEncounterEffects
      ? completed
      : appendEvent(completed, context, {
          ...completion,
          kind: 'encounterEndEffectsApplied',
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
    let next = appendEvent(state, context, {
      kind: 'producerPointReached',
      point: operation.point,
    });
    if (producer.acquisitionEnabled === false) return next;
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
  recordAcquisitionPoint: (context, state) => {
    if (context.input.roomActionRoster !== undefined) return state;
    const operation = requireOperation(context, 'settleAcquisitionPoint');
    return appendEvent(state, context, {
      kind: 'acquisitionPointReached',
      point: operation.point,
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

function resolveOnlyEncounter(context: ExecutionContext): ResolvedEncounterPhase {
  const phase = context.encounterPhases[0];
  if (context.encounterPhases.length !== 1 || phase === undefined) {
    throw new LifecycleExecutionContractError(
      `${context.input.encounterEnvelopeKey} does not expose exactly one encounter phase`,
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
  const phase = resolveOnlyEncounter(context);
  return applyEffects(
    operation,
    {
      ...context,
      operationIndex,
      encounterPhase: phase,
      ...(phase.figLeafSkip && phase.canEncounterSkip
        ? { figLeafSkipped: true, figLeafSkipOwner: true }
        : {}),
    },
    state,
  );
}

function encounterSequenceOperationHandler(
  operation: RoomLifecycleOperation,
  context: ExecutionContext,
  operationIndex: number,
  state: ExecutionState,
  schedule?: RoomActionSchedule,
): ExecutionState {
  let next = state;
  const skipOwnerIndex = context.encounterPhases.findIndex(
    (phase) => phase.figLeafSkip && phase.canEncounterSkip,
  );
  const phases = schedule?.encounterPhases(context.encounterPhases) ?? context.encounterPhases;
  for (const encounterPhase of phases) {
    if (schedule !== undefined) {
      next = schedule.beforeEncounterPhase(encounterPhase, operationIndex, next);
      if (next.blockedAt !== undefined) return next;
    }
    const phaseIndex = context.encounterPhases.indexOf(encounterPhase);
    const skipped =
      skipOwnerIndex >= 0 &&
      phaseIndex >= skipOwnerIndex &&
      (context.encounterPhases[skipOwnerIndex]?.skipEndEncounterEffects === true ||
        phaseIndex === skipOwnerIndex);
    next = applyEffects(
      operation,
      {
        ...context,
        operationIndex,
        encounterPhase,
        ...(skipped ? { figLeafSkipped: true } : {}),
        ...(skipped && phaseIndex === skipOwnerIndex ? { figLeafSkipOwner: true } : {}),
      },
      next,
    );
    if (schedule !== undefined) {
      next = schedule.afterEncounterPhase(encounterPhase, operationIndex, next);
      if (next.blockedAt !== undefined) return next;
    }
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
  settleAcquisitionPoint: defaultOperationHandler,
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
  for (const [offerPoint, storeKey] of Object.entries(input.offerPointRewardStores ?? {})) {
    if (catalog.rewards.stores.byKey[storeKey] === undefined) {
      throw new LifecycleExecutionContractError(
        `unknown reward store ${storeKey} for offer point ${offerPoint}`,
      );
    }
  }
  const profile = catalog.roomLifecycleProfiles.byKey[input.lifecycleProfileKey];
  if (profile === undefined) {
    throw new LifecycleExecutionContractError(
      `unknown room lifecycle profile ${input.lifecycleProfileKey}`,
    );
  }
  const envelope = catalog.encounterEnvelopes.byKey[input.encounterEnvelopeKey];
  if (envelope === undefined) {
    throw new LifecycleExecutionContractError(
      `unknown encounter envelope ${input.encounterEnvelopeKey}`,
    );
  }
  if (!profile.encounterEnvelopeKeys.includes(envelope.key)) {
    throw new LifecycleExecutionContractError(
      `${envelope.key} is incompatible with ${profile.key}`,
    );
  }
  const selectedPhases = input.encounterPhases ?? Object.freeze([]);
  if (
    selectedPhases.length > envelope.slots.length ||
    selectedPhases.some((phase, index) => {
      const slot = envelope.slots[index];
      const definition = catalog.encounterDefinitions.byKey[phase.encounterKey];
      const invalid =
        slot === undefined ||
        phase.envelopeKey !== envelope.key ||
        phase.slotKey !== slot.key ||
        definition === undefined ||
        phase.label !== definition.label ||
        phase.kind !== definition.kind ||
        phase.countsEncounterDepth !== definition.countsEncounterDepth ||
        (phase.canEncounterSkip !== undefined &&
          phase.canEncounterSkip !== (definition.canEncounterSkip === true)) ||
        (phase.blocksFigLeaf !== undefined &&
          phase.blocksFigLeaf !== (definition.blocksFigLeaf === true)) ||
        (phase.blocksGorgon !== undefined &&
          phase.blocksGorgon !== (definition.blocksGorgon === true)) ||
        (phase.skipEndEncounterEffects !== undefined &&
          phase.skipEndEncounterEffects !== (definition.skipEndEncounterEffects === true)) ||
        phase.sequenceEffect?.kind !== definition.sequenceEffect?.kind ||
        phase.rewardAttachment !== slot.rewardAttachment;
      return invalid;
    })
  ) {
    throw new LifecycleExecutionContractError(
      `${envelope.key} selected an invalid active encounter-slot prefix`,
    );
  }
  const selectedOfferPoints = new Set(
    selectedPhases.flatMap((phase) =>
      phase.rewardAttachment?.kind === 'rewardWheel' ? [phase.rewardAttachment.key] : [],
    ),
  );
  if (
    Object.keys(input.offerPointRewardStores ?? {}).some(
      (offerPoint) => !selectedOfferPoints.has(offerPoint),
    )
  ) {
    throw new LifecycleExecutionContractError(
      `${envelope.key} received a store for an inactive offer point`,
    );
  }

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
    return { input, profile, encounterPhases: Object.freeze([...selectedPhases]) };
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
  return {
    input,
    profile,
    encounterPhases: Object.freeze([...selectedPhases]),
    producerRewardLifecycle,
  };
}

function createRoomActionSchedule(context: ExecutionContext): RoomActionSchedule {
  const roster = context.input.roomActionRoster;
  if (roster === undefined) {
    throw new LifecycleExecutionContractError('room-action execution requires a roster');
  }
  const lifecycleStructure = roster.lifecycleStructure;
  if (lifecycleStructure.profileKey !== context.profile.key) {
    throw new LifecycleExecutionContractError(
      `${context.profile.key} received ${lifecycleStructure.profileKey} room-action structure`,
    );
  }
  const origin = context.input.origin;
  const rankedRows = roster.rows
    // A retained Pool sale must reach its declared lifecycle point even when
    // its slot was later cleared. Reward simulation owns the precise stale
    // finding and deliberately leaves the authored action intact.
    .filter(
      (row) => row.rank !== null && (!row.stale || row.reference.kind === 'sellPurgingPoolTrait'),
    )
    .sort((left, right) => left.rank! - right.rank!);
  let cursor = 0;

  const blockAt = (state: ExecutionState, row: RoomActionRow): ExecutionState =>
    Object.freeze({
      ...state,
      blockedAt:
        origin.kind === 'occurrence'
          ? createRoomActionAddress(
              createBiomeAddress(origin.routeKey, origin.biomeKey),
              origin.occurrenceId,
              row.key,
            )
          : (row.owner as import('../../authored-project/addresses').RoomActionSemanticAddress),
    });

  const firstMissingRequired = (predicate: (row: RoomActionRow) => boolean) =>
    roster.rows.find(
      (row) =>
        row.rank === null && row.participation === 'required' && !row.stale && predicate(row),
    );

  const playerAction = (
    row: RoomActionRow,
    operationIndex: number,
    state: ExecutionState,
  ): ExecutionState => {
    const operationContext = { ...context, operationIndex };
    switch (row.reference.kind) {
      case 'interactLocalReward':
        return appendEvent(state, operationContext, {
          kind: 'acquisitionPointReached',
          point: `localReward:${row.reference.groupKey}:${row.reference.slotKey}`,
        });
      case 'interactWheelReward':
        return appendEvent(state, operationContext, {
          kind: 'offerPointAcquired',
          offerPoint: row.reference.wheelKey,
          ...(context.input.offerPointRewardStores?.[row.reference.wheelKey] === undefined
            ? {}
            : {
                enteredRewardStoreKey: context.input.offerPointRewardStores[row.reference.wheelKey],
              }),
        });
      case 'purchaseStygianWellOffer':
        return appendEvent(state, operationContext, {
          kind: 'wellPurchase',
          generationKey: row.reference.generationKey,
        });
      case 'interactShopOffer':
        return appendEvent(state, operationContext, {
          kind: 'acquisitionPointReached',
          point: `shopOffer:${row.reference.offerKey}`,
        });
      case 'purchaseHermesShrineOffer':
        return appendEvent(state, operationContext, {
          kind: 'acquisitionPointReached',
          point: `hermesShrinePurchase:${row.reference.generationKey}`,
        });
      case 'sellPurgingPoolTrait':
        return appendEvent(state, operationContext, {
          kind: 'acquisitionPointReached',
          point: `purgingPool:${row.reference.slotKey}`,
        });
      case 'interactEncounter':
        return appendEvent(state, operationContext, {
          kind: 'encounterInteractionReached',
          phaseKey: row.reference.phaseKey,
          interaction: 'encounter',
        });
      case 'interactGorgon':
        return appendEvent(state, operationContext, {
          kind: 'encounterInteractionReached',
          phaseKey: row.reference.phaseKey,
          interaction: 'gorgon',
        });
      case 'interactAcquisitionEntry':
        return appendEvent(state, operationContext, {
          kind: 'acquisitionPointReached',
          point: `acquisitionEntry:${row.reference.siteKey}:${row.reference.entryKey}`,
          siteKey: row.reference.siteKey,
          entryKey: row.reference.entryKey,
        });
      case 'useFountain':
        return appendEvent(state, operationContext, {
          kind: 'fountainUsed',
          owner: row.owner as import('../../authored-project/addresses').RoomActionSemanticAddress,
        });
      case 'interactKeepsakeRack':
        return appendEvent(state, operationContext, {
          kind: 'keepsakeRackUsed',
          owner: row.owner as import('../../authored-project/addresses').RoomActionSemanticAddress,
        });
      case 'completeFieldsCage':
      case 'chooseRewardWheel':
        throw new LifecycleExecutionContractError(
          `${row.reference.kind} reached outside its declared lifecycle insertion point`,
        );
      case 'interactIncomingReward':
        if (context.producerRewardLifecycle === undefined) return state;
        throw new LifecycleExecutionContractError(
          `${row.reference.kind} reached outside its declared lifecycle insertion point`,
        );
    }
  };

  const consumeGenericBefore = (
    targetKey: string,
    targetWindowRank: number,
    operationIndex: number,
    initial: ExecutionState,
  ): ExecutionState => {
    let state = initial;
    const missingEarlier = firstMissingRequired(
      (row) => roomLifecycleWindowOrdinal(lifecycleStructure, row.window) < targetWindowRank,
    );
    if (missingEarlier !== undefined) return blockAt(state, missingEarlier);
    while (cursor < rankedRows.length) {
      const row = rankedRows[cursor]!;
      if (row.key === targetKey) return state;
      if (!row.executable) return blockAt(state, row);
      if (roomLifecycleWindowOrdinal(lifecycleStructure, row.window) > targetWindowRank) break;
      state = playerAction(row, operationIndex, state);
      cursor += 1;
    }
    return state;
  };

  const consumeExact = (
    reference: RoomActionReference,
    operationIndex: number,
    initial: ExecutionState,
    emitPlayerAction: boolean,
  ): ExecutionState => {
    const key = roomActionKey(reference);
    const target = roster.rows.find((row) => row.key === key && !row.stale);
    if (target === undefined) return initial;
    if (target.rank === null) return blockAt(initial, target);
    let state = consumeGenericBefore(
      key,
      roomLifecycleWindowOrdinal(lifecycleStructure, target.window),
      operationIndex,
      initial,
    );
    if (state.blockedAt !== undefined) return state;
    const row = rankedRows[cursor];
    if (row?.key !== key || !row.executable) return blockAt(state, row ?? target);
    if (emitPlayerAction) state = playerAction(row, operationIndex, state);
    cursor += 1;
    return state;
  };

  const drainThroughRank = (
    throughRank: number,
    operationIndex: number,
    initial: ExecutionState,
  ): ExecutionState => {
    let state = initial;
    while (cursor < rankedRows.length && rankedRows[cursor]!.rank! <= throughRank) {
      const row = rankedRows[cursor]!;
      const missingEarlier = firstMissingRequired(
        (missing) =>
          roomLifecycleWindowOrdinal(lifecycleStructure, missing.window) <
          roomLifecycleWindowOrdinal(lifecycleStructure, row.window),
      );
      if (missingEarlier !== undefined) return blockAt(state, missingEarlier);
      if (!row.executable) return blockAt(state, row);
      state = playerAction(row, operationIndex, state);
      cursor += 1;
    }
    return state;
  };

  const beforeOperation = (
    operation: RoomLifecycleOperation,
    operationIndex: number,
    initial: ExecutionState,
  ): ExecutionState => {
    if (initial.blockedAt !== undefined) return initial;
    if (operation.kind === 'advanceProducer') {
      let state = initial;
      const bindings =
        context.producerRewardLifecycle?.acquisitionLifecycle.filter(
          (binding) => binding.lifecyclePoint === operation.point,
        ) ?? [];
      for (const binding of bindings) {
        state = consumeExact(
          Object.freeze({
            kind: 'interactIncomingReward',
            producerPoint: binding.lifecyclePoint,
            acquisitionRole: binding.role,
          }),
          operationIndex,
          state,
          false,
        );
        if (state.blockedAt !== undefined) return state;
      }
      return state;
    }
    if (operation.kind === 'generateOutgoingBatch') {
      const checkpoint = roster.checkpoints.find(
        (candidate) => candidate.checkpointKey === 'outgoingGeneration',
      );
      let state = drainThroughRank(checkpoint?.afterRank ?? 0, operationIndex, initial);
      if (state.blockedAt !== undefined) return state;
      const missing = firstMissingRequired((row) => row.window.kind !== 'postOutgoing');
      if (missing !== undefined) state = blockAt(state, missing);
      return state;
    }
    if (operation.kind === 'settleAcquisitionPoint' || operation.kind === 'commitRoom') {
      let state = drainThroughRank(Number.POSITIVE_INFINITY, operationIndex, initial);
      if (state.blockedAt !== undefined) return state;
      const missing = firstMissingRequired(() => true);
      if (missing !== undefined) state = blockAt(state, missing);
      return state;
    }
    return initial;
  };

  const encounterPhases = (
    phases: readonly ResolvedEncounterPhase[],
  ): readonly ResolvedEncounterPhase[] => {
    const byKey = new Map(phases.map((phase) => [phase.slotKey, phase]));
    return Object.freeze(
      lifecycleStructure.phases.flatMap((phase) => {
        const resolved = byKey.get(phase.phaseKey);
        if (resolved === undefined) {
          throw new LifecycleExecutionContractError(
            `${lifecycleStructure.profileKey} structure selected missing phase ${phase.phaseKey}`,
          );
        }
        return [resolved];
      }),
    );
  };

  const beforeEncounterPhase = (
    phase: ResolvedEncounterPhase,
    operationIndex: number,
    state: ExecutionState,
  ): ExecutionState => {
    if (
      context.profile.key === 'FieldsCombatRoom' &&
      phase.rewardAttachment?.kind === 'localReward'
    )
      return consumeExact(
        Object.freeze({ kind: 'completeFieldsCage', phaseKey: phase.slotKey }),
        operationIndex,
        state,
        false,
      );
    if (context.profile.key === 'ShipCombatRoom' && phase.rewardAttachment?.kind === 'rewardWheel')
      return consumeExact(
        Object.freeze({ kind: 'chooseRewardWheel', wheelKey: phase.rewardAttachment.key }),
        operationIndex,
        state,
        false,
      );
    return state;
  };

  const afterEncounterPhase = (
    phase: ResolvedEncounterPhase,
    operationIndex: number,
    state: ExecutionState,
  ): ExecutionState =>
    context.profile.key === 'ShipCombatRoom' && phase.rewardAttachment?.kind === 'rewardWheel'
      ? consumeExact(
          Object.freeze({ kind: 'interactWheelReward', wheelKey: phase.rewardAttachment.key }),
          operationIndex,
          state,
          true,
        )
      : state;

  return Object.freeze({
    encounterPhases,
    beforeOperation,
    beforeEncounterPhase,
    afterEncounterPhase,
  });
}

export function executeRoomLifecycle(
  catalog: Catalog,
  input: RoomLifecycleExecutionInput,
): RoomHistoryFragment {
  const context = resolveExecutionContext(catalog, input);
  const schedule =
    input.roomActionRoster === undefined ? undefined : createRoomActionSchedule(context);
  let state: ExecutionState = Object.freeze({ events: Object.freeze([]) });
  for (const [operationIndex, operation] of context.profile.operations.entries()) {
    if (schedule !== undefined) {
      state = schedule.beforeOperation(operation, operationIndex, state);
      if (state.blockedAt !== undefined) break;
    }
    state = operationDispatchRegistry[operation.kind](
      operation,
      context,
      operationIndex,
      state,
      schedule,
    );
    if (state.blockedAt !== undefined) break;
  }
  return Object.freeze({
    origin: input.origin,
    lifecycleProfileKey: context.profile.key,
    encounterEnvelopeKey: context.input.encounterEnvelopeKey,
    events: state.events,
    ...(state.blockedAt === undefined ? {} : { blockedAt: state.blockedAt }),
  });
}

/**
 * Emits only the exact preparation-and-record prefix for a room whose later
 * active phase is invalid. The caller deliberately does not enter the room,
 * start a phase, acquire a reward, advance counters, or commit/exit it.
 */
export function executeEncounterRecordPrefix(
  catalog: Catalog,
  input: RoomLifecycleExecutionInput,
): RoomHistoryFragment {
  const context = resolveExecutionContext(catalog, input);
  const operationIndex = context.profile.operations.findIndex(
    (operation) => operation.kind === 'prepareRoom',
  );
  const operation = context.profile.operations[operationIndex];
  if (
    operationIndex < 0 ||
    operation?.kind !== 'prepareRoom' ||
    !operation.effects.includes('recordEncounter')
  ) {
    throw new LifecycleExecutionContractError(
      `${context.profile.key} has no encounter-record preparation operation`,
    );
  }
  const state = applyEffects(
    operation,
    { ...context, operationIndex },
    Object.freeze({ events: Object.freeze([]) }),
  );
  return Object.freeze({
    origin: input.origin,
    lifecycleProfileKey: context.profile.key,
    encounterEnvelopeKey: context.input.encounterEnvelopeKey,
    events: state.events,
  });
}
