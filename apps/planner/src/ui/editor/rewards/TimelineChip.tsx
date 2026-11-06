import type { WorkspaceTimelineChip } from '@planner/projections/structured-workspace';
import { ArtworkIcon, type ArtworkSource } from '@planner/ui/artwork/ArtworkIcon';
import { traitIcon } from '@planner/ui/artwork/traitArtwork';

import { timelineChipProps } from './timelineChipProps';

function chipArtwork(icon: WorkspaceTimelineChip['icon']): ArtworkSource | undefined {
  return typeof icon === 'string'
    ? traitIcon(icon)
    : [
        icon[0] === undefined ? undefined : traitIcon(icon[0]),
        icon[1] === undefined ? undefined : traitIcon(icon[1]),
      ];
}

/** The chip's icon and its count badge. */
export function TimelineChipFace({ chip }: { readonly chip: WorkspaceTimelineChip }) {
  return (
    <>
      <ArtworkIcon className="artwork-label-icon" source={chipArtwork(chip.icon)} />
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
