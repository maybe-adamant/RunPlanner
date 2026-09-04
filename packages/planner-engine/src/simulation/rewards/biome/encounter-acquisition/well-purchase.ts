import type { Catalog } from '../../../../catalog-schema';
import {
  createBiomeAddress,
  createRoomActionAddress,
  createWellRefillRealizationAddress,
  semanticAddressKey,
  type SemanticAddress,
} from '../../../../authored-project/addresses';
import { roomActionKey } from '../../../../authored-project/room-actions';
import type { HistoryEvent } from '../../../history';
import type { CanonicalAuthoredRoom, CanonicalHubRoom } from '../../../materialization';
import { findingRegion, type FindingRegionEntry } from '../../../finding-regions';
import { applyConcreteAcquisition } from '../../../../reward-kernel';
import {
  applyStygianWellPurchase,
  extendedWellItemKeys,
  stygianWellRuntimeFallbackItemKey,
} from '../../../stygian-well';
import type { BiomeRewardSnapshot } from '../evaluation-contract';
import { rewardFindingChronologyForRoom } from '../finding-chronology';
import { rewardFinding } from '../../findings';
import type { RewardBranchState } from '../../branch-primitives';
import type { PlannerTimelineFacts } from '../../../timeline-facts';
import type { WellRefillRealization } from '../../model';
import type { RuntimeOfferFallback } from '../../../runtime-offer-fallback';

export interface WellPurchaseTransition {
  readonly branches: readonly RewardBranchState[];
  readonly findings: readonly FindingRegionEntry[];
  readonly timelineFacts: PlannerTimelineFacts;
  readonly refillRealization?: WellRefillRealization;
  /** The selected item's one-step fallback at the native purchase contact. */
  readonly runtimeOfferFallback?: RuntimeOfferFallback;
}

/** Applies one reached Stygian Well purchase and publishes its exact fallback edges. */
export function applyWellPurchaseTransition(inputs: {
  readonly catalog: Catalog;
  readonly snapshot: BiomeRewardSnapshot;
  readonly event: Extract<HistoryEvent, { readonly kind: 'wellPurchase' }>;
  readonly room: CanonicalAuthoredRoom | CanonicalHubRoom | undefined;
  readonly branches: readonly RewardBranchState[];
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
  const sourceGenerationKey =
    sourceRow?.reference.kind === 'purchaseStygianWellOffer'
      ? sourceRow.reference.generationKey
      : undefined;
  const refillItemKey = well?.travelDealRefillKey;
  const sourcesTravelDealRefill =
    sourceGenerationKey !== undefined && refillItemKey !== undefined && refillItemKey !== null;
  const refillPurchaseRow = activeWellRows.find(
    (candidate) =>
      candidate.reference.kind === 'purchaseStygianWellOffer' &&
      candidate.reference.generationKey === 'travelDealRefill',
  );
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
  const runtimeOfferFallback = (() => {
    if (row === undefined || itemKey === undefined || itemKey === null) return undefined;
    const directFallback = stygianWellRuntimeFallbackItemKey(catalog, itemKey, false);
    const preferredKey = directFallback === undefined ? twistResultKey : itemKey;
    const fallbackKey =
      directFallback ??
      (twistResultKey === undefined || twistResultKey === null
        ? undefined
        : stygianWellRuntimeFallbackItemKey(catalog, twistResultKey, true));
    if (preferredKey === undefined || preferredKey === null || fallbackKey === undefined)
      return undefined;
    return Object.freeze({
      address: row.owner,
      preferredKey,
      fallbackKey,
      availabilityContact: 'storePurchase' as const,
    });
  })();
  const isSourcePurchase =
    row !== undefined &&
    sourcesTravelDealRefill &&
    candidateOwnerEquals(row.owner, sourceRow?.owner);
  const isTravelDealCompetitor =
    sourcesTravelDealRefill &&
    row?.reference.kind === 'purchaseStygianWellOffer' &&
    row.reference.generationKey.startsWith('initial:') &&
    sourceRow !== undefined &&
    !candidateOwnerEquals(row.owner, sourceRow.owner);
  const timelineFacts: PlannerTimelineFacts = Object.freeze({
    nodes:
      row === undefined
        ? Object.freeze([])
        : Object.freeze([
            Object.freeze({
              owner: row.owner,
              included:
                (effect !== undefined && effect !== 'neutral') ||
                isSourcePurchase ||
                isTravelDealCompetitor,
            }),
          ]),
    dependencies:
      row === undefined
        ? Object.freeze([])
        : Object.freeze(
            [
              extendedSourceOwner,
              ...(sourcesTravelDealRefill &&
              sourceRow !== undefined &&
              row.reference.kind === 'purchaseStygianWellOffer' &&
              row.reference.generationKey.startsWith('initial:') &&
              !candidateOwnerEquals(row.owner, sourceRow.owner)
                ? [sourceRow.owner]
                : []),
            ]
              .filter((source): source is SemanticAddress => source !== undefined)
              .filter((source) => semanticAddressKey(source) !== semanticAddressKey(row.owner))
              .map((source) => Object.freeze({ owner: row.owner, afterOwner: source })),
          ),
  });
  const sourceOwner = sourceRow?.owner;
  const refillRealization = (() => {
    if (
      row === undefined ||
      sourceOwner === undefined ||
      !candidateOwnerEquals(row.owner, sourceOwner) ||
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
      owner: createWellRefillRealizationAddress(
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
              owner: refillRealization.owner,
              afterOwner: refillRealization.sourceOwner,
            }),
            ...(refillPurchaseRow === undefined
              ? []
              : [
                  Object.freeze({
                    owner: refillPurchaseRow.owner,
                    afterOwner: refillRealization.owner,
                  }),
                ]),
          ]),
        });
  if (
    room?.kind !== 'authored' ||
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
      ...(runtimeOfferFallback === undefined ? {} : { runtimeOfferFallback }),
      ...(refillRealization === undefined ? {} : { refillRealization }),
    });
  }
  return Object.freeze({
    branches: Object.freeze(
      inputs.branches.map((branch) => {
        const direct = applyStygianWellPurchase(catalog, branch.stygianWell, itemKey, true);
        const directOption = catalog.rewards.shops.byKey.RoomShop?.groups.values
          .flatMap((group) => group.options.values)
          .find((option) => option.key === itemKey);
        const nestedOption =
          twistResultKey === undefined || twistResultKey === null
            ? undefined
            : catalog.rewards.shops.byKey.RoomShop?.groups.values
                .flatMap((group) => group.options.values)
                .find((option) => option.key === twistResultKey);
        let history = branch.history;
        if (directOption?.stygianWell?.effect === 'lastStand')
          history = applyConcreteAcquisition(catalog.rewards, history, {
            kind: 'consumable',
            gameName: 'LastStandDrop',
          });
        if (nestedOption?.stygianWell?.effect === 'lastStand')
          history = applyConcreteAcquisition(catalog.rewards, history, {
            kind: 'consumable',
            gameName: 'LastStandDrop',
          });
        return Object.freeze({
          ...branch,
          history,
          stygianWell:
            twistResultKey === undefined || twistResultKey === null
              ? direct
              : applyStygianWellPurchase(catalog, direct, twistResultKey, false),
        });
      }),
    ),
    findings: Object.freeze([]),
    timelineFacts: factsWithRefill,
    ...(runtimeOfferFallback === undefined ? {} : { runtimeOfferFallback }),
    ...(refillRealization === undefined ? {} : { refillRealization }),
  });
}

function candidateOwnerEquals(left: SemanticAddress, right: SemanticAddress | undefined): boolean {
  return right !== undefined && semanticAddressKey(left) === semanticAddressKey(right);
}
