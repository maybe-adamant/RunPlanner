import { Fragment, useEffect, useRef, useState } from 'react';
import { semanticAddressKey } from '@run-planner/engine/authored-project';

import type {
  WorkspaceRoomActionRow,
  WorkspaceSpawnCopy,
  WorkspaceSpawnGroup,
  WorkspaceSpawnSource,
  WorkspaceSpawnedItem,
} from '@planner/projections/structured-workspace';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { sourceFamilyIcon } from '@planner/ui/artwork/roomArtwork';
import { pickupSourceBadgeIcon } from '@planner/ui/artwork/sourceBadgeArtwork';
import { hintProps } from '@planner/ui/controls/hint';
import { IconToggleLock } from '@planner/ui/controls/IconToggle';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
import { useFindingMark } from '@planner/ui/feedback/useFindingTarget';
import { useAppSelector } from '@planner/state/store';
import { roomActionItemIcon } from './roomActionItemIcon';
import { TimelineRow } from './TimelineRow';

function actionRowElement(from: HTMLElement, actionKey: string): HTMLElement | null {
  const selector = `[data-room-action-key="${CSS.escape(actionKey)}"]`;
  return (
    from.closest('.room-actions-workbench')?.querySelector<HTMLElement>(selector) ??
    from.ownerDocument.querySelector<HTMLElement>(selector)
  );
}

/** Brings a collect action's Timeline row into view and focuses it. */
function focusActionRow(row: HTMLElement): void {
  row.focus({ preventScroll: true });
  row.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
}

/** A newly placed row's first unfinished choice opens; otherwise the row is focused. */
function openPlacedRow(row: HTMLElement): void {
  const choice = [
    ...row.querySelectorAll<HTMLElement>('.timeline-cell-editors button[data-has-findings="true"]'),
  ].find((button) => !button.matches(':disabled') && button.ariaDisabled !== 'true');
  if (choice === undefined) {
    focusActionRow(row);
    return;
  }
  choice.focus({ preventScroll: true });
  row.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  choice.click();
}

function SpawnedItemChip({
  announce,
  copy,
  item,
  row,
  source,
}: {
  readonly announce: (message: string) => void;
  /** A copy's chip shows its source and the doubled count instead of the item. */
  readonly copy?: WorkspaceSpawnSource;
  readonly item: WorkspaceSpawnedItem;
  readonly row: WorkspaceRoomActionRow | undefined;
  /** What created the item, as a badge on the chip's bottom corner. */
  readonly source?: WorkspaceSpawnSource | undefined;
}) {
  const executeIntent = useCommandIntent();
  const findingMark = useFindingMark();
  const focusedOwner = useAppSelector((state) => state.editorSession.focusedSemanticOwner);
  const revision = useAppSelector((state) => state.editorSession.semanticNavigationRevision);
  const chip = useRef<HTMLButtonElement>(null);
  const opening = useRef(false);
  const navigatedAt = useRef<number>(undefined);
  const placement = item.placement;
  const name =
    copy !== undefined
      ? `${copy.name} copy`
      : item.place === undefined
        ? item.label
        : `${item.label} · ${item.place.label}`;
  const sourceBadge =
    source === undefined
      ? undefined
      : pickupSourceBadgeIcon(source.family, source.challengeSwitchKind);
  const unavailable = placement.kind === 'unavailable';
  // Placed from this chip, the new row opens its choice once it is on the Timeline.
  useEffect(() => {
    if (!opening.current || placement.kind !== 'placed' || chip.current === null) return;
    opening.current = false;
    const placed = actionRowElement(chip.current, item.actionKey);
    if (placed !== null) openPlacedRow(placed);
  }, [item.actionKey, placement.kind]);
  // Navigation to an unplaced item's action lands on its chip.
  const navigated =
    placement.kind !== 'placed' &&
    row !== undefined &&
    focusedOwner !== null &&
    semanticAddressKey(focusedOwner) === semanticAddressKey(row.address);
  useEffect(() => {
    if (!navigated || navigatedAt.current === revision || chip.current === null) return;
    navigatedAt.current = revision;
    chip.current.focus({ preventScroll: true });
    chip.current.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }, [navigated, revision]);
  const mark =
    placement.kind === 'placed' || row === undefined
      ? undefined
      : findingMark(row.address, 'place');
  return (
    <button
      {...mark}
      {...hintProps(item.hint, mark?.['aria-description'], name)}
      aria-disabled={unavailable || undefined}
      aria-label={name}
      className={copy === undefined ? 'timeline-chip' : 'timeline-chip spawn-copy-chip'}
      data-spawn-locked={item.locked}
      data-spawn-participation={item.participation}
      data-spawn-placed={placement.kind === 'placed' || undefined}
      onClick={(event) => {
        if (placement.kind === 'placed') {
          const placed = actionRowElement(event.currentTarget, item.actionKey);
          if (placed !== null) focusActionRow(placed);
        } else if (placement.kind === 'unplaced') {
          opening.current = true;
          executeIntent(placement.intent);
          announce(`${item.label} added to the timeline.`);
        }
      }}
      ref={chip}
      type="button"
    >
      <ArtworkIcon
        className="artwork-label-icon"
        source={
          copy !== undefined
            ? sourceFamilyIcon(copy.family)
            : row === undefined
              ? undefined
              : (roomActionItemIcon(row) ?? sourceFamilyIcon(row.sourceFamily))
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
      {item.locked ? <IconToggleLock className="spawn-lock-badge" /> : null}
    </button>
  );
}

function SpawnGroup({
  announce,
  group,
  rows,
}: {
  readonly announce: (message: string) => void;
  readonly group: WorkspaceSpawnGroup;
  readonly rows: readonly WorkspaceRoomActionRow[];
}) {
  const items = group.items.map((item) => (
    <SpawnedItemChip
      announce={announce}
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
  unlocks,
}: {
  readonly groups: readonly WorkspaceSpawnGroup[];
  readonly label: string;
  readonly rows: readonly WorkspaceRoomActionRow[];
  /** Spawned by its source action's settlement, under that action's row. */
  readonly source?: true;
  /** Lists locked loot as it becomes takeable. */
  readonly unlocks?: true;
}) {
  const [announcement, setAnnouncement] = useState('');
  return (
    <TimelineRow
      aria-label={label}
      className="timeline-row-notice"
      data-spawned-loot={source ? 'action' : unlocks ? 'unlocks' : 'moment'}
      editors={
        <span className="timeline-chip-group spawned-loot-groups">
          {groups.map((group, index) => (
            <Fragment key={group.key}>
              {index === 0 ? null : (
                <span aria-hidden="true" className="spawned-loot-separator">
                  ·
                </span>
              )}
              <SpawnGroup announce={setAnnouncement} group={group} rows={rows} />
            </Fragment>
          ))}
          <span aria-live="polite" className="visually-hidden">
            {announcement}
          </span>
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
  const [announcement, setAnnouncement] = useState('');
  if (copies.length === 0) return null;
  return (
    <span className="spawn-copies">
      {copies.map((copy) => (
        <SpawnedItemChip
          announce={setAnnouncement}
          copy={copy.source}
          item={copy.item}
          key={copy.key}
          row={rows.find((candidate) => candidate.key === copy.item.actionKey)}
        />
      ))}
      <span aria-live="polite" className="visually-hidden">
        {announcement}
      </span>
    </span>
  );
}
