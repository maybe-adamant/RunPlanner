// @vitest-environment jsdom

import { cleanup, screen, waitFor, within } from '@testing-library/react';
import {
  createDefaultAuthoredHexTree,
  createProjectDocument,
  createRouteAddress,
} from '@run-planner/engine/authored-project';
import { afterEach, describe, expect, it } from 'vitest';

import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { createApplication } from '@planner/composition/createApplication';
import { newProjectCreated } from '@planner/state/profileSessionSlice';
import { renderPlannerForInteraction } from '@planner-test/fixtures/renderPlanner';

/** A configured biome lets the route-start tree findings reach the assessment. */
function seleneApplication() {
  const application = createApplication();
  application.store.dispatch(
    newProjectCreated(
      createProjectDocument(application.catalog, {
        projectId: 'run-plan',
        routeKey: 'Underworld',
        configuredBiomeCount: 1,
      }),
    ),
  );
  application.store.dispatch(
    authoredProjectCommandDispatched({
      kind: 'ReplaceRouteLoadout',
      route: createRouteAddress('Underworld'),
      weaponKey: 'WeaponSuit',
      aspectKey: 'SuitHexAspect',
    }),
  );
  return application;
}

afterEach(cleanup);

describe('Hex tree board', () => {
  it('edits the Aspect tree as a draft that Save commits as one history step', async () => {
    const { application, user } = renderPlannerForInteraction({ application: seleneApplication() });
    const history = () => application.store.getState().projectWorkspace.history!;
    const tree = () => history().present.route.loadout.aspectHexTree!;
    const hex = application.catalog.hexes.byKey['SpellMoonBeamTrait']!;
    const label = (key: string) =>
      (hex.rareCandidates.byKey[key] ?? hex.repeatableCandidates.byKey[key])!.label;
    const lung = createDefaultAuthoredHexTree(application.catalog, 'SpellMoonBeamTrait');
    const launcher = () => screen.getByRole('button', { name: 'Edit Sky Fall Hex tree' });
    const dialog = () => screen.getByRole('dialog', { name: 'Sky Fall Hex tree' });
    const board = () => within(dialog()).getByRole('group', { name: /Hex tree$/ });
    const node = (name: string) => within(board()).getByRole('button', { name });
    const feedback = () => within(dialog()).getByRole('status', { name: 'Hex tree feedback' });
    const before = history().past.length;

    await user.click(launcher());
    // Sixteen authored nodes; the God Sent pair is shown but not authored.
    expect(within(board()).getAllByRole('button')).toHaveLength(16);
    expect(within(board()).getAllByRole('note')).toHaveLength(2);
    expect(within(dialog()).queryByRole('button', { name: 'Rebalance' })).toBeNull();

    // A Rare picker marks the talent on the other Rare node; choosing it keeps the repeat.
    const rare2 = label(lung.nodes['4:5']!);
    await user.click(node(`Rare ${label(lung.nodes['4:1']!)}, depth 4`));
    const held = within(screen.getByRole('listbox')).getByRole('option', {
      name: new RegExp(`^${rare2}`),
    });
    expect(held.textContent).toContain('On another Rare node');
    await user.click(held);
    expect(history().past).toHaveLength(before);
    expect(feedback().textContent).toContain(
      `${rare2} appears on two Rare nodes; each Rare and Epic talent appears once.`,
    );
    expect(node(`Rare ${rare2}, depth 4, first`).dataset.hasFindings).toBe('true');
    expect(node(`Rare ${rare2}, depth 4, second`).dataset.hasFindings).toBe('true');
    expect(node(`Common ${label(lung.nodes['1:2']!)}, depth 1`).dataset.hasFindings).toBe('false');

    // A Common node swaps in its column or trades with its deck; nodes are coloured by column.
    const common = node(`Common ${label(lung.nodes['1:4']!)}, depth 1`);
    await user.click(common);
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getByText('Swap in this column')).toBeTruthy();
    expect(within(listbox).getByText('Trade with another column')).toBeTruthy();
    expect(node(`Common ${label(lung.nodes['1:2']!)}, depth 1`).dataset.commonColumn).toBe('0');
    expect(node(`Common ${label(lung.nodes['2:2']!)}, depth 2`).dataset.commonColumn).toBe('1');
    const swap = within(listbox).getByRole('option', {
      name: new RegExp(`^${label(lung.nodes['1:2']!)}`),
    });
    await user.click(swap);
    expect(history().past).toHaveLength(before);

    await user.click(within(dialog()).getByRole('button', { name: 'Save' }));
    expect(history().past).toHaveLength(before + 1);
    expect(tree().nodes).toEqual({
      ...lung.nodes,
      '4:1': lung.nodes['4:5'],
      '1:2': lung.nodes['1:4'],
      '1:4': lung.nodes['1:2'],
    });
    // The saved conflict is the tree's finding; the Loadout launcher carries its mark.
    await waitFor(() => expect(launcher().dataset.hasFindings).toBe('true'));

    // The saved tree names its conflict by talent; Cancel discards a draft.
    await user.click(launcher());
    expect(feedback().textContent).toContain(`${rare2} appears on two Rare nodes`);
    await user.click(within(dialog()).getByRole('button', { name: 'Reset to default' }));
    await user.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    expect(history().past).toHaveLength(before + 1);

    // Choosing the current layout keeps the edits; another layout regenerates its default.
    await user.click(launcher());
    await user.click(within(dialog()).getByRole('button', { name: 'Hex talent layout' }));
    await user.click(screen.getByRole('option', { name: 'Lung' }));
    expect(node(`Rare ${rare2}, depth 4, first`)).toBeTruthy();
    await user.click(within(dialog()).getByRole('button', { name: 'Hex talent layout' }));
    await user.click(screen.getByRole('option', { name: 'Nacelle' }));
    expect(within(board()).getAllByRole('button')).toHaveLength(18);
    await user.click(within(dialog()).getByRole('button', { name: 'Save' }));
    expect(history().past).toHaveLength(before + 2);
    expect(tree()).toEqual(
      createDefaultAuthoredHexTree(application.catalog, 'SpellMoonBeamTrait', 'Nacelle'),
    );
    await waitFor(() => expect(launcher().dataset.hasFindings).toBe('false'));
  });

  it('opens each node picker at the node by keyboard and returns focus on Escape', async () => {
    const { application, user } = renderPlannerForInteraction({ application: seleneApplication() });
    const lung = createDefaultAuthoredHexTree(application.catalog, 'SpellMoonBeamTrait');
    const hex = application.catalog.hexes.byKey['SpellMoonBeamTrait']!;
    const omen = hex.repeatableCandidates.byKey[lung.nodes['1:4']!]!.label;
    await user.click(screen.getByRole('button', { name: 'Edit Sky Fall Hex tree' }));
    const dialog = screen.getByRole('dialog', { name: 'Sky Fall Hex tree' });
    const board = within(dialog).getByRole('group', { name: /Hex tree$/ });
    const node = within(board).getByRole('button', { name: `Common ${omen}, depth 1` });
    node.focus();
    await user.keyboard('{Enter}');
    const listbox = await screen.findByRole('listbox');
    // The popover is headed by the node's kind and talent; a short list has no search box.
    const popover = screen.getByRole('dialog', { name: `Common · ${omen}` });
    expect(within(listbox).getByText('Swap in this column')).toBeTruthy();
    expect(within(popover).queryByRole('combobox')).toBeNull();
    expect(popover.contains(document.activeElement)).toBe(true);
    expect(node.dataset.editing).toBe('true');
    // The highlighted swap option marks its partner; the node's own talent marks none.
    const growth = hex.repeatableCandidates.byKey[lung.nodes['1:2']!]!.label;
    const partner = within(board).getByRole('button', { name: `Common ${growth}, depth 1` });
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(partner.dataset.involved).toBe(undefined));
    await user.keyboard('{ArrowUp}');
    await waitFor(() => expect(partner.dataset.involved).toBe('true'));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect(document.activeElement).toBe(node);
    expect(node.dataset.editing).toBe(undefined);
    // God Sent nodes are fixed but reachable for their hint.
    const godSent = within(board).getAllByRole('note');
    godSent[0]!.focus();
    expect(document.activeElement).toBe(godSent[0]);
    expect(godSent[0]!.getAttribute('aria-description')).toContain(
      'appears once God Sent is eligible',
    );
  });

  it('opens each node picker from its talent in the decks table too', async () => {
    const { application, user } = renderPlannerForInteraction({ application: seleneApplication() });
    const lung = createDefaultAuthoredHexTree(application.catalog, 'SpellMoonBeamTrait');
    const hex = application.catalog.hexes.byKey['SpellMoonBeamTrait']!;
    const label = (key: string) => hex.repeatableCandidates.byKey[key]!.label;
    const omen = label(lung.nodes['1:4']!);
    const damage = label(lung.nodes['2:2']!);
    await user.click(screen.getByRole('button', { name: 'Edit Sky Fall Hex tree' }));
    const dialog = screen.getByRole('dialog', { name: 'Sky Fall Hex tree' });
    const board = within(dialog).getByRole('group', { name: /Hex tree$/ });
    const table = within(dialog).getByRole('table', { name: 'Common decks' });
    // The table's columns are the Common columns, coloured like their nodes.
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => [cell.textContent, cell.dataset.commonColumn]),
    ).toEqual([
      ['Column 1', '0'],
      ['Column 2', '1'],
      ['Column 3', '2'],
      ['Column 4', '3'],
      ['Column 5', '4'],
    ]);
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Deck 1', 'Deck 2', 'Deck 3', 'Deck 4']);
    // Every talent opens its node's picker; a single-column deck's has no trades.
    await user.click(within(table).getAllByRole('button', { name: /^Deck 2, column 3:/ })[0]!);
    expect(
      within(await screen.findByRole('listbox')).queryByText('Trade with another column'),
    ).toBeNull();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());

    const chip = within(table).getByRole('button', { name: `Deck 1, column 1: ${omen}` });
    const own = within(board).getByRole('button', { name: `Common ${omen}, depth 1` });
    const target = within(board).getByRole('button', { name: `Common ${damage}, depth 2` });
    await user.hover(chip);
    expect(own.dataset.involved).toBe('true');
    await user.click(chip);
    // The same picker as the board node's, which is marked as being edited.
    const listbox = await screen.findByRole('listbox');
    expect(screen.getByRole('dialog', { name: `Common · ${omen}` })).toBeTruthy();
    expect(within(listbox).getByText('Swap in this column')).toBeTruthy();
    expect(own.dataset.editing).toBe('true');
    const option = within(listbox).getByRole('option', {
      name: new RegExp(`^${damage} — column 2`),
    });
    await user.hover(option);
    await waitFor(() => expect(target.dataset.involved).toBe('true'));
    await user.click(option);
    const boardNow = () => within(dialog).getByRole('group', { name: /Hex tree$/ });
    expect(
      await within(boardNow()).findByRole('button', { name: `Common ${damage}, depth 1` }),
    ).toBeTruthy();
    expect(
      within(boardNow()).getByRole('button', { name: `Common ${omen}, depth 2` }),
    ).toBeTruthy();
    expect(
      within(within(dialog).getByRole('table', { name: 'Common decks' })).getByRole('button', {
        name: `Deck 1, column 2: ${omen}`,
      }),
    ).toBeTruthy();
    // The trade keeps the tree legal.
    expect(within(dialog).getByRole('status', { name: 'Hex tree feedback' }).textContent).toContain(
      'No current findings.',
    );
  });

  it('explains common nodes from the dialog header', async () => {
    const { user } = renderPlannerForInteraction({ application: seleneApplication() });
    await user.click(screen.getByRole('button', { name: 'Edit Sky Fall Hex tree' }));
    const dialog = screen.getByRole('dialog', { name: 'Sky Fall Hex tree' });
    await user.click(within(dialog).getByRole('button', { name: 'How common nodes work' }));
    const help = await screen.findByRole('dialog', { name: 'How common nodes work' });
    expect(help.textContent).toContain('fill in order');
    expect(help.textContent).toContain('a column that empties a deck draws from the next one');
    expect(help.textContent).toContain('Rare and Epic nodes pick from their pool');
    expect(help.textContent).toContain('swap for an unused talent');
  });
});
