import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createRoomActionAddress,
  createRoomFeatureAddress,
  roomActionKey,
  semanticAddressKey,
  type ProjectCommand,
  type ProjectDocument,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';
import {
  purgingPoolCandidateForProjectEvaluationAssembly,
  rerollSpendAllowanceForProjectEvaluationAssembly,
  settleProjectEdit,
  simulateProjectAssembly,
  stygianWellCandidateForProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';
import { loadUnderworldFStygianWellCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { withArcana, withJudgment } from '../support/rerolls';

const f = createBiomeAddress('Underworld', 'F');
const postboss = 'golden-f-preboss-shop:postboss';
const room = createOccurrenceAddress(f, postboss as never);

const evaluate = (project: ProjectDocument) => simulateProjectAssembly(catalog, project);
const settle = (project: ProjectDocument, command: ProjectCommand) =>
  settleProjectEdit({ catalog, before: evaluate(project), command, evaluate }).assembly.project;

function order(project: ProjectDocument): readonly RoomActionReference[] {
  return project.route.biomes[0]!.topology!.occurrences.find(
    (entry) => entry.occurrenceId === postboss,
  )!.roomActions.order;
}

const actionAt = (reference: RoomActionReference) =>
  createRoomActionAddress(f, postboss as never, roomActionKey(reference));
const wellReroll = (rerollId: string) =>
  actionAt({ kind: 'rerollStygianWell', rerollId, offerKeyBySlot: {} });
const poolReroll = (rerollId: string) =>
  actionAt({ kind: 'rerollPurgingPool', rerollId, traitKeyBySlot: {} });

/**
 * The F Postboss Well with a held screen-reroll card: Travel Deal restocks its
 * first purchase (secondLeft), then secondRight and the restock are bought.
 */
function base(): ProjectDocument {
  return withJudgment(
    withArcana(loadUnderworldFStygianWellCheckpoint(), ['DoorReroll']),
    'F',
    'golden-f-preboss-shop:boss',
    ['ScreenReroll', 'StartingGold', 'HealthRegen', 'BonusDodge', 'TradeOff'],
  );
}

function appendWellReroll(project: ProjectDocument): ProjectDocument {
  return settle(project, {
    kind: 'InsertStygianWellReroll',
    occurrence: room,
    index: order(project).length,
  });
}

function findings(project: ProjectDocument) {
  return evaluate(project).evaluation.findings.map((finding) => ({
    code: finding.code,
    origin: semanticAddressKey(finding.origin),
    evidence: finding.evidence,
  }));
}

const well = (project: ProjectDocument) =>
  stygianWellCandidateForProjectEvaluationAssembly(evaluate(project), room)!;
const pool = (project: ProjectDocument) =>
  purgingPoolCandidateForProjectEvaluationAssembly(evaluate(project), room)!;

describe('Stygian Well rolls', () => {
  it('restock only slots not bought earlier, and the k-th reroll costs k', () => {
    const project = appendWellReroll(base());
    expect(order(project).at(-1)).toEqual({
      kind: 'rerollStygianWell',
      rerollId: 'r1',
      offerKeyBySlot: {},
    });
    expect(findings(project)).toEqual([]);
    const capability = well(project);
    // secondRight and the Travel Deal restock in secondLeft were bought: only healing restocks.
    expect(capability.rolls['r1']?.offeredSlotKeys).toEqual(['healing']);
    expect(capability.interaction).toMatchObject({
      rollKey: 'r1',
      offers: [{ generationKey: 'r1:healing', slotKey: 'healing', itemKey: null }],
      reroll: { cost: 2, enabled: true, available: true },
      pendingRoll: { offeredSlotKeys: ['healing'] },
    });
    expect(capability.interaction?.pendingRoll.candidateItemKeysBySlot.healing).toContain(
      'ArmorBoostStore',
    );
    expect(
      rerollSpendAllowanceForProjectEvaluationAssembly(evaluate(project), {
        kind: 'featureReroll',
        occurrence: room,
        feature: 'stygianWell',
      }),
    ).toMatchObject({ kind: 'reached', cost: 2 });
  });

  it("keep Travel Deal's restocked slot offered when its restock is not bought", () => {
    let project = base();
    for (const generationKey of ['travelDealRefill', 'initial:secondRight'] as const)
      project = applyProjectCommand(project, catalog, {
        kind: 'SetStygianWellPurchase',
        occurrence: room,
        generationKey,
        purchased: false,
      });
    project = appendWellReroll(project);
    expect(well(project).rolls['r1']?.offeredSlotKeys).toEqual([
      'healing',
      'secondLeft',
      'secondRight',
    ]);
    // Without a reroll only the initial healing slot is left.
    const before = well(base()).interaction;
    expect(before?.offers).toEqual([
      { generationKey: 'initial:healing', slotKey: 'healing', itemKey: 'ArmorBoostStore' },
    ]);
    expect(before?.reroll).toMatchObject({ cost: 1, available: true });
  });

  it('report a pin on a blank slot, and settle a purchase from the current roll', () => {
    let project = appendWellReroll(base());
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStygianWellRollOffer',
      action: wellReroll('r1'),
      slotKey: 'secondRight',
      itemKey: 'TemporaryBoonRarityTrait',
    });
    expect(findings(project)).toContainEqual({
      code: 'rollOfferUnavailable',
      origin: semanticAddressKey(
        createRoomFeatureAddress(room, {
          kind: 'stygianWellOffer',
          generationKey: 'r1:secondRight',
        }),
      ),
      evidence: { reason: 'slotNotOffered' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStygianWellRollOffer',
      action: wellReroll('r1'),
      slotKey: 'secondRight',
      itemKey: null,
    });
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'SetStygianWellPurchase',
        occurrence: room,
        generationKey: 'r1:healing',
        purchased: true,
      }),
    ).toThrow('Stygian Well offer is unresolved');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStygianWellRollOffer',
      action: wellReroll('r1'),
      slotKey: 'healing',
      itemKey: 'ArmorBoostStore',
    });
    project = settle(project, {
      kind: 'SetStygianWellPurchase',
      occurrence: room,
      generationKey: 'r1:healing',
      purchased: true,
    });
    expect(findings(project)).toEqual([]);
    expect(well(project).interaction).toMatchObject({
      offers: [],
      reroll: { available: false },
    });
  });

  it('pin and buy a reroll slot in one edit', () => {
    const project = appendWellReroll(base());
    const bought = applyProjectCommand(project, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: room,
      generationKey: 'r1:healing',
      purchased: true,
      itemKey: 'ArmorBoostStore',
    });
    expect(order(bought).slice(-2)).toEqual([
      { kind: 'rerollStygianWell', rerollId: 'r1', offerKeyBySlot: { healing: 'ArmorBoostStore' } },
      { kind: 'purchaseStygianWellOffer', generationKey: 'r1:healing' },
    ]);
    expect(findings(bought)).toEqual([]);
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'SetStygianWellPurchase',
        occurrence: room,
        generationKey: 'initial:healing',
        purchased: true,
        itemKey: 'ArmorBoostStore',
      }),
    ).toThrow('only a reroll slot is pinned with its purchase');
  });

  it('keep a purchase from a replaced or removed roll with its finding', () => {
    let project = appendWellReroll(base());
    const secondRight = actionAt({
      kind: 'purchaseStygianWellOffer',
      generationKey: 'initial:secondRight',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'MoveRoomAction',
      action: secondRight,
      toIndex: order(project).length - 1,
    });
    expect(findings(project)).toContainEqual({
      code: 'rollOfferUnavailable',
      origin: semanticAddressKey(secondRight),
      evidence: { reason: 'replaced' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStygianWellRollOffer',
      action: wellReroll('r1'),
      slotKey: 'healing',
      itemKey: 'ArmorBoostStore',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: room,
      generationKey: 'r1:healing',
      purchased: true,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'RemoveRoomAction',
      action: wellReroll('r1'),
    });
    const healing = actionAt({ kind: 'purchaseStygianWellOffer', generationKey: 'r1:healing' });
    expect(order(project)).toContainEqual({
      kind: 'purchaseStygianWellOffer',
      generationKey: 'r1:healing',
    });
    expect(findings(project)).toContainEqual({
      code: 'rollOfferUnavailable',
      origin: semanticAddressKey(healing),
      evidence: { reason: 'missing' },
    });
    // A new reroll takes the smallest free id and adopts the kept purchase.
    expect(order(appendWellReroll(project)).at(-1)).toMatchObject({ rerollId: 'r1' });
  });

  it('refuse a reroll past the pool and report one with nothing left', () => {
    let project = base();
    for (let press = 0; press < 3; press += 1) project = appendWellReroll(project);
    const before = evaluate(project);
    const remaining = rerollSpendAllowanceForProjectEvaluationAssembly(before, {
      kind: 'featureReroll',
      occurrence: room,
      feature: 'stygianWell',
    });
    expect(remaining).toMatchObject({ kind: 'reached', cost: 4 });
    if (remaining.kind === 'reached' && !remaining.allowed)
      expect(() => appendWellReroll(project)).toThrow('the reroll pool has nothing left');
    const disabled = applyProjectCommand(loadUnderworldFStygianWellCheckpoint(), catalog, {
      kind: 'InsertStygianWellReroll',
      occurrence: room,
      index: order(base()).length,
    });
    expect(findings(disabled)).toContainEqual({
      code: 'screenRerollUnavailable',
      origin: semanticAddressKey(wellReroll('r1')),
      evidence: { reason: 'disabled' },
    });
  });
});

describe('Pool of Purging rolls', () => {
  function interacted(): ProjectDocument {
    return applyProjectCommand(base(), catalog, {
      kind: 'SetPurgingPoolInteraction',
      occurrence: room,
      interacted: true,
    });
  }

  it('redraw the list from current traits and sell from the roll on show', () => {
    let project = settle(interacted(), {
      kind: 'InsertPurgingPoolReroll',
      occurrence: room,
      index: order(interacted()).length,
    });
    const capability = pool(project);
    expect(capability.rolls['r1']?.offeredSlotKeys).toEqual(['left', 'middle', 'right']);
    expect(capability.interaction).toMatchObject({
      rollKey: 'r1',
      reroll: { cost: 2 },
      offers: [
        { slotKey: 'left', traitKey: null, sale: { slotKey: 'left', rollKey: 'r1' } },
        { slotKey: 'middle', traitKey: null },
        { slotKey: 'right', traitKey: null },
      ],
    });
    const traitKey = capability.rolls['r1']!.candidateTraitKeysBySlot.left[0]!;
    // An unpinned slot cannot be sold until its trait is pinned.
    const sale = { kind: 'sellPurgingPoolTrait', slotKey: 'left', rollKey: 'r1' } as const;
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'InsertRoomAction',
        action: actionAt(sale),
        reference: sale,
        index: order(project).length,
      }),
    ).toThrow('room action is not active for this occurrence');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplacePurgingPoolRollSlot',
      action: poolReroll('r1'),
      slotKey: 'left',
      traitKey,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'InsertRoomAction',
      action: actionAt(sale),
      reference: sale,
      index: order(project).length,
    });
    expect(findings(project)).toEqual([]);
    expect(pool(project).interaction?.offers.map((offer) => offer.slotKey)).toEqual([
      'middle',
      'right',
    ]);
    // Unpinning the sold slot keeps the sale with its finding.
    const cleared = applyProjectCommand(project, catalog, {
      kind: 'ReplacePurgingPoolRollSlot',
      action: poolReroll('r1'),
      slotKey: 'left',
      traitKey: null,
    });
    expect(findings(cleared)).toContainEqual({
      code: 'purgingPoolTraitMissing',
      origin: semanticAddressKey(
        createRoomFeatureAddress(room, {
          kind: 'purgingPoolOffer',
          slotKey: 'left',
          rollKey: 'r1',
        }),
      ),
      evidence: { slotKey: 'left' },
    });
  });

  it('pin and sell a reroll slot in one edit', () => {
    const project = settle(interacted(), {
      kind: 'InsertPurgingPoolReroll',
      occurrence: room,
      index: order(interacted()).length,
    });
    const traitKey = pool(project).rolls['r1']!.candidateTraitKeysBySlot.right[0]!;
    const sold = applyProjectCommand(project, catalog, {
      kind: 'SellPurgingPoolRollSlot',
      reroll: poolReroll('r1'),
      slotKey: 'right',
      traitKey,
      index: order(project).length,
    });
    expect(order(sold).slice(-2)).toEqual([
      { kind: 'rerollPurgingPool', rerollId: 'r1', traitKeyBySlot: { right: traitKey } },
      { kind: 'sellPurgingPoolTrait', slotKey: 'right', rollKey: 'r1' },
    ]);
    expect(findings(sold)).toEqual([]);
  });

  it('report a sale from the replaced initial list', () => {
    let project = interacted();
    const sale = { kind: 'sellPurgingPoolTrait', slotKey: 'left' } as const;
    project = applyProjectCommand(project, catalog, {
      kind: 'InsertRoomAction',
      action: actionAt(sale),
      reference: sale,
      index: order(project).length,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'InsertPurgingPoolReroll',
      occurrence: room,
      index: order(project).length - 1,
    });
    expect(findings(project)).toContainEqual({
      code: 'rollOfferUnavailable',
      origin: semanticAddressKey(actionAt(sale)),
      evidence: { reason: 'replaced' },
    });
  });
});
