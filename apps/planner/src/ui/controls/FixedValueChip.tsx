import { ArtworkIcon, type ArtworkSource } from '@planner/ui/artwork/ArtworkIcon';
import { showTruncatedTitle } from './truncatedTitle';

/** A read-only value in a row: its icon, then its name, cut off with its full text on hover. */
export function FixedValueChip({
  badge,
  icon,
  id,
  label,
  textId,
}: {
  /** A mark on the icon's corner, such as a room's number. */
  readonly badge?: string | undefined;
  readonly icon?: ArtworkSource | undefined;
  readonly id?: string;
  readonly label: string;
  /** Lets an enclosing control name itself after the value. */
  readonly textId?: string;
}) {
  return (
    <span className="fixed-value-chip" {...(id === undefined ? {} : { id, tabIndex: -1 })}>
      {icon === undefined ? null : badge === undefined ? (
        <ArtworkIcon className="fixed-value-chip-icon" source={icon} />
      ) : (
        <span className="fixed-value-chip-badged">
          <ArtworkIcon className="fixed-value-chip-icon" source={icon} />
          <span aria-hidden="true" className="corner-badge timeline-chip-badge">
            {badge}
          </span>
        </span>
      )}
      <span
        className="fixed-value-chip-text"
        {...(textId === undefined ? {} : { id: textId })}
        onMouseEnter={showTruncatedTitle}
      >
        {label}
      </span>
    </span>
  );
}
