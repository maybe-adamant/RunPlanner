import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import { applyProjectCommand, type SemanticAddress } from '../../../src/authored-project';
import type { RunRecord, RunRecordHeldTrait } from '../../../src/run-record';
import { answerCarrierChild } from '../../../src/simulation/run-import/carrier-children';
import { RunImportWalk } from '../../../src/simulation/run-import/import';
import {
  projectFromRunRecord,
  simulateProjectAssembly,
  type RunImportReport,
} from '../../../src/simulation';
import {
  fixture,
  describeEntry,
  occurrence,
  mismatchLines,
  authoredOptions,
} from '../../support/run-import';

describe('run import of selected-outcome children', () => {
  type Room = RunRecord['rooms'][number];
  type Traits = Room['traits'];

  /** A record's first `count` rooms, room `roomIndex` edited. */
  function withRoom(
    record: RunRecord,
    count: number,
    roomIndex: number,
    edit: (room: Room) => Room,
  ): RunRecord {
    return {
      ...record,
      rooms: record.rooms
        .slice(0, count)
        .map((room, index) => (index === roomIndex ? edit(room) : room)),
    };
  }

  /** `room` with its entry save's held rows replaced or added. */
  function withEntryTraits(room: Room, rows: Readonly<Record<string, RunRecordHeldTrait>>): Room {
    return { ...room, entry: { ...room.entry, traits: { ...room.entry?.traits, ...rows } } };
  }

  /** `record` with traits renamed from room `fromRoom` on: screens, changes and entry saves. */
  function renamed(
    record: RunRecord,
    fromRoom: number,
    names: Readonly<Record<string, string>>,
  ): RunRecord {
    const rename = (name: string) => names[name] ?? name;
    return {
      ...record,
      rooms: record.rooms.map((room, index) =>
        index < fromRoom
          ? room
          : {
              ...room,
              traitScreens: room.traitScreens.map((screen) => ({
                ...screen,
                options: screen.options.map((option) => ({ ...option, name: rename(option.name) })),
              })),
              traits: {
                acquired: room.traits.acquired.map((trait) => ({
                  ...trait,
                  name: rename(trait.name),
                })),
                removed: room.traits.removed.map(rename),
                upgraded: room.traits.upgraded.map((trait) => ({
                  ...trait,
                  name: rename(trait.name),
                })),
              },
              ...(room.entry?.traits === undefined
                ? {}
                : {
                    entry: {
                      ...room.entry,
                      traits: Object.fromEntries(
                        Object.entries(room.entry.traits).map(([name, row]) => [rename(name), row]),
                      ),
                    },
                  }),
            },
      ),
    };
  }

  /** `record` with each entry save's elements from room `fromRoom` on shifted by `delta`. */
  function withElements(
    record: RunRecord,
    fromRoom: number,
    delta: Readonly<Record<string, number>>,
  ): RunRecord {
    return {
      ...record,
      rooms: record.rooms.map((room, index) => {
        const elements = room.entry?.elements;
        if (index < fromRoom || elements === undefined) return room;
        const shifted: Record<string, number> = { ...elements };
        for (const [element, change] of Object.entries(delta))
          shifted[element] = (shifted[element] ?? 0) + change;
        return { ...room, entry: { ...room.entry, elements: shifted } };
      }),
    };
  }

  /** Report lines of one record room other than run-state differences. */
  function roomLines(report: RunImportReport, roomIndex: number): readonly string[] {
    return report.entries
      .filter(
        (entry) =>
          entry.area === 'traitOffer' &&
          entry.record?.roomIndex === roomIndex &&
          entry.reason !== 'mismatch',
      )
      .map(describeEntry);
  }

  /** Run-state differences from room `fromRoom` on. */
  function mismatchesFrom(report: RunImportReport, fromRoom: number): readonly string[] {
    return mismatchLines({
      ...report,
      entries: report.entries.filter((entry) => (entry.record?.roomIndex ?? 0) >= fromRoom),
    });
  }

  /**
   * underworld-1010 through H_Bridge01 with a Natural Selection pick at
   * H_MiniBoss01 (r27): F_Shop01's Demeter pick becomes Plant Health and
   * G_PreBoss01's Poseidon pick a Poseidon core, so the Duo is eligible.
   */
  function naturalSelectionRun(upgraded: (worldTime: number) => Traits['upgraded']): RunRecord {
    let record = renamed(fixture('underworld-1010'), 7, { CastNovaBoon: 'PlantHealthBoon' });
    record = renamed(record, 22, {
      EncounterStartOffenseBuffBoon: 'PoseidonManaBoon',
      PoseidonManaBoon: 'EncounterStartOffenseBuffBoon',
    });
    record = renamed(record, 27, { FocusDamageShaveBoon: 'GoodStuffBoon' });
    // The renamed picks change the elements the later entry saves hold.
    record = withElements(withElements(record, 8, { Earth: 1, Water: -1 }), 28, {
      Aether: 1,
      Water: -1,
    });
    const at = record.rooms[27]!.traits.acquired[0]!.worldTime!;
    record = withRoom(record, 29, 27, (room) => ({
      ...room,
      traitScreens: room.traitScreens.map((screen) => ({
        ...screen,
        options: screen.options.map((option) =>
          option.name === 'GoodStuffBoon' ? { ...option, rarity: 'Duo' } : option,
        ),
      })),
      traits: {
        ...room.traits,
        acquired: room.traits.acquired.map((trait) =>
          trait.name === 'GoodStuffBoon' ? { ...trait, rarity: 'Duo' } : trait,
        ),
        upgraded: upgraded(at),
      },
    }));
    // Echo's Pom then doubles Demeter's Attack from its new level.
    return withRoom(record, 29, 28, (room) => ({
      ...withEntryTraits(room, {
        GoodStuffBoon: { rarity: 'Duo' },
        DemeterWeaponBoon: { rarity: 'Rare', level: 6 },
        ZeusCastBoon: { rarity: 'Rare', level: 4 },
        AresSpecialBoon: { rarity: 'Common', level: 3 },
        DemeterSprintBoon: { rarity: 'Common', level: 2 },
        PoseidonManaBoon: { rarity: 'Rare', level: 2 },
      }),
      traits: {
        ...room.traits,
        upgraded: room.traits.upgraded.map((trait) => ({
          ...trait,
          from: { ...trait.from, level: 6 },
          to: { ...trait.to, level: 12 },
        })),
      },
    }));
  }

  it("takes an order for Natural Selection that reaches each core's recorded level gain", () => {
    const imported = projectFromRunRecord(
      catalog,
      naturalSelectionRun((worldTime) => [
        {
          name: 'DemeterWeaponBoon',
          from: { rarity: 'Rare', level: 4 },
          to: { rarity: 'Rare', level: 6 },
          worldTime,
        },
        {
          name: 'ZeusCastBoon',
          from: { rarity: 'Rare', level: 2 },
          to: { rarity: 'Rare', level: 4 },
          worldTime,
        },
        {
          name: 'AresSpecialBoon',
          from: { rarity: 'Common' },
          to: { rarity: 'Common', level: 3 },
          worldTime,
        },
        {
          name: 'DemeterSprintBoon',
          from: { rarity: 'Common' },
          to: { rarity: 'Common', level: 2 },
          worldTime,
        },
        {
          name: 'PoseidonManaBoon',
          from: { rarity: 'Rare' },
          to: { rarity: 'Rare', level: 2 },
          worldTime,
        },
      ]),
    );
    expect(imported.kind).toBe('complete');
    expect(authoredOptions(occurrence(imported.project, 'H-r27'), 'GoodStuffBoon')).toEqual([
      expect.objectContaining({
        naturalSelectionTargets: [
          'ZeusCastBoon',
          'DemeterWeaponBoon',
          'AresSpecialBoon',
          'DemeterSprintBoon',
          'PoseidonManaBoon',
          'ZeusCastBoon',
          'DemeterWeaponBoon',
          'AresSpecialBoon',
        ],
      }),
    ]);
    expect(roomLines(imported.report, 27)).toEqual([]);
    // The capture's own Fields store difference only.
    expect(mismatchLines(imported.report)).toEqual([
      'stores r27 FieldsOptionalRewards: MaxHealthDropSmall 1 | MaxHealthDropSmall 2',
    ]);
  });

  it("refuses Natural Selection's recorded gains when no order reaches them, taking the first eligible order", () => {
    const record = naturalSelectionRun((worldTime) => [
      {
        name: 'DemeterWeaponBoon',
        from: { rarity: 'Rare', level: 4 },
        to: { rarity: 'Rare', level: 7 },
        worldTime,
      },
      {
        name: 'ZeusCastBoon',
        from: { rarity: 'Rare', level: 2 },
        to: { rarity: 'Rare', level: 4 },
        worldTime,
      },
      {
        name: 'AresSpecialBoon',
        from: { rarity: 'Common' },
        to: { rarity: 'Common', level: 2 },
        worldTime,
      },
      {
        name: 'DemeterSprintBoon',
        from: { rarity: 'Common' },
        to: { rarity: 'Common', level: 2 },
        worldTime,
      },
      {
        name: 'PoseidonManaBoon',
        from: { rarity: 'Rare' },
        to: { rarity: 'Rare', level: 2 },
        worldTime,
      },
    ]);
    const imported = projectFromRunRecord(catalog, record);
    expect(imported.kind).toBe('complete');
    expect(roomLines(imported.report, 27)).toEqual([
      expect.stringMatching(/^refused traitOffer r27 naturalSelectionResult@H-r27 /),
    ]);
    // Answered again, the refused search visits each first-round order of the five cores once.
    const child = imported.report.entries.find(
      (entry) => entry.address?.kind === 'naturalSelectionResult',
    )!.address as Extract<SemanticAddress, { kind: 'naturalSelectionResult' }>;
    const state = occurrence(imported.project, 'H-r27').state;
    const offer =
      'reward' in state ? state.reward?.traitOffersByAcquisitionRole['source'] : undefined;
    if (offer?.kind !== 'traits') throw new Error('H-r27 has no Natural Selection offer');
    const cleared = applyProjectCommand(imported.project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: child.trait,
      value: {
        ...offer,
        options: offer.options.map((option) => {
          const { naturalSelectionTargets: targets, ...rest } = option;
          void targets;
          return rest;
        }) as unknown as typeof offer.options,
      },
    });
    const walk = new RunImportWalk(catalog, record, simulateProjectAssembly(catalog, cleared), []);
    const reason = walk.assembly.evaluation.issue?.reasons[0];
    expect(reason).toMatchObject({ code: 'naturalSelectionResultMissing' });
    let evaluations = 0;
    const counting: typeof walk.context = {
      ...walk.context,
      candidates: () => {
        const session = walk.context.candidates();
        const evaluate = ((query: { readonly kind?: string }) => {
          if (query.kind === 'traitCarrierChildDomain') evaluations += 1;
          return session.evaluate(query as never);
        }) as unknown as typeof session.evaluate;
        return { ...session, evaluate };
      },
    };
    expect(answerCarrierChild(counting, reason!)).toBe(true);
    // 686 nodes at most (120 orders, each forced to eight targets), with the fallback's few.
    expect(evaluations).toBeLessThan(700);
  });

  /** The Surface victory through O_Combat05 with Circe's O_Story01 pick renamed. */
  function circeRun(pick: string, edit: (room: Room, worldTime: number) => Room): RunRecord {
    const record = renamed(fixture('surface-victory'), 25, { CirceSorceryDamageBoon: pick });
    const at = record.rooms[25]!.traits.acquired[0]!.worldTime!;
    return withRoom(record, 27, 25, (room) => edit(room, at));
  }

  it("takes Red Citrine's card from the Arcana its room granted at the pick", () => {
    const record = circeRun('RandomArcanaTrait', (room, worldTime) => ({
      ...room,
      grantedArcana: ['MagicCrit'],
      traits: {
        ...room.traits,
        acquired: [
          ...room.traits.acquired,
          { name: 'MagicCritMetaUpgrade', rarity: 'Epic', worldTime },
        ],
      },
    }));
    const imported = projectFromRunRecord(catalog, record);
    expect(imported.kind).toBe('complete');
    expect(authoredOptions(occurrence(imported.project, 'O-r25'), 'RandomArcanaTrait')).toEqual([
      expect.objectContaining({
        circeResolution: { kind: 'activateArcana', arcanaKeys: ['MagicCrit'] },
      }),
    ]);
    expect(roomLines(imported.report, 25)).toEqual([]);
    expect(mismatchesFrom(imported.report, 25)).toEqual([]);
  });

  it("takes Lapis's cards from the card traits its room raised at the pick", () => {
    const record = circeRun('ArcanaRarityTrait', (room, worldTime) => ({
      ...room,
      traits: {
        ...room.traits,
        upgraded: [
          {
            name: 'HealthManaBonusMetaUpgrade',
            from: { rarity: 'Epic' },
            to: { rarity: 'Heroic' },
            worldTime,
          },
          {
            name: 'DodgeBonusMetaUpgrade',
            from: { rarity: 'Epic' },
            to: { rarity: 'Heroic' },
            worldTime,
          },
        ],
      },
    }));
    const imported = projectFromRunRecord(catalog, record);
    expect(imported.kind).toBe('complete');
    expect(authoredOptions(occurrence(imported.project, 'O-r25'), 'ArcanaRarityTrait')).toEqual([
      expect.objectContaining({
        circeResolution: { kind: 'promoteArcana', arcanaKeys: ['BonusHealth', 'BonusDodge'] },
      }),
    ]);
    expect(roomLines(imported.report, 25)).toEqual([]);
    expect(mismatchesFrom(imported.report, 25)).toEqual([]);
  });

  it("takes Black Night's first eligible vows, reported, since its disabled vows are not saved", () => {
    const imported = projectFromRunRecord(
      catalog,
      circeRun('RemoveShrineTrait', (room) => ({
        ...room,
        traitScreens: room.traitScreens.map((screen) => ({
          ...screen,
          options: screen.options.map((option, index) =>
            index === 2 ? { ...option, name: 'CirceSorceryDamageBoon' } : option,
          ),
        })),
      })),
    );
    expect(imported.kind).toBe('complete');
    expect(authoredOptions(occurrence(imported.project, 'O-r25'), 'RemoveShrineTrait')).toEqual([
      expect.objectContaining({
        circeResolution: { kind: 'disableFear', vowKeys: ['EnemySpeedShrineUpgrade'] },
      }),
    ]);
    expect(roomLines(imported.report, 25)).toEqual([
      expect.stringMatching(/^notInRecord traitOffer r25 circeResolution@O-r25 /),
    ]);
    expect(mismatchesFrom(imported.report, 25)).toEqual([]);
  });

  it("takes Boon Boon Boon's first eligible boon, reported, since the previous run's boons are not saved", () => {
    // The record acquires the boon the engine offers first, so the run states agree.
    let record = renamed(fixture('underworld-1010'), 28, {
      EchoDoubleLevelBoon: 'EchoLastRunBoon',
    });
    record = withRoom(record, 30, 28, (room) => ({
      ...room,
      traits: {
        ...room.traits,
        acquired: [
          ...room.traits.acquired,
          {
            name: 'AphroditeManaBoon',
            rarity: 'Common',
            worldTime: room.traits.acquired[0]!.worldTime!,
          },
        ],
        upgraded: [],
      },
    }));
    record = withRoom(record, 30, 29, (room) => {
      const held = withEntryTraits(room, {
        AphroditeManaBoon: { rarity: 'Common' },
        DemeterWeaponBoon: { rarity: 'Rare', level: 4 },
      });
      return {
        ...held,
        entry: { ...held.entry, elements: { ...held.entry?.elements, Air: 5 } },
      };
    });
    const imported = projectFromRunRecord(catalog, record);
    expect(imported.kind).toBe('complete');
    expect(authoredOptions(occurrence(imported.project, 'H-r28'), 'EchoLastRunBoon')).toEqual([
      expect.objectContaining({
        echoLastRunBoon: {
          options: [{ giverKey: 'Aphrodite', traitKey: 'AphroditeManaBoon', rarity: 'Common' }],
          selectedOptionKey: 'option1',
        },
      }),
    ]);
    expect(roomLines(imported.report, 28)).toEqual([
      expect.stringMatching(/^notInRecord traitOffer r28 echoLastRunBoon@H-r28 /),
    ]);
    expect(mismatchesFrom(imported.report, 28)).toEqual([]);
  });
});
