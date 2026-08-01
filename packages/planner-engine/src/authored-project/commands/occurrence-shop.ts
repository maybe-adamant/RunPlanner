import type { ProjectDocument } from '../model';

import { failCommand, requireOccurrence, requireTopology, type LocatedBiome } from './contract';
import { replaceOccurrence, updateOccurrenceTopology } from './occurrence-mutation';
import { sameOccurrenceValue } from './occurrence-leaf-value';
import type { ShopOccurrenceCommand } from './types';

export function applyShopOccurrenceCommand(
  document: ProjectDocument,
  located: LocatedBiome,
  command: ShopOccurrenceCommand,
): ProjectDocument {
  const current = requireTopology(located.plan, command);
  const address = command.kind === 'ReplaceShopOffer' ? command.offer : command.purchase;
  const occurrence = requireOccurrence(located.plan, address.occurrenceId, command);
  if (occurrence.state.kind !== 'shop' || occurrence.state.shop === undefined) {
    failCommand(command, `${occurrence.gameName} has no materialized shop inventory`);
  }
  const offer = occurrence.state.shop.offers[address.offerKey];
  if (offer === undefined) failCommand(command, `unknown shop offer ${address.offerKey}`);
  if (command.kind === 'SetShopPurchase' && typeof command.purchased !== 'boolean') {
    failCommand(command, 'purchased must be a boolean');
  }
  const replacement =
    command.kind === 'ReplaceShopOffer'
      ? Object.freeze({ ...offer, offer: command.value })
      : Object.freeze({ ...offer, purchased: command.purchased });
  if (sameOccurrenceValue(replacement, offer)) return document;
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
              [address.offerKey]: replacement,
            }),
          }),
        }),
      }),
    ),
  );
}
