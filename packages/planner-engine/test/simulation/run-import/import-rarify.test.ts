import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createRouteStartKeepsakeSelectionAddress,
  type ProjectDocument,
} from '../../../src/authored-project';
import type { RunRecord, RunRecordHeldTrait } from '../../../src/run-record';
import { RunImportWalk } from '../../../src/simulation/run-import/import';
import { recordedRarifySpends } from '../../../src/simulation/run-import/rarify';
import {
  projectFromRunRecord,
  simulateProjectAssembly,
  type RunImport,
} from '../../../src/simulation';
import { fixture, describeEntry, occurrence, mismatchLines } from '../../support/run-import';

describe('run import of Rarify clicks and rows a held rarify source logged one rarity high', () => {
  /** The Surface victory through Oceanus' O_Combat12, whose O_Combat07 spent the Conch Shell's one charge. */
  function oceanusOpening(): RunRecord {
    const record = fixture('surface-victory');
    return { ...record, rooms: record.rooms.slice(0, 24) };
  }

  /** `record` with room `roomIndex`'s screen rows renamed or re-rarified, logged as given. */
  function withScreenRows(
    record: RunRecord,
    roomIndex: number,
    rows: Readonly<Record<string, string>>,
  ): RunRecord {
    return {
      ...record,
      rooms: record.rooms.map((room, index) =>
        index !== roomIndex
          ? room
          : {
              ...room,
              traitScreens: room.traitScreens.map((screen) => ({
                ...screen,
                options: screen.options.map((option) => {
                  const rarity = rows[option.name];
                  return rarity === undefined ? option : { ...option, rarity };
                }),
              })),
            },
      ),
    };
  }

  /** `record` with one trait's held row in room `roomIndex`'s entry save replaced. */
  function withHeld(
    record: RunRecord,
    roomIndex: number,
    name: string,
    row: RunRecordHeldTrait,
  ): RunRecord {
    return {
      ...record,
      rooms: record.rooms.map((room, index) =>
        index !== roomIndex || room.entry === undefined
          ? room
          : { ...room, entry: { ...room.entry, traits: { ...room.entry.traits, [name]: row } } },
      ),
    };
  }

  /** `record` with one keepsake renamed from room `fromRoom` on: swap, acquisition and saves. */
  function withKeepsake(record: RunRecord, fromRoom: number, from: string, to: string): RunRecord {
    const rename = (name: string) => (name === from ? to : name);
    return {
      ...record,
      rooms: record.rooms.map((room, index) => {
        if (index < fromRoom) return room;
        const entry = room.entry;
        return {
          ...room,
          ...(room.keepsakeSwap === undefined
            ? {}
            : {
                keepsakeSwap: {
                  ...room.keepsakeSwap,
                  to: rename(room.keepsakeSwap.to),
                },
              }),
          traits: {
            ...room.traits,
            acquired: room.traits.acquired.map((trait) => ({ ...trait, name: rename(trait.name) })),
            removed: room.traits.removed.map(rename),
          },
          ...(entry === undefined
            ? {}
            : {
                entry: {
                  ...entry,
                  ...(entry.keepsake === undefined ? {} : { keepsake: rename(entry.keepsake) }),
                  ...(entry.traits === undefined
                    ? {}
                    : {
                        traits: Object.fromEntries(
                          Object.entries(entry.traits).map(([name, row]) => [rename(name), row]),
                        ),
                      }),
                  ...(entry.lostTraits === undefined
                    ? {}
                    : { lostTraits: entry.lostTraits.map(rename) }),
                },
              }),
        };
      }),
    };
  }

  function screenOffer(imported: RunImport, occurrenceId: string) {
    const state = occurrence(imported.project, occurrenceId).state;
    return state.kind === 'shipCombat'
      ? state.wheels['wheel1']?.offers['offer1']?.traitOffersByAcquisitionRole['source']
      : 'reward' in state
        ? state.reward?.traitOffersByAcquisitionRole['source']
        : undefined;
  }

  function poseidonScreen(imported: RunImport) {
    return imported.report.entries
      .filter((entry) => entry.area === 'traitOffer' && entry.record?.roomIndex === 21)
      .map((entry) => ({
        reason: entry.reason,
        value: entry.applied?.kind === 'ReplaceTraitOffer' ? entry.applied.value : undefined,
      }));
  }

  it("clicks O_Combat07's picked row with the Conch Shell's spent charge", () => {
    // Logged and acquired Rare: rolled Common, rarified once.
    const imported = projectFromRunRecord(catalog, oceanusOpening());
    expect(screenOffer(imported, 'O-r21')).toEqual({
      kind: 'traits',
      giverKey: 'Poseidon',
      options: [
        { traitKey: 'PoseidonCastBoon', rarity: 'Epic' },
        { traitKey: 'PoseidonManaBoon', rarity: 'Epic' },
        { traitKey: 'DoubleRewardBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option3',
      rarificationActions: ['option3'],
    });
    expect(poseidonScreen(imported)).toEqual([]);
    expect(mismatchLines(imported.report)).toEqual([]);
  });

  it('clicks the pick its acquired rarity explains and lowers an unpicked row only the lower rarity admits', () => {
    // Both rows hovered while the charge was left: the pick logs Epic, acquired Rare.
    const imported = projectFromRunRecord(
      catalog,
      withScreenRows(oceanusOpening(), 21, {
        PoseidonCastBoon: 'Heroic',
        DoubleRewardBoon: 'Epic',
      }),
    );
    expect(poseidonScreen(imported)).toEqual([
      {
        reason: 'assumption',
        value: expect.objectContaining({
          giverKey: 'Poseidon',
          options: [
            { traitKey: 'PoseidonCastBoon', rarity: 'Epic' },
            { traitKey: 'PoseidonManaBoon', rarity: 'Epic' },
            { traitKey: 'DoubleRewardBoon', rarity: 'Common' },
          ],
          selectedOptionKey: 'option3',
          rarificationActions: ['option3'],
        }),
      },
    ]);
    expect(mismatchLines(imported.report)).toEqual([]);
  });

  it('keeps the logged pick and reports a charge spent where no screen could take it', () => {
    // The charge is gone at O_Combat07's entry save: spent in O_Intro, which shows no screen.
    const imported = projectFromRunRecord(
      catalog,
      withHeld(oceanusOpening(), 21, 'ForcePoseidonBoonKeepsake', {
        rarity: 'Epic',
        rarityUpgradeUses: 0,
      }),
    );
    expect(screenOffer(imported, 'O-r21')).toMatchObject({
      options: [{}, {}, { traitKey: 'DoubleRewardBoon', rarity: 'Rare' }],
    });
    expect(screenOffer(imported, 'O-r21')).toMatchObject({ rarificationActions: [] });
    expect(mismatchLines(imported.report)).toEqual([
      'keepsake r21 ForcePoseidonBoonKeepsake: 0 | 1',
    ]);
  });

  it('imports a record without saved charges as before, with no click', () => {
    const record = oceanusOpening();
    const legacy: RunRecord = {
      ...record,
      rooms: record.rooms.map((room) =>
        room.entry?.traits === undefined
          ? room
          : {
              ...room,
              entry: {
                ...room.entry,
                traits: Object.fromEntries(
                  Object.entries(room.entry.traits).map(([name, row]) => {
                    const { rarityUpgradeUses: _uses, ...rest } = row;
                    void _uses;
                    return [name, rest];
                  }),
                ),
              },
            },
      ),
    };
    const imported = projectFromRunRecord(catalog, legacy);
    expect(screenOffer(imported, 'O-r21')).toEqual({
      kind: 'traits',
      giverKey: 'Poseidon',
      options: [
        { traitKey: 'PoseidonCastBoon', rarity: 'Epic' },
        { traitKey: 'PoseidonManaBoon', rarity: 'Epic' },
        { traitKey: 'DoubleRewardBoon', rarity: 'Rare' },
      ],
      selectedOptionKey: 'option3',
      rarificationActions: [],
    });
    expect(mismatchLines(imported.report)).toEqual([]);
  });

  it("clicks a Calling Card's picked row once per spent charge, up to Heroic", () => {
    // Calling Card from the start in the Phial's place, through N_Story01: two
    // charges on N_Combat03's pick acquired Epic, one on N_MiniBoss01's acquired Heroic.
    const fixtureRecord = fixture('surface-victory');
    const rooms = fixtureRecord.rooms.slice(0, 12);
    const { exit: _exit, ...last } = rooms[11]!;
    void _exit;
    let record: RunRecord = withKeepsake(
      {
        ...fixtureRecord,
        loadout: { ...fixtureRecord.loadout, keepsake: { name: 'RarifyKeepsake', rarity: 'Epic' } },
        route: { biomes: ['N'], dream: false },
        outcome: { kind: 'abandoned', endingRoom: last.name },
        rooms: [...rooms.slice(0, -1), last],
      },
      0,
      'FountainRarityKeepsake',
      'RarifyKeepsake',
    );
    record = withHeld(record, 0, 'RarifyKeepsake', { rarity: 'Epic', rarityUpgradeUses: 6 });
    record = withHeld(record, 4, 'RarifyKeepsake', { rarity: 'Epic', rarityUpgradeUses: 4 });
    record = withHeld(record, 10, 'RarifyKeepsake', { rarity: 'Epic', rarityUpgradeUses: 3 });
    record = withHeld(record, 10, 'AntiArmorBoon', { rarity: 'Heroic' });
    record = withScreenRows(record, 9, { AntiArmorBoon: 'Heroic' });
    record = {
      ...record,
      rooms: record.rooms.map((room, index) =>
        index !== 9
          ? room
          : {
              ...room,
              traits: {
                ...room.traits,
                acquired: room.traits.acquired.map((trait) =>
                  trait.name === 'AntiArmorBoon' ? { ...trait, rarity: 'Heroic' } : trait,
                ),
              },
            },
      ),
    };
    const imported = projectFromRunRecord(catalog, record);
    expect(screenOffer(imported, 'N-r3')).toMatchObject({
      options: [{ traitKey: 'HeraWeaponBoon', rarity: 'Common' }, {}, {}],
      selectedOptionKey: 'option1',
      rarificationActions: ['option1', 'option1'],
    });
    expect(screenOffer(imported, 'N-r9')).toMatchObject({
      options: [{}, { traitKey: 'AntiArmorBoon', rarity: 'Epic' }, {}],
      selectedOptionKey: 'option2',
      rarificationActions: ['option2'],
    });
    expect(
      mismatchLines(imported.report).filter((line) => line.includes('RarifyKeepsake')),
    ).toEqual([]);
  });

  /**
   * Calling Card from the start in the Phial's place through N_MiniBoss01, with
   * N_Combat08's Zeus screen made Demeter's and Cherished Heirloom picked on
   * N_Combat21's Hera screen, whose Hera Mana row logged `manaLogged`; the
   * Card holds four charges at N_Combat21's entry and `left` at the next.
   */
  function heirloomRoom(manaLogged: string, left: number): RunRecord {
    const fixtureRecord = fixture('surface-victory');
    const rooms = fixtureRecord.rooms.slice(0, 10);
    const { exit: _exit, ...last } = rooms[9]!;
    void _exit;
    const demeter = JSON.parse(
      JSON.stringify(rooms.slice(0, -1)).replace(
        /"(ZeusUpgrade|ZeusSpecialBoon|ZeusManaBoon|FocusLightningBoon)"/g,
        (_match, name: string) =>
          JSON.stringify(
            (
              {
                ZeusUpgrade: 'DemeterUpgrade',
                ZeusSpecialBoon: 'DemeterSpecialBoon',
                ZeusManaBoon: 'DemeterManaBoon',
                FocusLightningBoon: 'DemeterCastBoon',
              } as Readonly<Record<string, string>>
            )[name],
          ),
      ),
    ) as RunRecord['rooms'];
    const heirloom = (name: string) => (name === 'BoonDecayBoon' ? 'KeepsakeLevelBoon' : name);
    let record: RunRecord = withKeepsake(
      {
        ...fixtureRecord,
        loadout: { ...fixtureRecord.loadout, keepsake: { name: 'RarifyKeepsake', rarity: 'Epic' } },
        route: { biomes: ['N'], dream: false },
        outcome: { kind: 'abandoned', endingRoom: last.name },
        rooms: [...demeter, last].map((room, index) => {
          const traits = room.entry?.traits;
          return index === 7
            ? {
                ...room,
                traitScreens: room.traitScreens.map((screen) => ({
                  ...screen,
                  options: screen.options.map((option) =>
                    option.name === 'BoonDecayBoon'
                      ? { ...option, name: 'KeepsakeLevelBoon', rarity: 'Duo' }
                      : option.name === 'HeraManaBoon'
                        ? { ...option, rarity: manaLogged }
                        : option,
                  ),
                })),
                traits: {
                  ...room.traits,
                  acquired: room.traits.acquired.map((trait) =>
                    trait.name === 'BoonDecayBoon'
                      ? { ...trait, name: 'KeepsakeLevelBoon', rarity: 'Duo' }
                      : trait,
                  ),
                },
              }
            : index === 8 && room.entry !== undefined && traits !== undefined
              ? {
                  ...room,
                  entry: {
                    ...room.entry,
                    traits: Object.fromEntries(
                      Object.entries(traits).map(([name, row]) => [
                        heirloom(name),
                        name === 'BoonDecayBoon' ? { rarity: 'Duo' } : row,
                      ]),
                    ),
                  },
                }
              : room;
        }),
      },
      0,
      'FountainRarityKeepsake',
      'RarifyKeepsake',
    );
    record = withHeld(record, 0, 'RarifyKeepsake', { rarity: 'Epic', rarityUpgradeUses: 6 });
    record = withHeld(record, 4, 'RarifyKeepsake', { rarity: 'Epic', rarityUpgradeUses: 4 });
    return withHeld(record, 8, 'RarifyKeepsake', { rarity: 'Heroic', rarityUpgradeUses: left });
  }

  it("clicks a Cherished Heirloom room's spent charge net of the two its rank advance adds", () => {
    // Four charges, two gained, five left: one click, on the Hera Mana row logged Rare.
    const imported = projectFromRunRecord(catalog, heirloomRoom('Rare', 5));
    expect(screenOffer(imported, 'N-r7')).toMatchObject({
      options: [
        { traitKey: 'HeraManaBoon', rarity: 'Common' },
        {},
        { traitKey: 'KeepsakeLevelBoon' },
      ],
      selectedOptionKey: 'option3',
      rarificationActions: ['option1'],
    });
    expect(
      mismatchLines(imported.report).filter((line) => line.includes('RarifyKeepsake')),
    ).toEqual([]);
  });

  it("reads a room's spent charges from the plan each walk holds, not an earlier import of its record", () => {
    const record = heirloomRoom('Rare', 5);
    const imported = projectFromRunRecord(catalog, record);
    const spends = (project: ProjectDocument) =>
      recordedRarifySpends(
        new RunImportWalk(catalog, record, simulateProjectAssembly(catalog, project), []).context,
        7,
      );
    // With the Phial held instead, the Heirloom advances no charges: the Card's rise is no spend.
    const phial = applyProjectCommand(imported.project, catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress(imported.project.route.routeKey),
      keepsakeKey: 'FountainRarityKeepsake',
    });
    expect(spends(phial)).toEqual(new Map());
    expect(spends(imported.project)).toEqual(new Map([['RarifyKeepsake', 1]]));
  });

  it('authors no click in a Cherished Heirloom room whose charges rose by its rank advance', () => {
    const imported = projectFromRunRecord(catalog, heirloomRoom('Common', 6));
    expect(screenOffer(imported, 'N-r7')).toMatchObject({
      options: [
        { traitKey: 'HeraManaBoon', rarity: 'Common' },
        {},
        { traitKey: 'KeepsakeLevelBoon' },
      ],
      selectedOptionKey: 'option3',
      rarificationActions: [],
    });
    expect(
      mismatchLines(imported.report).filter((line) => line.includes('RarifyKeepsake')),
    ).toEqual([]);
  });

  it('reports a screen reroll the reroll pool cannot pay as refused', () => {
    // O_Combat07's Poseidon screen rerolled once with no reroll card held.
    const record = oceanusOpening();
    const imported = projectFromRunRecord(catalog, {
      ...record,
      rooms: record.rooms.map((room, index) =>
        index === 21 ? { ...room, spentRerolls: { '2000001': 1 } } : room,
      ),
    });
    expect(
      imported.report.entries.filter((entry) => entry.area === 'reroll').map(describeEntry),
    ).toEqual([expect.stringMatching(/^refused reroll r21 traitOffer@O-r21:source /)]);
    expect(screenOffer(imported, 'O-r21')).not.toHaveProperty('rerolledScreens');
  });

  it("clicks the Conch Shell's charge on a rerolled-away screen when the final one cannot take it", () => {
    // The Surface victory with The Champions held in Strength's place and
    // O_Combat07's Poseidon screen rerolled once; its final rows all logged
    // Common, so no click can have raised them.
    const record = oceanusOpening();
    const rows: RunRecord = withScreenRows(
      {
        ...record,
        loadout: {
          ...record.loadout,
          arcana: record.loadout.arcana.map((card) =>
            card.name === 'LowHealthBonus' ? { name: 'ScreenReroll', level: 3 } : card,
          ),
        },
        rooms: record.rooms.map((room, index) => ({
          ...room,
          ...(index === 21 ? { spentRerolls: { '2000001': 1 } } : {}),
          traits:
            index === 21
              ? {
                  ...room.traits,
                  acquired: room.traits.acquired.map((trait) =>
                    trait.name === 'DoubleRewardBoon' ? { ...trait, rarity: 'Common' } : trait,
                  ),
                }
              : room.traits,
          entry: { ...room.entry, numRerolls: index > 21 ? 2 : 3 },
        })),
      },
      21,
      { PoseidonCastBoon: 'Common', PoseidonManaBoon: 'Common', DoubleRewardBoon: 'Common' },
    );
    const imported = projectFromRunRecord(
      catalog,
      withHeld(
        withHeld(rows, 22, 'DoubleRewardBoon', { rarity: 'Common' }),
        23,
        'DoubleRewardBoon',
        {
          rarity: 'Common',
          level: 2,
        },
      ),
    );
    expect(screenOffer(imported, 'O-r21')).toMatchObject({
      options: [
        { traitKey: 'PoseidonCastBoon', rarity: 'Common' },
        { traitKey: 'PoseidonManaBoon', rarity: 'Common' },
        { traitKey: 'DoubleRewardBoon', rarity: 'Common' },
      ],
      rarificationActions: [],
      // The guessed earlier screen takes the click on its first row the Conch Shell can raise.
      rerolledScreens: [{ rarificationActions: ['option1'] }],
    });
    expect(mismatchLines(imported.report)).toEqual([]);
  });
});
