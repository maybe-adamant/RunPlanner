import { semanticAddressKey } from '../authored-project/addresses';
import type { CanonicalBatch, CanonicalAuthoredRoom } from '../simulation/materialization';
import { assertExactProjectEvaluationAssembly } from '../simulation/project-evaluation-assembly';
import type { CompleteValidBiomeProjectEvaluation } from '../simulation/evaluation-products';
import {
  EXECUTION_PLAN_FORMAT,
  EXECUTION_CATALOG_VERSION,
  EXECUTION_PROTOCOL_VERSION,
  type ExecutionCompilerInput,
  type ExecutionPlan,
  type ExecutionReward,
  type ExecutionRoom,
} from './model';

class CompilerError extends Error {
  readonly code: NonNullable<import('./model').ExecutionCompilerError['code']>;

  constructor(
    code: NonNullable<import('./model').ExecutionCompilerError['code']>,
    message: string,
  ) {
    super(message);
    this.name = 'ExecutionCompilerError';
    this.code = code;
  }
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`);
  return `{${entries.join(',')}}`;
}

function fingerprint(value: unknown): string {
  let hash = 2166136261;
  for (const character of stableJson(value)) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function ownerKey(room: CanonicalAuthoredRoom): string {
  return semanticAddressKey(room.origin);
}

function executionReward(room: CanonicalAuthoredRoom): ExecutionReward | undefined {
  const incoming = room.incomingReward;
  if (incoming === undefined) return undefined;
  const payload = incoming.offer.payload;
  return Object.freeze({
    rewardType: incoming.offer.rewardType,
    producerLifecycleKey: incoming.producerLifecycleKey,
    ...(incoming.resolvedStoreKey === undefined
      ? {}
      : { resolvedStoreKey: incoming.resolvedStoreKey }),
    ...(payload?.kind === 'BoonSource' ? { source: payload.source } : {}),
  });
}

function openingBatch(
  evaluation: CompleteValidBiomeProjectEvaluation,
  room: CanonicalAuthoredRoom,
): CanonicalBatch {
  const batch = evaluation.snapshot.decisions.find(
    (decision): decision is CanonicalBatch =>
      decision.kind === 'batch' &&
      decision.parent.origin.kind === 'occurrence' &&
      decision.parent.origin.occurrenceId === room.occurrenceId,
  );
  if (batch === undefined) {
    throw new CompilerError(
      'openingBatchMissing',
      `opening ${room.gameName} has no outgoing batch`,
    );
  }
  const selectedExitKey = batch.selectedExitKey;
  if (selectedExitKey === null) {
    throw new CompilerError(
      'openingSelectionMissing',
      `opening ${room.gameName} has no selected outgoing exit`,
    );
  }
  const pickedTargets = batch.targets.filter((target) => target.picked);
  if (pickedTargets.length !== 1 || pickedTargets[0]?.exit.exitKey !== selectedExitKey) {
    throw new CompilerError(
      'openingSelectionMissing',
      `opening ${room.gameName} has an inconsistent outgoing selection`,
    );
  }
  return batch;
}

function executionRoom(evaluation: CompleteValidBiomeProjectEvaluation): ExecutionRoom {
  const room = evaluation.snapshot.entryRoom;
  const owner = ownerKey(room);
  const reward = executionReward(room);
  if (reward === undefined) {
    throw new CompilerError(
      'openingRewardMissing',
      `opening ${room.gameName} has no incoming reward`,
    );
  }
  const batch = openingBatch(evaluation, room);
  const selectedExitKey = batch.selectedExitKey;
  if (selectedExitKey === null) {
    throw new CompilerError(
      'openingSelectionMissing',
      `opening ${room.gameName} has no selected outgoing exit`,
    );
  }
  return Object.freeze({
    id: room.occurrenceId,
    owner,
    biomeKey: evaluation.biomeKey,
    gameName: room.gameName,
    contents: Object.freeze({ incomingReward: reward }),
    trace: Object.freeze([
      Object.freeze({
        id: `${owner}:roomEntered`,
        kind: 'roomEntered' as const,
        checkpoint: 'roomEntered' as const,
        owner,
      }),
    ]),
    outgoing: Object.freeze({
      owner: semanticAddressKey(batch.origin),
      targets: Object.freeze(
        batch.targets.map((target) =>
          Object.freeze({
            exitKey: target.exit.exitKey,
            index: target.exit.index,
            type: target.exit.kind === 'available' ? target.exit.type : '',
            room: Object.freeze({
              id: target.room.occurrenceId,
              biomeKey: target.room.origin.biomeKey,
              gameName: target.room.gameName,
            }),
            picked: target.picked,
          }),
        ),
      ),
      selectedExitKey: selectedExitKey,
    }),
  });
}

export function compileExecutionPlan({ assembly }: ExecutionCompilerInput): ExecutionPlan {
  // The compiler accepts only the application-owned evaluation assembly. It
  // consumes the validated conclusions and never reconstructs candidates.
  assertExactProjectEvaluationAssembly(assembly);
  const { evaluation } = assembly;
  if (!evaluation.summary.eligibleForExecutionPlan) {
    throw new CompilerError('notEligible', 'project evaluation is not eligible for execution');
  }
  if (evaluation.route.routeKey !== 'Underworld') {
    throw new CompilerError('unsupportedRoute', 'Gate A supports only the Underworld route');
  }
  if (
    evaluation.catalogVersion !== EXECUTION_CATALOG_VERSION ||
    evaluation.route.configuredBiomeKeys.length !== 1 ||
    evaluation.route.configuredBiomeKeys[0] !== 'F'
  ) {
    throw new CompilerError('unsupportedExtent', 'Gate A supports only a configured F prefix');
  }
  const biome = evaluation.route.biomes[0];
  if (biome?.authoring !== 'complete' || biome.validity !== 'valid') {
    throw new CompilerError('notEligible', 'F must be a complete-valid evaluated biome');
  }
  const room = executionRoom(biome);
  const base = Object.freeze({
    format: EXECUTION_PLAN_FORMAT,
    protocolVersion: EXECUTION_PROTOCOL_VERSION,
    catalogVersion: evaluation.catalogVersion,
    projectId: evaluation.projectId,
    routeKey: 'Underworld' as const,
    extent: Object.freeze({
      kind: 'configuredPrefix' as const,
      biomeKeys: ['F'] as const,
      terminalBiomeKey: 'F' as const,
    }),
    rooms: Object.freeze([room] as [ExecutionRoom]),
  });
  return Object.freeze({ ...base, planFingerprint: fingerprint(base) });
}

export { CompilerError as ExecutionCompilerError };
