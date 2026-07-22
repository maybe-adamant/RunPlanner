import { catalog, createCatalog, type CatalogInput } from '@run-planner/catalog';
import { declarations } from '@run-planner/catalog/testing';
import {
  createBiomeAddress,
  createProjectDocument,
  encodeProjectDocument,
  simulateProject,
  type Catalog,
} from '@run-planner/core';
import { describe, expect, it } from 'vitest';

import {
  createPlannerCapabilities,
  hasBiomeCapability,
  PlannerCapabilityContractError,
  requireBiomeCapability,
} from './capabilities';
import {
  createApplicationCapabilities,
  createProjectSimulationScope,
} from './capabilityConfiguration';
import { createEditorNavigation } from './editorNavigation';
import {
  createAuthorableProjectDocument,
  decodeAuthorableProjectDocument,
  parseAuthorableProjectDocument,
} from './projectDocuments';
import { authoredProjectCommandDispatched } from './projectWorkspaceSlice';
import { createPlannerStore } from './store';
import { ordinaryRoomCategories, selectRoomsForCategory } from './roomSelectorProjection';

function createFEditorProject(
  catalogValue: Catalog,
  capabilities: ReturnType<typeof createApplicationCapabilities>,
) {
  return createAuthorableProjectDocument(catalogValue, capabilities, {
    projectId: 'f-editor-test',
    name: 'F Editor Test',
    configuredBiomeCounts: { Underworld: 1 },
  });
}

function catalogBeforeHImport(): Catalog {
  return createCatalog({
    ...declarations,
    version: '0.6.0-q-dormant',
    encounterProfiles: declarations.encounterProfiles.filter(
      (profile) => !profile.key.startsWith('H_'),
    ),
    roomLifecycleProfiles: declarations.roomLifecycleProfiles
      .filter((profile) => profile.key !== 'FieldsCombatRoom')
      .map((profile) => ({
        ...profile,
        encounterProfileKeys: profile.encounterProfileKeys.filter(
          (encounterProfileKey) => !encounterProfileKey.startsWith('H_'),
        ),
      })),
    exitTypes: declarations.exitTypes.filter((exitType) => exitType.key !== 'FieldsExitDoor'),
    rooms: declarations.rooms.filter((room) => room.biomeKey !== 'H'),
    biomeLayouts: declarations.biomeLayouts.filter((layout) => layout.biomeKey !== 'H'),
  } as CatalogInput);
}

function catalogBeforePImport(): Catalog {
  return createCatalog({
    ...declarations,
    version: '0.3.0-fg-structure-v2',
    encounterProfiles: declarations.encounterProfiles.filter(
      (profile) =>
        !['OlympusCombat', 'P_MiniBoss01', 'P_MiniBoss02', 'P_Boss01', 'P_PostBoss01'].includes(
          profile.key,
        ),
    ),
    exitCompatibilityPolicies: declarations.exitCompatibilityPolicies.filter(
      (policy) => !['TargetOutdoor', 'OutdoorSourceTargetsIndoor'].includes(policy.key),
    ),
    exitTypes: declarations.exitTypes.filter(
      (exitType) => !['OlympusOutdoorExitDoor', 'OlympusIndoorExitDoor'].includes(exitType.key),
    ),
    rooms: declarations.rooms.filter((room) => room.biomeKey !== 'P'),
    biomeLayouts: declarations.biomeLayouts.filter((layout) => layout.biomeKey !== 'P'),
  } as CatalogInput);
}

function catalogBeforeQImport(): Catalog {
  return createCatalog({
    ...declarations,
    version: '0.5.0-biome-identity',
    encounterProfiles: declarations.encounterProfiles.filter(
      (profile) =>
        ![
          'SummitCombat',
          'Q_MiniBoss02',
          'Q_MiniBoss03',
          'Q_MiniBoss04',
          'Q_MiniBoss05',
          'Q_Boss01',
        ].includes(profile.key),
    ),
    exitTypes: declarations.exitTypes.filter(
      (exitType) => !['TyphonExitDoor', 'FortressMainDoor'].includes(exitType.key),
    ),
    rooms: declarations.rooms.filter((room) => room.biomeKey !== 'Q'),
    biomeLayouts: declarations.biomeLayouts.filter((layout) => layout.biomeKey !== 'Q'),
  } as CatalogInput);
}

function fSelectorProjection(candidateCatalog: Catalog): readonly string[] {
  return ordinaryRoomCategories
    .flatMap((category) => selectRoomsForCategory(candidateCatalog, 'F', category))
    .map((room) => `${room.kind}:${room.gameName}:${room.label}`);
}

describe('planner capabilities', () => {
  it('derives declared capability from the catalog and keeps active capabilities explicit', () => {
    const capabilities = createApplicationCapabilities(catalog);
    const reusedCatalog = createCatalog({
      ...declarations,
      routes: [
        ...declarations.routes,
        { key: 'Alternate', label: 'Alternate', biomeKeys: ['F', 'P'] },
      ],
    });
    const reusedCapabilities = createApplicationCapabilities(reusedCatalog);

    expect(capabilities.values).toEqual([
      {
        biomeKey: 'F',
        declared: true,
        authorable: true,
        simulatable: true,
        editable: true,
      },
      {
        biomeKey: 'G',
        declared: true,
        authorable: true,
        simulatable: true,
        editable: true,
      },
      {
        biomeKey: 'H',
        declared: true,
        authorable: true,
        simulatable: true,
        editable: true,
      },
      {
        biomeKey: 'I',
        declared: true,
        authorable: true,
        simulatable: true,
        editable: true,
      },
      {
        biomeKey: 'N',
        declared: true,
        authorable: true,
        simulatable: true,
        editable: true,
      },
      {
        biomeKey: 'O',
        declared: true,
        authorable: true,
        simulatable: true,
        editable: true,
      },
      {
        biomeKey: 'P',
        declared: true,
        authorable: false,
        simulatable: false,
        editable: false,
      },
      {
        biomeKey: 'Q',
        declared: true,
        authorable: false,
        simulatable: false,
        editable: false,
      },
    ]);
    expect(reusedCapabilities.values).toEqual(capabilities.values);
    expect(createProjectSimulationScope(capabilities)).toEqual({
      simulatableBiomeKeys: ['F', 'G', 'H', 'I', 'N', 'O'],
    });
  });

  it('rejects unknown, duplicate, and non-authorable editable capability entries', () => {
    expect(() =>
      createPlannerCapabilities(catalog, {
        authorableBiomeKeys: ['F', 'Z'],
        simulatableBiomeKeys: [],
        editableBiomeKeys: ['F'],
      }),
    ).toThrowError(
      new PlannerCapabilityContractError(
        'capabilities.authorableBiomeKeys[1]',
        'Z is not declared',
      ),
    );
    expect(() =>
      createPlannerCapabilities(catalog, {
        authorableBiomeKeys: ['F', 'F'],
        simulatableBiomeKeys: [],
        editableBiomeKeys: ['F'],
      }),
    ).toThrowError(
      new PlannerCapabilityContractError('capabilities.authorableBiomeKeys[1]', 'duplicates F'),
    );
    expect(() =>
      createPlannerCapabilities(catalog, {
        authorableBiomeKeys: ['F'],
        simulatableBiomeKeys: [],
        editableBiomeKeys: ['G'],
      }),
    ).toThrowError(
      new PlannerCapabilityContractError(
        'capabilities.editableBiomeKeys',
        'G must also be authorable',
      ),
    );
  });

  it('requires the activated H declaration and exposes its complete application surface', () => {
    const preImportCatalog = catalogBeforeHImport();
    const capabilities = createApplicationCapabilities(catalog);
    const navigation = createEditorNavigation(catalog, capabilities);
    const widenedProject = createAuthorableProjectDocument(catalog, capabilities, {
      projectId: 'fghi-editor-test',
      name: 'F/G/H/I Editor Test',
      configuredBiomeCounts: { Surface: 1, Underworld: 4 },
    });
    const store = createPlannerStore({
      catalog,
      capabilities,
      evaluateProject: (project) => simulateProject(catalog, project),
      initialProject: widenedProject,
    });

    expect(capabilities.byBiomeKey.H).toEqual({
      biomeKey: 'H',
      declared: true,
      authorable: true,
      simulatable: true,
      editable: true,
    });
    expect(capabilities.byBiomeKey.I).toEqual({
      biomeKey: 'I',
      declared: true,
      authorable: true,
      simulatable: true,
      editable: true,
    });
    expect(capabilities.byBiomeKey.N).toEqual({
      biomeKey: 'N',
      declared: true,
      authorable: true,
      simulatable: true,
      editable: true,
    });
    expect(navigation.routes.Underworld?.biomePanels).toEqual([
      { biomeKey: 'F', label: 'Erebus' },
      { biomeKey: 'G', label: 'Oceanus' },
      { biomeKey: 'H', label: 'Fields of Mourning' },
      { biomeKey: 'I', label: 'Tartarus' },
    ]);
    expect(navigation.routes.Surface?.biomePanels).toEqual([
      { biomeKey: 'N', label: 'City of Ephyra' },
      { biomeKey: 'O', label: 'Rift of Thessaly' },
    ]);
    expect(widenedProject.routes[0]?.biomes.map((biome) => biome.biomeKey)).toEqual([
      'F',
      'G',
      'H',
      'I',
    ]);
    expect(() => createApplicationCapabilities(preImportCatalog)).toThrowError(
      new PlannerCapabilityContractError(
        'capabilities.authorableBiomeKeys[2]',
        'H is not declared',
      ),
    );
    expect(() =>
      store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ClearTopology',
          biome: createBiomeAddress('Underworld', 'H'),
        }),
      ),
    ).not.toThrow();
    expect(() =>
      store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ClearTopology',
          biome: createBiomeAddress('Surface', 'N'),
        }),
      ),
    ).not.toThrow();
  });

  it('keeps P dormant and leaves the F smoke project and selector projection unchanged', () => {
    const preImportCatalog = catalogBeforePImport();
    const preImportCapabilities = createApplicationCapabilities(preImportCatalog);
    const capabilities = createApplicationCapabilities(catalog);
    const preImportProject = createFEditorProject(preImportCatalog, preImportCapabilities);
    const project = createFEditorProject(catalog, capabilities);
    const navigation = createEditorNavigation(catalog, capabilities);

    expect(capabilities.byBiomeKey.P).toEqual({
      biomeKey: 'P',
      declared: true,
      authorable: false,
      simulatable: false,
      editable: false,
    });
    expect(navigation.routes.Surface?.biomePanels).toEqual([
      { biomeKey: 'N', label: 'City of Ephyra' },
      { biomeKey: 'O', label: 'Rift of Thessaly' },
    ]);
    expect({ ...project, catalogVersion: preImportProject.catalogVersion }).toEqual(
      preImportProject,
    );
    expect(fSelectorProjection(catalog)).toEqual(fSelectorProjection(preImportCatalog));
  });

  it('keeps Q dormant and leaves the active F editor slice unchanged', () => {
    const preImportCatalog = catalogBeforeQImport();
    const preImportCapabilities = createApplicationCapabilities(preImportCatalog);
    const capabilities = createApplicationCapabilities(catalog);
    const preImportProject = createFEditorProject(preImportCatalog, preImportCapabilities);
    const project = createFEditorProject(catalog, capabilities);
    const navigation = createEditorNavigation(catalog, capabilities);

    expect(capabilities.byBiomeKey.Q).toEqual({
      biomeKey: 'Q',
      declared: true,
      authorable: false,
      simulatable: false,
      editable: false,
    });
    expect(navigation.routes.Surface?.biomePanels).toEqual([
      { biomeKey: 'N', label: 'City of Ephyra' },
      { biomeKey: 'O', label: 'Rift of Thessaly' },
    ]);
    expect({ ...project, catalogVersion: preImportProject.catalogVersion }).toEqual(
      preImportProject,
    );
    expect(fSelectorProjection(catalog)).toEqual(fSelectorProjection(preImportCatalog));
  });
});

describe('application project capability boundary', () => {
  it('allows the complete Underworld prefix and the two-biome Surface prefix', () => {
    const capabilities = createApplicationCapabilities(catalog);
    const fghi = createAuthorableProjectDocument(catalog, capabilities, {
      projectId: 'fghi-project',
      name: 'F/G/H/I Project',
      configuredBiomeCounts: { Underworld: 4 },
    });

    expect(fghi.routes[0]?.biomes.map((biome) => biome.biomeKey)).toEqual(['F', 'G', 'H', 'I']);
    const surface = createAuthorableProjectDocument(catalog, capabilities, {
      projectId: 'surface-project',
      name: 'Surface Project',
      configuredBiomeCounts: { Surface: 1 },
    });
    expect(surface.routes[1]?.biomes.map((biome) => biome.biomeKey)).toEqual(['N']);
    const surfaceO = createAuthorableProjectDocument(catalog, capabilities, {
      projectId: 'surface-o-project',
      name: 'Surface O Project',
      configuredBiomeCounts: { Surface: 2 },
    });
    expect(surfaceO.routes[1]?.biomes.map((biome) => biome.biomeKey)).toEqual(['N', 'O']);
  });

  it('loads I authored state through both profile decode contacts', () => {
    const capabilities = createApplicationCapabilities(catalog);
    const iProject = createProjectDocument(catalog, {
      projectId: 'i-project',
      name: 'I Project',
      configuredBiomeCounts: { Underworld: 4 },
    });

    expect(decodeAuthorableProjectDocument(iProject, catalog, capabilities)).toEqual(iProject);
    expect(
      parseAuthorableProjectDocument(encodeProjectDocument(iProject), catalog, capabilities),
    ).toEqual(iProject);
  });
});

describe('application capability closure', () => {
  const dormantPlacements = [
    { routeKey: 'Surface', biomeKey: 'P' },
    { routeKey: 'Surface', biomeKey: 'Q' },
  ] as const;

  it('keeps every dormant biome outside all active application contacts', () => {
    const capabilities = createApplicationCapabilities(catalog);
    const project = createFEditorProject(catalog, capabilities);
    const store = createPlannerStore({
      catalog,
      capabilities,
      evaluateProject: (value) => simulateProject(catalog, value),
      initialProject: project,
    });

    for (const { routeKey, biomeKey } of dormantPlacements) {
      for (const capability of ['authorable', 'simulatable', 'editable'] as const) {
        expect(hasBiomeCapability(capabilities, biomeKey, capability)).toBe(false);
        expect(() =>
          requireBiomeCapability(capabilities, biomeKey, capability, `${capability}.${biomeKey}`),
        ).toThrowError(
          new PlannerCapabilityContractError(
            `${capability}.${biomeKey}`,
            `${biomeKey} is not ${capability}`,
          ),
        );
      }

      expect(() =>
        store.dispatch(
          authoredProjectCommandDispatched({
            kind: 'ClearTopology',
            biome: createBiomeAddress(routeKey, biomeKey),
          }),
        ),
      ).toThrowError(
        new PlannerCapabilityContractError(
          'command.ClearTopology',
          `${biomeKey} is not authorable`,
        ),
      );
    }
  });

  it('limits navigation and selector consumers to the editable F/G/H/I/N/O surface', () => {
    const capabilities = createApplicationCapabilities(catalog);
    const navigation = createEditorNavigation(catalog, capabilities);
    const editorBiomeKeys = Object.values(navigation.routes).flatMap((route) =>
      route.biomePanels.map((panel) => panel.biomeKey),
    );

    expect(editorBiomeKeys).toEqual(['F', 'G', 'H', 'I', 'N', 'O']);
    const selectableRooms = editorBiomeKeys.flatMap((biomeKey) =>
      ordinaryRoomCategories.flatMap((category) =>
        selectRoomsForCategory(catalog, biomeKey, category),
      ),
    );
    expect(selectableRooms.length).toBeGreaterThan(0);
    expect(new Set(selectableRooms.map((room) => room.biomeKey))).toEqual(
      new Set(['F', 'G', 'H', 'I', 'N', 'O']),
    );
    expect(selectableRooms.some((room) => room.mode.kind !== 'authored')).toBe(false);
  });
});
