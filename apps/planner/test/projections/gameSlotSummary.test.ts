import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  aspectShortLabel,
  projectGameSlotSummary,
  slotAspectLabel,
  type GameSlotSummaryPlan,
} from '@planner/projections/gameSlotSummary';

const sentAt = new Date('2026-10-12T10:00:00.000Z');
// A compiled plan configures every vow.
const unranked = Object.fromEntries(catalog.fearVows.values.map((vow) => [vow.key, 0]));

const surfacePlan: GameSlotSummaryPlan = {
  displayName: 'Surface Phial run',
  routeKey: 'Surface',
  startingLoadout: {
    weaponKey: 'WeaponStaffSwing',
    aspectKey: 'StaffClearCastAspect',
    aspectRarity: 'Legendary',
    arcana: [],
    fear: {
      configuredRanks: {
        ...unranked,
        EnemyDamageShrineUpgrade: 2,
        BossDifficultyShrineUpgrade: 2,
      },
      effectiveRanks: { BossDifficultyShrineUpgrade: 2 },
    },
  },
  startingKeepsake: { keepsakeKey: 'ManaOverTimeRefundKeepsake', rarity: 'Epic' },
  extent: { kind: 'configuredPrefix', biomeKeys: ['N', 'O', 'P'], terminalBiomeKey: 'P' },
};

describe('game slot summary', () => {
  it('drops the "Aspect of" prefix from every catalog aspect', () => {
    for (const aspect of catalog.aspects.values) {
      expect(aspectShortLabel(aspect.label)).not.toMatch(/^Aspect of /);
    }
    expect(aspectShortLabel('Aspect of the Morrigan')).toBe('The Morrigan');
    expect(slotAspectLabel(catalog, 'WeaponStaffSwing', 'StaffClearCastAspect')).toBe(
      'Circe (Staff)',
    );
    expect(
      [
        'WeaponStaffSwing',
        'WeaponDagger',
        'WeaponAxe',
        'WeaponTorch',
        'WeaponLob',
        'WeaponSuit',
      ].map((weaponKey) =>
        slotAspectLabel(catalog, weaponKey, catalog.weapons.byKey[weaponKey]!.defaultAspectKey),
      ),
    ).toEqual([
      'Melinoë (Staff)',
      'Melinoë (Blades)',
      'Melinoë (Axe)',
      'Melinoë (Flames)',
      'Melinoë (Skull)',
      'Melinoë (Coat)',
    ]);
  });

  it('summarizes the sent plan in display names', () => {
    expect(projectGameSlotSummary(surfacePlan, catalog, sentAt)).toEqual({
      label: 'Circe - Surface',
      planName: 'Surface Phial run',
      sentAt: '2026-10-12T10:00:00.000Z',
      aspect: 'Circe (Staff)',
      route: 'Surface',
      endBiome: 'Olympus',
      startingKeepsake: 'Silver Wheel',
      // Vow of Pain II (1 + 2) and Vow of Rivals II (2 + 3), as configured.
      startingFear: 8,
    });
  });

  it('names the weapon in the label only when the aspect name is shared', () => {
    const label = (weaponKey: string, aspectKey: string) =>
      projectGameSlotSummary(
        {
          ...surfacePlan,
          startingLoadout: { ...surfacePlan.startingLoadout, weaponKey, aspectKey },
        },
        catalog,
        sentAt,
      ).label;
    expect(label('WeaponAxe', 'AxeRecoveryAspect')).toBe('Melinoë (Axe) - Surface');
    expect(label('WeaponSuit', 'BaseSuitAspect')).toBe('Melinoë (Coat) - Surface');
    expect(label('WeaponDagger', 'DaggerTripleAspect')).toBe('The Morrigan - Surface');
    expect(label('WeaponLob', 'LobImpulseAspect')).toBe('Persephone - Surface');
  });

  it('names a practice start and leaves out what the plan does not have', () => {
    const summary = projectGameSlotSummary(
      {
        routeKey: 'Underworld',
        startingLoadout: {
          weaponKey: 'WeaponStaffSwing',
          arcana: [],
          fear: { configuredRanks: unranked, effectiveRanks: unranked },
        },
        startingKeepsake: {},
        extent: { kind: 'configuredPrefix', biomeKeys: ['F', 'G'], terminalBiomeKey: 'G' },
        startState: { biomeKey: 'G', point: 'boss' },
      },
      catalog,
      sentAt,
    );
    expect(summary).toEqual({
      label: 'Staff - Underworld',
      sentAt: '2026-10-12T10:00:00.000Z',
      aspect: 'None (Staff)',
      route: 'Underworld',
      endBiome: catalog.biomes.byKey.G!.label,
      startingFear: 0,
      practiceStart: `${catalog.biomes.byKey.G!.label} · Boss`,
    });
  });
});
