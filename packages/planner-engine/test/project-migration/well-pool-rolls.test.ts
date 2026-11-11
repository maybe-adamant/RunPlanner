import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  decodeProjectDocument,
  encodeProjectDocument,
  stygianWellPurchasedGenerationKeys,
} from '@run-planner/engine/authored-project';
import { moveWellPoolRollsOntoObjects } from '@run-planner/engine/project-migration';
import { loadUnderworldFStygianWellCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';

type Raw = {
  route: { biomes: { topology: { occurrences: Record<string, unknown>[] } }[] };
};
type RawRoom = Record<string, unknown> & {
  roomActions: { order: Record<string, unknown>[] };
  stygianWell: Record<string, unknown>;
  purgingPool: Record<string, unknown>;
};

const postboss = 'golden-f-preboss-shop:postboss';
const current = () =>
  JSON.parse(encodeProjectDocument(loadUnderworldFStygianWellCheckpoint())) as Raw;
const roomOf = (document: unknown) =>
  (document as Raw).route.biomes[0]!.topology.occurrences.find(
    (room) => room.occurrenceId === postboss,
  ) as RawRoom;

/** The checkpoint's Well and Pool as an earlier 103 build stored them, with rolls on rows. */
function rowShaped(): Raw {
  const document = current();
  const room = roomOf(document);
  const purchases = room.roomActions.order
    .filter((action) => action.kind === 'purchaseStygianWellOffer')
    .map((action) => action.generationKey);
  room.roomActions.order.push(
    {
      kind: 'rerollStygianWell',
      rerollId: 'r1',
      offerKeyBySlot: { healing: 'HealDropRange' },
      twistResultKeyBySlot: { healing: null },
    },
    { kind: 'rerollPurgingPool', rerollId: 'r1', traitKeyBySlot: {} },
    { kind: 'rerollPurgingPool', rerollId: 'r2', traitKeyBySlot: { left: 'ApolloWeaponBoon' } },
  );
  const { travelDealRefillKey, ...well } = room.stygianWell;
  room.stygianWell = {
    ...well,
    travelDealRefillKey,
    twistResultKeyBySlot: { secondLeft: 'HealDropRange', travelDealRefill: null },
    purchasedGenerationKeys: purchases,
  };
  return document;
}

describe('Well and Pool rolls onto their objects', () => {
  it('moves pins and Twist results onto the Well and Pool and drops the purchase list', () => {
    const before = rowShaped();
    const purchases = roomOf(before).stygianWell.purchasedGenerationKeys;
    const after = moveWellPoolRollsOntoObjects(before, catalog);
    const room = roomOf(after);
    expect(room.roomActions.order.slice(-3)).toEqual([
      { kind: 'rerollStygianWell', rerollId: 'r1' },
      { kind: 'rerollPurgingPool', rerollId: 'r1' },
      { kind: 'rerollPurgingPool', rerollId: 'r2' },
    ]);
    expect(room.stygianWell).toEqual({
      offerKeyBySlot: roomOf(current()).stygianWell.offerKeyBySlot,
      rerollOfferKeyBySlot: { r1: { healing: 'HealDropRange' } },
      twistResultKeyByGeneration: {
        'initial:secondLeft': 'HealDropRange',
        travelDealRefill: null,
        'r1:healing': null,
      },
      travelDealRefillKey: roomOf(current()).stygianWell.travelDealRefillKey,
    });
    expect(room.purgingPool).toEqual({
      ...roomOf(current()).purgingPool,
      rerollTraitKeyBySlot: { r2: { left: 'ApolloWeaponBoon' } },
    });
    // The input is untouched, and the purchases are the rows the list duplicated.
    expect(roomOf(before).stygianWell.purchasedGenerationKeys).toBe(purchases);
    const decoded = decodeProjectDocument(after as never, catalog);
    const decodedRoom = decoded.route.biomes[0]!.topology!.occurrences.find(
      (occurrence) => occurrence.occurrenceId === postboss,
    )!;
    expect(stygianWellPurchasedGenerationKeys(decodedRoom.roomActions.order)).toEqual(purchases);
    expect(JSON.parse(encodeProjectDocument(decoded))).toEqual(after);
  });

  it('returns a plan already in that shape, or malformed structure, as it is', () => {
    const document = current();
    expect(moveWellPoolRollsOntoObjects(document, catalog)).toBe(document);
    const moved = moveWellPoolRollsOntoObjects(rowShaped(), catalog);
    expect(moveWellPoolRollsOntoObjects(moved, catalog)).toBe(moved);
    for (const malformed of [null, 'plan', { route: 'not a route' }, { route: { biomes: 1 } }])
      expect(moveWellPoolRollsOntoObjects(malformed, catalog)).toBe(malformed);
  });

  it('leaves a malformed map or list where it is for strict decoding to reject', () => {
    const document = current();
    const room = roomOf(document);
    room.roomActions.order.push(
      { kind: 'rerollStygianWell', rerollId: 'r1', offerKeyBySlot: 'healing' },
      { kind: 'rerollPurgingPool', rerollId: 'r1', traitKeyBySlot: ['left'] },
    );
    room.stygianWell = {
      ...room.stygianWell,
      twistResultKeyBySlot: 3,
      purchasedGenerationKeys: 'all',
    };
    expect(moveWellPoolRollsOntoObjects(document, catalog)).toBe(document);
    expect(() => decodeProjectDocument(document as never, catalog)).toThrow();
    // A well-formed empty pin map pinned nothing and goes.
    const empty = current();
    roomOf(empty).roomActions.order.push({
      kind: 'rerollPurgingPool',
      rerollId: 'r1',
      traitKeyBySlot: {},
    });
    expect(roomOf(moveWellPoolRollsOntoObjects(empty, catalog)).roomActions.order.at(-1)).toEqual({
      kind: 'rerollPurgingPool',
      rerollId: 'r1',
    });
  });
});
