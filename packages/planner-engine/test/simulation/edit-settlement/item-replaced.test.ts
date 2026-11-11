import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRewardWheelAddress,
  createShopOfferAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  roomActionKey,
  type OccurrenceAddress,
  type ProjectCommand,
  type ProjectDocument,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';
import { settleProjectEdit, simulateProjectAssembly } from '@run-planner/engine/simulation';
import { loadCheckpoint } from '@run-planner/test-fixtures/checkpoints/registry';

import {
  candidateBiome,
  candidateBiomeRooms,
} from '../../../src/simulation/candidates/evaluated-biome';
import { withArcana } from '../../support/rerolls';

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
    /** Presses the door into `target`, which redraws its reward: a new item. */
    const press = (source: OccurrenceAddress, target: string): ProjectCommand => ({
      kind: 'InsertReroll',
      occurrence: source,
      target: { kind: 'door', exitKey: 'exit1', occurrenceId: createOccurrenceId(target) },
      reward: { rewardType: 'RoomMoneyDrop' },
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
});
