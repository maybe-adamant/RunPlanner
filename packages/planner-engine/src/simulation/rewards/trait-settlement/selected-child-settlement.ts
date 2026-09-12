import type { Catalog, TraitSelectedDisposition } from '../../../catalog-schema';
import {
  createAllTogetherSetAddress,
  createNaturalSelectionResultAddress,
  createTraitAcquisitionTargetAddress,
  type SemanticAddress,
  type TraitOfferAddress,
} from '../../../authored-project/addresses';
import type { AuthoredTraitOfferTraits } from '../../../authored-project/traits/state';
import { ownerRegion, type FindingChronology } from '../../finding-regions';
import type { SemanticFinding, TraitFindingCode } from '../../model';
import {
  assessNaturalSelectionTargets,
  directTraitSetOutcomes,
  recordDirectTraitGrants,
  type TraitHistoryState,
} from '../../traits';

export interface TraitChildFindingEntry {
  readonly finding: SemanticFinding;
  readonly atomicRegion: string;
  readonly chronology?: FindingChronology;
}

export interface SelectedTraitChildSettlement {
  readonly traitHistory: TraitHistoryState;
  readonly findings: readonly TraitChildFindingEntry[];
  readonly blockedChild?: {
    readonly address: SemanticAddress;
    readonly candidateContext: import('../../traits').TraitOfferCandidateContext;
  };
}

export interface SelectedTraitChildSettlementInput {
  readonly catalog: Catalog;
  readonly traitHistory: TraitHistoryState;
  readonly traitAddress: TraitOfferAddress | undefined;
  readonly selectedOptionKey: 'option1' | 'option2' | 'option3';
  readonly selected: AuthoredTraitOfferTraits['options'][number] | undefined;
  readonly selectedDisposition: TraitSelectedDisposition | undefined;
  readonly targetedAcquisition: import('../../traits').TraitTargetedAcquisitionAssessment;
  readonly before: TraitHistoryState;
  readonly candidateContext: import('../../traits').TraitOfferCandidateContext;
  readonly directTraitSetBranchHistories: readonly TraitHistoryState[];
  readonly lifecyclePoint: string;
  readonly sequence: number;
  readonly findingChronology?: FindingChronology;
}

export function createTraitChildFindingEntry(
  origin: SemanticAddress,
  lifecyclePoint: string,
  sequence: number,
  code: TraitFindingCode,
  traitKey: string | undefined,
  detail: string | undefined,
  chronology: FindingChronology | undefined,
  atomicRegion = ownerRegion(origin),
): TraitChildFindingEntry {
  return Object.freeze({
    finding: Object.freeze({
      code,
      severity: 'error',
      phase: 'rewardGeneration',
      origin,
      evidence: Object.freeze({
        lifecyclePoint,
        ...(traitKey === undefined ? {} : { traitKey }),
        ...(detail === undefined ? {} : { detail }),
      }),
    }),
    atomicRegion,
    chronology: chronology ?? Object.freeze({ kind: 'history', sequence, boundary: 'at' }),
  });
}

/** Settles selected-offer children that share the outer selected-acquisition frontier. */
export function settleSelectedTraitChildren(
  input: SelectedTraitChildSettlementInput,
): SelectedTraitChildSettlement {
  const { selected, selectedDisposition, traitAddress } = input;
  if (selected === undefined || traitAddress === undefined)
    return Object.freeze({ traitHistory: input.traitHistory, findings: Object.freeze([]) });
  const findings: TraitChildFindingEntry[] = [];
  let blockedChild: SelectedTraitChildSettlement['blockedChild'];
  if (selectedDisposition?.kind === 'naturalSelection') {
    const address = createNaturalSelectionResultAddress(traitAddress, input.selectedOptionKey);
    const assessment = assessNaturalSelectionTargets(
      input.catalog,
      input.before,
      selectedDisposition.levelCount,
      selectedDisposition.slots,
      selected.naturalSelectionTargets,
    );
    if (!assessment.legal || !assessment.complete) {
      blockedChild = Object.freeze({ address, candidateContext: input.candidateContext });
      findings.push(
        createTraitChildFindingEntry(
          address,
          input.lifecyclePoint,
          input.sequence,
          selected.naturalSelectionTargets === undefined
            ? 'naturalSelectionResultMissing'
            : 'naturalSelectionResultUnavailable',
          selected.traitKey,
          assessment.legal ? 'incomplete' : 'unavailable',
          input.findingChronology,
          ownerRegion(traitAddress),
        ),
      );
    }
  }
  if (input.targetedAcquisition.applies && !input.targetedAcquisition.legal) {
    const address = createTraitAcquisitionTargetAddress(traitAddress, input.selectedOptionKey);
    blockedChild = Object.freeze({ address, candidateContext: input.candidateContext });
    for (const finding of input.targetedAcquisition.findings)
      findings.push(
        createTraitChildFindingEntry(
          address,
          input.lifecyclePoint,
          input.sequence,
          finding.code,
          finding.traitKey,
          finding.detail,
          input.findingChronology,
          ownerRegion(traitAddress),
        ),
      );
  }
  let traitHistory = input.traitHistory;
  if (selectedDisposition?.kind === 'directTraitSets') {
    const result = selected.allTogetherResult;
    const grants: { readonly owner: SemanticAddress; readonly traitKey: string }[] = [];
    let invalid = false;
    if (result === undefined) {
      const firstSet = selectedDisposition.sets[0];
      if (firstSet !== undefined) {
        const address = createAllTogetherSetAddress(
          traitAddress,
          input.selectedOptionKey,
          firstSet.key,
        );
        blockedChild ??= Object.freeze({ address, candidateContext: input.candidateContext });
        findings.push(
          createTraitChildFindingEntry(
            address,
            input.lifecyclePoint,
            input.sequence,
            'allTogetherResultMissing',
            selected.traitKey,
            'unresolved',
            input.findingChronology,
            ownerRegion(traitAddress),
          ),
        );
        invalid = true;
      }
    }
    for (const set of selectedDisposition.sets) {
      if (result === undefined) break;
      const address = createAllTogetherSetAddress(traitAddress, input.selectedOptionKey, set.key);
      const domains = input.directTraitSetBranchHistories.map((history) =>
        directTraitSetOutcomes(input.catalog, history, selected.traitKey, set.key),
      );
      const hasResult = Object.prototype.hasOwnProperty.call(result, set.key);
      const value = result[set.key];
      const branchSupported = domains.map((domain) => domain.includes(value ?? null));
      if (!hasResult || branchSupported.length === 0 || !branchSupported.every(Boolean)) {
        invalid = true;
        blockedChild ??= Object.freeze({ address, candidateContext: input.candidateContext });
        findings.push(
          createTraitChildFindingEntry(
            address,
            input.lifecyclePoint,
            input.sequence,
            hasResult ? 'allTogetherResultUnavailable' : 'allTogetherResultMissing',
            selected.traitKey,
            branchSupported.some(Boolean) ? 'branchDivergence' : String(value),
            input.findingChronology,
            ownerRegion(traitAddress),
          ),
        );
      } else if (value !== null && value !== undefined) {
        grants.push(Object.freeze({ owner: address, traitKey: value }));
      }
    }
    if (!invalid)
      traitHistory = recordDirectTraitGrants(
        input.catalog,
        traitHistory,
        input.sequence,
        input.lifecyclePoint,
        selected.traitKey,
        grants,
      );
  }
  return Object.freeze({
    traitHistory,
    findings: Object.freeze(findings),
    ...(blockedChild === undefined ? {} : { blockedChild }),
  });
}
