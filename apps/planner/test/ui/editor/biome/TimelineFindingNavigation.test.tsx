// @vitest-environment jsdom
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createOccurrenceAddress,
  semanticAddressKey,
  createRouteStartKeepsakeSelectionAddress,
} from '@run-planner/engine/authored-project';
import { loadSurfaceNShrineSideRoomDeliveryCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import {
  createFConversionFrontierProject,
  createGoldenFGHIProject,
} from '@run-planner/test-fixtures/underworld';
import {
  createSurfaceNOHermesShrineDeliveryCheckpoint,
  oBiome,
  oOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import { act, cleanup, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, expect, it } from 'vitest';
import { renderWorkspace, workspaceProjection } from '@planner-test/support/biome-workbench';
import { ProjectFindings } from '@planner/ui/feedback/EvaluationFeedback';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';

import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
afterEach(cleanup);

it.each([
  ['delivery', true],
  ['delivery', false],
  ['ship', true],
  ['ship', false],
  ['artificer', true],
  ['fountain', true],
] as const)(
  'navigates to the %s repair and retains its tab (previously focused: %s)',
  async (kind, previouslyFocused) => {
    const conversion = createFConversionFrontierProject('MetaCurrencyDrop');
    const project =
      kind === 'ship'
        ? applyProjectCommand(
            createSurfaceNOHermesShrineDeliveryCheckpoint({ placeDelayedDelivery: false }),
            catalog,
            {
              kind: 'SetHermesShrinePurchase',
              occurrence: createOccurrenceAddress(oBiome, oOccurrenceIds.combat07),
              generationKey: 'initial:secondLeft',
              purchase: { delay: 4, rushed: false },
            },
          )
        : kind === 'delivery'
          ? loadSurfaceNShrineSideRoomDeliveryCheckpoint()
          : kind === 'artificer'
            ? applyProjectCommand(conversion.project, catalog, {
                kind: 'ReplaceAcquisitionDisposition',
                acquisition: conversion.acquisition,
                value: { kind: 'artificer' },
              })
            : applyProjectCommand(createGoldenFGHIProject(), catalog, {
                kind: 'ReplaceStartingKeepsake',
                selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
                keepsakeKey: 'FountainRarityKeepsake',
              });
    const view = renderWorkspace(
      project,
      kind === 'delivery' || kind === 'ship' ? 'Surface' : 'Underworld',
      kind === 'ship' ? 'O' : kind === 'delivery' ? 'N' : 'F',
    );
    const workspace = workspaceProjection(view.application);
    const issue =
      view.application.store.getState().projectWorkspace.assembly!.evaluation.route.issue;
    expect(
      issue?.reasons.some(
        (reason) =>
          reason.code ===
          (kind === 'delivery' || kind === 'ship'
            ? 'hermesShrineDeliveryPlacementRequired'
            : kind === 'artificer'
              ? 'rewardMissing'
              : 'fountainRarityResultMissing'),
      ),
    ).toBe(true);
    if (previouslyFocused)
      act(() =>
        view.application.store.dispatch(
          semanticOwnerFocused(
            workspace.focusByOwner.get(semanticAddressKey(issue!.owner))!.focusAddress,
          ),
        ),
      );
    await view.user.click(screen.getByRole('tab', { name: 'Room Doors' }));
    const findings = render(
      <Provider store={view.application.store}>
        <ProjectFindings catalog={catalog} issue={issue} focusByOwner={workspace.focusByOwner} />
      </Provider>,
    );
    await view.user.click(findings.container.querySelector('button')!);
    expect(
      screen
        .getByRole('tab', { name: kind === 'ship' ? 'Intro Timeline' : 'Room Timeline' })
        .getAttribute('aria-selected'),
    ).toBe('true');
    const destination = workspace.focusByOwner.get(semanticAddressKey(issue!.owner))!;
    const node = workspace.route.biomes
      .flatMap((biome) => biome.nodes)
      .find((candidate) => candidate.key === destination.nodeKey);
    if (node?.kind !== 'occurrenceWorkbench') throw new Error('Missing repair room');
    act(() => view.application.store.dispatch(semanticOwnerFocused(node.room.address)));
    expect(screen.getByRole('tab', { name: 'Room Overview' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    await view.user.click(findings.container.querySelector('button')!);
    const repair = screen.getByRole('button', {
      name:
        kind === 'delivery' || kind === 'ship'
          ? 'Restore delivery'
          : kind === 'artificer'
            ? 'Item'
            : 'Phial Target',
    });
    const selected = view.application.store.getState().editorSession.selectedFinding!;
    const target = document.getElementById(
      semanticOwnerControlElementId(
        workspace.focusByOwner.get(semanticAddressKey(selected.origin))!.focusAddress,
      ),
    );
    expect(target).not.toBeNull();
    expect(target?.getAttribute('data-selected-finding')).toBe('true');
    expect(target?.contains(repair)).toBe(true);
    if (kind === 'delivery' || kind === 'ship') {
      await view.user.click(repair);
      expect(screen.queryByRole('button', { name: 'Restore delivery' })).toBeNull();
      expect(
        screen
          .getByRole('tab', {
            name: kind === 'ship' ? 'Intro Timeline' : 'Room Timeline',
          })
          .getAttribute('aria-selected'),
      ).toBe('true');
      expect(
        view.application.store
          .getState()
          .projectWorkspace.assembly!.evaluation.route.issue?.reasons.some(
            (reason) => reason.code === 'hermesShrineDeliveryPlacementRequired',
          ),
      ).not.toBe(true);
    }
  },
);
