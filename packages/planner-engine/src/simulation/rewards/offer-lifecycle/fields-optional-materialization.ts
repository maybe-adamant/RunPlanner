import type { Catalog, RoomDeclaration } from '../../../catalog-schema';
import { semanticAddressKey, type SemanticAddress } from '../../../authored-project/addresses';
import type { RouteLoadout } from '../../../authored-project/model';
import { createUnresolvedAcquisitionRewardState } from '../../../authored-project/traits';
import {
  locallyValidRewardOffers,
  type ResolvedRewardOffer,
  type RewardHistoryState,
} from '../../../reward-kernel';
import type { HistoryEvent, ProgressiveRoomHistoryViews } from '../../history';
import type { CanonicalAuthoredRoom, CanonicalFieldsOptionalReward } from '../../materialization';
import { ownerRegion, type FindingRegionEntry } from '../../finding-regions';
import { settleOwnedAcquisitionSite } from '../acquisition-settlement';
import type { RewardBranchState } from '../branch-primitives';
import { BiomeRewardSimulationContractError } from '../biome-contract';
import type { BiomeRewardSnapshot } from '../evaluation-contract';
import { createBiomeRewardFacts } from '../facts';
import { historyFindingChronology, rewardFindingChronologyForRoom } from '../finding-chronology';
import { addRewardFinding, rewardFinding } from '../findings';
import type { RewardLifecycleReferences } from '../prepared-inputs';
import { processRewardOffer } from '../processing';
import type { RewardProducerFrontier } from '../producer-frontiers';
import { localRewardBinding } from '../room-reward-bindings';

export interface FieldsOptionalOfferPointMaterialization {
  readonly branches: readonly RewardBranchState[];
  readonly findings: readonly FindingRegionEntry[];
  readonly producerFrontiers: readonly RewardProducerFrontier[];
}

export interface FieldsOptionalOfferPointMaterializationInputs {
  readonly catalog: Catalog;
  readonly snapshot: BiomeRewardSnapshot;
  readonly event: Extract<HistoryEvent, { readonly kind: 'offerPointMaterialized' }>;
  readonly room: CanonicalAuthoredRoom;
  readonly declaration: RoomDeclaration;
  readonly roomView: ProgressiveRoomHistoryViews;
  readonly branches: readonly RewardBranchState[];
  readonly lifecycle: RewardLifecycleReferences;
  readonly enteredBiomeCount: number;
  readonly routeLoadout: RouteLoadout;
  readonly authoredSeaStarDuplicateSiteKeys: ReadonlySet<string>;
}

/**
 * Materializes the Fields optional-reward cohort at its exact offer point.
 * Chronology owns applying this complete immutable transition.
 */
export function materializeFieldsOptionalOfferPoint(
  inputs: FieldsOptionalOfferPointMaterializationInputs,
): FieldsOptionalOfferPointMaterialization {
  const {
    catalog,
    snapshot,
    event,
    room,
    declaration,
    roomView,
    lifecycle,
    enteredBiomeCount,
    routeLoadout,
  } = inputs;
  if (event.offerPoint !== 'fieldsOptionalRewards')
    throw new BiomeRewardSimulationContractError('expected Fields optional materialization');
  const view = roomView.offerPoints?.find(
    (candidate) => candidate.offerPoint === event.offerPoint,
  )?.before;
  if (view === undefined || room.lifecycleProfileKey !== 'FieldsCombatRoom') {
    throw new BiomeRewardSimulationContractError(
      `${room.gameName} has no Fields optional materialization`,
    );
  }
  const descriptor = declaration.fieldsOptionalRewards;
  if (descriptor === undefined)
    throw new BiomeRewardSimulationContractError(
      `${room.gameName} has no Fields optional descriptor`,
    );

  const optionalRewards = room.fieldsOptionalRewards ?? [];
  const unresolvedOptionals = room.unresolvedFieldsOptionalRewards ?? [];
  const concreteBySlot = new Map(optionalRewards.map((reward) => [reward.slotKey, reward]));
  const unresolvedBySlot = new Map(unresolvedOptionals.map((reward) => [reward.slotKey, reward]));
  const orderedSlots = descriptor.slotKeys.filter(
    (slotKey) => concreteBySlot.has(slotKey) || unresolvedBySlot.has(slotKey),
  );
  const findings = new Map<string, FindingRegionEntry>();
  const producerFrontiers: RewardProducerFrontier[] = [];
  const frontierBranches = inputs.branches;

  const candidateState = (
    base: (typeof unresolvedOptionals)[number],
    offer: ResolvedRewardOffer,
  ): CanonicalFieldsOptionalReward => {
    const state = createUnresolvedAcquisitionRewardState(catalog, offer, {
      kind: 'producerLifecycle',
      key: base.producerLifecycleKey,
    });
    return Object.freeze({
      ...base,
      offer,
      traitOffersByAcquisitionRole: state.traitOffersByAcquisitionRole,
      ...(state.levelResolutionsByAcquisitionRole === undefined
        ? {}
        : { levelResolutionsByAcquisitionRole: state.levelResolutionsByAcquisitionRole }),
      dispositionByAcquisitionRole: state.dispositionByAcquisitionRole,
      traitContext: Object.freeze({
        ...routeLoadout,
        blockGiftBoons: declaration.blockGiftBoons,
        devotionNoDuo: offer.rewardType === 'Devotion',
      }),
    });
  };
  const contextFor = (reward: CanonicalFieldsOptionalReward) => ({
    catalog,
    reward,
    binding: localRewardBinding(declaration, reward),
    historySequence: event.sequence,
    peers: Object.freeze([]),
    facts: (
      branchHistory: RewardHistoryState,
      _shopNames: ReadonlySet<string> | undefined,
      branch: RewardBranchState | undefined,
    ) =>
      createBiomeRewardFacts(
        catalog,
        room,
        room,
        declaration,
        view,
        branchHistory,
        enteredBiomeCount,
        undefined,
        undefined,
        undefined,
        undefined,
        branch,
      ),
  });
  const evaluateOptionalCohort = (owner: SemanticAddress, offer: ResolvedRewardOffer) => {
    const ownerKey = semanticAddressKey(owner);
    const selectedReward = [...optionalRewards, ...unresolvedOptionals].find(
      (reward) => semanticAddressKey(reward.origin) === ownerKey,
    );
    if (selectedReward === undefined)
      throw new BiomeRewardSimulationContractError(
        'Fields optional frontier received a foreign owner',
      );
    const store = catalog.rewards.stores.byKey.FieldsOptionalRewards;
    if (store === undefined)
      throw new BiomeRewardSimulationContractError('Fields optional store is missing');
    const domain = Object.freeze(
      store.entries.flatMap((entry) => locallyValidRewardOffers(catalog.rewards, entry.rewardType)),
    );
    let representativeFailedFindings: Map<string, FindingRegionEntry> | undefined;
    const visit = (
      index: number,
      current: readonly RewardBranchState[],
      currentFindings: Map<string, FindingRegionEntry>,
    ):
      | {
          readonly branches: readonly RewardBranchState[];
          readonly findings: Map<string, FindingRegionEntry>;
        }
      | undefined => {
      if (index === orderedSlots.length)
        return Object.freeze({ branches: current, findings: currentFindings });
      const slotKey = orderedSlots[index]!;
      const concrete = concreteBySlot.get(slotKey);
      const unresolved = unresolvedBySlot.get(slotKey);
      const offers =
        slotKey === selectedReward.slotKey
          ? Object.freeze([offer])
          : concrete === undefined
            ? domain
            : Object.freeze([concrete.offer]);
      for (const candidateOffer of offers) {
        const trialFindings = new Map(currentFindings);
        const reward =
          concrete !== undefined && candidateOffer === concrete.offer
            ? concrete
            : unresolved === undefined
              ? Object.freeze({ ...concrete!, offer: candidateOffer })
              : candidateState(unresolved, candidateOffer);
        const next = processRewardOffer(current, contextFor(reward), trialFindings);
        if (next.length === 0) {
          representativeFailedFindings ??= trialFindings;
          continue;
        }
        const completed = visit(index + 1, next, trialFindings);
        if (completed !== undefined) return completed;
      }
      return undefined;
    };
    const completion = visit(0, frontierBranches, new Map());
    const candidateBranches = completion?.branches ?? Object.freeze([]);
    const candidateFindings = completion?.findings ?? representativeFailedFindings ?? new Map();
    const pointKey = `optionalRewards:${selectedReward.slotKey}`;
    const acquisitionEvent = lifecycle.acquisitionPointsByOwner
      .get(semanticAddressKey(room.origin))
      ?.find((candidate) => candidate.point === pointKey);
    const acquisitionView = roomView.acquisitionPoints?.find(
      (point) => point.point === pointKey,
    )?.before;
    if (
      candidateBranches.length > 0 &&
      acquisitionEvent !== undefined &&
      acquisitionView !== undefined
    ) {
      settleOwnedAcquisitionSite(
        catalog,
        candidateBranches,
        {
          siteOwner: selectedReward.origin,
          pointKey,
          entryKey: selectedReward.slotKey,
          source: Object.freeze({
            ...(concreteBySlot.get(selectedReward.slotKey) ??
              candidateState(unresolvedBySlot.get(selectedReward.slotKey)!, offer)),
            offer,
            instanceProvenance: 'free',
          }),
          historySequence: acquisitionEvent.sequence,
          authoredSeaStarDuplicateSiteKeys: inputs.authoredSeaStarDuplicateSiteKeys,
        },
        (branchHistory) =>
          createBiomeRewardFacts(
            catalog,
            room,
            room,
            declaration,
            acquisitionView,
            branchHistory,
            enteredBiomeCount,
          ),
        candidateFindings,
        ownerRegion(selectedReward.origin),
        rewardFindingChronologyForRoom(
          snapshot,
          room.origin,
          acquisitionEvent.sequence,
          'localRoomLifecycle',
        ),
      );
    }
    return Object.freeze({
      findings: Object.freeze(
        [...candidateFindings.values()]
          .map((entry) => entry.finding)
          .filter((finding) => finding.code !== 'traitOfferMissing'),
      ),
      supported: candidateBranches.length > 0,
    });
  };

  for (const reward of [...optionalRewards, ...unresolvedOptionals]) {
    const pointKey = `optionalRewards:${reward.slotKey}`;
    const acquisitionEvent = lifecycle.acquisitionPointsByOwner
      .get(semanticAddressKey(room.origin))
      ?.find((candidate) => candidate.point === pointKey);
    producerFrontiers.push(
      Object.freeze({
        generationPolicy: 'sequential',
        generationHistorySequence: event.sequence,
        reachableBranchCount: frontierBranches.length,
        acquisitionHorizon:
          acquisitionEvent === undefined
            ? ('generationOnly' as const)
            : ('ownEnteredLifecycle' as const),
        owners: Object.freeze([reward.origin]),
        resolvedStoreKey: reward.resolvedStoreKey,
        evaluateOffer: evaluateOptionalCohort,
      }),
    );
  }

  let branches = inputs.branches;
  let reachedMissing = false;
  for (const slotKey of orderedSlots) {
    const concrete = concreteBySlot.get(slotKey);
    if (concrete === undefined) {
      reachedMissing = true;
      continue;
    }
    if (!reachedMissing) branches = processRewardOffer(branches, contextFor(concrete), findings);
  }
  if (unresolvedOptionals.length > 0) {
    for (const unresolved of unresolvedOptionals) {
      addRewardFinding(
        findings,
        rewardFinding('rewardMissing', unresolved.origin, {}),
        ownerRegion(room.origin),
        historyFindingChronology(event.sequence),
      );
    }
    branches = Object.freeze([]);
  }
  return Object.freeze({
    branches,
    findings: Object.freeze([...findings.values()]),
    producerFrontiers: Object.freeze(producerFrontiers),
  });
}
