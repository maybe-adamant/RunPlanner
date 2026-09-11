import type { RawRoomDeclaration } from '../types';
import { nCompletionRooms } from './completion';
import { nFixedRouteRooms } from './fixed';
import { nHubMainRooms } from './hub-main';
import { nSideRooms } from './side';

/** Declaration order follows the fixed approach, Ephyra hub, side-room, and completion route. */
export const nRooms = [
  ...nFixedRouteRooms,
  ...nHubMainRooms,
  ...nSideRooms,
  ...nCompletionRooms,
] satisfies readonly RawRoomDeclaration[];
