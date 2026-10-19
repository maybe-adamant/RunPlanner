import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';

import type { ArtworkSource } from './ArtworkIcon';
import { rewardArtwork } from './rewards/rewardArtwork';
import { wellArtwork } from './well/wellArtwork';

/** A reward type's icon; undefined renders a blank slot. */
export function rewardIcon(rewardType: string): string | undefined {
  return rewardArtwork[rewardType] ?? undefined;
}

/** A resolved offer shows its Boon's god, its Trial's two gods, or its reward type. */
export function offerIcon(offer: ResolvedRewardOffer): ArtworkSource | undefined {
  const payload = offer.payload;
  if (payload?.kind === 'BoonSource') return rewardIcon(payload.source);
  if (payload?.kind === 'DevotionPair')
    return [rewardIcon(payload.chosenSource), rewardIcon(payload.spurnedSource)];
  return rewardIcon(offer.rewardType);
}

/** A shop item shows its Well item icon, else the offer it sells. */
export function shopItemIcon(
  optionKey: string,
  offer: ResolvedRewardOffer,
): ArtworkSource | undefined {
  return wellArtwork[optionKey] ?? offerIcon(offer);
}
