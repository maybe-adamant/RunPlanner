import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAdditionalExitAddress,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createPostbossKeepsakeSelectionAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  simulateProject,
  simulateProjectAssembly,
  zagreusContractCandidateForProjectEvaluationAssembly,
  type RunStateSnapshot,
} from '@run-planner/engine/simulation';
import { loadUnderworldZagreusContractCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
import {
  createFreshFileFProject,
  freshFileFBiome,
  freshFileFMidshopId,
  freshFileFPostbossId,
  withRetainedFreshFilePostboss,
} from '@run-planner/test-fixtures/fresh-file';

const biome = freshFileFBiome;
const midshop = freshFileFMidshopId;
const postboss = freshFileFPostbossId;
const freshFProject = createFreshFileFProject;

function snapshotsOf(project: ProjectDocument): readonly RunStateSnapshot[] {
  const result = simulateProject(catalog, project).route.biomes[0]!;
  return 'rewards' in result ? (result.rewards?.runStateSnapshots ?? []) : [];
}

describe('Fresh File retained content', () => {
  it('authors a complete valid Fresh File F with no Postboss Well, Pool or rack', () => {
    const project = freshFProject();
    const evaluation = simulateProject(catalog, project);
    expect(evaluation.findings).toEqual([]);
    const occurrence = project.route.biomes[0]!.topology!.occurrences.find(
      (candidate) => candidate.occurrenceId === postboss,
    )!;
    expect(occurrence.gameName).toBe('F_PostBoss01');
    expect(occurrence).not.toHaveProperty('stygianWell');
    expect(occurrence).not.toHaveProperty('purgingPool');
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplacePostbossKeepsake',
        selection: createPostbossKeepsakeSelectionAddress(createOccurrenceAddress(biome, postboss)),
        keepsakeKey: catalog.keepsakes.values[0]!.key,
      }),
    ).toThrow(/no Postboss rack/);
  });

  it('refuses the Zagreus contract door at the Fresh Midshop and admits it on a mature route', () => {
    const withDoor = authorLegalTraitOffers(
      applyProjectCommand(freshFProject(), catalog, {
        kind: 'AddZagreusContract',
        additional: createAdditionalExitAddress(biome, midshop, 'zagreusContract'),
        occurrenceId: createOccurrenceId('fresh-contract'),
      }),
    );
    const capability = zagreusContractCandidateForProjectEvaluationAssembly(
      simulateProjectAssembly(catalog, withDoor),
      createOccurrenceAddress(biome, midshop),
    );
    expect(capability).toMatchObject({
      placementEligible: false,
      failedConditions: ['sourceRequirement'],
    });
    expect(simulateProject(catalog, withDoor).findings).toContainEqual(
      expect.objectContaining({
        code: 'targetRoomUnavailable',
        evidence: expect.objectContaining({
          kind: 'zagreusContract',
          failedConditions: ['sourceRequirement'],
        }),
      }),
    );

    const mature = loadUnderworldZagreusContractCheckpoint();
    const matureShop = createOccurrenceAddress(
      createBiomeAddress('Underworld', 'G'),
      createOccurrenceId('golden-g-b5-e1'),
    );
    expect(
      zagreusContractCandidateForProjectEvaluationAssembly(
        simulateProjectAssembly(catalog, mature),
        matureShop,
      ),
    ).toMatchObject({ placementEligible: true, failedConditions: [] });
    expect(
      simulateProject(catalog, mature).findings.filter(
        (finding) => finding.evidence.kind === 'zagreusContract',
      ),
    ).toEqual([]);
  });

  it('reports a retained Postboss Well, rack and Pool on Fresh File and lets each be removed', () => {
    const keepsakeKey = catalog.keepsakes.values[0]!.key;
    const retained = withRetainedFreshFilePostboss(freshFProject(), {
      well: true,
      poolSaleTraitKey: 'ApolloWeaponBoon',
      rackKeepsakeKey: keepsakeKey,
    });
    const codesOf = (project: ProjectDocument) =>
      simulateProject(catalog, project).findings.map((finding) => [
        finding.code,
        finding.evidence.reason ?? null,
      ]);
    expect(codesOf(retained)).toEqual(
      expect.arrayContaining([
        ['stygianWellPlacementUnavailable', null],
        ['purgingPoolUnavailable', null],
      ]),
    );

    const owner = createOccurrenceAddress(biome, postboss);
    const withoutWell = applyProjectCommand(retained, catalog, {
      kind: 'RemoveStygianWell',
      occurrence: owner,
    });
    expect(codesOf(withoutWell)).not.toContainEqual(['stygianWellPlacementUnavailable', null]);
    const poolClosed = applyProjectCommand(withoutWell, catalog, {
      kind: 'SetPurgingPoolInteraction',
      occurrence: owner,
      interacted: false,
    });
    // The rack is reached once the earlier Postboss features are repaired.
    expect(codesOf(poolClosed)).toEqual([['keepsakeUnavailable', 'rackUnavailableOnRoute']]);
    for (const snapshot of snapshotsOf(poolClosed))
      expect(snapshot.keepsakes.currentKey).not.toBe(keepsakeKey);
    const repaired = applyProjectCommand(poolClosed, catalog, {
      kind: 'RemovePostbossKeepsake',
      selection: createPostbossKeepsakeSelectionAddress(owner),
    });
    expect(simulateProject(catalog, repaired).findings).toEqual([]);
  });

  it('reports an interacted Pool on Fresh File even without a sale', () => {
    const owner = createOccurrenceAddress(biome, postboss);
    const findings = simulateProject(
      catalog,
      withRetainedFreshFilePostboss(freshFProject(), { poolSaleTraitKey: null }),
    ).findings;
    expect(findings.map((finding) => finding.code)).toEqual(['purgingPoolUnavailable']);
    expect(JSON.stringify(findings[0]!.origin)).toContain('purgingPoolInventory');
    expect(JSON.stringify(findings[0]!.origin)).toContain(owner.occurrenceId);
  });
});
