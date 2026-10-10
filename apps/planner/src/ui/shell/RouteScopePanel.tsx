import { createRouteAddress } from '@run-planner/engine/authored-project';
import { type RouteFeedbackPresentation } from '@planner/projections/evaluationProjection';
import type { RouteEditorNavigation } from '@planner/projections/editorNavigation';
import type { WorkspaceRoute } from '@planner/projections/structured-workspace';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch } from '@planner/state/store';
import { FindingCount, StatusBadge } from '../feedback/EvaluationFeedback';
import { RunStartPointModifier } from './RunStartPointModifier';

/** The plan's extent and where the run starts, with the whole-plan status. */
export function RouteScopePanel({
  label,
  navigation,
  feedback,
  replacementKey,
  workspaceRoute,
}: {
  readonly label: string;
  readonly navigation: RouteEditorNavigation;
  readonly feedback: RouteFeedbackPresentation;
  /** Accepted document replacement clears local drafts. */
  readonly replacementKey: string;
  readonly workspaceRoute: WorkspaceRoute;
}) {
  const dispatch = useAppDispatch();
  const configuredBiomeCount = workspaceRoute.biomes.length;
  const lastConfiguredBiome = navigation.biomePanels[configuredBiomeCount - 1]?.label;
  const routeExtent =
    lastConfiguredBiome === undefined ? 'No biomes' : `Through ${lastConfiguredBiome}`;
  const startPoint = workspaceRoute.runModifiers.startPoint;
  return (
    <section className="route-overview route-scope-panel" aria-label="Route">
      <header className="panel-heading">
        <h2 className="eyebrow route-loadout-heading">Route</h2>
        <div className="panel-heading-actions">
          <StatusBadge status={feedback.status} />
          <FindingCount count={feedback.findingCount} label={`${label} findings`} />
          <span className="neutral-status">{routeExtent}</span>
        </div>
      </header>
      <div className="route-scope-rows">
        <div className="route-scope field-control field-control-inline">
          <span>Plan up to</span>
          <div className="route-prefix-options" role="radiogroup" aria-label="Biomes to configure">
            {navigation.biomePanels.map((biome, index) => (
              <label key={biome.biomeKey}>
                <input
                  type="radio"
                  name={`${workspaceRoute.routeKey}-configured-prefix`}
                  value={index + 1}
                  checked={configuredBiomeCount === index + 1}
                  onChange={() =>
                    dispatch(
                      authoredProjectCommandDispatched({
                        kind: 'ConfigureRoutePrefix',
                        route: createRouteAddress(workspaceRoute.routeKey),
                        configuredBiomeCount: index + 1,
                      }),
                    )
                  }
                />
                {biome.label}
              </label>
            ))}
          </div>
        </div>
        {startPoint === undefined ? null : (
          <RunStartPointModifier
            key={replacementKey}
            control={startPoint}
            id={`${workspaceRoute.routeKey}-run-modifiers-${startPoint.declaration.key}`}
          />
        )}
      </div>
    </section>
  );
}
