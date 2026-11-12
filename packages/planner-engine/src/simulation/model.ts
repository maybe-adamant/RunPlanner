import type { SemanticAddress } from '../authored-project/addresses';
import type { RoomEventPoint } from '../authored-project/room-actions/event-graph';

export type SimulationPhase =
  'completeness' | 'encounterResolution' | 'rewardGeneration' | 'roomGeneration';

export type CompletenessFindingCode =
  | 'batchRewardStoreMissing'
  | 'batchStateMissing'
  | 'biomeFieldMissing'
  | 'biomeTopologyMissing'
  | 'hubOpenSetIncomplete'
  | 'hubVisitOrderIncomplete'
  | 'pickedTargetMissing'
  | 'planEndUnreached'
  | 'roomActionPlacementRequired'
  | 'targetMissing';

export type RoomGenerationFindingCode =
  | 'fieldsCageOutcomeUnavailable'
  | 'fieldsSpatialPointUnavailable'
  | 'fieldsSpatialPointDuplicate'
  | 'roomLayoutEntryUnavailable'
  | 'roomLayoutFlipUnavailable'
  | 'roomObjectAnchorUnavailable'
  | 'roomObjectAnchorDuplicate'
  | 'hubOpenSlotUnavailable'
  /** A stored Hub or side visit entering a room visited before it. */
  | 'roomAlreadyVisited'
  | 'resourcePlacementUnavailable'
  | 'sideRoomGenerationUnavailable'
  | 'targetRoomSupportEmpty'
  | 'targetRoomUnavailable';

export type EncounterResolutionFindingCode =
  | 'roomActionOrderUnavailable'
  /** A ranked row whose item was replaced since it was placed. */
  | 'roomActionItemReplaced'
  | 'encounterSlotActivationUnavailable'
  | 'encounterUnavailable'
  | 'encounterCustomizationUnavailable'
  | 'encounterIntroductionRequired'
  | 'figLeafSkipUnavailable'
  | 'gorgonConditionUnavailable'
  | 'aetosAppearanceUnavailable';

export type RewardGenerationFindingCode =
  | 'baseRewardStoreUnavailable'
  | 'rewardMissing'
  | 'phantomExitPlaceholderUnavailable'
  | 'phantomExitRewardUnavailable'
  | 'rerollUnavailable'
  | 'rerollTargetUnavailable'
  | 'rerollPoolExceeded'
  | 'screenRerollUnavailable'
  | 'rollOfferUnavailable'
  | 'rollRepeatsAllOffers'
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
  | 'erisSpawnUnavailable'
  | 'challengeSwitchPlacementUnavailable'
  | 'challengeSwitchEliteUnavailable'
  | 'challengeSwitchCustomizationUnavailable'
  | 'challengeSwitchLeftNotLast'
  | 'unlockExitCustomizationUnavailable'
  | 'lockedExitSelected'
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
  | 'purgingPoolUnavailable'
  | 'purgingPoolTraitMissing'
  | 'purgingPoolTraitUnavailable'
  | 'purgingPoolTraitDuplicate'
  | 'hermesShrinePlacementUnavailable'
  | 'hermesShrineInventoryMissing'
  | 'hermesShrineInventoryWrongGroup'
  | 'hermesShrineInventoryDuplicate'
  | 'hermesShrineInventoryRequirement'
  | 'hermesShrineDeliveryPlacementRequired'
  | 'echoGoldPickupPlacementRequired'
  | 'hermesShrineTravelDealRefillMissing'
  | 'hermesShrineTravelDealRefillUnavailable'
  | 'hexActivationMissing'
  | 'hexActivationUnavailable';

export type TraitFindingCode =
  | 'callingCardRarificationUnavailable'
  | 'traitOfferMissing'
  | 'rerolledScreenMissing'
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
  | 'traitOfferGenerationUnavailable'
  /** A rerolled trait screen that only appears with no item of the previous screen banned. */
  | 'rollRepeatsAllOffers'
  | 'unsupportedSparseTraitOffer'
  | 'traitOfferSelectionUnavailable'
  | 'wrongHammerLoadout'
  | 'naturalSelectionResultMissing'
  | 'naturalSelectionResultUnavailable'
  | 'concaveStoneResultMissing'
  | 'concaveStoneResultUnavailable'
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
  | 'persephoneLevelBonusUnavailable'
  | 'hexTalentTreeUnavailable';

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

/**
 * A `roomActionOrderUnavailable` finding's evidence, in its bound's vocabulary:
 * the point the row stands before, or the deadline it stands past, and the
 * action that must come first or that stands only after that deadline.
 */
export type RoomActionOrderEvidence =
  | { readonly reason: 'dependency'; readonly prerequisite: string }
  | {
      readonly reason: 'pastDeadline';
      readonly deadline: RoomEventPoint;
      readonly precedingAction: string;
    }
  | {
      readonly reason: 'beforeSpawn' | 'beforeEnabler';
      readonly point: RoomEventPoint;
      readonly requiredAction?: string;
      /** The point names a phase the room no longer plays. */
      readonly unavailable?: true;
    };

/** The order evidence of a `roomActionOrderUnavailable` finding. */
export function roomActionOrderEvidence(
  finding: SemanticFinding,
): RoomActionOrderEvidence | undefined {
  return finding.code === 'roomActionOrderUnavailable'
    ? (finding.evidence as RoomActionOrderEvidence)
    : undefined;
}

export interface SemanticFinding {
  readonly code: FindingCode;
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
    case 'hexActivationMissing':
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
    case 'hubOpenSetIncomplete':
    case 'hubVisitOrderIncomplete':
    case 'pickedTargetMissing':
    case 'roomActionPlacementRequired':
    case 'targetMissing':
    case 'chaosRejectedBlockMissing':
    case 'hermesShrineDeliveryPlacementRequired':
    case 'echoGoldPickupPlacementRequired':
    case 'hexActivationMissing':
    case 'rewardMissing':
    case 'traitOfferMissing':
    case 'rerolledScreenMissing':
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
