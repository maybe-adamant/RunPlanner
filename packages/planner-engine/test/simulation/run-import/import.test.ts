import { readFileSync } from 'node:fs';

import { beforeAll, describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createRewardWheelOfferAddress,
  type OccurrenceId,
  type ProjectCommand,
  type ProjectDocument,
  type RoomOccurrence,
  type SemanticAddress,
} from '../../../src/authored-project';
import type { ResolvedRewardOffer } from '../../../src/reward-kernel';
import { decodeRunRecord, type RunRecord } from '../../../src/run-record';
import {
  occurrenceSnapshot,
  recordedEntryStates,
  storeCounts,
} from '../../../src/simulation/run-import/conformance';
import { RunImportWalk } from '../../../src/simulation/run-import/import';
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

/** The run-state differences from the entry saves, one stable line each. */
function mismatchLines(report: RunImportReport): readonly string[] {
  return report.entries
    .filter((entry) => entry.reason === 'mismatch')
    .map(
      (entry) =>
        `${entry.area} r${entry.record?.roomIndex ?? '-'} ${entry.mismatch?.field}: ${entry.mismatch?.expected} | ${entry.mismatch?.actual}`,
    );
}

/** The project with a ship's unpicked wheel offers replaced, by wheel. */
function withWheelOffers(
  project: ProjectDocument,
  occurrenceId: string,
  values: Readonly<Record<string, ResolvedRewardOffer>>,
): ProjectDocument {
  const ship = occurrence(project, occurrenceId);
  const biome = project.route.biomes.find((entry) =>
    entry.topology?.occurrences.some((candidate) => candidate.occurrenceId === occurrenceId),
  )!;
  return Object.entries(values).reduce((current, [wheelKey, value]) => {
    const wheel = ship.state.kind === 'shipCombat' ? ship.state.wheels[wheelKey] : undefined;
    if (wheel === undefined) throw new Error(`${occurrenceId} has no ${wheelKey}`);
    return applyProjectCommand(current, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: createRewardWheelOfferAddress(
        createBiomeAddress(project.route.routeKey, biome.biomeKey),
        ship.occurrenceId,
        wheelKey,
        `offer${3 - wheel.pickedOfferIndex}`,
      ),
      value,
    });
  }, project);
}

/** What later rooms read of a ship's draws as it is left: stores, priorities, god pool and rerolls. */
function shipExitState(project: ProjectDocument, occurrenceId: string) {
  const assembly = simulateProjectAssembly(catalog, project);
  const biomeKey = project.route.biomes.find((entry) =>
    entry.topology?.occurrences.some((candidate) => candidate.occurrenceId === occurrenceId),
  )!.biomeKey;
  const snapshot = occurrenceSnapshot(
    assembly,
    { biomeKey, occurrenceId: occurrenceId as OccurrenceId },
    'beforeRoomExit',
  );
  if (snapshot === undefined) throw new Error(`${occurrenceId} was not left`);
  return {
    stores: Object.fromEntries(
      [...storeCounts(catalog, project.route.routeKey, snapshot)].map(([key, { counts }]) => [
        key,
        counts,
      ]),
    ),
    priorities: snapshot.rewardPriorities,
    godPool: snapshot.godPool,
    rerolls: snapshot.rerolls.remaining,
  };
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

  it('completes as a valid plan entering every recorded room, the Ixion Chaos detours included', () => {
    expect(imported.kind).toBe('complete');
    expect(enteredRooms(imported.project)).toEqual(record.rooms.map((room) => room.name));
  });

  it('imports the loadout', () => {
    expect(imported.project.route.loadout).toMatchObject({
      weaponKey: 'WeaponStaffSwing',
      aspectKey: 'StaffClearCastAspect',
      familiarKey: record.loadout.familiar!.name,
      startingKeepsakeKey: 'HadesAndPersephoneKeepsake',
      keepsakeEquipResults: { jeweledPom: { traitKey: 'HadesInvisibilityRetaliateBoon' } },
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

  it('customizes every generated encounter, Fields cages included, from its inverse', () => {
    expect(generatedCustomizations(imported.project)).toBe(22);
  });

  it('imports World Shop, Well and Pool purchases and the Anvil of Fates', () => {
    const shop = occurrence(imported.project, 'F-r6');
    expect(shop.roomActions.order).toContainEqual({ kind: 'interactShopOffer', offerKey: 'Boon' });
    expect(occurrence(imported.project, 'F-r3').stygianWell).toMatchObject({
      offerKeyBySlot: {
        healing: 'TemporaryDoorHealTrait',
        secondLeft: 'TemporaryEmptySlotDamageTrait',
        secondRight: 'TemporaryMoveSpeedTrait',
      },
      purchasedGenerationKeys: ['initial:secondLeft', 'initial:secondRight'],
    });
    // Travel Deal restocked the H Postboss Well with the item bought unstocked.
    expect(occurrence(imported.project, 'H-r30:postboss').stygianWell).toMatchObject({
      travelDealRefillKey: 'TemporaryMoveSpeedTrait',
      purchasedGenerationKeys: ['initial:secondRight', 'travelDealRefill'],
    });
    const pool = occurrence(imported.project, 'F-r11:postboss');
    expect(pool.purgingPool).toEqual({
      traitKeyBySlot: {
        left: 'BoonDecayBoon',
        middle: 'AphroditeManaBoon',
        right: 'AresCastBoon',
      },
    });
    expect(pool.roomActions.order).toContainEqual({
      kind: 'sellPurgingPoolTrait',
      slotKey: 'left',
    });
    const anvil = occurrence(imported.project, 'I-r40');
    expect(
      anvil.state.kind === 'shop' &&
        anvil.state.shop?.offers['PremiumProgress']?.reward?.anvilResultsByAcquisitionRole?.[
          'self'
        ],
    ).toEqual({
      kind: 'anvilOfFates',
      removedTraitKey: 'StaffAttackRecoveryTrait',
      addedTraitKeys: ['StaffLongAttackTrait', 'StaffOneWayAttackTrait'],
    });
  });

  it('imports keepsake racks, the Embryo, the Spell and its Path of Stars', () => {
    expect(occurrence(imported.project, 'H-r30:postboss').keepsakeRack?.keepsakeKey).toBe(
      'LowHealthCritKeepsake',
    );
    // Each Embryo blessing keeps its saved roll; Celerity's values follow from its rarity.
    expect(occurrence(imported.project, 'F-r11:postboss').keepsakeRack?.equipResults).toEqual({
      transcendentEmbryo: {
        blessingKey: 'ChaosManaCostBlessing',
        blessingValues: { costReduction: 0.5 },
      },
      transcendentEmbryoTransformations: {
        '1': { blessingKey: 'ChaosCastBlessing', blessingValues: { damageBonus: 0.74 } },
      },
    });
    const spell = reward(imported.project, 'F-r10').traitOffersByAcquisitionRole['self'];
    // The Spell sat in the middle: its bank point explains the fourth node of the first Path screen.
    expect(spell).toMatchObject({
      selectedOptionKey: 'option2',
      hexTree: { layoutKey: 'Pyramid' },
    });
    expect(reward(imported.project, 'G-r19').hexActivationsByAcquisitionRole?.['self']).toEqual({
      selectedNodeKeys: ['1:2', '2:1', '3:2', '4:2'],
    });
  });

  it('imports Chaos pairs, Fields cages and points, and the Nemesis event', () => {
    // The picked pair's rolls are its saved curse fields and pending blessing.
    expect(reward(imported.project, 'F-r1').traitOffersByAcquisitionRole['self']).toMatchObject({
      kind: 'chaos',
      selectedOptionKey: 'option1',
      blessingKey: 'ChaosExSpeedBlessing',
      curseOptions: [{ curseKey: 'ChaosDashCurse', requirementCount: 5 }, {}, {}],
      selectedCurseValues: { magickLoss: 19 },
      rarity: 'Epic',
      blessingValues: { weaponSpeed: 0.72, propertySpeed: 0.77 },
    });
    expect(
      reward(imported.project, 'G:start:chaos').traitOffersByAcquisitionRole['self'],
    ).toMatchObject({
      blessingKey: 'ChaosWeaponBlessing',
      selectedCurseValues: { magickLoss: 10 },
      blessingValues: { damageBonus: 0.4 },
    });
    expect(
      reward(imported.project, 'I-r38:chaos').traitOffersByAcquisitionRole['self'],
    ).toMatchObject({
      blessingKey: 'ChaosLastStandBlessing',
      selectedCurseValues: { magickLoss: 15 },
      blessingValues: {},
    });
    const fields = occurrence(imported.project, 'H-r26').state;
    expect(fields.kind === 'fieldsCombat' && fields.cages['cage1']?.offer).toEqual({
      rewardType: 'WeaponUpgrade',
    });
    expect(fields.kind === 'fieldsCombat' && fields.spatial).toMatchObject({
      entryStartPointId: 760471,
      optionalPointIdBySlot: { optional1: 572849, optional2: 737955 },
    });
    expect(occurrence(imported.project, 'G-r18').encounters.nemesisRandomEventByPhase).toEqual({
      Encounter: { kind: 'freeItem' },
    });
  });

  it("collects Narcissus's gifts and aims G_PreBoss01's random Pom at the boon it raised", () => {
    // Heavenly Splendor drops two Elemental Essences; the room's uses picked up both.
    expect(
      occurrence(imported.project, 'G-r17')
        .roomActions.order.filter(
          (action) =>
            action.kind === 'interactAcquisitionEntry' &&
            action.siteKey.startsWith('traitGenerated:'),
        )
        .map((action) => action.kind === 'interactAcquisitionEntry' && action.entryKey),
    ).toEqual(['elementalBoost1', 'elementalBoost2']);
    // The Aphrodite boon bought there is the only trait whose level rose before G_Boss01.
    const preboss = occurrence(imported.project, 'G-r22').state;
    expect(
      preboss.kind === 'shop' &&
        preboss.shop?.offers['Minor']?.reward?.levelResolutionsByAcquisitionRole?.['self'],
    ).toEqual({ kind: 'random', targetTraitKey: 'HighHealthOffenseBoon' });
  });

  it("places each gathering tool's element in its room and reads Tartarus's non-goal cap", () => {
    expect(imported.project.route.resourcePlacements).toEqual({
      Pickaxe: { biomeKey: 'F', occurrenceId: 'F-r1' },
      Exorcism: { biomeKey: 'I', occurrenceId: 'I-r36' },
      Shovel: { biomeKey: 'F', occurrenceId: 'F-r0' },
      Fishing: { biomeKey: 'H', occurrenceId: 'H-r26' },
    });
    expect(imported.project.route.biomes.find((biome) => biome.biomeKey === 'I')?.state).toEqual({
      maxNonGoalRewards: 5,
    });
  });

  it('reports every value the record did not answer exactly', () => {
    expect(grouped(imported.report)).toEqual({
      assumption: {
        conversion: 3,
        doors: 15,
        encounter: 1,
        fields: 3,
        npc: 1,
        roomActionOrder: 10,
        traitOffer: 3,
      },
      // The three Chaos screens stay: their unpicked curses' durations are never saved.
      // The entry saves' run state where the plan's simulation holds another.
      mismatch: { elements: 1, pathOfStars: 1, stores: 2, traits: 3 },
      // The H and I Preboss Travel Deal refills were never bought.
      notInRecord: { fields: 4, pathOfStars: 1, shop: 2, traitOffer: 4 },
      refused: { fields: 2, pool: 1 },
      // H_Combat07's cage boon screen stays unused.
      unsupportedArea: { traitOffer: 1 },
    });
    // H_Combat07's first two cages lose their store entries to the guessed cages of its twin door.
    expect(entryLines(imported.report)).toEqual([
      'assumption traitOffer r1 traitOffer@F-r1:self -> ReplaceTraitOffer(F-r1 chaos)',
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
      'assumption traitOffer r15 traitOffer@G:start:chaos:self -> ReplaceTraitOffer(G:start:chaos chaos)',
      'assumption doors r15 exitDecision@G:start:chaos',
      'assumption doors r16 exitDecision@G-r16',
      'assumption npc r18 nemesisRandomEvent@G-r18 -> ReplaceNemesisRandomEventInteraction(G-r18 freeItem)',
      'assumption doors r18 exitDecision@G-r18',
      'assumption doors r20 exitDecision@G-r20',
      'assumption doors r21 exitDecision@G-r21',
      'assumption doors r26 exitDecision@H-r26',
      'assumption fields r26 localReward@H-r26-d621199:cage1',
      'assumption fields r27 exitDecision@H-r27 -> InitializeExitDecision(H-r27)',
      'assumption doors r27 exitDecision@H-r27',
      'assumption fields r27 localReward@H-r27-d621470:cage1',
      'assumption doors r28 exitDecision@H-r28',
      'refused fields r29 localReward@H-r29:cage1 -> ReplaceLocalReward(H-r29 StackUpgrade)',
      'refused fields r29 localReward@H-r29:cage2 -> ReplaceLocalReward(H-r29 MaxManaDrop)',
      'refused pool r32 roomFeature@H-r30:postboss -> ReplacePurgingPoolSlot(H-r30:postboss)',
      'assumption traitOffer r39 traitOffer@I-r38:chaos:self -> ReplaceTraitOffer(I-r38:chaos chaos)',
      'assumption roomActionOrder r2 occurrence@F-r2',
      'assumption roomActionOrder r4 occurrence@F-r4',
      'assumption roomActionOrder r8 occurrence@F-r8',
      'assumption roomActionOrder r13 occurrence@F-r11:postboss',
      'assumption roomActionOrder r17 occurrence@G-r17',
      'assumption roomActionOrder r22 occurrence@G-r22',
      'assumption roomActionOrder r24 occurrence@G-r22:postboss',
      'assumption roomActionOrder r26 occurrence@H-r26',
      'assumption roomActionOrder r29 occurrence@H-r29',
      'assumption roomActionOrder r32 occurrence@H-r30:postboss',
    ]);
    expect(mismatchLines(imported.report)).toEqual([
      // H_Combat07's guessed cages of its twin door take other store entries.
      'stores r29 RunProgress: Boon 2, RoomMoneyDrop 2 | Boon 3, RoomMoneyDrop 1',
      // H_Combat07's unused cage screen, its Talent and its optional rewards.
      'traits r30 HeraSpecialBoon: Heroic level 7 | Heroic level 8',
      'traits r30 DoubleBoltBoon: Epic level 4 | absent',
      'stores r30 FieldsOptionalRewards: MinorTalentDrop 1, RoomMoneyTinyDrop 2 | MinorTalentDrop 2, RoomMoneyTinyDrop 3',
      'pathOfStars r30 Invested: 5:1 | none other',
      'elements r30 Elements: Air 6 | Air 5',
      // The plan's armor is never damaged, so Arachne's costume never breaks.
      'traits r32 CastDamageCostume: absent | held',
    ]);
  });
});

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
      notInRecord: { menace: 17, shop: 10 },
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

describe('run import of the Surface victory', () => {
  const record = fixture('surface-victory');
  let imported: RunImport;
  beforeAll(() => {
    imported = projectFromRunRecord(catalog, record);
  });

  it("stops at O_MiniBoss01's All Together, past O_Combat07's Vivid Sea Poseidon as a fifth god", () => {
    expect(imported.kind).toBe('stopped');
    expect(imported.kind === 'stopped' && imported.stop).toMatchObject({
      area: 'other',
      code: 'allTogetherResultMissing',
      record: { roomIndex: 24, visit: 0 },
    });
    expect(
      imported.report.entries.some(
        (entry) => entry.reason === 'refused' && entry.record?.roomIndex === 21,
      ),
    ).toBe(false);
  });

  it("imports Aspect of Selene's Nacelle tree with its slot-0 node", () => {
    expect(imported.project.route.loadout.aspectHexTree).toMatchObject({
      layoutKey: 'Nacelle',
      nodes: { '3:0': 'MoonBeamDamageTalent', '3:1': 'MoonBeamVulnerabilityTalent' },
    });
  });

  it("authors the Hub board's new gods before N_Combat15's repeated Hera", () => {
    expect(reward(imported.project, 'N-r13').offer).toEqual({
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'HeraUpgrade' },
    });
    expect(reward(imported.project, 'N-r9').offer).toEqual({
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'HephaestusUpgrade' },
    });
  });

  it("aims the Phial's fountain at the boon whose rarity rose there", () => {
    const hub = imported.project.route.biomes
      .find((biome) => biome.biomeKey === 'N')
      ?.topology?.decisions.find((decision) => decision.kind === 'hub');
    expect(hub?.kind === 'hub' && hub.fountainRarityResult).toEqual({
      targetTraitKey: 'ApolloSprintBoon',
    });
  });

  it("buys N_PreBoss01's Travel Deal refill as the second boon screen's god", () => {
    // The blind box opens the room's first screen, Hera; the refill is the Zeus boon after it.
    const preboss = occurrence(imported.project, 'N-r17');
    expect(preboss.state.kind === 'shop' && preboss.state.shop?.travelDealRefill).toMatchObject({
      optionKey: 'RandomLoot',
      reward: {
        offer: { rewardType: 'RandomLoot', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
        traitOffersByAcquisitionRole: {
          source: { giverKey: 'Zeus', selectedOptionKey: 'option2' },
        },
      },
    });
  });

  it("solves O_Combat12's two unpicked RunProgress offers from the saved stores", () => {
    const ship = occurrence(imported.project, 'O-r23').state;
    expect(ship.kind === 'shipCombat' && ship.wheels).toMatchObject({
      wheel1: {
        pickedOfferIndex: 2,
        offers: {
          offer1: { offer: { rewardType: 'MaxManaDrop' } },
          offer2: { offer: { rewardType: 'RoomMoneyDrop' } },
        },
      },
      wheel2: {
        pickedOfferIndex: 2,
        offers: {
          offer1: { offer: { rewardType: 'Boon', payload: { source: 'ApolloUpgrade' } } },
          offer2: { offer: { rewardType: 'WeaponUpgrade' } },
        },
      },
    });
    // The swapped assignment fits as well and leaves the same exit state, so neither is reported.
    const swapped = withWheelOffers(imported.project, 'O-r23', {
      wheel1: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
      wheel2: { rewardType: 'MaxManaDrop' },
    });
    expect(shipExitState(swapped, 'O-r23')).toEqual(shipExitState(imported.project, 'O-r23'));
  });

  it("leaves no trace of an unpicked wheel boon's god in the ship's exit state", () => {
    const hera = withWheelOffers(imported.project, 'O-r23', {
      wheel2: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'HeraUpgrade' } },
    });
    expect(shipExitState(hera, 'O-r23')).toEqual(shipExitState(imported.project, 'O-r23'));
  });

  it('reports a wheel window whose saved stores no assignment reproduces', () => {
    // The game's RunProgress lost one more StackUpgrade across O_Combat12 than its two unpicked offers explain.
    const states = recordedEntryStates(record);
    const altered: RunRecord = {
      ...record,
      rooms: record.rooms.map((room, index) => {
        if (index !== 24) return room;
        const runProgress = { ...states[24]!.rewardStores.get('RunProgress') };
        runProgress['StackUpgrade'] = runProgress['StackUpgrade']! - 1;
        return {
          ...room,
          entry: {
            ...room.entry,
            rewardStores: { ...room.entry?.rewardStores, RunProgress: runProgress },
          },
        };
      }),
    };
    const result = projectFromRunRecord(catalog, altered);
    expect(result.kind === 'stopped' && result.stop.record).toEqual({ roomIndex: 24, visit: 0 });
    expect(
      result.report.entries
        .filter((entry) => entry.area === 'wheel' && entry.record?.roomIndex === 23)
        .map(describeEntry),
    ).toEqual([
      'mismatch wheel r23 rewardWheel@O-r23',
      // The provisional values stay, each a guess.
      'notInRecord wheel r23 rewardWheelOffer@O-r23 -> ReplaceRewardWheelOffer(O-r23 MaxManaDrop)',
      'notInRecord wheel r23 rewardWheelOffer@O-r23 -> ReplaceRewardWheelOffer(O-r23 StackUpgrade)',
    ]);
    const ship = occurrence(result.project, 'O-r23').state;
    expect(
      ship.kind === 'shipCombat' &&
        [ship.wheels['wheel1'], ship.wheels['wheel2']].map(
          (wheel) => wheel?.offers['offer1']?.offer.rewardType,
        ),
    ).toEqual(['MaxManaDrop', 'StackUpgrade']);
  });

  it('reports a recorded wheel conversion no pickup of the ship can take once its window closes', () => {
    // O_Combat07 records a second, one-offer wheel the plan's ship never rolls, so it has no pickup.
    const altered: RunRecord = {
      ...record,
      rooms: record.rooms.map((room, index) =>
        index === 21
          ? {
              ...room,
              conversions: { timePiece: 1 },
              wheels: [room.wheels![0]!, { ...room.wheels![0]!, offers: 1 }],
            }
          : room,
      ),
    };
    const result = projectFromRunRecord(catalog, altered);
    expect(
      result.report.entries
        .filter((entry) => entry.area === 'conversion' && entry.record?.roomIndex === 21)
        .map(describeEntry),
    ).toEqual(['refused conversion r21 occurrence@O-r21']);
  });

  it('reports every value the record did not answer exactly', () => {
    expect(grouped(imported.report)).toEqual({
      assumption: { conversion: 2, shop: 1, traitOffer: 2 },
      notInRecord: { reward: 1 },
      stopped: { other: 1 },
    });
    expect(entryLines(imported.report)).toEqual([
      'assumption conversion r14 acquisitionEntry@N-r14 -> ReplaceAcquisitionEntryOffer(N-r14 HermesUpgrade)',
      'assumption traitOffer r17 traitOffer@N-r17:hiddenSource -> ReplaceTraitOffer(N-r17 HeraSpecialBoon|HeraCastBoon|DamageShareRetaliateBoon#option3)',
      'assumption shop r17 shopOffer@N-r17 -> ReplaceShopOfferOption(N-r17)',
      'assumption conversion r22 acquisitionEntry@O-r22 -> ReplaceAcquisitionEntryOffer(O-r22 StackUpgrade)',
      'assumption traitOffer r23 traitOffer@O-r23:hiddenSource -> ReplaceTraitOffer(O-r23 ZeusCastBoon|ZeusManaBoon|BoltRetaliateBoon#option1)',
    ]);
    // O_Combat12's solved offers draw what the game drew, so its pickups and stores agree.
    expect(mismatchLines(imported.report)).toEqual([]);
  });
});

describe('run import of rows a held rarify source logged one rarity high', () => {
  /**
   * O_Combat07's Poseidon screen, under the Conch Shell's provider rarify use,
   * logging the picked row and one unpicked row as hovered: one step high.
   */
  function hoveredPoseidonScreen(): RunRecord {
    const record = fixture('surface-victory');
    const hovered: Readonly<Record<string, string>> = {
      PoseidonCastBoon: 'Heroic',
      DoubleRewardBoon: 'Epic',
    };
    return {
      ...record,
      rooms: record.rooms.slice(0, 24).map((room, index) =>
        index !== 21
          ? room
          : {
              ...room,
              traitScreens: room.traitScreens.map((screen) => ({
                ...screen,
                options: screen.options.map((option) => {
                  const rarity = hovered[option.name];
                  return rarity === undefined ? option : { ...option, rarity };
                }),
              })),
            },
      ),
    };
  }

  function poseidonScreen(imported: RunImport) {
    return imported.report.entries
      .filter((entry) => entry.area === 'traitOffer' && entry.record?.roomIndex === 21)
      .map((entry) => ({
        reason: entry.reason,
        value: entry.applied?.kind === 'ReplaceTraitOffer' ? entry.applied.value : undefined,
      }));
  }

  it('takes the pick from its acquired trait and lowers an unpicked row only the lower rarity admits', () => {
    expect(poseidonScreen(projectFromRunRecord(catalog, hoveredPoseidonScreen()))).toEqual([
      {
        reason: 'assumption',
        value: expect.objectContaining({
          giverKey: 'Poseidon',
          options: [
            { traitKey: 'PoseidonCastBoon', rarity: 'Epic' },
            { traitKey: 'PoseidonManaBoon', rarity: 'Epic' },
            { traitKey: 'DoubleRewardBoon', rarity: 'Rare' },
          ],
          selectedOptionKey: 'option3',
        }),
      },
    ]);
  });
});

describe('run import of Sea Star duplicates', () => {
  /** The Surface capture with Sea Star picked at O_MiniBoss01 and duplicates counted after it. */
  function surfaceWithSeaStar(): RunRecord {
    const record = fixture('surface');
    const rename = (name: string) =>
      name === 'EncounterStartOffenseBuffBoon' ? 'DoubleRewardBoon' : name;
    return {
      ...record,
      rooms: record.rooms.map((room, index) =>
        index === 23
          ? {
              ...room,
              traitScreens: room.traitScreens.map((screen) => ({
                ...screen,
                options: screen.options.map((option) => ({ ...option, name: rename(option.name) })),
              })),
              traits: {
                ...room.traits,
                acquired: room.traits.acquired.map((trait) => ({
                  ...trait,
                  name: rename(trait.name),
                })),
              },
            }
          : index === 24 || index === 25
            ? { ...room, doubleRewards: 1 }
            : room,
      ),
    };
  }

  it("duplicates the room's own reward and leaves a duplicate without one unplaced", () => {
    const imported = projectFromRunRecord(catalog, surfaceWithSeaStar());
    expect(imported.kind).toBe('complete');
    const reprieve = occurrence(imported.project, 'O-r24');
    expect(reprieve.roomActions.order).toContainEqual(
      expect.objectContaining({ kind: 'interactAcquisitionEntry', entryKey: 'seaStarDuplicate' }),
    );
    expect(
      imported.report.entries
        .filter((entry) => entry.area === 'reward' && (entry.record?.roomIndex ?? 0) >= 24)
        .map(describeEntry),
    ).toEqual([
      'assumption reward r24 acquisitionRole@O-r24:self -> ReplaceSeaStarResult(O-r24)',
      'notInRecord reward r25 incomingReward@O-r25',
    ]);
  });
});

describe('run import of the live Underworld recording', () => {
  const record = fixture('underworld-live');
  let imported: RunImport;
  beforeAll(() => {
    imported = projectFromRunRecord(catalog, record);
  });

  it('completes as a valid plan entering every recorded room, the Zagreus contract included', () => {
    expect(imported.kind).toBe('complete');
    expect(enteredRooms(imported.project)).toEqual(record.rooms.map((room) => room.name));
  });

  it("keeps I_MiniBoss02's logged pick above its acquired rarity with no rarify source held", () => {
    // Logged Epic, acquired Rare: no hover explains the step.
    expect(reward(imported.project, 'I-r36').traitOffersByAcquisitionRole['source']).toMatchObject({
      options: [{}, { traitKey: 'ElementalRarityUpgradeBoon', rarity: 'Epic' }, {}],
      selectedOptionKey: 'option2',
    });
  });

  it('takes the Midshop Zagreus contract door as its additional exit, not an ordinary one', () => {
    expect(occurrence(imported.project, 'G-r17').additionalExits).toEqual([
      { kind: 'zagreusContract', key: 'zagreusContract', occurrenceId: 'G-r18' },
    ]);
    expect(occurrence(imported.project, 'G-r18').gameName).toBe('C_Boss01');
    // The Shop's two ordinary doors are still offered beside the contract.
    expect(occurrence(imported.project, 'G-r17-d561374').gameName).toBe('G_MiniBoss03');
  });

  it("imports Gorgon's Athena, Echo's Pom target, Steady Growth and the Contract pedestal", () => {
    expect(
      occurrence(imported.project, 'F-r2').encounters.gorgonResultByPhase?.['Encounter'],
    ).toEqual({
      athenaTriggerConditionMet: true,
      athenaOffer: {
        traitKeys: ['InvulnerabilityCastBoon', 'AthenaProjectileBoon', 'InvulnerabilityDashBoon'],
        selectedOptionKey: 'option1',
      },
    });
    const echo = occurrence(imported.project, 'H-r28').encounters.traitOffersByPhase?.[
      'Encounter'
    ]?.['Story_Echo_01'];
    expect(echo?.kind === 'traits' && echo.options[1]).toEqual({
      traitKey: 'EchoDoubleLevelBoon',
      echoPomTarget: 'HestiaCastBoon',
    });
    expect(reward(imported.project, 'G-r22').traitOffersByAcquisitionRole['source']).toMatchObject({
      steadyGrowthTargets: { 1: 'HermesCastDiscountBoon', 2: 'ApolloSprintBoon' },
    });
    // The pedestal stands in the Shop form and in the boon form alike.
    for (const [occurrenceId, optionKey] of [
      ['I-r40', 'StackUpgrade'],
      ['G-r22', 'StackUpgradeBig'],
    ] as const) {
      const preboss = occurrence(imported.project, occurrenceId);
      expect(preboss.infernalContractPedestal, occurrenceId).toMatchObject({ optionKey });
      expect(preboss.roomActions.order, occurrenceId).toContainEqual({
        kind: 'interactInfernalContractPedestal',
      });
    }
    expect(occurrence(imported.project, 'G-r22').state.kind).toBe('freeReward');
  });

  it("imports H_Combat07's Hestia cage and Concave Stone's extra pick from it", () => {
    const cage = occurrence(imported.project, 'H-r27').state;
    const offer =
      cage.kind === 'fieldsCombat'
        ? cage.cages['cage2']?.traitOffersByAcquisitionRole['source']
        : undefined;
    expect(offer).toMatchObject({
      giverKey: 'Hestia',
      selectedOptionKey: 'option3',
      concaveStoneResult: { kind: 'proc', optionKey: 'option1' },
    });
    expect(offer?.kind === 'traits' && offer.options[0]?.traitKey).toBe('HestiaManaBoon');
  });

  it('reports every value the record did not answer exactly', () => {
    expect(grouped(imported.report)).toEqual({
      assumption: {
        conversion: 3,
        doors: 18,
        encounter: 3,
        traitOffer: 1,
        reward: 1,
        fields: 1,
        roomActionOrder: 12,
      },
      notInRecord: { traitOffer: 1, fields: 2, shop: 3, route: 1 },
      refused: { traitOffer: 4, pool: 1 },
      // H_PreBoss01's purchases are unknown.
      unsupportedArea: { traitOffer: 2 },
    });
    // Fig Leaf, racked at F_PostBoss01, skipped one encounter in each of G, H and I: the record
    // predates the skip mark, so each is inferred from a rolled phase with no kills.
    // H_Combat05 declares its native door order, so its batch carries no door-order assumption.
    // H_PreBoss01's Shop stock was recorded as a Well, so its purchases are unknown.
    expect(entryLines(imported.report)).toEqual([
      'assumption conversion r1 acquisitionEntry@F-r1 -> ReplaceAcquisitionEntryOffer(F-r1 RoomMoneyDrop)',
      'assumption doors r1 exitDecision@F-r1',
      'assumption doors r2 exitDecision@F-r2',
      'assumption doors r3 exitDecision@F-r3',
      'assumption doors r5 exitDecision@F-r5',
      'assumption doors r6 exitDecision@F-r6',
      'assumption conversion r8 acquisitionEntry@F-r8 -> ReplaceAcquisitionEntryOffer(F-r8 MaxHealthDrop)',
      'assumption doors r8 exitDecision@F-r8',
      'assumption doors r9 exitDecision@F-r9',
      'assumption conversion r10 acquisitionEntry@F-r10 -> ReplaceAcquisitionEntryOffer(F-r10 StackUpgrade)',
      'assumption traitOffer r15 traitOffer@G-r15:self -> ReplaceTraitOffer(G-r15 chaos)',
      'assumption doors r15 exitDecision@G-r15',
      'assumption encounter r16 encounterPhase@G-r16:Encounter -> ReplaceFigLeafSkip(G-r16)',
      'assumption doors r16 exitDecision@G-r16',
      'assumption doors r17 exitDecision@G-r17',
      'assumption doors r19 exitDecision@G-r19',
      'assumption doors r20 exitDecision@G-r20',
      'assumption reward r20 incomingReward@G-r20-d737226 -> ReplaceIncomingReward(G-r20-d737226 Devotion)',
      'assumption encounter r26 encounterPhase@H-r26:Cage02 -> ReplaceFigLeafSkip(H-r26)',
      'assumption doors r27 exitDecision@H-r27',
      'assumption doors r28 exitDecision@H-r28',
      'assumption fields r28 localReward@H-r28-d564300:cage1',
      'refused traitOffer r30 traitOffer@H-r30:hiddenSource -> ReplaceTraitOffer(H-r30 CoverRegenerationBoon|DoubleExManaBoon#option1)',
      'refused pool r32 roomFeature@H-r30:postboss -> ReplacePurgingPoolSlot(H-r30:postboss)',
      'assumption encounter r34 encounterPhase@I-r34:Encounter -> ReplaceFigLeafSkip(I-r34)',
      'assumption doors r34 exitDecision@I-r34',
      'assumption doors r35 exitDecision@I-r35',
      'assumption doors r36 exitDecision@I-r36',
      'assumption doors r37 exitDecision@I-r37',
      'assumption roomActionOrder r1 occurrence@F-r1',
      'assumption roomActionOrder r2 occurrence@F-r2',
      'assumption roomActionOrder r8 occurrence@F-r8',
      'assumption roomActionOrder r10 occurrence@F-r10',
      'assumption roomActionOrder r11 occurrence@F-r11',
      'assumption roomActionOrder r13 occurrence@F-r11:postboss',
      'assumption roomActionOrder r18 occurrence@G-r18',
      'assumption roomActionOrder r24 occurrence@G-r22:postboss',
      'assumption roomActionOrder r26 occurrence@H-r26',
      'assumption roomActionOrder r27 occurrence@H-r27',
      'assumption roomActionOrder r29 occurrence@H-r29',
      'assumption roomActionOrder r32 occurrence@H-r30:postboss',
      'refused traitOffer r30 -',
      'refused traitOffer r30 -',
      'refused traitOffer r- -',
    ]);
  });
});

describe('run import of the Underworld attempt reset at H_Combat04', () => {
  const record = fixture('underworld-1010');
  let imported: RunImport;
  beforeAll(() => {
    imported = projectFromRunRecord(catalog, record);
  });

  it('completes as a valid plan entering every recorded room before completing its biome', () => {
    expect(imported.kind).toBe('complete');
    expect(enteredRooms(imported.project).slice(0, record.rooms.length)).toEqual(
      record.rooms.map((room) => room.name),
    );
  });

  it("imports each Artificer boon from its god's screen", () => {
    const boon = (occurrenceId: string) =>
      Object.values(occurrence(imported.project, occurrenceId).acquisitionSites ?? {}).flatMap(
        (site) => Object.values(site.pickupEntries ?? {}),
      )[0];
    expect(boon('F-r1')).toMatchObject({
      offer: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
      traitOffersByAcquisitionRole: { source: { giverKey: 'Zeus', selectedOptionKey: 'option2' } },
    });
    expect(boon('F-r8')).toMatchObject({
      offer: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'AresUpgrade' } },
      traitOffersByAcquisitionRole: { source: { giverKey: 'Ares', selectedOptionKey: 'option1' } },
    });
  });

  it('splits the boss Arcana between Judgment and the Crystal Figurine', () => {
    const fBoss = occurrence(imported.project, 'F-r11:boss').encounters;
    expect([...(fBoss.judgmentArcanaKeysByPhase?.['Encounter'] ?? [])].sort()).toEqual([
      'BonusHealth',
      'DoorReroll',
      'ScreenReroll',
      'StatusVulnerability',
      'TradeOff',
    ]);
    expect([...(fBoss.figurineArcanaKeysByPhase?.['Encounter'] ?? [])].sort()).toEqual([
      'EpicRarityBoost',
      'StartingGold',
    ]);
    expect(
      occurrence(imported.project, 'G-r22:boss').encounters.judgmentArcanaKeysByPhase?.[
        'Encounter'
      ],
    ).toHaveLength(5);
  });

  it("imports the racked Gorgon Amulet's Athena at H_Combat07's first cage", () => {
    // The passive encounter starts late (`DelayedStart`), so it never runs encounter-start effects.
    expect(occurrence(imported.project, 'H-r26').encounters.gorgonResultByPhase).toMatchObject({
      Passive: { athenaTriggerConditionMet: false },
      Cage01: {
        athenaTriggerConditionMet: true,
        athenaOffer: {
          traitKeys: [
            'InvulnerabilityCastBoon',
            'FocusLastStandBoon',
            'RetaliateInvulnerabilityBoon',
          ],
          selectedOptionKey: 'option1',
        },
      },
    });
  });

  it("buys G_PreBoss01's Travel Deal refill as the Poseidon boon its room used", () => {
    const preboss = occurrence(imported.project, 'G-r22');
    expect(preboss.state.kind === 'shop' && preboss.state.shop?.travelDealRefill).toMatchObject({
      optionKey: 'RandomLoot',
      reward: {
        offer: {
          rewardType: 'RandomLoot',
          payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' },
        },
        traitOffersByAcquisitionRole: {
          source: { giverKey: 'Poseidon', selectedOptionKey: 'option3' },
        },
      },
    });
    expect(preboss.roomActions.order).toContainEqual({
      kind: 'interactAcquisitionEntry',
      siteKey: 'roomExit',
      entryKey: 'travelDealRefill',
    });
  });

  it("imports Aspect of Selene's rolled tree without its God Sent nodes", () => {
    expect(imported.project.route.loadout.aspectHexTree).toMatchObject({ layoutKey: 'Pyramid' });
    expect(imported.project.route.loadout.aspectHexTree?.nodes['4:3']).toBeUndefined();
  });

  it('reports every value the record did not answer exactly', () => {
    expect(grouped(imported.report)).toEqual({
      // G_PreBoss01's Travel Deal refill is the Poseidon boon its room used beyond its stock.
      assumption: {
        conversion: 3,
        doors: 14,
        fields: 3,
        reroll: 1,
        roomActionOrder: 10,
        shop: 1,
        traitOffer: 1,
      },
      mismatch: { stores: 1 },
      // The run was reset in H_Combat04: the rest of Ephyra's Fields is guessed.
      notInRecord: {
        doors: 1,
        fields: 6,
        other: 1,
        // Each rerolled screen's earlier screen is a guess: the record keeps the final one.
        reroll: 2,
        reward: 1,
        route: 1,
        traitOffer: 3,
      },
    });
    expect(entryLines(imported.report)).toEqual([
      'assumption conversion r1 acquisitionEntry@F-r1 -> ReplaceAcquisitionEntryOffer(F-r1 Boon)',
      'assumption doors r1 exitDecision@F-r1',
      'assumption conversion r3 acquisitionEntry@F-r3 -> ReplaceAcquisitionEntryOffer(F-r3 MaxManaDrop)',
      'assumption doors r3 exitDecision@F-r3',
      'assumption doors r4 exitDecision@F-r4',
      'assumption doors r6 exitDecision@F-r6',
      'assumption doors r7 exitDecision@F-r7',
      'assumption conversion r8 acquisitionEntry@F-r8 -> ReplaceAcquisitionEntryOffer(F-r8 Boon)',
      'assumption doors r8 exitDecision@F-r8',
      'assumption doors r9 exitDecision@F-r9',
      'assumption doors r16 exitDecision@G-r16',
      'assumption doors r17 exitDecision@G-r17',
      'assumption doors r19 exitDecision@G-r19',
      'assumption doors r20 exitDecision@G-r20',
      'assumption traitOffer r22 traitOffer@G-r22:source -> ReplaceTraitOffer(G-r22 ZeusManaBoon|CastAnywhereBoon|ElementalDamageFloorBoon#option3)',
      // Its one screen reroll names a loot object id; the first rerollable screen takes it.
      'assumption reroll r22 traitOffer@G-r22:source -> ReplaceTraitOffer(G-r22 ZeusManaBoon|CastAnywhereBoon|ElementalDamageFloorBoon#option3)',
      'assumption shop r22 shopOffer@G-r22 -> ReplaceShopOfferOption(G-r22)',
      'assumption doors r26 exitDecision@H-r26',
      'assumption fields r26 localReward@H-r26-d564448:cage1',
      'assumption doors r27 exitDecision@H-r27',
      'assumption fields r27 localReward@H-r27-d621470:cage1',
      'assumption doors r28 exitDecision@H-r28',
      'assumption fields r28 localReward@H-r28-d565616:cage1',
      'assumption roomActionOrder r1 occurrence@F-r1',
      'assumption roomActionOrder r3 occurrence@F-r3',
      'assumption roomActionOrder r6 occurrence@F-r6',
      'assumption roomActionOrder r8 occurrence@F-r8',
      'assumption roomActionOrder r13 occurrence@F-r11:postboss',
      'assumption roomActionOrder r17 occurrence@G-r17',
      'assumption roomActionOrder r22 occurrence@G-r22',
      'assumption roomActionOrder r24 occurrence@G-r22:postboss',
      'assumption roomActionOrder r26 occurrence@H-r26',
      'assumption roomActionOrder r29 occurrence@H-r29',
    ]);
    expect(mismatchLines(imported.report)).toEqual([
      // H_Combat07's optional rewards are guessed: one was collected during combat, without a point.
      'stores r27 FieldsOptionalRewards: MaxHealthDropSmall 1 | MaxHealthDropSmall 2',
    ]);
  });

  it("authors each screen's recorded rerolls on its final rows", () => {
    // The record keeps only the final screen; the rerolled one is a guessed legal screen.
    expect(reward(imported.project, 'G-r18').traitOffersByAcquisitionRole['source']).toMatchObject({
      giverKey: 'Zeus',
      rerolledScreens: [{ options: expect.any(Array) }],
    });
    const preboss = occurrence(imported.project, 'G-r22').state;
    expect(
      preboss.kind === 'shop' &&
        preboss.shop?.offers['Boon']?.reward?.traitOffersByAcquisitionRole['source'],
    ).toMatchObject({ giverKey: 'Zeus', rerolledScreens: [{ options: expect.any(Array) }] });
  });

  it('reports door rerolls the stores do not show as an unsupported area', () => {
    const rerolled = projectFromRunRecord(catalog, {
      ...record,
      route: { ...record.route, biomes: ['F'] },
      rooms: record.rooms
        .slice(0, 14)
        .map((room, index) => (index === 5 ? { ...room, rerolls: 2 } : room)),
    });
    expect(
      rerolled.report.entries.filter((entry) => entry.area === 'reroll').map(describeEntry),
    ).toEqual([
      // The recorded count against the plan's pool, which no saved spend moved.
      'mismatch reroll r5 -',
      'unsupportedArea reroll r5 -',
      'unsupportedArea reroll r5 -',
    ]);
  });
});

describe('run import of door, wheel, cage and Hub rerolls', () => {
  /**
   * The record as if room `roomIndex` had pressed one more door, wheel or cage
   * reroll: its count rises unless a gain hid it from the recorder, the pool
   * falls by one in every later entry save,
   * and `store` changes by `delta` from the next entry save on wherever a save
   * holds it.
   */
  function withReroll(
    record: RunRecord,
    roomIndex: number,
    store: string,
    delta: Readonly<Record<string, number>>,
    counted = true,
  ): RunRecord {
    const states = recordedEntryStates(record);
    return {
      ...record,
      rooms: record.rooms.map((room, index) => {
        if (index === roomIndex)
          return counted ? { ...room, rerolls: (room.rerolls ?? 0) + 1 } : room;
        if (index < roomIndex || room.entry === undefined) return room;
        const entry = {
          ...room.entry,
          ...(room.entry.numRerolls === undefined ? {} : { numRerolls: room.entry.numRerolls - 1 }),
        };
        if (index !== roomIndex + 1 && room.entry.rewardStores?.[store] === undefined)
          return { ...room, entry };
        const counts: Record<string, number> = { ...states[index]!.rewardStores.get(store) };
        for (const [name, change] of Object.entries(delta)) {
          counts[name] = (counts[name] ?? 0) + change;
          if (counts[name]! < 0) throw new Error(`${store} ${name} below zero at room ${index}`);
        }
        return {
          ...room,
          entry: { ...entry, rewardStores: { ...entry.rewardStores, [store]: counts } },
        };
      }),
    };
  }

  /** One complete on-route fill of a store, by reward type. */
  function fill(store: string, routeKey: string): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const entry of catalog.rewards.stores.byKey[store]!.entries)
      if (entry.routeKeys === undefined || entry.routeKeys.includes(routeKey))
        counts[entry.rewardType] = (counts[entry.rewardType] ?? 0) + 1;
    return counts;
  }

  /** Erebus and Oceanus of run 1010, whose F Boss Arcana draw added The Enchantress. */
  function oceanus(): RunRecord {
    const record = fixture('underworld-1010');
    const rooms = record.rooms.slice(0, 25);
    const { exit: _exit, ...last } = rooms[24]!;
    void _exit;
    return {
      ...record,
      route: { biomes: ['F', 'G'], dream: false },
      outcome: { kind: 'abandoned', endingRoom: last.name },
      rooms: [...rooms.slice(0, 24), last],
    };
  }

  /**
   * The Surface victory with The Enchantress held from the start in The Lovers'
   * place, its Epic rank's three rerolls kept in every entry save.
   */
  function surfaceWithEnchantress(roomCount?: number): RunRecord {
    const fixtureRecord = fixture('surface-victory');
    const record: RunRecord = {
      ...fixtureRecord,
      rooms: fixtureRecord.rooms.map((room) => ({
        ...room,
        entry: { ...room.entry, numRerolls: 3 },
      })),
    };
    const loadout = {
      ...record.loadout,
      arcana: record.loadout.arcana.map((card) =>
        card.name === 'ChanneledBlock' ? { name: 'DoorReroll', level: 3 } : card,
      ),
    };
    if (roomCount === undefined) return { ...record, loadout };
    const rooms = record.rooms.slice(0, roomCount);
    const { exit: _exit, ...last } = rooms[roomCount - 1]!;
    void _exit;
    return {
      ...record,
      loadout,
      route: { biomes: ['N'], dream: false },
      outcome: { kind: 'abandoned', endingRoom: last.name },
      rooms: [...rooms.slice(0, -1), last],
    };
  }

  const rerollLines = (imported: RunImport, roomIndex: number) =>
    imported.report.entries
      .filter(
        (entry) =>
          entry.record?.roomIndex === roomIndex ||
          (entry.reason === 'mismatch' && entry.record?.roomIndex === roomIndex + 1),
      )
      .filter(
        (entry) =>
          entry.area === 'reroll' ||
          entry.reason === 'mismatch' ||
          (entry.area === 'wheel' && entry.address?.kind === 'rewardWheel'),
      )
      .map(describeEntry);

  const pressesOf = (project: ProjectDocument, occurrenceId: string) =>
    occurrence(project, occurrenceId).roomActions.order.filter(
      (action) => action.kind === 'reroll',
    );

  it("redraws the first door that can have drawn the store's lost reward", () => {
    const imported = projectFromRunRecord(
      catalog,
      withReroll(oceanus(), 20, 'RunProgress', { MaxHealthDrop: -1 }),
    );
    expect(rerollLines(imported, 20)).toEqual(['assumption reroll r20 occurrence@G-r20']);
    expect(pressesOf(imported.project, 'G-r20')).toEqual([
      {
        kind: 'reroll',
        rerollId: 'r1',
        target: { kind: 'door', exitKey: 'exit1', occurrenceId: 'G-r20-d609579' },
        reward: { rewardType: 'RoomMoneyDrop' },
      },
    ]);
    expect(reward(imported.project, 'G-r20-d609579').offer).toEqual({
      rewardType: 'MaxHealthDrop',
    });
  });

  it('finds a press a gain hid from the recorded count by the pool the plan runs ahead', () => {
    const imported = projectFromRunRecord(
      catalog,
      withReroll(oceanus(), 20, 'RunProgress', { MaxHealthDrop: -1 }, false),
    );
    expect(rerollLines(imported, 20)).toEqual(['assumption reroll r20 occurrence@G-r20']);
    expect(pressesOf(imported.project, 'G-r20')).toHaveLength(1);
  });

  it('reports a pool spend the stores do not show, and the pool it leaves ahead', () => {
    const record = oceanus();
    const imported = projectFromRunRecord(catalog, {
      ...record,
      rooms: record.rooms.map((room, index) =>
        index > 20 && room.entry?.numRerolls !== undefined
          ? { ...room, entry: { ...room.entry, numRerolls: room.entry.numRerolls - 1 } }
          : room,
      ),
    });
    expect(rerollLines(imported, 20)).toEqual([
      'mismatch reroll r20 -',
      'unsupportedArea reroll r20 -',
      'mismatch reroll r21 -',
    ]);
    expect(mismatchLines(imported.report)).toEqual([
      'reroll r20 rerolls: 1 | 0',
      'reroll r21 NumRerolls: 8 | 9',
    ]);
  });

  it('authors recorded Well and Pool rerolls unpinned, placing purchases and sales on the last', () => {
    const record = fixture('underworld');
    const rooms = record.rooms.slice(0, 14);
    const { exit: _exit, ...last } = rooms[13]!;
    void _exit;
    const imported = projectFromRunRecord(catalog, {
      ...record,
      route: { biomes: ['F'], dream: false },
      outcome: { kind: 'abandoned', endingRoom: last.name },
      rooms: [...rooms.slice(0, 13), { ...last, spentRerolls: { WellShop: 1, SellTraits: 1 } }],
    });
    const postboss = occurrence(imported.project, 'F-r11:postboss');
    // The opening stock stays the initial roll; the record keeps no later roll's content.
    expect(postboss.stygianWell?.offerKeyBySlot.secondRight).toBe('TemporaryForcedSecretDoorTrait');
    expect(postboss.roomActions.order.slice(2)).toEqual([
      {
        kind: 'rerollStygianWell',
        rerollId: 'r1',
        offerKeyBySlot: { secondRight: 'TemporaryForcedSecretDoorTrait' },
      },
      { kind: 'rerollPurgingPool', rerollId: 'r1', traitKeyBySlot: { left: 'BoonDecayBoon' } },
      { kind: 'purchaseStygianWellOffer', generationKey: 'r1:secondRight' },
      { kind: 'sellPurgingPoolTrait', slotKey: 'left', rollKey: 'r1' },
    ]);
    expect(
      imported.report.entries
        .filter((entry) => entry.reason === 'assumption' && entry.record?.roomIndex === 13)
        .map(describeEntry),
    ).toEqual(
      expect.arrayContaining([
        'assumption well r13 roomFeature@F-r11:postboss',
        'assumption pool r13 roomFeature@F-r11:postboss',
      ]),
    );
  });

  it('reports a Well reroll in a room whose plan holds no Well', () => {
    const record = oceanus();
    const imported = projectFromRunRecord(catalog, {
      ...record,
      rooms: record.rooms.map((room, index) =>
        index === 20 ? { ...room, spentRerolls: { WellShop: 1 } } : room,
      ),
    });
    expect(rerollLines(imported, 20)).toEqual(['unsupportedArea reroll r20 -']);
  });

  it("solves a bracket whose stores refilled, and keeps the taken door's screen", () => {
    // G_Shop01's MiniBoss doors refill RunProgress; the extra Boon is the taken door's first draw.
    const imported = projectFromRunRecord(
      catalog,
      withReroll(oceanus(), 17, 'RunProgress', { Boon: -1 }),
    );
    expect(rerollLines(imported, 17)).toEqual(['assumption reroll r17 occurrence@G-r17']);
    const entered = occurrence(imported.project, 'G-r18');
    expect(reward(imported.project, 'G-r18').offer).toEqual({
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'AresUpgrade' },
    });
    expect(entered.rerolledIncomingReward).toMatchObject({
      offer: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
      traitOffersByAcquisitionRole: {
        source: { giverKey: 'Zeus', rerolledScreens: [{ options: expect.any(Array) }] },
      },
    });
  });

  it('reports each press when the placement does not reproduce the saved stores', () => {
    // The saves claim a refill the plan's press, with its reward still in store, does not make.
    const imported = projectFromRunRecord(
      catalog,
      withReroll(oceanus(), 20, 'RunProgress', {
        ...fill('RunProgress', 'Underworld'),
        MaxHealthDrop: fill('RunProgress', 'Underworld')['MaxHealthDrop']! - 1,
      }),
    );
    expect(rerollLines(imported, 20)).toEqual([
      'notInRecord reroll r20 roomAction@G-r20',
      expect.stringMatching(/^mismatch stores r21 /),
    ]);
  });

  it('redraws a Fields cage of the door its bracket opened', () => {
    const imported = projectFromRunRecord(
      catalog,
      withReroll(fixture('underworld-1010'), 28, 'RunProgress', { Boon: -1 }),
    );
    expect(rerollLines(imported, 28)).toEqual(['assumption reroll r28 occurrence@H-r28']);
    expect(pressesOf(imported.project, 'H-r28')).toMatchObject([
      {
        target: { kind: 'cage', occurrenceId: 'H-r29', slotKey: 'cage1' },
        reward: { rewardType: 'WeaponUpgrade' },
      },
    ]);
    const fields = occurrence(imported.project, 'H-r29').state;
    expect(fields.kind === 'fieldsCombat' && fields.cages['cage1']?.offer).toMatchObject({
      rewardType: 'Boon',
    });
    expect(fields.kind === 'fieldsCombat' && fields.rerolledCages?.['cage1']).toMatchObject({
      offer: { rewardType: 'WeaponUpgrade' },
      traitOffersByAcquisitionRole: { self: { giverKey: 'WeaponUpgrade' } },
    });
  });

  it("redraws a ship wheel's unpicked offer before the wheel is used", () => {
    const imported = projectFromRunRecord(
      catalog,
      withReroll(surfaceWithEnchantress(), 22, 'MetaProgress', { MetaCurrencyBigDrop: -1 }),
    );
    // The wheel's unpicked offer and the press's replaced draw are solved together. A press on
    // the picked offer, first showing MetaCurrencyBigDrop, loses the same draws, so it is not
    // reported: the plan holds it as a press on the unpicked offer.
    expect(rerollLines(imported, 22)).toEqual([]);
    const ship = occurrence(imported.project, 'O-r22');
    expect(ship.roomActions.order.slice(0, 2)).toEqual([
      {
        kind: 'reroll',
        rerollId: 'r1',
        target: { kind: 'wheelOffer', wheelKey: 'wheel1', offerKey: 'offer2' },
        reward: { rewardType: 'GiftDrop' },
      },
      { kind: 'chooseRewardWheel', wheelKey: 'wheel1' },
    ]);
    expect(ship.state.kind === 'shipCombat' && ship.state.wheels['wheel1']).toMatchObject({
      offers: { offer2: { offer: { rewardType: 'MetaCurrencyBigDrop' } } },
      rerolledOffers: { offer2: { offer: { rewardType: 'GiftDrop' } } },
    });
  });

  it("redraws a Hub board door before the Hub's first visit", () => {
    const imported = projectFromRunRecord(
      catalog,
      withReroll(surfaceWithEnchantress(4), 2, 'HubRewards', { WeaponUpgrade: -1 }),
    );
    expect(rerollLines(imported, 2)).toEqual(['assumption reroll r2 hubDecision@N:hub']);
    const hub = imported.project.route.biomes[0]!.topology!.decisions.find(
      (decision) => decision.kind === 'hub',
    );
    expect(hub?.kind === 'hub' && hub.actions.slice(0, 2)).toEqual([
      {
        kind: 'reroll',
        rerollId: 'r1',
        hubSlotKey: 'combat19',
        reward: { rewardType: 'MaxManaDropBig' },
      },
      { kind: 'roomVisit', hubSlotKey: 'combat03' },
    ]);
    expect(reward(imported.project, 'N-r2-d560620').offer).toEqual({
      rewardType: 'WeaponUpgrade',
    });
  });
  it('redraws a Hub board door in the restored stay whose bracket shows the spend', () => {
    // N_Combat19, never entered, shows MaxManaDropBig until the fourth Hub visit's press.
    const base = withReroll(surfaceWithEnchantress(10), 8, 'HubRewards', { WeaponUpgrade: -1 });
    const record: RunRecord = {
      ...base,
      rooms: base.rooms.map((room, index) =>
        index < 8 || room.name !== 'N_Hub'
          ? room
          : {
              ...room,
              doors: room.doors.map((door) =>
                door.door === 560620 ? { ...door, reward: { type: 'WeaponUpgrade' } } : door,
              ),
            },
      ),
    };
    const imported = projectFromRunRecord(catalog, record);
    expect(rerollLines(imported, 8)).toEqual(['assumption reroll r8 hubDecision@N:hub']);
    const hub = imported.project.route.biomes[0]!.topology!.decisions.find(
      (decision) => decision.kind === 'hub',
    );
    expect(hub?.kind === 'hub' && hub.actions.slice(3, 5)).toEqual([
      { kind: 'roomVisit', hubSlotKey: 'combat21' },
      {
        kind: 'reroll',
        rerollId: 'r1',
        hubSlotKey: 'combat19',
        reward: { rewardType: 'WeaponUpgrade' },
      },
    ]);
    expect(reward(imported.project, 'N-r2-d560620').offer).toEqual({
      rewardType: 'MaxManaDropBig',
    });
  });
  it('reports a door pressed twice in one restored Hub stay', () => {
    // The visit saves one door change, but the stores lose two draws: the first press's is lost.
    const base = withReroll(
      withReroll(surfaceWithEnchantress(10), 8, 'HubRewards', { WeaponUpgrade: -1 }),
      8,
      'HubRewards',
      { MaxHealthDropBig: -1 },
    );
    const record: RunRecord = {
      ...base,
      rooms: base.rooms.map((room, index) =>
        index < 8 || room.name !== 'N_Hub'
          ? room
          : {
              ...room,
              doors: room.doors.map((door) =>
                door.door === 560620 ? { ...door, reward: { type: 'WeaponUpgrade' } } : door,
              ),
            },
      ),
    };
    const imported = projectFromRunRecord(catalog, record);
    expect(rerollLines(imported, 8)).toEqual([
      'unsupportedArea reroll r8 -',
      'unsupportedArea reroll r8 -',
    ]);
    const hub = imported.project.route.biomes[0]!.topology!.decisions.find(
      (decision) => decision.kind === 'hub',
    );
    expect(hub?.kind === 'hub' && hub.actions.some((action) => action.kind === 'reroll')).toBe(
      false,
    );
  });
});

describe('run import of Fig Leaf skip marks in the live Underworld recording', () => {
  /**
   * The live run through H; `skipped` marks the named phases as a record written
   * after the skip mark would.
   */
  function liveThroughH(skipped: readonly number[] = []): RunRecord {
    const record = fixture('underworld-live');
    return {
      ...record,
      route: { ...record.route, biomes: ['F', 'G', 'H'] },
      rooms: record.rooms.slice(0, 33).map((room, index) => ({
        ...room,
        ...(!skipped.includes(index)
          ? {}
          : {
              encounters: room.encounters.map((encounter) => ({
                ...encounter,
                skipped: true as const,
              })),
            }),
      })),
    };
  }

  it('imports a marked Fig Leaf skip exactly and infers none beside it', () => {
    const imported = projectFromRunRecord(catalog, liveThroughH([16]));
    expect(imported.kind).toBe('complete');
    expect(occurrence(imported.project, 'G-r16').encounters.figLeafSkipByPhase).toEqual({
      Encounter: true,
    });
    // A record that marks skips leaves H's unmarked zero-kill cage as played.
    expect(occurrence(imported.project, 'H-r26').encounters.figLeafSkipByPhase['Cage02']).toBe(
      false,
    );
    expect(imported.report.entries.filter((entry) => entry.area === 'encounter')).toEqual([]);
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

  it("routes a profile's first attempt, whose run count is zero, to the Fresh File route", () => {
    const record = fixture('underworld');
    const result = projectFromRunRecord(catalog, {
      ...record,
      run: { ...record.run, runCount: 0 },
      route: { ...record.route, biomes: ['F'] },
      rooms: record.rooms.slice(0, 3),
    });
    expect(result.project.route.routeKey).toBe('FreshFile');
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

  it("takes the twin door whose god the next room's reward names", () => {
    // F_Combat13's two doors both lead to F_Combat02; the Zeus door, listed second, was taken.
    const record = fixture('underworld-live');
    const rooms = record.rooms.slice(0, 14).map((room, index) =>
      index === 2
        ? {
            ...room,
            doors: [
              {
                door: 561217,
                room: 'F_Combat02',
                reward: { type: 'Boon', lootName: 'AresUpgrade' },
              },
              {
                door: 566353,
                room: 'F_Combat02',
                reward: { type: 'Boon', lootName: 'ZeusUpgrade' },
              },
            ],
          }
        : index === 3
          ? { ...room, reward: { type: 'Boon', lootName: 'ZeusUpgrade', store: 'RunProgress' } }
          : room,
    );
    const { exit: _exit, ...last } = rooms[13]!;
    void _exit;
    const imported = projectFromRunRecord(catalog, {
      ...record,
      route: { biomes: ['F'], dream: false },
      outcome: { kind: 'abandoned', endingRoom: last.name },
      rooms: [...rooms.slice(0, 13), last],
    });
    expect(reward(imported.project, 'F-r3').offer).toMatchObject({
      payload: { source: 'ZeusUpgrade' },
    });
    expect(reward(imported.project, 'F-r2-d561217').offer).toMatchObject({
      payload: { source: 'AresUpgrade' },
    });
  });

  it('maps the recorded Shop door to the takeover Shop target whatever its id', () => {
    const imported = projectFromRunRecord(catalog, erebusWithLowShopDoor());
    expect(imported.kind).toBe('complete');
    expect(occurrence(imported.project, 'F-r11').state.kind).toBe('shop');
    expect(reward(imported.project, 'F-r10-d560915').offer).toEqual({
      rewardType: 'MaxHealthDrop',
    });
  });
});

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

describe('run import of unpicked ship-wheel offers the saved stores cannot settle', () => {
  const wheelLines = (imported: RunImport) =>
    imported.report.entries.filter((entry) => entry.area === 'wheel').map(describeEntry);

  it('reports each unpicked offer of a record without entry saves', () => {
    const record = fixture('surface');
    const imported = projectFromRunRecord(catalog, {
      ...record,
      rooms: record.rooms.map((room) => {
        const { entry: _entry, ...rest } = room;
        void _entry;
        return rest;
      }),
    });
    // Each takes the first type of its wheel's store the engine supports.
    expect(wheelLines(imported)).toEqual([
      'notInRecord wheel r21 rewardWheelOffer@O-r21 -> ReplaceRewardWheelOffer(O-r21 GiftDrop)',
      'notInRecord wheel r25 rewardWheelOffer@O-r25 -> ReplaceRewardWheelOffer(O-r25 MetaCurrencyBigDrop)',
      'notInRecord wheel r25 rewardWheelOffer@O-r25 -> ReplaceRewardWheelOffer(O-r25 MaxHealthDrop)',
    ]);
  });

  it('reports each unpicked offer of a ship that is the last room', () => {
    const record = fixture('surface');
    const rooms = record.rooms.slice(0, 26);
    const { exit: _exit, ...last } = rooms[25]!;
    void _exit;
    const imported = projectFromRunRecord(catalog, {
      ...record,
      outcome: { kind: 'abandoned', endingRoom: last.name },
      rooms: [...rooms.slice(0, 25), last],
    });
    expect(wheelLines(imported)).toEqual([
      'notInRecord wheel r25 rewardWheelOffer@O-r25 -> ReplaceRewardWheelOffer(O-r25 GiftDrop)',
      'notInRecord wheel r25 rewardWheelOffer@O-r25 -> ReplaceRewardWheelOffer(O-r25 MaxHealthDrop)',
    ]);
  });
});
