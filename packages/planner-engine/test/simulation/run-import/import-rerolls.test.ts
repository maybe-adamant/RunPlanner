import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import type { ProjectDocument } from '../../../src/authored-project';
import type { RunRecord } from '../../../src/run-record';
import { recordedEntryStates } from '../../../src/simulation/run-import/conformance';
import { projectFromRunRecord, type RunImport } from '../../../src/simulation';
import {
  fixture,
  describeEntry,
  occurrence,
  reward,
  mismatchLines,
} from '../../support/run-import';

describe('run import of door, wheel, cage and Hub rerolls', () => {
  /**
   * The record as if room `roomIndex` had pressed one more door, wheel or cage
   * reroll: its count rises unless a gain hid it from the recorder, the pool
   * falls by one in every later entry save,
   * and `store` changes by `delta` from the next entry save on wherever a save
   * holds it.
   */
  function withReroll(
    record: RunRecord,
    roomIndex: number,
    store: string,
    delta: Readonly<Record<string, number>>,
    counted = true,
  ): RunRecord {
    const states = recordedEntryStates(record);
    return {
      ...record,
      rooms: record.rooms.map((room, index) => {
        if (index === roomIndex)
          return counted ? { ...room, rerolls: (room.rerolls ?? 0) + 1 } : room;
        if (index < roomIndex || room.entry === undefined) return room;
        const entry = {
          ...room.entry,
          ...(room.entry.numRerolls === undefined ? {} : { numRerolls: room.entry.numRerolls - 1 }),
        };
        if (index !== roomIndex + 1 && room.entry.rewardStores?.[store] === undefined)
          return { ...room, entry };
        const counts: Record<string, number> = { ...states[index]!.rewardStores.get(store) };
        for (const [name, change] of Object.entries(delta)) {
          counts[name] = (counts[name] ?? 0) + change;
          if (counts[name]! < 0) throw new Error(`${store} ${name} below zero at room ${index}`);
        }
        return {
          ...room,
          entry: { ...entry, rewardStores: { ...entry.rewardStores, [store]: counts } },
        };
      }),
    };
  }

  /** One complete on-route fill of a store, by reward type. */
  function fill(store: string, routeKey: string): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const entry of catalog.rewards.stores.byKey[store]!.entries)
      if (entry.routeKeys === undefined || entry.routeKeys.includes(routeKey))
        counts[entry.rewardType] = (counts[entry.rewardType] ?? 0) + 1;
    return counts;
  }

  /** Erebus and Oceanus of run 1010, whose F Boss Arcana draw added The Enchantress. */
  function oceanus(): RunRecord {
    const record = fixture('underworld-1010');
    const rooms = record.rooms.slice(0, 25);
    const { exit: _exit, ...last } = rooms[24]!;
    void _exit;
    return {
      ...record,
      route: { biomes: ['F', 'G'], dream: false },
      outcome: { kind: 'abandoned', endingRoom: last.name },
      rooms: [...rooms.slice(0, 24), last],
    };
  }

  /**
   * The Surface victory with The Enchantress held from the start in The Lovers'
   * place, its Epic rank's three rerolls kept in every entry save.
   */
  function surfaceWithEnchantress(roomCount?: number): RunRecord {
    const fixtureRecord = fixture('surface-victory');
    const record: RunRecord = {
      ...fixtureRecord,
      rooms: fixtureRecord.rooms.map((room) => ({
        ...room,
        entry: { ...room.entry, numRerolls: 3 },
      })),
    };
    const loadout = {
      ...record.loadout,
      arcana: record.loadout.arcana.map((card) =>
        card.name === 'ChanneledBlock' ? { name: 'DoorReroll', level: 3 } : card,
      ),
    };
    if (roomCount === undefined) return { ...record, loadout };
    const rooms = record.rooms.slice(0, roomCount);
    const { exit: _exit, ...last } = rooms[roomCount - 1]!;
    void _exit;
    return {
      ...record,
      loadout,
      route: { biomes: ['N'], dream: false },
      outcome: { kind: 'abandoned', endingRoom: last.name },
      rooms: [...rooms.slice(0, -1), last],
    };
  }

  const rerollLines = (imported: RunImport, roomIndex: number) =>
    imported.report.entries
      .filter(
        (entry) =>
          entry.record?.roomIndex === roomIndex ||
          (entry.reason === 'mismatch' && entry.record?.roomIndex === roomIndex + 1),
      )
      .filter(
        (entry) =>
          entry.area === 'reroll' ||
          entry.reason === 'mismatch' ||
          (entry.area === 'wheel' && entry.address?.kind === 'rewardWheel'),
      )
      .map(describeEntry);

  const pressesOf = (project: ProjectDocument, occurrenceId: string) =>
    occurrence(project, occurrenceId).roomActions.order.filter(
      (action) => action.kind === 'reroll',
    );

  it("redraws the first door that can have drawn the store's lost reward", () => {
    const imported = projectFromRunRecord(
      catalog,
      withReroll(oceanus(), 20, 'RunProgress', { MaxHealthDrop: -1 }),
    );
    expect(rerollLines(imported, 20)).toEqual(['assumption reroll r20 occurrence@G-r20']);
    expect(pressesOf(imported.project, 'G-r20')).toEqual([
      {
        kind: 'reroll',
        rerollId: 'r1',
        target: { kind: 'door', exitKey: 'exit1', occurrenceId: 'G-r20-d609579' },
        reward: { rewardType: 'RoomMoneyDrop' },
      },
    ]);
    expect(reward(imported.project, 'G-r20-d609579').offer).toEqual({
      rewardType: 'MaxHealthDrop',
    });
  });

  it('finds a press a gain hid from the recorded count by the pool the plan runs ahead', () => {
    const imported = projectFromRunRecord(
      catalog,
      withReroll(oceanus(), 20, 'RunProgress', { MaxHealthDrop: -1 }, false),
    );
    expect(rerollLines(imported, 20)).toEqual(['assumption reroll r20 occurrence@G-r20']);
    expect(pressesOf(imported.project, 'G-r20')).toHaveLength(1);
  });

  it('reports a pool spend the stores do not show, and the pool it leaves ahead', () => {
    const record = oceanus();
    const imported = projectFromRunRecord(catalog, {
      ...record,
      rooms: record.rooms.map((room, index) =>
        index > 20 && room.entry?.numRerolls !== undefined
          ? { ...room, entry: { ...room.entry, numRerolls: room.entry.numRerolls - 1 } }
          : room,
      ),
    });
    expect(rerollLines(imported, 20)).toEqual([
      'mismatch reroll r20 -',
      'unsupportedArea reroll r20 -',
      'mismatch reroll r21 -',
    ]);
    expect(mismatchLines(imported.report)).toEqual([
      'reroll r20 rerolls: 1 | 0',
      'reroll r21 NumRerolls: 8 | 9',
    ]);
  });

  it('authors recorded Well and Pool rerolls unpinned, placing purchases and sales on the last', () => {
    const record = fixture('underworld');
    const rooms = record.rooms.slice(0, 14);
    const { exit: _exit, ...last } = rooms[13]!;
    void _exit;
    const imported = projectFromRunRecord(catalog, {
      ...record,
      route: { biomes: ['F'], dream: false },
      outcome: { kind: 'abandoned', endingRoom: last.name },
      rooms: [...rooms.slice(0, 13), { ...last, spentRerolls: { WellShop: 1, SellTraits: 1 } }],
    });
    const postboss = occurrence(imported.project, 'F-r11:postboss');
    // The opening stock stays the initial roll; the record keeps no later roll's content.
    expect(postboss.stygianWell?.offerKeyBySlot.secondRight).toBe('TemporaryForcedSecretDoorTrait');
    expect(postboss.roomActions.order.slice(2)).toEqual([
      {
        kind: 'rerollStygianWell',
        rerollId: 'r1',
        offerKeyBySlot: { secondRight: 'TemporaryForcedSecretDoorTrait' },
      },
      { kind: 'rerollPurgingPool', rerollId: 'r1', traitKeyBySlot: { left: 'BoonDecayBoon' } },
      { kind: 'purchaseStygianWellOffer', generationKey: 'r1:secondRight' },
      { kind: 'sellPurgingPoolTrait', slotKey: 'left', rollKey: 'r1' },
    ]);
    expect(
      imported.report.entries
        .filter((entry) => entry.reason === 'assumption' && entry.record?.roomIndex === 13)
        .map(describeEntry),
    ).toEqual(
      expect.arrayContaining([
        'assumption well r13 roomFeature@F-r11:postboss',
        'assumption pool r13 roomFeature@F-r11:postboss',
      ]),
    );
  });

  it('reports a Well reroll in a room whose plan holds no Well', () => {
    const record = oceanus();
    const imported = projectFromRunRecord(catalog, {
      ...record,
      rooms: record.rooms.map((room, index) =>
        index === 20 ? { ...room, spentRerolls: { WellShop: 1 } } : room,
      ),
    });
    expect(rerollLines(imported, 20)).toEqual(['unsupportedArea reroll r20 -']);
  });

  it("solves a bracket whose stores refilled, and keeps the taken door's screen", () => {
    // G_Shop01's MiniBoss doors refill RunProgress; the extra Boon is the taken door's first draw.
    const imported = projectFromRunRecord(
      catalog,
      withReroll(oceanus(), 17, 'RunProgress', { Boon: -1 }),
    );
    expect(rerollLines(imported, 17)).toEqual(['assumption reroll r17 occurrence@G-r17']);
    const entered = occurrence(imported.project, 'G-r18');
    expect(reward(imported.project, 'G-r18').offer).toEqual({
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'AresUpgrade' },
    });
    expect(entered.rerolledIncomingReward).toMatchObject({
      offer: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
      traitOffersByAcquisitionRole: {
        source: { giverKey: 'Zeus', rerolledScreens: [{ options: expect.any(Array) }] },
      },
    });
  });

  it('reports each press when the placement does not reproduce the saved stores', () => {
    // The saves claim a refill the plan's press, with its reward still in store, does not make.
    const imported = projectFromRunRecord(
      catalog,
      withReroll(oceanus(), 20, 'RunProgress', {
        ...fill('RunProgress', 'Underworld'),
        MaxHealthDrop: fill('RunProgress', 'Underworld')['MaxHealthDrop']! - 1,
      }),
    );
    expect(rerollLines(imported, 20)).toEqual([
      'notInRecord reroll r20 roomAction@G-r20',
      expect.stringMatching(/^mismatch stores r21 /),
    ]);
  });

  it('redraws a Fields cage of the door its bracket opened', () => {
    const imported = projectFromRunRecord(
      catalog,
      withReroll(fixture('underworld-1010'), 28, 'RunProgress', { Boon: -1 }),
    );
    expect(rerollLines(imported, 28)).toEqual(['assumption reroll r28 occurrence@H-r28']);
    expect(pressesOf(imported.project, 'H-r28')).toMatchObject([
      {
        target: { kind: 'cage', occurrenceId: 'H-r29', slotKey: 'cage1' },
        reward: { rewardType: 'WeaponUpgrade' },
      },
    ]);
    const fields = occurrence(imported.project, 'H-r29').state;
    expect(fields.kind === 'fieldsCombat' && fields.cages['cage1']?.offer).toMatchObject({
      rewardType: 'Boon',
    });
    expect(fields.kind === 'fieldsCombat' && fields.rerolledCages?.['cage1']).toMatchObject({
      offer: { rewardType: 'WeaponUpgrade' },
      traitOffersByAcquisitionRole: { self: { giverKey: 'WeaponUpgrade' } },
    });
  });

  it("redraws a ship wheel's unpicked offer before the wheel is used", () => {
    const imported = projectFromRunRecord(
      catalog,
      withReroll(surfaceWithEnchantress(), 22, 'MetaProgress', { MetaCurrencyBigDrop: -1 }),
    );
    // The wheel's unpicked offer and the press's replaced draw are solved together. A press on
    // the picked offer, first showing MetaCurrencyBigDrop, loses the same draws, so it is not
    // reported: the plan holds it as a press on the unpicked offer.
    expect(rerollLines(imported, 22)).toEqual([]);
    const ship = occurrence(imported.project, 'O-r22');
    expect(ship.roomActions.order.slice(0, 2)).toEqual([
      {
        kind: 'reroll',
        rerollId: 'r1',
        target: { kind: 'wheelOffer', wheelKey: 'wheel1', offerKey: 'offer2' },
        reward: { rewardType: 'GiftDrop' },
      },
      { kind: 'chooseRewardWheel', wheelKey: 'wheel1' },
    ]);
    expect(ship.state.kind === 'shipCombat' && ship.state.wheels['wheel1']).toMatchObject({
      offers: { offer2: { offer: { rewardType: 'MetaCurrencyBigDrop' } } },
      rerolledOffers: { offer2: { offer: { rewardType: 'GiftDrop' } } },
    });
  });

  it("redraws a Hub board door before the Hub's first visit", () => {
    const imported = projectFromRunRecord(
      catalog,
      withReroll(surfaceWithEnchantress(4), 2, 'HubRewards', { WeaponUpgrade: -1 }),
    );
    expect(rerollLines(imported, 2)).toEqual(['assumption reroll r2 hubDecision@N:hub']);
    const hub = imported.project.route.biomes[0]!.topology!.decisions.find(
      (decision) => decision.kind === 'hub',
    );
    expect(hub?.kind === 'hub' && hub.actions.slice(0, 2)).toEqual([
      {
        kind: 'reroll',
        rerollId: 'r1',
        hubSlotKey: 'combat19',
        reward: { rewardType: 'MaxManaDropBig' },
      },
      { kind: 'roomVisit', hubSlotKey: 'combat03' },
    ]);
    expect(reward(imported.project, 'N-r2-d560620').offer).toEqual({
      rewardType: 'WeaponUpgrade',
    });
  });
  it('redraws a Hub board door in the restored stay whose bracket shows the spend', () => {
    // N_Combat19, never entered, shows MaxManaDropBig until the fourth Hub visit's press.
    const base = withReroll(surfaceWithEnchantress(10), 8, 'HubRewards', { WeaponUpgrade: -1 });
    const record: RunRecord = {
      ...base,
      rooms: base.rooms.map((room, index) =>
        index < 8 || room.name !== 'N_Hub'
          ? room
          : {
              ...room,
              doors: room.doors.map((door) =>
                door.door === 560620 ? { ...door, reward: { type: 'WeaponUpgrade' } } : door,
              ),
            },
      ),
    };
    const imported = projectFromRunRecord(catalog, record);
    expect(rerollLines(imported, 8)).toEqual(['assumption reroll r8 hubDecision@N:hub']);
    const hub = imported.project.route.biomes[0]!.topology!.decisions.find(
      (decision) => decision.kind === 'hub',
    );
    expect(hub?.kind === 'hub' && hub.actions.slice(3, 5)).toEqual([
      { kind: 'roomVisit', hubSlotKey: 'combat21' },
      {
        kind: 'reroll',
        rerollId: 'r1',
        hubSlotKey: 'combat19',
        reward: { rewardType: 'WeaponUpgrade' },
      },
    ]);
    expect(reward(imported.project, 'N-r2-d560620').offer).toEqual({
      rewardType: 'MaxManaDropBig',
    });
  });
  it('reports a door pressed twice in one restored Hub stay', () => {
    // The visit saves one door change, but the stores lose two draws: the first press's is lost.
    const base = withReroll(
      withReroll(surfaceWithEnchantress(10), 8, 'HubRewards', { WeaponUpgrade: -1 }),
      8,
      'HubRewards',
      { MaxHealthDropBig: -1 },
    );
    const record: RunRecord = {
      ...base,
      rooms: base.rooms.map((room, index) =>
        index < 8 || room.name !== 'N_Hub'
          ? room
          : {
              ...room,
              doors: room.doors.map((door) =>
                door.door === 560620 ? { ...door, reward: { type: 'WeaponUpgrade' } } : door,
              ),
            },
      ),
    };
    const imported = projectFromRunRecord(catalog, record);
    expect(rerollLines(imported, 8)).toEqual([
      'unsupportedArea reroll r8 -',
      'unsupportedArea reroll r8 -',
    ]);
    const hub = imported.project.route.biomes[0]!.topology!.decisions.find(
      (decision) => decision.kind === 'hub',
    );
    expect(hub?.kind === 'hub' && hub.actions.some((action) => action.kind === 'reroll')).toBe(
      false,
    );
  });
});
