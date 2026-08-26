import type { Catalog } from '../../../../catalog-schema';
import {
  createBiomeAddress,
  createRoomActionAddress,
  semanticAddressKey,
  type SemanticAddress,
} from '../../../../authored-project/addresses';
import type { HistoryEvent } from '../../../history';
import type { CanonicalAuthoredRoom, CanonicalHubRoom } from '../../../materialization';
import { findingRegion, type FindingRegionEntry } from '../../../finding-regions';
import { applyConcreteAcquisition } from '../../../../reward-kernel';
import { applyStygianWellPurchase } from '../../../stygian-well';
import type { BiomeRewardSnapshot } from '../evaluation-contract';
import { rewardFindingChronologyForRoom } from '../finding-chronology';
import { rewardFinding } from '../../findings';
import type { RewardBranchState } from '../../branch-primitives';

export interface RuntimeOfferFallback {
  readonly key: string;
  readonly address: SemanticAddress;
  readonly preferredKey: string;
  readonly fallbackKey: string;
}

export interface WellPurchaseTransition {
  readonly branches: readonly RewardBranchState[];
  readonly findings: readonly FindingRegionEntry[];
  readonly runtimeOfferFallbacks: readonly RuntimeOfferFallback[];
}

function runtimeFallbackItemKey(
  catalog: Catalog,
  itemKey: string,
  nested: boolean,
): string | undefined {
  const profile = catalog.rewards.shops.byKey.RoomShop;
  const option = profile?.groups.values
    .flatMap((group) => group.options.values)
    .find((candidate) => candidate.key === itemKey);
  if (nested) {
    const twist = profile?.groups.values
      .flatMap((group) => group.options.values)
      .find((candidate) => candidate.key === 'RandomStoreItem');
    return twist?.stygianWell?.nestedRuntimeOfferFallbacks?.find(
      (edge) => edge.preferredItemKey === itemKey,
    )?.fallbackItemKey;
  }
  const group = profile?.groups.values.find(
    (candidate) => candidate.options.byKey[itemKey] !== undefined,
  );
  const fallbackRewardType = option?.runtimeOfferFallbackRewardTypes?.[0];
  return fallbackRewardType === undefined
    ? undefined
    : group?.options.values.find((candidate) => candidate.rewardType === fallbackRewardType)?.key;
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
  const well = room?.kind === 'authored' ? room.stygianWell : undefined;
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
      runtimeOfferFallbacks: Object.freeze([]),
    });
  }
  const twistChildKey = event.generationKey === 'travelDealRefill' ? 'travelDealRefill' : slot;
  const twistResultKey =
    itemKey === 'RandomStoreItem' && twistChildKey !== undefined
      ? well.twistResultKeyBySlot?.[twistChildKey]
      : undefined;
  const fallbacks: RuntimeOfferFallback[] = [];
  const row = room.roomActionRoster.rows.find(
    (candidate) =>
      candidate.reference.kind === 'purchaseStygianWellOffer' &&
      candidate.reference.generationKey === event.generationKey,
  );
  if (row !== undefined) {
    const address = createRoomActionAddress(
      createBiomeAddress(event.origin.routeKey, event.origin.biomeKey),
      room.occurrenceId,
      row.key,
    );
    const fallbackItemKey = runtimeFallbackItemKey(catalog, itemKey, false);
    if (fallbackItemKey !== undefined)
      fallbacks.push(
        Object.freeze({
          key: semanticAddressKey(address),
          address,
          preferredKey: itemKey,
          fallbackKey: fallbackItemKey,
        }),
      );
    if (twistResultKey !== undefined && twistResultKey !== null) {
      const nestedFallback = runtimeFallbackItemKey(catalog, twistResultKey, true);
      if (nestedFallback !== undefined)
        fallbacks.push(
          Object.freeze({
            key: `${semanticAddressKey(address)}:twist`,
            address,
            preferredKey: twistResultKey,
            fallbackKey: nestedFallback,
          }),
        );
    }
  }
  return Object.freeze({
    branches: Object.freeze(
      inputs.branches.map((branch) => {
        const direct = applyStygianWellPurchase(catalog, branch.stygianWell, itemKey);
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
    runtimeOfferFallbacks: Object.freeze(fallbacks),
  });
}
