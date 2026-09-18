// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createEncounterPhaseAddress,
  createOccurrenceId,
  semanticAddressKey,
  type AuthoredGeneratedEncounterCustomization,
  type EncounterPhaseAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenHBiome,
} from '@run-planner/test-fixtures/underworld';
import {
  loadSurfaceNOPQProject,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
} from '@run-planner/test-fixtures/surface';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
import { projectStructuredWorkspaceFixture } from '@planner-test/fixtures/structuredWorkspace';
import { renderOccurrenceWorkbench } from '@planner-test/support/biome-workbench';
import { occurrenceById, openRoomTab } from '@planner-test/support/occurrence-workbench';
import { semanticFindingKey } from '@planner/projections/evaluationProjection';
import { findingSelected } from '@planner/state/editorSessionSlice';
import { authoredProjectUndoRequested } from '@planner/state/projectWorkspaceSlice';

afterEach(cleanup);
const phase = createEncounterPhaseAddress(
  goldenFBiome,
  { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(5, 1) },
  'Encounter',
);
function customize(
  project: ProjectDocument,
  owner: EncounterPhaseAddress,
  value: AuthoredGeneratedEncounterCustomization,
) {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceEncounterCustomization',
    phase: owner,
    decisionKey: 'generatedComposition',
    value,
  });
}
const composed = {
  kind: 'generated',
  waveCount: 3,
  highlightKey: 'Guard',
  waves: [{ waveIndex: 3, typeKeys: ['Brawler', 'Mage'] }],
} as const;
function current(view: ReturnType<typeof renderOccurrenceWorkbench>, owner = phase) {
  return view.application.store
    .getState()
    .projectWorkspace.history!.present.route.biomes.find((b) => b.biomeKey === owner.biomeKey)!
    .topology!.occurrences.find((o) => o.occurrenceId === owner.owner.occurrenceId)!.encounters
    .customizationByPhase?.[owner.phaseKey]?.generatedComposition;
}
async function open(project: ProjectDocument, owner = phase) {
  const view = renderOccurrenceWorkbench(
    project,
    owner.routeKey,
    owner.biomeKey,
    occurrenceById(owner.owner.occurrenceId),
  );
  openRoomTab('Room Timeline');
  const trigger = screen
    .getAllByRole('button', { name: 'Customize encounter' })
    .find((button) => button.dataset.semanticOwner === semanticAddressKey(owner))!;
  await view.user.click(trigger);
  const dialog = await screen.findByRole('dialog', { name: 'Customize' });
  return { ...view, dialog, trigger };
}

describe('generated encounter customization workflows', () => {
  it('keeps native weights as NA until an edit, then restores them through reset', async () => {
    const view = await open(customize(createGoldenFGHIProject(), phase, composed));
    const ui = within(view.dialog);
    expect(ui.getByText('GeneratedF')).toBeTruthy();
    const weight = await ui.findByRole('spinbutton', { name: 'Wave 3 Casket weight' });
    expect((weight as HTMLInputElement).placeholder).toBe('NA');
    expect((weight as HTMLInputElement).value).toBe('');
    expect(ui.getByLabelText('Wave 3 Casket requested budget share').textContent).toBe('—');
    expect(current(view)).toEqual(composed);
    weight.focus();
    fireEvent.change(weight, { target: { value: '4' } });
    await waitFor(() =>
      expect(current(view)).toMatchObject({
        waves: [{ weights: { Guard: 1, Brawler: 1, Mage: 4 } }],
      }),
    );
    expect(ui.getByLabelText('Wave 3 Casket requested budget share').textContent).toBe('67%');
    expect(ui.getByRole('spinbutton', { name: 'Wave 3 Casket weight' })).toBe(weight);
    expect(document.activeElement).toBe(weight);
    fireEvent.change(weight, { target: { value: '0' } });
    expect(current(view)).toMatchObject({ waves: [{ weights: { Mage: 4 } }] });
    await view.user.click(
      ui
        .getAllByRole('button', { name: 'Reset weights' })
        .find((button) => !(button as HTMLButtonElement).disabled)!,
    );
    expect(current(view)).toEqual(composed);
    expect(ui.getByLabelText('Wave 3 Casket requested budget share').textContent).toBe('—');
    expect(
      (ui.getByRole('spinbutton', { name: 'Wave 3 Casket weight' }) as HTMLInputElement).value,
    ).toBe('');
    await view.user.selectOptions(ui.getByRole('combobox', { name: 'Waves' }), '');
    expect(ui.getByRole('heading', { name: 'Stored wave 3' })).toBeTruthy();
    expect(current(view)).toMatchObject({ highlightKey: 'Guard', waves: composed.waves });
    expect(
      (ui.getByRole('combobox', { name: 'Shared highlight' }) as HTMLSelectElement).disabled,
    ).toBe(false);
    await view.user.selectOptions(ui.getByRole('combobox', { name: 'Waves' }), '1');
    expect(ui.getByRole('heading', { name: 'Stored wave 3' })).toBeTruthy();
    await view.user.selectOptions(ui.getByRole('combobox', { name: 'Waves' }), '3');
    const first = await ui.findByRole('combobox', { name: 'Wave 3 enemy 2' });
    expect(
      (within(first).getByRole('option', { name: 'Casket' }) as HTMLOptionElement).disabled,
    ).toBe(true);
    expect(
      (within(first).getByRole('option', { name: 'Remove enemy' }) as HTMLOptionElement).disabled,
    ).toBe(true);
    await view.user.selectOptions(first, 'Radiator');
    expect(current(view)).toMatchObject({ waves: [{ typeKeys: ['Radiator', 'Mage'] }] });
    await view.user.selectOptions(ui.getByRole('combobox', { name: 'Wave 3 enemy 3' }), '');
    const emptyWeight = ui.getByRole('spinbutton', {
      name: 'Wave 3 Enemy 3 weight',
    }) as HTMLInputElement;
    expect(emptyWeight.disabled).toBe(true);
    expect(emptyWeight.placeholder).toBe('NA');
    expect(ui.getByLabelText('Wave 3 Enemy 3 requested budget share').textContent).toBe('—');
    await view.user.selectOptions(ui.getByRole('combobox', { name: 'Wave 3 enemy 2' }), '');
    expect(current(view)).toEqual({ kind: 'generated', waveCount: 3, highlightKey: 'Guard' });
    await view.user.click(ui.getByRole('button', { name: 'Reset customization' }));
    expect(current(view)).toBeUndefined();
    act(() => {
      view.application.store.dispatch(authoredProjectUndoRequested());
    });
    expect(current(view)).toMatchObject({ waveCount: 3, highlightKey: 'Guard' });
  });

  it('carries weights through enemy and highlight replacements and removes departed members', async () => {
    const view = await open(
      customize(createGoldenFGHIProject(), phase, {
        ...composed,
        waves: [
          {
            waveIndex: 3,
            typeKeys: ['Brawler', 'Mage'],
            weights: { Guard: 2, Brawler: 3, Mage: 4 },
          },
        ],
      }),
    );
    const ui = within(view.dialog);
    const enemy = await ui.findByRole('combobox', { name: 'Wave 3 enemy 2' });
    await view.user.selectOptions(enemy, 'Radiator');
    expect(ui.getByRole('combobox', { name: 'Wave 3 enemy 2' })).toBe(enemy);
    expect(current(view)).toMatchObject({
      waves: [{ weights: { Guard: 2, Radiator: 3, Mage: 4 } }],
    });
    const replaced = current(view);
    expect(replaced?.kind === 'generated' && replaced.waves?.[0]?.weights).toEqual({
      Guard: 2,
      Radiator: 3,
      Mage: 4,
    });
    expect(
      (ui.getByRole('spinbutton', { name: 'Wave 3 Spindle weight' }) as HTMLInputElement).value,
    ).toBe('3');
    await view.user.selectOptions(
      ui.getByRole('combobox', { name: 'Shared highlight' }),
      'Brawler',
    );
    const highlighted = current(view);
    expect(highlighted?.kind === 'generated' && highlighted.waves?.[0]?.weights).toEqual({
      Brawler: 2,
      Radiator: 3,
      Mage: 4,
    });
    await view.user.selectOptions(ui.getByRole('combobox', { name: 'Wave 3 enemy 3' }), '');
    const removed = current(view);
    expect(removed?.kind === 'generated' && removed.waves?.[0]?.weights).toEqual({
      Brawler: 2,
      Radiator: 3,
    });
  });

  it('focuses the customization launcher for invalid composition without opening it', async () => {
    const project = customize(createGoldenFGHIProject(), phase, {
      kind: 'generated',
      waveCount: 1,
      waves: [{ waveIndex: 1, typeKeys: ['Guard', 'Guard_Elite'] }],
    });
    const finding = simulateProject(catalog, project).findings.find(
      (f) => f.code === 'encounterCustomizationUnavailable',
    )!;
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'F',
      occurrenceById(phase.owner.occurrenceId),
    );
    openRoomTab('Room Timeline');
    const trigger = screen.getByRole('button', { name: 'Customize encounter' });
    act(() => {
      view.application.store.dispatch(
        findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
      );
    });
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.querySelectorAll(`[id="${trigger.id}"]`)).toHaveLength(1);
    await view.user.click(trigger);
    const ui = within(await screen.findByRole('dialog', { name: 'Customize' }));
    expect((ui.getByRole('combobox', { name: 'Wave 1 enemy 2' }) as HTMLSelectElement).value).toBe(
      'Guard_Elite',
    );
    await view.user.selectOptions(ui.getByRole('combobox', { name: 'Wave 1 enemy 2' }), 'Brawler');
    expect(
      simulateProject(catalog, view.application.store.getState().projectWorkspace.history!.present)
        .status,
    ).toBe('valid');
  });

  it('keeps a retained room editable behind invalid context without inventing candidate support', async () => {
    let project = customize(createGoldenFGHIProject(), phase, composed);
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase: createEncounterPhaseAddress(
        goldenFBiome,
        { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(1, 1) },
        'Encounter',
      ),
      encounterKey: 'ArtemisCombatF',
    });
    const projection = projectStructuredWorkspaceFixture(project);
    expect(projection.evaluation.status).not.toBe('valid');
    expect(
      projection.workspace.interactions.encounterCustomizations.get(semanticAddressKey(phase))
        ?.generatedAssessment,
    ).toBeUndefined();
    const view = await open(project);
    const ui = within(view.dialog);
    expect(ui.getByRole('heading', { name: 'Stored wave 3' })).toBeTruthy();
    await view.user.click(ui.getByRole('button', { name: 'Reset customization' }));
    expect(current(view)).toBeUndefined();
  });

  it('renders the fixed H template and only authors its generated companion', async () => {
    const owner = createEncounterPhaseAddress(
      goldenHBiome,
      { kind: 'occurrence', occurrenceId: createOccurrenceId('golden-h-combat09') },
      'Cage01',
    );
    const project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'SelectEncounter',
      phase: owner,
      encounterKey: 'GeneratedH_Treant2',
    });
    const view = await open(project, owner);
    const ui = within(view.dialog);
    expect(ui.getByText('1 (fixed)')).toBeTruthy();
    expect(ui.queryByRole('combobox', { name: 'Waves' })).toBeNull();
    expect(ui.getByText('Brush-Stalker')).toBeTruthy();
    await view.user.selectOptions(
      await ui.findByRole('combobox', { name: 'Wave 1 enemy 2' }),
      'Lamia',
    );
    expect(current(view, owner)).toEqual({
      kind: 'generated',
      waves: [{ waveIndex: 1, typeKeys: ['Lamia'] }],
    });
    expect(ui.queryByRole('button', { name: 'Set relative weights' })).toBeNull();
  });

  it('binds NPC fixed waves and ship phases through their own existing owners', () => {
    const npcProject = authorLegalTraitOffers(
      applyProjectCommand(createGoldenFGHIProject(), catalog, {
        kind: 'SelectEncounter',
        phase,
        encounterKey: 'ArtemisCombatF',
      }),
    );
    const npc = projectStructuredWorkspaceFixture(
      npcProject,
    ).workspace.interactions.encounterCustomizations.get(semanticAddressKey(phase))!;
    expect(npc.generatedAssessment).toMatchObject({
      effectiveWaveCount: 4,
      composition: 'nativeHighlight',
    });
    const intro = createEncounterPhaseAddress(
      oBiome,
      { kind: 'occurrence', occurrenceId: oOccurrenceIds.combat04 },
      'Intro',
    );
    const combat = createEncounterPhaseAddress(oBiome, intro.owner, 'Combat1');
    const project = customize(loadSurfaceNOPQProject(), combat, {
      kind: 'generated',
      waveCount: 2,
      highlightKey: 'Scimiterror',
    });
    const { workspace } = projectStructuredWorkspaceFixture(project);
    const first = workspace.interactions.encounterCustomizations.get(semanticAddressKey(intro))!;
    const second = workspace.interactions.encounterCustomizations.get(semanticAddressKey(combat))!;
    expect(first.generatedAssessment).toMatchObject({ effectiveWaveCount: 1 });
    expect(second.generatedAssessment).toMatchObject({
      effectiveWaveCount: 2,
      composition: 'active',
    });
    expect(second.intentFor('generatedComposition', null).command).toMatchObject({ phase: combat });
    expect(first.intentFor('generatedComposition', null).command).toMatchObject({ phase: intro });
  });

  it('repairs a P Combat two-wave excess through its retained rows', async () => {
    const occurrenceId = pOccurrenceId('P_Combat02', 2, 1);
    const owner = createEncounterPhaseAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId },
      'Combat',
    );
    const project = customize(loadSurfaceNOPQProject(), owner, {
      kind: 'generated',
      waveCount: 2,
      highlightKey: 'SatyrLancer2',
      waves: [
        { waveIndex: 1, typeKeys: ['HarpyDropper', 'SentryBot'] },
        { waveIndex: 2, typeKeys: ['HarpyDropper', 'SentryBot'] },
      ],
    });
    const view = await open(project, owner);
    const ui = within(view.dialog);
    expect(ui.getAllByText('Stored excess selections')).toHaveLength(2);
    expect(
      ui.getByText(/Wave 1: allows only the highlight; remove 2 additional types/),
    ).toBeTruthy();
    expect(
      ui.getByText(/Wave 2: allows 2 total types including the highlight; remove 1 type/),
    ).toBeTruthy();
    await view.user.click(ui.getByRole('button', { name: 'Remove Wave 1 Enemy 3' }));
    await view.user.click(ui.getByRole('button', { name: 'Remove Wave 1 Enemy 2' }));
    await view.user.click(ui.getByRole('button', { name: 'Remove Wave 2 Enemy 3' }));
    expect(
      projectStructuredWorkspaceFixture(
        view.application.store.getState().projectWorkspace.history!.present,
      ).workspace.interactions.encounterCustomizations.get(semanticAddressKey(owner))
        ?.generatedAssessment,
    ).toMatchObject({ supported: true });
  });

  it('opens the reward-owned Devotion generator with its fixed count and exact highlight choices', async () => {
    const owner = createEncounterPhaseAddress(
      oBiome,
      { kind: 'occurrence', occurrenceId: oOccurrenceIds.devotion },
      'Encounter',
    );
    const view = await open(loadSurfaceNOPQProject(), owner);
    const ui = within(view.dialog);
    expect(ui.getByText('3 (fixed)')).toBeTruthy();
    await view.user.selectOptions(
      await ui.findByRole('combobox', { name: 'Shared highlight' }),
      'Scimiterror',
    );
    expect(current(view, owner)).toEqual({ kind: 'generated', highlightKey: 'Scimiterror' });
    expect(ui.getByRole('heading', { name: 'Wave 3' })).toBeTruthy();
  });
});
