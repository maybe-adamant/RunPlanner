import { useAppDispatch } from '@planner/state/store';
import { semanticOwnerNavigated } from '@planner/state/editorSessionSlice';
import type { RouteStygianWellIndexRow } from '@planner/projections/routeRoomFeatureIndex';

/** Read-only route index; Well authoring remains on the owning Room Feature. */
export function RouteWellsPanel({ rows }: { readonly rows: readonly RouteStygianWellIndexRow[] }) {
  const dispatch = useAppDispatch();
  return (
    <section aria-labelledby="route-wells-title" className="route-traits-panel">
      <header className="panel-heading">
        <div>
          <p className="eyebrow">Room features</p>
          <h2 id="route-wells-title">Stygian Wells</h2>
        </div>
      </header>
      <ol className="route-traits-list">
        {rows.map(({ biomeKey, room, well }) => (
          <li className="route-trait-row" key={`${biomeKey}:${room.occurrenceId}`}>
            <div>
              <strong>{room.label}</strong>
              <span className="route-trait-meta">
                {biomeKey} ·{' '}
                {well.interacted
                  ? well.slots
                      .map(
                        (slot) =>
                          `${slot.itemLabel ?? 'Unresolved'}${slot.purchased ? ' (bought)' : ''}`,
                      )
                      .join(' · ')
                  : 'Runtime-random inventory'}
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
              Inspect Well
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
