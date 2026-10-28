import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createRoomActionAddress,
  type ProjectCommand,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { loadUnderworldFStygianWellCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { supportedRerollRewards, withArcana, withJudgment } from '../../support/rerolls';
import { simulateProjectAssembly } from '../../../src/simulation';

const f = createBiomeAddress('Underworld', 'F');
const source = 'golden-f-b2-e1';
const postboss = 'golden-f-preboss-shop:postboss';

function order(project: ProjectDocument, occurrenceId: string) {
  return project.route.biomes[0]!.topology!.occurrences.find(
    (occurrence) => occurrence.occurrenceId === occurrenceId,
  )!.roomActions.order;
}

/**
 * The F route with both reroll cards: one door press, then at the Postboss a
 * Well reroll whose restock is bought and a Pool reroll whose list is sold from.
 */
export function underworldFRerollsProject(): ProjectDocument {
  let project = withJudgment(
    withArcana(loadUnderworldFStygianWellCheckpoint(), ['DoorReroll']),
    'F',
    'golden-f-preboss-shop:boss',
    ['ScreenReroll', 'StartingGold', 'HealthRegen', 'BonusDodge', 'TradeOff'],
  );
  const apply = (command: ProjectCommand) => {
    project = applyProjectCommand(project, catalog, command);
  };
  const exit = project.route.biomes[0]!.topology!.decisions.find(
    (decision) =>
      decision.kind === 'exit' &&
      decision.source.kind === 'occurrence' &&
      decision.source.occurrenceId === source,
  );
  const door =
    exit?.kind === 'exit'
      ? exit.normal.targets.find((target) => target.exitKey === 'exit2')
      : undefined;
  if (door === undefined) throw new Error(`${source} has no exit2`);
  apply({
    kind: 'InsertReroll',
    occurrence: createOccurrenceAddress(f, source as never),
    target: { kind: 'door', exitKey: 'exit2', occurrenceId: door.occurrenceId },
    reward: { rewardType: 'RoomMoneyDrop' },
    index: order(project, source).length,
  });
  const press = createRoomActionAddress(f, source as never, JSON.stringify(['reroll', 'r1']));
  // The first supported redraw that leaves the later rooms' draws valid.
  const pressed = project;
  const types = [
    ...new Set(catalog.rewards.stores.byKey.RunProgress!.entries.map((entry) => entry.rewardType)),
  ];
  project =
    supportedRerollRewards(pressed, press, types)
      .map((reward) =>
        applyProjectCommand(pressed, catalog, {
          kind: 'ReplaceRerollReward',
          action: press,
          reward,
        }),
      )
      .find(
        (candidate) => simulateProjectAssembly(catalog, candidate).evaluation.status === 'valid',
      ) ?? pressed;
  const room = createOccurrenceAddress(f, postboss as never);
  apply({
    kind: 'InsertStygianWellReroll',
    occurrence: room,
    index: order(project, postboss).length,
  });
  apply({
    kind: 'SetStygianWellPurchase',
    occurrence: room,
    generationKey: 'r1:healing',
    purchased: true,
    itemKey: 'HealDropRange',
  });
  apply({ kind: 'SetPurgingPoolInteraction', occurrence: room, interacted: true });
  apply({
    kind: 'InsertPurgingPoolReroll',
    occurrence: room,
    index: order(project, postboss).length,
  });
  apply({
    kind: 'SellPurgingPoolRollSlot',
    reroll: createRoomActionAddress(
      f,
      postboss as never,
      JSON.stringify(['rerollPurgingPool', 'r1']),
    ),
    slotKey: 'middle',
    traitKey: 'HeraCastBoon',
    index: order(project, postboss).length,
  });
  return project;
}
