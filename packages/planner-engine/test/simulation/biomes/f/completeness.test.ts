import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createExitSelectionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createTargetAddress,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  CompletenessContractError,
  evaluateBiomeCompleteness,
  evaluateOccurrenceOutgoingStatus,
} from '@run-planner/engine/simulation';

import {
  createFCombatBatch,
  createFCombatTarget,
  createFOpeningBatch,
  createFOpeningTarget,
  createFProject,
  createFStart,
  fBiome,
  fCombatId,
  fDecision,
  selectFCombatExit,
} from '../../support/f-takeover-project';

function fPlan(project: ProjectDocument) {
  const plan = project.routes
    .find((route) => route.routeKey === 'Underworld')
    ?.biomes.find((biome) => biome.biomeKey === 'F');
  if (plan === undefined) throw new Error('missing F takeover plan');
  return plan;
}

function evaluate(project: ProjectDocument) {
  return evaluateBiomeCompleteness(catalog, fBiome, fPlan(project));
}

function findingKeys(project: ProjectDocument): readonly string[] {
  return evaluate(project).findings.map(
    (finding) => `${finding.code}:${semanticAddressKey(finding.origin)}`,
  );
}

describe('F takeover completeness', () => {
  it('publishes closed occurrence-local outgoing states without borrowing a global frontier', () => {
    const startProject = createFStart();
    const startPlan = fPlan(startProject);
    const startCompleteness = evaluateBiomeCompleteness(catalog, fBiome, startPlan);
    expect(
      evaluateOccurrenceOutgoingStatus({
        biome: fBiome,
        catalog,
        completeness: startCompleteness,
        findings: startCompleteness.findings,
        occurrenceId: startPlan.topology!.startOccurrenceId,
        plan: startPlan,
      }),
    ).toMatchObject({
      kind: 'frontier',
      capability: 'createBatch',
      owner: fDecision(),
    });

    const authoredProject = createFOpeningTarget();
    const authoredPlan = fPlan(authoredProject);
    const authoredCompleteness = evaluateBiomeCompleteness(catalog, fBiome, authoredPlan);
    expect(
      evaluateOccurrenceOutgoingStatus({
        biome: fBiome,
        catalog,
        completeness: authoredCompleteness,
        findings: authoredCompleteness.findings,
        occurrenceId: authoredPlan.topology!.startOccurrenceId,
        plan: authoredPlan,
      }),
    ).toMatchObject({ kind: 'authoredDecision', owner: fDecision() });
    expect(
      evaluateOccurrenceOutgoingStatus({
        biome: fBiome,
        catalog,
        completeness: authoredCompleteness,
        findings: authoredCompleteness.findings,
        occurrenceId: fCombatId,
        plan: authoredPlan,
      }),
    ).toMatchObject({ kind: 'frontier', owner: fDecision(fCombatId) });
  });

  it('rejects evaluation outside the declared F route placement', () => {
    expect(() =>
      evaluateBiomeCompleteness(catalog, createBiomeAddress('Surface', 'F'), fPlan(createFStart())),
    ).toThrowError(new CompletenessContractError('Surface does not place biome F'));
  });

  it('reports an unstarted biome without inventing a start occurrence', () => {
    const result = evaluate(createFProject());

    expect(result).toMatchObject({
      completion: 'incomplete',
      frontier: fBiome,
      findings: [{ code: 'biomeTopologyMissing', origin: fBiome }],
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.findings)).toBe(true);
  });

  it('keeps a missing exit decision distinct from an unresolved batch', () => {
    expect(findingKeys(createFStart())).toEqual([
      `continuationMissing:${semanticAddressKey(fDecision())}`,
    ]);
  });

  it('installs the declaration-owned batch store when target creation makes it active', () => {
    const project = createFOpeningTarget(createFOpeningBatch(createFStart(), undefined));
    const result = evaluate(project);

    expect(result).toMatchObject({
      completion: 'incomplete',
      frontier: fDecision(fCombatId),
      findings: [{ code: 'continuationMissing', origin: fDecision(fCombatId) }],
    });
    const openingSource = fDecision().source;
    if (openingSource.kind !== 'occurrence') throw new Error('F opening must be occurrence-owned');
    const batch = fPlan(project).topology?.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.source.kind === 'occurrence' &&
        decision.source.occurrenceId === openingSource.occurrenceId,
    );
    expect(batch).toMatchObject({
      kind: 'exit',
      normal: { kind: 'batch', rewardStore: { baseRewardStoreKey: 'MetaProgress' } },
    });
  });

  it('addresses the declaration-owned missing physical target', () => {
    const project = createFOpeningBatch();

    expect(findingKeys(project)).toEqual([
      `targetMissing:${semanticAddressKey(createTargetAddress(fBiome, fDecision().source, 'exit1'))}`,
    ]);
  });

  it('continues through the derived one-door opening and stops at the combat decision', () => {
    const result = evaluate(createFOpeningTarget());

    expect(result).toMatchObject({
      completion: 'incomplete',
      frontier: fDecision(fCombatId),
      findings: [{ code: 'continuationMissing', origin: fDecision(fCombatId) }],
    });
  });

  it('rejects partial takeover creation instead of persisting a mixed Preboss batch', () => {
    expect(() =>
      createFCombatTarget(createFCombatBatch(), 'exit1', 'f-takeover-preboss-shop', 'F_PreBoss01'),
    ).toThrow(/atomic takeover batch command/);
  });

  it('keeps an unresolved physical selection separate from atomic target presence', () => {
    let project = createFOpeningTarget();
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTakeoverBatch',
      decision: fDecision(fCombatId),
      gameName: 'F_PreBoss01',
      targetOccurrenceIds: {
        exit1: createOccurrenceId('f-takeover-preboss-shop'),
        exit2: createOccurrenceId('f-takeover-preboss-free'),
      },
    });

    const selection = createExitSelectionAddress(fBiome, fDecision(fCombatId).source);
    expect(findingKeys(project)).toEqual([`pickedTargetMissing:${semanticAddressKey(selection)}`]);
  });

  it('retains compatible authored targets when source replacement adds a physical exit', () => {
    let project = createFOpeningTarget(undefined, 'F_Combat01');
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTakeoverBatch',
      decision: fDecision(fCombatId),
      gameName: 'F_PreBoss01',
      targetOccurrenceIds: { exit1: createOccurrenceId('f-takeover-preboss') },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(fBiome, fCombatId),
      gameName: 'F_Combat02',
    });

    expect(findingKeys(project)).toEqual([
      `targetMissing:${semanticAddressKey(
        createTargetAddress(fBiome, fDecision(fCombatId).source, 'exit2'),
      )}`,
    ]);
    expect(
      fPlan(project).topology?.occurrences.map((occurrence) => occurrence.occurrenceId),
    ).toContain('f-takeover-preboss');
  });

  it('accepts a closed selected spine without making a legality claim', () => {
    let project = createFOpeningTarget();
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTakeoverBatch',
      decision: fDecision(fCombatId),
      gameName: 'F_PreBoss01',
      targetOccurrenceIds: {
        exit1: createOccurrenceId('f-takeover-complete-shop'),
        exit2: createOccurrenceId('f-takeover-complete-free'),
      },
    });
    project = selectFCombatExit(project, 'exit1');

    expect(evaluate(project)).toMatchObject({ completion: 'complete', findings: [] });
  });
});
