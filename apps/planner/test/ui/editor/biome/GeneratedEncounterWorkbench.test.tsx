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
async function choosePicker(view: Awaited<ReturnType<typeof open>>, name: string, option: string) {
  await view.user.click(screen.getByRole('button', { name }));
  await view.user.click(await screen.findByRole('option', { name: option }));
}

async function finishWave(view: Awaited<ReturnType<typeof open>>) {
  await view.user.click(await screen.findByRole('option', { name: 'Finish Wave' }));
}

describe('generated encounter customization workflows', () => {
  it('places count and highlight issues beside their own repair controls', async () => {
    const view = await open(
      customize(createGoldenFGHIProject(), phase, {
        kind: 'generated',
        waveCount: 4,
        highlightKey: 'SiegeVine',
      }),
    );
    const ui = within(view.dialog);
    const countRow = ui
      .getByRole('radiogroup', { name: 'Waves' })
      .closest('.encounter-customization-row')!;
    expect(within(countRow as HTMLElement).getByText(/Wave count 4 is outside/)).toBeTruthy();
    const highlightRow = ui
      .getByRole('button', { name: 'Shared highlight' })
      .closest('.encounter-customization-row')!;
    expect(
      within(highlightRow as HTMLElement).getByText(/Highlight .* is not available/),
    ).toBeTruthy();
  });

  it('keeps native allocation Default until an edit, then restores it through reset', async () => {
    const view = await open(customize(createGoldenFGHIProject(), phase, composed));
    const ui = within(view.dialog);
    expect(ui.getByText('GeneratedF')).toBeTruthy();
    const weight = await ui.findByRole('spinbutton', { name: 'Wave 3 Wastrel allocation' });
    expect((weight as HTMLInputElement).placeholder).toBe('NA');
    expect((weight as HTMLInputElement).value).toBe('');
    expect(current(view)).toEqual(composed);
    weight.focus();
    fireEvent.change(weight, { target: { value: '4' } });
    await waitFor(() =>
      expect(current(view)).toMatchObject({
        waves: [{ allocations: { Brawler: 4 } }],
      }),
    );
    expect(ui.getByRole('spinbutton', { name: 'Wave 3 Wastrel allocation' })).toBe(weight);
    expect(document.activeElement).toBe(weight);
    fireEvent.change(weight, { target: { value: '0' } });
    expect(current(view)).toMatchObject({ waves: [{ allocations: { Brawler: 0 } }] });
    await view.user.click(
      ui
        .getAllByRole('button', { name: 'Reset allocations' })
        .find((button) => !(button as HTMLButtonElement).disabled)!,
    );
    expect(current(view)).toEqual(composed);
    expect(
      (ui.getByRole('spinbutton', { name: 'Wave 3 Wastrel allocation' }) as HTMLInputElement).value,
    ).toBe('');
    await view.user.click(ui.getByRole('radio', { name: 'Default' }));
    expect(ui.getByRole('heading', { name: 'Wave 3' })).toBeTruthy();
    expect(current(view)).toMatchObject({ highlightKey: 'Guard', waves: composed.waves });
    expect(ui.getByRole('button', { name: 'Shared highlight' })).toBeTruthy();
    await view.user.click(ui.getByRole('radio', { name: '1' }));
    expect(ui.getByRole('heading', { name: 'Wave 3' })).toBeTruthy();
    await view.user.click(ui.getByRole('radio', { name: '3' }));
    const beforeCancel = current(view);
    await view.user.click(ui.getByRole('button', { name: 'Wave 3 enemies' }));
    await view.user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(current(view)).toEqual(beforeCancel);
    await view.user.click(ui.getByRole('button', { name: 'Reset customization' }));
    expect(current(view)).toBeUndefined();
    act(() => {
      view.application.store.dispatch(authoredProjectUndoRequested());
    });
    expect(current(view)).toMatchObject({ waveCount: 3, highlightKey: 'Guard' });
  });

  it('carries allocation samples through enemy and highlight replacements and removes departed members', async () => {
    const view = await open(
      customize(createGoldenFGHIProject(), phase, {
        ...composed,
        waves: [
          {
            waveIndex: 3,
            typeKeys: ['Brawler', 'Mage'],
            allocations: { Guard: 2, Brawler: 3 },
          },
        ],
      }),
    );
    const ui = within(view.dialog);
    await view.user.click(ui.getByRole('button', { name: 'Edit Wave 3 enemies: Casket' }));
    await view.user.click(await screen.findByRole('option', { name: 'Whisper' }));
    await view.user.click(await screen.findByRole('option', { name: 'Spindle' }));
    await view.user.click(await screen.findByRole('option', { name: 'Casket' }));
    await finishWave(view);
    expect(current(view)).toMatchObject({
      waves: [{ allocations: { Guard: 2, Radiator: 3 } }],
    });
    const replaced = current(view);
    expect(replaced?.kind === 'generated' && replaced.waves?.[0]?.allocations).toEqual({
      Guard: 2,
      Radiator: 3,
    });
    expect(
      (ui.getByRole('spinbutton', { name: 'Wave 3 Spindle allocation' }) as HTMLInputElement).value,
    ).toBe('3');
    await choosePicker(view, 'Shared highlight', 'Default');
    expect(current(view)).toMatchObject({
      waves: [{ allocations: { Guard: 2, Radiator: 3 } }],
    });
    await choosePicker(view, 'Shared highlight', 'Whisper');
    expect(current(view)).toMatchObject({
      waves: [{ allocations: { Guard: 2, Radiator: 3 } }],
    });
    await choosePicker(view, 'Shared highlight', 'Default');
    await choosePicker(view, 'Shared highlight', 'Wastrel');
    const highlighted = current(view);
    expect(highlighted?.kind === 'generated' && highlighted.waves?.[0]?.allocations).toEqual({
      Brawler: 2,
      Radiator: 3,
    });
    expect(ui.getByText('Spindle')).toBeTruthy();
  });

  it('does not turn an omitted native allocation into an explicit zero during replacement', async () => {
    const view = await open(
      customize(createGoldenFGHIProject(), phase, {
        ...composed,
        waves: [{ waveIndex: 3, typeKeys: ['Brawler', 'Mage'], allocations: { Brawler: 3 } }],
      }),
    );
    await view.user.click(
      within(view.dialog).getByRole('button', { name: 'Edit Wave 3 enemies: Casket' }),
    );
    await view.user.click(await screen.findByRole('option', { name: 'Whisper' }));
    await view.user.click(await screen.findByRole('option', { name: 'Spindle' }));
    await view.user.click(await screen.findByRole('option', { name: 'Casket' }));
    await finishWave(view);
    const authored = current(view);
    const allocations =
      authored?.kind === 'generated' ? authored.waves?.[0]?.allocations : undefined;
    expect(allocations).toEqual({ Radiator: 3 });
  });

  it('retains ambiguous dormant allocation samples for explicit repair when choosing a highlight', async () => {
    const allocations = { Radiator: 5, Guard: 2, Brawler: 3, Mage: 4 };
    const view = await open(
      customize(createGoldenFGHIProject(), phase, {
        kind: 'generated',
        waveCount: 3,
        waves: [{ waveIndex: 3, typeKeys: ['Brawler', 'Mage'], allocations }],
      }),
    );
    await choosePicker(view, 'Shared highlight', 'Whisper');
    expect(current(view)).toMatchObject({ waves: [{ allocations }] });
    expect(
      within(view.dialog).getByText('Wave 3: allocation samples must name generated members.'),
    ).toBeTruthy();
    await view.user.click(
      within(view.dialog).getAllByRole('button', { name: 'Reset allocations' })[2]!,
    );
    const repaired = current(view);
    expect(repaired?.kind === 'generated' && repaired.waves?.[0]?.allocations).toBeUndefined();
  });

  it('clears a now-unreachable allocation when a completed replacement leaves one ordinary member', async () => {
    const view = await open(
      customize(createGoldenFGHIProject(), phase, {
        kind: 'generated',
        waveCount: 3,
        highlightKey: 'Guard',
        waves: [
          {
            waveIndex: 1,
            typeKeys: ['Brawler'],
            allocations: { Guard: 2, Brawler: 3 },
          },
        ],
      }),
    );
    await choosePicker(view, 'Wave 1 enemies', 'Whisper');
    await finishWave(view);
    expect(current(view)).toMatchObject({ waves: [{ waveIndex: 1, typeKeys: [] }] });
    const first = current(view);
    expect(first?.kind === 'generated' && first.waves?.[0]?.allocations).toBeUndefined();
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
    expect(ui.getByText('Whisper (Elite)')).toBeTruthy();
    await view.user.click(screen.getByRole('button', { name: 'Wave 1 enemies' }));
    await view.user.click(await screen.findByRole('option', { name: 'Wastrel' }));
    await view.user.click(await screen.findByRole('option', { name: 'Casket' }));
    await view.user.click(await screen.findByRole('option', { name: 'Finish Wave' }));
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
    expect(ui.getByRole('heading', { name: 'Wave 3' })).toBeTruthy();
    await view.user.click(ui.getByRole('button', { name: 'Reset customization' }));
    expect(current(view)).toBeUndefined();
  });

  it('does not fabricate a fixed H template when the retained source profile is not a native candidate', async () => {
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
    expect(ui.queryByRole('radiogroup', { name: 'Waves' })).toBeNull();
    expect(ui.getByText('Complete earlier choices to evaluate this encounter.')).toBeTruthy();
    expect(ui.queryByText('Brush-Stalker')).toBeNull();
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
    expect(first.generatedAssessment?.waves).toHaveLength(1);
    expect(second.generatedAssessment?.waves).toHaveLength(2);
    expect(second.generatedAssessment).toMatchObject({
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
    expect(ui.getAllByText('Extra enemies')).toHaveLength(2);
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
    ).toMatchObject({ issues: [] });
  });

  it('keeps the P native base-roll control after selecting a concrete roll', async () => {
    const owner = createEncounterPhaseAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId: pOccurrenceId('P_Combat07', 4, 1) },
      'Intro',
    );
    const view = await open(loadSurfaceNOPQProject(), owner);
    const ui = within(view.dialog);
    const slider = ui.getByRole('slider', { name: 'Native base roll' });
    fireEvent.change(slider, { target: { value: '412' } });
    await waitFor(() => expect(current(view, owner)).toMatchObject({ baseRoll: 412 }));
    expect(ui.getByRole('slider', { name: 'Native base roll' })).toBe(slider);
    expect(ui.getByText(/Wave budget/)).toBeTruthy();
    await view.user.click(ui.getByRole('button', { name: 'Default' }));
    const authored = current(view, owner);
    expect(authored?.kind === 'generated' ? authored.baseRoll : undefined).toBeUndefined();
    expect(ui.getByRole('slider', { name: 'Native base roll' })).toBe(slider);
  });

  it('keeps an optional F wave local until its first Finish Wave edit', async () => {
    const view = await open(
      customize(createGoldenFGHIProject(), phase, { kind: 'generated', waveCount: 1 }),
    );
    const before = view.application.store.getState().projectWorkspace.history!;
    await choosePicker(view, 'Wave 1 enemies', 'Wastrel');
    expect(view.application.store.getState().projectWorkspace.history).toBe(before);
    await view.user.click(await screen.findByRole('option', { name: 'Casket' }));
    const finish = await screen.findByRole('option', { name: 'Finish Wave' });
    const spindle = await screen.findByRole('option', { name: 'Spindle' });
    expect(finish.compareDocumentPosition(spindle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(finish.closest('[cmdk-group]')).not.toBe(spindle.closest('[cmdk-group]'));
    const search = screen
      .getAllByRole('combobox')
      .find(
        (input) =>
          input.getAttribute('aria-label') === 'Search finish wave or choose enemy 3 choices',
      )!;
    await view.user.type(search, 'Spindle');
    await view.user.click(spindle);
    expect(
      (
        screen
          .getAllByRole('combobox')
          .find(
            (input) => input.getAttribute('aria-label') === 'Search finish wave choices',
          )! as HTMLInputElement
      ).value,
    ).toBe('');
    await finishWave(view);
    expect(current(view)).toEqual({
      kind: 'generated',
      waveCount: 1,
      waves: [{ waveIndex: 1, typeKeys: ['Brawler', 'Mage', 'Radiator'] }],
    });
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      before.past.length + 1,
    );
    act(() => {
      view.application.store.dispatch(authoredProjectUndoRequested());
    });
    expect(view.application.store.getState().projectWorkspace.history!.present).toBe(
      before.present,
    );
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
    await choosePicker(view, 'Shared highlight', 'Seesword');
    expect(current(view, owner)).toEqual({ kind: 'generated', highlightKey: 'Scimiterror' });
    expect(ui.getByRole('heading', { name: 'Wave 3' })).toBeTruthy();
  });
});
