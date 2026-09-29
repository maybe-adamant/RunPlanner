import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createBiomeAddress,
  createExitDecisionAddress,
  createOccurrenceId,
  createProjectDocument,
  createProjectHistory,
  createRouteAddress,
  createRouteStartKeepsakeSelectionAddress,
  createStartingRewardAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  parseProjectDocument,
  ProjectCommandContractError,
  ProjectDocumentContractError,
  redoProjectHistory,
  undoProjectHistory,
  type ProjectCommand,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';

const route = createRouteAddress('FreshFile');
const fBiome = createBiomeAddress('FreshFile', 'F');

function freshProject(configuredBiomeCount = 1): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: 'fresh-file',
    routeKey: 'FreshFile',
    configuredBiomeCount,
  });
}

function withLoadout(project: ProjectDocument, loadout: Record<string, unknown>): unknown {
  return {
    ...project,
    route: { ...project.route, loadout: { ...project.route.loadout, ...loadout } },
  };
}

describe('Fresh File project profile', () => {
  it('creates the fixed F-G-H-I route with no equipment, keepsake, Arcana, Fear or starting reward', () => {
    const project = freshProject(0);
    expect(project.route.routeKey).toBe('FreshFile');
    expect(project.route.itineraryBiomeKeys).toEqual(['F', 'G', 'H', 'I']);
    expect(project.route.loadout).toEqual({
      weaponKey: null,
      aspectKey: null,
      startingReward: null,
      manualArcanaKeys: [],
      fearRanks: Object.fromEntries(catalog.fearVows.values.map((vow) => [vow.key, 0])),
      startingKeepsakeKey: null,
    });
    expect(project.route.biomes).toEqual([]);
  });

  it('starts F at F_Opening01 without an opening picker or starting-reward acquisition', () => {
    const configured = applyProjectCommand(freshProject(0), catalog, {
      kind: 'ConfigureRoutePrefix',
      route,
      configuredBiomeCount: 1,
    });
    const topology = configured.route.biomes[0]?.topology;
    expect(topology?.occurrences).toHaveLength(1);
    const start = topology?.occurrences[0];
    expect(start?.gameName).toBe('F_Opening01');
    expect(start?.startingRewardAcquisition).toBeUndefined();
    expect(start?.encounters.encounterKeyByPhase).toEqual({});
  });

  it('round-trips through the strict codec', () => {
    const project = freshProject();
    expect(parseProjectDocument(encodeProjectDocument(project), catalog)).toEqual(project);
  });

  it.each([
    ['weaponKey', () => ({ weaponKey: 'WeaponStaffSwing' })],
    ['aspectKey', () => ({ aspectKey: 'BaseStaffAspect' })],
    ['startingKeepsakeKey', () => ({ startingKeepsakeKey: 'ManaOverTimeRefundKeepsake' })],
    ['startingReward', () => ({ startingReward: { rewardType: 'MaxHealthDrop' } })],
    ['manualArcanaKeys', () => ({ manualArcanaKeys: ['ChanneledCast'] })],
    [
      'fearRanks.EnemyHealthShrineUpgrade',
      (project: ProjectDocument) => ({
        fearRanks: { ...project.route.loadout.fearRanks, EnemyHealthShrineUpgrade: 1 },
      }),
    ],
    ['keepsakeEquipResults', () => ({ keepsakeEquipResults: {} })],
  ] as const)('rejects a fresh-profile %s that is not the fixed value', (field, loadout) => {
    const project = freshProject();
    expect(() => decodeProjectDocument(withLoadout(project, loadout(project)), catalog)).toThrow(
      new RegExp(`loadout\\.${field.replace('.', '\\.')}`),
    );
  });

  it('keeps mature equipment and keepsake selections mandatory', () => {
    const mature = createProjectDocument(catalog, {
      projectId: 'mature',
      routeKey: 'Underworld',
    });
    for (const field of ['weaponKey', 'aspectKey', 'startingKeepsakeKey']) {
      expect(() => decodeProjectDocument(withLoadout(mature, { [field]: null }), catalog)).toThrow(
        ProjectDocumentContractError,
      );
    }
  });

  it('rejects every route-loadout command because the fresh loadout is fixed', () => {
    const project = freshProject();
    const commands: readonly ProjectCommand[] = [
      {
        kind: 'ReplaceRouteLoadout',
        route,
        weaponKey: 'WeaponStaffSwing',
        aspectKey: 'BaseStaffAspect',
      },
      {
        kind: 'ReplaceStartingKeepsake',
        selection: createRouteStartKeepsakeSelectionAddress('FreshFile'),
        keepsakeKey: 'ManaOverTimeRefundKeepsake',
      },
      { kind: 'ReplaceManualArcanaSelection', route, arcanaKeys: ['ChanneledCast'] },
      { kind: 'ReplaceFearVowRank', route, vowKey: 'EnemyHealthShrineUpgrade', rank: 1 },
      {
        kind: 'ReplaceStartingReward',
        reward: createStartingRewardAddress('FreshFile'),
        value: null,
      },
    ];
    for (const command of commands) {
      expect(() => applyProjectCommand(project, catalog, command)).toThrow(
        ProjectCommandContractError,
      );
    }
  });

  it('admits only the fixed opening as the F start', () => {
    const project = freshProject();
    const cleared = decodeProjectDocument(
      {
        ...project,
        route: {
          ...project.route,
          biomes: project.route.biomes.map((biome) => ({ ...biome, topology: null })),
        },
      },
      catalog,
    );
    expect(() =>
      applyProjectCommand(cleared, catalog, {
        kind: 'CreateStart',
        biome: fBiome,
        occurrenceId: createOccurrenceId('fresh-f-start'),
        gameName: 'F_Opening02',
      }),
    ).toThrow(ProjectCommandContractError);
    const started = applyProjectCommand(cleared, catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: createOccurrenceId('fresh-f-start'),
    });
    expect(started.route.biomes[0]?.topology?.occurrences[0]?.gameName).toBe('F_Opening01');
    const imported = {
      ...started,
      route: {
        ...started.route,
        biomes: started.route.biomes.map((biome) => ({
          ...biome,
          topology: {
            ...biome.topology!,
            occurrences: biome.topology!.occurrences.map((occurrence) => ({
              ...occurrence,
              gameName: 'F_Opening02',
            })),
          },
        })),
      },
    };
    expect(() => decodeProjectDocument(imported, catalog)).toThrow(/not a declared start room/);
  });

  it('records onward topology edits in history and restores exact snapshots', () => {
    const initial = createProjectHistory(freshProject());
    const start = initial.present.route.biomes[0]!.topology!.startOccurrenceId;
    const edited = applyProjectHistoryCommand(initial, catalog, {
      kind: 'InitializeExitDecision',
      decision: createExitDecisionAddress(fBiome, { kind: 'occurrence', occurrenceId: start }),
      edit: { kind: 'rewardStore', storeKey: 'RunProgress' },
    });
    expect(edited.present.route.biomes[0]?.topology?.decisions).toHaveLength(1);
    expect(edited.present.route.loadout).toEqual(initial.present.route.loadout);
    const undone = undoProjectHistory(edited);
    expect(undone.present).toBe(initial.present);
    expect(redoProjectHistory(undone).present).toBe(edited.present);
  });
});
