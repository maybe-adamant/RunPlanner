import {
  applyProjectCommand,
  createBiomeAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createIncomingRewardAddress,
  createLocalChildAddress,
  createLocalChildGroupAddress,
  createLocalRewardAddress,
  createOccurrenceId,
  createProjectDocument,
  createShopOfferAddress,
  createShopPurchaseAddress,
  encodeProjectDocument,
  semanticAddressKey,
  type HubBiomePlan,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  composeNHistory,
  evaluateHubCompleteness,
  evaluateNBiome,
  evaluateNRoomGeneration,
  evaluateNRewards,
  evaluateProjectCandidate,
  evaluateProjectCandidates,
  materializeHubBiome,
  simulateProject,
  type CompleteHubCompletenessResult,
} from '@run-planner/engine/simulation';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { describe, expect, it } from 'vitest';

import { catalog } from './index';

const biome = createBiomeAddress('Surface', 'N');
const fixedOccurrenceIds = {
  opening: createOccurrenceId('n-reward-opening'),
  preHub: createOccurrenceId('n-reward-prehub'),
  preboss: createOccurrenceId('n-reward-preboss'),
};
const openSlotKeys = [
  'combat11',
  'combat10',
  'combat09',
  'combat05',
  'combat03',
  'combat02',
  'combat01',
  'miniBoss01',
  'combat23',
] as const;
const visitSlotKeys = [
  'combat05',
  'miniBoss01',
  'combat02',
  'combat11',
  'combat23',
  'combat09',
] as const;

function plan(project: ProjectDocument): HubBiomePlan {
  const result = project.routes.find((route) => route.routeKey === 'Surface')?.biomes[0];
  if (result?.kind !== 'HubBiome') {
    throw new Error('fixture lost N Hub plan');
  }
  return result;
}

function occurrenceId(slotKey: string) {
  return createOccurrenceId(`n-reward-${slotKey}`);
}

function replaceIncoming(
  project: ProjectDocument,
  slotKey: string,
  value: ResolvedRewardOffer,
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(biome, occurrenceId(slotKey)),
    value,
  });
}

function replaceLocal(
  project: ProjectDocument,
  parentSlotKey: string,
  sideSlotKey: string,
  rewardType: string,
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceLocalReward',
    reward: createLocalRewardAddress(biome, occurrenceId(parentSlotKey), 'sideRooms', sideSlotKey),
    value: { rewardType },
  });
}

function configureSideRooms(project: ProjectDocument): ProjectDocument {
  let configured = project;
  const generatedByParent = {
    combat05: ['sideDoor1', 'sideDoor2', 'sideDoor3'],
    combat02: ['sideDoor1', 'sideDoor2'],
    combat11: ['sideDoor1'],
  } as const;
  for (const [parentSlotKey, sideSlotKeys] of Object.entries(generatedByParent)) {
    for (const sideSlotKey of sideSlotKeys) {
      configured = applyProjectCommand(configured, catalog, {
        kind: 'ReplaceSideRoomGeneration',
        sideRoom: createLocalChildAddress(
          biome,
          occurrenceId(parentSlotKey),
          'sideRooms',
          sideSlotKey,
        ),
        generation: 'generated',
      });
    }
  }
  for (const [parentSlotKey, enteredSlotKeys] of [
    ['combat05', ['sideDoor2', 'sideDoor1']],
    ['combat02', ['sideDoor1']],
    ['combat11', ['sideDoor1']],
  ] as const) {
    configured = applyProjectCommand(configured, catalog, {
      kind: 'ReplaceSideRoomEntryOrder',
      group: createLocalChildGroupAddress(biome, occurrenceId(parentSlotKey), 'sideRooms'),
      enteredSlotKeys,
    });
  }
  configured = replaceLocal(configured, 'combat05', 'sideDoor1', 'MaxManaDropSmall');
  configured = replaceLocal(configured, 'combat05', 'sideDoor2', 'MaxHealthDropSmall');
  configured = replaceLocal(configured, 'combat05', 'sideDoor3', 'EmptyMaxHealthSmallDrop');
  configured = replaceLocal(configured, 'combat02', 'sideDoor1', 'RoomMoneyTinyDrop');
  configured = replaceLocal(configured, 'combat02', 'sideDoor2', 'AirBoost');
  return replaceLocal(configured, 'combat11', 'sideDoor1', 'EarthBoost');
}

function representativeProject(shopHammerIsReplaced = true): ProjectDocument {
  let project = applyProjectCommand(
    createProjectDocument(catalog, {
      projectId: 'n-rewards',
      name: 'N Rewards',
      configuredBiomeCounts: { Surface: 1 },
    }),
    catalog,
    { kind: 'CreateHubTopology', biome, fixedOccurrenceIds },
  );
  for (const hubSlotKey of openSlotKeys) {
    project = applyProjectCommand(project, catalog, {
      kind: 'OpenHubSlot',
      slot: createHubSlotAddress(biome, hubSlotKey),
      occurrenceId: occurrenceId(hubSlotKey),
    });
  }
  for (const [index, hubSlotKey] of visitSlotKeys.entries()) {
    project = applyProjectCommand(project, catalog, {
      kind: 'AppendHubVisit',
      visit: createHubVisitAddress(biome, index + 1),
      hubSlotKey,
    });
  }

  const offers: Readonly<Record<string, ResolvedRewardOffer>> = {
    combat01: { rewardType: 'MaxHealthDropBig' },
    combat02: { rewardType: 'MaxManaDropBig' },
    combat03: { rewardType: 'WeaponUpgrade' },
    combat05: { rewardType: 'HermesUpgrade' },
    combat09: { rewardType: 'SpellDrop' },
    combat10: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'AphroditeUpgrade' },
    },
    combat11: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'AresUpgrade' },
    },
    combat23: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
    },
    miniBoss01: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'HephaestusUpgrade' },
    },
  };
  for (const [slotKey, offer] of Object.entries(offers)) {
    project = replaceIncoming(project, slotKey, offer);
  }
  project = configureSideRooms(project);
  if (shopHammerIsReplaced) {
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceShopOffer',
      offer: createShopOfferAddress(biome, fixedOccurrenceIds.preboss, 'MajorNonBoon'),
      value: { rewardType: 'MaxHealthDrop' },
    });
  }
  return project;
}

function tenTargetProject(): ProjectDocument {
  let project = applyProjectCommand(representativeProject(), catalog, {
    kind: 'OpenHubSlot',
    slot: createHubSlotAddress(biome, 'combat12'),
    occurrenceId: occurrenceId('combat12'),
  });
  project = replaceIncoming(project, 'combat12', {
    rewardType: 'Boon',
    payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' },
  });
  return replaceIncoming(project, 'miniBoss01', {
    rewardType: 'Boon',
    payload: { kind: 'BoonSource', source: 'AphroditeUpgrade' },
  });
}

function storyProject(visited: boolean): ProjectDocument {
  let project = applyProjectCommand(representativeProject(), catalog, {
    kind: 'CloseHubSlot',
    slot: createHubSlotAddress(biome, 'combat03'),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'OpenHubSlot',
    slot: createHubSlotAddress(biome, 'story'),
    occurrenceId: occurrenceId('story'),
  });
  return visited
    ? applyProjectCommand(project, catalog, {
        kind: 'ReplaceHubVisit',
        visit: createHubVisitAddress(biome, 6),
        hubSlotKey: 'story',
      })
    : project;
}

function complete(project: ProjectDocument): CompleteHubCompletenessResult {
  const result = evaluateHubCompleteness(catalog, biome, plan(project));
  if (result.completion !== 'complete') {
    throw new Error(`fixture is incomplete: ${result.findings.map((finding) => finding.code)}`);
  }
  return result;
}

function fixture(project = representativeProject()) {
  const snapshot = materializeHubBiome(catalog, biome, complete(project));
  const history = composeNHistory(catalog, snapshot);
  return { snapshot, history, rewards: evaluateNRewards(catalog, snapshot, history) };
}

function selected(project = representativeProject()) {
  return evaluateNBiome(catalog, 'Surface', plan(project));
}

describe('N Hub reward simulation', () => {
  it('consumes the full physical Hub board while acquiring only six visited targets', () => {
    const { snapshot, rewards } = fixture();
    expect(rewards.validity).toBe('valid');
    expect(rewards.findings).toEqual([]);
    expect(rewards.branches.length).toBeGreaterThan(0);

    const branch = rewards.branches[0]!;
    const boardOrigins = snapshot.hubBoard.targets.map((target) =>
      semanticAddressKey(target.room.incomingReward!.origin),
    );
    const boardOffers = branch.events.filter(
      (event) =>
        event.kind === 'rewardOffered' && boardOrigins.includes(semanticAddressKey(event.origin)),
    );
    expect(boardOffers.map((event) => semanticAddressKey(event.origin))).toEqual(boardOrigins);
    expect(boardOffers).toHaveLength(9);

    const boardAcquisitions = branch.events.filter(
      (event) =>
        event.kind === 'concreteAcquisition' &&
        boardOrigins.includes(semanticAddressKey(event.origin)),
    );
    expect(boardAcquisitions).toHaveLength(6);
    const unvisitedHammer = snapshot.hubBoard.targets.find(
      (target) => target.hubSlotKey === 'combat03',
    )!;
    const hammerOrigin = semanticAddressKey(unvisitedHammer.room.incomingReward!.origin);
    expect(boardOffers.some((event) => semanticAddressKey(event.origin) === hammerOrigin)).toBe(
      true,
    );
    expect(
      boardAcquisitions.some((event) => semanticAddressKey(event.origin) === hammerOrigin),
    ).toBe(false);
    expect(
      branch.bags.HubRewards?.remainingEntryCounts.reduce((total, count) => total + count, 0),
    ).toBe(2);
  });

  it('allows the fifth Hub Boon to repeat a peer source in the ten-target outcome', () => {
    const { snapshot, rewards } = fixture(tenTargetProject());
    const boardOrigins = new Set(
      snapshot.hubBoard.targets.map((target) =>
        semanticAddressKey(target.room.incomingReward!.origin),
      ),
    );

    expect(snapshot.hubBoard.targets).toHaveLength(10);
    expect(rewards.validity).toBe('valid');
    expect(
      snapshot.hubBoard.targets
        .map((target) => target.room.incomingReward?.offer)
        .filter(
          (offer) =>
            offer?.rewardType === 'Boon' &&
            offer.payload?.kind === 'BoonSource' &&
            offer.payload.source === 'AphroditeUpgrade',
        ),
    ).toHaveLength(2);
    expect(
      rewards.branches[0]?.events.filter(
        (event) =>
          event.kind === 'rewardOffered' && boardOrigins.has(semanticAddressKey(event.origin)),
      ),
    ).toHaveLength(10);
  });

  it('offers the fixed Story slot without consuming a counted bag or concrete loot', () => {
    const unvisited = fixture(storyProject(false));
    const storyTarget = unvisited.snapshot.hubBoard.targets.find(
      (target) => target.hubSlotKey === 'story',
    );
    if (storyTarget?.room.incomingReward === undefined) {
      throw new Error('fixture lost N_Story01 reward');
    }
    const storyOrigin = semanticAddressKey(storyTarget.room.incomingReward.origin);
    const branch = unvisited.rewards.branches[0]!;

    expect(storyTarget.room).toMatchObject({
      gameName: 'N_Story01',
      entered: false,
      lifecycleProfileKey: 'EphyraMainRoom',
      incomingReward: {
        producerKind: 'fixed',
        offer: { rewardType: 'Story' },
      },
    });
    expect(unvisited.rewards.rewardLookups.hubRewardLookup).toContain('Story');
    expect(
      branch.events.filter(
        (event) =>
          event.kind === 'rewardOffered' && semanticAddressKey(event.origin) === storyOrigin,
      ),
    ).toHaveLength(1);
    expect(
      branch.events.filter(
        (event) =>
          event.kind === 'concreteAcquisition' && semanticAddressKey(event.origin) === storyOrigin,
      ),
    ).toHaveLength(0);
    expect(
      branch.bags.HubRewards?.remainingEntryCounts.reduce((total, count) => total + count, 0),
    ).toBe(3);

    const visited = fixture(storyProject(true));
    const visitedStory = visited.snapshot.visits[5]?.target.room;
    expect(visitedStory?.gameName).toBe('N_Story01');
    expect(visited.history.ledgers.encounterStarts).toContainEqual(
      expect.objectContaining({
        gameName: 'N_Story01',
        phaseKind: 'story',
        baselineEncounterKey: 'Story_Medea_01',
      }),
    );
    expect(visited.history.ledgers.requiredObjectSpawns).toHaveLength(6);
    expect(visited.history.ledgers.requiredObjectCompletions).toHaveLength(6);
    expect(visited.history.biomeCompletion.ledgers.counters.biomeEncounterDepth).toBe(7);
    expect(
      visited.rewards.branches[0]?.events.filter(
        (event) =>
          event.kind === 'concreteAcquisition' &&
          visitedStory?.incomingReward !== undefined &&
          semanticAddressKey(event.origin) ===
            semanticAddressKey(visitedStory.incomingReward.origin),
      ),
    ).toHaveLength(0);
  });

  it('jointly consumes all generated side siblings but acquires only entered side rooms', () => {
    const { snapshot, rewards } = fixture();
    const branch = rewards.branches[0]!;
    const generated = snapshot.visits.flatMap((visit) =>
      visit.localSlots.filter((room) => room.generation === 'generated'),
    );
    const entered = snapshot.visits.flatMap((visit) => visit.enteredLocalRooms);
    const generatedOrigins = generated.map((room) =>
      semanticAddressKey(room.incomingReward!.origin),
    );
    const enteredOrigins = entered.map((room) => semanticAddressKey(room.incomingReward!.origin));

    expect(
      branch.events.filter(
        (event) =>
          event.kind === 'rewardOffered' &&
          generatedOrigins.includes(semanticAddressKey(event.origin)),
      ),
    ).toHaveLength(6);
    expect(
      branch.events
        .filter(
          (event) =>
            event.kind === 'concreteAcquisition' &&
            generatedOrigins.includes(semanticAddressKey(event.origin)),
        )
        .map((event) => semanticAddressKey(event.origin)),
    ).toEqual(enteredOrigins);
  });

  it('applies peer exclusion across one generated side-room sibling batch', () => {
    let project = representativeProject();
    project = replaceLocal(project, 'combat05', 'sideDoor1', 'AirBoost');
    project = replaceLocal(project, 'combat05', 'sideDoor2', 'AirBoost');

    const { rewards } = fixture(project);
    expect(rewards.validity).toBe('invalid');
    expect(rewards.findings).toContainEqual(
      expect.objectContaining({ code: 'rewardBagEntryUnavailable' }),
    );
  });

  it('derives the Preboss lookup from every open offer, including unvisited rooms', () => {
    const valid = fixture();
    expect(valid.rewards.rewardLookups.hubRewardLookup).toEqual([
      'MaxHealthDropBig',
      'MaxManaDropBig',
      'WeaponUpgrade',
      'HermesUpgrade',
      'SpellDrop',
      'Boon',
    ]);
    expect(Object.isFrozen(valid.rewards.rewardLookups.hubRewardLookup)).toBe(true);

    const invalid = fixture(representativeProject(false));
    expect(invalid.rewards.validity).toBe('invalid');
    expect(invalid.rewards.findings).toContainEqual(
      expect.objectContaining({
        code: 'shopOfferUnavailable',
        origin: createShopOfferAddress(biome, fixedOccurrenceIds.preboss, 'MajorNonBoon'),
      }),
    );
  });

  it('applies fixed Preboss purchases after lookup-aware inventory validation', () => {
    const project = applyProjectCommand(representativeProject(), catalog, {
      kind: 'SetShopPurchase',
      purchase: createShopPurchaseAddress(biome, fixedOccurrenceIds.preboss, 'Minor'),
      purchased: true,
    });
    const { rewards } = fixture(project);
    const branch = rewards.branches[0]!;

    expect(rewards.validity).toBe('valid');
    expect(branch.events).toContainEqual(
      expect.objectContaining({
        kind: 'concreteAcquisition',
        origin: createShopPurchaseAddress(biome, fixedOccurrenceIds.preboss, 'Minor'),
      }),
    );
    expect(branch.events).toContainEqual(
      expect.objectContaining({
        kind: 'shopPurchasesSupported',
        purchaseOrder: ['Minor'],
      }),
    );
  });

  it('is deterministic, deeply frozen, and does not mutate authored or canonical input', () => {
    const project = representativeProject();
    const encodedBefore = encodeProjectDocument(project);
    const snapshot = materializeHubBiome(catalog, biome, complete(project));
    const canonicalBefore = JSON.stringify(snapshot);
    const history = composeNHistory(catalog, snapshot);

    const first = evaluateNRewards(catalog, snapshot, history);
    const second = evaluateNRewards(catalog, snapshot, history);

    expect(second).toEqual(first);
    expect(encodeProjectDocument(project)).toBe(encodedBefore);
    expect(JSON.stringify(snapshot)).toBe(canonicalBefore);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.branches)).toBe(true);
    expect(Object.isFrozen(first.branches[0]?.events)).toBe(true);
    expect(Object.isFrozen(first.rewardLookups)).toBe(true);
  });
});

describe('selected N validation', () => {
  it('closes the complete fixed board, visit, side-pressure, pylon, restore, and terminal trace', () => {
    const result = selected();

    expect(result).toMatchObject({ biomeKey: 'N', completion: 'complete', validity: 'valid' });
    if (result.completion !== 'complete') {
      throw new Error('selected N fixture is incomplete');
    }
    expect(result.findings).toEqual([]);
    expect(result.roomGeneration.openSlotConstraints).toEqual([
      expect.objectContaining({
        constrainedSlotKeys: ['miniBoss01', 'miniBoss02'],
        openSlotKeys: ['miniBoss01'],
        maximumOpenCount: 1,
        selectedPossible: true,
      }),
    ]);
    expect(result.roomGeneration.sideRoomGenerations.slice(0, 3)).toEqual([
      expect.objectContaining({
        visitIndex: 1,
        availabilityRank: 1,
        generatedBefore: 0,
        requiredGeneratedCount: 1,
        supportOutcomes: ['generated'],
        selectedPossible: true,
      }),
      expect.objectContaining({
        visitIndex: 1,
        availabilityRank: 2,
        generatedBefore: 1,
        supportOutcomes: ['generated', 'notGenerated'],
      }),
      expect.objectContaining({
        visitIndex: 1,
        availabilityRank: 3,
        generatedBefore: 2,
        supportOutcomes: ['generated', 'notGenerated'],
      }),
    ]);
    expect(result.history.biomeCompletion.ledgers.counters).toMatchObject({
      soulPylonsSpawned: 6,
      soulPylonsCompleted: 6,
      numSubRoomsSpawned: 6,
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.roomGeneration.sideRoomGenerations)).toBe(true);
  });

  it('retains both coin-disabled miniboss slots and addresses the selected constraint failure', () => {
    let project = applyProjectCommand(representativeProject(), catalog, {
      kind: 'OpenHubSlot',
      slot: createHubSlotAddress(biome, 'miniBoss02'),
      occurrenceId: occurrenceId('miniBoss02'),
    });
    project = replaceIncoming(project, 'miniBoss02', {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
    });

    const result = selected(project);
    expect(result).toMatchObject({ completion: 'complete', validity: 'invalid' });
    if (result.completion !== 'complete') {
      throw new Error('miniboss constraint fixture is incomplete');
    }
    expect(result.roomGeneration.openSlotConstraints[0]).toMatchObject({
      openSlotKeys: ['miniBoss01', 'miniBoss02'],
      selectedPossible: false,
    });
    expect(
      result.roomGeneration.findings
        .filter((finding) => finding.code === 'hubOpenSlotUnavailable')
        .map((finding) => semanticAddressKey(finding.origin)),
    ).toEqual([
      semanticAddressKey(createHubSlotAddress(biome, 'miniBoss01')),
      semanticAddressKey(createHubSlotAddress(biome, 'miniBoss02')),
    ]);
  });

  it('retains a skipped forced side slot and addresses the exact parent-local owner', () => {
    let project = applyProjectCommand(representativeProject(), catalog, {
      kind: 'ReplaceSideRoomEntryOrder',
      group: createLocalChildGroupAddress(biome, occurrenceId('combat05'), 'sideRooms'),
      enteredSlotKeys: ['sideDoor2'],
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSideRoomGeneration',
      sideRoom: createLocalChildAddress(biome, occurrenceId('combat05'), 'sideRooms', 'sideDoor1'),
      generation: 'notGenerated',
    });

    const result = selected(project);
    expect(result).toMatchObject({ completion: 'complete', validity: 'invalid' });
    if (result.completion !== 'complete') {
      throw new Error('side pressure fixture is incomplete');
    }
    expect(result.roomGeneration.findings).toContainEqual(
      expect.objectContaining({
        code: 'sideRoomGenerationUnavailable',
        origin: createLocalChildAddress(biome, occurrenceId('combat05'), 'sideRooms', 'sideDoor1'),
        evidence: expect.objectContaining({
          visitIndex: 1,
          availabilityRank: 1,
          generatedBefore: 0,
          requiredGeneratedCount: 1,
          selectedOutcome: 'notGenerated',
          supportOutcomes: ['generated'],
        }),
      }),
    );
  });

  it('carries global pressure into the availability-ranked prefix of a later visit', () => {
    let project = applyProjectCommand(representativeProject(), catalog, {
      kind: 'ReplaceHubVisit',
      visit: createHubVisitAddress(biome, 1),
      hubSlotKey: 'combat01',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSideRoomEntryOrder',
      group: createLocalChildGroupAddress(biome, occurrenceId('combat02'), 'sideRooms'),
      enteredSlotKeys: [],
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSideRoomGeneration',
      sideRoom: createLocalChildAddress(biome, occurrenceId('combat02'), 'sideRooms', 'sideDoor1'),
      generation: 'notGenerated',
    });

    const result = selected(project);
    if (result.completion !== 'complete') {
      throw new Error('later pressure fixture is incomplete');
    }
    expect(result.roomGeneration.findings).toContainEqual(
      expect.objectContaining({
        code: 'sideRoomGenerationUnavailable',
        origin: createLocalChildAddress(biome, occurrenceId('combat02'), 'sideRooms', 'sideDoor1'),
        evidence: expect.objectContaining({
          visitIndex: 3,
          availabilityRank: 2,
          generatedBefore: 1,
          requiredGeneratedCount: 2,
          supportOutcomes: ['generated'],
        }),
      }),
    );
  });

  it('combines lookup-aware Preboss findings without moving their semantic owner', () => {
    const result = selected(representativeProject(false));
    expect(result).toMatchObject({ completion: 'complete', validity: 'invalid' });
    if (result.completion !== 'complete') {
      throw new Error('shop validation fixture is incomplete');
    }
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        code: 'shopOfferUnavailable',
        origin: createShopOfferAddress(biome, fixedOccurrenceIds.preboss, 'MajorNonBoon'),
      }),
    );
  });

  it('keeps incomplete state selected and dispatches complete N through project simulation', () => {
    const incomplete = createProjectDocument(catalog, {
      projectId: 'incomplete-n-validation',
      name: 'Incomplete N Validation',
      configuredBiomeCounts: { Surface: 1 },
    });
    expect(evaluateNBiome(catalog, 'Surface', plan(incomplete))).toMatchObject({
      completion: 'incomplete',
      biomeKey: 'N',
    });

    const project = representativeProject();
    const surface = simulateProject(catalog, project).routes.find(
      (route) => route.routeKey === 'Surface',
    );
    expect(surface).toMatchObject({
      status: 'valid',
      biomes: [{ biomeKey: 'N', completion: 'complete', validity: 'valid' }],
      validatedPrefix: ['N'],
      horizon: { kind: 'routeEnd' },
    });
  });

  it('rejects a canonical history that loses one required Pylon completion', () => {
    const { snapshot, history } = fixture();
    const malformed = {
      ...history,
      ledgers: {
        ...history.ledgers,
        requiredObjectCompletions: history.ledgers.requiredObjectCompletions.slice(1),
      },
    };

    expect(() => evaluateNRoomGeneration(catalog, snapshot, malformed)).toThrow(/pylon/i);
  });
});

describe('N candidate evaluation', () => {
  it('evaluates Hub membership, visits, side state, and every reward surface through activation', () => {
    const project = representativeProject();
    const before = encodeProjectDocument(project);
    const opening = plan(project).topology?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === fixedOccurrenceIds.opening,
    );
    if (opening?.state.kind !== 'counted') {
      throw new Error('N opening candidate fixture has no counted reward');
    }

    const [
      conflictingMiniboss,
      validTenthSlot,
      requiredOpenSlot,
      alternateVisit,
      duplicateVisit,
      forcedSideGeneration,
      blockedEnteredSide,
      optionalSideGeneration,
      sideEntryOrder,
      fixedEntryReward,
      hubReward,
      sideReward,
      shopOffer,
      shopPurchase,
    ] = evaluateProjectCandidates(catalog, project, [
      {
        kind: 'hubSlot',
        slot: createHubSlotAddress(biome, 'miniBoss02'),
        open: true,
        occurrenceId: occurrenceId('candidate-miniBoss02'),
      },
      {
        kind: 'hubSlot',
        slot: createHubSlotAddress(biome, 'combat12'),
        open: true,
        occurrenceId: occurrenceId('candidate-combat12'),
      },
      {
        kind: 'hubSlot',
        slot: createHubSlotAddress(biome, 'combat10'),
        open: false,
        occurrenceId: occurrenceId('combat10'),
      },
      {
        kind: 'hubVisit',
        visit: createHubVisitAddress(biome, 1),
        hubSlotKey: 'combat01',
      },
      {
        kind: 'hubVisit',
        visit: createHubVisitAddress(biome, 1),
        hubSlotKey: 'miniBoss01',
      },
      {
        kind: 'sideRoomGeneration',
        sideRoom: createLocalChildAddress(
          biome,
          occurrenceId('combat05'),
          'sideRooms',
          'sideDoor1',
        ),
        generation: 'generated',
      },
      {
        kind: 'sideRoomGeneration',
        sideRoom: createLocalChildAddress(
          biome,
          occurrenceId('combat05'),
          'sideRooms',
          'sideDoor1',
        ),
        generation: 'notGenerated',
      },
      {
        kind: 'sideRoomGeneration',
        sideRoom: createLocalChildAddress(
          biome,
          occurrenceId('combat05'),
          'sideRooms',
          'sideDoor3',
        ),
        generation: 'notGenerated',
      },
      {
        kind: 'sideRoomEntryOrder',
        group: createLocalChildGroupAddress(biome, occurrenceId('combat05'), 'sideRooms'),
        enteredSlotKeys: ['sideDoor1', 'sideDoor2'],
      },
      {
        kind: 'incomingReward',
        reward: createIncomingRewardAddress(biome, fixedOccurrenceIds.opening),
        value: opening.state.offer,
      },
      {
        kind: 'incomingReward',
        reward: createIncomingRewardAddress(biome, occurrenceId('miniBoss01')),
        value: {
          rewardType: 'Boon',
          payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
        },
      },
      {
        kind: 'localReward',
        reward: createLocalRewardAddress(biome, occurrenceId('combat05'), 'sideRooms', 'sideDoor2'),
        value: { rewardType: 'MaxManaDropSmall' },
      },
      {
        kind: 'shopOffer',
        offer: createShopOfferAddress(biome, fixedOccurrenceIds.preboss, 'MajorNonBoon'),
        value: { rewardType: 'WeaponUpgradeDrop' },
      },
      {
        kind: 'shopPurchase',
        purchase: createShopPurchaseAddress(biome, fixedOccurrenceIds.preboss, 'MajorNonBoon'),
        purchased: true,
      },
    ]);

    expect(conflictingMiniboss).toMatchObject({
      context: 'evaluated',
      support: 'impossible',
      findings: [{ code: 'hubOpenSlotUnavailable' }],
    });
    expect(validTenthSlot).toMatchObject({ context: 'evaluated', support: 'possible' });
    expect(requiredOpenSlot).toMatchObject({
      context: 'evaluated',
      support: 'impossible',
      findings: [{ code: 'hubOpenSetIncomplete' }],
    });
    expect(alternateVisit).toMatchObject({ context: 'evaluated', support: 'possible' });
    expect(duplicateVisit).toMatchObject({ context: 'evaluated', support: 'impossible' });
    expect(forcedSideGeneration).toMatchObject({
      context: 'evaluated',
      support: 'forced',
      evidence: { supportOutcomes: ['generated'] },
    });
    expect(blockedEnteredSide).toMatchObject({
      context: 'evaluated',
      support: 'impossible',
      evidence: { enteredOrdinal: 2 },
    });
    expect(optionalSideGeneration).toMatchObject({
      context: 'evaluated',
      support: 'possible',
      evidence: { supportOutcomes: ['generated', 'notGenerated'] },
    });
    expect(sideEntryOrder).toMatchObject({ context: 'evaluated', support: 'possible' });
    expect(fixedEntryReward).toMatchObject({ context: 'evaluated', support: 'possible' });
    expect(hubReward).toMatchObject({ context: 'evaluated', support: 'possible' });
    expect(sideReward).toMatchObject({
      context: 'evaluated',
      support: 'impossible',
      findings: [{ code: 'rewardBagEntryUnavailable' }],
    });
    expect(shopOffer).toMatchObject({
      context: 'evaluated',
      support: 'impossible',
      findings: [{ code: 'shopOfferUnavailable' }],
    });
    expect(shopPurchase).toMatchObject({ context: 'evaluated', support: 'possible' });
    expect(encodeProjectDocument(project)).toBe(before);
    expect(Object.isFrozen(conflictingMiniboss)).toBe(true);
    expect(Object.isFrozen(sideEntryOrder?.query)).toBe(true);
  }, 15_000);

  it('preserves selected-invalid support and reports incomplete Hub context explicitly', () => {
    let invalid = applyProjectCommand(representativeProject(), catalog, {
      kind: 'OpenHubSlot',
      slot: createHubSlotAddress(biome, 'miniBoss02'),
      occurrenceId: occurrenceId('miniBoss02'),
    });
    invalid = replaceIncoming(invalid, 'miniBoss02', {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
    });
    expect(
      evaluateProjectCandidate(catalog, invalid, {
        kind: 'hubSlot',
        slot: createHubSlotAddress(biome, 'miniBoss02'),
        open: true,
        occurrenceId: occurrenceId('miniBoss02'),
      }),
    ).toMatchObject({
      context: 'evaluated',
      support: 'impossible',
      evidence: { candidateOpen: true, currentlyOpen: true },
    });

    const incomplete = createProjectDocument(catalog, {
      projectId: 'incomplete-n-candidates',
      name: 'Incomplete N Candidates',
      configuredBiomeCounts: { Surface: 1 },
    });
    expect(
      evaluateProjectCandidate(catalog, incomplete, {
        kind: 'hubSlot',
        slot: createHubSlotAddress(biome, 'combat01'),
        open: true,
        occurrenceId: occurrenceId('incomplete-candidate'),
      }),
    ).toMatchObject({ context: 'unavailable', reason: 'biomeIncomplete' });
    expect(simulateProject(catalog, representativeProject()).routes[1]).toMatchObject({
      status: 'valid',
      biomes: [{ biomeKey: 'N', completion: 'complete', validity: 'valid' }],
      validatedPrefix: ['N'],
      horizon: { kind: 'routeEnd' },
    });
  });

  it('does not evaluate N candidates outside the caller simulation scope', () => {
    expect(
      evaluateProjectCandidate(
        catalog,
        representativeProject(),
        {
          kind: 'hubSlot',
          slot: createHubSlotAddress(biome, 'combat01'),
          open: true,
          occurrenceId: occurrenceId('combat01'),
        },
        { simulatableBiomeKeys: [] },
      ),
    ).toMatchObject({ context: 'unavailable', reason: 'simulatorUnavailable' });
  });

  it('rejects malformed Hub candidate domains at their semantic contact', () => {
    const project = representativeProject();
    expect(() =>
      evaluateProjectCandidate(catalog, project, {
        kind: 'hubSlot',
        slot: createHubSlotAddress(biome, 'missing'),
        open: true,
        occurrenceId: occurrenceId('missing-candidate'),
      }),
    ).toThrow(/unknown Hub slot missing/);
    expect(() =>
      evaluateProjectCandidate(catalog, project, {
        kind: 'sideRoomEntryOrder',
        group: createLocalChildGroupAddress(biome, occurrenceId('combat05'), 'sideRooms'),
        enteredSlotKeys: ['sideDoor1', 'sideDoor1'],
      }),
    ).toThrow(/candidate proposal is malformed.*distinct slots/);
  });
});
