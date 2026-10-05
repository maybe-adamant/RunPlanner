import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import { decodeProjectDocument, PROJECT_DOCUMENT_SCHEMA_VERSION } from '../../src/authored-project';
import { migrateProjectDocument as migrate84To85 } from '../../../../schema/migrate-project-84-to-85.js';
import { migrateProjectDocument as migrate85To86 } from '../../../../schema/migrate-project-85-to-86.js';
import { migrateProjectDocument as migrate86To87 } from '../../../../schema/migrate-project-86-to-87.js';
import { migrateProjectDocument as migrate87To88 } from '../../../../schema/migrate-project-87-to-88.js';
import { migrateProjectDocument as migrate88To89 } from '../../../../schema/migrate-project-88-to-89.js';
import { migrateProjectDocument as migrate89To90 } from '../../../../schema/migrate-project-89-to-90.js';
import { migrateProjectDocument as migrate90To91 } from '../../../../schema/migrate-project-90-to-91.js';
import { migrateProjectDocument as migrate91To92 } from '../../../../schema/migrate-project-91-to-92.js';
import baseline from '../../../../schema/fixtures/route-foundation.runplanner.json';

describe('schema 84 migration fixtures', () => {
  it.each([
    ['Underworld', ['F', 'G', 'H', 'I']],
    ['Surface', ['N', 'O', 'P', 'Q']],
  ] as const)(
    'decodes the migrated %s baseline through the strict production codec',
    (routeKey, itinerary) => {
      const source = {
        ...baseline,
        route: {
          ...baseline.route,
          routeKey,
          biomes: [{ ...baseline.route.biomes[0]!, biomeKey: itinerary[0] }],
        },
      };
      const migrated = migrate91To92(
        migrate90To91(
          migrate89To90(
            migrate88To89(migrate87To88(migrate86To87(migrate85To86(migrate84To85(source))))),
          ),
        ),
      );
      const decoded = decodeProjectDocument(migrated, catalog);

      expect(decoded.schemaVersion).toBe(PROJECT_DOCUMENT_SCHEMA_VERSION);
      expect(decoded.route.itineraryBiomeKeys).toEqual(itinerary);
      expect(decoded.route.biomes).toHaveLength(baseline.route.biomes.length);
    },
  );
});
