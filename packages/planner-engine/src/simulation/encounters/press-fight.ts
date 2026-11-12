import type { Catalog } from '../../catalog-schema';
import type { RoomPressFight } from '../../authored-project/room-actions/event-graph';
import type { ResolvedRoutePosition } from '../../authored-project/route-context';
import type { EncounterEntryVowRanks } from '../arcana-fear';
import type { HistoryStateView } from '../history/model';
import type { CanonicalAuthoredRoom } from '../materialization';
import { prepareChallengeSwitchEncounter } from './challenge-switch';
import { prepareUnlockExitEncounter } from './unlock-exit';

/**
 * Prepares a press fight at the view its script generates it at: the room's
 * entry for a switch, the press for a locked door.
 */
export function preparePressFight(
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
  routePosition: ResolvedRoutePosition,
  fight: RoomPressFight,
  view: HistoryStateView,
  ranks?: EncounterEntryVowRanks,
) {
  switch (fight.press.kind) {
    case 'interactChallengeSwitch':
      return prepareChallengeSwitchEncounter(catalog, room, routePosition, view, ranks);
    case 'unlockExit':
      return prepareUnlockExitEncounter(catalog, room, routePosition, fight.press, view, ranks);
    default:
      throw new Error(`${room.gameName} ${fight.phaseKey} has no press fight preparation`);
  }
}
