import { beforeAll, describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import { projectFromRunRecord, type RunImport } from '../../../src/simulation';
import {
  fixture,
  describeEntry,
  occurrence,
  reward,
  grouped,
  entryLines,
  mismatchLines,
  enteredRooms,
} from '../../support/run-import';

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
        doors: 16,
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
        doors: 12,
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
