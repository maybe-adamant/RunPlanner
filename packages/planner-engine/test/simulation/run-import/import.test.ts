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
    expect(
      occurrence(imported.project, 'F-r11:postboss').keepsakeRack?.equipResults?.transcendentEmbryo
        ?.blessingKey,
    ).toBe('ChaosManaCostBlessing');
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
    expect(reward(imported.project, 'F-r1').traitOffersByAcquisitionRole['self']).toMatchObject({
      kind: 'chaos',
      selectedOptionKey: 'option1',
      blessingKey: 'ChaosExSpeedBlessing',
      curseOptions: [{ curseKey: 'ChaosDashCurse', requirementCount: 5 }, {}, {}],
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
        doors: 18,
        encounter: 1,
        fields: 3,
        npc: 1,
        roomActionOrder: 9,
        traitOffer: 3,
      },
      notInRecord: { embryo: 3, fields: 4, pathOfStars: 1, traitOffer: 5 },
      refused: { doors: 1, fields: 2, pool: 1, traitOffer: 1 },
      unsupportedArea: { shop: 2, well: 1 },
    });
    // G_Combat20's positional first door (G_Combat08) is refused at its exit and moves later.
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
      'assumption doors r19 exitDecision@G-r19',
      'refused doors r19d569053 target@G-r19:exit1 -> CreateTarget(G-r20 G_MiniBoss01)',
      'assumption doors r19d776586 target@G-r19:exit2 -> CreateTarget(G-r19-d776586 G_MiniBoss03)',
      'assumption doors r19d569053 target@G-r19:exit3 -> CreateTarget(G-r19-d569053 G_Combat08)',
      'refused traitOffer r20 traitOffer@G-r20:source -> ReplaceTraitOffer(G-r20 ZeusManaBoon|ZeusWeaponBoon|ZeusManaBoltBoon#option2)',
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
      'assumption roomActionOrder r22 occurrence@G-r22',
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

  it('reports every value the record did not answer exactly', () => {
    expect(grouped(imported.report)).toEqual({
      assumption: {
        conversion: 3,
        doors: 19,
        traitOffer: 1,
        reward: 1,
        fields: 1,
        roomActionOrder: 13,
      },
      notInRecord: { traitOffer: 5, fields: 2, shop: 3, route: 1 },
      refused: { fields: 2, traitOffer: 12, pool: 2, shop: 1 },
    });
    // In ascending door id H_Combat07's cages roll before H_Combat05's Mini-Boss door and
    // find no Boon left; the game generated the Mini-Boss door first, which refilled the store.
    // H_PreBoss01's Shop stock was recorded as a Well, so its purchases are unknown.
    // I_WorldShop replaces ShopHermesUpgrade's own requirements; the catalog keeps them.
    // The unattributed Denial lines follow the H_Combat07 cage guess.
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
      'assumption doors r16 exitDecision@G-r16',
      'assumption doors r17 exitDecision@G-r17',
      'assumption doors r19 exitDecision@G-r19',
      'assumption doors r20 exitDecision@G-r20',
      'assumption reward r20 incomingReward@G-r20-d737226 -> ReplaceIncomingReward(G-r20-d737226 Devotion)',
      'assumption doors r26 exitDecision@H-r26',
      'refused fields r27 localReward@H-r27:cage2 -> ReplaceLocalReward(H-r27 HermesUpgrade)',
      'assumption doors r27 exitDecision@H-r27',
      'assumption doors r28 exitDecision@H-r28',
      'assumption fields r28 localReward@H-r28-d564300:cage1',
      'refused fields r29 localReward@H-r29:cage2 -> ReplaceLocalReward(H-r29 Boon)',
      'refused traitOffer r30 traitOffer@H-r30:hiddenSource -> ReplaceTraitOffer(H-r30 CoverRegenerationBoon|DoubleExManaBoon#option1)',
      'refused pool r32 roomFeature@H-r30:postboss -> ReplacePurgingPoolSlot(H-r30:postboss)',
      'refused pool r32 roomFeature@H-r30:postboss -> ReplacePurgingPoolSlot(H-r30:postboss)',
      'assumption doors r34 exitDecision@I-r34',
      'assumption doors r35 exitDecision@I-r35',
      'assumption doors r36 exitDecision@I-r36',
      'assumption doors r37 exitDecision@I-r37',
      'refused shop r40 shopOffer@I-r40 -> ReplaceShopOfferOption(I-r40)',
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
      'assumption roomActionOrder r40 occurrence@I-r40',
      'refused traitOffer r27 -',
      'refused traitOffer r29 -',
      'refused traitOffer r29 -',
      'refused traitOffer r30 -',
      'refused traitOffer r30 -',
      'refused traitOffer r40 -',
      'refused traitOffer r40 -',
      'refused traitOffer r- -',
      'refused traitOffer r- -',
      'refused traitOffer r- -',
      'refused traitOffer r- -',
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
