import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { createProjectDocument } from '@run-planner/engine/authored-project';
import {
  createEditorNavigation,
  projectRouteNavigation,
} from '@planner/projections/editorNavigation';

describe('route navigation', () => {
  it('uses the full authored itinerary for current navigation and includes Dream Dive creation', () => {
    const project = createProjectDocument(catalog, {
      projectId: 'mixed-navigation',
      routeKey: 'Dream',
      itineraryBiomeKeys: ['Q', 'F', 'N', 'H'],
      configuredBiomeCount: 1,
    });
    expect(
      projectRouteNavigation(catalog, project.route).biomePanels.map((panel) => panel.biomeKey),
    ).toEqual(['Q', 'F', 'N', 'H']);
    expect(createEditorNavigation(catalog).routes.values).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          routeKey: 'Dream',
          label: 'Dream Dive',
          itinerarySelectionRequired: true,
          biomePanels: [],
        }),
      ]),
    );
  });
});
