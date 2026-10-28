import {
  applyProjectCommand,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createOccurrenceId,
  createProjectDocument,
  decodeProjectDocument,
  encodeProjectDocument,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { catalog } from '@run-planner/hades2-catalog';
import { describe, expect, it } from 'vitest';
import { dreamMixedHandoffProject } from '@run-planner/test-fixtures/dream';
import {
  loadSurfaceNEntryFrontierProject,
  loadSurfaceNProject,
  nBiome,
  nOccurrenceIds,
} from '@run-planner/test-fixtures/surface';

import {
  CATALOG_VERSION,
  OUTPUT_SCHEMA_VERSION,
  migrateProjectDocument,
} from '@planner/persistence/project-95-to-96.js';
import { migrateProjectDocument as migrate96To97 } from '@planner/persistence/project-96-to-97.js';
import { migrateProjectDocument as migrate97To98 } from '@planner/persistence/project-97-to-98.js';
import { migrateProjectDocument as migrate98To99 } from '@planner/persistence/project-98-to-99.js';
import { migrateProjectDocument as migrate99To100 } from '@planner/persistence/project-99-to-100.js';

type Encoded = {
  schemaVersion: number;
  route: {
    biomes: {
      topology: {
        occurrences: { occurrenceId: string }[];
        decisions: { kind: string; source?: { kind: string } }[];
        fixedRoomLinks: unknown[];
      } | null;
    }[];
  };
};

/** The schema-95 shape of a project: every Hub without its completed-Hub chain. */
function withoutChain(project: ProjectDocument): Encoded {
  const encoded = JSON.parse(encodeProjectDocument(project)) as Encoded;
  encoded.schemaVersion = 95;
  for (const biome of encoded.route.biomes) {
    const topology = biome.topology;
    if (topology === null) continue;
    const handoff = topology.decisions.find(
      (decision) => decision.kind === 'exit' && decision.source?.kind === 'hubDecision',
    );
    const prebossId = (handoff as { normal?: { targets: { occurrenceId: string }[] } } | undefined)
      ?.normal?.targets[0]?.occurrenceId;
    if (prebossId === undefined) continue;
    const chain = new Set([prebossId, `${prebossId}:boss`, `${prebossId}:postboss`]);
    topology.decisions = topology.decisions.filter((decision) => decision !== handoff);
    topology.occurrences = topology.occurrences.filter(
      (occurrence) => !chain.has(occurrence.occurrenceId),
    );
    topology.fixedRoomLinks = [];
  }
  return encoded;
}

function migrated(project: ProjectDocument): ProjectDocument {
  return decodeProjectDocument(
    migrate99To100(
      migrate98To99(migrate97To98(migrate96To97(migrateProjectDocument(withoutChain(project))))),
    ) as never,
    catalog,
  );
}

/** Dream N with a freshly created Hub, so its chain holds declaration defaults. */
function dreamHubRecreated(project: ProjectDocument): ProjectDocument {
  const dreamN = { kind: 'biome', routeKey: 'Dream', biomeKey: 'N' } as const;
  const dreamHub = createHubDecisionAddress(dreamN, 'hub');
  const withoutHub = applyProjectCommand(project, catalog, {
    kind: 'RemoveHubDecision',
    hub: dreamHub,
  });
  const preHub = withoutHub.route.biomes
    .find((biome) => biome.biomeKey === 'N')
    ?.topology?.decisions.find(
      (decision) => decision.kind === 'exit' && decision.normal.targets.length === 0,
    );
  if (preHub?.kind !== 'exit') throw new Error('Dream N has no terminal envelope');
  return applyProjectCommand(withoutHub, catalog, {
    kind: 'ReplaceWithHubDecision',
    decision: createExitDecisionAddress(dreamN, preHub.source),
    hub: dreamHub,
    prebossOccurrenceId: createOccurrenceId('N:preboss'),
  });
}

function hubOpened(project: ProjectDocument): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceWithHubDecision',
    decision: createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: nOccurrenceIds.preHub,
    }),
    hub: createHubDecisionAddress(nBiome, 'hub'),
    prebossOccurrenceId: createOccurrenceId('N:preboss'),
  });
}

describe('schema 95 to 96 completed-Hub chain migration', () => {
  it('gives a Hub without its chain exactly what Hub creation builds', () => {
    const created = hubOpened(loadSurfaceNEntryFrontierProject());
    expect(migrated(created)).toEqual(created);
  });

  it('resolves the Rivals Boss and the Dream Postboss from the route position', () => {
    const rivals = hubOpened(
      applyProjectCommand(loadSurfaceNEntryFrontierProject(), catalog, {
        kind: 'ReplaceFearVowRank',
        route: { kind: 'route', routeKey: 'Surface' },
        vowKey: 'BossDifficultyShrineUpgrade',
        rank: 1,
      }),
    );
    expect(migrated(rivals)).toEqual(rivals);
    expect(encodeProjectDocument(rivals)).toContain('"gameName": "N_Boss02"');

    const dream = dreamHubRecreated(dreamMixedHandoffProject());
    expect(encodeProjectDocument(dream)).toContain('"gameName": "Dream_PostBoss03"');
    expect(migrated(dream)).toEqual(dream);
  });

  it.each([
    [2, 'N_Boss01'],
    [3, 'N_Boss02'],
  ] as const)('resolves Rivals rank %i against Dream N at ordinal 3', (rank, bossGameName) => {
    const dream = dreamHubRecreated(
      applyProjectCommand(dreamMixedHandoffProject(), catalog, {
        kind: 'ReplaceFearVowRank',
        route: { kind: 'route', routeKey: 'Dream' },
        vowKey: 'BossDifficultyShrineUpgrade',
        rank,
      }),
    );
    expect(encodeProjectDocument(dream)).toContain(`"gameName": "${bossGameName}"`);
    expect(migrated(dream)).toEqual(dream);
  });

  it('omits the Postboss when Dream N is the last biome', () => {
    const fixture = dreamMixedHandoffProject();
    const withH = createProjectDocument(catalog, {
      projectId: 'dream-n-last',
      routeKey: 'Dream',
      itineraryBiomeKeys: ['Q', 'F', 'H', 'N'],
      configuredBiomeCount: 3,
    });
    const hPlan = withH.route.biomes.find((biome) => biome.biomeKey === 'H');
    if (hPlan === undefined) throw new Error('Dream H plan is missing');
    const [q, f, n] = fixture.route.biomes;
    if (q === undefined || f === undefined || n === undefined) {
      throw new Error('Dream fixture biomes are missing');
    }
    const encoded = JSON.parse(
      encodeProjectDocument({
        ...fixture,
        route: {
          ...fixture.route,
          itineraryBiomeKeys: ['Q', 'F', 'H', 'N'],
          biomes: [q, f, { ...hPlan, topology: null }, n],
        },
      }),
    ) as Encoded;
    // The last biome has no Postboss, so the earlier position's one is dropped.
    const nTopology = encoded.route.biomes[3]!.topology!;
    nTopology.occurrences = nTopology.occurrences.filter(
      (occurrence) => !occurrence.occurrenceId.endsWith(':postboss'),
    );
    nTopology.fixedRoomLinks = nTopology.fixedRoomLinks.slice(0, 1);
    const placed = decodeProjectDocument(encoded as never, catalog);
    const dream = dreamHubRecreated(placed);
    const nRooms = dream.route.biomes.find((biome) => biome.biomeKey === 'N')?.topology
      ?.occurrences;
    expect(nRooms?.some((occurrence) => occurrence.gameName.includes('PostBoss'))).toBe(false);
    expect(nRooms?.some((occurrence) => occurrence.gameName === 'N_Boss01')).toBe(true);
    expect(migrated(dream)).toEqual(dream);
  });

  it('keeps a Hub that owns its chain and every imported identity unchanged', () => {
    const project = loadSurfaceNProject();
    const source = JSON.parse(encodeProjectDocument(project)) as Encoded;
    source.schemaVersion = 95;
    const result = migrateProjectDocument(source) as Encoded;
    expect(result).toEqual({ ...source, schemaVersion: OUTPUT_SCHEMA_VERSION });
    expect(
      encodeProjectDocument(
        decodeProjectDocument(
          migrate99To100(migrate98To99(migrate97To98(migrate96To97(result)))) as never,
          catalog,
        ),
      ),
    ).toBe(encodeProjectDocument(project));
  });

  it('rejects another source schema or catalog', () => {
    expect(() =>
      migrateProjectDocument({ schemaVersion: 94, catalogVersion: CATALOG_VERSION }),
    ).toThrow(/expects schema 95/);
    expect(() => migrateProjectDocument({ schemaVersion: 95, catalogVersion: 'other' })).toThrow(
      /expects catalog/,
    );
  });
});
