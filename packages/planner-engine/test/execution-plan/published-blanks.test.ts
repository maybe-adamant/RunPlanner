import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import { goldenFBiome } from '@run-planner/test-fixtures/underworld';
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
import { orderedExecutionRooms } from '../../src/execution-plan/assembly/route';
import { executionTimelineTransactions } from '../../src/execution-plan/assembly/timeline-transactions';
import { ExecutionCompilerError } from '../../src/execution-plan/assembler-errors';
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

function overview(room: Room, biome: PublishedBiomeEvaluation, using: Catalog = catalog) {
  return assembleExecutionOverview(using, room, biome, undefined, [], new Map());
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
});
