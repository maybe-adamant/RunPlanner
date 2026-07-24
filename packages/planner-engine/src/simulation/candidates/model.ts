import type {
  BatchRewardStoreAddress,
  BiomeAddress,
  ContinuationAddress,
  HubSlotAddress,
  HubVisitAddress,
  IncomingRewardAddress,
  LocalChildAddress,
  LocalChildGroupAddress,
  LocalRewardAddress,
  OccurrenceAddress,
  RewardWheelAddress,
  RewardWheelOfferAddress,
  SemanticAddress,
  ShopOfferAddress,
  ShopPurchaseAddress,
  TargetAddress,
} from '../../authored-project/addresses';
import type {
  OccurrenceId,
  ProjectDocument,
  SideRoomGeneration,
} from '../../authored-project/model';
import type { ResolvedRewardOffer } from '../../reward-kernel/model';
import type { RoomGenerationExclusionEvidence, RoomGenerationExclusionReason } from '../generation';
import type { FindingCode, SemanticFinding } from '../model';
import type { BiomeEvaluationCheckpoint, BiomeEvaluationCoverage } from '../project';
import type { ProjectEvaluation } from '../project';

export type CandidateSupport = 'forced' | 'impossible' | 'possible';

export type CandidateContextUnavailableReason =
  'coverageNotReached' | 'producerFrontierUnavailable' | 'upstreamIncomplete' | 'upstreamInvalid';

export type CandidateContextUnavailableEvidence =
  | {
      readonly kind: 'coverageNotReached';
      readonly requiredOwner: SemanticAddress;
      readonly requiredCheckpoint: BiomeEvaluationCheckpoint;
      readonly coverage: BiomeEvaluationCoverage;
    }
  | {
      readonly kind: 'upstreamIncomplete' | 'upstreamInvalid';
      readonly upstreamBiomeKey: string;
    }
  | {
      readonly kind: 'producerFrontierUnavailable';
      readonly producer: SemanticAddress;
    };

export interface RoomTargetCandidateQuery {
  readonly kind: 'roomTarget';
  readonly target: TargetAddress;
  readonly gameName: string;
}

export interface StartRoomCandidateQuery {
  readonly kind: 'startRoom';
  readonly owner: BiomeAddress | OccurrenceAddress;
  readonly gameName: string;
}

export interface BatchRewardStoreCandidateQuery {
  readonly kind: 'batchRewardStore';
  readonly rewardStore: BatchRewardStoreAddress;
  readonly storeKey: string;
}

export interface IncomingRewardCandidateQuery {
  readonly kind: 'incomingReward';
  readonly reward: IncomingRewardAddress;
  readonly value: ResolvedRewardOffer;
}

export interface LocalRewardCandidateQuery {
  readonly kind: 'localReward';
  readonly reward: LocalRewardAddress;
  readonly value: ResolvedRewardOffer;
}

export interface FieldsCageOutcomeCandidateQuery {
  readonly kind: 'fieldsCageOutcome';
  readonly continuation: ContinuationAddress;
  readonly cageOutcome: 'min' | 'max';
}

export interface ShipEncounterCountCandidateQuery {
  readonly kind: 'shipEncounterCount';
  readonly occurrence: OccurrenceAddress;
  readonly encounterCount: 2 | 3;
}

export interface RewardWheelOfferCountCandidateQuery {
  readonly kind: 'rewardWheelOfferCount';
  readonly wheel: RewardWheelAddress;
  readonly offerCount: number;
}

export interface RewardWheelStoreCandidateQuery {
  readonly kind: 'rewardWheelStore';
  readonly wheel: RewardWheelAddress;
  readonly storeKey: string;
}

export interface RewardWheelOfferCandidateQuery {
  readonly kind: 'rewardWheelOffer';
  readonly offer: RewardWheelOfferAddress;
  readonly value: ResolvedRewardOffer;
}

export interface RewardWheelPickedCandidateQuery {
  readonly kind: 'rewardWheelPicked';
  readonly wheel: RewardWheelAddress;
  readonly pickedOfferIndex: number;
}

export interface HubSlotCandidateQuery {
  readonly kind: 'hubSlot';
  readonly slot: HubSlotAddress;
  readonly open: boolean;
  readonly occurrenceId: OccurrenceId;
}

export interface HubVisitCandidateQuery {
  readonly kind: 'hubVisit';
  readonly visit: HubVisitAddress;
  readonly hubSlotKey: string;
}

export interface SideRoomGenerationCandidateQuery {
  readonly kind: 'sideRoomGeneration';
  readonly sideRoom: LocalChildAddress;
  readonly generation: SideRoomGeneration;
}

export interface SideRoomEntryOrderCandidateQuery {
  readonly kind: 'sideRoomEntryOrder';
  readonly group: LocalChildGroupAddress;
  readonly enteredSlotKeys: readonly string[];
}

export interface ShopOfferCandidateQuery {
  readonly kind: 'shopOffer';
  readonly offer: ShopOfferAddress;
  readonly value: ResolvedRewardOffer;
}

export interface ShopPurchaseCandidateQuery {
  readonly kind: 'shopPurchase';
  readonly purchase: ShopPurchaseAddress;
  readonly purchased: boolean;
}

export type ProjectCandidateQuery =
  | BatchRewardStoreCandidateQuery
  | FieldsCageOutcomeCandidateQuery
  | HubSlotCandidateQuery
  | HubVisitCandidateQuery
  | IncomingRewardCandidateQuery
  | LocalRewardCandidateQuery
  | RewardWheelOfferCandidateQuery
  | RewardWheelOfferCountCandidateQuery
  | RewardWheelPickedCandidateQuery
  | RewardWheelStoreCandidateQuery
  | RoomTargetCandidateQuery
  | ShipEncounterCountCandidateQuery
  | ShopOfferCandidateQuery
  | ShopPurchaseCandidateQuery
  | SideRoomEntryOrderCandidateQuery
  | SideRoomGenerationCandidateQuery
  | StartRoomCandidateQuery;

export interface UnavailableCandidateEvaluation {
  readonly context: 'unavailable';
  readonly query: ProjectCandidateQuery;
  readonly reason: CandidateContextUnavailableReason;
  readonly evidence: CandidateContextUnavailableEvidence;
}

export interface RoomTargetCandidateEvidence {
  readonly beforeSequence: number;
  readonly sourceGameName: string;
  readonly candidateGameName: string;
  readonly exitIndex: number;
  readonly biomeDepthCache: number;
  readonly biomeEncounterDepth: number;
  readonly candidateCreationCount: number;
  readonly candidateAppearanceCount: number;
  readonly candidateParentCreationCount: number;
  readonly eligibleRoomGameNames: readonly string[];
  readonly optionalForcedRoomGameNames: readonly string[];
  readonly requiredForcedRoomGameNames: readonly string[];
  readonly supportRoomGameNames: readonly string[];
  readonly exclusionReasons: readonly RoomGenerationExclusionReason[];
  readonly exclusions: readonly RoomGenerationExclusionEvidence[];
}

export interface EvaluatedRoomTargetCandidate {
  readonly context: 'evaluated';
  readonly query: RoomTargetCandidateQuery;
  readonly support: CandidateSupport;
  readonly findings: readonly SemanticFinding[];
  readonly evidence: RoomTargetCandidateEvidence;
}

export interface StartRoomCandidateEvidence {
  readonly candidateGameName: string;
  readonly supportedGameNames: readonly string[];
}

export interface BatchRewardStoreCandidateEvidence {
  readonly candidateStoreKey: string;
  readonly enteredStoreCount: number;
  readonly enteredMetaStoreCount: number;
  readonly currentMetaRatio: number | null;
  readonly metaSelectionValue: number;
  readonly supportStoreKeys: readonly string[];
  readonly exclusions: readonly RewardCandidateExclusionEvidence[];
}

export type RewardCandidateExclusionEvidence =
  | { readonly kind: 'store'; readonly storeKey?: string }
  | { readonly kind: 'bag'; readonly storeKey?: string }
  | {
      readonly kind: 'sibling';
      readonly priorOffers: readonly {
        readonly origin: SemanticAddress;
        readonly offer: ResolvedRewardOffer;
      }[];
    }
  | { readonly kind: 'boonSource'; readonly source?: string }
  | {
      readonly kind: 'devotionPair';
      readonly chosenSource?: string;
      readonly spurnedSource?: string;
    }
  | { readonly kind: 'payload' }
  | { readonly kind: 'shop' }
  | { readonly kind: 'acquisition' };

export interface RewardCandidateEvidence {
  readonly candidate: ResolvedRewardOffer;
  readonly relevantFindingCodes: readonly FindingCode[];
  readonly exclusions: readonly RewardCandidateExclusionEvidence[];
}

export interface FieldsCageOutcomeCandidateEvidence {
  readonly candidateOutcome: 'min' | 'max';
  readonly beforeSequence: number;
  readonly biomeDepthCache: number;
  readonly fieldsMaxDoorsRolled: number;
  readonly maxDoorCageCeiling: number;
  readonly supportOutcomes: readonly ('min' | 'max')[];
}

export interface ShipEncounterCountCandidateEvidence {
  readonly candidateEncounterCount: 2 | 3;
  readonly beforeSequence: number;
  readonly supportEncounterCounts: readonly number[];
  readonly relevantFindingCodes: readonly FindingCode[];
}

export interface RewardWheelOfferCountCandidateEvidence {
  readonly candidateOfferCount: number;
  readonly minimumOfferCount: number;
  readonly maximumOfferCount: number;
  readonly relevantFindingCodes: readonly FindingCode[];
}

export interface RewardWheelStoreCandidateEvidence {
  readonly candidateStoreKey: string;
  readonly supportedStoreKeys: readonly string[];
  readonly relevantFindingCodes: readonly FindingCode[];
}

export interface RewardWheelPickedCandidateEvidence {
  readonly candidatePickedOfferIndex: number;
  readonly activeOfferIndexes: readonly number[];
  readonly relevantFindingCodes: readonly FindingCode[];
}

export interface HubSlotCandidateEvidence {
  readonly candidateOpen: boolean;
  readonly currentlyOpen: boolean;
  readonly openSlotKeys: readonly string[];
  readonly minimumOpenCount: number;
  readonly maximumOpenCount: number;
  readonly referencedVisitIndexes: readonly number[];
  readonly relevantFindingCodes: readonly FindingCode[];
}

export interface HubVisitCandidateEvidence {
  readonly candidateHubSlotKey: string;
  readonly openHubSlotKeys: readonly string[];
  readonly occupiedVisitIndexes: readonly number[];
  readonly relevantFindingCodes: readonly FindingCode[];
}

export interface SideRoomGenerationCandidateEvidence {
  readonly candidateGeneration: SideRoomGeneration;
  readonly enteredOrdinal: number | null;
  readonly generatedBefore: number;
  readonly requiredGeneratedCount: number;
  readonly supportOutcomes: readonly SideRoomGeneration[];
  readonly relevantFindingCodes: readonly FindingCode[];
}

export interface SideRoomEntryOrderCandidateEvidence {
  readonly candidateEnteredSlotKeys: readonly string[];
  readonly generatedSlotKeys: readonly string[];
  readonly relevantFindingCodes: readonly FindingCode[];
}

export interface ShopPurchaseCandidateEvidence {
  readonly purchased: boolean;
  readonly relevantFindingCodes: readonly FindingCode[];
}

export interface EvaluatedStartRoomCandidate {
  readonly context: 'evaluated';
  readonly query: StartRoomCandidateQuery;
  readonly support: CandidateSupport;
  readonly findings: readonly SemanticFinding[];
  readonly evidence: StartRoomCandidateEvidence;
}

export interface EvaluatedBatchRewardStoreCandidate {
  readonly context: 'evaluated';
  readonly query: BatchRewardStoreCandidateQuery;
  readonly support: CandidateSupport;
  readonly findings: readonly SemanticFinding[];
  readonly evidence: BatchRewardStoreCandidateEvidence;
}

export interface EvaluatedIncomingRewardCandidate {
  readonly context: 'evaluated';
  readonly query: IncomingRewardCandidateQuery;
  readonly support: CandidateSupport;
  readonly findings: readonly SemanticFinding[];
  readonly evidence: RewardCandidateEvidence;
}

export interface EvaluatedLocalRewardCandidate {
  readonly context: 'evaluated';
  readonly query: LocalRewardCandidateQuery;
  readonly support: CandidateSupport;
  readonly findings: readonly SemanticFinding[];
  readonly evidence: RewardCandidateEvidence;
}

export interface EvaluatedFieldsCageOutcomeCandidate {
  readonly context: 'evaluated';
  readonly query: FieldsCageOutcomeCandidateQuery;
  readonly support: CandidateSupport;
  readonly findings: readonly SemanticFinding[];
  readonly evidence: FieldsCageOutcomeCandidateEvidence;
}

export interface EvaluatedShipEncounterCountCandidate {
  readonly context: 'evaluated';
  readonly query: ShipEncounterCountCandidateQuery;
  readonly support: CandidateSupport;
  readonly findings: readonly SemanticFinding[];
  readonly evidence: ShipEncounterCountCandidateEvidence;
}

export interface EvaluatedRewardWheelOfferCountCandidate {
  readonly context: 'evaluated';
  readonly query: RewardWheelOfferCountCandidateQuery;
  readonly support: CandidateSupport;
  readonly findings: readonly SemanticFinding[];
  readonly evidence: RewardWheelOfferCountCandidateEvidence;
}

export interface EvaluatedRewardWheelStoreCandidate {
  readonly context: 'evaluated';
  readonly query: RewardWheelStoreCandidateQuery;
  readonly support: CandidateSupport;
  readonly findings: readonly SemanticFinding[];
  readonly evidence: RewardWheelStoreCandidateEvidence;
}

export interface EvaluatedRewardWheelOfferCandidate {
  readonly context: 'evaluated';
  readonly query: RewardWheelOfferCandidateQuery;
  readonly support: CandidateSupport;
  readonly findings: readonly SemanticFinding[];
  readonly evidence: RewardCandidateEvidence;
}

export interface EvaluatedRewardWheelPickedCandidate {
  readonly context: 'evaluated';
  readonly query: RewardWheelPickedCandidateQuery;
  readonly support: CandidateSupport;
  readonly findings: readonly SemanticFinding[];
  readonly evidence: RewardWheelPickedCandidateEvidence;
}

export interface EvaluatedHubSlotCandidate {
  readonly context: 'evaluated';
  readonly query: HubSlotCandidateQuery;
  readonly support: CandidateSupport;
  readonly findings: readonly SemanticFinding[];
  readonly evidence: HubSlotCandidateEvidence;
}

export interface EvaluatedHubVisitCandidate {
  readonly context: 'evaluated';
  readonly query: HubVisitCandidateQuery;
  readonly support: CandidateSupport;
  readonly findings: readonly SemanticFinding[];
  readonly evidence: HubVisitCandidateEvidence;
}

export interface EvaluatedSideRoomGenerationCandidate {
  readonly context: 'evaluated';
  readonly query: SideRoomGenerationCandidateQuery;
  readonly support: CandidateSupport;
  readonly findings: readonly SemanticFinding[];
  readonly evidence: SideRoomGenerationCandidateEvidence;
}

export interface EvaluatedSideRoomEntryOrderCandidate {
  readonly context: 'evaluated';
  readonly query: SideRoomEntryOrderCandidateQuery;
  readonly support: CandidateSupport;
  readonly findings: readonly SemanticFinding[];
  readonly evidence: SideRoomEntryOrderCandidateEvidence;
}

export interface EvaluatedShopOfferCandidate {
  readonly context: 'evaluated';
  readonly query: ShopOfferCandidateQuery;
  readonly support: CandidateSupport;
  readonly findings: readonly SemanticFinding[];
  readonly evidence: RewardCandidateEvidence;
}

export interface EvaluatedShopPurchaseCandidate {
  readonly context: 'evaluated';
  readonly query: ShopPurchaseCandidateQuery;
  readonly support: CandidateSupport;
  readonly findings: readonly SemanticFinding[];
  readonly evidence: ShopPurchaseCandidateEvidence;
}

export type ProjectCandidateEvaluation =
  | EvaluatedBatchRewardStoreCandidate
  | EvaluatedFieldsCageOutcomeCandidate
  | EvaluatedHubSlotCandidate
  | EvaluatedHubVisitCandidate
  | EvaluatedIncomingRewardCandidate
  | EvaluatedLocalRewardCandidate
  | EvaluatedRewardWheelOfferCandidate
  | EvaluatedRewardWheelOfferCountCandidate
  | EvaluatedRewardWheelPickedCandidate
  | EvaluatedRewardWheelStoreCandidate
  | EvaluatedRoomTargetCandidate
  | EvaluatedShipEncounterCountCandidate
  | EvaluatedShopOfferCandidate
  | EvaluatedShopPurchaseCandidate
  | EvaluatedSideRoomEntryOrderCandidate
  | EvaluatedSideRoomGenerationCandidate
  | EvaluatedStartRoomCandidate
  | UnavailableCandidateEvaluation;

export interface ProjectCandidateEvaluator {
  readonly evaluate: (
    queries: readonly ProjectCandidateQuery[],
  ) => readonly ProjectCandidateEvaluation[];
}

export interface ProjectCandidateSession extends ProjectCandidateEvaluator {
  readonly project: ProjectDocument;
  readonly evaluation: ProjectEvaluation;
}

export type CandidateEvaluationEvent =
  | {
      readonly kind: 'queryBatch';
      readonly queryCount: number;
    }
  | {
      readonly kind: 'regionReplay';
      readonly queryKind: ProjectCandidateQuery['kind'];
      readonly routeKey: string;
      readonly biomeKey: string;
      readonly scope: 'hubVisit' | 'hubLocal';
    };

export interface ProjectCandidateSessionOptions {
  readonly observe?: (event: CandidateEvaluationEvent) => void;
}
