import {
  createFieldsSpatialAddress,
  createRoomFeatureAddress,
  type FieldsSpatialTarget,
} from '../authored-project/addresses';
import type { Catalog, FieldsSpatialDeclaration } from '../catalog-schema';
import { fieldsOptionalRewardCountSupport } from './fields-optional-count';
import type { CanonicalAuthoredRoom } from './materialization';
import type { SemanticFinding } from './model';

interface FieldsSpatialPointAssessment {
  readonly active: boolean;
  readonly findings: readonly SemanticFinding[];
  readonly selectedPossible: boolean;
  readonly supportPointIds: readonly number[];
}

function activeSlots(
  room: CanonicalAuthoredRoom,
  groupKey: string,
  optional: boolean,
): ReadonlySet<string> {
  const resolved = optional ? (room.fieldsOptionalRewards ?? []) : (room.localRewards ?? []);
  const unresolved = optional
    ? (room.unresolvedFieldsOptionalRewards ?? [])
    : (room.unresolvedLocalRewards ?? []);
  return new Set(
    [...resolved, ...unresolved]
      .filter((reward) => reward.groupKey === groupKey)
      .map((reward) => reward.slotKey),
  );
}

function declarationFor(
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
): FieldsSpatialDeclaration | undefined {
  return catalog.rooms.byKey[room.gameName]?.fieldsSpatial;
}

function pointDomain(
  declaration: FieldsSpatialDeclaration,
  target: FieldsSpatialTarget,
): readonly number[] {
  switch (target.kind) {
    case 'entry':
      return declaration.entryPairs.map((pair) => pair.startPointId);
    case 'cage':
      return declaration.cagePointIds;
    case 'optional':
    case 'nemesis':
      return declaration.optionalPointIds;
  }
}

function targetActive(
  room: CanonicalAuthoredRoom,
  catalog: Catalog,
  target: FieldsSpatialTarget,
): boolean {
  const roomDeclaration = catalog.rooms.byKey[room.gameName];
  if (roomDeclaration === undefined) return false;
  switch (target.kind) {
    case 'entry':
      return true;
    case 'cage': {
      const cage = roomDeclaration.localChildren.find(
        (child) =>
          child.kind === 'boundedRewardSlots' && child.offerRewardCapability === 'fieldsCages',
      );
      return cage !== undefined && activeSlots(room, cage.key, false).has(target.slotKey);
    }
    case 'optional':
      return (
        roomDeclaration.fieldsOptionalRewards !== undefined &&
        activeSlots(room, roomDeclaration.fieldsOptionalRewards.key, true).has(target.slotKey)
      );
    case 'nemesis':
      return room.encounterPhases.some((phase) => phase.encounterKey === 'NemesisRandomEvent');
  }
}

function sameTarget(left: FieldsSpatialTarget, right: FieldsSpatialTarget): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === 'cage' && right.kind === 'cage') return left.slotKey === right.slotKey;
  if (left.kind === 'optional' && right.kind === 'optional') return left.slotKey === right.slotKey;
  return true;
}

function selectedPoint(room: CanonicalAuthoredRoom, target: FieldsSpatialTarget): number | null {
  const spatial = room.fieldsSpatial;
  if (spatial === undefined) return null;
  switch (target.kind) {
    case 'entry':
      return spatial.entryStartPointId;
    case 'cage':
      return spatial.cagePointIdBySlot[target.slotKey] ?? null;
    case 'optional':
      return spatial.optionalPointIdBySlot[target.slotKey] ?? null;
    case 'nemesis':
      return spatial.nemesisPointId;
  }
}

function activeFieldsSpatialTargets(
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
): readonly FieldsSpatialTarget[] {
  const roomDeclaration = catalog.rooms.byKey[room.gameName];
  if (room.fieldsSpatial === undefined || roomDeclaration?.fieldsSpatial === undefined) return [];
  const cage = roomDeclaration.localChildren.find(
    (child) => child.kind === 'boundedRewardSlots' && child.offerRewardCapability === 'fieldsCages',
  );
  const cageSlotKeys = cage?.kind === 'boundedRewardSlots' ? cage.slotKeys : [];
  const activeCages = cage === undefined ? new Set<string>() : activeSlots(room, cage.key, false);
  const activeOptionals =
    roomDeclaration.fieldsOptionalRewards === undefined
      ? new Set<string>()
      : activeSlots(room, roomDeclaration.fieldsOptionalRewards.key, true);
  return Object.freeze([
    Object.freeze({ kind: 'entry' as const }),
    ...cageSlotKeys
      .filter((slotKey) => activeCages.has(slotKey))
      .map((slotKey) => Object.freeze({ kind: 'cage' as const, slotKey })),
    ...(roomDeclaration.fieldsOptionalRewards?.slotKeys ?? [])
      .filter((slotKey) => activeOptionals.has(slotKey))
      .map((slotKey) => Object.freeze({ kind: 'optional' as const, slotKey })),
    ...(room.encounterPhases.some((phase) => phase.encounterKey === 'NemesisRandomEvent')
      ? [Object.freeze({ kind: 'nemesis' as const })]
      : []),
  ]);
}

function occupiedSiblingPoints(
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
  target: FieldsSpatialTarget,
): ReadonlySet<number> {
  const occupied = new Set<number>();
  for (const sibling of activeFieldsSpatialTargets(catalog, room)) {
    if (sameTarget(sibling, target)) continue;
    const sharesDomain =
      (target.kind === 'cage' && sibling.kind === 'cage') ||
      ((target.kind === 'optional' || target.kind === 'nemesis') &&
        (sibling.kind === 'optional' || sibling.kind === 'nemesis'));
    if (!sharesDomain) continue;
    const pointId = selectedPoint(room, sibling);
    if (pointId !== null) occupied.add(pointId);
  }
  return occupied;
}

function finding(
  code:
    'fieldsSpatialPointMissing' | 'fieldsSpatialPointUnavailable' | 'fieldsSpatialPointDuplicate',
  room: CanonicalAuthoredRoom,
  target: FieldsSpatialTarget,
  evidence: SemanticFinding['evidence'],
): SemanticFinding {
  return Object.freeze({
    code,
    severity: 'error',
    phase: 'roomGeneration',
    origin: createFieldsSpatialAddress(room.origin, target),
    evidence: Object.freeze(evidence),
  });
}

/** Shared engine authority for both project findings and contextual point candidates. */
export function assessFieldsSpatialPoint(
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
  target: FieldsSpatialTarget,
  pointId: number | null,
): FieldsSpatialPointAssessment | undefined {
  const declaration = declarationFor(catalog, room);
  if (room.fieldsSpatial === undefined || declaration === undefined) return undefined;
  const active = targetActive(room, catalog, target);
  const domain = pointDomain(declaration, target);
  const excluded =
    target.kind === 'nemesis'
      ? new Set(declaration.nemesisExcludedOptionalPointIds)
      : new Set<number>();
  const occupied = occupiedSiblingPoints(catalog, room, target);
  const supportPointIds = Object.freeze(
    domain.filter((candidate) => !excluded.has(candidate) && !occupied.has(candidate)),
  );
  const findings: SemanticFinding[] = [];
  if (active && pointId === null) {
    findings.push(
      finding('fieldsSpatialPointMissing', room, target, {
        target: target.kind,
        supportPointIds,
      }),
    );
  } else if (pointId !== null && !domain.includes(pointId)) {
    findings.push(
      finding('fieldsSpatialPointUnavailable', room, target, {
        pointId,
        domain,
      }),
    );
  } else if (active && pointId !== null && excluded.has(pointId)) {
    findings.push(
      finding('fieldsSpatialPointUnavailable', room, target, {
        pointId,
        reason: 'sourceExcluded',
      }),
    );
  } else if (active && pointId !== null && occupied.has(pointId)) {
    findings.push(
      finding('fieldsSpatialPointDuplicate', room, target, {
        pointId,
        occupiedPointIds: [...occupied],
      }),
    );
  }
  return Object.freeze({
    active,
    findings: Object.freeze(findings),
    selectedPossible: !active || (pointId !== null && supportPointIds.includes(pointId)),
    supportPointIds,
  });
}

export function fieldsSpatialFindings(
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
): readonly SemanticFinding[] {
  const spatialFindings = activeFieldsSpatialTargets(catalog, room).flatMap(
    (target) =>
      assessFieldsSpatialPoint(catalog, room, target, selectedPoint(room, target))?.findings ?? [],
  );
  const support = fieldsOptionalRewardCountSupport(catalog, room, room.origin);
  if (
    room.fieldsOptionalRewardCount !== undefined &&
    support?.reservesNemesisPosition === true &&
    room.fieldsOptionalRewardCount > support.effectiveMaximum
  ) {
    spatialFindings.push(
      Object.freeze({
        code: 'fieldsOptionalCapacityUnavailable',
        severity: 'error',
        phase: 'roomGeneration',
        origin: createRoomFeatureAddress(room.origin, { kind: 'fieldsOptionalRewardCount' }),
        evidence: Object.freeze({
          physicalCapacity: support.physicalMaximum,
          effectiveCapacity: support.effectiveMaximum,
          selectedCount: room.fieldsOptionalRewardCount,
        }),
      }),
    );
  }
  return Object.freeze(spatialFindings);
}
