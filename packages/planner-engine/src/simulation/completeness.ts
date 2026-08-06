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
import {
  additionalExitsForDecision,
  declaredPhysicalExitsForSourceRoom,
  exitDecisionForSource,
  hubDecisionHandoffReadiness,
  hubTerminalTakeoverForSource,
  isExactTerminalTakeoverEnvelope,
  normalDecisionProgressionForLayout,
  selectedExitContinuation,
  selectedExitTarget,
} from '../authored-project/topology/query';
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
  return decision.normal.targets.some((target) => {
    const occurrence = occurrences.get(target.occurrenceId);
    const room = occurrence === undefined ? undefined : catalog.rooms.byKey[occurrence.gameName];
    return room?.prebossBatchPolicy?.kind === 'takeOverNormalDoors';
  });
}

function findMissingTargets(
  findings: SemanticFinding[],
  biome: BiomeAddress,
  layout: BiomeLayout,
  topology: BiomeTopology,
  decision: ExitDecision,
  room: RoomDeclaration | undefined,
): void {
  const exits = declaredPhysicalExitsForSourceRoom(
    layout,
    topology.startOccurrenceId,
    decision.source,
    room,
  );
  if (exits === undefined) {
    throw new CompletenessContractError('trusted decision source lost declared physical exits');
  }
  for (const exit of exits) {
    const exitKey = exit.exitKey;
    if (!decision.normal.targets.some((target) => target.exitKey === exitKey)) {
      findings.push(
        finding(
          'targetMissing',
          createTargetAddress(biome, sourceAddress(decision.source), exitKey),
          {
            exitKey,
            ...(room === undefined ? {} : { parentGameName: room.gameName }),
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
  const readiness = hubDecisionHandoffReadiness(layout.progression, decision);
  switch (readiness.kind) {
    case 'ready':
      return undefined;
    case 'missing':
      return Object.freeze({
        completion: 'incomplete',
        frontier: hub,
        findings: Object.freeze([
          finding('continuationMissing', hub, { hubKey: layout.progression.hubKey }),
        ]),
      });
    case 'openSetIncomplete': {
      const origin = createHubOpenSetAddress(biome, layout.progression.hubKey);
      return Object.freeze({
        completion: 'incomplete',
        frontier: origin,
        findings: Object.freeze([
          finding('hubOpenSetIncomplete', origin, {
            actualCount: readiness.actualCount,
            minimumCount: readiness.minimumCount,
            maximumCount: readiness.maximumCount,
          }),
        ]),
      });
    }
    case 'visitOrderIncomplete': {
      const origin = createHubVisitAddress(
        biome,
        layout.progression.hubKey,
        readiness.actualCount + 1,
      );
      return Object.freeze({
        completion: 'incomplete',
        frontier: origin,
        findings: Object.freeze([
          finding('hubVisitOrderIncomplete', origin, {
            actualCount: readiness.actualCount,
            requiredCount: readiness.requiredCount,
          }),
        ]),
      });
    }
  }
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
 * offered preboss is still an ordinary dead leaf. A Hub transition replaces
 * its exact terminal envelope at the selected occurrence source, then owns
 * its board and completed-Hub exit by its stable decision key.
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
    const hubProgression = layout.progression.kind === 'hub' ? layout.progression : undefined;
    const authoredHub =
      hubProgression === undefined ? undefined : hubDecision(topology, hubProgression.hubKey);
    if (
      authoredHub !== undefined &&
      hubProgression !== undefined &&
      authoredHub.source.occurrenceId === current
    ) {
      const hubIncomplete = evaluateHubDecisionCompleteness(biome, layout, topology);
      if (hubIncomplete !== undefined) return hubIncomplete;
      const hubSource: ExitDecisionSource = Object.freeze({
        kind: 'hubDecision',
        decisionKey: hubProgression.hubKey,
      });
      const handoff = exitDecisionForSource(topology, hubSource);
      if (handoff === undefined) {
        const origin = createExitDecisionAddress(biome, sourceAddress(hubSource));
        return incomplete([
          finding('continuationMissing', origin, { hubKey: hubProgression.hubKey }),
        ]);
      }
      const handoffFindings = evaluateBatchCompleteness(
        catalog,
        biome,
        layout,
        topology,
        occurrences,
        handoff,
        undefined,
      );
      if (handoffFindings.length !== 0) return incomplete(handoffFindings);
      const selected = selectedExitTarget(handoff);
      if (selected === undefined) {
        const origin = createExitSelectionAddress(biome, sourceAddress(handoff.source));
        return incomplete([finding('pickedTargetMissing', origin, { decisionKind: 'hubHandoff' })]);
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
    if (decision === undefined) {
      const origin = createExitDecisionAddress(biome, sourceAddress(source));
      return incomplete([
        ...findings,
        finding('continuationMissing', origin, { parentGameName: room.gameName }),
      ]);
    }

    const terminal = hubTerminalTakeoverForSource(catalog, layout, topology, source);
    if (terminal !== undefined && isExactTerminalTakeoverEnvelope(decision)) {
      const origin = createHubDecisionAddress(biome, terminal.hubKey);
      return incomplete([
        ...findings,
        finding('continuationMissing', origin, { hubKey: terminal.hubKey }),
      ]);
    }
    const batchFindings = evaluateBatchCompleteness(
      catalog,
      biome,
      layout,
      topology,
      occurrences,
      decision,
      room,
    );
    if (batchFindings.length !== 0) return incomplete([...findings, ...batchFindings]);

    const selected = selectedExitContinuation(
      decision,
      additionalExitsForDecision(topology, decision),
    );
    if (selected === undefined) {
      const origin = createExitSelectionAddress(biome, sourceAddress(decision.source));
      return incomplete([
        ...findings,
        finding('pickedTargetMissing', origin, {
          continuationKind: 'batch',
        }),
      ]);
    }
    const selectedOccurrence = occurrences.get(
      selected.kind === 'normal' ? selected.target.occurrenceId : selected.exit.occurrenceId,
    );
    if (selectedOccurrence === undefined) {
      const selectedOccurrenceId =
        selected.kind === 'normal' ? selected.target.occurrenceId : selected.exit.occurrenceId;
      throw new CompletenessContractError(
        `trusted decision lost occurrence ${selectedOccurrenceId}`,
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
  topology: BiomeTopology,
  occurrences: ReadonlyMap<OccurrenceId, RoomOccurrence>,
  decision: ExitDecision,
  room: RoomDeclaration | undefined,
): readonly SemanticFinding[] {
  const findings: SemanticFinding[] = [];
  const source = sourceAddress(decision.source);
  const takeover = isTakeoverBatch(decision, occurrences, catalog);
  const emptyOrdinaryEnvelope = !takeover && decision.normal.targets.length === 0;
  // The first physical door is the authoring frontier of an empty envelope.
  // Setup remains a finding and still blocks ordinary target creation, but it
  // must not hide the decision's Room choice or reclassify the envelope as an
  // invalid extra batch.
  if (emptyOrdinaryEnvelope && room !== undefined) {
    findMissingTargets(findings, biome, layout, topology, decision, room);
  }
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
    normalDecisionProgressionForLayout(layout)?.batchPolicy.kind === 'fields' &&
    decision.normal.batchState === null
  ) {
    findings.push(
      finding('batchStateMissing', createExitDecisionAddress(biome, source), {
        batchPolicy: 'fields',
        ...(room === undefined ? {} : { parentGameName: room.gameName }),
      }),
    );
  }
  if (!emptyOrdinaryEnvelope && room !== undefined) {
    findMissingTargets(findings, biome, layout, topology, decision, room);
  }
  return Object.freeze(findings);
}
