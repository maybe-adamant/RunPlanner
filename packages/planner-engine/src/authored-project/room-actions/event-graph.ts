import {
  isCombatBearingEncounterPhaseKind,
  type Catalog,
  type EncounterDefinition,
  type EncounterEnvelope,
  type RoomDeclaration,
  type RoomLifecycleProfile,
} from '../../catalog-schema';
import type { ProducerLifecyclePointKey } from '../../reward-kernel/model';
import type { RoomActionReference, RoomOccurrence } from '../model';
import {
  encounterEnvelopeSlots,
  encounterAuthoringProfileForKey,
  encounterSetForBinding,
  encounterBindingsBySlot,
  selectedEncounterAuthoringProfileKey,
} from '../room-state/encounter-envelope';

/**
 * A point of the room's event graph that a row's bounds name. Points that
 * happen together share one place: a phase's end effects apply at its end
 * unless its script waits for the room to be ready first, and the next
 * phase's wheels open with them.
 */
export type RoomEventPoint =
  | { readonly kind: 'roomEntered' }
  | { readonly kind: 'wheelsOpen'; readonly wheelKey: string }
  /** The phase's encounter has begun and waits on its gate row before Combat. */
  | { readonly kind: 'gate'; readonly phaseKey: string }
  | { readonly kind: 'encounterStarted'; readonly phaseKey: string }
  | { readonly kind: 'encounterEnd'; readonly phaseKey: string }
  | { readonly kind: 'endEffects'; readonly phaseKey: string }
  | { readonly kind: 'doorsOpened' }
  /** Every required item is taken, so a locked door can be pressed (`CheckRoomExitsReady`). */
  | { readonly kind: 'exitsReady' }
  | { readonly kind: 'leave' };

/**
 * Where a row may stand, in graph events: its item exists from its spawn, it
 * can be used once its enabler has happened, and a required row is taken
 * before its deadline, which an unplaced one stops the walk at.
 */
export interface RoomActionBounds {
  readonly spawn: RoomEventPoint;
  readonly enabler?: RoomEventPoint;
  readonly deadline: RoomEventPoint;
}

/** Where a row may stand, until its bounds replace it. */
export type RoomActionWindow =
  | { readonly kind: 'standard'; readonly phase: 'beforeCombat' | 'afterCombat' }
  | { readonly kind: 'encounterEnd'; readonly phaseKey: string }
  | { readonly kind: 'postOutgoing' }
  | { readonly kind: 'fields'; readonly phaseKey?: string }
  | { readonly kind: 'shipPreCombat'; readonly wheelKey: string }
  | { readonly kind: 'shipWheelsOpen'; readonly wheelKey: string }
  | { readonly kind: 'shipPostCombat'; readonly wheelKey: string };

/**
 * How an encounter's begin shows on the Timeline: with its Combat, apart from
 * it, or not at all (a Nemesis random event, whose events carry no marker).
 */
export type RoomEventMarkers = 'merged' | 'split' | 'none';

/** What makes a room event happen. */
export type RoomEventTrigger =
  /** It follows the event before it (room entry, a previous phase's end, an intro). */
  | { readonly kind: 'automatic' }
  /** A row's verb: using a gate pickup, a wheel or a cage. */
  | { readonly kind: 'action'; readonly action: RoomActionReference }
  /**
   * The exits' readiness becoming true: every required item before the doors
   * taken and every encounter ended. It fires right after the row that makes it true.
   */
  | { readonly kind: 'doorsPredicate' };

/**
 * One event of a room, in its graph order. Keys are stable within the room.
 * An encounter begins (`encounterBegun`, no effect), its gate rows stand
 * between, and its combat starts (`encounterStarted`, Combat: depth advances
 * and the Nemesis bet or an Anomaly capture is observed there); Boss defeated
 * and the encounter's end follow. A Nemesis random event's encounter has no
 * fight: its events carry no marker, and her talk row hosts her event.
 */
export type RoomEvent =
  | {
      readonly kind: 'roomEntered';
      readonly key: 'roomEntered';
      readonly trigger: Extract<RoomEventTrigger, { readonly kind: 'automatic' }>;
    }
  /**
   * A Ship phase's wheels roll as its encounter sets up: with the room for the
   * first phase, after the previous phase's end effects otherwise. The phase's
   * encounter begins here.
   */
  | {
      readonly kind: 'wheelsOpen';
      readonly key: string;
      readonly wheelKey: string;
      readonly phaseKey: string;
      /** The phase whose end opens these wheels; absent when they open with the room. */
      readonly afterPhaseKey?: string;
      readonly trigger: Extract<RoomEventTrigger, { readonly kind: 'automatic' }>;
    }
  | {
      readonly kind: 'encounterBegun';
      readonly key: string;
      readonly phaseKey: string;
      /** Automatic, or the cage row that begins it. */
      readonly trigger: RoomEventTrigger;
      /**
       * How it shows beside its Combat: as one marker when no gate stands
       * between them and that Combat hosts no Nemesis bet or Anomaly capture,
       * as its own otherwise, and not at all for a Nemesis random event.
       */
      readonly markers: RoomEventMarkers;
    }
  | {
      /** Combat: combat starts, depth advances, and the phase's outcome is observed. */
      readonly kind: 'encounterStarted';
      readonly key: string;
      readonly phaseKey: string;
      /** Automatic, or the gate row whose use starts combat (Opening or Devotion pickup, wheel). */
      readonly trigger: RoomEventTrigger;
      /** A Nemesis random event's: no Combat shows. */
      readonly markers?: 'none';
    }
  | {
      readonly kind: 'bossDefeated';
      readonly key: string;
      readonly phaseKey: string;
      readonly trigger: Extract<RoomEventTrigger, { readonly kind: 'automatic' }>;
    }
  | {
      readonly kind: 'encounterEnd';
      readonly key: string;
      readonly phaseKey: string;
      readonly trigger: Extract<RoomEventTrigger, { readonly kind: 'automatic' }>;
      /** A Nemesis random event's: her talk row shows where it ends. */
      readonly markers?: 'none';
    }
  | {
      readonly kind: 'doorsOpened';
      readonly key: 'doorsOpened';
      /** The room generates its outgoing doors here; a room without doors only unlocks its exit. */
      readonly generatesOutgoing: boolean;
      readonly trigger: Extract<RoomEventTrigger, { readonly kind: 'doorsPredicate' }>;
    };

export interface RoomEventGraphPhase {
  readonly phaseKey: string;
  readonly rewardWheelKey?: string;
  /** A noncombat event its required encounter interaction ends, not a fight. */
  readonly endsOnInteraction?: true;
  /** The phase can host an outcome choice, or the room authors one for it. */
  readonly hostsOutcome?: true;
}

export interface RoomEventGraph {
  readonly profileKey: string;
  readonly activeEncounterSlotKeys: readonly string[];
  /** Encounter phases in run order: Fields cages by their activation order. */
  readonly phases: readonly RoomEventGraphPhase[];
  readonly events: readonly RoomEvent[];
}

function frozen<T>(value: T): T {
  return Object.freeze(value);
}

const AUTOMATIC = frozen({ kind: 'automatic' as const });
const DOORS_PREDICATE = frozen({ kind: 'doorsPredicate' as const });

/** The producer point a gate role's pickup is taken at, in the room's reward lifecycles. */
function gateRolePoint(
  catalog: Catalog,
  profile: RoomLifecycleProfile,
  producer: boolean,
  role: string,
  gameName: string,
): ProducerLifecyclePointKey | undefined {
  if (!producer || profile.producer.kind === 'none') return undefined;
  const points = new Set<ProducerLifecyclePointKey>();
  for (const key of profile.producer.lifecycleProfileKeys)
    for (const reward of catalog.rewards.producerLifecycles.byKey[key]?.rewardTypes.values ?? [])
      for (const binding of reward.acquisitionLifecycle)
        if (binding.role === role) points.add(binding.lifecyclePoint);
  if (points.size !== 1)
    throw new Error(`${gameName} gate role ${role} has no single ${profile.key} producer point`);
  return [...points][0]!;
}

/**
 * The producer points a room takes before its encounters run: the reward
 * before combat and the points a bound encounter's gate pickup is taken at,
 * by script.
 */
export function producerPointsBeforeCombat(
  catalog: Catalog,
  profile: RoomLifecycleProfile,
  declaration: RoomDeclaration,
  producer: boolean,
): ReadonlySet<ProducerLifecyclePointKey> {
  const points = new Set<ProducerLifecyclePointKey>();
  if (!producer || profile.producer.kind === 'none') return points;
  const keys = declaration.encounterSlotBindings.flatMap((binding) =>
    binding.kind === 'set'
      ? (catalog.encounterSets.byKey[binding.encounterSetKey]?.encounterDefinitionKeys ?? [])
      : [
          binding.encounterDefinitionKey,
          ...(binding.rivalsEncounterDefinitionKey === undefined
            ? []
            : [binding.rivalsEncounterDefinitionKey]),
          ...(binding.shadowEncounterDefinitionKey === undefined
            ? []
            : [binding.shadowEncounterDefinitionKey]),
        ],
  );
  for (const key of keys) {
    const gate = catalog.encounterDefinitions.byKey[key]?.script.gate;
    if (gate?.kind !== 'useItemRole') continue;
    const point = gateRolePoint(catalog, profile, producer, gate.role, declaration.gameName);
    if (point !== undefined) points.add(point);
  }
  for (const point of profile.producer.points) if (point === 'beforeCombat') points.add(point);
  return points;
}

/**
 * Whether the room runs one encounter on its own: not native
 * `MultipleEncountersData` and no encounter a player's verb starts (Fields cages).
 */
export function runsOneEncounter(envelope: EncounterEnvelope): boolean {
  return (
    envelope.slots.length > 0 &&
    !envelope.multiEncounter &&
    envelope.slots.every((slot) => slot.activatedByVerb === undefined)
  );
}

interface GraphSlot {
  readonly phase: RoomEventGraphPhase;
  readonly definition?: EncounterDefinition;
  /** Its Combat hosts a choice: a Nemesis bet or an Anomaly capture. */
  readonly combatHostsOutcome?: true;
}

/** The room's events from its profile, its active encounter slots and their scripts. */
export function assembleRoomEventGraph(options: {
  readonly catalog: Catalog;
  readonly declaration: RoomDeclaration;
  readonly occurrence: RoomOccurrence;
  readonly lifecycleProfileKey: string;
  /** Whether the room's reward runs a producer. */
  readonly producer: boolean;
  readonly activeEncounterSlotKeys?: readonly string[];
  /** The room reward's pickups, whose role at a gate's point is the row using it. */
  readonly incomingRewardPickups?: readonly RoomActionReference[];
}): RoomEventGraph {
  const profile = options.catalog.roomLifecycleProfiles.byKey[options.lifecycleProfileKey];
  if (profile === undefined) {
    throw new Error(
      `${options.occurrence.gameName} selected unknown lifecycle ${options.lifecycleProfileKey}`,
    );
  }
  const envelopeSlots = encounterEnvelopeSlots(
    options.catalog,
    options.declaration,
    options.occurrence.gameName,
  );
  // Fields: the player starts each cage's encounter, in the order the cages are used.
  const fields = envelopeSlots.some((slot) => slot.activatedByVerb !== undefined);
  const activeSlotKeys =
    options.activeEncounterSlotKeys === undefined
      ? undefined
      : new Set(options.activeEncounterSlotKeys);
  const activeSlots = envelopeSlots.filter(
    (slot, index) =>
      (activeSlotKeys === undefined || activeSlotKeys.has(slot.key)) &&
      (options.occurrence.state.kind !== 'shipCombat' ||
        index < options.occurrence.state.encounterCount),
  );
  const outdoor = options.declaration.structuralTags.includes('Outdoor');
  const encounters = options.occurrence.encounters;
  const slots = activeSlots.flatMap((slot): readonly GraphSlot[] => {
    const encounterKey = selectedEncounterAuthoringProfileKey(
      options.catalog,
      options.declaration,
      options.occurrence.encounters,
      slot.key,
      options.occurrence.gameName,
    );
    const binding = encounterBindingsBySlot(
      options.catalog,
      options.declaration,
      options.occurrence.gameName,
    ).get(slot.key);
    const definition =
      binding?.kind === 'fixed'
        ? options.catalog.encounterDefinitions.byKey[binding.encounterDefinitionKey]
        : undefined;
    const authoring =
      binding?.kind === 'set' && encounterKey !== undefined
        ? encounterAuthoringProfileForKey(
            encounterSetForBinding(options.catalog, binding, options.occurrence.gameName),
            encounterKey,
            options.occurrence.gameName,
          )
        : undefined;
    const encounter = definition ?? authoring;
    const candidates = (
      definition !== undefined ? [definition.key] : (authoring?.encounterDefinitionKeys ?? [])
    ).flatMap((key) => options.catalog.encounterDefinitions.byKey[key] ?? []);
    // Every choice an outcome can host, before the walk decides which are eligible.
    const hostsOutcome =
      encounters.aetosWaveByPhase?.[slot.key] !== undefined ||
      encounters.gorgonResultByPhase[slot.key]?.athenaTriggerConditionMet === true ||
      options.occurrence.state.kind === 'anomaly' ||
      candidates.some((candidate) =>
        candidate.script.hostsOutcome.some((kind) =>
          kind === 'aetosWave'
            ? outdoor
            : kind === 'gorgon'
              ? !options.declaration.blocksGorgon
              : true,
        ),
      );
    const directDefinition =
      definition ??
      (authoring?.resolution.kind === 'direct'
        ? options.catalog.encounterDefinitions.byKey[authoring.resolution.encounterDefinitionKey]
        : undefined);
    // A boss fight's outcome is its Boss defeated.
    const bossEnding = (directDefinition ?? candidates[0])?.script.endsWithBossDefeated === true;
    const combatHostsOutcome =
      !bossEnding &&
      (options.occurrence.anomalyReplacement !== undefined ||
        candidates.some((candidate) => candidate.goldBet !== undefined));
    const wheel =
      slot.rewardAttachment?.kind === 'rewardWheel'
        ? { rewardWheelKey: slot.rewardAttachment.key }
        : {};
    if (directDefinition?.script.endsByInteraction === true)
      return [
        {
          phase: frozen({
            phaseKey: slot.key,
            ...wheel,
            endsOnInteraction: true as const,
            hostsOutcome: true as const,
          }),
          definition: directDefinition,
        },
      ];
    if (fields && slot.activatedByVerb === undefined) return [];
    if (
      options.occurrence.state.kind !== 'shipCombat' &&
      (encounter === undefined || !isCombatBearingEncounterPhaseKind(encounter.kind))
    )
      return [];
    return [
      {
        phase: frozen({
          phaseKey: slot.key,
          ...wheel,
          ...(hostsOutcome && !bossEnding ? { hostsOutcome: true as const } : {}),
        }),
        ...((directDefinition ?? candidates[0]) === undefined
          ? {}
          : { definition: directDefinition ?? candidates[0]! }),
        ...(combatHostsOutcome ? { combatHostsOutcome: true as const } : {}),
      },
    ];
  });
  const ordered = fields
    ? (() => {
        const byKey = new Map(slots.map((slot) => [slot.phase.phaseKey, slot]));
        // Cages run in activation order, a Nemesis event as she is answered.
        const ranked = options.occurrence.roomActions.order.flatMap((reference) =>
          (reference.kind === 'completeFieldsCage' ||
            (reference.kind === 'interactEncounter' &&
              byKey.get(reference.phaseKey)?.phase.endsOnInteraction === true)) &&
          byKey.has(reference.phaseKey)
            ? [byKey.get(reference.phaseKey)!]
            : [],
        );
        const rankedKeys = new Set(ranked.map((slot) => slot.phase.phaseKey));
        return [...ranked, ...slots.filter((slot) => !rankedKeys.has(slot.phase.phaseKey))];
      })()
    : slots;

  const events: RoomEvent[] = [
    frozen({ kind: 'roomEntered', key: 'roomEntered', trigger: AUTOMATIC }),
  ];
  let previousPhaseKey: string | undefined;
  for (const { phase, definition, combatHostsOutcome } of ordered) {
    // A Nemesis random event's encounter starts on entry and ends as she is answered.
    if (phase.endsOnInteraction === true) {
      events.push(
        frozen({
          kind: 'encounterBegun',
          key: `encounterBegun:${phase.phaseKey}`,
          phaseKey: phase.phaseKey,
          trigger: AUTOMATIC,
          markers: 'none',
        }),
        frozen({
          kind: 'encounterStarted',
          key: `encounterStarted:${phase.phaseKey}`,
          phaseKey: phase.phaseKey,
          trigger: AUTOMATIC,
          markers: 'none',
        }),
        frozen({
          kind: 'encounterEnd',
          key: `encounterEnd:${phase.phaseKey}`,
          phaseKey: phase.phaseKey,
          trigger: AUTOMATIC,
          markers: 'none',
        }),
      );
      continue;
    }
    const gate = definition?.script.gate ?? frozen({ kind: 'none' as const });
    if (phase.rewardWheelKey !== undefined)
      events.push(
        frozen({
          kind: 'wheelsOpen',
          key: `wheelsOpen:${phase.rewardWheelKey}`,
          wheelKey: phase.rewardWheelKey,
          phaseKey: phase.phaseKey,
          ...(previousPhaseKey === undefined ? {} : { afterPhaseKey: previousPhaseKey }),
          trigger: AUTOMATIC,
        }),
      );
    const begunTrigger: RoomEventTrigger =
      gate.kind === 'cageActivation'
        ? frozen({
            kind: 'action',
            action: frozen({ kind: 'completeFieldsCage', phaseKey: phase.phaseKey }),
          })
        : AUTOMATIC;
    const gatePoint =
      gate.kind === 'useItemRole'
        ? gateRolePoint(
            options.catalog,
            profile,
            options.producer,
            gate.role,
            options.occurrence.gameName,
          )
        : undefined;
    const startedTrigger: RoomEventTrigger =
      gate.kind === 'useItemRole' && gatePoint !== undefined
        ? frozen({
            kind: 'action',
            // The gate uses the room reward's pickup at its point, whatever role it spawns as.
            action:
              options.incomingRewardPickups?.find(
                (reference) =>
                  reference.kind === 'interactIncomingReward' &&
                  reference.producerPoint === gatePoint,
              ) ??
              frozen({
                kind: 'interactIncomingReward',
                producerPoint: gatePoint,
                acquisitionRole: gate.role,
              }),
          })
        : gate.kind === 'wheelUse' && phase.rewardWheelKey !== undefined
          ? frozen({
              kind: 'action',
              action: frozen({ kind: 'chooseRewardWheel', wheelKey: phase.rewardWheelKey }),
            })
          : AUTOMATIC;
    events.push(
      frozen({
        kind: 'encounterBegun',
        key: `encounterBegun:${phase.phaseKey}`,
        phaseKey: phase.phaseKey,
        trigger: begunTrigger,
        markers:
          startedTrigger.kind === 'automatic' && combatHostsOutcome !== true ? 'merged' : 'split',
      }),
      frozen({
        kind: 'encounterStarted',
        key: `encounterStarted:${phase.phaseKey}`,
        phaseKey: phase.phaseKey,
        trigger: startedTrigger,
      }),
    );
    if (definition?.script.endsWithBossDefeated === true)
      events.push(
        frozen({
          kind: 'bossDefeated',
          key: `bossDefeated:${phase.phaseKey}`,
          phaseKey: phase.phaseKey,
          trigger: AUTOMATIC,
        }),
      );
    events.push(
      frozen({
        kind: 'encounterEnd',
        key: `encounterEnd:${phase.phaseKey}`,
        phaseKey: phase.phaseKey,
        trigger: AUTOMATIC,
      }),
    );
    previousPhaseKey = phase.phaseKey;
  }
  events.push(
    frozen({
      kind: 'doorsOpened',
      key: 'doorsOpened',
      generatesOutgoing: profile.steps.some((step) => step.kind === 'generateOutgoingBatch'),
      trigger: DOORS_PREDICATE,
    }),
  );
  return frozen({
    profileKey: options.lifecycleProfileKey,
    activeEncounterSlotKeys: frozen(activeSlots.map((slot) => slot.key)),
    phases: frozen(ordered.map((slot) => slot.phase)),
    events: frozen(events),
  });
}

/** Whether an event belongs to the phases and wheels kept. */
function eventActive(
  event: RoomEvent,
  active: ReadonlySet<string>,
  activeWheelKeys: ReadonlySet<string>,
): boolean {
  switch (event.kind) {
    case 'encounterBegun':
    case 'encounterStarted':
    case 'bossDefeated':
    case 'encounterEnd':
      return active.has(event.phaseKey);
    case 'wheelsOpen':
      return activeWheelKeys.has(event.wheelKey);
    case 'roomEntered':
    case 'doorsOpened':
      return true;
  }
}

/** Restrict one graph to an engine-assessed active phase prefix. */
export function scopeRoomEventGraph(
  graph: RoomEventGraph,
  activePhaseKeys: readonly string[],
): RoomEventGraph {
  const active = new Set(activePhaseKeys);
  const phases = graph.phases.filter((phase) => active.has(phase.phaseKey));
  const activeWheelKeys = new Set(
    phases.flatMap((phase) => (phase.rewardWheelKey === undefined ? [] : [phase.rewardWheelKey])),
  );
  const events = graph.events.filter((event) => eventActive(event, active, activeWheelKeys));
  if (
    phases.length === graph.phases.length &&
    events.length === graph.events.length &&
    graph.activeEncounterSlotKeys.every((key) => active.has(key))
  ) {
    return graph;
  }
  return frozen({
    profileKey: graph.profileKey,
    activeEncounterSlotKeys: frozen(graph.activeEncounterSlotKeys.filter((key) => active.has(key))),
    phases: frozen(phases),
    events: frozen(events),
  });
}

/** Whether a scoped phase prefix keeps this event. */
export function roomEventActive(graph: RoomEventGraph, event: RoomEvent): boolean {
  const active = new Set(graph.activeEncounterSlotKeys);
  const activeWheelKeys = new Set(
    graph.phases.flatMap((phase) =>
      phase.rewardWheelKey === undefined ? [] : [phase.rewardWheelKey],
    ),
  );
  return eventActive(event, active, activeWheelKeys);
}

type AnchorPoint =
  | { readonly kind: 'roomEntered' }
  | { readonly kind: 'wheelsOpen'; readonly wheelKey: string }
  | { readonly kind: 'wheelChoice'; readonly wheelKey: string }
  | { readonly kind: 'combat'; readonly phaseKey: string }
  | { readonly kind: 'bossDefeated'; readonly phaseKey: string }
  | { readonly kind: 'encounterEnd'; readonly phaseKey: string }
  | { readonly kind: 'outgoing' }
  | { readonly kind: 'exit' };

/**
 * The points a window is anchored to. A phase's wheels opened by an earlier
 * phase rank before the wheel's choice, which waits on the pickups that phase
 * spawned; a first phase's wheels open with its combat's anchor.
 */
function anchorPoints(graph: RoomEventGraph): readonly AnchorPoint[] {
  const points: AnchorPoint[] = [{ kind: 'roomEntered' }];
  graph.phases.forEach((phase, index) => {
    if (phase.rewardWheelKey !== undefined && index > 0)
      points.push(
        { kind: 'wheelsOpen', wheelKey: phase.rewardWheelKey },
        { kind: 'wheelChoice', wheelKey: phase.rewardWheelKey },
      );
    points.push({ kind: 'combat', phaseKey: phase.phaseKey });
    if (graph.events.some((event) => event.key === `bossDefeated:${phase.phaseKey}`))
      points.push({ kind: 'bossDefeated', phaseKey: phase.phaseKey });
    points.push({ kind: 'encounterEnd', phaseKey: phase.phaseKey });
  });
  if (graph.events.some((event) => event.kind === 'doorsOpened' && event.generatesOutgoing))
    points.push({ kind: 'outgoing' });
  points.push({ kind: 'exit' });
  return points;
}

const anchorCache = new WeakMap<RoomEventGraph, readonly AnchorPoint[]>();

/**
 * A comparable position for a window's lower bound in the room's graph. Only
 * the order of anchors within one graph is meaningful.
 */
export function windowAnchor(window: RoomActionWindow, graph: RoomEventGraph): number {
  let points = anchorCache.get(graph);
  if (points === undefined) {
    points = anchorPoints(graph);
    anchorCache.set(graph, points);
  }
  const all = points;
  const pointIndex = (predicate: (point: AnchorPoint) => boolean): number => {
    const index = all.findIndex(predicate);
    return index < 0 ? 0 : index;
  };
  const beforePoint = (predicate: (point: AnchorPoint) => boolean): number =>
    pointIndex(predicate) * 2;
  const afterPoint = (predicate: (point: AnchorPoint) => boolean): number =>
    pointIndex(predicate) * 2 + 1;
  const lastAfterPoint = (predicate: (point: AnchorPoint) => boolean): number => {
    const index = all.reduce(
      (last, point, candidateIndex) => (predicate(point) ? candidateIndex : last),
      -1,
    );
    return (index < 0 ? 0 : index) * 2 + 1;
  };
  const phaseWithWheel = (phaseKey: string, wheelKey: string) =>
    graph.phases.some((phase) => phase.phaseKey === phaseKey && phase.rewardWheelKey === wheelKey);
  switch (window.kind) {
    case 'standard':
      return window.phase === 'beforeCombat'
        ? beforePoint((point) => point.kind === 'combat')
        : lastAfterPoint((point) => point.kind === 'encounterEnd');
    case 'encounterEnd': {
      // A wheel phase's end-effect pickups follow the next wheels opening, or, after
      // the final phase, its wheel reward.
      const phaseIndex = graph.phases.findIndex((phase) => phase.phaseKey === window.phaseKey);
      const nextWheelKey = graph.phases[phaseIndex + 1]?.rewardWheelKey;
      if (
        phaseIndex >= 0 &&
        nextWheelKey !== undefined &&
        all.some((point) => point.kind === 'wheelsOpen' && point.wheelKey === nextWheelKey)
      )
        return afterPoint(
          (point) => point.kind === 'wheelsOpen' && point.wheelKey === nextWheelKey,
        );
      return (
        afterPoint((point) => point.kind === 'encounterEnd' && point.phaseKey === window.phaseKey) +
        (graph.phases.some(
          (phase) => phase.phaseKey === window.phaseKey && phase.rewardWheelKey !== undefined,
        )
          ? 1
          : 0)
      );
    }
    case 'fields':
      return 1;
    case 'shipPreCombat':
      return all.some((point) => point.kind === 'wheelChoice' && point.wheelKey === window.wheelKey)
        ? afterPoint((point) => point.kind === 'wheelChoice' && point.wheelKey === window.wheelKey)
        : beforePoint(
            (point) => point.kind === 'combat' && phaseWithWheel(point.phaseKey, window.wheelKey),
          );
    case 'shipWheelsOpen':
      return all.some((point) => point.kind === 'wheelsOpen' && point.wheelKey === window.wheelKey)
        ? afterPoint((point) => point.kind === 'wheelsOpen' && point.wheelKey === window.wheelKey)
        : windowAnchor({ kind: 'shipPreCombat', wheelKey: window.wheelKey }, graph);
    case 'shipPostCombat':
      return afterPoint(
        (point) => point.kind === 'encounterEnd' && phaseWithWheel(point.phaseKey, window.wheelKey),
      );
    case 'postOutgoing':
      // Without outgoing generation, exits unlock after the room's required work.
      return all.some((point) => point.kind === 'outgoing')
        ? afterPoint((point) => point.kind === 'outgoing')
        : beforePoint((point) => point.kind === 'exit');
  }
}

/**
 * Whether the window names a phase or wheel this room's graph has; a
 * retained placement at a phase the room no longer plays names none.
 */
export function roomActionWindowResolves(graph: RoomEventGraph, window: RoomActionWindow): boolean {
  switch (window.kind) {
    case 'encounterEnd':
      return graph.phases.some((phase) => phase.phaseKey === window.phaseKey);
    case 'shipPreCombat':
    case 'shipWheelsOpen':
    case 'shipPostCombat':
      return graph.phases.some((phase) => phase.rewardWheelKey === window.wheelKey);
    case 'standard':
    case 'fields':
    case 'postOutgoing':
      return true;
  }
}
