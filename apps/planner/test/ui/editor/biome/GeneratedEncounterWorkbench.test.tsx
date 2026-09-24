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
import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenHBiome,
  goldenGBiome,
  goldenGOccurrenceId,
} from '@run-planner/test-fixtures/underworld';
import {
  loadSurfaceNOPQProject,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
} from '@run-planner/test-fixtures/surface';
import { projectStructuredWorkspaceFixture } from '@planner-test/fixtures/structuredWorkspace';
import { renderOccurrenceWorkbench } from '@planner-test/support/biome-workbench';
import { occurrenceById, openRoomTab } from '@planner-test/support/occurrence-workbench';
import { semanticFindingKey } from '@planner/projections/evaluationProjection';
import { findingSelected } from '@planner/state/editorSessionSlice';
import {
  authoredProjectUndoRequested,
  authoredProjectCommandDispatched,
} from '@planner/state/projectWorkspaceSlice';
import { simulateProject } from '@run-planner/engine/simulation';

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
function current(view: ReturnType<typeof renderOccurrenceWorkbench>, owner = phase) {
  return view.application.store
    .getState()
    .projectWorkspace.history!.present.route.biomes.find(
      (biome) => biome.biomeKey === owner.biomeKey,
    )!
    .topology!.occurrences.find(
      (occurrence) => occurrence.occurrenceId === owner.owner.occurrenceId,
    )!.encounters.customizationByPhase?.[owner.phaseKey]?.generatedComposition;
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
  return { ...view, dialog: await screen.findByRole('dialog', { name: 'Customize' }) };
}
async function initialize(view: Awaited<ReturnType<typeof open>>) {
  await view.user.click(within(view.dialog).getByRole('button', { name: 'Edit' }));
}
async function choosePicker(
  view: Awaited<ReturnType<typeof open>>,
  name: string,
  option: string | RegExp,
) {
  await view.user.click(within(view.dialog).getByRole('button', { name }));
  await view.user.click(await screen.findByRole('option', { name: option }));
}
async function finishWave(view: Awaited<ReturnType<typeof open>>) {
  await view.user.click(await screen.findByRole('option', { name: 'Finish Wave' }));
}
async function selectBudgetWave(view: Awaited<ReturnType<typeof open>>, index: number) {
  await view.user.click(
    within(view.dialog).getByRole('tab', { name: new RegExp(`^Wave ${index}(,|$)`) }),
  );
}

const composed = {
  kind: 'generated',
  waveCount: 3,
  highlightKey: 'Guard',
  waves: [{ waveIndex: 3, typeKeys: ['Brawler', 'Mage'], allocations: { Guard: 2, Brawler: 3 } }],
} as const;

describe('generated encounter customization workflows', () => {
  it('shows group counts as groups and individual totals with derived-value hovers', async () => {
    const owner = createEncounterPhaseAddress(
      goldenGBiome,
      { kind: 'occurrence', occurrenceId: goldenGOccurrenceId(4, 1) },
      'Encounter',
    );
    const view = await open(
      customize(createGoldenFGHIProject(), owner, {
        kind: 'generated',
        waveCount: 1,
        waves: [
          {
            waveIndex: 1,
            typeKeys: ['FishSwarmerSquad', 'Guard2'],
            allocations: { FishSwarmerSquad: 32 },
          },
        ],
      }),
      owner,
    );
    const table = within(view.dialog).getByRole('table', { name: 'Wave 1 enemy budgets' });
    expect(within(table).getByTitle('2 groups · 10 individual enemies.').textContent).toBe(
      '2 (10)',
    );
    expect(within(table).getByTitle('Cost: 16 per group of 5 enemies.')).toBeTruthy();
    expect(within(table).getByTitle('Wave budget / total encounter budget.')).toBeTruthy();
    expect(
      within(table).getAllByTitle('Resulting cost after rounding and minimum counts.'),
    ).toHaveLength(2);
  });
  it('removes excess enemies without creating blank allocation keys', async () => {
    const view = await open(
      customize(createGoldenFGHIProject(), phase, {
        kind: 'generated',
        waveCount: 1,
        waves: [
          {
            waveIndex: 1,
            typeKeys: ['Guard', 'Brawler', 'Mage', 'Guard_Elite', 'Brawler_Elite'],
            allocations: { Guard: 10, Brawler_Elite: 20 },
          },
        ],
      }),
    );
    expect(
      within(view.dialog)
        .getByRole('button', { name: 'Wave 1 enemies' })
        .closest('[data-has-issues]')
        ?.getAttribute('data-has-issues'),
    ).toBe('true');
    const findings = within(view.dialog).getByRole('region', { name: 'Customization findings' });
    expect(findings.textContent).toContain('Wave 1: Allows');
    expect(findings.textContent).not.toContain('Wave 1: Wave 1:');
    await view.user.click(
      within(view.dialog).getByRole('button', { name: 'Remove Wave 1 Enemy 5' }),
    );
    const removed = current(view);
    expect(removed?.kind === 'generated' && removed.waves?.[0]).toEqual({
      waveIndex: 1,
      typeKeys: ['Guard', 'Brawler', 'Mage', 'Guard_Elite'],
      allocations: { Guard: 10 },
    });
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    const restored = current(view);
    expect(restored?.kind === 'generated' && restored.waves?.[0]?.allocations).toEqual({
      Guard: 10,
      Brawler_Elite: 20,
    });
  });
  it('shows active Menace rows with friendly replacements, integer counts, retention and count-reduction repair', async () => {
    const enabled = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceFearVowRank',
      route: { kind: 'route', routeKey: 'Underworld' },
      vowKey: 'NextBiomeEnemyShrineUpgrade',
      rank: 1,
    });
    const view = await open(
      customize(enabled, phase, {
        kind: 'generated',
        waveCount: 1,
        waves: [{ waveIndex: 1, typeKeys: ['Guard', 'Brawler'], allocations: { Guard: 70 } }],
      }),
    );
    expect(within(view.dialog).getByRole('rowheader', { name: 'Menace Target' })).toBeTruthy();
    expect(within(view.dialog).getByRole('rowheader', { name: 'Menace Count' })).toBeTruthy();
    expect(within(view.dialog).queryByText('Guard2')).toBeNull();
    const input = within(view.dialog).getByRole('textbox', { name: 'Wave 1 Whisper converted' });
    fireEvent.change(input, { target: { value: '1.5' } });
    fireEvent.blur(input);
    expect(current(view)).not.toHaveProperty('menace');
    fireEvent.change(input, { target: { value: '14' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(current(view)).toMatchObject({ menace: [{ conversions: { Guard: { count: 14 } } }] });
    for (const rank of [0, 2]) {
      act(() =>
        view.application.store.dispatch(
          authoredProjectCommandDispatched({
            kind: 'ReplaceFearVowRank',
            route: { kind: 'route', routeKey: 'Underworld' },
            vowKey: 'NextBiomeEnemyShrineUpgrade',
            rank,
          }),
        ),
      );
      expect(within(view.dialog).queryByRole('rowheader', { name: 'Menace Target' }) !== null).toBe(
        rank > 0,
      );
      expect(within(view.dialog).queryByRole('rowheader', { name: 'Menace Count' }) !== null).toBe(
        rank > 0,
      );
      expect(current(view)).toMatchObject({ menace: [{ conversions: { Guard: { count: 14 } } }] });
    }
    const budget = within(view.dialog).getByRole('textbox', { name: 'Wave 1 Whisper budget' });
    fireEvent.change(budget, { target: { value: '5' } });
    fireEvent.blur(budget);
    expect(current(view)).toMatchObject({ menace: [{ conversions: { Guard: { count: 14 } } }] });
    expect(view.dialog.textContent).toContain('Converted requests exceed');
    const findings = within(view.dialog).getByRole('region', { name: 'Customization findings' });
    expect(findings.textContent).toContain('Wave 1: Converted requests exceed');
    const invalidTab = within(view.dialog).getByRole('tab', { name: 'Wave 1, needs attention' });
    expect(invalidTab.textContent).toContain('!');
    expect(invalidTab.textContent).not.toContain('Needs attention');
    await view.user.click(within(view.dialog).getByRole('button', { name: 'Wave 1 enemies' }));
    await view.user.click(await screen.findByRole('option', { name: 'Whisper' }));
    await view.user.click(await screen.findByRole('option', { name: 'Wastrel' }));
    await finishWave(view);
    expect(current(view)).toMatchObject({ menace: [{ conversions: { Guard: { count: 14 } } }] });
    expect(view.dialog.textContent).toContain('Converted requests exceed');
    fireEvent.change(
      within(view.dialog).getByRole('textbox', { name: 'Wave 1 Whisper converted' }),
      { target: { value: '1' } },
    );
    fireEvent.blur(within(view.dialog).getByRole('textbox', { name: 'Wave 1 Whisper converted' }));
    expect(current(view)).toMatchObject({ menace: [{ conversions: { Guard: { count: 1 } } }] });
  });

  it('uses the contextual Menace replacement picker with full friendly Tartarus pool', async () => {
    const owner = createEncounterPhaseAddress(
      goldenHBiome,
      { kind: 'occurrence', occurrenceId: createOccurrenceId('golden-h-combat05') },
      'Cage01',
    );
    let project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceFearVowRank',
      route: { kind: 'route', routeKey: 'Underworld' },
      vowKey: 'NextBiomeEnemyShrineUpgrade',
      rank: 1,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase: owner,
      encounterKey: 'GeneratedH_Treant2',
    });
    project = customize(project, owner, {
      kind: 'generated',
      waveCount: 1,
      waves: [{ waveIndex: 1, typeKeys: ['FogEmitter2'], allocations: { FogEmitter2: 1 } }],
    });
    const view = await open(project, owner);
    const replacement = within(view.dialog).getByRole('button', {
      name: 'Wave 1 Brush-Stalker replacement',
    });
    await view.user.click(replacement);
    const options = within(await screen.findByRole('listbox')).getAllByRole('option');
    expect(options).toHaveLength(12);
    expect(
      options.every(
        (option) => !/GoldElemental|_Elite|ClockworkHeavyMelee/.test(option.textContent ?? ''),
      ),
    ).toBe(true);
    await view.user.click(options[0]!);
    fireEvent.change(
      within(view.dialog).getByRole('textbox', { name: 'Wave 1 Brush-Stalker converted' }),
      { target: { value: '1' } },
    );
    fireEvent.blur(
      within(view.dialog).getByRole('textbox', { name: 'Wave 1 Brush-Stalker converted' }),
    );
    expect(current(view, owner)).toMatchObject({
      menace: [{ conversions: { Treant2: { count: 1, targetKey: 'GoldElemental' } } }],
    });
    expect(within(view.dialog).getAllByText('NA').length).toBeGreaterThanOrEqual(2);
  });
  it('retains oversized budgets until edited, then caps the edit at the wave budget', async () => {
    const view = await open(
      customize(createGoldenFGHIProject(), phase, {
        kind: 'generated',
        waveCount: 1,
        waves: [{ waveIndex: 1, typeKeys: ['Guard', 'Brawler'], allocations: { Guard: 9999 } }],
      }),
    );
    const input = within(view.dialog).getByRole('textbox', { name: 'Wave 1 Whisper budget' });
    expect((input as HTMLInputElement).value).toBe('9999');
    expect(current(view)).toMatchObject({ waves: [{ allocations: { Guard: 9999 } }] });
    const assessment = projectStructuredWorkspaceFixture(
      view.application.store.getState().projectWorkspace.history!.present,
    ).workspace.interactions.encounterCustomizations.get(
      semanticAddressKey(phase),
    )!.generatedAssessment!;
    expect(assessment.budget?.kind).toBe('exact');
    const waveBudget = assessment.budget!.waveBudgets[0] as number;
    const table = within(view.dialog).getByRole('table', { name: 'Wave 1 enemy budgets' });
    const costHeader = within(table).getByRole('columnheader', {
      name: /^Whisper \(/,
    }).textContent!;
    const unitCost = Number(costHeader.match(/\(([\d.]+)\)/)![1]);
    const count = assessment.waves[0]!.countPreview!.find((entry) => entry.key === 'Guard')!.count!;
    expect(input.closest('td')!.textContent).toBe(
      '→ ' +
        new Intl.NumberFormat('en-US', {
          maximumFractionDigits: 2,
          useGrouping: false,
        }).format(count * unitCost),
    );
    fireEvent.change(input, { target: { value: '10000' } });
    fireEvent.blur(input);
    expect(current(view)).toMatchObject({ waves: [{ allocations: { Guard: waveBudget } }] });
  });
  it('creates the complete composition only through Customize and resets it atomically', async () => {
    const view = await open(createGoldenFGHIProject());
    expect(current(view)).toBeUndefined();
    const explanation =
      'The game currently controls this encounter’s enemies. Select Edit to customize them.';
    expect(within(view.dialog).getByText(explanation)).toBeTruthy();
    expect(within(view.dialog).queryByText('Native')).toBeNull();
    await initialize(view);
    expect(current(view)).toMatchObject({
      kind: 'generated',
      waveCount: expect.any(Number),
      waves: expect.any(Array),
    });
    const created = view.application.store.getState().projectWorkspace.history!;
    expect(within(view.dialog).queryByText(/Set the enemy budget for each wave/)).toBeNull();
    expect(
      within(view.dialog).getByRole('columnheader', { name: /Wave budget .* encounter budget/ }),
    ).toBeTruthy();
    await view.user.click(within(view.dialog).getByRole('button', { name: 'Help' }));
    expect(
      within(view.dialog).getByRole('region', { name: 'Encounter composition help' }).textContent,
    ).toContain('For grouped enemies, each conversion replaces one whole group.');
    await view.user.click(within(view.dialog).getByRole('button', { name: 'Help' }));
    expect(
      within(view.dialog).queryByRole('region', { name: 'Encounter composition help' }),
    ).toBeNull();
    expect(view.application.store.getState().projectWorkspace.history).toBe(created);
    expect(
      within(view.dialog).queryByRole('button', { name: /Reset Budgets|Adjust Budgets/ }),
    ).toBeNull();
    await view.user.click(within(view.dialog).getByRole('button', { name: 'Reset' }));
    expect(current(view)).toBeUndefined();
    expect(within(view.dialog).getByText(explanation)).toBeTruthy();
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(view.application.store.getState().projectWorkspace.history!.present).toBe(
      created.present,
    );
  });
  it('stages Fangs perks until Finish and clears them only with Reset customization', async () => {
    let project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceFearVowRank',
      route: { kind: 'route', routeKey: 'Underworld' },
      vowKey: 'EnemyEliteShrineUpgrade',
      rank: 1,
    });
    project = customize(project, phase, {
      kind: 'generated',
      waveCount: 1,
      waves: [
        { waveIndex: 1, typeKeys: ['Guard_Elite', 'Brawler'], allocations: { Guard_Elite: 87.5 } },
      ],
    });
    const view = await open(project);
    await view.user.click(within(view.dialog).getByRole('button', { name: 'Fangs target' }));
    await view.user.click(await screen.findByRole('option', { name: 'Elite Whisper' }));
    await view.user.click(within(view.dialog).getByRole('button', { name: 'Fangs perks' }));
    await view.user.click(await screen.findByRole('option', { name: 'Shifter' }));
    expect(current(view)).toMatchObject({ fangs: { perkKeys: [] } });
    await view.user.click(await screen.findByRole('option', { name: 'Finish' }));
    expect(current(view)).toMatchObject({ fangs: { perkKeys: ['Blink'] } });
    for (const rank of [0, 1]) {
      act(() =>
        view.application.store.dispatch(
          authoredProjectCommandDispatched({
            kind: 'ReplaceFearVowRank',
            route: { kind: 'route', routeKey: 'Underworld' },
            vowKey: 'EnemyEliteShrineUpgrade',
            rank,
          }),
        ),
      );
      expect(within(view.dialog).queryByRole('button', { name: 'Fangs target' }) !== null).toBe(
        rank > 0,
      );
      expect(within(view.dialog).queryByRole('button', { name: 'Fangs perks' }) !== null).toBe(
        rank > 0,
      );
      expect(current(view)).toMatchObject({ fangs: { perkKeys: ['Blink'] } });
    }
    await view.user.click(within(view.dialog).getByRole('button', { name: 'Reset' }));
    expect(current(view)).toBeUndefined();
  });
  it('commits the visually-minimum P roll when a retained partial customization has no roll', async () => {
    const owner = createEncounterPhaseAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId: pOccurrenceId('P_Combat07', 4, 1) },
      'Intro',
    );
    const view = await open(
      customize(loadSurfaceNOPQProject(), owner, { kind: 'generated', waveCount: 2 }),
      owner,
    );
    const slider = within(view.dialog).getByRole('slider', { name: 'Native base roll' });
    expect((slider as HTMLInputElement).value).toBe('340');
    fireEvent.keyDown(slider, { key: 'Home' });
    fireEvent.keyUp(slider, { key: 'Home' });
    expect(current(view, owner)).toMatchObject({ baseRoll: 340, waveCount: 2 });
  });
  it('keeps the base-roll slider as local draft state until the gesture commits', async () => {
    const owner = createEncounterPhaseAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId: pOccurrenceId('P_Combat07', 4, 1) },
      'Intro',
    );
    const view = await open(
      customize(loadSurfaceNOPQProject(), owner, {
        kind: 'generated',
        waveCount: 2,
        baseRoll: 412,
      }),
      owner,
    );
    const slider = within(view.dialog).getByRole('slider', { name: 'Native base roll' });
    const history = view.application.store.getState().projectWorkspace.history;
    fireEvent.pointerDown(slider, { pointerId: 1 });
    fireEvent.change(slider, { target: { value: '413' } });
    fireEvent.change(slider, { target: { value: '414' } });
    expect(view.application.store.getState().projectWorkspace.history).toBe(history);
    fireEvent.pointerUp(slider, { pointerId: 1 });
    await waitFor(() => expect(current(view, owner)).toMatchObject({ baseRoll: 414 }));
  });
  it('carries retained allocations across replacement and drops departed allocation members', async () => {
    const view = await open(customize(createGoldenFGHIProject(), phase, composed));
    await selectBudgetWave(view, 3);
    await view.user.click(within(view.dialog).getByRole('button', { name: 'Wave 3 enemies' }));
    await view.user.click(await screen.findByRole('option', { name: 'Whisper' }));
    await view.user.click(await screen.findByRole('option', { name: 'Spindle' }));
    await view.user.click(await screen.findByRole('option', { name: 'Casket' }));
    await finishWave(view);
    expect(current(view)).toMatchObject({ waves: [{ allocations: { Guard: 2, Radiator: 3 } }] });
    await choosePicker(view, 'Shared Enemy', 'Wastrel');
    expect(current(view)).toMatchObject({ waves: [{ allocations: { Brawler: 2, Radiator: 3 } }] });
  });
  it('does not author an empty allocation map for a sole native remainder', async () => {
    const view = await open(
      customize(createGoldenFGHIProject(), phase, {
        kind: 'generated',
        waveCount: 3,
        highlightKey: 'Guard',
        waves: [{ waveIndex: 1, typeKeys: [] }],
      }),
    );
    const table = within(view.dialog).getByRole('table', { name: 'Wave 1 enemy budgets' });
    expect(within(table).queryByRole('textbox')).toBeNull();
    const value = current(view);
    expect(value?.kind === 'generated' && value.waves?.[0]?.allocations).toBeUndefined();
  });
  it('formats fractional budgets and keeps wave tabs out of authored history', async () => {
    const value = {
      ...composed,
      waves: [
        { waveIndex: 2, typeKeys: ['Mage'], allocations: { Guard: 5 } },
        { ...composed.waves[0], allocations: { Guard: 5, Brawler: 10.000000000000002 } },
      ],
    };
    const view = await open(customize(createGoldenFGHIProject(), phase, value));
    const history = view.application.store.getState().projectWorkspace.history;
    const first = within(view.dialog).getByRole('tab', { name: /^Wave 1(,|$)/ });
    first.focus();
    fireEvent.keyDown(first, { key: 'End' });
    const panel = within(view.dialog).getByRole('tabpanel');
    expect(within(panel).getByRole('button', { name: 'Wave 3 enemies' })).toBeTruthy();
    expect(within(panel).getByRole('table', { name: 'Wave 3 enemy budgets' })).toBeTruthy();
    expect(within(view.dialog).queryByRole('button', { name: 'Wave 1 enemies' })).toBeNull();
    expect(
      within(view.dialog)
        .getByRole('tab', { name: /^Wave 3/ })
        .getAttribute('aria-selected'),
    ).toBe('true');
    expect(view.application.store.getState().projectWorkspace.history).toBe(history);
    const budgetRow = view.dialog.querySelector('.encounter-budget-control')!;
    expect(budgetRow.textContent).not.toMatch(/\d+\.\d{3,}/);
    expect(view.dialog.textContent).not.toContain('10.000000000000002');
  });
  it('focuses the invalid customization launcher without auto-opening it', async () => {
    const project = customize(createGoldenFGHIProject(), phase, {
      kind: 'generated',
      waveCount: 1,
      waves: [{ waveIndex: 1, typeKeys: ['Guard', 'Guard_Elite'] }],
    });
    const finding = simulateProject(catalog, project).findings.find(
      (entry) => entry.code === 'encounterCustomizationUnavailable',
    )!;
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'F',
      occurrenceById(phase.owner.occurrenceId),
    );
    openRoomTab('Room Timeline');
    const trigger = screen.getByRole('button', { name: 'Customize encounter' });
    act(() =>
      view.application.store.dispatch(
        findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
      ),
    );
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('keeps retained customization editable when invalid context has no generated candidates', async () => {
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
    expect(
      projection.workspace.interactions.encounterCustomizations.get(semanticAddressKey(phase))
        ?.generatedAssessment,
    ).toBeUndefined();
    const view = await open(project);
    expect(within(view.dialog).getByRole('heading', { name: 'Wave 3' })).toBeTruthy();
  });
  it('explains why Customize is disabled before its candidate context is available', async () => {
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
    const button = within(view.dialog).getByRole('button', { name: 'Edit' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.title).toBe('Complete earlier choices to evaluate this encounter.');
    expect(
      within(view.dialog).getByText('Complete earlier choices to evaluate this encounter.'),
    ).toBeTruthy();
  });
  it('initializes reward-owned Devotion at its exact phase', async () => {
    const owner = createEncounterPhaseAddress(
      oBiome,
      { kind: 'occurrence', occurrenceId: oOccurrenceIds.devotion },
      'Encounter',
    );
    const view = await open(loadSurfaceNOPQProject(), owner);
    await initialize(view);
    expect(within(view.dialog).getByRole('radiogroup', { name: 'Waves' })).toBeTruthy();
    expect(
      projectStructuredWorkspaceFixture(
        view.application.store.getState().projectWorkspace.history!.present,
      ).workspace.interactions.encounterCustomizations.get(semanticAddressKey(owner))
        ?.generatedAssessment?.issues,
    ).toEqual([]);
  });
});
