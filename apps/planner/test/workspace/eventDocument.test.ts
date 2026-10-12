import { describe, expect, it } from 'vitest';

import { eventMetadataProblem } from '@planner/workspace/eventDocument';

const valid = {
  id: '2026-w42-staff',
  title: 'Week 42: Staff sprint',
  description: 'Clear the Surface.\nNo Arcana.',
  rules: 'Fear 8.',
  startsAt: '2026-10-12T00:00:00Z',
  endsAt: '2026-10-19T00:00:00.000Z',
};

describe('event metadata', () => {
  it('accepts what the host accepts', () => {
    expect(eventMetadataProblem(valid)).toBeNull();
    expect(eventMetadataProblem({ ...valid, rules: undefined } as never)).toBeNull();
    expect(eventMetadataProblem({ ...valid, endsAt: '2028-02-29T23:59:59Z' })).toBeNull();
    expect(eventMetadataProblem({ ...valid, description: 'x'.repeat(2000) })).toBeNull();
    expect(
      eventMetadataProblem({
        ...valid,
        startsAt: '2026-10-19T00:00:00Z',
        endsAt: '2026-10-19T00:00:00.5Z',
      }),
    ).toBeNull();
  });

  it('refuses what the host refuses', () => {
    for (const change of [
      { id: 'Week 42' },
      { id: '-w42' },
      { id: 'a'.repeat(65) },
      { title: ' ' },
      { title: 'Two\nlines' },
      { title: 'x'.repeat(81) },
      { title: 'Week‮42' },
      { title: 'Week​42' },
      { title: 'Tab\there' },
      { description: '' },
      { description: 'x'.repeat(2001) },
      { description: 'Line break' },
      { description: 'Bell\u0007' },
      { rules: '  ' },
      { rules: 'x'.repeat(2001) },
      { startsAt: '2026-02-30T00:00:00Z' },
      { startsAt: '1999-12-31T00:00:00Z' },
      { startsAt: '2026-10-12T24:00:00Z' },
      { startsAt: '2026-10-12' },
      { endsAt: '2026-10-12T00:00:00Z' },
      { endsAt: '2026-10-19T00:00:00+02:00' },
    ]) {
      expect(eventMetadataProblem({ ...valid, ...change }), JSON.stringify(change)).not.toBeNull();
    }
  });
});
