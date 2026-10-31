import type { ReactNode } from 'react';

/** The room's Encounters section; absent when the room has no encounter phase. */
export function RoomEncounterStructureWorkbench({ children }: { readonly children?: ReactNode }) {
  if (children === undefined) return null;
  return (
    <section aria-label="Encounter structure" className="room-structure-workbench">
      <h5 className="room-feature-category-heading">Encounters</h5>
      <div className="room-overview-panel">{children}</div>
    </section>
  );
}
