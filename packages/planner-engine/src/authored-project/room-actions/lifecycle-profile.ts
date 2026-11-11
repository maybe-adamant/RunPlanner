import type { RoomDeclaration } from '../../catalog-schema';
import type { RoomOccurrence } from '../model';

/**
 * The role a room is entered in: an ordinary room (a Hub's board room among
 * them), an Ephyra Hub board target, or a Hub side room's local visit.
 */
export type RoomLifecycleRole = 'ordinary' | 'hubTarget' | 'localVisit';

/**
 * The lifecycle the room runs: its declared lifecycle for its role, a Preboss
 * room settling it by occurrence state as its shop or free reward. Whether the
 * room's reward runs a producer follows from the reward, never from this
 * choice.
 */
export function roomLifecycleProfileKey(
  declaration: RoomDeclaration,
  role: RoomLifecycleRole,
  occurrence?: Pick<RoomOccurrence, 'state'>,
): string {
  if (role !== 'ordinary') {
    const key = declaration.roleLifecycleProfileKeys?.[role];
    if (key === undefined) throw new Error(`${declaration.gameName} declares no ${role} lifecycle`);
    return key;
  }
  const selection = declaration.lifecycleProfile;
  switch (selection.kind) {
    case 'fixed':
      return selection.profileKey;
    case 'prebossOffer':
      if (occurrence === undefined)
        throw new Error(`${declaration.gameName} chooses its lifecycle by occurrence state`);
      return occurrence.state.kind === 'shop'
        ? selection.shopProfileKey
        : selection.freeRewardProfileKey;
  }
}
