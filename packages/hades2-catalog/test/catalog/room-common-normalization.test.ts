import { describe, expect, it } from 'vitest';

import { CatalogContractError, createCatalog } from '@run-planner/hades2-catalog';
import { declarations } from '@run-planner/hades2-catalog/test-support';
import { cloneCatalogInput, requireRoom } from './support/catalog-input';

const input = cloneCatalogInput;

describe('room common normalization', () => {
  it('freezes normalized common room fields', () => {
    const room = createCatalog(declarations).rooms.byKey.F_Combat01;
    expect(room).toBeDefined();
    expect(Object.isFrozen(room?.caps)).toBe(true);
    expect(Object.isFrozen(room?.structuralTags)).toBe(true);
    expect(Object.isFrozen(room?.resourcePointSupport)).toBe(true);
  });

  it('rejects unsupported structural tags before collection closure', () => {
    const raw = input();
    const room = requireRoom(raw, 'F_Combat01');
    (room as { structuralTags: unknown }).structuralTags = ['Unknown'];
    expect(() => createCatalog(raw)).toThrow(CatalogContractError);
  });

  it('derives ordinary offer surfaces from each room incoming declaration', () => {
    const compiled = createCatalog(declarations);
    expect(compiled.rooms.byKey.F_Combat01?.offerRewardBinding).toEqual({
      kind: 'incomingReward',
    });
    expect(compiled.rooms.byKey.O_Combat04?.offerRewardBinding).toEqual({ kind: 'none' });
    expect(compiled.rooms.byKey.H_PreBoss01?.offerRewardBinding).toEqual({ kind: 'none' });
  });

  it('normalizes the declared Fields cage group as the selected offer surface', () => {
    const room = createCatalog(declarations).rooms.byKey.H_Combat01;
    expect(room?.offerRewardBinding).toEqual({
      kind: 'localRewardGroup',
      groupKey: 'cages',
    });
    expect(room?.localChildren[0]).toMatchObject({
      kind: 'boundedRewardSlots',
      key: 'cages',
      offerRewardCapability: 'fieldsCages',
    });
  });

  it('rejects missing, non-reward, and optional local group overrides', () => {
    const missing = input();
    const missingRoom = requireRoom(missing, 'H_Combat01');
    (missingRoom as { offerRewardBinding: unknown }).offerRewardBinding = {
      kind: 'localRewardGroup',
      groupKey: 'missing',
    };
    expect(() => createCatalog(missing)).toThrow(CatalogContractError);

    const nonReward = input();
    const nonRewardRoom = requireRoom(nonReward, 'N_Combat01');
    (nonRewardRoom as { offerRewardBinding: unknown }).offerRewardBinding = {
      kind: 'localRewardGroup',
      groupKey: 'sideRooms',
    };
    expect(() => createCatalog(nonReward)).toThrow(CatalogContractError);

    const optional = input();
    const optionalRoom = requireRoom(optional, 'H_Combat01');
    (optionalRoom as { offerRewardBinding: unknown }).offerRewardBinding = {
      kind: 'localRewardGroup',
      groupKey: 'optionalRewards',
    };
    expect(() => createCatalog(optional)).toThrow(CatalogContractError);
  });

  it('rejects an explicit offer binding whose bounded group lacks its capability', () => {
    const raw = input();
    const fields = requireRoom(raw, 'H_Combat01');
    const nonFields = requireRoom(raw, 'N_Combat01');
    const sourceGroup = fields?.localChildren?.find((child) => child.key === 'cages');
    if (sourceGroup?.kind !== 'boundedRewardSlots') {
      throw new Error('bounded-group mutation fixture is missing');
    }
    const copiedGroup = JSON.parse(JSON.stringify(sourceGroup)) as Record<string, unknown>;
    delete copiedGroup.offerRewardCapability;
    (nonFields as { localChildren: unknown }).localChildren = [copiedGroup];
    (nonFields as { offerRewardBinding: unknown }).offerRewardBinding = {
      kind: 'localRewardGroup',
      groupKey: 'cages',
    };

    expect(() => createCatalog(raw)).toThrow(CatalogContractError);
  });
});
