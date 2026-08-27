export interface TraitOfferContext {
  readonly weaponKey?: string;
  readonly aspectKey?: string;
  readonly devotionNoDuo?: boolean;
  readonly blockGiftBoons?: boolean;
  /** Canonical reward-history fact consumed only by Echo Reward availability. */
  readonly echoLastRewardAvailable?: boolean;
  readonly echoLastRewardRecreation?: NonNullable<RewardHistoryState['lastRewardRecreation']>;
  /** Source-resolved appearance rarity that may exceed the ordinary fresh-offer domain. */
  readonly freshRarityOverride?: TraitRarity;
  /** Exact pre-acquisition Fear frontier for catalog-owned Circe availability. */
  readonly circeRemovableFearVow?: boolean;
  /** The declaration-resolved provider for the addressed acquisition role. */
  readonly resolvedProviderKey?: string;
  readonly manualArcanaGraspCost?: number;
  /** Direct sources such as Echo may forbid the ordinary replacement path. */
  readonly ordinarySlotReplacement?: 'forbidden';
  /** Source loot flag equivalent to `IgnoreStackBoost`. */
  readonly stackBoostsSuppressed?: boolean;
  /** Exact chronological keepsake held at this acquisition frontier. */
  readonly currentKeepsakeKey?: string;
  /** Canonical reward history fact: at least one Spell Drop has settled. */
  readonly settledSpellDrop?: boolean;
  /** Derived, offer-local numeric rarity facts for fresh Olympian/Hermes rolls. */
  readonly boonRarityFacts?: BoonRarityFacts;
  readonly boonRarityRoomOverride?: import('../catalog-schema').BoonRarityOverride;
  readonly boonRarityItemOverride?: import('../catalog-schema').BoonRarityOverride;
  /** One-use Yarn contributions carried by the real Well purchase branch. */
  readonly temporaryBoonRarityUses?: number;
  /** One-use forced replacement state carried by Sacrificial Hymn. */
  readonly limitedSwapUses?: number;
}

/** Applies the active Ordinary curse at the one source-screen frontier.
 * The authored rows stay untouched: a retained non-Common row is assessed as
 * invalid instead of being silently repaired. */
export function chaosAdjustedTraitOfferContext(
  catalog: Catalog,
  history: TraitHistoryState,
  offer: AuthoredTraitOffer,
  context: TraitOfferContext,
): TraitOfferContext {
  if (offer.kind !== 'traits' || !hasActiveChaosSemanticTag(history, 'Ordinary')) return context;
  const provider = catalog.traitGivers.byKey[offer.giverKey]?.providerKind;
  return provider === 'olympian' || provider === 'hermes'
    ? Object.freeze({ ...context, freshRarityOverride: 'Common' })
    : context;
}

/** One branch-aware adapter from existing offer facts to the numeric ledger input. */
export function boonRarityFactsForOffer(
  catalog: Catalog,
  history: TraitHistoryState,
  context: TraitOfferContext,
  arcanaFear?: ArcanaFearState,
): BoonRarityFacts | undefined {
  if (context.boonRarityFacts !== undefined) return context.boonRarityFacts;
  const giver =
    context.resolvedProviderKey === undefined
      ? undefined
      : catalog.traitGivers.byKey[context.resolvedProviderKey];
  if (
    giver === undefined ||
    (giver.providerKind !== 'olympian' && giver.providerKind !== 'hermes') ||
    context.freshRarityOverride !== undefined
  )
    return undefined;
  const barrenActive = hasActiveChaosSemanticTag(history, 'Barren');
  const arcana =
    arcanaFear?.arcana.active.flatMap((active) => {
      const table = catalog.arcanaCards.byKey[active.key]?.boonRarityContributions;
      // Barren suppresses every currently declared rarity contribution, not a
      // hand-maintained card-name list. The Arcana state itself is untouched,
      // so the independently-derived ledger restores it on maturation.
      if (barrenActive && table !== undefined) return [];
      if (table === undefined) return [];
      const rarity = active.rarity;
      return rarity === 'Common' || rarity === 'Rare' || rarity === 'Epic' || rarity === 'Heroic'
        ? [table[rarity]]
        : [];
    }) ?? [];
  const traits =
    history.properUpbringingActive !== true
      ? []
      : Object.values(history.equippedTraits).flatMap((equipped) => {
          const contribution =
            catalog.traits.byKey[equipped.traitKey]?.rarityFloorEffect?.boonRarityContribution;
          return contribution === undefined ? [] : [contribution];
        });
  const favor = history.maturedChaosBlessings.flatMap((blessing) => {
    if (catalog.chaos.blessings.byKey[blessing.blessingKey]?.semanticTag !== 'Favor') return [];
    const rare = blessing.blessingValues.rareBonus;
    return typeof rare === 'number'
      ? [
          Object.freeze({
            additive: Object.freeze({ Rare: rare, Epic: 0.1, Duo: 0.1, Legendary: 0.1 }),
          }),
        ]
      : [];
  });
  return Object.freeze({
    providerBase: catalog.boonRarityBases[giver.providerKind],
    ...(context.boonRarityRoomOverride === undefined
      ? {}
      : { roomOverride: context.boonRarityRoomOverride }),
    ...(context.boonRarityItemOverride === undefined
      ? {}
      : { itemOverride: context.boonRarityItemOverride }),
    contributions: Object.freeze([
      ...arcana,
      ...traits,
      ...favor,
      ...Array.from({ length: context.temporaryBoonRarityUses ?? 0 }, () =>
        Object.freeze({
          additive: Object.freeze({ Rare: 1, Epic: 0.25, Duo: 0.1, Legendary: 0.1 }),
        }),
      ),
    ]),
  });
}

/** Exact derived fact; active Chaos state is history-owned and never persisted. */
export function hasActiveChaosSemanticTag(
  history: TraitHistoryState,
  tag: import('../catalog-schema').ChaosSemanticTag,
): boolean {
  return history.activeChaosCurses.some((curse) => curse.semanticTag === tag);
}

export interface EchoLastRunBoonOutcome {
  readonly option: import('../authored-project/traits').AuthoredEchoLastRunBoonOption;
  readonly effectiveRarity: TraitRarity;
  readonly assessment: TraitAssessment;
  readonly targetTraitKeys: readonly string[];
}

/** Current-run exclusions for a boon already authored into the prior-run cache. */
function assessEchoLastRunBoonOption(
  catalog: Catalog,
  traitKey: string,
  history: TraitHistoryState,
): TraitAssessment {
  const trait = catalog.traits.byKey[traitKey];
  if (trait === undefined)
    return Object.freeze({
      legal: false,
      findings: Object.freeze([
        Object.freeze({ code: 'missingPrerequisite' as const, traitKey, detail: 'unknown trait' }),
      ]),
    });
  const findings: TraitAssessmentFinding[] = [];
  if (history.bannedTraitKeys.includes(traitKey)) findings.push({ code: 'bannedTrait', traitKey });
  if (history.equippedTraits[traitKey] !== undefined)
    findings.push({ code: 'alreadyEquipped', traitKey });
  if (
    trait.blockOfferIfPreviouslyPicked &&
    history.equippedTraits[traitKey] === undefined &&
    history.previouslyPickedTraitKeys.includes(traitKey)
  )
    findings.push({ code: 'previouslyPicked', traitKey });
  if (trait.equipmentSlot !== undefined && history.equippedSlots[trait.equipmentSlot] !== undefined)
    findings.push({ code: 'occupiedBoonSlot', traitKey, detail: trait.equipmentSlot });
  if (
    trait.targetedAcquisition !== undefined &&
    targetedAcquisitionTargetKeys(catalog, traitKey, history).length === 0
  )
    findings.push({ code: 'targetedAcquisitionNoEligibleTarget', traitKey });
  return Object.freeze({ legal: findings.length === 0, findings: Object.freeze(findings) });
}

/** Exact source-resolved Echo-last-run union at one pre-Echo trait frontier. */
export function echoLastRunBoonOutcomes(
  catalog: Catalog,
  history: TraitHistoryState,
): readonly EchoLastRunBoonOutcome[] {
  return Object.freeze(
    catalog.echoLastRunBoon.variants.values.flatMap((variant) => {
      const trait = catalog.traits.byKey[variant.traitKey];
      if (trait?.rarityDomain.kind !== 'ranked') return [];
      return trait.rarityDomain.equippedRarities.map((rarity) => {
        const effectiveRarity =
          rarity === 'Common' && history.properUpbringingActive === true
            ? ('Rare' as const)
            : rarity;
        return Object.freeze({
          option: Object.freeze({
            giverKey: variant.giverKey,
            traitKey: variant.traitKey,
            rarity,
          }),
          effectiveRarity,
          targetTraitKeys: targetedAcquisitionTargetKeys(catalog, variant.traitKey, history),
          assessment: assessEchoLastRunBoonOption(catalog, variant.traitKey, history),
        });
      });
    }),
  );
}

export interface TraitAssessmentFinding {
  readonly code: TraitFindingCode;
  readonly traitKey: string;
  readonly detail?: string;
  /** Exact declaration keys participating in a positive or negative prerequisite. */
  readonly requirementTraitKeys?: readonly string[];
}

export interface TraitAssessment {
  readonly legal: boolean;
  readonly findings: readonly TraitAssessmentFinding[];
  readonly replacementTransition?: TraitReplacementTransition;
}

/** Findings that belong to the complete first-Olympian offer, not one option's
 * ordinary trait legality.  A missing Attack/Special has no option owner. */
export interface TraitOfferCompositionFinding {
  readonly code:
    | 'nonPriorityTrait'
    | 'missingAttackOrSpecial'
    | 'traitOfferSelectionUnavailable'
    | 'chaosOrdinaryRequiresCommon'
    | 'chaosRejectedBlockMissing'
    | 'chaosRejectedBlockUnavailable'
    | 'chaosPairUnavailable';
  readonly traitKey?: string;
  readonly optionKey?: TraitOptionKey;
}

export interface TraitOfferCompositionAssessment {
  readonly applies: boolean;
  readonly legal: boolean;
  readonly findings: readonly TraitOfferCompositionFinding[];
}

export interface TraitReplacementCompositionAssessment {
  readonly applies: boolean;
  readonly legal: boolean;
  readonly ordinaryCandidateCount: number;
  readonly maximumReplacementCount: number;
  readonly replacementCount: number;
  readonly findings: readonly {
    readonly code:
      | 'replacementCompositionExceeded'
      | 'fullTraitOfferWidthRequired'
      | 'missingMandatoryOrdinary'
      | 'missingForcedReplacement'
      | 'unsupportedSparseTraitOffer'
      | 'fallbackGoldUnavailable';
    readonly detail?: string;
  }[];
}

/** One exact pre-offer partition shared by composition and draft construction. */
export interface TraitOfferCompositionDomains {
  readonly ordinary: readonly TraitCandidateAssessment[];
  readonly highTier: readonly TraitCandidateAssessment[];
  readonly replacements: readonly TraitCandidateAssessment[];
}

// This is an identity cache of the complete, immutable domain product. It is
// never a semantic input: callers can always derive the same product from the
// explicit catalog, pre-offer history, giver, and context arguments.
export const compositionDomainCache = new WeakMap<
  Catalog,
  WeakMap<TraitHistoryState, Map<string, TraitOfferCompositionDomains>>
>();

export function compositionDomainCacheKey(giverKey: string, context: TraitOfferContext): string {
  return JSON.stringify([
    giverKey,
    context.weaponKey,
    context.aspectKey,
    context.devotionNoDuo,
    context.blockGiftBoons,
    context.echoLastRewardAvailable,
    context.echoLastRewardRecreation,
    context.freshRarityOverride,
    context.circeRemovableFearVow,
    context.manualArcanaGraspCost,
    context.currentKeepsakeKey,
    context.stackBoostsSuppressed,
    context.boonRarityFacts,
  ]);
}

export type TraitOfferDomainOptionKind = 'ordinary' | 'highTier' | 'replacement';

export interface TraitOfferDomainCompositionInput {
  readonly ordinaryKeys: readonly string[];
  readonly highTierKeys: readonly string[];
  readonly replacementKeys: readonly string[];
  readonly authored: readonly {
    readonly traitKey: string;
    readonly kind: TraitOfferDomainOptionKind;
  }[];
  readonly fallbackGold: boolean;
  readonly minimumReplacementCount?: number;
}

export interface TraitOfferDomainCompositionResult {
  readonly legal: boolean;
  readonly ordinaryCandidateCount: number;
  readonly maximumReplacementCount: number;
  readonly replacementCount: number;
  readonly findings: TraitReplacementCompositionAssessment['findings'];
}

/**
 * The universal three-position exhaustion contract. Inputs are already exact
 * pre-offer O/H/R domains; this function owns only cardinality and fill.
 */
export function assessTraitOfferDomainComposition(
  input: TraitOfferDomainCompositionInput,
): TraitOfferDomainCompositionResult {
  const ordinary = new Set(input.ordinaryKeys);
  const replacements = new Set(input.replacementKeys);
  const ordinaryCandidateCount = ordinary.size;
  const replacementCount = input.authored.filter((option) => option.kind === 'replacement').length;
  const maximumReplacementCount = ordinaryCandidateCount >= 3 ? 1 : 3 - ordinaryCandidateCount;
  if (input.fallbackGold) {
    const legal = ordinaryCandidateCount === 0 && replacements.size === 0;
    return Object.freeze({
      legal,
      ordinaryCandidateCount,
      maximumReplacementCount: 0,
      replacementCount: 0,
      findings: legal
        ? Object.freeze([])
        : Object.freeze([Object.freeze({ code: 'fallbackGoldUnavailable' as const })]),
    });
  }
  const optionKeys = new Set(input.authored.map((option) => option.traitKey));
  const missingOrdinary =
    ordinaryCandidateCount > 0 && ordinaryCandidateCount < 3
      ? [...ordinary].filter((key) => !optionKeys.has(key))
      : [];
  const authoredHighTier = input.authored.filter((option) => option.kind === 'highTier').length;
  const exhaustionRequiredReplacement = Math.min(
    replacements.size,
    Math.max(0, 3 - ordinaryCandidateCount - authoredHighTier),
  );
  const requiredReplacement = Math.max(
    exhaustionRequiredReplacement,
    input.minimumReplacementCount ?? 0,
  );
  const findings = Object.freeze([
    ...(ordinaryCandidateCount >= 3 && input.authored.length !== 3
      ? [Object.freeze({ code: 'fullTraitOfferWidthRequired' as const })]
      : []),
    ...(replacementCount > maximumReplacementCount
      ? [
          Object.freeze({
            code: 'replacementCompositionExceeded' as const,
            detail: `${replacementCount}:${maximumReplacementCount}`,
          }),
        ]
      : []),
    ...(missingOrdinary.length > 0
      ? [
          Object.freeze({
            code: 'missingMandatoryOrdinary' as const,
            detail: missingOrdinary.join(','),
          }),
        ]
      : []),
    ...(replacementCount < requiredReplacement
      ? [
          Object.freeze({
            code: 'missingForcedReplacement' as const,
            detail: `${replacementCount}:${requiredReplacement}`,
          }),
        ]
      : []),
  ]);
  return Object.freeze({
    legal: findings.length === 0,
    ordinaryCandidateCount,
    maximumReplacementCount,
    replacementCount,
    findings,
  });
}

export interface ReachedTraitOfferEvaluation {
  readonly address: SemanticAddress;
  readonly acquisitionRole: string;
  readonly before: TraitHistoryState;
  readonly offer: AuthoredTraitOffer;
  readonly context: TraitOfferContext;
  /** Exact pre-acquisition frontier retained only for Circe candidate capability. */
  readonly arcanaFear?: ArcanaFearState;
  /** Exact pre-offer keepsake frontier retained for Calling Card replay. */
  readonly keepsakes?: KeepsakeState;
  readonly assessments: readonly TraitAssessment[];
  /** Frozen option-level outcomes used by candidate projection and settlement. */
  readonly levelResolutions: readonly TraitOfferOptionLevelResolution[];
  readonly composition: TraitOfferCompositionAssessment;
  readonly replacementComposition: TraitReplacementCompositionAssessment;
  readonly targetedAcquisition: TraitTargetedAcquisitionAssessment;
  readonly reached: true;
  readonly chronologicalIndex: number;
  /** Derived only: execution receives one candidate, never the declaration list. */
  readonly runtimeOfferFallbackTraitKey?: string;
}

/** Resolve the bounded runtime safety result without changing authored intent.
 * Companion screen rows are excluded; ordinary simulated-prefix legality is
 * reused so this is neither persisted nor a second eligibility model. */
export function resolveRuntimeOfferFallbackTraitKey(
  catalog: Catalog,
  offer: AuthoredTraitOffer,
  history: TraitHistoryState,
  context: TraitOfferContext = {},
  excludedTraitKeys: readonly string[] = [],
): string | undefined {
  if (offer.kind !== 'traits') return undefined;
  const selected = offer.options[optionIndex(offer.selectedOptionKey)];
  const candidates =
    selected === undefined
      ? undefined
      : catalog.traits.byKey[selected.traitKey]?.runtimeOfferFallbackTraitKeys;
  if (candidates === undefined) return undefined;
  const companions = new Set([
    ...offer.options
      .filter((_, index) => index !== optionIndex(offer.selectedOptionKey))
      .map((option) => option.traitKey),
    ...excludedTraitKeys,
  ]);
  return candidates.find(
    (traitKey) =>
      !companions.has(traitKey) && assessTraitOption(catalog, traitKey, history, context).legal,
  );
}

/** The branch-local evidence published for one reached selected offer. */
export interface TraitOfferBranchAssessment {
  readonly assessments: readonly TraitAssessment[];
  readonly composition: TraitOfferCompositionAssessment;
  readonly replacementComposition: TraitReplacementCompositionAssessment;
  readonly targetedAcquisition: TraitTargetedAcquisitionAssessment;
  readonly persephoneLevelBonusMaximums: readonly (number | undefined)[];
  readonly effectiveLevels: readonly (number | undefined)[];
}

/**
 * Data-only selected-offer evidence.  Pre-offer histories and resolved
 * contexts stay behind the exact candidate artifact instead of crossing the
 * reward simulation boundary.
 */
export interface SelectedTraitOfferAssessment {
  readonly address: TraitOfferAddress;
  readonly acquisitionRole: string;
  readonly offer: AuthoredTraitOffer;
  readonly branches: readonly TraitOfferBranchAssessment[];
  readonly reached: true;
  readonly chronologicalIndex: number;
}

/** Inputs retained by the opaque exact-address candidate capability. */
export interface TraitOfferCandidateContext {
  readonly before: TraitHistoryState;
  readonly context: TraitOfferContext;
  readonly arcanaFear?: ArcanaFearState;
  readonly keepsakes?: KeepsakeState;
}

export interface TraitContextUnavailable {
  readonly address: SemanticAddress;
  readonly acquisitionRole: string;
  readonly reached: false;
  readonly reason: 'lifecycleNotReached' | 'missingParentAcquisition';
}

function evaluateReachedTraitOfferWithAssessments(
  catalog: Catalog,
  address: SemanticAddress,
  acquisitionRole: string,
  offer: AuthoredTraitOffer,
  before: TraitHistoryState,
  context: TraitOfferContext,
  chronologicalIndex: number,
  arcanaFear?: ArcanaFearState,
  directAcquisition = false,
  keepsakes?: KeepsakeState,
  /** Calling Card changes a rolled row after base-offer legality is established. */
  rarificationBaseOffer?: AuthoredTraitOffer,
  assessments?: readonly TraitAssessment[],
  runtimeOfferFallbackExcludedTraitKeys?: readonly string[],
  frozenAcquisition = false,
  frozenLevelResolutions?: readonly TraitOfferOptionLevelResolution[],
): ReachedTraitOfferEvaluation {
  const effectiveContext = chaosAdjustedTraitOfferContext(catalog, before, offer, context);
  // Exact one-result sources (for example, a keepsake equip) are direct
  // acquisitions, not a sparse ordinary offer. They retain the normal
  // trait-level assessment and history event path without inheriting the
  // three-choice offer-composition contract.
  const legalityOffer = rarificationBaseOffer ?? offer;
  const baseComposition = directAcquisition
    ? Object.freeze({ applies: false, legal: true, findings: Object.freeze([]) })
    : assessTraitOfferComposition(catalog, legalityOffer, before);
  const composition = frozenAcquisition
    ? Object.freeze({ applies: false, legal: true, findings: Object.freeze([]) })
    : (() => {
        if (offer.kind === 'chaos') {
          const requirements = [
            ...(catalog.chaos.curses.byKey[offer.curseKey]?.offerRequirements ?? []),
            ...(catalog.chaos.blessings.byKey[offer.blessingKey]?.offerRequirements ?? []),
          ];
          const unavailable = requirements.some((requirement) => {
            switch (requirement.kind) {
              case 'matureChaosBlessing':
                return before.maturedChaosBlessings.length === 0;
              case 'elementMinimum':
                return before.elementCounts[requirement.element] < requirement.minimum;
              case 'notKeepsake':
                return context.currentKeepsakeKey === requirement.keepsakeKey;
              case 'notAspect':
                return context.aspectKey === requirement.aspectKey;
              case 'routeKey':
                return !('routeKey' in address) || address.routeKey !== requirement.routeKey;
            }
          });
          return unavailable
            ? Object.freeze({
                applies: true,
                legal: false,
                findings: Object.freeze([Object.freeze({ code: 'chaosPairUnavailable' as const })]),
              })
            : baseComposition;
        }
        if (offer.kind !== 'traits') return baseComposition;
        const provider = catalog.traitGivers.byKey[offer.giverKey]?.providerKind;
        if (provider !== 'olympian' && provider !== 'hermes') return baseComposition;
        const chaosFindings: TraitOfferCompositionFinding[] = [];
        if (
          hasActiveChaosSemanticTag(before, 'Ordinary') &&
          offer.options.some((option) => option.rarity !== 'Common')
        )
          chaosFindings.push(Object.freeze({ code: 'chaosOrdinaryRequiresCommon' }));
        if (hasActiveChaosSemanticTag(before, 'Rejected')) {
          const blocked = offer.rejectedOptionKey;
          if (blocked === undefined)
            chaosFindings.push(Object.freeze({ code: 'chaosRejectedBlockMissing' }));
          else if (
            blocked === offer.selectedOptionKey ||
            offer.options[optionIndex(blocked)] === undefined
          )
            chaosFindings.push(
              Object.freeze({ code: 'chaosRejectedBlockUnavailable', optionKey: blocked }),
            );
        } else if (offer.rejectedOptionKey !== undefined) {
          chaosFindings.push(
            Object.freeze({
              code: 'chaosRejectedBlockUnavailable',
              optionKey: offer.rejectedOptionKey,
            }),
          );
        }
        return chaosFindings.length === 0
          ? baseComposition
          : Object.freeze({
              ...baseComposition,
              legal: false,
              findings: Object.freeze([...baseComposition.findings, ...chaosFindings]),
            });
      })();
  const replacementComposition = directAcquisition
    ? Object.freeze({
        applies: false,
        legal: true,
        ordinaryCandidateCount: 0,
        maximumReplacementCount: 0,
        replacementCount: 0,
        findings: Object.freeze([]),
      })
    : assessTraitReplacementComposition(catalog, legalityOffer, before, effectiveContext);
  const targetedAcquisition = frozenAcquisition
    ? Object.freeze({ applies: false, legal: true, findings: Object.freeze([]) })
    : assessSelectedTargetedAcquisition(catalog, legalityOffer, before);
  const runtimeOfferFallbackTraitKey = frozenAcquisition
    ? undefined
    : resolveRuntimeOfferFallbackTraitKey(
        catalog,
        offer,
        before,
        effectiveContext,
        runtimeOfferFallbackExcludedTraitKeys,
      );
  const rawAssessments = frozenAcquisition
    ? Object.freeze([])
    : (assessments ?? assessTraitOffer(catalog, legalityOffer, before, effectiveContext));
  const levelResolutions =
    frozenLevelResolutions ??
    (offer.kind !== 'traits'
      ? Object.freeze([])
      : Object.freeze(
          offer.options.map((option, index) =>
            resolveTraitOfferOptionLevel({
              catalog,
              before,
              context: effectiveContext,
              ...(keepsakes === undefined ? {} : { keepsakes }),
              option,
              ...(rawAssessments[index] === undefined ? {} : { assessment: rawAssessments[index] }),
            }),
          ),
        ));
  const resolvedAssessments = frozenAcquisition
    ? Object.freeze([])
    : Object.freeze(
        rawAssessments.map((assessment, index) => {
          const resolution = levelResolutions[index];
          return resolution === undefined || resolution.findings.length === 0
            ? assessment
            : Object.freeze({
                ...assessment,
                legal: false,
                findings: Object.freeze([...assessment.findings, ...resolution.findings]),
              });
        }),
      );
  return Object.freeze({
    address,
    acquisitionRole,
    before,
    offer,
    context: effectiveContext,
    ...(arcanaFear === undefined ? {} : { arcanaFear }),
    ...(keepsakes === undefined ? {} : { keepsakes }),
    assessments: resolvedAssessments,
    levelResolutions,
    composition,
    replacementComposition,
    targetedAcquisition,
    reached: true,
    chronologicalIndex,
    ...(runtimeOfferFallbackTraitKey === undefined ? {} : { runtimeOfferFallbackTraitKey }),
  });
}

export function evaluateReachedTraitOffer(
  catalog: Catalog,
  address: SemanticAddress,
  acquisitionRole: string,
  offer: AuthoredTraitOffer,
  before: TraitHistoryState,
  context: TraitOfferContext,
  chronologicalIndex: number,
  arcanaFear?: ArcanaFearState,
  directAcquisition = false,
  keepsakes?: KeepsakeState,
  /** Calling Card changes a rolled row after base-offer legality is established. */
  rarificationBaseOffer?: AuthoredTraitOffer,
  runtimeOfferFallbackExcludedTraitKeys?: readonly string[],
  frozenAcquisition = false,
  frozenLevelResolutions?: readonly TraitOfferOptionLevelResolution[],
): ReachedTraitOfferEvaluation {
  return evaluateReachedTraitOfferWithAssessments(
    catalog,
    address,
    acquisitionRole,
    offer,
    before,
    context,
    chronologicalIndex,
    arcanaFear,
    directAcquisition,
    keepsakes,
    rarificationBaseOffer,
    undefined,
    runtimeOfferFallbackExcludedTraitKeys,
    frozenAcquisition,
    frozenLevelResolutions,
  );
}

/** Settle one engine-derived BBB replay through the canonical trait-offer fold. */
export function evaluateReachedEchoLastRunBoonOffer(
  catalog: Catalog,
  address: EchoLastRunBoonAddress,
  offer: AuthoredTraitOfferTraits,
  outcome: EchoLastRunBoonOutcome,
  before: TraitHistoryState,
  context: TraitOfferContext,
  chronologicalIndex: number,
  arcanaFear?: ArcanaFearState,
  keepsakes?: KeepsakeState,
  runtimeOfferFallbackExcludedTraitKeys: readonly string[] = [],
): ReachedTraitOfferEvaluation {
  const option = offer.options[0];
  if (
    offer.options.length !== 1 ||
    offer.selectedOptionKey !== 'option1' ||
    option === undefined ||
    offer.giverKey !== outcome.option.giverKey ||
    option.traitKey !== outcome.option.traitKey ||
    option.rarity !== outcome.effectiveRarity
  )
    throw new Error('BBB settlement requires its exact engine-derived one-option outcome');
  return evaluateReachedTraitOfferWithAssessments(
    catalog,
    address,
    'echoLastRunSelection',
    offer,
    before,
    context,
    chronologicalIndex,
    arcanaFear,
    true,
    keepsakes,
    undefined,
    Object.freeze([outcome.assessment]),
    runtimeOfferFallbackExcludedTraitKeys,
  );
}

/**
 * Assess the source-owned guarantee attached to the first reached Olympian
 * offer.  The offer is evaluated as one complete three-option surface: no
 * option is treated as an equipped prerequisite for another option.
 */
export function assessTraitOfferComposition(
  catalog: Catalog,
  offer: AuthoredTraitOffer,
  before: TraitHistoryState,
): TraitOfferCompositionAssessment {
  if (offer.kind !== 'traits')
    return Object.freeze({ applies: false, legal: true, findings: Object.freeze([]) });
  const selected = offer.options[optionIndex(offer.selectedOptionKey)];
  const selectionFindings: TraitOfferCompositionFinding[] =
    selected === undefined ? [Object.freeze({ code: 'traitOfferSelectionUnavailable' })] : [];
  const giver = catalog.traitGivers.byKey[offer.giverKey];
  const applies =
    giver?.providerKind === 'olympian' && Object.keys(ordinaryEquippedSlots(before)).length === 0;
  if (!applies || giver === undefined) {
    return Object.freeze({
      applies: false,
      legal: selectionFindings.length === 0,
      findings: Object.freeze(selectionFindings),
    });
  }
  const priority = new Set(giver.priorityTraitKeys);
  const findings: TraitOfferCompositionFinding[] = [...selectionFindings];
  offer.options.forEach((option, index) => {
    if (!priority.has(option.traitKey)) {
      findings.push(
        Object.freeze({
          code: 'nonPriorityTrait',
          traitKey: option.traitKey,
          optionKey: index === 0 ? 'option1' : index === 1 ? 'option2' : 'option3',
        }),
      );
    }
  });
  const hasAttackOrSpecial = offer.options.some((option) => {
    const slot = catalog.traits.byKey[option.traitKey]?.equipmentSlot;
    return slot === 'Melee' || slot === 'Secondary';
  });
  if (!hasAttackOrSpecial) findings.push(Object.freeze({ code: 'missingAttackOrSpecial' }));
  return Object.freeze({
    applies: true,
    legal: findings.length === 0,
    findings: Object.freeze(findings),
  });
}

/**
 * Replacement is an offer-level shortage rule. It is evaluated from the
 * exact pre-offer ledger and never from an option selected earlier in the
 * same offer.
 */
export function assessTraitReplacementComposition(
  catalog: Catalog,
  offer: AuthoredTraitOffer,
  before: TraitHistoryState,
  context: TraitOfferContext = {},
): TraitReplacementCompositionAssessment {
  const giver = catalog.traitGivers.byKey[offer.giverKey];
  const applies = giver?.providerKind === 'olympian' || giver?.providerKind === 'hermes';
  const domains = applies
    ? traitOfferCompositionDomains(catalog, offer.giverKey, before, context)
    : undefined;
  if (offer.kind === 'fallbackGold') {
    const result = assessTraitOfferDomainComposition({
      ordinaryKeys: Object.freeze(domains?.ordinary.map((candidate) => candidate.traitKey) ?? []),
      highTierKeys: Object.freeze(domains?.highTier.map((candidate) => candidate.traitKey) ?? []),
      replacementKeys: Object.freeze(
        domains?.replacements.map((candidate) => candidate.traitKey) ?? [],
      ),
      authored: Object.freeze([]),
      fallbackGold: true,
      minimumReplacementCount: 0,
    });
    return Object.freeze({
      applies,
      ...result,
      legal: applies && result.legal,
    });
  }
  if (offer.kind !== 'traits')
    return Object.freeze({
      applies: false,
      legal: true,
      ordinaryCandidateCount: 0,
      maximumReplacementCount: 0,
      replacementCount: 0,
      findings: Object.freeze([]),
    });
  if (!applies || giver === undefined) {
    const sparse = offer.kind === 'traits' && offer.options.length !== 3;
    return Object.freeze({
      applies: false,
      legal: !sparse,
      ordinaryCandidateCount: 0,
      maximumReplacementCount: 0,
      replacementCount: 0,
      findings: sparse
        ? Object.freeze([Object.freeze({ code: 'unsupportedSparseTraitOffer' as const })])
        : Object.freeze([]),
    });
  }

  const ordinaryKeys = new Set(domains!.ordinary.map((candidate) => candidate.traitKey));
  const highTierKeys = new Set(domains!.highTier.map((candidate) => candidate.traitKey));
  const replacementKeys = new Set(domains!.replacements.map((candidate) => candidate.traitKey));
  const authored = offer.options.map((option) => {
    const assessment = assessTraitOption(
      catalog,
      option.traitKey,
      before,
      { ...context, resolvedProviderKey: offer.giverKey },
      option.rarity,
    );
    const kind: TraitOfferDomainOptionKind =
      assessment.replacementTransition !== undefined
        ? 'replacement'
        : highTierKeys.has(option.traitKey)
          ? 'highTier'
          : 'ordinary';
    return Object.freeze({ traitKey: option.traitKey, kind });
  });
  const result = assessTraitOfferDomainComposition({
    ordinaryKeys: Object.freeze([...ordinaryKeys]),
    highTierKeys: Object.freeze([...highTierKeys]),
    replacementKeys: Object.freeze([...replacementKeys]),
    authored: Object.freeze(authored),
    fallbackGold: false,
    minimumReplacementCount: (context.limitedSwapUses ?? 0) > 0 && replacementKeys.size > 0 ? 1 : 0,
  });
  return Object.freeze({
    applies: true,
    ...result,
  });
}

/**
 * Denial is a post-selection history effect.  It deliberately consumes the
 * already-materialized offer rather than participating in offer composition.
 */
function denialBannedTraitKeys(
  catalog: Catalog,
  evaluation: ReachedTraitOfferEvaluation,
): readonly string[] | undefined {
  if (evaluation.offer.kind !== 'traits') return undefined;
  const offer = evaluation.offer;
  const denial = catalog.fearVows.byKey.BanUnpickedBoonsShrineUpgrade;
  const effective = evaluation.arcanaFear?.fear.effectiveRanks[denial?.key ?? ''] ?? 0;
  const giver = catalog.traitGivers.byKey[evaluation.offer.giverKey];
  if (
    denial?.effect?.kind !== 'banUnselectedTraits' ||
    effective <= 0 ||
    !giver?.denialParticipates
  )
    return undefined;
  return Object.freeze(
    offer.options
      .filter((_, index) => index !== optionIndex(offer.selectedOptionKey))
      .slice(0, denial.effect.count)
      .map((option) => option.traitKey),
  );
}

export function recordReachedTraitOffer(
  catalog: Catalog,
  evaluation: ReachedTraitOfferEvaluation,
  sequence: number,
  acquisitionPoint: string,
  acquisitionIdentity?: string,
  echoRepeatedKeepsakeKey?: string,
  eventKind: 'traitOffer' | 'concaveStoneSecondary' = 'traitOffer',
): {
  readonly history: TraitHistoryState;
  readonly event?: TraitOfferEvent | import('./trait-history').ConcaveStoneSecondaryEvent;
  readonly ransomAssessment?: RansomAssessment;
} {
  if (evaluation.offer.kind === 'chaos') {
    if (!evaluation.composition.legal) return Object.freeze({ history: evaluation.before });
    const identity = acquisitionIdentity ?? `chaos:${sequence}`;
    const event: ChaosPairEvent = Object.freeze({
      kind: 'chaosPair',
      owner: evaluation.address,
      acquisitionRole: evaluation.acquisitionRole,
      sequence,
      acquisitionPoint,
      acquisitionIdentity: identity,
      offer: evaluation.offer,
    });
    return Object.freeze({
      history: foldTraitHistoryEvents(catalog, [...evaluation.before.events, event]),
    });
  }
  const valid =
    evaluation.composition.legal &&
    evaluation.replacementComposition.legal &&
    evaluation.assessments.every((assessment) => assessment.legal);
  if (!valid) return Object.freeze({ history: evaluation.before });
  if (evaluation.offer.kind !== 'traits') return Object.freeze({ history: evaluation.before });
  const selectedOption = evaluation.offer.options[optionIndex(evaluation.offer.selectedOptionKey)];
  if (selectedOption === undefined) return Object.freeze({ history: evaluation.before });
  const selectedTraitKey = selectedOption.traitKey;
  // Every reached offer is assessed and retained in the evaluation trace.
  // A selected pickup-producing trait is an ordinary equipped trait; its
  // generated pickups are a later acquisition-site effect.
  const selectedDisposition = catalog.traits.byKey[selectedTraitKey]?.selectedDisposition;
  if (
    selectedDisposition?.kind !== 'equip' &&
    selectedDisposition?.kind !== 'directTraitSets' &&
    selectedDisposition?.kind !== 'circe' &&
    selectedDisposition?.kind !== 'echo' &&
    selectedDisposition?.kind !== 'advanceCurrentKeepsake' &&
    selectedDisposition?.kind !== 'worldShopRestock' &&
    selectedDisposition?.kind !== 'naturalSelection' &&
    selectedDisposition?.kind !== 'ransom' &&
    selectedDisposition?.kind !== 'steadyGrowth' &&
    selectedDisposition?.kind !== 'producePickups' &&
    selectedDisposition?.kind !== 'seaStar'
  ) {
    return Object.freeze({ history: evaluation.before });
  }
  const selectedAssessment =
    evaluation.assessments[optionIndex(evaluation.offer.selectedOptionKey)];
  const selectedLevel =
    evaluation.levelResolutions[optionIndex(evaluation.offer.selectedOptionKey)]?.effectiveLevel;
  // Stone's frozen pickup is not another screen, so it must not settle a
  // second post-screen Denial partition.
  const bannedTraitKeys =
    eventKind === 'concaveStoneSecondary' ? undefined : denialBannedTraitKeys(catalog, evaluation);
  const event = Object.freeze({
    kind: eventKind,
    owner: evaluation.address,
    acquisitionRole: evaluation.acquisitionRole,
    sequence,
    giverKey: evaluation.offer.giverKey,
    options: evaluation.offer.options,
    selectedOptionKey: evaluation.offer.selectedOptionKey,
    acquisitionPoint,
    ...(eventKind === 'traitOffer' && acquisitionIdentity !== undefined
      ? { acquisitionIdentity }
      : {}),
    ...(eventKind === 'traitOffer' && echoRepeatedKeepsakeKey !== undefined
      ? { echoRepeatedKeepsakeKey }
      : {}),
    ...(bannedTraitKeys === undefined ? {} : { bannedTraitKeys }),
    ...(selectedAssessment?.replacementTransition === undefined
      ? {}
      : { replacementTransition: selectedAssessment.replacementTransition }),
    ...(evaluation.targetedAcquisition.transition === undefined
      ? {}
      : { targetedAcquisitionTransition: evaluation.targetedAcquisition.transition }),
    ...(selectedLevel === undefined ? {} : { selectedEffectiveLevel: selectedLevel }),
  }) as TraitOfferEvent | import('./trait-history').ConcaveStoneSecondaryEvent;
  const transition = evaluation.targetedAcquisition.transition;
  const mutation: TraitLevelMutationEvent | undefined =
    transition?.kind === 'promoteGodTraitToHeroic'
      ? Object.freeze({
          kind: 'levelMutation',
          owner: evaluation.address,
          acquisitionRole: evaluation.acquisitionRole,
          sequence,
          acquisitionPoint,
          sourceTraitKey: transition.sourceTraitKey,
          targetTraitKey: transition.targetTraitKey,
          oldLevel: transition.oldLevel,
          newLevel: transition.newLevel,
        })
      : undefined;
  const immediate: TraitHistoryEvent[] = [event, ...(mutation === undefined ? [] : [mutation])];
  if (selectedDisposition?.kind === 'naturalSelection') {
    const targets = selectedOption.naturalSelectionTargets;
    const assessment = assessNaturalSelectionTargets(
      catalog,
      evaluation.before,
      selectedDisposition.levelCount,
      selectedDisposition.slots,
      targets,
    );
    if (!assessment.legal || !assessment.complete)
      return Object.freeze({ history: evaluation.before, event });
    for (const { targetTraitKey, oldLevel, newLevel } of assessment.steps) {
      immediate.push(
        Object.freeze({
          kind: 'levelMutation',
          owner: evaluation.address,
          acquisitionRole: evaluation.acquisitionRole,
          sequence,
          acquisitionPoint,
          sourceTraitKey: selectedTraitKey,
          targetTraitKey,
          oldLevel,
          newLevel,
        }),
      );
    }
  }
  const ransomAssessment =
    selectedDisposition?.kind !== 'ransom'
      ? undefined
      : assessRansom(
          catalog,
          foldTraitHistoryEvents(catalog, [...evaluation.before.events, ...immediate]),
          selectedTraitKey,
          evaluation.address,
          evaluation.acquisitionRole,
          sequence,
          acquisitionPoint,
        );
  if (ransomAssessment !== undefined) {
    immediate.push(...ransomAssessment.events);
  }
  const history = foldTraitHistoryEvents(catalog, [...evaluation.before.events, ...immediate]);
  return Object.freeze({
    history,
    event,
    ...(ransomAssessment === undefined ? {} : { ransomAssessment }),
  });
}

/** Appends fixed direct grants without ordinary offer, rarity, Calling Card,
 * Denial, provider-history, or prerequisite processing. */
export function recordDirectTraitGrants(
  catalog: Catalog,
  before: TraitHistoryState,
  sequence: number,
  acquisitionPoint: string,
  sourceTraitKey: string,
  grants: readonly { readonly owner: SemanticAddress; readonly traitKey: string }[],
): TraitHistoryState {
  const events = grants.map(({ owner, traitKey }): DirectTraitGrantEvent => {
    const providers = catalog.traitGivers.values.filter((giver) =>
      giver.traitKeys.includes(traitKey),
    );
    if (providers.length !== 1)
      throw new Error(`direct trait ${traitKey} must resolve to exactly one provider`);
    return Object.freeze({
      kind: 'directTraitGrant',
      owner,
      acquisitionRole: 'directTraitGrant',
      sequence,
      acquisitionPoint,
      sourceTraitKey,
      traitKey,
      giverKey: providers[0]!.key,
    });
  });
  return foldTraitHistoryEvents(catalog, [...before.events, ...events]);
}

/** Folds the one catalog-linked Aspect starting trait before any room checkpoint. */
export function recordAspectStartingTrait(
  catalog: Catalog,
  before: TraitHistoryState,
  owner: SemanticAddress,
  loadout: { readonly aspectKey: string },
): TraitHistoryState {
  const aspect = catalog.aspects.byKey[loadout.aspectKey];
  const starting = aspect?.startingTrait;
  if (starting === undefined) return before;
  return foldTraitHistoryEvents(catalog, [
    ...before.events,
    Object.freeze({
      kind: 'directTraitGrant' as const,
      owner,
      acquisitionRole: 'directTraitGrant' as const,
      sequence: 0,
      acquisitionPoint: 'routeStart',
      sourceTraitKey: aspect!.key,
      traitKey: starting.traitKey,
      giverKey: starting.giverKey,
    }),
  ]);
}

/** Whether a concrete SpellDrop is routed to the Aspect-owned talent frontier. */
export function isAspectSpellDropDormant(catalog: Catalog, aspectKey: string | undefined): boolean {
  return (
    aspectKey !== undefined &&
    catalog.aspects.byKey[aspectKey]?.startingTrait?.giverKey === 'SpellDrop'
  );
}

/** Appends one fixed rarityless trait installed by a concrete non-offer acquisition. */
export function recordFixedAcquisitionTraitGrant(
  catalog: Catalog,
  before: TraitHistoryState,
  owner: SemanticAddress,
  sequence: number,
  acquisitionPoint: string,
  traitKey: string,
): TraitHistoryState {
  const declaration = catalog.traits.byKey[traitKey];
  if (declaration?.rarityDomain.kind !== 'none')
    throw new Error(`fixed acquisition trait ${traitKey} must be declared rarityless`);
  return foldTraitHistoryEvents(catalog, [
    ...before.events,
    Object.freeze({
      kind: 'directTraitGrant' as const,
      owner,
      acquisitionRole: 'directTraitGrant' as const,
      sequence,
      acquisitionPoint,
      sourceTraitKey: traitKey,
      traitKey,
    }),
  ]);
}

/** Exact ownership-only result domain for one source-declared direct pair. */
import type { Catalog, TraitRarity } from '../catalog-schema';
import type { EchoLastRunBoonAddress } from '../authored-project/addresses';
import type { SemanticAddress, TraitOfferAddress } from '../authored-project/addresses';
import type {
  AuthoredTraitOffer,
  AuthoredTraitOfferTraits,
  TraitOptionKey,
} from '../authored-project/traits';
import type { RewardHistoryState } from '../reward-kernel/model';
import type { ArcanaFearState } from './arcana-fear';
import type { KeepsakeState } from './keepsakes';
import type { TraitFindingCode } from './model';
import { type BoonRarityFacts } from './boon-rarity';
export type { TraitFindingCode } from './model';
import { optionIndex } from '../authored-project/traits';
import { targetedAcquisitionTargetKeys } from './trait-level-effects';
import { assessRansom, ordinaryEquippedSlots, foldTraitHistoryEvents } from './trait-history';
import {
  resolveTraitOfferOptionLevel,
  type TraitOfferOptionLevelResolution,
} from './trait-offer-levels';
import {
  assessNaturalSelectionTargets,
  assessSelectedTargetedAcquisition,
  assessTraitOffer,
  assessTraitOption,
  traitOfferCompositionDomains,
} from './trait-authoring-policies';
import type {
  TraitReplacementTransition,
  TraitTargetedAcquisitionAssessment,
  TraitHistoryState,
  TraitOfferEvent,
  ChaosPairEvent,
  TraitLevelMutationEvent,
  TraitHistoryEvent,
  DirectTraitGrantEvent,
  RansomAssessment,
} from './trait-history';
import type { TraitCandidateAssessment } from './trait-authoring-policies';
