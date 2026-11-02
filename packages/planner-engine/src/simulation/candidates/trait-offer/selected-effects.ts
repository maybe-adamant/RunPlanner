import type { Catalog } from '../../../catalog-schema';
import {
  unsatisfiedRandomArcanaRequirementKeys,
  TEMPORARY_ARCANA_RARITY,
  PROMOTED_ARCANA_RARITY,
} from '../../arcana-fear';
import { optionIndex } from '../../../authored-project/traits/state';
import type { ProjectDocument } from '../../../authored-project/model';
import type { TraitOfferCandidateArtifacts, TraitOfferCandidateCapability } from './capability';
import type { NaturalSelectionTargetAssessment } from '../../traits';
import type { ProjectEvaluation } from '../../evaluation/evaluation-products';
import type {
  AllTogetherSetDomainEvaluation,
  AllTogetherSetDomainQuery,
  CirceResolutionDomainEvaluation,
  CirceResolutionDomainQuery,
  EchoLastRunBoonDomainEvaluation,
  EchoLastRunBoonDomainQuery,
  EchoPomTargetDomainEvaluation,
  EchoPomTargetDomainQuery,
  EvaluatedDirectTraitOutcomeCandidate,
  NaturalSelectionDraftShape,
  NaturalSelectionResultCandidateEvaluation,
  NaturalSelectionResultCandidateQuery,
  RansomAssessmentCandidateEvaluation,
  RansomAssessmentCandidateQuery,
} from './query';
import { unavailableForTraitOffer } from './availability';

export function evaluateCirceResolutionDomain(
  catalog: Catalog,
  _project: ProjectDocument,
  evaluation: ProjectEvaluation,
  candidateArtifacts: TraitOfferCandidateArtifacts | undefined,
  query: CirceResolutionDomainQuery,
): CirceResolutionDomainEvaluation {
  const capability = candidateArtifacts?.at(query.trait);
  if (capability === undefined) return unavailableForTraitOffer(evaluation, query.trait);
  const value = capability.circeResolution(query.value, query.optionKey);
  if (value === undefined) return unavailableForTraitOffer(evaluation, query.trait);
  const option =
    query.value.kind === 'traits' ? query.value.options[optionIndex(query.optionKey)] : undefined;
  const selectedArcanaKeys =
    option?.circeResolution?.kind === 'activateArcana' ||
    option?.circeResolution?.kind === 'promoteArcana'
      ? option.circeResolution.arcanaKeys
      : Object.freeze([]);
  const selectedVowKeys =
    option?.circeResolution?.kind === 'disableFear'
      ? option.circeResolution.vowKeys
      : Object.freeze([]);
  const arcanaDomain =
    value.effect !== 'activateArcana'
      ? value.arcanaKeys
      : Object.freeze(
          value.arcanaKeys.filter(
            (key) =>
              unsatisfiedRandomArcanaRequirementKeys(catalog, value.activeArcanaKeys, [
                ...selectedArcanaKeys,
                key,
              ]).length === 0,
          ),
        );
  const arcanaKeys = catalog.arcanaCards.values
    .map((card) => card.key)
    .filter((key) => selectedArcanaKeys.includes(key) || arcanaDomain.includes(key));
  const vowKeys = catalog.fearVows.values
    .map((vow) => vow.key)
    .filter((key) => value.vowKeys.includes(key) || selectedVowKeys.includes(key));
  return Object.freeze({
    kind: 'circeResolutionDomain',
    result: Object.freeze({
      effect: value.effect,
      activeArcana: value.activeArcana,
      resultRarity:
        value.effect === 'disableFear'
          ? null
          : value.effect === 'promoteArcana'
            ? PROMOTED_ARCANA_RARITY
            : TEMPORARY_ARCANA_RARITY,
      requiredCount: value.requiredCount,
      arcanaCandidates: outcomeCandidates(
        arcanaKeys,
        arcanaDomain,
        (key) => selectedArcanaKeys.includes(key),
        value.requiredCount,
      ),
      vowCandidates: outcomeCandidates(
        vowKeys,
        value.vowKeys,
        (key) => selectedVowKeys.includes(key),
        value.requiredCount,
      ),
      outerAvailable: value.outerAvailable,
    }),
  });
}

export function evaluateEchoPomTargetDomain(
  catalog: Catalog,
  _project: ProjectDocument,
  evaluation: ProjectEvaluation,
  candidateArtifacts: TraitOfferCandidateArtifacts | undefined,
  query: EchoPomTargetDomainQuery,
): EchoPomTargetDomainEvaluation {
  const capability = candidateArtifacts?.at(query.trait);
  if (capability === undefined) return unavailableForTraitOffer(evaluation, query.trait);
  const value = capability.echoPomTargets(query.value, query.optionKey);
  if (value === undefined) return unavailableForTraitOffer(evaluation, query.trait);
  const option =
    query.value.kind === 'traits' ? query.value.options[optionIndex(query.optionKey)] : undefined;
  const selected =
    option !== undefined && 'echoPomTarget' in option ? option.echoPomTarget : undefined;
  const traitKeys: string[] = catalog.traits.values
    .map((trait) => trait.key)
    .filter((key) => value.includes(key) || selected === key);
  const candidates = outcomeCandidates<string | null>(
    [...traitKeys, ...(value.length === 0 || selected === null ? [null] : [])],
    Object.freeze([
      ...(value as readonly (string | null)[]),
      ...(value.length === 0 ? [null] : []),
    ]),
    (candidate) => candidate === selected,
    1,
  );
  return Object.freeze({
    kind: 'echoPomTargetDomain',
    result: Object.freeze({
      candidates,
      emptyNoOpAllowed: candidates.some(
        (candidate) => candidate.value === null && candidate.support !== 'impossible',
      ),
    }),
  });
}

function naturalSelectionDraftShape(
  assessment: NaturalSelectionTargetAssessment,
): NaturalSelectionDraftShape {
  return Object.freeze({
    firstPassRows: assessment.firstPassRows,
    ...(assessment.completedTargets === undefined
      ? {}
      : {
          completedTargets: assessment.completedTargets,
          levelCountsByTraitKey: assessment.levelCountsByTraitKey,
        }),
  });
}

export function evaluateNaturalSelectionResultCandidate(
  _catalog: Catalog,
  _project: ProjectDocument,
  evaluation: ProjectEvaluation,
  candidateArtifacts: TraitOfferCandidateArtifacts | undefined,
  query: NaturalSelectionResultCandidateQuery,
): NaturalSelectionResultCandidateEvaluation {
  const capability = candidateArtifacts?.at(query.result.trait);
  if (capability === undefined) return unavailableForTraitOffer(evaluation, query.result.trait);
  const selected =
    query.value.kind === 'traits'
      ? query.value.options[optionIndex(query.result.optionKey)]
      : undefined;
  const disposition =
    selected === undefined
      ? undefined
      : _catalog.traits.byKey[selected.traitKey]?.selectedDisposition;
  if (disposition?.kind !== 'naturalSelection')
    return unavailableForTraitOffer(evaluation, query.result.trait);
  const assessment = capability.naturalSelectionTargets(
    query.value,
    query.result.optionKey,
    disposition.levelCount,
    disposition.slots,
    query.targets,
  );
  if (assessment === undefined) return unavailableForTraitOffer(evaluation, query.result.trait);
  const supported = assessment.legal && assessment.complete;
  return Object.freeze({
    kind: 'naturalSelectionResult',
    result: Object.freeze({
      supported,
      complete: assessment.complete,
      nextTargetTraitKeys: assessment.nextTargetTraitKeys,
      ...naturalSelectionDraftShape(assessment),
      findings: Object.freeze(
        supported
          ? []
          : [
              Object.freeze({
                code:
                  query.targets === undefined
                    ? ('naturalSelectionResultMissing' as const)
                    : ('naturalSelectionResultUnavailable' as const),
                detail: assessment.legal ? 'incomplete' : 'unavailable',
              }),
            ],
      ),
    }),
  });
}

export function evaluateRansomAssessmentCandidate(
  _catalog: Catalog,
  _project: ProjectDocument,
  evaluation: ProjectEvaluation,
  candidateArtifacts: TraitOfferCandidateArtifacts | undefined,
  query: RansomAssessmentCandidateQuery,
): RansomAssessmentCandidateEvaluation {
  const assessment = candidateArtifacts?.at(query.trait)?.ransom(query.value);
  if (assessment === undefined) return unavailableForTraitOffer(evaluation, query.trait);
  return Object.freeze({ kind: 'ransomAssessment', result: Object.freeze({ assessment }) });
}

export function evaluateEchoLastRunBoonDomain(
  _catalog: Catalog,
  _project: ProjectDocument,
  evaluation: ProjectEvaluation,
  candidateArtifacts: TraitOfferCandidateArtifacts | undefined,
  query: EchoLastRunBoonDomainQuery,
): EchoLastRunBoonDomainEvaluation {
  const capability = candidateArtifacts?.at(query.trait);
  if (capability === undefined) return unavailableForTraitOffer(evaluation, query.trait);
  const outcomes = capability.echoLastRunBoon(query.value, query.optionKey);
  if (outcomes === undefined) return unavailableForTraitOffer(evaluation, query.trait);
  const candidates = Object.freeze(
    outcomes.map((outcome) => {
      const candidate = outcomes.find(
        (entry) =>
          entry.option.giverKey === outcome.option.giverKey &&
          entry.option.traitKey === outcome.option.traitKey &&
          entry.option.rarity === outcome.option.rarity,
      )!;
      const targeted = _catalog.traits.byKey[outcome.option.traitKey]?.targetedAcquisition;
      const legal =
        candidate.assessment.legal &&
        (targeted === undefined || candidate.targetTraitKeys.length > 0);
      const retainedTarget =
        query.value.kind === 'traits'
          ? query.value.options[optionIndex(query.optionKey)]?.echoLastRunBoon?.options.find(
              (option) =>
                option.giverKey === outcome.option.giverKey &&
                option.traitKey === outcome.option.traitKey &&
                option.rarity === outcome.option.rarity,
            )?.targetTraitKey
          : undefined;
      const targetTraitKeys = [...new Set(candidate.targetTraitKeys)];
      if (retainedTarget !== undefined && !targetTraitKeys.includes(retainedTarget))
        targetTraitKeys.push(retainedTarget);
      const effectiveRarity = candidate.effectiveRarity;
      const supported = legal && effectiveRarity !== undefined;
      return Object.freeze({
        option: outcome.option,
        ...(effectiveRarity === undefined ? {} : { effectiveRarity }),
        ...(outcome.effectiveLevel === undefined ? {} : { effectiveLevel: outcome.effectiveLevel }),
        support: supported ? ('possible' as const) : ('impossible' as const),
        ...(supported ? {} : { reason: 'unavailable' as const }),
        targetRequired: targeted !== undefined,
        targetCandidates: outcomeCandidates(
          targetTraitKeys,
          candidate.assessment.legal ? candidate.targetTraitKeys : [],
          (traitKey) => traitKey === retainedTarget,
          1,
        ),
      });
    }),
  );
  const child =
    query.value.kind === 'traits'
      ? query.value.options[optionIndex(query.optionKey)]?.echoLastRunBoon
      : undefined;
  const selectedChild =
    child === undefined ? undefined : child.options[optionIndex(child.selectedOptionKey)];
  const selectedDisposition =
    selectedChild === undefined
      ? undefined
      : _catalog.traits.byKey[selectedChild.traitKey]?.selectedDisposition;
  const selectedCarrier = (() => {
    if (selectedChild === undefined || selectedDisposition === undefined) return undefined;
    if (selectedDisposition.kind === 'directTraitSets') {
      const nestedOffer = Object.freeze({
        kind: 'traits' as const,
        giverKey: selectedChild.giverKey,
        options: Object.freeze([
          Object.freeze({
            traitKey: selectedChild.traitKey,
            rarity: selectedChild.rarity,
            ...(selectedChild.allTogetherResult === undefined
              ? {}
              : { allTogetherResult: selectedChild.allTogetherResult }),
          }),
        ]) as import('../../../authored-project/traits/state').AuthoredTraitOfferTraits['options'],
        selectedOptionKey: 'option1' as const,
        rarificationActions: Object.freeze([]),
      });
      const evaluatedSets = selectedDisposition.sets.map((set) =>
        allTogetherSetResult(_catalog, capability, nestedOffer, 'option1', set.key),
      );
      if (!evaluatedSets.every((set): set is NonNullable<typeof set> => set !== undefined))
        return undefined;
      const sets = Object.freeze(evaluatedSets);
      return Object.freeze({
        kind: 'allTogether' as const,
        complete:
          selectedChild.allTogetherResult !== undefined &&
          sets.every((set) =>
            set.candidates.some(
              (candidate) => candidate.selected && candidate.support !== 'impossible',
            ),
          ),
        sets,
      });
    }
    if (selectedDisposition.kind === 'naturalSelection') {
      const assessment = capability.naturalSelectionTargets(
        query.value,
        query.optionKey,
        selectedDisposition.levelCount,
        selectedDisposition.slots,
        selectedChild.naturalSelectionTargets,
      );
      if (assessment === undefined) return undefined;
      const nextKeys = [...new Set(assessment.nextTargetTraitKeys)];
      return Object.freeze({
        kind: 'naturalSelection' as const,
        slotCount: selectedDisposition.levelCount,
        complete: assessment.complete,
        supported: assessment.legal,
        ...naturalSelectionDraftShape(assessment),
        nextTargetCandidates: outcomeCandidates(
          nextKeys,
          assessment.nextTargetTraitKeys,
          () => false,
          1,
        ),
      });
    }
    return undefined;
  })();
  return Object.freeze({
    kind: 'echoLastRunBoonDomain',
    result: Object.freeze({
      candidates,
      ...(selectedCarrier === undefined ? {} : { selectedCarrier }),
    }),
  });
}

function allTogetherSetResult(
  catalog: Catalog,
  capability: TraitOfferCandidateCapability,
  value: import('../../../authored-project/traits/state').AuthoredTraitOfferTraits,
  optionKey: import('../../../authored-project/traits/state').TraitOptionKey,
  setKey: import('../../../catalog-schema').DirectTraitSetKey,
) {
  const domain = capability.allTogetherSet(value, optionKey, setKey);
  if (domain === undefined) return undefined;
  const option = value.options[optionIndex(optionKey)];
  const selected = option?.allTogetherResult?.[setKey];
  const declaration = option === undefined ? undefined : catalog.traits.byKey[option.traitKey];
  const set =
    declaration?.selectedDisposition.kind === 'directTraitSets'
      ? declaration.selectedDisposition.sets.find((candidate) => candidate.key === setKey)
      : undefined;
  const values: (string | null)[] = [
    ...(set?.traitKeys ?? []),
    ...(domain.includes(null) || selected === null ? [null] : []),
  ].filter(
    (candidate, index, all) =>
      all.indexOf(candidate) === index && (domain.includes(candidate) || candidate === selected),
  );
  return Object.freeze({
    setKey,
    candidates: outcomeCandidates(values, domain, (candidate) => candidate === selected, 1),
  });
}

export function evaluateAllTogetherSetDomain(
  catalog: Catalog,
  _project: ProjectDocument,
  evaluation: ProjectEvaluation,
  candidateArtifacts: TraitOfferCandidateArtifacts | undefined,
  query: AllTogetherSetDomainQuery,
): AllTogetherSetDomainEvaluation {
  const capability = candidateArtifacts?.at(query.trait);
  if (capability === undefined) return unavailableForTraitOffer(evaluation, query.trait);
  if (query.value.kind !== 'traits') return unavailableForTraitOffer(evaluation, query.trait);
  const result = allTogetherSetResult(
    catalog,
    capability,
    query.value,
    query.optionKey,
    query.setKey,
  );
  if (result === undefined) return unavailableForTraitOffer(evaluation, query.trait);
  return Object.freeze({
    kind: 'allTogetherSetDomain',
    result,
  });
}

/** Each value's support in the one reached domain; a domain no larger than the count forces it. */
function outcomeCandidates<T>(
  values: readonly T[],
  domain: readonly T[],
  selected: (value: T) => boolean,
  requiredCount: number,
): readonly EvaluatedDirectTraitOutcomeCandidate<T>[] {
  return Object.freeze(
    values.map((value) => {
      const supported = domain.some((candidate) => Object.is(candidate, value));
      const forced = supported && requiredCount > 0 && domain.length <= requiredCount;
      return Object.freeze({
        value,
        support: forced
          ? ('forced' as const)
          : supported
            ? ('possible' as const)
            : ('impossible' as const),
        selected: selected(value),
        ...(supported ? {} : { reason: 'unavailable' as const }),
      });
    }),
  );
}
