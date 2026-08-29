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
  | 'fieldsActionDependency'
  | 'fieldsActionInactive'
  | 'fieldsActionMissing'
  | 'hubOpenSetIncomplete'
  | 'hubVisitOrderIncomplete'
  | 'pickedShopStateMissing'
  | 'pickedTargetMissing'
  | 'targetMissing';

export type RoomGenerationFindingCode =
  | 'fieldsCageOutcomeUnavailable'
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
  | 'sparkChaosMissing'
  | 'sparkChaosUnavailable'
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
  | 'echoShopDuplicateChildMissing'
  | 'allTogetherResultMissing'
  | 'allTogetherResultUnavailable'
  | 'chaosOrdinaryRequiresCommon'
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
