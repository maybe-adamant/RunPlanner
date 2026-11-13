import * as Popover from '@radix-ui/react-popover';
import type {
  WorkspaceInteractionCatalog,
  WorkspaceRoomActionRow,
} from '@planner/projections/structured-workspace';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { roomObjectIcon } from '@planner/ui/artwork/roomArtwork';
import { TimelineRow } from '../TimelineRow';
import { PurgingPoolSlots } from './RoomInventoryPanel';

/** The row's accessible name and the note its info button opens, saying why it follows the fountain use. */
const purgingPoolRefreshCopy = Object.freeze({
  label: 'Pool restocked',
  info: 'Phial changed the list · Pool restocked',
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
      // The row cannot be removed, so its removal slot says where it comes from instead.
      removal={
        <Popover.Root>
          <Popover.Trigger asChild>
            <button
              aria-label={`${purgingPoolRefreshCopy.label} info`}
              className="trait-offer-state-button"
              type="button"
            >
              i
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="end"
              aria-label={`${purgingPoolRefreshCopy.label} info`}
              className="trait-offer-state-popover editor-dialog-help"
              collisionPadding={12}
              side="bottom"
              sideOffset={6}
            >
              <p>{purgingPoolRefreshCopy.info}</p>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      }
      notice
    />
  );
}
