import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createBiomeAddress,
  createExitDecisionAddress,
  createOccurrenceId,
  createProjectDocument,
  createTargetAddress,
  createProjectHistory,
  decodeProjectDocument,
  encodeProjectDocument,
  resolveCompletionBoss,
  undoProjectHistory,
} from '@run-planner/engine/authored-project';
import { loadUnderworldFGProject } from '@run-planner/test-fixtures/underworld';

describe('completion Boss variants', () => {
  it.each([
    [0, ['F_Boss01', 'G_Boss01', 'H_Boss01', 'I_Boss01']],
    [1, ['F_Boss02', 'G_Boss01', 'H_Boss01', 'I_Boss01']],
    [2, ['F_Boss02', 'G_Boss02', 'H_Boss01', 'I_Boss01']],
    [3, ['F_Boss02', 'G_Boss02', 'H_Boss02', 'I_Boss01']],
    [4, ['F_Boss02', 'G_Boss02', 'H_Boss02', 'I_Boss01']],
  ] as const)('resolves rank %s against route position and single-variant I', (rank, expected) => {
    expect(
      ['F', 'G', 'H', 'I'].map(
        (biome) => resolveCompletionBoss(catalog, 'Underworld', biome, rank).gameName,
      ),
    ).toEqual(expected);
  });

  it('rewrites existing fixed Bosses atomically and undo restores their stable links', () => {
    const unseeded = loadUnderworldFGProject();
    const initialFTopology = unseeded.route!.biomes[0]!.topology!;
    const initialBoss = initialFTopology.occurrences.find((room) => room.gameName === 'F_Boss01')!;
    // Pickaxe is declaration-supported by both F Boss variants. Bosses have no mutable local
    // authored leaf beyond their fixed encounter declaration, so do not fabricate one here.
    const initial = applyProjectCommand(unseeded, catalog, {
      kind: 'ReplaceResourcePlacement',
      route: { kind: 'route', routeKey: 'Underworld' },
      family: 'Pickaxe',
      value: { biomeKey: 'F', occurrenceId: initialBoss.occurrenceId },
    });
    const fTopology = initial.route!.biomes[0]!.topology!;
    const fBoss = fTopology.occurrences.find((room) => room.gameName === 'F_Boss01')!;
    const prebossLink = fTopology.fixedRoomLinks.find(
      (link) => link.targetOccurrenceId === fBoss.occurrenceId,
    )!;
    expect(fBoss.occurrenceId).toBe(`${prebossLink.sourceOccurrenceId}:boss`);
    const history = createProjectHistory(initial);
    const raised = applyProjectHistoryCommand(history, catalog, {
      kind: 'ReplaceFearVowRank',
      route: { kind: 'route', routeKey: 'Underworld' },
      vowKey: 'BossDifficultyShrineUpgrade',
      rank: 2,
    });
    const raisedF = raised.present.route!.biomes[0]!.topology!;
    const raisedG = raised.present.route!.biomes[1]!.topology!;
    expect(
      raisedF.occurrences.find((room) => room.occurrenceId === fBoss.occurrenceId),
    ).toMatchObject({ gameName: 'F_Boss02' });
    // Fixed encounters deliberately persist no authored selection; the declaration now owns BossScylla02.
    expect(
      raisedG.occurrences.find((room) => room.gameName === 'G_Boss02')?.encounters
        .encounterKeyByPhase,
    ).toEqual({});
    expect(raisedF.fixedRoomLinks).toEqual(fTopology.fixedRoomLinks);
    expect(raised.present.route!.resourcePlacements.Pickaxe).toEqual({
      biomeKey: 'F',
      occurrenceId: fBoss.occurrenceId,
    });
    const lowered = undoProjectHistory(raised);
    expect(lowered.present).toBe(initial);
  });

  it('keeps the route-selected Tartarus Preboss out of alternative selection', () => {
    const project = loadUnderworldFGProject();
    expect(
      project.route!.biomes.map((biome) =>
        biome.topology?.occurrences.filter((room) => room.gameName === 'I_PreBoss01'),
      ),
    ).toEqual([[], []]);
    expect(catalog.routes.byKey.Underworld?.prebossRoomGameNames.at(3)).toBe('I_PreBoss02');
  });

  it('uses the future Dream route mapping as the sole I Preboss candidate identity', () => {
    const dreamCatalog = {
      ...catalog,
      routes: {
        ...catalog.routes,
        byKey: {
          ...catalog.routes.byKey,
          Underworld: {
            ...catalog.routes.byKey.Underworld!,
            prebossRoomGameNames: ['F_PreBoss01', 'G_PreBoss01', 'H_PreBoss01', 'I_PreBoss01'],
          },
        },
      },
    };
    const biome = createBiomeAddress('Underworld', 'I');
    let project = createProjectDocument(dreamCatalog, {
      projectId: 'dream-i-preboss',
      routeKey: 'Underworld',
      configuredBiomeCount: 4,
    });
    const intro = createOccurrenceId('dream-i-intro');
    project = applyProjectCommand(project, dreamCatalog, {
      kind: 'CreateStart',
      biome,
      occurrenceId: intro,
    });
    const first = createExitDecisionAddress(biome, { kind: 'occurrence', occurrenceId: intro });
    project = applyProjectCommand(project, dreamCatalog, { kind: 'CreateBatch', decision: first });
    const combat = createOccurrenceId('dream-i-combat');
    project = applyProjectCommand(project, dreamCatalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(biome, first.source, 'exit1'),
      occurrenceId: combat,
      gameName: 'I_Combat01',
    });
    const final = createExitDecisionAddress(biome, { kind: 'occurrence', occurrenceId: combat });
    project = applyProjectCommand(project, dreamCatalog, { kind: 'CreateBatch', decision: final });
    project = applyProjectCommand(project, dreamCatalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(biome, final.source, 'exit1'),
      occurrenceId: createOccurrenceId('dream-i-preboss'),
      gameName: 'I_PreBoss01',
    });
    expect(project.route!.biomes[3]!.topology!.occurrences.map((room) => room.gameName)).toContain(
      'I_PreBoss01',
    );
    expect(() =>
      applyProjectCommand(project, dreamCatalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(biome, final.source, 'exit2'),
        occurrenceId: createOccurrenceId('wrong-i-preboss'),
        gameName: 'I_PreBoss02',
      }),
    ).toThrow(/not this route position's declared Preboss/);
  });

  it('strictly rejects a route-wrong Preboss and a foreign completion Boss in persisted topology', () => {
    const encoded = JSON.parse(encodeProjectDocument(loadUnderworldFGProject())) as {
      route: {
        biomes: Array<{ biomeKey: string; topology: { occurrences: Array<{ gameName: string }> } }>;
      };
    };
    const f = encoded.route.biomes.find((biome) => biome.biomeKey === 'F')!;
    const preboss = f.topology.occurrences.find((room) => room.gameName === 'F_PreBoss01')!;
    preboss.gameName = 'I_PreBoss01';
    expect(() => decodeProjectDocument(encoded, catalog)).toThrow(
      /must originate from this route position Preboss/,
    );

    const foreignBoss = JSON.parse(
      encodeProjectDocument(loadUnderworldFGProject()),
    ) as typeof encoded;
    const foreignF = foreignBoss.route.biomes.find((biome) => biome.biomeKey === 'F')!;
    foreignF.topology.occurrences.find((room) => room.gameName === 'F_Boss01')!.gameName =
      'G_Boss02';
    expect(() => decodeProjectDocument(foreignBoss, catalog)).toThrow(
      /must target this biome completion Boss/,
    );
  });
});
