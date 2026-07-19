import { catalog } from '@run-planner/catalog';
import {
  createBiomeAddress,
  createProjectDocument,
  encodeProjectDocument,
  type Catalog,
  type LinearBiomeLayout,
  type RoomDeclaration,
} from '@run-planner/core';
import { describe, expect, it } from 'vitest';

import { createPlannerCapabilities, PlannerCapabilityContractError } from './capabilities';
import {
  activeCapabilityDefinition,
  createApplicationCapabilities,
} from './capabilityConfiguration';
import { authoredProjectCommandDispatched } from './authoredProjectSlice';
import { createEditorNavigation } from './editorNavigation';
import { createFEditorSmokeProject } from './projectBootstrap';
import {
  createAuthorableProjectDocument,
  decodeAuthorableProjectDocument,
  parseAuthorableProjectDocument,
} from './projectDocuments';
import { createPlannerStore } from './store';

function catalogWithDormantH(): Catalog {
  const gLayout = catalog.biomeLayouts.byKey.Underworld_G;
  const gStartGameName = gLayout?.start.roomGameNames[0];
  const gStart = gStartGameName === undefined ? undefined : catalog.rooms.byKey[gStartGameName];
  const gTerminal =
    gLayout === undefined ? undefined : catalog.rooms.byKey[gLayout.terminal.roomGameName];
  if (gLayout === undefined || gStart === undefined || gTerminal === undefined) {
    throw new Error('G fixture authority is missing');
  }
  const hStart: RoomDeclaration = Object.freeze({
    ...gStart,
    gameName: 'H_IntroFixture',
    label: 'Dormant H Intro',
    biomeStepKey: 'Underworld_H',
  });
  const hTerminal: RoomDeclaration = Object.freeze({
    ...gTerminal,
    gameName: 'H_PreBossFixture',
    label: 'Dormant H Preboss',
    biomeStepKey: 'Underworld_H',
  });
  const hLayout: LinearBiomeLayout = Object.freeze({
    ...gLayout,
    biomeStepKey: 'Underworld_H',
    start: Object.freeze({
      ...gLayout.start,
      roomGameNames: Object.freeze([hStart.gameName]),
    }),
    terminal: Object.freeze({
      ...gLayout.terminal,
      roomGameName: hTerminal.gameName,
    }),
  });
  const layouts = Object.freeze([...catalog.biomeLayouts.values, hLayout]);
  const rooms = Object.freeze([...catalog.rooms.values, hStart, hTerminal]);

  return Object.freeze({
    ...catalog,
    version: `${catalog.version}-dormant-h`,
    biomeLayouts: Object.freeze({
      values: layouts,
      byKey: Object.freeze({ ...catalog.biomeLayouts.byKey, Underworld_H: hLayout }),
    }),
    rooms: Object.freeze({
      values: rooms,
      byKey: Object.freeze({
        ...catalog.rooms.byKey,
        [hStart.gameName]: hStart,
        [hTerminal.gameName]: hTerminal,
      }),
    }),
  });
}

describe('planner capabilities', () => {
  it('derives declared capability from the catalog and keeps active capabilities explicit', () => {
    const capabilities = createApplicationCapabilities(catalog);

    expect(capabilities.values).toEqual([
      {
        biomeStepKey: 'Underworld_F',
        declared: true,
        authorable: true,
        simulatable: false,
        editable: true,
      },
      {
        biomeStepKey: 'Underworld_G',
        declared: true,
        authorable: true,
        simulatable: false,
        editable: false,
      },
    ]);
  });

  it('rejects unknown, duplicate, and non-authorable editable capability entries', () => {
    expect(() =>
      createPlannerCapabilities(catalog, {
        authorableBiomeStepKeys: ['Underworld_F', 'Underworld_H'],
        simulatableBiomeStepKeys: [],
        editableBiomeStepKeys: ['Underworld_F'],
      }),
    ).toThrowError(
      new PlannerCapabilityContractError(
        'capabilities.authorableBiomeStepKeys[1]',
        'Underworld_H is not declared',
      ),
    );
    expect(() =>
      createPlannerCapabilities(catalog, {
        authorableBiomeStepKeys: ['Underworld_F', 'Underworld_F'],
        simulatableBiomeStepKeys: [],
        editableBiomeStepKeys: ['Underworld_F'],
      }),
    ).toThrowError(
      new PlannerCapabilityContractError(
        'capabilities.authorableBiomeStepKeys[1]',
        'duplicates Underworld_F',
      ),
    );
    expect(() =>
      createPlannerCapabilities(catalog, {
        authorableBiomeStepKeys: ['Underworld_F'],
        simulatableBiomeStepKeys: [],
        editableBiomeStepKeys: ['Underworld_G'],
      }),
    ).toThrowError(
      new PlannerCapabilityContractError(
        'capabilities.editableBiomeStepKeys',
        'Underworld_G must also be authorable',
      ),
    );
  });

  it('keeps a newly declared dormant biome out of authoring and editor navigation', () => {
    const widenedCatalog = catalogWithDormantH();
    const capabilities = createPlannerCapabilities(widenedCatalog, activeCapabilityDefinition);
    const navigation = createEditorNavigation(widenedCatalog, capabilities);
    const baselineCapabilities = createApplicationCapabilities(catalog);
    const baselineProject = createFEditorSmokeProject(catalog, baselineCapabilities);
    const widenedProject = createFEditorSmokeProject(widenedCatalog, capabilities);
    const store = createPlannerStore({
      catalog: widenedCatalog,
      capabilities,
      initialProject: widenedProject,
    });

    expect(capabilities.byBiomeStepKey.Underworld_H).toEqual({
      biomeStepKey: 'Underworld_H',
      declared: true,
      authorable: false,
      simulatable: false,
      editable: false,
    });
    expect(navigation.routes.Underworld?.biomePanels).toEqual([
      { biomeStepKey: 'Underworld_F', label: 'Erebus' },
    ]);
    expect(navigation.routes.Surface?.biomePanels).toEqual([]);
    expect(widenedProject.catalogVersion).not.toBe(baselineProject.catalogVersion);
    expect({ ...widenedProject, catalogVersion: baselineProject.catalogVersion }).toEqual(
      baselineProject,
    );
    expect(() =>
      store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ClearTopology',
          biome: createBiomeAddress('Underworld', 'Underworld_H'),
        }),
      ),
    ).toThrowError(
      new PlannerCapabilityContractError('command.ClearTopology', 'Underworld_H is not authorable'),
    );
  });
});

describe('application project capability boundary', () => {
  it('allows the authorable F/G prefix and rejects Underworld beyond G and Surface', () => {
    const capabilities = createApplicationCapabilities(catalog);
    const fg = createAuthorableProjectDocument(catalog, capabilities, {
      projectId: 'fg-project',
      name: 'F/G Project',
      configuredBiomeCounts: { Underworld: 2 },
    });

    expect(fg.routes[0]?.biomes.map((biome) => biome.biomeStepKey)).toEqual([
      'Underworld_F',
      'Underworld_G',
    ]);
    expect(() =>
      createAuthorableProjectDocument(catalog, capabilities, {
        projectId: 'fgh-project',
        name: 'F/G/H Project',
        configuredBiomeCounts: { Underworld: 3 },
      }),
    ).toThrowError(
      new PlannerCapabilityContractError(
        'configuredBiomeCounts.Underworld[2]',
        'Underworld_H is not authorable',
      ),
    );
    expect(() =>
      createAuthorableProjectDocument(catalog, capabilities, {
        projectId: 'surface-project',
        name: 'Surface Project',
        configuredBiomeCounts: { Surface: 1 },
      }),
    ).toThrowError(
      new PlannerCapabilityContractError(
        'configuredBiomeCounts.Surface[0]',
        'Surface_N is not authorable',
      ),
    );
  });

  it('rejects dormant authored state during both decoded and parsed project load', () => {
    const widenedCatalog = catalogWithDormantH();
    const capabilities = createPlannerCapabilities(widenedCatalog, activeCapabilityDefinition);
    const dormantProject = createProjectDocument(widenedCatalog, {
      projectId: 'dormant-project',
      name: 'Dormant Project',
      configuredBiomeCounts: { Underworld: 3 },
    });
    const expectedError = new PlannerCapabilityContractError(
      'project.routes[0].biomes[2]',
      'Underworld_H is not authorable',
    );

    expect(() =>
      decodeAuthorableProjectDocument(dormantProject, widenedCatalog, capabilities),
    ).toThrowError(expectedError);
    expect(() =>
      parseAuthorableProjectDocument(
        encodeProjectDocument(dormantProject),
        widenedCatalog,
        capabilities,
      ),
    ).toThrowError(expectedError);
  });
});
