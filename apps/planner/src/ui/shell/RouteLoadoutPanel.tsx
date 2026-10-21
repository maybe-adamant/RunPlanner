import { routeInitialProfile, type ProjectDocument } from '@run-planner/engine/authored-project';
import { type Catalog } from '@run-planner/engine/catalog-schema';
import type {
  WorkspaceInteractionCatalog,
  WorkspaceRoute,
} from '@planner/projections/structured-workspace';
import { RewardControlEditor } from '@planner/ui/editor/rewards/RewardControlEditor';
import { useFindingAnchor } from '../feedback/useFindingTarget';
import { RouteLoadoutControls } from './RouteLoadoutControls';
import { useCommonItemWidth } from './useCommonItemWidth';

/** The starting choices; route-scoped findings anchor here. */
export function RouteLoadoutPanel({
  catalog,
  project,
  workspaceRoute,
  interactions,
}: {
  readonly catalog: Catalog;
  readonly project: ProjectDocument;
  readonly workspaceRoute: WorkspaceRoute;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const findingAnchor = useFindingAnchor();
  const authoredRoute =
    project.route.routeKey === workspaceRoute.routeKey ? project.route : undefined;
  if (authoredRoute === undefined)
    throw new Error(`Missing authored route ${workspaceRoute.routeKey}`);
  const initialProfile = routeInitialProfile(catalog, workspaceRoute.routeKey);
  return (
    <section
      className="route-overview"
      {...findingAnchor(workspaceRoute.marker.address)}
      tabIndex={-1}
    >
      <header className="panel-heading">
        <h2 className="eyebrow route-loadout-heading">Loadout</h2>
      </header>
      {initialProfile.kind === 'freshFile' ? (
        <FreshFileLoadout catalog={catalog} fixedWeaponKey={initialProfile.fixedWeaponKey} />
      ) : (
        <MatureRouteLoadout
          authoredRoute={authoredRoute}
          catalog={catalog}
          interactions={interactions}
          workspaceRoute={workspaceRoute}
        />
      )}
    </section>
  );
}

/** A fresh profile's fixed weapon; Arcana, Fear, keepsake and starting reward do not exist there. */
export function FreshFileLoadout({
  catalog,
  fixedWeaponKey,
}: {
  readonly catalog: Catalog;
  readonly fixedWeaponKey: string;
}) {
  const weapon = catalog.weapons.byKey[fixedWeaponKey];
  return (
    <div className="route-loadout-panel route-fixed-loadout">
      <dl aria-label="Fixed starting loadout" className="route-fixed-loadout-facts">
        <div>
          <dt>Weapon</dt>
          <dd>{weapon?.label ?? fixedWeaponKey}, no Aspect</dd>
        </div>
      </dl>
    </div>
  );
}

function MatureRouteLoadout({
  authoredRoute,
  catalog,
  interactions,
  workspaceRoute,
}: {
  readonly authoredRoute: ProjectDocument['route'];
  readonly catalog: Catalog;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly workspaceRoute: WorkspaceRoute;
}) {
  const startingReward = workspaceRoute.startingReward;
  if (startingReward === undefined)
    throw new Error(`Missing starting reward control for ${workspaceRoute.routeKey}`);
  const rows = useCommonItemWidth<HTMLDivElement>();
  return (
    <div ref={rows}>
      <RouteLoadoutControls
        authoredRoute={authoredRoute}
        catalog={catalog}
        interactions={interactions}
        workspaceRoute={workspaceRoute}
      />
      <div className="route-configuration">
        <RewardControlEditor
          control={startingReward}
          idPrefix={`${workspaceRoute.routeKey}-starting-reward`}
          interactions={interactions}
          label="Starting reward"
        />
      </div>
    </div>
  );
}
