import type { Catalog, LinearBiomeLayout, RoomDeclaration } from '../catalog';
import {
  createContinuationAddress,
  createOccurrenceAddress,
  createPickedAddress,
  createTargetAddress,
  type BiomeAddress,
} from '../project/addresses';
import type {
  LinearBiomePlan,
  LinearBiomeTopology,
  LinearContinuation,
  OccurrenceId,
  RoomOccurrence,
} from '../project/model';
import type { CompletenessFindingCode, FindingEvidence, SemanticFinding } from './model';

export interface IncompleteFCompletenessResult {
  readonly completion: 'incomplete';
  readonly findings: readonly SemanticFinding[];
}

export interface CompleteFCompletenessResult {
  readonly completion: 'complete';
  readonly topology: LinearBiomeTopology;
  readonly findings: readonly [];
}

export type FCompletenessResult = CompleteFCompletenessResult | IncompleteFCompletenessResult;

export class CompletenessContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'CompletenessContractError';
  }
}

function finding(
  code: CompletenessFindingCode,
  origin: SemanticFinding['origin'],
  evidence: FindingEvidence = {},
): SemanticFinding {
  return Object.freeze({
    code,
    severity: 'error',
    phase: 'completeness',
    origin,
    evidence: Object.freeze(evidence),
  });
}

function requireFLayout(catalog: Catalog, biome: BiomeAddress, plan: LinearBiomePlan) {
  if (biome.biomeKey !== 'F' || plan.biomeKey !== 'F') {
    throw new CompletenessContractError('F completeness requires biome F');
  }
  if (plan.biomeKey !== biome.biomeKey) {
    throw new CompletenessContractError(
      `plan biome ${plan.biomeKey} does not match address biome ${biome.biomeKey}`,
    );
  }
  const route = catalog.routes.byKey[biome.routeKey];
  if (route === undefined || !route.biomeKeys.includes('F')) {
    throw new CompletenessContractError(`${biome.routeKey} does not place biome F`);
  }
  const layout = catalog.biomeLayouts.byKey.F;
  if (layout?.kind !== 'LinearBiome') {
    throw new CompletenessContractError('catalog does not provide a linear F layout');
  }
  if (
    layout.start.kind !== 'authoredStart' ||
    layout.continuation.batchPolicy.kind !== 'standard' ||
    layout.continuation.rewardStorePolicy.kind !== 'authoredBaseStore' ||
    layout.terminal.kind !== 'forkedTransition'
  ) {
    throw new CompletenessContractError('catalog F layout is not supported by F completeness');
  }
  return layout;
}

function occurrenceById(topology: LinearBiomeTopology): ReadonlyMap<OccurrenceId, RoomOccurrence> {
  return new Map(topology.occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence]));
}

function continuationByParent(
  topology: LinearBiomeTopology,
): ReadonlyMap<OccurrenceId, LinearContinuation> {
  return new Map(
    topology.continuations.map((continuation) => [continuation.parentOccurrenceId, continuation]),
  );
}

function requiredExitIndexes(room: RoomDeclaration): readonly number[] {
  return room.exits.map((exit) => exit.index).sort((left, right) => left - right);
}

function findRequiredTargets(
  findings: SemanticFinding[],
  biome: BiomeAddress,
  parent: RoomOccurrence,
  room: RoomDeclaration,
  continuation: LinearContinuation,
): void {
  for (const exitIndex of requiredExitIndexes(room)) {
    if (!continuation.targets.some((target) => target.exitIndex === exitIndex)) {
      findings.push(
        finding('targetMissing', createTargetAddress(biome, parent.occurrenceId, exitIndex), {
          exitIndex,
          parentGameName: parent.gameName,
        }),
      );
    }
  }
}

function findPickedShopState(
  findings: SemanticFinding[],
  biome: BiomeAddress,
  occurrence: RoomOccurrence,
): void {
  if (occurrence.state.kind === 'shop' && occurrence.state.shop === undefined) {
    findings.push(
      finding('pickedShopStateMissing', createOccurrenceAddress(biome, occurrence.occurrenceId), {
        gameName: occurrence.gameName,
      }),
    );
  }
}

export function evaluateFCompleteness(
  catalog: Catalog,
  biome: BiomeAddress,
  plan: LinearBiomePlan,
): FCompletenessResult {
  const layout: LinearBiomeLayout = requireFLayout(catalog, biome, plan);
  const topology = plan.topology;
  if (topology === null) {
    return Object.freeze({
      completion: 'incomplete',
      findings: Object.freeze([
        finding('biomeTopologyMissing', biome, { biomeKey: layout.biomeKey }),
      ]),
    });
  }

  const occurrences = occurrenceById(topology);
  const continuations = continuationByParent(topology);
  const findings: SemanticFinding[] = [];
  let currentOccurrenceId: OccurrenceId | null = topology.startOccurrenceId;

  while (currentOccurrenceId !== null) {
    const parent = occurrences.get(currentOccurrenceId);
    if (parent === undefined) {
      throw new CompletenessContractError(
        `trusted topology lost occurrence ${currentOccurrenceId}`,
      );
    }
    const room = catalog.rooms.byKey[parent.gameName];
    if (room === undefined) {
      throw new CompletenessContractError(`trusted topology lost room ${parent.gameName}`);
    }
    findPickedShopState(findings, biome, parent);

    const continuation = continuations.get(currentOccurrenceId);
    if (continuation === undefined) {
      findings.push(
        finding('continuationMissing', createContinuationAddress(biome, currentOccurrenceId), {
          parentGameName: parent.gameName,
        }),
      );
      break;
    }

    findRequiredTargets(findings, biome, parent, room, continuation);
    if (continuation.pickedExitIndex === null) {
      findings.push(
        finding('pickedTargetMissing', createPickedAddress(biome, currentOccurrenceId), {
          continuationKind: continuation.kind,
        }),
      );
      break;
    }

    const pickedTarget = continuation.targets.find(
      (target) => target.exitIndex === continuation.pickedExitIndex,
    );
    if (pickedTarget === undefined) {
      throw new CompletenessContractError(
        `trusted continuation lost picked exit ${continuation.pickedExitIndex}`,
      );
    }
    const pickedOccurrence = occurrences.get(pickedTarget.occurrenceId);
    if (pickedOccurrence === undefined) {
      throw new CompletenessContractError(
        `trusted continuation lost occurrence ${pickedTarget.occurrenceId}`,
      );
    }
    if (continuation.kind === 'terminal') {
      findPickedShopState(findings, biome, pickedOccurrence);
      currentOccurrenceId = null;
    } else {
      currentOccurrenceId = pickedTarget.occurrenceId;
    }
  }

  if (findings.length !== 0) {
    return Object.freeze({ completion: 'incomplete', findings: Object.freeze(findings) });
  }
  return Object.freeze({
    completion: 'complete',
    topology,
    findings: Object.freeze([]) as readonly [],
  });
}
