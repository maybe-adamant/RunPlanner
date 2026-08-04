import {
  semanticAddressKey,
  type EncounterPhaseAddress,
} from '@run-planner/engine/authored-project';

import type { RouteNpcIndex as RouteNpcIndexProjection } from '@planner/projections/routeNpcIndex';

/** Read-only route history index; editing remains in the exact room workbench. */
export function RouteNpcIndex({
  index,
  onNavigate,
}: {
  readonly index: RouteNpcIndexProjection;
  readonly onNavigate: (phase: EncounterPhaseAddress) => void;
}) {
  return (
    <section className="route-npc-index" aria-labelledby="route-npc-index-title">
      <header className="panel-heading">
        <div>
          <p className="eyebrow">Route history</p>
          <h2 id="route-npc-index-title">NPC encounters</h2>
        </div>
      </header>
      {index.groups.length === 0 ? (
        <p className="route-npc-index-empty">No resolved NPC encounters in this route.</p>
      ) : (
        <div className="route-npc-index-groups">
          {index.groups.map((group) => (
            <section
              aria-labelledby={`route-npc-index-${encodeURIComponent(group.presentationKey)}`}
              className="route-npc-index-group"
              key={group.presentationKey}
            >
              <h3 id={`route-npc-index-${encodeURIComponent(group.presentationKey)}`}>
                {group.presentationKey}
              </h3>
              <ol>
                {group.entries.map((entry) => (
                  <li key={`${semanticAddressKey(entry.phase)}:${entry.sequence}`}>
                    <button
                      aria-label={`Inspect ${entry.label} in ${entry.locationLabel}`}
                      className="semantic-focus-link route-npc-index-entry"
                      onClick={() => onNavigate(entry.phase)}
                      type="button"
                    >
                      <span>{entry.label}</span>
                      <span className="route-npc-index-location">{entry.locationLabel}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
