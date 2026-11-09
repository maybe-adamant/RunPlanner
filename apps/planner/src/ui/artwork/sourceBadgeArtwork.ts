import type { AcquisitionEntrySourceFamily } from '@run-planner/engine/authored-project';
import type { ChallengeSwitchKind } from '@run-planner/engine/catalog-schema';

import { challengeSwitchIcon, roomObjectIcon, sourceFamilyIcon } from './roomArtwork';

/**
 * The corner badge a derived pickup carries for what created it. A Travel Deal
 * restock is a purchase, marked on its store's icon instead.
 */
export function pickupSourceBadgeIcon(
  family: AcquisitionEntrySourceFamily | undefined,
  challengeSwitchKind?: ChallengeSwitchKind,
): string | undefined {
  switch (family?.kind) {
    case undefined:
    case 'shopTravelDealRefill':
      return undefined;
    case 'hermesShrineDelivery':
      return roomObjectIcon('hermesShrine');
    case 'challengeSwitch':
      return challengeSwitchKind === undefined
        ? roomObjectIcon('challengeSwitch')
        : challengeSwitchIcon(challengeSwitchKind);
    default:
      return sourceFamilyIcon(family);
  }
}
