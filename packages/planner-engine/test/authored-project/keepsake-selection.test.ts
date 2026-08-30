import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createKeepsakeEquipResultAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createPostbossKeepsakeSelectionAddress,
  createProjectDocument,
  createRouteAddress,
  createRouteStartKeepsakeSelectionAddress,
  createTranscendentEmbryoOutcomeAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  type KeepsakeSelectionAddress,
} from '@run-planner/engine/authored-project';
import { createCompleteFGProject } from '@run-planner/test-fixtures/underworld';

const fPostboss = createOccurrenceAddress(
  createBiomeAddress('Underworld', 'F'),
  createOccurrenceId('golden-f-preboss-shop:postboss'),
);
const fBoss = createOccurrenceAddress(
  createBiomeAddress('Underworld', 'F'),
  createOccurrenceId('golden-f-preboss-shop:boss'),
);

describe('keepsake authored selections', () => {
  it('creates mandatory starting and sparse Postboss defaults and round-trips replacements', () => {
    let project = createCompleteFGProject();
    const route = project.route;
    expect(route?.loadout.startingKeepsakeKey).toBe('ManaOverTimeRefundKeepsake');
    expect(
      route?.biomes[0]?.topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === fPostboss.occurrenceId,
      )?.keepsakeRack,
    ).toBeUndefined();

    const selection: Extract<KeepsakeSelectionAddress, { readonly owner: object }> =
      createPostbossKeepsakeSelectionAddress(fPostboss);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'RandomBlessingKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection,
      keepsakeKey: 'ForceZeusBoonKeepsake',
    });
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );
  });

  it('rejects an unknown persisted selection while preserving legal context-invalid replacements', () => {
    const project = createProjectDocument(catalog, {
      projectId: 'keepsake-codec',
      routeKey: 'Underworld',
      configuredBiomeCount: 1,
    });
    const encoded = JSON.parse(encodeProjectDocument(project)) as {
      route: { routeKey: string; loadout: { startingKeepsakeKey: string } };
    };
    encoded.route.loadout.startingKeepsakeKey = 'MissingKeepsake';
    expect(() => decodeProjectDocument(encoded, catalog)).toThrow(
      'unknown keepsake MissingKeepsake',
    );
  });

  it('rejects a persisted rack leaf on a room without the declaration-owned rack', () => {
    const project = createCompleteFGProject();
    const encoded = JSON.parse(encodeProjectDocument(project)) as {
      route: {
        routeKey: string;
        biomes: {
          biomeKey: string;
          topology: { occurrences: Record<string, unknown>[] } | null;
        }[];
      };
    };
    const occurrence = encoded.route.biomes
      .find((biome) => biome.biomeKey === 'F')
      ?.topology?.occurrences.find((candidate) => candidate.gameName === 'F_Combat02');
    if (occurrence === undefined) throw new Error('expected an Underworld F occurrence');
    occurrence.keepsakeRack = { keepsakeKey: 'ForceZeusBoonKeepsake' };
    expect(() => decodeProjectDocument(encoded, catalog)).toThrow(
      'room declaration has no keepsake rack',
    );
  });

  it('round-trips and clears exact Transcendent Embryo equip and transformation results', () => {
    let project = createCompleteFGProject();
    const start = createRouteStartKeepsakeSelectionAddress('Underworld');
    const equipResult = createKeepsakeEquipResultAddress(start, 'transcendentEmbryo');
    const transformation = createTranscendentEmbryoOutcomeAddress(fBoss, 'Encounter');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: start,
      keepsakeKey: 'RandomBlessingKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTranscendentEmbryoEquipResult',
      result: equipResult,
      value: { blessingKey: 'ChaosWeaponBlessing' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTranscendentEmbryoTransformation',
      outcome: transformation,
      blessingKey: 'ChaosElementalBlessing',
    });
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceTranscendentEmbryoTransformation',
        outcome: transformation,
        blessingKey: 'ChaosLastStandBlessing',
      }),
    ).toThrow(/in-run Chaos blessing/);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTranscendentEmbryoTransformation',
      outcome: transformation,
      blessingKey: null,
    });
    expect(
      project.route?.biomes[0]?.topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === fBoss.occurrenceId,
      )?.encounters.transcendentEmbryoBlessingByPhase,
    ).toBeUndefined();
  });

  it('leaves Jeweled Pom unresolved and restores dormant authored results', () => {
    let project = createCompleteFGProject();
    const start = createRouteStartKeepsakeSelectionAddress('Underworld');
    const postboss = createPostbossKeepsakeSelectionAddress(fPostboss);

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: start,
      keepsakeKey: 'HadesAndPersephoneKeepsake',
    });
    expect(project.route?.loadout.keepsakeEquipResults?.jeweledPom).toBeUndefined();
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
    expect(project.route?.loadout.keepsakeEquipResults?.jeweledPom).toEqual({
      traitKey: 'HadesCastProjectileBoon',
    });
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
    expect(project.route?.loadout.keepsakeEquipResults?.jeweledPom).toEqual({
      traitKey: 'HadesDeathDefianceDamageBoon',
    });

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: postboss,
      keepsakeKey: 'HadesAndPersephoneKeepsake',
    });
    expect(
      project.route.biomes[0]?.topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === fPostboss.occurrenceId,
      )?.keepsakeRack?.equipResults?.jeweledPom,
    ).toBeUndefined();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceJeweledPomEquipResult',
      result: createKeepsakeEquipResultAddress(postboss, 'jeweledPom'),
      value: { traitKey: 'HadesLifestealBoon' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: postboss,
      keepsakeKey: 'BossPreDamageKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection: postboss,
      keepsakeKey: 'HadesAndPersephoneKeepsake',
    });
    expect(
      project.route.biomes[0]?.topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === fPostboss.occurrenceId,
      )?.keepsakeRack?.equipResults?.jeweledPom,
    ).toEqual({ traitKey: 'HadesLifestealBoon' });
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );
  });

  it('retains an authored Experimental Hammer result across dormancy and loadout invalidation', () => {
    let project = createProjectDocument(catalog, {
      projectId: 'hammer-result-retention',
      routeKey: 'Underworld',
      configuredBiomeCount: 1,
    });
    const start = createRouteStartKeepsakeSelectionAddress('Underworld');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: start,
      keepsakeKey: 'TempHammerKeepsake',
    });
    expect(project.route?.loadout.keepsakeEquipResults?.experimentalHammer).toBeUndefined();
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
    expect(project.route?.loadout.keepsakeEquipResults?.experimentalHammer).toEqual({
      kind: 'selected',
      traitKey: 'StaffLongAttackTrait',
    });
  });
});
