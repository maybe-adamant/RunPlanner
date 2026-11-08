import type {
  WorkspaceRoomActionRow,
  WorkspaceSpawnedItem,
} from '@planner/projections/structured-workspace';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { sourceFamilyIcon } from '@planner/ui/artwork/roomArtwork';
import { hintProps } from '@planner/ui/controls/hint';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { roomActionItemIcon } from './roomActionItemIcon';
import { TimelineRow } from './TimelineRow';

/** Brings a collect action's Timeline row into view and focuses it. */
function focusActionRow(from: HTMLElement, actionKey: string): void {
  const selector = `[data-room-action-key="${CSS.escape(actionKey)}"]`;
  const row =
    from.closest('.room-actions-workbench')?.querySelector<HTMLElement>(selector) ??
    from.ownerDocument.querySelector<HTMLElement>(selector);
  if (row === null) return;
  row.focus({ preventScroll: true });
  row.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
}

function SpawnedItemChip({
  item,
  row,
}: {
  readonly item: WorkspaceSpawnedItem;
  readonly row: WorkspaceRoomActionRow | undefined;
}) {
  const executeIntent = useCommandIntent();
  const placement = item.placement;
  const name = item.place === undefined ? item.label : `${item.label} · ${item.place.label}`;
  const unavailable = placement.kind === 'unavailable' ? placement.reason : undefined;
  return (
    <button
      {...hintProps(unavailable === undefined ? name : `${name}: ${unavailable}`, undefined, name)}
      aria-disabled={unavailable === undefined ? undefined : true}
      aria-label={name}
      className="timeline-chip"
      data-spawn-participation={item.participation}
      data-spawn-placed={placement.kind === 'placed' || undefined}
      onClick={(event) => {
        if (placement.kind === 'placed') focusActionRow(event.currentTarget, item.actionKey);
        else if (placement.kind === 'unplaced') executeIntent(placement.intent);
      }}
      type="button"
    >
      <ArtworkIcon
        className="artwork-label-icon"
        source={
          row === undefined
            ? undefined
            : (roomActionItemIcon(row) ?? sourceFamilyIcon(row.sourceFamily))
        }
      />
      {item.place === undefined ? null : (
        <span aria-hidden="true" className="timeline-chip-badge">
          {item.place.badge}
        </span>
      )}
    </button>
  );
}

/** Read-only: what the game spawned, its items as chips in spawn order. */
export function SpawnedLootRow({
  items,
  label,
  rows,
  source,
}: {
  readonly items: readonly WorkspaceSpawnedItem[];
  readonly label: string;
  readonly rows: readonly WorkspaceRoomActionRow[];
  /** Spawned by its source action's settlement, under that action's row. */
  readonly source?: true;
}) {
  return (
    <TimelineRow
      aria-label={label}
      data-spawned-loot={source ? 'action' : 'moment'}
      editors={
        <span className="timeline-chip-group">
          {items.map((item) => (
            <SpawnedItemChip
              item={item}
              key={item.key}
              row={rows.find((candidate) => candidate.key === item.actionKey)}
            />
          ))}
        </span>
      }
      kind="continuation"
      label={<strong className="spawned-loot-label">{label}</strong>}
    />
  );
}
