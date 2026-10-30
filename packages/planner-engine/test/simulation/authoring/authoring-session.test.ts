import { afterEach, describe, expect, it, vi } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createBiomeAddress,
  createOccurrenceAddress,
  createRoomActionAddress,
  createRouteAddress,
  hermesShrineDeliveryEntryKey,
  ProjectCommandContractError,
  type ProjectCommand,
  type ProjectDocument,
  type RerollTarget,
} from '@run-planner/engine/authored-project';
import {
  findingsAddedSince,
  generatedEncounterSupportForProjectEvaluationAssembly,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { loadUnderworldFGCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import {
  createSurfaceNOHermesShrineDeliveryCheckpoint,
  oBiome,
  oOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import { createAuthoringSession } from '../../../src/simulation/authoring/session';
import { reachedEncounterPhasesForProjectEvaluationAssembly } from '../../../src/simulation/evaluation/project-evaluation-assembly';
import * as commands from '../../../src/authored-project/commands/dispatch';
import { firstSupportedReroll, withArcana } from '../../support/rerolls';

const evaluate = (project: ProjectDocument) => simulateProjectAssembly(catalog, project);

const shrineOffer = {
  kind: 'ReplaceHermesShrineOffer',
  occurrence: createOccurrenceAddress(oBiome, oOccurrenceIds.combat07),
  slotKey: 'secondRight',
  value: { rewardType: 'MaxManaDrop' },
} as const;

describe('authoring session', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('applies a settled command and replaces its current assembly', () => {
    const start = evaluate(
      createSurfaceNOHermesShrineDeliveryCheckpoint({ placeDelayedDelivery: false }),
    );
    const session = createAuthoringSession(catalog, start);
    const outcome = session.apply(shrineOffer);
    expect(outcome.kind).toBe('applied');
    if (outcome.kind !== 'applied') return;
    expect(outcome.fault).toBeUndefined();
    expect(session.current()).toBe(outcome.assembly);
    expect(outcome.assembly.project).not.toBe(start.project);
  });

  it('keeps one candidate session while its assembly is current', () => {
    const start = evaluate(
      createSurfaceNOHermesShrineDeliveryCheckpoint({ placeDelayedDelivery: false }),
    );
    const session = createAuthoringSession(catalog, start);
    const prepared = session.candidates();
    expect(session.candidates()).toBe(prepared);
    session.apply(shrineOffer);
    expect(session.candidates()).not.toBe(prepared);
    session.restore(start);
    expect(session.current()).toBe(start);
  });

  it('restores the assembly and its candidate session after a probe', () => {
    const start = evaluate(
      createSurfaceNOHermesShrineDeliveryCheckpoint({ placeDelayedDelivery: false }),
    );
    const session = createAuthoringSession(catalog, start);
    const prepared = session.candidates();
    const probed = session.probe(() => {
      session.apply(shrineOffer);
      session.candidates();
      return session.current();
    });
    expect(probed).not.toBe(start);
    expect(session.current()).toBe(start);
    expect(session.candidates()).toBe(prepared);
  });

  it('passes a settlement fault through with the applied assembly', () => {
    const project = createSurfaceNOHermesShrineDeliveryCheckpoint({ placeDelayedDelivery: false });
    const source = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const entry = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(
        createOccurrenceAddress(oBiome, oOccurrenceIds.devotion),
        'hermesShrineDelivery',
      ),
      hermesShrineDeliveryEntryKey(source, 'initial:secondLeft'),
    );
    const apply = commands.applyProjectCommand;
    // The due delivery's placement never takes effect, so its obligation stays due.
    vi.spyOn(commands, 'applyProjectCommand').mockImplementation((document, catalog, command) =>
      command.kind === 'PlaceHermesShrineDelivery' ? document : apply(document, catalog, command),
    );
    const session = createAuthoringSession(catalog, evaluate(project));
    const outcome = session.apply(shrineOffer);
    expect(outcome).toMatchObject({
      kind: 'applied',
      fault: { key: expect.stringMatching(/^delivery:/), owner: entry },
    });
    if (outcome.kind === 'applied') expect(session.current()).toBe(outcome.assembly);
  });

  it('refuses a command its authority refuses before evaluation', () => {
    const start = evaluate(
      createSurfaceNOHermesShrineDeliveryCheckpoint({ placeDelayedDelivery: false }),
    );
    const apply = commands.applyProjectCommand;
    vi.spyOn(commands, 'applyProjectCommand').mockImplementation((document, catalog, command) => {
      if (command.kind === 'ReplaceHermesShrineOffer')
        throw new ProjectCommandContractError(command.kind, command.occurrence, 'refused command');
      return apply(document, catalog, command);
    });
    const session = createAuthoringSession(catalog, start);
    const outcome = session.apply(shrineOffer);
    expect(outcome).toMatchObject({ kind: 'refused', refusal: { kind: 'command' } });
    expect(session.current()).toBe(start);
  });

  it('throws a repair the command authority refuses after evaluation', () => {
    const project = createSurfaceNOHermesShrineDeliveryCheckpoint({ placeDelayedDelivery: false });
    const apply = commands.applyProjectCommand;
    vi.spyOn(commands, 'applyProjectCommand').mockImplementation((document, catalog, command) => {
      if (command.kind === 'PlaceHermesShrineDelivery')
        throw new ProjectCommandContractError(command.kind, command.entry, 'refused repair');
      return apply(document, catalog, command);
    });
    const session = createAuthoringSession(catalog, evaluate(project));
    expect(() => session.apply(shrineOffer)).toThrow('refused repair');
  });

  it('refuses a command that leaves the project unchanged', () => {
    const project = createSurfaceNOHermesShrineDeliveryCheckpoint({ placeDelayedDelivery: false });
    const start = evaluate(project);
    const session = createAuthoringSession(catalog, start);
    const outcome = session.apply({
      kind: 'ReplaceManualArcanaSelection',
      route: createRouteAddress(project.route.routeKey),
      arcanaKeys: project.route.loadout.manualArcanaKeys,
    });
    expect(outcome).toEqual({ kind: 'refused', refusal: { kind: 'unchanged' } });
    expect(session.current()).toBe(start);
  });

  it('refuses a new spend the reroll pool cannot pay', () => {
    const f = createBiomeAddress('Underworld', 'F');
    const source = 'golden-f-b2-e1';
    const target: RerollTarget = {
      kind: 'door',
      exitKey: 'exit2',
      occurrenceId: 'golden-f-b3-e2' as never,
    };
    const order = (project: ProjectDocument) =>
      project.route.biomes[0]!.topology!.occurrences.find((room) => room.occurrenceId === source)!
        .roomActions.order;
    const insert = (project: ProjectDocument): ProjectCommand => ({
      kind: 'InsertReroll',
      occurrence: createOccurrenceAddress(f, source as never),
      target,
      reward: { rewardType: 'RoomMoneyDrop' },
      index: order(project).length,
    });
    const press = (project: ProjectDocument): ProjectDocument => {
      const inserted = applyProjectCommand(project, catalog, insert(project));
      const pressed = order(inserted)
        .flatMap((reference) => (reference.kind === 'reroll' ? [reference] : []))
        .at(-1)!;
      const action = createRoomActionAddress(
        f,
        source as never,
        JSON.stringify(['reroll', pressed.rerollId]),
      );
      return applyProjectCommand(inserted, catalog, {
        kind: 'ReplaceRerollReward',
        action,
        reward: firstSupportedReroll(inserted, action, 'RunProgress'),
      });
    };
    let project = withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']);
    for (let count = 0; count < 3; count += 1) project = press(project);
    const start = evaluate(project);
    const session = createAuthoringSession(catalog, start);
    expect(session.apply(insert(project))).toMatchObject({
      kind: 'refused',
      refusal: {
        kind: 'rerollPool',
        error: { message: expect.stringContaining('the reroll pool has nothing left') },
      },
    });
    expect(session.current()).toBe(start);
  });

  it('refuses, under noNewFinding, an edit whose earlier block replaces the frontier finding', () => {
    const start = evaluate(loadUnderworldFGCheckpoint());
    const phase = reachedEncounterPhasesForProjectEvaluationAssembly(start).find(
      (entry) => generatedEncounterSupportForProjectEvaluationAssembly(start, entry) !== undefined,
    )!;
    const command = {
      kind: 'ReplaceEncounterCustomization' as const,
      phase,
      decisionKey: generatedEncounterSupportForProjectEvaluationAssembly(start, phase)!.decisionKey,
      // Five waves is representable but beyond every declared policy.
      value: { kind: 'generated' as const, waveCount: 5 },
    };
    const settled = createAuthoringSession(catalog, start).apply(command);
    expect(settled.kind).toBe('applied');
    if (settled.kind !== 'applied') return;
    const added = findingsAddedSince(
      start.evaluation.findings,
      settled.assembly.evaluation.findings,
    );
    expect(added).not.toEqual([]);

    const session = createAuthoringSession(catalog, start);
    expect(session.apply(command, 'noNewFinding')).toEqual({
      kind: 'refused',
      refusal: { kind: 'newFinding', findings: added },
    });
    expect(session.current()).toBe(start);
  });
});

describe('findings added since', () => {
  it('keys a finding by its code and semantic origin, not its evidence', () => {
    const origin = createRouteAddress('Underworld');
    const finding = (code: string, evidence: Record<string, unknown> = {}) =>
      ({ code, origin, evidence }) as never;
    expect(
      findingsAddedSince(
        [finding('a', { cost: 1 })],
        [finding('a', { cost: 2 }), finding('b'), finding('b')],
      ),
    ).toEqual([finding('b'), finding('b')]);
  });
});
