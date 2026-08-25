import type { Catalog } from '../../catalog-schema';
import { optionIndex } from '../../authored-project/traits';
import type { ProjectDocument } from '../../authored-project/model';
import type { TraitOfferCandidateArtifacts } from './trait-offer-capability';
import type { ProjectEvaluation } from '../project';
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
  NaturalSelectionResultCandidateEvaluation,
  NaturalSelectionResultCandidateQuery,
  RansomAssessmentCandidateEvaluation,
  RansomAssessmentCandidateQuery,
} from './trait-offer';
import { unavailableForTraitOffer } from './trait-offer-availability';

export function evaluateCirceResolutionDomain(
  catalog: Catalog,
  _project: ProjectDocument,
  evaluation: ProjectEvaluation,
  candidateArtifacts: TraitOfferCandidateArtifacts | undefined,
  query: CirceResolutionDomainQuery,
): CirceResolutionDomainEvaluation {
  const capability = candidateArtifacts?.at(query.trait);
  if (capability === undefined) return unavailableForTraitOffer(evaluation, query.trait);
  const values = capability.circeResolution(query.value, query.optionKey);
  const first = values[0];
  if (first === undefined) return unavailableForTraitOffer(evaluation, query.trait);
  const branchAgreement = values.every(
    (value) => value.effect === first.effect && value.requiredCount === first.requiredCount,
  );
  const option =
    query.value.kind === 'traits' ? query.value.options[optionIndex(query.optionKey)] : undefined;
  const selectedArcanaKeys =
    option?.circeResolution?.kind === 'activateArcana' ||
    option?.circeResolution?.kind === 'promoteArcana'
      ? option.circeResolution.arcanaKeys
      : Object.freeze([]);
  const selectedVowKey =
    option?.circeResolution?.kind === 'disableFear' ? option.circeResolution.vowKey : null;
  const arcanaKeys = catalog.arcanaCards.values
    .map((card) => card.key)
    .filter(
      (key) =>
        values.some((value) => value.arcanaKeys.includes(key)) || selectedArcanaKeys.includes(key),
    );
  const vowKeys = catalog.fearVows.values
    .map((vow) => vow.key)
    .filter((key) => values.some((value) => value.vowKeys.includes(key)) || selectedVowKey === key);
  return Object.freeze({
    kind: 'circeResolutionDomain',
    result: Object.freeze({
      effect: first.effect,
      requiredCount: branchAgreement ? first.requiredCount : 0,
      branchAgreement,
      arcanaCandidates: outcomeCandidates(
        arcanaKeys,
        values.map((value) => value.arcanaKeys),
        (key) => selectedArcanaKeys.includes(key),
        branchAgreement,
        first.requiredCount,
      ),
      vowCandidates: outcomeCandidates(
        vowKeys,
        values.map((value) => value.vowKeys),
        (key) => selectedVowKey === key,
        branchAgreement,
        1,
      ),
      outerAvailable: values.every((value) => value.outerAvailable),
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
  const values = capability.echoPomTargets(query.value, query.optionKey);
  const first = values[0];
  if (first === undefined) return unavailableForTraitOffer(evaluation, query.trait);
  const option =
    query.value.kind === 'traits' ? query.value.options[optionIndex(query.optionKey)] : undefined;
  const selected =
    option !== undefined && 'echoPomTarget' in option ? option.echoPomTarget : undefined;
  const traitKeys: string[] = catalog.traits.values
    .map((trait) => trait.key)
    .filter((key) => values.some((value) => value.includes(key)) || selected === key);
  const noTargetDomains = values.map((value) => (value.length === 0 ? [null] : []));
  const candidates = outcomeCandidates<string | null>(
    [
      ...traitKeys,
      ...(values.some((value) => value.length === 0) || selected === null ? [null] : []),
    ],
    values.map((value, index) =>
      Object.freeze([...(value as readonly (string | null)[]), ...noTargetDomains[index]!]),
    ),
    (value) => value === selected,
    true,
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

export function evaluateNaturalSelectionResultCandidate(
  _catalog: Catalog,
  _project: ProjectDocument,
  evaluation: ProjectEvaluation,
  candidateArtifacts: TraitOfferCandidateArtifacts | undefined,
  query: NaturalSelectionResultCandidateQuery,
): NaturalSelectionResultCandidateEvaluation {
  const capability = candidateArtifacts?.at(query.result);
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
  const assessments = capability.naturalSelectionTargets(
    disposition.levelCount,
    disposition.slots,
    query.targets,
  );
  const first = assessments[0];
  if (first === undefined) return unavailableForTraitOffer(evaluation, query.result.trait);
  const branchSupport = Object.freeze(
    assessments.map((assessment) => assessment.legal && assessment.complete),
  );
  const supported = branchSupport.length > 0 && branchSupport.every(Boolean);
  const complete = assessments.every((assessment) => assessment.complete);
  const nextTargetTraitKeys = assessments.every(
    (assessment) =>
      JSON.stringify(assessment.nextTargetTraitKeys) === JSON.stringify(first.nextTargetTraitKeys),
  )
    ? first.nextTargetTraitKeys
    : Object.freeze([]);
  return Object.freeze({
    kind: 'naturalSelectionResult',
    result: Object.freeze({
      supported,
      complete,
      nextTargetTraitKeys,
      branchSupport,
      findings: Object.freeze(
        supported
          ? []
          : [
              Object.freeze({
                code:
                  query.targets === undefined
                    ? ('naturalSelectionResultMissing' as const)
                    : ('naturalSelectionResultUnavailable' as const),
                detail: assessments.some((assessment) => assessment.legal)
                  ? 'incomplete'
                  : 'unavailable',
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
  const capability = candidateArtifacts?.at(query.trait);
  if (capability === undefined) return unavailableForTraitOffer(evaluation, query.trait);
  const assessments = capability.ransom(query.value);
  if (assessments.length === 0) return unavailableForTraitOffer(evaluation, query.trait);
  const first = assessments[0]!;
  return Object.freeze({
    kind: 'ransomAssessment',
    result: Object.freeze({
      assessments,
      branchAgreement: assessments.every(
        (assessment) =>
          JSON.stringify({
            removedTraitKeys: assessment.removedTraitKeys,
            removedCount: assessment.removedCount,
            levelBonus: assessment.levelBonus,
            buffedTraitKeys: assessment.buffedTraitKeys,
          }) ===
          JSON.stringify({
            removedTraitKeys: first.removedTraitKeys,
            removedCount: first.removedCount,
            levelBonus: first.levelBonus,
            buffedTraitKeys: first.buffedTraitKeys,
          }),
      ),
    }),
  });
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
  const branches = capability.echoLastRunBoon(query.value, query.optionKey);
  const first = branches[0];
  if (first === undefined) return unavailableForTraitOffer(evaluation, query.trait);
  const candidates = Object.freeze(
    first.map((outcome) => {
      const branchSupport = Object.freeze(
        branches.map((branch) => {
          const candidate = branch.find(
            (candidate) =>
              candidate.option.giverKey === outcome.option.giverKey &&
              candidate.option.traitKey === outcome.option.traitKey &&
              candidate.option.rarity === outcome.option.rarity,
          );
          const targeted = _catalog.traits.byKey[outcome.option.traitKey]?.targetedAcquisition;
          return (
            candidate?.assessment.legal === true &&
            (targeted === undefined || candidate.targetTraitKeys.length > 0)
          );
        }),
      );
      const retainedTarget =
        query.value.kind === 'traits'
          ? query.value.options[optionIndex(query.optionKey)]?.echoLastRunBoon?.options.find(
              (option) =>
                option.giverKey === outcome.option.giverKey &&
                option.traitKey === outcome.option.traitKey &&
                option.rarity === outcome.option.rarity,
            )?.targetTraitKey
          : undefined;
      const targetTraitKeys = [
        ...new Set(
          branches.flatMap(
            (branch) =>
              branch.find(
                (candidate) =>
                  candidate.option.giverKey === outcome.option.giverKey &&
                  candidate.option.traitKey === outcome.option.traitKey &&
                  candidate.option.rarity === outcome.option.rarity,
              )?.targetTraitKeys ?? [],
          ),
        ),
      ];
      if (retainedTarget !== undefined && !targetTraitKeys.includes(retainedTarget))
        targetTraitKeys.push(retainedTarget);
      const branchUniversallySupported = branchSupport.length > 0 && branchSupport.every(Boolean);
      const effectiveRarities = branches.flatMap((branch) => {
        const candidate = branch.find(
          (entry) =>
            entry.option.giverKey === outcome.option.giverKey &&
            entry.option.traitKey === outcome.option.traitKey &&
            entry.option.rarity === outcome.option.rarity,
        );
        return candidate === undefined ? [] : [candidate.effectiveRarity];
      });
      const effectiveRarity =
        effectiveRarities.length > 0 &&
        effectiveRarities.every((rarity) => rarity === effectiveRarities[0])
          ? effectiveRarities[0]
          : undefined;
      const universallySupported = branchUniversallySupported && effectiveRarity !== undefined;
      const targetRequired =
        _catalog.traits.byKey[outcome.option.traitKey]?.targetedAcquisition !== undefined;
      return Object.freeze({
        option: outcome.option,
        ...(effectiveRarity === undefined ? {} : { effectiveRarity }),
        support: universallySupported ? ('possible' as const) : ('impossible' as const),
        branchSupport,
        ...(!universallySupported
          ? {
              reason: branchSupport.some(Boolean)
                ? ('branchDivergence' as const)
                : ('unavailable' as const),
            }
          : {}),
        targetRequired,
        targetCandidates: outcomeCandidates(
          targetTraitKeys,
          branches.map((branch) => {
            const candidate = branch.find(
              (candidate) =>
                candidate.option.giverKey === outcome.option.giverKey &&
                candidate.option.traitKey === outcome.option.traitKey &&
                candidate.option.rarity === outcome.option.rarity,
            );
            return candidate?.assessment.legal === true ? candidate.targetTraitKeys : [];
          }),
          (traitKey) => traitKey === retainedTarget,
          true,
          1,
        ),
      });
    }),
  );
  return Object.freeze({
    kind: 'echoLastRunBoonDomain',
    result: Object.freeze({
      candidates,
    }),
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
  const branches = capability.allTogetherSet(query.value, query.optionKey, query.setKey);
  const first = branches[0];
  if (first === undefined) return unavailableForTraitOffer(evaluation, query.trait);
  const option =
    query.value.kind === 'traits' ? query.value.options[optionIndex(query.optionKey)] : undefined;
  const selected = option?.allTogetherResult?.[query.setKey];
  const declaration = option === undefined ? undefined : catalog.traits.byKey[option.traitKey];
  const set =
    declaration?.selectedDisposition.kind === 'directTraitSets'
      ? declaration.selectedDisposition.sets.find((candidate) => candidate.key === query.setKey)
      : undefined;
  const values: (string | null)[] = [
    ...(set?.traitKeys ?? []),
    ...(branches.some((branch) => branch.includes(null)) || selected === null ? [null] : []),
  ].filter(
    (value, index, all) =>
      all.indexOf(value) === index &&
      (branches.some((branch) => branch.includes(value)) || value === selected),
  );
  return Object.freeze({
    kind: 'allTogetherSetDomain',
    result: Object.freeze({
      setKey: query.setKey,
      candidates: outcomeCandidates<string | null>(
        values,
        branches,
        (value) => value === selected,
        true,
        1,
      ),
    }),
  });
}

function outcomeCandidates<T>(
  values: readonly T[],
  branchDomains: readonly (readonly T[])[],
  selected: (value: T) => boolean,
  branchAgreement: boolean,
  requiredCount: number,
): readonly EvaluatedDirectTraitOutcomeCandidate<T>[] {
  return Object.freeze(
    values.map((value) => {
      const branchSupport = Object.freeze(
        branchDomains.map((domain) => domain.some((candidate) => Object.is(candidate, value))),
      );
      const universallySupported =
        branchAgreement && branchSupport.length > 0 && branchSupport.every(Boolean);
      const forced =
        universallySupported &&
        requiredCount > 0 &&
        branchDomains.every(
          (domain) =>
            domain.some((candidate) => Object.is(candidate, value)) &&
            domain.length <= requiredCount,
        );
      return Object.freeze({
        value,
        support: forced
          ? ('forced' as const)
          : universallySupported
            ? ('possible' as const)
            : ('impossible' as const),
        branchSupport,
        selected: selected(value),
        ...(!universallySupported
          ? {
              reason: branchSupport.some(Boolean)
                ? ('branchDivergence' as const)
                : ('unavailable' as const),
            }
          : {}),
      });
    }),
  );
}
