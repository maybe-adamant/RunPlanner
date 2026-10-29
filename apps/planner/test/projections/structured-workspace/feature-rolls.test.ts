import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomFeatureAddress,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { loadUnderworldFStygianWellCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import {
  projectStructuredWorkspaceFixture,
  requireWorkspaceBiome,
} from '@planner-test/fixtures/structuredWorkspace';
import type { WorkspaceRoomFeature } from '@planner/projections/structured-workspace';

const f = createBiomeAddress('Underworld', 'F');
const postbossId = createOccurrenceId('golden-f-preboss-shop:postboss');
const room = createOccurrenceAddress(f, postbossId);
type Projected = ReturnType<typeof projectStructuredWorkspaceFixture>;

function withArcana(project: ProjectDocument, arcanaKeys: readonly string[]): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceManualArcanaSelection',
    route: { kind: 'route', routeKey: project.route.routeKey },
    arcanaKeys,
  });
}

/** The F Boss Judgment draw; by default it holds the screen-reroll card. */
function withScreenRerolls(
  project: ProjectDocument,
  arcanaKeys: readonly string[] = [
    'ScreenReroll',
    'StartingGold',
    'HealthRegen',
    'BonusDodge',
    'TradeOff',
  ],
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceJudgmentArcana',
    judgment: {
      kind: 'judgmentArcana',
      routeKey: 'Underworld',
      biomeKey: 'F',
      occurrenceId: createOccurrenceId('golden-f-preboss-shop:boss'),
      phaseKey: 'Encounter',
    },
    arcanaKeys,
  });
}

function postboss(projected: Projected) {
  for (const node of requireWorkspaceBiome(projected.workspace, 'F').nodes)
    if (node.kind === 'occurrenceWorkbench' && node.room.address.occurrenceId === postbossId)
      return node;
  throw new Error('F has no projected Postboss');
}

/** One feature's entry above the optional actions of the Postboss timeline. */
function entryOf(projected: Projected, feature: 'stygianWell' | 'purgingPool') {
  const node = postboss(projected);
  const actions = node.room.roomActions?.featureRolls?.find((entry) => entry.feature === feature);
  if (actions === undefined) throw new Error(`the Postboss has no ${feature} entry`);
  const interaction = projected.workspace.interactions.featureRollActions.get(
    actions.interactionKey,
  );
  if (interaction === undefined) throw new Error(`the ${feature} entry is unbound`);
  return { node, actions, interaction };
}

function wellOf(projected: Projected) {
  const entry = entryOf(projected, 'stygianWell');
  const well = entry.node.room.workbench.features.find(
    (feature): feature is Extract<WorkspaceRoomFeature, { readonly kind: 'stygianWell' }> =>
      feature.kind === 'stygianWell',
  )!;
  return { ...entry, well };
}

function apply(project: ProjectDocument, command: Parameters<typeof applyProjectCommand>[2]) {
  return applyProjectCommand(project, catalog, command);
}

const order = (project: ProjectDocument) =>
  project.route.biomes[0]!.topology!.occurrences.find(
    (occurrence) => occurrence.occurrenceId === postbossId,
  )!.roomActions.order;

describe('Stygian Well Interact', () => {
  const base = withScreenRerolls(
    withArcana(loadUnderworldFStygianWellCheckpoint(), ['DoorReroll']),
  );

  it('lists what can be done at the end of the room, each pick appending one action', () => {
    const projected = projectStructuredWorkspaceFixture(base);
    const { well, actions, interaction } = wellOf(projected);
    // The panel shows the initial stock only.
    expect(well.slots.map((slot) => slot.generationKey)).toEqual([
      'initial:healing',
      'initial:secondLeft',
      'initial:secondRight',
    ]);
    expect(actions.options).toEqual([
      { key: 'buy:initial:healing', kind: 'offer', label: 'Buy Splintered Shield' },
      { key: 'reroll', kind: 'reroll', label: 'Reroll · costs 1' },
    ]);
    expect(interaction.intentFor('reroll').command).toEqual({
      kind: 'InsertStygianWellReroll',
      occurrence: room,
      index: order(base).length,
    });
    expect(interaction.intentFor('buy:initial:healing').command).toEqual({
      kind: 'SetStygianWellPurchase',
      occurrence: room,
      generationKey: 'initial:healing',
      purchased: true,
    });
  });

  it('buys a blank initial slot with the item chosen then', () => {
    const blank = apply(base, {
      kind: 'ReplaceStygianWellOffer',
      occurrence: room,
      slotKey: 'healing',
      itemKey: null,
    });
    const { actions, interaction } = wellOf(projectStructuredWorkspaceFixture(blank));
    expect(actions.options[0]).toEqual({
      key: 'buy:initial:healing',
      kind: 'offer',
      label: 'Buy Offer 1…',
      needsChoice: true,
    });
    const [itemKey] = interaction
      .choices('buy:initial:healing')
      .sections.flatMap((section) => section.items.map((item) => item.value));
    expect(interaction.choiceIntentFor('buy:initial:healing', itemKey!).command).toEqual({
      kind: 'SetStygianWellPurchase',
      occurrence: room,
      generationKey: 'initial:healing',
      purchased: true,
      itemKey,
    });
  });

  it('buys an unpinned reroll slot with its item, and pins slots on the reroll row', () => {
    const rerolled = apply(base, {
      kind: 'InsertStygianWellReroll',
      occurrence: room,
      index: order(base).length,
    });
    const projected = projectStructuredWorkspaceFixture(rerolled);
    const { node, actions, interaction } = wellOf(projected);
    expect(actions.options).toEqual([
      { key: 'buy:r1:healing', kind: 'offer', label: 'Buy Offer 1…', needsChoice: true },
      { key: 'reroll', kind: 'reroll', label: 'Reroll · costs 2' },
    ]);
    const items = interaction
      .choices('buy:r1:healing')
      .sections.flatMap((section) => section.items.map((item) => item.value));
    expect(items).toContain('HealDropRange');
    expect(interaction.choiceIntentFor('buy:r1:healing', 'HealDropRange').command).toEqual({
      kind: 'SetStygianWellPurchase',
      occurrence: room,
      generationKey: 'r1:healing',
      purchased: true,
      itemKey: 'HealDropRange',
    });
    // The reroll's row pins what it restocks; an unpinned slot stays native.
    const row = node.room.roomActions!.rows.find(
      (candidate) => candidate.reference.kind === 'rerollStygianWell',
    )!;
    expect(row.label).toBe('Reroll Well · roll 2');
    expect(row.featureRoll?.slots.map((slot) => [slot.slotKey, slot.value])).toEqual([
      ['healing', null],
    ]);
    const slot = projected.workspace.interactions.featureRollSlots.get(
      row.featureRoll!.slots[0]!.interactionKey,
    )!;
    expect(slot.intentFor('HealDropRange').command).toEqual({
      kind: 'ReplaceStygianWellRollOffer',
      action: row.address,
      slotKey: 'healing',
      itemKey: 'HealDropRange',
    });
    const bought = projectStructuredWorkspaceFixture(
      apply(rerolled, interaction.choiceIntentFor('buy:r1:healing', 'HealDropRange').command),
    );
    const purchase = postboss(bought).room.roomActions!.rows.find(
      (candidate) =>
        candidate.reference.kind === 'purchaseStygianWellOffer' &&
        candidate.reference.generationKey === 'r1:healing',
    );
    expect(purchase?.label).toMatch(/^Buy .+ · roll 2$/);
    expect(purchase?.purchaseRemoval?.command).toEqual({
      kind: 'SetStygianWellPurchase',
      occurrence: room,
      generationKey: 'r1:healing',
      purchased: false,
    });
  });

  it('routes a pin the roll does not restock to its slot on the reroll row', () => {
    const rerolled = apply(base, {
      kind: 'InsertStygianWellReroll',
      occurrence: room,
      index: order(base).length,
    });
    const row = postboss(projectStructuredWorkspaceFixture(rerolled)).room.roomActions!.rows.find(
      (candidate) => candidate.reference.kind === 'rerollStygianWell',
    )!;
    const pinned = apply(rerolled, {
      kind: 'ReplaceStygianWellRollOffer',
      action: row.address,
      slotKey: 'secondRight',
      itemKey: 'TemporaryBoonRarityTrait',
    });
    const projected = projectStructuredWorkspaceFixture(pinned);
    const owner = createRoomFeatureAddress(room, {
      kind: 'stygianWellOffer',
      generationKey: 'r1:secondRight',
    });
    expect(
      postboss(projected)
        .room.roomActions!.rows.find((candidate) => candidate.key === row.key)
        ?.featureRoll?.slots.map((slot) => slot.slotKey),
    ).toEqual(['healing', 'secondRight']);
    expect(projected.workspace.focusByOwner.get(semanticAddressKey(owner))).toMatchObject({
      roomTab: 'actions',
      markAddress: owner,
    });
    expect(projected.workspace.findingsByRepairTarget.get(semanticAddressKey(owner))).toEqual([
      expect.objectContaining({ code: 'rollOfferUnavailable' }),
    ]);
  });

  it('hides the reroll without the card, and locks it once the pool is spent', () => {
    const plain = withScreenRerolls(
      withArcana(loadUnderworldFStygianWellCheckpoint(), ['DoorReroll']),
      ['CastCount', 'StartingGold', 'HealthRegen', 'BonusDodge', 'TradeOff'],
    );
    expect(
      wellOf(projectStructuredWorkspaceFixture(plain)).actions.options.map((option) => option.kind),
    ).toEqual(['offer']);
    // Four rerolls cost 1 + 2 + 3 + 4: the whole pool of 10.
    let project = base;
    for (let count = 0; count < 4; count += 1)
      project = apply(project, {
        kind: 'InsertStygianWellReroll',
        occurrence: room,
        index: order(project).length,
      });
    const reroll = wellOf(projectStructuredWorkspaceFixture(project)).actions.options.at(-1);
    expect(reroll).toMatchObject({
      kind: 'reroll',
      label: 'Reroll · costs 5',
      locked: 'poolEmpty',
    });
  });

  it('locks the entry once everything is bought and no reroll is offered', () => {
    const plain = withScreenRerolls(
      withArcana(loadUnderworldFStygianWellCheckpoint(), ['DoorReroll']),
      ['CastCount', 'StartingGold', 'HealthRegen', 'BonusDodge', 'TradeOff'],
    );
    const { actions, interaction } = wellOf(projectStructuredWorkspaceFixture(plain));
    expect(actions.locked).toBeUndefined();
    const bought = apply(plain, interaction.intentFor(actions.options[0]!.key).command);
    expect(wellOf(projectStructuredWorkspaceFixture(bought)).actions).toMatchObject({
      options: [],
      locked: 'allBought',
    });
  });
});

describe('Pool of Purging Interact', () => {
  const base = withScreenRerolls(
    withArcana(loadUnderworldFStygianWellCheckpoint(), ['DoorReroll']),
  );

  const poolOf = (projected: Projected) => entryOf(projected, 'purgingPool');

  it('sells a listed trait, or a rerolled slot with its trait, at the end of the room', () => {
    const { actions, interaction } = poolOf(projectStructuredWorkspaceFixture(base));
    const sale = actions.options[0]!;
    expect(sale).toMatchObject({ kind: 'offer', label: expect.stringMatching(/^Sell /) });
    expect(interaction.intentFor(sale.key).command).toEqual({
      kind: 'InsertRoomAction',
      action: expect.objectContaining({ kind: 'roomAction' }),
      reference: { kind: 'sellPurgingPoolTrait', slotKey: 'left' },
      index: order(base).length,
    });
    const rerolled = apply(base, interaction.intentFor('reroll').command);
    const after = poolOf(projectStructuredWorkspaceFixture(rerolled));
    const unpinned = after.actions.options.find((option) => option.needsChoice === true)!;
    expect(unpinned.label).toMatch(/^Sell Offer \d…$/);
    const [traitKey] = after.interaction
      .choices(unpinned.key)
      .sections.flatMap((section) => section.items.map((item) => item.value));
    expect(after.interaction.choiceIntentFor(unpinned.key, traitKey!).command).toMatchObject({
      kind: 'SellPurgingPoolRollSlot',
      rollKey: 'r1',
      traitKey,
      index: order(rerolled).length,
    });
  });

  it('sells a blank slot of the initial list with the trait chosen then', () => {
    const blank = apply(base, {
      kind: 'ReplacePurgingPoolSlot',
      occurrence: room,
      slotKey: 'left',
      traitKey: null,
    });
    const { actions, interaction } = poolOf(projectStructuredWorkspaceFixture(blank));
    const sale = actions.options.find((option) => option.key.includes('"left"'))!;
    expect(sale).toEqual({
      key: sale.key,
      kind: 'offer',
      label: 'Sell Offer 1…',
      needsChoice: true,
    });
    const [traitKey] = interaction
      .choices(sale.key)
      .sections.flatMap((section) => section.items.map((item) => item.value));
    const command = interaction.choiceIntentFor(sale.key, traitKey!).command;
    expect(command).toEqual({
      kind: 'SellPurgingPoolRollSlot',
      occurrence: room,
      rollKey: 'initial',
      slotKey: 'left',
      traitKey,
      index: order(blank).length,
    });
    expect(order(apply(blank, command)).at(-1)).toEqual({
      kind: 'sellPurgingPoolTrait',
      slotKey: 'left',
    });
  });
});
