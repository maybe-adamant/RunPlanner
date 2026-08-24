import type { Catalog } from '../../catalog-schema';
import type { ProjectDocument } from '../model';

import { failCommand, requireOccurrence, requireTopology, type LocatedBiome } from './contract';
import { replaceOccurrence, updateOccurrenceTopology } from './occurrence-mutation';
import { sameOccurrenceValue } from './occurrence-leaf-value';
import type { ShopOccurrenceCommand } from './types';
import { createUnresolvedAcquisitionRewardState } from '../traits';
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
  if (offer.reward !== null && sameOccurrenceValue(offer.reward.offer, command.value))
    return document;
  const replacement = Object.freeze({
    reward: createUnresolvedAcquisitionRewardState(catalog, command.value, {
      kind: 'shopProfile',
      key: occurrence.state.shop.profileKey,
    }),
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
