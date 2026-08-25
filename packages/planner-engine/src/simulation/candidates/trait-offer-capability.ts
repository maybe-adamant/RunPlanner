import {
  semanticAddressKey,
  type LevelResolutionAddress,
  type TraitOfferAddress,
  type NaturalSelectionResultAddress,
} from '../../authored-project/addresses';
import type { Catalog, TraitOrdinaryBoonSlot } from '../../catalog-schema';
import type {
  AuthoredLevelResolution,
  AuthoredTraitOffer,
  AuthoredTraitOfferTraits,
} from '../../authored-project/traits';
import { optionIndex, type TraitOptionKey } from '../../authored-project/traits';
import { circeResolutionDomain } from '../arcana-fear';
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
  echoPomGreatestLevelTraitKeys,
  echoLastRunBoonOutcomes,
  directTraitSetOutcomes,
  chaosAdjustedTraitOfferContext,
  assessNaturalSelectionTargets,
  type NaturalSelectionTargetAssessment,
  evaluateReachedTraitOffer,
  recordReachedTraitOffer,
  type RansomAssessment,
} from '../traits';
import { evaluateCallingCardOffer } from '../keepsakes';

function traitOfferCandidateContext(
  catalog: Catalog,
  history: TraitHistoryState,
  context: TraitOfferContext,
  value: AuthoredTraitOffer,
): TraitOfferContext {
  return chaosAdjustedTraitOfferContext(catalog, history, value, context);
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
  ) => readonly (readonly import('../traits').EchoLastRunBoonOutcome[])[];
  /** Exact ownership-only All Together set domains for surviving branches. */
  readonly allTogetherSet: (
    value: AuthoredTraitOffer,
    optionKey: TraitOptionKey,
    setKey: import('../../catalog-schema').DirectTraitSetKey,
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
    readonly rarities: readonly import('../../catalog-schema').TraitRarity[];
    readonly curseDurations: Readonly<
      Record<string, { readonly minimum: number; readonly maximum: number; readonly step: number }>
    >;
    readonly curseOperands: Readonly<
      Record<string, readonly import('../../catalog-schema').ChaosNumericOperand[]>
    >;
    readonly blessingOperands: Readonly<
      Record<string, readonly import('../../catalog-schema').ChaosNumericOperand[]>
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
          setKey: import('../../catalog-schema').DirectTraitSetKey,
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
                  readonly offerRequirements?: readonly import('../../catalog-schema').ChaosOfferRequirement[];
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
