import type { ReactNode } from 'react';

/** The one Overview section order shared by every room kind. */
const roomOverviewSectionOrder = [
  'encounters',
  'contents',
  'additionalExits',
  'objects',
  'resources',
  'npcs',
] as const;

export type RoomOverviewSectionKey = (typeof roomOverviewSectionOrder)[number];

export type RoomOverviewSectionContent = Partial<Record<RoomOverviewSectionKey, ReactNode>>;

/** A room contributes only the sections it has; they always render in the shared order. */
export function RoomOverviewSections({
  sections,
}: {
  readonly sections: RoomOverviewSectionContent;
}) {
  return roomOverviewSectionOrder.map((key) => {
    const content = sections[key];
    return content === undefined || content === null ? null : (
      <div className="room-overview-slot" data-overview-section={key} key={key}>
        {content}
      </div>
    );
  });
}
