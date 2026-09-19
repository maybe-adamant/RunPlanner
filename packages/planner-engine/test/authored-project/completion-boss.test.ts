import { ordinaryPositionFor } from '../support/route-position';
import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createOccurrenceId,
  createOccurrenceAddress,
  createPostbossKeepsakeSelectionAddress,
  createProjectDocument,
  createTargetAddress,
  createProjectHistory,
  decodeProjectDocument,
  encodeProjectDocument,
  resolveCompletionBoss,
  resolveRoutePosition,
  undoProjectHistory,
  redoProjectHistory,
} from '@run-planner/engine/authored-project';
import {
  loadUnderworldFGProject,
  createGoldenFGHIProject,
} from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNOPQProject } from '@run-planner/test-fixtures/surface';
import {
  evaluateBiomeCompleteness,
  materializeBiome,
  materializeBiomePrefix,
  simulateProject,
} from '@run-planner/engine/simulation';

describe('completion Boss variants', () => {
  it('does not materialize a host-family Postboss when route context resolves a Dream identity', () => {
    const ordinary = loadUnderworldFGProject();
    const plan = ordinary.route.biomes.find((biome) => biome.biomeKey === 'F')!;
    const dream = createProjectDocument(catalog, {
      projectId: 'foreign-postboss-materialization',
      routeKey: 'Dream',
      itineraryBiomeKeys: ['F', 'G'],
    });
    const biome = createBiomeAddress('Dream', 'F');
    const completeness = evaluateBiomeCompleteness(catalog, biome, plan);
    if (completeness.completion !== 'complete') throw new Error('complete F fixture is required');

    expect(() =>
      materializeBiome(
        catalog,
        biome,
        resolveRoutePosition(catalog, dream.route, 'F'),
        completeness,
        ordinary.route.loadout,
      ),
    ).toThrow(/route-position Postboss F_PostBoss01/);
  });

  it.each([
    ['Underworld', 'I', 'I_Boss01', 'BossChronos', 4, createGoldenFGHIProject],
    ['Surface', 'P', 'P_Boss01', 'BossPrometheus', 3, loadSurfaceNOPQProject],
  ] as const)(
    'resolves %s same-map fixed Boss encounters across Rivals edits',
    (routeKey, biomeKey, gameName, encounter, threshold, build) => {
      const initial = build();
      const original = initial.route.biomes.find((candidate) => candidate.biomeKey === biomeKey)!;
      const boss = original.topology!.occurrences.find(
        (occurrence) => occurrence.gameName === gameName,
      )!;
      const biome = createBiomeAddress(routeKey, biomeKey);
      let project = initial;
      for (const rank of [0, 1, 2, 3, 4, 0]) {
        project = applyProjectCommand(project, catalog, {
          kind: 'ReplaceFearVowRank',
          route: { kind: 'route', routeKey },
          vowKey: 'BossDifficultyShrineUpgrade',
          rank,
        });
        const plan = project.route.biomes.find((candidate) => candidate.biomeKey === biomeKey)!;
        expect(plan.topology!.fixedRoomLinks).toEqual(original.topology!.fixedRoomLinks);
        expect(
          plan.topology!.occurrences.find(
            (occurrence) => occurrence.occurrenceId === boss.occurrenceId,
          ),
        ).toMatchObject({
          gameName,
          encounters: { encounterKeyByPhase: {} },
        });
        const completeness = evaluateBiomeCompleteness(catalog, biome, plan);
        if (completeness.completion !== 'complete') throw new Error('fixture biome is incomplete');
        const full = materializeBiome(
          catalog,
          biome,
          ordinaryPositionFor(catalog, biome),
          completeness,
          project.route.loadout,
        );
        const prefix = materializeBiomePrefix(
          catalog,
          biome,
          ordinaryPositionFor(catalog, biome),
          plan,
          project.route.loadout,
        );
        const expected = `${encounter}${rank >= threshold ? '02' : '01'}`;
        for (const snapshot of [full, prefix]) {
          expect(
            snapshot?.fixedRoomLinks?.find((link) => link.target.occurrenceId === boss.occurrenceId)
              ?.target.encounterPhases,
          ).toMatchObject([{ slotKey: 'Encounter', authoredChoiceKey: expected }]);
        }
        expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
          project,
        );
      }
      const history = applyProjectHistoryCommand(createProjectHistory(initial), catalog, {
        kind: 'ReplaceFearVowRank',
        route: { kind: 'route', routeKey },
        vowKey: 'BossDifficultyShrineUpgrade',
        rank: threshold,
      });
      expect(undoProjectHistory(history).present).toBe(initial);
      expect(redoProjectHistory(undoProjectHistory(history)).present).toEqual(history.present);
    },
  );

  it.each([
    [0, ['F_Boss01', 'G_Boss01', 'H_Boss01', 'I_Boss01']],
    [1, ['F_Boss02', 'G_Boss01', 'H_Boss01', 'I_Boss01']],
    [2, ['F_Boss02', 'G_Boss02', 'H_Boss01', 'I_Boss01']],
    [3, ['F_Boss02', 'G_Boss02', 'H_Boss02', 'I_Boss01']],
    [4, ['F_Boss02', 'G_Boss02', 'H_Boss02', 'I_Boss01']],
  ] as const)('resolves rank %s against route position and the shared I map', (rank, expected) => {
    expect(
      ['F', 'G', 'H', 'I'].map(
        (biome) =>
          resolveCompletionBoss(
            catalog,
            ordinaryPositionFor(catalog, createBiomeAddress('Underworld', biome)),
            rank,
          ).gameName,
      ),
    ).toEqual(expected);
  });

  it('rewrites existing fixed Bosses atomically and undo restores their stable links', () => {
    const unseeded = loadUnderworldFGProject();
    const initialFTopology = unseeded.route!.biomes[0]!.topology!;
    const initialBoss = initialFTopology.occurrences.find((room) => room.gameName === 'F_Boss01')!;
    // Pickaxe is declaration-supported by both F Boss variants and stays attached
    // to the same occurrence when the physical map changes.
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

  it('retains a same-family Rival customization through a normal variant and project round-trip', () => {
    let project = applyProjectCommand(loadUnderworldFGProject(), catalog, {
      kind: 'ReplaceFearVowRank',
      route: { kind: 'route', routeKey: 'Underworld' },
      vowKey: 'BossDifficultyShrineUpgrade',
      rank: 2,
    });
    const rival = project
      .route!.biomes.find((biome) => biome.biomeKey === 'G')!
      .topology!.occurrences.find((occurrence) => occurrence.gameName === 'G_Boss02');
    if (rival === undefined) throw new Error('rank-two Scylla Boss occurrence is missing');
    const phase = createEncounterPhaseAddress(
      createBiomeAddress('Underworld', 'G'),
      { kind: 'occurrence', occurrenceId: rival.occurrenceId },
      'Encounter',
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase,
      decisionKey: 'featuredPerformer',
      value: { kind: 'single', choiceKey: 'charybdis' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFearVowRank',
      route: { kind: 'route', routeKey: 'Underworld' },
      vowKey: 'BossDifficultyShrineUpgrade',
      rank: 1,
    });

    const normal = project
      .route!.biomes.find((biome) => biome.biomeKey === 'G')!
      .topology!.occurrences.find((occurrence) => occurrence.occurrenceId === rival.occurrenceId);
    expect(normal).toMatchObject({ gameName: 'G_Boss01' });
    expect(normal?.encounters.customizationByPhase).toEqual({
      Encounter: { featuredPerformer: { kind: 'single', choiceKey: 'charybdis' } },
    });

    const decoded = decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog);
    expect(decoded).toEqual(project);
    expect(() =>
      applyProjectCommand(decoded, catalog, {
        kind: 'ReplaceEncounterCustomization',
        phase,
        decisionKey: 'hecateInterlude',
        value: { kind: 'single', choiceKey: 'sorceress' },
      }),
    ).toThrow(/not a declared customization/);
  });

  it('retains an incompatible Chronos late summon for repair when Rivals changes', () => {
    let project = createGoldenFGHIProject();
    const boss = project.route.biomes
      .find((biome) => biome.biomeKey === 'I')!
      .topology!.occurrences.find((occurrence) => occurrence.gameName === 'I_Boss01');
    if (boss === undefined) throw new Error('normal Chronos Boss occurrence is missing');
    const phase = createEncounterPhaseAddress(
      createBiomeAddress('Underworld', 'I'),
      { kind: 'occurrence', occurrenceId: boss.occurrenceId },
      'Encounter',
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceEncounterCustomization',
      phase,
      decisionKey: 'lateSummon',
      value: { kind: 'single', choiceKey: 'goldwraiths' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFearVowRank',
      route: { kind: 'route', routeKey: 'Underworld' },
      vowKey: 'BossDifficultyShrineUpgrade',
      rank: 4,
    });

    const rival = project.route.biomes
      .find((biome) => biome.biomeKey === 'I')!
      .topology!.occurrences.find((occurrence) => occurrence.occurrenceId === boss.occurrenceId);
    expect(rival).toMatchObject({
      gameName: 'I_Boss01',
      encounters: {
        customizationByPhase: {
          Encounter: { lateSummon: { kind: 'single', choiceKey: 'goldwraiths' } },
        },
      },
    });
    expect(simulateProject(catalog, project).findings).toContainEqual(
      expect.objectContaining({
        code: 'encounterCustomizationUnavailable',
        origin: phase,
        evidence: expect.objectContaining({ decisionKey: 'lateSummon' }),
      }),
    );
  });

  it('keeps the route-selected Tartarus Preboss out of alternative selection', () => {
    const project = loadUnderworldFGProject();
    expect(
      project.route!.biomes.map((biome) =>
        biome.topology?.occurrences.filter((room) => room.gameName === 'I_PreBoss01'),
      ),
    ).toEqual([[], []]);
    expect(catalog.routes.byKey.Underworld?.completion.prebossRoomGameNameByBiomeKey.I).toBe(
      'I_PreBoss02',
    );
  });

  it('uses the Dream route mapping as the sole I Preboss candidate identity', () => {
    const dreamBiome = createBiomeAddress('Dream', 'I');
    let project = createProjectDocument(catalog, {
      projectId: 'dream-i-preboss',
      routeKey: 'Dream',
      itineraryBiomeKeys: ['I', 'F'],
      configuredBiomeCount: 1,
    });
    const intro = createOccurrenceId('dream-i-intro');
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateStart',
      biome: dreamBiome,
      occurrenceId: intro,
    });
    const first = createExitDecisionAddress(dreamBiome, {
      kind: 'occurrence',
      occurrenceId: intro,
    });
    project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision: first });
    const combat = createOccurrenceId('dream-i-combat');
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(dreamBiome, first.source, 'exit1'),
      occurrenceId: combat,
      gameName: 'I_Combat01',
    });
    const final = createExitDecisionAddress(dreamBiome, {
      kind: 'occurrence',
      occurrenceId: combat,
    });
    project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision: final });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(dreamBiome, final.source, 'exit1'),
      occurrenceId: createOccurrenceId('dream-i-preboss'),
      gameName: 'I_PreBoss01',
    });
    expect(project.route!.biomes[0]!.topology!.occurrences.map((room) => room.gameName)).toContain(
      'I_PreBoss01',
    );
    const postboss = project.route!.biomes[0]!.topology!.occurrences.find(
      (room) => room.gameName === 'Dream_PostBoss01',
    );
    if (postboss === undefined)
      throw new Error('selected Dream I Preboss must own Dream Postboss 01');
    expect(postboss).toMatchObject({
      state: { kind: 'none' },
      roomActions: { order: [{ kind: 'useFountain' }] },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: createPostbossKeepsakeSelectionAddress(
        createOccurrenceAddress(dreamBiome, postboss.occurrenceId),
      ),
      keepsakeKey: 'HadesAndPersephoneKeepsake',
    });
    expect(
      project.route!.biomes[0]!.topology!.occurrences.find(
        (room) => room.occurrenceId === postboss.occurrenceId,
      ),
    ).toMatchObject({
      keepsakeRack: { keepsakeKey: 'HadesAndPersephoneKeepsake' },
      roomActions: { order: [{ kind: 'useFountain' }, { kind: 'interactKeepsakeRack' }] },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetStygianWellInteraction',
      occurrence: createOccurrenceAddress(dreamBiome, postboss.occurrenceId),
      interacted: true,
    });
    expect(
      project.route!.biomes[0]!.topology!.occurrences.find(
        (room) => room.occurrenceId === postboss.occurrenceId,
      )?.stygianWell,
    ).toMatchObject({ interacted: true });
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );
    const wrongOrdinal = JSON.parse(encodeProjectDocument(project)) as {
      route: { biomes: Array<{ topology: { occurrences: Array<{ gameName: string }> } }> };
    };
    const wrongPostboss = wrongOrdinal.route.biomes[0]!.topology.occurrences.find(
      (room) => room.gameName === 'Dream_PostBoss01',
    );
    if (wrongPostboss === undefined) throw new Error('missing Dream Postboss codec target');
    wrongPostboss.gameName = 'Dream_PostBoss02';
    expect(() => decodeProjectDocument(wrongOrdinal, catalog)).toThrow(
      /must target this route position PostBoss/,
    );
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(dreamBiome, final.source, 'exit2'),
        occurrenceId: createOccurrenceId('wrong-i-preboss'),
        gameName: 'I_PreBoss02',
      }),
    ).toThrow(/not this route position's declared Preboss/);
  });

  it('removes and reselects Dream completion chains while retaining compatible Preboss state', () => {
    const biome = createBiomeAddress('Dream', 'F');
    const start = createOccurrenceId('dream-completion-reselect-start');
    const combat = createOccurrenceId('dream-completion-reselect-combat');
    const shopPreboss = createOccurrenceId('dream-completion-reselect-shop');
    const freePreboss = createOccurrenceId('dream-completion-reselect-free');
    let project = applyProjectCommand(
      createProjectDocument(catalog, {
        projectId: 'dream-completion-reselect',
        routeKey: 'Dream',
        itineraryBiomeKeys: ['F', 'G'],
        configuredBiomeCount: 1,
      }),
      catalog,
      { kind: 'CreateStart', biome, occurrenceId: start },
    );
    const opening = createExitDecisionAddress(biome, { kind: 'occurrence', occurrenceId: start });
    project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision: opening });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(biome, opening.source),
      storeKey: 'MetaProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(biome, opening.source, 'exit1'),
      occurrenceId: combat,
      gameName: 'F_Combat02',
    });
    const completion = createExitDecisionAddress(biome, {
      kind: 'occurrence',
      occurrenceId: combat,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTakeoverBatch',
      decision: completion,
      gameName: 'F_PreBoss01',
      targetOccurrenceIds: { exit1: shopPreboss, exit2: freePreboss },
    });
    const selection = createExitSelectionAddress(biome, completion.source);
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection,
      value: { kind: 'normal', exitKey: 'exit1' },
    });
    const selectedShop = project.route.biomes[0]!.topology!.occurrences.find(
      (occurrence) => occurrence.occurrenceId === shopPreboss,
    );
    if (selectedShop === undefined) throw new Error('selected Dream Preboss is missing');
    const compatibleEncounters = selectedShop.encounters;
    expect(project.route.biomes[0]!.topology!.occurrences).toContainEqual(
      expect.objectContaining({ gameName: 'Dream_PostBoss01' }),
    );

    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection,
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    expect(project.route.biomes[0]!.topology!.occurrences).not.toContainEqual(
      expect.objectContaining({ occurrenceId: `${shopPreboss}:postboss` }),
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection,
      value: { kind: 'normal', exitKey: 'exit1' },
    });
    expect(
      project.route.biomes[0]!.topology!.occurrences.find(
        (occurrence) => occurrence.occurrenceId === shopPreboss,
      ),
    ).toMatchObject({ state: { kind: 'shop' }, encounters: compatibleEncounters });
    expect(project.route.biomes[0]!.topology!.occurrences).toContainEqual(
      expect.objectContaining({
        occurrenceId: `${shopPreboss}:postboss`,
        gameName: 'Dream_PostBoss01',
      }),
    );

    project = applyProjectCommand(project, catalog, {
      kind: 'RemoveExitDecision',
      decision: completion,
    });
    expect(project.route.biomes[0]!.topology!.occurrences).not.toContainEqual(
      expect.objectContaining({ gameName: 'Dream_PostBoss01' }),
    );
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
