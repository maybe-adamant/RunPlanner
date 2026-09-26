import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createHubRoomAddress,
  createOccurrenceAddress,
  createOccurrenceId,
} from '../../../src/authored-project';
import { createRouteStartHistoryView } from '../../../src/simulation/history/fold';
import type {
  BiomeHistoryPrefix,
  EncounterHistoryEntry,
} from '../../../src/simulation/history/model';
import type { RoomHistoryOrigin } from '../../../src/simulation/lifecycle';
import { deriveNpcShoppingExecutionPolicy } from '../../../src/simulation/encounters/npc-shopping';

const biome = createBiomeAddress('Underworld', 'F');
const origin = (id: string) => createOccurrenceAddress(biome, createOccurrenceId(id));
const target = origin('target');

function record(owner: RoomHistoryOrigin, key: string, index: number): EncounterHistoryEntry {
  return {
    sequence: index,
    origin: owner,
    gameName: 'test-room',
    encounterEnvelopeKey: 'test',
    slotKey: `phase-${index}`,
    encounterKey: key,
    phaseKind: 'nonCombat',
  };
}

/** Explicit observed history, not a second implementation of native window semantics. */
function history(
  predecessors: readonly { origin: RoomHistoryOrigin; keys: readonly string[] }[],
  protectedKeys: readonly string[],
): BiomeHistoryPrefix {
  const empty = createRouteStartHistoryView();
  const preparation = {
    sequence: 100,
    ledgers: {
      ...empty.ledgers,
      roomAppearances: predecessors.map((room, index) => ({
        sequence: index,
        origin: room.origin,
        gameName: 'test-room',
        surfaceShopPresent: true,
        roomShopPresent: true,
      })),
      encounterRecords: predecessors.flatMap((room, index) =>
        room.keys.map((key) => record(room.origin, key, index)),
      ),
    },
  };
  const current = {
    sequence: 110,
    ledgers: {
      ...preparation.ledgers,
      encounterRecords: [
        ...preparation.ledgers.encounterRecords,
        ...protectedKeys.map((key, index) => record(target, key, 101 + index)),
      ],
    },
  };
  return {
    routeKey: 'Underworld',
    biomeKey: 'F',
    events: [],
    ledgers: current.ledgers,
    viewsBySequence: {},
    biomeStart: empty,
    current,
    rooms: [
      { origin: target, preparation, entry: current, encounterStarts: [], targetGenerations: [] },
    ],
  };
}

const shops = Array.from({ length: 12 }, (_, index) => ({
  origin: origin(`P${12 - index}`),
  keys: ['Shop'],
}));
const ids = (value: BiomeHistoryPrefix) =>
  deriveNpcShoppingExecutionPolicy(catalog, [value]).occurrences.map((row) => row.occurrenceId);

describe('preparation-owned NPC shopping protection', () => {
  it.each([
    ['NemesisCombatF', 'Nemesis', 11],
    ['NemesisCombatG', 'Nemesis', 11],
    ['NemesisCombatH', 'Nemesis', 11],
    ['NemesisCombatI', 'Nemesis', 11],
    ['NemesisRandomEvent', 'Nemesis', 11],
    ['HeraclesCombatN', 'Heracles', 9],
    ['HeraclesCombatO', 'Heracles', 9],
    ['HeraclesCombatP', 'Heracles', 9],
  ] as const)('%s takes native window before occurrence deduplication', (key, family, last) => {
    const policy = deriveNpcShoppingExecutionPolicy(catalog, [history(shops, [key])]);
    expect(policy.occurrences.map((row) => row.occurrenceId)).toEqual(
      Array.from({ length: last }, (_, index) => `P${last - index}`),
    );
    expect(
      policy.occurrences.every(
        (row) => row.suppressedNpcShopping.length === 1 && row.suppressedNpcShopping[0] === family,
      ),
    ).toBe(true);
  });

  it('does not confuse inventories, empty rooms, or other NPC presentation with Shop and requirements', () => {
    expect(
      ids(history([{ origin: origin('well'), keys: ['GeneratedF'] }], ['NemesisCombatF'])),
    ).toEqual([]);
    expect(ids(history(shops, ['ArtemisCombatF', 'GeneratedF']))).toEqual([]);
    expect(ids(history(shops, []))).toEqual([]);
    expect(deriveNpcShoppingExecutionPolicy(catalog, []).occurrences).toEqual([]);
  });

  it('preserves restore and empty Hub appearances before taking the window', () => {
    const restored = { origin: origin('P1'), keys: ['Shop'] };
    const hub = { origin: createHubRoomAddress(biome, 'hub'), keys: [] };
    const policy = history([...shops.slice(0, -1), restored, hub, restored], ['NemesisCombatF']);
    expect(ids(policy)).toEqual(['P9', 'P8', 'P7', 'P6', 'P5', 'P4', 'P3', 'P2', 'P1']);
  });

  it('unions independently prepared protected encounters', () => {
    const policy = deriveNpcShoppingExecutionPolicy(catalog, [
      history(shops, ['HeraclesCombatO']),
      history(shops, ['NemesisCombatH']),
    ]);
    expect(
      policy.occurrences.find((row) => row.occurrenceId === 'P1')?.suppressedNpcShopping,
    ).toEqual(['Nemesis', 'Heracles']);
    expect(
      policy.occurrences.find((row) => row.occurrenceId === 'P11')?.suppressedNpcShopping,
    ).toEqual(['Nemesis']);
    expect(policy.occurrences.some((row) => row.occurrenceId === 'P12')).toBe(false);
  });

  it('does not advance the window for other phases and accepts short or empty history', () => {
    expect(ids(history(shops, ['HeraclesCombatO', 'IcarusCombatO', 'GeneratedO']))).toEqual(
      ids(history(shops, ['HeraclesCombatO'])),
    );
    expect(ids(history([], ['NemesisCombatF']))).toEqual([]);
    expect(ids(history(shops.slice(-1), ['HeraclesCombatN']))).toEqual(['P1']);
  });

  it('keeps preceding-biome shops on the same route and excludes another route', () => {
    const crossBiome = createOccurrenceAddress(
      createBiomeAddress('Underworld', 'G'),
      createOccurrenceId('prior-G'),
    );
    const otherRoute = createOccurrenceAddress(
      createBiomeAddress('Dream', 'F'),
      createOccurrenceId('other-route'),
    );
    expect(
      ids(
        history(
          [
            { origin: crossBiome, keys: ['Shop'] },
            { origin: otherRoute, keys: ['Shop'] },
          ],
          ['NemesisCombatI'],
        ),
      ),
    ).toEqual(['prior-G']);
  });
});
