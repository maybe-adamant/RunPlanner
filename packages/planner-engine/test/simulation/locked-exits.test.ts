import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createExitSelectionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomActionAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  roomActionKey,
  semanticAddressKey,
  type ProjectCommand,
  type ProjectDocument,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';
import {
  goldLedgerForProjectEvaluationAssembly,
  roomObjectInteractionsForProjectEvaluationAssembly,
  simulateProject,
  simulateProjectAssembly,
  unlockExitEncounterSupportForProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';
import { loadUnderworldFGHICheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import {
  assembleExecutionProduct,
  compileExecutionPlan,
  decodeExecutionPlan,
  encodeExecutionPlan,
} from '../../src/execution-plan';
import { checkedGoldFights } from '../support/gold-fights';

let cached: ProjectDocument | undefined;
const golden = () => (cached ??= loadUnderworldFGHICheckpoint());

// G_Combat01: exit1 leads on, exit2 can lock. G_Story01 cannot lock.
const HOST = 'golden-g-b1-e1';
const g = (project: ProjectDocument) => createBiomeAddress(project.route.routeKey, 'G');
const host = (project: ProjectDocument, occurrenceId = HOST) =>
  createOccurrenceAddress(g(project), createOccurrenceId(occurrenceId));

function occurrence(project: ProjectDocument, occurrenceId = HOST) {
  return project.route.biomes
    .find((plan) => plan.biomeKey === 'G')!
    .topology!.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId)!;
}

const press = (exitKey: string): RoomActionReference =>
  Object.freeze({ kind: 'unlockExit' as const, exitKey });

function apply(project: ProjectDocument, command: ProjectCommand): ProjectDocument {
  return applyProjectCommand(project, catalog, command);
}

function lock(project: ProjectDocument, exitKey = 'exit2', locked = true) {
  return apply(project, { kind: 'ReplaceLockedExit', occurrence: host(project), exitKey, locked });
}

function pressAt(project: ProjectDocument, exitKey = 'exit2', index?: number) {
  const reference = press(exitKey);
  return apply(project, {
    kind: 'InsertRoomAction',
    action: createRoomActionAddress(g(project), createOccurrenceId(HOST), roomActionKey(reference)),
    reference,
    index: index ?? occurrence(project).roomActions.order.length,
  });
}

function gBiome(project: ProjectDocument) {
  const biome = simulateProject(catalog, project).route.biomes.find(
    (candidate) => candidate.biomeKey === 'G',
  );
  if (biome === undefined || !('history' in biome)) throw new Error('G was not evaluated');
  return biome;
}

describe('Oceanus locked door authoring', () => {
  it('locks a later door and opens it again with its press', () => {
    const locked = lock(golden());
    expect(occurrence(locked).lockedExits).toEqual(['exit2']);
    const pressed = pressAt(locked);
    expect(occurrence(pressed).roomActions.order.at(-1)).toEqual(press('exit2'));
    const opened = lock(pressed, 'exit2', false);
    expect(occurrence(opened).lockedExits).toBeUndefined();
    expect(occurrence(opened).roomActions.order).toEqual(occurrence(golden()).roomActions.order);
    expect(lock(locked)).toBe(locked);
  });

  it('refuses the first door, a room that cannot lock and a switch room', () => {
    expect(() => lock(golden(), 'exit1')).toThrow(/first door never locks/);
    expect(() =>
      apply(golden(), {
        kind: 'ReplaceLockedExit',
        occurrence: host(golden(), 'golden-g-b3-e1'),
        exitKey: 'exit2',
        locked: true,
      }),
    ).toThrow(/cannot lock its doors/);
    expect(() => lock(golden(), 'exit3')).toThrow(/not a door of G_Combat01/);
    const switched = apply(golden(), {
      kind: 'ReplaceChallengeSwitch',
      occurrence: host(golden()),
      variantKey: 'TimeChallengeSwitch_Money',
    });
    expect(() => lock(switched)).toThrow(/challenge switch never locks/);
    expect(() =>
      apply(lock(golden()), {
        kind: 'ReplaceChallengeSwitch',
        occurrence: host(golden()),
        variantKey: 'TimeChallengeSwitch_Money',
      }),
    ).toThrow(/locked doors never holds a challenge switch/);
  });

  it('refuses a press of a door that is not locked', () => {
    expect(() => pressAt(golden())).toThrow(/not active/);
  });

  it('round-trips locks and a customized press, and refuses a press without its lock', () => {
    const pressed = pressAt(lock(golden()));
    const assembly = simulateProjectAssembly(catalog, pressed);
    const action = createRoomActionAddress(
      g(pressed),
      createOccurrenceId(HOST),
      roomActionKey(press('exit2')),
    );
    const capability = unlockExitEncounterSupportForProjectEvaluationAssembly(assembly, action);
    expect(capability).toMatchObject({ waveCount: { min: 1, max: 1 } });
    const value = capability!.initialize()!;
    const customized = apply(pressed, {
      kind: 'ReplaceUnlockExitCustomization',
      action,
      decisionKey: 'generatedComposition',
      value,
    });
    expect(occurrence(customized).roomActions.order.at(-1)).toEqual({
      kind: 'unlockExit',
      exitKey: 'exit2',
      customization: { generatedComposition: value },
    });
    const encoded = encodeProjectDocument(customized);
    expect(encodeProjectDocument(decodeProjectDocument(JSON.parse(encoded), catalog))).toBe(
      encoded,
    );
    const raw = JSON.parse(encoded) as ProjectDocument;
    const rawHost = raw.route.biomes
      .find((plan) => plan.biomeKey === 'G')!
      .topology!.occurrences.find((candidate) => candidate.occurrenceId === HOST)!;
    delete (rawHost as { lockedExits?: unknown }).lockedExits;
    expect(() => decodeProjectDocument(raw, catalog)).toThrow(/presses a door that is not locked/);
    (rawHost as { lockedExits?: unknown }).lockedExits = ['exit1'];
    expect(() => decodeProjectDocument(raw, catalog)).toThrow(/first door never locks/);
  });
});

describe('Oceanus locked door simulation', () => {
  it('fights the door at its press: counted depth, its own gold, no record or end', () => {
    const locked = lock(golden());
    const pressed = pressAt(locked);
    expect(simulateProject(catalog, pressed).status).toBe('valid');
    const ledgers = gBiome(pressed).history.ledgers;
    const fight = (entries: readonly { readonly encounterKey: string }[]) =>
      entries.filter((entry) => entry.encounterKey === 'GeneratedG_ExtraDoor').length;
    // StartEncounter and its completion, never RecordEncounter.
    expect([
      fight(ledgers.encounterRecords),
      fight(ledgers.encounterStarts),
      fight(ledgers.encounterCompletions),
    ]).toEqual([0, 1, 1]);
    expect(
      ledgers.counters.routeEncounterDepth -
        gBiome(locked).history.ledgers.counters.routeEncounterDepth,
    ).toBe(1);
    expect(
      gBiome(pressed).history.events.filter(
        (event) =>
          event.kind === 'encounterEndEffectsApplied' &&
          event.origin.kind === 'occurrence' &&
          event.origin.occurrenceId === HOST,
      ),
    ).toHaveLength(1);
    const enemyGold = (project: ProjectDocument) => {
      const room = goldLedgerForProjectEvaluationAssembly(
        catalog,
        simulateProjectAssembly(catalog, project),
      ).roomAt(host(project));
      if (room.availability !== 'available') throw new Error(`room is ${room.reason}`);
      return room.room.gains.filter((gain) => gain.kind === 'enemyGold');
    };
    const paid = enemyGold(pressed).filter((gain) => gain.owner?.kind === 'roomAction');
    expect(paid).toHaveLength(1);
    expect(paid[0]?.amount?.mean).toBeGreaterThan(0);
    expect(enemyGold(locked)).toHaveLength(enemyGold(pressed).length - 1);
  });

  it('sums a locked door’s fight gold at its press, beside the room’s own encounter', () => {
    const pressed = pressAt(lock(golden()));
    const room = goldLedgerForProjectEvaluationAssembly(
      catalog,
      simulateProjectAssembly(catalog, pressed),
    ).roomAt(host(pressed));
    if (room.availability !== 'available') throw new Error(`room is ${room.reason}`);
    const pressRow = createRoomActionAddress(
      g(pressed),
      createOccurrenceId(HOST),
      roomActionKey(press('exit2')),
    );
    expect(checkedGoldFights(room.room)).toEqual(
      new Map([
        [
          semanticAddressKey(
            createEncounterPhaseAddress(
              g(pressed),
              { kind: 'occurrence', occurrenceId: createOccurrenceId(HOST) },
              'Encounter',
            ),
          ),
          ['enemies'],
        ],
        [semanticAddressKey(pressRow), ['enemies']],
      ]),
    );
  });

  it('raises the encounter depth only rooms after the press read', () => {
    const depths = (project: ProjectDocument) =>
      gBiome(project).history.rooms.map((room) => [
        room.origin.kind === 'occurrence' ? room.origin.occurrenceId : room.origin.kind,
        room.preparation.ledgers.counters.biomeEncounterDepth,
      ]);
    const base = depths(lock(golden()));
    const pressed = depths(pressAt(lock(golden())));
    const index = base.findIndex(([id]) => id === HOST);
    expect(pressed.slice(0, index + 1)).toEqual(base.slice(0, index + 1));
    expect(pressed[index + 1]![1]).toBe((base[index + 1]![1] as number) + 1);
  });

  it('needs the doors open and the room reward taken before a press', () => {
    const early = pressAt(lock(golden()), 'exit2', 0);
    const result = simulateProject(catalog, early);
    expect(result.findings.map((finding) => finding.code)).toContain('roomActionOrderUnavailable');
  });

  it('rerolls a locked door only after its press', () => {
    const order = (project: ProjectDocument) =>
      simulateProjectAssembly(catalog, project).evaluation;
    const locked = lock(golden());
    const target = occurrence(locked);
    const decision = locked.route.biomes
      .find((plan) => plan.biomeKey === 'G')!
      .topology!.decisions.find(
        (candidate) =>
          candidate.kind === 'exit' &&
          candidate.source.kind === 'occurrence' &&
          candidate.source.occurrenceId === HOST,
      )!;
    if (decision.kind !== 'exit') throw new Error('no exit');
    const door = decision.normal.targets.find((candidate) => candidate.exitKey === 'exit2')!;
    const reroll = apply(locked, {
      kind: 'InsertReroll',
      occurrence: host(locked),
      target: { kind: 'door', exitKey: 'exit2', occurrenceId: door.occurrenceId },
      reward: { rewardType: 'RoomMoneyDrop' },
      index: target.roomActions.order.length,
    } as ProjectCommand);
    const rerollFindings = (project: ProjectDocument) =>
      order(project).findings.filter(
        (finding) =>
          finding.code === 'roomActionOrderUnavailable' &&
          finding.origin.kind === 'roomAction' &&
          finding.origin.actionKey.includes('reroll'),
      );
    expect(rerollFindings(reroll)).toHaveLength(1);
    const pressedFirst = pressAt(reroll, 'exit2', target.roomActions.order.length);
    expect(rerollFindings(pressedFirst)).toEqual([]);
  });

  it('reports leaving through a door still locked at the exit selection', () => {
    const locked = lock(golden());
    const selected = apply(locked, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(g(locked), {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId(HOST),
      }),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    const result = simulateProject(catalog, selected);
    expect(result.status).toBe('invalid');
    const finding = result.findings.find((candidate) => candidate.code === 'lockedExitSelected');
    // The room's Timeline settles; the blocked exit is the route's one issue.
    expect(result.route.issue?.reasons[0]).toMatchObject({ code: 'lockedExitSelected' });
    expect(finding).toMatchObject({
      origin: { kind: 'exitSelection' },
      evidence: { exitKey: 'exit2' },
    });
    const pressed = pressAt(selected);
    expect(
      simulateProject(catalog, pressed).findings.some(
        (candidate) => candidate.code === 'lockedExitSelected',
      ),
    ).toBe(false);
  });

  it('publishes each lockable door, its press and the doors still locked at leave', () => {
    const lockedDoors = (project: ProjectDocument, occurrenceId = HOST) =>
      roomObjectInteractionsForProjectEvaluationAssembly(
        simulateProjectAssembly(catalog, project),
        host(project, occurrenceId),
      )?.lockedDoors;
    expect(lockedDoors(golden())).toMatchObject({
      doors: [
        {
          exitKey: 'exit2',
          locked: false,
          command: { kind: 'ReplaceLockedExit', exitKey: 'exit2', locked: true },
        },
      ],
      lockedAtLeave: [],
      unlocks: [],
    });
    expect(lockedDoors(golden(), 'golden-g-b3-e1')).toBeUndefined();
    const locked = lock(golden());
    expect(lockedDoors(locked)).toMatchObject({
      doors: [{ exitKey: 'exit2', locked: true, command: { locked: false } }],
      lockedAtLeave: ['exit2'],
      unlocks: [
        {
          exitKey: 'exit2',
          append: {
            kind: 'InsertRoomAction',
            reference: { kind: 'unlockExit', exitKey: 'exit2' },
            index: occurrence(locked).roomActions.order.length,
          },
        },
      ],
    });
    const pressed = lockedDoors(pressAt(locked));
    expect(pressed?.lockedAtLeave).toEqual([]);
    expect(pressed?.unlocks?.[0]?.append).toBeUndefined();
    expect(pressed?.unlocks?.[0]?.encounter).toMatchObject({
      selectedEncounterDefinitionKey: 'GeneratedG_ExtraDoor',
      customization: [{ key: 'generatedComposition', valueSupported: true }],
    });
  });

  it('offers no challenge switch in a room observed with locked doors', () => {
    const switchAt = (project: ProjectDocument) =>
      roomObjectInteractionsForProjectEvaluationAssembly(
        simulateProjectAssembly(catalog, project),
        host(project, 'golden-g-b4-e1'),
      )?.challengeSwitch;
    const locked = apply(golden(), {
      kind: 'ReplaceLockedExit',
      occurrence: host(golden(), 'golden-g-b4-e1'),
      exitKey: 'exit2',
      locked: true,
    });
    const product = switchAt(locked);
    expect(product?.sharedIssues[0]).toEqual({ reason: 'lockedDoors' });
    expect(product?.kinds.every((kind) => kind.observe === undefined)).toBe(true);
    expect(switchAt(golden())?.sharedIssues[0]).not.toEqual({ reason: 'lockedDoors' });
  });

  it('publishes the locks, each pressed door’s fight and its guide row', () => {
    const pressed = pressAt(lock(golden()));
    const assembly = simulateProjectAssembly(catalog, pressed);
    expect(assembly.evaluation.route.summary.eligibleForExecutionPlan).toBe(true);
    const plan = compileExecutionPlan({ product: assembleExecutionProduct({ assembly, catalog }) });
    expect(decodeExecutionPlan(JSON.parse(encodeExecutionPlan(plan)))).toEqual(plan);
    const published = plan.occurrences.find((candidate) => candidate.id === HOST)!;
    expect(published.overview.lockedExits).toEqual([
      { exitKey: 'exit2', unlock: { encounterKey: 'GeneratedG_ExtraDoor' } },
    ]);
    expect(published.roomGuide.map((row) => row.description)).toContainEqual({
      kind: 'unlockExit',
      exitKey: 'exit2',
    });
    // A locked door never pressed publishes its lock alone.
    const lockedOnly = compileExecutionPlan({
      product: assembleExecutionProduct({
        assembly: simulateProjectAssembly(catalog, lock(golden())),
        catalog,
      }),
    });
    expect(
      lockedOnly.occurrences.find((candidate) => candidate.id === HOST)!.overview.lockedExits,
    ).toEqual([{ exitKey: 'exit2' }]);
  });
});
