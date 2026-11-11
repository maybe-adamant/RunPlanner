import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  decodeProjectDocument,
  encodeProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  loadUnderworldFGCheckpoint,
  loadUnderworldFStygianWellCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/underworld';
import { loadSurfaceNProject } from '@run-planner/test-fixtures/surface';

type Encoded = {
  route: {
    biomes: {
      topology: { occurrences: Record<string, unknown>[]; decisions: Record<string, unknown>[] };
    }[];
  };
};

const source = 'golden-f-b2-e1';

describe('reroll codec', () => {
  it('decodes room rerolls and screen counts strictly', () => {
    const encoded = JSON.parse(encodeProjectDocument(loadUnderworldFGCheckpoint())) as Encoded;
    const decodeWith = (edit: (room: Record<string, unknown>) => void) => {
      const copy = structuredClone(encoded);
      edit(
        copy.route.biomes[0]!.topology.occurrences.find((room) => room.occurrenceId === source)!,
      );
      return () => decodeProjectDocument(copy as never, catalog);
    };
    const reroll = (rerollId: string) => ({
      kind: 'reroll',
      rerollId,
      target: { kind: 'door', exitKey: 'exit2', occurrenceId: 'golden-f-b3-e2' },
      reward: { rewardType: 'RoomMoneyDrop' },
    });
    const withOrder =
      (...actions: unknown[]) =>
      (room: Record<string, unknown>) => {
        const order = (room.roomActions as { order: unknown[] }).order;
        order.push(...actions);
      };
    expect(decodeWith(withOrder(reroll('r1'), reroll('r2')))).not.toThrow();
    expect(decodeWith(withOrder(reroll('first')))).toThrow('must be a reroll id');
    expect(decodeWith(withOrder(reroll('r1'), reroll('r1')))).toThrow('duplicates room action');
    expect(
      decodeWith(
        withOrder({
          kind: 'reroll',
          rerollId: 'r1',
          target: { kind: 'wheelOffer', wheelKey: 'wheel1', offerKey: 'offer1' },
          reward: { rewardType: 'RoomMoneyDrop' },
        }),
      ),
    ).toThrow('names no wheel offer of this room');
    const withScreens = (screens: unknown) => (room: Record<string, unknown>) => {
      const reward = (room.state as { reward: { traitOffersByAcquisitionRole: object } }).reward;
      for (const offer of Object.values(reward.traitOffersByAcquisitionRole))
        (offer as Record<string, unknown>).rerolledScreens = screens;
    };
    expect(decodeWith(withScreens([null, null]))).not.toThrow();
    expect(decodeWith(withScreens([]))).toThrow('rerolledScreens');
    const persephone = (bonus: number) =>
      withScreens([
        {
          options: [
            { traitKey: 'ZeusWeaponBoon', rarity: 'Common', persephoneLevelBonus: bonus },
            { traitKey: 'ZeusSpecialBoon', rarity: 'Common' },
            { traitKey: 'ZeusCastBoon', rarity: 'Common' },
          ],
        },
      ]);
    expect(decodeWith(persephone(3))).not.toThrow();
    expect(decodeWith(persephone(9))).toThrow('Persephone level bonus');
    expect(decodeWith(persephone(-1))).toThrow('persephoneLevelBonus');
    expect(decodeWith(withScreens([{ options: [], extra: true }]))).toThrow('extra');
    expect(decodeWith(withScreens([{ options: [{ traitKey: 'NoSuchTrait' }] }]))).toThrow(
      'NoSuchTrait',
    );
    expect(decodeWith((room) => withScreens(2)(room))).toThrow('rerolledScreens');
  });

  it('decodes Hub rerolls strictly and round-trips them', () => {
    const project = applyProjectCommand(loadSurfaceNProject(), catalog, {
      kind: 'InsertHubReroll',
      hub: { kind: 'hubDecision', routeKey: 'Surface', biomeKey: 'N', hubKey: 'hub' },
      hubSlotKey: 'combat05',
      reward: { rewardType: 'MaxHealthDrop' },
      index: 0,
    });
    const encoded = JSON.parse(encodeProjectDocument(project)) as Encoded;
    expect(decodeProjectDocument(structuredClone(encoded) as never, catalog)).toEqual(project);
    const decodeWith = (edit: (actions: Record<string, unknown>[]) => void) => {
      const copy = structuredClone(encoded);
      const hub = copy.route.biomes[0]!.topology.decisions.find(
        (decision) => decision.kind === 'hub',
      )!;
      edit(hub.actions as Record<string, unknown>[]);
      return () => decodeProjectDocument(copy as never, catalog);
    };
    expect(
      decodeWith((actions) => {
        actions[0]!.rerollId = 'r0';
      }),
    ).toThrow('must be a reroll id');
    expect(decodeWith((actions) => actions.push({ ...actions[0]! }))).toThrow(
      'duplicates reroll r1',
    );
    expect(
      decodeWith((actions) => {
        actions[0]!.extra = true;
      }),
    ).toThrow();
  });

  it('decodes Well and Pool rolls strictly and round-trips them', () => {
    const encoded = JSON.parse(
      encodeProjectDocument(loadUnderworldFStygianWellCheckpoint()),
    ) as Encoded;
    const decodeWith = (edit: (room: Record<string, unknown>) => void) => {
      const copy = structuredClone(encoded);
      edit(
        copy.route.biomes[0]!.topology.occurrences.find(
          (room) => room.occurrenceId === 'golden-f-preboss-shop:postboss',
        )!,
      );
      return () => decodeProjectDocument(copy as never, catalog);
    };
    const withOrder =
      (...actions: unknown[]) =>
      (room: Record<string, unknown>) => {
        (room.roomActions as { order: unknown[] }).order.push(...actions);
      };
    const wellRoll = { kind: 'rerollStygianWell', rerollId: 'r1' };
    const wellPins = (pins: unknown) => (room: Record<string, unknown>) => {
      (room.stygianWell as Record<string, unknown>).rerollOfferKeyBySlot = pins;
    };
    const both =
      (...edits: ((room: Record<string, unknown>) => void)[]) =>
      (room: Record<string, unknown>) => {
        for (const edit of edits) edit(room);
      };
    const pinned = both(withOrder(wellRoll), wellPins({ r1: { healing: 'ArmorBoostStore' } }));
    const decodedRoom = decodeWith(pinned)().route.biomes[0]!.topology!.occurrences.find(
      (room) => room.occurrenceId === 'golden-f-preboss-shop:postboss',
    )!;
    expect(decodedRoom.roomActions.order.at(-1)).toEqual(wellRoll);
    expect(decodedRoom.stygianWell?.rerollOfferKeyBySlot).toEqual({
      r1: { healing: 'ArmorBoostStore' },
    });
    expect(JSON.parse(encodeProjectDocument(decodeWith(pinned)()))).toEqual(
      JSON.parse(encodeProjectDocument(decodeWith(pinned)())),
    );
    // The row is the reroll alone: what it drew lives on the Well.
    expect(
      decodeWith(withOrder({ ...wellRoll, offerKeyBySlot: { healing: 'ArmorBoostStore' } })),
    ).toThrow('is not a project document field');
    expect(
      decodeWith(both(withOrder(wellRoll), wellPins({ r1: { first: 'ArmorBoostStore' } }))),
    ).toThrow('contains unknown slot first');
    expect(decodeWith(both(withOrder(wellRoll), wellPins({ r1: { healing: 'Nope' } })))).toThrow(
      'unknown RoomShop item Nope',
    );
    expect(decodeWith(both(withOrder(wellRoll), wellPins({ r1: {} })))).toThrow(
      'must pin at least one slot',
    );
    expect(decodeWith(both(withOrder(wellRoll), wellPins({})))).toThrow('must not be empty');
    // Pins and Twist results name only a reroll the room holds.
    expect(decodeWith(wellPins({ r1: { healing: 'ArmorBoostStore' } }))).toThrow(
      'pins a Well reroll the room does not hold',
    );
    expect(
      decodeWith((room) => {
        (room.stygianWell as Record<string, unknown>).twistResultKeyByGeneration = {
          'r1:healing': null,
        };
      }),
    ).toThrow('names a Well reroll the room does not hold');
    expect(
      decodeWith(
        both(withOrder(wellRoll), (room) => {
          (room.stygianWell as Record<string, unknown>).twistResultKeyByGeneration = {
            'r1:healing': null,
          };
        }),
      ),
    ).not.toThrow();
    expect(
      decodeWith((room) => {
        (room.stygianWell as Record<string, unknown>).twistResultKeyByGeneration = {
          'later:healing': null,
        };
      }),
    ).toThrow('must be a Well generation key');
    expect(
      decodeWith((room) => {
        (room.stygianWell as Record<string, unknown>).purchasedGenerationKeys = [];
      }),
    ).toThrow('is not a project document field');
    expect(
      decodeWith((room) => {
        (room.stygianWell as Record<string, unknown>).rerollCount = 1;
      }),
    ).toThrow();
    expect(
      decodeWith(withOrder({ kind: 'purchaseStygianWellOffer', generationKey: 'later:healing' })),
    ).toThrow('must be a Well generation key');
    // The feature holds no interaction flag; the initial list is an absent roll key.
    expect(
      decodeWith((room) => {
        (room.purgingPool as Record<string, unknown>).interacted = true;
      }),
    ).toThrow('is not a project document field');
    const interactedPool = (room: Record<string, unknown>) => {
      void room;
    };
    expect(
      decodeWith((room) => {
        interactedPool(room);
        withOrder(
          { kind: 'rerollPurgingPool', rerollId: 'r1' },
          { kind: 'sellPurgingPoolTrait', slotKey: 'left', rollKey: 'r1' },
        )(room);
        (room.purgingPool as Record<string, unknown>).rerollTraitKeyBySlot = {
          r1: { left: 'ApolloWeaponBoon' },
        };
      }),
    ).not.toThrow();
    expect(
      decodeWith((room) => {
        (room.purgingPool as Record<string, unknown>).rerollTraitKeyBySlot = {
          r1: { left: 'ApolloWeaponBoon' },
        };
      }),
    ).toThrow('pins a Pool reroll the room does not hold');
    expect(
      decodeWith(withOrder({ kind: 'rerollPurgingPool', rerollId: 'r1', traitKeyBySlot: {} })),
    ).toThrow('is not a project document field');
    expect(
      decodeWith((room) => {
        interactedPool(room);
        withOrder({ kind: 'sellPurgingPoolTrait', slotKey: 'left', rollKey: 'initial' })(room);
      }),
    ).toThrow('must be a reroll id');
  });
});
