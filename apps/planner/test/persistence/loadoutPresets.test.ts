import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';

import {
  createBrowserLoadoutPresets,
  decodeLoadoutPresets,
  encodeLoadoutPresets,
} from '@planner/persistence/loadoutPresets';

function memoryStorage(initial?: string) {
  const values = new Map<string, string>(
    initial === undefined ? [] : [['run-planner.loadout-presets', initial]],
  );
  return {
    values,
    storage: () => ({
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    }),
  };
}

describe('loadout presets storage', () => {
  it('keeps presets beside other settings and reads them back in order', () => {
    const { storage, values } = memoryStorage();
    let ids = 0;
    const presets = createBrowserLoadoutPresets(catalog, storage, () => `p${(ids += 1)}`);
    presets.saveArcana({ name: '  Survival  ', cardKeys: ['LastStand', 'BonusHealth'] });
    presets.saveVows({
      name: 'Fear 4',
      ranks: { EnemyDamageShrineUpgrade: 2, BiomeSpeedShrineUpgrade: 0 },
    });
    presets.saveArcana({ name: 'Second', cardKeys: [] });
    presets.rename('arcana', 'p1', 'Survival kit');
    presets.saveArcana({ id: 'p3', name: 'Second', cardKeys: ['ChanneledCast'] });

    const reread = createBrowserLoadoutPresets(catalog, storage).getSnapshot();
    expect(reread).toEqual({
      arcana: [
        { id: 'p1', name: 'Survival kit', cardKeys: ['LastStand', 'BonusHealth'] },
        { id: 'p3', name: 'Second', cardKeys: ['ChanneledCast'] },
      ],
      vows: [{ id: 'p2', name: 'Fear 4', ranks: { EnemyDamageShrineUpgrade: 2 } }],
      dropped: 0,
    });
    expect(JSON.parse(values.get('run-planner.loadout-presets')!).version).toBe(1);

    // A removed preset comes back where it was.
    const [first] = reread.arcana;
    presets.remove('arcana', 'p1');
    presets.restore({ kind: 'arcana', preset: first! }, 0);
    expect(presets.getSnapshot().arcana.map((preset) => preset.id)).toEqual(['p1', 'p3']);
  });

  it('drops what the catalog does not know, and counts it', () => {
    const read = decodeLoadoutPresets(
      catalog,
      JSON.stringify({
        version: 1,
        arcana: [
          { id: 'a', name: 'Mixed', cardKeys: ['LastStand', 'NoSuchCard', 'CardDraw'] },
          { id: 'b', name: '   ', cardKeys: [] },
        ],
        vows: [
          {
            id: 'v',
            name: 'Odd',
            ranks: { EnemyDamageShrineUpgrade: 9, NoSuchVow: 1, ShopPricesShrineUpgrade: 1 },
          },
        ],
      }),
    );
    // CardDraw is automatic, so it cannot be chosen.
    expect(read).toEqual({
      arcana: [{ id: 'a', name: 'Mixed', cardKeys: ['LastStand'] }],
      vows: [{ id: 'v', name: 'Odd', ranks: { ShopPricesShrineUpgrade: 1 } }],
      dropped: 5,
    });
  });

  it.each([
    ['another version', JSON.stringify({ version: 2, arcana: [], vows: [] })],
    ['unreadable text', '{ nope'],
  ])('starts empty from %s, saying something was dropped', (_, json) => {
    expect(decodeLoadoutPresets(catalog, json)).toEqual({ arcana: [], vows: [], dropped: 1 });
  });

  it('starts empty with nothing stored, and keeps changes for the session when storage fails', () => {
    expect(decodeLoadoutPresets(catalog, null)).toEqual({ arcana: [], vows: [], dropped: 0 });
    const presets = createBrowserLoadoutPresets(catalog, () => {
      throw new Error('Storage denied');
    });
    presets.saveVows({ name: 'Session', ranks: {} });
    expect(presets.getSnapshot().vows.map((preset) => preset.name)).toEqual(['Session']);
    expect(encodeLoadoutPresets({ arcana: [], vows: [] })).toBe(
      '{"version":1,"arcana":[],"vows":[]}',
    );
  });
});
