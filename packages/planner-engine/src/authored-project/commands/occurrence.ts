import type { Catalog } from '../../catalog-schema';
import type { ProjectDocument } from '../model';

import type { LocatedBiome } from './contract';
import { applyEncounterOccurrenceCommand } from './occurrence-encounter';
import { applyIncomingRewardCommand } from './occurrence-incoming-reward';
import { applyLocalRewardCommand } from './occurrence-local-reward';
import { applyShipOccurrenceCommand } from './occurrence-ship';
import { applyShopOccurrenceCommand } from './occurrence-shop';
import { applyFieldsOccurrenceCommand } from './occurrence-fields';
import type { OccurrenceLeafCommand } from './types';

export function applyOccurrenceCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: OccurrenceLeafCommand,
): ProjectDocument {
  switch (command.kind) {
    case 'ReplaceFieldsOptionalRewardCount':
      return applyFieldsOccurrenceCommand(document, catalog, located, command);
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
    case 'ReplaceShopOffer':
    case 'ReplaceShopDeathDefianceCondition':
      return applyShopOccurrenceCommand(document, catalog, located, command);
    case 'SelectEncounter':
    case 'ResetEncounter':
    case 'ReplaceNemesisRandomEventOutcome':
    case 'ReplaceFigLeafSkip':
    case 'ReplaceGorgonDeathDefianceCondition':
      return applyEncounterOccurrenceCommand(document, catalog, located, command);
  }
}
