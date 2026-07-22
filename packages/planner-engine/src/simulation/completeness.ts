import type {
  Catalog,
  HubBiomeLayout,
  LinearBiomeLayout,
  RoomDeclaration,
} from '../catalog-schema';
import {
  createContinuationAddress,
  createHubOpenSetAddress,
  createHubVisitAddress,
  createOccurrenceAddress,
  createPickedAddress,
  createTargetAddress,
  type BiomeAddress,
} from '../authored-project/addresses';
import type {
  AuthoredBiomeState,
  HubBiomePlan,
  HubBiomeTopology,
  LinearBiomePlan,
  LinearBiomeTopology,
  LinearContinuation,
  OccurrenceId,
  RoomOccurrence,
} from '../authored-project/model';
import type { CompletenessFindingCode, FindingEvidence, SemanticFinding } from './model';

export interface IncompleteLinearCompletenessResult {
  readonly completion: 'incomplete';
  readonly findings: readonly SemanticFinding[];
}

export interface CompleteLinearCompletenessResult {
  readonly completion: 'complete';
  readonly biomeState: AuthoredBiomeState;
  readonly topology: LinearBiomeTopology;
  readonly findings: readonly [];
}

export type LinearCompletenessResult =
  CompleteLinearCompletenessResult | IncompleteLinearCompletenessResult;

export type IncompleteFCompletenessResult = IncompleteLinearCompletenessResult;
export type CompleteFCompletenessResult = CompleteLinearCompletenessResult;
export type FCompletenessResult = LinearCompletenessResult;

export interface IncompleteHubCompletenessResult {
  readonly completion: 'incomplete';
  readonly findings: readonly SemanticFinding[];
}

export interface CompleteHubCompletenessResult {
  readonly completion: 'complete';
  readonly topology: HubBiomeTopology;
  readonly findings: readonly [];
}

export type HubCompletenessResult = CompleteHubCompletenessResult | IncompleteHubCompletenessResult;

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

function requireLinearLayout(catalog: Catalog, biome: BiomeAddress, plan: LinearBiomePlan) {
  if (plan.biomeKey !== biome.biomeKey) {
    throw new CompletenessContractError(
      `plan biome ${plan.biomeKey} does not match address biome ${biome.biomeKey}`,
    );
  }
  const route = catalog.routes.byKey[biome.routeKey];
  if (route === undefined || !route.biomeKeys.includes(biome.biomeKey)) {
    throw new CompletenessContractError(`${biome.routeKey} does not place biome ${biome.biomeKey}`);
  }
  const layout = catalog.biomeLayouts.byKey[biome.biomeKey];
  if (layout?.kind !== 'LinearBiome') {
    throw new CompletenessContractError(
      `catalog does not provide a linear ${biome.biomeKey} layout`,
    );
  }
  if (
    (layout.continuation.batchPolicy.kind !== 'standard' &&
      layout.continuation.batchPolicy.kind !== 'fields' &&
      layout.continuation.batchPolicy.kind !== 'clockwork') ||
    (layout.continuation.rewardStorePolicy.kind !== 'authoredBaseStore' &&
      layout.continuation.rewardStorePolicy.kind !== 'none') ||
    (layout.terminal.kind !== 'forkedTransition' &&
      layout.terminal.kind !== 'generatedTarget' &&
      layout.terminal.kind !== 'directTransition')
  ) {
    throw new CompletenessContractError(
      `catalog ${biome.biomeKey} layout is not supported by linear completeness`,
    );
  }
  return layout;
}

function occurrenceById(topology: LinearBiomeTopology): ReadonlyMap<OccurrenceId, RoomOccurrence> {
  return new Map(topology.occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence]));
}

function continuationByParent(
  topology: LinearBiomeTopology,
): ReadonlyMap<OccurrenceId | null, LinearContinuation> {
  return new Map(
    topology.continuations.map((continuation) => [continuation.parentOccurrenceId, continuation]),
  );
}

function sourceRoom(
  catalog: Catalog,
  layout: LinearBiomeLayout,
  occurrences: ReadonlyMap<OccurrenceId, RoomOccurrence>,
  parentOccurrenceId: OccurrenceId | null,
): RoomDeclaration {
  if (parentOccurrenceId !== null) {
    const parent = occurrences.get(parentOccurrenceId);
    const room = parent === undefined ? undefined : catalog.rooms.byKey[parent.gameName];
    if (room === undefined) {
      throw new CompletenessContractError(
        `trusted topology lost continuation source ${parentOccurrenceId}`,
      );
    }
    return room;
  }
  if (layout.start.kind !== 'fixedEntry') {
    throw new CompletenessContractError(`${layout.biomeKey} has no derived entry source`);
  }
  const source = layout.entries.at(-1) ?? layout.start;
  const room = catalog.rooms.byKey[source.roomGameName];
  if (room === undefined) {
    throw new CompletenessContractError(`catalog lost fixed entry ${source.roomGameName}`);
  }
  return room;
}

function requiredExitIndexes(room: RoomDeclaration): readonly number[] {
  return room.exits.map((exit) => exit.index).sort((left, right) => left - right);
}

function findRequiredTargets(
  findings: SemanticFinding[],
  biome: BiomeAddress,
  parentOccurrenceId: OccurrenceId | null,
  room: RoomDeclaration,
  continuation: LinearContinuation,
): void {
  for (const exitIndex of requiredExitIndexes(room)) {
    if (!continuation.targets.some((target) => target.exitIndex === exitIndex)) {
      findings.push(
        finding('targetMissing', createTargetAddress(biome, parentOccurrenceId, exitIndex), {
          exitIndex,
          parentGameName: room.gameName,
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

export function evaluateLinearCompleteness(
  catalog: Catalog,
  biome: BiomeAddress,
  plan: LinearBiomePlan,
): LinearCompletenessResult {
  const layout: LinearBiomeLayout = requireLinearLayout(catalog, biome, plan);
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
  let currentOwner: OccurrenceId | null | undefined = topology.startOccurrenceId;

  while (currentOwner !== undefined) {
    const parent = currentOwner === null ? undefined : occurrences.get(currentOwner);
    if (currentOwner !== null && parent === undefined) {
      throw new CompletenessContractError(`trusted topology lost occurrence ${currentOwner}`);
    }
    const room = sourceRoom(catalog, layout, occurrences, currentOwner);
    if (parent !== undefined) {
      findPickedShopState(findings, biome, parent);
    }

    const continuation = continuations.get(currentOwner);
    if (continuation === undefined) {
      findings.push(
        finding('continuationMissing', createContinuationAddress(biome, currentOwner), {
          parentGameName: room.gameName,
        }),
      );
      break;
    }

    findRequiredTargets(findings, biome, currentOwner, room, continuation);
    if (continuation.pickedExitIndex === null) {
      findings.push(
        finding('pickedTargetMissing', createPickedAddress(biome, currentOwner), {
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
      currentOwner = undefined;
    } else if (
      layout.terminal.kind === 'generatedTarget' &&
      pickedOccurrence.gameName === layout.terminal.roomGameName
    ) {
      findPickedShopState(findings, biome, pickedOccurrence);
      currentOwner = undefined;
    } else {
      currentOwner = pickedTarget.occurrenceId;
    }
  }

  if (findings.length !== 0) {
    return Object.freeze({ completion: 'incomplete', findings: Object.freeze(findings) });
  }
  return Object.freeze({
    completion: 'complete',
    biomeState: plan.state,
    topology,
    findings: Object.freeze([]) as readonly [],
  });
}

export function evaluateFCompleteness(
  catalog: Catalog,
  biome: BiomeAddress,
  plan: LinearBiomePlan,
): FCompletenessResult {
  if (biome.biomeKey !== 'F' || plan.biomeKey !== 'F') {
    throw new CompletenessContractError('F completeness requires biome F');
  }
  return evaluateLinearCompleteness(catalog, biome, plan);
}

function requireHubLayout(catalog: Catalog, biome: BiomeAddress, plan: HubBiomePlan) {
  if (plan.biomeKey !== biome.biomeKey) {
    throw new CompletenessContractError(
      `plan biome ${plan.biomeKey} does not match address biome ${biome.biomeKey}`,
    );
  }
  const route = catalog.routes.byKey[biome.routeKey];
  if (route === undefined || !route.biomeKeys.includes(biome.biomeKey)) {
    throw new CompletenessContractError(`${biome.routeKey} does not place biome ${biome.biomeKey}`);
  }
  const layout = catalog.biomeLayouts.byKey[biome.biomeKey];
  if (layout?.kind !== 'HubBiome') {
    throw new CompletenessContractError(`catalog does not provide a Hub ${biome.biomeKey} layout`);
  }
  return layout;
}

export function evaluateHubCompleteness(
  catalog: Catalog,
  biome: BiomeAddress,
  plan: HubBiomePlan,
): HubCompletenessResult {
  const layout: HubBiomeLayout = requireHubLayout(catalog, biome, plan);
  const topology = plan.topology;
  if (topology === null) {
    return Object.freeze({
      completion: 'incomplete',
      findings: Object.freeze([
        finding('biomeTopologyMissing', biome, { biomeKey: layout.biomeKey }),
      ]),
    });
  }

  const findings: SemanticFinding[] = [];
  if (
    topology.openTargets.length < layout.hub.openCount.min ||
    topology.openTargets.length > layout.hub.openCount.max
  ) {
    findings.push(
      finding('hubOpenSetIncomplete', createHubOpenSetAddress(biome), {
        actualCount: topology.openTargets.length,
        minimumCount: layout.hub.openCount.min,
        maximumCount: layout.hub.openCount.max,
      }),
    );
  }
  if (topology.visitOrder.length !== layout.hub.requiredVisits) {
    findings.push(
      finding(
        'hubVisitOrderIncomplete',
        createHubVisitAddress(biome, topology.visitOrder.length + 1),
        {
          actualCount: topology.visitOrder.length,
          requiredCount: layout.hub.requiredVisits,
        },
      ),
    );
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
