import type {
  WorkspaceInteractionCatalog,
  WorkspaceRoomActionRow,
} from '@planner/projections/structured-workspace';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { roomObjectIcon } from '@planner/ui/artwork/roomArtwork';
import { hintProps } from '@planner/ui/controls/hint';
import { TimelineRow } from '../TimelineRow';
import { PurgingPoolSlots } from './RoomInventoryPanel';

/** The row's name and the one hint saying why it follows the fountain use. */
const purgingPoolRefreshCopy = Object.freeze({
  label: 'Pool restocked',
  hint: 'Phial changed the list · Pool restocked',
});

/**
 * The list the Pool regenerates after the fountain use, on its own row right
 * after it: edited like the Overview's Pool, and moved only with its fountain.
 */
export function PurgingPoolRefreshRow({
  interactions,
  refresh,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly refresh: NonNullable<WorkspaceRoomActionRow['purgingPoolRefresh']>;
}) {
  return (
    <TimelineRow
      data-pool-refresh=""
      kind="action"
      label={
        <span
          {...hintProps(purgingPoolRefreshCopy.hint)}
          aria-label={purgingPoolRefreshCopy.label}
          className="timeline-row-origin"
          role="group"
          tabIndex={0}
        >
          <span className="timeline-row-icon">
            <ArtworkIcon className="artwork-label-icon" source={roomObjectIcon('purgingPool')} />
          </span>
          <strong>{purgingPoolRefreshCopy.label}</strong>
        </span>
      }
      editors={
        <PurgingPoolSlots
          interactions={interactions}
          label={purgingPoolRefreshCopy.label}
          slots={refresh.slots}
        />
      }
      notice
    />
  );
}
