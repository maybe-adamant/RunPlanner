import type {
  WorkspaceInteractionCatalog,
  WorkspaceRoomActionRow,
} from '@planner/projections/structured-workspace';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { roomObjectIcon } from '@planner/ui/artwork/roomArtwork';
import { hintProps } from '@planner/ui/controls/hint';
import { TimelineRow } from '../TimelineRow';
import { PurgingPoolSlots } from './RoomInventoryPanel';

/** The row's accessible name and its hover hint saying why it follows the fountain use. */
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
      {...hintProps(purgingPoolRefreshCopy.hint, undefined, purgingPoolRefreshCopy.label)}
      aria-label={purgingPoolRefreshCopy.label}
      data-pool-refresh=""
      kind="action"
      label={
        <span aria-hidden="true" className="timeline-row-icon">
          <ArtworkIcon className="artwork-label-icon" source={roomObjectIcon('purgingPool')} />
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
