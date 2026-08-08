import type { Catalog } from '../../catalog-schema';
import type { ProjectDocument } from '../model';

import { failCommand, requireOccurrence, requireTopology, type LocatedBiome } from './contract';
import { replaceOccurrence, updateOccurrenceTopology } from './occurrence-mutation';
import { sameOccurrenceValue } from './occurrence-leaf-value';
import type { ShopOccurrenceCommand } from './types';
import { createDefaultTraitOffers } from '../traits';

export function applyShopOccurrenceCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: ShopOccurrenceCommand,
): ProjectDocument {
  const current = requireTopology(located.plan, command);
  const occurrence = requireOccurrence(
    located.plan,
    command.kind === 'ReplaceShopOffer' ? command.offer.occurrenceId : command.shop.occurrenceId,
    command,
  );
  if (occurrence.state.kind !== 'shop' || occurrence.state.shop === undefined) {
    failCommand(command, `${occurrence.gameName} has no materialized shop inventory`);
  }
  if (command.kind === 'ReplaceShopPurchaseOrder') {
    if (
      !Array.isArray(command.offerKeys) ||
      !command.offerKeys.every((key) => typeof key === 'string')
    ) {
      failCommand(command, 'offerKeys must be an array of Shop offer keys');
    }
    const seen = new Set<string>();
    for (const offerKey of command.offerKeys) {
      if (occurrence.state.shop.offers[offerKey] === undefined) {
        failCommand(command, `unknown shop offer ${offerKey}`);
      }
      if (seen.has(offerKey)) failCommand(command, `shop offer ${offerKey} is duplicated`);
      seen.add(offerKey);
    }
    if (sameOccurrenceValue(command.offerKeys, occurrence.state.shop.purchaseOrder))
      return document;
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
              purchaseOrder: Object.freeze([...command.offerKeys]),
            }),
          }),
        }),
      ),
    );
  }
  const offer = occurrence.state.shop.offers[command.offer.offerKey];
  if (offer === undefined) failCommand(command, `unknown shop offer ${command.offer.offerKey}`);
  if (sameOccurrenceValue(offer.reward.offer, command.value)) return document;
  const replacement = Object.freeze({
    reward: Object.freeze({
      offer: command.value,
      traitOffersByAcquisitionRole: createDefaultTraitOffers(
        catalog,
        command.value,
        located.loadout,
      ),
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
