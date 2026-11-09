import {
  createFieldsSpatialAddress,
  semanticAddressKey,
  type FieldsSpatialTarget,
} from '../../authored-project/addresses';
import { stableChoice } from '../../authored-project/stable-hash';
import type { Catalog, FieldsSpatialDeclaration } from '../../catalog-schema';
import { directEncounterDefinitionKeyForSlot } from '../../authored-project/room-state/encounter-envelope';
import type { CanonicalAuthoredRoom } from '../materialization';
import type { SemanticFinding } from '../model';

interface FieldsSpatialPointAssessment {
  readonly active: boolean;
  readonly assignable: boolean;
  readonly findings: readonly SemanticFinding[];
  readonly selectedPossible: boolean;
  readonly supportPointIds: readonly number[];
  /** The active target's default point while it has no stored one. */
  readonly defaultPointId?: number;
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
      return room.encounterPhases.some(
        (phase) =>
          directEncounterDefinitionKeyForSlot(
            catalog,
            roomDeclaration,
            room.encounters,
            phase.slotKey,
            room.gameName,
          ) === 'NemesisRandomEvent',
      );
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
    ...cageSlotKeys
      .filter((slotKey) => activeCages.has(slotKey))
      .map((slotKey) => Object.freeze({ kind: 'cage' as const, slotKey })),
    ...(roomDeclaration.fieldsOptionalRewards?.slotKeys ?? [])
      .filter((slotKey) => activeOptionals.has(slotKey))
      .map((slotKey) => Object.freeze({ kind: 'optional' as const, slotKey })),
    ...(room.encounterPhases.some(
      (phase) =>
        directEncounterDefinitionKeyForSlot(
          catalog,
          roomDeclaration,
          room.encounters,
          phase.slotKey,
          room.gameName,
        ) === 'NemesisRandomEvent',
    )
      ? [Object.freeze({ kind: 'nemesis' as const })]
      : []),
  ]);
}

/** Cages share one point family; optional rewards and Nemesis share the other. */
function family(target: FieldsSpatialTarget): 'cage' | 'optional' {
  return target.kind === 'cage' ? 'cage' : 'optional';
}

/**
 * Where an active Fields slot stands: its stored point (the owner's choice,
 * kept even where it is invalid) or its stable default.
 */
export interface FieldsSpatialPosition {
  readonly target: FieldsSpatialTarget;
  readonly pointId: number;
  readonly source: 'chosen' | 'default';
}

/**
 * Every active slot's point. Slots without a stored point claim in the
 * game's spawn order (cages, optional rewards, then Nemesis), each taking its
 * stable-default best of its family's points that no active stored point or
 * earlier claim holds, Nemesis never on its excluded points; a slot left no
 * free point has none.
 */
export function fieldsSpatialPositions(
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
): readonly FieldsSpatialPosition[] {
  const cached = positionsByRoom.get(room);
  if (cached?.catalog === catalog) return cached.positions;
  const positions = claimFieldsSpatialPositions(catalog, room);
  positionsByRoom.set(room, { catalog, positions });
  return positions;
}

/** Memoizes each immutable room's claimed positions, so every assessed slot shares one claim. */
const positionsByRoom = new WeakMap<
  CanonicalAuthoredRoom,
  { readonly catalog: Catalog; readonly positions: readonly FieldsSpatialPosition[] }
>();

function claimFieldsSpatialPositions(
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
): readonly FieldsSpatialPosition[] {
  const declaration = declarationFor(catalog, room);
  if (declaration === undefined) return Object.freeze([]);
  const targets = activeFieldsSpatialTargets(catalog, room);
  const taken = { cage: new Set<number>(), optional: new Set<number>() };
  for (const target of targets) {
    const pointId = selectedPoint(room, target);
    if (pointId !== null) taken[family(target)].add(pointId);
  }
  const excluded = new Set(declaration.nemesisExcludedOptionalPointIds);
  const positions: FieldsSpatialPosition[] = [];
  for (const target of targets) {
    const chosen = selectedPoint(room, target);
    if (chosen !== null) {
      positions.push(Object.freeze({ target, pointId: chosen, source: 'chosen' }));
      continue;
    }
    const free = taken[family(target)];
    const pointId = stableChoice(
      semanticAddressKey(createFieldsSpatialAddress(room.origin, target)),
      pointDomain(declaration, target).filter(
        (candidate) =>
          !free.has(candidate) && !(target.kind === 'nemesis' && excluded.has(candidate)),
      ),
    );
    if (pointId === undefined) continue;
    free.add(pointId);
    positions.push(Object.freeze({ target, pointId, source: 'default' }));
  }
  return Object.freeze(positions);
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
  code: 'fieldsSpatialPointUnavailable' | 'fieldsSpatialPointDuplicate',
  room: CanonicalAuthoredRoom,
  target: FieldsSpatialTarget,
  evidence: SemanticFinding['evidence'],
): SemanticFinding {
  return Object.freeze({
    code,
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
  // An unset point stands on its default, which raises nothing.
  if (pointId !== null && !domain.includes(pointId)) {
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
  const position = active
    ? fieldsSpatialPositions(catalog, room).find((candidate) =>
        sameTarget(candidate.target, target),
      )
    : undefined;
  return Object.freeze({
    active,
    ...(position?.source === 'default' ? { defaultPointId: position.pointId } : {}),
    assignable: pointId === null || (domain.includes(pointId) && !excluded.has(pointId)),
    findings: Object.freeze(findings),
    selectedPossible: !active || pointId === null || supportPointIds.includes(pointId),
    supportPointIds,
  });
}

export function fieldsSpatialFindings(
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
): readonly SemanticFinding[] {
  return Object.freeze(
    activeFieldsSpatialTargets(catalog, room).flatMap(
      (target) =>
        assessFieldsSpatialPoint(catalog, room, target, selectedPoint(room, target))?.findings ??
        [],
    ),
  );
}
