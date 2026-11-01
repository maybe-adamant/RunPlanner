import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { offerIcon } from '@planner/ui/artwork/rewardIcon';
import { wellItemIcon } from '@planner/ui/artwork/roomArtwork';
import { hintProps } from '@planner/ui/controls/hint';

/**
 * How a row names its reward: `icon` shows the reward's icon alone (its name is
 * the hover hint and accessible name); `iconAndName` adds the name after it.
 */
const ROW_REWARD_NAMES: 'icon' | 'iconAndName' = 'icon';

/** A row's reward as its icon, with the full name as tooltip and accessible name. */
export function RowRewardName({
  boosted = false,
  itemKey,
  name,
  offer,
  origin,
}: {
  readonly boosted?: boolean;
  readonly itemKey?: string;
  readonly name: string;
  readonly offer: ResolvedRewardOffer;
  /** What produced the pickup; it joins the name in the one hint ("Gold · Created by Quick Buck"). */
  readonly origin?: string;
}) {
  const spoken = offer.payload?.kind === 'BoonSource' ? `${name} boon` : name;
  const hint = origin === undefined ? spoken : `${spoken} · ${origin}`;
  return (
    <span className="row-reward-name">
      <span
        {...hintProps(hint, undefined, spoken)}
        aria-label={spoken}
        // An origin is told by the icon's one hint, so the icon takes focus to show it.
        className={origin === undefined ? 'row-reward-icon' : 'row-reward-icon timeline-row-origin'}
        role="img"
        {...(origin === undefined ? {} : { tabIndex: 0 })}
      >
        <ArtworkIcon
          className="artwork-label-icon"
          source={itemKey === undefined ? offerIcon(offer) : wellItemIcon(itemKey)}
        />
        {boosted ? (
          <span aria-hidden="true" className="row-reward-boosted">
            ↑
          </span>
        ) : null}
      </span>
      {ROW_REWARD_NAMES === 'iconAndName' ? <span aria-hidden="true">{name}</span> : null}
    </span>
  );
}
