import type { BiomeLayout, Catalog, RoomDeclaration } from '../catalog-schema';
import {
  createBatchRewardStoreAddress,
  createBiomeFieldAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createHubDecisionAddress,
  createHubOpenSetAddress,
  createHubVisitAddress,
  createOccurrenceAddress,
  createTargetAddress,
  type BiomeAddress,
  type ExitDecisionSourceAddress,
  type SemanticAddress,
} from '../authored-project/addresses';
import type {
  AuthoredBiomeState,
  BiomeTopology,
  ExitDecision,
  ExitDecisionSource,
  HubDecision,
  OccurrenceId,
  RoomOccurrence,
} from '../authored-project/model';
import { exitDecisionForSource, selectedExitTarget } from '../authored-project/topology/query';
import type { CompletenessFindingCode, FindingEvidence, SemanticFinding } from './model';

export interface IncompleteBiomeCompletenessResult {
  readonly completion: 'incomplete';
  readonly frontier: SemanticAddress;
  readonly findings: readonly SemanticFinding[];
}

export interface CompleteBiomeCompletenessResult {
  readonly completion: 'complete';
  readonly biomeState: AuthoredBiomeState;
  readonly topology: BiomeTopology;
  readonly findings: readonly [];
}

export type BiomeCompletenessResult =
  CompleteBiomeCompletenessResult | IncompleteBiomeCompletenessResult;

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

function requireLayout(catalog: Catalog, biome: BiomeAddress, biomeKey: string): BiomeLayout {
  if (biomeKey !== biome.biomeKey) {
    throw new CompletenessContractError(
      `plan biome ${biomeKey} does not match address biome ${biome.biomeKey}`,
    );
  }
  const route = catalog.routes.byKey[biome.routeKey];
  if (route === undefined || !route.biomeKeys.includes(biome.biomeKey)) {
    throw new CompletenessContractError(`${biome.routeKey} does not place biome ${biome.biomeKey}`);
  }
  const layout = catalog.biomeLayouts.byKey[biome.biomeKey];
  if (layout === undefined) {
    throw new CompletenessContractError(`catalog does not provide a ${biome.biomeKey} layout`);
  }
  return layout;
}

function occurrenceMap(topology: BiomeTopology): ReadonlyMap<OccurrenceId, RoomOccurrence> {
  return new Map(topology.occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence]));
}

function sourceAddress(source: ExitDecisionSource): ExitDecisionSourceAddress {
  return source.kind === 'occurrence'
    ? Object.freeze({ kind: 'occurrence', occurrenceId: source.occurrenceId })
    : Object.freeze({ kind: 'hubDecision', decisionKey: source.decisionKey });
}

function hubDecision(topology: BiomeTopology, hubKey: string): HubDecision | undefined {
  return topology.decisions.find(
    (decision): decision is HubDecision => decision.kind === 'hub' && decision.hubKey === hubKey,
  );
}

function sourceRoom(
  catalog: Catalog,
  occurrences: ReadonlyMap<OccurrenceId, RoomOccurrence>,
  occurrenceId: OccurrenceId,
): RoomDeclaration {
  const occurrence = occurrences.get(occurrenceId);
  if (occurrence === undefined) {
    throw new CompletenessContractError(`trusted topology lost occurrence ${occurrenceId}`);
  }
  const room = catalog.rooms.byKey[occurrence.gameName];
  if (room === undefined) {
    throw new CompletenessContractError(`trusted topology lost room ${occurrence.gameName}`);
  }
  return room;
}

function isTakeoverBatch(
  decision: ExitDecision,
  occurrences: ReadonlyMap<OccurrenceId, RoomOccurrence>,
  catalog: Catalog,
): boolean {
  if (decision.normal.kind !== 'batch') return false;
  return decision.normal.targets.some((target) => {
    const occurrence = occurrences.get(target.occurrenceId);
    const room = occurrence === undefined ? undefined : catalog.rooms.byKey[occurrence.gameName];
    return room?.prebossBatchPolicy?.kind === 'takeOverNormalDoors';
  });
}

function findMissingTargets(
  findings: SemanticFinding[],
  biome: BiomeAddress,
  decision: ExitDecision,
  room: RoomDeclaration,
): void {
  if (decision.normal.kind !== 'batch') return;
  for (const exit of room.exits) {
    const exitKey = `exit${exit.index}`;
    if (!decision.normal.targets.some((target) => target.exitKey === exitKey)) {
      findings.push(
        finding(
          'targetMissing',
          createTargetAddress(biome, sourceAddress(decision.source), exitKey),
          {
            exitKey,
            parentGameName: room.gameName,
          },
        ),
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

function evaluateHubDecisionCompleteness(
  biome: BiomeAddress,
  layout: BiomeLayout,
  topology: BiomeTopology,
): IncompleteBiomeCompletenessResult | undefined {
  if (layout.progression.kind !== 'hub') return undefined;
  const decision = hubDecision(topology, layout.progression.hubKey);
  const hub = createHubDecisionAddress(biome, layout.progression.hubKey);
  if (decision === undefined) {
    return Object.freeze({
      completion: 'incomplete',
      frontier: hub,
      findings: Object.freeze([
        finding('continuationMissing', hub, { hubKey: layout.progression.hubKey }),
      ]),
    });
  }
  if (
    decision.openTargets.length < layout.progression.openCount.min ||
    decision.openTargets.length > layout.progression.openCount.max
  ) {
    const origin = createHubOpenSetAddress(biome, layout.progression.hubKey);
    return Object.freeze({
      completion: 'incomplete',
      frontier: origin,
      findings: Object.freeze([
        finding('hubOpenSetIncomplete', origin, {
          actualCount: decision.openTargets.length,
          minimumCount: layout.progression.openCount.min,
          maximumCount: layout.progression.openCount.max,
        }),
      ]),
    });
  }
  if (decision.visitOrder.length !== layout.progression.requiredVisits) {
    const origin = createHubVisitAddress(
      biome,
      layout.progression.hubKey,
      decision.visitOrder.length + 1,
    );
    return Object.freeze({
      completion: 'incomplete',
      frontier: origin,
      findings: Object.freeze([
        finding('hubVisitOrderIncomplete', origin, {
          actualCount: decision.visitOrder.length,
          requiredCount: layout.progression.requiredVisits,
        }),
      ]),
    });
  }
  return undefined;
}

function incomplete(findings: readonly SemanticFinding[]): IncompleteBiomeCompletenessResult {
  const first = findings[0];
  if (first === undefined) throw new CompletenessContractError('incomplete result needs a finding');
  return Object.freeze({
    completion: 'incomplete',
    frontier: first.origin,
    findings: Object.freeze(findings),
  });
}

/**
 * Completeness follows the authored selected spine. A room declaration with
 * kind Preboss ends editable traversal only when its target is selected; an
 * offered preboss is still an ordinary dead leaf. Hub topology enters through
 * the fixed linked PreHub target and then owns its board and completed-Hub
 * exit by its stable decision key.
 */
export function evaluateBiomeCompleteness(
  catalog: Catalog,
  biome: BiomeAddress,
  plan: {
    readonly biomeKey: string;
    readonly state: AuthoredBiomeState;
    readonly topology: BiomeTopology | null;
  },
): BiomeCompletenessResult {
  const layout = requireLayout(catalog, biome, plan.biomeKey);
  const topology = plan.topology;
  if (topology === null) {
    return Object.freeze({
      completion: 'incomplete',
      frontier: biome,
      findings: Object.freeze([
        finding('biomeTopologyMissing', biome, { biomeKey: layout.biomeKey }),
      ]),
    });
  }

  for (const descriptor of layout.fields) {
    if (descriptor.initialization.kind === 'required' && plan.state[descriptor.key] === null) {
      const origin = createBiomeFieldAddress(biome, descriptor.key);
      return Object.freeze({
        completion: 'incomplete',
        frontier: origin,
        findings: Object.freeze([
          finding('biomeFieldMissing', origin, { fieldKey: descriptor.key }),
        ]),
      });
    }
  }

  const occurrences = occurrenceMap(topology);
  const findings: SemanticFinding[] = [];
  const traversed = new Set<OccurrenceId>();
  let current = topology.startOccurrenceId;

  while (!traversed.has(current)) {
    traversed.add(current);
    const occurrence = occurrences.get(current);
    if (occurrence === undefined) {
      throw new CompletenessContractError(`trusted topology lost occurrence ${current}`);
    }
    const room = sourceRoom(catalog, occurrences, current);
    findPickedShopState(findings, biome, occurrence);

    const source: ExitDecisionSource = Object.freeze({ kind: 'occurrence', occurrenceId: current });
    const decision = exitDecisionForSource(topology, source);
    if (decision === undefined) {
      if (
        layout.progression.kind === 'hub' &&
        room.gameName === layout.progression.linkedExit.roomGameName
      ) {
        const hubIncomplete = evaluateHubDecisionCompleteness(biome, layout, topology);
        if (hubIncomplete !== undefined) return hubIncomplete;
        const hubSource: ExitDecisionSource = Object.freeze({
          kind: 'hubDecision',
          decisionKey: layout.progression.hubKey,
        });
        const handoff = exitDecisionForSource(topology, hubSource);
        if (handoff === undefined) {
          const origin = createExitDecisionAddress(biome, sourceAddress(hubSource));
          return incomplete([
            finding('continuationMissing', origin, { hubKey: layout.progression.hubKey }),
          ]);
        }
        if (handoff.normal.kind !== 'batch') {
          throw new CompletenessContractError('completed Hub exit must be a normal-door batch');
        }
        const handoffFindings = evaluateBatchCompleteness(
          catalog,
          biome,
          layout,
          occurrences,
          handoff,
          undefined,
        );
        if (handoffFindings.length !== 0) return incomplete(handoffFindings);
        const selected = selectedExitTarget(handoff);
        if (selected === undefined) {
          const origin = createExitSelectionAddress(biome, sourceAddress(handoff.source));
          return incomplete([
            finding('pickedTargetMissing', origin, { decisionKind: 'hubHandoff' }),
          ]);
        }
        const preboss = occurrences.get(selected.occurrenceId);
        if (preboss === undefined) {
          throw new CompletenessContractError(`trusted Hub exit lost ${selected.occurrenceId}`);
        }
        findPickedShopState(findings, biome, preboss);
        return findings.length === 0
          ? Object.freeze({
              completion: 'complete',
              biomeState: plan.state,
              topology,
              findings: Object.freeze([]) as readonly [],
            })
          : incomplete(findings);
      }
      const origin = createExitDecisionAddress(biome, sourceAddress(source));
      return incomplete([
        ...findings,
        finding('continuationMissing', origin, { parentGameName: room.gameName }),
      ]);
    }

    if (decision.normal.kind === 'batch') {
      const batchFindings = evaluateBatchCompleteness(
        catalog,
        biome,
        layout,
        occurrences,
        decision,
        room,
      );
      if (batchFindings.length !== 0) return incomplete([...findings, ...batchFindings]);
    }

    const selected = selectedExitTarget(decision);
    if (selected === undefined) {
      const origin = createExitSelectionAddress(biome, sourceAddress(decision.source));
      return incomplete([
        ...findings,
        finding('pickedTargetMissing', origin, {
          continuationKind: decision.normal.kind,
        }),
      ]);
    }
    const selectedOccurrence = occurrences.get(selected.occurrenceId);
    if (selectedOccurrence === undefined) {
      throw new CompletenessContractError(
        `trusted decision lost occurrence ${selected.occurrenceId}`,
      );
    }
    findPickedShopState(findings, biome, selectedOccurrence);
    const selectedRoom = catalog.rooms.byKey[selectedOccurrence.gameName];
    if (selectedRoom === undefined) {
      throw new CompletenessContractError(
        `trusted topology lost room ${selectedOccurrence.gameName}`,
      );
    }
    if (selectedRoom.kind === 'Preboss') {
      return findings.length === 0
        ? Object.freeze({
            completion: 'complete',
            biomeState: plan.state,
            topology,
            findings: Object.freeze([]) as readonly [],
          })
        : incomplete(findings);
    }
    current = selectedOccurrence.occurrenceId;
  }

  throw new CompletenessContractError('trusted topology selected spine contains a cycle');
}

function evaluateBatchCompleteness(
  catalog: Catalog,
  biome: BiomeAddress,
  layout: BiomeLayout,
  occurrences: ReadonlyMap<OccurrenceId, RoomOccurrence>,
  decision: ExitDecision,
  room: RoomDeclaration | undefined,
): readonly SemanticFinding[] {
  if (decision.normal.kind !== 'batch') return Object.freeze([]);
  const findings: SemanticFinding[] = [];
  const source = sourceAddress(decision.source);
  const takeover = isTakeoverBatch(decision, occurrences, catalog);
  if (
    !takeover &&
    decision.normal.rewardStore.kind === 'authoredBaseStore' &&
    decision.normal.rewardStore.baseRewardStoreKey === null
  ) {
    findings.push(
      finding('batchRewardStoreMissing', createBatchRewardStoreAddress(biome, source), {
        ...(room === undefined ? {} : { parentGameName: room.gameName }),
      }),
    );
  }
  if (
    !takeover &&
    layout.progression.kind === 'generated' &&
    layout.progression.batchPolicy.kind === 'fields' &&
    decision.normal.batchState === null
  ) {
    findings.push(
      finding('batchStateMissing', createExitDecisionAddress(biome, source), {
        batchPolicy: 'fields',
        ...(room === undefined ? {} : { parentGameName: room.gameName }),
      }),
    );
  }
  if (room !== undefined) findMissingTargets(findings, biome, decision, room);
  return Object.freeze(findings);
}
