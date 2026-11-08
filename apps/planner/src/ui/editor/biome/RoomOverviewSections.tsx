import { Fragment, type ReactNode } from 'react';
import { ArtworkIcon, type ArtworkSource } from '@planner/ui/artwork/ArtworkIcon';
import { useRoomMapLinks, type RoomMapHighlight } from './room-map/roomMapHighlight';

/**
 * The Overview in game order: what the room's entry decides, what stands in
 * it, what each thing holds, and where each thing stands.
 */
const roomOverviewSections = [
  ['entry', 'Encounter'],
  ['present', 'Spawns'],
  ['contents', 'Offers'],
  ['positions', 'Layout'],
] as const;

export type RoomOverviewSectionKey = (typeof roomOverviewSections)[number][0];

/** Each section's blocks, keyed; an empty block is skipped. */
export type RoomOverviewSectionContent = Partial<
  Record<RoomOverviewSectionKey, readonly (readonly [key: string, content: ReactNode])[]>
>;

/** A room contributes only the blocks it has; a section with none is left out. */
export function RoomOverviewSections({
  sections,
}: {
  readonly sections: RoomOverviewSectionContent;
}) {
  return roomOverviewSections.map(([key, heading]) => {
    const blocks = (sections[key] ?? []).filter(
      ([, content]) => content !== undefined && content !== null && content !== false,
    );
    return blocks.length === 0 ? null : (
      <section
        aria-label={heading}
        className="room-overview-section"
        data-overview-section={key}
        key={key}
      >
        <h5 className="room-feature-category-heading">{heading}</h5>
        <div className="room-overview-panel">
          {blocks.map(([blockKey, content]) => (
            <Fragment key={blockKey}>{content}</Fragment>
          ))}
        </div>
      </section>
    );
  });
}

/** One labelled row of a section, its label in the shared label column. */
export function OverviewRow({
  children,
  icon,
  label,
  preview,
}: {
  readonly children: ReactNode;
  readonly icon?: ArtworkSource | undefined;
  readonly label: string;
  /** The map point hovering the row previews. */
  readonly preview?: RoomMapHighlight | undefined;
}) {
  const mapLinks = useRoomMapLinks();
  return (
    <div aria-label={label} className="room-layout-row" role="group" {...mapLinks(preview)}>
      <span aria-hidden="true" className="room-layout-label">
        {icon === undefined ? null : <ArtworkIcon className="artwork-label-icon" source={icon} />}
        {label}
      </span>
      <div className="room-layout-value">{children}</div>
    </div>
  );
}
