import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import type { RunRecord } from '../../../src/run-record';
import { projectFromRunRecord, type RunImport } from '../../../src/simulation';
import { fixture, describeEntry, entryLines, authoredOptions } from '../../support/run-import';

/** Every authored trait offer, at any depth, showing `traitKey` on one of its final rows. */
function offersShowing(value: unknown, traitKey: string): readonly Record<string, unknown>[] {
  if (typeof value !== 'object' || value === null) return [];
  const record = value as Record<string, unknown>;
  const shows =
    record['kind'] === 'traits' &&
    Array.isArray(record['options']) &&
    (record['options'] as { traitKey: string }[]).some((option) => option.traitKey === traitKey);
  return [
    ...(shows ? [record] : []),
    ...Object.values(record).flatMap((nested) => offersShowing(nested, traitKey)),
  ];
}

describe('run import of rolls a screen keeps unsaved', () => {
  /**
   * The Surface victory through P_Combat14 with P_Story01's Dionysus pick made
   * Worry Free at Rare (70 to 100), its roll 13 in every later entry save.
   */
  function worryFree(withMaxHealth: boolean): RunRecord {
    const record = fixture('surface-victory');
    const rename = (name: string) => (name === 'PowerDrinkBoon' ? 'HiddenMaxHealthBoon' : name);
    return {
      ...record,
      route: { biomes: ['N', 'O', 'P'], dream: false },
      rooms: record.rooms.slice(0, 39).map((room, index) => {
        const { maxHealth, ...entry } = room.entry!;
        return {
          ...room,
          ...(index === 36
            ? {
                traitScreens: room.traitScreens.map((screen) => ({
                  ...screen,
                  options: screen.options.map((option) => ({
                    ...option,
                    name: rename(option.name),
                  })),
                })),
                traits: {
                  ...room.traits,
                  acquired: room.traits.acquired.map((trait) => ({
                    ...trait,
                    name: rename(trait.name),
                  })),
                },
              }
            : {}),
          entry: withMaxHealth
            ? { ...entry, maxHealth: maxHealth! + (index > 36 ? 70 + 13 : 0) }
            : entry,
        };
      }),
    };
  }

  const dionysusLines = (imported: RunImport) =>
    imported.report.entries
      .filter((entry) => entry.area === 'traitOffer' && entry.record?.roomIndex === 36)
      .map(describeEntry);

  it("takes Worry Free's roll from the next entry save's max health beyond the plan's", () => {
    const imported = projectFromRunRecord(catalog, worryFree(true));
    expect(authoredOptions(imported.project, 'HiddenMaxHealthBoon')).toEqual([
      { traitKey: 'HiddenMaxHealthBoon', rarity: 'Rare', maxHealthRoll: 13 },
    ]);
    expect(dionysusLines(imported)).toEqual([]);
  });

  it('keeps the minimum roll, not in the record, for a record without max health', () => {
    const imported = projectFromRunRecord(catalog, worryFree(false));
    expect(authoredOptions(imported.project, 'HiddenMaxHealthBoon')).toEqual([
      { traitKey: 'HiddenMaxHealthBoon', rarity: 'Rare' },
    ]);
    expect(dionysusLines(imported)).toEqual([
      'notInRecord traitOffer r36 traitOffer@P-r36:selection',
    ]);
  });

  /**
   * Erebus with Aspect of Persephone, F_Opening02's Hera pick acquired at
   * `level`, the Jeweled Pom's Fated bonus held or replaced by the Phial.
   */
  function persephone(keepsake: string, level: number): RunRecord {
    const record = fixture('underworld');
    return {
      ...record,
      route: { biomes: ['F'], dream: false },
      loadout: {
        ...record.loadout,
        weapon: 'WeaponLob',
        aspect: { name: 'LobImpulseAspect', rarity: 'Legendary' },
        keepsake: { name: keepsake, rarity: 'Epic' },
      },
      rooms: record.rooms.slice(0, 14).map((room, index) =>
        index !== 0
          ? room
          : {
              ...room,
              traits: {
                ...room.traits,
                acquired: room.traits.acquired.map((trait) =>
                  trait.name === 'HeraSpecialBoon' ? { ...trait, level } : trait,
                ),
              },
            },
      ),
    };
  }

  // The bonus encodes roll 0 as zero and a roll above one as the roll less one.
  it.each([
    ['HadesAndPersephoneKeepsake', 7, { persephoneLevelBonus: 2 }],
    ['HadesAndPersephoneKeepsake', 4, {}],
    ['FountainRarityKeepsake', 4, { persephoneLevelBonus: 3 }],
  ] as const)(
    "takes Persephone's bonus that installs the picked level, %s at level %i",
    (keepsake, level, bonus) => {
      const imported = projectFromRunRecord(catalog, persephone(keepsake, level));
      expect(authoredOptions(imported.project, 'HeraSpecialBoon')).toEqual([
        { traitKey: 'HeraSpecialBoon', rarity: 'Common', ...bonus },
      ]);
      expect(
        imported.report.entries.filter(
          (entry) => entry.area === 'traitOffer' && entry.record?.roomIndex === 0,
        ),
      ).toEqual([]);
    },
  );

  it('refuses a picked level no Persephone bonus installs and keeps roll 0', () => {
    const imported = projectFromRunRecord(catalog, persephone('FountainRarityKeepsake', 30));
    expect(authoredOptions(imported.project, 'HeraSpecialBoon')).toEqual([
      { traitKey: 'HeraSpecialBoon', rarity: 'Common' },
    ]);
    expect(entryLines(imported.report).filter((line) => line.includes(' r0 '))).toEqual([
      'refused traitOffer r0 traitOffer@F-r0:source -> ReplaceTraitOffer(F-r0 HeraSpecialBoon|HeraCastBoon|HeraSprintBoon#option1)',
    ]);
  });

  /**
   * The live Underworld recording through G_Boss01 with Chaos_04's curse made
   * Rejected for two god screens, G_Shop01's and G_MiniBoss01's, each logging
   * two rows; Vow of Denial still bans the blocked row, and G_MiniBoss01's
   * screen is rerolled once with The Champions held in Strength's place.
   */
  function rejected(): RunRecord {
    const record = fixture('underworld-live');
    const blocked = new Set(['LinkedDeathDamageBoon', 'ApolloBlindBoon']);
    return {
      ...record,
      route: { biomes: ['F', 'G'], dream: false },
      loadout: {
        ...record.loadout,
        arcana: record.loadout.arcana.map((card) =>
          card.name === 'LowHealthBonus' ? { name: 'ScreenReroll', level: 3 } : card,
        ),
      },
      rooms: record.rooms.slice(0, 24).map((room, index) =>
        index === 15
          ? {
              ...room,
              traits: {
                ...room.traits,
                acquired: room.traits.acquired.map((trait) =>
                  trait.name === 'ChaosStunCurse'
                    ? { ...trait, name: 'ChaosRestrictBoonCurse', remainingUses: 2 }
                    : trait,
                ),
              },
            }
          : index === 17 || index === 19
            ? {
                ...room,
                ...(index === 19 ? { spentRerolls: { '1': 1 } } : {}),
                traitScreens: room.traitScreens.map((screen) => ({
                  ...screen,
                  options: screen.options.filter((option) => !blocked.has(option.name)),
                })),
              }
            : room,
      ),
    };
  }

  it("authors Rejected's blocked row the screen's log omits, on picked and rerolled screens", () => {
    const imported = projectFromRunRecord(catalog, rejected());
    expect(offersShowing(imported.project, 'BoonDecayBoon')).toEqual([
      expect.objectContaining({
        options: [
          { traitKey: 'HeraManaBoon', rarity: 'Epic' },
          expect.objectContaining({ traitKey: 'BoonDecayBoon' }),
          { traitKey: 'LinkedDeathDamageBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option2',
        rejectedOptionKey: 'option3',
      }),
    ]);
    const apollo = offersShowing(imported.project, 'ApolloExCastBoon');
    expect(apollo).toEqual([
      expect.objectContaining({
        options: [
          { traitKey: 'ApolloExCastBoon', rarity: 'Rare' },
          { traitKey: 'PerfectDamageBonusBoon', rarity: 'Epic' },
          { traitKey: 'ApolloBlindBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option2',
        rejectedOptionKey: 'option3',
      }),
    ]);
    // The rerolled-away screen, guessed whole, blocks a row of its own.
    expect(apollo[0]!['rerolledScreens']).toEqual([
      expect.objectContaining({ rejectedOptionKey: 'option1' }),
    ]);
    expect(
      imported.report.entries
        .filter((entry) => entry.record?.roomIndex === 17 || entry.record?.roomIndex === 19)
        .filter((entry) => entry.area === 'traitOffer' || entry.area === 'reroll')
        .map(describeEntry),
    ).toEqual([
      'notInRecord reroll r19 traitOffer@G-r19:source -> ReplaceTraitOffer(G-r19 ApolloExCastBoon|PerfectDamageBonusBoon|ApolloBlindBoon#option2)',
    ]);
  });
});
