import { beforeAll, describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createRewardWheelOfferAddress,
  type OccurrenceId,
  type ProjectCommand,
} from '../../../src/authored-project';
import type { RunRecord, RunRecordWheel } from '../../../src/run-record';
import { RunImportWalk } from '../../../src/simulation/run-import/import';
import {
  projectFromRunRecord,
  simulateProjectAssembly,
  type RunImport,
  type RunImportReportEntry,
} from '../../../src/simulation';
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
} from '../../support/run-import';

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

  it('completes as a valid plan entering every recorded room, Hub returns included', () => {
    expect(imported.kind).toBe('complete');
    // The run ended in O_Boss02; the plan completes its biome.
    expect(enteredRooms(imported.project)).toEqual([
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
    // N_PreHub01: 10 Carrion and 2 Mudmen rolled, 4 and 1 of them replaced.
    expect(
      occurrence(imported.project, 'N-r1').encounters.customizationByPhase?.['Encounter']?.[
        'generatedComposition'
      ],
    ).toMatchObject({
      menace: [{ waveIndex: 1, conversions: { Carrion: { count: 4 }, Mudman: { count: 1 } } }],
    });
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
    ['the converted MetaProgress wheel first', [0, 1], 1, 2],
    ['the RunProgress wheel first', [1, 0], 2, 1],
  ])(
    "settles O_Combat05's split with %s, its conversions on the authored picks",
    (_name, order, metaPick, runPick) => {
      const result = projectFromRunRecord(catalog, mixedCombat05(order));
      expect(
        result.report.entries
          .filter((entry) => entry.area === 'wheel' && entry.record?.roomIndex === 25)
          .map(describeEntry),
      ).toEqual([]);
      expect(mismatchLines(result.report)).toEqual(mismatchLines(imported.report));
      const ship = occurrence(result.project, 'O-r25').state;
      const wheels = ship.kind === 'shipCombat' ? ship.wheels : {};
      const [meta, run] = order[0] === 0 ? ['wheel1', 'wheel2'] : ['wheel2', 'wheel1'];
      // Left picks go to the first wheel in setup order; Artificer and Time Piece follow them.
      expect(wheels[meta!]).toMatchObject({
        storeKey: 'MetaProgress',
        pickedOfferIndex: metaPick,
        offers: {
          [`offer${metaPick}`]: {
            offer: { rewardType: 'MetaCardPointsCommonBigDrop' },
            dispositionByAcquisitionRole: { self: { kind: 'artificer' } },
          },
          [`offer${3 - metaPick}`]: { offer: { rewardType: 'GiftDrop' } },
        },
      });
      expect(wheels[run!]).toMatchObject({
        storeKey: 'RunProgress',
        pickedOfferIndex: runPick,
        offers: {
          [`offer${runPick}`]: {
            offer: { rewardType: 'SpellDrop' },
            dispositionByAcquisitionRole: { self: { kind: 'timePiece' } },
          },
          [`offer${3 - runPick}`]: { offer: { rewardType: 'MaxManaDrop' } },
        },
      });
      expect(
        result.report.entries
          .filter((entry) => entry.area === 'conversion' && entry.record?.roomIndex === 25)
          .map(describeEntry),
      ).toEqual([
        'assumption conversion r25 acquisitionEntry@O-r25 -> ReplaceAcquisitionEntryOffer(O-r25 MaxHealthDrop)',
      ]);
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
      assumption: { conversion: 2, menace: 14, roomActionOrder: 5 },
      notInRecord: { menace: 17, shop: 8 },
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
      'assumption conversion r21 acquisitionEntry@O-r21 -> ReplaceAcquisitionEntryOffer(O-r21 StackUpgrade)',
      'assumption menace r22 encounterPhase@O-r22:Combat1 -> ReplaceEncounterCustomization(O-r22 generated)',
      'assumption menace r25 encounterPhase@O-r25:Combat1 -> ReplaceEncounterCustomization(O-r25 generated)',
      'assumption menace r25 encounterPhase@O-r25:Combat2 -> ReplaceEncounterCustomization(O-r25 generated)',
      'assumption conversion r25 acquisitionEntry@O-r25 -> ReplaceAcquisitionEntryOffer(O-r25 MaxHealthDrop)',
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
