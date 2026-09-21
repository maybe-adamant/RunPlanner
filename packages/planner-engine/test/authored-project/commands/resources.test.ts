import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createProjectHistory,
  undoProjectHistory,
} from '@run-planner/engine/authored-project';
import {
  createCompleteFGIxionChaosProject,
  loadUnderworldFGProject,
} from '@run-planner/test-fixtures/underworld';

describe('route-owned selected resource placement command', () => {
  it.each(['clearIxionOffer', 'disableWell', 'unpurchaseIxion'] as const)(
    'retracts resources deleted by indirect Ixion topology cleanup: %s',
    (edit) => {
      let project = createCompleteFGIxionChaosProject();
      const f = project.route.biomes.find((biome) => biome.biomeKey === 'F')!;
      const g = project.route.biomes.find((biome) => biome.biomeKey === 'G')!;
      const gate = g
        .topology!.occurrences.flatMap((room) => room.additionalExits)
        .find((exit) => exit.kind === 'chaos' && exit.origin?.kind === 'ixionGenerated')!;
      if (gate.kind !== 'chaos' || gate.origin === undefined)
        throw new Error('missing generated gate');
      const continuation = g.topology!.occurrences.find((room) => room.gameName === 'G_Shop01')!;
      const surviving = { biomeKey: 'F', occurrenceId: f.topology!.startOccurrenceId };
      for (const [family, value] of [
        ['Fishing', { biomeKey: 'G', occurrenceId: gate.occurrenceId }],
        ['Exorcism', { biomeKey: 'G', occurrenceId: continuation.occurrenceId }],
        ['Pickaxe', surviving],
      ] as const) {
        project = applyProjectCommand(project, catalog, {
          kind: 'ReplaceResourcePlacement',
          route: { kind: 'route', routeKey: 'Underworld' },
          family,
          value,
        });
      }
      const occurrence = createOccurrenceAddress(
        createBiomeAddress('Underworld', gate.origin.sourceBiomeKey),
        gate.origin.sourceOccurrenceId,
      );
      const command =
        edit === 'clearIxionOffer'
          ? {
              kind: 'ReplaceStygianWellOffer' as const,
              occurrence,
              slotKey: 'secondLeft' as const,
              itemKey: null,
            }
          : edit === 'disableWell'
            ? { kind: 'SetStygianWellInteraction' as const, occurrence, interacted: false }
            : {
                kind: 'SetStygianWellPurchase' as const,
                occurrence,
                generationKey: gate.origin.generationKey,
                purchased: false,
              };
      const history = applyProjectHistoryCommand(createProjectHistory(project), catalog, command);
      expect(history.present.route.resourcePlacements).toMatchObject({
        Fishing: null,
        Exorcism: null,
        Pickaxe: surviving,
      });
      const topology = history.present.route.biomes.find(
        (biome) => biome.biomeKey === 'G',
      )!.topology!;
      expect(
        topology.occurrences.some((room) => room.occurrenceId === topology.startOccurrenceId),
      ).toBe(true);
      expect(topology.occurrences.some((room) => room.occurrenceId === gate.occurrenceId)).toBe(
        false,
      );
      expect(
        topology.occurrences.some((room) => room.occurrenceId === continuation.occurrenceId),
      ).toBe(false);
      expect(undoProjectHistory(history).present).toEqual(project);
    },
  );

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

  it('retracts a fixed-entry placement when ClearTopology recreates that entry ID', () => {
    const start = createProjectDocument(catalog, {
      projectId: 'clear-fixed-entry-resource',
      routeKey: 'Surface',
      configuredBiomeCount: 1,
    });
    const target = { biomeKey: 'N', occurrenceId: createOccurrenceId('N:start') };
    const selected = applyProjectCommand(start, catalog, {
      kind: 'ReplaceResourcePlacement',
      route: { kind: 'route', routeKey: 'Surface' },
      family: 'Pickaxe',
      value: target,
    });
    const history = applyProjectHistoryCommand(createProjectHistory(selected), catalog, {
      kind: 'ClearTopology',
      biome: createBiomeAddress('Surface', 'N'),
    });
    expect(history.present.route.resourcePlacements.Pickaxe).toBeNull();
    expect(history.present.route.biomes[0]?.topology?.startOccurrenceId).toBe('N:start');
    expect(undoProjectHistory(history).present).toEqual(selected);
  });
});
