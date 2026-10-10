import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import {
  applyProjectCommand,
  createProjectDocument,
  createRouteAddress,
  createStartingRewardAddress,
} from '@run-planner/engine/authored-project';
import { createCompleteFGProject } from '@run-planner/test-fixtures/underworld';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
import { describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { newProjectCreated } from '@planner/state/profileSessionSlice';
import {
  authoredProjectCommandDispatched,
  authoredProjectReplaced,
} from '@planner/state/projectWorkspaceSlice';
import { RouteLoadoutPanel } from '@planner/ui/shell/RouteLoadoutPanel';
import { createOpenTestApplication } from '@planner-test/fixtures/renderPlanner';

function routeProducts(application: ReturnType<typeof createApplication>) {
  const state = application.store.getState();
  const project =
    state.projectWorkspace.kind === 'openProject'
      ? state.projectWorkspace.history.present
      : undefined;
  const workspace = application.selectStructuredWorkspace(state);
  if (
    project === undefined ||
    workspace === undefined ||
    state.projectWorkspace.kind !== 'openProject'
  )
    throw new Error('Route products are missing');
  return { state: state.projectWorkspace, project, workspace };
}

function loadoutMarkup(application: ReturnType<typeof createApplication>): string {
  const { project, workspace } = routeProducts(application);
  return renderToStaticMarkup(
    <Provider store={application.store}>
      <RouteLoadoutPanel
        catalog={application.catalog}
        interactions={workspace.interactions}
        project={project}
        workspaceRoute={workspace.route}
      />
    </Provider>,
  );
}

describe('RouteLoadoutPanel', () => {
  it('presents Aspect of Selene Hex controls only for the active aspect', () => {
    const application = createOpenTestApplication('Underworld');
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceRouteLoadout',
        route: createRouteAddress('Underworld'),
        weaponKey: 'WeaponSuit',
        aspectKey: 'SuitHexAspect',
      }),
    );
    expect(loadoutMarkup(application)).toContain('Edit Sky Fall Hex tree');

    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceRouteLoadout',
        route: createRouteAddress('Underworld'),
        weaponKey: 'WeaponSuit',
        aspectKey: 'BaseSuitAspect',
      }),
    );
    expect(loadoutMarkup(application)).not.toContain('Edit Sky Fall Hex tree');
  });

  it('marks a Vow of Forfeit realization on the starting reward control', () => {
    const application = createApplication();
    let project = applyProjectCommand(createCompleteFGProject(), application.catalog, {
      kind: 'ReplaceFearVowRank',
      route: createRouteAddress('Underworld'),
      vowKey: 'BoonSkipShrineUpgrade',
      rank: 1,
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'ReplaceStartingReward',
      reward: createStartingRewardAddress('Underworld'),
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    });
    project = authorLegalTraitOffers(project);
    application.store.dispatch(newProjectCreated(project));
    const markup = loadoutMarkup(application);
    expect(markup).toContain('>Starting reward</label>');
    expect(markup).toMatch(
      /<button[^>]*class="contextual-picker-trigger"[^>]*data-hint="Converted by the Vow of Forfeit\."/,
    );
    expect(markup).toMatch(/Apollo[^<]*\(Red Onion\)<\/span>/);
    expect(markup).not.toContain('Forfeit →');
    expect(markup.match(/data-hint="Converted by the Vow of Forfeit\."/g)).toHaveLength(1);
  });

  it('owns only the independent starting reward in the Loadout panel', () => {
    const application = createOpenTestApplication('Underworld');
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ConfigureRoutePrefix',
        configuredBiomeCount: 1,
        route: createRouteAddress('Underworld'),
      }),
    );
    const markup = loadoutMarkup(application);
    expect(markup).toContain('>Starting reward</label>');
    expect(markup).not.toContain('aria-label="Starting room"');
    expect(markup).not.toContain('aria-label="Start room configuration"');
  });

  it('presents the Fresh File loadout as fixed facts without selection controls', () => {
    const application = createApplication();
    application.store.dispatch(
      authoredProjectReplaced(
        createProjectDocument(application.catalog, {
          projectId: 'fresh-overview',
          routeKey: 'FreshFile',
          configuredBiomeCount: 1,
        }),
      ),
    );

    const markup = loadoutMarkup(application);
    expect(markup).toContain('Loadout');
    expect(markup).toContain('aria-label="Fixed starting loadout"');
    expect(markup).toContain('Witch&#x27;s Staff, no Aspect');
    for (const fact of ['Starting Arcana', 'Starting Fear', 'Starting keepsake', 'Starting reward'])
      expect(markup).not.toContain(`<dt>${fact}</dt>`);
    expect(markup).not.toContain('sent to the game');
    expect(markup).not.toContain('aria-label="Edit Arcana"');
    expect(markup).not.toContain('aria-label="Edit Fear"');
    expect(markup).not.toContain('>Starting reward</label>');
    expect(markup).not.toContain('FreshFile-familiar');
  });
});
