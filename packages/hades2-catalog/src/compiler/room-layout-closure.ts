import type {
  BiomeLayout,
  CatalogCollection,
  ExitCompatibilityPolicy,
  RoomDeclaration,
} from '@run-planner/engine/catalog-schema';
import type { RequirementExpression } from '@run-planner/engine/requirements';

import { fail } from './errors';

function compatibleWithExit(
  source: RoomDeclaration,
  target: RoomDeclaration,
  policy: ExitCompatibilityPolicy,
): boolean {
  if (policy.kind === 'unconstrained') return true;
  if (policy.kind === 'targetHasTag') return target.structuralTags.includes(policy.targetTag);
  return (
    !source.structuralTags.includes(policy.sourceTag) ||
    target.structuralTags.includes(policy.targetTag)
  );
}

function knownTakeoverSourceWidths(
  layout: BiomeLayout,
  rooms: CatalogCollection<RoomDeclaration>,
  preboss: RoomDeclaration,
): readonly number[] | undefined {
  if (
    layout.progression.kind === 'hub' &&
    layout.progression.completedExit.roomGameName === preboss.gameName
  ) {
    return [1];
  }
  if (layout.progression.kind !== 'generated') return undefined;
  const policy = layout.progression.progressionPolicy;
  if (policy.kind !== 'staged') {
    return rooms.values
      .filter(
        (room) =>
          room.roomSetKey === preboss.roomSetKey &&
          room.mode.kind === 'authored' &&
          room.kind !== 'Preboss' &&
          room.exits.length > 0,
      )
      .map((room) => room.exits.length);
  }
  const finalStage = policy.stages.at(-1);
  if (finalStage === undefined) return undefined;
  return finalStage.roomGameNames.map((gameName) => rooms.byKey[gameName]?.exits.length ?? 0);
}

function validatePrebossBatchPolicies(
  layouts: CatalogCollection<BiomeLayout>,
  rooms: CatalogCollection<RoomDeclaration>,
  exitPolicies: CatalogCollection<ExitCompatibilityPolicy>,
): void {
  for (const preboss of rooms.values) {
    if (preboss.prebossBatchPolicy?.kind !== 'takeOverNormalDoors') continue;
    const layout = layouts.byKey[preboss.roomSetKey];
    if (layout === undefined) continue;
    const path = `prebossBatchPolicy.${preboss.gameName}`;
    const sources = rooms.values.filter(
      (room) =>
        room.roomSetKey === preboss.roomSetKey &&
        room.mode.kind === 'authored' &&
        room.kind !== 'Preboss' &&
        room.exits.length > 0,
    );
    const maximumNormalExitWidth = Math.max(0, ...sources.map((source) => source.exits.length));
    if (
      preboss.caps.maxCreationsPerRoom !== undefined &&
      preboss.caps.maxCreationsPerRoom < maximumNormalExitWidth
    ) {
      fail(
        `${path}.caps.maxCreationsPerRoom`,
        `cannot fill a supported ${maximumNormalExitWidth}-door normal batch`,
      );
    }
    if (
      preboss.caps.maxCreationsThisRun !== undefined &&
      preboss.caps.maxCreationsThisRun < maximumNormalExitWidth
    ) {
      fail(
        `${path}.caps.maxCreationsThisRun`,
        `cannot fill a supported ${maximumNormalExitWidth}-door normal batch`,
      );
    }
    for (const source of sources) {
      for (const exit of source.exits) {
        const policy = exitPolicies.byKey[exit.compatibilityPolicyKey];
        if (policy === undefined || compatibleWithExit(source, preboss, policy)) continue;
        fail(
          `${path}.compatibility`,
          `${preboss.gameName} is incompatible with ${source.gameName} exit ${exit.index}`,
        );
      }
    }
    const widths = knownTakeoverSourceWidths(layout, rooms, preboss);
    if (widths === undefined) continue;
    const maximumSupportedWidth = Math.max(...widths);
    if (preboss.prebossBatchPolicy.remainingOffers.kind === 'none' && maximumSupportedWidth > 1) {
      fail(
        `${path}.remainingOffers`,
        'none is only valid when every supported normal-door source is width one',
      );
    }
    if (
      preboss.prebossBatchPolicy.remainingOffers.kind === 'counted' &&
      maximumSupportedWidth === 1
    ) {
      fail(
        `${path}.remainingOffers`,
        'counted remaining offers are unreachable when every supported source is width one',
      );
    }
  }
}

function validateDerivedRoomOwnership(
  rooms: CatalogCollection<RoomDeclaration>,
  layouts: CatalogCollection<BiomeLayout>,
): void {
  const owners = new Map<string, string>();
  const register = (gameName: string, owner: string) => {
    const previous = owners.get(gameName);
    if (previous !== undefined) fail(owner, `${gameName} is already owned by ${previous}`);
    owners.set(gameName, owner);
  };
  for (const layout of layouts.values) {
    const path = `biomeLayouts.${layout.biomeKey}`;
    if (layout.progression.kind === 'hub') {
      register(layout.progression.terminal.roomGameName, `${path}.progression.terminal`);
    }
    layout.completion.rooms.forEach((completion, index) =>
      register(completion.roomGameName, `${path}.completion.rooms[${index}]`),
    );
  }
  rooms.values.forEach((room, index) => {
    if (room.mode.kind === 'derived' && !owners.has(room.gameName)) {
      fail(`rooms[${index}].mode`, `${room.gameName} has no layout owner`);
    }
  });
}

function visitRewardLookupRequirements(
  requirement: RequirementExpression,
  visit: (lookupKey: string) => void,
): void {
  if (requirement.kind === 'all' || requirement.kind === 'any') {
    requirement.requirements.forEach((child) => visitRewardLookupRequirements(child, visit));
  } else if (requirement.kind === 'not') {
    visitRewardLookupRequirements(requirement.requirement, visit);
  } else if (requirement.kind === 'rewardLookupExcludes') {
    visit(requirement.lookupKey);
  }
}

function validateRewardLookupOwnership(
  rooms: CatalogCollection<RoomDeclaration>,
  layouts: CatalogCollection<BiomeLayout>,
): void {
  rooms.values.forEach((room, roomIndex) => {
    if (
      room.incomingReward.kind !== 'shop' ||
      room.incomingReward.additionalOptionRequirements === undefined
    ) {
      return;
    }
    const layout = layouts.byKey[room.roomSetKey];
    for (const [optionKey, requirement] of Object.entries(
      room.incomingReward.additionalOptionRequirements,
    )) {
      visitRewardLookupRequirements(requirement, (lookupKey) => {
        if (
          layout?.progression.kind !== 'hub' ||
          layout.progression.rewardLookup.key !== lookupKey
        ) {
          fail(
            `rooms[${roomIndex}].incomingReward.additionalOptionRequirements.${optionKey}.lookupKey`,
            `${lookupKey} is not produced by ${room.roomSetKey}`,
          );
        }
      });
    }
  });
}

/** Closes room-layout relationships that require both immutable collections. */
export function validateRoomLayoutClosure(
  rooms: CatalogCollection<RoomDeclaration>,
  layouts: CatalogCollection<BiomeLayout>,
  exitPolicies: CatalogCollection<ExitCompatibilityPolicy>,
): void {
  validatePrebossBatchPolicies(layouts, rooms, exitPolicies);
  validateDerivedRoomOwnership(rooms, layouts);
  validateRewardLookupOwnership(rooms, layouts);
}
