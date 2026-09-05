import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createEchoKeepsakeReplayAddress,
  semanticAddressKey,
} from '../../src/authored-project';
import { simulateProjectAssembly } from '../../src/simulation';
import {
  EMPTY_PLANNER_TIMELINE_FACTS,
  mergePlannerTimelineFacts,
} from '../../src/simulation/timeline-facts';
import { executionTimelineTransactions } from '../../src/execution-plan/assembly/timeline-transactions';
import { orderedExecutionRooms } from '../../src/execution-plan/assembly/route';
import { loadUnderworldFGHICheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';

describe('Gift Gift Gift execution replay publication', () => {
  it('translates the exact reached volatile product without arming a stale other result', () => {
    const replayOwner = createEchoKeepsakeReplayAddress(createBiomeAddress('Underworld', 'I'));
    const replayOwnerKey = semanticAddressKey(replayOwner);
    const assembly = simulateProjectAssembly(catalog, loadUnderworldFGHICheckpoint());
    const evaluated = assembly.evaluation.route.biomes.find(
      (candidate) => candidate.biomeKey === 'I',
    );
    if (evaluated?.authoring !== 'complete' || evaluated.validity !== 'valid')
      throw new Error('expected complete-valid I biome');
    const passiveEntry = orderedExecutionRooms([evaluated]).find(
      (room) => room.occurrenceId === evaluated.snapshot.entryRoom.occurrenceId,
    );
    if (passiveEntry === undefined) throw new Error('expected passive I entry room');
    expect(
      executionTimelineTransactions(
        passiveEntry,
        evaluated,
        mergePlannerTimelineFacts(
          passiveEntry.roomActionRoster.timelineFacts ?? EMPTY_PLANNER_TIMELINE_FACTS,
          evaluated.rewards.timelineFacts,
        ),
      ),
    ).not.toContainEqual(expect.objectContaining({ kind: 'keepsakeReplay' }));
    const biome = {
      ...evaluated,
      rewards: {
        ...evaluated.rewards,
        volatileEchoKeepsakeReplay: {
          capturedKeepsakeKey: 'TempHammerKeepsake',
          result: {
            kind: 'experimentalHammer' as const,
            value: { kind: 'selected' as const, traitKey: 'StaffJumpSpecialTrait' },
          },
        },
        timelineFacts: {
          ...evaluated.rewards.timelineFacts,
          nodes: [...evaluated.rewards.timelineFacts.nodes, { owner: replayOwner, included: true }],
        },
      },
    };
    const entry = orderedExecutionRooms([biome]).find(
      (room) => room.occurrenceId === biome.snapshot.entryRoom.occurrenceId,
    );
    if (entry === undefined) throw new Error('expected I entry room');
    const facts = mergePlannerTimelineFacts(
      entry.roomActionRoster.timelineFacts ?? EMPTY_PLANNER_TIMELINE_FACTS,
      biome.rewards.timelineFacts,
    );
    expect(executionTimelineTransactions(entry, biome, facts)).toContainEqual({
      kind: 'keepsakeReplay',
      owner: replayOwnerKey,
      window: { kind: 'standard', phase: 'beforeCombat' },
      keepsakeKey: 'TempHammerKeepsake',
      equipResults: { experimentalHammer: { kind: 'selected', traitKey: 'StaffJumpSpecialTrait' } },
    });
  });
});
