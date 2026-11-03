import { beforeAll, describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import { projectFromRunRecord, type RunImport } from '../src/import';
import {
  fixture,
  describeEntry,
  occurrence,
  reward,
  grouped,
  entryLines,
  mismatchLines,
  enteredRooms,
  expectReachesLastRoom,
} from './support/run-import';

describe('run import of the live Underworld recording', () => {
  const record = fixture('underworld-live');
  let imported: RunImport;
  beforeAll(() => {
    imported = projectFromRunRecord(catalog, record);
  });

  it('enters every room through H_Combat07, the Zagreus contract included, and stops at its unseen cage roll', () => {
    // The recording holds no entry saves, so no save can judge the cage roll H_Combat07's
    // doors never show (its Unseen Sigil is not modelled either): the plan stops there.
    expect(imported.kind === 'stopped' && imported.stop).toMatchObject({
      code: 'batchStateMissing',
      record: { roomIndex: 27 },
    });
    expect(enteredRooms(imported.project, 'incomplete')).toEqual(
      record.rooms.slice(0, 28).map((room) => room.name),
    );
  });

  it('takes the Midshop Zagreus contract door as its additional exit, not an ordinary one', () => {
    expect(occurrence(imported.project, 'G-r17').additionalExits).toEqual([
      { kind: 'zagreusContract', key: 'zagreusContract', occurrenceId: 'G-r18' },
    ]);
    expect(occurrence(imported.project, 'G-r18').gameName).toBe('C_Boss01');
    // The Shop's two ordinary doors are still offered beside the contract.
    expect(occurrence(imported.project, 'G-r17-d561374').gameName).toBe('G_MiniBoss03');
  });

  it("imports Gorgon's Athena, Steady Growth and the Contract pedestal", () => {
    expect(
      occurrence(imported.project, 'F-r2').encounters.gorgonResultByPhase?.['Encounter'],
    ).toEqual({
      athenaTriggerConditionMet: true,
      athenaOffer: {
        traitKeys: ['InvulnerabilityCastBoon', 'AthenaProjectileBoon', 'InvulnerabilityDashBoon'],
        selectedOptionKey: 'option1',
      },
    });
    expect(reward(imported.project, 'G-r22').traitOffersByAcquisitionRole['source']).toMatchObject({
      // Its second cycle falls past the plan's stop at H_Combat07.
      steadyGrowthTargets: { 1: 'HermesCastDiscountBoon' },
    });
    // The pedestal stands in the boon form of G's Preboss.
    const preboss = occurrence(imported.project, 'G-r22');
    expect(preboss.infernalContractPedestal).toMatchObject({ optionKey: 'StackUpgradeBig' });
    expect(preboss.roomActions.order).toContainEqual({ kind: 'interactInfernalContractPedestal' });
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
      assumption: { conversion: 3, encounter: 2, traitOffer: 1, reward: 1, roomActionOrder: 10 },
      notInRecord: { traitOffer: 1 },
      // H_Combat07's Unseen Sigil is not modelled.
      unsupportedArea: { other: 1 },
      stopped: { fields: 1 },
    });
    // Fig Leaf, racked at F_PostBoss01, skipped one encounter in each of G and H: the record
    // predates the skip mark, so each is inferred from a rolled phase with no kills.
    // F_Combat13 and H_Combat05 declare their native door order, so their batches carry no
    // door-order assumption.
    expect(entryLines(imported.report)).toEqual([
      'assumption conversion r1 acquisitionEntry@F-r1 -> ReplaceAcquisitionEntryOffer(F-r1 RoomMoneyDrop)',
      'assumption conversion r8 acquisitionEntry@F-r8 -> ReplaceAcquisitionEntryOffer(F-r8 MaxHealthDrop)',
      'assumption conversion r10 acquisitionEntry@F-r10 -> ReplaceAcquisitionEntryOffer(F-r10 StackUpgrade)',
      'assumption traitOffer r15 traitOffer@G-r15:self -> ReplaceTraitOffer(G-r15 chaos)',
      'assumption encounter r16 encounterPhase@G-r16:Encounter -> ReplaceFigLeafSkip(G-r16)',
      'assumption reward r20 incomingReward@G-r20-d737226 -> ReplaceIncomingReward(G-r20-d737226 Devotion)',
      'assumption encounter r26 encounterPhase@H-r26:Cage02 -> ReplaceFigLeafSkip(H-r26)',
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
    ]);
  });
});

describe('run import of the Underworld attempt reset at H_Combat04', () => {
  const record = fixture('underworld-1010');
  let imported: RunImport;
  beforeAll(() => {
    imported = projectFromRunRecord(catalog, record);
  });

  it("enters every recorded room and stops at the last room's unseen spatial point", () => {
    // No save follows H_Combat04, so nothing judges its open questions.
    expectReachesLastRoom(imported);
    expect(enteredRooms(imported.project, 'incomplete')).toEqual(
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
        fields: 4,
        reroll: 1,
        roomActionOrder: 10,
        shop: 1,
        traitOffer: 1,
      },
      notInRecord: {
        fields: 1,
        // Each rerolled screen's earlier screen is a guess: the record keeps the final one.
        reroll: 2,
      },
      // The run was reset in H_Combat04, whose questions no later save judges.
      stopped: { fields: 1 },
    });
    expect(entryLines(imported.report)).toEqual([
      'assumption conversion r1 acquisitionEntry@F-r1 -> ReplaceAcquisitionEntryOffer(F-r1 Boon)',
      'assumption conversion r3 acquisitionEntry@F-r3 -> ReplaceAcquisitionEntryOffer(F-r3 MaxManaDrop)',
      'assumption conversion r8 acquisitionEntry@F-r8 -> ReplaceAcquisitionEntryOffer(F-r8 Boon)',
      'assumption traitOffer r22 traitOffer@G-r22:source -> ReplaceTraitOffer(G-r22 ZeusManaBoon|CastAnywhereBoon|ElementalDamageFloorBoon#option3)',
      // Its one screen reroll names a loot object id; the first rerollable screen takes it.
      'assumption reroll r22 traitOffer@G-r22:source -> ReplaceTraitOffer(G-r22 ZeusManaBoon|CastAnywhereBoon|ElementalDamageFloorBoon#option3)',
      'assumption shop r22 shopOffer@G-r22 -> ReplaceShopOfferOption(G-r22)',
      // An optional reward collected in combat has no saved point.
      'assumption fields r26 fieldsSpatial@H-r26 -> ReplaceFieldsSpatialPoint(H-r26)',
      'assumption fields r26 localReward@H-r26-d564448:cage1 -> ReplaceLocalReward(H-r26-d564448 MaxManaDrop)',
      'assumption fields r27 localReward@H-r27-d621470:cage1 -> ReplaceLocalReward(H-r27-d621470 HermesUpgrade)',
      'assumption fields r28 localReward@H-r28-d565616:cage1 -> ReplaceLocalReward(H-r28-d565616 HermesUpgrade)',
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
    expect(mismatchLines(imported.report)).toEqual([]);
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
