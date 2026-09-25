import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createFountainRarityOutcomeAddress,
  createHubDecisionAddress,
  createHubFountainAddress,
  createRouteStartKeepsakeSelectionAddress,
  hubVisitSlotKeys,
  semanticAddressKey,
  type HubDecision,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  simulateProject,
  simulateProjectAssembly,
  type ProjectBiomeEvaluation,
} from '@run-planner/engine/simulation';
import { hubVisitActions } from '@run-planner/test-fixtures/shared';
import {
  loadSurfaceNProject,
  nBiome,
  nOccurrenceId,
  nVisitSlotKeys,
} from '@run-planner/test-fixtures/surface';
import type { CanonicalHubDecision } from '../../../../src/simulation/materialization';
import type { HistoryEvent } from '../../../../src/simulation/history';

const hub = createHubDecisionAddress(nBiome, 'hub');
const fountain = createHubFountainAddress(nBiome, 'hub');
const outcome = createFountainRarityOutcomeAddress(fountain);

function withPhial(project: ProjectDocument = loadSurfaceNProject()): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceStartingKeepsake',
    selection: createRouteStartKeepsakeSelectionAddress('Surface'),
    keepsakeKey: 'FountainRarityKeepsake',
  });
}

function withFountainAfter(project: ProjectDocument, visits: number | null): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceHubActionOrder',
    hub,
    actions: hubVisitActions(nVisitSlotKeys, visits),
  });
}

function withTarget(project: ProjectDocument, targetTraitKey: string | null): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceFountainRarityTarget',
    outcome,
    targetTraitKey,
  });
}

type AssessedBiome = Extract<ProjectBiomeEvaluation, { readonly rewards: unknown }>;

function nEvaluation(project: ProjectDocument): AssessedBiome {
  const n = simulateProject(catalog, project).route.biomes.find(
    (biome) => biome.origin.biomeKey === 'N',
  );
  if (n === undefined || !('rewards' in n)) throw new Error('assessed N evaluation is required');
  return n;
}

function authoredHub(project: ProjectDocument): HubDecision {
  const decision = project.route.biomes
    .find((biome) => biome.biomeKey === 'N')
    ?.topology?.decisions.find((candidate) => candidate.kind === 'hub');
  if (decision?.kind !== 'hub') throw new Error('N Hub decision is required');
  return decision;
}

function events(n: AssessedBiome): readonly HistoryEvent[] {
  return n.history.events as readonly HistoryEvent[];
}

function fountainSequence(n: AssessedBiome): number | undefined {
  return events(n).find(
    (event) => event.kind === 'fountainUsed' && event.owner.kind === 'hubFountain',
  )?.sequence;
}

function entrySequence(n: AssessedBiome, slotKey: string): number | undefined {
  const occurrenceId = nOccurrenceId(slotKey);
  return events(n).find(
    (event) =>
      event.kind === 'roomEntered' &&
      event.origin.kind === 'occurrence' &&
      event.origin.occurrenceId === occurrenceId,
  )?.sequence;
}

function entryRarity(n: AssessedBiome, slotKey: string, traitKey: string) {
  const occurrenceId = nOccurrenceId(slotKey);
  return n.rewards.runStateSnapshots.find(
    (snapshot) =>
      snapshot.owner.kind === 'roomRunStateCheckpoint' &&
      snapshot.owner.occurrenceId === occurrenceId &&
      snapshot.owner.checkpoint.kind === 'roomEntered',
  )?.traits.equippedTraits[traitKey]?.rarity;
}

function assessedHub(n: AssessedBiome): CanonicalHubDecision | undefined {
  const prefix =
    'assessmentPrefix' in n && n.assessmentPrefix !== undefined
      ? n.assessmentPrefix
      : 'materializedPrefix' in n
        ? n.materializedPrefix
        : n.snapshot;
  return prefix.decisions.find(
    (decision): decision is CanonicalHubDecision => decision.kind === 'hub',
  );
}

describe('Hub fountain settlement', () => {
  it.each([
    [0, undefined, nVisitSlotKeys[0]],
    [3, nVisitSlotKeys[2], nVisitSlotKeys[3]],
    [6, nVisitSlotKeys[5], undefined],
  ] as const)(
    'settles a fountain use after %i visits in the Hub before the next entry',
    (visits, previous, next) => {
      const n = nEvaluation(withTarget(withFountainAfter(withPhial(), visits), 'ApolloWeaponBoon'));
      if (n.authoring !== 'complete' || n.validity !== 'valid')
        throw new Error(`expected a valid N: ${JSON.stringify(n.findings)}`);
      const used = fountainSequence(n)!;
      const hubReturns = events(n).filter(
        (event) =>
          event.kind === 'roomRestored' && event.restoreKind === 'hub' && event.sequence < used,
      );
      expect(hubReturns).toHaveLength(visits);
      if (previous !== undefined) expect(entrySequence(n, previous)!).toBeLessThan(used);
      if (next !== undefined) {
        expect(entrySequence(n, next)!).toBeGreaterThan(used);
        expect(entryRarity(n, next, 'ApolloWeaponBoon')).toBe('Heroic');
      }
      if (previous !== undefined)
        expect(entryRarity(n, previous, 'ApolloWeaponBoon')).toBe('Common');
      const preboss = events(n).find(
        (event) => event.kind === 'roomCreated' && event.gameName === 'N_PreBoss01',
      );
      expect(preboss!.sequence).toBeGreaterThan(used);
      expect(n.rewards.branches.every((branch) => branch.state.keepsakes.phial)).toBe(true);
      expect(n.rewards.branches[0]?.state.keepsakes.phial).toEqual({ status: 'consumed' });
    },
  );

  it('settles without a target or finding when no Phial is equipped', () => {
    const n = nEvaluation(withFountainAfter(loadSurfaceNProject(), 2));
    if (n.authoring !== 'complete' || n.validity !== 'valid')
      throw new Error('expected a valid N without Phial');
    expect(fountainSequence(n)).toBeGreaterThan(entrySequence(n, nVisitSlotKeys[1])!);
    expect(n.findings).toEqual([]);
    expect(entryRarity(n, nVisitSlotKeys[2], 'ApolloWeaponBoon')).toBe('Common');
  });

  it('adds one Hub event without regenerating the board or advancing counters', () => {
    const before = nEvaluation(withFountainAfter(loadSurfaceNProject(), 0));
    const after = nEvaluation(withFountainAfter(loadSurfaceNProject(), 4));
    for (const n of [before, after]) {
      const hubEvents = events(n).filter(
        (event) => 'origin' in event && event.origin.kind === 'hubRoom',
      );
      expect(hubEvents.filter((event) => event.kind === 'roomEntered')).toHaveLength(1);
      expect(hubEvents.filter((event) => event.kind === 'fountainUsed')).toHaveLength(1);
      expect(
        events(n).filter((event) => event.kind === 'roomCreated' && event.source === 'hubTarget'),
      ).toHaveLength(9);
    }
    expect(after.history.ledgers.counters).toEqual(before.history.ledgers.counters);
    const appearances = (n: AssessedBiome) =>
      n.history.ledgers.roomAppearances.map(({ sequence, ...appearance }) => {
        void sequence;
        return appearance;
      });
    expect(appearances(after)).toEqual(appearances(before));
  });

  it('keeps side-room excursions inside their visit before a following fountain use', () => {
    const project = loadSurfaceNProject();
    const materialized = nEvaluation(project);
    const visit = assessedHub(materialized)?.visits.find(
      (candidate) => candidate.enteredLocalRooms.length > 0,
    );
    if (visit === undefined) throw new Error('Surface N needs a visit with side-room entries');
    const n = nEvaluation(withFountainAfter(project, visit.visitIndex));
    const used = fountainSequence(n)!;
    const hubReturn = events(n).find(
      (event) =>
        event.kind === 'roomRestored' &&
        event.restoreKind === 'hub' &&
        semanticAddressKey(event.after) === semanticAddressKey(visit.origin),
    );
    const parentReturns = events(n).filter(
      (event) =>
        event.kind === 'roomRestored' &&
        event.restoreKind === 'parent' &&
        event.origin.kind === 'occurrence' &&
        event.origin.occurrenceId === visit.target.room.occurrenceId,
    );
    expect(parentReturns.length).toBeGreaterThan(0);
    expect(parentReturns.every((event) => event.sequence < hubReturn!.sequence)).toBe(true);
    expect(hubReturn!.sequence).toBe(used - 1);
  });

  it('blocks at the Hub outcome for a missing target and retains earlier visits', () => {
    const project = withFountainAfter(withPhial(), 3);
    const n = nEvaluation(project);
    const missing = n.findings.find((finding) => finding.code === 'fountainRarityResultMissing');
    expect(missing?.origin).toEqual(outcome);
    expect(n.issue?.owner).toEqual(outcome);
    const retained = assessedHub(n);
    expect(retained?.visits.map((visit) => visit.target.hubSlotKey)).toEqual(
      nVisitSlotKeys.slice(0, 3),
    );
    expect(retained?.fountain).toBeUndefined();
    if (!('assessmentPrefix' in n)) throw new Error('blocked N needs an assessment prefix');
    expect(n.assessmentPrefix?.frontier).toEqual({ kind: 'hubFountain', origin: fountain });
    expect(entrySequence(n, nVisitSlotKeys[3])).toBeUndefined();

    const candidate = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    ).evaluate({ kind: 'fountainRarityOutcome', outcome, targetTraitKey: 'HermesWeaponBoon' });
    expect(candidate).toMatchObject({
      kind: 'fountainRarityOutcome',
      result: { targetRequired: true, selectedPossible: true },
    });
  });

  it('reassesses a retained target at its new position instead of replacing it', () => {
    const valid = withTarget(withFountainAfter(withPhial(), 3), 'HermesWeaponBoon');
    expect(nEvaluation(valid).findings).toEqual([]);
    const moved = withFountainAfter(valid, 0);
    expect(authoredHub(moved).fountainRarityResult).toEqual({ targetTraitKey: 'HermesWeaponBoon' });
    const n = nEvaluation(moved);
    expect(n.findings).toContainEqual(
      expect.objectContaining({
        code: 'fountainRarityResultUnavailable',
        origin: outcome,
        evidence: expect.objectContaining({ targetTraitKey: 'HermesWeaponBoon' }),
      }),
    );
    expect(assessedHub(n)?.visits).toEqual([]);
  });

  it('claims Hub fountain findings as action-order candidate evidence', () => {
    const moved = withTarget(withFountainAfter(withPhial(), 3), 'HermesWeaponBoon');
    const candidates = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, moved),
    );
    expect(
      candidates.evaluate({
        kind: 'hubActionOrder',
        hub,
        actions: hubVisitActions(nVisitSlotKeys, 0),
      }),
    ).toMatchObject({
      kind: 'hubActionOrder',
      result: {
        findings: [
          expect.objectContaining({
            code: 'fountainRarityResultUnavailable',
            origin: outcome,
            evidence: expect.objectContaining({ targetTraitKey: 'HermesWeaponBoon' }),
          }),
        ],
      },
    });
  });

  it('keeps a six-visit handoff and downstream rooms while an unplanned fountain stops assessment', () => {
    const project = withFountainAfter(loadSurfaceNProject(), null);
    const topology = project.route.biomes.find((biome) => biome.biomeKey === 'N')?.topology;
    expect(
      topology?.decisions.some(
        (decision) => decision.kind === 'exit' && decision.source.kind === 'hubDecision',
      ),
    ).toBe(true);
    expect(topology?.occurrences.some((occurrence) => occurrence.gameName === 'N_Boss01')).toBe(
      true,
    );
    const n = nEvaluation(project);
    expect(n.authoring).toBe('incomplete');
    expect(n.findings).toContainEqual({
      code: 'hubVisitOrderIncomplete',
      severity: 'error',
      phase: expect.any(String),
      origin: fountain,
      evidence: { actualCount: 6, requiredCount: 6, fountainUsed: false },
    });
    if (!('materializedPrefix' in n)) throw new Error('incomplete N needs a prefix');
    expect(n.materializedPrefix.frontier).toEqual({ kind: 'hubFountain', origin: fountain });
    expect(assessedHub(n)?.visits).toHaveLength(6);
    expect(fountainSequence(n)).toBeUndefined();
  });

  it('reports one combined requirement for an incomplete room order', () => {
    const project = applyProjectCommand(loadSurfaceNProject(), catalog, {
      kind: 'ReplaceHubActionOrder',
      hub,
      actions: hubVisitActions(nVisitSlotKeys.slice(0, 4), null),
    });
    expect(nEvaluation(project).findings).toContainEqual(
      expect.objectContaining({
        code: 'hubVisitOrderIncomplete',
        origin: expect.objectContaining({ kind: 'hubVisit', visitIndex: 5 }),
        evidence: { actualCount: 4, requiredCount: 6, fountainUsed: false },
      }),
    );
  });

  it('never gives new, reset, or empty Hubs an implicit fountain use', () => {
    const reset = applyProjectCommand(loadSurfaceNProject(), catalog, {
      kind: 'ResetHubBoard',
      hub,
    });
    expect(authoredHub(reset).actions).toEqual([]);
    const cleared = withFountainAfter(loadSurfaceNProject(), null);
    const emptied = applyProjectCommand(cleared, catalog, {
      kind: 'ReplaceHubActionOrder',
      hub,
      actions: [],
    });
    for (const project of [reset, emptied]) {
      const n = nEvaluation(project);
      expect(fountainSequence(n)).toBeUndefined();
      expect(hubVisitSlotKeys(authoredHub(project))).toEqual([]);
    }
  });
});
