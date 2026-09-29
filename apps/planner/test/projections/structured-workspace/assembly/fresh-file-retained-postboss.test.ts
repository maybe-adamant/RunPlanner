import { describe, expect, it } from 'vitest';
import {
  createFreshFileFProject,
  freshFileFPostbossId,
  withRetainedFreshFilePostboss,
} from '@run-planner/test-fixtures/fresh-file';
import {
  assemble,
  catalog,
  createGoldenFGHIProject,
  createOccurrenceId,
} from '@planner-test/support/structured-workspace/occurrence-assembly.test-support';

const keepsakeKey = catalog.keepsakes.values[0]!.key;
const postbossRoom = (project: Parameters<typeof assemble>[0]) =>
  assemble(project, 'FreshFile', 'F', freshFileFPostbossId).assembly.node.room;

describe('Fresh File retained Postboss state', () => {
  it('keeps a removal-only rack selection for a retained keepsake and none otherwise', () => {
    const retained = postbossRoom(
      withRetainedFreshFilePostboss(createFreshFileFProject(), { rackKeepsakeKey: keepsakeKey }),
    );
    expect(retained.keepsakeSelection).toMatchObject({
      selectedKeepsakeKey: keepsakeKey,
      unavailableReason: 'rackUnavailableOnRoute',
    });
    expect(retained.keepsakeSelection).not.toHaveProperty('equipResult');
    expect(postbossRoom(createFreshFileFProject()).keepsakeSelection).toBeUndefined();

    const mature = assemble(
      createGoldenFGHIProject(),
      'Underworld',
      'F',
      createOccurrenceId('golden-f-preboss-shop:postboss'),
    ).assembly.node.room;
    expect(mature.keepsakeSelection).toBeDefined();
    expect(mature.keepsakeSelection).not.toHaveProperty('unavailableReason');
  });

  it('keeps removal controls for a retained Well and an interacted Pool with its sale', () => {
    const room = postbossRoom(
      withRetainedFreshFilePostboss(createFreshFileFProject(), {
        well: true,
        poolSaleTraitKey: 'ApolloWeaponBoon',
      }),
    );
    const well = room.workbench.features.find((feature) => feature.kind === 'stygianWell');
    expect(well).toMatchObject({ presence: { kind: 'optionalPresent' } });
    expect(well).toHaveProperty('presenceInteractionKey');
    const pool = room.workbench.features.find((feature) => feature.kind === 'purgingPool');
    if (pool?.kind !== 'purgingPool') throw new Error('retained Pool is missing');
    expect(pool.interacted).toBe(true);
    expect(pool.interactionKey).toBeDefined();
    expect(pool.slots[0]).toMatchObject({ traitKey: 'ApolloWeaponBoon', sale: { sold: true } });

    const clean = postbossRoom(createFreshFileFProject()).workbench.features.map(
      (feature) => feature.kind,
    );
    expect(clean).not.toContain('stygianWell');
    expect(clean).not.toContain('purgingPool');
  });
});
