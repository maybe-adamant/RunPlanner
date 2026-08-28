import { describe, expect, it } from 'vitest';
import {
  assemble,
  createGoldenFGHIProject,
  createOccurrenceId,
} from '@planner-test/support/structured-workspace/occurrence-assembly.test-support';

describe('structured workspace features assembly', () => {
  it('projects declared Stygian Well features for an F Postboss room', () => {
    const postbossId = createOccurrenceId('golden-f-preboss-shop:postboss');
    const room = assemble(createGoldenFGHIProject(), 'Underworld', 'F', postbossId).assembly.node
      .room;

    expect(room.workbench.features).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'stygianWell' })]),
    );
    expect(room.workbench.features.find((feature) => feature.kind === 'stygianWell')).toMatchObject(
      { present: true },
    );
  });
});
