import { useAppDispatch } from '@planner/state/store';
import { semanticOwnerNavigated } from '@planner/state/editorSessionSlice';
import type { RouteHermesShrineIndexRow } from '@planner/projections/routeRoomFeatureIndex';

/** Read-only route index; Shrine authoring remains on the owning Room Feature. */
export function RouteShrinesPanel({
  rows,
}: {
  readonly rows: readonly RouteHermesShrineIndexRow[];
}) {
  const dispatch = useAppDispatch();
  return (
    <section aria-labelledby="route-shrines-title" className="route-traits-panel">
      <header className="panel-heading">
        <div>
          <p className="eyebrow">Room features</p>
          <h2 id="route-shrines-title">Hermes Shrines</h2>
        </div>
      </header>
      <ol className="route-traits-list">
        {rows.map(({ biomeKey, room, shrine }) => (
          <li className="route-trait-row" key={`${biomeKey}:${room.occurrenceId}`}>
            <div>
              <strong>{room.label}</strong>
              <span className="route-trait-meta">
                {biomeKey} ·{' '}
                {shrine.slots.map((slot) => slot.rewardLabel ?? 'Unresolved').join(' · ')}
                {room.marker.findingCount === 0
                  ? ''
                  : ` · ${room.marker.findingCount} finding${room.marker.findingCount === 1 ? '' : 's'}`}
              </span>
            </div>
            <button
              className="quiet-action action-compact"
              onClick={() => dispatch(semanticOwnerNavigated(room.address))}
              type="button"
            >
              Inspect Shrine
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
