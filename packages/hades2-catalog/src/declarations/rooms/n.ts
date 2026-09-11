import type { RawRoomDeclaration } from './types';
import { nCompletionRooms } from './n-completion';
import { nFixedRouteRooms } from './n-fixed';
import { nHubMainRooms } from './n-hub-main';
import { nSideRooms } from './n-side';

/** Declaration order follows the fixed approach, Ephyra hub, side-room, and completion route. */
export const nRooms = [
  ...nFixedRouteRooms,
  ...nHubMainRooms,
  ...nSideRooms,
  ...nCompletionRooms,
] satisfies readonly RawRoomDeclaration[];
