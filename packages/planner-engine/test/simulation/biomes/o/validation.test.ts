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
});
