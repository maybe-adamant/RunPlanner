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
  createProjectAddress,
  createShopOfferAddress,
  createTargetAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  semanticAddressKey,
  type BiomeTopology,
  type ExitDecision,
  type ProjectCommand,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { settleProjectEdit, simulateProjectAssembly } from '@run-planner/engine/simulation';
import { replaceTestShopOfferActions } from '@run-planner/test-fixtures/shared';
import { loadSurfaceNOPQCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import { createCompleteFGProject, goldenGBiome } from '@run-planner/test-fixtures/underworld';

import {
  fBiome,
  fProject,
  gBiome,
  gProject,
  qBiome,
} from '../../authored-project/support/configured-projects';

const evaluate = (project: ProjectDocument) => simulateProjectAssembly(catalog, project);
const settle = (project: ProjectDocument, command: ProjectCommand) =>
  settleProjectEdit({ catalog, before: evaluate(project), command, evaluate });
const settled = (project: ProjectDocument, command: ProjectCommand) =>
  settle(project, command).assembly.project;

const intro = createOccurrenceId('capacity-intro');
const source = createOccurrenceId('capacity-source');
const shop = createOccurrenceId('capacity-shop');
const sourceDecision = createExitDecisionAddress(gBiome, {
  kind: 'occurrence',
  occurrenceId: source,
});
const selection = createExitSelectionAddress(gBiome, sourceDecision.source);

function topologyOf(project: ProjectDocument, biomeKey: string): BiomeTopology {
  const topology = project.route.biomes.find((biome) => biome.biomeKey === biomeKey)?.topology;
  if (topology == null) throw new Error(`missing ${biomeKey} topology`);
  return topology;
}

function decisionOf(project: ProjectDocument, biomeKey: string, occurrenceId: string) {
  const decision = topologyOf(project, biomeKey).decisions.find(
    (candidate): candidate is ExitDecision =>
      candidate.kind === 'exit' &&
      candidate.source.kind === 'occurrence' &&
      candidate.source.occurrenceId === occurrenceId,
  );
  if (decision === undefined) throw new Error(`missing ${occurrenceId} decision`);
  return decision;
}

const takeoverDecision = (project: ProjectDocument) => decisionOf(project, 'G', source);

function occurrence(project: ProjectDocument, occurrenceId: string) {
  return topologyOf(project, 'G').occurrences.find(
    (candidate) => candidate.occurrenceId === occurrenceId,
  );
}

function replaceSource(project: ProjectDocument, gameName: string): ProjectDocument {
  return settled(project, {
    kind: 'ReplaceOccurrenceRoom',
    occurrence: createOccurrenceAddress(gBiome, source),
    gameName,
  });
}

function findingsAt(project: ProjectDocument, origin: Parameters<typeof semanticAddressKey>[0]) {
  return evaluate(project)
    .evaluation.findings.filter(
      (finding) => semanticAddressKey(finding.origin) === semanticAddressKey(origin),
    )
    .map((finding) => finding.code);
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

/** Every topology member except the named occurrences, which settlement may add or remove. */
function untouched(project: ProjectDocument, changed: readonly string[]) {
  const topology = topologyOf(project, 'G');
  return {
    occurrences: topology.occurrences.filter(
      (candidate) => !changed.includes(candidate.occurrenceId) && candidate.occurrenceId !== source,
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

const exit2 = `${source}:exit2`;
const exit3 = `${source}:exit3`;

describe('exit capacity settlement', () => {
  it('fills a takeover batch to its swapped source room’s doors, leaving each new reward to choose', () => {
    const narrow = oneDoorTakeover();
    const two = replaceSource(narrow, 'G_Combat04');
    expect(takeoverDecision(two)).toMatchObject({
      normal: {
        targets: [
          { exitKey: 'exit1', occurrenceId: shop },
          { exitKey: 'exit2', occurrenceId: exit2 },
        ],
      },
      selection: { kind: 'normal', exitKey: 'exit1' },
    });
    expect(untouched(two, [exit2])).toEqual(untouched(narrow, []));
    expect(occurrence(two, exit2)).toMatchObject({
      gameName: 'G_PreBoss01',
      state: { kind: 'freeReward' },
    });
    expect(occurrence(two, shop)?.roomActions.order).toContainEqual({
      kind: 'interactShopOffer',
      offerKey: 'MajorNonBoon',
    });
    expectRoundTrip(two);

    const three = replaceSource(two, 'G_Combat02');
    expect(takeoverDecision(three).normal.targets).toEqual([
      { exitKey: 'exit1', occurrenceId: shop },
      { exitKey: 'exit2', occurrenceId: exit2 },
      { exitKey: 'exit3', occurrenceId: exit3 },
    ]);
    expect(takeoverDecision(three).selection).toEqual({ kind: 'normal', exitKey: 'exit1' });
    expect(untouched(three, [exit3])).toEqual(untouched(two, []));
    expectRoundTrip(three);
  });

  // The edit the owner hit: the room before the Preboss swapped from two doors to one
  // while its Shop stayed selected left the free-reward door planned behind no door.
  it('takes an unselected takeover door with the room swap that leaves its source without it', () => {
    const wide = replaceSource(oneDoorTakeover(), 'G_Combat04');
    const settlement = settle(wide, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(gBiome, source),
      gameName: 'G_MiniBoss02',
    });
    const narrowed = settlement.assembly.project;
    expect(takeoverDecision(narrowed)).toMatchObject({
      normal: { targets: [{ exitKey: 'exit1', occurrenceId: shop }] },
      selection: { kind: 'derived' },
    });
    expect(occurrence(narrowed, exit2)).toBeUndefined();
    expect(untouched(narrowed, [])).toEqual(untouched(wide, [exit2]));
    // The swapped room is the one the edit addresses, so its doors change silently.
    expect(settlement.removedStaleActions).toBeUndefined();
    expectRoundTrip(narrowed);

    // A door removed and added again keeps its identity.
    expect(takeoverDecision(replaceSource(narrowed, 'G_Combat04')).normal.targets).toEqual(
      takeoverDecision(wide).normal.targets,
    );
  });

  it('narrows around a surviving selection without touching anything else', () => {
    let wide = replaceSource(oneDoorTakeover(), 'G_Combat02');
    wide = applyProjectCommand(wide, catalog, {
      kind: 'SetExitSelection',
      selection,
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    wide = customizeChain(wide, exit2);
    const narrowed = replaceSource(wide, 'G_Combat04');
    expect(takeoverDecision(narrowed)).toMatchObject({
      normal: {
        targets: [
          { exitKey: 'exit1', occurrenceId: shop },
          { exitKey: 'exit2', occurrenceId: exit2 },
        ],
      },
      selection: { kind: 'normal', exitKey: 'exit2' },
    });
    expect(untouched(narrowed, [])).toEqual(untouched(wide, [exit3]));
    expectRoundTrip(narrowed);
  });

  it('keeps a selected takeover door its source lost, blocking, until another door is chosen', () => {
    let wide = replaceSource(oneDoorTakeover(), 'G_Combat04');
    wide = settled(wide, {
      kind: 'SetExitSelection',
      selection,
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    const narrowed = replaceSource(wide, 'G_MiniBoss02');
    expect(takeoverDecision(narrowed)).toMatchObject({
      normal: {
        targets: [
          { exitKey: 'exit1', occurrenceId: shop },
          { exitKey: 'exit2', occurrenceId: exit2 },
        ],
      },
      selection: { kind: 'normal', exitKey: 'exit2' },
    });
    expect(
      topologyOf(narrowed, 'G').fixedRoomLinks.map((link) => link.sourceOccurrenceId),
    ).toContain(exit2);

    // Taking the remaining door lets the lost one go, and the Shop gains the chain.
    const repaired = settled(narrowed, {
      kind: 'SetExitSelection',
      selection,
      value: { kind: 'normal', exitKey: 'exit1' },
    });
    expect(takeoverDecision(repaired)).toMatchObject({
      normal: { targets: [{ exitKey: 'exit1', occurrenceId: shop }] },
      selection: { kind: 'derived' },
    });
    const topology = topologyOf(repaired, 'G');
    expect(topology.occurrences.some((candidate) => candidate.occurrenceId.startsWith(exit2))).toBe(
      false,
    );
    expect(topology.fixedRoomLinks).toEqual([
      { sourceOccurrenceId: shop, targetOccurrenceId: `${shop}:boss` },
      { sourceOccurrenceId: `${shop}:boss`, targetOccurrenceId: `${shop}:postboss` },
    ]);
    expectRoundTrip(repaired);
  });

  it('announces doors taken from a room the edit does not address', () => {
    // An older file whose source was swapped before settlement owned its doors.
    const drifted = applyProjectCommand(replaceSource(oneDoorTakeover(), 'G_Combat04'), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(gBiome, source),
      gameName: 'G_MiniBoss02',
    });
    expect(takeoverDecision(drifted).normal.targets).toHaveLength(2);

    // An edit that addresses no single room announces every removal.
    const settlement = settle(drifted, {
      kind: 'RenameProject',
      project: createProjectAddress(),
      name: 'Renamed',
    });
    expect(takeoverDecision(settlement.assembly.project).normal.targets).toEqual([
      { exitKey: 'exit1', occurrenceId: shop },
    ]);
    expect(settlement.removedStaleActions).toEqual([
      {
        occurrence: createOccurrenceAddress(gBiome, source),
        actions: [],
        doors: [{ exitKey: 'exit2', occurrenceId: exit2, gameName: 'G_PreBoss01' }],
      },
    ]);
  });

  it('reports a fault when a door it would add is already owned', () => {
    const fork = createOccurrenceId('capacity-fork');
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
          ['exit2', exit2],
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
    const settlement = settle(project, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(gBiome, source),
      gameName: 'G_Combat04',
    });
    expect(settlement.fault).toEqual({
      key: `exitCapacity:${semanticAddressKey(sourceDecision)}`,
      owner: sourceDecision,
    });
  });

  it('adds no door for a single-door Preboss whose source gained doors', () => {
    const project = loadSurfaceNOPQCheckpoint();
    const topology = topologyOf(project, 'Q');
    const preboss = topology.occurrences.find((candidate) => candidate.gameName === 'Q_PreBoss01');
    const owner = topology.decisions.find(
      (candidate): candidate is ExitDecision =>
        candidate.kind === 'exit' &&
        candidate.normal.targets.some((target) => target.occurrenceId === preboss?.occurrenceId),
    );
    if (owner?.source.kind !== 'occurrence') throw new Error('missing Q Preboss source');
    const settlement = settle(project, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(qBiome, owner.source.occurrenceId),
      gameName: 'Q_Combat12',
    });
    expect(settlement.fault).toBeUndefined();
    const widened = settlement.assembly.project;
    expect(decisionOf(widened, 'Q', owner.source.occurrenceId).normal.targets).toEqual(
      owner.normal.targets,
    );
    // The out-of-depth source is rejected at its own incoming door.
    const incoming = topologyOf(widened, 'Q').decisions.find(
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
      findingsAt(widened, createTargetAddress(qBiome, incoming.source, incomingTarget.exitKey)),
    ).toContain('targetRoomUnavailable');
  });

  it('takes an unselected ordinary door its swapped source lacks and keeps a selected one', () => {
    const opening = createOccurrenceId('capacity-opening');
    let project = applyProjectCommand(fProject(), catalog, {
      kind: 'CreateStart',
      biome: fBiome,
      occurrenceId: opening,
      gameName: 'F_Opening01',
    });
    const openingSource = { kind: 'occurrence' as const, occurrenceId: opening };
    const fSource = { kind: 'occurrence' as const, occurrenceId: source };
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: createExitDecisionAddress(fBiome, openingSource),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, openingSource),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, openingSource, 'exit1'),
      occurrenceId: source,
      gameName: 'F_Combat02',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateBatch',
      decision: createExitDecisionAddress(fBiome, fSource),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, fSource),
      storeKey: 'RunProgress',
    });
    for (const exitKey of ['exit1', 'exit2']) {
      project = applyProjectCommand(project, catalog, {
        kind: 'CreateTarget',
        target: createTargetAddress(fBiome, fSource, exitKey),
        occurrenceId: createOccurrenceId(`capacity-${exitKey}`),
        gameName: 'F_Combat01',
      });
    }
    const swap = {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(fBiome, source),
      gameName: 'F_Combat01',
    } as const;

    for (const selected of ['exit1', 'exit2'] as const) {
      const chosen = applyProjectCommand(project, catalog, {
        kind: 'SetExitSelection',
        selection: createExitSelectionAddress(fBiome, fSource),
        value: { kind: 'normal', exitKey: selected },
      });
      const swapped = settled(chosen, swap);
      const decision = decisionOf(swapped, 'F', source);
      if (selected === 'exit1') {
        expect(decision).toMatchObject({
          normal: { targets: [{ exitKey: 'exit1', occurrenceId: 'capacity-exit1' }] },
          selection: { kind: 'derived' },
        });
        expect(
          topologyOf(swapped, 'F').occurrences.map((candidate) => candidate.occurrenceId),
        ).not.toContain('capacity-exit2');
      } else {
        expect(decision).toMatchObject({
          normal: { targets: [{ exitKey: 'exit1' }, { exitKey: 'exit2' }] },
          selection: { kind: 'normal', exitKey: 'exit2' },
        });
      }
    }
  });

  it('keeps a complete plan valid when a picked miniboss swap leaves its source one door', () => {
    const project = createCompleteFGProject({ pickedMiniboss: 'G_MiniBoss02' });
    expect(
      decisionOf(project, 'G', 'golden-g-b6-e1').normal.targets.map((target) => target.exitKey),
    ).toEqual(['exit1']);
    expect(evaluate(project).evaluation.summary.eligibleForExecutionPlan).toBe(true);
  });

  describe('a complete plan whose room before the Preboss loses a door', () => {
    const prebossSource = createOccurrenceId('golden-g-b7-e1');
    const doors = (project: ProjectDocument) =>
      decisionOf(project, 'G', prebossSource).normal.targets.map((target) => target.exitKey);
    const lostDoor = createTargetAddress(
      goldenGBiome,
      { kind: 'occurrence', occurrenceId: prebossSource },
      'exit3',
    );
    const swap = {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenGBiome, prebossSource),
      gameName: 'G_Combat12',
    } as const;
    const wide = () => createCompleteFGProject({ prebossSource: 'G_Combat14' });

    it('settles to a valid plan publishing only the doors its room has', () => {
      expect(doors(wide())).toEqual(['exit1', 'exit2', 'exit3']);
      const narrowed = settled(wide(), swap);
      expect(doors(narrowed)).toEqual(['exit1', 'exit2']);
      expect(evaluate(narrowed).evaluation.summary.eligibleForExecutionPlan).toBe(true);
    });

    it('blocks a drifted older file instead of publishing the missing door', () => {
      const drifted = applyProjectCommand(wide(), catalog, swap);
      expect(doors(drifted)).toEqual(['exit1', 'exit2', 'exit3']);
      expect(findingsAt(drifted, lostDoor)).toEqual(['targetRoomUnavailable']);
      expect(evaluate(drifted).evaluation.summary.eligibleForExecutionPlan).toBe(false);
    });

    it('keeps the lost door when it is the one taken, with its finding', () => {
      const chosen = settled(wide(), {
        kind: 'SetExitSelection',
        selection: createExitSelectionAddress(goldenGBiome, {
          kind: 'occurrence',
          occurrenceId: prebossSource,
        }),
        value: { kind: 'normal', exitKey: 'exit3' },
      });
      const narrowed = settled(chosen, swap);
      expect(doors(narrowed)).toEqual(['exit1', 'exit2', 'exit3']);
      expect(findingsAt(narrowed, lostDoor)).toEqual(['targetRoomUnavailable']);
      expect(evaluate(narrowed).evaluation.summary.eligibleForExecutionPlan).toBe(false);
    });
  });
});
