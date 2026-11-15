import { createOccurrenceAddress } from '@run-planner/engine/authored-project';
import type { PlaceRoom } from '@planner/projections/placeName';
import type { WorkspaceRoute } from '@planner/projections/structured-workspace';
import { useAppDispatch } from '@planner/state/store';
import { semanticOwnerNavigated } from '@planner/state/editorSessionSlice';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { navigationArtwork } from '@planner/ui/artwork/navigation/navigationArtwork';
import { elementIcon, gatheringToolIcon } from '@planner/ui/artwork/roomArtwork';
import { IndexRoom, RouteIndexHeader } from './RouteIndexParts';

function resourceFamilyLabel(family: WorkspaceRoute['resources'][number]['family']): string {
  switch (family) {
    case 'Pickaxe':
      return 'Mining';
    case 'Exorcism':
      return 'Spirit';
    case 'Shovel':
      return 'Seed';
    case 'Fishing':
      return 'Fishing';
  }
}

/** The placement room's rail face, read from the route's own room. */
function placementRoom(
  route: WorkspaceRoute,
  placement: NonNullable<WorkspaceRoute['resources'][number]['placement']>,
): PlaceRoom {
  const room = route.biomes
    .find((biome) => biome.biomeKey === placement.biomeKey)
    ?.nodes.flatMap((node) => (node.kind === 'occurrenceWorkbench' ? [node.room] : []))
    .find((candidate) => candidate.occurrenceId === placement.occurrenceId);
  return {
    ...(placement.runDepth === undefined ? {} : { depth: placement.runDepth }),
    ...(room === undefined ? {} : { icon: room.roomIcon }),
    ...(room?.roomNumber === undefined ? {} : { number: room.roomNumber }),
  };
}

export function RouteResourcesPanel({ route }: { readonly route: WorkspaceRoute }) {
  const dispatch = useAppDispatch();
  return (
    <section aria-labelledby="route-resources-title" className="route-index">
      <RouteIndexHeader
        count={0}
        icon={navigationArtwork.resources}
        id="route-resources-title"
        title="Resources"
      />
      <ol className="biome-rail route-index-rail">
        {route.resources.map((resource) => {
          const placement = resource.placement;
          const room = placement === undefined ? undefined : placementRoom(route, placement);
          const face = (
            <>
              <span className="route-index-chip">
                <ArtworkIcon
                  className="route-index-chip-icon"
                  source={gatheringToolIcon(resource.family)}
                />
              </span>
              <span className="route-index-name">
                <strong>{resourceFamilyLabel(resource.family)}</strong>
              </span>
              <span className="route-index-meta">
                {resource.element === undefined ? null : (
                  <ArtworkIcon
                    className="artwork-label-icon-small"
                    source={elementIcon(resource.element)}
                  />
                )}
                {resource.element}
              </span>
            </>
          );
          const where =
            placement === undefined ? (
              <span className="route-index-room route-index-unset">No selected success</span>
            ) : (
              <IndexRoom name={placement.place.hint ?? placement.place.text} room={room} />
            );
          return (
            <li className="biome-rail-stop" data-step={room?.depth} key={resource.family}>
              {placement === undefined ? (
                <div className="route-index-row" data-static="true">
                  {where}
                  {face}
                </div>
              ) : (
                <button
                  aria-label="Inspect placement"
                  className="route-index-row"
                  type="button"
                  onClick={() =>
                    dispatch(
                      semanticOwnerNavigated(
                        createOccurrenceAddress(
                          { kind: 'biome', routeKey: route.routeKey, biomeKey: placement.biomeKey },
                          placement.occurrenceId,
                        ),
                      ),
                    )
                  }
                >
                  {where}
                  {face}
                  {placement.pastPlanEnd === true ? (
                    <span className="route-index-unset">Past the plan end</span>
                  ) : null}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
