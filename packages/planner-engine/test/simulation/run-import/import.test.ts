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

/** The run-state differences from the entry saves, one stable line each. */
function mismatchLines(report: RunImportReport): readonly string[] {
  return report.entries
    .filter((entry) => entry.reason === 'mismatch')
    .map(
      (entry) =>
        `${entry.area} r${entry.record?.roomIndex ?? '-'} ${entry.mismatch?.field}: ${entry.mismatch?.expected} | ${entry.mismatch?.actual}`,
    );
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
      interacted: true,
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
      interacted: true,
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
      // The H and I Preboss Travel Deal refills and I_Combat07's Well refill were never bought.
      notInRecord: { fields: 4, pathOfStars: 1, shop: 2, traitOffer: 4, well: 1 },
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
      offerBySlot: {
        first: { rewardType: 'ArmorBoost' },
        secondLeft: { rewardType: 'MaxHealthDrop' },
        secondRight: { rewardType: 'ShopHermesUpgrade' },
      },
      purchaseBySlot: { first: { delay: 8 } },
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
      mismatch: { stores: 5 },
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
    // Ephyra's side-room and Hub stores lose entries the plan does not draw.
    expect(mismatchLines(imported.report)).toEqual([
      'stores r5 SubRoomRewards: RoomMoneyTinyDrop 0 | RoomMoneyTinyDrop 1',
      'stores r8 HubRewards: Boon 0 | Boon 1',
      'stores r10 HubRewards: Boon 4, HermesUpgrade 1, MaxHealthDropBig 1, MaxManaDropBig 1, SpellDrop 1, WeaponUpgrade 1 | Boon 1, HermesUpgrade 0, MaxHealthDropBig 0, MaxManaDropBig 0, SpellDrop 0, WeaponUpgrade 0',
      'stores r12 HubRewards: Boon 3, HermesUpgrade 1, MaxHealthDropBig 1, MaxManaDropBig 1, SpellDrop 1, WeaponUpgrade 1 | Boon 1, HermesUpgrade 0, MaxHealthDropBig 0, MaxManaDropBig 0, SpellDrop 0, WeaponUpgrade 0',
      'stores r14 HubRewards: Boon 3, MaxHealthDropBig 1, MaxManaDropBig 1, SpellDrop 1, WeaponUpgrade 1 | Boon 1, MaxHealthDropBig 0, MaxManaDropBig 0, SpellDrop 0, WeaponUpgrade 0',
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
    const preboss = occurrence(imported.project, 'I-r40');
    expect(
      preboss.state.kind === 'shop' && preboss.state.shop?.offers['infernalContractReward'],
    ).toMatchObject({
      optionKey: 'StackUpgrade',
    });
    expect(preboss.roomActions.order).toContainEqual({
      kind: 'interactShopOffer',
      offerKey: 'infernalContractReward',
    });
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
      // G_PreBoss01's Big Pom screen has no known source; H_PreBoss01's purchases are unknown.
      unsupportedArea: { traitOffer: 3 },
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
        roomActionOrder: 10,
        shop: 1,
        traitOffer: 1,
      },
      mismatch: { stores: 1 },
      // The run was reset in H_Combat04: the rest of Ephyra's Fields is guessed.
      // G_PostBoss01's Well refill was never bought.
      notInRecord: {
        doors: 1,
        fields: 6,
        other: 1,
        reward: 1,
        route: 1,
        traitOffer: 3,
        well: 1,
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

  it('reports each door or wheel reroll as an unsupported area', () => {
    const rerolled = projectFromRunRecord(catalog, {
      ...record,
      route: { ...record.route, biomes: ['F'] },
      rooms: record.rooms
        .slice(0, 14)
        .map((room, index) => (index === 5 ? { ...room, rerolls: 2 } : room)),
    });
    expect(
      rerolled.report.entries.filter((entry) => entry.area === 'reroll').map(describeEntry),
    ).toEqual(['unsupportedArea reroll r5 -', 'unsupportedArea reroll r5 -']);
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
