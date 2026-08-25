import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import type { RoomDeclaration } from '@run-planner/engine/catalog-schema';

import { decodeRoomState } from '../../../src/authored-project/room-state/codec';
import { createTestDefaultRoomState as createDefaultRoomState } from '../support/default-room-state';
import { mutable, room, roomStatePath as path } from '../support/room-state-codec';

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
  const declaration = room('F_Combat04');
  const state = mutable(
    createDefaultRoomState(catalog, declaration, {
      role: 'ordinary',
      entryActive: true,
      resolvedStoreKey: 'RunProgress',
    }),
  );
  state.reward = {
    offer: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    dispositionByAcquisitionRole: { source: { kind: 'normal' } },
    traitOffersByAcquisitionRole: {
      source: {
        kind: 'traits',
        giverKey: 'Apollo',
        options: [
          { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
          { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
          { traitKey: 'ApolloCastBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
        rarificationActions: [],
      },
    },
  };
  return { declaration, state };
}

describe('encounter trait-offer child decoder', () => {
  it('accepts sparse Olympian offers and rejects sparse fixed-provider offers during schema decoding', () => {
    const fixture = traitFixture();
    const offer = findTraitOffer(fixture.state);
    if (offer === undefined) throw new Error('trait fixture did not contain an offer');
    offer.options = (offer.options as unknown[]).slice(0, 2);
    expect(
      decodeRoomState(
        fixture.state,
        catalog,
        fixture.declaration,
        { role: 'ordinary', entryActive: true },
        path,
      ),
    ).toMatchObject({});
  });

  it('decodes one, two, and three Olympian options plus exact Fallback Gold shape', () => {
    const fixture = traitFixture();
    const offer = findTraitOffer(fixture.state);
    if (offer === undefined) throw new Error('trait fixture did not contain an offer');
    const options = offer.options as unknown[];
    for (const width of [1, 2, 3]) {
      const raw = mutable(fixture.state);
      const candidate = findTraitOffer(raw)!;
      candidate.options = options.slice(0, width);
      candidate.selectedOptionKey = 'option1';
      expect(
        decodeRoomState(
          raw,
          catalog,
          fixture.declaration,
          { role: 'ordinary', entryActive: true },
          path,
        ),
      ).toMatchObject({});
    }
    const fallback = mutable(fixture.state);
    const fallbackOffer = findTraitOffer(fallback)!;
    for (const key of Object.keys(fallbackOffer)) delete fallbackOffer[key];
    fallbackOffer.kind = 'fallbackGold';
    fallbackOffer.giverKey = offer.giverKey;
    expect(
      decodeRoomState(
        fallback,
        catalog,
        fixture.declaration,
        { role: 'ordinary', entryActive: true },
        path,
      ),
    ).toMatchObject({});
    fallbackOffer.options = [];
    expect(() =>
      decodeRoomState(
        fallback,
        catalog,
        fixture.declaration,
        { role: 'ordinary', entryActive: true },
        path,
      ),
    ).toThrow('is not a project document field');
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
