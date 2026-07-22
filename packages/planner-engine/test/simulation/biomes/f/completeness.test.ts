import { describe, expect, it } from 'vitest';
import {
  applyProjectCommand,
  createBiomeAddress,
  createContinuationAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createPickedAddress,
  createProjectDocument,
  createTargetAddress,
  semanticAddressKey,
  type LinearBiomePlan,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  CompletenessContractError,
  evaluateFCompleteness,
  type FCompletenessResult,
} from '@run-planner/engine/simulation';

import { catalog } from '@run-planner/hades2-catalog';

const biome = createBiomeAddress('Underworld', 'F');
const startId = createOccurrenceId('f-start');
const combatId = createOccurrenceId('f-combat');
const terminalShopId = createOccurrenceId('f-terminal-shop');
const terminalFreeId = createOccurrenceId('f-terminal-free');

function fPlan(project: ProjectDocument): LinearBiomePlan {
  const plan = project.routes.find((route) => route.routeKey === 'Underworld')?.biomes[0];
  if (plan?.kind !== 'LinearBiome' || plan.biomeKey !== 'F') {
    throw new Error('missing authored F plan');
  }
  return plan;
}

function evaluate(project: ProjectDocument): FCompletenessResult {
  return evaluateFCompleteness(catalog, biome, fPlan(project));
}

function unstartedProject(): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: 'f-completeness',
    name: 'F Completeness',
    configuredBiomeCounts: { Underworld: 1 },
  });
}

function startedProject(): ProjectDocument {
  return applyProjectCommand(unstartedProject(), catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: startId,
    gameName: 'F_Opening01',
  });
}

function withOpeningBatch(project = startedProject()): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    continuation: createContinuationAddress(biome, startId),
  });
}

function withCombatTarget(gameName = 'F_Combat04'): ProjectDocument {
  return applyProjectCommand(withOpeningBatch(), catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, startId, 1),
    occurrenceId: combatId,
    gameName,
  });
}

function withSelectedCombat(gameName = 'F_Combat04'): ProjectDocument {
  return applyProjectCommand(withCombatTarget(gameName), catalog, {
    kind: 'SetPicked',
    picked: createPickedAddress(biome, startId),
    exitIndex: 1,
  });
}

function withTerminal(gameName = 'F_Combat04'): ProjectDocument {
  const targetOccurrenceIds =
    gameName === 'F_Combat01' ? [terminalShopId] : [terminalShopId, terminalFreeId];
  return applyProjectCommand(withSelectedCombat(gameName), catalog, {
    kind: 'CreateTerminalTransition',
    continuation: createContinuationAddress(biome, combatId),
    targetOccurrenceIds,
  });
}

function completeFProject(gameName = 'F_Combat04'): ProjectDocument {
  return applyProjectCommand(withTerminal(gameName), catalog, {
    kind: 'SetTerminalPicked',
    picked: createPickedAddress(biome, combatId),
    exitIndex: 1,
  });
}

describe('F completeness', () => {
  it('rejects evaluation outside the declared F route placement', () => {
    expect(() =>
      evaluateFCompleteness(catalog, createBiomeAddress('Surface', 'F'), fPlan(startedProject())),
    ).toThrowError(new CompletenessContractError('Surface does not place biome F'));
  });

  it('reports an unstarted biome without producing complete topology', () => {
    const result = evaluate(unstartedProject());

    expect(result).toEqual({
      completion: 'incomplete',
      findings: [
        {
          code: 'biomeTopologyMissing',
          severity: 'error',
          phase: 'completeness',
          origin: biome,
          evidence: { biomeKey: 'F' },
        },
      ],
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.findings[0])).toBe(true);
  });

  it('keeps a missing continuation distinct from an illegal continuation', () => {
    const result = evaluate(startedProject());

    expect(result.completion).toBe('incomplete');
    expect(result.findings.map((finding) => finding.code)).toEqual(['continuationMissing']);
    expect(result.findings.map((finding) => semanticAddressKey(finding.origin))).toEqual([
      '["continuation","Underworld","F","f-start"]',
    ]);
  });

  it('addresses every missing physical target and the independent picked choice', () => {
    const result = evaluate(withOpeningBatch());

    expect(result.completion).toBe('incomplete');
    expect(
      result.findings.map((finding) => ({
        code: finding.code,
        origin: semanticAddressKey(finding.origin),
      })),
    ).toEqual([
      {
        code: 'targetMissing',
        origin: '["target","Underworld","F","f-start",1]',
      },
      {
        code: 'pickedTargetMissing',
        origin: '["picked","Underworld","F","f-start"]',
      },
    ]);
  });

  it('stops an authored batch with concrete targets but no picked target', () => {
    const result = evaluate(withCombatTarget());

    expect(result.completion).toBe('incomplete');
    expect(result.findings.map((finding) => finding.code)).toEqual(['pickedTargetMissing']);
    expect(result.findings[0]?.evidence).toEqual({ continuationKind: 'batch' });
  });

  it('requires the terminal pick after all terminal companions exist', () => {
    const result = evaluate(withTerminal());

    expect(result.completion).toBe('incomplete');
    expect(result.findings.map((finding) => finding.code)).toEqual(['pickedTargetMissing']);
    expect(result.findings[0]?.evidence).toEqual({ continuationKind: 'terminal' });
  });

  it('detects a newly required terminal companion without deleting retained state', () => {
    const oneExitComplete = completeFProject('F_Combat01');
    const expandedParent = applyProjectCommand(oneExitComplete, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(biome, combatId),
      gameName: 'F_Combat04',
    });
    const result = evaluate(expandedParent);

    expect(result.completion).toBe('incomplete');
    expect(
      result.findings.map((finding) => ({
        code: finding.code,
        origin: semanticAddressKey(finding.origin),
      })),
    ).toEqual([
      {
        code: 'targetMissing',
        origin: '["target","Underworld","F","f-combat",2]',
      },
    ]);
  });

  it('accepts a fully authored topology without making a validity claim', () => {
    const project = completeFProject();
    const result = evaluate(project);

    expect(result).toEqual({
      completion: 'complete',
      biomeState: {},
      topology: fPlan(project).topology,
      findings: [],
    });
    expect(result).not.toHaveProperty('validity');
    expect(result).not.toHaveProperty('snapshot');
    expect(Object.isFrozen(result)).toBe(true);
  });
});
