import type { Catalog } from '../../catalog-schema';
import type { TraitOfferAddress } from '../../authored-project/addresses';
import {
  optionIndex,
  type AuthoredTraitOffer,
  type TraitOptionKey,
} from '../../authored-project/traits';
import type { ProjectDocument } from '../../authored-project/model';
import type { TraitOfferCandidateArtifacts } from '../candidate-artifacts';
import type { ProjectEvaluation } from '../project';
import type {
  TraitAssessment,
  TraitAssessmentFinding,
  TraitFindingCode,
  TraitOfferCompositionAssessment,
  TraitOfferCompositionFinding,
  TraitReplacementCompositionAssessment,
} from '../traits';
import { unavailableForBiome, type CandidateContextUnavailable } from './availability';

export type TraitOfferCandidateFindingCode = TraitFindingCode | 'duplicateOfferedTrait';

export interface TraitOfferCandidateFinding {
  readonly code: TraitOfferCandidateFindingCode;
  readonly traitKey?: string;
  readonly detail?: string;
  readonly requirementTraitKeys?: readonly string[];
  /** First-offer composition can identify one concrete option position. */
  readonly optionKey?: TraitOptionKey;
  /** Every offer position containing this duplicate trait. */
  readonly optionKeys?: readonly TraitOptionKey[];
}

export interface TraitOfferCandidateQuery {
  readonly kind: 'traitOffer';
  readonly trait: TraitOfferAddress;
  readonly value: AuthoredTraitOffer;
}

/**
 * Evaluates one concrete option while preserving its authored siblings. This
 * is a focused support question, not a partial trait offer: all three values
 * remain input to the same pre-offer artifact.
 */
export interface TraitOfferFocusedOptionCandidateQuery {
  readonly kind: 'traitOfferFocusedOption';
  readonly trait: TraitOfferAddress;
  readonly value: AuthoredTraitOffer;
  readonly optionKey: TraitOptionKey;
}

export interface TraitOfferCandidateBranch {
  readonly assessments: readonly TraitAssessment[];
  readonly composition: TraitOfferCompositionAssessment;
  readonly replacementComposition?: TraitReplacementCompositionAssessment;
}

export interface EvaluatedTraitOfferCandidate {
  readonly kind: 'traitOffer';
  readonly result: {
    readonly supported: boolean;
    readonly assessments: readonly TraitAssessment[];
    readonly branches: readonly TraitOfferCandidateBranch[];
    readonly findings: readonly TraitOfferCandidateFinding[];
  };
}

/**
 * Engine-owned attribution for a focused option. Consumers use
 * `blocksFocusedOption` instead of reimplementing trait finding policy.
 */
export interface TraitOfferFocusedOptionEvidence {
  readonly source:
    | 'focusedOption'
    | 'siblingOption'
    | 'duplicate'
    | 'firstOfferComposition'
    | 'replacementComposition';
  readonly blocksFocusedOption: boolean;
  readonly finding: TraitOfferCandidateFinding;
}

export interface TraitOfferFocusedOptionBranch {
  readonly supported: boolean;
  readonly evidence: readonly TraitOfferFocusedOptionEvidence[];
}

export interface EvaluatedTraitOfferFocusedOptionCandidate {
  readonly kind: 'traitOfferFocusedOption';
  readonly result: {
    readonly optionKey: TraitOptionKey;
    readonly supported: boolean;
    readonly branches: readonly TraitOfferFocusedOptionBranch[];
    readonly evidence: readonly TraitOfferFocusedOptionEvidence[];
  };
}

export type TraitOfferCandidateEvaluation =
  CandidateContextUnavailable | EvaluatedTraitOfferCandidate;

export type TraitOfferFocusedOptionCandidateEvaluation =
  CandidateContextUnavailable | EvaluatedTraitOfferFocusedOptionCandidate;

interface TraitOfferCandidateAssessment {
  readonly branches: readonly TraitOfferCandidateBranch[];
  readonly assessments: readonly TraitAssessment[];
  readonly duplicateFindings: readonly TraitOfferCandidateFinding[];
  readonly findings: readonly TraitOfferCandidateFinding[];
  readonly supported: boolean;
}

function candidateFinding(
  finding:
    | TraitAssessmentFinding
    | TraitOfferCompositionFinding
    | { readonly code: 'replacementCompositionExceeded'; readonly detail?: string },
): TraitOfferCandidateFinding {
  return Object.freeze({ ...finding });
}

/** The duplicate authority is shared by complete and focused candidate paths. */
function duplicateOfferedTraitFindings(
  offer: AuthoredTraitOffer,
): readonly TraitOfferCandidateFinding[] {
  const optionKeysByTrait = new Map<string, TraitOptionKey[]>();
  const optionKeys: readonly TraitOptionKey[] = ['option1', 'option2', 'option3'];
  for (const [index, option] of offer.options.entries()) {
    const keys = optionKeysByTrait.get(option.traitKey) ?? [];
    keys.push(optionKeys[index]!);
    optionKeysByTrait.set(option.traitKey, keys);
  }
  return Object.freeze(
    [...optionKeysByTrait.entries()].flatMap(([traitKey, optionKeysForTrait]) =>
      optionKeysForTrait.length > 1
        ? [
            Object.freeze({
              code: 'duplicateOfferedTrait' as const,
              traitKey,
              detail: 'trait appears in more than one offered option',
              optionKeys: Object.freeze([...optionKeysForTrait]),
            }),
          ]
        : [],
    ),
  );
}

/**
 * Normalizes exact artifact output once for both candidate questions. No
 * focused path reevaluates trait legality or replacement composition.
 */
function assessTraitOfferCandidate(
  reached: readonly {
    readonly assessments: readonly TraitAssessment[];
    readonly composition: TraitOfferCompositionAssessment;
    readonly replacementComposition: TraitReplacementCompositionAssessment;
  }[],
  duplicateFindings: readonly TraitOfferCandidateFinding[],
): TraitOfferCandidateAssessment {
  const branches = Object.freeze(
    reached.map((branch) =>
      Object.freeze({
        assessments: branch.assessments,
        composition: branch.composition,
        ...(branch.replacementComposition.applies &&
        (branch.replacementComposition.replacementCount > 0 || !branch.replacementComposition.legal)
          ? { replacementComposition: branch.replacementComposition }
          : {}),
      }),
    ),
  );
  const assessments = Object.freeze(branches.flatMap((branch) => branch.assessments));
  const findings = Object.freeze([
    ...branches.flatMap((branch) => [
      ...branch.assessments.flatMap((entry) => entry.findings.map(candidateFinding)),
      ...branch.composition.findings.map(candidateFinding),
      ...(branch.replacementComposition?.findings.map(candidateFinding) ?? []),
    ]),
    ...duplicateFindings,
  ]);
  return Object.freeze({
    branches,
    assessments,
    duplicateFindings,
    findings,
    supported:
      duplicateFindings.length === 0 &&
      branches.some(
        (branch) =>
          branch.composition.legal &&
          (branch.replacementComposition?.legal ?? true) &&
          branch.assessments.every((entry) => entry.legal),
      ),
  });
}

function unavailableForTraitOffer(
  evaluation: ProjectEvaluation,
  trait: TraitOfferAddress,
): CandidateContextUnavailable {
  return unavailableForBiome(
    evaluation,
    trait.routeKey,
    trait.biomeKey,
    trait.owner,
    'afterRoomLifecycle',
  );
}

function evaluatedTraitOfferCandidate(
  assessment: TraitOfferCandidateAssessment,
): EvaluatedTraitOfferCandidate {
  return Object.freeze({
    kind: 'traitOffer',
    result: Object.freeze({
      supported: assessment.supported,
      branches: assessment.branches,
      assessments: assessment.assessments,
      findings: assessment.findings,
    }),
  });
}

function focusedEvidenceForBranch(
  branch: TraitOfferCandidateBranch,
  duplicateFindings: readonly TraitOfferCandidateFinding[],
  optionKey: TraitOptionKey,
): TraitOfferFocusedOptionBranch {
  const focusIndex = optionIndex(optionKey);
  const evidence: TraitOfferFocusedOptionEvidence[] = [];
  for (const [index, assessment] of branch.assessments.entries()) {
    const focused = index === focusIndex;
    for (const finding of assessment.findings) {
      evidence.push(
        Object.freeze({
          source: focused ? 'focusedOption' : 'siblingOption',
          blocksFocusedOption: focused,
          finding: candidateFinding(finding),
        }),
      );
    }
  }
  for (const finding of duplicateFindings) {
    evidence.push(
      Object.freeze({
        source: 'duplicate',
        blocksFocusedOption: finding.optionKeys?.includes(optionKey) ?? false,
        finding,
      }),
    );
  }
  for (const finding of branch.composition.findings) {
    evidence.push(
      Object.freeze({
        source: 'firstOfferComposition',
        blocksFocusedOption:
          finding.code === 'missingAttackOrSpecial' || finding.optionKey === optionKey,
        finding: candidateFinding(finding),
      }),
    );
  }
  for (const finding of branch.replacementComposition?.findings ?? []) {
    evidence.push(
      Object.freeze({
        source: 'replacementComposition',
        blocksFocusedOption: branch.assessments[focusIndex]?.replacementTransition !== undefined,
        finding: candidateFinding(finding),
      }),
    );
  }
  const frozenEvidence = Object.freeze(evidence);
  return Object.freeze({
    supported: frozenEvidence.every((entry) => !entry.blocksFocusedOption),
    evidence: frozenEvidence,
  });
}

function evaluatedFocusedTraitOfferOptionCandidate(
  assessment: TraitOfferCandidateAssessment,
  optionKey: TraitOptionKey,
): EvaluatedTraitOfferFocusedOptionCandidate {
  const branches = Object.freeze(
    assessment.branches.map((branch) =>
      focusedEvidenceForBranch(branch, assessment.duplicateFindings, optionKey),
    ),
  );
  const evidence = Object.freeze(
    branches.length > 0
      ? branches.flatMap((branch) => branch.evidence)
      : assessment.duplicateFindings.map((finding) =>
          Object.freeze({
            source: 'duplicate' as const,
            blocksFocusedOption: finding.optionKeys?.includes(optionKey) ?? false,
            finding,
          }),
        ),
  );
  return Object.freeze({
    kind: 'traitOfferFocusedOption',
    result: Object.freeze({
      optionKey,
      supported: branches.some((branch) => branch.supported),
      branches,
      evidence,
    }),
  });
}

export function evaluateTraitOfferCandidate(
  _catalog: Catalog,
  _project: ProjectDocument,
  evaluation: ProjectEvaluation,
  candidateArtifacts: TraitOfferCandidateArtifacts | undefined,
  query: TraitOfferCandidateQuery,
): TraitOfferCandidateEvaluation {
  const duplicateFindings = duplicateOfferedTraitFindings(query.value);
  const capability = candidateArtifacts?.at(query.trait);
  if (capability === undefined && duplicateFindings.length === 0)
    return unavailableForTraitOffer(evaluation, query.trait);
  const assessment = assessTraitOfferCandidate(
    capability === undefined ? Object.freeze([]) : capability.evaluateOffer(query.value),
    duplicateFindings,
  );
  return evaluatedTraitOfferCandidate(assessment);
}

export function evaluateTraitOfferFocusedOptionCandidate(
  _catalog: Catalog,
  _project: ProjectDocument,
  evaluation: ProjectEvaluation,
  candidateArtifacts: TraitOfferCandidateArtifacts | undefined,
  query: TraitOfferFocusedOptionCandidateQuery,
): TraitOfferFocusedOptionCandidateEvaluation {
  const duplicateFindings = duplicateOfferedTraitFindings(query.value);
  const focusedDuplicate = duplicateFindings.some((finding) =>
    finding.optionKeys?.includes(query.optionKey),
  );
  const capability = candidateArtifacts?.at(query.trait);
  if (capability === undefined && !focusedDuplicate)
    return unavailableForTraitOffer(evaluation, query.trait);
  const assessment = assessTraitOfferCandidate(
    capability === undefined ? Object.freeze([]) : capability.evaluateOffer(query.value),
    duplicateFindings,
  );
  return evaluatedFocusedTraitOfferOptionCandidate(assessment, query.optionKey);
}
