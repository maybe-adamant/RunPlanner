// @vitest-environment jsdom

import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import {
  authoredProjectRedoRequested,
  authoredProjectReplaced,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import {
  createFreshFileRouteProject,
  freshFileGIntroId,
} from '@run-planner/test-fixtures/fresh-file';
import { renderPlannerForInteraction } from '../fixtures/renderPlanner';

afterEach(() => {
  cleanup();
});

describe('Fresh File product loop', () => {
  it('creates a Fresh File and edits from the empty opening through the forced Apollo offer', async () => {
    const { application, user } = renderPlannerForInteraction({ startWithProject: false });
    const project = () => application.store.getState().projectWorkspace.history!.present;

    await user.click(screen.getByRole('button', { name: 'Fresh File' }));
    expect(project().route).toMatchObject({
      routeKey: 'FreshFile',
      loadout: { weaponKey: null, aspectKey: null, startingKeepsakeKey: null },
    });

    await user.click(screen.getByRole('button', { name: 'Loadout' }));
    expect(screen.getByRole('heading', { name: 'Fresh File Loadout' })).toBeTruthy();
    const facts = screen.getByLabelText('Fixed starting loadout');
    expect(within(facts).getByText("Witch's Staff, no Aspect")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit Arcana' })).toBeNull();
    expect(screen.queryByLabelText('Starting reward')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Erebus' }));
    expect(project().route.biomes[0]?.topology?.occurrences[0]?.gameName).toBe('F_Opening01');
    await user.click(screen.getByRole('tab', { name: 'Room Doors' }));
    await user.click(screen.getByLabelText('Reward Pool'));
    await user.click(within(screen.getByRole('listbox')).getByText('Minor Reward'));
    const decisions = () => project().route.biomes[0]!.topology!.decisions;
    expect(decisions()).toHaveLength(1);
    expect(application.store.getState().projectWorkspace.history!.past).toHaveLength(1);

    await user.click(screen.getByText('Select a room'));
    await user.click(within(screen.getByRole('listbox')).getAllByRole('option')[0]!);
    const occurrences = () => project().route.biomes[0]!.topology!.occurrences;
    expect(occurrences()).toHaveLength(2);
    expect(occurrences()[1]?.gameName).toBe('F_Combat01');

    application.store.dispatch(authoredProjectUndoRequested());
    expect(occurrences()).toHaveLength(1);
    expect(decisions()).toHaveLength(1);
    application.store.dispatch(authoredProjectUndoRequested());
    expect(decisions()).toHaveLength(0);
    application.store.dispatch(authoredProjectRedoRequested());
    application.store.dispatch(authoredProjectRedoRequested());
    expect(occurrences()).toHaveLength(2);

    // The forced Apollo boon is the only reward, and its screen is the Common trio.
    await user.click(screen.getByLabelText('Reward'));
    const rewards = within(await screen.findByRole('listbox')).getAllByRole('option');
    expect(rewards.map((option) => option.textContent)).toEqual(['Boon']);
    await user.click(rewards[0]!);
    const gods = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(gods.map((option) => option.textContent)).toEqual(['✓Apollo']);
    await user.click(gods[0]!);
    await user.click(screen.getByRole('button', { name: 'Open next room' }));
    await user.click(screen.getByRole('tab', { name: 'Room Timeline' }));
    expect(screen.getByRole('region', { name: 'Room Timeline' }).textContent).toContain(
      'Intro combat',
    );
    await user.click(screen.getByRole('button', { name: /Choose Trait/ }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('Fresh rarity: Fixed Common');
    await user.click(within(dialog).getByRole('button', { name: 'option1 trait' }));
    const traits = within(await screen.findByRole('listbox')).getAllByRole('option');
    expect(traits.map((option) => option.textContent)).toEqual(['✓Nova Strike']);
    await user.keyboard('{Escape}');
    await user.click(within(dialog).getByRole('button', { name: 'Save trait offer' }));
    const apolloOffer = () => {
      const state = occurrences()[1]?.state;
      return state?.kind === 'counted' ? state.reward?.traitOffersByAcquisitionRole.source : null;
    };
    expect(apolloOffer()).toMatchObject({
      giverKey: 'Apollo',
      options: [
        { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
        { traitKey: 'ApolloSprintBoon', rarity: 'Common' },
        { traitKey: 'ApolloManaBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    });
    application.store.dispatch(authoredProjectUndoRequested());
    expect(apolloOffer()).toBeNull();
    application.store.dispatch(authoredProjectRedoRequested());
    expect(apolloOffer()).toMatchObject({ selectedOptionKey: 'option1' });

    // Incomplete, so not yet publishable; the complete route publishes normally.
    expect(application.projectOperations.inspectCurrentGamePlan()).toMatchObject({
      kind: 'notPublishable',
    });
  });

  it('observes Eris in the G intro timeline and undoes the observation', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createFreshFileRouteProject()));
    const { user } = renderPlannerForInteraction({ application });
    const workspace = () => {
      const state = application.store.getState().projectWorkspace;
      if (state.kind !== 'openProject') throw new Error('expected an open project');
      return state;
    };
    const intro = () =>
      workspace().history.present.route.biomes[1]!.topology!.occurrences.find(
        (occurrence) => occurrence.occurrenceId === freshFileGIntroId,
      )!;
    expect(workspace().assembly.evaluation.findings).toEqual([]);
    expect(application.projectOperations.inspectCurrentGamePlan()).toMatchObject({
      kind: 'publishable',
    });

    await user.click(screen.getByRole('button', { name: 'Oceanus' }));
    await user.click(screen.getByRole('button', { name: /^Entrance/ }));
    await user.click(screen.getByRole('tab', { name: 'Room Timeline' }));
    const timeline = () => screen.getByRole('region', { name: 'Room Timeline' });
    expect(within(timeline()).getByText('Talk to Eris')).toBeTruthy();
    await user.click(within(timeline()).getByRole('checkbox', { name: 'Eris has spawned' }));
    expect(intro().eris).toBeUndefined();
    expect(within(timeline()).queryByText('Talk to Eris')).toBeNull();

    application.store.dispatch(authoredProjectUndoRequested());
    expect(intro().roomActions.order.map((reference) => reference.kind)).toEqual([
      'interactEris',
      'interactAcquisitionEntry',
    ]);
    application.store.dispatch(authoredProjectRedoRequested());
    expect(intro().eris).toBeUndefined();
    application.dispose();
  });
});
