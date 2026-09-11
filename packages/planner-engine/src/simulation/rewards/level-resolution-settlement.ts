import type { Catalog } from '../../catalog-schema';
import {
  createLevelResolutionAddress,
  type TraitOfferOwnerAddress,
} from '../../authored-project/addresses';
import type { AuthoredLevelResolution } from '../../authored-project/traits';
import { levelResolutionEffectFor } from '../../reward-kernel/level-effects';
import type { CanonicalResolvedIncomingReward } from '../materialization';
import { ownerRegion, type FindingChronology, type FindingRegionEntry } from '../finding-regions';
import {
  attachTraitHistory,
  createTraitHistoryState,
  evaluateReachedLevelResolution,
  foldTraitHistoryEvents,
  recordReachedLevelResolution,
  type TraitHistoryState,
} from '../traits';
import type { RewardBranchState } from './branch-primitives';
import { addRewardFinding } from './findings';

export interface LevelResolutionSettlementInput {
  readonly catalog: Catalog;
  readonly branch: RewardBranchState;
  readonly reward: {
    readonly offer?: CanonicalResolvedIncomingReward['offer'];
    readonly producerKind?: CanonicalResolvedIncomingReward['producerKind'];
    readonly producerLifecycleKey?: string;
    readonly levelResolutionGenerationHistory?: TraitHistoryState;
  };
  readonly owner: TraitOfferOwnerAddress | undefined;
  readonly role: string;
  readonly authoredLevelResolution: AuthoredLevelResolution | undefined;
  readonly lifecyclePoint: string;
  readonly sequence: number;
  readonly findingChronology?: FindingChronology;
}

export interface LevelResolutionSettlementProduct {
  readonly branch: RewardBranchState;
  readonly findingEntries: readonly FindingRegionEntry[];
}

/**
 * Resolves one declaration-owned level effect with its source-time generation
 * history and current-time application history kept deliberately distinct.
 */
export function settleReachedLevelResolution(
  input: LevelResolutionSettlementInput,
): LevelResolutionSettlementProduct | undefined {
  const {
    catalog,
    branch,
    reward,
    owner,
    role,
    authoredLevelResolution,
    lifecyclePoint,
    sequence,
  } = input;
  if (reward.offer === undefined || reward.producerLifecycleKey === undefined) return undefined;
  const effect = levelResolutionEffectFor(
    catalog.rewards,
    reward.offer,
    {
      kind: reward.producerKind === 'shop' ? 'shopProfile' : 'producerLifecycle',
      key: reward.producerLifecycleKey,
    },
    role,
  );
  if (effect === undefined) return undefined;
  if (owner === undefined) return Object.freeze({ branch, findingEntries: Object.freeze([]) });

  const address = createLevelResolutionAddress(owner, role);
  // A missing child is still a reached, incomplete declaration-owned Pom.
  // Do not let malformed legacy/project state silently bypass the effect.
  const levelResolution =
    authoredLevelResolution ??
    (effect.kind === 'visibleChoice'
      ? { kind: 'choice' as const, offeredTraitKeys: Object.freeze([]), selectedTraitKey: null }
      : { kind: 'random' as const, targetTraitKey: null });
  const before = branch.traitHistory ?? createTraitHistoryState();
  const generationBefore = reward.levelResolutionGenerationHistory ?? before;
  const evaluation = evaluateReachedLevelResolution(
    catalog,
    address,
    levelResolution,
    effect.levelCount,
    generationBefore,
    branch.levelResolutionEvaluations?.length ?? 0,
    effect.kind === 'visibleChoice' ? 'choice' : 'random',
    effect.kind === 'randomTargetIfAvailable',
  );
  const generated = recordReachedLevelResolution(
    catalog,
    address,
    levelResolution,
    effect.levelCount,
    generationBefore,
    sequence,
    lifecyclePoint,
    effect.kind === 'visibleChoice' ? 'choice' : 'random',
    effect.kind === 'randomTargetIfAvailable',
  );
  const generatedEvent = generated.event;
  const currentTarget =
    levelResolution.kind === 'choice'
      ? levelResolution.selectedTraitKey
      : levelResolution.targetTraitKey;
  const currentEquipped = currentTarget === null ? undefined : before.equippedTraits[currentTarget];
  const appliedHistory =
    generatedEvent === undefined || currentTarget === null || currentEquipped?.level === undefined
      ? before
      : foldTraitHistoryEvents(catalog, [
          ...before.events,
          Object.freeze({
            ...generatedEvent,
            oldLevel: currentEquipped.level,
            newLevel: currentEquipped.level + effect.levelCount,
          }),
        ]);
  const localFindings = new Map<string, FindingRegionEntry>();
  if (evaluation.findings.length > 0) {
    const codeByFinding = {
      missingTarget: 'missingPomTarget',
      wrongOfferCount: 'pomWrongOfferCount',
      duplicateTargets: 'pomWrongOfferCount',
      selectedTargetNotOffered: 'pomSelectedTargetNotOffered',
      targetUnavailable: 'pomTargetUnavailable',
      kindMismatch: 'pomTargetUnavailable',
    } as const;
    for (const finding of evaluation.findings) {
      addRewardFinding(
        localFindings,
        Object.freeze({
          code: codeByFinding[finding],
          severity: 'error',
          phase: 'rewardGeneration',
          origin: evaluation.address,
          evidence: Object.freeze({
            acquisitionRole: role,
            lifecyclePoint,
            levelCount: effect.levelCount,
          }),
        }),
        ownerRegion(evaluation.address),
        input.findingChronology ?? Object.freeze({ kind: 'history', sequence, boundary: 'at' }),
        evaluation,
      );
    }
  }
  return Object.freeze({
    branch: Object.freeze({
      ...branch,
      history: attachTraitHistory(branch.history, appliedHistory),
      traitHistory: appliedHistory,
      levelResolutionEvaluations: Object.freeze([
        ...(branch.levelResolutionEvaluations ?? []),
        evaluation,
      ]),
    }),
    findingEntries: Object.freeze([...localFindings.values()]),
  });
}
