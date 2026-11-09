import type { AcquisitionEntrySourceFamily } from '@run-planner/engine/authored-project';
import type { ChallengeSwitchKind } from '@run-planner/engine/catalog-schema';

import { npcBoonArtwork } from './npc-boons/npcBoonArtwork';
import artificerBadge from './source-badges/assets/ArtificerBadge.webp';
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
    // Echo's loot is marked by the boon that made it: Reward Reward Reward or Gold Gold Gold.
    case 'echo':
      return (
        npcBoonArtwork[family.effect === 'lastReward' ? 'EchoLastReward' : 'EchoDoubleShop'] ??
        sourceFamilyIcon(family)
      );
    // The Artificer's art is a tall Arcana card; its badge is a square crop of the hammer.
    case 'artificer':
      return artificerBadge;
    case 'hermesShrineDelivery':
      return roomObjectIcon('hermesShrine');
    case 'challengeSwitch':
      return challengeSwitchKind === undefined
        ? undefined
        : challengeSwitchIcon(challengeSwitchKind);
    default:
      return sourceFamilyIcon(family);
  }
}
