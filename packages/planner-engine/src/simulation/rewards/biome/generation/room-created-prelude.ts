import type { Catalog } from '../../../../catalog-schema';
import {
  createPostbossKeepsakeSelectionAddress,
  semanticAddressKey,
} from '../../../../authored-project/addresses';
import type { HistoryEvent, HistoryStateView } from '../../../history';
import type { CanonicalAuthoredRoom, CanonicalHubRoom } from '../../../materialization';
import type { KeepsakeSelectionCandidateCapability } from '../../../candidate-artifacts';
import type { RewardBranchState } from '../../branch-primitives';
import type { RunStateOwner } from '../../run-state';

type CanonicalRewardSource = CanonicalAuthoredRoom | CanonicalHubRoom;

export interface RoomCreatedPrelude {
  readonly keepsakeSelectionCandidate?: {
    readonly key: string;
    readonly candidate: KeepsakeSelectionCandidateCapability;
  };
  readonly hubRunStateCheckpoint?: {
    readonly owner: RunStateOwner;
    readonly source: CanonicalRewardSource;
    readonly view: HistoryStateView;
  };
}

/**
 * Emits room-creation products that precede reward generation. The chronology
 * coordinator records the candidate and Run State snapshot at this event's
 * existing sequence point.
 */
export function prepareRoomCreatedPrelude(
  catalog: Catalog,
  event: Extract<HistoryEvent, { readonly kind: 'roomCreated' }>,
  rooms: ReadonlyMap<string, CanonicalRewardSource>,
  views: ReadonlyMap<
    string,
    {
      readonly entry?: HistoryStateView;
      readonly targetGenerations: readonly {
        readonly targetOrigin: import('../../../../authored-project/addresses').SemanticAddress;
        readonly before: HistoryStateView;
      }[];
    }
  >,
  batchesByParent: ReadonlyMap<
    string,
    {
      readonly origin: RunStateOwner;
      readonly targets: readonly {
        readonly origin: import('../../../../authored-project/addresses').SemanticAddress;
      }[];
    }
  >,
  branches: readonly RewardBranchState[],
): RoomCreatedPrelude {
  const room = rooms.get(semanticAddressKey(event.origin));
  const keepsakeSelectionCandidate =
    room?.kind === 'authored' &&
    catalog.rooms.byKey[room.gameName]?.hasKeepsakeRack === true &&
    event.origin.kind === 'occurrence'
      ? (() => {
          const selection = createPostbossKeepsakeSelectionAddress(event.origin);
          const historyAtRack = views.get(semanticAddressKey(event.origin))?.entry;
          const branch = branches[0];
          if (branch === undefined) return undefined;
          return Object.freeze({
            key: semanticAddressKey(selection),
            candidate: Object.freeze({
              state: branch.keepsakes,
              encounterBlockedKeepsakeKeys: Object.freeze([
                ...new Set(
                  historyAtRack?.ledgers.encounterRecords.flatMap(
                    (encounter) =>
                      catalog.encounterDefinitions.byKey[encounter.encounterKey]
                        ?.blocksKeepsakeSelectionKeys ?? [],
                  ) ?? [],
                ),
              ]),
            }),
          });
        })()
      : undefined;

  const hubRunStateCheckpoint =
    event.source === 'generatedTarget' && event.parentOrigin.kind === 'hubRoom'
      ? (() => {
          const handoff = batchesByParent.get(semanticAddressKey(event.parentOrigin));
          const parent = rooms.get(semanticAddressKey(event.parentOrigin));
          const handoffView = views
            .get(semanticAddressKey(event.parentOrigin))
            ?.targetGenerations.find(
              (candidate) =>
                semanticAddressKey(candidate.targetOrigin) ===
                semanticAddressKey(event.targetOrigin),
            )?.before;
          const handoffTarget = handoff?.targets.find(
            (target) =>
              semanticAddressKey(target.origin) === semanticAddressKey(event.targetOrigin),
          );
          return handoffTarget !== undefined &&
            handoff?.origin.kind === 'exitDecision' &&
            handoff.origin.source.kind === 'hubDecision' &&
            parent?.kind === 'hub' &&
            handoffView !== undefined
            ? Object.freeze({ owner: handoff.origin, source: parent, view: handoffView })
            : undefined;
        })()
      : undefined;

  return Object.freeze({
    ...(keepsakeSelectionCandidate === undefined ? {} : { keepsakeSelectionCandidate }),
    ...(hubRunStateCheckpoint === undefined ? {} : { hubRunStateCheckpoint }),
  });
}
