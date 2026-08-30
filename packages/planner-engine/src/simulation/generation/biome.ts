import type { Catalog } from '../../catalog-schema';
import type { TargetRewardHistoryCheckpoint } from '../rewards';
import type { GeneratedRoomGenerationValidation } from './model';
import {
  BiomeRoomGenerationContractError,
  evaluateAdditionalContinuationEntries,
  finding,
  generationDecisions,
  generationFindingChronology,
  generationRooms,
  normalTargetCandidateHistory,
  assessChaosPlacement,
  assessZagreusContractPlacement,
  stagedCandidatePool,
  targetGenerationViews,
  targetRewardHistories,
} from './normal-targets';
import type { BiomeGenerationHistory, BiomeGenerationSnapshot } from './normal-targets';
import type { ProgressiveRoomHistoryViews } from '../history';
import {
  evaluateTargetSlots,
  evaluateTakeoverPrebossBatchCandidate,
  normalPhysicalExitsForSource,
  requireSource,
} from './first-target-takeover';
import { evaluateFieldsCageOutcome, fieldsCageOutcomeEvidence } from './fields-cage';
import {
  createRoomTargetCandidateArtifacts,
  createChaosCandidateArtifacts,
  createZagreusContractCandidateArtifacts,
  type RoomTargetCandidateArtifacts,
  type ChaosCandidateArtifacts,
  type ZagreusContractCandidateArtifacts,
} from '../candidate-artifacts';
import type { FindingRegionEntry } from '../finding-regions';
import { findingRegion, ownerRegion } from '../finding-regions';
import type {
  FieldsCageOutcomeSupportEntry,
  OrdinaryBatchGenerationAssessment,
  RoomTargetCandidateContext,
} from './model';
import type { SemanticFinding } from '../model';
import { normalDecisionProgressionForLayout } from '../../authored-project/topology/query';
import { semanticAddressKey } from '../../authored-project/addresses';
import type { CanonicalBatch } from '../materialization';

interface BiomeRoomGenerationAssembly {
  readonly validation: GeneratedRoomGenerationValidation;
  readonly candidateArtifacts: RoomTargetCandidateArtifacts;
  readonly chaos: ChaosCandidateArtifacts;
  readonly zagreusContracts: ZagreusContractCandidateArtifacts;
  readonly findingRegions: readonly FindingRegionEntry[];
}

export function evaluateBiomeRoomGenerationAssemblyInternal(
  catalog: Catalog,
  snapshot: BiomeGenerationSnapshot,
  history: BiomeGenerationHistory,
  enteredBiomeCount: number,
  rewardHistoryCheckpoints?: readonly TargetRewardHistoryCheckpoint[],
  forcedChaosOccurrenceKeys: ReadonlySet<string> = new Set(),
): BiomeRoomGenerationAssembly {
  if (snapshot.biomeKey !== history.biomeKey || snapshot.routeKey !== history.routeKey) {
    throw new BiomeRoomGenerationContractError(
      'biome generation inputs do not share one biome owner',
    );
  }
  const rooms = generationRooms(snapshot);
  const views = targetGenerationViews(history);
  const rewardHistories = targetRewardHistories(rewardHistoryCheckpoints);
  const candidateContexts = new Map<string, RoomTargetCandidateContext>();
  const ordinaryBatches: OrdinaryBatchGenerationAssessment[] = [];
  const findings: SemanticFinding[] = [];
  const findingRegions: FindingRegionEntry[] = [];
  const chaosCapabilities = new Map<
    string,
    import('../candidate-artifacts').ChaosCandidateCapability
  >();
  const zagreusContractCapabilities = new Map<
    string,
    import('../candidate-artifacts').ZagreusContractCandidateCapability
  >();
  const addFinding = (value: SemanticFinding, region = ownerRegion(value.origin)): void => {
    findings.push(value);
    findingRegions.push(findingRegion(value, region, undefined, 'generation'));
  };
  const layout = catalog.biomeLayouts.byKey[snapshot.biomeKey];
  if (layout === undefined) {
    throw new BiomeRoomGenerationContractError(
      `catalog does not provide ${snapshot.biomeKey} progression policy`,
    );
  }
  const normalProgression = normalDecisionProgressionForLayout(layout);
  if (normalProgression === undefined) {
    throw new BiomeRoomGenerationContractError(
      `${snapshot.biomeKey} has no normal decision progression`,
    );
  }

  for (const source of rooms.values()) {
    const sourceDeclaration = catalog.rooms.byKey[source.gameName];
    if (sourceDeclaration === undefined) continue;
    const parentHistory: ProgressiveRoomHistoryViews | undefined = history.rooms.find(
      (room) => semanticAddressKey(room.origin) === semanticAddressKey(source.origin),
    );
    if (sourceDeclaration.additionalExits.some((exit) => exit.kind === 'chaos')) {
      const capability = forcedChaosOccurrenceKeys.has(semanticAddressKey(source.origin))
        ? Object.freeze({ placementEligible: true, failedConditions: Object.freeze([]) })
        : assessChaosPlacement(
            catalog,
            layout,
            source,
            sourceDeclaration,
            parentHistory,
            undefined,
            enteredBiomeCount,
          );
      if (capability !== undefined) {
        chaosCapabilities.set(semanticAddressKey(source.origin), capability);
      }
    }
    if (sourceDeclaration.additionalExits.some((exit) => exit.kind === 'zagreusContract')) {
      const capability = assessZagreusContractPlacement(sourceDeclaration, parentHistory);
      if (capability !== undefined) {
        zagreusContractCapabilities.set(semanticAddressKey(source.origin), capability);
      }
    }
  }

  let ordinaryBatchIndex = 0;
  for (const batch of generationDecisions(snapshot).filter(
    (decision): decision is CanonicalBatch =>
      decision.kind === 'batch' && decision.parent.origin.kind === 'occurrence',
  )) {
    const takeover = batch.targets.some((target) => {
      const room = catalog.rooms.byKey[target.room.gameName];
      return room?.prebossBatchPolicy?.kind === 'takeOverNormalDoors';
    });
    if (takeover) {
      if (batch.selectedExitKey === null) {
        // Appearance creates the atomic takeover target set before a player
        // chooses one door. Until that selection exists it is a physical
        // frontier, not a selected room-generation assertion.
        continue;
      }
      const gameName = batch.targets[0]?.room.gameName;
      if (gameName === undefined) {
        throw new BiomeRoomGenerationContractError(
          `${semanticAddressKey(batch.origin)} takeover batch has no target`,
        );
      }
      const takeoverOwner = requireSource(rooms, batch.parent.origin);
      const takeoverOwnerHistory = history.rooms.find(
        (room) => semanticAddressKey(room.origin) === semanticAddressKey(takeoverOwner.origin),
      );
      if (takeoverOwnerHistory?.preOutgoing === undefined) {
        // A missing reward leaf or required chronology action can stop the
        // source before outgoing generation without invalidating the already
        // authored takeover shape.
        continue;
      }
      const support = evaluateTakeoverPrebossBatchCandidate(
        catalog,
        snapshot,
        history,
        batch.origin,
        gameName,
        enteredBiomeCount,
      );
      support.findings.forEach((value) => addFinding(value, ownerRegion(batch.origin)));
      if (!support.selectedPossible) {
        addFinding(
          finding('targetRoomUnavailable', batch.origin, {
            gameName,
            requiredExitKeys: support.requiredExitKeys,
            requiredTargetCount: support.requiredTargetCount,
          }),
          ownerRegion(batch.origin),
        );
      }
      continue;
    }
    const source = requireSource(rooms, batch.parent.origin);
    const sourceDeclaration = catalog.rooms.byKey[source.gameName];
    if (sourceDeclaration === undefined) {
      throw new BiomeRoomGenerationContractError(`unknown source room ${source.gameName}`);
    }
    const sourceViews = history.rooms.find(
      (room) => semanticAddressKey(room.origin) === semanticAddressKey(source.origin),
    );
    if (sourceViews === undefined) {
      // The source occurrence may be structurally authored while an unresolved
      // reward leaf blocks its lifecycle. Downstream topology remains
      // authorable, but generation cannot be assessed from a fabricated view.
      continue;
    }
    const sourceBeforeGeneration = normalTargetCandidateHistory(layout, source, sourceViews);
    if (sourceBeforeGeneration === undefined) {
      // An authored-first prefix can retain a downstream decision after an
      // earlier semantic boundary. Its source exists, but has not reached the
      // layout's exact normal-generation checkpoint, so this decision is
      // deliberately unassessed rather than malformed or evaluated from a
      // weaker checkpoint.
      continue;
    }
    const physicalExits = normalPhysicalExitsForSource(
      layout,
      snapshot.entryRoom.occurrenceId,
      batch.source,
      sourceDeclaration,
    );
    let fields: FieldsCageOutcomeSupportEntry | undefined;
    if (normalProgression.batchPolicy.kind === 'fields') {
      const support = evaluateFieldsCageOutcome(
        normalProgression.batchPolicy,
        batch,
        sourceBeforeGeneration,
      );
      fields = support;
      if (!support.selectedPossible) {
        addFinding(
          finding(
            'fieldsCageOutcomeUnavailable',
            support.origin,
            fieldsCageOutcomeEvidence(support),
          ),
          ownerRegion(batch.origin),
        );
      }
    }
    const targets = evaluateTargetSlots(
      catalog,
      layout,
      stagedCandidatePool(
        catalog,
        layout,
        ordinaryBatchIndex,
        catalog.routes.byKey[source.origin.routeKey]!,
      ),
      source,
      sourceBeforeGeneration,
      batch.origin,
      physicalExits,
      batch.targets,
      views,
      candidateContexts,
      findings,
      findingRegions,
      enteredBiomeCount,
      rewardHistories,
    );
    ordinaryBatches.push(
      Object.freeze({
        origin: batch.origin,
        ...(fields === undefined ? {} : { fields }),
        targets,
      }),
    );
    ordinaryBatchIndex += 1;
  }

  evaluateAdditionalContinuationEntries(
    catalog,
    snapshot,
    history,
    rooms,
    findings,
    findingRegions,
    enteredBiomeCount,
    forcedChaosOccurrenceKeys,
  );

  const publishedFindingRegions = Object.freeze(
    findingRegions.map((entry) => {
      const chronology = generationFindingChronology(history, entry.finding.origin);
      return chronology === undefined
        ? entry
        : findingRegion(entry.finding, entry.atomicRegion, chronology, entry.aggregate);
    }),
  );
  const validation: GeneratedRoomGenerationValidation = Object.freeze({
    biomeKey: snapshot.biomeKey,
    validity: findings.length === 0 ? 'valid' : 'invalid',
    ordinaryBatches: Object.freeze(ordinaryBatches),
    findings: Object.freeze(findings),
  });
  return Object.freeze({
    validation,
    findingRegions: publishedFindingRegions,
    candidateArtifacts: createRoomTargetCandidateArtifacts(candidateContexts),
    chaos: createChaosCandidateArtifacts(chaosCapabilities),
    zagreusContracts: createZagreusContractCandidateArtifacts(zagreusContractCapabilities),
  });
}

export function evaluateBiomeRoomGeneration(
  catalog: Catalog,
  snapshot: BiomeGenerationSnapshot,
  history: BiomeGenerationHistory,
  enteredBiomeCount: number,
  rewardHistoryCheckpoints?: readonly TargetRewardHistoryCheckpoint[],
  forcedChaosOccurrenceKeys: ReadonlySet<string> = new Set(),
): GeneratedRoomGenerationValidation {
  return evaluateBiomeRoomGenerationAssemblyInternal(
    catalog,
    snapshot,
    history,
    enteredBiomeCount,
    rewardHistoryCheckpoints,
    forcedChaosOccurrenceKeys,
  ).validation;
}
