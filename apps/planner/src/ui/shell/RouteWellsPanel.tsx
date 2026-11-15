import { useAppDispatch } from '@planner/state/store';
import { semanticOwnerNavigated } from '@planner/state/editorSessionSlice';
import type { RouteStygianWellIndexRow } from '@planner/projections/routeRoomFeatureIndex';
import { navigationArtwork } from '@planner/ui/artwork/navigation/navigationArtwork';
import { wellArtwork } from '@planner/ui/artwork/well/wellArtwork';
import { FeatureIndexList, RouteIndexHeader } from './RouteIndexParts';

/** Read-only route index; Well authoring remains on the owning Room Feature. */
export function RouteWellsPanel({ rows }: { readonly rows: readonly RouteStygianWellIndexRow[] }) {
  const dispatch = useAppDispatch();
  return (
    <section aria-labelledby="route-wells-title" className="route-index">
      <RouteIndexHeader
        count={rows.length}
        icon={navigationArtwork.wells}
        id="route-wells-title"
        title="Stygian Wells"
      />
      <FeatureIndexList
        actionLabel="Inspect Well"
        onOpen={(row) => dispatch(semanticOwnerNavigated(row.room.address))}
        rows={rows.map(({ biomeKey, room, well }) =>
          well.presence.kind === 'optionalAbsent'
            ? {
                key: `${biomeKey}:${room.occurrenceId}`,
                room,
                items: [],
                note: 'Runtime-random inventory',
              }
            : {
                key: `${biomeKey}:${room.occurrenceId}`,
                room,
                items: [
                  ...well.slots,
                  ...(well.travelDealRefill === undefined ? [] : [well.travelDealRefill]),
                ].map((slot) => ({
                  key: slot.key,
                  icon:
                    slot.itemKey === null ? undefined : (wellArtwork[slot.itemKey] ?? undefined),
                  label: slot.itemLabel ?? 'Unresolved',
                  bought: slot.purchased,
                })),
              },
        )}
      />
    </section>
  );
}
