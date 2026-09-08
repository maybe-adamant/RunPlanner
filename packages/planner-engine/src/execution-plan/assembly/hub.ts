import { semanticAddressKey } from '../../authored-project/addresses';
import type {
  CanonicalBatch,
  CanonicalHubDecision,
  CanonicalLocalVisitRoom,
} from '../../simulation/materialization';
import type { ExecutionOverview } from '../model';
import { ExecutionCompilerError as CompilerError } from '../assembler-errors';
import { executionReward } from './overview';

function reference(room: {
  readonly occurrenceId: string;
  readonly origin: { readonly biomeKey: string };
  readonly gameName: string;
}) {
  return Object.freeze({
    id: room.occurrenceId,
    biomeKey: room.origin.biomeKey,
    gameName: room.gameName,
  });
}

export function hubOverview(
  hub: CanonicalHubDecision | undefined,
  hubExit: CanonicalBatch | undefined,
): ExecutionOverview['hub'] | undefined {
  if (hub === undefined) return undefined;
  const final = hubExit?.targets[0]?.room;
  if (hubExit?.targets.length !== 1 || final === undefined)
    throw new CompilerError(
      'executionCoverageMissing',
      `${hub.room.gameName} lacks its final handoff`,
    );
  return Object.freeze({
    room: Object.freeze({ gameName: hub.room.gameName }),
    slots: Object.freeze(
      hub.board.targets.map((target) => {
        const reward = executionReward(target.room);
        if (reward === undefined)
          throw new CompilerError(
            'executionCoverageMissing',
            `${target.room.gameName} Hub target lacks reward`,
          );
        return Object.freeze({
          slotKey: target.hubSlotKey,
          physicalDoorId: target.physicalDoorId,
          room: reference(target.room),
          reward,
        });
      }),
    ),
    finalHandoff: reference(final),
  });
}

export function localSlotsOverview(
  localSlots: readonly CanonicalLocalVisitRoom[] | undefined,
): ExecutionOverview['localSlots'] | undefined {
  if (localSlots === undefined) return undefined;
  return Object.freeze(
    localSlots.map((slot) => {
      const generated = slot.localVisit.generation === 'generated';
      const reward = generated ? executionReward(slot) : undefined;
      if (generated && reward === undefined)
        throw new CompilerError(
          'executionCoverageMissing',
          `${slot.gameName} side room lacks reward`,
        );
      return Object.freeze({
        slotKey: slot.localVisit.slotKey,
        physicalDoorId: slot.localVisit.physicalDoorId,
        generation: slot.localVisit.generation,
        ...(generated ? { room: reference(slot), reward: reward! } : {}),
      });
    }),
  );
}

export function hubBySource(
  hubs: readonly CanonicalHubDecision[],
): ReadonlyMap<string, CanonicalHubDecision> {
  return new Map(hubs.map((hub) => [semanticAddressKey(hub.source.origin), hub] as const));
}

export function hubExitByRoom(
  hubs: readonly CanonicalHubDecision[],
  batches: readonly CanonicalBatch[],
): ReadonlyMap<string, CanonicalBatch> {
  const result = new Map<string, CanonicalBatch>();
  for (const hub of hubs) {
    const batch = batches.find(
      (candidate) =>
        semanticAddressKey(candidate.parent.origin) === semanticAddressKey(hub.room.origin),
    );
    if (batch !== undefined) result.set(semanticAddressKey(hub.source.origin), batch);
  }
  return result;
}
