import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createHubDecisionAddress,
  createIncomingRewardAddress,
  rerollAppendIndex,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { loadSurfaceNProject, nBiome } from '@run-planner/test-fixtures/surface';
import {
  projectStructuredWorkspaceFixture,
  requireWorkspaceBiome,
} from '@planner-test/fixtures/structuredWorkspace';
import type {
  WorkspaceHubDecisionNode,
  WorkspaceRewardOfferResolver,
} from '@planner/projections/structured-workspace';

const hub = createHubDecisionAddress(nBiome, 'hub');
type Projected = ReturnType<typeof projectStructuredWorkspaceFixture>;

function withArcana(project: ProjectDocument, arcanaKeys: readonly string[]): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceManualArcanaSelection',
    route: { kind: 'route', routeKey: project.route.routeKey },
    arcanaKeys,
  });
}

function hubOf(projected: Projected): WorkspaceHubDecisionNode {
  const node = requireWorkspaceBiome(projected.workspace, 'N').nodes.find(
    (candidate) => candidate.kind === 'hubDecision',
  );
  if (node?.kind !== 'hubDecision') throw new Error('N has no projected Hub');
  return node;
}

function stayList(projected: Projected, precedingVisitCount: number) {
  const rerolls = hubOf(projected).stays[precedingVisitCount]?.rerolls;
  if (rerolls === undefined) throw new Error(`stay ${precedingVisitCount} has no Rerolls list`);
  const interaction = projected.workspace.interactions.roomRerolls.get(rerolls.interactionKey);
  if (interaction === undefined) throw new Error(`stay ${precedingVisitCount} list is unbound`);
  return { rerolls, interaction };
}

function slotDoorKey(project: ProjectDocument, hubSlotKey: string): string {
  const topology = project.route.biomes.find((biome) => biome.biomeKey === 'N')?.topology;
  const decision = topology?.decisions.find((candidate) => candidate.kind === 'hub');
  const target =
    decision?.kind === 'hub'
      ? decision.openTargets.find((candidate) => candidate.hubSlotKey === hubSlotKey)
      : undefined;
  if (target === undefined) throw new Error(`${hubSlotKey} is not open`);
  return semanticAddressKey(createIncomingRewardAddress(nBiome, target.occurrenceId));
}

async function possibleRewards(resolver: WorkspaceRewardOfferResolver) {
  const model = resolver.model(await resolver.load(), 'type');
  return model.sections
    .flatMap((section) => section.items)
    .filter((item) => !item.disabled)
    .map((item) => item.value as ResolvedRewardOffer);
}

/** Appends a press to one stay through its bound list, with the first reward it offers. */
async function append(project: ProjectDocument, precedingVisitCount: number, hubSlotKey: string) {
  const { interaction } = stayList(projectStructuredWorkspaceFixture(project), precedingVisitCount);
  const key = slotDoorKey(project, hubSlotKey);
  const [reward] = await possibleRewards(interaction.pendingReward(key));
  const intent = interaction.appendIntent(key, reward!);
  return { intent, next: applyProjectCommand(project, catalog, intent.command), reward: reward! };
}

describe('Hub Timeline details', () => {
  // Visits: combat05, miniBoss01, combat02, combat11, combat23, then combat09.
  const base = withArcana(loadSurfaceNProject(), ['DoorReroll']);

  it('lays out each stay with its rerolls, the board it leaves and the fountain moves', () => {
    const projected = projectStructuredWorkspaceFixture(base);
    const node = hubOf(projected);
    expect(node.stays.map((stay) => stay.precedingVisitCount)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(node.stays[0]).not.toHaveProperty('board');
    expect(stayList(projected, 0).rerolls).toMatchObject({ poolRemaining: 3, rows: [] });
    // The board after a visit closes the door it entered, and its list no longer names it.
    const afterFirst = node.stays[1]!;
    expect(afterFirst.board?.find((door) => door.hubSlotKey === 'combat05')?.entered).toBe(true);
    expect(afterFirst.board?.find((door) => door.hubSlotKey === 'combat03')?.entered).toBe(false);
    const targets = stayList(projected, 1)
      .interaction.targets(undefined)
      .sections.flatMap((section) => section.items.map((item) => item.value));
    expect(targets).not.toContain(slotDoorKey(base, 'combat05'));
    expect(targets).toContain(slotDoorKey(base, 'combat03'));
    // The fountain moves to any other stay; the stay holding it offers no move.
    const fountainStays = node.stays.filter((stay) => stay.fountain !== undefined);
    expect(fountainStays.length).toBeLessThanOrEqual(1);
    for (const stay of node.stays)
      expect(stay.fountainActions === undefined).toBe(stay.fountain !== undefined);
  });

  it("appends, edits and removes a stay's press through its list", async () => {
    const before = hubOf(projectStructuredWorkspaceFixture(base));
    const { intent, next, reward } = await append(base, 2, 'combat03');
    expect(intent.command).toEqual({
      kind: 'InsertHubReroll',
      hub,
      hubSlotKey: 'combat03',
      reward,
      index: rerollAppendIndex(base, { kind: 'hubStay', hub, precedingVisitCount: 2 }),
    });
    const projected = projectStructuredWorkspaceFixture(next);
    const node = hubOf(projected);
    const { rerolls, interaction } = stayList(projected, 2);
    const slot = node.slots.find((candidate) => candidate.hubSlotKey === 'combat03')!;
    expect(rerolls.rows).toMatchObject([{ reward, targetLabel: slot.label }]);
    expect(rerolls.poolRemaining).toBe(2);
    // The door reads first draw → final on the board after the stay and on the map.
    const door = node.stays[2]!.board!.find((entry) => entry.hubSlotKey === 'combat03')!;
    expect(door.rerolledSummary).toBeDefined();
    expect(
      node.stays[1]!.board!.find((entry) => entry.hubSlotKey === 'combat03'),
    ).not.toHaveProperty('rerolledSummary');
    expect(slot.door?.offerRewardSurface.rewards[0]?.rerolledOffer).toEqual(reward);
    // Visit steps count the visits and the fountain the map shows, not rerolls.
    expect(node.visits.map((visit) => visit.actionPosition)).toEqual(
      before.visits.map((visit) => visit.actionPosition),
    );
    expect(node.fountain.actionPosition).toBe(before.fountain.actionPosition);
    // The press is repaired in its stay's list on Hub Timeline.
    const row = rerolls.rows[0]!;
    expect(projected.workspace.focusByOwner.get(semanticAddressKey(row.address))).toMatchObject({
      hubTab: 'timeline',
      nodeKey: node.key,
    });
    expect(row.address.kind).toBe('hubReroll');
    if (row.address.kind !== 'hubReroll') return;
    expect(interaction.replaceRewardIntent(row.key, { rewardType: 'Boon' })).toEqual({
      command: {
        kind: 'ReplaceHubRerollReward',
        reroll: row.address,
        reward: { rewardType: 'Boon' },
      },
    });
    expect(interaction.removeIntent(row.key)).toEqual({
      command: { kind: 'RemoveHubReroll', reroll: row.address },
    });
    expect(await possibleRewards(interaction.rowReward(row.key))).toContainEqual(reward);
  });

  it('shows a list without the card only while the Hub holds presses', async () => {
    const projected = projectStructuredWorkspaceFixture(loadSurfaceNProject());
    expect(hubOf(projected).stays.every((stay) => stay.rerolls === undefined)).toBe(true);
    const { next } = await append(base, 0, 'combat03');
    const withoutCard = projectStructuredWorkspaceFixture(withArcana(next, []));
    const node = hubOf(withoutCard);
    expect(node.stays[0]!.rerolls).toMatchObject({ appendLocked: 'notEnabled' });
    expect(node.stays.slice(1).every((stay) => stay.rerolls === undefined)).toBe(true);
    const row = node.stays[0]!.rerolls!.rows[0]!;
    expect(
      withoutCard.workspace.findingsByRepairTarget.get(semanticAddressKey(row.address))?.length,
    ).toBeGreaterThan(0);
  });

  it('blocks a press past the pool ahead of the edit', async () => {
    let project = base;
    for (const hubSlotKey of ['combat03', 'combat09', 'combat11'])
      project = (await append(project, 0, hubSlotKey)).next;
    const projected = projectStructuredWorkspaceFixture(project);
    expect(stayList(projected, 0).rerolls).toMatchObject({
      appendLocked: 'poolEmpty',
      poolRemaining: 0,
    });
    expect(stayList(projected, 3).rerolls.appendLocked).toBe('poolEmpty');
  });
});
