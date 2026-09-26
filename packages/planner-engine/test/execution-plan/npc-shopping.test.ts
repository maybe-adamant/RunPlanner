import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  goldenFBiome,
  goldenFOccurrenceId,
  goldenGBiome,
  goldenGOccurrenceId,
} from '@run-planner/test-fixtures/underworld';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createProjectHistory,
  undoProjectHistory,
  createEncounterPhaseAddress,
} from '../../src/authored-project';
import { simulateProjectAssembly } from '../../src/simulation';
import { assembleExecutionProduct } from '../../src/execution-plan/assembler';
import { compileExecutionPlan } from '../../src/execution-plan/compiler';
import { decodeExecutionPlan, encodeExecutionPlan } from '../../src/execution-plan/codec';
import { fingerprint } from '../../src/execution-plan/fingerprint';
import { npcShoppingProtectionProject } from './support/npc-shopping-fixture';
import { dreamMixedHandoffProject } from '@run-planner/test-fixtures/dream';
import { createBiomeAddress, createOccurrenceId } from '../../src/authored-project';

const phase = (index: number) =>
  createEncounterPhaseAddress(
    goldenGBiome,
    { kind: 'occurrence' as const, occurrenceId: goldenGOccurrenceId(index, 1) },
    'Encounter',
  );

describe('published NPC shopping protection', () => {
  it('ignores unpicked and unassessed configured encounter selections', () => {
    const selected = npcShoppingProtectionProject();
    const ordinary = applyProjectCommand(selected, catalog, {
      kind: 'SelectEncounter',
      phase: phase(4),
      encounterKey: 'GeneratedG',
    });
    const unpicked = applyProjectCommand(ordinary, catalog, {
      kind: 'SelectEncounter',
      phase: createEncounterPhaseAddress(
        goldenGBiome,
        { kind: 'occurrence', occurrenceId: goldenGOccurrenceId(5, 2) },
        'Encounter',
      ),
      encounterKey: 'NemesisCombatG',
    });
    expect(
      simulateProjectAssembly(catalog, unpicked).evaluation.route.npcShopping.occurrences,
    ).toEqual([]);
    const unreached = applyProjectCommand(selected, catalog, {
      kind: 'ClearTopology',
      biome: goldenFBiome,
    });
    expect(
      simulateProjectAssembly(catalog, unreached).evaluation.route.npcShopping.occurrences,
    ).toEqual([]);
  });

  it('derives the same preceding-biome protection in an authored Dream itinerary', () => {
    const project = applyProjectCommand(dreamMixedHandoffProject(), catalog, {
      kind: 'SelectEncounter',
      phase: createEncounterPhaseAddress(
        createBiomeAddress('Dream', 'F'),
        { kind: 'occurrence', occurrenceId: createOccurrenceId('dream-f-3-1') },
        'Encounter',
      ),
      encounterKey: 'NemesisCombatF',
    });
    const evaluation = simulateProjectAssembly(catalog, project).evaluation;
    expect(evaluation.status).toBe('valid');
    expect(evaluation.route.npcShopping.occurrences.length).toBeGreaterThan(0);
  });
  it('publishes reached selected protection and recomputes it when the selected encounter is removed or moved', () => {
    const project = npcShoppingProtectionProject();
    const assembly = simulateProjectAssembly(catalog, project);
    expect(assembly.evaluation.status).toBe('valid');
    const plan = compileExecutionPlan({ product: assembleExecutionProduct({ catalog, assembly }) });
    const protectedShops = plan.occurrences.filter(
      (room) => room.suppressedNpcShopping !== undefined,
    );
    expect(protectedShops.length).toBeGreaterThan(0);
    expect(
      protectedShops.every((room) =>
        room.overview.encounterPhases.some((phase) => phase.encounterKey === 'Shop'),
      ),
    ).toBe(true);
    expect(decodeExecutionPlan(JSON.parse(encodeExecutionPlan(plan)))).toEqual(plan);
    const edited = applyProjectHistoryCommand(createProjectHistory(project), catalog, {
      kind: 'SelectEncounter',
      phase: phase(4),
      encounterKey: 'GeneratedG',
    });
    const removed = edited.present;
    expect(
      simulateProjectAssembly(catalog, removed).evaluation.route.npcShopping.occurrences,
    ).toEqual([]);
    const moved = applyProjectCommand(removed, catalog, {
      kind: 'SelectEncounter',
      phase: createEncounterPhaseAddress(
        goldenFBiome,
        { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(5, 1) },
        'Encounter',
      ),
      encounterKey: 'NemesisCombatF',
    });
    const movedEvaluation = simulateProjectAssembly(catalog, moved).evaluation;
    expect(movedEvaluation.findings).toEqual([]);
    const movedPolicy = movedEvaluation.route.npcShopping.occurrences;
    expect(movedPolicy).toEqual([]);
    expect(
      simulateProjectAssembly(catalog, undoProjectHistory(edited).present).evaluation.route
        .npcShopping,
    ).toEqual(assembly.evaluation.route.npcShopping);
  });

  it('decodes only unique closed family arrays while retaining absent and empty forms', () => {
    const assembly = simulateProjectAssembly(catalog, npcShoppingProtectionProject());
    const plan = compileExecutionPlan({ product: assembleExecutionProduct({ catalog, assembly }) });
    const changed = (families: unknown) => {
      const { planFingerprint: _fingerprint, ...body } = plan;
      void _fingerprint;
      const modified = {
        ...body,
        occurrences: body.occurrences.map((row, index) =>
          index === 0 ? { ...row, suppressedNpcShopping: families } : row,
        ),
      };
      return { ...modified, planFingerprint: fingerprint(modified) };
    };
    for (const value of [[], ['Nemesis'], ['Heracles'], ['Nemesis', 'Heracles']])
      expect(() => decodeExecutionPlan(changed(value))).not.toThrow();
    for (const value of [null, 'Nemesis', ['Artemis'], ['Nemesis', 'Nemesis'], [1]])
      expect(() => decodeExecutionPlan(changed(value))).toThrow();
    expect(() => decodeExecutionPlan({ ...plan, protocolVersion: 47 })).toThrow('protocolVersion');
  });
});
