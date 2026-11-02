// @vitest-environment jsdom

import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import {
  authoredHexColumns,
  createDefaultAuthoredHexTree,
  createProjectDocument,
  createRouteAddress,
} from '@run-planner/engine/authored-project';
import { afterEach, describe, expect, it } from 'vitest';

import {
  authoredProjectCommandDispatched,
  authoredProjectUndoRequested,
  authoredProjectReplaced,
} from '@planner/state/projectWorkspaceSlice';
import { routePanelSelected } from '@planner/state/editorSessionSlice';
import { createApplication } from '@planner/composition/createApplication';
import { renderPlannerForInteraction } from '@planner-test/fixtures/renderPlanner';
import { dialogFinding } from '@planner-test/support/editor-dialog';

/** A configured biome lets the route-start tree findings reach the assessment. */
function seleneApplication() {
  const application = createApplication();
  application.store.dispatch(
    authoredProjectReplaced(
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
  application.store.dispatch(
    routePanelSelected({ routeKey: 'Underworld', panel: { kind: 'loadout' } }),
  );
  return application;
}

afterEach(cleanup);

describe('Hex tree board', () => {
  it('edits Rare nodes and the layout as a draft that Save commits as one history step', async () => {
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
    const save = () => within(dialog()).getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    const layout = () => within(dialog()).getByRole('button', { name: 'Hex talent layout' });
    const before = history().past.length;

    await user.click(launcher());
    expect(save().disabled).toBe(true);
    // Sixteen authored nodes; the God Sent pair is shown but not authored.
    expect(within(board()).getAllByRole('button')).toHaveLength(16);
    expect(within(board()).getAllByRole('note')).toHaveLength(2);
    // The layout continues the title rather than the dialog's name, and takes initial focus.
    expect(dialog().querySelector('header')!.contains(layout())).toBe(true);
    expect(document.activeElement).toBe(layout());

    // A Rare picker marks the talent on the other Rare node; choosing it draws a conflict that blocks Save.
    const rare2 = label(lung.nodes['4:5']!);
    await user.click(node(`Rare ${label(lung.nodes['4:1']!)}, depth 4`));
    const held = within(screen.getByRole('listbox')).getByRole('option', {
      name: new RegExp(`^${rare2}`),
    });
    expect(held.textContent).toContain('On another Rare node');
    await user.click(held);
    expect(dialogFinding(dialog())).toBe(`${rare2} on two Rare nodes`);
    expect(save().disabled).toBe(true);
    expect(node(`Rare ${rare2}, depth 4, first`).dataset.hasFindings).toBe('true');
    expect(node(`Rare ${rare2}, depth 4, second`).dataset.hasFindings).toBe('true');
    expect(node(`Common ${label(lung.nodes['1:2']!)}, depth 1`).dataset.hasFindings).toBe('false');
    await user.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    expect(history().past).toHaveLength(before);

    // A saved conflict marks the launcher and is inherited, so it never blocks Save.
    const conflicted = { ...lung, nodes: { ...lung.nodes, '4:1': lung.nodes['4:5']! } };
    act(() => {
      application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceAspectHexTree',
          route: createRouteAddress('Underworld'),
          value: conflicted,
        }),
      );
    });
    await waitFor(() => expect(launcher().dataset.hasFindings).toBe('true'));
    await user.click(launcher());
    expect(dialogFinding(dialog())).toBe(`${rare2} on two Rare nodes`);

    // Cancel discards a draft.
    await user.click(within(dialog()).getByRole('button', { name: 'Reset' }));
    await user.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    expect(history().past).toHaveLength(before + 1);

    // Choosing the current layout keeps the edits; another layout regenerates its default.
    await user.click(launcher());
    await user.click(layout());
    await user.click(screen.getByRole('option', { name: 'Lung' }));
    expect(node(`Rare ${rare2}, depth 4, first`)).toBeTruthy();
    expect(save().disabled).toBe(true);
    await user.click(layout());
    await user.click(screen.getByRole('option', { name: 'Nacelle' }));
    expect(within(board()).getAllByRole('button')).toHaveLength(18);
    await user.click(save());
    expect(history().past).toHaveLength(before + 2);
    expect(tree()).toEqual(
      createDefaultAuthoredHexTree(application.catalog, 'SpellMoonBeamTrait', 'Nacelle'),
    );
    await waitFor(() => expect(launcher().dataset.hasFindings).toBe('false'));
  });

  it('deals a Common column card by card into the draft that Save commits and one Undo restores', async () => {
    const { application, user } = renderPlannerForInteraction({ application: seleneApplication() });
    const history = () => application.store.getState().projectWorkspace.history!;
    const tree = () => history().present.route.loadout.aspectHexTree;
    const hex = application.catalog.hexes.byKey['SpellMoonBeamTrait']!;
    const label = (key: string) => hex.repeatableCandidates.byKey[key]!.label;
    const lung = createDefaultAuthoredHexTree(application.catalog, 'SpellMoonBeamTrait');
    const [first] = authoredHexColumns(application.catalog, 'SpellMoonBeamTrait', lung);
    const [top, bottom] = first!.slots;
    await user.click(screen.getByRole('button', { name: 'Edit Sky Fall Hex tree' }));
    const dialog = screen.getByRole('dialog', { name: 'Sky Fall Hex tree' });
    const nextCards = () => within(dialog).getByRole('group', { name: /^Next card for Column/ });
    const row = () => within(dialog).getByRole('rowheader', { name: 'Column 1' }).closest('tr')!;
    const slots = () =>
      Array.from(row().querySelectorAll<HTMLElement>('[data-node-key]')).map(
        (chip) => chip.textContent,
      );
    const save = () => within(dialog).getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    const before = history().past.length;
    const saved = tree();
    expect(slots()).toEqual([label(top!.talentKey), label(bottom!.talentKey)]);

    // The column is dealt top slot first, from the cards its deck has left.
    await user.click(within(dialog).getByRole('button', { name: 'Deal Column 1' }));
    await user.click(
      within(nextCards()).getByRole('button', {
        name: label(bottom!.talentKey),
      }),
    );
    expect(slots()).toEqual([label(bottom!.talentKey), '']);
    // The map follows the deal: the column's nodes, and the slot the next card fills.
    const nodeOf = (nodeKey: string) =>
      dialog.querySelector<HTMLElement>(`.hex-tree-node[id$="-${nodeKey}"]`)!;
    expect(nodeOf(top!.nodeKey).dataset.dealing).toBe('true');
    expect(nodeOf(top!.nodeKey).dataset.nextCard).toBeUndefined();
    const elsewhere = authoredHexColumns(application.catalog, 'SpellMoonBeamTrait', lung)[1]!;
    expect(nodeOf(elsewhere.slots[0]!.nodeKey).dataset.dealing).toBe('false');
    // The deal's options sit in the row itself, with its progress.
    expect(nextCards().closest('tr')).toBe(row());
    expect(row().textContent).toContain('Dealt 1 of 2');
    expect(nodeOf(bottom!.nodeKey).dataset.nextCard).toBe('true');
    // The dealt card leaves the deck the row offers.
    expect(nextCards().textContent).not.toContain(label(bottom!.talentKey));
    expect(save().disabled).toBe(true);
    await user.click(within(nextCards()).getByRole('button', { name: label(top!.talentKey) }));
    expect(within(dialog).queryByRole('group', { name: /^Next card/ })).toBeNull();
    expect(slots()).toEqual([label(bottom!.talentKey), label(top!.talentKey)]);
    expect(history().past).toHaveLength(before);
    expect(save().disabled).toBe(false);
    await user.click(save());
    expect(history().past).toHaveLength(before + 1);
    expect(tree()?.nodes).toMatchObject({
      [top!.nodeKey]: bottom!.talentKey,
      [bottom!.nodeKey]: top!.talentKey,
    });
    act(() => {
      application.store.dispatch(authoredProjectUndoRequested());
    });
    expect(tree()).toEqual(saved);
  });

  it('keeps the column as it was when a deal is cancelled mid-way', async () => {
    const { application, user } = renderPlannerForInteraction({ application: seleneApplication() });
    const hex = application.catalog.hexes.byKey['SpellMoonBeamTrait']!;
    const label = (key: string) => hex.repeatableCandidates.byKey[key]!.label;
    const lung = createDefaultAuthoredHexTree(application.catalog, 'SpellMoonBeamTrait');
    const [first] = authoredHexColumns(application.catalog, 'SpellMoonBeamTrait', lung);
    await user.click(screen.getByRole('button', { name: 'Edit Sky Fall Hex tree' }));
    const dialog = screen.getByRole('dialog', { name: 'Sky Fall Hex tree' });
    const nextCards = () => within(dialog).getByRole('group', { name: /^Next card for Column/ });
    const row = () => within(dialog).getByRole('rowheader', { name: 'Column 1' }).closest('tr')!;
    const slots = () =>
      Array.from(row().querySelectorAll<HTMLElement>('[data-node-key]')).map(
        (chip) => chip.textContent,
      );
    const deal = within(dialog).getByRole('button', { name: 'Deal Column 1' });
    await user.click(deal);
    await user.click(
      within(nextCards()).getByRole('button', {
        name: label(first!.slots[1]!.talentKey),
      }),
    );
    await user.keyboard('{Escape}');
    expect(within(dialog).queryByRole('group', { name: /^Next card/ })).toBeNull();
    expect(document.activeElement).toBe(
      within(dialog).getByRole('button', { name: 'Deal Column 1' }),
    );
    expect(screen.getByRole('dialog', { name: 'Sky Fall Hex tree' })).toBe(dialog);
    expect(slots()).toEqual(first!.slots.map((slot) => label(slot.talentKey)));
    expect(
      (within(dialog).getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('marks the first column its deck cannot deal; later columns wait on it', async () => {
    const { application, user } = renderPlannerForInteraction({ application: seleneApplication() });
    const hex = application.catalog.hexes.byKey['SpellMoonBeamTrait']!;
    const label = (key: string) => hex.repeatableCandidates.byKey[key]!.label;
    const lung = createDefaultAuthoredHexTree(application.catalog, 'SpellMoonBeamTrait');
    const [, second] = authoredHexColumns(application.catalog, 'SpellMoonBeamTrait', lung);
    await user.click(screen.getByRole('button', { name: 'Edit Sky Fall Hex tree' }));
    const dialog = screen.getByRole('dialog', { name: 'Sky Fall Hex tree' });
    const nextCards = () => within(dialog).getByRole('group', { name: /^Next card for Column/ });
    const deal = (column: number) =>
      within(dialog).getByRole('button', { name: `Deal Column ${column}` }) as HTMLButtonElement;
    expect(deal(2).dataset.hasFindings).toBeUndefined();
    // Column 1 takes the cards Column 2 holds, so Column 2 is no longer a deal.
    await user.click(deal(1));
    for (const slot of second!.slots)
      await user.click(within(nextCards()).getByRole('button', { name: label(slot.talentKey) }));
    expect(dialogFinding(dialog)).toBe("Column 2 can't be dealt");
    expect(deal(1).dataset.hasFindings).toBeUndefined();
    expect(deal(2).dataset.hasFindings).toBe('true');
    expect(deal(2).disabled).toBe(false);
    for (const column of [3, 4, 5]) {
      expect(deal(column).disabled).toBe(true);
      expect(deal(column).getAttribute('aria-description')).toBe('Waits on an earlier choice.');
    }
  });

  it('links Common nodes on the map to their column rows', async () => {
    const { application, user } = renderPlannerForInteraction({ application: seleneApplication() });
    const hex = application.catalog.hexes.byKey['SpellMoonBeamTrait']!;
    const lung = createDefaultAuthoredHexTree(application.catalog, 'SpellMoonBeamTrait');
    const [, second] = authoredHexColumns(application.catalog, 'SpellMoonBeamTrait', lung);
    const slot = second!.slots[0]!;
    await user.click(screen.getByRole('button', { name: 'Edit Sky Fall Hex tree' }));
    const dialog = screen.getByRole('dialog', { name: 'Sky Fall Hex tree' });
    const board = within(dialog).getByRole('group', { name: /Hex tree$/ });
    const node = board.querySelector<HTMLButtonElement>(`button[id$="-${slot.nodeKey}"]`)!;
    expect(node.getAttribute('aria-label')).toMatch(
      new RegExp(`^Common ${hex.repeatableCandidates.byKey[slot.talentKey]!.label}, depth 2`),
    );
    // A Common node opens no picker; it takes the user to its column's deal.
    await user.click(node);
    expect(within(dialog).queryByRole('group', { name: /^Next card/ })).toBeNull();
    expect(document.activeElement).toBe(
      within(dialog).getByRole('button', { name: 'Deal Column 2' }),
    );
    const chip = dialog.querySelector<HTMLElement>(`[data-node-key="${slot.nodeKey}"]`)!;
    await user.hover(chip);
    expect(node.dataset.involved).toBe('true');
    await user.unhover(chip);
    await user.hover(node);
    expect(chip.dataset.involved).toBe('true');
    // Help opens from the title line.
    await user.click(within(dialog).getByRole('button', { name: 'Hex tree help' }));
    expect(await screen.findByRole('dialog', { name: 'Hex tree help' })).toBeTruthy();
  });
});
