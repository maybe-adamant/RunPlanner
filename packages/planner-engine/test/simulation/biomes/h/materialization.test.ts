import {
  applyProjectCommand,
  acquisitionSiteStorageKey,
  artificerAcquisitionSite,
  artificerReplacementEntryKey,
  createAcquisitionRoleAddress,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createEncounterPhaseAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createRouteAddress,
  createRouteStartKeepsakeSelectionAddress,
  createTargetAddress,
  encodeProjectDocument,
  semanticAddressKey,
  type ExitDecision,
  type RoomActionReference,
  type OccurrenceId,
  type ProjectDocument,
  type RoomOccurrence,
} from '@run-planner/engine/authored-project';
import type { Catalog, RoomDeclaration } from '@run-planner/engine/catalog-schema';
import {
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
  simulateProject,
  evaluateBiomeCompleteness,
  fieldsBatchFacts,
  fieldsBatchOwnsCageOutcome,
  materializeBiome,
  type CandidateEvaluationEvent,
} from '@run-planner/engine/simulation';
import { beforeAll, describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';

import {
  authorTestArtificerReplacement,
  authorRequiredTestRoomActions,
  authorLegalTraitOffers,
  replaceTestRoomActionOrder,
} from '@run-planner/test-fixtures/shared';
import { createGoldenFGHProject, goldenHStartId } from '@run-planner/test-fixtures/underworld';

const biome = createBiomeAddress('Underworld', 'H');

beforeAll(() => {
  createGoldenFGHProject();
}, 60_000);

function plan(project: ProjectDocument) {
  const result = project.routes
    .find((route) => route.routeKey === 'Underworld')
    ?.biomes.find((candidate) => candidate.biomeKey === 'H');
  if (result === undefined) throw new Error('fixture has no H plan');
  return result;
}

function traitContext(project: ProjectDocument) {
  const route = project.routes.find((candidate) => candidate.routeKey === 'Underworld');
  if (route === undefined) throw new Error('fixture has no Underworld route');
  return route.loadout;
}

function hLayout() {
  const layout = catalog.biomeLayouts.byKey.H;
  if (layout === undefined) throw new Error('catalog has no H layout');
  return layout;
}

function batchAt(project: ProjectDocument, sourceOccurrenceId: OccurrenceId) {
  const topology = plan(project).topology;
  if (topology === null) throw new Error(`H batch from ${sourceOccurrenceId} is missing`);
  const decision = topology.decisions.find(
    (
      candidate,
    ): candidate is ExitDecision & {
      readonly normal: Extract<ExitDecision['normal'], { readonly kind: 'batch' }>;
    } =>
      candidate.kind === 'exit' &&
      candidate.normal.kind === 'batch' &&
      candidate.source.kind === 'occurrence' &&
      candidate.source.occurrenceId === sourceOccurrenceId,
  );
  if (decision === undefined) {
    throw new Error(`H batch from ${sourceOccurrenceId} is missing`);
  }
  return { decision, topology };
}

function occurrenceLookup(occurrences: readonly RoomOccurrence[]) {
  return (occurrenceId: OccurrenceId) =>
    occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId);
}

function catalogWithNonFieldsBoundedRoom(gameName: string): Catalog {
  const room = catalog.rooms.byKey[gameName];
  if (room === undefined) throw new Error(`catalog has no ${gameName}`);
  const replacement: RoomDeclaration = {
    ...room,
    mode: { kind: 'authored', templateKey: 'StandardCombat' },
  };
  return {
    ...catalog,
    rooms: {
      ...catalog.rooms,
      byKey: { ...catalog.rooms.byKey, [gameName]: replacement },
      values: catalog.rooms.values.map((candidate) =>
        candidate.gameName === gameName ? replacement : candidate,
      ),
    },
  };
}

function catalogWithNarrowFieldsOptionalSupport(
  gameName: string,
  eligibleRewardType: string,
): Catalog {
  const room = catalog.rooms.byKey[gameName];
  const descriptor = room?.fieldsOptionalRewards;
  if (room === undefined || descriptor === undefined) {
    throw new Error(`catalog has no Fields optional declaration for ${gameName}`);
  }
  const replacement: RoomDeclaration = Object.freeze({
    ...room,
    fieldsOptionalRewards: Object.freeze({
      ...descriptor,
      reward: Object.freeze({
        ...descriptor.reward,
        eligibleRewardTypes: Object.freeze([eligibleRewardType]),
        ineligibleRewardTypes: Object.freeze(
          descriptor.reward.allowedRewardTypes.filter(
            (rewardType) => rewardType !== eligibleRewardType,
          ),
        ),
      }),
    }),
  });
  return Object.freeze({
    ...catalog,
    rooms: Object.freeze({
      ...catalog.rooms,
      byKey: Object.freeze({ ...catalog.rooms.byKey, [gameName]: replacement }),
      values: Object.freeze(
        catalog.rooms.values.map((candidate) =>
          candidate.gameName === gameName ? replacement : candidate,
        ),
      ),
    }),
  });
}

function catalogWithSingleFieldsMaxManaEntry(): Catalog {
  const store = catalog.rewards.stores.byKey.FieldsOptionalRewards;
  if (store === undefined) throw new Error('catalog has no Fields optional reward store');
  let retainedMaxMana = false;
  const replacement = Object.freeze({
    ...store,
    entries: Object.freeze(
      store.entries.filter((entry) => {
        if (entry.rewardType !== 'MaxManaDropSmall') return true;
        if (retainedMaxMana) return false;
        retainedMaxMana = true;
        return true;
      }),
    ),
  });
  return Object.freeze({
    ...catalog,
    rewards: Object.freeze({
      ...catalog.rewards,
      stores: Object.freeze({
        values: Object.freeze(
          catalog.rewards.stores.values.map((candidate) =>
            candidate.key === replacement.key ? replacement : candidate,
          ),
        ),
        byKey: Object.freeze({
          ...catalog.rewards.stores.byKey,
          [replacement.key]: replacement,
        }),
      }),
    }),
  });
}

function appendBatch(
  project: ProjectDocument,
  parentOccurrenceId: OccurrenceId,
  targets: readonly {
    readonly occurrenceId: OccurrenceId;
    readonly gameName: string;
  }[],
  pickedExitIndex: number,
  cageOutcome: 'min' | 'max',
): ProjectDocument {
  const decision = createExitDecisionAddress(biome, {
    kind: 'occurrence',
    occurrenceId: parentOccurrenceId,
  });
  let next = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision });
  next = applyProjectCommand(next, catalog, {
    kind: 'ReplaceFieldsCageOutcome',
    decision,
    cageOutcome,
  });
  for (const [index, target] of targets.entries()) {
    next = applyProjectCommand(next, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(biome, decision.source, `exit${index + 1}`),
      occurrenceId: target.occurrenceId,
      gameName: target.gameName,
    });
  }
  return targets.length > 1
    ? applyProjectCommand(next, catalog, {
        kind: 'SetExitSelection',
        selection: createExitSelectionAddress(biome, decision.source),
        value: { kind: 'normal', exitKey: `exit${pickedExitIndex}` },
      })
    : next;
}

function completeProject(
  outcomes: readonly ['min' | 'max', 'min' | 'max', 'min' | 'max', 'min' | 'max'] = [
    'min',
    'max',
    'max',
    'min',
  ],
): ProjectDocument {
  const start = createOccurrenceId('h-materialized-start');
  const combat02 = createOccurrenceId('h-materialized-combat02');
  const combat09 = createOccurrenceId('h-materialized-combat09');
  const combat03 = createOccurrenceId('h-materialized-combat03');
  const combat04 = createOccurrenceId('h-materialized-combat04');
  const bridge = createOccurrenceId('h-materialized-bridge');
  const miniboss = createOccurrenceId('h-materialized-miniboss');
  const combat05 = createOccurrenceId('h-materialized-combat05');

  let project = createProjectDocument(catalog, {
    projectId: 'h-materialization',
    configuredBiomeCounts: { Underworld: 3 },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: start,
  });
  project = appendBatch(
    project,
    start,
    [{ occurrenceId: combat02, gameName: 'H_Combat02' }],
    1,
    outcomes[0],
  );
  project = appendBatch(
    project,
    combat02,
    [
      { occurrenceId: combat09, gameName: 'H_Combat09' },
      { occurrenceId: combat03, gameName: 'H_Combat03' },
    ],
    1,
    outcomes[1],
  );
  project = appendBatch(
    project,
    combat09,
    [
      { occurrenceId: bridge, gameName: 'H_Bridge01' },
      { occurrenceId: miniboss, gameName: 'H_MiniBoss01' },
    ],
    1,
    outcomes[2],
  );
  project = appendBatch(
    project,
    bridge,
    [
      { occurrenceId: combat05, gameName: 'H_Combat05' },
      { occurrenceId: combat04, gameName: 'H_Combat04' },
    ],
    1,
    outcomes[3],
  );
  const decision = createExitDecisionAddress(biome, {
    kind: 'occurrence',
    occurrenceId: combat05,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTakeoverBatch',
    decision,
    gameName: 'H_PreBoss01',
    targetOccurrenceIds: {
      exit1: createOccurrenceId('h-materialized-preboss-shop'),
      exit2: createOccurrenceId('h-materialized-preboss-free'),
    },
  });
  return applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(biome, decision.source),
    value: { kind: 'normal', exitKey: 'exit1' },
  });
}

function materialize(project: ProjectDocument) {
  const completeness = evaluateBiomeCompleteness(catalog, biome, plan(project));
  if (completeness.completion !== 'complete') {
    throw new Error(
      `fixture is incomplete: ${completeness.findings.map((finding) => finding.code)}`,
    );
  }
  return materializeBiome(catalog, biome, completeness, traitContext(project));
}

function ordinaryBatches(snapshot: ReturnType<typeof materialize>) {
  return snapshot.decisions.filter(
    (
      decision,
    ): decision is Extract<(typeof snapshot.decisions)[number], { readonly kind: 'batch' }> =>
      decision.kind === 'batch' &&
      !decision.targets.some((target) => target.room.gameName === 'H_PreBoss01'),
  );
}

function replaceFieldsActions(
  project: ProjectDocument,
  occurrenceId: OccurrenceId,
  transform: (order: readonly RoomActionReference[]) => readonly RoomActionReference[],
): ProjectDocument {
  const occurrence = plan(project).topology?.occurrences.find(
    (candidate) => candidate.occurrenceId === occurrenceId,
  );
  if (occurrence?.state.kind !== 'fieldsCombat')
    throw new Error(`missing Fields state ${occurrenceId}`);
  return replaceTestRoomActionOrder(
    project,
    catalog,
    biome,
    occurrenceId,
    transform(occurrence.roomActions.order),
  );
}

describe('H Fields materialization', () => {
  it('materializes only the selected optional prefix while retaining complete authored slots', () => {
    const project = createGoldenFGHProject();
    const occurrenceId = createOccurrenceId('golden-h-combat02');
    const snapshot = materialize(project);
    const room = ordinaryBatches(snapshot)
      .flatMap((batch) => batch.targets)
      .map((target) => target.room)
      .find((candidate) => candidate.occurrenceId === occurrenceId);
    expect(room?.fieldsOptionalRewards?.map((reward) => reward.slotKey)).toEqual([
      'optional1',
      'optional2',
    ]);
    expect(room?.fieldsOptionalRewards?.map((reward) => reward.resolvedStoreKey)).toEqual([
      'FieldsOptionalRewards',
      'FieldsOptionalRewards',
    ]);
    const state = plan(project).topology?.occurrences.find(
      (candidate) => candidate.occurrenceId === occurrenceId,
    )?.state;
    expect(state).toMatchObject({
      kind: 'fieldsCombat',
      optionalRewardCount: 2,
      optionalRewards: {
        optional1: expect.any(Object),
        optional2: expect.any(Object),
        optional3: expect.any(Object),
      },
    });
  });

  it('consumes generated unpicked optionals from only their persistent bag without acquisition history', () => {
    const selected = simulateProject(catalog, createGoldenFGHProject())
      .routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'H');
    if (selected?.authoring !== 'complete' || selected.validity !== 'valid') {
      throw new Error('selected optional fixture must be valid');
    }
    const selectedBranch = selected.rewards.branches[0];
    if (selectedBranch === undefined) throw new Error('selected optional fixture has no branch');
    expect(
      selectedBranch.bags.FieldsOptionalRewards?.remainingEntryCounts.reduce(
        (sum, count) => sum + count,
        0,
      ),
    ).toBe(13);
    expect(
      selectedBranch.events.filter(
        (event) =>
          event.kind === 'rewardOffered' &&
          event.origin.kind === 'localReward' &&
          event.origin.groupKey === 'optionalRewards',
      ),
    ).toHaveLength(6);
    expect(
      selectedBranch.events.some(
        (event) =>
          event.kind === 'concreteAcquisition' &&
          event.origin.kind === 'localReward' &&
          event.origin.groupKey === 'optionalRewards',
      ),
    ).toBe(false);

    let none = createGoldenFGHProject();
    for (const occurrenceId of [
      createOccurrenceId('golden-h-combat02'),
      createOccurrenceId('golden-h-combat09'),
      createOccurrenceId('golden-h-combat05'),
    ]) {
      none = applyProjectCommand(none, catalog, {
        kind: 'ReplaceFieldsOptionalRewardCount',
        occurrence: createOccurrenceAddress(biome, occurrenceId),
        optionalRewardCount: 0,
      });
    }
    const noneBiome = simulateProject(catalog, none)
      .routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'H');
    if (noneBiome?.authoring !== 'complete' || noneBiome.validity !== 'valid') {
      throw new Error('zero optional fixture must be valid');
    }
    const noneBranch = noneBiome.rewards.branches[0];
    expect(noneBranch?.bags.FieldsOptionalRewards).toBeUndefined();
    expect(noneBranch?.bags.RunProgress).toEqual(selectedBranch.bags.RunProgress);
  });

  it('refills the real Fields optional cohort by appending one full set without discarding ineligible leftovers', () => {
    const firstCombat = createOccurrenceId('golden-h-combat02');
    const laterCombats = [
      createOccurrenceId('golden-h-combat09'),
      createOccurrenceId('golden-h-combat05'),
    ];
    let project = createGoldenFGHProject();
    for (const slotKey of ['optional1', 'optional2']) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceLocalReward',
        reward: createLocalRewardAddress(biome, firstCombat, 'optionalRewards', slotKey),
        value: { rewardType: 'RoomRewardHealDrop' },
      });
    }
    for (const occurrenceId of laterCombats) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceFieldsOptionalRewardCount',
        occurrence: createOccurrenceAddress(biome, occurrenceId),
        optionalRewardCount: 0,
      });
    }
    const baseline = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFieldsOptionalRewardCount',
      occurrence: createOccurrenceAddress(biome, firstCombat),
      optionalRewardCount: 0,
    });
    // Keep the exact 19-entry store and real H02 lifecycle, but narrow this
    // declaration-local support so the bounded cohort can reach refill.
    const narrowedCatalog = catalogWithNarrowFieldsOptionalSupport(
      'H_Combat02',
      'RoomRewardHealDrop',
    );
    const evaluated = simulateProject(narrowedCatalog, project)
      .routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'H');
    const withoutOptionals = simulateProject(narrowedCatalog, baseline)
      .routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'H');
    if (
      evaluated?.authoring !== 'complete' ||
      evaluated.validity !== 'valid' ||
      withoutOptionals?.authoring !== 'complete' ||
      withoutOptionals.validity !== 'valid'
    ) {
      throw new Error('Fields optional refill fixtures must be valid');
    }
    const branch = evaluated.rewards.branches[0];
    const baselineBranch = withoutOptionals.rewards.branches[0];
    if (branch === undefined || baselineBranch === undefined) {
      throw new Error('Fields optional refill fixtures have no reward branch');
    }
    const remaining = branch.bags.FieldsOptionalRewards?.remainingEntryCounts;
    if (remaining === undefined) throw new Error('Fields optional refill bag is missing');

    expect(
      branch.events.filter(
        (event) =>
          event.kind === 'rewardOffered' &&
          event.origin.kind === 'localReward' &&
          event.origin.occurrenceId === firstCombat &&
          event.origin.groupKey === 'optionalRewards',
      ),
    ).toHaveLength(2);
    expect(remaining).toHaveLength(19);
    const store = narrowedCatalog.rewards.stores.byKey.FieldsOptionalRewards;
    if (store === undefined) throw new Error('Fields optional store is missing');
    const healIndex = store.entries.findIndex((entry) => entry.rewardType === 'RoomRewardHealDrop');
    expect(healIndex).toBeGreaterThanOrEqual(0);
    expect(remaining[healIndex]).toBe(0);
    expect(remaining.filter((_, index) => index !== healIndex)).toEqual(
      Array.from({ length: 18 }, () => 2),
    );
    expect(remaining.reduce((sum, count) => sum + count, 0)).toBe(36);
    expect(branch.bags.RunProgress).toEqual(baselineBranch.bags.RunProgress);
  });

  it.each([
    ['before the first cage', 'before'],
    ['between cage completions', 'between'],
    ['after the final cage', 'after'],
  ] as const)('weaves an optional interaction %s', (_label, expectedPosition) => {
    const occurrenceId = createOccurrenceId('golden-h-combat02');
    const optional = createLocalRewardAddress(biome, occurrenceId, 'optionalRewards', 'optional1');
    let firstPhaseKey = '';
    let secondPhaseKey = '';
    const project = replaceFieldsActions(createGoldenFGHProject(), occurrenceId, (order) => {
      const next = [...order];
      const cagePhases = next.flatMap((reference) =>
        reference.kind === 'completeFieldsCage' ? [reference.phaseKey] : [],
      );
      [firstPhaseKey = '', secondPhaseKey = ''] = cagePhases;
      if (firstPhaseKey === '' || secondPhaseKey === '') {
        throw new Error('Fields fixture lost its two active cages');
      }
      const index =
        expectedPosition === 'before'
          ? next.findIndex((reference) => reference.kind === 'completeFieldsCage')
          : expectedPosition === 'between'
            ? next.findIndex(
                (reference) =>
                  reference.kind === 'completeFieldsCage' && reference.phaseKey === secondPhaseKey,
              )
            : next.length;
      if (index < 0) throw new Error('Fields fixture lost a cage chronology action');
      next.splice(index, 0, {
        kind: 'interactLocalReward',
        groupKey: 'optionalRewards',
        slotKey: 'optional1',
      });
      return next;
    });
    const evaluated = simulateProject(catalog, project)
      .routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'H');
    if (evaluated?.authoring !== 'complete' || evaluated.validity !== 'valid') {
      throw new Error('ordered optional fixture must be valid');
    }
    const acquisition = evaluated.rewards.branches[0]?.events.find(
      (event) =>
        event.kind === 'concreteAcquisition' &&
        semanticAddressKey(event.origin) === semanticAddressKey(optional),
    );
    const roomHistory = evaluated.history.rooms.find(
      (room) => room.origin.kind === 'occurrence' && room.origin.occurrenceId === occurrenceId,
    );
    const event = (kind: 'encounterStarted' | 'encounterCompleted', phaseKey: string) =>
      evaluated.history.events.find(
        (candidate) =>
          candidate.kind === kind &&
          candidate.origin.kind === 'occurrence' &&
          candidate.origin.occurrenceId === occurrenceId &&
          candidate.phaseKey === phaseKey,
      );
    expect(roomHistory).toBeDefined();
    expect(acquisition).toBeDefined();
    const cage1Start = event('encounterStarted', firstPhaseKey)!;
    const cage1Complete = event('encounterCompleted', firstPhaseKey)!;
    const cage2Start = event('encounterStarted', secondPhaseKey)!;
    const cage2Complete = event('encounterCompleted', secondPhaseKey)!;
    if (expectedPosition === 'before')
      expect(acquisition!.historySequence).toBeLessThan(cage1Start.sequence);
    if (expectedPosition === 'between') {
      expect(acquisition!.historySequence).toBeGreaterThan(cage1Complete.sequence);
      expect(acquisition!.historySequence).toBeLessThan(cage2Start.sequence);
    }
    if (expectedPosition === 'after')
      expect(acquisition!.historySequence).toBeGreaterThan(cage2Complete.sequence);
  });

  it('routes an interacted optional Time Piece disposition through shared settlement', () => {
    const occurrenceId = createOccurrenceId('golden-h-combat02');
    const optional = createLocalRewardAddress(biome, occurrenceId, 'optionalRewards', 'optional1');
    let project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'GoldifyKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition: createAcquisitionRoleAddress(optional, 'self'),
      value: { kind: 'timePiece' },
    });
    project = replaceFieldsActions(project, occurrenceId, (order) => [
      { kind: 'interactLocalReward', groupKey: 'optionalRewards', slotKey: 'optional1' },
      ...order,
    ]);
    const evaluated = simulateProject(catalog, project)
      .routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'H');
    if (evaluated?.authoring !== 'complete' || evaluated.validity !== 'valid') {
      throw new Error('optional Time Piece fixture must be valid');
    }
    const events = evaluated.rewards.branches[0]?.events ?? [];
    expect(events).toContainEqual(
      expect.objectContaining({ kind: 'conversionToGold', origin: optional }),
    );
    expect(
      events.some(
        (event) =>
          event.kind === 'concreteAcquisition' &&
          semanticAddressKey(event.origin) === semanticAddressKey(optional),
      ),
    ).toBe(false);
  });

  it('keeps an uninteracted optional disposition dormant without charge, settlement, or finding', () => {
    const occurrenceId = createOccurrenceId('golden-h-combat02');
    const optional = createLocalRewardAddress(biome, occurrenceId, 'optionalRewards', 'optional1');
    let project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'GoldifyKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition: createAcquisitionRoleAddress(optional, 'self'),
      value: { kind: 'timePiece' },
    });

    const evaluated = simulateProject(catalog, project)
      .routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'H');
    if (evaluated?.authoring !== 'complete' || evaluated.validity !== 'valid') {
      throw new Error('dormant optional disposition fixture must be valid');
    }
    expect(
      evaluated.rewards.branches[0]?.events.some(
        (event) =>
          (event.kind === 'conversionToGold' || event.kind === 'concreteAcquisition') &&
          semanticAddressKey(event.origin) === semanticAddressKey(optional),
      ),
    ).toBe(false);
    expect(
      evaluated.findings.some(
        (finding) => semanticAddressKey(finding.origin) === semanticAddressKey(optional),
      ),
    ).toBe(false);
  });

  it('generates three Fields Hammers before any replacement or later cage Hammer is picked up', () => {
    const occurrenceId = createOccurrenceId('golden-h-combat02');
    const sources = ['optional1', 'optional2', 'optional3'] as const;
    let project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'GoldifyKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFieldsCageOutcome',
      decision: createExitDecisionAddress(biome, {
        kind: 'occurrence',
        occurrenceId: goldenHStartId,
      }),
      cageOutcome: 'max',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFieldsOptionalRewardCount',
      occurrence: createOccurrenceAddress(biome, occurrenceId),
      optionalRewardCount: 3,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceLocalReward',
      reward: createLocalRewardAddress(biome, occurrenceId, 'cages', 'cage3'),
      value: { rewardType: 'WeaponUpgrade' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceManualArcanaSelection',
      route: createRouteAddress('Underworld'),
      arcanaKeys: ['ChanneledCast', 'HealthRegen', 'BonusDodge', 'MetaToRunUpgrade'],
    });
    project = authorRequiredTestRoomActions(authorLegalTraitOffers(project), catalog);
    for (const [index, slotKey] of sources.entries()) {
      const owner = createLocalRewardAddress(biome, occurrenceId, 'optionalRewards', slotKey);
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceLocalReward',
        reward: owner,
        value: {
          rewardType: index === 0 ? 'MetaCurrencyDrop' : 'MetaCardPointsCommonDrop',
        },
      });
      project = authorTestArtificerReplacement(
        project,
        catalog,
        createAcquisitionRoleAddress(owner, 'self'),
        Object.freeze({
          offer: { rewardType: 'WeaponUpgrade' },
          traitOffersByAcquisitionRole: Object.freeze({
            self: Object.freeze({
              kind: 'traits',
              giverKey: 'WeaponUpgrade',
              options: Object.freeze(
                index === 0
                  ? ([
                      { traitKey: 'StaffAttackRecoveryTrait' },
                      { traitKey: 'StaffPowershotTrait' },
                      { traitKey: 'StaffFastSpecialTrait' },
                    ] as const)
                  : index === 1
                    ? ([
                        { traitKey: 'StaffJumpSpecialTrait' },
                        { traitKey: 'StaffExAoETrait' },
                        { traitKey: 'StaffSecondStageTrait' },
                      ] as const)
                    : ([
                        { traitKey: 'StaffDashAttackTrait' },
                        { traitKey: 'StaffOneWayAttackTrait' },
                        { traitKey: 'StaffTripleShotTrait' },
                      ] as const),
              ),
              selectedOptionKey: 'option1',
              rarificationActions: Object.freeze([]),
            }),
          }),
          dispositionByAcquisitionRole: Object.freeze({ self: { kind: 'normal' as const } }),
        }),
      );
    }
    const authoredState = plan(project).topology?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === occurrenceId,
    )?.state;
    if (authoredState?.kind !== 'fieldsCombat') throw new Error('multi-Hammer state is missing');
    expect(
      sources.map(
        (slotKey) =>
          authoredState.optionalRewards[slotKey]?.dispositionByAcquisitionRole.self?.kind,
      ),
    ).toEqual(['artificer', 'artificer', 'artificer']);
    const sourceReferences = sources.map((slotKey) => ({
      kind: 'interactLocalReward' as const,
      groupKey: 'optionalRewards',
      slotKey,
    }));
    const occurrenceOwner = createOccurrenceAddress(biome, occurrenceId);
    const replacementReferences = sources.map((slotKey) => {
      const sourceOwner = createLocalRewardAddress(biome, occurrenceId, 'optionalRewards', slotKey);
      return {
        kind: 'interactAcquisitionEntry' as const,
        siteKey: acquisitionSiteStorageKey(artificerAcquisitionSite(occurrenceOwner, sourceOwner)),
        entryKey: artificerReplacementEntryKey(sourceOwner, 'self'),
      };
    });
    project = replaceFieldsActions(project, occurrenceId, (order) => [
      ...sourceReferences,
      ...replacementReferences,
      ...order,
    ]);
    project = authorLegalTraitOffers(project);
    const replacementAddresses = replacementReferences.map((reference) =>
      createAcquisitionEntryAddress(
        artificerAcquisitionSite(
          occurrenceOwner,
          createLocalRewardAddress(
            biome,
            occurrenceId,
            'optionalRewards',
            sources[replacementReferences.indexOf(reference)]!,
          ),
        ),
        reference.entryKey,
      ),
    );
    const simulation = simulateProject(catalog, project);
    const evaluated = simulation.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'H');
    expect(evaluated?.authoring).toBe('complete');
    if (evaluated === undefined || !('rewards' in evaluated))
      throw new Error('H reward evaluation is missing');
    const branch = evaluated.rewards.branches[0]!;
    const conversions = branch.events.filter((event) => event.kind === 'artificerConversion');
    const hammers = branch.events.filter(
      (event) =>
        event.kind === 'concreteAcquisition' &&
        event.acquisition.acquisition.gameName === 'WeaponUpgrade',
    );
    expect(conversions).toHaveLength(3);
    expect(hammers).toHaveLength(4);
    expect(hammers.slice(0, 3).map((event) => event.origin)).toEqual(replacementAddresses);
    expect(
      simulation.findings.filter((finding) => finding.code === 'artificerReplacementUnavailable'),
    ).toEqual([]);
    expect(Math.max(...conversions.map((event) => event.historySequence))).toBeLessThan(
      Math.min(...hammers.map((event) => event.historySequence)),
    );
  });

  it('keeps a cage-owned Artificer replacement as a required dependent action', () => {
    const occurrenceId = createOccurrenceId('golden-h-combat02');
    const cage = createLocalRewardAddress(biome, occurrenceId, 'cages', 'cage1');
    const replacement = Object.freeze({
      offer: { rewardType: 'RoomMoneyDrop' as const },
      traitOffersByAcquisitionRole: Object.freeze({}),
      dispositionByAcquisitionRole: Object.freeze({ self: { kind: 'normal' as const } }),
    });
    let project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceManualArcanaSelection',
      route: createRouteAddress('Underworld'),
      arcanaKeys: ['ChanneledCast', 'HealthRegen', 'BonusDodge', 'MetaToRunUpgrade'],
    });
    project = authorTestArtificerReplacement(
      project,
      catalog,
      createAcquisitionRoleAddress(cage, 'self'),
      replacement,
    );
    project = authorRequiredTestRoomActions(project, catalog);
    const occurrence = plan(project).topology?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === occurrenceId,
    );
    if (occurrence?.state.kind !== 'fieldsCombat') throw new Error('Fields cage state is missing');
    const materializedRoom = materialize(project)
      .decisions.filter((decision) => decision.kind === 'batch')
      .flatMap((decision) => decision.targets)
      .map((target) => target.room)
      .find((room) => room.occurrenceId === occurrenceId);
    const sourceReference = {
      kind: 'interactLocalReward' as const,
      groupKey: 'cages',
      slotKey: 'cage1',
    };
    const replacementRow = materializedRoom?.roomActionRoster.rows.find(
      (row) => row.reference.kind === 'interactAcquisitionEntry',
    );
    expect(replacementRow).toMatchObject({
      participation: 'required',
      rank: expect.any(Number),
      dependencies: [{ kind: 'afterAction', action: sourceReference }],
    });
    expect(simulateProject(catalog, project).findings).toContainEqual(
      expect.objectContaining({
        code: 'artificerConversionUnavailable',
        origin: createAcquisitionRoleAddress(cage, 'self'),
      }),
    );
  });

  it('makes a same-phase Fields cage the exact prerequisite of its Gorgon contact', () => {
    const occurrenceId = createOccurrenceId('golden-h-combat02');
    const phase = createEncounterPhaseAddress(
      biome,
      { kind: 'occurrence', occurrenceId },
      'Cage01',
    );
    let project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'AthenaEncounterKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceGorgonDeathDefianceCondition',
      phase,
      value: true,
    });
    const materializedRoom = materialize(project)
      .decisions.filter((decision) => decision.kind === 'batch')
      .flatMap((decision) => decision.targets)
      .map((target) => target.room)
      .find((room) => room.occurrenceId === occurrenceId);

    expect(
      materializedRoom?.roomActionRoster.rows.find(
        (row) => row.reference.kind === 'interactGorgon' && row.reference.phaseKey === 'Cage01',
      ),
    ).toMatchObject({
      dependencies: expect.arrayContaining([
        {
          kind: 'afterAction',
          action: { kind: 'completeFieldsCage', phaseKey: 'Cage01' },
        },
      ]),
    });
  });

  it('keeps Fields Min/Max and cage-local rewards as engine-owned candidate domains', () => {
    const project = createGoldenFGHProject();
    const start = goldenHStartId;
    const combat = createOccurrenceId('golden-h-combat02');
    const occurrence = plan(project).topology?.occurrences.find(
      (candidate) => candidate.occurrenceId === combat,
    );
    if (occurrence?.state.kind !== 'fieldsCombat') {
      throw new Error('H fixture must retain its first Fields combat state');
    }
    const reward = occurrence.state.cages.cage1;
    if (reward === undefined) throw new Error('H fixture must retain cage1');
    const work: CandidateEvaluationEvent[] = [];
    const session = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
      { observe: (event) => work.push(event) },
    );
    const candidates = session.evaluate([
      {
        kind: 'fieldsCageOutcome',
        decision: createExitDecisionAddress(biome, { kind: 'occurrence', occurrenceId: start }),
        cageOutcome: 'min',
      },
      {
        kind: 'fieldsCageOutcome',
        decision: createExitDecisionAddress(biome, { kind: 'occurrence', occurrenceId: start }),
        cageOutcome: 'max',
      },
      {
        kind: 'localReward',
        reward: createLocalRewardAddress(biome, combat, 'cages', 'cage1'),
        value: reward!.offer,
      },
      {
        kind: 'localReward',
        reward: createLocalRewardAddress(biome, combat, 'optionalRewards', 'optional1'),
        value: { rewardType: 'MaxManaDropSmall' },
      },
    ]);

    expect(candidates).toMatchObject([
      { kind: 'fieldsCageOutcome', result: { cageOutcome: 'min', selectedPossible: true } },
      { kind: 'fieldsCageOutcome', result: { cageOutcome: 'max' } },
      { kind: 'localReward', result: { supported: true, findings: [] } },
      { kind: 'localReward', result: { supported: true, findings: [] } },
    ]);
    expect(work).not.toEqual([]);
  });

  it('discards a failed first Fields completion before accepting a later sibling proposal', () => {
    const combat02 = createOccurrenceId('golden-h-combat02');
    const combat09 = createOccurrenceId('golden-h-combat09');
    const combat05 = createOccurrenceId('golden-h-combat05');
    let project = createGoldenFGHProject();
    for (const [occurrenceId, optionalRewardCount] of [
      [combat02, 0],
      [combat09, 0],
      [combat05, 4],
    ] as const) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceFieldsOptionalRewardCount',
        occurrence: createOccurrenceAddress(biome, occurrenceId),
        optionalRewardCount,
      });
    }
    // With one Max Magick store entry, optional3 consumes the focused value;
    // optional4's first same-value proposal fails before its next proposal
    // completes the cohort.
    const narrowedCatalog = catalogWithSingleFieldsMaxManaEntry();
    const result = createPreparedProjectCandidateSession(
      narrowedCatalog,
      simulateProjectAssembly(narrowedCatalog, project),
    ).evaluate({
      kind: 'localReward',
      reward: createLocalRewardAddress(biome, combat05, 'optionalRewards', 'optional3'),
      value: { rewardType: 'MaxManaDropSmall' },
    });

    expect(result).toMatchObject({
      kind: 'localReward',
      result: { supported: true, findings: [] },
    });
  });

  it('settles only active cage slots at their exact local reward sites', () => {
    const evaluation = simulateProject(catalog, createGoldenFGHProject());
    const h = evaluation.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'H');
    if (h?.authoring !== 'complete' || h.validity !== 'valid') {
      throw new Error('fixture did not complete valid H');
    }
    const minRoom = h.snapshot.decisions
      .filter((decision) => decision.kind === 'batch')
      .flatMap((decision) => decision.targets)
      .map((target) => target.room)
      .find((room) => room.localRewards?.length === 2);
    if (minRoom?.origin.kind !== 'occurrence' || minRoom.localRewards === undefined) {
      throw new Error('fixture lost a two-cage Fields room');
    }
    const events = h.rewards.branches[0]?.events ?? [];
    for (const reward of minRoom.localRewards) {
      const site = createAcquisitionSiteAddress(
        reward.origin,
        `localReward:cages:${reward.slotKey}`,
      );
      expect(
        events.find(
          (event) =>
            event.kind === 'concreteAcquisition' &&
            semanticAddressKey(event.origin) === semanticAddressKey(reward.origin),
        ),
      ).toMatchObject({
        settlement: {
          site,
          entry: createAcquisitionEntryAddress(site, reward.slotKey),
        },
      });
    }
    const dormant = createLocalRewardAddress(biome, minRoom.origin.occurrenceId, 'cages', 'cage3');
    expect(
      events.some(
        (event) =>
          event.kind === 'concreteAcquisition' &&
          event.settlement !== undefined &&
          semanticAddressKey(event.settlement.site.owner) === semanticAddressKey(dormant),
      ),
    ).toBe(false);
  });

  it('routes a cage Time Piece choice through the authored interaction checkpoint', () => {
    const cage = createLocalRewardAddress(
      biome,
      createOccurrenceId('golden-h-combat02'),
      'cages',
      'cage1',
    );
    let project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'GoldifyKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition: createAcquisitionRoleAddress(cage, 'self'),
      value: { kind: 'timePiece' },
    });
    const evaluated = simulateProject(catalog, project)
      .routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'H');
    if (evaluated?.authoring !== 'complete' || evaluated.validity !== 'valid') {
      throw new Error('Time Piece fixture did not complete valid H');
    }
    const events = evaluated.rewards.branches[0]?.events ?? [];
    expect(events).toContainEqual(
      expect.objectContaining({
        kind: 'conversionToGold',
        origin: cage,
        settlement: {
          site: createAcquisitionSiteAddress(cage, 'localReward:cages:cage1'),
          entry: createAcquisitionEntryAddress(
            createAcquisitionSiteAddress(cage, 'localReward:cages:cage1'),
            'cage1',
          ),
        },
      }),
    );
    expect(
      events.some(
        (event) =>
          event.kind === 'concreteAcquisition' &&
          semanticAddressKey(event.origin) === semanticAddressKey(cage),
      ),
    ).toBe(false);
  });

  it('does not assess a later Fields decision after an earlier cage reward is invalid', () => {
    const firstCombat = createOccurrenceId('golden-h-combat02');
    const laterCombat = createOccurrenceId('golden-h-combat09');
    const project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceLocalReward',
      reward: createLocalRewardAddress(biome, firstCombat, 'cages', 'cage1'),
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'HestiaUpgrade' } },
    });
    const work: CandidateEvaluationEvent[] = [];
    const session = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
      { observe: (event) => work.push(event) },
    );

    expect(
      session.evaluate({
        kind: 'fieldsCageOutcome',
        decision: createExitDecisionAddress(biome, {
          kind: 'occurrence',
          occurrenceId: laterCombat,
        }),
        cageOutcome: 'max',
      }),
    ).toMatchObject({ kind: 'unavailable', reason: 'coverageNotReached' });
    expect(work).toEqual([]);
  });

  it('derives each Fields capacity and active local-reward prefix without mutating authorship', () => {
    const project = completeProject();
    const encodedBefore = encodeProjectDocument(project);
    const snapshot = materialize(project);
    const batches = ordinaryBatches(snapshot);

    expect(batches.map((batch) => batch.batchState)).toEqual([
      {
        kind: 'fields',
        cageOutcome: 'min',
        batchCapacity: 3,
        cageTargetCount: 1,
        doorCageRewardCount: 2,
      },
      {
        kind: 'fields',
        cageOutcome: 'max',
        batchCapacity: 2,
        cageTargetCount: 2,
        doorCageRewardCount: 2,
      },
      {
        kind: 'fields',
        cageOutcome: 'max',
        batchCapacity: 3,
        cageTargetCount: 0,
        doorCageRewardCount: 3,
      },
      {
        kind: 'fields',
        cageOutcome: 'min',
        batchCapacity: 3,
        cageTargetCount: 2,
        doorCageRewardCount: 2,
      },
    ]);

    const minCombat = batches[0]?.targets[0]?.room;
    expect(minCombat).toMatchObject({
      gameName: 'H_Combat02',
      lifecycleProfileKey: 'FieldsCombatRoom',
      encounterEnvelopeKey: 'FieldsEncounter',
    });
    expect(minCombat?.unresolvedLocalRewards?.map((reward) => reward.slotKey)).toEqual([
      'cage1',
      'cage2',
    ]);
    expect(minCombat?.unresolvedLocalRewards?.[1]).toMatchObject({
      groupKey: 'cages',
      encounterPhaseKey: 'Cage02',
      resolvedStoreKey: 'RunProgress',
    });
    expect(semanticAddressKey(minCombat!.unresolvedLocalRewards![1]!.origin)).toBe(
      '["localReward","Underworld","H","h-materialized-combat02","cages","cage2"]',
    );

    expect(
      batches[2]?.targets.every(
        (target) =>
          target.room.localRewards === undefined &&
          target.room.unresolvedLocalRewards === undefined,
      ),
    ).toBe(true);
    expect(batches[1]?.targets.map((target) => target.room.unresolvedLocalRewards?.length)).toEqual(
      [2, 2],
    );
    expect(batches[1]?.targets.map((target) => target.room.encounterEnvelopeKey)).toEqual([
      'FieldsEncounter',
      'FieldsEncounter',
    ]);

    expect(encodeProjectDocument(project)).toBe(encodedBefore);
    expect(
      plan(project).topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === createOccurrenceId('h-materialized-combat02'),
      )?.state,
    ).toMatchObject({
      kind: 'fieldsCombat',
      cages: { cage1: expect.any(Object), cage2: expect.any(Object), cage3: expect.any(Object) },
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(minCombat?.unresolvedLocalRewards)).toBe(true);
  });

  it('materializes a supported three-cage Max without changing dormant leaves', () => {
    const snapshot = materialize(completeProject(['min', 'min', 'min', 'max']));
    const maxBatch = ordinaryBatches(snapshot)[3];
    const maxCombat = maxBatch?.targets[0]?.room;

    expect(maxBatch?.batchState).toEqual({
      kind: 'fields',
      cageOutcome: 'max',
      batchCapacity: 3,
      cageTargetCount: 2,
      doorCageRewardCount: 3,
    });
    expect(maxCombat).toMatchObject({
      gameName: 'H_Combat05',
      lifecycleProfileKey: 'FieldsCombatRoom',
      encounterEnvelopeKey: 'FieldsEncounter',
      encounterPhases: [
        { slotKey: 'Passive', encounterKey: 'GeneratedH_Passive' },
        { slotKey: 'Cage01', encounterKey: 'GeneratedH' },
        { slotKey: 'Cage02', encounterKey: 'GeneratedH' },
        { slotKey: 'Cage03', encounterKey: 'GeneratedH' },
      ],
    });
    expect(maxCombat?.unresolvedLocalRewards?.map((reward) => reward.slotKey)).toEqual([
      'cage1',
      'cage2',
      'cage3',
    ]);
    expect(semanticAddressKey(maxCombat!.unresolvedLocalRewards![2]!.origin)).toBe(
      '["localReward","Underworld","H","h-materialized-combat05","cages","cage3"]',
    );
  });

  it('retains the door roll for all-special and mixed target batches', () => {
    const specialOnly = applyProjectCommand(completeProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(biome, createOccurrenceId('h-materialized-bridge')),
      gameName: 'H_MiniBoss02',
    });
    expect(ordinaryBatches(materialize(specialOnly))[2]?.batchState).toEqual({
      kind: 'fields',
      cageOutcome: 'max',
      batchCapacity: 3,
      cageTargetCount: 0,
      doorCageRewardCount: 3,
    });

    const mixed = applyProjectCommand(completeProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(biome, createOccurrenceId('h-materialized-bridge')),
      gameName: 'H_Combat05',
    });
    expect(ordinaryBatches(materialize(mixed))[2]?.batchState).toEqual({
      kind: 'fields',
      cageOutcome: 'max',
      batchCapacity: 3,
      cageTargetCount: 1,
      doorCageRewardCount: 3,
    });

    const capacityLimited = applyProjectCommand(completeProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(biome, createOccurrenceId('h-materialized-bridge')),
      gameName: 'H_Combat13',
    });
    const replacementState = plan(capacityLimited).topology?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === 'h-materialized-bridge',
    )?.state;
    if (replacementState?.kind !== 'fieldsCombat') {
      throw new Error('capacity-limited Fields replacement is missing');
    }
    expect(
      plan(capacityLimited).topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === 'h-materialized-bridge',
      )?.roomActions.order,
    ).toEqual(expect.any(Array));
    expect(ordinaryBatches(materialize(capacityLimited))[2]?.batchState).toEqual({
      kind: 'fields',
      cageOutcome: 'max',
      batchCapacity: 2,
      cageTargetCount: 1,
      doorCageRewardCount: 2,
    });
  });

  it('derives configured Fields facts from the template and any takeover target', () => {
    const project = completeProject();
    const { decision, topology } = batchAt(project, createOccurrenceId('h-materialized-combat02'));
    const lookup = occurrenceLookup(topology.occurrences);

    expect(fieldsBatchFacts(catalog, hLayout(), lookup, decision)).toEqual({
      cageOutcome: 'max',
      batchCapacity: 2,
      cageTargetCount: 2,
      doorCageRewardCount: 2,
    });

    const awaitingOutcome = {
      ...decision,
      normal: { ...decision.normal, batchState: null },
    };
    expect(fieldsBatchOwnsCageOutcome(catalog, hLayout(), lookup, awaitingOutcome)).toBe(true);
    expect(fieldsBatchFacts(catalog, hLayout(), lookup, awaitingOutcome)).toBeUndefined();

    const nonFieldsCatalog = catalogWithNonFieldsBoundedRoom('H_Combat09');
    expect(fieldsBatchFacts(nonFieldsCatalog, hLayout(), lookup, decision)).toEqual({
      cageOutcome: 'max',
      batchCapacity: 3,
      cageTargetCount: 1,
      doorCageRewardCount: 3,
    });

    const mixedOccurrences = topology.occurrences.map((occurrence) =>
      occurrence.occurrenceId === createOccurrenceId('h-materialized-combat03')
        ? { ...occurrence, gameName: 'H_PreBoss01' }
        : occurrence,
    );
    const mixedLookup = occurrenceLookup(mixedOccurrences);
    expect(fieldsBatchOwnsCageOutcome(catalog, hLayout(), mixedLookup, decision)).toBe(false);
    expect(fieldsBatchFacts(catalog, hLayout(), mixedLookup, decision)).toBeUndefined();
  });

  it('materializes the entry, selected Preboss batch, and H completion tail exactly once', () => {
    const snapshot = materialize(completeProject());
    const takeover = snapshot.decisions.at(-1);
    if (takeover?.kind !== 'batch') throw new Error('H fixture lost its takeover batch');

    expect(snapshot.entryRoom).toMatchObject({
      gameName: 'H_Intro',
      lifecycleProfileKey: 'RewardlessRoom',
      entered: true,
    });
    expect(takeover.targets).toHaveLength(2);
    expect(takeover.targets[0]).toMatchObject({
      picked: true,
      continuation: 'startsCompletion',
      room: {
        gameName: 'H_PreBoss01',
        lifecycleProfileKey: 'PrebossShopRoom',
        entryState: { kind: 'shop', profileKey: 'WorldShop' },
      },
    });
    expect(takeover.targets[1]).toMatchObject({
      picked: false,
      continuation: 'deadLeaf',
      room: {
        gameName: 'H_PreBoss01',
        lifecycleProfileKey: 'PrebossFreeRewardRoom',
      },
    });
    expect(snapshot.completionRooms.map((room) => room.gameName)).toEqual([
      'H_Boss01',
      'H_PostBoss01',
    ]);
    expect(snapshot.completionRooms.map((room) => room.lifecycleProfileKey)).toEqual([
      'BossRoom',
      'PostBossRoom',
    ]);
    expect(snapshot.completionRooms[0]).toMatchObject({ enteredRewardStoreKey: 'RunProgress' });
    expect(ordinaryBatches(snapshot)).toHaveLength(4);
    expect(snapshot).not.toHaveProperty('history');
    expect(snapshot).not.toHaveProperty('findings');
  });
});
