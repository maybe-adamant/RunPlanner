import { describe, expect, it } from 'vitest';

import { chooseRoomFit } from '../src/room-search';

const fit = (choice: string, accepted: boolean, fingerprint: string) => ({
  choice,
  accepted,
  fingerprint,
});

describe('choosing among the fits of a room search', () => {
  it('authors the first accepted fit and names the first of each other accepted exit state', () => {
    expect(
      chooseRoomFit([
        fit('a', false, 'x'),
        fit('b', true, 'y'),
        fit('c', true, 'y'),
        fit('d', true, 'z'),
        fit('e', true, 'z'),
      ]),
    ).toEqual({ chosen: fit('b', true, 'y'), equivalents: [fit('d', true, 'z')] });
  });

  it('falls back to the first fit, beside the other fits, when the save accepts none', () => {
    expect(chooseRoomFit([fit('a', false, 'x'), fit('b', false, 'y')])).toEqual({
      chosen: fit('a', false, 'x'),
      equivalents: [fit('b', false, 'y')],
    });
  });

  it('has nothing to author without a fit', () => {
    expect(chooseRoomFit([])).toBeUndefined();
  });
});
