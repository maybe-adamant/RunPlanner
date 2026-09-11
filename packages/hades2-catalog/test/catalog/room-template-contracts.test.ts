import { describe, expect, it } from 'vitest';

import { CatalogContractError, createCatalog } from '@run-planner/hades2-catalog';
import { declarations } from '@run-planner/hades2-catalog/test-support';
import { cloneCatalogInput } from './support/catalog-input';

const input = cloneCatalogInput;

describe('room template contracts', () => {
  it('rejects an Ephyra combat room without its required SoulPylon', () => {
    const raw = input();
    const room = raw.rooms.find((candidate) => candidate.gameName === 'N_Combat01');
    if (room === undefined) throw new Error('missing N_Combat01 fixture');
    (room as { requiredObjects?: unknown }).requiredObjects = [];
    expect(() => createCatalog(raw)).toThrow(CatalogContractError);
  });

  it('keeps Fields and Ship contracts closed over their encounter envelopes', () => {
    const catalog = createCatalog(declarations);
    expect(catalog.rooms.byKey.H_Combat01?.mode).toEqual({
      kind: 'authored',
      templateKey: 'FieldsCombat',
    });
    expect(catalog.rooms.byKey.N_Combat01?.mode).toEqual({
      kind: 'authored',
      templateKey: 'EphyraCombat',
    });
    expect(catalog.rooms.byKey.O_Combat04?.mode).toEqual({
      kind: 'authored',
      templateKey: 'ShipCombat',
    });
  });

  it('requires spatial declarations only on FieldsCombat rooms and rejects malformed domains', () => {
    const missing = input();
    const missingRoom = missing.rooms.find((room) => room.gameName === 'H_Combat01');
    if (missingRoom === undefined) throw new Error('missing H_Combat01 fixture');
    delete (missingRoom as { fieldsSpatial?: unknown }).fieldsSpatial;
    expect(() => createCatalog(missing)).toThrow(/fieldsSpatial/);

    const misplaced = input();
    const fields = misplaced.rooms.find((room) => room.gameName === 'H_Combat01');
    const ordinary = misplaced.rooms.find((room) => room.gameName === 'F_Combat01');
    if (fields === undefined || ordinary === undefined)
      throw new Error('missing contract fixtures');
    (ordinary as { fieldsSpatial?: unknown }).fieldsSpatial = fields.fieldsSpatial;
    expect(() => createCatalog(misplaced)).toThrow(/only valid for FieldsCombat/);

    const duplicate = input();
    const duplicateRoom = duplicate.rooms.find((room) => room.gameName === 'H_Combat01');
    if (duplicateRoom?.fieldsSpatial === undefined) throw new Error('missing H spatial fixture');
    (duplicateRoom.fieldsSpatial as unknown as { cagePointIds: number[] }).cagePointIds = [
      duplicateRoom.fieldsSpatial.cagePointIds[0]!,
      duplicateRoom.fieldsSpatial.cagePointIds[0]!,
    ];
    expect(() => createCatalog(duplicate)).toThrow(/duplicates/);

    const missingEntryPartner = input();
    const missingEntryRoom = missingEntryPartner.rooms.find(
      (room) => room.gameName === 'H_Combat01',
    );
    if (missingEntryRoom?.fieldsSpatial === undefined) throw new Error('missing H spatial fixture');
    delete (missingEntryRoom.fieldsSpatial.entryPairs[0] as { endPointId?: number }).endPointId;
    expect(() => createCatalog(missingEntryPartner)).toThrow(/endPointId/);
  });

  it('rejects physical domains that cannot satisfy declaration-owned capacities', () => {
    const raw = input();
    const room = raw.rooms.find((candidate) => candidate.gameName === 'H_Combat09');
    if (room === undefined || room.fieldsOptionalRewards === undefined) {
      throw new Error('missing H_Combat09 optional declaration');
    }
    (room.fieldsOptionalRewards as { optionalRewardCapacity: number }).optionalRewardCapacity =
      room.fieldsSpatial?.optionalPointIds.length === undefined
        ? 5
        : room.fieldsSpatial.optionalPointIds.length + 1;
    expect(() => createCatalog(raw)).toThrow(/physical optional point count/);

    const cageOverflow = input();
    const cageRoom = cageOverflow.rooms.find((candidate) => candidate.gameName === 'H_Combat09');
    const cage = (cageRoom?.localChildren ?? []).find(
      (child) => child.kind === 'boundedRewardSlots',
    );
    if (cageRoom?.fieldsSpatial === undefined || cage?.kind !== 'boundedRewardSlots') {
      throw new Error('missing H_Combat09 cage declaration');
    }
    (cage as { maxActiveSlots: number }).maxActiveSlots =
      cageRoom.fieldsSpatial.cagePointIds.length + 1;
    expect(() => createCatalog(cageOverflow)).toThrow(/maxActiveSlots/);
  });
});
