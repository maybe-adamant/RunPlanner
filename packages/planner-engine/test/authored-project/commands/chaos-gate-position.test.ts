import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  chaosGateSpawnPointIndices,
  createAdditionalExitAddress,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectHistory,
  decodeProjectDocument,
  encodeProjectDocument,
  undoProjectHistory,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { loadUnderworldIxionChaosCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { createGoldenFGHProject } from '@run-planner/test-fixtures/underworld';
import { nBiome, nProject } from '../support/configured-projects';

const opening = createOccurrenceId('position-opening');
const additional = createAdditionalExitAddress(nBiome, opening, 'chaos');

function manualGate() {
  const started = applyProjectCommand(nProject(), catalog, {
    kind: 'CreateStart',
    biome: nBiome,
    occurrenceId: opening,
  });
  return applyProjectCommand(started, catalog, {
    kind: 'AddChaos',
    additional,
    occurrenceId: createOccurrenceId('position-chaos'),
  });
}

function gate(project: ProjectDocument, id = opening) {
  return project.route.biomes
    .flatMap((biome) => biome.topology?.occurrences ?? [])
    .find((room) => room.occurrenceId === id)
    ?.additionalExits.find((exit) => exit.kind === 'chaos');
}

describe('Chaos physical position authoring', () => {
  it('starts at Default when Ixion pressure moves to another host map', () => {
    let project = createGoldenFGHProject();
    const wells = ['F', 'G'].map((biomeKey) => {
      const postboss = project.route.biomes
        .find((biome) => biome.biomeKey === biomeKey)!
        .topology!.occurrences.find((room) => room.gameName === `${biomeKey}_PostBoss01`)!;
      return createOccurrenceAddress(
        createBiomeAddress('Underworld', biomeKey),
        postboss.occurrenceId,
      );
    });
    for (const occurrence of wells) {
      project = applyProjectCommand(project, catalog, {
        kind: 'SetStygianWellInteraction',
        occurrence,
        interacted: true,
      });
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceStygianWellOffer',
        occurrence,
        slotKey: 'secondLeft',
        itemKey: 'TemporaryForcedSecretDoorTrait',
      });
      project = applyProjectCommand(project, catalog, {
        kind: 'SetStygianWellPurchase',
        occurrence,
        generationKey: 'initial:secondLeft',
        purchased: false,
      });
    }
    project = applyProjectCommand(project, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: wells[0]!,
      generationKey: 'initial:secondLeft',
      purchased: true,
    });
    const g = project.route.biomes.find((biome) => biome.biomeKey === 'G')!.topology!;
    const host = g.occurrences.find((room) =>
      room.additionalExits.some((exit) => exit.kind === 'chaos'),
    )!;
    project = applyProjectCommand(project, catalog, {
      kind: 'SetChaosSpawnPoint',
      additional: createAdditionalExitAddress(
        createBiomeAddress('Underworld', 'G'),
        host.occurrenceId,
        'chaos',
      ),
      spawnPointIndex: 1,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: wells[0]!,
      generationKey: 'initial:secondLeft',
      purchased: false,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: wells[1]!,
      generationKey: 'initial:secondLeft',
      purchased: true,
    });
    expect(gate(project, host.occurrenceId)).toBeUndefined();
    const h = project.route.biomes.find((biome) => biome.biomeKey === 'H')!.topology!;
    const newHost = h.occurrences.find((room) =>
      room.additionalExits.some((exit) => exit.kind === 'chaos'),
    )!;
    expect(newHost.gameName).not.toBe(host.gameName);
    expect(gate(project, newHost.occurrenceId)).toBeDefined();
    expect(gate(project, newHost.occurrenceId)?.spawnPointIndex).toBeUndefined();
  });

  it('publishes a declaration-owned domain without promoting non-hosts', () => {
    expect(chaosGateSpawnPointIndices(catalog.rooms.byKey.N_Opening01!)).toEqual([1, 2]);
    expect(chaosGateSpawnPointIndices(catalog.rooms.byKey.H_Combat04!)).toEqual([1, 2, 3, 4]);
    expect(chaosGateSpawnPointIndices(catalog.rooms.byKey.F_Opening01!)).toEqual([1]);
    expect(chaosGateSpawnPointIndices(catalog.rooms.byKey.N_PreHub01!)).toEqual([]);
  });

  it('sets and resets only the leaf, preserves encoding at Default, and undoes removal', () => {
    const base = manualGate();
    const encoded = encodeProjectDocument(base);
    expect(encoded).not.toContain('spawnPointIndex');
    const selected = applyProjectHistoryCommand(createProjectHistory(base), catalog, {
      kind: 'SetChaosSpawnPoint',
      additional,
      spawnPointIndex: 2,
    });
    expect(gate(selected.present)).toEqual({ ...gate(base), spawnPointIndex: 2 });
    expect(selected.present.route.biomes[0]?.topology?.decisions).toEqual(
      base.route.biomes[0]?.topology?.decisions,
    );
    expect(
      decodeProjectDocument(JSON.parse(encodeProjectDocument(selected.present)), catalog),
    ).toEqual(selected.present);
    expect(undoProjectHistory(selected).present).toBe(base);
    expect(
      applyProjectHistoryCommand(selected, catalog, {
        kind: 'SetChaosSpawnPoint',
        additional,
        spawnPointIndex: 2,
      }),
    ).toBe(selected);
    const reset = applyProjectCommand(selected.present, catalog, {
      kind: 'SetChaosSpawnPoint',
      additional,
      spawnPointIndex: null,
    });
    expect(encodeProjectDocument(reset)).toBe(encoded);
    const removed = applyProjectHistoryCommand(selected, catalog, {
      kind: 'RemoveChaos',
      additional,
    });
    expect(gate(removed.present)).toBeUndefined();
    expect(gate(undoProjectHistory(removed).present)?.spawnPointIndex).toBe(2);
  });

  it.each([0, -1, 1.5, '1', null, NaN, Infinity])('rejects malformed codec index %s', (value) => {
    const base = manualGate();
    const raw = structuredClone(base);
    Object.assign(gate(raw)!, { spawnPointIndex: value });
    expect(() => decodeProjectDocument(raw, catalog)).toThrow(/spawnPointIndex.*positive integer/);
  });

  it('retains a positive out-of-domain index but permits only declared command choices', () => {
    const raw = structuredClone(manualGate());
    Object.assign(gate(raw)!, { spawnPointIndex: 99 });
    const retained = decodeProjectDocument(raw, catalog);
    expect(gate(retained)?.spawnPointIndex).toBe(99);
    expect(() =>
      applyProjectCommand(retained, catalog, {
        kind: 'SetChaosSpawnPoint',
        additional,
        spawnPointIndex: 3,
      }),
    ).toThrow(/SecretPoint domain/);
    expect(
      gate(
        applyProjectCommand(retained, catalog, {
          kind: 'SetChaosSpawnPoint',
          additional,
          spawnPointIndex: null,
        }),
      )?.spawnPointIndex,
    ).toBeUndefined();
  });

  it('preserves a surviving Ixion gate choice and restores it on purchase-removal Undo', () => {
    const base = loadUnderworldIxionChaosCheckpoint();
    const biome = base.route.biomes.find((entry) => entry.biomeKey === 'G')!;
    const host = biome.topology!.occurrences.find((room) =>
      room.additionalExits.some((exit) => exit.kind === 'chaos'),
    )!;
    const owner = createAdditionalExitAddress(
      createBiomeAddress('Underworld', 'G'),
      host.occurrenceId,
      'chaos',
    );
    const selected = applyProjectHistoryCommand(createProjectHistory(base), catalog, {
      kind: 'SetChaosSpawnPoint',
      additional: owner,
      spawnPointIndex: 1,
    });
    const selectedGate = gate(selected.present, host.occurrenceId)!;
    expect(selectedGate.spawnPointIndex).toBe(1);
    const origin = selectedGate.origin!;
    const removed = applyProjectHistoryCommand(selected, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: createOccurrenceAddress(
        createBiomeAddress('Underworld', origin.sourceBiomeKey),
        origin.sourceOccurrenceId,
      ),
      generationKey: origin.generationKey,
      purchased: false,
    });
    expect(gate(removed.present, host.occurrenceId)).toBeUndefined();
    expect(gate(undoProjectHistory(removed).present, host.occurrenceId)).toEqual(selectedGate);
    const regenerated = applyProjectCommand(removed.present, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: createOccurrenceAddress(
        createBiomeAddress('Underworld', origin.sourceBiomeKey),
        origin.sourceOccurrenceId,
      ),
      generationKey: origin.generationKey,
      purchased: true,
    });
    expect(gate(regenerated, host.occurrenceId)?.spawnPointIndex).toBeUndefined();

    let manual = applyProjectCommand(removed.present, catalog, {
      kind: 'AddChaos',
      additional: owner,
      occurrenceId: createOccurrenceId('manual-ixion-position'),
    });
    manual = applyProjectCommand(manual, catalog, {
      kind: 'SetChaosSpawnPoint',
      additional: owner,
      spawnPointIndex: 1,
    });
    const manualChoice = gate(manual, host.occurrenceId);
    for (const purchased of [true, false]) {
      manual = applyProjectCommand(manual, catalog, {
        kind: 'SetStygianWellPurchase',
        occurrence: createOccurrenceAddress(
          createBiomeAddress('Underworld', origin.sourceBiomeKey),
          origin.sourceOccurrenceId,
        ),
        generationKey: origin.generationKey,
        purchased,
      });
      expect(gate(manual, host.occurrenceId)).toEqual(manualChoice);
      expect(gate(manual, host.occurrenceId)?.origin).toBeUndefined();
    }
  });
});
