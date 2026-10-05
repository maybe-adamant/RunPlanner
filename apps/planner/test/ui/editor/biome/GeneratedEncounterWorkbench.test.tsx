// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createOccurrenceId,
  semanticAddressKey,
  type AuthoredGeneratedEncounterCustomization,
  type EncounterPhaseAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  createCompleteFGProject,
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
import {
  authorFreshFileRoomIssues,
  createFreshFileRouteProject,
  freshFileFBiome,
  newHFieldsRoomId,
  withNewHFieldsRoom,
} from '@run-planner/test-fixtures/fresh-file';
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
  openRoomTab('Room Overview');
  const trigger = screen
    .getAllByRole('button', { name: 'Customize encounter' })
    .find((button) => button.dataset.semanticOwner === semanticAddressKey(owner))!;
  await view.user.click(trigger);
  return { ...view, dialog: await screen.findByRole('dialog', { name: /\(.+\)$/ }) };
}
function customizeTrigger(project: ProjectDocument, owner = phase): HTMLButtonElement {
  renderOccurrenceWorkbench(
    project,
    owner.routeKey,
    owner.biomeKey,
    occurrenceById(owner.owner.occurrenceId),
  );
  openRoomTab('Room Overview');
  return screen
    .getAllByRole('button', { name: 'Customize encounter' })
    .find(
      (button) => button.dataset.semanticOwner === semanticAddressKey(owner),
    )! as HTMLButtonElement;
}
async function initialize(view: Awaited<ReturnType<typeof open>>) {
  await view.user.click(within(view.dialog).getByRole('button', { name: 'Edit' }));
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
  it('shows the engine remainder before the minimum-one adjustment', async () => {
    const view = await open(
      customize(createCompleteFGProject(), phase, {
        kind: 'generated',
        waveCount: 1,
        waves: [{ waveIndex: 1, typeKeys: ['Guard', 'Brawler'], allocations: { Guard: 9999 } }],
      }),
    );
    const table = within(view.dialog).getByRole('table', { name: 'Wave 1 enemy budgets' });
    const row = within(table).getByRole('row', { name: /^Budget/ });
    expect(within(row).getAllByRole('cell').at(-1)?.textContent).toBe('0→ 18');
    expect(within(within(row).getAllByRole('cell').at(-1)!).queryByRole('textbox')).toBeNull();
  });
  it('shows group counts as groups and individual totals with derived-value hovers', async () => {
    const owner = createEncounterPhaseAddress(
      goldenGBiome,
      { kind: 'occurrence', occurrenceId: goldenGOccurrenceId(4, 1) },
      'Encounter',
    );
    const view = await open(
      customize(createCompleteFGProject(), owner, {
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
      customize(createCompleteFGProject(), phase, {
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
    const enabled = applyProjectCommand(createCompleteFGProject(), catalog, {
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
    expect(view.dialog.textContent).toContain('Converted Whisper requests exceed');
    const findings = within(view.dialog).getByRole('region', { name: 'Customization findings' });
    expect(findings.textContent).toContain('Wave 1: Converted Whisper requests exceed');
    const invalidTab = within(view.dialog).getByRole('tab', { name: 'Wave 1, needs attention' });
    expect(invalidTab.textContent).toContain('!');
    expect(invalidTab.textContent).not.toContain('Needs attention');
    await view.user.click(within(view.dialog).getByRole('button', { name: 'Wave 1 enemies' }));
    await view.user.click(await screen.findByRole('option', { name: 'Whisper (5)' }));
    await view.user.click(await screen.findByRole('option', { name: 'Wastrel (18)' }));
    await view.user.click(await screen.findByRole('option', { name: 'Finish Wave' }));
    expect(current(view)).toMatchObject({ menace: [{ conversions: { Guard: { count: 14 } } }] });
    expect(view.dialog.textContent).toContain('Converted Whisper requests exceed');
    fireEvent.change(
      within(view.dialog).getByRole('textbox', { name: 'Wave 1 Whisper converted' }),
      { target: { value: '1' } },
    );
    fireEvent.blur(within(view.dialog).getByRole('textbox', { name: 'Wave 1 Whisper converted' }));
    expect(current(view)).toMatchObject({ menace: [{ conversions: { Guard: { count: 1 } } }] });
    // The findings region stays mounted while the composition is active.
    const cleared = within(view.dialog).getByRole('region', { name: 'Customization findings' });
    expect(cleared.textContent).toContain('No current findings.');
    expect(cleared.textContent).not.toContain('Converted Whisper requests exceed');
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
  it('keeps typed budget over-requests authored exactly like saved ones', async () => {
    const view = await open(
      customize(createCompleteFGProject(), phase, {
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
    const savedResult = input.closest('td')!.textContent;
    fireEvent.change(input, { target: { value: '10000' } });
    fireEvent.blur(input);
    expect(waveBudget).toBeLessThan(10000);
    expect(current(view)).toMatchObject({ waves: [{ allocations: { Guard: 10000 } }] });
    const typed = within(view.dialog).getByRole('textbox', { name: 'Wave 1 Whisper budget' });
    expect((typed as HTMLInputElement).value).toBe('10000');
    expect(typed.closest('td')!.textContent).toBe(savedResult);
    fireEvent.change(typed, { target: { value: '12x' } });
    fireEvent.blur(typed);
    expect(current(view)).toMatchObject({ waves: [{ allocations: { Guard: 10000 } }] });
  });
  it('creates the complete composition only through Customize and resets it atomically', async () => {
    const view = await open(createCompleteFGProject());
    expect(current(view)).toBeUndefined();
    const explanation = 'The game chooses these enemies unless you select Edit.';
    expect(within(view.dialog).getByText(explanation)).toBeTruthy();
    await initialize(view);
    expect(current(view)).toMatchObject({
      kind: 'generated',
      waveCount: expect.any(Number),
      waves: expect.any(Array),
    });
    const created = view.application.store.getState().projectWorkspace.history!;
    expect(
      within(view.dialog).getByRole('columnheader', { name: /Wave budget .* encounter budget/ }),
    ).toBeTruthy();
    await view.user.click(within(view.dialog).getByRole('button', { name: 'Help' }));
    expect(
      within(view.dialog).getByRole('region', { name: 'Encounter composition help' }).textContent,
    ).toContain('Changes apply immediately. Undo reverses edits.');
    expect(within(view.dialog).queryByRole('heading', { name: 'Menace' })).toBeNull();
    await view.user.click(within(view.dialog).getByRole('button', { name: 'Help' }));
    expect(
      within(view.dialog).queryByRole('region', { name: 'Encounter composition help' }),
    ).toBeNull();
    expect(view.application.store.getState().projectWorkspace.history).toBe(created);
    await view.user.click(within(view.dialog).getByRole('button', { name: 'Reset' }));
    expect(current(view)).toBeUndefined();
    expect(within(view.dialog).getByText(explanation)).toBeTruthy();
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(view.application.store.getState().projectWorkspace.history!.present).toBe(
      created.present,
    );
  });
  it('stages Fangs perks until Finish and clears them only with Reset customization', async () => {
    let project = applyProjectCommand(createCompleteFGProject(), catalog, {
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
  it('commits a seed-only wave only after its final confirmation', async () => {
    const view = await open(customize(createCompleteFGProject(), phase, composed));
    const before = view.application.store.getState().projectWorkspace.history!;
    await view.user.click(within(view.dialog).getByRole('button', { name: 'Wave 1 enemies' }));
    expect(view.application.store.getState().projectWorkspace.history).toBe(before);
    await view.user.click(await screen.findByRole('option', { name: 'Whisper (5)' }));
    expect(screen.queryByRole('option', { name: 'Finish Wave' })).toBeNull();
    expect(current(view)).toMatchObject({
      waves: expect.arrayContaining([expect.objectContaining({ waveIndex: 1, typeKeys: [] })]),
    });
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(view.application.store.getState().projectWorkspace.history!.present).toBe(
      before.present,
    );
  });

  it('automatically commits an exhausted wave with its allocations and one Undo step', async () => {
    const view = await open(customize(createCompleteFGProject(), phase, composed));
    await selectBudgetWave(view, 3);
    const before = view.application.store.getState().projectWorkspace.history!;
    await view.user.click(within(view.dialog).getByRole('button', { name: 'Wave 3 enemies' }));
    await view.user.click(await screen.findByRole('option', { name: 'Whisper (5)' }));
    await view.user.click(await screen.findByRole('option', { name: 'Spindle (7)' }));
    expect(view.application.store.getState().projectWorkspace.history).toBe(before);
    await view.user.click(await screen.findByRole('option', { name: 'Casket (12)' }));
    expect(screen.queryByRole('option', { name: 'Finish Wave' })).toBeNull();
    expect(current(view)).toMatchObject({ waves: [{ allocations: { Guard: 2, Radiator: 3 } }] });
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(view.application.store.getState().projectWorkspace.history!.present).toBe(
      before.present,
    );
  });
  it('formats fractional budgets and keeps wave tabs out of authored history', async () => {
    const value = {
      ...composed,
      waves: [
        { waveIndex: 2, typeKeys: ['Mage'], allocations: { Guard: 5 } },
        { ...composed.waves[0], allocations: { Guard: 5, Brawler: 10.000000000000002 } },
      ],
    };
    const view = await open(customize(createCompleteFGProject(), phase, value));
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
    const project = customize(createCompleteFGProject(), phase, {
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
    openRoomTab('Room Overview');
    const trigger = screen.getByRole('button', { name: 'Customize encounter' });
    act(() =>
      view.application.store.dispatch(
        findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
      ),
    );
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('disables Customize for a retained composition whose context is unreached', async () => {
    let project = customize(createCompleteFGProject(), phase, composed);
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase: createEncounterPhaseAddress(
        goldenFBiome,
        { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(1, 1) },
        'Encounter',
      ),
      encounterKey: 'ArtemisCombatF',
    });
    const interaction = projectStructuredWorkspaceFixture(
      project,
    ).workspace.interactions.encounterCustomizations.get(semanticAddressKey(phase));
    expect(interaction?.generatedAssessment).toBeUndefined();
    const button = customizeTrigger(project);
    expect(button.disabled).toBe(true);
    expect(button.title).toBe('Waits on an earlier choice');
  });
  it('repairs required Fields passive composition from Overview without opening its dialog automatically', async () => {
    const owner = createEncounterPhaseAddress(
      createBiomeAddress('FreshFile', 'H'),
      { kind: 'occurrence', occurrenceId: newHFieldsRoomId },
      'Passive',
    );
    const authored = authorFreshFileRoomIssues(
      withNewHFieldsRoom(createFreshFileRouteProject(), 'FreshFile', 'max'),
      'H',
      newHFieldsRoomId,
    ).project;
    const project = applyProjectCommand(authored, catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase: owner,
      decisionKey: 'generatedComposition',
      value: null,
    });
    const view = renderOccurrenceWorkbench(
      project,
      'FreshFile',
      'H',
      occurrenceById(newHFieldsRoomId),
    );
    openRoomTab('Room Timeline');
    expect(screen.queryByLabelText('Passive encounter events')).toBeNull();
    openRoomTab('Room Overview');
    const finding = simulateProject(catalog, project).findings.find(
      (entry) => entry.code === 'encounterCustomizationRequired',
    )!;
    expect(finding.origin).toEqual(owner);
    act(() =>
      view.application.store.dispatch(
        findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
      ),
    );
    const encounters = screen.getByRole('region', { name: 'Encounter structure' });
    expect(within(encounters).getByRole('heading', { name: 'Encounters' })).toBeTruthy();
    const passive = within(encounters).getByRole('region', { name: 'Passive encounter phase' });
    expect(within(passive).getByText('Passive encounter')).toBeTruthy();
    const trigger = within(passive).getByRole('button', {
      name: 'Customize encounter',
    });
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(screen.queryByRole('dialog')).toBeNull();
    await view.user.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: /\(.+\)$/ });
    await view.user.click(within(dialog).getByRole('button', { name: 'Edit' }));
    expect(current(view, owner)).toBeDefined();
  });
  it('keeps every phase of its room editable while a later phase composition is the issue', async () => {
    const room = (phaseKey: string) =>
      createEncounterPhaseAddress(
        createBiomeAddress('FreshFile', 'H'),
        { kind: 'occurrence', occurrenceId: newHFieldsRoomId },
        phaseKey,
      );
    const authored = authorFreshFileRoomIssues(
      withNewHFieldsRoom(createFreshFileRouteProject(), 'FreshFile', 'max'),
      'H',
      newHFieldsRoomId,
    ).project;
    const project = applyProjectCommand(authored, catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase: room('Cage02'),
      decisionKey: 'generatedComposition',
      value: null,
    });
    const earlier = await open(project, room('Cage01'));
    expect(within(earlier.dialog).queryByRole('tab', { name: /^Wave 1/ })).toBeTruthy();
    expect(
      (within(earlier.dialog).getByRole('button', { name: 'Wave 1 enemies' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    cleanup();
    // The composition stops the room at its Overview, where every phase was prepared.
    const later = customizeTrigger(project, room('Cage03'));
    expect(later.disabled).toBe(false);
  });
  it('lists a context-less phase selector as declared encounters without availability claims', async () => {
    const project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'SelectEncounter',
      phase: createEncounterPhaseAddress(
        goldenFBiome,
        { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(1, 1) },
        'Encounter',
      ),
      encounterKey: 'ArtemisCombatF',
    });
    const view = renderOccurrenceWorkbench(
      project,
      phase.routeKey,
      phase.biomeKey,
      occurrenceById(phase.owner.occurrenceId),
    );
    openRoomTab('Room Overview');
    await view.user.click(screen.getByRole('button', { name: 'Encounter' }));
    const listbox = await screen.findByRole('listbox');
    expect(listbox.textContent).toContain('Declared encounters · evaluated after earlier choices');
    const options = within(listbox).getAllByRole('option');
    expect(options.length).toBeGreaterThan(1);
    for (const option of options) {
      expect(option.textContent).not.toMatch(/Not evaluated|Unavailable|has not been evaluated/);
      expect(option.getAttribute('aria-disabled')).not.toBe('true');
    }
  });
  it('disables Customize with a static title while the phase context is unreached', async () => {
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
    const button = customizeTrigger(project, owner);
    expect(button.disabled).toBe(true);
    expect(button.title).toBe('Waits on an earlier choice');
  });
  it('selects a shared enemy from the assessed picker and withholds a context-less phase', async () => {
    const view = await open(
      customize(createCompleteFGProject(), phase, { kind: 'generated', waveCount: 3 }),
    );
    const trigger = within(view.dialog).getByRole('button', { name: 'Shared Enemy' });
    expect(trigger.textContent).toContain('Select shared enemy');
    expect(trigger.getAttribute('aria-invalid')).not.toBe('true');
    await view.user.click(trigger);
    const options = within(await screen.findByRole('listbox')).getAllByRole('option');
    expect(options.map((option) => option.textContent)).not.toContainEqual(
      expect.stringMatching(/Select shared enemy|no longer available/),
    );
    expect(screen.queryByText('This current choice is no longer available here.')).toBeNull();
    await view.user.click(await screen.findByRole('option', { name: 'Whisper (5)' }));
    expect(current(view)).toMatchObject({ waveCount: 3, highlightKey: 'Guard' });
    expect(screen.getByRole('dialog', { name: /\(.+\)$/ })).toBeTruthy();
    cleanup();
    const unassessed = applyProjectCommand(
      customize(createCompleteFGProject(), phase, { kind: 'generated', waveCount: 3 }),
      catalog,
      {
        kind: 'SelectEncounter',
        phase: createEncounterPhaseAddress(
          goldenFBiome,
          { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(1, 1) },
          'Encounter',
        ),
        encounterKey: 'ArtemisCombatF',
      },
    );
    const withheld = customizeTrigger(unassessed);
    expect(withheld.disabled).toBe(true);
    expect(withheld.title).toBe('Waits on an earlier choice');
  });
  it('shows engine allocation findings for the affected wave', async () => {
    const view = await open(
      customize(createCompleteFGProject(), phase, {
        kind: 'generated',
        waveCount: 3,
        highlightKey: 'Radiator',
        waves: [
          { waveIndex: 3, typeKeys: ['Brawler', 'Mage'], allocations: { Guard: 20, Brawler: 10 } },
        ],
      }),
    );
    const findings = within(view.dialog).getByRole('region', {
      name: 'Customization findings',
    }).textContent;
    expect(findings).toContain('Wave 3: Set each editable enemy budget.');
    expect(findings).toContain(
      'Wave 3: Budgets include an enemy that no longer has an editable budget. Edit the affected wave.',
    );
  });
  it('keeps waves, shared enemy, Fangs and Menace across a wave-count edit', async () => {
    const value = {
      ...composed,
      fangs: { typeKey: 'Guard_Elite', perkKeys: ['Blink'] },
      menace: [{ waveIndex: 3, conversions: { Brawler: { count: 1 } } }],
    } as const;
    const view = await open(customize(createCompleteFGProject(), phase, value));
    await view.user.click(within(view.dialog).getByRole('radio', { name: '2' }));
    expect(current(view)).toEqual({ ...value, waveCount: 2 });
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(current(view)).toEqual(value);
  });
  it('hides the shared enemy for one wave without deleting the retained choice', async () => {
    const view = await open(customize(createCompleteFGProject(), phase, composed));
    expect(within(view.dialog).getByRole('button', { name: 'Shared Enemy' })).toBeTruthy();
    await view.user.click(within(view.dialog).getByRole('radio', { name: '1' }));
    expect(within(view.dialog).queryByRole('button', { name: 'Shared Enemy' })).toBeNull();
    expect(current(view)).toEqual({ ...composed, waveCount: 1 });
    await view.user.click(within(view.dialog).getByRole('radio', { name: '3' }));
    expect(within(view.dialog).getByRole('button', { name: 'Shared Enemy' })).toBeTruthy();
    expect(current(view)).toEqual(composed);
  });
  it('shows a mixed introduction fixed first wave as a disabled row beside its suffix', async () => {
    const owner = createEncounterPhaseAddress(
      freshFileFBiome,
      { kind: 'occurrence', occurrenceId: createOccurrenceId('fresh-2-0') },
      'Encounter',
    );
    const view = await open(createFreshFileRouteProject(), owner);
    expect(
      within(view.dialog).getByRole('heading', {
        level: 2,
        name: 'Spindle introduction (RadiatorIntro)',
      }),
    ).toBeTruthy();
    expect(within(view.dialog).queryByRole('heading', { name: 'Wave 1' })).toBeNull();
    expect(within(view.dialog).getByText('This encounter’s first wave is fixed')).toBeTruthy();
    expect(within(view.dialog).queryByRole('button', { name: 'Shared Enemy' })).toBeNull();
    // The editable suffix opens first; the fixed wave keeps its own row.
    expect(
      within(view.dialog)
        .getByRole('tab', { name: /^Wave 2/ })
        .getAttribute('aria-selected'),
    ).toBe('true');
    expect(
      (within(view.dialog).getByRole('button', { name: 'Wave 2 enemies' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    await selectBudgetWave(view, 1);
    expect(within(view.dialog).queryByRole('button', { name: 'Wave 1 enemies' })).toBeNull();
    const table = within(view.dialog).getByRole('table', { name: 'Wave 1 enemies' });
    expect(within(table).getByRole('row', { name: /^Count/ }).textContent).toBe('Count5');
    expect(within(table).queryByRole('row', { name: /^Budget/ })).toBeNull();
    // A fresh profile has no Fear, so neither Fangs nor Menace controls appear.
    expect(within(view.dialog).queryByRole('rowheader', { name: /Menace/ })).toBeNull();
    expect(within(view.dialog).queryByRole('button', { name: /Fangs/ })).toBeNull();
    await view.user.click(within(view.dialog).getByRole('button', { name: 'Help' }));
    const help = within(view.dialog).getByRole('region', { name: 'Encounter composition help' });
    expect(help.textContent).toContain(
      'Fixed waves cannot be edited. Customize the remaining waves.',
    );
    expect(help.textContent).toContain(
      'You must customize this encounter again before continuing.',
    );
    expect(within(help).queryByRole('heading', { name: 'Fangs' })).toBeNull();
    expect(within(help).queryByRole('heading', { name: 'Menace' })).toBeNull();
  });
  it('opens a fixed identity read-only with every wave and no Reset', async () => {
    const owner = createEncounterPhaseAddress(
      freshFileFBiome,
      { kind: 'occurrence', occurrenceId: createOccurrenceId('fresh-0-0') },
      'Encounter',
    );
    const view = renderOccurrenceWorkbench(
      createFreshFileRouteProject(),
      owner.routeKey,
      owner.biomeKey,
      occurrenceById(owner.owner.occurrenceId),
    );
    openRoomTab('Room Overview');
    expect(screen.queryByRole('button', { name: 'Customize encounter' })).toBeNull();
    await view.user.click(screen.getByRole('button', { name: 'Inspect encounter' }));
    const dialog = await screen.findByRole('dialog', { name: 'Intro combat (FIntroFight)' });
    expect(within(dialog).getByText('This encounter is fixed')).toBeTruthy();
    expect(within(dialog).queryByRole('button', { name: 'Reset' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Edit' })).toBeNull();
    const four = within(dialog).getByRole('radio', { name: '4' }) as HTMLInputElement;
    expect([four.checked, four.disabled]).toEqual([true, true]);
    expect(
      within(dialog)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['Wave 1', 'Wave 2', 'Wave 3', 'Wave 4']);
    await view.user.click(within(dialog).getByRole('tab', { name: 'Wave 4' }));
    const table = within(dialog).getByRole('table', { name: 'Wave 4 enemies' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Fixed', 'Wastrel', 'Whisper', 'Casket']);
    expect(within(table).getByRole('row', { name: /^Count/ }).textContent).toBe('Count131');
    expect(within(table).queryByRole('row', { name: /^Budget/ })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Wave 4 enemies' })).toBeNull();
  });
  it('shows native placeholders and the required finding on an uncustomized fresh phase', async () => {
    const owner = createEncounterPhaseAddress(
      freshFileFBiome,
      { kind: 'occurrence', occurrenceId: createOccurrenceId('fresh-2-0') },
      'Encounter',
    );
    const cleared = applyProjectCommand(createFreshFileRouteProject(), catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase: owner,
      decisionKey: 'generatedComposition',
      value: null,
    });
    const view = await open(cleared, owner);
    await view.user.click(
      within(view.dialog).getByRole('button', { name: 'Close encounter customization' }),
    );
    const finding = simulateProject(catalog, cleared).findings.find(
      (entry) => entry.code === 'encounterCustomizationRequired',
    )!;
    const trigger = screen.getByRole('button', { name: 'Customize encounter' });
    act(() =>
      view.application.store.dispatch(
        findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
      ),
    );
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(screen.queryByRole('dialog')).toBeNull();
    await view.user.click(trigger);
    view.dialog = await screen.findByRole('dialog', { name: /\(.+\)$/ });
    expect(
      screen.getByRole('button', { name: 'Customize encounter' }).getAttribute('data-has-findings'),
    ).toBe('true');
    expect(
      within(view.dialog).getByRole('region', { name: 'Customization findings' }).textContent,
    ).toContain('Customize this encounter');
    expect(
      within(view.dialog).getByRole('region', { name: 'Customization findings' }).textContent,
    ).toContain('Fresh File plans require customized encounters.');
    expect(within(view.dialog).queryByRole('button', { name: 'Reset' })).toBeNull();
    expect(within(view.dialog).getByRole('button', { name: 'Edit' })).toBeTruthy();
    expect(within(view.dialog).queryByRole('button', { name: 'Wave 2 enemies' })).toBeNull();
    expect(within(view.dialog).getByText('Select Edit to configure this wave.')).toBeTruthy();
    expect(
      (within(view.dialog).getByRole('radio', { name: '2' }) as HTMLInputElement).disabled,
    ).toBe(true);
  });
  it('lists no authored wave tabs until the composition is active', async () => {
    const view = await open(
      customize(createCompleteFGProject(), phase, { kind: 'generated', waveCount: 3 }),
    );
    expect(
      within(view.dialog).getByRole('region', { name: 'Customization findings' }).textContent,
    ).toContain('Shared Enemy');
    expect(within(view.dialog).queryByRole('tab')).toBeNull();
    expect(within(view.dialog).queryByRole('tabpanel')).toBeNull();
  });
  it('labels a mature native phase and an authored one by disposition', async () => {
    const native = await open(createCompleteFGProject());
    expect(within(native.dialog).getByText('Not customized')).toBeTruthy();
    expect(within(native.dialog).queryByRole('tab')).toBeNull();
    await initialize(native);
    expect(within(native.dialog).getByText('This encounter is generated')).toBeTruthy();
    expect(within(native.dialog).getByRole('button', { name: 'Reset' })).toBeTruthy();
  });
  it('warns about declared once-per-run enemies among engine-assessed active members', async () => {
    const owner = createEncounterPhaseAddress(
      goldenHBiome,
      { kind: 'occurrence', occurrenceId: createOccurrenceId('golden-h-combat05') },
      'Cage01',
    );
    const view = await open(
      customize(createGoldenFGHIProject(), owner, {
        kind: 'generated',
        waveCount: 1,
        waves: [{ waveIndex: 1, typeKeys: ['FogEmitter2', 'BrokenHearted', 'Lovesick'] }],
      }),
      owner,
    );
    const warning = within(view.dialog).getByText(
      'Sorrow-Spiller can appear only once per run. An earlier uncustomized encounter may already include it.',
    );
    const findings = within(view.dialog).getByRole('region', { name: 'Customization findings' });
    expect(findings.contains(warning)).toBe(true);
    expect(findings.textContent).not.toContain('No current findings.');
    // Warnings follow the wave controls instead of mounting above the wave tabs.
    const tabs = within(view.dialog).getByRole('tablist', { name: 'Wave budgets' });
    expect(tabs.compareDocumentPosition(findings) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(tabs.contains(warning)).toBe(false);
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
