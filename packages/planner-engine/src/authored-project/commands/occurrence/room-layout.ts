import type { Catalog } from '../../../catalog-schema';
import type { ProjectDocument } from '../../model';
import {
  roomAnchorObjectLeaf,
  roomLayoutIssue,
  roomObjectAnchorIds,
  withRoomLayout,
  withRoomObjectAnchor,
} from '../../room-layout';
import { failCommand, requireOccurrence, type LocatedBiome } from '../contract';
import type { RoomLayoutCommand } from '../types';
import { updateOccurrence } from './mutation';

/**
 * Structural edits of a room's layout and its objects' anchors. Only the
 * static domain is refused; whether a value is possible where the room is
 * entered is a finding.
 */
export function applyRoomLayoutCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: RoomLayoutCommand,
): ProjectDocument {
  const occurrence = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
  const room = catalog.rooms.byKey[occurrence.gameName];
  if (room === undefined) failCommand(command, `unknown room ${occurrence.gameName}`);
  if (command.kind === 'ReplaceRoomLayout') {
    const layout = command.layout;
    const empty = layout.flipped === undefined && layout.entryStartPointId === undefined;
    if (!empty) {
      const issue = roomLayoutIssue(room, layout);
      if (issue !== undefined) failCommand(command, issue);
    }
    const current = occurrence.layout;
    if (
      current?.flipped === layout.flipped &&
      current?.entryStartPointId === layout.entryStartPointId
    )
      return document;
    return updateOccurrence(document, located, withRoomLayout(occurrence, layout));
  }
  const leaf = roomAnchorObjectLeaf(occurrence, command.object);
  if (leaf === undefined) failCommand(command, `${occurrence.gameName} holds no ${command.object}`);
  if (command.anchorId !== null && !roomObjectAnchorIds(room).includes(command.anchorId))
    failCommand(command, `${command.anchorId} is not a ChallengeSwitchBase of ${room.gameName}`);
  const anchorId = command.anchorId ?? undefined;
  if (leaf.anchorId === anchorId) return document;
  return updateOccurrence(
    document,
    located,
    withRoomObjectAnchor(occurrence, command.object, anchorId),
  );
}
