import { beforeAll, describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createRewardWheelOfferAddress,
  type OccurrenceId,
  type ProjectCommand,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';
import { projectFromRunRecord, type RunImport } from '../src/import';
import type { RunImportReportEntry } from '../src/report';
import type { RunRecord, RunRecordWheel } from '../src/run-record';
import { RunImportWalk } from '../src/import';
import {
  fixture,
  describeEntry,
  occurrence,
  reward,
  grouped,
  entryLines,
  mismatchLines,
  enteredRooms,
  generatedCustomizations,
  expectReachesLastRoom,
} from './support/run-import';

/** The reward types an occurrence's Artificer replacements hold. */
const artificerReplacements = (project: ProjectDocument, occurrenceId: string) =>
  Object.entries(occurrence(project, occurrenceId).acquisitionSites ?? {})
    .filter(([siteKey]) => siteKey.includes('artificerSource:'))
    .flatMap(([, site]) => Object.values(site.pickupEntries ?? {}))
    .map((entry) => entry?.offer.rewardType);

describe('run import of the Surface capture', () => {
  const record = fixture('surface');
  let imported: RunImport;
  beforeAll(() => {
    imported = projectFromRunRecord(catalog, record);
  });

  it('pins every Ephyra phantom exit to the return door of its first visit', () => {
    const exits = imported.project.route.biomes
      .flatMap((biome) => biome.topology?.occurrences ?? [])
      .flatMap((occurrence) =>
        occurrence.phantomExit === undefined
          ? []
          : [[occurrence.gameName, occurrence.phantomExit] as const],
      );
    expect(Object.fromEntries(exits)).toMatchObject({
      N_Sub01: { placeholderRoomGameName: 'N_Sub04', rewardType: 'RoomMoneyTinyDrop' },
      N_Combat02: { placeholderRoomGameName: 'N_PreBoss01', rewardType: null },
      N_Combat14: { placeholderRoomGameName: 'N_Combat19', rewardType: 'Boon' },
      N_MiniBoss02: { placeholderRoomGameName: 'N_Shop01', rewardType: null },
    });
  });

  it('enters every recorded room, Hub returns included, and stops at the unseen Postboss Shrine', () => {
    // The run ended in O_Boss02; no save shows the Postboss Shrine's stock, so the plan stops there.
    expectReachesLastRoom(imported);
    expect(enteredRooms(imported.project, 'incomplete')).toEqual([
      ...record.rooms.map((room) => room.name),
      'O_PostBoss01',
    ]);
  });

  it('imports the Hub board, its visit order and the fountain use', () => {
    const hub = imported.project.route.biomes[0]!.topology!.decisions.find(
      (decision) => decision.kind === 'hub',
    );
    expect(
      hub?.kind === 'hub' && hub.openTargets.map((target) => target.hubSlotKey).sort(),
    ).toEqual([
      'combat01',
      'combat02',
      'combat04',
      'combat06',
      'combat10',
      'combat14',
      'combat16',
      'combat22',
      'combat23',
      'miniBoss02',
    ]);
    expect(hub?.kind === 'hub' && hub.actions).toEqual([
      { kind: 'roomVisit', hubSlotKey: 'combat02' },
      { kind: 'roomVisit', hubSlotKey: 'combat14' },
      { kind: 'roomVisit', hubSlotKey: 'combat06' },
      { kind: 'useFountain' },
      { kind: 'roomVisit', hubSlotKey: 'combat10' },
      { kind: 'roomVisit', hubSlotKey: 'combat01' },
      { kind: 'roomVisit', hubSlotKey: 'miniBoss02' },
    ]);
  });

  it('imports Hermes Shrine purchases, rushes and the Reprieve fountain', () => {
    const reprieve = occurrence(imported.project, 'O-r24');
    expect(reprieve.hermesShrine).toMatchObject({
      // A delayed purchase's recorded delay belongs to its item.
      offerBySlot: {
        first: { rewardType: 'ArmorBoost', delay: 8 },
        secondLeft: { rewardType: 'MaxHealthDrop' },
        secondRight: { rewardType: 'ShopHermesUpgrade' },
      },
    });
    expect(reprieve.roomActions.order).toEqual(
      expect.arrayContaining([
        { kind: 'useFountain' },
        { kind: 'purchaseHermesShrineOffer', generationKey: 'initial:secondRight', rushed: true },
      ]),
    );
  });

  it('places gathering points and reads an offered side room reward from its door', () => {
    expect(imported.project.route.resourcePlacements).toMatchObject({
      Pickaxe: { biomeKey: 'O', occurrenceId: 'O-r23' },
      Fishing: { biomeKey: 'N', occurrenceId: 'N:start' },
    });
    // N_Combat10 offered its N_Sub09 door (sideDoor2) without entering it; N_Sub05 stayed shut.
    expect(reward(imported.project, 'N-r11-sideDoor2').offer).toEqual({
      rewardType: 'RoomMoneyDrop',
    });
  });

  it('generates every side room its main room offered, entered or not', () => {
    // N_Combat06 as if its save had also offered N_Sub10's door.
    const offered = projectFromRunRecord(catalog, {
      ...record,
      rooms: record.rooms.map((room, index) =>
        index === 9
          ? {
              ...room,
              doors: [
                ...room.doors,
                { door: 558378, room: 'N_Sub10', reward: { type: 'RoomMoneyDrop' } },
              ],
            }
          : room,
      ),
    });
    const sideRooms = offered.project.route.biomes
      .flatMap((biome) => biome.topology?.decisions ?? [])
      .find((decision) => decision.kind === 'localVisit' && decision.sourceOccurrenceId === 'N-r9');
    expect(sideRooms?.kind === 'localVisit' && sideRooms.targetsBySlot).toMatchObject({
      sideDoor1: { generation: 'generated' },
      sideDoor2: { generation: 'notGenerated' },
    });
  });

  it('takes the Trial god whose screen opened first as the chosen one', () => {
    // The door lists Poseidon then Apollo; Apollo's screen opened before the fight.
    expect(reward(imported.project, 'O-r26').offer).toEqual({
      rewardType: 'Devotion',
      payload: {
        kind: 'DevotionPair',
        chosenSource: 'ApolloUpgrade',
        spurnedSource: 'PoseidonUpgrade',
      },
    });
  });

  it('leaves the report and its retractions as they were after a probe', () => {
    const entries: RunImportReportEntry[] = [];
    const walk = new RunImportWalk(
      catalog,
      record,
      simulateProjectAssembly(catalog, imported.project),
      entries,
    );
    const { context } = walk;
    const before = walk.assembly;
    const offer = createRewardWheelOfferAddress(
      createBiomeAddress('Surface', 'O'),
      'O-r25' as OccurrenceId,
      'wheel1',
      'offer2',
    );
    const ship = occurrence(imported.project, 'O-r25').state;
    const solved = ship.kind === 'shipCombat' ? ship.wheels['wheel1']?.offers['offer2'] : undefined;
    const withdrawal: RunImportReportEntry = {
      area: 'wheel',
      reason: 'assumption',
      address: offer,
      record: { roomIndex: 25, visit: 0 },
    };
    context.retractable(
      [offer],
      { kind: 'ReplaceRewardWheelOffer', offer, value: solved!.offer },
      withdrawal,
    );
    // The MetaProgress wheel cannot offer Gold: the finding it reveals is withdrawn as registered.
    const unavailable: ProjectCommand = {
      kind: 'ReplaceRewardWheelOffer',
      offer,
      value: { rewardType: 'RoomMoneyDrop' },
    };
    expect(context.probe(() => context.transaction(() => context.apply(unavailable)))).toBe(true);
    expect(walk.assembly).toBe(before);
    expect(entries).toEqual([]);
    // The retraction survives the probe: outside one, the same finding still withdraws it.
    expect(context.transaction(() => context.apply(unavailable))).toBe(true);
    expect(entries).toEqual([{ ...withdrawal, reason: 'refused' }]);
  });

  it("uses N_PostBoss01's fountain after the Phial its rack equipped there", () => {
    // The rack's keepsake as the Phial, whose fountain then raised a Common boon.
    const postBoss = record.rooms[19]!;
    const { exit: _exit, ...last } = record.rooms[20]!;
    void _exit;
    const result = projectFromRunRecord(catalog, {
      ...record,
      outcome: { kind: 'abandoned', endingRoom: last.name },
      rooms: [
        ...record.rooms.slice(0, 19),
        {
          ...postBoss,
          keepsakeSwap: { from: 'HadesAndPersephoneKeepsake', to: 'FountainRarityKeepsake' },
          traits: {
            ...postBoss.traits,
            acquired: postBoss.traits.acquired.map((trait) =>
              trait.name === 'GoldifyKeepsake'
                ? { ...trait, name: 'FountainRarityKeepsake' }
                : trait,
            ),
            upgraded: [
              {
                name: 'HighHealthOffenseBoon',
                from: { rarity: 'Common', level: 4 },
                to: { rarity: 'Rare', level: 4 },
                worldTime: 490,
              },
            ],
          },
        },
        last,
      ],
    });
    const room = occurrence(result.project, 'N-r17:postboss');
    const kinds = room.roomActions.order.map((action) => action.kind);
    expect(kinds.indexOf('interactKeepsakeRack')).toBeLessThan(kinds.indexOf('useFountain'));
    expect(room.fountainRarityResult).toEqual({ targetTraitKey: 'HighHealthOffenseBoon' });
  });

  it('imports ship wheels, their conversions and Menace', () => {
    const ship = occurrence(imported.project, 'O-r25').state;
    expect(ship.kind === 'shipCombat' && ship.wheels['wheel1']).toMatchObject({
      storeKey: 'MetaProgress',
      offerCount: 2,
      pickedOfferIndex: 1,
      offers: {
        offer1: { offer: { rewardType: 'MetaCardPointsCommonBigDrop' } },
        offer2: { offer: { rewardType: 'GiftDrop' } },
      },
    });
    expect(ship.kind === 'shipCombat' && ship.wheels['wheel2']?.offers['offer1']).toMatchObject({
      offer: { rewardType: 'SpellDrop' },
      dispositionByAcquisitionRole: { self: { kind: 'timePiece' } },
    });
    // The Artificer replacement is the RunProgress draw the next entry save accepts.
    expect(artificerReplacements(imported.project, 'O-r21')).toEqual(['StackUpgrade']);
    expect(artificerReplacements(imported.project, 'O-r25')).toEqual(['MaxHealthDrop']);
    // N_PreHub01: 10 Carrion and 2 Mudmen rolled, 4 and 1 of them replaced.
    expect(
      occurrence(imported.project, 'N-r1').encounters.customizationByPhase?.['Encounter']?.[
        'generatedComposition'
      ],
    ).toMatchObject({
      menace: [{ waveIndex: 1, conversions: { Carrion: { count: 4 }, Mudman: { count: 1 } } }],
    });
  });

  it("takes the Artificer replacement the saved stores and next entry save accept, not the room's first used type", () => {
    // O_Combat01's Artificer replaced its Meta pickup with StackUpgrade; a Gold use the room
    // also shows comes first in RunProgress order, but the stores lost no Gold.
    const withGold: RunRecord = {
      ...record,
      rooms: record.rooms.map((room, index) =>
        index === 21 ? { ...room, uses: { ...room.uses, RoomMoneyDrop: 1 } } : room,
      ),
    };
    const result = projectFromRunRecord(catalog, withGold);
    expect(artificerReplacements(result.project, 'O-r21')).toEqual(['StackUpgrade']);
    expect(
      result.report.entries
        .filter((entry) => entry.record?.roomIndex === 21 && entry.area === 'conversion')
        .map(describeEntry),
    ).toEqual([]);
    expect(result.report.rooms?.[21]).toMatchObject({ verdict: 'accepted' });
  });

  /** O_Combat05 as if its wheels, in `order`, had used one side each: the record no longer says which. */
  const mixedCombat05 = (order: readonly number[]): RunRecord => ({
    ...record,
    rooms: record.rooms.map((room, index) =>
      index === 25
        ? {
            ...room,
            uses: {
              ...Object.fromEntries(
                Object.entries(room.uses).filter(([name]) => name !== 'ShipsSteeringWheelLeft'),
              ),
              ShipsSteeringWheelLeft: 1,
              ShipsSteeringWheelRight: 1,
            },
            wheels: order.map((at): RunRecordWheel => {
              const { store, picked, offers } = room.wheels![at]!;
              return { store, picked, ...(offers === undefined ? {} : { offers }) };
            }),
          }
        : room,
    ),
  });

  it.each([
    ['the converted MetaProgress wheel first', [0, 1]],
    ['the RunProgress wheel first', [1, 0]],
  ])(
    "stops at O_Combat05's split with %s, whose picked Spell screen no record answers",
    (_name, order) => {
      // Neither side is saved, so the Time Piece waits for the wheel solve and the picked
      // Spell asks its screen before the window closes; no save judges an answer there.
      const result = projectFromRunRecord(catalog, mixedCombat05(order));
      expect(result.kind).toBe('stopped');
      expect(result.kind === 'stopped' && result.stop).toMatchObject({
        area: 'traitOffer',
        code: 'traitOfferMissing',
        address: { owner: { kind: 'rewardWheelOffer', occurrenceId: 'O-r25' } },
        record: { roomIndex: 25 },
      });
    },
  );

  it('imports the inverse customization and the recorded boon screen', () => {
    expect(
      occurrence(imported.project, 'N-r11').encounters.customizationByPhase?.['Encounter']?.[
        'generatedComposition'
      ],
    ).toMatchObject({ kind: 'generated', waveCount: 3, highlightKey: 'Mudman' });
    expect(reward(imported.project, 'N-r3').traitOffersByAcquisitionRole['source']).toEqual({
      kind: 'traits',
      giverKey: 'Zeus',
      options: [
        { traitKey: 'ZeusSprintBoon', rarity: 'Common' },
        { traitKey: 'ZeusManaBoltBoon', rarity: 'Common' },
        { traitKey: 'BoltRetaliateBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option3',
      rarificationActions: [],
    });
    expect(generatedCustomizations(imported.project)).toBe(16);
  });

  it('reports every value the record did not answer exactly', () => {
    expect(grouped(imported.report)).toEqual({
      assumption: { menace: 14, roomActionOrder: 5 },
      notInRecord: { menace: 17 },
      stopped: { shop: 1 },
    });
    expect(entryLines(imported.report)).toEqual([
      'assumption menace r1 encounterPhase@N-r1:Encounter -> ReplaceEncounterCustomization(N-r1 generated)',
      'assumption menace r1 encounterPhase@N-r1:Encounter -> ReplaceEncounterCustomization(N-r1 generated)',
      'assumption menace r3 encounterPhase@N-r3:Encounter -> ReplaceEncounterCustomization(N-r3 generated)',
      'assumption menace r3 encounterPhase@N-r3:Encounter -> ReplaceEncounterCustomization(N-r3 generated)',
      'assumption menace r9 encounterPhase@N-r9:Encounter -> ReplaceEncounterCustomization(N-r9 generated)',
      'assumption menace r11 encounterPhase@N-r11:Encounter -> ReplaceEncounterCustomization(N-r11 generated)',
      'assumption menace r11 encounterPhase@N-r11:Encounter -> ReplaceEncounterCustomization(N-r11 generated)',
      'assumption menace r13 encounterPhase@N-r13:Encounter -> ReplaceEncounterCustomization(N-r13 generated)',
      'assumption menace r13 encounterPhase@N-r13:Encounter -> ReplaceEncounterCustomization(N-r13 generated)',
      'assumption menace r21 encounterPhase@O-r21:Combat1 -> ReplaceEncounterCustomization(O-r21 generated)',
      'assumption menace r22 encounterPhase@O-r22:Combat1 -> ReplaceEncounterCustomization(O-r22 generated)',
      'assumption menace r25 encounterPhase@O-r25:Combat1 -> ReplaceEncounterCustomization(O-r25 generated)',
      'assumption menace r25 encounterPhase@O-r25:Combat2 -> ReplaceEncounterCustomization(O-r25 generated)',
      'assumption menace r26 encounterPhase@O-r26:Encounter -> ReplaceEncounterCustomization(O-r26 generated)',
      'assumption roomActionOrder r19 occurrence@N-r17:postboss',
      'assumption roomActionOrder r21 occurrence@O-r21',
      'assumption roomActionOrder r22 occurrence@O-r22',
      'assumption roomActionOrder r24 occurrence@O-r24',
      'assumption roomActionOrder r25 occurrence@O-r25',
    ]);
    // Each Ephyra room's return door draws what the record shows, so the stores agree.
    expect(mismatchLines(imported.report)).toEqual([]);
  });
});
