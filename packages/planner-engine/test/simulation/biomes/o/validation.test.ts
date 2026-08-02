import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createTargetAddress,
} from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
  simulateProject,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { createRepresentativeNOProject, oBiome, oOccurrenceIds } from '@run-planner/test-fixtures';

function evaluateO(project = createRepresentativeNOProject()) {
  const evaluation = simulateProject(catalog, project);
  const biome = evaluation.routes
    .find((route) => route.routeKey === 'Surface')
    ?.biomes.find((candidate) => candidate.biomeKey === 'O');
  if (biome?.authoring !== 'complete') throw new Error('O fixture did not complete');
  return { project, evaluation, biome };
}

function createEmptyTrialDecision(sourceProject = createRepresentativeNOProject()) {
  const decision = createExitDecisionAddress(oBiome, {
    kind: 'occurrence',
    occurrenceId: oOccurrenceIds.combat01,
  });
  let project = applyProjectCommand(sourceProject, catalog, {
    kind: 'RemoveExitDecision',
    decision,
  });
  project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
  return {
    project,
    target: createTargetAddress(oBiome, decision.source, 'exit1'),
  };
}

describe('selected O validation', () => {
  it('validates the complete N/O prefix with exact Ship support and forced Preboss pressure', () => {
    const { evaluation, biome: o } = evaluateO();

    expect(evaluation.status).toBe('valid');
    expect(o.findings).toEqual([]);
    expect(
      o.roomGeneration.ordinary.encounterCounts.map((entry) => ({
        selected: entry.selectedEncounterCount,
        support: entry.supportEncounterCounts,
      })),
    ).toEqual([
      { selected: 2, support: [2] },
      { selected: 2, support: [2, 3] },
      { selected: 2, support: [2, 3] },
      { selected: 2, support: [2, 3] },
    ]);
    expect(
      o.roomGeneration.ordinary.forcePressure.find(
        (entry) => entry.selectedGameName === 'O_Devotion01',
      ),
    ).toMatchObject({ selectedPossible: true, selectedExclusionReasons: [] });
    expect(o.rewards.targetHistory).toHaveLength(7);
  });

  it('addresses an unavailable first-room Combat2 count at its room occurrence', () => {
    const project = applyProjectCommand(createRepresentativeNOProject(), catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence: createOccurrenceAddress(oBiome, oOccurrenceIds.combat04),
      encounterCount: 3,
    });
    const { biome: o } = evaluateO(project);

    expect(o.validity).toBe('invalid');
    expect(o.findings).toContainEqual(
      expect.objectContaining({
        code: 'encounterCountUnavailable',
        origin: createOccurrenceAddress(oBiome, oOccurrenceIds.combat04),
        evidence: expect.objectContaining({
          selectedEncounterCount: 3,
          supportEncounterCounts: [2],
        }),
      }),
    );
  });

  it('rejects replacement of the declaration-fixed Devotion reward type', () => {
    expect(() =>
      applyProjectCommand(createRepresentativeNOProject(), catalog, {
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(oBiome, oOccurrenceIds.devotion),
        value: { rewardType: 'WeaponUpgrade' },
      }),
    ).toThrow(/O_Devotion01 has a fixed reward type/);
  });

  it('retains forced-pool and appearance-cap failures at their physical target owners', () => {
    const forced = applyProjectCommand(createRepresentativeNOProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(oBiome, oOccurrenceIds.story),
      gameName: 'O_Combat03',
    });
    const { biome: forcedBiome } = evaluateO(forced);
    expect(
      forcedBiome.roomGeneration.ordinary.forcePressure.find(
        (entry) =>
          entry.targetOrigin.kind === 'target' &&
          entry.targetOrigin.source.kind === 'occurrence' &&
          entry.targetOrigin.source.occurrenceId === oOccurrenceIds.devotion,
      ),
    ).toMatchObject({ selectedPossible: false, selectedExclusionReasons: ['forcedPool'] });

    const capped = applyProjectCommand(createRepresentativeNOProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(oBiome, oOccurrenceIds.combat02),
      gameName: 'O_Combat01',
    });
    const { biome: cappedBiome } = evaluateO(capped);
    expect(
      cappedBiome.roomGeneration.ordinary.forcePressure.find(
        (entry) =>
          entry.targetOrigin.kind === 'target' &&
          entry.targetOrigin.source.kind === 'occurrence' &&
          entry.targetOrigin.source.occurrenceId === oOccurrenceIds.story,
      ),
    ).toMatchObject({
      selectedPossible: false,
      selectedExclusionReasons: expect.arrayContaining(['maxAppearancesThisBiome']),
    });
  });

  it('keeps a jointly overdrawn wheel failure attached to its concrete offer owner', () => {
    let project = applyProjectCommand(createRepresentativeNOProject(), catalog, {
      kind: 'ReplaceRewardWheelOfferCount',
      wheel: createRewardWheelAddress(oBiome, oOccurrenceIds.combat04, 'wheel1'),
      offerCount: 2,
    });
    for (const offerKey of ['offer1', 'offer2'] as const) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceRewardWheelOffer',
        offer: createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat04, 'wheel1', offerKey),
        value: { rewardType: 'SpellDrop' },
      });
    }
    const { biome } = evaluateO(project);

    expect(biome.validity).toBe('invalid');
    expect(biome.rewards.findings).toContainEqual(
      expect.objectContaining({
        code: 'rewardBagEntryUnavailable',
        origin: createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat04, 'wheel1', 'offer1'),
      }),
    );
  });

  it('keeps a wheel-offer failure assessable from its wheel store repair', () => {
    const wheel = createRewardWheelAddress(oBiome, oOccurrenceIds.combat04, 'wheel1');
    const offer = createRewardWheelOfferAddress(
      oBiome,
      oOccurrenceIds.combat04,
      'wheel1',
      'offer1',
    );
    const project = applyProjectCommand(createRepresentativeNOProject(), catalog, {
      kind: 'ReplaceRewardWheelStore',
      wheel,
      storeKey: 'MetaProgress',
    });
    const { biome } = evaluateO(project);

    expect(biome.validity).toBe('invalid');
    expect(biome.rewards.findings).toContainEqual(
      expect.objectContaining({ code: 'rewardBagEntryUnavailable', origin: offer }),
    );
    expect(
      createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, project),
      ).evaluate({
        kind: 'rewardWheelStore',
        wheel,
        storeKey: 'RunProgress',
      }),
    ).toMatchObject({
      kind: 'rewardWheelStore',
      result: {
        storeKey: 'RunProgress',
        supportedStoreKeys: expect.arrayContaining(['MetaProgress', 'RunProgress']),
        selectedPossible: true,
        findings: [],
      },
    });
    expect(
      createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, project),
      ).evaluate({
        kind: 'shipEncounterCount',
        occurrence: createOccurrenceAddress(oBiome, oOccurrenceIds.combat07),
        encounterCount: 2,
      }),
    ).toMatchObject({ kind: 'unavailable', reason: 'coverageNotReached' });
  });

  it('evaluates a supported opening target through the prepared selected O prefix', () => {
    const { project } = evaluateO();
    const candidates = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );

    expect(
      candidates.evaluate({
        kind: 'roomTarget',
        target: createTargetAddress(
          oBiome,
          { kind: 'occurrence', occurrenceId: oOccurrenceIds.intro },
          'exit1',
        ),
        gameName: 'O_Combat02',
      }),
    ).toMatchObject({
      kind: 'roomTarget',
      result: {
        pressure: {
          selectedPossible: true,
          selectedExclusionReasons: [],
        },
      },
    });
  });

  it('uses acquired reward history for an uncommitted Trial target', () => {
    const { project, target } = createEmptyTrialDecision();
    const assembly = simulateProjectAssembly(catalog, project);
    const o = assembly.evaluation.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'O');
    if (o === undefined || !('rewards' in o)) {
      throw new Error('O prefix did not publish reward checkpoints');
    }

    expect(o.rewards.targetHistory).toContainEqual(expect.objectContaining({ origin: target }));

    expect(
      createPreparedProjectCandidateSession(catalog, assembly).evaluate({
        kind: 'roomTarget',
        target,
        gameName: 'O_Devotion01',
      }),
    ).toMatchObject({
      kind: 'roomTarget',
      result: {
        pressure: {
          selectedPossible: true,
          selectedExclusionReasons: [],
        },
        findings: [],
      },
    });
  });

  it('keeps Ship and every reward-wheel candidate family in the engine', () => {
    const { project } = evaluateO();
    const occurrence = project.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'O')
      ?.topology?.occurrences.find(
        (candidate) => candidate.occurrenceId === oOccurrenceIds.combat04,
      );
    if (occurrence?.state.kind !== 'shipCombat') {
      throw new Error('O fixture must retain a Ship combat state');
    }
    const wheel = occurrence.state.wheels.wheel1;
    const offer = wheel?.offers.offer1;
    if (wheel === undefined || offer === undefined) {
      throw new Error('O Ship fixture must retain wheel1 offer1');
    }
    const wheelAddress = createRewardWheelAddress(oBiome, occurrence.occurrenceId, 'wheel1');
    const candidates = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    ).evaluate([
      {
        kind: 'shipEncounterCount',
        occurrence: createOccurrenceAddress(oBiome, occurrence.occurrenceId),
        encounterCount: occurrence.state.encounterCount,
      },
      { kind: 'rewardWheelOfferCount', wheel: wheelAddress, offerCount: wheel.offerCount },
      { kind: 'rewardWheelStore', wheel: wheelAddress, storeKey: wheel.storeKey },
      {
        kind: 'rewardWheelOffer',
        offer: createRewardWheelOfferAddress(oBiome, occurrence.occurrenceId, 'wheel1', 'offer1'),
        value: offer,
      },
      {
        kind: 'rewardWheelPicked',
        wheel: wheelAddress,
        pickedOfferIndex: wheel.pickedOfferIndex,
      },
    ]);

    expect(candidates).toMatchObject([
      { kind: 'shipEncounterCount', result: { selectedPossible: true, findings: [] } },
      { kind: 'rewardWheelOfferCount', result: { selectedPossible: true, findings: [] } },
      { kind: 'rewardWheelStore', result: { selectedPossible: true, findings: [] } },
      { kind: 'rewardWheelOffer', result: { supported: true, findings: [] } },
      { kind: 'rewardWheelPicked', result: { selectedPossible: true, findings: [] } },
    ]);
  });

  it('evaluates dormant wheel2 when a supported encounter-count candidate activates it', () => {
    const occurrence = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const wheel = createRewardWheelAddress(oBiome, oOccurrenceIds.combat07, 'wheel2');
    let project = applyProjectCommand(createRepresentativeNOProject(), catalog, {
      kind: 'ReplaceRewardWheelOfferCount',
      wheel,
      offerCount: 2,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat07, 'wheel2', 'offer1'),
      value: { rewardType: 'RoomMoneyDrop' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat07, 'wheel2', 'offer2'),
      value: { rewardType: 'SpellDrop' },
    });

    const evaluation = simulateProject(catalog, project);
    expect(evaluation.status).toBe('valid');
    expect(
      createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, project),
      ).evaluate({ kind: 'shipEncounterCount', occurrence, encounterCount: 3 }),
    ).toMatchObject({
      kind: 'shipEncounterCount',
      result: {
        encounterCount: 3,
        supportEncounterCounts: [2, 3],
        selectedPossible: false,
        findings: [
          expect.objectContaining({
            code: 'rewardBagEntryUnavailable',
            origin: expect.objectContaining({
              kind: 'rewardWheelOffer',
              occurrenceId: oOccurrenceIds.combat07,
              wheelKey: 'wheel2',
            }),
          }),
        ],
      },
    });

    const activeProject = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence,
      encounterCount: 3,
    });
    expect(
      createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, activeProject),
      ).evaluate({ kind: 'rewardWheelOfferCount', wheel, offerCount: 1 }),
    ).toMatchObject({
      kind: 'rewardWheelOfferCount',
      result: { offerCount: 1, selectedPossible: true, findings: [] },
    });
  });

  it('uses the source-offer policy on Ship continuation and the explicit base store on Devotion', () => {
    const { project } = evaluateO();
    const candidates = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );

    expect(
      candidates.evaluate({
        kind: 'batchRewardStore',
        rewardStore: createBatchRewardStoreAddress(
          oBiome,
          createExitDecisionAddress(oBiome, {
            kind: 'occurrence',
            occurrenceId: oOccurrenceIds.devotion,
          }).source,
        ),
        storeKey: 'MetaProgress',
      }),
    ).toMatchObject({
      kind: 'batchRewardStore',
      result: { selectedPossible: true, supportStoreKeys: ['MetaProgress'] },
    });
    expect(
      candidates.evaluate({
        kind: 'takeoverPrebossBatch',
        source: createExitDecisionAddress(oBiome, {
          kind: 'occurrence',
          occurrenceId: oOccurrenceIds.combat02,
        }),
        gameName: 'O_PreBoss01',
      }),
    ).toMatchObject({ kind: 'takeoverPrebossBatch', result: { requiredExitKeys: ['exit1'] } });
  });

  it('keeps the declaration-fixed terminal takeover assessable from its empty envelope', () => {
    const decision = createExitDecisionAddress(oBiome, {
      kind: 'occurrence',
      occurrenceId: oOccurrenceIds.combat02,
    });
    let project = applyProjectCommand(createRepresentativeNOProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision,
    });
    project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });

    expect(
      createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, project),
      ).evaluate({ kind: 'takeoverPrebossBatch', source: decision, gameName: 'O_PreBoss01' }),
    ).toMatchObject({
      kind: 'takeoverPrebossBatch',
      result: { support: 'required', selectedPossible: true, requiredExitKeys: ['exit1'] },
    });
  });
});
