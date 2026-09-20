export function directTraitSetOutcomes(
  catalog: Catalog,
  history: TraitHistoryState,
  sourceTraitKey: string,
  setKey: import('../../catalog-schema').DirectTraitSetKey,
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
    case 'settledSpellDrop':
      return context.settledSpellDrop === true
        ? undefined
        : { code: 'missingPrerequisite', detail: 'settledSpellDrop' };
    case 'anyActiveArcana':
      return requirement.traitKeys.some((key) => context.activeArcanaTraitKeys?.includes(key))
        ? undefined
        : {
            code: 'missingPrerequisite',
            requirementTraitKeys: Object.freeze([...requirement.traitKeys]),
          };
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
          !isInRunRarityBlocked(catalog, equipped)
        );
      })
        ? undefined
        : { code: 'rarifiableTarget' };
    case 'upgradableTrait':
      return history.upgradableTraitCount > 0
        ? undefined
        : { code: 'missingPrerequisite', detail: 'upgradableTrait' };
    case 'offerContext':
      // Context requirements are exact predicates, not one-way blockers: a
      // declaration may require the context to be active or explicitly absent.
      // Missing optional context is the same as an inactive context so direct
      // pure assessments retain the ordinary, unblocked behavior.
      if (
        (requirement.context === 'devotionNoDuo'
          ? (context.devotionNoDuo ?? false)
          : requirement.context === 'blockGiftBoons'
            ? (context.blockGiftBoons ?? false)
            : requirement.context === 'circeRemovableFearVow'
              ? (context.circeRemovableFearVow ?? false)
              : false) === requirement.required
      )
        return undefined;
      return { code: 'offerContext', detail: requirement.context };
    case 'manualArcanaGraspCost':
      return (context.manualArcanaGraspCost ?? 0) >= requirement.minimum
        ? undefined
        : { code: 'missingPrerequisite', detail: 'manualArcanaGraspCost' };
    case 'routeKeyNot':
      if (context.routeKey === undefined)
        throw new Error('route eligibility requirement evaluated without route identity');
      return context.routeKey !== requirement.routeKey
        ? undefined
        : { code: 'missingPrerequisite', detail: `routeKeyNot:${requirement.routeKey}` };
  }
}

// Requirement evaluation needs the catalog while recursing. The implementation below
// intentionally closes over it through assessTraitOption; this local slot is replaced
// before each invocation and never escapes the pure call.
function traitFor(catalog: Catalog, key: string) {
  return catalog.traits.byKey[key];
}

type TargetedAcquisitionSource = Pick<
  import('../../authored-project/traits/state').AuthoredTraitOption,
  'traitKey' | 'rarity'
>;

type TargetedAcquisitionTarget = Pick<
  import('../../authored-project/traits/state').EquippedTrait,
  'traitKey' | 'rarity' | 'level' | 'rarityBlockedInRun'
>;

function supportsHeroicPromotion(
  catalog: Catalog,
  target: TargetedAcquisitionTarget,
  preferredOnly: boolean,
): boolean {
  const declaration = catalog.traits.byKey[target.traitKey];
  if (
    declaration === undefined ||
    declaration.rarityDomain.kind !== 'ranked' ||
    target.rarity === undefined ||
    !declaration.rarityDomain.equippedRarities.includes('Heroic') ||
    isInRunRarityBlocked(catalog, target) ||
    !hasEffectiveInRunUpgrade(catalog, target.traitKey, target)
  )
    return false;
  if (preferredOnly)
    return declaration.isCoreGodTrait && !declaration.blockStacking && target.rarity !== 'Heroic';
  return catalog.traitGivers.values.some(
    (giver) => giver.shopAwareGodTrait && giver.traitKeys.includes(target.traitKey),
  );
}

function promotionTargets(
  catalog: Catalog,
  history: TraitHistoryState,
  source: TargetedAcquisitionSource | undefined,
  preferredOnly: boolean,
): readonly string[] {
  const targets: TargetedAcquisitionTarget[] = Object.values(history.equippedTraits);
  if (source !== undefined && history.equippedTraits[source.traitKey] === undefined)
    targets.push(source);
  return Object.freeze(
    targets
      .filter((target) => supportsHeroicPromotion(catalog, target, preferredOnly))
      .map((target) => target.traitKey),
  );
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
      return promotionTargets(catalog, history, undefined, true);
    case 'upgradeHammerToRank2':
      return upgradableHammerTargetKeys(catalog, history);
  }
}

/**
 * Exact selected-effect target domain. Offer eligibility deliberately remains
 * on targetedAcquisitionTargetKeys; Bridal Glow widens only after its source
 * is selected and its preferred domain is actually empty.
 */
export function selectedTargetedAcquisitionTargetKeys(
  catalog: Catalog,
  source: TargetedAcquisitionSource,
  history: TraitHistoryState,
): readonly string[] {
  const acquisition = catalog.traits.byKey[source.traitKey]?.targetedAcquisition;
  if (acquisition === undefined) return Object.freeze([]);
  switch (acquisition.kind) {
    case 'promoteGodTraitToHeroic': {
      const preferred = promotionTargets(catalog, history, undefined, true);
      return preferred.length > 0 ? preferred : promotionTargets(catalog, history, source, false);
    }
    case 'upgradeHammerToRank2':
      return upgradableHammerTargetKeys(catalog, history);
  }
}

/** Latest Model's frozen Rank-I pool and its acquisition-ordinal draw count. */
export function latestModelTargetDomain(
  catalog: Catalog,
  sourceTraitKey: string,
  history: TraitHistoryState,
  acquisitionOrdinal: number,
): { readonly targetTraitKeys: readonly string[]; readonly requiredCount: number } {
  const acquisition = catalog.traits.byKey[sourceTraitKey]?.targetedAcquisition;
  if (
    acquisition?.kind !== 'upgradeHammerToRank2' ||
    !Number.isInteger(acquisitionOrdinal) ||
    acquisitionOrdinal < 1 ||
    acquisitionOrdinal > 4
  )
    throw new Error('Latest Model requires an explicit acquisition ordinal');
  const targetTraitKeys = selectedTargetedAcquisitionTargetKeys(
    catalog,
    { traitKey: sourceTraitKey },
    history,
  );
  return Object.freeze({
    targetTraitKeys,
    requiredCount: Math.min(
      acquisition.targetCountByAcquisitionOrdinal[acquisitionOrdinal - 1]!,
      targetTraitKeys.length,
    ),
  });
}

import type { Catalog, TraitDeclaration, TraitRequirementExpression } from '../../catalog-schema';
import type { LevelResolutionAddress } from '../../authored-project/addresses';
import type { AuthoredLevelResolution } from '../../authored-project/traits/state';
export type { TraitFindingCode } from '../model';
import {
  hasEffectiveInRunUpgrade,
  isInRunRarityBlocked,
  isPomUpgradeTarget,
  nextRarity,
} from './history/upgrades';
import { foldTraitHistoryEvents } from './history/fold';
import type { TraitHistoryState, TraitLevelMutationEvent } from './history/model';
import type { TraitAssessmentFinding, TraitOfferContext } from './offer-domain';
