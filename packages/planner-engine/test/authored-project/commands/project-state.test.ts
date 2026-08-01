import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeFieldAddress,
  createOccurrenceId,
  createRouteAddress,
  ProjectCommandContractError,
  ProjectDocumentContractError,
} from '@run-planner/engine/authored-project';

import { fBiome, fProject, iBiome, iProject } from '../support/configured-projects';

describe('authored-project project-state commands', () => {
  it('renames the project and preserves identity for an unchanged name', () => {
    const original = fProject();
    const renamed = applyProjectCommand(original, catalog, {
      kind: 'RenameProject',
      name: 'Renamed Project',
    });

    expect(renamed).not.toBe(original);
    expect(renamed.name).toBe('Renamed Project');
    expect(
      applyProjectCommand(renamed, catalog, {
        kind: 'RenameProject',
        name: 'Renamed Project',
      }),
    ).toBe(renamed);
  });

  it('grows and shrinks a route prefix while preserving retained authored biomes', () => {
    const underworld = createRouteAddress('Underworld');
    const authored = applyProjectCommand(fProject(), catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: createOccurrenceId('retained-f-start'),
      gameName: 'F_Opening01',
    });
    const retainedF = authored.routes[0]?.biomes[0];

    const grown = applyProjectCommand(authored, catalog, {
      kind: 'ConfigureRoutePrefix',
      route: underworld,
      configuredBiomeCount: 4,
    });

    expect(grown.routes[0]?.biomes.map((biome) => biome.biomeKey)).toEqual(['F', 'G', 'H', 'I']);
    expect(grown.routes[0]?.biomes[0]).toEqual(retainedF);
    expect(grown.routes[0]?.biomes.slice(1)).toEqual([
      { biomeKey: 'G', state: {}, topology: null },
      { biomeKey: 'H', state: {}, topology: null },
      { biomeKey: 'I', state: { maxNonGoalRewards: null }, topology: null },
    ]);
    expect(
      applyProjectCommand(grown, catalog, {
        kind: 'ConfigureRoutePrefix',
        route: underworld,
        configuredBiomeCount: 4,
      }),
    ).toBe(grown);

    const shrunk = applyProjectCommand(grown, catalog, {
      kind: 'ConfigureRoutePrefix',
      route: underworld,
      configuredBiomeCount: 2,
    });
    expect(shrunk.routes[0]?.biomes.map((biome) => biome.biomeKey)).toEqual(['F', 'G']);
    expect(shrunk.routes[0]?.biomes[0]).toEqual(retainedF);
  });

  it.each([
    [-1, 'configuredBiomeCount must be a non-negative integer'],
    [1.5, 'configuredBiomeCount must be a non-negative integer'],
    [5, 'configuredBiomeCount exceeds the 4-biome route'],
  ])('rejects invalid route-prefix count %s', (configuredBiomeCount, detail) => {
    expect(() =>
      applyProjectCommand(fProject(), catalog, {
        kind: 'ConfigureRoutePrefix',
        route: createRouteAddress('Underworld'),
        configuredBiomeCount,
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ConfigureRoutePrefix',
        addressKey: '["route","Underworld"]',
        detail,
      }),
    );
  });

  it('replaces and validates a declaration-owned biome field', () => {
    const field = createBiomeFieldAddress(iBiome, 'maxNonGoalRewards');
    const original = iProject();
    const replaced = applyProjectCommand(original, catalog, {
      kind: 'ReplaceBiomeField',
      field,
      value: 5,
    });

    expect(replaced.routes[0]?.biomes[3]?.state).toEqual({ maxNonGoalRewards: 5 });
    expect(
      applyProjectCommand(replaced, catalog, {
        kind: 'ReplaceBiomeField',
        field,
        value: 5,
      }),
    ).toEqual(replaced);

    expect(() =>
      applyProjectCommand(replaced, catalog, {
        kind: 'ReplaceBiomeField',
        field,
        value: 7,
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ReplaceBiomeField',
        addressKey: '["biomeField","Underworld","I","maxNonGoalRewards"]',
        detail: 'ReplaceBiomeField.value: must be between 3 and 6',
      }),
    );
  });

  it('wraps a project-document field failure at the public command boundary', () => {
    const command = {
      kind: 'ReplaceBiomeField' as const,
      field: createBiomeFieldAddress(fBiome, 'unknownField'),
      value: false,
    };

    try {
      applyProjectCommand(fProject(), catalog, command);
    } catch (error) {
      expect(error).toBeInstanceOf(ProjectCommandContractError);
      if (!(error instanceof ProjectCommandContractError)) {
        throw new Error('expected a ProjectCommandContractError', { cause: error });
      }
      expect(error).toMatchObject({
        commandKind: 'ReplaceBiomeField',
        addressKey: '["biomeField","Underworld","F","unknownField"]',
        detail: 'ReplaceBiomeField.value: unknown biome field unknownField',
      });
      expect(error.cause).toBeInstanceOf(ProjectDocumentContractError);
      expect(error.cause).toMatchObject({
        path: 'ReplaceBiomeField.value',
        detail: 'unknown biome field unknownField',
      });
      return;
    }
    throw new Error('expected the invalid biome field command to fail');
  });
});
