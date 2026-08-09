import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createRouteAddress,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createTargetAddress,
  createTraitOfferAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
  simulateProject,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  authorLegalTraitOffers,
  createRepresentativeNOProject,
  oBiome,
  oOccurrenceIds,
} from '@run-planner/test-fixtures';

function evaluateO(project = createRepresentativeNOProject()) {
  const evaluation = simulateProject(catalog, project);
  const biome = evaluation.routes
    .find((route) => route.routeKey === 'Surface')
    ?.biomes.find((candidate) => candidate.biomeKey === 'O');
  if (biome?.authoring !== 'complete') throw new Error('O fixture did not complete');
  return { project, evaluation, biome };
}

function evaluateValidO(project = createRepresentativeNOProject()) {
  const result = evaluateO(project);
  if (result.biome.validity !== 'valid') throw new Error('O fixture did not complete-valid');
  return { ...result, biome: result.biome };
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
    const { project, evaluation, biome: o } = evaluateO();

    expect(evaluation.status).toBe('valid');
    expect(o.findings).toEqual([]);
    const candidates = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );
    const shipCounts = [
      oOccurrenceIds.combat04,
      oOccurrenceIds.combat07,
      oOccurrenceIds.combat01,
      oOccurrenceIds.combat02,
    ].map((occurrenceId) => {
      const candidate = candidates.evaluate({
        kind: 'shipEncounterCount',
        occurrence: createOccurrenceAddress(oBiome, occurrenceId),
        encounterCount: 2,
      });
      if (candidate.kind !== 'shipEncounterCount') {
        throw new Error(`O Ship ${occurrenceId} candidate is unavailable`);
      }
      return {
        selected: candidate.result.encounterCount,
        support: candidate.result.supportEncounterCounts,
      };
    });
    expect(shipCounts).toEqual([
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

  it('preserves a non-Ship terminal base store through the Preboss takeover and completion tail', () => {
    const terminalDecision = createExitDecisionAddress(oBiome, {
      kind: 'occurrence',
      occurrenceId: oOccurrenceIds.combat02,
    });
    let project = applyProjectCommand(createRepresentativeNOProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision: terminalDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(oBiome, oOccurrenceIds.devotion),
      gameName: 'O_Reprieve01',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(oBiome, oOccurrenceIds.devotion),
      value: { rewardType: 'MaxHealthDrop' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(oBiome, oOccurrenceIds.combat02),
      gameName: 'O_Devotion01',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(oBiome, oOccurrenceIds.combat02),
      value: {
        rewardType: 'Devotion',
        payload: {
          kind: 'DevotionPair',
          chosenSource: 'AresUpgrade',
          spurnedSource: 'HephaestusUpgrade',
        },
      },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: terminalDecision,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(oBiome, terminalDecision.source),
      storeKey: 'MetaProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceWithTakeoverBatch',
      decision: terminalDecision,
      gameName: 'O_PreBoss01',
      targetOccurrenceIds: { exit1: oOccurrenceIds.preboss },
    });

    const { biome } = evaluateValidO(authorLegalTraitOffers(project));
    expect(biome.snapshot.decisions.at(-1)).toMatchObject({
      kind: 'batch',
      rewardStore: { kind: 'authoredBaseStore', baseRewardStoreKey: 'MetaProgress' },
      targets: [
        {
          room: {
            gameName: 'O_PreBoss01',
            incomingReward: { resolvedStoreKey: 'MetaProgress' },
          },
        },
      ],
    });
    expect(biome.snapshot.completionRooms[0]).toMatchObject({
      gameName: 'O_Boss01',
      enteredRewardStoreKey: 'MetaProgress',
    });
  });

  it('addresses an unavailable first-room Combat2 count at its exact phase', () => {
    const occurrence = createOccurrenceAddress(oBiome, oOccurrenceIds.combat04);
    const project = applyProjectCommand(createRepresentativeNOProject(), catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence,
      encounterCount: 3,
    });
    const { biome: o } = evaluateO(project);
    const candidate = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    ).evaluate({ kind: 'shipEncounterCount', occurrence, encounterCount: 3 });

    expect(o.validity).toBe('invalid');
    if (!('materializedPrefix' in o)) {
      throw new Error('invalid Ship phase did not retain an assessed prefix');
    }
    const blockedPhaseEvents = o.history.events.filter(
      (event) =>
        'origin' in event &&
        event.origin.kind === 'occurrence' &&
        event.origin.occurrenceId === oOccurrenceIds.combat04,
    );
    const creation = blockedPhaseEvents.find((event) => event.kind === 'roomCreated');
    const preparation = blockedPhaseEvents.find((event) => event.kind === 'roomPrepared');
    const recorded = blockedPhaseEvents.filter((event) => event.kind === 'encounterRecorded');
    expect(creation).toBeDefined();
    expect(preparation).toBeDefined();
    expect(recorded.map((event) => event.phaseKey)).toEqual(['Intro', 'Combat1']);
    expect(blockedPhaseEvents.some((event) => event.kind === 'roomEntered')).toBe(false);
    expect(blockedPhaseEvents.some((event) => event.kind === 'encounterStarted')).toBe(false);
    const blockedFinding = o.findings.find(
      (finding) =>
        finding.code === 'encounterSlotActivationUnavailable' &&
        finding.origin.kind === 'encounterPhase' &&
        finding.origin.owner.kind === 'occurrence' &&
        finding.origin.owner.occurrenceId === oOccurrenceIds.combat04 &&
        finding.origin.phaseKey === 'Combat2',
    );
    if (preparation === undefined || blockedFinding === undefined) {
      throw new Error('blocked Ship phase lost its preparation checkpoint or finding');
    }
    const beforeSequence = blockedFinding.evidence.beforeSequence;
    if (typeof beforeSequence !== 'number') {
      throw new Error('blocked Ship phase lost its numeric preparation evidence');
    }
    expect(recorded[0]?.sequence).toBe(preparation.sequence + 1);
    expect(beforeSequence).toBe(recorded.at(-1)?.sequence);
    expect(blockedFinding).toMatchObject({ evidence: { slotKey: 'Combat2' } });
    expect(candidate).toMatchObject({
      kind: 'shipEncounterCount',
      result: {
        supportEncounterCounts: [2],
        selectedPossible: false,
        findings: [
          expect.objectContaining({
            code: 'encounterSlotActivationUnavailable',
            origin: createEncounterPhaseAddress(
              oBiome,
              { kind: 'occurrence', occurrenceId: oOccurrenceIds.combat04 },
              'Combat2',
            ),
          }),
        ],
      },
    });
  });

  it('retains only the blocked Devotion role capability before its after-combat sibling', () => {
    const base = authorLegalTraitOffers(createRepresentativeNOProject());
    const baseO = evaluateValidO(base).biome;
    const owner = createIncomingRewardAddress(oBiome, oOccurrenceIds.devotion);
    const selected = baseO.rewards.selectedTraitOffers.filter(
      (trace) => semanticAddressKey(trace.address.owner) === semanticAddressKey(owner),
    );
    const chosen = selected.find((trace) => trace.acquisitionRole === 'chosenSource');
    const spurned = selected.find((trace) => trace.acquisitionRole === 'spurnedSource');
    if (chosen === undefined || spurned === undefined) {
      throw new Error('Devotion capability fixture lost its legal trait roles');
    }
    const [first, second, third] = chosen.offer.options;
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error('Devotion chosen offer lost its complete options');
    }
    const chosenAddress = createTraitOfferAddress(owner, 'chosenSource');
    const spurnedAddress = createTraitOfferAddress(owner, 'spurnedSource');
    const project = applyProjectCommand(base, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: chosenAddress,
      value: {
        giverKey: chosen.offer.giverKey,
        options: [{ ...first, rarity: 'Heroic' }, second, third],
        selectedOptionKey: 'option1',
      },
    });
    const assembly = simulateProjectAssembly(catalog, project);
    const evaluated = assembly.evaluation.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'O');
    if (evaluated?.authoring !== 'complete' || evaluated.validity !== 'invalid') {
      throw new Error('invalid Devotion chosen offer did not block complete O');
    }

    expect(evaluated.coverage).toMatchObject({ kind: 'prefix', blockedAt: chosenAddress });
    expect(evaluated.rewards.selectedTraitOffers).toContainEqual(
      expect.objectContaining({ address: chosenAddress }),
    );
    expect(evaluated.rewards.selectedTraitOffers).not.toContainEqual(
      expect.objectContaining({ address: spurnedAddress }),
    );
    const session = createPreparedProjectCandidateSession(catalog, assembly);
    expect(
      session.evaluate({ kind: 'traitOffer', trait: chosenAddress, value: chosen.offer }),
    ).toMatchObject({ kind: 'traitOffer', result: { supported: true, findings: [] } });
    expect(
      session.evaluate({ kind: 'traitOffer', trait: spurnedAddress, value: spurned.offer }),
    ).toMatchObject({ kind: 'unavailable', reason: 'coverageNotReached' });
  });

  it('retains the invalid Combat2 owner for diagnosis while commands remain structural', () => {
    const occurrence = createOccurrenceAddress(oBiome, oOccurrenceIds.combat04);
    const project = applyProjectCommand(createRepresentativeNOProject(), catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence,
      encounterCount: 3,
    });
    const phase = createEncounterPhaseAddress(
      oBiome,
      { kind: 'occurrence', occurrenceId: oOccurrenceIds.combat04 },
      'Combat2',
    );

    const selected = applyProjectCommand(project, catalog, {
      encounterKey: 'IcarusCombatO',
      kind: 'SelectEncounter',
      phase,
    });
    expect(selected).not.toBe(project);
    expect(applyProjectCommand(project, catalog, { kind: 'ResetEncounter', phase })).toBe(project);
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
    const session = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );

    expect(biome.validity).toBe('invalid');
    expect(biome.rewards.findings).toContainEqual(
      expect.objectContaining({ code: 'rewardBagEntryUnavailable', origin: offer }),
    );
    expect(
      session.evaluate({
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
      session.evaluate({
        kind: 'rewardWheelOffer',
        offer,
        value: { rewardType: 'GiftDrop' },
      }),
    ).toMatchObject({ kind: 'rewardWheelOffer', result: { supported: true, findings: [] } });
    expect(
      session.evaluate({
        kind: 'shipEncounterCount',
        occurrence: createOccurrenceAddress(oBiome, oOccurrenceIds.combat04),
        encounterCount: 2,
      }),
    ).toMatchObject({ kind: 'shipEncounterCount' });
    expect(
      session.evaluate({
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
        value: offer.offer,
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

  it('rejects a stale wheel2 Hammer after the route loadout changes', () => {
    let project = createRepresentativeNOProject();
    const shipOwner = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const wheel = createRewardWheelAddress(oBiome, oOccurrenceIds.combat07, 'wheel2');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOfferCount',
      wheel,
      offerCount: 2,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat07, 'wheel2', 'offer2'),
      value: { rewardType: 'WeaponUpgrade' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelPicked',
      wheel,
      pickedOfferIndex: 2,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence: shipOwner,
      encounterCount: 3,
    });
    project = authorLegalTraitOffers(project);
    const route = project.routes.find((candidate) => candidate.routeKey === 'Surface');
    if (route === undefined) throw new Error('O fixture has no Surface route');
    const replacementWeapon = catalog.weapons.values.find(
      (weapon) => weapon.key !== route.loadout.weaponKey,
    );
    if (replacementWeapon === undefined) throw new Error('missing replacement weapon');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRouteLoadout',
      route: createRouteAddress('Surface'),
      weaponKey: replacementWeapon.key,
      aspectKey: replacementWeapon.defaultAspectKey,
    });

    const assembly = simulateProjectAssembly(catalog, project);
    const evaluated = assembly.evaluation.routes
      .find((candidate) => candidate.routeKey === 'Surface')
      ?.biomes.find((candidate) => candidate.biomeKey === 'O');
    if (evaluated?.authoring !== 'complete' || evaluated.validity !== 'invalid') {
      throw new Error('stale Hammer fixture did not block complete O');
    }
    expect(evaluated.findings).toContainEqual(
      expect.objectContaining({ code: 'wrongHammerLoadout' }),
    );
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
