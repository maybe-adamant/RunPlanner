import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import type { RunRecord } from '../../../src/run-record';
import { projectFromRunRecord, type RunImport } from '../../../src/simulation';
import { fixture, occurrence, reward } from '../../support/run-import';

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

  // Denial bans two unpicked options per screen (its only rank), so which banned
  // curse sat on which unpicked button is never saved.
  it('places both banned curses in screen order, their pairing an assumption', () => {
    const imported = projectFromRunRecord(
      catalog,
      erebusUnderDenial(['ChaosHealthCurse', 'ChaosNoMoneyCurse']),
    );
    expect(chaosLines(imported)).toEqual({
      curses: ['ChaosDashCurse', 'ChaosHealthCurse', 'ChaosNoMoneyCurse'],
      reasons: ['notInRecord', 'assumption'],
    });
  });
});
