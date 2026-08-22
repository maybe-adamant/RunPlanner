import {
  optionIndex,
  type AuthoredTraitOffer,
  type AuthoredTraitOption,
  type TraitOptionKey,
} from '@run-planner/engine/authored-project';
import type {
  Catalog,
  TraitGiverDeclaration,
  TraitRarity,
} from '@run-planner/engine/catalog-schema';

import {
  candidateSupport,
  type CandidateOptionProjection,
  type CandidateProjectionEvaluation,
} from './candidateProjection';
import type { ContextualPickerModel, ContextualPickerProjectionService } from './contextualPicker';
import { explainCandidateEvaluation, type CandidateExplanation } from './contextualOptions';
import { presentTraitCandidateFinding } from './evaluationProjection';

export interface PreparedTraitOptionDomain {
  readonly optionKey: TraitOptionKey;
  readonly variants: readonly AuthoredTraitOption[];
}

type TraitCandidate = CandidateOptionProjection<AuthoredTraitOption, CandidateProjectionEvaluation>;

export interface TraitOptionDomainProjection {
  readonly candidates: readonly CandidateOptionProjection<
    AuthoredTraitOption,
    CandidateProjectionEvaluation
  >[];
  readonly preferredOptionFor: (traitKey: string) => AuthoredTraitOption | undefined;
  readonly rarityPickerFor: (traitKey: string) => ContextualPickerModel<TraitRarity> | undefined;
  readonly targetPicker?: ContextualPickerModel<string>;
  readonly traitPicker: ContextualPickerModel<string>;
}

export interface TraitDomainProjectionService {
  readonly prepare: (
    giver: TraitGiverDeclaration,
    draft: AuthoredTraitOffer,
    optionKey: TraitOptionKey,
  ) => PreparedTraitOptionDomain;
  readonly project: (
    giver: TraitGiverDeclaration,
    draft: AuthoredTraitOffer,
    prepared: PreparedTraitOptionDomain,
    candidates: readonly TraitCandidate[],
    targetCandidates?: readonly CandidateOptionProjection<string, CandidateProjectionEvaluation>[],
  ) => TraitOptionDomainProjection;
}

function sameOption(left: AuthoredTraitOption, right: AuthoredTraitOption): boolean {
  return (
    left.traitKey === right.traitKey &&
    left.rarity === right.rarity &&
    left.targetTraitKey === right.targetTraitKey
  );
}

function appendUnique(
  options: readonly AuthoredTraitOption[],
  option: AuthoredTraitOption,
): readonly AuthoredTraitOption[] {
  return options.some((candidate) => sameOption(candidate, option))
    ? options
    : Object.freeze([...options, Object.freeze({ ...option })]);
}

/**
 * Builds only declaration- and authored-schema-compatible concrete variants.
 * It is deliberately structural: candidate work stays behind the lazy bound
 * workspace interaction that consumes this prepared domain.
 */
export function prepareTraitOptionDomain(
  catalog: Catalog,
  giver: TraitGiverDeclaration,
  draft: AuthoredTraitOffer,
  focusedOptionKey: TraitOptionKey,
): PreparedTraitOptionDomain {
  if (draft.kind !== 'traits') throw new Error('This offer has no ordinary trait option domain');
  let variants: readonly AuthoredTraitOption[] = Object.freeze([]);
  for (const traitKey of giver.traitKeys) {
    const trait = catalog.traits.byKey[traitKey];
    if (trait === undefined) {
      throw new Error(`Trait giver ${giver.key} references unknown trait ${traitKey}`);
    }
    if (trait.rarityDomain.kind === 'none') {
      variants = appendUnique(variants, Object.freeze({ traitKey }));
      continue;
    }
    for (const rarity of trait.rarityDomain.equippedRarities) {
      variants = appendUnique(variants, Object.freeze({ traitKey, rarity }));
    }
  }
  const selected = draft.options[optionIndex(focusedOptionKey)];
  if (selected === undefined) {
    throw new Error(`Trait offer is missing ${focusedOptionKey}`);
  }
  return Object.freeze({
    optionKey: focusedOptionKey,
    variants: appendUnique(variants, selected),
  });
}

function optionState(option: TraitCandidate): ReturnType<typeof candidateSupport> {
  return candidateSupport(option);
}

function visibleCandidate(candidate: TraitCandidate, selected: AuthoredTraitOption): boolean {
  if (candidate.value.rarity !== 'Heroic') return true;
  // Heroic is a technical probe unless it is the retained authored value or
  // the engine proves an exact Epic-to-Heroic replacement.
  return (
    sameOption(candidate.value, selected) || ['possible', 'forced'].includes(optionState(candidate))
  );
}

function candidateExplanation(
  catalog: Catalog,
  evaluation: CandidateProjectionEvaluation,
  traitLabel: (traitKey: string) => string,
): CandidateExplanation | undefined {
  if (evaluation.kind === 'encounter') return undefined;
  if (evaluation.kind === 'traitAcquisitionTarget') {
    if (evaluation.result.supported) return undefined;
    const finding = evaluation.result.findings[0];
    if (finding === undefined) return undefined;
    const copy = presentTraitCandidateFinding(finding.code);
    return Object.freeze({ kind: 'trait', message: `${copy.title}: ${copy.description}` });
  }
  if (evaluation.kind !== 'traitOfferFocusedOption') {
    return explainCandidateEvaluation(catalog, evaluation);
  }
  // Focused support is an aggregate across retained branches. Blocking
  // evidence from a losing branch must not decorate an available choice.
  if (evaluation.result.supported) return undefined;
  const blocking = evaluation.result.evidence.find((entry) => entry.blocksFocusedOption);
  if (blocking === undefined) return undefined;
  const finding = blocking.finding;
  const copy = presentTraitCandidateFinding(finding.code);
  const requirements = finding.requirementTraitKeys?.map(traitLabel) ?? [];
  if (requirements.length > 0) {
    const alternatives =
      requirements.length === 1
        ? requirements[0]!
        : requirements.length === 2
          ? `${requirements[0]} or ${requirements[1]}`
          : `${requirements.slice(0, -1).join(', ')}, or ${requirements.at(-1)}`;
    if (finding.code === 'missingPrerequisite') {
      return Object.freeze({
        kind: 'trait',
        message: `${copy.title}: Requires one of ${alternatives}.`,
      });
    }
    if (finding.code === 'negativePrerequisite') {
      return Object.freeze({
        kind: 'trait',
        message: `${copy.title}: Cannot be equipped alongside ${alternatives}.`,
      });
    }
  }
  if (finding.code === 'duplicateOfferedTrait' && finding.traitKey !== undefined) {
    return Object.freeze({
      kind: 'trait',
      message: `${traitLabel(finding.traitKey)} is already offered in another option.`,
    });
  }
  return Object.freeze({ kind: 'trait', message: `${copy.title}: ${copy.description}` });
}

function representativeCandidate(
  candidates: readonly TraitCandidate[],
): TraitCandidate | undefined {
  return (
    candidates.find((candidate) => {
      const support = optionState(candidate);
      return support === 'forced' || support === 'possible';
    }) ??
    candidates.find((candidate) => optionState(candidate) === 'unavailable') ??
    candidates[0]
  );
}

function traitCandidates(
  giver: TraitGiverDeclaration,
  candidates: readonly TraitCandidate[],
): readonly CandidateOptionProjection<string, CandidateProjectionEvaluation>[] {
  return Object.freeze(
    giver.traitKeys.flatMap((traitKey) => {
      const representative = representativeCandidate(
        candidates.filter((candidate) => candidate.value.traitKey === traitKey),
      );
      return representative === undefined
        ? []
        : [Object.freeze({ value: traitKey, evaluation: representative.evaluation })];
    }),
  );
}

function preferredOption(
  candidates: readonly TraitCandidate[],
  current: AuthoredTraitOption,
): AuthoredTraitOption | undefined {
  const exactCurrent = candidates.find((candidate) => sameOption(candidate.value, current));
  if (exactCurrent !== undefined && optionState(exactCurrent) !== 'impossible') {
    return exactCurrent.value;
  }
  const supported = candidates.filter((candidate) => {
    const support = optionState(candidate);
    return support === 'forced' || support === 'possible';
  });
  const retainedRarity = supported.find((candidate) => candidate.value.rarity === current.rarity);
  if (retainedRarity !== undefined) return retainedRarity.value;
  if (supported[0] !== undefined) return supported[0].value;
  const unassessed = candidates.filter((candidate) => optionState(candidate) === 'unavailable');
  const currentUnassessed = unassessed.find((candidate) => sameOption(candidate.value, current));
  return currentUnassessed?.value ?? unassessed[0]?.value;
}

export function createTraitDomainProjection(
  catalog: Catalog,
  contextualPicker: ContextualPickerProjectionService,
): TraitDomainProjectionService {
  const preparedCache = new WeakMap<AuthoredTraitOffer, Map<string, PreparedTraitOptionDomain>>();
  const traitLabel = (traitKey: string): string =>
    catalog.traits.byKey[traitKey]?.label ?? traitKey;
  const service: TraitDomainProjectionService = {
    prepare(giver, draft, focusedOptionKey) {
      let byFocus = preparedCache.get(draft);
      if (byFocus === undefined) {
        byFocus = new Map();
        preparedCache.set(draft, byFocus);
      }
      const cacheKey = `${giver.key}:${focusedOptionKey}`;
      const existing = byFocus.get(cacheKey);
      if (existing !== undefined) return existing;
      const prepared = prepareTraitOptionDomain(catalog, giver, draft, focusedOptionKey);
      byFocus.set(cacheKey, prepared);
      return prepared;
    },
    project(giver, draft, prepared, candidates, targetCandidates) {
      if (draft.kind !== 'traits') throw new Error('Fallback Gold has no trait option domain');
      const selected = draft.options[optionIndex(prepared.optionKey)];
      if (selected === undefined) throw new Error(`Trait offer is missing ${prepared.optionKey}`);
      const visible = Object.freeze(
        candidates.filter((candidate) => visibleCandidate(candidate, selected)),
      );
      const traits = traitCandidates(giver, visible);
      const traitPicker = contextualPicker.project(
        traits,
        (candidate) => {
          const explanation = candidateExplanation(catalog, candidate.evaluation, traitLabel);
          return Object.freeze({
            label: traitLabel(candidate.value),
            selected: candidate.value === selected.traitKey,
            ...(explanation === undefined ? {} : { explanation }),
          });
        },
        (traitKey) => traitKey,
      );
      const rarityModels = new Map<string, ContextualPickerModel<TraitRarity> | undefined>();
      const preferred = new Map<string, AuthoredTraitOption | undefined>();
      const rarityPickerFor = (
        traitKey: string,
      ): ContextualPickerModel<TraitRarity> | undefined => {
        if (rarityModels.has(traitKey)) return rarityModels.get(traitKey);
        const declaration = catalog.traits.byKey[traitKey];
        if (
          declaration?.rarityDomain.kind !== 'ranked' ||
          declaration.rarityDomain.equippedRarities.length <= 1
        ) {
          rarityModels.set(traitKey, undefined);
          return undefined;
        }
        const options = visible.filter((candidate) => candidate.value.traitKey === traitKey);
        const rarityCandidates = Object.freeze(
          options.flatMap((candidate) =>
            candidate.value.rarity === undefined
              ? []
              : [
                  Object.freeze({
                    value: candidate.value.rarity,
                    evaluation: candidate.evaluation,
                  }),
                ],
          ),
        ) as readonly CandidateOptionProjection<TraitRarity, CandidateProjectionEvaluation>[];
        const model = contextualPicker.project<TraitRarity>(
          rarityCandidates,
          (candidate) => {
            const explanation = candidateExplanation(catalog, candidate.evaluation, traitLabel);
            return Object.freeze({
              label: candidate.value,
              selected: selected.traitKey === traitKey && selected.rarity === candidate.value,
              ...(explanation === undefined ? {} : { explanation }),
            });
          },
          (rarity) => rarity,
        );
        rarityModels.set(traitKey, model);
        return model;
      };
      const projection = Object.freeze({
        candidates,
        preferredOptionFor(traitKey: string): AuthoredTraitOption | undefined {
          if (preferred.has(traitKey)) return preferred.get(traitKey);
          const option = preferredOption(
            visible.filter((candidate) => candidate.value.traitKey === traitKey),
            selected,
          );
          preferred.set(traitKey, option);
          return option;
        },
        rarityPickerFor,
        ...(targetCandidates === undefined
          ? {}
          : {
              targetPicker: contextualPicker.project(
                targetCandidates,
                (candidate) => {
                  const explanation = candidateExplanation(
                    catalog,
                    candidate.evaluation,
                    traitLabel,
                  );
                  return Object.freeze({
                    label: traitLabel(candidate.value),
                    selected: candidate.value === selected.targetTraitKey,
                    ...(explanation === undefined ? {} : { explanation }),
                  });
                },
                (traitKey) => traitKey,
              ),
            }),
        traitPicker,
      });
      return projection;
    },
  };
  return Object.freeze(service);
}
