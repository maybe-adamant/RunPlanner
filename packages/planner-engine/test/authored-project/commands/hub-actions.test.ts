import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createExitDecisionAddress,
  createFountainRarityOutcomeAddress,
  createHubDecisionAddress,
  createHubFountainAddress,
  createProjectHistory,
  decodeProjectDocument,
  encodeProjectDocument,
  hubFountainPrecedingVisitCount,
  hubVisitSlotKeys,
  ProjectCommandContractError,
  ProjectDocumentContractError,
  undoProjectHistory,
  type HubAction,
  type HubDecision,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { hubVisitActions } from '@run-planner/test-fixtures/shared';
import {
  loadSurfaceNProject,
  nBiome,
  nOccurrenceIds,
  nVisitSlotKeys,
} from '@run-planner/test-fixtures/surface';

const hub = createHubDecisionAddress(nBiome, 'hub');
const outcome = createFountainRarityOutcomeAddress(createHubFountainAddress(nBiome, 'hub'));

function nTopology(project: ProjectDocument) {
  const topology = project.route.biomes.find((biome) => biome.biomeKey === 'N')?.topology;
  if (topology === null || topology === undefined) throw new Error('N topology is required');
  return topology;
}

function authoredHub(project: ProjectDocument): HubDecision {
  const decision = nTopology(project).decisions.find((candidate) => candidate.kind === 'hub');
  if (decision?.kind !== 'hub') throw new Error('N Hub decision is required');
  return decision;
}

function replaceActions(project: ProjectDocument, actions: readonly HubAction[]): ProjectDocument {
  return applyProjectCommand(project, catalog, { kind: 'ReplaceHubActionOrder', hub, actions });
}

function hasHandoff(project: ProjectDocument): boolean {
  return nTopology(project).decisions.some(
    (decision) => decision.kind === 'exit' && decision.source.kind === 'hubDecision',
  );
}

function withOutcome(project: ProjectDocument, targetTraitKey: string): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceFountainRarityTarget',
    outcome,
    targetTraitKey,
  });
}

function rawHub(project: ProjectDocument) {
  const raw = JSON.parse(encodeProjectDocument(project)) as {
    route: { biomes: { biomeKey: string; topology: { decisions: Record<string, unknown>[] } }[] };
  };
  const decision = raw.route.biomes
    .find((biome) => biome.biomeKey === 'N')!
    .topology.decisions.find((candidate) => candidate.kind === 'hub')!;
  return { raw, decision };
}

describe('Hub action order commands', () => {
  it('derives room ordinals by counting room visits only', () => {
    const project = replaceActions(loadSurfaceNProject(), hubVisitActions(nVisitSlotKeys, 2));
    expect(hubVisitSlotKeys(authoredHub(project))).toEqual(nVisitSlotKeys);
    expect(hubFountainPrecedingVisitCount(authoredHub(project))).toBe(2);
    expect(hubFountainPrecedingVisitCount(authoredHub(replaceActions(project, [])))).toBe(
      undefined,
    );
  });

  it('structurally rejects a second fountain use and closed or repeated visits', () => {
    const project = loadSurfaceNProject();
    for (const actions of [
      [{ kind: 'useFountain' }, ...hubVisitActions(['combat05'], null), { kind: 'useFountain' }],
      hubVisitActions(['combat05', 'combat05']),
      hubVisitActions(['combat04']),
      hubVisitActions([...nVisitSlotKeys, 'combat01']),
      [{ kind: 'useFountain', hubSlotKey: 'combat05' }],
      [{ kind: 'roomVisit' }],
    ] as readonly (readonly HubAction[])[]) {
      expect(() => replaceActions(project, actions)).toThrow(ProjectCommandContractError);
    }
  });

  it('removing a room visit keeps retained actions in order and removes the completed handoff', () => {
    const project = replaceActions(loadSurfaceNProject(), hubVisitActions(nVisitSlotKeys, 3));
    const actions = authoredHub(project).actions;
    const removed = replaceActions(
      project,
      actions.filter(
        (action) => action.kind !== 'roomVisit' || action.hubSlotKey !== nVisitSlotKeys[1],
      ),
    );
    expect(authoredHub(removed).actions).toEqual(
      hubVisitActions(
        nVisitSlotKeys.filter((slotKey) => slotKey !== nVisitSlotKeys[1]),
        2,
      ),
    );
    expect(hasHandoff(removed)).toBe(false);
    expect(
      nTopology(removed).occurrences.some((occurrence) => occurrence.gameName === 'N_PreBoss01'),
    ).toBe(false);
  });

  it('removing only the fountain keeps the six-visit handoff and every downstream room', () => {
    const project = loadSurfaceNProject();
    const removed = replaceActions(project, hubVisitActions(nVisitSlotKeys, null));
    expect(hasHandoff(removed)).toBe(true);
    expect(nTopology(removed).occurrences).toEqual(nTopology(project).occurrences);
    expect(nTopology(removed).fixedRoomLinks).toEqual(nTopology(project).fixedRoomLinks);
    expect(hasHandoff(replaceActions(removed, hubVisitActions(nVisitSlotKeys, 6)))).toBe(true);
  });

  it('keeps an authored Phial target through reordering and drops it with the fountain use', () => {
    const project = withOutcome(loadSurfaceNProject(), 'ApolloWeaponBoon');
    const moved = replaceActions(project, hubVisitActions(nVisitSlotKeys, 5));
    expect(authoredHub(moved).fountainRarityResult).toEqual({ targetTraitKey: 'ApolloWeaponBoon' });
    const unplanned = replaceActions(moved, hubVisitActions(nVisitSlotKeys, null));
    expect(authoredHub(unplanned).fountainRarityResult).toBeUndefined();
    expect(() => withOutcome(unplanned, 'ApolloWeaponBoon')).toThrow(ProjectCommandContractError);
    expect(
      authoredHub(
        applyProjectCommand(moved, catalog, {
          kind: 'ReplaceFountainRarityTarget',
          outcome,
          targetTraitKey: null,
        }),
      ).fountainRarityResult,
    ).toBeUndefined();
  });

  it('resets every action and the outcome in one undoable edit', () => {
    const project = withOutcome(
      replaceActions(loadSurfaceNProject(), hubVisitActions(nVisitSlotKeys, 4)),
      'ApolloWeaponBoon',
    );
    const visitsReset = replaceActions(project, []);
    expect(authoredHub(visitsReset).actions).toEqual([]);
    expect(authoredHub(visitsReset).fountainRarityResult).toBeUndefined();

    const history = applyProjectHistoryCommand(createProjectHistory(project), catalog, {
      kind: 'ResetHubBoard',
      hub,
    });
    expect(authoredHub(history.present)).toEqual({
      kind: 'hub',
      hubKey: 'hub',
      source: authoredHub(project).source,
      openTargets: [],
      actions: [],
    });
    expect(undoProjectHistory(history).present).toBe(project);

    const fountainOnly = replaceActions(history.present, [{ kind: 'useFountain' }]);
    const resetAgain = applyProjectCommand(fountainOnly, catalog, { kind: 'ResetHubBoard', hub });
    expect(authoredHub(resetAgain).actions).toEqual([]);
    expect(applyProjectCommand(resetAgain, catalog, { kind: 'ResetHubBoard', hub })).toBe(
      resetAgain,
    );
  });
});

describe('new Hub decisions', () => {
  it('start with an empty action order after the Hub is recreated', () => {
    const removed = applyProjectCommand(loadSurfaceNProject(), catalog, {
      kind: 'RemoveHubDecision',
      hub,
    });
    const recreated = applyProjectCommand(removed, catalog, {
      kind: 'ReplaceWithHubDecision',
      decision: createExitDecisionAddress(nBiome, {
        kind: 'occurrence',
        occurrenceId: nOccurrenceIds.preHub,
      }),
      hub,
    });
    expect(authoredHub(recreated).actions).toEqual([]);
    expect(authoredHub(recreated).fountainRarityResult).toBeUndefined();
  });
});

describe('Hub action order codec', () => {
  it('round-trips interleaved actions and a Hub-owned Phial target', () => {
    const project = withOutcome(
      replaceActions(loadSurfaceNProject(), hubVisitActions(nVisitSlotKeys, 3)),
      'ApolloWeaponBoon',
    );
    const decoded = decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog);
    expect(authoredHub(decoded)).toEqual(authoredHub(project));
    expect(Object.keys(rawHub(project).decision)).toEqual([
      'kind',
      'hubKey',
      'source',
      'openTargets',
      'actions',
      'fountainRarityResult',
    ]);
  });

  it.each([
    [
      'a second fountain use',
      (hub: Record<string, unknown>) => {
        hub.actions = [...(hub.actions as unknown[]), { kind: 'useFountain' }];
      },
    ],
    [
      'a closed room visit',
      (hub: Record<string, unknown>) => {
        hub.actions = [{ kind: 'roomVisit', hubSlotKey: 'combat04' }];
      },
    ],
    [
      'a repeated room visit',
      (hub: Record<string, unknown>) => {
        hub.actions = [
          { kind: 'roomVisit', hubSlotKey: 'combat05' },
          { kind: 'roomVisit', hubSlotKey: 'combat05' },
        ];
      },
    ],
    [
      'an unknown action',
      (hub: Record<string, unknown>) => {
        hub.actions = [{ kind: 'usePylon' }];
      },
    ],
    [
      'an extra action field',
      (hub: Record<string, unknown>) => {
        hub.actions = [{ kind: 'useFountain', hubSlotKey: 'combat05' }];
      },
    ],
    [
      'a missing action order',
      (hub: Record<string, unknown>) => {
        delete hub.actions;
      },
    ],
    [
      'a legacy visit order',
      (hub: Record<string, unknown>) => {
        hub.visitOrder = [];
      },
    ],
    [
      'an outcome without a planned fountain use',
      (hub: Record<string, unknown>) => {
        hub.actions = (hub.actions as { kind: string }[]).filter(
          (action) => action.kind !== 'useFountain',
        );
        hub.fountainRarityResult = { targetTraitKey: 'ApolloWeaponBoon' };
      },
    ],
  ])('rejects %s', (_label, mutate) => {
    const { raw, decision } = rawHub(loadSurfaceNProject());
    mutate(decision);
    expect(() => decodeProjectDocument(raw, catalog)).toThrow(ProjectDocumentContractError);
  });

  it('decodes an empty action order without an implicit fountain use', () => {
    const { raw, decision } = rawHub(
      applyProjectCommand(loadSurfaceNProject(), catalog, { kind: 'ResetHubBoard', hub }),
    );
    expect(decision.actions).toEqual([]);
    expect(authoredHub(decodeProjectDocument(raw, catalog)).actions).toEqual([]);
  });
});
