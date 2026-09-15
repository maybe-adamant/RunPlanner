import {
  semanticAddressKey,
  type LevelResolutionAddress,
  type TraitOfferAddress,
  type NaturalSelectionResultAddress,
} from '../../../authored-project/addresses';
import type {
  BoonRarityRollOrder,
  BoonRarityValues,
  Catalog,
  TraitOrdinaryBoonSlot,
  TraitRarity,
} from '../../../catalog-schema';
import type {
  AuthoredLevelResolution,
  AuthoredTraitOffer,
  AuthoredTraitOfferTraits,
} from '../../../authored-project/traits/state';
import { optionIndex, type TraitOptionKey } from '../../../authored-project/traits/state';
import { circeResolutionDomain } from '../../arcana-fear';
import {
  assessTraitOffer,
  assessTraitOfferBeforeRarification,
  appendTraitOfferDraft,
  removeTraitOfferDraft,
  traitOfferStartingOutcome,
  assessSelectedTargetedAcquisition,
  targetedAcquisitionTargetKeys,
  type TraitOfferBranchAssessment,
  type TraitOfferCandidateContext,
  evaluateReachedLevelResolution,
  pomEligibleTargetKeys,
  type TraitHistoryState,
  echoPomGreatestLevelTraitKeys,
  echoLastRunBoonOutcomes,
  directTraitSetOutcomes,
  offerGenerationAdjustedTraitOfferContext,
  traitOfferGenerationContext,
  isChaosGodScreenGiver,
  assessNaturalSelectionTargets,
  type NaturalSelectionTargetAssessment,
  evaluateReachedTraitOffer,
  recordReachedTraitOffer,
  type RansomAssessment,
  boonRarityFactsForOffer,
  assessChaosPairRarity,
  chaosPairRarities,
} from '../../traits';
import type { EchoLastRunBoonOutcome, TraitOfferContext } from '../../traits/offer-domain';
import { advanceCurrentKeepsake } from '../../keepsakes/state';
import {
  concaveStoneProcSupport,
  concaveStoneResidualOptionKeys,
} from '../../keepsakes/trait-effects';
import { evaluateCallingCardOffer } from '../../keepsakes/reward-effects';
import type { AuthoredConcaveStoneResult } from '../../../authored-project/traits/state';
import { resolveTraitOfferOptionLevel } from '../../traits/offer-levels';
import { deriveBoonRarityValues } from '../../traits/rarity';
import { settleSelectedTraitChildren } from '../../rewards/trait-settlement/selected-child-settlement';

export interface ConcaveStoneCandidateBranch {
  readonly procSupport: number;
  readonly residualOptionKeys: readonly TraitOptionKey[];
  readonly required: boolean;
  readonly supported: boolean;
  readonly resultSupport: 'forced' | 'possible' | 'impossible';
  readonly result?: AuthoredConcaveStoneResult;
}

interface ConcaveStoneSecondaryCandidateContext {
  readonly before: TraitHistoryState;
  readonly option: AuthoredTraitOfferTraits['options'][number];
}

export interface TraitOfferGenerationState {
  readonly rarity:
    | {
        readonly kind: 'orderedChecks';
        readonly values: BoonRarityValues;
        readonly rollOrder: BoonRarityRollOrder;
      }
    | { readonly kind: 'fixed'; readonly rarity: TraitRarity };
}

export interface TraitOfferCandidateBranchAssessment extends TraitOfferBranchAssessment {
  readonly offerGenerationState?: TraitOfferGenerationState;
}

function traitOfferCandidateContext(
  catalog: Catalog,
  history: TraitHistoryState,
  context: TraitOfferContext,
  value: AuthoredTraitOffer,
  arcanaFear?: import('../../arcana-fear').ArcanaFearState,
): TraitOfferContext {
  const giver = value.kind === 'chaos' ? undefined : catalog.traitGivers.byKey[value.giverKey];
  return giver?.providerKind === 'olympian' || giver?.providerKind === 'hermes'
    ? traitOfferGenerationContext(catalog, history, value.giverKey, context, arcanaFear)
    : offerGenerationAdjustedTraitOfferContext(catalog, history, value, context);
}

/**
 * Exact trait-offer contact retained by one biome reward evaluation. The
 * pre-offer histories and resolved contexts are intentionally reachable only
 * through this capability; they are not part of the public simulation data.
 */
export interface TraitOfferCandidateCapability {
  readonly evaluateOffer: (
    value: AuthoredTraitOffer,
  ) => readonly TraitOfferCandidateBranchAssessment[];
  readonly callingCard: (value: AuthoredTraitOffer) => readonly {
    readonly effectiveOffer: AuthoredTraitOffer;
    readonly remainingCharges: number | undefined;
    readonly invalidActions: readonly number[];
    readonly rarifiableOptionKeys: readonly TraitOptionKey[];
  }[];
  /** One exact native-supported initial traits-or-Gold outcome. */
  readonly traitOfferStartingOutcome: (giverKey: string) => AuthoredTraitOffer | undefined;
  readonly appendTraitOptionDraft: (
    value: AuthoredTraitOffer,
  ) => AuthoredTraitOfferTraits | undefined;
  readonly removeTraitOptionDraft: (
    value: AuthoredTraitOfferTraits,
  ) => AuthoredTraitOffer | undefined;
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
  ) => readonly (readonly EchoLastRunBoonOutcome[])[];
  /** Exact ownership-only All Together set domains for surviving branches. */
  readonly allTogetherSet: (
    value: AuthoredTraitOffer,
    optionKey: TraitOptionKey,
    setKey: import('../../../catalog-schema').DirectTraitSetKey,
  ) => readonly (readonly (string | null)[])[];
  /** Exact selected Natural Selection result assessment at this child frontier. */
  readonly naturalSelectionTargets: (
    value: AuthoredTraitOffer,
    optionKey: TraitOptionKey,
    levelCount: number,
    slots: readonly TraitOrdinaryBoonSlot[],
    targets: readonly string[] | undefined,
  ) => readonly NaturalSelectionTargetAssessment[];
  /** Exact post-primary Stone support for this frozen authored offer. */
  readonly concaveStone: (value: AuthoredTraitOffer) => readonly ConcaveStoneCandidateBranch[];
  /** Data-only current-frontier transform for a selected Ransom. */
  readonly ransom: (value: AuthoredTraitOffer) => readonly RansomAssessment[];
  /** Closed Chaos restrictions at this exact pre-offer frontier. */
  readonly chaosOfferRules: (value?: AuthoredTraitOffer) => readonly {
    readonly rejectedBlockRequired: boolean;
    readonly rejectedBlockableOptionKeys: readonly TraitOptionKey[];
    /** A retained block is missing, stale, or targets the selected row. */
    readonly rejectedBlockNeedsRepair: boolean;
  }[];
  /** Declaration-owned three-option Chaos envelope and selected-outcome domains. */
  readonly chaosOfferDomain: (value?: AuthoredTraitOffer) => readonly ChaosOfferDomain[];
}

export interface ChaosOfferCurseOptionDomain {
  readonly optionKey: TraitOptionKey;
  readonly curseKeys: readonly string[];
  /** Legal rows before retaining the authored identity for repair. */
  readonly availableCurseKeys: readonly string[];
  readonly requirements: Readonly<
    Record<
      string,
      {
        readonly minimum: number;
        readonly maximum: number;
        readonly step: number;
        readonly authoringDefault: number;
        readonly unit: string;
      }
    >
  >;
}

export interface ChaosOfferDomain {
  readonly curseOptions: readonly [
    ChaosOfferCurseOptionDomain,
    ChaosOfferCurseOptionDomain,
    ChaosOfferCurseOptionDomain,
  ];
  readonly selectedCurseKey?: string;
  readonly selectedCurseOperands: readonly import('../../../catalog-schema').ChaosNumericOperand[];
  readonly blessingKeys: readonly string[];
  /** Legal rows before retaining the authored identity for repair. */
  readonly availableBlessingKeys: readonly string[];
  readonly rarities: readonly import('../../../catalog-schema').TraitRarity[];
  readonly blessingOperands: Readonly<
    Record<string, readonly import('../../../catalog-schema').ChaosNumericOperand[]>
  >;
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
      const concaveStoneSecondaryContext = (
        value: AuthoredTraitOffer,
        optionKey: TraitOptionKey,
        context: TraitOfferCandidateContext,
      ): ConcaveStoneSecondaryCandidateContext | undefined => {
        if (
          value.kind !== 'traits' ||
          value.concaveStoneResult?.kind !== 'proc' ||
          value.concaveStoneResult.optionKey !== optionKey ||
          value.selectedOptionKey === optionKey
        )
          return undefined;
        const residual = value.options[optionIndex(optionKey)];
        if (residual === undefined) return undefined;
        const primaryOffer = value;
        const base = assessTraitOfferBeforeRarification(
          catalog,
          primaryOffer,
          context.before,
          traitOfferCandidateContext(
            catalog,
            context.before,
            context.context,
            primaryOffer,
            context.arcanaFear,
          ),
        );
        const callingCard =
          context.keepsakes === undefined
            ? undefined
            : evaluateCallingCardOffer(catalog, context.keepsakes, primaryOffer, base.legal);
        const effectiveOffer = callingCard?.offer ?? primaryOffer;
        if (effectiveOffer.kind !== 'traits') return undefined;
        const traitAddress = address.kind === 'traitOffer' ? address : address.trait;
        const primary = evaluateReachedTraitOffer(
          catalog,
          traitAddress,
          traitAddress.acquisitionRole,
          effectiveOffer,
          context.before,
          traitOfferCandidateContext(
            catalog,
            context.before,
            context.context,
            effectiveOffer,
            context.arcanaFear,
          ),
          0,
          context.arcanaFear,
          false,
          callingCard?.state ?? context.keepsakes,
          callingCard === undefined ? undefined : primaryOffer,
        );
        const primarySupported =
          primary.generation?.legal !== false &&
          primary.composition.legal &&
          primary.targetedAcquisition.legal &&
          primary.assessments[optionIndex(effectiveOffer.selectedOptionKey)]?.legal === true;
        if (!primarySupported) return undefined;
        const applied = recordReachedTraitOffer(catalog, primary, 0, 'candidate');
        const selected = effectiveOffer.options[optionIndex(effectiveOffer.selectedOptionKey)];
        if (applied.event === undefined || selected === undefined) return undefined;
        const selectedDisposition = catalog.traits.byKey[selected.traitKey]?.selectedDisposition;
        const settledChildren = settleSelectedTraitChildren({
          catalog,
          traitHistory: applied.history,
          traitAddress,
          selectedOptionKey: effectiveOffer.selectedOptionKey,
          selected,
          selectedDisposition,
          targetedAcquisition: primary.targetedAcquisition,
          before: primary.before,
          candidateContext: Object.freeze({
            before: primary.before,
            context: traitOfferCandidateContext(
              catalog,
              context.before,
              context.context,
              effectiveOffer,
              context.arcanaFear,
            ),
            ...(context.arcanaFear === undefined ? {} : { arcanaFear: context.arcanaFear }),
            ...(context.keepsakes === undefined ? {} : { keepsakes: context.keepsakes }),
          }),
          directTraitSetBranchHistories: Object.freeze([context.before]),
          lifecyclePoint: 'candidate',
          sequence: 0,
        });
        if (settledChildren.blockedChild !== undefined) return undefined;
        return Object.freeze({
          before: settledChildren.traitHistory,
          option: residual,
        });
      };
      const isConcaveStoneSecondary = (value: AuthoredTraitOffer, optionKey: TraitOptionKey) =>
        value.kind === 'traits' &&
        value.concaveStoneResult?.kind === 'proc' &&
        value.concaveStoneResult.optionKey === optionKey &&
        value.selectedOptionKey !== optionKey;
      return Object.freeze({
        evaluateOffer: (value: AuthoredTraitOffer) =>
          Object.freeze(
            branchContexts.map((context) => {
              const resolvedContext = traitOfferCandidateContext(
                catalog,
                context.before,
                context.context,
                value,
                context.arcanaFear,
              );
              const base = assessTraitOfferBeforeRarification(
                catalog,
                value,
                context.before,
                resolvedContext,
              );
              const rarityFacts = boonRarityFactsForOffer(
                catalog,
                context.before,
                resolvedContext,
                context.arcanaFear,
              );
              const rarity =
                rarityFacts !== undefined
                  ? Object.freeze({
                      kind: 'orderedChecks' as const,
                      values: deriveBoonRarityValues(rarityFacts),
                      rollOrder: rarityFacts.rollOrder,
                    })
                  : resolvedContext.freshRarityOverride === undefined
                    ? undefined
                    : Object.freeze({
                        kind: 'fixed' as const,
                        rarity: resolvedContext.freshRarityOverride,
                      });
              const offerGenerationState =
                value.kind === 'chaos' || rarity === undefined
                  ? undefined
                  : Object.freeze({
                      rarity,
                    });
              const levelResolutions =
                value.kind !== 'traits'
                  ? Object.freeze([])
                  : Object.freeze(
                      value.options.map((option, index) =>
                        resolveTraitOfferOptionLevel({
                          catalog,
                          before: context.before,
                          context: resolvedContext,
                          ...(context.keepsakes === undefined
                            ? {}
                            : { keepsakes: context.keepsakes }),
                          option,
                          ...(base.assessments[index] === undefined
                            ? {}
                            : { assessment: base.assessments[index] }),
                        }),
                      ),
                    );
              const assessments =
                value.kind === 'chaos'
                  ? Object.freeze([
                      assessChaosPairRarity(
                        catalog,
                        context.before,
                        value,
                        resolvedContext,
                        context.arcanaFear,
                      ),
                    ])
                  : Object.freeze(
                      base.assessments.map((assessment, index) => {
                        const level = levelResolutions[index];
                        return level === undefined || level.findings.length === 0
                          ? assessment
                          : Object.freeze({
                              ...assessment,
                              legal: false,
                              findings: Object.freeze([...assessment.findings, ...level.findings]),
                            });
                      }),
                    );
              // Calling Card acts only after the authored (rolled) offer is
              // accepted. Its derived effective rarity is deliberately not a
              // fresh-roll input: Heroic and promoted replacement rows must
              // retain the legality/composition assessment of that base offer.
              return Object.freeze({
                assessments,
                ...(base.generation === undefined ? {} : { generation: base.generation }),
                composition: base.composition,
                ...(offerGenerationState === undefined ? {} : { offerGenerationState }),
                persephoneLevelBonusMaximums: Object.freeze(
                  levelResolutions.map((resolution) => resolution?.persephoneLevelBonusMaximum),
                ),
                effectiveLevels: Object.freeze(
                  levelResolutions.map((resolution) => resolution?.effectiveLevel),
                ),
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
                traitOfferCandidateContext(
                  catalog,
                  context.before,
                  context.context,
                  value,
                  context.arcanaFear,
                ),
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
                              context.arcanaFear,
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
        traitOfferStartingOutcome: (giverKey: string) =>
          branchContexts
            .map((context) => {
              const outcome = traitOfferStartingOutcome(
                catalog,
                giverKey,
                context.before,
                traitOfferGenerationContext(
                  catalog,
                  context.before,
                  giverKey,
                  context.context,
                  context.arcanaFear,
                ),
              );
              return outcome;
            })
            .find((outcome): outcome is NonNullable<typeof outcome> => outcome !== undefined),
        appendTraitOptionDraft: (value: AuthoredTraitOffer) => {
          if (value.kind === 'chaos') return undefined;
          return branchContexts
            .map((context) =>
              appendTraitOfferDraft(
                catalog,
                value,
                context.before,
                traitOfferCandidateContext(
                  catalog,
                  context.before,
                  context.context,
                  value,
                  context.arcanaFear,
                ),
              ),
            )
            .find((draft): draft is NonNullable<typeof draft> => draft !== undefined);
        },
        removeTraitOptionDraft: (value: AuthoredTraitOfferTraits) =>
          removeTraitOfferDraft(catalog, value),
        targetedAcquisitionTargets: (value: AuthoredTraitOffer, optionKey: TraitOptionKey) =>
          Object.freeze(
            branchContexts.map((context) => {
              if (value.kind !== 'traits')
                return Object.freeze({
                  sourceSupported: false,
                  targetTraitKeys: Object.freeze([]),
                });
              const secondary = concaveStoneSecondaryContext(value, optionKey, context);
              if (isConcaveStoneSecondary(value, optionKey) && secondary === undefined)
                return Object.freeze({
                  sourceSupported: false,
                  targetTraitKeys: Object.freeze([]),
                });
              const option = secondary?.option ?? value.options[optionIndex(optionKey)];
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
                traitOfferCandidateContext(
                  catalog,
                  context.before,
                  context.context,
                  value,
                  context.arcanaFear,
                ),
              )[optionIndex(optionKey)];
              return Object.freeze({
                sourceSupported: secondary !== undefined || (sourceAssessment?.legal ?? false),
                targetTraitKeys: targetedAcquisitionTargetKeys(
                  catalog,
                  option.traitKey,
                  secondary?.before ?? context.before,
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
              return [
                circeResolutionDomain(
                  catalog,
                  context.arcanaFear,
                  effect.effect,
                  context.keepsakes?.fatedStatus,
                ),
              ];
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
              return [echoLastRunBoonOutcomes(catalog, context.before, context.context)];
            }),
          ),
        allTogetherSet: (
          value: AuthoredTraitOffer,
          optionKey: TraitOptionKey,
          setKey: import('../../../catalog-schema').DirectTraitSetKey,
        ) =>
          Object.freeze(
            branchContexts.flatMap((context) => {
              if (value.kind !== 'traits') return [];
              const secondary = concaveStoneSecondaryContext(value, optionKey, context);
              if (isConcaveStoneSecondary(value, optionKey) && secondary === undefined) return [];
              const option = secondary?.option ?? value.options[optionIndex(optionKey)];
              if (option === undefined) return [];
              const disposition = catalog.traits.byKey[option.traitKey]?.selectedDisposition;
              if (disposition?.kind !== 'directTraitSets') return [];
              return [
                directTraitSetOutcomes(
                  catalog,
                  secondary?.before ?? context.before,
                  option.traitKey,
                  setKey,
                ),
              ];
            }),
          ),
        naturalSelectionTargets: (
          value: AuthoredTraitOffer,
          optionKey: TraitOptionKey,
          levelCount: number,
          slots: readonly TraitOrdinaryBoonSlot[],
          targets: readonly string[] | undefined,
        ) =>
          Object.freeze(
            branchContexts.flatMap((context) => {
              const secondary = concaveStoneSecondaryContext(value, optionKey, context);
              if (isConcaveStoneSecondary(value, optionKey) && secondary === undefined) return [];
              return [
                assessNaturalSelectionTargets(
                  catalog,
                  secondary?.before ?? context.before,
                  levelCount,
                  slots,
                  targets,
                ),
              ];
            }),
          ),
        concaveStone: (value: AuthoredTraitOffer) =>
          Object.freeze(
            branchContexts.flatMap((context) => {
              if (value.kind !== 'traits') return [];
              if (catalog.traitGivers.byKey[value.giverKey]?.shopAwareGodTrait !== true) return [];
              const base = assessTraitOfferBeforeRarification(
                catalog,
                value,
                context.before,
                traitOfferCandidateContext(
                  catalog,
                  context.before,
                  context.context,
                  value,
                  context.arcanaFear,
                ),
              );
              const replacementOptionKeys =
                value.kind === 'traits'
                  ? (['option1', 'option2', 'option3'] as const).filter(
                      (key) =>
                        base.assessments[optionIndex(key)]?.replacementTransition !== undefined,
                    )
                  : [];
              const residualOptionKeys = concaveStoneResidualOptionKeys(
                value,
                replacementOptionKeys,
              );
              let keepsakes = context.keepsakes;
              if (keepsakes === undefined) return [];
              const callingCard = evaluateCallingCardOffer(catalog, keepsakes, value, base.legal);
              keepsakes = callingCard.state;
              const selected = value.options[optionIndex(value.selectedOptionKey)];
              const disposition =
                selected === undefined
                  ? undefined
                  : catalog.traits.byKey[selected.traitKey]?.selectedDisposition;
              if (disposition?.kind === 'advanceCurrentKeepsake')
                keepsakes = advanceCurrentKeepsake(catalog, keepsakes, disposition.rankBonus);
              const procSupport = concaveStoneProcSupport(catalog, keepsakes);
              const result = value.concaveStoneResult;
              // An authored Stone result remains a repairable child even after
              // its source disappears. Do not erase the invalid authored fact.
              if (procSupport === undefined) {
                if (result === undefined) return [];
                return [
                  Object.freeze({
                    procSupport: 0,
                    residualOptionKeys: Object.freeze([]),
                    required: false,
                    supported: result.kind === 'noProc',
                    resultSupport:
                      result.kind === 'noProc' ? ('possible' as const) : ('impossible' as const),
                    result,
                  }),
                ];
              }
              if (residualOptionKeys.length === 0 && result === undefined) return [];
              const validResult =
                result === undefined || result.kind === 'noProc'
                  ? procSupport < 100 || residualOptionKeys.length === 0
                  : residualOptionKeys.includes(result.optionKey);
              const required = procSupport >= 100 && residualOptionKeys.length > 0;
              return [
                Object.freeze({
                  procSupport,
                  residualOptionKeys,
                  required,
                  supported: validResult,
                  resultSupport: !validResult
                    ? ('impossible' as const)
                    : required
                      ? ('forced' as const)
                      : ('possible' as const),
                  ...(result === undefined ? {} : { result }),
                }),
              ];
            }),
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
                traitOfferCandidateContext(
                  catalog,
                  context.before,
                  context.context,
                  value,
                  context.arcanaFear,
                ),
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
          value?.kind !== 'traits' || !isChaosGodScreenGiver(catalog, value.giverKey)
            ? Object.freeze([])
            : Object.freeze(
                branchContexts.map((context) => {
                  const rejected = context.before.activeChaosCurses.some(
                    (curse) => curse.semanticTag === 'Rejected',
                  );
                  return Object.freeze({
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
                    rejectedBlockNeedsRepair:
                      value?.kind === 'traits' &&
                      (rejected
                        ? value.rejectedOptionKey === undefined ||
                          !(['option1', 'option2', 'option3'] as const)
                            .slice(0, value.options.length)
                            .filter((key) => key !== value.selectedOptionKey)
                            .includes(value.rejectedOptionKey)
                        : value.rejectedOptionKey !== undefined),
                  });
                }),
              ),
        chaosOfferDomain: (value?: AuthoredTraitOffer) =>
          Object.freeze(
            branchContexts.map((context) => {
              const eligible = <
                T extends {
                  readonly offerRequirements?: readonly import('../../../catalog-schema').ChaosOfferRequirement[];
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
              const availableCurses = catalog.chaos.curses.values.filter(
                (curse) => eligible(curse) && !context.before.bannedTraitKeys.includes(curse.key),
              );
              const availableBlessings = catalog.chaos.blessings.values.filter(eligible);
              const optionKeys = ['option1', 'option2', 'option3'] as const;
              // A retained authored identity is still a repairable picker row,
              // but it belongs only to the exact option that authored it. This
              // keeps an unavailable peer from becoming a new choice in every
              // column.
              const cursesForOption = (index: number) => {
                const retainedKey =
                  value?.kind === 'chaos' ? value.curseOptions[index]?.curseKey : undefined;
                const retained =
                  retainedKey === undefined ? undefined : catalog.chaos.curses.byKey[retainedKey];
                return [
                  ...availableCurses,
                  ...(retained !== undefined &&
                  !availableCurses.some((entry) => entry.key === retained.key)
                    ? [retained]
                    : []),
                ];
              };
              const retainedBlessing =
                value?.kind === 'chaos'
                  ? catalog.chaos.blessings.byKey[value.blessingKey]
                  : undefined;
              const blessings = [
                ...availableBlessings,
                ...(retainedBlessing !== undefined &&
                !availableBlessings.some((entry) => entry.key === retainedBlessing.key)
                  ? [retainedBlessing]
                  : []),
              ];
              const selectedOption =
                value?.kind === 'chaos'
                  ? value.curseOptions[optionIndex(value.selectedOptionKey)]
                  : undefined;
              const selectedCurseKey = selectedOption?.curseKey ?? cursesForOption(0)[0]?.key;
              const selectedCurse =
                selectedCurseKey === undefined
                  ? undefined
                  : catalog.chaos.curses.byKey[selectedCurseKey];
              const blessing =
                value?.kind === 'chaos'
                  ? catalog.chaos.blessings.byKey[value.blessingKey]
                  : blessings[0];
              const rarities = chaosPairRarities(
                catalog,
                context.before,
                context.context,
                context.arcanaFear,
                selectedCurse,
                blessing,
              );
              return Object.freeze({
                curseOptions: Object.freeze(
                  optionKeys.map((optionKey) =>
                    (() => {
                      const curses = cursesForOption(optionKeys.indexOf(optionKey));
                      return Object.freeze({
                        optionKey,
                        curseKeys: Object.freeze(curses.map((curse) => curse.key)),
                        availableCurseKeys: Object.freeze(
                          availableCurses.map((curse) => curse.key),
                        ),
                        requirements: Object.freeze(
                          Object.fromEntries(
                            curses.map((curse) => [
                              curse.key,
                              Object.freeze({
                                minimum: curse.duration.minimum,
                                maximum: curse.duration.maximum,
                                step: curse.duration.step,
                                authoringDefault: curse.duration.authoringDefault,
                                unit: curse.duration.label,
                              }),
                            ]),
                          ),
                        ),
                      });
                    })(),
                  ),
                ) as ChaosOfferDomain['curseOptions'],
                ...(selectedCurseKey === undefined ? {} : { selectedCurseKey }),
                selectedCurseOperands: Object.freeze(selectedCurse?.operands ?? []),
                blessingKeys: Object.freeze(blessings.map((blessing) => blessing.key)),
                availableBlessingKeys: Object.freeze(
                  availableBlessings.map((blessing) => blessing.key),
                ),
                rarities: Object.freeze([...rarities]),
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
