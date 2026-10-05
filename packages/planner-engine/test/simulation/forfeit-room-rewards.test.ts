import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAcquisitionRoleAddress,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createIncomingRewardAddress,
  createGorgonPhaseAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createRoomRunStateCheckpointAddress,
  createRoomActionAddress,
  createRouteAddress,
  createStartingRewardAddress,
  createTraitOfferAddress,
  roomActionKey,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';
import { ordinaryRoutePosition } from '../support/route-position';

import {
  createCompleteFGProject,
  createGoldenFGHProject,
  goldenFStartId,
  goldenHBiome,
  loadNemesisFieldsCheckpoint,
} from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNOProject, oBiome, oOccurrenceIds } from '@run-planner/test-fixtures/surface';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
import {
  acquisitionConversionCandidateForProjectEvaluationAssembly,
  simulateProject,
} from '../../src/simulation';
import { EMPTY_RESOURCE_PLACEMENTS } from '../../src/authored-project/defaults';
import { createArcanaFearState } from '../../src/simulation/arcana-fear';
import { evaluateProgressiveBiomeAssembly } from '../../src/simulation/progressive/biome';
import {
  appendRewardEvent,
  mergeEquivalentRewardBranches,
} from '../../src/simulation/rewards/branch-primitives';
import { initializeTestRewardBranches } from '../support/arcana-fear';
import { createPreparedProjectCandidateSession } from '../../src/simulation/candidates';
import { simulateProjectAssembly } from '../../src/simulation/evaluation/project';

const biome = createBiomeAddress('Underworld', 'F');
const fieldsOccurrenceId = createOccurrenceId('golden-h-combat09');
const fieldsCage1 = createLocalRewardAddress(goldenHBiome, fieldsOccurrenceId, 'cages', 'cage1');
const fieldsCage2 = createLocalRewardAddress(goldenHBiome, fieldsOccurrenceId, 'cages', 'cage2');

function replayEnteredFieldsForfeit(rank: 0 | 1) {
  const baseline = simulateProject(catalog, createGoldenFGHProject());
  const previous = baseline.route?.biomes.find((candidate) => candidate.biomeKey === 'G');
  let project = loadNemesisFieldsCheckpoint();
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceFearVowRank',
    route: createRouteAddress('Underworld'),
    vowKey: 'BoonSkipShrineUpgrade',
    rank,
  });
  const route = project.route;
  const plan = route?.biomes.find((candidate) => candidate.biomeKey === 'H');
  if (route === undefined) throw new Error('expected Underworld route');
  if (previous?.authoring !== 'complete' || previous.validity !== 'valid' || plan === undefined)
    throw new Error('expected complete-valid G seed and authored Fields fixture');
  const arcanaFear = createArcanaFearState(catalog, route.loadout);
  const progressive = evaluateProgressiveBiomeAssembly(catalog, goldenHBiome, plan, {
    routePosition: ordinaryRoutePosition(catalog, 'Underworld', 'H'),
    resourcePlacements: EMPTY_RESOURCE_PLACEMENTS,
    loadout: route.loadout,
    seed: {
      history: previous.history,
      rewardBranches: previous.rewards.branches.map((branch) =>
        Object.freeze({
          ...branch,
          state: Object.freeze({
            ...branch.state,
            arcanaFear: Object.freeze({ ...branch.state.arcanaFear, fear: arcanaFear.fear }),
          }),
        }),
      ),
    },
  });
  if (progressive === null) throw new Error('Fields fixture did not publish progressive assembly');
  return progressive;
}

function simulated(rewardType: 'Boon' | 'HermesUpgrade') {
  let project = createCompleteFGProject();
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceFearVowRank',
    route: createRouteAddress('Underworld'),
    vowKey: 'BoonSkipShrineUpgrade',
    rank: 1,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceStartingReward',
    reward: createStartingRewardAddress('Underworld'),
    value:
      rewardType === 'Boon'
        ? { rewardType, payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } }
        : { rewardType },
  });
  if (rewardType === 'HermesUpgrade') {
    project = applyProjectCommand(project, catalog, {
      kind: 'RemoveRoomAction',
      action: createRoomActionAddress(
        biome,
        goldenFStartId,
        roomActionKey({
          kind: 'interactIncomingReward',
          producerPoint: 'roomRewardPickup',
          acquisitionRole: 'source',
        }),
      ),
    });
  }
  const result = simulateProject(catalog, project);
  const f = result.route?.biomes[0];
  if (f?.authoring !== 'complete') throw new Error('expected complete F simulation');
  return f.rewards;
}

function rewardsFor(project: ReturnType<typeof createCompleteFGProject>) {
  const result = simulateProject(catalog, project);
  const f = result.route?.biomes[0];
  if (f?.authoring !== 'complete') throw new Error('expected complete F simulation');
  return f.rewards;
}

describe('Vow of Forfeit Red Onion substitution', () => {
  it.each(['Boon', 'HermesUpgrade'] as const)(
    'substitutes the first ordinary %s acquisition with a required Red Onion',
    (rewardType) => {
      const rewards = simulated(rewardType);
      const branch = rewards.branches[0];
      if (branch === undefined) throw new Error('expected reward branch');
      expect(branch.state.arcanaFear.fear.forfeitConsumed).toBe(true);
      expect(branch.events).toContainEqual(
        expect.objectContaining({
          kind: 'rewardForfeited',
          rewardType,
          replacementRewardType: 'RoomRewardConsolationPrize',
        }),
      );
      expect(
        branch.events.some(
          (event) =>
            event.kind === 'concreteAcquisition' &&
            semanticAddressKey(event.origin) ===
              semanticAddressKey(createIncomingRewardAddress(biome, goldenFStartId)) &&
            event.acquisition.acquisition.gameName === 'RoomRewardConsolationPrize',
        ),
      ).toBe(true);
      expect(
        rewards.selectedTraitOffers.some(
          (offer) =>
            semanticAddressKey(offer.address.owner) ===
            semanticAddressKey(createIncomingRewardAddress(biome, goldenFStartId)),
        ),
      ).toBe(false);
    },
  );

  it('fixes the first qualifying entered Fields cage before its later pickup', () => {
    const replay = replayEnteredFieldsForfeit(1);
    const branch = replay.evaluation.rewards.branches[0];
    if (branch === undefined) throw new Error('expected Fields reward branch');
    const forfeited = branch.events.find(
      (event) =>
        event.kind === 'rewardForfeited' &&
        semanticAddressKey(event.origin) === semanticAddressKey(fieldsCage1),
    );
    const onion = branch.events.find(
      (event) =>
        event.kind === 'concreteAcquisition' &&
        semanticAddressKey(event.origin) === semanticAddressKey(fieldsCage1),
    );
    const laterPickup = branch.events.find(
      (event) =>
        event.kind === 'concreteAcquisition' &&
        semanticAddressKey(event.origin) === semanticAddressKey(fieldsCage2),
    );
    const laterBoon = branch.events.find(
      (event) =>
        event.kind === 'concreteAcquisition' &&
        event.historySequence > (onion?.historySequence ?? Infinity) &&
        event.acquisition.acquisition.gameName === 'HestiaUpgrade',
    );
    const fieldsForfeits = branch.events.filter(
      (event) =>
        event.kind === 'rewardForfeited' &&
        event.origin.kind === 'localReward' &&
        event.origin.biomeKey === 'H',
    );

    if (forfeited === undefined) throw new Error('expected entered Fields Forfeit evidence');
    expect(forfeited).toMatchObject({
      rewardType: 'HermesUpgrade',
      replacementRewardType: 'RoomRewardConsolationPrize',
    });
    expect(onion).toMatchObject({
      acquisition: { acquisition: { gameName: 'RoomRewardConsolationPrize' } },
    });
    expect(
      branch.events.some(
        (event) =>
          event.kind === 'rewardOffered' &&
          semanticAddressKey(event.origin) === semanticAddressKey(fieldsCage1) &&
          event.offer.rewardType === 'HermesUpgrade',
      ),
    ).toBe(true);
    expect(forfeited?.historySequence).toBeLessThan(onion?.historySequence ?? Infinity);
    expect(laterPickup?.historySequence).toBeLessThan(onion?.historySequence ?? Infinity);
    expect(fieldsForfeits).toEqual([forfeited]);
    expect(laterBoon).toMatchObject({
      acquisition: { acquisition: { gameName: 'HestiaUpgrade' } },
    });
    expect(
      branch.events.some(
        (event) =>
          event.kind === 'rewardForfeited' &&
          semanticAddressKey(event.origin) === semanticAddressKey(fieldsCage2),
      ),
    ).toBe(false);
    expect(
      (branch.state.traitHistory?.events ?? []).some(
        (event) =>
          'owner' in event && semanticAddressKey(event.owner) === semanticAddressKey(fieldsCage1),
      ),
    ).toBe(false);
    expect(
      replay.candidateArtifacts.acquisitionConversions.at(
        createAcquisitionRoleAddress(fieldsCage1, 'self'),
      ),
    ).toMatchObject({
      realizedAcquisition: {
        acquisition: { kind: 'consumable', gameName: 'RoomRewardConsolationPrize' },
      },
    });
    const fieldsEntrySnapshot = replay.evaluation.rewards.runStateSnapshots.find(
      (snapshot) =>
        semanticAddressKey(snapshot.owner) ===
        semanticAddressKey(
          createRoomRunStateCheckpointAddress(
            createOccurrenceAddress(goldenHBiome, fieldsOccurrenceId),
            { kind: 'roomEntered' },
          ),
        ),
    );
    expect(fieldsEntrySnapshot?.forfeitStatus).toBe('consumed');

    const inactiveBranch = replayEnteredFieldsForfeit(0).evaluation.rewards.branches[0];
    if (inactiveBranch === undefined) throw new Error('expected inactive Fields reward branch');
    expect(
      inactiveBranch.events.some(
        (event) =>
          event.kind === 'rewardForfeited' &&
          semanticAddressKey(event.origin) === semanticAddressKey(fieldsCage1),
      ),
    ).toBe(false);
    expect(
      inactiveBranch.events.some(
        (event) =>
          event.kind === 'concreteAcquisition' &&
          semanticAddressKey(event.origin) === semanticAddressKey(fieldsCage1) &&
          event.acquisition.acquisition.gameName !== 'RoomRewardConsolationPrize',
      ),
    ).toBe(true);
  });

  it('publishes the entry-fixed Fields cage realization while a sibling cage blocks', () => {
    let project = applyProjectCommand(loadNemesisFieldsCheckpoint(), catalog, {
      kind: 'ReplaceFearVowRank',
      route: createRouteAddress('Underworld'),
      vowKey: 'BoonSkipShrineUpgrade',
      rank: 1,
    });
    project = authorLegalTraitOffers(project);
    // A new cage2 Boon resets its trait offer, so evaluation blocks at cage2's
    // pickup, which precedes cage1's pickup in this room.
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceLocalReward',
      reward: fieldsCage2,
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'DemeterUpgrade' } },
    });
    const assembly = simulateProjectAssembly(catalog, project);
    const fields = assembly.evaluation.route.biomes.find((biome) => biome.biomeKey === 'H');
    expect(fields?.findings.map((finding) => finding.code)).toEqual(['traitOfferMissing']);
    expect(fields?.findings[0]?.origin).toMatchObject({ kind: 'traitOffer', owner: fieldsCage2 });

    const cage1Role = createAcquisitionRoleAddress(fieldsCage1, 'self');
    expect(acquisitionConversionCandidateForProjectEvaluationAssembly(assembly, cage1Role)).toEqual(
      {
        timePieceAssessments: [],
        artificerAssessments: [],
        seaStarAssessments: [],
        realizedAcquisition: {
          role: 'self',
          lifecyclePoint: 'roomRewardPickup',
          acquisition: { kind: 'consumable', gameName: 'RoomRewardConsolationPrize' },
        },
      },
    );
    // The unreached pickup has no conversion context to answer.
    expect(
      createPreparedProjectCandidateSession(catalog, assembly).evaluate({
        kind: 'acquisitionConversion',
        acquisition: cage1Role,
      }),
    ).toMatchObject({ kind: 'unavailable' });
  });

  it('keeps entry-fixed Forfeit owners distinct during branch equivalence', () => {
    const seed = initializeTestRewardBranches()[0]!;
    const first = appendRewardEvent(seed, 1, {
      kind: 'rewardForfeited',
      origin: fieldsCage1,
      rewardType: 'HermesUpgrade',
      replacementRewardType: 'RoomRewardConsolationPrize',
    });
    const second = appendRewardEvent(seed, 1, {
      kind: 'rewardForfeited',
      origin: fieldsCage2,
      rewardType: 'HermesUpgrade',
      replacementRewardType: 'RoomRewardConsolationPrize',
    });

    expect(mergeEquivalentRewardBranches([first, second])).toHaveLength(2);
  });

  it('substitutes the picked Thessaly Ship-wheel Boon while keeping its trait child dormant', () => {
    const owner = createRewardWheelOfferAddress(
      oBiome,
      oOccurrenceIds.combat04,
      'wheel1',
      'offer1',
    );
    const value = {
      rewardType: 'Boon' as const,
      payload: { kind: 'BoonSource' as const, source: 'ApolloUpgrade' },
    };
    let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceFearVowRank',
      route: createRouteAddress('Surface'),
      vowKey: 'BoonSkipShrineUpgrade',
      rank: 1,
    });
    const session = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );

    expect(session.evaluate({ kind: 'rewardWheelOffer', offer: owner, value })).toMatchObject({
      kind: 'rewardWheelOffer',
      result: { supported: true, findings: [] },
    });

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: owner,
      value,
    });
    const result = simulateProject(catalog, project);
    const o = result.route?.biomes.find((candidate) => candidate.biomeKey === 'O');
    if (o?.authoring !== 'complete') throw new Error('expected complete O simulation');
    const branch = o.rewards.branches[0];
    if (branch === undefined) throw new Error('expected reward branch');

    expect(branch.state.arcanaFear.fear.forfeitConsumed).toBe(true);
    expect(branch.events).toContainEqual(
      expect.objectContaining({
        kind: 'rewardForfeited',
        origin: owner,
        rewardType: 'Boon',
        replacementRewardType: 'RoomRewardConsolationPrize',
      }),
    );
    expect(
      branch.events.some(
        (event) =>
          event.kind === 'concreteAcquisition' &&
          semanticAddressKey(event.origin) === semanticAddressKey(owner) &&
          event.acquisition.acquisition.gameName === 'RoomRewardConsolationPrize',
      ),
    ).toBe(true);
    expect(
      o.rewards.selectedTraitOffers.some(
        (offer) => semanticAddressKey(offer.address.owner) === semanticAddressKey(owner),
      ),
    ).toBe(false);
  });

  describe('picked Ship-wheel realization fixed at the pick', () => {
    const wheel = createRewardWheelAddress(oBiome, oOccurrenceIds.combat04, 'wheel1');
    const offer1 = createRewardWheelOfferAddress(
      oBiome,
      oOccurrenceIds.combat04,
      'wheel1',
      'offer1',
    );
    const offer2 = createRewardWheelOfferAddress(
      oBiome,
      oOccurrenceIds.combat04,
      'wheel1',
      'offer2',
    );
    const combat1 = createEncounterPhaseAddress(
      oBiome,
      createOccurrenceAddress(oBiome, oOccurrenceIds.combat04),
      'Combat1',
    );
    const boon = {
      rewardType: 'Boon' as const,
      payload: { kind: 'BoonSource' as const, source: 'ApolloUpgrade' },
    };
    const withForfeit = () =>
      applyProjectCommand(loadSurfaceNOProject(), catalog, {
        kind: 'ReplaceFearVowRank',
        route: createRouteAddress('Surface'),
        vowKey: 'BoonSkipShrineUpgrade',
        rank: 1,
      });
    // An unsupported Gorgon condition blocks at the wheel's combat start, which
    // sits between the pick and the wheel reward pickup.
    const blockedAtCombat = (project: ReturnType<typeof withForfeit>) => {
      const assembly = simulateProjectAssembly(
        catalog,
        applyProjectCommand(project, catalog, {
          kind: 'ReplaceGorgonDeathDefianceCondition',
          phase: combat1,
          value: true,
        }),
      );
      expect(assembly.evaluation.issue).toMatchObject({
        kind: 'invalid',
        owner: createGorgonPhaseAddress(combat1),
        reasons: [expect.objectContaining({ code: 'gorgonConditionUnavailable' })],
      });
      return assembly;
    };
    const forfeitEvents = (assembly: ReturnType<typeof simulateProjectAssembly>) => {
      const o = assembly.evaluation.route.biomes.find((candidate) => candidate.biomeKey === 'O');
      if (o === undefined || !('rewards' in o)) throw new Error('expected O reward evaluation');
      return o.rewards.branches[0]!.events.filter(
        (event) =>
          event.kind === 'rewardForfeited' &&
          semanticAddressKey(event.origin) === semanticAddressKey(offer1),
      );
    };

    it('publishes the picked Boon realization before its combat and settles the same outcome after it', () => {
      const project = authorLegalTraitOffers(
        applyProjectCommand(withForfeit(), catalog, {
          kind: 'ReplaceRewardWheelOffer',
          offer: offer1,
          value: boon,
        }),
      );
      const role = createAcquisitionRoleAddress(offer1, 'source');

      const blocked = blockedAtCombat(project);
      const fixed = acquisitionConversionCandidateForProjectEvaluationAssembly(blocked, role);
      expect(fixed).toEqual({
        timePieceAssessments: [],
        artificerAssessments: [],
        seaStarAssessments: [],
        realizedAcquisition: {
          role: 'source',
          lifecyclePoint: 'roomRewardPickup',
          acquisition: { kind: 'consumable', gameName: 'RoomRewardConsolationPrize' },
        },
      });
      // Consumption still belongs to the unreached pickup settlement.
      expect(forfeitEvents(blocked)).toEqual([]);
      expect(
        createPreparedProjectCandidateSession(catalog, blocked).evaluate({
          kind: 'acquisitionConversion',
          acquisition: role,
        }),
      ).toMatchObject({ kind: 'unavailable' });

      const settled = simulateProjectAssembly(catalog, project);
      expect(settled.evaluation.issue).toBeUndefined();
      const capability = acquisitionConversionCandidateForProjectEvaluationAssembly(settled, role);
      expect(capability?.timePieceAssessments).toHaveLength(1);
      expect(capability?.realizedAcquisition).toEqual(fixed?.realizedAcquisition);
      expect(forfeitEvents(settled)).toHaveLength(1);
    });

    it('publishes nothing for an unpicked qualifying offer or a non-qualifying pick', () => {
      let project = applyProjectCommand(withForfeit(), catalog, {
        kind: 'ReplaceRewardWheelOfferCount',
        wheel,
        offerCount: 2,
      });
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceRewardWheelOffer',
        offer: offer2,
        value: boon,
      });
      const blocked = blockedAtCombat(project);
      expect(
        acquisitionConversionCandidateForProjectEvaluationAssembly(
          blocked,
          createAcquisitionRoleAddress(offer2, 'source'),
        ),
      ).toBeUndefined();
      expect(
        acquisitionConversionCandidateForProjectEvaluationAssembly(
          blocked,
          createAcquisitionRoleAddress(offer1, 'self'),
        ),
      ).toBeUndefined();
    });
  });

  it('does not forfeit a qualifying unpicked Ship-wheel preview', () => {
    const wheel = createRewardWheelAddress(oBiome, oOccurrenceIds.combat04, 'wheel1');
    const pickedOwner = createRewardWheelOfferAddress(
      oBiome,
      oOccurrenceIds.combat04,
      'wheel1',
      'offer1',
    );
    const previewOwner = createRewardWheelOfferAddress(
      oBiome,
      oOccurrenceIds.combat04,
      'wheel1',
      'offer2',
    );
    let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceFearVowRank',
      route: createRouteAddress('Surface'),
      vowKey: 'BoonSkipShrineUpgrade',
      rank: 1,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOfferCount',
      wheel,
      offerCount: 2,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: previewOwner,
      value: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
      },
    });
    const result = simulateProject(catalog, project);
    const o = result.route?.biomes.find((candidate) => candidate.biomeKey === 'O');
    if (o?.authoring !== 'complete') throw new Error('expected complete O simulation');
    const branch = o.rewards.branches[0];
    if (branch === undefined) throw new Error('expected reward branch');

    expect(branch.events).toContainEqual(
      expect.objectContaining({
        kind: 'concreteAcquisition',
        origin: pickedOwner,
        acquisition: expect.objectContaining({
          acquisition: expect.objectContaining({ gameName: 'MaxHealthDrop' }),
        }),
      }),
    );
    expect(
      branch.events.some(
        (event) =>
          event.kind === 'rewardForfeited' &&
          semanticAddressKey(event.origin) === semanticAddressKey(previewOwner),
      ),
    ).toBe(false);
    expect(
      branch.events.some(
        (event) =>
          event.kind === 'concreteAcquisition' &&
          semanticAddressKey(event.origin) === semanticAddressKey(previewOwner),
      ),
    ).toBe(false);
  });

  it('keeps the selected door/bag outcome while its invalid dormant child produces no evaluation or finding', () => {
    const owner = createIncomingRewardAddress(biome, goldenFStartId);
    let project = createCompleteFGProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFearVowRank',
      route: createRouteAddress('Underworld'),
      vowKey: 'BoonSkipShrineUpgrade',
      rank: 1,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingReward',
      reward: createStartingRewardAddress('Underworld'),
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(owner, 'source'),
      value: {
        kind: 'traits',
        giverKey: 'Apollo',
        options: [
          { traitKey: 'ApolloCastBoon', rarity: 'Common' },
          { traitKey: 'ApolloSprintBoon', rarity: 'Common' },
          { traitKey: 'ApolloManaBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    const withoutForfeit = rewardsFor(
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceFearVowRank',
        route: createRouteAddress('Underworld'),
        vowKey: 'BoonSkipShrineUpgrade',
        rank: 0,
      }),
    );
    expect(withoutForfeit.findings).toContainEqual(
      expect.objectContaining({
        code: 'traitOfferGenerationUnavailable',
        origin: createTraitOfferAddress(owner, 'source'),
      }),
    );
    const rewards = rewardsFor(project);
    const branch = rewards.branches[0]!;
    expect(branch.state.bags.RunProgress?.remainingEntryCounts).toBeDefined();
    expect(
      branch.events.some(
        (event) =>
          event.kind === 'concreteAcquisition' &&
          semanticAddressKey(event.origin) === semanticAddressKey(owner) &&
          event.acquisition.acquisition.gameName === 'RoomRewardConsolationPrize',
      ),
    ).toBe(true);
    expect(
      rewards.selectedTraitOffers.some(
        (offer) => semanticAddressKey(offer.address.owner) === semanticAddressKey(owner),
      ),
    ).toBe(false);
    expect(rewards.findings).not.toContainEqual(
      expect.objectContaining({ origin: createTraitOfferAddress(owner, 'source') }),
    );
    expect(
      (branch.state.traitHistory?.events ?? []).some(
        (event) =>
          'owner' in event && semanticAddressKey(event.owner) === semanticAddressKey(owner),
      ),
    ).toBe(false);
  });

  it('keeps the unavailable acquisition in the progressive candidate frontier without exposing its dormant trait child', () => {
    const owner = createIncomingRewardAddress(biome, goldenFStartId);
    let project = createCompleteFGProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFearVowRank',
      route: createRouteAddress('Underworld'),
      vowKey: 'BoonSkipShrineUpgrade',
      rank: 1,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingReward',
      reward: createStartingRewardAddress('Underworld'),
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    });
    const session = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );
    expect(
      session.evaluate({
        kind: 'traitOffer',
        trait: createTraitOfferAddress(owner, 'source'),
        value: {
          kind: 'traits',
          giverKey: 'Apollo',
          options: [{ traitKey: 'ApolloCastBoon', rarity: 'Common' }],
          selectedOptionKey: 'option1',
        },
      }),
    ).toMatchObject({ kind: 'unavailable' });
  });
});
