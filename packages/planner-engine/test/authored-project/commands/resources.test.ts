import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceAddress,
} from '@run-planner/engine/authored-project';
import { loadUnderworldFGProject } from '@run-planner/test-fixtures/underworld';

describe('route-owned selected resource placement command', () => {
  it('replaces one family atomically and removes only a structurally deleted exact target', () => {
    const start = loadUnderworldFGProject();
    const route = start.route!;
    const f = route.biomes.find((candidate) => candidate.biomeKey === 'F')!;
    const occurrence = f.topology!.occurrences[0]!;
    const target = { biomeKey: 'F', occurrenceId: occurrence.occurrenceId };
    const selected = applyProjectCommand(start, catalog, {
      kind: 'ReplaceResourcePlacement',
      route: { kind: 'route', routeKey: 'Underworld' },
      family: 'Pickaxe',
      value: target,
    });
    expect(selected.route!.resourcePlacements.Pickaxe).toEqual(target);

    const cleared = applyProjectCommand(selected, catalog, {
      kind: 'ClearTopology',
      biome: createBiomeAddress('Underworld', 'F'),
    });
    expect(cleared.route!.resourcePlacements.Pickaxe).toBeNull();
  });

  it('retains an address when the room declaration is replaced', () => {
    const start = loadUnderworldFGProject();
    const occurrence = start.route!.biomes[0]!.topology!.occurrences.find(
      (candidate) => candidate.gameName === 'F_Combat04',
    )!;
    const selected = applyProjectCommand(start, catalog, {
      kind: 'ReplaceResourcePlacement',
      route: { kind: 'route', routeKey: 'Underworld' },
      family: 'Fishing',
      value: { biomeKey: 'F', occurrenceId: occurrence.occurrenceId },
    });
    const replaced = applyProjectCommand(selected, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(
        createBiomeAddress('Underworld', 'F'),
        occurrence.occurrenceId,
      ),
      gameName: 'F_Combat09',
    });
    expect(replaced.route!.resourcePlacements.Fishing).toEqual({
      biomeKey: 'F',
      occurrenceId: occurrence.occurrenceId,
    });
  });
});
