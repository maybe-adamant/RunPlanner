import {
  semanticAddressKey,
  type BiomeAddress,
  type TargetAddress,
  type JudgmentArcanaAddress,
  type FigurineArcanaAddress,
  type KeepsakeSelectionAddress,
  type KeepsakeEquipResultAddress,
  type SteadyGrowthOutcomeAddress,
  type TranscendentEmbryoOutcomeAddress,
  type FountainRarityOutcomeAddress,
  type AcquisitionRoleAddress,
  type OccurrenceAddress,
} from '../authored-project/addresses';
import type { Catalog } from '../catalog-schema';
import type { ArcanaFearState } from './arcana-fear';
import type { RoomTargetCandidateContext } from './generation/model';
import {
  createEmptyRewardProducerCandidateArtifacts,
  type RewardProducerCandidateArtifacts,
} from './rewards/producer-frontiers';
import {
  createEmptyRoomLifecycleCandidateArtifacts,
  type RoomLifecycleCandidateArtifacts,
} from './rewards/lifecycle-artifacts';
import type { EncounterCandidateArtifacts } from './encounters';
import {
  type TraitHistoryState,
  type ReachedSteadyGrowthThreshold,
  type SteadyGrowthTargetAssessment,
  assessSteadyGrowthTarget,
} from './traits';
import { assessTranscendentEmbryoTransformation } from './keepsakes';
import type {
  ReachedTranscendentEmbryoThreshold,
  TranscendentEmbryoBlessingAssessment,
} from './keepsakes';
import {
  createEmptyLevelResolutionCandidateArtifacts,
  createEmptyTraitOfferCandidateArtifacts,
  type LevelResolutionCandidateArtifacts,
  type TraitOfferCandidateArtifacts,
} from './candidates/trait-offer-capability';
import type { KeepsakeState } from './keepsakes';
import type { AcquisitionSource } from './rewards/acquisition-settlement';
import type { ConcreteAcquisitionEvent } from '../reward-kernel';
import {
  assessArtificerConversion,
  assessSeaStarDuplication,
  assessTimePieceConversion,
} from './rewards/acquisition-settlement';
import type { RewardBranchState } from './rewards/branch-primitives';

function emptyEncounterCandidateArtifacts(): EncounterCandidateArtifacts {
  return Object.freeze({
    at: () => undefined,
    statusAt: () => undefined,
    gorgonAt: () => undefined,
    nemesisAt: () => undefined,
    roomAt: () => undefined,
    figLeafAt: () => undefined,
  });
}

/**
 * The room-target capability produced while one biome is evaluated.
 *
 * Its backing index is deliberately private: downstream composition may carry
 * this product, but only the room-target evaluator can ask it for a context.
 */
export interface RoomTargetCandidateArtifacts {
  readonly at: (target: TargetAddress) => RoomTargetCandidateContext | undefined;
}

/** Atomic exact-set support captured immediately before one fixed Boss effect. */
export interface JudgmentArcanaCandidateCapability {
  readonly inactiveArcanaKeys: readonly string[];
  readonly requiredCount: number;
}
export interface JudgmentArcanaCandidateArtifacts {
  readonly at: (address: JudgmentArcanaAddress) => JudgmentArcanaCandidateCapability | undefined;
}
/** Atomic exact-set support captured immediately after Judgment at one Boss effect. */
export interface FigurineArcanaCandidateCapability {
  readonly inactiveArcanaKeys: readonly string[];
  readonly requiredCount: number;
  readonly rarity: import('../catalog-schema').TraitRarity;
}
export interface FigurineArcanaCandidateArtifacts {
  readonly at: (address: FigurineArcanaAddress) => FigurineArcanaCandidateCapability | undefined;
}

/** Exact threshold frontiers retained at one automatic Steady Growth row. */
export interface SteadyGrowthCandidateCapability {
  readonly thresholds: readonly ReachedSteadyGrowthThreshold[];
  readonly evaluate: (
    targetTraitKey: string | null | undefined,
  ) => readonly SteadyGrowthTargetAssessment[];
}
export interface SteadyGrowthCandidateArtifacts {
  readonly at: (address: SteadyGrowthOutcomeAddress) => SteadyGrowthCandidateCapability | undefined;
}
export function createSteadyGrowthCandidateArtifacts(
  catalog: Catalog,
  contexts: ReadonlyMap<string, readonly ReachedSteadyGrowthThreshold[]>,
): SteadyGrowthCandidateArtifacts {
  const privateContexts = new Map(contexts);
  return Object.freeze({
    at: (address: SteadyGrowthOutcomeAddress) => {
      const thresholds = privateContexts.get(semanticAddressKey(address));
      if (thresholds === undefined) return undefined;
      return Object.freeze({
        thresholds,
        evaluate: (targetTraitKey: string | null | undefined) =>
          Object.freeze(
            thresholds.map((threshold) =>
              assessSteadyGrowthTarget(catalog, threshold, targetTraitKey),
            ),
          ),
      });
    },
  });
}
function createEmptySteadyGrowthCandidateArtifacts(): SteadyGrowthCandidateArtifacts {
  return Object.freeze({ at: () => undefined });
}

export interface TranscendentEmbryoCandidateCapability {
  readonly thresholds: readonly ReachedTranscendentEmbryoThreshold[];
  readonly evaluate: (
    blessingKey: string | null | undefined,
  ) => readonly TranscendentEmbryoBlessingAssessment[];
}
export interface TranscendentEmbryoCandidateArtifacts {
  readonly at: (
    address: TranscendentEmbryoOutcomeAddress,
  ) => TranscendentEmbryoCandidateCapability | undefined;
}
export function createTranscendentEmbryoCandidateArtifacts(
  catalog: Catalog,
  contexts: ReadonlyMap<string, readonly ReachedTranscendentEmbryoThreshold[]>,
): TranscendentEmbryoCandidateArtifacts {
  const privateContexts = new Map(contexts);
  return Object.freeze({
    at: (address: TranscendentEmbryoOutcomeAddress) => {
      const thresholds = privateContexts.get(semanticAddressKey(address));
      if (thresholds === undefined) return undefined;
      return Object.freeze({
        thresholds,
        evaluate: (blessingKey: string | null | undefined) =>
          Object.freeze(
            thresholds.map((threshold) =>
              assessTranscendentEmbryoTransformation(catalog, threshold, blessingKey),
            ),
          ),
      });
    },
  });
}
function createEmptyTranscendentEmbryoCandidateArtifacts(): TranscendentEmbryoCandidateArtifacts {
  return Object.freeze({ at: () => undefined });
}

/** Exact pre-fountain Phial frontiers retained by the reached action. */
export interface FountainRarityCandidateFrontier {
  readonly status: import('./keepsakes').PhialLifecycleStatus | undefined;
  readonly consumptionTargetKeys: readonly string[];
  readonly mutationTargetKeys: readonly string[];
}
export interface FountainRarityCandidateCapability {
  readonly frontiers: readonly FountainRarityCandidateFrontier[];
}
export interface FountainRarityCandidateArtifacts {
  readonly at: (
    address: FountainRarityOutcomeAddress,
  ) => FountainRarityCandidateCapability | undefined;
  readonly entries: () => readonly (readonly [string, FountainRarityCandidateCapability])[];
}
export function createFountainRarityCandidateArtifacts(
  contexts: ReadonlyMap<string, FountainRarityCandidateCapability>,
): FountainRarityCandidateArtifacts {
  const privateContexts = new Map(contexts);
  return Object.freeze({
    at: (address: FountainRarityOutcomeAddress) => privateContexts.get(semanticAddressKey(address)),
    entries: () => Object.freeze([...privateContexts.entries()]),
  });
}
function createEmptyFountainRarityCandidateArtifacts(): FountainRarityCandidateArtifacts {
  return createFountainRarityCandidateArtifacts(new Map());
}

/**
 * Exact rack frontier captured by the selected chronological reward walk.
 * It deliberately contains the already-derived identity history rather than
 * a project or biome handle that a candidate consumer could replay.
 */
export interface KeepsakeSelectionCandidateCapability {
  readonly state: KeepsakeState;
  readonly encounterBlockedKeepsakeKeys: readonly string[];
}
export interface KeepsakeSelectionCandidateArtifacts {
  readonly at: (
    address: KeepsakeSelectionAddress,
  ) => KeepsakeSelectionCandidateCapability | undefined;
  /** Engine assembly composition only; candidate consumers use `at`. */
  readonly entries: () => readonly (readonly [string, KeepsakeSelectionCandidateCapability])[];
}
export function createKeepsakeSelectionCandidateArtifacts(
  contexts: ReadonlyMap<string, KeepsakeSelectionCandidateCapability>,
): KeepsakeSelectionCandidateArtifacts {
  const privateContexts = new Map(contexts);
  return Object.freeze({
    at: (address: KeepsakeSelectionAddress) => privateContexts.get(semanticAddressKey(address)),
    entries: () => Object.freeze([...privateContexts.entries()]),
  });
}
export function createJudgmentArcanaCandidateArtifacts(
  contexts: ReadonlyMap<string, JudgmentArcanaCandidateCapability>,
): JudgmentArcanaCandidateArtifacts {
  const privateContexts = new Map(contexts);
  return Object.freeze({
    at: (address: JudgmentArcanaAddress) => privateContexts.get(semanticAddressKey(address)),
  });
}
export function createFigurineArcanaCandidateArtifacts(
  contexts: ReadonlyMap<string, FigurineArcanaCandidateCapability>,
): FigurineArcanaCandidateArtifacts {
  const privateContexts = new Map(contexts);
  return Object.freeze({
    at: (address: FigurineArcanaAddress) => privateContexts.get(semanticAddressKey(address)),
  });
}

export interface BiomeCandidateArtifacts {
  readonly origin: BiomeAddress;
  readonly roomTargets: RoomTargetCandidateArtifacts;
  readonly rewardProducers: RewardProducerCandidateArtifacts;
  readonly roomLifecycles: RoomLifecycleCandidateArtifacts;
  readonly encounters: EncounterCandidateArtifacts;
  readonly traitOffers: TraitOfferCandidateArtifacts;
  readonly levelResolutions: LevelResolutionCandidateArtifacts;
  readonly judgmentArcana: JudgmentArcanaCandidateArtifacts;
  readonly figurineArcana: FigurineArcanaCandidateArtifacts;
  readonly keepsakeSelections: KeepsakeSelectionCandidateArtifacts;
  readonly keepsakeEquipResults: KeepsakeEquipResultCandidateArtifacts;
  readonly acquisitionConversions: AcquisitionConversionCandidateArtifacts;
  readonly derivedAcquisitionEntries: DerivedAcquisitionEntryCandidateArtifacts;
  readonly steadyGrowth: SteadyGrowthCandidateArtifacts;
  readonly transcendentEmbryo: TranscendentEmbryoCandidateArtifacts;
  readonly fountainRarity: FountainRarityCandidateArtifacts;
  readonly purgingPools: PurgingPoolCandidateArtifacts;
  readonly hermesShrines: HermesShrineCandidateArtifacts;
  readonly stygianWells: StygianWellCandidateArtifacts;
}

/** Exact room-entry Pool generation assessment at one automatic host. */
export interface PurgingPoolCandidateCapability {
  /** One exact assessment per surviving simulation branch. */
  readonly assessments: readonly import('./purging-pool').PurgingPoolAssessment[];
  /** Ordered candidates legal in every surviving branch. */
  readonly candidateTraitKeysBySlot: Readonly<
    Record<import('./purging-pool').PurgingPoolSlotKey, readonly string[]>
  >;
}
export interface PurgingPoolCandidateArtifacts {
  readonly at: (occurrence: OccurrenceAddress) => PurgingPoolCandidateCapability | undefined;
}
export function createPurgingPoolCandidateArtifacts(
  contexts: ReadonlyMap<string, readonly import('./purging-pool').PurgingPoolAssessment[]>,
): PurgingPoolCandidateArtifacts {
  const privateContexts = new Map(contexts);
  return Object.freeze({
    at: (occurrence: OccurrenceAddress) => {
      const assessments = privateContexts.get(semanticAddressKey(occurrence));
      if (assessments === undefined || assessments.length === 0) return undefined;
      const first = assessments[0]!;
      const candidateTraitKeysBySlot = Object.freeze(
        Object.fromEntries(
          (['left', 'middle', 'right'] as const).map((slotKey) => [
            slotKey,
            Object.freeze(
              first.candidateTraitKeysBySlot[slotKey].filter((traitKey) =>
                assessments.every((assessment) =>
                  assessment.candidateTraitKeysBySlot[slotKey].includes(traitKey),
                ),
              ),
            ),
          ]),
        ) as Record<import('./purging-pool').PurgingPoolSlotKey, readonly string[]>,
      );
      return Object.freeze({ assessments, candidateTraitKeysBySlot });
    },
  });
}
function createEmptyPurgingPoolCandidateArtifacts(): PurgingPoolCandidateArtifacts {
  return Object.freeze({ at: () => undefined });
}

/** Exact entry-frontier Shrine support at one physical occurrence. */
export interface HermesShrineCandidateCapability {
  readonly assessments: readonly import('./hermes-shrine').HermesShrineCandidateContext[];
  readonly placementEligible: boolean;
  readonly required: boolean;
  readonly present: boolean;
  readonly candidateRewardTypesBySlot: Readonly<
    Record<import('../authored-project/model').HermesShrineSlotKey, readonly string[]>
  >;
  /** Exact first-rush Travel Deal domain, absent until that prefix is reached. */
  readonly travelDealRefill?: {
    readonly sourceGenerationKey: import('../authored-project/model').HermesShrineGenerationKey;
    readonly candidateRewardTypes: readonly string[];
  };
}
export interface HermesShrineCandidateArtifacts {
  readonly at: (occurrence: OccurrenceAddress) => HermesShrineCandidateCapability | undefined;
}
export function createHermesShrineCandidateArtifacts(
  contexts: ReadonlyMap<string, readonly import('./hermes-shrine').HermesShrineCandidateContext[]>,
): HermesShrineCandidateArtifacts {
  const privateContexts = new Map(contexts);
  return Object.freeze({
    at: (occurrence: OccurrenceAddress) => {
      const assessments = privateContexts.get(semanticAddressKey(occurrence));
      if (assessments === undefined || assessments.length === 0) return undefined;
      const first = assessments[0]!;
      const travelDealRefill = first.travelDealRefill;
      return Object.freeze({
        assessments,
        placementEligible: assessments.every((assessment) => assessment.placement.eligible),
        required: assessments.every((assessment) => assessment.placement.forced),
        present: assessments.every((assessment) => assessment.inventory !== undefined),
        candidateRewardTypesBySlot: Object.freeze(
          Object.fromEntries(
            (['first', 'secondLeft', 'secondRight'] as const).map((slotKey) => [
              slotKey,
              Object.freeze(
                (first.inventory?.candidateRewardTypesBySlot[slotKey] ?? []).filter((rewardType) =>
                  assessments.every((assessment) =>
                    assessment.inventory?.candidateRewardTypesBySlot[slotKey].includes(rewardType),
                  ),
                ),
              ),
            ]),
          ) as Record<import('../authored-project/model').HermesShrineSlotKey, readonly string[]>,
        ),
        ...(travelDealRefill === undefined
          ? {}
          : {
              travelDealRefill: Object.freeze({
                sourceGenerationKey: travelDealRefill.sourceGenerationKey,
                candidateRewardTypes: Object.freeze(
                  travelDealRefill.candidateRewardTypes.filter((rewardType) =>
                    assessments.every(
                      (assessment) =>
                        assessment.travelDealRefill?.sourceGenerationKey ===
                          travelDealRefill.sourceGenerationKey &&
                        assessment.travelDealRefill?.candidateRewardTypes.includes(rewardType) ===
                          true,
                    ),
                  ),
                ),
              }),
            }),
      });
    },
  });
}
function createEmptyHermesShrineCandidateArtifacts(): HermesShrineCandidateArtifacts {
  return Object.freeze({ at: () => undefined });
}

/** Exact entry-frontier Well support at one physical occurrence. */
export interface StygianWellCandidateCapability {
  readonly assessments: readonly import('./stygian-well').StygianWellCandidateContext[];
  readonly placementEligible: boolean;
  readonly required: boolean;
  readonly present: boolean;
  readonly interacted: boolean;
  readonly candidateItemKeysBySlot: Readonly<
    Record<import('../authored-project/model').StygianWellSlotKey, readonly string[]>
  >;
  readonly travelDealRefill?: {
    readonly sourceGenerationKey: import('../authored-project/model').StygianWellGenerationKey;
    readonly candidateItemKeys: readonly string[];
  };
  readonly twistCandidateItemKeysByGeneration: Readonly<
    Partial<Record<import('../authored-project/model').StygianWellGenerationKey, readonly string[]>>
  >;
}
export interface StygianWellCandidateArtifacts {
  readonly at: (occurrence: OccurrenceAddress) => StygianWellCandidateCapability | undefined;
}
export function createStygianWellCandidateArtifacts(
  contexts: ReadonlyMap<string, readonly import('./stygian-well').StygianWellCandidateContext[]>,
): StygianWellCandidateArtifacts {
  const privateContexts = new Map(contexts);
  return Object.freeze({
    at: (occurrence: OccurrenceAddress) => {
      const assessments = privateContexts.get(semanticAddressKey(occurrence));
      if (assessments === undefined || assessments.length === 0) return undefined;
      const first = assessments[0]!;
      const travelDealRefill = first.inventory?.travelDealRefill;
      return Object.freeze({
        assessments,
        placementEligible: assessments.every((assessment) => assessment.placement.eligible),
        required: assessments.every((assessment) => assessment.placement.forced),
        present: assessments.every((assessment) => assessment.inventory !== undefined),
        interacted: assessments.every((assessment) => assessment.inventory?.interacted === true),
        candidateItemKeysBySlot: Object.freeze(
          Object.fromEntries(
            (['healing', 'secondLeft', 'secondRight'] as const).map((slotKey) => [
              slotKey,
              Object.freeze(
                (first.inventory?.candidateItemKeysBySlot[slotKey] ?? []).filter((itemKey) =>
                  assessments.every(
                    (assessment) =>
                      assessment.inventory?.candidateItemKeysBySlot[slotKey].includes(itemKey) ===
                      true,
                  ),
                ),
              ),
            ]),
          ) as Record<import('../authored-project/model').StygianWellSlotKey, readonly string[]>,
        ),
        ...(travelDealRefill === undefined
          ? {}
          : {
              travelDealRefill: Object.freeze({
                sourceGenerationKey: travelDealRefill.sourceGenerationKey,
                candidateItemKeys: Object.freeze(
                  travelDealRefill.candidateItemKeys.filter((itemKey) =>
                    assessments.every(
                      (assessment) =>
                        assessment.inventory?.travelDealRefill?.sourceGenerationKey ===
                          travelDealRefill.sourceGenerationKey &&
                        assessment.inventory.travelDealRefill.candidateItemKeys.includes(itemKey),
                    ),
                  ),
                ),
              }),
            }),
        twistCandidateItemKeysByGeneration: Object.freeze(
          Object.fromEntries(
            Object.entries(first.inventory?.twistCandidateItemKeysByGeneration ?? {}).map(
              ([generationKey, itemKeys]) => [
                generationKey,
                Object.freeze(
                  (itemKeys ?? []).filter((itemKey) =>
                    assessments.every(
                      (assessment) =>
                        assessment.inventory?.twistCandidateItemKeysByGeneration[
                          generationKey as import('../authored-project/model').StygianWellGenerationKey
                        ]?.includes(itemKey) === true,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      });
    },
  });
}
function createEmptyStygianWellCandidateArtifacts(): StygianWellCandidateArtifacts {
  return Object.freeze({ at: () => undefined });
}

export interface DerivedAcquisitionEntryCandidateCapability {
  readonly kind: import('./rewards/acquisition-settlement').DerivedAcquisitionEntryFrontier['kind'];
  readonly sourceOfferKey?: string;
  readonly slotIndex?: number;
  readonly rewardTypes?: readonly string[];
  readonly fixedReward?: import('../authored-project/model').AuthoredRewardState;
  readonly retainedSourceMismatch?: boolean;
  readonly eligibleSourceOfferKeys?: readonly string[];
}
export interface DerivedAcquisitionEntryCandidateArtifacts {
  readonly at: (
    address: import('../authored-project/addresses').AcquisitionEntryAddress,
  ) => DerivedAcquisitionEntryCandidateCapability | undefined;
  readonly entriesAt: (
    site: import('../authored-project/addresses').AcquisitionSiteAddress,
  ) => readonly {
    readonly address: import('../authored-project/addresses').AcquisitionEntryAddress;
    readonly capability: DerivedAcquisitionEntryCandidateCapability;
  }[];
}
export function attestDerivedAcquisitionEntryCandidateCapability(
  frontiers: readonly import('./rewards/acquisition-settlement').DerivedAcquisitionEntryFrontier[],
): DerivedAcquisitionEntryCandidateCapability | undefined {
  const first = frontiers[0];
  if (first === undefined) return undefined;
  if (
    frontiers.length !== first.branchCohortSize ||
    frontiers.some(
      (frontier) =>
        frontier.kind !== first.kind ||
        frontier.branchCohortSize !== first.branchCohortSize ||
        frontier.sourceOfferKey !== first.sourceOfferKey ||
        frontier.slotIndex !== first.slotIndex ||
        JSON.stringify(frontier.rewardTypes) !== JSON.stringify(first.rewardTypes) ||
        JSON.stringify(frontier.fixedReward) !== JSON.stringify(first.fixedReward) ||
        frontier.retainedSourceMismatch !== first.retainedSourceMismatch ||
        JSON.stringify(frontier.eligibleSourceOfferKeys) !==
          JSON.stringify(first.eligibleSourceOfferKeys),
    )
  )
    return undefined;
  return Object.freeze({
    kind: first.kind,
    ...(first.sourceOfferKey === undefined ? {} : { sourceOfferKey: first.sourceOfferKey }),
    ...(first.slotIndex === undefined ? {} : { slotIndex: first.slotIndex }),
    ...(first.rewardTypes === undefined ? {} : { rewardTypes: first.rewardTypes }),
    ...(first.fixedReward === undefined ? {} : { fixedReward: first.fixedReward }),
    ...(first.retainedSourceMismatch === undefined
      ? {}
      : { retainedSourceMismatch: first.retainedSourceMismatch }),
    ...(first.eligibleSourceOfferKeys === undefined
      ? {}
      : { eligibleSourceOfferKeys: first.eligibleSourceOfferKeys }),
  });
}
export function createDerivedAcquisitionEntryCandidateArtifacts(
  contexts: ReadonlyMap<
    string,
    readonly import('./rewards/acquisition-settlement').DerivedAcquisitionEntryFrontier[]
  >,
): DerivedAcquisitionEntryCandidateArtifacts {
  const privateContexts = new Map(
    [...contexts].map(([key, frontiers]) => [key, Object.freeze([...frontiers])] as const),
  );
  return Object.freeze({
    at: (address: import('../authored-project/addresses').AcquisitionEntryAddress) => {
      const frontiers = privateContexts.get(semanticAddressKey(address));
      return frontiers === undefined
        ? undefined
        : attestDerivedAcquisitionEntryCandidateCapability(frontiers);
    },
    entriesAt: (site: import('../authored-project/addresses').AcquisitionSiteAddress) =>
      Object.freeze(
        [...privateContexts.values()].flatMap((frontiers) => {
          const first = frontiers[0];
          const capability = attestDerivedAcquisitionEntryCandidateCapability(frontiers);
          return first === undefined ||
            capability === undefined ||
            semanticAddressKey(first.address.site) !== semanticAddressKey(site)
            ? []
            : [Object.freeze({ address: first.address, capability })];
        }),
      ),
  });
}
function createEmptyDerivedAcquisitionEntryCandidateArtifacts(): DerivedAcquisitionEntryCandidateArtifacts {
  return Object.freeze({ at: () => undefined, entriesAt: () => Object.freeze([]) });
}

/** Exact captured role frontiers from the canonical acquisition fold. */
export interface AcquisitionConversionCandidateCapability {
  readonly timePieceAssessments: readonly {
    readonly supported: boolean;
    readonly evidence: import('./model').FindingEvidence;
  }[];
  readonly artificerAssessments: readonly {
    readonly supported: boolean;
    readonly evidence: import('./model').FindingEvidence;
  }[];
  readonly seaStarAssessments: readonly {
    readonly supported: boolean;
    readonly evidence: import('./model').FindingEvidence;
  }[];
  /** One concrete realized acquisition when every reached branch materializes it. */
  readonly realizedAcquisition?: ConcreteAcquisitionEvent;
  readonly artificerReplacementAddress?: import('../authored-project/addresses').AcquisitionEntryAddress;
  readonly artificerReplacementRewardTypes?: readonly string[];
  readonly artificerReplacementOptions?: readonly import('../authored-project/model').AuthoredRewardState[];
}
export interface AcquisitionConversionCandidateArtifacts {
  readonly at: (
    address: AcquisitionRoleAddress,
  ) => AcquisitionConversionCandidateCapability | undefined;
  /** Exact source-role capability for an Artificer replacement owner. */
  readonly atReplacement: (
    address: import('../authored-project/addresses').AcquisitionEntryAddress,
  ) =>
    | {
        readonly address: AcquisitionRoleAddress;
        readonly capability: AcquisitionConversionCandidateCapability;
      }
    | undefined;
}
export function createAcquisitionConversionCandidateArtifacts(
  catalog: Catalog,
  contexts: ReadonlyMap<
    string,
    readonly {
      readonly address: AcquisitionRoleAddress;
      readonly branchesBeforeRole: readonly RewardBranchState[];
      readonly realizedAcquisitionByBranch?: readonly (ConcreteAcquisitionEvent | undefined)[];
      readonly source: AcquisitionSource;
      readonly lifecyclePoint: import('../reward-kernel').ProducerLifecyclePointKey;
      readonly blocksArtificerConversion?: true;
      readonly artificerReplacementAddress: import('../authored-project/addresses').AcquisitionEntryAddress;
      readonly artificerReplacementCandidate?: {
        readonly rewardTypes: readonly string[];
      };
      readonly artificerReplacementOptions?: readonly import('../authored-project/model').AuthoredRewardState[];
    }[]
  >,
): AcquisitionConversionCandidateArtifacts {
  const privateContexts = new Map(contexts);
  const at = (address: AcquisitionRoleAddress) => {
    const entries = privateContexts.get(semanticAddressKey(address));
    if (entries === undefined) return undefined;
    return Object.freeze({
      timePieceAssessments: Object.freeze(
        entries.flatMap((entry) =>
          entry.branchesBeforeRole.map((branch, branchIndex) =>
            assessTimePieceConversion(
              catalog,
              branch,
              entry.source,
              entry.address.acquisitionRole,
              entry.lifecyclePoint,
              entry.realizedAcquisitionByBranch?.[branchIndex],
            ),
          ),
        ),
      ),
      artificerAssessments: Object.freeze(
        entries.flatMap((entry) =>
          entry.branchesBeforeRole.map((branch) =>
            assessArtificerConversion(catalog, branch, entry.source, {
              role: entry.address.acquisitionRole,
              lifecyclePoint: entry.lifecyclePoint,
              ...(entry.blocksArtificerConversion === true
                ? { blocksArtificerConversion: true as const }
                : {}),
            }),
          ),
        ),
      ),
      seaStarAssessments: Object.freeze(
        entries.flatMap((entry) =>
          entry.branchesBeforeRole.map((branch, branchIndex) =>
            assessSeaStarDuplication(
              catalog,
              branch,
              entry.source,
              {
                role: entry.address.acquisitionRole,
                lifecyclePoint: entry.lifecyclePoint,
              },
              entry.realizedAcquisitionByBranch?.[branchIndex],
            ),
          ),
        ),
      ),
      ...(() => {
        const realized = entries.flatMap((entry) =>
          entry.branchesBeforeRole.map(
            (_, branchIndex) => entry.realizedAcquisitionByBranch?.[branchIndex],
          ),
        );
        const first = realized[0];
        return first !== undefined &&
          realized.every(
            (candidate) =>
              candidate !== undefined && JSON.stringify(candidate) === JSON.stringify(first),
          )
          ? { realizedAcquisition: first }
          : {};
      })(),
      ...(() => {
        const domains = entries.map((entry) => entry.artificerReplacementOptions);
        const first = domains[0];
        return first !== undefined &&
          domains.every((domain) => JSON.stringify(domain) === JSON.stringify(first))
          ? { artificerReplacementOptions: first }
          : {};
      })(),
      ...(() => {
        const domains = entries.map((entry) => entry.artificerReplacementCandidate?.rewardTypes);
        const first = domains[0];
        return first !== undefined &&
          domains.every((domain) => JSON.stringify(domain) === JSON.stringify(first))
          ? { artificerReplacementRewardTypes: first }
          : {};
      })(),
      ...(() => {
        const addresses = entries.map((entry) => entry.artificerReplacementAddress);
        const first = addresses[0];
        return first !== undefined &&
          addresses.every(
            (candidate) => semanticAddressKey(candidate) === semanticAddressKey(first),
          )
          ? { artificerReplacementAddress: first }
          : {};
      })(),
    });
  };
  return Object.freeze({
    at,
    atReplacement: (
      replacement: import('../authored-project/addresses').AcquisitionEntryAddress,
    ) => {
      const replacementKey = semanticAddressKey(replacement);
      for (const entries of privateContexts.values()) {
        const source = entries.find(
          (entry) => semanticAddressKey(entry.artificerReplacementAddress) === replacementKey,
        );
        if (source === undefined) continue;
        const capability = at(source.address);
        if (capability !== undefined) return Object.freeze({ address: source.address, capability });
      }
      return undefined;
    },
  });
}
export function createEmptyAcquisitionConversionCandidateArtifacts(): AcquisitionConversionCandidateArtifacts {
  return Object.freeze({ at: () => undefined, atReplacement: () => undefined });
}

/** Candidate capabilities produced by the exact project simulation execution. */
export interface ProjectCandidateArtifacts {
  readonly biomeAt: (biome: BiomeAddress) => BiomeCandidateArtifacts | undefined;
  readonly keepsakeSelections: KeepsakeSelectionCandidateArtifacts;
  readonly keepsakeEquipResults: KeepsakeEquipResultCandidateArtifacts;
}

/** Exact pre-equip trait state retained for one closed keepsake result. */
export interface KeepsakeEquipResultCandidateCapability {
  readonly frontiers: readonly {
    readonly before: TraitHistoryState;
    readonly arcanaFear?: ArcanaFearState;
    readonly fatedStatus: import('./keepsakes').FatedStatus;
    readonly transcendentEmbryoRarity?: import('../catalog-schema').InRunTraitRarity;
    readonly loadout?: { readonly weaponKey: string; readonly aspectKey: string };
  }[];
}
export interface KeepsakeEquipResultCandidateArtifacts {
  readonly at: (
    address: KeepsakeEquipResultAddress,
  ) => KeepsakeEquipResultCandidateCapability | undefined;
  /** Engine assembly composition only; candidate consumers use `at`. */
  readonly entries: () => readonly (readonly [string, KeepsakeEquipResultCandidateCapability])[];
}
export function createKeepsakeEquipResultCandidateArtifacts(
  contexts: ReadonlyMap<string, KeepsakeEquipResultCandidateCapability>,
): KeepsakeEquipResultCandidateArtifacts {
  const privateContexts = new Map(contexts);
  return Object.freeze({
    at: (address: KeepsakeEquipResultAddress) => privateContexts.get(semanticAddressKey(address)),
    entries: () => Object.freeze([...privateContexts.entries()]),
  });
}

export class CandidateArtifactContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'CandidateArtifactContractError';
  }
}

export function createRoomTargetCandidateArtifacts(
  contexts: ReadonlyMap<string, RoomTargetCandidateContext>,
): RoomTargetCandidateArtifacts {
  const privateContexts = new Map(contexts);
  return Object.freeze({
    at: (target: TargetAddress) => privateContexts.get(semanticAddressKey(target)),
  });
}

export function createBiomeCandidateArtifacts(
  origin: BiomeAddress,
  roomTargets: RoomTargetCandidateArtifacts,
  rewardProducers: RewardProducerCandidateArtifacts,
  roomLifecycles: RoomLifecycleCandidateArtifacts,
  encounters: EncounterCandidateArtifacts = emptyEncounterCandidateArtifacts(),
  traitOffers: TraitOfferCandidateArtifacts = createEmptyTraitOfferCandidateArtifacts(),
  levelResolutions: LevelResolutionCandidateArtifacts = createEmptyLevelResolutionCandidateArtifacts(),
  judgmentArcana: JudgmentArcanaCandidateArtifacts = createJudgmentArcanaCandidateArtifacts(
    new Map(),
  ),
  keepsakeSelections: KeepsakeSelectionCandidateArtifacts = createKeepsakeSelectionCandidateArtifacts(
    new Map(),
  ),
  keepsakeEquipResults: KeepsakeEquipResultCandidateArtifacts = createKeepsakeEquipResultCandidateArtifacts(
    new Map(),
  ),
  acquisitionConversions: AcquisitionConversionCandidateArtifacts = createEmptyAcquisitionConversionCandidateArtifacts(),
  derivedAcquisitionEntries: DerivedAcquisitionEntryCandidateArtifacts = createEmptyDerivedAcquisitionEntryCandidateArtifacts(),
  steadyGrowth: SteadyGrowthCandidateArtifacts = createEmptySteadyGrowthCandidateArtifacts(),
  purgingPools: PurgingPoolCandidateArtifacts = createEmptyPurgingPoolCandidateArtifacts(),
  hermesShrines: HermesShrineCandidateArtifacts = createEmptyHermesShrineCandidateArtifacts(),
  stygianWells: StygianWellCandidateArtifacts = createEmptyStygianWellCandidateArtifacts(),
  fountainRarity: FountainRarityCandidateArtifacts = createEmptyFountainRarityCandidateArtifacts(),
  figurineArcana: FigurineArcanaCandidateArtifacts = createFigurineArcanaCandidateArtifacts(
    new Map(),
  ),
  transcendentEmbryo: TranscendentEmbryoCandidateArtifacts = createEmptyTranscendentEmbryoCandidateArtifacts(),
): BiomeCandidateArtifacts {
  return Object.freeze({
    origin,
    roomTargets,
    rewardProducers,
    roomLifecycles,
    encounters,
    traitOffers,
    levelResolutions,
    judgmentArcana,
    figurineArcana,
    keepsakeSelections,
    keepsakeEquipResults,
    acquisitionConversions,
    derivedAcquisitionEntries,
    steadyGrowth,
    transcendentEmbryo,
    fountainRarity,
    purgingPools,
    hermesShrines,
    stygianWells,
  });
}

export function createEmptyBiomeCandidateArtifacts(origin: BiomeAddress): BiomeCandidateArtifacts {
  return createBiomeCandidateArtifacts(
    origin,
    createRoomTargetCandidateArtifacts(new Map()),
    createEmptyRewardProducerCandidateArtifacts(),
    createEmptyRoomLifecycleCandidateArtifacts(),
    emptyEncounterCandidateArtifacts(),
    createEmptyTraitOfferCandidateArtifacts(),
    createEmptyLevelResolutionCandidateArtifacts(),
  );
}

export function createProjectCandidateArtifacts(
  biomes: readonly BiomeCandidateArtifacts[],
  routeStartKeepsakes: ReadonlyMap<string, KeepsakeSelectionCandidateCapability> = new Map(),
  routeStartKeepsakeEquipResults: ReadonlyMap<
    string,
    KeepsakeEquipResultCandidateCapability
  > = new Map(),
): ProjectCandidateArtifacts {
  const privateBiomes = new Map<string, BiomeCandidateArtifacts>();
  const keepsakeSelections = new Map(routeStartKeepsakes);
  const keepsakeEquipResults = new Map(routeStartKeepsakeEquipResults);
  for (const biome of biomes) {
    const key = semanticAddressKey(biome.origin);
    if (privateBiomes.has(key)) {
      throw new CandidateArtifactContractError(`duplicate candidate artifacts for ${key}`);
    }
    privateBiomes.set(key, biome);
    // A Postboss artifact is produced by the one reward walk that reaches its
    // fixed-linked occurrence. Duplicate publication would be a chronology bug.
    for (const [selectionKey, capability] of biome.keepsakeSelections.entries()) {
      if (keepsakeSelections.has(selectionKey))
        throw new CandidateArtifactContractError(
          `duplicate keepsake candidate artifact for ${selectionKey}`,
        );
      keepsakeSelections.set(selectionKey, capability);
    }
    for (const [resultKey, capability] of biome.keepsakeEquipResults.entries()) {
      if (keepsakeEquipResults.has(resultKey))
        throw new CandidateArtifactContractError(
          `duplicate keepsake equip-result candidate artifact for ${resultKey}`,
        );
      keepsakeEquipResults.set(resultKey, capability);
    }
  }
  return Object.freeze({
    biomeAt: (biome: BiomeAddress) => privateBiomes.get(semanticAddressKey(biome)),
    keepsakeSelections: createKeepsakeSelectionCandidateArtifacts(keepsakeSelections),
    keepsakeEquipResults: createKeepsakeEquipResultCandidateArtifacts(keepsakeEquipResults),
  });
}
