import type {
  BiomeLayout,
  Catalog,
  HubDecisionDescriptor,
  NormalDecisionProgressionDescriptor,
  RoomDeclaration,
  RoomExit,
} from '../../catalog-schema';
import type { TargetAddress } from '../addresses';
import { createInitialExitDecision } from '../batchState';
import type {
  AuthoredAdditionalExit,
  BiomeTopology,
  ExitDecision,
  ExitDecisionSource,
  ExitTargetReference,
  HubDecision,
  OccurrenceId,
  RoomOccurrence,
} from '../model';

/** The selected spine resolves occurrence-owned additional continuations. */
type AdditionalExitTopology = {
  readonly occurrences: readonly Pick<RoomOccurrence, 'occurrenceId' | 'additionalExits'>[];
};

export type SelectedSpineTopology = Pick<BiomeTopology, 'startOccurrenceId' | 'decisions'> &
  Partial<AdditionalExitTopology>;

/**
 * Static command eligibility for one authored ordinary normal-door target.
 *
 * This deliberately does not inspect simulation coverage, requirements, or
 * candidate availability. It answers only whether the persisted topology and
 * declarations can accept `CreateTarget`; an incomplete retained prefix can
 * therefore remain authorable even when it has no evaluated candidate result.
 */
export type OrdinaryTargetAuthoringEligibility =
  | { readonly kind: 'authorable'; readonly room: RoomDeclaration }
  | {
      readonly kind: 'unavailable';
      readonly stageKey?: string;
      readonly reason:
        | 'batchBound'
        | 'duplicateRetainPeer'
        | 'missingBatch'
        | 'notGenerated'
        | 'notOrdinaryRoom'
        | 'sourceIsHub'
        | 'stage'
        | 'targetAlreadyAuthored'
        | 'targetBound'
        | 'targetIsNotDeclared'
        | 'takeoverBatch'
        | 'takeoverRoom'
        | 'unknownOrNonHostRoom';
    };

/** The authored ordinary-batch capacity before a new empty envelope is added. */
export type OrdinaryBatchCreationEligibility =
  | { readonly kind: 'withinOrdinaryBatchLimit' }
  | { readonly kind: 'ordinaryBatchLimitReached' }
  | { readonly kind: 'notGenerated' };

/**
 * One declaration-owned physical exit resolved for an authored decision
 * source. The semantic kind keeps linked and completed-Hub endpoints from
 * being flattened into ordinary batch doors by application projections.
 */
export interface DeclaredPhysicalExit {
  readonly behavior: RoomExit['behavior'];
  readonly compatibilityPolicyKey: string;
  readonly exitKey: string;
  readonly index: number;
  readonly kind: 'normal' | 'completedHub';
  readonly type: string;
}

/**
 * Resolves the one shared normal-decision policy supplied by a layout. Hub
 * layouts carry a bounded entry policy; they do not create a second broad
 * normal-progression family for every consumer to special-case.
 */
export function normalDecisionProgressionForLayout(
  layout: BiomeLayout,
): NormalDecisionProgressionDescriptor | undefined {
  return layout.progression.kind === 'generated'
    ? layout.progression
    : layout.progression.kind === 'hub'
      ? layout.progression.entry
      : undefined;
}

function physicalExit(
  kind: DeclaredPhysicalExit['kind'],
  exitKey: string,
  exit: RoomExit,
): DeclaredPhysicalExit {
  return Object.freeze({
    behavior: exit.behavior,
    compatibilityPolicyKey: exit.compatibilityPolicyKey,
    exitKey,
    index: exit.index,
    kind,
    type: exit.type,
  });
}

/**
 * Closed detour rooms own one declaration-defined host continuation. Anomaly
 * and the Zagreus contract return automatically; Chaos returns through its
 * visible ordinary door. This deliberately recognizes only the closed
 * authored templates, not every declaration with a similar exit behavior.
 */
export function hostContinuationExitForDetourRoom(
  room: RoomDeclaration,
): DeclaredPhysicalExit | undefined {
  if (
    room.mode.kind !== 'authored' ||
    (room.mode.templateKey !== 'Anomaly' &&
      room.mode.templateKey !== 'ContractBoss' &&
      room.mode.templateKey !== 'Chaos')
  ) {
    return undefined;
  }
  const exit = room.exits[0];
  if (
    room.exits.length !== 1 ||
    exit === undefined ||
    exit.index !== 1 ||
    (room.mode.templateKey === 'Chaos'
      ? exit.behavior.kind !== 'playerSelected' || exit.behavior.rewardPreview !== 'visible'
      : exit.behavior.kind !== 'automaticHostContinuation')
  ) {
    return undefined;
  }
  return physicalExit('normal', 'exit1', exit);
}

/**
 * Resolves declared physical exits from a source room already known by the
 * caller. The codec uses this without reconstructing an N-specific key from
 * raw topology; the topology wrapper below performs the room lookup for
 * command and projection callers.
 */
export function declaredPhysicalExitsForSourceRoom(
  layout: BiomeLayout,
  startOccurrenceId: OccurrenceId,
  source: ExitDecisionSource,
  sourceRoom: RoomDeclaration | undefined,
): readonly DeclaredPhysicalExit[] | undefined {
  if (source.kind === 'hubDecision') {
    if (layout.progression.kind !== 'hub' || source.decisionKey !== layout.progression.hubKey) {
      return undefined;
    }
    const completed = layout.progression.completedExit;
    return Object.freeze([physicalExit('completedHub', completed.exitKey, completed.physicalExit)]);
  }
  if (sourceRoom === undefined) return undefined;
  if (sourceRoom.roomSetKey !== layout.biomeKey) {
    const continuation = hostContinuationExitForDetourRoom(sourceRoom);
    return continuation === undefined ? undefined : Object.freeze([continuation]);
  }
  if (layout.progression.kind === 'hub') {
    // The current bounded Hub data has one normal entry decision. Every later
    // occurrence source is the declaration-owned terminal envelope, which has
    // no ordinary physical target. Eligibility is evaluated separately.
    if (source.occurrenceId !== startOccurrenceId) return Object.freeze([]);
    const sourceExit = sourceRoom.exits[0];
    if (sourceRoom.exits.length !== 1 || sourceExit === undefined) return undefined;
    return Object.freeze([physicalExit('normal', layout.progression.entry.exitKey, sourceExit)]);
  }
  return Object.freeze(
    sourceRoom.exits.map((exit) => physicalExit('normal', `exit${exit.index}`, exit)),
  );
}

/**
 * Resolves ordered, declaration-owned physical exits for one structural
 * source. This is shared by commands and projections so neither needs to
 * reconstruct linked or completed-Hub physical metadata from layout pieces.
 */
export function declaredPhysicalExits(
  catalog: Catalog,
  layout: BiomeLayout,
  topology: BiomeTopology,
  source: ExitDecisionSource,
): readonly DeclaredPhysicalExit[] | undefined {
  const occurrence =
    source.kind === 'occurrence'
      ? topology.occurrences.find((candidate) => candidate.occurrenceId === source.occurrenceId)
      : undefined;
  const room = occurrence === undefined ? undefined : catalog.rooms.byKey[occurrence.gameName];
  if (room !== undefined && room.mode.kind !== 'authored') return undefined;
  return declaredPhysicalExitsForSourceRoom(layout, topology.startOccurrenceId, source, room);
}

/**
 * Resolves the declaration-owned physical exits for one structural source.
 * Command execution and application interaction adapters share this authority
 * so a capacity repair never has to infer exit width from rendered targets.
 */
export function declaredPhysicalExitKeys(
  catalog: Catalog,
  layout: BiomeLayout,
  topology: BiomeTopology,
  source: ExitDecisionSource,
): readonly string[] | undefined {
  const exits = declaredPhysicalExits(catalog, layout, topology, source);
  return exits === undefined ? undefined : Object.freeze(exits.map((exit) => exit.exitKey));
}

/**
 * A generated source replacement can retain an already-authored target whose
 * current source declaration no longer exposes that physical door. The codec
 * and materializer share this biome-local structural vocabulary so they can
 * preserve only declaration-owned normal `exitN` keys while rejecting an
 * invented persisted key. Bounded Hub exits deliberately do not participate.
 */
export function possibleGeneratedNormalExitKeys(
  catalog: Catalog,
  layout: BiomeLayout,
): readonly string[] {
  if (layout.progression.kind !== 'generated') return Object.freeze([]);
  return Object.freeze([
    ...new Set(
      Object.values(catalog.rooms.byKey)
        .filter((room) => room.roomSetKey === layout.biomeKey && room.mode.kind === 'authored')
        .flatMap((room) => room.exits.map((exit) => `exit${exit.index}`)),
    ),
  ]);
}

function batchTakesOverNormalDoors(
  catalog: Catalog,
  topology: BiomeTopology,
  decision: ExitDecision,
): boolean {
  return (
    decision.normal.kind === 'batch' &&
    decision.normal.targets.some((target) => {
      const occurrence = topology.occurrences.find(
        (candidate) => candidate.occurrenceId === target.occurrenceId,
      );
      return (
        occurrence !== undefined &&
        catalog.rooms.byKey[occurrence.gameName]?.prebossBatchPolicy?.kind === 'takeOverNormalDoors'
      );
    })
  );
}

function realizedOrdinaryBatchCount(catalog: Catalog, topology: BiomeTopology): number {
  return topology.decisions.filter(
    (decision): decision is ExitDecision =>
      decision.kind === 'exit' &&
      decision.normal.kind === 'batch' &&
      decision.normal.targets.length > 0 &&
      !batchTakesOverNormalDoors(catalog, topology, decision),
  ).length;
}

function realizedOrdinaryTargetCount(catalog: Catalog, topology: BiomeTopology): number {
  return topology.decisions.reduce(
    (count, decision) =>
      decision.kind === 'exit' &&
      decision.normal.kind === 'batch' &&
      !batchTakesOverNormalDoors(catalog, topology, decision)
        ? count + decision.normal.targets.length
        : count,
    0,
  );
}

/**
 * Centralizes the realized ordinary-batch boundary shared by creating an
 * envelope and committing its first ordinary target. A terminal takeover
 * envelope is a caller-owned exception layered over `ordinaryBatchLimitReached`.
 */
export function ordinaryBatchCreationEligibility(
  catalog: Catalog,
  layout: BiomeLayout,
  topology: BiomeTopology,
): OrdinaryBatchCreationEligibility {
  const ordinaryBatchLimit = ordinaryProgressionBatchLimit(layout);
  if (ordinaryBatchLimit === undefined) return Object.freeze({ kind: 'notGenerated' });
  return realizedOrdinaryBatchCount(catalog, topology) >= ordinaryBatchLimit
    ? Object.freeze({ kind: 'ordinaryBatchLimitReached' })
    : Object.freeze({ kind: 'withinOrdinaryBatchLimit' });
}

/**
 * Determines whether an authored room can be created at one exact normal
 * target without relying on evaluated reachability. Commands and editor
 * projections share this policy so a retained or incomplete prefix cannot
 * make a structurally invalid target look authorable, or hide a valid one.
 *
 * Batch reward-store and Fields setup are intentionally outside this query:
 * they are local editable leaves owned by the decision assembly.
 */
export function ordinaryTargetAuthoringEligibility(
  catalog: Catalog,
  layout: BiomeLayout,
  topology: BiomeTopology,
  target: TargetAddress,
  gameName: string,
): OrdinaryTargetAuthoringEligibility {
  const progression = normalDecisionProgressionForLayout(layout);
  if (progression === undefined) {
    return Object.freeze({ kind: 'unavailable', reason: 'notGenerated' });
  }
  if (target.source.kind === 'hubDecision') {
    return Object.freeze({ kind: 'unavailable', reason: 'sourceIsHub' });
  }
  const decision = exitDecisionForSource(topology, target.source);
  if (decision?.normal.kind !== 'batch') {
    return Object.freeze({ kind: 'unavailable', reason: 'missingBatch' });
  }
  if (decision.source.kind !== 'occurrence') {
    return Object.freeze({ kind: 'unavailable', reason: 'sourceIsHub' });
  }
  if (batchTakesOverNormalDoors(catalog, topology, decision)) {
    return Object.freeze({ kind: 'unavailable', reason: 'takeoverBatch' });
  }
  const exits = declaredPhysicalExits(catalog, layout, topology, target.source);
  if (!exits?.some((exit) => exit.kind === 'normal' && exit.exitKey === target.exitKey)) {
    return Object.freeze({ kind: 'unavailable', reason: 'targetIsNotDeclared' });
  }
  if (decision.normal.targets.some((candidate) => candidate.exitKey === target.exitKey)) {
    return Object.freeze({ kind: 'unavailable', reason: 'targetAlreadyAuthored' });
  }
  const room = catalog.rooms.byKey[gameName];
  if (room === undefined || room.roomSetKey !== layout.biomeKey || room.mode.kind !== 'authored') {
    return Object.freeze({ kind: 'unavailable', reason: 'unknownOrNonHostRoom' });
  }
  if (
    room.kind === 'Boss' ||
    room.kind === 'Intro' ||
    room.kind === 'Opening' ||
    room.kind === 'PostBoss'
  ) {
    return Object.freeze({ kind: 'unavailable', reason: 'notOrdinaryRoom' });
  }
  if (room.prebossBatchPolicy?.kind === 'takeOverNormalDoors') {
    return Object.freeze({ kind: 'unavailable', reason: 'takeoverRoom' });
  }
  if (
    room.prebossBatchPolicy?.kind === 'retainNormalPeers' &&
    decision.normal.targets.some(
      (candidate) =>
        topology.occurrences.find(
          (occurrence) => occurrence.occurrenceId === candidate.occurrenceId,
        )?.gameName === room.gameName,
    )
  ) {
    return Object.freeze({ kind: 'unavailable', reason: 'duplicateRetainPeer' });
  }
  const batchEligibility = ordinaryBatchCreationEligibility(catalog, layout, topology);
  if (
    batchEligibility.kind !== 'withinOrdinaryBatchLimit' &&
    decision.normal.targets.length === 0
  ) {
    return Object.freeze({ kind: 'unavailable', reason: 'batchBound' });
  }
  if (realizedOrdinaryTargetCount(catalog, topology) >= progression.bounds.maxTargets) {
    return Object.freeze({ kind: 'unavailable', reason: 'targetBound' });
  }
  if (progression.progressionPolicy.kind === 'staged') {
    const batchIndex = selectedOrdinaryBatchIndex(topology, decision.source.occurrenceId);
    const stage =
      batchIndex === undefined ? undefined : progression.progressionPolicy.stages[batchIndex];
    if (stage === undefined || !stage.roomGameNames.includes(room.gameName)) {
      return Object.freeze({ kind: 'unavailable', reason: 'stage', stageKey: stage?.key ?? '?' });
    }
  }
  // PreHub is not a generic ordinary room. The catalog compiler permits it
  // only in the bounded Hub entry stage; keeping the check here defends the
  // command boundary if a future declaration accidentally weakens that
  // compiler contract.
  if (room.kind === 'PreHub' && layout.progression.kind !== 'hub') {
    return Object.freeze({ kind: 'unavailable', reason: 'notOrdinaryRoom' });
  }
  return Object.freeze({ kind: 'authorable', room });
}

/**
 * Evaluates the first ordinary target at a visible, uncommitted outgoing
 * frontier. The engine constructs and appends its own exact initial envelope
 * for the query; application projections never fabricate topology in order to
 * ask whether the atomic `InitializeExitDecision` target edit can succeed.
 */
export function uncommittedOrdinaryTargetAuthoringEligibility(
  catalog: Catalog,
  layout: BiomeLayout,
  topology: BiomeTopology,
  target: TargetAddress,
  gameName: string,
): OrdinaryTargetAuthoringEligibility {
  const progression = normalDecisionProgressionForLayout(layout);
  if (progression === undefined) {
    return Object.freeze({ kind: 'unavailable', reason: 'notGenerated' });
  }
  if (target.source.kind === 'hubDecision') {
    return Object.freeze({ kind: 'unavailable', reason: 'sourceIsHub' });
  }
  const source = target.source;
  if (exitDecisionForSource(topology, target.source) !== undefined) {
    return ordinaryTargetAuthoringEligibility(catalog, layout, topology, target, gameName);
  }
  const occurrence = topology.occurrences.find(
    (candidate) => candidate.occurrenceId === source.occurrenceId,
  );
  const sourceRoom =
    occurrence === undefined ? undefined : catalog.rooms.byKey[occurrence.gameName];
  if (sourceRoom === undefined || sourceRoom.mode.kind !== 'authored') {
    return Object.freeze({ kind: 'unavailable', reason: 'unknownOrNonHostRoom' });
  }
  const decision = createInitialExitDecision(progression, source, sourceRoom.mode.templateKey);
  const provisionalTopology = Object.freeze({
    ...topology,
    decisions: Object.freeze([...topology.decisions, decision]),
  });
  return ordinaryTargetAuthoringEligibility(catalog, layout, provisionalTopology, target, gameName);
}

function sameSource(left: ExitDecisionSource, right: ExitDecisionSource): boolean {
  return left.kind === 'occurrence' && right.kind === 'occurrence'
    ? left.occurrenceId === right.occurrenceId
    : left.kind === 'hubDecision' &&
        right.kind === 'hubDecision' &&
        left.decisionKey === right.decisionKey;
}

/** Returns the optional authored exit decision owned by one exact source. */
export function exitDecisionForSource(
  topology: Pick<BiomeTopology, 'decisions'>,
  source: ExitDecisionSource,
): ExitDecision | undefined {
  return topology.decisions.find(
    (decision): decision is ExitDecision =>
      decision.kind === 'exit' && sameSource(decision.source, source),
  );
}

/** Resolves the selected physical exit key without repairing incomplete state. */
export function selectedExitKey(decision: ExitDecision): string | undefined {
  if (decision.selection.kind === 'derived') return decision.normal.targets[0]?.exitKey;
  return decision.selection.kind === 'normal' ? decision.selection.exitKey : undefined;
}

/** Resolves the selected authored target without repairing incomplete state. */
export function selectedExitTarget(decision: ExitDecision): ExitTargetReference | undefined {
  const selected = selectedExitKey(decision);
  return decision.normal.targets.find((target) => target.exitKey === selected);
}

/** Resolves an explicitly selected sibling continuation without normalizing it. */
export function additionalExitsForDecision(
  topology: AdditionalExitTopology,
  decision: ExitDecision,
): readonly AuthoredAdditionalExit[] {
  if (decision.source.kind !== 'occurrence') return Object.freeze([]);
  const sourceOccurrenceId = decision.source.occurrenceId;
  return (
    topology.occurrences.find((occurrence) => occurrence.occurrenceId === sourceOccurrenceId)
      ?.additionalExits ?? Object.freeze([])
  );
}

export function selectedAdditionalExit(
  decision: ExitDecision,
  additionalExits: readonly AuthoredAdditionalExit[] = Object.freeze([]),
): AuthoredAdditionalExit | undefined {
  const selection = decision.selection;
  if (selection.kind !== 'additional') return undefined;
  return additionalExits.find((exit) => exit.key === selection.additionalExitKey);
}

export type SelectedExitContinuation =
  | { readonly kind: 'normal'; readonly target: ExitTargetReference }
  | { readonly kind: 'additional'; readonly exit: AuthoredAdditionalExit };

/**
 * Resolves the selected topology edge across both normal and closed
 * additional continuations. Consumers that specifically need a normal door
 * should keep using `selectedExitTarget`.
 */
export function selectedExitContinuation(
  decision: ExitDecision,
  additionalExits: readonly AuthoredAdditionalExit[] = Object.freeze([]),
): SelectedExitContinuation | undefined {
  const target = selectedExitTarget(decision);
  if (target !== undefined) return Object.freeze({ kind: 'normal', target });
  const exit = selectedAdditionalExit(decision, additionalExits);
  return exit === undefined ? undefined : Object.freeze({ kind: 'additional', exit });
}

/**
 * Decision-array order is serialization detail. Generated staged progression
 * instead advances through the selected ordinary-batch spine from the start.
 */
export function selectedOrdinaryBatchIndex(
  topology: SelectedSpineTopology,
  sourceOccurrenceId: OccurrenceId,
): number | undefined {
  let currentOccurrenceId = topology.startOccurrenceId;
  let batchIndex = 0;
  const traversedSources = new Set<OccurrenceId>();
  while (!traversedSources.has(currentOccurrenceId)) {
    traversedSources.add(currentOccurrenceId);
    // A completion frontier has no decision yet, but it still has a stable
    // ordinary-batch ordinal on the selected spine. Checking before lookup
    // keeps staged target validation unchanged while allowing shared command
    // and projection authorities to recognize the declared next stage.
    if (currentOccurrenceId === sourceOccurrenceId) return batchIndex;
    const decision = exitDecisionForSource(topology, {
      kind: 'occurrence',
      occurrenceId: currentOccurrenceId,
    });
    if (decision === undefined) return undefined;
    const additionalExits =
      topology.occurrences === undefined
        ? undefined
        : additionalExitsForDecision({ occurrences: topology.occurrences }, decision);
    const continuation = selectedExitContinuation(decision, additionalExits);
    if (continuation === undefined) return undefined;
    batchIndex += 1;
    currentOccurrenceId =
      continuation.kind === 'normal'
        ? continuation.target.occurrenceId
        : continuation.exit.occurrenceId;
  }
  return undefined;
}

/**
 * Fixed and staged declarations own their terminal ordinary ordinal directly;
 * eligibility-driven layouts use their declared generated capacity.  This is
 * intentionally separate from the persisted zero-target envelope shape.
 */
export function ordinaryProgressionBatchLimit(layout: BiomeLayout): number | undefined {
  const progression = normalDecisionProgressionForLayout(layout);
  if (progression === undefined) return undefined;
  const policy = progression.progressionPolicy;
  if (policy.kind === 'fixedCount') return policy.continuationCount;
  if (policy.kind === 'staged') return policy.stages.length;
  return progression.bounds.maxBatches;
}

export interface HubTerminalTakeoverForSource {
  readonly kind: 'hubTakeover';
  readonly hubKey: string;
  readonly room: RoomDeclaration;
  readonly force: 'required';
}

/**
 * The completed-Hub Preboss handoff is structurally available only after the
 * persisted board satisfies the declaration's open-set bound and visit
 * count.  This deliberately does not inspect reward or generation validity:
 * those findings may remain editable without hiding the Hub-owned handoff.
 */
export type HubDecisionHandoffReadiness =
  | { readonly kind: 'missing' }
  | {
      readonly kind: 'openSetIncomplete';
      readonly actualCount: number;
      readonly minimumCount: number;
      readonly maximumCount: number;
    }
  | {
      readonly kind: 'visitOrderIncomplete';
      readonly actualCount: number;
      readonly requiredCount: number;
    }
  | { readonly kind: 'ready' };

/**
 * One shared structural gate for a bounded Hub's completed-Hub handoff.
 * Commands, materialization, completeness, and candidate evaluation all use
 * this result so an intentionally retained undersized board cannot publish a
 * Preboss transition that its command boundary would reject.
 */
export function hubDecisionHandoffReadiness(
  descriptor: HubDecisionDescriptor,
  decision: HubDecision | undefined,
): HubDecisionHandoffReadiness {
  if (decision === undefined || decision.hubKey !== descriptor.hubKey) {
    return Object.freeze({ kind: 'missing' });
  }
  if (
    decision.openTargets.length < descriptor.openCount.min ||
    decision.openTargets.length > descriptor.openCount.max
  ) {
    return Object.freeze({
      kind: 'openSetIncomplete',
      actualCount: decision.openTargets.length,
      minimumCount: descriptor.openCount.min,
      maximumCount: descriptor.openCount.max,
    });
  }
  if (decision.visitOrder.length !== descriptor.requiredVisits) {
    return Object.freeze({
      kind: 'visitOrderIncomplete',
      actualCount: decision.visitOrder.length,
      requiredCount: descriptor.requiredVisits,
    });
  }
  return Object.freeze({ kind: 'ready' });
}

/**
 * Terminal selection is represented by one exact, no-choice persisted batch
 * envelope. Its shape is shared by Hub replacement, codec closure, and
 * candidate evaluation; callers must still establish the declaration-owned
 * terminal source separately.
 */
export function isExactTerminalTakeoverEnvelope(decision: ExitDecision): boolean {
  return (
    decision.normal.rewardStore.kind === 'none' &&
    decision.normal.batchState === null &&
    decision.normal.targets.length === 0 &&
    decision.selection.kind === 'unresolved'
  );
}

/**
 * Resolves the closed Hub terminal only at the selected-spine ordinal after
 * its bounded normal entry. This is structural authority, not an evaluated
 * requirement result: commands preserve invalid-but-representable authored
 * state while candidate evaluation applies the terminal's depth requirement.
 */
export function hubTerminalTakeoverForSource(
  catalog: Catalog,
  layout: BiomeLayout,
  topology: SelectedSpineTopology,
  source: ExitDecisionSource,
): HubTerminalTakeoverForSource | undefined {
  if (layout.progression.kind !== 'hub' || source.kind !== 'occurrence') return undefined;
  const additionalSource = topology.occurrences
    ?.flatMap((occurrence) => occurrence.additionalExits)
    .find((exit) => exit.occurrenceId === source.occurrenceId);
  if (
    additionalSource !== undefined &&
    additionalSource.kind !== 'naturalChaos' &&
    additionalSource.kind !== 'sparkChaos'
  )
    return undefined;
  const terminalOrdinal = ordinaryProgressionBatchLimit(layout);
  if (
    terminalOrdinal === undefined ||
    selectedOrdinaryBatchIndex(topology, source.occurrenceId) !== terminalOrdinal
  ) {
    return undefined;
  }
  const room = catalog.rooms.byKey[layout.progression.terminal.roomGameName];
  if (room === undefined) return undefined;
  return Object.freeze({
    kind: 'hubTakeover',
    hubKey: layout.progression.hubKey,
    room,
    force: layout.progression.terminal.force,
  });
}

/**
 * A generated decision with no targets is normally just the next uncommitted
 * ordinary batch.  Once the ordinary bound is already realized, the catalog
 * may still admit one such selected-spine envelope so a declaration-owned
 * normal-door takeover Preboss can replace it atomically.  The zero-target
 * shape itself is not a progression unit.
 */
export function admitsTerminalTakeoverEnvelope(
  catalog: Catalog,
  layout: BiomeLayout,
  topology: SelectedSpineTopology,
  source: ExitDecisionSource,
): boolean {
  if (hubTerminalTakeoverForSource(catalog, layout, topology, source) !== undefined) return true;
  if (layout.progression.kind !== 'generated' || source.kind !== 'occurrence') return false;
  const terminalOrdinal = ordinaryProgressionBatchLimit(layout);
  if (
    terminalOrdinal === undefined ||
    selectedOrdinaryBatchIndex(topology, source.occurrenceId) !== terminalOrdinal
  ) {
    return false;
  }
  return catalog.rooms.values.some(
    (room) =>
      room.roomSetKey === layout.biomeKey &&
      room.mode.kind === 'authored' &&
      room.kind === 'Preboss' &&
      room.prebossBatchPolicy?.kind === 'takeOverNormalDoors',
  );
}

/**
 * Returns the fixed width-one takeover required after a bounded generated
 * spine reaches its final ordinary decision. This is derived from normalized
 * progression and Preboss policy; Hub handoff and counted takeovers
 * intentionally do not match.
 */
export function fixedWidthOneTakeoverForLayout(
  catalog: Catalog,
  layout: BiomeLayout,
): RoomDeclaration | undefined {
  if (layout.progression.kind !== 'generated') return undefined;
  const policy = layout.progression.progressionPolicy;
  if (policy.kind !== 'fixedCount' && policy.kind !== 'staged') return undefined;
  const candidates = catalog.rooms.values.filter(
    (room) =>
      room.roomSetKey === layout.biomeKey &&
      room.prebossBatchPolicy?.kind === 'takeOverNormalDoors',
  );
  const [candidate] = candidates;
  const candidatePolicy = candidate?.prebossBatchPolicy;
  return candidates.length === 1 &&
    candidatePolicy?.kind === 'takeOverNormalDoors' &&
    candidatePolicy.remainingOffers.kind === 'none'
    ? candidate
    : undefined;
}

/**
 * Returns the fixed width-one takeover required at a particular source after
 * a bounded generated spine reaches its final ordinary decision. This is
 * derived from normalized progression and Preboss policy; Hub handoff and
 * counted takeovers intentionally do not match.
 */
export function fixedWidthOneTakeoverForSource(
  catalog: Catalog,
  layout: BiomeLayout,
  topology: BiomeTopology,
  source: ExitDecisionSource,
): RoomDeclaration | undefined {
  if (source.kind !== 'occurrence') return undefined;
  const candidate = fixedWidthOneTakeoverForLayout(catalog, layout);
  if (candidate === undefined || layout.progression.kind !== 'generated') return undefined;
  const policy = layout.progression.progressionPolicy;
  const finalOrdinaryBatchCount =
    policy.kind === 'fixedCount'
      ? policy.continuationCount
      : policy.kind === 'staged'
        ? policy.stages.length
        : undefined;
  return finalOrdinaryBatchCount !== undefined &&
    selectedOrdinaryBatchIndex(topology, source.occurrenceId) === finalOrdinaryBatchCount
    ? candidate
    : undefined;
}

/**
 * A fixed width-one takeover is declared by its progression source, not
 * inferred by the application from a room name or a candidate domain. The
 * bounded-spine transition still needs contextual candidate validation; the
 * completed Hub handoff exists only after its declaration-owned board and
 * visit prerequisites are structurally ready, then creates its one fixed
 * target directly.
 */
export type FixedWidthOneTakeoverTransition =
  | { readonly kind: 'completedHubHandoff'; readonly room: RoomDeclaration }
  | { readonly kind: 'fixedWidthOneTakeover'; readonly room: RoomDeclaration };

export function fixedWidthOneTakeoverTransitionForSource(
  catalog: Catalog,
  layout: BiomeLayout,
  topology: BiomeTopology,
  source: ExitDecisionSource,
): FixedWidthOneTakeoverTransition | undefined {
  if (source.kind === 'hubDecision') {
    const progression = layout.progression;
    if (progression.kind !== 'hub' || source.decisionKey !== progression.hubKey) {
      return undefined;
    }
    const hub = topology.decisions.find(
      (decision): decision is HubDecision =>
        decision.kind === 'hub' && decision.hubKey === progression.hubKey,
    );
    if (hubDecisionHandoffReadiness(progression, hub).kind !== 'ready') {
      return undefined;
    }
    const room = catalog.rooms.byKey[progression.completedExit.roomGameName];
    return room === undefined
      ? undefined
      : Object.freeze({ kind: 'completedHubHandoff' as const, room });
  }
  const room = fixedWidthOneTakeoverForSource(catalog, layout, topology, source);
  return room === undefined
    ? undefined
    : Object.freeze({ kind: 'fixedWidthOneTakeover' as const, room });
}
