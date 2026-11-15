import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import type { WorkspaceDevotionRole } from '@planner/projections/structured-workspace';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { offerIcon } from '@planner/ui/artwork/rewardIcon';
import { wellItemIcon } from '@planner/ui/artwork/roomArtwork';
import { hintProps } from '@planner/ui/controls/hint';

/**
 * How a row names its reward: `icon` shows the reward's icon alone (its name is
 * the hover hint and accessible name); `iconAndName` adds the name after it.
 */
const ROW_REWARD_NAMES: 'icon' | 'iconAndName' = 'icon';

const HEART =
  'M8 14.2 2.1 8.6C.4 6.9.5 4.3 2.3 2.9 3.9 1.7 6.2 2 7.4 3.6L8 4.3l.6-.7C9.8 2 12.1 1.7 13.7 2.9c1.8 1.4 1.9 4 .2 5.7Z';
/** The spurned god's crack, cut through the whole heart in the badge's own colour. */
const HEART_CRACK = 'M8.4 2.6 6.3 7l3 1.8-2.2 3.9';

/** A row's reward as its icon, with the full name as tooltip and accessible name. */
export function RowRewardName({
  boosted = false,
  devotionRole,
  itemKey,
  name,
  offer,
  origin,
  place,
  sourceBadge,
}: {
  readonly boosted?: boolean;
  /** A Trial god's side: a whole heart for the chosen god, a broken one for the spurned. */
  readonly devotionRole?: WorkspaceDevotionRole;
  readonly itemKey?: string;
  readonly name: string;
  readonly offer: ResolvedRewardOffer;
  /** What produced the pickup; it joins the name in the one hint ("Gold · Created by Quick Buck"). */
  readonly origin?: string;
  /** The Fields slot the reward sits in: its mark on the icon's corner, its name in the hint. */
  readonly place?: { readonly badge: string; readonly label: string };
  /** What created a derived pickup, as a badge on the icon's bottom corner. */
  readonly sourceBadge?: string;
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
        {sourceBadge === undefined ? null : (
          <img
            alt=""
            aria-hidden="true"
            className="corner-badge timeline-source-badge"
            src={sourceBadge}
          />
        )}
        {place === undefined ? null : (
          <span aria-hidden="true" className="corner-badge timeline-chip-badge">
            {place.badge}
          </span>
        )}
        {devotionRole === undefined ? null : (
          <span aria-hidden="true" className="corner-badge corner-badge-top row-reward-devotion">
            <svg viewBox="0 0 16 16">
              <path d={HEART} />
              {devotionRole === 'spurned' ? (
                <path className="row-reward-devotion-crack" d={HEART_CRACK} />
              ) : null}
            </svg>
          </span>
        )}
        {boosted ? (
          <span aria-hidden="true" className="corner-badge corner-badge-top row-reward-boosted">
            ↑
          </span>
        ) : null}
      </span>
      {ROW_REWARD_NAMES === 'iconAndName' ? <span aria-hidden="true">{name}</span> : null}
    </span>
  );
}
