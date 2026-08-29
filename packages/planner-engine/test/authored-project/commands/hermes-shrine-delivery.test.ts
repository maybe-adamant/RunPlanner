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
import { createEnteredNLocalProject, nLocalOccurrenceId } from '../support/complete-n-project';
import { initializeTestRewardBranches } from '../../support/arcana-fear';
import type { CanonicalAuthoredRoom } from '../../../src/simulation/materialization';
import { applyEncounterEndEffectsTransition } from '../../../src/simulation/rewards/biome/lifecycle-transitions/encounter-end-effects';

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
  const route = project.routes.find((candidate) => candidate.routeKey === 'Surface');
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
    routes: project.routes.map((candidate) =>
      candidate.routeKey !== route.routeKey
        ? candidate
        : {
            ...candidate,
            biomes: candidate.biomes.map((candidateBiome) =>
              candidateBiome.biomeKey === plan.biomeKey
                ? Object.freeze({ ...candidateBiome, topology })
                : candidateBiome,
            ),
          },
    ),
  };
  return Object.freeze({
    project,
    biome,
    source: createOccurrenceAddress(biome, sourceId),
    host: createOccurrenceAddress(biome, hostId),
  });
}

describe('Hermes Shrine delivery placement', () => {
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
      index: 0,
      encounterPhaseKey: 'Encounter',
    });
    const placedHost = placed.routes
      .find((route) => route.routeKey === biome.routeKey)
      ?.biomes.find((candidate) => candidate.biomeKey === biome.biomeKey)
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
    const decodedHost = decoded.routes
      .find((route) => route.routeKey === biome.routeKey)
      ?.biomes.find((candidate) => candidate.biomeKey === biome.biomeKey)
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === host.occurrenceId);
    expect(decodedHost?.roomActions.order).toContainEqual({
      kind: 'interactAcquisitionEntry',
      siteKey: 'hermesShrineDelivery',
      entryKey,
      encounterPhaseKey: 'Encounter',
    });
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
      1,
      4,
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
      1,
      4,
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
      1,
      4,
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
      1,
      4,
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
      1,
      4,
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
      index: 0,
      encounterPhaseKey: 'Encounter',
    });
    const repaired = applyProjectCommand(placed, catalog, {
      kind: 'PlaceHermesShrineDelivery',
      entry,
      index: 1,
      encounterPhaseKey: 'LaterEncounter',
    });
    const repairedHost = repaired.routes
      .find((route) => route.routeKey === biome.routeKey)
      ?.biomes.find((candidate) => candidate.biomeKey === biome.biomeKey)
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
