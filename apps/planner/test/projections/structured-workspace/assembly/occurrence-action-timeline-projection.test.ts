import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createEncounterPhaseAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  roomActionKey,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { goldLedgerForProjectEvaluationAssembly } from '@run-planner/engine/simulation';
import {
  loadUnderworldFigLeafCheckpoint,
  loadUnderworldGAnomalyRosterCheckpoint,
  loadUnderworldGorgonAthenaCheckpoint,
  loadUnderworldWorldShopTravelDealCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/underworld';
import {
  createCompleteFGProject,
  createGoldenFGHIProject,
  goldenFBiome,
  goldenGBiome,
  goldenGOccurrenceId,
} from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNOPQProject } from '@run-planner/test-fixtures/surface';
import { describe, expect, it } from 'vitest';
import type { WorkspaceRoomLifecycleTimelineEntry } from '@planner/projections/structured-workspace';
import { projectStructuredWorkspaceFixture } from '@planner-test/fixtures/structuredWorkspace';

function projected(project: ProjectDocument, occurrenceId: OccurrenceId) {
  const result = projectStructuredWorkspaceFixture(project);
  const node = result.workspace.route.biomes
    .flatMap((biome) => biome.nodes)
    .find(
      (candidate) =>
        candidate.kind === 'occurrenceWorkbench' && candidate.room.occurrenceId === occurrenceId,
    );
  if (node?.kind !== 'occurrenceWorkbench') throw new Error(`${occurrenceId} is missing`);
  return { room: node.room, assembly: result.assembly };
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
  it('hosts the start events on the start banner and the Anomaly outcome on its end banner', () => {
    const room = roomOf(
      loadUnderworldGAnomalyRosterCheckpoint(),
      createOccurrenceId('golden-g-b3-e2'),
    );
    const [start] = banners(room, 'encounterStart');
    const [end] = banners(room, 'encounterEnd');
    expect(start?.supplement).toMatchObject({
      kind: 'encounterStart',
      identityLabel: 'Anomaly combat',
      phase: { address: { phaseKey: 'Encounter' } },
    });
    // No kill race: the end banner carries only the Anomaly's capture point.
    expect(end?.supplement).toEqual({ kind: 'encounterEnd', anomalyCleared: true });
  });

  it('keeps the Gorgon condition on the start banner, settled as the encounter starts', () => {
    const room = roomOf(
      loadUnderworldGorgonAthenaCheckpoint(),
      createOccurrenceId('golden-g-b1-e1'),
    );
    const [start] = banners(room, 'encounterStart');
    expect(start?.supplement?.kind === 'encounterStart' && start.supplement.phase).toMatchObject({
      gorgonCondition: { selected: true, supported: true },
    });
    expect(banners(room, 'encounterEnd').every((entry) => entry.supplement === undefined)).toBe(
      true,
    );
  });

  it('gives a Nemesis kill race its end banner beside its bet gold', () => {
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
    const [end] = banners(room, 'encounterEnd');
    expect(start?.supplement).toMatchObject({
      kind: 'encounterStart',
      identityLabel: 'Nemesis combat',
    });
    expect(start?.supplement).not.toHaveProperty('endControls');
    expect(end?.supplement).toMatchObject({
      kind: 'encounterEnd',
      phase: { address: { phaseKey: 'Encounter' }, nemesisBet: expect.any(Object) },
    });
    expect(end?.supplement).not.toHaveProperty('anomalyCleared');
    // An unauthored race is a win: the bet's gold stands for the phase.
    expect(room.roomActions?.phaseGold).toEqual([
      {
        phaseKey: 'Encounter',
        gold: expect.objectContaining({ label: expect.stringMatching(/^\+/) }),
      },
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
    ).toEqual(['Opening · Pre-combat', 'Follow-up · Combat']);
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
