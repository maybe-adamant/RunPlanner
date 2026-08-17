import type { Catalog } from '../../catalog-schema';
import { createBiomeAddress, type TraitOfferAddress } from '../../authored-project/addresses';
import type { AuthoredTraitOfferTraits } from '../../authored-project/traits';
import type { ProjectDocument } from '../../authored-project/model';
import type { ProjectCandidateArtifacts } from '../candidate-artifacts';
import {
  candidateArtifactsForProjectEvaluationAssembly,
  type ProjectEvaluation,
  type ProjectEvaluationAssembly,
} from '../project';
import {
  evaluateBatchRewardStoreCandidate,
  type BatchRewardStoreCandidateQuery,
  type EvaluatedBatchRewardStoreCandidate,
} from './batch-reward-store';
import {
  evaluateFieldsCageOutcomeCandidate,
  type EvaluatedFieldsCageOutcomeCandidate,
  type FieldsCageOutcomeCandidateQuery,
} from './fields-cage-outcome';
import {
  evaluateFieldsActionOrderCandidate,
  type EvaluatedFieldsActionOrderCandidate,
  type FieldsActionOrderCandidateQuery,
} from './fields-action-order';
import {
  evaluateHubSlotCandidate,
  evaluateHubVisitOrderCandidate,
  evaluateSideRoomEntryOrderCandidate,
  evaluateSideRoomGenerationCandidate,
  type EvaluatedHubSlotCandidate,
  type EvaluatedHubVisitOrderCandidate,
  type EvaluatedSideRoomEntryOrderCandidate,
  type EvaluatedSideRoomGenerationCandidate,
  type HubSlotCandidateQuery,
  type HubVisitOrderCandidateQuery,
  type SideRoomEntryOrderCandidateQuery,
  type SideRoomGenerationCandidateQuery,
} from './hub';
import {
  evaluateRewardProducerCandidate,
  type EvaluatedIncomingRewardCandidate,
  type EvaluatedLocalRewardCandidate,
  type EvaluatedRewardWheelOfferCandidate,
  type EvaluatedShopOfferCandidate,
  type EvaluatedAcquisitionEntryOfferCandidate,
  type AcquisitionEntryOfferCandidateQuery,
  type IncomingRewardCandidateQuery,
  type LocalRewardCandidateQuery,
  type RewardWheelOfferCandidateQuery,
  type ShopOfferCandidateQuery,
} from './reward-producer';
import {
  evaluateRewardWheelLifecycleCandidate,
  evaluateShipEncounterCountCandidate,
  evaluateAcquisitionOrderCandidate,
  type EvaluatedRewardWheelOfferCountCandidate,
  type EvaluatedRewardWheelPickedCandidate,
  type EvaluatedRewardWheelStoreCandidate,
  type EvaluatedShipEncounterCountCandidate,
  type EvaluatedAcquisitionOrderCandidate,
  type RewardWheelOfferCountCandidateQuery,
  type RewardWheelPickedCandidateQuery,
  type RewardWheelStoreCandidateQuery,
  type ShipEncounterCountCandidateQuery,
  type AcquisitionOrderCandidateQuery,
} from './room-lifecycle';
import {
  evaluateRoomTargetCandidate,
  type EvaluatedRoomTargetCandidate,
  type RoomTargetCandidateQuery,
} from './room-target';
import {
  evaluateStartRoomCandidate,
  type EvaluatedStartRoomCandidate,
  type StartRoomCandidateQuery,
} from './start-room';
import {
  evaluateTakeoverPrebossBatch,
  type EvaluatedTakeoverPrebossBatchCandidate,
  type TakeoverPrebossBatchCandidateQuery,
} from './takeover-preboss';
import {
  evaluateHubTerminalTakeover,
  type EvaluatedHubTerminalTakeoverCandidate,
  type HubTerminalTakeoverCandidateQuery,
} from './takeover-hub';
import type { CandidateContextUnavailable } from './availability';
import {
  evaluateBossCompletionArcanaCandidate,
  type BossCompletionArcanaCandidateQuery,
  type EvaluatedBossCompletionArcanaCandidate,
} from './boss-completion-arcana';
import {
  evaluateTraitAcquisitionTargetDomain,
  evaluateCirceResolutionDomain,
  evaluateEchoPomTargetDomain,
  evaluateEchoLastRunBoonDomain,
  evaluateEchoLastRewardDomain,
  evaluateAllTogetherSetDomain,
  type CirceResolutionDomainEvaluation,
  type CirceResolutionDomainQuery,
  type EvaluatedCirceResolutionDomain,
  type EvaluatedEchoPomTargetDomain,
  type EchoPomTargetDomainEvaluation,
  type EchoPomTargetDomainQuery,
  type EchoLastRunBoonDomainQuery,
  type EchoLastRunBoonDomainEvaluation,
  type EvaluatedEchoLastRunBoonDomain,
  type EchoLastRewardDomainQuery,
  type EchoLastRewardDomainEvaluation,
  type EvaluatedEchoLastRewardDomain,
  type AllTogetherSetDomainQuery,
  type AllTogetherSetDomainEvaluation,
  type EvaluatedAllTogetherSetDomain,
  evaluateTraitOfferCandidate,
  evaluateTraitOfferFocusedOptionCandidate,
  type EvaluatedTraitAcquisitionTargetDomain,
  type EvaluatedTraitOfferCandidate,
  type EvaluatedTraitOfferFocusedOptionCandidate,
  type TraitAcquisitionTargetDomainEvaluation,
  type TraitAcquisitionTargetDomainQuery,
  type TraitOfferCandidateQuery,
  type TraitOfferFocusedOptionCandidateEvaluation,
  type TraitOfferFocusedOptionCandidateQuery,
} from './trait-offer';
import {
  evaluateKeepsakeSelectionCandidate,
  type EvaluatedKeepsakeSelectionCandidate,
  type KeepsakeSelectionCandidateQuery,
} from './keepsake-selection';
import {
  evaluateKeepsakeEquipResultCandidate,
  type EvaluatedKeepsakeEquipResultCandidate,
  type KeepsakeEquipResultCandidateQuery,
} from './keepsake-equip-result';
import {
  evaluateAcquisitionConversionCandidate,
  type AcquisitionConversionCandidateQuery,
  type EvaluatedAcquisitionConversionCandidate,
} from './acquisition-conversion';

export type ProjectCandidateQuery =
  | BatchRewardStoreCandidateQuery
  | FieldsCageOutcomeCandidateQuery
  | FieldsActionOrderCandidateQuery
  | HubSlotCandidateQuery
  | HubVisitOrderCandidateQuery
  | IncomingRewardCandidateQuery
  | LocalRewardCandidateQuery
  | RewardWheelOfferCandidateQuery
  | RewardWheelOfferCountCandidateQuery
  | RewardWheelPickedCandidateQuery
  | RewardWheelStoreCandidateQuery
  | RoomTargetCandidateQuery
  | ShipEncounterCountCandidateQuery
  | ShopOfferCandidateQuery
  | AcquisitionEntryOfferCandidateQuery
  | AcquisitionOrderCandidateQuery
  | SideRoomEntryOrderCandidateQuery
  | SideRoomGenerationCandidateQuery
  | StartRoomCandidateQuery
  | TakeoverPrebossBatchCandidateQuery
  | HubTerminalTakeoverCandidateQuery
  | TraitOfferCandidateQuery
  | BossCompletionArcanaCandidateQuery
  | KeepsakeSelectionCandidateQuery
  | KeepsakeEquipResultCandidateQuery
  | AcquisitionConversionCandidateQuery;

/** Candidate-session-only query vocabulary, including focused trait support. */
export type ProjectCandidateSessionQuery =
  | ProjectCandidateQuery
  | TraitOfferFocusedOptionCandidateQuery
  | TraitAcquisitionTargetDomainQuery
  | CirceResolutionDomainQuery
  | EchoPomTargetDomainQuery
  | EchoLastRunBoonDomainQuery
  | EchoLastRewardDomainQuery
  | AllTogetherSetDomainQuery;

export type ProjectCandidateEvaluation =
  | CandidateContextUnavailable
  | EvaluatedBatchRewardStoreCandidate
  | EvaluatedFieldsCageOutcomeCandidate
  | EvaluatedFieldsActionOrderCandidate
  | EvaluatedHubSlotCandidate
  | EvaluatedHubVisitOrderCandidate
  | EvaluatedIncomingRewardCandidate
  | EvaluatedLocalRewardCandidate
  | EvaluatedRewardWheelOfferCandidate
  | EvaluatedRewardWheelOfferCountCandidate
  | EvaluatedRewardWheelPickedCandidate
  | EvaluatedRewardWheelStoreCandidate
  | EvaluatedRoomTargetCandidate
  | EvaluatedShipEncounterCountCandidate
  | EvaluatedShopOfferCandidate
  | EvaluatedAcquisitionEntryOfferCandidate
  | EvaluatedAcquisitionOrderCandidate
  | EvaluatedSideRoomEntryOrderCandidate
  | EvaluatedSideRoomGenerationCandidate
  | EvaluatedStartRoomCandidate
  | EvaluatedTakeoverPrebossBatchCandidate
  | EvaluatedHubTerminalTakeoverCandidate
  | EvaluatedTraitOfferCandidate
  | EvaluatedBossCompletionArcanaCandidate
  | EvaluatedKeepsakeSelectionCandidate
  | EvaluatedKeepsakeEquipResultCandidate
  | EvaluatedAcquisitionConversionCandidate;

/** Result vocabulary corresponding to `ProjectCandidateSessionQuery`. */
export type ProjectCandidateSessionEvaluation =
  | ProjectCandidateEvaluation
  | EvaluatedTraitOfferFocusedOptionCandidate
  | EvaluatedTraitAcquisitionTargetDomain
  | EvaluatedCirceResolutionDomain
  | EvaluatedEchoPomTargetDomain
  | EvaluatedEchoLastRunBoonDomain
  | EvaluatedEchoLastRewardDomain
  | EvaluatedAllTogetherSetDomain;

export type CandidateEvaluationEvent =
  | {
      readonly kind: 'queryBatch';
      readonly queryCount: number;
    }
  | {
      readonly kind: 'fieldsActionBiomeReplay';
      readonly owner: import('../../authored-project/addresses').OccurrenceAddress;
    };

export interface ProjectCandidateSessionOptions {
  readonly observe?: (event: CandidateEvaluationEvent) => void;
}

export interface ProjectCandidateSession {
  readonly project: ProjectDocument;
  readonly evaluation: ProjectEvaluation;
  readonly evaluate: {
    (query: TraitOfferFocusedOptionCandidateQuery): TraitOfferFocusedOptionCandidateEvaluation;
    (
      queries: readonly TraitOfferFocusedOptionCandidateQuery[],
    ): readonly TraitOfferFocusedOptionCandidateEvaluation[];
    (query: TraitAcquisitionTargetDomainQuery): TraitAcquisitionTargetDomainEvaluation;
    (
      queries: readonly TraitAcquisitionTargetDomainQuery[],
    ): readonly TraitAcquisitionTargetDomainEvaluation[];
    (query: CirceResolutionDomainQuery): CirceResolutionDomainEvaluation;
    (queries: readonly CirceResolutionDomainQuery[]): readonly CirceResolutionDomainEvaluation[];
    (query: EchoPomTargetDomainQuery): EchoPomTargetDomainEvaluation;
    (queries: readonly EchoPomTargetDomainQuery[]): readonly EchoPomTargetDomainEvaluation[];
    (query: EchoLastRunBoonDomainQuery): EchoLastRunBoonDomainEvaluation;
    (queries: readonly EchoLastRunBoonDomainQuery[]): readonly EchoLastRunBoonDomainEvaluation[];
    (query: EchoLastRewardDomainQuery): EchoLastRewardDomainEvaluation;
    (queries: readonly EchoLastRewardDomainQuery[]): readonly EchoLastRewardDomainEvaluation[];
    (query: AllTogetherSetDomainQuery): AllTogetherSetDomainEvaluation;
    (queries: readonly AllTogetherSetDomainQuery[]): readonly AllTogetherSetDomainEvaluation[];
    (query: ProjectCandidateQuery): ProjectCandidateEvaluation;
    (queries: readonly ProjectCandidateQuery[]): readonly ProjectCandidateEvaluation[];
    (query: ProjectCandidateSessionQuery): ProjectCandidateSessionEvaluation;
    (
      queries: readonly ProjectCandidateSessionQuery[],
    ): readonly ProjectCandidateSessionEvaluation[];
  };
  /** Exact trait-outcome transitions retained behind the prepared session. */
  readonly traitOfferStartingDraft: (
    owner: TraitOfferAddress,
    giverKey: string,
  ) => AuthoredTraitOfferTraits | undefined;
  readonly nextTraitOfferDraft: (
    owner: TraitOfferAddress,
    value: AuthoredTraitOfferTraits,
  ) => AuthoredTraitOfferTraits | undefined;
  readonly nextOptionalHighTierTraitOfferDraft: (
    owner: TraitOfferAddress,
    value: AuthoredTraitOfferTraits,
  ) => AuthoredTraitOfferTraits | undefined;
  readonly previousOptionalHighTierTraitOfferDraft: (
    owner: TraitOfferAddress,
    value: AuthoredTraitOfferTraits,
  ) => AuthoredTraitOfferTraits | undefined;
}

function assertNever(value: never): never {
  throw new Error(`candidate dispatcher received an unknown query: ${String(value)}`);
}

function evaluateCandidateQuery(
  catalog: Catalog,
  assembly: ProjectEvaluationAssembly,
  candidateArtifacts: ProjectCandidateArtifacts,
  query: ProjectCandidateSessionQuery,
  observe?: (event: CandidateEvaluationEvent) => void,
): ProjectCandidateSessionEvaluation {
  const { project, evaluation } = assembly;
  switch (query.kind) {
    case 'acquisitionConversion':
      return evaluateAcquisitionConversionCandidate(
        catalog,
        project,
        evaluation,
        candidateArtifacts.biomeAt(
          createBiomeAddress(query.acquisition.routeKey, query.acquisition.biomeKey),
        )?.acquisitionConversions,
        query,
      );
    case 'keepsakeEquipResult':
      return evaluateKeepsakeEquipResultCandidate(
        catalog,
        project,
        evaluation,
        candidateArtifacts.keepsakeEquipResults,
        query,
      );
    case 'keepsakeSelection':
      return evaluateKeepsakeSelectionCandidate(
        catalog,
        project,
        evaluation,
        candidateArtifacts.keepsakeSelections,
        query,
      );
    case 'bossCompletionArcana':
      return evaluateBossCompletionArcanaCandidate(
        catalog,
        project,
        evaluation,
        candidateArtifacts.biomeAt(
          createBiomeAddress(query.completion.routeKey, query.completion.biomeKey),
        )?.bossCompletionArcana,
        query,
      );
    case 'startRoom':
      return evaluateStartRoomCandidate(catalog, project, query);
    case 'roomTarget':
      return evaluateRoomTargetCandidate(
        catalog,
        project,
        evaluation,
        candidateArtifacts.biomeAt(createBiomeAddress(query.target.routeKey, query.target.biomeKey))
          ?.roomTargets,
        query,
      );
    case 'takeoverPrebossBatch':
      return evaluateTakeoverPrebossBatch(catalog, project, evaluation, query);
    case 'hubTerminalTakeover':
      return evaluateHubTerminalTakeover(catalog, project, evaluation, query);
    case 'batchRewardStore':
      return evaluateBatchRewardStoreCandidate(catalog, project, evaluation, query);
    case 'fieldsCageOutcome':
      return evaluateFieldsCageOutcomeCandidate(catalog, project, evaluation, query);
    case 'fieldsActionOrder':
      return evaluateFieldsActionOrderCandidate(catalog, project, evaluation, query, (owner) =>
        observe?.(Object.freeze({ kind: 'fieldsActionBiomeReplay', owner })),
      );
    case 'hubSlot':
      return evaluateHubSlotCandidate(catalog, project, evaluation, query);
    case 'hubVisitOrder':
      return evaluateHubVisitOrderCandidate(catalog, project, evaluation, query);
    case 'sideRoomGeneration':
      return evaluateSideRoomGenerationCandidate(catalog, project, evaluation, query);
    case 'sideRoomEntryOrder':
      return evaluateSideRoomEntryOrderCandidate(catalog, project, evaluation, query);
    case 'incomingReward':
      return evaluateRewardProducerCandidate(
        catalog,
        project,
        evaluation,
        candidateArtifacts.biomeAt(createBiomeAddress(query.reward.routeKey, query.reward.biomeKey))
          ?.rewardProducers,
        query,
      );
    case 'localReward':
      return evaluateRewardProducerCandidate(
        catalog,
        project,
        evaluation,
        candidateArtifacts.biomeAt(createBiomeAddress(query.reward.routeKey, query.reward.biomeKey))
          ?.rewardProducers,
        query,
      );
    case 'rewardWheelOffer':
      return evaluateRewardProducerCandidate(
        catalog,
        project,
        evaluation,
        candidateArtifacts.biomeAt(createBiomeAddress(query.offer.routeKey, query.offer.biomeKey))
          ?.rewardProducers,
        query,
      );
    case 'shopOffer':
      return evaluateRewardProducerCandidate(
        catalog,
        project,
        evaluation,
        candidateArtifacts.biomeAt(createBiomeAddress(query.offer.routeKey, query.offer.biomeKey))
          ?.rewardProducers,
        query,
      );
    case 'acquisitionEntryOffer':
      return evaluateRewardProducerCandidate(
        catalog,
        project,
        evaluation,
        candidateArtifacts.biomeAt(createBiomeAddress(query.entry.routeKey, query.entry.biomeKey))
          ?.rewardProducers,
        query,
      );
    case 'shipEncounterCount':
      return evaluateShipEncounterCountCandidate(
        catalog,
        project,
        evaluation,
        candidateArtifacts.biomeAt(
          createBiomeAddress(query.occurrence.routeKey, query.occurrence.biomeKey),
        )?.roomLifecycles,
        candidateArtifacts.biomeAt(
          createBiomeAddress(query.occurrence.routeKey, query.occurrence.biomeKey),
        )?.encounters,
        query,
      );
    case 'rewardWheelOfferCount':
      return evaluateRewardWheelLifecycleCandidate(
        catalog,
        project,
        evaluation,
        candidateArtifacts.biomeAt(createBiomeAddress(query.wheel.routeKey, query.wheel.biomeKey))
          ?.roomLifecycles,
        query,
      );
    case 'rewardWheelStore':
      return evaluateRewardWheelLifecycleCandidate(
        catalog,
        project,
        evaluation,
        candidateArtifacts.biomeAt(createBiomeAddress(query.wheel.routeKey, query.wheel.biomeKey))
          ?.roomLifecycles,
        query,
      );
    case 'rewardWheelPicked':
      return evaluateRewardWheelLifecycleCandidate(
        catalog,
        project,
        evaluation,
        candidateArtifacts.biomeAt(createBiomeAddress(query.wheel.routeKey, query.wheel.biomeKey))
          ?.roomLifecycles,
        query,
      );
    case 'acquisitionOrder':
      return evaluateAcquisitionOrderCandidate(
        catalog,
        project,
        evaluation,
        candidateArtifacts.biomeAt(createBiomeAddress(query.site.routeKey, query.site.biomeKey))
          ?.roomLifecycles,
        query,
      );
    case 'traitOffer':
      return evaluateTraitOfferCandidate(
        catalog,
        project,
        evaluation,
        candidateArtifacts.biomeAt(createBiomeAddress(query.trait.routeKey, query.trait.biomeKey))
          ?.traitOffers,
        query,
      );
    case 'traitOfferFocusedOption':
      return evaluateTraitOfferFocusedOptionCandidate(
        catalog,
        project,
        evaluation,
        candidateArtifacts.biomeAt(createBiomeAddress(query.trait.routeKey, query.trait.biomeKey))
          ?.traitOffers,
        query,
      );
    case 'traitAcquisitionTargetDomain':
      return evaluateTraitAcquisitionTargetDomain(
        catalog,
        project,
        evaluation,
        candidateArtifacts.biomeAt(createBiomeAddress(query.trait.routeKey, query.trait.biomeKey))
          ?.traitOffers,
        query,
      );
    case 'circeResolutionDomain':
      return evaluateCirceResolutionDomain(
        catalog,
        project,
        evaluation,
        candidateArtifacts.biomeAt(createBiomeAddress(query.trait.routeKey, query.trait.biomeKey))
          ?.traitOffers,
        query,
      );
    case 'echoPomTargetDomain':
      return evaluateEchoPomTargetDomain(
        catalog,
        project,
        evaluation,
        candidateArtifacts.biomeAt(createBiomeAddress(query.trait.routeKey, query.trait.biomeKey))
          ?.traitOffers,
        query,
      );
    case 'echoLastRunBoonDomain':
      return evaluateEchoLastRunBoonDomain(
        catalog,
        project,
        evaluation,
        candidateArtifacts.biomeAt(createBiomeAddress(query.trait.routeKey, query.trait.biomeKey))
          ?.traitOffers,
        query,
      );
    case 'echoLastRewardDomain':
      return evaluateEchoLastRewardDomain(
        catalog,
        project,
        evaluation,
        candidateArtifacts.biomeAt(createBiomeAddress(query.trait.routeKey, query.trait.biomeKey))
          ?.traitOffers,
        query,
      );
    case 'allTogetherSetDomain':
      return evaluateAllTogetherSetDomain(
        catalog,
        project,
        evaluation,
        candidateArtifacts.biomeAt(createBiomeAddress(query.trait.routeKey, query.trait.biomeKey))
          ?.traitOffers,
        query,
      );
  }
  return assertNever(query);
}

export function createPreparedProjectCandidateSession(
  catalog: Catalog,
  assembly: ProjectEvaluationAssembly,
  options: ProjectCandidateSessionOptions = {},
): ProjectCandidateSession {
  // Attest the exact assembly at binding time even when no query is loaded.
  const candidateArtifacts = candidateArtifactsForProjectEvaluationAssembly(assembly);
  const { project, evaluation } = assembly;
  function evaluate(query: ProjectCandidateQuery): ProjectCandidateEvaluation;
  function evaluate(
    queries: readonly ProjectCandidateQuery[],
  ): readonly ProjectCandidateEvaluation[];
  function evaluate(
    query: TraitOfferFocusedOptionCandidateQuery,
  ): TraitOfferFocusedOptionCandidateEvaluation;
  function evaluate(
    queries: readonly TraitOfferFocusedOptionCandidateQuery[],
  ): readonly TraitOfferFocusedOptionCandidateEvaluation[];
  function evaluate(
    query: TraitAcquisitionTargetDomainQuery,
  ): TraitAcquisitionTargetDomainEvaluation;
  function evaluate(
    queries: readonly TraitAcquisitionTargetDomainQuery[],
  ): readonly TraitAcquisitionTargetDomainEvaluation[];
  function evaluate(query: CirceResolutionDomainQuery): CirceResolutionDomainEvaluation;
  function evaluate(
    queries: readonly CirceResolutionDomainQuery[],
  ): readonly CirceResolutionDomainEvaluation[];
  function evaluate(query: EchoPomTargetDomainQuery): EchoPomTargetDomainEvaluation;
  function evaluate(
    queries: readonly EchoPomTargetDomainQuery[],
  ): readonly EchoPomTargetDomainEvaluation[];
  function evaluate(query: EchoLastRunBoonDomainQuery): EchoLastRunBoonDomainEvaluation;
  function evaluate(
    queries: readonly EchoLastRunBoonDomainQuery[],
  ): readonly EchoLastRunBoonDomainEvaluation[];
  function evaluate(query: EchoLastRewardDomainQuery): EchoLastRewardDomainEvaluation;
  function evaluate(
    queries: readonly EchoLastRewardDomainQuery[],
  ): readonly EchoLastRewardDomainEvaluation[];
  function evaluate(query: AllTogetherSetDomainQuery): AllTogetherSetDomainEvaluation;
  function evaluate(
    queries: readonly AllTogetherSetDomainQuery[],
  ): readonly AllTogetherSetDomainEvaluation[];
  function evaluate(query: ProjectCandidateSessionQuery): ProjectCandidateSessionEvaluation;
  function evaluate(
    queries: readonly ProjectCandidateSessionQuery[],
  ): readonly ProjectCandidateSessionEvaluation[];
  function evaluate(
    queryOrQueries: ProjectCandidateSessionQuery | readonly ProjectCandidateSessionQuery[],
  ): ProjectCandidateSessionEvaluation | readonly ProjectCandidateSessionEvaluation[] {
    if (!Array.isArray(queryOrQueries)) {
      return evaluateCandidateQuery(
        catalog,
        assembly,
        candidateArtifacts,
        queryOrQueries as ProjectCandidateSessionQuery,
        options.observe,
      );
    }
    const queries = queryOrQueries as readonly ProjectCandidateSessionQuery[];
    options.observe?.(Object.freeze({ kind: 'queryBatch', queryCount: queries.length }));
    return Object.freeze(
      queries.map((query) =>
        evaluateCandidateQuery(catalog, assembly, candidateArtifacts, query, options.observe),
      ),
    );
  }
  const traitCapability = (owner: TraitOfferAddress) =>
    candidateArtifacts
      .biomeAt(createBiomeAddress(owner.routeKey, owner.biomeKey))
      ?.traitOffers.at(owner);
  return Object.freeze({
    project,
    evaluation,
    evaluate,
    traitOfferStartingDraft: (owner: TraitOfferAddress, giverKey: string) =>
      traitCapability(owner)?.traitsStartingDraft(giverKey),
    nextTraitOfferDraft: (owner: TraitOfferAddress, value: AuthoredTraitOfferTraits) =>
      traitCapability(owner)?.nextTraitOptionDraft(value),
    nextOptionalHighTierTraitOfferDraft: (
      owner: TraitOfferAddress,
      value: AuthoredTraitOfferTraits,
    ) => traitCapability(owner)?.nextOptionalHighTierDraft(value),
    previousOptionalHighTierTraitOfferDraft: (
      owner: TraitOfferAddress,
      value: AuthoredTraitOfferTraits,
    ) => traitCapability(owner)?.previousOptionalHighTierDraft(value),
  });
}
