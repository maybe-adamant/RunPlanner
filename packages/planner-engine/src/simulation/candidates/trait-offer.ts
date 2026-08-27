import type { Catalog } from '../../catalog-schema';
import type {
  NaturalSelectionResultAddress,
  TraitOfferAddress,
} from '../../authored-project/addresses';
import {
  optionIndex,
  type AuthoredTraitOffer,
  type TraitOptionKey,
} from '../../authored-project/traits';
import type { ProjectDocument } from '../../authored-project/model';
import type {
  ConcaveStoneCandidateBranch,
  TraitOfferCandidateArtifacts,
} from './trait-offer-capability';
import type { ProjectEvaluation } from '../evaluation-products';
import type {
  TraitAssessment,
  TraitAssessmentFinding,
  TraitFindingCode,
  TraitOfferCompositionAssessment,
  TraitOfferCompositionFinding,
  TraitReplacementCompositionAssessment,
  TraitTargetedAcquisitionAssessment,
} from '../traits';
import type { CandidateContextUnavailable } from './availability';
import { unavailableForTraitOffer } from './trait-offer-availability';

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
export type DirectTraitOutcomeSupport = 'forced' | 'possible' | 'impossible';
export interface EvaluatedDirectTraitOutcomeCandidate<T> {
  readonly value: T;
  readonly support: DirectTraitOutcomeSupport;
  readonly branchSupport: readonly boolean[];
  readonly selected: boolean;
  readonly reason?: 'branchDivergence' | 'duplicateTrait' | 'unavailable';
}
export interface EvaluatedCirceResolutionDomain {
  readonly kind: 'circeResolutionDomain';
  readonly result: {
    readonly effect: 'activateArcana' | 'promoteArcana' | 'disableFear';
    readonly requiredCount: number;
    readonly branchAgreement: boolean;
    readonly arcanaCandidates: readonly EvaluatedDirectTraitOutcomeCandidate<string>[];
    readonly vowCandidates: readonly EvaluatedDirectTraitOutcomeCandidate<string>[];
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

/** Exact selected Natural Selection sequence beneath one chosen trait option. */
export interface NaturalSelectionResultCandidateQuery {
  readonly kind: 'naturalSelectionResult';
  readonly result: NaturalSelectionResultAddress;
  readonly value: AuthoredTraitOffer;
  readonly targets: readonly string[] | undefined;
}

/** Read-only derived transform for a selected King's or Queen's Ransom. */
export interface RansomAssessmentCandidateQuery {
  readonly kind: 'ransomAssessment';
  readonly trait: TraitOfferAddress;
  readonly value: AuthoredTraitOffer;
}
export interface EvaluatedRansomAssessmentCandidate {
  readonly kind: 'ransomAssessment';
  readonly result: {
    readonly assessments: readonly import('../traits').RansomAssessment[];
    readonly branchAgreement: boolean;
  };
}
export type RansomAssessmentCandidateEvaluation =
  CandidateContextUnavailable | EvaluatedRansomAssessmentCandidate;
export interface EvaluatedNaturalSelectionResultCandidate {
  readonly kind: 'naturalSelectionResult';
  readonly result: {
    readonly supported: boolean;
    readonly complete: boolean;
    readonly nextTargetTraitKeys: readonly string[];
    readonly branchSupport: readonly boolean[];
    readonly findings: readonly TraitOfferCandidateFinding[];
  };
}
export type NaturalSelectionResultCandidateEvaluation =
  CandidateContextUnavailable | EvaluatedNaturalSelectionResultCandidate;
export interface EvaluatedEchoPomTargetDomain {
  readonly kind: 'echoPomTargetDomain';
  readonly result: {
    readonly candidates: readonly EvaluatedDirectTraitOutcomeCandidate<string | null>[];
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
  readonly effectiveRarity?: import('../../catalog-schema').TraitRarity;
  readonly support: DirectTraitOutcomeSupport;
  readonly branchSupport: readonly boolean[];
  readonly reason?: 'branchDivergence' | 'unavailable';
  readonly targetRequired: boolean;
  readonly targetCandidates: readonly EvaluatedDirectTraitOutcomeCandidate<string>[];
}
export interface EvaluatedEchoLastRunBoonDomain {
  readonly kind: 'echoLastRunBoonDomain';
  readonly result: {
    readonly candidates: readonly EvaluatedEchoLastRunBoonCandidate[];
  };
}
export type EchoLastRunBoonDomainEvaluation =
  CandidateContextUnavailable | EvaluatedEchoLastRunBoonDomain;

export interface EchoLastRunBoonTraitIdentity {
  readonly giverKey: string;
  readonly traitKey: string;
}

export interface EchoLastRunBoonDraftRow {
  readonly giverKey?: string;
  readonly traitKey?: string;
  readonly rarity?: import('../../catalog-schema').TraitRarity;
  readonly targetTraitKey?: string;
}

export interface EchoLastRunBoonDraftSupport {
  readonly rowSupport: readonly boolean[];
  readonly selectedTargetSupported: boolean;
  readonly complete: boolean;
  readonly remainingTraitIdentities: readonly EchoLastRunBoonTraitIdentity[];
  readonly canAppend: boolean;
}

/**
 * Evaluates one transient BBB compound draft without inventing a persisted
 * default. Exact row support, selected-target support, and remaining identities
 * stay engine-owned while the application holds partial rows locally.
 */
export function evaluateEchoLastRunBoonDraftSupport(
  candidates: readonly EvaluatedEchoLastRunBoonCandidate[],
  rows: readonly EchoLastRunBoonDraftRow[],
  selectedIndex: number,
): EchoLastRunBoonDraftSupport {
  const traitKeys = rows.flatMap((row) => (row.traitKey === undefined ? [] : [row.traitKey]));
  const distinctTraits = new Set(traitKeys).size === traitKeys.length;
  const exactCandidates = rows.map((row) =>
    row.giverKey === undefined || row.traitKey === undefined || row.rarity === undefined
      ? undefined
      : candidates.find(
          (candidate) =>
            candidate.option.giverKey === row.giverKey &&
            candidate.option.traitKey === row.traitKey &&
            candidate.option.rarity === row.rarity,
        ),
  );
  const rowSupport = Object.freeze(
    exactCandidates.map(
      (candidate) =>
        distinctTraits && candidate !== undefined && candidate.support !== 'impossible',
    ),
  );
  const selectedRow = rows[selectedIndex];
  const selectedCandidate = exactCandidates[selectedIndex];
  const selectedTargetSupported =
    selectedRow !== undefined &&
    selectedCandidate !== undefined &&
    (selectedCandidate.targetRequired
      ? selectedRow.targetTraitKey !== undefined &&
        selectedCandidate.targetCandidates.some(
          (candidate) =>
            candidate.value === selectedRow.targetTraitKey && candidate.support !== 'impossible',
        )
      : selectedRow.targetTraitKey === undefined);
  const remaining = new Map<string, EchoLastRunBoonTraitIdentity>();
  for (const candidate of candidates) {
    if (candidate.support === 'impossible' || traitKeys.includes(candidate.option.traitKey))
      continue;
    const key = `${candidate.option.giverKey}:${candidate.option.traitKey}`;
    remaining.set(
      key,
      Object.freeze({
        giverKey: candidate.option.giverKey,
        traitKey: candidate.option.traitKey,
      }),
    );
  }
  const remainingTraitIdentities = Object.freeze([...remaining.values()]);
  const complete =
    rows.length >= 1 && rows.length <= 3 && rowSupport.every(Boolean) && selectedTargetSupported;
  return Object.freeze({
    rowSupport,
    selectedTargetSupported,
    complete,
    remainingTraitIdentities,
    canAppend: rows.length < 3 && remainingTraitIdentities.length > 0,
  });
}

/**
 * Projects the exact mixed-provider domain into one transient BBB row. Trait
 * distinctness remains an engine rule even while the application is building
 * a complete child outside persisted authored state.
 */
export function echoLastRunBoonTraitCandidatesForRow(
  candidates: readonly EvaluatedEchoLastRunBoonCandidate[],
  occupiedTraitKeys: readonly string[],
  selected: EchoLastRunBoonTraitIdentity | undefined,
): readonly EvaluatedDirectTraitOutcomeCandidate<EchoLastRunBoonTraitIdentity>[] {
  const identities = new Map<string, EchoLastRunBoonTraitIdentity>();
  for (const candidate of candidates) {
    const key = `${candidate.option.giverKey}:${candidate.option.traitKey}`;
    identities.set(
      key,
      Object.freeze({
        giverKey: candidate.option.giverKey,
        traitKey: candidate.option.traitKey,
      }),
    );
  }
  return Object.freeze(
    [...identities.values()].map((identity) => {
      const variants = candidates.filter(
        (candidate) =>
          candidate.option.giverKey === identity.giverKey &&
          candidate.option.traitKey === identity.traitKey,
      );
      const branchCount = variants[0]?.branchSupport.length ?? 0;
      const branchSupport = Object.freeze(
        Array.from({ length: branchCount }, (_, index) =>
          variants.some((candidate) => candidate.branchSupport[index] === true),
        ),
      );
      const duplicate = occupiedTraitKeys.includes(identity.traitKey);
      // One exact persisted rarity must survive every branch. Do not make a
      // trait selectable by combining different rarity variants per branch.
      const universallySupported =
        !duplicate && variants.some((candidate) => candidate.support !== 'impossible');
      return Object.freeze({
        value: identity,
        support: universallySupported ? ('possible' as const) : ('impossible' as const),
        branchSupport,
        selected:
          selected?.giverKey === identity.giverKey && selected.traitKey === identity.traitKey,
        ...(!universallySupported
          ? {
              reason: duplicate
                ? ('duplicateTrait' as const)
                : branchSupport.some(Boolean)
                  ? ('branchDivergence' as const)
                  : ('unavailable' as const),
            }
          : {}),
      });
    }),
  );
}

/** Exact rarity domain for one transient BBB provider/trait row. */
export function echoLastRunBoonRarityCandidates(
  candidates: readonly EvaluatedEchoLastRunBoonCandidate[],
  identity: EchoLastRunBoonTraitIdentity,
  selectedRarity: import('../../catalog-schema').TraitRarity | undefined,
): readonly EvaluatedDirectTraitOutcomeCandidate<import('../../catalog-schema').TraitRarity>[] {
  return Object.freeze(
    candidates
      .filter(
        (candidate) =>
          candidate.option.giverKey === identity.giverKey &&
          candidate.option.traitKey === identity.traitKey,
      )
      .map((candidate) =>
        Object.freeze({
          value: candidate.option.rarity,
          support: candidate.support,
          branchSupport: candidate.branchSupport,
          selected: candidate.option.rarity === selectedRarity,
          ...(candidate.reason === undefined ? {} : { reason: candidate.reason }),
        }),
      ),
  );
}

export interface AllTogetherSetDomainQuery {
  readonly kind: 'allTogetherSetDomain';
  readonly trait: TraitOfferAddress;
  readonly value: AuthoredTraitOffer;
  readonly optionKey: TraitOptionKey;
  readonly setKey: import('../../catalog-schema').DirectTraitSetKey;
}
export interface EvaluatedAllTogetherSetDomain {
  readonly kind: 'allTogetherSetDomain';
  readonly result: {
    readonly setKey: import('../../catalog-schema').DirectTraitSetKey;
    readonly candidates: readonly EvaluatedDirectTraitOutcomeCandidate<string | null>[];
  };
}
export type AllTogetherSetDomainEvaluation =
  CandidateContextUnavailable | EvaluatedAllTogetherSetDomain;

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
  readonly persephoneLevelBonusMaximums: readonly (number | undefined)[];
  readonly effectiveLevels: readonly (number | undefined)[];
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
    readonly concaveStone?: readonly ConcaveStoneCandidateBranch[];
    /** Branch-correlated active Chaos restrictions at this complete offer. */
    readonly chaosOfferRules?: readonly {
      readonly ordinaryRequiresCommon: boolean;
      readonly rejectedBlockRequired: boolean;
      readonly rejectedBlockableOptionKeys: readonly TraitOptionKey[];
      readonly rejectedBlockNeedsRepair: boolean;
    }[];
    /** Published only when every surviving branch agrees for each option. */
    readonly persephoneLevelBonusMaximums: readonly (number | undefined)[];
    readonly effectiveLevels: readonly (number | undefined)[];
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
  if (offer.kind !== 'traits') return Object.freeze([]);
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
    readonly persephoneLevelBonusMaximums: readonly (number | undefined)[];
    readonly effectiveLevels: readonly (number | undefined)[];
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
        persephoneLevelBonusMaximums: branch.persephoneLevelBonusMaximums,
        effectiveLevels: branch.effectiveLevels,
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

function evaluatedTraitOfferCandidate(
  assessment: TraitOfferCandidateAssessment,
  callingCard: readonly CallingCardOfferCandidateBranch[],
  concaveStone: readonly ConcaveStoneCandidateBranch[] = Object.freeze([]),
  chaosOfferRules: readonly {
    readonly ordinaryRequiresCommon: boolean;
    readonly rejectedBlockRequired: boolean;
    readonly rejectedBlockableOptionKeys: readonly TraitOptionKey[];
    readonly rejectedBlockNeedsRepair: boolean;
  }[] = Object.freeze([]),
): EvaluatedTraitOfferCandidate {
  const agreeingBranchValues = (
    key: 'persephoneLevelBonusMaximums' | 'effectiveLevels',
  ): readonly (number | undefined)[] => {
    const width = assessment.branches[0]?.[key].length ?? 0;
    return Object.freeze(
      Array.from({ length: width }, (_, index) => {
        const values = assessment.branches.map((branch) => branch[key][index]);
        return values.length > 0 && values.every((value) => value === values[0])
          ? values[0]
          : undefined;
      }),
    );
  };
  return Object.freeze({
    kind: 'traitOffer',
    result: Object.freeze({
      supported: assessment.supported,
      branches: assessment.branches,
      assessments: assessment.assessments,
      findings: assessment.findings,
      callingCard: Object.freeze(callingCard),
      concaveStone: Object.freeze(concaveStone),
      chaosOfferRules: Object.freeze(chaosOfferRules),
      persephoneLevelBonusMaximums: agreeingBranchValues('persephoneLevelBonusMaximums'),
      effectiveLevels: agreeingBranchValues('effectiveLevels'),
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
          branch.effectiveOffer.kind !== 'traits'
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
  const concaveStone = Object.freeze(capability?.concaveStone(query.value) ?? []);
  const chaosOfferRules = Object.freeze(capability?.chaosOfferRules(query.value) ?? []);
  const assessment = assessTraitOfferCandidate(
    capability === undefined ? Object.freeze([]) : capability.evaluateOffer(query.value),
    duplicateFindings,
    callingCard,
    query.value,
  );
  return evaluatedTraitOfferCandidate(assessment, callingCard, concaveStone, chaosOfferRules);
}

export function evaluateTraitOfferFocusedOptionCandidate(
  _catalog: Catalog,
  _project: ProjectDocument,
  evaluation: ProjectEvaluation,
  candidateArtifacts: TraitOfferCandidateArtifacts | undefined,
  query: TraitOfferFocusedOptionCandidateQuery,
): TraitOfferFocusedOptionCandidateEvaluation {
  if (query.value.kind !== 'traits') return unavailableForTraitOffer(evaluation, query.trait);
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
  if (query.value.kind !== 'traits') return unavailableForTraitOffer(evaluation, query.trait);
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
          const supported = branchSupport.length > 0 && branchSupport.every(Boolean);
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
                        detail: branchSupport.some(Boolean) ? 'branchDivergence' : traitKey,
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

export {
  evaluateAllTogetherSetDomain,
  evaluateCirceResolutionDomain,
  evaluateEchoLastRunBoonDomain,
  evaluateEchoPomTargetDomain,
  evaluateNaturalSelectionResultCandidate,
  evaluateRansomAssessmentCandidate,
} from './trait-offer-selected-effects';
