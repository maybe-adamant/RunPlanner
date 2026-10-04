// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it } from 'vitest';
import {
  RUN_MODIFIER_DECLARATIONS,
  createRouteAddress,
  routeRunModifiers,
  runModifierDeclaration,
} from '@run-planner/engine/authored-project';
import {
  authoredProjectCommandDispatched,
  authoredProjectReplaced,
  authoredProjectUndoRequested,
  authoredProjectRedoRequested,
} from '@planner/state/projectWorkspaceSlice';
import type { WorkspaceRoute } from '@planner/projections/structured-workspace';
import { NumberRunModifierSlider } from '@planner/ui/shell/RouteOverview';
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
    expect(view.modifiers()).toEqual({ enemyGoldDropChanceMultiplier: 1.2 });
    fireEvent.change(gold(), { target: { value: '1' } });
    fireEvent.blur(gold());
    expect(view.project().route.loadout.runModifiers).toBeUndefined();
  });

  it('renders each released declaration by kind with its own label and hover help', () => {
    open();
    expect(screen.getByRole('heading', { name: 'Loadout' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Modifiers' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'About run modifiers' })).toBeNull();
    const released = RUN_MODIFIER_DECLARATIONS.filter((d) => d.stage === 'released');
    expect(screen.getAllByRole('slider')).toHaveLength(
      released.filter((d) => d.kind === 'number').length,
    );
    const declaration = runModifierDeclaration('enemyGoldDropChanceMultiplier');
    expect(gold().getAttribute('aria-description')).toBe(declaration.description);
    expect(gold().closest('.route-run-modifier-number')?.getAttribute('title')).toBe(
      declaration.description,
    );
    expect(screen.getByText('1× (Vanilla)')).toBeTruthy();
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

  // jsdom sanitizes a range value into its declared domain, so the projection's
  // invalid draft result is driven through a stubbed control.
  it('shows a rejected draft on hover and the accessible description without page text', () => {
    const application = createOpenTestApplication();
    const declaration = runModifierDeclaration('enemyGoldDropChanceMultiplier');
    if (declaration.kind !== 'number') throw new Error('expected a number declaration');
    const control: WorkspaceRoute['runModifiers'] = {
      value: { enemyGoldDropChanceMultiplier: 1 },
      declarations: [declaration],
      setValue: () => {
        throw new Error('not a boolean modifier');
      },
      draftIntent: () => ({ kind: 'invalid', message: 'Enter a value from 1 to 5.' }),
    };
    render(
      <Provider store={application.store}>
        <NumberRunModifierSlider control={control} declaration={declaration} id="gold-stub" />
      </Provider>,
    );
    fireEvent.change(gold(), { target: { value: '2' } });
    fireEvent.blur(gold());
    expect(gold().getAttribute('aria-invalid')).toBe('true');
    expect(gold().getAttribute('aria-description')).toBe('Enter a value from 1 to 5.');
    expect(gold().closest('.route-run-modifier-number')?.getAttribute('title')).toBe(
      'Enter a value from 1 to 5.',
    );
    // The rejection adds no page text: only the label and the output remain.
    expect(document.body.textContent).toBe('Enemy gold chance2×');
    expect(screen.queryByRole('alert')).toBeNull();
    application.dispose();
  });

  it('clamps a stored multiplier above the slider range to 5', () => {
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
    expect(screen.getByText('5×')).toBeTruthy();
    fireEvent.blur(gold());
    expect(view.modifiers().enemyGoldDropChanceMultiplier).toBe(5);
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
    expect(view.modifiers()).toEqual({ enemyGoldDropChanceMultiplier: 1.5 });
    expect(view.project().route.loadout).toMatchObject({
      weaponKey: null,
      aspectKey: null,
      startingKeepsakeKey: null,
    });
  });
});
