import type { ReactNode } from 'react';

import type { PlaceRoom } from '@planner/projections/placeName';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { RoomNumberIcon } from '@planner/ui/editor/biome/RoomNumberIcon';

/** A route index's title line: the panel's icon, its name and how many rows it holds. */
export function RouteIndexHeader({
  count,
  icon,
  id,
  title,
}: {
  readonly count: number;
  readonly icon: string | null | undefined;
  readonly id: string;
  readonly title: string;
}) {
  return (
    <header className="route-index-head">
      <ArtworkIcon className="route-index-head-icon" source={icon ?? undefined} />
      <h2 id={id}>{title}</h2>
      {count === 0 ? null : <span className="route-index-count">{count}</span>}
    </header>
  );
}

/** A room as the rail names it: its icon with its number, then its name. */
export function IndexRoom({
  name,
  room,
}: {
  readonly name?: string | undefined;
  readonly room: PlaceRoom | undefined;
}) {
  return (
    <span className="route-index-room">
      {room?.icon === undefined ? null : <RoomNumberIcon number={room.number} room={room.icon} />}
      {name === undefined ? null : <span className="route-index-room-name">{name}</span>}
    </span>
  );
}

/** A group of index rows: a small-caps heading with its icon over its rows. */
export function IndexSection({
  children,
  icon,
  title,
}: {
  readonly children: ReactNode;
  readonly icon: string | null | undefined;
  readonly title: string;
}) {
  return (
    <section className="route-index-section">
      <h3 className="room-feature-category-heading route-index-section-heading">
        <ArtworkIcon className="route-index-section-icon" source={icon ?? undefined} />
        {title}
      </h3>
      {children}
    </section>
  );
}

/** One room feature's row: its room and the items it holds. */
export interface FeatureIndexRow {
  readonly key: string;
  readonly room: import('@planner/projections/structured-workspace').WorkspaceRoomSummary;
  readonly items: readonly {
    readonly key: string;
    readonly icon: string | undefined;
    readonly label: string;
    readonly bought?: boolean;
  }[];
  /** What the row says in place of items, such as a runtime-random inventory. */
  readonly note?: string;
}

/** A route index of one room feature, such as Wells or Shrines, on the rail's spine. */
export function FeatureIndexList({
  actionLabel,
  onOpen,
  rows,
}: {
  readonly actionLabel: string;
  readonly onOpen: (row: FeatureIndexRow) => void;
  readonly rows: readonly FeatureIndexRow[];
}) {
  const roomOf = (row: FeatureIndexRow): PlaceRoom => ({
    ...(row.room.runDepth === undefined ? {} : { depth: row.room.runDepth }),
    icon: row.room.roomIcon,
    ...(row.room.roomNumber === undefined ? {} : { number: row.room.roomNumber }),
  });
  const button = (row: FeatureIndexRow, children: ReactNode) => (
    <button
      aria-label={actionLabel}
      className="route-index-row"
      data-findings={row.room.marker.findingCount > 0}
      onClick={() => onOpen(row)}
      type="button"
    >
      {children}
    </button>
  );
  const items = (row: FeatureIndexRow) => (
    <span className="route-index-items">
      {row.note === undefined ? null : <span className="route-index-unset">{row.note}</span>}
      {row.items.map((item) => (
        <span className="route-index-item" data-bought={item.bought === true} key={item.key}>
          <span className="route-index-chip route-index-chip-small">
            <ArtworkIcon className="route-index-chip-icon" source={item.icon} />
          </span>
          {item.label}
          {item.bought === true ? <span className="route-index-unset">bought</span> : null}
        </span>
      ))}
    </span>
  );
  return (
    <ol className="biome-rail route-index-rail">
      {rows.map((row) => (
        <li className="biome-rail-stop" data-step={row.room.runDepth} key={row.key}>
          {button(
            row,
            <>
              <IndexRoom name={row.room.label} room={roomOf(row)} />
              {items(row)}
            </>,
          )}
        </li>
      ))}
    </ol>
  );
}
