import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createProjectDocument,
  createBiomeFieldAddress,
  createOccurrenceId,
  createRouteAddress,
  deriveRouteLoadout,
  ProjectCommandContractError,
  ProjectDocumentContractError,
} from '@run-planner/engine/authored-project';

import { fBiome, fProject, iBiome, iProject } from '../support/configured-projects';

describe('authored-project project-state commands', () => {
  it('seeds Postboss room actions from the Postboss room capability independently of rack disposition', () => {
    const withoutRack = {
      ...catalog,
      biomes: {
        ...catalog.biomes,
        byKey: {
          ...catalog.biomes.byKey,
          F: { ...catalog.biomes.byKey.F!, hasPostbossKeepsakeRack: false },
        },
      },
    };
    const document = createProjectDocument(withoutRack, {
      projectId: 'fountain-without-rack',
      configuredBiomeCounts: { Underworld: 1 },
    });
    expect(document.routes[0]?.biomes[0]).toMatchObject({
      postbossRoomActions: { order: [{ kind: 'useFountain' }] },
    });
    expect(document.routes[0]?.biomes[0]?.postbossKeepsakeDisposition).toBeUndefined();
  });

  it('seeds fountain chronology from the Postboss role when a route overrides the room', () => {
    const replacementGameName = catalog.biomeLayouts.byKey.G!.completion.rooms.find(
      (room) => room.role === 'postboss',
    )!.roomGameName;
    const fLayout = catalog.biomeLayouts.byKey.F!;
    const overridden = {
      ...catalog,
      biomeLayouts: {
        ...catalog.biomeLayouts,
        byKey: {
          ...catalog.biomeLayouts.byKey,
          F: {
            ...fLayout,
            completion: {
              ...fLayout.completion,
              rooms: fLayout.completion.rooms.map((room) =>
                room.role === 'postboss' ? { ...room, roomGameName: replacementGameName } : room,
              ),
            },
          },
        },
      },
    };
    const project = createProjectDocument(overridden, {
      projectId: 'overridden-postboss',
      configuredBiomeCounts: { Underworld: 1 },
    });
    expect(project.routes[0]?.biomes[0]?.postbossRoomActions).toEqual({
      order: [{ kind: 'useFountain' }],
    });
  });

  it.each([
    [
      0,
      30,
      [
        'ManaOverTime',
        'StatusVulnerability',
        'StartingGold',
        'RarityBoost',
        'LastStand',
        'ScreenReroll',
        'LowManaDamageBonus',
      ],
    ],
    [1, 18, ['ManaOverTime', 'StatusVulnerability', 'StartingGold', 'CastCount']],
    [2, 12, ['StartingGold', 'LastStand', 'CastCount']],
    [3, 6, ['StartingGold', 'ChanneledCast']],
    [4, 0, []],
  ] as const)(
    'accepts exactly %s-rank Void capacity %s and rejects one more starting Grasp',
    (voidRank, capacity, exactSelection) => {
      const route = createRouteAddress('Underworld');
      const configured = applyProjectCommand(fProject(), catalog, {
        kind: 'ReplaceFearVowRank',
        route,
        vowKey: 'LimitGraspShrineUpgrade',
        rank: voidRank,
      });
      const exact = applyProjectCommand(configured, catalog, {
        kind: 'ReplaceManualArcanaSelection',
        route,
        arcanaKeys: exactSelection,
      });
      expect(exact.routes[0]?.loadout.manualArcanaKeys).toHaveLength(exactSelection.length);
      expect(() =>
        applyProjectCommand(exact, catalog, {
          kind: 'ReplaceManualArcanaSelection',
          route,
          arcanaKeys: [...exactSelection, 'HealthRegen'],
        }),
      ).toThrow(`exceeds starting Grasp capacity ${capacity}`);
    },
  );

  it('rejects a Vow of Void rank that would invalidate the retained starting Arcana selection', () => {
    const route = createRouteAddress('Underworld');
    const exactThirty = applyProjectCommand(fProject(), catalog, {
      kind: 'ReplaceManualArcanaSelection',
      route,
      arcanaKeys: [
        'ManaOverTime',
        'StatusVulnerability',
        'StartingGold',
        'RarityBoost',
        'LastStand',
        'ScreenReroll',
        'LowManaDamageBonus',
      ],
    });
    expect(() =>
      applyProjectCommand(exactThirty, catalog, {
        kind: 'ReplaceFearVowRank',
        route,
        vowKey: 'LimitGraspShrineUpgrade',
        rank: 1,
      }),
    ).toThrow('manual Arcana cost 30 exceeds starting Grasp capacity 18');
  });

  it('grows and shrinks a route prefix while preserving retained authored biomes', () => {
    const underworld = createRouteAddress('Underworld');
    const authored = applyProjectCommand(fProject(), catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: createOccurrenceId('retained-f-start'),
      gameName: 'F_Opening01',
    });
    const retainedF = authored.routes[0]?.biomes[0];

    const grown = applyProjectCommand(authored, catalog, {
      kind: 'ConfigureRoutePrefix',
      route: underworld,
      configuredBiomeCount: 4,
    });

    expect(grown.routes[0]?.biomes.map((biome) => biome.biomeKey)).toEqual(['F', 'G', 'H', 'I']);
    expect(grown.routes[0]?.biomes[0]).toEqual(retainedF);
    expect(grown.routes[0]?.biomes.slice(1)).toEqual([
      {
        biomeKey: 'G',
        state: {},
        topology: null,
        postbossKeepsakeDisposition: { kind: 'retain' },
        postbossRoomActions: { order: [{ kind: 'useFountain' }] },
      },
      {
        biomeKey: 'H',
        state: {},
        topology: null,
        postbossKeepsakeDisposition: { kind: 'retain' },
        postbossRoomActions: { order: [{ kind: 'useFountain' }] },
      },
      {
        biomeKey: 'I',
        state: { maxNonGoalRewards: null },
        topology: null,
        postbossRoomActions: { order: [{ kind: 'useFountain' }] },
      },
    ]);
    expect(
      applyProjectCommand(grown, catalog, {
        kind: 'ConfigureRoutePrefix',
        route: underworld,
        configuredBiomeCount: 4,
      }),
    ).toBe(grown);

    const shrunk = applyProjectCommand(grown, catalog, {
      kind: 'ConfigureRoutePrefix',
      route: underworld,
      configuredBiomeCount: 2,
    });
    expect(shrunk.routes[0]?.biomes.map((biome) => biome.biomeKey)).toEqual(['F', 'G']);
    expect(shrunk.routes[0]?.biomes[0]).toEqual(retainedF);
  });

  it('authors Arcana and Fear independently from weapon, aspect, and biome state', () => {
    const route = createRouteAddress('Underworld');
    const original = fProject();
    const withArcana = applyProjectCommand(original, catalog, {
      kind: 'ReplaceManualArcanaSelection',
      route,
      arcanaKeys: ['ChanneledCast', 'CastCount'],
    });
    const withFear = applyProjectCommand(withArcana, catalog, {
      kind: 'ReplaceFearVowRank',
      route,
      vowKey: 'EnemyDamageShrineUpgrade',
      rank: 3,
    });
    const withWeapon = applyProjectCommand(withFear, catalog, {
      kind: 'ReplaceRouteLoadout',
      route,
      weaponKey: 'WeaponDagger',
      aspectKey: 'DaggerBackstabAspect',
    });

    expect(withWeapon.routes[0]?.loadout).toMatchObject({
      weaponKey: 'WeaponDagger',
      aspectKey: 'DaggerBackstabAspect',
      manualArcanaKeys: ['ChanneledCast', 'CastCount'],
      fearRanks: { EnemyDamageShrineUpgrade: 3 },
    });
    expect(withWeapon.routes[0]?.biomes).toEqual(original.routes[0]?.biomes);
    expect(
      applyProjectCommand(withWeapon, catalog, {
        kind: 'ReplaceFearVowRank',
        route,
        vowKey: 'EnemyDamageShrineUpgrade',
        rank: 3,
      }),
    ).toBe(withWeapon);
    expect(
      applyProjectCommand(withWeapon, catalog, {
        kind: 'ReplaceManualArcanaSelection',
        route,
        arcanaKeys: ['CastCount', 'ChanneledCast'],
      }),
    ).toBe(withWeapon);
  });

  it('derives automatic Arcana and cumulative Fear from the complete route loadout', () => {
    const route = createRouteAddress('Underworld');
    let project = fProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceManualArcanaSelection',
      route,
      arcanaKeys: ['ChanneledCast', 'HealthRegen', 'LowManaDamageBonus', 'CastCount'],
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFearVowRank',
      route,
      vowKey: 'EnemyDamageShrineUpgrade',
      rank: 3,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceFearVowRank',
      route,
      vowKey: 'BossDifficultyShrineUpgrade',
      rank: 4,
    });

    const derived = deriveRouteLoadout(catalog, project.routes[0]!.loadout);
    expect(derived.automaticArcanaKeys).toEqual([
      'SorceryRegenUpgrade',
      'BonusRarity',
      'EpicRarityBoost',
    ]);
    expect(derived.fearTotal).toBe(17);
  });

  it('rejects invalid Arcana and Fear commands at the route owner', () => {
    const route = createRouteAddress('Underworld');
    const project = fProject();
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceManualArcanaSelection',
        route,
        arcanaKeys: ['CardDraw'],
      }),
    ).toThrow(/invalid manual Arcana CardDraw/);
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceFearVowRank',
        route,
        vowKey: 'BossDifficultyShrineUpgrade',
        rank: 5,
      }),
    ).toThrow(/invalid Vow rank/);
  });

  it.each([
    [-1, 'configuredBiomeCount must be a non-negative integer'],
    [1.5, 'configuredBiomeCount must be a non-negative integer'],
    [5, 'configuredBiomeCount exceeds the 4-biome route'],
  ])('rejects invalid route-prefix count %s', (configuredBiomeCount, detail) => {
    expect(() =>
      applyProjectCommand(fProject(), catalog, {
        kind: 'ConfigureRoutePrefix',
        route: createRouteAddress('Underworld'),
        configuredBiomeCount,
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ConfigureRoutePrefix',
        addressKey: '["route","Underworld"]',
        detail,
      }),
    );
  });

  it('replaces and validates a declaration-owned biome field', () => {
    const field = createBiomeFieldAddress(iBiome, 'maxNonGoalRewards');
    const original = iProject();
    const replaced = applyProjectCommand(original, catalog, {
      kind: 'ReplaceBiomeField',
      field,
      value: 5,
    });

    expect(replaced.routes[0]?.biomes[3]?.state).toEqual({ maxNonGoalRewards: 5 });
    expect(
      applyProjectCommand(replaced, catalog, {
        kind: 'ReplaceBiomeField',
        field,
        value: 5,
      }),
    ).toEqual(replaced);

    expect(() =>
      applyProjectCommand(replaced, catalog, {
        kind: 'ReplaceBiomeField',
        field,
        value: 7,
      }),
    ).toThrowError(
      expect.objectContaining({
        commandKind: 'ReplaceBiomeField',
        addressKey: '["biomeField","Underworld","I","maxNonGoalRewards"]',
        detail: 'ReplaceBiomeField.value: must be between 3 and 6',
      }),
    );
  });

  it('wraps a project-document field failure at the public command boundary', () => {
    const command = {
      kind: 'ReplaceBiomeField' as const,
      field: createBiomeFieldAddress(fBiome, 'unknownField'),
      value: false,
    };

    try {
      applyProjectCommand(fProject(), catalog, command);
    } catch (error) {
      expect(error).toBeInstanceOf(ProjectCommandContractError);
      if (!(error instanceof ProjectCommandContractError)) {
        throw new Error('expected a ProjectCommandContractError', { cause: error });
      }
      expect(error).toMatchObject({
        commandKind: 'ReplaceBiomeField',
        addressKey: '["biomeField","Underworld","F","unknownField"]',
        detail: 'ReplaceBiomeField.value: unknown biome field unknownField',
      });
      expect(error.cause).toBeInstanceOf(ProjectDocumentContractError);
      expect(error.cause).toMatchObject({
        path: 'ReplaceBiomeField.value',
        detail: 'unknown biome field unknownField',
      });
      return;
    }
    throw new Error('expected the invalid biome field command to fail');
  });
});
