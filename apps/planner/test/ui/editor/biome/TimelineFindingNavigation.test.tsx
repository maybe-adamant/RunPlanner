// @vitest-environment jsdom
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createEncounterPhaseAddress,
  createFigLeafPhaseAddress,
  createOccurrenceAddress,
  semanticAddressKey,
  createRouteStartKeepsakeSelectionAddress,
} from '@run-planner/engine/authored-project';
import { loadSurfaceNShrineSideRoomDeliveryCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import {
  createCompleteFGProject,
  createFConversionFrontierProject,
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
} from '@run-planner/test-fixtures/underworld';
import {
  createSurfaceNOHermesShrineDeliveryCheckpoint,
  loadSurfaceNOPQProject,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
  reachedPOutdoorIcarusFixture,
} from '@run-planner/test-fixtures/surface';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
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
              purchase: { delay: 4 },
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

it.each([
  ['composition', 'Room Overview', 'Customize encounter'],
  ['figLeaf', 'Room Timeline', 'Skip with Fig Leaf'],
] as const)('navigates an encounter %s finding to its %s control', async (kind, tab, control) => {
  const phase = createEncounterPhaseAddress(
    goldenFBiome,
    { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(5, 1) },
    'Encounter',
  );
  const project = applyProjectCommand(
    createCompleteFGProject(),
    catalog,
    kind === 'figLeaf'
      ? { kind: 'ReplaceFigLeafSkip', phase, value: true }
      : {
          kind: 'ReplaceEncounterCustomization',
          phase,
          decisionKey: 'generatedComposition',
          value: {
            kind: 'generated',
            waveCount: 1,
            waves: [{ waveIndex: 1, typeKeys: ['Guard', 'Guard_Elite'] }],
          },
        },
  );
  const view = renderWorkspace(project, 'Underworld', 'F');
  const workspace = workspaceProjection(view.application);
  const issue = view.application.store.getState().projectWorkspace.assembly!.evaluation.route.issue;
  expect(issue?.owner).toEqual(kind === 'figLeaf' ? createFigLeafPhaseAddress(phase) : phase);
  const findings = render(
    <Provider store={view.application.store}>
      <ProjectFindings catalog={catalog} issue={issue} focusByOwner={workspace.focusByOwner} />
    </Provider>,
  );
  await view.user.click(findings.container.querySelector('button')!);
  expect(screen.getByRole('tab', { name: tab }).getAttribute('aria-selected')).toBe('true');
  const target =
    kind === 'figLeaf'
      ? screen.getByRole('checkbox', { name: control })
      : screen.getByRole('button', { name: control });
  expect(target.dataset.hasFindings).toBe('true');
  expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(
    workspace.focusByOwner.get(semanticAddressKey(issue!.owner))!.focusAddress,
  );
  if (kind === 'figLeaf') await waitFor(() => expect(document.activeElement).toBe(target));
});

it.each([
  ['gorgon', 'Gorgon Amulet: Death Defiance'],
  ['aetos', 'Aetos appearance'],
] as const)('navigates a P %s finding to its Timeline checkbox', async (kind, control) => {
  const fixture = reachedPOutdoorIcarusFixture();
  const project =
    kind === 'gorgon'
      ? applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
          kind: 'ReplaceGorgonDeathDefianceCondition',
          phase: createEncounterPhaseAddress(
            pBiome,
            { kind: 'occurrence', occurrenceId: pOccurrenceId('P_Combat12', 8, 1) },
            'Combat',
          ),
          value: true,
        })
      : applyProjectCommand(
          applyProjectCommand(fixture.project, catalog, {
            kind: 'ReplaceAetosWave',
            phase: createEncounterPhaseAddress(
              pBiome,
              { kind: 'occurrence', occurrenceId: pOccurrenceId('P_Combat03', 1, 1) },
              'Combat',
            ),
            value: 2,
          }),
          catalog,
          { kind: 'ReplaceAetosWave', phase: fixture.encounter, value: 2 },
        );
  const view = renderWorkspace(project, 'Surface', 'P');
  const workspace = workspaceProjection(view.application);
  const issue = view.application.store.getState().projectWorkspace.assembly!.evaluation.route.issue;
  expect(issue?.owner.kind).toBe(kind === 'gorgon' ? 'gorgonPhase' : 'aetosPhase');
  const findings = render(
    <Provider store={view.application.store}>
      <ProjectFindings catalog={catalog} issue={issue} focusByOwner={workspace.focusByOwner} />
    </Provider>,
  );
  await view.user.click(findings.container.querySelector('button')!);
  expect(screen.getByRole('tab', { name: 'Room Timeline' }).getAttribute('aria-selected')).toBe(
    'true',
  );
  const target = screen.getByRole('checkbox', { name: control });
  expect(target.dataset.hasFindings).toBe('true');
  await waitFor(() => expect(document.activeElement).toBe(target));
});
