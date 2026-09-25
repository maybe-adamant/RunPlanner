import { replaceSimulationTraitHistory } from '../../state/transitions';
import {
  applyTraitOfferContextTransition,
  openPendingTraitOffer,
  traitOfferGenerationState,
  traitOfferRoomKey,
  type TraitOfferContextTransition,
} from '../../state/pending-trait-offers';
import type { SimulationState } from '../../state/model';
import type { Catalog } from '../../../catalog-schema';
import { evaluateCallingCardOffer } from '../../keepsakes/reward-effects';
import {
  createCirceResolutionAddress,
  createEchoLastRunBoonAddress,
  createEchoPomTargetAddress,
  createLevelResolutionAddress,
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
  advanceChaosClock,
  assessTraitOfferBeforeRarification,
  boonRarityFactsForOffer,
  echoPomGreatestLevelTraitKeys,
  evaluateReachedEchoLastRunBoonOffer,
  evaluateReachedTraitOffer,
  isChaosGodScreenGiver,
  isAspectSpellDropDormant,
  recordReachedTraitOffer,
  resolveTraitOfferSource,
  traitOfferGenerationLegal,
  type TraitHistoryState,
} from '../../traits';
import type {
  EchoLastRunBoonOutcome,
  ResolvedTraitOfferSource,
  TraitOfferSourceContext,
} from '../../traits/offer-domain';
import { temporaryBoonRarityUses, limitedSwapUses } from '../../traits/offer-domain';
import {
  optionIndex,
  traitGiverForAcquisitionRole,
  type AuthoredTraitOffer,
  type AuthoredTraitOfferTraits,
} from '../../../authored-project/traits/state';
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

/** A completed upgrade screen rebuilds every unopened loot in its room. */
export type TraitOfferScreenCompletion = Extract<
  TraitOfferContextTransition,
  { readonly kind: 'screenCompleted' }
>;

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

/** Upgrade screens close through `CloseUpgradeChoiceScreen`; Spell screens do not. */
function screenCompletion(
  catalog: Catalog,
  origin: SemanticAddress,
  giverKey: string,
): TraitOfferScreenCompletion | undefined {
  if (catalog.traitGivers.byKey[giverKey]?.providerKind === 'spell') return undefined;
  const room = traitOfferRoomKey(origin);
  return room === undefined ? undefined : Object.freeze({ kind: 'screenCompleted', room });
}

/** Publishes one screen completion after its selection, children and charges settled. */
export function publishTraitOfferScreenCompletion(
  branch: RewardBranchState,
  completion: TraitOfferScreenCompletion | undefined,
): RewardBranchState {
  if (completion === undefined) return branch;
  const state = applyTraitOfferContextTransition(branch.state, completion);
  return state === branch.state ? branch : Object.freeze({ ...branch, state });
}

function consumeChaosGodScreen(
  catalog: Catalog,
  branch: RewardBranchState,
  sequence: number,
  offer: AuthoredTraitOffer | undefined,
): RewardBranchState {
  if (offer === undefined || !isChaosGodScreenGiver(catalog, offer.giverKey)) return branch;
  const before = branch.state.traitHistory;
  const traitHistory = advanceChaosClock(catalog, before, sequence, 'godBoonScreens');
  return traitHistory === before
    ? branch
    : Object.freeze({
        ...branch,
        state: replaceSimulationTraitHistory(branch.state, traitHistory),
      });
}

function applyTraitOfferForAcquisitionInternal(
  catalog: Catalog,
  reachedBranch: RewardBranchState,
  reward: {
    readonly origin: SemanticAddress;
    readonly offer?: CanonicalResolvedIncomingReward['offer'];
    readonly producerLifecycleKey?: string;
    readonly producerKind?: CanonicalResolvedIncomingReward['producerKind'];
    readonly traitOffersByAcquisitionRole?: CanonicalResolvedIncomingReward['traitOffersByAcquisitionRole'];
    readonly levelResolutionsByAcquisitionRole?: CanonicalResolvedIncomingReward['levelResolutionsByAcquisitionRole'];
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
  /** Present only when a legal upgrade screen settled completely. */
  readonly completion?: TraitOfferScreenCompletion;
} {
  const acquisitionMode = options.mode ?? Object.freeze({ kind: 'ordinary' as const });
  const openedOwner =
    acquisitionMode.kind === 'ordinary' ? traitOwnerAddress(reward.origin) : undefined;
  const openedAddress =
    openedOwner === undefined
      ? undefined
      : reward.levelResolutionsByAcquisitionRole?.[role] !== undefined
        ? createLevelResolutionAddress(openedOwner, role)
        : createTraitOfferAddress(openedOwner, role);
  // Opening a loot reads the options built at its spawn or last rebuild.
  const generation: SimulationState =
    openedAddress === undefined
      ? reachedBranch.state
      : traitOfferGenerationState(reachedBranch.state, openedAddress);
  const branch: RewardBranchState =
    openedAddress === undefined
      ? reachedBranch
      : (() => {
          const state = openPendingTraitOffer(reachedBranch.state, openedAddress);
          return state === reachedBranch.state
            ? reachedBranch
            : Object.freeze({ ...reachedBranch, state });
        })();
  // Aspect of Selene routes a later Spell Drop directly to Path settlement.
  // The concrete acquisition retains its history identity; its base-spell child
  // stays absent and must neither block nor change trait history.
  if (
    reward.offer?.rewardType === 'SpellDrop' &&
    isAspectSpellDropDormant(catalog, branch.state.equipment.aspectKey) &&
    role === 'self'
  )
    return Object.freeze({ branch });
  const authored = reward.traitOffersByAcquisitionRole?.[role];
  const authoredLevelResolution = reward.levelResolutionsByAcquisitionRole?.[role];
  const before = branch.state.traitHistory;
  const sourceTraitContext: TraitOfferSourceContext = Object.freeze({
    ...(reward.traitContext ?? {}),
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
                      state: branch.state,
                      generationState: generation,
                      source: withBoonRarityFacts(
                        catalog,
                        generation,
                        Object.freeze({
                          ...sourceTraitContext,
                          devotionNoDuo:
                            sourceTraitContext.devotionNoDuo ??
                            reward.offer?.rewardType === 'Devotion',
                          resolvedProviderKey: giver,
                        }),
                      ),
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
          generation,
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
      : assessTraitOfferBeforeRarification(catalog, authored, generation, authoredContext);
  const callingCard =
    authored === undefined || acquisitionMode.kind !== 'ordinary'
      ? undefined
      : evaluateCallingCardOffer(
          catalog,
          branch.state.keepsakes,
          authored,
          baseOffer?.legal ?? false,
        );
  const effectiveAuthored = callingCard?.offer ?? authored;
  const effectiveBranch =
    callingCard === undefined || callingCard.state === branch.state.keepsakes
      ? branch
      : Object.freeze({
          ...branch,
          state: Object.freeze({ ...branch.state, keepsakes: callingCard.state }),
        });
  const levelResolution = settleReachedLevelResolution({
    catalog,
    branch,
    generation: generation.traitHistory,
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
    // Only a Pom screen this settlement reached closes; a skipped effect appends nothing.
    const priorCount = branch.levelResolutionEvaluations?.length ?? 0;
    const evaluations = levelResolution.branch.levelResolutionEvaluations ?? [];
    const evaluated = evaluations.length > priorCount ? evaluations.at(-1) : undefined;
    const completion =
      acquisitionMode.kind === 'ordinary' &&
      levelResolution.findingEntries.length === 0 &&
      evaluated?.effectKind === 'choice'
        ? traitOfferRoomKey(reward.origin)
        : undefined;
    return Object.freeze({
      branch: levelResolution.branch,
      ...(completion === undefined
        ? {}
        : { completion: Object.freeze({ kind: 'screenCompleted' as const, room: completion }) }),
    });
  }
  if (effectiveAuthored === undefined) return Object.freeze({ branch: effectiveBranch });
  const evaluationContext = withBoonRarityFacts(
    catalog,
    generation,
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
          branch.state,
          evaluationContext,
          branch.traitEvaluations?.length ?? 0,
          acquisitionMode.kind !== 'ordinary',
          callingCard === undefined ? undefined : authored,
          acquisitionMode.kind === 'frozenConcaveStoneSecondary',
          acquisitionMode.kind !== 'frozenConcaveStoneSecondary' ||
            acquisitionMode.levelResolution === undefined
            ? undefined
            : Object.freeze([acquisitionMode.levelResolution]),
          generation,
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
            branch.state,
            evaluationContext,
            branch.traitEvaluations?.length ?? 0,
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
      ? branch.state.keepsakes.currentKey
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
          concaveStoneProcSupport(catalog, effectiveBranch.state.keepsakes) !== undefined
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
    ((evaluation.generation?.findings.length ?? 0) > 0 ||
      evaluation.composition.findings.length > 0 ||
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
      evaluation.generation?.findings.forEach((finding) => {
        addTraitFinding(
          findings,
          owner,
          role,
          lifecyclePoint,
          sequence,
          finding.code,
          undefined,
          undefined,
          undefined,
          findingChronology,
        );
      });
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
              state: branch.state,
              generationState: generation,
              source: evaluationContext,
            }),
          });
    const branchAfterOffer =
      effectiveAuthored.kind === 'chaos' && applied.history !== before
        ? Object.freeze({
            ...effectiveBranch,
            traitEvaluations,
            state: replaceSimulationTraitHistory(effectiveBranch.state, applied.history),
          })
        : Object.freeze({ ...effectiveBranch, traitEvaluations });
    const legal = traitOfferGenerationLegal(evaluation) && evaluation.targetedAcquisition.legal;
    // Valid Gold and Chaos screens settle without a trait event.
    const completion =
      legal && acquisitionMode.kind === 'ordinary'
        ? screenCompletion(catalog, reward.origin, effectiveAuthored.giverKey)
        : undefined;
    return Object.freeze({
      branch: consumeChaosGodScreen(
        catalog,
        branchAfterOffer,
        sequence,
        legal ? effectiveAuthored : undefined,
      ),
      ...(candidateContact === undefined ? {} : { candidateContact }),
      ...(completion === undefined ? {} : { completion }),
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
      ? advanceCurrentKeepsake(
          catalog,
          effectiveBranch.state.keepsakes,
          selectedDisposition.rankBonus,
        )
      : effectiveBranch.state.keepsakes;
  const childCandidateContext = Object.freeze({
    state: evaluation.state,
    generationState: generation,
    source: withBoonRarityFacts(
      catalog,
      generation,
      Object.freeze({ ...sourceTraitContext, resolvedProviderKey: evaluation.offer.giverKey }),
    ),
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
    before: evaluation.state.traitHistory,
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
    traitEvaluations,
    state: replaceSimulationTraitHistory(
      Object.freeze({
        ...effectiveBranch.state,
        rewardHistory: branch.state.rewardHistory,
        keepsakes,
      }),
      traitHistory,
    ),
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
    effectiveBranch.state.keepsakes.currentKey,
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
        state: evaluation.state,
        generationState: generation,
        source: evaluation.source,
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
          state: Object.freeze({
            ...settledBranch.state,
            keepsakes: consumeConcaveStone(settledBranch.state.keepsakes),
          }),
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
  const completion =
    blockedChildAddress === undefined &&
    acquisitionMode.kind === 'ordinary' &&
    traitOfferGenerationLegal(evaluation) &&
    evaluation.targetedAcquisition.legal
      ? screenCompletion(catalog, reward.origin, effectiveAuthored.giverKey)
      : undefined;
  return Object.freeze({
    branch: stoneBranch,
    ...(completion === undefined ? {} : { completion }),
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
  const traitContext: TraitOfferSourceContext = Object.freeze({ ...(reward.traitContext ?? {}) });
  const settlement = applyTraitOfferForAcquisitionInternal(
    catalog,
    branch,
    reward,
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
      : [...branch.state.traitHistory.events]
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
    branch.state,
    Object.freeze({ ...traitContext, resolvedProviderKey: authored.giverKey }),
  );
  const consumesYarn =
    temporaryBoonRarityUses(branch.state, traitContext) > 0 &&
    boonRarityFactsForOffer(catalog, branch.state, closedContext) !== undefined;
  const evaluation = settlement.branch.traitEvaluations?.[branch.traitEvaluations?.length ?? 0];
  // Hymn is spent only by a screen whose options were built while Hymn was held.
  const consumesHymn =
    evaluation !== undefined &&
    limitedSwapUses(evaluation.generationState) > 0 &&
    limitedSwapUses(branch.state) > 0 &&
    traitOfferGenerationLegal(evaluation) &&
    evaluation.assessments.some((assessment) => assessment.replacementTransition !== undefined);
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
      state: Object.freeze({
        ...settlement.branch.state,
        stygianWell: Object.freeze({
          ...settlement.branch.state.stygianWell,
          ...(consumesYarn
            ? { yarnUses: Math.max(0, settlement.branch.state.stygianWell.yarnUses - 1) }
            : {}),
          ...(consumesHymn
            ? { hymnUses: Math.max(0, settlement.branch.state.stygianWell.hymnUses - 1) }
            : {}),
        }),
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
  context: TraitOfferSourceContext,
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

/** Timeline dependencies compare bare occurrence ids of mutation owners; entry and site owners never match. */
function traitMutationOccurrenceId(address: SemanticAddress): string | undefined {
  if ('occurrenceId' in address) return address.occurrenceId;
  switch (address.kind) {
    case 'fountainRarityOutcome':
      return traitMutationOccurrenceId(address.action);
    case 'keepsakeEquipResult':
      return traitMutationOccurrenceId(address.selection);
    case 'traitOffer':
    case 'acquisitionRole':
    case 'levelResolution':
    case 'steadyGrowthOutcome':
    case 'transcendentEmbryoOutcome':
      return traitMutationOccurrenceId(address.owner);
    case 'traitAcquisitionTarget':
    case 'circeResolution':
    case 'echoPomTarget':
    case 'naturalSelectionResult':
    case 'echoLastRunBoon':
    case 'echoLastReward':
    case 'allTogetherSet':
      return traitMutationOccurrenceId(address.trait);
    case 'encounterPhase':
      return address.owner.occurrenceId;
    case 'nemesisRandomEvent':
      return traitMutationOccurrenceId(address.encounter);
    default:
      return undefined;
  }
}

function sameTraitOccurrence(left: SemanticAddress, right: SemanticAddress): boolean {
  const leftOccurrence = traitMutationOccurrenceId(left);
  return leftOccurrence !== undefined && leftOccurrence === traitMutationOccurrenceId(right);
}

export interface EncounterTraitOfferSettlement {
  readonly branch: RewardBranchState;
  /** Complete encounter-owned finding emissions; callers merge them by region and chronology. */
  readonly findingEntries: readonly FindingRegionEntry[];
  /** Exact post-outer/pre-effect branch retained when an authored child blocks settlement. */
  readonly blockedChild?: ReachedTraitChildCheckpoint;
  /** Exact invalid outer-offer contact retained independently of later branch survival. */
  readonly candidateContact?: ReachedTraitOfferCandidateContact;
  /** Whether this screen settled completely and rebuilt the room's unopened loot. */
  readonly screenCompleted: boolean;
}

function withBoonRarityFacts(
  catalog: Catalog,
  generation: SimulationState,
  source: ResolvedTraitOfferSource,
): ResolvedTraitOfferSource {
  return source.resolvedProviderKey === undefined
    ? source
    : resolveTraitOfferSource(catalog, generation, source.resolvedProviderKey, source);
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
  encounterSource?: TraitOfferSourceContext,
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
  const routedTraitContext: TraitOfferSourceContext = Object.freeze({
    ...(encounterSource ?? {}),
    resolvedProviderKey: providerKey,
    ...(freshRarityOverride === undefined ? {} : { freshRarityOverride }),
  });
  if (offer === null) {
    const settlement = applyTraitOfferForAcquisition(
      catalog,
      branch,
      {
        origin,
        traitOffersByAcquisitionRole: Object.freeze({ [acquisitionRole]: null }),
        traitContext: routedTraitContext,
      },
      acquisitionRole,
      lifecyclePoint,
      sequence,
      findingChronology,
    );
    mergeTraitSettlementFindings(localFindings, settlement.findingEntries);
    return complete({ ...settlement, screenCompleted: false });
  }
  let blockedChild: EncounterTraitOfferSettlement['blockedChild'];
  let candidateContact: EncounterTraitOfferSettlement['candidateContact'];
  let completion: TraitOfferScreenCompletion | undefined;
  const settledBranch = ((): RewardBranchState => {
    if (offer.kind !== 'traits') {
      const settlement = applyTraitOfferForAcquisition(
        catalog,
        branch,
        {
          origin,
          traitOffersByAcquisitionRole: Object.freeze({ [acquisitionRole]: offer }),
          traitContext: routedTraitContext,
        },
        acquisitionRole,
        lifecyclePoint,
        sequence,
        findingChronology,
      );
      mergeTraitSettlementFindings(localFindings, settlement.findingEntries);
      candidateContact = settlement.candidateContact;
      completion = settlement.completion;
      return settlement.branch;
    }
    const selected = offer.options[optionIndex(offer.selectedOptionKey)];
    const disposition =
      selected === undefined
        ? undefined
        : catalog.traits.byKey[selected.traitKey]?.selectedDisposition;
    const resolution = selected?.circeResolution;
    const preChoiceTraitHistory = branch.state.traitHistory;
    const owner = createTraitOfferAddress(origin as TraitOfferOwnerAddress, acquisitionRole);
    const source = {
      origin,
      traitOffersByAcquisitionRole: Object.freeze({ [acquisitionRole]: offer }),
      traitContext: routedTraitContext,
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
    completion = appliedSettlement.completion;
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
      if (applied.state.traitHistory === branch.state.traitHistory) {
        if (provisionalFindings !== localFindings)
          for (const [key, entry] of provisionalFindings) localFindings.set(key, entry);
        return applied;
      }
      const acquisitionOrdinal = branch.state.reached.routePosition.ordinal;
      const rejection = assessCirceChild(
        catalog,
        branch,
        disposition,
        resolution,
        acquisitionOrdinal,
      );
      if (rejection !== undefined) return rejectCirce(rejection.code, rejection.detail);
    }
    if (provisionalFindings !== localFindings)
      for (const [key, entry] of provisionalFindings) localFindings.set(key, entry);
    if (
      disposition?.kind === 'echo' &&
      disposition.effect === 'lastRunBoon' &&
      selected !== undefined &&
      applied.state.traitHistory !== undefined &&
      applied.state.traitHistory !== branch.state.traitHistory
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
      const childAssessment = assessEchoBoonChild(
        catalog,
        replaceSimulationTraitHistory(branch.state, preChoiceTraitHistory),
        routedTraitContext,
        child,
      );
      if (childAssessment.kind === 'rejected')
        return reject(childAssessment.rejection.code, childAssessment.rejection.detail);
      const { offer: nestedOffer, outcome, lootHistorySource } = childAssessment;
      const rewardHistory =
        lootHistorySource === undefined
          ? applied.state.rewardHistory
          : recordLootTypeHistorySource(applied.state.rewardHistory, lootHistorySource);
      const sourceApplied = Object.freeze({
        ...applied,
        state: Object.freeze({ ...applied.state, rewardHistory: rewardHistory }),
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
      if (nested.state.traitHistory === applied.state.traitHistory)
        return reject('echoLastRunBoonOptionUnavailable');
      return nested;
    }
    if (
      disposition?.kind === 'echo' &&
      disposition.effect === 'doubleLevel' &&
      selected !== undefined &&
      applied.state.traitHistory !== undefined &&
      applied.state.traitHistory !== branch.state.traitHistory
    ) {
      const appliedTraitHistory = applied.state.traitHistory;
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
      applied.state.traitHistory === branch.state.traitHistory ||
      disposition?.kind !== 'circe' ||
      selected === undefined
    )
      return applied;
    const acquisitionOrdinal = branch.state.reached.routePosition.ordinal;
    return settleValidatedCirceChild(
      catalog,
      applied,
      disposition,
      resolution,
      owner,
      sequence,
      acquisitionOrdinal,
    );
  })();
  const published = blockedChild === undefined ? completion : undefined;
  return complete({
    branch: publishTraitOfferScreenCompletion(settledBranch, published),
    ...(blockedChild === undefined ? {} : { blockedChild }),
    ...(candidateContact === undefined ? {} : { candidateContact }),
    screenCompleted: published !== undefined,
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
