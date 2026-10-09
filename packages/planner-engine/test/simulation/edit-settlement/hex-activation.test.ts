import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import { loadSurfaceOrdinaryHexPathCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import { pBiome, pOccurrenceId } from '@run-planner/test-fixtures/surface';
import {
  applyProjectCommand,
  createAcquisitionRoleAddress,
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createProjectDocument,
  createRouteAddress,
  createStartingRewardAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  type ProjectCommand,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  acquisitionConversionCandidateForProjectEvaluationAssembly,
  settleProjectEdit,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';

const reward = createIncomingRewardAddress(pBiome, pOccurrenceId('P_Combat07', 4, 1));
const screen = createAcquisitionRoleAddress(reward, 'self');
const evaluate = (project: ProjectDocument) => simulateProjectAssembly(catalog, project);
const settle = (project: ProjectDocument, command: ProjectCommand) =>
  settleProjectEdit({ catalog, before: evaluate(project), command, evaluate }).assembly;
function pathSelection(project: ProjectDocument): readonly string[] | undefined {
  const state = project.route.biomes
    .find((biome) => biome.biomeKey === 'P')!
    .topology!.occurrences.find(
      (occurrence) => occurrence.occurrenceId === reward.occurrenceId,
    )!.state;
  return 'reward' in state
    ? state.reward?.hexActivationsByAcquisitionRole?.self?.selectedNodeKeys
    : undefined;
}

describe('Path of Stars screen selections', () => {
  it('publishes the reached screen domain', () => {
    const capability = acquisitionConversionCandidateForProjectEvaluationAssembly(
      evaluate(loadSurfaceOrdinaryHexPathCheckpoint()),
      screen,
    )?.hexActivation;
    expect(capability).toMatchObject({
      layoutKey: 'Lung',
      count: 3,
      investedNodeKeys: [],
      godSentAdded: false,
    });
    expect(capability?.availableNodeKeys(['1:2'])).toEqual(['1:4', '2:2']);
    expect(capability?.assess(['1:2', '3:5'])).toEqual([
      { kind: 'selectionCount', expected: 3, actual: 2 },
      { kind: 'unreachable', nodeKey: '3:5' },
    ]);
  });

  it('leaves a newly reached screen to its author and keeps a conflicting selection', () => {
    const saved = loadSurfaceOrdinaryHexPathCheckpoint();
    const mana = settle(saved, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: { rewardType: 'MaxManaDrop' },
    });
    expect(pathSelection(mana.project)).toBeUndefined();
    const big = settle(mana.project, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: { rewardType: 'TalentDrop' },
    });
    expect(pathSelection(big.project)).toBeUndefined();
    expect(
      big.evaluation.findings.map((finding) => [finding.code, finding.origin, finding.evidence]),
    ).toEqual([['hexActivationMissing', screen, { count: 3 }]]);
    const chosen = settle(big.project, {
      kind: 'ReplaceHexActivation',
      acquisition: screen,
      value: { selectedNodeKeys: ['1:2', '1:4', '2:2'] },
    });
    expect(chosen.evaluation.findings).toEqual([]);

    const conflicting = settle(chosen.project, {
      kind: 'ReplaceHexActivation',
      acquisition: screen,
      value: { selectedNodeKeys: ['1:2', '3:5'] },
    });
    expect(pathSelection(conflicting.project)).toEqual(['1:2', '3:5']);
    expect(
      conflicting.evaluation.findings.map((finding) => [
        finding.code,
        finding.origin,
        finding.evidence.nodeKeys,
      ]),
    ).toEqual([['hexActivationUnavailable', screen, ['3:5']]]);
  });

  it('accepts a selection only on a Path screen role, as a set of nodes', () => {
    const saved = loadSurfaceOrdinaryHexPathCheckpoint();
    expect(() =>
      applyProjectCommand(saved, catalog, {
        kind: 'ReplaceHexActivation',
        acquisition: screen,
        value: { selectedNodeKeys: ['1:2', '1:2', '1:4'] },
      }),
    ).toThrow(/distinct nodes/);
    expect(() =>
      applyProjectCommand(saved, catalog, {
        kind: 'ReplaceHexActivation',
        acquisition: screen,
        value: { selectedNodeKeys: ['Omen'] },
      }),
    ).toThrow(/depth:slot/);
    const reordered = (selectedNodeKeys: readonly string[], project = saved) =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceHexActivation',
        acquisition: screen,
        value: { selectedNodeKeys },
      });
    const ordered = reordered(['2:4', '1:4', '1:2']);
    expect(pathSelection(ordered)).toEqual(['1:2', '1:4', '2:4']);
    expect(reordered(['1:4', '2:4', '1:2'], ordered)).toBe(ordered);
    const mana = applyProjectCommand(saved, catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: { rewardType: 'MaxManaDrop' },
    });
    expect(() =>
      applyProjectCommand(mana, catalog, {
        kind: 'ReplaceHexActivation',
        acquisition: screen,
        value: { selectedNodeKeys: ['1:2'] },
      }),
    ).toThrow(/does not open a Path screen/);
  });

  it('authors and round-trips the Selene Spell Drop screen of a route starting reward', () => {
    const biome = createBiomeAddress('Underworld', 'F');
    const occurrenceId = createOccurrenceId('F:start');
    let project = createProjectDocument(catalog, {
      projectId: 'selene-start',
      routeKey: 'Underworld',
      configuredBiomeCount: 1,
    });
    for (const command of [
      { kind: 'CreateStart', biome, occurrenceId, gameName: 'F_Opening01' },
      {
        kind: 'ReplaceRouteLoadout',
        route: createRouteAddress('Underworld'),
        weaponKey: 'WeaponSuit',
        aspectKey: 'SuitHexAspect',
      },
    ] as const)
      project = applyProjectCommand(project, catalog, command);
    const settled = settleProjectEdit({
      catalog,
      before: evaluate(project),
      command: {
        kind: 'ReplaceStartingReward',
        reward: createStartingRewardAddress('Underworld'),
        value: { rewardType: 'SpellDrop' },
      },
      evaluate,
    }).assembly.project;
    const start = createAcquisitionRoleAddress(
      createIncomingRewardAddress(biome, occurrenceId),
      'self',
    );
    const selection = (document: ProjectDocument) =>
      document.route.biomes[0]!.topology!.occurrences[0]!.startingRewardAcquisition
        ?.hexActivationsByAcquisitionRole?.self?.selectedNodeKeys;
    expect(selection(settled)).toBeUndefined();
    const capability = acquisitionConversionCandidateForProjectEvaluationAssembly(
      evaluate(settled),
      start,
    )?.hexActivation;
    expect(capability).toMatchObject({ count: 3, investedNodeKeys: [] });
    const edited = applyProjectCommand(settled, catalog, {
      kind: 'ReplaceHexActivation',
      acquisition: start,
      value: { selectedNodeKeys: ['1:2', '1:4'] },
    });
    expect(selection(edited)).toEqual(['1:2', '1:4']);
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(edited)), catalog)).toEqual(
      edited,
    );
  });

  it('leaves a Sea Star duplicate of a Path grant to open its own screen', () => {
    const procced = applyProjectCommand(loadSurfaceOrdinaryHexPathCheckpoint(), catalog, {
      kind: 'ReplaceSeaStarResult',
      acquisition: screen,
      procced: true,
    });
    const occurrence = procced.route.biomes
      .find((biome) => biome.biomeKey === 'P')!
      .topology!.occurrences.find((candidate) => candidate.occurrenceId === reward.occurrenceId)!;
    const duplicate = Object.values(occurrence.acquisitionSites ?? {}).flatMap((site) =>
      Object.values(site.pickupEntries ?? {}),
    )[0];
    expect(duplicate?.offer).toEqual({ rewardType: 'TalentDrop' });
    expect(duplicate?.hexActivationsByAcquisitionRole).toBeUndefined();
    expect(pathSelection(procced)).toHaveLength(3);
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(procced)), catalog)).toEqual(
      procced,
    );
  });
});
