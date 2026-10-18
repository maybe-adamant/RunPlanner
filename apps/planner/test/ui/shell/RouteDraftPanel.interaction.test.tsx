// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import {
  createProjectDocument,
  createRouteStartKeepsakeSelectionAddress,
} from '@run-planner/engine/authored-project';
import { forcesGod, type DraftResult } from '@run-planner/engine/simulation';
import { afterEach, describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { routePanelSelected } from '@planner/state/editorSessionSlice';
import { newProjectCreated } from '@planner/state/profileSessionSlice';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import type { DraftRunner, DraftRunRequest } from '@planner/workspace/draftRun';
import type { DraftRunEvent } from '@planner/workspace/draftWorkerProtocol';
import { renderPlannerForInteraction } from '@planner-test/fixtures/renderPlanner';
import { hintOf } from '@planner-test/support/hints';

afterEach(cleanup);

function open(routeKey = 'Underworld') {
  const runs: {
    request: DraftRunRequest;
    emit: (event: DraftRunEvent) => void;
    cancelled: boolean;
  }[] = [];
  const runner: DraftRunner = {
    start(request, onEvent) {
      const run = { request, emit: onEvent, cancelled: false };
      runs.push(run);
      return {
        cancel() {
          run.cancelled = true;
        },
      };
    },
  };
  const application = createApplication({ draftRunner: runner, draftSeed: () => 42 });
  application.store.dispatch(
    newProjectCreated(
      createProjectDocument(application.catalog, {
        projectId: 'run-plan',
        routeKey,
        configuredBiomeCount: 1,
      }),
    ),
  );
  application.store.dispatch(routePanelSelected({ routeKey, panel: { kind: 'draft' } }));
  const view = renderPlannerForInteraction({ application });
  return { ...view, catalog: application.catalog, runs };
}

const navigation = () => screen.getByRole('navigation', { name: /panels$/ });
const pressed = (name: string | RegExp) =>
  screen.getByRole('button', { name }).getAttribute('aria-pressed');
const draftButton = () =>
  within(document.querySelector('.draft-action-row') as HTMLElement).getByRole('button', {
    name: 'Draft',
  });

function chooseGods(names: readonly string[]) {
  const gods = screen.getByRole('group', { name: 'Gods' });
  for (const name of names) fireEvent.click(within(gods).getByRole('button', { name }));
}

function openBasket() {
  fireEvent.click(screen.getByRole('button', { name: 'Edit basket' }));
  return screen.getByRole('dialog');
}

describe('Draft panel', () => {
  it('is a route panel before Loadout, absent on the FreshFile route', () => {
    open();
    const items = within(navigation())
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? button.textContent);
    expect(items.slice(0, 3)).toEqual(['Route', 'Draft', 'Loadout']);
    cleanup();
    open('FreshFile');
    expect(within(navigation()).queryByRole('button', { name: 'Draft' })).toBeNull();
  });

  it('caps the god pool and toggles story and field NPCs by biome', () => {
    const { catalog } = open();
    const gods = within(screen.getByRole('group', { name: 'Gods' })).getAllByRole('button');
    chooseGods(['Zeus', 'Hera', 'Apollo', 'Aphrodite']);
    const unchosen = gods.filter((god) => god.getAttribute('aria-pressed') === 'false');
    expect(unchosen.length).toBeGreaterThan(0);
    expect(unchosen.every((god) => (god as HTMLButtonElement).disabled)).toBe(true);

    const erebus = catalog.biomes.byKey.F!.label;
    fireEvent.click(screen.getByRole('button', { name: `Arachne, story room in ${erebus}` }));
    fireEvent.click(screen.getByRole('button', { name: `Artemis in ${erebus}` }));
    expect(pressed(`Arachne, story room in ${erebus}`)).toBe('true');
    expect(pressed(`Artemis in ${erebus}`)).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: `Arachne, story room in ${erebus}` }));
    expect(pressed(`Arachne, story room in ${erebus}`)).toBe('false');

    // A field NPC appears once per run, so choosing it elsewhere moves it.
    const oceanus = catalog.biomes.byKey.G!.label;
    fireEvent.click(screen.getByRole('button', { name: `Artemis in ${oceanus}` }));
    expect(pressed(`Artemis in ${oceanus}`)).toBe('true');
    expect(pressed(`Artemis in ${erebus}`)).toBe('false');
  });

  it('orders a god by core slot, then other boons, then its Legendary, with Duos last', () => {
    const { catalog } = open();
    chooseGods(['Zeus', 'Hera']);
    const dialog = openBasket();
    expect(
      within(dialog)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual([
      expect.stringMatching(/^Gods/),
      expect.stringMatching(/^Bonus/),
      expect.stringMatching(/^NPCs/),
    ]);
    const sections = within(dialog)
      .getAllByRole('region')
      .map((s) => s.getAttribute('aria-label'));
    expect(sections).toEqual(['Zeus', 'Hera', 'Duos']);

    const zeus = within(within(dialog).getByRole('region', { name: 'Zeus' }))
      .getAllByRole('button')
      .map((button) => button.textContent);
    const trait = (label: string | null) =>
      catalog.traits.values.find((candidate) => candidate.label === label)!;
    expect(zeus.slice(0, 5).map((label) => trait(label).equipmentSlot)).toEqual([
      'Melee',
      'Secondary',
      'Ranged',
      'Rush',
      'Mana',
    ]);
    const last = trait(zeus.at(-1)!).rarityDomain;
    expect(last.kind === 'ranked' && last.freshOfferRarities).toEqual(['Legendary']);

    const shown = within(dialog)
      .getAllByRole('button', { pressed: false })
      .map((button) => button.textContent);
    const ransoms = catalog.traits.values.filter(
      (candidate) => candidate.selectedDisposition.kind === 'ransom',
    );
    expect(ransoms.length).toBeGreaterThan(0);
    for (const ransom of ransoms) expect(shown).not.toContain(ransom.label);
  });

  it('adds basket traits, refuses a second trait for a held slot, and lists the selected NPCs', () => {
    const { catalog } = open();
    chooseGods(['Zeus', 'Hera']);
    fireEvent.click(
      screen.getByRole('button', {
        name: `Artemis in ${catalog.biomes.byKey.F!.label}`,
      }),
    );
    const dialog = openBasket();
    const zeusAttack = catalog.traits.byKey.ZeusWeaponBoon!.label;
    const heraAttack = catalog.traits.byKey.HeraWeaponBoon!.label;
    fireEvent.click(within(dialog).getByRole('button', { name: zeusAttack }));
    // Counts come from the engine; the caps themselves are not asserted.
    expect(within(dialog).getByRole('tab', { name: /^Gods/ }).textContent).toMatch(/^Gods1\/\d+$/);
    expect(
      within(within(dialog).getByRole('region', { name: 'Zeus' })).getByRole('heading').textContent,
    ).toMatch(/^Zeus1\/\d+$/);
    expect(
      within(within(dialog).getByRole('region', { name: 'Hera' })).getByRole('heading').textContent,
    ).toMatch(/^Hera0\/\d+$/);
    expect(
      within(dialog).getByRole('button', { name: zeusAttack }).getAttribute('aria-pressed'),
    ).toBe('true');
    const blocked = within(dialog).getByRole('button', { name: heraAttack });
    expect(blocked.getAttribute('aria-disabled')).toBe('true');
    expect(hintOf(blocked)).toBe(`Slot held by ${zeusAttack}.`);
    fireEvent.click(blocked);
    expect(blocked.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(within(dialog).getByRole('tab', { name: /^NPCs/ }));
    expect(
      within(dialog)
        .getAllByRole('region')
        .map((s) => s.getAttribute('aria-label')),
    ).toEqual(['Field', catalog.traitGivers.byKey.Artemis!.label]);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));

    const chips = screen.getByRole('list', { name: 'Basket traits' });
    expect(within(chips).getByText(zeusAttack)).toBeTruthy();
    fireEvent.click(within(chips).getByRole('button', { name: `Remove ${zeusAttack}` }));
    expect(screen.queryByRole('list', { name: 'Basket traits' })).toBeNull();
  });

  it('blocks drafting from a keepsake that brings in a god', () => {
    const { application, catalog, runs } = open();
    const keepsake = catalog.keepsakes.values.find((candidate) =>
      forcesGod(catalog, candidate.key),
    )!;
    act(() => {
      application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceStartingKeepsake',
          selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
          keepsakeKey: keepsake.key,
        }),
      );
    });
    expect(draftButton().getAttribute('aria-disabled')).toBe('true');
    expect(hintOf(draftButton())).toBe(
      `${keepsake.label} brings in a god, so it can't start a draft.`,
    );
    fireEvent.click(draftButton());
    expect(runs).toHaveLength(0);
  });

  it('locks the panel and its navigation while drafting, then reports the targets', () => {
    const { application, runs } = open();
    chooseGods(['Zeus']);
    fireEvent.click(draftButton());
    expect(runs).toHaveLength(1);
    expect(runs[0]!.request.seed).toBe(42);
    expect(screen.getByText(/^Drafting…/)).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Zeus' }) as HTMLButtonElement).matches(':disabled'),
    ).toBe(true);
    expect(within(navigation()).getByRole('button', { name: 'Loadout' }).matches(':disabled')).toBe(
      true,
    );
    // The findings banner would navigate away from the Draft panel.
    const banner = () =>
      document.querySelector('.project-findings .assessment-issue-button') as HTMLButtonElement;
    expect(banner().disabled).toBe(true);
    const panelBefore = application.store.getState().editorSession.activePanel;
    fireEvent.click(banner());
    expect(application.store.getState().editorSession.activePanel).toBe(panelBefore);

    const result: DraftResult = {
      kind: 'failed',
      biomeKey: 'G',
      reasons: ['dead end'],
    };
    act(() => runs[0]!.emit({ kind: 'settled', result }));
    expect(screen.getByText(/^No plan found in /)).toBeTruthy();
    expect(within(navigation()).getByRole('button', { name: 'Loadout' }).matches(':disabled')).toBe(
      false,
    );
    expect(application.store.getState().draftSession.run.kind).toBe('failed');
    expect(banner().disabled).toBe(false);
  });

  it('reports a stopped search apart from a failed draft', () => {
    const { runs } = open();
    fireEvent.click(draftButton());
    act(() => runs[0]!.emit({ kind: 'error', message: 'worker crashed' }));
    expect(screen.getByText('Drafting stopped unexpectedly.')).toBeTruthy();
    expect(screen.queryByText(/^No plan found/)).toBeNull();
  });

  it('cancels a running draft', () => {
    const { runs } = open();
    fireEvent.click(draftButton());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(runs[0]!.cancelled).toBe(true);
    expect(draftButton()).toBeTruthy();
    expect(screen.queryByText(/^Drafting…/)).toBeNull();
  });
});
