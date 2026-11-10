import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createOccurrenceAddress,
  createBiomeAddress,
  createOccurrenceId,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { loadSurfaceNOCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
import {
  projectStructuredWorkspaceFixture,
  requireWorkspaceBiome,
} from '@planner-test/fixtures/structuredWorkspace';
import type { WorkspaceRewardOfferResolver } from '@planner/projections/structured-workspace';

const o = createBiomeAddress('Surface', 'O');
const ship = createOccurrenceId('surface-o-combat04');
const wheel = createRewardWheelAddress(o, ship, 'wheel1');

type Projected = ReturnType<typeof projectStructuredWorkspaceFixture>;

/** A door-reroll card holder whose N Boss Judgment is drawn, so the run reaches O. */
function cardHolder(): ProjectDocument {
  let project = applyProjectCommand(loadSurfaceNOCheckpoint(), catalog, {
    kind: 'ReplaceManualArcanaSelection',
    route: { kind: 'route', routeKey: 'Surface' },
    arcanaKeys: ['DoorReroll'],
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceJudgmentArcana',
    judgment: {
      kind: 'judgmentArcana',
      routeKey: 'Surface',
      biomeKey: 'N',
      occurrenceId: createOccurrenceId('surface-n-preboss:boss'),
      phaseKey: 'Encounter',
    },
    arcanaKeys: ['ScreenReroll', 'TradeOff', 'StartingGold', 'HealthRegen', 'BonusDodge'],
  });
  return project;
}

function shipRoom(projected: Projected) {
  const node = requireWorkspaceBiome(projected.workspace, 'O').nodes.find(
    (candidate) => candidate.kind === 'occurrenceWorkbench' && candidate.room.occurrenceId === ship,
  );
  if (node?.kind !== 'occurrenceWorkbench' || node.room.workbench.kind !== 'ship')
    throw new Error('the ship room is not projected');
  return node.room;
}

function wheelPhase(projected: Projected) {
  const room = shipRoom(projected);
  const phase =
    room.workbench.kind === 'ship'
      ? room.workbench.phases.find((candidate) => candidate.wheel?.key === 'wheel1')
      : undefined;
  if (phase === undefined) throw new Error('wheel1 has no phase');
  return phase;
}

async function possibleRewards(resolver: WorkspaceRewardOfferResolver) {
  const model = resolver.model(await resolver.load(), 'type');
  return model.sections
    .flatMap((section) => section.items)
    .filter((item) => !item.disabled && item.value.payload === undefined)
    .map((item) => item.value);
}

describe('ship wheels on their phase Timeline', () => {
  it('opens the wheel after the Intro on the Intro Timeline, with its pool and offer targets', () => {
    const projected = projectStructuredWorkspaceFixture(cardHolder());
    const phase = wheelPhase(projected);
    expect(phase).toMatchObject({ tab: 'shipIntroActions', wheel: { key: 'wheel1' } });
    expect(phase.wheelRerolls).toMatchObject({ poolRemaining: 10, targetNoun: 'offer', rows: [] });
    // The Timeline keeps only its Wheels open marker.
    const wheelsOpen = phase.timeline.find(
      (entry) => entry.kind === 'boundary' && entry.boundary.kind === 'wheelsOpen',
    );
    expect(wheelsOpen).toBeDefined();
    expect(wheelsOpen?.kind === 'boundary' ? wheelsOpen.supplement : undefined).toBeUndefined();
    for (const owner of [wheel, createRewardWheelOfferAddress(o, ship, 'wheel1', 'offer1')])
      expect(projected.workspace.focusByOwner.get(semanticAddressKey(owner))).toMatchObject({
        roomTab: 'shipIntroActions',
      });
    const interaction = projected.workspace.interactions.roomRerolls.get(
      phase.wheelRerolls!.interactionKey,
    );
    expect(
      interaction
        ?.targets(undefined)
        .sections.flatMap((section) => section.items)
        .map((item) => item.label),
    ).toEqual(['Offer']);
  });

  it('appends a press before the pick and shows the offer first to final', async () => {
    const base = cardHolder();
    const before = projectStructuredWorkspaceFixture(base);
    const list = wheelPhase(before).wheelRerolls!;
    const interaction = before.workspace.interactions.roomRerolls.get(list.interactionKey)!;
    const [targetKey] = interaction
      .targets(undefined)
      .sections.flatMap((section) => section.items)
      .map((item) => item.value);
    const [reward] = await possibleRewards(interaction.pendingReward(targetKey!));
    const intent = interaction.appendIntent(targetKey!, reward as ResolvedRewardOffer);
    const order = base.route.biomes
      .find((biome) => biome.biomeKey === 'O')!
      .topology!.occurrences.find((occurrence) => occurrence.occurrenceId === ship)!.roomActions
      .order;
    expect(intent.command.index).toBe(
      order.findIndex(
        (action) => action.kind === 'chooseRewardWheel' && action.wheelKey === 'wheel1',
      ),
    );
    const projected = projectStructuredWorkspaceFixture(
      applyProjectCommand(base, catalog, intent.command),
    );
    const phase = wheelPhase(projected);
    expect(phase.wheelRerolls?.rows.map((row) => row.targetLabel)).toEqual(['Offer']);
    expect(phase.wheelRerolls?.poolRemaining).toBe(9);
    expect(phase.wheel?.offers[0]).toMatchObject({ rerolledOffer: reward });
    // The picked offer is collected as the reward its rerolls left.
    expect(phase.wheel?.offers[0]?.control.rerolledOffer).toEqual(reward);
    const press = phase.wheelRerolls!.rows[0]!;
    expect(projected.workspace.focusByOwner.get(semanticAddressKey(press.address))).toMatchObject({
      roomTab: 'shipIntroActions',
    });
    // The press names its offer, the reward it replaces and the offers once it lands.
    expect(press.doors).toMatchObject({
      doorLabel: 'Offer',
      before: wheelPhase(before).wheel!.offers[0]!.control.offer,
      after: [{ exitKey: 'offer1', rewards: [reward] }],
    });
    // The Timeline row names the offer and links to the wheel.
    const row = shipRoom(projected).roomActions?.rows.find(
      (candidate) =>
        press.address.kind === 'roomAction' && candidate.key === press.address.actionKey,
    );
    expect(row?.label).toMatch(/^Reroll Offer → \S/);
  });

  it('opens each wheel at Wheels open and leaves no next-phase checkpoint row in any phase', () => {
    const threePhase = createOccurrenceId('surface-o-combat07');
    const wheel2 = createRewardWheelAddress(o, threePhase, 'wheel2');
    const project = [
      { kind: 'ReplaceRewardWheelOfferCount', wheel: wheel2, offerCount: 1 },
      { kind: 'ReplaceRewardWheelStore', wheel: wheel2, storeKey: 'RunProgress' },
      {
        kind: 'ReplaceRewardWheelOffer',
        offer: createRewardWheelOfferAddress(o, threePhase, 'wheel2', 'offer1'),
        value: { rewardType: 'RoomMoneyDrop' },
      },
      {
        kind: 'ReplaceShipEncounterCount',
        occurrence: createOccurrenceAddress(o, threePhase),
        encounterCount: 3,
      },
    ].reduce(
      (current, command) =>
        applyProjectCommand(current, catalog, command as Parameters<typeof applyProjectCommand>[2]),
      cardHolder(),
    );
    const node = requireWorkspaceBiome(
      projectStructuredWorkspaceFixture(authorLegalTraitOffers(project)).workspace,
      'O',
    ).nodes.find(
      (candidate) =>
        candidate.kind === 'occurrenceWorkbench' && candidate.room.occurrenceId === threePhase,
    );
    if (node?.kind !== 'occurrenceWorkbench') throw new Error('the ship room is not projected');
    const room = node.room;
    if (room.workbench.kind !== 'ship') throw new Error('the ship room is not projected');
    const wheelsOpen = room.workbench.phases.map((phase) =>
      phase.timeline.flatMap((entry) =>
        entry.kind === 'boundary' && entry.boundary.kind === 'wheelsOpen'
          ? [entry.boundary.wheelKey]
          : [],
      ),
    );
    expect(wheelsOpen).toEqual([['wheel1'], ['wheel2'], []]);
    for (const phase of room.workbench.phases) {
      expect(phase.checkpoints.map((checkpoint) => checkpoint.key)).not.toContainEqual(
        expect.stringMatching(/^nextPhase/),
      );
      expect(phase.checkpoints.map((checkpoint) => checkpoint.label)).not.toContainEqual(
        expect.stringContaining('ready to advance'),
      );
    }
  });
});
