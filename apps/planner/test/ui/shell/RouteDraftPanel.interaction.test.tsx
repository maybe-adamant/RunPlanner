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
  const application = createApplication({ draftRunner: runner, rerollSeed: () => 42 });
  application.store.dispatch(
    newProjectCreated(
      createProjectDocument(application.catalog, {
        projectId: 'run-plan',
        routeKey,
        configuredBiomeCount: 4,
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

  it('numbers the god pool in click order and resets it', () => {
    open();
    const gods = () => screen.getByRole('group', { name: 'Gods' });
    const number = (name: string) =>
      within(gods()).getByRole('button', { name }).querySelector('.draft-order-number')
        ?.textContent;
    const reset = () => within(gods()).getByRole('button', { name: 'Reset god order' });
    expect((reset() as HTMLButtonElement).disabled).toBe(true);
    chooseGods(['Hestia', 'Zeus', 'Apollo']);
    expect(['Hestia', 'Zeus', 'Apollo', 'Hera'].map(number)).toEqual(['1', '2', '3', undefined]);
    // Unchoosing a god closes the gap behind it.
    chooseGods(['Hestia']);
    expect(['Zeus', 'Apollo'].map(number)).toEqual(['1', '2']);
    fireEvent.click(reset());
    expect(['Zeus', 'Apollo'].map((name) => pressed(name))).toEqual(['false', 'false']);
    chooseGods(['Apollo', 'Zeus']);
    expect(['Apollo', 'Zeus'].map(number)).toEqual(['1', '2']);
  });

  it("notes pool #1's non-core first trait and blocks the draft until a core leads", () => {
    const { catalog } = open();
    chooseGods(['Zeus', 'Apollo', 'Hestia']);
    const label = (key: string) => catalog.traits.byKey[key]!.label;
    const [ring, cast] = ['FocusLightningBoon', 'ZeusCastBoon'].map(label);
    const dialog = openBasket();
    for (const name of [ring!, cast!])
      fireEvent.click(within(dialog).getByRole('button', { name }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    const note =
      "Zeus's first trait must be a core boon (Attack, Special, Cast, Sprint or Magick).";
    expect(screen.getByText(note)).toBeTruthy();
    expect(draftButton().getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(
      within(screen.getByRole('list', { name: 'Zeus basket traits' })).getByRole('button', {
        name: `Move ${cast} earlier`,
      }),
    );
    expect(screen.queryByText(note)).toBeNull();
    expect(draftButton().getAttribute('aria-disabled')).not.toBe('true');
  });

  it('orders a god by core slot, then other boons, then its Legendary, with Duos last', () => {
    const { catalog } = open();
    chooseGods(['Zeus', 'Apollo']);
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
    expect(sections).toEqual(['Zeus', 'Apollo', 'Duos']);

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

  it('lists only Duos shared by pool gods, and none for a single god', () => {
    const { catalog } = open();
    chooseGods(['Zeus', 'Hera', 'Apollo']);
    let dialog = openBasket();
    const duos = within(within(dialog).getByRole('region', { name: 'Duos' }))
      .getAllByRole('button')
      .map((button) => button.textContent);
    const givers = (label: string | null) =>
      catalog.traitGivers.values
        .filter((giver) =>
          giver.traitKeys.some((key) => catalog.traits.byKey[key]?.label === label),
        )
        .map((giver) => giver.key);
    expect(duos.length).toBeGreaterThan(0);
    for (const duo of duos)
      expect(['Zeus', 'Hera', 'Apollo']).toEqual(expect.arrayContaining(givers(duo)));
    fireEvent.keyDown(dialog, { key: 'Escape' });

    // Deselecting Hera and Apollo leaves Zeus alone.
    chooseGods(['Hera', 'Apollo']);
    dialog = openBasket();
    expect(within(dialog).queryByRole('region', { name: 'Duos' })).toBeNull();
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

    const chips = screen.getByRole('list', { name: 'Zeus basket traits' });
    // An ordered cell shows the trait's icon, named and hinted by the trait.
    expect(hintOf(within(chips).getByRole('listitem', { name: zeusAttack }))).toBe(zeusAttack);
    fireEvent.click(within(chips).getByRole('button', { name: `Remove ${zeusAttack}` }));
    expect(screen.queryByRole('list', { name: 'Zeus basket traits' })).toBeNull();
  });

  it("numbers and reorders each god's traits, never into an order the engine refuses", () => {
    const { catalog } = open();
    chooseGods(['Zeus', 'Apollo']);
    const label = (key: string) => catalog.traits.byKey[key]!.label;
    const [cast, strike, rush] = ['ZeusCastBoon', 'DoubleBoltBoon', 'ZeusSprintBoon'].map(label);
    const dialog = openBasket();
    for (const name of [cast!, strike!, rush!])
      fireEvent.click(within(dialog).getByRole('button', { name }));
    const badge = (name: string) =>
      within(dialog).getByRole('button', { name }).querySelector('.draft-order-number')
        ?.textContent;
    expect([cast!, strike!, rush!].map(badge)).toEqual(['1', '2', '3']);
    // Hermes takes its traits in basket order too; Selene's single trait has no number.
    fireEvent.click(within(dialog).getByRole('tab', { name: /^Bonus/ }));
    const [first, second] = ['HermesWeaponBoon', 'HermesSpecialBoon'].map(label);
    const selene = label(catalog.traitGivers.byKey.SpellDrop!.traitKeys[0]!);
    for (const name of [second!, first!, selene])
      fireEvent.click(within(dialog).getByRole('button', { name }));
    expect([second!, first!, selene].map(badge)).toEqual(['1', '2', undefined]);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    const hermes = screen.getByRole('list', { name: 'Hermes basket traits' });
    fireEvent.click(within(hermes).getByRole('button', { name: `Move ${first} earlier` }));
    expect(
      within(screen.getByRole('list', { name: 'Hermes basket traits' }))
        .getAllByRole('listitem')
        .map((chip) => chip.getAttribute('aria-label')),
    ).toEqual([first, second]);
    expect(
      within(screen.getByRole('list', { name: 'Other basket traits' })).getByRole('listitem', {
        name: selene,
      }),
    ).toBeTruthy();

    const zeus = () => screen.getByRole('list', { name: 'Zeus basket traits' });
    const order = () =>
      within(zeus())
        .getAllByRole('listitem')
        .map((chip) => chip.getAttribute('aria-label'));
    const move = (name: string, direction: 'earlier' | 'later') =>
      within(zeus()).getByRole('button', { name: `Move ${name} ${direction}` });
    expect(order()).toEqual([cast, strike, rush]);
    // Double Strike needs a Zeus core boon before it, and Storm Ring is its only earlier one.
    expect((move(strike!, 'earlier') as HTMLButtonElement).disabled).toBe(true);
    expect((move(cast!, 'earlier') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(move(rush!, 'earlier'));
    expect(order()).toEqual([cast, rush, strike]);
    expect((move(strike!, 'later') as HTMLButtonElement).disabled).toBe(true);

    // Removing Storm Ring leaves Double Strike first: refused, with a visible note, and repairable.
    fireEvent.click(move(strike!, 'earlier'));
    fireEvent.click(within(zeus()).getByRole('button', { name: `Remove ${cast}` }));
    expect(order()).toEqual([strike, rush]);
    expect(screen.getByText(`${strike} needs ${rush} first.`)).toBeTruthy();
    expect((move(strike!, 'later') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(move(strike!, 'later'));
    expect(order()).toEqual([rush, strike]);
    expect(screen.queryByText(`${strike} needs ${rush} first.`)).toBeNull();
  });

  it('plans up to a biome from the Draft tab, keeping only its NPC rows and racks', () => {
    const { application, catalog } = open();
    const draft = () => application.store.getState().projectWorkspace.history!.present.route;
    const label = (key: string) => catalog.biomes.byKey[key]!.label;
    fireEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Biomes to configure' })).getByRole('radio', {
        name: label('G'),
      }),
    );
    expect(draft().biomes.map((biome) => biome.biomeKey)).toEqual(['F', 'G']);
    const npcRows = within(screen.getByRole('table', { name: 'NPCs' }))
      .getAllByRole('rowheader')
      .map((row) => row.textContent);
    expect(npcRows).toEqual([label('F'), label('G')]);
    expect(screen.queryByRole('button', { name: `After ${label('G')}` })).toBeTruthy();
    expect(screen.queryByRole('button', { name: `After ${label('H')}` })).toBeNull();
    const summary = screen.getByRole('list', { name: 'Basket caps' });
    expect(
      within(summary)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toContain('Hermes + Hammer0/2');
  });

  it('sets per-biome god boons, the per-god cap and room preferences on the Advanced tab', () => {
    const { application } = open();
    const draft = () => application.store.getState().projectWorkspace.history!.present.route.draft;
    fireEvent.click(screen.getByRole('tab', { name: 'Advanced' }));
    expect(screen.getByRole('tab', { name: 'Advanced' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    const oceanus = screen.getByRole('slider', { name: /God boons in Oceanus/ });
    expect((oceanus as HTMLInputElement).value).toBe('2');
    // Fixed tags keep their positions; only their activity changes.
    const tags = within(screen.getByRole('list', { name: 'God boon rules' })).getAllByRole(
      'listitem',
    );
    expect(tags.map((tag) => tag.textContent)).toEqual([
      'Above default → more misses',
      'Forfeit −1/biome',
      'Reachable 20',
    ]);
    expect(tags.map((tag) => tag.hasAttribute('data-active'))).toEqual([true, false, false]);
    fireEvent.change(oceanus, { target: { value: '4' } });
    expect(draft().godBoonsByBiome).toEqual({ G: 4 });
    fireEvent.change(oceanus, { target: { value: '2' } });
    expect(draft().godBoonsByBiome).toBeUndefined();

    expect(screen.getByText('Recommended: 5 without Denial · 4 with Denial')).toBeTruthy();
    const perGod = screen.getByRole('slider', { name: 'Most boons from one god' });
    fireEvent.change(perGod, { target: { value: '2' } });
    expect(draft().perGodCap).toBe(2);
    expect(screen.getByText('Reachable 8').hasAttribute('data-active')).toBe(true);
    // Under Denial the default drops to four, so a stored five is kept.
    act(() => {
      application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceFearVowRank',
          route: { kind: 'route', routeKey: 'Underworld' },
          vowKey: 'BanUnpickedBoonsShrineUpgrade',
          rank: 1,
        }),
      );
    });
    fireEvent.change(perGod, { target: { value: '5' } });
    expect(draft().perGodCap).toBe(5);
    fireEvent.change(perGod, { target: { value: '4' } });
    expect(draft()).not.toHaveProperty('perGodCap');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Prefer midshops' }));
    expect(draft().preferMidshops).toBe(true);
    expect(screen.getByText('Drafts take longer.')).toBeTruthy();
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Pursue the Tartarus goal aggressively' }),
    );
    expect(draft().pursueTartarusGoal).toBe(true);
    // Tartarus's default 4 is above what it yields with the goal pursued.
    expect(screen.getByText('Default: 4 · expected: 3')).toBeTruthy();
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Pursue the Tartarus goal aggressively' }),
    );
    expect(draft()).not.toHaveProperty('pursueTartarusGoal');
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

  it('dims god keepsakes in the starting keepsake rack', async () => {
    const { application, catalog } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Starting keepsake' }));
    const dialog = screen.getByRole('dialog', { name: 'Starting keepsake' });
    const rack = await within(dialog).findByRole('group', { name: 'Keepsakes' });
    const god = catalog.keepsakes.values.find((keepsake) => forcesGod(catalog, keepsake.key))!;
    const bangle = within(rack).getByRole('button', { name: god.label });
    expect(bangle.getAttribute('aria-disabled')).toBe('true');
    expect(hintOf(bangle)).toBe("Drafting can't use god keepsakes.");
    fireEvent.click(bangle);
    expect(
      application.store.getState().projectWorkspace.history!.present.route.loadout
        .startingKeepsakeKey,
    ).not.toBe(god.key);
    fireEvent.click(within(rack).getByRole('button', { name: 'Gold Purse' }));
    expect(within(dialog).getByText('Gold Purse', { selector: 'p' })).toBeTruthy();
    expect(
      application.store.getState().projectWorkspace.history!.present.route.loadout
        .startingKeepsakeKey,
    ).toBe('BonusMoneyKeepsake');
  });

  it('shows each rack inheriting the keepsake held before it, storing only real changes', () => {
    const { application, catalog, runs } = open();
    const rackLabel = (biomeKey: string) => `After ${catalog.biomes.byKey[biomeKey]!.label}`;
    const launcher = (biomeKey: string) =>
      screen.getByRole('button', { name: rackLabel(biomeKey) });
    const choose = (biomeKey: string, keepsake: string) => {
      fireEvent.click(launcher(biomeKey));
      const dialog = screen.getByRole('dialog', { name: rackLabel(biomeKey) });
      fireEvent.click(within(dialog).getByRole('button', { name: keepsake }));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    };
    const shown = () => ['F', 'G', 'H'].map((biomeKey) => launcher(biomeKey).textContent);
    const stored = () =>
      application.store.getState().projectWorkspace.history!.present.route.draft
        .rackKeepsakeByBiome;
    // A rack that keeps the held keepsake reads as unchanged.
    expect(shown()).toEqual([
      'Silver Wheel (Unchanged)',
      'Silver Wheel (Unchanged)',
      'Silver Wheel (Unchanged)',
    ]);

    choose('G', 'Lion Fang');
    expect(shown()).toEqual(['Silver Wheel (Unchanged)', 'Lion Fang', 'Lion Fang (Unchanged)']);
    choose('H', 'Gold Purse');
    expect(stored()).toEqual({ G: 'DecayingBoostKeepsake', H: 'BonusMoneyKeepsake' });
    // Choosing the keepsake already held there stores no change.
    choose('H', 'Lion Fang');
    expect(stored()).toEqual({ G: 'DecayingBoostKeepsake' });

    // A new starting keepsake flows through every rack that keeps inheriting.
    act(() => {
      application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceStartingKeepsake',
          selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
          keepsakeKey: 'BonusMoneyKeepsake',
        }),
      );
    });
    expect(shown()).toEqual(['Gold Purse (Unchanged)', 'Lion Fang', 'Lion Fang (Unchanged)']);
    chooseGods(['Zeus', 'Hera', 'Apollo']);
    fireEvent.click(draftButton());
    expect(runs[0]!.request.spec.rackKeepsakeKeys).toEqual([null, 'DecayingBoostKeepsake', null]);
  });

  it('locks the panel and its navigation while drafting, then reports the targets', () => {
    const { application, runs } = open();
    chooseGods(['Zeus', 'Apollo']);
    expect(draftButton().getAttribute('aria-disabled')).toBe('true');
    expect(hintOf(draftButton())).toBe('Choose at least 3 gods.');
    chooseGods(['Hera']);
    fireEvent.click(draftButton());
    expect(runs).toHaveLength(1);
    // Draft uses the project's saved seed; only Reroll draws a new one.
    expect(runs[0]!.request.seed).toBe(1);
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
    chooseGods(['Zeus', 'Apollo', 'Hera']);
    fireEvent.click(draftButton());
    act(() => runs[0]!.emit({ kind: 'error', message: 'worker crashed' }));
    expect(screen.getByText('Drafting stopped unexpectedly.')).toBeTruthy();
    expect(screen.queryByText(/^No plan found/)).toBeNull();
  });

  it('cancels a running draft', () => {
    const { runs } = open();
    chooseGods(['Zeus', 'Apollo', 'Hera']);
    fireEvent.click(draftButton());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(runs[0]!.cancelled).toBe(true);
    expect(draftButton()).toBeTruthy();
    expect(screen.queryByText(/^Drafting…/)).toBeNull();
  });
});
