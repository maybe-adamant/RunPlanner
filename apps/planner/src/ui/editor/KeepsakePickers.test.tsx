// @vitest-environment jsdom

import {
  createKeepsakeEquipResultAddress,
  createRouteStartKeepsakeSelectionAddress,
  semanticAddressKey,
  type AuthoredKeepsakeEquipResults,
} from '@run-planner/engine/authored-project';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { catalog } from '@run-planner/hades2-catalog';
import type { WorkspaceTranscendentEmbryoEquipResultInteraction } from '@planner/projections/structured-workspace';
import { KeepsakeEquipResultPicker } from './KeepsakePickers';

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
    expect((screen.getByLabelText('Property speed') as HTMLInputElement).value).toBe('0.77');
    application.dispose();
  });
});
