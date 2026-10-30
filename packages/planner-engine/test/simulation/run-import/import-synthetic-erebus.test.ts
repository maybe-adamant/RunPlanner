import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import type { RunRecord } from '../../../src/run-record';
import { projectFromRunRecord } from '../../../src/simulation';
import { fixture, describeEntry, occurrence, reward, entryLines } from '../../support/run-import';

describe('run import of synthetic Erebus variants', () => {
  /** Erebus through its PostBoss, its Pool sale unexplained by any lost trait. */
  function erebusWithUnexplainedSale(): RunRecord {
    const record = fixture('underworld');
    return {
      ...record,
      route: { biomes: ['F'], dream: false },
      rooms: record.rooms
        .slice(0, 14)
        .map((room, index) =>
          index === 13 ? { ...room, traits: { ...room.traits, removed: ['WetState'] } } : room,
        ),
    };
  }

  /** Erebus through its PostBoss, with saved Chaos and Embryo values outside their domains. */
  function erebusWithOffDomainRolls(): RunRecord {
    const record = fixture('underworld');
    const withValues = (
      room: RunRecord['rooms'][number],
      name: string,
      savedValues: Readonly<Record<string, number>>,
    ) => ({
      ...room,
      traits: {
        ...room.traits,
        acquired: room.traits.acquired.map((trait) =>
          trait.name === name ? { ...trait, savedValues } : trait,
        ),
      },
    });
    return {
      ...record,
      route: { biomes: ['F'], dream: false },
      rooms: record.rooms.slice(0, 14).map((room, index) =>
        index === 1
          ? withValues(room, 'ChaosDashCurse', {
              'OnWeaponFiredFunctions.FunctionArgs.Cost': 25,
              'OnExpire.TraitData.PropertyChanges.1.ChangeValue': 0.77,
              'OnExpire.TraitData.WeaponSpeedMultiplier.Value': 0.725,
            })
          : index === 13
            ? withValues(room, 'ChaosManaCostBlessing', {
                'ManaCostModifiers.ManaCostMultiplier': 0.3,
              })
            : room,
      ),
    };
  }

  it('refuses saved Chaos and Embryo values outside their domains for the defaults', () => {
    const imported = projectFromRunRecord(catalog, erebusWithOffDomainRolls());
    expect(reward(imported.project, 'F-r1').traitOffersByAcquisitionRole['self']).toMatchObject({
      selectedCurseValues: { magickLoss: 15 },
      blessingValues: { weaponSpeed: 0.75, propertySpeed: 0.75 },
    });
    expect(
      occurrence(imported.project, 'F-r11:postboss').keepsakeRack?.equipResults?.transcendentEmbryo,
    ).toEqual({ blessingKey: 'ChaosManaCostBlessing', blessingValues: { costReduction: 0.5 } });
    expect(
      imported.report.entries
        .filter((entry) => entry.area === 'embryo' || entry.record?.roomIndex === 1)
        .filter((entry) => entry.area === 'embryo' || entry.area === 'traitOffer')
        .map(describeEntry),
    ).toEqual([
      'notInRecord traitOffer r1 traitOffer@F-r1:self -> ReplaceTraitOffer(F-r1 chaos)',
      'refused traitOffer r1 traitOffer@F-r1:self -> ReplaceTraitOffer(F-r1 chaos)',
      'assumption traitOffer r1 traitOffer@F-r1:self -> ReplaceTraitOffer(F-r1 chaos)',
      'refused embryo r13 keepsakeEquipResult@F-r11:postboss -> ReplaceTranscendentEmbryoEquipResult(F-r11:postboss)',
    ]);
  });

  it('reports an unexplained Pool sale and keeps the first eligible trait', () => {
    const imported = projectFromRunRecord(catalog, erebusWithUnexplainedSale());
    expect(imported.kind).toBe('complete');
    expect(entryLines(imported.report).filter((line) => line.includes(' pool '))).toEqual([
      'refused pool r13 roomFeature@F-r11:postboss -> ReplacePurgingPoolSlot(F-r11:postboss)',
    ]);
    // The Mystery Boon's hidden god is the god whose screen its Shop opened.
    const shop = occurrence(imported.project, 'F-r6');
    expect(shop.acquisitionSites?.['roomExit']?.pickupEntries?.['Boon']?.offer).toEqual({
      rewardType: 'BlindBoxLoot',
      payload: { kind: 'BoonSource', source: 'HeraUpgrade' },
    });
    expect(
      imported.report.entries.filter(
        (entry) =>
          entry.record?.roomIndex === 6 && (entry.area === 'reward' || entry.area === 'shop'),
      ),
    ).toEqual([]);
  });

  /** F through H with the H_Combat15 Hermes screen picking another boon than Travel Deal. */
  function withoutTravelDeal(): RunRecord {
    const record = fixture('underworld');
    return {
      ...record,
      route: { biomes: ['F', 'G', 'H'], dream: false },
      rooms: record.rooms.slice(0, 33).map((room, index) =>
        index !== 26
          ? room
          : {
              ...room,
              traitScreens: room.traitScreens.map((screen) =>
                screen.giver !== 'HermesUpgrade'
                  ? screen
                  : {
                      ...screen,
                      options: screen.options.map((option) => ({
                        ...option,
                        chosen: option.name === 'SprintShieldBoon',
                      })),
                    },
              ),
            },
      ),
    };
  }

  it('withdraws or refuses a Well restock the plan cannot trigger, reporting it refused', () => {
    const imported = projectFromRunRecord(catalog, withoutTravelDeal());
    expect(imported.kind).toBe('complete');
    expect(
      occurrence(imported.project, 'H-r30:postboss').stygianWell?.purchasedGenerationKeys,
    ).toEqual(['initial:secondRight']);
    expect(entryLines(imported.report)).toContain('refused well r32 roomFeature@H-r30:postboss');
  });
});
