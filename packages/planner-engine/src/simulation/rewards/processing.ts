import type { Catalog, RoomDeclaration } from '../../catalog-schema';
import { evaluateCallingCardOffer } from '../keepsakes';
import {
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createTraitOfferAddress,
  createAcquisitionRoleAddress,
  createKeepsakeEquipResultAddress,
  createRouteStartKeepsakeSelectionAddress,
  createCirceResolutionAddress,
  createLevelResolutionAddress,
  semanticAddressKey,
  type AcquisitionEntryAddress,
  type AcquisitionSiteAddress,
  type AcquisitionSiteOwnerAddress,
  type SemanticAddress,
  type TraitOfferOwnerAddress,
} from '../../authored-project/addresses';
import type {
  AuthoredKeepsakeEquipResults,
  AuthoredRewardState,
} from '../../authored-project/model';
import {
  applyConcreteAcquisition,
  applyOfferProjection,
  beginBiomeRewardHistory,
  beginCurrentRoomRewardHistory,
  consumeCountedOffer,
  createRewardBagState,
  createRewardHistoryState,
  evaluateShopGenerationSupport,
  evaluateShopPurchases,
  isOfferSupportedAtResolutionPoint,
  isPayloadLocallyValid,
  resolveAcquisitionRole,
  type AuthoredShopOffer,
  type RewardBagState,
  type RewardHistoryState,
  type RewardKernelFacts,
  type ShopGenerationSupport,
  type ShopGenerationWitness,
  type ShopPurchaseFailure,
  type ProducerLifecyclePointKey,
} from '../../reward-kernel';
import type { CountedRewardBinding } from '../../reward-kernel/bindings';
import type { HistoryEvent } from '../history';
import type {
  CanonicalAuthoredRoom,
  CanonicalLocalChildRoom,
  CanonicalResolvedIncomingReward,
} from '../materialization';
import type {
  FindingEvidence,
  RewardGenerationFindingCode,
  SemanticFinding,
  TraitFindingCode,
} from '../model';
import {
  findingRegion,
  findingIdentityKey,
  ownerRegion,
  type FindingChronology,
  type FindingRegionEntry,
} from '../finding-regions';
import type { RewardBranch, RewardEvent } from './model';
import {
  attachTraitHistory,
  createTraitHistoryState,
  foldTraitHistoryEvents,
  isPomEligibleTrait,
  evaluateReachedTraitOffer,
  assessTraitOfferBeforeRarification,
  evaluateReachedLevelResolution,
  recordReachedLevelResolution,
  recordReachedTraitOffer,
  type ReachedTraitOfferEvaluation,
  type ReachedLevelResolutionEvaluation,
  type TraitHistoryState,
} from '../traits';
import { optionIndex, type AuthoredTraitOffer } from '../../authored-project/traits';
import { levelResolutionEffectFor } from '../../reward-kernel/level-effects';
import type { ArcanaFearState } from '../arcana-fear';
import {
  activateTemporaryArcana,
  beginBiomeArcanaFearState,
  circeResolutionDomain,
  consumeOrdinaryRoomForfeit,
  manualArcanaGraspCost,
  promoteArcana,
  suppressFearVow,
} from '../arcana-fear';
import {
  createKeepsakeState,
  assessExperimentalHammerEquipResult,
  equipExperimentalHammer,
  assessJeweledPomEquipResult,
  equipJeweledPom,
  jeweledPomEffectForKey,
  refreshKeepsakeFatedStatus,
  consumeTimePieceCharge,
  beginBiomeKeepsakeState,
  type KeepsakeState,
} from '../keepsakes';

export type CanonicalRewardRoom = CanonicalAuthoredRoom | CanonicalLocalChildRoom;

interface PendingShopState {
  readonly profileKey: string;
  readonly witness: ShopGenerationWitness;
}

export interface RewardBranchState {
  readonly bags: Readonly<Record<string, RewardBagState>>;
  readonly history: RewardHistoryState;
  readonly events: readonly RewardEvent[];
  readonly pendingShops: Readonly<Record<string, PendingShopState>>;
  readonly processedThroughHistorySequence: number;
  readonly traitHistory?: TraitHistoryState;
  readonly traitEvaluations?: readonly ReachedTraitOfferEvaluation[];
  readonly levelResolutionEvaluations?: readonly ReachedLevelResolutionEvaluation[];
  readonly arcanaFear: ArcanaFearState;
  readonly keepsakes: KeepsakeState;
}

/**
 * The complete result of one reached mandatory producer acquisition site.
 * Participation and order are derived; optional entries can extend the same
 * history fold without changing its chronology authority.
 */
export interface AcquisitionSettlementProduct {
  readonly site: AcquisitionSiteAddress;
  readonly entries: readonly AcquisitionSettlementEntry[];
  readonly branches: readonly RewardBranchState[];
  /**
   * Exact pre-entry histories captured by one canonical ordered optional-pickup
   * settlement. Candidate artifacts consume these products; they never replay
   * the real settlement merely to rediscover an entry frontier.
   */
  readonly pickupEntryFrontiers?: readonly PickupAcquisitionEntryFrontier[];
  /** Exact pre-role branch products from the canonical settlement fold. */
  readonly roleFrontiers?: readonly AcquisitionRoleFrontier[];
}

export interface AcquisitionRoleFrontier {
  readonly address: import('../../authored-project/addresses').AcquisitionRoleAddress;
  readonly branchesBeforeRole: readonly RewardBranchState[];
  readonly source: AcquisitionSource;
  readonly lifecyclePoint: ProducerLifecyclePointKey;
  readonly historySequence: number;
  readonly settlement: {
    readonly site: AcquisitionSiteAddress;
    readonly entry: AcquisitionEntryAddress;
  };
}

export interface PickupAcquisitionEntryFrontier {
  readonly address: AcquisitionEntryAddress;
  readonly reward: AuthoredRewardState;
  readonly branchesBeforeEntry: readonly RewardBranchState[];
}

export interface AcquisitionSettlementEntry {
  readonly address: AcquisitionEntryAddress;
  readonly source: SemanticAddress;
  /** One atomic entry may apply several declaration-owned roles in sequence. */
  readonly acquisitionRoles: readonly AcquisitionSettlementRole[];
  readonly participation: 'mandatory' | 'optional' | 'dormant';
}

export interface AcquisitionSettlementRole {
  readonly role: string;
  readonly lifecyclePoint: ProducerLifecyclePointKey;
}

export interface OwnedAcquisitionSettlementRequest {
  readonly siteOwner: AcquisitionSiteOwnerAddress;
  readonly pointKey: string;
  readonly entryKey: string;
  readonly source: AcquisitionSource;
  readonly historySequence: number;
}
export interface AcquisitionRoleResolution extends AcquisitionSettlementRole {
  readonly historySequence: number;
}
export interface AcquisitionSource {
  readonly origin: TraitOfferOwnerAddress;
  readonly offer: CanonicalResolvedIncomingReward['offer'];
  readonly producerLifecycleKey: string;
  readonly producerKind?: CanonicalResolvedIncomingReward['producerKind'];
  /** Instance fact supplied by the producer, never inferred from an owner label. */
  readonly instanceProvenance: 'free' | 'paid';
  readonly traitOffersByAcquisitionRole?: CanonicalResolvedIncomingReward['traitOffersByAcquisitionRole'];
  readonly levelResolutionsByAcquisitionRole?: CanonicalResolvedIncomingReward['levelResolutionsByAcquisitionRole'];
  readonly conversionByAcquisitionRole?: Readonly<Record<string, 'normal' | 'gold'>>;
  readonly traitContext?: CanonicalResolvedIncomingReward['traitContext'];
}

/**
 * Shared Time Piece legality.  Settlement, progressive candidates, and the
 * persisted-value finding all ask this exact question at the frozen role
 * frontier; no consumer replays reward settlement to rediscover it.
 */
export function assessTimePieceConversion(
  catalog: Catalog,
  branch: RewardBranchState,
  source: AcquisitionSource,
  role: string,
  lifecyclePoint: ProducerLifecyclePointKey,
): { readonly supported: boolean; readonly evidence: FindingEvidence } {
  const acquisition = resolveAcquisitionRole(catalog.rewards, source.offer, role, lifecyclePoint);
  const goldConversionEligible =
    catalog.rewards.acquisitions.byKey[acquisition.acquisition.gameName]?.goldConversionEligible ===
    true;
  const remainingCharges = branch.keepsakes.timePiece?.remainingCharges ?? 0;
  const evidence = Object.freeze({
    ...offerEvidence(source.offer),
    role,
    lifecyclePoint,
    goldConversionEligible,
    instanceProvenance: source.instanceProvenance,
    fatedStatus: branch.keepsakes.fatedStatus,
    remainingCharges,
  });
  return Object.freeze({
    supported:
      goldConversionEligible &&
      source.instanceProvenance === 'free' &&
      branch.keepsakes.fatedStatus === 'Fated' &&
      remainingCharges > 0,
    evidence,
  });
}

export type RewardFactsFactory = (
  history: RewardHistoryState,
  currentRoomShopOptionNames?: ReadonlySet<string>,
) => RewardKernelFacts;

type RewardEventData<Event extends RewardEvent = RewardEvent> = Event extends RewardEvent
  ? Omit<Event, 'historySequence' | 'rewardSequence'>
  : never;

export function freezeRecord<T>(value: Readonly<Record<string, T>>): Readonly<Record<string, T>> {
  return Object.freeze({ ...value });
}

function orderedRecord<T>(value: Readonly<Record<string, T>>): readonly (readonly [string, T])[] {
  return Object.freeze(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => Object.freeze([key, entry] as const)),
  );
}

function equivalentBranchStateKey(branch: RewardBranchState): string {
  const history = branch.history;
  return JSON.stringify({
    bags: orderedRecord(branch.bags),
    history: {
      offerHistory: history.offerHistory,
      useRecord: orderedRecord(history.useRecord),
      biomeUseRecord: orderedRecord(history.biomeUseRecord),
      currentRoomUseRecord: orderedRecord(history.currentRoomUseRecord),
      lootTypeHistory: orderedRecord(history.lootTypeHistory),
      lootBiomeRecord: orderedRecord(history.lootBiomeRecord),
      consumableRecord: orderedRecord(history.consumableRecord),
      traitFacts: history.traitFacts,
      lastDevotionDepth: history.lastDevotionDepth,
    },
    pendingShops: orderedRecord(branch.pendingShops),
    traitHistory: branch.traitHistory,
    arcanaFear: branch.arcanaFear,
    keepsakes: branch.keepsakes,
    processedThroughHistorySequence: branch.processedThroughHistorySequence,
  });
}

function mergeTraitEvaluations(
  left: readonly ReachedTraitOfferEvaluation[] | undefined,
  right: readonly ReachedTraitOfferEvaluation[] | undefined,
): readonly ReachedTraitOfferEvaluation[] | undefined {
  const values = [...(left ?? []), ...(right ?? [])];
  if (values.length === 0) return undefined;
  const unique = new Map<string, ReachedTraitOfferEvaluation>();
  for (const value of values) {
    const key = JSON.stringify([
      semanticAddressKey(value.address),
      value.acquisitionRole,
      value.chronologicalIndex,
      value.before,
      value.context,
      value.offer,
      value.arcanaFear,
    ]);
    unique.set(key, value);
  }
  return Object.freeze([...unique.values()]);
}

function mergeLevelResolutionEvaluations(
  left: readonly ReachedLevelResolutionEvaluation[] | undefined,
  right: readonly ReachedLevelResolutionEvaluation[] | undefined,
): readonly ReachedLevelResolutionEvaluation[] | undefined {
  const values = [...(left ?? []), ...(right ?? [])];
  if (values.length === 0) return undefined;
  const unique = new Map<string, ReachedLevelResolutionEvaluation>();
  for (const value of values) {
    unique.set(
      JSON.stringify([
        semanticAddressKey(value.address),
        value.chronologicalIndex,
        value.before,
        value.value,
      ]),
      value,
    );
  }
  return Object.freeze([...unique.values()]);
}

export function mergeEquivalentRewardBranches(
  branches: readonly RewardBranchState[],
): readonly RewardBranchState[] {
  const merged = new Map<string, RewardBranchState>();
  for (const branch of branches) {
    const key = equivalentBranchStateKey(branch);
    const previous = merged.get(key);
    if (previous === undefined) {
      merged.set(key, branch);
    } else {
      const traitEvaluations = mergeTraitEvaluations(
        previous.traitEvaluations,
        branch.traitEvaluations,
      );
      const levelResolutionEvaluations = mergeLevelResolutionEvaluations(
        previous.levelResolutionEvaluations,
        branch.levelResolutionEvaluations,
      );
      merged.set(
        key,
        traitEvaluations === undefined && levelResolutionEvaluations === undefined
          ? previous
          : Object.freeze({
              ...previous,
              ...(traitEvaluations === undefined ? {} : { traitEvaluations }),
              ...(levelResolutionEvaluations === undefined ? {} : { levelResolutionEvaluations }),
            }),
      );
    }
  }
  return Object.freeze([...merged.values()]);
}

export function appendRewardEvent(
  branch: RewardBranchState,
  historySequence: number,
  event: RewardEventData,
): RewardBranchState {
  const next = Object.freeze({
    ...event,
    rewardSequence: branch.events.length + 1,
    historySequence,
  }) as RewardEvent;
  return Object.freeze({
    ...branch,
    events: Object.freeze([...branch.events, next]),
    processedThroughHistorySequence: historySequence,
  });
}

function applyTraitOfferForAcquisition(
  catalog: Catalog,
  branch: RewardBranchState,
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
): RewardBranchState {
  const authored = reward.traitOffersByAcquisitionRole?.[role];
  const authoredLevelResolution = reward.levelResolutionsByAcquisitionRole?.[role];
  const before = branch.traitHistory ?? createTraitHistoryState();
  const authoredContext =
    authored === undefined
      ? undefined
      : {
          ...(reward.traitContext ?? {}),
          devotionNoDuo:
            reward.traitContext?.devotionNoDuo ?? reward.offer?.rewardType === 'Devotion',
          ...(authored.kind === 'fallbackGold' || authored.deathDefianceConditionMet === undefined
            ? {}
            : { deathDefianceConditionMet: authored.deathDefianceConditionMet }),
          resolvedProviderKey: authored.giverKey,
        };
  const baseOffer =
    authored === undefined || authoredContext === undefined
      ? undefined
      : assessTraitOfferBeforeRarification(catalog, authored, before, authoredContext);
  const callingCard =
    authored === undefined
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
      if (owner === undefined) return branch;
      const address = createLevelResolutionAddress(owner, role);
      // A missing child is still a reached, incomplete declaration-owned Pom.
      // Do not let malformed legacy/project state silently bypass the effect.
      const levelResolution =
        authoredLevelResolution ??
        (effect.kind === 'visibleChoice'
          ? { kind: 'choice' as const, offeredTraitKeys: Object.freeze([]), selectedTraitKey: null }
          : { kind: 'random' as const, targetTraitKey: null });
      const evaluation = evaluateReachedLevelResolution(
        catalog,
        address,
        levelResolution,
        effect.levelCount,
        before,
        branch.levelResolutionEvaluations?.length ?? 0,
        effect.kind === 'visibleChoice' ? 'choice' : 'random',
        effect.kind === 'randomTargetIfAvailable',
      );
      const applied = recordReachedLevelResolution(
        catalog,
        address,
        levelResolution,
        effect.levelCount,
        before,
        sequence,
        lifecyclePoint,
        effect.kind === 'visibleChoice' ? 'choice' : 'random',
        effect.kind === 'randomTargetIfAvailable',
      );
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
        ...branch,
        history: attachTraitHistory(branch.history, applied.history),
        traitHistory: applied.history,
        levelResolutionEvaluations: Object.freeze([
          ...(branch.levelResolutionEvaluations ?? []),
          evaluation,
        ]),
      });
    }
  }
  if (effectiveAuthored === undefined) return effectiveBranch;
  const evaluation = evaluateReachedTraitOffer(
    catalog,
    reward.origin,
    role,
    effectiveAuthored,
    before,
    {
      ...(reward.traitContext ?? {}),
      devotionNoDuo: reward.traitContext?.devotionNoDuo ?? reward.offer?.rewardType === 'Devotion',
      ...(effectiveAuthored.kind === 'fallbackGold' ||
      effectiveAuthored.deathDefianceConditionMet === undefined
        ? {}
        : { deathDefianceConditionMet: effectiveAuthored.deathDefianceConditionMet }),
      resolvedProviderKey: effectiveAuthored.giverKey,
    },
    branch.traitEvaluations?.length ?? 0,
    branch.arcanaFear,
    false,
    branch.keepsakes,
    callingCard === undefined ? undefined : authored,
  );
  const applied = recordReachedTraitOffer(catalog, evaluation, sequence, lifecyclePoint);
  const traitEvaluations = Object.freeze([...(branch.traitEvaluations ?? []), evaluation]);
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
      evaluation.targetedAcquisition.findings.length > 0 ||
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
      evaluation.targetedAcquisition.findings.forEach((finding) => {
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
  if (applied.event === undefined) return Object.freeze({ ...effectiveBranch, traitEvaluations });
  const selected = applied.event.options[optionIndex(applied.event.selectedOptionKey)];
  const pomLevels =
    branch.keepsakes.jeweledPom?.active === true &&
    selected !== undefined &&
    isPomEligibleTrait(catalog, selected.traitKey)
      ? branch.keepsakes.jeweledPom.levels
      : undefined;
  const traitHistory =
    pomLevels === undefined || selected === undefined
      ? applied.history
      : foldTraitHistoryEvents(catalog, [
          ...applied.history.events,
          Object.freeze({
            kind: 'levelMutation' as const,
            owner: evaluation.address,
            acquisitionRole: role,
            sequence,
            acquisitionPoint: lifecyclePoint,
            ...(branch.keepsakes.jeweledPom?.grantedTraitKey === undefined
              ? {}
              : { sourceTraitKey: branch.keepsakes.jeweledPom.grantedTraitKey }),
            targetTraitKey: selected.traitKey,
            oldLevel: applied.history.equippedTraits[selected.traitKey]?.level ?? 1,
            newLevel: (applied.history.equippedTraits[selected.traitKey]?.level ?? 1) + pomLevels,
          }),
        ]);
  return Object.freeze({
    ...effectiveBranch,
    history: attachTraitHistory(branch.history, traitHistory),
    traitHistory,
    traitEvaluations,
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
      return origin;
    case 'acquisitionEntry':
      return origin;
    default:
      return undefined;
  }
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
): RewardBranchState {
  if (offer.kind === 'fallbackGold') {
    return applyTraitOfferForAcquisition(
      catalog,
      branch,
      {
        origin,
        traitOffersByAcquisitionRole: Object.freeze({ selection: offer }),
      },
      'selection',
      lifecyclePoint,
      sequence,
      findings,
      findingChronology,
    );
  }
  const selected = offer.options[optionIndex(offer.selectedOptionKey)];
  const disposition =
    selected === undefined
      ? undefined
      : catalog.traits.byKey[selected.traitKey]?.selectedDisposition;
  const resolution = selected?.circeResolution;
  const owner = createTraitOfferAddress(origin as TraitOfferOwnerAddress, 'selection');
  const circeDomain =
    disposition?.kind === 'circe'
      ? circeResolutionDomain(catalog, branch.arcanaFear, disposition.effect)
      : undefined;
  const source = {
    origin,
    traitOffersByAcquisitionRole: Object.freeze({ selection: offer }),
    traitContext: Object.freeze({
      manualArcanaGraspCost: manualArcanaGraspCost(catalog, branch.arcanaFear),
      circeRemovableFearVow: circeDomain?.effect === 'disableFear' && circeDomain.outerAvailable,
    }),
  } as const;
  // Record the exact pre-effect frontier before validating Circe's authored
  // child. Circe's ordinary offer findings stay provisional until that child
  // is valid, so the child remains the first blocking repair owner.
  const provisionalFindings =
    disposition?.kind === 'circe' && findings !== undefined
      ? new Map<string, FindingRegionEntry>()
      : findings;
  const applied = applyTraitOfferForAcquisition(
    catalog,
    branch,
    source,
    'selection',
    lifecyclePoint,
    sequence,
    provisionalFindings,
    findingChronology,
  );
  const preEffect: RewardBranchState = Object.freeze({
    ...branch,
    ...(applied.traitEvaluations === undefined
      ? {}
      : { traitEvaluations: applied.traitEvaluations }),
  });
  const rejectCirce = (code: TraitFindingCode, detail?: string): RewardBranchState => {
    if (findings !== undefined)
      addCirceResolutionFinding(
        findings,
        createCirceResolutionAddress(
          createTraitOfferAddress(origin as TraitOfferOwnerAddress, 'selection'),
          offer.selectedOptionKey,
        ),
        lifecyclePoint,
        sequence,
        code,
        selected?.traitKey,
        detail,
        findingChronology,
      );
    return preEffect;
  };
  if (disposition?.kind === 'circe') {
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
}

function addCirceResolutionFinding(
  findings: Map<string, FindingRegionEntry>,
  origin: SemanticAddress,
  lifecyclePoint: string,
  sequence: number,
  code: TraitFindingCode,
  traitKey: string | undefined,
  detail?: string,
  findingChronology?: FindingChronology,
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
    ownerRegion(origin),
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

export function advanceRewardBranch(
  branch: RewardBranchState,
  historySequence: number,
): RewardBranchState {
  return branch.processedThroughHistorySequence >= historySequence
    ? branch
    : Object.freeze({ ...branch, processedThroughHistorySequence: historySequence });
}

export function advanceRewardBranches(
  branches: readonly RewardBranchState[],
  historySequence: number,
): readonly RewardBranchState[] {
  return Object.freeze(branches.map((branch) => advanceRewardBranch(branch, historySequence)));
}

export function beginRewardRoom(
  branches: readonly RewardBranchState[],
  historySequence: number,
): readonly RewardBranchState[] {
  return Object.freeze(
    branches.map((branch) =>
      advanceRewardBranch(
        Object.freeze({ ...branch, history: beginCurrentRoomRewardHistory(branch.history) }),
        historySequence,
      ),
    ),
  );
}

export function initializeRewardBranches(
  initialBranches?: readonly RewardBranch[],
  initialArcanaFear?: ArcanaFearState,
  catalog?: Catalog,
  startingKeepsakeKey?: string,
  startingKeepsakeEquipResults?: AuthoredKeepsakeEquipResults,
  routeKey?: string,
  loadout?: { readonly weaponKey: string; readonly aspectKey: string },
): readonly RewardBranchState[] {
  if (initialBranches === undefined) {
    if (
      initialArcanaFear === undefined ||
      catalog === undefined ||
      startingKeepsakeKey === undefined
    )
      throw new Error('initial branch state is required');
    const branch = Object.freeze({
      bags: Object.freeze({}),
      history: createRewardHistoryState(),
      events: Object.freeze([]),
      pendingShops: Object.freeze({}),
      processedThroughHistorySequence: 0,
      traitHistory: createTraitHistoryState(),
      traitEvaluations: Object.freeze([]),
      arcanaFear: initialArcanaFear,
      keepsakes: createKeepsakeState(catalog, startingKeepsakeKey, initialArcanaFear),
    });
    const pomApplied = applyJeweledPomEquipResult(
      catalog,
      branch,
      startingKeepsakeKey,
      startingKeepsakeEquipResults,
      createKeepsakeEquipResultAddress(
        createRouteStartKeepsakeSelectionAddress(routeKey ?? 'route'),
        'jeweledPom',
      ),
      0,
    );
    return Object.freeze([
      applyExperimentalHammerEquipResult(
        catalog,
        pomApplied,
        startingKeepsakeKey,
        startingKeepsakeEquipResults,
        createKeepsakeEquipResultAddress(
          createRouteStartKeepsakeSelectionAddress(routeKey ?? 'route'),
          'experimentalHammer',
        ),
        0,
        loadout ?? { weaponKey: '', aspectKey: '' },
      ),
    ]);
  }
  return Object.freeze(
    initialBranches.map((branch) =>
      Object.freeze({
        bags: branch.bags,
        history: beginBiomeRewardHistory(branch.history),
        events: Object.freeze([]),
        pendingShops: Object.freeze({}),
        processedThroughHistorySequence: 0,
        traitHistory: branch.traitHistory ?? createTraitHistoryState(),
        traitEvaluations: Object.freeze([]),
        arcanaFear: beginBiomeArcanaFearState(branch.arcanaFear),
        keepsakes: beginBiomeKeepsakeState(branch.keepsakes),
      }),
    ),
  );
}

/** Applies the closed immediate Jeweled Pom result through ordinary trait history. */
export function applyJeweledPomEquipResult(
  catalog: Catalog,
  branch: RewardBranchState,
  equippedKeepsakeKey: string,
  results: AuthoredKeepsakeEquipResults | undefined,
  owner: SemanticAddress,
  sequence: number,
): RewardBranchState {
  const result = results?.jeweledPom;
  const effect = jeweledPomEffectForKey(catalog, equippedKeepsakeKey);
  if (effect === undefined || result === undefined) return branch;
  const before = branch.traitHistory ?? createTraitHistoryState();
  if (!assessJeweledPomEquipResult(catalog, result, before, branch.keepsakes.fatedStatus).legal)
    return branch;
  const offer: AuthoredTraitOffer = Object.freeze({
    kind: 'traits',
    giverKey: effect.giverKey,
    options: Object.freeze([
      {
        traitKey: result.traitKey,
        ...(result.rarity === undefined ? {} : { rarity: result.rarity }),
      },
    ]) as import('../../authored-project/traits').OneToThree<
      import('../../authored-project/traits').AuthoredTraitOption
    >,
    selectedOptionKey: 'option1',
    ...(result.deathDefianceConditionMet === undefined
      ? {}
      : { deathDefianceConditionMet: result.deathDefianceConditionMet }),
  });
  const evaluation = evaluateReachedTraitOffer(
    catalog,
    owner,
    'jeweledPomEquip',
    offer,
    before,
    {
      ...(result.deathDefianceConditionMet === undefined
        ? {}
        : { deathDefianceConditionMet: result.deathDefianceConditionMet }),
      resolvedProviderKey: effect.giverKey,
    },
    branch.traitEvaluations?.length ?? 0,
    branch.arcanaFear,
    true,
    branch.keepsakes,
  );
  const acquisitionIdentity = `${semanticAddressKey(owner)}:${sequence}`;
  const applied = recordReachedTraitOffer(
    catalog,
    evaluation,
    sequence,
    'keepsakeEquip',
    acquisitionIdentity,
  );
  if (applied.history === before) return branch;
  return Object.freeze({
    ...branch,
    history: attachTraitHistory(branch.history, applied.history),
    traitHistory: applied.history,
    keepsakes: equipJeweledPom(
      branch.keepsakes,
      result.traitKey,
      effect.subsequentEligibleTraitLevels,
      acquisitionIdentity,
    ),
    traitEvaluations: Object.freeze([...(branch.traitEvaluations ?? []), evaluation]),
  });
}

/** Applies the one direct, rarityless Experimental Hammer acquisition. */
export function applyExperimentalHammerEquipResult(
  catalog: Catalog,
  branch: RewardBranchState,
  equippedKeepsakeKey: string,
  results: AuthoredKeepsakeEquipResults | undefined,
  owner: SemanticAddress,
  sequence: number,
  loadout: { readonly weaponKey: string; readonly aspectKey: string },
): RewardBranchState {
  const effect = catalog.keepsakes.byKey[equippedKeepsakeKey]?.effect;
  const result = results?.experimentalHammer;
  if (effect?.kind !== 'experimentalHammer' || result === undefined) return branch;
  const before = branch.traitHistory ?? createTraitHistoryState();
  if (!assessExperimentalHammerEquipResult(catalog, result, before, loadout).legal) return branch;
  const offer: AuthoredTraitOffer = Object.freeze({
    kind: 'traits',
    giverKey: effect.giverKey,
    options: Object.freeze([
      { traitKey: result.traitKey },
    ]) as import('../../authored-project/traits').OneToThree<
      import('../../authored-project/traits').AuthoredTraitOption
    >,
    selectedOptionKey: 'option1',
  });
  const evaluation = evaluateReachedTraitOffer(
    catalog,
    owner,
    'experimentalHammerEquip',
    offer,
    before,
    loadout,
    branch.traitEvaluations?.length ?? 0,
    branch.arcanaFear,
    true,
    branch.keepsakes,
  );
  const acquisitionIdentity = `${semanticAddressKey(owner)}:${sequence}`;
  const applied = recordReachedTraitOffer(
    catalog,
    evaluation,
    sequence,
    'keepsakeEquip',
    acquisitionIdentity,
  );
  if (applied.history === before) return branch;
  return Object.freeze({
    ...branch,
    history: attachTraitHistory(branch.history, applied.history),
    traitHistory: applied.history,
    keepsakes: equipExperimentalHammer(
      branch.keepsakes,
      result.traitKey,
      effect.qualifyingEncounterUses,
      acquisitionIdentity,
    ),
    traitEvaluations: Object.freeze([...(branch.traitEvaluations ?? []), evaluation]),
  });
}

export function rewardFinding(
  code: RewardGenerationFindingCode,
  origin: SemanticFinding['origin'],
  evidence: FindingEvidence,
): SemanticFinding {
  return Object.freeze({
    code,
    severity: 'error',
    phase: 'rewardGeneration',
    origin,
    evidence: Object.freeze(evidence),
  });
}

function findingKey(value: SemanticFinding): string {
  return findingIdentityKey(value);
}

export function addRewardFinding(
  findings: Map<string, FindingRegionEntry>,
  value: SemanticFinding,
  atomicRegion = ownerRegion(value.origin),
  chronology?: FindingChronology,
  levelResolutionEvaluation?: ReachedLevelResolutionEvaluation,
): void {
  const key = findingKey(value);
  const existing = findings.get(key);
  const region = findingRegion(value, atomicRegion, chronology, 'reward');
  const evaluations = [
    ...(existing?.levelResolutionEvaluations ?? []),
    ...(levelResolutionEvaluation === undefined ? [] : [levelResolutionEvaluation]),
  ].filter(
    (evaluation, index, all) =>
      all.findIndex(
        (candidate) =>
          semanticAddressKey(candidate.address) === semanticAddressKey(evaluation.address) &&
          JSON.stringify([
            candidate.before,
            candidate.value,
            candidate.effectKind,
            candidate.levelCount,
          ]) ===
            JSON.stringify([
              evaluation.before,
              evaluation.value,
              evaluation.effectKind,
              evaluation.levelCount,
            ]),
      ) === index,
  );
  findings.set(
    key,
    evaluations.length === 0
      ? region
      : Object.freeze({ ...region, levelResolutionEvaluations: Object.freeze(evaluations) }),
  );
}

function historyChronology(sequence: number): FindingChronology {
  return Object.freeze({ kind: 'history', sequence, boundary: 'at' });
}

export function offerEvidence(offer: CanonicalResolvedIncomingReward['offer']): FindingEvidence {
  const payload = offer.payload;
  return {
    rewardType: offer.rewardType,
    ...(payload?.kind === 'BoonSource' ? { source: payload.source } : {}),
    ...(payload?.kind === 'DevotionPair'
      ? { chosenSource: payload.chosenSource, spurnedSource: payload.spurnedSource }
      : {}),
  };
}

function semanticAddressEvidence(origin: SemanticAddress): FindingEvidence {
  return Object.freeze({ ...origin }) as FindingEvidence;
}

function resolvedOfferEvidence(offer: CanonicalResolvedIncomingReward['offer']): FindingEvidence {
  return Object.freeze({
    rewardType: offer.rewardType,
    ...(offer.payload === undefined
      ? {}
      : { payload: Object.freeze({ ...offer.payload }) as FindingEvidence }),
  });
}

function sourceConflictingPeers(
  offer: CanonicalResolvedIncomingReward['offer'],
  peers: readonly OfferProcessingPeer[],
): readonly OfferProcessingPeer[] {
  const source = offer.payload?.kind === 'BoonSource' ? offer.payload.source : undefined;
  const conflicts = peers.filter(
    (peer) =>
      source !== undefined &&
      peer.offer.payload?.kind === 'BoonSource' &&
      peer.offer.payload.source === source,
  );
  return conflicts.length === 0 ? peers : conflicts;
}

export function countedBinding(
  declaration: RoomDeclaration,
  incoming: CanonicalResolvedIncomingReward,
): CountedRewardBinding | undefined {
  if (incoming.producerKind === 'freeReward') {
    const policy = declaration.prebossBatchPolicy;
    const remaining = policy?.kind === 'takeOverNormalDoors' ? policy.remainingOffers : undefined;
    return remaining?.kind === 'counted' ? remaining.reward : undefined;
  }
  return declaration.incomingReward.kind === 'countedChoice'
    ? declaration.incomingReward
    : undefined;
}

function withBag(
  catalog: Catalog,
  branch: RewardBranchState,
  storeKey: string,
): { readonly branch: RewardBranchState; readonly bag: RewardBagState } | undefined {
  const store = catalog.rewards.stores.byKey[storeKey];
  if (store === undefined) {
    return undefined;
  }
  const current = branch.bags[storeKey];
  if (current !== undefined) {
    return { branch, bag: current };
  }
  const bag = createRewardBagState(store);
  return {
    branch: Object.freeze({ ...branch, bags: freezeRecord({ ...branch.bags, [storeKey]: bag }) }),
    bag,
  };
}

export interface OfferProcessingContext {
  readonly catalog: Catalog;
  readonly reward: {
    readonly origin: SemanticAddress;
    readonly offer: CanonicalResolvedIncomingReward['offer'];
    readonly producerLifecycleKey: string;
    readonly resolvedStoreKey?: string;
  };
  readonly binding?: CountedRewardBinding;
  readonly historySequence: number;
  /** Exact producer checkpoint used for first-blocking ordering. */
  readonly findingChronology?: FindingChronology;
  readonly peers: readonly OfferProcessingPeer[];
  readonly facts: RewardFactsFactory;
}

export interface OfferProcessingPeer {
  readonly origin: SemanticAddress;
  readonly offer: CanonicalResolvedIncomingReward['offer'];
}

function permutations<T>(values: readonly T[]): readonly (readonly T[])[] {
  if (values.length <= 1) {
    return [values];
  }
  return values.flatMap((value, index) =>
    permutations([...values.slice(0, index), ...values.slice(index + 1)]).map((tail) => [
      value,
      ...tail,
    ]),
  );
}

interface SourceOrderingFailure {
  readonly blocked: OfferProcessingContext;
  readonly prior: readonly OfferProcessingContext[];
}

function isSourceOrderingFailure(
  value: readonly OfferProcessingContext[] | SourceOrderingFailure,
): value is SourceOrderingFailure {
  return 'blocked' in value;
}

function sourceOrdering(
  branch: RewardBranchState,
  contexts: readonly OfferProcessingContext[],
): readonly OfferProcessingContext[] | SourceOrderingFailure {
  const sourceContexts = contexts.filter((context) => {
    const type = context.catalog.rewards.rewardTypes.byKey[context.reward.offer.rewardType];
    return type?.sourceSupport !== undefined && type.sourceResolution?.kind === 'offer';
  });
  const completeMask = (1 << sourceContexts.length) - 1;
  const failedMasks = new Set<number>();
  let failure: SourceOrderingFailure = Object.freeze({
    blocked: sourceContexts[0]!,
    prior: Object.freeze([]),
  });
  const visit = (mask: number): readonly OfferProcessingContext[] | undefined => {
    if (mask === completeMask) return Object.freeze([]);
    if (failedMasks.has(mask)) return undefined;
    const prior = sourceContexts.filter((_, offset) => (mask & (1 << offset)) !== 0);
    for (const [offset, context] of sourceContexts.entries()) {
      if ((mask & (1 << offset)) !== 0) continue;
      if (
        !isOfferSupportedAtResolutionPoint(
          context.catalog.rewards,
          context.reward.offer,
          context.facts(branch.history),
          'offer',
          { priorOffers: prior.map((entry) => entry.reward.offer) },
        )
      ) {
        if (prior.length >= failure.prior.length) {
          failure = Object.freeze({ blocked: context, prior: Object.freeze(prior) });
        }
        continue;
      }
      const tail = visit(mask | (1 << offset));
      if (tail !== undefined) return Object.freeze([context, ...tail]);
    }
    failedMasks.add(mask);
    return undefined;
  };
  const orderedSources = visit(0);
  if (orderedSources === undefined) return failure;
  let sourceOffset = 0;
  return contexts.map((context) =>
    sourceContexts.includes(context) ? orderedSources[sourceOffset++]! : context,
  );
}

export function processRewardOffer(
  branches: readonly RewardBranchState[],
  context: OfferProcessingContext,
  findings: Map<string, FindingRegionEntry>,
): readonly RewardBranchState[] {
  const { catalog, reward, historySequence, findingChronology } = context;
  const rewardType = catalog.rewards.rewardTypes.byKey[reward.offer.rewardType];
  if (
    rewardType === undefined ||
    !isPayloadLocallyValid(catalog.rewards, rewardType, reward.offer.payload)
  ) {
    addRewardFinding(
      findings,
      rewardFinding('rewardPayloadInvalid', reward.origin, offerEvidence(reward.offer)),
      ownerRegion(reward.origin),
      findingChronology ?? historyChronology(historySequence),
    );
    return Object.freeze([]);
  }

  const next: RewardBranchState[] = [];
  let sawSourceFailure = false;
  let sawBagInvariantFailure = false;
  let sawSiblingFailure = false;
  const siblingConflicts = new Map<string, OfferProcessingPeer>();
  const recordSiblingConflict = (peer: OfferProcessingPeer) => {
    siblingConflicts.set(semanticAddressKey(peer.origin), peer);
  };
  for (const originalBranch of branches) {
    const facts = context.facts(originalBranch.history);
    const peers = { priorOffers: context.peers.map((peer) => peer.offer) };
    if (!isOfferSupportedAtResolutionPoint(catalog.rewards, reward.offer, facts, 'offer', peers)) {
      sawSourceFailure = true;
      if (
        context.peers.length > 0 &&
        isOfferSupportedAtResolutionPoint(catalog.rewards, reward.offer, facts, 'offer', {
          priorOffers: [],
        })
      ) {
        sawSiblingFailure = true;
        sourceConflictingPeers(reward.offer, context.peers).forEach(recordSiblingConflict);
      }
      continue;
    }

    if (context.binding === undefined) {
      const history = applyOfferProjection(
        catalog.rewards,
        originalBranch.history,
        reward.offer,
        facts,
      );
      next.push(
        appendRewardEvent(Object.freeze({ ...originalBranch, history }), historySequence, {
          kind: 'rewardOffered',
          origin: reward.origin,
          offer: reward.offer,
          ...(reward.resolvedStoreKey === undefined ? {} : { storeKey: reward.resolvedStoreKey }),
        }),
      );
      continue;
    }

    const storeKey = reward.resolvedStoreKey;
    if (storeKey === undefined || !context.binding.storeKeys.includes(storeKey)) {
      sawBagInvariantFailure = true;
      continue;
    }
    const prepared = withBag(catalog, originalBranch, storeKey);
    const store = catalog.rewards.stores.byKey[storeKey];
    if (prepared === undefined || store === undefined) {
      sawBagInvariantFailure = true;
      continue;
    }
    if (
      context.peers.some((peer) => peer.offer.rewardType === reward.offer.rewardType) &&
      store.entries.some(
        (entry) => entry.rewardType === reward.offer.rewardType && !entry.allowDuplicates,
      )
    ) {
      sawSiblingFailure = true;
      context.peers
        .filter((peer) => peer.offer.rewardType === reward.offer.rewardType)
        .forEach(recordSiblingConflict);
    }
    let transitions: readonly RewardBagState[];
    try {
      transitions = consumeCountedOffer(catalog.rewards, store, prepared.bag, reward.offer, facts, {
        ...(context.binding.eligibleRewardTypes.length === 0
          ? {}
          : { eligibleRewardTypes: new Set(context.binding.eligibleRewardTypes) }),
        ...(context.binding.ineligibleRewardTypes.length === 0
          ? {}
          : { ineligibleRewardTypes: new Set(context.binding.ineligibleRewardTypes) }),
        peers,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('one-refill eligibility invariant')) {
        sawBagInvariantFailure = true;
        continue;
      }
      throw error;
    }
    for (const bag of transitions) {
      const history = applyOfferProjection(
        catalog.rewards,
        prepared.branch.history,
        reward.offer,
        facts,
      );
      next.push(
        appendRewardEvent(
          Object.freeze({
            ...prepared.branch,
            bags: freezeRecord({ ...prepared.branch.bags, [storeKey]: bag }),
            history,
          }),
          historySequence,
          { kind: 'rewardOffered', origin: reward.origin, offer: reward.offer, storeKey },
        ),
      );
    }
  }

  if (next.length === 0) {
    const code: RewardGenerationFindingCode = sawSourceFailure
      ? 'rewardSourceUnavailable'
      : sawBagInvariantFailure
        ? 'rewardBagSupportEmpty'
        : 'rewardBagEntryUnavailable';
    addRewardFinding(
      findings,
      rewardFinding(code, reward.origin, {
        ...offerEvidence(reward.offer),
        storeKey: reward.resolvedStoreKey ?? null,
        ...(sawSiblingFailure
          ? {
              priorOffers: [...siblingConflicts.values()].map((peer) => ({
                origin: semanticAddressEvidence(peer.origin),
                offer: resolvedOfferEvidence(peer.offer),
              })),
            }
          : {}),
      }),
      ownerRegion(reward.origin),
      findingChronology ?? historyChronology(historySequence),
    );
  }
  return Object.freeze(next);
}

function recordCanonicalOffer(
  branch: RewardBranchState,
  context: OfferProcessingContext,
): RewardBranchState {
  const facts = context.facts(branch.history);
  const history = applyOfferProjection(
    context.catalog.rewards,
    branch.history,
    context.reward.offer,
    facts,
  );
  return appendRewardEvent(Object.freeze({ ...branch, history }), context.historySequence, {
    kind: 'rewardOffered',
    origin: context.reward.origin,
    offer: context.reward.offer,
    ...(context.reward.resolvedStoreKey === undefined
      ? {}
      : { storeKey: context.reward.resolvedStoreKey }),
  });
}

export function processOfferGenerationCohort(
  branches: readonly RewardBranchState[],
  contexts: readonly OfferProcessingContext[],
  findings: Map<string, FindingRegionEntry>,
  policy: {
    readonly ordering: 'allOffers' | 'sourceOffers';
    readonly atomicRegion?: string;
  },
): readonly RewardBranchState[] {
  if (contexts.length <= 1) {
    const context = contexts[0];
    return context === undefined ? branches : processRewardOffer(branches, context, findings);
  }
  const supported: RewardBranchState[] = [];
  let representativeFailures: readonly FindingRegionEntry[] = Object.freeze([]);
  for (const branch of branches) {
    const sourceResult =
      policy.ordering === 'sourceOffers' ? sourceOrdering(branch, contexts) : undefined;
    if (sourceResult !== undefined && isSourceOrderingFailure(sourceResult)) {
      const localFindings = new Map<string, FindingRegionEntry>();
      processRewardOffer(
        Object.freeze([branch]),
        {
          ...sourceResult.blocked,
          peers: Object.freeze(
            sourceResult.prior.map((context) => ({
              origin: context.reward.origin,
              offer: context.reward.offer,
            })),
          ),
        },
        localFindings,
      );
      if (representativeFailures.length === 0) {
        representativeFailures = Object.freeze([...localFindings.values()]);
      }
      continue;
    }
    const orderings =
      policy.ordering === 'allOffers'
        ? permutations(contexts)
        : Object.freeze([sourceResult ?? contexts]);
    for (const ordering of orderings) {
      let candidates: readonly RewardBranchState[] = Object.freeze([branch]);
      const localFindings = new Map<string, FindingRegionEntry>();
      const priorOffers: OfferProcessingPeer[] = [];
      for (const context of ordering) {
        candidates = processRewardOffer(
          candidates,
          { ...context, peers: Object.freeze([...priorOffers]) },
          localFindings,
        );
        if (candidates.length === 0) {
          break;
        }
        priorOffers.push({ origin: context.reward.origin, offer: context.reward.offer });
      }
      if (candidates.length === 0) {
        if (representativeFailures.length === 0) {
          representativeFailures = Object.freeze([...localFindings.values()]);
        }
        continue;
      }
      for (const candidate of candidates) {
        let canonical: RewardBranchState = Object.freeze({
          // Offer-order permutations may only contribute the candidate bag
          // state. The rest of the branch has already progressed through the
          // same history, traits, keepsakes, and evaluations; carrying the
          // whole candidate would replay that permutation-local evolution a
          // second time when canonical offers are recorded below.
          ...branch,
          bags: candidate.bags,
        });
        for (const context of contexts) {
          canonical = recordCanonicalOffer(canonical, context);
        }
        supported.push(canonical);
      }
    }
  }
  if (supported.length === 0) {
    for (const value of representativeFailures) {
      addRewardFinding(
        findings,
        value.finding,
        policy.atomicRegion ?? value.atomicRegion,
        value.chronology,
      );
    }
  }
  return mergeEquivalentRewardBranches(supported);
}

function shopRequirements(
  declaration: RoomDeclaration,
  profileKey: string,
  fail: (detail: string) => never,
) {
  const binding = declaration.incomingReward;
  if (binding.kind !== 'shop' || binding.shopProfileKey !== profileKey) {
    return fail(`${declaration.gameName} has no ${profileKey} shop binding`);
  }
  return binding.additionalOptionRequirements ?? Object.freeze({});
}

interface ShopProcessingContext {
  readonly catalog: Catalog;
  readonly room: CanonicalAuthoredRoom;
  readonly declaration: RoomDeclaration;
  readonly historySequence: number;
  readonly findingChronology?: FindingChronology;
  readonly facts: RewardFactsFactory;
  readonly fail: (detail: string) => never;
}

export function processShopInventory(
  branches: readonly RewardBranchState[],
  context: ShopProcessingContext,
  findings: Map<string, FindingRegionEntry>,
): readonly RewardBranchState[] {
  const { catalog, room, declaration, historySequence, fail } = context;
  const entry = room.entryState;
  if (entry?.kind !== 'shop') {
    return fail(`${room.gameName} materialized a missing shop state`);
  }
  const profile = catalog.rewards.shops.byKey[entry.profileKey];
  if (profile === undefined) {
    return fail(`unknown shop profile ${entry.profileKey}`);
  }
  const requirements = shopRequirements(declaration, entry.profileKey, fail);
  const authored: readonly AuthoredShopOffer[] = entry.offers.map((offer) => ({
    offer: offer.offer,
  }));
  const next: RewardBranchState[] = [];
  const supportResults: ShopGenerationSupport[] = [];
  for (const branch of branches) {
    const support = evaluateShopGenerationSupport(
      catalog.rewards,
      profile,
      authored,
      context.facts(branch.history, new Set()),
      requirements,
    );
    supportResults.push(support);
    for (const witness of support.witnesses) {
      let candidate = branch;
      for (const offer of entry.offers) {
        const offerFacts = context.facts(candidate.history, new Set());
        const history = applyOfferProjection(
          catalog.rewards,
          candidate.history,
          offer.offer,
          offerFacts,
        );
        candidate = appendRewardEvent(Object.freeze({ ...candidate, history }), historySequence, {
          kind: 'rewardOffered',
          origin: offer.offerOrigin,
          offer: offer.offer,
        });
      }
      candidate = appendRewardEvent(candidate, historySequence, {
        kind: 'shopInventorySupported',
        origin: room.origin,
        profileKey: profile.key,
        optionKeys: witness.optionKeys,
      });
      next.push(
        Object.freeze({
          ...candidate,
          pendingShops: freezeRecord({
            ...candidate.pendingShops,
            [semanticAddressKey(room.origin)]: Object.freeze({
              profileKey: profile.key,
              witness,
            }),
          }),
        }),
      );
    }
  }
  if (next.length === 0) {
    const unsupportedIndexes = entry.offers.flatMap((_, index) =>
      supportResults.every((support) => support.unsupportedSlotIndexes.includes(index))
        ? [index]
        : [],
    );
    for (const index of unsupportedIndexes) {
      const offer = entry.offers[index]!;
      const rewardType = catalog.rewards.rewardTypes.byKey[offer.offer.rewardType];
      const code: RewardGenerationFindingCode =
        rewardType === undefined ||
        !isPayloadLocallyValid(catalog.rewards, rewardType, offer.offer.payload)
          ? 'rewardPayloadInvalid'
          : 'shopOfferUnavailable';
      addRewardFinding(
        findings,
        rewardFinding(code, offer.offerOrigin, offerEvidence(offer.offer)),
        ownerRegion(room.origin),
        context.findingChronology ?? historyChronology(historySequence),
      );
    }
    if (unsupportedIndexes.length === 0) {
      addRewardFinding(
        findings,
        rewardFinding('shopOfferUnavailable', room.origin, {
          offerKeys: entry.offers.map((offer) => offer.offerKey),
          kind: 'jointOfferSet',
        }),
        ownerRegion(room.origin),
        context.findingChronology ?? historyChronology(historySequence),
      );
    }
  }
  return Object.freeze(next);
}

/** Settles optional Shop offer entries at the exact post-outgoing roomExit site. */
export function settleShopAcquisitionSite(
  branches: readonly RewardBranchState[],
  context: ShopProcessingContext,
  findings: Map<string, FindingRegionEntry>,
): AcquisitionSettlementProduct {
  const { catalog, room, declaration, historySequence, fail } = context;
  const entry = room.entryState;
  if (entry?.kind !== 'shop') {
    return fail(`${room.gameName} applied missing shop purchases`);
  }
  const profile = catalog.rewards.shops.byKey[entry.profileKey];
  if (profile === undefined) {
    return fail(`unknown shop profile ${entry.profileKey}`);
  }
  const requirements = shopRequirements(declaration, entry.profileKey, fail);
  const authored: readonly AuthoredShopOffer[] = entry.offers.map((offer) => ({
    offer: offer.offer,
  }));
  const order = entry.order.map((offerKey) => {
    const index = entry.offers.findIndex((offer) => offer.offerKey === offerKey);
    if (index < 0) return fail(`${room.gameName} acquisition order has unknown entry ${offerKey}`);
    return index;
  });
  if (new Set(order).size !== order.length) {
    return fail(`${room.gameName} acquisition order contains a duplicate entry`);
  }
  const next: RewardBranchState[] = [];
  const failures: ShopPurchaseFailure[] = [];
  const site = createAcquisitionSiteAddress(room.origin, 'roomExit');
  const roleFrontiers: AcquisitionRoleFrontier[] = [];
  const rolesByOfferKey = new Map<
    string,
    readonly { readonly role: string; readonly lifecyclePoint: ProducerLifecyclePointKey }[]
  >();
  const recordRoles = (
    offerKey: string,
    roles: readonly { readonly role: string; readonly lifecyclePoint: ProducerLifecyclePointKey }[],
  ) => {
    const existing = rolesByOfferKey.get(offerKey) ?? [];
    const seen = new Set(existing.map((role) => `${role.role}:${role.lifecyclePoint}`));
    rolesByOfferKey.set(
      offerKey,
      Object.freeze([
        ...existing,
        ...roles.filter((role) => {
          const key = `${role.role}:${role.lifecyclePoint}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }),
      ]),
    );
  };
  for (const branch of branches) {
    const pending = branch.pendingShops[semanticAddressKey(room.origin)];
    if (pending?.profileKey !== profile.key) {
      return fail(`${room.gameName} lost its shop witness`);
    }
    // The exact selected Shop option owns the entry's role shape even if a
    // proposed authored offer is presently unsupported and no branch survives.
    for (const offerKey of entry.order) {
      const slotIndex = entry.offers.findIndex((offer) => offer.offerKey === offerKey);
      const slot = slotIndex < 0 ? undefined : profile.slots.values[slotIndex];
      const group = slot === undefined ? undefined : profile.groups.byKey[slot.groupKey];
      const optionKey = slotIndex < 0 ? undefined : pending.witness.optionKeys[slotIndex];
      const option = optionKey === undefined ? undefined : group?.options.byKey[optionKey];
      if (option !== undefined) {
        recordRoles(
          offerKey,
          option.acquisitionLifecycle.map((binding) =>
            Object.freeze({
              role: binding.role,
              lifecyclePoint: binding.lifecyclePoint,
            }),
          ),
        );
      }
    }
    const simulation = evaluateShopPurchases(
      catalog.rewards,
      profile,
      authored,
      pending.witness,
      order,
      branch.history,
      context.facts(branch.history, new Set()),
      requirements,
    );
    failures.push(...simulation.failures);
    for (const result of simulation.results) {
      let candidate: RewardBranchState = Object.freeze({ ...branch, history: result.history });
      for (const acquisition of result.acquisitions) {
        const offer = entry.offers[acquisition.slotIndex];
        if (offer === undefined) {
          return fail('shop acquisition has no semantic slot');
        }
        recordRoles(offer.offerKey, [
          Object.freeze({
            role: acquisition.event.role,
            lifecyclePoint: acquisition.event.lifecyclePoint,
          }),
        ]);
        const source: AcquisitionSource = Object.freeze({
          origin: offer.offerOrigin,
          offer: offer.offer,
          producerLifecycleKey: profile.key,
          producerKind: 'shop',
          instanceProvenance: 'paid',
          ...(offer.traitOffersByAcquisitionRole === undefined
            ? {}
            : { traitOffersByAcquisitionRole: offer.traitOffersByAcquisitionRole }),
          ...(offer.levelResolutionsByAcquisitionRole === undefined
            ? {}
            : { levelResolutionsByAcquisitionRole: offer.levelResolutionsByAcquisitionRole }),
          ...(offer.conversionByAcquisitionRole === undefined
            ? {}
            : { conversionByAcquisitionRole: offer.conversionByAcquisitionRole }),
          ...(offer.traitContext === undefined ? {} : { traitContext: offer.traitContext }),
        });
        const settlement = Object.freeze({
          site,
          entry: createAcquisitionEntryAddress(site, offer.offerKey),
        });
        const address = createAcquisitionRoleAddress(offer.offerOrigin, acquisition.event.role);
        roleFrontiers.push(
          Object.freeze({
            address,
            branchesBeforeRole: Object.freeze([candidate]),
            source,
            lifecyclePoint: acquisition.event.lifecyclePoint,
            historySequence,
            settlement,
          }),
        );
        if (offer.conversionByAcquisitionRole?.[acquisition.event.role] === 'gold') {
          const conversion = assessTimePieceConversion(
            catalog,
            candidate,
            source,
            acquisition.event.role,
            acquisition.event.lifecyclePoint,
          );
          addRewardFinding(
            findings,
            rewardFinding('timePieceConversionUnavailable', address, conversion.evidence),
            ownerRegion(room.origin),
            context.findingChronology ?? historyChronology(historySequence),
          );
        }
        candidate = applyTraitOfferForAcquisition(
          catalog,
          candidate,
          source,
          acquisition.event.role,
          acquisition.event.lifecyclePoint,
          historySequence,
          findings,
        );
        candidate = appendRewardEvent(candidate, historySequence, {
          kind: 'concreteAcquisition',
          origin: offer.offerOrigin,
          acquisition: acquisition.event,
          settlement: Object.freeze({
            site: createAcquisitionSiteAddress(room.origin, 'roomExit'),
            entry: createAcquisitionEntryAddress(
              createAcquisitionSiteAddress(room.origin, 'roomExit'),
              offer.offerKey,
            ),
          }),
        });
      }
      const { [semanticAddressKey(room.origin)]: completed, ...remainingShops } =
        candidate.pendingShops;
      void completed;
      next.push(Object.freeze({ ...candidate, pendingShops: freezeRecord(remainingShops) }));
    }
  }
  if (next.length === 0) {
    const failedIndexes = order.filter(
      (index) =>
        failures.length > 0 && failures.every((failure) => failure.failedSlotIndex === index),
    );
    for (const index of failedIndexes) {
      const offer = entry.offers[index]!;
      addRewardFinding(
        findings,
        rewardFinding(
          'shopPurchaseUnavailable',
          createAcquisitionEntryAddress(site, offer.offerKey),
          offerEvidence(offer.offer),
        ),
        ownerRegion(room.origin),
        context.findingChronology ?? historyChronology(historySequence),
      );
    }
    if (failedIndexes.length === 0) {
      addRewardFinding(
        findings,
        rewardFinding('shopPurchaseUnavailable', site, {
          kind: 'jointPurchaseOrder',
          offerKeys: entry.order,
        }),
        ownerRegion(room.origin),
        context.findingChronology ?? historyChronology(historySequence),
      );
    }
  }
  return Object.freeze({
    site,
    entries: Object.freeze(
      entry.order.map((offerKey) => {
        const offer = entry.offers.find((candidate) => candidate.offerKey === offerKey);
        if (offer === undefined)
          return fail(`${room.gameName} acquisition order has unknown entry ${offerKey}`);
        const acquisitionRoles = rolesByOfferKey.get(offer.offerKey) ?? [];
        return Object.freeze({
          address: createAcquisitionEntryAddress(site, offer.offerKey),
          source: offer.offerOrigin,
          acquisitionRoles,
          participation: 'optional' as const,
        });
      }),
    ),
    branches: mergeEquivalentRewardBranches(next),
    roleFrontiers: Object.freeze(roleFrontiers),
  });
}

export function settleProducerAcquisitionSite(
  catalog: Catalog,
  branches: readonly RewardBranchState[],
  room: CanonicalRewardRoom,
  event: Extract<HistoryEvent, { readonly kind: 'producerRoleAdvanced' }>,
  facts: RewardFactsFactory,
  findings: Map<string, FindingRegionEntry>,
  fail: (detail: string) => never,
  atomicRegion?: string,
  findingChronology?: FindingChronology,
  siteOwner?: AcquisitionSiteOwnerAddress,
): AcquisitionSettlementProduct {
  const incoming = room.incomingReward;
  if (
    incoming === undefined ||
    incoming.offer.rewardType !== event.rewardType ||
    incoming.producerLifecycleKey !== event.producerLifecycleKey
  ) {
    return fail(`${room.gameName} producer event does not match its offer`);
  }
  if (event.origin.kind === 'hubRoom') {
    return fail('Hub room cannot own an ordinary producer acquisition site');
  }
  const site = createAcquisitionSiteAddress(siteOwner ?? event.origin, event.lifecyclePoint);
  const roleFrontiers: AcquisitionRoleFrontier[] = [];
  const entry = Object.freeze({
    address: createAcquisitionEntryAddress(site, event.role),
    source: incoming.origin,
    acquisitionRoles: Object.freeze([
      Object.freeze({ role: event.role, lifecyclePoint: event.lifecyclePoint }),
    ]),
    participation: 'mandatory' as const,
  });
  // Forfeit is deliberately decided by the enclosing ordinary Room Occurrence,
  // before this shared role fold turns the room's authored Boon/Hermes reward
  // into a concrete acquisition. Local children, Shops, pickups, and all
  // other owners never enter this branch.
  const qualifyingRewardType =
    incoming.offer.rewardType === 'Boon' || incoming.offer.rewardType === 'HermesUpgrade'
      ? incoming.offer.rewardType
      : undefined;
  if (room.kind === 'authored' && qualifyingRewardType !== undefined) {
    const vetoed: RewardBranchState[] = [];
    const remaining: RewardBranchState[] = [];
    for (const branch of branches) {
      const supported = isOfferSupportedAtResolutionPoint(
        catalog.rewards,
        incoming.offer,
        facts(branch.history),
        { acquisitionRole: event.role },
      );
      if (!supported) {
        remaining.push(branch);
        continue;
      }
      const forfeit = consumeOrdinaryRoomForfeit(catalog, branch.arcanaFear, qualifyingRewardType, {
        owner: incoming.origin,
        sequence: event.sequence,
      });
      if (!forfeit.consumed) {
        remaining.push(branch);
        continue;
      }
      vetoed.push(
        advanceRewardBranch(
          Object.freeze({
            ...branch,
            arcanaFear: forfeit.state,
          }),
          event.sequence,
        ),
      );
    }
    if (vetoed.length > 0) {
      const settled =
        remaining.length === 0
          ? Object.freeze([])
          : applyProducerRoleHistory(
              catalog,
              Object.freeze(remaining),
              incoming,
              {
                role: event.role,
                lifecyclePoint: event.lifecyclePoint,
                historySequence: event.sequence,
              },
              facts,
              findings,
              atomicRegion,
              findingChronology,
              Object.freeze({ site, entry: entry.address }),
              roleFrontiers,
            );
      return Object.freeze({
        site,
        entries: Object.freeze([entry]),
        branches: mergeEquivalentRewardBranches(Object.freeze([...vetoed, ...settled])),
        ...(roleFrontiers.length === 0 ? {} : { roleFrontiers: Object.freeze(roleFrontiers) }),
      });
    }
  }
  const settled = applyProducerRoleHistory(
    catalog,
    branches,
    incoming,
    { role: event.role, lifecyclePoint: event.lifecyclePoint, historySequence: event.sequence },
    facts,
    findings,
    atomicRegion,
    findingChronology,
    Object.freeze({ site, entry: entry.address }),
    roleFrontiers,
  );
  return Object.freeze({
    site,
    entries: Object.freeze([entry]),
    branches: settled,
    roleFrontiers: Object.freeze(roleFrontiers),
  });
}

/** Settles one exact composite-owned acquisition entry at its structural site. */
export function settleOwnedAcquisitionSite(
  catalog: Catalog,
  branches: readonly RewardBranchState[],
  request: OwnedAcquisitionSettlementRequest,
  facts: RewardFactsFactory,
  findings: Map<string, FindingRegionEntry>,
  atomicRegion?: string,
  findingChronology?: FindingChronology,
): AcquisitionSettlementProduct {
  const site = createAcquisitionSiteAddress(request.siteOwner, request.pointKey);
  const producer = catalog.rewards.producerLifecycles.byKey[request.source.producerLifecycleKey];
  const lifecycle = producer?.rewardTypes.byKey[request.source.offer.rewardType];
  if (lifecycle === undefined) {
    throw new Error(
      `${request.source.producerLifecycleKey} does not support ${request.source.offer.rewardType}`,
    );
  }
  const roleBindings: readonly AcquisitionRoleResolution[] = Object.freeze(
    lifecycle.acquisitionLifecycle.map((binding) =>
      Object.freeze({ ...binding, historySequence: request.historySequence }),
    ),
  );
  if (roleBindings.length === 0)
    throw new Error('owned acquisition settlement has no lifecycle roles');
  const entry = Object.freeze({
    address: createAcquisitionEntryAddress(site, request.entryKey),
    source: request.source.origin,
    acquisitionRoles: Object.freeze(
      roleBindings.map((binding) =>
        Object.freeze({ role: binding.role, lifecyclePoint: binding.lifecyclePoint }),
      ),
    ),
    participation: 'mandatory' as const,
  });
  const roleFrontiers: AcquisitionRoleFrontier[] = [];
  return Object.freeze({
    site,
    entries: Object.freeze([entry]),
    branches: roleBindings.reduce(
      (current, binding) =>
        applyProducerRoleHistory(
          catalog,
          current,
          request.source,
          binding,
          facts,
          findings,
          atomicRegion,
          findingChronology,
          Object.freeze({ site, entry: entry.address }),
          roleFrontiers,
        ),
      branches,
    ),
    roleFrontiers: Object.freeze(roleFrontiers),
  });
}

/** Settles optional site-materialized pickups through the same role fold used
 * by every other acquisition. The producer only supplies entries; it never
 * gets a private outcome processor. */
export function settlePickupAcquisitionSite(
  catalog: Catalog,
  branches: readonly RewardBranchState[],
  request: {
    readonly siteOwner: AcquisitionSiteOwnerAddress;
    readonly entries: Readonly<Record<string, AuthoredRewardState>>;
    readonly order: readonly string[];
    readonly producerLifecycleKey: string;
    readonly historySequence: number;
    readonly facts: RewardFactsFactory;
    readonly findingChronology?: FindingChronology;
  },
  findings: Map<string, FindingRegionEntry>,
): AcquisitionSettlementProduct {
  const site = createAcquisitionSiteAddress(request.siteOwner, 'roomExit');
  const definitions = new Map<
    string,
    {
      readonly reward: AuthoredRewardState;
      readonly roles: readonly AcquisitionSettlementRole[];
      readonly address: AcquisitionEntryAddress;
    }
  >();
  const entries: AcquisitionSettlementEntry[] = Object.keys(request.entries).map((key) => {
    const reward = request.entries[key]!;
    const entry = createAcquisitionEntryAddress(site, key);
    const lifecycle =
      catalog.rewards.producerLifecycles.byKey[request.producerLifecycleKey]?.rewardTypes.byKey[
        reward.offer.rewardType
      ];
    if (lifecycle === undefined)
      throw new Error(`pickup ${reward.offer.rewardType} has no declared lifecycle`);
    const roles = Object.freeze(
      lifecycle.acquisitionLifecycle.map((binding) =>
        Object.freeze({ role: binding.role, lifecyclePoint: binding.lifecyclePoint }),
      ),
    );
    definitions.set(key, Object.freeze({ reward, roles, address: entry }));
    return Object.freeze({
      address: entry,
      source: entry,
      acquisitionRoles: roles,
      participation: request.order.includes(key) ? 'optional' : 'dormant',
    });
  });
  if (new Set(request.order).size !== request.order.length)
    throw new Error('pickup acquisition order contains a duplicate entry');
  let current = branches;
  const pickupEntryFrontiers: PickupAcquisitionEntryFrontier[] = [];
  const roleFrontiers: AcquisitionRoleFrontier[] = [];
  for (const key of request.order) {
    const definition = definitions.get(key);
    if (definition === undefined)
      throw new Error(`pickup acquisition order has unknown entry ${key}`);
    const { reward, address: entry } = definition;
    pickupEntryFrontiers.push(
      Object.freeze({ address: entry, reward, branchesBeforeEntry: current }),
    );
    const lifecycle =
      catalog.rewards.producerLifecycles.byKey[request.producerLifecycleKey]!.rewardTypes.byKey[
        reward.offer.rewardType
      ]!;
    for (const binding of lifecycle.acquisitionLifecycle) {
      current = applyProducerRoleHistory(
        catalog,
        current,
        Object.freeze({
          origin: entry,
          offer: reward.offer,
          producerLifecycleKey: request.producerLifecycleKey,
          instanceProvenance: 'free',
          traitOffersByAcquisitionRole: reward.traitOffersByAcquisitionRole,
          ...(reward.levelResolutionsByAcquisitionRole === undefined
            ? {}
            : { levelResolutionsByAcquisitionRole: reward.levelResolutionsByAcquisitionRole }),
          traitContext: Object.freeze({}),
          conversionByAcquisitionRole: reward.conversionByAcquisitionRole,
        }),
        Object.freeze({ ...binding, historySequence: request.historySequence }),
        request.facts,
        findings,
        undefined,
        request.findingChronology,
        Object.freeze({ site, entry }),
        roleFrontiers,
      );
    }
  }
  return Object.freeze({
    site,
    entries: Object.freeze(entries),
    branches: current,
    pickupEntryFrontiers: Object.freeze(pickupEntryFrontiers),
    roleFrontiers: Object.freeze(roleFrontiers),
  });
}

function applyProducerRoleHistory(
  catalog: Catalog,
  branches: readonly RewardBranchState[],
  incoming: AcquisitionSource,
  resolution: AcquisitionRoleResolution,
  facts: RewardFactsFactory,
  findings: Map<string, FindingRegionEntry>,
  atomicRegion: string | undefined,
  findingChronology: FindingChronology | undefined,
  settlement: { readonly site: AcquisitionSiteAddress; readonly entry: AcquisitionEntryAddress },
  roleFrontiers?: AcquisitionRoleFrontier[],
): readonly RewardBranchState[] {
  roleFrontiers?.push(
    Object.freeze({
      address: createAcquisitionRoleAddress(incoming.origin, resolution.role),
      branchesBeforeRole: branches,
      source: incoming,
      lifecyclePoint: resolution.lifecyclePoint,
      historySequence: resolution.historySequence,
      settlement,
    }),
  );
  const next: RewardBranchState[] = [];
  for (const branch of branches) {
    const branchFacts = facts(branch.history);
    if (
      !isOfferSupportedAtResolutionPoint(catalog.rewards, incoming.offer, branchFacts, {
        acquisitionRole: resolution.role,
      })
    ) {
      continue;
    }
    const acquisition = resolveAcquisitionRole(
      catalog.rewards,
      incoming.offer,
      resolution.role,
      resolution.lifecyclePoint,
    );
    // Time Piece is assessed at the exact concrete role, after offer/bag
    // evidence exists but before any acquisition, trait, Pom, level, or
    // element effects can be folded. Shop purchases take their separate paid
    // settlement path and consequently never enter this free producer path.
    const convertsToGold = incoming.conversionByAcquisitionRole?.[resolution.role] === 'gold';
    const conversion = assessTimePieceConversion(
      catalog,
      branch,
      incoming,
      resolution.role,
      resolution.lifecyclePoint,
    );
    if (convertsToGold && conversion.supported) {
      next.push(
        appendRewardEvent(
          Object.freeze({ ...branch, keepsakes: consumeTimePieceCharge(branch.keepsakes) }),
          resolution.historySequence,
          {
            kind: 'conversionToGold',
            origin: incoming.origin,
            acquisition,
            settlement,
          },
        ),
      );
      continue;
    }
    if (convertsToGold) {
      addRewardFinding(
        findings,
        rewardFinding(
          'timePieceConversionUnavailable',
          createAcquisitionRoleAddress(incoming.origin, resolution.role),
          {
            ...conversion.evidence,
          },
        ),
        atomicRegion,
        findingChronology ?? historyChronology(resolution.historySequence),
      );
    }
    let history = applyConcreteAcquisition(
      catalog.rewards,
      branch.history,
      acquisition.acquisition,
    );
    const contributions =
      catalog.rewards.acquisitions.byKey[acquisition.acquisition.gameName]?.elementContributions;
    let acquisitionBranch: RewardBranchState = Object.freeze({ ...branch, history });
    if (contributions !== undefined) {
      const priorTraits = branch.traitHistory ?? createTraitHistoryState();
      const traitHistory = foldTraitHistoryEvents(
        catalog,
        Object.freeze([
          ...priorTraits.events,
          Object.freeze({
            kind: 'elementContribution' as const,
            owner: incoming.origin,
            acquisitionRole: resolution.role,
            sequence: resolution.historySequence,
            acquisitionPoint: resolution.lifecyclePoint,
            contributions,
          }),
        ]),
      );
      history = attachTraitHistory(history, traitHistory);
      acquisitionBranch = Object.freeze({ ...acquisitionBranch, history, traitHistory });
    }
    const withTrait = applyTraitOfferForAcquisition(
      catalog,
      acquisitionBranch,
      incoming,
      resolution.role,
      resolution.lifecyclePoint,
      resolution.historySequence,
      findings,
      findingChronology,
    );
    next.push(
      appendRewardEvent(withTrait, resolution.historySequence, {
        kind: 'concreteAcquisition',
        origin: incoming.origin,
        acquisition,
        settlement,
      }),
    );
  }
  if (next.length === 0) {
    addRewardFinding(
      findings,
      rewardFinding('rewardAcquisitionUnavailable', incoming.origin, {
        ...offerEvidence(incoming.offer),
        role: resolution.role,
        lifecyclePoint: resolution.lifecyclePoint,
      }),
      atomicRegion,
      findingChronology ?? historyChronology(resolution.historySequence),
    );
  }
  return Object.freeze(next);
}

export function publicRewardBranch(branch: RewardBranchState): RewardBranch {
  return Object.freeze({
    bags: branch.bags,
    history: branch.history,
    events: branch.events,
    processedThroughHistorySequence: branch.processedThroughHistorySequence,
    ...(branch.traitHistory === undefined ? {} : { traitHistory: branch.traitHistory }),
    arcanaFear: branch.arcanaFear,
    keepsakes: branch.keepsakes,
  });
}
