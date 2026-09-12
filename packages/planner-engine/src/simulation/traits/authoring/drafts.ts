import type { Catalog } from '../../../catalog-schema';
import type {
  AuthoredTraitOfferTraits,
  AuthoredTraitOption,
} from '../../../authored-project/traits';
import {
  optionIndex,
  TRAIT_OPTION_KEYS,
  traitOfferSupportsExhaustion,
} from '../../../authored-project/traits';
import { createDefaultAuthoredHexTree } from '../../../authored-project/hex-tree';
import { ordinaryEquippedSlots, type TraitHistoryState } from '../history';
import { targetedAcquisitionTargetKeys } from '../level-effects';
import {
  assessTraitOffer,
  assessTraitOption,
  assessTraitOptionAgainstRarityDomain,
  assessTraitReplacementComposition,
  isOptionalHighTierTrait,
  traitCandidates,
  traitOfferCompositionDomains,
} from './assessment';
import {
  assessTraitOfferComposition,
  assessTraitOfferDomainComposition,
  type TraitCandidateAssessment,
  type TraitOfferCompositionDomains,
  type TraitOfferContext,
  type TraitOfferDomainCompositionResult,
} from '../offer-domain';

function freshVariantsForPrefix(
  catalog: Catalog,
  giverKey: string,
  history: TraitHistoryState,
  context: TraitOfferContext,
  chosenTraitKeys: ReadonlySet<string>,
): readonly TraitCandidateAssessment[] {
  const giver = catalog.traitGivers.byKey[giverKey];
  if (giver === undefined) return Object.freeze([]);
  const firstOlympian =
    giver.providerKind === 'olympian' && Object.keys(ordinaryEquippedSlots(history)).length === 0;
  const identityDomain = firstOlympian ? giver.priorityTraitKeys : giver.traitKeys;
  const identities = identityDomain.filter(
    (traitKey) =>
      !chosenTraitKeys.has(traitKey) &&
      assessTraitOption(catalog, traitKey, history, { ...context, resolvedProviderKey: giverKey })
        .legal,
  );
  const pooled = Object.freeze(
    identities.flatMap((traitKey) => {
      const trait = catalog.traits.byKey[traitKey];
      return trait?.rarityDomain.kind === 'ranked' && !isOptionalHighTierTrait(catalog, traitKey)
        ? trait.rarityDomain.freshOfferRarities
        : [];
    }),
  );
  return Object.freeze(
    identities.flatMap((traitKey) => {
      const trait = catalog.traits.byKey[traitKey];
      if (trait?.rarityDomain.kind !== 'ranked') return [];
      return trait.rarityDomain.freshOfferRarities.flatMap((rarity) => {
        const assessment = assessTraitOptionAgainstRarityDomain(
          catalog,
          traitKey,
          history,
          { ...context, resolvedProviderKey: giverKey },
          rarity,
          firstOlympian || isOptionalHighTierTrait(catalog, traitKey) ? undefined : pooled,
        );
        return assessment.legal
          ? [Object.freeze({ traitKey, rarity, available: true, assessment })]
          : [];
      });
    }),
  );
}

function isOptionalHighTierOption(catalog: Catalog, option: AuthoredTraitOption): boolean {
  return isOptionalHighTierTrait(catalog, option.traitKey);
}

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
    ? selectSelfContainedFirst(
        exhaustionStartingCandidates(
          catalog,
          domains,
          context.replacementRollChance ?? catalog.boonReplacementChance,
        ),
        selfContained,
      )
    : fixedStartingCandidates(variants, selfContained);
  if (chosen.length === 0 || (!traitOfferSupportsExhaustion(giver) && chosen.length !== 3))
    return undefined;
  const draft = traitDraft(giverKey, chosen);
  const completeDraft =
    giver.providerKind === 'spell'
      ? Object.freeze({
          ...draft,
          hexTree: createDefaultAuthoredHexTree(catalog, draft.options[0]!.traitKey),
        })
      : draft;
  // Candidate domains establish leaf legality. Keep the authoritative complete
  // offer checks at this boundary, once, rather than evaluating every variant.
  const accepted =
    assessTraitOfferComposition(catalog, completeDraft, history).legal &&
    assessTraitReplacementComposition(catalog, completeDraft, history, context).legal &&
    assessTraitOffer(catalog, completeDraft, history, context).every(
      (assessment) => assessment.legal,
    );
  if (accepted) return completeDraft;
  // The deterministic legacy seed can select a rarity invalidated by pooled
  // fill. Retry each legal first row through the prefix-aware incremental path.
  for (const seed of selfContained) {
    const one = traitDraft(giverKey, [seed]);
    const two = nextTraitOfferDraft(catalog, one, history, context);
    if (two === undefined) continue;
    const three = nextTraitOfferDraft(catalog, two, history, context);
    if (three !== undefined) return three;
  }
  return undefined;
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
  const staticVariants = automaticDraftCandidates(
    traitOfferSupportsExhaustion(giver)
      ? [...domains.ordinary, ...domains.highTier, ...domains.replacements]
      : traitCandidates(catalog, draft.giverKey, history, context).filter(
          (candidate) => candidate.available,
        ),
  );
  const candidateByKey = new Map(
    staticVariants.map((candidate) => [candidate.traitKey, candidate]),
  );
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
        candidateToOption(candidate),
      ]) as AuthoredTraitOfferTraits['options'],
    });
  const canComplete = (current: AuthoredTraitOfferTraits): boolean => {
    if (
      assessTraitOffer(catalog, current, history, context).some((assessment) => !assessment.legal)
    )
      return false;
    const offered = new Set(current.options.map((option) => option.traitKey));
    const positionVariants = Object.freeze([
      ...freshVariantsForPrefix(catalog, draft.giverKey, history, context, offered),
      ...staticVariants.filter(
        (candidate) =>
          !offered.has(candidate.traitKey) &&
          candidate.assessment.replacementTransition !== undefined,
      ),
    ]);
    if (!traitOfferSupportsExhaustion(giver)) {
      return current.options.length === 3
        ? true
        : new Set(positionVariants.map((candidate) => candidate.traitKey)).size >=
            3 - current.options.length;
    }
    const composition = assessDraftDomainComposition(
      current,
      domains,
      context.replacementRollChance ?? catalog.boonReplacementChance,
    );
    if (composition.legal) return assessTraitOfferComposition(catalog, current, history).legal;
    if (current.options.length >= 3) return false;
    return positionVariants.some((candidate) => canComplete(append(current, candidate)));
  };
  const offered = new Set(draft.options.map((option) => option.traitKey));
  const appendCandidates = Object.freeze([
    ...freshVariantsForPrefix(catalog, draft.giverKey, history, context, offered),
    ...staticVariants.filter(
      (candidate) =>
        !offered.has(candidate.traitKey) &&
        candidate.assessment.replacementTransition !== undefined,
    ),
  ]);
  for (const candidate of appendCandidates) {
    const next = append(draft, candidate);
    if (canComplete(next)) return next;
  }
  return undefined;
}

export function nextOptionalHighTierTraitOfferDraft(
  catalog: Catalog,
  draft: AuthoredTraitOfferTraits,
  history: TraitHistoryState,
  context: TraitOfferContext = {},
): AuthoredTraitOfferTraits | undefined {
  const next = nextTraitOfferDraft(catalog, draft, history, context);
  if (next === undefined || next.options.length !== draft.options.length + 1) return undefined;
  const appended = next.options.at(draft.options.length);
  return appended !== undefined && isOptionalHighTierOption(catalog, appended) ? next : undefined;
}

/** Removes only a trailing optional Duo/Legendary outcome; candidate assessment owns legality. */
export function previousOptionalHighTierTraitOfferDraft(
  catalog: Catalog,
  draft: AuthoredTraitOfferTraits,
): AuthoredTraitOfferTraits | undefined {
  if (draft.options.length <= 1) return undefined;
  const removed = draft.options.at(-1);
  if (removed === undefined || !isOptionalHighTierOption(catalog, removed)) return undefined;
  const options = Object.freeze(draft.options.slice(0, -1)) as AuthoredTraitOfferTraits['options'];
  const selectedIndex = optionIndex(draft.selectedOptionKey);
  return Object.freeze({
    ...draft,
    options,
    selectedOptionKey: TRAIT_OPTION_KEYS[Math.min(selectedIndex, options.length - 1)]!,
  });
}

function traitDraft(
  giverKey: string,
  candidates: readonly TraitCandidateAssessment[],
): AuthoredTraitOfferTraits {
  return Object.freeze({
    kind: 'traits',
    giverKey,
    options: Object.freeze(
      candidates.map(candidateToOption),
    ) as AuthoredTraitOfferTraits['options'],
    selectedOptionKey: 'option1',
    rarificationActions: Object.freeze([]),
  });
}

/** Deterministic representative of the O/H/R contract for a fresh draft. */
function exhaustionStartingCandidates(
  catalog: Catalog,
  domains: TraitOfferCompositionDomains,
  replacementRollChance: number,
): readonly TraitCandidateAssessment[] {
  const ordinary = automaticDraftCandidates(domains.ordinary);
  const highTier = automaticDraftCandidates(domains.highTier);
  const replacements = automaticDraftCandidates(domains.replacements);
  if (replacementRollChance === 1 && replacements.length > 0) {
    const replacement = replacements[0]!;
    const remainder = [...ordinary, ...highTier, ...replacements.slice(1)].slice(0, 2);
    return [replacement, ...remainder];
  }
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
  const slot = catalog.traits.byKey[traitKey]?.equipmentSlot;
  return slot === 'Melee' || slot === 'Secondary';
}

function assessDraftDomainComposition(
  draft: AuthoredTraitOfferTraits,
  domains: TraitOfferCompositionDomains,
  replacementRollChance: number,
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
    replacementRollChance,
  });
}

function candidateToOption(candidate: TraitCandidateAssessment): AuthoredTraitOption {
  return Object.freeze({
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
