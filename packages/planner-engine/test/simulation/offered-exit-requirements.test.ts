import { beforeAll, describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createOccurrenceAddress,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { evaluateRequirement } from '@run-planner/engine/requirements';
import { projectOfferedExitCount } from '../../src/simulation/history/facts';
import { createBiomeRewardFacts } from '../../src/simulation/rewards/facts';
import {
  createFGenerationProject,
  fGenerationBaselineBatches,
  fGenerationBiome,
  fGenerationOccurrenceId,
  fGenerationTargetAddress,
} from './support/f-generation-project';
import { evaluate, pressure } from './support/f-generation-evaluation';

describe('offered-exit requirements', () => {
  let base: ProjectDocument;
  let withIxion: ProjectDocument;
  let result: ReturnType<typeof evaluate>;
  const well = createOccurrenceAddress(fGenerationBiome, fGenerationOccurrenceId(5, 1));
  const miniboss = createOccurrenceAddress(fGenerationBiome, fGenerationOccurrenceId(6, 1));

  beforeAll(() => {
    base = createFGenerationProject();
    withIxion = applyProjectCommand(base, catalog, {
      kind: 'AddStygianWell',
      occurrence: well,
    });
    withIxion = applyProjectCommand(withIxion, catalog, {
      kind: 'SetStygianWellInteraction',
      occurrence: well,
      interacted: true,
    });
    for (const [slotKey, itemKey] of [
      ['healing', 'ArmorBoostStore'],
      ['secondLeft', 'TemporaryForcedSecretDoorTrait'],
      ['secondRight', 'TemporaryImprovedCastTrait'],
    ] as const) {
      withIxion = applyProjectCommand(withIxion, catalog, {
        kind: 'ReplaceStygianWellOffer',
        occurrence: well,
        slotKey,
        itemKey,
      });
    }
    withIxion = applyProjectCommand(withIxion, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: well,
      generationKey: 'initial:secondLeft',
      purchased: true,
    });
    result = evaluate(withIxion);
  });

  it('counts the unpicked gate only after creation and only for its owning occurrence', () => {
    const room = result.history.rooms.find(
      (room) => semanticAddressKey(room.origin) === semanticAddressKey(miniboss),
    );
    if (room?.entry === undefined || room.preOutgoing === undefined)
      throw new Error('Miniboss history is missing');
    expect(
      result.history.ledgers.roomCreations.filter(
        (creation) => creation.source === 'additionalExit',
      ),
    ).toEqual([
      expect.objectContaining({ source: 'additionalExit', parentOrigin: miniboss, picked: false }),
    ]);
    expect(projectOfferedExitCount(room.entry, miniboss, 1)).toBe(1);
    expect(projectOfferedExitCount(room.preOutgoing, miniboss, 1)).toBe(2);
    expect(projectOfferedExitCount(room.preOutgoing, miniboss, 2)).toBe(3);
    expect(projectOfferedExitCount(room.preOutgoing, well, 2)).toBe(2);
    const batch = result.snapshot.decisions[6];
    expect(batch?.kind === 'batch' ? batch.targets.length : undefined).toBe(1);
  });

  it('admits the F midshop candidate after a one-door miniboss with Ixion', () => {
    const target = fGenerationTargetAddress(fGenerationBaselineBatches, 7, 1);
    const candidate = (project: ProjectDocument) =>
      createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, project),
      ).evaluate({ kind: 'roomTarget', target, gameName: 'F_Shop01' });
    expect(candidate(base)).toMatchObject({
      kind: 'roomTarget',
      result: { pressure: { selectedPossible: false } },
    });
    expect(candidate(withIxion)).toMatchObject({
      kind: 'roomTarget',
      result: { pressure: { selectedPossible: true } },
    });
    const withoutIxion = applyProjectCommand(withIxion, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: well,
      generationKey: 'initial:secondLeft',
      purchased: false,
    });
    expect(candidate(withoutIxion)).toMatchObject({
      kind: 'roomTarget',
      result: { pressure: { selectedPossible: false } },
    });
    // At this depth the newly eligible shop is required, so selected validation
    // must also reject the existing ordinary target rather than just fixing its picker.
    expect(pressure(result, fGenerationBaselineBatches, 7, 1)).toMatchObject({
      selectedPossible: false,
      selectedExclusionReasons: ['forcedPool'],
      requiredForcedRoomGameNames: ['F_Shop01'],
    });
  });

  it('uses the same offered doors for reward requirements such as Devotion', () => {
    const incomingBatch = result.snapshot.decisions[5];
    if (incomingBatch?.kind !== 'batch') throw new Error('Miniboss incoming batch is missing');
    const room = result.history.rooms.find(
      (room) => semanticAddressKey(room.origin) === semanticAddressKey(miniboss),
    );
    const view = room?.targetGenerations[0]?.before;
    if (view === undefined) throw new Error('Outgoing reward checkpoint is missing');
    const target = fGenerationTargetAddress(fGenerationBaselineBatches, 7, 1);
    const history = result.rewards.targetHistory
      .find((checkpoint) => semanticAddressKey(checkpoint.origin) === semanticAddressKey(target))
      ?.states.map((state) => state.rewardHistory)[0];
    if (history === undefined) throw new Error('Outgoing reward history is missing');
    const source = incomingBatch.targets[0]!.room;
    const facts = createBiomeRewardFacts(
      catalog,
      source,
      source,
      catalog.rooms.byKey[source.gameName]!,
      view,
      history,
      1,
    );
    expect(facts.requirements.offeredExitCount).toBe(2);
    const requirement = catalog.rewards.stores.byKey.RunProgress?.entries.find(
      (entry) => entry.rewardType === 'Devotion',
    )?.requirement;
    if (requirement === undefined) throw new Error('Devotion requirement is missing');
    expect(evaluateRequirement(requirement, facts.requirements)).toBe(true);
    expect(evaluateRequirement(requirement, { ...facts.requirements, offeredExitCount: 1 })).toBe(
      false,
    );
  });
});
