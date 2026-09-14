// @vitest-environment jsdom

import {
  createOccurrenceAddress,
  createTranscendentEmbryoOutcomeAddress,
  semanticAddressKey,
  type AuthoredTranscendentEmbryoOutcome,
} from '@run-planner/engine/authored-project';
import { catalog } from '@run-planner/hades2-catalog';
import type { InRunTraitRarity } from '@run-planner/engine/catalog-schema';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import type {
  WorkspaceInteractionCatalog,
  WorkspaceTranscendentEmbryoControl,
  WorkspaceTranscendentEmbryoInteraction,
} from '@planner/projections/structured-workspace';
import { TranscendentEmbryoEffectRow } from '@planner/ui/editor/biome/TranscendentEmbryoEffectRow';
import { goldenFBiome, goldenFOccurrenceId } from '@run-planner/test-fixtures/underworld';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TranscendentEmbryoEffectRow', () => {
  it('preserves the active slider across consecutive authored magnitude updates', () => {
    const application = createApplication();
    vi.spyOn(application.store, 'dispatch').mockImplementation(() => undefined as never);
    const address = createTranscendentEmbryoOutcomeAddress(
      createOccurrenceAddress(goldenFBiome, goldenFOccurrenceId(1, 1)),
      'Encounter',
    );
    const intentFor = vi.fn((value: AuthoredTranscendentEmbryoOutcome | null) => ({
      command: {
        kind: 'ReplaceTranscendentEmbryoTransformation' as const,
        outcome: address,
        value,
      },
    }));
    const initialValue: AuthoredTranscendentEmbryoOutcome = {
      blessingKey: 'ChaosExSpeedBlessing',
      blessingValues: { propertySpeed: 0.76, weaponSpeed: 0.79 },
    };
    const content = (
      value: AuthoredTranscendentEmbryoOutcome | undefined,
      rarity: InRunTraitRarity = 'Epic',
    ) => {
      const control: WorkspaceTranscendentEmbryoControl = {
        address,
        phaseKey: 'Encounter',
        marker: { address, assessment: 'assessed', findingCount: 0, focusKey: 'embryo' },
        value,
      };
      const interaction: WorkspaceTranscendentEmbryoInteraction = {
        key: semanticAddressKey(address),
        owner: address,
        intentFor,
        forBlessing: () => ({
          load: () => ({
            emptyNoOp: false,
            picker: { sections: [] },
            selectedPossible: true,
            rarity,
            ...(value === undefined
              ? {}
              : {
                  operands: catalog.chaos.blessings.byKey[value.blessingKey]!.operands,
                }),
          }),
        }),
        blessingLabel: (key) => catalog.chaos.blessings.byKey[key]!.label,
        outcomeFor: () => initialValue,
      };
      const interactions = {
        transcendentEmbryo: new Map([[interaction.key, interaction]]),
      } as unknown as WorkspaceInteractionCatalog;
      return (
        <Provider store={application.store}>
          <TranscendentEmbryoEffectRow control={control} interactions={interactions} />
        </Provider>
      );
    };
    const view = render(content(initialValue));
    const slider = screen.getByLabelText('Property speed');
    slider.focus();
    fireEvent.pointerDown(slider);
    for (const propertySpeed of [0.77, 0.78, 0.79]) {
      const value = {
        ...initialValue,
        blessingValues: { ...initialValue.blessingValues, propertySpeed },
      };
      fireEvent.input(slider, { target: { value: String(propertySpeed) } });
      expect(intentFor).toHaveBeenLastCalledWith(value);
      view.rerender(content(value));
      expect(screen.getByLabelText('Property speed')).toBe(slider);
      expect(document.activeElement).toBe(slider);
      expect(screen.getByLabelText('Property speed value').textContent).toBe(String(propertySpeed));
    }
    fireEvent.pointerUp(slider);

    const revisedValue = {
      ...initialValue,
      blessingValues: { propertySpeed: 0.82, weaponSpeed: 0.82 },
    };
    view.rerender(content(revisedValue, 'Rare'));
    expect(screen.getByText('Rarity:').textContent).toBe('Rarity: Rare');
    expect(screen.getByLabelText('Property speed')).toBe(slider);
    expect((slider as HTMLInputElement).min).toBe('0.78');
    expect((slider as HTMLInputElement).max).toBe('0.85');
    const weaponSpeed = screen.getByLabelText('Weapon speed');
    fireEvent.input(weaponSpeed, { target: { value: '0.83' } });
    expect(intentFor).toHaveBeenLastCalledWith({
      ...revisedValue,
      blessingValues: { propertySpeed: 0.82, weaponSpeed: 0.83 },
    });

    view.rerender(content(undefined));
    expect(screen.queryByLabelText('Property speed')).toBeNull();
    application.dispose();
  });
});
