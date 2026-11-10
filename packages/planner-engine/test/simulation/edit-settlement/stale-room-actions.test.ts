import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createHubSlotAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomActionAddress,
  createRewardWheelOfferAddress,
  createShopOfferAddress,
  createTraitOfferAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  hermesShrineDeliveryEntryKey,
  roomActionKey,
  type OccurrenceAddress,
  type ProjectCommand,
  type ProjectDocument,
  type RerollTarget,
} from '@run-planner/engine/authored-project';
import { settleProjectEdit, simulateProjectAssembly } from '@run-planner/engine/simulation';
import {
  createEchoGoldIAnvilDuplicateProject,
  createGoldenFGHProject,
  createUnderworldFPoolCheckpoint,
  echoGoldIPrebossShopId,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenGBiome,
  goldenHBiome,
  goldenIBiome,
  underworldWorldShopTravelDealProject,
} from '@run-planner/test-fixtures/underworld';
import {
  createSurfaceNOHermesShrineDeliveryCheckpoint,
  loadSurfaceNOProject,
  loadSurfaceNProject,
  oBiome,
  oOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import {
  loadNemesisFieldsCheckpoint,
  loadUnderworldFGCheckpoint,
  loadUnderworldZagreusContractCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/underworld';
import { loadSurfaceScheduledLifecycleCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import { authorLegalPomResolutions } from '@run-planner/test-fixtures/shared';

import { createAuthoringSession } from '../../../src/simulation/authoring/session';
import {
  firstSupportedReroll,
  withArcana,
  withGoldenUnderworldJudgments,
} from '../../support/rerolls';
import { underworldGLockedDoorsProject } from '../../execution-plan/support/plan-end-switch-fixtures';

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
  it('removes the rows an edit orphans in the same edit, silently in the room it addresses', () => {
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
    expect(settled.removedStaleActions).toBeUndefined();
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
    expect(edited.removedStaleActions).toBeUndefined();
  });

  it('removes them on an authoring session edit, and restoring returns them', () => {
    const start = evaluate(createGoldenFGHProject());
    const session = createAuthoringSession(catalog, start);
    const outcome = session.apply({
      kind: 'ReplaceRoomLayout',
      occurrence: gOpening,
      layout: { flipped: true },
    });
    expect(outcome).toMatchObject({ kind: 'applied' });
    expect(order(session.current().project, gOpening)).not.toContain(roomActionKey(retainedPickup));
    session.restore(start);
    expect(order(session.current().project, gOpening)).toContain(roomActionKey(retainedPickup));
  });

  it('announces every removal of an edit that addresses no single room', () => {
    // An older save's stale pickup in the F Boss room, which Vow of Rivals replaces.
    const boss = createOccurrenceAddress(
      goldenFBiome,
      createOccurrenceId('golden-f-preboss-shop:boss'),
    );
    const saved = JSON.parse(encodeProjectDocument(createGoldenFGHProject()));
    const room = saved.route.biomes
      .find((plan: { biomeKey: string }) => plan.biomeKey === boss.biomeKey)
      .topology.occurrences.find(
        (candidate: { occurrenceId: string }) => candidate.occurrenceId === boss.occurrenceId,
      );
    room.roomActions.order.push(retainedPickup);
    const project = decodeProjectDocument(saved, catalog);
    const settled = settle(project, {
      kind: 'ReplaceFearVowRank',
      route: { kind: 'route', routeKey: 'Underworld' },
      vowKey: 'BossDifficultyShrineUpgrade',
      rank: 4,
    });
    expect(settled.fault).toBeUndefined();
    expect(order(settled.assembly.project, boss)).not.toContain(roomActionKey(retainedPickup));
    expect(settled.removedStaleActions).toEqual([{ occurrence: boss, actions: [retainedPickup] }]);
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

    describe('beside other rows', () => {
      // G Combat 2 holds two lockable doors whose optional presses stand around its pickup.
      const room = createOccurrenceAddress(goldenGBiome, createOccurrenceId('golden-g-b2-e1'));
      const lockedReward = createIncomingRewardAddress(goldenGBiome, room.occurrenceId);
      const press = (exitKey: string) => roomActionKey({ kind: 'unlockExit', exitKey } as never);
      const insertPress = (project: ProjectDocument, exitKey: string, index: number) =>
        settle(project, {
          kind: 'InsertRoomAction',
          action: createRoomActionAddress(goldenGBiome, room.occurrenceId, press(exitKey)),
          reference: { kind: 'unlockExit', exitKey },
          index,
        }).assembly.project;
      const replace = (
        project: ProjectDocument,
        value: Extract<ProjectCommand, { kind: 'ReplaceIncomingReward' }>['value'],
      ) => settle(project, { kind: 'ReplaceIncomingReward', reward: lockedReward, value });

      it('keeps each changed pickup at its place among them', () => {
        let project = replace(underworldGLockedDoorsProject(), devotion).assembly.project;
        project = insertPress(insertPress(project, 'exit2', 1), 'exit3', 3);
        expect(order(project, room)).toEqual([
          pickup('beforeCombat', 'chosenSource'),
          press('exit2'),
          pickup('afterCombat', 'spurnedSource'),
          press('exit3'),
        ]);
        // The chosen pickup becomes the Boon's; the spurned one leaves silently.
        const toBoon = replace(project, boon);
        expect(toBoon.fault).toBeUndefined();
        expect(toBoon.removedStaleActions).toBeUndefined();
        expect(order(toBoon.assembly.project, room)).toEqual([
          pickup('roomRewardPickup', 'source'),
          press('exit2'),
          press('exit3'),
        ]);
        // Back to Devotion: the Boon's pickup becomes the chosen one; the spurned one is new.
        const toDevotion = replace(toBoon.assembly.project, devotion);
        expect(toDevotion.removedStaleActions).toBeUndefined();
        expect(order(toDevotion.assembly.project, room)).toEqual([
          pickup('beforeCombat', 'chosenSource'),
          pickup('afterCombat', 'spurnedSource'),
          press('exit2'),
          press('exit3'),
        ]);
      });

      it('leaves the new role at its default where the old place is refused', () => {
        // A press authored before the pickup holds the pickup at a place no new placement may take.
        const project = insertPress(
          insertPress(underworldGLockedDoorsProject(), 'exit2', 0),
          'exit3',
          2,
        );
        expect(order(project, room)).toEqual([
          press('exit2'),
          pickup('roomRewardPickup', 'self'),
          press('exit3'),
        ]);
        const settled = replace(project, boon);
        expect(settled.fault).toBeUndefined();
        expect(settled.removedStaleActions).toBeUndefined();
        expect(order(settled.assembly.project, room)).toEqual([
          pickup('roomRewardPickup', 'source'),
          press('exit2'),
          press('exit3'),
        ]);
      });
    });

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

  describe('rows whose source is gone', () => {
    const echoShop = createOccurrenceAddress(goldenIBiome, echoGoldIPrebossShopId);
    const echoDuplicate = {
      kind: 'interactAcquisitionEntry',
      siteKey: 'roomExit',
      entryKey: 'echoDoubleShopReward',
    } as const;
    // The H bridge Echo takes another option than the Gold Gold Gold the I Preboss Shop duplicates.
    const swapEchoAway: ProjectCommand = {
      kind: 'ReplaceTraitSelection',
      trait: createTraitOfferAddress(
        createEncounterPhaseAddress(
          goldenHBiome,
          { kind: 'occurrence', occurrenceId: createOccurrenceId('golden-h-bridge01') },
          'Encounter',
        ),
        'selection',
      ),
      selectedOptionKey: 'option2',
    };
    /** Settles one edit in an authoring session, then restores the start as Undo does. */
    const settleAndUndo = (project: ProjectDocument, command: ProjectCommand) => {
      const start = evaluate(project);
      const session = createAuthoringSession(catalog, start);
      const outcome = session.apply(command);
      if (outcome.kind !== 'applied') throw new Error(`expected ${command.kind} to apply`);
      const edited = session.current().project;
      session.restore(start);
      return { outcome, edited, undone: session.current().project };
    };
    // The F Hermes boon that gave Travel Deal becomes another.
    const swapTravelDealAway: ProjectCommand = {
      kind: 'ReplaceTraitSelection',
      trait: createTraitOfferAddress(
        createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(8, 1)),
        'self',
      ),
      selectedOptionKey: 'option2',
    };
    const removedIn = (
      settled: ReturnType<typeof settle>,
      room: OccurrenceAddress,
    ): readonly string[] | undefined =>
      settled.removedStaleActions
        ?.find((entry) => entry.occurrence.occurrenceId === room.occurrenceId)
        ?.actions.map(roomActionKey);

    it('removes and reports a later Shop’s Gold Gold Gold duplicate once the Echo is gone', () => {
      const start = evaluate(createEchoGoldIAnvilDuplicateProject());
      expect(order(start.project, echoShop)).toContain(roomActionKey(echoDuplicate));
      const session = createAuthoringSession(catalog, start);
      const outcome = session.apply(swapEchoAway);
      if (outcome.kind !== 'applied') throw new Error('expected the Echo swap to apply');
      const after = session.current();
      // Its source purchase stays: the Echo, its enabler, went.
      const purchases = order(start.project, echoShop).filter((key) =>
        key.startsWith('["interactShopOffer"'),
      );
      expect(purchases.length).toBeGreaterThan(0);
      expect(order(after.project, echoShop)).toEqual(
        order(start.project, echoShop).filter((key) => key !== roomActionKey(echoDuplicate)),
      );
      expect(outcome.removedStaleActions).toContainEqual({
        occurrence: echoShop,
        actions: [echoDuplicate],
      });
      // The duplicate's payload stays with the Shop's pickup site.
      const site = (project: ProjectDocument) =>
        project.route.biomes
          .find((plan) => plan.biomeKey === echoShop.biomeKey)
          ?.topology?.occurrences.find(
            (candidate) => candidate.occurrenceId === echoShop.occurrenceId,
          )?.acquisitionSites?.roomExit?.pickupEntries?.echoDoubleShopReward;
      expect(site(after.project)).toEqual(site(start.project));
      expect(
        after.evaluation.findings.filter((finding) => finding.code === 'shopPurchaseUnavailable'),
      ).toEqual([]);
      session.restore(start);
      expect(order(session.current().project, echoShop)).toContain(roomActionKey(echoDuplicate));
    });

    it('keeps a duplicate placed before its Echo was held', () => {
      // Authored without settlement, as an import may place it before its source.
      const project = applyProjectCommand(
        createEchoGoldIAnvilDuplicateProject(),
        catalog,
        swapEchoAway,
      );
      expect(order(project, echoShop)).toContain(roomActionKey(echoDuplicate));
      // Buying a second item edits the Shop and reaches the duplicate.
      const room = project.route.biomes
        .find((plan) => plan.biomeKey === echoShop.biomeKey)!
        .topology!.occurrences.find(
          (candidate) => candidate.occurrenceId === echoShop.occurrenceId,
        )!;
      const purchased = new Set(order(project, echoShop));
      const offerKey = Object.keys(
        room.state.kind === 'shop' ? (room.state.shop?.offers ?? {}) : {},
      )
        .filter((key) => key !== 'travelDealRefill')
        .find((key) => !purchased.has(roomActionKey({ kind: 'interactShopOffer', offerKey: key })));
      if (offerKey === undefined) throw new Error('expected an unbought Shop item');
      const settled = settle(project, {
        kind: 'ReplaceShopPurchaseParticipation',
        offer: createShopOfferAddress(goldenIBiome, echoGoldIPrebossShopId, offerKey),
        purchased: true,
      });
      expect(order(settled.assembly.project, echoShop)).toContain(roomActionKey(echoDuplicate));
      expect(removedIn(settled, echoShop)).toBeUndefined();
      expect(settled.assembly.evaluation.findings).toContainEqual(
        expect.objectContaining({
          code: 'shopPurchaseUnavailable',
          evidence: { kind: 'echoShopDuplicateUnavailable' },
        }),
      );
    });

    describe('a Travel Deal refill', () => {
      const shop = createOccurrenceAddress(
        goldenFBiome,
        createOccurrenceId('golden-f-preboss-shop'),
      );
      const refill = roomActionKey({
        kind: 'interactAcquisitionEntry',
        siteKey: 'roomExit',
        entryKey: 'travelDealRefill',
      });
      const refillItem = (document: ProjectDocument) => {
        const room = document.route.biomes
          .find((plan) => plan.biomeKey === shop.biomeKey)
          ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === shop.occurrenceId);
        return room?.state.kind === 'shop' ? room.state.shop?.travelDealRefill : undefined;
      };
      const site = (document: ProjectDocument) =>
        document.route.biomes
          .find((plan) => plan.biomeKey === shop.biomeKey)
          ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === shop.occurrenceId)
          ?.acquisitionSites?.roomExit;

      it('stays invalid once Travel Deal is no longer held', () => {
        const project = underworldWorldShopTravelDealProject();
        expect(order(project, shop)).toContain(refill);
        const settled = settle(project, swapTravelDealAway);
        expect(settled.fault).toBeUndefined();
        expect(order(settled.assembly.project, shop)).toEqual(order(project, shop));
        expect(removedIn(settled, shop)).toBeUndefined();
        expect(settled.assembly.evaluation.findings).toContainEqual(
          expect.objectContaining({
            code: 'shopPurchaseUnavailable',
            evidence: { kind: 'travelDealRefillUnavailable' },
          }),
        );
      });

      // Unbuys the purchase that restocks the refill.
      const undoPurchase: ProjectCommand = {
        kind: 'ReplaceShopPurchaseParticipation',
        offer: createShopOfferAddress(goldenFBiome, shop.occurrenceId, 'MajorNonBoon'),
        purchased: false,
      };

      it('leaves silently with the purchase that restocked it, keeping its item', () => {
        const project = underworldWorldShopTravelDealProject();
        expect(refillItem(project)).toBeDefined();
        const settled = settle(project, undoPurchase);
        expect(settled.fault).toBeUndefined();
        expect(order(settled.assembly.project, shop)).toEqual([]);
        expect(settled.removedStaleActions).toBeUndefined();
        // The refill's item and pickup state stay with the Shop.
        expect(refillItem(settled.assembly.project)).toEqual(refillItem(project));
        expect(site(settled.assembly.project)).toEqual(site(project));
        const { undone } = settleAndUndo(project, undoPurchase);
        expect(order(undone, shop)).toContain(refill);
      });

      it('leaves with the purchase that restocked it once Travel Deal is gone too', () => {
        const lost = settle(underworldWorldShopTravelDealProject(), swapTravelDealAway).assembly
          .project;
        expect(order(lost, shop)).toContain(refill);
        // Trigger and enabler are both gone: the trigger wins, so the refill goes.
        const settled = settle(lost, undoPurchase);
        expect(settled.fault).toBeUndefined();
        expect(order(settled.assembly.project, shop)).toEqual([]);
        expect(settled.removedStaleActions).toBeUndefined();
        expect(refillItem(settled.assembly.project)).toEqual(refillItem(lost));
        expect(site(settled.assembly.project)).toEqual(site(lost));
      });

      it('stays invalid without Travel Deal while a later purchase still stands before it', () => {
        const lost = settle(underworldWorldShopTravelDealProject(), swapTravelDealAway).assembly
          .project;
        const bought = applyProjectCommand(lost, catalog, {
          kind: 'ReplaceShopPurchaseParticipation',
          offer: createShopOfferAddress(goldenFBiome, shop.occurrenceId, 'Minor'),
          purchased: true,
        });
        const minor = roomActionKey({ kind: 'interactShopOffer', offerKey: 'Minor' });
        const project = applyProjectCommand(bought, catalog, {
          kind: 'MoveRoomAction',
          action: createRoomActionAddress(goldenFBiome, shop.occurrenceId, minor),
          toIndex: order(bought, shop).indexOf(refill),
        });
        expect(order(project, shop).indexOf(minor)).toBeLessThan(
          order(project, shop).indexOf(refill),
        );
        // Its first purchase goes; the later one is still a trigger before it.
        const settled = settle(project, undoPurchase);
        expect(settled.fault).toBeUndefined();
        expect(order(settled.assembly.project, shop)).toEqual([minor, refill]);
        expect(removedIn(settled, shop)).toBeUndefined();
        expect(settled.assembly.evaluation.findings).toContainEqual(
          expect.objectContaining({
            code: 'shopPurchaseUnavailable',
            evidence: { kind: 'travelDealRefillUnavailable' },
          }),
        );
      });
    });

    it('keeps a refill placed before Travel Deal was held', () => {
      const shop = createOccurrenceAddress(
        goldenFBiome,
        createOccurrenceId('golden-f-preboss-shop'),
      );
      const refill = roomActionKey({
        kind: 'interactAcquisitionEntry',
        siteKey: 'roomExit',
        entryKey: 'travelDealRefill',
      });
      // Authored without settlement, as an import may place it before its source.
      const project = applyProjectCommand(
        underworldWorldShopTravelDealProject(),
        catalog,
        swapTravelDealAway,
      );
      const settled = settle(project, {
        kind: 'ReplaceShopPurchaseParticipation',
        offer: createShopOfferAddress(goldenFBiome, shop.occurrenceId, 'Minor'),
        purchased: true,
      });
      expect(order(settled.assembly.project, shop)).toContain(refill);
      expect(removedIn(settled, shop)).toBeUndefined();
      expect(settled.assembly.evaluation.findings).toContainEqual(
        expect.objectContaining({
          code: 'shopPurchaseUnavailable',
          evidence: { kind: 'travelDealRefillUnavailable' },
        }),
      );
    });

    it('reports a countdown delivery its unbought purchase took, but not a rushed pickup', () => {
      const shrine = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
      const host = createOccurrenceAddress(oBiome, oOccurrenceIds.devotion);
      const project = createSurfaceNOHermesShrineDeliveryCheckpoint();
      const delivery = roomActionKey({
        kind: 'interactAcquisitionEntry',
        siteKey: 'hermesShrineDelivery',
        entryKey: hermesShrineDeliveryEntryKey(shrine, 'initial:secondLeft'),
        encounterPhaseKey: 'Encounter',
      });
      expect(order(project, host)).toContain(delivery);
      const unbought = settle(project, {
        kind: 'SetHermesShrinePurchase',
        occurrence: shrine,
        generationKey: 'initial:secondLeft',
        purchased: false,
      });
      expect(order(unbought.assembly.project, host)).not.toContain(delivery);
      expect(unbought.removedStaleActions).toEqual([
        { occurrence: host, actions: [expect.anything()] },
      ]);
      expect(removedIn(unbought, host)).toEqual([delivery]);
      expect(
        order(
          settleAndUndo(project, {
            kind: 'SetHermesShrinePurchase',
            occurrence: shrine,
            generationKey: 'initial:secondLeft',
            purchased: false,
          }).undone,
          host,
        ),
      ).toContain(delivery);
      // A rushed item is the purchase's own pickup in its room: it leaves silently.
      const rushed = settle(project, {
        kind: 'SetHermesShrinePurchase',
        occurrence: shrine,
        generationKey: 'initial:first',
        purchased: false,
      });
      expect(
        order(rushed.assembly.project, shrine).some((key) => key.includes('hermesShrineDelivery')),
      ).toBe(false);
      expect(rushed.removedStaleActions).toBeUndefined();
    });

    describe('a Supply Chain drop', () => {
      const p3 = createOccurrenceAddress(
        createBiomeAddress('Surface', 'P'),
        createOccurrenceId('surface-p-1-1-p_combat03'),
      );
      const o = createBiomeAddress('Surface', 'O');
      const drop = (project: ProjectDocument) =>
        order(project, p3).filter((key) => key.includes('clockedTraitGenerated:'));

      it('is removed and reported once its trait is no longer taken', () => {
        const project = loadSurfaceScheduledLifecycleCheckpoint();
        expect(drop(project)).toHaveLength(1);
        const command: ProjectCommand = {
          kind: 'ReplaceTraitSelection',
          trait: createTraitOfferAddress(
            createEncounterPhaseAddress(
              o,
              { kind: 'occurrence', occurrenceId: createOccurrenceId('surface-o-combat01') },
              'Combat1',
            ),
            'selection',
          ),
          selectedOptionKey: 'option2',
        };
        const settled = settle(project, command);
        expect(drop(settled.assembly.project)).toEqual([]);
        expect(removedIn(settled, p3)).toEqual(drop(project));
        expect(drop(settleAndUndo(project, command).undone)).toEqual(drop(project));
      });

      it('leaves silently with a reset of its own room', () => {
        const project = loadSurfaceScheduledLifecycleCheckpoint();
        const settled = settle(project, {
          kind: 'ResetRoomActionsAfter',
          occurrence: p3,
          afterActionKey: null,
        });
        expect(drop(settled.assembly.project)).toEqual([]);
        expect(settled.removedStaleActions).toBeUndefined();
      });

      it('stays invalid when its trait is held but now matures elsewhere', () => {
        // O Combat 2 with a third encounter and its wheel authored, then back to two.
        const combat02 = createOccurrenceAddress(o, createOccurrenceId('surface-o-combat02'));
        const count = (project: ProjectDocument, encounterCount: 2 | 3) =>
          applyProjectCommand(project, catalog, {
            kind: 'ReplaceShipEncounterCount',
            occurrence: combat02,
            encounterCount,
          });
        const three = authorLegalPomResolutions(
          applyProjectCommand(count(loadSurfaceScheduledLifecycleCheckpoint(), 3), catalog, {
            kind: 'ReplaceRewardWheelOffer',
            offer: createRewardWheelOfferAddress(o, combat02.occurrenceId, 'wheel2', 'offer1'),
            value: { rewardType: 'StackUpgrade' },
          }),
        );
        const project = count(three, 2);
        expect(drop(project)).toHaveLength(1);
        const placement = (assembly: ReturnType<typeof evaluate>) =>
          assembly.evaluation.route.biomes
            .flatMap((biome) =>
              'rewards' in biome ? (biome.rewards.generatedPickupPlacements ?? []) : [],
            )
            .find(
              (candidate) =>
                candidate.address.site.owner.kind === 'occurrence' &&
                candidate.address.site.owner.occurrenceId === p3.occurrenceId &&
                candidate.assessment.source.kind === 'clockedTraitPickup',
            )?.assessment;
        expect(placement(evaluate(project))?.kind).toBe('valid');
        // A third encounter matures the trait one encounter sooner.
        const settled = settle(project, {
          kind: 'ReplaceShipEncounterCount',
          occurrence: combat02,
          encounterCount: 3,
        });
        expect(drop(settled.assembly.project)).toEqual(drop(project));
        expect(removedIn(settled, p3)).toBeUndefined();
        expect(placement(settled.assembly)).toMatchObject({
          kind: 'invalid',
          reason: 'dueContactMismatch',
        });
        expect(settled.assembly.evaluation.findings).toContainEqual(
          expect.objectContaining({
            code: 'rewardSourceUnavailable',
            evidence: { reason: 'staleClockedTraitPickup' },
          }),
        );
      });

      it('stays while its room is not reached', () => {
        const project = loadSurfaceScheduledLifecycleCheckpoint();
        const settled = settle(project, {
          kind: 'ReplaceTraitSelection',
          trait: createTraitOfferAddress(
            createIncomingRewardAddress(
              createBiomeAddress('Surface', 'N'),
              createOccurrenceId('surface-n-combat11'),
            ),
            'source',
          ),
          selectedOptionKey: 'option2',
        });
        expect(drop(settled.assembly.project)).toEqual(drop(project));
        expect(removedIn(settled, p3)).toBeUndefined();
      });
    });
  });
  describe('door and cage rerolls', () => {
    const f = createBiomeAddress('Underworld', 'F');
    const h = createBiomeAddress('Underworld', 'H');
    const rerolls = (project: ProjectDocument, source: OccurrenceAddress) =>
      order(project, source).filter((key) => key.startsWith('["reroll"'));
    /** Appends a press of the target to the source's doors and gives it a supported reward. */
    const press = (project: ProjectDocument, source: OccurrenceAddress, target: RerollTarget) => {
      const inserted = applyProjectCommand(project, catalog, {
        kind: 'InsertReroll',
        occurrence: source,
        target,
        reward: { rewardType: 'RoomMoneyDrop' },
        index: order(project, source).length,
      });
      const action = createRoomActionAddress(
        createBiomeAddress(source.routeKey, source.biomeKey),
        source.occurrenceId,
        rerolls(inserted, source).at(-1)!,
      );
      return applyProjectCommand(inserted, catalog, {
        kind: 'ReplaceRerollReward',
        action,
        reward: firstSupportedReroll(inserted, action, 'RunProgress'),
      });
    };
    const removeDoors = (source: OccurrenceAddress): ProjectCommand => ({
      kind: 'RemoveExitDecision',
      decision: createExitDecisionAddress(createBiomeAddress(source.routeKey, source.biomeKey), {
        kind: 'occurrence',
        occurrenceId: source.occurrenceId,
      }),
    });

    it('leave silently when the door they reroll is removed', () => {
      const source = createOccurrenceAddress(f, createOccurrenceId('golden-f-b2-e1'));
      const project = press(withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']), source, {
        kind: 'door',
        exitKey: 'exit2',
        occurrenceId: createOccurrenceId('golden-f-b3-e2'),
      });
      expect(rerolls(project, source)).toHaveLength(1);
      const settled = settle(project, removeDoors(source));
      expect(settled.fault).toBeUndefined();
      expect(rerolls(settled.assembly.project, source)).toEqual([]);
      expect(settled.removedStaleActions).toBeUndefined();
    });

    it('leave silently when the door to the cage they reroll is removed', () => {
      const source = createOccurrenceAddress(h, createOccurrenceId('golden-h-miniboss01'));
      const project = press(
        withGoldenUnderworldJudgments(withArcana(loadNemesisFieldsCheckpoint(), ['DoorReroll'])),
        source,
        {
          kind: 'cage',
          exitKey: 'exit1',
          occurrenceId: createOccurrenceId('golden-h-combat05'),
          slotKey: 'cage1',
        },
      );
      expect(rerolls(project, source)).toHaveLength(1);
      const settled = settle(project, removeDoors(source));
      expect(settled.fault).toBeUndefined();
      expect(rerolls(settled.assembly.project, source)).toEqual([]);
      expect(settled.removedStaleActions).toBeUndefined();
    });

    describe('whose reward is gone', () => {
      // The H intro's doors play Combat 2's third cage only at their maximum cage outcome.
      const intro = createOccurrenceAddress(h, createOccurrenceId('golden-h-intro'));
      const combat02 = createOccurrenceAddress(h, createOccurrenceId('golden-h-combat02'));
      const cage3: RerollTarget = {
        kind: 'cage',
        exitKey: 'exit1',
        occurrenceId: combat02.occurrenceId,
        slotKey: 'cage3',
      };
      const outcome = (cageOutcome: 'min' | 'max'): ProjectCommand => ({
        kind: 'ReplaceFieldsCageOutcome',
        decision: createExitDecisionAddress(h, {
          kind: 'occurrence',
          occurrenceId: intro.occurrenceId,
        }),
        cageOutcome,
      });
      const fields = () =>
        withGoldenUnderworldJudgments(withArcana(loadNemesisFieldsCheckpoint(), ['DoorReroll']));
      const thirdCage = [
        { kind: 'completeFieldsCage', phaseKey: 'Cage03' },
        { kind: 'interactLocalReward', groupKey: 'cages', slotKey: 'cage3' },
      ];

      it('leave silently when the cage they reroll is no longer played, and do not return', () => {
        const project = press(settle(fields(), outcome('max')).assembly.project, intro, cage3);
        expect(rerolls(project, intro)).toHaveLength(1);
        const lowered = settle(project, outcome('min'));
        expect(lowered.fault).toBeUndefined();
        expect(rerolls(lowered.assembly.project, intro)).toEqual([]);
        // Only the cage's own rows, in its room, are announced.
        expect(lowered.removedStaleActions).toEqual([{ occurrence: combat02, actions: thirdCage }]);
        const raised = settle(lowered.assembly.project, outcome('max'));
        expect(rerolls(raised.assembly.project, intro)).toEqual([]);
      });

      it('stay invalid when placed after their cage already stopped playing', () => {
        const project = fields();
        const settled = settle(project, {
          kind: 'InsertReroll',
          occurrence: intro,
          target: cage3,
          reward: { rewardType: 'RoomMoneyDrop' },
          index: order(project, intro).length,
        });
        expect(settled.fault).toBeUndefined();
        expect(rerolls(settled.assembly.project, intro)).toHaveLength(1);
        expect(settled.assembly.evaluation.findings).toContainEqual(
          expect.objectContaining({
            code: 'rerollTargetUnavailable',
            evidence: { reason: 'cageNotPlayed' },
          }),
        );
      });
    });

    describe('when their door’s source room loses it', () => {
      const source = createOccurrenceAddress(h, createOccurrenceId('golden-h-miniboss01'));
      const target = {
        kind: 'cage',
        exitKey: 'exit2',
        occurrenceId: createOccurrenceId('golden-h-combat04'),
        slotKey: 'cage1',
      } as const;
      const pressed = (exitKey: 'exit1' | 'exit2') =>
        press(
          applyProjectCommand(
            withGoldenUnderworldJudgments(
              withArcana(loadNemesisFieldsCheckpoint(), ['DoorReroll']),
            ),
            catalog,
            {
              kind: 'SetExitSelection',
              selection: createExitSelectionAddress(h, source),
              value: { kind: 'normal', exitKey },
            },
          ),
          source,
          target,
        );
      // Miniboss 2 has one door.
      const swap = {
        kind: 'ReplaceOccurrenceRoom',
        occurrence: source,
        gameName: 'H_MiniBoss02',
      } as const;

      it('go with an unselected door, silently in the edited room', () => {
        const project = pressed('exit1');
        expect(rerolls(project, source)).toHaveLength(1);
        const settled = settle(project, swap);
        expect(settled.fault).toBeUndefined();
        expect(rerolls(settled.assembly.project, source)).toEqual([]);
        expect(settled.removedStaleActions).toBeUndefined();
      });

      it('stay invalid at a selected door, an owner’s route decision', () => {
        const project = pressed('exit2');
        expect(rerolls(project, source)).toHaveLength(1);
        const settled = settle(project, swap);
        expect(settled.fault).toBeUndefined();
        expect(rerolls(settled.assembly.project, source)).toEqual(rerolls(project, source));
        expect(settled.assembly.evaluation.findings).toContainEqual(
          expect.objectContaining({
            code: 'targetRoomUnavailable',
            evidence: expect.objectContaining({ exclusionReasons: ['physicalExitUnavailable'] }),
          }),
        );
      });
    });

    it('stay out of order before the doors they redraw open', () => {
      const source = createOccurrenceAddress(h, createOccurrenceId('golden-h-miniboss01'));
      const project = withGoldenUnderworldJudgments(
        withArcana(loadNemesisFieldsCheckpoint(), ['DoorReroll']),
      );
      const settled = settle(project, {
        kind: 'InsertReroll',
        occurrence: source,
        target: {
          kind: 'cage',
          exitKey: 'exit1',
          occurrenceId: createOccurrenceId('golden-h-combat05'),
          slotKey: 'cage1',
        },
        reward: { rewardType: 'RoomMoneyDrop' },
        index: 0,
      });
      expect(settled.fault).toBeUndefined();
      expect(rerolls(settled.assembly.project, source)).toHaveLength(1);
      expect(settled.assembly.evaluation.findings).toContainEqual(
        expect.objectContaining({
          code: 'roomActionOrderUnavailable',
          evidence: expect.objectContaining({ reason: 'requiredFirst' }),
        }),
      );
    });

    it('stay invalid at a door the game refuses, its reward still there', () => {
      // F Combat 10's first door leads to the Preboss Shop, which refuses door rerolls.
      const source = createOccurrenceAddress(f, createOccurrenceId('golden-f-b10-e1'));
      const project = withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']);
      const settled = settle(project, {
        kind: 'InsertReroll',
        occurrence: source,
        target: {
          kind: 'door',
          exitKey: 'exit1',
          occurrenceId: createOccurrenceId('golden-f-preboss-shop'),
        },
        reward: { rewardType: 'RoomMoneyDrop' },
        index: order(project, source).length,
      });
      expect(settled.fault).toBeUndefined();
      expect(rerolls(settled.assembly.project, source)).toHaveLength(1);
      expect(settled.removedStaleActions).toBeUndefined();
      expect(settled.assembly.evaluation.findings).toContainEqual(
        expect.objectContaining({
          code: 'rerollTargetUnavailable',
          evidence: { reason: 'notRerollable' },
        }),
      );
    });

    it('leave a Hub reroll of a slot the board closes for repair', () => {
      const n = createBiomeAddress('Surface', 'N');
      const hub = {
        kind: 'hubDecision',
        routeKey: 'Surface',
        biomeKey: 'N',
        hubKey: 'hub',
      } as const;
      const hubRerolls = (project: ProjectDocument) =>
        project.route.biomes[0]!.topology!.decisions.flatMap((decision) =>
          decision.kind === 'hub'
            ? decision.actions.filter((action) => action.kind === 'reroll')
            : [],
        );
      const project = applyProjectCommand(
        withArcana(loadSurfaceNProject(), ['DoorReroll']),
        catalog,
        {
          kind: 'InsertHubReroll',
          hub,
          hubSlotKey: 'combat03',
          reward: { rewardType: 'MaxHealthDrop' },
          index: 0,
        },
      );
      expect(hubRerolls(project)).toHaveLength(1);
      const settled = settle(project, {
        kind: 'CloseHubSlot',
        slot: createHubSlotAddress(n, 'hub', 'combat03'),
      });
      expect(settled.fault).toBeUndefined();
      expect(hubRerolls(settled.assembly.project)).toEqual(hubRerolls(project));
      expect(settled.removedStaleActions).toBeUndefined();
      expect(settled.assembly.evaluation.findings).toContainEqual(
        expect.objectContaining({
          code: 'rerollTargetUnavailable',
          origin: expect.objectContaining({ kind: 'hubReroll' }),
        }),
      );
    });
  });
});
