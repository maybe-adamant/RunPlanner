import type {
  Catalog,
  TraitDeclaration,
  TraitElement,
  TraitRarity,
  TraitRequirementExpression,
} from '../catalog-schema';
import type { SemanticAddress, TraitOfferAddress } from '../authored-project/addresses';
import type { AuthoredTraitOffer, EquippedTrait, TraitOptionKey } from '../authored-project/traits';
import type { RewardHistoryState } from '../reward-kernel/model';
import type { TraitFindingCode } from './model';
export type { TraitFindingCode } from './model';
import { optionIndex } from '../authored-project/traits';

export interface TraitOfferEvent {
  readonly owner: SemanticAddress;
  readonly acquisitionRole: string;
  readonly sequence: number;
  readonly giverKey: string;
  readonly options: AuthoredTraitOffer['options'];
  readonly selectedOptionKey: TraitOptionKey;
  readonly acquisitionPoint: string;
  /** Derived from the pre-offer state; never persisted in authored state. */
  readonly replacementTransition?: TraitReplacementTransition;
  /** Exact declaration-owned acquisition mutation derived from pre-offer state. */
  readonly targetedAcquisitionTransition?: TraitTargetedAcquisitionTransition;
}

export interface TraitReplacementTransition {
  readonly slot: string;
  readonly replacedTraitKey: string;
  readonly oldRarity: TraitRarity;
  readonly newTraitKey: string;
  readonly requiredRarity: TraitRarity;
}

export interface TraitTargetedAcquisitionTransition {
  readonly kind: 'promoteGodTraitToHeroic';
  readonly sourceTraitKey: string;
  readonly targetTraitKey: string;
  readonly oldRarity: TraitRarity;
  readonly newRarity: 'Heroic';
}

export interface TraitTargetedAcquisitionAssessment {
  readonly applies: boolean;
  readonly legal: boolean;
  readonly sourceTraitKey?: string;
  readonly targetTraitKey?: string;
  readonly findings: readonly TraitAssessmentFinding[];
  readonly transition?: TraitTargetedAcquisitionTransition;
}

export interface TraitHistoryState {
  readonly events: readonly TraitOfferEvent[];
  readonly equippedTraits: Readonly<Record<string, EquippedTrait>>;
  readonly ordinaryBoonSlots: Readonly<Record<string, EquippedTrait>>;
  readonly elementCounts: Readonly<Record<TraitElement, number>>;
  readonly highestBaseElementCount: number;
  readonly godBoonRarityCounts: Readonly<Record<string, number>>;
  readonly upgradableTraitCount: number;
  /** Derived floor for fresh scalable god-trait offers. */
  readonly minimumScalableGodTraitRarity?: 'Rare';
}

const emptyElements = Object.freeze({ Aether: 0, Earth: 0, Air: 0, Fire: 0, Water: 0 });

export function createTraitHistoryState(): TraitHistoryState {
  return Object.freeze({
    events: Object.freeze([]),
    equippedTraits: Object.freeze({}),
    ordinaryBoonSlots: Object.freeze({}),
    elementCounts: emptyElements,
    highestBaseElementCount: 0,
    godBoonRarityCounts: Object.freeze({}),
    upgradableTraitCount: 0,
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
      declaration.isPersistentGodTrait &&
      equipped.rarity !== undefined &&
      !declaration.excludeFromRarityCount
    ) {
      rarityCounts[equipped.rarity] = (rarityCounts[equipped.rarity] ?? 0) + 1;
    }
    if (
      declaration.isPersistentGodTrait &&
      !declaration.blockStacking &&
      declaration.selfExclusion !== equipped.traitKey
    )
      upgradable += 1;
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
): void {
  if (activeSources.size === 0) return;
  const effects = [...activeSources].flatMap((sourceKey) => {
    const declaration = catalog.traits.byKey[sourceKey];
    return declaration?.rarityFloorEffect === undefined
      ? []
      : [{ sourceKey, effect: declaration.rarityFloorEffect }];
  });
  if (effects.length === 0) return;
  for (const [traitKey, equipped] of Object.entries(equippedTraits)) {
    const declaration = catalog.traits.byKey[traitKey];
    if (
      declaration === undefined ||
      !declaration.isPersistentGodTrait ||
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
  }
}

export function foldTraitOfferEvents(
  catalog: Catalog,
  events: readonly TraitOfferEvent[],
): TraitHistoryState {
  const equipped: Record<string, EquippedTrait> = {};
  let activeSources: ReadonlySet<string> = new Set();
  const ordered = [...events].sort((left, right) => left.sequence - right.sequence);
  for (const event of ordered) {
    const option = event.options[optionIndex(event.selectedOptionKey)];
    if (option === undefined || equipped[option.traitKey] !== undefined) continue;
    const giver = catalog.traitGivers.byKey[event.giverKey];
    const declaration = catalog.traits.byKey[option.traitKey];
    if (giver === undefined || declaration === undefined) continue;
    if (event.replacementTransition !== undefined) {
      delete equipped[event.replacementTransition.replacedTraitKey];
    }
    equipped[option.traitKey] = Object.freeze({
      traitKey: option.traitKey,
      giverKey: giver.key,
      providerKind: giver.providerKind,
      ...(option.rarity === undefined ? {} : { rarity: option.rarity }),
      sourceRole: event.acquisitionRole,
    });
    const targeted = event.targetedAcquisitionTransition;
    if (targeted !== undefined) {
      const target = equipped[targeted.targetTraitKey];
      if (target !== undefined) {
        equipped[targeted.targetTraitKey] = Object.freeze({
          ...target,
          rarity: targeted.newRarity,
        });
      }
    }
    const afterAcquisition = deriveFacts(catalog, equipped);
    const nextActiveSources = activeRarityFloorSources(
      catalog,
      equipped,
      afterAcquisition.elementCounts,
    );
    const newlyActive = new Set(
      [...nextActiveSources].filter((sourceKey) => !activeSources.has(sourceKey)),
    );
    promoteActiveFloorTargets(catalog, equipped, newlyActive);
    activeSources = nextActiveSources;
  }
  const derived = deriveFacts(catalog, equipped);
  return Object.freeze({
    events: Object.freeze(ordered),
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
  /** The declaration-resolved provider for the addressed acquisition role. */
  readonly resolvedProviderKey?: string;
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
  readonly code: 'nonPriorityTrait' | 'missingAttackOrSpecial';
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
    readonly code: 'replacementCompositionExceeded';
    readonly detail?: string;
  }[];
}

export interface ReachedTraitOfferEvaluation {
  readonly address: SemanticAddress;
  readonly acquisitionRole: string;
  readonly before: TraitHistoryState;
  readonly offer: AuthoredTraitOffer;
  readonly context: TraitOfferContext;
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
): ReachedTraitOfferEvaluation {
  const composition = assessTraitOfferComposition(catalog, offer, before);
  const replacementComposition = assessTraitReplacementComposition(catalog, offer, before, context);
  const targetedAcquisition = assessSelectedTargetedAcquisition(catalog, offer, before);
  return Object.freeze({
    address,
    acquisitionRole,
    before,
    offer,
    context,
    assessments: assessTraitOffer(catalog, offer, before, context),
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
  const giver = catalog.traitGivers.byKey[offer.giverKey];
  const applies =
    giver?.providerKind === 'olympian' && Object.keys(before.ordinaryBoonSlots).length === 0;
  if (!applies || giver === undefined) {
    return Object.freeze({ applies: false, legal: true, findings: Object.freeze([]) });
  }
  const priority = new Set(giver.priorityTraitKeys);
  const findings: TraitOfferCompositionFinding[] = [];
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
  const applies =
    giver?.providerKind === 'olympian' && Object.keys(before.ordinaryBoonSlots).length > 0;
  if (!applies || giver === undefined) {
    return Object.freeze({
      applies: false,
      legal: true,
      ordinaryCandidateCount: 0,
      maximumReplacementCount: 0,
      replacementCount: 0,
      findings: Object.freeze([]),
    });
  }

  const ordinaryKeys = new Set<string>();
  const offerContext = { ...context, resolvedProviderKey: offer.giverKey };
  for (const traitKey of giver.traitKeys) {
    const trait = catalog.traits.byKey[traitKey];
    if (trait === undefined || trait.rarityDomain.kind !== 'ranked') continue;
    if (before.equippedTraits[traitKey] !== undefined) continue;
    const canBeFresh = trait.rarityDomain.freshOfferRarities.some((rarity) => {
      const assessment = assessTraitOption(catalog, traitKey, before, offerContext, rarity);
      return assessment.legal && assessment.replacementTransition === undefined;
    });
    if (canBeFresh) ordinaryKeys.add(traitKey);
  }
  const ordinaryCandidateCount = ordinaryKeys.size;
  const maximumReplacementCount = ordinaryCandidateCount >= 2 ? 1 : 3 - ordinaryCandidateCount;
  const replacementCount = offer.options.reduce((count, option) => {
    const assessment = assessTraitOption(
      catalog,
      option.traitKey,
      before,
      offerContext,
      option.rarity,
    );
    return assessment.replacementTransition === undefined ? count : count + 1;
  }, 0);
  const findings =
    replacementCount > maximumReplacementCount
      ? Object.freeze([
          Object.freeze({
            code: 'replacementCompositionExceeded' as const,
            detail: `${replacementCount}:${maximumReplacementCount}`,
          }),
        ])
      : Object.freeze([]);
  return Object.freeze({
    applies: true,
    legal: findings.length === 0,
    ordinaryCandidateCount,
    maximumReplacementCount,
    replacementCount,
    findings,
  });
}

export function recordReachedTraitOffer(
  catalog: Catalog,
  evaluation: ReachedTraitOfferEvaluation,
  sequence: number,
  acquisitionPoint: string,
): { readonly history: TraitHistoryState; readonly event?: TraitOfferEvent } {
  const valid =
    evaluation.composition.legal &&
    evaluation.replacementComposition.legal &&
    evaluation.targetedAcquisition.legal &&
    evaluation.assessments.every((assessment) => assessment.legal);
  if (!valid) return Object.freeze({ history: evaluation.before });
  const selectedAssessment =
    evaluation.assessments[optionIndex(evaluation.offer.selectedOptionKey)];
  const event: TraitOfferEvent = Object.freeze({
    owner: evaluation.address,
    acquisitionRole: evaluation.acquisitionRole,
    sequence,
    giverKey: evaluation.offer.giverKey,
    options: evaluation.offer.options,
    selectedOptionKey: evaluation.offer.selectedOptionKey,
    acquisitionPoint,
    ...(selectedAssessment?.replacementTransition === undefined
      ? {}
      : { replacementTransition: selectedAssessment.replacementTransition }),
    ...(evaluation.targetedAcquisition.transition === undefined
      ? {}
      : { targetedAcquisitionTransition: evaluation.targetedAcquisition.transition }),
  });
  const history = foldTraitOfferEvents(catalog, [...evaluation.before.events, event]);
  return Object.freeze({ history, event });
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
          declaration.isPersistentGodTrait &&
          declaration.rarityDomain.kind === 'ranked' &&
          equipped.rarity !== undefined &&
          nextRarity(catalog, equipped.traitKey, equipped.rarity) !== undefined &&
          !declaration.blockInRunRarify
        );
      })
        ? undefined
        : { code: 'rarifiableTarget' };
    case 'offerContext':
      // Context requirements are exact predicates, not one-way blockers: a
      // declaration may require the context to be active or explicitly absent.
      // Missing optional context is the same as an inactive context so direct
      // pure assessments retain the ordinary, unblocked behavior.
      if (
        (requirement.context === 'devotionNoDuo'
          ? context.devotionNoDuo
          : context.blockGiftBoons) === requirement.required
      )
        return undefined;
      return { code: 'offerContext', detail: requirement.context };
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
  history: TraitHistoryState,
): readonly string[] {
  return Object.freeze(
    catalog.traits.values.flatMap((declaration) => {
      const equipped = history.equippedTraits[declaration.key];
      return equipped !== undefined &&
        declaration.isPersistentGodTrait &&
        declaration.rarityDomain.kind === 'ranked' &&
        equipped.rarity !== undefined &&
        nextRarity(catalog, declaration.key, equipped.rarity) !== undefined &&
        !declaration.blockInRunRarify &&
        !declaration.blockStacking
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
      return superchargeableGodTraitTargetKeys(catalog, history);
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
    findings.push({ code: 'superchargeableTarget', traitKey });
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
    trait.isPersistentGodTrait &&
    trait.rarityDomain.kind === 'ranked' &&
    trait.rarityDomain.freshOfferRarities.includes('Rare')
  ) {
    findings.push({ code: 'rarityBelowActiveFloor', traitKey, detail: 'Rare' });
  }
  const occupied =
    trait.ordinaryBoonSlot === undefined
      ? undefined
      : history.ordinaryBoonSlots[trait.ordinaryBoonSlot];
  const giver = context.resolvedProviderKey
    ? catalog.traitGivers.byKey[context.resolvedProviderKey]
    : undefined;
  const priority = giver === undefined ? false : giver.priorityTraitKeys.includes(traitKey);
  const replacementEligible =
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
  } else if (occupied !== undefined && trait.ordinaryBoonSlot !== undefined) {
    findings.push({
      code: 'replacementUnavailable',
      traitKey,
      detail: trait.ordinaryBoonSlot,
    });
  }
  // Ranked authored rarities are structurally allowed to retain an equipped
  // rarity while the contextual offer decides whether it is a fresh option.
  // A legal replacement is the one exception: its exact promoted rarity may
  // be Heroic even though Heroic is never a fresh offer rarity.
  if (
    trait.rarityDomain.kind === 'ranked' &&
    rarity !== undefined &&
    !trait.rarityDomain.freshOfferRarities.includes(rarity) &&
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
  const offerContext = { ...context, resolvedProviderKey: offer.giverKey };
  return Object.freeze(
    offer.options.map((option) =>
      assessTraitOption(catalog, option.traitKey, history, offerContext, option.rarity),
    ),
  );
}

export function assessSelectedTargetedAcquisition(
  catalog: Catalog,
  offer: AuthoredTraitOffer,
  history: TraitHistoryState,
): TraitTargetedAcquisitionAssessment {
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
  if (target?.rarity === undefined) {
    throw new Error(`targeted acquisition target ${option.targetTraitKey} has no rarity`);
  }
  const transition: TraitTargetedAcquisitionTransition = Object.freeze({
    kind: acquisition.kind,
    sourceTraitKey: option.traitKey,
    targetTraitKey: option.targetTraitKey,
    oldRarity: target.rarity,
    newRarity: 'Heroic',
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
    for (const rarity of trait.rarityDomain.freshOfferRarities) {
      // Heroic is intentionally never in a fresh domain, even when a source
      // declaration accidentally exposes it through a broader giver policy.
      if (rarity === 'Heroic') continue;
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
