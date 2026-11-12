import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createEncounterPhaseAddress,
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
import {
  authorLegalTraitOffers,
  authorTestTraitsAndRequiredItems,
  purchaseTestHermesShrineOffer,
} from '@run-planner/test-fixtures/shared';
import {
  oOccurrenceIds,
  placeDueHermesShrineDeliveries,
  surfaceShrineDeliveriesProject,
  surfaceShrineDeliverySources,
} from '@run-planner/test-fixtures/surface';
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

/** A three-phase O room whose Combat 1 end matures a Hermes Shrine delivery. */
function threePhaseDeliveryProject(): ProjectDocument {
  const { oShrine } = surfaceShrineDeliverySources;
  const occurrence = createOccurrenceAddress(o, oOccurrenceIds.combat02);
  let project = applyProjectCommand(surfaceShrineDeliveriesProject(), catalog, {
    kind: 'ReplaceShipEncounterCount',
    occurrence,
    encounterCount: 3,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SelectEncounter',
    phase: createEncounterPhaseAddress(o, occurrence, 'Combat1'),
    encounterKey: 'IcarusCombatO',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceHermesShrineOffer',
    occurrence: oShrine,
    slotKey: 'secondLeft',
    value: { rewardType: 'MaxHealthDrop' },
  });
  project = purchaseTestHermesShrineOffer(project, catalog, oShrine, 'initial:secondLeft', {
    delay: 5,
    rushed: false,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceRewardWheelStore',
    wheel: createRewardWheelAddress(o, oOccurrenceIds.combat02, 'wheel2'),
    storeKey: 'RunProgress',
  });
  project = authorTestTraitsAndRequiredItems(
    applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: createRewardWheelOfferAddress(o, oOccurrenceIds.combat02, 'wheel2', 'offer1'),
      value: { rewardType: 'RoomMoneyDrop' },
    }),
  );
  return project;
}

describe('ship wheels on the Timeline of the phase before their combat', () => {
  it('opens the wheel on the tab before its combat, with its pool and offer targets', () => {
    const projected = projectStructuredWorkspaceFixture(cardHolder());
    const phase = wheelPhase(projected);
    expect(phase).toMatchObject({ tab: 'shipIntroActions', wheel: { key: 'wheel1' } });
    expect(phase.wheelRerolls).toMatchObject({ poolRemaining: 10, targetNoun: 'offer', rows: [] });
    // The Timeline keeps only its Wheels open marker.
    const wheelsOpen = phase.timeline.find(
      (entry) => entry.kind === 'boundary' && entry.boundary.kind === 'wheelsOpen',
    );
    expect(wheelsOpen).toMatchObject({ label: 'Wheels open · Combat 1' });
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
  });

  it('shows a delivery the phase end matured as the next wheel opens, after the NPC is answered', () => {
    let project = threePhaseDeliveryProject();
    // Icarus's offer is authored first, so the walk reaches the delivery's due contact.
    project = authorLegalTraitOffers(placeDueHermesShrineDeliveries(project));
    const node = requireWorkspaceBiome(
      projectStructuredWorkspaceFixture(project).workspace,
      'O',
    ).nodes.find(
      (candidate) =>
        candidate.kind === 'occurrenceWorkbench' &&
        candidate.room.occurrenceId === oOccurrenceIds.combat02,
    );
    if (node?.kind !== 'occurrenceWorkbench' || node.room.workbench.kind !== 'ship')
      throw new Error('the ship room is not projected');
    const actions = node.room.roomActions!;
    const sequenceOf = (key: string) =>
      node.room.workbench.kind !== 'ship'
        ? []
        : node.room.workbench.phases
            .find((phase) => phase.key === key)!
            .timeline.flatMap((entry) => {
              if (entry.kind === 'boundary')
                return entry.boundary.kind === 'encounterEnd' ||
                  entry.boundary.kind === 'wheelsOpen'
                  ? [entry.boundary.kind]
                  : [];
              if (entry.kind === 'spawned') return [`spawned ${entry.moment}`];
              if (entry.kind !== 'action') return [];
              const reference = actions.rows.find((row) => row.key === entry.actionKey)?.reference;
              switch (reference?.kind) {
                case 'interactWheelReward':
                  return ['collect reward'];
                case 'interactEncounter':
                  return ['talk'];
                case 'interactAcquisitionEntry':
                  return reference.siteKey === 'hermesShrineDelivery' ? ['collect delivery'] : [];
                case 'chooseRewardWheel':
                  return ['select wheel'];
                default:
                  return [];
              }
            });
    // Encounter ended spawns the wheel reward; the delivery arrives as the next wheel opens,
    // before its choice on the same tab.
    const combatOne = sequenceOf('Combat1');
    const tail = combatOne.slice(combatOne.indexOf('encounterEnd'));
    expect(tail.slice(0, 2)).toEqual(['encounterEnd', 'spawned encounterEnd']);
    expect([...tail.slice(2, -4)].sort()).toEqual(['collect reward', 'talk']);
    expect(tail.slice(-4)).toEqual([
      'wheelsOpen',
      'spawned wheelsOpen',
      'collect delivery',
      'select wheel',
    ]);
    expect(sequenceOf('Combat2')).not.toContain('wheelsOpen');
  });
});
