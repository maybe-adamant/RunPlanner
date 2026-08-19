import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceId,
  createProjectDocument,
} from '@run-planner/engine/authored-project';

const configuredBiomeCases = [
  ['Underworld', 1, 'F'],
  ['Underworld', 2, 'G'],
  ['Underworld', 3, 'H'],
  ['Underworld', 4, 'I'],
  ['Surface', 1, 'N'],
  ['Surface', 2, 'O'],
  ['Surface', 3, 'P'],
  ['Surface', 4, 'Q'],
] as const;

const startCases = [
  ['Underworld', 1, 'F', 'F_Opening01'],
  ['Underworld', 2, 'G', undefined],
  ['Underworld', 3, 'H', undefined],
  ['Underworld', 4, 'I', undefined],
  ['Surface', 1, 'N', undefined],
  ['Surface', 2, 'O', undefined],
  ['Surface', 3, 'P', undefined],
  ['Surface', 4, 'Q', undefined],
] as const;

function projectFor(routeKey: string, count: number) {
  return createProjectDocument(catalog, {
    projectId: `defaults-${routeKey}-${count}`,
    configuredBiomeCounts: { [routeKey]: count },
  });
}

function routeBiome(
  project: ReturnType<typeof createProjectDocument>,
  routeKey: string,
  biomeKey: string,
) {
  const biome = project.routes
    .find((route) => route.routeKey === routeKey)
    ?.biomes.find((candidate) => candidate.biomeKey === biomeKey);
  if (biome === undefined) throw new Error(`missing ${routeKey}/${biomeKey}`);
  return biome;
}

describe('project defaults', () => {
  it.each(configuredBiomeCases)(
    '%s prefix %i initializes %s as an incomplete authored biome',
    (routeKey, count, biomeKey) => {
      const plan = routeBiome(projectFor(routeKey, count), routeKey, biomeKey);
      expect(plan.topology).toBeNull();
    },
  );

  it.each(startCases)(
    '%s prefix %i creates the declaration-owned %s start occurrence',
    (routeKey, count, biomeKey, gameName) => {
      const biome = createBiomeAddress(routeKey, biomeKey);
      const occurrenceId = createOccurrenceId(`start-${biomeKey}`);
      const start = catalog.biomeLayouts.byKey[biomeKey]?.start;
      const expectedGameName =
        gameName ?? (start?.kind === 'fixedAuthored' ? start.roomGameName : undefined);
      const project = applyProjectCommand(projectFor(routeKey, count), catalog, {
        kind: 'CreateStart',
        biome,
        occurrenceId,
        ...(gameName === undefined ? {} : { gameName }),
      });
      expect(routeBiome(project, routeKey, biomeKey).topology?.occurrences).toContainEqual(
        expect.objectContaining({ occurrenceId, gameName: expectedGameName }),
      );
    },
  );
});
