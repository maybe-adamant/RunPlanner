import { describe, expect, it } from 'vitest';

import type { FindingLocation } from '@planner/projections/evaluationProjection';
import { locationName, placeName, placeNameLabel } from '@planner/projections/placeName';

const biome = { biomeKey: 'F', biomeLabel: 'Erebus' } as const;
const room = { icon: 'combat', label: 'Combat 06' } as unknown as Extract<
  FindingLocation,
  { readonly kind: 'room' }
>['room'];

describe('place names', () => {
  it.each<[string, FindingLocation, { text: string; hint?: string }]>([
    [
      'a reached room by its Location',
      { kind: 'room', ...biome, depth: 6, room },
      { text: 'Location 6', hint: 'Combat 06' },
    ],
    ['a room past the stop by its name', { kind: 'room', ...biome, room }, { text: 'Combat 06' }],
    [
      'an entered Hub by its Location',
      { kind: 'hub', ...biome, depth: 9 },
      { text: 'Location 9', hint: 'Hub' },
    ],
    ['a Hub before its first entry', { kind: 'hub', ...biome }, { text: 'Hub' }],
    [
      'a reached rail stop by its Location',
      { kind: 'step', ...biome, depth: 3, label: 'Doors' },
      { text: 'Location 3', hint: 'Doors' },
    ],
    [
      'an unnumbered rail stop by its title',
      { kind: 'step', ...biome, label: 'Doors' },
      { text: 'Doors' },
    ],
    [
      'a biome whose start is unchosen by its biome',
      { kind: 'biome', ...biome },
      { text: 'Erebus' },
    ],
    ['the Loadout', { kind: 'loadout' }, { text: 'Loadout' }],
    ['a project-wide place as the Loadout', { kind: 'project' }, { text: 'Loadout' }],
    ['the Route panel', { kind: 'route' }, { text: 'Route' }],
  ])('names %s', (_, location, expected) => {
    expect(locationName(location)).toEqual(expected);
  });

  it('never prefixes the biome', () => {
    expect(placeNameLabel(locationName({ kind: 'room', ...biome, depth: 6, room }))).toBe(
      'Location 6 · Combat 06',
    );
    expect(placeNameLabel(placeName('Combat 06', undefined))).toBe('Combat 06');
  });
});
