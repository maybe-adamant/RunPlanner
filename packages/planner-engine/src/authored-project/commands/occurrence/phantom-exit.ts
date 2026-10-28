import type { Catalog } from '../../../catalog-schema';
import type { ProjectDocument } from '../../model';
import { phantomExitDomainError } from '../../phantom-exit';
import {
  failCommand,
  requireOccurrence,
  requireRoom,
  requireTopology,
  type LocatedBiome,
} from '../contract';
import type { PhantomExitCommand } from '../types';
import { replaceOccurrence, updateOccurrenceTopology } from './mutation';

/** Pins or unpins an occurrence's phantom exit; a null field is engine-settled. */
export function applyPhantomExitCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: PhantomExitCommand,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const occurrence = requireOccurrence(located.plan, command.exit.occurrenceId, command);
  const current = occurrence.phantomExit;
  if (current === undefined) failCommand(command, `${occurrence.gameName} has no phantom exit`);
  const room = requireRoom(catalog, occurrence.gameName, located.layout.biomeKey, command);
  const error = phantomExitDomainError(catalog, room, command.value);
  if (error !== undefined) failCommand(command, error);
  if (
    current.placeholderRoomGameName === command.value.placeholderRoomGameName &&
    current.rewardType === command.value.rewardType
  )
    return document;
  return updateOccurrenceTopology(
    document,
    located,
    replaceOccurrence(
      topology,
      Object.freeze({
        ...occurrence,
        phantomExit: Object.freeze({
          placeholderRoomGameName: command.value.placeholderRoomGameName,
          rewardType: command.value.rewardType,
        }),
      }),
    ),
  );
}
