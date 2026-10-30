import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createTraitOfferAddress,
  type OccurrenceId,
} from '../../../src/authored-project';
import type { RunRecord } from '../../../src/run-record';
import { answerCarrierChild } from '../../../src/simulation/run-import/carrier-children';
import { RunImportWalk } from '../../../src/simulation/run-import/import';
import {
  projectFromRunRecord,
  simulateProjectAssembly,
  type RunImportReportEntry,
} from '../../../src/simulation';
import { fixture, describeEntry, occurrence, authoredOptions } from '../../support/run-import';

describe('run import of selected-outcome children', () => {
  /** A record with one room's trait rows edited. */
  function withRoomTraits(
    record: RunRecord,
    roomIndex: number,
    edit: (traits: RunRecord['rooms'][number]['traits']) => RunRecord['rooms'][number]['traits'],
  ): RunRecord {
    return {
      ...record,
      rooms: record.rooms.map((room, index) =>
        index === roomIndex ? { ...room, traits: edit(room.traits) } : room,
      ),
    };
  }

  it("takes Bridal Glow's saved target when its room shows no upgrade, as for a target already Heroic", () => {
    const record = withRoomTraits(fixture('underworld'), 6, (traits) => ({
      ...traits,
      upgraded: [],
    }));
    const imported = projectFromRunRecord(catalog, record);
    expect(imported.kind).toBe('complete');
    expect(authoredOptions(occurrence(imported.project, 'F-r6'), 'BoonDecayBoon')).toEqual([
      expect.objectContaining({ targetTraitKey: 'HeraSpecialBoon' }),
    ]);
    expect(
      imported.report.entries.filter(
        (entry) => entry.area === 'traitOffer' && entry.record?.roomIndex === 6,
      ),
    ).toEqual([]);
  });

  it("takes the first eligible Bridal Glow target when an older record shows no upgrade at the pick's time", () => {
    const record = withRoomTraits(fixture('underworld'), 6, (traits) => ({
      ...traits,
      acquired: traits.acquired.map((trait) => {
        const legacy = { ...trait };
        delete legacy.upgradedTrait;
        return legacy;
      }),
      upgraded: [],
    }));
    const imported = projectFromRunRecord(catalog, record);
    expect(imported.kind).toBe('complete');
    expect(
      imported.report.entries
        .filter((entry) => entry.area === 'traitOffer' && entry.record?.roomIndex === 6)
        .map(describeEntry),
    ).toEqual([
      'notInRecord traitOffer r6 traitAcquisitionTarget@F-r6 -> ReplaceTraitOffer(F-r6 HeraSprintBoon|HeraManaBoon|BoonDecayBoon#option3)',
    ]);
  });

  it('takes the first eligible Echo Pom target when no level doubled at the pick', () => {
    const record = withRoomTraits(fixture('underworld-live'), 28, (traits) => ({
      ...traits,
      upgraded: [],
    }));
    const imported = projectFromRunRecord(catalog, record);
    expect(imported.kind).toBe('complete');
    expect(
      imported.report.entries
        .filter((entry) => entry.area === 'traitOffer' && entry.record?.roomIndex === 28)
        .map(describeEntry),
    ).toEqual([
      'notInRecord traitOffer r28 echoPomTarget@H-r28 -> ReplaceTraitOffer(H-r28 DiminishingDodgeBoon|EchoDoubleLevelBoon|DiminishingHealthAndManaBoon#option2)',
    ]);
  });

  it("reports Concave Stone's extra pick as assumed when two unpicked rows were acquired after the pick", () => {
    const record = withRoomTraits(fixture('underworld-live'), 27, (traits) => ({
      ...traits,
      acquired: [
        ...traits.acquired,
        { name: 'CastProjectileBoon', rarity: 'Common', level: 1, worldTime: 3853 },
      ],
    }));
    const imported = projectFromRunRecord(catalog, record);
    const cage = occurrence(imported.project, 'H-r27').state;
    const offer =
      cage.kind === 'fieldsCombat'
        ? cage.cages['cage2']?.traitOffersByAcquisitionRole['source']
        : undefined;
    expect(offer?.kind === 'traits' && offer.concaveStoneResult).toEqual({
      kind: 'proc',
      optionKey: 'option1',
    });
    expect(
      imported.report.entries
        .filter(
          (entry) =>
            entry.area === 'traitOffer' &&
            entry.record?.roomIndex === 27 &&
            entry.reason !== 'mismatch',
        )
        .map(describeEntry),
    ).toEqual([
      'assumption traitOffer r27 traitOffer@H-r27:source -> ReplaceTraitOffer(H-r27 HestiaManaBoon|CastProjectileBoon|BurnStackBoon#option3)',
    ]);
  });

  it('answers a child an earlier change left unavailable from the record again', () => {
    const record = fixture('underworld-live');
    const imported = projectFromRunRecord(catalog, record);
    const trait = createTraitOfferAddress(
      createEncounterPhaseAddress(
        createBiomeAddress(imported.project.route.routeKey, 'H'),
        { kind: 'occurrence', occurrenceId: 'H-r28' as OccurrenceId },
        'Encounter',
      ),
      'selection',
    );
    const echo = occurrence(imported.project, 'H-r28').encounters.traitOffersByPhase?.[
      'Encounter'
    ]?.['Story_Echo_01'];
    if (echo?.kind !== 'traits') throw new Error('H-r28 has no Echo offer');
    const stale = applyProjectCommand(imported.project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value: {
        ...echo,
        options: echo.options.map((option) =>
          option.echoPomTarget === undefined
            ? option
            : { ...option, echoPomTarget: 'ZeusWeaponBoon' },
        ) as unknown as typeof echo.options,
      },
    });
    const entries: RunImportReportEntry[] = [];
    const walk = new RunImportWalk(
      catalog,
      record,
      simulateProjectAssembly(catalog, stale),
      entries,
    );
    const reason = walk.assembly.evaluation.issue?.reasons[0];
    expect(reason).toMatchObject({ code: 'echoPomTargetUnavailable' });
    expect(answerCarrierChild(walk.context, reason!)).toBe(true);
    const repaired = occurrence(walk.assembly.project, 'H-r28').encounters.traitOffersByPhase?.[
      'Encounter'
    ]?.['Story_Echo_01'];
    expect(repaired?.kind === 'traits' && repaired.options[1]?.echoPomTarget).toBe(
      'HestiaCastBoon',
    );
    expect(entries).toEqual([]);
  });
});
