import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomFeatureAddress,
  type OccurrenceAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { assembleExecutionProduct, compileExecutionPlan } from '@run-planner/engine/execution-plan';
import {
  createPreparedProjectCandidateSession,
  roomLayoutAuthoringForProjectEvaluationAssembly,
  roomObjectAnchorSlotsForProjectEvaluationAssembly,
  simulateProjectAssembly,
  type RoomLayoutSettlement,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenHBiome,
} from '@run-planner/test-fixtures/underworld';
import { roomObjectAnchorFindings } from '../../../src/simulation/room-layout/settlement';
import type { CanonicalAuthoredRoom } from '../../../src/simulation/materialization';

const settledLayouts = (project: ProjectDocument) =>
  simulateProjectAssembly(catalog, project).evaluation.route.biomes.flatMap((biome) =>
    'rewards' in biome ? biome.rewards.roomLayouts : [],
  );

function occurrenceOf(project: ProjectDocument, address: OccurrenceAddress) {
  const occurrence = project.route.biomes
    .find((biome) => biome.biomeKey === address.biomeKey)
    ?.topology?.occurrences.find((entry) => entry.occurrenceId === address.occurrenceId);
  if (occurrence === undefined) throw new Error(`missing ${address.occurrenceId}`);
  return occurrence;
}

/** A reached, unrolled room whose entry the previous door decides while it has another start. */
function decidedRoom(project: ProjectDocument): RoomLayoutSettlement {
  const settlement = settledLayouts(project).find(
    (candidate) =>
      candidate.arrival === 'door' &&
      candidate.flip.kind !== 'roll' &&
      (candidate.entry.kind === 'derived' || candidate.entry.kind === 'fixed') &&
      (catalog.rooms.byKey[occurrenceOf(project, candidate.owner).gameName]?.mapPoints?.heroStarts
        .length ?? 0) > 1,
  );
  if (settlement === undefined) throw new Error('no reached room with a decided entry');
  return settlement;
}

describe('room layout settlement', () => {
  it('settles every entered room once, the first at run start', () => {
    const layouts = settledLayouts(createGoldenFGHIProject());
    expect(layouts[0]).toMatchObject({
      arrival: 'runStart',
      flip: { kind: 'fixed', value: false },
    });
    expect(layouts.slice(1).every((layout) => layout.arrival === 'door')).toBe(true);
    expect(new Set(layouts.map((layout) => JSON.stringify(layout.owner))).size).toBe(
      layouts.length,
    );
  });

  it('keeps an entry the previous door rules out and reports it at the room', () => {
    const project = createGoldenFGHIProject();
    const settlement = decidedRoom(project);
    const room = catalog.rooms.byKey[occurrenceOf(project, settlement.owner).gameName]!;
    const settled =
      settlement.entry.kind === 'choice' || settlement.entry.kind === 'unknown'
        ? undefined
        : settlement.entry.point.startPointId;
    const other = room.mapPoints!.heroStarts.find((start) => start.id !== settled)!.id;
    const edited = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRoomLayout',
      occurrence: settlement.owner,
      layout: { entryStartPointId: other },
    });
    expect(occurrenceOf(edited, settlement.owner).layout).toEqual({ entryStartPointId: other });
    const assembly = simulateProjectAssembly(catalog, edited);
    expect(assembly.evaluation.findings).toContainEqual(
      expect.objectContaining({
        code: 'roomLayoutEntryUnavailable',
        origin: createRoomFeatureAddress(settlement.owner, { kind: 'roomLayoutEntry' }),
        evidence: expect.objectContaining({ entryStartPointId: other }),
      }),
    );
    const candidate = createPreparedProjectCandidateSession(catalog, assembly).evaluate({
      kind: 'roomLayoutEntry',
      occurrence: settlement.owner,
      entryStartPointId: other,
    });
    expect(candidate).toMatchObject({
      kind: 'roomLayoutEntry',
      result: { assignable: true, selectedPossible: false, eligibleStartPointIds: [settled] },
    });
  });

  it('flags a flip authored where the game does not roll it', () => {
    const project = createGoldenFGHIProject();
    const settlement = settledLayouts(project).find((candidate) => candidate.flip.kind !== 'roll')!;
    const edited = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRoomLayout',
      occurrence: settlement.owner,
      layout: { flipped: !settlement.flip.value },
    });
    expect(simulateProjectAssembly(catalog, edited).evaluation.findings).toContainEqual(
      expect.objectContaining({
        code: 'roomLayoutFlipUnavailable',
        origin: createRoomFeatureAddress(settlement.owner, { kind: 'roomLayoutFlip' }),
      }),
    );
  });

  it('offers each eligible entry with the flip it needs and both rolled flips', () => {
    const project = createGoldenFGHIProject();
    const assembly = simulateProjectAssembly(catalog, project);
    const rolled = settledLayouts(project).find(
      (candidate) =>
        candidate.flip.kind === 'roll' &&
        candidate.entry.kind === 'choice' &&
        candidate.entry.eligible.some((option) => option.flipped !== undefined),
    );
    if (rolled === undefined) throw new Error('no reached rolled room with a flip-bound entry');
    const authoring = roomLayoutAuthoringForProjectEvaluationAssembly(assembly, rolled.owner)!;
    expect(authoring.flips.map((flip) => flip.flipped)).toEqual([false, true]);
    for (const { option, command } of authoring.entries) {
      expect(command.layout.entryStartPointId).toBe(option.startPointId);
      if (option.flipped !== undefined) expect(command.layout.flipped).toBe(option.flipped);
      // No offered command reaches a combination the derivation rules out.
      const applied = applyProjectCommand(project, catalog, command);
      expect(
        simulateProjectAssembly(catalog, applied).evaluation.findings.filter((finding) =>
          finding.code.startsWith('roomLayout'),
        ),
      ).toEqual([]);
    }
  });

  it('publishes each determined flip and entry on the wire', () => {
    const project = createGoldenFGHIProject();
    const assembly = simulateProjectAssembly(catalog, project);
    const plan = compileExecutionPlan({
      product: assembleExecutionProduct({ assembly, catalog }),
    });
    for (const layout of settledLayouts(project)) {
      const occurrence = plan.occurrences.find((entry) => entry.id === layout.owner.occurrenceId)!;
      const entry =
        layout.entry.kind === 'unknown' || layout.entry.kind === 'choice'
          ? layout.entry.kind === 'choice'
            ? layout.entry.point
            : undefined
          : layout.entry.point;
      expect(occurrence.overview.layout?.flipped).toBe(layout.flip.value);
      expect(occurrence.overview.layout?.entry).toEqual(entry);
    }
  });
});

describe('room object anchors', () => {
  const postboss = createOccurrenceAddress(
    goldenFBiome,
    createOccurrenceId('golden-f-preboss-shop:postboss'),
  );

  it('keeps the Well pin for the Well and reports any other object on it', () => {
    const project = createGoldenFGHIProject();
    const pin = catalog.rooms.byKey.F_PostBoss01!.mapPoints!.wellAnchorId!;
    const free = catalog.rooms.byKey.F_PostBoss01!.mapPoints!.challengeSwitchAnchors.find(
      (anchor) => anchor.id !== pin,
    )!.id;
    expect(occurrenceOf(project, postboss).purgingPool).toBeDefined();
    const onPin = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRoomObjectAnchor',
      occurrence: postboss,
      object: 'purgingPool',
      anchorId: pin,
    });
    expect(simulateProjectAssembly(catalog, onPin).evaluation.findings).toContainEqual(
      expect.objectContaining({
        code: 'roomObjectAnchorUnavailable',
        origin: createRoomFeatureAddress(postboss, { kind: 'objectAnchor', object: 'purgingPool' }),
        evidence: expect.objectContaining({ reason: 'wellPin' }),
      }),
    );
    const placed = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRoomObjectAnchor',
      occurrence: postboss,
      object: 'purgingPool',
      anchorId: free,
    });
    const assembly = simulateProjectAssembly(catalog, placed);
    expect(
      assembly.evaluation.findings.filter((finding) => finding.code.startsWith('roomObject')),
    ).toEqual([]);
    const slots = roomObjectAnchorSlotsForProjectEvaluationAssembly(catalog, assembly, postboss)!;
    expect(slots.anchors).toEqual(
      [
        {
          anchorId: pin,
          pinned: true,
          ...(occurrenceOf(placed, postboss).stygianWell === undefined
            ? {}
            : { occupant: 'stygianWell' }),
        },
        { anchorId: free, pinned: false, occupant: 'purgingPool' },
      ].sort((left, right) => left.anchorId - right.anchorId),
    );
    const pool = slots.objects.find((object) => object.kind === 'purgingPool')!;
    expect(pool.anchorId).toBe(free);
    expect(pool.anchorChoices?.map((choice) => choice.anchorId)).toEqual([null, free]);
    const plan = compileExecutionPlan({
      product: assembleExecutionProduct({ assembly, catalog }),
    });
    expect(
      plan.occurrences.find((entry) => entry.id === postboss.occurrenceId)?.overview.purgingPool
        ?.anchorId,
    ).toBe(free);
  });

  it('reports two objects on one anchor', () => {
    const origin = createOccurrenceAddress(goldenHBiome, createOccurrenceId('room'));
    const findings = roomObjectAnchorFindings(catalog, {
      origin,
      gameName: 'G_Combat02',
      purgingPool: { traitKeyBySlot: { left: null, middle: null, right: null }, anchorId: 7 },
      hermesShrine: {
        offerBySlot: { first: null, secondLeft: null, secondRight: null },
        anchorId: 7,
      },
    } as unknown as CanonicalAuthoredRoom);
    expect(findings.map((finding) => [finding.code, finding.evidence])).toEqual([
      ['roomObjectAnchorDuplicate', { anchorId: 7, occupants: ['hermesShrine'] }],
      ['roomObjectAnchorDuplicate', { anchorId: 7, occupants: ['purgingPool'] }],
    ]);
  });
});
