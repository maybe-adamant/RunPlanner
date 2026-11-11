import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  biomePlanContentSource,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomActionAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  ProjectCommandContractError,
  roomActionContentMatches,
  roomActionItemContent,
  roomActionKey,
  type OccurrenceAddress,
  type ProjectDocument,
  type RoomActionReference,
  type RoomOccurrence,
} from '@run-planner/engine/authored-project';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';
import { loadCheckpoint } from '@run-planner/test-fixtures/checkpoints/registry';

import { rewardOfferToken } from '../../../src/authored-project/room-actions/item-content';
import {
  candidateBiome,
  candidateBiomeRooms,
} from '../../../src/simulation/candidates/evaluated-biome';
import { withArcana } from '../../support/rerolls';
import { withItemContent } from '@run-planner/test-fixtures/shared';

const f = createBiomeAddress('Underworld', 'F');
const at = (biome: typeof f, id: string) => createOccurrenceAddress(biome, createOccurrenceId(id));
const roomOf = (project: ProjectDocument, address: OccurrenceAddress): RoomOccurrence =>
  project.route.biomes
    .find((plan) => plan.biomeKey === address.biomeKey)!
    .topology!.occurrences.find((room) => room.occurrenceId === address.occurrenceId)!;
const contentOf = (
  project: ProjectDocument,
  address: OccurrenceAddress,
  reference: RoomActionReference,
) =>
  roomActionItemContent(
    biomePlanContentSource(
      catalog,
      project,
      project.route.biomes.find((plan) => plan.biomeKey === address.biomeKey)!,
    )!,
    roomOf(project, address),
    reference,
  );
const pickup = {
  kind: 'interactIncomingReward',
  producerPoint: 'roomRewardPickup',
  acquisitionRole: 'source',
} as const;

describe('item content', () => {
  it('names a reward by its type and the gods its payload names', () => {
    expect(rewardOfferToken({ rewardType: 'MaxHealthDrop' })).toEqual(['MaxHealthDrop']);
    expect(
      rewardOfferToken({
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
      }),
    ).toEqual(['Boon', 'ZeusUpgrade']);
    expect(
      rewardOfferToken({
        rewardType: 'Devotion',
        payload: {
          kind: 'DevotionPair',
          chosenSource: 'ZeusUpgrade',
          spurnedSource: 'HeraUpgrade',
        },
      }),
    ).toEqual(['Devotion', 'ZeusUpgrade', 'HeraUpgrade']);
  });

  describe('per item kind', () => {
    it('reads a room reward with its press, the route start’s from the starting reward', () => {
      const project = loadCheckpoint('underworld-fg');
      expect(contentOf(project, at(f, 'golden-f-b2-e1'), pickup)).toEqual([
        'native',
        'Boon',
        'ZeusUpgrade',
      ]);
      expect(contentOf(project, at(f, 'golden-f-start'), pickup)).toEqual([
        'native',
        'Boon',
        'ApolloUpgrade',
      ]);
    });

    it('names the effective press of a rerolled door reward', () => {
      const source = at(f, 'golden-f-b5-e1');
      const project = applyProjectCommand(
        withArcana(loadCheckpoint('underworld-fg'), ['DoorReroll']),
        catalog,
        {
          kind: 'InsertReroll',
          occurrence: source,
          target: {
            kind: 'door',
            exitKey: 'exit1',
            occurrenceId: createOccurrenceId('golden-f-b6-e1'),
          },
          reward: { rewardType: 'RoomMoneyDrop' },
          index: roomOf(loadCheckpoint('underworld-fg'), source).roomActions.order.length,
        },
      );
      const press = roomOf(project, source).roomActions.order.find(
        (reference) => reference.kind === 'reroll',
      );
      expect(press?.kind).toBe('reroll');
      expect(contentOf(project, at(f, 'golden-f-b6-e1'), pickup)).toEqual([
        press?.kind === 'reroll' ? press.rerollId : '',
        'RoomMoneyDrop',
      ]);
    });

    it('reads a Well purchase’s generation item, unpinned as unobserved', () => {
      const well = at(f, 'golden-f-preboss-shop:postboss');
      const purchase = {
        kind: 'purchaseStygianWellOffer',
        generationKey: 'initial:secondLeft',
      } as const;
      const project = loadCheckpoint('underworld-f-stygian-well');
      expect(contentOf(project, well, purchase)).toEqual(['TemporaryBoonRarityTrait']);
      const unpinned = applyProjectCommand(project, catalog, {
        kind: 'ReplaceStygianWellOffer',
        occurrence: well,
        slotKey: 'secondLeft',
        itemKey: null,
      });
      expect(contentOf(unpinned, well, purchase)).toBeNull();
    });

    it('reads a Pool sale’s trait, a Shop purchase’s option and reward, a wheel’s pick', () => {
      expect(
        contentOf(loadCheckpoint('underworld-f-pool'), at(f, 'golden-f-preboss-shop:postboss'), {
          kind: 'sellPurgingPoolTrait',
          slotKey: 'left',
        }),
      ).toEqual(['ApolloWeaponBoon']);
      expect(
        contentOf(
          loadCheckpoint('underworld-world-shop-travel-deal'),
          at(f, 'golden-f-preboss-shop'),
          { kind: 'interactShopOffer', offerKey: 'Boon' },
        ),
      ).toEqual(['RandomLoot', 'RandomLoot', 'ApolloUpgrade']);
      expect(
        contentOf(
          loadCheckpoint('surface-no'),
          at(createBiomeAddress('Surface', 'O'), 'surface-o-combat01'),
          { kind: 'interactWheelReward', wheelKey: 'wheel1' },
        ),
      ).toEqual(['offer1', 'native', 'RoomMoneyDrop']);
    });

    it('reads a Shrine purchase and its rush by the stocked reward type', () => {
      const shrine = at(createBiomeAddress('Surface', 'N'), 'surface-n-preboss:postboss');
      const project = loadCheckpoint('surface-shrine-travel-deal');
      for (const kind of ['purchaseHermesShrineOffer', 'rushHermesShrineOffer'] as const)
        expect(contentOf(project, shrine, { kind, generationKey: 'initial:first' })).toEqual([
          'HealBigDrop',
        ]);
    });

    it('records nothing for a row that acts on no item', () => {
      const project = loadCheckpoint('underworld-fg');
      expect(contentOf(project, at(f, 'golden-f-b2-e1'), { kind: 'useFountain' })).toBeNull();
    });
  });

  it('matches absent row content, an unobserved item and equal content only', () => {
    const recorded = { ...pickup, content: ['native', 'Boon', 'ZeusUpgrade'] } as const;
    expect(roomActionContentMatches(pickup, ['native', 'Boon', 'HeraUpgrade'])).toBe(true);
    expect(roomActionContentMatches(recorded, null)).toBe(true);
    expect(roomActionContentMatches(recorded, ['native', 'Boon', 'ZeusUpgrade'])).toBe(true);
    expect(roomActionContentMatches(recorded, ['native', 'Boon', 'HeraUpgrade'])).toBe(false);
    expect(roomActionContentMatches(recorded, ['r1', 'Boon', 'ZeusUpgrade'])).toBe(false);
  });

  it('stamps a row without content once its item is observed, and keeps it through unpinning', () => {
    const well = at(f, 'golden-f-preboss-shop:postboss');
    const purchase = { kind: 'purchaseStygianWellOffer', generationKey: 'initial:secondLeft' };
    const loaded = loadCheckpoint('underworld-f-stygian-well');
    // A row placed before its item was pinned: unpinned and without content.
    const raw = JSON.parse(encodeProjectDocument(loaded));
    const room = raw.route.biomes
      .find((plan: { biomeKey: string }) => plan.biomeKey === 'F')
      .topology.occurrences.find(
        (candidate: { occurrenceId: string }) => candidate.occurrenceId === well.occurrenceId,
      );
    room.stygianWell.offerKeyBySlot.secondLeft = null;
    for (const reference of room.roomActions.order)
      if (reference.generationKey === 'initial:secondLeft') delete reference.content;
    const unobserved = decodeProjectDocument(raw, catalog);
    const find = (project: ProjectDocument) =>
      roomOf(project, well).roomActions.order.find(
        (reference) => roomActionKey(reference) === roomActionKey(purchase as RoomActionReference),
      );
    expect(find(unobserved)).toEqual(purchase);
    const pinned = applyProjectCommand(unobserved, catalog, {
      kind: 'ReplaceStygianWellOffer',
      occurrence: well,
      slotKey: 'secondLeft',
      itemKey: 'TemporaryBoonRarityTrait',
    });
    expect(find(pinned)).toEqual({ ...purchase, content: ['TemporaryBoonRarityTrait'] });
    const unpinned = applyProjectCommand(pinned, catalog, {
      kind: 'ReplaceStygianWellOffer',
      occurrence: well,
      slotKey: 'secondLeft',
      itemKey: null,
    });
    expect(find(unpinned)).toEqual({ ...purchase, content: ['TemporaryBoonRarityTrait'] });
  });

  it('refuses inserting a reference whose content its item does not hold', () => {
    const room = at(f, 'golden-f-b2-e1');
    const project = applyProjectCommand(loadCheckpoint('underworld-fg'), catalog, {
      kind: 'RemoveRoomAction',
      action: createRoomActionAddress(f, room.occurrenceId, roomActionKey(pickup)),
    });
    const insert = (reference: RoomActionReference) =>
      applyProjectCommand(project, catalog, {
        kind: 'InsertRoomAction',
        action: createRoomActionAddress(f, room.occurrenceId, roomActionKey(reference)),
        reference,
        index: 0,
      });
    expect(() => insert({ ...pickup, content: ['native', 'Boon', 'HeraUpgrade'] })).toThrow(
      ProjectCommandContractError,
    );
    const placed = insert(pickup);
    expect(roomOf(placed, room).roomActions.order).toEqual([withItemContent(placed, room, pickup)]);
    expect(roomOf(placed, room).roomActions.order[0]).toEqual({
      ...pickup,
      content: ['native', 'Boon', 'ZeusUpgrade'],
    });
  });

  describe('a saved row whose item holds other content', () => {
    const room = at(f, 'golden-f-b2-e1');
    const handEdited = () => {
      const raw = JSON.parse(encodeProjectDocument(loadCheckpoint('underworld-fg')));
      raw.route.biomes[0].topology.occurrences.find(
        (candidate: { occurrenceId: string }) => candidate.occurrenceId === room.occurrenceId,
      ).roomActions.order[0].content = ['native', 'Boon', 'HeraUpgrade'];
      return decodeProjectDocument(raw, catalog);
    };

    it('decodes, and the walk stops at it with its finding', () => {
      const assembly = simulateProjectAssembly(catalog, handEdited());
      const row = candidateBiomeRooms(candidateBiome(assembly.evaluation, 'Underworld', 'F')!)
        .find(
          (candidate) =>
            candidate.origin.kind === 'occurrence' &&
            candidate.origin.occurrenceId === room.occurrenceId,
        )!
        .roomActionRoster.rows.find((candidate) => candidate.key === roomActionKey(pickup))!;
      expect(row).toMatchObject({ rank: 1, stale: false, itemReplaced: true, executable: false });
      expect(assembly.evaluation.findings).toContainEqual(
        expect.objectContaining({
          code: 'roomActionItemReplaced',
          origin: createRoomActionAddress(f, room.occurrenceId, roomActionKey(pickup)),
        }),
      );
    });

    it('is rejected by the codec only when malformed', () => {
      const raw = JSON.parse(encodeProjectDocument(loadCheckpoint('underworld-fg')));
      const order = raw.route.biomes[0].topology.occurrences.find(
        (candidate: { occurrenceId: string }) => candidate.occurrenceId === room.occurrenceId,
      ).roomActions.order;
      order[0].content = [];
      expect(() => decodeProjectDocument(raw, catalog)).toThrow(/must name the item content/);
      order[0] = { kind: 'useFountain', content: ['x'] };
      expect(() => decodeProjectDocument(raw, catalog)).toThrow();
    });
  });
});
