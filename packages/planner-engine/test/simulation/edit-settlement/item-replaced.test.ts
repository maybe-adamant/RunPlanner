import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  SEA_STAR_DUPLICATE_ENTRY_KEY,
  seaStarDuplicateSiteKey,
  createAcquisitionSiteAddress,
  createHubRerollAddress,
  createRewardWheelAddress,
  createRoomActionAddress,
  roomActionDomainForOccurrence,
  createShopOfferAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  hermesShrineDeliveryEntryKey,
  roomActionKey,
  type OccurrenceAddress,
  type ProjectCommand,
  type ProjectDocument,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';
import {
  liveActionsForProjectEvaluationAssembly,
  settleProjectEdit,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { loadCheckpoint } from '@run-planner/test-fixtures/checkpoints/registry';

import {
  candidateBiome,
  candidateBiomeRooms,
} from '../../../src/simulation/candidates/evaluated-biome';
import { createGoldenFGHProject } from '@run-planner/test-fixtures/underworld';
import { createSurfaceOSameRoomHermesDeliveriesCheckpoint } from '@run-planner/test-fixtures/surface';
import {
  collectTestRequiredItems,
  placeTestLivePickupsAtSite,
} from '@run-planner/test-fixtures/shared';
import { roomActionsOnReplacedItems } from '../../../src/authored-project/room-actions/replaced-items';
import { withArcana, withGoldenUnderworldJudgments, withJudgment } from '../../support/rerolls';
import { liveInteractionsForProjectEvaluationAssembly } from '../../../src/simulation/evaluation/live-interactions';

const f = createBiomeAddress('Underworld', 'F');
const g = createBiomeAddress('Underworld', 'G');
const at = (biome: typeof f, id: string) => createOccurrenceAddress(biome, createOccurrenceId(id));
const evaluate = (project: ProjectDocument) => simulateProjectAssembly(catalog, project);
const settle = (project: ProjectDocument, command: ProjectCommand) =>
  settleProjectEdit({ catalog, before: evaluate(project), command, evaluate });
const order = (project: ProjectDocument, room: OccurrenceAddress) =>
  project.route.biomes
    .find((plan) => plan.biomeKey === room.biomeKey)!
    .topology!.occurrences.find((candidate) => candidate.occurrenceId === room.occurrenceId)!
    .roomActions.order;
const holds = (project: ProjectDocument, room: OccurrenceAddress, reference: RoomActionReference) =>
  order(project, room).some((candidate) => roomActionKey(candidate) === roomActionKey(reference));
/** The roster row of a reached room, by its action. */
const rosterRow = (
  project: ProjectDocument,
  room: OccurrenceAddress,
  reference: RoomActionReference,
) => {
  const biome = candidateBiome(evaluate(project).evaluation, room.routeKey, room.biomeKey);
  if (biome === undefined) return undefined;
  return candidateBiomeRooms(biome)
    .find(
      (candidate) =>
        candidate.origin.kind === 'occurrence' &&
        candidate.origin.occurrenceId === room.occurrenceId,
    )
    ?.roomActionRoster.rows.find((row) => row.key === roomActionKey(reference));
};
const roomOf = (project: ProjectDocument, room: OccurrenceAddress) =>
  project.route.biomes
    .find((plan) => plan.biomeKey === room.biomeKey)!
    .topology!.occurrences.find((candidate) => candidate.occurrenceId === room.occurrenceId)!;
/** The F Combat switch observed as a hitless Max Health PerfectClear, used and its claim picked up. */
const withSwitchClaimed = () => {
  const room = at(f, 'golden-f-b5-e1');
  let project = applyProjectCommand(loadCheckpoint('underworld-fghi'), catalog, {
    kind: 'ReplaceChallengeSwitch',
    occurrence: room,
    variantKey: 'PerfectClearChallengeSwitch_MaxHealth',
  });
  const press = { kind: 'interactChallengeSwitch' } as const;
  project = applyProjectCommand(project, catalog, {
    kind: 'InsertRoomAction',
    action: createRoomActionAddress(f, room.occurrenceId, roomActionKey(press)),
    reference: press,
    index: order(project, room).length,
  });
  return placeTestLivePickupsAtSite(project, room, 'challengeSwitch');
};
const pickup = {
  kind: 'interactIncomingReward',
  producerPoint: 'roomRewardPickup',
  acquisitionRole: 'source',
} as const;
const boon = (source: string) =>
  ({ rewardType: 'Boon', payload: { kind: 'BoonSource', source } }) as const;

describe('rows on a replaced item in edit settlement', () => {
  describe('a same-key swap', () => {
    const room = at(f, 'golden-f-b2-e1');
    const swap: ProjectCommand = {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(f, room.occurrenceId),
      value: boon('HeraUpgrade'),
    };

    it('leaves the row ranked on the replaced item, never executed, with its finding', () => {
      const swapped = applyProjectCommand(loadCheckpoint('underworld-fg'), catalog, swap);
      expect(holds(swapped, room, pickup)).toBe(true);
      expect(rosterRow(swapped, room, pickup)).toMatchObject({
        rank: 1,
        itemReplaced: true,
        executable: false,
      });
      expect(evaluate(swapped).evaluation.findings).toContainEqual(
        expect.objectContaining({ code: 'roomActionItemReplaced' }),
      );
    });

    it('removes the row silently in the room it addresses; the new item is live', () => {
      const settled = settle(loadCheckpoint('underworld-fg'), swap);
      expect(settled.fault).toBeUndefined();
      expect(holds(settled.assembly.project, room, pickup)).toBe(false);
      expect(settled.removedStaleActions).toBeUndefined();
      expect(rosterRow(settled.assembly.project, room, pickup)).toMatchObject({
        rank: null,
        reference: { ...pickup, content: ['native', 'Boon', 'HeraUpgrade'] },
      });
      expect(
        settled.assembly.evaluation.findings.some(
          (finding) => finding.code === 'roomActionItemReplaced',
        ),
      ).toBe(false);
    });
  });

  it('removes a Shop purchase whose option changes', () => {
    const shop = at(f, 'golden-f-preboss-shop');
    const offer = createShopOfferAddress(f, shop.occurrenceId, 'Minor');
    const bought = applyProjectCommand(
      loadCheckpoint('underworld-world-shop-travel-deal'),
      catalog,
      {
        kind: 'ReplaceShopPurchaseParticipation',
        offer,
        purchased: true,
      },
    );
    const purchase = { kind: 'interactShopOffer', offerKey: 'Minor' } as const;
    expect(order(bought, shop)).toContainEqual({
      ...purchase,
      content: ['MaxManaDrop', 'MaxManaDrop'],
    });
    const settled = settle(bought, {
      kind: 'ReplaceShopOfferOption',
      offer,
      value: { optionKey: 'SpellDrop', offer: { rewardType: 'SpellDrop' } },
    });
    expect(settled.fault).toBeUndefined();
    expect(holds(settled.assembly.project, shop, purchase)).toBe(false);
  });

  describe('a Well purchase', () => {
    const well = at(f, 'golden-f-preboss-shop:postboss');
    const purchase = {
      kind: 'purchaseStygianWellOffer',
      generationKey: 'initial:secondLeft',
    } as const;
    const pin = (itemKey: string | null): ProjectCommand => ({
      kind: 'ReplaceStygianWellOffer',
      occurrence: well,
      slotKey: 'secondLeft',
      itemKey,
    });

    it('goes when its pin changes to another item', () => {
      const settled = settle(loadCheckpoint('underworld-f-stygian-well'), pin('ExtendedShopTrait'));
      expect(settled.fault).toBeUndefined();
      expect(holds(settled.assembly.project, well, purchase)).toBe(false);
    });

    it('stays through unpinning, and goes when re-pinned to another item', () => {
      const unpinned = settle(loadCheckpoint('underworld-f-stygian-well'), pin(null)).assembly
        .project;
      expect(order(unpinned, well)).toContainEqual({
        ...purchase,
        content: ['TemporaryBoonRarityTrait'],
      });
      expect(
        holds(settle(unpinned, pin('TemporaryBoonRarityTrait')).assembly.project, well, purchase),
      ).toBe(true);
      expect(
        holds(settle(unpinned, pin('ExtendedShopTrait')).assembly.project, well, purchase),
      ).toBe(false);
    });
  });

  it('removes a Shrine purchase whose slot is restocked with another item', () => {
    const shrine = at(createBiomeAddress('Surface', 'N'), 'surface-n-preboss:postboss');
    const purchase = { kind: 'purchaseHermesShrineOffer', generationKey: 'initial:first' } as const;
    const project = loadCheckpoint('surface-shrine-travel-deal');
    expect(holds(project, shrine, purchase)).toBe(true);
    const restock: ProjectCommand = {
      kind: 'ReplaceHermesShrineOffer',
      occurrence: shrine,
      slotKey: 'first',
      value: { rewardType: 'MaxManaDrop' },
    };
    // The command itself keeps the purchase; it is the replaced item that takes it.
    expect(holds(applyProjectCommand(project, catalog, restock), shrine, purchase)).toBe(true);
    const settled = settle(project, restock);
    expect(settled.fault).toBeUndefined();
    expect(holds(settled.assembly.project, shrine, purchase)).toBe(false);
  });

  it('removes a wheel reward pickup when another offer is picked', () => {
    const o = createBiomeAddress('Surface', 'O');
    const room = at(o, 'surface-o-combat01');
    const wheel = createRewardWheelAddress(o, room.occurrenceId, 'wheel1');
    const reward = { kind: 'interactWheelReward', wheelKey: 'wheel1' } as const;
    let project = applyProjectCommand(loadCheckpoint('surface-no'), catalog, {
      kind: 'ReplaceRewardWheelOfferCount',
      wheel,
      offerCount: 2,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: { ...wheel, kind: 'rewardWheelOffer', offerKey: 'offer2' },
      value: { rewardType: 'MaxHealthDrop' },
    });
    expect(holds(project, room, reward)).toBe(true);
    const settled = settle(project, {
      kind: 'ReplaceRewardWheelPicked',
      wheel,
      pickedOfferIndex: 2,
    });
    expect(settled.fault).toBeUndefined();
    expect(holds(settled.assembly.project, room, reward)).toBe(false);
  });

  describe('across rooms', () => {
    /** Presses the door into `target`, which redraws its Boon as another god's: a new item. */
    const press = (source: OccurrenceAddress, target: string): ProjectCommand => ({
      kind: 'InsertReroll',
      occurrence: source,
      target: { kind: 'door', exitKey: 'exit1', occurrenceId: createOccurrenceId(target) },
      reward: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
      index: 0,
    });
    const withPressIndex = (project: ProjectDocument, command: ProjectCommand) =>
      command.kind === 'InsertReroll'
        ? { ...command, index: order(project, command.occurrence).length }
        : command;

    it('announces a removal in the room whose item an edit elsewhere replaced', () => {
      const project = withArcana(loadCheckpoint('underworld-fg'), ['DoorReroll']);
      const source = at(f, 'golden-f-b5-e1');
      const target = at(f, 'golden-f-b6-e1');
      const settled = settle(project, withPressIndex(project, press(source, target.occurrenceId)));
      expect(settled.fault).toBeUndefined();
      expect(holds(settled.assembly.project, target, pickup)).toBe(false);
      expect(settled.removedStaleActions).toEqual([
        {
          occurrence: target,
          actions: [{ ...pickup, content: ['native', 'Boon', 'HeraUpgrade'] }],
        },
      ]);
    });

    it('removes and announces it in a room the walk does not reach', () => {
      // A saved row on a replaced item in F stops the walk there; G is not reached.
      const raw = JSON.parse(encodeProjectDocument(loadCheckpoint('underworld-fg')));
      raw.route.biomes[0].topology.occurrences.find(
        (candidate: { occurrenceId: string }) => candidate.occurrenceId === 'golden-f-b2-e1',
      ).roomActions.order[0].content = ['native', 'Boon', 'HeraUpgrade'];
      const project = decodeProjectDocument(raw, catalog);
      const source = at(g, 'golden-g-b5-e1');
      const target = at(g, 'golden-g-b6-e1');
      expect(rosterRow(project, target, pickup)).toBeUndefined();
      const settled = settle(project, withPressIndex(project, press(source, target.occurrenceId)));
      expect(settled.fault).toBeUndefined();
      expect(holds(settled.assembly.project, target, pickup)).toBe(false);
      expect(settled.removedStaleActions).toEqual([
        {
          occurrence: target,
          actions: [{ ...pickup, content: ['native', 'Boon', 'HestiaUpgrade'] }],
        },
      ]);
      // The saved one is kept, with its finding, until its own room is edited.
      expect(holds(settled.assembly.project, at(f, 'golden-f-b2-e1'), pickup)).toBe(true);
    });
  });

  it('stamps a row of an observed item before an edit swaps it, so the swap replaces it', () => {
    // A saved row that recorded no content, on an item already observed as Zeus.
    const room = at(f, 'golden-f-b2-e1');
    const raw = JSON.parse(encodeProjectDocument(loadCheckpoint('underworld-fg')));
    delete raw.route.biomes[0].topology.occurrences.find(
      (candidate: { occurrenceId: string }) => candidate.occurrenceId === room.occurrenceId,
    ).roomActions.order[0].content;
    const unstamped = decodeProjectDocument(raw, catalog);
    expect(order(unstamped, room)[0]).toEqual(pickup);
    const swap: ProjectCommand = {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(f, room.occurrenceId),
      value: boon('HeraUpgrade'),
    };
    const swapped = applyProjectCommand(unstamped, catalog, swap);
    expect(order(swapped, room)[0]).toEqual({
      ...pickup,
      content: ['native', 'Boon', 'ZeusUpgrade'],
    });
    expect(rosterRow(swapped, room, pickup)).toMatchObject({ itemReplaced: true });
    expect(holds(settle(unstamped, swap).assembly.project, room, pickup)).toBe(false);
  });

  describe('in the live product', () => {
    const room = at(f, 'golden-f-b2-e1');
    const swapped = () =>
      applyProjectCommand(loadCheckpoint('underworld-fg'), catalog, {
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(f, room.occurrenceId),
        value: boon('HeraUpgrade'),
      });
    const current = { ...pickup, content: ['native', 'Boon', 'HeraUpgrade'] };

    it('is its current item, unplaced with its place verb, never placed or standing', () => {
      const project = swapped();
      const assembly = evaluate(project);
      const live = liveActionsForProjectEvaluationAssembly(catalog, assembly, room)!;
      const actions = live.gaps.flatMap((gap) =>
        gap.items.flatMap((item) =>
          item.actions.filter(
            (action) => roomActionKey(action.reference) === roomActionKey(pickup),
          ),
        ),
      );
      expect(actions.some((action) => action.kind === 'placed')).toBe(false);
      expect(actions.length).toBeGreaterThan(0);
      for (const action of actions) {
        expect(action).toMatchObject({ kind: 'place', reference: current });
        expect(action.kind === 'place' && action.command).toMatchObject({
          kind: 'InsertRoomAction',
          reference: current,
        });
      }
      // The Timeline's reward entry offers placing the new reward, never a standing row.
      const verbs = liveInteractionsForProjectEvaluationAssembly(
        catalog,
        assembly,
        room,
      )!.gaps.flatMap((gap) =>
        gap.items.flatMap((item) =>
          item.verbs.filter(
            (verb) =>
              verb.reference !== undefined &&
              roomActionKey(verb.reference) === roomActionKey(pickup),
          ),
        ),
      );
      expect(verbs.length).toBeGreaterThan(0);
      expect(verbs.some((verb) => verb.standing === true)).toBe(false);
      // Placing it takes the replaced row's place.
      const place = actions.find((action) => action.kind === 'place');
      const placed = applyProjectCommand(
        project,
        catalog,
        place!.kind === 'place' ? place!.command : swap(),
      );
      expect(order(placed, room)).toEqual([current]);
      expect(
        evaluate(placed).evaluation.findings.some(
          (finding) => finding.code === 'roomActionItemReplaced',
        ),
      ).toBe(false);
    });

    function swap(): ProjectCommand {
      throw new Error('no place action');
    }
  });

  describe('presses', () => {
    const fBase = () => withArcana(loadCheckpoint('underworld-fg'), ['DoorReroll']);
    const source = at(f, 'golden-f-b5-e1');
    const target = at(f, 'golden-f-b6-e1');
    const pressOf = (project: ProjectDocument, rewardType = 'RoomMoneyDrop'): ProjectCommand => ({
      kind: 'InsertReroll',
      occurrence: source,
      target: { kind: 'door', exitKey: 'exit1', occurrenceId: target.occurrenceId },
      reward: { rewardType },
      index: order(project, source).length,
    });
    /** Places the target's current pickups, as the live product does. */
    const placeTarget = (project: ProjectDocument) => {
      const domain = roomActionDomainForOccurrence(project, catalog, f, target.occurrenceId)!;
      return domain.domain.contributions.reduce(
        (current, entry) =>
          entry.reference.kind === 'interactIncomingReward'
            ? applyProjectCommand(current, catalog, {
                kind: 'InsertRoomAction',
                action: createRoomActionAddress(
                  f,
                  target.occurrenceId,
                  roomActionKey(entry.reference),
                ),
                reference: entry.reference,
                index: order(current, target).length,
              })
            : current,
        project,
      );
    };
    const pressRows = (project: ProjectDocument) =>
      order(project, source).filter((reference) => reference.kind === 'reroll');
    const twoPresses = () => {
      let project = settle(fBase(), pressOf(fBase())).assembly.project;
      project = settle(project, pressOf(project, 'MaxManaDrop')).assembly.project;
      return placeTarget(project);
    };
    const targetPickups = (project: ProjectDocument) =>
      order(project, target).filter((reference) => reference.kind === 'interactIncomingReward');

    it('removing the last press returns its target to the earlier press: a new item', () => {
      const project = twoPresses();
      expect(targetPickups(project)).not.toEqual([]);
      const last = pressRows(project).at(-1)!;
      const settled = settle(project, {
        kind: 'RemoveRoomAction',
        action: createRoomActionAddress(f, source.occurrenceId, roomActionKey(last)),
      });
      expect(settled.fault).toBeUndefined();
      expect(targetPickups(settled.assembly.project)).toEqual([]);
      expect(settled.removedStaleActions).toEqual([
        { occurrence: target, actions: targetPickups(project) },
      ]);
    });

    it('reordering two presses changes which is effective: a new item', () => {
      const project = twoPresses();
      const first = pressRows(project)[0]!;
      const settled = settle(project, {
        kind: 'MoveRoomAction',
        action: createRoomActionAddress(f, source.occurrenceId, roomActionKey(first)),
        toIndex: order(project, source).length - 1,
      });
      expect(settled.fault).toBeUndefined();
      expect(targetPickups(settled.assembly.project)).toEqual([]);
      expect(settled.removedStaleActions).toEqual([
        { occurrence: target, actions: targetPickups(project) },
      ]);
    });

    it('a cage press replaces the cage reward', () => {
      const h = createBiomeAddress('Underworld', 'H');
      const intro = at(h, 'golden-h-intro');
      const combat02 = at(h, 'golden-h-combat02');
      const project = withGoldenUnderworldJudgments(
        withArcana(loadCheckpoint('nemesis-h-fields'), ['DoorReroll']),
      );
      const cage1 = { kind: 'interactLocalReward', groupKey: 'cages', slotKey: 'cage1' } as const;
      expect(holds(project, combat02, cage1)).toBe(true);
      const settled = settle(project, {
        kind: 'InsertReroll',
        occurrence: intro,
        target: {
          kind: 'cage',
          exitKey: 'exit1',
          occurrenceId: combat02.occurrenceId,
          slotKey: 'cage1',
        },
        reward: { rewardType: 'RoomMoneyDrop' },
        index: order(project, intro).length,
      });
      expect(settled.fault).toBeUndefined();
      expect(holds(settled.assembly.project, combat02, cage1)).toBe(false);
      expect(settled.removedStaleActions).toEqual([
        { occurrence: combat02, actions: [{ ...cage1, content: ['native', 'MaxHealthDrop'] }] },
      ]);
    });

    it('a wheel press replaces the picked offer, silently in its own room', () => {
      const o = createBiomeAddress('Surface', 'O');
      const ship = at(o, 'surface-o-combat04');
      const project = withJudgment(
        withArcana(loadCheckpoint('surface-no'), ['DoorReroll']),
        'N',
        'surface-n-preboss:boss',
        ['ScreenReroll', 'TradeOff', 'StartingGold', 'HealthRegen', 'BonusDodge'],
      );
      const reward = { kind: 'interactWheelReward', wheelKey: 'wheel1' } as const;
      expect(holds(project, ship, reward)).toBe(true);
      const settled = settle(project, {
        kind: 'InsertReroll',
        occurrence: ship,
        target: { kind: 'wheelOffer', wheelKey: 'wheel1', offerKey: 'offer1' },
        reward: { rewardType: 'MaxManaDrop' },
        index: order(project, ship).findIndex(
          (reference) => reference.kind === 'chooseRewardWheel',
        ),
      });
      expect(settled.fault).toBeUndefined();
      expect(holds(settled.assembly.project, ship, reward)).toBe(false);
      expect(settled.removedStaleActions).toBeUndefined();
    });

    it('a Hub press replaces its board room’s reward, announced', () => {
      const n = createBiomeAddress('Surface', 'N');
      const combat05 = at(n, 'surface-n-combat05');
      const project = withArcana(loadCheckpoint('surface-n'), ['DoorReroll']);
      const hubPickup = { ...pickup, acquisitionRole: 'self' } as const;
      expect(holds(project, combat05, hubPickup)).toBe(true);
      const settled = settle(project, {
        kind: 'InsertHubReroll',
        hub: { kind: 'hubDecision', routeKey: 'Surface', biomeKey: 'N', hubKey: 'hub' },
        hubSlotKey: 'combat05',
        reward: { rewardType: 'MaxHealthDrop' },
        index: 0,
      });
      expect(settled.fault).toBeUndefined();
      expect(holds(settled.assembly.project, combat05, hubPickup)).toBe(false);
      expect(settled.removedStaleActions).toEqual([
        { occurrence: combat05, actions: [{ ...hubPickup, content: ['native', 'HermesUpgrade'] }] },
      ]);
      void createHubRerollAddress;
    });
  });

  it('removes a derived entry’s pickup whose payload is redrawn as another item', () => {
    const h = createBiomeAddress('Underworld', 'H');
    const combat05 = at(h, 'golden-h-combat05');
    const result = {
      kind: 'interactAcquisitionEntry',
      siteKey: 'nemesisGenerated:Passive',
      entryKey: 'result',
    } as const;
    const project = loadCheckpoint('nemesis-h-fields');
    expect(holds(project, combat05, result)).toBe(true);
    const edit: ProjectCommand = {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry: createAcquisitionEntryAddress(
        createAcquisitionSiteAddress(combat05, result.siteKey),
        result.entryKey,
      ),
      value: { rewardType: 'HealDrop' },
    };
    // The command keeps the row; the replaced pass removes it.
    expect(holds(applyProjectCommand(project, catalog, edit), combat05, result)).toBe(true);
    const settled = settle(project, edit);
    expect(settled.fault).toBeUndefined();
    expect(holds(settled.assembly.project, combat05, result)).toBe(false);
    // The new result is the entry's observation: it stays, live to be picked up.
    expect(
      roomOf(settled.assembly.project, combat05).acquisitionSites?.[result.siteKey]?.pickupEntries
        ?.result?.offer,
    ).toEqual({ rewardType: 'HealDrop' });
  });

  describe('keeps each derived entry’s new observation when its pickup goes', () => {
    it('an Artificer replacement', () => {
      const project = loadCheckpoint('underworld-f-duo-exchange-order');
      const room = at(f, 'f4adb787-5267-4ce6-8712-e53744e505ff');
      const row = order(project, room).find(
        (reference) =>
          reference.kind === 'interactAcquisitionEntry' &&
          reference.entryKey.startsWith('artificer:'),
      );
      if (row?.kind !== 'interactAcquisitionEntry') throw new Error('Artificer pickup is missing');
      const value = { rewardType: 'MaxManaDrop' } as const;
      const settled = settle(project, {
        kind: 'ReplaceAcquisitionEntryOffer',
        // The row names the site by its storage key, whose last part is its point.
        entry: createAcquisitionEntryAddress(
          createAcquisitionSiteAddress(room, (JSON.parse(row.siteKey) as string[]).at(-1)!),
          row.entryKey,
        ),
        value,
      });
      expect(settled.fault).toBeUndefined();
      expect(holds(settled.assembly.project, room, row)).toBe(false);
      expect(
        roomOf(settled.assembly.project, room).acquisitionSites?.[row.siteKey]?.pickupEntries?.[
          row.entryKey
        ],
      ).toMatchObject({ offer: value });
    });

    it('a Travel Deal refill', () => {
      const project = loadCheckpoint('underworld-world-shop-travel-deal');
      const shop = at(f, 'golden-f-preboss-shop');
      const refill = {
        kind: 'interactAcquisitionEntry',
        siteKey: 'roomExit',
        entryKey: 'travelDealRefill',
      } as const;
      expect(holds(project, shop, refill)).toBe(true);
      const value = { rewardType: 'MaxManaDrop' } as const;
      const settled = settle(project, {
        kind: 'ReplaceShopOffer',
        offer: createShopOfferAddress(f, shop.occurrenceId, 'travelDealRefill'),
        value,
      });
      expect(settled.fault).toBeUndefined();
      expect(holds(settled.assembly.project, shop, refill)).toBe(false);
      const state = roomOf(settled.assembly.project, shop).state;
      expect(state.kind === 'shop' && state.shop?.travelDealRefill?.reward?.offer).toEqual(value);
      // No stale refill payload is put back beside the Shop's own.
      expect(
        roomOf(settled.assembly.project, shop).acquisitionSites?.roomExit?.pickupEntries?.[
          refill.entryKey
        ],
      ).toBeUndefined();
    });

    it('a challenge switch claim', () => {
      const project = withSwitchClaimed();
      const room = at(f, 'golden-f-b5-e1');
      const claim = order(project, room).find(
        (reference) =>
          reference.kind === 'interactAcquisitionEntry' && reference.siteKey === 'challengeSwitch',
      );
      if (claim?.kind !== 'interactAcquisitionEntry') throw new Error('switch claim is missing');
      const before = roomOf(project, room).acquisitionSites?.challengeSwitch?.pickupEntries?.[
        claim.entryKey
      ];
      expect(before?.offer).toEqual({ rewardType: 'MaxHealthDrop' });
      const settled = settle(project, {
        kind: 'ReplaceChallengeSwitch',
        occurrence: room,
        variantKey: 'PerfectClearChallengeSwitch_Pom',
      });
      expect(settled.fault).toBeUndefined();
      expect(holds(settled.assembly.project, room, claim)).toBe(false);
      // The old variant's reward is not put back; the new variant's claim is its own.
      expect(
        roomOf(settled.assembly.project, room).acquisitionSites?.challengeSwitch?.pickupEntries?.[
          claim.entryKey
        ]?.offer,
      ).not.toEqual({ rewardType: 'MaxHealthDrop' });
    });
  });

  it('judges a Sea Star duplicate’s pickup by its payload, as the replaced pass does', () => {
    const room = at(f, 'golden-f-b1-e1');
    const reward = createIncomingRewardAddress(f, room.occurrenceId);
    const acquisition = createAcquisitionRoleAddress(reward, 'self');
    const duplicate = {
      kind: 'interactAcquisitionEntry',
      siteKey: seaStarDuplicateSiteKey(acquisition),
      entryKey: SEA_STAR_DUPLICATE_ENTRY_KEY,
    } as const;
    let project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: { rewardType: 'RoomMoneyDrop' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSeaStarResult',
      acquisition,
      procced: true,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'InsertRoomAction',
      action: createRoomActionAddress(f, room.occurrenceId, roomActionKey(duplicate)),
      reference: duplicate,
      index: order(project, room).length,
    });
    expect(order(project, room)).toContainEqual({ ...duplicate, content: ['RoomMoneyDrop'] });
    // Saved for another item: the roster and the replaced pass judge it alike.
    const raw = JSON.parse(encodeProjectDocument(project));
    for (const reference of raw.route.biomes[0].topology.occurrences.find(
      (candidate: { occurrenceId: string }) => candidate.occurrenceId === room.occurrenceId,
    ).roomActions.order)
      if (reference.entryKey === duplicate.entryKey) reference.content = ['MaxHealthDrop'];
    const saved = decodeProjectDocument(raw, catalog);
    expect(rosterRow(saved, room, duplicate)).toMatchObject({ itemReplaced: true });
    expect(
      roomActionsOnReplacedItems(saved, catalog).flatMap(({ owner, reference }) =>
        owner.occurrenceId === room.occurrenceId ? [roomActionKey(reference)] : [],
      ),
    ).toContain(roomActionKey(duplicate));
    expect(
      roomActionsOnReplacedItems(project, catalog).map(({ reference }) => roomActionKey(reference)),
    ).not.toContain(roomActionKey(duplicate));
  });

  describe('a Hermes delivery', () => {
    /** The host's delivery entry and whether its pickup is placed. */
    const deliveryAt = (
      project: ProjectDocument,
      entry: { site: { owner: unknown }; entryKey: string },
    ) => {
      const host = entry.site.owner as OccurrenceAddress;
      const room = project.route.biomes
        .find((plan) => plan.biomeKey === host.biomeKey)!
        .topology!.occurrences.find((candidate) => candidate.occurrenceId === host.occurrenceId)!;
      return {
        offer: room.acquisitionSites?.hermesShrineDelivery?.pickupEntries?.[entry.entryKey]?.offer,
        placed: room.roomActions.order.some(
          (reference) =>
            reference.kind === 'interactAcquisitionEntry' && reference.entryKey === entry.entryKey,
        ),
      };
    };

    it('keeps a new payload as the live item when its pickup goes', () => {
      const { project, combatEntry } = createSurfaceOSameRoomHermesDeliveriesCheckpoint();
      const host = combatEntry.site.owner as OccurrenceAddress;
      const aphrodite = {
        rewardType: 'BlindBoxLoot',
        payload: { kind: 'BoonSource', source: 'AphroditeUpgrade' },
      } as const;
      expect(deliveryAt(project, combatEntry).placed).toBe(true);
      const settled = settle(project, {
        kind: 'ReplaceAcquisitionEntryOffer',
        entry: combatEntry,
        value: aphrodite,
      });
      expect(settled.fault).toBeUndefined();
      // Silent: the edit addresses the host.
      expect(settled.removedStaleActions).toBeUndefined();
      expect(deliveryAt(settled.assembly.project, combatEntry)).toEqual({
        offer: aphrodite,
        placed: false,
      });
      const key = roomActionKey({
        kind: 'interactAcquisitionEntry',
        siteKey: 'hermesShrineDelivery',
        entryKey: combatEntry.entryKey,
      });
      const live = liveActionsForProjectEvaluationAssembly(catalog, settled.assembly, host)!;
      const actions = live.gaps.flatMap((gap) =>
        gap.items.flatMap((item) =>
          item.actions.filter((action) => roomActionKey(action.reference) === key),
        ),
      );
      expect(actions.length).toBeGreaterThan(0);
      expect(actions.every((action) => action.kind === 'place')).toBe(true);
    });

    const o = createBiomeAddress('Surface', 'O');
    const shrine = at(o, 'surface-o-combat07');
    const host = at(o, 'surface-o-devotion');
    const placedDelivery = (project: ProjectDocument) =>
      order(project, host).find(
        (reference) =>
          reference.kind === 'interactAcquisitionEntry' &&
          reference.siteKey === 'hermesShrineDelivery',
      )!;
    const entryOf = (reference: RoomActionReference) =>
      createAcquisitionEntryAddress(
        createAcquisitionSiteAddress(host, 'hermesShrineDelivery'),
        reference.kind === 'interactAcquisitionEntry' ? reference.entryKey : '',
      );

    it('discards it with its pickup, announced, when its Shrine slot is restocked', () => {
      const project = loadCheckpoint('surface-no-hermes-shrine-delivery');
      const delivery = placedDelivery(project);
      const settled = settle(project, {
        kind: 'ReplaceHermesShrineOffer',
        occurrence: shrine,
        slotKey: 'secondLeft',
        value: { rewardType: 'HealBigDrop' },
      });
      expect(settled.fault).toBeUndefined();
      expect(
        holds(settled.assembly.project, shrine, {
          kind: 'purchaseHermesShrineOffer',
          generationKey: 'initial:secondLeft',
        }),
      ).toBe(false);
      expect(deliveryAt(settled.assembly.project, entryOf(delivery))).toEqual({
        offer: undefined,
        placed: false,
      });
      expect(settled.removedStaleActions).toEqual([
        { occurrence: host, actions: [delivery], discarded: [{ item: entryOf(delivery) }] },
      ]);
    });

    it('discards a rushed delivery with its pickup when its rush is undone, silently', () => {
      const project = loadCheckpoint('surface-no-hermes-shrine-delivery');
      const entry = createAcquisitionEntryAddress(
        createAcquisitionSiteAddress(shrine, 'hermesShrineDelivery'),
        hermesShrineDeliveryEntryKey(shrine, 'initial:first'),
      );
      expect(deliveryAt(project, entry)).toMatchObject({ placed: true });
      expect(deliveryAt(project, entry).offer).toBeDefined();
      const settled = settle(project, {
        kind: 'SetHermesShrineRush',
        occurrence: shrine,
        generationKey: 'initial:first',
        rushed: false,
      });
      expect(settled.fault).toBeUndefined();
      // The rush produced the item in the Shrine's room; unrushed, the purchase delivers a new one.
      expect(deliveryAt(settled.assembly.project, entry)).toEqual({
        offer: undefined,
        placed: false,
      });
      expect(settled.removedStaleActions).toBeUndefined();
    });

    it('keeps it as the same item when it comes due at another host', () => {
      const project = loadCheckpoint('surface-no-hermes-shrine-delivery');
      const delivery = placedDelivery(project);
      const before = deliveryAt(project, entryOf(delivery));
      const settled = settle(project, {
        kind: 'SetHermesShrineOfferDelay',
        occurrence: shrine,
        generationKey: 'initial:secondLeft',
        delay: 4,
      });
      expect(settled.fault).toBeUndefined();
      // Its row leaves the old host, which keeps the item until it is placed where it is due.
      expect(deliveryAt(settled.assembly.project, entryOf(delivery))).toEqual({
        offer: before.offer,
        placed: false,
      });
      expect(settled.removedStaleActions).toEqual([{ occurrence: host, actions: [delivery] }]);
      expect(
        settled.assembly.evaluation.findings.some(
          (finding) => finding.code === 'hermesShrineDeliveryPlacementRequired',
        ),
      ).toBe(true);
      const collected = collectTestRequiredItems(settled.assembly.project);
      expect(deliveryAt(collected, entryOf(delivery))).toEqual({ offer: undefined, placed: false });
      const hosts = collected.route.biomes.flatMap((plan) =>
        (plan.topology?.occurrences ?? []).flatMap((room) => {
          const payload =
            room.acquisitionSites?.hermesShrineDelivery?.pickupEntries?.[
              entryOf(delivery).entryKey
            ];
          return payload === undefined ? [] : [{ room: room.occurrenceId, offer: payload?.offer }];
        }),
      );
      expect(hosts).toEqual([
        { room: expect.not.stringMatching(host.occurrenceId), offer: before.offer },
      ]);
    });
  });

  describe('agree with the roster on what is replaced', () => {
    /** A saved plan with a row of the F Well room on a replaced item, and these hand edits. */
    const saved = (edit: (raw: { route: { biomes: unknown[] } }) => void) => {
      const raw = JSON.parse(encodeProjectDocument(loadCheckpoint('underworld-fg')));
      edit(raw);
      return decodeProjectDocument(raw, catalog);
    };
    const roomIn = (raw: { route: { biomes: unknown[] } }, biome: number, id: string) =>
      (
        raw.route.biomes[biome] as {
          topology: {
            occurrences: {
              occurrenceId: string;
              roomActions: { order: Record<string, unknown>[] };
            }[];
          };
        }
      ).topology.occurrences.find((candidate) => candidate.occurrenceId === id)!;
    const elsewhere: ProjectCommand = {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(f, createOccurrenceId('golden-f-b6-e2')),
      value: boon('AresUpgrade'),
    };

    it('keeps a saved replaced row when an edit only stamps its room', () => {
      const well = at(f, 'golden-f-preboss-shop:postboss');
      const raw = JSON.parse(encodeProjectDocument(loadCheckpoint('underworld-f-stygian-well')));
      for (const reference of roomIn(raw, 0, well.occurrenceId).roomActions.order) {
        // A purchase saved for another item, and one that recorded nothing yet.
        if (reference.generationKey === 'initial:secondLeft')
          reference.content = ['ExtendedShopTrait'];
        if (reference.generationKey === 'initial:secondRight') delete reference.content;
      }
      const project = decodeProjectDocument(raw, catalog);
      const bought = (generationKey: string) =>
        ({ kind: 'purchaseStygianWellOffer', generationKey }) as RoomActionReference;
      const settled = settle(project, elsewhere);
      expect(settled.fault).toBeUndefined();
      const after = settled.assembly.project;
      expect(
        order(after, well).find(
          (reference) => roomActionKey(reference) === roomActionKey(bought('initial:secondRight')),
        ),
      ).toMatchObject({ content: ['LimitedSwapTraitDrop'] });
      expect(holds(after, well, bought('initial:secondLeft'))).toBe(true);
    });

    it('leaves a stale row to the stale rules, whatever content it recorded', () => {
      // The G opening keeps a pickup of a role its reward lost: stale, not replaced.
      const opening = at(g, 'golden-g-b1-e1');
      const project = saved((raw) => {
        for (const reference of roomIn(raw, 1, opening.occurrenceId).roomActions.order)
          if (reference.acquisitionRole === 'source') reference.content = ['native', 'Elsewhere'];
      });
      expect(rosterRow(project, opening, pickup)).toMatchObject({ stale: true });
      expect(rosterRow(project, opening, pickup)?.itemReplaced).toBeUndefined();
      const settled = settle(project, elsewhere);
      expect(settled.fault).toBeUndefined();
      expect(holds(settled.assembly.project, opening, pickup)).toBe(true);
    });
  });
});
