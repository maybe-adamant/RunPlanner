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
import { requireOccurrence, failCommand } from './contract';
import { updateOccurrence } from './occurrence-mutation';

export function applyOccurrenceCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: OccurrenceLeafCommand,
): ProjectDocument {
  switch (command.kind) {
    case 'SetPurgingPoolInteraction': {
      const occurrence = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
      if (occurrence.purgingPool === undefined)
        failCommand(command, 'occurrence has no Purging Pool');
      const roomActions = command.interacted
        ? occurrence.roomActions
        : Object.freeze({
            ...occurrence.roomActions,
            order: Object.freeze(
              occurrence.roomActions.order.filter(
                (reference) => reference.kind !== 'sellPurgingPoolTrait',
              ),
            ),
          });
      return updateOccurrence(
        document,
        located,
        Object.freeze({
          ...occurrence,
          roomActions,
          purgingPool: Object.freeze({ ...occurrence.purgingPool, interacted: command.interacted }),
        }),
      );
    }
    case 'ReplacePurgingPoolSlot': {
      const occurrence = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
      if (occurrence.purgingPool === undefined)
        failCommand(command, 'occurrence has no Purging Pool');
      if (!occurrence.purgingPool.interacted)
        failCommand(command, 'Purging Pool is not being interacted with');
      if (command.slotKey !== 'left' && command.slotKey !== 'middle' && command.slotKey !== 'right')
        failCommand(command, `unknown Purging Pool slot ${String(command.slotKey)}`);
      if (command.traitKey !== null && catalog.traits.byKey[command.traitKey] === undefined)
        failCommand(command, 'unknown trait');
      return updateOccurrence(
        document,
        located,
        Object.freeze({
          ...occurrence,
          purgingPool: Object.freeze({
            ...occurrence.purgingPool,
            traitKeyBySlot: Object.freeze({
              ...occurrence.purgingPool.traitKeyBySlot,
              [command.slotKey]: command.traitKey,
            }),
          }),
        }),
      );
    }
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
      return applyShopOccurrenceCommand(document, catalog, located, command);
    case 'SelectEncounter':
    case 'ResetEncounter':
    case 'ReplaceNemesisRandomEventOutcome':
    case 'ReplaceFigLeafSkip':
    case 'ReplaceGorgonDeathDefianceCondition':
      return applyEncounterOccurrenceCommand(document, catalog, located, command);
  }
}
