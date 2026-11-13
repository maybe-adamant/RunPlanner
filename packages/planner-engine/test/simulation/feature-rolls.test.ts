import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createProjectHistory,
  createRoomActionAddress,
  createRoomFeatureAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  roomActionDomainForOccurrence,
  roomActionKey,
  semanticAddressKey,
  undoProjectHistory,
  type ProjectCommand,
  type ProjectDocument,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';
import {
  assembleRoomActionRoster,
  purgingPoolCandidateForProjectEvaluationAssembly,
  rerollSpendAllowanceForProjectEvaluationAssembly,
  settleProjectEdit,
  simulateProjectAssembly,
  stygianWellCandidateForProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';
import { loadUnderworldFStygianWellCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { withArcana, withJudgment } from '../support/rerolls';
import { withItemContent, withItemContents } from '@run-planner/test-fixtures/shared';

const f = createBiomeAddress('Underworld', 'F');
const postboss = 'golden-f-preboss-shop:postboss';
const room = createOccurrenceAddress(f, postboss as never);

const evaluate = (project: ProjectDocument) => simulateProjectAssembly(catalog, project);
const settle = (project: ProjectDocument, command: ProjectCommand) =>
  settleProjectEdit({ catalog, before: evaluate(project), command, evaluate }).assembly.project;

function occurrenceOf(project: ProjectDocument) {
  return project.route.biomes[0]!.topology!.occurrences.find(
    (entry) => entry.occurrenceId === postboss,
  )!;
}

function order(project: ProjectDocument): readonly RoomActionReference[] {
  return occurrenceOf(project).roomActions.order;
}

const actionAt = (reference: RoomActionReference) =>
  createRoomActionAddress(f, postboss as never, roomActionKey(reference));
const wellReroll = (rerollId: string) => actionAt({ kind: 'rerollStygianWell', rerollId });
const poolReroll = (rerollId: string) => actionAt({ kind: 'rerollPurgingPool', rerollId });

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
    expect(order(project).at(-1)).toEqual({ kind: 'rerollStygianWell', rerollId: 'r1' });
    expect(findings(project)).toEqual([]);
    const capability = well(project);
    // secondRight and the Travel Deal restock in secondLeft were bought: only healing restocks.
    expect(capability.rolls['r1']?.offeredSlotKeys).toEqual(['healing']);
    // The reroll's edit stocked its blank slot, past the one item on show that the game bans.
    const restocked = occurrenceOf(project).stygianWell?.rerollOfferKeyBySlot?.['r1']?.healing;
    expect(capability.rolls['r1']?.candidateItemKeysBySlot.healing).toContain(restocked);
    expect(restocked).not.toBe('ArmorBoostStore');
    expect(capability.interaction).toMatchObject({
      rollKey: 'r1',
      offers: [{ generationKey: 'r1:healing', slotKey: 'healing', itemKey: restocked }],
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
    for (const slotKey of ['secondRight', 'healing'] as const)
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceStygianWellRollOffer',
        action: wellReroll('r1'),
        slotKey,
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
      itemKey: 'HealDropRange',
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
      itemKey: 'HealDropRange',
    });
    expect(order(bought).slice(-2)).toEqual(
      withItemContents(bought, room, [
        { kind: 'rerollStygianWell', rerollId: 'r1' },
        { kind: 'purchaseStygianWellOffer', generationKey: 'r1:healing' },
      ]),
    );
    expect(occurrenceOf(bought).stygianWell?.rerollOfferKeyBySlot).toEqual({
      r1: { healing: 'HealDropRange' },
    });
    expect(findings(bought)).toEqual([]);
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'SetStygianWellPurchase',
        occurrence: room,
        generationKey: 'r1:healing',
        purchased: false,
        itemKey: 'HealDropRange',
      }),
    ).toThrow('a slot is pinned only with its purchase');
  });

  it('report a blank slot missing until an edit stocks it, initial ones included', () => {
    let project = base();
    const blank = {
      code: 'stygianWellMissing',
      origin: semanticAddressKey(
        createRoomFeatureAddress(room, {
          kind: 'stygianWellOffer',
          generationKey: 'initial:healing',
        }),
      ),
      evidence: { reason: 'missing' },
    };
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStygianWellOffer',
      occurrence: room,
      slotKey: 'healing',
      itemKey: null,
    });
    expect(findings(project)).toEqual([blank]);
    // The next edit's settlement stocks it.
    const stocked = settle(project, {
      kind: 'ReplaceStygianWellOffer',
      occurrence: room,
      slotKey: 'secondLeft',
      itemKey: occurrenceOf(project).stygianWell!.offerKeyBySlot.secondLeft,
    });
    expect(findings(stocked)).toEqual([]);
    expect(occurrenceOf(stocked).stygianWell?.offerKeyBySlot.healing).not.toBeNull();
    project = applyProjectCommand(project, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: room,
      generationKey: 'initial:healing',
      purchased: true,
      itemKey: 'HealDropRange',
    });
    expect(findings(project)).toEqual([]);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStygianWellOffer',
      occurrence: room,
      slotKey: 'healing',
      itemKey: null,
    });
    expect(findings(project)).toContainEqual({
      code: 'stygianWellMissing',
      origin: semanticAddressKey(
        createRoomFeatureAddress(room, {
          kind: 'stygianWellOffer',
          generationKey: 'initial:healing',
        }),
      ),
      evidence: { reason: 'missing' },
    });
  });

  it('refuse a reroll whose pins repeat every item still on show', () => {
    // Only the initial healing item is on show before the reroll: one item is always banned.
    const repeated = applyProjectCommand(appendWellReroll(base()), catalog, {
      kind: 'ReplaceStygianWellRollOffer',
      action: wellReroll('r1'),
      slotKey: 'healing',
      itemKey: 'ArmorBoostStore',
    });
    expect(findings(repeated)).toEqual([
      {
        code: 'rollRepeatsAllOffers',
        origin: semanticAddressKey(wellReroll('r1')),
        evidence: { itemKeys: ['ArmorBoostStore'] },
      },
    ]);
    // With secondRight and the restock still on show, repeating one item is possible.
    let partial = base();
    for (const generationKey of ['travelDealRefill', 'initial:secondRight'] as const)
      partial = applyProjectCommand(partial, catalog, {
        kind: 'SetStygianWellPurchase',
        occurrence: room,
        generationKey,
        purchased: false,
      });
    partial = applyProjectCommand(appendWellReroll(partial), catalog, {
      kind: 'ReplaceStygianWellRollOffer',
      action: wellReroll('r1'),
      slotKey: 'healing',
      itemKey: 'ArmorBoostStore',
    });
    expect(findings(partial)).toEqual([]);
  });

  it('keep a purchase from a replaced roll with its finding, and remove one with its roll', () => {
    let project = appendWellReroll(base());
    const secondRight = actionAt({
      kind: 'purchaseStygianWellOffer',
      generationKey: 'initial:secondRight',
    });
    // Moving the purchase past the reroll restocks its slot there, which that edit stocks.
    project = settle(project, {
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
      itemKey: 'HealDropRange',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: room,
      generationKey: 'r1:healing',
      purchased: true,
    });
    const healing = { kind: 'purchaseStygianWellOffer', generationKey: 'r1:healing' } as const;
    expect(order(project).map(roomActionKey)).toContain(roomActionKey(healing));
    const removal: ProjectCommand = { kind: 'RemoveRoomAction', action: wellReroll('r1') };
    // The removed reroll's pins and the purchases of its roll leave with it.
    for (const removed of [
      applyProjectCommand(project, catalog, removal),
      settle(project, removal),
    ]) {
      expect(occurrenceOf(removed).stygianWell?.rerollOfferKeyBySlot).toBeUndefined();
      expect(order(removed).map(roomActionKey)).not.toContain(roomActionKey(healing));
      expect(order(removed).map(roomActionKey)).toContain(secondRight.actionKey);
    }
    // The reroll, its pins and its roll's purchase return in one Undo step.
    const removedHistory = applyProjectHistoryCommand(
      createProjectHistory(project),
      catalog,
      removal,
    );
    expect(removedHistory.past).toHaveLength(1);
    expect(undoProjectHistory(removedHistory).present).toBe(project);
    // A reset from before the reroll takes the reroll, its roll's purchase and every row after.
    const rerollIndex = order(project).findIndex(
      (reference) => reference.kind === 'rerollStygianWell',
    );
    const reset = applyProjectCommand(project, catalog, {
      kind: 'ResetRoomActionsAfter',
      occurrence: room,
      afterActionKey: roomActionKey(order(project)[rerollIndex - 1]!),
    });
    expect(occurrenceOf(reset).stygianWell?.rerollOfferKeyBySlot).toBeUndefined();
    expect(order(reset)).toEqual(order(project).slice(0, rerollIndex));
    // A saved purchase of a roll no longer held stays with its finding, and a
    // new reroll never takes the id it names.
    const orphaned = (() => {
      const raw = JSON.parse(encodeProjectDocument(project));
      const shop = raw.route.biomes[0].topology.occurrences.find(
        (candidate: { occurrenceId: string }) => candidate.occurrenceId === postboss,
      );
      shop.roomActions.order = shop.roomActions.order.filter(
        (reference: RoomActionReference) => reference.kind !== 'rerollStygianWell',
      );
      delete shop.stygianWell.rerollOfferKeyBySlot;
      return decodeProjectDocument(raw, catalog);
    })();
    expect(findings(orphaned)).toContainEqual({
      code: 'rollOfferUnavailable',
      origin: semanticAddressKey(actionAt(healing)),
      evidence: { reason: 'missing' },
    });
    const rerolled = appendWellReroll(orphaned);
    expect(order(rerolled).at(-1)).toMatchObject({ rerollId: 'r2' });
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
    // The game refuses the press, so nothing after it is reached.
    const blocked = evaluate(disabled).evaluation.route!.biomes[0]!;
    expect(
      'coverage' in blocked && blocked.coverage.kind === 'prefix' && blocked.coverage.blockedAt,
    ).toEqual(wellReroll('r1'));
  });
});

describe('Pool of Purging rolls', () => {
  /** The Pool with its initial list pinned: four eligible traits, three shown. */
  function interacted(): ProjectDocument {
    let project = base();
    for (const [slotKey, traitKey] of [
      ['left', 'ApolloWeaponBoon'],
      ['middle', 'HeraCastBoon'],
      ['right', 'ZeusSpecialBoon'],
    ] as const)
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplacePurgingPoolSlot',
        occurrence: room,
        slotKey,
        traitKey,
      });
    return project;
  }

  it('redraw the list from current traits and sell from the roll on show', () => {
    let project = settle(interacted(), {
      kind: 'InsertPurgingPoolReroll',
      occurrence: room,
      index: order(interacted()).length,
    });
    const capability = pool(project);
    expect(capability.rolls['r1']?.offeredSlotKeys).toEqual(['left', 'middle', 'right']);
    // The reroll's edit stocked its list.
    const list = occurrenceOf(project).purgingPool!.rerollTraitKeyBySlot!['r1']!;
    expect(capability.interaction).toMatchObject({
      rollKey: 'r1',
      reroll: { cost: 2 },
      offers: [
        { slotKey: 'left', traitKey: list.left, sale: { slotKey: 'left', rollKey: 'r1' } },
        { slotKey: 'middle', traitKey: list.middle },
        { slotKey: 'right', traitKey: list.right },
      ],
    });
    const sale = { kind: 'sellPurgingPoolTrait', slotKey: 'left', rollKey: 'r1' } as const;
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
      occurrence: room,
      rollKey: 'r1',
      slotKey: 'right',
      traitKey,
      index: order(project).length,
    });
    expect(order(sold).slice(-2)).toEqual(
      withItemContents(sold, room, [
        { kind: 'rerollPurgingPool', rerollId: 'r1' },
        { kind: 'sellPurgingPoolTrait', slotKey: 'right', rollKey: 'r1' },
      ]),
    );
    expect(occurrenceOf(sold).purgingPool?.rerollTraitKeyBySlot?.['r1']).toMatchObject({
      right: traitKey,
    });
    // Removing the reroll takes its list and the list's sales with it.
    const removed = applyProjectCommand(sold, catalog, {
      kind: 'RemoveRoomAction',
      action: poolReroll('r1'),
    });
    expect(occurrenceOf(removed).purgingPool?.rerollTraitKeyBySlot).toBeUndefined();
    expect(order(removed).map(roomActionKey)).not.toContain(
      roomActionKey({ kind: 'sellPurgingPoolTrait', slotKey: 'right', rollKey: 'r1' }),
    );
    expect(findings(sold)).toEqual([]);
    expect(findings(removed)).toEqual([]);
    // The reroll, its list and the list's sale return in one Undo step.
    const removedHistory = applyProjectHistoryCommand(createProjectHistory(sold), catalog, {
      kind: 'RemoveRoomAction',
      action: poolReroll('r1'),
    });
    expect(removedHistory.past).toHaveLength(1);
    expect(undoProjectHistory(removedHistory).present).toBe(sold);
  });

  it('pin and sell a blank initial slot in one edit, and refuse a slot already sold', () => {
    const blank = applyProjectCommand(interacted(), catalog, {
      kind: 'ReplacePurgingPoolSlot',
      occurrence: room,
      slotKey: 'left',
      traitKey: null,
    });
    const traitKey = pool(blank).candidateTraitKeysBySlot.left[0]!;
    const sell = (project: ProjectDocument) =>
      applyProjectCommand(project, catalog, {
        kind: 'SellPurgingPoolRollSlot',
        occurrence: room,
        rollKey: 'initial',
        slotKey: 'left',
        traitKey,
        index: order(project).length,
      });
    const sold = sell(blank);
    expect(
      sold.route.biomes[0]!.topology!.occurrences.find((entry) => entry.occurrenceId === postboss)!
        .purgingPool?.traitKeyBySlot.left,
    ).toBe(traitKey);
    expect(order(sold).at(-1)).toEqual(
      withItemContent(sold, room, { kind: 'sellPurgingPoolTrait', slotKey: 'left' }),
    );
    expect(findings(sold)).toEqual([]);
    expect(() => sell(sold)).toThrow('the slot is already sold');
    expect(() =>
      applyProjectCommand(blank, catalog, {
        kind: 'SellPurgingPoolRollSlot',
        occurrence: room,
        rollKey: 'r9',
        slotKey: 'left',
        traitKey,
        index: order(blank).length,
      }),
    ).toThrow('room action is not an ordered Pool reroll');
  });

  function pinnedPoolReroll(
    project: ProjectDocument,
    rerollId: string,
    traits: Readonly<Partial<Record<'left' | 'middle' | 'right', string>>>,
  ): ProjectDocument {
    let next = settle(project, {
      kind: 'InsertPurgingPoolReroll',
      occurrence: room,
      index: order(project).length,
    });
    for (const [slotKey, traitKey] of Object.entries(traits))
      next = applyProjectCommand(next, catalog, {
        kind: 'ReplacePurgingPoolRollSlot',
        action: poolReroll(rerollId),
        slotKey: slotKey as 'left' | 'middle' | 'right',
        traitKey,
      });
    return next;
  }

  it('refuse a list repeating every trait on show while the last draw left traits unshown', () => {
    // Four eligible traits, three shown: the reroll bans one of them.
    const repeated = pinnedPoolReroll(interacted(), 'r1', {
      left: 'ApolloWeaponBoon',
      middle: 'HeraCastBoon',
      right: 'ZeusSpecialBoon',
    });
    expect(findings(repeated)).toEqual([
      {
        code: 'rollRepeatsAllOffers',
        origin: semanticAddressKey(poolReroll('r1')),
        evidence: { itemKeys: ['ApolloWeaponBoon', 'HeraCastBoon', 'ZeusSpecialBoon'] },
      },
    ]);
    const partial = pinnedPoolReroll(interacted(), 'r1', {
      left: 'ApolloWeaponBoon',
      middle: 'HeraCastBoon',
      right: 'RestockBoon',
    });
    expect(findings(partial)).toEqual([]);
  });

  it('allow a list repeating every trait when the last draw showed every eligible trait', () => {
    let project = interacted();
    for (const slotKey of ['left', 'middle'] as const) {
      const sale = { kind: 'sellPurgingPoolTrait', slotKey } as const;
      project = applyProjectCommand(project, catalog, {
        kind: 'InsertRoomAction',
        action: actionAt(sale),
        reference: sale,
        index: order(project).length,
      });
    }
    // Zeus is on show with Travel Deal unshown, so r1 repeating it is banned;
    // r1 then shows both eligible traits, so r2 may repeat them.
    const pins = { left: 'ZeusSpecialBoon', middle: 'RestockBoon' } as const;
    project = pinnedPoolReroll(pinnedPoolReroll(project, 'r1', pins), 'r2', pins);
    expect(findings(project).map((finding) => [finding.code, finding.origin])).toEqual([
      ['rollRepeatsAllOffers', semanticAddressKey(poolReroll('r1'))],
    ]);
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
    project = settle(project, {
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

describe('roll-reference ordering', () => {
  /** Whether Move may place one action of the Postboss at a position. */
  function canMove(project: ProjectDocument, reference: RoomActionReference, toIndex: number) {
    const host = roomActionDomainForOccurrence(project, catalog, f, postboss as never)!;
    const roster = assembleRoomActionRoster({
      owner: room,
      order: host.occurrence.roomActions.order,
      contributions: host.domain.contributions,
      eventGraph: host.domain.eventGraph,
    });
    return roster.proposals.find(
      (proposal) =>
        proposal.kind === 'move' &&
        roomActionKey(proposal.reference) === roomActionKey(reference) &&
        proposal.toIndex === toIndex,
    )?.structurallyAuthorable;
  }

  it('keeps a purchase or sale from a reroll after that reroll', () => {
    let project = applyProjectCommand(appendWellReroll(base()), catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: room,
      generationKey: 'r1:healing',
      purchased: true,
      itemKey: 'HealDropRange',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'InsertPurgingPoolReroll',
      occurrence: room,
      index: order(project).length,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SellPurgingPoolRollSlot',
      occurrence: room,
      rollKey: 'r1',
      slotKey: 'left',
      traitKey: 'ApolloWeaponBoon',
      index: order(project).length,
    });
    const purchase = { kind: 'purchaseStygianWellOffer', generationKey: 'r1:healing' } as const;
    const sale = { kind: 'sellPurgingPoolTrait', slotKey: 'left', rollKey: 'r1' } as const;
    const wellAt = order(project).findIndex((action) => action.kind === 'rerollStygianWell');
    const poolAt = order(project).findIndex((action) => action.kind === 'rerollPurgingPool');
    expect(canMove(project, purchase, wellAt)).toBe(false);
    expect(canMove(project, sale, poolAt)).toBe(false);
    // Moving the reroll past its purchase is refused the same way.
    expect(canMove(project, order(project)[wellAt]!, order(project).length - 1)).toBe(false);
    // Initial-roll purchases are not constrained by a reroll.
    expect(
      canMove(
        project,
        { kind: 'purchaseStygianWellOffer', generationKey: 'initial:secondRight' },
        order(project).length - 1,
      ),
    ).toBe(true);
    // A misordered document is kept with its finding, never rewritten.
    const misordered = applyProjectCommand(project, catalog, {
      kind: 'MoveRoomAction',
      action: actionAt(purchase),
      toIndex: wellAt,
    });
    expect(order(misordered)[wellAt]).toEqual(withItemContent(misordered, room, purchase));
    expect(findings(misordered).map((finding) => finding.origin)).toContain(
      semanticAddressKey(actionAt(purchase)),
    );
  });
});
