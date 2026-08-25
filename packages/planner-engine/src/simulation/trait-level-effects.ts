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
  const eligible = Object.values(history.equippedTraits).filter((trait) =>
    isPomUpgradeTarget(catalog, trait),
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
          offered.every((traitKey) => isPomUpgradeTarget(catalog, before.equippedTraits[traitKey]))
        : target !== null || (emptyTargetAllowed && noEligibleTarget);
  if (emptyTargetAllowed && noEligibleTarget && value.kind === 'random' && target === null) {
    return Object.freeze({ history: before });
  }
  if (!complete || target === null || !isPomUpgradeTarget(catalog, before.equippedTraits[target]))
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
    Object.values(history.equippedTraits)
      .filter((trait) => isPomUpgradeTarget(catalog, trait))
      .map((trait) => trait.traitKey),
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
        (traitKey) => !isPomUpgradeTarget(catalog, before.equippedTraits[traitKey]),
      )
    )
      findings.push('targetUnavailable');
  }
  if (
    target !== null &&
    !isPomUpgradeTarget(catalog, before.equippedTraits[target]) &&
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

export function checkRequirement(
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
      return history.equippedSlots[requirement.slot] !== undefined
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
              : false) === requirement.required
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
  _sourceTraitKey: string,
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
        hasEffectiveInRunUpgrade(catalog, declaration.key, equipped)
        ? [declaration.key]
        : [];
    }),
  );
}

export function bridalGlowAddedLevels(rarity: TraitRarity | undefined): number {
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

import type {
  Catalog,
  TraitDeclaration,
  TraitRarity,
  TraitRequirementExpression,
} from '../catalog-schema';
import type { LevelResolutionAddress } from '../authored-project/addresses';
import type { AuthoredLevelResolution } from '../authored-project/traits';
export type { TraitFindingCode } from './model';
import {
  isPomUpgradeTarget,
  foldTraitHistoryEvents,
  nextRarity,
  isPomEligibleTrait,
  hasEffectiveInRunUpgrade,
  type TraitHistoryState,
  type TraitLevelMutationEvent,
} from './trait-history';
import type { TraitOfferContext, TraitAssessmentFinding } from './trait-offers';
