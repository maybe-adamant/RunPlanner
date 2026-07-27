import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createExitDecisionAddress,
  createHubVisitAddress,
  createHubSlotAddress,
  createIncomingRewardAddress,
  createLocalChildAddress,
  createLocalChildGroupAddress,
  createLocalRewardAddress,
  createProjectDocument,
  createShopOfferAddress,
  createShopPurchaseAddress,
  encodeProjectDocument,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  simulateProject,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  appendCompleteN,
  createRepresentativeNProject,
  nBiome,
  nOccurrenceId,
  nOccurrenceIds,
} from '../../support/surface-valid-project';

function completeN(project = createRepresentativeNProject()) {
  const evaluation = simulateProject(catalog, project);
  const biome = evaluation.routes
    .find((route) => route.routeKey === 'Surface')
    ?.biomes.find((candidate) => candidate.biomeKey === 'N');
  if (biome?.authoring !== 'complete') throw new Error('N fixture did not complete');
  return { project, evaluation, biome };
}

describe('N Hub rewards, validation, and candidates', () => {
  it('consumes the physical board while acquiring only the six visited target rewards', () => {
    const { biome } = completeN();
    const hub = biome.snapshot.decisions.find((decision) => decision.kind === 'hub');
    if (hub?.kind !== 'hub') throw new Error('fixture lost Hub decision');
    const boardOrigins = new Set(
      hub.board.targets.map((target) => semanticAddressKey(target.room.incomingReward!.origin)),
    );
    const offered = biome.rewards.branches.flatMap((branch) =>
      branch.events.filter((event) => event.kind === 'rewardOffered'),
    );
    const acquired = biome.rewards.branches.flatMap((branch) =>
      branch.events.filter((event) => event.kind === 'concreteAcquisition'),
    );

    expect(biome.rewards.validity).toBe('valid');
    const offeredOrigins = new Set(offered.map((event) => semanticAddressKey(event.origin)));
    expect([...boardOrigins].every((origin) => offeredOrigins.has(origin))).toBe(true);
    expect(
      offered.filter((event) => boardOrigins.has(semanticAddressKey(event.origin))),
    ).toHaveLength(9);
    expect(
      acquired
        .filter((event) => boardOrigins.has(semanticAddressKey(event.origin)))
        .map((event) => event.origin),
    ).toHaveLength(6);
    expect(
      hub.visits.map((visit) => semanticAddressKey(visit.target.room.incomingReward!.origin)),
    ).toEqual(
      expect.arrayContaining(
        acquired
          .filter((event) => boardOrigins.has(semanticAddressKey(event.origin)))
          .map((event) => semanticAddressKey(event.origin)),
      ),
    );
    const unvisitedHammer = hub.board.targets.find((target) => target.hubSlotKey === 'combat03');
    if (unvisitedHammer?.room.incomingReward === undefined) {
      throw new Error('fixture lost the unvisited N hammer reward');
    }
    expect(
      acquired.some(
        (event) =>
          semanticAddressKey(event.origin) ===
          semanticAddressKey(unvisitedHammer.room.incomingReward!.origin),
      ),
    ).toBe(false);
    expect(
      biome.rewards.branches[0]?.bags.HubRewards?.remainingEntryCounts.reduce(
        (total, count) => total + count,
        0,
      ),
    ).toBe(2);
  });

  it('rejects an authored open set that violates the explicit miniboss constraint', () => {
    expect(() =>
      applyProjectCommand(createRepresentativeNProject(), catalog, {
        kind: 'OpenHubSlot',
        slot: createHubSlotAddress(nBiome, 'hub', 'miniBoss02'),
        occurrenceId: nOccurrenceId('miniBoss02'),
      }),
    ).toThrow(/Hub open-slot constraint excludes miniBoss02/);
  });

  it('keeps unavailable side generation and its local reward owner precise', () => {
    let project = createRepresentativeNProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSideRoomEntryOrder',
      group: createLocalChildGroupAddress(nBiome, nOccurrenceId('combat05'), 'sideRooms'),
      enteredSlotKeys: ['sideDoor2'],
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSideRoomGeneration',
      sideRoom: createLocalChildAddress(
        nBiome,
        nOccurrenceId('combat05'),
        'sideRooms',
        'sideDoor1',
      ),
      generation: 'notGenerated',
    });
    const { biome } = completeN(project);

    expect(biome.validity).toBe('invalid');
    expect(biome.findings).toContainEqual(
      expect.objectContaining({
        code: 'sideRoomGenerationUnavailable',
        origin: createLocalChildAddress(
          nBiome,
          nOccurrenceId('combat05'),
          'sideRooms',
          'sideDoor1',
        ),
      }),
    );
  });

  it('keeps the blocked side-generation owner assessable for repair', () => {
    let project = createRepresentativeNProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSideRoomEntryOrder',
      group: createLocalChildGroupAddress(nBiome, nOccurrenceId('combat05'), 'sideRooms'),
      enteredSlotKeys: ['sideDoor2'],
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSideRoomGeneration',
      sideRoom: createLocalChildAddress(
        nBiome,
        nOccurrenceId('combat05'),
        'sideRooms',
        'sideDoor1',
      ),
      generation: 'notGenerated',
    });
    const evaluation = simulateProject(catalog, project);

    expect(
      createPreparedProjectCandidateSession(catalog, project, evaluation).evaluate({
        kind: 'sideRoomGeneration',
        sideRoom: createLocalChildAddress(
          nBiome,
          nOccurrenceId('combat05'),
          'sideRooms',
          'sideDoor1',
        ),
        generation: 'notGenerated',
      }),
    ).toMatchObject({
      kind: 'sideRoomGeneration',
      result: { selectedPossible: false, supportOutcomes: ['generated'] },
    });
  });

  it('keeps invalid board rewards attached to their incoming-reward owner', () => {
    const project = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat10')),
      value: { rewardType: 'WeaponUpgrade' },
    });
    const { biome } = completeN(project);

    expect(biome.validity).toBe('invalid');
    expect(biome.findings).toContainEqual(
      expect.objectContaining({
        code: 'rewardBagEntryUnavailable',
        origin: createIncomingRewardAddress(nBiome, nOccurrenceId('combat10')),
      }),
    );
  });

  it('retains the invalid board region but withholds later Hub candidates', () => {
    const project = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat10')),
      value: { rewardType: 'WeaponUpgrade' },
    });
    const candidates = createPreparedProjectCandidateSession(
      catalog,
      project,
      simulateProject(catalog, project),
    );

    expect(
      candidates.evaluate({
        kind: 'hubVisit',
        visit: createHubVisitAddress(nBiome, 'hub', 6),
        hubSlotKey: 'combat09',
      }),
    ).toMatchObject({ kind: 'unavailable', reason: 'coverageNotReached' });
    expect(
      candidates.evaluate({
        kind: 'sideRoomGeneration',
        sideRoom: createLocalChildAddress(
          nBiome,
          nOccurrenceId('combat05'),
          'sideRooms',
          'sideDoor1',
        ),
        generation: 'generated',
      }),
    ).toMatchObject({ kind: 'unavailable', reason: 'coverageNotReached' });
    expect(
      candidates.evaluate({
        kind: 'sideRoomEntryOrder',
        group: createLocalChildGroupAddress(nBiome, nOccurrenceId('combat05'), 'sideRooms'),
        enteredSlotKeys: ['sideDoor1', 'sideDoor2'],
      }),
    ).toMatchObject({ kind: 'unavailable', reason: 'coverageNotReached' });
  });

  it('withholds a later visit from an incomplete prefix blocked at the board', () => {
    let project = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat10')),
      value: { rewardType: 'WeaponUpgrade' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'RemoveExitDecision',
      decision: createExitDecisionAddress(nBiome, { kind: 'hubDecision', decisionKey: 'hub' }),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'RemoveHubVisitsFrom',
      visit: createHubVisitAddress(nBiome, 'hub', 4),
    });
    const evaluation = simulateProject(catalog, project);
    const biome = evaluation.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((candidate) => candidate.biomeKey === 'N');

    expect(biome).toMatchObject({ authoring: 'incomplete', coverage: { kind: 'prefix' } });
    expect(
      createPreparedProjectCandidateSession(catalog, project, evaluation).evaluate({
        kind: 'hubVisit',
        visit: createHubVisitAddress(nBiome, 'hub', 4),
        hubSlotKey: 'combat09',
      }),
    ).toMatchObject({ kind: 'unavailable', reason: 'coverageNotReached' });
  });

  it('permits the audited ten-target peer-source repeat without changing physical-board ownership', () => {
    let project = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'OpenHubSlot',
      slot: createHubSlotAddress(nBiome, 'hub', 'combat12'),
      occurrenceId: nOccurrenceId('combat12'),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat12')),
      value: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' },
      },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(nBiome, nOccurrenceId('miniBoss01')),
      value: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'AphroditeUpgrade' },
      },
    });
    const { biome } = completeN(project);
    const hub = biome.snapshot.decisions.find((decision) => decision.kind === 'hub');
    if (hub?.kind !== 'hub') throw new Error('fixture lost Hub decision');

    expect(biome.validity).toBe('valid');
    expect(hub.board.targets).toHaveLength(10);
    expect(
      hub.board.targets.filter(
        (target) =>
          target.room.incomingReward?.offer.rewardType === 'Boon' &&
          target.room.incomingReward.offer.payload?.kind === 'BoonSource' &&
          target.room.incomingReward.offer.payload.source === 'AphroditeUpgrade',
      ),
    ).toHaveLength(2);
  });

  it('jointly consumes generated side siblings but acquires only the entered local rooms', () => {
    const { biome } = completeN();
    const hub = biome.snapshot.decisions.find((decision) => decision.kind === 'hub');
    if (hub?.kind !== 'hub') throw new Error('fixture lost Hub decision');
    const generated = hub.visits.flatMap((visit) =>
      visit.localSlots.filter((slot) => slot.generation === 'generated'),
    );
    const entered = hub.visits.flatMap((visit) => visit.enteredLocalRooms);
    const generatedOrigins = generated.map((slot) =>
      semanticAddressKey(slot.incomingReward!.origin),
    );
    const enteredOrigins = entered.map((slot) => semanticAddressKey(slot.incomingReward!.origin));
    const branch = biome.rewards.branches[0];
    if (branch === undefined) throw new Error('fixture has no reward branch');

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

  it('keeps the peer-exclusion finding at the second conflicting local reward owner', () => {
    let project = createRepresentativeNProject();
    for (const slotKey of ['sideDoor1', 'sideDoor2'] as const) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceLocalReward',
        reward: createLocalRewardAddress(nBiome, nOccurrenceId('combat05'), 'sideRooms', slotKey),
        value: { rewardType: 'AirBoost' },
      });
    }
    const { biome } = completeN(project);

    expect(biome.validity).toBe('invalid');
    expect(biome.findings).toContainEqual(
      expect.objectContaining({
        code: 'rewardBagEntryUnavailable',
        origin: createLocalRewardAddress(
          nBiome,
          nOccurrenceId('combat05'),
          'sideRooms',
          'sideDoor2',
        ),
      }),
    );
  });

  it('offers the fixed Story target without acquiring it or depleting the Hub bag', () => {
    const project = appendCompleteN(
      createProjectDocument(catalog, {
        projectId: 'n-story-board',
        name: 'N Story Board',
        configuredBiomeCounts: { Surface: 1 },
      }),
      {
        openSlotKeys: [
          'combat11',
          'combat10',
          'combat09',
          'combat05',
          'story',
          'combat02',
          'combat01',
          'miniBoss01',
          'combat23',
        ],
        visitSlotKeys: ['combat05', 'miniBoss01', 'combat02', 'combat11', 'combat23', 'story'],
      },
    );
    const { biome } = completeN(project);
    const hub = biome.snapshot.decisions.find((decision) => decision.kind === 'hub');
    if (hub?.kind !== 'hub') throw new Error('fixture lost Hub decision');
    const story = hub.board.targets.find((target) => target.hubSlotKey === 'story');
    const branch = biome.rewards.branches[0];
    if (story?.room.incomingReward === undefined || branch === undefined) {
      throw new Error('fixture lost the Story reward');
    }

    expect(biome.validity).toBe('valid');
    expect(story.room).toMatchObject({ gameName: 'N_Story01', entered: true });
    expect(biome.rewards.rewardLookups.hubRewardLookup).toContain('Story');
    expect(
      branch.events.filter(
        (event) =>
          event.kind === 'rewardOffered' &&
          semanticAddressKey(event.origin) ===
            semanticAddressKey(story.room.incomingReward!.origin),
      ),
    ).toHaveLength(1);
    expect(
      branch.events.filter(
        (event) =>
          event.kind === 'concreteAcquisition' &&
          semanticAddressKey(event.origin) ===
            semanticAddressKey(story.room.incomingReward!.origin),
      ),
    ).toHaveLength(0);
    expect(
      branch.bags.HubRewards?.remainingEntryCounts.reduce((total, count) => total + count, 0),
    ).toBe(3);
  });

  it('validates the Preboss inventory from all open target offers and applies its purchase owner', () => {
    const lookup = completeN().biome.rewards.rewardLookups.hubRewardLookup;
    expect(lookup).toEqual([
      'MaxHealthDropBig',
      'MaxManaDropBig',
      'WeaponUpgrade',
      'HermesUpgrade',
      'SpellDrop',
      'Boon',
    ]);

    const invalidProject = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'ReplaceShopOffer',
      offer: createShopOfferAddress(nBiome, nOccurrenceIds.preboss, 'MajorNonBoon'),
      value: { rewardType: 'WeaponUpgradeDrop' },
    });
    expect(completeN(invalidProject).biome.findings).toContainEqual(
      expect.objectContaining({
        code: 'shopOfferUnavailable',
        origin: createShopOfferAddress(nBiome, nOccurrenceIds.preboss, 'MajorNonBoon'),
      }),
    );

    const purchasedProject = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'SetShopPurchase',
      purchase: createShopPurchaseAddress(nBiome, nOccurrenceIds.preboss, 'Minor'),
      purchased: true,
    });
    expect(
      completeN(purchasedProject).biome.rewards.branches.some((branch) =>
        branch.events.some(
          (event) =>
            event.kind === 'concreteAcquisition' &&
            semanticAddressKey(event.origin) ===
              semanticAddressKey(
                createShopPurchaseAddress(nBiome, nOccurrenceIds.preboss, 'Minor'),
              ),
        ),
      ),
    ).toBe(true);
  });

  it('evaluates board rewards and the Preboss shop from their prepared semantic owners', () => {
    const { project, evaluation } = completeN();
    const candidates = createPreparedProjectCandidateSession(catalog, project, evaluation);

    expect(
      candidates.evaluate({
        kind: 'incomingReward',
        reward: createIncomingRewardAddress(nBiome, nOccurrenceId('combat09')),
        value: { rewardType: 'SpellDrop' },
      }),
    ).toMatchObject({ kind: 'incomingReward', result: { supported: true } });
    expect(
      candidates.evaluate({
        kind: 'shopOffer',
        offer: createShopOfferAddress(nBiome, nOccurrenceIds.preboss, 'MajorNonBoon'),
        value: { rewardType: 'MaxHealthDrop' },
      }),
    ).toMatchObject({ kind: 'shopOffer', result: { supported: true } });
  });

  it('evaluates Hub membership, visits, and parent-local state through their semantic owners', () => {
    const { project, evaluation } = completeN();
    const encodedBefore = encodeProjectDocument(project);
    const candidates = createPreparedProjectCandidateSession(catalog, project, evaluation);
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
    ] = candidates.evaluate([
      {
        kind: 'hubSlot',
        slot: createHubSlotAddress(nBiome, 'hub', 'miniBoss02'),
        open: true,
        occurrenceId: nOccurrenceId('candidate-miniBoss02'),
      },
      {
        kind: 'hubSlot',
        slot: createHubSlotAddress(nBiome, 'hub', 'combat12'),
        open: true,
        occurrenceId: nOccurrenceId('candidate-combat12'),
      },
      {
        kind: 'hubSlot',
        slot: createHubSlotAddress(nBiome, 'hub', 'combat10'),
        open: false,
        occurrenceId: nOccurrenceId('combat10'),
      },
      {
        kind: 'hubVisit',
        visit: createHubVisitAddress(nBiome, 'hub', 1),
        hubSlotKey: 'combat03',
      },
      {
        kind: 'hubVisit',
        visit: createHubVisitAddress(nBiome, 'hub', 1),
        hubSlotKey: 'miniBoss01',
      },
      {
        kind: 'sideRoomGeneration',
        sideRoom: createLocalChildAddress(
          nBiome,
          nOccurrenceId('combat05'),
          'sideRooms',
          'sideDoor1',
        ),
        generation: 'generated',
      },
      {
        kind: 'sideRoomGeneration',
        sideRoom: createLocalChildAddress(
          nBiome,
          nOccurrenceId('combat05'),
          'sideRooms',
          'sideDoor1',
        ),
        generation: 'notGenerated',
      },
      {
        kind: 'sideRoomGeneration',
        sideRoom: createLocalChildAddress(
          nBiome,
          nOccurrenceId('combat05'),
          'sideRooms',
          'sideDoor3',
        ),
        generation: 'notGenerated',
      },
      {
        kind: 'sideRoomEntryOrder',
        group: createLocalChildGroupAddress(nBiome, nOccurrenceId('combat05'), 'sideRooms'),
        enteredSlotKeys: ['sideDoor1', 'sideDoor2'],
      },
    ]);

    expect(conflictingMiniboss).toMatchObject({
      kind: 'hubSlot',
      result: {
        selectedPossible: false,
        findings: [
          {
            code: 'hubOpenSlotUnavailable',
            origin: createHubSlotAddress(nBiome, 'hub', 'miniBoss02'),
          },
        ],
      },
    });
    expect(validTenthSlot).toMatchObject({ kind: 'hubSlot', result: { selectedPossible: true } });
    expect(requiredOpenSlot).toMatchObject({
      kind: 'hubSlot',
      result: { selectedPossible: true, findings: [] },
    });
    expect(alternateVisit).toMatchObject({
      kind: 'hubVisit',
      result: {
        selectedPossible: false,
        findings: [expect.objectContaining({ code: 'sideRoomGenerationUnavailable' })],
      },
    });
    expect(duplicateVisit).toMatchObject({ kind: 'hubVisit', result: { selectedPossible: false } });
    expect(forcedSideGeneration).toMatchObject({
      kind: 'sideRoomGeneration',
      result: { selectedPossible: true, supportOutcomes: ['generated'] },
    });
    expect(blockedEnteredSide).toMatchObject({
      kind: 'sideRoomGeneration',
      result: { selectedPossible: false, enteredOrdinal: 2 },
    });
    expect(optionalSideGeneration).toMatchObject({
      kind: 'sideRoomGeneration',
      result: { selectedPossible: true, supportOutcomes: ['generated', 'notGenerated'] },
    });
    expect(sideEntryOrder).toMatchObject({
      kind: 'sideRoomEntryOrder',
      result: {
        selectedPossible: true,
        generatedSlotKeys: ['sideDoor1', 'sideDoor2', 'sideDoor3'],
      },
    });
    expect(encodeProjectDocument(project)).toBe(encodedBefore);
  });

  it('does not offer a visit-referenced slot for closure even when the board would retain its minimum size', () => {
    const project = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'OpenHubSlot',
      slot: createHubSlotAddress(nBiome, 'hub', 'combat12'),
      occurrenceId: nOccurrenceId('close-referenced-slot'),
    });
    const candidate = createPreparedProjectCandidateSession(catalog, project).evaluate({
      kind: 'hubSlot',
      slot: createHubSlotAddress(nBiome, 'hub', 'combat05'),
      open: false,
      occurrenceId: nOccurrenceId('combat05'),
    });

    expect(candidate).toMatchObject({
      kind: 'hubSlot',
      result: { selectedPossible: false, referencedVisitIndexes: [1], findings: [] },
    });
  });

  it('keeps an unvisited ninth Hub slot closable while the completed handoff is removed', () => {
    const { project, evaluation } = completeN();
    const candidate = createPreparedProjectCandidateSession(catalog, project, evaluation).evaluate({
      kind: 'hubSlot',
      slot: createHubSlotAddress(nBiome, 'hub', 'combat03'),
      open: false,
      occurrenceId: nOccurrenceId('combat03'),
    });

    expect(candidate).toMatchObject({
      kind: 'hubSlot',
      result: { selectedPossible: true, referencedVisitIndexes: [], findings: [] },
    });

    const closed = applyProjectCommand(project, catalog, {
      kind: 'CloseHubSlot',
      slot: createHubSlotAddress(nBiome, 'hub', 'combat03'),
    });
    const closedBiome = simulateProject(catalog, closed)
      .routes.find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N');
    expect(closedBiome).toMatchObject({
      authoring: 'incomplete',
      findings: [expect.objectContaining({ code: 'hubOpenSetIncomplete' })],
    });
  });

  it('preserves the fixed opening and PreHub reward surfaces as normal authored occurrences', () => {
    const { biome } = completeN();
    const opening = biome.snapshot.entryRoom;
    const linked = biome.snapshot.decisions.find((decision) => decision.kind === 'linkedExit');
    if (linked?.kind !== 'linkedExit') throw new Error('fixture lost PreHub link');

    expect(opening.incomingReward?.origin).toEqual(
      createIncomingRewardAddress(nBiome, nOccurrenceIds.opening),
    );
    expect(linked.target.room.incomingReward?.origin).toEqual(
      createIncomingRewardAddress(nBiome, nOccurrenceIds.preHub),
    );
    expect(
      biome.findings.filter(
        (finding) => semanticAddressKey(finding.origin) === semanticAddressKey(opening.origin),
      ),
    ).toEqual([]);
  });

  it('does not mutate reward ownership when replacing one local offer', () => {
    const project = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'ReplaceLocalReward',
      reward: createLocalRewardAddress(nBiome, nOccurrenceId('combat02'), 'sideRooms', 'sideDoor1'),
      value: { rewardType: 'RoomMoneyTinyDrop' },
    });
    const { biome } = completeN(project);
    const owner = createLocalRewardAddress(
      nBiome,
      nOccurrenceId('combat02'),
      'sideRooms',
      'sideDoor1',
    );

    expect(biome.snapshot.decisions.find((decision) => decision.kind === 'hub')).toBeDefined();
    expect(
      biome.rewards.branches.some((branch) =>
        branch.events.some(
          (event) => semanticAddressKey(event.origin) === semanticAddressKey(owner),
        ),
      ),
    ).toBe(true);
  });
});
