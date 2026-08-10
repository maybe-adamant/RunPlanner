import { describe, expect, it } from 'vitest';

import { dropHubBoardRoom, moveHubBoardRoom, reconcileHubBoardRanking } from './hub-ranking';

describe('Hub ranked-board presentation', () => {
  it('keeps the authored prefix exact while reconciling a surviving transient tail', () => {
    const ranking = reconcileHubBoardRanking({
      authoredVisitOrder: ['combat01', 'combat03'],
      declarationOpenSlotKeys: ['combat01', 'combat02', 'combat03', 'combat05', 'combat09'],
      retainedTailSlotKeys: ['combat09', 'combat02'],
    });

    expect(ranking.authoredVisitOrder).toEqual(['combat01', 'combat03']);
    expect(ranking.tailSlotKeys).toEqual(['combat09', 'combat02', 'combat05']);
    expect(ranking.rankedSlotKeys).toEqual([
      'combat01',
      'combat03',
      'combat09',
      'combat02',
      'combat05',
    ]);
  });

  it('drops closed tail rooms and appends newly opened rooms in declaration order', () => {
    const ranking = reconcileHubBoardRanking({
      authoredVisitOrder: ['combat01', 'combat03'],
      declarationOpenSlotKeys: ['combat01', 'combat03', 'combat05', 'combat09', 'combat10'],
      retainedTailSlotKeys: ['combat02', 'combat09'],
    });

    expect(ranking.rankedSlotKeys).toEqual([
      'combat01',
      'combat03',
      'combat09',
      'combat05',
      'combat10',
    ]);
    expect(ranking.tailSlotKeys).toEqual(['combat09', 'combat05', 'combat10']);
  });

  it('keeps tail-only moves transient', () => {
    const ranking = reconcileHubBoardRanking({
      authoredVisitOrder: ['combat01', 'combat02'],
      declarationOpenSlotKeys: ['combat01', 'combat02', 'combat03', 'combat05'],
    });
    const result = moveHubBoardRoom(ranking, 6, {
      kind: 'moveLater',
      slotKey: 'combat03',
    });

    expect(result?.proposedVisitOrder).toBeUndefined();
    expect(result?.ranking.rankedSlotKeys).toEqual([
      'combat01',
      'combat02',
      'combat05',
      'combat03',
    ]);
  });

  it('appends an incomplete cross-boundary move at the next dense position', () => {
    const ranking = reconcileHubBoardRanking({
      authoredVisitOrder: ['combat01', 'combat02'],
      declarationOpenSlotKeys: ['combat01', 'combat02', 'combat03', 'combat05'],
    });
    const result = moveHubBoardRoom(ranking, 6, {
      kind: 'moveEarlier',
      slotKey: 'combat03',
    });

    expect(result?.proposedVisitOrder).toEqual(['combat01', 'combat02', 'combat03']);
    expect(result?.ranking.rankedSlotKeys).toEqual([
      'combat01',
      'combat02',
      'combat03',
      'combat05',
    ]);
  });

  it('replaces the sixth visit with the first tail room through one full proposal', () => {
    const ranking = reconcileHubBoardRanking({
      authoredVisitOrder: ['combat01', 'combat02', 'combat03', 'combat05', 'combat09', 'combat10'],
      declarationOpenSlotKeys: [
        'combat01',
        'combat02',
        'combat03',
        'combat05',
        'combat09',
        'combat10',
        'combat11',
        'combat23',
      ],
    });
    const result = moveHubBoardRoom(ranking, 6, {
      kind: 'moveEarlier',
      slotKey: 'combat11',
    });

    expect(result?.proposedVisitOrder).toEqual([
      'combat01',
      'combat02',
      'combat03',
      'combat05',
      'combat09',
      'combat11',
    ]);
    expect(result?.ranking.rankedSlotKeys).toEqual([
      'combat01',
      'combat02',
      'combat03',
      'combat05',
      'combat09',
      'combat11',
      'combat10',
      'combat23',
    ]);
  });

  it('removes a full-prefix visit by promoting the first tail room', () => {
    const ranking = reconcileHubBoardRanking({
      authoredVisitOrder: ['combat01', 'combat02', 'combat03', 'combat05', 'combat09', 'combat10'],
      declarationOpenSlotKeys: [
        'combat01',
        'combat02',
        'combat03',
        'combat05',
        'combat09',
        'combat10',
        'combat11',
        'combat23',
      ],
    });
    const result = moveHubBoardRoom(ranking, 6, {
      kind: 'removeFromVisits',
      slotKey: 'combat03',
    });

    expect(result?.proposedVisitOrder).toEqual([
      'combat01',
      'combat02',
      'combat05',
      'combat09',
      'combat10',
      'combat11',
    ]);
    expect(result?.ranking.rankedSlotKeys).toEqual([
      'combat01',
      'combat02',
      'combat05',
      'combat09',
      'combat10',
      'combat11',
      'combat03',
      'combat23',
    ]);
  });

  it('removes a partial visit without leaving an ordinal gap or duplicate slot', () => {
    const ranking = reconcileHubBoardRanking({
      authoredVisitOrder: ['combat01', 'combat02', 'combat03'],
      declarationOpenSlotKeys: ['combat01', 'combat02', 'combat03', 'combat05', 'combat09'],
    });
    const result = moveHubBoardRoom(ranking, 6, {
      kind: 'removeFromVisits',
      slotKey: 'combat02',
    });

    expect(result?.proposedVisitOrder).toEqual(['combat01', 'combat03']);
    expect(result?.ranking.rankedSlotKeys).toEqual([
      'combat01',
      'combat03',
      'combat02',
      'combat05',
      'combat09',
    ]);
    expect(new Set(result?.ranking.rankedSlotKeys).size).toBe(
      result?.ranking.rankedSlotKeys.length,
    );
  });

  it('adds a remaining room at the end of a partial visit prefix', () => {
    const ranking = reconcileHubBoardRanking({
      authoredVisitOrder: ['combat01', 'combat02'],
      declarationOpenSlotKeys: ['combat01', 'combat02', 'combat03', 'combat05'],
    });
    const result = moveHubBoardRoom(ranking, 6, {
      kind: 'addToVisits',
      slotKey: 'combat05',
    });

    expect(result?.proposedVisitOrder).toEqual(['combat01', 'combat02', 'combat05']);
    expect(result?.ranking.rankedSlotKeys).toEqual([
      'combat01',
      'combat02',
      'combat05',
      'combat03',
    ]);
  });

  it('adds a remaining room to a full prefix by moving the prior final visit to the tail', () => {
    const ranking = reconcileHubBoardRanking({
      authoredVisitOrder: ['combat01', 'combat02', 'combat03', 'combat05', 'combat09', 'combat10'],
      declarationOpenSlotKeys: [
        'combat01',
        'combat02',
        'combat03',
        'combat05',
        'combat09',
        'combat10',
        'combat11',
        'combat23',
      ],
    });
    const result = moveHubBoardRoom(ranking, 6, {
      kind: 'addToVisits',
      slotKey: 'combat23',
    });

    expect(result?.proposedVisitOrder).toEqual([
      'combat01',
      'combat02',
      'combat03',
      'combat05',
      'combat09',
      'combat23',
    ]);
    expect(result?.ranking.tailSlotKeys).toEqual(['combat10', 'combat11']);
  });

  it('reorders a full authored prefix through a slot drop', () => {
    const ranking = reconcileHubBoardRanking({
      authoredVisitOrder: ['combat01', 'combat02', 'combat03'],
      declarationOpenSlotKeys: ['combat01', 'combat02', 'combat03', 'combat05'],
    });

    const result = dropHubBoardRoom(ranking, 3, 'combat03', {
      kind: 'beforeSlot',
      slotKey: 'combat01',
    });

    expect(result?.proposedVisitOrder).toEqual(['combat03', 'combat01', 'combat02']);
    expect(result?.ranking.rankedSlotKeys).toEqual([
      'combat03',
      'combat01',
      'combat02',
      'combat05',
    ]);
  });

  it('keeps a tail-to-tail slot drop transient', () => {
    const ranking = reconcileHubBoardRanking({
      authoredVisitOrder: ['combat01', 'combat02'],
      declarationOpenSlotKeys: ['combat01', 'combat02', 'combat03', 'combat05', 'combat09'],
    });

    const result = dropHubBoardRoom(ranking, 6, 'combat09', {
      kind: 'beforeSlot',
      slotKey: 'combat03',
    });

    expect(result?.proposedVisitOrder).toBeUndefined();
    expect(result?.ranking.rankedSlotKeys).toEqual([
      'combat01',
      'combat02',
      'combat09',
      'combat03',
      'combat05',
    ]);
  });

  it('appends a tail room at the compact next-visit target without reordering the prefix', () => {
    const ranking = reconcileHubBoardRanking({
      authoredVisitOrder: ['combat01', 'combat02'],
      declarationOpenSlotKeys: ['combat01', 'combat02', 'combat03', 'combat05'],
    });

    const result = dropHubBoardRoom(ranking, 6, 'combat03', { kind: 'nextVisit' });

    expect(result?.proposedVisitOrder).toEqual(['combat01', 'combat02', 'combat03']);
    expect(result?.ranking.rankedSlotKeys).toEqual([
      'combat01',
      'combat02',
      'combat03',
      'combat05',
    ]);
  });

  it('inserts a tail room into a full prefix and displaces its final member', () => {
    const ranking = reconcileHubBoardRanking({
      authoredVisitOrder: ['combat01', 'combat02', 'combat03'],
      declarationOpenSlotKeys: ['combat01', 'combat02', 'combat03', 'combat05', 'combat09'],
    });

    const result = dropHubBoardRoom(ranking, 3, 'combat09', {
      kind: 'beforeSlot',
      slotKey: 'combat02',
    });

    expect(result?.proposedVisitOrder).toEqual(['combat01', 'combat09', 'combat02']);
    expect(result?.ranking.rankedSlotKeys).toEqual([
      'combat01',
      'combat09',
      'combat02',
      'combat03',
      'combat05',
    ]);
  });

  it('shortens a partial prefix when a prefix room moves into the tail', () => {
    const ranking = reconcileHubBoardRanking({
      authoredVisitOrder: ['combat01', 'combat02', 'combat03'],
      declarationOpenSlotKeys: ['combat01', 'combat02', 'combat03', 'combat05', 'combat09'],
    });

    const result = dropHubBoardRoom(ranking, 6, 'combat02', {
      kind: 'afterSlot',
      slotKey: 'combat05',
    });

    expect(result?.proposedVisitOrder).toEqual(['combat01', 'combat03']);
    expect(result?.ranking.rankedSlotKeys).toEqual([
      'combat01',
      'combat03',
      'combat05',
      'combat02',
      'combat09',
    ]);
  });

  it('promotes the first tail room when a full-prefix room drops after a tail room', () => {
    const ranking = reconcileHubBoardRanking({
      authoredVisitOrder: ['combat01', 'combat02', 'combat03', 'combat05', 'combat09', 'combat10'],
      declarationOpenSlotKeys: [
        'combat01',
        'combat02',
        'combat03',
        'combat05',
        'combat09',
        'combat10',
        'combat11',
        'combat23',
      ],
    });

    const result = dropHubBoardRoom(ranking, 6, 'combat03', {
      kind: 'afterSlot',
      slotKey: 'combat11',
    });

    expect(result?.proposedVisitOrder).toEqual([
      'combat01',
      'combat02',
      'combat05',
      'combat09',
      'combat10',
      'combat11',
    ]);
    expect(result?.ranking.rankedSlotKeys).toEqual([
      'combat01',
      'combat02',
      'combat05',
      'combat09',
      'combat10',
      'combat11',
      'combat03',
      'combat23',
    ]);
  });

  it('rejects same, unknown, and partial direct tail-to-prefix drops', () => {
    const ranking = reconcileHubBoardRanking({
      authoredVisitOrder: ['combat01', 'combat02'],
      declarationOpenSlotKeys: ['combat01', 'combat02', 'combat03', 'combat05'],
    });

    expect(
      dropHubBoardRoom(ranking, 6, 'combat03', {
        kind: 'beforeSlot',
        slotKey: 'combat03',
      }),
    ).toBeUndefined();
    expect(
      dropHubBoardRoom(ranking, 6, 'unknown', {
        kind: 'beforeSlot',
        slotKey: 'combat01',
      }),
    ).toBeUndefined();
    expect(
      dropHubBoardRoom(ranking, 6, 'combat03', {
        kind: 'afterSlot',
        slotKey: 'combat02',
      }),
    ).toBeUndefined();
  });
});
