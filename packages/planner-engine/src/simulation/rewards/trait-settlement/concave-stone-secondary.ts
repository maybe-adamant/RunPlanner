import type { Catalog } from '../../../catalog-schema';
import {
  createTraitOfferAddress,
  type TraitOfferOwnerAddress,
} from '../../../authored-project/addresses';
import { optionIndex, type AuthoredTraitOfferTraits } from '../../../authored-project/traits/state';
import type { FindingChronology } from '../../finding-regions';
import type { ReachedTraitOfferEvaluation } from '../../traits';
import type { TraitOfferOptionLevelResolution } from '../../traits/offer-levels';
import {
  concaveStoneProcSupport,
  concaveStoneResidualOptionKeys,
} from '../../keepsakes/trait-effects';
import type { RewardBranchState } from '../branch-primitives';
import {
  createTraitChildFindingEntry,
  type TraitChildFindingEntry,
} from './selected-child-settlement';

export interface FrozenConcaveStoneSecondary {
  readonly offer: AuthoredTraitOfferTraits;
  readonly sourceOptionKey: AuthoredTraitOfferTraits['selectedOptionKey'];
  readonly levelResolution?: TraitOfferOptionLevelResolution;
}

export interface ConcaveStoneSecondarySettlement {
  readonly findings: readonly TraitChildFindingEntry[];
  readonly secondary?: FrozenConcaveStoneSecondary;
  readonly blockedChild?: {
    readonly address: import('../../../authored-project/addresses').SemanticAddress;
    readonly candidateContext: import('../../traits').TraitOfferCandidateContext;
  };
}

/** Preserves the source-screen row and level assessment for Concave Stone's one secondary acquisition. */
export function prepareConcaveStoneSecondary(
  catalog: Catalog,
  branch: RewardBranchState,
  owner: TraitOfferOwnerAddress | undefined,
  role: string,
  authored: AuthoredTraitOfferTraits,
  effectiveAuthored: AuthoredTraitOfferTraits,
  evaluation: ReachedTraitOfferEvaluation,
  selectedTraitKey: string | undefined,
  candidateContext: import('../../traits').TraitOfferCandidateContext,
  lifecyclePoint: string,
  sequence: number,
  findingChronology?: FindingChronology,
): ConcaveStoneSecondarySettlement {
  const support = concaveStoneProcSupport(catalog, branch.state.keepsakes);
  const result = authored.concaveStoneResult;
  const traitAddress = owner === undefined ? undefined : createTraitOfferAddress(owner, role);
  const findings: TraitChildFindingEntry[] = [];
  const reject = (code: 'concaveStoneResultMissing' | 'concaveStoneResultUnavailable') => {
    if (traitAddress === undefined) return undefined;
    findings.push(
      createTraitChildFindingEntry(
        traitAddress,
        lifecyclePoint,
        sequence,
        code,
        selectedTraitKey,
        result === undefined ? 'unresolved' : String(result.kind),
        findingChronology,
      ),
    );
    return Object.freeze({ address: traitAddress, candidateContext });
  };
  if (support === undefined) {
    const blockedChild =
      result?.kind === 'proc' ? reject('concaveStoneResultUnavailable') : undefined;
    return Object.freeze({
      findings: Object.freeze(findings),
      ...(blockedChild === undefined ? {} : { blockedChild }),
    });
  }
  const residualKeys = concaveStoneResidualOptionKeys(
    effectiveAuthored,
    (['option1', 'option2', 'option3'] as const).filter(
      (key) => evaluation.assessments[optionIndex(key)]?.replacementTransition !== undefined,
    ),
  );
  if (residualKeys.length === 0) {
    const blockedChild =
      result?.kind === 'proc' ? reject('concaveStoneResultUnavailable') : undefined;
    return Object.freeze({
      findings: Object.freeze(findings),
      ...(blockedChild === undefined ? {} : { blockedChild }),
    });
  }
  if (result === undefined) {
    const blockedChild = support >= 100 ? reject('concaveStoneResultMissing') : undefined;
    return Object.freeze({
      findings: Object.freeze(findings),
      ...(blockedChild === undefined ? {} : { blockedChild }),
    });
  }
  if (result.kind === 'noProc') {
    const blockedChild = support >= 100 ? reject('concaveStoneResultUnavailable') : undefined;
    return Object.freeze({
      findings: Object.freeze(findings),
      ...(blockedChild === undefined ? {} : { blockedChild }),
    });
  }
  if (!residualKeys.includes(result.optionKey)) {
    const blockedChild = reject('concaveStoneResultUnavailable');
    return Object.freeze({
      findings: Object.freeze(findings),
      ...(blockedChild === undefined ? {} : { blockedChild }),
    });
  }
  const residual = effectiveAuthored.options[optionIndex(result.optionKey)];
  if (residual === undefined) {
    const blockedChild = reject('concaveStoneResultUnavailable');
    return Object.freeze({
      findings: Object.freeze(findings),
      ...(blockedChild === undefined ? {} : { blockedChild }),
    });
  }
  return Object.freeze({
    findings: Object.freeze(findings),
    secondary: Object.freeze({
      sourceOptionKey: result.optionKey,
      offer: Object.freeze({
        kind: 'traits',
        giverKey: effectiveAuthored.giverKey,
        options: Object.freeze([
          Object.freeze({ ...residual }),
        ]) as AuthoredTraitOfferTraits['options'],
        selectedOptionKey: 'option1',
        rarificationActions: Object.freeze([]),
      }),
      ...(evaluation.levelResolutions[optionIndex(result.optionKey)] === undefined
        ? {}
        : { levelResolution: evaluation.levelResolutions[optionIndex(result.optionKey)] }),
    }),
  });
}
