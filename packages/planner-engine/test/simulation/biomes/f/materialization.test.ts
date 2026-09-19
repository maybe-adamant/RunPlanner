import { ordinaryPositionFor } from '../../../support/route-position';
import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceId,
  createProjectDocument,
  resolveRoutePosition,
  roomActionKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  BiomeMaterializationContractError,
  evaluateBiomeCompleteness,
  materializeBiome,
  materializeBiomePrefix,
  targetContinuation,
} from '@run-planner/engine/simulation';

import {
  createCompleteFTakeoverProject,
  createFProject,
  fBiome,
  fCombatId,
} from '../../support/f-takeover-project';

function fPlan(project: ProjectDocument) {
  const plan = project.route.biomes.find((biome) => biome.biomeKey === 'F');
  if (plan === undefined) throw new Error('missing F takeover plan');
  return plan;
}

function traitContext(project: ProjectDocument) {
  const route = project.route;
  if (route === undefined) throw new Error('fixture has no Underworld route');
  return route.loadout;
}

function materialize(project: ProjectDocument) {
  const completeness = evaluateBiomeCompleteness(catalog, fBiome, fPlan(project));
  if (completeness.completion !== 'complete') {
    throw new Error(
      `fixture is incomplete: ${completeness.findings.map((finding) => finding.code)}`,
    );
  }
  return materializeBiome(
    catalog,
    fBiome,
    ordinaryPositionFor(catalog, fBiome),
    completeness,
    traitContext(project),
  );
}

describe('F takeover materialization', () => {
  it.each([
    [true, 'continuesSpine'],
    [false, 'deadLeaf'],
  ] as const)('derives %s target continuation as %s', (picked, expected) => {
    expect(targetContinuation(picked)).toBe(expected);
  });

  it('requires complete authored topology at the public materialization boundary', () => {
    const incomplete = evaluateBiomeCompleteness(catalog, fBiome, fPlan(createFProject()));

    expect(() =>
      materializeBiome(catalog, fBiome, ordinaryPositionFor(catalog, fBiome), incomplete as never, {
        weaponKey: 'Staff',
        aspectKey: 'BaseStaffAspect',
        fearRanks: {},
        startingReward: null,
      }),
    ).toThrowError(
      new BiomeMaterializationContractError('biome materialization requires completeness'),
    );
  });

  it('requires a route-owned loadout at the public materialization boundary', () => {
    const completeness = evaluateBiomeCompleteness(
      catalog,
      fBiome,
      fPlan(createCompleteFTakeoverProject()),
    );
    if (completeness.completion !== 'complete') throw new Error('F fixture is incomplete');
    expect(() =>
      materializeBiome(
        catalog,
        fBiome,
        ordinaryPositionFor(catalog, fBiome),
        completeness,
        // @ts-expect-error public materialization requires a route-owned loadout
        {},
      ),
    ).toThrowError('public biome materialization requires a route weapon and aspect loadout');
  });

  it('materializes ordinary and takeover batches as one ordered decision spine', () => {
    const snapshot = materialize(createCompleteFTakeoverProject());

    expect(snapshot).toMatchObject({
      kind: 'biome',
      routeKey: 'Underworld',
      biomeKey: 'F',
      entryRoom: { occurrenceId: 'f-takeover-start', gameName: 'F_Opening01', entered: true },
    });
    expect(snapshot.decisions.map((decision) => decision.kind)).toEqual(['batch', 'batch']);
    const [opening, takeover] = snapshot.decisions;
    if (opening?.kind !== 'batch' || takeover?.kind !== 'batch') {
      throw new Error('F fixture should contain two normal-door batches');
    }
    expect(opening.targets).toMatchObject([
      {
        exit: { exitKey: 'exit1', index: 1 },
        picked: true,
        continuation: 'continuesSpine',
        room: { occurrenceId: fCombatId, gameName: 'F_Combat02' },
      },
    ]);
    expect(takeover.targets.map((target) => target.exit.exitKey)).toEqual(['exit1', 'exit2']);
    expect(takeover.targets.map((target) => target.room.occurrenceId)).toEqual([
      'f-takeover-preboss-shop',
      'f-takeover-preboss-free',
    ]);
  });

  it('uses the shared Opening lifecycle and renders pickup before Start before End', () => {
    const opening = materialize(createCompleteFTakeoverProject()).entryRoom;
    const entries = opening.roomLifecycleTimeline.entries;
    const pickup = entries.findIndex(
      (entry) =>
        entry.kind === 'action' &&
        entry.action.key ===
          roomActionKey({
            kind: 'interactIncomingReward',
            producerPoint: 'roomRewardPickup',
            acquisitionRole: 'source',
          }),
    );
    const start = entries.findIndex(
      (entry) => entry.kind === 'boundary' && entry.boundary.kind === 'encounterStart',
    );
    const end = entries.findIndex(
      (entry) => entry.kind === 'boundary' && entry.boundary.kind === 'encounterEnd',
    );

    expect(opening.lifecycleProfileKey).toBe('OpeningRewardRoom');
    expect(opening.roomActionRoster.lifecycleStructure).toBe(
      opening.roomLifecycleTimeline.structure,
    );
    expect(opening.roomLifecycleTimeline.structure.points.map((point) => point.kind)).toEqual([
      'roomEntered',
      'encounterStart',
      'encounterEnd',
      'outgoingGeneration',
      'cleanup',
    ]);
    expect(pickup).toBeGreaterThanOrEqual(0);
    expect(pickup).toBeLessThan(start);
    expect(start).toBeLessThan(end);
  });

  it('uses Dream-first F opening reward with its declared empty encounter', () => {
    const biome = createBiomeAddress('Dream', 'F');
    const project = applyProjectCommand(
      createProjectDocument(catalog, {
        projectId: 'dream-first-f-opening',
        routeKey: 'Dream',
        itineraryBiomeKeys: ['F', 'G'],
        configuredBiomeCount: 1,
      }),
      catalog,
      {
        kind: 'CreateStart',
        biome,
        occurrenceId: createOccurrenceId('dream-first-f-opening-start'),
        gameName: 'F_Opening01',
      },
    );
    const plan = project.route.biomes[0];
    if (plan === undefined) throw new Error('Dream F opening plan is missing');
    const position = resolveRoutePosition(catalog, project.route, 'F');
    const opening = materializeBiomePrefix(
      catalog,
      biome,
      position,
      plan,
      traitContext(project),
    )?.entryRoom;
    if (opening === undefined) throw new Error('Dream F opening did not materialize');

    expect(opening).toMatchObject({
      lifecycleProfileKey: 'OpeningRewardRoom',
      incomingRewardBinding: { kind: 'countedChoice', storeKeys: ['RunProgress'] },
    });
    expect(opening.encounterPhases).toMatchObject([
      { authoredChoiceKey: 'OpeningEmpty', slotKey: 'Encounter' },
    ]);
    expect(opening.roomLifecycleTimeline.structure.points.map((point) => point.kind)).toEqual([
      'roomEntered',
      'outgoingGeneration',
      'cleanup',
    ]);
  });

  it('uses Dream-later F rewardless intro with its declared empty encounter', () => {
    const biome = createBiomeAddress('Dream', 'F');
    const project = applyProjectCommand(
      createProjectDocument(catalog, {
        projectId: 'dream-later-f',
        routeKey: 'Dream',
        itineraryBiomeKeys: ['N', 'F'],
        configuredBiomeCount: 2,
      }),
      catalog,
      {
        kind: 'CreateStart',
        biome,
        occurrenceId: createOccurrenceId('dream-later-f-start'),
        gameName: 'F_Opening01',
      },
    );
    const plan = project.route.biomes.find((candidate) => candidate.biomeKey === 'F');
    if (plan === undefined) throw new Error('Dream fixture has no F plan');
    const position = resolveRoutePosition(
      catalog,
      { routeKey: 'Dream', itineraryBiomeKeys: ['N', 'F'] },
      'F',
    );
    const opening = materializeBiomePrefix(
      catalog,
      biome,
      position,
      plan,
      traitContext(project),
    )?.entryRoom;
    if (opening === undefined) throw new Error('Dream fixture did not materialize F opening');

    expect(opening).toMatchObject({
      lifecycleProfileKey: 'RewardlessCombatRoom',
      incomingRewardBinding: { kind: 'none' },
    });
    expect(opening.encounterPhases).toMatchObject([
      { authoredChoiceKey: 'OpeningEmpty', slotKey: 'Encounter' },
    ]);
  });

  it('derives Shop/free roles and completion entry from the selected physical exit', () => {
    const snapshot = materialize(createCompleteFTakeoverProject());
    const takeover = snapshot.decisions.at(-1);
    if (takeover?.kind !== 'batch') throw new Error('missing F takeover batch');

    expect(takeover).toMatchObject({
      rewardStore: { kind: 'none' },
      batchState: { kind: 'standard' },
      selectedExitKey: 'exit1',
    });
    expect(
      takeover.targets.map((target) => [target.room.entryState?.kind, target.continuation]),
    ).toEqual([
      ['shop', 'continuesSpine'],
      [undefined, 'deadLeaf'],
    ]);
    expect(snapshot.fixedRoomLinks?.map((link) => link.target.occurrenceId)).toEqual([
      'f-takeover-preboss-shop:boss',
      'f-takeover-preboss-shop:postboss',
    ]);
  });

  it('keeps an unpicked Shop dormant when the free-reward peer starts completion', () => {
    const snapshot = materialize(createCompleteFTakeoverProject('exit2'));
    const takeover = snapshot.decisions.at(-1);
    if (takeover?.kind !== 'batch') throw new Error('missing F takeover batch');

    expect(
      takeover.targets.map((target) => [
        target.picked,
        target.room.entryState,
        target.continuation,
      ]),
    ).toEqual([
      [false, undefined, 'deadLeaf'],
      [true, undefined, 'continuesSpine'],
    ]);
  });

  it('is frozen and deterministic for equal F takeover inputs', () => {
    const first = materialize(createCompleteFTakeoverProject());
    const second = materialize(createCompleteFTakeoverProject());

    expect(first).toEqual(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.decisions)).toBe(true);
    expect(
      Object.isFrozen(first.decisions[1]?.kind === 'batch' ? first.decisions[1].targets : []),
    ).toBe(true);
  });
});
