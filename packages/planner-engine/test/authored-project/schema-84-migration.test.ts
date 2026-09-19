import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import { decodeProjectDocument } from '../../src/authored-project';
import { migrateProjectDocument } from '../../../../schema/migrate-project-84-to-85.js';
import underworldBaseline from '../../../../schema/fixtures/underworld-fghi-schema84.runplanner.json';
import surfaceBaseline from '../../../../schema/fixtures/surface-nopq-schema84.runplanner.json';

describe('schema 84 migration fixtures', () => {
  it.each([
    ['Underworld', underworldBaseline, ['F', 'G', 'H', 'I']],
    ['Surface', surfaceBaseline, ['N', 'O', 'P', 'Q']],
  ])(
    'decodes the migrated %s baseline through the strict production codec',
    (_route, baseline, itinerary) => {
      const migrated = migrateProjectDocument(baseline);
      const decoded = decodeProjectDocument(migrated, catalog);

      expect(decoded.schemaVersion).toBe(85);
      expect(decoded.route.itineraryBiomeKeys).toEqual(itinerary);
      expect(decoded.route.biomes).toHaveLength(baseline.route.biomes.length);
    },
  );
});
