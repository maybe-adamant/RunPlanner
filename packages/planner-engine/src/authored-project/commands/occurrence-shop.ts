import type { Catalog } from '../../catalog-schema';
import type { ProjectDocument } from '../model';

import { failCommand, requireOccurrence, requireTopology, type LocatedBiome } from './contract';
import { replaceOccurrence, updateOccurrenceTopology } from './occurrence-mutation';
import { sameOccurrenceValue } from './occurrence-leaf-value';
import type { ShopOccurrenceCommand } from './types';
import { createDefaultLevelResolutions, createDefaultTraitOffers } from '../traits';
import { createEchoShopDuplicateEntryKey, shopProfileUsesDeathDefianceCondition } from '../shop';
import { createDefaultConversionByAcquisitionRole } from '../reward-state';

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
  if (command.kind === 'ReplaceShopDeathDefianceCondition') {
    if (!shopProfileUsesDeathDefianceCondition(catalog, occurrence.state.shop.profileKey)) {
      failCommand(command, 'Shop does not own Death Defiance condition');
    }
    if (typeof command.value !== 'boolean') failCommand(command, 'condition must be boolean');
    if (occurrence.state.shop.deathDefianceConditionMet === command.value) return document;
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
              deathDefianceConditionMet: command.value,
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
      conversionByAcquisitionRole: createDefaultConversionByAcquisitionRole(catalog, command.value),
      traitOffersByAcquisitionRole: createDefaultTraitOffers(
        catalog,
        command.value,
        located.loadout,
      ),
      ...(createDefaultLevelResolutions(catalog, command.value, {
        kind: 'shopProfile',
        key: occurrence.state.shop.profileKey,
      }) === undefined
        ? {}
        : {
            levelResolutionsByAcquisitionRole: createDefaultLevelResolutions(
              catalog,
              command.value,
              { kind: 'shopProfile', key: occurrence.state.shop.profileKey },
            ),
          }),
    }),
  });
  const duplicateKey = createEchoShopDuplicateEntryKey(command.offer.offerKey);
  const pickupEntries = occurrence.acquisitionSites?.roomExit?.pickupEntries;
  const { [duplicateKey]: removedDuplicate, ...remainingPickupEntries } = pickupEntries ?? {};
  const { pickupEntries: priorPickupEntries, ...roomExitWithoutPickups } = occurrence
    .acquisitionSites?.roomExit ?? { order: Object.freeze([]) };
  void removedDuplicate;
  void priorPickupEntries;
  return updateOccurrenceTopology(
    document,
    located,
    replaceOccurrence(
      current,
      Object.freeze({
        ...occurrence,
        ...(occurrence.acquisitionSites?.roomExit === undefined
          ? {}
          : {
              acquisitionSites: Object.freeze({
                ...(occurrence.acquisitionSites ?? {}),
                roomExit: Object.freeze({
                  ...roomExitWithoutPickups,
                  ...(Object.keys(remainingPickupEntries).length === 0
                    ? {}
                    : { pickupEntries: Object.freeze(remainingPickupEntries) }),
                }),
              }),
            }),
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
