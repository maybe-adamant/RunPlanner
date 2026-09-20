import type { Catalog } from '../../../../catalog-schema';
import {
  createBiomeAddress,
  createRoomActionAddress,
  createRoomFeatureAddress,
  createTravelDealRefillRealizationAddress,
  semanticAddressKey,
  type SemanticAddress,
} from '../../../../authored-project/addresses';
import { roomActionKey } from '../../../../authored-project/room-actions/state';
import type { HistoryEvent } from '../../../history';
import type { CanonicalAuthoredRoom, CanonicalHubRoom } from '../../../materialization';
import { findingRegion, type FindingRegionEntry } from '../../../finding-regions';
import { applyConcreteAcquisition } from '../../../../reward-kernel';
import {
  applyStygianWellPurchase,
  assessStygianWellPurchase,
  extendedWellItemKeys,
  type StygianWellCandidateContext,
} from '../../../commerce/stygian-well';
import type { BiomeRewardSnapshot } from '../evaluation-contract';
import { rewardFindingChronologyForRoom } from '../finding-chronology';
import { rewardFinding } from '../../findings';
import type { RewardBranchState } from '../../branch-primitives';
import type { PlannerTimelineFacts } from '../../../timeline-facts';
import type { WellRefillRealization } from '../../model';

export interface WellPurchaseTransition {
  readonly branches: readonly RewardBranchState[];
  readonly findings: readonly FindingRegionEntry[];
  readonly timelineFacts: PlannerTimelineFacts;
  readonly refillRealization?: WellRefillRealization;
  readonly candidateContexts: readonly StygianWellCandidateContext[];
}

/** Applies one reached Stygian Well purchase. */
export function applyWellPurchaseTransition(inputs: {
  readonly catalog: Catalog;
  readonly snapshot: BiomeRewardSnapshot;
  readonly event: Extract<HistoryEvent, { readonly kind: 'wellPurchase' }>;
  readonly room: CanonicalAuthoredRoom | CanonicalHubRoom | undefined;
  readonly branches: readonly RewardBranchState[];
  readonly refillGenerationSupported: boolean;
}): WellPurchaseTransition {
  const { catalog, snapshot, event, room } = inputs;
  const authoredRoom = room?.kind === 'authored' ? room : undefined;
  const well = authoredRoom?.stygianWell;
  const slot = event.generationKey.startsWith('initial:')
    ? (event.generationKey.slice(
        'initial:'.length,
      ) as import('../../../../authored-project/model').StygianWellSlotKey)
    : undefined;
  const itemKey =
    event.generationKey === 'travelDealRefill'
      ? well?.travelDealRefillKey
      : slot === undefined
        ? undefined
        : well?.offerKeyBySlot[slot];
  const row =
    room?.kind === 'authored'
      ? room.roomActionRoster.rows.find(
          (candidate) =>
            !candidate.stale &&
            candidate.rank !== null &&
            candidate.reference.kind === 'purchaseStygianWellOffer' &&
            candidate.reference.generationKey === event.generationKey,
        )
      : undefined;
  const effect = authoredRoom?.stygianWellOfferEffects?.[event.generationKey];
  const activeWellRows =
    authoredRoom === undefined
      ? []
      : authoredRoom.roomActionRoster.rows
          .filter(
            (candidate) =>
              !candidate.stale &&
              candidate.rank !== null &&
              candidate.reference.kind === 'purchaseStygianWellOffer',
          )
          .sort((left, right) => left.rank! - right.rank!);
  const sourceRow = activeWellRows.find(
    (candidate) =>
      candidate.reference.kind === 'purchaseStygianWellOffer' &&
      candidate.reference.generationKey.startsWith('initial:'),
  );
  const refillItemKey = well?.travelDealRefillKey;
  const firstPurchaseGenerationKey =
    sourceRow?.reference.kind === 'purchaseStygianWellOffer'
      ? sourceRow.reference.generationKey
      : undefined;
  const pendingExtendedOwners: SemanticAddress[] = [];
  let extendedSourceOwner: SemanticAddress | undefined;
  for (const candidate of activeWellRows) {
    if (candidate.reference.kind !== 'purchaseStygianWellOffer') continue;
    const candidateGeneration = candidate.reference.generationKey;
    const candidateEffect = authoredRoom?.stygianWellOfferEffects?.[candidateGeneration];
    if (candidateEffect === 'extended') {
      pendingExtendedOwners.push(candidate.owner);
    } else {
      const candidateSlot = candidateGeneration.startsWith('initial:')
        ? (candidateGeneration.slice('initial:'.length) as 'healing' | 'secondLeft' | 'secondRight')
        : undefined;
      const candidateItem =
        candidateGeneration === 'travelDealRefill'
          ? authoredRoom?.stygianWell?.travelDealRefillKey
          : candidateSlot === undefined
            ? undefined
            : authoredRoom?.stygianWell?.offerKeyBySlot[candidateSlot];
      if (
        candidateItem !== undefined &&
        candidateItem !== null &&
        extendedWellItemKeys(catalog).includes(candidateItem) &&
        pendingExtendedOwners.length > 0
      ) {
        const consumed = pendingExtendedOwners.shift();
        if (candidate === row) extendedSourceOwner = consumed;
      }
    }
    if (candidate === row) break;
  }
  const twistChildKey = event.generationKey === 'travelDealRefill' ? 'travelDealRefill' : slot;
  const twistResultKey =
    itemKey === 'RandomStoreItem' && twistChildKey !== undefined
      ? well?.twistResultKeyBySlot?.[twistChildKey]
      : undefined;
  const extendedDirectPurchase =
    itemKey !== undefined && itemKey !== null && extendedWellItemKeys(catalog).includes(itemKey);
  const timelineFacts: PlannerTimelineFacts = Object.freeze({
    nodes:
      row === undefined
        ? Object.freeze([])
        : Object.freeze([
            Object.freeze({
              owner: row.owner,
              included: effect !== undefined && (effect !== 'neutral' || extendedDirectPurchase),
            }),
          ]),
    dependencies:
      row === undefined ||
      extendedSourceOwner === undefined ||
      semanticAddressKey(extendedSourceOwner) === semanticAddressKey(row.owner)
        ? Object.freeze([])
        : Object.freeze([Object.freeze({ owner: row.owner, afterOwner: extendedSourceOwner })]),
  });
  const sourceOwner = sourceRow?.owner;
  const refillSupported = inputs.branches.every(
    (branch) => branch.state.traitHistory.equippedTraits.RestockBoon !== undefined,
  );
  const refillRealization = (() => {
    if (
      row === undefined ||
      sourceOwner === undefined ||
      !candidateOwnerEquals(row.owner, sourceOwner) ||
      !refillSupported ||
      refillItemKey === undefined ||
      refillItemKey === null ||
      authoredRoom === undefined
    )
      return undefined;
    const inventoryOwner = createRoomActionAddress(
      createBiomeAddress(authoredRoom.origin.routeKey, authoredRoom.origin.biomeKey),
      authoredRoom.occurrenceId,
      roomActionKey(
        Object.freeze({
          kind: 'purchaseStygianWellOffer' as const,
          generationKey: 'travelDealRefill' as const,
        }),
      ),
    );
    const refillTwistResultKey =
      refillItemKey === 'RandomStoreItem'
        ? authoredRoom.stygianWell?.twistResultKeyBySlot?.travelDealRefill
        : undefined;
    return Object.freeze({
      owner: createTravelDealRefillRealizationAddress(
        createBiomeAddress(authoredRoom.origin.routeKey, authoredRoom.origin.biomeKey),
        authoredRoom.origin.occurrenceId,
      ),
      inventoryOwner,
      sourceOwner,
      generationKey: 'travelDealRefill' as const,
      offerKey: refillItemKey,
      effect: authoredRoom.stygianWellOfferEffects?.travelDealRefill ?? 'neutral',
      ...(refillTwistResultKey === undefined || refillTwistResultKey === null
        ? {}
        : { twistResultKey: refillTwistResultKey }),
    });
  })();
  const factsWithRefill =
    refillRealization === undefined
      ? timelineFacts
      : Object.freeze({
          nodes: Object.freeze([
            ...timelineFacts.nodes,
            Object.freeze({ owner: refillRealization.owner, included: true }),
          ]),
          dependencies: Object.freeze([
            ...timelineFacts.dependencies,
            Object.freeze({
              owner: refillRealization.inventoryOwner,
              afterOwner: refillRealization.owner,
            }),
          ]),
        });
  if (
    authoredRoom === undefined ||
    well === undefined ||
    !well.interacted ||
    itemKey === undefined ||
    itemKey === null
  ) {
    return Object.freeze({
      branches: inputs.branches,
      findings: Object.freeze([
        findingRegion(
          rewardFinding('rewardSourceUnavailable', event.origin, {
            generationKey: event.generationKey,
          }),
          undefined,
          rewardFindingChronologyForRoom(
            snapshot,
            event.origin,
            event.sequence,
            'localRoomLifecycle',
          ),
          'reward',
        ),
      ]),
      timelineFacts: factsWithRefill,
      candidateContexts: Object.freeze([]),
      ...(refillRealization === undefined ? {} : { refillRealization }),
    });
  }
  if (event.generationKey === 'travelDealRefill' && !inputs.refillGenerationSupported) {
    return Object.freeze({
      branches: inputs.branches,
      findings: Object.freeze([
        findingRegion(
          rewardFinding(
            'stygianWellTravelDealRefillUnavailable',
            createRoomFeatureAddress(authoredRoom.origin, {
              kind: 'stygianWellOffer',
              generationKey: 'travelDealRefill',
            }),
            { reason: 'refillUnavailable' },
          ),
          undefined,
          rewardFindingChronologyForRoom(
            snapshot,
            authoredRoom.origin,
            event.sequence,
            'localRoomLifecycle',
          ),
          'reward',
        ),
      ]),
      timelineFacts: factsWithRefill,
      candidateContexts: Object.freeze([]),
      ...(refillRealization === undefined ? {} : { refillRealization }),
    });
  }
  const candidateContexts = inputs.branches.map((branch) =>
    Object.freeze({
      purchase: assessStygianWellPurchase(
        catalog,
        authoredRoom?.origin.routeKey ?? event.origin.routeKey,
        well,
        event.generationKey,
        branch.state.stygianWell,
        branch.state.traitHistory,
        firstPurchaseGenerationKey,
      ),
    }),
  );
  const findings = candidateContexts.flatMap(({ purchase }) =>
    purchase.issues.map((issue) =>
      findingRegion(
        rewardFinding(
          issue.kind.startsWith('twist')
            ? 'stygianWellTwistInvalid'
            : 'stygianWellTravelDealRefillUnavailable',
          createRoomFeatureAddress(authoredRoom.origin, {
            kind: issue.kind.startsWith('twist') ? 'stygianWellTwist' : 'stygianWellOffer',
            generationKey: issue.generationKey,
          }),
          { reason: issue.kind },
        ),
        undefined,
        rewardFindingChronologyForRoom(
          snapshot,
          authoredRoom.origin,
          event.sequence,
          'localRoomLifecycle',
        ),
        'reward',
      ),
    ),
  );
  return Object.freeze({
    branches: Object.freeze(
      inputs.branches.map((branch, index) => {
        const assessment = candidateContexts[index]?.purchase;
        const direct = applyStygianWellPurchase(catalog, branch.state.stygianWell, itemKey, true);
        const directOption = catalog.rewards.shops.byKey.RoomShop?.groups.values
          .flatMap((group) => group.options.values)
          .find((option) => option.key === itemKey);
        const nestedOption =
          twistResultKey === undefined || twistResultKey === null
            ? undefined
            : catalog.rewards.shops.byKey.RoomShop?.groups.values
                .flatMap((group) => group.options.values)
                .find((option) => option.key === twistResultKey);
        let history = branch.state.rewardHistory;
        if (directOption?.stygianWell?.effect === 'lastStand')
          history = applyConcreteAcquisition(catalog.rewards, history, {
            kind: 'consumable',
            gameName: 'LastStandDrop',
          });
        const nestedResultIsValid =
          assessment?.twistCandidateItemKeys !== undefined &&
          twistResultKey !== undefined &&
          twistResultKey !== null &&
          assessment.twistCandidateItemKeys.includes(twistResultKey);
        if (nestedResultIsValid && nestedOption?.stygianWell?.effect === 'lastStand')
          history = applyConcreteAcquisition(catalog.rewards, history, {
            kind: 'consumable',
            gameName: 'LastStandDrop',
          });
        return Object.freeze({
          ...branch,
          state: Object.freeze({
            ...branch.state,
            rewardHistory: history,
            stygianWell:
              !nestedResultIsValid || twistResultKey === undefined || twistResultKey === null
                ? direct
                : applyStygianWellPurchase(catalog, direct, twistResultKey, false),
          }),
        });
      }),
    ),
    findings: Object.freeze(findings),
    timelineFacts: factsWithRefill,
    candidateContexts: Object.freeze(candidateContexts),
    ...(refillRealization === undefined ? {} : { refillRealization }),
  });
}

function candidateOwnerEquals(left: SemanticAddress, right: SemanticAddress | undefined): boolean {
  return right !== undefined && semanticAddressKey(left) === semanticAddressKey(right);
}
