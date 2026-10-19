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
  it('creates mandatory starting and unchanged Postboss defaults and round-trips replacements', () => {
    let project = createCompleteFGProject();
    const route = project.route;
    expect(route?.loadout.startingKeepsakeKey).toBe('ManaOverTimeRefundKeepsake');
    expect(
      route?.biomes[0]?.topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === fPostboss.occurrenceId,
      )?.keepsakeRack,
    ).toEqual({ keepsakeKey: null });

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

  it('rejects a rack on a room without one and requires it where the room has one', () => {
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
      'F_Combat02 has no keepsake rack on route Underworld',
    );
    delete occurrence.keepsakeRack;
    const postboss = encoded.route.biomes
      .find((biome) => biome.biomeKey === 'F')
      ?.topology?.occurrences.find((candidate) => candidate.gameName === 'F_PostBoss01');
    if (postboss === undefined) throw new Error('expected the F Postboss');
    const rack = postboss.keepsakeRack;
    delete postboss.keepsakeRack;
    expect(() => decodeProjectDocument(encoded, catalog)).toThrow(
      'keepsakeRack: must be an object',
    );
    postboss.keepsakeRack = { keepsakeKey: null, equipResults: {} };
    expect(() => decodeProjectDocument(encoded, catalog)).toThrow(
      'an unchanged rack has no equip results',
    );
    postboss.keepsakeRack = rack;
    const roomActions = postboss.roomActions as { order: { kind: string }[] };
    const order = roomActions.order;
    roomActions.order = order.filter((reference) => reference.kind !== 'interactKeepsakeRack');
    expect(() => decodeProjectDocument(encoded, catalog)).toThrow(
      'a keepsake rack owns exactly one interactKeepsakeRack action',
    );
    roomActions.order = order;
    expect(decodeProjectDocument(encoded, catalog)).toEqual(project);
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
      value: { blessingKey: 'ChaosWeaponBlessing', blessingValues: { damageBonus: 0.7 } },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTranscendentEmbryoTransformation',
      outcome: transformation,
      value: { blessingKey: 'ChaosElementalBlessing', blessingValues: {} },
    });
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );
    expect(() =>
      applyProjectCommand(project, catalog, {
        kind: 'ReplaceTranscendentEmbryoTransformation',
        outcome: transformation,
        value: {
          blessingKey: 'ChaosLastStandBlessing',
          blessingValues: {},
        },
      }),
    ).toThrow(/in-run Chaos blessing/);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTranscendentEmbryoTransformation',
      outcome: transformation,
      value: null,
    });
    expect(
      project.route?.biomes[0]?.topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === fBoss.occurrenceId,
      )?.encounters.transcendentEmbryoBlessingByPhase,
    ).toBeUndefined();
  });

  it('accepts declaration-closed Embryo values for zero, one, and two operands', () => {
    const start = createRouteStartKeepsakeSelectionAddress('Underworld');
    const equipResult = createKeepsakeEquipResultAddress(start, 'transcendentEmbryo');
    const exactValues = [
      { blessingKey: 'ChaosElementalBlessing', blessingValues: {} },
      { blessingKey: 'ChaosWeaponBlessing', blessingValues: { damageBonus: 0.7 } },
      {
        blessingKey: 'ChaosExSpeedBlessing',
        blessingValues: { weaponSpeed: 0.8, propertySpeed: 0.8 },
      },
    ] as const;
    for (const value of exactValues) {
      let project = applyProjectCommand(createCompleteFGProject(), catalog, {
        kind: 'ReplaceStartingKeepsake',
        selection: start,
        keepsakeKey: 'RandomBlessingKeepsake',
      });
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceTranscendentEmbryoEquipResult',
        result: equipResult,
        value,
      });
      expect(
        decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog).route.loadout
          .keepsakeEquipResults?.transcendentEmbryo,
      ).toEqual(value);
    }
  });

  it('rejects incomplete, extra, off-step, and out-of-range Embryo operands', () => {
    const project = createCompleteFGProject();
    const start = createRouteStartKeepsakeSelectionAddress('Underworld');
    const equipResult = createKeepsakeEquipResultAddress(start, 'transcendentEmbryo');
    const withKeepsake = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: start,
      keepsakeKey: 'RandomBlessingKeepsake',
    });
    for (const blessingValues of [
      {},
      { damageBonus: 0.7, invented: 1 },
      { damageBonus: 0.701 },
      { damageBonus: 2 },
    ]) {
      expect(() =>
        applyProjectCommand(withKeepsake, catalog, {
          kind: 'ReplaceTranscendentEmbryoEquipResult',
          result: equipResult,
          value: { blessingKey: 'ChaosWeaponBlessing', blessingValues },
        }),
      ).toThrow(/blessingValues|complete/);
    }
  });

  it('leaves Jeweled Pom unresolved, restores a dormant route-start result and drops a swapped rack result', () => {
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
    // A rack key change drops the results another keepsake owned.
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
      )?.keepsakeRack,
    ).toEqual({ keepsakeKey: 'HadesAndPersephoneKeepsake' });
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
