import type { RoomDeclaration } from '../../catalog-schema';
import type { RoomOccurrence } from '../model';

/**
 * The lifecycle the room declares, settled by the occurrence's state where the
 * declaration names two: a Clockwork room without a reward runs its goal, and
 * a Preboss room its shop or free reward. An Ephyra local visit runs the
 * room's local-visit lifecycle.
 */
export function roomLifecycleProfileKey(
  declaration: RoomDeclaration,
  occurrence: RoomOccurrence,
  role: 'ordinary' | 'localVisit' = 'ordinary',
): string {
  if (role === 'localVisit') {
    if (declaration.localVisitLifecycleProfileKey === undefined)
      throw new Error(`${declaration.gameName} declares no local-visit lifecycle`);
    return declaration.localVisitLifecycleProfileKey;
  }
  const selection = declaration.lifecycleProfile;
  switch (selection.kind) {
    case 'fixed':
      return selection.profileKey;
    case 'clockworkGoal':
      return occurrence.state.kind === 'counted' && occurrence.state.reward === null
        ? selection.goalProfileKey
        : selection.rewardProfileKey;
    case 'prebossOffer':
      return occurrence.state.kind === 'shop'
        ? selection.shopProfileKey
        : selection.freeRewardProfileKey;
  }
}
