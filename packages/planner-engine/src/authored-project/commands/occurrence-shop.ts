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
  const profile = catalog.rewards.shops.byKey[occurrence.state.shop.profileKey];
  const slot = profile?.slots.byKey[command.offer.offerKey];
  const group = slot === undefined ? undefined : profile?.groups.byKey[slot.groupKey];
  if (group === undefined) failCommand(command, 'shop offer has no declaration-owned group');
  const selectedOffer =
    command.kind === 'ReplaceShopOfferOption' ? command.value.offer : command.value;
  const retainedOption =
    offer.optionKey === null ? undefined : group.options.byKey[offer.optionKey];
  const compatibleOptions = group.options.values.filter(
    (candidate) => candidate.rewardType === selectedOffer.rewardType,
  );
  const selectedOptionKey =
    command.kind === 'ReplaceShopOfferOption'
      ? command.value.optionKey
      : retainedOption?.rewardType === selectedOffer.rewardType
        ? retainedOption.key
        : compatibleOptions.length === 1
          ? compatibleOptions[0]!.key
          : null;
  const option = selectedOptionKey === null ? undefined : group.options.byKey[selectedOptionKey];
  if (command.kind === 'ReplaceShopOfferOption' && option === undefined)
    failCommand(command, `unknown shop option ${command.value.optionKey}`);
  if (option !== undefined && option.rewardType !== selectedOffer.rewardType)
    failCommand(command, `${option.key} does not produce ${selectedOffer.rewardType}`);
  const resolvesAtAcquisition = rewardSourceResolvesAtAcquisition(catalog, selectedOffer);
  const sameReward =
    offer.reward !== null &&
    offer.reward.offer.rewardType === selectedOffer.rewardType &&
    ((resolvesAtAcquisition && offer.reward.offer.payload === undefined) ||
      sameOccurrenceValue(offer.reward.offer, selectedOffer));
  if (sameReward && offer.optionKey === selectedOptionKey) return document;
  const replacement = sameReward
    ? Object.freeze({ ...offer, optionKey: selectedOptionKey })
    : (() => {
        const reward = resolvesAtAcquisition
          ? Object.freeze({
              offer: Object.freeze({ rewardType: selectedOffer.rewardType }),
              traitOffersByAcquisitionRole: Object.freeze({}),
              dispositionByAcquisitionRole: Object.freeze({}),
            })
          : createUnresolvedAcquisitionRewardState(catalog, selectedOffer, {
              kind: 'shopProfile',
              key: occurrence.state.shop.profileKey,
            });
        const pickupEffect = resolvesAtAcquisition
          ? undefined
          : pickupEffectForOffer(catalog.rewards, selectedOffer);
        return Object.freeze({
          optionKey: selectedOptionKey,
          reward,
          ...(pickupEffect?.effect.kind === 'anvilOfFates' ? { anvilResult: null } : {}),
        });
      })();
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
    replacement.reward,
  );
  return updateOccurrenceTopology(document, located, replaceOccurrence(current, nextOccurrence));
}
