// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { decodeProjectDocument, routeRunModifiers } from '@run-planner/engine/authored-project';
import { decodeExecutionPlan } from '@run-planner/engine/execution-plan';
import { loadSurfaceNProject } from '@run-planner/test-fixtures/surface';
import { createApplication } from '@planner/composition/createApplication';
import {
  authoredProjectUndoRequested,
  authoredProjectRedoRequested,
} from '@planner/state/projectWorkspaceSlice';
import { createFakeGameModuleHost } from '@planner-test/fixtures/gameModuleHost';
import { createFakeProfileFiles } from '@planner-test/fixtures/profileFiles';
import { renderPlannerForInteraction } from '@planner-test/fixtures/renderPlanner';

afterEach(cleanup);

it('restores authored modifiers through history, saved reload and published execution', async () => {
  const files = createFakeProfileFiles();
  const game = createFakeGameModuleHost();
  const application = createApplication({ profileFile: files.adapter, gameModuleHost: game.host });
  await files.openSaved(application, loadSurfaceNProject(), 'modifiers.runplanner.json');
  const { user } = renderPlannerForInteraction({ application });
  await user.click(screen.getByRole('button', { name: 'Loadout' }));
  const gold = () =>
    screen.getByRole('slider', { name: 'Encounter gold range' }) as HTMLInputElement;
  await user.click(screen.getByRole('checkbox', { name: 'Encounter gold range' }));
  fireEvent.change(gold(), { target: { value: '35' } });
  fireEvent.keyDown(gold(), { key: 'Enter' });
  act(() => application.store.dispatch(authoredProjectUndoRequested()));
  expect(gold().value).toBe('100');
  act(() => application.store.dispatch(authoredProjectRedoRequested()));
  expect(gold().value).toBe('35');
  const expected = { encounterGoldRange: 35 };
  await act(async () => {
    expect((await application.projectOperations.saveProfile()).status).toBe('success');
  });
  const saved = decodeProjectDocument(JSON.parse(files.writes.at(-1)!.json), application.catalog);
  expect(routeRunModifiers(saved.route.loadout)).toEqual(expected);
  await act(async () => {
    await files.openSaved(application, saved, 'modifiers.runplanner.json');
  });
  expect(gold().value).toBe('35');
  await act(async () => {
    expect((await application.projectOperations.publishGame(1)).status).toBe('success');
  });
  expect(decodeExecutionPlan(JSON.parse(game.published.at(-1)!.json)).runModifiers).toEqual(
    expected,
  );
});
