import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createHubRoomAddress,
  createHubRunStateCheckpointAddress,
  createRouteAddress,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  loadSurfaceNOPQProject,
  loadSurfaceNPartialHubProject,
  nBiome,
  nOccurrenceId,
} from '@run-planner/test-fixtures/surface';
import type { WorkspaceBiome } from '@planner/projections/structured-workspace';
import { stopNoticeLink } from '@planner/projections/walkStopCopy';
import {
  projectStructuredWorkspaceFixture,
  requireWorkspaceBiome,
} from '@planner-test/fixtures/structuredWorkspace';

function hubRail(biome: WorkspaceBiome) {
  const entry = biome.rail.find((candidate) => candidate.kind === 'hubGroup');
  if (entry?.kind !== 'hubGroup') throw new Error(`${biome.biomeKey} has no Hub rail entry`);
  return entry;
}

function endedAt(project: ProjectDocument, occurrenceId: string) {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplacePlanEnd',
    route: createRouteAddress('Surface'),
    planEnd: { biomeKey: 'N', occurrenceId: nOccurrenceId(occurrenceId) },
  });
}

describe('the Hub location', () => {
  it("numbers the Hub's rail entry by its first entry and links a Hub stop by that Location", () => {
    const { evaluation, workspace } = projectStructuredWorkspaceFixture(
      loadSurfaceNPartialHubProject(),
    );
    const n = evaluation.route.biomes.find((biome) => biome.biomeKey === 'N');
    if (n === undefined || !('rewards' in n)) throw new Error('N published no Run State');
    const owner = semanticAddressKey(
      createHubRunStateCheckpointAddress(createHubRoomAddress(nBiome, 'hub')),
    );
    const entered = n.rewards.runStateSnapshots.find(
      (snapshot) => semanticAddressKey(snapshot.owner) === owner,
    )?.counters.runDepthCache;
    expect(entered).toBe(3);

    const ephyra = requireWorkspaceBiome(workspace, 'N');
    expect(hubRail(ephyra).runDepth).toBe(entered);
    // The plan waits on the Hub's next visit: the stop is the Hub, at its Location.
    const place = workspace.walkStop?.place;
    expect(place).toEqual({ kind: 'hub', biomeKey: 'N', biomeLabel: 'Ephyra', depth: 3 });
    expect(stopNoticeLink({ kind: 'past', place: place! })).toBe('Location 3');
  });

  it('keeps the number while the plan ends inside the Hub and drops it when the plan ends before', () => {
    const insideHub = projectStructuredWorkspaceFixture(
      endedAt(loadSurfaceNOPQProject(), 'combat05'),
    ).workspace;
    expect(hubRail(requireWorkspaceBiome(insideHub, 'N')).runDepth).toBe(3);

    const beforeHub = projectStructuredWorkspaceFixture(
      endedAt(loadSurfaceNOPQProject(), 'prehub'),
    ).workspace;
    expect(hubRail(requireWorkspaceBiome(beforeHub, 'N'))).not.toHaveProperty('runDepth');
  });

  it('names a Hub the walk never entered as the Hub', () => {
    expect(
      stopNoticeLink({
        kind: 'past',
        place: { kind: 'hub', biomeKey: 'N', biomeLabel: 'Ephyra' },
      }),
    ).toBe('Hub');
  });
});
