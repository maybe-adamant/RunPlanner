import type {
  BatchRewardStoreAddress,
  BiomeAddress,
  IncomingRewardAddress,
  OccurrenceAddress,
  ShopOfferAddress,
  ShopPurchaseAddress,
  TargetAddress,
} from '../../project/addresses';
import type { ResolvedRewardOffer } from '../../rewardKernel/model';
import type { RoomGenerationExclusionReason } from '../generation';
import type { FindingCode, SemanticFinding } from '../model';

export type CandidateSupport = 'forced' | 'impossible' | 'possible';

export type CandidateContextUnavailableReason =
  'biomeIncomplete' | 'simulatorUnavailable' | 'upstreamIncomplete' | 'upstreamInvalid';

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
  | IncomingRewardCandidateQuery
  | RoomTargetCandidateQuery
  | ShopOfferCandidateQuery
  | ShopPurchaseCandidateQuery
  | StartRoomCandidateQuery;

export interface UnavailableCandidateEvaluation {
  readonly context: 'unavailable';
  readonly query: ProjectCandidateQuery;
  readonly reason: CandidateContextUnavailableReason;
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
}

export interface RewardCandidateEvidence {
  readonly candidate: ResolvedRewardOffer;
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
  | EvaluatedIncomingRewardCandidate
  | EvaluatedRoomTargetCandidate
  | EvaluatedShopOfferCandidate
  | EvaluatedShopPurchaseCandidate
  | EvaluatedStartRoomCandidate
  | UnavailableCandidateEvaluation;

export interface ProjectCandidateEvaluator {
  readonly evaluate: (
    queries: readonly ProjectCandidateQuery[],
  ) => readonly ProjectCandidateEvaluation[];
}
