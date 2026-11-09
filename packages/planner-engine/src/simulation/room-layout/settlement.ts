import {
  createRoomFeatureAddress,
  type OccurrenceAddress,
  type RoomAnchorObjectKind,
} from '../../authored-project/addresses';
import type { Catalog } from '../../catalog-schema';
import type { CanonicalAuthoredRoom } from '../materialization';
import type { FindingEvidence, SemanticFinding } from '../model';
import type { RoomLayoutDerivation } from './derivation';
import { ROOM_ANCHOR_OBJECT_ORDER } from './object-anchor-positions';

/** One entered room's layout as the walk settled it at its entry. */
export interface RoomLayoutSettlement extends RoomLayoutDerivation {
  readonly owner: OccurrenceAddress;
  readonly historySequence: number;
}

function finding(
  code:
    | 'roomLayoutEntryUnavailable'
    | 'roomLayoutFlipUnavailable'
    | 'roomObjectAnchorUnavailable'
    | 'roomObjectAnchorDuplicate',
  origin: SemanticFinding['origin'],
  evidence: FindingEvidence,
): SemanticFinding {
  return Object.freeze({
    code,
    phase: 'roomGeneration',
    origin,
    evidence: Object.freeze(evidence),
  });
}

/** The authored flip or entry the settled layout cannot hold, kept for repair. */
export function roomLayoutFindings(
  settlement: RoomLayoutSettlement,
  authored: CanonicalAuthoredRoom['layout'],
): readonly SemanticFinding[] {
  const findings: SemanticFinding[] = [];
  if (settlement.flipUnavailable === true && authored?.flipped !== undefined)
    findings.push(
      finding(
        'roomLayoutFlipUnavailable',
        createRoomFeatureAddress(settlement.owner, { kind: 'roomLayoutFlip' }),
        {
          flipped: authored.flipped,
          flip: settlement.flip.kind,
          ...(settlement.flip.value === undefined ? {} : { value: settlement.flip.value }),
        },
      ),
    );
  if (settlement.entryUnavailable !== undefined && authored?.entryStartPointId !== undefined)
    findings.push(
      finding(
        'roomLayoutEntryUnavailable',
        createRoomFeatureAddress(settlement.owner, { kind: 'roomLayoutEntry' }),
        {
          entryStartPointId: authored.entryStartPointId,
          eligibleStartPointIds: settlement.entryUnavailable.eligibleStartPointIds,
          ...(settlement.exitDirection === undefined
            ? {}
            : { exitDirection: settlement.exitDirection }),
        },
      ),
    );
  return Object.freeze(findings);
}

/** Each present room object's authored anchor, in native spawn order. */
export function roomObjectAnchors(
  room: Pick<CanonicalAuthoredRoom, RoomAnchorObjectKind>,
): readonly { readonly object: RoomAnchorObjectKind; readonly anchorId: number }[] {
  return ROOM_ANCHOR_OBJECT_ORDER.flatMap((object) => {
    const anchorId = room[object]?.anchorId;
    return anchorId === undefined ? [] : [{ object, anchorId }];
  });
}

/**
 * Anchors the room's objects cannot hold: the Well-pinned anchor is the Well's
 * alone and the Well stands nowhere else, and no two objects share one.
 */
export function roomObjectAnchorFindings(
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
): readonly SemanticFinding[] {
  const pin = catalog.rooms.byKey[room.gameName]?.mapPoints?.wellAnchorId;
  const anchors = roomObjectAnchors(room);
  const findings: SemanticFinding[] = [];
  const owner = (object: RoomAnchorObjectKind) =>
    createRoomFeatureAddress(room.origin, { kind: 'objectAnchor', object });
  for (const { object, anchorId } of anchors) {
    if (pin !== undefined && (object === 'stygianWell') !== (anchorId === pin)) {
      findings.push(
        finding('roomObjectAnchorUnavailable', owner(object), {
          anchorId,
          pinnedAnchorId: pin,
          reason: object === 'stygianWell' ? 'wellPinned' : 'wellPin',
        }),
      );
      continue;
    }
    const sharing = anchors.filter(
      (other) => other.object !== object && other.anchorId === anchorId,
    );
    if (sharing.length > 0)
      findings.push(
        finding('roomObjectAnchorDuplicate', owner(object), {
          anchorId,
          occupants: sharing.map((other) => other.object),
        }),
      );
  }
  return Object.freeze(findings);
}
