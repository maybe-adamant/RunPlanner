import { readdirSync, readFileSync } from 'node:fs';
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

/**
 * Declared exception: the Postboss Purging Pool inventory is Overview content
 * pinned at fountain use. The Pool unlocks only when the fountain is used, and
 * nothing between that use and opening the Pool can remove a listed boon or
 * change its rarity, so native opens the inventory assessed there.
 */
const fountainPinnedOverview = {
  assessment: 'commerce/purging-pool.ts',
  contact: 'rewards/biome/lifecycle-transitions/fountain-used.ts',
} as const;

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

  it('pins the Purging Pool inventory at fountain use as its one declared exception', () => {
    expect(overviewModules).not.toContain(fountainPinnedOverview.assessment);
    const callers = readdirSync(sourceRoot, { recursive: true, encoding: 'utf8' }).filter(
      (path) =>
        path.endsWith('.ts') &&
        path !== fountainPinnedOverview.assessment &&
        /\bassessPurgingPool\(/.test(readFileSync(join(sourceRoot, path), 'utf8')),
    );
    expect(callers).toEqual([fountainPinnedOverview.contact]);
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
