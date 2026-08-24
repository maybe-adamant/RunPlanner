import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  assembleRoomActionDomain,
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createAcquisitionSiteAddress,
  createEncounterPhaseAddress,
  createIncomingRewardAddress,
  createNemesisRandomEventAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomActionAddress,
  roomActionKey,
  semanticAddressKey,
  type AuthoredNemesisRandomEventOutcome,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  nemesisRandomEventCandidateSupportForProjectEvaluationAssembly,
  simulateProjectAssembly,
  type NemesisRandomEventBranchAssessment,
} from '@run-planner/engine/simulation';
import {
  createGoldenFGHIProject,
  createGoldenFGHProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenHBiome,
} from '@run-planner/test-fixtures/underworld';

describe('Nemesis random events', () => {
  const phase = createEncounterPhaseAddress(
    goldenFBiome,
    { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(5, 1) },
    'Encounter',
  );

  function occurrence(project: ProjectDocument) {
    const selected = project.routes[0]?.biomes[0]?.topology?.occurrences.find(
      (candidate) => candidate.occurrenceId === goldenFOccurrenceId(5, 1),
    );
    if (selected === undefined) throw new Error('missing selected F Nemesis occurrence');
    return selected;
  }

  function selectEvent(project = createGoldenFGHIProject()) {
    return applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'NemesisRandomEvent',
    });
  }

  function insertOptionalResult(project: ProjectDocument) {
    const selected = occurrence(project);
    const reference = {
      kind: 'interactAcquisitionEntry' as const,
      siteKey: 'nemesisGenerated:Encounter',
      entryKey: 'result',
    };
    const sourceIndex = selected.roomActions.order.findIndex(
      (candidate) => candidate.kind === 'interactEncounter' && candidate.phaseKey === 'Encounter',
    );
    if (sourceIndex < 0) throw new Error('missing required Nemesis interaction action');
    return applyProjectCommand(project, catalog, {
      kind: 'InsertRoomAction',
      action: createRoomActionAddress(
        goldenFBiome,
        selected.occurrenceId,
        roomActionKey(reference),
      ),
      reference,
      index: sourceIndex + 1,
    });
  }

  function sharedResult(
    branches: readonly NemesisRandomEventBranchAssessment[],
    key:
      | 'freeItemRewardTypes'
      | 'goldTradeRewardTypes'
      | 'damageTradeRewardTypes'
      | 'damageContestSuccessRewardTypes'
      | 'traitTradeTraitKeys',
  ) {
    const first = branches[0]?.[key];
    if (first === undefined) throw new Error(`missing Nemesis candidate domain ${key}`);
    const value = first.find((candidate) =>
      branches.every((branch) => branch[key].includes(candidate)),
    );
    if (value === undefined) throw new Error(`Nemesis branches disagree on ${key}`);
    return value;
  }

  it.each([
    'freeItem',
    'goldTrade',
    'damageTrade',
    'traitTrade',
    'damageContestSuccess',
    'damageContestFailure',
  ] as const)(
    'settles the %s family through the ordinary generated-pickup path',
    (family) => {
      let project = selectEvent();
      const unresolved = simulateProjectAssembly(catalog, project);
      const capability = nemesisRandomEventCandidateSupportForProjectEvaluationAssembly(
        unresolved,
        createNemesisRandomEventAddress(phase),
      );
      if (capability === undefined) throw new Error('missing reached Nemesis candidate support');
      const branches = capability.branches;

      let value: AuthoredNemesisRandomEventOutcome;
      let rewardType: string;
      let optional = false;
      let removedTraitKey: string | undefined;
      switch (family) {
        case 'freeItem':
          value = { kind: 'freeItem' };
          rewardType = sharedResult(branches, 'freeItemRewardTypes');
          optional = true;
          break;
        case 'goldTrade':
          value = { kind: 'goldTrade', response: 'accept' };
          rewardType = sharedResult(branches, 'goldTradeRewardTypes');
          break;
        case 'damageTrade':
          value = { kind: 'damageTrade', response: 'accept' };
          rewardType = sharedResult(branches, 'damageTradeRewardTypes');
          break;
        case 'traitTrade': {
          const traitKey = sharedResult(branches, 'traitTradeTraitKeys');
          value = { kind: 'traitTrade', traitKey, response: 'accept' };
          rewardType = 'RoomMoneyTripleDrop';
          removedTraitKey = traitKey;
          break;
        }
        case 'damageContestSuccess':
          value = { kind: 'damageContest', result: 'success' };
          rewardType = sharedResult(branches, 'damageContestSuccessRewardTypes');
          optional = true;
          break;
        case 'damageContestFailure':
          value = { kind: 'damageContest', result: 'failure' };
          rewardType = capability.damageContestFailureRewardType;
          optional = true;
          break;
      }
      if (rewardType === '') throw new Error(`missing result for ${family}`);
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceNemesisRandomEventOutcome',
        event: createNemesisRandomEventAddress(phase),
        value,
        reward: { rewardType },
      });
      if (optional) project = insertOptionalResult(project);

      const evaluated = simulateProjectAssembly(catalog, project).evaluation;
      expect(evaluated.findings).not.toContainEqual(
        expect.objectContaining({
          code: expect.stringMatching(/^nemesisOutcome(?:Missing|Unavailable)$/),
        }),
      );
      const f = evaluated.routes
        .flatMap((route) => route.biomes)
        .find((biome) => biome.origin.biomeKey === 'F');
      if (f === undefined || !('rewards' in f)) throw new Error('missing evaluated F rewards');
      expect(
        f.rewards.branches.every((branch) =>
          branch.events.some(
            (event) =>
              event.kind === 'concreteAcquisition' &&
              event.acquisition.acquisition.gameName === rewardType &&
              event.settlement?.site.pointKey === 'nemesisGenerated:Encounter' &&
              event.settlement.entry.entryKey === 'result',
          ),
        ),
      ).toBe(true);
      if (removedTraitKey !== undefined) {
        expect(
          f.rewards.branches.every(
            (branch) =>
              branch.traitHistory !== undefined &&
              branch.traitHistory.equippedTraits[removedTraitKey] === undefined &&
              branch.traitHistory.previouslyPickedTraitKeys.includes(removedTraitKey),
          ),
        ).toBe(true);
      }
    },
    15_000,
  );

  it('publishes Nemesis free-item fallbacks at the event address without a Shop action', () => {
    let project = selectEvent();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceNemesisRandomEventOutcome',
      event: createNemesisRandomEventAddress(phase),
      value: { kind: 'freeItem' },
      reward: { rewardType: 'LastStandDrop' },
    });
    project = insertOptionalResult(project);
    const evaluation = simulateProjectAssembly(catalog, project).evaluation;
    const biome = evaluation.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'F');
    if (biome?.authoring !== 'complete') throw new Error('Nemesis F evaluation is incomplete');
    expect(biome.rewards.runtimeOfferFallbacks).toContainEqual(
      expect.objectContaining({
        address: createNemesisRandomEventAddress(phase),
        preferredKey: 'LastStandDrop',
        fallbackKey: 'ArmorBoost',
      }),
    );
    expect(
      biome.rewards.runtimeOfferFallbacks.some((fallback) => fallback.address.kind === 'shopOffer'),
    ).toBe(false);
  });

  it('reuses Time Piece and Sea Star capability while forbidding Artificer on the event result', () => {
    let project = selectEvent();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceNemesisRandomEventOutcome',
      event: createNemesisRandomEventAddress(phase),
      value: { kind: 'freeItem' },
      reward: { rewardType: 'ArmorBoost' },
    });
    const source = createAcquisitionRoleAddress(
      createAcquisitionEntryAddress(
        createAcquisitionSiteAddress(
          createOccurrenceAddress(goldenFBiome, goldenFOccurrenceId(5, 1)),
          'nemesisGenerated:Encounter',
        ),
        'result',
      ),
      'self',
    );
    const timePiece = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition: source,
      value: { kind: 'timePiece' },
    });
    expect(
      occurrence(timePiece).acquisitionSites?.['nemesisGenerated:Encounter']?.pickupEntries?.result
        ?.dispositionByAcquisitionRole.self,
    ).toEqual({ kind: 'timePiece' });
    expect(
      createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, insertOptionalResult(project)),
      ).evaluate({ kind: 'acquisitionConversion', acquisition: source }),
    ).toMatchObject({
      kind: 'acquisitionConversion',
      result: {
        timePieceConvertible: true,
        artificerConvertible: false,
        seaStarSupported: false,
        unsupportedEvidence: expect.arrayContaining([
          expect.objectContaining({ blocksArtificerConversion: true }),
        ]),
      },
    });
    const seaStar = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSeaStarResult',
      acquisition: source,
      procced: true,
    });
    expect(
      Object.keys(occurrence(seaStar).acquisitionSites ?? {}).some((siteKey) =>
        siteKey.startsWith('seaStarDuplicate:'),
      ),
    ).toBe(true);
  });

  it('retains F/G incoming draws while the selected event exposes its exact repair domain', () => {
    let project = createGoldenFGHIProject();
    const before = project.routes[0]?.biomes[0]?.topology?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === goldenFOccurrenceId(5, 1),
    )?.state;
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'NemesisRandomEvent',
    });
    const restored = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'GeneratedF',
    });
    expect(occurrence(restored).state).toEqual(before);
    expect(occurrence(restored).roomActions.order).toContainEqual(
      expect.objectContaining({ kind: 'interactIncomingReward' }),
    );
    const laterPhase = createEncounterPhaseAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(7, 1) },
      'Encounter',
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase: laterPhase,
      encounterKey: 'NemesisRandomEvent',
    });
    const after = project.routes[0]?.biomes[0]?.topology?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === goldenFOccurrenceId(5, 1),
    )?.state;
    expect(after).toEqual(before);
    const selectedOccurrence = project.routes[0]?.biomes[0]?.topology?.occurrences.find(
      (candidate) => candidate.occurrenceId === goldenFOccurrenceId(5, 1),
    );
    if (selectedOccurrence === undefined) throw new Error('missing selected F Nemesis occurrence');
    expect(selectedOccurrence.roomActions.order).not.toContainEqual(
      expect.objectContaining({ kind: 'interactIncomingReward' }),
    );
    expect(
      assembleRoomActionDomain({ catalog, biome: goldenFBiome, occurrence: selectedOccurrence })
        .contributions,
    ).not.toContainEqual(
      expect.objectContaining({
        reference: expect.objectContaining({ kind: 'interactIncomingReward' }),
      }),
    );

    const assembly = simulateProjectAssembly(catalog, project);
    const event = createNemesisRandomEventAddress(phase);
    const capability = nemesisRandomEventCandidateSupportForProjectEvaluationAssembly(
      assembly,
      event,
    );
    expect(capability?.branches.length).toBeGreaterThan(0);
    expect(
      nemesisRandomEventCandidateSupportForProjectEvaluationAssembly(
        assembly,
        createNemesisRandomEventAddress(laterPhase),
      ),
    ).toBeUndefined();
    expect(capability?.familyKeys).toEqual([
      'freeItem',
      'goldTrade',
      'damageTrade',
      'traitTrade',
      'damageContest',
    ]);
    expect(capability?.branches[0]).toMatchObject({
      freeItemRewardTypes: expect.arrayContaining(['EmptyMaxHealthDrop', 'HealDrop']),
    });
    expect(
      capability?.branches.every(
        (branch) =>
          branch.goldTradeRewardTypes.includes('StackUpgrade') &&
          branch.goldTradeRewardTypes.includes('WeaponUpgrade') &&
          branch.damageTradeRewardTypes.includes('StackUpgrade') &&
          !branch.damageTradeRewardTypes.includes('TalentDrop') &&
          !branch.damageContestSuccessRewardTypes.includes('TalentDrop'),
      ),
    ).toBe(true);
    expect(assembly.evaluation.findings).toContainEqual(
      expect.objectContaining({ code: 'nemesisOutcomeMissing', origin: event }),
    );
    const f = assembly.evaluation.routes
      .flatMap((route) => route.biomes)
      .find((biome) => biome.origin.biomeKey === 'F');
    if (f === undefined || !('rewards' in f)) throw new Error('missing evaluated F rewards');
    const incoming = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(5, 1));
    expect(
      f.rewards.branches.some((branch) =>
        branch.events.some(
          (event) => semanticAddressKey(event.origin) === semanticAddressKey(incoming),
        ),
      ),
    ).toBe(false);
  }, 10_000);

  it('blocks an unavailable trait trade at the event before its required child can settle', () => {
    let project = createGoldenFGHIProject();
    const unavailableTrait = catalog.traitGivers.values.find(
      (giver) => giver.providerKind === 'olympian',
    )?.traitKeys[0];
    if (unavailableTrait === undefined) throw new Error('catalog lost Olympian traits');
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'NemesisRandomEvent',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceNemesisRandomEventOutcome',
      event: createNemesisRandomEventAddress(phase),
      value: { kind: 'traitTrade', traitKey: unavailableTrait, response: 'accept' },
      reward: { rewardType: 'RoomMoneyTripleDrop' },
    });
    const evaluation = simulateProjectAssembly(catalog, project).evaluation;
    expect(evaluation.findings).toContainEqual(
      expect.objectContaining({ code: 'nemesisOutcomeUnavailable' }),
    );
    const f = evaluation.routes
      .flatMap((route) => route.biomes)
      .find((biome) => biome.origin.biomeKey === 'F');
    if (f === undefined || !('rewards' in f)) throw new Error('missing evaluated F rewards');
    expect(
      f.rewards.branches.some((branch) =>
        branch.events.some(
          (event) =>
            event.kind === 'concreteAcquisition' &&
            event.acquisition.acquisition.gameName === 'RoomMoneyTripleDrop',
        ),
      ),
    ).toBe(false);
  }, 10_000);

  it('retains a declined trade result without activating its pickup or trait removal', () => {
    let project = createGoldenFGHIProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'NemesisRandomEvent',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceNemesisRandomEventOutcome',
      event: createNemesisRandomEventAddress(phase),
      value: { kind: 'goldTrade', response: 'decline' },
      reward: { rewardType: 'MaxHealthDrop' },
    });
    const occurrence = project.routes[0]?.biomes[0]?.topology?.occurrences.find(
      (candidate) => candidate.occurrenceId === goldenFOccurrenceId(5, 1),
    );
    if (occurrence === undefined) throw new Error('missing declined event occurrence');
    expect(
      assembleRoomActionDomain({ catalog, biome: goldenFBiome, occurrence }).contributions,
    ).not.toContainEqual(
      expect.objectContaining({
        reference: expect.objectContaining({ kind: 'interactAcquisitionEntry' }),
      }),
    );
    expect(simulateProjectAssembly(catalog, project).evaluation.findings).not.toContainEqual(
      expect.objectContaining({ code: 'nemesisOutcomeUnavailable' }),
    );
  }, 10_000);

  it('reserves one H generator position while keeping the event freely ordered among cages', () => {
    const occurrenceId = createOccurrenceId('golden-h-combat05');
    const owner = createOccurrenceAddress(goldenHBiome, occurrenceId);
    const passive = createEncounterPhaseAddress(
      goldenHBiome,
      { kind: 'occurrence', occurrenceId },
      'Passive',
    );
    let project = createGoldenFGHProject();
    const before = project.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'H')
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
    if (before?.state.kind !== 'fieldsCombat') throw new Error('missing H Fields occurrence');
    const retainedOptionals = before.state.optionalRewards;
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFieldsOptionalRewardCount',
      occurrence: owner,
      optionalRewardCount: 4,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase: passive,
      encounterKey: 'NemesisRandomEvent',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceNemesisRandomEventOutcome',
      event: createNemesisRandomEventAddress(passive),
      value: { kind: 'freeItem' },
      reward: { rewardType: 'ArmorBoost' },
    });
    const selected = project.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'H')
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
    if (selected?.state.kind !== 'fieldsCombat') throw new Error('missing selected H occurrence');
    expect(selected.state.optionalRewards).toEqual(retainedOptionals);
    expect(selected.state.optionalRewardCount).toBe(4);
    const eventAction = assembleRoomActionDomain({
      catalog,
      biome: goldenHBiome,
      occurrence: selected,
    }).contributions.find(
      (contribution) =>
        contribution.kind === 'action' &&
        contribution.reference.kind === 'interactEncounter' &&
        contribution.reference.phaseKey === 'Passive',
    );
    expect(eventAction).toMatchObject({
      kind: 'action',
      participation: 'required',
      window: { kind: 'fields', phaseKey: 'Passive' },
      dependencies: [],
    });
    expect(selected.roomActions.order).toContainEqual({
      kind: 'interactEncounter',
      phaseKey: 'Passive',
    });
    const eventReference = { kind: 'interactEncounter' as const, phaseKey: 'Passive' };
    const eventActionAddress = createRoomActionAddress(
      goldenHBiome,
      occurrenceId,
      roomActionKey(eventReference),
    );
    for (const toIndex of [0, selected.roomActions.order.length - 1]) {
      const moved = applyProjectCommand(project, catalog, {
        kind: 'MoveRoomAction',
        action: eventActionAddress,
        toIndex,
      });
      const movedOccurrence = moved.routes
        .find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((biome) => biome.biomeKey === 'H')
        ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
      expect(movedOccurrence?.roomActions.order[toIndex]).toEqual(eventReference);
    }
    const overCapacity = simulateProjectAssembly(catalog, project);
    expect(overCapacity.evaluation.findings).toContainEqual(
      expect.objectContaining({
        code: 'fieldsOptionalCapacityUnavailable',
        origin: createNemesisRandomEventAddress(passive),
      }),
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFieldsOptionalRewardCount',
      occurrence: owner,
      optionalRewardCount: 3,
    });
    expect(simulateProjectAssembly(catalog, project).evaluation.findings).not.toContainEqual(
      expect.objectContaining({ code: 'fieldsOptionalCapacityUnavailable' }),
    );
  }, 15_000);
});
