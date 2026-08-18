import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createTargetAddress,
  type AuthoredBiomePlan,
  type ProjectDocument,
  type RoomOccurrence,
} from '@run-planner/engine/authored-project';
import type { Catalog, RoomDeclaration } from '@run-planner/engine/catalog-schema';
import type { CountedRewardBinding } from '@run-planner/engine/reward-kernel';
import { countedRewardTypeDomain, simulateProjectAssembly } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  createGoldenFGHIProject,
  createRepresentativeNOPQProject,
  goldenFBiome,
  goldenFOccurrenceId,
  nBiome,
  nLocalOccurrenceId,
  nOccurrenceId,
  oBiome,
  oOccurrenceIds,
} from '@run-planner/test-fixtures';
import { resolveCountedRewardTypeDomain } from '../../src/simulation/rewards/authoring-domain';

function plan(project: ProjectDocument, routeKey: string, biomeKey: string): AuthoredBiomePlan {
  const result = project.routes
    .find((route) => route.routeKey === routeKey)
    ?.biomes.find((biome) => biome.biomeKey === biomeKey);
  if (result === undefined) throw new Error(`${routeKey}.${biomeKey} plan is missing`);
  return result;
}

function occurrence(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  gameName: string,
): RoomOccurrence {
  const result = plan(project, routeKey, biomeKey).topology?.occurrences.find(
    (candidate) => candidate.gameName === gameName,
  );
  if (result === undefined) throw new Error(`${gameName} occurrence is missing`);
  return result;
}

function countedBinding(gameName: string): CountedRewardBinding {
  const binding = catalog.rooms.byKey[gameName]?.incomingReward;
  if (binding?.kind !== 'countedChoice') throw new Error(`${gameName} is not counted`);
  return binding;
}

function shipWheelBinding(): CountedRewardBinding {
  const attachment = catalog.encounterEnvelopes.byKey.ShipEncounter?.slots.find(
    (slot) => slot.key === 'Combat1',
  )?.rewardAttachment;
  if (attachment?.kind !== 'rewardWheel') throw new Error('Ship Combat1 wheel is missing');
  return attachment.reward;
}

function catalogWithRoom(room: RoomDeclaration): Catalog {
  return Object.freeze({
    ...catalog,
    rooms: Object.freeze({
      values: Object.freeze(
        catalog.rooms.values.map((candidate) =>
          candidate.gameName === room.gameName ? room : candidate,
        ),
      ),
      byKey: Object.freeze({ ...catalog.rooms.byKey, [room.gameName]: room }),
    }),
  });
}

function withBlockedUnderworldSuffix(project: ProjectDocument): ProjectDocument {
  return Object.freeze({
    ...project,
    routes: Object.freeze(
      project.routes.map((route) =>
        route.routeKey !== 'Underworld'
          ? route
          : Object.freeze({
              ...route,
              biomes: Object.freeze(
                route.biomes.map((biome) => {
                  if (biome.biomeKey !== 'F' || biome.topology === null) return biome;
                  const first = biome.topology.decisions.find(
                    (decision) => decision.kind === 'exit',
                  );
                  if (first?.kind !== 'exit') throw new Error('F first decision is missing');
                  return Object.freeze({
                    ...biome,
                    topology: Object.freeze({
                      ...biome.topology,
                      decisions: Object.freeze(
                        biome.topology.decisions.map((decision) =>
                          decision === first
                            ? Object.freeze({
                                ...decision,
                                selection: { kind: 'unresolved' as const },
                              })
                            : decision,
                        ),
                      ),
                    }),
                  });
                }),
              ),
            }),
      ),
    ),
  });
}

function withIncompleteHubVisits(project: ProjectDocument): ProjectDocument {
  return Object.freeze({
    ...project,
    routes: Object.freeze(
      project.routes.map((route) =>
        route.routeKey !== 'Surface'
          ? route
          : Object.freeze({
              ...route,
              biomes: Object.freeze(
                route.biomes.map((biome) => {
                  if (biome.biomeKey !== 'N' || biome.topology === null) return biome;
                  return Object.freeze({
                    ...biome,
                    topology: Object.freeze({
                      ...biome.topology,
                      decisions: Object.freeze(
                        biome.topology.decisions.map((decision) =>
                          decision.kind === 'hub'
                            ? Object.freeze({
                                ...decision,
                                visitOrder: decision.visitOrder.slice(0, 5),
                              })
                            : decision,
                        ),
                      ),
                    }),
                  });
                }),
              ),
            }),
      ),
    ),
  });
}

function withRetainedHubBehindMissingLink(project: ProjectDocument): ProjectDocument {
  return Object.freeze({
    ...project,
    routes: Object.freeze(
      project.routes.map((route) =>
        route.routeKey !== 'Surface'
          ? route
          : Object.freeze({
              ...route,
              biomes: Object.freeze(
                route.biomes.map((biome) => {
                  if (biome.biomeKey !== 'N' || biome.topology === null) return biome;
                  const startOccurrenceId = biome.topology.startOccurrenceId;
                  return Object.freeze({
                    ...biome,
                    topology: Object.freeze({
                      ...biome.topology,
                      decisions: Object.freeze(
                        biome.topology.decisions.filter(
                          (decision) =>
                            !(
                              decision.kind === 'exit' &&
                              decision.source.kind === 'occurrence' &&
                              decision.source.occurrenceId === startOccurrenceId
                            ),
                        ),
                      ),
                    }),
                  });
                }),
              ),
            }),
      ),
    ),
  });
}

function withReversedBatchTargets(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  sourceOccurrenceId: ReturnType<typeof createOccurrenceId>,
): ProjectDocument {
  return Object.freeze({
    ...project,
    routes: Object.freeze(
      project.routes.map((route) =>
        route.routeKey !== routeKey
          ? route
          : Object.freeze({
              ...route,
              biomes: Object.freeze(
                route.biomes.map((biome) => {
                  if (biome.biomeKey !== biomeKey || biome.topology === null) return biome;
                  return Object.freeze({
                    ...biome,
                    topology: Object.freeze({
                      ...biome.topology,
                      decisions: Object.freeze(
                        biome.topology.decisions.map((decision) =>
                          decision.kind === 'exit' &&
                          decision.source.kind === 'occurrence' &&
                          decision.source.occurrenceId === sourceOccurrenceId &&
                          decision.normal.kind === 'batch'
                            ? Object.freeze({
                                ...decision,
                                normal: Object.freeze({
                                  ...decision.normal,
                                  targets: Object.freeze([...decision.normal.targets].reverse()),
                                }),
                              })
                            : decision,
                        ),
                      ),
                    }),
                  });
                }),
              ),
            }),
      ),
    ),
  });
}

function oSourceOfferCatalog(): Catalog {
  const original = catalog.rooms.byKey.O_MiniBoss01;
  if (original?.incomingReward.kind !== 'countedChoice') {
    throw new Error('O miniboss binding is missing');
  }
  const run = catalog.rewards.stores.byKey.RunProgress;
  const meta = catalog.rewards.stores.byKey.MetaProgress;
  if (run === undefined || meta === undefined)
    throw new Error('standard reward stores are missing');
  const binding = Object.freeze({
    ...original.incomingReward,
    storeKeys: Object.freeze(['RunProgress', 'MetaProgress']),
    eligibleRewardTypes: Object.freeze([]),
    ineligibleRewardTypes: Object.freeze([]),
    allowedRewardTypes: Object.freeze([
      ...new Set([...run.entries, ...meta.entries].map((entry) => entry.rewardType)),
    ]),
  });
  const unforced = { ...original };
  delete unforced.forcedRewardStoreKey;
  return catalogWithRoom(
    Object.freeze({
      ...unforced,
      incomingReward: binding,
    }),
  );
}

function sourceOfferPointProject(testCatalog: Catalog): {
  readonly project: ProjectDocument;
  readonly binding: CountedRewardBinding;
  readonly targetId: ReturnType<typeof createOccurrenceId>;
} {
  const introId = createOccurrenceId('source-offer-o-intro');
  const shipId = createOccurrenceId('source-offer-o-ship');
  const targetId = createOccurrenceId('source-offer-o-target');
  let project = createProjectDocument(testCatalog, {
    projectId: 'source-offer-domain',
    name: 'Source offer domain',
    configuredBiomeCounts: { Surface: 2 },
  });
  project = applyProjectCommand(project, testCatalog, {
    kind: 'CreateStart',
    biome: oBiome,
    occurrenceId: introId,
  });
  const introSource = { kind: 'occurrence' as const, occurrenceId: introId };
  project = applyProjectCommand(project, testCatalog, {
    kind: 'CreateBatch',
    decision: createExitDecisionAddress(oBiome, introSource),
  });
  project = applyProjectCommand(project, testCatalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(oBiome, introSource),
    storeKey: 'RunProgress',
  });
  project = applyProjectCommand(project, testCatalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(oBiome, introSource, 'exit1'),
    occurrenceId: shipId,
    gameName: 'O_Combat04',
  });
  project = applyProjectCommand(project, testCatalog, {
    kind: 'ReplaceShipEncounterCount',
    occurrence: createOccurrenceAddress(oBiome, shipId),
    encounterCount: 3,
  });
  project = applyProjectCommand(project, testCatalog, {
    kind: 'ReplaceRewardWheelStore',
    wheel: createRewardWheelAddress(oBiome, shipId, 'wheel2'),
    storeKey: 'MetaProgress',
  });
  const shipSource = { kind: 'occurrence' as const, occurrenceId: shipId };
  project = applyProjectCommand(project, testCatalog, {
    kind: 'CreateBatch',
    decision: createExitDecisionAddress(oBiome, shipSource),
  });
  const targetDeclaration = testCatalog.rooms.byKey.O_MiniBoss01;
  if (targetDeclaration === undefined) throw new Error('test target declaration is missing');
  const authoringCatalog = catalogWithRoom(
    Object.freeze({ ...targetDeclaration, forcedRewardStoreKey: 'RunProgress' }),
  );
  project = applyProjectCommand(project, authoringCatalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(oBiome, shipSource, 'exit1'),
    occurrenceId: targetId,
    gameName: 'O_MiniBoss01',
  });
  const binding = testCatalog.rooms.byKey.O_MiniBoss01?.incomingReward;
  if (binding?.kind !== 'countedChoice') throw new Error('test binding is missing');
  project = applyProjectCommand(project, testCatalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(oBiome, targetId),
    value: { rewardType: 'TalentDrop' },
  });
  return { project, binding, targetId };
}

describe('counted reward authoring domains', () => {
  it('prefers an exact evaluated producer and rejects a present producer with no resolved store', () => {
    const project = createGoldenFGHIProject();
    const owner = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(2, 1));
    const binding = countedBinding('F_Combat03');
    const authoredMetaCatalog = catalogWithRoom(
      Object.freeze({
        ...catalog.rooms.byKey.F_Combat03!,
        individualRewardStoreKey: 'MetaProgress',
      }),
    );

    expect(
      resolveCountedRewardTypeDomain(authoredMetaCatalog, project, owner, binding, {
        acquisitionHorizon: 'ownEnteredLifecycle',
        resolvedStoreKey: 'RunProgress',
        evaluateOffer: () => ({ supported: true, findings: [] }),
      }),
    ).toContain('MaxHealthDrop');
    expect(() =>
      resolveCountedRewardTypeDomain(authoredMetaCatalog, project, owner, binding, {
        acquisitionHorizon: 'generationOnly',
        evaluateOffer: () => ({ supported: true, findings: [] }),
      }),
    ).toThrow('evaluated reward producer');
  });

  it('resolves evaluated Hub incoming and local owners through their exact semantic addresses', () => {
    const project = createRepresentativeNOPQProject();
    const assembly = simulateProjectAssembly(catalog, project);
    const hubOccurrence = occurrence(project, 'Surface', 'N', 'N_Combat05');
    const incoming = countedRewardTypeDomain(
      catalog,
      assembly,
      createIncomingRewardAddress(nBiome, hubOccurrence.occurrenceId),
      countedBinding('N_Combat05'),
    );
    const group = catalog.rooms.byKey.N_Combat05?.localChildren.find(
      (candidate) => candidate.kind === 'fixedRoomSlots',
    );
    const slot = group?.kind === 'fixedRoomSlots' ? group.slots[0] : undefined;
    const sideRoom = slot === undefined ? undefined : catalog.rooms.byKey[slot.roomGameName];
    if (
      group?.kind !== 'fixedRoomSlots' ||
      slot === undefined ||
      sideRoom?.incomingReward.kind !== 'countedChoice'
    ) {
      throw new Error('Hub local reward declaration is missing');
    }
    const local = countedRewardTypeDomain(
      catalog,
      assembly,
      createIncomingRewardAddress(nBiome, nLocalOccurrenceId('combat05', slot.slotKey)),
      sideRoom.incomingReward,
    );

    expect(incoming).toContain('MaxHealthDropBig');
    expect(local).toContain('MaxHealthDropSmall');

    expect(
      resolveCountedRewardTypeDomain(
        catalog,
        project,
        createIncomingRewardAddress(nBiome, hubOccurrence.occurrenceId),
        countedBinding('N_Combat05'),
        undefined,
      ),
    ).toContain('MaxHealthDropBig');

    const ordinaryStore = catalog.rewards.stores.byKey.SubRoomRewards;
    const hardStore = catalog.rewards.stores.byKey.SubRoomRewardsHard;
    if (ordinaryStore === undefined || hardStore === undefined) {
      throw new Error('side-room reward stores are missing');
    }
    const fallbackBinding = Object.freeze({
      ...sideRoom.incomingReward,
      storeKeys: Object.freeze(['SubRoomRewards', 'SubRoomRewardsHard']),
      allowedRewardTypes: Object.freeze([
        ...new Set(
          [...ordinaryStore.entries, ...hardStore.entries].map((entry) => entry.rewardType),
        ),
      ]),
    });
    const fallbackCatalog = catalogWithRoom(
      Object.freeze({
        ...sideRoom,
        incomingReward: fallbackBinding,
        forcedRewardStoreKey: 'SubRoomRewardsHard',
        individualRewardStoreKey: 'SubRoomRewards',
      }),
    );
    const fallbackLocal = resolveCountedRewardTypeDomain(
      fallbackCatalog,
      project,
      createIncomingRewardAddress(nBiome, nLocalOccurrenceId('combat05', slot.slotKey)),
      fallbackBinding,
      undefined,
    );
    expect(fallbackLocal).toContain('MaxHealthDrop');
    expect(fallbackLocal).not.toContain('MaxHealthDropSmall');
  });

  it('uses authored fallback for blocked base, individual, free-reward, and wheel owners', () => {
    const underworld = withBlockedUnderworldSuffix(createGoldenFGHIProject());
    const underworldAssembly = simulateProjectAssembly(catalog, underworld);
    const fOwner = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(2, 1));
    expect(
      countedRewardTypeDomain(catalog, underworldAssembly, fOwner, countedBinding('F_Combat03')),
    ).toContain('MaxHealthDrop');

    const fields = occurrence(underworld, 'Underworld', 'H', 'H_Combat02');
    const cages = catalog.rooms.byKey.H_Combat02?.localChildren.find(
      (candidate) => candidate.kind === 'boundedRewardSlots',
    );
    if (cages?.kind !== 'boundedRewardSlots') throw new Error('Fields cages are missing');
    expect(
      countedRewardTypeDomain(
        catalog,
        underworldAssembly,
        createLocalRewardAddress(
          createBiomeAddress('Underworld', 'H'),
          fields.occurrenceId,
          cages.key,
          'cage1',
        ),
        cages.reward,
      ),
    ).toContain('MaxHealthDrop');

    const fPlan = plan(underworld, 'Underworld', 'F');
    const freeReward = fPlan.topology?.occurrences.find(
      (candidate) => candidate.state.kind === 'freeReward',
    );
    const preboss = catalog.rooms.byKey.F_PreBoss01;
    const remaining =
      preboss?.prebossBatchPolicy?.kind === 'takeOverNormalDoors' &&
      preboss.prebossBatchPolicy.remainingOffers.kind === 'counted'
        ? preboss.prebossBatchPolicy.remainingOffers.reward
        : undefined;
    if (freeReward === undefined || remaining === undefined) {
      throw new Error('F free-reward takeover is missing');
    }
    expect(
      countedRewardTypeDomain(
        catalog,
        underworldAssembly,
        createIncomingRewardAddress(goldenFBiome, freeReward.occurrenceId),
        remaining,
      ),
    ).toContain('StackUpgrade');

    const surface = withIncompleteHubVisits(createRepresentativeNOPQProject());
    expect(
      countedRewardTypeDomain(
        catalog,
        simulateProjectAssembly(catalog, surface),
        createRewardWheelOfferAddress(oBiome, oOccurrenceIds.combat04, 'wheel1', 'offer1'),
        shipWheelBinding(),
      ),
    ).toContain('MaxHealthDrop');

    const retainedHub = withRetainedHubBehindMissingLink(createRepresentativeNOPQProject());
    const retainedHubOccurrence = occurrence(retainedHub, 'Surface', 'N', 'N_Combat05');
    expect(
      countedRewardTypeDomain(
        catalog,
        simulateProjectAssembly(catalog, retainedHub),
        createIncomingRewardAddress(nBiome, retainedHubOccurrence.occurrenceId),
        countedBinding('N_Combat05'),
      ),
    ).toContain('MaxHealthDropBig');
    void nOccurrenceId;
  });

  it('uses the last active source wheel for an absent sourceOfferPoint producer', () => {
    const testCatalog = oSourceOfferCatalog();
    const fixture = sourceOfferPointProject(testCatalog);
    const domain = resolveCountedRewardTypeDomain(
      testCatalog,
      fixture.project,
      createIncomingRewardAddress(oBiome, fixture.targetId),
      fixture.binding,
      undefined,
    );

    expect(domain).toContain('MetaCurrencyDrop');
    expect(domain).not.toContain('MaxHealthDrop');
  });

  it('applies a later forced target to every shared-store target in physical order', () => {
    const gBiome = createBiomeAddress('Underworld', 'G');
    const startId = createOccurrenceId('forced-shared-start');
    const sourceId = createOccurrenceId('forced-shared-source');
    const ordinaryId = createOccurrenceId('forced-shared-ordinary');
    const forcedMetaId = createOccurrenceId('forced-shared-meta');
    const forcedRunId = createOccurrenceId('forced-shared-run');
    let project = createProjectDocument(catalog, {
      projectId: 'forced-shared-domain',
      name: 'Forced shared domain',
      configuredBiomeCounts: { Underworld: 2 },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateStart',
      biome: gBiome,
      occurrenceId: startId,
    });
    const startSource = { kind: 'occurrence' as const, occurrenceId: startId };
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: createExitDecisionAddress(gBiome, startSource),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(gBiome, startSource),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(gBiome, startSource, 'exit1'),
      occurrenceId: sourceId,
      gameName: 'G_Combat02',
    });
    const source = { kind: 'occurrence' as const, occurrenceId: sourceId };
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: createExitDecisionAddress(gBiome, source),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(gBiome, source),
      storeKey: 'MetaProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(gBiome, source, 'exit1'),
      occurrenceId: ordinaryId,
      gameName: 'G_Reprieve01',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(gBiome, source, 'exit2'),
      occurrenceId: forcedMetaId,
      gameName: 'G_MiniBoss02',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(gBiome, source, 'exit3'),
      occurrenceId: forcedRunId,
      gameName: 'G_MiniBoss01',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(gBiome, source),
      value: { kind: 'normal', exitKey: 'exit1' },
    });
    project = withReversedBatchTargets(project, 'Underworld', 'G', sourceId);

    const metaForced = catalog.rooms.byKey.G_MiniBoss02;
    if (metaForced?.incomingReward.kind !== 'countedChoice') {
      throw new Error('G miniboss is missing');
    }
    const testCatalog = catalogWithRoom(
      Object.freeze({ ...metaForced, forcedRewardStoreKey: 'MetaProgress' }),
    );

    const domain = resolveCountedRewardTypeDomain(
      testCatalog,
      project,
      createIncomingRewardAddress(gBiome, ordinaryId),
      countedBinding('G_Reprieve01'),
      undefined,
    );
    expect(domain).toContain('MaxHealthDrop');
    expect(domain).not.toContain('MetaCurrencyDrop');
  });
});
