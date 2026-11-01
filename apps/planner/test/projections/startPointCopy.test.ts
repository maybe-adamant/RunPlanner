import { describe, expect, it } from 'vitest';

import { startPointOptionHint } from '@planner/projections/startPointCopy';

describe('start point copy', () => {
  it('hints a picker option only when branches disagree', () => {
    expect(startPointOptionHint({ kind: 'routeStart' })).toBeUndefined();
    expect(startPointOptionHint({ kind: 'notReached' })).toBeUndefined();
    expect(startPointOptionHint({ kind: 'notOnItinerary' })).toBeUndefined();
    expect(
      startPointOptionHint({ kind: 'branchesDisagree', families: ['traits', 'maxStats'] }),
    ).toBeDefined();
  });
});
