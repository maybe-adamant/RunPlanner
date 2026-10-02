// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createProjectDocument,
  createRouteAddress,
  routeRunModifiers,
} from '@run-planner/engine/authored-project';
import {
  authoredProjectCommandDispatched,
  authoredProjectReplaced,
  authoredProjectUndoRequested,
  authoredProjectRedoRequested,
} from '@planner/state/projectWorkspaceSlice';
import {
  createOpenTestApplication,
  renderPlannerForInteraction,
} from '@planner-test/fixtures/renderPlanner';

import { createApplication } from '@planner/composition/createApplication';
import { createFakeProfileFiles } from '@planner-test/fixtures/profileFiles';

afterEach(cleanup);
const gold = () =>
  screen.getByRole('textbox', { name: 'Enemy gold-drop chance' }) as HTMLInputElement;
const crits = () => screen.getByRole('checkbox', { name: 'Guarantee eligible crits' });
const doubles = () => screen.getByRole('checkbox', { name: 'Guarantee eligible double damage' });

function open(routeKey = 'Underworld') {
  const view = renderPlannerForInteraction({ application: createOpenTestApplication(routeKey) });
  const project = () => view.application.store.getState().projectWorkspace.history!.present;
  return { ...view, project, modifiers: () => routeRunModifiers(project().route.loadout) };
}

describe('Run modifier authoring', () => {
  it('edits the independent toggles, commits fractions on Enter and blur, and resets native values', async () => {
    const view = open();
    expect(crits()).toHaveProperty('checked', false);
    expect(doubles()).toHaveProperty('checked', false);
    expect(gold().value).toBe('1');
    await view.user.click(crits());
    expect(view.modifiers()).toMatchObject({
      guaranteeEligibleCrits: true,
      guaranteeEligibleDoubleDamage: false,
    });
    await view.user.click(crits());
    await view.user.click(doubles());
    expect(view.modifiers()).toMatchObject({
      guaranteeEligibleCrits: false,
      guaranteeEligibleDoubleDamage: true,
    });
    await view.user.click(crits());
    fireEvent.change(gold(), { target: { value: '1.25' } });
    expect(view.modifiers().enemyGoldDropChanceMultiplier).toBe(1);
    fireEvent.keyDown(gold(), { key: 'Enter' });
    expect(view.modifiers()).toMatchObject({
      guaranteeEligibleCrits: true,
      guaranteeEligibleDoubleDamage: true,
      enemyGoldDropChanceMultiplier: 1.25,
    });
    fireEvent.change(gold(), { target: { value: '1' } });
    fireEvent.blur(gold());
    await view.user.click(crits());
    await view.user.click(doubles());
    expect(view.project().route.loadout.runModifiers).toBeUndefined();
  });

  it('commits on the actual blur before a checkbox click without losing either edit', async () => {
    const view = open();
    await view.user.click(gold());
    await view.user.clear(gold());
    await view.user.type(gold(), '2.75');
    await view.user.click(crits());
    expect(view.modifiers()).toEqual({
      guaranteeEligibleCrits: true,
      guaranteeEligibleDoubleDamage: false,
      enemyGoldDropChanceMultiplier: 2.75,
    });
    expect(gold().value).toBe('2.75');
  });

  it.each(['', '-', '1e', 'NaN', 'Infinity', '0.5', '1e309'])(
    'keeps invalid draft %j visible with an accessible error',
    (text) => {
      const view = open();
      fireEvent.change(gold(), { target: { value: text } });
      fireEvent.blur(gold());
      expect(gold().value).toBe(text);
      expect(gold().getAttribute('aria-invalid')).toBe('true');
      expect(screen.getByRole('alert').textContent).toBe(
        'Enter a finite multiplier of at least 1.',
      );
      expect(gold().getAttribute('aria-describedby')).toContain(screen.getByRole('alert').id);
      expect(view.project().route.loadout.runModifiers).toBeUndefined();
      fireEvent.keyDown(gold(), { key: 'Escape' });
      expect(gold().value).toBe('1');
      expect(screen.queryByRole('alert')).toBeNull();
    },
  );

  it('retains a partial draft across sibling and unrelated edits and commits with current siblings', async () => {
    const view = open();
    await view.user.click(gold());
    fireEvent.change(gold(), { target: { value: '2e' } });
    await view.user.click(crits());
    expect(gold().value).toBe('2e');
    await view.user.click(doubles());
    act(() =>
      view.application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ConfigureRoutePrefix',
          route: createRouteAddress('Underworld'),
          configuredBiomeCount: 1,
        }),
      ),
    );
    expect(gold().value).toBe('2e');
    fireEvent.change(gold(), { target: { value: '2.5' } });
    fireEvent.keyDown(gold(), { key: 'Enter' });
    expect(view.modifiers()).toEqual({
      guaranteeEligibleCrits: true,
      guaranteeEligibleDoubleDamage: true,
      enemyGoldDropChanceMultiplier: 2.5,
    });
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(gold().value).toBe('1');
    fireEvent.change(gold(), { target: { value: '3e' } });
    act(() => view.application.store.dispatch(authoredProjectRedoRequested()));
    expect(gold().value).toBe('2.5');
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.change(gold(), { target: { value: '4e' } });
    act(() =>
      view.application.store.dispatch(
        authoredProjectReplaced(
          createProjectDocument(view.application.catalog, {
            projectId: 'different',
            routeKey: 'Underworld',
            configuredBiomeCount: 0,
          }),
        ),
      ),
    );
    expect(gold().value).toBe('1');
  });

  it('clears a pending error when the same saved document is reopened', async () => {
    const files = createFakeProfileFiles();
    const application = createApplication({ profileFile: files.adapter });
    const saved = createProjectDocument(application.catalog, {
      projectId: 'same-id',
      routeKey: 'Underworld',
      configuredBiomeCount: 0,
    });
    await files.openSaved(application, saved, 'same.runplanner.json');
    renderPlannerForInteraction({ application });
    fireEvent.change(gold(), { target: { value: '2e' } });
    fireEvent.blur(gold());
    expect(screen.getByRole('alert')).toBeTruthy();
    await act(async () => {
      await files.openSaved(application, saved, 'same.runplanner.json');
    });
    expect(gold().value).toBe('1');
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.keyDown(gold(), { key: 'Enter' });
    expect(
      application.store.getState().projectWorkspace.history!.present.route.loadout.runModifiers,
    ).toBeUndefined();
    expect(application.store.getState().projectWorkspace.history!.past).toHaveLength(0);

    fireEvent.change(gold(), { target: { value: '3e' } });
    fireEvent.blur(gold());
    act(() => application.store.dispatch(authoredProjectReplaced(saved)));
    expect(gold().value).toBe('1');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('allows modifiers on Fresh File while preserving fixed native equipment', async () => {
    const view = open('FreshFile');
    expect(screen.getByLabelText('Fixed starting loadout').textContent).toContain(
      "Witch's Staff, no Aspect",
    );
    expect(screen.queryByRole('button', { name: 'Edit Arcana' })).toBeNull();
    expect(screen.queryByLabelText('Starting reward')).toBeNull();
    await view.user.click(crits());
    await view.user.click(doubles());
    fireEvent.change(gold(), { target: { value: '1.5' } });
    fireEvent.blur(gold());
    expect(view.modifiers()).toEqual({
      guaranteeEligibleCrits: true,
      guaranteeEligibleDoubleDamage: true,
      enemyGoldDropChanceMultiplier: 1.5,
    });
    expect(view.project().route.loadout).toMatchObject({
      weaponKey: null,
      aspectKey: null,
      startingKeepsakeKey: null,
    });
  });
});
