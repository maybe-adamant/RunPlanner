import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createHubRerollAddress,
  createOccurrenceAddress,
  createRoomActionAddress,
  type ProjectCommand,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { loadUnderworldFStygianWellCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { loadSurfaceNOCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import {
  firstSupportedReroll,
  supportedRerollRewards,
  withArcana,
  withJudgment,
} from '../../support/rerolls';
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
  apply({
    kind: 'InsertPurgingPoolReroll',
    occurrence: room,
    index: order(project, postboss).length,
  });
  apply({
    kind: 'SellPurgingPoolRollSlot',
    occurrence: room,
    rollKey: 'r1',
    slotKey: 'middle',
    traitKey: 'HeraCastBoon',
    index: order(project, postboss).length,
  });
  return project;
}

/**
 * The N and O Surface route with Hub board presses in the first stay and after
 * the third visit, and a ship wheel offer redrawn before the wheel is used.
 */
export function surfaceNORerollsProject(): ProjectDocument {
  const n = createBiomeAddress('Surface', 'N');
  const o = createBiomeAddress('Surface', 'O');
  const hub = { kind: 'hubDecision', routeKey: 'Surface', biomeKey: 'N', hubKey: 'hub' } as const;
  // N's Judgment grants two more cards mid-run, each adding its full count to the pool.
  let project = withJudgment(
    withJudgment(
      withArcana(loadSurfaceNOCheckpoint(), ['DoorReroll']),
      'N',
      'surface-n-preboss:boss',
      ['ScreenReroll', 'TradeOff', 'StartingGold', 'HealthRegen', 'BonusDodge'],
    ),
    'O',
    'surface-o-preboss:boss',
    ['LowManaDamageBonus', 'CastCount', 'SorceryRegenUpgrade', 'CastBuff', 'BonusHealth'],
  );
  const apply = (command: ProjectCommand) => {
    project = applyProjectCommand(project, catalog, command);
  };
  // combat03 is never entered; one press in the first stay, one after the third visit.
  for (const [rerollId, index] of [
    ['r1', 1],
    ['r2', 5],
  ] as const) {
    apply({
      kind: 'InsertHubReroll',
      hub,
      hubSlotKey: 'combat03',
      reward: { rewardType: 'MaxHealthDropBig' },
      index,
    });
    const reroll = createHubRerollAddress(n, 'hub', rerollId);
    apply({
      kind: 'ReplaceHubRerollReward',
      reroll,
      reward: firstSupportedReroll(project, reroll, 'HubRewards'),
    });
  }
  const ship = 'surface-o-combat04';
  apply({
    kind: 'InsertReroll',
    occurrence: createOccurrenceAddress(o, ship as never),
    target: { kind: 'wheelOffer', wheelKey: 'wheel1', offerKey: 'offer1' },
    reward: { rewardType: 'MaxManaDrop' },
    index: project.route.biomes[1]!.topology!.occurrences.find(
      (occurrence) => occurrence.occurrenceId === ship,
    )!.roomActions.order.findIndex((reference) => reference.kind === 'chooseRewardWheel'),
  });
  const press = createRoomActionAddress(o, ship as never, JSON.stringify(['reroll', 'r1']));
  apply({
    kind: 'ReplaceRerollReward',
    action: press,
    reward: firstSupportedReroll(project, press, 'RunProgress'),
  });
  return project;
}
