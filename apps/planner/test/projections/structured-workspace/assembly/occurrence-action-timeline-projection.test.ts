import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createEncounterPhaseAddress,
  createNemesisRandomEventAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRouteStartKeepsakeSelectionAddress,
  roomActionKey,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { goldLedgerForProjectEvaluationAssembly } from '@run-planner/engine/simulation';
import {
  loadUnderworldAutomaticBossCheckpoint,
  loadUnderworldFigLeafCheckpoint,
  loadUnderworldGAnomalyRosterCheckpoint,
  loadNemesisFieldsCheckpoint,
  loadUnderworldGorgonAthenaCheckpoint,
  loadUnderworldWorldShopTravelDealCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/underworld';
import {
  createCompleteFGProject,
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenGBiome,
  goldenGOccurrenceId,
} from '@run-planner/test-fixtures/underworld';
import {
  loadSurfaceNOPQProject,
  nBiome,
  nOccurrenceId,
  nOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import { describe, expect, it } from 'vitest';
import type {
  WorkspaceOccurrenceWorkbenchNode,
  WorkspaceRoomLifecycleTimelineEntry,
} from '@planner/projections/structured-workspace';
import { projectStructuredWorkspaceFixture } from '@planner-test/fixtures/structuredWorkspace';
import { galleryCases } from '@planner-test/support/gallery/cases';
import { buildGalleryProject } from '@planner-test/support/gallery/galleryCase';
import { splitAtRoomStop } from '@planner/projections/structured-workspace/assembly/occurrence-action-timeline-projection';

function projectedWhere(
  project: ProjectDocument,
  matches: (room: WorkspaceOccurrenceWorkbenchNode['room']) => boolean,
) {
  const result = projectStructuredWorkspaceFixture(project);
  const node = result.workspace.route.biomes
    .flatMap((biome) => biome.nodes)
    .find(
      (candidate): candidate is WorkspaceOccurrenceWorkbenchNode =>
        candidate.kind === 'occurrenceWorkbench' && matches(candidate.room),
    );
  if (node === undefined) throw new Error('The room is missing');
  return { room: node.room, assembly: result.assembly };
}

function projected(project: ProjectDocument, occurrenceId: OccurrenceId) {
  return projectedWhere(project, (room) => room.occurrenceId === occurrenceId);
}

function roomOf(project: ProjectDocument, occurrenceId: OccurrenceId) {
  return projected(project, occurrenceId).room;
}

type BoundaryEntry = Extract<WorkspaceRoomLifecycleTimelineEntry, { readonly kind: 'boundary' }>;

function banners(room: ReturnType<typeof roomOf>, kind: BoundaryEntry['boundary']['kind']) {
  return (room.roomActions?.timeline.entries ?? []).filter(
    (entry): entry is BoundaryEntry => entry.kind === 'boundary' && entry.boundary.kind === kind,
  );
}

function startIdentities(room: ReturnType<typeof roomOf>) {
  return banners(room, 'encounterStart').map((entry) =>
    entry.supplement?.kind === 'encounterStart' ? entry.supplement.identityLabel : undefined,
  );
}

describe('encounter banner supplements', () => {
  const shapeOf = (room: ReturnType<typeof roomOf>) =>
    (room.roomActions?.timeline.entries ?? []).flatMap((entry) =>
      entry.kind === 'boundary' ? [entry.boundary.kind] : [],
    );

  it('hosts the identity on the start and the Anomaly capture point on its outcome', () => {
    const room = roomOf(
      loadUnderworldGAnomalyRosterCheckpoint(),
      createOccurrenceId('golden-g-b3-e2'),
    );
    const [start] = banners(room, 'encounterStart');
    const [outcome] = banners(room, 'encounterOutcome');
    expect(start?.supplement).toMatchObject({
      kind: 'encounterStart',
      identityLabel: 'Anomaly combat',
      phase: { address: { phaseKey: 'Encounter' } },
    });
    expect(outcome?.supplement).toMatchObject({
      kind: 'encounterOutcome',
      choices: ['anomalyCleared'],
    });
    expect(outcome?.label).toBe('Encounter outcome');
    // The end announces what spawns and hosts no choice.
    expect(banners(room, 'encounterEnd').every((entry) => entry.supplement === undefined)).toBe(
      true,
    );
    expect(shapeOf(room).slice(1, 4)).toEqual([
      'encounterStart',
      'encounterOutcome',
      'encounterEnd',
    ]);
  });

  it('keeps the Gorgon condition on the Encounter outcome, read as the fight ends', () => {
    const room = roomOf(
      loadUnderworldGorgonAthenaCheckpoint(),
      createOccurrenceId('golden-g-b1-e1'),
    );
    const [outcome] = banners(room, 'encounterOutcome');
    expect(outcome?.supplement).toMatchObject({
      kind: 'encounterOutcome',
      choices: expect.arrayContaining(['gorgonCondition']),
      phase: { gorgonCondition: { selected: true, supported: true } },
    });
    expect(banners(room, 'encounterEnd').every((entry) => entry.supplement === undefined)).toBe(
      true,
    );
  });

  it('shows no outcome where the fight hosts no choice', () => {
    const room = roomOf(loadUnderworldFigLeafCheckpoint(), createOccurrenceId('golden-f-start'));
    expect(banners(room, 'encounterOutcome')).toEqual([]);
    expect(room.roomActions?.timeline.boundaries.map((boundary) => boundary.kind)).not.toContain(
      'encounterOutcome',
    );
  });

  it('hosts the Aetos wave and the Gorgon condition on one outcome', () => {
    const entry = galleryCases.find((candidate) => candidate.id === 'outcome-aetos-gorgon')!;
    const room = roomOf(buildGalleryProject(entry), createOccurrenceId('surface-p-1-1-p_combat03'));
    const outcomes = banners(room, 'encounterOutcome');
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]?.supplement).toMatchObject({
      kind: 'encounterOutcome',
      choices: ['aetos', 'gorgonCondition'],
      phase: { address: { phaseKey: 'Combat' } },
    });
  });

  it('gives a Nemesis kill race its outcome beside its bet gold on the end', () => {
    const occurrenceId = goldenGOccurrenceId(4, 1);
    const project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'SelectEncounter',
      phase: createEncounterPhaseAddress(
        goldenGBiome,
        { kind: 'occurrence', occurrenceId },
        'Encounter',
      ),
      encounterKey: 'NemesisCombatG',
    });
    const room = roomOf(project, occurrenceId);
    const [start] = banners(room, 'encounterStart');
    const [outcome] = banners(room, 'encounterOutcome');
    expect(start?.supplement).toMatchObject({
      kind: 'encounterStart',
      identityLabel: 'Nemesis combat',
    });
    expect(outcome?.supplement).toMatchObject({
      kind: 'encounterOutcome',
      choices: ['nemesisBet'],
      phase: { address: { phaseKey: 'Encounter' }, nemesisBet: expect.any(Object) },
    });
    // An unauthored race is a win: the bet's payout joins the phase's fight gold.
    expect(room.roomActions?.phaseFightGold).toEqual([
      {
        phaseKey: 'Encounter',
        gold: expect.objectContaining({ label: expect.stringMatching(/^\+/) }),
      },
    ]);
  });
});

describe('Nemesis interaction family', () => {
  function interactionRows(room: ReturnType<typeof roomOf>) {
    return (room.roomActions?.timeline.entries ?? []).flatMap((entry) =>
      entry.kind === 'action' && entry.supplement?.kind === 'nemesisInteraction' ? [entry] : [],
    );
  }

  function identityLabels(room: ReturnType<typeof roomOf>) {
    return (room.roomActions?.timeline.entries ?? []).flatMap((entry) =>
      entry.kind === 'boundary' && entry.supplement?.kind === 'encounterStart'
        ? [entry.supplement.identityLabel]
        : [],
    );
  }

  it('keeps the interaction on its movable row and settles the trade with its encounter', () => {
    const occurrenceId = goldenFOccurrenceId(5, 1);
    const phase = createEncounterPhaseAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId },
      'Encounter',
    );
    let project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'NemesisRandomEvent',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectNemesisRandomEventFamily',
      event: createNemesisRandomEventAddress(phase),
      family: 'goldTrade',
    });
    const room = roomOf(project, occurrenceId);
    const order = (room.roomActions?.timeline.entries ?? []).flatMap((entry) =>
      entry.kind === 'boundary'
        ? [entry.boundary.kind]
        : entry.kind === 'action' && entry.supplement?.kind === 'nemesisInteraction'
          ? ['interaction']
          : [],
    );
    // Answering her ends the encounter; until her offer is settled the room stops at her row.
    const start = order.indexOf('encounterStart');
    expect(order.slice(start)).toEqual(['encounterStart', 'interaction']);
    expect(interactionRows(room)).toEqual([
      expect.objectContaining({
        actionKey: roomActionKey({ kind: 'interactEncounter', phaseKey: 'Encounter' }),
        supplement: { kind: 'nemesisInteraction', owner: createNemesisRandomEventAddress(phase) },
      }),
    ]);
    expect(banners(room, 'roomEntered')[0]?.supplement).toBeUndefined();
    expect(identityLabels(room)).toEqual(['Nemesis event · Gold trade']);
    // The trade's outcome, read as answering her ends the encounter, waits with that outcome.
    expect(room.roomActions?.timeline.notReached).toContainEqual(
      expect.objectContaining({
        kind: 'events',
        label: 'Encounter outcome',
        supplement: expect.objectContaining({
          kind: 'encounterOutcome',
          choices: ['nemesisEvent'],
          phase: expect.objectContaining({
            nemesisEvent: expect.objectContaining({
              value: expect.objectContaining({ kind: 'goldTrade' }),
            }),
          }),
        }),
      }),
    );
  });

  it('names the Fields Passive event on its start banner and keeps its interaction on its row', () => {
    const { room } = projectedWhere(loadNemesisFieldsCheckpoint(), (candidate) =>
      candidate.encounterPhases.some(
        (phase) => phase.address.phaseKey === 'Passive' && phase.nemesisEvent !== undefined,
      ),
    );
    const [entered] = banners(room, 'roomEntered');
    expect(
      entered?.supplement?.kind === 'encounterStart' ? entered.supplement.identityLabel : undefined,
    ).toBeUndefined();
    expect(identityLabels(room).filter((label) => label?.includes('Nemesis'))).toEqual([
      expect.stringMatching(/Nemesis event · /),
    ]);
    // The event's start banner is not a cage: only the cages' banners carry a slot.
    expect(
      banners(room, 'encounterStart').map((entry) => [entry.label, entry.fieldsCage?.slot]),
    ).toEqual([
      ['Encounter started', undefined],
      ['Encounter started', 3],
      ['Encounter started', 2],
      ['Encounter started', 1],
    ]);
    expect(interactionRows(room)).toEqual([
      expect.objectContaining({
        supplement: expect.objectContaining({ kind: 'nemesisInteraction' }),
      }),
    ]);
  });
});

describe('encounter banner identity', () => {
  it('always names the encounter and omits the role in a single-phase room', () => {
    expect(
      startIdentities(roomOf(createGoldenFGHIProject(), createOccurrenceId('golden-f-b10-e1'))),
    ).toEqual(['Combat']);
  });

  it('names each phase role beside another start banner', () => {
    const project = loadSurfaceNOPQProject();
    expect(
      startIdentities(roomOf(project, createOccurrenceId('surface-p-6-1-p_combat10'))),
    ).toEqual(['Pre-combat · Combat', 'Follow-up · Combat']);
    expect(startIdentities(roomOf(project, createOccurrenceId('surface-o-combat01')))).toEqual([
      'Intro · Ship intro',
      'Combat 1 · Ship combat',
    ]);
  });

  it('lets a Fields cage tag name its phase instead of a role', () => {
    expect(
      startIdentities(roomOf(createGoldenFGHIProject(), createOccurrenceId('golden-h-combat05'))),
    ).toEqual(['Combat', 'Combat', 'Combat']);
  });
});

describe('retained encounter events', () => {
  const skipped = createOccurrenceId('golden-f-b2-e1');
  const phaseOf = (project: ProjectDocument) =>
    roomOf(project, skipped).encounterPhases.find(
      (phase) => phase.address.phaseKey === 'Encounter',
    );

  it('publishes a Fig Leaf skip and leaves an inapplicable empty Gorgon condition out', () => {
    const phase = phaseOf(loadUnderworldFigLeafCheckpoint());
    expect(phase).toMatchObject({ skippedByFigLeaf: true, figLeaf: { selected: true } });
    expect(phase?.gorgonCondition).toBeUndefined();
  });

  it('publishes no Fig Leaf on a later phase once the skip is spent', () => {
    let project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Surface'),
      keepsakeKey: 'SkipEncounterKeepsake',
    });
    const spentPhase = (occurrenceId: OccurrenceId) =>
      roomOf(project, occurrenceId).encounterPhases.find(
        (phase) => phase.address.phaseKey === 'Encounter',
      );
    expect(spentPhase(nOccurrenceId('combat05'))?.figLeaf).toBeDefined();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFigLeafSkip',
      phase: createEncounterPhaseAddress(
        nBiome,
        { kind: 'occurrence', occurrenceId: nOccurrenceIds.preHub },
        'Encounter',
      ),
      value: true,
    });
    expect(spentPhase(nOccurrenceIds.preHub)?.figLeaf).toMatchObject({ selected: true });
    expect(spentPhase(nOccurrenceId('combat05'))?.figLeaf).toBeUndefined();
  });

  it('keeps a retained Gorgon condition on a skipped phase as unsupported', () => {
    const project = applyProjectCommand(loadUnderworldFigLeafCheckpoint(), catalog, {
      kind: 'ReplaceGorgonDeathDefianceCondition',
      phase: createEncounterPhaseAddress(
        goldenFBiome,
        { kind: 'occurrence', occurrenceId: skipped },
        'Encounter',
      ),
      value: true,
    });
    // The retained condition stays visible and editable with its finding.
    expect(phaseOf(project)).toMatchObject({
      figLeaf: { selected: true },
      gorgonCondition: { selected: true, supported: false },
    });
  });
});

describe('engine-published row facts', () => {
  it('carries a Travel Deal restock’s source family on its row', () => {
    const room = roomOf(
      loadUnderworldWorldShopTravelDealCheckpoint(),
      createOccurrenceId('golden-f-preboss-shop'),
    );
    const refill = room.roomActions?.rows.find(
      (row) => row.sourceFamily?.kind === 'shopTravelDealRefill',
    );
    expect(refill).toMatchObject({
      reference: { kind: 'interactAcquisitionEntry' },
      travelDeal: true,
      purchaseRemoval: { command: { kind: 'RemoveRoomAction' } },
    });
  });

  it('shows the gold the ledger attributes to a row on that row', () => {
    const occurrenceId = createOccurrenceId('golden-f-b10-e1');
    const { room, assembly } = projected(createGoldenFGHIProject(), occurrenceId);
    const priced = goldLedgerForProjectEvaluationAssembly(catalog, assembly).roomAt(
      createOccurrenceAddress(goldenFBiome, occurrenceId),
    );
    if (priced.availability !== 'available') throw new Error('The room is not priced');
    const gain = priced.room.gains.find((candidate) => candidate.kind === 'moneyPickup');
    if (gain?.roomAction === undefined) throw new Error('The money pickup names no row');
    const row = room.roomActions?.rows.find(
      (candidate) => candidate.key === gain.roomAction!.actionKey,
    );
    expect(row?.reference).toEqual({
      kind: 'interactIncomingReward',
      producerPoint: 'roomRewardPickup',
      acquisitionRole: 'self',
    });
    expect(row?.key).toBe(roomActionKey(row!.reference));
    expect(row?.goldGained).toEqual({ label: '+100' });
  });
});

describe('boss defeat', () => {
  it('stands as the Boss room outcome between the encounter start and end', () => {
    const room = roomOf(
      loadUnderworldAutomaticBossCheckpoint(),
      createOccurrenceId('golden-f-preboss-shop:boss'),
    );
    expect(
      (room.roomActions?.timeline.entries ?? []).flatMap((entry) =>
        entry.kind === 'boundary' ? [entry.boundary.kind] : [],
      ),
    ).toEqual(['roomEntered', 'encounterStart', 'bossDefeated', 'encounterEnd', 'cleanup']);
    expect(banners(room, 'bossDefeated')[0]?.label).toBe('Boss defeated');
    expect(room.roomActions?.timeline.suppressedCheckpointKeys).toContain('bossDefeated:Encounter');
  });
});

describe('a room whose walk stops in it', () => {
  function galleryTimeline(id: string, occurrenceId: string) {
    const entry = galleryCases.find((candidate) => candidate.id === id);
    if (entry === undefined) throw new Error(`No gallery case ${id}`);
    return roomOf(buildGalleryProject(entry), createOccurrenceId(occurrenceId)).roomActions!
      .timeline;
  }
  const shape = (entries: readonly { readonly kind: string }[]) =>
    entries.flatMap((entry) =>
      entry.kind === 'boundary'
        ? [(entry as BoundaryEntry).boundary.kind]
        : entry.kind === 'action' || entry.kind === 'events'
          ? [entry.kind]
          : [],
    );

  it('ends at the blocking row, its later rows waiting without banners', () => {
    const timeline = galleryTimeline('progressive-stop-encounter-end', 'surface-o-devotion');
    expect(shape(timeline.entries)).toEqual([
      'roomEntered',
      'action',
      'encounterStart',
      'encounterEnd',
      'action',
    ]);
    expect(shape(timeline.notReached ?? [])).toEqual(['action']);
  });

  it('waits on its Overview when its Overview blocks', () => {
    const timeline = galleryTimeline('progressive-stop-at-entry', 'golden-f-b1-e1');
    expect(shape(timeline.entries)).toEqual(['roomEntered']);
    expect(timeline.waitsOn).toBe('the Overview');
    expect(shape(timeline.notReached ?? [])).toEqual(['action']);
  });

  it('ends before the doors open while a required pickup is not placed', () => {
    const timeline = galleryTimeline('required-unplaced', 'golden-f-b1-e1');
    expect(shape(timeline.entries)).toEqual(['roomEntered', 'encounterStart', 'encounterEnd']);
    expect(timeline.notReached).toEqual([]);
    expect(timeline.doorsWait).toBe(true);
    expect(timeline.waitsOn).toBeUndefined();
  });

  it('keeps the doors opening as its stop when a door offer blocks', () => {
    const timeline = galleryTimeline('progressive-stop-door-offer', 'golden-f-start');
    expect(shape(timeline.entries).at(-1)).toBe('cleanup');
    expect(timeline.notReached).toBeDefined();
    expect(timeline.doorsWait).toBeUndefined();
  });

  it('holds its doors when it stops at a row after the doors open', () => {
    const timeline = galleryTimeline('well-twist-unset', 'golden-f-preboss-shop:postboss');
    expect(shape(timeline.entries)).toContain('cleanup');
    expect(shape(timeline.entries).at(-1)).toBe('action');
    expect(timeline.doorsWait).toBe(true);
  });

  it('keeps its Encounter outcome with its controls when it stops there', () => {
    const room = roomOf(
      buildGalleryProject(galleryCases.find((entry) => entry.id === 'outcome-aetos-unavailable')!),
      createOccurrenceId('surface-p-1-1-p_combat03'),
    );
    const timeline = room.roomActions!.timeline;
    expect(shape(timeline.entries).at(-1)).toBe('encounterOutcome');
    const outcome = timeline.entries.at(-1);
    expect(
      outcome?.kind === 'boundary' && outcome.supplement?.kind === 'encounterOutcome'
        ? outcome.supplement.phase.aetos
        : undefined,
    ).toMatchObject({ selectedWave: 9, contextReached: true });
  });

  it('ends at the encounter end that owes an unplaced Shrine delivery', () => {
    const timeline = galleryTimeline('shrine-delivery-unplaced', 'surface-o-devotion');
    expect(shape(timeline.entries).at(-1)).toBe('encounterEnd');
    expect(shape(timeline.notReached ?? [])).toEqual(['action']);
  });

  it('keeps the doors opening as its stop when the door store is unavailable', () => {
    const timeline = galleryTimeline('chaos-time-piece', 'fixture-chaos-room');
    expect(shape(timeline.entries)).toEqual(['roomEntered', 'action', 'cleanup']);
    expect(timeline.notReached).toEqual([]);
  });

  it('shows every entry when it stops only in its exit work', () => {
    const timeline = galleryTimeline('side-visit-repeat', 'surface-n-combat05');
    expect(timeline.notReached).toBeUndefined();
    expect(shape(timeline.entries)).toContain('cleanup');
  });

  it('keeps a reached stop only when it shows the engine entry', () => {
    type Engine = Parameters<typeof splitAtRoomStop>[1][number];
    type Shown = Parameters<typeof splitAtRoomStop>[0][number];
    const engine = (kind: string, phaseKey?: string): Engine =>
      ({
        kind: 'boundary',
        boundary: { kind, key: phaseKey === undefined ? kind : `${kind}:${phaseKey}`, phaseKey },
        rank: 1,
        placement: 'before',
      }) as unknown as Engine;
    const shown = (entry: Engine): Shown => entry as unknown as Shown;
    const keys = (split: ReturnType<typeof splitAtRoomStop>) =>
      split?.reached.map((entry) => (entry.kind === 'boundary' ? entry.boundary.key : entry.kind));
    const stopAt = { kind: 'timeline', entryIndex: 1, at: 'entry' } as const;
    // A stop at an Encounter outcome keeps that outcome to repair its choices there.
    const fight = [
      engine('roomEntered'),
      engine('encounterOutcome', 'Encounter'),
      engine('encounterEnd', 'Encounter'),
      engine('cleanup'),
    ];
    expect(keys(splitAtRoomStop(fight.map(shown), fight, { roomStop: stopAt }))).toEqual([
      'roomEntered',
      'encounterOutcome:Encounter',
    ]);
    // A later entry shown in place of the stop entry is not reached.
    const start = [engine('roomEntered'), engine('encounterStart', 'Encounter'), engine('cleanup')];
    expect(
      keys(splitAtRoomStop([start[0]!, start[2]!].map(shown), start, { roomStop: stopAt })),
    ).toEqual(['roomEntered']);
  });

  it('leaves a Ship phase the walk has not reached waiting on the phase it stopped in', () => {
    const entry = galleryCases.find((candidate) => candidate.id === 'ship-phase-waiting')!;
    const workbench = roomOf(
      buildGalleryProject(entry),
      createOccurrenceId('surface-o-combat04'),
    ).workbench;
    if (workbench.kind !== 'ship') throw new Error('Not a Ship room');
    expect(workbench.phases.map((phase) => [phase.label, phase.waitsOn])).toEqual([
      ['Intro', undefined],
      ['Combat 1', 'Intro'],
    ]);
  });

  it('shows every phase of a room the walk passes', () => {
    const timeline = galleryTimeline('boon-offer-picked', 'golden-f-start');
    expect(timeline.notReached).toBeUndefined();
    expect(shape(timeline.entries)).toContain('cleanup');
  });
});
