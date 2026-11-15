import { useAppDispatch } from '@planner/state/store';
import { semanticOwnerNavigated } from '@planner/state/editorSessionSlice';
import type { RouteHermesShrineIndexRow } from '@planner/projections/routeRoomFeatureIndex';
import { navigationArtwork } from '@planner/ui/artwork/navigation/navigationArtwork';
import { rewardIcon } from '@planner/ui/artwork/rewardIcon';
import { FeatureIndexList, RouteIndexHeader } from './RouteIndexParts';

/** Read-only route index; Shrine authoring remains on the owning Room Feature. */
export function RouteShrinesPanel({
  rows,
}: {
  readonly rows: readonly RouteHermesShrineIndexRow[];
}) {
  const dispatch = useAppDispatch();
  return (
    <section aria-labelledby="route-shrines-title" className="route-index">
      <RouteIndexHeader
        count={rows.length}
        icon={navigationArtwork.shrines}
        id="route-shrines-title"
        title="Hermes Shrines"
      />
      <FeatureIndexList
        actionLabel="Inspect Shrine"
        onOpen={(row) => dispatch(semanticOwnerNavigated(row.room.address))}
        rows={rows.map(({ biomeKey, room, shrine }) => ({
          key: `${biomeKey}:${room.occurrenceId}`,
          room,
          items: shrine.slots.map((slot) => ({
            key: slot.key,
            icon: slot.rewardType === null ? undefined : rewardIcon(slot.rewardType),
            label: slot.rewardLabel ?? 'Unresolved',
          })),
        }))}
      />
    </section>
  );
}
