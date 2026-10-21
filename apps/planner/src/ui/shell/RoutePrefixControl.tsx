import { createRouteAddress } from '@run-planner/engine/authored-project';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch } from '@planner/state/store';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { biomeIcon } from '@planner/ui/artwork/roomArtwork';

/** "Plan up to": the route's configured prefix, set through one command wherever it is shown. */
export function RoutePrefixControl({
  biomes,
  configuredBiomeCount,
  routeKey,
}: {
  readonly biomes: readonly { readonly biomeKey: string; readonly label: string }[];
  readonly configuredBiomeCount: number;
  readonly routeKey: string;
}) {
  const dispatch = useAppDispatch();
  return (
    <div className="route-scope field-control field-control-inline">
      <span>Plan up to</span>
      <div className="route-prefix-options" role="radiogroup" aria-label="Biomes to configure">
        {biomes.map((biome, index) => (
          <label key={biome.biomeKey}>
            <input
              type="radio"
              name={`${routeKey}-configured-prefix`}
              value={index + 1}
              checked={configuredBiomeCount === index + 1}
              onChange={() =>
                dispatch(
                  authoredProjectCommandDispatched({
                    kind: 'ConfigureRoutePrefix',
                    route: createRouteAddress(routeKey),
                    configuredBiomeCount: index + 1,
                  }),
                )
              }
            />
            <ArtworkIcon className="artwork-label-icon" source={biomeIcon(biome.biomeKey)} />
            {biome.label}
          </label>
        ))}
      </div>
    </div>
  );
}
