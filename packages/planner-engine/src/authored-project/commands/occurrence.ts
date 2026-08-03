import type { Catalog } from '../../catalog-schema';
import type { ProjectDocument } from '../model';

import type { LocatedBiome } from './contract';
import { applyEphyraOccurrenceCommand } from './occurrence-ephyra';
import { applyIncomingRewardCommand } from './occurrence-incoming-reward';
import { applyLocalRewardCommand } from './occurrence-local-reward';
import { applyShipOccurrenceCommand } from './occurrence-ship';
import { applyShopOccurrenceCommand } from './occurrence-shop';
import type { OccurrenceLeafCommand } from './types';

export function applyOccurrenceCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: OccurrenceLeafCommand,
): ProjectDocument {
  switch (command.kind) {
    case 'ReplaceIncomingReward':
      return applyIncomingRewardCommand(document, catalog, located, command);
    case 'ReplaceLocalReward':
      return applyLocalRewardCommand(document, catalog, located, command);
    case 'ReplaceShipEncounterCount':
    case 'ReplaceRewardWheelOfferCount':
    case 'ReplaceRewardWheelStore':
    case 'ReplaceRewardWheelOffer':
    case 'ReplaceRewardWheelPicked':
      return applyShipOccurrenceCommand(document, catalog, located, command);
    case 'ReplaceSideRoomGeneration':
    case 'ReplaceSideRoomEntryOrder':
      return applyEphyraOccurrenceCommand(document, catalog, located, command);
    case 'ReplaceShopOffer':
    case 'ReplaceShopPurchaseOrder':
      return applyShopOccurrenceCommand(document, located, command);
  }
}
