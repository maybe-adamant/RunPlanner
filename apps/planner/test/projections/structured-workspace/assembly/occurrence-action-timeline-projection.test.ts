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
import { surfaceCheckpointArtifacts } from '@run-planner/test-fixtures/checkpoints/surface';
import { loadProjectDocument } from '@planner/persistence/projectDocumentLoader';
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
  WorkspaceNotReachedEntry,
  WorkspaceOccurrenceWorkbenchNode,
  WorkspaceRoomLifecycleTimelineEntry,
} from '@planner/projections/structured-workspace';
import { collectTestRequiredItems, withItemContent } from '@run-planner/test-fixtures/shared';
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

/** The markers where each encounter begins: its Encounter, or its Combat shown as one. */
function beginMarkers(room: ReturnType<typeof roomOf>) {
  return (room.roomActions?.timeline.entries ?? []).filter(
    (entry): entry is BoundaryEntry => entry.kind === 'boundary' && entry.beginsEncounter === true,
  );
}

function startIdentities(room: ReturnType<typeof roomOf>) {
  return beginMarkers(room).map((entry) => entry.supplement?.identityLabel);
}

describe('encounter banner supplements', () => {
  const shapeOf = (room: ReturnType<typeof roomOf>) =>
    (room.roomActions?.timeline.entries ?? []).flatMap((entry) =>
      entry.kind === 'boundary' ? [entry.boundary.kind] : [],
    );

  it('names the encounter where it begins and hosts the Anomaly capture point at its Combat', () => {
    const room = roomOf(
      loadUnderworldGAnomalyRosterCheckpoint(),
      createOccurrenceId('golden-g-b3-e2'),
    );
    const [begun] = banners(room, 'encounterBegun');
    const [combat] = banners(room, 'encounterStarted');
    expect(begun).toMatchObject({ label: 'Encounter started', beginsEncounter: true });
    expect(begun?.supplement).toMatchObject({
      identityLabel: 'Anomaly combat',
      choices: [],
      phase: { address: { phaseKey: 'Encounter' } },
    });
    expect(combat?.supplement).toMatchObject({ start: true, choices: ['anomalyCleared'] });
    expect(combat?.supplement?.identityLabel).toBeUndefined();
    expect(combat?.label).toBe('Combat started');
    // The end announces what spawns and hosts no choice.
    expect(banners(room, 'encounterEnd').every((entry) => entry.supplement === undefined)).toBe(
      true,
    );
    expect(shapeOf(room).slice(1, 4)).toEqual([
      'encounterBegun',
      'encounterStarted',
      'encounterEnd',
    ]);
  });

  it('keeps the Gorgon condition on the one marker naming its encounter', () => {
    const room = roomOf(
      loadUnderworldGorgonAthenaCheckpoint(),
      createOccurrenceId('golden-g-b1-e1'),
    );
    expect(banners(room, 'encounterBegun')).toEqual([]);
    const [outcome] = banners(room, 'encounterStarted');
    expect(outcome?.beginsEncounter).toBe(true);
    expect(outcome?.supplement).toMatchObject({
      choices: expect.arrayContaining(['gorgonCondition']),
      phase: { gorgonCondition: { selected: true, supported: true } },
    });
    expect(banners(room, 'encounterEnd').every((entry) => entry.supplement === undefined)).toBe(
      true,
    );
  });

  it('hosts no outcome choice where the fight has none', () => {
    const room = roomOf(loadUnderworldFigLeafCheckpoint(), createOccurrenceId('golden-f-start'));
    expect(banners(room, 'encounterStarted').map((entry) => entry.supplement?.choices)).toEqual([
      [],
    ]);
  });

  it('shows an ordinary fight as one Encounter marker hosting its identity and Fig Leaf', () => {
    const room = roomOf(createGoldenFGHIProject(), createOccurrenceId('golden-f-b10-e1'));
    expect(shapeOf(room)).toEqual([
      'roomEntered',
      'encounterStarted',
      'encounterEnd',
      'doorsOpened',
    ]);
    expect(banners(room, 'encounterStarted')[0]).toMatchObject({
      label: 'Encounter started',
      beginsEncounter: true,
      supplement: { identityLabel: 'Combat', start: true, choices: [] },
    });
    expect(room.roomActions?.timeline.boundaries.map((boundary) => boundary.kind)).not.toContain(
      'encounterBegun',
    );
  });

  it('hosts the Aetos wave and the Gorgon condition on the one marker naming their encounter', () => {
    const entry = galleryCases.find((candidate) => candidate.id === 'outcome-aetos-gorgon')!;
    const room = roomOf(buildGalleryProject(entry), createOccurrenceId('surface-p-1-1-p_combat03'));
    expect(banners(room, 'encounterBegun')).toEqual([]);
    const outcomes = banners(room, 'encounterStarted').filter(
      (banner) => (banner.supplement?.choices.length ?? 0) > 0,
    );
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]?.beginsEncounter).toBe(true);
    expect(outcomes[0]?.supplement).toMatchObject({
      choices: ['aetos', 'gorgonCondition'],
      phase: { address: { phaseKey: 'Combat' } },
    });
  });

  it('gives a Nemesis kill race its outcome at Combat beside its bet gold on the end', () => {
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
    const [start] = banners(room, 'encounterBegun');
    const [outcome] = banners(room, 'encounterStarted');
    expect(start?.supplement).toMatchObject({ identityLabel: 'Nemesis combat' });
    expect(outcome?.supplement).toMatchObject({
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
      entry.kind === 'boundary' && entry.supplement?.identityLabel !== undefined
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
    project = collectTestRequiredItems(project);
    const room = roomOf(project, occurrenceId);
    const order = (room.roomActions?.timeline.entries ?? []).flatMap((entry) =>
      entry.kind === 'boundary'
        ? [entry.boundary.kind]
        : entry.kind === 'action' && entry.supplement?.kind === 'nemesisInteraction'
          ? ['interaction']
          : [],
    );
    // No encounter runs for her: her talk row hosts her event, with no marker of its own.
    expect(order).not.toContain('encounterBegun');
    expect(order).not.toContain('encounterStarted');
    expect(order).toContain('interaction');
    expect(interactionRows(room)).toEqual([
      expect.objectContaining({
        actionKey: roomActionKey({ kind: 'interactEncounter', phaseKey: 'Encounter' }),
        supplement: {
          kind: 'nemesisInteraction',
          owner: createNemesisRandomEventAddress(phase),
          // The trade's result is observed on that row.
          events: expect.objectContaining({
            choices: ['nemesisEvent'],
            phase: expect.objectContaining({
              nemesisEvent: expect.objectContaining({
                value: expect.objectContaining({ kind: 'goldTrade' }),
              }),
            }),
          }),
        },
      }),
    ]);
    expect(banners(room, 'roomEntered')[0]?.supplement).toBeUndefined();
    expect(identityLabels(room)).toEqual([]);
  });

  it("keeps the Fields Passive event on its row, beside the cages' markers", () => {
    const { room } = projectedWhere(loadNemesisFieldsCheckpoint(), (candidate) =>
      candidate.encounterPhases.some(
        (phase) => phase.address.phaseKey === 'Passive' && phase.nemesisEvent !== undefined,
      ),
    );
    const [entered] = banners(room, 'roomEntered');
    expect(entered?.supplement?.identityLabel).toBeUndefined();
    expect(identityLabels(room).filter((label) => label.includes('Nemesis'))).toEqual([]);
    // Only the cages' encounters have markers, each tagged with its slot.
    expect(beginMarkers(room).map((entry) => [entry.label, entry.fieldsCage?.slot])).toEqual([
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

describe('encounter marker triggers', () => {
  it("hangs each Fields cage's marker on the Unlock row that starts it", () => {
    const { room } = projectedWhere(loadNemesisFieldsCheckpoint(), (candidate) =>
      candidate.encounterPhases.some(
        (phase) => phase.address.phaseKey === 'Passive' && phase.nemesisEvent !== undefined,
      ),
    );
    const entries = room.roomActions?.timeline.entries ?? [];
    const markers = beginMarkers(room);
    expect(markers).toHaveLength(3);
    for (const marker of markers) {
      if (marker.boundary.kind !== 'encounterStarted') throw new Error('a cage shows its Combat');
      const unlock = roomActionKey({
        kind: 'completeFieldsCage',
        phaseKey: marker.boundary.phaseKey,
      });
      expect(marker.triggerActionKey).toBe(unlock);
      expect(entries[entries.indexOf(marker) - 1]).toMatchObject({
        kind: 'action',
        actionKey: unlock,
      });
    }
    expect(
      banners(room, 'encounterEnd').filter((entry) => entry.triggerActionKey !== undefined),
    ).toEqual([]);
  });

  it('names no trigger for a fight that starts with its room', () => {
    const room = roomOf(createCompleteFGProject(), goldenGOccurrenceId(2, 1));
    const boundaries = (room.roomActions?.timeline.entries ?? []).filter(
      (entry): entry is BoundaryEntry => entry.kind === 'boundary',
    );
    expect(boundaries.some((entry) => entry.boundary.kind === 'encounterStarted')).toBe(true);
    expect(boundaries.filter((entry) => entry.triggerActionKey !== undefined)).toEqual([]);
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
      'Phase 1 · Ship combat',
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
    const address = createOccurrenceAddress(goldenFBiome, occurrenceId);
    const priced = goldLedgerForProjectEvaluationAssembly(catalog, assembly).roomAt(address);
    if (priced.availability !== 'available') throw new Error('The room is not priced');
    const gain = priced.room.gains.find((candidate) => candidate.kind === 'moneyPickup');
    if (gain?.roomAction === undefined) throw new Error('The money pickup names no row');
    const row = room.roomActions?.rows.find(
      (candidate) => candidate.key === gain.roomAction!.actionKey,
    );
    expect(row?.reference).toEqual(
      withItemContent(assembly.project, address, {
        kind: 'interactIncomingReward',
        producerPoint: 'roomRewardPickup',
        acquisitionRole: 'self',
      }),
    );
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
    ).toEqual(['roomEntered', 'encounterStarted', 'bossDefeated', 'encounterEnd', 'doorsOpened']);
    expect(banners(room, 'bossDefeated')[0]?.label).toBe('Boss defeated');
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
      'encounterBegun',
      'action',
      'encounterStarted',
      'encounterEnd',
      'action',
    ]);
    expect(shape(timeline.notReached ?? [])).toEqual(['action']);
  });

  it('waits on its Overview when its Overview blocks, its saved rows unshown', () => {
    const timeline = galleryTimeline('progressive-stop-at-entry', 'golden-f-b1-e1');
    expect(shape(timeline.entries)).toEqual(['roomEntered']);
    expect(timeline.waitsOn).toEqual({ kind: 'overview' });
    expect(timeline.notReached).toEqual([]);
  });

  it('shows its Timeline with the pickup live while its Overview waits only on that placement', () => {
    const room = roomOf(
      buildGalleryProject(galleryCases.find((entry) => entry.id === 'live-row-opening-unplaced')!),
      createOccurrenceId('golden-f-start'),
    );
    const actions = room.roomActions!;
    expect(actions.timeline.waitsOn).toBeUndefined();
    expect(shape(actions.timeline.entries)[0]).toBe('roomEntered');
    expect(actions.live?.items.some((item) => item.group === 'required')).toBe(true);
  });

  it('ends before the doors open while a required pickup is not placed', () => {
    const timeline = galleryTimeline('live-row-required', 'golden-f-b1-e1');
    expect(shape(timeline.entries)).toEqual(['roomEntered', 'encounterStarted', 'encounterEnd']);
    expect(timeline.notReached).toEqual([]);
    expect(timeline.doorsWait).toBe(true);
    expect(timeline.waitsOn).toBeUndefined();
  });

  it('keeps the doors opening as its stop when a door offer blocks', () => {
    const timeline = galleryTimeline('progressive-stop-door-offer', 'golden-f-start');
    expect(shape(timeline.entries).at(-1)).toBe('doorsOpened');
    expect(timeline.notReached).toBeDefined();
    expect(timeline.doorsWait).toBeUndefined();
  });

  it('holds its doors when it stops at a row after the doors open', () => {
    const timeline = galleryTimeline(
      'postboss-rack-result-unset',
      'golden-f-preboss-shop:postboss',
    );
    expect(shape(timeline.entries)).toContain('doorsOpened');
    expect(shape(timeline.entries).at(-1)).toBe('action');
    expect(timeline.doorsWait).toBe(true);
  });

  it('keeps its Combat with its outcome controls when it stops there', () => {
    const room = roomOf(
      buildGalleryProject(galleryCases.find((entry) => entry.id === 'outcome-aetos-unavailable')!),
      createOccurrenceId('surface-p-1-1-p_combat03'),
    );
    const timeline = room.roomActions!.timeline;
    expect(shape(timeline.entries).at(-1)).toBe('encounterStarted');
    const outcome = timeline.entries.at(-1);
    expect(
      outcome?.kind === 'boundary' && outcome.supplement !== undefined
        ? outcome.supplement.phase.aetos
        : undefined,
    ).toMatchObject({ selectedWave: 9, contextReached: true });
  });

  it('ends at the doors opening an unplaced Shrine delivery falls due at', () => {
    const timeline = galleryTimeline('shrine-delivery-unplaced', 'surface-o-devotion');
    // The walk passes the encounter end the delivery spawns at and every row after it.
    expect(shape(timeline.entries)).toEqual([
      'roomEntered',
      'encounterBegun',
      'action',
      'encounterStarted',
      'encounterEnd',
      'action',
    ]);
    expect(timeline.notReached).toEqual([]);
  });

  it('keeps the doors opening as its stop when the door store is unavailable', () => {
    const timeline = galleryTimeline('chaos-time-piece', 'fixture-chaos-room');
    expect(shape(timeline.entries)).toEqual(['roomEntered', 'action', 'doorsOpened']);
    expect(timeline.notReached).toEqual([]);
  });

  it('keeps the automatic effects of the encounter end it stops at, to choose their targets', () => {
    const effects = (
      entries: readonly (WorkspaceRoomLifecycleTimelineEntry | WorkspaceNotReachedEntry)[],
    ) =>
      entries.flatMap((entry) =>
        entry.kind === 'automaticEffect' ? [[entry.effect, entry.phaseKey]] : [],
      );
    const raw = surfaceCheckpointArtifacts['surface-p-steady-growth-shrine-frontier'].raw as {
      readonly route: Record<string, unknown>;
    };
    const growth = loadProjectDocument(
      JSON.stringify({
        ...raw,
        route: { ...raw.route, itineraryBiomeKeys: catalog.routes.byKey.Surface!.biomeKeys },
      }),
      catalog,
    ).project;
    const growthTimeline = roomOf(
      growth,
      createOccurrenceId('59213773-32f1-4ccc-87a4-4eaf95e43b54'),
    ).roomActions!.timeline;
    expect(shape(growthTimeline.entries).at(-1)).toBe('encounterEnd');
    expect(effects(growthTimeline.entries)).toEqual([['steadyGrowth', 'Combat']]);
    expect(effects(growthTimeline.notReached ?? [])).toEqual([]);

    const embryoCase = galleryCases.find((candidate) => candidate.id === 'transcendent-embryo')!;
    const embryoProject = buildGalleryProject(embryoCase);
    const embryoRoom = createOccurrenceId('surface-n-combat03');
    const [outcome] = roomOf(embryoProject, embryoRoom).roomActions!.transcendentEmbryo!;
    const embryoTimeline = roomOf(
      applyProjectCommand(embryoProject, catalog, {
        kind: 'ReplaceTranscendentEmbryoTransformation',
        outcome: outcome!.address,
        value: null,
      }),
      embryoRoom,
    ).roomActions!.timeline;
    expect(shape(embryoTimeline.entries).at(-1)).toBe('encounterEnd');
    expect(effects(embryoTimeline.entries)).toEqual([['transcendentEmbryo', 'Encounter']]);
    expect(effects(embryoTimeline.notReached ?? [])).toEqual([]);
  });

  it('shows every entry when it stops only in its exit work', () => {
    const timeline = galleryTimeline('side-visit-repeat', 'surface-n-combat05');
    expect(timeline.notReached).toBeUndefined();
    expect(shape(timeline.entries)).toContain('doorsOpened');
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
    const stopAt = (entryIndex: number) => ({ kind: 'timeline', entryIndex, at: 'entry' }) as const;
    // A stop at a Combat keeps that Combat to repair its outcome choices there.
    const fight = [
      engine('roomEntered'),
      engine('encounterStarted', 'Encounter'),
      engine('encounterEnd', 'Encounter'),
      engine('doorsOpened'),
    ];
    expect(
      keys(
        splitAtRoomStop(fight.map(shown), fight, {
          roomStop: stopAt(1),
        }),
      ),
    ).toEqual(['roomEntered', 'encounterStarted:Encounter']);
    // A later entry shown in place of the stop entry is not reached.
    const start = [
      engine('roomEntered'),
      engine('encounterBegun', 'Encounter'),
      engine('doorsOpened'),
    ];
    expect(
      keys(
        splitAtRoomStop([start[0]!, start[2]!].map(shown), start, {
          roomStop: stopAt(1),
        }),
      ),
    ).toEqual(['roomEntered']);
  });

  it('stops a Ship room at a wheel on the tab its wheels open on, before its combat', () => {
    const entry = galleryCases.find((candidate) => candidate.id === 'ship-phase-waiting')!;
    const workbench = roomOf(
      buildGalleryProject(entry),
      createOccurrenceId('surface-o-combat04'),
    ).workbench;
    if (workbench.kind !== 'ship') throw new Error('Not a Ship room');
    expect(workbench.phases.map((phase) => [phase.label, phase.waitsOn])).toEqual([
      ['Intro', undefined],
      ['Phase 1', { kind: 'phase', phaseLabel: 'Intro' }],
    ]);
    const intro = workbench.phases[0]!;
    expect(intro.wheel?.key).toBe('wheel1');
    expect(
      intro.timeline.flatMap((entry) => (entry.kind === 'boundary' ? [entry.boundary.kind] : [])),
    ).toContain('wheelsOpen');
    expect(workbench.phases[1]!.timeline).toEqual([]);
  });

  it('shows every phase of a room the walk passes', () => {
    const timeline = galleryTimeline('boon-offer-picked', 'golden-f-start');
    expect(timeline.notReached).toBeUndefined();
    expect(shape(timeline.entries)).toContain('doorsOpened');
  });
});
