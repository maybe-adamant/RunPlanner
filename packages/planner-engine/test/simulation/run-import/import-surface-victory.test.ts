import { beforeAll, describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import type { RunRecord, RunRecordWheel } from '../../../src/run-record';
import { recordedEntryStates } from '../../../src/simulation/run-import/conformance';
import { RunImportWalk } from '../../../src/simulation/run-import/import';
import {
  projectFromRunRecord,
  simulateProjectAssembly,
  type RunImport,
  type RunImportReportEntry,
} from '../../../src/simulation';
import {
  fixture,
  describeEntry,
  occurrence,
  reward,
  grouped,
  entryLines,
  mismatchLines,
  withWheelOffers,
  shipExitState,
  enteredRooms,
  seaStarDuplicates,
} from '../../support/run-import';

describe('run import of the Surface victory', () => {
  const record = fixture('surface-victory');
  let imported: RunImport;
  beforeAll(() => {
    imported = projectFromRunRecord(catalog, record);
  });

  it("completes as a valid plan entering every recorded room, past O_Combat07's Vivid Sea Poseidon as a fifth god", () => {
    expect(imported.kind).toBe('complete');
    expect(enteredRooms(imported.project)).toEqual(record.rooms.map((room) => room.name));
    expect(
      imported.report.entries.some(
        (entry) => entry.reason === 'refused' && entry.record?.roomIndex === 21,
      ),
    ).toBe(false);
  });

  it("pairs P_Combat16's doors with the one pairing its exits admit, and keeps door order where two are legal", () => {
    const targets = (occurrenceId: string) => {
      const decision = imported.project.route.biomes
        .flatMap((biome) => biome.topology?.decisions ?? [])
        .find(
          (entry) =>
            entry.kind === 'exit' &&
            entry.source.kind === 'occurrence' &&
            entry.source.occurrenceId === occurrenceId,
        );
      return decision?.kind === 'exit'
        ? decision.normal.targets.map(
            (target) =>
              `${target.exitKey} ${occurrence(imported.project, target.occurrenceId).gameName}`,
          )
        : [];
    };
    // Its first exit leads indoors: P_Combat09 (door 723131) takes it, P_Combat05 the outdoor one.
    expect(targets('P-r32')).toEqual(['exit1 P_Combat09', 'exit2 P_Combat05']);
    expect(reward(imported.project, 'P-r32-d723130').offer).toEqual({ rewardType: 'StackUpgrade' });
    expect(
      imported.report.entries.filter(
        (entry) => entry.area === 'doors' && entry.record?.roomIndex === 32,
      ),
    ).toEqual([]);
    // P_Combat09's two Mini-Boss doors fit either exit: ascending door id stays an assumption.
    expect(targets('P-r33')).toEqual(['exit1 P_MiniBoss01', 'exit2 P_MiniBoss02']);
    expect(entryLines(imported.report)).toContain('assumption doors r33 exitDecision@P-r33');
  });

  it("splits P_Combat03's new Path nodes between its Talent drop and the Sea Star duplicate", () => {
    const room = occurrence(imported.project, 'P-r31');
    const first =
      room.state.kind === 'counted'
        ? room.state.reward?.hexActivationsByAcquisitionRole?.['self']?.selectedNodeKeys
        : undefined;
    const duplicate = seaStarDuplicates(imported.project, 'P-r31')[0]
      ?.hexActivationsByAcquisitionRole?.['self']?.selectedNodeKeys;
    // Each drop takes its count of nodes reachable in layout order; any valid split invests the same tree.
    expect(first).toEqual(['3:0', '3:2', '3:5', '4:2', '4:4', '4:5', '5:2', '5:3']);
    expect(duplicate).toEqual(['5:4', '6:2', '6:4']);
    const invested = (index: number) =>
      Object.entries(record.rooms[index]!.spell!.talents).flatMap(([node, talent]) =>
        talent.invested ? [node] : [],
      );
    expect([...invested(23), ...first!, ...duplicate!].sort()).toEqual(invested(31).sort());
    expect(
      imported.report.entries
        .filter((entry) => entry.record?.roomIndex === 31 && entry.area === 'pathOfStars')
        .map(describeEntry),
    ).toEqual([]);
  });

  it('places each Sea Star duplicate on the pickup whose object its room used once more', () => {
    const duplicated = (occurrenceId: string) =>
      seaStarDuplicates(imported.project, occurrenceId)
        .map((entry) => entry.offer.rewardType)
        .sort();
    // O_Combat12's third money use is wheel1's picked RoomMoneyDrop used again.
    expect(duplicated('O-r23')).toEqual(['RoomMoneyDrop']);
    expect(
      Object.keys(occurrence(imported.project, 'O-r23').acquisitionSites ?? {}),
    ).toContainEqual(expect.stringContaining('rewardWheelOffer'));
    expect(duplicated('P-r31')).toEqual(['TalentDrop']);
    expect(duplicated('P-r37')).toEqual(['RoomMoneyDrop']);
    expect(duplicated('P-r38')).toEqual(['RoomMoneyDrop']);
    // Q_PreBoss01's Buried Treasure gold is collected first; the two leftover uses are duplicates.
    expect(duplicated('Q-r49')).toEqual(['RoomMoneySmallDrop', 'RoomMoneyTinyDrop']);
    expect(
      occurrence(imported.project, 'Q-r49').roomActions.order.flatMap((action) =>
        action.kind === 'interactAcquisitionEntry' && action.siteKey.startsWith('traitGenerated:')
          ? [action.entryKey]
          : [],
      ),
    ).toEqual(['smallGold', 'tinyGold1', 'tinyGold2', 'minorHeal1', 'minorHeal2', 'bones']);
    // Only which of the two tiny gold pickups was duplicated is not saved.
    expect(
      imported.report.entries.filter((entry) => entry.area === 'reward').map(describeEntry),
    ).toEqual(['assumption reward r49 acquisitionRole@Q-r49:self -> ReplaceSeaStarResult(Q-r49)']);
  });

  it("imports O_MiniBoss01's All Together sets and N_Combat21's Bridal Glow target exactly", () => {
    const allTogether = reward(imported.project, 'O-r24').traitOffersByAcquisitionRole['source'];
    expect(allTogether?.kind === 'traits' && allTogether.options[2]).toEqual({
      traitKey: 'AllElementalBoon',
      rarity: 'Legendary',
      allTogetherResult: {
        earth: 'ElementalOlympianDamageBoon',
        fire: 'ElementalRallyBoon',
        air: 'ElementalDodgeBoon',
        water: 'ElementalDamageCapBoon',
      },
    });
    const bridalGlow = reward(imported.project, 'N-r7').traitOffersByAcquisitionRole['source'];
    expect(bridalGlow?.kind === 'traits' && bridalGlow.options[2]).toMatchObject({
      traitKey: 'BoonDecayBoon',
      targetTraitKey: 'HeraWeaponBoon',
    });
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

  it("settles a mixed-side ship's split silently when every split leaves one exit state", () => {
    // As if O_Combat12's wheels had used one side each: the record no longer says which.
    const mixed: RunRecord = {
      ...record,
      rooms: record.rooms.map((room, index) =>
        index === 23
          ? {
              ...room,
              uses: {
                ...Object.fromEntries(
                  Object.entries(room.uses).filter(([name]) => name !== 'ShipsSteeringWheelRight'),
                ),
                ShipsSteeringWheelLeft: 1,
                ShipsSteeringWheelRight: 1,
              },
              wheels: room.wheels!.map(({ store, picked, offers }): RunRecordWheel => ({
                store,
                picked,
                ...(offers === undefined ? {} : { offers }),
              })),
            }
          : room,
      ),
    };
    const result = projectFromRunRecord(catalog, mixed);
    expect(
      result.report.entries
        .filter((entry) => entry.area === 'wheel' && entry.record?.roomIndex === 23)
        .map(describeEntry),
    ).toEqual([]);
    expect(mismatchLines(result.report)).toEqual(mismatchLines(imported.report));
    // The canonical split: the first wheel took the Left use.
    const ship = occurrence(result.project, 'O-r23').state;
    expect(ship.kind === 'shipCombat' && ship.wheels).toMatchObject({
      wheel1: {
        pickedOfferIndex: 1,
        offers: { offer1: { offer: { rewardType: 'RoomMoneyDrop' } } },
      },
      wheel2: {
        pickedOfferIndex: 2,
        offers: { offer2: { offer: { rewardType: 'WeaponUpgrade' } } },
      },
    });
  });

  it("authors a mixed-side ship's Sea Star duplicate on the canonical split when its window never closes", () => {
    // As above, but O_Combat12's exit names a door the ship cannot offer, so O_MiniBoss01 is never entered.
    const open: RunRecord = {
      ...record,
      rooms: record.rooms.map((room, index) =>
        index === 23
          ? {
              ...room,
              exit: 'F_Boss01',
              doors: room.doors.map((door) => ({ ...door, room: 'F_Boss01' })),
              uses: {
                ...Object.fromEntries(
                  Object.entries(room.uses).filter(([name]) => name !== 'ShipsSteeringWheelRight'),
                ),
                ShipsSteeringWheelLeft: 1,
                ShipsSteeringWheelRight: 1,
              },
              wheels: room.wheels!.map(({ store, picked, offers }): RunRecordWheel => ({
                store,
                picked,
                ...(offers === undefined ? {} : { offers }),
              })),
            }
          : room,
      ),
    };
    const result = projectFromRunRecord(catalog, open);
    expect(seaStarDuplicates(result.project, 'O-r23')).toHaveLength(1);
    // The unsettled sides and offers stay provisional, each reported.
    expect(
      result.report.entries
        .filter((entry) => entry.area === 'wheel' && entry.record?.roomIndex === 23)
        .map((entry) => `${entry.reason} ${entry.address?.kind}`),
    ).toEqual([
      'notInRecord rewardWheel',
      'notInRecord rewardWheel',
      'notInRecord rewardWheelOffer',
      'notInRecord rewardWheelOffer',
    ]);
  });

  it("authors a one-offer wheel's count without a side for its only offer", () => {
    // Walking the plan again with O_Combat12's right-picked second wheel recorded as one-offer.
    const altered: RunRecord = {
      ...record,
      rooms: record.rooms.map((room, index) =>
        index === 23
          ? {
              ...room,
              wheels: room.wheels!.map((wheel, at) => (at === 1 ? { ...wheel, offers: 1 } : wheel)),
            }
          : room,
      ),
    };
    const entries: RunImportReportEntry[] = [];
    const walk = new RunImportWalk(
      catalog,
      altered,
      simulateProjectAssembly(catalog, imported.project),
      entries,
    );
    walk.run();
    const ship = occurrence(walk.assembly.project, 'O-r23').state;
    expect(ship.kind === 'shipCombat' && ship.wheels['wheel2']).toMatchObject({
      offerCount: 1,
      pickedOfferIndex: 1,
    });
    expect(entries.filter((entry) => entry.applied?.kind === 'ReplaceRewardWheelPicked')).toEqual(
      [],
    );
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
    expect(result.kind).toBe('complete');
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
      assumption: {
        conversion: 2,
        doors: 7,
        encounter: 1,
        reward: 1,
        roomActionOrder: 19,
        shop: 4,
        traitOffer: 5,
      },
    });
    expect(entryLines(imported.report)).toEqual([
      'assumption conversion r14 acquisitionEntry@N-r14 -> ReplaceAcquisitionEntryOffer(N-r14 HermesUpgrade)',
      'assumption traitOffer r17 traitOffer@N-r17:hiddenSource -> ReplaceTraitOffer(N-r17 HeraSpecialBoon|HeraCastBoon|DamageShareRetaliateBoon#option3)',
      'assumption shop r17 shopOffer@N-r17 -> ReplaceShopOfferOption(N-r17)',
      'assumption conversion r22 acquisitionEntry@O-r22 -> ReplaceAcquisitionEntryOffer(O-r22 StackUpgrade)',
      'assumption traitOffer r23 traitOffer@O-r23:hiddenSource -> ReplaceTraitOffer(O-r23 ZeusCastBoon|ZeusManaBoon|BoltRetaliateBoon#option1)',
      'assumption traitOffer r27 traitOffer@O-r27:source -> ReplaceTraitOffer(O-r27 PoseidonManaBoon|OmegaPoseidonProjectileBoon|PoseidonExCastBoon#option2)',
      'assumption shop r27 shopOffer@O-r27 -> ReplaceShopOfferOption(O-r27)',
      'assumption doors r30 exitDecision@P:start',
      'assumption doors r33 exitDecision@P-r33',
      'assumption doors r34 exitDecision@P-r34',
      'assumption doors r35 exitDecision@P-r35',
      'assumption doors r37 exitDecision@P-r37',
      'assumption encounter r38 encounterPhase@P-r38:Combat -> ReplaceAetosWave(P-r38)',
      'assumption traitOffer r39 traitOffer@P-r39:source -> ReplaceTraitOffer(P-r39 HeraCastBoon|HeraManaBoon|LinkedDeathDamageBoon#option3)',
      'assumption shop r39 shopOffer@P-r39 -> ReplaceShopOfferOption(P-r39)',
      'assumption doors r44 exitDecision@Q-r44',
      'assumption doors r47 exitDecision@Q-r47',
      'assumption traitOffer r49 traitOffer@Q-r49:source -> ReplaceTraitOffer(Q-r49 PoseidonManaBoon|RoomRewardBonusBoon|EncounterStartOffenseBuffBoon#option2)',
      'assumption shop r49 shopOffer@Q-r49 -> ReplaceShopOfferOption(Q-r49)',
      'assumption reward r49 acquisitionRole@Q-r49:self -> ReplaceSeaStarResult(Q-r49)',
      'assumption roomActionOrder r17 occurrence@N-r17',
      'assumption roomActionOrder r19 occurrence@N-r17:postboss',
      'assumption roomActionOrder r14 occurrence@N-r14',
      'assumption roomActionOrder r21 occurrence@O-r21',
      'assumption roomActionOrder r22 occurrence@O-r22',
      'assumption roomActionOrder r23 occurrence@O-r23',
      'assumption roomActionOrder r26 occurrence@O-r26',
      'assumption roomActionOrder r27 occurrence@O-r27',
      'assumption roomActionOrder r29 occurrence@O-r27:postboss',
      'assumption roomActionOrder r31 occurrence@P-r31',
      'assumption roomActionOrder r33 occurrence@P-r33',
      'assumption roomActionOrder r34 occurrence@P-r34',
      'assumption roomActionOrder r35 occurrence@P-r35',
      'assumption roomActionOrder r37 occurrence@P-r37',
      'assumption roomActionOrder r38 occurrence@P-r38',
      'assumption roomActionOrder r39 occurrence@P-r39',
      'assumption roomActionOrder r41 occurrence@P-r39:postboss',
      'assumption roomActionOrder r45 occurrence@Q-r45',
      'assumption roomActionOrder r49 occurrence@Q-r49',
    ]);
    // O_Combat12's solved offers draw what the game drew, All Together grants the sets the game
    // granted and each Sea Star duplicate is used as the game used it, so pickups, stores and
    // traits agree.
    expect(mismatchLines(imported.report)).toEqual([]);
  });
});
