import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createCompletionRoomAddress,
  createKeepsakeEquipResultAddress,
  createPostbossKeepsakeSelectionAddress,
  createProjectDocument,
  createRouteAddress,
  createRouteStartKeepsakeSelectionAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  type KeepsakeSelectionAddress,
} from '@run-planner/engine/authored-project';

describe('keepsake authored selections', () => {
  it('creates mandatory starting and retained Postboss defaults and round-trips replacements', () => {
    let project = createProjectDocument(catalog, {
      projectId: 'keepsake-authored',
      configuredBiomeCounts: { Underworld: 1 },
    });
    const route = project.routes.find((candidate) => candidate.routeKey === 'Underworld');
    expect(route?.loadout.startingKeepsakeKey).toBe('ManaOverTimeRefundKeepsake');
    expect(route?.biomes[0]?.postbossKeepsakeDisposition).toEqual({ kind: 'retain' });

    const selection: Extract<KeepsakeSelectionAddress, { readonly owner: object }> =
      createPostbossKeepsakeSelectionAddress(
        createCompletionRoomAddress(createBiomeAddress('Underworld', 'F'), 'postboss'),
      );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'RandomBlessingKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection,
      value: { kind: 'replace', keepsakeKey: 'ForceZeusBoonKeepsake' },
    });
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );
  });

  it('rejects an unknown persisted selection while preserving legal context-invalid replacements', () => {
    const project = createProjectDocument(catalog, {
      projectId: 'keepsake-codec',
      configuredBiomeCounts: { Underworld: 1 },
    });
    const encoded = JSON.parse(encodeProjectDocument(project)) as {
      routes: { routeKey: string; loadout: { startingKeepsakeKey: string } }[];
    };
    encoded.routes.find((route) => route.routeKey === 'Underworld')!.loadout.startingKeepsakeKey =
      'MissingKeepsake';
    expect(() => decodeProjectDocument(encoded, catalog)).toThrow(
      'unknown keepsake MissingKeepsake',
    );
  });

  it('leaves Jeweled Pom unresolved and restores dormant authored results', () => {
    let project = createProjectDocument(catalog, {
      projectId: 'jeweled-pom-defaults',
      configuredBiomeCounts: { Underworld: 2 },
    });
    const start = createRouteStartKeepsakeSelectionAddress('Underworld');
    const postboss = createPostbossKeepsakeSelectionAddress(
      createCompletionRoomAddress(createBiomeAddress('Underworld', 'F'), 'postboss'),
    );

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: start,
      keepsakeKey: 'HadesAndPersephoneKeepsake',
    });
    expect(
      project.routes.find((route) => route.routeKey === 'Underworld')?.loadout.keepsakeEquipResults
        ?.jeweledPom,
    ).toBeUndefined();
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceJeweledPomEquipResult',
        result: createKeepsakeEquipResultAddress(start, 'jeweledPom'),
        value: { traitKey: 'HadesCastProjectileBoon', rarity: 'Common' },
      }),
    ).toThrow(/rarityless option HadesCastProjectileBoon has no rarity/);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceJeweledPomEquipResult',
      result: createKeepsakeEquipResultAddress(start, 'jeweledPom'),
      value: { traitKey: 'HadesCastProjectileBoon' },
    });
    expect(
      project.routes.find((route) => route.routeKey === 'Underworld')?.loadout.keepsakeEquipResults
        ?.jeweledPom,
    ).toEqual({ traitKey: 'HadesCastProjectileBoon' });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceJeweledPomEquipResult',
      result: createKeepsakeEquipResultAddress(start, 'jeweledPom'),
      value: {
        traitKey: 'HadesDeathDefianceDamageBoon',
      },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: start,
      keepsakeKey: 'ManaOverTimeRefundKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: start,
      keepsakeKey: 'HadesAndPersephoneKeepsake',
    });
    expect(
      project.routes.find((route) => route.routeKey === 'Underworld')?.loadout.keepsakeEquipResults
        ?.jeweledPom,
    ).toEqual({
      traitKey: 'HadesDeathDefianceDamageBoon',
    });

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: postboss,
      value: { kind: 'replace', keepsakeKey: 'HadesAndPersephoneKeepsake' },
    });
    expect(
      project.routes.find((route) => route.routeKey === 'Underworld')?.biomes[0]
        ?.keepsakeEquipResults?.jeweledPom,
    ).toBeUndefined();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceJeweledPomEquipResult',
      result: createKeepsakeEquipResultAddress(postboss, 'jeweledPom'),
      value: { traitKey: 'HadesLifestealBoon' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: postboss,
      value: { kind: 'replace', keepsakeKey: 'BossPreDamageKeepsake' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: postboss,
      value: { kind: 'replace', keepsakeKey: 'HadesAndPersephoneKeepsake' },
    });
    expect(
      project.routes.find((route) => route.routeKey === 'Underworld')?.biomes[0]
        ?.keepsakeEquipResults?.jeweledPom,
    ).toEqual({ traitKey: 'HadesLifestealBoon' });
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );
  });

  it('retains an authored Experimental Hammer result across dormancy and loadout invalidation', () => {
    let project = createProjectDocument(catalog, {
      projectId: 'hammer-result-retention',
      configuredBiomeCounts: { Underworld: 1 },
    });
    const start = createRouteStartKeepsakeSelectionAddress('Underworld');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: start,
      keepsakeKey: 'TempHammerKeepsake',
    });
    expect(project.routes[0]?.loadout.keepsakeEquipResults?.experimentalHammer).toBeUndefined();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceExperimentalHammerEquipResult',
      result: createKeepsakeEquipResultAddress(start, 'experimentalHammer'),
      value: { kind: 'selected', traitKey: 'StaffLongAttackTrait' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: start,
      keepsakeKey: 'ManaOverTimeRefundKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: start,
      keepsakeKey: 'TempHammerKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRouteLoadout',
      route: createRouteAddress('Underworld'),
      weaponKey: 'WeaponDagger',
      aspectKey: 'DaggerBackstabAspect',
    });
    expect(project.routes[0]?.loadout.keepsakeEquipResults?.experimentalHammer).toEqual({
      kind: 'selected',
      traitKey: 'StaffLongAttackTrait',
    });
  });
});
