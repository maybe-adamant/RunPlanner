import type { Catalog } from '../../../catalog-schema';
import type { ProjectDocument } from '../../model';

import { failCommand, requireOccurrence, requireTopology, type LocatedBiome } from '../contract';
import { replaceOccurrence, updateOccurrenceTopology } from './mutation';
import { sameOccurrenceValue } from './leaf-value';
import type { ShopOccurrenceCommand } from '../types';
import { createUnresolvedAcquisitionRewardState } from '../../traits/state';
import { rewardSourceResolvesAtAcquisition } from '../../acquisition/reward-state';
import { reconcileAcquisitionResolvedRewardEntry } from '../../acquisition/acquisition-entry';
import {
  ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  TRAVEL_DEAL_REFILL_ENTRY_KEY,
  authoredShopOffer,
  replaceAuthoredShopOffer,
  shopSlotProfile,
} from '../../shop';

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
  if (command.offer.offerKey === ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY) {
    failCommand(command, `${command.offer.offerKey} is reserved for a supplemental Shop entry`);
  }
  const offer =
    authoredShopOffer(occurrence, command.offer.offerKey) ??
    (command.offer.offerKey === TRAVEL_DEAL_REFILL_ENTRY_KEY
      ? Object.freeze({ optionKey: null, reward: null })
      : undefined);
  if (offer === undefined) failCommand(command, `unknown shop offer ${command.offer.offerKey}`);
  if (command.kind === 'ClearShopOffer') {
    if (command.offer.offerKey === TRAVEL_DEAL_REFILL_ENTRY_KEY)
      failCommand(command, 'Travel Deal refill is not a declared Shop slot');
    if (offer.reward === null && offer.optionKey === null) return document;
    const withoutPurchase = Object.freeze({
      ...replaceAuthoredShopOffer(
        occurrence,
        command.offer.offerKey,
        Object.freeze({ optionKey: null, reward: null }),
      ),
      roomActions: Object.freeze({
        order: Object.freeze(
          occurrence.roomActions.order.filter(
            (reference) =>
              reference.kind !== 'interactShopOffer' ||
              reference.offerKey !== command.offer.offerKey,
          ),
        ),
      }),
    });
    const nextOccurrence = reconcileAcquisitionResolvedRewardEntry(
      catalog,
      withoutPurchase,
      command.offer.offerKey,
      false,
      null,
    );
    return updateOccurrenceTopology(document, located, replaceOccurrence(current, nextOccurrence));
  }
  const profile = shopSlotProfile(
    catalog,
    occurrence.gameName,
    occurrence.state.shop.profileKey,
    command.offer.offerKey,
  );
  const slot = profile?.slots.byKey[command.offer.offerKey];
  const group = slot === undefined ? undefined : profile?.groups.byKey[slot.groupKey];
  const optionDomain =
    command.offer.offerKey === TRAVEL_DEAL_REFILL_ENTRY_KEY
      ? (profile?.groups.values.flatMap((candidate) => candidate.options.values) ?? [])
      : group?.options.values;
  if (optionDomain === undefined) failCommand(command, 'shop offer has no declaration-owned group');
  const selectedOffer =
    command.kind === 'ReplaceShopOfferOption' ? command.value.offer : command.value;
  const retainedOption =
    offer.optionKey === null
      ? undefined
      : optionDomain.find((candidate) => candidate.key === offer.optionKey);
  const compatibleOptions = [
    ...new Map(
      optionDomain
        .filter((candidate) => candidate.rewardType === selectedOffer.rewardType)
        .map((option) => [option.key, option]),
    ).values(),
  ];
  const selectedOptionKey =
    command.kind === 'ReplaceShopOfferOption'
      ? command.value.optionKey
      : retainedOption?.rewardType === selectedOffer.rewardType
        ? retainedOption.key
        : compatibleOptions.length === 1
          ? compatibleOptions[0]!.key
          : null;
  const option =
    selectedOptionKey === null
      ? undefined
      : optionDomain.find((candidate) => candidate.key === selectedOptionKey);
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
          : createUnresolvedAcquisitionRewardState(
              catalog,
              selectedOffer,
              {
                kind: 'shopProfile',
                key: profile!.key,
              },
              located.routePosition.routeKey,
            );
        return Object.freeze({ optionKey: selectedOptionKey, reward });
      })();
  const purchaseSelected = occurrence.roomActions.order.some((reference) =>
    command.offer.offerKey === TRAVEL_DEAL_REFILL_ENTRY_KEY
      ? reference.kind === 'interactAcquisitionEntry' &&
        reference.siteKey === 'roomExit' &&
        reference.entryKey === command.offer.offerKey
      : reference.kind === 'interactShopOffer' && reference.offerKey === command.offer.offerKey,
  );
  const nextOccurrence = reconcileAcquisitionResolvedRewardEntry(
    catalog,
    replaceAuthoredShopOffer(occurrence, command.offer.offerKey, replacement),
    command.offer.offerKey,
    purchaseSelected,
    replacement.reward,
  );
  return updateOccurrenceTopology(document, located, replaceOccurrence(current, nextOccurrence));
}
