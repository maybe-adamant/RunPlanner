import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import type { RunRecord } from '../src/run-record';
import { projectFromRunRecord, type RunImport } from '../src/import';
import { fixture, occurrence, reward } from './support/run-import';

describe('run import of keepsake equip grants', () => {
  /** Erebus with a neutral starting keepsake, its rack swapped to `to` and granting `granted`. */
  function erebusRackSwap(to: string, granted: string): RunRecord {
    const record = fixture('underworld');
    const worldTime = 340.65;
    return {
      ...record,
      route: { biomes: ['F'], dream: false },
      loadout: { ...record.loadout, keepsake: { name: 'LowHealthCritKeepsake', rarity: 'Epic' } },
      rooms: record.rooms.slice(0, 14).map((room, index) =>
        index !== 13
          ? room
          : {
              ...room,
              keepsakeSwap: { from: 'LowHealthCritKeepsake', to },
              traits: {
                ...room.traits,
                acquired: [
                  { name: to, rarity: 'Epic', worldTime },
                  { name: granted, worldTime },
                ],
              },
            },
      ),
    };
  }

  it.each([
    ['HadesAndPersephoneKeepsake', 'HadesInvisibilityRetaliateBoon', 'jeweledPom'],
    ['TempHammerKeepsake', 'StaffDoubleAttackTrait', 'experimentalHammer'],
  ] as const)('imports the trait a rack swap to %s grants', (to, granted, resultKind) => {
    const imported = projectFromRunRecord(catalog, erebusRackSwap(to, granted));
    expect(imported.kind).toBe('complete');
    const result = occurrence(imported.project, 'F-r11:postboss').keepsakeRack?.equipResults?.[
      resultKind
    ];
    expect(result).toMatchObject({ traitKey: granted });
    expect(
      imported.report.entries.filter((entry) => entry.area === 'rack' || entry.area === 'loadout'),
    ).toEqual([]);
  });
});

describe('run import of Chaos under Vow of Denial', () => {
  /** Erebus's opening and Chaos detour, with Denial banning unpicked curses. */
  function erebusUnderDenial(bannedTraits: readonly string[]): RunRecord {
    const record = fixture('underworld');
    return {
      ...record,
      route: { biomes: ['F'], dream: false },
      loadout: {
        ...record.loadout,
        vows: { ...record.loadout.vows, BanUnpickedBoonsShrineUpgrade: 1 },
      },
      rooms: record.rooms
        .slice(0, 2)
        .map((room, index) => (index === 1 ? { ...room, bannedTraits } : room)),
    };
  }

  const chaosLines = (imported: RunImport) => ({
    curses: (() => {
      const chaos = reward(imported.project, 'F-r1').traitOffersByAcquisitionRole['self'];
      return chaos?.kind === 'chaos' ? chaos.curseOptions.map((option) => option.curseKey) : [];
    })(),
    reasons: imported.report.entries
      .filter((entry) => entry.area === 'traitOffer' && entry.record?.roomIndex === 1)
      .map((entry) => entry.reason),
  });

  // Denial bans both unpicked options' curses (its only rank); which sat on which
  // button is never saved, and either order leaves the same bans.
  it('places both banned curses in catalog order, the other order an alternative', () => {
    const imported = projectFromRunRecord(
      catalog,
      erebusUnderDenial(['ChaosHealthCurse', 'ChaosNoMoneyCurse']),
    );
    expect(chaosLines(imported)).toEqual({
      curses: ['ChaosDashCurse', 'ChaosNoMoneyCurse', 'ChaosHealthCurse'],
      reasons: ['notInRecord'],
    });
    const entry = imported.report.entries.find((line) => line.area === 'traitOffer')!;
    expect(
      entry.alternatives?.map((command) =>
        command.kind === 'ReplaceTraitOffer' && command.value.kind === 'chaos'
          ? command.value.curseOptions.map((option) => option.curseKey)
          : [],
      ),
    ).toEqual([['ChaosDashCurse', 'ChaosHealthCurse', 'ChaosNoMoneyCurse']]);
  });

  it('leaves the screen open when Denial banned fewer curses than unpicked buttons', () => {
    const imported = projectFromRunRecord(catalog, erebusUnderDenial(['ChaosHealthCurse']));
    expect(imported.kind).toBe('stopped');
    expect(chaosLines(imported).curses).toEqual([]);
  });
});

describe('run import of Chaos without Vow of Denial', () => {
  // The unpicked curses leave no run state, so the first legal pair stands and no guess is noted.
  it('takes the first pair of curses the screen admits', () => {
    const record = fixture('underworld');
    const imported = projectFromRunRecord(catalog, {
      ...record,
      route: { biomes: ['F'], dream: false },
      rooms: record.rooms.slice(0, 2),
    });
    const chaos = reward(imported.project, 'F-r1').traitOffersByAcquisitionRole['self'];
    expect(chaos?.kind === 'chaos' && chaos.curseOptions.map((option) => option.curseKey)).toEqual([
      'ChaosDashCurse',
      'ChaosNoMoneyCurse',
      'ChaosHealthCurse',
    ]);
    expect(
      imported.report.entries
        .filter((entry) => entry.area === 'traitOffer' && entry.record?.roomIndex === 1)
        .map((entry) => [entry.reason, entry.alternatives]),
    ).toEqual([['notInRecord', undefined]]);
  });
});
