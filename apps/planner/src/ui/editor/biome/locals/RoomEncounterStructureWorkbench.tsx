import type { ReactNode } from 'react';

/** The room's encounters, decided on entry; absent when the room has no encounter phase. */
export function RoomEncounterStructureWorkbench({ children }: { readonly children?: ReactNode }) {
  if (children === undefined) return null;
  return (
    <section aria-label="Encounter structure" className="room-structure-workbench">
      {children}
    </section>
  );
}
