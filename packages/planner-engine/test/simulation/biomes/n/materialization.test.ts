import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createExitDecisionAddress,
  createProjectDocument,
  encodeProjectDocument,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { createRepresentativeNProject, nOccurrenceIds } from '../../support/surface-valid-project';

function completeN() {
  const project = createRepresentativeNProject();
  const evaluation = simulateProject(catalog, project);
  const biome = evaluation.routes
    .find((route) => route.routeKey === 'Surface')
    ?.biomes.find((candidate) => candidate.biomeKey === 'N');
  if (biome?.authoring !== 'complete') throw new Error('N fixture did not complete');
  return { project, evaluation, biome };
}

describe('canonical N Hub materialization', () => {
  it('keeps an unopened Hub structurally incomplete without inventing a board', () => {
    const project = createProjectDocument(catalog, {
      projectId: 'n-incomplete',
      name: 'N incomplete',
      configuredBiomeCounts: { Surface: 1 },
    });
    const biome = simulateProject(catalog, project)
      .routes.find((route) => route.routeKey === 'Surface')
      ?.biomes.find((candidate) => candidate.biomeKey === 'N');

    expect(biome).toMatchObject({
      authoring: 'incomplete',
      coverage: { kind: 'none', reason: 'notEvaluated' },
      frontier: createBiomeAddress('Surface', 'N'),
    });
  });

  it('separates declaration-owned board order from authored visit order and reuses targets', () => {
    const { project, biome } = completeN();
    const encodedBefore = encodeProjectDocument(project);
    const hub = biome.snapshot.decisions.find((decision) => decision.kind === 'hub');
    if (hub?.kind !== 'hub') throw new Error('fixture lost Hub decision');

    expect(biome.snapshot.entryRoom).toMatchObject({
      occurrenceId: nOccurrenceIds.opening,
      gameName: 'N_Opening01',
      lifecycleProfileKey: 'EphyraOpeningRoom',
      incomingReward: { resolvedStoreKey: 'RunProgress' },
    });
    expect(biome.snapshot.decisions[0]).toMatchObject({
      kind: 'linkedExit',
      target: { room: { occurrenceId: nOccurrenceIds.preHub, gameName: 'N_PreHub01' } },
    });
    expect(hub.board.targets.map((target) => target.hubSlotKey)).toEqual([
      'combat01',
      'combat02',
      'combat03',
      'combat05',
      'combat09',
      'combat10',
      'combat11',
      'combat23',
      'miniBoss01',
    ]);
    expect(hub.visits.map((visit) => visit.target.hubSlotKey)).toEqual([
      'combat05',
      'miniBoss01',
      'combat02',
      'combat11',
      'combat23',
      'combat09',
    ]);
    for (const visit of hub.visits) {
      const boardTarget = hub.board.targets.find(
        (target) => target.hubSlotKey === visit.target.hubSlotKey,
      );
      expect(visit.target).toBe(boardTarget);
      expect(visit.target.room.entered).toBe(true);
      expect(visit.hubRestore.room).toEqual({ origin: hub.room.origin, gameName: 'N_Hub' });
    }
    expect(hub.board.targets.find((target) => target.hubSlotKey === 'combat10')?.room.entered).toBe(
      false,
    );
    expect(encodeProjectDocument(project)).toBe(encodedBefore);
    expect(Object.isFrozen(biome.snapshot)).toBe(true);
    expect(Object.isFrozen(hub.board.targets)).toBe(true);
  });

  it('projects complete local slots, entered order, and parent restores', () => {
    const { biome } = completeN();
    const hub = biome.snapshot.decisions.find((decision) => decision.kind === 'hub');
    if (hub?.kind !== 'hub') throw new Error('fixture lost Hub decision');
    const combat05 = hub.visits[0];
    if (combat05 === undefined) throw new Error('fixture lost first Hub visit');

    expect(combat05.localSlots.map((slot) => slot.slotKey)).toEqual([
      'sideDoor1',
      'sideDoor2',
      'sideDoor3',
    ]);
    expect(combat05.localSlots.map((slot) => slot.availabilityRank)).toEqual([1, 2, 3]);
    expect(combat05.localSlots.every((slot) => slot.generation === 'generated')).toBe(true);
    expect(combat05.enteredLocalRooms.map((room) => room.slotKey)).toEqual([
      'sideDoor2',
      'sideDoor1',
    ]);
    expect(
      combat05.parentRestores.map((restore) => semanticAddressKey(restore.room.origin)),
    ).toEqual([
      semanticAddressKey(combat05.target.room.origin),
      semanticAddressKey(combat05.target.room.origin),
    ]);
  });

  it('materializes the completed-Hub handoff and declaration-derived completion rooms', () => {
    const { biome } = completeN();
    const handoff = biome.snapshot.decisions.at(-1);

    expect(handoff).toMatchObject({
      kind: 'batch',
      source: { kind: 'hubDecision', decisionKey: 'hub' },
      selectedExitKey: 'preboss',
      targets: [
        {
          exit: {
            kind: 'available',
            exitKey: 'preboss',
            index: 1,
            type: 'EphyraExitBossDoor',
            compatibilityPolicyKey: 'Unconstrained',
          },
          room: {
            occurrenceId: nOccurrenceIds.preboss,
            gameName: 'N_PreBoss01',
            entryState: { kind: 'shop' },
          },
        },
      ],
    });
    expect(biome.snapshot.completionRooms.map((room) => room.gameName)).toEqual([
      'N_Boss01',
      'N_PostBoss01',
    ]);
  });

  it('keeps a completed Hub composable at its Hub-owned handoff frontier', () => {
    const withoutHandoff = applyProjectCommand(createRepresentativeNProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision: createExitDecisionAddress(createBiomeAddress('Surface', 'N'), {
        kind: 'hubDecision',
        decisionKey: 'hub',
      }),
    });
    const biome = simulateProject(catalog, withoutHandoff)
      .routes.find((route) => route.routeKey === 'Surface')
      ?.biomes.find((candidate) => candidate.biomeKey === 'N');
    if (biome?.authoring !== 'incomplete') throw new Error('N handoff fixture did not remain open');
    if (biome.coverage.kind !== 'prefix') throw new Error('N handoff fixture lost prefix coverage');
    if (!('history' in biome)) throw new Error('N handoff fixture did not compose history');

    expect(biome).toMatchObject({
      coverage: {
        kind: 'prefix',
        through: {
          owner: createExitDecisionAddress(createBiomeAddress('Surface', 'N'), {
            kind: 'hubDecision',
            decisionKey: 'hub',
          }),
        },
      },
      frontier: createExitDecisionAddress(createBiomeAddress('Surface', 'N'), {
        kind: 'hubDecision',
        decisionKey: 'hub',
      }),
    });
    expect(biome.history.events.some((event) => event.kind === 'roomCreated')).toBe(true);
  });
});
