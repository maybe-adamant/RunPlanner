import { beforeAll, describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import { projectFromRunRecord, type RunImport } from '../src/import';
import {
  fixture,
  occurrence,
  reward,
  grouped,
  entryLines,
  mismatchLines,
  enteredRooms,
  generatedCustomizations,
} from './support/run-import';

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

  it("picks up H_Combat07's optional rewards its uses show collected in combat", () => {
    const pickups = occurrence(imported.project, 'H-r29').roomActions.order.flatMap((action) =>
      action.kind === 'interactLocalReward' && action.groupKey === 'optionalRewards'
        ? [action.slotKey]
        : [],
    );
    expect(pickups).toEqual(['optional1', 'optional2']);
    // H_Combat15's two listed rewards were left behind.
    expect(
      occurrence(imported.project, 'H-r26').roomActions.order.some(
        (action) => action.kind === 'interactLocalReward' && action.groupKey === 'optionalRewards',
      ),
    ).toBe(false);
  });

  it("opens Narcissus's Mystery Boon on the god whose screen its room recorded", () => {
    // G_Story01 as if Narcissus had given Mixed Blessings and its box opened on Apollo.
    const story = record.rooms[17]!;
    const mixed = projectFromRunRecord(catalog, {
      ...record,
      rooms: [
        ...record.rooms.slice(0, 17),
        {
          ...story,
          uses: {
            OceanusExitDoor: 1,
            NPC_Narcissus_01: 1,
            BlindBoxLoot: 1,
            ApolloUpgrade: 1,
            Mixer5CommonDrop: 1,
          },
          traitScreens: [
            {
              giver: 'NPC_Narcissus_01',
              options: story.traitScreens[0]!.options.map((option) =>
                option.name === 'NarcissusG'
                  ? { ...option, name: 'NarcissusI', chosen: true }
                  : { ...option, chosen: false },
              ),
            },
            {
              giver: 'ApolloUpgrade',
              options: [
                { name: 'ApolloManaBoon', rarity: 'Common', chosen: true },
                { name: 'ApolloExCastBoon', rarity: 'Common', chosen: false },
                { name: 'ApolloCastBoon', rarity: 'Common', chosen: false },
              ],
            },
          ],
          traits: {
            ...story.traits,
            acquired: [
              { name: 'NarcissusI', rarity: 'Common', worldTime: 406.45391821291 },
              { name: 'ApolloManaBoon', rarity: 'Common', worldTime: 408.38725164707 },
            ],
          },
        },
        record.rooms[18]!,
      ],
    });
    const room = occurrence(mixed.project, 'G-r17');
    const box = room.roomActions.order.find(
      (action) => action.kind === 'interactAcquisitionEntry' && action.entryKey === 'mysteryBoon',
    );
    expect(box).toBeDefined();
    expect(
      box?.kind === 'interactAcquisitionEntry' &&
        room.acquisitionSites?.[box.siteKey]?.pickupEntries?.['mysteryBoon']?.offer,
    ).toEqual({
      rewardType: 'BlindBoxLoot',
      payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
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
        encounter: 1,
        fields: 5,
        npc: 1,
        roomActionOrder: 10,
        traitOffer: 3,
      },
      // The three Chaos screens stay: their unpicked curses' durations are never saved.
      // The H and I Preboss Travel Deal refills were never bought.
      notInRecord: { fields: 1, pathOfStars: 1, shop: 2, traitOffer: 3 },
    });
    // The Bridge's taken twin door is the one whose sibling's cages the saved stores explain.
    expect(entryLines(imported.report)).toEqual([
      'assumption traitOffer r1 traitOffer@F-r1:self -> ReplaceTraitOffer(F-r1 chaos)',
      'assumption conversion r2 acquisitionEntry@F-r2 -> ReplaceAcquisitionEntryOffer(F-r2 StackUpgrade)',
      'assumption encounter r4 encounterPhase@F-r4:Encounter -> SelectEncounter(F-r4 ArtemisCombatF)',
      'assumption conversion r4 acquisitionEntry@F-r4 -> ReplaceAcquisitionEntryOffer(F-r4 RoomMoneyDrop)',
      'assumption conversion r8 acquisitionEntry@F-r8 -> ReplaceAcquisitionEntryOffer(F-r8 WeaponUpgrade)',
      'assumption traitOffer r15 traitOffer@G:start:chaos:self -> ReplaceTraitOffer(G:start:chaos chaos)',
      'assumption npc r18 nemesisRandomEvent@G-r18 -> ReplaceNemesisRandomEventInteraction(G-r18 freeItem)',
      'assumption fields r26 localReward@H-r26-d621199:cage1 -> ReplaceLocalReward(H-r26-d621199 MaxHealthDrop)',
      'assumption fields r27 exitDecision@H-r27 -> InitializeExitDecision(H-r27)',
      'assumption fields r27 localReward@H-r27-d621470:cage1 -> ReplaceLocalReward(H-r27-d621470 RoomMoneyDrop)',
      // Two optional rewards collected in combat have no saved point.
      'assumption fields r29 fieldsSpatial@H-r29 -> ReplaceFieldsSpatialPoint(H-r29)',
      'assumption fields r29 fieldsSpatial@H-r29 -> ReplaceFieldsSpatialPoint(H-r29)',
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
    // H_Combat07's Minor Talent, collected in combat, buys its Path of Stars node.
    expect(mismatchLines(imported.report)).toEqual([]);
  });
});
