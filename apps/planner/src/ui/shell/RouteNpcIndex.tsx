import {
  semanticAddressKey,
  type EncounterPhaseAddress,
} from '@run-planner/engine/authored-project';

import { placeNameLabel } from '@planner/projections/placeName';
import type {
  RouteNpcIndex as RouteNpcIndexProjection,
  RouteNpcIndexEntry,
} from '@planner/projections/routeNpcIndex';
import { navigationArtwork } from '@planner/ui/artwork/navigation/navigationArtwork';
import { npcArtwork } from '@planner/ui/artwork/npcs/npcArtwork';
import { IndexRoom, IndexSection, RouteIndexHeader } from './RouteIndexParts';

/** Read-only route history index; editing remains in the exact room workbench. */
export function RouteNpcIndex({
  index,
  onNavigate,
}: {
  readonly index: RouteNpcIndexProjection;
  readonly onNavigate: (phase: EncounterPhaseAddress) => void;
}) {
  const entryKey = (entry: RouteNpcIndexEntry) =>
    `${semanticAddressKey(entry.phase)}:${entry.sequence}`;
  const entryLabel = (entry: RouteNpcIndexEntry) =>
    `Inspect ${entry.label} in ${placeNameLabel(entry.place)}`;
  return (
    <section aria-labelledby="route-npc-index-title" className="route-index">
      <RouteIndexHeader
        count={index.groups.reduce((sum, group) => sum + group.entries.length, 0)}
        icon={navigationArtwork.npcIndex}
        id="route-npc-index-title"
        title="NPC encounters"
      />
      {index.groups.length === 0 ? (
        <p className="route-index-empty">No resolved NPC encounters in this route.</p>
      ) : (
        index.groups.map((group) => (
          <IndexSection
            icon={npcArtwork[group.presentationKey]}
            key={group.presentationKey}
            title={group.presentationKey}
          >
            <ol className="biome-rail route-index-rail">
              {group.entries.map((entry) => (
                <li className="biome-rail-stop" data-step={entry.room?.depth} key={entryKey(entry)}>
                  <button
                    aria-label={entryLabel(entry)}
                    className="route-index-row"
                    onClick={() => onNavigate(entry.phase)}
                    type="button"
                  >
                    <IndexRoom name={entry.place.hint ?? entry.place.text} room={entry.room} />
                    <span className="route-index-name">
                      <strong>{entry.label}</strong>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </IndexSection>
        ))
      )}
    </section>
  );
}
