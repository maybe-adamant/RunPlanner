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
import {
  applyTranscendentEmbryoEquipResult,
  applyKeepsakeDisposition,
  advanceCurrentKeepsake,
  advanceTranscendentEmbryoProgress,
  assessTranscendentEmbryoTransformation,
  createKeepsakeState,
  transcendentEmbryoBlessingKeys,
  transcendentEmbryoBlessingValues,
  type ReachedTranscendentEmbryoThreshold,
} from '../../src/simulation/keepsakes';
import {
  attachTraitHistory,
  createTraitHistoryState,
  foldTraitHistoryEvents,
} from '../../src/simulation/traits';
import type { RewardBranchState } from '../../src/simulation/rewards/branch-primitives';
import { initializeRewardBranches } from '../../src/simulation/rewards/processing';
import { applyEncounterEndEffectsTransition } from '../../src/simulation/rewards/biome/lifecycle-transitions/encounter-end-effects';
import { applyKeepsakeRackUsedTransition } from '../../src/simulation/rewards/biome/lifecycle-transitions/keepsake-rack-used';
import { createTraitOfferCandidateArtifacts } from '../../src/simulation/candidates/trait-offer-capability';
import type { CanonicalAuthoredRoom } from '../../src/simulation/materialization';
import { initializeTestRewardBranches } from '../support/arcana-fear';

const owner = createBiomeAddress('Underworld', 'F');

function branchWithHistory(
  history = createTraitHistoryState(),
  keepsakes = createKeepsakeState(catalog, 'GoldifyKeepsake'),
): RewardBranchState {
  const branch = initializeTestRewardBranches()[0];
  if (branch === undefined) throw new Error('missing test reward branch');
  return Object.freeze({
    ...branch,
    history: attachTraitHistory(branch.history, history),
    traitHistory: history,
    keepsakes,
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

describe('Transcendent Embryo declaration and direct Chaos fold', () => {
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
      { blessingKey: 'ChaosElementalBlessing' },
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
      encounters: { transcendentEmbryoBlessingByPhase: { Encounter: 'ChaosWeaponBlessing' } },
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
    expect(branches[0]?.keepsakes.transcendentEmbryo?.progress).toBe(0);
    for (let sequence = 1; sequence < 8; sequence += 1) {
      const transition = applyEncounterEndEffectsTransition(
        catalog,
        end(sequence),
        room,
        1,
        4,
        branches,
      );
      expect(transition.transcendentEmbryoThresholds).toHaveLength(0);
      expect(transition.branches[0]?.keepsakes.transcendentEmbryo?.progress).toBe(sequence);
      branches = transition.branches;
    }
    expect(branches[0]?.keepsakes.transcendentEmbryo?.progress).toBe(7);

    const suppressed = applyEncounterEndEffectsTransition(
      catalog,
      end(8),
      { ...room, gameName: 'N_Sub01' } as unknown as CanonicalAuthoredRoom,
      1,
      4,
      branches,
    );
    expect(suppressed.transcendentEmbryoThresholds).toHaveLength(0);
    expect(suppressed.branches[0]?.keepsakes.transcendentEmbryo?.progress).toBe(7);

    const missing = applyEncounterEndEffectsTransition(
      catalog,
      end(9),
      {
        ...room,
        encounters: {},
      } as unknown as CanonicalAuthoredRoom,
      1,
      4,
      suppressed.branches,
    );
    expect(missing.branches).toHaveLength(0);
    expect(missing.findings).toMatchObject([
      { finding: { code: 'transcendentEmbryoOutcomeMissing' } },
    ]);

    const resolved = applyEncounterEndEffectsTransition(
      catalog,
      end(9),
      room,
      1,
      4,
      suppressed.branches,
    );
    expect(resolved.findings).toHaveLength(0);
    expect(resolved.branches[0]?.keepsakes.transcendentEmbryo).toMatchObject({
      progress: 0,
      markedBlessingKey: 'ChaosWeaponBlessing',
    });
    expect(resolved.branches[0]?.traitHistory?.maturedChaosBlessings).toMatchObject([
      { blessingKey: 'ChaosWeaponBlessing' },
    ]);
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
    expect(branch?.keepsakes.jeweledPom).toMatchObject({
      active: true,
      grantedTraitKey: 'HadesLifestealBoon',
      levels: 3,
    });
    expect(branch?.traitHistory?.equippedTraits.HadesLifestealBoon).toBeDefined();
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
          operand.byRarity?.Epic?.minimum ?? operand.minimum,
        ]),
      ),
    );
  });

  it('folds immediate acquisition as a matured blessing and keeps its source marker', () => {
    const result = applyTranscendentEmbryoEquipResult(
      catalog,
      branchWithHistory(),
      'RandomBlessingKeepsake',
      { blessingKey: 'ChaosElementalBlessing' },
      owner,
      1,
      'ordinary',
      'Epic',
      { routeKey: 'Underworld', aspectKey: '' },
    );
    expect(result.traitHistory?.maturedChaosBlessings).toHaveLength(1);
    expect(result.traitHistory?.maturedChaosBlessings[0]?.blessingKey).toBe(
      'ChaosElementalBlessing',
    );
    expect(result.keepsakes.transcendentEmbryo).toMatchObject({
      origin: 'ordinary',
      rarity: 'Epic',
      progress: 0,
      markedBlessingKey: 'ChaosElementalBlessing',
    });
  });

  it('reaches exactly once after eight qualifying progress advances', () => {
    let state = createKeepsakeState(catalog, 'RandomBlessingKeepsake');
    state = {
      ...state,
      transcendentEmbryo: {
        origin: 'ordinary',
        rarity: 'Epic',
        progress: 0,
        markedBlessingKey: 'ChaosElementalBlessing',
        markedBlessingAcquisitionIdentity: 'embryo:marked',
      },
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

  it('preserves the active blessing through Heirloom, then detaches it when unequipped', () => {
    const equipped = applyTranscendentEmbryoEquipResult(
      catalog,
      branchWithHistory(
        createTraitHistoryState(),
        createKeepsakeState(catalog, 'RandomBlessingKeepsake'),
      ),
      'RandomBlessingKeepsake',
      { blessingKey: 'ChaosElementalBlessing' },
      owner,
      1,
      'ordinary',
      'Epic',
      { routeKey: 'Underworld' },
    );
    const progressed = advanceTranscendentEmbryoProgress(
      advanceTranscendentEmbryoProgress(equipped.keepsakes).state,
    ).state;
    const heirloom = advanceCurrentKeepsake(catalog, progressed, 1);
    expect(heirloom.transcendentEmbryo).toMatchObject({
      rarity: 'Heroic',
      progress: 2,
      markedBlessingKey: 'ChaosElementalBlessing',
    });
    const unequipped = applyKeepsakeDisposition(
      catalog,
      heirloom,
      { kind: 'replace', keepsakeKey: 'GoldifyKeepsake' },
      equipped.arcanaFear,
    );
    expect(unequipped.transcendentEmbryo).toBeUndefined();
    expect(equipped.traitHistory?.maturedChaosBlessings).toMatchObject([
      { blessingKey: 'ChaosElementalBlessing' },
    ]);
  });

  it('detaches the marked blessing before an ordinary rack replacement reaches later Chaos eligibility', () => {
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
      { blessingKey: 'ChaosElementalBlessing' },
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
          disposition: { kind: 'replace', keepsakeKey: 'GoldifyKeepsake' },
        },
      } as unknown as CanonicalAuthoredRoom,
      undefined,
      createDefaultRouteLoadout(catalog),
      [equipped],
    );
    const replaced = transition.branches[0];
    if (replaced === undefined) throw new Error('rack replacement did not produce a branch');
    expect(replaced.keepsakes.currentKey).toBe('GoldifyKeepsake');
    expect(replaced.traitHistory?.events).toContainEqual(
      expect.objectContaining({
        kind: 'directChaosBlessingRemoval',
        acquisitionRole: 'transcendentEmbryoRackReplacement',
        acquisitionPoint: 'keepsakeRackUsed',
        acquisitionIdentity: expect.stringContaining('embryo-rack-replacement'),
      }),
    );
    expect(replaced.traitHistory?.maturedChaosBlessings).toHaveLength(0);
    expect(replaced.traitHistory?.elementCounts).toEqual({
      Aether: 0,
      Earth: 0,
      Air: 0,
      Fire: 0,
      Water: 0,
    });

    const laterChaos = createTraitOfferAddress(
      createIncomingRewardAddress(
        createBiomeAddress('Underworld', 'F'),
        createOccurrenceId('later-chaos'),
      ),
      'self',
    );
    const capability = createTraitOfferCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(laterChaos),
          [Object.freeze({ before: replaced.traitHistory!, context: Object.freeze({}) })],
        ],
      ]),
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
    expect(domain?.blessingKeys).not.toContain('ChaosLastStandBlessing');
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
          origin: 'echo' as const,
          rarity: 'Epic' as const,
          progress: 0,
          markedBlessingKey: 'ChaosElementalBlessing',
          markedBlessingAcquisitionIdentity: 'embryo:echo',
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
          disposition: { kind: 'replace', keepsakeKey: 'RarifyKeepsake' },
        },
      } as unknown as CanonicalAuthoredRoom,
      undefined,
      createDefaultRouteLoadout(catalog),
      [echoBranch],
    );
    const replaced = transition.branches[0];
    if (replaced === undefined) throw new Error('rack replacement did not produce a branch');
    expect(replaced.keepsakes.currentKey).toBe('RarifyKeepsake');
    expect(replaced.keepsakes.transcendentEmbryo).toMatchObject({
      origin: 'echo',
      markedBlessingAcquisitionIdentity: 'embryo:echo',
    });
    expect(replaced.traitHistory?.maturedChaosBlessings).toMatchObject([
      { acquisitionIdentity: 'embryo:echo', blessingKey: 'ChaosElementalBlessing' },
    ]);
    expect(replaced.traitHistory?.events).not.toContainEqual(
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
        markedBlessingAcquisitionIdentity: 'embryo:marked',
      },
      before: createTraitHistoryState(),
      eligibleBlessingKeys: ['ChaosElementalBlessing'],
    } satisfies ReachedTranscendentEmbryoThreshold;
    expect(assessTranscendentEmbryoTransformation(catalog, threshold, undefined).legal).toBe(false);
    expect(
      assessTranscendentEmbryoTransformation(catalog, threshold, 'ChaosElementalBlessing').legal,
    ).toBe(true);
    expect(semanticAddressKey(owner)).toBe(JSON.stringify(['biome', 'Underworld', 'F']));
  });
});
