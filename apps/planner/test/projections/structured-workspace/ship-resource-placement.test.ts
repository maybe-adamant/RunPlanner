import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createOccurrenceId,
  createRouteAddress,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';
import { loadSurfaceNOCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import {
  projectStructuredWorkspaceFixture,
  requireWorkspaceBiome,
} from '@planner-test/fixtures/structuredWorkspace';

const ship = createOccurrenceId('surface-o-combat04');
const laterShip = createOccurrenceId('surface-o-combat02');

function oRoom(
  projected: ReturnType<typeof projectStructuredWorkspaceFixture>,
  occurrenceId: string,
) {
  const node = requireWorkspaceBiome(projected.workspace, 'O').nodes.find(
    (candidate) =>
      candidate.kind === 'occurrenceWorkbench' && candidate.room.occurrenceId === occurrenceId,
  );
  if (node?.kind !== 'occurrenceWorkbench') throw new Error(`${occurrenceId} is not projected`);
  return node.room;
}

describe('a resource placed in a Ship room', () => {
  it('is named from other rooms by the Ship room’s Location', () => {
    const projected = projectStructuredWorkspaceFixture(
      applyProjectCommand(loadSurfaceNOCheckpoint(), catalog, {
        kind: 'ReplaceResourcePlacement',
        route: createRouteAddress('Surface'),
        family: 'Pickaxe',
        value: { biomeKey: 'O', occurrenceId: ship },
      }),
    );
    const shipRoom = oRoom(projected, ship);
    expect(shipRoom.workbench.kind).toBe('ship');
    expect(shipRoom.runDepth).toBeTypeOf('number');

    const placement = oRoom(projected, laterShip).resources?.find(
      (resource) => resource.family === 'Pickaxe',
    )?.currentPlacement;
    expect(placement?.runDepth).toBe(shipRoom.runDepth);
    expect(placement?.place.text).toBe(`Location ${shipRoom.runDepth}`);

    const indexed = projected.workspace.route.resources.find(
      (resource) => resource.placement?.occurrenceId === ship,
    )?.placement;
    expect(indexed?.place).toEqual(placement?.place);
  });
});
