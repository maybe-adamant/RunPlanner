import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createHubDecisionAddress,
  createHubVisitAddress,
  createLocalVisitOrderAddress,
  createOccurrenceAddress,
  semanticAddressKey,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  simulateProject,
  simulateProjectAssembly,
  type SemanticFinding,
} from '@run-planner/engine/simulation';
import { authorLegalTraitOffers, hubVisitActions } from '@run-planner/test-fixtures/shared';
import {
  loadSurfaceNProject,
  nBiome,
  nLocalOccurrenceId,
  nOccurrenceId,
  nVisitSlotKeys,
} from '@run-planner/test-fixtures/surface';

const hub = createHubDecisionAddress(nBiome, 'hub');
const [first, second, ...rest] = nVisitSlotKeys;
const sideRooms = createLocalVisitOrderAddress(nBiome, nOccurrenceId('combat05'), 'sideRooms');
const sideDoor1 = nLocalOccurrenceId('combat05', 'sideDoor1');
const sideDoor2 = nLocalOccurrenceId('combat05', 'sideDoor2');

function baseline(): ProjectDocument {
  return authorLegalTraitOffers(loadSurfaceNProject());
}

function withVisits(project: ProjectDocument, hubSlotKeys: readonly string[]): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceHubActionOrder',
    hub,
    actions: hubVisitActions(hubSlotKeys),
  });
}

function withSideVisits(
  project: ProjectDocument,
  occurrenceIds: readonly OccurrenceId[],
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceLocalVisitOrder',
    order: sideRooms,
    occurrenceIds,
  });
}

function nEvaluation(project: ProjectDocument) {
  const evaluation = simulateProject(catalog, project);
  const biome = evaluation.route.biomes.find((candidate) => candidate.biomeKey === 'N')!;
  return { evaluation, biome };
}

function repeats(findings: readonly SemanticFinding[]): readonly SemanticFinding[] {
  return findings.filter((finding) => finding.code === 'roomAlreadyVisited');
}

/** How many times the walk entered the occurrence. */
function entries(biome: ReturnType<typeof nEvaluation>['biome'], occurrenceId: OccurrenceId) {
  const key = semanticAddressKey(createOccurrenceAddress(nBiome, occurrenceId));
  if (!('history' in biome)) throw new Error('N has no assessed history');
  return biome.history.events.filter(
    (event) => event.kind === 'roomEntered' && semanticAddressKey(event.origin) === key,
  ).length;
}

describe('repeated N visits', () => {
  it('reports a repeated Hub visit at that later visit and stops the walk before it', () => {
    const { evaluation, biome } = nEvaluation(withVisits(baseline(), [second, second, ...rest]));

    expect(repeats(biome.findings)).toEqual([
      expect.objectContaining({
        origin: createHubVisitAddress(nBiome, 'hub', 2),
        evidence: {
          visitIndex: 2,
          firstVisitIndex: 1,
          hubSlotKey: second,
          occurrenceId: nOccurrenceId(second),
        },
      }),
    ]);
    expect(biome).toMatchObject({
      validity: 'invalid',
      coverage: { blockedAt: createHubVisitAddress(nBiome, 'hub', 2) },
    });
    expect(entries(biome, nOccurrenceId(second))).toBe(1);
    for (const later of rest) expect(entries(biome, nOccurrenceId(later))).toBe(0);
    expect(evaluation.route.summary.eligibleForExecutionPlan).toBe(false);
  });

  it('clears the Hub finding once the later visit enters an unvisited room', () => {
    const { biome } = nEvaluation(withVisits(baseline(), [second, first, ...rest]));
    expect(repeats(biome.findings)).toEqual([]);
  });

  it('reports a repeated side visit on its group order and enters the side room once', () => {
    const repeated = withSideVisits(baseline(), [sideDoor1, sideDoor1]);
    const { evaluation, biome } = nEvaluation(repeated);

    expect(repeats(biome.findings)).toEqual([
      expect.objectContaining({
        origin: sideRooms,
        evidence: { visitIndex: 2, firstVisitIndex: 1, occurrenceId: sideDoor1 },
      }),
    ]);
    expect(biome).toMatchObject({ validity: 'invalid', coverage: { blockedAt: sideRooms } });
    expect(entries(biome, sideDoor1)).toBe(1);
    expect(entries(biome, sideDoor2)).toBe(0);
    expect(entries(biome, nOccurrenceId(second))).toBe(0);
    expect(evaluation.route.summary.eligibleForExecutionPlan).toBe(false);

    expect(
      repeats(nEvaluation(withSideVisits(repeated, [sideDoor1, sideDoor2])).biome.findings),
    ).toEqual([]);
  });

  it('offers each visit only rooms not visited before it', () => {
    const candidates = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, baseline()),
    );
    const [leavesRepeat, entersEarlierRoom, sideLeavesRepeat, sideEntersEarlierRoom] =
      candidates.evaluate([
        { kind: 'hubActionOrder', hub, actions: hubVisitActions([second, second, ...rest]) },
        { kind: 'hubActionOrder', hub, actions: hubVisitActions([first, first, ...rest]) },
        { kind: 'sideRoomEntryOrder', group: sideRooms, occurrenceIds: [sideDoor1, sideDoor1] },
        { kind: 'sideRoomEntryOrder', group: sideRooms, occurrenceIds: [sideDoor2, sideDoor2] },
      ]);

    // Changing the first visit leaves the later repeat as that visit's finding.
    expect(leavesRepeat).toMatchObject({
      kind: 'hubActionOrder',
      result: {
        selectedPossible: true,
        findings: expect.arrayContaining([
          expect.objectContaining({
            code: 'roomAlreadyVisited',
            origin: createHubVisitAddress(nBiome, 'hub', 2),
          }),
        ]),
      },
    });
    expect(entersEarlierRoom).toMatchObject({
      kind: 'hubActionOrder',
      result: { selectedPossible: false, refusal: 'alreadyVisited' },
    });
    expect(sideLeavesRepeat).toMatchObject({
      kind: 'sideRoomEntryOrder',
      result: {
        selectedPossible: true,
        findings: [expect.objectContaining({ code: 'roomAlreadyVisited', origin: sideRooms })],
      },
    });
    expect(sideEntersEarlierRoom).toMatchObject({
      kind: 'sideRoomEntryOrder',
      result: { selectedPossible: false },
    });
  });
});
