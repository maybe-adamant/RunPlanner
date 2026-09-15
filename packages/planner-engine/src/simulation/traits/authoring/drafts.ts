import type { Catalog } from '../../../catalog-schema';
import type {
  AuthoredTraitOffer,
  AuthoredTraitOfferTraits,
  AuthoredTraitOption,
} from '../../../authored-project/traits/state';
import { optionIndex, TRAIT_OPTION_KEYS } from '../../../authored-project/traits/state';
import { createDefaultAuthoredHexTree } from '../../../authored-project/traits/hex-tree';
import type { TraitHistoryState } from '../history/model';
import { targetedAcquisitionTargetKeys } from '../level-effects';
import { assessTraitOffer, traitCandidates, traitOfferGenerationInput } from './assessment';
import { initialOfferStartingOptions } from './initial-composition';
import {
  assessTraitOfferComposition,
  type TraitCandidateAssessment,
  type TraitOfferContext,
} from '../offer-domain';

function ordinaryStartingOutcome(
  catalog: Catalog,
  giverKey: string,
  history: TraitHistoryState,
  context: TraitOfferContext,
): AuthoredTraitOffer | undefined {
  const options = initialOfferStartingOptions(
    traitOfferGenerationInput(catalog, giverKey, history, context),
  );
  if (options === undefined) return undefined;
  if (options.length === 0) return Object.freeze({ kind: 'fallbackGold' as const, giverKey });
  const selectedIndex = options.findIndex((option) => {
    const trait = catalog.traits.byKey[option.traitKey];
    return !(
      (trait?.targetedAcquisition !== undefined &&
        targetedAcquisitionTargetKeys(catalog, option.traitKey, history).length > 0) ||
      trait?.selectedDisposition.kind === 'circe'
    );
  });
  return Object.freeze({
    kind: 'traits' as const,
    giverKey,
    options: Object.freeze(
      options.map((option) => candidateToOption(option)),
    ) as AuthoredTraitOfferTraits['options'],
    selectedOptionKey: TRAIT_OPTION_KEYS[Math.max(0, selectedIndex)]!,
    rarificationActions: Object.freeze([]),
  });
}

function fixedTraitOfferStartingDraft(
  catalog: Catalog,
  giverKey: string,
  history: TraitHistoryState,
  context: TraitOfferContext = {},
): AuthoredTraitOfferTraits | undefined {
  const giver = catalog.traitGivers.byKey[giverKey];
  if (giver === undefined) return undefined;
  const allCandidates = traitCandidates(catalog, giverKey, history, context).filter(
    (candidate) => candidate.available,
  );
  const variants = automaticDraftCandidates(allCandidates);
  const selfContained = selfContainedDraftCandidates(catalog, variants, history);
  const chosen = fixedStartingCandidates(variants, selfContained);
  if (chosen.length !== 3) return undefined;
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
    assessTraitOfferComposition(catalog, completeDraft).legal &&
    assessTraitOffer(catalog, completeDraft, history, context).every(
      (assessment) => assessment.legal,
    );
  if (accepted) return completeDraft;
  return undefined;
}

/** Valid initial outcome, including the native empty terminal Gold branch. */
export function traitOfferStartingOutcome(
  catalog: Catalog,
  giverKey: string,
  history: TraitHistoryState,
  context: TraitOfferContext = {},
): AuthoredTraitOffer | undefined {
  const giver = catalog.traitGivers.byKey[giverKey];
  if (giver?.providerKind === 'olympian' || giver?.providerKind === 'hermes')
    return ordinaryStartingOutcome(catalog, giverKey, history, context);
  const traits = fixedTraitOfferStartingDraft(catalog, giverKey, history, context);
  if (traits !== undefined) return traits;
  return undefined;
}

/** Returns one exact supported draft with the next materialized option appended. */
function appendTraitOfferOption(
  catalog: Catalog,
  draft: AuthoredTraitOfferTraits,
  history: TraitHistoryState,
  context: TraitOfferContext = {},
): AuthoredTraitOfferTraits | undefined {
  if (draft.options.length >= 3) return undefined;
  const giver = catalog.traitGivers.byKey[draft.giverKey];
  if (giver === undefined) return undefined;
  const offered = new Set(draft.options.map((option) => option.traitKey));
  const candidate = automaticDraftCandidates(
    traitCandidates(catalog, draft.giverKey, history, context).filter(
      (entry) => entry.available && !offered.has(entry.traitKey),
    ),
  )[0];
  return candidate === undefined
    ? undefined
    : Object.freeze({
        ...draft,
        options: Object.freeze([
          ...draft.options,
          candidateToOption(candidate),
        ]) as AuthoredTraitOfferTraits['options'],
      });
}

/** Structural ordinary-offer append.  It intentionally permits repairable,
 * composition-invalid drafts and is the sole Gold-to-traits transition. */
export function appendTraitOfferDraft(
  catalog: Catalog,
  value: AuthoredTraitOffer,
  history: TraitHistoryState,
  context: TraitOfferContext = {},
): AuthoredTraitOfferTraits | undefined {
  const giver = catalog.traitGivers.byKey[value.giverKey];
  if (giver?.providerKind !== 'olympian' && giver?.providerKind !== 'hermes') return undefined;
  if (value.kind === 'traits') return appendTraitOfferOption(catalog, value, history, context);
  const candidate = automaticDraftCandidates(
    traitCandidates(catalog, value.giverKey, history, context).filter((entry) => entry.available),
  )[0];
  return candidate === undefined ? undefined : traitDraft(value.giverKey, [candidate]);
}

/** Structural ordinary-offer removal.  Removing the final row is Gold. */
export function removeTraitOfferDraft(
  catalog: Catalog,
  value: AuthoredTraitOfferTraits,
): AuthoredTraitOffer | undefined {
  const giver = catalog.traitGivers.byKey[value.giverKey];
  if (giver?.providerKind !== 'olympian' && giver?.providerKind !== 'hermes') return undefined;
  if (value.options.length <= 1)
    return Object.freeze({ kind: 'fallbackGold' as const, giverKey: value.giverKey });
  const options = Object.freeze(value.options.slice(0, -1)) as AuthoredTraitOfferTraits['options'];
  const selectedOptionKey =
    TRAIT_OPTION_KEYS[Math.min(optionIndex(value.selectedOptionKey), options.length - 1)]!;
  const residual = value.concaveStoneResult;
  const clearsResidual =
    residual?.kind === 'proc' &&
    (optionIndex(residual.optionKey) >= options.length || residual.optionKey === selectedOptionKey);
  const { concaveStoneResult: _concaveStoneResult, ...withoutResidual } = value;
  void _concaveStoneResult;
  return Object.freeze({
    ...(clearsResidual ? withoutResidual : value),
    options,
    selectedOptionKey,
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

function candidateToOption(
  candidate: Pick<TraitCandidateAssessment, 'traitKey' | 'rarity'>,
): AuthoredTraitOption {
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
