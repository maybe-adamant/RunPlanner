import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createPostbossKeepsakeSelectionAddress,
  createShopOfferAddress,
  createTargetAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  semanticAddressKey,
  takeoverBatchExitRepairAvailable,
  type BiomeTopology,
  type ExitDecision,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { replaceTestShopOfferActions } from '@run-planner/test-fixtures/shared';
import { loadSurfaceNOPQCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import { simulateProject } from '@run-planner/engine/simulation';

import { gBiome, gProject, qBiome } from '../support/configured-projects';

const intro = createOccurrenceId('repair-intro');
const source = createOccurrenceId('repair-source');
const shop = createOccurrenceId('repair-shop');
const sourceDecision = createExitDecisionAddress(gBiome, {
  kind: 'occurrence',
  occurrenceId: source,
});
const selection = createExitSelectionAddress(gBiome, sourceDecision.source);
const repair = { kind: 'ReconcileBatchExitCapacity', decision: sourceDecision } as const;

function gTopology(project: ProjectDocument): BiomeTopology {
  const topology = project.route.biomes.find((biome) => biome.biomeKey === 'G')?.topology;
  if (topology === null || topology === undefined) throw new Error('missing G topology');
  return topology;
}

function takeoverDecision(project: ProjectDocument): ExitDecision {
  const decision = gTopology(project).decisions.find(
    (candidate): candidate is ExitDecision =>
      candidate.kind === 'exit' &&
      candidate.source.kind === 'occurrence' &&
      candidate.source.occurrenceId === source,
  );
  if (decision === undefined) throw new Error('missing takeover decision');
  return decision;
}

function occurrence(project: ProjectDocument, occurrenceId: string) {
  return gTopology(project).occurrences.find(
    (candidate) => candidate.occurrenceId === occurrenceId,
  );
}

function replaceSource(project: ProjectDocument, gameName: string): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceOccurrenceRoom',
    occurrence: createOccurrenceAddress(gBiome, source),
    gameName,
  });
}

function repairAvailable(project: ProjectDocument): boolean {
  const layout = catalog.biomeLayouts.byKey.G;
  if (layout === undefined) throw new Error('missing G layout');
  return takeoverBatchExitRepairAvailable(
    catalog,
    layout,
    gTopology(project),
    takeoverDecision(project),
  );
}

/** Customizes the selected Preboss chain and boss-door store so a rebuild from defaults is observable. */
function customizeChain(project: ProjectDocument, prebossId: string): ProjectDocument {
  const withKeepsake = applyProjectCommand(project, catalog, {
    kind: 'ReplacePostbossKeepsake',
    selection: createPostbossKeepsakeSelectionAddress(
      createOccurrenceAddress(gBiome, createOccurrenceId(`${prebossId}:postboss`)),
    ),
    keepsakeKey: 'HadesAndPersephoneKeepsake',
  });
  return applyProjectCommand(withKeepsake, catalog, {
    kind: 'ReplaceBossDoorRewardStore',
    rewardStore: createBatchRewardStoreAddress(gBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId(prebossId),
    }),
    storeKey: 'MetaProgress',
  });
}

/** G source with a one-door takeover whose entered Shop has a purchase and a customized chain. */
function oneDoorTakeover(sourceGameName = 'G_MiniBoss02'): ProjectDocument {
  let project = applyProjectCommand(gProject(), catalog, {
    kind: 'CreateStart',
    biome: gBiome,
    occurrenceId: intro,
  });
  const introDecision = createExitDecisionAddress(gBiome, {
    kind: 'occurrence',
    occurrenceId: intro,
  });
  project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision: introDecision });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(gBiome, introDecision.source),
    storeKey: 'RunProgress',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(gBiome, introDecision.source, 'exit1'),
    occurrenceId: source,
    gameName: sourceGameName,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTakeoverBatch',
    decision: sourceDecision,
    gameName: 'G_PreBoss01',
    targetOccurrenceIds: { exit1: shop },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopOffer',
    offer: createShopOfferAddress(gBiome, shop, 'MajorNonBoon'),
    value: { rewardType: 'MaxHealthDrop' },
  });
  project = replaceTestShopOfferActions(project, catalog, createOccurrenceAddress(gBiome, shop), [
    'MajorNonBoon',
  ]);
  return customizeChain(project, shop);
}

/** Every topology member except the named occurrences, which a repair may add or remove. */
function untouched(project: ProjectDocument, changed: readonly string[]) {
  const topology = gTopology(project);
  return {
    occurrences: topology.occurrences.filter(
      (candidate) => !changed.includes(candidate.occurrenceId),
    ),
    fixedRoomLinks: topology.fixedRoomLinks,
    otherDecisions: topology.decisions.filter(
      (candidate) =>
        candidate.kind !== 'exit' ||
        candidate.source.kind !== 'occurrence' ||
        candidate.source.occurrenceId !== source,
    ),
  };
}

function expectRoundTrip(project: ProjectDocument): void {
  expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
    project,
  );
}

describe('takeover exit-capacity repair', () => {
  it('widens 1→2 and 2→3 by appending engine-identified doors and retaining every survivor', () => {
    const narrow = oneDoorTakeover();
    expect(occurrence(narrow, shop)?.roomActions.order).toContainEqual({
      kind: 'interactShopOffer',
      offerKey: 'MajorNonBoon',
    });
    const drifted = replaceSource(narrow, 'G_Combat04');
    expect(repairAvailable(drifted)).toBe(true);

    const two = applyProjectCommand(drifted, catalog, repair);
    const exit2 = `${source}:exit2`;
    expect(takeoverDecision(two)).toMatchObject({
      normal: {
        targets: [
          { exitKey: 'exit1', occurrenceId: shop },
          { exitKey: 'exit2', occurrenceId: exit2 },
        ],
      },
      selection: { kind: 'normal', exitKey: 'exit1' },
    });
    expect(untouched(two, [exit2])).toEqual(untouched(drifted, []));
    expect(occurrence(two, exit2)).toMatchObject({
      gameName: 'G_PreBoss01',
      state: { kind: 'freeReward' },
    });
    expect(repairAvailable(two)).toBe(false);
    expect(applyProjectCommand(two, catalog, repair)).toBe(two);
    expectRoundTrip(two);

    const three = applyProjectCommand(replaceSource(two, 'G_Combat02'), catalog, repair);
    const exit3 = `${source}:exit3`;
    expect(takeoverDecision(three).normal.targets).toEqual([
      { exitKey: 'exit1', occurrenceId: shop },
      { exitKey: 'exit2', occurrenceId: exit2 },
      { exitKey: 'exit3', occurrenceId: exit3 },
    ]);
    expect(takeoverDecision(three).selection).toEqual({ kind: 'normal', exitKey: 'exit1' });
    expect(untouched(three, [exit3])).toEqual(untouched(replaceSource(two, 'G_Combat02'), []));
    expectRoundTrip(three);
  });

  it('narrows around a surviving selection without touching anything else', () => {
    let wide = applyProjectCommand(replaceSource(oneDoorTakeover(), 'G_Combat02'), catalog, repair);
    const exit2 = `${source}:exit2`;
    const exit3 = `${source}:exit3`;
    wide = applyProjectCommand(wide, catalog, {
      kind: 'SetExitSelection',
      selection,
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    wide = customizeChain(wide, exit2);
    const drifted = replaceSource(wide, 'G_Combat04');
    expect(repairAvailable(drifted)).toBe(true);

    const narrowed = applyProjectCommand(drifted, catalog, repair);
    expect(takeoverDecision(narrowed)).toMatchObject({
      normal: {
        targets: [
          { exitKey: 'exit1', occurrenceId: shop },
          { exitKey: 'exit2', occurrenceId: exit2 },
        ],
      },
      selection: { kind: 'normal', exitKey: 'exit2' },
    });
    expect(untouched(narrowed, [])).toEqual(untouched(drifted, [exit3]));
    expect(occurrence(narrowed, exit3)).toBeUndefined();
    expectRoundTrip(narrowed);
  });

  it('falls back to the remaining Shop with a new chain when the selected door is removed', () => {
    let wide = applyProjectCommand(replaceSource(oneDoorTakeover(), 'G_Combat04'), catalog, repair);
    const exit2 = `${source}:exit2`;
    wide = applyProjectCommand(wide, catalog, {
      kind: 'SetExitSelection',
      selection,
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    expect(gTopology(wide).fixedRoomLinks.map((link) => link.sourceOccurrenceId)).toContain(exit2);

    const narrowed = applyProjectCommand(replaceSource(wide, 'G_MiniBoss02'), catalog, repair);
    const topology = gTopology(narrowed);
    expect(takeoverDecision(narrowed)).toMatchObject({
      normal: { targets: [{ exitKey: 'exit1', occurrenceId: shop }] },
      selection: { kind: 'derived' },
    });
    expect(topology.occurrences.some((candidate) => candidate.occurrenceId.startsWith(exit2))).toBe(
      false,
    );
    expect(topology.fixedRoomLinks).toEqual([
      { sourceOccurrenceId: shop, targetOccurrenceId: `${shop}:boss` },
      { sourceOccurrenceId: `${shop}:boss`, targetOccurrenceId: `${shop}:postboss` },
    ]);
    expect(occurrence(narrowed, shop)?.state).toMatchObject({
      kind: 'shop',
      shop: expect.any(Object),
    });
    expectRoundTrip(narrowed);
  });

  it('leaves several remaining doors unresolved when the selected door is removed', () => {
    let wide = applyProjectCommand(replaceSource(oneDoorTakeover(), 'G_Combat02'), catalog, repair);
    const exit3 = `${source}:exit3`;
    wide = applyProjectCommand(wide, catalog, {
      kind: 'SetExitSelection',
      selection,
      value: { kind: 'normal', exitKey: 'exit3' },
    });
    const narrowed = applyProjectCommand(replaceSource(wide, 'G_Combat04'), catalog, repair);
    expect(takeoverDecision(narrowed)).toMatchObject({
      normal: { targets: [{ exitKey: 'exit1' }, { exitKey: 'exit2' }] },
      selection: { kind: 'unresolved' },
    });
    const topology = gTopology(narrowed);
    expect(topology.fixedRoomLinks).toEqual([]);
    expect(topology.occurrences.some((candidate) => candidate.occurrenceId.startsWith(exit3))).toBe(
      false,
    );
    expectRoundTrip(narrowed);
  });

  it('reuses the derived identity when a removed door is added again', () => {
    const wide = applyProjectCommand(
      replaceSource(oneDoorTakeover(), 'G_Combat04'),
      catalog,
      repair,
    );
    const narrowed = applyProjectCommand(replaceSource(wide, 'G_MiniBoss02'), catalog, repair);
    const rewidened = applyProjectCommand(replaceSource(narrowed, 'G_Combat04'), catalog, repair);
    expect(takeoverDecision(rewidened).normal.targets).toEqual(
      takeoverDecision(wide).normal.targets,
    );
  });

  it('rejects an appended door whose derived identity is already owned', () => {
    const fork = createOccurrenceId('repair-fork');
    let project = applyProjectCommand(gProject(), catalog, {
      kind: 'CreateStart',
      biome: gBiome,
      occurrenceId: intro,
    });
    const introSource = { kind: 'occurrence' as const, occurrenceId: intro };
    const forkSource = { kind: 'occurrence' as const, occurrenceId: fork };
    for (const [owner, gameName, targets] of [
      [introSource, 'G_Combat04', [['exit1', fork]]],
      [
        forkSource,
        'G_MiniBoss02',
        [
          ['exit1', source],
          ['exit2', `${source}:exit2`],
        ],
      ],
    ] as const) {
      project = applyProjectCommand(project, catalog, {
        kind: 'CreateBatch',
        decision: createExitDecisionAddress(gBiome, owner),
      });
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceBatchRewardStore',
        rewardStore: createBatchRewardStoreAddress(gBiome, owner),
        storeKey: 'RunProgress',
      });
      for (const [exitKey, occurrenceId] of targets) {
        project = applyProjectCommand(project, catalog, {
          kind: 'CreateTarget',
          target: createTargetAddress(gBiome, owner, exitKey),
          occurrenceId: createOccurrenceId(occurrenceId),
          gameName,
        });
      }
    }
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(gBiome, forkSource),
      value: { kind: 'normal', exitKey: 'exit1' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTakeoverBatch',
      decision: sourceDecision,
      gameName: 'G_PreBoss01',
      targetOccurrenceIds: { exit1: shop },
    });
    const drifted = replaceSource(project, 'G_Combat04');
    expect(() => applyProjectCommand(drifted, catalog, repair)).toThrowError(
      expect.objectContaining({
        detail: `occurrence ${source}:exit2 is already structurally owned`,
      }),
    );
  });

  it('offers and accepts no repair for a single-door Preboss whose source gained doors', () => {
    const project = loadSurfaceNOPQCheckpoint();
    const topology = project.route.biomes.find((biome) => biome.biomeKey === 'Q')?.topology;
    const preboss = topology?.occurrences.find((candidate) => candidate.gameName === 'Q_PreBoss01');
    const owner = topology?.decisions.find(
      (candidate): candidate is ExitDecision =>
        candidate.kind === 'exit' &&
        candidate.normal.targets.some((target) => target.occurrenceId === preboss?.occurrenceId),
    );
    if (owner?.source.kind !== 'occurrence') throw new Error('missing Q Preboss source');
    const widened = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(qBiome, owner.source.occurrenceId),
      gameName: 'Q_Combat12',
    });
    const widenedTopology = widened.route.biomes.find((biome) => biome.biomeKey === 'Q')?.topology;
    const widenedDecision = widenedTopology?.decisions.find(
      (candidate): candidate is ExitDecision =>
        candidate.kind === 'exit' &&
        candidate.source.kind === 'occurrence' &&
        owner.source.kind === 'occurrence' &&
        candidate.source.occurrenceId === owner.source.occurrenceId,
    );
    const layout = catalog.biomeLayouts.byKey.Q;
    if (widenedTopology == null || widenedDecision === undefined || layout === undefined) {
      throw new Error('missing widened Q decision');
    }
    expect(
      takeoverBatchExitRepairAvailable(catalog, layout, widenedTopology, widenedDecision),
    ).toBe(false);
    expect(() =>
      applyProjectCommand(widened, catalog, {
        kind: 'ReconcileBatchExitCapacity',
        decision: createExitDecisionAddress(qBiome, owner.source),
      }),
    ).toThrowError(
      expect.objectContaining({ detail: 'Q_PreBoss01 cannot fill remaining normal exits' }),
    );
    // The out-of-depth source is rejected at its own incoming door.
    const incoming = widenedTopology.decisions.find(
      (candidate): candidate is ExitDecision =>
        candidate.kind === 'exit' &&
        candidate.normal.targets.some(
          (target) =>
            owner.source.kind === 'occurrence' && target.occurrenceId === owner.source.occurrenceId,
        ),
    );
    const incomingTarget = incoming?.normal.targets.find(
      (target) =>
        owner.source.kind === 'occurrence' && target.occurrenceId === owner.source.occurrenceId,
    );
    if (incoming === undefined || incomingTarget === undefined) {
      throw new Error('missing incoming Q door');
    }
    expect(
      simulateProject(catalog, widened).findings.map((finding) => [
        finding.code,
        semanticAddressKey(finding.origin),
      ]),
    ).toContainEqual([
      'targetRoomUnavailable',
      semanticAddressKey(createTargetAddress(qBiome, incoming.source, incomingTarget.exitKey)),
    ]);
  });
});
