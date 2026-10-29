import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import { createProjectDocument } from '@run-planner/engine/authored-project';
import {
  projectDreamItineraryDraft,
  projectDreamItineraryReplacementLosses,
  replaceDreamItineraryDraftBiome,
} from '@planner/projections/dreamItinerary';

describe('Dream Dive creation projection', () => {
  it('orders available biomes in normal biome order at each stage', () => {
    const available = (draft: readonly string[]) =>
      projectDreamItineraryDraft(catalog, draft, draft.length).picker.sections[0]!.items.map(
        (item) => item.value,
      );
    expect(available([])).toEqual(['G', 'H', 'I', 'O', 'P', 'Q']);
    expect(available(['G'])).toEqual(['F', 'I', 'N', 'O', 'P', 'Q']);
    expect(available(['Q'])).toEqual(['F', 'G', 'H', 'I', 'N', 'O', 'P']);
  });
  it('keeps unavailable biomes in a separate final disclosure', () => {
    const { picker } = projectDreamItineraryDraft(catalog, ['G'], 1);
    expect(picker.sections.map((section) => section.kind)).toEqual(['category', 'unavailable']);
    expect(picker.sections[0]!.items.every((item) => !item.disabled)).toBe(true);
    expect(picker.sections[1]).toMatchObject({ collapsible: true, label: 'Unavailable' });
    expect(picker.sections[1]!.items.map((item) => item.value)).toEqual(['G', 'H']);
  });
  it('projects the engine choice domain and retains only a compatible revised suffix', () => {
    const initial = projectDreamItineraryDraft(catalog, [], 0);
    expect(initial.badges).toHaveLength(4);
    expect(initial.picker.sections[0]?.items.map((item) => item.value)).not.toContain('F');

    const original = ['Q', 'F', 'N', 'H'];
    expect(replaceDreamItineraryDraftBiome(catalog, original, 0, 'G')).toEqual([
      'G',
      'F',
      'N',
      'H',
    ]);
    expect(replaceDreamItineraryDraftBiome(catalog, original, 0, 'F')).toEqual(['F']);
  });
});

describe('Dream itinerary replacement projection', () => {
  const route = createProjectDocument(catalog, {
    projectId: 'dream-repick',
    routeKey: 'Dream',
    itineraryBiomeKeys: ['Q', 'F', 'N', 'H'],
    configuredBiomeCount: 3,
  }).route;

  it('labels the biomes the engine would clear, and none for an unchanged itinerary', () => {
    expect(projectDreamItineraryReplacementLosses(catalog, route, ['Q', 'F', 'N', 'H'])).toEqual(
      [],
    );
    expect(projectDreamItineraryReplacementLosses(catalog, route, ['Q', 'F', 'O', 'H'])).toEqual([
      'Ephyra',
    ]);
    expect(projectDreamItineraryReplacementLosses(catalog, route, ['G', 'F', 'N', 'H'])).toEqual([
      'Summit',
      'Erebus',
      'Ephyra',
    ]);
  });
});
