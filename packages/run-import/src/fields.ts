import {
  createAcquisitionRoleAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createRoomFeatureAddress,
  type FieldsCombatState,
  type FieldsSpatialAddress,
  type OccurrenceId,
  type ProjectCommand,
  type SemanticAddress,
  exitDecisionForSource,
  normalDecisionProgressionForLayout,
} from '@run-planner/engine/authored-project';
import {
  locallyValidRewardOffers,
  type ResolvedRewardOffer,
} from '@run-planner/engine/reward-kernel';
import type { SemanticFinding } from '@run-planner/engine/simulation';
import type { RunRecordFields, RunRecordRoom } from './run-record/model';
import type { RunImportContext } from './import';
import { insertRoomAction } from './actions';
import {
  ARTIFICER_STORE,
  convertAcquisition,
  recordedConversions,
  type ConversionKind,
  type ConversionReplacement,
} from './dispositions';
import { authoredOccurrence, deliveredCageReward } from './occurrences';
import { chooseRoomFit, searchRoom } from './room-search';
import { recordedOffer } from './vocabulary';
import { recordedEntryStates } from './conformance';
import { savedBracketDraws } from './store-brackets';

type Origin<K extends SemanticAddress['kind']> = Extract<SemanticAddress, { readonly kind: K }>;

const record = (roomIndex: number) => ({ roomIndex, visit: 0 });

/** Record cages in opening order own slots `cage1`, `cage2`, … and phases `Cage01`, `Cage02`, …. */
export const cageIndexOfSlot = (slotKey: string) => Number(/^cage(\d+)$/.exec(slotKey)?.[1]) - 1;
export const cageIndexOfPhase = (phaseKey: string) => Number(/^Cage(\d+)$/.exec(phaseKey)?.[1]) - 1;

function fieldsVisit(
  context: RunImportContext,
  occurrenceId: string,
):
  | { readonly roomIndex: number; readonly room: RunRecordRoom; readonly fields: RunRecordFields }
  | undefined {
  for (const roomIndex of context.occurrences.visitsOf(occurrenceId)) {
    const room = context.record.rooms[roomIndex]!;
    if (room.fields !== undefined) return { roomIndex, room, fields: room.fields };
  }
  return undefined;
}

function fieldsState(
  context: RunImportContext,
  biomeKey: string,
  occurrenceId: string,
): FieldsCombatState | undefined {
  const state = authoredOccurrence(context.assembly().project, biomeKey, occurrenceId)?.state;
  return state?.kind === 'fieldsCombat' ? state : undefined;
}

/**
 * The record's optional rewards: those still listed with their point, then
 * those collected before listing, which no save lists.
 */
function optionalRewards(
  context: RunImportContext,
  visit: NonNullable<ReturnType<typeof fieldsVisit>>,
  rewardTypes: ReadonlySet<string>,
): readonly { readonly reward: string; readonly point?: number; readonly collected?: boolean }[] {
  const listed = visit.fields.optionalRewards.map((entry) => ({
    reward: entry.reward,
    point: entry.point,
    ...(entry.collected === undefined ? {} : { collected: entry.collected }),
  }));
  const cages = new Map<string, number>();
  for (const cage of visit.fields.cages) {
    const name = cage.reward.lootName ?? cage.reward.type;
    cages.set(name, (cages.get(name) ?? 0) + 1);
  }
  const collectedListed = new Map<string, number>();
  for (const entry of visit.fields.optionalRewards)
    if (entry.collected === true)
      collectedListed.set(entry.reward, (collectedListed.get(entry.reward) ?? 0) + 1);
  // A use no cage and no listed optional explains is an optional collected in combat.
  const unlisted = Object.entries(visit.room.uses).flatMap(([name, count]) => {
    if (!rewardTypes.has(name)) return [];
    const extra = count - (cages.get(name) ?? 0) - (collectedListed.get(name) ?? 0);
    return Array.from({ length: Math.max(0, extra) }, () => ({ reward: name, collected: true }));
  });
  return [...listed, ...unlisted];
}

/** The reward types an optional slot of this room admits: its stores' entries. */
function optionalRewardTypes(context: RunImportContext, gameName: string): ReadonlySet<string> {
  const reward = context.catalog.rooms.byKey[gameName]?.fieldsOptionalRewards?.reward;
  if (reward === undefined) return new Set();
  const stores = context.catalog.rewards.stores;
  return new Set([
    ...reward.allowedRewardTypes,
    ...reward.storeKeys.flatMap(
      (key) => stores.byKey[key]?.entries.map((entry) => entry.rewardType) ?? [],
    ),
  ]);
}

/** Answers Fields cage outcomes, cage and optional rewards and spatial points from the record. */
export function answerFields(context: RunImportContext, reason: SemanticFinding): boolean {
  const origin = reason.origin;
  if (reason.code === 'batchStateMissing' && origin.kind === 'exitDecision')
    return answerCageOutcome(context, origin);
  if (reason.code === 'rewardMissing' && origin.kind === 'localReward')
    return answerFieldsReward(context, origin);
  if (reason.code === 'fieldsSpatialPointMissing' && origin.kind === 'fieldsSpatial')
    return answerSpatialPoint(context, origin);
  return false;
}

/** The cage count a source's doors show: the entered Fields room's, or a door never taken. */
function observedCageCount(context: RunImportContext, occurrenceId: string): number | undefined {
  const visits = context.occurrences.visitsOf(occurrenceId);
  const next = visits.map((index) => context.record.rooms[index + 1]).find((room) => room?.fields);
  const untaken = visits
    .flatMap((index) => context.record.rooms[index]!.doors)
    .find((door) => door.cageRewards !== undefined);
  return next?.fields?.cages.length ?? untaken?.cageRewards?.length;
}

const fieldsOutcomeSupported = (
  context: RunImportContext,
  decision: Origin<'exitDecision'>,
  cageOutcome: 'min' | 'max',
) => {
  const evaluation = context
    .candidates()
    .evaluate({ kind: 'fieldsCageOutcome', decision, cageOutcome });
  return evaluation.kind === 'fieldsCageOutcome' && evaluation.result.selectedPossible;
};

/**
 * An earlier source of the biome whose doors show no cage count holds a
 * provisional roll; when a later recorded roll is supported only after that
 * roll is the other outcome (each Max roll counts toward the biome's ceiling),
 * the earlier roll is switched, latest first, and reported. Returns whether
 * `cageOutcome` became supported at `decision`.
 */
function switchUnseenRoll(
  context: RunImportContext,
  decision: Origin<'exitDecision'>,
  cageOutcome: 'min' | 'max',
): boolean {
  if (decision.source.kind !== 'occurrence') return false;
  const first = context.occurrences.visitsOf(decision.source.occurrenceId)[0];
  if (first === undefined) return false;
  const biome = createBiomeAddress(decision.routeKey, decision.biomeKey);
  const topology = context
    .assembly()
    .project.route.biomes.find((entry) => entry.biomeKey === decision.biomeKey)?.topology;
  for (let index = first - 1; index >= 0; index--) {
    if (context.occurrences.biomeOfRoom[index] !== decision.biomeKey) break;
    const occurrenceId = context.occurrences.occurrenceOf(index);
    if (observedCageCount(context, occurrenceId) !== undefined) continue;
    const source = { kind: 'occurrence' as const, occurrenceId: occurrenceId as OccurrenceId };
    const state =
      topology === undefined || topology === null
        ? undefined
        : exitDecisionForSource(topology, source)?.normal;
    const held = state?.kind === 'batch' ? state.batchState : undefined;
    if (held === undefined || held === null) continue;
    const command: ProjectCommand = {
      kind: 'ReplaceFieldsCageOutcome',
      decision: createExitDecisionAddress(biome, source),
      cageOutcome: held.cageOutcome === 'min' ? 'max' : 'min',
    };
    if (
      context.transaction(
        () => context.apply(command) && fieldsOutcomeSupported(context, decision, cageOutcome),
      )
    ) {
      context.note({
        area: 'fields',
        reason: 'assumption',
        address: createExitDecisionAddress(biome, source),
        applied: command,
        record: record(index),
      });
      return true;
    }
  }
  return false;
}

/**
 * One roll sets every Fields door's cage count: the minimum, or the maximum
 * the doors' rooms hold. The entered Fields room's cage count shows which.
 */
function answerCageOutcome(context: RunImportContext, decision: Origin<'exitDecision'>): boolean {
  if (decision.source.kind !== 'occurrence') return false;
  const layout = context.catalog.biomeLayouts.byKey[decision.biomeKey];
  const policy =
    layout === undefined ? undefined : normalDecisionProgressionForLayout(layout)?.batchPolicy;
  const visits = context.occurrences.visitsOf(decision.source.occurrenceId);
  const next = visits.map((index) => context.record.rooms[index + 1]).find((room) => room?.fields);
  const untaken = visits
    .flatMap((index) => context.record.rooms[index]!.doors)
    .find((door) => door.cageRewards !== undefined);
  const count = observedCageCount(context, decision.source.occurrenceId);
  if (count === undefined || policy?.kind !== 'fields') return false;
  const supported = (['min', 'max'] as const).filter((cageOutcome) => {
    const evaluation = context
      .candidates()
      .evaluate({ kind: 'fieldsCageOutcome', decision, cageOutcome });
    return evaluation.kind === 'fieldsCageOutcome' && evaluation.result.selectedPossible;
  });
  const minimum = policy?.minDoorCageRewards;
  const outcome: 'min' | 'max' | undefined =
    minimum === undefined ? undefined : count === minimum ? 'min' : 'max';
  const cageGroup = context.catalog.rooms.byKey[
    next?.name ?? untaken?.room ?? ''
  ]?.localChildren.find((child) => child.kind === 'boundedRewardSlots' && child.key === 'cages');
  // A minimum equal to the entered room's capacity is also what the maximum yields.
  const ambiguous =
    outcome === 'min' &&
    supported.includes('max') &&
    cageGroup?.kind === 'boundedRewardSlots' &&
    cageGroup.maxActiveSlots === count;
  const ordered = outcome === undefined ? [] : [outcome];
  for (const cageOutcome of ordered) {
    if (!supported.includes(cageOutcome) && !switchUnseenRoll(context, decision, cageOutcome))
      continue;
    const topology = context
      .assembly()
      .project.route.biomes.find((biome) => biome.biomeKey === decision.biomeKey)?.topology;
    const existing =
      topology === undefined || topology === null
        ? undefined
        : exitDecisionForSource(topology, decision.source);
    const command: ProjectCommand =
      existing === undefined
        ? {
            kind: 'InitializeExitDecision',
            decision,
            edit: { kind: 'fieldsCageOutcome', cageOutcome },
          }
        : { kind: 'ReplaceFieldsCageOutcome', decision, cageOutcome };
    if (!context.applyValid(command)) continue;
    if (ambiguous)
      context.note({
        area: 'fields',
        reason: 'assumption',
        address: decision,
        applied: command,
        record: record(visits[0]!),
      });
    return true;
  }
  context.refuse();
  return false;
}

function answerFieldsReward(context: RunImportContext, reward: Origin<'localReward'>): boolean {
  const visit = fieldsVisit(context, reward.occurrenceId);
  if (visit === undefined) {
    if (reward.groupKey !== 'cages') return false;
    const recorded = untakenCageRewards(context, reward.occurrenceId);
    return recorded !== undefined
      ? answerUntakenCages(context, reward, recorded)
      : solveUnrecordedCages(context, reward) || answerUnrecordedCage(context, reward);
  }
  let offers: readonly ResolvedRewardOffer[];
  if (reward.groupKey === 'cages') {
    const placed = `cagesPlaced:${reward.occurrenceId}`;
    if (!context.used.has(placed)) {
      context.used.add(placed);
      if (placeRecordedCages(context, reward, visit.fields)) return true;
    }
    const cage = visit.fields.cages[cageIndexOfSlot(reward.slotKey)];
    const offer = recordedOffer(context.catalog, cage?.reward);
    offers = offer === undefined ? [] : [offer];
  } else if (reward.groupKey === 'optionalRewards') {
    const occurrence = authoredOccurrence(
      context.assembly().project,
      reward.biomeKey,
      reward.occurrenceId,
    );
    if (occurrence === undefined) return false;
    const entries = optionalRewards(
      context,
      visit,
      optionalRewardTypes(context, occurrence.gameName),
    );
    const name = entries[Number(/^optional(\d+)$/.exec(reward.slotKey)?.[1]) - 1]?.reward;
    offers = name === undefined ? [] : locallyValidRewardOffers(context.catalog.rewards, name);
  } else return false;
  if (offers.length === 0) return false;
  for (const offer of offers) {
    const evaluation = context.candidates().evaluate({ kind: 'localReward', reward, value: offer });
    const command: ProjectCommand = { kind: 'ReplaceLocalReward', reward, value: offer };
    if (
      evaluation.kind !== 'localReward' ||
      !evaluation.result.supported ||
      evaluation.result.findings.length > 0 ||
      !context.applyValid(command)
    )
      continue;
    // An optional reward's saved name does not say which god a boon variant holds.
    if (offers.length > 1)
      context.note({
        area: 'fields',
        reason: 'notInRecord',
        address: reward,
        applied: command,
        record: record(visit.roomIndex),
      });
    return true;
  }
  context.refuse();
  return false;
}

/** The cage rewards a door never taken rolled, by the offered occurrence it created. */
function untakenCageRewards(context: RunImportContext, occurrenceId: string) {
  const offered = context.occurrences.offeredDoor(occurrenceId);
  if (offered === undefined) return undefined;
  const roomIndex = offered.roomIndex;
  const door = context.record.rooms[roomIndex]?.doors.find(
    (candidate) => candidate.door === offered.door,
  );
  return door?.cageRewards === undefined ? undefined : { roomIndex, rewards: door.cageRewards };
}

function permutations<T>(values: readonly T[]): T[][] {
  if (values.length <= 1) return [[...values]];
  return values.flatMap((value, index) =>
    permutations([...values.slice(0, index), ...values.slice(index + 1)]).map((rest) => [
      value,
      ...rest,
    ]),
  );
}

/** One way to author a door's recorded cages: an engine-legal offer per slot, in slot order. */
type CageValues = readonly { readonly slotKey: string; readonly value: ResolvedRewardOffer }[];

/**
 * Each way to author `types` on `slots` in order: every offer of a slot's
 * type the engine admits once the earlier slots hold theirs.
 */
function expandCageOffers(
  context: RunImportContext,
  reward: Origin<'localReward'>,
  slots: readonly string[],
  types: readonly string[],
  prefix: CageValues = [],
): CageValues[] {
  const slotKey = slots[prefix.length];
  if (slotKey === undefined) return [prefix];
  const target = { ...reward, slotKey };
  const admitted = context.probe(() =>
    prefix.every(({ slotKey: held, value }) =>
      context.apply({ kind: 'ReplaceLocalReward', reward: { ...reward, slotKey: held }, value }),
    )
      ? locallyValidRewardOffers(context.catalog.rewards, types[prefix.length]!).filter((value) => {
          const evaluation = context
            .candidates()
            .evaluate({ kind: 'localReward', reward: target, value });
          return (
            evaluation.kind === 'localReward' &&
            evaluation.result.supported &&
            evaluation.result.findings.length === 0
          );
        })
      : [],
  );
  return admitted.flatMap((value) =>
    expandCageOffers(context, reward, slots, types, [...prefix, { slotKey, value }]),
  );
}

/** Each distinct order of `types`. */
const distinctOrders = (types: readonly string[]) =>
  permutations(types).filter(
    (order, index, all) => all.findIndex((other) => other.join() === order.join()) === index,
  );

/** The offers a choice draws, ignoring their order: another order is the same saved state. */
const drawnOffers = (values: CageValues) =>
  values
    .map(({ value }) => JSON.stringify(value))
    .sort()
    .join();

/** Whether the Fields room a source visit entered holds every cage the record gives it. */
function takenCagesHeld(context: RunImportContext, biomeKey: string, sourceIndex: number): boolean {
  const taken = context.record.rooms[sourceIndex + 1]?.fields;
  if (taken === undefined) return true;
  const state = fieldsState(context, biomeKey, context.occurrences.occurrenceOf(sourceIndex + 1));
  const held = Object.values(state?.cages ?? {}).flatMap((cage) =>
    cage === null ? [] : [JSON.stringify(cage.offer)],
  );
  return taken.cages.every((cage) => {
    const index = held.indexOf(JSON.stringify(recordedOffer(context.catalog, cage.reward)));
    if (index < 0) return false;
    held.splice(index, 1);
    return true;
  });
}

/**
 * An untaken door's cages take the reward types the stores lost for them;
 * the roll order and a boon's god are not saved. The source's doors draw
 * their cages together, so each order with each engine-legal offer is
 * authored with the entered Fields room's recorded cages pinned beside it,
 * and the first the source room's next entry save accepts is kept. Without
 * one the cages stay open.
 */
function answerUntakenCages(
  context: RunImportContext,
  reward: Origin<'localReward'>,
  recorded: NonNullable<ReturnType<typeof untakenCageRewards>>,
): boolean {
  const state = fieldsState(context, reward.biomeKey, reward.occurrenceId);
  if (state === undefined) return false;
  const slots = Object.keys(state.cages).filter(
    (slotKey) => cageIndexOfSlot(slotKey) < recorded.rewards.length,
  );
  if (slots.length !== recorded.rewards.length) return false;
  const sourceIndex = recorded.roomIndex;
  const search = searchRoom(context, {
    roomIndex: sourceIndex,
    candidates: (function* () {
      for (const order of distinctOrders(recorded.rewards))
        yield* expandCageOffers(
          context,
          reward,
          slots,
          slots.map((slotKey) => order[cageIndexOfSlot(slotKey)]!),
        );
    })(),
    author: (values: CageValues) => {
      const commands = values.map(({ slotKey, value }): ProjectCommand => ({
        kind: 'ReplaceLocalReward',
        reward: { ...reward, slotKey },
        value,
      }));
      if (!commands.every((command) => context.apply(command))) return undefined;
      return { commands, drawn: drawnOffers(values) };
    },
    // The entered room's recorded cages, and a reroll redrawing a cage, are authored on the probe as the walk would.
    settles: [context.occurrences.occurrenceOf(sourceIndex + 1)],
    sweep: true,
    fits: () => takenCagesHeld(context, reward.biomeKey, sourceIndex),
  });
  const accepted = search.fits.filter((fit) => fit.accepted);
  const chosen = accepted[0]?.choice;
  if (search.fits.length === 0) context.refuse();
  if (
    chosen === undefined ||
    !context.transaction(() => chosen.commands.every((command) => context.apply(command)))
  )
    return false;
  // Another order of the same offers is the same saved state; another offer is a choice.
  const others = accepted.filter(
    (fit, index) =>
      fit.choice.drawn !== chosen.drawn &&
      accepted.findIndex((first) => first.choice.drawn === fit.choice.drawn) === index,
  );
  if (search.fits.length > 1 || search.capped)
    context.note({
      area: 'fields',
      reason: 'assumption',
      address: reward,
      applied: chosen.commands[0]!,
      ...(others.length > 0 ? { alternatives: others.flatMap((fit) => fit.choice.commands) } : {}),
      record: record(sourceIndex),
    });
  return true;
}

/**
 * The record cage each slot holds. Slots follow the game's draw order, which
 * the record does not keep: a slot whose delivered reward is a recorded cage's
 * holds it, and the rest take the cages left in opening order.
 */
function recordCageOfSlots(
  context: RunImportContext,
  biomeKey: string,
  occurrenceId: string,
  fields: RunRecordFields,
): readonly number[] {
  const state = fieldsState(context, biomeKey, occurrenceId);
  const offers = fields.cages.map((cage) =>
    JSON.stringify(recordedOffer(context.catalog, cage.reward)),
  );
  const held = fields.cages.map((_cage, index) => {
    const slotKey = `cage${index + 1}`;
    const delivered = state?.rerolledCages?.[slotKey] ?? state?.cages[slotKey];
    return delivered === null || delivered === undefined
      ? undefined
      : JSON.stringify(delivered.offer);
  });
  const free = new Set(fields.cages.keys());
  const indices: (number | undefined)[] = held.map((offer) => {
    const match = [...free].find((index) => offers[index] === offer);
    if (match !== undefined) free.delete(match);
    return match;
  });
  return indices.map((index) => {
    if (index !== undefined) return index;
    const next = [...free][0]!;
    free.delete(next);
    return next;
  });
}

/**
 * Places a Fields room's recorded cages on its slots in the first order the
 * plan draws them: the record keeps opening order, and a draw a refill makes
 * possible fails in another order. Kept only when every cage places.
 */
function placeRecordedCages(
  context: RunImportContext,
  reward: Origin<'localReward'>,
  fields: RunRecordFields,
): boolean {
  const offers = fields.cages.map((cage) => recordedOffer(context.catalog, cage.reward));
  const state = fieldsState(context, reward.biomeKey, reward.occurrenceId);
  if (
    state === undefined ||
    offers.some((offer) => offer === undefined) ||
    fields.cages.some((_cage, index) => !(`cage${index + 1}` in state.cages))
  )
    return false;
  const target = (slot: number) => ({ ...reward, slotKey: `cage${slot + 1}` });
  // A slot already holding the cage takes it without a change.
  const place = (slot: number, index: number) =>
    context.apply({ kind: 'ReplaceLocalReward', reward: target(slot), value: offers[index]! }) ||
    sameCage(context, target(slot), offers[index]!);
  const search = (slot: number, left: readonly number[]): readonly number[] | undefined => {
    if (left.length === 0) return [];
    for (const index of left) {
      const evaluation = context
        .candidates()
        .evaluate({ kind: 'localReward', reward: target(slot), value: offers[index]! });
      if (
        evaluation.kind === 'localReward' &&
        (!evaluation.result.supported || evaluation.result.findings.length > 0)
      )
        continue;
      const rest = context.probe(() =>
        place(slot, index)
          ? search(
              slot + 1,
              left.filter((other) => other !== index),
            )
          : undefined,
      );
      if (rest !== undefined) return [index, ...rest];
    }
    return undefined;
  };
  const order = search(
    0,
    fields.cages.map((_cage, index) => index),
  );
  return (
    order !== undefined &&
    context.transaction(() => order.every((index, slot) => place(slot, index)))
  );
}

/** Whether a cage slot already holds the value, so placing it changes nothing. */
function sameCage(
  context: RunImportContext,
  reward: Origin<'localReward'>,
  value: ResolvedRewardOffer,
): boolean {
  const held = fieldsState(context, reward.biomeKey, reward.occurrenceId)?.cages[reward.slotKey];
  return (
    held !== null && held !== undefined && JSON.stringify(held.offer) === JSON.stringify(value)
  );
}

/** The occurrence's cage slots the plan still asks a reward for. */
function missingCageSlots(context: RunImportContext, occurrenceId: string): readonly string[] {
  return context
    .assembly()
    .evaluation.findings.flatMap((finding) =>
      finding.code === 'rewardMissing' &&
      finding.origin.kind === 'localReward' &&
      finding.origin.occurrenceId === occurrenceId &&
      finding.origin.groupKey === 'cages'
        ? [finding.origin.slotKey]
        : [],
    );
}

/** One way to author an untaken door's cages: an offer per slot, and the source's Artificer replacement. */
interface CageCandidate {
  readonly values: CageValues;
  readonly replacement: string | undefined;
}

/**
 * The candidates of one bracket solution: each replacement type the source's
 * Artificer may take, then each cage order with each offer the engine admits.
 */
function* cageCandidates(
  context: RunImportContext,
  reward: Origin<'localReward'>,
  slots: readonly string[],
  solution: readonly string[],
  artificer: boolean,
): Generator<CageCandidate> {
  const replacements = artificer ? [...new Set(solution)] : [undefined];
  for (const replacement of replacements) {
    const cages = [...solution];
    if (replacement !== undefined) cages.splice(cages.indexOf(replacement), 1);
    for (const order of distinctOrders(cages))
      for (const values of expandCageOffers(context, reward, slots, order))
        yield { values, replacement };
  }
}

/**
 * An untaken door's cages the record cannot attribute, as when a store
 * refilled, take the reward types the stores lost across the source room
 * beyond the plan's other draws. The source room's waiting Artificer
 * replacement is one more of those draws, searched with the cages. Each
 * multiset that bracket explains is authored in each order, a boon with each
 * god the engine admits, with the entered Fields room's questions answered
 * and the walk's sweep run after it (its recorded cages are drawn with the
 * same batch), and fits when that room holds its recorded cages and the
 * source room adds no store difference at the next entry save; the first fit
 * that save accepts is kept, or the first fit. Several fits are reported, as
 * is any boon's god, which no save shows.
 */
function solveUnrecordedCages(context: RunImportContext, reward: Origin<'localReward'>): boolean {
  const offered = context.occurrences.offeredDoor(reward.occurrenceId);
  const occurrence = authoredOccurrence(
    context.assembly().project,
    reward.biomeKey,
    reward.occurrenceId,
  );
  const group =
    occurrence === undefined
      ? undefined
      : context.catalog.rooms.byKey[occurrence.gameName]?.localChildren.find(
          (child) => child.kind === 'boundedRewardSlots' && child.key === 'cages',
        );
  const solved = `untakenCages:${reward.occurrenceId}`;
  if (
    offered === undefined ||
    context.used.has(solved) ||
    group?.kind !== 'boundedRewardSlots' ||
    group.reward.kind !== 'countedChoice' ||
    group.reward.storeKeys.length !== 1
  )
    return false;
  context.used.add(solved);
  const storeKey = group.reward.storeKeys[0]!;
  const sourceIndex = offered.roomIndex;
  // A provisional fill shows how many cages the door holds.
  const measured = context.probe(() => {
    const slots: string[] = [];
    for (let slotKey: string | undefined = reward.slotKey; slotKey !== undefined;) {
      if (!guessUnrecordedCage(context, { ...reward, slotKey }, false)) return undefined;
      const value = fieldsState(context, reward.biomeKey, reward.occurrenceId)?.cages[slotKey];
      if (value === null || value === undefined) return undefined;
      slots.push(slotKey);
      slotKey = missingCageSlots(context, reward.occurrenceId)[0];
    }
    return slots;
  });
  // The source's Artificer is released to the walk whatever the search finds.
  const artificer = storeKey === ARTIFICER_STORE && fieldsConversionWaits(context, sourceIndex);
  if (artificer) context.used.add(`fieldsConversionReleased:${sourceIndex}`);
  if (measured === undefined) return false;
  // The entered room's cages and the doors' rewards the store declares are the window's known draws.
  const declared = new Set(
    context.catalog.rewards.stores.byKey[storeKey]?.entries.map((entry) => entry.rewardType),
  );
  const known = [
    ...(context.record.rooms[sourceIndex + 1]?.fields?.cages ?? []).map((cage) => cage.reward.type),
    ...context.record.rooms[sourceIndex]!.doors.flatMap((door) =>
      door.reward !== undefined && declared.has(door.reward.type) ? [door.reward.type] : [],
    ),
  ];
  const solutions = savedBracketDraws(
    context,
    sourceIndex,
    storeKey,
    known,
    measured.length + (artificer ? 1 : 0),
  );
  const slots = [...measured].sort((left, right) => cageIndexOfSlot(left) - cageIndexOfSlot(right));
  const search = searchRoom(context, {
    roomIndex: sourceIndex,
    candidates: (function* () {
      for (const solution of solutions)
        if (solution.every((draw) => draw.storeKey === storeKey))
          yield* cageCandidates(
            context,
            reward,
            slots,
            solution.map((draw) => draw.rewardType),
            artificer,
          );
    })(),
    author: ({ values, replacement }) => {
      const commands = values.map(({ slotKey, value }): ProjectCommand => ({
        kind: 'ReplaceLocalReward',
        reward: { ...reward, slotKey },
        value,
      }));
      if (
        !commands.every((command) => context.apply(command)) ||
        (replacement !== undefined &&
          !convertFieldsPickups(context, sourceIndex, {
            kinds: ['artificer'],
            replacement: { rewardType: replacement, assumed: false },
          }))
      )
        return undefined;
      const boons = values.filter(({ value }) => value.payload?.kind === 'BoonSource').length;
      return { commands, boons, replacement, drawn: drawnOffers(values) };
    },
    settles: [context.occurrences.occurrenceOf(sourceIndex + 1)],
    sweep: true,
    fits: () => {
      const acceptance = context.acceptance(sourceIndex);
      // A next save the candidate never reaches refuses it; one the record lacks judges nothing.
      return (
        takenCagesHeld(context, reward.biomeKey, sourceIndex) &&
        (acceptance.verdict === 'unchecked'
          ? acceptance.reason !== 'unreached'
          : acceptance.introduced.every((difference) => difference.area !== 'stores'))
      );
    },
  });
  const choice = chooseRoomFit(search.fits);
  if (choice === undefined) return false;
  const chosen = choice.chosen.choice;
  // Another order of the same draws is the same saved state; another multiset is a choice.
  const others = search.fits.filter(
    (fit, index, all) =>
      fit.accepted === choice.chosen.accepted &&
      (fit.choice.drawn !== chosen.drawn || fit.choice.replacement !== chosen.replacement) &&
      all.findIndex(
        (first) =>
          first.choice.drawn === fit.choice.drawn &&
          first.choice.replacement === fit.choice.replacement,
      ) === index,
  );
  if (
    !context.transaction(
      () =>
        chosen.commands.every((command) => context.apply(command)) &&
        (chosen.replacement === undefined ||
          convertFieldsPickups(context, sourceIndex, {
            kinds: ['artificer'],
            replacement: {
              rewardType: chosen.replacement,
              assumed: others.some((fit) => fit.choice.replacement !== chosen.replacement),
            },
          })),
    )
  )
    return false;
  if (chosen.replacement !== undefined) context.used.add(`conversion:${sourceIndex}`);
  if (others.length > 0 || chosen.boons > 0 || search.capped)
    context.note({
      area: 'fields',
      reason: 'assumption',
      address: reward,
      applied: chosen.commands[0]!,
      ...(others.length > 0 ? { alternatives: others.flatMap((fit) => fit.choice.commands) } : {}),
      record: record(sourceIndex),
    });
  return true;
}

/**
 * A cage the save never shows takes the first eligible reward, preferring
 * types the record's later rooms of the biome do not need, so the guess does
 * not spend a later recorded pick's store entry.
 */
function answerUnrecordedCage(context: RunImportContext, reward: Origin<'localReward'>): boolean {
  return guessUnrecordedCage(context, reward, true);
}

function guessUnrecordedCage(
  context: RunImportContext,
  reward: Origin<'localReward'>,
  report: boolean,
): boolean {
  const occurrence = authoredOccurrence(
    context.assembly().project,
    reward.biomeKey,
    reward.occurrenceId,
  );
  const sourceIndex = context.occurrences.roomIndexOfOccurrence(reward.occurrenceId);
  const group =
    occurrence === undefined
      ? undefined
      : context.catalog.rooms.byKey[occurrence.gameName]?.localChildren.find(
          (child) => child.kind === 'boundedRewardSlots' && child.key === 'cages',
        );
  if (
    sourceIndex === undefined ||
    group?.kind !== 'boundedRewardSlots' ||
    group.reward.kind !== 'countedChoice'
  )
    return false;
  const needed = new Set<string>();
  context.record.rooms.forEach((room, index) => {
    if (index <= sourceIndex || context.occurrences.biomeOfRoom[index] !== reward.biomeKey) return;
    for (const cage of room.fields?.cages ?? []) needed.add(cage.reward.type);
    if (room.reward?.type !== undefined) needed.add(room.reward.type);
    for (const door of room.doors) if (door.reward !== undefined) needed.add(door.reward.type);
  });
  const stores = context.catalog.rewards.stores;
  const types = [
    ...new Set(
      group.reward.storeKeys.flatMap(
        (key) => stores.byKey[key]?.entries.map((entry) => entry.rewardType) ?? [],
      ),
    ),
  ];
  const ordered = [
    ...types.filter((type) => !needed.has(type)),
    ...types.filter((type) => needed.has(type)),
  ];
  for (const type of ordered)
    for (const value of locallyValidRewardOffers(context.catalog.rewards, type)) {
      const evaluation = context.candidates().evaluate({ kind: 'localReward', reward, value });
      if (
        evaluation.kind !== 'localReward' ||
        !evaluation.result.supported ||
        evaluation.result.findings.length > 0
      )
        continue;
      const command: ProjectCommand = { kind: 'ReplaceLocalReward', reward, value };
      if (!context.applyValid(command)) continue;
      if (report)
        context.note({
          area: 'fields',
          reason: 'notInRecord',
          address: reward,
          applied: command,
          record: record(sourceIndex),
        });
      return true;
    }
  return false;
}

/**
 * Picks up each optional reward the record collected, once its slot holds a
 * reward: one picked up after combat, or one only the room's uses show.
 */
function collectOptionalRewards(
  context: RunImportContext,
  biomeKey: string,
  occurrenceId: string,
): void {
  const state = fieldsState(context, biomeKey, occurrenceId);
  const visit = state === undefined ? undefined : fieldsVisit(context, occurrenceId);
  if (state === undefined || visit === undefined) return;
  const gameName = authoredOccurrence(context.assembly().project, biomeKey, occurrenceId)!.gameName;
  const entries = optionalRewards(context, visit, optionalRewardTypes(context, gameName));
  for (const [index, entry] of entries.entries()) {
    const slotKey = `optional${index + 1}`;
    const used = `fieldsOptionalPickup:${occurrenceId}:${slotKey}`;
    if (
      entry.collected !== true ||
      context.used.has(used) ||
      state.optionalRewards[slotKey] == null
    )
      continue;
    context.used.add(used);
    if (
      !insertRoomAction(context, biomeKey, occurrenceId, {
        kind: 'interactLocalReward',
        groupKey: 'optionalRewards',
        slotKey,
      })
    )
      context.note({
        area: 'fields',
        reason: 'refused',
        address: createLocalRewardAddress(
          createBiomeAddress(context.assembly().project.route.routeKey, biomeKey),
          occurrenceId as OccurrenceId,
          'optionalRewards',
          slotKey,
        ),
        record: record(visit.roomIndex),
      });
  }
}

/**
 * Whether a Fields room's recorded Artificer waits for an untaken door's cage
 * solve: its replacement is one more draw of the window that solve reads,
 * from the same store, when a door the record gives no cages for leads to a
 * room with cages and the next entry save bounds the window.
 */
function fieldsConversionWaits(context: RunImportContext, roomIndex: number): boolean {
  const room = context.record.rooms[roomIndex];
  const next = context.record.rooms[roomIndex + 1];
  if (
    room?.fields === undefined ||
    !recordedConversions(context, roomIndex).includes('artificer') ||
    context.used.has(`conversion:${roomIndex}`) ||
    context.used.has(`fieldsConversionReleased:${roomIndex}`) ||
    recordedEntryStates(context.record)[roomIndex + 1] === undefined
  )
    return false;
  const caged = room.doors.filter(
    (door) =>
      door.cageRewards === undefined &&
      context.catalog.rooms.byKey[door.room]?.localChildren.some(
        (child) => child.kind === 'boundedRewardSlots' && child.key === 'cages',
      ),
  );
  // The entered door's cages are the next room's recorded ones.
  const entered = next?.fields !== undefined && caged.some((door) => door.room === next.name);
  return caged.length > (entered ? 1 : 0);
}

/** The reward a pickup names in the room's uses: a boon by its god. */
const useOf = (offer: ResolvedRewardOffer) =>
  offer.payload?.kind === 'BoonSource' ? offer.payload.source : offer.rewardType;

/**
 * Applies a Fields room's recorded conversions to its pickups the room's uses
 * do not show: cages in slot order, then optional rewards, those the record
 * saw leave the room first. Artificer takes `replacement` when a search pinned one.
 * False, changing nothing, until every cage and optional reward holds a
 * reached pickup, or when a pinned replacement does not place.
 */
function convertFieldsPickups(
  context: RunImportContext,
  roomIndex: number,
  {
    kinds = recordedConversions(context, roomIndex),
    replacement,
  }: {
    readonly kinds?: readonly ConversionKind[];
    readonly replacement?: ConversionReplacement;
  } = {},
): boolean {
  const room = context.record.rooms[roomIndex]!;
  const biomeKey = context.occurrences.biomeOfRoom[roomIndex]!;
  const project = context.assembly().project;
  const occurrence = authoredOccurrence(
    project,
    biomeKey,
    context.occurrences.occurrenceOf(roomIndex),
  );
  const visit =
    occurrence === undefined ? undefined : fieldsVisit(context, occurrence.occurrenceId);
  if (occurrence?.state.kind !== 'fieldsCombat' || visit === undefined) return false;
  const state = occurrence.state;
  const biome = createBiomeAddress(project.route.routeKey, biomeKey);
  const optional = optionalRewards(
    context,
    visit,
    optionalRewardTypes(context, occurrence.gameName),
  );
  const slots = (group: Readonly<Record<string, unknown>>, prefix: string) =>
    Object.keys(group).sort(
      (left, right) => Number(left.slice(prefix.length)) - Number(right.slice(prefix.length)),
    );
  const pickups = [
    ...slots(state.cages, 'cage').map((slotKey) => ({
      groupKey: 'cages',
      slotKey,
      reward: deliveredCageReward(occurrence, slotKey),
      gone: false,
    })),
    ...slots(state.optionalRewards, 'optional').map((slotKey) => ({
      groupKey: 'optionalRewards',
      slotKey,
      reward: state.optionalRewards[slotKey],
      gone: optional[Number(slotKey.slice('optional'.length)) - 1]?.collected === true,
    })),
  ].flatMap(({ groupKey, slotKey, reward, gone }) => {
    const role =
      reward === null || reward === undefined
        ? undefined
        : Object.keys(reward.dispositionByAcquisitionRole)[0];
    return reward === null || reward === undefined || role === undefined
      ? []
      : [
          {
            reward,
            gone,
            groupKey,
            acquisition: createAcquisitionRoleAddress(
              createLocalRewardAddress(biome, occurrence.occurrenceId, groupKey, slotKey),
              role,
            ),
          },
        ];
  });
  const reached = ({ acquisition }: (typeof pickups)[number]) =>
    context.candidates().evaluate({ kind: 'acquisitionConversion', acquisition }).kind ===
    'acquisitionConversion';
  // An optional reward left in the room is never reached; every other pickup is waited for.
  if (
    pickups.length !== room.fields!.cages.length + optional.length ||
    pickups.some((pickup) => (pickup.gone || pickup.groupKey === 'cages') && !reached(pickup))
  )
    return false;
  // A use names each collected pickup; the ones left over may have been converted.
  const uses = { ...room.uses };
  const uncollected = pickups
    .filter((pickup) => {
      const name = useOf(pickup.reward.offer);
      if ((uses[name] ?? 0) === 0) return true;
      uses[name] = uses[name]! - 1;
      return false;
    })
    .filter(reached)
    .sort((left, right) => Number(right.gone) - Number(left.gone));
  for (const kind of recordedConversions(context, roomIndex)) {
    const target = uncollected.find(({ acquisition }) => {
      const evaluation = context
        .candidates()
        .evaluate({ kind: 'acquisitionConversion', acquisition });
      return (
        evaluation.kind === 'acquisitionConversion' &&
        (kind === 'artificer'
          ? evaluation.result.artificerSupported
          : evaluation.result.timePieceSupported)
      );
    });
    const pinned = kind === 'artificer' ? replacement : undefined;
    if (target === undefined) {
      if (pinned !== undefined) return false;
      if (kinds.includes(kind))
        context.note({
          area: 'conversion',
          reason: 'refused',
          address: createOccurrenceAddress(biome, occurrence.occurrenceId as OccurrenceId),
          record: record(roomIndex),
        });
      continue;
    }
    uncollected.splice(uncollected.indexOf(target), 1);
    if (!kinds.includes(kind)) continue;
    if (
      !convertAcquisition(
        context,
        target.acquisition,
        kind,
        target.reward.offer.rewardType,
        roomIndex,
        pinned,
      ) &&
      pinned !== undefined
    )
      return false;
  }
  return true;
}

/**
 * A Fields room's recorded conversions act on its pickups once the room is
 * entered and its rewards placed; an Artificer an untaken door's cage solve
 * searches waits for it.
 */
export function importFieldsConversions(context: RunImportContext): void {
  for (const roomIndex of context.record.rooms.keys()) {
    const used = `conversion:${roomIndex}`;
    if (
      context.record.rooms[roomIndex]!.fields === undefined ||
      recordedConversions(context, roomIndex).length === 0 ||
      context.used.has(used) ||
      fieldsConversionWaits(context, roomIndex) ||
      !context.pending(context.occurrences.occurrenceOf(roomIndex))
    )
      continue;
    if (convertFieldsPickups(context, roomIndex)) context.used.add(used);
  }
}

/**
 * Fields optional rewards: their count and, for each, its point when the save
 * still listed it. Authored once the room is entered.
 */
export function importFieldsRooms(context: RunImportContext): void {
  const project = context.assembly().project;
  for (const biome of project.route.biomes)
    for (const occurrence of biome.topology?.occurrences ?? []) {
      collectOptionalRewards(context, biome.biomeKey, occurrence.occurrenceId);
      const used = `fieldsCount:${occurrence.occurrenceId}`;
      if (
        occurrence.state.kind !== 'fieldsCombat' ||
        context.used.has(used) ||
        !context.pending(occurrence.occurrenceId)
      )
        continue;
      const visit = fieldsVisit(context, occurrence.occurrenceId);
      if (visit === undefined) continue;
      context.used.add(used);
      const address = createOccurrenceAddress(
        createBiomeAddress(project.route.routeKey, biome.biomeKey),
        occurrence.occurrenceId,
      );
      const count = optionalRewards(
        context,
        visit,
        optionalRewardTypes(context, occurrence.gameName),
      ).length;
      if (
        count !== occurrence.state.optionalRewardCount &&
        !context.applyValid({
          kind: 'ReplaceFieldsOptionalRewardCount',
          occurrence: address,
          optionalRewardCount: count,
        })
      )
        context.note({
          area: 'fields',
          reason: 'refused',
          address: createRoomFeatureAddress(address, { kind: 'fieldsOptionalRewardCount' }),
          record: record(visit.roomIndex),
        });
      // Cages complete in opening order, which the slots' draw order need not follow.
      const slotsOfCages = recordCageOfSlots(
        context,
        biome.biomeKey,
        occurrence.occurrenceId,
        visit.fields,
      );
      if (
        visit.fields.cageOrder === 'opening' &&
        slotsOfCages.some((cage, slot) => cage !== slot) &&
        !context.applyValid({
          kind: 'ReplaceFieldsCageOrder',
          occurrence: address,
          phaseKeys: visit.fields.cages.map(
            (_cage, cage) => `Cage${String(slotsOfCages.indexOf(cage) + 1).padStart(2, '0')}`,
          ),
        })
      )
        context.note({
          area: 'fields',
          reason: 'refused',
          address,
          record: record(visit.roomIndex),
        });
      // Without every cage's opening time the cages' order is the default.
      if (visit.fields.cageOrder === 'unknown' && visit.fields.cages.length > 1)
        context.note({
          area: 'fields',
          reason: 'notInRecord',
          address,
          record: record(visit.roomIndex),
        });
    }
}

/**
 * A Fields point from the record: the entry start, a cage's point by its spawn
 * group's representative or by elimination, an optional reward's listed point
 * or else the first free one. Nemesis's point is never saved.
 */
function answerSpatialPoint(context: RunImportContext, spatial: FieldsSpatialAddress): boolean {
  const visit = fieldsVisit(context, spatial.occurrenceId);
  const occurrence = authoredOccurrence(
    context.assembly().project,
    spatial.biomeKey,
    spatial.occurrenceId,
  );
  const declaration =
    occurrence === undefined
      ? undefined
      : context.catalog.rooms.byKey[occurrence.gameName]?.fieldsSpatial;
  const state = fieldsState(context, spatial.biomeKey, spatial.occurrenceId);
  if (visit === undefined || declaration === undefined || state === undefined) return false;
  const evaluation = context
    .candidates()
    .evaluate({ kind: 'fieldsSpatialPoint', spatial, pointId: null });
  const support = evaluation.kind === 'fieldsSpatialPoint' ? evaluation.result.supportPointIds : [];
  let pointId: number | undefined;
  let assumed = false;
  const target = spatial.target;
  if (target.kind === 'entry') {
    pointId = visit.fields.entryPoint;
    if (
      pointId !== undefined &&
      !declaration.entryPairs.some((pair) => pair.startPointId === pointId)
    )
      pointId = declaration.entryPairs.find(
        (pair) => pair.endPointId === visit.fields.entryPoint,
      )?.startPointId;
  } else if (target.kind === 'cage') {
    const pointOf = (cageIndex: number) => {
      const ids = new Set(visit.fields.cages[cageIndex]?.spawnPointIds ?? []);
      return declaration.cageSpawnRepresentatives.find((entry) => ids.has(entry.spawnPointId))
        ?.cagePointId;
    };
    const index = recordCageOfSlots(context, spatial.biomeKey, spatial.occurrenceId, visit.fields)[
      cageIndexOfSlot(target.slotKey)
    ]!;
    pointId = pointOf(index);
    if (pointId === undefined) {
      // The one cage point no other cage's spawn group names.
      const named = new Set(
        visit.fields.cages.flatMap((_cage, other) => {
          const point = other === index ? undefined : pointOf(other);
          return point === undefined ? [] : [point];
        }),
      );
      const unmatched = visit.fields.cages.filter((_cage, other) => pointOf(other) === undefined);
      const left = declaration.cagePointIds.filter(
        (point) =>
          !named.has(point) &&
          !declaration.cageSpawnRepresentatives.some((entry) => entry.cagePointId === point),
      );
      if (unmatched.length === 1 && left.length === 1) pointId = left[0];
    }
  } else if (target.kind === 'optional') {
    const entries = optionalRewards(
      context,
      visit,
      optionalRewardTypes(context, occurrence!.gameName),
    );
    const entry = entries[Number(/^optional(\d+)$/.exec(target.slotKey)?.[1]) - 1];
    pointId = entry?.point;
    if (entry !== undefined && pointId === undefined) {
      // A reward collected in combat has no saved point: the first free optional point.
      const taken = new Set([
        ...entries.flatMap((other) => (other.point === undefined ? [] : [other.point])),
        ...Object.values(state.spatial.optionalPointIdBySlot).flatMap((point) =>
          point === null ? [] : [point],
        ),
      ]);
      pointId = support.find((point) => !taken.has(point));
      assumed = true;
    }
  }
  if (pointId === undefined) return false;
  const command: ProjectCommand = { kind: 'ReplaceFieldsSpatialPoint', spatial, pointId };
  if (!context.applyValid(command)) {
    context.refuse();
    return false;
  }
  if (assumed)
    context.note({
      area: 'fields',
      reason: 'assumption',
      address: spatial,
      applied: command,
      record: record(visit.roomIndex),
    });
  return true;
}

/** The Fields occurrence a phase belongs to, for the encounter importer. */
export function recordedCageEncounter(
  context: RunImportContext,
  occurrenceId: OccurrenceId | string,
  phaseKey: string,
) {
  const visit = fieldsVisit(context, occurrenceId);
  const cage =
    visit === undefined
      ? undefined
      : visit.fields.cages[
          recordCageOfSlots(
            context,
            context.occurrences.biomeOfRoom[visit.roomIndex]!,
            occurrenceId,
            visit.fields,
          )[cageIndexOfPhase(phaseKey)]!
        ];
  return visit === undefined || cage === undefined
    ? undefined
    : { encounter: cage.encounter, roomIndex: visit.roomIndex };
}
