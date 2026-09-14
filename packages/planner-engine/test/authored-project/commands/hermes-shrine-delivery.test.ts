import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  decodeProjectDocument,
  defaultHermesShrineDeliveryReward,
  encodeProjectDocument,
  hermesShrineDeliveryEntryKey,
  parseHermesShrineDeliveryEntryKey,
} from '@run-planner/engine/authored-project';
import {
  createSurfaceNOHermesShrineDeliveryCheckpoint,
  loadSurfaceNOPQProject,
  oBiome,
  oOccurrenceIds,
  pBiome,
  qBiome,
  qOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import { createEnteredNLocalProject, nLocalOccurrenceId } from '../support/complete-n-project';
import { initializeTestRewardBranches } from '../../support/arcana-fear';
import type { CanonicalAuthoredRoom } from '../../../src/simulation/materialization';
import { applyEncounterEndEffectsTransition } from '../../../src/simulation/rewards/biome/lifecycle-transitions/encounter-end-effects';
import {
  hermesShrineDeliveryPlacementForPurchaseReschedule,
  simulateProjectAssembly,
} from '../../../src/simulation';
import {
  assembleExecutionProduct,
  compileExecutionPlan,
  encodeExecutionPlan,
} from '../../../src/execution-plan';

function shrinePhase(
  slotKey: string,
  advancesHermesShrineDeliveryUses = true,
): CanonicalAuthoredRoom['encounterPhases'][number] {
  return {
    slotKey,
    envelopeKey: 'TestEnvelope',
    encounterKey: 'GeneratedN',
    label: 'Test encounter',
    kind: 'combat',
    countsEncounterDepth: true,
    advancesHermesShrineDeliveryUses,
    canEncounterSkip: false,
    blocksFigLeaf: false,
    blocksGorgon: false,
    hostsGorgon: false,
    skipEndEncounterEffects: false,
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
    const product = assembleExecutionProduct({ assembly: settled });
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
    });
    const room = {
      kind: 'authored',
      origin: host,
      occurrenceId: host.occurrenceId,
      gameName: 'O_Combat04',
      lifecycleProfileKey: 'StandardRewardRoom',
      encounters: { steadyGrowthTargetByPhase: {} },
      encounterPhases: [shrinePhase('Encounter')],
    } as unknown as CanonicalAuthoredRoom;
    const transition = applyEncounterEndEffectsTransition(
      catalog,
      {
        kind: 'encounterEndEffectsApplied',
        sequence: 2,
        operationIndex: 0,
        origin: host,
        phaseKey: 'Encounter',
        execution: 'normal',
        figLeafSkipOwner: false,
      },
      room,
      [pending],
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
        encounterPhaseKey: 'Encounter',
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
      pendingHermesShrineDeliveries: Object.freeze({
        [entryKey]: Object.freeze({
          sourceKey: entryKey,
          sourceOrigin: source,
          generationKey: 'initial:first' as const,
          rewardType: 'HealBigDrop',
          remainingUses: 2,
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
        encounterPhases: [shrinePhase('Encounter')],
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
      [pending],
    );
    expect(sideRoom.branches[0]?.pendingHermesShrineDeliveries[entryKey]).toMatchObject({
      sourceOrigin: source,
      remainingUses: 2,
    });
    expect(sideRoom.derivedAcquisitionEntryFrontiers).toEqual([]);

    const firstMainEncounter = applyEncounterEndEffectsTransition(
      catalog,
      endEffects(host, 2),
      roomFor('N_Hub', 'EphyraHub'),
      sideRoom.branches,
    );
    expect(firstMainEncounter.branches[0]?.pendingHermesShrineDeliveries[entryKey]).toMatchObject({
      sourceOrigin: source,
      remainingUses: 1,
    });

    const dueMainEncounter = applyEncounterEndEffectsTransition(
      catalog,
      endEffects(host, 3),
      roomFor('N_Hub', 'EphyraHub'),
      firstMainEncounter.branches,
    );
    expect(dueMainEncounter.branches[0]?.pendingHermesShrineDeliveries[entryKey]).toMatchObject({
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
    });
    const room = {
      kind: 'authored',
      origin: host,
      occurrenceId: host.occurrenceId,
      gameName: 'O_Combat04',
      lifecycleProfileKey: 'StandardRewardRoom',
      encounters: { steadyGrowthTargetByPhase: {} },
      encounterPhases: [shrinePhase('Combat1')],
      acquisitionSites: {
        hermesShrineDelivery: {
          entries: { [entryKey]: defaultHermesShrineDeliveryReward(catalog, 'HealBigDrop') },
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
      [pending],
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
