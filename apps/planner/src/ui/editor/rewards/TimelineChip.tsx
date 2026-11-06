import type { WorkspaceTimelineChip } from '@planner/projections/structured-workspace';
import { ArtworkIcon, type ArtworkSource } from '@planner/ui/artwork/ArtworkIcon';
import { hintProps } from '@planner/ui/controls/hint';
import { traitIcon } from '@planner/ui/artwork/traitArtwork';

import { timelineChipProps } from './timelineChipProps';

/** The chip's icon and its count badge. */
export function TimelineChipFace({ chip }: { readonly chip: WorkspaceTimelineChip }) {
  return (
    <>
      <ArtworkIcon className="artwork-label-icon" source={traitIcon(chip.icon)} />
      {chip.badge === undefined ? null : (
        <span aria-hidden="true" className="timeline-chip-badge">
          {chip.badge}
        </span>
      )}
    </>
  );
}

/** A chip that only shows its object. */
export function TimelineChip({ chip }: { readonly chip: WorkspaceTimelineChip }) {
  return (
    <span role="img" {...timelineChipProps(chip)}>
      <TimelineChipFace chip={chip} />
    </span>
  );
}

/** A chip that only shows an object drawn by its own artwork, its name on hover. */
export function ArtworkChip({
  icon,
  label,
}: {
  readonly icon: ArtworkSource | undefined;
  readonly label: string;
}) {
  return (
    <span
      {...hintProps(label, undefined, label)}
      aria-label={label}
      className="timeline-chip"
      data-chip-state="shown"
      role="img"
    >
      <ArtworkIcon className="artwork-label-icon" source={icon} />
    </span>
  );
}
