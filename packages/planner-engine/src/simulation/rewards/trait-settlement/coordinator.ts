import { replaceSimulationTraitHistory } from '../../state/transitions';
import {
  applyTraitOfferContextTransition,
  openPendingTraitOffer,
  traitOfferGenerationState,
  traitOfferRoomKey,
  type TraitOfferContextTransition,
} from '../../state/pending-trait-offers';
import type { SimulationState } from '../../state/model';
import type { Catalog, TraitSelectedDisposition } from '../../../catalog-schema';
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
import type { ReachedLevelResolutionEvaluation, ReachedTraitOfferEvaluation } from '../../traits';

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

type TraitOfferAcquisitionSettlement = Omit<
  TraitOfferSettlementProduct,
  'findingEmissions' | 'evaluation'
> & {
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

/** One trait finding write, applied by the caller in emission order through the merging writer. */
interface TraitFindingEmission {
  readonly finding: SemanticFinding;
  readonly region: string;
  readonly chronology: FindingChronology | undefined;
  readonly evaluation?: ReachedLevelResolutionEvaluation;
}

/** One acquisition's settled branch, its ordered finding writes and its exact child contacts. */
interface TraitOfferSettlementProduct {
  readonly branch: RewardBranchState;
  readonly findingEmissions: readonly TraitFindingEmission[];
  readonly blockedChild?: ReachedTraitChildCheckpoint;
  readonly candidateContact?: ReachedTraitOfferCandidateContact;
  /** Present only when a legal upgrade screen settled completely. */
  readonly completion?: TraitOfferScreenCompletion;
  /** The evaluation this acquisition appended to the branch's trait trace. */
  readonly evaluation: ReachedTraitOfferEvaluation | undefined;
}

function regionEntryEmission(entry: FindingRegionEntry): TraitFindingEmission {
  return Object.freeze({
    finding: entry.finding,
    region: entry.atomicRegion,
    chronology: entry.chronology,
  });
}

/** A merged entry once per retained evaluation, or once when it has none. */
function entryEmissions(entries: readonly FindingRegionEntry[]): readonly TraitFindingEmission[] {
  return entries.flatMap((entry) =>
    (entry.levelResolutionEvaluations ?? [undefined]).map((evaluation) =>
      Object.freeze({
        finding: entry.finding,
        region: entry.atomicRegion,
        chronology: entry.chronology,
        ...(evaluation === undefined ? {} : { evaluation }),
      }),
    ),
  );
}

function settlementOf(
  product: TraitOfferSettlementProduct,
): Omit<TraitOfferSettlementProduct, 'findingEmissions' | 'evaluation'> {
  return Object.freeze({
    branch: product.branch,
    ...(product.blockedChild === undefined ? {} : { blockedChild: product.blockedChild }),
    ...(product.candidateContact === undefined
      ? {}
      : { candidateContact: product.candidateContact }),
    ...(product.completion === undefined ? {} : { completion: product.completion }),
  });
}

function reduceTraitFindingEmissions(
  emissions: readonly TraitFindingEmission[],
): readonly FindingRegionEntry[] {
  const findings = new Map<string, FindingRegionEntry>();
  for (const emission of emissions)
    addRewardFinding(
      findings,
      emission.finding,
      emission.region,
      emission.chronology,
      emission.evaluation,
    );
  return Object.freeze([...findings.values()]);
}

type TraitAcquisitionReward = {
  readonly origin: SemanticAddress;
  readonly offer?: CanonicalResolvedIncomingReward['offer'];
  readonly producerLifecycleKey?: string;
  readonly producerKind?: CanonicalResolvedIncomingReward['producerKind'];
  readonly traitOffersByAcquisitionRole?: CanonicalResolvedIncomingReward['traitOffersByAcquisitionRole'];
  readonly levelResolutionsByAcquisitionRole?: CanonicalResolvedIncomingReward['levelResolutionsByAcquisitionRole'];
  readonly traitContext?: CanonicalResolvedIncomingReward['traitContext'];
};

/** The fixed inputs every phase of one reached acquisition reads. */
interface TraitAcquisitionInputs {
  readonly catalog: Catalog;
  readonly reward: TraitAcquisitionReward;
  readonly role: string;
  readonly lifecyclePoint: string;
  readonly sequence: number;
  readonly findingChronology: FindingChronology | undefined;
  readonly mode: TraitOfferAcquisitionMode;
  readonly options: ApplyTraitOfferOptions;
}

type SettledAcquisition = Omit<TraitOfferSettlementProduct, 'findingEmissions' | 'evaluation'>;

/** Opening a loot reads the options built at its spawn or last rebuild. */
function openReachedOffer(
  inputs: TraitAcquisitionInputs,
  reachedBranch: RewardBranchState,
): { readonly generation: SimulationState; readonly branch: RewardBranchState } {
  const { reward, role, mode } = inputs;
  const openedOwner = mode.kind === 'ordinary' ? traitOwnerAddress(reward.origin) : undefined;
  const openedAddress =
    openedOwner === undefined
      ? undefined
      : reward.levelResolutionsByAcquisitionRole?.[role] !== undefined
        ? createLevelResolutionAddress(openedOwner, role)
        : createTraitOfferAddress(openedOwner, role);
  if (openedAddress === undefined)
    return { generation: reachedBranch.state, branch: reachedBranch };
  const state = openPendingTraitOffer(reachedBranch.state, openedAddress);
  return {
    generation: traitOfferGenerationState(reachedBranch.state, openedAddress),
    branch:
      state === reachedBranch.state ? reachedBranch : Object.freeze({ ...reachedBranch, state }),
  };
}

/** An unresolved screen blocks at its own offer with the exact pre-offer candidate context. */
function settleMissingOffer(
  inputs: TraitAcquisitionInputs,
  branch: RewardBranchState,
  generation: SimulationState,
  sourceTraitContext: TraitOfferSourceContext,
): {
  readonly settled: SettledAcquisition;
  readonly findingEmissions: readonly TraitFindingEmission[];
} {
  const { catalog, reward, role, lifecyclePoint, sequence, findingChronology } = inputs;
  const owner = traitOwnerAddress(reward.origin);
  const giver =
    sourceTraitContext.resolvedProviderKey ??
    (reward.offer === undefined
      ? undefined
      : traitGiverForAcquisitionRole(catalog, reward.offer, role));
  return {
    findingEmissions:
      owner === undefined
        ? []
        : [
            traitFindingEmission(
              owner,
              role,
              lifecyclePoint,
              sequence,
              'traitOfferMissing',
              undefined,
              undefined,
              undefined,
              findingChronology,
            ),
          ],
    settled: {
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
    },
  };
}

/** Calling Card row actions settle at the offer frontier, before the offer is evaluated. */
function applyCallingCard(
  inputs: TraitAcquisitionInputs,
  branch: RewardBranchState,
  generation: SimulationState,
  authored: AuthoredTraitOffer | undefined,
  sourceTraitContext: TraitOfferSourceContext,
) {
  const { catalog, reward, mode } = inputs;
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
    authored === undefined || authoredContext === undefined || mode.kind !== 'ordinary'
      ? undefined
      : assessTraitOfferBeforeRarification(catalog, authored, generation, authoredContext);
  const callingCard =
    authored === undefined || mode.kind !== 'ordinary'
      ? undefined
      : evaluateCallingCardOffer(
          catalog,
          branch.state.keepsakes,
          authored,
          baseOffer?.legal ?? false,
        );
  const effectiveBranch: RewardBranchState =
    callingCard === undefined || callingCard.state === branch.state.keepsakes
      ? branch
      : Object.freeze({
          ...branch,
          state: Object.freeze({ ...branch.state, keepsakes: callingCard.state }),
        });
  return { callingCard, effectiveAuthored: callingCard?.offer ?? authored, effectiveBranch };
}

/** A level-resolution role settles from the opened branch. */
function settleLevelResolution(
  inputs: TraitAcquisitionInputs,
  branch: RewardBranchState,
  generation: SimulationState,
):
  | {
      readonly settled: SettledAcquisition;
      readonly findingEmissions: readonly TraitFindingEmission[];
    }
  | undefined {
  const { catalog, reward, role, lifecyclePoint, sequence, findingChronology, mode } = inputs;
  const levelResolution = settleReachedLevelResolution({
    catalog,
    branch,
    generation: generation.traitHistory,
    reward,
    owner: traitOwnerAddress(reward.origin),
    role,
    authoredLevelResolution: reward.levelResolutionsByAcquisitionRole?.[role],
    lifecyclePoint,
    sequence,
    ...(findingChronology === undefined ? {} : { findingChronology }),
  });
  if (levelResolution === undefined) return undefined;
  // Only a Pom screen this settlement reached closes; a skipped effect appends nothing.
  const priorCount = branch.levelResolutionEvaluations?.length ?? 0;
  const evaluations = levelResolution.branch.levelResolutionEvaluations ?? [];
  const evaluated = evaluations.length > priorCount ? evaluations.at(-1) : undefined;
  const completion =
    mode.kind === 'ordinary' &&
    levelResolution.findingEntries.length === 0 &&
    evaluated?.effectKind === 'choice'
      ? traitOfferRoomKey(reward.origin)
      : undefined;
  return {
    findingEmissions: entryEmissions(levelResolution.findingEntries),
    settled: {
      branch: levelResolution.branch,
      ...(completion === undefined
        ? {}
        : { completion: Object.freeze({ kind: 'screenCompleted' as const, room: completion }) }),
    },
  };
}

/** Evaluates and records the effective offer, with its offer-frontier findings. */
function evaluateAuthoredOffer(
  inputs: TraitAcquisitionInputs,
  branch: RewardBranchState,
  effectiveBranch: RewardBranchState,
  generation: SimulationState,
  sourceTraitContext: TraitOfferSourceContext,
  authored: AuthoredTraitOffer | undefined,
  effectiveAuthored: AuthoredTraitOffer,
  callingCard: ReturnType<typeof applyCallingCard>['callingCard'],
  echoLastRunBoon: EchoLastRunBoonSettlement | undefined,
) {
  const { catalog, reward, role, lifecyclePoint, sequence, findingChronology, mode } = inputs;
  const findingEmissions: TraitFindingEmission[] = [];
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
          mode.kind !== 'ordinary',
          callingCard === undefined ? undefined : authored,
          mode.kind === 'frozenConcaveStoneSecondary',
          mode.kind !== 'frozenConcaveStoneSecondary' || mode.levelResolution === undefined
            ? undefined
            : Object.freeze([mode.levelResolution]),
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
          selectedForIdentityDisposition.effect === 'repeatKeepsake' ||
          selectedForIdentityDisposition.effect === 'roomDecay'))) &&
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
      ? (branch.state.keepsakes.currentKey ?? undefined)
      : undefined,
    mode.kind === 'frozenConcaveStoneSecondary' ? 'concaveStoneSecondary' : 'traitOffer',
  );
  // A Stone residual is an acquisition from the already-evaluated source
  // screen, not a second authored offer. Keep its callback machinery private
  // to settlement and publish only the source offer's evaluation trace.
  // Resolve an available Stone's omitted choice here so execution consumes
  // an explicit disposition without rewriting authored data or inferring it.
  const traitEvaluations =
    mode.kind === 'frozenConcaveStoneSecondary'
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
  const owner = traitOwnerAddress(reward.origin);
  if (callingCard !== undefined && callingCard.invalidActions.length > 0 && owner !== undefined)
    for (const actionIndex of callingCard.invalidActions)
      findingEmissions.push(
        traitFindingEmission(
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
        ),
      );
  if (
    owner !== undefined &&
    ((evaluation.generation?.findings.length ?? 0) > 0 ||
      evaluation.composition.findings.length > 0 ||
      evaluation.assessments.some((assessment) => !assessment.legal))
  ) {
    evaluation.assessments.forEach((assessment) =>
      assessment.findings.forEach((finding) => {
        findingEmissions.push(
          traitFindingEmission(
            owner,
            role,
            lifecyclePoint,
            sequence,
            finding.code,
            finding.traitKey,
            finding.detail,
            finding.requirementTraitKeys,
            findingChronology,
          ),
        );
      }),
    );
    evaluation.generation?.findings.forEach((finding) => {
      findingEmissions.push(
        traitFindingEmission(
          owner,
          role,
          lifecyclePoint,
          sequence,
          finding.code,
          undefined,
          undefined,
          undefined,
          findingChronology,
        ),
      );
    });
    evaluation.composition.findings.forEach((finding) => {
      findingEmissions.push(
        traitFindingEmission(
          owner,
          role,
          lifecyclePoint,
          sequence,
          finding.code,
          finding.traitKey,
          undefined,
          undefined,
          findingChronology,
        ),
      );
    });
  }
  return {
    evaluationContext,
    evaluation,
    selectedForIdentity,
    applied,
    traitEvaluations,
    findingEmissions,
  };
}

type EvaluatedAuthoredOffer = ReturnType<typeof evaluateAuthoredOffer>;

/** An offer without a selected trait event keeps its trace and any Calling Card spend. */
function settleUnappliedOffer(
  inputs: TraitAcquisitionInputs,
  branch: RewardBranchState,
  effectiveBranch: RewardBranchState,
  generation: SimulationState,
  before: TraitHistoryState,
  effectiveAuthored: AuthoredTraitOffer,
  evaluated: EvaluatedAuthoredOffer,
): SettledAcquisition {
  const { catalog, reward, role, sequence, mode } = inputs;
  const { applied, evaluation, traitEvaluations } = evaluated;
  const candidateOwner = traitOwnerAddress(reward.origin);
  const candidateContact =
    candidateOwner === undefined
      ? undefined
      : Object.freeze({
          address: createTraitOfferAddress(candidateOwner, role),
          context: Object.freeze({
            state: branch.state,
            generationState: generation,
            source: evaluated.evaluationContext,
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
    legal && mode.kind === 'ordinary'
      ? screenCompletion(catalog, reward.origin, effectiveAuthored.giverKey)
      : undefined;
  return {
    branch: consumeChaosGodScreen(
      catalog,
      branchAfterOffer,
      sequence,
      legal ? effectiveAuthored : undefined,
    ),
    ...(candidateContact === undefined ? {} : { candidateContact }),
    ...(completion === undefined ? {} : { completion }),
  };
}

interface BlockedChildChoice {
  readonly address: SemanticAddress | undefined;
  readonly candidateContext: ReachedTraitChildCheckpoint['candidateContext'];
}

/** Installs the selected row with its children, Hex tree, God Sent and Moon Beam points. */
function settleSelectedOffer(
  inputs: TraitAcquisitionInputs,
  branch: RewardBranchState,
  effectiveBranch: RewardBranchState,
  generation: SimulationState,
  before: TraitHistoryState,
  sourceTraitContext: TraitOfferSourceContext,
  effectiveAuthored: AuthoredTraitOffer,
  evaluated: EvaluatedAuthoredOffer,
  event: NonNullable<EvaluatedAuthoredOffer['applied']['event']>,
) {
  const { catalog, reward, role, lifecyclePoint, sequence, findingChronology, mode, options } =
    inputs;
  const { applied, evaluation, traitEvaluations, selectedForIdentity } = evaluated;
  const selected = event.options[optionIndex(event.selectedOptionKey)];
  // Jeweled Pom and Persephone are resolved from the exact pre-offer frontier
  // and installed atomically with the selected row. There is no post-selection
  // mutation, so sibling rows and Concave Stone residuals remain frozen.
  const traitAddress = (() => {
    if (mode.kind === 'frozenConcaveStoneSecondary') return mode.sourceTraitAddress;
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
      mode.kind === 'frozenConcaveStoneSecondary' ? mode.sourceOptionKey : event.selectedOptionKey,
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
  let settledBeforeChaos: RewardBranchState = Object.freeze({
    ...effectiveBranch,
    traitEvaluations,
    state: replaceSimulationTraitHistory(
      Object.freeze({
        ...effectiveBranch.state,
        rewardHistory: branch.state.rewardHistory,
        keepsakes,
      }),
      selectedChildren.traitHistory,
    ),
  });
  const hexSettlement =
    effectiveAuthored.kind === 'traits'
      ? settleSelectedHexTree(
          catalog,
          settledBeforeChaos,
          effectiveAuthored,
          selectedForIdentity?.traitKey,
          evaluation,
          mode.kind === 'frozenConcaveStoneSecondary',
          {
            traitAddress,
            lifecyclePoint,
            sequence,
            ...(findingChronology === undefined ? {} : { chronology: findingChronology }),
          },
        )
      : undefined;
  settledBeforeChaos = hexSettlement?.branch ?? settledBeforeChaos;
  settledBeforeChaos = maybeAddGodSent(catalog, settledBeforeChaos);
  const settledAfterKeepsakeAdvance = settleMoonBeamPathPoints(
    catalog,
    settledBeforeChaos,
    selectedDisposition,
    effectiveBranch.state.keepsakes.currentKey,
  );
  const blocked: BlockedChildChoice = {
    address: selectedChildren.blockedChild?.address,
    candidateContext: selectedChildren.blockedChild?.candidateContext,
  };
  return {
    settledBranch:
      mode.kind === 'frozenConcaveStoneSecondary'
        ? settledAfterKeepsakeAdvance
        : consumeChaosGodScreen(catalog, settledAfterKeepsakeAdvance, sequence, effectiveAuthored),
    selected,
    traitAddress,
    childCandidateContext,
    blocked,
    findingEmissions: [...selectedChildren.findings, ...(hexSettlement?.findings ?? [])].map(
      regionEntryEmission,
    ),
  };
}

/** Concave Stone's residual settles as a frozen secondary acquisition of the same screen. */
function settleConcaveStoneSecondary(
  inputs: TraitAcquisitionInputs,
  generation: SimulationState,
  sourceTraitContext: TraitOfferSourceContext,
  authored: AuthoredTraitOfferTraits,
  effectiveAuthored: AuthoredTraitOfferTraits,
  evaluation: EvaluatedAuthoredOffer['evaluation'],
  selected: ReturnType<typeof settleSelectedOffer>,
) {
  const { catalog, reward, role, lifecyclePoint, sequence, findingChronology } = inputs;
  const { settledBranch, traitAddress, childCandidateContext } = selected;
  const findingEmissions: TraitFindingEmission[] = [];
  let blockedChildAddress = selected.blocked.address;
  let blockedChildCandidateContext = selected.blocked.candidateContext;
  let stoneBranch = settledBranch;
  const stone = prepareConcaveStoneSecondary(
    catalog,
    settledBranch,
    traitOwnerAddress(reward.origin),
    role,
    authored,
    effectiveAuthored,
    evaluation,
    selected.selected?.traitKey,
    Object.freeze({
      state: evaluation.state,
      generationState: generation,
      source: evaluation.source,
    }),
    lifecyclePoint,
    sequence,
    findingChronology,
  );
  findingEmissions.push(...stone.findings.map(regionEntryEmission));
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
    // The residual's findings follow the Stone's in acquisition order.
    findingEmissions.push(...secondarySettlement.findingEmissions);
    stoneBranch = secondarySettlement.branch;
    blockedChildAddress ??= secondarySettlement.blockedChild?.address;
    // Residual children retain the outer offer's address. Their candidate
    // capability advances this source frontier through the primary selection.
    if (secondarySettlement.blockedChild !== undefined)
      blockedChildCandidateContext ??= childCandidateContext;
  }
  return {
    stoneBranch,
    blocked: { address: blockedChildAddress, candidateContext: blockedChildCandidateContext },
    findingEmissions,
  };
}

function applyTraitOfferForAcquisitionInternal(
  catalog: Catalog,
  reachedBranch: RewardBranchState,
  reward: TraitAcquisitionReward,
  role: string,
  lifecyclePoint: string,
  sequence: number,
  findingChronology?: FindingChronology,
  options: ApplyTraitOfferOptions = {},
  echoLastRunBoon?: EchoLastRunBoonSettlement,
): TraitOfferSettlementProduct {
  const inputs: TraitAcquisitionInputs = Object.freeze({
    catalog,
    reward,
    role,
    lifecyclePoint,
    sequence,
    findingChronology,
    mode: options.mode ?? Object.freeze({ kind: 'ordinary' as const }),
    options,
  });
  const findingEmissions: TraitFindingEmission[] = [];
  const settle = (product: SettledAcquisition): TraitOfferSettlementProduct =>
    Object.freeze({
      ...product,
      findingEmissions: Object.freeze(findingEmissions),
      evaluation: product.branch.traitEvaluations?.[reachedBranch.traitEvaluations?.length ?? 0],
    });
  const { generation, branch } = openReachedOffer(inputs, reachedBranch);
  // Aspect of Selene routes a later Spell Drop directly to Path settlement.
  // The concrete acquisition retains its history identity; its base-spell child
  // stays absent and must neither block nor change trait history.
  if (
    reward.offer?.rewardType === 'SpellDrop' &&
    isAspectSpellDropDormant(catalog, branch.state.equipment.aspectKey) &&
    role === 'self'
  )
    return settle({ branch });
  const authored = reward.traitOffersByAcquisitionRole?.[role];
  const before = branch.state.traitHistory;
  const sourceTraitContext: TraitOfferSourceContext = Object.freeze({
    ...(reward.traitContext ?? {}),
    ...(reward.producerLifecycleKey === 'EchoLastReward' || role === 'echoLastRunSelection'
      ? { stackBoostsSuppressed: true as const }
      : {}),
  });
  if (authored === null) {
    const missing = settleMissingOffer(inputs, branch, generation, sourceTraitContext);
    findingEmissions.push(...missing.findingEmissions);
    return settle(missing.settled);
  }
  const { callingCard, effectiveAuthored, effectiveBranch } = applyCallingCard(
    inputs,
    branch,
    generation,
    authored,
    sourceTraitContext,
  );
  const levelResolution = settleLevelResolution(inputs, branch, generation);
  if (levelResolution !== undefined) {
    findingEmissions.push(...levelResolution.findingEmissions);
    return settle(levelResolution.settled);
  }
  if (effectiveAuthored === undefined) return settle({ branch: effectiveBranch });
  const evaluated = evaluateAuthoredOffer(
    inputs,
    branch,
    effectiveBranch,
    generation,
    sourceTraitContext,
    authored,
    effectiveAuthored,
    callingCard,
    echoLastRunBoon,
  );
  findingEmissions.push(...evaluated.findingEmissions);
  const event = evaluated.applied.event;
  if (event === undefined)
    return settle(
      settleUnappliedOffer(
        inputs,
        branch,
        effectiveBranch,
        generation,
        before,
        effectiveAuthored,
        evaluated,
      ),
    );
  const selected = settleSelectedOffer(
    inputs,
    branch,
    effectiveBranch,
    generation,
    before,
    sourceTraitContext,
    effectiveAuthored,
    evaluated,
    event,
  );
  findingEmissions.push(...selected.findingEmissions);
  let settledBranch = selected.settledBranch;
  let blocked = selected.blocked;
  if (
    blocked.address === undefined &&
    authored?.kind === 'traits' &&
    effectiveAuthored.kind === 'traits' &&
    catalog.traitGivers.byKey[effectiveAuthored.giverKey]?.shopAwareGodTrait === true
  ) {
    const stone = settleConcaveStoneSecondary(
      inputs,
      generation,
      sourceTraitContext,
      authored,
      effectiveAuthored,
      evaluated.evaluation,
      selected,
    );
    findingEmissions.push(...stone.findingEmissions);
    settledBranch = stone.stoneBranch;
    blocked = stone.blocked;
  }
  const { evaluation } = evaluated;
  const completion =
    blocked.address === undefined &&
    inputs.mode.kind === 'ordinary' &&
    traitOfferGenerationLegal(evaluation) &&
    evaluation.targetedAcquisition.legal
      ? screenCompletion(catalog, reward.origin, effectiveAuthored.giverKey)
      : undefined;
  return settle({
    branch: settledBranch,
    ...(completion === undefined ? {} : { completion }),
    ...(blocked.address === undefined
      ? {}
      : {
          blockedChild: Object.freeze({
            address: blocked.address,
            branch: settledBranch,
            ...(blocked.candidateContext === undefined
              ? {}
              : { candidateContext: blocked.candidateContext }),
          }),
        }),
  });
}

export function applyTraitOfferForAcquisition(
  catalog: Catalog,
  branch: RewardBranchState,
  reward: TraitAcquisitionReward,
  role: string,
  lifecyclePoint: string,
  sequence: number,
  findingChronology?: FindingChronology,
  options: ApplyTraitOfferOptions = {},
): TraitOfferAcquisitionSettlement {
  const traitContext: TraitOfferSourceContext = Object.freeze({ ...(reward.traitContext ?? {}) });
  const product = applyTraitOfferForAcquisitionInternal(
    catalog,
    branch,
    reward,
    role,
    lifecyclePoint,
    sequence,
    findingChronology,
    options,
  );
  const { evaluation } = product;
  const settlement = settlementOf(product);
  const findingEntries = reduceTraitFindingEmissions(product.findingEmissions);
  const complete = (
    result: Omit<TraitOfferAcquisitionSettlement, 'findingEntries'>,
  ): TraitOfferAcquisitionSettlement => Object.freeze({ ...result, findingEntries });
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
  const product = applyTraitOfferForAcquisitionInternal(
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
    findingChronology,
    Object.freeze({ mode: Object.freeze({ kind: 'direct' }) }),
    Object.freeze({ address, outcome }),
  );
  const settlement = settlementOf(product);
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
      reduceTraitFindingEmissions(product.findingEmissions).map((entry) =>
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

/** Whether two owners belong to the same room: equal route, biome and occurrence. */
function sameTraitOccurrence(left: SemanticAddress, right: SemanticAddress): boolean {
  const leftRoom = traitOfferRoomKey(left);
  return leftRoom !== undefined && leftRoom === traitOfferRoomKey(right);
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

/** One settled encounter offer before its screen completion is published. */
interface EncounterOfferResult {
  readonly branch: RewardBranchState;
  readonly findingEmissions: readonly TraitFindingEmission[];
  readonly blockedChild: ReachedTraitChildCheckpoint | undefined;
  readonly candidateContact: ReachedTraitOfferCandidateContact | undefined;
  readonly completion: TraitOfferScreenCompletion | undefined;
}

/** A selected encounter trait row applied to the pre-choice branch, before its child settles. */
interface AppliedEncounterSelection {
  readonly catalog: Catalog;
  /** The pre-choice branch. */
  readonly branch: RewardBranchState;
  readonly offer: AuthoredTraitOfferTraits;
  readonly selected: AuthoredTraitOfferTraits['options'][number] | undefined;
  readonly owner: TraitOfferAddress;
  readonly acquisitionRole: string;
  readonly lifecyclePoint: string;
  readonly sequence: number;
  readonly findingChronology: FindingChronology | undefined;
  readonly routedTraitContext: TraitOfferSourceContext;
  readonly applied: RewardBranchState;
  readonly appliedEmissions: readonly TraitFindingEmission[];
  /** The applied acquisition's own blocked child, which a later child does not displace. */
  readonly appliedBlockedChild: ReachedTraitChildCheckpoint | undefined;
}

/** A child disposition's settled branch; a rejected child replaces any earlier blocked child. */
interface EncounterChildResult {
  readonly branch: RewardBranchState;
  readonly findingEmissions: readonly TraitFindingEmission[];
  readonly blockedChild: ReachedTraitChildCheckpoint | undefined;
}

function acceptApplied(
  selection: AppliedEncounterSelection,
  branch: RewardBranchState = selection.applied,
): EncounterChildResult {
  return {
    branch,
    findingEmissions: selection.appliedEmissions,
    blockedChild: selection.appliedBlockedChild,
  };
}

function rejectEncounterChild(
  selection: AppliedEncounterSelection,
  address: SemanticAddress,
  findingEmissions: readonly TraitFindingEmission[],
  code: TraitFindingCode,
  traitKey: string | undefined,
  detail?: string,
): EncounterChildResult {
  const { applied, lifecyclePoint, sequence, findingChronology } = selection;
  return {
    branch: applied,
    blockedChild: Object.freeze({ address, branch: applied }),
    findingEmissions: [
      ...findingEmissions,
      traitChildFindingEmission(
        address,
        lifecyclePoint,
        sequence,
        code,
        traitKey,
        detail,
        findingChronology,
      ),
    ],
  };
}

/** Circe's offer findings stay provisional until its child is valid; a rejection drops them. */
function settleCirce(
  selection: AppliedEncounterSelection,
  disposition: Extract<TraitSelectedDisposition, { readonly kind: 'circe' }>,
  selected: NonNullable<AppliedEncounterSelection['selected']>,
): EncounterChildResult {
  const { catalog, branch, offer, owner, sequence, applied } = selection;
  if (applied.state.traitHistory === branch.state.traitHistory) return acceptApplied(selection);
  const resolution = selected.circeResolution;
  const acquisitionOrdinal = branch.state.reached.routePosition.ordinal;
  const rejection = assessCirceChild(catalog, branch, disposition, resolution, acquisitionOrdinal);
  if (rejection !== undefined)
    return rejectEncounterChild(
      selection,
      createCirceResolutionAddress(owner, offer.selectedOptionKey),
      [],
      rejection.code,
      selected.traitKey,
      rejection.detail,
    );
  return acceptApplied(
    selection,
    settleValidatedCirceChild(
      catalog,
      applied,
      disposition,
      resolution,
      owner,
      sequence,
      acquisitionOrdinal,
    ),
  );
}

/** Echo's Boon Boon Boon settles its nested last-run offer through the Echo choice owner. */
function settleEchoLastRunBoon(
  selection: AppliedEncounterSelection,
  selected: NonNullable<AppliedEncounterSelection['selected']>,
): EncounterChildResult {
  const { catalog, branch, offer, owner, lifecyclePoint, sequence, findingChronology, applied } =
    selection;
  const address = createEchoLastRunBoonAddress(owner, offer.selectedOptionKey);
  const childAssessment = assessEchoBoonChild(
    catalog,
    replaceSimulationTraitHistory(branch.state, branch.state.traitHistory),
    selection.routedTraitContext,
    selected.echoLastRunBoon,
  );
  if (childAssessment.kind === 'rejected')
    return rejectEncounterChild(
      selection,
      address,
      selection.appliedEmissions,
      childAssessment.rejection.code,
      selected.traitKey,
      childAssessment.rejection.detail,
    );
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
  const findingEmissions = [
    ...selection.appliedEmissions,
    ...entryEmissions(nestedSettlement.findingEntries),
  ];
  const nested = nestedSettlement.branch;
  if (nested.state.traitHistory === applied.state.traitHistory)
    return rejectEncounterChild(
      selection,
      address,
      findingEmissions,
      'echoLastRunBoonOptionUnavailable',
      selected.traitKey,
    );
  return {
    branch: nested,
    findingEmissions,
    blockedChild: selection.appliedBlockedChild ?? nestedSettlement.blockedChild,
  };
}

/** Echo's Pom of Power settles its authored target from the pre-choice greatest-level domain. */
function settleEchoPom(
  selection: AppliedEncounterSelection,
  selected: NonNullable<AppliedEncounterSelection['selected']>,
  appliedTraitHistory: TraitHistoryState,
): EncounterChildResult {
  const { catalog, branch, offer, owner, acquisitionRole, lifecyclePoint, sequence, applied } =
    selection;
  const preChoiceTraitHistory = branch.state.traitHistory;
  const address = createEchoPomTargetAddress(owner, offer.selectedOptionKey);
  const domain = echoPomGreatestLevelTraitKeys(catalog, preChoiceTraitHistory);
  const target = selected.echoPomTarget;
  const reject = (code: TraitFindingCode, detail?: string) =>
    rejectEncounterChild(
      selection,
      address,
      selection.appliedEmissions,
      code,
      selected.traitKey,
      detail,
    );
  if (!('echoPomTarget' in selected)) return reject('echoPomTargetMissing');
  if (target === null)
    return domain.length === 0
      ? acceptApplied(selection)
      : reject('echoPomNoTargetUnavailable', domain.join(','));
  if (target === undefined || !domain.includes(target))
    return reject('echoPomTargetUnavailable', target);
  const settled = settleEchoPomChild(
    catalog,
    applied,
    appliedTraitHistory,
    preChoiceTraitHistory,
    address,
    acquisitionRole,
    sequence,
    lifecyclePoint,
    selected.traitKey,
    target,
  );
  return settled === undefined
    ? reject('echoPomTargetUnavailable', target)
    : acceptApplied(selection, settled);
}

/** Applies a selected trait row, then settles the child its disposition authors. */
function settleTraitsEncounterOffer(
  catalog: Catalog,
  branch: RewardBranchState,
  origin: SemanticAddress,
  offer: AuthoredTraitOfferTraits,
  acquisitionRole: string,
  lifecyclePoint: string,
  sequence: number,
  findingChronology: FindingChronology | undefined,
  routedTraitContext: TraitOfferSourceContext,
  directTraitSetBranchHistories: readonly TraitHistoryState[] | undefined,
): EncounterOfferResult {
  const selected = offer.options[optionIndex(offer.selectedOptionKey)];
  const disposition =
    selected === undefined
      ? undefined
      : catalog.traits.byKey[selected.traitKey]?.selectedDisposition;
  // Record the exact pre-effect frontier before validating any authored child.
  const appliedSettlement = applyTraitOfferForAcquisition(
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
    directTraitSetBranchHistories === undefined ? {} : { directTraitSetBranchHistories },
  );
  const applied = appliedSettlement.branch;
  const selection: AppliedEncounterSelection = Object.freeze({
    catalog,
    branch,
    offer,
    selected,
    owner: createTraitOfferAddress(origin as TraitOfferOwnerAddress, acquisitionRole),
    acquisitionRole,
    lifecyclePoint,
    sequence,
    findingChronology,
    routedTraitContext,
    applied,
    appliedEmissions: entryEmissions(appliedSettlement.findingEntries),
    appliedBlockedChild: appliedSettlement.blockedChild,
  });
  const choiceApplied =
    applied.state.traitHistory !== undefined &&
    applied.state.traitHistory !== branch.state.traitHistory;
  const child: EncounterChildResult =
    disposition?.kind === 'circe' && selected !== undefined
      ? settleCirce(selection, disposition, selected)
      : disposition?.kind === 'echo' &&
          disposition.effect === 'lastRunBoon' &&
          selected !== undefined &&
          choiceApplied
        ? settleEchoLastRunBoon(selection, selected)
        : disposition?.kind === 'echo' &&
            disposition.effect === 'doubleLevel' &&
            selected !== undefined &&
            choiceApplied
          ? settleEchoPom(selection, selected, applied.state.traitHistory)
          : acceptApplied(selection);
  return {
    ...child,
    candidateContact: appliedSettlement.candidateContact,
    completion: appliedSettlement.completion,
  };
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
    return Object.freeze({
      ...settlement,
      screenCompleted: false,
    });
  }
  const result: EncounterOfferResult =
    offer.kind === 'traits'
      ? settleTraitsEncounterOffer(
          catalog,
          branch,
          origin,
          offer,
          acquisitionRole,
          lifecyclePoint,
          sequence,
          findingChronology,
          routedTraitContext,
          directTraitSetBranchHistories,
        )
      : (() => {
          // Gold and Chaos screens have no authored child to block on.
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
          return {
            branch: settlement.branch,
            findingEmissions: entryEmissions(settlement.findingEntries),
            blockedChild: undefined,
            candidateContact: settlement.candidateContact,
            completion: settlement.completion,
          };
        })();
  const { blockedChild, candidateContact } = result;
  const published = blockedChild === undefined ? result.completion : undefined;
  return Object.freeze({
    branch: publishTraitOfferScreenCompletion(result.branch, published),
    findingEntries: reduceTraitFindingEmissions(result.findingEmissions),
    ...(blockedChild === undefined ? {} : { blockedChild }),
    ...(candidateContact === undefined ? {} : { candidateContact }),
    screenCompleted: published !== undefined,
  });
}

function traitChildFindingEmission(
  origin: SemanticAddress,
  lifecyclePoint: string,
  sequence: number,
  code: TraitFindingCode,
  traitKey: string | undefined,
  detail?: string,
  findingChronology?: FindingChronology,
): TraitFindingEmission {
  return regionEntryEmission(
    createTraitChildFindingEntry(
      origin,
      lifecyclePoint,
      sequence,
      code,
      traitKey,
      detail,
      findingChronology ?? Object.freeze({ kind: 'history', sequence, boundary: 'at' }),
    ),
  );
}

function traitFindingEmission(
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
): TraitFindingEmission {
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
  return Object.freeze({
    finding: value,
    region: ownerRegion(origin),
    chronology: findingChronology ?? Object.freeze({ kind: 'history', sequence, boundary: 'at' }),
  });
}
