import {
  catalog } from '@run-planner/hades2-catalog';
import {
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  semanticAddressKey,
  } from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { describe,
  expect,
  it } from 'vitest';
import { settleOwnedAcquisitionSite,
} from '../../../../src/simulation/rewards/processing';

import { loadSurfaceNOProject } from '@run-planner/test-fixtures/surface';

function fixture() {
  const project = loadSurfaceNOProject();
  const evaluation = simulateProject(catalog, project);
  const n = evaluation.routes
    .find((route) => route.routeKey === 'Surface')
    ?.biomes.find((candidate) => candidate.biomeKey === 'N');
  const o = evaluation.routes
    .find((route) => route.routeKey === 'Surface')
    ?.biomes.find((candidate) => candidate.biomeKey === 'O');
  if (
    n?.authoring !== 'complete' ||
    n.validity !== 'valid' ||
    o?.authoring !== 'complete' ||
    o.validity !== 'valid'
  ) {
    throw new Error('N/O fixture did not complete');
  }
  return { project, evaluation, n, o, snapshot: o.snapshot, history: o.history };
}

describe('O canonical materialization and lifecycle', () => {
  it('materializes active wheels, source-derived stores, and the width-one takeover tail', () => {
    const { snapshot } = fixture();
    const batches = snapshot.decisions.filter((decision) => decision.kind === 'batch');
    const firstCombat = batches[0]?.targets[0]?.room;
    const reprieve = batches[1]?.targets[0]?.room;
    const secondCombat = batches[2]?.targets[0]?.room;
    const takeover = batches.at(-1);

    expect(firstCombat).toMatchObject({
      gameName: 'O_Combat04',
      encounterEnvelopeKey: 'ShipEncounter',
      encounterPhases: [
        { slotKey: 'Intro', encounterKey: 'GeneratedO_Intro01' },
        { slotKey: 'Combat1', encounterKey: 'GeneratedO' },
      ],
      rewardWheels: [{ wheelKey: 'wheel1', storeKey: 'RunProgress', offers: [{ picked: true }] }],
    });
    expect(reprieve).toMatchObject({
      gameName: 'O_Combat07',
      rewardWheels: [{ wheelKey: 'wheel1', storeKey: 'RunProgress' }],
    });
    expect(secondCombat).toMatchObject({
      gameName: 'O_Combat01',
      rewardWheels: [{ wheelKey: 'wheel1' }],
    });
    expect(batches.slice(1, 4).map((batch) => batch.rewardStore.kind)).toEqual([
      'sourceOfferPoint',
      'sourceOfferPoint',
      'sourceOfferPoint',
    ]);
    expect(takeover).toMatchObject({
      kind: 'batch',
      rewardStore: { kind: 'sourceOfferPoint' },
      targets: [
        {
          continuation: 'startsCompletion',
          room: { gameName: 'O_PreBoss01', lifecycleProfileKey: 'PrebossShopRoom' },
        },
      ],
    });
    expect(snapshot.automaticRooms.map((room) => room.gameName)).toEqual([
      'O_Boss01',
      'O_PostBoss01',
    ]);
  });

  it('orders Ship wheel lifecycles at their encounter points and carries N route state', () => {
    const { n, snapshot, history } = fixture();
    const firstCombat = snapshot.decisions.find(
      (decision) =>
        decision.kind === 'batch' && decision.targets[0]?.room.gameName === 'O_Combat04',
    );
    if (firstCombat?.kind !== 'batch') throw new Error('fixture lost first O combat');
    const room = firstCombat.targets[0]!.room;
    const events = history.events.filter(
      (event) =>
        'origin' in event && semanticAddressKey(event.origin) === semanticAddressKey(room.origin),
    );
    const view = history.rooms.find(
      (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(room.origin),
    );

    expect(events.map((event) => event.kind)).toEqual(
      expect.arrayContaining([
        'roomCreated',
        'roomPrepared',
        'roomEntered',
        'offerPointMaterialized',
        'offerPointAcquired',
        'outgoingGenerationCheckpoint',
      ]),
    );
    expect(view?.offerPoints?.map((offer) => offer.offerPoint)).toEqual(['wheel1']);
    const encounterStarts = events.filter((event) => event.kind === 'encounterStarted');
    expect(view?.encounterStarts.map((start) => start.phaseKey)).toEqual(
      encounterStarts.map((event) => event.phaseKey),
    );
    expect(view?.encounterStarts.map((start) => start.before.sequence)).toEqual(
      encounterStarts.map((event) => event.sequence - 1),
    );
    expect(history.events[0]?.sequence).toBe(n.history.afterTransition.sequence + 1);
    expect(history.events[0]).toMatchObject({
      kind: 'biomeStarted',
      counters: {
        routeEncounterDepth: n.history.afterTransition.ledgers.counters.routeEncounterDepth,
      },
    });
  });

  it('offers every active wheel entry but acquires only its picked offer', () => {
    const { o, snapshot } = fixture();
    const firstCombat = snapshot.decisions.find(
      (decision) =>
        decision.kind === 'batch' && decision.targets[0]?.room.gameName === 'O_Combat04',
    );
    if (firstCombat?.kind !== 'batch') throw new Error('fixture lost first O combat');
    const offers = firstCombat.targets[0]!.room.rewardWheels!.flatMap((wheel) => wheel.offers);

    expect(o.rewards.validity).toBe('valid');
    for (const offer of offers) {
      expect(
        o.rewards.branches.some((branch) =>
          branch.events.some(
            (event) =>
              event.kind === 'rewardOffered' &&
              semanticAddressKey(event.origin) === semanticAddressKey(offer.origin),
          ),
        ),
      ).toBe(true);
      expect(
        o.rewards.branches.some((branch) =>
          branch.events.some(
            (event) =>
              event.kind === 'concreteAcquisition' &&
              semanticAddressKey(event.origin) === semanticAddressKey(offer.origin),
          ),
        ),
      ).toBe(offer.picked);
    }

    for (const wheel of firstCombat.targets[0]!.room.rewardWheels!) {
      const picked = wheel.offers.find((offer) => offer.picked);
      if (picked === undefined) throw new Error('fixture lost wheel selection');
      const site = createAcquisitionSiteAddress(wheel.origin, wheel.wheelKey);
      expect(
        o.rewards.branches[0]!.events.find(
          (event) =>
            event.kind === 'concreteAcquisition' &&
            semanticAddressKey(event.origin) === semanticAddressKey(picked.origin),
        ),
      ).toMatchObject({
        settlement: {
          site,
          entry: createAcquisitionEntryAddress(site, 'picked'),
        },
      });
    }
  });

  it('keeps Devotion wheel roles inside one atomic settlement entry', () => {
    const { snapshot } = fixture();
    const firstCombat = snapshot.decisions.find(
      (decision) =>
        decision.kind === 'batch' && decision.targets[0]?.room.gameName === 'O_Combat04',
    );
    if (firstCombat?.kind !== 'batch') throw new Error('fixture lost first O combat');
    const wheel = firstCombat.targets[0]!.room.rewardWheels?.[0];
    const source = wheel?.offers[0];
    if (wheel === undefined || source === undefined) throw new Error('fixture lost first O wheel');
    const lifecycle =
      catalog.rewards.producerLifecycles.byKey[wheel.producerLifecycleKey]?.rewardTypes.byKey
        .Devotion;
    if (lifecycle === undefined) throw new Error('O wheel lifecycle lost Devotion');
    const site = createAcquisitionSiteAddress(wheel.origin, wheel.wheelKey);
    const settled = settleOwnedAcquisitionSite(
      catalog,
      Object.freeze([]),
      {
        siteOwner: wheel.origin,
        pointKey: wheel.wheelKey,
        entryKey: 'picked',
        source: {
          ...source,
          offer: {
            rewardType: 'Devotion',
            payload: {
              kind: 'DevotionPair',
              chosenSource: 'ApolloUpgrade',
              spurnedSource: 'ZeusUpgrade',
            },
          },
          producerLifecycleKey: wheel.producerLifecycleKey,
          instanceProvenance: 'free',
        },
        historySequence: 1,
      },
      () => {
        throw new Error('empty settlement branches do not need reward facts');
      },
      new Map(),
    );

    expect(settled.entries).toEqual([
      expect.objectContaining({
        address: createAcquisitionEntryAddress(site, 'picked'),
        acquisitionRoles: lifecycle.acquisitionLifecycle,
      }),
    ]);
    expect(settled.entries).toHaveLength(1);
  });
});
