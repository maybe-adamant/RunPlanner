// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createRouteAddress, routeRunModifiers } from '@run-planner/engine/authored-project';
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

afterEach(cleanup);
const gold = () => screen.getByRole('slider', { name: 'Enemy gold chance' }) as HTMLInputElement;

function open(routeKey = 'Underworld') {
  const view = renderPlannerForInteraction({ application: createOpenTestApplication(routeKey) });
  const project = () => view.application.store.getState().projectWorkspace.history!.present;
  return { ...view, project, modifiers: () => routeRunModifiers(project().route.loadout) };
}

describe('Run modifier authoring', () => {
  it('commits fractions on Enter and blur and resets native values', () => {
    const view = open();
    expect(gold().value).toBe('1');
    fireEvent.change(gold(), { target: { value: '1.2' } });
    expect(view.modifiers().enemyGoldDropChanceMultiplier).toBe(1);
    fireEvent.keyDown(gold(), { key: 'Enter' });
    expect(view.modifiers()).toEqual({
      guaranteeEligibleCrits: false,
      guaranteeEligibleDoubleDamage: false,
      enemyGoldDropChanceMultiplier: 1.2,
    });
    fireEvent.change(gold(), { target: { value: '1' } });
    fireEvent.blur(gold());
    expect(view.project().route.loadout.runModifiers).toBeUndefined();
  });

  it('keeps the guarantee toggles out of the editor while their authored values persist', () => {
    const view = open();
    expect(screen.queryByRole('checkbox', { name: 'Guaranteed crits' })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Guaranteed double damage' })).toBeNull();
    act(() =>
      view.application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceRunModifiers',
          route: createRouteAddress('Underworld'),
          value: { ...view.modifiers(), guaranteeEligibleCrits: true },
        }),
      ),
    );
    fireEvent.change(gold(), { target: { value: '1.5' } });
    fireEvent.blur(gold());
    expect(view.modifiers()).toMatchObject({
      guaranteeEligibleCrits: true,
      enemyGoldDropChanceMultiplier: 1.5,
    });
  });

  it('puts concise hover help on each option without an extra button', () => {
    open();
    expect(screen.getByRole('heading', { name: 'Loadout' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Modifiers' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'About run modifiers' })).toBeNull();
    expect(gold().getAttribute('aria-description')).toContain('room gold limits');
  });

  it('commits a slider gesture once and restores it through history and replacement', () => {
    const view = open();
    expect(gold().min).toBe('1');
    expect(gold().max).toBe('5');
    expect(gold().step).toBe('0.1');
    fireEvent.change(gold(), { target: { value: '2.1' } });
    fireEvent.change(gold(), { target: { value: '5' } });
    expect(view.modifiers().enemyGoldDropChanceMultiplier).toBe(1);
    fireEvent.pointerUp(gold());
    expect(view.modifiers().enemyGoldDropChanceMultiplier).toBe(5);
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(gold().value).toBe('1');
    act(() => view.application.store.dispatch(authoredProjectRedoRequested()));
    expect(gold().value).toBe('5');
    fireEvent.change(gold(), { target: { value: '3' } });
    const saved = view.project();
    act(() => view.application.store.dispatch(authoredProjectReplaced(saved)));
    expect(gold().value).toBe('5');
    fireEvent.change(gold(), { target: { value: '2.5' } });
    fireEvent.keyUp(gold(), { key: 'ArrowLeft' });
    expect(view.modifiers().enemyGoldDropChanceMultiplier).toBe(2.5);
  });

  it('preserves an existing multiplier above the slider range until edited', () => {
    const view = open();
    act(() =>
      view.application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceRunModifiers',
          route: createRouteAddress('Underworld'),
          value: { ...view.modifiers(), enemyGoldDropChanceMultiplier: 8 },
        }),
      ),
    );
    expect(screen.getByText('8×')).toBeTruthy();
    fireEvent.blur(gold());
    expect(view.modifiers().enemyGoldDropChanceMultiplier).toBe(8);
  });

  it('allows modifiers on Fresh File while preserving fixed native equipment', () => {
    const view = open('FreshFile');
    expect(screen.getByLabelText('Fixed starting loadout').textContent).toContain(
      "Witch's Staff, no Aspect",
    );
    expect(screen.queryByRole('button', { name: 'Edit Arcana' })).toBeNull();
    expect(screen.queryByLabelText('Starting reward')).toBeNull();
    fireEvent.change(gold(), { target: { value: '1.5' } });
    fireEvent.blur(gold());
    expect(view.modifiers()).toEqual({
      guaranteeEligibleCrits: false,
      guaranteeEligibleDoubleDamage: false,
      enemyGoldDropChanceMultiplier: 1.5,
    });
    expect(view.project().route.loadout).toMatchObject({
      weaponKey: null,
      aspectKey: null,
      startingKeepsakeKey: null,
    });
  });
});
