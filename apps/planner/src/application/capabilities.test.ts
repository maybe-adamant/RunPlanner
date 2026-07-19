import { catalog, createCatalog, type CatalogInput } from '@run-planner/catalog';
import { declarations } from '@run-planner/catalog/testing';
import {
  createBiomeAddress,
  createProjectDocument,
  encodeProjectDocument,
  type Catalog,
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
import { ordinaryRoomCategories, selectRoomsForCategory } from './roomSelectorProjection';

function catalogWithDormantH(): Catalog {
  const gLayout = declarations.biomeLayouts.find((layout) => layout.biomeKey === 'G');
  const gStart = declarations.rooms.find((room) => room.gameName === 'G_Intro');
  const gTerminal = declarations.rooms.find((room) => room.gameName === 'G_PreBoss01');
  const gBoss = declarations.rooms.find((room) => room.gameName === 'G_Boss01');
  const gPostboss = declarations.rooms.find((room) => room.gameName === 'G_PostBoss01');
  if (
    gLayout === undefined ||
    gStart === undefined ||
    gTerminal === undefined ||
    gBoss === undefined ||
    gPostboss === undefined
  ) {
    throw new Error('G fixture authority is missing');
  }
  const hStart = {
    ...gStart,
    gameName: 'H_IntroFixture',
    label: 'Dormant H Intro',
    biomeKey: 'H',
  };
  const hTerminal = {
    ...gTerminal,
    gameName: 'H_PreBossFixture',
    label: 'Dormant H Preboss',
    biomeKey: 'H',
  };
  const hBoss = {
    ...gBoss,
    gameName: 'H_BossFixture',
    label: 'Dormant H Boss',
    biomeKey: 'H',
  };
  const hPostboss = {
    ...gPostboss,
    gameName: 'H_PostBossFixture',
    label: 'Dormant H Postboss',
    biomeKey: 'H',
  };
  const hLayout = {
    ...gLayout,
    biomeKey: 'H',
    start: {
      ...gLayout.start,
      roomGameNames: [hStart.gameName],
    },
    terminal: {
      ...gLayout.terminal,
      roomGameName: hTerminal.gameName,
    },
    completion: {
      ...gLayout.completion,
      rooms: [
        { role: 'boss', roomGameName: hBoss.gameName },
        { role: 'postboss', roomGameName: hPostboss.gameName },
      ],
    },
  };

  return createCatalog({
    ...declarations,
    version: `${catalog.version}-dormant-h`,
    rooms: [...declarations.rooms, hStart, hTerminal, hBoss, hPostboss],
    biomeLayouts: [...declarations.biomeLayouts, hLayout],
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
        simulatable: false,
        editable: true,
      },
      {
        biomeKey: 'G',
        declared: true,
        authorable: true,
        simulatable: false,
        editable: false,
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
  });

  it('rejects unknown, duplicate, and non-authorable editable capability entries', () => {
    expect(() =>
      createPlannerCapabilities(catalog, {
        authorableBiomeKeys: ['F', 'H'],
        simulatableBiomeKeys: [],
        editableBiomeKeys: ['F'],
      }),
    ).toThrowError(
      new PlannerCapabilityContractError(
        'capabilities.authorableBiomeKeys[1]',
        'H is not declared',
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

    expect(capabilities.byBiomeKey.H).toEqual({
      biomeKey: 'H',
      declared: true,
      authorable: false,
      simulatable: false,
      editable: false,
    });
    expect(navigation.routes.Underworld?.biomePanels).toEqual([{ biomeKey: 'F', label: 'Erebus' }]);
    expect(navigation.routes.Surface?.biomePanels).toEqual([]);
    expect(widenedProject.catalogVersion).not.toBe(baselineProject.catalogVersion);
    expect({ ...widenedProject, catalogVersion: baselineProject.catalogVersion }).toEqual(
      baselineProject,
    );
    expect(() =>
      store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ClearTopology',
          biome: createBiomeAddress('Underworld', 'H'),
        }),
      ),
    ).toThrowError(
      new PlannerCapabilityContractError('command.ClearTopology', 'H is not authorable'),
    );
  });

  it('keeps P dormant and leaves the F smoke project and selector projection unchanged', () => {
    const preImportCatalog = catalogBeforePImport();
    const preImportCapabilities = createApplicationCapabilities(preImportCatalog);
    const capabilities = createApplicationCapabilities(catalog);
    const preImportProject = createFEditorSmokeProject(preImportCatalog, preImportCapabilities);
    const project = createFEditorSmokeProject(catalog, capabilities);
    const navigation = createEditorNavigation(catalog, capabilities);

    expect(capabilities.byBiomeKey.P).toEqual({
      biomeKey: 'P',
      declared: true,
      authorable: false,
      simulatable: false,
      editable: false,
    });
    expect(navigation.routes.Surface?.biomePanels).toEqual([]);
    expect({ ...project, catalogVersion: preImportProject.catalogVersion }).toEqual(
      preImportProject,
    );
    expect(fSelectorProjection(catalog)).toEqual(fSelectorProjection(preImportCatalog));
  });

  it('keeps Q dormant and leaves the active F editor slice unchanged', () => {
    const preImportCatalog = catalogBeforeQImport();
    const preImportCapabilities = createApplicationCapabilities(preImportCatalog);
    const capabilities = createApplicationCapabilities(catalog);
    const preImportProject = createFEditorSmokeProject(preImportCatalog, preImportCapabilities);
    const project = createFEditorSmokeProject(catalog, capabilities);
    const navigation = createEditorNavigation(catalog, capabilities);

    expect(capabilities.byBiomeKey.Q).toEqual({
      biomeKey: 'Q',
      declared: true,
      authorable: false,
      simulatable: false,
      editable: false,
    });
    expect(navigation.routes.Surface?.biomePanels).toEqual([]);
    expect({ ...project, catalogVersion: preImportProject.catalogVersion }).toEqual(
      preImportProject,
    );
    expect(fSelectorProjection(catalog)).toEqual(fSelectorProjection(preImportCatalog));
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

    expect(fg.routes[0]?.biomes.map((biome) => biome.biomeKey)).toEqual(['F', 'G']);
    expect(() =>
      createAuthorableProjectDocument(catalog, capabilities, {
        projectId: 'fgh-project',
        name: 'F/G/H Project',
        configuredBiomeCounts: { Underworld: 3 },
      }),
    ).toThrowError(
      new PlannerCapabilityContractError(
        'configuredBiomeCounts.Underworld[2]',
        'H is not authorable',
      ),
    );
    expect(() =>
      createAuthorableProjectDocument(catalog, capabilities, {
        projectId: 'surface-project',
        name: 'Surface Project',
        configuredBiomeCounts: { Surface: 1 },
      }),
    ).toThrowError(
      new PlannerCapabilityContractError('configuredBiomeCounts.Surface[0]', 'N is not authorable'),
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
      'H is not authorable',
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
