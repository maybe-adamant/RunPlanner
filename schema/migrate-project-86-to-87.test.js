import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { migrateProjectDocument } from './migrate-project-86-to-87.js';

const document = () => ({
  schemaVersion: 86,
  catalogVersion: '0.55.0-anvil-of-fates',
  route: {
    biomes: [
      {
        topology: {
          occurrences: [
            {
              occurrenceId: 'retained',
              unrelatedNumber: 7,
              encounters: {
                customizationByPhase: {
                  dormant: {
                    generatedComposition: {
                      kind: 'generated',
                      waves: [{ waveIndex: 1, typeKeys: ['Guard'], weights: { Guard: 2 } }],
                    },
                  },
                  ordinary: { other: { kind: 'single', choiceKey: 'keep' } },
                },
              },
            },
          ],
        },
      },
    ],
  },
});

describe('schema 86 to 87 migration', () => {
  it('removes only generated weights across retained owners', () => {
    const source = document();
    const migrated = migrateProjectDocument(source);
    const occurrence = migrated.route.biomes[0].topology.occurrences[0];
    assert.equal(migrated.schemaVersion, 87);
    assert.equal(source.schemaVersion, 86);
    assert.equal(occurrence.unrelatedNumber, 7);
    assert.deepEqual(occurrence.encounters.customizationByPhase.ordinary, {
      other: { kind: 'single', choiceKey: 'keep' },
    });
    assert.deepEqual(
      occurrence.encounters.customizationByPhase.dormant.generatedComposition.waves[0],
      { waveIndex: 1, typeKeys: ['Guard'] },
    );
    assert.deepEqual(
      source.route.biomes[0].topology.occurrences[0].encounters.customizationByPhase.dormant
        .generatedComposition.waves[0].weights,
      { Guard: 2 },
    );
  });
});
