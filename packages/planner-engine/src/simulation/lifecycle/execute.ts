import type {
  Catalog,
  RoomLifecycleEffectKind,
  RoomLifecycleOperation,
  RoomLifecycleProfile,
} from '../../catalog-schema';
import type { ProducerRewardLifecycleDeclaration } from '../../reward-kernel/model';
import type { ResolvedEncounterPhase } from '../encounters';
import type { RoomHistoryFragment, RoomLifecycleEvent, RoomLifecycleExecutionInput } from './model';
import { INFERNAL_CONTRACT_PEDESTAL_SITE_KEY } from '../../authored-project/infernal-contract-pedestal';
import { createBiomeAddress, createRoomActionAddress } from '../../authored-project/addresses';
import type { RoomActionReference } from '../../authored-project/model';
import { roomActionKey } from '../../authored-project/room-actions/state';
import {
  roomActionOpeningPoint,
  roomEventPlaces,
  runsOneEncounter,
} from '../../authored-project/room-actions/event-graph';
import { roomWalkSteps, type RoomWalkStep } from './overview';
import { resolvedEncounterPhaseForDefinition } from '../encounters/resolve';
import { doorsReadyAfterRank, type RoomActionRow } from '../room-actions';
import { purgingPoolSalePoint } from '../commerce/feature-rolls';

type RoomLifecycleOperationKind = RoomLifecycleOperation['kind'];

interface ExecutionContext {
  readonly catalog: Catalog;
  readonly input: RoomLifecycleExecutionInput;
  readonly profile: RoomLifecycleProfile;
  readonly steps: readonly RoomWalkStep[];
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
  readonly reachedActions?: readonly import('./model').ReachedRoomAction[];
  readonly blockedAt?: import('../../authored-project/addresses').RoomActionSemanticAddress;
  readonly blockedDeadline?: import('./model').RequiredActionDeadline;
}

interface RoomActionSchedule {
  /** The phases the room's encounters run, in run order. */
  readonly runPhases: readonly ResolvedEncounterPhase[];
  /**
   * A room reward point: each pickup taken there runs with the rows before it.
   * An unplaced pickup a fight waits on stops the walk at that fight; one
   * nothing waits on lies on the ground, and the point passes uncollected.
   */
  readonly rewardPoint: (
    operation: Extract<RoomLifecycleOperation, { readonly kind: 'advanceProducer' }>,
    operationIndex: number,
    state: ExecutionState,
  ) => ExecutionState;
  /** Doors open fires once the doors predicate holds. */
  readonly doorsOpen: (operationIndex: number, state: ExecutionState) => ExecutionState;
  /** The opened doors schedule the Shrine's deliveries. */
  readonly doorsOpened: (operationIndex: number, state: ExecutionState) => ExecutionState;
  /** Leaving takes every ranked row; a required row still unplaced stops the walk. */
  readonly leave: (operationIndex: number, state: ExecutionState) => ExecutionState;
  /** The phase's encounter begins: its wheels open and the rows its begin and gate wait on run. */
  readonly beforeCombat: (
    phase: ResolvedEncounterPhase,
    operationIndex: number,
    state: ExecutionState,
  ) => ExecutionState;
  /** The ready wait: the required items its end spawns are taken before its end effects. */
  readonly readyWait: (
    phase: ResolvedEncounterPhase,
    operationIndex: number,
    state: ExecutionState,
  ) => ExecutionState;
  /** Deliveries its end effects make due, taken before a later phase begins. */
  readonly afterEndEffects: (
    phase: ResolvedEncounterPhase,
    operationIndex: number,
    state: ExecutionState,
  ) => ExecutionState;
}

type EventData<Event extends RoomLifecycleEvent = RoomLifecycleEvent> =
  Event extends RoomLifecycleEvent ? Omit<Event, 'operationIndex' | 'origin' | 'sequence'> : never;

type EffectHandler = (context: OperationContext, state: ExecutionState) => ExecutionState;

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
  const step = context.steps[context.operationIndex];
  const operation = step?.kind === 'operation' ? step.operation : undefined;
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

function encounterAllowsEndEffects(phase: ResolvedEncounterPhase): boolean {
  return phase.kind !== 'nonCombat' && phase.kind !== 'story' && !phase.skipEndEncounterEffects;
}

/**
 * The phase's script waits for every required object before its end effects
 * (`WaitForNextEncounterReady`), which holds them while what its fight
 * spawned lies uncollected.
 */
function waitsForReady(context: ExecutionContext, phase: ResolvedEncounterPhase): boolean {
  return (
    context.input.roomActionRoster !== undefined &&
    encounterAllowsEndEffects(phase) &&
    context.catalog.encounterDefinitions.byKey[phase.encounterKey]?.script.waitReadyBeforeEnd ===
      true
  );
}

/** Whether the wheel's offers already rolled, at Wheels open or its phase start. */
function wheelOffersRolled(state: ExecutionState, wheelKey: string): boolean {
  return state.events.some(
    (event) => event.kind === 'offerPointMaterialized' && event.offerPoint === wheelKey,
  );
}

function appendEncounterEndEffects(
  context: OperationContext,
  state: ExecutionState,
): ExecutionState {
  const phase = requireEncounterPhase(context);
  return appendEvent(state, context, {
    kind: 'encounterEndEffectsApplied',
    phaseKey: phase.slotKey,
    execution: context.figLeafSkipped === true ? 'skippedByFigLeaf' : 'normal',
    figLeafSkipOwner: context.figLeafSkipOwner === true,
  });
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
  recordAppearance: (context, state) =>
    appendEvent(state, context, {
      kind: 'roomEntered',
      surfaceShopPresent: context.input.surfaceShopPresent === true,
      roomShopPresent: context.input.roomShopPresent === true,
      ...(context.input.challengeSwitchPresent === true
        ? { challengeSwitchPresent: true as const }
        : {}),
      ...(context.input.counterEffects.resetsBiomeDepthCache === true
        ? { biomeDepthCacheReset: true as const }
        : {}),
      ...(context.input.counterEffects.enteredBiomeDepthCache === undefined
        ? {}
        : { enteredBiomeDepthCache: context.input.counterEffects.enteredBiomeDepthCache }),
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
    for (const phase of context.encounterPhases)
      next = encounterEffects.recordEncounter({ ...context, encounterPhase: phase }, next);
    return next;
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
      ...(context.input.counterEffects.resetsBiomeDepthCache === true
        ? { biomeDepthCacheReset: true as const }
        : {}),
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

/** What a phase's encounter does as it runs: it is recorded, its wheels open, combat starts, it ends. */
const encounterEffects = Object.freeze({
  recordEncounter: (context, state) => {
    const phase = requireEncounterPhase(context);
    return appendEvent(state, context, {
      kind: 'encounterRecorded',
      phaseKey: phase.slotKey,
      encounterEnvelopeKey: phase.envelopeKey,
      encounterKey: phase.encounterKey,
      phaseKind: phase.kind,
      ...(phase.generatedCustomization === undefined
        ? {}
        : { generatedCustomization: phase.generatedCustomization }),
    });
  },
  recordPhaseOfferPoint: (context, state) => {
    const attachment = requireEncounterPhase(context).rewardAttachment;
    if (attachment?.kind !== 'rewardWheel' || wheelOffersRolled(state, attachment.key))
      return state;
    return appendEvent(state, context, {
      kind: 'offerPointMaterialized',
      offerPoint: attachment.key,
    });
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
    const endEffects =
      !encounterAllowsEndEffects(phase) ||
      context.catalog.encounterDefinitions.byKey[phase.encounterKey]?.script.endEffects === 'none'
        ? 'none'
        : waitsForReady(context, phase)
          ? 'deferred'
          : 'applied';
    const completed =
      context.catalog.encounterDefinitions.byKey[phase.encounterKey]?.script
        .endsWithBossDefeated === true
        ? appendEvent(
            appendEvent(state, context, { ...completion, kind: 'bossDefeated' }),
            context,
            { ...completion, endEffects },
          )
        : appendEvent(state, context, { ...completion, endEffects });
    if (endEffects !== 'applied') return completed;
    return appendEncounterEndEffects(context, completed);
  },
}) satisfies Readonly<Record<string, EffectHandler>>;

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

function figLeafSkipsPhase(context: ExecutionContext, phaseKey: string): boolean {
  const skipOwnerIndex = context.encounterPhases.findIndex(
    (phase) => phase.figLeafSkip && phase.canEncounterSkip,
  );
  const phaseIndex = context.encounterPhases.findIndex((phase) => phase.slotKey === phaseKey);
  return (
    skipOwnerIndex >= 0 &&
    phaseIndex >= skipOwnerIndex &&
    (context.encounterPhases[skipOwnerIndex]?.skipEndEncounterEffects === true ||
      phaseIndex === skipOwnerIndex)
  );
}

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
  const declaration = input.roomDeclaration;
  if (declaration.encounterEnvelopeKey !== envelope.key) {
    throw new LifecycleExecutionContractError(
      `${declaration.gameName} does not declare ${envelope.key}`,
    );
  }
  const producer = input.producer;
  const steps = roomWalkSteps(catalog, profile, declaration, producer !== undefined);
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
  const hasRequiredObjectOperations = steps.some(
    (step) =>
      step.kind === 'operation' &&
      (step.operation.kind === 'spawnRequiredObjects' ||
        step.operation.kind === 'completeRequiredObjects'),
  );
  if (hasRequiredObjects !== hasRequiredObjectOperations) {
    throw new LifecycleExecutionContractError(
      `${profile.key} required-object operations do not match lifecycle input`,
    );
  }
  if (producer === undefined)
    return { catalog, input, profile, steps, encounterPhases: Object.freeze([...selectedPhases]) };
  if (profile.producer.kind === 'none') {
    throw new LifecycleExecutionContractError(`${profile.key} does not accept a producer`);
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
    steps.flatMap((step) =>
      step.kind === 'operation' && step.operation.kind === 'advanceProducer'
        ? [step.operation.point]
        : [],
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
    catalog,
    input,
    profile,
    steps,
    encounterPhases: Object.freeze([...selectedPhases]),
    producerRewardLifecycle,
  };
}

function createRoomActionSchedule(context: ExecutionContext): RoomActionSchedule {
  const roster = context.input.roomActionRoster;
  if (roster === undefined) {
    throw new LifecycleExecutionContractError('room-action execution requires a roster');
  }
  const eventGraph = roster.eventGraph;
  if (eventGraph.profileKey !== context.profile.key) {
    throw new LifecycleExecutionContractError(
      `${context.profile.key} received ${eventGraph.profileKey} room-action structure`,
    );
  }
  const origin = context.input.origin;
  // Skipped enemy waves never spawn their NPC. Keep the prepared encounter
  // and its end effects, but leave the authored interaction dormant.
  const skippedInteraction = (row: RoomActionRow) =>
    row.reference.kind === 'interactEncounter' &&
    figLeafSkipsPhase(context, row.reference.phaseKey);
  const rankedRows = roster.rows
    .filter((row) => row.rank !== null && !skippedInteraction(row) && !row.stale)
    .sort((left, right) => left.rank! - right.rank!);
  let cursor = 0;
  let shrineScheduled = false;

  const scheduleShrineDeliveries = (
    operationIndex: number,
    initial: ExecutionState,
  ): ExecutionState => {
    if (shrineScheduled || context.input.hermesShrine === undefined) return initial;
    shrineScheduled = true;
    const purchaseActions = roster.rows.flatMap((row) =>
      row.reference.kind === 'purchaseHermesShrineOffer' ? [row.reference] : [],
    );
    const shrine = context.input.hermesShrine;
    const deliveries = (['first', 'secondLeft', 'secondRight'] as const).flatMap((slotKey) => {
      const generationKey = `initial:${slotKey}` as const;
      const action = purchaseActions.find((candidate) => candidate.generationKey === generationKey);
      const offer = shrine.offerBySlot[slotKey];
      return action === undefined || offer === null
        ? []
        : [
            Object.freeze({
              generationKey,
              rewardType: offer.rewardType,
              delay: offer.delay,
            }),
          ];
    });
    if (deliveries.length === 0) return initial;
    return appendEvent(
      initial,
      { ...context, operationIndex },
      { kind: 'hermesShrineDeliveriesScheduled', deliveries: Object.freeze(deliveries) },
    );
  };

  /**
   * Records a ranked row as reached once its own step ran: at its first own
   * event, or with the next event the walk emits when it emitted none.
   */
  const reach = (
    before: ExecutionState,
    after: ExecutionState,
    row: RoomActionRow,
  ): ExecutionState =>
    row.rank === null
      ? after
      : Object.freeze({
          ...after,
          reachedActions: Object.freeze([
            ...(after.reachedActions ?? []),
            Object.freeze({
              actionKey: row.key,
              sequence: before.events.length + 1,
              ...(after.events.length > before.events.length
                ? { through: after.events.length }
                : {}),
            }),
          ]),
        });

  // The walk stops at a ranked row it reached; an unranked one has no position.
  const blockAt = (
    initial: ExecutionState,
    row: RoomActionRow,
    deadline?: import('./model').RequiredActionDeadline,
  ): ExecutionState => {
    const state = reach(initial, initial, row);
    return Object.freeze({
      ...state,
      ...(deadline === undefined ? {} : { blockedDeadline: deadline }),
      blockedAt:
        origin.kind === 'occurrence'
          ? createRoomActionAddress(
              createBiomeAddress(origin.routeKey, origin.biomeKey),
              origin.occurrenceId,
              row.key,
            )
          : (row.owner as import('../../authored-project/addresses').RoomActionSemanticAddress),
    });
  };

  const place = roomEventPlaces(eventGraph);
  /** Where a row opens: the place its enabler, or else its spawn, holds from. */
  const opening = (row: RoomActionRow) => place(roomActionOpeningPoint(row.bounds));

  /** The unplaced required rows opening before a place: the earliest is due first. */
  const unplacedBefore = (at: number) =>
    roster.rows.find(
      (row) =>
        row.rank === null &&
        row.participation === 'required' &&
        !row.stale &&
        !skippedInteraction(row) &&
        opening(row) < at,
    );

  const liveRow = (reference: RoomActionReference) => {
    const key = roomActionKey(reference);
    return roster.rows.find((row) => row.key === key && !row.stale);
  };

  /**
   * The fight a press begins runs at once: recorded when its script records,
   * started, counted for depth and, unless left, completed, with no end effects.
   */
  const pressFight = (
    row: RoomActionRow,
    operationContext: OperationContext,
    state: ExecutionState,
  ): ExecutionState => {
    const fight = eventGraph.pressFights.find(
      (candidate) => roomActionKey(candidate.press) === row.key,
    );
    if (fight === undefined) return state;
    const phase = resolvedEncounterPhaseForDefinition(
      context.catalog,
      { slotKey: fight.phaseKey, envelopeKey: fight.envelopeKey, figLeafSkip: false },
      fight.encounterKey,
    );
    const fightContext = { ...operationContext, encounterPhase: phase };
    let next = fight.script.records ? encounterEffects.recordEncounter(fightContext, state) : state;
    next = encounterEffects.recordEncounterStart(fightContext, next);
    next = encounterEffects.advanceEncounterDepth(fightContext, next);
    return fight.completes ? encounterEffects.recordEncounterCompletion(fightContext, next) : next;
  };

  const playerAction = (
    row: RoomActionRow,
    operationIndex: number,
    state: ExecutionState,
  ): ExecutionState => {
    const operationContext = { ...context, operationIndex };
    switch (row.reference.kind) {
      case 'collectRequiredReward':
        // Native room completion owns this mandatory pickup. It participates
        // in authored chronology but intentionally mutates no simulated state.
        return state;
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
      case 'purchaseHermesShrineOffer':
        // Initial deliveries are scheduled together at the Shrine checkpoint; the
        // purchase's position prices it and decides the refill's purchase.
        return appendEvent(state, operationContext, {
          kind: 'hermesShrinePurchaseReached',
          generationKey: row.reference.generationKey,
        });
      case 'rushHermesShrineOffer':
        // The rush's own position spawns its item and decides the Travel Deal refill.
        return appendEvent(state, operationContext, {
          kind: 'hermesShrineRushReached',
          generationKey: row.reference.generationKey,
        });
      case 'interactShopOffer':
        return appendEvent(state, operationContext, {
          kind: 'acquisitionPointReached',
          point: `shopOffer:${row.reference.offerKey}`,
        });
      case 'interactInfernalContractPedestal':
        return appendEvent(state, operationContext, {
          kind: 'acquisitionPointReached',
          point: INFERNAL_CONTRACT_PEDESTAL_SITE_KEY,
        });
      case 'sellPurgingPoolTrait':
        return appendEvent(state, operationContext, {
          kind: 'acquisitionPointReached',
          point: purgingPoolSalePoint(row.reference),
        });
      case 'rerollStygianWell':
      case 'rerollPurgingPool':
        return appendEvent(state, operationContext, {
          kind: 'featureRerolled',
          owner: row.owner as import('../../authored-project/addresses').RoomActionSemanticAddress,
          feature: row.reference.kind === 'rerollStygianWell' ? 'stygianWell' : 'purgingPool',
          rerollId: row.reference.rerollId,
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
        if (context.input.keepsakeRackReplaces !== true) return state;
        return appendEvent(state, operationContext, {
          kind: 'keepsakeRackUsed',
          owner: row.owner as import('../../authored-project/addresses').RoomActionSemanticAddress,
        });
      case 'interactEris':
        return appendEvent(state, operationContext, {
          kind: 'erisInteracted',
          owner: row.owner as import('../../authored-project/addresses').RoomActionSemanticAddress,
        });
      case 'interactChallengeSwitch':
        return pressFight(
          row,
          operationContext,
          appendEvent(state, operationContext, {
            kind: 'challengeSwitchInteracted',
            owner:
              row.owner as import('../../authored-project/addresses').RoomActionSemanticAddress,
          }),
        );
      case 'unlockExit':
        return pressFight(
          row,
          operationContext,
          appendEvent(state, operationContext, {
            kind: 'exitUnlocked',
            owner:
              row.owner as import('../../authored-project/addresses').RoomActionSemanticAddress,
            exitKey: row.reference.exitKey,
          }),
        );
      // A wheel reroll's window opens at its wheel's roll, so its offers precede it.
      case 'reroll':
        return appendEvent(state, operationContext, {
          kind: 'rewardRerolled',
          owner: row.owner as import('../../authored-project/addresses').RoomActionSemanticAddress,
          target: row.reference.target,
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

  /**
   * Advances the walk by its ranked rows, in rank order: toward a trigger row,
   * taking each row whose spawn and enabler hold where the trigger opens, or
   * through a rank, taking each row as it opens. An unplaced required row
   * opening earlier stops the walk first, due at the row or trigger it would
   * pass. A ranked row the walk cannot take stops it there; an unplaced
   * trigger stops it once the rows that open with it are taken.
   */
  const advance = (
    goal:
      | { readonly kind: 'trigger'; readonly row: RoomActionRow; readonly emit: boolean }
      | { readonly kind: 'rank'; readonly rank: number },
    operationIndex: number,
    initial: ExecutionState,
  ): ExecutionState => {
    let state = initial;
    const target = goal.kind === 'trigger' ? goal.row : undefined;
    if (target !== undefined) {
      const missing = unplacedBefore(opening(target));
      if (missing !== undefined)
        return blockAt(state, missing, { kind: 'action', actionKey: target.key });
    }
    while (cursor < rankedRows.length) {
      const row = rankedRows[cursor]!;
      if (target === undefined) {
        if (row.rank! > (goal as { readonly rank: number }).rank) break;
        const missing = unplacedBefore(opening(row));
        if (missing !== undefined)
          return blockAt(state, missing, { kind: 'action', actionKey: row.key });
      } else if (row.key === target.key) break;
      if (!row.executable) {
        if (target?.rank === null) break;
        return blockAt(state, row);
      }
      if (target !== undefined && opening(row) > opening(target)) break;
      state = reach(state, playerAction(row, operationIndex, state), row);
      cursor += 1;
    }
    if (target === undefined) return state;
    // Its own verb starts the fight, so the fight is no deadline before it.
    if (target.rank === null) return blockAt(state, target);
    const row = rankedRows[cursor];
    if (row?.key !== target.key || !row.executable) return blockAt(state, row ?? target);
    state = reach(
      state,
      goal.kind === 'trigger' && goal.emit ? playerAction(row, operationIndex, state) : state,
      row,
    );
    cursor += 1;
    return state;
  };

  /** An event a row's verb triggers (a gate pickup, a wheel's choice, a cage) waits on that row. */
  const awaitTrigger = (
    reference: RoomActionReference,
    operationIndex: number,
    initial: ExecutionState,
  ): ExecutionState => {
    const target = liveRow(reference);
    if (target === undefined) return initial;
    if (initial.reachedActions?.some((action) => action.actionKey === target.key) === true)
      return initial;
    return advance({ kind: 'trigger', row: target, emit: false }, operationIndex, initial);
  };

  /**
   * Doors open: once every required row they wait on is taken (the single
   * doors predicate), after the rows ranked before the last of them.
   */
  const doorsOpen = (operationIndex: number, initial: ExecutionState): ExecutionState => {
    if (initial.blockedAt !== undefined) return initial;
    const ready = doorsReadyAfterRank(roster.rows);
    const state = advance({ kind: 'rank', rank: ready.afterRank }, operationIndex, initial);
    if (state.blockedAt !== undefined) return state;
    const missing = ready.unplaced.find((row) => !skippedInteraction(row));
    return missing === undefined ? state : blockAt(state, missing, { kind: 'doorsOpen' });
  };

  /** The room is left: every ranked row is taken and no required row is left unplaced. */
  const leave = (operationIndex: number, initial: ExecutionState): ExecutionState => {
    if (initial.blockedAt !== undefined) return initial;
    // A room without doors schedules its Shrine's deliveries as it is left.
    const doorless = !context.steps.some(
      (step) => step.kind === 'operation' && step.operation.kind === 'generateOutgoingBatch',
    );
    const state = advance(
      { kind: 'rank', rank: Number.POSITIVE_INFINITY },
      operationIndex,
      doorless ? scheduleShrineDeliveries(operationIndex, initial) : initial,
    );
    if (state.blockedAt !== undefined) return state;
    const missing = unplacedBefore(Number.POSITIVE_INFINITY);
    return missing === undefined ? state : blockAt(state, missing, { kind: 'leave' });
  };

  /**
   * A room reward point: each pickup taken there is the trigger of the fight
   * it starts, or runs with the rows before it. An unplaced pickup due at a
   * fight stops the walk there; one due later lies on the ground, and the
   * point passes uncollected.
   */
  const rewardPoint = (
    operation: Extract<RoomLifecycleOperation, { readonly kind: 'advanceProducer' }>,
    operationIndex: number,
    initial: ExecutionState,
  ): ExecutionState => {
    if (initial.blockedAt !== undefined) return initial;
    const pickups = (context.producerRewardLifecycle?.acquisitionLifecycle ?? []).flatMap(
      (binding) => {
        if (binding.lifecyclePoint !== operation.point) return [];
        const row = liveRow({
          kind: 'interactIncomingReward',
          producerPoint: binding.lifecyclePoint,
          acquisitionRole: binding.role,
        });
        return row === undefined ? [] : [row];
      },
    );
    const dueAtFight = (row: RoomActionRow) => row.bounds.deadline.kind === 'encounterStarted';
    const unplaced = (row: RoomActionRow) =>
      row.rank === null && row.participation === 'required' && !skippedInteraction(row);
    if (pickups.some((row) => unplaced(row) && !dueAtFight(row))) return initial;
    const reachedBefore = initial.reachedActions?.length ?? 0;
    let state = initial;
    for (const target of pickups) {
      if (target.rank === null) {
        const deadline = target.bounds.deadline;
        return blockAt(
          state,
          target,
          deadline.kind === 'encounterStarted'
            ? { kind: 'encounter', phaseKey: deadline.phaseKey }
            : undefined,
        );
      }
      state = advance({ kind: 'trigger', row: target, emit: false }, operationIndex, state);
      if (state.blockedAt !== undefined) return state;
    }
    const eventsBefore = state.events.length;
    state = applyEffects(operation, { ...context, operationIndex }, state);
    if (state.events.length === eventsBefore) return state;
    // A pickup settles with its point's events; rows reached before it keep their own.
    const keys = new Set(pickups.map((row) => row.key));
    const after = state;
    return Object.freeze({
      ...after,
      reachedActions: Object.freeze(
        (after.reachedActions ?? []).map((action, index) =>
          index < reachedBefore || !keys.has(action.actionKey)
            ? action
            : Object.freeze({
                actionKey: action.actionKey,
                sequence: eventsBefore + 1,
                through: after.events.length,
              }),
        ),
      ),
    });
  };

  // A multi-encounter or cage room runs the fights its graph orders (Fields cages by
  // activation); no fight runs for a Nemesis random event, which her talk row settles.
  const envelope = context.catalog.encounterEnvelopes.byKey[context.input.encounterEnvelopeKey];
  const runPhases =
    envelope !== undefined && runsOneEncounter(envelope)
      ? context.encounterPhases
      : (() => {
          const byKey = new Map(context.encounterPhases.map((phase) => [phase.slotKey, phase]));
          return Object.freeze(
            eventGraph.phases.flatMap((phase) => {
              if (phase.script?.endsByInteraction === true) return [];
              const resolved = byKey.get(phase.phaseKey);
              if (resolved === undefined)
                throw new LifecycleExecutionContractError(
                  `${eventGraph.profileKey} graph selected missing phase ${phase.phaseKey}`,
                );
              return [resolved];
            }),
          );
        })();

  const graphEvent = (kind: 'encounterBegun' | 'encounterStarted', phaseKey: string) =>
    eventGraph.events.find((event) => event.kind === kind && event.phaseKey === phaseKey);

  const beforeCombat = (
    phase: ResolvedEncounterPhase,
    operationIndex: number,
    initial: ExecutionState,
  ): ExecutionState => {
    // A phase's wheels open as its encounter begins.
    let state = encounterEffects.recordPhaseOfferPoint(
      { ...context, operationIndex, encounterPhase: phase },
      initial,
    );
    for (const kind of ['encounterBegun', 'encounterStarted'] as const) {
      const event = graphEvent(kind, phase.slotKey);
      if (event?.trigger.kind !== 'action') continue;
      state = awaitTrigger(event.trigger.action, operationIndex, state);
      if (state.blockedAt !== undefined) return state;
    }
    return state;
  };

  /**
   * The ready wait: the phase's end effects wait for the rows its fight
   * spawned; an unplaced required one holds them there.
   */
  const readyWait = (
    phase: ResolvedEncounterPhase,
    operationIndex: number,
    state: ExecutionState,
  ): ExecutionState => {
    if (!waitsForReady(context, phase)) return state;
    const dueAtEndEffects = roster.rows.filter(
      (row) =>
        !row.stale &&
        row.bounds.spawn.kind === 'encounterEnd' &&
        row.bounds.spawn.phaseKey === phase.slotKey,
    );
    const required = dueAtEndEffects.filter((row) => row.participation === 'required');
    const unranked = required.find((row) => row.rank === null);
    const lastRank = (unranked === undefined ? required : dueAtEndEffects).reduce(
      (rank, row) => Math.max(rank, row.rank ?? 0),
      0,
    );
    const next = advance({ kind: 'rank', rank: lastRank }, operationIndex, state);
    if (next.blockedAt !== undefined) return next;
    return unranked === undefined
      ? next
      : blockAt(next, unranked, { kind: 'phaseEnd', phaseKey: phase.slotKey });
  };

  const afterEndEffects = (
    phase: ResolvedEncounterPhase,
    operationIndex: number,
    state: ExecutionState,
  ): ExecutionState => {
    let next = state;
    // What a phase's end effects spawn waits for the next wheels to open.
    if (
      eventGraph.events.some(
        (event) => event.kind === 'wheelsOpen' && event.afterPhaseKey === phase.slotKey,
      )
    )
      return next;
    const deliveries = roster.rows
      .filter(
        (row) =>
          row.reference.kind === 'interactAcquisitionEntry' &&
          row.reference.siteKey === 'hermesShrineDelivery' &&
          row.reference.encounterPhaseKey === phase.slotKey,
      )
      .sort(
        (left, right) =>
          (left.rank ?? Number.POSITIVE_INFINITY) - (right.rank ?? Number.POSITIVE_INFINITY),
      );
    // An unplaced delivery lies where it spawned; its deadline stops the walk.
    for (const delivery of deliveries) {
      if (delivery.rank === null) continue;
      // Encounter end makes the delivery available; it does not let the
      // delivery leapfrog a peer post-encounter action authored before it.
      const current = rankedRows[cursor];
      if (current !== undefined && current.rank! < delivery.rank) break;
      if (current === undefined || current.rank! > delivery.rank) continue;
      next = advance({ kind: 'trigger', row: delivery, emit: true }, operationIndex, next);
      if (next.blockedAt !== undefined) return next;
    }
    return next;
  };

  return Object.freeze({
    runPhases,
    rewardPoint,
    doorsOpen,
    doorsOpened: scheduleShrineDeliveries,
    leave,
    beforeCombat,
    readyWait,
    afterEndEffects,
  });
}

/**
 * The room's encounters, each run by its graph's events: it begins (its
 * wheels open), the rows its begin and gate wait on run, combat starts, it
 * ends, any ready wait holds its end effects, and the deliveries those
 * effects make due are taken before the next phase begins.
 */
function runEncounters(
  context: ExecutionContext,
  combatIndex: number,
  endIndex: number,
  initial: ExecutionState,
  schedule: RoomActionSchedule | undefined,
): ExecutionState {
  let state = initial;
  const phases = schedule?.runPhases ?? context.encounterPhases;
  for (const phase of phases) {
    const skipped = figLeafSkipsPhase(context, phase.slotKey);
    const figLeaf = {
      ...(skipped ? { figLeafSkipped: true } : {}),
      ...(skipped && phase.figLeafSkip && phase.canEncounterSkip ? { figLeafSkipOwner: true } : {}),
    };
    const combat: OperationContext = {
      ...context,
      operationIndex: combatIndex,
      encounterPhase: phase,
      ...figLeaf,
    };
    const end: OperationContext = { ...combat, operationIndex: endIndex };
    if (schedule === undefined) state = encounterEffects.recordPhaseOfferPoint(combat, state);
    else {
      state = schedule.beforeCombat(phase, combatIndex, state);
      if (state.blockedAt !== undefined) return state;
    }
    state = encounterEffects.recordEncounterStart(combat, state);
    state = encounterEffects.advanceEncounterDepth(combat, state);
    state = encounterEffects.recordEncounterCompletion(end, state);
    if (schedule === undefined) continue;
    state = schedule.readyWait(phase, endIndex, state);
    if (state.blockedAt !== undefined) return state;
    if (waitsForReady(context, phase)) state = appendEncounterEndEffects(end, state);
    // A multi-encounter run takes them before its next phase; a single encounter's
    // follow with the rows after it.
    if (combatIndex === endIndex) {
      state = schedule.afterEndEffects(phase, endIndex, state);
      if (state.blockedAt !== undefined) return state;
    }
  }
  return state;
}

export function executeRoomLifecycle(
  catalog: Catalog,
  input: RoomLifecycleExecutionInput,
): RoomHistoryFragment {
  const context = resolveExecutionContext(catalog, input);
  const schedule =
    input.roomActionRoster === undefined ? undefined : createRoomActionSchedule(context);
  let state: ExecutionState = Object.freeze({ events: Object.freeze([]) });
  for (const [operationIndex, step] of context.steps.entries()) {
    if (step.kind === 'encounterEnds') continue;
    if (step.kind === 'encounters') {
      const ends = context.steps[operationIndex + 1]?.kind === 'encounterEnds';
      state = runEncounters(
        context,
        operationIndex,
        ends ? operationIndex + 1 : operationIndex,
        state,
        schedule,
      );
      if (state.blockedAt !== undefined) break;
      continue;
    }
    const operation = step.operation;
    if (schedule !== undefined && operation.kind === 'advanceProducer') {
      state = schedule.rewardPoint(operation, operationIndex, state);
      if (state.blockedAt !== undefined) break;
      continue;
    }
    if (schedule !== undefined) {
      if (operation.kind === 'generateOutgoingBatch')
        state = schedule.doorsOpen(operationIndex, state);
      else if (operation.kind === 'settleAcquisitionPoint' || operation.kind === 'commitRoom')
        state = schedule.leave(operationIndex, state);
      if (state.blockedAt !== undefined) break;
    }
    // Without a roster nothing is reached: a room reward point only records its events.
    state = applyEffects(operation, { ...context, operationIndex }, state);
    if (state.blockedAt !== undefined) break;
    if (schedule !== undefined && operation.kind === 'generateOutgoingBatch') {
      state = schedule.doorsOpened(operationIndex, state);
      if (state.blockedAt !== undefined) break;
    }
  }
  return Object.freeze({
    origin: input.origin,
    lifecycleProfileKey: context.profile.key,
    encounterEnvelopeKey: context.input.encounterEnvelopeKey,
    events: state.events,
    reachedActions: state.reachedActions ?? Object.freeze([]),
    ...(state.blockedAt === undefined ? {} : { blockedAt: state.blockedAt }),
    ...(state.blockedDeadline === undefined ? {} : { blockedDeadline: state.blockedDeadline }),
  });
}
