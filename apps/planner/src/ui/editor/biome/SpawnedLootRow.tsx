import { Fragment } from 'react';

import type {
  WorkspaceRoomActionRow,
  WorkspaceSpawnCopy,
  WorkspaceSpawnGroup,
  WorkspaceSpawnSource,
  WorkspaceSpawnedItem,
} from '@planner/projections/structured-workspace';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { roomActionIcon, sourceFamilyIcon } from '@planner/ui/artwork/roomArtwork';
import { offerIcon } from '@planner/ui/artwork/rewardIcon';
import { pickupSourceBadgeIcon } from '@planner/ui/artwork/sourceBadgeArtwork';
import { IconToggleLock } from '@planner/ui/controls/IconToggle';
import { TimelineRow } from './TimelineRow';
import { actionRowElement, focusActionRow } from './placedRow';

function SpawnedItemChip({
  copy,
  item,
  row,
  source,
}: {
  /** A copy's chip shows its source and the doubled count instead of the item. */
  readonly copy?: WorkspaceSpawnSource;
  readonly item: WorkspaceSpawnedItem;
  readonly row: WorkspaceRoomActionRow | undefined;
  /** What created the item, as a badge on the chip's bottom corner. */
  readonly source?: WorkspaceSpawnSource | undefined;
}) {
  const shown =
    copy !== undefined
      ? `${copy.name} copy of ${item.label}`
      : item.place === undefined
        ? item.label
        : `${item.label} · ${item.place.label}`;
  // The lock badge is drawn only; its name says it.
  const name = item.locked ? `${shown}, locked` : shown;
  const sourceBadge =
    source === undefined
      ? undefined
      : pickupSourceBadgeIcon(source.family, source.challengeSwitchKind);
  const face = (
    <>
      <ArtworkIcon
        className="artwork-label-icon"
        source={
          copy !== undefined
            ? sourceFamilyIcon(copy.family)
            : item.reward !== undefined
              ? offerIcon(item.reward.offer)
              : row === undefined
                ? undefined
                : (roomActionIcon(
                    row.reference,
                    row.address.biomeKey,
                    row.sourceFamily,
                    row.challengeSwitchKind,
                  ) ?? sourceFamilyIcon(row.sourceFamily, row.challengeSwitchKind))
        }
      />
      {copy === undefined ? null : (
        <span aria-hidden="true" className="spawn-copy-count">
          ×2
        </span>
      )}
      {sourceBadge === undefined ? null : (
        <img
          alt=""
          aria-hidden="true"
          className="corner-badge timeline-source-badge"
          src={sourceBadge}
        />
      )}
      {item.place === undefined ? null : (
        <span aria-hidden="true" className="corner-badge timeline-chip-badge">
          {item.place.badge}
        </span>
      )}
      {item.locked ? <IconToggleLock /> : null}
    </>
  );
  const className = copy === undefined ? 'timeline-chip' : 'timeline-chip spawn-copy-chip';
  // Still on the ground, it is taken from the live row.
  if (!item.placed)
    return (
      <span
        aria-label={name}
        className={className}
        data-spawn-locked={item.locked}
        data-spawn-participation={item.participation}
        role="img"
      >
        {face}
      </span>
    );
  return (
    <button
      aria-label={name}
      className={className}
      data-spawn-locked={item.locked}
      data-spawn-participation={item.participation}
      data-spawn-placed
      onClick={(event) => {
        const placed = actionRowElement(event.currentTarget, item.actionKey);
        if (placed !== null) focusActionRow(placed);
      }}
      type="button"
    >
      {face}
    </button>
  );
}

function SpawnGroup({
  group,
  rows,
}: {
  readonly group: WorkspaceSpawnGroup;
  readonly rows: readonly WorkspaceRoomActionRow[];
}) {
  const items = group.items.map((item) => (
    <SpawnedItemChip
      item={item}
      key={item.key}
      row={rows.find((candidate) => candidate.key === item.actionKey)}
      source={group.source}
    />
  ));
  if (group.source === undefined) return <>{items}</>;
  // Each item's badge shows the source; the group only names it.
  return (
    <span aria-label={group.source.name} className="spawned-loot-group" role="group">
      {items}
    </span>
  );
}

/** What the game spawned, grouped by what spawned it, its items as chips in spawn order. */
export function SpawnedLootRow({
  groups,
  label,
  rows,
  source,
  underCause,
  unlocks,
}: {
  readonly groups: readonly WorkspaceSpawnGroup[];
  readonly label: string;
  readonly rows: readonly WorkspaceRoomActionRow[];
  /** Spawned by its source action's settlement, under that action's row. */
  readonly source?: true;
  /** Lists locked loot as it becomes takeable. */
  readonly unlocks?: true;
  /** Stands right under the marker that caused it. */
  readonly underCause?: true;
}) {
  return (
    <TimelineRow
      aria-label={label}
      notice
      data-spawned-loot={source ? 'action' : unlocks ? 'unlocks' : 'moment'}
      hooked={source === true || underCause === true}
      editors={
        <span className="timeline-chip-group spawned-loot-groups">
          {groups.map((group, index) => (
            <Fragment key={group.key}>
              {index === 0 ? null : (
                <span aria-hidden="true" className="spawned-loot-separator">
                  ·
                </span>
              )}
              <SpawnGroup group={group} rows={rows} />
            </Fragment>
          ))}
        </span>
      }
      kind="continuation"
      label={<strong>{label}</strong>}
    />
  );
}

/** Sea Star's copies of a row's pickup, each a chip that leads to the copy's collect. */
export function SpawnCopyChips({
  copies,
  rows,
}: {
  readonly copies: readonly WorkspaceSpawnCopy[];
  readonly rows: readonly WorkspaceRoomActionRow[];
}) {
  if (copies.length === 0) return null;
  return (
    <span className="spawn-copies">
      {copies.map((copy) => (
        <SpawnedItemChip
          copy={copy.source}
          item={copy.item}
          key={copy.key}
          row={rows.find((candidate) => candidate.key === copy.item.actionKey)}
        />
      ))}
    </span>
  );
}
