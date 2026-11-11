import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createFigurineArcanaAddress,
  createJudgmentArcanaAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomActionAddress,
  roomActionKey,
  semanticAddressKey,
  type OccurrenceAddress,
  type ProjectDocument,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';
import {
  encounterOutcomesForProjectEvaluationAssembly,
  simulateProjectAssembly,
  spawnedLootForProjectEvaluationAssembly,
  type ProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';
import { editTestRoomActionOrder } from '@run-planner/test-fixtures/shared';
import type {
  RoomEvent,
  RoomEventTrigger,
} from '../../../src/authored-project/room-actions/event-graph';
import type { RoomHistoryFragment, RoomLifecycleEvent } from '../../../src/simulation/lifecycle';
import type { CanonicalAuthoredRoom } from '../../../src/simulation/materialization';
import type { RoomLifecycleTimelineEntry } from '../../../src/simulation/room-actions/timeline';
import type { SpawnedLootItem } from '../../../src/simulation/evaluation/spawned-loot';
import { equivalenceCorpus } from '../../equivalence/corpus';
import { compactActionKey, corpusRooms, roomLabel } from '../../support/lifecycle-snapshots';

const fragments = vi.hoisted(() => [] as RoomHistoryFragment[]);

// Records each room walk as the history composition receives it.
vi.mock('../../../src/simulation/lifecycle', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/simulation/lifecycle')>();
  return {
    ...actual,
    executeRoomLifecycle: (...args: Parameters<typeof actual.executeRoomLifecycle>) => {
      const fragment = actual.executeRoomLifecycle(...args);
      fragments.push(fragment);
      return fragment;
    },
  };
});

interface Simulated {
  readonly project: ProjectDocument;
  readonly assembly: ProjectEvaluationAssembly;
  readonly fragments: readonly RoomHistoryFragment[];
}

function simulate(project: ProjectDocument): Simulated {
  fragments.length = 0;
  const assembly = simulateProjectAssembly(catalog, project);
  return { project, assembly, fragments: [...fragments] };
}

const corpusRuns = new Map<string, Simulated>();

/** One equivalence corpus entry, simulated once for the whole file. */
function corpusRun(name: string): Simulated {
  const cached = corpusRuns.get(name);
  if (cached !== undefined) return cached;
  const entry = equivalenceCorpus().find((candidate) => candidate.name === name);
  if (entry === undefined) throw new Error(`no corpus entry ${name}`);
  const run = simulate(entry.project());
  corpusRuns.set(name, run);
  return run;
}

function at(routeKey: string, biomeKey: string, occurrenceId: string): OccurrenceAddress {
  return createOccurrenceAddress(
    createBiomeAddress(routeKey, biomeKey),
    createOccurrenceId(occurrenceId),
  );
}

const subject = (value: object): string => {
  const record = value as Record<string, unknown>;
  const key = record.phaseKey ?? record.wheelKey;
  return typeof key === 'string' ? `(${key})` : '';
};

function triggerText(trigger: RoomEventTrigger): string {
  return trigger.kind === 'action' ? compactActionKey(roomActionKey(trigger.action)) : trigger.kind;
}

/** One graph event: its kind and phase or wheel, then what fires it. */
function graphEventText(event: RoomEvent): string {
  const named = event.kind === 'wheelsOpen' ? `(${event.wheelKey})` : subject(event);
  return `${event.kind}${named} <- ${triggerText(event.trigger)}`;
}

function walkEventText(event: RoomLifecycleEvent): string {
  const record = event as unknown as Record<string, unknown>;
  const detail = ['phaseKey', 'wheelKey', 'offerPoint', 'interaction', 'exitKey']
    .flatMap((field) => (typeof record[field] === 'string' ? [record[field] as string] : []))
    .join(' ');
  return detail === '' ? event.kind : `${event.kind}(${detail})`;
}

function timelineText(entry: RoomLifecycleTimelineEntry): string {
  switch (entry.kind) {
    case 'boundary':
      return `${entry.boundary.kind}${
        entry.boundary.kind === 'wheelsOpen'
          ? `(${entry.boundary.wheelKey})`
          : subject(entry.boundary)
      }`;
    case 'action':
      return `#${entry.rank}`;
    case 'automaticEffect':
      return `${entry.effect}(${entry.phaseKey})`;
  }
}

function itemText(item: SpawnedLootItem): string {
  return `${compactActionKey(roomActionKey(item.reference))}${
    item.placement.kind === 'placed' ? ` #${item.placement.rank}` : ' unplaced'
  }`;
}

/** A walk's events, with `#rank` before the event each reached row precedes. */
function walkTokens(
  fragment: RoomHistoryFragment,
  rankByKey: ReadonlyMap<string, number>,
): string[] {
  const before = new Map<number, string[]>();
  for (const action of fragment.reachedActions) {
    const tokens = before.get(action.sequence) ?? [];
    tokens.push(`#${rankByKey.get(action.actionKey) ?? compactActionKey(action.actionKey)}`);
    before.set(action.sequence, tokens);
  }
  const walk: string[] = [];
  fragment.events.forEach((event, index) =>
    walk.push(...(before.get(index + 1) ?? []), walkEventText(event)),
  );
  walk.push(...(before.get(fragment.events.length + 1) ?? []));
  return walk;
}

function rankMap(room: CanonicalAuthoredRoom | undefined): ReadonlyMap<string, number> {
  return new Map(
    (room?.roomActionRoster.rows ?? []).flatMap((row) =>
      row.rank === null || row.stale ? [] : [[row.key, row.rank] as const],
    ),
  );
}

interface RoomObservation {
  readonly assembly: ProjectEvaluationAssembly;
  readonly fragment: RoomHistoryFragment;
  readonly walk: readonly string[];
  readonly events: readonly RoomEvent[];
  readonly graph: readonly string[];
  readonly timeline: readonly string[];
  /** Each spawn moment, then each action spawn, with what it spawns. */
  readonly loot: readonly string[];
  /** The `#rank` of the row whose compact key is, or starts with, `compact`. */
  rank(compact: string): string;
  reference(compact: string): RoomActionReference;
}

/** One room of a simulated plan: its walk, event graph, Timeline and loot. */
function observe(run: Simulated, origin: OccurrenceAddress): RoomObservation {
  const key = semanticAddressKey(origin);
  // A room walked again (a progressive prefix after a block) keeps its last walk.
  const fragment = run.fragments.findLast(
    (candidate) => semanticAddressKey(candidate.origin) === key,
  );
  const room = corpusRooms(run.assembly).find(
    (candidate) => semanticAddressKey(candidate.origin) === key,
  );
  if (fragment === undefined || room === undefined) throw new Error(`${key} was not walked`);
  const spawned = spawnedLootForProjectEvaluationAssembly(catalog, run.assembly, origin);
  const row = (compact: string) => {
    const found = room.roomActionRoster.rows.find((candidate) => {
      const text = compactActionKey(candidate.key);
      return !candidate.stale && (text === compact || text.startsWith(`${compact}:`));
    });
    if (found === undefined) throw new Error(`${key} has no ${compact} row`);
    return found;
  };
  return {
    assembly: run.assembly,
    fragment,
    walk: walkTokens(fragment, rankMap(room)),
    events: room.roomActionRoster.eventGraph.events,
    graph: room.roomActionRoster.eventGraph.events.map(graphEventText),
    timeline: room.roomLifecycleTimeline.entries.map(timelineText),
    loot: [
      ...(spawned?.moments ?? []).map(
        (moment) => `${moment.key}: ${moment.items.map(itemText).join(', ')}`,
      ),
      ...(spawned?.actionSpawns ?? []).map(
        (spawn) =>
          `after ${compactActionKey(roomActionKey(spawn.source))}: ${spawn.items.map(itemText).join(', ')}`,
      ),
    ],
    rank(compact) {
      const found = row(compact);
      if (found.rank === null) throw new Error(`${key} ${compact} is not ranked`);
      return `#${found.rank}`;
    },
    reference: (compact) => row(compact).reference,
  };
}

/** The plan with one row taken back, as Remove leaves a required row. */
function removed(
  project: ProjectDocument,
  room: OccurrenceAddress,
  reference: RoomActionReference,
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'RemoveRoomAction',
    action: createRoomActionAddress(
      createBiomeAddress(room.routeKey, room.biomeKey),
      room.occurrenceId,
      roomActionKey(reference),
    ),
  });
}

/** The first token equal to, or matching, `matcher`; -1 when none. */
function position(tokens: readonly string[], matcher: string | RegExp): number {
  return tokens.findIndex((token) =>
    typeof matcher === 'string' ? token === matcher : matcher.test(token),
  );
}

/** Asserts every matcher is present, in this order. */
function expectInOrder(tokens: readonly string[], matchers: readonly (string | RegExp)[]): void {
  const text = tokens.join(' > ');
  let previous = -1;
  for (const matcher of matchers) {
    const index = position(tokens, matcher);
    expect(index, `${String(matcher)} in ${text}`).toBeGreaterThanOrEqual(0);
    expect(index, `${String(matcher)} in order in ${text}`).toBeGreaterThan(previous);
    previous = index;
  }
}

function outcomes(observation: RoomObservation, origin: OccurrenceAddress) {
  return encounterOutcomesForProjectEvaluationAssembly(catalog, observation.assembly, origin);
}

const fStart = at('Underworld', 'F', 'golden-f-start');
const fOrdinary = at('Underworld', 'F', 'golden-f-b1-e1');
const fBoss = at('Underworld', 'F', 'golden-f-preboss-shop:boss');
const fPostboss = at('Underworld', 'F', 'golden-f-preboss-shop:postboss');
const fPreboss = at('Underworld', 'F', 'golden-f-preboss-shop');
const fMidShop = at('Underworld', 'F', 'midshop-pom-b5-e1');
const fCombat06 = at('Underworld', 'F', 'golden-f-b5-e1');
const gCombat01 = at('Underworld', 'G', 'golden-g-b1-e1');
const gNemesis = at('Underworld', 'G', 'golden-g-b4-e1');
const gAnomaly = at('Underworld', 'G', 'golden-g-b3-e2');
const hFields = at('Underworld', 'H', 'golden-h-combat05');
const hDreamFields = at('Dream', 'H', 'a6b19a5f-d499-48d1-ae59-30aed524f968');
const nMain = at('Surface', 'N', 'surface-n-combat05');
const nSide = at('Surface', 'N', 'surface-n-combat05-sideDoor2');
const oDevotion = at('Surface', 'O', 'surface-o-devotion');
const oShip = at('Surface', 'O', 'surface-o-combat07');
const oShipRerolls = at('Surface', 'O', 'surface-o-combat04');
const oShipDelivery = at('Surface', 'O', 'surface-o-combat01');
const pAetos = at('Surface', 'P', 'surface-p-1-1-p_combat03');
const pMulti = at('Surface', 'P', 'surface-p-2-1-p_combat02');
const qPreboss = at('Surface', 'Q', 'surface-q-preboss');

const openingGate = 'interactIncomingReward:roomRewardPickup:source';
const devotionGate = 'interactIncomingReward:beforeCombat:chosenSource';
const roomReward = 'interactIncomingReward:roomRewardPickup:self';
const shrineDelivery = 'interactAcquisitionEntry:hermesShrineDelivery';

describe('gated Opening and Devotion', () => {
  it('begins the Opening encounter at entry, takes its pickup, then starts Combat', () => {
    const room = observe(corpusRun('execution/f-opening'), fStart);
    const gate = room.rank(openingGate);

    expect(room.timeline).toEqual([
      'roomEntered',
      'encounterBegun(Encounter)',
      gate,
      'encounterStarted(Encounter)',
      'encounterEnd(Encounter)',
      'doorsOpened',
    ]);
    expect(room.events.find((event) => event.kind === 'encounterBegun')).not.toHaveProperty(
      'merged',
    );
    expectInOrder(room.walk, ['roomEntered', gate, 'encounterStarted(Encounter)']);
    // The Opening reward spawns with the room, before its fight.
    expect(room.loot).toEqual([`roomEntered: ${openingGate} ${gate}`]);
  });

  it('fires the Opening Combat from the gate row it follows', () => {
    const room = observe(corpusRun('execution/f-opening'), fStart);
    expect(room.graph).toEqual([
      'roomEntered <- automatic',
      'encounterBegun(Encounter) <- automatic',
      `encounterStarted(Encounter) <- ${openingGate}`,
      'encounterEnd(Encounter) <- automatic',
      'doorsOpened <- doorsPredicate',
    ]);
  });

  it('begins the Devotion encounter at entry, takes the chosen boon, then starts Combat', () => {
    const room = observe(corpusRun('execution/surface-nopq'), oDevotion);
    const chosen = room.rank(devotionGate);
    const spurned = room.rank('interactIncomingReward:afterCombat:spurnedSource');

    expect(room.graph).toEqual([
      'roomEntered <- automatic',
      'encounterBegun(Encounter) <- automatic',
      `encounterStarted(Encounter) <- ${devotionGate}`,
      'encounterEnd(Encounter) <- automatic',
      'doorsOpened <- doorsPredicate',
    ]);
    expect(room.timeline).toEqual([
      'roomEntered',
      'encounterBegun(Encounter)',
      chosen,
      'encounterStarted(Encounter)',
      'encounterEnd(Encounter)',
      spurned,
      'doorsOpened',
    ]);
    expectInOrder(room.walk, ['roomEntered', chosen, 'encounterStarted(Encounter)', spurned]);
    expect(room.loot).toEqual([
      `roomEntered: ${devotionGate} ${chosen}`,
      `encounterEnd:Encounter: interactIncomingReward:afterCombat:spurnedSource ${spurned}`,
    ]);
  });

  it.each([
    ['Opening', 'execution/f-opening', fStart, openingGate],
    ['Devotion', 'execution/surface-nopq', oDevotion, devotionGate],
  ] as const)(
    'stops at Combat, due at the encounter, with the %s gate unplaced',
    (_, entry, origin, gate) => {
      const run = corpusRun(entry);
      const reference = observe(run, origin).reference(gate);
      const room = observe(simulate(removed(run.project, origin, reference)), origin);

      expect(room.fragment.blockedAt).toMatchObject({ actionKey: roomActionKey(reference) });
      expect(room.fragment.blockedDeadline).toEqual({ kind: 'encounter', phaseKey: 'Encounter' });
      expect(room.walk).not.toContain('encounterStarted(Encounter)');
      expect(room.walk).not.toContain('encounterDepthAdvanced(Encounter)');
    },
  );

  it('passes Encounter before an unplaced gate stops the walk', () => {
    // The walk has no begin event: Encounter stands at entry on the Timeline, and the
    // walk stops right after entry, before Combat.
    const run = corpusRun('execution/f-opening');
    const reference = observe(run, fStart).reference(openingGate);
    const room = observe(simulate(removed(run.project, fStart, reference)), fStart);

    expectInOrder(room.timeline, [
      'roomEntered',
      'encounterBegun(Encounter)',
      'encounterStarted(Encounter)',
    ]);
    expect(room.fragment.blockedAt).toMatchObject({ actionKey: roomActionKey(reference) });
    expect(room.fragment.blockedDeadline).toEqual({ kind: 'encounter', phaseKey: 'Encounter' });
    expect(room.walk.at(-1)).toBe('roomEntered');
  });
});

describe('Ship phase', () => {
  it('begins each phase at its Wheels open and starts Combat from the wheel choice', () => {
    const room = observe(corpusRun('surface/oShipWheelPickupBeforeDeferredEndEffects'), oShip);
    const choose1 = room.rank('chooseRewardWheel:wheel1');
    const reward1 = room.rank('interactWheelReward:wheel1');
    const choose2 = room.rank('chooseRewardWheel:wheel2');
    const reward2 = room.rank('interactWheelReward:wheel2');

    expect(room.graph).toEqual([
      'roomEntered <- automatic',
      'encounterBegun(Intro) <- automatic',
      'encounterStarted(Intro) <- automatic',
      'encounterEnd(Intro) <- automatic',
      'wheelsOpen(wheel1) <- automatic',
      'encounterBegun(Combat1) <- automatic',
      'encounterStarted(Combat1) <- chooseRewardWheel:wheel1',
      'encounterEnd(Combat1) <- automatic',
      'wheelsOpen(wheel2) <- automatic',
      'encounterBegun(Combat2) <- automatic',
      'encounterStarted(Combat2) <- chooseRewardWheel:wheel2',
      'encounterEnd(Combat2) <- automatic',
      'doorsOpened <- doorsPredicate',
    ]);
    expect(
      room.events.flatMap((event) =>
        event.kind === 'wheelsOpen' ? [[event.wheelKey, event.afterPhaseKey]] : [],
      ),
    ).toEqual([
      ['wheel1', 'Intro'],
      ['wheel2', 'Combat1'],
    ]);
    expect(room.timeline).toEqual([
      'roomEntered',
      'encounterBegun(Intro)',
      'encounterStarted(Intro)',
      'encounterEnd(Intro)',
      'wheelsOpen(wheel1)',
      'encounterBegun(Combat1)',
      choose1,
      'encounterStarted(Combat1)',
      'encounterEnd(Combat1)',
      reward1,
      'wheelsOpen(wheel2)',
      'encounterBegun(Combat2)',
      choose2,
      'encounterStarted(Combat2)',
      'encounterEnd(Combat2)',
      reward2,
      'doorsOpened',
    ]);
    expectInOrder(room.walk, [
      choose1,
      'encounterStarted(Combat1)',
      reward1,
      choose2,
      'encounterStarted(Combat2)',
      reward2,
    ]);
    // Each wheel reward spawns at its phase's reward spawn, after combat.
    expect(room.loot).toEqual([
      `encounterEnd:Combat1: interactWheelReward:wheel1 ${reward1}`,
      `encounterEnd:Combat2: interactWheelReward:wheel2 ${reward2}`,
    ]);
  });

  it('stands a wheel reroll and the choice under Wheels open, before Combat', () => {
    const room = observe(corpusRun('execution/surface-no-rerolls'), oShipRerolls);
    const choose = room.rank('chooseRewardWheel:wheel1');
    const reroll = room.rank('reroll');

    expectInOrder(room.timeline, [
      'wheelsOpen(wheel1)',
      'encounterBegun(Combat1)',
      reroll,
      choose,
      'encounterStarted(Combat1)',
    ]);
    expectInOrder(room.walk, [reroll, 'rewardRerolled', choose, 'encounterStarted(Combat1)']);
  });

  it('holds a phase’s end effects until its wheel reward is taken', () => {
    const room = observe(corpusRun('surface/oShipWheelPickupBeforeDeferredEndEffects'), oShip);
    expectInOrder(room.walk, [
      'encounterStarted(Combat1)',
      room.rank('interactWheelReward:wheel1'),
      'encounterEndEffectsApplied(Combat1)',
      room.rank('chooseRewardWheel:wheel2'),
    ]);
  });

  it('stops at the non-final phase’s end when its wheel reward is unplaced', () => {
    const run = corpusRun('surface/oShipWheelPickupBeforeDeferredEndEffects');
    const reference = observe(run, oShip).reference('interactWheelReward:wheel1');
    const room = observe(simulate(removed(run.project, oShip, reference)), oShip);

    expect(room.fragment.blockedDeadline).toEqual({ kind: 'phaseEnd', phaseKey: 'Combat1' });
    expect(room.walk).not.toContain('encounterEndEffectsApplied(Combat1)');
    expect(room.walk).not.toContain('encounterStarted(Combat2)');
  });

  it('makes a delivery matured before a later wheel due before that wheel’s click', () => {
    const run = corpusRun('execution/surface-shrine-deliveries');
    const room = observe(run, oShipDelivery);
    const delivery = room.rank(shrineDelivery);
    const choose = room.rank('chooseRewardWheel:wheel1');

    expectInOrder(room.timeline, [
      'encounterEnd(Intro)',
      'wheelsOpen(wheel1)',
      'encounterBegun(Combat1)',
      delivery,
      choose,
      'encounterStarted(Combat1)',
    ]);
    expect(room.loot[0]).toMatch(
      new RegExp(`^wheelsOpen:Intro: ${shrineDelivery}:.* ${delivery}$`),
    );

    // Placed after the click, it keeps the walk from taking the click.
    const reference = room.reference(shrineDelivery);
    const moved = editTestRoomActionOrder(run.project, catalog, oShipDelivery, (order) => {
      const rest = order.filter((entry) => roomActionKey(entry) !== roomActionKey(reference));
      const click = rest.findIndex((entry) => entry.kind === 'chooseRewardWheel');
      return [...rest.slice(0, click + 1), reference, ...rest.slice(click + 1)];
    });
    const late = observe(simulate(moved), oShipDelivery);
    expect(late.fragment.blockedAt).toMatchObject({
      actionKey: roomActionKey({ kind: 'chooseRewardWheel', wheelKey: 'wheel1' }),
    });
    expect(late.walk).not.toContain('encounterStarted(Combat1)');
  });

  it('opens the wheels in the walk before the reroll and the choice', () => {
    // The walk opens a wheel as its offer point; its Encounter begins there on the Timeline.
    const room = observe(corpusRun('execution/surface-no-rerolls'), oShipRerolls);
    expectInOrder(room.walk, [
      'encounterEndEffectsApplied(Intro)',
      'offerPointMaterialized(wheel1)',
      room.rank('reroll'),
      room.rank('chooseRewardWheel:wheel1'),
      'encounterStarted(Combat1)',
    ]);
  });
});

describe('Aetos and Gorgon', () => {
  it('hosts the Aetos wave at Combat', () => {
    const room = observe(corpusRun('execution/surface-nopq'), pAetos);

    expect(outcomes(room, pAetos)).toEqual([
      {
        phaseKey: 'Combat',
        host: { kind: 'combat', eventKey: 'encounterStarted:Combat' },
        choices: ['aetos'],
      },
    ]);
    expect(room.events.find((event) => event.key === 'encounterStarted:Combat')).toMatchObject({
      kind: 'encounterStarted',
      hostsOutcome: true,
    });
    expect(room.timeline).toContain('encounterStarted(Combat)');
  });

  it('hosts the Gorgon condition at Combat and keeps the Athena row after combat', () => {
    const room = observe(corpusRun('checkpoint/underworld-gorgon-athena'), gCombat01);
    const athena = room.rank('interactGorgon:Encounter');

    expect(outcomes(room, gCombat01)).toEqual([
      {
        phaseKey: 'Encounter',
        host: { kind: 'combat', eventKey: 'encounterStarted:Encounter' },
        choices: ['gorgonCondition'],
      },
    ]);
    expect(room.events.find((event) => event.key === 'encounterStarted:Encounter')).toMatchObject({
      hostsOutcome: true,
    });
    expectInOrder(room.timeline, [
      'encounterStarted(Encounter)',
      'encounterEnd(Encounter)',
      athena,
    ]);
    expectInOrder(room.walk, [
      'encounterStarted(Encounter)',
      'encounterEndEffectsApplied(Encounter)',
      athena,
      'encounterInteractionReached(Encounter gorgon)',
    ]);
  });
});

describe('Nemesis bet', () => {
  it('observes the bet at Combat and settles its gold and loot at the encounter end', () => {
    const room = observe(corpusRun('execution/fg-npc-shopping-protection'), gNemesis);

    expect(outcomes(room, gNemesis)).toEqual([
      {
        phaseKey: 'Encounter',
        host: { kind: 'combat', eventKey: 'encounterStarted:Encounter' },
        choices: ['nemesisBet'],
      },
    ]);
    // Gold contacts carry the biome walk's sequence; the room's entry aligns it with the room walk.
    const key = semanticAddressKey(gNemesis);
    const gold = room.assembly.evaluation.route.biomes.flatMap((biome) =>
      'rewards' in biome
        ? biome.rewards.goldEvents.filter(
            (event) => event.room !== undefined && semanticAddressKey(event.room) === key,
          )
        : [],
    );
    const entered = gold.find((event) => event.kind === 'roomEntered');
    const walkEntered = room.fragment.events.find((event) => event.kind === 'roomEntered');
    const bet = gold.find(
      (event) => event.kind === 'gain' && event.context?.gain.kind === 'nemesisBet',
    );
    if (entered === undefined || walkEntered === undefined || bet === undefined)
      throw new Error('the Nemesis room paid no bet');
    const paidAt = room.fragment.events.find(
      (event) => event.sequence === bet.sequence - entered.sequence + walkEntered.sequence,
    );
    if (paidAt === undefined) throw new Error('the bet was paid at no walk event');
    expect(walkEventText(paidAt)).toMatch(/^encounter(Completed|End|Ended)\(Encounter\)$/);
    expectInOrder(room.walk, ['encounterStarted(Encounter)', walkEventText(paidAt)]);

    expect(room.loot).toEqual([`encounterEnd:Encounter: ${roomReward} ${room.rank(roomReward)}`]);
  });
});

describe('Nemesis random event', () => {
  it('has no markers and spawns her result after her talk row', () => {
    const room = observe(corpusRun('checkpoint/nemesis-f-trait-trade'), fCombat06);
    const talk = room.rank('interactEncounter:Encounter');
    const result = room.rank('interactAcquisitionEntry:nemesisGenerated');

    expect(room.graph).toEqual(['roomEntered <- automatic', 'doorsOpened <- doorsPredicate']);
    expect(room.timeline).toEqual(['roomEntered', talk, result, 'doorsOpened']);
    expect(outcomes(room, fCombat06)).toEqual([
      {
        phaseKey: 'Encounter',
        host: {
          kind: 'interaction',
          action: { kind: 'interactEncounter', phaseKey: 'Encounter' },
        },
        choices: ['nemesisEvent'],
      },
    ]);
    expect(room.loot).toEqual([
      `after interactEncounter:Encounter: interactAcquisitionEntry:nemesisGenerated:Encounter:result ${result}`,
    ]);
    expectInOrder(room.walk, [talk, 'encounterInteractionReached(Encounter encounter)', result]);
  });

  it('runs no encounter for her Fields phase in the walk, only her talk', () => {
    // Fields: her phase shares the room with its cages.
    const room = observe(corpusRun('checkpoint/nemesis-h-fields'), hFields);
    const talk = room.rank('interactEncounter:Passive');

    expect(
      room.walk.filter((token) =>
        /^encounter(Started|DepthAdvanced|Completed|EndEffectsApplied)\(Passive/.test(token),
      ),
    ).toEqual([]);
    expect(room.walk[position(room.walk, talk) + 1]).toBe(
      'encounterInteractionReached(Passive encounter)',
    );
  });

  it('keeps a single-slot room’s non-combat start and completion before her talk', () => {
    // A single-slot F room: her phase is the room's only encounter, started and
    // completed with no depth or end effects, before her talk row.
    const room = observe(corpusRun('checkpoint/nemesis-f-trait-trade'), fCombat06);
    const talk = room.rank('interactEncounter:Encounter');

    expect(room.walk.filter((token) => /^encounter[A-Z][A-Za-z]*\(Encounter/.test(token))).toEqual([
      'encounterRecorded(Encounter)',
      'encounterStarted(Encounter)',
      'encounterCompleted(Encounter)',
      'encounterInteractionReached(Encounter encounter)',
    ]);
    expectInOrder(room.walk, [
      'encounterStarted(Encounter)',
      'encounterCompleted(Encounter)',
      talk,
      'encounterInteractionReached(Encounter encounter)',
    ]);
  });
});

describe('Anomaly', () => {
  it.each([
    [true, [`encounterEnd:Encounter: ${roomReward} #1`]],
    [false, []],
  ] as const)(
    'observes capture %s at Combat and spawns the reward only on success',
    (success, loot) => {
      const room = observe(
        corpusRun(`underworld/createCompleteFGAnomalyProject(${success})`),
        gAnomaly,
      );

      expect(outcomes(room, gAnomaly)).toEqual([
        {
          phaseKey: 'Encounter',
          host: { kind: 'combat', eventKey: 'encounterStarted:Encounter' },
          choices: ['anomalyCleared'],
        },
      ]);
      expect(room.loot).toEqual(loot);
    },
  );
});

describe('Boss', () => {
  it('defeats the Boss at the encounter end, where Judgment and Figurine stand', () => {
    const run = corpusRun('execution/f-opening');
    const room = observe(run, fBoss);
    const drop = room.rank('collectRequiredReward');

    expect(room.graph).toEqual([
      'roomEntered <- automatic',
      'encounterBegun(Encounter) <- automatic',
      'encounterStarted(Encounter) <- automatic',
      'bossDefeated(Encounter) <- automatic',
      'encounterEnd(Encounter) <- automatic',
      'doorsOpened <- doorsPredicate',
    ]);
    expect(room.timeline).toEqual([
      'roomEntered',
      'encounterBegun(Encounter)',
      'encounterStarted(Encounter)',
      'bossDefeated(Encounter)',
      'encounterEnd(Encounter)',
      drop,
      'doorsOpened',
    ]);
    expectInOrder(room.walk, [
      'encounterStarted(Encounter)',
      'bossDefeated(Encounter)',
      'encounterEndEffectsApplied(Encounter)',
      drop,
    ]);
    expect(outcomes(room, fBoss)).toEqual([]);
    const judged = applyProjectCommand(run.project, catalog, {
      kind: 'ReplaceJudgmentArcana',
      judgment: createJudgmentArcanaAddress(fBoss, 'Encounter'),
      arcanaKeys: ['CardDraw'],
    });
    expect(() =>
      applyProjectCommand(judged, catalog, {
        kind: 'ReplaceFigurineArcana',
        figurine: createFigurineArcanaAddress(fBoss, 'Encounter'),
        arcanaKeys: ['CardDraw'],
      }),
    ).not.toThrow();
  });

  it('makes an unplaced Boss drop due at leave', () => {
    const run = corpusRun('execution/f-opening');
    const reference = observe(run, fBoss).reference('collectRequiredReward');
    const room = observe(simulate(removed(run.project, fBoss, reference)), fBoss);

    expect(room.fragment.blockedDeadline).toEqual({ kind: 'leave' });
    expect(room.walk).toContain('bossDefeated(Encounter)');
  });
});

describe('ordinary combat', () => {
  it('shows one merged Encounter and Combat marker', () => {
    const room = observe(corpusRun('execution/f-opening'), fOrdinary);
    const reward = room.rank(roomReward);

    expect(room.graph).toEqual([
      'roomEntered <- automatic',
      'encounterBegun(Encounter) <- automatic',
      'encounterStarted(Encounter) <- automatic',
      'encounterEnd(Encounter) <- automatic',
      'doorsOpened <- doorsPredicate',
    ]);
    expect(room.events.find((event) => event.kind === 'encounterBegun')).toMatchObject({
      merged: true,
    });
    // No outcome is observed at its Combat to show the two apart.
    expect(outcomes(room, fOrdinary)).toEqual([]);
    expect(room.timeline).toEqual([
      'roomEntered',
      'encounterBegun(Encounter)',
      'encounterStarted(Encounter)',
      'encounterEnd(Encounter)',
      reward,
      'doorsOpened',
    ]);
    expectInOrder(room.walk, [
      'encounterStarted(Encounter)',
      'encounterDepthAdvanced(Encounter)',
      reward,
    ]);
  });
});

describe('Postboss', () => {
  it('opens the doors right after the fountain row', () => {
    const room = observe(corpusRun('execution/f-opening'), fPostboss);

    expect(room.graph).toEqual(['roomEntered <- automatic', 'doorsOpened <- doorsPredicate']);
    expect(room.timeline.slice(0, 3)).toEqual([
      'roomEntered',
      room.rank('useFountain'),
      'doorsOpened',
    ]);
  });

  it('draws no doors in the walk and reaches the next row right after the fountain', () => {
    // A Postboss room's way on is fixed: its Doors open draws nothing, so the walk
    // has no door event; the Timeline places Doors open between these rows.
    const room = observe(corpusRun('execution/f-opening'), fPostboss);
    const rack = room.rank('interactKeepsakeRack');

    expect(room.events.find((event) => event.kind === 'doorsOpened')).toMatchObject({
      generatesOutgoing: false,
    });
    expect(room.walk).not.toContain('outgoingGenerationCheckpoint');
    expect(room.walk[position(room.walk, 'fountainUsed') + 1]).toBe(rack);
    expectInOrder(room.timeline, [room.rank('useFountain'), 'doorsOpened', rack]);
  });
});

describe('Fields', () => {
  it.each([
    ['execution/underworld-fgh', hFields, ['Cage03', 'Cage02', 'Cage01']],
    ['checkpoint/dream-h-artificer-echo', hDreamFields, ['Cage01', 'Cage02', 'Cage03']],
  ] as const)('runs the %s cages in their activation order', (entry, origin, cages) => {
    const room = observe(corpusRun(entry), origin);
    const activations = cages.map((cage) => room.rank(`completeFieldsCage:${cage}`));

    expect(room.graph.filter((text) => text.startsWith('encounterBegun'))).toEqual(
      cages.map((cage) => `encounterBegun(${cage}) <- completeFieldsCage:${cage}`),
    );
    expectInOrder(
      room.timeline,
      cages.flatMap((cage, index) => [
        activations[index]!,
        `encounterBegun(${cage})`,
        `encounterStarted(${cage})`,
        `encounterEnd(${cage})`,
      ]),
    );
    expectInOrder(
      room.walk,
      cages.flatMap((cage, index) => [activations[index]!, `encounterStarted(${cage})`]),
    );
  });

  it('requires each cage’s reward, spawned locked at entry, before Doors open', () => {
    const run = corpusRun('execution/underworld-fgh');
    const room = observe(run, hFields);
    const last = room.rank('interactLocalReward:cages:cage1');

    expectInOrder(room.timeline, ['encounterEnd(Cage01)', last, 'doorsOpened']);
    expect(room.loot[0]).toMatch(/^roomEntered: interactLocalReward:cages:cage3 #\d+, /);

    const reference = room.reference('interactLocalReward:cages:cage1');
    const unplaced = observe(simulate(removed(run.project, hFields, reference)), hFields);
    expect(unplaced.fragment.blockedDeadline).toEqual({ kind: 'doorsOpen' });
    expect(unplaced.walk).toContain('encounterEndEffectsApplied(Cage01)');
  });

  it('emits no events for the Passive encounter', () => {
    const room = observe(corpusRun('checkpoint/nemesis-h-fields'), hFields);

    expect(
      room.events.filter((event) => 'phaseKey' in event && event.phaseKey === 'Passive'),
    ).toEqual([]);
    expect(room.timeline.filter((text) => text.includes('(Passive)'))).toEqual([]);
    expect(room.timeline.slice(0, 2)).toEqual([
      'roomEntered',
      room.rank('interactEncounter:Passive'),
    ]);
    expect(
      room.walk.filter((token) =>
        /^encounter(Begun|Started|DepthAdvanced|Completed)\(Passive/.test(token),
      ),
    ).toEqual([]);
  });

  it('draws the doors in the walk once the last cage reward is taken', () => {
    const room = observe(corpusRun('execution/underworld-fgh'), hFields);
    const last = position(room.walk, room.rank('interactLocalReward:cages:cage1'));
    expect(room.walk.slice(last + 1, last + 3)).toEqual([
      'acquisitionPointReached',
      'outgoingGenerationCheckpoint',
    ]);
  });
});

describe('the rest', () => {
  it('runs a P room’s Intro and Combat as two encounters', () => {
    const room = observe(corpusRun('execution/surface-nopq'), pMulti);
    const reward = room.rank(roomReward);

    expect(room.timeline).toEqual([
      'roomEntered',
      'encounterBegun(Intro)',
      'encounterStarted(Intro)',
      'encounterEnd(Intro)',
      'encounterBegun(Combat)',
      'encounterStarted(Combat)',
      'encounterEnd(Combat)',
      reward,
      'doorsOpened',
    ]);
    expectInOrder(room.walk, [
      'encounterStarted(Intro)',
      'encounterCompleted(Intro)',
      'encounterStarted(Combat)',
      'encounterDepthAdvanced(Combat)',
      reward,
    ]);
    expect(room.walk).not.toContain('encounterDepthAdvanced(Intro)');
  });

  it.each([
    ['main', nMain, true],
    ['side', nSide, false],
  ] as const)('opens an Ephyra %s room’s doors after its reward', (_, origin, generates) => {
    const room = observe(corpusRun('execution/surface-n'), origin);

    expect(room.timeline).toEqual([
      'roomEntered',
      'encounterBegun(Encounter)',
      'encounterStarted(Encounter)',
      'encounterEnd(Encounter)',
      room.rank(roomReward),
      'doorsOpened',
    ]);
    // A side room only unlocks its way back; a main room draws its doors.
    expect(room.events.find((event) => event.kind === 'doorsOpened')).toMatchObject({
      generatesOutgoing: generates,
    });
  });

  it('opens the Ephyra hub’s doors at entry, with no encounter', () => {
    const hub = corpusRun('execution/surface-n').fragments.findLast(
      (fragment) => fragment.origin.kind === 'hubRoom',
    );
    if (hub === undefined) throw new Error('the hub was not walked');
    const walk = walkTokens(hub, new Map());

    expect(walk.filter((token) => token.startsWith('encounter'))).toEqual([]);
    expect(walk[position(walk, 'roomEntered') + 1]).toMatch(
      /^(outgoingGenerationCheckpoint|doorsOpened)$/,
    );
  });

  it('opens a Preboss shop’s doors at entry, before its purchases', () => {
    const room = observe(corpusRun('checkpoint/underworld-world-shop-travel-deal'), fPreboss);
    const purchase = room.rank('interactShopOffer');

    expect(room.graph).toEqual(['roomEntered <- automatic', 'doorsOpened <- doorsPredicate']);
    expectInOrder(room.timeline, ['roomEntered', 'doorsOpened', purchase]);
    expectInOrder(room.walk, ['roomEntered', purchase]);
  });

  it('flushes a Preboss delivery at entry and opens the doors after it', () => {
    const room = observe(corpusRun('execution/surface-shrine-deliveries'), qPreboss);
    const delivery = room.rank(shrineDelivery);

    expect(room.timeline).toEqual(['roomEntered', delivery, 'doorsOpened']);
    expect(room.loot).toHaveLength(1);
    expect(room.loot[0]).toMatch(new RegExp(`^deliveryFlush: ${shrineDelivery}:.* ${delivery}$`));
    expectInOrder(room.walk, ['roomEntered', delivery, 'roomCommitted']);
  });

  it('draws no doors in a Preboss flush room’s walk, committing after the delivery', () => {
    // The Boss room follows a Preboss room, so its Doors open draws nothing.
    const room = observe(corpusRun('execution/surface-shrine-deliveries'), qPreboss);

    expect(room.events.find((event) => event.kind === 'doorsOpened')).toMatchObject({
      generatesOutgoing: false,
    });
    expect(room.walk).not.toContain('outgoingGenerationCheckpoint');
    expectInOrder(room.walk, [
      'roomEntered',
      room.rank(shrineDelivery),
      'acquisitionPointReached',
      'roomCommitted',
    ]);
  });

  it.each([
    ['challenge switch', 'execution/underworld-f-switches', fCombat06, 'interactChallengeSwitch'],
    ['locked door', 'execution/underworld-g-locked-doors', gCombat01, 'unlockExit'],
  ] as const)('fights the %s after Doors open, with no end effects', (_, entry, origin, press) => {
    const room = observe(corpusRun(entry), origin);
    const pressed = room.rank(press);

    expectInOrder(room.timeline, ['encounterEnd(Encounter)', 'doorsOpened', pressed]);
    expect(
      room.walk
        .slice(position(room.walk, pressed))
        .filter((token) => /^encounter(Completed|EndEffectsApplied|End)\b/.test(token)),
    ).toEqual([]);
    expect(room.walk.filter((token) => token.startsWith('encounterEndEffectsApplied'))).toEqual([
      'encounterEndEffectsApplied(Encounter)',
    ]);
  });

  it('opens a World Shop’s doors at entry, drawing them, before its purchases', () => {
    const room = observe(corpusRun('checkpoint/underworld-f-midshop-pom-frontier'), fMidShop);
    const purchase = room.rank('interactShopOffer');

    expect(room.graph).toEqual(['roomEntered <- automatic', 'doorsOpened <- doorsPredicate']);
    expect(room.events.find((event) => event.kind === 'doorsOpened')).toMatchObject({
      generatesOutgoing: true,
    });
    expect(room.timeline).toEqual(['roomEntered', 'doorsOpened', purchase]);
    expectInOrder(room.walk, ['roomEntered', 'outgoingGenerationCheckpoint', purchase]);
  });

  it('draws a World Shop’s doors in the walk at entry', () => {
    const room = observe(corpusRun('checkpoint/underworld-f-midshop-pom-frontier'), fMidShop);
    expect(room.walk[position(room.walk, 'roomEntered') + 1]).toBe('outgoingGenerationCheckpoint');
  });
});

describe('encounter depth', () => {
  // Each room's depth advances among the reached rows that read it, as the
  // Step 0 event-order snapshot recorded them.
  const baseline = JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'event-graph-families.depth-baseline.json'),
      'utf8',
    ),
  ) as Record<string, Record<string, string>>;

  it.each(Object.keys(baseline))('advances where it did before the event graph in %s', (entry) => {
    const run = corpusRun(entry);
    const rooms = new Map(
      corpusRooms(run.assembly).map((room) => [semanticAddressKey(room.origin), room]),
    );
    const walked = new Map<string, RoomHistoryFragment>();
    for (const fragment of run.fragments) walked.set(semanticAddressKey(fragment.origin), fragment);
    const actual: Record<string, string> = {};
    for (const [key, fragment] of walked) {
      const room = rooms.get(key);
      const tokens = walkTokens(fragment, rankMap(room)).filter(
        (token) => token.startsWith('#') || token.startsWith('encounterDepthAdvanced('),
      );
      if (tokens.some((token) => token.startsWith('encounterDepthAdvanced(')))
        actual[roomLabel(fragment.origin, room?.gameName)] = tokens.join(' > ');
    }
    expect(actual).toEqual(baseline[entry]);
  });
});
