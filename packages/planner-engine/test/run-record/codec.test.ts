import { readFileSync } from 'node:fs';

import { format, resolveConfig } from 'prettier';
import { describe, expect, it } from 'vitest';

import {
  decodeRunRecord,
  encodeRunRecord,
  RunRecordCodecError,
} from '@run-planner/engine/run-record';

const fixtures = ['surface', 'underworld', 'underworld-1010', 'surface-victory'].map((name) => {
  const url = new URL(`./fixtures/${name}.run-record.json`, import.meta.url);
  return { name, path: url.pathname, bytes: readFileSync(url, 'utf8') };
});

function minimal(): Record<string, unknown> {
  return {
    recordVersion: 1,
    run: { runCount: 3, startedAt: 1_700_000_000 },
    route: { biomes: ['F'], dream: false },
    outcome: { kind: 'death', endingRoom: 'F_Combat01', runResult: 2 },
    loadout: {
      weapon: 'WeaponStaffSwing',
      arcana: [{ name: 'StartingGold', level: 3 }],
      vows: { EnemySpeedShrineUpgrade: 0 },
      startingGold: 300,
      startingTraits: [{ name: 'HadesChronosDebuffBoon', worldTime: 10.11 }],
    },
    rooms: [
      {
        name: 'F_Opening01',
        doors: [{ door: 1, room: 'F_Combat01', reward: { type: 'Boon', lootName: 'ZeusUpgrade' } }],
        exit: 'F_Combat01',
        encounters: [],
        uses: {},
        traitScreens: [],
        traits: { acquired: [], removed: [], upgraded: [] },
      },
      {
        name: 'F_Combat01',
        doors: [],
        encounters: [{ name: 'GeneratedF' }],
        uses: { ZeusUpgrade: 1 },
        traitScreens: [],
        traits: { acquired: [], removed: [], upgraded: [] },
      },
    ],
  };
}

function rejects(mutate: (record: Record<string, unknown>) => void, message: RegExp): void {
  const record = minimal();
  mutate(record);
  expect(() => decodeRunRecord(record)).toThrow(RunRecordCodecError);
  expect(() => decodeRunRecord(record)).toThrow(message);
}

function room(record: Record<string, unknown>, index: number): Record<string, unknown> {
  return (record.rooms as Record<string, unknown>[])[index]!;
}

describe('run record codec', () => {
  it.each(fixtures)('round-trips the $name capture fixture byte for byte', async (fixture) => {
    const decoded = decodeRunRecord(JSON.parse(fixture.bytes));
    const options = await resolveConfig(fixture.path);
    const formatted = await format(encodeRunRecord(decoded), {
      ...options,
      filepath: fixture.path,
    });
    expect(formatted).toBe(fixture.bytes);
  });

  it('accepts a minimal record', () => {
    expect(decodeRunRecord(minimal()).rooms.map((entry) => entry.name)).toEqual([
      'F_Opening01',
      'F_Combat01',
    ]);
    const skipped = minimal();
    (room(skipped, 1).encounters as Record<string, unknown>[])[0]!.skipped = true;
    expect(decodeRunRecord(skipped).rooms[1]?.encounters[0]).toEqual({
      name: 'GeneratedF',
      skipped: true,
    });
  });

  it('rejects unknown fields at every level', () => {
    rejects((record) => (record.extra = 1), /run record contains unknown field extra/);
    rejects((record) => (room(record, 0).highlight = 'x'), /unknown field highlight/);
    rejects(
      (record) => ((room(record, 1).encounters as Record<string, unknown>[])[0]!.seed = 4),
      /encounters\[0\] contains unknown field seed/,
    );
    rejects(
      (record) => ((record.loadout as Record<string, unknown>).aspectKey = 'StaffClearCastAspect'),
      /loadout contains unknown field aspectKey/,
    );
  });

  it('rejects malformed values', () => {
    rejects((record) => (record.recordVersion = 2), /recordVersion is unsupported/);
    rejects(
      (record) => delete (record.run as Record<string, unknown>).runCount,
      /runCount is required/,
    );
    rejects(
      (record) => (room(record, 1).uses = { ZeusUpgrade: 0 }),
      /uses.ZeusUpgrade must be an integer >= 1/,
    );
    rejects((record) => (record.rooms = []), /rooms must not be empty/);
    rejects(
      (record) =>
        (room(record, 0).traitScreens = [
          { giver: 'ZeusUpgrade', options: [{ name: 'ZeusWeaponBoon', chosen: 'true' }] },
        ]),
      /chosen must be a boolean/,
    );
    rejects(
      (record) => ((room(record, 1).encounters as Record<string, unknown>[])[0]!.skipped = false),
      /encounters\[0\].skipped must be true when present/,
    );
    rejects(
      (record) => (room(record, 1).grantedArcana = ['DoorReroll', 'DoorReroll']),
      /grantedArcana must not repeat a card/,
    );
    rejects((record) => (room(record, 1).rerolls = 0), /rerolls must be an integer >= 1/);
  });

  it("keeps each room's entry save on every room or none", () => {
    const withEntries = minimal();
    room(withEntries, 0).entry = {
      traits: {
        ZeusWeaponBoon: { rarity: 'Rare', level: 2 },
        ChaosDashCurse: { remainingUses: 3 },
      },
      keepsake: 'GoldifyKeepsake',
      rewardStores: { RunProgress: { Boon: 3 }, Secrets: {} },
      bannedTraits: ['HeraManaBoon', 'ZeusSprintBoon'],
      investedTalents: ['1:1', '2:1'],
    };
    room(withEntries, 1).entry = {};
    expect(decodeRunRecord(withEntries).rooms.map((entry) => entry.entry)).toEqual([
      room(withEntries, 0).entry,
      {},
    ]);
    rejects((record) => (room(record, 0).entry = {}), /rooms must all carry an entry save or none/);
    const entry = (value: Record<string, unknown>) => (record: Record<string, unknown>) => {
      room(record, 0).entry = value;
      room(record, 1).entry = {};
    };
    rejects(entry({ bannedTraits: ['ZeusSprintBoon', 'HeraManaBoon'] }), /sorted without repeats/);
    rejects(entry({ investedTalents: ['1-1'] }), /must be depth:slot/);
    rejects(entry({ metaConversionUses: 0 }), /metaConversionUses must be an integer >= 1/);
    rejects(entry({ lostTraits: [] }), /lostTraits must not be empty/);
    rejects(entry({ traits: { ZeusWeaponBoon: { level: 0 } } }), /level must be an integer >= 1/);
    rejects(entry({ elements: { Air: 0 } }), /elements.Air must be an integer >= 1/);
  });

  it("keeps an acquired trait's saved values as finite numbers by dotted save path", () => {
    const acquire = (savedValues: unknown) => (record: Record<string, unknown>) =>
      ((room(record, 1).traits as Record<string, unknown>).acquired = [
        { name: 'ChaosDashCurse', remainingUses: 5, savedValues },
      ]);
    const saved = minimal();
    acquire({
      'OnWeaponFiredFunctions.FunctionArgs.Cost': 19,
      'OnExpire.TraitData.PropertyChanges.1.ChangeValue': 0.77,
    })(saved);
    expect(decodeRunRecord(saved).rooms[1]?.traits.acquired[0]?.savedValues).toEqual({
      'OnWeaponFiredFunctions.FunctionArgs.Cost': 19,
      'OnExpire.TraitData.PropertyChanges.1.ChangeValue': 0.77,
    });
    rejects(acquire({}), /savedValues must hold 1 to 256 entries/);
    rejects(acquire({ 'PropertyChanges.0.ChangeValue': 1 }), /must be a dotted save-table path/);
    rejects(acquire({ 'Cost.': 1 }), /must be a dotted save-table path/);
    rejects(acquire({ Cost: '19' }), /savedValues.Cost must be finite/);
  });

  it('keeps the visit chain and outcome consistent', () => {
    rejects((record) => (room(record, 0).exit = 'F_Combat02'), /exit must name the next room/);
    rejects((record) => (room(record, 1).exit = 'F_Combat02'), /rooms\[1\].exit must be absent/);
    rejects(
      (record) => ((record.outcome as Record<string, unknown>).endingRoom = 'F_Opening01'),
      /endingRoom must name the last room/,
    );
    rejects(
      (record) => (record.outcome = { kind: 'abandoned', endingRoom: 'F_Combat01', runResult: 2 }),
      /runResult must be absent for an abandoned run/,
    );
    rejects(
      (record) => (record.outcome = { kind: 'victory', endingRoom: 'F_Combat01' }),
      /runResult is required for a finished run/,
    );
  });

  it('keys Hex tree nodes by depth from 1 and slot from 0', () => {
    const spell = (key: string) => ({
      name: 'MoonBeam',
      talents: { [key]: { name: 'MoonBeamDamageTalent', invested: true } },
    });
    const record = minimal();
    room(record, 1).spell = spell('3:0');
    expect(decodeRunRecord(record).rooms[1]?.spell?.talents['3:0']).toBeDefined();
    rejects((next) => (room(next, 1).spell = spell('0:2')), /must be keyed depth:slot/);
  });

  it('keeps store, wheel and delivery facts coherent', () => {
    const stock = [{ slot: 1, name: 'ArmorBoost' }];
    rejects(
      (record) => (room(record, 1).store = { kind: 'worldShop', stock, purchases: [{ slot: 2 }] }),
      /unknown slot 2/,
    );
    rejects(
      (record) =>
        (room(record, 1).store = { kind: 'hermesShrine', stock, purchases: [{ slot: 1 }] }),
      /needs a delivery at the Hermes Shrine/,
    );
    rejects(
      (record) =>
        (room(record, 1).store = {
          kind: 'worldShop',
          stock,
          purchases: [{ slot: 1, delivery: 'rushed' }],
        }),
      /delivery facts belong to the Hermes Shrine/,
    );
    rejects(
      (record) =>
        (room(record, 1).store = {
          kind: 'hermesShrine',
          stock,
          purchases: [{ slot: 1, delivery: 'rushed', delay: 2 }],
        }),
      /delay belongs to a delayed delivery/,
    );
    rejects(
      (record) =>
        (room(record, 1).store = {
          kind: 'worldShop',
          stock,
          purchases: [{ slot: 1 }, { slot: 1 }],
        }),
      /repeats slot 1/,
    );
    rejects(
      (record) =>
        (room(record, 1).store = { kind: 'worldShop', stock, unstockedPurchases: ['HealDrop'] }),
      /unstockedPurchases belongs to the Stygian Well/,
    );
    const refill = (purchases: unknown[], purchase?: unknown) => ({
      kind: 'hermesShrine',
      stock,
      purchases,
      refill: {
        option: { slot: 1, name: 'MaxManaDrop' },
        ...(purchase === undefined ? {} : { purchase }),
      },
    });
    rejects(
      (record) => (room(record, 1).store = refill([{ slot: 1, delivery: 'delayed' }])),
      /refill must take a rushed slot/,
    );
    rejects(
      (record) => (room(record, 1).store = refill([{ slot: 1, delivery: 'rushed' }], { slot: 1 })),
      /purchase must be the option's delayed purchase/,
    );
    expect(() =>
      decodeRunRecord({
        ...minimal(),
        rooms: [
          room(minimal(), 0),
          {
            ...room(minimal(), 1),
            store: refill([{ slot: 1, delivery: 'rushed' }], {
              slot: 1,
              delivery: 'delayed',
              delay: 3,
            }),
          },
        ],
      }),
    ).not.toThrow();
    const slots = [{ slot: 2, name: 'AresCastBoon' }];
    rejects(
      (record) => (room(record, 1).pool = { slots, soldSlots: [2], sales: 1 }),
      /soldSlots names a slot still offered/,
    );
    rejects(
      (record) => (room(record, 1).pool = { slots, soldSlots: [1, 3], sales: 1 }),
      /sales must cover soldSlots/,
    );
    const cage = (openedAt?: number) => ({
      reward: { type: 'Boon' },
      encounter: { name: 'GeneratedH' },
      ...(openedAt === undefined ? {} : { openedAt }),
    });
    rejects(
      (record) =>
        (room(record, 1).fields = {
          cageOrder: 'opening',
          cages: [cage(9), cage()],
          optionalRewards: [],
        }),
      /cages must follow their opening times/,
    );
    rejects(
      (record) =>
        (room(record, 1).fields = {
          cageOrder: 'opening',
          cages: [cage(9), cage(4)],
          optionalRewards: [],
        }),
      /cages must follow their opening times/,
    );
    rejects(
      (record) =>
        (room(record, 1).wheels = [
          { store: 'RunProgress', picked: { type: 'Boon' }, offers: 1, side: 'left' },
        ]),
      /side requires two offers/,
    );
    rejects(
      (record) =>
        (room(record, 1).wheels = [
          { store: 'RunProgress', picked: { type: 'Boon' }, unpicked: { type: 'MaxManaDrop' } },
        ]),
      /unpicked requires two offers/,
    );
  });
});
