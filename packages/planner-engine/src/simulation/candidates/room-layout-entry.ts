import {
  createRoomFeatureAddress,
  semanticAddressKey,
  type OccurrenceAddress,
} from '../../authored-project/addresses';
import type { ProjectCommand } from '../../authored-project/commands/types';
import type { ProjectDocument } from '../../authored-project/model';
import { layoutWithEntry, roomEntryOptions } from '../room-layout/choices';
import { roomHeroStartIds } from '../../authored-project/room-layout';
import type { Catalog } from '../../catalog-schema';
import type { ProjectEvaluation } from '../evaluation/evaluation-products';
import type { RoomLayoutSettlement } from '../room-layout/settlement';
import type { CandidateContextUnavailable } from './availability';
import { unreachableTarget } from './availability';

/** One entry point for a reached room, or null to leave the entry to the game. */
export interface RoomLayoutEntryCandidateQuery {
  readonly kind: 'roomLayoutEntry';
  readonly occurrence: OccurrenceAddress;
  readonly entryStartPointId: number | null;
}

export interface RoomLayoutEntryCandidateSupport {
  readonly occurrence: OccurrenceAddress;
  readonly entryStartPointId: number | null;
  /** One of the room's `HeroStart`s; an ineligible one stays assignable for explicit repair. */
  readonly assignable: boolean;
  /** The game can enter the room here, as its settled layout derives. */
  readonly selectedPossible: boolean;
  readonly eligibleStartPointIds: readonly number[];
  /** The whole layout this choice authors: an entry that needs one flip sets it too. */
  readonly command: Extract<ProjectCommand, { readonly kind: 'ReplaceRoomLayout' }>;
}

export interface EvaluatedRoomLayoutEntryCandidate {
  readonly kind: 'roomLayoutEntry';
  readonly result: RoomLayoutEntryCandidateSupport;
}

function settlementFor(
  evaluation: ProjectEvaluation,
  occurrence: OccurrenceAddress,
): RoomLayoutSettlement | undefined {
  if (evaluation.route.routeKey !== occurrence.routeKey) return undefined;
  const biome = evaluation.route.biomes.find(
    (candidate) => candidate.biomeKey === occurrence.biomeKey,
  );
  if (biome === undefined || !('rewards' in biome)) return undefined;
  const key = semanticAddressKey(occurrence);
  return biome.rewards.roomLayouts.find(
    (settlement) => semanticAddressKey(settlement.owner) === key,
  );
}

export function evaluateRoomLayoutEntryCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  query: RoomLayoutEntryCandidateQuery,
): CandidateContextUnavailable | EvaluatedRoomLayoutEntryCandidate {
  const owner = createRoomFeatureAddress(query.occurrence, { kind: 'roomLayoutEntry' });
  const settlement = settlementFor(evaluation, query.occurrence);
  const occurrence = project.route.biomes
    .find((plan) => plan.biomeKey === query.occurrence.biomeKey)
    ?.topology?.occurrences.find((entry) => entry.occurrenceId === query.occurrence.occurrenceId);
  const room = occurrence === undefined ? undefined : catalog.rooms.byKey[occurrence.gameName];
  if (settlement === undefined || occurrence === undefined || room === undefined)
    return unreachableTarget(owner);
  const authoredFlip = settlement.flip.kind === 'roll' ? occurrence.layout?.flipped : undefined;
  const options = roomEntryOptions(settlement);
  const open = options.filter(
    (option) =>
      option.flipped === undefined || authoredFlip === undefined || option.flipped === authoredFlip,
  );
  const layout = layoutWithEntry(settlement, occurrence.layout, query.entryStartPointId);
  return Object.freeze({
    kind: 'roomLayoutEntry',
    result: Object.freeze({
      occurrence: query.occurrence,
      entryStartPointId: query.entryStartPointId,
      assignable:
        query.entryStartPointId === null ||
        roomHeroStartIds(room).includes(query.entryStartPointId),
      selectedPossible:
        query.entryStartPointId === null ||
        options.some((option) => option.startPointId === query.entryStartPointId),
      eligibleStartPointIds: Object.freeze(open.map((option) => option.startPointId)),
      command: Object.freeze({
        kind: 'ReplaceRoomLayout' as const,
        occurrence: query.occurrence,
        layout,
      }),
    }),
  });
}

/** Whether the room's entry is reached, so its layout is settled. */
export function roomLayoutEntryContextReached(
  evaluation: ProjectEvaluation,
  occurrence: OccurrenceAddress,
): boolean {
  return settlementFor(evaluation, occurrence) !== undefined;
}
