import { describe, expect, it } from 'vitest';

import {
  CATALOG_VERSION,
  OUTPUT_SCHEMA_VERSION,
  migrateProjectDocument,
} from '@planner/persistence/project-94-to-95.js';

describe('schema 94 to 95 Path screen migration', () => {
  it('bumps the version only, leaving every Path screen unresolved', () => {
    const source = {
      schemaVersion: 94,
      catalogVersion: CATALOG_VERSION,
      reward: { offer: { rewardType: 'TalentDrop' } },
    };
    expect(migrateProjectDocument(source)).toEqual({
      ...source,
      schemaVersion: OUTPUT_SCHEMA_VERSION,
    });
  });
});
