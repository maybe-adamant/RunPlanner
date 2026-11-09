import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createShopOfferAddress,
  roomActionKey,
  type OccurrenceAddress,
  type ProjectCommand,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { settleProjectEdit, simulateProjectAssembly } from '@run-planner/engine/simulation';
import {
  createEchoGoldIAnvilDuplicateProject,
  createGoldenFGHProject,
  createUnderworldFPoolCheckpoint,
  echoGoldIPrebossShopId,
  goldenFBiome,
  goldenGBiome,
  goldenIBiome,
} from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNOProject, oBiome, oOccurrenceIds } from '@run-planner/test-fixtures/surface';
import { loadUnderworldZagreusContractCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';

import { createAuthoringSession } from '../../../src/simulation/authoring/session';

const evaluate = (project: ProjectDocument) => simulateProjectAssembly(catalog, project);
const settle = (project: ProjectDocument, command: ProjectCommand) =>
  settleProjectEdit({ catalog, before: evaluate(project), command, evaluate });

function order(project: ProjectDocument, room: OccurrenceAddress): readonly string[] {
  const occurrence = project.route.biomes
    .find((plan) => plan.biomeKey === room.biomeKey)
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === room.occurrenceId);
  if (occurrence === undefined) throw new Error(`${room.occurrenceId} is missing`);
  return occurrence.roomActions.order.map(roomActionKey);
}

// The G opening's retained pickup of a role its reward no longer has: stale since authoring.
const gOpening = createOccurrenceAddress(goldenGBiome, createOccurrenceId('golden-g-b1-e1'));
const retainedPickup = {
  kind: 'interactIncomingReward',
  producerPoint: 'roomRewardPickup',
  acquisitionRole: 'source',
} as const;

describe('stale room actions in edit settlement', () => {
  it('removes the rows an edit orphans in the same edit and names them', () => {
    const ship = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const three = settle(loadSurfaceNOProject(), {
      kind: 'ReplaceShipEncounterCount',
      occurrence: ship,
      encounterCount: 3,
    }).assembly.project;
    const wheel2 = order(three, ship).filter((key) => key.includes('wheel2'));
    expect(wheel2.length).toBeGreaterThan(0);
    const settled = settle(three, {
      kind: 'ReplaceShipEncounterCount',
      occurrence: ship,
      encounterCount: 2,
    });
    expect(settled.fault).toBeUndefined();
    const after = order(settled.assembly.project, ship);
    expect(after.filter((key) => key.includes('wheel2'))).toEqual([]);
    expect(after).toEqual(order(three, ship).filter((key) => !wheel2.includes(key)));
    expect(settled.removedStaleActions).toEqual([{ occurrence: ship, actions: expect.any(Array) }]);
    expect(settled.removedStaleActions![0]!.actions.map(roomActionKey)).toEqual(wheel2);
    // The before snapshot, which Undo restores, keeps them.
    expect(order(three, ship)).toEqual(expect.arrayContaining(wheel2));
  });

  it('removes a room’s retained stale rows at the first edit of that room only', () => {
    const project = createGoldenFGHProject();
    expect(order(project, gOpening)).toContain(roomActionKey(retainedPickup));
    // An edit of another room leaves them.
    const elsewhere = settle(project, {
      kind: 'ReplaceRoomLayout',
      occurrence: createOccurrenceAddress(goldenFBiome, createOccurrenceId('golden-f-start')),
      layout: { flipped: true },
    });
    expect(elsewhere.removedStaleActions).toBeUndefined();
    expect(order(elsewhere.assembly.project, gOpening)).toContain(roomActionKey(retainedPickup));
    const edited = settle(project, {
      kind: 'ReplaceRoomLayout',
      occurrence: gOpening,
      layout: { flipped: true },
    });
    expect(edited.fault).toBeUndefined();
    expect(order(edited.assembly.project, gOpening)).not.toContain(roomActionKey(retainedPickup));
    expect(edited.removedStaleActions).toEqual([
      { occurrence: gOpening, actions: [retainedPickup] },
    ]);
  });

  it('reports the removed rows on an authoring session edit, and restoring returns them', () => {
    const start = evaluate(createGoldenFGHProject());
    const session = createAuthoringSession(catalog, start);
    const outcome = session.apply({
      kind: 'ReplaceRoomLayout',
      occurrence: gOpening,
      layout: { flipped: true },
    });
    expect(outcome).toMatchObject({
      kind: 'applied',
      removedStaleActions: [{ occurrence: gOpening, actions: [retainedPickup] }],
    });
    session.restore(start);
    expect(order(session.current().project, gOpening)).toContain(roomActionKey(retainedPickup));
  });

  it('keeps an invalid Pool sale with its finding', () => {
    const pool = createOccurrenceAddress(
      goldenFBiome,
      createOccurrenceId('golden-f-preboss-shop:postboss'),
    );
    const project = createUnderworldFPoolCheckpoint();
    const sales = order(project, pool).filter((key) => key.includes('sellPurgingPoolTrait'));
    expect(sales.length).toBeGreaterThan(0);
    const settled = settle(project, {
      kind: 'ReplacePurgingPoolSlot',
      occurrence: pool,
      slotKey: 'left',
      traitKey: null,
    });
    expect(settled.removedStaleActions).toBeUndefined();
    expect(order(settled.assembly.project, pool)).toEqual(expect.arrayContaining(sales));
    expect(settled.assembly.evaluation.findings).toContainEqual(
      expect.objectContaining({ code: 'purgingPoolTraitMissing' }),
    );
  });

  it('keeps an invalid Shop purchase with its finding when its room is edited', () => {
    const shop = createOccurrenceAddress(goldenIBiome, echoGoldIPrebossShopId);
    const project = createEchoGoldIAnvilDuplicateProject();
    const unavailable = (
      findings: readonly { readonly code: string; readonly origin: unknown }[],
    ) =>
      findings
        .filter((finding) => finding.code === 'rewardAcquisitionUnavailable')
        .map((finding) => finding.origin);
    const before = unavailable(evaluate(project).evaluation.findings);
    expect(before.length).toBeGreaterThan(0);
    const room = project.route.biomes
      .find((plan) => plan.biomeKey === shop.biomeKey)!
      .topology!.occurrences.find((candidate) => candidate.occurrenceId === shop.occurrenceId)!;
    const purchased = new Set(order(project, shop));
    const offerKey = Object.keys(room.state.kind === 'shop' ? (room.state.shop?.offers ?? {}) : {})
      .filter((key) => key !== 'travelDealRefill')
      .find((key) => !purchased.has(roomActionKey({ kind: 'interactShopOffer', offerKey: key })));
    if (offerKey === undefined) throw new Error('expected an unbought Shop item');
    const settled = settle(project, {
      kind: 'ReplaceShopPurchaseParticipation',
      offer: createShopOfferAddress(goldenIBiome, echoGoldIPrebossShopId, offerKey),
      purchased: true,
    });
    expect(settled.removedStaleActions).toBeUndefined();
    expect(order(settled.assembly.project, shop)).toEqual(
      expect.arrayContaining([...order(project, shop)]),
    );
    expect(unavailable(settled.assembly.evaluation.findings)).toEqual(before);
  });

  describe('a changed incoming reward', () => {
    const pickup = (producerPoint: string, acquisitionRole: string) =>
      roomActionKey({ kind: 'interactIncomingReward', producerPoint, acquisitionRole } as never);
    const boonRoom = createOccurrenceAddress(goldenFBiome, createOccurrenceId('golden-f-b2-e1'));
    const reward = (room: OccurrenceAddress) =>
      createIncomingRewardAddress(goldenFBiome, room.occurrenceId);
    const boon = {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
    } as const;
    const devotion = {
      rewardType: 'Devotion',
      payload: {
        kind: 'DevotionPair',
        chosenSource: 'ApolloUpgrade',
        spurnedSource: 'ZeusUpgrade',
      },
    } as const;

    it('rekeys its pickup in place between one-role rewards, silently', () => {
      const project = createGoldenFGHProject();
      expect(order(project, boonRoom)).toEqual([pickup('roomRewardPickup', 'source')]);
      const gold = settle(project, {
        kind: 'ReplaceIncomingReward',
        reward: reward(boonRoom),
        value: { rewardType: 'RoomMoneyDrop' },
      });
      expect(gold.fault).toBeUndefined();
      expect(gold.removedStaleActions).toBeUndefined();
      expect(order(gold.assembly.project, boonRoom)).toEqual([pickup('roomRewardPickup', 'self')]);
      const back = settle(gold.assembly.project, {
        kind: 'ReplaceIncomingReward',
        reward: reward(boonRoom),
        value: boon,
      });
      expect(back.removedStaleActions).toBeUndefined();
      expect(order(back.assembly.project, boonRoom)).toEqual([
        pickup('roomRewardPickup', 'source'),
      ]);
    });

    it('gives a Boon’s pickup to Devotion’s chosen god and places the spurned one', () => {
      const settled = settle(createGoldenFGHProject(), {
        kind: 'ReplaceIncomingReward',
        reward: reward(boonRoom),
        value: devotion,
      });
      expect(settled.fault).toBeUndefined();
      expect(settled.removedStaleActions).toBeUndefined();
      expect(order(settled.assembly.project, boonRoom)).toEqual([
        pickup('beforeCombat', 'chosenSource'),
        pickup('afterCombat', 'spurnedSource'),
      ]);
    });

    it('gives Devotion’s chosen pickup to a Boon in place and drops the spurned one silently', () => {
      const project = settle(createGoldenFGHProject(), {
        kind: 'ReplaceIncomingReward',
        reward: reward(boonRoom),
        value: devotion,
      }).assembly.project;
      const settled = settle(project, {
        kind: 'ReplaceIncomingReward',
        reward: reward(boonRoom),
        value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
      });
      expect(settled.fault).toBeUndefined();
      expect(settled.removedStaleActions).toBeUndefined();
      expect(order(settled.assembly.project, boonRoom)).toEqual([
        pickup('roomRewardPickup', 'source'),
      ]);
    });
  });

  it('leaves the rows of a room the run stops entering, and they return with its door', () => {
    const shop = createOccurrenceAddress(
      goldenGBiome,
      createOccurrenceId('zagreus-contract-preboss-shop'),
    );
    const selection = createExitSelectionAddress(goldenGBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('zagreus-contract-return'),
    });
    const project = loadUnderworldZagreusContractCheckpoint();
    const collect = roomActionKey({ kind: 'interactInfernalContractPedestal' });
    expect(order(project, shop)).toContain(collect);
    const away = settle(project, {
      kind: 'SetExitSelection',
      selection,
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    expect(away.removedStaleActions).toBeUndefined();
    expect(order(away.assembly.project, shop)).toEqual(order(project, shop));
    const back = settle(away.assembly.project, {
      kind: 'SetExitSelection',
      selection,
      value: { kind: 'normal', exitKey: 'exit1' },
    });
    expect(back.removedStaleActions).toBeUndefined();
    expect(order(back.assembly.project, shop)).toEqual(order(project, shop));
  });
});
