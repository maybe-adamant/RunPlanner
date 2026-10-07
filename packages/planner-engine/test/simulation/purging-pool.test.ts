import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  semanticAddressKey,
  type EquippedTrait,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  assessPurgingPool,
  purgingPoolCandidateForProjectEvaluationAssembly,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { createCompleteFGProject } from '@run-planner/test-fixtures/underworld';
import { describe, expect, it } from 'vitest';
import type { PurgingPoolState } from '../../src/authored-project/model';
import { createPurgingPoolCandidateArtifacts } from '../../src/simulation/commerce/purging-pool';

function pool(
  left: string | null = null,
  middle: string | null = null,
  right: string | null = null,
): PurgingPoolState {
  return Object.freeze({
    interacted: true,
    traitKeyBySlot: Object.freeze({ left, middle, right }),
  });
}

function equipped(...entries: readonly (readonly [string, EquippedTrait['rarity']])[]) {
  return Object.freeze(
    Object.fromEntries(
      entries.map(([traitKey, rarity]) => [
        traitKey,
        Object.freeze({
          traitKey,
          giverKey: 'test',
          providerKind: 'olympian',
          sourceRole: 'test',
          ...(rarity === undefined ? {} : { rarity }),
        }),
      ]),
    ),
  ) as Readonly<Record<string, EquippedTrait>>;
}

const fPostboss = createOccurrenceAddress(
  createBiomeAddress('Underworld', 'F'),
  createOccurrenceId('golden-f-preboss-shop:postboss'),
);

function asConfiguredTailF(project: ProjectDocument): ProjectDocument {
  return Object.freeze({
    ...project,
    route: Object.freeze({
      ...project.route,
      biomes: Object.freeze(project.route.biomes.filter((biome) => biome.biomeKey === 'F')),
    }),
  });
}

function withFPoolInteraction(project: ProjectDocument): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'SetPurgingPoolInteraction',
    occurrence: fPostboss,
    interacted: true,
  });
}

describe('Purging Pool generation assessment', () => {
  it('publishes F Postboss once before sales at the configured tail and with G configured', () => {
    const withG = simulateProjectAssembly(catalog, withFPoolInteraction(createCompleteFGProject()));
    const configuredTail = simulateProjectAssembly(
      catalog,
      asConfiguredTailF(withFPoolInteraction(createCompleteFGProject())),
    );
    const candidates = [configuredTail, withG].map((assembly) =>
      purgingPoolCandidateForProjectEvaluationAssembly(assembly, fPostboss),
    );
    for (const assembly of [configuredTail, withG]) {
      const candidate = purgingPoolCandidateForProjectEvaluationAssembly(assembly, fPostboss);
      expect(candidate).toBeDefined();
      expect(candidate?.assessments.length).toBeGreaterThan(0);
    }
    expect(candidates[0]).toEqual(candidates[1]);
  });

  it('intersects candidates across divergent branch assessments without leaking branch-zero traits', () => {
    const branchZero = assessPurgingPool(
      catalog,
      pool(),
      equipped(['ApolloWeaponBoon', 'Common'], ['HermesWeaponBoon', 'Rare']),
    );
    const otherBranch = assessPurgingPool(catalog, pool(), equipped(['HermesWeaponBoon', 'Rare']));
    const poolOwner = createOccurrenceAddress(
      createBiomeAddress('Underworld', 'F'),
      createOccurrenceId('pool-divergent'),
    );
    const capability = createPurgingPoolCandidateArtifacts(
      new Map([[semanticAddressKey(poolOwner), Object.freeze([branchZero, otherBranch])]]),
    ).at(poolOwner);
    expect(capability?.assessments).toEqual([branchZero, otherBranch]);
    expect(capability?.candidateTraitKeysBySlot.left).toEqual(['HermesWeaponBoon']);
    expect(capability?.candidateTraitKeysBySlot.left).not.toContain('ApolloWeaponBoon');
  });

  it.each([
    [[], 0],
    [[['ApolloWeaponBoon', 'Common']], 1],
    [
      [
        ['ApolloWeaponBoon', 'Common'],
        ['HermesWeaponBoon', 'Rare'],
      ],
      2,
    ],
    [
      [
        ['ApolloWeaponBoon', 'Common'],
        ['HermesWeaponBoon', 'Rare'],
        ['AthenaProjectileBoon', 'Epic'],
        ['GoodStuffBoon', 'Duo'],
      ],
      3,
    ],
  ] as const)('requires min(3, eligible) at cardinality %s', (entries, expected) => {
    const assessment = assessPurgingPool(catalog, pool(), equipped(...entries));
    expect(assessment.requiredTraitCount).toBe(expected);
    expect(assessment.findings.map((finding) => [finding.code, finding.slotKey])).toEqual(
      (['left', 'middle', 'right'] as const)
        .slice(0, expected)
        .map((slotKey) => ['purgingPoolTraitMissing', slotKey]),
    );
  });

  it.each([
    ['left filled', pool('ApolloWeaponBoon'), ['middle']],
    ['right filled', pool(null, null, 'ApolloWeaponBoon'), ['left']],
    ['middle filled', pool(null, 'HermesWeaponBoon'), ['left']],
    ['both filled', pool('ApolloWeaponBoon', null, 'HermesWeaponBoon'), []],
  ] as const)(
    'marks only the first empty slot still needed with two eligible traits (%s)',
    (_case, state, expected) => {
      const assessment = assessPurgingPool(
        catalog,
        state,
        equipped(['ApolloWeaponBoon', 'Common'], ['HermesWeaponBoon', 'Rare']),
      );
      expect(
        assessment.findings
          .filter((finding) => finding.code === 'purgingPoolTraitMissing')
          .map((finding) => finding.slotKey),
      ).toEqual(expected);
    },
  );

  it('marks every empty slot still needed when three or more traits are eligible', () => {
    const assessment = assessPurgingPool(
      catalog,
      pool(null, 'HermesWeaponBoon'),
      equipped(
        ['ApolloWeaponBoon', 'Common'],
        ['HermesWeaponBoon', 'Rare'],
        ['AthenaProjectileBoon', 'Epic'],
        ['GoodStuffBoon', 'Duo'],
      ),
    );
    expect(assessment.findings).toEqual([
      expect.objectContaining({
        code: 'purgingPoolTraitMissing',
        slotKey: 'left',
        evidence: { requiredTraitCount: 3, resolvedCount: 1 },
      }),
      expect.objectContaining({ code: 'purgingPoolTraitMissing', slotKey: 'right' }),
    ]);
  });

  it('reports an overfilled Pool through its duplicate and ineligible slots while excluding selected siblings', () => {
    const assessment = assessPurgingPool(
      catalog,
      pool('ApolloWeaponBoon', 'ApolloWeaponBoon', 'HadesLifestealBoon'),
      equipped(['ApolloWeaponBoon', 'Common'], ['HermesWeaponBoon', 'Rare']),
    );
    expect(assessment.complete).toBe(false);
    expect(assessment.findings.map((finding) => finding.code)).toEqual([
      'purgingPoolTraitDuplicate',
      'purgingPoolTraitUnavailable',
    ]);
    expect(assessment.findings.map((finding) => finding.slotKey)).toEqual(['middle', 'right']);
    expect(assessment.candidateTraitKeysBySlot.left).toEqual(['HermesWeaponBoon']);
  });

  it('admits Duo, Hermes, and field-provider traits, but requires a runtime rarity for Hades', () => {
    const rarityless = assessPurgingPool(
      catalog,
      pool(),
      equipped(
        ['GoodStuffBoon', 'Duo'],
        ['HermesWeaponBoon', 'Rare'],
        ['AthenaProjectileBoon', 'Epic'],
        ['HadesLifestealBoon', undefined],
      ),
    );
    expect(rarityless.eligibleTraitKeys).toEqual([
      'AthenaProjectileBoon',
      'GoodStuffBoon',
      'HermesWeaponBoon',
    ]);
    const commonHades = assessPurgingPool(
      catalog,
      pool(),
      equipped(['HadesLifestealBoon', 'Common']),
    );
    expect(commonHades.eligibleTraitKeys).toEqual(['HadesLifestealBoon']);
  });

  it('treats null as unresolved only until the exact domain is exhausted and infers no reroll', () => {
    const unresolved = assessPurgingPool(
      catalog,
      pool(),
      equipped(['ApolloWeaponBoon', 'Common'], ['HermesWeaponBoon', 'Rare']),
    );
    expect(unresolved.candidateTraitKeysBySlot).toEqual({
      left: ['ApolloWeaponBoon', 'HermesWeaponBoon'],
      middle: ['ApolloWeaponBoon', 'HermesWeaponBoon'],
      right: ['ApolloWeaponBoon', 'HermesWeaponBoon'],
    });
    const exhausted = assessPurgingPool(
      catalog,
      pool('ApolloWeaponBoon'),
      equipped(['ApolloWeaponBoon', 'Common']),
    );
    expect(exhausted.complete).toBe(true);
    expect(exhausted.candidateTraitKeysBySlot.middle).toEqual([]);
    expect(exhausted.findings).toEqual([]);
  });
});
