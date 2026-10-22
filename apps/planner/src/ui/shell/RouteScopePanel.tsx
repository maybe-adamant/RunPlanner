import { type RouteFeedbackPresentation } from '@planner/projections/evaluationProjection';
import type { RouteEditorNavigation } from '@planner/projections/editorNavigation';
import type { WorkspaceRoute } from '@planner/projections/structured-workspace';
import { FindingCount } from '../feedback/EvaluationFeedback';
import { RoutePrefixControl } from './RoutePrefixControl';
import { RouteRunModifiers } from './RouteRunModifiers';

/** The plan's extent and its run modifiers, with the whole-plan status. */
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
  const configuredBiomeCount = workspaceRoute.biomes.length;
  const lastConfiguredBiome = navigation.biomePanels[configuredBiomeCount - 1]?.label;
  const routeExtent =
    lastConfiguredBiome === undefined ? 'No biomes' : `Through ${lastConfiguredBiome}`;
  return (
    <section className="route-overview route-scope-panel" aria-label="Route">
      <header className="panel-heading">
        <h2 className="eyebrow route-loadout-heading">Route</h2>
        <div className="panel-heading-actions">
          <FindingCount count={feedback.findingCount} label={`${label} findings`} />
          <span className="neutral-status">{routeExtent}</span>
        </div>
      </header>
      <div className="route-scope-rows">
        <RoutePrefixControl
          biomes={navigation.biomePanels}
          configuredBiomeCount={configuredBiomeCount}
          routeKey={workspaceRoute.routeKey}
        />
      </div>
      <RouteRunModifiers replacementKey={replacementKey} workspaceRoute={workspaceRoute} />
    </section>
  );
}
