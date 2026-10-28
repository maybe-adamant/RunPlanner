import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  decodeProjectDocument,
  encodeProjectDocument,
} from '@run-planner/engine/authored-project';
import { loadUnderworldFGCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
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
    const withCount = (count: number) => (room: Record<string, unknown>) => {
      const reward = (room.state as { reward: { traitOffersByAcquisitionRole: object } }).reward;
      for (const offer of Object.values(reward.traitOffersByAcquisitionRole))
        (offer as Record<string, unknown>).rerollCount = count;
    };
    expect(decodeWith(withCount(2))).not.toThrow();
    expect(decodeWith(withCount(0))).toThrow('rerollCount');
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
});
