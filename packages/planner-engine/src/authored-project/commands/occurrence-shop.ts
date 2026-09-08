import type { Catalog } from '../../catalog-schema';
import type { ProjectDocument } from '../model';

import { failCommand, requireOccurrence, requireTopology, type LocatedBiome } from './contract';
import { replaceOccurrence, updateOccurrenceTopology } from './occurrence-mutation';
import { sameOccurrenceValue } from './occurrence-leaf-value';
import type { ShopOccurrenceCommand } from './types';
import { createUnresolvedAcquisitionRewardState } from '../traits';
import { rewardSourceResolvesAtAcquisition } from '../reward-state';
import { reconcileAcquisitionResolvedRewardEntry } from '../acquisition-entry';
import { pickupEffectForOffer } from '../../reward-kernel/history';
import {
  ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  INFERNAL_CONTRACT_ENTRY_KEY,
  TRAVEL_DEAL_REFILL_ENTRY_KEY,
} from '../shop';

export function applyShopOccurrenceCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: ShopOccurrenceCommand,
): ProjectDocument {
  const current = requireTopology(located.plan, command);
  const occurrence = requireOccurrence(located.plan, command.offer.occurrenceId, command);
  if (occurrence.state.kind !== 'shop' || occurrence.state.shop === undefined) {
    failCommand(command, `${occurrence.gameName} has no materialized shop inventory`);
  }
  if (
    command.offer.offerKey === INFERNAL_CONTRACT_ENTRY_KEY ||
    command.offer.offerKey === TRAVEL_DEAL_REFILL_ENTRY_KEY ||
    command.offer.offerKey === ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY
  ) {
    failCommand(command, `${command.offer.offerKey} is reserved for a supplemental Shop entry`);
  }
  const offer = occurrence.state.shop.offers[command.offer.offerKey];
  if (offer === undefined) failCommand(command, `unknown shop offer ${command.offer.offerKey}`);
  if (command.kind === 'ReplaceAnvilResult') {
    const reward = offer.reward;
    if (reward === null) failCommand(command, 'acquisition effect result requires a reward');
    if (pickupEffectForOffer(catalog.rewards, reward.offer)?.effect.kind !== 'anvilOfFates')
      failCommand(command, 'reward has no declared Anvil of Fates pickup effect');
    if (JSON.stringify(offer.anvilResult) === JSON.stringify(command.value)) return document;
    const replacement = Object.freeze({
      ...offer,
      anvilResult: command.value,
    });
    return updateOccurrenceTopology(
      document,
      located,
      replaceOccurrence(
        current,
        Object.freeze({
          ...occurrence,
          state: Object.freeze({
            ...occurrence.state,
            shop: Object.freeze({
              ...occurrence.state.shop,
              offers: Object.freeze({
                ...occurrence.state.shop.offers,
                [command.offer.offerKey]: replacement,
              }),
            }),
          }),
        }),
      ),
    );
  }
  if (
    offer.reward !== null &&
    offer.reward.offer.rewardType === command.value.rewardType &&
    ((rewardSourceResolvesAtAcquisition(catalog, command.value) &&
      offer.reward.offer.payload === undefined) ||
      sameOccurrenceValue(offer.reward.offer, command.value))
  )
    return document;
  const resolvesAtAcquisition = rewardSourceResolvesAtAcquisition(catalog, command.value);
  const reward = resolvesAtAcquisition
    ? Object.freeze({
        offer: Object.freeze({ rewardType: command.value.rewardType }),
        traitOffersByAcquisitionRole: Object.freeze({}),
        dispositionByAcquisitionRole: Object.freeze({}),
      })
    : createUnresolvedAcquisitionRewardState(catalog, command.value, {
        kind: 'shopProfile',
        key: occurrence.state.shop.profileKey,
      });
  const pickupEffect = resolvesAtAcquisition
    ? undefined
    : pickupEffectForOffer(catalog.rewards, command.value);
  const replacement = Object.freeze({
    reward,
    ...(pickupEffect?.effect.kind === 'anvilOfFates' ? { anvilResult: null } : {}),
  });
  const purchaseSelected = occurrence.roomActions.order.some(
    (reference) =>
      reference.kind === 'interactShopOffer' && reference.offerKey === command.offer.offerKey,
  );
  const nextOccurrence = reconcileAcquisitionResolvedRewardEntry(
    catalog,
    Object.freeze({
      ...occurrence,
      state: Object.freeze({
        ...occurrence.state,
        shop: Object.freeze({
          ...occurrence.state.shop,
          offers: Object.freeze({
            ...occurrence.state.shop.offers,
            [command.offer.offerKey]: replacement,
          }),
        }),
      }),
    }),
    command.offer.offerKey,
    purchaseSelected,
    reward,
  );
  return updateOccurrenceTopology(document, located, replaceOccurrence(current, nextOccurrence));
}
