import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const sourceRoot = join(dirname(fileURLToPath(import.meta.url)), '../../src/simulation');

/** Room Overview assessments: preparation, encounter selection, Shop inventory, Shrine and Well. */
const overviewModules = [
  'rewards/biome/lifecycle-transitions/room-prepared.ts',
  'rewards/biome/lifecycle-transitions/room-entered.ts',
  'rewards/biome/offer-lifecycle/shop-offer-point-materialized.ts',
  'rewards/shop/inventory.ts',
  'encounters/preparation.ts',
  'commerce/hermes-shrine.ts',
  'commerce/stygian-well.ts',
  'rewards/biome/offer-lifecycle/fields-optional-materialization.ts',
];

/**
 * The Fields optional-reward offer point is Overview, but its candidate probe
 * settles the later pickup at that reward's acquisition-point view.
 */
const candidateHorizonExemptions: Readonly<Record<string, RegExp>> = {
  'rewards/biome/offer-lifecycle/fields-optional-materialization.ts': /\bacquisitionPoints\b/,
};

const timelineViews =
  /\b(preOutgoing|outgoingGeneration|targetGenerations|postCommit|acquisitionPoints|encounterStarts)\b|\.exit\b/;

describe('room Overview reads only entry state', () => {
  it.each(overviewModules)('%s names no Timeline or exit view', (path) => {
    const violations = readFileSync(join(sourceRoot, path), 'utf8')
      .split('\n')
      .flatMap((line, index) =>
        timelineViews.test(line) && candidateHorizonExemptions[path]?.test(line) !== true
          ? [`${path}:${index + 1}`]
          : [],
      );
    expect(violations).toEqual([]);
  });

  it.each([
    'rewards/biome/lifecycle-transitions/room-entered.ts',
    'rewards/biome/offer-lifecycle/shop-offer-point-materialized.ts',
  ])('%s receives the Overview views', (path) => {
    expect(readFileSync(join(sourceRoot, path), 'utf8')).toMatch(
      /roomView\??: RoomOverviewHistoryViews/,
    );
  });
});
