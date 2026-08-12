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
  | 'hubOpenSlotUnavailable'
  | 'sideRoomGenerationUnavailable'
  | 'targetRoomSupportEmpty'
  | 'targetRoomUnavailable';

export type EncounterResolutionFindingCode =
  'encounterSlotActivationUnavailable' | 'encounterUnavailable';

export type RewardGenerationFindingCode =
  | 'baseRewardStoreUnavailable'
  | 'rewardAcquisitionUnavailable'
  | 'rewardBagSupportEmpty'
  | 'rewardBagEntryUnavailable'
  | 'rewardPayloadInvalid'
  | 'rewardSourceUnavailable'
  | 'shopOfferUnavailable'
  | 'shopPurchaseUnavailable'
  | 'judgmentOutcomeMissing'
  | 'judgmentOutcomeWrongCardinality'
  | 'judgmentOutcomeTargetUnavailable';

export type TraitFindingCode =
  | 'alreadyEquipped'
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
  | 'rarityBelowActiveFloor'
  | 'replacementUnavailable'
  | 'replacementMaximumRarity'
  | 'replacementRarityMismatch'
  | 'replacementCompositionExceeded'
  | 'wrongHammerLoadout'
  | 'nonPriorityTrait'
  | 'missingAttackOrSpecial';

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
