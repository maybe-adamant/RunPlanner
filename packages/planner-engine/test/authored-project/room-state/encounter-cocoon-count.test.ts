import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import { createCompleteFGProject } from '@run-planner/test-fixtures/underworld';
import {
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  type ProjectDocument,
} from '../../../src/authored-project';
import { simulateProject } from '../../../src/simulation';
import { createDefaultRoomEncounterState } from '../../../src/authored-project/room-state/encounter-envelope';
import { reconcileRoomEncounterState } from '../../../src/authored-project/room-state/encounter-reconciliation';
import { room } from '../support/room-state-codec';
import {
  arachneCocoonPhases,
  underworldArachneCocoonProject,
} from '../../execution-plan/support/arachne-cocoon-fixture';

const fPhase = arachneCocoonPhases.F;

function fEncounters(project: ProjectDocument) {
  return project.route.biomes
    .find((biome) => biome.biomeKey === 'F')!
    .topology!.occurrences.find(
      (occurrence) => occurrence.occurrenceId === fPhase.owner.occurrenceId,
    )!.encounters;
}

function withRawFCount(project: ProjectDocument, raw: unknown): unknown {
  const document = JSON.parse(encodeProjectDocument(project)) as {
    route: {
      biomes: {
        biomeKey: string;
        topology: { occurrences: { occurrenceId: string; encounters: Record<string, unknown> }[] };
      }[];
    };
  };
  const occurrence = document.route.biomes
    .find((biome) => biome.biomeKey === 'F')!
    .topology.occurrences.find((entry) => entry.occurrenceId === fPhase.owner.occurrenceId)!;
  occurrence.encounters.customizationByPhase = { Encounter: { cocoonCount: raw } };
  return document;
}

function cocoonFindings(project: ProjectDocument) {
  return simulateProject(catalog, project).findings.filter(
    (finding) => finding.code === 'encounterCustomizationUnavailable',
  );
}

describe('Arachne combat cocoon count', () => {
  it('persists an exact in-range count, resets to absent Default, and round-trips', () => {
    const project = underworldArachneCocoonProject();
    expect(fEncounters(project).customizationByPhase).toEqual({
      Encounter: { cocoonCount: { kind: 'cocoonCount', count: 11 } },
    });
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );
    expect(cocoonFindings(project)).toEqual([]);

    const reset = applyProjectCommand(project, catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase: fPhase,
      decisionKey: 'cocoonCount',
      value: null,
    });
    expect(fEncounters(reset).customizationByPhase).toBeUndefined();
  });

  it('rejects commands outside the declared range or on a phase without the decision', () => {
    const project = underworldArachneCocoonProject();
    for (const count of [7, 15, 10.5])
      expect(() =>
        applyProjectCommand(project, catalog, {
          kind: 'ReplaceEncounterCustomization',
          phase: fPhase,
          decisionKey: 'cocoonCount',
          value: { kind: 'cocoonCount', count },
        }),
      ).toThrow(/outside its declaration domain/);

    const opening = project.route.biomes.find((biome) => biome.biomeKey === 'F')!.topology!;
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceEncounterCustomization',
        phase: createEncounterPhaseAddress(
          createBiomeAddress('Underworld', 'F'),
          { kind: 'occurrence', occurrenceId: opening.startOccurrenceId },
          'Encounter',
        ),
        decisionKey: 'cocoonCount',
        value: { kind: 'cocoonCount', count: 11 },
      }),
    ).toThrow(/not a declared customization/);
  });

  it('strictly decodes the persisted shape', () => {
    const project = underworldArachneCocoonProject();
    for (const raw of [
      { kind: 'cocoonCount', count: 0 },
      { kind: 'cocoonCount', count: 9.5 },
      { kind: 'cocoonCount', count: '9' },
      { kind: 'cocoonCount' },
      { kind: 'cocoonCount', count: 9, native: true },
    ])
      expect(() => decodeProjectDocument(withRawFCount(project, raw), catalog)).toThrow();
  });

  it('retains an out-of-range count as a phase-owned repair finding without clamping', () => {
    const decoded = decodeProjectDocument(
      withRawFCount(underworldArachneCocoonProject(), { kind: 'cocoonCount', count: 20 }),
      catalog,
    );
    expect(fEncounters(decoded).customizationByPhase).toEqual({
      Encounter: { cocoonCount: { kind: 'cocoonCount', count: 20 } },
    });
    expect(cocoonFindings(decoded)).toEqual([
      expect.objectContaining({
        severity: 'error',
        origin: fPhase,
        evidence: expect.objectContaining({ decisionKey: 'cocoonCount' }),
      }),
    ]);
    expect(simulateProject(catalog, decoded).route.summary.eligibleForExecutionPlan).toBe(false);
  });

  it('keeps a retained count dormant while another encounter is selected', () => {
    const nativeKey = fEncounters(createCompleteFGProject()).encounterKeyByPhase.Encounter!;
    const dormant = applyProjectCommand(underworldArachneCocoonProject(), catalog, {
      kind: 'SelectEncounter',
      phase: fPhase,
      encounterKey: nativeKey,
    });
    expect(fEncounters(dormant).customizationByPhase).toEqual({
      Encounter: { cocoonCount: { kind: 'cocoonCount', count: 11 } },
    });
    expect(cocoonFindings(dormant)).toEqual([]);
    expect(simulateProject(catalog, dormant).route.summary.eligibleForExecutionPlan).toBe(true);
  });

  it('retains an out-of-range count through a compatible room replacement', () => {
    const previousRoom = room('F_Combat06');
    const retained = Object.freeze({
      ...createDefaultRoomEncounterState(catalog, previousRoom),
      encounterKeyByPhase: Object.freeze({ Encounter: 'ArachneCombatF' }),
      customizationByPhase: Object.freeze({
        Encounter: Object.freeze({ cocoonCount: { kind: 'cocoonCount' as const, count: 20 } }),
      }),
    });
    const replacementRoom = room('F_Combat05');
    expect(
      reconcileRoomEncounterState(
        catalog,
        previousRoom,
        retained,
        replacementRoom,
        createDefaultRoomEncounterState(catalog, replacementRoom),
      ).customizationByPhase,
    ).toEqual({ Encounter: { cocoonCount: { kind: 'cocoonCount', count: 20 } } });
  });
});
