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
  TraitTargetedAcquisitionAssessment,
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
  /** Ordered Calling Card action evidence at this exact offer owner. */
  readonly actionIndex?: number;
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

/**
 * Requests the exact-target domain for one selected targeted acquisition.
 * The engine enumerates it from retained pre-offer branches; consumers do not
 * inspect or reconstruct trait history.
 */
export interface TraitAcquisitionTargetDomainQuery {
  readonly kind: 'traitAcquisitionTargetDomain';
  readonly trait: TraitOfferAddress;
  readonly value: AuthoredTraitOffer;
  readonly optionKey: TraitOptionKey;
  readonly retainedTargetTraitKey?: string;
}

/** One selected Circe option's atomic exact-outcome frontier. */
export interface CirceResolutionDomainQuery {
  readonly kind: 'circeResolutionDomain';
  readonly trait: TraitOfferAddress;
  readonly value: AuthoredTraitOffer;
  readonly optionKey: TraitOptionKey;
}
export interface EvaluatedCirceResolutionDomain {
  readonly kind: 'circeResolutionDomain';
  readonly result: {
    readonly effect: 'activateArcana' | 'promoteArcana' | 'disableFear';
    readonly requiredCount: number;
    readonly arcanaKeys: readonly string[];
    readonly vowKeys: readonly string[];
    readonly outerAvailable: boolean;
  };
}
export type CirceResolutionDomainEvaluation =
  CandidateContextUnavailable | EvaluatedCirceResolutionDomain;

export interface EchoPomTargetDomainQuery {
  readonly kind: 'echoPomTargetDomain';
  readonly trait: TraitOfferAddress;
  readonly value: AuthoredTraitOffer;
  readonly optionKey: TraitOptionKey;
}
export interface EvaluatedEchoPomTargetDomain {
  readonly kind: 'echoPomTargetDomain';
  readonly result: {
    readonly traitKeys: readonly string[];
    readonly emptyNoOpAllowed: boolean;
  };
}
export type EchoPomTargetDomainEvaluation =
  CandidateContextUnavailable | EvaluatedEchoPomTargetDomain;

export interface EchoLastRunBoonDomainQuery {
  readonly kind: 'echoLastRunBoonDomain';
  readonly trait: TraitOfferAddress;
  readonly value: AuthoredTraitOffer;
  readonly optionKey: TraitOptionKey;
}
export interface EvaluatedEchoLastRunBoonCandidate {
  readonly option: import('../../authored-project/traits').AuthoredEchoLastRunBoonOption;
  readonly effectiveRarity: import('../../catalog-schema').TraitRarity;
  readonly supported: boolean;
  readonly branchSupport: readonly boolean[];
  readonly targetTraitKeys: readonly string[];
}
export interface EvaluatedEchoLastRunBoonDomain {
  readonly kind: 'echoLastRunBoonDomain';
  readonly result: {
    readonly candidates: readonly EvaluatedEchoLastRunBoonCandidate[];
    readonly candidatesByOption: readonly (readonly EvaluatedEchoLastRunBoonCandidate[])[];
    readonly appendCandidate?: EvaluatedEchoLastRunBoonCandidate;
  };
}
export type EchoLastRunBoonDomainEvaluation =
  CandidateContextUnavailable | EvaluatedEchoLastRunBoonDomain;

export interface EchoLastRewardDomainQuery {
  readonly kind: 'echoLastRewardDomain';
  readonly trait: TraitOfferAddress;
  readonly value: AuthoredTraitOffer;
  readonly optionKey: TraitOptionKey;
}
export interface EvaluatedEchoLastRewardDomain {
  readonly kind: 'echoLastRewardDomain';
  readonly result: {
    readonly rewardType: string;
    readonly defaultValue: import('../../authored-project/traits').AuthoredEchoLastRewardAcquisition;
  };
}
export type EchoLastRewardDomainEvaluation =
  CandidateContextUnavailable | EvaluatedEchoLastRewardDomain;

export interface EvaluatedTraitAcquisitionTargetCandidate {
  readonly kind: 'traitAcquisitionTarget';
  readonly result: {
    readonly traitKey: string;
    readonly supported: boolean;
    readonly branchSupport: readonly boolean[];
    readonly findings: readonly TraitOfferCandidateFinding[];
  };
}

export interface EvaluatedTraitAcquisitionTargetDomain {
  readonly kind: 'traitAcquisitionTargetDomain';
  readonly result: {
    readonly sourceTraitKey: string;
    readonly candidates: readonly EvaluatedTraitAcquisitionTargetCandidate[];
  };
}

export interface TraitOfferCandidateBranch {
  readonly assessments: readonly TraitAssessment[];
  readonly composition: TraitOfferCompositionAssessment;
  readonly replacementComposition?: TraitReplacementCompositionAssessment;
  readonly targetedAcquisition?: TraitTargetedAcquisitionAssessment;
}

/** Exact Calling Card replay product for one surviving pre-offer branch. */
export interface CallingCardOfferCandidateBranch {
  readonly effectiveRarities: readonly (import('../../catalog-schema').TraitRarity | undefined)[];
  readonly remainingCharges?: number;
  readonly invalidActionIndexes: readonly number[];
  readonly rarifiableOptionKeys: readonly TraitOptionKey[];
}

export interface EvaluatedTraitOfferCandidate {
  readonly kind: 'traitOffer';
  readonly result: {
    readonly supported: boolean;
    readonly assessments: readonly TraitAssessment[];
    readonly branches: readonly TraitOfferCandidateBranch[];
    readonly callingCard?: readonly CallingCardOfferCandidateBranch[];
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
    | 'replacementComposition'
    | 'targetedAcquisition';
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

export type TraitAcquisitionTargetDomainEvaluation =
  CandidateContextUnavailable | EvaluatedTraitAcquisitionTargetDomain;

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
    | { readonly code: TraitFindingCode; readonly detail?: string },
): TraitOfferCandidateFinding {
  return Object.freeze({ ...finding });
}

/** The duplicate authority is shared by complete and focused candidate paths. */
function duplicateOfferedTraitFindings(
  offer: AuthoredTraitOffer,
): readonly TraitOfferCandidateFinding[] {
  if (offer.kind === 'fallbackGold') return Object.freeze([]);
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
    readonly targetedAcquisition: TraitTargetedAcquisitionAssessment;
  }[],
  duplicateFindings: readonly TraitOfferCandidateFinding[],
  callingCard: readonly CallingCardOfferCandidateBranch[] = Object.freeze([]),
  value?: AuthoredTraitOffer,
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
        ...(branch.targetedAcquisition.applies
          ? { targetedAcquisition: branch.targetedAcquisition }
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
      ...(branch.targetedAcquisition?.findings.map(candidateFinding) ?? []),
    ]),
    ...duplicateFindings,
    ...callingCard.flatMap((branch) =>
      branch.invalidActionIndexes.map((index) =>
        Object.freeze({
          code: 'callingCardRarificationUnavailable' as const,
          actionIndex: index,
          ...(value?.kind === 'traits' && value.rarificationActions?.[index] === undefined
            ? {}
            : value?.kind === 'traits'
              ? { optionKey: value.rarificationActions![index] }
              : {}),
          detail: `rarification action ${index + 1} is unavailable at this offer frontier`,
        }),
      ),
    ),
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
          (branch.targetedAcquisition?.legal ?? true) &&
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
  callingCard: readonly CallingCardOfferCandidateBranch[],
): EvaluatedTraitOfferCandidate {
  return Object.freeze({
    kind: 'traitOffer',
    result: Object.freeze({
      supported: assessment.supported,
      branches: assessment.branches,
      assessments: assessment.assessments,
      findings: assessment.findings,
      callingCard: Object.freeze(callingCard),
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
  for (const finding of branch.targetedAcquisition?.findings ?? []) {
    evidence.push(
      Object.freeze({
        source: 'targetedAcquisition',
        // A valid target is the next compound picker step. The focused trait
        // remains selectable when its nonempty target domain is legal.
        blocksFocusedOption: false,
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
  const callingCard = Object.freeze(
    (capability?.callingCard(query.value) ?? []).map((branch) =>
      Object.freeze({
        effectiveRarities:
          branch.effectiveOffer.kind === 'fallbackGold'
            ? Object.freeze([])
            : Object.freeze(branch.effectiveOffer.options.map((option) => option.rarity)),
        ...(branch.remainingCharges === undefined
          ? {}
          : { remainingCharges: branch.remainingCharges }),
        invalidActionIndexes: branch.invalidActions,
        rarifiableOptionKeys: branch.rarifiableOptionKeys,
      }),
    ),
  );
  const assessment = assessTraitOfferCandidate(
    capability === undefined ? Object.freeze([]) : capability.evaluateOffer(query.value),
    duplicateFindings,
    callingCard,
    query.value,
  );
  return evaluatedTraitOfferCandidate(assessment, callingCard);
}

export function evaluateTraitOfferFocusedOptionCandidate(
  _catalog: Catalog,
  _project: ProjectDocument,
  evaluation: ProjectEvaluation,
  candidateArtifacts: TraitOfferCandidateArtifacts | undefined,
  query: TraitOfferFocusedOptionCandidateQuery,
): TraitOfferFocusedOptionCandidateEvaluation {
  if (query.value.kind === 'fallbackGold') return unavailableForTraitOffer(evaluation, query.trait);
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

export function evaluateTraitAcquisitionTargetDomain(
  catalog: Catalog,
  _project: ProjectDocument,
  evaluation: ProjectEvaluation,
  candidateArtifacts: TraitOfferCandidateArtifacts | undefined,
  query: TraitAcquisitionTargetDomainQuery,
): TraitAcquisitionTargetDomainEvaluation {
  if (query.value.kind === 'fallbackGold') return unavailableForTraitOffer(evaluation, query.trait);
  const capability = candidateArtifacts?.at(query.trait);
  if (capability === undefined) return unavailableForTraitOffer(evaluation, query.trait);
  const option = query.value.options[optionIndex(query.optionKey)];
  if (option === undefined) return unavailableForTraitOffer(evaluation, query.trait);
  const branchTargets = capability.targetedAcquisitionTargets(query.value, query.optionKey);
  const supportedKeys = new Set(
    branchTargets.flatMap((branch) => (branch.sourceSupported ? branch.targetTraitKeys : [])),
  );
  const orderedKeys = catalog.traits.values
    .map((trait) => trait.key)
    .filter((traitKey) => supportedKeys.has(traitKey));
  if (
    query.retainedTargetTraitKey !== undefined &&
    !orderedKeys.includes(query.retainedTargetTraitKey)
  ) {
    orderedKeys.push(query.retainedTargetTraitKey);
  }
  return Object.freeze({
    kind: 'traitAcquisitionTargetDomain',
    result: Object.freeze({
      sourceTraitKey: option.traitKey,
      candidates: Object.freeze(
        orderedKeys.map((traitKey) => {
          const branchSupport = Object.freeze(
            branchTargets.map(
              (branch) => branch.sourceSupported && branch.targetTraitKeys.includes(traitKey),
            ),
          );
          const supported = branchSupport.some(Boolean);
          return Object.freeze({
            kind: 'traitAcquisitionTarget' as const,
            result: Object.freeze({
              traitKey,
              supported,
              branchSupport,
              findings: Object.freeze(
                supported
                  ? []
                  : [
                      Object.freeze({
                        code: 'targetedAcquisitionTargetUnavailable' as const,
                        traitKey,
                        detail: traitKey,
                      }),
                    ],
              ),
            }),
          });
        }),
      ),
    }),
  });
}

export function evaluateCirceResolutionDomain(
  _catalog: Catalog,
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
  // A complete authored outcome must be legal at every surviving simulation
  // branch. Never let presentation inherit one arbitrary branch's frontier.
  const equivalent = values.every(
    (value) =>
      value.effect === first.effect &&
      value.requiredCount === first.requiredCount &&
      value.outerAvailable === first.outerAvailable &&
      value.arcanaKeys.length === first.arcanaKeys.length &&
      value.arcanaKeys.every((key, index) => key === first.arcanaKeys[index]) &&
      value.vowKeys.length === first.vowKeys.length &&
      value.vowKeys.every((key, index) => key === first.vowKeys[index]),
  );
  if (!equivalent) return unavailableForTraitOffer(evaluation, query.trait);
  return Object.freeze({ kind: 'circeResolutionDomain', result: first });
}

export function evaluateEchoPomTargetDomain(
  _catalog: Catalog,
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
  const equivalent = values.every(
    (value) => value.length === first.length && value.every((key, index) => key === first[index]),
  );
  if (!equivalent) return unavailableForTraitOffer(evaluation, query.trait);
  return Object.freeze({
    kind: 'echoPomTargetDomain',
    result: Object.freeze({ traitKeys: first, emptyNoOpAllowed: first.length === 0 }),
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
        branches.map(
          (branch) =>
            branch.find(
              (candidate) =>
                candidate.option.giverKey === outcome.option.giverKey &&
                candidate.option.traitKey === outcome.option.traitKey &&
                candidate.option.rarity === outcome.option.rarity,
            )?.assessment.legal === true,
        ),
      );
      const targetTraitKeys = Object.freeze([
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
      ]);
      return Object.freeze({
        option: outcome.option,
        effectiveRarity: outcome.effectiveRarity,
        supported: branchSupport.some(Boolean),
        branchSupport,
        targetTraitKeys,
      });
    }),
  );
  const child =
    query.value.kind === 'traits'
      ? query.value.options[optionIndex(query.optionKey)]?.echoLastRunBoon
      : undefined;
  const candidatesByOption = Object.freeze(
    (child?.options ?? []).map((existing, index) =>
      Object.freeze(
        candidates.filter(
          (candidate) =>
            (candidate.supported &&
              !child?.options.some(
                (other, otherIndex) =>
                  otherIndex !== index && other.traitKey === candidate.option.traitKey,
              )) ||
            (candidate.option.giverKey === existing.giverKey &&
              candidate.option.traitKey === existing.traitKey &&
              candidate.option.rarity === existing.rarity),
        ),
      ),
    ),
  );
  const appendCandidate = candidates.find(
    (candidate) =>
      candidate.supported &&
      !child?.options.some((existing) => existing.traitKey === candidate.option.traitKey),
  );
  return Object.freeze({
    kind: 'echoLastRunBoonDomain',
    result: Object.freeze({
      candidates,
      candidatesByOption,
      ...(appendCandidate === undefined ? {} : { appendCandidate }),
    }),
  });
}

export function evaluateEchoLastRewardDomain(
  _catalog: Catalog,
  _project: ProjectDocument,
  evaluation: ProjectEvaluation,
  candidateArtifacts: TraitOfferCandidateArtifacts | undefined,
  query: EchoLastRewardDomainQuery,
): EchoLastRewardDomainEvaluation {
  const capability = candidateArtifacts?.at(query.trait);
  if (capability === undefined) return unavailableForTraitOffer(evaluation, query.trait);
  const branches = capability.echoLastReward(query.value, query.optionKey);
  const first = branches[0];
  if (first === undefined) return unavailableForTraitOffer(evaluation, query.trait);
  const identity = JSON.stringify(first);
  if (!branches.every((branch) => JSON.stringify(branch) === identity))
    return unavailableForTraitOffer(evaluation, query.trait);
  return Object.freeze({
    kind: 'echoLastRewardDomain',
    result: Object.freeze({
      rewardType: first.recreation.offer.rewardType,
      defaultValue: first.defaultValue,
    }),
  });
}
