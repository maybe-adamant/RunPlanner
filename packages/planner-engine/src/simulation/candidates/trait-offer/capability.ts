import {
  createAllTogetherSetAddress,
  createTraitAcquisitionTargetAddress,
  semanticAddressKey,
  type LevelResolutionAddress,
  type TraitOfferAddress,
} from '../../../authored-project/addresses';
import {
  concaveStoneProcGiver,
  resolveTraitAcquisitionOrdinalEffect,
} from '../../../catalog-schema';
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
import { CandidateEvaluationContractError } from '../contract';
import { circeResolutionDomain, type CirceResolutionDomain } from '../../arcana-fear';
import {
  assessTraitOffer,
  assessTraitOfferBeforeRarification,
  appendTraitOfferDraft,
  removeTraitOfferDraft,
  traitOfferStartingOutcome,
  rerolledTraitScreensGuess,
  assessRerolledScreens,
  assessSelectedTargetedAcquisition,
  selectedTargetedAcquisitionTargetKeys,
  latestModelTargetDomain,
  type TraitOfferBranchAssessment,
  type TraitOfferCandidateContext,
  evaluateReachedLevelResolution,
  pomEligibleTargetKeys,
  rerolledLevelScreenFindings,
  type TraitHistoryState,
  echoPomGreatestLevelTraitKeys,
  echoLastRunBoonOutcomes,
  directTraitSetOutcomes,
  offerGenerationAdjustedOfferSource,
  resolveTraitOfferSource,
  isChaosGodScreenGiver,
  hasActiveChaosSemanticTag,
  rejectedBlocksRow,
  assessNaturalSelectionTargets,
  type NaturalSelectionTargetAssessment,
  evaluateReachedTraitOffer,
  recordReachedTraitOffer,
  type RansomAssessment,
  boonRarityFactsForOffer,
  assessChaosPairRarity,
  chaosPairRarities,
} from '../../traits';
import type { EchoLastRunBoonOutcome, ResolvedTraitOfferSource } from '../../traits/offer-domain';
import type { SimulationState } from '../../state/model';
import { replaceSimulationTraitHistory } from '../../state/transitions';
import { advanceCurrentKeepsake } from '../../keepsakes/state';
import {
  concaveStoneProcSupport,
  concaveStoneResidualOptionKeys,
} from '../../keepsakes/trait-effects';
import {
  evaluateCallingCardOffer,
  rarifySourceAfterOffer,
  type RarifySource,
} from '../../keepsakes/reward-effects';
import type { AuthoredConcaveStoneResult } from '../../../authored-project/traits/state';
import { resolveTraitOfferOptionLevel } from '../../traits/offer-levels';
import { deriveBoonRarityValues } from '../../traits/rarity';
import { settleSelectedTraitChildren } from '../../rewards/trait-settlement/selected-child-settlement';

export interface ConcaveStoneCandidate {
  readonly procSupport: number;
  readonly residualOptionKeys: readonly TraitOptionKey[];
  readonly required: boolean;
  readonly supported: boolean;
  readonly resultSupport: 'forced' | 'possible' | 'impossible';
  readonly result?: AuthoredConcaveStoneResult;
}

interface ConcaveStoneSecondaryCandidateContext {
  /** Exact post-primary snapshot the residual row is acquired against. */
  readonly state: SimulationState;
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

export interface TraitOfferCandidateOfferAssessment extends TraitOfferBranchAssessment {
  readonly offerGenerationState?: TraitOfferGenerationState;
}

function traitOfferCandidateSource(
  catalog: Catalog,
  context: TraitOfferCandidateContext,
  value: AuthoredTraitOffer,
): ResolvedTraitOfferSource {
  const giver = value.kind === 'chaos' ? undefined : catalog.traitGivers.byKey[value.giverKey];
  return giver?.providerKind === 'olympian' || giver?.providerKind === 'hermes'
    ? resolveTraitOfferSource(catalog, context.generationState, value.giverKey, context.source)
    : offerGenerationAdjustedOfferSource(catalog, context.generationState, value, context.source);
}

/**
 * Exact trait-offer contact retained by one biome reward evaluation. The
 * pre-offer histories and resolved contexts are intentionally reachable only
 * through this capability; they are not part of the public simulation data.
 */
export interface TraitOfferCandidateCapability {
  readonly evaluateOffer: (
    value: AuthoredTraitOffer,
    /** Whether an unshowable screen names why; focused row queries do not ask. */
    explainFailure: boolean,
  ) => TraitOfferCandidateOfferAssessment;
  readonly callingCard: (value: AuthoredTraitOffer) => {
    readonly effectiveOffer: AuthoredTraitOffer;
    readonly remainingCharges: number | undefined;
    readonly rarifySource: RarifySource | undefined;
    readonly invalidActions: readonly number[];
    readonly rarifiableOptionKeys: readonly TraitOptionKey[];
    /** Each earlier screen's clicks, oldest first; empty without earlier screens. */
    readonly rerolledScreens: readonly {
      readonly invalidActions: readonly number[];
      readonly rarifiableOptionKeys: readonly TraitOptionKey[];
    }[];
  };
  /** One exact native-supported initial traits-or-Gold outcome. */
  readonly traitOfferStartingOutcome: (giverKey: string) => AuthoredTraitOffer | undefined;
  /** A guessed legal chain of screens rerolled away before these final rows. */
  readonly rerolledScreensGuess: (
    value: AuthoredTraitOffer,
    count: number,
  ) => ReturnType<typeof rerolledTraitScreensGuess>;
  readonly appendTraitOptionDraft: (
    value: AuthoredTraitOffer,
  ) => AuthoredTraitOfferTraits | undefined;
  readonly removeTraitOptionDraft: (
    value: AuthoredTraitOfferTraits,
  ) => AuthoredTraitOffer | undefined;
  readonly targetedAcquisitionTargets: (
    value: AuthoredTraitOffer,
    optionKey: TraitOptionKey,
  ) => {
    readonly sourceSupported: boolean;
    readonly targetTraitKeys: readonly string[];
    readonly requiredCount?: number;
  };
  /** Exact selected-Circe pre-effect domains; no consumer receives Arcana/Fear state. */
  readonly circeResolution: (
    value: AuthoredTraitOffer,
    optionKey: TraitOptionKey,
  ) => CirceResolutionDomain | undefined;
  /** Exact selected Echo-Pom greatest-level domain. */
  readonly echoPomTargets: (
    value: AuthoredTraitOffer,
    optionKey: TraitOptionKey,
  ) => readonly string[] | undefined;
  /** Exact selected Echo-last-run outcome domain. */
  readonly echoLastRunBoon: (
    value: AuthoredTraitOffer,
    optionKey: TraitOptionKey,
  ) => readonly EchoLastRunBoonOutcome[] | undefined;
  /** Exact ownership-only All Together set domain. */
  readonly allTogetherSet: (
    value: AuthoredTraitOffer,
    optionKey: TraitOptionKey,
    setKey: import('../../../catalog-schema').DirectTraitSetKey,
  ) => readonly (string | null)[] | undefined;
  /** Exact selected Natural Selection result assessment at this child frontier. */
  readonly naturalSelectionTargets: (
    value: AuthoredTraitOffer,
    optionKey: TraitOptionKey,
    levelCount: number,
    slots: readonly TraitOrdinaryBoonSlot[],
    targets: readonly string[] | undefined,
  ) => NaturalSelectionTargetAssessment | undefined;
  /** Exact post-primary Stone support for this frozen authored offer. */
  readonly concaveStone: (value: AuthoredTraitOffer) => ConcaveStoneCandidate | undefined;
  /** Data-only current-frontier transform for a selected Ransom. */
  readonly ransom: (value: AuthoredTraitOffer) => RansomAssessment | undefined;
  /** Closed Chaos restrictions at this exact pre-offer frontier. */
  readonly chaosOfferRules: (value?: AuthoredTraitOffer) =>
    | {
        readonly rejectedBlockRequired: boolean;
        readonly rejectedBlockableOptionKeys: readonly TraitOptionKey[];
        /** A retained block is missing, stale, or targets the selected row. */
        readonly rejectedBlockNeedsRepair: boolean;
      }
    | undefined;
  /** Declaration-owned three-option Chaos envelope and selected-outcome domains. */
  readonly chaosOfferDomain: (value?: AuthoredTraitOffer) => ChaosOfferDomain;
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
  readonly at: (address: TraitOfferAddress) => TraitOfferCandidateCapability | undefined;
}

/** The one Pom level-resolution surface every reached context agrees on. */
export interface LevelResolutionCandidateSurface {
  readonly effectKind: 'choice' | 'random';
  readonly emptyTargetAllowed?: boolean;
  readonly levelCount: number;
  /** Defined only for a declaration-owned visible Pom choice. */
  readonly requiredOfferCount?: number;
  /** Exact pre-acquisition target domain. */
  readonly eligibleTargetTraitKeys: readonly string[];
  /** An unresolved choice's starting draft: the first required targets, the first selected. */
  readonly startingResolution?: AuthoredLevelResolution;
}

export interface LevelResolutionCandidateEvaluation {
  readonly supported: boolean;
  readonly findings: readonly string[];
  /** Findings of the rerolled-away screens and their link to the final one, by tab. */
  readonly rerolledScreenFindings: readonly import('../../traits/level-effects').RerolledLevelScreenFinding[];
  /** Eligible targets no offered slot holds; an offered slot may keep its own target. */
  readonly availableTargetTraitKeys: readonly string[];
}

export interface LevelResolutionCandidateCapability {
  readonly surface: LevelResolutionCandidateSurface;
  readonly evaluate: (value: AuthoredLevelResolution) => LevelResolutionCandidateEvaluation;
  /** A guessed legal chain of Pom screens rerolled away before these final targets. */
  readonly rerolledScreensGuess: (
    offeredTraitKeys: readonly string[],
    count: number,
  ) => readonly { readonly offeredTraitKeys: readonly string[] }[] | undefined;
}

export interface LevelResolutionCandidateArtifacts {
  readonly at: (address: LevelResolutionAddress) => LevelResolutionCandidateCapability | undefined;
}

/**
 * A guessed chain of `count` Pom screens shown and rerolled away before these
 * final rows. With more than three levellable boons every screen shows three
 * and must not repeat the one before it, so the chain alternates a different
 * three with the final ones and ends on the different three.
 */
function rerolledLevelScreensGuess(
  pool: readonly string[],
  finalOffered: readonly string[],
  count: number,
): readonly { readonly offeredTraitKeys: readonly string[] }[] | undefined {
  if (count < 1 || pool.length <= 3) return undefined;
  const outside = pool.find((traitKey) => !finalOffered.includes(traitKey));
  if (outside === undefined) return undefined;
  const other = Object.freeze([
    outside,
    ...pool.filter((traitKey) => traitKey !== outside).slice(0, 2),
  ]);
  const final = Object.freeze([...finalOffered]);
  return Object.freeze(
    Array.from({ length: count }, (_, index) =>
      Object.freeze({ offeredTraitKeys: (count - 1 - index) % 2 === 0 ? other : final }),
    ),
  );
}

interface LevelResolutionCandidateContext {
  readonly address: LevelResolutionAddress;
  readonly before: TraitHistoryState;
  readonly levelCount: number;
  readonly effectKind: 'choice' | 'random';
  readonly emptyTargetAllowed?: boolean;
}

function levelResolutionSurface(
  catalog: Catalog,
  context: LevelResolutionCandidateContext,
): LevelResolutionCandidateSurface {
  const eligibleTargetTraitKeys = pomEligibleTargetKeys(catalog, context.before);
  const common = {
    effectKind: context.effectKind,
    ...(context.emptyTargetAllowed ? { emptyTargetAllowed: true } : {}),
    levelCount: context.levelCount,
  };
  if (context.effectKind !== 'choice') return Object.freeze({ ...common, eligibleTargetTraitKeys });
  const requiredOfferCount = Math.min(3, context.before.upgradableTraitCount);
  const offeredTraitKeys = Object.freeze(eligibleTargetTraitKeys.slice(0, requiredOfferCount));
  return Object.freeze({
    ...common,
    requiredOfferCount,
    eligibleTargetTraitKeys,
    startingResolution: Object.freeze({
      kind: 'choice' as const,
      offeredTraitKeys,
      selectedTraitKey: offeredTraitKeys[0] ?? null,
    }),
  });
}

/**
 * Publishes one surface per reached Pom. Every reached context must agree on
 * it, since the editor resolves the choice against one state; a divergence is
 * an engine contract failure, never a choice offered to the user.
 */
export function createLevelResolutionCandidateArtifacts(
  catalog: Catalog,
  contexts: ReadonlyMap<string, readonly LevelResolutionCandidateContext[]>,
): LevelResolutionCandidateArtifacts {
  const privateContexts = new Map(contexts);
  return Object.freeze({
    at: (address: LevelResolutionAddress) => {
      const key = semanticAddressKey(address);
      const reached = privateContexts.get(key);
      const context = reached?.[0];
      if (context === undefined) return undefined;
      const surface = levelResolutionSurface(catalog, context);
      const agreed = JSON.stringify(surface);
      if (
        reached!.some((other) => JSON.stringify(levelResolutionSurface(catalog, other)) !== agreed)
      )
        throw new CandidateEvaluationContractError(
          `level resolution ${key} reached contexts disagree on its surface`,
        );
      return Object.freeze({
        surface,
        evaluate: (value: AuthoredLevelResolution) => {
          const evaluation = evaluateReachedLevelResolution(
            catalog,
            context.address,
            value,
            context.levelCount,
            context.before,
            0,
            context.effectKind,
            context.emptyTargetAllowed ?? false,
          );
          const offered = value.kind === 'choice' ? value.offeredTraitKeys : [];
          const rerolledScreens = rerolledLevelScreenFindings(catalog, value, context.before);
          return Object.freeze({
            supported: evaluation.findings.length === 0 && rerolledScreens.length === 0,
            findings: evaluation.findings,
            rerolledScreenFindings: rerolledScreens,
            availableTargetTraitKeys: Object.freeze(
              surface.eligibleTargetTraitKeys.filter((traitKey) => !offered.includes(traitKey)),
            ),
          });
        },
        rerolledScreensGuess: (offeredTraitKeys: readonly string[], count: number) =>
          rerolledLevelScreensGuess(surface.eligibleTargetTraitKeys, offeredTraitKeys, count),
      });
    },
  });
}

export function createEmptyLevelResolutionCandidateArtifacts(): LevelResolutionCandidateArtifacts {
  return Object.freeze({ at: () => undefined });
}

/**
 * One trait offer's exact contacts: its own pre-offer context, and the
 * pre-effect context of a selected child that blocked, keyed by the child's
 * address. A child query reads its own contact where one was captured.
 */
export interface TraitOfferCandidateContacts {
  readonly offer: TraitOfferCandidateContext;
  readonly children: ReadonlyMap<string, TraitOfferCandidateContext>;
}

export function createTraitOfferCandidateArtifacts(
  catalog: Catalog,
  contacts: ReadonlyMap<string, TraitOfferCandidateContacts>,
): TraitOfferCandidateArtifacts {
  const privateContacts = new Map(contacts);
  return Object.freeze({
    at: (address: TraitOfferAddress) => {
      const contacts = privateContacts.get(semanticAddressKey(address));
      if (contacts === undefined) return undefined;
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
          context.generationState,
          traitOfferCandidateSource(catalog, context, primaryOffer),
          false,
        );
        const callingCard = evaluateCallingCardOffer(
          catalog,
          context.state.keepsakes,
          primaryOffer,
          base.legal,
        );
        const effectiveOffer = callingCard.offer;
        if (effectiveOffer.kind !== 'traits') return undefined;
        const rarifiedState = Object.freeze({ ...context.state, keepsakes: callingCard.state });
        const primary = evaluateReachedTraitOffer(
          catalog,
          address,
          address.acquisitionRole,
          effectiveOffer,
          rarifiedState,
          traitOfferCandidateSource(catalog, context, effectiveOffer),
          0,
          false,
          primaryOffer,
          false,
          undefined,
          context.generationState,
        );
        const primarySupported =
          primary.generation?.legal !== false &&
          primary.composition.legal &&
          primary.targetedAcquisition.legal &&
          primary.assessments[optionIndex(effectiveOffer.selectedOptionKey)]?.legal === true;
        if (!primarySupported) return undefined;
        const sequence =
          Math.max(0, ...context.state.traitHistory.events.map((event) => event.sequence)) + 1;
        const applied = recordReachedTraitOffer(catalog, primary, sequence, 'candidate');
        const selected = effectiveOffer.options[optionIndex(effectiveOffer.selectedOptionKey)];
        if (applied.event === undefined || selected === undefined) return undefined;
        const selectedDisposition = catalog.traits.byKey[selected.traitKey]?.selectedDisposition;
        const settledChildren = settleSelectedTraitChildren({
          catalog,
          traitHistory: applied.history,
          traitAddress: address,
          selectedOptionKey: effectiveOffer.selectedOptionKey,
          selected,
          selectedDisposition,
          targetedAcquisition: primary.targetedAcquisition,
          before: primary.state.traitHistory,
          candidateContext: Object.freeze({
            state: primary.state,
            generationState: primary.generationState,
            source: traitOfferCandidateSource(catalog, context, effectiveOffer),
          }),
          directTraitSetBranchHistories: Object.freeze([context.state.traitHistory]),
          lifecyclePoint: 'candidate',
          sequence,
        });
        if (settledChildren.blockedChild !== undefined) return undefined;
        return Object.freeze({
          state: replaceSimulationTraitHistory(context.state, settledChildren.traitHistory),
          option: residual,
        });
      };
      const isConcaveStoneSecondary = (value: AuthoredTraitOffer, optionKey: TraitOptionKey) =>
        value.kind === 'traits' &&
        value.concaveStoneResult?.kind === 'proc' &&
        value.concaveStoneResult.optionKey === optionKey &&
        value.selectedOptionKey !== optionKey;
      return Object.freeze({
        evaluateOffer: (value: AuthoredTraitOffer, explainFailure: boolean) => {
          const context = contacts.offer;
          const resolvedContext = traitOfferCandidateSource(catalog, context, value);
          const base = assessTraitOfferBeforeRarification(
            catalog,
            value,
            context.generationState,
            resolvedContext,
            explainFailure,
          );
          const rarityFacts = boonRarityFactsForOffer(
            catalog,
            context.generationState,
            resolvedContext,
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
                      state: context.state,
                      source: resolvedContext,
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
                  assessChaosPairRarity(catalog, context.generationState, value, resolvedContext),
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
          const rerolledScreens = assessRerolledScreens(
            catalog,
            value,
            context.state,
            context.generationState,
            resolvedContext,
            explainFailure,
          );
          return Object.freeze({
            assessments,
            ...(base.generation === undefined ? {} : { generation: base.generation }),
            composition: base.composition,
            ...(rerolledScreens.length === 0 ? {} : { rerolledScreens }),
            ...(offerGenerationState === undefined ? {} : { offerGenerationState }),
            persephoneLevelBonusMaximums: Object.freeze(
              levelResolutions.map((resolution) => resolution?.persephoneLevelBonusMaximum),
            ),
            persephoneBaseLevels: Object.freeze(
              levelResolutions.map((resolution) => resolution?.persephoneBaseLevel),
            ),
            jeweledPomLevels: Object.freeze(
              levelResolutions.map((resolution) => resolution?.jeweledPomLevels),
            ),
            effectiveLevels: Object.freeze(
              levelResolutions.map((resolution) => resolution?.effectiveLevel),
            ),
            targetedAcquisition: assessSelectedTargetedAcquisition(catalog, value, context.state),
          });
        },
        callingCard: (value: AuthoredTraitOffer) => {
          const context = contacts.offer;
          const keepsakes = context.state.keepsakes;
          const base = assessTraitOfferBeforeRarification(
            catalog,
            value,
            context.generationState,
            traitOfferCandidateSource(catalog, context, value),
            false,
          );
          const result = evaluateCallingCardOffer(catalog, keepsakes, value, base.legal);
          // A row is rarifiable where one more click on it, after the
          // screen's authored clicks, would be accepted by the same ledger.
          // An earlier screen's click spends before every later screen's, so
          // it must also leave each click the ledger accepts now accepted.
          const accepts = (
            attempted: AuthoredTraitOffer,
            invalidAt: (evaluation: ReturnType<typeof evaluateCallingCardOffer>) => boolean,
          ) => {
            const attemptedBase = assessTraitOfferBeforeRarification(
              catalog,
              attempted,
              context.generationState,
              traitOfferCandidateSource(catalog, context, attempted),
              false,
            );
            return !invalidAt(
              evaluateCallingCardOffer(catalog, keepsakes, attempted, attemptedBase.legal),
            );
          };
          const withinInvalid = (attempted: readonly number[], current: readonly number[]) =>
            attempted.every((index) => current.includes(index));
          const rowKeys = (count: number) =>
            (['option1', 'option2', 'option3'] as const).filter((key) => optionIndex(key) < count);
          const earlier = value.kind === 'chaos' ? [] : (value.rerolledScreens ?? []);
          return Object.freeze({
            effectiveOffer: result.offer,
            remainingCharges: result.state.callingCard?.remainingCharges,
            rarifySource:
              value.kind === 'chaos'
                ? undefined
                : rarifySourceAfterOffer(catalog, keepsakes, result.state, value.giverKey),
            invalidActions: result.invalidActions,
            rarifiableOptionKeys:
              value.kind !== 'traits'
                ? Object.freeze([])
                : Object.freeze(
                    rowKeys(value.options.length).filter((key) => {
                      const actions = [...(value.rarificationActions ?? []), key];
                      return accepts(
                        Object.freeze({
                          ...value,
                          rarificationActions: Object.freeze(actions),
                        }),
                        (attempt) => attempt.invalidActions.includes(actions.length - 1),
                      );
                    }),
                  ),
            rerolledScreens: Object.freeze(
              earlier.map((screen, index) =>
                Object.freeze({
                  invalidActions: result.rerolledScreenInvalidActions[index] ?? [],
                  rarifiableOptionKeys:
                    screen === null || value.kind === 'chaos'
                      ? Object.freeze([])
                      : Object.freeze(
                          rowKeys(screen.options.length).filter((key) => {
                            const actions = [...(screen.rarificationActions ?? []), key];
                            return accepts(
                              Object.freeze({
                                ...value,
                                rerolledScreens: Object.freeze(
                                  earlier.map((current, at) =>
                                    at === index
                                      ? Object.freeze({
                                          ...screen,
                                          rarificationActions: Object.freeze(actions),
                                        })
                                      : current,
                                  ),
                                ),
                              }),
                              (attempt) =>
                                (attempt.rerolledScreenInvalidActions[index]?.includes(
                                  actions.length - 1,
                                ) ??
                                  true) ||
                                !withinInvalid(attempt.invalidActions, result.invalidActions) ||
                                attempt.rerolledScreenInvalidActions.some(
                                  (invalid, at) =>
                                    !withinInvalid(
                                      invalid,
                                      result.rerolledScreenInvalidActions[at] ?? [],
                                    ),
                                ),
                            );
                          }),
                        ),
                }),
              ),
            ),
          });
        },
        traitOfferStartingOutcome: (giverKey: string) =>
          traitOfferStartingOutcome(
            catalog,
            giverKey,
            contacts.offer.generationState,
            resolveTraitOfferSource(
              catalog,
              contacts.offer.generationState,
              giverKey,
              contacts.offer.source,
            ),
          ),
        rerolledScreensGuess: (value: AuthoredTraitOffer, count: number) =>
          rerolledTraitScreensGuess(
            catalog,
            value,
            count,
            contacts.offer.generationState,
            contacts.offer.state,
            traitOfferCandidateSource(catalog, contacts.offer, value),
          ),
        appendTraitOptionDraft: (value: AuthoredTraitOffer) =>
          value.kind === 'chaos'
            ? undefined
            : appendTraitOfferDraft(
                catalog,
                value,
                contacts.offer.generationState,
                traitOfferCandidateSource(catalog, contacts.offer, value),
              ),
        removeTraitOptionDraft: (value: AuthoredTraitOfferTraits) =>
          removeTraitOfferDraft(catalog, value),
        targetedAcquisitionTargets: (value: AuthoredTraitOffer, optionKey: TraitOptionKey) => {
          const context =
            contacts.children.get(
              semanticAddressKey(createTraitAcquisitionTargetAddress(address, optionKey)),
            ) ?? contacts.offer;
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
            context.generationState,
            traitOfferCandidateSource(catalog, context, value),
          )[optionIndex(optionKey)];
          const latest =
            catalog.traits.byKey[option.traitKey]?.targetedAcquisition?.kind ===
            'upgradeHammerToRank2'
              ? latestModelTargetDomain(
                  catalog,
                  option.traitKey,
                  secondary?.state.traitHistory ?? context.state.traitHistory,
                  context.state.reached.routePosition.ordinal,
                )
              : undefined;
          return Object.freeze({
            sourceSupported: secondary !== undefined || (sourceAssessment?.legal ?? false),
            targetTraitKeys:
              latest?.targetTraitKeys ??
              selectedTargetedAcquisitionTargetKeys(
                catalog,
                option,
                secondary?.state.traitHistory ?? context.state.traitHistory,
              ),
            ...(latest === undefined ? {} : { requiredCount: latest.requiredCount }),
          });
        },
        circeResolution: (value: AuthoredTraitOffer, optionKey: TraitOptionKey) => {
          const context = contacts.offer;
          if (value.kind !== 'traits') return undefined;
          const option = value.options[optionIndex(optionKey)];
          const effect =
            option === undefined
              ? undefined
              : catalog.traits.byKey[option.traitKey]?.selectedDisposition;
          if (effect?.kind !== 'circe') return undefined;
          const acquisitionOrdinal = context.state.reached.routePosition.ordinal;
          return circeResolutionDomain(
            catalog,
            context.state.arcanaFear,
            effect.effect,
            resolveTraitAcquisitionOrdinalEffect(effect, acquisitionOrdinal).circeSelectionCount!,
            context.state.keepsakes.fatedStatus,
          );
        },
        echoPomTargets: (value: AuthoredTraitOffer, optionKey: TraitOptionKey) => {
          const context = contacts.offer;
          if (value.kind !== 'traits') return undefined;
          const option = value.options[optionIndex(optionKey)];
          if (option === undefined) return undefined;
          const disposition = catalog.traits.byKey[option.traitKey]?.selectedDisposition;
          if (disposition?.kind !== 'echo' || disposition.effect !== 'doubleLevel')
            return undefined;
          return echoPomGreatestLevelTraitKeys(catalog, context.state.traitHistory);
        },
        echoLastRunBoon: (value: AuthoredTraitOffer, optionKey: TraitOptionKey) => {
          const context = contacts.offer;
          if (value.kind !== 'traits') return undefined;
          const option = value.options[optionIndex(optionKey)];
          if (option === undefined) return undefined;
          const disposition = catalog.traits.byKey[option.traitKey]?.selectedDisposition;
          if (disposition?.kind !== 'echo' || disposition.effect !== 'lastRunBoon')
            return undefined;
          return echoLastRunBoonOutcomes(catalog, context.state, context.source);
        },
        allTogetherSet: (
          value: AuthoredTraitOffer,
          optionKey: TraitOptionKey,
          setKey: import('../../../catalog-schema').DirectTraitSetKey,
        ) => {
          const context =
            contacts.children.get(
              semanticAddressKey(createAllTogetherSetAddress(address, optionKey, setKey)),
            ) ?? contacts.offer;
          if (value.kind !== 'traits') return undefined;
          const secondary = concaveStoneSecondaryContext(value, optionKey, context);
          if (isConcaveStoneSecondary(value, optionKey) && secondary === undefined)
            return undefined;
          const option = secondary?.option ?? value.options[optionIndex(optionKey)];
          if (option === undefined) return undefined;
          const disposition = catalog.traits.byKey[option.traitKey]?.selectedDisposition;
          if (disposition?.kind !== 'directTraitSets') return undefined;
          return directTraitSetOutcomes(
            catalog,
            secondary?.state.traitHistory ?? context.state.traitHistory,
            option.traitKey,
            setKey,
          );
        },
        naturalSelectionTargets: (
          value: AuthoredTraitOffer,
          optionKey: TraitOptionKey,
          levelCount: number,
          slots: readonly TraitOrdinaryBoonSlot[],
          targets: readonly string[] | undefined,
        ) => {
          const context = contacts.offer;
          const secondary = concaveStoneSecondaryContext(value, optionKey, context);
          if (isConcaveStoneSecondary(value, optionKey) && secondary === undefined)
            return undefined;
          return assessNaturalSelectionTargets(
            catalog,
            secondary?.state.traitHistory ?? context.state.traitHistory,
            levelCount,
            slots,
            targets,
          );
        },
        concaveStone: (value: AuthoredTraitOffer) => {
          const context = contacts.offer;
          if (value.kind !== 'traits') return undefined;
          const procGiver = concaveStoneProcGiver(catalog.traitGivers.byKey[value.giverKey]);
          if (!procGiver && value.concaveStoneResult === undefined) return undefined;
          const base = assessTraitOfferBeforeRarification(
            catalog,
            value,
            context.generationState,
            traitOfferCandidateSource(catalog, context, value),
            false,
          );
          const replacementOptionKeys =
            value.kind === 'traits'
              ? (['option1', 'option2', 'option3'] as const).filter(
                  (key) => base.assessments[optionIndex(key)]?.replacementTransition !== undefined,
                )
              : [];
          const residualOptionKeys = concaveStoneResidualOptionKeys(value, replacementOptionKeys);
          let keepsakes = context.state.keepsakes;
          const callingCard = evaluateCallingCardOffer(catalog, keepsakes, value, base.legal);
          keepsakes = callingCard.state;
          const selected = value.options[optionIndex(value.selectedOptionKey)];
          const disposition =
            selected === undefined
              ? undefined
              : catalog.traits.byKey[selected.traitKey]?.selectedDisposition;
          if (disposition?.kind === 'advanceCurrentKeepsake')
            keepsakes = advanceCurrentKeepsake(catalog, keepsakes, disposition.rankBonus);
          const procSupport = procGiver ? concaveStoneProcSupport(catalog, keepsakes) : undefined;
          const result = value.concaveStoneResult;
          // An authored Stone result remains a repairable child even after
          // its source disappears. Do not erase the invalid authored fact.
          if (procSupport === undefined) {
            if (result === undefined) return undefined;
            return Object.freeze({
              procSupport: 0,
              residualOptionKeys: Object.freeze([]),
              required: false,
              supported: result.kind === 'noProc',
              resultSupport:
                result.kind === 'noProc' ? ('possible' as const) : ('impossible' as const),
              result,
            });
          }
          if (residualOptionKeys.length === 0 && result === undefined) return undefined;
          const validResult =
            result === undefined || result.kind === 'noProc'
              ? procSupport < 100 || residualOptionKeys.length === 0
              : residualOptionKeys.includes(result.optionKey);
          const required = procSupport >= 100 && residualOptionKeys.length > 0;
          return Object.freeze({
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
          });
        },
        ransom: (value: AuthoredTraitOffer) => {
          const context = contacts.offer;
          const evaluation = evaluateReachedTraitOffer(
            catalog,
            address,
            address.acquisitionRole,
            value,
            context.state,
            traitOfferCandidateSource(catalog, context, value),
            0,
            false,
            undefined,
            false,
            undefined,
            context.generationState,
          );
          const applied = recordReachedTraitOffer(catalog, evaluation, 0, 'candidate');
          return applied.ransomAssessment;
        },
        chaosOfferRules: (value?: AuthoredTraitOffer) =>
          value?.kind !== 'traits' || !isChaosGodScreenGiver(catalog, value.giverKey)
            ? undefined
            : (() => {
                const required = rejectedBlocksRow(
                  hasActiveChaosSemanticTag(contacts.offer.state.traitHistory, 'Rejected'),
                  value,
                );
                const blockable = required
                  ? (['option1', 'option2', 'option3'] as const).filter(
                      (key) => key !== value.selectedOptionKey,
                    )
                  : [];
                return Object.freeze({
                  rejectedBlockRequired: required,
                  rejectedBlockableOptionKeys: Object.freeze(blockable),
                  rejectedBlockNeedsRepair: required
                    ? value.rejectedOptionKey === undefined ||
                      !blockable.includes(value.rejectedOptionKey)
                    : value.rejectedOptionKey !== undefined,
                });
              })(),
        chaosOfferDomain: (value?: AuthoredTraitOffer) => {
          const context = contacts.offer;
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
                  return context.generationState.traitHistory.maturedChaosBlessings.length === 0;
                case 'elementMinimum':
                  return (
                    context.generationState.traitHistory.elementCounts[requirement.element] <
                    requirement.minimum
                  );
                case 'notKeepsake':
                  return context.generationState.keepsakes.currentKey === requirement.keepsakeKey;
                case 'notAspect':
                  return context.generationState.equipment.aspectKey === requirement.aspectKey;
                case 'routeKey':
                  return (
                    context.generationState.reached.routePosition.routeKey !== requirement.routeKey
                  );
                case 'routeKeyNot':
                  return (
                    context.generationState.reached.routePosition.routeKey === requirement.routeKey
                  );
              }
            });
          const availableCurses = catalog.chaos.curses.values.filter(
            (curse) =>
              eligible(curse) &&
              !context.generationState.traitHistory.bannedTraitKeys.includes(curse.key),
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
            value?.kind === 'chaos' ? catalog.chaos.blessings.byKey[value.blessingKey] : undefined;
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
            context.generationState,
            context.source,
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
                    availableCurseKeys: Object.freeze(availableCurses.map((curse) => curse.key)),
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
              Object.fromEntries(blessings.map((blessing) => [blessing.key, blessing.operands])),
            ),
          });
        },
      });
    },
  });
}

export function createEmptyTraitOfferCandidateArtifacts(): TraitOfferCandidateArtifacts {
  return Object.freeze({ at: () => undefined });
}
