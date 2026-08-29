// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  createFountainRarityOutcomeAddress,
  createOccurrenceId,
  createRoomActionAddress,
  roomActionKey,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import userEvent from '@testing-library/user-event';
import { act, cleanup, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import {
  authoredProjectReplaced,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import type {
  WorkspaceFountainRarityControl,
  WorkspaceFountainRarityDomain,
  WorkspaceFountainRarityInteraction,
  WorkspaceInteractionCatalog,
} from '@planner/projections/structured-workspace';
import { FountainRarityEffectRow } from './FountainRarityEffectRow';
import { createCompleteFGProject, goldenFBiome } from '@run-planner/test-fixtures/underworld';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('FountainRarityEffectRow', () => {
  it('keeps a retained invalid target visible and dispatches its exact clear intent', async () => {
    const application = createApplication();
    vi.spyOn(application.store, 'dispatch').mockImplementation(() => undefined as never);
    const action = createRoomActionAddress(
      goldenFBiome,
      createOccurrenceId('golden-f-preboss-shop:postboss'),
      roomActionKey({ kind: 'useFountain' }),
    );
    const outcome = createFountainRarityOutcomeAddress(action);
    const control: WorkspaceFountainRarityControl = {
      address: outcome,
      marker: {
        address: outcome,
        assessment: 'assessed',
        findingCount: 1,
        focusKey: 'test-phial-retained-invalid',
      },
      targetTraitKey: 'HestiaWeaponBoon',
    };
    const clearIntent = vi.fn(() => ({
      command: {
        kind: 'ReplaceFountainRarityTarget' as const,
        outcome,
        targetTraitKey: null,
      },
    }));
    const domain: WorkspaceFountainRarityDomain = {
      targetRequired: true,
      selectedPossible: false,
      picker: {
        selected: {
          key: 'HestiaWeaponBoon',
          label: 'Hestia Attack',
          value: 'HestiaWeaponBoon',
          state: 'impossible',
          selected: true,
          disabled: true,
        },
        sections: [
          {
            key: 'selected-invalid',
            kind: 'selectedInvalid',
            label: 'Current target',
            collapsible: false,
            items: [
              {
                key: 'HestiaWeaponBoon',
                label: 'Hestia Attack',
                value: 'HestiaWeaponBoon',
                state: 'impossible',
                selected: true,
                disabled: true,
              },
            ],
          },
        ],
      },
    };
    const interaction: WorkspaceFountainRarityInteraction = {
      key: semanticAddressKey(outcome),
      owner: outcome,
      intentFor: clearIntent,
      forTarget: () => ({ load: () => domain }),
      traitLabel: (traitKey) => catalog.traits.byKey[traitKey]?.label ?? traitKey,
    };
    const interactions = {
      fountainRarity: new Map([[semanticAddressKey(outcome), interaction]]),
    } as unknown as WorkspaceInteractionCatalog;
    render(
      <Provider store={application.store}>
        <FountainRarityEffectRow control={control} interactions={interactions} />
      </Provider>,
    );
    expect(await screen.findByLabelText('Phial Target')).toBeTruthy();
    expect(screen.getByText('Needs repair')).toBeTruthy();
    await act(async () => {
      screen.getByRole('button', { name: 'Clear Phial target' }).click();
    });
    expect(clearIntent).toHaveBeenCalledWith(null);
    application.dispose();
  });

  it('authors an eligible target through the nested fountain interaction', async () => {
    const user = userEvent.setup();
    const application = createApplication();
    vi.spyOn(application.store, 'dispatch').mockImplementation(() => undefined as never);
    const action = createRoomActionAddress(
      goldenFBiome,
      createOccurrenceId('golden-f-preboss-shop:postboss'),
      roomActionKey({ kind: 'useFountain' }),
    );
    const outcome = createFountainRarityOutcomeAddress(action);
    const authorIntent = vi.fn((targetTraitKey: string | null) => ({
      command: {
        kind: 'ReplaceFountainRarityTarget' as const,
        outcome,
        targetTraitKey,
      },
    }));
    const interaction: WorkspaceFountainRarityInteraction = {
      key: semanticAddressKey(outcome),
      owner: outcome,
      intentFor: authorIntent,
      forTarget: () => ({
        load: () => ({
          targetRequired: true,
          selectedPossible: true,
          picker: {
            sections: [
              {
                key: 'eligible',
                kind: 'category',
                label: 'Eligible traits',
                collapsible: false,
                items: [
                  {
                    key: 'ApolloWeaponBoon',
                    label: 'Apollo Attack',
                    value: 'ApolloWeaponBoon',
                    state: 'possible',
                    selected: false,
                    disabled: false,
                  },
                ],
              },
            ],
          },
        }),
      }),
      traitLabel: () => 'Apollo Attack',
    };
    const interactions = {
      fountainRarity: new Map([[semanticAddressKey(outcome), interaction]]),
    } as unknown as WorkspaceInteractionCatalog;
    render(
      <Provider store={application.store}>
        <FountainRarityEffectRow
          control={{
            address: outcome,
            marker: {
              address: outcome,
              assessment: 'assessed',
              findingCount: 0,
              focusKey: 'test-phial-author',
            },
          }}
          interactions={interactions}
        />
      </Provider>,
    );
    await user.click(screen.getByLabelText('Phial Target'));
    await user.click(screen.getByText('Apollo Attack'));
    expect(authorIntent).toHaveBeenCalledWith('ApolloWeaponBoon');
    application.dispose();
  });

  it('publishes the nested target edit through application history and restores it with undo', async () => {
    const user = userEvent.setup();
    const application = createApplication();
    const project = createCompleteFGProject();
    act(() => application.store.dispatch(authoredProjectReplaced(project)));
    const action = createRoomActionAddress(
      goldenFBiome,
      createOccurrenceId('golden-f-preboss-shop:postboss'),
      roomActionKey({ kind: 'useFountain' }),
    );
    const outcome = createFountainRarityOutcomeAddress(action);
    const interaction: WorkspaceFountainRarityInteraction = {
      key: semanticAddressKey(outcome),
      owner: outcome,
      intentFor: (targetTraitKey) => ({
        command: { kind: 'ReplaceFountainRarityTarget', outcome, targetTraitKey },
      }),
      forTarget: () => ({
        load: () => ({
          targetRequired: true,
          selectedPossible: true,
          picker: {
            sections: [
              {
                key: 'eligible',
                kind: 'category',
                label: 'Eligible traits',
                collapsible: false,
                items: [
                  {
                    key: 'ApolloWeaponBoon',
                    label: 'Apollo Attack',
                    value: 'ApolloWeaponBoon',
                    state: 'possible',
                    selected: false,
                    disabled: false,
                  },
                ],
              },
            ],
          },
        }),
      }),
      traitLabel: () => 'Apollo Attack',
    };
    const interactions = {
      fountainRarity: new Map([[semanticAddressKey(outcome), interaction]]),
    } as unknown as WorkspaceInteractionCatalog;
    render(
      <Provider store={application.store}>
        <FountainRarityEffectRow
          control={{
            address: outcome,
            marker: {
              address: outcome,
              assessment: 'assessed',
              findingCount: 0,
              focusKey: 'test-phial-history',
            },
          }}
          interactions={interactions}
        />
      </Provider>,
    );
    const historyBefore = application.store.getState().projectWorkspace.history.past.length;
    await user.click(screen.getByLabelText('Phial Target'));
    await user.click(screen.getByText('Apollo Attack'));
    const selected = application.store.getState().projectWorkspace.history.present;
    const selectedPostboss = selected.routes[0]?.biomes[0]?.topology?.occurrences.find(
      (candidate) => candidate.occurrenceId === action.occurrenceId,
    );
    expect(selectedPostboss?.fountainRarityResult).toEqual({ targetTraitKey: 'ApolloWeaponBoon' });
    expect(application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore + 1,
    );
    act(() => application.store.dispatch(authoredProjectUndoRequested()));
    const undone = application.store.getState().projectWorkspace.history.present;
    const undonePostboss = undone.routes[0]?.biomes[0]?.topology?.occurrences.find(
      (candidate) => candidate.occurrenceId === action.occurrenceId,
    );
    expect(undonePostboss?.fountainRarityResult).toBeUndefined();
    application.dispose();
  });
});
