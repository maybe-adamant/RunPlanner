import type { Catalog } from '../../catalog-schema';
import type { TraitOfferAddress } from '../../authored-project/addresses';
import type { AuthoredTraitOffer } from '../../authored-project/traits';
import type { ProjectDocument } from '../../authored-project/model';
import type { ProjectEvaluation } from '../project';
import type { TraitOfferCandidateArtifacts } from '../candidate-artifacts';
import type {
  TraitAssessment,
  TraitFindingCode,
  TraitOfferCompositionAssessment,
  TraitReplacementCompositionAssessment,
} from '../traits';
import { unavailableForBiome, type CandidateContextUnavailable } from './availability';

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
    readonly branches: readonly {
      readonly assessments: readonly TraitAssessment[];
      readonly composition: TraitOfferCompositionAssessment;
      readonly replacementComposition?: TraitReplacementCompositionAssessment;
    }[];
    readonly findings: readonly {
      readonly code: TraitOfferCandidateFindingCode;
      readonly traitKey?: string;
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
  candidateArtifacts: TraitOfferCandidateArtifacts | undefined,
  query: TraitOfferCandidateQuery,
): TraitOfferCandidateEvaluation {
  const capability = candidateArtifacts?.at(query.trait);
  if (capability === undefined) {
    return unavailableForBiome(
      evaluation,
      query.trait.routeKey,
      query.trait.biomeKey,
      query.trait.owner,
      'afterRoomLifecycle',
    );
  }
  const reached = capability.evaluateOffer(query.value);
  const branches = reached.map((branch) =>
    Object.freeze({
      assessments: branch.assessments,
      composition: branch.composition,
      ...(branch.replacementComposition.applies &&
      (branch.replacementComposition.replacementCount > 0 || !branch.replacementComposition.legal)
        ? { replacementComposition: branch.replacementComposition }
        : {}),
    }),
  );
  const assessments = branches.map((branch) => branch.assessments);
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
    ...branches.flatMap((branch) => [
      ...branch.assessments.flatMap((entry) => entry.findings),
      ...branch.composition.findings,
      ...(branch.replacementComposition?.findings ?? []),
    ]),
    ...duplicateFindings,
  ]);
  return Object.freeze({
    kind: 'traitOffer',
    result: Object.freeze({
      supported:
        duplicateFindings.length === 0 &&
        branches.some(
          (branch) =>
            branch.composition.legal &&
            (branch.replacementComposition?.legal ?? true) &&
            branch.assessments.every((entry) => entry.legal),
        ),
      branches: Object.freeze(branches),
      assessments: Object.freeze(assessments.flat()),
      findings,
    }),
  });
}
