import type { BiomeLayout, Catalog, RoomDeclaration, RoomExit } from '../../catalog-schema';
import type {
  BiomeTopology,
  ExitDecision,
  ExitDecisionSource,
  ExitTargetReference,
  LinkedNormalExit,
  OccurrenceId,
} from '../model';

/**
 * One declaration-owned physical exit resolved for an authored decision
 * source. The semantic kind keeps linked and completed-Hub endpoints from
 * being flattened into ordinary batch doors by application projections.
 */
export interface DeclaredPhysicalExit {
  readonly compatibilityPolicyKey: string;
  readonly exitKey: string;
  readonly index: number;
  readonly kind: 'normal' | 'linked' | 'completedHub';
  readonly type: string;
}

function physicalExit(
  kind: DeclaredPhysicalExit['kind'],
  exitKey: string,
  exit: RoomExit,
): DeclaredPhysicalExit {
  return Object.freeze({
    compatibilityPolicyKey: exit.compatibilityPolicyKey,
    exitKey,
    index: exit.index,
    kind,
    type: exit.type,
  });
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
  if (source.kind === 'hubDecision') {
    if (layout.progression.kind !== 'hub' || source.decisionKey !== layout.progression.hubKey) {
      return undefined;
    }
    const completed = layout.progression.completedExit;
    return Object.freeze([physicalExit('completedHub', completed.exitKey, completed.physicalExit)]);
  }
  const occurrence = topology.occurrences.find(
    (candidate) => candidate.occurrenceId === source.occurrenceId,
  );
  const room = occurrence === undefined ? undefined : catalog.rooms.byKey[occurrence.gameName];
  if (room === undefined || room.biomeKey !== layout.biomeKey || room.mode.kind !== 'authored') {
    return undefined;
  }
  if (layout.progression.kind === 'hub') {
    if (source.occurrenceId !== topology.startOccurrenceId) return Object.freeze([]);
    const sourceExit = room.exits[0];
    if (room.exits.length !== 1 || sourceExit === undefined) return undefined;
    return Object.freeze([
      physicalExit('linked', layout.progression.linkedExit.exitKey, sourceExit),
    ]);
  }
  return Object.freeze(room.exits.map((exit) => physicalExit('normal', `exit${exit.index}`, exit)));
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

function sameSource(left: ExitDecisionSource, right: ExitDecisionSource): boolean {
  return left.kind === 'occurrence' && right.kind === 'occurrence'
    ? left.occurrenceId === right.occurrenceId
    : left.kind === 'hubDecision' &&
        right.kind === 'hubDecision' &&
        left.decisionKey === right.decisionKey;
}

/** Returns the optional authored exit decision owned by one exact source. */
export function exitDecisionForSource(
  topology: BiomeTopology,
  source: ExitDecisionSource,
): ExitDecision | undefined {
  return topology.decisions.find(
    (decision): decision is ExitDecision =>
      decision.kind === 'exit' && sameSource(decision.source, source),
  );
}

/** Resolves the selected physical exit key without repairing incomplete state. */
export function selectedExitKey(decision: ExitDecision): string | undefined {
  if (decision.normal.kind === 'linked') return decision.normal.exitKey;
  if (decision.selection.kind === 'derived') return decision.normal.targets[0]?.exitKey;
  return decision.selection.kind === 'normal' ? decision.selection.exitKey : undefined;
}

/** Resolves the selected authored target without repairing incomplete state. */
export function selectedExitTarget(
  decision: ExitDecision,
): LinkedNormalExit | ExitTargetReference | undefined {
  if (decision.normal.kind === 'linked') return decision.normal;
  const selected = selectedExitKey(decision);
  return decision.normal.targets.find((target) => target.exitKey === selected);
}

/**
 * Decision-array order is serialization detail. Generated staged progression
 * instead advances through the selected ordinary-batch spine from the start.
 */
export function selectedOrdinaryBatchIndex(
  topology: BiomeTopology,
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
    const target = selectedExitTarget(decision);
    if (target === undefined) return undefined;
    if (decision.normal.kind === 'batch') batchIndex += 1;
    currentOccurrenceId = target.occurrenceId;
  }
  return undefined;
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
      room.biomeKey === layout.biomeKey && room.prebossBatchPolicy?.kind === 'takeOverNormalDoors',
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
 * completed Hub handoff has already established its six-visit prerequisite
 * structurally and therefore creates its one fixed target directly.
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
    if (layout.progression.kind !== 'hub' || source.decisionKey !== layout.progression.hubKey) {
      return undefined;
    }
    const room = catalog.rooms.byKey[layout.progression.completedExit.roomGameName];
    return room === undefined
      ? undefined
      : Object.freeze({ kind: 'completedHubHandoff' as const, room });
  }
  const room = fixedWidthOneTakeoverForSource(catalog, layout, topology, source);
  return room === undefined
    ? undefined
    : Object.freeze({ kind: 'fixedWidthOneTakeover' as const, room });
}
