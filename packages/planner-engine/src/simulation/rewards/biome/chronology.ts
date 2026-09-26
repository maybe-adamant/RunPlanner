import type { Catalog } from '../../../catalog-schema';
import type { ResolvedRoutePosition } from '../../../authored-project/route-context';
import type { PurgingPoolAssessment } from '../../commerce/purging-pool';
import type { HermesShrineCandidateContext } from '../../commerce/hermes-shrine';
import {
  createAcquisitionRoleAddress,
  createAcquisitionEntryAddress,
  createTravelDealRefillRealizationAddress,
  createEncounterPhaseAddress,
  createBiomeAddress,
  createHubDecisionAddress,
  createTargetAddress,
  createEchoKeepsakeReplayAddress,
  createRoomRunStateCheckpointAddress,
  createRoomFeatureAddress,
  semanticAddressKey,
  type HubRoomAddress,
  type SemanticAddress,
  type SteadyGrowthOutcomeAddress,
  type TraitOfferOwnerAddress,
  type TranscendentEmbryoOutcomeAddress,
  type TargetAddress,
} from '../../../authored-project/addresses';
import type { ResourcePlacements, RouteLoadout } from '../../../authored-project/model';
import { EMPTY_RESOURCE_PLACEMENTS } from '../../../authored-project/defaults';
import type { StygianWellCandidateContext } from '../../commerce/stygian-well';
import { parseSeaStarDuplicateSiteKey } from '../../../authored-project/acquisition/sea-star';
import { parseHermesShrineDeliveryEntryKey } from '../../../authored-project/hermes-shrine-delivery';
import type { ResolvedRewardOffer } from '../../../reward-kernel';
import type { HistoryStateView } from '../../history';
import type {
  CanonicalAuthoredRoom,
  CanonicalHubDecision,
  CanonicalHubRoom,
} from '../../materialization';
import type { CanonicalDecision } from '../../materialization/model';
import { findingIdentityKey, ownerRegion, type FindingRegionEntry } from '../../finding-regions';
import { bossDoorRewardStoreMissingFinding } from '../../completeness';
import { fieldsOptionalRewardCountFindings } from '../../fields/optional-count';
import type {
  RewardBranch,
  BiomeRewardSimulation,
  RewardStoreSupportEntry,
  TargetRewardHistoryCheckpoint,
} from '../model';
import { createAcquisitionConversionCandidateArtifacts } from '../acquisition/artifacts';
import {
  createDerivedAcquisitionEntryCandidateArtifacts,
  attestDerivedAcquisitionEntryCandidateCapability,
} from '../acquisition/artifacts';
import { createSteadyGrowthCandidateArtifacts } from '../../candidates/steady-growth';
import {
  createTranscendentEmbryoCandidateArtifacts,
  createFountainRarityCandidateArtifacts,
} from '../../keepsakes/candidate-artifacts';
import {
  assessPurgingPool,
  createPurgingPoolCandidateArtifacts,
} from '../../commerce/purging-pool';
import { createHermesShrineCandidateArtifacts } from '../../commerce/hermes-shrine';
import { createStygianWellCandidateArtifacts } from '../../commerce/stygian-well';
import {
  createLevelResolutionCandidateArtifacts,
  createTraitOfferCandidateArtifacts,
} from '../../candidates/trait-offer/capability';
import type { TraitOfferCandidateContext } from '../../traits';
import { traitOfferContextIdentity } from '../../traits';
import { foldTraitHistoryEvents } from '../../traits/history/fold';
import type { ReachedSteadyGrowthThreshold } from '../../traits/history/transitions';
import type { ReachedTranscendentEmbryoThreshold } from '../../keepsakes/trait-effects';
import {
  createRunState,
  createRunStateDerivationCache,
  publishRunStateThroughCoverage,
  type RunStateSnapshot,
} from '../run-state';
import { createBiomeRewardFacts, visibleStoreOptionNames } from '../facts';
import {
  createRoomLifecycleCandidateArtifacts,
  type ShipLifecycleCandidateContext,
} from '../lifecycle-artifacts';
import { BiomeRewardSimulationContractError } from './biome-contract';
import { selectedTraitOfferProducts } from './selected-trait-products';
import { prepareRewardEvaluationInputs } from './prepared-inputs';
import { addHubBoardRewardLookup } from '../../state/reward-lookups';
import { reachSimulationHistory, replaceSimulationTraitHistory } from '../../state/transitions';
import {
  normalizeOfferedRewardTypes,
  publishOfferedRewardTypes,
} from '../../state/offered-rewards';
import { applyEncounterStartedTransition } from './lifecycle-transitions/encounter-started';
import { applyEncounterEndEffectsTransition } from './lifecycle-transitions/encounter-end-effects';
import { applyKeepsakeRackUsedTransition } from './lifecycle-transitions/keepsake-rack-used';
import { applyFountainUsedTransition } from './lifecycle-transitions/fountain-used';
import { applyRoomEnteredTransition } from './lifecycle-transitions/room-entered';
import { applyRoomExitedTransition } from './lifecycle-transitions/room-exited';
import { applyRoomPreparedTransition } from './lifecycle-transitions/room-prepared';
import {
  applyTargetGenerationCompletedTransition,
  type TargetGenerationFrontier,
} from './generation/target-generation-completed';
import { applyRoomCreatedTransition } from './generation/room-created';
import { flushHubBoard } from './generation/hub-board';
import { type AuthoredSiteSettlementResult } from './generation/authored-site-settlement';
import { applyOutgoingGenerationTransition } from './generation/outgoing-generation';
import { applyOfferPointMaterializedTransition } from './offer-lifecycle/offer-point-materialized';
import { applyReachedOfferSettlement } from './offer-lifecycle/reached-settlement';
import { applyWellPurchaseTransition } from './encounter-acquisition/well-purchase';
import { applyGorgonStartedTransition } from './encounter-acquisition/gorgon-started';
import { applyEncounterSettlementTransition } from './encounter-acquisition/encounter-settlement';
import {
  applyAcquisitionPointReachedTransition,
  type HermesShrineRefillState,
} from './encounter-acquisition/acquisition-point-reached';
import { rewardFindingChronologyForRoom } from './finding-chronology';
import type { PendingHubBoardGeneration as GenerationPendingHubBoardGeneration } from './generation/emissions';
import type { BiomeRewardHistory, BiomeRewardSnapshot } from './evaluation-contract';
import {
  publishBiomeRewardEvaluationAssembly,
  type BiomeRewardEvaluationAssembly,
  type TraitChildSettlementCheckpoints,
} from './publication';

import {
  createRewardProducerCandidateArtifacts,
  indexRewardProducerFrontier,
  type RewardProducerFrontier,
} from '../producer-frontiers';
import {
  advanceRewardBranches,
  initializeRewardBranches,
  publicRewardBranch,
} from '../branch-lifecycle';
import {
  applyExperimentalHammerEquipResult,
  applyOlympianRewardPressureEquip,
  applyMoonBeamEquip,
} from '../../keepsakes/branch-transitions';
import type { OfferProcessingPeer } from '../offer-generation';
import type { AcquisitionRoleFrontier } from '../acquisition/contracts';
import { addRewardFinding, mergeRewardFindingEmissions } from '../findings';
import { resourcePlacementFindingRegions } from '../../resources';
import { mergeEquivalentRewardBranches, type RewardBranchState } from '../branch-primitives';
import type {
  ReachedTraitChildCheckpoint,
  ReachedTraitOfferCandidateContact,
} from '../trait-settlement/coordinator';
import { rewardFinding } from '../findings';
import { assessAuthoredBossDoorRewardStore } from './reward-store-support';
import {
  EMPTY_PLANNER_TIMELINE_FACTS,
  type PlannerTimelineDependency,
  type PlannerTimelineNode,
} from '../../timeline-facts';
import type { HubDepartureRunState, WellRefillRealization } from '../model';
import {
  assessExperimentalHammerEquipResult,
  applyEchoFigurineReplay,
  applyEchoConcaveStoneReplay,
  assessTranscendentEmbryoBlessing,
} from '../../keepsakes/trait-effects';
import { applyEchoFigLeafReplay } from '../../keepsakes/encounter-effects';
import {
  applyEchoCallingCardReplay,
  applyEchoTimePieceReplay,
  applyEchoOlympianRewardPressureReplay,
} from '../../keepsakes/reward-effects';
import { applyTranscendentEmbryoEquipResult } from '../../keepsakes/branch-transitions';
import { createArcanaFearState } from '../../arcana-fear';
import { createKeepsakeEquipResultAddress } from '../../../authored-project/addresses';
import { createJudgmentArcanaCandidateArtifacts } from '../../arcana-fear';
import {
  createFigurineArcanaCandidateArtifacts,
  createKeepsakeSelectionCandidateArtifacts,
  createKeepsakeEquipResultCandidateArtifacts,
} from '../../keepsakes/candidate-artifacts';

type CanonicalRewardRoom = CanonicalAuthoredRoom;
type CanonicalRewardSource = CanonicalRewardRoom | CanonicalHubRoom;

/**
 * One persistent Ephyra board-generation region. The region starts from the
 * post-Hub-entry reward branches and contains every open physical door,
 * independently from the later six-room visit chronology.
 */
type PendingHubBoardGeneration = GenerationPendingHubBoardGeneration;

function fail(detail: string): never {
  throw new BiomeRewardSimulationContractError(detail);
}

function traitMutationAcquisitionContact(
  owner: SemanticAddress,
): { readonly owner: TraitOfferOwnerAddress; readonly acquisitionRole: string } | undefined {
  switch (owner.kind) {
    case 'traitOffer':
    case 'acquisitionRole':
    case 'levelResolution':
      return Object.freeze({ owner: owner.owner, acquisitionRole: owner.acquisitionRole });
    case 'traitAcquisitionTarget':
    case 'circeResolution':
    case 'echoPomTarget':
    case 'naturalSelectionResult':
    case 'echoLastRunBoon':
    case 'echoLastReward':
    case 'allTogetherSet':
      return Object.freeze({
        owner: owner.trait.owner,
        acquisitionRole: owner.trait.acquisitionRole,
      });
    default:
      return undefined;
  }
}

/** Map a nested trait-history mutation back to the atomic Room Action that
 * execution publishes. The compiler receives only this already-resolved edge. */
function traitMutationTimelineOwner(
  owner: SemanticAddress,
  acquisitionRole: string,
  acquisitionFrontiers: ReadonlyMap<string, readonly AcquisitionRoleFrontier[]>,
): SemanticAddress {
  const contact = traitMutationAcquisitionContact(owner);
  const acquisitionOwner =
    contact?.owner ??
    (owner.kind === 'incomingReward' ||
    owner.kind === 'localReward' ||
    owner.kind === 'rewardWheelOffer' ||
    owner.kind === 'shopOffer' ||
    owner.kind === 'encounterPhase' ||
    owner.kind === 'gorgonPhase' ||
    owner.kind === 'acquisitionEntry'
      ? owner
      : undefined);
  if (acquisitionOwner !== undefined) {
    const address = createAcquisitionRoleAddress(
      acquisitionOwner,
      contact?.acquisitionRole ?? acquisitionRole,
    );
    const timelineOwners = new Map<string, SemanticAddress>();
    for (const frontier of acquisitionFrontiers.get(semanticAddressKey(address)) ?? []) {
      if (frontier.timelineOwner !== undefined)
        timelineOwners.set(semanticAddressKey(frontier.timelineOwner), frontier.timelineOwner);
    }
    if (timelineOwners.size > 1)
      throw new BiomeRewardSimulationContractError(
        `trait mutation ${semanticAddressKey(owner)} maps to multiple active Room Actions`,
      );
    const timelineOwner = timelineOwners.values().next().value as SemanticAddress | undefined;
    if (timelineOwner !== undefined) return timelineOwner;
  }
  return owner.kind === 'fountainRarityOutcome' ? owner.action : owner;
}

const rewardFacts = createBiomeRewardFacts;

export function evaluateBiomeRewardChronology(
  catalog: Catalog,
  snapshot: BiomeRewardSnapshot,
  history: BiomeRewardHistory,
  routePosition: ResolvedRoutePosition,
  routeLoadout: RouteLoadout,
  initialBranches: readonly RewardBranch[] | undefined = undefined,
  resourcePlacements: ResourcePlacements = EMPTY_RESOURCE_PLACEMENTS,
  resourceFindings: readonly import('../../model').SemanticFinding[] = [],
): BiomeRewardEvaluationAssembly {
  if (snapshot.biomeKey !== history.biomeKey || snapshot.routeKey !== history.routeKey) {
    throw new BiomeRewardSimulationContractError('reward inputs do not share one biome owner');
  }
  const enteredBiomeCount = routePosition.ordinal;
  const fullRunBiomeCount = routePosition.itineraryBiomeKeys.length;
  const prepared = prepareRewardEvaluationInputs(catalog, snapshot, history);
  const { layout, rooms, views, targets, additionalContinuations, hubTargetByOrigin, lifecycle } =
    prepared;
  const authoredSeaStarDuplicateSiteKeys = new Set(
    [...rooms.values()].flatMap((room) =>
      room.kind === 'authored'
        ? Object.keys(room.acquisitionSites).filter(
            (siteKey) => parseSeaStarDuplicateSiteKey(siteKey) !== undefined,
          )
        : [],
    ),
  );
  const chaosGateSourceOccurrenceIds = new Set(
    [...additionalContinuations.values()].flatMap((continuation) =>
      continuation.key === 'chaos' ? [continuation.origin.occurrenceId] : [],
    ),
  );
  const ixionGeneratedChaosSourceOccurrenceIds = new Set(
    [...additionalContinuations.values()].flatMap((continuation) =>
      continuation.key === 'chaos' && continuation.chaosOrigin !== undefined
        ? [continuation.origin.occurrenceId]
        : [],
    ),
  );
  const batchesByParent = prepared.batchesByParent;
  const judgmentArcanaContexts = new Map<
    string,
    import('../../arcana-fear').JudgmentArcanaCandidateCapability
  >();
  const figurineArcanaContexts = new Map<
    string,
    import('../../keepsakes/candidate-artifacts').FigurineArcanaCandidateCapability
  >();
  const keepsakeSelectionContexts = new Map<
    string,
    import('../../keepsakes/candidate-artifacts').KeepsakeSelectionCandidateCapability
  >();
  const keepsakeEquipResultContexts = new Map<
    string,
    import('../../keepsakes/candidate-artifacts').KeepsakeEquipResultCandidateCapability
  >();
  const acquisitionConversionContexts = new Map<string, readonly AcquisitionRoleFrontier[]>();
  const reachedTraitOfferCandidateContexts = new Map<string, TraitOfferCandidateContext[]>();
  const reachedTraitOfferCandidateFingerprints = new Map<string, Set<string>>();
  const derivedAcquisitionEntryContexts = new Map<
    string,
    readonly import('../acquisition/contracts').DerivedAcquisitionEntryFrontier[]
  >();
  const figLeafPhaseCandidates = new Map<string, import('../model').FigLeafPhaseCandidateSupport>();
  const gorgonPhaseCandidates = new Map<string, import('../model').GorgonPhaseCandidateSupport>();
  const nemesisRandomEventCandidates = new Map<
    string,
    import('../model').NemesisRandomEventCandidateSupport
  >();
  const blockedGorgonPhases = new Set<string>();
  let gorgonEvaluationBlocked = false;
  const eligibleGorgonPhases = new Set<string>();
  function recordTraitOfferCandidateContacts(
    contacts: readonly ReachedTraitOfferCandidateContact[] | undefined,
  ): void {
    for (const contact of contacts ?? []) {
      const key = semanticAddressKey(contact.address);
      const fingerprint = JSON.stringify(traitOfferContextIdentity(contact.context));
      const fingerprints = reachedTraitOfferCandidateFingerprints.get(key) ?? new Set<string>();
      if (fingerprints.has(fingerprint)) continue;
      fingerprints.add(fingerprint);
      reachedTraitOfferCandidateFingerprints.set(key, fingerprints);
      const current = reachedTraitOfferCandidateContexts.get(key) ?? [];
      current.push(contact.context);
      reachedTraitOfferCandidateContexts.set(key, current);
    }
  }
  function recordAcquisitionRoleFrontiers(
    frontiers: readonly AcquisitionRoleFrontier[] | undefined,
  ): void {
    for (const frontier of frontiers ?? []) {
      const key = semanticAddressKey(frontier.address);
      acquisitionConversionContexts.set(
        key,
        Object.freeze([...(acquisitionConversionContexts.get(key) ?? []), frontier]),
      );
      recordTraitOfferCandidateContacts(frontier.traitOfferCandidateContacts);
      const replacement = frontier.artificerReplacementCandidate;
      const replacementKey = semanticAddressKey(frontier.artificerReplacementAddress);
      if (replacement !== undefined && !producerFrontiers.has(replacementKey))
        indexRewardProducerFrontier(
          producerFrontiers,
          Object.freeze({
            generationPolicy: 'sequential',
            generationHistorySequence: frontier.historySequence,
            reachableBranchCount: frontier.branchesBeforeRole.length,
            acquisitionHorizon: 'ownEnteredLifecycle',
            owners: Object.freeze([frontier.artificerReplacementAddress]),
            evaluateOffer: (owner: SemanticAddress, offer: ResolvedRewardOffer) =>
              semanticAddressKey(owner) === replacementKey
                ? replacement.evaluateOffer(offer)
                : fail('Artificer replacement frontier received a foreign owner'),
          }),
        );
      const consumerOwner = frontier.timelineOwner;
      // Optional acquisition actions are guidance until a planner-owned
      // resolution makes them a consequential contact. Blind boxes must be
      // retained for their provider resolution; authored trait/level screens,
      // generated children, and consumed Well effects likewise publish their
      // exact action owner here rather than asking execution to infer it.
      const roleOffer =
        frontier.source.traitOffersByAcquisitionRole?.[frontier.address.acquisitionRole];
      const roleLevel =
        frontier.source.levelResolutionsByAcquisitionRole?.[frontier.address.acquisitionRole];
      const consequential =
        frontier.source.offer.rewardType === 'BlindBoxLoot' ||
        frontier.source.producer !== undefined;
      if (consequential && consumerOwner === undefined)
        throw new BiomeRewardSimulationContractError(
          `reached acquisition ${semanticAddressKey(frontier.address)} has no active Room Action owner`,
        );
      if (consumerOwner === undefined) continue;
      if (
        frontier.source.offer.rewardType === 'BlindBoxLoot' ||
        (roleOffer !== undefined && roleOffer !== null) ||
        (roleLevel !== undefined && roleLevel !== null) ||
        frontier.source.producer !== undefined
      )
        recordTimelineNode(consumerOwner, true);
      for (const mutation of frontier.priorTraitMutations ?? [])
        recordTimelineDependency(
          consumerOwner,
          traitMutationTimelineOwner(
            mutation.owner,
            mutation.acquisitionRole,
            acquisitionConversionContexts,
          ),
        );
      const producer = frontier.source.producer;
      if (producer === undefined) continue;
      if (producer.sourceTimelineOwner !== undefined)
        recordTimelineDependency(consumerOwner, producer.sourceTimelineOwner);
    }
  }
  function recordDerivedAcquisitionEntryFrontiers(
    frontiers:
      readonly import('../acquisition/contracts').DerivedAcquisitionEntryFrontier[] | undefined,
  ): void {
    const incomingByOwner = new Map<
      string,
      import('../acquisition/contracts').DerivedAcquisitionEntryFrontier[]
    >();
    for (const frontier of frontiers ?? []) {
      const key = semanticAddressKey(frontier.inventoryOwner ?? frontier.address);
      incomingByOwner.set(key, [...(incomingByOwner.get(key) ?? []), frontier]);
    }
    for (const [key, incoming] of incomingByOwner) {
      const firstIncoming = incoming[0];
      const completeIncomingCohort =
        firstIncoming !== undefined && incoming.length === firstIncoming.branchCohortSize;
      const combined = Object.freeze(
        completeIncomingCohort
          ? incoming
          : [...(derivedAcquisitionEntryContexts.get(key) ?? []), ...incoming],
      );
      derivedAcquisitionEntryContexts.set(key, combined);
      const first = combined[0];
      if (first?.kind === 'travelDealRefill' && first.address.site.owner.kind === 'occurrence') {
        const origin = first.address.site.owner;
        const host = rooms.get(semanticAddressKey(origin));
        const authoredEntry =
          host?.kind === 'authored'
            ? host.entryState?.kind === 'shop'
              ? host.entryState.travelDealRefill
              : undefined
            : undefined;
        if (authoredEntry !== undefined) {
          const realizationOwner = createTravelDealRefillRealizationAddress(
            createBiomeAddress(origin.routeKey, origin.biomeKey),
            origin.occurrenceId,
          );
          recordTimelineNode(realizationOwner, true);
          const replacementAction =
            host?.kind === 'authored'
              ? host.roomActionRoster.rows.find(
                  (row) =>
                    !row.stale &&
                    row.rank !== null &&
                    row.reference.kind === 'interactAcquisitionEntry' &&
                    row.reference.siteKey === first.address.site.pointKey &&
                    row.reference.entryKey === first.address.entryKey,
                )
              : undefined;
          if (replacementAction !== undefined)
            recordTimelineDependency(replacementAction.owner, realizationOwner);
        }
      }
      if (
        (first?.kind !== 'travelDealRefill' &&
          first?.kind !== 'acquisitionResolvedReward' &&
          first?.kind !== 'echoDoubleShopReward') ||
        combined.length !== first.branchCohortSize ||
        combined.some((candidate) => candidate.evaluateOffer === undefined) ||
        producerFrontiers.has(key)
      )
        continue;
      recordAcquisitionRoleFrontiers(
        combined.flatMap((candidate) => candidate.roleFrontiers ?? Object.freeze([])),
      );
      indexRewardProducerFrontier(
        producerFrontiers,
        Object.freeze({
          generationPolicy:
            first.kind === 'travelDealRefill'
              ? ('jointShopInventory' as const)
              : ('sequential' as const),
          generationHistorySequence: Math.max(
            ...combined.flatMap((candidate) =>
              candidate.branchesBeforeEntry.map((branch) => branch.processedThroughHistorySequence),
            ),
          ),
          reachableBranchCount: combined.length,
          acquisitionHorizon:
            first.kind === 'travelDealRefill' ||
            (first.kind === 'echoDoubleShopReward' && first.fixedReward !== undefined)
              ? ('generationOnly' as const)
              : ('ownEnteredLifecycle' as const),
          owners: Object.freeze([first.inventoryOwner ?? first.address]),
          evaluateOffer: (owner: SemanticAddress, offer: ResolvedRewardOffer) => {
            if (semanticAddressKey(owner) !== key)
              return fail('derived acquisition frontier received a foreign owner');
            const results = combined.map((candidate) => candidate.evaluateOffer!(offer));
            return Object.freeze({
              findings: Object.freeze(results.flatMap((result) => result.findings)),
              supported: results.every((result) => result.supported),
            });
          },
          ...(first.evaluateShopOption === undefined
            ? {}
            : {
                evaluateShopOption: (
                  _owner: SemanticAddress,
                  selection: import('../../../reward-kernel').ShopOptionSelection,
                ) => {
                  const results = combined.map((candidate) =>
                    candidate.evaluateShopOption!(selection),
                  );
                  return Object.freeze({
                    findings: Object.freeze(results.flatMap((result) => result.findings)),
                    supported: results.every((result) => result.supported),
                  });
                },
              }),
        }),
      );
    }
  }

  // A Hub replaces its source's zero-target terminal envelope. Its source
  // still reaches an outgoing lifecycle checkpoint, but that checkpoint
  // creates the Hub rather than a normal reward batch.
  const hubTakeoverSources = new Set(
    snapshot.decisions
      .filter(
        (decision): decision is Extract<CanonicalDecision, { readonly kind: 'hub' }> =>
          decision.kind === 'hub',
      )
      .map((decision) => semanticAddressKey(decision.source.origin)),
  );
  // Hub visit targets and their entered local rooms restore to an existing
  // parent rather than generating another ordinary decision. Their outgoing
  // checkpoints must still advance reward history without inventing a batch.
  const activeHubVisit = prepared.activeHubVisit;
  const hubRestoringSources = new Set([
    ...snapshot.decisions
      .filter(
        (decision): decision is Extract<CanonicalDecision, { readonly kind: 'hub' }> =>
          decision.kind === 'hub',
      )
      .flatMap((decision) =>
        decision.visits.flatMap((visit) => [
          semanticAddressKey(visit.target.room.origin),
          ...visit.enteredLocalRooms.map((room) => semanticAddressKey(room.origin)),
        ]),
      ),
    ...(activeHubVisit === undefined
      ? []
      : [
          semanticAddressKey(activeHubVisit.target.room.origin),
          ...activeHubVisit.enteredLocalRooms.map((room) => semanticAddressKey(room.origin)),
        ]),
  ]);
  const frontierSource =
    snapshot.kind === 'biomePrefix' && snapshot.frontier?.kind === 'exitDecision'
      ? semanticAddressKey(snapshot.frontier.parent.origin)
      : undefined;
  const expectedStores = new Map<string, string | undefined>();
  const storeSupportEntries: RewardStoreSupportEntry[] = [];
  const targetHistoryByOrigin = new Map<string, TargetRewardHistoryCheckpoint>();
  const targetGenerationByParent = new Map<string, TargetGenerationFrontier>();
  const findings = new Map<string, FindingRegionEntry>();
  const timelineFactNodes = new Map<string, PlannerTimelineNode>();
  const timelineFactDependencies = new Map<string, PlannerTimelineDependency>();
  const wellRefillRealizations = new Map<string, WellRefillRealization>();
  const bossArcanaOutcomes = new Map<string, import('../model').BossArcanaOutcome>();
  const recordTimelineNode = (owner: SemanticAddress, included: boolean): void => {
    const key = semanticAddressKey(owner);
    const current = timelineFactNodes.get(key);
    if (current === undefined) timelineFactNodes.set(key, Object.freeze({ owner, included }));
    else if (included && !current.included)
      timelineFactNodes.set(
        key,
        Object.freeze({
          owner: current.owner,
          included: current.included || included,
        }),
      );
  };
  const recordTimelineDependency = (owner: SemanticAddress, afterOwner: SemanticAddress): void => {
    const ownerKey = semanticAddressKey(owner);
    const afterKey = semanticAddressKey(afterOwner);
    if (ownerKey === afterKey) return;
    timelineFactDependencies.set(
      `${ownerKey}\u0000${afterKey}`,
      Object.freeze({ owner, afterOwner }),
    );
  };
  const recordTimelineFacts = (
    facts:
      | {
          readonly nodes?: readonly PlannerTimelineNode[];
          readonly dependencies?: readonly PlannerTimelineDependency[];
        }
      | undefined,
  ): void => {
    for (const node of facts?.nodes ?? []) recordTimelineNode(node.owner, node.included);
    for (const dependency of facts?.dependencies ?? [])
      recordTimelineDependency(dependency.owner, dependency.afterOwner);
  };
  const purgingPoolAssessments = new Map<
    string,
    {
      readonly origin: import('../../../authored-project/addresses').OccurrenceAddress;
      readonly assessments: readonly PurgingPoolAssessment[];
    }
  >();
  const hermesShrineAssessments = new Map<
    string,
    {
      readonly origin: import('../../../authored-project/addresses').OccurrenceAddress;
      readonly assessments: readonly HermesShrineCandidateContext[];
    }
  >();
  const stygianWellAssessments = new Map<
    string,
    {
      readonly origin: import('../../../authored-project/addresses').OccurrenceAddress;
      readonly assessments: readonly StygianWellCandidateContext[];
    }
  >();
  const hermesShrineTravelDealRefills = new Map<
    string,
    readonly import('../../commerce/hermes-shrine').HermesShrineTravelDealRefillAssessment[]
  >();
  const hermesShrineTravelDealRefillValid = new Map<string, boolean>();
  // The handler's FirstSpeedUpPurchase guard belongs to the Shrine room, not
  // to a branch.  We still require Travel Deal to agree across every branch
  // at that first action prefix before publishing a refill generation.
  const firstRushedInitialGenerationByShrine = new Set<string>();
  const producerFrontiers = new Map<string, RewardProducerFrontier>();
  const shipLifecycleContexts = new Map<string, ShipLifecycleCandidateContext>();
  const runStateSnapshotsByOwner = new Map<string, RunStateSnapshot>();
  const traitChildSettlementBuilders = new Map<
    string,
    {
      readonly address: SemanticAddress;
      readonly occurrenceOwner: SemanticAddress;
      readonly branches: RewardBranchState[];
      readonly candidateContexts: TraitOfferCandidateContext[];
      readonly runStateSnapshots: Map<string, RunStateSnapshot>;
    }
  >();
  const steadyGrowthCandidateContexts = new Map<string, ReachedSteadyGrowthThreshold[]>();
  const steadyGrowthOutcomeAddresses = new Map<string, SteadyGrowthOutcomeAddress>();
  const transcendentEmbryoCandidateContexts = new Map<
    string,
    ReachedTranscendentEmbryoThreshold[]
  >();
  const transcendentEmbryoOutcomeAddresses = new Map<string, TranscendentEmbryoOutcomeAddress>();
  const fountainRarityCandidateContexts = new Map<
    string,
    import('../../keepsakes/candidate-artifacts').FountainRarityCandidateCapability
  >();
  function recordTraitChildSettlements(
    checkpoints: readonly ReachedTraitChildCheckpoint[] | undefined,
    occurrenceOwner: SemanticAddress,
  ): void {
    for (const checkpoint of checkpoints ?? []) {
      const key = semanticAddressKey(checkpoint.address);
      const current = traitChildSettlementBuilders.get(key);
      if (current === undefined)
        traitChildSettlementBuilders.set(key, {
          address: checkpoint.address,
          occurrenceOwner,
          branches: [checkpoint.branch],
          candidateContexts:
            checkpoint.candidateContext === undefined ? [] : [checkpoint.candidateContext],
          runStateSnapshots: new Map(),
        });
      else {
        current.branches.push(checkpoint.branch);
        if (checkpoint.candidateContext !== undefined)
          current.candidateContexts.push(checkpoint.candidateContext);
      }
    }
  }
  const hubDecisionsBySource = new Map(
    snapshot.decisions
      .filter(
        (decision): decision is Extract<CanonicalDecision, { readonly kind: 'hub' }> =>
          decision.kind === 'hub',
      )
      .map((decision) => [semanticAddressKey(decision.source.origin), decision]),
  );
  let peers: readonly OfferProcessingPeer[] = Object.freeze([]);
  let branches: readonly RewardBranchState[] = initializeRewardBranches(
    initialBranches,
    initialBranches === undefined ? createArcanaFearState(catalog, routeLoadout) : undefined,
    catalog,
    routeLoadout.startingKeepsakeKey,
    routeLoadout.keepsakeEquipResults,
    snapshot.routeKey,
    routeLoadout,
    { routePosition, historyView: history.biomeStart },
  );
  const echoKeepsakeReplay = createEchoKeepsakeReplayAddress(
    createBiomeAddress(snapshot.routeKey, snapshot.biomeKey),
  );
  const echoHammerResult = createKeepsakeEquipResultAddress(
    echoKeepsakeReplay,
    'experimentalHammer',
  );
  const echoEmbryoResult = createKeepsakeEquipResultAddress(
    echoKeepsakeReplay,
    'transcendentEmbryo',
  );
  let echoKeepsakeReplayOutcome: BiomeRewardSimulation['volatileEchoKeepsakeReplay'];
  const biomeStartSequence = history.events[0]?.sequence ?? 0;
  const giftStates = branches.map((branch) => {
    const gift = branch.state.traitHistory.equippedTraits.EchoRepeatKeepsakeBoon;
    return gift?.echoRepeatedKeepsakeKey === undefined || gift.acquisitionIdentity === undefined
      ? undefined
      : Object.freeze({
          capturedKeepsakeKey: gift.echoRepeatedKeepsakeKey,
          acquisitionIdentity: gift.acquisitionIdentity,
          replayCount: gift.echoKeepsakeReplayCount ?? 0,
        });
  });
  if (giftStates.some((state) => JSON.stringify(state) !== JSON.stringify(giftStates[0])))
    throw new BiomeRewardSimulationContractError(
      'Echo keepsake replay frontier is divergent across surviving branches',
    );
  const giftState = giftStates[0];
  if (giftState !== undefined) {
    const declaration = catalog.keepsakes.byKey[giftState.capturedKeepsakeKey];
    if (declaration?.echoGift.availability !== 'eligible')
      throw new BiomeRewardSimulationContractError(
        `Echo captured ineligible keepsake ${giftState.capturedKeepsakeKey}`,
      );
    const replayEffect = declaration.echoGift.effect;
    if (
      replayEffect.kind === 'experimentalHammer' &&
      new Set(branches.map((branch) => branch.state.keepsakes.currentKey)).size !== 1
    )
      throw new BiomeRewardSimulationContractError(
        'Echo Experimental Hammer replay frontier has divergent current keepsakes',
      );
    const recordReplay = (branch: RewardBranchState): RewardBranchState => {
      const before = branch.state.traitHistory;
      const traitHistory = foldTraitHistoryEvents(catalog, [
        ...before.events,
        Object.freeze({
          kind: 'echoKeepsakeReplay' as const,
          owner: echoKeepsakeReplay,
          acquisitionRole: 'echoKeepsakeReplay' as const,
          sequence: biomeStartSequence,
          acquisitionPoint: 'biomeStart' as const,
          traitKey: 'EchoRepeatKeepsakeBoon' as const,
          acquisitionIdentity: giftState.acquisitionIdentity,
          capturedKeepsakeKey: giftState.capturedKeepsakeKey,
        }),
      ]);
      return Object.freeze({
        ...branch,
        state: replaceSimulationTraitHistory(branch.state, traitHistory),
      });
    };
    if (replayEffect.kind === 'figLeaf' && giftState.replayCount === 0) {
      branches = Object.freeze(
        branches.map((branch) =>
          recordReplay(
            Object.freeze({
              ...branch,
              state: Object.freeze({
                ...branch.state,
                keepsakes: applyEchoFigLeafReplay(branch.state.keepsakes),
              }),
            }),
          ),
        ),
      );
    } else if (replayEffect.kind === 'crystalFigurine') {
      // Echo can recreate the captured keepsake's Common Figurine source at
      // the start of every biome once the previous source has been consumed.
      // The keepsake state owns the no-duplicate and consumed-source rules;
      // this boundary only records the replay event for branches it changes.
      const replayedBranches = branches.map((branch) => {
        const keepsakes = applyEchoFigurineReplay(
          catalog,
          branch.state.keepsakes,
          giftState.capturedKeepsakeKey,
        );
        return keepsakes === branch.state.keepsakes
          ? branch
          : recordReplay(
              Object.freeze({
                ...branch,
                state: Object.freeze({ ...branch.state, keepsakes: keepsakes }),
              }),
            );
      });
      branches = Object.freeze(replayedBranches);
    } else if (replayEffect.kind === 'concaveStone') {
      const replayedBranches = branches.map((branch) => {
        const keepsakes = applyEchoConcaveStoneReplay(
          catalog,
          branch.state.keepsakes,
          giftState.capturedKeepsakeKey,
        );
        return keepsakes === branch.state.keepsakes
          ? branch
          : recordReplay(
              Object.freeze({
                ...branch,
                state: Object.freeze({ ...branch.state, keepsakes: keepsakes }),
              }),
            );
      });
      branches = Object.freeze(replayedBranches);
    } else if (replayEffect.kind === 'olympianRewardPressure') {
      const replayedBranches = branches.map((branch) => {
        const keepsakes = applyEchoOlympianRewardPressureReplay(
          catalog,
          branch.state.keepsakes,
          giftState.capturedKeepsakeKey,
        );
        return keepsakes === branch.state.keepsakes
          ? branch
          : recordReplay(
              applyOlympianRewardPressureEquip(
                catalog,
                Object.freeze({
                  ...branch,
                  state: Object.freeze({ ...branch.state, keepsakes: keepsakes }),
                }),
                giftState.capturedKeepsakeKey,
              ),
            );
      });
      branches = Object.freeze(replayedBranches);
    } else if (
      replayEffect.kind === 'moonBeam' &&
      giftState.replayCount === 0 &&
      branches[0]?.state.keepsakes.currentKey !== giftState.capturedKeepsakeKey
    ) {
      const precedingPostbossWasBigPath =
        routePosition.previousPostbossRoomGameName === 'H_PostBoss01' ||
        routePosition.previousPostbossRoomGameName === 'P_PostBoss01';
      branches = Object.freeze(
        branches.map((branch) =>
          recordReplay(
            applyMoonBeamEquip(
              catalog,
              branch,
              giftState.capturedKeepsakeKey,
              'Common',
              precedingPostbossWasBigPath,
            ),
          ),
        ),
      );
    } else if (
      replayEffect.kind === 'transcendentEmbryo' &&
      giftState.replayCount === 0 &&
      branches.every((branch) => branch.state.keepsakes.transcendentEmbryo === undefined)
    ) {
      const effect = catalog.keepsakes.byKey[giftState.capturedKeepsakeKey]?.effect;
      if (effect?.kind !== 'transcendentEmbryo')
        throw new BiomeRewardSimulationContractError(
          'Echo Transcendent Embryo replay has no rank data',
        );
      keepsakeEquipResultContexts.set(
        semanticAddressKey(echoEmbryoResult),
        Object.freeze({
          frontiers: Object.freeze(
            branches.map((branch) =>
              Object.freeze({
                state: branch.state,
                transcendentEmbryoRarity: effect.blessingRarityByRank.Common,
              }),
            ),
          ),
        }),
      );
      const authored = snapshot.echoKeepsakeReplayResults?.transcendentEmbryo;
      if (authored === undefined) {
        addRewardFinding(
          findings,
          rewardFinding('keepsakeEquipResultMissing', echoEmbryoResult, {
            keepsakeKey: giftState.capturedKeepsakeKey,
          }),
          ownerRegion(echoKeepsakeReplay),
          Object.freeze({ kind: 'history', sequence: biomeStartSequence, boundary: 'at' }),
        );
      } else if (
        branches.some(
          (branch) =>
            !assessTranscendentEmbryoBlessing(
              catalog,
              authored,
              branch.state.traitHistory,
              effect.blessingRarityByRank.Common,
              { ...routeLoadout, routeKey: echoEmbryoResult.routeKey },
            ).legal,
        )
      ) {
        addRewardFinding(
          findings,
          rewardFinding('keepsakeEquipResultUnavailable', echoEmbryoResult, {
            keepsakeKey: giftState.capturedKeepsakeKey,
          }),
          ownerRegion(echoKeepsakeReplay),
          Object.freeze({ kind: 'history', sequence: biomeStartSequence, boundary: 'at' }),
        );
      } else {
        branches = Object.freeze(
          branches.map((branch) =>
            recordReplay(
              applyTranscendentEmbryoEquipResult(
                catalog,
                branch,
                giftState.capturedKeepsakeKey,
                authored,
                echoEmbryoResult,
                biomeStartSequence,
                'echo',
                'Common',
                routeLoadout,
              ),
            ),
          ),
        );
        echoKeepsakeReplayOutcome = Object.freeze({
          capturedKeepsakeKey: giftState.capturedKeepsakeKey,
          result: Object.freeze({
            kind: 'transcendentEmbryo' as const,
            value: Object.freeze({
              blessingKey: authored.blessingKey,
              blessingValues: Object.freeze({ ...authored.blessingValues }),
            }),
          }),
        });
        recordTimelineNode(echoKeepsakeReplay, true);
      }
    } else if (
      replayEffect.kind === 'experimentalHammer' &&
      giftState.replayCount === 0 &&
      branches[0]?.state.keepsakes.currentKey !== giftState.capturedKeepsakeKey
    ) {
      keepsakeEquipResultContexts.set(
        semanticAddressKey(echoHammerResult),
        Object.freeze({
          frontiers: Object.freeze(
            branches.map((branch) => Object.freeze({ state: branch.state })),
          ),
        }),
      );
      const authored = snapshot.echoKeepsakeReplayResults?.experimentalHammer;
      if (authored === undefined) {
        addRewardFinding(
          findings,
          rewardFinding('keepsakeEquipResultMissing', echoHammerResult, {
            keepsakeKey: giftState.capturedKeepsakeKey,
          }),
          ownerRegion(echoKeepsakeReplay),
          Object.freeze({ kind: 'history', sequence: biomeStartSequence, boundary: 'at' }),
        );
      } else if (
        branches.some(
          (branch) => !assessExperimentalHammerEquipResult(catalog, authored, branch.state).legal,
        )
      ) {
        addRewardFinding(
          findings,
          rewardFinding('keepsakeEquipResultUnavailable', echoHammerResult, {
            keepsakeKey: giftState.capturedKeepsakeKey,
          }),
          ownerRegion(echoKeepsakeReplay),
          Object.freeze({ kind: 'history', sequence: biomeStartSequence, boundary: 'at' }),
        );
      } else {
        branches = Object.freeze(
          branches.map((branch) =>
            recordReplay(
              applyExperimentalHammerEquipResult(
                catalog,
                branch,
                giftState.capturedKeepsakeKey,
                snapshot.echoKeepsakeReplayResults,
                echoHammerResult,
                biomeStartSequence,
                'Common',
              ),
            ),
          ),
        );
        echoKeepsakeReplayOutcome = Object.freeze({
          capturedKeepsakeKey: giftState.capturedKeepsakeKey,
          result: Object.freeze({
            kind: 'experimentalHammer' as const,
            value: Object.freeze({ ...authored }),
          }),
        });
        recordTimelineNode(echoKeepsakeReplay, true);
      }
    } else if (replayEffect.kind === 'callingCard') {
      const charges = catalog.keepsakes.byKey[giftState.capturedKeepsakeKey]?.effect;
      if (charges?.kind !== 'callingCard')
        throw new BiomeRewardSimulationContractError('Echo Calling Card replay has no rank data');
      branches = Object.freeze(
        branches.map((branch) =>
          recordReplay(
            Object.freeze({
              ...branch,
              state: Object.freeze({
                ...branch.state,
                keepsakes: applyEchoCallingCardReplay(
                  branch.state.keepsakes,
                  charges.rarificationChargesByRank.Common,
                ),
              }),
            }),
          ),
        ),
      );
    } else if (replayEffect.kind === 'timePiece') {
      const charges = catalog.keepsakes.byKey[giftState.capturedKeepsakeKey]?.effect;
      if (charges?.kind !== 'timePiece')
        throw new BiomeRewardSimulationContractError('Echo Time Piece replay has no rank data');
      branches = Object.freeze(
        branches.map((branch) =>
          recordReplay(
            Object.freeze({
              ...branch,
              state: Object.freeze({
                ...branch.state,
                keepsakes: applyEchoTimePieceReplay(
                  branch.state.keepsakes,
                  charges.conversionChargesByRank.Common,
                ),
              }),
            }),
          ),
        ),
      );
    }
  }
  let pendingHubBoard: PendingHubBoardGeneration | undefined;
  const hubDepartures: HubDepartureRunState[] = [];
  // A Hub interval ends at its departure: Hub exit or a visit's return, then any fountain use.
  const recordHubDeparture = (origin: HubRoomAddress, sequence: number, replace: boolean) => {
    const room = rooms.get(semanticAddressKey(origin));
    const view = history.viewsBySequence[sequence];
    if (room?.kind !== 'hub' || view === undefined || branches.length === 0) return;
    const hub = createHubDecisionAddress(
      createBiomeAddress(origin.routeKey, origin.biomeKey),
      origin.hubKey,
    );
    const departure = runStateAt(hub, room, view)(branches);
    if (departure === undefined) return;
    const previous = hubDepartures.at(-1);
    if (replace) {
      if (previous === undefined)
        throw new BiomeRewardSimulationContractError(
          `${room.gameName} fountain use has no Hub interval`,
        );
      hubDepartures[hubDepartures.length - 1] = Object.freeze({ ...previous, departure });
      return;
    }
    hubDepartures.push(
      Object.freeze({
        hub,
        precedingVisitCount: previous === undefined ? 0 : previous.precedingVisitCount + 1,
        departure,
      }),
    );
  };
  const runStateDerivationCache = createRunStateDerivationCache();

  function runStateAt(
    owner: RunStateSnapshot['owner'],
    source: CanonicalRewardSource,
    view: HistoryStateView,
  ) {
    const declaration = catalog.rooms.byKey[source.gameName];
    if (declaration === undefined) {
      throw new BiomeRewardSimulationContractError(
        `${source.gameName} has no declaration for run-state snapshot`,
      );
    }
    const currentShopNames = visibleStoreOptionNames(
      source,
      hermesShrineAssessments.get(semanticAddressKey(source.origin))?.assessments,
    );
    // One token represents this exact rewardFacts closure: current/source room,
    // declaration, immutable view, shop names and peer context. Branch-varying
    // facts have separate cache identities, and the reached route position
    // travels inside each snapshot. This token cannot alias a later checkpoint
    // even when it retains the same history.
    const factsContextToken = Object.freeze({});
    const snapshotFor = (checkpointBranches: readonly RewardBranchState[]) =>
      createRunState({
        catalog,
        layout,
        owner,
        states: checkpointBranches.map((branch) =>
          reachSimulationHistory(branch.state, routePosition, view),
        ),
        derivationCache: runStateDerivationCache,
        factsContextToken,
        rewardFacts: (state) =>
          rewardFacts({
            catalog,
            state,
            source,
            currentRoom: source,
            sourceDeclaration: declaration,
            view,
            currentRoomShopOptionNames: currentShopNames,
            peerParentOrigin: source.origin,
            peerCreationSource: 'generatedTarget',
            hubBoardLookups: 'consulted',
          }),
      });
    return snapshotFor;
  }

  function captureRunState(
    owner: RunStateSnapshot['owner'],
    source: CanonicalRewardSource,
    view: HistoryStateView,
    checkpointBranches: readonly RewardBranchState[] = branches,
  ): void {
    const ownerKey = semanticAddressKey(owner);
    if (runStateSnapshotsByOwner.has(ownerKey) || branches.length === 0) return;
    const snapshotFor = runStateAt(owner, source, view);
    const snapshot = snapshotFor(checkpointBranches);
    if (snapshot !== undefined) runStateSnapshotsByOwner.set(ownerKey, snapshot);
    // Trait-child candidate checkpoints retain only generation snapshots. Room
    // lifecycle diagnostics are occurrence-local and never become a later
    // candidate-generation authority.
    if (owner.kind === 'roomRunStateCheckpoint') return;
    for (const checkpoint of traitChildSettlementBuilders.values()) {
      if (
        semanticAddressKey(checkpoint.occurrenceOwner) !== semanticAddressKey(source.origin) ||
        checkpoint.runStateSnapshots.has(ownerKey)
      )
        continue;
      const checkpointSnapshot = snapshotFor(checkpoint.branches);
      if (checkpointSnapshot !== undefined)
        checkpoint.runStateSnapshots.set(ownerKey, checkpointSnapshot);
    }
  }

  function recordTargetSlotHistory(
    origin: TargetAddress,
    historySequence: number,
    checkpointBranches: readonly RewardBranchState[] = branches,
  ): void {
    if (checkpointBranches.length === 0) {
      return;
    }
    const view = history.viewsBySequence[historySequence];
    if (view === undefined) {
      throw new BiomeRewardSimulationContractError(
        `No history view for target checkpoint ${historySequence}`,
      );
    }
    targetHistoryByOrigin.set(
      semanticAddressKey(origin),
      Object.freeze({
        origin,
        historySequence,
        states: Object.freeze(
          checkpointBranches.map((branch) =>
            reachSimulationHistory(branch.state, routePosition, view),
          ),
        ),
      }),
    );
  }

  function recordBlankFrontierTargetHistory(): void {
    const frontier = snapshot.kind === 'biomePrefix' ? snapshot.frontier : undefined;
    if (frontier?.kind !== 'exitDecision' || frontier.parent.origin.kind !== 'occurrence') {
      return;
    }
    const source = rooms.get(semanticAddressKey(frontier.parent.origin));
    const declaration = source === undefined ? undefined : catalog.rooms.byKey[source.gameName];
    if (source === undefined || declaration === undefined) {
      throw new BiomeRewardSimulationContractError(
        `${semanticAddressKey(frontier.origin)} has no reward-history frontier source`,
      );
    }
    const exitKeys =
      layout.progression.kind === 'hub'
        ? semanticAddressKey(frontier.parent.origin) ===
          semanticAddressKey(snapshot.entryRoom.origin)
          ? Object.freeze([layout.progression.entry.exitKey])
          : Object.freeze([])
        : Object.freeze(
            [...declaration.exits]
              .sort((left, right) => left.index - right.index)
              .map((exit) => `exit${exit.index}`),
          );
    const nextExitKey = exitKeys[frontier.targets.length];
    const historySequence = history.events.at(-1)?.sequence;
    if (nextExitKey === undefined || historySequence === undefined) {
      return;
    }
    const origin = createTargetAddress(
      createBiomeAddress(frontier.origin.routeKey, frontier.origin.biomeKey),
      frontier.origin.source,
      nextExitKey,
    );
    if (!targetHistoryByOrigin.has(semanticAddressKey(origin))) {
      recordTargetSlotHistory(origin, historySequence);
    }
  }

  function applyAuthoredSiteSettlementResult(
    result: AuthoredSiteSettlementResult,
    occurrenceOwner: SemanticAddress,
  ): void {
    for (const entry of result.emissions.findings) {
      const evaluations = entry.levelResolutionEvaluations ?? [];
      if (evaluations.length === 0)
        addRewardFinding(findings, entry.finding, entry.atomicRegion, entry.chronology);
      for (const evaluation of evaluations)
        addRewardFinding(findings, entry.finding, entry.atomicRegion, entry.chronology, evaluation);
    }
    recordAcquisitionRoleFrontiers(result.emissions.acquisitionRoleFrontiers);
    recordTimelineFacts(result.emissions.timelineFacts);
    recordDerivedAcquisitionEntryFrontiers(result.emissions.derivedEntryFrontiers);
    recordTraitChildSettlements(result.emissions.traitChildSettlements, occurrenceOwner);
    for (const frontier of result.producerFrontiers)
      indexRewardProducerFrontier(producerFrontiers, frontier);
  }

  function flushPendingHubBoard(): void {
    const flushed = flushHubBoard(catalog, pendingHubBoard);
    if (flushed === undefined) return;
    if (
      layout.progression.kind === 'hub' &&
      pendingHubBoard !== undefined &&
      flushed.peers.length === pendingHubBoard.participants.length &&
      flushed.branches.length > 0
    ) {
      const lookupKey = layout.progression.rewardLookup.key;
      branches = Object.freeze(
        flushed.branches.map((branch) =>
          Object.freeze({
            ...branch,
            state: addHubBoardRewardLookup(
              branch.state,
              lookupKey,
              flushed.peers.map((peer) => peer.offer.rewardType),
            ),
          }),
        ),
      );
    } else {
      branches = flushed.branches;
    }
    peers = flushed.peers;
    for (const entry of flushed.findings)
      addRewardFinding(findings, entry.finding, entry.atomicRegion, entry.chronology);
    for (const frontier of flushed.producerFrontiers)
      indexRewardProducerFrontier(producerFrontiers, frontier);
    pendingHubBoard = undefined;
  }

  function reachHistorySequence(sequence: number): void {
    const view = history.viewsBySequence[sequence];
    if (view === undefined) {
      throw new BiomeRewardSimulationContractError(`No history view for event ${sequence}`);
    }
    branches = Object.freeze(
      branches.map((branch) =>
        Object.freeze({
          ...branch,
          state: reachSimulationHistory(branch.state, routePosition, view),
        }),
      ),
    );
  }

  historyEvents: for (const event of history.events) {
    if (branches.length === 0) {
      break;
    }
    switch (event.kind) {
      case 'encounterStarted': {
        const room = rooms.get(semanticAddressKey(event.origin));
        if (room?.kind === 'authored' && room.lifecycleProfileKey === 'ShipCombatRoom') {
          const view = views
            .get(semanticAddressKey(event.origin))
            ?.encounterStarts.find((candidate) => candidate.phaseKey === event.phaseKey)?.before;
          if (view === undefined) {
            throw new BiomeRewardSimulationContractError(
              `${room.gameName} ${event.phaseKey} has no pre-encounter Run State view`,
            );
          }
          captureRunState(
            createRoomRunStateCheckpointAddress(room.origin, {
              kind: 'beforeEncounterStart',
              phaseKey: event.phaseKey,
            }),
            room,
            view,
          );
        }
        const figLeafTransition = applyEncounterStartedTransition(
          catalog,
          routePosition,
          snapshot,
          event,
          room?.kind === 'authored' ? room : undefined,
          branches,
        );
        branches = figLeafTransition.branches;
        for (const entry of figLeafTransition.figLeafCandidates)
          figLeafPhaseCandidates.set(entry.key, entry.candidate);
        for (const entry of figLeafTransition.findings)
          addRewardFinding(findings, entry.finding, entry.region, entry.chronology);
        const gorgon = applyGorgonStartedTransition({
          catalog,
          event,
          room: room?.kind === 'authored' ? room : undefined,
          view: room === undefined ? undefined : views.get(semanticAddressKey(room.origin)),
          branches,
          evaluationBlocked: gorgonEvaluationBlocked,
        });
        branches = gorgon.branches;
        if (gorgon.candidate !== undefined)
          gorgonPhaseCandidates.set(gorgon.candidate.key, gorgon.candidate.value);
        if (gorgon.eligiblePhaseKey !== undefined)
          eligibleGorgonPhases.add(gorgon.eligiblePhaseKey);
        break;
      }
      case 'roomEntered': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const entered = applyRoomEnteredTransition(
          catalog,
          event,
          room?.kind === 'authored' ? room : undefined,
          views.get(semanticAddressKey(event.origin)),
          chaosGateSourceOccurrenceIds,
          ixionGeneratedChaosSourceOccurrenceIds,
          branches,
          rewardFindingChronologyForRoom(
            snapshot,
            event.origin as CanonicalAuthoredRoom['origin'],
            event.sequence,
            'localRoomLifecycle',
          ),
          routePosition,
          Object.freeze({
            hermesShrine:
              room?.kind === 'authored' &&
              hermesShrineAssessments.has(semanticAddressKey(room.origin)),
            stygianWell:
              room?.kind === 'authored' &&
              stygianWellAssessments.has(semanticAddressKey(room.origin)),
          }),
        );
        branches = entered.branches;
        for (const entry of entered.findings)
          addRewardFinding(findings, entry.finding, entry.region, entry.chronology);
        recordDerivedAcquisitionEntryFrontiers(entered.derivedAcquisitionEntryFrontiers);
        if (entered.hermesShrineAssessment !== undefined)
          hermesShrineAssessments.set(
            semanticAddressKey(entered.hermesShrineAssessment.origin),
            entered.hermesShrineAssessment,
          );
        if (entered.stygianWellAssessment !== undefined)
          stygianWellAssessments.set(
            semanticAddressKey(entered.stygianWellAssessment.origin),
            entered.stygianWellAssessment,
          );
        if (entered.runStateCheckpoint !== undefined) {
          const { owner, room: checkpointRoom, view } = entered.runStateCheckpoint;
          if (view === undefined) {
            throw new BiomeRewardSimulationContractError(
              `${checkpointRoom.gameName} has no room-entry Run State view`,
            );
          }
          captureRunState(owner, checkpointRoom, view);
        }
        if (entered.hermesShrineDeliveryPlacementRequired) {
          reachHistorySequence(event.sequence);
          break historyEvents;
        }
        break;
      }
      case 'roomPrepared': {
        const room = rooms.get(semanticAddressKey(event.origin));
        if (room?.kind === 'authored')
          for (const finding of fieldsOptionalRewardCountFindings(catalog, room))
            addRewardFinding(
              findings,
              finding,
              ownerRegion(room.origin),
              rewardFindingChronologyForRoom(
                snapshot,
                room.origin,
                event.sequence,
                'localRoomLifecycle',
              ),
            );
        branches = applyRoomPreparedTransition(event, branches);
        break;
      }
      case 'keepsakeRackUsed': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const transition = applyKeepsakeRackUsedTransition(
          catalog,
          event,
          room?.kind === 'authored' ? room : undefined,
          views.get(semanticAddressKey(event.origin))?.entry,
          routeLoadout,
          branches,
          enteredBiomeCount + 1,
        );
        branches = transition.branches;
        recordTimelineFacts(transition.timelineFacts);
        if (transition.keepsakeSelectionCandidate !== undefined)
          keepsakeSelectionContexts.set(
            transition.keepsakeSelectionCandidate.key,
            transition.keepsakeSelectionCandidate.candidate,
          );
        for (const candidate of transition.keepsakeEquipResultCandidates)
          keepsakeEquipResultContexts.set(candidate.key, candidate.candidate);
        for (const finding of transition.findings)
          addRewardFinding(findings, finding.finding, finding.region, finding.chronology);
        break;
      }
      case 'fountainUsed': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const owner = event.owner;
        const transition = applyFountainUsedTransition(
          catalog,
          event,
          owner.kind === 'hubFountain'
            ? snapshot.decisions.find(
                (decision): decision is CanonicalHubDecision =>
                  decision.kind === 'hub' && decision.origin.hubKey === owner.hubKey,
              )?.fountain?.fountainRarityResult
            : room?.kind === 'authored'
              ? room.fountainRarityResult
              : undefined,
          branches,
        );
        branches = transition.branches;
        recordTimelineFacts(transition.timelineFacts);
        if (transition.candidate !== undefined)
          fountainRarityCandidateContexts.set(transition.candidate.key, transition.candidate.value);
        for (const finding of transition.findings)
          addRewardFinding(findings, finding.finding, finding.region, finding.chronology);
        // The fountain unlocks Postboss facilities. Capture the pool only after
        // its rarity effects settle, never from entry or an unresolved Phial.
        if (room?.kind === 'authored' && room.purgingPool?.interacted && branches.length > 0) {
          const assessments = Object.freeze(
            branches.map((branch) =>
              assessPurgingPool(
                catalog,
                room.purgingPool!,
                branch.state.traitHistory.equippedTraits,
              ),
            ),
          );
          purgingPoolAssessments.set(
            semanticAddressKey(room.origin),
            Object.freeze({ origin: room.origin, assessments }),
          );
          for (const assessment of assessments) {
            for (const finding of assessment.findings)
              addRewardFinding(
                findings,
                rewardFinding(
                  finding.code,
                  createRoomFeatureAddress(
                    room.origin,
                    finding.slotKey === undefined
                      ? { kind: 'purgingPoolInventory' }
                      : { kind: 'purgingPoolOffer', slotKey: finding.slotKey },
                  ),
                  {
                    ...finding.evidence,
                    ...(finding.slotKey === undefined ? {} : { slotKey: finding.slotKey }),
                  },
                ),
                ownerRegion(room.origin),
                Object.freeze({ kind: 'history', sequence: event.sequence, boundary: 'after' }),
              );
          }
        }
        break;
      }
      case 'roomCreated': {
        mergeRewardFindingEmissions(
          findings,
          resourcePlacementFindingRegions(event, resourceFindings),
        );
        const transition = applyRoomCreatedTransition({
          catalog,
          snapshot,
          event,
          rooms,
          views,
          targets,
          hubTargetByOrigin,
          additionalContinuations,
          expectedStores,
          hermesShrineAssessments,
          batchesByParent,
          ...('current' in history ? { historyCurrent: history.current } : {}),
          branches,
          peers,
          ...(pendingHubBoard === undefined ? {} : { pendingHubBoard }),
          lifecycle,
          enteredBiomeCount,
          authoredSeaStarDuplicateSiteKeys,
        });
        if (transition.keepsakeSelectionCandidate !== undefined)
          keepsakeSelectionContexts.set(
            transition.keepsakeSelectionCandidate.key,
            transition.keepsakeSelectionCandidate.candidate,
          );
        if (transition.hubRunStateCheckpoint !== undefined)
          captureRunState(
            transition.hubRunStateCheckpoint.owner,
            transition.hubRunStateCheckpoint.source,
            transition.hubRunStateCheckpoint.view,
          );
        for (const entry of transition.findings)
          addRewardFinding(findings, entry.finding, entry.atomicRegion, entry.chronology);
        for (const frontier of transition.producerFrontiers)
          indexRewardProducerFrontier(producerFrontiers, frontier);
        branches = transition.branches;
        peers = transition.peers;
        pendingHubBoard = transition.pendingHubBoard;
        break;
      }
      case 'targetGenerationCompleted': {
        if (
          event.origin.kind === 'hubSlot' &&
          pendingHubBoard?.participants.length === hubTargetByOrigin.size
        ) {
          flushPendingHubBoard();
        }
        const targetGeneration =
          event.origin.kind === 'target'
            ? targetGenerationByParent.get(semanticAddressKey(event.parentOrigin))
            : undefined;
        const transition = applyTargetGenerationCompletedTransition(event, targetGeneration);
        if (transition.nextTargetHistory !== undefined)
          recordTargetSlotHistory(transition.nextTargetHistory, event.sequence);
        branches = advanceRewardBranches(branches, event.sequence);
        // The game rebuilds its offered-reward set once, when the whole batch
        // has rooms and its exits unlock. The completed batch's own generated
        // offers are that set, so nothing reconstructs the rule here: the last
        // generated target simply publishes the peers this batch produced.
        //
        // Only ordinary exit batches publish. Hub slot and local visit slot
        // generations, the hub handoff batch and declaration-fixed room links
        // are deliberately excluded: the hub board has its own run-persistent
        // lookup with a different lifetime, and a fixed link reaches its target
        // without an offered door batch. Extra exits (Chaos gate, Zagreus
        // contract) are created at the parent's entry, so their offers are
        // already flushed from `peers` by this batch's outgoing checkpoint;
        // the game does count those doors, which is a recorded fidelity gap
        // rather than a behavior difference, since no such room offers a type
        // any inventory entry currently consults.
        if (
          event.origin.kind === 'target' &&
          targetGeneration !== undefined &&
          transition.nextTargetHistory === undefined &&
          targetGeneration.exitKeys.at(-1) === event.origin.exitKey
        ) {
          // Normalized once for the whole cohort: every branch of one batch
          // shares the same offered set and therefore the same frozen array.
          const offeredRewardTypes = normalizeOfferedRewardTypes(
            peers.map((peer) => peer.offer.rewardType),
          );
          branches = Object.freeze(
            branches.map((branch) =>
              Object.freeze({
                ...branch,
                state: publishOfferedRewardTypes(branch.state, offeredRewardTypes),
              }),
            ),
          );
        }
        break;
      }
      case 'outgoingGenerationCheckpoint': {
        const ownerKey = semanticAddressKey(event.origin);
        const source = rooms.get(ownerKey);
        const sourceViews = views.get(ownerKey);
        const declaration = source === undefined ? undefined : catalog.rooms.byKey[source.gameName];
        const batch = batchesByParent.get(ownerKey);
        const hubDecisionOwner = hubDecisionsBySource.get(ownerKey)?.origin;
        const frontierOwner =
          frontierSource === ownerKey &&
          snapshot.kind === 'biomePrefix' &&
          snapshot.frontier?.kind === 'exitDecision'
            ? snapshot.frontier.origin
            : undefined;
        const transition = applyOutgoingGenerationTransition({
          catalog,
          snapshot,
          event,
          layout,
          source,
          sourceViews,
          declaration,
          batch,
          hubDecisionOwner,
          frontierOwner,
          emptyOutgoing: lifecycle.emptyOutgoingOwnerKeys.has(ownerKey),
          hubTakeover: hubTakeoverSources.has(ownerKey),
          hubRestoring: hubRestoringSources.has(ownerKey),
          branches,
          authoredSeaStarDuplicateSiteKeys,
        });
        for (const settlement of transition.siteSettlements)
          applyAuthoredSiteSettlementResult(settlement, source?.origin ?? event.origin);
        if (transition.runStateCheckpoint !== undefined)
          captureRunState(
            transition.runStateCheckpoint.owner,
            transition.runStateCheckpoint.source,
            transition.runStateCheckpoint.view,
            transition.runStateCheckpoint.branches,
          );
        if (transition.targetGeneration !== undefined)
          targetGenerationByParent.set(
            transition.targetGeneration.parentKey,
            transition.targetGeneration.frontier,
          );
        if (transition.targetHistoryCheckpoint !== undefined)
          recordTargetSlotHistory(
            transition.targetHistoryCheckpoint.origin,
            transition.targetHistoryCheckpoint.historySequence,
            transition.targetHistoryCheckpoint.branches,
          );
        for (const entry of transition.storeSupportEntries) storeSupportEntries.push(entry);
        for (const entry of transition.expectedStores)
          expectedStores.set(entry.targetKey, entry.storeKey);
        for (const entry of transition.findings)
          addRewardFinding(findings, entry.finding, entry.atomicRegion, entry.chronology);
        branches = transition.branches;
        peers = transition.peers;
        break;
      }
      case 'offerPointMaterialized': {
        const roomKey = semanticAddressKey(event.origin);
        const transition = applyOfferPointMaterializedTransition({
          catalog,
          snapshot,
          event,
          rooms,
          views,
          lifecycle,
          branches,
          routeLoadout,
          authoredSeaStarDuplicateSiteKeys,
          shipLifecycleCandidateAlreadyPublished: shipLifecycleContexts.has(roomKey),
        });
        for (const entry of transition.findings)
          addRewardFinding(findings, entry.finding, entry.atomicRegion, entry.chronology);
        for (const frontier of transition.producerFrontiers)
          indexRewardProducerFrontier(producerFrontiers, frontier);
        if (transition.shipLifecycleCandidate !== undefined)
          shipLifecycleContexts.set(roomKey, transition.shipLifecycleCandidate);
        branches = transition.branches;
        break;
      }
      case 'offerPointAcquired': {
        const settlement = applyReachedOfferSettlement({
          catalog,
          snapshot,
          event,
          rooms,
          views,
          branches,
          priorFindings: Object.freeze([...findings.values()]),
          authoredSeaStarDuplicateSiteKeys,
        });
        for (const entry of settlement.findings)
          findings.set(findingIdentityKey(entry.finding), entry);
        recordAcquisitionRoleFrontiers(settlement.roleFrontiers);
        recordTraitChildSettlements(
          settlement.traitChildSettlements,
          settlement.traitChildOccurrenceOwner,
        );
        branches = settlement.branches;
        break;
      }
      case 'producerRoleAdvanced': {
        const settlement = applyReachedOfferSettlement({
          catalog,
          snapshot,
          event,
          rooms,
          views,
          branches,
          priorFindings: Object.freeze([...findings.values()]),
          authoredSeaStarDuplicateSiteKeys,
        });
        for (const entry of settlement.findings)
          findings.set(findingIdentityKey(entry.finding), entry);
        recordAcquisitionRoleFrontiers(settlement.roleFrontiers);
        recordTraitChildSettlements(
          settlement.traitChildSettlements,
          settlement.traitChildOccurrenceOwner,
        );
        branches = settlement.branches;
        break;
      }
      case 'bossDefeated':
      case 'encounterInteractionReached':
      case 'encounterCompleted': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const gorgonPhaseKey = `${semanticAddressKey(event.origin)}::${event.phaseKey}`;
        const gorgonCandidate =
          room?.kind === 'authored'
            ? gorgonPhaseCandidates.get(
                semanticAddressKey(
                  createEncounterPhaseAddress(
                    createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
                    { kind: 'occurrence', occurrenceId: room.occurrenceId },
                    event.phaseKey,
                  ),
                ),
              )
            : undefined;
        const transition = applyEncounterSettlementTransition({
          catalog,
          snapshot,
          routePosition,
          event,
          room,
          view: views.get(semanticAddressKey(event.origin)),
          branches,
          enteredBiomeCount,
          fullRunBiomeCount,
          authoredSeaStarDuplicateSiteKeys,
          gorgonEligible: eligibleGorgonPhases.has(gorgonPhaseKey),
          gorgonCandidate,
          gorgonPhaseBlocked: blockedGorgonPhases.has(gorgonPhaseKey),
          gorgonEvaluationBlocked,
        });
        branches = transition.branches;
        for (const entry of transition.findings)
          findings.set(findingIdentityKey(entry.finding), entry);
        recordAcquisitionRoleFrontiers(transition.roleFrontiers);
        recordTraitOfferCandidateContacts(transition.traitOfferCandidateContacts);
        for (const settlement of transition.traitChildSettlements)
          recordTraitChildSettlements(
            Object.freeze([settlement.checkpoint]),
            settlement.occurrenceOwner,
          );
        if (transition.judgmentCandidate !== undefined)
          judgmentArcanaContexts.set(
            transition.judgmentCandidate.key,
            Object.freeze({
              activeArcanaKeys: transition.judgmentCandidate.activeArcanaKeys,
              activeArcana: transition.judgmentCandidate.activeArcana,
              inactiveArcanaKeys: transition.judgmentCandidate.inactiveArcanaKeys,
              requiredCount: transition.judgmentCandidate.requiredCount,
            }),
          );
        if (transition.figurineCandidate !== undefined)
          figurineArcanaContexts.set(
            transition.figurineCandidate.key,
            Object.freeze({
              activeArcanaKeys: transition.figurineCandidate.activeArcanaKeys,
              activeArcana: transition.figurineCandidate.activeArcana,
              inactiveArcanaKeys: transition.figurineCandidate.inactiveArcanaKeys,
              requiredCount: transition.figurineCandidate.requiredCount,
              rarity: transition.figurineCandidate.rarity,
            }),
          );
        if (transition.nemesisCandidate !== undefined)
          nemesisRandomEventCandidates.set(
            transition.nemesisCandidate.key,
            transition.nemesisCandidate.value,
          );
        for (const outcome of transition.bossArcanaOutcomes ?? [])
          bossArcanaOutcomes.set(semanticAddressKey(outcome.owner), outcome);
        recordTimelineFacts(transition.timelineFacts);
        if (transition.blockGorgonPhaseKey !== undefined)
          blockedGorgonPhases.add(transition.blockGorgonPhaseKey);
        gorgonEvaluationBlocked = transition.gorgonEvaluationBlocked;
        break;
      }
      case 'encounterEndEffectsApplied': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const transition = applyEncounterEndEffectsTransition(
          catalog,
          event,
          room?.kind === 'authored' ? room : undefined,
          branches,
        );
        branches = transition.branches;
        recordTimelineFacts(transition.timelineFacts);
        recordDerivedAcquisitionEntryFrontiers(transition.derivedAcquisitionEntryFrontiers);
        for (const { address, threshold } of transition.steadyGrowthThresholds) {
          const key = semanticAddressKey(address);
          steadyGrowthOutcomeAddresses.set(key, address);
          const current = steadyGrowthCandidateContexts.get(key) ?? [];
          current.push(threshold);
          steadyGrowthCandidateContexts.set(key, current);
        }
        for (const { address, threshold } of transition.transcendentEmbryoThresholds) {
          const key = semanticAddressKey(address);
          transcendentEmbryoOutcomeAddresses.set(key, address);
          const current = transcendentEmbryoCandidateContexts.get(key) ?? [];
          current.push(threshold);
          transcendentEmbryoCandidateContexts.set(key, current);
        }
        recordTraitChildSettlements(transition.traitChildSettlements, event.origin);
        for (const finding of transition.findings)
          addRewardFinding(findings, finding.finding, finding.region, finding.chronology);
        if (transition.hermesShrineDeliveryPlacementRequired) {
          reachHistorySequence(event.sequence);
          break historyEvents;
        }
        break;
      }
      case 'hermesShrineDeliveriesScheduled': {
        const sourceRoom = rooms.get(semanticAddressKey(event.origin));
        const room = sourceRoom?.kind === 'authored' ? sourceRoom : undefined;
        const transition = applyAcquisitionPointReachedTransition({
          catalog,
          snapshot,
          event,
          room,
          declaration: room === undefined ? undefined : catalog.rooms.byKey[room.gameName],
          roomView: views.get(semanticAddressKey(event.origin)),
          sourceBranches: branches,
          authoredSeaStarDuplicateSiteKeys: Object.freeze([...authoredSeaStarDuplicateSiteKeys]),
          purgingPoolAssessment: undefined,
          hermesShrineRefillState: undefined,
        });
        branches = transition.branches;
        for (const entry of transition.findings)
          findings.set(findingIdentityKey(entry.finding), entry);
        for (const frontier of transition.producerFrontiers)
          indexRewardProducerFrontier(producerFrontiers, frontier);
        recordAcquisitionRoleFrontiers(transition.roleFrontiers);
        recordTimelineFacts(transition.timelineFacts);
        if (room !== undefined)
          recordTraitChildSettlements(transition.traitChildSettlements, room.origin);
        break;
      }
      case 'acquisitionPointReached': {
        const sourceRoom = rooms.get(semanticAddressKey(event.origin));
        const room = sourceRoom?.kind === 'authored' ? sourceRoom : undefined;
        if (room !== undefined && event.point.startsWith('purgingPool:')) {
          const poolSlot = event.point.slice('purgingPool:'.length);
          const poolRow = room.roomActionRoster.rows.find(
            (row) =>
              !row.stale &&
              row.rank !== null &&
              row.reference.kind === 'sellPurgingPoolTrait' &&
              row.reference.slotKey === poolSlot,
          );
          if (poolRow !== undefined) recordTimelineNode(poolRow.owner, true);
        }
        const deliverySource =
          event.siteKey === 'hermesShrineDelivery' && event.entryKey !== undefined
            ? parseHermesShrineDeliveryEntryKey(event.entryKey)
            : undefined;
        const shrineKey =
          deliverySource === undefined
            ? semanticAddressKey(event.origin)
            : semanticAddressKey({
                kind: 'occurrence' as const,
                routeKey: deliverySource.routeKey,
                biomeKey: deliverySource.biomeKey,
                occurrenceId: deliverySource.sourceOccurrenceId,
              });
        const refillState: HermesShrineRefillState | undefined =
          deliverySource === undefined
            ? undefined
            : Object.freeze({
                firstRushedInitialGeneration: firstRushedInitialGenerationByShrine.has(shrineKey),
                refillAssessments: hermesShrineTravelDealRefills.get(shrineKey),
                refillSupported: hermesShrineTravelDealRefillValid.get(shrineKey),
              });
        const derivedSite =
          event.siteKey === undefined || room === undefined
            ? undefined
            : room.acquisitionSites[event.siteKey]?.address;
        const derivedCapability =
          derivedSite === undefined || event.entryKey === undefined
            ? undefined
            : attestDerivedAcquisitionEntryCandidateCapability(
                derivedAcquisitionEntryContexts.get(
                  semanticAddressKey(createAcquisitionEntryAddress(derivedSite, event.entryKey)),
                ) ?? [],
              );
        const transition = applyAcquisitionPointReachedTransition({
          catalog,
          snapshot,
          event,
          room,
          declaration: room === undefined ? undefined : catalog.rooms.byKey[room.gameName],
          roomView: views.get(semanticAddressKey(event.origin)),
          sourceBranches: branches,
          authoredSeaStarDuplicateSiteKeys: Object.freeze([...authoredSeaStarDuplicateSiteKeys]),
          purgingPoolAssessment: purgingPoolAssessments.get(shrineKey),
          hermesShrineRefillState: refillState,
          ...(derivedCapability === undefined
            ? {}
            : { derivedAcquisitionEntryCapability: derivedCapability }),
        });
        branches = transition.branches;
        for (const entry of transition.findings)
          findings.set(findingIdentityKey(entry.finding), entry);
        for (const frontier of transition.producerFrontiers)
          indexRewardProducerFrontier(producerFrontiers, frontier);
        recordAcquisitionRoleFrontiers(transition.roleFrontiers);
        recordTimelineFacts(transition.timelineFacts);
        if (room !== undefined)
          recordTraitChildSettlements(transition.traitChildSettlements, room.origin);
        if (transition.authoredSiteSettlement !== undefined && room !== undefined)
          applyAuthoredSiteSettlementResult(transition.authoredSiteSettlement, room.origin);
        if (transition.hermesShrineRefillState !== undefined) {
          const next = transition.hermesShrineRefillState;
          if (next.firstRushedInitialGeneration)
            firstRushedInitialGenerationByShrine.add(shrineKey);
          else firstRushedInitialGenerationByShrine.delete(shrineKey);
          if (next.refillAssessments === undefined) hermesShrineTravelDealRefills.delete(shrineKey);
          else hermesShrineTravelDealRefills.set(shrineKey, next.refillAssessments);
          if (next.refillSupported === undefined)
            hermesShrineTravelDealRefillValid.delete(shrineKey);
          else hermesShrineTravelDealRefillValid.set(shrineKey, next.refillSupported);
        }
        break;
      }
      case 'wellPurchase': {
        const wellRoom = rooms.get(semanticAddressKey(event.origin));
        const wellOrigin = wellRoom?.kind === 'authored' ? wellRoom.origin : undefined;
        const transition = applyWellPurchaseTransition({
          catalog,
          snapshot,
          event,
          room: wellRoom,
          branches,
          refillGenerationSupported:
            wellOrigin !== undefined &&
            wellRefillRealizations.has(
              semanticAddressKey(
                createTravelDealRefillRealizationAddress(
                  createBiomeAddress(wellOrigin.routeKey, wellOrigin.biomeKey),
                  wellOrigin.occurrenceId,
                ),
              ),
            ),
        });
        for (const finding of transition.findings)
          findings.set(findingIdentityKey(finding.finding), finding);
        branches = transition.branches;
        recordTimelineFacts(transition.timelineFacts);
        if (transition.candidateContexts.length > 0 && wellRoom?.kind === 'authored') {
          const key = semanticAddressKey(event.origin);
          const existing = stygianWellAssessments.get(key);
          stygianWellAssessments.set(
            key,
            Object.freeze({
              origin: wellRoom.origin,
              assessments: Object.freeze([
                ...(existing?.assessments ?? []),
                ...transition.candidateContexts,
              ]),
            }),
          );
        }
        if (transition.refillRealization !== undefined)
          wellRefillRealizations.set(
            semanticAddressKey(transition.refillRealization.owner),
            transition.refillRealization,
          );
        break;
      }
      case 'roomExited': {
        const room = rooms.get(semanticAddressKey(event.origin));
        const exited = applyRoomExitedTransition(
          catalog,
          event,
          room?.kind === 'authored' ? room : undefined,
          views.get(semanticAddressKey(event.origin)),
          resourcePlacements,
          branches,
          resourceFindings,
        );
        if (exited.runStateCheckpoint !== undefined)
          captureRunState(
            exited.runStateCheckpoint.owner,
            exited.runStateCheckpoint.room,
            exited.runStateCheckpoint.view,
          );
        branches = exited.branches;
        mergeRewardFindingEmissions(findings, exited.findingRegions);
        break;
      }
      default:
        branches = advanceRewardBranches(branches, event.sequence);
        break;
    }
    if (event.origin?.kind === 'hubRoom') {
      if (
        event.kind === 'roomExited' ||
        (event.kind === 'roomRestored' && event.restoreKind === 'hub')
      )
        recordHubDeparture(event.origin, event.sequence, false);
      else if (event.kind === 'fountainUsed')
        recordHubDeparture(event.origin, event.sequence, true);
    }
    reachHistorySequence(event.sequence);
  }

  if (
    snapshot.kind === 'biomePrefix' &&
    snapshot.frontier?.kind === 'exitDecision' &&
    snapshot.frontier.parent.origin.kind === 'hubRoom'
  ) {
    const source = rooms.get(semanticAddressKey(snapshot.frontier.parent.origin));
    if (source?.kind === 'hub') {
      const current = 'current' in history ? history.current : history.afterTransition;
      captureRunState(snapshot.frontier.origin, source, current);
    }
  }

  // A boss-door store is not an outgoing batch — the source room owns no exit
  // decision — so it never reaches the outgoing-generation assessment. It is
  // reached here at that room's exit boundary, before the boss and everything
  // the boss leads to: unauthored it is the required input at that position,
  // authored it raises `baseRewardStoreUnavailable` against the same controller
  // as an ordinary batch and the selector reads real support.
  for (const link of snapshot.fixedRoomLinks ?? []) {
    const door = link.bossDoorRewardStore;
    if (door === undefined) continue;
    const sourceViews = views.get(semanticAddressKey(link.source.origin));
    const view = sourceViews?.exit ?? sourceViews?.postCommit;
    if (view === undefined) continue;
    if (door.storeKey === undefined) {
      // Identical to the completeness pass's copy so the two collapse by
      // finding identity once both reach the published findings.
      addRewardFinding(
        findings,
        bossDoorRewardStoreMissingFinding(door.origin, link.target.gameName),
        ownerRegion(door.origin),
        { kind: 'history', sequence: view.sequence, boundary: 'at' },
      );
      continue;
    }
    const support = assessAuthoredBossDoorRewardStore(
      layout,
      door.origin,
      door.storeKey,
      view,
      view.sequence + 1,
    );
    storeSupportEntries.push(support);
    if (!support.selectedPossible)
      addRewardFinding(
        findings,
        rewardFinding('baseRewardStoreUnavailable', support.origin, {
          authoredStoreKey: support.authoredStoreKey,
          enteredStoreCount: support.enteredStoreCount,
          enteredMetaStoreCount: support.enteredMetaStoreCount,
          currentMetaRatio: support.currentMetaRatio,
          metaSelectionValue: support.metaSelectionValue,
          supportStoreKeys: support.supportStoreKeys,
        }),
        ownerRegion(support.origin),
        { kind: 'history', sequence: view.sequence, boundary: 'at' },
      );
  }

  recordBlankFrontierTargetHistory();
  const immutableFindingRegions = Object.freeze([...findings.values()]);
  const immutableFindings = Object.freeze(immutableFindingRegions.map((entry) => entry.finding));
  const traitProducts = selectedTraitOfferProducts(
    branches,
    immutableFindingRegions.flatMap((entry) =>
      entry.levelResolutionEvaluations === undefined ? [] : entry.levelResolutionEvaluations,
    ),
    catalog,
  );
  const traitCandidateContexts = new Map(traitProducts.candidateContexts);
  for (const [key, contexts] of reachedTraitOfferCandidateContexts) {
    if (!traitCandidateContexts.has(key))
      traitCandidateContexts.set(key, Object.freeze([...contexts]));
  }
  for (const [childKey, checkpoint] of traitChildSettlementBuilders) {
    if (checkpoint.candidateContexts.length === 0) continue;
    const key =
      checkpoint.address.kind === 'traitAcquisitionTarget' ||
      checkpoint.address.kind === 'allTogetherSet'
        ? semanticAddressKey(checkpoint.address.trait)
        : childKey;
    traitCandidateContexts.set(
      key,
      Object.freeze([...(traitCandidateContexts.get(key) ?? []), ...checkpoint.candidateContexts]),
    );
  }
  const levelCandidateContexts = new Map(traitProducts.levelCandidateContexts);
  const discoveredRunStateSnapshots = Object.freeze(
    [...runStateSnapshotsByOwner.values()].sort((left, right) => {
      const leftRoom = left.owner.kind === 'roomRunStateCheckpoint';
      const rightRoom = right.owner.kind === 'roomRunStateCheckpoint';
      return leftRoom === rightRoom ? 0 : leftRoom ? 1 : -1;
    }),
  );
  const runStatePublication = publishRunStateThroughCoverage(
    discoveredRunStateSnapshots,
    discoveredRunStateSnapshots,
  );
  const traitChildSettlementProducts = new Map(
    [...traitChildSettlementBuilders].map(([key, checkpoint]) =>
      Object.freeze([
        key,
        Object.freeze({
          branches: Object.freeze(
            mergeEquivalentRewardBranches(checkpoint.branches).map(publicRewardBranch),
          ),
          runStateSnapshots: Object.freeze([...checkpoint.runStateSnapshots.values()]),
        }),
      ] as const),
    ),
  );
  const traitChildSettlementCheckpoints: TraitChildSettlementCheckpoints = Object.freeze({
    at: (address: SemanticAddress) => traitChildSettlementProducts.get(semanticAddressKey(address)),
  });
  const publishedHermesShrineAssessments = Object.freeze(
    [...hermesShrineAssessments.values()].map(({ origin, assessments }) => {
      const travelDealRefills = hermesShrineTravelDealRefills.get(semanticAddressKey(origin));
      return Object.freeze({
        origin,
        assessments: Object.freeze(
          assessments.map((assessment, index) =>
            travelDealRefills?.[index] === undefined
              ? assessment
              : Object.freeze({ ...assessment, travelDealRefill: travelDealRefills[index] }),
          ),
        ),
      });
    }),
  );
  const simulation: BiomeRewardSimulation = Object.freeze({
    biomeKey: snapshot.biomeKey,
    validity: immutableFindings.length === 0 && branches.length > 0 ? 'valid' : 'invalid',
    ...(echoKeepsakeReplayOutcome === undefined
      ? {}
      : { volatileEchoKeepsakeReplay: echoKeepsakeReplayOutcome }),
    timelineFacts:
      timelineFactNodes.size === 0 && timelineFactDependencies.size === 0
        ? EMPTY_PLANNER_TIMELINE_FACTS
        : Object.freeze({
            nodes: Object.freeze([...timelineFactNodes.values()]),
            dependencies: Object.freeze([...timelineFactDependencies.values()]),
          }),
    wellRefillRealizations: Object.freeze([...wellRefillRealizations.values()]),
    bossArcanaOutcomes: Object.freeze([...bossArcanaOutcomes.values()]),
    storeSupport: Object.freeze(storeSupportEntries),
    targetHistory: Object.freeze([...targetHistoryByOrigin.values()]),
    branches: Object.freeze(branches.map(publicRewardBranch)),
    findings: immutableFindings,
    runStateSnapshots: runStatePublication.snapshots,
    runStateAvailability: runStatePublication.availability,
    hubDepartures: Object.freeze([...hubDepartures]),
    purgingPoolAssessments: Object.freeze([...purgingPoolAssessments.values()]),
    hermesShrineAssessments: publishedHermesShrineAssessments,
    stygianWellAssessments: Object.freeze([...stygianWellAssessments.values()]),
    hermesShrineDeliveries: Object.freeze([
      ...new Map(
        branches
          .flatMap((branch) => Object.values(branch.state.pendingHermesShrineDeliveries))
          .map(
            (delivery) =>
              [
                delivery.sourceKey,
                Object.freeze({
                  sourceKey: delivery.sourceKey,
                  sourceOrigin: delivery.sourceOrigin,
                  rewardType: delivery.rewardType,
                  deliveryKind:
                    delivery.dueAt === undefined ? ('pending' as const) : ('countdown' as const),
                  ...(delivery.dueAt === undefined ? {} : { hostOrigin: delivery.dueAt }),
                  ...(delivery.dueSequence === undefined
                    ? {}
                    : { hostSequence: delivery.dueSequence }),
                  remainingUses: delivery.remainingUses,
                }),
              ] as const,
          ),
      ).values(),
    ]),
    selectedTraitOffers: traitProducts.selectedTraitOffers,
    selectedLevelResolutions: traitProducts.selectedLevelResolutions,
    figLeafPhaseCandidates: Object.freeze([...figLeafPhaseCandidates.values()]),
    gorgonPhaseCandidates: Object.freeze([...gorgonPhaseCandidates.values()]),
    nemesisRandomEventCandidates: Object.freeze([...nemesisRandomEventCandidates.values()]),
    steadyGrowthOutcomes: Object.freeze(
      [...steadyGrowthCandidateContexts.entries()].flatMap(([key, thresholds]) => {
        const address = steadyGrowthOutcomeAddresses.get(key);
        const first = thresholds[0];
        if (address === undefined || first === undefined) return [];
        return [
          Object.freeze({
            address,
            sourceTraitKey: first.traitKey,
            phaseKey: address.phaseKey,
            requiredIntervals: Object.freeze(
              thresholds.map((threshold) => threshold.requiredInterval),
            ),
            progressBefore: Object.freeze(
              thresholds.map(
                (threshold) =>
                  threshold.before.equippedTraits[threshold.traitKey]?.steadyGrowthProgress ?? 0,
              ),
            ),
          }),
        ];
      }),
    ),
    transcendentEmbryoOutcomes: Object.freeze(
      [...transcendentEmbryoCandidateContexts.entries()].flatMap(([key, thresholds]) => {
        const address = transcendentEmbryoOutcomeAddresses.get(key);
        const first = thresholds[0];
        if (address === undefined || first === undefined) return [];
        return [
          Object.freeze({
            address,
            sourceBlessingKey: first.source.markedBlessingKey,
            phaseKey: address.phaseKey,
            transformationRarities: Object.freeze(
              thresholds.map((threshold) => threshold.source.rarity),
            ),
            progressBefore: Object.freeze(thresholds.map((threshold) => threshold.source.progress)),
          }),
        ];
      }),
    ),
    derivedAcquisitionEntries: Object.freeze(
      [...derivedAcquisitionEntryContexts.values()].flatMap((frontiers) => {
        const first = frontiers[0];
        const capability = attestDerivedAcquisitionEntryCandidateCapability(frontiers);
        return first === undefined || capability === undefined
          ? []
          : [Object.freeze({ address: first.address, ...capability })];
      }),
    ),
  });
  return publishBiomeRewardEvaluationAssembly({
    simulation,
    producerArtifacts: createRewardProducerCandidateArtifacts(producerFrontiers),
    lifecycleArtifacts: createRoomLifecycleCandidateArtifacts(shipLifecycleContexts),
    traitOfferArtifacts: createTraitOfferCandidateArtifacts(catalog, traitCandidateContexts),
    levelResolutionArtifacts: createLevelResolutionCandidateArtifacts(
      catalog,
      levelCandidateContexts,
    ),
    judgmentArcanaArtifacts: createJudgmentArcanaCandidateArtifacts(judgmentArcanaContexts),
    figurineArcanaArtifacts: createFigurineArcanaCandidateArtifacts(figurineArcanaContexts),
    keepsakeSelectionArtifacts:
      createKeepsakeSelectionCandidateArtifacts(keepsakeSelectionContexts),
    keepsakeEquipResultArtifacts: createKeepsakeEquipResultCandidateArtifacts(
      keepsakeEquipResultContexts,
    ),
    acquisitionConversionArtifacts: createAcquisitionConversionCandidateArtifacts(
      catalog,
      acquisitionConversionContexts,
    ),
    derivedAcquisitionEntryArtifacts: createDerivedAcquisitionEntryCandidateArtifacts(
      derivedAcquisitionEntryContexts,
    ),
    steadyGrowthArtifacts: createSteadyGrowthCandidateArtifacts(
      catalog,
      steadyGrowthCandidateContexts,
    ),
    transcendentEmbryoArtifacts: createTranscendentEmbryoCandidateArtifacts(
      catalog,
      transcendentEmbryoCandidateContexts,
    ),
    fountainRarityArtifacts: createFountainRarityCandidateArtifacts(
      fountainRarityCandidateContexts,
    ),
    purgingPoolArtifacts: createPurgingPoolCandidateArtifacts(
      new Map(
        [...purgingPoolAssessments.values()].map(({ origin, assessments }) => [
          semanticAddressKey(origin),
          assessments,
        ]),
      ),
    ),
    hermesShrineArtifacts: createHermesShrineCandidateArtifacts(
      new Map(
        publishedHermesShrineAssessments.map(({ origin, assessments }) => [
          semanticAddressKey(origin),
          assessments,
        ]),
      ),
    ),
    stygianWellArtifacts: createStygianWellCandidateArtifacts(
      new Map(
        [...stygianWellAssessments.values()].map(({ origin, assessments }) => [
          semanticAddressKey(origin),
          assessments,
        ]),
      ),
    ),
    traitChildSettlementCheckpoints,
    findingRegions: Object.freeze(immutableFindingRegions),
  });
}
