// @vitest-environment jsdom

import {
  createKeepsakeEquipResultAddress,
  createRouteStartKeepsakeSelectionAddress,
  semanticAddressKey,
  type AuthoredKeepsakeEquipResults,
} from '@run-planner/engine/authored-project';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { catalog } from '@run-planner/hades2-catalog';
import type { WorkspaceTranscendentEmbryoEquipResultInteraction } from '@planner/projections/structured-workspace';
import { declaredChoicesPicker } from '@planner/projections/contextual/contextualPicker';
import type { WorkspaceKeepsakeSelectionInteraction } from '@planner/projections/structured-workspace';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import {
  KeepsakeEquipResultPicker,
  KeepsakeSelectionPicker,
} from '@planner/ui/editor/KeepsakePickers';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('KeepsakeEquipResultPicker', () => {
  it('keeps exact Embryo operands visible while dispatching and reloading an edit', async () => {
    const application = createApplication();
    vi.spyOn(application.store, 'dispatch').mockImplementation(() => undefined as never);
    const owner = createKeepsakeEquipResultAddress(
      createRouteStartKeepsakeSelectionAddress('Underworld'),
      'transcendentEmbryo',
    );
    const value: NonNullable<AuthoredKeepsakeEquipResults['transcendentEmbryo']> = {
      blessingKey: 'ChaosExSpeedBlessing',
      blessingValues: { propertySpeed: 0.76, weaponSpeed: 0.79 },
    };
    const intentFor = vi.fn((next: typeof value) => ({
      command: {
        kind: 'ReplaceTranscendentEmbryoEquipResult' as const,
        result: owner,
        value: next,
      },
    }));
    const revelationOperands = catalog.chaos.blessings.byKey.ChaosExSpeedBlessing!.operands;
    const interaction: WorkspaceTranscendentEmbryoEquipResultInteraction = {
      key: semanticAddressKey(owner),
      owner,
      value,
      load: () => ({
        picker: { sections: [] },
        transcendentEmbryoSummary: {
          rarity: 'Epic',
          operands: revelationOperands,
        },
      }),
      selectedLabel: 'Chaos Revelation',
      outcomeFor: (blessingKey) => ({
        blessingKey,
        blessingValues: { propertySpeed: 0.76, weaponSpeed: 0.79 },
      }),
      intentFor,
    };
    const unselectedInteraction: WorkspaceTranscendentEmbryoEquipResultInteraction = {
      ...interaction,
      value: undefined,
      selectedLabel: 'Choose Chaos blessing',
      load: () => ({ picker: { sections: [] } }),
    };
    const view = render(
      <Provider store={application.store}>
        <KeepsakeEquipResultPicker id="embryo-result" interaction={unselectedInteraction} />
      </Provider>,
    );

    expect(screen.queryByLabelText('Property speed')).toBeNull();
    view.rerender(
      <Provider store={application.store}>
        <KeepsakeEquipResultPicker id="embryo-result" interaction={interaction} />
      </Provider>,
    );
    const propertySpeed = await screen.findByLabelText('Property speed');
    expect(screen.getByText('Target')).toBeTruthy();
    expect(screen.getByText('Rarity:').textContent).toBe('Rarity: Epic');
    expect(propertySpeed.closest('.transcendent-embryo-outcome-row')).toBeTruthy();
    expect((propertySpeed as HTMLInputElement).type).toBe('range');
    expect(screen.getByLabelText('Property speed value').textContent).toBe('0.76');
    propertySpeed.focus();
    fireEvent.pointerDown(propertySpeed);
    fireEvent.change(propertySpeed, { target: { value: '0.77' } });
    await waitFor(() => expect(intentFor).toHaveBeenCalled());
    expect(intentFor).toHaveBeenLastCalledWith({
      blessingKey: 'ChaosExSpeedBlessing',
      blessingValues: { propertySpeed: 0.77, weaponSpeed: 0.79 },
    });

    const nextValue = {
      blessingKey: 'ChaosExSpeedBlessing',
      blessingValues: { propertySpeed: 0.77, weaponSpeed: 0.79 },
    } as const;
    const nextInteraction: WorkspaceTranscendentEmbryoEquipResultInteraction = {
      ...interaction,
      value: nextValue,
      load: () => ({
        picker: { sections: [] },
        transcendentEmbryoSummary: {
          rarity: 'Epic',
          operands: revelationOperands,
        },
      }),
    };
    view.rerender(
      <Provider store={application.store}>
        <KeepsakeEquipResultPicker id="embryo-result" interaction={nextInteraction} />
      </Provider>,
    );
    expect(screen.getByLabelText('Property speed')).toBe(propertySpeed);
    expect((propertySpeed as HTMLInputElement).value).toBe('0.77');
    expect(document.activeElement).toBe(propertySpeed);
    fireEvent.input(propertySpeed, { target: { value: '0.78' } });
    expect(intentFor).toHaveBeenLastCalledWith({
      ...nextValue,
      blessingValues: { propertySpeed: 0.78, weaponSpeed: 0.79 },
    });
    fireEvent.pointerUp(propertySpeed);

    view.rerender(
      <Provider store={application.store}>
        <KeepsakeEquipResultPicker id="embryo-result" interaction={unselectedInteraction} />
      </Provider>,
    );
    expect(screen.queryByLabelText('Property speed')).toBeNull();
    application.dispose();
  });
});

describe('KeepsakeSelectionPicker', () => {
  it('dispatches its selection through the bound intent, including its declared focus', async () => {
    const application = createApplication();
    const dispatch = vi
      .spyOn(application.store, 'dispatch')
      .mockImplementation((action) => action as never);
    const owner = createRouteStartKeepsakeSelectionAddress('Underworld');
    const command = {
      kind: 'ReplaceStartingKeepsake' as const,
      selection: owner,
      keepsakeKey: 'BlockDeathKeepsake',
    };
    const interaction: WorkspaceKeepsakeSelectionInteraction = {
      key: semanticAddressKey(owner),
      load: () =>
        declaredChoicesPicker(
          [{ key: 'BlockDeathKeepsake', value: 'BlockDeathKeepsake', label: 'Silver Wheel' }],
          '',
        ),
      owner,
      selectedLabel: 'Choose keepsake',
      replaceIntent: () => ({ command, focus: { owner, timing: 'after' } }) as never,
    };
    render(
      <Provider store={application.store}>
        <KeepsakeSelectionPicker id="keepsake" interaction={interaction} label="Keepsake" />
      </Provider>,
    );
    const user = userEvent.setup();
    await user.click(document.getElementById('keepsake')!);
    dispatch.mockClear();
    await user.click(await screen.findByRole('option', { name: /Silver Wheel/ }));
    expect(dispatch.mock.calls.map(([action]) => action)).toEqual([
      authoredProjectCommandDispatched(command as never),
      semanticOwnerFocused(owner),
    ]);
    application.dispose();
  });
});
