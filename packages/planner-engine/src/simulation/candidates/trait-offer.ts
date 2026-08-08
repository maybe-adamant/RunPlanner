import type { Catalog } from '../../catalog-schema';
import { semanticAddressKey, type TraitOfferAddress } from '../../authored-project/addresses';
import type { AuthoredTraitOffer } from '../../authored-project/traits';
import type { ProjectDocument } from '../../authored-project/model';
import type { ProjectEvaluation } from '../project';
import { assessTraitOffer, type TraitAssessment, type TraitFindingCode } from '../traits';
import { unavailableForBiome, type CandidateContextUnavailable } from './availability';
import { candidateBiome } from './evaluated-biome';

export type TraitOfferCandidateFindingCode = TraitFindingCode | 'duplicateOfferedTrait';

export interface TraitOfferCandidateQuery {
  readonly kind: 'traitOffer';
  readonly trait: TraitOfferAddress;
  readonly value: AuthoredTraitOffer;
}

export interface EvaluatedTraitOfferCandidate {
  readonly kind: 'traitOffer';
  readonly result: {
    readonly supported: boolean;
    readonly assessments: readonly TraitAssessment[];
    readonly findings: readonly {
      readonly code: TraitOfferCandidateFindingCode;
      readonly traitKey: string;
      readonly detail?: string;
    }[];
  };
}

export type TraitOfferCandidateEvaluation =
  CandidateContextUnavailable | EvaluatedTraitOfferCandidate;

export function evaluateTraitOfferCandidate(
  catalog: Catalog,
  _project: ProjectDocument,
  evaluation: ProjectEvaluation,
  query: TraitOfferCandidateQuery,
): TraitOfferCandidateEvaluation {
  const biome = candidateBiome(
    catalog,
    _project,
    evaluation,
    query.trait.routeKey,
    query.trait.biomeKey,
  );
  if (biome === undefined || !('rewards' in biome)) {
    return unavailableForBiome(
      evaluation,
      query.trait.routeKey,
      query.trait.biomeKey,
      query.trait.owner,
      'afterRoomLifecycle',
    );
  }
  const ownerKey = semanticAddressKey(query.trait.owner);
  const reached = Object.freeze(
    biome.rewards.branches.flatMap((branch) =>
      (branch.traitEvaluations ?? []).filter(
        (candidate) =>
          candidate.reached &&
          candidate.acquisitionRole === query.trait.acquisitionRole &&
          semanticAddressKey(candidate.address) === ownerKey,
      ),
    ),
  );
  if (reached.length === 0) {
    return unavailableForBiome(
      evaluation,
      query.trait.routeKey,
      query.trait.biomeKey,
      query.trait.owner,
      'afterRoomLifecycle',
    );
  }
  const assessments = reached.map((trace) =>
    assessTraitOffer(catalog, query.value, trace.before, trace.context),
  );
  const optionCounts = new Map<string, number>();
  for (const option of query.value.options) {
    optionCounts.set(option.traitKey, (optionCounts.get(option.traitKey) ?? 0) + 1);
  }
  const duplicateFindings = Object.freeze(
    [...optionCounts.entries()].flatMap(([traitKey, count]) =>
      count > 1
        ? [
            Object.freeze({
              code: 'duplicateOfferedTrait' as const,
              traitKey,
              detail: 'trait appears in more than one offered option',
            }),
          ]
        : [],
    ),
  );
  const findings = Object.freeze([
    ...assessments.flatMap((assessment) => assessment.flatMap((entry) => entry.findings)),
    ...duplicateFindings,
  ]);
  return Object.freeze({
    kind: 'traitOffer',
    result: Object.freeze({
      supported:
        duplicateFindings.length === 0 &&
        assessments.some((assessment) => assessment.every((entry) => entry.legal)),
      assessments: Object.freeze(assessments.flat()),
      findings,
    }),
  });
}
