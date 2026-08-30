import type { Catalog } from '../../catalog-schema';
import { evaluateCallingCardOffer } from '../keepsakes';
import {
  createAllTogetherSetAddress,
  createCirceResolutionAddress,
  createEchoLastRunBoonAddress,
  createEchoPomTargetAddress,
  createLevelResolutionAddress,
  createNaturalSelectionResultAddress,
  createTraitAcquisitionTargetAddress,
  createTraitOfferAddress,
  semanticAddressKey,
  type EchoLastRunBoonAddress,
  type SemanticAddress,
  type TraitOfferOwnerAddress,
} from '../../authored-project/addresses';
import { recordLootTypeHistorySource } from '../../reward-kernel';
import type { CanonicalResolvedIncomingReward } from '../materialization';
import { type SemanticFinding, type TraitFindingCode } from '../model';
import { ownerRegion, type FindingChronology, type FindingRegionEntry } from '../finding-regions';
import {
  attachTraitHistory,
  advanceChaosClock,
  assessNaturalSelectionTargets,
  assessTraitOfferBeforeRarification,
  boonRarityFactsForOffer,
  createTraitHistoryState,
  directTraitSetOutcomes,
  echoLastRunBoonOutcomes,
  echoPomGreatestLevelTraitKeys,
  evaluateReachedEchoLastRunBoonOffer,
  evaluateReachedLevelResolution,
  evaluateReachedTraitOffer,
  foldTraitHistoryEvents,
  isAspectSpellDropDormant,
  recordDirectTraitGrants,
  recordReachedLevelResolution,
  recordReachedTraitOffer,
  traitOfferCompositionDomains,
  type EchoLastRunBoonOutcome,
  type TraitHistoryState,
  type TraitOfferContext,
} from '../traits';
import {
  optionIndex,
  traitGiverForAcquisitionRole,
  type AuthoredTraitOffer,
  type AuthoredTraitOfferTraits,
} from '../../authored-project/traits';
import { levelResolutionEffectFor } from '../../reward-kernel/level-effects';
import {
  activateTemporaryArcana,
  circeResolutionDomain,
  manualArcanaGraspCost,
  promoteArcana,
  suppressFearVow,
} from '../arcana-fear';
import {
  advanceCurrentKeepsake,
  concaveStoneProcSupport,
  concaveStoneResidualOptionKeys,
  consumeConcaveStone,
  refreshKeepsakeFatedStatus,
} from '../keepsakes';
import type { RewardBranchState } from './branch-primitives';
import type { TraitOfferOptionLevelResolution } from '../trait-offer-levels';
import { bankPathPoints, installHexTree, maybeAddGodSent } from '../hex-progress';
import { addRewardFinding } from './findings';

export interface ReachedTraitChildCheckpoint {
  readonly address: SemanticAddress;
  readonly branch: RewardBranchState;
  readonly candidateContext?: import('../traits').TraitOfferCandidateContext;
}

interface ApplyTraitOfferOptions {
  readonly directAcquisition?: boolean;
  readonly skipCallingCard?: boolean;
  readonly directTraitSetBranchHistories?: readonly TraitHistoryState[];
  /** Stone's secondary row was already generated and must not be revalidated. */
  readonly frozenAcquisition?: boolean;
  /** The original screen's frozen row result for a Concave Stone residual. */
  readonly frozenLevelResolution?: TraitOfferOptionLevelResolution;
}

interface EchoLastRunBoonSettlement {
  readonly address: EchoLastRunBoonAddress;
  readonly outcome: EchoLastRunBoonOutcome;
  readonly runtimeOfferFallbackExcludedTraitKeys: readonly string[];
}

function isEligibleChaosGodScreen(
  catalog: Catalog,
  offer: AuthoredTraitOffer | undefined,
): boolean {
  if (offer === undefined) return false;
  const provider = catalog.traitGivers.byKey[offer.giverKey]?.providerKind;
  return provider === 'olympian' || provider === 'hermes';
}

function consumeChaosGodScreen(
  catalog: Catalog,
  branch: RewardBranchState,
  sequence: number,
  offer: AuthoredTraitOffer | undefined,
): RewardBranchState {
  if (!isEligibleChaosGodScreen(catalog, offer)) return branch;
  const before = branch.traitHistory ?? createTraitHistoryState();
  const traitHistory = advanceChaosClock(catalog, before, sequence, 'godBoonScreens');
  return traitHistory === before
    ? branch
    : Object.freeze({
        ...branch,
        traitHistory,
        history: attachTraitHistory(branch.history, traitHistory),
      });
}

function applyTraitOfferForAcquisitionInternal(
  catalog: Catalog,
  branch: RewardBranchState,
  reward: {
    readonly origin: SemanticAddress;
    readonly offer?: CanonicalResolvedIncomingReward['offer'];
    readonly producerLifecycleKey?: string;
    readonly producerKind?: CanonicalResolvedIncomingReward['producerKind'];
    readonly traitOffersByAcquisitionRole?: CanonicalResolvedIncomingReward['traitOffersByAcquisitionRole'];
    readonly levelResolutionsByAcquisitionRole?: CanonicalResolvedIncomingReward['levelResolutionsByAcquisitionRole'];
    readonly levelResolutionGenerationHistory?: TraitHistoryState;
    readonly traitContext?: CanonicalResolvedIncomingReward['traitContext'];
  },
  role: string,
  lifecyclePoint: string,
  sequence: number,
  findings?: Map<string, FindingRegionEntry>,
  findingChronology?: FindingChronology,
  options: ApplyTraitOfferOptions = {},
  echoLastRunBoon?: EchoLastRunBoonSettlement,
): {
  readonly branch: RewardBranchState;
  readonly blockedChild?: ReachedTraitChildCheckpoint;
} {
  // Aspect of Selene routes a later Spell Drop directly to Path settlement.
  // The concrete acquisition retains its history identity; its base-spell child
  // stays absent and must neither block nor change trait history.
  if (
    reward.offer?.rewardType === 'SpellDrop' &&
    isAspectSpellDropDormant(catalog, reward.traitContext?.aspectKey) &&
    role === 'self'
  )
    return Object.freeze({ branch });
  const authored = reward.traitOffersByAcquisitionRole?.[role];
  const authoredLevelResolution = reward.levelResolutionsByAcquisitionRole?.[role];
  const before = branch.traitHistory ?? createTraitHistoryState();
  const sourceTraitContext = Object.freeze({
    ...(reward.traitContext ?? {}),
    settledSpellDrop: (branch.history.useRecord.SpellDrop ?? 0) > 0,
    ...(reward.producerLifecycleKey === 'EchoLastReward' || role === 'echoLastRunSelection'
      ? { stackBoostsSuppressed: true as const }
      : {}),
  });
  if (authored === null) {
    const owner = traitOwnerAddress(reward.origin);
    const giver =
      sourceTraitContext.resolvedProviderKey ??
      (reward.offer === undefined
        ? undefined
        : traitGiverForAcquisitionRole(catalog, reward.offer, role));
    if (findings !== undefined && owner !== undefined)
      addTraitFinding(
        findings,
        owner,
        role,
        lifecyclePoint,
        sequence,
        'traitOfferMissing',
        undefined,
        undefined,
        undefined,
        findingChronology,
      );
    return Object.freeze({
      branch,
      ...(owner === undefined
        ? {}
        : {
            blockedChild: Object.freeze({
              address: createTraitOfferAddress(owner, role),
              branch,
              ...(giver === undefined
                ? {}
                : {
                    candidateContext: Object.freeze({
                      before,
                      context: withBoonRarityFacts(
                        catalog,
                        branch,
                        Object.freeze({
                          ...sourceTraitContext,
                          devotionNoDuo:
                            sourceTraitContext.devotionNoDuo ??
                            reward.offer?.rewardType === 'Devotion',
                          resolvedProviderKey: giver,
                        }),
                      ),
                      arcanaFear: branch.arcanaFear,
                      keepsakes: branch.keepsakes,
                    }),
                  }),
            }),
          }),
    });
  }
  const authoredContext =
    authored === undefined
      ? undefined
      : withBoonRarityFacts(
          catalog,
          branch,
          Object.freeze({
            ...sourceTraitContext,
            devotionNoDuo:
              sourceTraitContext.devotionNoDuo ?? reward.offer?.rewardType === 'Devotion',
            resolvedProviderKey: authored.giverKey,
          }),
        );
  const baseOffer =
    authored === undefined || authoredContext === undefined || options.directAcquisition === true
      ? undefined
      : assessTraitOfferBeforeRarification(catalog, authored, before, authoredContext);
  const callingCard =
    authored === undefined || options.skipCallingCard === true
      ? undefined
      : evaluateCallingCardOffer(catalog, branch.keepsakes, authored, baseOffer?.legal ?? false);
  const effectiveAuthored = callingCard?.offer ?? authored;
  const effectiveBranch =
    callingCard === undefined || callingCard.state === branch.keepsakes
      ? branch
      : Object.freeze({ ...branch, keepsakes: callingCard.state });
  {
    const effect =
      reward.offer === undefined || reward.producerLifecycleKey === undefined
        ? undefined
        : levelResolutionEffectFor(
            catalog.rewards,
            reward.offer,
            {
              kind: reward.producerKind === 'shop' ? 'shopProfile' : 'producerLifecycle',
              key: reward.producerLifecycleKey,
            },
            role,
          );
    if (effect !== undefined) {
      const owner = traitOwnerAddress(reward.origin);
      if (owner === undefined) return Object.freeze({ branch });
      const address = createLevelResolutionAddress(owner, role);
      // A missing child is still a reached, incomplete declaration-owned Pom.
      // Do not let malformed legacy/project state silently bypass the effect.
      const levelResolution =
        authoredLevelResolution ??
        (effect.kind === 'visibleChoice'
          ? { kind: 'choice' as const, offeredTraitKeys: Object.freeze([]), selectedTraitKey: null }
          : { kind: 'random' as const, targetTraitKey: null });
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
      const currentEquipped =
        currentTarget === null ? undefined : before.equippedTraits[currentTarget];
      const appliedHistory =
        generatedEvent === undefined ||
        currentTarget === null ||
        currentEquipped?.level === undefined
          ? before
          : foldTraitHistoryEvents(catalog, [
              ...before.events,
              Object.freeze({
                ...generatedEvent,
                oldLevel: currentEquipped.level,
                newLevel: currentEquipped.level + effect.levelCount,
              }),
            ]);
      if (findings !== undefined && evaluation.findings.length > 0) {
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
            findings,
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
            findingChronology ?? Object.freeze({ kind: 'history', sequence, boundary: 'at' }),
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
      });
    }
  }
  if (effectiveAuthored === undefined) return Object.freeze({ branch: effectiveBranch });
  const evaluationContext = withBoonRarityFacts(
    catalog,
    effectiveBranch,
    Object.freeze({
      ...sourceTraitContext,
      devotionNoDuo: sourceTraitContext.devotionNoDuo ?? reward.offer?.rewardType === 'Devotion',
      resolvedProviderKey: effectiveAuthored.giverKey,
    }),
  );
  const evaluation =
    echoLastRunBoon === undefined
      ? evaluateReachedTraitOffer(
          catalog,
          reward.origin,
          role,
          effectiveAuthored,
          before,
          evaluationContext,
          branch.traitEvaluations?.length ?? 0,
          branch.arcanaFear,
          options.directAcquisition === true,
          branch.keepsakes,
          callingCard === undefined ? undefined : authored,
          undefined,
          options.frozenAcquisition === true,
          options.frozenLevelResolution === undefined
            ? undefined
            : Object.freeze([options.frozenLevelResolution]),
        )
      : effectiveAuthored.kind !== 'traits'
        ? (() => {
            throw new Error('BBB settlement requires a trait offer');
          })()
        : evaluateReachedEchoLastRunBoonOffer(
            catalog,
            echoLastRunBoon.address,
            effectiveAuthored,
            echoLastRunBoon.outcome,
            before,
            evaluationContext,
            branch.traitEvaluations?.length ?? 0,
            branch.arcanaFear,
            branch.keepsakes,
            echoLastRunBoon.runtimeOfferFallbackExcludedTraitKeys,
          );
  const selectedForIdentity =
    effectiveAuthored.kind === 'traits'
      ? effectiveAuthored.options[optionIndex(effectiveAuthored.selectedOptionKey)]
      : undefined;
  const selectedForIdentityDisposition =
    selectedForIdentity === undefined
      ? undefined
      : catalog.traits.byKey[selectedForIdentity.traitKey]?.selectedDisposition;
  const acquisitionIdentityOwner = traitOwnerAddress(reward.origin);
  const acquisitionIdentity =
    (effectiveAuthored.kind === 'chaos' ||
      selectedForIdentityDisposition?.kind === 'steadyGrowth' ||
      (selectedForIdentityDisposition?.kind === 'echo' &&
        (selectedForIdentityDisposition.effect === 'doubleShop' ||
          selectedForIdentityDisposition.effect === 'repeatKeepsake'))) &&
    acquisitionIdentityOwner !== undefined
      ? `${semanticAddressKey(createTraitOfferAddress(acquisitionIdentityOwner, role))}:${sequence}`
      : undefined;
  const applied = recordReachedTraitOffer(
    catalog,
    evaluation,
    sequence,
    lifecyclePoint,
    acquisitionIdentity,
    selectedForIdentityDisposition?.kind === 'echo' &&
      selectedForIdentityDisposition.effect === 'repeatKeepsake'
      ? sourceTraitContext.currentKeepsakeKey
      : undefined,
    options.frozenAcquisition === true ? 'concaveStoneSecondary' : 'traitOffer',
  );
  // A Stone residual is an acquisition from the already-evaluated source
  // screen, not a second authored offer. Keep its callback machinery private
  // to settlement and publish only the source offer's evaluation trace.
  const traitEvaluations = options.frozenAcquisition
    ? Object.freeze([...(branch.traitEvaluations ?? [])])
    : Object.freeze([...(branch.traitEvaluations ?? []), evaluation]);
  if (
    findings !== undefined &&
    callingCard !== undefined &&
    callingCard.invalidActions.length > 0
  ) {
    const owner = traitOwnerAddress(reward.origin);
    if (owner !== undefined) {
      for (const actionIndex of callingCard.invalidActions) {
        addTraitFinding(
          findings,
          owner,
          role,
          lifecyclePoint,
          sequence,
          'callingCardRarificationUnavailable',
          undefined,
          `rarification action ${actionIndex + 1} is unavailable at this offer frontier`,
          undefined,
          findingChronology,
          actionIndex,
          callingCard.offer.kind === 'traits'
            ? callingCard.offer.rarificationActions?.[actionIndex]
            : undefined,
        );
      }
    }
  }
  if (
    findings !== undefined &&
    (evaluation.composition.findings.length > 0 ||
      evaluation.replacementComposition.findings.length > 0 ||
      evaluation.assessments.some((assessment) => !assessment.legal))
  ) {
    const owner = traitOwnerAddress(reward.origin);
    if (owner !== undefined) {
      evaluation.assessments.forEach((assessment) =>
        assessment.findings.forEach((finding) => {
          addTraitFinding(
            findings,
            owner,
            role,
            lifecyclePoint,
            sequence,
            finding.code,
            finding.traitKey,
            finding.detail,
            finding.requirementTraitKeys,
            findingChronology,
          );
        }),
      );
      evaluation.composition.findings.forEach((finding) => {
        addTraitFinding(
          findings,
          owner,
          role,
          lifecyclePoint,
          sequence,
          finding.code,
          finding.traitKey,
          undefined,
          undefined,
          findingChronology,
        );
      });
      evaluation.replacementComposition.findings.forEach((finding) => {
        addTraitFinding(
          findings,
          owner,
          role,
          lifecyclePoint,
          sequence,
          finding.code,
          undefined,
          finding.detail,
          undefined,
          findingChronology,
        );
      });
    }
  }
  // A reached offer remains in the evaluation trace even when one or more
  // alternatives are context-invalid. Only a valid offer folds its selected
  // trait into canonical equipped state; the reward/use ledger still records
  // the concrete acquisition.
  // A Calling Card row action settles at the offer frontier. A later
  // selected-only acquisition failure must not roll that already-valid spend
  // back, while an invalid base offer leaves `effectiveBranch` unchanged.
  if (applied.event === undefined) {
    const branchAfterOffer =
      effectiveAuthored.kind === 'chaos' && applied.history !== before
        ? Object.freeze({
            ...effectiveBranch,
            history: attachTraitHistory(effectiveBranch.history, applied.history),
            traitHistory: applied.history,
            traitEvaluations,
          })
        : Object.freeze({ ...effectiveBranch, traitEvaluations });
    return Object.freeze({
      branch: consumeChaosGodScreen(
        catalog,
        branchAfterOffer,
        sequence,
        evaluation.composition.legal &&
          evaluation.replacementComposition.legal &&
          evaluation.targetedAcquisition.legal &&
          evaluation.assessments.every((assessment) => assessment.legal)
          ? effectiveAuthored
          : undefined,
      ),
    });
  }
  const selected = applied.event.options[optionIndex(applied.event.selectedOptionKey)];
  // Jeweled Pom and Persephone are resolved from the exact pre-offer frontier
  // and installed atomically with the selected row. There is no post-selection
  // mutation, so sibling rows and Concave Stone residuals remain frozen.
  let traitHistory = applied.history;
  const selectedDisposition =
    selected === undefined
      ? undefined
      : catalog.traits.byKey[selected.traitKey]?.selectedDisposition;
  const keepsakes =
    selectedDisposition?.kind === 'advanceCurrentKeepsake'
      ? advanceCurrentKeepsake(catalog, effectiveBranch.keepsakes, selectedDisposition.rankBonus)
      : effectiveBranch.keepsakes;
  let blockedChildAddress: SemanticAddress | undefined;
  let blockedChildCandidateContext: import('../traits').TraitOfferCandidateContext | undefined;
  if (selectedDisposition?.kind === 'naturalSelection' && selected !== undefined) {
    const owner = traitOwnerAddress(reward.origin);
    if (owner !== undefined) {
      const traitAddress = createTraitOfferAddress(owner, role);
      const address = createNaturalSelectionResultAddress(
        traitAddress,
        applied.event.selectedOptionKey,
      );
      const assessment = assessNaturalSelectionTargets(
        catalog,
        evaluation.before,
        selectedDisposition.levelCount,
        selectedDisposition.slots,
        selected.naturalSelectionTargets,
      );
      if (!assessment.legal || !assessment.complete) {
        blockedChildAddress = address;
        blockedChildCandidateContext = Object.freeze({
          before: evaluation.before,
          context: withBoonRarityFacts(
            catalog,
            branch,
            Object.freeze({
              ...sourceTraitContext,
              resolvedProviderKey: evaluation.offer.giverKey,
            }),
          ),
          arcanaFear: branch.arcanaFear,
          keepsakes: branch.keepsakes,
        });
        if (findings !== undefined)
          addTraitChildFinding(
            findings,
            address,
            lifecyclePoint,
            sequence,
            selected.naturalSelectionTargets === undefined
              ? 'naturalSelectionResultMissing'
              : 'naturalSelectionResultUnavailable',
            selected.traitKey,
            assessment.legal ? 'incomplete' : 'unavailable',
            findingChronology,
            ownerRegion(traitAddress),
          );
      }
    }
  }
  if (
    evaluation.targetedAcquisition.applies &&
    !evaluation.targetedAcquisition.legal &&
    selected !== undefined
  ) {
    const owner = traitOwnerAddress(reward.origin);
    if (owner !== undefined) {
      const traitAddress = createTraitOfferAddress(owner, role);
      const address = createTraitAcquisitionTargetAddress(
        traitAddress,
        applied.event.selectedOptionKey,
      );
      blockedChildAddress = address;
      blockedChildCandidateContext = Object.freeze({
        before: evaluation.before,
        context: withBoonRarityFacts(
          catalog,
          branch,
          Object.freeze({
            ...sourceTraitContext,
            resolvedProviderKey: evaluation.offer.giverKey,
          }),
        ),
        arcanaFear: branch.arcanaFear,
        keepsakes: branch.keepsakes,
      });
      if (findings !== undefined)
        evaluation.targetedAcquisition.findings.forEach((finding) =>
          addTraitChildFinding(
            findings,
            address,
            lifecyclePoint,
            sequence,
            finding.code,
            finding.traitKey,
            finding.detail,
            findingChronology,
            ownerRegion(traitAddress),
          ),
        );
    }
  }
  if (selectedDisposition?.kind === 'directTraitSets' && selected !== undefined) {
    const owner = traitOwnerAddress(reward.origin);
    const result = selected.allTogetherResult;
    const branchHistories = options.directTraitSetBranchHistories ?? [before];
    const grants: { readonly owner: SemanticAddress; readonly traitKey: string }[] = [];
    let invalid = owner === undefined;
    if (owner !== undefined) {
      const traitAddress = createTraitOfferAddress(owner, role);
      if (result === undefined) {
        const firstSet = selectedDisposition.sets[0];
        if (firstSet !== undefined) {
          const address = createAllTogetherSetAddress(
            traitAddress,
            applied.event.selectedOptionKey,
            firstSet.key,
          );
          invalid = true;
          blockedChildAddress = address;
          if (findings !== undefined)
            addTraitChildFinding(
              findings,
              address,
              lifecyclePoint,
              sequence,
              'allTogetherResultMissing',
              selected.traitKey,
              'unresolved',
              findingChronology,
              ownerRegion(traitAddress),
            );
        }
      }
      for (const set of selectedDisposition.sets) {
        if (result === undefined) break;
        const address = createAllTogetherSetAddress(
          traitAddress,
          applied.event.selectedOptionKey,
          set.key,
        );
        const domains = branchHistories.map((history) =>
          directTraitSetOutcomes(catalog, history, selected.traitKey, set.key),
        );
        const hasResult =
          result !== undefined && Object.prototype.hasOwnProperty.call(result, set.key);
        const value = result?.[set.key];
        const branchSupported = domains.map((domain) => domain.includes(value ?? null));
        const legal = hasResult && branchSupported.length > 0 && branchSupported.every(Boolean);
        if (!legal) {
          invalid = true;
          blockedChildAddress ??= address;
          if (findings !== undefined)
            addTraitChildFinding(
              findings,
              address,
              lifecyclePoint,
              sequence,
              hasResult ? 'allTogetherResultUnavailable' : 'allTogetherResultMissing',
              selected.traitKey,
              branchSupported.some(Boolean) ? 'branchDivergence' : String(value),
              findingChronology,
              ownerRegion(traitAddress),
            );
        } else if (value !== null && value !== undefined) {
          grants.push(Object.freeze({ owner: address, traitKey: value }));
        }
      }
    }
    if (!invalid)
      traitHistory = recordDirectTraitGrants(
        catalog,
        traitHistory,
        sequence,
        lifecyclePoint,
        selected.traitKey,
        grants,
      );
  }
  let settledBeforeChaos: RewardBranchState = Object.freeze({
    ...effectiveBranch,
    history: attachTraitHistory(branch.history, traitHistory),
    traitHistory,
    traitEvaluations,
    keepsakes,
  });
  if (
    effectiveAuthored.kind === 'traits' &&
    effectiveAuthored.giverKey === 'SpellDrop' &&
    selectedForIdentity !== undefined &&
    effectiveAuthored.hexTree !== undefined
  ) {
    settledBeforeChaos = installHexTree(
      catalog,
      settledBeforeChaos,
      selectedForIdentity.traitKey,
      effectiveAuthored.hexTree,
    );
  }
  settledBeforeChaos = maybeAddGodSent(catalog, settledBeforeChaos);
  const moonBeamAdvanced =
    selectedDisposition?.kind === 'advanceCurrentKeepsake' &&
    catalog.keepsakes.byKey[effectiveBranch.keepsakes.currentKey]?.effect?.kind === 'moonBeam';
  const settledAfterKeepsakeAdvance = moonBeamAdvanced
    ? bankPathPoints(settledBeforeChaos, 2)
    : settledBeforeChaos;
  const settledBranch =
    options.frozenAcquisition === true
      ? settledAfterKeepsakeAdvance
      : consumeChaosGodScreen(catalog, settledAfterKeepsakeAdvance, sequence, effectiveAuthored);
  let stoneBranch = settledBranch;
  if (
    blockedChildAddress === undefined &&
    authored?.kind === 'traits' &&
    effectiveAuthored.kind === 'traits' &&
    catalog.traitGivers.byKey[effectiveAuthored.giverKey]?.shopAwareGodTrait === true
  ) {
    const residualKeys = concaveStoneResidualOptionKeys(
      effectiveAuthored,
      (['option1', 'option2', 'option3'] as const).filter(
        (key) => evaluation.assessments[optionIndex(key)]?.replacementTransition !== undefined,
      ),
    );
    const stoneSupport = concaveStoneProcSupport(catalog, settledBranch.keepsakes);
    const stoneResult = authored.concaveStoneResult;
    const stoneOwner = traitOwnerAddress(reward.origin);
    const stoneAddress =
      stoneOwner === undefined ? undefined : createTraitOfferAddress(stoneOwner, role);
    const rejectStone = (code: 'concaveStoneResultMissing' | 'concaveStoneResultUnavailable') => {
      if (stoneAddress !== undefined) {
        blockedChildAddress = stoneAddress;
        blockedChildCandidateContext = Object.freeze({
          before: evaluation.before,
          context: evaluation.context,
          ...(evaluation.arcanaFear === undefined ? {} : { arcanaFear: evaluation.arcanaFear }),
          ...(evaluation.keepsakes === undefined ? {} : { keepsakes: evaluation.keepsakes }),
        });
        if (findings !== undefined)
          addTraitChildFinding(
            findings,
            stoneAddress,
            lifecyclePoint,
            sequence,
            code,
            selected?.traitKey,
            stoneResult === undefined ? 'unresolved' : String(stoneResult.kind),
            findingChronology,
          );
      }
    };
    if (stoneSupport === undefined) {
      if (stoneResult !== undefined) rejectStone('concaveStoneResultUnavailable');
    } else {
      if (residualKeys.length === 0) {
        if (stoneResult?.kind === 'proc') rejectStone('concaveStoneResultUnavailable');
      } else if (stoneResult === undefined) {
        rejectStone('concaveStoneResultMissing');
      } else if (stoneResult.kind === 'noProc') {
        if (stoneSupport >= 100) rejectStone('concaveStoneResultUnavailable');
      } else if (!residualKeys.includes(stoneResult.optionKey)) {
        rejectStone('concaveStoneResultUnavailable');
      } else {
        const residual = effectiveAuthored.options[optionIndex(stoneResult.optionKey)];
        if (residual === undefined) {
          rejectStone('concaveStoneResultUnavailable');
        } else {
          const secondaryOffer: AuthoredTraitOfferTraits = Object.freeze({
            kind: 'traits',
            giverKey: effectiveAuthored.giverKey,
            options: Object.freeze([
              Object.freeze({ ...residual }),
            ]) as AuthoredTraitOfferTraits['options'],
            selectedOptionKey: 'option1',
            rarificationActions: Object.freeze([]),
          });
          const secondarySettlement = applyTraitOfferForAcquisitionInternal(
            catalog,
            Object.freeze({
              ...settledBranch,
              keepsakes: consumeConcaveStone(settledBranch.keepsakes),
            }),
            {
              origin: reward.origin,
              traitOffersByAcquisitionRole: Object.freeze({
                concaveStoneSecondary: secondaryOffer,
              }),
              traitContext: sourceTraitContext,
            },
            'concaveStoneSecondary',
            lifecyclePoint,
            sequence,
            findings,
            findingChronology,
            Object.freeze({
              directAcquisition: true,
              skipCallingCard: true,
              frozenAcquisition: true,
              ...(evaluation.levelResolutions[optionIndex(stoneResult.optionKey)] === undefined
                ? {}
                : {
                    frozenLevelResolution:
                      evaluation.levelResolutions[optionIndex(stoneResult.optionKey)],
                  }),
            }),
          );
          stoneBranch = secondarySettlement.branch;
          blockedChildAddress ??= secondarySettlement.blockedChild?.address;
          blockedChildCandidateContext ??= secondarySettlement.blockedChild?.candidateContext;
        }
      }
    }
  }
  return Object.freeze({
    branch: stoneBranch,
    ...(blockedChildAddress === undefined
      ? {}
      : {
          blockedChild: Object.freeze({
            address: blockedChildAddress,
            branch: stoneBranch,
            ...(blockedChildCandidateContext === undefined
              ? {}
              : { candidateContext: blockedChildCandidateContext }),
          }),
        }),
  });
}

export function applyTraitOfferForAcquisition(
  catalog: Catalog,
  branch: RewardBranchState,
  reward: Parameters<typeof applyTraitOfferForAcquisitionInternal>[2],
  role: string,
  lifecyclePoint: string,
  sequence: number,
  findings?: Map<string, FindingRegionEntry>,
  findingChronology?: FindingChronology,
  options: ApplyTraitOfferOptions = {},
): ReturnType<typeof applyTraitOfferForAcquisitionInternal> {
  const traitContext = Object.freeze({
    ...(reward.traitContext ?? {}),
    ...(branch.stygianWell.yarnUses === 0
      ? {}
      : { temporaryBoonRarityUses: branch.stygianWell.yarnUses }),
    ...(branch.stygianWell.hymnUses === 0 ? {} : { limitedSwapUses: branch.stygianWell.hymnUses }),
  });
  const source = Object.freeze({ ...reward, traitContext });
  const settlement = applyTraitOfferForAcquisitionInternal(
    catalog,
    branch,
    source,
    role,
    lifecyclePoint,
    sequence,
    findings,
    findingChronology,
    options,
  );
  const authored = reward.traitOffersByAcquisitionRole?.[role];
  // A missing authored screen is an incomplete reached frontier, not a closed
  // choice. Retain both one-use effects so the repaired screen receives them.
  if (authored === undefined || authored === null) return settlement;
  const closedContext = withBoonRarityFacts(
    catalog,
    branch,
    Object.freeze({ ...traitContext, resolvedProviderKey: authored.giverKey }),
  );
  const consumesYarn =
    traitContext.temporaryBoonRarityUses !== undefined &&
    boonRarityFactsForOffer(
      catalog,
      branch.traitHistory ?? createTraitHistoryState(),
      closedContext,
      branch.arcanaFear,
    ) !== undefined;
  const consumesHymn =
    (traitContext.limitedSwapUses ?? 0) > 0 &&
    authored.kind === 'traits' &&
    traitOfferCompositionDomains(
      catalog,
      authored.giverKey,
      branch.traitHistory ?? createTraitHistoryState(),
      closedContext,
    ).replacements.length > 0;
  if (!consumesYarn && !consumesHymn) return settlement;
  return Object.freeze({
    ...settlement,
    branch: Object.freeze({
      ...settlement.branch,
      stygianWell: Object.freeze({
        ...settlement.branch.stygianWell,
        ...(consumesYarn
          ? { yarnUses: Math.max(0, settlement.branch.stygianWell.yarnUses - 1) }
          : {}),
        ...(consumesHymn
          ? { hymnUses: Math.max(0, settlement.branch.stygianWell.hymnUses - 1) }
          : {}),
      }),
    }),
  });
}

function applyEchoLastRunBoonForAcquisition(
  catalog: Catalog,
  branch: RewardBranchState,
  address: EchoLastRunBoonAddress,
  offer: AuthoredTraitOfferTraits,
  outcome: EchoLastRunBoonOutcome,
  context: TraitOfferContext,
  lifecyclePoint: string,
  sequence: number,
  runtimeOfferFallbackExcludedTraitKeys: readonly string[],
): ReturnType<typeof applyTraitOfferForAcquisitionInternal> {
  return applyTraitOfferForAcquisitionInternal(
    catalog,
    branch,
    {
      origin: address,
      traitOffersByAcquisitionRole: Object.freeze({ echoLastRunSelection: offer }),
      traitContext: context,
    },
    'echoLastRunSelection',
    lifecyclePoint,
    sequence,
    undefined,
    undefined,
    Object.freeze({ directAcquisition: true, skipCallingCard: true }),
    Object.freeze({ address, outcome, runtimeOfferFallbackExcludedTraitKeys }),
  );
}

function traitOwnerAddress(origin: SemanticAddress): TraitOfferOwnerAddress | undefined {
  switch (origin.kind) {
    case 'incomingReward':
    case 'localReward':
    case 'rewardWheelOffer':
    case 'shopOffer':
      return origin;
    case 'encounterPhase':
    case 'gorgonPhase':
      return origin;
    case 'acquisitionEntry':
      return origin;
    default:
      return undefined;
  }
}

export interface EncounterTraitOfferSettlement {
  readonly branch: RewardBranchState;
  /** Exact post-outer/pre-effect branch retained when an authored child blocks settlement. */
  readonly blockedChild?: ReachedTraitChildCheckpoint;
}

function encounterTraitContext(
  catalog: Catalog,
  branch: RewardBranchState,
  providerKey: string,
  loadout:
    Pick<TraitOfferContext, 'weaponKey' | 'aspectKey' | 'boonRarityRoomOverride'> | undefined,
  freshRarityOverride: import('../../catalog-schema').TraitRarity | undefined,
): TraitOfferContext {
  const recreation = branch.history.lastRewardRecreation;
  return Object.freeze({
    ...(loadout ?? {}),
    resolvedProviderKey: providerKey,
    manualArcanaGraspCost: manualArcanaGraspCost(catalog, branch.arcanaFear),
    circeRemovableFearVow: circeResolutionDomain(catalog, branch.arcanaFear, 'disableFear')
      .outerAvailable,
    echoLastRewardAvailable: recreation !== undefined,
    ...(recreation === undefined ? {} : { echoLastRewardRecreation: recreation }),
    ...(freshRarityOverride === undefined ? {} : { freshRarityOverride }),
    currentKeepsakeKey: branch.keepsakes.currentKey,
  });
}

function withBoonRarityFacts(
  catalog: Catalog,
  branch: RewardBranchState,
  context: TraitOfferContext,
): TraitOfferContext {
  const facts = boonRarityFactsForOffer(
    catalog,
    branch.traitHistory ?? createTraitHistoryState(),
    context,
    branch.arcanaFear,
  );
  if (facts === undefined) return context;
  return Object.freeze({
    ...context,
    boonRarityFacts: facts,
  });
}

/** Settles one encounter-local trait offer and returns its exact child checkpoint when blocked. */
export function settleEncounterTraitOffer(
  catalog: Catalog,
  branch: RewardBranchState,
  origin: SemanticAddress,
  offer: AuthoredTraitOffer | null,
  sequence: number,
  lifecyclePoint: string,
  findings?: Map<string, FindingRegionEntry>,
  findingChronology?: FindingChronology,
  acquisitionRole = 'selection',
  freshRarityOverride?: import('../../catalog-schema').TraitRarity,
  loadout?: Pick<TraitOfferContext, 'weaponKey' | 'aspectKey' | 'boonRarityRoomOverride'>,
  directTraitSetBranchHistories?: readonly TraitHistoryState[],
  unresolvedProviderKey?: string,
): EncounterTraitOfferSettlement {
  const providerKey = offer?.giverKey ?? unresolvedProviderKey;
  if (providerKey === undefined)
    throw new Error('encounter trait offer settlement requires its known provider');
  const traitContext = encounterTraitContext(
    catalog,
    branch,
    providerKey,
    loadout,
    freshRarityOverride,
  );
  if (offer === null) {
    return applyTraitOfferForAcquisition(
      catalog,
      branch,
      {
        origin,
        traitOffersByAcquisitionRole: Object.freeze({ [acquisitionRole]: null }),
        traitContext,
      },
      acquisitionRole,
      lifecyclePoint,
      sequence,
      findings,
      findingChronology,
    );
  }
  let blockedChild: EncounterTraitOfferSettlement['blockedChild'];
  const settledBranch = ((): RewardBranchState => {
    if (offer.kind !== 'traits') {
      return applyTraitOfferForAcquisition(
        catalog,
        branch,
        {
          origin,
          traitOffersByAcquisitionRole: Object.freeze({ [acquisitionRole]: offer }),
          traitContext,
        },
        acquisitionRole,
        lifecyclePoint,
        sequence,
        findings,
        findingChronology,
      ).branch;
    }
    const selected = offer.options[optionIndex(offer.selectedOptionKey)];
    const disposition =
      selected === undefined
        ? undefined
        : catalog.traits.byKey[selected.traitKey]?.selectedDisposition;
    const resolution = selected?.circeResolution;
    const preChoiceTraitHistory = branch.traitHistory ?? createTraitHistoryState();
    const owner = createTraitOfferAddress(origin as TraitOfferOwnerAddress, acquisitionRole);
    const circeDomain =
      disposition?.kind === 'circe'
        ? circeResolutionDomain(catalog, branch.arcanaFear, disposition.effect)
        : undefined;
    const source = {
      origin,
      traitOffersByAcquisitionRole: Object.freeze({ [acquisitionRole]: offer }),
      traitContext,
    } as const;
    // Record the exact pre-effect frontier before validating Circe's authored
    // child. Circe's ordinary offer findings stay provisional until that child
    // is valid, so the child remains the first blocking repair owner.
    const provisionalFindings =
      disposition?.kind === 'circe' && findings !== undefined
        ? new Map<string, FindingRegionEntry>()
        : findings;
    const appliedSettlement = applyTraitOfferForAcquisition(
      catalog,
      branch,
      source,
      acquisitionRole,
      lifecyclePoint,
      sequence,
      provisionalFindings,
      findingChronology,
      directTraitSetBranchHistories === undefined ? {} : { directTraitSetBranchHistories },
    );
    const applied = appliedSettlement.branch;
    blockedChild ??= appliedSettlement.blockedChild;
    const rejectCirce = (code: TraitFindingCode, detail?: string): RewardBranchState => {
      const address = createCirceResolutionAddress(owner, offer.selectedOptionKey);
      blockedChild = Object.freeze({ address, branch: applied });
      if (findings !== undefined)
        addTraitChildFinding(
          findings,
          address,
          lifecyclePoint,
          sequence,
          code,
          selected?.traitKey,
          detail,
          findingChronology,
        );
      return applied;
    };
    if (disposition?.kind === 'circe') {
      if (applied.traitHistory === branch.traitHistory) {
        if (
          findings !== undefined &&
          provisionalFindings !== undefined &&
          provisionalFindings !== findings
        )
          for (const [key, entry] of provisionalFindings) findings.set(key, entry);
        return applied;
      }
      if (disposition.effect === 'activateArcana') {
        if (resolution?.kind !== 'activateArcana') return rejectCirce('circeResolutionMissing');
        if (resolution.arcanaKeys.length !== circeDomain!.requiredCount)
          return rejectCirce(
            'circeResolutionWrongCardinality',
            `${circeDomain!.requiredCount}:${resolution.arcanaKeys.length}`,
          );
        if (resolution.arcanaKeys.some((key) => !circeDomain!.arcanaKeys.includes(key)))
          return rejectCirce('circeResolutionTargetUnavailable');
      } else if (disposition.effect === 'promoteArcana') {
        if (resolution?.kind !== 'promoteArcana') return rejectCirce('circeResolutionMissing');
        if (resolution.arcanaKeys.length !== circeDomain!.requiredCount)
          return rejectCirce(
            'circeResolutionWrongCardinality',
            `${circeDomain!.requiredCount}:${resolution.arcanaKeys.length}`,
          );
        if (resolution.arcanaKeys.some((key) => !circeDomain!.arcanaKeys.includes(key)))
          return rejectCirce('circeResolutionTargetUnavailable');
      } else {
        if (!circeDomain!.outerAvailable) return rejectCirce('circeOptionUnavailable');
        if (resolution?.kind !== 'disableFear' || resolution.vowKey === null)
          return rejectCirce('circeResolutionMissing');
        if (!circeDomain!.vowKeys.includes(resolution.vowKey))
          return rejectCirce('circeResolutionTargetUnavailable');
      }
    }
    if (
      findings !== undefined &&
      provisionalFindings !== undefined &&
      provisionalFindings !== findings
    )
      for (const [key, entry] of provisionalFindings) findings.set(key, entry);
    if (
      disposition?.kind === 'echo' &&
      disposition.effect === 'lastRunBoon' &&
      selected !== undefined &&
      applied.traitHistory !== undefined &&
      applied.traitHistory !== branch.traitHistory
    ) {
      const address = createEchoLastRunBoonAddress(owner, offer.selectedOptionKey);
      const child = selected.echoLastRunBoon;
      const reject = (code: TraitFindingCode, detail?: string): RewardBranchState => {
        blockedChild = Object.freeze({ address, branch: applied });
        if (findings !== undefined)
          addTraitChildFinding(
            findings,
            address,
            lifecyclePoint,
            sequence,
            code,
            selected.traitKey,
            detail,
            findingChronology,
          );
        return applied;
      };
      if (child === undefined) return reject('echoLastRunBoonMissing');
      const selectedChildIndex = optionIndex(child.selectedOptionKey);
      const selectedChild = child.options[selectedChildIndex];
      if (selectedChild === undefined) return reject('echoLastRunBoonMissing');
      const outcomes = echoLastRunBoonOutcomes(catalog, preChoiceTraitHistory);
      let outcome: (typeof outcomes)[number] | undefined;
      for (const [index, childOption] of child.options.entries()) {
        const rowOutcome = outcomes.find(
          (candidate) =>
            candidate.option.giverKey === childOption.giverKey &&
            candidate.option.traitKey === childOption.traitKey &&
            candidate.option.rarity === childOption.rarity,
        );
        if (rowOutcome === undefined || !rowOutcome.assessment.legal)
          return reject(
            'echoLastRunBoonOptionUnavailable',
            `${childOption.giverKey}:${childOption.traitKey}:${childOption.rarity}`,
          );
        if (index === selectedChildIndex) {
          const targetedAcquisition =
            catalog.traits.byKey[childOption.traitKey]?.targetedAcquisition;
          if (targetedAcquisition !== undefined) {
            if (childOption.targetTraitKey === undefined)
              return reject('targetedAcquisitionTargetMissing', childOption.traitKey);
            if (!rowOutcome.targetTraitKeys.includes(childOption.targetTraitKey))
              return reject('targetedAcquisitionTargetUnavailable', childOption.targetTraitKey);
          } else if (childOption.targetTraitKey !== undefined) {
            return reject('targetedAcquisitionTargetUnavailable', childOption.targetTraitKey);
          }
          outcome = rowOutcome;
        }
      }
      if (outcome === undefined) return reject('echoLastRunBoonMissing');
      const nestedOffer: AuthoredTraitOfferTraits = Object.freeze({
        kind: 'traits',
        giverKey: selectedChild.giverKey,
        options: Object.freeze([
          Object.freeze({
            traitKey: selectedChild.traitKey,
            rarity: outcome.effectiveRarity,
            ...(selectedChild.targetTraitKey === undefined
              ? {}
              : { targetTraitKey: selectedChild.targetTraitKey }),
          }),
        ]) as AuthoredTraitOfferTraits['options'],
        selectedOptionKey: 'option1',
        rarificationActions: Object.freeze([]),
      });
      const variant =
        catalog.echoLastRunBoon.variants.byKey[
          `${selectedChild.giverKey}:${selectedChild.traitKey}`
        ];
      const rewardHistory =
        variant?.lootHistorySource === undefined
          ? applied.history
          : recordLootTypeHistorySource(applied.history, variant.lootHistorySource);
      const sourceApplied = Object.freeze({
        ...applied,
        history: rewardHistory,
      });
      const nestedSettlement = applyEchoLastRunBoonForAcquisition(
        catalog,
        sourceApplied,
        address,
        nestedOffer,
        outcome,
        Object.freeze({
          freshRarityOverride: outcome.effectiveRarity,
          ordinarySlotReplacement: 'forbidden',
        }),
        lifecyclePoint,
        sequence,
        child.options
          .filter((_, index) => index !== selectedChildIndex)
          .map((option) => option.traitKey),
      );
      const nested = nestedSettlement.branch;
      blockedChild ??= nestedSettlement.blockedChild;
      if (nested.traitHistory === applied.traitHistory)
        return reject('echoLastRunBoonOptionUnavailable');
      return nested;
    }
    if (
      disposition?.kind === 'echo' &&
      disposition.effect === 'doubleLevel' &&
      selected !== undefined &&
      applied.traitHistory !== undefined &&
      applied.traitHistory !== branch.traitHistory
    ) {
      const appliedTraitHistory = applied.traitHistory;
      const domain = echoPomGreatestLevelTraitKeys(catalog, preChoiceTraitHistory);
      const hasTarget = 'echoPomTarget' in selected;
      const target = selected.echoPomTarget;
      const reject = (code: TraitFindingCode, detail?: string): RewardBranchState => {
        const address = createEchoPomTargetAddress(owner, offer.selectedOptionKey);
        blockedChild = Object.freeze({ address, branch: applied });
        if (findings !== undefined)
          addTraitChildFinding(
            findings,
            address,
            lifecyclePoint,
            sequence,
            code,
            selected.traitKey,
            detail,
            findingChronology,
          );
        return applied;
      };
      if (!hasTarget) return reject('echoPomTargetMissing');
      if (target === null) {
        return domain.length === 0
          ? applied
          : reject('echoPomNoTargetUnavailable', domain.join(','));
      }
      if (target === undefined || !domain.includes(target))
        return reject('echoPomTargetUnavailable', target);
      const equipped = preChoiceTraitHistory.equippedTraits[target];
      if (equipped?.level === undefined) return reject('echoPomTargetUnavailable', target);
      const event = Object.freeze({
        kind: 'levelMutation' as const,
        owner: createEchoPomTargetAddress(owner, offer.selectedOptionKey),
        acquisitionRole,
        sequence,
        acquisitionPoint: lifecyclePoint,
        sourceTraitKey: selected.traitKey,
        targetTraitKey: target,
        oldLevel: equipped.level,
        newLevel: equipped.level * 2,
      });
      const traitHistory = foldTraitHistoryEvents(catalog, [...appliedTraitHistory.events, event]);
      return Object.freeze({
        ...applied,
        history: attachTraitHistory(applied.history, traitHistory),
        traitHistory,
      });
    }
    if (
      applied.traitHistory === branch.traitHistory ||
      disposition?.kind !== 'circe' ||
      selected === undefined
    )
      return applied;
    const evidence = {
      owner,
      sequence,
    };
    if (disposition.effect === 'activateArcana') {
      const domain = circeResolutionDomain(
        catalog,
        applied.arcanaFear,
        disposition.effect,
        applied.keepsakes.fatedStatus,
      );
      if (
        resolution?.kind !== 'activateArcana' ||
        resolution.arcanaKeys.length !== domain.requiredCount
      )
        return applied;
      if (resolution.arcanaKeys.length === 0) return applied;
      const outcome = activateTemporaryArcana(
        catalog,
        applied.arcanaFear,
        resolution.arcanaKeys,
        evidence,
      );
      return outcome.legal
        ? Object.freeze({
            ...applied,
            arcanaFear: outcome.state,
            keepsakes: refreshKeepsakeFatedStatus(catalog, applied.keepsakes, outcome.state),
          })
        : applied;
    }
    if (disposition.effect === 'promoteArcana') {
      const domain = circeResolutionDomain(
        catalog,
        applied.arcanaFear,
        disposition.effect,
        applied.keepsakes.fatedStatus,
      );
      if (
        resolution?.kind !== 'promoteArcana' ||
        resolution.arcanaKeys.length !== domain.requiredCount
      )
        return applied;
      const outcome = promoteArcana(catalog, applied.arcanaFear, resolution.arcanaKeys, evidence);
      return outcome.legal
        ? Object.freeze({
            ...applied,
            arcanaFear: outcome.state,
            keepsakes: refreshKeepsakeFatedStatus(catalog, applied.keepsakes, outcome.state),
          })
        : applied;
    }
    if (resolution?.kind !== 'disableFear' || resolution.vowKey === null) return applied;
    const outcome = suppressFearVow(catalog, applied.arcanaFear, resolution.vowKey, evidence);
    return outcome.legal ? Object.freeze({ ...applied, arcanaFear: outcome.state }) : applied;
  })();
  return Object.freeze({
    branch: settledBranch,
    ...(blockedChild === undefined ? {} : { blockedChild }),
  });
}

/** Evaluates one selected encounter-local trait offer at its completion point. */
export function processEncounterTraitOffer(
  catalog: Catalog,
  branch: RewardBranchState,
  origin: SemanticAddress,
  offer: AuthoredTraitOffer,
  sequence: number,
  lifecyclePoint: string,
  findings?: Map<string, FindingRegionEntry>,
  findingChronology?: FindingChronology,
  acquisitionRole = 'selection',
  freshRarityOverride?: import('../../catalog-schema').TraitRarity,
  loadout?: Pick<TraitOfferContext, 'weaponKey' | 'aspectKey' | 'boonRarityRoomOverride'>,
): RewardBranchState {
  return settleEncounterTraitOffer(
    catalog,
    branch,
    origin,
    offer,
    sequence,
    lifecyclePoint,
    findings,
    findingChronology,
    acquisitionRole,
    freshRarityOverride,
    loadout,
    undefined,
  ).branch;
}

function addTraitChildFinding(
  findings: Map<string, FindingRegionEntry>,
  origin: SemanticAddress,
  lifecyclePoint: string,
  sequence: number,
  code: TraitFindingCode,
  traitKey: string | undefined,
  detail?: string,
  findingChronology?: FindingChronology,
  atomicRegion?: string,
): void {
  const value: SemanticFinding = Object.freeze({
    code,
    severity: 'error',
    phase: 'rewardGeneration',
    origin,
    evidence: Object.freeze({
      lifecyclePoint,
      ...(traitKey === undefined ? {} : { traitKey }),
      ...(detail === undefined ? {} : { detail }),
    }),
  });
  addRewardFinding(
    findings,
    value,
    atomicRegion ?? ownerRegion(origin),
    findingChronology ?? Object.freeze({ kind: 'history', sequence, boundary: 'at' }),
  );
}

function addTraitFinding(
  findings: Map<string, FindingRegionEntry>,
  owner: TraitOfferOwnerAddress,
  acquisitionRole: string,
  lifecyclePoint: string,
  sequence: number,
  code: TraitFindingCode,
  traitKey: string | undefined,
  detail?: string,
  requirementTraitKeys?: readonly string[],
  findingChronology?: FindingChronology,
  actionIndex?: number,
  optionKey?: string,
): void {
  const origin = createTraitOfferAddress(owner, acquisitionRole);
  const value: SemanticFinding = Object.freeze({
    code,
    severity: 'error',
    phase: 'rewardGeneration',
    origin,
    evidence: Object.freeze({
      acquisitionRole,
      lifecyclePoint,
      ...(traitKey === undefined ? {} : { traitKey }),
      ...(detail === undefined ? {} : { detail }),
      ...(requirementTraitKeys === undefined ? {} : { requirementTraitKeys }),
      ...(actionIndex === undefined ? {} : { actionIndex }),
      ...(optionKey === undefined ? {} : { optionKey }),
    }),
  });
  addRewardFinding(
    findings,
    value,
    ownerRegion(origin),
    findingChronology ?? Object.freeze({ kind: 'history', sequence, boundary: 'at' }),
  );
}
