import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';
import { createArcanaFearState } from '../../src/simulation/arcana-fear';
import { createDefaultRouteLoadout } from '../../src/authored-project/loadout';
import {
  beginBiomeKeepsakeState,
  consumeFigLeafUse,
  createKeepsakeState,
} from '../../src/simulation/keepsakes';
import {
  applyProjectCommand,
  createEncounterPhaseAddress,
  createCompletionRoomAddress,
  createPostbossKeepsakeSelectionAddress,
  createOccurrenceId,
  createRouteStartKeepsakeSelectionAddress,
  semanticAddressKey,
} from '../../src/authored-project';
import {
  encounterPhaseFigLeafSupportForProjectEvaluationAssembly,
  simulateProject,
  simulateProjectAssembly,
} from '../../src/simulation';
import {
  createCompleteFGProject,
  createRepresentativeNProject,
  createRepresentativeNOProject,
  createRepresentativeNOPProject,
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceId,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
  qBiome,
  qOccurrenceIds,
} from '@run-planner/test-fixtures';
import type { HistoryEvent } from '../../src/simulation/history/model';

type EncounterLifecycleHistoryEvent = Extract<
  HistoryEvent,
  { readonly kind: 'encounterStarted' | 'encounterCompleted' }
>;

function isEncounterLifecycleEvent(event: HistoryEvent): event is EncounterLifecycleHistoryEvent {
  return event.kind === 'encounterStarted' || event.kind === 'encounterCompleted';
}

function withFigLeaf(project = createCompleteFGProject()) {
  const routeKey =
    project.routes.find((route) => route.biomes.length > 0)?.routeKey ?? 'Underworld';
  const result = applyProjectCommand(project, catalog, {
    kind: 'ReplaceStartingKeepsake',
    selection: createRouteStartKeepsakeSelectionAddress(routeKey),
    keepsakeKey: 'SkipEncounterKeepsake',
  });
  return result;
}

describe('Fig Leaf state contract', () => {
  it('walks a real authored F/G project with Fig Leaf equipped', () => {
    const project = withFigLeaf();
    const evaluation = simulateProject(catalog, project);
    expect(evaluation.routes[0]?.biomes[0]).toMatchObject({ biomeKey: 'F', validity: 'valid' });
    expect('rewards' in evaluation.routes[0]!.biomes[0]!).toBe(true);
  });

  it('consumes one legal skip and preserves the later same-biome guard through the real walker', () => {
    const phase = createEncounterPhaseAddress(
      { kind: 'biome', routeKey: 'Underworld', biomeKey: 'F' },
      { kind: 'occurrence', occurrenceId: createOccurrenceId('golden-f-b2-e1') },
      'Encounter',
    );
    const firstSelected = applyProjectCommand(withFigLeaf(), catalog, {
      kind: 'ReplaceFigLeafSkip',
      phase,
      value: true,
    });
    const laterPhase = createEncounterPhaseAddress(
      { kind: 'biome', routeKey: 'Underworld', biomeKey: 'F' },
      { kind: 'occurrence', occurrenceId: createOccurrenceId('golden-f-b3-e1') },
      'Encounter',
    );
    const project = applyProjectCommand(firstSelected, catalog, {
      kind: 'ReplaceFigLeafSkip',
      phase: laterPhase,
      value: true,
    });
    const evaluation = simulateProject(catalog, project);
    const biome = evaluation.routes[0]?.biomes.find((entry) => entry.biomeKey === 'F');
    if (biome === undefined || !('rewards' in biome))
      throw new Error('F reward evaluation missing');
    expect(biome.rewards.validity).toBe('invalid');
    expect(biome.rewards.branches[0]?.keepsakes.figLeaf).toEqual({
      remainingUses: 2,
      activatedThisBiome: true,
    });
    const laterSameBiome = biome.rewards.figLeafPhaseCandidates.find(
      (candidate) =>
        candidate.origin.owner.kind === 'occurrence' &&
        candidate.origin.owner.occurrenceId === createOccurrenceId('golden-f-b3-e1'),
    );
    expect(laterSameBiome).toMatchObject({ supported: false, selected: true });
    const laterEvents = biome.history.events
      .filter(isEncounterLifecycleEvent)
      .filter(
        (event) =>
          event.origin.kind === 'occurrence' &&
          event.origin.occurrenceId === createOccurrenceId('golden-f-b3-e1'),
      );
    expect(laterEvents).not.toHaveLength(0);
    expect(laterEvents.every((event) => event.execution === 'normal')).toBe(true);
    expect(
      biome.findings.some(
        (finding) =>
          finding.code === 'figLeafSkipUnavailable' &&
          semanticAddressKey(finding.origin) === semanticAddressKey(laterPhase),
      ),
    ).toBe(true);
  });
  it('starts at three total uses, consumes once, and reopens only at a biome boundary', () => {
    const arcana = createArcanaFearState(catalog, createDefaultRouteLoadout(catalog));
    const initial = createKeepsakeState(catalog, 'SkipEncounterKeepsake', arcana);
    expect(initial.figLeaf).toEqual({ remainingUses: 3, activatedThisBiome: false });

    const consumed = consumeFigLeafUse(initial);
    expect(consumed.figLeaf).toEqual({ remainingUses: 2, activatedThisBiome: true });
    expect(consumeFigLeafUse(consumed)).toBe(consumed);
    expect(beginBiomeKeepsakeState(consumed).figLeaf).toEqual({
      remainingUses: 2,
      activatedThisBiome: false,
    });
  });

  it.each([
    ['N', createRepresentativeNProject],
    ['N/O', createRepresentativeNOProject],
    ['N/O/P', createRepresentativeNOPProject],
    ['N/O/P/Q', createRepresentativeNOPQProject],
  ])('walks the real %s route with persistent Fig Leaf state', (_name, createProject) => {
    const evaluation = simulateProject(catalog, withFigLeaf(createProject()));
    const route = evaluation.routes.find((candidate) => candidate.biomes.length > 0);
    expect(route).toBeDefined();
    expect(route?.biomes.every((biome) => 'rewards' in biome)).toBe(true);
    for (const biome of route?.biomes ?? []) {
      if ('rewards' in biome) expect(biome.rewards.branches[0]?.keepsakes.figLeaf).toBeDefined();
    }
  });

  it('publishes O phase opportunities independently and keeps P/Q declaration support narrow', () => {
    const evaluation = simulateProject(catalog, withFigLeaf(createRepresentativeNOPQProject()));
    const route = evaluation.routes.find((candidate) => candidate.biomes.length > 0);
    if (route === undefined) throw new Error('route missing');
    const rewardBiomes = route.biomes.filter(
      (biome): biome is Extract<(typeof route.biomes)[number], { readonly rewards: unknown }> =>
        'rewards' in biome,
    );
    const n = rewardBiomes.find((biome) => biome.biomeKey === 'N');
    const o = rewardBiomes.find((biome) => biome.biomeKey === 'O');
    const p = rewardBiomes.find((biome) => biome.biomeKey === 'P');
    const q = rewardBiomes.find((biome) => biome.biomeKey === 'Q');
    if (p === undefined || q === undefined) throw new Error('P/Q reward evaluations missing');
    const pCandidates = p.rewards.figLeafPhaseCandidates;
    const qCandidates = q.rewards.figLeafPhaseCandidates;
    expect(n?.rewards.branches[0]?.keepsakes.figLeaf).toEqual({
      remainingUses: 3,
      activatedThisBiome: false,
    });
    expect(
      o?.rewards.figLeafPhaseCandidates.filter(
        (candidate) => candidate.origin.phaseKey === 'Intro',
      ),
    ).not.toHaveLength(0);
    expect(
      o?.rewards.figLeafPhaseCandidates.filter(
        (candidate) => candidate.origin.phaseKey === 'Combat1',
      ),
    ).not.toHaveLength(0);
    expect(pCandidates).toHaveLength(6);
    expect(pCandidates.every((candidate) => candidate.origin.phaseKey === 'Intro')).toBe(true);
    expect(qCandidates).toHaveLength(4);
    expect(qCandidates.every((candidate) => candidate.origin.phaseKey === 'Encounter')).toBe(true);
    expect(qCandidates.every((candidate) => candidate.supported)).toBe(true);
  });

  it('allows only the first selected O phase in one Ship envelope to suppress execution', () => {
    const occurrenceId = oOccurrenceIds.combat04;
    const intro = createEncounterPhaseAddress(
      oBiome,
      { kind: 'occurrence', occurrenceId },
      'Intro',
    );
    const combat1 = createEncounterPhaseAddress(
      oBiome,
      { kind: 'occurrence', occurrenceId },
      'Combat1',
    );
    let project = withFigLeaf(createRepresentativeNOProject());
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFigLeafSkip',
      phase: intro,
      value: true,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFigLeafSkip',
      phase: combat1,
      value: true,
    });
    const evaluation = simulateProject(catalog, project);
    const o = evaluation.routes
      .flatMap((route) => route.biomes)
      .find((biome) => biome.biomeKey === 'O');
    if (o === undefined || !('history' in o)) throw new Error('O history missing');
    const events = o.history.events
      .filter(isEncounterLifecycleEvent)
      .filter(
        (event) => event.origin.kind === 'occurrence' && event.origin.occurrenceId === occurrenceId,
      );
    const introEvents = events.filter((event) => event.phaseKey === 'Intro');
    const combat1Events = events.filter((event) => event.phaseKey === 'Combat1');
    expect(introEvents).not.toHaveLength(0);
    expect(combat1Events).not.toHaveLength(0);
    expect(introEvents.every((event) => event.execution === 'skippedByFigLeaf')).toBe(true);
    expect(introEvents.every((event) => event.figLeafSkipOwner === true)).toBe(true);
    expect(combat1Events.every((event) => event.execution === 'normal')).toBe(true);
    expect(combat1Events.every((event) => event.figLeafSkipOwner !== true)).toBe(true);
    expect(
      o.findings.some(
        (finding) =>
          finding.code === 'figLeafSkipUnavailable' &&
          semanticAddressKey(finding.origin) === semanticAddressKey(combat1),
      ),
    ).toBe(true);
  });

  it('keeps a selected Opening N phase visible while executing it normally', () => {
    const phase = createEncounterPhaseAddress(
      nBiome,
      { kind: 'occurrence', occurrenceId: createOccurrenceId('surface-n-opening') },
      'Encounter',
    );
    const project = applyProjectCommand(withFigLeaf(createRepresentativeNProject()), catalog, {
      kind: 'ReplaceFigLeafSkip',
      phase,
      value: true,
    });
    const evaluation = simulateProject(catalog, project);
    const n = evaluation.routes
      .flatMap((route) => route.biomes)
      .find((biome) => biome.biomeKey === 'N');
    if (n === undefined || !('history' in n)) throw new Error('N history missing');
    const openingEvents = n.history.events
      .filter(isEncounterLifecycleEvent)
      .filter(
        (event) =>
          event.origin.kind === 'occurrence' &&
          event.origin.occurrenceId === createOccurrenceId('surface-n-opening'),
      );
    expect(openingEvents).not.toHaveLength(0);
    expect(openingEvents.every((event) => event.execution === 'normal')).toBe(true);
    expect(
      n.findings.some(
        (finding) =>
          finding.code === 'figLeafSkipUnavailable' &&
          semanticAddressKey(finding.origin) === semanticAddressKey(phase),
      ),
    ).toBe(true);
  });

  it('spends a retained Fig Leaf use on one supported Q phase', () => {
    const phase = createEncounterPhaseAddress(
      qBiome,
      { kind: 'occurrence', occurrenceId: qOccurrenceIds.foyer },
      'Encounter',
    );
    const project = applyProjectCommand(withFigLeaf(createRepresentativeNOPQProject()), catalog, {
      kind: 'ReplaceFigLeafSkip',
      phase,
      value: true,
    });
    const evaluation = simulateProject(catalog, project);
    const q = evaluation.routes
      .flatMap((route) => route.biomes)
      .find((biome) => biome.biomeKey === 'Q');
    if (q === undefined || !('history' in q) || !('rewards' in q)) {
      throw new Error('Q evaluation missing');
    }
    const events = q.history.events
      .filter(isEncounterLifecycleEvent)
      .filter(
        (event) =>
          event.origin.kind === 'occurrence' && event.origin.occurrenceId === qOccurrenceIds.foyer,
      );
    expect(events).not.toHaveLength(0);
    expect(events.every((event) => event.execution === 'skippedByFigLeaf')).toBe(true);
    expect(events.every((event) => event.figLeafSkipOwner === true)).toBe(true);
    expect(q.rewards.branches[0]?.keepsakes.figLeaf).toEqual({
      remainingUses: 2,
      activatedThisBiome: true,
    });
    expect(
      q.findings.some(
        (finding) =>
          finding.code === 'figLeafSkipUnavailable' &&
          semanticAddressKey(finding.origin) === semanticAddressKey(phase),
      ),
    ).toBe(false);
  });

  it('executes an authored Fig Leaf selection normally when no Fig Leaf is equipped', () => {
    const phase = createEncounterPhaseAddress(
      { kind: 'biome', routeKey: 'Underworld', biomeKey: 'F' },
      { kind: 'occurrence', occurrenceId: createOccurrenceId('golden-f-b2-e1') },
      'Encounter',
    );
    const project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceFigLeafSkip',
      phase,
      value: true,
    });
    const evaluation = simulateProject(catalog, project);
    const f = evaluation.routes
      .flatMap((route) => route.biomes)
      .find((biome) => biome.biomeKey === 'F');
    if (f === undefined || !('history' in f) || !('rewards' in f))
      throw new Error('F history missing');
    const events = f.history.events
      .filter(isEncounterLifecycleEvent)
      .filter(
        (event) =>
          event.origin.kind === 'occurrence' &&
          event.origin.occurrenceId === createOccurrenceId('golden-f-b2-e1'),
      );
    expect(events).not.toHaveLength(0);
    expect(events.every((event) => event.execution === 'normal')).toBe(true);
    expect(
      f.findings.some(
        (finding) =>
          finding.code === 'figLeafSkipUnavailable' &&
          semanticAddressKey(finding.origin) === semanticAddressKey(phase),
      ),
    ).toBe(true);
    expect(f.rewards.branches[0]?.keepsakes.figLeaf).toBeUndefined();
  });

  it('executes a fourth selected phase normally after three legal biome skips exhaust total uses', () => {
    const selections = [
      createEncounterPhaseAddress(
        nBiome,
        { kind: 'occurrence', occurrenceId: nOccurrenceId('combat02') },
        'Encounter',
      ),
      createEncounterPhaseAddress(
        oBiome,
        { kind: 'occurrence', occurrenceId: oOccurrenceIds.combat04 },
        'Intro',
      ),
      createEncounterPhaseAddress(
        pBiome,
        { kind: 'occurrence', occurrenceId: createOccurrenceId('surface-p-1-1-p_combat03') },
        'Intro',
      ),
      createEncounterPhaseAddress(
        qBiome,
        { kind: 'occurrence', occurrenceId: qOccurrenceIds.foyer },
        'Encounter',
      ),
    ];
    let project = withFigLeaf(createRepresentativeNOPQProject());
    for (const phase of selections) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceFigLeafSkip',
        phase,
        value: true,
      });
    }
    const evaluation = simulateProject(catalog, project);
    const q = evaluation.routes
      .flatMap((route) => route.biomes)
      .find((biome) => biome.biomeKey === 'Q');
    if (q === undefined || !('history' in q)) throw new Error('Q history missing');
    const qEvents = q.history.events
      .filter(isEncounterLifecycleEvent)
      .filter(
        (event) =>
          event.origin.kind === 'occurrence' && event.origin.occurrenceId === qOccurrenceIds.foyer,
      );
    expect(qEvents).not.toHaveLength(0);
    expect(qEvents.every((event) => event.execution === 'normal')).toBe(true);
    expect(
      q.findings.some(
        (finding) =>
          finding.code === 'figLeafSkipUnavailable' &&
          semanticAddressKey(finding.origin) === semanticAddressKey(selections[3]!),
      ),
    ).toBe(true);
    if (!('rewards' in q)) throw new Error('Q rewards missing');
    expect(q.rewards.branches[0]?.keepsakes.figLeaf).toEqual({
      remainingUses: 0,
      activatedThisBiome: false,
    });
  });

  it('carries consumed uses through a postboss replacement and resets the next biome guard', () => {
    const selectedPhase = createEncounterPhaseAddress(
      nBiome,
      { kind: 'occurrence', occurrenceId: nOccurrenceId('combat02') },
      'Encounter',
    );
    const skipped = applyProjectCommand(withFigLeaf(createRepresentativeNOProject()), catalog, {
      kind: 'ReplaceFigLeafSkip',
      phase: selectedPhase,
      value: true,
    });
    const replacement = applyProjectCommand(skipped, catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: createPostbossKeepsakeSelectionAddress(
        createCompletionRoomAddress(nBiome, 'postboss'),
      ),
      value: { kind: 'replace', keepsakeKey: 'GoldifyKeepsake' },
    });
    const evaluation = simulateProject(catalog, replacement);
    const route = evaluation.routes.find((candidate) => candidate.biomes.length > 0);
    if (route === undefined) throw new Error('route missing');
    const n = route.biomes.find((biome) => biome.biomeKey === 'N');
    const o = route.biomes.find((biome) => biome.biomeKey === 'O');
    if (n === undefined || !('rewards' in n) || o === undefined || !('rewards' in o)) {
      throw new Error('N/O rewards missing');
    }
    expect(n.rewards.branches[0]?.keepsakes.figLeaf).toEqual({
      remainingUses: 2,
      activatedThisBiome: true,
    });
    expect(o.rewards.branches[0]?.keepsakes).toMatchObject({
      currentKey: 'GoldifyKeepsake',
      figLeaf: { remainingUses: 2, activatedThisBiome: false },
    });
  });

  it('keeps Opening N blocked by biome-start ownership while publishing PreHub N support', () => {
    const project = withFigLeaf(createRepresentativeNProject());
    const assembly = simulateProjectAssembly(catalog, project);
    const opening = encounterPhaseFigLeafSupportForProjectEvaluationAssembly(
      assembly,
      createEncounterPhaseAddress(
        nBiome,
        { kind: 'occurrence', occurrenceId: createOccurrenceId('surface-n-opening') },
        'Encounter',
      ),
    );
    const preHub = encounterPhaseFigLeafSupportForProjectEvaluationAssembly(
      assembly,
      createEncounterPhaseAddress(
        nBiome,
        { kind: 'occurrence', occurrenceId: createOccurrenceId('surface-n-prehub') },
        'Encounter',
      ),
    );
    expect(opening).toBeUndefined();
    expect(preHub).toMatchObject({ supported: true, selected: false });
  });

  it('withholds P Fig Leaf support when the selected Athena combat declaration blocks the room', () => {
    const occurrenceId = pOccurrenceId('P_Combat10', 6, 1);
    const phase = createEncounterPhaseAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId },
      'Combat',
    );
    const selected = applyProjectCommand(withFigLeaf(createRepresentativeNOPQProject()), catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'AthenaCombatP',
    });
    const support = encounterPhaseFigLeafSupportForProjectEvaluationAssembly(
      simulateProjectAssembly(catalog, selected),
      phase,
    );
    expect(support).toBeUndefined();
  });

  it('keeps the real walker phase identities while suppressing a selected P precombat envelope', () => {
    const base = withFigLeaf(createRepresentativeNOPProject());
    const phase = createEncounterPhaseAddress(
      { kind: 'biome', routeKey: 'Surface', biomeKey: 'P' },
      { kind: 'occurrence', occurrenceId: createOccurrenceId('surface-p-1-1-p_combat03') },
      'Intro',
    );
    const authored = applyProjectCommand(base, catalog, {
      kind: 'ReplaceFigLeafSkip',
      phase,
      value: true,
    });
    const evaluation = simulateProject(catalog, authored);
    const p = evaluation.routes
      .flatMap((route) => route.biomes)
      .find((biome) => biome.biomeKey === 'P');
    expect(p).toBeDefined();
    if (p === undefined || !('history' in p)) throw new Error('P history missing');
    const encounters = p.history.events.filter(
      (event) => event.kind === 'encounterStarted' || event.kind === 'encounterCompleted',
    );
    const selectedLifecycle = encounters.filter(
      (event) =>
        event.origin.kind === 'occurrence' &&
        event.origin.occurrenceId === createOccurrenceId('surface-p-1-1-p_combat03'),
    );
    expect(selectedLifecycle).toHaveLength(4);
    expect(
      selectedLifecycle.map(
        (event) => `${event.kind}:${'phaseKey' in event ? event.phaseKey : ''}`,
      ),
    ).toEqual([
      'encounterStarted:Intro',
      'encounterCompleted:Intro',
      'encounterStarted:Combat',
      'encounterCompleted:Combat',
    ]);
    expect(
      selectedLifecycle.every(
        (event) => 'execution' in event && event.execution === 'skippedByFigLeaf',
      ),
    ).toBe(true);
    expect(
      selectedLifecycle
        .filter((event) => event.kind === 'encounterStarted' || event.kind === 'encounterCompleted')
        .filter((event) => event.phaseKey === 'Intro')
        .every((event) => event.figLeafSkipOwner),
    ).toBe(true);
    expect(
      selectedLifecycle
        .filter((event) => event.kind === 'encounterStarted' || event.kind === 'encounterCompleted')
        .filter((event) => event.phaseKey === 'Combat')
        .every((event) => !event.figLeafSkipOwner),
    ).toBe(true);
    expect(encounters.length).toBeGreaterThan(0);
    expect(new Set(encounters.map((event) => event.origin.kind)).size).toBeGreaterThan(0);
    expect(
      encounters.some((event) => 'execution' in event && event.execution === 'skippedByFigLeaf'),
    ).toBe(true);
    expect(encounters.some((event) => 'execution' in event && event.execution === 'normal')).toBe(
      true,
    );
    expect(p.history.events.some((event) => event.kind === 'roomCommitted')).toBe(true);
  });

  it('retains an authored N side-room skip and reports the declaration blocker at its phase owner', () => {
    const base = withFigLeaf(createRepresentativeNProject());
    const phase = createEncounterPhaseAddress(
      nBiome,
      {
        kind: 'localChild',
        occurrenceId: nOccurrenceId('combat02'),
        groupKey: 'sideRooms',
        slotKey: 'sideDoor1',
      },
      'Encounter',
    );
    const authored = applyProjectCommand(base, catalog, {
      kind: 'ReplaceFigLeafSkip',
      phase,
      value: true,
    });
    const evaluation = simulateProject(catalog, authored);
    const n = evaluation.routes
      .flatMap((route) => route.biomes)
      .find((biome) => biome.biomeKey === 'N');
    const blocked = n?.findings.find((finding) => finding.code === 'figLeafSkipUnavailable');
    expect(blocked).toBeDefined();
    expect(blocked && semanticAddressKey(blocked.origin)).toBe(semanticAddressKey(phase));
    expect(blocked?.evidence.reason).toBe('envelopeBlocker');
    const parent = authored.routes
      .flatMap((route) => route.biomes)
      .find((biome) => biome.biomeKey === 'N')
      ?.topology?.occurrences.find(
        (candidate) => candidate.occurrenceId === nOccurrenceId('combat02'),
      );
    if (parent?.state.kind !== 'ephyraCombat') throw new Error('N combat parent missing');
    expect(parent.state.sideRooms.sideDoor1?.encounters.figLeafSkipByPhase).toEqual({
      Encounter: true,
    });
  });
});
