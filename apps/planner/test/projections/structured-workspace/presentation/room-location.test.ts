import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
} from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';
import { roomPlace } from '@planner/projections/structured-workspace/presentation/room-location';

const room = (biomeKey: string) =>
  createOccurrenceAddress(
    createBiomeAddress('Underworld', biomeKey),
    createOccurrenceId('absent-room'),
  );

describe('room place', () => {
  it('names a room the plan does not hold by its biome’s name', () => {
    expect(roomPlace(catalog, room('F'), () => undefined)).toEqual({
      place: { text: catalog.biomes.byKey.F!.label },
    });
    expect(roomPlace(catalog, room('F'), undefined).place.text).toBe(catalog.biomes.byKey.F!.label);
  });

  it('names a room of an undeclared biome by the biome’s key', () => {
    expect(roomPlace(catalog, room('Nowhere'), () => undefined).place).toEqual({
      text: 'Nowhere',
    });
  });

  it('names a reached room by its Location, its own name on hover', () => {
    const place = roomPlace(catalog, room('F'), () => ({ gameName: 'F_Opening01', runDepth: 1 }));
    expect(place.runDepth).toBe(1);
    expect(place.place.text).toBe('Location 1');
    expect(place.place.hint).toBeTruthy();
  });
});
