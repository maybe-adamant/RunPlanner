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
import { OptionalPercentageRunModifier } from '@planner/ui/shell/RouteOverview';
import {
  createOpenTestApplication,
  renderPlannerForInteraction,
} from '@planner-test/fixtures/renderPlanner';
import { hintOf } from '@planner-test/support/hints';

afterEach(cleanup);
const slider = (name: string) => screen.getByRole('slider', { name }) as HTMLInputElement;
const toggle = (name: string) => screen.getByRole('checkbox', { name }) as HTMLInputElement;
const chance = () => slider('Enemy gold drop chance');
const range = () => slider('Encounter gold range');

function open(routeKey = 'Underworld') {
  const view = renderPlannerForInteraction({ application: createOpenTestApplication(routeKey) });
  const project = () => view.application.store.getState().projectWorkspace.history!.present;
  return { ...view, project, modifiers: () => routeRunModifiers(project().route.loadout) };
}

describe('Run modifier authoring', () => {
  it('renders each released percentage as an unchecked checkbox and a disabled slider', () => {
    open();
    expect(screen.getByRole('heading', { name: 'Modifiers' })).toBeTruthy();
    const released = RUN_MODIFIER_DECLARATIONS.filter((d) => d.stage === 'released');
    expect(screen.getAllByRole('slider')).toHaveLength(released.length);
    for (const declaration of released) {
      expect(toggle(declaration.label).checked).toBe(false);
      const control = slider(declaration.label);
      expect(control.disabled).toBe(true);
      expect([control.min, control.max, control.step, control.value]).toEqual([
        '0',
        '100',
        '1',
        '100',
      ]);
      expect(control.getAttribute('aria-valuetext')).toBeNull();
      expect(control.parentElement?.querySelector('output')?.textContent).toBe('');
      expect(control.getAttribute('aria-description')).toBe(declaration.description);
      expect(hintOf(control.closest('.route-run-modifier-percentage'))).toBe(
        declaration.description,
      );
    }
    expect(runModifierDeclaration('enemyGoldDropChance').label).toBe('Enemy gold drop chance');
  });

  it('enables at 100%, commits a gesture once, and remembers the last value only in the UI', () => {
    const view = open();
    fireEvent.click(toggle('Enemy gold drop chance'));
    expect(view.modifiers()).toEqual({ enemyGoldDropChance: 100 });
    expect(chance().disabled).toBe(false);
    expect(range().disabled).toBe(true);
    fireEvent.change(chance(), { target: { value: '60' } });
    fireEvent.change(chance(), { target: { value: '35' } });
    expect(view.modifiers().enemyGoldDropChance).toBe(100);
    fireEvent.pointerUp(chance());
    expect(view.modifiers()).toEqual({ enemyGoldDropChance: 35 });
    expect(chance().getAttribute('aria-valuetext')).toBe('35%');
    fireEvent.click(toggle('Enemy gold drop chance'));
    expect(view.project().route.loadout.runModifiers).toBeUndefined();
    expect(chance().disabled).toBe(true);
    expect(chance().value).toBe('35');
    fireEvent.click(toggle('Enemy gold drop chance'));
    expect(view.modifiers()).toEqual({ enemyGoldDropChance: 35 });
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(toggle('Enemy gold drop chance').checked).toBe(false);
    act(() => view.application.store.dispatch(authoredProjectRedoRequested()));
    expect(chance().value).toBe('35');
    fireEvent.change(chance(), { target: { value: '20' } });
    const saved = view.project();
    act(() => view.application.store.dispatch(authoredProjectReplaced(saved)));
    expect(chance().value).toBe('35');
    fireEvent.change(chance(), { target: { value: '0' } });
    fireEvent.keyUp(chance(), { key: 'ArrowLeft' });
    expect(view.modifiers()).toEqual({ enemyGoldDropChance: 0 });
  });

  // jsdom sanitizes a range value into its declared domain, so the projection's
  // invalid draft result is driven through a stubbed control.
  it('shows a rejected draft on hover and the accessible description without page text', () => {
    const application = createOpenTestApplication();
    const declaration = runModifierDeclaration('encounterGoldRange');
    if (declaration.kind !== 'optionalPercentage') throw new Error('expected a percentage');
    const control: WorkspaceRoute['runModifiers'] = {
      value: { encounterGoldRange: 50 },
      declarations: [declaration],
      setValue: () => {
        throw new Error('not a boolean modifier');
      },
      clearValue: () => {
        throw new Error('not cleared here');
      },
      draftIntent: () => ({ kind: 'invalid', message: 'Enter a value from 0 to 100.' }),
    };
    render(
      <Provider store={application.store}>
        <OptionalPercentageRunModifier control={control} declaration={declaration} id="stub" />
      </Provider>,
    );
    fireEvent.change(range(), { target: { value: '20' } });
    fireEvent.blur(range());
    expect(range().getAttribute('aria-invalid')).toBe('true');
    expect(range().getAttribute('aria-description')).toBe('Enter a value from 0 to 100.');
    expect(hintOf(range().closest('.route-run-modifier-percentage'))).toBe(
      'Enter a value from 0 to 100.',
    );
    // The rejection adds no page text: only the label and the output remain.
    expect(document.body.textContent).toBe('Encounter gold range20%');
    expect(screen.queryByRole('alert')).toBeNull();
    application.dispose();
  });

  it('clamps a stored percentage above the slider range to 100', () => {
    const view = open();
    act(() =>
      view.application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceRunModifiers',
          route: createRouteAddress('Underworld'),
          value: { encounterGoldRange: 250 },
        }),
      ),
    );
    expect(range().value).toBe('100');
    expect(view.modifiers()).toEqual({ encounterGoldRange: 100 });
  });

  it('allows modifiers on Fresh File while preserving fixed native equipment', () => {
    const view = open('FreshFile');
    expect(screen.getByLabelText('Fixed starting loadout').textContent).toContain(
      "Witch's Staff, no Aspect",
    );
    expect(screen.queryByRole('button', { name: 'Edit Arcana' })).toBeNull();
    fireEvent.click(toggle('Encounter gold range'));
    fireEvent.change(range(), { target: { value: '15' } });
    fireEvent.blur(range());
    expect(view.modifiers()).toEqual({ encounterGoldRange: 15 });
    expect(view.project().route.loadout).toMatchObject({
      weaponKey: null,
      aspectKey: null,
      startingKeepsakeKey: null,
    });
  });
});
