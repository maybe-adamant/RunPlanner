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
  place,
}: {
  readonly boosted?: boolean;
  readonly itemKey?: string;
  readonly name: string;
  readonly offer: ResolvedRewardOffer;
  /** What produced the pickup; it joins the name in the one hint ("Gold · Created by Quick Buck"). */
  readonly origin?: string;
  /** The Fields slot the reward sits in: its mark on the icon's corner, its name in the hint. */
  readonly place?: { readonly badge: string; readonly label: string };
}) {
  const spoken = offer.payload?.kind === 'BoonSource' ? `${name} boon` : name;
  const named = place === undefined ? spoken : `${spoken} · ${place.label}`;
  const hint = origin === undefined ? named : `${named} · ${origin}`;
  return (
    <span className="row-reward-name">
      <span
        {...hintProps(hint, undefined, named)}
        aria-label={named}
        // An origin is told by the icon's one hint, so the icon takes focus to show it.
        className={origin === undefined ? 'row-reward-icon' : 'row-reward-icon timeline-row-origin'}
        role="img"
        {...(origin === undefined ? {} : { tabIndex: 0 })}
      >
        <ArtworkIcon
          className="artwork-label-icon"
          source={itemKey === undefined ? offerIcon(offer) : wellItemIcon(itemKey)}
        />
        {place === undefined ? null : (
          <span aria-hidden="true" className="timeline-chip-badge">
            {place.badge}
          </span>
        )}
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
