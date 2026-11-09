import { semanticAddressKey, type OccurrenceAddress } from '../../authored-project/addresses';
import {
  roomActionResetApplies,
  roomActionResetPlan,
} from '../../authored-project/commands/room-action-reset';
import type { ProjectCommand } from '../../authored-project/commands/types';
import type { Catalog } from '../../catalog-schema';
import { candidateBiome, candidateBiomeRooms } from '../candidates/evaluated-biome';
import type { ProjectEvaluationAssembly } from './evaluation-products';

type ResetCommand = Extract<ProjectCommand, { readonly kind: 'ResetRoomActionsAfter' }>;

/**
 * Reset from here for each entry of a room's lifecycle Timeline, aligned with
 * `roomLifecycleTimeline.entries`: the command that removes the room's actions
 * after that entry, or undefined when it would change nothing. An
 * action keeps itself; a banner (an event the walk announces) keeps the ranked
 * actions before it. An automatic effect has none. Undefined for a room the
 * evaluated biome does not hold.
 */
export function roomActionResetsForProjectEvaluationAssembly(
  catalog: Catalog,
  assembly: ProjectEvaluationAssembly,
  occurrence: OccurrenceAddress,
): readonly (ResetCommand | undefined)[] | undefined {
  const biome = candidateBiome(assembly.evaluation, occurrence.routeKey, occurrence.biomeKey);
  if (biome === undefined) return undefined;
  const key = semanticAddressKey(occurrence);
  const room = candidateBiomeRooms(biome).find(
    (candidate) => semanticAddressKey(candidate.origin) === key,
  );
  if (room === undefined) return undefined;
  const ranked = room.roomActionRoster.rows
    .filter((row) => row.rank !== null && !row.stale)
    .sort((left, right) => left.rank! - right.rank!);
  const reset = (afterActionKey: string | null): ResetCommand | undefined =>
    roomActionResetApplies(
      roomActionResetPlan(assembly.project, catalog, occurrence, afterActionKey),
    )
      ? Object.freeze({ kind: 'ResetRoomActionsAfter' as const, occurrence, afterActionKey })
      : undefined;
  return Object.freeze(
    room.roomLifecycleTimeline.entries.map((entry) => {
      switch (entry.kind) {
        case 'action':
          return reset(entry.action.key);
        case 'boundary': {
          // The banner's seam follows the ranked actions up to its slot.
          const slot = entry.placement === 'before' ? entry.rank - 1 : entry.rank;
          return reset(ranked.filter((row) => row.rank! <= slot).at(-1)?.key ?? null);
        }
        case 'automaticEffect':
          return undefined;
      }
    }),
  );
}
