import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createFountainRarityOutcomeAddress,
  createHubDecisionAddress,
  createHubFountainAddress,
  createRouteStartKeepsakeSelectionAddress,
  encodeProjectDocument,
  parseProjectDocument,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';
import {
  assembleExecutionProduct,
  compileExecutionPlan,
  decodeExecutionPlan,
  encodeExecutionPlan,
  ExecutionPlanCodecError,
  type ExecutionPlan,
} from '@run-planner/engine/execution-plan';
import { hubVisitActions } from '@run-planner/test-fixtures/shared';
import { loadSurfaceNProject, nBiome, nVisitSlotKeys } from '@run-planner/test-fixtures/surface';
import phialFountainFixture from './fixtures/surface-n-phial-intermediate-fountain.execution.json';
import {
  phialFountainPrecedingVisits,
  phialFountainTargetTraitKey,
  surfaceNPhialIntermediateFountainProject,
} from './support/surface-n-phial-fountain-fixture';
import { migrateProjectDocument as migrateProject87To88 } from '../../../../schema/migrate-project-87-to-88.js';

const hub = createHubDecisionAddress(nBiome, 'hub');
const fountain = createHubFountainAddress(nBiome, 'hub');

/** Re-expresses a fountain-first project in its schema-87 room-only shape and migrates it. */
function migratedPhialProject(): ProjectDocument {
  const current = applyProjectCommand(loadSurfaceNProject(), catalog, {
    kind: 'ReplaceStartingKeepsake',
    selection: createRouteStartKeepsakeSelectionAddress('Surface'),
    keepsakeKey: 'FountainRarityKeepsake',
  });
  const legacy = JSON.parse(encodeProjectDocument(current)) as {
    schemaVersion: number;
    route: { biomes: { topology: { decisions: Record<string, unknown>[] } | null }[] };
  };
  legacy.schemaVersion = 87;
  for (const biome of legacy.route.biomes)
    for (const decision of biome.topology?.decisions ?? []) {
      if (decision.kind !== 'hub') continue;
      const actions = decision.actions as { kind: string; hubSlotKey?: string }[];
      expect(actions[0]).toEqual({ kind: 'useFountain' });
      decision.visitOrder = actions.flatMap((action) =>
        action.hubSlotKey === undefined ? [] : [action.hubSlotKey],
      );
      delete decision.actions;
    }
  return parseProjectDocument(JSON.stringify(migrateProject87To88(legacy)), catalog);
}

function placed(project: ProjectDocument, visits: number): ProjectDocument {
  const reordered = applyProjectCommand(project, catalog, {
    kind: 'ReplaceHubActionOrder',
    hub,
    actions: hubVisitActions(nVisitSlotKeys, visits),
  });
  return applyProjectCommand(reordered, catalog, {
    kind: 'ReplaceFountainRarityTarget',
    outcome: createFountainRarityOutcomeAddress(fountain),
    targetTraitKey: 'ApolloWeaponBoon',
  });
}

function plan(project: ProjectDocument): ExecutionPlan {
  const assembly = simulateProjectAssembly(catalog, project);
  expect(assembly.evaluation.route.summary.eligibleForExecutionPlan).toBe(true);
  return compileExecutionPlan({ product: assembleExecutionProduct({ assembly, catalog }) });
}

function publishedHub(value: ExecutionPlan) {
  const published = value.occurrences.flatMap((entry) =>
    entry.overview.hub === undefined ? [] : [entry.overview.hub],
  );
  expect(published).toHaveLength(1);
  return published[0]!;
}

function wireHub(encoded: string) {
  const wire = JSON.parse(encoded) as {
    occurrences: { overview: { hub?: Record<string, unknown> } }[];
  };
  const entry = wire.occurrences.find((candidate) => candidate.overview.hub !== undefined)!;
  return { wire, hub: entry.overview.hub! };
}

describe('Hub fountain execution export', () => {
  it('migrates a schema-87 Hub to a fountain use before the first visit without a target', () => {
    const project = migratedPhialProject();
    const decision = project.route.biomes
      .find((biome) => biome.biomeKey === 'N')
      ?.topology?.decisions.find((candidate) => candidate.kind === 'hub');
    expect(decision).toMatchObject({ actions: hubVisitActions(nVisitSlotKeys, 0) });
    expect(decision).not.toHaveProperty('fountainRarityResult');
    expect(simulateProjectAssembly(catalog, project).evaluation.findings).toContainEqual(
      expect.objectContaining({
        code: 'fountainRarityResultMissing',
        origin: createFountainRarityOutcomeAddress(fountain),
      }),
    );
  });

  it.each([0, 3, 6])(
    'publishes one ordered Hub fountain use with its Phial target after %i visits',
    (visits) => {
      const compiled = plan(placed(migratedPhialProject(), visits));
      const encoded = encodeExecutionPlan(compiled);
      const decoded = decodeExecutionPlan(JSON.parse(encoded));
      expect(decoded).toEqual(compiled);
      expect(publishedHub(decoded).requiredVisitCount).toBe(6);
      expect(publishedHub(decoded).fountain).toMatchObject({
        kind: 'fountainUse',
        owner: semanticAddressKey(fountain),
        interactionKey: 'fountain',
        precedingVisitCount: visits,
        aromaticPhialTarget: 'ApolloWeaponBoon',
      });
      expect(
        decoded.occurrences.flatMap((entry) =>
          entry.timeline.transactions.filter(
            (transaction) => transaction.owner === semanticAddressKey(fountain),
          ),
        ),
      ).toEqual([]);
    },
  );

  it('does not export a Hub whose fountain use is unplanned', () => {
    const project = applyProjectCommand(loadSurfaceNProject(), catalog, {
      kind: 'ReplaceHubActionOrder',
      hub,
      actions: hubVisitActions(nVisitSlotKeys, null),
    });
    expect(
      simulateProjectAssembly(catalog, project).evaluation.route.summary.eligibleForExecutionPlan,
    ).toBe(false);
  });

  it.each([
    ['a missing fountain use', (value: Record<string, unknown>) => delete value.fountain],
    [
      'an extra fountain field',
      (value: Record<string, unknown>) => {
        value.fountain = { ...(value.fountain as object), window: { kind: 'postOutgoing' } };
      },
    ],
    [
      'another interaction',
      (value: Record<string, unknown>) => {
        value.fountain = { ...(value.fountain as object), interactionKey: 'keepsakeRack' };
      },
    ],
    [
      'a position beyond the required visits',
      (value: Record<string, unknown>) => {
        value.fountain = { ...(value.fountain as object), precedingVisitCount: 7 };
      },
    ],
    [
      'a missing required visit count',
      (value: Record<string, unknown>) => delete value.requiredVisitCount,
    ],
    [
      'a required visit count beyond the open board',
      (value: Record<string, unknown>) => {
        value.requiredVisitCount = 11;
      },
    ],
    [
      'a negative position',
      (value: Record<string, unknown>) => {
        value.fountain = { ...(value.fountain as object), precedingVisitCount: -1 };
      },
    ],
  ])('strictly rejects %s', (_label, mutate) => {
    const { wire, hub: published } = wireHub(encodeExecutionPlan(plan(loadSurfaceNProject())));
    mutate(published);
    expect(() => decodeExecutionPlan(wire)).toThrow(ExecutionPlanCodecError);
  });
});

describe('Surface N Phial intermediate fountain fixture', () => {
  it('publishes the Hub fountain use with a legal Common Pre-Hub Phial target', () => {
    const project = surfaceNPhialIntermediateFountainProject();
    const evaluation = simulateProjectAssembly(catalog, project).evaluation;
    expect(evaluation.findings).toEqual([]);
    const decoded = decodeExecutionPlan(phialFountainFixture);
    expect(decoded).toEqual(plan(project));
    expect(decodeExecutionPlan(JSON.parse(encodeExecutionPlan(decoded)))).toEqual(decoded);
    const published = publishedHub(decoded);
    expect(published.requiredVisitCount).toBe(6);
    expect(published.fountain).toEqual({
      kind: 'fountainUse',
      owner: semanticAddressKey(fountain),
      interactionKey: 'fountain',
      precedingVisitCount: phialFountainPrecedingVisits,
      aromaticPhialTarget: phialFountainTargetTraitKey,
    });
    expect(
      published.departures.map(
        (departure) =>
          departure.traits.equipped.find((trait) => trait.traitKey === phialFountainTargetTraitKey)
            ?.rarity,
      ),
    ).toEqual(['Common', 'Common', 'Common', 'Heroic', 'Heroic', 'Heroic', 'Heroic']);
    expect(phialFountainPrecedingVisits).toBeGreaterThanOrEqual(1);
    expect(phialFountainPrecedingVisits).toBeLessThanOrEqual(5);
  });
});

function nRewards(project: ProjectDocument) {
  const n = simulateProjectAssembly(catalog, project).evaluation.route.biomes.find(
    (biome) => biome.biomeKey === 'N',
  );
  if (n?.authoring !== 'complete' || n.validity !== 'valid') throw new Error('valid N required');
  return n.rewards;
}

/** The room-exit Run State row projection for one room-entry snapshot. */
function enteredInventory(rewards: ReturnType<typeof nRewards>, occurrenceId: string) {
  const snapshot = rewards.runStateSnapshots.find(
    (candidate) =>
      candidate.owner.kind === 'roomRunStateCheckpoint' &&
      candidate.owner.occurrenceId === occurrenceId &&
      candidate.owner.checkpoint.kind === 'roomEntered',
  );
  if (snapshot === undefined) throw new Error(`${occurrenceId} has no entry Run State`);
  return Object.values(snapshot.traits.equippedTraits).map((trait) => ({
    traitKey: trait.traitKey,
    ...(trait.rarity === undefined ? {} : { rarity: trait.rarity }),
    ...(trait.level === undefined ? {} : { level: trait.level }),
    ...(trait.hammerRank === undefined ? {} : { hammerRank: trait.hammerRank }),
  }));
}

const nextRooms = [
  ...nVisitSlotKeys.map((slotKey) => `surface-n-${slotKey}`),
  'surface-n-preboss',
] as const;

describe('Hub departure conformance', () => {
  it.each([0, 3, 6])(
    'publishes seven ordered departures each matching the next entry, fountain after %i visits',
    (visits) => {
      const project = placed(migratedPhialProject(), visits);
      const rewards = nRewards(project);
      const departures = publishedHub(plan(project)).departures;
      expect(departures.map((departure) => departure.precedingVisitCount)).toEqual([
        0, 1, 2, 3, 4, 5, 6,
      ]);
      expect(rewards.hubDepartures.map((departure) => departure.precedingVisitCount)).toEqual([
        0, 1, 2, 3, 4, 5, 6,
      ]);
      departures.forEach((departure, index) => {
        expect(departure.facts).toEqual([{ kind: 'traitInventory' }]);
        expect(departure.traits.equipped).toEqual(enteredInventory(rewards, nextRooms[index]!));
        expect(
          departure.traits.equipped.find((trait) => trait.traitKey === 'ApolloWeaponBoon')?.rarity,
        ).toBe(index < visits ? 'Common' : 'Heroic');
      });
    },
  );

  it('publishes every departure without rarity change when no Phial is equipped', () => {
    const rewards = nRewards(loadSurfaceNProject());
    const departures = publishedHub(plan(loadSurfaceNProject())).departures;
    expect(departures).toHaveLength(7);
    departures.forEach((departure, index) => {
      expect(departure.traits.equipped).toEqual(enteredInventory(rewards, nextRooms[index]!));
      expect(departure.traits.equipped.every((trait) => trait.rarity !== 'Heroic')).toBe(true);
    });
  });

  it('exports no departures for an incomplete Hub', () => {
    const project = applyProjectCommand(loadSurfaceNProject(), catalog, {
      kind: 'ReplaceHubActionOrder',
      hub,
      actions: hubVisitActions(nVisitSlotKeys.slice(0, 4), 2),
    });
    expect(
      simulateProjectAssembly(catalog, project).evaluation.route.summary.eligibleForExecutionPlan,
    ).toBe(false);
  });

  it.each([
    ['a missing departure', (departures: Record<string, unknown>[]) => departures.pop()],
    [
      'an out-of-order departure',
      (departures: Record<string, unknown>[]) => {
        const [first, second] = departures;
        departures[0] = second!;
        departures[1] = first!;
      },
    ],
    [
      'a duplicate departure',
      (departures: Record<string, unknown>[]) => {
        departures[6] = departures[5]!;
      },
    ],
    [
      'an unknown fact',
      (departures: Record<string, unknown>[]) => {
        departures[0] = { ...departures[0], facts: [{ kind: 'elementCounts' }] };
      },
    ],
    [
      'a repeated fact',
      (departures: Record<string, unknown>[]) => {
        departures[0] = {
          ...departures[0],
          facts: [{ kind: 'traitInventory' }, { kind: 'traitInventory' }],
        };
      },
    ],
    [
      'a duplicate trait',
      (departures: Record<string, unknown>[]) => {
        const traits = departures[0]!.traits as { equipped: unknown[] };
        departures[0] = {
          ...departures[0],
          traits: { equipped: [...traits.equipped, traits.equipped[0]] },
        };
      },
    ],
    [
      'an extra trait field',
      (departures: Record<string, unknown>[]) => {
        const traits = departures[0]!.traits as { equipped: Record<string, unknown>[] };
        departures[0] = {
          ...departures[0],
          traits: { equipped: [{ ...traits.equipped[0], acquisitionIdentity: 'x' }] },
        };
      },
    ],
    [
      'an extra departure field',
      (departures: Record<string, unknown>[]) => {
        departures[0] = { ...departures[0], elements: {} };
      },
    ],
  ])('strictly rejects Hub departures with %s', (_label, mutate) => {
    const encoded = encodeExecutionPlan(plan(surfaceNPhialIntermediateFountainProject()));
    expect(() => decodeExecutionPlan(JSON.parse(encoded))).not.toThrow();
    const { wire, hub: published } = wireHub(encoded);
    mutate(published.departures as Record<string, unknown>[]);
    expect(() => decodeExecutionPlan(wire)).toThrow(ExecutionPlanCodecError);
  });

  it('rejects a departure conformance field on the fountain use', () => {
    const { wire, hub: published } = wireHub(encodeExecutionPlan(plan(loadSurfaceNProject())));
    published.fountain = {
      ...(published.fountain as object),
      departureConformance: (published.departures as unknown[])[0],
    };
    expect(() => decodeExecutionPlan(wire)).toThrow(ExecutionPlanCodecError);
  });
});
