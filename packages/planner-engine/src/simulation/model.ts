import type { SemanticAddress } from '../authored-project/addresses';

export type FindingSeverity = 'error' | 'warning';

export type SimulationPhase =
  'completeness' | 'encounterResolution' | 'rewardGeneration' | 'roomGeneration';

export type CompletenessFindingCode =
  | 'batchRewardStoreMissing'
  | 'batchStateMissing'
  | 'biomeFieldMissing'
  | 'biomeTopologyMissing'
  | 'continuationMissing'
  | 'hubOpenSetIncomplete'
  | 'hubVisitOrderIncomplete'
  | 'pickedShopStateMissing'
  | 'pickedTargetMissing'
  | 'targetMissing';

export type RoomGenerationFindingCode =
  | 'fieldsCageOutcomeUnavailable'
  | 'fieldsSpatialPointMissing'
  | 'fieldsSpatialPointUnavailable'
  | 'fieldsSpatialPointDuplicate'
  | 'hubOpenSlotUnavailable'
  | 'resourcePlacementUnavailable'
  | 'sideRoomGenerationUnavailable'
  | 'targetRoomSupportEmpty'
  | 'targetRoomUnavailable';

export type EncounterResolutionFindingCode =
  'encounterSlotActivationUnavailable' | 'encounterUnavailable' | 'figLeafSkipUnavailable';

export type RewardGenerationFindingCode =
  | 'baseRewardStoreUnavailable'
  | 'rewardMissing'
  | 'rewardAcquisitionUnavailable'
  | 'rewardBagSupportEmpty'
  | 'rewardBagEntryUnavailable'
  | 'rewardPayloadInvalid'
  | 'rewardSourceUnavailable'
  | 'shopOfferUnavailable'
  | 'shopPurchaseUnavailable'
  | 'judgmentOutcomeMissing'
  | 'judgmentOutcomeWrongCardinality'
  | 'judgmentOutcomeTargetUnavailable'
  | 'figurineOutcomeMissing'
  | 'figurineOutcomeWrongCardinality'
  | 'figurineOutcomeTargetUnavailable'
  | 'keepsakeUnavailable'
  | 'timePieceConversionUnavailable'
  | 'artificerConversionUnavailable'
  | 'seaStarDuplicationUnavailable'
  | 'artificerReplacementUnavailable'
  | 'keepsakeEquipResultMissing'
  | 'keepsakeEquipResultUnavailable'
  | 'steadyGrowthOutcomeMissing'
  | 'steadyGrowthOutcomeUnavailable'
  | 'transcendentEmbryoOutcomeMissing'
  | 'transcendentEmbryoOutcomeUnavailable'
  | 'fountainRarityResultMissing'
  | 'fountainRarityResultUnavailable'
  | 'stygianWellMissing'
  | 'stygianWellWrongGroup'
  | 'stygianWellDuplicate'
  | 'stygianWellPlacementUnavailable'
  | 'stygianWellTravelDealRefillUnavailable'
  | 'stygianWellTwistInvalid'
  | 'ixionChaosMissing'
  | 'ixionChaosUnavailable'
  | 'fieldsOptionalCapacityUnavailable'
  | 'nemesisOutcomeMissing'
  | 'nemesisOutcomeUnavailable'
  | 'purgingPoolSaleUnavailable'
  | 'purgingPoolTraitMissing'
  | 'purgingPoolTraitUnavailable'
  | 'purgingPoolTraitDuplicate'
  | 'purgingPoolWrongCardinality'
  | 'hermesShrinePlacementUnavailable'
  | 'hermesShrineInventoryMissing'
  | 'hermesShrineInventoryWrongGroup'
  | 'hermesShrineInventoryDuplicate'
  | 'hermesShrineInventoryRequirement'
  | 'hermesShrineDeliveryPlacementRequired'
  | 'hermesShrineTravelDealRefillMissing'
  | 'hermesShrineTravelDealRefillUnavailable';

export type TraitFindingCode =
  | 'callingCardRarificationUnavailable'
  | 'traitOfferMissing'
  | 'alreadyEquipped'
  | 'previouslyPicked'
  | 'bannedTrait'
  | 'missingPrerequisite'
  | 'negativePrerequisite'
  | 'offerContext'
  | 'elementThreshold'
  | 'rarityCount'
  | 'rarifiableTarget'
  | 'targetedAcquisitionNoEligibleTarget'
  | 'targetedAcquisitionTargetMissing'
  | 'targetedAcquisitionTargetUnavailable'
  | 'occupiedBoonSlot'
  | 'freshRarityUnavailable'
  | 'rarityRollUnavailable'
  | 'replacementUnavailable'
  | 'replacementMaximumRarity'
  | 'replacementRarityMismatch'
  | 'replacementCompositionExceeded'
  | 'fullTraitOfferWidthRequired'
  | 'missingMandatoryOrdinary'
  | 'missingForcedReplacement'
  | 'unsupportedSparseTraitOffer'
  | 'fallbackGoldUnavailable'
  | 'traitOfferSelectionUnavailable'
  | 'wrongHammerLoadout'
  | 'naturalSelectionResultMissing'
  | 'naturalSelectionResultUnavailable'
  | 'concaveStoneResultMissing'
  | 'concaveStoneResultUnavailable'
  | 'nonPriorityTrait'
  | 'missingAttackOrSpecial'
  | 'circeResolutionMissing'
  | 'circeResolutionWrongCardinality'
  | 'circeResolutionTargetUnavailable'
  | 'circeOptionUnavailable'
  | 'echoPomTargetMissing'
  | 'echoPomNoTargetUnavailable'
  | 'echoPomTargetUnavailable'
  | 'echoLastRunBoonMissing'
  | 'echoLastRunBoonOptionUnavailable'
  | 'allTogetherResultMissing'
  | 'allTogetherResultUnavailable'
  | 'chaosRejectedBlockMissing'
  | 'chaosRejectedBlockUnavailable'
  | 'chaosPairUnavailable'
  | 'persephoneLevelBonusUnavailable';

export type FindingCode =
  | CompletenessFindingCode
  | EncounterResolutionFindingCode
  | RewardGenerationFindingCode
  | TraitFindingCode
  | 'missingPomTarget'
  | 'pomWrongOfferCount'
  | 'pomSelectedTargetNotOffered'
  | 'pomTargetUnavailable'
  | RoomGenerationFindingCode;

export type FindingEvidenceValue =
  | boolean
  | number
  | string
  | null
  | readonly FindingEvidenceValue[]
  | { readonly [key: string]: FindingEvidenceValue };

export type FindingEvidence = Readonly<Record<string, FindingEvidenceValue>>;

export interface SemanticFinding {
  readonly code: FindingCode;
  readonly severity: FindingSeverity;
  readonly phase: SimulationPhase;
  readonly origin: SemanticAddress;
  readonly evidence: FindingEvidence;
}

/**
 * Missing authored payload that may stop an acquisition chronology without
 * making its persisted participation/order structurally impossible.
 */
export function isAcquisitionAuthorshipMissingFinding(finding: SemanticFinding): boolean {
  switch (finding.code) {
    case 'rewardMissing':
    case 'traitOfferMissing':
    case 'allTogetherResultMissing':
      return true;
    default:
      return false;
  }
}

/**
 * Required authored input, distinct from an authored value that is invalid in
 * its reached context. Readiness uses this closed classification; it never
 * infers incompleteness from wording or from lack of candidate coverage.
 */
export function isRequiredMissingInputFinding(
  finding: SemanticFinding | undefined,
): finding is SemanticFinding {
  if (finding === undefined) return false;
  switch (finding.code) {
    case 'batchRewardStoreMissing':
    case 'batchStateMissing':
    case 'biomeFieldMissing':
    case 'biomeTopologyMissing':
    case 'continuationMissing':
    case 'hubOpenSetIncomplete':
    case 'hubVisitOrderIncomplete':
    case 'pickedShopStateMissing':
    case 'pickedTargetMissing':
    case 'targetMissing':
    case 'fieldsSpatialPointMissing':
    case 'chaosRejectedBlockMissing':
    case 'hermesShrineDeliveryPlacementRequired':
    case 'rewardMissing':
    case 'traitOfferMissing':
    case 'allTogetherResultMissing':
    case 'judgmentOutcomeMissing':
    case 'figurineOutcomeMissing':
    case 'keepsakeEquipResultMissing':
    case 'steadyGrowthOutcomeMissing':
    case 'transcendentEmbryoOutcomeMissing':
    case 'fountainRarityResultMissing':
    case 'stygianWellMissing':
    case 'purgingPoolTraitMissing':
    case 'nemesisOutcomeMissing':
    case 'naturalSelectionResultMissing':
    case 'concaveStoneResultMissing':
    case 'circeResolutionMissing':
    case 'echoPomTargetMissing':
    case 'echoLastRunBoonMissing':
    case 'hermesShrineInventoryMissing':
    case 'hermesShrineTravelDealRefillMissing':
    case 'targetedAcquisitionTargetMissing':
    case 'missingPomTarget':
      return true;
    case 'stygianWellTwistInvalid':
      return finding.evidence.reason === 'twistMissing';
    case 'stygianWellTravelDealRefillUnavailable':
      return finding.evidence.reason === 'refillMissing';
    default:
      return false;
  }
}
