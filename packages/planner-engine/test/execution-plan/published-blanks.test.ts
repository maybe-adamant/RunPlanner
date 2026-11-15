import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import { goldenFBiome } from '@run-planner/test-fixtures/underworld';
import {
  createFreshFileFProject,
  withRetainedFreshFilePostboss,
} from '@run-planner/test-fixtures/fresh-file';
import {
  authorTestTraitsAndRequiredItems,
  stockTestProject,
} from '@run-planner/test-fixtures/shared';
import {
  loadUnderworldFGHCheckpoint,
  loadUnderworldFPoolCheckpoint,
  loadUnderworldFStygianWellCheckpoint,
  loadUnderworldIxionChaosCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/underworld';
import {
  applyProjectCommand,
  createOccurrenceAddress,
  createOccurrenceId,
  type ProjectDocument,
} from '../../src/authored-project';
import { simulateProjectAssembly } from '../../src/simulation';
import type { PublishedBiomeEvaluation } from '../../src/simulation/evaluation/evaluation-products';
import { assembleExecutionOverview } from '../../src/execution-plan/assembly/overview';
import {
  executionBatchesByRoom,
  orderedExecutionRooms,
} from '../../src/execution-plan/assembly/route';
import { executionRoomOwnerKey } from '../../src/execution-plan/assembly/support';
import { executionTimelineTransactions } from '../../src/execution-plan/assembly/timeline-transactions';
import { ExecutionCompilerError } from '../../src/execution-plan/assembler-errors';
import { executionHubRerolls, executionReroll } from '../../src/execution-plan/assembly/rerolls';
import type { CanonicalHubDecision } from '../../src/simulation/materialization';
import { assembleExecutionProduct } from '../../src/execution-plan/assembler';
import {
  EMPTY_PLANNER_TIMELINE_FACTS,
  mergePlannerTimelineFacts,
} from '../../src/simulation/timeline-facts';

type Room = ReturnType<typeof orderedExecutionRooms>[number];

function completeBiome(project: ProjectDocument, biomeKey: string): PublishedBiomeEvaluation {
  const biome = simulateProjectAssembly(catalog, project).evaluation.route.biomes.find(
    (candidate) => candidate.biomeKey === biomeKey,
  );
  if (biome?.authoring !== 'complete' || !('snapshot' in biome))
    throw new Error(`expected a complete ${biomeKey} evaluation`);
  return biome;
}

function roomWhere(biome: PublishedBiomeEvaluation, predicate: (room: Room) => boolean): Room {
  const room = orderedExecutionRooms([biome]).find(predicate);
  if (room === undefined) throw new Error('fixture lacks the room');
  return room;
}

function transactions(room: Room, biome: PublishedBiomeEvaluation) {
  return executionTimelineTransactions(
    room,
    biome,
    mergePlannerTimelineFacts(
      room.roomActionRoster.timelineFacts ?? EMPTY_PLANNER_TIMELINE_FACTS,
      biome.rewards.timelineFacts,
    ),
  );
}

function overview(
  room: Room,
  biome: PublishedBiomeEvaluation,
  using: Catalog = catalog,
  batch?: Parameters<typeof assembleExecutionOverview>[3],
) {
  return assembleExecutionOverview(using, room, biome, batch, [], new Map());
}

/** The catalog with one room's declaration changed. */
function withRoom(
  gameName: string,
  change: (declared: Catalog['rooms']['byKey'][string]) => object,
): Catalog {
  const declared = catalog.rooms.byKey[gameName]!;
  return {
    ...catalog,
    rooms: {
      ...catalog.rooms,
      byKey: { ...catalog.rooms.byKey, [gameName]: { ...declared, ...change(declared) } },
    },
  };
}

function expectCoverageMissing(run: () => unknown, message: RegExp) {
  expect(run).toThrow(ExecutionCompilerError);
  expect(run).toThrow(message);
}

describe('execution assembly refuses a published blank', () => {
  it('refuses an offered Well slot without an item', () => {
    const f = completeBiome(stockTestProject(loadUnderworldFStygianWellCheckpoint()), 'F');
    const room = roomWhere(f, (candidate) => candidate.stygianWell !== undefined);
    expect(overview(room, f).stygianWell?.offers).toHaveLength(3);
    const blank = {
      ...room,
      stygianWell: {
        ...room.stygianWell!,
        offerKeyBySlot: { ...room.stygianWell!.offerKeyBySlot, healing: null },
      },
    };
    expectCoverageMissing(() => overview(blank, f), /lacks Well offer initial:healing/);
  });

  it('refuses a shown Pool slot without a trait', () => {
    const f = completeBiome(
      stockTestProject(authorTestTraitsAndRequiredItems(loadUnderworldFPoolCheckpoint())),
      'F',
    );
    const room = roomWhere(f, (candidate) => candidate.purgingPool !== undefined);
    const shown = overview(room, f).purgingPool?.traits[0]?.slotKey;
    if (shown === undefined) throw new Error('fixture Pool shows no slot');
    const blank = {
      ...room,
      purgingPool: {
        ...room.purgingPool!,
        traitKeyBySlot: { ...room.purgingPool!.traitKeyBySlot, [shown]: null },
      },
    };
    expectCoverageMissing(() => overview(blank, f), new RegExp(`lacks Pool trait ${shown}`));
  });

  it('refuses a bought Fateful Twist without its result', () => {
    const well = createOccurrenceAddress(
      goldenFBiome,
      createOccurrenceId('golden-f-preboss-shop:postboss'),
    );
    let project = loadUnderworldIxionChaosCheckpoint();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStygianWellOffer',
      occurrence: well,
      slotKey: 'secondRight',
      itemKey: 'RandomStoreItem',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: well,
      generationKey: 'initial:secondRight',
      purchased: true,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStygianWellTwistResult',
      occurrence: well,
      generationKey: 'initial:secondRight',
      itemKey: 'TemporaryBoonRarityTrait',
    });
    const f = completeBiome(authorTestTraitsAndRequiredItems(project), 'F');
    const room = roomWhere(f, (candidate) => candidate.occurrenceId === well.occurrenceId);
    expect(transactions(room, f)).toContainEqual(
      expect.objectContaining({
        transformation: expect.objectContaining({ kind: 'stygianWellTwist' }),
      }),
    );
    const blank = {
      ...room,
      stygianWell: { ...room.stygianWell!, twistResultKeyByGeneration: {} },
    };
    expectCoverageMissing(
      () => transactions(blank, f),
      /lacks Fateful Twist result for initial:secondRight/,
    );
    expectCoverageMissing(
      () => overview(blank, f),
      /lacks Fateful Twist result for initial:secondRight/,
    );
  });

  it('publishes a Well on its pin and refuses an anchor object without an anchor', () => {
    const f = completeBiome(stockTestProject(loadUnderworldFStygianWellCheckpoint()), 'F');
    const room = roomWhere(f, (candidate) => candidate.stygianWell !== undefined);
    const declared = catalog.rooms.byKey[room.gameName]!;
    expect(declared.mapPoints?.wellAnchorId).toBeDefined();
    expect(room.stygianWell).not.toHaveProperty('anchorId');
    const pin = declared.mapPoints!.wellAnchorId;
    expect(overview(room, f, catalog).stygianWell).toHaveProperty('anchorId', pin);
    // Past the room's anchors it has none to stand on.
    const full = withRoom(room.gameName, () => ({ challengeSwitchAnchorCount: 0 }));
    expectCoverageMissing(() => overview(room, f, full), /stygianWell without an anchor/);
  });

  it('refuses a Pool its route never spawns, which loading an older save drops', () => {
    const project = withRetainedFreshFilePostboss(createFreshFileFProject(), {
      poolSaleTraitKey: null,
    });
    expectCoverageMissing(
      () =>
        assembleExecutionProduct({
          catalog,
          assembly: simulateProjectAssembly(catalog, project),
        }),
      /purgingPool without an anchor/,
    );
  });

  it('refuses a Chaos gate without a spawn point', () => {
    const g = completeBiome(loadUnderworldIxionChaosCheckpoint(), 'G');
    const room = roomWhere(g, (candidate) => candidate.occurrenceId === 'golden-g-intro');
    const batch = executionBatchesByRoom([g]).get(executionRoomOwnerKey(room))!;
    expect(overview(room, g, catalog, batch).additional).toContainEqual(
      expect.objectContaining({ kind: 'chaos', spawnPointIndex: expect.any(Number) }),
    );
    const unstored = {
      ...batch,
      additional: batch.additional.map((exit) => {
        const copy = { ...exit };
        delete copy.spawnPointIndex;
        return copy;
      }),
    };
    expectCoverageMissing(
      () =>
        overview(
          room,
          g,
          withRoom(room.gameName, () => ({ secretPointAnchorCount: 0 })),
          unstored,
        ),
      /Chaos gate without a spawn point/,
    );
  });

  describe('Fields', () => {
    const h = completeBiome(loadUnderworldFGHCheckpoint(), 'H');
    const room = roomWhere(
      h,
      (candidate) =>
        candidate.entered &&
        candidate.encounterEnvelopeKey === 'FieldsEncounter' &&
        (candidate.fieldsOptionalRewards ?? []).length > 0,
    );
    // No stored point, and a declaration with no point left to draw.
    const unpointed = {
      ...room,
      fieldsSpatial: { ...room.fieldsSpatial!, cagePointIdBySlot: {}, optionalPointIdBySlot: {} },
    };
    function withoutPoints(family: 'cagePointIds' | 'optionalPointIds'): Catalog {
      const declared = catalog.rooms.byKey[room.gameName]!;
      return {
        ...catalog,
        rooms: {
          ...catalog.rooms,
          byKey: {
            ...catalog.rooms.byKey,
            [room.gameName]: {
              ...declared,
              fieldsSpatial: { ...declared.fieldsSpatial!, [family]: [] },
            },
          },
        },
      };
    }

    it('publishes every cage and optional reward with its point', () => {
      const fields = overview(unpointed, h).fields;
      expect(fields?.cagePoints.length).toBeGreaterThan(0);
      expect(fields?.optionalRewards.every((optional) => optional.pointId !== undefined)).toBe(
        true,
      );
    });

    it('refuses a cage without a point', () => {
      expectCoverageMissing(
        () => overview(unpointed, h, withoutPoints('cagePointIds')),
        /lacks Fields cage point/,
      );
    });

    it('refuses an optional reward without a point', () => {
      expectCoverageMissing(
        () => overview(unpointed, h, withoutPoints('optionalPointIds')),
        /lacks Fields optional point/,
      );
    });
  });

  it('refuses a room press or a Hub press whose result is unset', () => {
    const f = completeBiome(stockTestProject(loadUnderworldFStygianWellCheckpoint()), 'F');
    const room = roomWhere(f, (candidate) => candidate.stygianWell !== undefined);
    const press = { kind: 'reroll', rerollId: 'r1', target: { kind: 'wheelOffer' } } as const;
    const unset = {
      ...room,
      rerollPresses: new Map([
        ['r1', { target: { kind: 'wheelOffer', wheelKey: 'wheel1', offerKey: 'offer1' } }],
      ]),
    } as unknown as typeof room;
    expectCoverageMissing(
      () => executionReroll(unset, undefined, press as never),
      /reroll r1 lacks its result/,
    );
    const hub = {
      rerolls: [{ origin: { rerollId: 'r1' }, hubSlotKey: 'combat05' }],
      board: {
        targets: [
          {
            hubSlotKey: 'combat05',
            room: {
              incomingReward: {
                producerLifecycleKey: 'RoomReward',
                resolvedStoreKey: 'HubRewards',
              },
            },
          },
        ],
      },
    } as unknown as CanonicalHubDecision;
    expectCoverageMissing(() => executionHubRerolls(hub), /Hub reroll r1 lacks its result/);
  });
});
