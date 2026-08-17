import type {
  Catalog,
  TraitDeclaration,
  TraitElement,
  TraitRarity,
  TraitRequirementExpression,
} from '../catalog-schema';
import type { EchoKeepsakeReplayAddress } from '../authored-project/addresses';
import type {
  LevelResolutionAddress,
  SemanticAddress,
  TraitOfferAddress,
} from '../authored-project/addresses';
import type {
  AuthoredLevelResolution,
  AuthoredTraitOffer,
  AuthoredTraitOfferTraits,
  AuthoredTraitOption,
  EquippedTrait,
  TraitOptionKey,
} from '../authored-project/traits';
import type { RewardHistoryState } from '../reward-kernel/model';
import type { ArcanaFearState } from './arcana-fear';
import type { KeepsakeState } from './keepsakes';
import type { TraitFindingCode } from './model';
export type { TraitFindingCode } from './model';
import {
  optionIndex,
  traitOfferSupportsExhaustion,
  withDefaultTraitOptionDetail,
} from '../authored-project/traits';

export interface TraitOfferEvent {
  readonly kind: 'traitOffer';
  readonly owner: SemanticAddress;
  readonly acquisitionRole: string;
  readonly sequence: number;
  readonly giverKey: string;
  readonly options: AuthoredTraitOfferTraits['options'];
  readonly selectedOptionKey: TraitOptionKey;
  readonly acquisitionPoint: string;
  readonly acquisitionIdentity?: string;
  readonly echoRepeatedKeepsakeKey?: string;
  /** Exact unselected materialized keys banned by an effective Vow of Denial. */
  readonly bannedTraitKeys?: readonly string[];
  /** Derived from the pre-offer state; never persisted in authored state. */
  readonly replacementTransition?: TraitReplacementTransition;
  /** Exact declaration-owned acquisition mutation derived from pre-offer state. */
  readonly targetedAcquisitionTransition?: TraitTargetedAcquisitionTransition;
}

/** A closed derived mutation of an already-equipped Pom-eligible trait. */
export interface TraitLevelMutationEvent {
  readonly kind: 'levelMutation';
  readonly owner: SemanticAddress;
  readonly acquisitionRole: string;
  readonly sequence: number;
  readonly acquisitionPoint: string;
  readonly sourceTraitKey?: string;
  readonly targetTraitKey: string;
  readonly oldLevel: number;
  readonly newLevel: number;
  readonly giverKey?: never;
  readonly options?: never;
  readonly selectedOptionKey?: never;
  readonly replacementTransition?: never;
  readonly targetedAcquisitionTransition?: never;
}

/** Concrete non-trait acquisition contribution, retained in the same ordered
 * trait facts ledger so later offer requirements see it. */
export interface TraitElementContributionEvent {
  readonly kind: 'elementContribution';
  readonly owner: SemanticAddress;
  readonly acquisitionRole: string;
  readonly sequence: number;
  readonly acquisitionPoint: string;
  readonly contributions: Readonly<Partial<Record<TraitElement, number>>>;
}

/** One fixed rarityless trait installed directly by another acquired trait. */
export interface DirectTraitGrantEvent {
  readonly kind: 'directTraitGrant';
  readonly owner: SemanticAddress;
  readonly acquisitionRole: 'directTraitGrant';
  readonly sequence: number;
  readonly acquisitionPoint: string;
  readonly sourceTraitKey: string;
  readonly traitKey: string;
  /** Absent only for a fixed non-offer acquisition such as Infernal Contract. */
  readonly giverKey?: string;
}
/** A closed lifecycle removal (currently Jeweled Pom's Fated cleanup). */
export interface TraitRemovalEvent {
  readonly kind: 'traitRemoval';
  readonly owner: SemanticAddress;
  readonly acquisitionRole: string;
  readonly sequence: number;
  readonly acquisitionPoint: string;
  readonly traitKey: string;
  readonly acquisitionIdentity: string;
}

/** One declaration-owned Gift Gift Gift attempt at a succeeding biome start. */
export interface EchoKeepsakeReplayEvent {
  readonly kind: 'echoKeepsakeReplay';
  readonly owner: EchoKeepsakeReplayAddress;
  readonly acquisitionRole: 'echoKeepsakeReplay';
  readonly sequence: number;
  readonly acquisitionPoint: 'biomeStart';
  readonly traitKey: 'EchoRepeatKeepsakeBoon';
  readonly acquisitionIdentity: string;
  readonly capturedKeepsakeKey: string;
}

export type TraitHistoryEvent =
  | TraitOfferEvent
  | TraitLevelMutationEvent
  | TraitElementContributionEvent
  | DirectTraitGrantEvent
  | TraitRemovalEvent
  | EchoKeepsakeReplayEvent;

export interface TraitReplacementTransition {
  readonly slot: string;
  readonly replacedTraitKey: string;
  readonly oldRarity: TraitRarity;
  readonly newTraitKey: string;
  readonly requiredRarity: TraitRarity;
}

interface TraitTargetedAcquisitionTransitionBase {
  readonly sourceTraitKey: string;
  readonly targetTraitKey: string;
}

export type TraitTargetedAcquisitionTransition =
  | (TraitTargetedAcquisitionTransitionBase & {
      readonly kind: 'promoteGodTraitToHeroic';
      readonly oldRarity: TraitRarity;
      readonly newRarity: 'Heroic';
      readonly oldLevel: number;
      readonly newLevel: number;
    })
  | (TraitTargetedAcquisitionTransitionBase & {
      readonly kind: 'upgradeHammerToRank2';
      readonly oldHammerRank: 'RankI';
      readonly newHammerRank: 'RankII';
    });

export interface TraitTargetedAcquisitionAssessment {
  readonly applies: boolean;
  readonly legal: boolean;
  readonly sourceTraitKey?: string;
  readonly targetTraitKey?: string;
  readonly findings: readonly TraitAssessmentFinding[];
  readonly transition?: TraitTargetedAcquisitionTransition;
}

export interface TraitHistoryState {
  readonly events: readonly TraitHistoryEvent[];
  readonly equippedTraits: Readonly<Record<string, EquippedTrait>>;
  readonly ordinaryBoonSlots: Readonly<Record<string, EquippedTrait>>;
  readonly elementCounts: Readonly<Record<TraitElement, number>>;
  readonly highestBaseElementCount: number;
  readonly godBoonRarityCounts: Readonly<Record<string, number>>;
  readonly upgradableTraitCount: number;
  /** Route-wide exact trait keys excluded from later offer eligibility. */
  readonly bannedTraitKeys: readonly string[];
  /** Derived floor for fresh scalable god-trait offers. */
  readonly minimumScalableGodTraitRarity?: 'Rare';
}

/** The sole supported Pom target predicate. */
export function isPomEligibleTrait(catalog: Catalog, traitKey: string): boolean {
  const declaration = catalog.traits.byKey[traitKey];
  return declaration?.isCoreGodTrait === true && !declaration.blockStacking;
}

const emptyElements = Object.freeze({ Aether: 0, Earth: 0, Air: 0, Fire: 0, Water: 0 });
const BASE_ELEMENTS: readonly TraitElement[] = Object.freeze(['Earth', 'Air', 'Fire', 'Water']);

function combinedElementFacts(
  fromTraits: ReturnType<typeof deriveFacts>,
  pickupElements: Readonly<Record<TraitElement, number>>,
) {
  const elementCounts = Object.freeze({
    Aether: fromTraits.elementCounts.Aether + pickupElements.Aether,
    Earth: fromTraits.elementCounts.Earth + pickupElements.Earth,
    Air: fromTraits.elementCounts.Air + pickupElements.Air,
    Fire: fromTraits.elementCounts.Fire + pickupElements.Fire,
    Water: fromTraits.elementCounts.Water + pickupElements.Water,
  });
  return Object.freeze({
    ...fromTraits,
    elementCounts,
    highestBaseElementCount: Math.max(...BASE_ELEMENTS.map((element) => elementCounts[element])),
  });
}

export function createTraitHistoryState(): TraitHistoryState {
  return Object.freeze({
    events: Object.freeze([]),
    equippedTraits: Object.freeze({}),
    ordinaryBoonSlots: Object.freeze({}),
    elementCounts: emptyElements,
    highestBaseElementCount: 0,
    godBoonRarityCounts: Object.freeze({}),
    upgradableTraitCount: 0,
    bannedTraitKeys: Object.freeze([]),
  });
}

function deriveFacts(catalog: Catalog, equippedTraits: Readonly<Record<string, EquippedTrait>>) {
  const elements: Record<TraitElement, number> = { Aether: 0, Earth: 0, Air: 0, Fire: 0, Water: 0 };
  const slots: Record<string, EquippedTrait> = {};
  const rarityCounts: Record<string, number> = {};
  let upgradable = 0;
  for (const equipped of Object.values(equippedTraits)) {
    const declaration = catalog.traits.byKey[equipped.traitKey];
    if (declaration === undefined) continue;
    for (const [element, amount] of Object.entries(declaration.elementContributions)) {
      if (amount !== undefined) elements[element as TraitElement] += amount;
    }
    if (declaration.ordinaryBoonSlot !== undefined) slots[declaration.ordinaryBoonSlot] = equipped;
    if (
      declaration.usesBoonRarity &&
      equipped.rarity !== undefined &&
      !declaration.excludeFromRarityCount
    ) {
      rarityCounts[equipped.rarity] = (rarityCounts[equipped.rarity] ?? 0) + 1;
    }
    if (isPomEligibleTrait(catalog, equipped.traitKey)) upgradable += 1;
  }
  const highestBaseElementCount = Math.max(
    elements.Earth,
    elements.Air,
    elements.Fire,
    elements.Water,
  );
  return Object.freeze({
    ordinaryBoonSlots: Object.freeze(slots),
    elementCounts: Object.freeze(elements),
    highestBaseElementCount,
    godBoonRarityCounts: Object.freeze(rarityCounts),
    upgradableTraitCount: upgradable,
  });
}

function activeRarityFloorSources(
  catalog: Catalog,
  equippedTraits: Readonly<Record<string, EquippedTrait>>,
  elementCounts: Readonly<Record<TraitElement, number>>,
): ReadonlySet<string> {
  const active = new Set<string>();
  for (const equipped of Object.values(equippedTraits)) {
    const declaration = catalog.traits.byKey[equipped.traitKey];
    const effect = declaration?.rarityFloorEffect;
    if (effect === undefined) continue;
    const activeForLedger = Object.entries(effect.activationElementMinimums).every(
      ([element, minimum]) => (elementCounts[element as TraitElement] ?? 0) >= minimum,
    );
    if (activeForLedger) active.add(equipped.traitKey);
  }
  return active;
}

function promoteActiveFloorTargets(
  catalog: Catalog,
  equippedTraits: Record<string, EquippedTrait>,
  activeSources: ReadonlySet<string>,
  events: readonly TraitOfferEvent[],
): void {
  if (activeSources.size === 0) return;
  const effects = [...activeSources].flatMap((sourceKey) => {
    const declaration = catalog.traits.byKey[sourceKey];
    return declaration?.rarityFloorEffect === undefined
      ? []
      : [{ sourceKey, effect: declaration.rarityFloorEffect }];
  });
  if (effects.length === 0) return;
  const promotedKeys: string[] = [];
  for (const [traitKey, equipped] of Object.entries(equippedTraits)) {
    const declaration = catalog.traits.byKey[traitKey];
    if (
      declaration === undefined ||
      !declaration.usesBoonRarity ||
      declaration.blockInRunRarify ||
      activeSources.has(traitKey) ||
      declaration.rarityDomain.kind !== 'ranked' ||
      !declaration.rarityDomain.equippedRarities.includes('Rare') ||
      equipped.rarity !== 'Common' ||
      effects.every(
        ({ effect }) => effect.fromRarity !== 'Common' || effect.minimumRarity !== 'Rare',
      )
    )
      continue;
    equippedTraits[traitKey] = Object.freeze({ ...equipped, rarity: 'Rare' });
    promotedKeys.push(traitKey);
  }
  for (const event of events) {
    const transition = event.targetedAcquisitionTransition;
    if (
      transition?.kind !== 'promoteGodTraitToHeroic' ||
      !promotedKeys.includes(transition.sourceTraitKey)
    )
      continue;
    const target = equippedTraits[transition.targetTraitKey];
    if (target?.level === undefined) continue;
    equippedTraits[transition.targetTraitKey] = Object.freeze({
      ...target,
      level: target.level + 1,
    });
  }
}

export function foldTraitHistoryEvents(
  catalog: Catalog,
  events: readonly TraitHistoryEvent[],
): TraitHistoryState {
  const equipped: Record<string, EquippedTrait> = {};
  const bannedTraitKeys = new Set<string>();
  const pickupElements: Record<TraitElement, number> = {
    Aether: 0,
    Earth: 0,
    Air: 0,
    Fire: 0,
    Water: 0,
  };
  let activeSources: ReadonlySet<string> = new Set();
  // Stable ordering retains the producer/purchase chronology already encoded
  // by construction. A targeted acquisition appends its mutation immediately
  // after its own offer, so no global same-sequence reordering is required.
  const ordered = [...events].sort((left, right) => left.sequence - right.sequence);
  for (let index = 0; index < ordered.length;) {
    const sequence = ordered[index]!.sequence;
    const group: TraitHistoryEvent[] = [];
    while (ordered[index]?.sequence === sequence) group.push(ordered[index++]!);
    for (const event of group) {
      if (event.kind === 'levelMutation') {
        const target = equipped[event.targetTraitKey];
        if (
          target !== undefined &&
          target.level === event.oldLevel &&
          event.newLevel > event.oldLevel &&
          isPomEligibleTrait(catalog, event.targetTraitKey)
        ) {
          equipped[event.targetTraitKey] = Object.freeze({ ...target, level: event.newLevel });
        }
        continue;
      }
      if (event.kind === 'elementContribution') {
        for (const [element, value] of Object.entries(event.contributions)) {
          pickupElements[element as TraitElement] += value ?? 0;
        }
        continue;
      }
      if (event.kind === 'traitRemoval') {
        if (equipped[event.traitKey]?.acquisitionIdentity === event.acquisitionIdentity)
          delete equipped[event.traitKey];
        continue;
      }
      if (event.kind === 'echoKeepsakeReplay') {
        const gift = equipped[event.traitKey];
        if (
          gift?.acquisitionIdentity === event.acquisitionIdentity &&
          gift.echoRepeatedKeepsakeKey === event.capturedKeepsakeKey
        )
          equipped[event.traitKey] = Object.freeze({
            ...gift,
            echoKeepsakeReplayCount: (gift.echoKeepsakeReplayCount ?? 0) + 1,
          });
        continue;
      }
      if (event.kind === 'directTraitGrant') {
        if (equipped[event.traitKey] !== undefined) continue;
        const giver =
          event.giverKey === undefined ? undefined : catalog.traitGivers.byKey[event.giverKey];
        const declaration = catalog.traits.byKey[event.traitKey];
        if (
          declaration === undefined ||
          (event.giverKey !== undefined &&
            (giver === undefined || !giver.traitKeys.includes(event.traitKey)))
        )
          continue;
        equipped[event.traitKey] = Object.freeze({
          traitKey: event.traitKey,
          giverKey: giver?.key ?? event.sourceTraitKey,
          providerKind: giver?.providerKind ?? 'npc',
          ...(isPomEligibleTrait(catalog, event.traitKey) ? { level: 1 } : {}),
          sourceRole: event.acquisitionRole,
        });
        continue;
      }
      const option = event.options[optionIndex(event.selectedOptionKey)];
      for (const traitKey of event.bannedTraitKeys ?? []) bannedTraitKeys.add(traitKey);
      if (option === undefined || equipped[option.traitKey] !== undefined) continue;
      const giver = catalog.traitGivers.byKey[event.giverKey];
      const declaration = catalog.traits.byKey[option.traitKey];
      if (giver === undefined || declaration === undefined) continue;
      const replacementLevel =
        event.replacementTransition === undefined
          ? undefined
          : equipped[event.replacementTransition.replacedTraitKey]?.level;
      if (event.replacementTransition !== undefined) {
        delete equipped[event.replacementTransition.replacedTraitKey];
      }
      equipped[option.traitKey] = Object.freeze({
        traitKey: option.traitKey,
        giverKey: giver.key,
        providerKind: giver.providerKind,
        ...(option.rarity === undefined ? {} : { rarity: option.rarity }),
        ...(isPomEligibleTrait(catalog, option.traitKey) ? { level: 1 } : {}),
        ...(declaration.hammerCompatibility === undefined ? {} : { hammerRank: 'RankI' as const }),
        sourceRole: event.acquisitionRole,
        ...(event.acquisitionIdentity === undefined
          ? {}
          : { acquisitionIdentity: event.acquisitionIdentity }),
        ...(event.echoRepeatedKeepsakeKey === undefined
          ? {}
          : {
              echoRepeatedKeepsakeKey: event.echoRepeatedKeepsakeKey,
              echoKeepsakeReplayCount: 0,
            }),
      });
      const targeted = event.targetedAcquisitionTransition;
      if (targeted !== undefined) {
        const target = equipped[targeted.targetTraitKey];
        if (target !== undefined) {
          switch (targeted.kind) {
            case 'promoteGodTraitToHeroic':
              equipped[targeted.targetTraitKey] = Object.freeze({
                ...target,
                rarity: targeted.newRarity,
              });
              break;
            case 'upgradeHammerToRank2':
              equipped[targeted.targetTraitKey] = Object.freeze({
                ...target,
                hammerRank: targeted.newHammerRank,
              });
              break;
          }
        }
      }
      if (event.replacementTransition !== undefined) {
        const replacement = equipped[event.replacementTransition.newTraitKey];
        if (replacement !== undefined && replacementLevel !== undefined) {
          equipped[event.replacementTransition.newTraitKey] = Object.freeze({
            ...replacement,
            level: replacementLevel,
          });
        }
      }
    }
    const fromTraits = deriveFacts(catalog, equipped);
    const afterAcquisition = combinedElementFacts(fromTraits, pickupElements);
    const nextActiveSources = activeRarityFloorSources(
      catalog,
      equipped,
      afterAcquisition.elementCounts,
    );
    const newlyActive = new Set(
      [...nextActiveSources].filter((sourceKey) => !activeSources.has(sourceKey)),
    );
    promoteActiveFloorTargets(
      catalog,
      equipped,
      newlyActive,
      ordered
        .slice(0, index)
        .filter((event): event is TraitOfferEvent => event.kind === 'traitOffer'),
    );
    activeSources = nextActiveSources;
  }
  const fromTraits = deriveFacts(catalog, equipped);
  const derived = combinedElementFacts(fromTraits, pickupElements);
  return Object.freeze({
    events: Object.freeze(ordered),
    bannedTraitKeys: Object.freeze([...bannedTraitKeys]),
    equippedTraits: Object.freeze(equipped),
    ...derived,
    ...(activeSources.size === 0 ? {} : { minimumScalableGodTraitRarity: 'Rare' as const }),
  });
}

export function traitDerivedFacts(history: TraitHistoryState) {
  return Object.freeze({
    upgradableTraitCount: history.upgradableTraitCount,
    elementCounts: history.elementCounts,
    highestBaseElementCount: history.highestBaseElementCount,
    godBoonRarityCounts: history.godBoonRarityCounts,
  });
}

export function attachTraitHistory(
  rewardHistory: RewardHistoryState,
  traitHistory: TraitHistoryState,
): RewardHistoryState {
  return Object.freeze({
    ...rewardHistory,
    traitFacts: traitDerivedFacts(traitHistory),
  });
}

export interface TraitOfferContext {
  readonly weaponKey?: string;
  readonly aspectKey?: string;
  readonly devotionNoDuo?: boolean;
  readonly blockGiftBoons?: boolean;
  readonly deathDefianceConditionMet?: boolean;
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
  /** Exact chronological keepsake held at this acquisition frontier. */
  readonly currentKeepsakeKey?: string;
}

export interface EchoLastRunBoonOutcome {
  readonly option: import('../authored-project/traits').AuthoredEchoLastRunBoonOption;
  readonly effectiveRarity: TraitRarity;
  readonly assessment: TraitAssessment;
  readonly targetTraitKeys: readonly string[];
}

/** Exact source-resolved Echo-last-run union at one pre-Echo trait frontier. */
export function echoLastRunBoonOutcomes(
  catalog: Catalog,
  history: TraitHistoryState,
  context: Pick<TraitOfferContext, 'deathDefianceConditionMet'> = {},
): readonly EchoLastRunBoonOutcome[] {
  return Object.freeze(
    catalog.echoLastRunBoon.variants.values.flatMap((variant) => {
      const trait = catalog.traits.byKey[variant.traitKey];
      if (trait?.rarityDomain.kind !== 'ranked') return [];
      return trait.rarityDomain.equippedRarities.map((rarity) => {
        const effectiveRarity =
          rarity === 'Common' && history.minimumScalableGodTraitRarity === 'Rare'
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
          assessment: assessTraitOption(
            catalog,
            variant.traitKey,
            history,
            {
              resolvedProviderKey: variant.giverKey,
              freshRarityOverride: effectiveRarity,
              ordinarySlotReplacement: 'forbidden',
              ...(context.deathDefianceConditionMet === undefined
                ? {}
                : { deathDefianceConditionMet: context.deathDefianceConditionMet }),
            },
            effectiveRarity,
          ),
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
  readonly code: 'nonPriorityTrait' | 'missingAttackOrSpecial' | 'traitOfferSelectionUnavailable';
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
const compositionDomainCache = new WeakMap<
  Catalog,
  WeakMap<TraitHistoryState, Map<string, TraitOfferCompositionDomains>>
>();

function compositionDomainCacheKey(giverKey: string, context: TraitOfferContext): string {
  return JSON.stringify([
    giverKey,
    context.weaponKey,
    context.aspectKey,
    context.devotionNoDuo,
    context.blockGiftBoons,
    context.deathDefianceConditionMet,
    context.echoLastRewardAvailable,
    context.echoLastRewardRecreation,
    context.freshRarityOverride,
    context.circeRemovableFearVow,
    context.manualArcanaGraspCost,
    context.currentKeepsakeKey,
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
  const requiredReplacement = Math.min(
    replacements.size,
    Math.max(0, 3 - ordinaryCandidateCount - authoredHighTier),
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
  readonly composition: TraitOfferCompositionAssessment;
  readonly replacementComposition: TraitReplacementCompositionAssessment;
  readonly targetedAcquisition: TraitTargetedAcquisitionAssessment;
  readonly reached: true;
  readonly chronologicalIndex: number;
}

/** The branch-local evidence published for one reached selected offer. */
export interface TraitOfferBranchAssessment {
  readonly assessments: readonly TraitAssessment[];
  readonly composition: TraitOfferCompositionAssessment;
  readonly replacementComposition: TraitReplacementCompositionAssessment;
  readonly targetedAcquisition: TraitTargetedAcquisitionAssessment;
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
): ReachedTraitOfferEvaluation {
  // Exact one-result sources (for example, a keepsake equip) are direct
  // acquisitions, not a sparse ordinary offer. They retain the normal
  // trait-level assessment and history event path without inheriting the
  // three-choice offer-composition contract.
  const legalityOffer = rarificationBaseOffer ?? offer;
  const composition = directAcquisition
    ? Object.freeze({ applies: false, legal: true, findings: Object.freeze([]) })
    : assessTraitOfferComposition(catalog, legalityOffer, before);
  const replacementComposition = directAcquisition
    ? Object.freeze({
        applies: false,
        legal: true,
        ordinaryCandidateCount: 0,
        maximumReplacementCount: 0,
        replacementCount: 0,
        findings: Object.freeze([]),
      })
    : assessTraitReplacementComposition(catalog, legalityOffer, before, context);
  const targetedAcquisition = assessSelectedTargetedAcquisition(catalog, legalityOffer, before);
  return Object.freeze({
    address,
    acquisitionRole,
    before,
    offer,
    context,
    ...(arcanaFear === undefined ? {} : { arcanaFear }),
    ...(keepsakes === undefined ? {} : { keepsakes }),
    assessments: assessTraitOffer(catalog, legalityOffer, before, context),
    composition,
    replacementComposition,
    targetedAcquisition,
    reached: true,
    chronologicalIndex,
  });
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
  if (offer.kind === 'fallbackGold')
    return Object.freeze({ applies: false, legal: true, findings: Object.freeze([]) });
  const selected = offer.options[optionIndex(offer.selectedOptionKey)];
  const selectionFindings: TraitOfferCompositionFinding[] =
    selected === undefined ? [Object.freeze({ code: 'traitOfferSelectionUnavailable' })] : [];
  const giver = catalog.traitGivers.byKey[offer.giverKey];
  const applies =
    giver?.providerKind === 'olympian' && Object.keys(before.ordinaryBoonSlots).length === 0;
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
    const slot = catalog.traits.byKey[option.traitKey]?.ordinaryBoonSlot;
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
    });
    return Object.freeze({
      applies,
      ...result,
      legal: applies && result.legal,
    });
  }
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
): { readonly history: TraitHistoryState; readonly event?: TraitOfferEvent } {
  const valid =
    evaluation.composition.legal &&
    evaluation.replacementComposition.legal &&
    evaluation.targetedAcquisition.legal &&
    evaluation.assessments.every((assessment) => assessment.legal);
  if (!valid) return Object.freeze({ history: evaluation.before });
  if (evaluation.offer.kind === 'fallbackGold')
    return Object.freeze({ history: evaluation.before });
  const selectedOption = evaluation.offer.options[optionIndex(evaluation.offer.selectedOptionKey)];
  if (selectedOption === undefined) return Object.freeze({ history: evaluation.before });
  const selectedTraitKey = selectedOption.traitKey;
  // Every reached offer is assessed and retained in the evaluation trace.
  // Only declarations that equip their selection may mutate the canonical
  // equipped-trait history; descriptors and pickup producers remain
  // observational at this boundary.
  const selectedDisposition = catalog.traits.byKey[selectedTraitKey]?.selectedDisposition;
  if (
    selectedDisposition?.kind !== 'equip' &&
    selectedDisposition?.kind !== 'directTraitSets' &&
    selectedDisposition?.kind !== 'circe' &&
    selectedDisposition?.kind !== 'echo' &&
    selectedDisposition?.kind !== 'advanceCurrentKeepsake' &&
    selectedDisposition?.kind !== 'worldShopRestock'
  ) {
    return Object.freeze({ history: evaluation.before });
  }
  const selectedAssessment =
    evaluation.assessments[optionIndex(evaluation.offer.selectedOptionKey)];
  const bannedTraitKeys = denialBannedTraitKeys(catalog, evaluation);
  const event: TraitOfferEvent = Object.freeze({
    kind: 'traitOffer',
    owner: evaluation.address,
    acquisitionRole: evaluation.acquisitionRole,
    sequence,
    giverKey: evaluation.offer.giverKey,
    options: evaluation.offer.options,
    selectedOptionKey: evaluation.offer.selectedOptionKey,
    acquisitionPoint,
    ...(acquisitionIdentity === undefined ? {} : { acquisitionIdentity }),
    ...(echoRepeatedKeepsakeKey === undefined ? {} : { echoRepeatedKeepsakeKey }),
    ...(bannedTraitKeys === undefined ? {} : { bannedTraitKeys }),
    ...(selectedAssessment?.replacementTransition === undefined
      ? {}
      : { replacementTransition: selectedAssessment.replacementTransition }),
    ...(evaluation.targetedAcquisition.transition === undefined
      ? {}
      : { targetedAcquisitionTransition: evaluation.targetedAcquisition.transition }),
  });
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
  const history = foldTraitHistoryEvents(catalog, [
    ...evaluation.before.events,
    event,
    ...(mutation === undefined ? [] : [mutation]),
  ]);
  return Object.freeze({ history, event });
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
export function directTraitSetOutcomes(
  catalog: Catalog,
  history: TraitHistoryState,
  sourceTraitKey: string,
  setKey: import('../catalog-schema').DirectTraitSetKey,
): readonly (string | null)[] {
  const disposition = catalog.traits.byKey[sourceTraitKey]?.selectedDisposition;
  if (disposition?.kind !== 'directTraitSets') return Object.freeze([]);
  const set = disposition.sets.find((candidate) => candidate.key === setKey);
  if (set === undefined) return Object.freeze([]);
  const available = set.traitKeys.filter(
    (traitKey) => history.equippedTraits[traitKey] === undefined,
  );
  return Object.freeze(available.length === 0 ? [null] : available);
}

/** Echo Pom's exact pre-choice random domain: Pom-eligible traits at the greatest level only. */
export function echoPomGreatestLevelTraitKeys(
  catalog: Catalog,
  history: TraitHistoryState,
): readonly string[] {
  const eligible = Object.values(history.equippedTraits).filter(
    (trait) => isPomEligibleTrait(catalog, trait.traitKey) && trait.level !== undefined,
  );
  const greatest = Math.max(0, ...eligible.map((trait) => trait.level ?? 0));
  return Object.freeze(
    eligible.filter((trait) => trait.level === greatest).map((trait) => trait.traitKey),
  );
}

/** Validates and records the closed declaration-owned Pom mutation against its pre-effect ledger. */
export function recordReachedLevelResolution(
  catalog: Catalog,
  address: LevelResolutionAddress,
  value: AuthoredLevelResolution,
  levelCount: number,
  before: TraitHistoryState,
  sequence: number,
  acquisitionPoint: string,
  effectKind: 'choice' | 'random' = value.kind,
  emptyTargetAllowed = false,
): { readonly history: TraitHistoryState; readonly event?: TraitLevelMutationEvent } {
  const offered = value.kind === 'choice' ? value.offeredTraitKeys : [];
  const target = value.kind === 'choice' ? value.selectedTraitKey : value.targetTraitKey;
  const required = Math.min(3, before.upgradableTraitCount);
  const noEligibleTarget = before.upgradableTraitCount === 0;
  const complete =
    value.kind !== effectKind
      ? false
      : value.kind === 'choice'
        ? offered.length === required &&
          new Set(offered).size === offered.length &&
          target !== null &&
          offered.includes(target) &&
          offered.every(
            (traitKey) =>
              isPomEligibleTrait(catalog, traitKey) &&
              before.equippedTraits[traitKey] !== undefined,
          )
        : target !== null || (emptyTargetAllowed && noEligibleTarget);
  if (emptyTargetAllowed && noEligibleTarget && value.kind === 'random' && target === null) {
    return Object.freeze({ history: before });
  }
  if (
    !complete ||
    target === null ||
    !isPomEligibleTrait(catalog, target) ||
    before.equippedTraits[target] === undefined
  )
    return Object.freeze({ history: before });
  const equipped = before.equippedTraits[target];
  if (equipped?.level === undefined) return Object.freeze({ history: before });
  const event: TraitLevelMutationEvent = Object.freeze({
    kind: 'levelMutation',
    owner: address,
    acquisitionRole: address.acquisitionRole,
    sequence,
    acquisitionPoint,
    targetTraitKey: target,
    oldLevel: equipped.level,
    newLevel: equipped.level + levelCount,
  });
  return Object.freeze({
    event,
    history: foldTraitHistoryEvents(catalog, [...before.events, event]),
  });
}

export type LevelResolutionFindingCode =
  | 'missingTarget'
  | 'wrongOfferCount'
  | 'duplicateTargets'
  | 'selectedTargetNotOffered'
  | 'targetUnavailable'
  | 'kindMismatch';
export interface ReachedLevelResolutionEvaluation {
  readonly address: LevelResolutionAddress;
  readonly value: AuthoredLevelResolution;
  readonly before: TraitHistoryState;
  readonly levelCount: number;
  readonly effectKind: 'choice' | 'random';
  readonly emptyTargetAllowed: boolean;
  readonly findings: readonly LevelResolutionFindingCode[];
  readonly reached: true;
  readonly chronologicalIndex: number;
}

export interface SelectedLevelResolutionAssessment {
  readonly address: LevelResolutionAddress;
  readonly value: AuthoredLevelResolution;
  readonly branches: readonly (Pick<
    ReachedLevelResolutionEvaluation,
    'findings' | 'levelCount' | 'emptyTargetAllowed'
  > & { readonly eligibleTargetCount: number })[];
  readonly reached: true;
  readonly chronologicalIndex: number;
}

export function pomEligibleTargetKeys(
  catalog: Catalog,
  history: TraitHistoryState,
): readonly string[] {
  return Object.freeze(
    Object.keys(history.equippedTraits).filter((traitKey) => isPomEligibleTrait(catalog, traitKey)),
  );
}
export function evaluateReachedLevelResolution(
  catalog: Catalog,
  address: LevelResolutionAddress,
  value: AuthoredLevelResolution,
  levelCount: number,
  before: TraitHistoryState,
  chronologicalIndex: number,
  effectKind: 'choice' | 'random' = value.kind,
  emptyTargetAllowed = false,
): ReachedLevelResolutionEvaluation {
  const target = value.kind === 'choice' ? value.selectedTraitKey : value.targetTraitKey;
  const findings: LevelResolutionFindingCode[] = [];
  if (value.kind !== effectKind) findings.push('kindMismatch');
  if (target === null && !(emptyTargetAllowed && before.upgradableTraitCount === 0))
    findings.push('missingTarget');
  if (value.kind === 'choice') {
    if (value.offeredTraitKeys.length !== Math.min(3, before.upgradableTraitCount))
      findings.push('wrongOfferCount');
    if (new Set(value.offeredTraitKeys).size !== value.offeredTraitKeys.length)
      findings.push('duplicateTargets');
    if (target !== null && !value.offeredTraitKeys.includes(target))
      findings.push('selectedTargetNotOffered');
    if (
      value.offeredTraitKeys.some(
        (traitKey) =>
          !isPomEligibleTrait(catalog, traitKey) || before.equippedTraits[traitKey] === undefined,
      )
    )
      findings.push('targetUnavailable');
  }
  if (
    target !== null &&
    (!isPomEligibleTrait(catalog, target) || before.equippedTraits[target] === undefined) &&
    !findings.includes('targetUnavailable')
  )
    findings.push('targetUnavailable');
  return Object.freeze({
    address,
    value,
    before,
    levelCount,
    effectKind,
    emptyTargetAllowed,
    findings: Object.freeze(findings),
    reached: true,
    chronologicalIndex,
  });
}

function checkRequirement(
  catalog: Catalog,
  requirement: TraitRequirementExpression,
  trait: TraitDeclaration,
  history: TraitHistoryState,
  context: TraitOfferContext,
): Omit<TraitAssessmentFinding, 'traitKey'> | undefined {
  switch (requirement.kind) {
    case 'all':
      return requirement.requirements
        .map((child) => checkRequirement(catalog, child, trait, history, context))
        .find(Boolean);
    case 'anyEquippedTrait':
      return requirement.traitKeys.some((key) => history.equippedTraits[key] !== undefined)
        ? undefined
        : {
            code: 'missingPrerequisite',
            requirementTraitKeys: Object.freeze([...requirement.traitKeys]),
          };
    case 'notEquippedTrait':
      return requirement.traitKeys.some((key) => history.equippedTraits[key] !== undefined)
        ? {
            code: 'negativePrerequisite',
            requirementTraitKeys: Object.freeze([...requirement.traitKeys]),
          }
        : undefined;
    case 'elementCount':
      return (history.elementCounts[requirement.element] ?? 0) >= requirement.minimum
        ? undefined
        : { code: 'elementThreshold', detail: `${requirement.element}:${requirement.minimum}` };
    case 'highestBaseElementCount':
      return history.highestBaseElementCount >= requirement.minimum
        ? undefined
        : { code: 'elementThreshold', detail: `${requirement.minimum}` };
    case 'godBoonRarityCount': {
      const count = history.godBoonRarityCounts[requirement.rarity] ?? 0;
      return count >= requirement.minimum &&
        (requirement.maximum === undefined || count <= requirement.maximum)
        ? undefined
        : { code: 'rarityCount', detail: `${requirement.rarity}:${requirement.minimum}` };
    }
    case 'rarifiableTrait':
      return Object.values(history.equippedTraits).some((equipped) => {
        const declaration = traitFor(catalog, equipped.traitKey);
        return (
          declaration !== undefined &&
          declaration.isCoreGodTrait &&
          declaration.rarityDomain.kind === 'ranked' &&
          equipped.rarity !== undefined &&
          nextRarity(catalog, equipped.traitKey, equipped.rarity) !== undefined &&
          !declaration.blockInRunRarify
        );
      })
        ? undefined
        : { code: 'rarifiableTarget' };
    case 'upgradableTrait':
      return history.upgradableTraitCount > 0
        ? undefined
        : { code: 'missingPrerequisite', detail: 'upgradableTrait' };
    case 'ordinaryBoonSlotOccupied':
      return history.ordinaryBoonSlots[requirement.slot] !== undefined
        ? undefined
        : { code: 'missingPrerequisite', detail: requirement.slot };
    case 'offerContext':
      // Context requirements are exact predicates, not one-way blockers: a
      // declaration may require the context to be active or explicitly absent.
      // Missing optional context is the same as an inactive context so direct
      // pure assessments retain the ordinary, unblocked behavior.
      if (
        (requirement.context === 'devotionNoDuo'
          ? context.devotionNoDuo
          : requirement.context === 'blockGiftBoons'
            ? context.blockGiftBoons
            : requirement.context === 'circeRemovableFearVow'
              ? context.circeRemovableFearVow
              : context.deathDefianceConditionMet) === requirement.required
      )
        return undefined;
      return { code: 'offerContext', detail: requirement.context };
    case 'manualArcanaGraspCost':
      return (context.manualArcanaGraspCost ?? 0) >= requirement.minimum
        ? undefined
        : { code: 'missingPrerequisite', detail: 'manualArcanaGraspCost' };
  }
}

// Requirement evaluation needs the catalog while recursing. The implementation below
// intentionally closes over it through assessTraitOption; this local slot is replaced
// before each invocation and never escapes the pure call.
function traitFor(catalog: Catalog, key: string) {
  return catalog.traits.byKey[key];
}

function superchargeableGodTraitTargetKeys(
  catalog: Catalog,
  sourceTraitKey: string,
  history: TraitHistoryState,
): readonly string[] {
  return Object.freeze(
    catalog.traits.values.flatMap((declaration) => {
      const equipped = history.equippedTraits[declaration.key];
      return equipped !== undefined &&
        isPomEligibleTrait(catalog, declaration.key) &&
        declaration.rarityDomain.kind === 'ranked' &&
        equipped.rarity !== undefined &&
        nextRarity(catalog, declaration.key, equipped.rarity) !== undefined &&
        !declaration.blockInRunRarify &&
        withinTargetLevelLimit(catalog, sourceTraitKey, declaration.key, equipped)
        ? [declaration.key]
        : [];
    }),
  );
}

function withinTargetLevelLimit(
  catalog: Catalog,
  sourceTraitKey: string,
  targetTraitKey: string,
  target: EquippedTrait,
): boolean {
  const acquisition = catalog.traits.byKey[sourceTraitKey]?.targetedAcquisition;
  if (acquisition?.kind !== 'promoteGodTraitToHeroic') return true;
  const maximum =
    target.rarity === undefined
      ? undefined
      : acquisition.maximumEligibleLevelByTraitAndRarity?.[targetTraitKey]?.[target.rarity];
  return maximum === undefined || target.level === undefined || target.level <= maximum;
}

function bridalGlowAddedLevels(rarity: TraitRarity | undefined): number {
  switch (rarity) {
    case 'Common':
      return 1;
    case 'Rare':
      return 2;
    case 'Epic':
      return 3;
    case 'Heroic':
      return 4;
    default:
      throw new Error(
        `Bridal Glow requires a ranked source rarity, received ${rarity ?? 'missing'}`,
      );
  }
}

function upgradableHammerTargetKeys(
  catalog: Catalog,
  history: TraitHistoryState,
): readonly string[] {
  return Object.freeze(
    catalog.traits.values.flatMap((declaration) => {
      const equipped = history.equippedTraits[declaration.key];
      return equipped !== undefined &&
        declaration.hammerCompatibility?.supportsRankII === true &&
        equipped.hammerRank === 'RankI'
        ? [declaration.key]
        : [];
    }),
  );
}

/** Exact pre-acquisition target domain for one declaration-owned transition. */
export function targetedAcquisitionTargetKeys(
  catalog: Catalog,
  sourceTraitKey: string,
  history: TraitHistoryState,
): readonly string[] {
  const acquisition = catalog.traits.byKey[sourceTraitKey]?.targetedAcquisition;
  if (acquisition === undefined) return Object.freeze([]);
  switch (acquisition.kind) {
    case 'promoteGodTraitToHeroic':
      return superchargeableGodTraitTargetKeys(catalog, sourceTraitKey, history);
    case 'upgradeHammerToRank2':
      return upgradableHammerTargetKeys(catalog, history);
  }
}

export function assessTraitOption(
  catalog: Catalog,
  traitKey: string,
  history: TraitHistoryState,
  context: TraitOfferContext = {},
  rarity?: TraitRarity,
): TraitAssessment {
  const trait = catalog.traits.byKey[traitKey];
  if (trait === undefined)
    return {
      legal: false,
      findings: [{ code: 'missingPrerequisite', traitKey, detail: 'unknown trait' }],
    };
  const findings: TraitAssessmentFinding[] = [];
  if (history.bannedTraitKeys.includes(traitKey)) findings.push({ code: 'bannedTrait', traitKey });
  if (history.equippedTraits[traitKey] !== undefined)
    findings.push({ code: 'alreadyEquipped', traitKey });
  for (const requirement of trait.offerRequirements) {
    const failure = checkRequirement(catalog, requirement, trait, history, context);
    if (failure !== undefined) findings.push({ ...failure, traitKey });
  }
  if (
    trait.targetedAcquisition !== undefined &&
    targetedAcquisitionTargetKeys(catalog, traitKey, history).length === 0
  ) {
    findings.push({ code: 'targetedAcquisitionNoEligibleTarget', traitKey });
  }
  if (context.devotionNoDuo && rarity === 'Duo')
    findings.push({ code: 'offerContext', traitKey, detail: 'devotionNoDuo' });
  if (
    trait.ordinaryBoonSlot !== undefined &&
    history.ordinaryBoonSlots[trait.ordinaryBoonSlot] !== undefined
  )
    findings.push({ code: 'occupiedBoonSlot', traitKey, detail: trait.ordinaryBoonSlot });
  if (
    trait.hammerCompatibility !== undefined &&
    ((context.weaponKey !== undefined &&
      context.weaponKey !== trait.hammerCompatibility.weaponKey) ||
      (context.aspectKey !== undefined &&
        !trait.hammerCompatibility.aspectKeys.includes(context.aspectKey)))
  )
    findings.push({ code: 'wrongHammerLoadout', traitKey });
  let replacementTransition: TraitReplacementTransition | undefined;
  if (
    history.minimumScalableGodTraitRarity !== undefined &&
    rarity === 'Common' &&
    trait.usesBoonRarity &&
    trait.rarityDomain.kind === 'ranked' &&
    trait.rarityDomain.freshOfferRarities.includes('Rare')
  ) {
    findings.push({ code: 'rarityBelowActiveFloor', traitKey, detail: 'Rare' });
  }
  if (
    trait.selectedDisposition.kind === 'echo' &&
    trait.selectedDisposition.effect === 'lastRunBoon' &&
    !echoLastRunBoonOutcomes(catalog, history, context).some((outcome) => outcome.assessment.legal)
  )
    findings.push({ code: 'offerContext', traitKey, detail: 'echoLastRunBoonEmpty' });
  if (
    trait.selectedDisposition.kind === 'echo' &&
    trait.selectedDisposition.effect === 'lastReward' &&
    context.echoLastRewardAvailable !== true
  )
    findings.push({ code: 'offerContext', traitKey, detail: 'echoLastRewardMissing' });
  if (
    trait.selectedDisposition.kind === 'echo' &&
    trait.selectedDisposition.effect === 'repeatKeepsake' &&
    (context.currentKeepsakeKey === undefined ||
      trait.selectedDisposition.excludedKeepsakeKeys.includes(context.currentKeepsakeKey))
  )
    findings.push({ code: 'offerContext', traitKey, detail: 'echoKeepsakeExcluded' });
  const occupied =
    trait.ordinaryBoonSlot === undefined
      ? undefined
      : history.ordinaryBoonSlots[trait.ordinaryBoonSlot];
  const giver = context.resolvedProviderKey
    ? catalog.traitGivers.byKey[context.resolvedProviderKey]
    : undefined;
  const priority = giver === undefined ? false : giver.priorityTraitKeys.includes(traitKey);
  const replacementEligible =
    context.ordinarySlotReplacement !== 'forbidden' &&
    occupied !== undefined &&
    occupied.traitKey !== traitKey &&
    giver?.providerKind === 'olympian' &&
    priority &&
    history.equippedTraits[traitKey] === undefined;
  if (replacementEligible && occupied !== undefined && trait.ordinaryBoonSlot !== undefined) {
    const requiredRarity =
      occupied.rarity === undefined
        ? undefined
        : nextRarity(catalog, occupied.traitKey, occupied.rarity);
    const occupiedIndex = findings.findIndex((finding) => finding.code === 'occupiedBoonSlot');
    const nonSlotFindings = findings.filter((finding) => finding.code !== 'occupiedBoonSlot');
    if (requiredRarity === undefined) {
      findings.push({
        code: 'replacementMaximumRarity',
        traitKey,
        detail: occupied.traitKey,
      });
    } else if (rarity !== requiredRarity) {
      // Retain a precise replacement-shaped diagnostic rather than exposing
      // arbitrary rarity variants for an occupied slot.
      if (occupiedIndex >= 0 && nonSlotFindings.length === 0) findings.splice(occupiedIndex, 1);
      findings.push({
        code: 'replacementRarityMismatch',
        traitKey,
        detail: `${requiredRarity}:${rarity ?? 'missing'}`,
      });
    } else if (nonSlotFindings.length === 0) {
      if (occupiedIndex >= 0) findings.splice(occupiedIndex, 1);
      replacementTransition = Object.freeze({
        slot: trait.ordinaryBoonSlot,
        replacedTraitKey: occupied.traitKey,
        oldRarity: occupied.rarity as TraitRarity,
        newTraitKey: traitKey,
        requiredRarity,
      });
    }
  } else if (
    context.ordinarySlotReplacement !== 'forbidden' &&
    occupied !== undefined &&
    trait.ordinaryBoonSlot !== undefined
  ) {
    findings.push({
      code: 'replacementUnavailable',
      traitKey,
      detail: trait.ordinaryBoonSlot,
    });
  }
  // Ranked authored rarities are structurally allowed to retain an equipped
  // rarity while the contextual offer decides whether it is a fresh option.
  // Legal replacements may use their exact promoted rarity, and a source may
  // explicitly override the fresh appearance rarity (for example, Gorgon at
  // Heroic), even though Heroic is never an ordinary fresh offer rarity.
  if (
    trait.rarityDomain.kind === 'ranked' &&
    rarity !== undefined &&
    !trait.rarityDomain.freshOfferRarities.includes(rarity) &&
    context.freshRarityOverride !== rarity &&
    replacementTransition === undefined
  ) {
    findings.push({
      code: 'freshRarityUnavailable',
      traitKey,
      detail: rarity,
    });
  }
  return Object.freeze({
    legal: findings.length === 0,
    findings: Object.freeze(findings),
    ...(replacementTransition === undefined ? {} : { replacementTransition }),
  });
}

export function assessTraitOffer(
  catalog: Catalog,
  offer: AuthoredTraitOffer,
  history: TraitHistoryState,
  context: TraitOfferContext = {},
): readonly TraitAssessment[] {
  if (offer.kind === 'fallbackGold') return Object.freeze([]);
  const offerContext = { ...context, resolvedProviderKey: offer.giverKey };
  return Object.freeze(
    offer.options.map((option) =>
      assessTraitOption(catalog, option.traitKey, history, offerContext, option.rarity),
    ),
  );
}

/**
 * The offer frontier Calling Card is allowed to act on.  This deliberately
 * excludes selected-only acquisition consequences: spending a row action is
 * an offer action, so a later invalid selected child must not undo it.
 */
export function assessTraitOfferBeforeRarification(
  catalog: Catalog,
  offer: AuthoredTraitOffer,
  history: TraitHistoryState,
  context: TraitOfferContext = {},
): {
  readonly assessments: readonly TraitAssessment[];
  readonly composition: TraitOfferCompositionAssessment;
  readonly replacementComposition: TraitReplacementCompositionAssessment;
  readonly legal: boolean;
} {
  const assessments = assessTraitOffer(catalog, offer, history, context);
  const composition = assessTraitOfferComposition(catalog, offer, history);
  const replacementComposition = assessTraitReplacementComposition(
    catalog,
    offer,
    history,
    context,
  );
  return Object.freeze({
    assessments,
    composition,
    replacementComposition,
    legal:
      composition.legal &&
      replacementComposition.legal &&
      assessments.every((assessment) => assessment.legal),
  });
}

export function assessSelectedTargetedAcquisition(
  catalog: Catalog,
  offer: AuthoredTraitOffer,
  history: TraitHistoryState,
): TraitTargetedAcquisitionAssessment {
  if (offer.kind === 'fallbackGold')
    return Object.freeze({ applies: false, legal: true, findings: Object.freeze([]) });
  const option = offer.options[optionIndex(offer.selectedOptionKey)];
  if (option === undefined) {
    return Object.freeze({ applies: false, legal: true, findings: Object.freeze([]) });
  }
  const acquisition = catalog.traits.byKey[option.traitKey]?.targetedAcquisition;
  if (acquisition === undefined) {
    return Object.freeze({ applies: false, legal: true, findings: Object.freeze([]) });
  }
  const targets = targetedAcquisitionTargetKeys(catalog, option.traitKey, history);
  if (targets.length === 0) {
    return Object.freeze({
      applies: true,
      legal: true,
      sourceTraitKey: option.traitKey,
      findings: Object.freeze([]),
    });
  }
  if (option.targetTraitKey === undefined) {
    const finding = Object.freeze({
      code: 'targetedAcquisitionTargetMissing' as const,
      traitKey: option.traitKey,
    });
    return Object.freeze({
      applies: true,
      legal: false,
      sourceTraitKey: option.traitKey,
      findings: Object.freeze([finding]),
    });
  }
  if (!targets.includes(option.targetTraitKey)) {
    const finding = Object.freeze({
      code: 'targetedAcquisitionTargetUnavailable' as const,
      traitKey: option.traitKey,
      detail: option.targetTraitKey,
    });
    return Object.freeze({
      applies: true,
      legal: false,
      sourceTraitKey: option.traitKey,
      targetTraitKey: option.targetTraitKey,
      findings: Object.freeze([finding]),
    });
  }
  const target = history.equippedTraits[option.targetTraitKey];
  if (target === undefined) {
    throw new Error(`targeted acquisition target ${option.targetTraitKey} is not equipped`);
  }
  const transition: TraitTargetedAcquisitionTransition =
    acquisition.kind === 'promoteGodTraitToHeroic'
      ? (() => {
          if (target.rarity === undefined) {
            throw new Error(`targeted acquisition target ${option.targetTraitKey} has no rarity`);
          }
          return Object.freeze({
            kind: 'promoteGodTraitToHeroic' as const,
            sourceTraitKey: option.traitKey,
            targetTraitKey: option.targetTraitKey,
            oldRarity: target.rarity,
            newRarity: 'Heroic' as const,
            oldLevel: target.level ?? 0,
            newLevel: (target.level ?? 0) + bridalGlowAddedLevels(option.rarity),
          });
        })()
      : Object.freeze({
          kind: 'upgradeHammerToRank2' as const,
          sourceTraitKey: option.traitKey,
          targetTraitKey: option.targetTraitKey,
          oldHammerRank: 'RankI' as const,
          newHammerRank: 'RankII' as const,
        });
  return Object.freeze({
    applies: true,
    legal: true,
    sourceTraitKey: option.traitKey,
    targetTraitKey: option.targetTraitKey,
    findings: Object.freeze([]),
    transition,
  });
}

export interface TraitCandidateAssessment {
  readonly traitKey: string;
  readonly rarity?: TraitRarity;
  readonly available: boolean;
  readonly assessment: TraitAssessment;
}

export function traitCandidates(
  catalog: Catalog,
  giverKey: string,
  history: TraitHistoryState,
  context: TraitOfferContext = {},
): readonly TraitCandidateAssessment[] {
  const giver = catalog.traitGivers.byKey[giverKey];
  if (giver === undefined) return Object.freeze([]);
  const firstOlympian =
    giver.providerKind === 'olympian' && Object.keys(history.ordinaryBoonSlots).length === 0;
  const priority = new Set(giver.priorityTraitKeys);
  const addCompositionContext = (
    traitKey: string,
    assessment: TraitAssessment,
  ): TraitAssessment => {
    if (!firstOlympian || priority.has(traitKey)) return assessment;
    return Object.freeze({
      legal: false,
      findings: Object.freeze([
        ...assessment.findings,
        Object.freeze({ code: 'nonPriorityTrait' as const, traitKey }),
      ]),
    });
  };
  const candidates: TraitCandidateAssessment[] = [];
  for (const traitKey of giver.traitKeys) {
    const trait = catalog.traits.byKey[traitKey];
    if (trait === undefined) continue;
    const assessment = addCompositionContext(
      traitKey,
      assessTraitOption(catalog, traitKey, history, { ...context, resolvedProviderKey: giverKey }),
    );
    if (trait.rarityDomain.kind === 'none') {
      candidates.push(Object.freeze({ traitKey, available: assessment.legal, assessment }));
      continue;
    }
    const freshRarities =
      context.freshRarityOverride === undefined
        ? trait.rarityDomain.freshOfferRarities
        : [context.freshRarityOverride];
    for (const rarity of freshRarities) {
      // Ordinary fresh generation never admits Heroic. A chronological source
      // override such as progressed Gorgon rarity is already the exact result.
      if (rarity === 'Heroic' && context.freshRarityOverride !== 'Heroic') continue;
      const rarityAssessment = addCompositionContext(
        traitKey,
        assessTraitOption(
          catalog,
          traitKey,
          history,
          { ...context, resolvedProviderKey: giverKey },
          rarity,
        ),
      );
      // A fresh rarity that is also the exact promoted replacement rarity is
      // represented by the replacement candidate below, never as an ordinary
      // arbitrary variant for an occupied slot.
      if (rarityAssessment.replacementTransition !== undefined) continue;
      candidates.push(
        Object.freeze({
          traitKey,
          rarity,
          available: rarityAssessment.legal,
          assessment: rarityAssessment,
        }),
      );
    }
  }
  // Replacement candidates are exact promoted-rarity variants. They are
  // intentionally emitted in addition to fresh variants only for the giver's
  // priority set; Heroic can therefore appear only as Epic-to-Heroic evidence.
  if (giver.providerKind === 'olympian') {
    for (const traitKey of giver.priorityTraitKeys) {
      const trait = catalog.traits.byKey[traitKey];
      if (trait?.rarityDomain.kind !== 'ranked') continue;
      const occupied =
        trait.ordinaryBoonSlot === undefined
          ? undefined
          : history.ordinaryBoonSlots[trait.ordinaryBoonSlot];
      if (occupied === undefined) continue;
      const required =
        occupied.rarity === undefined
          ? undefined
          : nextRarity(catalog, occupied.traitKey, occupied.rarity);
      if (required === undefined) continue;
      const assessment = assessTraitOption(
        catalog,
        traitKey,
        history,
        { ...context, resolvedProviderKey: giverKey },
        required,
      );
      candidates.push(
        Object.freeze({
          traitKey,
          rarity: required,
          available: assessment.legal && assessment.replacementTransition !== undefined,
          assessment,
        }),
      );
    }
  }
  return Object.freeze(candidates);
}

/**
 * Partitions exact legal candidates from one immutable pre-offer frontier.
 * `traitCandidates` supplies the shared first-Olympian priority restriction,
 * so composition cannot accidentally admit a candidate the picker rejects.
 */
export function traitOfferCompositionDomains(
  catalog: Catalog,
  giverKey: string,
  history: TraitHistoryState,
  context: TraitOfferContext = {},
): TraitOfferCompositionDomains {
  const key = compositionDomainCacheKey(giverKey, context);
  let byHistory = compositionDomainCache.get(catalog);
  if (byHistory === undefined) {
    byHistory = new WeakMap();
    compositionDomainCache.set(catalog, byHistory);
  }
  let cached = byHistory.get(history);
  if (cached === undefined) {
    cached = new Map();
    byHistory.set(history, cached);
  }
  const previous = cached.get(key);
  if (previous !== undefined) return previous;
  const ordinary: TraitCandidateAssessment[] = [];
  const highTier: TraitCandidateAssessment[] = [];
  const replacements: TraitCandidateAssessment[] = [];
  for (const candidate of traitCandidates(catalog, giverKey, history, context)) {
    if (!candidate.available) continue;
    if (candidate.assessment.replacementTransition !== undefined) {
      replacements.push(candidate);
      continue;
    }
    const trait = catalog.traits.byKey[candidate.traitKey];
    if (trait?.rarityDomain.kind !== 'ranked') continue;
    if (trait.rarityDomain.freshOfferRarities.includes('Common')) ordinary.push(candidate);
    else if (candidate.rarity === 'Duo' || candidate.rarity === 'Legendary')
      highTier.push(candidate);
  }
  const domains = Object.freeze({
    ordinary: Object.freeze(ordinary),
    highTier: Object.freeze(highTier),
    replacements: Object.freeze(replacements),
  });
  cached.set(key, domains);
  return domains;
}

/**
 * Returns one engine-validated traits outcome for changing a Fallback Gold
 * draft back to traits.  Consumers must not derive exhaustion fill rules.
 */
export function traitOfferStartingDraft(
  catalog: Catalog,
  giverKey: string,
  history: TraitHistoryState,
  context: TraitOfferContext = {},
): AuthoredTraitOfferTraits | undefined {
  const giver = catalog.traitGivers.byKey[giverKey];
  if (giver === undefined) return undefined;
  const domains = traitOfferCompositionDomains(catalog, giverKey, history, context);
  const allCandidates = traitOfferSupportsExhaustion(giver)
    ? [...domains.ordinary, ...domains.highTier, ...domains.replacements]
    : traitCandidates(catalog, giverKey, history, context).filter(
        (candidate) => candidate.available,
      );
  const variants = automaticDraftCandidates(allCandidates);
  const selfContained = selfContainedDraftCandidates(catalog, variants, history);
  const chosen = traitOfferSupportsExhaustion(giver)
    ? selectSelfContainedFirst(exhaustionStartingCandidates(catalog, domains), selfContained)
    : fixedStartingCandidates(variants, selfContained);
  if (chosen.length === 0 || (!traitOfferSupportsExhaustion(giver) && chosen.length !== 3))
    return undefined;
  const draft = traitDraft(catalog, giverKey, chosen);
  // Candidate domains establish leaf legality. Keep the authoritative complete
  // offer checks at this boundary, once, rather than evaluating every variant.
  return assessTraitOfferComposition(catalog, draft, history).legal &&
    assessTraitReplacementComposition(catalog, draft, history, context).legal &&
    assessTraitOffer(catalog, draft, history, context).every((assessment) => assessment.legal)
    ? draft
    : undefined;
}

/** Returns one exact supported draft with the next materialized option appended. */
export function nextTraitOfferDraft(
  catalog: Catalog,
  draft: AuthoredTraitOfferTraits,
  history: TraitHistoryState,
  context: TraitOfferContext = {},
): AuthoredTraitOfferTraits | undefined {
  if (draft.options.length >= 3) return undefined;
  const giver = catalog.traitGivers.byKey[draft.giverKey];
  if (giver === undefined) return undefined;
  const domains = traitOfferCompositionDomains(catalog, draft.giverKey, history, context);
  const variants = automaticDraftCandidates(
    traitOfferSupportsExhaustion(giver)
      ? [...domains.ordinary, ...domains.highTier, ...domains.replacements]
      : traitCandidates(catalog, draft.giverKey, history, context).filter(
          (candidate) => candidate.available,
        ),
  );
  const candidateByKey = new Map(variants.map((candidate) => [candidate.traitKey, candidate]));
  // Check the materialized prefix once. Subsequent completion search operates
  // exclusively on this already-derived candidate domain.
  if (
    assessTraitOffer(catalog, draft, history, context).some((assessment) => !assessment.legal) ||
    draft.options.some((option) => !candidateByKey.has(option.traitKey))
  )
    return undefined;
  const append = (
    current: AuthoredTraitOfferTraits,
    candidate: TraitCandidateAssessment,
  ): AuthoredTraitOfferTraits =>
    Object.freeze({
      ...current,
      options: Object.freeze([
        ...current.options,
        Object.freeze({
          traitKey: candidate.traitKey,
          ...(candidate.rarity === undefined ? {} : { rarity: candidate.rarity }),
        }),
      ]) as AuthoredTraitOfferTraits['options'],
    });
  const canComplete = (current: AuthoredTraitOfferTraits): boolean => {
    if (!traitOfferSupportsExhaustion(giver)) {
      const offered = new Set(current.options.map((option) => option.traitKey));
      return current.options.length === 3
        ? true
        : variants.filter((candidate) => !offered.has(candidate.traitKey)).length >=
            3 - current.options.length;
    }
    const composition = assessDraftDomainComposition(current, domains);
    if (composition.legal) return assessTraitOfferComposition(catalog, current, history).legal;
    if (current.options.length >= 3) return false;
    const offered = new Set(current.options.map((option) => option.traitKey));
    return variants.some(
      (candidate) => !offered.has(candidate.traitKey) && canComplete(append(current, candidate)),
    );
  };
  const offered = new Set(draft.options.map((option) => option.traitKey));
  for (const candidate of variants) {
    if (!candidate.available || offered.has(candidate.traitKey)) continue;
    const next = append(draft, candidate);
    if (canComplete(next)) return next;
  }
  return undefined;
}

function traitDraft(
  catalog: Catalog,
  giverKey: string,
  candidates: readonly TraitCandidateAssessment[],
): AuthoredTraitOfferTraits {
  return Object.freeze({
    kind: 'traits',
    giverKey,
    options: Object.freeze(
      candidates.map((candidate) => candidateToOption(catalog, candidate)),
    ) as AuthoredTraitOfferTraits['options'],
    selectedOptionKey: 'option1',
    rarificationActions: Object.freeze([]),
  });
}

/** Deterministic representative of the O/H/R contract for a fresh draft. */
function exhaustionStartingCandidates(
  catalog: Catalog,
  domains: TraitOfferCompositionDomains,
): readonly TraitCandidateAssessment[] {
  const ordinary = automaticDraftCandidates(domains.ordinary);
  const highTier = automaticDraftCandidates(domains.highTier);
  const replacements = automaticDraftCandidates(domains.replacements);
  if (ordinary.length >= 3) {
    const priority = ordinary.slice(0, 3);
    if (priority.some((candidate) => isAttackOrSpecial(catalog, candidate.traitKey)))
      return priority;
    const attackOrSpecial = ordinary.find((candidate) =>
      isAttackOrSpecial(catalog, candidate.traitKey),
    );
    return attackOrSpecial === undefined
      ? priority
      : [
          attackOrSpecial,
          ...ordinary.filter((candidate) => candidate !== attackOrSpecial).slice(0, 2),
        ];
  }
  if (ordinary.length > 0) {
    const withReplacements = [...ordinary, ...replacements.slice(0, 3 - ordinary.length)];
    return [...withReplacements, ...highTier.slice(0, 3 - withReplacements.length)];
  }
  if (replacements.length > 0) return replacements.slice(0, 3);
  return highTier.length > 0 ? [highTier[0]!] : [];
}

function fixedStartingCandidates(
  variants: readonly TraitCandidateAssessment[],
  selfContained: readonly TraitCandidateAssessment[],
): readonly TraitCandidateAssessment[] {
  const selected = selfContained[0];
  if (selected === undefined) return [];
  return [
    selected,
    ...variants.filter((candidate) => candidate.traitKey !== selected.traitKey).slice(0, 2),
  ];
}

/** A targeted/Circe leaf needs no target when it is merely an unselected row. */
function selectSelfContainedFirst(
  candidates: readonly TraitCandidateAssessment[],
  selfContained: readonly TraitCandidateAssessment[],
): readonly TraitCandidateAssessment[] {
  const selected = candidates.find((candidate) =>
    selfContained.some(
      (selfContainedCandidate) => selfContainedCandidate.traitKey === candidate.traitKey,
    ),
  );
  return selected === undefined
    ? []
    : [selected, ...candidates.filter((candidate) => candidate.traitKey !== selected.traitKey)];
}

function isAttackOrSpecial(catalog: Catalog, traitKey: string): boolean {
  const slot = catalog.traits.byKey[traitKey]?.ordinaryBoonSlot;
  return slot === 'Melee' || slot === 'Secondary';
}

function assessDraftDomainComposition(
  draft: AuthoredTraitOfferTraits,
  domains: TraitOfferCompositionDomains,
): TraitOfferDomainCompositionResult {
  const ordinary = new Set(domains.ordinary.map((candidate) => candidate.traitKey));
  const highTier = new Set(domains.highTier.map((candidate) => candidate.traitKey));
  const replacements = new Set(domains.replacements.map((candidate) => candidate.traitKey));
  return assessTraitOfferDomainComposition({
    ordinaryKeys: Object.freeze([...ordinary]),
    highTierKeys: Object.freeze([...highTier]),
    replacementKeys: Object.freeze([...replacements]),
    authored: Object.freeze(
      draft.options.map((option) =>
        Object.freeze({
          traitKey: option.traitKey,
          kind: replacements.has(option.traitKey)
            ? 'replacement'
            : highTier.has(option.traitKey)
              ? 'highTier'
              : 'ordinary',
        }),
      ),
    ),
    fallbackGold: false,
  });
}

function candidateToOption(
  catalog: Catalog,
  candidate: TraitCandidateAssessment,
): AuthoredTraitOption {
  return withDefaultTraitOptionDetail(catalog, {
    traitKey: candidate.traitKey,
    ...(candidate.rarity === undefined ? {} : { rarity: candidate.rarity }),
  });
}

/** De-duplicates rarity variants to one deterministic row per trait key. */
function automaticDraftCandidates(
  candidates: readonly TraitCandidateAssessment[],
): readonly TraitCandidateAssessment[] {
  const seen = new Set<string>();
  return Object.freeze(
    candidates.filter((candidate) => {
      if (seen.has(candidate.traitKey)) return false;
      seen.add(candidate.traitKey);
      return true;
    }),
  );
}

/** Only the selected first row must be independently actionable. */
function selfContainedDraftCandidates(
  catalog: Catalog,
  candidates: readonly TraitCandidateAssessment[],
  history: TraitHistoryState,
): readonly TraitCandidateAssessment[] {
  return Object.freeze(
    candidates.filter((candidate) => {
      const trait = catalog.traits.byKey[candidate.traitKey];
      return !(
        (trait?.targetedAcquisition !== undefined &&
          targetedAcquisitionTargetKeys(catalog, candidate.traitKey, history).length > 0) ||
        trait?.selectedDisposition.kind === 'circe'
      );
    }),
  );
}

export function nextRarity(
  catalog: Catalog,
  traitKey: string,
  rarity: TraitRarity,
): TraitRarity | undefined {
  const declaration = catalog.traits.byKey[traitKey];
  if (declaration?.rarityDomain.kind !== 'ranked') return undefined;
  const index = catalog.traitRarityOrder.indexOf(
    rarity as (typeof catalog.traitRarityOrder)[number],
  );
  const next = catalog.traitRarityOrder[index + 1];
  return next !== undefined && declaration.rarityDomain.equippedRarities.includes(next)
    ? next
    : undefined;
}
