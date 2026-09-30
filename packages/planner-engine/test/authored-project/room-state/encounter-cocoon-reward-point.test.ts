import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { arachneCocoonPhases } from '@run-planner/test-fixtures/underworld';
import { loadUnderworldArachneCocoonsCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createProjectHistory,
  createBiomeAddress,
  createOccurrenceAddress,
  undoProjectHistory,
  decodeProjectDocument,
  encodeProjectDocument,
  type ProjectDocument,
} from '../../../src/authored-project';
import { encounterPhaseAuthoringDomainForRoom, simulateProject } from '../../../src/simulation';
import { createDefaultRoomEncounterState } from '../../../src/authored-project/room-state/encounter-envelope';
import { reconcileRoomEncounterState } from '../../../src/authored-project/room-state/encounter-reconciliation';

const phase = arachneCocoonPhases.F;
function occurrence(project: ProjectDocument) {
  return project.route.biomes
    .find((b) => b.biomeKey === 'F')!
    .topology!.occurrences.find((o) => o.occurrenceId === phase.owner.occurrenceId)!;
}
function setPoint(project: ProjectDocument, spawnPointId: number | null) {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceEncounterCustomization',
    phase,
    decisionKey: 'cocoonRewardPoint',
    value: spawnPointId === null ? null : { kind: 'cocoonRewardPoint', spawnPointId },
  });
}
function values(project: ProjectDocument) {
  return occurrence(project).encounters.customizationByPhase?.Encounter;
}

describe('cocoon reward point authorship', () => {
  it('exposes exactly each F/G host inventory and supports a G position with native count', () => {
    for (const host of catalog.rooms.values.filter(
      (room) => room.cocoonRewardPointIds !== undefined,
    )) {
      const encounters = {
        ...createDefaultRoomEncounterState(catalog, host),
        encounterKeyByPhase: {
          Encounter: host.roomSetKey === 'F' ? 'ArachneCombatF' : 'ArachneCombatG',
        },
      };
      const decision = encounterPhaseAuthoringDomainForRoom(
        catalog,
        createBiomeAddress('Underworld', host.roomSetKey),
        host,
        phase.owner,
        encounters,
      )[0]!.customization!.find((d) => d.key === 'cocoonRewardPoint')!;
      expect(decision.cocoonRewardPointIds).toBe(host.cocoonRewardPointIds);
      expect(decision.valueSupported).toBe(true);
    }
    const saved = loadUnderworldArachneCocoonsCheckpoint();
    const gPhase = arachneCocoonPhases.G;
    const host = saved.route.biomes
      .find((b) => b.biomeKey === 'G')!
      .topology!.occurrences.find((o) => o.occurrenceId === gPhase.owner.occurrenceId)!;
    const point = catalog.rooms.byKey[host.gameName]!.cocoonRewardPointIds![0]!;
    const edited = applyProjectCommand(saved, catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase: gPhase,
      decisionKey: 'cocoonRewardPoint',
      value: { kind: 'cocoonRewardPoint', spawnPointId: point },
    });
    expect(
      simulateProject(catalog, edited).findings.filter(
        (f) => f.code === 'encounterCustomizationUnavailable',
      ),
    ).toEqual([]);
  });

  it('keeps independent count/point resets and exact Undo snapshots with old-save round trip', () => {
    let saved = loadUnderworldArachneCocoonsCheckpoint();
    for (const oldPhase of Object.values(arachneCocoonPhases)) {
      saved = applyProjectCommand(saved, catalog, {
        kind: 'ReplaceEncounterCustomization',
        phase: oldPhase,
        decisionKey: 'cocoonRewardPoint',
        value: null,
      });
    }
    expect(values(saved)).toEqual({ cocoonCount: { kind: 'cocoonCount', count: 11 } });
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(saved)), catalog)).toEqual(saved);
    const id = catalog.rooms.byKey[occurrence(saved).gameName]!.cocoonRewardPointIds![0]!;
    const history = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase,
      decisionKey: 'cocoonRewardPoint',
      value: { kind: 'cocoonRewardPoint', spawnPointId: id },
    });
    expect(undoProjectHistory(history).present).toBe(saved);
    const both = history.present;
    expect(values(both)).toEqual({
      cocoonCount: { kind: 'cocoonCount', count: 11 },
      cocoonRewardPoint: { kind: 'cocoonRewardPoint', spawnPointId: id },
    });
    expect(values(setPoint(both, null))).toEqual(values(saved));
    const nativeCount = applyProjectCommand(both, catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase,
      decisionKey: 'cocoonCount',
      value: null,
    });
    expect(values(nativeCount)).toEqual({
      cocoonRewardPoint: { kind: 'cocoonRewardPoint', spawnPointId: id },
    });
    expect(
      simulateProject(catalog, nativeCount).findings.filter(
        (f) => f.code === 'encounterCustomizationUnavailable',
      ),
    ).toEqual([]);
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(nativeCount)), catalog)).toEqual(
      nativeCount,
    );
  });

  it('rejects malformed IDs and strict wire keys but retains out-of-host positive IDs for phase repair', () => {
    const saved = loadUnderworldArachneCocoonsCheckpoint();
    for (const id of [0, -1, 1.5, NaN, Infinity]) expect(() => setPoint(saved, id)).toThrow();
    for (const raw of [
      { kind: 'cocoonRewardPoint' },
      { kind: 'cocoonRewardPoint', spawnPointId: '1' },
      { kind: 'cocoonRewardPoint', spawnPointId: 0 },
      { kind: 'cocoonRewardPoint', spawnPointId: 1.5 },
      { kind: 'cocoonRewardPoint', spawnPointId: 1, extra: true },
    ]) {
      const wire = JSON.parse(encodeProjectDocument(saved));
      wire.route.biomes
        .find((b: { biomeKey: string }) => b.biomeKey === 'F')
        .topology.occurrences.find(
          (o: { occurrenceId: string }) => o.occurrenceId === phase.owner.occurrenceId,
        ).encounters.customizationByPhase.Encounter.cocoonRewardPoint = raw;
      expect(() => decodeProjectDocument(wire, catalog)).toThrow();
    }
    const invalid = setPoint(saved, 1);
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(invalid)), catalog)).toEqual(
      invalid,
    );
    expect(
      simulateProject(catalog, invalid).findings.filter(
        (f) => f.code === 'encounterCustomizationUnavailable',
      ),
    ).toEqual([
      expect.objectContaining({
        origin: phase,
        evidence: expect.objectContaining({ decisionKey: 'cocoonRewardPoint' }),
      }),
    ]);
    const host = catalog.rooms.byKey[occurrence(invalid).gameName]!;
    const decision = encounterPhaseAuthoringDomainForRoom(
      catalog,
      createBiomeAddress(phase.routeKey, phase.biomeKey),
      host,
      phase.owner,
      occurrence(invalid).encounters,
    )[0]!.customization!.find((d) => d.key === 'cocoonRewardPoint')!;
    expect(decision.valueSupported).toBe(false);
    expect(decision.cocoonRewardPointIds).toEqual(host.cocoonRewardPointIds);
  });

  it('retains native identity through compatible room replacement and removes it with phase ownership', () => {
    const initial = loadUnderworldArachneCocoonsCheckpoint();
    const initialHost = catalog.rooms.byKey[occurrence(initial).gameName]!;
    const replacementHost = catalog.rooms.byKey.F_Combat07!;
    const point = initialHost.cocoonRewardPointIds!.find(
      (id) => !replacementHost.cocoonRewardPointIds!.includes(id),
    )!;
    expect(point).toBeDefined();
    const saved = setPoint(initial, point);
    expect(
      simulateProject(catalog, saved).findings.filter(
        (finding) => finding.code === 'encounterCustomizationUnavailable',
      ),
    ).toEqual([]);
    const replaced = applyProjectHistoryCommand(createProjectHistory(saved), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(
        createBiomeAddress(phase.routeKey, phase.biomeKey),
        phase.owner.occurrenceId,
      ),
      gameName: replacementHost.gameName,
    });
    expect(occurrence(replaced.present).gameName).toBe(replacementHost.gameName);
    expect(values(replaced.present)?.cocoonRewardPoint).toEqual({
      kind: 'cocoonRewardPoint',
      spawnPointId: point,
    });
    expect(
      simulateProject(catalog, replaced.present).findings.filter(
        (finding) => finding.code === 'encounterCustomizationUnavailable',
      ),
    ).toEqual([
      expect.objectContaining({
        origin: phase,
        evidence: expect.objectContaining({ decisionKey: 'cocoonRewardPoint' }),
      }),
    ]);
    expect(undoProjectHistory(replaced).present).toBe(saved);
    const previous = catalog.rooms.byKey[occurrence(saved).gameName]!;
    const replacement = catalog.rooms.byKey.F_PostBoss01!;
    const next = reconcileRoomEncounterState(
      catalog,
      previous,
      occurrence(saved).encounters,
      replacement,
      createDefaultRoomEncounterState(catalog, replacement),
    );
    expect(next.customizationByPhase).toBeUndefined();
  });
});
