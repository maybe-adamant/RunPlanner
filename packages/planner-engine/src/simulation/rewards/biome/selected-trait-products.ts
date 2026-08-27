import {
  createTraitOfferAddress,
  semanticAddressKey,
  type LevelResolutionAddress,
  type SemanticAddress,
  type TraitOfferAddress,
  type TraitOfferOwnerAddress,
} from '../../../authored-project/addresses';
import { optionIndex } from '../../../authored-project/traits';
import type { ResolvedRuntimeOfferFallback } from '../model';
import type { RewardBranchState } from '../branch-primitives';
import type {
  ReachedLevelResolutionEvaluation,
  ReachedTraitOfferEvaluation,
  SelectedLevelResolutionAssessment,
  SelectedTraitOfferAssessment,
  TraitHistoryState,
  TraitOfferCandidateContext,
} from '../../traits';

export interface SelectedTraitOfferProducts {
  readonly selectedTraitOffers: readonly SelectedTraitOfferAssessment[];
  readonly selectedLevelResolutions: readonly SelectedLevelResolutionAssessment[];
  readonly runtimeOfferFallbacks: readonly ResolvedRuntimeOfferFallback[];
  readonly candidateContexts: ReadonlyMap<string, readonly TraitOfferCandidateContext[]>;
  readonly levelCandidateContexts: ReadonlyMap<
    string,
    readonly {
      readonly address: LevelResolutionAddress;
      readonly before: TraitHistoryState;
      readonly levelCount: number;
      readonly effectKind: 'choice' | 'random';
      readonly emptyTargetAllowed?: boolean;
    }[]
  >;
}

function traitOwnerAddress(origin: SemanticAddress): TraitOfferOwnerAddress | undefined {
  switch (origin.kind) {
    case 'incomingReward':
    case 'localReward':
    case 'rewardWheelOffer':
    case 'shopOffer':
    case 'encounterPhase':
    case 'gorgonPhase':
    case 'acquisitionEntry':
      return origin;
    default:
      return undefined;
  }
}

/** Freezes reached trait and level products after chronological evaluation completes. */
export function selectedTraitOfferProducts(
  branches: readonly RewardBranchState[],
  retainedLevelEvaluations: readonly ReachedLevelResolutionEvaluation[] = Object.freeze([]),
): SelectedTraitOfferProducts {
  const grouped = new Map<
    string,
    {
      readonly address: TraitOfferAddress;
      readonly acquisitionRole: string;
      readonly offer: ReachedTraitOfferEvaluation['offer'];
      readonly branches: ReachedTraitOfferEvaluation[];
      chronologicalIndex: number;
    }
  >();
  const directRuntimeFallbacks = new Map<
    string,
    {
      readonly address: SemanticAddress;
      readonly preferredKey: string;
      readonly fallbackKeys: (string | undefined)[];
    }
  >();
  for (const branch of branches) {
    for (const trace of branch.traitEvaluations ?? []) {
      const owner = traitOwnerAddress(trace.address);
      if (owner === undefined) {
        if (trace.offer.kind === 'traits') {
          const key = semanticAddressKey(trace.address);
          const current = directRuntimeFallbacks.get(key);
          if (current === undefined)
            directRuntimeFallbacks.set(key, {
              address: trace.address,
              preferredKey:
                trace.offer.options[optionIndex(trace.offer.selectedOptionKey)]!.traitKey,
              fallbackKeys: [trace.runtimeOfferFallbackTraitKey],
            });
          else if (!current.fallbackKeys.includes(trace.runtimeOfferFallbackTraitKey))
            current.fallbackKeys.push(trace.runtimeOfferFallbackTraitKey);
        }
        continue;
      }
      const address = createTraitOfferAddress(owner, trace.acquisitionRole);
      const key = semanticAddressKey(address);
      const current = grouped.get(key);
      if (current === undefined) {
        grouped.set(key, {
          address,
          acquisitionRole: trace.acquisitionRole,
          offer: trace.offer,
          branches: [trace],
          chronologicalIndex: trace.chronologicalIndex,
        });
      } else {
        const duplicate = current.branches.some(
          (candidate) =>
            JSON.stringify([
              candidate.before,
              candidate.context,
              candidate.offer,
              candidate.arcanaFear,
            ]) === JSON.stringify([trace.before, trace.context, trace.offer, trace.arcanaFear]),
        );
        if (!duplicate) current.branches.push(trace);
        current.chronologicalIndex = Math.min(current.chronologicalIndex, trace.chronologicalIndex);
      }
    }
  }
  const selectedTraitOffers = Object.freeze(
    [...grouped.values()]
      .sort(
        (left, right) =>
          left.chronologicalIndex - right.chronologicalIndex ||
          semanticAddressKey(left.address).localeCompare(semanticAddressKey(right.address)),
      )
      .map((entry) =>
        Object.freeze({
          address: entry.address,
          acquisitionRole: entry.acquisitionRole,
          offer: entry.offer,
          branches: Object.freeze(
            entry.branches.map((trace) =>
              Object.freeze({
                assessments: trace.assessments,
                composition: trace.composition,
                replacementComposition: trace.replacementComposition,
                targetedAcquisition: trace.targetedAcquisition,
                persephoneLevelBonusMaximums: Object.freeze(
                  trace.levelResolutions.map(
                    (resolution) => resolution.persephoneLevelBonusMaximum,
                  ),
                ),
                effectiveLevels: Object.freeze(
                  trace.levelResolutions.map((resolution) => resolution.effectiveLevel),
                ),
              }),
            ),
          ),
          reached: true as const,
          chronologicalIndex: entry.chronologicalIndex,
        }),
      ),
  );
  const candidateContexts = new Map<string, readonly TraitOfferCandidateContext[]>();
  for (const entry of grouped.values()) {
    const address = createTraitOfferAddress(entry.address.owner, entry.acquisitionRole);
    candidateContexts.set(
      semanticAddressKey(address),
      Object.freeze(
        entry.branches.map((trace) =>
          Object.freeze({
            before: trace.before,
            context: trace.context,
            ...(trace.arcanaFear === undefined ? {} : { arcanaFear: trace.arcanaFear }),
            ...(trace.keepsakes === undefined ? {} : { keepsakes: trace.keepsakes }),
          }),
        ),
      ),
    );
  }
  const levels = new Map<
    string,
    {
      address: LevelResolutionAddress;
      value: ReachedLevelResolutionEvaluation['value'];
      branches: ReachedLevelResolutionEvaluation[];
      chronologicalIndex: number;
    }
  >();
  for (const trace of [
    ...branches.flatMap((branch) => branch.levelResolutionEvaluations ?? []),
    ...retainedLevelEvaluations,
  ]) {
    const key = semanticAddressKey(trace.address);
    const current = levels.get(key);
    if (current === undefined)
      levels.set(key, {
        address: trace.address,
        value: trace.value,
        branches: [trace],
        chronologicalIndex: trace.chronologicalIndex,
      });
    else if (
      !current.branches.some(
        (candidate) =>
          JSON.stringify([candidate.before, candidate.value]) ===
          JSON.stringify([trace.before, trace.value]),
      )
    ) {
      current.branches.push(trace);
      current.chronologicalIndex = Math.min(current.chronologicalIndex, trace.chronologicalIndex);
    }
  }
  const selectedLevelResolutions = Object.freeze(
    [...levels.values()]
      .sort((left, right) => left.chronologicalIndex - right.chronologicalIndex)
      .map((entry) =>
        Object.freeze({
          address: entry.address,
          value: entry.value,
          branches: Object.freeze(
            entry.branches.map((trace) =>
              Object.freeze({
                findings: trace.findings,
                levelCount: trace.levelCount,
                emptyTargetAllowed: trace.emptyTargetAllowed,
                eligibleTargetCount: trace.before.upgradableTraitCount,
              }),
            ),
          ),
          reached: true as const,
          chronologicalIndex: entry.chronologicalIndex,
        }),
      ),
  );
  const levelCandidateContexts = new Map<
    string,
    readonly {
      readonly address: LevelResolutionAddress;
      readonly before: TraitHistoryState;
      readonly levelCount: number;
      readonly effectKind: 'choice' | 'random';
      readonly emptyTargetAllowed?: boolean;
    }[]
  >();
  for (const [key, entry] of levels) {
    levelCandidateContexts.set(
      key,
      Object.freeze(
        entry.branches.map((trace) =>
          Object.freeze({
            address: trace.address,
            before: trace.before,
            levelCount: trace.levelCount,
            effectKind: trace.effectKind,
            ...(trace.emptyTargetAllowed ? { emptyTargetAllowed: true } : {}),
          }),
        ),
      ),
    );
  }
  return Object.freeze({
    selectedTraitOffers,
    selectedLevelResolutions,
    runtimeOfferFallbacks: Object.freeze([
      ...[...grouped.values()].flatMap((entry) => {
        const keys = new Set(entry.branches.map((trace) => trace.runtimeOfferFallbackTraitKey));
        const fallbackKey = keys.size === 1 ? [...keys][0] : undefined;
        return fallbackKey === undefined || entry.offer.kind !== 'traits'
          ? []
          : [
              Object.freeze({
                address: entry.address,
                preferredKey:
                  entry.offer.options[optionIndex(entry.offer.selectedOptionKey)]!.traitKey,
                fallbackKey,
              }),
            ];
      }),
      ...[...directRuntimeFallbacks.values()].flatMap((entry) =>
        entry.fallbackKeys.length === 1 && entry.fallbackKeys[0] !== undefined
          ? [
              Object.freeze({
                address: entry.address,
                preferredKey: entry.preferredKey,
                fallbackKey: entry.fallbackKeys[0]!,
              }),
            ]
          : [],
      ),
    ]),
    candidateContexts,
    levelCandidateContexts,
  });
}
