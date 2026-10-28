import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createIncomingRewardAddress,
  createLevelResolutionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  semanticAddressKey,
  type HubRerollAddress,
  type ProjectDocument,
  type RoomActionAddress,
} from '@run-planner/engine/authored-project';
import { loadUnderworldFGCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { loadNemesisFieldsCheckpoint } from '@run-planner/test-fixtures/underworld';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import {
  requireWorkspaceBiome,
  projectStructuredWorkspaceFixture,
} from '@planner-test/fixtures/structuredWorkspace';
import {
  findingControlKey,
  type WorkspaceNode,
  type WorkspaceRewardOfferResolver,
} from '@planner/projections/structured-workspace';

const f = createBiomeAddress('Underworld', 'F');
const source = createOccurrenceId('golden-f-b2-e1');
const doorTo = createOccurrenceId('golden-f-b3-e1');
const door2To = createOccurrenceId('golden-f-b3-e2');

type Projected = ReturnType<typeof projectStructuredWorkspaceFixture>;

function withArcana(project: ProjectDocument, arcanaKeys: readonly string[]): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceManualArcanaSelection',
    route: { kind: 'route', routeKey: project.route.routeKey },
    arcanaKeys,
  });
}

/** The golden route's due F and G Boss Judgment draws, so the run reaches the Fields. */
function withGoldenJudgments(project: ProjectDocument): ProjectDocument {
  let next = project;
  for (const [biomeKey, arcanaKeys] of [
    ['F', ['ScreenReroll', 'StartingGold', 'HealthRegen', 'BonusDodge', 'TradeOff']],
    ['G', ['LowManaDamageBonus', 'CastCount', 'SorceryRegenUpgrade', 'CastBuff', 'BonusHealth']],
  ] as const)
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceJudgmentArcana',
      judgment: {
        kind: 'judgmentArcana',
        routeKey: 'Underworld',
        biomeKey,
        occurrenceId: createOccurrenceId(`golden-${biomeKey.toLowerCase()}-preboss-shop:boss`),
        phaseKey: 'Encounter',
      },
      arcanaKeys,
    });
  return next;
}

function batchOf(projected: Projected, biomeKey: string, occurrenceId: string) {
  const node = requireWorkspaceBiome(projected.workspace, biomeKey).nodes.find(
    (candidate): candidate is Extract<WorkspaceNode, { readonly kind: 'ordinaryBatch' }> =>
      candidate.kind === 'ordinaryBatch' &&
      candidate.source.kind === 'occurrence' &&
      candidate.source.occurrenceId === occurrenceId,
  );
  if (node === undefined) throw new Error(`${occurrenceId} has no projected doors`);
  return node;
}

function rerollsOf(projected: Projected, biomeKey = 'F', occurrenceId: string = source) {
  const rerolls = batchOf(projected, biomeKey, occurrenceId).rerolls;
  if (rerolls === undefined) throw new Error(`${occurrenceId} has no Rerolls list`);
  const interaction = projected.workspace.interactions.roomRerolls.get(rerolls.interactionKey);
  if (interaction === undefined) throw new Error(`${occurrenceId} Rerolls list is unbound`);
  return { rerolls, interaction };
}

/** The rewards a resolver's picker offers as possible at its type step. */
async function possibleRewards(resolver: WorkspaceRewardOfferResolver) {
  const model = resolver.model(await resolver.load(), 'type');
  return model.sections
    .flatMap((section) => section.items)
    .filter((item) => !item.disabled)
    .map((item) => item.value);
}

/** Appends a press through the bound list, with the first reward its picker offers. */
async function append(project: ProjectDocument, targetKey: string, skip = 0) {
  const { interaction } = rerollsOf(projectStructuredWorkspaceFixture(project));
  const rewards = (await possibleRewards(interaction.pendingReward(targetKey))).filter(
    (reward) => reward.payload === undefined,
  );
  const reward = rewards[skip] as ResolvedRewardOffer;
  return applyProjectCommand(project, catalog, interaction.appendIntent(targetKey, reward).command);
}

/** A room press's action address. */
function roomAction(address: RoomActionAddress | HubRerollAddress): RoomActionAddress {
  if (address.kind !== 'roomAction') throw new Error('a room press has a room action address');
  return address;
}

const doorKey = (occurrenceId: typeof doorTo) =>
  semanticAddressKey(createIncomingRewardAddress(f, occurrenceId));

describe('Room Doors Rerolls list', () => {
  const base = withArcana(loadUnderworldFGCheckpoint(), ['DoorReroll']);

  it('appears for a card holder with the pool and the engine targets', async () => {
    const projected = projectStructuredWorkspaceFixture(base);
    const { rerolls, interaction } = rerollsOf(projected);
    expect(rerolls).toMatchObject({ poolRemaining: 3, rows: [] });
    expect(rerolls.appendLocked).toBeUndefined();
    const targets = interaction.targets(undefined).sections.flatMap((section) => section.items);
    expect(targets.map((item) => [item.label, item.disabled])).toEqual([
      ['Door 1', false],
      ['Door 2', false],
    ]);
    // The pending press excludes its door's first draw.
    const rewards = await possibleRewards(interaction.pendingReward(doorKey(doorTo)));
    expect(rewards.length).toBeGreaterThan(0);
    expect(rewards).not.toContainEqual({ rewardType: 'MaxHealthDrop' });
    expect(interaction.appendIntent(doorKey(doorTo), { rewardType: 'RoomMoneyDrop' })).toEqual({
      command: {
        kind: 'InsertReroll',
        occurrence: createOccurrenceAddress(f, source),
        target: { kind: 'door', exitKey: 'exit1', occurrenceId: doorTo },
        reward: { rewardType: 'RoomMoneyDrop' },
        index: base.route.biomes[0]!.topology!.occurrences.find(
          (occurrence) => occurrence.occurrenceId === source,
        )!.roomActions.order.length,
      },
    });
  });

  it('is absent without the card and without presses', () => {
    expect(
      batchOf(projectStructuredWorkspaceFixture(loadUnderworldFGCheckpoint()), 'F', source).rerolls,
    ).toBeUndefined();
  });

  it('lists presses in order, labels each door first to final and edits a row', async () => {
    const twice = await append(await append(base, doorKey(door2To)), doorKey(doorTo), 1);
    const projected = projectStructuredWorkspaceFixture(twice);
    const { rerolls, interaction } = rerollsOf(projected);
    expect(rerolls.poolRemaining).toBe(1);
    expect(rerolls.rows.map((row) => row.targetLabel)).toEqual(['Door 2', 'Door 1']);
    const [first, second] = rerolls.rows;
    const doors = batchOf(projected, 'F', source).targets;
    expect(doors.map((door) => door.door.offerRewardSurface.rewards[0]?.rerolledSummary)).toEqual([
      expect.any(String),
      expect.any(String),
    ]);
    // A press's findings route to its row beside the doors.
    expect(projected.workspace.focusByOwner.get(semanticAddressKey(first!.address))).toMatchObject({
      roomTab: 'doors',
    });
    // The Timeline row names its door and new reward.
    const room = requireWorkspaceBiome(projected.workspace, 'F').nodes.find(
      (node) => node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === source,
    );
    const labels =
      room?.kind === 'occurrenceWorkbench'
        ? room.room.roomActions?.rows
            .filter((row) => row.reference.kind === 'reroll')
            .map((row) => row.label)
        : undefined;
    expect(labels).toEqual([
      expect.stringMatching(/^Reroll Door 2 → \S/),
      expect.stringMatching(/^Reroll Door 1 → \S/),
    ]);
    expect(interaction.replaceRewardIntent(second!.key, { rewardType: 'MaxManaDrop' })).toEqual({
      command: {
        kind: 'ReplaceRerollReward',
        action: second!.address,
        reward: { rewardType: 'MaxManaDrop' },
      },
    });
    expect(interaction.removeIntent(first!.key)).toEqual({
      command: { kind: 'RemoveRoomAction', action: first!.address },
    });
    expect((await possibleRewards(interaction.rowReward(second!.key))).length).toBeGreaterThan(0);
  });

  it("names a rerolled door's final reward in the next room's header and the rail", async () => {
    const projected = projectStructuredWorkspaceFixture(await append(base, doorKey(doorTo), 1));
    const biome = requireWorkspaceBiome(projected.workspace, 'F');
    const next = biome.nodes.find(
      (node) => node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === doorTo,
    );
    expect(
      next?.kind === 'occurrenceWorkbench'
        ? next.incomingDoor?.offerRewardSurface.rewards[0]
        : undefined,
    ).toMatchObject({
      offer: { rewardType: 'MaxHealthDrop' },
      rerolledOffer: { rewardType: 'StackUpgrade' },
    });
    const decision = biome.rail.find(
      (entry) =>
        entry.kind === 'node' &&
        (entry.node.kind === 'ordinaryBatch' || entry.node.kind === 'mixedBatch') &&
        entry.node.source.kind === 'occurrence' &&
        entry.node.source.occurrenceId === source,
    );
    expect(decision?.kind === 'node' ? decision.selectedTarget?.reward : undefined).toMatchObject({
      offer: { rewardType: 'StackUpgrade' },
    });
  });

  it('sends a misplaced press to its Timeline row, where it moves', async () => {
    const project = await append(base, doorKey(door2To));
    const [press] = rerollsOf(projectStructuredWorkspaceFixture(project)).rerolls.rows;
    const moved = applyProjectCommand(project, catalog, {
      kind: 'MoveRoomAction',
      action: roomAction(press!.address),
      toIndex: 0,
    });
    const projected = projectStructuredWorkspaceFixture(moved);
    expect(
      projected.evaluation.findings.some(
        (finding) =>
          finding.code === 'roomActionOrderUnavailable' &&
          semanticAddressKey(finding.origin) === semanticAddressKey(press!.address),
      ),
    ).toBe(true);
    expect(projected.workspace.focusByOwner.get(semanticAddressKey(press!.address))).toMatchObject({
      roomTab: 'actions',
    });
  });

  it('locks the next press at an empty pool and keeps rows after the card is removed', async () => {
    let project = base;
    for (const [target, skip] of [
      [door2To, 0],
      [doorTo, 1],
      [door2To, 2],
    ] as const)
      project = await append(project, doorKey(target), skip);
    expect(rerollsOf(projectStructuredWorkspaceFixture(project)).rerolls).toMatchObject({
      poolRemaining: 0,
      appendLocked: 'poolEmpty',
    });
    const removed = projectStructuredWorkspaceFixture(withArcana(project, []));
    const { rerolls } = rerollsOf(removed);
    expect(rerolls.rows).toHaveLength(3);
    expect(rerolls.appendLocked).toBeDefined();
    // The refused press is repaired by its Remove.
    const refused = removed.evaluation.findings.find(
      (finding) => finding.code === 'rerollUnavailable',
    );
    expect(refused?.origin).toEqual(rerolls.rows[0]!.address);
    expect(
      removed.workspace.findingsByRepairTarget.has(
        findingControlKey(rerolls.rows[0]!.address, 'delete'),
      ),
    ).toBe(true);
  });

  it('names a Fields cage by its door and cage', () => {
    const fields = withGoldenJudgments(withArcana(loadNemesisFieldsCheckpoint(), ['DoorReroll']));
    const projected = projectStructuredWorkspaceFixture(fields);
    const { interaction } = rerollsOf(projected, 'H', 'golden-h-intro');
    expect(
      interaction
        .targets(undefined)
        .sections.flatMap((section) => section.items)
        .map((item) => item.label),
    ).toContain('Door 1 Cage 1');
  });

  it('repairs a kept rerolled reward that no longer matches its last reroll', async () => {
    const pom = await append(base, doorKey(doorTo), 1);
    const resolved = applyProjectCommand(pom, catalog, {
      kind: 'ReplaceLevelResolution',
      levelResolution: createLevelResolutionAddress(createIncomingRewardAddress(f, doorTo), 'self'),
      value: { kind: 'choice', offeredTraitKeys: ['ZeusSpecialBoon'], selectedTraitKey: null },
    });
    const [press] = rerollsOf(projectStructuredWorkspaceFixture(resolved)).rerolls.rows;
    const changed = applyProjectCommand(resolved, catalog, {
      kind: 'ReplaceRerollReward',
      action: roomAction(press!.address),
      reward: { rewardType: 'RoomMoneyDrop' },
    });
    const projected = projectStructuredWorkspaceFixture(changed);
    const owner = createIncomingRewardAddress(f, doorTo);
    expect(
      batchOf(projected, 'F', source).targets[0]?.door.offerRewardSurface.rewards[0]
        ?.rerolledRewardRepair,
    ).toEqual({ owner, repair: 'adopt' });
    expect(
      projected.workspace.findingsByRepairTarget.has(findingControlKey(owner, 'rerolledReward')),
    ).toBe(true);
    // Without its reroll the kept reward is dropped instead.
    const removed = projectStructuredWorkspaceFixture(
      applyProjectCommand(resolved, catalog, {
        kind: 'RemoveRoomAction',
        action: roomAction(press!.address),
      }),
    );
    expect(
      batchOf(removed, 'F', source).targets[0]?.door.offerRewardSurface.rewards[0]
        ?.rerolledRewardRepair,
    ).toEqual({ owner, repair: 'drop' });
  });

  it("collects a rerolled door's final reward with its own details", async () => {
    // Door 1 rerolled into a Pom: the next room collects the Pom and resolves it.
    const project = await append(base, doorKey(doorTo), 1);
    const reroll = project.route.biomes[0]!.topology!.occurrences.find(
      (occurrence) => occurrence.occurrenceId === source,
    )!.roomActions.order.find((action) => action.kind === 'reroll');
    expect(reroll?.kind === 'reroll' && reroll.reward).toEqual({ rewardType: 'StackUpgrade' });
    const projected = projectStructuredWorkspaceFixture(project);
    const next = requireWorkspaceBiome(projected.workspace, 'F').nodes.find(
      (node) => node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === doorTo,
    );
    const collect =
      next?.kind === 'occurrenceWorkbench'
        ? next.room.roomActions?.rows.find((row) => row.reference.kind === 'interactIncomingReward')
        : undefined;
    expect(collect?.label).toMatch(/Pom/);
    expect(collect?.rewardPayload?.control).toMatchObject({
      offer: { rewardType: 'MaxHealthDrop' },
      rerolledOffer: { rewardType: 'StackUpgrade' },
    });
    expect(collect?.rewardPayload?.control.levelResolutions?.length).toBeGreaterThan(0);
  });
});
