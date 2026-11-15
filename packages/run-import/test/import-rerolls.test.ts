import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createRewardWheelOfferAddress,
  hubRerollOwner,
  rerolledRewardOf,
  rerollResult,
  resolveRerollTarget,
  roomRerollOwner,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { projectFromRunRecord, type RunImport } from '../src/import';
import type { RunRecord } from '../src/run-record';
import {
  fixture,
  describeEntry,
  occurrence,
  oceanus1010,
  reward,
  mismatchLines,
  withReroll,
} from './support/run-import';

describe('run import of door, wheel, cage and Hub rerolls', () => {
  /** One complete on-route fill of a store, by reward type. */
  function fill(store: string, routeKey: string): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const entry of catalog.rewards.stores.byKey[store]!.entries)
      if (entry.routeKeys === undefined || entry.routeKeys.includes(routeKey))
        counts[entry.rewardType] = (counts[entry.rewardType] ?? 0) + 1;
    return counts;
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

  /** A room's order, each press with its resolved target and the reward its rerolled item drew. */
  const resolvedOrder = (project: ProjectDocument, occurrenceId: string) => {
    const biome = project.route.biomes.find((entry) =>
      entry.topology?.occurrences.some((candidate) => candidate.occurrenceId === occurrenceId),
    )!;
    const topology = biome.topology!;
    return occurrence(project, occurrenceId).roomActions.order.map((action) => {
      if (action.kind !== 'reroll') return action;
      const owner = roomRerollOwner(
        createBiomeAddress(project.route.routeKey, biome.biomeKey),
        topology,
        occurrenceId as OccurrenceId,
        action,
      );
      const reward = rerollResult(topology, owner, action.rerollId);
      return {
        ...action,
        target: resolveRerollTarget(topology, action) ?? action.target,
        ...(reward === undefined ? {} : { reward }),
      };
    });
  };

  const pressesOf = (project: ProjectDocument, occurrenceId: string) =>
    resolvedOrder(project, occurrenceId).filter((action) => action.kind === 'reroll');

  /** A biome's Hub actions, each press with the reward its rerolled board door drew. */
  const hubActions = (project: ProjectDocument) => {
    const biome = project.route.biomes[0]!;
    const hub = biome.topology!.decisions.find((decision) => decision.kind === 'hub');
    if (hub?.kind !== 'hub') return [];
    return hub.actions.map((action) => {
      if (action.kind !== 'reroll') return action;
      const reward = rerollResult(
        biome.topology!,
        hubRerollOwner(createBiomeAddress(project.route.routeKey, biome.biomeKey), hub, action),
        action.rerollId,
      );
      return { ...action, ...(reward === undefined ? {} : { reward }) };
    });
  };

  /** What an owner's rerolled item holds: the drawn reward with its outcomes. */
  const rerolledAt = (
    project: ProjectDocument,
    occurrenceId: string,
    owner: Parameters<typeof rerolledRewardOf>[1],
  ) => rerolledRewardOf(occurrence(project, occurrenceId), owner);

  it("redraws the first door that can have drawn the store's lost reward", () => {
    const imported = projectFromRunRecord(
      catalog,
      withReroll(oceanus1010(), 20, 'RunProgress', { MaxHealthDrop: -1 }),
    );
    expect(rerollLines(imported, 20)).toEqual(['assumption reroll r20 occurrence@G-r20']);
    expect(pressesOf(imported.project, 'G-r20')).toEqual([
      {
        kind: 'reroll',
        rerollId: 'r1',
        target: { kind: 'door', exitKey: 'exit1', occurrenceId: 'G-r20-d609581' },
        reward: { rewardType: 'StackUpgrade' },
      },
    ]);
    expect(reward(imported.project, 'G-r20-d609581').offer).toEqual({
      rewardType: 'MaxHealthDrop',
    });
  });

  it('finds a press a gain hid from the recorded count by the pool the plan runs ahead', () => {
    const imported = projectFromRunRecord(
      catalog,
      withReroll(oceanus1010(), 20, 'RunProgress', { MaxHealthDrop: -1 }, false),
    );
    expect(rerollLines(imported, 20)).toEqual(['assumption reroll r20 occurrence@G-r20']);
    expect(pressesOf(imported.project, 'G-r20')).toHaveLength(1);
  });

  /**
   * Erebus of run 1010 through F_MiniBoss02 with The Enchantress held from
   * the start in Channeled Cast's place, its three rerolls kept in every
   * entry save.
   */
  function erebusWithEnchantress(): RunRecord {
    const record = fixture('underworld-1010');
    const rooms = record.rooms.slice(0, 6).map((room) => ({
      ...room,
      entry: { ...room.entry, numRerolls: 3 },
    }));
    const { exit: _exit, ...last } = rooms[5]!;
    void _exit;
    return {
      ...record,
      loadout: {
        ...record.loadout,
        arcana: record.loadout.arcana.map((card) =>
          card.name === 'ChanneledCast' ? { name: 'DoorReroll', level: 3 } : card,
        ),
      },
      route: { biomes: ['F'], dream: false },
      outcome: { kind: 'abandoned', endingRoom: last.name },
      rooms: [...rooms.slice(0, 5), last],
    };
  }

  it("searches a room's door press with its Artificer replacement, not the room's first used type", () => {
    // F_Combat22's Artificer replaced its Gift with Magick; a Max Health use the
    // room also shows would otherwise take the replacement.
    const base = withReroll(erebusWithEnchantress(), 3, 'RunProgress', { MaxHealthDrop: -1 });
    const record: RunRecord = {
      ...base,
      rooms: base.rooms.map((room, index) =>
        index === 3 ? { ...room, uses: { MaxHealthDrop: 1, ...room.uses } } : room,
      ),
    };
    const imported = projectFromRunRecord(catalog, record);
    expect(rerollLines(imported, 3)).toEqual(['assumption reroll r3 occurrence@F-r3']);
    expect(pressesOf(imported.project, 'F-r3')).toEqual([
      {
        kind: 'reroll',
        rerollId: 'r1',
        target: { kind: 'door', exitKey: 'exit1', occurrenceId: 'F-r3-d786704' },
        reward: { rewardType: 'MaxManaDrop' },
      },
    ]);
    expect(
      Object.values(occurrence(imported.project, 'F-r3').acquisitionSites ?? {}).flatMap((site) =>
        Object.values(site?.pickupEntries ?? {}).map((entry) => entry?.offer.rewardType),
      ),
    ).toEqual(['MaxManaDrop']);
    expect(imported.report.rooms?.[3]).toMatchObject({ verdict: 'accepted' });
    expect(mismatchLines(imported.report)).toEqual([]);
  });

  it('stops at a pool spend the stores do not show, reporting the pool it leaves ahead', () => {
    const record = oceanus1010();
    const imported = projectFromRunRecord(catalog, {
      ...record,
      rooms: record.rooms.map((room, index) =>
        index > 20 && room.entry?.numRerolls !== undefined
          ? { ...room, entry: { ...room.entry, numRerolls: room.entry.numRerolls - 1 } }
          : room,
      ),
    });
    expect(imported).toMatchObject({
      kind: 'stopped',
      stop: { area: 'reroll', code: 'entryMismatch', record: { roomIndex: 20 } },
    });
    expect(rerollLines(imported, 20)).toEqual([
      'mismatch reroll r20 -',
      'unsupportedArea reroll r20 -',
      'mismatch reroll r21 -',
      'stopped reroll r20 -',
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
      { kind: 'rerollStygianWell', rerollId: 'r1' },
      { kind: 'rerollPurgingPool', rerollId: 'r1' },
      // Placed rows record the item content they act on.
      {
        kind: 'purchaseStygianWellOffer',
        generationKey: 'r1:secondRight',
        content: ['TemporaryForcedSecretDoorTrait'],
      },
      { kind: 'sellPurgingPoolTrait', slotKey: 'left', rollKey: 'r1', content: ['BoonDecayBoon'] },
    ]);
    expect(postboss.stygianWell?.rerollOfferKeyBySlot).toEqual({
      r1: { secondRight: 'TemporaryForcedSecretDoorTrait' },
    });
    expect(postboss.purgingPool?.rerollTraitKeyBySlot).toEqual({ r1: { left: 'BoonDecayBoon' } });
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
    const record = oceanus1010();
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
      withReroll(oceanus1010(), 17, 'RunProgress', { Boon: -1 }),
    );
    expect(rerollLines(imported, 17)).toEqual(['assumption reroll r17 occurrence@G-r17']);
    expect(reward(imported.project, 'G-r18').offer).toEqual({
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'AresUpgrade' },
    });
    const g = createBiomeAddress('Underworld', 'G');
    expect(
      rerolledAt(
        imported.project,
        'G-r18',
        createIncomingRewardAddress(g, 'G-r18' as OccurrenceId),
      ),
    ).toMatchObject({
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
      withReroll(oceanus1010(), 20, 'RunProgress', {
        ...fill('RunProgress', 'Underworld'),
        MaxHealthDrop: fill('RunProgress', 'Underworld')['MaxHealthDrop']! - 1,
      }),
    );
    expect(rerollLines(imported, 20)).toEqual([
      'notInRecord reroll r20 roomAction@G-r20',
      expect.stringMatching(/^mismatch stores r21 /),
    ]);
  });

  it("redraws the first exit's Fields cage that can have drawn the bracket's lost Boon", () => {
    const imported = projectFromRunRecord(
      catalog,
      withReroll(fixture('underworld-1010'), 28, 'RunProgress', { Boon: -1 }),
    );
    expect(rerollLines(imported, 28)).toEqual(['assumption reroll r28 occurrence@H-r28']);
    expect(pressesOf(imported.project, 'H-r28')).toMatchObject([
      {
        target: { kind: 'cage', occurrenceId: 'H-r28-d565616', slotKey: 'cage1' },
        reward: { rewardType: 'HermesUpgrade' },
      },
    ]);
    const fields = occurrence(imported.project, 'H-r28-d565616').state;
    expect(fields.kind === 'fieldsCombat' && fields.cages['cage1']?.offer).toMatchObject({
      rewardType: 'Boon',
    });
    // The bracket's first exit is H_Combat05, never entered, so its redrawn cage shows no screen.
    expect(
      rerolledAt(
        imported.project,
        'H-r28-d565616',
        createLocalRewardAddress(
          createBiomeAddress('Underworld', 'H'),
          'H-r28-d565616' as OccurrenceId,
          'cages',
          'cage1',
        ),
      ),
    ).toMatchObject({
      offer: { rewardType: 'HermesUpgrade' },
      traitOffersByAcquisitionRole: { self: null },
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
    expect(resolvedOrder(imported.project, 'O-r22').slice(0, 2)).toEqual([
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
    });
    expect(
      rerolledAt(
        imported.project,
        'O-r22',
        createRewardWheelOfferAddress(
          createBiomeAddress('Surface', 'O'),
          'O-r22' as OccurrenceId,
          'wheel1',
          'offer2',
        ),
      )?.offer,
    ).toEqual({ rewardType: 'GiftDrop' });
  });

  it("redraws a Hub board door before the Hub's first visit", () => {
    const imported = projectFromRunRecord(
      catalog,
      withReroll(surfaceWithEnchantress(4), 2, 'HubRewards', { WeaponUpgrade: -1 }),
    );
    expect(rerollLines(imported, 2)).toEqual(['assumption reroll r2 hubDecision@N:hub']);
    expect(hubActions(imported.project).slice(0, 2)).toEqual([
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
    expect(hubActions(imported.project).slice(3, 5)).toEqual([
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
    // Neither press is placed, so the stay's departure keeps both draws and both spends.
    expect(rerollLines(imported, 8)).toEqual([
      'unsupportedArea reroll r8 -',
      'unsupportedArea reroll r8 -',
      'mismatch stores r9 -',
      'mismatch reroll r9 -',
    ]);
    const hub = imported.project.route.biomes[0]!.topology!.decisions.find(
      (decision) => decision.kind === 'hub',
    );
    expect(hub?.kind === 'hub' && hub.actions.some((action) => action.kind === 'reroll')).toBe(
      false,
    );
  });
});
