import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';

import { decodeNemesisRandomEventOutcome } from '../../../src/authored-project/room-state/nemesis-outcome-codec';

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
  });
});
