import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createTraitOfferAddress,
  applyProjectHistoryCommand,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createBiomeAddress,
  createLocalVisitOrderAddress,
  createLocalVisitSlotAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectHistory,
  createRoomActionAddress,
  decodeProjectDocument,
  defaultHermesShrineDeliveryReward,
  encodeProjectDocument,
  hermesShrineDeliveryEntryKey,
  parseHermesShrineDeliveryEntryKey,
  publishProjectHistoryEdit,
  roomActionDomainForOccurrence,
  roomActionKey,
  undoProjectHistory,
  type ProjectDocument,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';
import {
  createSurfaceNOHermesShrineDeliveryCheckpoint,
  loadSurfaceNOProject,
  loadSurfaceNOPQProject,
  nBiome as surfaceNBiome,
  nLocalOccurrenceId as surfaceNLocalOccurrenceId,
  nOccurrenceId as surfaceNOccurrenceId,
  oBiome,
  oOccurrenceIds,
  pBiome,
  qBiome,
  qOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import { createEnteredNLocalProject, nLocalOccurrenceId } from '../support/complete-n-project';
import { assessGeneratedPickupPlacement } from '../../../src/authored-project/generated-pickup-placement';
import { assessRoomActionPlacements } from '../../../src/simulation';
import { initializeTestRewardBranches } from '../../support/arcana-fear';
import { withTestEncounterRecord } from '../../support/simulation-state';
import type { CanonicalAuthoredRoom } from '../../../src/simulation/materialization';
import { applyEncounterEndEffectsTransition } from '../../../src/simulation/rewards/biome/lifecycle-transitions/encounter-end-effects';
import {
  hermesShrineDeliveryPlacementForPurchaseReschedule,
  settleProjectEdit,
  simulateProjectAssembly,
} from '../../../src/simulation';
import {
  assembleExecutionProduct,
  compileExecutionPlan,
  encodeExecutionPlan,
} from '../../../src/execution-plan';

function shrinePhase(
  slotKey: string,
  authoredChoiceKey: string,
  envelopeKey = 'SingleEncounter',
): CanonicalAuthoredRoom['encounterPhases'][number] {
  return {
    slotKey,
    envelopeKey,
    authoredChoiceKey,
    figLeafSkip: false,
  };
}

function projectWithUnrankedDeliveryHost() {
  const biome = createBiomeAddress('Surface', 'N');
  const sourceId = nLocalOccurrenceId('combat02', 'sideDoor1');
  const hostId = createOccurrenceId('round-trip-n-combat03');
  let project = createEnteredNLocalProject();
  const route = project.route;
  const plan = route?.biomes.find((candidate) => candidate.biomeKey === 'N');
  const source = plan?.topology?.occurrences.find(
    (candidate) => candidate.occurrenceId === sourceId,
  );
  if (route === undefined || plan?.topology === null || plan === undefined || source === undefined)
    throw new Error('failed to create Shrine placement fixture');
  const sourceOccurrence = Object.freeze({
    ...source,
    hermesShrine: Object.freeze({
      offerBySlot: Object.freeze({
        first: Object.freeze({ rewardType: 'HealBigDrop' }),
        secondLeft: null,
        secondRight: null,
      }),
      purchaseBySlot: Object.freeze({ first: Object.freeze({ delay: 2, rushed: false }) }),
    }),
  });
  const topology = Object.freeze({
    ...plan.topology,
    occurrences: Object.freeze(
      plan.topology.occurrences.map((candidate) =>
        candidate.occurrenceId === sourceId ? sourceOccurrence : candidate,
      ),
    ),
  });
  project = {
    ...project,
    route: Object.freeze({
      ...route,
      biomes: route.biomes.map((candidateBiome) =>
        candidateBiome.biomeKey === plan.biomeKey
          ? Object.freeze({ ...candidateBiome, topology })
          : candidateBiome,
      ),
    }),
  };
  return Object.freeze({
    project,
    biome,
    source: createOccurrenceAddress(biome, sourceId),
    host: createOccurrenceAddress(biome, hostId),
  });
}

describe('Hermes Shrine delivery placement', () => {
  it('counts ship intros toward a delivery that matures at the boss and publishes its pickup', () => {
    let project = createSurfaceNOHermesShrineDeliveryCheckpoint({ placeDelayedDelivery: false });
    const source = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    project = applyProjectCommand(project, catalog, {
      kind: 'SetHermesShrinePurchase',
      occurrence: source,
      generationKey: 'initial:secondLeft',
      purchase: { delay: 6, rushed: false },
    });
    const placement = hermesShrineDeliveryPlacementForPurchaseReschedule(
      simulateProjectAssembly(catalog, project),
      source,
      'initial:secondLeft',
    );
    expect(placement).toMatchObject({
      kind: 'PlaceHermesShrineDelivery',
      entry: { site: { owner: { occurrenceId: 'surface-o-preboss:boss' } } },
      encounterPhaseKey: 'Encounter',
    });
    if (placement === undefined) throw new Error('boss delivery placement missing');
    project = applyProjectCommand(project, catalog, placement);
    const product = assembleExecutionProduct({
      assembly: simulateProjectAssembly(catalog, project),
      catalog,
    });
    const boss = product.occurrences.find((room) => room.id === 'surface-o-preboss:boss');
    expect(boss?.timeline.transactions).toContainEqual(
      expect.objectContaining({
        kind: 'acquisition',
        hermesShrineSourceKey: hermesShrineDeliveryEntryKey(source, 'initial:secondLeft'),
      }),
    );
    expect(() => encodeExecutionPlan(compileExecutionPlan({ product }))).not.toThrow();
  });

  it('matures a delayed P Postboss Shrine delivery at final Q Preboss entry', () => {
    const source = createOccurrenceAddress(
      pBiome,
      createOccurrenceId('surface-p-preboss-shop:postboss'),
    );
    let project = loadSurfaceNOPQProject();
    for (const [slotKey, rewardType] of [
      ['first', 'HealBigDrop'],
      ['secondLeft', 'MaxHealthDrop'],
      ['secondRight', 'MaxManaDrop'],
    ] as const) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceHermesShrineOffer',
        occurrence: source,
        slotKey,
        value: { rewardType },
      });
    }
    project = applyProjectCommand(project, catalog, {
      kind: 'SetHermesShrinePurchase',
      occurrence: source,
      generationKey: 'initial:secondRight',
      purchase: { delay: 8, rushed: false },
    });
    const assembly = simulateProjectAssembly(catalog, project);
    const placement = hermesShrineDeliveryPlacementForPurchaseReschedule(
      assembly,
      source,
      'initial:secondRight',
    );
    expect(placement).toEqual({
      kind: 'PlaceHermesShrineDelivery',
      entry: createAcquisitionEntryAddress(
        createAcquisitionSiteAddress(
          createOccurrenceAddress(qBiome, qOccurrenceIds.preboss),
          'hermesShrineDelivery',
        ),
        hermesShrineDeliveryEntryKey(source, 'initial:secondRight'),
      ),
    });
    if (placement === undefined) throw new Error('final Preboss placement missing');
    project = applyProjectCommand(project, catalog, placement);
    const settled = simulateProjectAssembly(catalog, project);
    expect(settled.evaluation.status).toBe('valid');
    const product = assembleExecutionProduct({ assembly: settled, catalog });
    expect(
      product.occurrences.find((room) => room.id === qOccurrenceIds.preboss)?.timeline.transactions,
    ).toContainEqual(
      expect.objectContaining({
        kind: 'acquisition',
        hermesShrineSourceKey: placement.entry.entryKey,
        window: { kind: 'postOutgoing' },
      }),
    );
    expect(() => encodeExecutionPlan(compileExecutionPlan({ product }))).not.toThrow();

    const wrongPhase = applyProjectCommand(project, catalog, {
      ...placement,
      encounterPhaseKey: 'Encounter',
    });
    const repair = hermesShrineDeliveryPlacementForPurchaseReschedule(
      simulateProjectAssembly(catalog, wrongPhase),
      source,
      'initial:secondRight',
    );
    expect(repair).toEqual(placement);
    const repaired = applyProjectCommand(wrongPhase, catalog, repair!);
    const roundTrip = decodeProjectDocument(JSON.parse(encodeProjectDocument(repaired)), catalog);
    expect(simulateProjectAssembly(catalog, roundTrip).evaluation.status).toBe('valid');
  });

  it('materializes and ranks a due delivery at a host without an acquisition site', () => {
    const { project, biome, source, host } = projectWithUnrankedDeliveryHost();
    const entryKey = hermesShrineDeliveryEntryKey(source, 'initial:first');
    const entry = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(host, 'hermesShrineDelivery'),
      entryKey,
    );
    const placed = applyProjectCommand(project, catalog, {
      kind: 'PlaceHermesShrineDelivery',
      entry,
      encounterPhaseKey: 'Encounter',
    });
    const placedHost = placed.route.biomes
      .find((candidate) => candidate.biomeKey === biome.biomeKey)
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === host.occurrenceId);
    expect(placedHost?.roomActions.order).toContainEqual({
      kind: 'interactAcquisitionEntry',
      siteKey: 'hermesShrineDelivery',
      entryKey,
      encounterPhaseKey: 'Encounter',
    });
    expect(
      placedHost?.acquisitionSites?.hermesShrineDelivery?.pickupEntries?.[entryKey],
    ).toMatchObject({ offer: { rewardType: 'HealBigDrop' } });
    const decoded = decodeProjectDocument(
      JSON.parse(encodeProjectDocument(placed)) as unknown,
      catalog,
    );
    const decodedHost = decoded.route.biomes
      .find((candidate) => candidate.biomeKey === biome.biomeKey)
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === host.occurrenceId);
    expect(decodedHost?.roomActions.order).toContainEqual({
      kind: 'interactAcquisitionEntry',
      siteKey: 'hermesShrineDelivery',
      entryKey,
      encounterPhaseKey: 'Encounter',
    });
  });

  it('retracts an actual matured Shrine delivery from its later host while retaining payload', () => {
    let project = createSurfaceNOHermesShrineDeliveryCheckpoint({ placeDelayedDelivery: false });
    const source = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const host = createOccurrenceAddress(oBiome, oOccurrenceIds.devotion);
    const entryKey = hermesShrineDeliveryEntryKey(source, 'initial:first');
    const delayedEntryKey = hermesShrineDeliveryEntryKey(source, 'initial:secondLeft');
    const placement = hermesShrineDeliveryPlacementForPurchaseReschedule(
      simulateProjectAssembly(catalog, project),
      source,
      'initial:secondLeft',
    );
    if (placement === undefined)
      throw new Error('matured Shrine delivery did not publish an exact placement frontier');
    project = applyProjectCommand(project, catalog, placement);
    expect(() => simulateProjectAssembly(catalog, project)).not.toThrow();
    const removed = applyProjectCommand(project, catalog, {
      kind: 'SetHermesShrinePresence',
      occurrence: source,
      present: false,
    });
    expect(() => simulateProjectAssembly(catalog, removed)).not.toThrow();
    const removedHost = removed.route.biomes
      .find((candidate) => candidate.biomeKey === oBiome.biomeKey)
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === host.occurrenceId);
    const activeDeliveryKeys = removed.route.biomes.flatMap((biome) =>
      (biome.topology?.occurrences ?? []).flatMap((occurrence) =>
        occurrence.roomActions.order.flatMap((reference) =>
          reference.kind === 'interactAcquisitionEntry' &&
          reference.siteKey === 'hermesShrineDelivery'
            ? [reference.entryKey]
            : [],
        ),
      ),
    );
    expect(activeDeliveryKeys).not.toContain(entryKey);
    expect(activeDeliveryKeys).not.toContain(delayedEntryKey);
    expect(
      removedHost?.acquisitionSites?.hermesShrineDelivery?.pickupEntries?.[delayedEntryKey],
    ).toMatchObject({ offer: { rewardType: 'MaxHealthDrop' } });
  });

  it('retracts an actual delayed delivery when room replacement removes its source Shrine', () => {
    let project = createSurfaceNOHermesShrineDeliveryCheckpoint({ placeDelayedDelivery: false });
    const source = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const host = createOccurrenceAddress(oBiome, oOccurrenceIds.devotion);
    const entryKey = hermesShrineDeliveryEntryKey(source, 'initial:secondLeft');
    const placement = hermesShrineDeliveryPlacementForPurchaseReschedule(
      simulateProjectAssembly(catalog, project),
      source,
      'initial:secondLeft',
    );
    if (placement === undefined)
      throw new Error('matured Shrine delivery did not publish an exact placement frontier');
    project = applyProjectCommand(project, catalog, placement);
    const hostBeforeReplacement = project.route.biomes
      .find((biome) => biome.biomeKey === oBiome.biomeKey)
      ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === host.occurrenceId);
    expect(hostBeforeReplacement?.roomActions.order).toContainEqual(
      expect.objectContaining({
        kind: 'interactAcquisitionEntry',
        siteKey: 'hermesShrineDelivery',
        entryKey,
      }),
    );

    const replaced = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: source,
      gameName: 'O_Combat01',
    });
    const sourceAfterReplacement = replaced.route.biomes
      .find((biome) => biome.biomeKey === oBiome.biomeKey)
      ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === source.occurrenceId);
    const hostAfterReplacement = replaced.route.biomes
      .find((biome) => biome.biomeKey === oBiome.biomeKey)
      ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === host.occurrenceId);

    expect(sourceAfterReplacement?.hermesShrine).toBeUndefined();
    expect(hostAfterReplacement?.roomActions.order).not.toContainEqual(
      expect.objectContaining({
        kind: 'interactAcquisitionEntry',
        siteKey: 'hermesShrineDelivery',
        entryKey,
      }),
    );
    expect(
      hostAfterReplacement?.acquisitionSites?.hermesShrineDelivery?.pickupEntries?.[entryKey],
    ).toMatchObject({ offer: { rewardType: 'MaxHealthDrop' } });
    expect(() => simulateProjectAssembly(catalog, replaced)).not.toThrow();
  });

  it('publishes a required derived footprint when a due host has no site', () => {
    const source = createOccurrenceAddress(
      createBiomeAddress('Surface', 'N'),
      createOccurrenceId('shrine-derived-source'),
    );
    const host = createOccurrenceAddress(
      createBiomeAddress('Surface', 'N'),
      createOccurrenceId('shrine-derived-host'),
    );
    const entryKey = hermesShrineDeliveryEntryKey(source, 'initial:first');
    const branch = initializeTestRewardBranches()[0]!;
    const pending = Object.freeze({
      ...branch,
      state: Object.freeze({
        ...branch.state,
        pendingHermesShrineDeliveries: Object.freeze({
          [entryKey]: Object.freeze({
            sourceKey: entryKey,
            sourceOrigin: source,
            generationKey: 'initial:first' as const,
            rewardType: 'HealBigDrop',
            remainingUses: 0,
            dueAt: host,
            dueSequence: 1,
          }),
        }),
      }),
    });
    const room = {
      kind: 'authored',
      origin: host,
      occurrenceId: host.occurrenceId,
      gameName: 'O_Combat04',
      lifecycleProfileKey: 'StandardRewardRoom',
      encounters: { steadyGrowthTargetByPhase: {} },
      encounterPhases: [shrinePhase('Combat1', 'GeneratedO', 'ShipEncounter')],
    } as unknown as CanonicalAuthoredRoom;
    const transition = applyEncounterEndEffectsTransition(
      catalog,
      {
        kind: 'encounterEndEffectsApplied',
        sequence: 2,
        operationIndex: 0,
        origin: host,
        phaseKey: 'Combat1',
        execution: 'normal',
        figLeafSkipOwner: false,
      },
      room,
      [withTestEncounterRecord(pending, room, 'Combat1', 'GeneratedO')],
    );

    expect(transition.findings).toContainEqual(
      expect.objectContaining({
        finding: expect.objectContaining({
          code: 'hermesShrineDeliveryPlacementRequired',
          origin: expect.objectContaining({ kind: 'acquisitionEntry', entryKey }),
        }),
      }),
    );
    expect(transition.derivedAcquisitionEntryFrontiers).toContainEqual(
      expect.objectContaining({
        kind: 'hermesShrineDelivery',
        address: expect.objectContaining({ kind: 'acquisitionEntry', entryKey }),
        encounterPhaseKey: 'Combat1',
      }),
    );
  });

  it('does not advance a side-room source and matures it at a later main-room encounter', () => {
    const source = createOccurrenceAddress(
      createBiomeAddress('Surface', 'N'),
      createOccurrenceId('n-sub10-source'),
    );
    const host = createOccurrenceAddress(
      createBiomeAddress('Surface', 'N'),
      createOccurrenceId('n-main-host'),
    );
    const entryKey = hermesShrineDeliveryEntryKey(source, 'initial:first');
    const branch = initializeTestRewardBranches()[0]!;
    const pending = Object.freeze({
      ...branch,
      state: Object.freeze({
        ...branch.state,
        pendingHermesShrineDeliveries: Object.freeze({
          [entryKey]: Object.freeze({
            sourceKey: entryKey,
            sourceOrigin: source,
            generationKey: 'initial:first' as const,
            rewardType: 'HealBigDrop',
            remainingUses: 2,
          }),
        }),
      }),
    });
    const roomFor = (gameName: string, lifecycleProfileKey: string) =>
      ({
        kind: 'authored',
        origin: gameName === 'N_Sub10' ? source : host,
        occurrenceId: (gameName === 'N_Sub10' ? source : host).occurrenceId,
        gameName,
        lifecycleProfileKey,
        encounters: { steadyGrowthTargetByPhase: {} },
        encounterPhases: [
          shrinePhase(
            'Encounter',
            gameName === 'N_Sub10' ? 'GeneratedNSubRoom_Bigger' : 'GeneratedN_Bigger',
          ),
        ],
      }) as unknown as CanonicalAuthoredRoom;
    const endEffects = (origin: typeof source, sequence: number) => ({
      kind: 'encounterEndEffectsApplied' as const,
      sequence,
      operationIndex: 0,
      origin,
      phaseKey: 'Encounter',
      execution: 'normal' as const,
      figLeafSkipOwner: false,
    });

    const sideRoom = applyEncounterEndEffectsTransition(
      catalog,
      endEffects(source, 1),
      roomFor('N_Sub10', 'EphyraSideRoom'),
      [
        withTestEncounterRecord(
          pending,
          roomFor('N_Sub10', 'EphyraSideRoom'),
          'Encounter',
          'GeneratedNSubRoom_Bigger',
        ),
      ],
    );
    expect(sideRoom.branches[0]?.state.pendingHermesShrineDeliveries[entryKey]).toMatchObject({
      sourceOrigin: source,
      remainingUses: 2,
    });
    expect(sideRoom.derivedAcquisitionEntryFrontiers).toEqual([]);

    const firstMainEncounter = applyEncounterEndEffectsTransition(
      catalog,
      endEffects(host, 2),
      roomFor('N_Combat01', 'EphyraCombat'),
      sideRoom.branches.map((branch) =>
        withTestEncounterRecord(
          branch,
          roomFor('N_Combat01', 'EphyraCombat'),
          'Encounter',
          'GeneratedN_Bigger',
        ),
      ),
    );
    expect(
      firstMainEncounter.branches[0]?.state.pendingHermesShrineDeliveries[entryKey],
    ).toMatchObject({
      sourceOrigin: source,
      remainingUses: 1,
    });

    const dueMainEncounter = applyEncounterEndEffectsTransition(
      catalog,
      endEffects(host, 3),
      roomFor('N_Combat01', 'EphyraCombat'),
      firstMainEncounter.branches,
    );
    expect(
      dueMainEncounter.branches[0]?.state.pendingHermesShrineDeliveries[entryKey],
    ).toMatchObject({
      sourceOrigin: source,
      remainingUses: 0,
      dueAt: host,
    });
    expect(parseHermesShrineDeliveryEntryKey(entryKey)?.sourceOccurrenceId).toBe(
      source.occurrenceId,
    );
    expect(dueMainEncounter.derivedAcquisitionEntryFrontiers).toContainEqual(
      expect.objectContaining({
        encounterPhaseKey: 'Encounter',
        address: expect.objectContaining({ entryKey }),
      }),
    );
  });

  it('requires the exact due-phase action even when the retained delivery entry exists', () => {
    const source = createOccurrenceAddress(
      createBiomeAddress('Surface', 'N'),
      createOccurrenceId('retained-source'),
    );
    const host = createOccurrenceAddress(
      createBiomeAddress('Surface', 'O'),
      createOccurrenceId('retained-host'),
    );
    const entryKey = hermesShrineDeliveryEntryKey(source, 'initial:first');
    const branch = initializeTestRewardBranches()[0]!;
    const pending = Object.freeze({
      ...branch,
      state: Object.freeze({
        ...branch.state,
        pendingHermesShrineDeliveries: Object.freeze({
          [entryKey]: Object.freeze({
            sourceKey: entryKey,
            sourceOrigin: source,
            generationKey: 'initial:first' as const,
            rewardType: 'HealBigDrop',
            remainingUses: 0,
            dueAt: host,
            dueSequence: 1,
          }),
        }),
      }),
    });
    const room = {
      kind: 'authored',
      origin: host,
      occurrenceId: host.occurrenceId,
      gameName: 'O_Combat04',
      lifecycleProfileKey: 'StandardRewardRoom',
      encounters: { steadyGrowthTargetByPhase: {} },
      encounterPhases: [shrinePhase('Combat1', 'GeneratedO', 'ShipEncounter')],
      acquisitionSites: {
        hermesShrineDelivery: {
          entries: {
            [entryKey]: defaultHermesShrineDeliveryReward(catalog, 'HealBigDrop', 'Surface'),
          },
        },
      },
      roomActionRoster: { rows: [] },
    } as unknown as CanonicalAuthoredRoom;
    const transition = applyEncounterEndEffectsTransition(
      catalog,
      {
        kind: 'encounterEndEffectsApplied',
        sequence: 2,
        operationIndex: 0,
        origin: host,
        phaseKey: 'Combat1',
        execution: 'normal',
        figLeafSkipOwner: false,
      },
      room,
      [withTestEncounterRecord(pending, room, 'Combat1', 'GeneratedO')],
    );
    expect(transition.findings).toContainEqual(
      expect.objectContaining({
        finding: expect.objectContaining({ code: 'hermesShrineDeliveryPlacementRequired' }),
      }),
    );
  });

  it('repairs a stale due phase in place without duplicating the delivery action', () => {
    const { project, biome, source, host } = projectWithUnrankedDeliveryHost();
    const entryKey = hermesShrineDeliveryEntryKey(source, 'initial:first');
    const entry = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(host, 'hermesShrineDelivery'),
      entryKey,
    );
    const placed = applyProjectCommand(project, catalog, {
      kind: 'PlaceHermesShrineDelivery',
      entry,
      encounterPhaseKey: 'Encounter',
    });
    const repaired = applyProjectCommand(placed, catalog, {
      kind: 'PlaceHermesShrineDelivery',
      entry,
      encounterPhaseKey: 'LaterEncounter',
    });
    const repairedHost = repaired.route.biomes
      .find((candidate) => candidate.biomeKey === biome.biomeKey)
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === host.occurrenceId);
    const deliveryActions = repairedHost?.roomActions.order.filter(
      (reference) =>
        reference.kind === 'interactAcquisitionEntry' && reference.entryKey === entryKey,
    );
    expect(deliveryActions).toEqual([
      {
        kind: 'interactAcquisitionEntry',
        siteKey: 'hermesShrineDelivery',
        entryKey,
        encounterPhaseKey: 'LaterEncounter',
      },
    ]);
  });
});

type RosterRoom = {
  readonly occurrenceId: string;
  readonly roomActionRoster: import('../../../src/simulation').RoomActionRoster;
};

/** Test-only observation: locate one materialized room by occurrence id anywhere in the evaluation. */
function materializedRoom(project: ProjectDocument, occurrenceId: string): RosterRoom {
  const visited = new Set<object>();
  const search = (value: unknown): RosterRoom | undefined => {
    if (typeof value !== 'object' || value === null || visited.has(value)) return undefined;
    visited.add(value);
    if (
      'roomActionRoster' in value &&
      'occurrenceId' in value &&
      (value as RosterRoom).occurrenceId === occurrenceId
    )
      return value as RosterRoom;
    for (const child of Object.values(value)) {
      const found = search(child);
      if (found !== undefined) return found;
    }
    return undefined;
  };
  const found = search(simulateProjectAssembly(catalog, project).evaluation.route);
  if (found === undefined) throw new Error(`${occurrenceId} was not materialized`);
  return found;
}

function occurrenceOf(project: ProjectDocument, biomeKey: string, occurrenceId: string) {
  const occurrence = project.route.biomes
    .find((candidate) => candidate.biomeKey === biomeKey)
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId);
  if (occurrence === undefined) throw new Error(`${occurrenceId} is missing`);
  return occurrence;
}

function orderedDeliveryKeys(project: ProjectDocument, biomeKey: string, occurrenceId: string) {
  return occurrenceOf(project, biomeKey, occurrenceId).roomActions.order.flatMap((reference) =>
    reference.kind === 'interactAcquisitionEntry' && reference.siteKey === 'hermesShrineDelivery'
      ? [reference.entryKey]
      : [],
  );
}

function staleDeliveryFindings(project: ProjectDocument) {
  return simulateProjectAssembly(catalog, project).evaluation.findings.filter(
    (finding) =>
      finding.code === 'rewardSourceUnavailable' &&
      (finding.evidence as { reason?: string } | undefined)?.reason === 'staleHermesShrineDelivery',
  );
}

function deliveryAction(entryKey: string, encounterPhaseKey = 'Encounter'): RoomActionReference {
  return {
    kind: 'interactAcquisitionEntry',
    siteKey: 'hermesShrineDelivery',
    entryKey,
    encounterPhaseKey,
  };
}

/** Entered N side-room Shrine with two delayed purchases placed in a later main room. */
function projectWithTwoSideRoomDeliveries() {
  const biome = createBiomeAddress('Surface', 'N');
  const parentId = createOccurrenceId('round-trip-n-combat02');
  const sourceId = nLocalOccurrenceId('combat02', 'sideDoor1');
  const hostId = createOccurrenceId('round-trip-n-combat04');
  const base = createEnteredNLocalProject();
  const plan = base.route.biomes.find((candidate) => candidate.biomeKey === 'N');
  const sourceOccurrence = plan?.topology?.occurrences.find(
    (candidate) => candidate.occurrenceId === sourceId,
  );
  if (plan?.topology == null || sourceOccurrence === undefined)
    throw new Error('failed to create side-room Shrine fixture');
  const withShrine = Object.freeze({
    ...sourceOccurrence,
    hermesShrine: Object.freeze({
      offerBySlot: Object.freeze({
        first: Object.freeze({ rewardType: 'HealBigDrop' }),
        secondLeft: Object.freeze({ rewardType: 'MaxHealthDrop' }),
        secondRight: Object.freeze({ rewardType: 'MaxManaDrop' }),
      }),
      purchaseBySlot: Object.freeze({
        first: Object.freeze({ delay: 2, rushed: false }),
        secondLeft: Object.freeze({ delay: 2, rushed: false }),
      }),
    }),
  });
  let project: ProjectDocument = Object.freeze({
    ...base,
    route: Object.freeze({
      ...base.route,
      biomes: base.route.biomes.map((candidate) =>
        candidate.biomeKey !== 'N'
          ? candidate
          : Object.freeze({
              ...candidate,
              topology: Object.freeze({
                ...plan.topology!,
                occurrences: Object.freeze(
                  plan.topology!.occurrences.map((occurrence) =>
                    occurrence.occurrenceId === sourceId ? withShrine : occurrence,
                  ),
                ),
              }),
            }),
      ),
    }),
  });
  const source = createOccurrenceAddress(biome, sourceId);
  const host = createOccurrenceAddress(biome, hostId);
  const entryKeys = (['initial:first', 'initial:secondLeft'] as const).map((generationKey) =>
    hermesShrineDeliveryEntryKey(source, generationKey),
  );
  for (const entryKey of entryKeys) {
    project = applyProjectCommand(project, catalog, {
      kind: 'PlaceHermesShrineDelivery',
      entry: createAcquisitionEntryAddress(
        createAcquisitionSiteAddress(host, 'hermesShrineDelivery'),
        entryKey,
      ),
      encounterPhaseKey: 'Encounter',
    });
  }
  return Object.freeze({
    project,
    biome,
    source,
    host,
    entryKeys,
    visitOrder: createLocalVisitOrderAddress(biome, parentId, 'sideRooms'),
    visitSlot: createLocalVisitSlotAddress(biome, parentId, 'sideRooms', 'sideDoor1'),
  });
}

/** Directly stored topology edit standing in for a saved project whose source no longer participates. */
function withSideRoomWithdrawn(
  project: ProjectDocument,
  sourceId: string,
  generation: 'generated' | 'notGenerated',
): ProjectDocument {
  const edited = Object.freeze({
    ...project,
    route: Object.freeze({
      ...project.route,
      biomes: project.route.biomes.map((plan) =>
        plan.biomeKey !== 'N' || plan.topology === null
          ? plan
          : Object.freeze({
              ...plan,
              topology: Object.freeze({
                ...plan.topology,
                decisions: Object.freeze(
                  plan.topology.decisions.map((decision) =>
                    decision.kind !== 'localVisit' ||
                    !decision.visitOrder.includes(sourceId as never)
                      ? decision
                      : Object.freeze({
                          ...decision,
                          visitOrder: Object.freeze(
                            decision.visitOrder.filter((candidate) => candidate !== sourceId),
                          ),
                          targetsBySlot: Object.freeze(
                            Object.fromEntries(
                              Object.entries(decision.targetsBySlot).map(([slotKey, target]) => [
                                slotKey,
                                target.occurrenceId === sourceId
                                  ? Object.freeze({ ...target, generation })
                                  : target,
                              ]),
                            ),
                          ),
                        }),
                  ),
                ),
              }),
            }),
      ),
    }),
  });
  return decodeProjectDocument(JSON.parse(encodeProjectDocument(edited)) as unknown, catalog);
}

describe('Hermes Shrine delivery source participation', () => {
  it('retracts both deliveries when their side-room source leaves the visit order and keeps the purchases', () => {
    const { project, biome, source, host, entryKeys, visitOrder, visitSlot } =
      projectWithTwoSideRoomDeliveries();
    expect(orderedDeliveryKeys(project, biome.biomeKey, host.occurrenceId)).toEqual(entryKeys);
    expect(
      assessGeneratedPickupPlacement(project.route, host, deliveryAction(entryKeys[0]!))?.kind,
    ).toBe('unassessed');

    const withdrawn = applyProjectCommand(project, catalog, {
      kind: 'ReplaceLocalVisitOrder',
      order: visitOrder,
      occurrenceIds: [],
    });
    expect(orderedDeliveryKeys(withdrawn, biome.biomeKey, host.occurrenceId)).toEqual([]);
    expect(
      occurrenceOf(withdrawn, biome.biomeKey, source.occurrenceId).hermesShrine?.purchaseBySlot,
    ).toEqual({ first: { delay: 2, rushed: false }, secondLeft: { delay: 2, rushed: false } });
    for (const entryKey of entryKeys) {
      expect(
        occurrenceOf(withdrawn, biome.biomeKey, host.occurrenceId).acquisitionSites
          ?.hermesShrineDelivery?.pickupEntries?.[entryKey],
      ).toBeDefined();
    }
    expect(() => simulateProjectAssembly(catalog, withdrawn)).not.toThrow();

    const notGenerated = applyProjectCommand(withdrawn, catalog, {
      kind: 'SetLocalVisitGeneration',
      slot: visitSlot,
      generation: 'notGenerated',
    });
    expect(orderedDeliveryKeys(notGenerated, biome.biomeKey, host.occurrenceId)).toEqual([]);

    let restored = applyProjectCommand(notGenerated, catalog, {
      kind: 'SetLocalVisitGeneration',
      slot: visitSlot,
      generation: 'generated',
    });
    restored = applyProjectCommand(restored, catalog, {
      kind: 'ReplaceLocalVisitOrder',
      order: visitOrder,
      occurrenceIds: [source.occurrenceId],
    });
    // Retained payload is not a structural reference, so the delta reconciliation
    // places nothing; the simulator's exact due capability re-places the purchase.
    expect(orderedDeliveryKeys(restored, biome.biomeKey, host.occurrenceId)).toEqual([]);
    const placement = hermesShrineDeliveryPlacementForPurchaseReschedule(
      simulateProjectAssembly(catalog, restored),
      source,
      'initial:first',
    );
    expect(placement).toMatchObject({ kind: 'PlaceHermesShrineDelivery' });
    const replaced = applyProjectCommand(restored, catalog, placement!);
    expect(
      replaced.route.biomes.flatMap((plan) =>
        (plan.topology?.occurrences ?? []).flatMap((occurrence) =>
          orderedDeliveryKeys(replaced, plan.biomeKey, occurrence.occurrenceId),
        ),
      ),
    ).toContain(entryKeys[0]);
  });

  it.each([
    ['removed from the visit order', 'generated'],
    ['not generated', 'notGenerated'],
  ] as const)(
    'treats a loaded source that is %s as invalid placement with a bounded unplace repair',
    (_label, generation) => {
      const { project, biome, source, host, entryKeys } = projectWithTwoSideRoomDeliveries();
      const loaded = withSideRoomWithdrawn(project, source.occurrenceId, generation);
      expect(orderedDeliveryKeys(loaded, biome.biomeKey, host.occurrenceId)).toEqual(entryKeys);
      expect(
        assessGeneratedPickupPlacement(loaded.route, host, deliveryAction(entryKeys[0]!))?.kind,
      ).toBe('invalid');

      const domain = roomActionDomainForOccurrence(
        loaded,
        catalog,
        biome,
        host.occurrenceId,
      )?.domain;
      const contributionKeys = domain?.contributions.flatMap((entry) =>
        entry.kind === 'action' ? [roomActionKey(entry.reference)] : [],
      );
      for (const entryKey of entryKeys) {
        expect(contributionKeys).toContain(roomActionKey(deliveryAction(entryKey)));
        expect(() =>
          applyProjectCommand(loaded, catalog, {
            kind: 'RemoveRoomAction',
            action: createRoomActionAddress(
              biome,
              host.occurrenceId,
              roomActionKey(deliveryAction(entryKey)),
            ),
          }),
        ).toThrow('active required room action cannot be removed');
      }

      const materialized = materializedRoom(loaded, host.occurrenceId);
      const room = {
        ...materialized,
        roomActionRoster: assessRoomActionPlacements(
          loaded.route,
          host,
          materialized.roomActionRoster,
        ),
      };
      for (const entryKey of entryKeys) {
        const key = roomActionKey(deliveryAction(entryKey));
        expect(room.roomActionRoster.rows.find((row) => row.key === key)).toMatchObject({
          placementAssessment: { kind: 'invalid' },
        });
        expect(room.roomActionRoster.proposals).toContainEqual(
          expect.objectContaining({ kind: 'unplace', reference: deliveryAction(entryKey) }),
        );
      }

      let history = createProjectHistory(loaded);
      for (const entryKey of entryKeys) {
        history = applyProjectHistoryCommand(history, catalog, {
          kind: 'UnplaceGeneratedDelivery',
          action: createRoomActionAddress(
            biome,
            host.occurrenceId,
            roomActionKey(deliveryAction(entryKey)),
          ),
        });
      }
      const removed = history.present;
      expect(orderedDeliveryKeys(removed, biome.biomeKey, host.occurrenceId)).toEqual([]);
      for (const entryKey of entryKeys) {
        expect(
          occurrenceOf(removed, biome.biomeKey, host.occurrenceId).acquisitionSites
            ?.hermesShrineDelivery?.pickupEntries?.[entryKey],
        ).toBeUndefined();
      }
      expect(staleDeliveryFindings(removed)).toEqual([]);

      history = undoProjectHistory(undoProjectHistory(history));
      expect(history.present).toBe(loaded);
      expect(orderedDeliveryKeys(history.present, biome.biomeKey, host.occurrenceId)).toEqual(
        entryKeys,
      );
    },
  );

  it('keeps an entered source required with its reward editor context and refuses removal', () => {
    const { project, biome, host, entryKeys } = projectWithTwoSideRoomDeliveries();
    const domain = roomActionDomainForOccurrence(
      project,
      catalog,
      biome,
      host.occurrenceId,
    )?.domain;
    for (const entryKey of entryKeys) {
      const key = roomActionKey(deliveryAction(entryKey));
      expect(
        domain?.contributions.find(
          (entry) => entry.kind === 'action' && roomActionKey(entry.reference) === key,
        ),
      ).toMatchObject({
        participation: 'required',
        owner: { kind: 'acquisitionEntry', entryKey },
      });
      expect(() =>
        applyProjectCommand(project, catalog, {
          kind: 'RemoveRoomAction',
          action: createRoomActionAddress(biome, host.occurrenceId, key),
        }),
      ).toThrow('active required room action cannot be removed');
    }
    const room = materializedRoom(project, host.occurrenceId);
    for (const entryKey of entryKeys) {
      expect(
        room.roomActionRoster.rows.find(
          (row) => row.key === roomActionKey(deliveryAction(entryKey)),
        ),
      ).toMatchObject({ stale: false });
    }
  });

  it('retracts a cross-biome delivery when its N side-room source leaves the visit order', () => {
    const parentId = surfaceNOccurrenceId('combat11');
    const source = createOccurrenceAddress(
      surfaceNBiome,
      surfaceNLocalOccurrenceId('combat11', 'sideDoor1'),
    );
    const host = createOccurrenceAddress(oBiome, oOccurrenceIds.devotion);
    const entryKey = hermesShrineDeliveryEntryKey(source, 'initial:first');
    let project = loadSurfaceNOProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'SetHermesShrinePresence',
      occurrence: source,
      present: true,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceHermesShrineOffer',
      occurrence: source,
      slotKey: 'first',
      value: { rewardType: 'HealBigDrop' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetHermesShrinePurchase',
      occurrence: source,
      generationKey: 'initial:first',
      purchase: { delay: 8, rushed: false },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'PlaceHermesShrineDelivery',
      entry: createAcquisitionEntryAddress(
        createAcquisitionSiteAddress(host, 'hermesShrineDelivery'),
        entryKey,
      ),
      encounterPhaseKey: 'Encounter',
    });
    expect(orderedDeliveryKeys(project, oBiome.biomeKey, host.occurrenceId)).toEqual([entryKey]);
    expect(
      roomActionDomainForOccurrence(project, catalog, oBiome, host.occurrenceId)?.domain
        .activeReferences,
    ).toContainEqual(deliveryAction(entryKey));

    const withdrawn = applyProjectCommand(project, catalog, {
      kind: 'ReplaceLocalVisitOrder',
      order: createLocalVisitOrderAddress(surfaceNBiome, parentId, 'sideRooms'),
      occurrenceIds: [],
    });
    expect(orderedDeliveryKeys(withdrawn, oBiome.biomeKey, host.occurrenceId)).toEqual([]);
    expect(
      occurrenceOf(withdrawn, oBiome.biomeKey, host.occurrenceId).acquisitionSites
        ?.hermesShrineDelivery?.pickupEntries?.[entryKey],
    ).toBeDefined();

    // The same stored state loaded without the command delta is stale and removable.
    const loaded = decodeProjectDocument(
      JSON.parse(
        encodeProjectDocument({
          ...withdrawn,
          route: {
            ...withdrawn.route,
            biomes: withdrawn.route.biomes.map((plan) =>
              plan.biomeKey !== oBiome.biomeKey || plan.topology === null
                ? plan
                : {
                    ...plan,
                    topology: {
                      ...plan.topology,
                      occurrences: plan.topology.occurrences.map((occurrence) =>
                        occurrence.occurrenceId !== host.occurrenceId
                          ? occurrence
                          : {
                              ...occurrence,
                              roomActions: {
                                order: [...occurrence.roomActions.order, deliveryAction(entryKey)],
                              },
                            },
                      ),
                    },
                  },
            ),
          },
        }),
      ) as unknown,
      catalog,
    );
    expect(orderedDeliveryKeys(loaded, oBiome.biomeKey, host.occurrenceId)).toEqual([entryKey]);
    expect(
      roomActionDomainForOccurrence(loaded, catalog, oBiome, host.occurrenceId)?.domain
        .activeReferences,
    ).toContainEqual(deliveryAction(entryKey));
    const removed = applyProjectCommand(loaded, catalog, {
      kind: 'UnplaceGeneratedDelivery',
      action: createRoomActionAddress(
        oBiome,
        host.occurrenceId,
        roomActionKey(deliveryAction(entryKey)),
      ),
    });
    expect(orderedDeliveryKeys(removed, oBiome.biomeKey, host.occurrenceId)).toEqual([]);
  });

  it('ranks a rushed delivery as optional loot that can be left behind', () => {
    const project = createSurfaceNOHermesShrineDeliveryCheckpoint();
    expect(simulateProjectAssembly(catalog, project).evaluation.status).toBe('valid');
    const source = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const rushedKey = hermesShrineDeliveryEntryKey(source, 'initial:first');
    const rushed = occurrenceOf(
      project,
      oBiome.biomeKey,
      source.occurrenceId,
    ).roomActions.order.find(
      (reference) =>
        reference.kind === 'interactAcquisitionEntry' && reference.entryKey === rushedKey,
    );
    expect(rushed).toBeDefined();
    const contribution = (document: ProjectDocument) =>
      roomActionDomainForOccurrence(
        document,
        catalog,
        oBiome,
        source.occurrenceId,
      )?.domain.contributions.find(
        (entry) =>
          entry.kind === 'action' && roomActionKey(entry.reference) === roomActionKey(rushed!),
      );
    expect(contribution(project)).toMatchObject({ participation: 'optional' });

    const removed = applyProjectCommand(project, catalog, {
      kind: 'RemoveRoomAction',
      action: createRoomActionAddress(oBiome, source.occurrenceId, roomActionKey(rushed!)),
    });
    const host = occurrenceOf(removed, oBiome.biomeKey, source.occurrenceId);
    expect(
      host.roomActions.order.some(
        (reference) => roomActionKey(reference) === roomActionKey(rushed!),
      ),
    ).toBe(false);
    expect(host.hermesShrine?.purchaseBySlot?.first).toEqual({ delay: 2, rushed: true });
    expect(host.acquisitionSites?.hermesShrineDelivery?.pickupEntries?.[rushedKey]).toMatchObject({
      offer: { rewardType: 'HealBigDrop' },
    });
    expect(contribution(removed)).toMatchObject({ participation: 'optional' });
    const roundTrip = decodeProjectDocument(JSON.parse(encodeProjectDocument(removed)), catalog);
    const evaluation = simulateProjectAssembly(catalog, roundTrip).evaluation;
    expect(evaluation.status).toBe('valid');
    const o = evaluation.route.biomes.find((biome) => biome.biomeKey === 'O');
    if (o?.authoring !== 'complete' || !('rewards' in o)) throw new Error('O rewards missing');
    // The abandoned item vanishes with its room instead of lingering as pending.
    expect(o.rewards.hermesShrineDeliveries.map((delivery) => delivery.sourceKey)).not.toContain(
      rushedKey,
    );
  });
});

describe('explicit generated delivery unplacement', () => {
  it('unplaces a live required delivery while preserving its due obligation and source purchase', () => {
    const project = createSurfaceNOHermesShrineDeliveryCheckpoint();
    const source = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const host = createOccurrenceAddress(oBiome, oOccurrenceIds.devotion);
    const entryKey = hermesShrineDeliveryEntryKey(source, 'initial:secondLeft');
    const reference = deliveryAction(entryKey);
    const removed = applyProjectCommand(project, catalog, {
      kind: 'UnplaceGeneratedDelivery',
      action: createRoomActionAddress(oBiome, host.occurrenceId, roomActionKey(reference)),
    });
    expect(occurrenceOf(removed, oBiome.biomeKey, source.occurrenceId).hermesShrine).toEqual(
      occurrenceOf(project, oBiome.biomeKey, source.occurrenceId).hermesShrine,
    );
    expect(
      occurrenceOf(removed, oBiome.biomeKey, host.occurrenceId).acquisitionSites
        ?.hermesShrineDelivery?.pickupEntries?.[entryKey],
    ).toBeUndefined();
    const assembly = simulateProjectAssembly(catalog, removed);
    expect(assembly.evaluation.findings).toContainEqual(
      expect.objectContaining({ code: 'hermesShrineDeliveryPlacementRequired' }),
    );
    expect(() => assembleExecutionProduct({ assembly, catalog })).toThrow();
    const roundtrip = decodeProjectDocument(
      JSON.parse(encodeProjectDocument(removed)) as unknown,
      catalog,
    );
    const edited = applyProjectCommand(roundtrip, catalog, {
      kind: 'ReplaceHermesShrineOffer',
      occurrence: source,
      slotKey: 'secondRight',
      value: { rewardType: 'ArmorBoost' },
    });
    expect(orderedDeliveryKeys(edited, oBiome.biomeKey, host.occurrenceId)).not.toContain(entryKey);
  });

  it('removes only the selected payload and trait children and restores the whole edit with Undo', () => {
    const { project: initial, biome, source, host, entryKeys } = projectWithTwoSideRoomDeliveries();
    const entryKey = entryKeys[1]!;
    const entry = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(host, 'hermesShrineDelivery'),
      entryKey,
    );
    let project = applyProjectCommand(initial, catalog, {
      kind: 'ReplaceHermesShrineOffer',
      occurrence: source,
      slotKey: 'secondLeft',
      value: { rewardType: 'ShopHermesUpgrade' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'PlaceHermesShrineDelivery',
      entry,
      encounterPhaseKey: 'Encounter',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry,
      value: { rewardType: 'ShopHermesUpgrade' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(entry, 'hermes'),
      value: {
        kind: 'traits',
        giverKey: 'Hermes',
        options: [
          { traitKey: 'HermesWeaponBoon', rarity: 'Common' },
          { traitKey: 'HermesSpecialBoon', rarity: 'Common' },
          { traitKey: 'SprintShieldBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    expect(
      occurrenceOf(project, biome.biomeKey, host.occurrenceId).acquisitionSites
        ?.hermesShrineDelivery?.pickupEntries?.[entryKey]?.traitOffersByAcquisitionRole?.hermes,
    ).toBeDefined();
    const history = applyProjectHistoryCommand(createProjectHistory(project), catalog, {
      kind: 'UnplaceGeneratedDelivery',
      action: createRoomActionAddress(
        biome,
        host.occurrenceId,
        roomActionKey(deliveryAction(entryKey)),
      ),
    });
    const after = occurrenceOf(history.present, biome.biomeKey, host.occurrenceId);
    expect(after.acquisitionSites?.hermesShrineDelivery?.pickupEntries?.[entryKey]).toBeUndefined();
    expect(after.acquisitionSites?.hermesShrineDelivery?.pickupEntries?.[entryKeys[0]!]).toEqual(
      occurrenceOf(project, biome.biomeKey, host.occurrenceId).acquisitionSites
        ?.hermesShrineDelivery?.pickupEntries?.[entryKeys[0]!],
    );
    expect(undoProjectHistory(history).present).toBe(project);
    const reloaded = decodeProjectDocument(
      JSON.parse(encodeProjectDocument(history.present)) as unknown,
      catalog,
    );
    const edited = applyProjectCommand(reloaded, catalog, {
      kind: 'ReplaceHermesShrineOffer',
      occurrence: source,
      slotKey: 'secondRight',
      value: { rewardType: 'ArmorBoost' },
    });
    expect(orderedDeliveryKeys(edited, biome.biomeKey, host.occurrenceId)).not.toContain(entryKey);
  });

  it('repairs an exact retained placement whose source occurrence was deleted', () => {
    const { project: original, biome, host, entryKeys } = projectWithTwoSideRoomDeliveries();
    const oldKey = entryKeys[0]!;
    const missingSource = createOccurrenceAddress(
      biome,
      createOccurrenceId('deleted-shrine-source'),
    );
    const entryKey = hermesShrineDeliveryEntryKey(missingSource, 'initial:first');
    const loaded = decodeProjectDocument(
      {
        ...original,
        route: {
          ...original.route,
          biomes: original.route.biomes.map((plan) =>
            plan.biomeKey !== biome.biomeKey || plan.topology === null
              ? plan
              : {
                  ...plan,
                  topology: {
                    ...plan.topology,
                    occurrences: plan.topology.occurrences.map((occurrence) =>
                      occurrence.occurrenceId !== host.occurrenceId
                        ? occurrence
                        : {
                            ...occurrence,
                            acquisitionSites: {
                              ...occurrence.acquisitionSites,
                              hermesShrineDelivery: {
                                pickupEntries: Object.fromEntries(
                                  Object.entries(
                                    occurrence.acquisitionSites!.hermesShrineDelivery!
                                      .pickupEntries!,
                                  ).map(([key, reward]) => [
                                    key === oldKey ? entryKey : key,
                                    reward,
                                  ]),
                                ),
                              },
                            },
                            roomActions: {
                              order: occurrence.roomActions.order.map((reference) =>
                                reference.kind === 'interactAcquisitionEntry' &&
                                reference.entryKey === oldKey
                                  ? { ...reference, entryKey }
                                  : reference,
                              ),
                            },
                          },
                    ),
                  },
                },
          ),
        },
      },
      catalog,
    );
    expect(
      assessGeneratedPickupPlacement(loaded.route, host, deliveryAction(entryKey)),
    ).toMatchObject({ kind: 'invalid', source: missingSource });
    const removed = applyProjectCommand(loaded, catalog, {
      kind: 'UnplaceGeneratedDelivery',
      action: createRoomActionAddress(
        biome,
        host.occurrenceId,
        roomActionKey(deliveryAction(entryKey)),
      ),
    });
    expect(orderedDeliveryKeys(removed, biome.biomeKey, host.occurrenceId)).toEqual([entryKeys[1]]);
    expect(
      occurrenceOf(removed, biome.biomeKey, host.occurrenceId).acquisitionSites
        ?.hermesShrineDelivery?.pickupEntries?.[entryKey],
    ).toBeUndefined();
  });

  it('rejects local rushed unplacement and protects its required pickup', () => {
    const project = createSurfaceNOHermesShrineDeliveryCheckpoint({ placeDelayedDelivery: false });
    const source = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const entryKey = hermesShrineDeliveryEntryKey(source, 'initial:first');
    const action = createRoomActionAddress(
      oBiome,
      source.occurrenceId,
      roomActionKey(deliveryAction(entryKey)),
    );
    expect(() =>
      applyProjectCommand(project, catalog, { kind: 'UnplaceGeneratedDelivery', action }),
    ).toThrow('same-room Shrine delivery');
  });
});

describe('flush-host admission after source retraction', () => {
  const source = createOccurrenceAddress(qBiome, qOccurrenceIds.ordinary);
  const host = createOccurrenceAddress(qBiome, qOccurrenceIds.preboss);
  const entryKey = hermesShrineDeliveryEntryKey(source, 'initial:first');
  const evaluate = (project: ProjectDocument) => simulateProjectAssembly(catalog, project);
  const settle = (project: ProjectDocument, command: Parameters<typeof applyProjectCommand>[2]) =>
    settleProjectEdit({ catalog, before: evaluate(project), command, evaluate });
  const hostOf = (project: ProjectDocument) =>
    project.route.biomes
      .find((biome) => biome.biomeKey === qBiome.biomeKey)!
      .topology!.occurrences.find((occurrence) => occurrence.occurrenceId === host.occurrenceId)!;
  const orderedKeys = (project: ProjectDocument) =>
    hostOf(project).roomActions.order.flatMap((reference) =>
      reference.kind === 'interactAcquisitionEntry' && reference.entryKey === entryKey
        ? [reference]
        : [],
    );
  const requiredContribution = (project: ProjectDocument) =>
    roomActionDomainForOccurrence(
      project,
      catalog,
      qBiome,
      host.occurrenceId,
    )?.domain.contributions.find(
      (entry) =>
        entry.kind === 'action' &&
        entry.reference.kind === 'interactAcquisitionEntry' &&
        entry.reference.entryKey === entryKey,
    );

  /** A Q Combat01 Shrine whose delayed delivery is still pending at the Q Preboss flush. */
  function placedAtFlushHost() {
    let project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'SetHermesShrinePresence',
      occurrence: source,
      present: true,
    });
    for (const [slotKey, rewardType] of [
      ['first', 'HealBigDrop'],
      ['secondLeft', 'MaxHealthDrop'],
      ['secondRight', 'MaxManaDrop'],
    ] as const)
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceHermesShrineOffer',
        occurrence: source,
        slotKey,
        value: { rewardType },
      });
    const settled = settle(project, {
      kind: 'SetHermesShrinePurchase',
      occurrence: source,
      generationKey: 'initial:first',
      purchase: { delay: 8, rushed: false },
    });
    expect(settled.fault).toBeUndefined();
    expect(settled.assembly.evaluation.status).toBe('valid');
    expect(orderedKeys(settled.assembly.project)).toEqual([
      { kind: 'interactAcquisitionEntry', siteKey: 'hermesShrineDelivery', entryKey },
    ]);
    expect(requiredContribution(settled.assembly.project)).toMatchObject({
      participation: 'required',
    });
    return settled.assembly.project;
  }

  function expectDormant(project: ProjectDocument) {
    expect(orderedKeys(project)).toEqual([]);
    expect(
      hostOf(project).acquisitionSites?.hermesShrineDelivery?.pickupEntries?.[entryKey],
    ).toMatchObject({ offer: { rewardType: 'HealBigDrop' } });
    expect(requiredContribution(project)).toBeUndefined();
    const evaluation = evaluate(project).evaluation;
    expect(
      evaluation.findings
        .map((finding) => finding.code)
        .filter((code) =>
          ['roomActionPlacementRequired', 'hermesShrineDeliveryPlacementRequired'].includes(code),
        ),
    ).toEqual([]);
    return evaluation;
  }

  it('leaves retained payload dormant when the purchase is cleared and restores it on repurchase', () => {
    const placed = placedAtFlushHost();
    const cleared = settle(placed, {
      kind: 'SetHermesShrinePurchase',
      occurrence: source,
      generationKey: 'initial:first',
      purchase: null,
    });
    expect(cleared.fault).toBeUndefined();
    expect(expectDormant(cleared.assembly.project).status).toBe('valid');
    const history = publishProjectHistoryEdit(
      createProjectHistory(placed),
      cleared.assembly.project,
    );
    expect(undoProjectHistory(history).present).toBe(placed);

    const repurchased = settle(cleared.assembly.project, {
      kind: 'SetHermesShrinePurchase',
      occurrence: source,
      generationKey: 'initial:first',
      purchase: { delay: 8, rushed: false },
    });
    expect(repurchased.fault).toBeUndefined();
    expect(repurchased.assembly.evaluation.status).toBe('valid');
    expect(orderedKeys(repurchased.assembly.project)).toHaveLength(1);
    expect(requiredContribution(repurchased.assembly.project)).toMatchObject({
      participation: 'required',
    });
  });

  it('leaves retained payload dormant when the Shrine is removed', () => {
    const placed = placedAtFlushHost();
    const removed = settle(placed, {
      kind: 'SetHermesShrinePresence',
      occurrence: source,
      present: false,
    });
    expect(removed.fault).toBeUndefined();
    expect(expectDormant(removed.assembly.project).status).toBe('valid');
  });
});
