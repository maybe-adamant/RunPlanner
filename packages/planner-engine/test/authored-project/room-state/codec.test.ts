import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import type { RoomDeclaration } from '@run-planner/engine/catalog-schema';

import { decodeRoomState } from '../../../src/authored-project/room-state/codec';
import { createTestDefaultRoomState as createDefaultRoomState } from '../support/default-room-state';

const path = '$.room.state';

function room(gameName: string): RoomDeclaration {
  const declaration = catalog.rooms.byKey[gameName];
  if (declaration === undefined) throw new Error(`missing ${gameName}`);
  return declaration;
}

function mutable(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function findTraitOffer(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findTraitOffer(entry);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (value === null || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  const children = record.traitOffersByAcquisitionRole;
  if (children !== null && typeof children === 'object') {
    const first = Object.values(children as Record<string, unknown>)[0];
    if (first !== undefined) return first as Record<string, unknown>;
  }
  for (const child of Object.values(record)) {
    const found = findTraitOffer(child);
    if (found !== undefined) return found;
  }
  return undefined;
}

function traitFixture(): {
  readonly declaration: RoomDeclaration;
  readonly state: Record<string, unknown>;
} {
  for (const declaration of catalog.rooms.values) {
    try {
      const state = mutable(
        createDefaultRoomState(catalog, declaration, {
          role: 'ordinary',
          entryActive: true,
        }),
      );
      if (findTraitOffer(state) !== undefined) return { declaration, state };
    } catch {
      // Some declaration-owned state kinds are not ordinary room fixtures.
    }
  }
  throw new Error('catalog has no default trait-offer fixture');
}

describe('persisted authored room-state codec', () => {
  it.each(['H_Combat02', 'O_Combat01', 'N_Combat02'])(
    'decodes the complete %s declaration default',
    (gameName) => {
      const declaration = room(gameName);
      const state = createDefaultRoomState(catalog, declaration, {
        role: 'ordinary',
        entryActive: true,
      });
      expect(
        decodeRoomState(
          state,
          catalog,
          declaration,
          {
            role: 'ordinary',
            entryActive: true,
          },
          path,
        ),
      ).toEqual(state);
    },
  );

  it('preserves dormant Shop inventory while requiring inventory for an active entry', () => {
    const declaration = room('F_Shop01');
    const dormant = createDefaultRoomState(catalog, declaration, {
      role: 'ordinary',
      entryActive: false,
    });
    const active = createDefaultRoomState(catalog, declaration, {
      role: 'ordinary',
      entryActive: true,
    });
    expect(
      decodeRoomState(
        dormant,
        catalog,
        declaration,
        {
          role: 'ordinary',
          entryActive: false,
        },
        path,
      ),
    ).toEqual(dormant);
    expect(
      decodeRoomState(
        active,
        catalog,
        declaration,
        {
          role: 'ordinary',
          entryActive: false,
        },
        path,
      ),
    ).toEqual(active);
    expect(() =>
      decodeRoomState(
        dormant,
        catalog,
        declaration,
        {
          role: 'ordinary',
          entryActive: true,
        },
        path,
      ),
    ).toThrow('$.room.state.shop: is required for an entered shop occurrence');
  });

  it('requires the exact closed Pom role map and rejects it on non-Pom rewards', () => {
    const declaration = room('F_Combat04');
    const raw = mutable(
      createDefaultRoomState(catalog, declaration, {
        role: 'ordinary',
        entryActive: true,
        resolvedStoreKey: 'RunProgress',
      }),
    );
    const reward = raw.reward as Record<string, unknown>;
    reward.offer = { rewardType: 'StackUpgrade' };
    reward.traitOffersByAcquisitionRole = {};

    expect(() =>
      decodeRoomState(raw, catalog, declaration, { role: 'ordinary', entryActive: true }, path),
    ).toThrow('levelResolutionsByAcquisitionRole: is required for this Pom reward');

    reward.levelResolutionsByAcquisitionRole = {
      self: { kind: 'random', targetTraitKey: null },
    };
    expect(() =>
      decodeRoomState(raw, catalog, declaration, { role: 'ordinary', entryActive: true }, path),
    ).toThrow(
      'levelResolutionsByAcquisitionRole.self.targetTraitKey: is not a project document field',
    );

    reward.levelResolutionsByAcquisitionRole = {
      self: { kind: 'choice', offeredTraitKeys: [], selectedTraitKey: null },
      extra: { kind: 'choice', offeredTraitKeys: [], selectedTraitKey: null },
    };
    expect(() =>
      decodeRoomState(raw, catalog, declaration, { role: 'ordinary', entryActive: true }, path),
    ).toThrow('must contain exactly every Pom acquisition role');

    reward.offer = { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } };
    reward.traitOffersByAcquisitionRole = {
      source: {
        giverKey: 'Apollo',
        options: [
          { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
          { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
          { traitKey: 'ApolloCastBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
    };
    reward.levelResolutionsByAcquisitionRole = {};
    expect(() =>
      decodeRoomState(raw, catalog, declaration, { role: 'ordinary', entryActive: true }, path),
    ).toThrow('levelResolutionsByAcquisitionRole: Pom resolutions are not supported');
  });

  it('requires an exact, distinct Shop purchase order over materialized offer keys', () => {
    const declaration = room('F_Shop01');
    const raw = mutable(
      createDefaultRoomState(catalog, declaration, {
        role: 'ordinary',
        entryActive: true,
      }),
    );
    const shop = raw.shop as Record<string, unknown>;

    shop.purchaseOrder = ['Unknown'];
    expect(() =>
      decodeRoomState(raw, catalog, declaration, { role: 'ordinary', entryActive: true }, path),
    ).toThrow('$.room.state.shop.purchaseOrder: Unknown is not a Shop offer');

    shop.purchaseOrder = ['Boon', 'Boon'];
    expect(() =>
      decodeRoomState(raw, catalog, declaration, { role: 'ordinary', entryActive: true }, path),
    ).toThrow('$.room.state.shop.purchaseOrder: Boon is duplicated');

    shop.purchaseOrder = [];
    const offers = shop.offers as Record<string, Record<string, unknown>>;
    (offers.Boon!.reward as Record<string, unknown>).purchased = false;
    expect(() =>
      decodeRoomState(raw, catalog, declaration, { role: 'ordinary', entryActive: true }, path),
    ).toThrow('$.room.state.shop.offers.Boon.reward: unexpected key purchased');
  });

  it('preserves valid Ephyra side-room ownership and rejects an entered dormant side room', () => {
    const declaration = room('N_Combat02');
    const raw = mutable(
      createDefaultRoomState(catalog, declaration, {
        role: 'ordinary',
        entryActive: true,
      }),
    );
    const sideRooms = raw.sideRooms as Record<string, Record<string, unknown>>;
    sideRooms.sideDoor1!.generation = 'generated';
    sideRooms.sideDoor1!.enteredOrdinal = 1;
    expect(
      decodeRoomState(
        raw,
        catalog,
        declaration,
        {
          role: 'ordinary',
          entryActive: true,
        },
        path,
      ),
    ).toMatchObject({
      kind: 'ephyraCombat',
      sideRooms: { sideDoor1: { generation: 'generated', enteredOrdinal: 1 } },
    });

    sideRooms.sideDoor1!.generation = 'notGenerated';
    expect(() =>
      decodeRoomState(
        raw,
        catalog,
        declaration,
        {
          role: 'ordinary',
          entryActive: true,
        },
        path,
      ),
    ).toThrow('$.room.state.sideRooms.sideDoor1.enteredOrdinal: requires a generated side room');
  });

  it.each([
    {
      label: 'Ephyra side rooms',
      gameName: 'N_Combat02',
      field: 'sideRooms',
      requiredKey: 'sideDoor1',
    },
    {
      label: 'Fields cages',
      gameName: 'H_Combat02',
      field: 'cages',
      requiredKey: 'cage1',
    },
    {
      label: 'Ship wheels',
      gameName: 'O_Combat01',
      field: 'wheels',
      requiredKey: 'wheel1',
    },
  ])(
    'rejects unknown and missing declaration-owned $label keys',
    ({ gameName, field, requiredKey }) => {
      const declaration = room(gameName);
      const raw = mutable(
        createDefaultRoomState(catalog, declaration, {
          role: 'ordinary',
          entryActive: true,
        }),
      );
      const keyedValues = raw[field] as Record<string, unknown>;
      keyedValues.unexpected = {};

      expect(() =>
        decodeRoomState(
          raw,
          catalog,
          declaration,
          {
            role: 'ordinary',
            entryActive: true,
          },
          path,
        ),
      ).toThrow(`${path}.${field}.unexpected: is not a project document field`);

      delete keyedValues.unexpected;
      delete keyedValues[requiredKey];
      expect(() =>
        decodeRoomState(
          raw,
          catalog,
          declaration,
          {
            role: 'ordinary',
            entryActive: true,
          },
          path,
        ),
      ).toThrow(`${path}.${field}.${requiredKey}: must be an object`);
    },
  );

  it('rejects malformed Preboss role state at the exact persisted kind path', () => {
    expect(() =>
      decodeRoomState(
        { kind: 'terminalShop' },
        catalog,
        room('F_PreBoss01'),
        { role: 'prebossShop', entryActive: false },
        path,
      ),
    ).toThrow('$.room.state.kind: expected shop, received terminalShop');
  });

  it('rejects a Ship wheel pick beyond its active offer count at the exact leaf path', () => {
    const declaration = room('O_Combat01');
    const raw = mutable(
      createDefaultRoomState(catalog, declaration, {
        role: 'ordinary',
        entryActive: true,
      }),
    );
    const wheels = raw.wheels as Record<string, Record<string, unknown>>;
    wheels.wheel1!.pickedOfferIndex = 4;
    expect(() =>
      decodeRoomState(
        raw,
        catalog,
        declaration,
        {
          role: 'ordinary',
          entryActive: true,
        },
        path,
      ),
    ).toThrow('$.room.state.wheels.wheel1.pickedOfferIndex: must select an active offer');
  });

  it('rejects trait offers with a non-three option cardinality during schema decoding', () => {
    const fixture = traitFixture();
    const offer = findTraitOffer(fixture.state);
    if (offer === undefined) throw new Error('trait fixture did not contain an offer');
    offer.options = (offer.options as unknown[]).slice(0, 2);
    expect(() =>
      decodeRoomState(
        fixture.state,
        catalog,
        fixture.declaration,
        { role: 'ordinary', entryActive: true },
        path,
      ),
    ).toThrow('must contain exactly 3 options');
  });

  it('rejects duplicate trait keys across the three persisted options', () => {
    const fixture = traitFixture();
    const offer = findTraitOffer(fixture.state);
    if (offer === undefined) throw new Error('trait fixture did not contain an offer');
    const options = offer.options as Record<string, unknown>[];
    options[2]!.traitKey = options[0]!.traitKey;
    expect(() =>
      decodeRoomState(
        fixture.state,
        catalog,
        fixture.declaration,
        { role: 'ordinary', entryActive: true },
        path,
      ),
    ).toThrow('is duplicated in the trait offer');
  });

  it('rejects a target on a trait without targeted acquisition', () => {
    const fixture = traitFixture();
    const offer = findTraitOffer(fixture.state);
    if (offer === undefined) throw new Error('trait fixture did not contain an offer');
    const options = offer.options as Record<string, unknown>[];
    options[0]!.targetTraitKey = 'ApolloSpecialBoon';
    expect(() =>
      decodeRoomState(
        fixture.state,
        catalog,
        fixture.declaration,
        { role: 'ordinary', entryActive: true },
        path,
      ),
    ).toThrow('does not target another trait on acquisition');
  });
});
