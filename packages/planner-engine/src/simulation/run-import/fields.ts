import {
  createBiomeAddress,
  createOccurrenceAddress,
  createRoomFeatureAddress,
  type FieldsCombatState,
  type FieldsSpatialAddress,
  type OccurrenceId,
  type ProjectCommand,
  type SemanticAddress,
} from '../../authored-project';
import {
  exitDecisionForSource,
  normalDecisionProgressionForLayout,
} from '../../authored-project/topology/query';
import { locallyValidRewardOffers, type ResolvedRewardOffer } from '../../reward-kernel';
import type { RunRecordFields, RunRecordRoom } from '../../run-record/model';
import type { SemanticFinding } from '../model';
import type { RunImportContext } from './import';
import { authoredOccurrence } from './occurrences';
import { recordedOffer } from './vocabulary';

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

/** The record's optional rewards: those still listed with their point, then those collected before listing. */
function optionalRewards(
  context: RunImportContext,
  visit: NonNullable<ReturnType<typeof fieldsVisit>>,
  rewardTypes: ReadonlySet<string>,
): readonly { readonly reward: string; readonly point?: number }[] {
  const listed = visit.fields.optionalRewards.map((entry) => ({
    reward: entry.reward,
    point: entry.point,
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
    return Array.from({ length: Math.max(0, extra) }, () => ({ reward: name }));
  });
  return [...listed, ...unlisted];
}

/** The reward types an optional slot of this room admits: its stores' entries. */
function optionalRewardTypes(context: RunImportContext, gameName: string): ReadonlySet<string> {
  const group = context.catalog.rooms.byKey[gameName]?.localChildren.find(
    (child) => child.kind === 'boundedRewardSlots' && child.key === 'optionalRewards',
  );
  if (group?.kind !== 'boundedRewardSlots' || group.reward.kind !== 'countedChoice')
    return new Set();
  const stores = context.catalog.rewards.stores;
  return new Set([
    ...group.reward.allowedRewardTypes,
    ...group.reward.storeKeys.flatMap(
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
  // Without an entered Fields room, a door never taken shows the count its cages rolled.
  const untaken = visits
    .flatMap((index) => context.record.rooms[index]!.doors)
    .find((door) => door.cageRewards !== undefined);
  const count = next?.fields?.cages.length ?? untaken?.cageRewards?.length;
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
    if (!supported.includes(cageOutcome)) continue;
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
  if (visit === undefined)
    return (
      reward.groupKey === 'cages' &&
      (answerUntakenCages(context, reward) || answerUnrecordedCage(context, reward))
    );
  let offers: readonly ResolvedRewardOffer[];
  if (reward.groupKey === 'cages') {
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

/**
 * An untaken door's cages take the reward types the stores lost for them, in
 * the first slot order the engine admits; a boon takes the first eligible god.
 * The roll order and the gods are not saved.
 */
function answerUntakenCages(context: RunImportContext, reward: Origin<'localReward'>): boolean {
  const recorded = untakenCageRewards(context, reward.occurrenceId);
  const state = fieldsState(context, reward.biomeKey, reward.occurrenceId);
  if (recorded === undefined || state === undefined) return false;
  const slots = Object.keys(state.cages).filter(
    (slot) => cageIndexOfSlot(slot) < recorded.rewards.length,
  );
  if (slots.length !== recorded.rewards.length) return false;
  const orders = permutations(recorded.rewards).filter(
    (order, index, all) => all.findIndex((other) => other.join() === order.join()) === index,
  );
  for (const order of orders) {
    let boons = 0;
    const applied = context.transaction(() =>
      slots.every((slotKey) => {
        const type = order[cageIndexOfSlot(slotKey)]!;
        const target = { ...reward, slotKey };
        return locallyValidRewardOffers(context.catalog.rewards, type).some((value) => {
          const evaluation = context
            .candidates()
            .evaluate({ kind: 'localReward', reward: target, value });
          if (
            evaluation.kind !== 'localReward' ||
            !evaluation.result.supported ||
            evaluation.result.findings.length > 0 ||
            !context.apply({ kind: 'ReplaceLocalReward', reward: target, value })
          )
            return false;
          if (value.payload?.kind === 'BoonSource') boons += 1;
          return true;
        });
      }),
    );
    if (!applied) continue;
    if (orders.length > 1 || boons > 0)
      context.note({
        area: 'fields',
        reason: 'assumption',
        address: reward,
        record: record(recorded.roomIndex),
      });
    return true;
  }
  context.refuse();
  return false;
}

/**
 * A cage the save never shows takes the first eligible reward, preferring
 * types the record's later rooms of the biome do not need, so the guess does
 * not spend a later recorded pick's store entry.
 */
function answerUnrecordedCage(context: RunImportContext, reward: Origin<'localReward'>): boolean {
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
 * Fields optional rewards: their count and, for each, its point when the save
 * still listed it. Authored once the room is entered.
 */
export function importFieldsRooms(context: RunImportContext): void {
  const project = context.assembly().project;
  for (const biome of project.route.biomes)
    for (const occurrence of biome.topology?.occurrences ?? []) {
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
    const index = cageIndexOfSlot(target.slotKey);
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
  const cage = visit?.fields.cages[cageIndexOfPhase(phaseKey)];
  return visit === undefined || cage === undefined
    ? undefined
    : { encounter: cage.encounter, roomIndex: visit.roomIndex };
}
