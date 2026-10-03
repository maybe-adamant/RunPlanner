import type {
  BiomeLayout,
  CatalogCollection,
  ExitCompatibilityPolicy,
  RouteDeclaration,
  RoomDeclaration,
} from '@run-planner/engine/catalog-schema';
import type { RequirementExpression } from '@run-planner/engine/requirements';
import type { ShopProfileDeclaration } from '@run-planner/engine/reward-kernel';

import { fail } from '../errors';

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
  const sources = rooms.values.filter(
    (room) =>
      room.roomSetKey === preboss.roomSetKey &&
      room.mode.kind === 'authored' &&
      room.kind !== 'Preboss' &&
      room.kind !== 'Boss' &&
      room.kind !== 'PostBoss' &&
      room.exits.length > 0,
  );
  const predecessorCommitDelta = sources[0]?.counters.biomeDepthCache;
  // A target is generated before its predecessor commits. Its own outgoing
  // generation sees that predecessor's increment, not its own later commit.
  // Prove a uniform increment over the full source set before excluding any
  // source by depth. Detours and specialized lifecycles remain conservative.
  const directProgression =
    layout.chaos === undefined &&
    layout.progression.anomalyReplacement === undefined &&
    predecessorCommitDelta !== undefined &&
    sources.every(
      (room) =>
        room.counters.biomeDepthCache === predecessorCommitDelta &&
        room.lifecycleProfileKey === undefined &&
        room.additionalExits.length === 0 &&
        room.exits.every((exit) => exit.behavior.kind === 'playerSelected'),
    );
  return sources
    .filter((source) => {
      const sourceRequirement = source.eligibility;
      const targetRequirement = preboss.eligibility;
      if (
        !directProgression ||
        source.kind === 'Intro' ||
        source.kind === 'Opening' ||
        sourceRequirement?.kind !== 'counterRange' ||
        sourceRequirement.axis !== 'biomeDepthCache' ||
        sourceRequirement.range.min === undefined ||
        sourceRequirement.range.max === undefined ||
        targetRequirement?.kind !== 'counterRange' ||
        targetRequirement.axis !== 'biomeDepthCache'
      )
        return true;
      const minimum = sourceRequirement.range.min + predecessorCommitDelta;
      const maximum = sourceRequirement.range.max + predecessorCommitDelta;
      return !(
        (targetRequirement.range.min !== undefined && maximum < targetRequirement.range.min) ||
        (targetRequirement.range.max !== undefined && minimum > targetRequirement.range.max)
      );
    })
    .map((source) => source.exits.length);
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
    register(layout.completion.bossRoomGameName, `${path}.completion.bossRoomGameName`);
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
  shops: CatalogCollection<ShopProfileDeclaration>,
): void {
  const hubLookupKeys = new Set(
    layouts.values.flatMap((layout) =>
      layout.progression.kind === 'hub' ? [layout.progression.rewardLookup.key] : [],
    ),
  );
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
  shops.values.forEach((shop) =>
    shop.groups.values.forEach((group) =>
      group.options.values.forEach((option) => {
        if (option.requirement === undefined) return;
        visitRewardLookupRequirements(option.requirement, (lookupKey) => {
          if (hubLookupKeys.has(lookupKey)) return;
          fail(
            `rewards.shops.${shop.key}.groups.${group.key}.options.${option.key}.requirement`,
            `${lookupKey} is not produced by a Hub layout`,
          );
        });
      }),
    ),
  );
}

function validateExcludedRouteKeys(
  routeKeys: readonly string[] | undefined,
  routes: CatalogCollection<RouteDeclaration>,
  path: string,
): void {
  routeKeys?.forEach((routeKey, index) => {
    if (routes.byKey[routeKey] === undefined)
      fail(`${path}[${index}]`, `unknown route ${routeKey}`);
  });
}

function validateRouteAvailabilityOwnership(
  rooms: CatalogCollection<RoomDeclaration>,
  layouts: CatalogCollection<BiomeLayout>,
  routes: CatalogCollection<RouteDeclaration>,
): void {
  rooms.values.forEach((room, index) => {
    validateExcludedRouteKeys(
      room.resourcePointSupport.excludedRouteKeys,
      routes,
      `rooms[${index}].resourcePointSupport.excludedRouteKeys`,
    );
    validateExcludedRouteKeys(
      room.roomShop?.excludedRouteKeys,
      routes,
      `rooms[${index}].roomShop.excludedRouteKeys`,
    );
    validateExcludedRouteKeys(
      room.purgingPool?.excludedRouteKeys,
      routes,
      `rooms[${index}].purgingPool.excludedRouteKeys`,
    );
    validateExcludedRouteKeys(
      room.keepsakeRackExcludedRouteKeys,
      routes,
      `rooms[${index}].keepsakeRackExcludedRouteKeys`,
    );
  });
  layouts.values.forEach((layout, index) => {
    if (layout.progression.kind !== 'generated') return;
    validateExcludedRouteKeys(
      layout.progression.anomalyReplacement?.source.excludedRouteKeys,
      routes,
      `biomeLayouts[${index}].progression.anomalyReplacement.source.excludedRouteKeys`,
    );
  });
}

/** Closes room-layout relationships that require both immutable collections. */
export function validateRoomLayoutClosure(
  rooms: CatalogCollection<RoomDeclaration>,
  layouts: CatalogCollection<BiomeLayout>,
  exitPolicies: CatalogCollection<ExitCompatibilityPolicy>,
  routes: CatalogCollection<RouteDeclaration>,
  shops: CatalogCollection<ShopProfileDeclaration>,
): void {
  validatePrebossBatchPolicies(layouts, rooms, exitPolicies);
  validateDerivedRoomOwnership(rooms, layouts);
  validateRewardLookupOwnership(rooms, layouts, shops);
  validateRouteAvailabilityOwnership(rooms, layouts, routes);
}
