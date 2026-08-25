import {
  semanticAddressKey,
  type BiomeAddress,
  type LevelResolutionAddress,
  type TraitOfferAddress,
  type NaturalSelectionResultAddress,
  type TargetAddress,
  type JudgmentArcanaAddress,
  type KeepsakeSelectionAddress,
  type KeepsakeEquipResultAddress,
  type SteadyGrowthOutcomeAddress,
  type AcquisitionRoleAddress,
  type OccurrenceAddress,
} from '../authored-project/addresses';
import type { Catalog, TraitOrdinaryBoonSlot } from '../catalog-schema';
import type {
  AuthoredLevelResolution,
  AuthoredTraitOffer,
  AuthoredTraitOfferTraits,
} from '../authored-project/traits';
import { optionIndex, type TraitOptionKey } from '../authored-project/traits';
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
import { circeResolutionDomain } from './arcana-fear';
import {
  assessTraitOffer,
  assessTraitOfferBeforeRarification,
  nextTraitOfferDraft,
  nextOptionalHighTierTraitOfferDraft,
  previousOptionalHighTierTraitOfferDraft,
  traitOfferStartingDraft,
  assessSelectedTargetedAcquisition,
  targetedAcquisitionTargetKeys,
  type TraitOfferBranchAssessment,
  type TraitOfferCandidateContext,
  type TraitOfferContext,
  evaluateReachedLevelResolution,
  pomEligibleTargetKeys,
  type TraitHistoryState,
  type ReachedSteadyGrowthThreshold,
  type SteadyGrowthTargetAssessment,
  assessSteadyGrowthTarget,
  echoPomGreatestLevelTraitKeys,
  echoLastRunBoonOutcomes,
  directTraitSetOutcomes,
  chaosAdjustedTraitOfferContext,
  assessNaturalSelectionTargets,
  type NaturalSelectionTargetAssessment,
  evaluateReachedTraitOffer,
  recordReachedTraitOffer,
  type RansomAssessment,
} from './traits';
import type { KeepsakeState } from './keepsakes';
import { evaluateCallingCardOffer } from './keepsakes';
import type { ArcanaFearState } from './arcana-fear';
import type { AcquisitionSource } from './rewards/processing';
import {
  assessArtificerConversion,
  assessSeaStarDuplication,
  assessTimePieceConversion,
  type RewardBranchState,
} from './rewards/branch-primitives';

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

/**
 * Exact trait-offer contact retained by one biome reward evaluation. The
 * pre-offer histories and resolved contexts are intentionally reachable only
 * through this capability; they are not part of the public simulation data.
 */
export interface TraitOfferCandidateCapability {
  readonly evaluateOffer: (value: AuthoredTraitOffer) => readonly TraitOfferBranchAssessment[];
  readonly callingCard: (value: AuthoredTraitOffer) => readonly {
    readonly effectiveOffer: AuthoredTraitOffer;
    readonly remainingCharges: number | undefined;
    readonly invalidActions: readonly number[];
    readonly rarifiableOptionKeys: readonly TraitOptionKey[];
  }[];
  /** One exact supported traits draft for returning from Fallback Gold, if any. */
  readonly traitsStartingDraft: (giverKey: string) => AuthoredTraitOfferTraits | undefined;
  readonly nextTraitOptionDraft: (
    value: AuthoredTraitOfferTraits,
  ) => AuthoredTraitOfferTraits | undefined;
  readonly nextOptionalHighTierDraft: (
    value: AuthoredTraitOfferTraits,
  ) => AuthoredTraitOfferTraits | undefined;
  readonly previousOptionalHighTierDraft: (
    value: AuthoredTraitOfferTraits,
  ) => AuthoredTraitOfferTraits | undefined;
  readonly targetedAcquisitionTargets: (
    value: AuthoredTraitOffer,
    optionKey: TraitOptionKey,
  ) => readonly {
    readonly sourceSupported: boolean;
    readonly targetTraitKeys: readonly string[];
  }[];
  /** Exact selected-Circe pre-effect domains; no consumer receives Arcana/Fear state. */
  readonly circeResolution: (
    value: AuthoredTraitOffer,
    optionKey: TraitOptionKey,
  ) => readonly {
    readonly effect: 'activateArcana' | 'promoteArcana' | 'disableFear';
    readonly requiredCount: number;
    readonly arcanaKeys: readonly string[];
    readonly vowKeys: readonly string[];
    readonly outerAvailable: boolean;
  }[];
  /** Exact selected Echo-Pom greatest-level domains for surviving branches. */
  readonly echoPomTargets: (
    value: AuthoredTraitOffer,
    optionKey: TraitOptionKey,
  ) => readonly (readonly string[])[];
  /** Exact selected Echo-last-run outcome domains for surviving branches. */
  readonly echoLastRunBoon: (
    value: AuthoredTraitOffer,
    optionKey: TraitOptionKey,
  ) => readonly (readonly import('./traits').EchoLastRunBoonOutcome[])[];
  /** Exact ownership-only All Together set domains for surviving branches. */
  readonly allTogetherSet: (
    value: AuthoredTraitOffer,
    optionKey: TraitOptionKey,
    setKey: import('../catalog-schema').DirectTraitSetKey,
  ) => readonly (readonly (string | null)[])[];
  /** Exact selected Natural Selection result assessment at this child frontier. */
  readonly naturalSelectionTargets: (
    levelCount: number,
    slots: readonly TraitOrdinaryBoonSlot[],
    targets: readonly string[] | undefined,
  ) => readonly NaturalSelectionTargetAssessment[];
  /** Data-only current-frontier transform for a selected Ransom. */
  readonly ransom: (value: AuthoredTraitOffer) => readonly RansomAssessment[];
  /** Closed Chaos restrictions at this exact pre-offer frontier. */
  readonly chaosOfferRules: (value?: AuthoredTraitOffer) => readonly {
    readonly ordinaryRequiresCommon: boolean;
    readonly rejectedBlockRequired: boolean;
    readonly rejectedBlockableOptionKeys: readonly TraitOptionKey[];
  }[];
  /** Declaration-owned complete-pair domains for the specialized Chaos editor. */
  readonly chaosPairDomains: (pair: {
    readonly curseKey: string;
    readonly blessingKey: string;
  }) => readonly {
    readonly curseKeys: readonly string[];
    readonly blessingKeys: readonly string[];
    readonly rarities: readonly import('../catalog-schema').TraitRarity[];
    readonly curseDurations: Readonly<
      Record<string, { readonly minimum: number; readonly maximum: number; readonly step: number }>
    >;
    readonly curseOperands: Readonly<
      Record<string, readonly import('../catalog-schema').ChaosNumericOperand[]>
    >;
    readonly blessingOperands: Readonly<
      Record<string, readonly import('../catalog-schema').ChaosNumericOperand[]>
    >;
  }[];
}

export interface TraitOfferCandidateArtifacts {
  readonly at: (
    address: TraitOfferAddress | NaturalSelectionResultAddress,
  ) => TraitOfferCandidateCapability | undefined;
}

export interface LevelResolutionCandidateBranch {
  readonly effectKind: 'choice' | 'random';
  readonly emptyTargetAllowed?: boolean;
  readonly levelCount: number;
  /** Defined only for a declaration-owned visible Pom choice. */
  readonly requiredOfferCount?: number;
  /** Exact pre-acquisition target domain for this simulation branch. */
  readonly eligibleTargetTraitKeys: readonly string[];
}

export interface LevelResolutionCandidateEvaluation {
  /** Stable index into the capability's branch-correlated surfaces. */
  readonly branchIndex: number;
  readonly supported: boolean;
  readonly findings: readonly string[];
}

export interface LevelResolutionCandidateCapability {
  readonly branches: readonly LevelResolutionCandidateBranch[];
  readonly evaluate: (
    value: AuthoredLevelResolution,
  ) => readonly LevelResolutionCandidateEvaluation[];
}

export interface LevelResolutionCandidateArtifacts {
  readonly at: (address: LevelResolutionAddress) => LevelResolutionCandidateCapability | undefined;
}

/** Atomic exact-set support captured immediately before one automatic Boss effect. */
export interface JudgmentArcanaCandidateCapability {
  readonly inactiveArcanaKeys: readonly string[];
  readonly requiredCount: number;
}
export interface JudgmentArcanaCandidateArtifacts {
  readonly at: (address: JudgmentArcanaAddress) => JudgmentArcanaCandidateCapability | undefined;
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

export interface BiomeCandidateArtifacts {
  readonly origin: BiomeAddress;
  readonly roomTargets: RoomTargetCandidateArtifacts;
  readonly rewardProducers: RewardProducerCandidateArtifacts;
  readonly roomLifecycles: RoomLifecycleCandidateArtifacts;
  readonly encounters: EncounterCandidateArtifacts;
  readonly traitOffers: TraitOfferCandidateArtifacts;
  readonly levelResolutions: LevelResolutionCandidateArtifacts;
  readonly judgmentArcana: JudgmentArcanaCandidateArtifacts;
  readonly keepsakeSelections: KeepsakeSelectionCandidateArtifacts;
  readonly keepsakeEquipResults: KeepsakeEquipResultCandidateArtifacts;
  readonly acquisitionConversions: AcquisitionConversionCandidateArtifacts;
  readonly derivedAcquisitionEntries: DerivedAcquisitionEntryCandidateArtifacts;
  readonly steadyGrowth: SteadyGrowthCandidateArtifacts;
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
  readonly kind: import('./rewards/processing').DerivedAcquisitionEntryFrontier['kind'];
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
  frontiers: readonly import('./rewards/processing').DerivedAcquisitionEntryFrontier[],
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
    readonly import('./rewards/processing').DerivedAcquisitionEntryFrontier[]
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
          entry.branchesBeforeRole.map((branch) =>
            assessTimePieceConversion(
              catalog,
              branch,
              entry.source,
              entry.address.acquisitionRole,
              entry.lifecyclePoint,
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
          entry.branchesBeforeRole.map((branch) =>
            assessSeaStarDuplication(catalog, branch, entry.source, {
              role: entry.address.acquisitionRole,
              lifecyclePoint: entry.lifecyclePoint,
            }),
          ),
        ),
      ),
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

/** Candidate-authored conditions replace the persisted offer facts captured at this frontier. */
function traitOfferCandidateContext(
  catalog: Catalog,
  history: TraitHistoryState,
  context: TraitOfferContext,
  value: AuthoredTraitOffer,
): TraitOfferContext {
  const adjusted = chaosAdjustedTraitOfferContext(catalog, history, value, context);
  return adjusted;
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
    keepsakeSelections,
    keepsakeEquipResults,
    acquisitionConversions,
    derivedAcquisitionEntries,
    steadyGrowth,
    purgingPools,
    hermesShrines,
    stygianWells,
  });
}

export function createLevelResolutionCandidateArtifacts(
  catalog: Catalog,
  contexts: ReadonlyMap<
    string,
    readonly {
      readonly address: LevelResolutionAddress;
      readonly before: TraitHistoryState;
      readonly levelCount: number;
      readonly effectKind: 'choice' | 'random';
      readonly emptyTargetAllowed?: boolean;
    }[]
  >,
): LevelResolutionCandidateArtifacts {
  const privateContexts = new Map(contexts);
  return Object.freeze({
    at: (address: LevelResolutionAddress) => {
      const branches = privateContexts.get(semanticAddressKey(address));
      if (branches === undefined) return undefined;
      const surfaces = Object.freeze(
        branches.map((branch) =>
          Object.freeze({
            effectKind: branch.effectKind,
            ...(branch.emptyTargetAllowed ? { emptyTargetAllowed: true } : {}),
            levelCount: branch.levelCount,
            ...(branch.effectKind === 'choice'
              ? { requiredOfferCount: Math.min(3, branch.before.upgradableTraitCount) }
              : {}),
            eligibleTargetTraitKeys: pomEligibleTargetKeys(catalog, branch.before),
          }),
        ),
      );
      return Object.freeze({
        branches: surfaces,
        evaluate: (value: AuthoredLevelResolution) =>
          Object.freeze(
            branches.map((branch, branchIndex) => {
              const evaluation = evaluateReachedLevelResolution(
                catalog,
                branch.address,
                value,
                branch.levelCount,
                branch.before,
                0,
                branch.effectKind,
                branch.emptyTargetAllowed ?? false,
              );
              return Object.freeze({
                branchIndex,
                supported: evaluation.findings.length === 0,
                findings: evaluation.findings,
              });
            }),
          ),
      });
    },
  });
}

export function createEmptyLevelResolutionCandidateArtifacts(): LevelResolutionCandidateArtifacts {
  return Object.freeze({ at: () => undefined });
}

export function createTraitOfferCandidateArtifacts(
  catalog: Catalog,
  contexts: ReadonlyMap<string, readonly TraitOfferCandidateContext[]>,
): TraitOfferCandidateArtifacts {
  const privateContexts = new Map(contexts);
  return Object.freeze({
    at: (address: TraitOfferAddress | NaturalSelectionResultAddress) => {
      const branchContexts = privateContexts.get(semanticAddressKey(address));
      if (branchContexts === undefined) return undefined;
      return Object.freeze({
        evaluateOffer: (value: AuthoredTraitOffer) =>
          Object.freeze(
            branchContexts.map((context) => {
              const base = assessTraitOfferBeforeRarification(
                catalog,
                value,
                context.before,
                traitOfferCandidateContext(catalog, context.before, context.context, value),
              );
              // Calling Card acts only after the authored (rolled) offer is
              // accepted. Its derived effective rarity is deliberately not a
              // fresh-roll input: Heroic and promoted replacement rows must
              // retain the legality/composition assessment of that base offer.
              return Object.freeze({
                assessments: base.assessments,
                composition: base.composition,
                replacementComposition: base.replacementComposition,
                targetedAcquisition: assessSelectedTargetedAcquisition(
                  catalog,
                  value,
                  context.before,
                ),
              });
            }),
          ),
        callingCard: (value: AuthoredTraitOffer) =>
          Object.freeze(
            branchContexts.map((context) => {
              const keepsakes = context.keepsakes;
              const base = assessTraitOfferBeforeRarification(
                catalog,
                value,
                context.before,
                traitOfferCandidateContext(catalog, context.before, context.context, value),
              );
              const result =
                keepsakes === undefined
                  ? undefined
                  : evaluateCallingCardOffer(catalog, keepsakes, value, base.legal);
              return Object.freeze({
                effectiveOffer: result?.offer ?? value,
                remainingCharges: result?.state.callingCard?.remainingCharges,
                invalidActions: result?.invalidActions ?? Object.freeze([]),
                rarifiableOptionKeys:
                  value.kind !== 'traits' || keepsakes === undefined
                    ? Object.freeze([])
                    : Object.freeze(
                        (['option1', 'option2', 'option3'] as const).filter((key) => {
                          if (optionIndex(key) >= value.options.length) return false;
                          const attempted = Object.freeze({
                            ...value,
                            rarificationActions: Object.freeze([
                              ...(value.rarificationActions ?? []),
                              key,
                            ]),
                          });
                          const attemptedBase = assessTraitOfferBeforeRarification(
                            catalog,
                            attempted,
                            context.before,
                            traitOfferCandidateContext(
                              catalog,
                              context.before,
                              context.context,
                              attempted,
                            ),
                          );
                          const attempt = evaluateCallingCardOffer(
                            catalog,
                            keepsakes,
                            attempted,
                            attemptedBase.legal,
                          );
                          return !attempt.invalidActions.includes(
                            attempted.rarificationActions.length - 1,
                          );
                        }),
                      ),
              });
            }),
          ),
        traitsStartingDraft: (giverKey: string) =>
          branchContexts
            .map((context) => {
              const draft = traitOfferStartingDraft(
                catalog,
                giverKey,
                context.before,
                context.context,
              );
              return draft;
            })
            .find((draft): draft is NonNullable<typeof draft> => draft !== undefined),
        nextTraitOptionDraft: (value: AuthoredTraitOffer) => {
          if (value.kind !== 'traits') return undefined;
          return branchContexts
            .map((context) =>
              nextTraitOfferDraft(
                catalog,
                value,
                context.before,
                traitOfferCandidateContext(catalog, context.before, context.context, value),
              ),
            )
            .find((draft): draft is NonNullable<typeof draft> => draft !== undefined);
        },
        nextOptionalHighTierDraft: (value: AuthoredTraitOfferTraits) =>
          branchContexts
            .map((context) =>
              nextOptionalHighTierTraitOfferDraft(
                catalog,
                value,
                context.before,
                traitOfferCandidateContext(catalog, context.before, context.context, value),
              ),
            )
            .find((draft): draft is NonNullable<typeof draft> => draft !== undefined),
        previousOptionalHighTierDraft: (value: AuthoredTraitOfferTraits) =>
          previousOptionalHighTierTraitOfferDraft(catalog, value),
        targetedAcquisitionTargets: (value: AuthoredTraitOffer, optionKey: TraitOptionKey) =>
          Object.freeze(
            branchContexts.map((context) => {
              if (value.kind !== 'traits')
                return Object.freeze({
                  sourceSupported: false,
                  targetTraitKeys: Object.freeze([]),
                });
              const option = value.options[optionIndex(optionKey)];
              if (option === undefined) {
                return Object.freeze({
                  sourceSupported: false,
                  targetTraitKeys: Object.freeze([]),
                });
              }
              const sourceAssessment = assessTraitOffer(
                catalog,
                value,
                context.before,
                traitOfferCandidateContext(catalog, context.before, context.context, value),
              )[optionIndex(optionKey)];
              return Object.freeze({
                sourceSupported: sourceAssessment?.legal ?? false,
                targetTraitKeys: targetedAcquisitionTargetKeys(
                  catalog,
                  option.traitKey,
                  context.before,
                ),
              });
            }),
          ),
        circeResolution: (value: AuthoredTraitOffer, optionKey: TraitOptionKey) =>
          Object.freeze(
            branchContexts.flatMap<{
              readonly effect: 'activateArcana' | 'promoteArcana' | 'disableFear';
              readonly requiredCount: number;
              readonly arcanaKeys: readonly string[];
              readonly vowKeys: readonly string[];
              readonly outerAvailable: boolean;
            }>((context) => {
              if (value.kind !== 'traits') return [];
              const option = value.options[optionIndex(optionKey)];
              const effect =
                option === undefined
                  ? undefined
                  : catalog.traits.byKey[option.traitKey]?.selectedDisposition;
              if (effect?.kind !== 'circe' || context.arcanaFear === undefined) return [];
              return [circeResolutionDomain(catalog, context.arcanaFear, effect.effect)];
            }),
          ),
        echoPomTargets: (value: AuthoredTraitOffer, optionKey: TraitOptionKey) =>
          Object.freeze(
            branchContexts.flatMap((context) => {
              if (value.kind !== 'traits') return [];
              const option = value.options[optionIndex(optionKey)];
              if (option === undefined) return [];
              const disposition = catalog.traits.byKey[option.traitKey]?.selectedDisposition;
              if (disposition?.kind !== 'echo' || disposition.effect !== 'doubleLevel') return [];
              return [echoPomGreatestLevelTraitKeys(catalog, context.before)];
            }),
          ),
        echoLastRunBoon: (value: AuthoredTraitOffer, optionKey: TraitOptionKey) =>
          Object.freeze(
            branchContexts.flatMap((context) => {
              if (value.kind !== 'traits') return [];
              const option = value.options[optionIndex(optionKey)];
              if (option === undefined) return [];
              const disposition = catalog.traits.byKey[option.traitKey]?.selectedDisposition;
              if (disposition?.kind !== 'echo' || disposition.effect !== 'lastRunBoon') return [];
              return [echoLastRunBoonOutcomes(catalog, context.before)];
            }),
          ),
        allTogetherSet: (
          value: AuthoredTraitOffer,
          optionKey: TraitOptionKey,
          setKey: import('../catalog-schema').DirectTraitSetKey,
        ) =>
          Object.freeze(
            branchContexts.flatMap((context) => {
              if (value.kind !== 'traits') return [];
              const option = value.options[optionIndex(optionKey)];
              if (option === undefined) return [];
              const disposition = catalog.traits.byKey[option.traitKey]?.selectedDisposition;
              if (disposition?.kind !== 'directTraitSets') return [];
              return [directTraitSetOutcomes(catalog, context.before, option.traitKey, setKey)];
            }),
          ),
        naturalSelectionTargets: (
          levelCount: number,
          slots: readonly TraitOrdinaryBoonSlot[],
          targets: readonly string[] | undefined,
        ) =>
          Object.freeze(
            branchContexts.map((context) =>
              assessNaturalSelectionTargets(catalog, context.before, levelCount, slots, targets),
            ),
          ),
        ransom: (value: AuthoredTraitOffer) =>
          Object.freeze(
            branchContexts.flatMap((context) => {
              const evaluation = evaluateReachedTraitOffer(
                catalog,
                address.kind === 'traitOffer' ? address : address.trait,
                address.kind === 'traitOffer'
                  ? address.acquisitionRole
                  : address.trait.acquisitionRole,
                value,
                context.before,
                traitOfferCandidateContext(catalog, context.before, context.context, value),
                0,
                context.arcanaFear,
                false,
                context.keepsakes,
              );
              const applied = recordReachedTraitOffer(catalog, evaluation, 0, 'candidate');
              return applied.ransomAssessment === undefined ? [] : [applied.ransomAssessment];
            }),
          ),
        chaosOfferRules: (value?: AuthoredTraitOffer) =>
          Object.freeze(
            branchContexts.map((context) => {
              const ordinary = context.before.activeChaosCurses.some(
                (curse) => curse.semanticTag === 'Ordinary',
              );
              const rejected = context.before.activeChaosCurses.some(
                (curse) => curse.semanticTag === 'Rejected',
              );
              return Object.freeze({
                ordinaryRequiresCommon: ordinary,
                rejectedBlockRequired: rejected,
                rejectedBlockableOptionKeys: Object.freeze(
                  !rejected
                    ? []
                    : (['option1', 'option2', 'option3'] as const)
                        .slice(0, value?.kind === 'traits' ? value.options.length : 3)
                        .filter(
                          (key) => value?.kind !== 'traits' || key !== value.selectedOptionKey,
                        ),
                ),
              });
            }),
          ),
        chaosPairDomains: (pair: { readonly curseKey: string; readonly blessingKey: string }) =>
          Object.freeze(
            branchContexts.map((context) => {
              const eligible = <
                T extends {
                  readonly offerRequirements?: readonly import('../catalog-schema').ChaosOfferRequirement[];
                },
              >(
                entry: T,
              ) =>
                !(entry.offerRequirements ?? []).some((requirement) => {
                  switch (requirement.kind) {
                    case 'matureChaosBlessing':
                      return context.before.maturedChaosBlessings.length === 0;
                    case 'elementMinimum':
                      return (
                        context.before.elementCounts[requirement.element] < requirement.minimum
                      );
                    case 'notKeepsake':
                      return context.context.currentKeepsakeKey === requirement.keepsakeKey;
                    case 'notAspect':
                      return context.context.aspectKey === requirement.aspectKey;
                    case 'routeKey':
                      return address.routeKey !== requirement.routeKey;
                  }
                });
              const curses = catalog.chaos.curses.values.filter(eligible);
              const blessings = catalog.chaos.blessings.values.filter(eligible);
              return Object.freeze({
                curseKeys: Object.freeze(curses.map((curse) => curse.key)),
                blessingKeys: Object.freeze(blessings.map((blessing) => blessing.key)),
                rarities: Object.freeze(
                  catalog.chaos.blessings.byKey[pair.blessingKey]?.fixedRarity === 'Legendary'
                    ? (['Legendary'] as const)
                    : catalog.chaos.curses.byKey[pair.curseKey]?.semanticTag === 'Barren'
                      ? (['Heroic'] as const)
                      : (['Common', 'Rare', 'Epic'] as const),
                ),
                curseDurations: Object.freeze(
                  Object.fromEntries(
                    curses.map((curse) => [
                      curse.key,
                      Object.freeze({
                        minimum: curse.duration.minimum,
                        maximum: curse.duration.maximum,
                        step: curse.duration.step,
                      }),
                    ]),
                  ),
                ),
                curseOperands: Object.freeze(
                  Object.fromEntries(curses.map((curse) => [curse.key, curse.operands])),
                ),
                blessingOperands: Object.freeze(
                  Object.fromEntries(
                    blessings.map((blessing) => [blessing.key, blessing.operands]),
                  ),
                ),
              });
            }),
          ),
      });
    },
  });
}

export function createEmptyTraitOfferCandidateArtifacts(): TraitOfferCandidateArtifacts {
  return Object.freeze({ at: () => undefined });
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
    // physical automatic room. Duplicate publication would be a chronology bug.
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
