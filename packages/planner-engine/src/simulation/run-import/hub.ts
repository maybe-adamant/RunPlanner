import {
  createBiomeAddress,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createHubSlotAddress,
  createLocalVisitOrderAddress,
  createLocalVisitSlotAddress,
  createOccurrenceId,
  hubTerminalTakeoverForSource,
  type HubAction,
  type HubDecision,
  type OccurrenceId,
  type SemanticAddress,
  type TargetAddress,
} from '../../authored-project';
import type { SemanticFinding } from '../model';
import type { RunImportContext } from './import';

type Origin<K extends SemanticAddress['kind']> = Extract<SemanticAddress, { readonly kind: K }>;

/** Answers the Hub board, its visit order and its side rooms from the record. */
export function answerHub(context: RunImportContext, reason: SemanticFinding): boolean {
  const origin = reason.origin;
  switch (reason.code) {
    case 'targetMissing':
      return origin.kind === 'target' && enterHub(context, origin);
    case 'hubOpenSetIncomplete':
      return origin.kind === 'hubOpenSet' && openHubSlot(context, origin);
    case 'hubVisitOrderIncomplete':
      return (
        (origin.kind === 'hubVisit' || origin.kind === 'hubFountain') && visitOrder(context, origin)
      );
    case 'sideRoomGenerationUnavailable':
      return origin.kind === 'localVisitSlot' && sideRoomGeneration(context, origin, reason);
    default:
      return false;
  }
}

function hubLayout(context: RunImportContext, biomeKey: string) {
  const progression = context.catalog.biomeLayouts.byKey[biomeKey]?.progression;
  return progression?.kind === 'hub' ? progression : undefined;
}

/** Record rooms of the biome, in order, by index. */
function biomeRooms(context: RunImportContext, biomeKey: string): readonly number[] {
  return context.occurrences.biomeOfRoom.flatMap((key, index) => (key === biomeKey ? [index] : []));
}

function hubDecision(context: RunImportContext, biomeKey: string, hubKey: string) {
  return context
    .assembly()
    .project.route.biomes.find((biome) => biome.biomeKey === biomeKey)
    ?.topology?.decisions.find(
      (candidate): candidate is HubDecision =>
        candidate.kind === 'hub' && candidate.hubKey === hubKey,
    );
}

/** The bounded entry's only target is the Hub, entered when the record's next room is its board. */
function enterHub(context: RunImportContext, target: TargetAddress): boolean {
  const project = context.assembly().project;
  const layout = context.catalog.biomeLayouts.byKey[target.biomeKey];
  const topology = project.route.biomes.find(
    (biome) => biome.biomeKey === target.biomeKey,
  )?.topology;
  const hub = hubLayout(context, target.biomeKey);
  if (layout === undefined || hub === undefined || topology === undefined || topology === null)
    return false;
  const terminal = hubTerminalTakeoverForSource(context.catalog, layout, topology, target.source);
  if (terminal === undefined) return false;
  const preboss = biomeRooms(context, target.biomeKey).find(
    (index) => context.record.rooms[index]!.name === hub.completedExit.roomGameName,
  );
  const prebossOccurrenceId =
    preboss === undefined
      ? createOccurrenceId(`${target.biomeKey}-preboss`)
      : context.occurrences.occurrenceOf(preboss);
  const decision = createExitDecisionAddress(
    createBiomeAddress(target.routeKey, target.biomeKey),
    target.source,
  );
  const address = createHubDecisionAddress(
    createBiomeAddress(target.routeKey, target.biomeKey),
    terminal.hubKey,
  );
  return (
    context.apply({
      kind: 'InitializeExitDecision',
      decision,
      edit: { kind: 'hub', hub: address, prebossOccurrenceId },
    }) ||
    context.apply({ kind: 'ReplaceWithHubDecision', decision, hub: address, prebossOccurrenceId })
  );
}

/** The occurrence of a board room: its entered visit, else the offer on the board visit. */
function slotOccurrence(
  context: RunImportContext,
  biomeKey: string,
  roomGameName: string,
  boardIndex: number,
  doorId: number,
): { readonly occurrenceId: OccurrenceId; readonly roomIndex: number | undefined } {
  const entered = biomeRooms(context, biomeKey).find(
    (index) => context.record.rooms[index]!.name === roomGameName,
  );
  return entered === undefined
    ? {
        occurrenceId: context.occurrences.offeredOccurrence(boardIndex, doorId),
        roomIndex: undefined,
      }
    : { occurrenceId: context.occurrences.occurrenceOf(entered), roomIndex: entered };
}

/** Opens every board door the record's first board visit offered, by its physical door id. */
function openHubSlot(context: RunImportContext, openSet: Origin<'hubOpenSet'>): boolean {
  const hub = hubLayout(context, openSet.biomeKey);
  if (hub === undefined) return false;
  const boardIndex = biomeRooms(context, openSet.biomeKey).find(
    (index) => context.record.rooms[index]!.name === hub.restoreRoomGameName,
  );
  if (boardIndex === undefined) return false;
  const open = new Set(
    hubDecision(context, openSet.biomeKey, openSet.hubKey)?.openTargets.map(
      (target) => target.hubSlotKey,
    ) ?? [],
  );
  const biome = createBiomeAddress(openSet.routeKey, openSet.biomeKey);
  // Every recorded door opens at once: the open-set question stops at its minimum.
  let opened = false;
  for (const door of context.record.rooms[boardIndex]!.doors) {
    const slot = hub.slots.find((candidate) => candidate.physicalDoorId === door.door);
    if (slot === undefined) {
      context.note({
        area: 'hub',
        reason: 'refused',
        address: openSet,
        record: { roomIndex: boardIndex, visit: 0, door: door.door },
      });
      continue;
    }
    if (open.has(slot.slotKey)) continue;
    const { occurrenceId, roomIndex } = slotOccurrence(
      context,
      openSet.biomeKey,
      slot.roomGameName,
      boardIndex,
      door.door,
    );
    const room = context.catalog.rooms.byKey[slot.roomGameName];
    const localOccurrenceIdsBySlot = Object.fromEntries(
      (room?.localChildren ?? []).flatMap((child) =>
        child.kind === 'fixedRoomSlots'
          ? child.slots.map((local) => {
              const side = biomeRooms(context, openSet.biomeKey).find(
                (index) =>
                  roomIndex !== undefined &&
                  index > roomIndex &&
                  context.record.rooms[index]!.name === local.roomGameName,
              );
              return [
                local.slotKey,
                side === undefined
                  ? createOccurrenceId(`${occurrenceId}-${local.slotKey}`)
                  : context.occurrences.occurrenceOf(side),
              ] as const;
            })
          : [],
      ),
    );
    if (
      context.apply({
        kind: 'OpenHubSlot',
        slot: createHubSlotAddress(biome, openSet.hubKey, slot.slotKey),
        occurrenceId,
        localOccurrenceIdsBySlot,
      })
    )
      opened = true;
    else context.refuse();
  }
  return opened;
}

/**
 * The record's board visits in order: each first entry of an open board room,
 * with the fountain used on the board visit that recorded it.
 */
function recordedActions(context: RunImportContext, biomeKey: string, hubKey: string): HubAction[] {
  const hub = hubLayout(context, biomeKey);
  const decision = hubDecision(context, biomeKey, hubKey);
  if (hub === undefined || decision === undefined) return [];
  const actions: HubAction[] = [];
  const visited = new Set<string>();
  for (const index of biomeRooms(context, biomeKey)) {
    const room = context.record.rooms[index]!;
    if (room.name === hub.restoreRoomGameName) {
      if (Object.keys(room.uses).some((key) => /Fountain/.test(key)))
        actions.push({ kind: 'useFountain' });
      continue;
    }
    const slot = hub.slots.find((candidate) => candidate.roomGameName === room.name);
    if (slot === undefined) continue;
    const fromBoard = context.record.rooms[index - 1]?.name === hub.restoreRoomGameName;
    const open = decision.openTargets.some((target) => target.hubSlotKey === slot.slotKey);
    if (visited.has(slot.slotKey) || !open) {
      // A return from a side room restores its main room natively; a board door
      // taken twice, or one the board did not open, has no visit to author.
      const used = `hubVisit:${index}`;
      if (fromBoard && !context.used.has(used)) {
        context.used.add(used);
        context.note({
          area: 'hub',
          reason: 'refused',
          address: createHubDecisionAddress(
            createBiomeAddress(context.assembly().project.route.routeKey, biomeKey),
            hubKey,
          ),
          record: { roomIndex: index, visit: 0 },
        });
      }
      continue;
    }
    visited.add(slot.slotKey);
    actions.push({ kind: 'roomVisit', hubSlotKey: slot.slotKey });
  }
  return actions;
}

function visitOrder(
  context: RunImportContext,
  visit: Origin<'hubVisit'> | Origin<'hubFountain'>,
): boolean {
  const actions = recordedActions(context, visit.biomeKey, visit.hubKey);
  const hub = createHubDecisionAddress(
    createBiomeAddress(visit.routeKey, visit.biomeKey),
    visit.hubKey,
  );
  const current = hubDecision(context, visit.biomeKey, visit.hubKey)?.actions.length ?? 0;
  // The longest recorded prefix the engine admits, so a later refusal keeps earlier visits.
  for (let length = actions.length; length > current; length--) {
    const prefix = actions.slice(0, length);
    const evaluation = context
      .candidates()
      .evaluate({ kind: 'hubActionOrder', hub, actions: prefix });
    if (evaluation.kind === 'hubActionOrder' && !evaluation.result.selectedPossible) continue;
    if (context.apply({ kind: 'ReplaceHubActionOrder', hub, actions: prefix })) return true;
  }
  if (actions.length > current) context.refuse();
  return false;
}

/** Whether the main room's recorded visits offered a side slot's door; undefined when unknown. */
function recordedGeneration(
  context: RunImportContext,
  biomeKey: string,
  sourceOccurrenceId: string,
  slotKey: string,
): 'generated' | 'notGenerated' | undefined {
  const room =
    context.catalog.rooms.byKey[
      context
        .assembly()
        .project.route.biomes.find((biome) => biome.biomeKey === biomeKey)
        ?.topology?.occurrences.find((entry) => entry.occurrenceId === sourceOccurrenceId)
        ?.gameName ?? ''
    ];
  const local = room?.localChildren
    .flatMap((child) => (child.kind === 'fixedRoomSlots' ? child.slots : []))
    .find((candidate) => candidate.slotKey === slotKey);
  const visits = context.occurrences.visitsOf(sourceOccurrenceId);
  if (local === undefined || visits.length === 0) return undefined;
  return visits.some((index) =>
    context.record.rooms[index]!.doors.some((door) => door.door === local.physicalDoorId),
  )
    ? 'generated'
    : 'notGenerated';
}

/** A side room was generated when its main room's visit offered its door. */
function sideRoomGeneration(
  context: RunImportContext,
  slot: Origin<'localVisitSlot'>,
  reason: SemanticFinding,
): boolean {
  const generation = recordedGeneration(
    context,
    slot.biomeKey,
    slot.sourceOccurrenceId,
    slot.slotKey,
  );
  if (generation === undefined) return false;
  const supported = reason.evidence['supportOutcomes'];
  if (Array.isArray(supported) && !supported.includes(generation)) {
    context.refuse();
    return false;
  }
  if (context.apply({ kind: 'SetLocalVisitGeneration', slot, generation })) return true;
  context.refuse();
  return false;
}

/**
 * Side rooms entered from a main room, in record order. Their visit order is
 * optional authorship the route never asks for, so it is set once its side
 * rooms exist.
 */
export function importSideRoomVisits(context: RunImportContext): void {
  const project = context.assembly().project;
  for (const biome of project.route.biomes) {
    for (const decision of biome.topology?.decisions ?? []) {
      if (decision.kind !== 'localVisit') continue;
      // A side room the record entered was generated, though the route never asks.
      for (const [slotKey, target] of Object.entries(decision.targetsBySlot)) {
        const used = `sideGeneration:${decision.sourceOccurrenceId}:${slotKey}`;
        if (
          target.generation === 'generated' ||
          context.used.has(used) ||
          context.occurrences.visitsOf(target.occurrenceId).length === 0 ||
          recordedGeneration(context, biome.biomeKey, decision.sourceOccurrenceId, slotKey) !==
            'generated'
        )
          continue;
        context.used.add(used);
        const slot = createLocalVisitSlotAddress(
          createBiomeAddress(project.route.routeKey, biome.biomeKey),
          decision.sourceOccurrenceId,
          decision.groupKey,
          slotKey,
        );
        if (!context.apply({ kind: 'SetLocalVisitGeneration', slot, generation: 'generated' }))
          context.note({
            area: 'hub',
            reason: 'refused',
            address: slot,
            record: { roomIndex: context.occurrences.visitsOf(target.occurrenceId)[0]!, visit: 0 },
          });
      }
      const current = context
        .assembly()
        .project.route.biomes.find((entry) => entry.biomeKey === biome.biomeKey)
        ?.topology?.decisions.find(
          (entry) =>
            entry.kind === 'localVisit' &&
            entry.sourceOccurrenceId === decision.sourceOccurrenceId &&
            entry.groupKey === decision.groupKey,
        );
      if (current?.kind !== 'localVisit') continue;
      const entered = Object.values(current.targetsBySlot)
        .map((target) => target.occurrenceId)
        .filter((occurrenceId) => context.occurrences.visitsOf(occurrenceId).length > 0)
        .sort(
          (left, right) =>
            context.occurrences.visitsOf(left)[0]! - context.occurrences.visitsOf(right)[0]!,
        );
      if (
        entered.length === current.visitOrder.length &&
        entered.every((occurrenceId, index) => current.visitOrder[index] === occurrenceId)
      )
        continue;
      const used = `sideVisits:${decision.sourceOccurrenceId}:${entered.join(',')}`;
      if (context.used.has(used)) continue;
      context.used.add(used);
      const order = createLocalVisitOrderAddress(
        createBiomeAddress(project.route.routeKey, biome.biomeKey),
        decision.sourceOccurrenceId,
        decision.groupKey,
      );
      if (!context.apply({ kind: 'ReplaceLocalVisitOrder', order, occurrenceIds: entered }))
        context.note({
          area: 'hub',
          reason: 'refused',
          address: order,
          record: { roomIndex: context.occurrences.visitsOf(entered[0]!)[0]!, visit: 0 },
        });
    }
  }
}
