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
import { OptionalPercentageRunModifier } from '@planner/ui/shell/RouteModifiersPanel';
import {
  createOpenTestApplication,
  renderPlannerForInteraction,
} from '@planner-test/fixtures/renderPlanner';
import { hintOf } from '@planner-test/support/hints';
import { routePanelSelected } from '@planner/state/editorSessionSlice';
import { createApplication } from '@planner/composition/createApplication';
import { newProjectCreated } from '@planner/state/profileSessionSlice';
import { createGoldenFGHIProject } from '@run-planner/test-fixtures/underworld';

afterEach(cleanup);
const slider = (name: string) => screen.getByRole('slider', { name }) as HTMLInputElement;
const toggle = (name: string) => screen.getByRole('checkbox', { name }) as HTMLInputElement;
const chance = () => slider('Enemy gold drop chance');
const range = () => slider('Encounter gold range');

function open(routeKey = 'Underworld') {
  const application = createOpenTestApplication(routeKey);
  application.store.dispatch(routePanelSelected({ routeKey, panel: { kind: 'modifiers' } }));
  const view = renderPlannerForInteraction({ application });
  const project = () => view.application.store.getState().projectWorkspace.history!.present;
  return { ...view, project, modifiers: () => routeRunModifiers(project().route.loadout) };
}

describe('Run modifier authoring', () => {
  it('renders each percentage as an unchecked checkbox and a disabled slider', () => {
    open();
    expect(screen.getByRole('heading', { name: 'Modifiers' })).toBeTruthy();
    const percentages = RUN_MODIFIER_DECLARATIONS.filter((d) => d.kind === 'optionalPercentage');
    expect(screen.getAllByRole('slider')).toHaveLength(percentages.length);
    for (const declaration of percentages) {
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
    act(() => {
      view.application.store.dispatch(authoredProjectReplaced(saved));
      // Replacement returns the workspace to Route.
      view.application.store.dispatch(
        routePanelSelected({ routeKey: 'Underworld', panel: { kind: 'modifiers' } }),
      );
    });
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

describe('Practice mode', () => {
  function openGolden(startPoint?: unknown) {
    const application = createApplication({ devBuild: false });
    const golden = createGoldenFGHIProject();
    application.store.dispatch(
      newProjectCreated(
        startPoint === undefined
          ? golden
          : {
              ...golden,
              route: {
                ...golden.route,
                loadout: { ...golden.route.loadout, runModifiers: { startPoint } },
              } as typeof golden.route,
            },
      ),
    );
    const view = renderPlannerForInteraction({ application });
    const project = () => view.application.store.getState().projectWorkspace.history!.present;
    return { ...view, project, modifiers: () => routeRunModifiers(project().route.loadout) };
  }
  const practice = () => toggle('Practice mode');
  const startAt = () => screen.getByRole('button', { name: /^Start at/ }) as HTMLButtonElement;
  const gold = () => screen.getByRole('textbox', { name: 'Gold' }) as HTMLInputElement;

  it('opens the picker from the checkbox, sets a start point, and clears it in one step', async () => {
    const view = openGolden();
    expect(practice().checked).toBe(false);
    expect(startAt().disabled).toBe(true);
    expect(gold().disabled).toBe(true);
    await view.user.click(practice());
    const unavailable = await screen.findByRole('button', { name: 'Erebus Opening' });
    expect(unavailable.getAttribute('aria-disabled')).toBe('true');
    // Evident reasons carry no hover; neither do available options nor the row itself.
    expect(hintOf(unavailable)).toBeNull();
    expect(hintOf(screen.getByRole('button', { name: 'Fields Preboss' }))).toBeNull();
    expect(practice().getAttribute('aria-description')).toBeNull();
    expect(hintOf(practice().closest('.route-run-modifier-practice'))).toBeNull();
    expect(hintOf(startAt())).toBeNull();
    await view.user.click(unavailable);
    expect(view.modifiers()).toEqual({});
    // Closing without a choice leaves Practice mode off and returns focus to its checkbox.
    await view.user.keyboard('{Escape}');
    expect(practice().checked).toBe(false);
    expect(document.activeElement).toBe(practice());
    expect(view.modifiers()).toEqual({});
    // Clicking the checkbox while choosing cancels rather than reopening the picker.
    await view.user.click(practice());
    expect(await screen.findByRole('group', { name: 'Start points' })).toBeTruthy();
    await view.user.click(practice());
    expect(practice().checked).toBe(false);
    expect(screen.queryByRole('group', { name: 'Start points' })).toBeNull();
    expect(view.modifiers()).toEqual({});
    await view.user.click(practice());
    await view.user.click(await screen.findByRole('button', { name: 'Fields Preboss' }));
    expect(view.modifiers()).toEqual({ startPoint: { biomeKey: 'H', point: 'preboss' } });
    expect(practice().checked).toBe(true);
    expect(startAt().textContent).toContain('Fields · Preboss');
    expect(gold().placeholder).toBe('0');
    // Unparsable text stays in the field as an invalid draft.
    await view.user.type(gold(), 'abc{Enter}');
    expect(gold().value).toBe('abc');
    expect(gold().getAttribute('aria-invalid')).toBe('true');
    expect(view.modifiers()).toEqual({ startPoint: { biomeKey: 'H', point: 'preboss' } });
    await view.user.clear(gold());
    await view.user.type(gold(), '250{Enter}');
    expect(view.modifiers()).toEqual({
      startPoint: { biomeKey: 'H', point: 'preboss', gold: 250 },
    });
    await view.user.click(practice());
    expect(view.project().route.loadout.runModifiers).toBeUndefined();
    expect(gold().value).toBe('');
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(view.modifiers()).toEqual({
      startPoint: { biomeKey: 'H', point: 'preboss', gold: 250 },
    });
  });

  it('keeps an ineligible saved start point checked with a quiet unavailable label', () => {
    openGolden({ biomeKey: 'N', point: 'opening' });
    expect(practice().checked).toBe(true);
    expect(screen.getByRole('button', { name: 'Start at Ephyra · Opening (unavailable)' })).toBe(
      startAt(),
    );
    // The Game panel states the reason; the label stays quiet.
    expect(hintOf(startAt())).toBeNull();
  });
});
