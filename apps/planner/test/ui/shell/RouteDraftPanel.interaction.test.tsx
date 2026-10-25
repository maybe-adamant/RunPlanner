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
import {
  authoredProjectCommandDispatched,
  authoredProjectUndoRequested,
  authoredProjectReplaced,
} from '@planner/state/projectWorkspaceSlice';
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
    authoredProjectReplaced(
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

/** A read-only basket line on the panel, named by its row: God, Bonus or NPC traits. */
const basketLine = (row: 'God' | 'Bonus' | 'NPC') =>
  screen.queryByRole('button', { name: new RegExp(`^${row} traits:`) });
/** A basket line's chips, as their hover hints. */
const lineChips = (row: 'God' | 'Bonus' | 'NPC') =>
  [...(basketLine(row)?.querySelectorAll('.draft-chip') ?? [])].map((chip) => ({
    hint: hintOf(chip),
    refused: chip.hasAttribute('data-refused'),
    order: chip.querySelector('.draft-chip-order')?.textContent,
    partner: chip.querySelector('.draft-chip-partner') !== null,
  }));
const orderBadge = (dialog: HTMLElement, name: string) =>
  within(dialog).getByRole('button', { name }).querySelector('.draft-order-number')?.textContent;

describe('Draft panel', () => {
  it('is a route panel before Loadout, on every route', () => {
    for (const routeKey of ['Underworld', 'FreshFile']) {
      open(routeKey);
      const items = within(navigation())
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label') ?? button.textContent);
      expect(items.slice(0, 3)).toEqual(['Route', 'Draft', 'Loadout']);
      cleanup();
    }
  });

  it('gates Fresh File gods by route prerequisite, with rule tags and no bonus givers, NPCs or racks', () => {
    const { catalog } = open('FreshFile');
    const gods = () => screen.getByRole('group', { name: 'Gods' });
    const god = (name: string) => within(gods()).getByRole('button', { name });
    const enabled = () =>
      ['Aphrodite', 'Apollo', 'Demeter', 'Hestia', 'Poseidon'].filter(
        (name) => !(god(name) as HTMLButtonElement).disabled,
      );
    const tags = () =>
      within(screen.getByRole('list', { name: 'God pool rules' }))
        .getAllByRole('listitem')
        .map((tag) => [tag.textContent, tag.hasAttribute('data-active')]);
    expect(within(gods()).queryByRole('button', { name: 'Zeus' })).toBeNull();
    expect(screen.queryByRole('table', { name: 'NPCs' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Rack keepsakes' })).toBeNull();
    expect(tags()).toEqual([
      ['Run starts with Apollo', false],
      ['Aphrodite/Hestia after Poseidon or Demeter', false],
    ]);

    // Apollo first, then Poseidon or Demeter, then Aphrodite and Hestia.
    expect(enabled()).toEqual(['Apollo']);
    expect(hintOf(god('Poseidon'))).toBeNull();
    chooseGods(['Apollo']);
    expect(enabled()).toEqual(['Apollo', 'Demeter', 'Poseidon']);
    chooseGods(['Poseidon']);
    expect(enabled()).toEqual(['Aphrodite', 'Apollo', 'Demeter', 'Hestia', 'Poseidon']);
    chooseGods(['Hestia']);
    expect(
      ['Apollo', 'Poseidon', 'Hestia'].map(
        (name) => god(name).querySelector('.draft-order-number')?.textContent,
      ),
    ).toEqual(['1', '2', '3']);

    // Removing a prerequisite god is allowed; the broken rule's tag turns active.
    chooseGods(['Poseidon']);
    expect(tags()[1]).toEqual(['Aphrodite/Hestia after Poseidon or Demeter', true]);
    chooseGods(['Apollo']);
    expect(tags()[0]).toEqual(['Run starts with Apollo', true]);
    // Apollo rejoins the pool at its place.
    chooseGods(['Apollo', 'Demeter']);
    expect(god('Apollo').querySelector('.draft-order-number')?.textContent).toBe('1');
    expect(tags().every(([, active]) => active === false)).toBe(true);

    const basketTag = () =>
      within(screen.getByRole('list', { name: 'Basket rules' })).getByRole('listitem');
    expect(basketTag().textContent).toBe("Apollo's first boon must be Attack, Sprint or Magick");
    expect(basketTag().hasAttribute('data-active')).toBe(false);
    const dialog = openBasket();
    expect(
      within(dialog)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual([expect.stringMatching(/^Gods/)]);
    const [cast, sprint] = ['ApolloCastBoon', 'ApolloSprintBoon'].map(
      (key) => catalog.traits.byKey[key]!.label,
    );
    const castRow = within(dialog).getByRole('button', { name: cast! });
    expect(castRow.getAttribute('aria-disabled')).toBe('true');
    expect(hintOf(castRow)).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: sprint! }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(basketTag().hasAttribute('data-active')).toBe(false);
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

  it('allows only a core first boon for pool #1, and marks the tag when a non-core is left first', () => {
    const { catalog } = open();
    chooseGods(['Zeus', 'Apollo', 'Hestia']);
    expect(screen.queryByRole('list', { name: 'God pool rules' })).toBeNull();
    const tag = () =>
      within(screen.getByRole('list', { name: 'Basket rules' })).getByRole('listitem');
    expect(tag().textContent).toBe("First god's first boon must be a core boon");
    expect(tag().hasAttribute('data-active')).toBe(false);
    const label = (key: string) => catalog.traits.byKey[key]!.label;
    const [ring, cast] = ['FocusLightningBoon', 'ZeusCastBoon'].map(label);
    const dialog = openBasket();
    const ringRow = () => within(dialog).getByRole('button', { name: ring! });
    expect(ringRow().getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(within(dialog).getByRole('button', { name: cast! }));
    expect(ringRow().getAttribute('aria-disabled')).toBeNull();
    fireEvent.click(ringRow());
    // Unpicking the core leaves a non-core first: the tag turns active and the draft is blocked.
    fireEvent.click(within(dialog).getByRole('button', { name: cast! }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(tag().hasAttribute('data-active')).toBe(true);
    expect(lineChips('God')).toEqual([expect.objectContaining({ hint: ring, refused: false })]);
    expect(draftButton().getAttribute('aria-disabled')).toBe('true');
  });

  it('orders a god by core slot, then other boons, then its Legendary, then its Duos', () => {
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
    expect(sections).toEqual(['Zeus', 'Apollo']);

    const zeus = within(within(dialog).getByRole('region', { name: 'Zeus' }))
      .getAllByRole('button', { pressed: false })
      .map((button) => button.textContent);
    const trait = (label: string | null) =>
      catalog.traits.values.find((candidate) => candidate.label === label)!;
    const rarity = (label: string | null) => {
      const domain = trait(label).rarityDomain;
      return domain.kind === 'ranked' ? domain.freshOfferRarities : [];
    };
    expect(zeus.slice(0, 5).map((label) => trait(label).equipmentSlot)).toEqual([
      'Melee',
      'Secondary',
      'Ranged',
      'Rush',
      'Mana',
    ]);
    const firstDuo = zeus.findIndex((label) => rarity(label).includes('Duo'));
    expect(firstDuo).toBeGreaterThan(5);
    expect(rarity(zeus[firstDuo - 1]!)).toEqual(['Legendary']);
    expect(zeus.slice(firstDuo).every((label) => rarity(label).includes('Duo'))).toBe(true);

    const shown = within(dialog)
      .getAllByRole('button', { pressed: false })
      .map((button) => button.textContent);
    const ransoms = catalog.traits.values.filter(
      (candidate) => candidate.selectedDisposition.kind === 'ransom',
    );
    expect(ransoms.length).toBeGreaterThan(0);
    for (const ransom of ransoms) expect(shown).not.toContain(ransom.label);
  });

  it('lists a Duo under both its gods, held by the god it is picked under, and hides it without its partner', () => {
    const { catalog } = open();
    const label = (key: string) => catalog.traits.byKey[key]!.label;
    // The Duo needs Apollo's Prominence Flare, which needs a Cast such as Zeus's Storm Ring.
    const [duo, ring, flare] = [
      'ApolloSecondStageCastBoon',
      'ZeusCastBoon',
      'ApolloExCastBoon',
    ].map(label);
    chooseGods(['Zeus']);
    let dialog = openBasket();
    const zeus = () => within(within(dialog).getByRole('region', { name: 'Zeus' }));
    const apollo = () => within(within(dialog).getByRole('region', { name: 'Apollo' }));
    expect(zeus().queryByRole('button', { name: duo! })).toBeNull();
    fireEvent.keyDown(dialog, { key: 'Escape' });

    chooseGods(['Apollo']);
    dialog = openBasket();
    fireEvent.click(zeus().getByRole('button', { name: ring! }));
    fireEvent.click(apollo().getByRole('button', { name: flare! }));
    fireEvent.click(apollo().getByRole('button', { name: duo! }));
    expect(apollo().getByRole('button', { name: duo! }).getAttribute('aria-pressed')).toBe('true');
    expect(
      [flare!, duo!].map(
        (name) =>
          apollo().getByRole('button', { name }).querySelector('.draft-order-number')?.textContent,
      ),
    ).toEqual(['1', '2']);
    const held = zeus().getByRole('button', { name: duo! });
    expect(held.getAttribute('aria-pressed')).toBe('false');
    expect(held.getAttribute('aria-disabled')).toBe('true');
    expect(hintOf(held)).toBe('In Apollo.');
    fireEvent.click(held);
    expect(apollo().getByRole('button', { name: duo! }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    // The Duo sits in Apollo's order on the god line, marked with its other god.
    expect(lineChips('God')).toEqual([
      expect.objectContaining({ hint: ring, order: '1', partner: false }),
      expect.objectContaining({ hint: flare, order: '1', partner: false }),
      expect.objectContaining({ hint: duo, order: '2', partner: true }),
    ]);

    // Unpicking it under Apollo frees it under Zeus.
    dialog = openBasket();
    fireEvent.click(apollo().getByRole('button', { name: duo! }));
    expect(zeus().getByRole('button', { name: duo! }).getAttribute('aria-disabled')).toBeNull();
  });

  it('keeps one trait of a mutually exclusive set, naming the picked one', () => {
    const { catalog } = open();
    const label = (key: string) => catalog.traits.byKey[key]!.label;
    const [core, lance, coal] = ['ZeusCastBoon', 'CastAnywhereBoon', 'CastProjectileBoon'].map(
      label,
    );
    chooseGods(['Zeus', 'Hestia']);
    const dialog = openBasket();
    fireEvent.click(within(dialog).getByRole('button', { name: core! }));
    fireEvent.click(within(dialog).getByRole('button', { name: lance! }));
    const excluded = within(dialog).getByRole('button', { name: coal! });
    expect(excluded.getAttribute('aria-disabled')).toBe('true');
    expect(hintOf(excluded)).toBe(`Excludes ${lance}.`);
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
    expect(lineChips('God')).toEqual([expect.objectContaining({ hint: zeusAttack, order: '1' })]);
  });

  it('shows the basket read-only on the panel, each line opening its tab', () => {
    const { catalog } = open();
    chooseGods(['Zeus']);
    fireEvent.click(
      screen.getByRole('button', {
        name: `Artemis in ${catalog.biomes.byKey.F!.label}`,
      }),
    );
    const label = (key: string) => catalog.traits.byKey[key]!.label;
    const artemis = catalog.traitGivers.byKey.Artemis!;
    let dialog = openBasket();
    fireEvent.click(within(dialog).getByRole('button', { name: label('ZeusWeaponBoon') }));
    fireEvent.click(within(dialog).getByRole('tab', { name: /^Bonus/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: label('HermesWeaponBoon') }));
    fireEvent.click(within(dialog).getByRole('tab', { name: /^NPCs/ }));
    const npcTrait = label(artemis.traitKeys[0]!);
    fireEvent.click(within(dialog).getByRole('button', { name: npcTrait }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));

    expect(basketLine('God')?.getAttribute('aria-label')).toBe(
      `God traits: ${label('ZeusWeaponBoon')}`,
    );
    expect(lineChips('Bonus')).toEqual([
      expect.objectContaining({ hint: label('HermesWeaponBoon'), order: '1' }),
    ]);
    // An NPC's single trait has no order.
    expect(lineChips('NPC')).toEqual([
      expect.objectContaining({ hint: npcTrait, order: undefined }),
    ]);
    expect(within(basketLine('God')!).queryByRole('button')).toBeNull();

    const selectedTab = () =>
      within(screen.getByRole('dialog')).getByRole('tab', { selected: true }).textContent;
    for (const [row, tab] of [
      ['Bonus', /^Bonus/],
      ['NPC', /^NPCs/],
      ['God', /^Gods/],
    ] as const) {
      fireEvent.click(basketLine(row)!);
      expect(selectedTab()).toMatch(tab);
      dialog = screen.getByRole('dialog');
      fireEvent.keyDown(dialog, { key: 'Escape' });
    }
  });

  it("offers Athena's traits while the Gorgon Amulet is the starting keepsake", () => {
    const { application, catalog } = open('Surface');
    chooseGods(['Zeus']);
    const athena = catalog.traitGivers.byKey.Athena!;
    const athenaSection = () => {
      const dialog = openBasket();
      fireEvent.click(within(dialog).getByRole('tab', { name: /^NPCs/ }));
      const section = within(dialog).queryByRole('region', { name: athena.label });
      return { dialog, section };
    };
    const before = athenaSection();
    expect(before.section).toBeNull();
    fireEvent.keyDown(before.dialog, { key: 'Escape' });

    act(() => {
      application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceStartingKeepsake',
          selection: createRouteStartKeepsakeSelectionAddress('Surface'),
          keepsakeKey: 'AthenaEncounterKeepsake',
        }),
      );
    });
    const section = athenaSection().section;
    const dash = catalog.traits.byKey.InvulnerabilityDashBoon!.label;
    fireEvent.click(within(section!).getByRole('button', { name: dash }));
    expect(within(section!).getByRole('button', { name: dash }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it("numbers each giver's picks in pick order, notes an order the engine refuses, and clears a giver", () => {
    const { catalog } = open();
    chooseGods(['Zeus', 'Apollo']);
    const label = (key: string) => catalog.traits.byKey[key]!.label;
    const [cast, strike, rush] = ['ZeusCastBoon', 'DoubleBoltBoon', 'ZeusSprintBoon'].map(label);
    const dialog = openBasket();
    for (const name of [cast!, strike!, rush!])
      fireEvent.click(within(dialog).getByRole('button', { name }));
    expect([cast!, strike!, rush!].map((name) => orderBadge(dialog, name))).toEqual([
      '1',
      '2',
      '3',
    ]);
    // Hermes takes its traits in pick order too; Selene's single trait has no number.
    fireEvent.click(within(dialog).getByRole('tab', { name: /^Bonus/ }));
    const [first, second] = ['HermesWeaponBoon', 'HermesSpecialBoon'].map(label);
    const selene = label(catalog.traitGivers.byKey.SpellDrop!.traitKeys[0]!);
    for (const name of [second!, first!, selene])
      fireEvent.click(within(dialog).getByRole('button', { name }));
    expect([second!, first!, selene].map((name) => orderBadge(dialog, name))).toEqual([
      '1',
      '2',
      undefined,
    ]);
    const hermes = within(dialog).getByRole('region', { name: 'Hermes' });
    fireEvent.click(within(hermes).getByRole('button', { name: 'Clear Hermes picks' }));
    expect(
      [first!, second!].map((name) =>
        within(dialog).getByRole('button', { name }).getAttribute('aria-pressed'),
      ),
    ).toEqual(['false', 'false']);
    expect(
      (within(hermes).getByRole('button', { name: 'Clear Hermes picks' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(within(dialog).getByRole('button', { name: selene }).getAttribute('aria-pressed')).toBe(
      'true',
    );

    // Unpicking Storm Ring leaves Double Strike first: refused, with a visible note.
    fireEvent.click(within(dialog).getByRole('tab', { name: /^Gods/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: cast! }));
    const note = `${strike} needs ${rush} first.`;
    expect(within(dialog).getByText(note)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(screen.getByText(note)).toBeTruthy();
    expect(lineChips('God').map((chip) => [chip.hint, chip.refused])).toEqual([
      [strike, true],
      [rush, false],
    ]);

    const zeus = within(openBasket()).getByRole('region', { name: 'Zeus' });
    fireEvent.click(within(zeus).getByRole('button', { name: 'Clear Zeus picks' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Done' }));
    expect(basketLine('God')).toBeNull();
    expect(screen.queryByText(note)).toBeNull();
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
    // The racks sit in the Run section, one per planned biome.
    const racks = within(
      within(screen.getByRole('region', { name: 'Run' })).getByRole('group', {
        name: 'Rack keepsakes',
      }),
    );
    expect(racks.queryByRole('button', { name: `After ${label('G')}` })).toBeTruthy();
    expect(racks.queryByRole('button', { name: `After ${label('H')}` })).toBeNull();
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
    fireEvent.click(screen.getByRole('checkbox', { name: 'Pursue the Tartarus goal' }));
    expect(draft().pursueTartarusGoal).toBe(true);
    // Tartarus's default 4 is above what it yields with the goal pursued.
    expect(screen.getByText('expected 3')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Pursue the Tartarus goal' }));
    expect(draft()).not.toHaveProperty('pursueTartarusGoal');
  });

  it('sets the room and search options, naming a default only when changed, and resets them as one edit', () => {
    const { application } = open();
    const history = () => application.store.getState().projectWorkspace.history!;
    const draft = () => history().present.route.draft;
    fireEvent.click(screen.getByRole('tab', { name: 'Advanced' }));
    const reset = screen.getByRole('button', { name: 'Reset to defaults' }) as HTMLButtonElement;
    expect(reset.disabled).toBe(true);
    expect(screen.queryByText(/^default /)).toBeNull();
    // Notes are fixed pills; the Retries note stays whatever its value.
    expect(screen.getByText('More retries: better coverage, longer drafts').className).toBe(
      'draft-hint-pill',
    );

    const forcing = screen.getByRole('radiogroup', { name: 'Room forcing' });
    expect(
      (within(forcing).getByRole('radio', { name: 'Softened' }) as HTMLInputElement).checked,
    ).toBe(true);
    expect(hintOf(within(forcing).getByText('Game odds'))).toBe('1 / (Max − depth)');
    fireEvent.click(within(forcing).getByRole('radio', { name: 'Game odds' }));
    expect(draft().roomForcing).toBe('game');
    fireEvent.change(screen.getByRole('slider', { name: 'Resource rooms' }), {
      target: { value: '25' },
    });
    expect(draft().resourceRoomChance).toBe(25);
    expect(screen.getByText('default 10%')).toBeTruthy();
    fireEvent.change(screen.getByRole('slider', { name: 'Shop buys per biome' }), {
      target: { value: '0' },
    });
    expect(draft().purchasesPerBiome).toBe(0);
    fireEvent.change(screen.getByRole('slider', { name: 'Retries' }), { target: { value: '6' } });
    expect(draft().retriesPerBiome).toBe(6);
    expect(screen.getByText('default 3')).toBeTruthy();
    fireEvent.change(screen.getByRole('slider', { name: 'Retries' }), { target: { value: '3' } });
    expect(draft()).not.toHaveProperty('retriesPerBiome');
    expect(screen.queryByText('default 3')).toBeNull();

    const before = history().past.length;
    expect(reset.disabled).toBe(false);
    fireEvent.click(reset);
    expect(history().past).toHaveLength(before + 1);
    for (const key of ['roomForcing', 'resourceRoomChance', 'purchasesPerBiome'])
      expect(draft()).not.toHaveProperty(key);
    expect(reset.disabled).toBe(true);
    act(() => {
      application.store.dispatch(authoredProjectUndoRequested());
    });
    expect(draft()).toMatchObject({
      roomForcing: 'game',
      resourceRoomChance: 25,
      purchasesPerBiome: 0,
    });
  });

  it('ranks filler kinds in pick order with per-run amounts, and drafts with them', () => {
    const { application, runs } = open();
    const draft = () => application.store.getState().projectWorkspace.history!.present.route.draft;
    chooseGods(['Zeus', 'Apollo', 'Hera']);
    fireEvent.click(screen.getByRole('tab', { name: 'Advanced' }));
    const filler = () => within(screen.getByRole('group', { name: 'Filler' }));
    const chip = (name: string) => filler().getByRole('button', { name });
    const rank = (name: string) => chip(name).querySelector('.draft-order-number')?.textContent;
    const amount = (name: string) =>
      filler().queryByRole('combobox', { name: `${name} per run` }) as HTMLSelectElement | null;
    const reset = () => filler().getByRole('button', { name: 'Reset filler order' });

    expect((reset() as HTMLButtonElement).disabled).toBe(true);
    expect(amount('Pom')).toBeNull();
    for (const name of ['Pom', 'Max Health', 'Gold']) fireEvent.click(chip(name));
    expect(['Pom', 'Max Health', 'Gold', 'Max Magick'].map(rank)).toEqual([
      '1',
      '2',
      '3',
      undefined,
    ]);
    expect(draft().fillerPriority).toEqual([
      { kind: 'pom' },
      { kind: 'maxHealth' },
      { kind: 'gold' },
    ]);

    // An amount keeps the order; "any" stores none.
    expect(amount('Max Health')!.value).toBe('');
    fireEvent.change(amount('Max Health')!, { target: { value: '3' } });
    expect(draft().fillerPriority).toEqual([
      { kind: 'pom' },
      { kind: 'maxHealth', amount: 3 },
      { kind: 'gold' },
    ]);
    expect(amount('Max Health')!.value).toBe('3');
    fireEvent.change(amount('Max Health')!, { target: { value: '' } });
    expect(draft().fillerPriority?.[1]).toEqual({ kind: 'maxHealth' });

    // Unpicking closes the gap.
    fireEvent.click(chip('Pom'));
    expect(['Max Health', 'Gold', 'Pom'].map(rank)).toEqual(['1', '2', undefined]);
    expect(amount('Pom')).toBeNull();

    fireEvent.change(amount('Gold')!, { target: { value: '2' } });
    fireEvent.click(draftButton());
    expect(runs.at(-1)!.request.spec.fillerPriority).toEqual([
      { kind: 'maxHealth' },
      { kind: 'gold', amount: 2 },
    ]);
    act(() => runs.at(-1)!.emit({ kind: 'error', message: 'stopped' }));

    fireEvent.click(reset());
    expect(draft()).not.toHaveProperty('fillerPriority');
    expect(['Max Health', 'Gold'].map(rank)).toEqual([undefined, undefined]);
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
    expect(draftButton().getAttribute('aria-disabled')).toBe('true');
    expect(hintOf(draftButton())).toBe('Choose a god.');
    chooseGods(['Zeus', 'Apollo', 'Hera']);
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
