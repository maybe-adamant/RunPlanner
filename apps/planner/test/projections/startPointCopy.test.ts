import { describe, expect, it } from 'vitest';

import {
  describeStartPointBlocked,
  startPointOptionHint,
} from '@planner/projections/startPointCopy';

describe('start point copy', () => {
  it('hints a picker option only when branches disagree', () => {
    expect(startPointOptionHint({ kind: 'routeStart' })).toBeUndefined();
    expect(startPointOptionHint({ kind: 'notReached' })).toBeUndefined();
    expect(startPointOptionHint({ kind: 'notOnItinerary' })).toBeUndefined();
    expect(
      startPointOptionHint({ kind: 'branchesDisagree', families: ['traits', 'maxStats'] }),
    ).toBe(
      'The planned outcomes before this point differ in boons and traits, max Health or Magick.',
    );
  });

  it('states every reason in the publish block', () => {
    expect(
      describeStartPointBlocked({ code: 'startPointIneligible', reason: { kind: 'notReached' } }),
    ).toBe('The start point can’t start this run. Plan the route up to this point first.');
  });
});
