import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createExitDecisionAddress,
  createFountainRarityOutcomeAddress,
  createOccurrenceAddress,
  createRoomActionAddress,
  createRouteStartKeepsakeSelectionAddress,
  roomActionKey,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
import {
  createCompleteFGProject,
  goldenFBiome,
  goldenFOccurrenceId,
} from '@run-planner/test-fixtures/underworld';

const reprieveId = goldenFOccurrenceId(5, 1);
const outcome = createFountainRarityOutcomeAddress(
  createRoomActionAddress(goldenFBiome, reprieveId, roomActionKey({ kind: 'useFountain' })),
);

function phialReprieveProject(): ProjectDocument {
  let project = applyProjectCommand(createCompleteFGProject(), catalog, {
    kind: 'ReplaceOccurrenceRoom',
    occurrence: createOccurrenceAddress(goldenFBiome, reprieveId),
    gameName: 'F_Reprieve01',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceStartingKeepsake',
    selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
    keepsakeKey: 'FountainRarityKeepsake',
  });
  return authorLegalTraitOffers(project);
}

function incomplete(project: ProjectDocument): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'RemoveExitDecision',
    decision: createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFOccurrenceId(9, 1),
    }),
  });
}

/** An earlier generation error: a miniboss is not a legal second-batch room. */
function withEarlierBlocker(project: ProjectDocument): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceOccurrenceRoom',
    occurrence: createOccurrenceAddress(goldenFBiome, goldenFOccurrenceId(2, 1)),
    gameName: 'F_MiniBoss02',
  });
}

function fEvaluation(project: ProjectDocument) {
  const f = simulateProjectAssembly(catalog, project).evaluation.route.biomes.find(
    (biome) => biome.biomeKey === 'F',
  );
  if (f === undefined) throw new Error('F evaluation is required');
  return f;
}

function candidate(project: ProjectDocument) {
  return createPreparedProjectCandidateSession(
    catalog,
    simulateProjectAssembly(catalog, project),
  ).evaluate({ kind: 'fountainRarityOutcome', outcome, targetTraitKey: undefined });
}

describe('fountain-rarity candidate artifact horizon', () => {
  it('offers the targets of a reached room fountain in an incomplete biome', () => {
    const project = incomplete(phialReprieveProject());
    expect(fEvaluation(project).authoring).toBe('incomplete');
    expect(candidate(project)).toMatchObject({
      kind: 'fountainRarityOutcome',
      result: { status: 'pending', targetRequired: true, mutationTargetKeys: expect.any(Array) },
    });
  });

  it.each([
    ['an incomplete', (project: ProjectDocument) => incomplete(project), 'incomplete'],
    ['a complete-invalid', (project: ProjectDocument) => project, 'complete'],
  ] as const)(
    'withholds a room fountain behind an earlier blocker in %s biome',
    (_label, shape, authoring) => {
      const project = shape(withEarlierBlocker(phialReprieveProject()));
      const f = fEvaluation(project);
      expect(f.authoring).toBe(authoring);
      expect(f.issue).toBeDefined();
      expect(semanticAddressKey(f.issue!.owner)).not.toBe(semanticAddressKey(outcome));
      expect(candidate(project)).toMatchObject({
        kind: 'unavailable',
        reason: 'coverageNotReached',
      });
    },
  );
});
