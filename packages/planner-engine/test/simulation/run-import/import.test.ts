import { readFileSync } from 'node:fs';

import { beforeAll, describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import type {
  ProjectCommand,
  ProjectDocument,
  RoomOccurrence,
  SemanticAddress,
} from '../../../src/authored-project';
import { decodeRunRecord, type RunRecord } from '../../../src/run-record';
import {
  projectFromRunRecord,
  simulateProjectAssembly,
  type RunImport,
  type RunImportReport,
  type RunImportReportEntry,
} from '../../../src/simulation';

function fixture(name: string): RunRecord {
  return decodeRunRecord(
    JSON.parse(
      readFileSync(
        new URL(`../../run-record/fixtures/${name}.run-record.json`, import.meta.url),
        'utf8',
      ),
    ),
  );
}

function occurrence(project: ProjectDocument, occurrenceId: string): RoomOccurrence {
  for (const biome of project.route.biomes)
    for (const entry of biome.topology?.occurrences ?? [])
      if (entry.occurrenceId === occurrenceId) return entry;
  throw new Error(`missing occurrence ${occurrenceId}`);
}

function reward(project: ProjectDocument, occurrenceId: string) {
  const state = occurrence(project, occurrenceId).state;
  if (!('reward' in state) || state.reward === null)
    throw new Error(`${occurrenceId} has no reward`);
  return state.reward;
}

/** Report entries counted by reason, then area, so coverage changes show as a diff. */
function grouped(report: RunImportReport) {
  const counts: Record<string, Record<string, number>> = {};
  for (const entry of report.entries) {
    const byArea = (counts[entry.reason] ??= {});
    byArea[entry.area] = (byArea[entry.area] ?? 0) + 1;
  }
  return counts;
}

/** The occurrence an address names, found through its nested owners. */
function occurrenceOf(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const record = value as Record<string, unknown>;
  for (const field of ['occurrenceId', 'sourceOccurrenceId'])
    if (typeof record[field] === 'string') return record[field];
  for (const nested of Object.values(record)) {
    const found = occurrenceOf(nested);
    if (found !== undefined) return found;
  }
  return undefined;
}

function describeAddress(address: SemanticAddress | undefined): string {
  if (address === undefined) return '-';
  const record = address as unknown as Record<string, unknown>;
  const detail = ['exitKey', 'phaseKey', 'slotKey', 'acquisitionRole', 'hubKey']
    .flatMap((field) => (typeof record[field] === 'string' ? [record[field]] : []))
    .join('/');
  return `${address.kind}@${occurrenceOf(address) ?? ('biomeKey' in address ? address.biomeKey : '-')}${detail === '' ? '' : `:${detail}`}`;
}

function describeCommand(command: ProjectCommand | undefined): string {
  if (command === undefined) return '';
  const record = command as unknown as Record<string, unknown>;
  const value = record['value'] as Record<string, unknown> | undefined;
  const shown =
    record['gameName'] ??
    record['encounterKey'] ??
    (typeof value?.['rewardType'] === 'string' ? value['rewardType'] : undefined) ??
    (Array.isArray(value?.['options'])
      ? `${(value['options'] as { traitKey: string }[]).map((option) => option.traitKey).join('|')}#${String(value['selectedOptionKey'])}`
      : undefined) ??
    (typeof value?.['kind'] === 'string' ? value['kind'] : undefined) ??
    '';
  return ` -> ${command.kind}(${occurrenceOf(command) ?? ''}${shown === '' ? '' : ` ${String(shown)}`})`;
}

/** One stable line per entry: reason, area, record room and door, owner and applied value. */
function describeEntry(entry: RunImportReportEntry): string {
  const where =
    entry.record === undefined
      ? 'r-'
      : `r${entry.record.roomIndex}${entry.record.door === undefined ? '' : `d${entry.record.door}`}`;
  return `${entry.reason} ${entry.area} ${where} ${describeAddress(entry.address)}${describeCommand(entry.applied)}`;
}

/** The refused and assumed values, one stable line each, so a swapped door or encounter shows. */
function entryLines(report: RunImportReport): readonly string[] {
  return report.entries
    .filter((entry) => entry.reason === 'refused' || entry.reason === 'assumption')
    .map(describeEntry);
}

/** Rooms the imported plan enters, in order, read from the evaluated route history. */
function enteredRooms(project: ProjectDocument): readonly string[] {
  const evaluation = simulateProjectAssembly(catalog, project).evaluation;
  expect(evaluation.status).toBe('valid');
  const last = [...evaluation.route.biomes].reverse().find((biome) => 'history' in biome);
  if (last === undefined || !('history' in last)) throw new Error('no evaluated history');
  return last.history.ledgers.roomAppearances.map((appearance) => appearance.gameName);
}

function generatedCustomizations(project: ProjectDocument): number {
  return project.route.biomes
    .flatMap((biome) => biome.topology?.occurrences ?? [])
    .flatMap((entry) => Object.values(entry.encounters.customizationByPhase ?? {}))
    .flatMap((byDecision) => Object.values(byDecision))
    .filter((value) => value.kind === 'generated').length;
}

describe('run import of the Underworld capture', () => {
  const record = fixture('underworld');
  let imported: RunImport;
  beforeAll(() => {
    imported = projectFromRunRecord(catalog, record);
  });

  it('completes as a valid plan entering every recorded room but the Ixion Chaos detour', () => {
    expect(imported.kind).toBe('complete');
    // I_Combat08's Chaos gate needs Ixion from the Well, which the import does not read yet.
    expect(enteredRooms(imported.project)).toEqual(
      record.rooms.map((room) => room.name).filter((_name, index) => index !== 39),
    );
  });

  it('imports the loadout', () => {
    expect(imported.project.route.loadout).toMatchObject({
      weaponKey: 'WeaponStaffSwing',
      aspectKey: 'StaffClearCastAspect',
      familiarKey: record.loadout.familiar!.name,
      startingKeepsakeKey: 'HadesAndPersephoneKeepsake',
      startingReward: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'HeraUpgrade' },
      },
      fearRanks: record.loadout.vows,
    });
  });

  it('imports doors, the Preboss takeover and Chaos', () => {
    expect(occurrence(imported.project, 'F-r0-d565889').gameName).toBe('F_Combat07');
    expect(reward(imported.project, 'F-r0-d565889').offer).toEqual({
      rewardType: 'MetaCardPointsCommonDrop',
    });
    expect(occurrence(imported.project, 'F-r1').gameName).toBe('Chaos_03');
    // The recorded Shop door is the takeover's Shop; the other door keeps its offer.
    expect(occurrence(imported.project, 'F-r11').state.kind).toBe('shop');
    expect(reward(imported.project, 'F-r10-d560915').offer).toEqual({
      rewardType: 'MaxHealthDrop',
    });
  });

  it('imports trait offers, Pom level-ups and Artificer conversions', () => {
    expect(reward(imported.project, 'F-r7').traitOffersByAcquisitionRole['source']).toEqual({
      kind: 'traits',
      giverKey: 'Ares',
      options: [
        { traitKey: 'AresCastBoon', rarity: 'Epic' },
        { traitKey: 'LowHealthLifestealBoon', rarity: 'Rare' },
        { traitKey: 'BloodDropRevengeBoon', rarity: 'Rare' },
      ],
      selectedOptionKey: 'option1',
      rarificationActions: [],
    });
    expect(reward(imported.project, 'F-r9').levelResolutionsByAcquisitionRole?.['self']).toEqual({
      kind: 'random',
      targetTraitKey: 'AresCastBoon',
    });
    expect(reward(imported.project, 'F-r2').dispositionByAcquisitionRole['self']).toEqual({
      kind: 'artificer',
    });
  });

  it('customizes every generated encounter outside the Fields cages from its inverse', () => {
    // Five of the capture's 22 generated phases are cage encounters, recorded with their cages.
    expect(generatedCustomizations(imported.project)).toBe(17);
  });

  it('reports every value the record did not answer exactly', () => {
    expect(grouped(imported.report)).toEqual({
      assumption: { conversion: 3, doors: 18, encounter: 1, roomActionOrder: 8 },
      notInRecord: { loadout: 1, route: 1, traitOffer: 2 },
      refused: { chaosGate: 1, doors: 1, traitOffer: 5 },
      unsupportedArea: { fields: 37, npc: 2, pathOfStars: 2, shop: 17 },
    });
    // G_Combat20's positional first door (G_Combat08) is refused at its exit and moves later.
    expect(entryLines(imported.report)).toEqual([
      'assumption conversion r2 acquisitionEntry@F-r2 -> ReplaceAcquisitionEntryOffer(F-r2 StackUpgrade)',
      'assumption doors r2 exitDecision@F-r2',
      'assumption doors r3 exitDecision@F-r3',
      'assumption encounter r4 encounterPhase@F-r4:Encounter -> SelectEncounter(F-r4 ArtemisCombatF)',
      'assumption conversion r4 acquisitionEntry@F-r4 -> ReplaceAcquisitionEntryOffer(F-r4 RoomMoneyDrop)',
      'assumption doors r4 exitDecision@F-r4',
      'assumption doors r5 exitDecision@F-r5',
      'assumption doors r6 exitDecision@F-r6',
      'assumption conversion r8 acquisitionEntry@F-r8 -> ReplaceAcquisitionEntryOffer(F-r8 WeaponUpgrade)',
      'assumption doors r8 exitDecision@F-r8',
      'assumption doors r9 exitDecision@F-r9',
      'assumption doors r15 exitDecision@G-r15',
      'assumption doors r16 exitDecision@G-r16',
      'assumption doors r18 exitDecision@G-r18',
      'assumption doors r19 exitDecision@G-r19',
      'refused doors r19d569053 target@G-r19:exit1 -> CreateTarget(G-r20 G_MiniBoss01)',
      'assumption doors r19d776586 target@G-r19:exit2 -> CreateTarget(G-r19-d776586 G_MiniBoss03)',
      'assumption doors r19d569053 target@G-r19:exit3 -> CreateTarget(G-r19-d569053 G_Combat08)',
      'refused traitOffer r20 traitOffer@G-r20:source -> ReplaceTraitOffer(G-r20 ZeusManaBoon|ZeusWeaponBoon|ZeusSpecialBoon#option2)',
      'assumption doors r20 exitDecision@G-r20',
      'assumption doors r21 exitDecision@G-r21',
      'assumption doors r26 exitDecision@H-r26',
      'assumption doors r27 exitDecision@H-r27',
      'refused traitOffer r28 traitOffer@H-r28:selection -> ReplaceTraitOffer(H-r28 DiminishingHealthAndManaBoon|EchoDeathDefianceRefill|EchoLastReward#option2)',
      'assumption doors r28 exitDecision@H-r28',
      'refused traitOffer r29 traitOffer@H-r29:source -> ReplaceTraitOffer(H-r29 BoltRetaliateBoon|ZeusManaBoon|ZeusSpecialBoon#option2)',
      'refused traitOffer r29 traitOffer@H-r29:self -> ReplaceTraitOffer(H-r29 HermesWeaponBoon|SprintShieldBoon|HermesSpecialBoon#option1)',
      'refused traitOffer r29 traitOffer@H-r29:self -> ReplaceTraitOffer(H-r29 StaffDoubleAttackTrait|StaffTripleShotTrait|StaffLongAttackTrait#option1)',
      'refused chaosGate r38 additionalExit@I-r38',
      'assumption roomActionOrder r2 occurrence@F-r2',
      'assumption roomActionOrder r4 occurrence@F-r4',
      'assumption roomActionOrder r8 occurrence@F-r8',
      'assumption roomActionOrder r13 occurrence@F-r11:postboss',
      'assumption roomActionOrder r24 occurrence@G-r22:postboss',
      'assumption roomActionOrder r26 occurrence@H-r26',
      'assumption roomActionOrder r29 occurrence@H-r29',
      'assumption roomActionOrder r32 occurrence@H-r30:postboss',
    ]);
  });
});

describe('run import of the Surface capture', () => {
  const record = fixture('surface');
  let imported: RunImport;
  beforeAll(() => {
    imported = projectFromRunRecord(catalog, record);
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
      assumption: { roomActionOrder: 6 },
      notInRecord: { loadout: 1, reward: 1, traitOffer: 1 },
      refused: { conversion: 1 },
      unsupportedArea: { shop: 18, wheel: 10 },
    });
    expect(entryLines(imported.report)).toEqual([
      'refused conversion r24 acquisitionRole@O-r24:self',
      'assumption roomActionOrder r19 occurrence@N-r17:postboss',
      'assumption roomActionOrder r21 occurrence@O-r21',
      'assumption roomActionOrder r22 occurrence@O-r22',
      'assumption roomActionOrder r24 occurrence@O-r24',
      'assumption roomActionOrder r25 occurrence@O-r25',
      'assumption roomActionOrder r26 occurrence@O-r26',
    ]);
  });
});

describe('run import route support', () => {
  it('stops a Dream run before authoring anything', () => {
    const record = fixture('surface');
    const result = projectFromRunRecord(catalog, {
      ...record,
      route: { ...record.route, dream: true },
    });
    expect(result.kind === 'stopped' && result.stop).toEqual({
      area: 'dream',
      code: 'unsupportedRoute',
    });
    expect(result.report.entries).toEqual([{ area: 'dream', reason: 'stopped' }]);
  });

  it('stops a run on a route the catalog does not declare', () => {
    const record = fixture('surface');
    const result = projectFromRunRecord(catalog, {
      ...record,
      route: { biomes: ['Z'], dream: false },
    });
    expect(result.kind).toBe('stopped');
    expect(result.report.entries).toEqual([{ area: 'route', reason: 'stopped' }]);
  });
});

describe('run import door assignment', () => {
  /** Erebus through its PostBoss, the Preboss's recorded Shop door renumbered below its other door. */
  function erebusWithLowShopDoor(): RunRecord {
    const record = fixture('underworld');
    return {
      ...record,
      route: { biomes: ['F'], dream: false },
      rooms: record.rooms.slice(0, 14).map((room, index) =>
        index === 10
          ? {
              ...room,
              doors: room.doors.map((door) =>
                door.reward?.type === 'Shop' ? { ...door, door: 560900 } : door,
              ),
            }
          : room,
      ),
    };
  }

  it('maps the recorded Shop door to the takeover Shop target whatever its id', () => {
    const imported = projectFromRunRecord(catalog, erebusWithLowShopDoor());
    expect(imported.kind).toBe('complete');
    expect(occurrence(imported.project, 'F-r11').state.kind).toBe('shop');
    expect(reward(imported.project, 'F-r10-d560915').offer).toEqual({
      rewardType: 'MaxHealthDrop',
    });
  });
});
