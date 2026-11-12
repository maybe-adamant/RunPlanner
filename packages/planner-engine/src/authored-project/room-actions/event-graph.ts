import {
  isCombatBearingEncounterPhaseKind,
  type Catalog,
  type EncounterDefinition,
  type EncounterEnvelope,
  type EncounterScript,
  type RoomDeclaration,
} from '../../catalog-schema';
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
  /** The phase's encounter script, when its encounter is known. */
  readonly script?: EncounterScript;
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
            script: directDefinition.script,
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
          ...((directDefinition ?? candidates[0]) === undefined
            ? {}
            : { script: (directDefinition ?? candidates[0])!.script }),
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
              byKey.get(reference.phaseKey)?.phase.script?.endsByInteraction === true)) &&
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
    if (phase.script?.endsByInteraction === true) {
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
    // The gate uses the room reward's pickup at the producer point its role is taken at.
    const gatePoints =
      gate.kind !== 'useItemRole' || !options.producer || profile.producer.kind === 'none'
        ? []
        : [
            ...new Set(
              profile.producer.lifecycleProfileKeys.flatMap((key) =>
                (
                  options.catalog.rewards.producerLifecycles.byKey[key]?.rewardTypes.values ?? []
                ).flatMap((reward) =>
                  reward.acquisitionLifecycle.flatMap((binding) =>
                    binding.role === gate.role ? [binding.lifecyclePoint] : [],
                  ),
                ),
              ),
            ),
          ];
    if (gatePoints.length > 1)
      throw new Error(
        `${options.occurrence.gameName} gate role ${gate.kind === 'useItemRole' ? gate.role : ''} has no single ${profile.key} producer point`,
      );
    const gatePoint = gatePoints[0];
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

/** Whether the player's verb starts the phase's encounter wherever its row stands (a Fields cage). */
function verbActivated(graph: RoomEventGraph, phaseKey: string): boolean {
  return graph.events.some(
    (event) =>
      event.kind === 'encounterBegun' &&
      event.phaseKey === phaseKey &&
      event.trigger.kind === 'action',
  );
}

/**
 * Where each bound point stands in the room's graph, as a comparable place;
 * only the order of places within one graph is meaningful. Points that
 * happen together share a place: a phase's end effects apply at its end
 * unless its script waits for the room to be ready, and the next phase's
 * wheels open with them. A room whose encounters the player starts (Fields
 * cages) gives its phases no fixed place: they happen where their rows stand,
 * so every phase point stands with room entry. A point the room does not
 * play stands at room entry, a gate or wheel at the very start.
 */
export function roomEventPlaces(graph: RoomEventGraph): (point: RoomEventPoint) => number {
  // Each graph point takes a before and an after place, in graph order.
  const order: string[] = ['roomEntered'];
  graph.phases.forEach((phase, index) => {
    if (phase.rewardWheelKey !== undefined && index > 0)
      order.push(`wheelsOpen:${phase.rewardWheelKey}`, `gate:${phase.phaseKey}`);
    order.push(`encounterStarted:${phase.phaseKey}`);
    if (graph.events.some((event) => event.key === `bossDefeated:${phase.phaseKey}`))
      order.push(`bossDefeated:${phase.phaseKey}`);
    order.push(`encounterEnd:${phase.phaseKey}`);
  });
  if (graph.events.some((event) => event.kind === 'doorsOpened' && event.generatesOutgoing))
    order.push('doorsOpened');
  order.push('leave');
  const index = new Map(order.map((key, position) => [key, position]));
  const before = (key: string) => (index.get(key) ?? 0) * 2;
  const after = (key: string) => (index.get(key) ?? 0) * 2 + 1;
  const free = graph.phases.some((phase) => verbActivated(graph, phase.phaseKey));
  const phaseIndex = (phaseKey: string) =>
    graph.phases.findIndex((phase) => phase.phaseKey === phaseKey);
  const wheelPhase = (wheelKey: string) =>
    graph.phases.findIndex((phase) => phase.rewardWheelKey === wheelKey);
  const place = (point: RoomEventPoint): number => {
    switch (point.kind) {
      case 'roomEntered':
        return 1;
      case 'wheelsOpen': {
        const at = wheelPhase(point.wheelKey);
        if (at < 0) return 0;
        return at > 0
          ? after(`wheelsOpen:${point.wheelKey}`)
          : before(`encounterStarted:${graph.phases[at]!.phaseKey}`);
      }
      case 'gate': {
        if (free) return 1;
        const at = phaseIndex(point.phaseKey);
        if (at < 0) return 0;
        return index.has(`gate:${point.phaseKey}`)
          ? after(`gate:${point.phaseKey}`)
          : before(`encounterStarted:${point.phaseKey}`);
      }
      case 'encounterStarted':
        return free || phaseIndex(point.phaseKey) < 0
          ? 1
          : after(`encounterStarted:${point.phaseKey}`);
      case 'encounterEnd':
        return free || phaseIndex(point.phaseKey) < 0 ? 1 : after(`encounterEnd:${point.phaseKey}`);
      case 'endEffects': {
        const at = phaseIndex(point.phaseKey);
        if (free || at < 0) return 1;
        const next = nextWheelsOpen(graph, point.phaseKey);
        if (next !== undefined) return after(`wheelsOpen:${next.wheelKey}`);
        return (
          after(`encounterEnd:${point.phaseKey}`) +
          (graph.phases[at]!.script?.waitReadyBeforeEnd === true ? 1 : 0)
        );
      }
      case 'doorsOpened':
      case 'exitsReady':
        return index.has('doorsOpened') ? after('doorsOpened') : before('leave');
      case 'leave':
        return after('leave');
    }
  };
  return place;
}

/** Whether the room plays the phase or wheel a point names. */
export function roomEventPointResolves(graph: RoomEventGraph, point: RoomEventPoint): boolean {
  switch (point.kind) {
    case 'wheelsOpen':
      return graph.phases.some((phase) => phase.rewardWheelKey === point.wheelKey);
    case 'gate':
    case 'encounterStarted':
    case 'encounterEnd':
    case 'endEffects':
      return graph.phases.some((phase) => phase.phaseKey === point.phaseKey);
    case 'roomEntered':
    case 'doorsOpened':
    case 'exitsReady':
    case 'leave':
      return true;
  }
}

/** The end of the room's last fight, or its entry when it has none. */
export function roomFightsEnd(graph: RoomEventGraph): RoomEventPoint {
  const last = graph.phases.at(-1)?.phaseKey;
  return last === undefined
    ? frozen({ kind: 'roomEntered' as const })
    : frozen({ kind: 'encounterEnd' as const, phaseKey: last });
}

/** The bound a row opens at: its enabler when it has one, otherwise its spawn. */
export function roomActionOpeningPoint(bounds: RoomActionBounds): RoomEventPoint {
  return bounds.enabler ?? bounds.spawn;
}

/**
 * The wheels that open with this phase's end effects, when a next Ship phase
 * opens any: what those effects spawn waits for that wheel's choice.
 */
export function nextWheelsOpen(
  graph: RoomEventGraph,
  phaseKey: string,
): Extract<RoomEvent, { readonly kind: 'wheelsOpen' }> | undefined {
  return graph.events.find(
    (event): event is Extract<RoomEvent, { readonly kind: 'wheelsOpen' }> =>
      event.kind === 'wheelsOpen' && event.afterPhaseKey === phaseKey,
  );
}

/** The phase whose wheels open with this phase's end effects, when one does. */
export function nextWheelPhaseKey(graph: RoomEventGraph, phaseKey: string): string | undefined {
  return nextWheelsOpen(graph, phaseKey)?.phaseKey;
}
