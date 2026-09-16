import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';

import { decodeNemesisRandomEventOutcome } from '../../../src/authored-project/room-state/decoding/nemesis-outcome-codec';

describe('Nemesis outcome decoder', () => {
  it('preserves each closed response path', () => {
    expect(
      decodeNemesisRandomEventOutcome(
        { kind: 'goldTrade', response: 'accept' },
        catalog,
        '$.event',
      ),
    ).toEqual({
      kind: 'goldTrade',
      response: 'accept',
    });
    expect(() =>
      decodeNemesisRandomEventOutcome({ kind: 'goldTrade', response: 'later' }, catalog, '$.event'),
    ).toThrow('$.event.response: must be accept or decline');
    expect(
      decodeNemesisRandomEventOutcome(
        { kind: 'traitTrade', traitKey: null, response: 'decline' },
        catalog,
        '$.event',
      ),
    ).toEqual({ kind: 'traitTrade', traitKey: null, response: 'decline' });
  });
});
