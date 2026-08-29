import { createOccurrenceAddress } from '@run-planner/engine/authored-project';
import type { WorkspaceRoute } from '@planner/projections/structured-workspace';
import { useAppDispatch } from '@planner/state/store';
import { semanticOwnerNavigated } from '@planner/state/editorSessionSlice';

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

export function RouteResourcesPanel({ route }: { readonly route: WorkspaceRoute }) {
  const dispatch = useAppDispatch();
  return (
    <section className="route-resources-panel" aria-labelledby="route-resources-title">
      <header className="panel-heading">
        <div>
          <p className="eyebrow">Route outcomes</p>
          <h2 id="route-resources-title">Resources</h2>
        </div>
      </header>
      <ol className="route-traits-list">
        {route.resources.map((resource) => {
          const placement = resource.placement;
          return (
            <li className="route-trait-row" key={resource.family}>
              <div>
                <strong>{resourceFamilyLabel(resource.family)}</strong>
                <span className="route-trait-meta">
                  {placement === undefined
                    ? 'No selected success'
                    : `${placement.biomeKey} · ${placement.locationLabel}`}
                  {placement !== undefined && !resource.valid
                    ? ` · Repair required: ${resource.reasons.join(', ')}`
                    : ''}
                </span>
              </div>
              {placement === undefined ? null : (
                <button
                  className="quiet-action action-compact"
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
                  Inspect placement
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
