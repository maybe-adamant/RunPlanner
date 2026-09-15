import type { Catalog } from '../../../catalog-schema';
import { evaluateCallingCardOffer } from '../../keepsakes/reward-effects';
import {
  createCirceResolutionAddress,
  createEchoLastRunBoonAddress,
  createEchoPomTargetAddress,
  createTraitOfferAddress,
  semanticAddressKey,
  type EchoLastRunBoonAddress,
  type SemanticAddress,
  type TraitOfferAddress,
  type TraitOfferOwnerAddress,
} from '../../../authored-project/addresses';
import { recordLootTypeHistorySource } from '../../../reward-kernel';
import type { CanonicalResolvedIncomingReward } from '../../materialization';
import { type SemanticFinding, type TraitFindingCode } from '../../model';
import {
  ownerRegion,
  type FindingChronology,
  type FindingRegionEntry,
} from '../../finding-regions';
import {
  attachTraitHistory,
  advanceChaosClock,
  assessTraitOfferBeforeRarification,
  boonRarityFactsForOffer,
  createTraitHistoryState,
  echoPomGreatestLevelTraitKeys,
  evaluateReachedEchoLastRunBoonOffer,
  evaluateReachedTraitOffer,
  isChaosGodScreenGiver,
  isAspectSpellDropDormant,
  recordReachedTraitOffer,
  traitOfferCompositionDomains,
  offerGenerationAdjustedTraitGiverContext,
  type TraitHistoryState,
} from '../../traits';
import type { EchoLastRunBoonOutcome, TraitOfferContext } from '../../traits/offer-domain';
import {
  optionIndex,
  traitGiverForAcquisitionRole,
  type AuthoredTraitOffer,
  type AuthoredTraitOfferTraits,
} from '../../../authored-project/traits/state';
import { circeResolutionDomain, manualArcanaGraspCost } from '../../arcana-fear';
import { advanceCurrentKeepsake } from '../../keepsakes/state';
import { consumeConcaveStone, concaveStoneProcSupport } from '../../keepsakes/trait-effects';
import type { RewardBranchState } from '../branch-primitives';
import type { TraitOfferOptionLevelResolution } from '../../traits/offer-levels';
import { settleMoonBeamPathPoints, settleSelectedHexTree } from './hex-settlement';
import { maybeAddGodSent } from '../../hex-progress';
import {
  createTraitChildFindingEntry,
  settleSelectedTraitChildren,
} from './selected-child-settlement';
import { prepareConcaveStoneSecondary } from './concave-stone-secondary';
import {
  assessCirceChild,
  assessEchoBoonChild,
  settleEchoPomChild,
  settleValidatedCirceChild,
} from './encounter-child-settlement';
import { addRewardFinding } from '../findings';
import { settleReachedLevelResolution } from '../level-resolution-settlement';
import { isTraitOfferMutationEvent } from '../../traits/history/fold';

export interface ReachedTraitChildCheckpoint {
  readonly address: SemanticAddress;
  readonly branch: RewardBranchState;
  readonly candidateContext?: import('../../traits').TraitOfferCandidateContext;
}

export interface ReachedTraitOfferCandidateContact {
  readonly address: TraitOfferAddress;
  readonly context: import('../../traits').TraitOfferCandidateContext;
}

type TraitOfferAcquisitionMode =
  | { readonly kind: 'ordinary' }
  | { readonly kind: 'direct' }
  | {
      readonly kind: 'frozenConcaveStoneSecondary';
      readonly levelResolution?: TraitOfferOptionLevelResolution;
      readonly sourceTraitAddress?: TraitOfferAddress;
      readonly sourceOptionKey: AuthoredTraitOfferTraits['selectedOptionKey'];
    };

interface ApplyTraitOfferOptions {
  readonly mode?: TraitOfferAcquisitionMode;
  readonly directTraitSetBranchHistories?: readonly TraitHistoryState[];
}

type TraitOfferAcquisitionSettlement = ReturnType<typeof applyTraitOfferForAcquisitionInternal> & {
  /** The immediately preceding same-occurrence trait mutations. */
  readonly priorTraitMutations?: readonly PriorTraitMutation[];
  /** Complete acquisition-owned finding emissions; callers merge them by region and chronology. */
  readonly findingEntries: readonly FindingRegionEntry[];
};

export interface PriorTraitMutation {
  readonly owner: SemanticAddress;
  readonly acquisitionRole: string;
}

interface EchoLastRunBoonSettlement {
  readonly address: EchoLastRunBoonAddress;
  readonly outcome: EchoLastRunBoonOutcome;
}

function consumeChaosGodScreen(
  catalog: Catalog,
  branch: RewardBranchState,
  sequence: number,
  offer: AuthoredTraitOffer | undefined,
): RewardBranchState {
  if (offer === undefined || !isChaosGodScreenGiver(catalog, offer.giverKey)) return branch;
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
  readonly candidateContact?: ReachedTraitOfferCandidateContact;
} {
  const acquisitionMode = options.mode ?? Object.freeze({ kind: 'ordinary' as const });
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
    authored === undefined || authoredContext === undefined || acquisitionMode.kind !== 'ordinary'
      ? undefined
      : assessTraitOfferBeforeRarification(catalog, authored, before, authoredContext);
  const callingCard =
    authored === undefined || acquisitionMode.kind !== 'ordinary'
      ? undefined
      : evaluateCallingCardOffer(catalog, branch.keepsakes, authored, baseOffer?.legal ?? false);
  const effectiveAuthored = callingCard?.offer ?? authored;
  const effectiveBranch =
    callingCard === undefined || callingCard.state === branch.keepsakes
      ? branch
      : Object.freeze({ ...branch, keepsakes: callingCard.state });
  const levelResolution = settleReachedLevelResolution({
    catalog,
    branch,
    reward,
    owner: traitOwnerAddress(reward.origin),
    role,
    authoredLevelResolution,
    lifecyclePoint,
    sequence,
    ...(findingChronology === undefined ? {} : { findingChronology }),
  });
  if (levelResolution !== undefined) {
    if (findings !== undefined) {
      for (const entry of levelResolution.findingEntries) {
        for (const evaluation of entry.levelResolutionEvaluations ?? [undefined]) {
          addRewardFinding(
            findings,
            entry.finding,
            entry.atomicRegion,
            entry.chronology,
            evaluation,
          );
        }
      }
    }
    return Object.freeze({ branch: levelResolution.branch });
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
          acquisitionMode.kind !== 'ordinary',
          branch.keepsakes,
          callingCard === undefined ? undefined : authored,
          acquisitionMode.kind === 'frozenConcaveStoneSecondary',
          acquisitionMode.kind !== 'frozenConcaveStoneSecondary' ||
            acquisitionMode.levelResolution === undefined
            ? undefined
            : Object.freeze([acquisitionMode.levelResolution]),
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
  const traitOfferIdentity =
    acquisitionIdentityOwner === undefined
      ? undefined
      : semanticAddressKey(createTraitOfferAddress(acquisitionIdentityOwner, role));
  // A clocked pickup producer survives unrelated chronology edits, so its
  // persisted identity is the semantic offer owner and role alone. Other
  // acquisition identities retain their event sequence semantics.
  const acquisitionIdentity =
    (effectiveAuthored.kind === 'chaos' ||
      selectedForIdentityDisposition?.kind === 'steadyGrowth' ||
      (selectedForIdentityDisposition?.kind === 'producePickups' &&
        selectedForIdentityDisposition.clock !== undefined) ||
      (selectedForIdentityDisposition?.kind === 'echo' &&
        (selectedForIdentityDisposition.effect === 'doubleShop' ||
          selectedForIdentityDisposition.effect === 'repeatKeepsake'))) &&
    traitOfferIdentity !== undefined
      ? selectedForIdentityDisposition?.kind === 'producePickups' &&
        selectedForIdentityDisposition.clock !== undefined
        ? traitOfferIdentity
        : `${traitOfferIdentity}:${sequence}`
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
    acquisitionMode.kind === 'frozenConcaveStoneSecondary' ? 'concaveStoneSecondary' : 'traitOffer',
  );
  // A Stone residual is an acquisition from the already-evaluated source
  // screen, not a second authored offer. Keep its callback machinery private
  // to settlement and publish only the source offer's evaluation trace.
  // Resolve an available Stone's omitted choice here so execution consumes
  // an explicit disposition without rewriting authored data or inferring it.
  const traitEvaluations =
    acquisitionMode.kind === 'frozenConcaveStoneSecondary'
      ? Object.freeze([...(branch.traitEvaluations ?? [])])
      : Object.freeze([
          ...(branch.traitEvaluations ?? []),
          evaluation.offer.kind === 'traits' &&
          evaluation.offer.concaveStoneResult === undefined &&
          catalog.traitGivers.byKey[evaluation.offer.giverKey]?.shopAwareGodTrait === true &&
          concaveStoneProcSupport(catalog, effectiveBranch.keepsakes) !== undefined
            ? Object.freeze({
                ...evaluation,
                offer: Object.freeze({
                  ...evaluation.offer,
                  concaveStoneResult: Object.freeze({ kind: 'noProc' as const }),
                }),
              })
            : evaluation,
        ]);
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
    const candidateOwner = traitOwnerAddress(reward.origin);
    const candidateContact =
      candidateOwner === undefined
        ? undefined
        : Object.freeze({
            address: createTraitOfferAddress(candidateOwner, role),
            context: Object.freeze({
              before,
              context: evaluationContext,
              arcanaFear: branch.arcanaFear,
              keepsakes: branch.keepsakes,
            }),
          });
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
      ...(candidateContact === undefined ? {} : { candidateContact }),
    });
  }
  const selected = applied.event.options[optionIndex(applied.event.selectedOptionKey)];
  // Jeweled Pom and Persephone are resolved from the exact pre-offer frontier
  // and installed atomically with the selected row. There is no post-selection
  // mutation, so sibling rows and Concave Stone residuals remain frozen.
  const traitAddress = (() => {
    if (acquisitionMode.kind === 'frozenConcaveStoneSecondary')
      return acquisitionMode.sourceTraitAddress;
    const owner = traitOwnerAddress(reward.origin);
    return owner === undefined ? undefined : createTraitOfferAddress(owner, role);
  })();
  const selectedDisposition =
    selected === undefined
      ? undefined
      : catalog.traits.byKey[selected.traitKey]?.selectedDisposition;
  const keepsakes =
    selectedDisposition?.kind === 'advanceCurrentKeepsake'
      ? advanceCurrentKeepsake(catalog, effectiveBranch.keepsakes, selectedDisposition.rankBonus)
      : effectiveBranch.keepsakes;
  const childCandidateContext = Object.freeze({
    before: evaluation.before,
    context: withBoonRarityFacts(
      catalog,
      branch,
      Object.freeze({ ...sourceTraitContext, resolvedProviderKey: evaluation.offer.giverKey }),
    ),
    arcanaFear: branch.arcanaFear,
    keepsakes: branch.keepsakes,
  });
  const selectedChildren = settleSelectedTraitChildren({
    catalog,
    traitHistory: applied.history,
    traitAddress,
    selectedOptionKey:
      acquisitionMode.kind === 'frozenConcaveStoneSecondary'
        ? acquisitionMode.sourceOptionKey
        : applied.event.selectedOptionKey,
    selected,
    selectedDisposition,
    targetedAcquisition: evaluation.targetedAcquisition,
    before: evaluation.before,
    candidateContext: childCandidateContext,
    directTraitSetBranchHistories: options.directTraitSetBranchHistories ?? [before],
    lifecyclePoint,
    sequence,
    ...(findingChronology === undefined ? {} : { findingChronology }),
  });
  if (findings !== undefined)
    for (const entry of selectedChildren.findings)
      addRewardFinding(findings, entry.finding, entry.atomicRegion, entry.chronology);
  const traitHistory = selectedChildren.traitHistory;
  let blockedChildAddress = selectedChildren.blockedChild?.address;
  let blockedChildCandidateContext = selectedChildren.blockedChild?.candidateContext;
  let settledBeforeChaos: RewardBranchState = Object.freeze({
    ...effectiveBranch,
    history: attachTraitHistory(branch.history, traitHistory),
    traitHistory,
    traitEvaluations,
    keepsakes,
  });
  settledBeforeChaos =
    effectiveAuthored.kind === 'traits'
      ? settleSelectedHexTree(
          catalog,
          settledBeforeChaos,
          effectiveAuthored,
          selectedForIdentity?.traitKey,
          evaluation,
          acquisitionMode.kind === 'frozenConcaveStoneSecondary',
        )
      : settledBeforeChaos;
  settledBeforeChaos = maybeAddGodSent(catalog, settledBeforeChaos);
  const settledAfterKeepsakeAdvance = settleMoonBeamPathPoints(
    catalog,
    settledBeforeChaos,
    selectedDisposition,
    effectiveBranch.keepsakes.currentKey,
  );
  const settledBranch =
    acquisitionMode.kind === 'frozenConcaveStoneSecondary'
      ? settledAfterKeepsakeAdvance
      : consumeChaosGodScreen(catalog, settledAfterKeepsakeAdvance, sequence, effectiveAuthored);
  let stoneBranch = settledBranch;
  if (
    blockedChildAddress === undefined &&
    authored?.kind === 'traits' &&
    effectiveAuthored.kind === 'traits' &&
    catalog.traitGivers.byKey[effectiveAuthored.giverKey]?.shopAwareGodTrait === true
  ) {
    const stone = prepareConcaveStoneSecondary(
      catalog,
      settledBranch,
      traitOwnerAddress(reward.origin),
      role,
      authored,
      effectiveAuthored,
      evaluation,
      selected?.traitKey,
      Object.freeze({
        before: evaluation.before,
        context: evaluation.context,
        ...(evaluation.arcanaFear === undefined ? {} : { arcanaFear: evaluation.arcanaFear }),
        ...(evaluation.keepsakes === undefined ? {} : { keepsakes: evaluation.keepsakes }),
      }),
      lifecyclePoint,
      sequence,
      findingChronology,
    );
    if (findings !== undefined)
      for (const entry of stone.findings)
        addRewardFinding(findings, entry.finding, entry.atomicRegion, entry.chronology);
    blockedChildAddress ??= stone.blockedChild?.address;
    blockedChildCandidateContext ??= stone.blockedChild?.candidateContext;
    if (stone.secondary !== undefined) {
      const secondarySettlement = applyTraitOfferForAcquisitionInternal(
        catalog,
        Object.freeze({
          ...settledBranch,
          keepsakes: consumeConcaveStone(settledBranch.keepsakes),
        }),
        {
          origin: reward.origin,
          traitOffersByAcquisitionRole: Object.freeze({
            concaveStoneSecondary: stone.secondary.offer,
          }),
          traitContext: sourceTraitContext,
        },
        'concaveStoneSecondary',
        lifecyclePoint,
        sequence,
        findings,
        findingChronology,
        Object.freeze({
          mode: Object.freeze({
            kind: 'frozenConcaveStoneSecondary',
            sourceOptionKey: stone.secondary.sourceOptionKey,
            ...(traitAddress === undefined ? {} : { sourceTraitAddress: traitAddress }),
            ...(stone.secondary.levelResolution === undefined
              ? {}
              : { levelResolution: stone.secondary.levelResolution }),
          }),
        }),
      );
      stoneBranch = secondarySettlement.branch;
      blockedChildAddress ??= secondarySettlement.blockedChild?.address;
      // Residual children retain the outer offer's address. Their candidate
      // capability advances this source frontier through the primary selection.
      if (secondarySettlement.blockedChild !== undefined)
        blockedChildCandidateContext ??= childCandidateContext;
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
  findingChronology?: FindingChronology,
  options: ApplyTraitOfferOptions = {},
): TraitOfferAcquisitionSettlement {
  const localFindings = new Map<string, FindingRegionEntry>();
  const complete = (
    settlement: Omit<TraitOfferAcquisitionSettlement, 'findingEntries'>,
  ): TraitOfferAcquisitionSettlement => {
    const findingEntries = Object.freeze([...localFindings.values()]);
    return Object.freeze({ ...settlement, findingEntries });
  };
  const traitContext = Object.freeze({
    ...(reward.traitContext ?? {}),
    ...(branch.stygianWell.yarnUses === 0 || reward.traitContext?.suppressTemporaryBoonRarity
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
    localFindings,
    findingChronology,
    options,
  );
  const authored = reward.traitOffersByAcquisitionRole?.[role];
  // A missing authored screen is an incomplete reached frontier, not a closed
  // choice. Retain both one-use effects so the repaired screen receives them.
  if (authored === undefined || authored === null) return complete(settlement);
  const owner = traitOwnerAddress(reward.origin);
  const priorMutation =
    owner === undefined
      ? undefined
      : [...(branch.traitHistory ?? createTraitHistoryState()).events]
          .reverse()
          .find(
            (event) => isTraitOfferMutationEvent(event) && sameTraitOccurrence(event.owner, owner),
          );
  const priorTraitMutations =
    priorMutation === undefined
      ? undefined
      : Object.freeze([
          Object.freeze({
            owner: priorMutation.owner,
            acquisitionRole: priorMutation.acquisitionRole,
          }),
        ]);
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
  if (!consumesYarn && !consumesHymn)
    return complete({
      ...settlement,
      ...(priorTraitMutations === undefined ? {} : { priorTraitMutations }),
    });
  return complete({
    ...settlement,
    ...(priorTraitMutations === undefined ? {} : { priorTraitMutations }),
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
  findingChronology?: FindingChronology,
): TraitOfferAcquisitionSettlement {
  const findings = new Map<string, FindingRegionEntry>();
  const settlement = applyTraitOfferForAcquisitionInternal(
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
    findings,
    findingChronology,
    Object.freeze({ mode: Object.freeze({ kind: 'direct' }) }),
    Object.freeze({ address, outcome }),
  );
  // The nested acquisition is edited atomically through its Echo choice owner;
  // its internal one-row offer is not an independently authored trait screen.
  return Object.freeze({
    ...settlement,
    ...(settlement.blockedChild === undefined
      ? {}
      : {
          blockedChild: Object.freeze({ ...settlement.blockedChild, address }),
        }),
    findingEntries: Object.freeze(
      [...findings.values()].map((entry) =>
        Object.freeze({
          ...entry,
          finding: Object.freeze({ ...entry.finding, origin: address }),
          atomicRegion: ownerRegion(address),
        }),
      ),
    ),
  });
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
    case 'echoLastRunBoon':
      return origin.trait.owner;
    default:
      return undefined;
  }
}

/** Resolve the concrete occurrence behind the small set of nested owners that
 * can emit or consume a trait mutation. This remains local to trait
 * settlement; execution only receives the resulting opaque edge. */
function traitOccurrenceId(address: SemanticAddress): string | undefined {
  if ('occurrenceId' in address) return address.occurrenceId;
  switch (address.kind) {
    case 'fountainRarityOutcome':
      return traitOccurrenceId(address.action);
    case 'keepsakeEquipResult':
      return traitOccurrenceId(address.selection);
    case 'traitOffer':
    case 'acquisitionRole':
    case 'levelResolution':
      return traitOccurrenceId(address.owner);
    case 'steadyGrowthOutcome':
    case 'transcendentEmbryoOutcome':
      return traitOccurrenceId(address.owner);
    case 'traitAcquisitionTarget':
    case 'circeResolution':
    case 'echoPomTarget':
    case 'naturalSelectionResult':
    case 'echoLastRunBoon':
    case 'echoLastReward':
    case 'allTogetherSet':
      return traitOccurrenceId(address.trait);
    case 'encounterPhase':
      return address.owner.occurrenceId;
    case 'nemesisRandomEvent':
      return traitOccurrenceId(address.encounter);
    default:
      return undefined;
  }
}

function sameTraitOccurrence(left: SemanticAddress, right: SemanticAddress): boolean {
  const leftOccurrence = traitOccurrenceId(left);
  const rightOccurrence = traitOccurrenceId(right);
  return leftOccurrence !== undefined && leftOccurrence === rightOccurrence;
}

export interface EncounterTraitOfferSettlement {
  readonly branch: RewardBranchState;
  /** Complete encounter-owned finding emissions; callers merge them by region and chronology. */
  readonly findingEntries: readonly FindingRegionEntry[];
  /** Exact post-outer/pre-effect branch retained when an authored child blocks settlement. */
  readonly blockedChild?: ReachedTraitChildCheckpoint;
  /** Exact invalid outer-offer contact retained independently of later branch survival. */
  readonly candidateContact?: ReachedTraitOfferCandidateContact;
}

function encounterTraitContext(
  catalog: Catalog,
  branch: RewardBranchState,
  providerKey: string,
  loadout:
    | Pick<
        TraitOfferContext,
        | 'weaponKey'
        | 'aspectKey'
        | 'boonRarityRoomOverride'
        | 'boonRarityItemOverride'
        | 'gorgonResolvedRarity'
        | 'suppressTemporaryBoonRarity'
      >
    | undefined,
  freshRarityOverride: import('../../../catalog-schema').TraitRarity | undefined,
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
  const history = branch.traitHistory ?? createTraitHistoryState();
  const adjusted =
    context.resolvedProviderKey === undefined
      ? context
      : offerGenerationAdjustedTraitGiverContext(
          catalog,
          history,
          context.resolvedProviderKey,
          context,
        );
  const facts = boonRarityFactsForOffer(catalog, history, adjusted, branch.arcanaFear);
  if (facts === undefined) return adjusted;
  return Object.freeze({
    ...adjusted,
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
  findingChronology?: FindingChronology,
  acquisitionRole = 'selection',
  freshRarityOverride?: import('../../../catalog-schema').TraitRarity,
  loadout?: Pick<
    TraitOfferContext,
    | 'weaponKey'
    | 'aspectKey'
    | 'boonRarityRoomOverride'
    | 'boonRarityItemOverride'
    | 'gorgonResolvedRarity'
    | 'suppressTemporaryBoonRarity'
  >,
  directTraitSetBranchHistories?: readonly TraitHistoryState[],
  unresolvedProviderKey?: string,
): EncounterTraitOfferSettlement {
  const localFindings = new Map<string, FindingRegionEntry>();
  const complete = (
    settlement: Omit<EncounterTraitOfferSettlement, 'findingEntries'>,
  ): EncounterTraitOfferSettlement => {
    const findingEntries = Object.freeze([...localFindings.values()]);
    return Object.freeze({ ...settlement, findingEntries });
  };
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
    const settlement = applyTraitOfferForAcquisition(
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
      findingChronology,
    );
    mergeTraitSettlementFindings(localFindings, settlement.findingEntries);
    return complete(settlement);
  }
  let blockedChild: EncounterTraitOfferSettlement['blockedChild'];
  let candidateContact: EncounterTraitOfferSettlement['candidateContact'];
  const settledBranch = ((): RewardBranchState => {
    if (offer.kind !== 'traits') {
      const settlement = applyTraitOfferForAcquisition(
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
        findingChronology,
      );
      mergeTraitSettlementFindings(localFindings, settlement.findingEntries);
      candidateContact = settlement.candidateContact;
      return settlement.branch;
    }
    const selected = offer.options[optionIndex(offer.selectedOptionKey)];
    const disposition =
      selected === undefined
        ? undefined
        : catalog.traits.byKey[selected.traitKey]?.selectedDisposition;
    const resolution = selected?.circeResolution;
    const preChoiceTraitHistory = branch.traitHistory ?? createTraitHistoryState();
    const owner = createTraitOfferAddress(origin as TraitOfferOwnerAddress, acquisitionRole);
    const source = {
      origin,
      traitOffersByAcquisitionRole: Object.freeze({ [acquisitionRole]: offer }),
      traitContext,
    } as const;
    // Record the exact pre-effect frontier before validating Circe's authored
    // child. Circe's ordinary offer findings stay provisional until that child
    // is valid, so the child remains the first blocking repair owner.
    const provisionalFindings =
      disposition?.kind === 'circe' ? new Map<string, FindingRegionEntry>() : localFindings;
    const appliedSettlement = applyTraitOfferForAcquisition(
      catalog,
      branch,
      source,
      acquisitionRole,
      lifecyclePoint,
      sequence,
      findingChronology,
      directTraitSetBranchHistories === undefined ? {} : { directTraitSetBranchHistories },
    );
    mergeTraitSettlementFindings(provisionalFindings, appliedSettlement.findingEntries);
    candidateContact = appliedSettlement.candidateContact;
    const applied = appliedSettlement.branch;
    blockedChild ??= appliedSettlement.blockedChild;
    const rejectCirce = (code: TraitFindingCode, detail?: string): RewardBranchState => {
      const address = createCirceResolutionAddress(owner, offer.selectedOptionKey);
      blockedChild = Object.freeze({ address, branch: applied });
      addTraitChildFinding(
        localFindings,
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
        if (provisionalFindings !== localFindings)
          for (const [key, entry] of provisionalFindings) localFindings.set(key, entry);
        return applied;
      }
      const rejection = assessCirceChild(catalog, branch, disposition, resolution);
      if (rejection !== undefined) return rejectCirce(rejection.code, rejection.detail);
    }
    if (provisionalFindings !== localFindings)
      for (const [key, entry] of provisionalFindings) localFindings.set(key, entry);
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
        addTraitChildFinding(
          localFindings,
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
      const childAssessment = assessEchoBoonChild(catalog, preChoiceTraitHistory, child);
      if (childAssessment.kind === 'rejected')
        return reject(childAssessment.rejection.code, childAssessment.rejection.detail);
      const { offer: nestedOffer, outcome, lootHistorySource } = childAssessment;
      const rewardHistory =
        lootHistorySource === undefined
          ? applied.history
          : recordLootTypeHistorySource(applied.history, lootHistorySource);
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
        findingChronology,
      );
      mergeTraitSettlementFindings(localFindings, nestedSettlement.findingEntries);
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
        addTraitChildFinding(
          localFindings,
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
      const settled = settleEchoPomChild(
        catalog,
        applied,
        appliedTraitHistory,
        preChoiceTraitHistory,
        createEchoPomTargetAddress(owner, offer.selectedOptionKey),
        acquisitionRole,
        sequence,
        lifecyclePoint,
        selected.traitKey,
        target,
      );
      return settled ?? reject('echoPomTargetUnavailable', target);
    }
    if (
      applied.traitHistory === branch.traitHistory ||
      disposition?.kind !== 'circe' ||
      selected === undefined
    )
      return applied;
    return settleValidatedCirceChild(catalog, applied, disposition, resolution, owner, sequence);
  })();
  return complete({
    branch: settledBranch,
    ...(blockedChild === undefined ? {} : { blockedChild }),
    ...(candidateContact === undefined ? {} : { candidateContact }),
  });
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
  const entry = createTraitChildFindingEntry(
    origin,
    lifecyclePoint,
    sequence,
    code,
    traitKey,
    detail,
    findingChronology ?? Object.freeze({ kind: 'history', sequence, boundary: 'at' }),
    atomicRegion,
  );
  addRewardFinding(findings, entry.finding, entry.atomicRegion, entry.chronology);
}

function mergeTraitSettlementFindings(
  findings: Map<string, FindingRegionEntry>,
  entries: readonly FindingRegionEntry[],
): void {
  for (const entry of entries) {
    for (const evaluation of entry.levelResolutionEvaluations ?? [undefined])
      addRewardFinding(findings, entry.finding, entry.atomicRegion, entry.chronology, evaluation);
  }
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
