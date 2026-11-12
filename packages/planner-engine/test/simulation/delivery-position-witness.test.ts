import { describe, expect, it, vi } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import type { Catalog, TraitDeclaration } from '@run-planner/engine/catalog-schema';
import {
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomActionAddress,
  roomActionKey,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { createAuthoringSession } from '@run-planner/engine/authoring';
import {
  levelResolutionCandidateForProjectEvaluationAssembly,
  simulateProjectAssembly,
  spawnedLootForProjectEvaluationAssembly,
  type ProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';
import { createGoldenFGHProject } from '@run-planner/test-fixtures/underworld';

import { parseClockedTraitGeneratedPickupEntryKey } from '../../src/authored-project/acquisition/pickup-producers';
import {
  hermesShrineDeliveryEntryKey,
  isDeliveryFlushHost,
  parseHermesShrineDeliveryEntryKey,
} from '../../src/authored-project/hermes-shrine-delivery';
import type { RoomHistoryFragment } from '../../src/simulation/lifecycle';
import type { CanonicalAuthoredRoom } from '../../src/simulation/materialization';
import type { RoomActionRow } from '../../src/simulation/room-actions';
import { equivalenceCorpus } from '../equivalence/corpus';
import { corpusRooms, roomLabel } from '../support/lifecycle-snapshots';

const fragments = vi.hoisted(() => [] as RoomHistoryFragment[]);

// Records each room walk as the history composition receives it.
vi.mock('../../src/simulation/lifecycle', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/simulation/lifecycle')>();
  return {
    ...actual,
    executeRoomLifecycle: (...args: Parameters<typeof actual.executeRoomLifecycle>) => {
      const fragment = actual.executeRoomLifecycle(...args);
      fragments.push(fragment);
      return fragment;
    },
  };
});

/**
 * Witness for judging a delivery or clocked-drop row by position instead of by
 * its stored encounter phase, while the phase still exists. Each placed row's
 * stored phase must be the arrival the walk derives at room entry; the row
 * must stand after its due spawn (that phase's end effects, room entry for a
 * flush host, its rush for a rushed item) and before its deadline (the next
 * wheel's choice after a non-final Ship phase; otherwise Doors open for a
 * required row and leaving for an optional one); and the bound "after any
 * end-effects event of this room" must let it stand no earlier than the stored
 * phase does. That last check assumes a ranked row whose bounds hold runs
 * before the next automatic event.
 */

type Kind = 'delivery' | 'clocked' | 'flush' | 'rush';
type Family = 'P' | 'Ship' | 'Fields' | 'single';
type Arrival = string | 'flush' | 'rush' | 'not derivable at entry' | 'never in this room';

interface RowWitness {
  readonly project: string;
  readonly room: string;
  readonly biomeKey: string;
  readonly entryKey: string;
  readonly kind: Kind;
  readonly family: Family;
  readonly stored: string | undefined;
  /** The arrival the walk's pending countdowns and clocks name at room entry. */
  readonly derived: Arrival;
  /** Placed and reached by the walk; any other row has no position to judge. */
  readonly placement: 'reached' | 'unreached' | 'unplaced' | 'stale';
  /** Why a reached row fails the new judgment; absent when it passes. */
  readonly failure?: string;
  /** Today's placement assessment, when the reward walk published one. */
  readonly assessment?: string;
  /** Whether the judgment by position would assess it valid. */
  readonly positionValid?: boolean;
}

function isTimedPickupRow(row: RoomActionRow): boolean {
  return (
    row.reference.kind === 'interactAcquisitionEntry' &&
    (row.reference.siteKey === 'hermesShrineDelivery' ||
      parseClockedTraitGeneratedPickupEntryKey(row.reference.entryKey) !== undefined)
  );
}

/** The arrival at room entry, counted down over the room's end effects (f0e22a1d2). */
function derivedArrival(
  catalog: Catalog,
  assembly: ProjectEvaluationAssembly,
  room: CanonicalAuthoredRoom,
  fragment: RoomHistoryFragment,
  entryKey: string,
  siteKey: string,
  routeOrdinal: number,
): Arrival {
  const evaluation = assembly.evaluation.route.biomes.find(
    (biome) => biome.biomeKey === room.origin.biomeKey,
  );
  if (evaluation === undefined || !('rewards' in evaluation)) return 'not derivable at entry';
  // A Ship room publishes its state before each phase instead of at entry;
  // nothing ends between its entry and its first phase's start.
  const entry = evaluation.rewards.runStateSnapshots.find(
    (snapshot) =>
      (snapshot.checkpoint === 'roomEntered' || snapshot.checkpoint === 'beforeEncounterStart') &&
      snapshot.owner.kind === 'roomRunStateCheckpoint' &&
      snapshot.owner.biomeKey === room.origin.biomeKey &&
      snapshot.owner.occurrenceId === room.occurrenceId,
  );
  if (entry === undefined) return 'not derivable at entry';
  const declaration = catalog.rooms.byKey[room.gameName];
  const encounterKeyByPhase = new Map<string, string>();
  for (const event of fragment.events)
    if (event.kind === 'encounterStarted')
      encounterKeyByPhase.set(event.phaseKey, event.encounterKey);
  const endEffects = fragment.events.flatMap((event) =>
    event.kind === 'encounterEndEffectsApplied' ? [event.phaseKey] : [],
  );
  if (siteKey === 'hermesShrineDelivery') {
    const source = parseHermesShrineDeliveryEntryKey(entryKey);
    if (
      source !== undefined &&
      source.sourceOccurrenceId === room.occurrenceId &&
      source.biomeKey === room.origin.biomeKey
    )
      // A rushed item arrives at its rush in the Shrine room, not at an encounter end.
      return 'rush';
    const pending = Object.values(entry.pendingHermesShrineDeliveries).find(
      (delivery) =>
        hermesShrineDeliveryEntryKey(delivery.source, delivery.generationKey) === entryKey,
    );
    if (pending === undefined) return 'not derivable at entry';
    if (
      pending.due?.cause === 'flush' ||
      (pending.due === undefined && isDeliveryFlushHost(declaration, { ordinal: routeOrdinal }))
    )
      return 'flush';
    if (pending.due !== undefined) return 'not derivable at entry';
    const deliveryEnds = endEffects.filter(
      (phaseKey) =>
        declaration?.advancesHermesShrineDeliveryUses === true &&
        declaration.ignoreEncounterUses !== true &&
        catalog.encounterDefinitions.byKey[encounterKeyByPhase.get(phaseKey) ?? '']
          ?.advancesHermesShrineDeliveryUses === true,
    );
    return deliveryEnds[pending.remainingUses - 1] ?? 'never in this room';
  }
  const clocked = parseClockedTraitGeneratedPickupEntryKey(entryKey)!;
  const trait = Object.values(entry.traits.equippedTraits).find(
    (candidate) => candidate.acquisitionIdentity === clocked.acquisitionIdentity,
  );
  // A trait gained inside the room has no clock at its entry.
  if (trait?.pickupProducerInterval === undefined) return 'not derivable at entry';
  const progress = trait.pickupProducerProgress ?? 0;
  const index = Math.max(0, trait.pickupProducerInterval - progress - 1);
  // A deferring room never matures a clock; it waits at its threshold.
  const deferred =
    declaration?.skipTimedDropResources === true ||
    (room.origin.routeKey === 'Dream' && declaration?.skipTimedDropResourcesInDream === true);
  const clockEnds = declaration?.skipRoomsPerUpgrade === true ? [] : endEffects;
  return deferred ? 'never in this room' : (clockEnds[index] ?? 'never in this room');
}

function witnessRoom(
  name: string,
  catalog: Catalog,
  assembly: ProjectEvaluationAssembly,
  room: CanonicalAuthoredRoom,
  fragment: RoomHistoryFragment,
  routeOrdinal: number,
): RowWitness[] {
  const roster = room.roomActionRoster;
  const rows = roster.rows.filter(isTimedPickupRow);
  if (rows.length === 0) return [];
  const events = fragment.events;
  /** 1-based local sequence of the first event matching, or undefined. */
  const seqOf = (predicate: (event: (typeof events)[number]) => boolean) => {
    const index = events.findIndex(predicate);
    return index < 0 ? undefined : index + 1;
  };
  const reachedByKey = new Map(fragment.reachedActions.map((action) => [action.actionKey, action]));
  const rankByKey = new Map(
    roster.rows.flatMap((row) => (row.rank === null || row.stale ? [] : [[row.key, row.rank]])),
  );
  const phases = roster.eventGraph.phases;
  const firstEndEffects = seqOf((event) => event.kind === 'encounterEndEffectsApplied');
  const roomEntered = seqOf((event) => event.kind === 'roomEntered');
  const doorsOpen = seqOf((event) => event.kind === 'outgoingGenerationCheckpoint');
  const committed = seqOf((event) => event.kind === 'roomCommitted');
  const evaluation = assembly.evaluation.route.biomes.find(
    (biome) => biome.biomeKey === room.origin.biomeKey,
  );
  const placements =
    evaluation !== undefined && 'rewards' in evaluation
      ? (evaluation.rewards.generatedPickupPlacements ?? [])
      : [];
  const declaration = catalog.rooms.byKey[room.gameName];
  const family: Family = phases.some((phase) => phase.phaseKey.startsWith('Cage'))
    ? 'Fields'
    : phases.some((phase) => phase.rewardWheelKey !== undefined)
      ? 'Ship'
      : room.origin.biomeKey === 'P'
        ? 'P'
        : 'single';

  return rows.map((row): RowWitness => {
    if (row.reference.kind !== 'interactAcquisitionEntry') throw new Error('unreachable');
    const reference = row.reference;
    const delivery =
      reference.siteKey === 'hermesShrineDelivery'
        ? parseHermesShrineDeliveryEntryKey(reference.entryKey)
        : undefined;
    const rush =
      delivery !== undefined &&
      delivery.biomeKey === room.origin.biomeKey &&
      delivery.sourceOccurrenceId === room.occurrenceId;
    const kind: Kind = rush
      ? 'rush'
      : delivery === undefined
        ? 'clocked'
        : reference.encounterPhaseKey === undefined &&
            isDeliveryFlushHost(declaration, { ordinal: routeOrdinal })
          ? 'flush'
          : 'delivery';
    const placement = placements.find(
      (candidate) =>
        candidate.address.kind === 'acquisitionEntry' &&
        semanticAddressKey(candidate.contact.owner) === semanticAddressKey(room.origin) &&
        candidate.address.entryKey === reference.entryKey,
    );
    const base = {
      project: name,
      room: roomLabel(room.origin, room.gameName),
      biomeKey: room.origin.biomeKey,
      entryKey: reference.entryKey,
      kind,
      family,
      stored: reference.encounterPhaseKey,
      derived: derivedArrival(
        catalog,
        assembly,
        room,
        fragment,
        reference.entryKey,
        reference.siteKey,
        routeOrdinal,
      ),
      ...(placement === undefined
        ? {}
        : {
            assessment:
              placement.assessment.kind === 'invalid'
                ? `invalid ${placement.assessment.reason}`
                : placement.assessment.kind,
          }),
    };
    const reached = reachedByKey.get(row.key);
    if (row.stale) return { ...base, placement: 'stale' };
    if (row.rank === null) return { ...base, placement: 'unplaced' };
    if (reached === undefined) return { ...base, placement: 'unreached' };
    // The row stands before the event with this sequence and after every earlier one.
    const position = reached.sequence;

    const due =
      kind === 'rush'
        ? seqOf(
            (event) =>
              event.kind === 'hermesShrineRushReached' &&
              event.generationKey === delivery!.generationKey,
          )
        : kind === 'flush'
          ? roomEntered
          : seqOf(
              (event) =>
                event.kind === 'encounterEndEffectsApplied' &&
                event.phaseKey === reference.encounterPhaseKey,
            );
    const phaseIndex = phases.findIndex((phase) => phase.phaseKey === reference.encounterPhaseKey);
    const nextWheelKey = phaseIndex < 0 ? undefined : phases[phaseIndex + 1]?.rewardWheelKey;
    const wheelKey =
      nextWheelKey === undefined
        ? undefined
        : roomActionKey({ kind: 'chooseRewardWheel', wheelKey: nextWheelKey });
    const wheel = wheelKey === undefined ? undefined : reachedByKey.get(wheelKey);
    const deadline =
      wheelKey !== undefined
        ? wheel?.sequence
        : row.participation === 'required'
          ? (doorsOpen ?? committed)
          : committed;
    const failures: string[] = [];
    if (due === undefined) failures.push('its due spawn never happened in this room');
    else if (due >= position) failures.push(`it stands before its due spawn (#${due})`);
    if (deadline !== undefined && position > deadline)
      failures.push(`it stands after its deadline (#${deadline})`);
    if (
      wheelKey !== undefined &&
      wheel !== undefined &&
      (rankByKey.get(wheelKey) ?? Infinity) < row.rank
    )
      failures.push('it ranks after the next wheel click');

    // The row's rank lets it stand no earlier than after the rows ranked before it
    // and their own events.
    const previous = fragment.reachedActions.reduce(
      (latest, action) =>
        (rankByKey.get(action.actionKey) ?? Infinity) < row.rank!
          ? Math.max(latest, (action.through ?? action.sequence - 1) + 1)
          : latest,
      1,
    );
    if (kind !== 'rush' && due !== undefined) {
      const bound = kind === 'flush' ? roomEntered : firstEndEffects;
      const today = Math.max(previous, due + 1);
      const dropped = bound === undefined ? undefined : Math.max(previous, bound + 1);
      if (dropped !== today)
        failures.push(
          `dropping its phase lets it stand from #${dropped} instead of #${today}, before its due spawn`,
        );
    }
    return {
      ...base,
      placement: 'reached',
      positionValid: failures.length === 0,
      ...(failures.length === 0 ? {} : { failure: failures.join('; ') }),
    };
  });
}

function witnessProject(name: string, catalog: Catalog, project: ProjectDocument): RowWitness[] {
  fragments.length = 0;
  const assembly = simulateProjectAssembly(catalog, project);
  // A room walked again (a progressive prefix after a block) keeps its last walk.
  const walked = new Map<string, RoomHistoryFragment>();
  for (const fragment of fragments) walked.set(semanticAddressKey(fragment.origin), fragment);
  return corpusRooms(assembly).flatMap((room) => {
    const fragment = walked.get(semanticAddressKey(room.origin));
    if (fragment === undefined) return [];
    const ordinal = project.route.itineraryBiomeKeys.indexOf(room.origin.biomeKey) + 1;
    return witnessRoom(name, catalog, assembly, room, fragment, ordinal);
  });
}

function counts(witnesses: readonly RowWitness[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const witness of witnesses) {
    const key = `${witness.biomeKey} ${witness.family} ${witness.kind}${witness.placement === 'reached' ? '' : ` (${witness.placement})`}`;
    result[key] = (result[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Supply Chain is the only clocked pickup producer and the Shrine sells only on
 * the Surface, so no Underworld or Surface route reaches a Fields cage with a
 * timed pickup. This test catalog clocks two of the golden F-H route's boons
 * every second qualifying encounter end instead, which matures one drop at a
 * Fields cage, one before its boon is lost and one after its boon is gained.
 */
function clockedBoonCatalog(): Catalog {
  const clocked = (trait: TraitDeclaration): TraitDeclaration =>
    Object.freeze({
      ...trait,
      selectedDisposition: Object.freeze({
        kind: 'producePickups' as const,
        producerLifecycleKey: 'GeneratedTraitPickup',
        pickups: Object.freeze([
          Object.freeze({ key: 'pom1', rewardType: 'StoreRewardRandomStack' }),
        ]),
        clock: Object.freeze({
          kind: 'qualifyingEncounterEndEffects' as const,
          intervalByAcquisitionOrdinal: Object.freeze([2, 2, 2, 2] as const),
        }),
      }),
    });
  const byKey = { ...catalog.traits.byKey };
  for (const key of ['ZeusSpecialBoon', 'HestiaCastBoon']) byKey[key] = clocked(byKey[key]!);
  return Object.freeze({
    ...catalog,
    traits: Object.freeze({
      ...catalog.traits,
      byKey: Object.freeze(byKey),
      values: Object.freeze(catalog.traits.values.map((trait) => byKey[trait.key]!)),
    }),
  });
}

/**
 * Places the clocked drop the walk matured in one H room, the one whose source
 * address mentions `source`, through the authoring session at its canonical
 * position, resolves its Pom, and moves it to `toIndex` when given.
 */
function placeClockedDrop(
  testCatalog: Catalog,
  start: ProjectEvaluationAssembly,
  occurrenceId: string,
  source: string,
  toIndex?: number,
): ProjectDocument {
  const biome = createBiomeAddress('Underworld', 'H');
  const room = createOccurrenceAddress(biome, createOccurrenceId(occurrenceId));
  const item = spawnedLootForProjectEvaluationAssembly(testCatalog, start, room)
    ?.moments.flatMap((moment) => moment.items)
    .find(
      (candidate) =>
        candidate.reference.kind === 'interactAcquisitionEntry' &&
        parseClockedTraitGeneratedPickupEntryKey(candidate.reference.entryKey) !== undefined &&
        decodeURIComponent(decodeURIComponent(candidate.reference.entryKey)).includes(source),
    );
  const command = item?.placement.kind === 'unplaced' ? item.placement.command : undefined;
  if (item === undefined || command?.kind !== 'PlaceClockedTraitPickup')
    throw new Error(`${occurrenceId} has no placeable drop from ${source}`);
  const session = createAuthoringSession(testCatalog, start);
  const applied = (outcome: ReturnType<typeof session.apply>) => {
    if (outcome.kind !== 'applied')
      throw new Error(`${occurrenceId} refused: ${JSON.stringify(outcome.refusal).slice(0, 400)}`);
  };
  applied(session.apply(command));
  for (const resolution of session
    .current()
    .evaluation.route.biomes.flatMap((evaluated) =>
      'rewards' in evaluated ? evaluated.rewards.selectedLevelResolutions : [],
    )) {
    if (resolution.assessment.findings.length === 0) continue;
    const capability = levelResolutionCandidateForProjectEvaluationAssembly(
      session.current(),
      resolution.address,
    );
    const targetTraitKey = capability?.surface.eligibleTargetTraitKeys[0];
    if (capability?.surface.effectKind !== 'random' || targetTraitKey === undefined)
      throw new Error(`${occurrenceId} drop has no random Pom target`);
    applied(
      session.apply({
        kind: 'ReplaceLevelResolution',
        levelResolution: resolution.address,
        value: { kind: 'random', targetTraitKey },
      }),
    );
  }
  if (toIndex !== undefined)
    applied(
      session.apply({
        kind: 'MoveRoomAction',
        action: createRoomActionAddress(biome, room.occurrenceId, roomActionKey(item.reference)),
        toIndex,
      }),
    );
  return session.current().project;
}

function authoredWitnesses(): RowWitness[] {
  const testCatalog = clockedBoonCatalog();
  const start = simulateProjectAssembly(testCatalog, createGoldenFGHProject());
  const zeus = 'golden-f-b2-e1';
  const hestia = 'golden-h-combat05';
  const projects: [string, ProjectDocument][] = [
    // Cage02 fights first: its drop is taken between the cages and after the later cage.
    [
      'fields/first-cage-drop-after-later-cage',
      placeClockedDrop(testCatalog, start, 'golden-h-combat09', zeus),
    ],
    [
      'fields/first-cage-drop-between-cages',
      placeClockedDrop(testCatalog, start, 'golden-h-combat09', zeus, 2),
    ],
    // The room's reward replaces Zeus's Special after its fight matured the drop.
    [
      'clocked/trait-lost-mid-room',
      placeClockedDrop(testCatalog, start, 'golden-h-miniboss01', zeus),
    ],
    // Cage03's Boon equips Hestia's Cast, whose clock matures at Cage01.
    [
      'clocked/trait-gained-mid-room',
      placeClockedDrop(testCatalog, start, 'golden-h-combat05', hestia),
    ],
  ];
  return projects.flatMap(([name, project]) =>
    witnessProject(name, testCatalog, project).filter(
      (witness) => witness.placement !== 'unplaced',
    ),
  );
}

/**
 * Ship deliveries due as Combat1's deferred end effects apply: the Intro's end
 * effects already satisfy "after any end-effects event", so a row ranked right
 * after the wheel's reward pickup would run before Combat1's end effects, its
 * due spawn. These block dropping the phase.
 */
const SHIP_COMBAT1_BLOCKERS = [
  'execution/surface-scheduled-lifecycle O/surface-o-combat04 O_Combat04 due Combat1',
  'execution/surface-shrine-deliveries O/surface-o-combat04 O_Combat04 due Combat1',
  'execution/surface-shrine-deliveries O/surface-o-combat01 O_Combat01 due Combat1',
  'execution/surface-shrine-rushed-unranked O/surface-o-combat04 O_Combat04 due Combat1',
  'execution/surface-shrine-rushed-unranked O/surface-o-combat01 O_Combat01 due Combat1',
  'execution/surface-start-q-opening O/surface-o-combat04 O_Combat04 due Combat1',
  'execution/surface-start-q-opening O/surface-o-combat01 O_Combat01 due Combat1',
  'checkpoint/surface-shrine-travel-deal O/surface-o-combat04 O_Combat04 due Combat1',
  'checkpoint/surface-scheduled-lifecycle O/surface-o-combat04 O_Combat04 due Combat1',
  'surface/surfaceShrineTravelDealProject O/surface-o-combat04 O_Combat04 due Combat1',
];

const rowLabel = (witness: RowWitness) =>
  `${witness.project} ${witness.room} due ${witness.stored ?? witness.kind}`;

describe('delivery and clocked-drop position under the due-spawn judgment', () => {
  const corpus = equivalenceCorpus().flatMap((entry) =>
    witnessProject(entry.name, entry.catalog, entry.project()),
  );
  const authored = authoredWitnesses();
  const all = [...corpus, ...authored];

  it('covers every timed pickup kind, with Fields and mid-room clocks authored', () => {
    expect(counts(corpus)).toEqual({
      'N single delivery': 1,
      'N single rush': 4,
      'O Ship delivery': 13,
      'O Ship rush': 4,
      'O Ship rush (unplaced)': 1,
      'O single delivery': 2,
      'O single rush': 3,
      'P P clocked': 2,
      'P P delivery': 2,
      'Q single flush': 3,
    });
    expect(authored.map((witness) => [witness.project, witness.room, witness.stored])).toEqual([
      ['fields/first-cage-drop-after-later-cage', 'H/golden-h-combat09 H_Combat09', 'Cage02'],
      ['fields/first-cage-drop-between-cages', 'H/golden-h-combat09 H_Combat09', 'Cage02'],
      ['clocked/trait-lost-mid-room', 'H/golden-h-miniboss01 H_MiniBoss01', 'Encounter'],
      ['clocked/trait-gained-mid-room', 'H/golden-h-combat05 H_Combat05', 'Cage01'],
    ]);
    expect(authored.every((witness) => witness.placement === 'reached')).toBe(true);
  });

  it('derives each stored arrival from the walk at room entry', () => {
    const disagreements = all.filter(
      (witness) =>
        // A trait gained inside the room has no clock to count down at its entry.
        !(witness.project === 'clocked/trait-gained-mid-room') &&
        (witness.stored ?? (witness.derived === 'rush' ? 'rush' : 'flush')) !== witness.derived,
    );
    expect(disagreements).toEqual([]);
  });

  it('stands after its due spawn and before its deadline, except the Ship Combat1 blockers', () => {
    expect(all.filter((witness) => witness.failure !== undefined).map(rowLabel)).toEqual(
      SHIP_COMBAT1_BLOCKERS,
    );
  });

  it('adds no finding outside the Ship Combat1 blockers', () => {
    expect(
      all
        .filter((witness) => witness.assessment === 'valid' && witness.positionValid === false)
        .map(rowLabel),
    ).toEqual(SHIP_COMBAT1_BLOCKERS);
    expect(all.filter((witness) => witness.assessment?.startsWith('invalid'))).toEqual([]);
  });
});
