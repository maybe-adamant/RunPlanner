import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomActionAddress,
  semanticAddressKey,
  createTraitOfferAddress,
} from '../../src/authored-project';
import { createDefaultRouteLoadout } from '../../src/authored-project/loadout';
import { createArcanaFearState } from '../../src/simulation/arcana-fear';
import { applyTranscendentEmbryoEquipResult } from '../../src/simulation/keepsakes/branch-transitions';
import {
  applyKeepsakeReplacement,
  advanceCurrentKeepsake,
  createKeepsakeState,
} from '../../src/simulation/keepsakes/state';
import {
  advanceTranscendentEmbryoProgress,
  assessTranscendentEmbryoTransformation,
  assessTranscendentEmbryoBlessing,
  transcendentEmbryoBlessingKeys,
  transcendentEmbryoBlessingValues,
  type ReachedTranscendentEmbryoThreshold,
} from '../../src/simulation/keepsakes/trait-effects';
import {
  attachTraitHistory,
  boonRarityFactsForOffer,
  createTraitHistoryState,
  foldTraitHistoryEvents,
} from '../../src/simulation/traits';
import type { RewardBranchState } from '../../src/simulation/rewards/branch-primitives';
import { initializeTestRewardBranchesForRoute as initializeRewardBranches } from '../support/arcana-fear';
import { applyEncounterEndEffectsTransition } from '../../src/simulation/rewards/biome/lifecycle-transitions/encounter-end-effects';
import { applyKeepsakeRackUsedTransition } from '../../src/simulation/rewards/biome/lifecycle-transitions/keepsake-rack-used';
import { createTraitOfferCandidateArtifacts } from '../../src/simulation/candidates/trait-offer/capability';
import type { CanonicalAuthoredRoom } from '../../src/simulation/materialization';
import { spawnPendingTraitOffers } from '../../src/simulation/state/pending-trait-offers';
import { initializeTestRewardBranches } from '../support/arcana-fear';
import { traitFrontierState, openTimeTraitOfferContexts } from '../support/simulation-state';

const owner = createBiomeAddress('Underworld', 'F');

function branchWithHistory(
  history = createTraitHistoryState(),
  keepsakes = createKeepsakeState(catalog, 'GoldifyKeepsake'),
): RewardBranchState {
  const branch = initializeTestRewardBranches()[0];
  if (branch === undefined) throw new Error('missing test reward branch');
  return Object.freeze({
    ...branch,
    state: Object.freeze({
      ...branch.state,
      rewardHistory: attachTraitHistory(branch.state.rewardHistory, history),
      traitHistory: history,
      keepsakes: keepsakes,
    }),
  });
}

function directBlessing(
  blessingKey: string,
  acquisitionIdentity: string,
  sequence: number,
  ownerAddress = owner,
) {
  const blessing = catalog.chaos.blessings.byKey[blessingKey];
  if (blessing === undefined) throw new Error(`missing Chaos blessing ${blessingKey}`);
  return Object.freeze({
    kind: 'directChaosBlessing' as const,
    owner: ownerAddress,
    acquisitionRole: 'transcendentEmbryoEquip' as const,
    sequence,
    acquisitionPoint: 'test',
    acquisitionIdentity,
    blessingKey,
    rarity: 'Epic' as const,
    blessingValues: transcendentEmbryoBlessingValues(catalog, blessingKey, 'Epic'),
  });
}

function embryoOutcome(
  blessingKey: string,
  rarity: 'Common' | 'Rare' | 'Epic' | 'Heroic' = 'Epic',
) {
  return Object.freeze({
    blessingKey,
    blessingValues: transcendentEmbryoBlessingValues(catalog, blessingKey, rarity),
  });
}

function embryoMarker(
  blessingKey: string,
  acquisitionIdentity: string,
  rarity: 'Common' | 'Rare' | 'Epic' | 'Heroic' = 'Epic',
) {
  return Object.freeze({
    origin: 'ordinary' as const,
    rarity,
    progress: 0,
    markedBlessingKey: blessingKey,
    markedBlessingValues: embryoOutcome(blessingKey, rarity).blessingValues,
    markedBlessingAcquisitionIdentity: acquisitionIdentity,
  });
}

describe('Transcendent Embryo declaration and direct Chaos fold', () => {
  it.each(['Underworld', 'Surface', 'Dream'])(
    'uses %s route for Discovery selection and alternatives',
    (routeKey) => {
      const history = createTraitHistoryState();
      const context = { routeKey };
      const options = transcendentEmbryoBlessingKeys(catalog, history, 'Epic', context);
      expect(options.includes('ChaosHarvestBlessing')).toBe(routeKey !== 'Dream');
      expect(options).toContain('ChaosElementalBlessing');
      expect(
        assessTranscendentEmbryoBlessing(
          catalog,
          embryoOutcome('ChaosHarvestBlessing'),
          history,
          'Epic',
          context,
        ).legal,
      ).toBe(routeKey !== 'Dream');
    },
  );
  it('uses the actual encounter-end transition to block then resolve the eighth replacement', () => {
    const encounterOwner = createOccurrenceAddress(
      createBiomeAddress('Underworld', 'F'),
      createOccurrenceId('embryo-chronology'),
    );
    const initial = applyTranscendentEmbryoEquipResult(
      catalog,
      branchWithHistory(
        createTraitHistoryState(),
        createKeepsakeState(catalog, 'RandomBlessingKeepsake'),
      ),
      'RandomBlessingKeepsake',
      embryoOutcome('ChaosElementalBlessing'),
      encounterOwner,
      0,
      'ordinary',
      'Epic',
      { routeKey: 'Underworld' },
    );
    const room = {
      kind: 'authored',
      origin: encounterOwner,
      occurrenceId: encounterOwner.occurrenceId,
      gameName: 'RoomOpening01',
      encounters: {
        transcendentEmbryoBlessingByPhase: {
          Encounter: embryoOutcome('ChaosWeaponBlessing'),
        },
      },
      encounterPhases: [],
    } as unknown as CanonicalAuthoredRoom;
    const end = (sequence: number) =>
      Object.freeze({
        kind: 'encounterEndEffectsApplied' as const,
        origin: encounterOwner,
        phaseKey: 'Encounter',
        execution: 'normal' as const,
        figLeafSkipOwner: false,
        operationIndex: sequence,
        sequence,
      });

    let branches: readonly RewardBranchState[] = [initial];
    expect(branches[0]?.state.keepsakes.transcendentEmbryo?.progress).toBe(0);
    for (let sequence = 1; sequence < 8; sequence += 1) {
      const transition = applyEncounterEndEffectsTransition(catalog, end(sequence), room, branches);
      expect(transition.transcendentEmbryoThresholds).toHaveLength(0);
      expect(transition.branches[0]?.state.keepsakes.transcendentEmbryo?.progress).toBe(sequence);
      branches = transition.branches;
    }
    expect(branches[0]?.state.keepsakes.transcendentEmbryo?.progress).toBe(7);

    const suppressed = applyEncounterEndEffectsTransition(
      catalog,
      end(8),
      { ...room, gameName: 'N_Sub01' } as unknown as CanonicalAuthoredRoom,
      branches,
    );
    expect(suppressed.transcendentEmbryoThresholds).toHaveLength(0);
    expect(suppressed.branches[0]?.state.keepsakes.transcendentEmbryo?.progress).toBe(7);

    const missing = applyEncounterEndEffectsTransition(
      catalog,
      end(9),
      {
        ...room,
        encounters: {},
      } as unknown as CanonicalAuthoredRoom,
      suppressed.branches,
    );
    expect(missing.branches).toHaveLength(0);
    expect(missing.findings).toMatchObject([
      { finding: { code: 'transcendentEmbryoOutcomeMissing' } },
    ]);

    const resolved = applyEncounterEndEffectsTransition(catalog, end(9), room, suppressed.branches);
    expect(resolved.findings).toHaveLength(0);
    expect(resolved.branches[0]?.state.keepsakes.transcendentEmbryo).toMatchObject({
      progress: 0,
      markedBlessingKey: 'ChaosWeaponBlessing',
    });
    expect(resolved.branches[0]?.state.traitHistory?.maturedChaosBlessings).toMatchObject([
      { blessingKey: 'ChaosWeaponBlessing' },
    ]);
  });

  it('marks unopened loot in its room stale on the interval', () => {
    const encounterOwner = createOccurrenceAddress(
      createBiomeAddress('Underworld', 'F'),
      createOccurrenceId('embryo-freshness'),
    );
    const initial = applyTranscendentEmbryoEquipResult(
      catalog,
      branchWithHistory(
        createTraitHistoryState(),
        createKeepsakeState(catalog, 'RandomBlessingKeepsake'),
      ),
      'RandomBlessingKeepsake',
      embryoOutcome('ChaosElementalBlessing'),
      encounterOwner,
      0,
      'ordinary',
      'Epic',
      { routeKey: 'Underworld' },
    );
    const waiting = Object.freeze({
      origin: createIncomingRewardAddress(owner, encounterOwner.occurrenceId),
      offer: Object.freeze({ rewardType: 'Boon' }),
      traitOffersByAcquisitionRole: Object.freeze({ source: null }),
    });
    const room = {
      kind: 'authored',
      origin: encounterOwner,
      occurrenceId: encounterOwner.occurrenceId,
      gameName: 'RoomOpening01',
      encounters: {
        transcendentEmbryoBlessingByPhase: {
          Encounter: embryoOutcome('ChaosWeaponBlessing'),
        },
      },
      encounterPhases: [],
    } as unknown as CanonicalAuthoredRoom;
    let branches: readonly RewardBranchState[] = [
      Object.freeze({
        ...initial,
        state: spawnPendingTraitOffers(catalog, initial.state, [waiting]),
      }),
    ];
    const record = () =>
      branches[0]?.state.pendingTraitOffers[semanticAddressKey(encounterOwner)]?.[
        semanticAddressKey(createTraitOfferAddress(waiting.origin, 'source'))
      ];
    for (let sequence = 1; sequence <= 8; sequence += 1) {
      expect(record()?.stale).toBe(false);
      branches = applyEncounterEndEffectsTransition(
        catalog,
        Object.freeze({
          kind: 'encounterEndEffectsApplied' as const,
          origin: encounterOwner,
          phaseKey: 'Encounter',
          execution: 'normal' as const,
          figLeafSkipOwner: false,
          operationIndex: sequence,
          sequence,
        }),
        room,
        branches,
      ).branches;
    }
    expect(branches[0]?.state.keepsakes.transcendentEmbryo?.progress).toBe(0);
    expect(record()?.stale).toBe(true);
  });

  it('publishes a same-phase Shrine delivery from the final Embryo branch', () => {
    const encounterOwner = createOccurrenceAddress(
      createBiomeAddress('Underworld', 'F'),
      createOccurrenceId('embryo-delivery-chronology'),
    );
    const equipped = applyTranscendentEmbryoEquipResult(
      catalog,
      branchWithHistory(
        createTraitHistoryState(),
        createKeepsakeState(catalog, 'RandomBlessingKeepsake'),
      ),
      'RandomBlessingKeepsake',
      embryoOutcome('ChaosElementalBlessing'),
      encounterOwner,
      0,
      'ordinary',
      'Epic',
      { routeKey: 'Underworld' },
    );
    let keepsakes = equipped.state.keepsakes;
    for (let index = 0; index < 7; index += 1)
      keepsakes = advanceTranscendentEmbryoProgress(keepsakes).state;
    const branch = Object.freeze({
      ...equipped,
      state: Object.freeze({
        ...equipped.state,
        keepsakes: keepsakes,
        pendingHermesShrineDeliveries: Object.freeze({
          delivery: Object.freeze({
            sourceKey: 'delivery',
            sourceOrigin: encounterOwner,
            generationKey: 'initial:first' as const,
            rewardType: 'Boon',
            remainingUses: 1,
          }),
        }),
      }),
    });
    const room = {
      kind: 'authored',
      origin: encounterOwner,
      occurrenceId: encounterOwner.occurrenceId,
      gameName: 'F_Opening01',
      encounters: {
        transcendentEmbryoBlessingByPhase: {
          Encounter: embryoOutcome('ChaosWeaponBlessing'),
        },
      },
      encounterPhases: [
        {
          slotKey: 'Encounter',
          envelopeKey: 'SingleEncounter',
          authoredChoiceKey: 'OpeningGeneratedF',
          figLeafSkip: false,
        },
      ],
    } as unknown as CanonicalAuthoredRoom;
    const transition = applyEncounterEndEffectsTransition(
      catalog,
      Object.freeze({
        kind: 'encounterEndEffectsApplied' as const,
        origin: encounterOwner,
        phaseKey: 'Encounter',
        execution: 'normal' as const,
        figLeafSkipOwner: false,
        operationIndex: 1,
        sequence: 1,
      }),
      room,
      [branch],
    );
    const delivery = transition.derivedAcquisitionEntryFrontiers.find(
      (frontier) => frontier.kind === 'hermesShrineDelivery',
    );
    expect(delivery).toBeDefined();
    expect(delivery?.branchesBeforeEntry[0]?.state.keepsakes.transcendentEmbryo).toMatchObject({
      progress: 0,
      markedBlessingKey: 'ChaosWeaponBlessing',
    });
    expect(
      delivery?.branchesBeforeEntry[0]?.state.traitHistory?.maturedChaosBlessings,
    ).toContainEqual(expect.objectContaining({ blessingKey: 'ChaosWeaponBlessing' }));
  });

  it('retains the existing route-start Jeweled Pom acquisition', () => {
    const loadout = {
      ...createDefaultRouteLoadout(catalog),
      startingKeepsakeKey: 'HadesAndPersephoneKeepsake',
    };
    const branch = initializeRewardBranches(
      undefined,
      createArcanaFearState(catalog, loadout),
      catalog,
      loadout.startingKeepsakeKey,
      { jeweledPom: { traitKey: 'HadesLifestealBoon' } },
      'Underworld',
      loadout,
    )[0];
    expect(branch?.state.keepsakes.jeweledPom).toMatchObject({
      active: true,
      grantedTraitKey: 'HadesLifestealBoon',
      levels: 3,
    });
    expect(branch?.state.traitHistory?.equippedTraits.HadesLifestealBoon).toBeDefined();
  });

  it('declares the four-rank profile and allows same-key reselection after marked removal', () => {
    expect(catalog.keepsakes.byKey.RandomBlessingKeepsake?.effect).toEqual({
      kind: 'transcendentEmbryo',
      source: 'Chaos',
      interval: 8,
      blessingRarityByRank: { Common: 'Common', Rare: 'Rare', Epic: 'Epic', Heroic: 'Heroic' },
    });
    const history = foldTraitHistoryEvents(catalog, [
      directBlessing('ChaosElementalBlessing', 'embryo:marked', 1),
      directBlessing('ChaosWeaponBlessing', 'ordinary:other', 2),
    ]);
    const keys = transcendentEmbryoBlessingKeys(catalog, history, 'Epic', {
      routeKey: 'Underworld',
      removedBlessingAcquisitionIdentity: 'embryo:marked',
    });
    expect(keys).toContain('ChaosElementalBlessing');
    const blessing = catalog.chaos.blessings.byKey.ChaosElementalBlessing;
    if (blessing === undefined) throw new Error('missing elemental Chaos blessing');
    expect(transcendentEmbryoBlessingValues(catalog, 'ChaosElementalBlessing', 'Epic')).toEqual(
      Object.fromEntries(
        blessing.operands.map((operand) => [
          operand.key,
          operand.byRarity?.Epic?.authoringDefault ?? operand.authoringDefault,
        ]),
      ),
    );
  });

  it('folds immediate acquisition as a matured blessing and keeps its source marker', () => {
    const result = applyTranscendentEmbryoEquipResult(
      catalog,
      branchWithHistory(),
      'RandomBlessingKeepsake',
      embryoOutcome('ChaosElementalBlessing'),
      owner,
      1,
      'ordinary',
      'Epic',
      { routeKey: 'Underworld', aspectKey: '' },
    );
    expect(result.state.traitHistory?.maturedChaosBlessings).toHaveLength(1);
    expect(result.state.traitHistory?.maturedChaosBlessings[0]?.blessingKey).toBe(
      'ChaosElementalBlessing',
    );
    expect(result.state.keepsakes.transcendentEmbryo).toMatchObject({
      origin: 'ordinary',
      rarity: 'Epic',
      progress: 0,
      markedBlessingKey: 'ChaosElementalBlessing',
    });
  });

  it('applies explicit Embryo outcomes to Creation, Favor, and numeric blessing state', () => {
    const creation = applyTranscendentEmbryoEquipResult(
      catalog,
      branchWithHistory(
        createTraitHistoryState(),
        createKeepsakeState(catalog, 'RandomBlessingKeepsake'),
      ),
      'RandomBlessingKeepsake',
      { blessingKey: 'ChaosElementalBlessing', blessingValues: {} },
      owner,
      1,
      'ordinary',
      'Heroic',
      { routeKey: 'Underworld' },
    );
    expect(creation.state.traitHistory?.elementCounts).toMatchObject({
      Earth: 4,
      Air: 4,
      Fire: 4,
      Water: 4,
    });

    const favor = applyTranscendentEmbryoEquipResult(
      catalog,
      branchWithHistory(
        createTraitHistoryState(),
        createKeepsakeState(catalog, 'RandomBlessingKeepsake'),
      ),
      'RandomBlessingKeepsake',
      { blessingKey: 'ChaosRarityBlessing', blessingValues: { rareBonus: 0.93 } },
      owner,
      1,
      'ordinary',
      'Heroic',
      { routeKey: 'Underworld' },
    );
    const favorFacts = boonRarityFactsForOffer(
      catalog,
      traitFrontierState(favor.state.traitHistory!),
      {
        resolvedProviderKey: 'Zeus',
      },
    );
    expect(favorFacts?.contributions).toContainEqual(
      expect.objectContaining({
        additive: expect.objectContaining({ Rare: 0.93 }),
      }),
    );

    const neutral = applyTranscendentEmbryoEquipResult(
      catalog,
      branchWithHistory(
        createTraitHistoryState(),
        createKeepsakeState(catalog, 'RandomBlessingKeepsake'),
      ),
      'RandomBlessingKeepsake',
      { blessingKey: 'ChaosWeaponBlessing', blessingValues: { damageBonus: 0.73 } },
      owner,
      1,
      'ordinary',
      'Heroic',
      { routeKey: 'Underworld' },
    );
    expect(neutral.state.traitHistory?.maturedChaosBlessings).toContainEqual(
      expect.objectContaining({
        blessingKey: 'ChaosWeaponBlessing',
        rarity: 'Heroic',
        blessingValues: { damageBonus: 0.73 },
      }),
    );
  });

  it('reaches exactly once after eight qualifying progress advances', () => {
    let state = createKeepsakeState(catalog, 'RandomBlessingKeepsake');
    state = {
      ...state,
      transcendentEmbryo: embryoMarker('ChaosElementalBlessing', 'embryo:marked'),
    };
    for (let index = 0; index < 7; index += 1) {
      const advanced = advanceTranscendentEmbryoProgress(state);
      expect(advanced.reached).toBe(false);
      state = advanced.state;
    }
    const reached = advanceTranscendentEmbryoProgress(state);
    expect(reached.reached).toBe(true);
    expect(reached.state.transcendentEmbryo?.progress).toBe(0);
  });

  it('preserves transformation progress through Heirloom, then stops tracking when unequipped', () => {
    const equipped = applyTranscendentEmbryoEquipResult(
      catalog,
      branchWithHistory(
        createTraitHistoryState(),
        createKeepsakeState(catalog, 'RandomBlessingKeepsake'),
      ),
      'RandomBlessingKeepsake',
      embryoOutcome('ChaosElementalBlessing'),
      owner,
      1,
      'ordinary',
      'Epic',
      { routeKey: 'Underworld' },
    );
    const progressed = advanceTranscendentEmbryoProgress(
      advanceTranscendentEmbryoProgress(equipped.state.keepsakes).state,
    ).state;
    const heirloom = advanceCurrentKeepsake(catalog, progressed, 1);
    expect(heirloom.transcendentEmbryo).toMatchObject({
      rarity: 'Heroic',
      progress: 2,
      markedBlessingKey: 'ChaosElementalBlessing',
    });
    const unequipped = applyKeepsakeReplacement(
      catalog,
      heirloom,
      'GoldifyKeepsake',
      equipped.state.arcanaFear,
    );
    expect(unequipped.transcendentEmbryo).toBeUndefined();
    expect(equipped.state.traitHistory?.maturedChaosBlessings).toMatchObject([
      { blessingKey: 'ChaosElementalBlessing' },
    ]);
  });

  it('retains the blessing and its effects after unequipping, without further transformations', () => {
    const rackOccurrence = createOccurrenceAddress(
      createBiomeAddress('Underworld', 'F'),
      createOccurrenceId('embryo-rack-replacement'),
    );
    const equipped = applyTranscendentEmbryoEquipResult(
      catalog,
      branchWithHistory(
        createTraitHistoryState(),
        createKeepsakeState(catalog, 'RandomBlessingKeepsake'),
      ),
      'RandomBlessingKeepsake',
      embryoOutcome('ChaosElementalBlessing'),
      rackOccurrence,
      1,
      'ordinary',
      'Epic',
      { routeKey: 'Underworld' },
    );
    const transition = applyKeepsakeRackUsedTransition(
      catalog,
      {
        kind: 'keepsakeRackUsed',
        origin: rackOccurrence,
        owner: createRoomActionAddress(
          createBiomeAddress(rackOccurrence.routeKey, rackOccurrence.biomeKey),
          rackOccurrence.occurrenceId,
          'interactKeepsakeRack',
        ),
        sequence: 2,
        operationIndex: 0,
      },
      {
        gameName: 'F_PostBoss01',
        keepsakeRack: {
          keepsakeKey: 'GoldifyKeepsake',
        },
      } as unknown as CanonicalAuthoredRoom,
      undefined,
      createDefaultRouteLoadout(catalog),
      [equipped],
      2,
    );
    const replaced = transition.branches[0];
    if (replaced === undefined) throw new Error('rack replacement did not produce a branch');
    expect(replaced.state.keepsakes.currentKey).toBe('GoldifyKeepsake');
    expect(replaced.state.keepsakes.transcendentEmbryo).toBeUndefined();
    expect(replaced.state.traitHistory?.maturedChaosBlessings).toEqual(
      equipped.state.traitHistory?.maturedChaosBlessings,
    );
    expect(replaced.state.traitHistory?.elementCounts).toEqual(
      equipped.state.traitHistory?.elementCounts,
    );

    let laterBranches = transition.branches;
    for (let sequence = 3; sequence <= 10; sequence += 1) {
      const later = applyEncounterEndEffectsTransition(
        catalog,
        {
          kind: 'encounterEndEffectsApplied',
          origin: rackOccurrence,
          phaseKey: 'Encounter',
          execution: 'normal',
          figLeafSkipOwner: false,
          operationIndex: sequence,
          sequence,
        },
        {
          gameName: 'RoomOpening01',
          encounters: {},
          encounterPhases: [],
        } as unknown as CanonicalAuthoredRoom,
        laterBranches,
      );
      expect(later.findings).toHaveLength(0);
      expect(later.transcendentEmbryoThresholds).toHaveLength(0);
      expect(later.branches[0]?.state.keepsakes.transcendentEmbryo).toBeUndefined();
      expect(later.branches[0]?.state.traitHistory?.maturedChaosBlessings).toEqual(
        equipped.state.traitHistory?.maturedChaosBlessings,
      );
      laterBranches = later.branches;
    }

    const laterChaos = createTraitOfferAddress(
      createIncomingRewardAddress(
        createBiomeAddress('Underworld', 'F'),
        createOccurrenceId('later-chaos'),
      ),
      'self',
    );
    const capability = createTraitOfferCandidateArtifacts(
      catalog,
      openTimeTraitOfferContexts(
        new Map([
          [
            semanticAddressKey(laterChaos),
            [
              Object.freeze({
                state: traitFrontierState(replaced.state.traitHistory!),
                source: Object.freeze({}),
              }),
            ],
          ],
        ]),
      ),
    ).at(laterChaos);
    const domain = capability?.chaosOfferDomain({
      kind: 'chaos',
      giverKey: 'Chaos',
      curseOptions: [
        { curseKey: 'ChaosMetaUpgradeCurse', requirementCount: 3 },
        { curseKey: 'ChaosMetaUpgradeCurse', requirementCount: 3 },
        { curseKey: 'ChaosMetaUpgradeCurse', requirementCount: 3 },
      ],
      selectedOptionKey: 'option1',
      selectedCurseValues: {},
      blessingKey: 'ChaosWeaponBlessing',
      rarity: 'Common',
      blessingValues: { damageBonus: 0.2 },
    })[0];
    expect(
      domain?.curseOptions.every((option) => option.curseKeys.includes('ChaosMetaUpgradeCurse')),
    ).toBe(true);
    expect(domain?.blessingKeys).toContain('ChaosLastStandBlessing');
  });

  it('keeps a Gift Gift Gift Embryo blessing when the current rack keepsake is unrelated', () => {
    const rackOccurrence = createOccurrenceAddress(
      createBiomeAddress('Underworld', 'F'),
      createOccurrenceId('echo-embryo-rack-replacement'),
    );
    const echoHistory = foldTraitHistoryEvents(catalog, [
      directBlessing('ChaosElementalBlessing', 'embryo:echo', 1),
    ]);
    const echoBranch = branchWithHistory(
      echoHistory,
      Object.freeze({
        ...createKeepsakeState(catalog, 'GoldifyKeepsake'),
        transcendentEmbryo: Object.freeze({
          ...embryoMarker('ChaosElementalBlessing', 'embryo:echo', 'Epic'),
          origin: 'echo' as const,
        }),
      }),
    );
    const transition = applyKeepsakeRackUsedTransition(
      catalog,
      {
        kind: 'keepsakeRackUsed',
        origin: rackOccurrence,
        owner: createRoomActionAddress(
          createBiomeAddress(rackOccurrence.routeKey, rackOccurrence.biomeKey),
          rackOccurrence.occurrenceId,
          'interactKeepsakeRack',
        ),
        sequence: 2,
        operationIndex: 0,
      },
      {
        gameName: 'F_PostBoss01',
        keepsakeRack: {
          keepsakeKey: 'RarifyKeepsake',
        },
      } as unknown as CanonicalAuthoredRoom,
      undefined,
      createDefaultRouteLoadout(catalog),
      [echoBranch],
      2,
    );
    const replaced = transition.branches[0];
    if (replaced === undefined) throw new Error('rack replacement did not produce a branch');
    expect(replaced.state.keepsakes.currentKey).toBe('RarifyKeepsake');
    expect(replaced.state.keepsakes.transcendentEmbryo).toMatchObject({
      origin: 'echo',
      markedBlessingAcquisitionIdentity: 'embryo:echo',
    });
    expect(replaced.state.traitHistory?.maturedChaosBlessings).toMatchObject([
      { acquisitionIdentity: 'embryo:echo', blessingKey: 'ChaosElementalBlessing' },
    ]);
    expect(replaced.state.traitHistory?.events).not.toContainEqual(
      expect.objectContaining({ kind: 'directChaosBlessingRemoval' }),
    );
  });

  it('removes only the marked direct blessing before acquiring the replacement', () => {
    const before = foldTraitHistoryEvents(catalog, [
      directBlessing('ChaosElementalBlessing', 'embryo:old', 1),
      directBlessing('ChaosWeaponBlessing', 'ordinary:retained', 2),
    ]);
    const after = foldTraitHistoryEvents(catalog, [
      ...before.events,
      {
        kind: 'directChaosBlessingRemoval' as const,
        owner,
        acquisitionRole: 'transcendentEmbryoTransformation' as const,
        sequence: 3,
        acquisitionPoint: 'encounterEndEffectsApplied',
        acquisitionIdentity: 'embryo:old',
      },
      {
        ...directBlessing('ChaosElementalBlessing', 'embryo:new', 3),
        acquisitionRole: 'transcendentEmbryoTransformation' as const,
        acquisitionPoint: 'encounterEndEffectsApplied',
      },
    ]);
    expect(after.maturedChaosBlessings).toMatchObject([
      { acquisitionIdentity: 'ordinary:retained', blessingKey: 'ChaosWeaponBlessing' },
      { acquisitionIdentity: 'embryo:new', blessingKey: 'ChaosElementalBlessing' },
    ]);
  });

  it('requires a selected blessing only when the reached domain is nonempty', () => {
    const threshold = {
      source: {
        origin: 'ordinary' as const,
        rarity: 'Epic' as const,
        progress: 0,
        markedBlessingKey: 'ChaosElementalBlessing',
        markedBlessingValues: embryoOutcome('ChaosElementalBlessing').blessingValues,
        markedBlessingAcquisitionIdentity: 'embryo:marked',
      },
      before: createTraitHistoryState(),
      eligibleBlessingKeys: ['ChaosElementalBlessing'],
    } satisfies ReachedTranscendentEmbryoThreshold;
    expect(assessTranscendentEmbryoTransformation(catalog, threshold, undefined).legal).toBe(false);
    expect(
      assessTranscendentEmbryoTransformation(
        catalog,
        threshold,
        embryoOutcome('ChaosElementalBlessing'),
      ).legal,
    ).toBe(true);
    expect(semanticAddressKey(owner)).toBe(JSON.stringify(['biome', 'Underworld', 'F']));
  });
});
