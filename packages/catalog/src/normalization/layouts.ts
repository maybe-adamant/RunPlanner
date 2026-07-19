import type {
  BiomeLayout,
  CatalogCollection,
  CompletionDescriptor,
  EntryDescriptor,
  GeneratedBatchPolicy,
  HubBiomeLayout,
  LinearBiomeLayout,
  LinearProgressionPolicy,
  LinearStartDescriptor,
  RewardStorePolicy,
  RoomDeclaration,
  SourceRewardStorePolicyOverride,
  TerminalPolicy,
} from '@run-planner/core';
import type { RewardStoreDeclaration } from '@run-planner/core/reward-kernel';

import type { RawBiomeLayoutDeclaration } from '../declarations';
import {
  createCollection,
  freezeUniqueStrings,
  requireNonEmpty,
  requirePositiveInteger,
} from './common';
import { normalizeAuthoredFields } from './descriptors';
import { fail } from './errors';

function requireRoom(
  gameName: string,
  biomeStepKey: string,
  rooms: CatalogCollection<RoomDeclaration>,
  path: string,
): RoomDeclaration {
  requireNonEmpty(gameName, path);
  const room = rooms.byKey[gameName];
  if (room === undefined) {
    fail(path, `unknown room ${gameName}`);
  }
  if (room.biomeStepKey !== biomeStepKey) {
    fail(path, `${gameName} must belong to ${biomeStepKey}`);
  }
  return room;
}

function normalizeEntries(
  rawEntries: readonly EntryDescriptor[],
  biomeStepKey: string,
  rooms: CatalogCollection<RoomDeclaration>,
  path: string,
): readonly EntryDescriptor[] {
  freezeUniqueStrings(
    rawEntries.map((entry) =>
      entry.kind === 'fixedEntry' ? `role:${entry.role}` : `slot:${entry.slotKey}`,
    ),
    `${path}.identities`,
  );
  return Object.freeze(
    rawEntries.map((entry, index): EntryDescriptor => {
      const entryPath = `${path}[${index}]`;
      const receivedKind: unknown = (entry as { readonly kind?: unknown }).kind;
      if (entry.kind === 'fixedEntry') {
        const role = requireNonEmpty(entry.role, `${entryPath}.role`);
        const room = requireRoom(
          entry.roomGameName,
          biomeStepKey,
          rooms,
          `${entryPath}.roomGameName`,
        );
        if (room.mode.kind !== 'derived' || room.mode.classification !== 'fixedEntry') {
          fail(`${entryPath}.roomGameName`, `${room.gameName} must be a derived fixed-entry room`);
        }
        return Object.freeze({ kind: 'fixedEntry', role, roomGameName: room.gameName });
      }
      if (entry.kind === 'fixedAuthoredSlot') {
        const slotKey = requireNonEmpty(entry.slotKey, `${entryPath}.slotKey`);
        const room = requireRoom(
          entry.roomGameName,
          biomeStepKey,
          rooms,
          `${entryPath}.roomGameName`,
        );
        if (room.mode.kind !== 'authored') {
          fail(`${entryPath}.roomGameName`, `${room.gameName} must be an authored room`);
        }
        return Object.freeze({ kind: 'fixedAuthoredSlot', slotKey, roomGameName: room.gameName });
      }
      fail(`${entryPath}.kind`, `unknown entry descriptor ${String(receivedKind)}`);
    }),
  );
}

function normalizeRewardStorePolicy(
  rawPolicy: RewardStorePolicy,
  rewardStores: CatalogCollection<RewardStoreDeclaration>,
  path: string,
): RewardStorePolicy {
  const receivedKind: unknown = (rawPolicy as { readonly kind?: unknown }).kind;
  if (rawPolicy.kind === 'authoredBaseStore') {
    const storeKeys = freezeUniqueStrings(rawPolicy.storeKeys, `${path}.storeKeys`);
    if (storeKeys.length === 0) {
      fail(`${path}.storeKeys`, 'must not be empty');
    }
    for (const [index, storeKey] of storeKeys.entries()) {
      if (rewardStores.byKey[storeKey] === undefined) {
        fail(`${path}.storeKeys[${index}]`, `unknown reward store ${storeKey}`);
      }
    }
    if (!storeKeys.includes(rawPolicy.defaultStoreKey)) {
      fail(`${path}.defaultStoreKey`, 'must belong to the authored base store domain');
    }
    return Object.freeze({
      kind: 'authoredBaseStore',
      storeKeys,
      defaultStoreKey: rawPolicy.defaultStoreKey,
    });
  }
  if (rawPolicy.kind === 'sourceOfferPoint') {
    if (rawPolicy.selector !== 'lastActiveWheel') {
      fail(`${path}.selector`, `unknown source offer-point selector ${String(rawPolicy.selector)}`);
    }
    return Object.freeze({
      kind: 'sourceOfferPoint',
      selector: rawPolicy.selector,
    });
  }
  if (rawPolicy.kind === 'none') {
    return Object.freeze({ kind: 'none' });
  }
  fail(`${path}.kind`, `unknown reward-store policy ${String(receivedKind)}`);
}

function normalizeRewardStoreOverrides(
  rawOverrides: readonly SourceRewardStorePolicyOverride[],
  biomeStepKey: string,
  rooms: CatalogCollection<RoomDeclaration>,
  rewardStores: CatalogCollection<RewardStoreDeclaration>,
  path: string,
): readonly SourceRewardStorePolicyOverride[] {
  const profileKeys = freezeUniqueStrings(
    rawOverrides.map((override) => override.sourceEncounterProfileKey),
    `${path}.sourceEncounterProfileKeys`,
  );
  return Object.freeze(
    rawOverrides.map((override, index) => {
      const overridePath = `${path}[${index}]`;
      const sourceEncounterProfileKey = profileKeys[index] as string;
      const hasSource = rooms.values.some(
        (room) =>
          room.biomeStepKey === biomeStepKey &&
          room.encounterProfileKey === sourceEncounterProfileKey,
      );
      if (!hasSource) {
        fail(
          `${overridePath}.sourceEncounterProfileKey`,
          `${sourceEncounterProfileKey} is not used by a room in ${biomeStepKey}`,
        );
      }
      return Object.freeze({
        sourceEncounterProfileKey,
        policy: normalizeRewardStorePolicy(override.policy, rewardStores, `${overridePath}.policy`),
      });
    }),
  );
}

function normalizeProgressionPolicy(
  rawPolicy: LinearProgressionPolicy,
  biomeStepKey: string,
  rooms: CatalogCollection<RoomDeclaration>,
  path: string,
): LinearProgressionPolicy {
  const receivedKind: unknown = (rawPolicy as { readonly kind?: unknown }).kind;
  if (rawPolicy.kind === 'eligibilityDriven') {
    return Object.freeze({ kind: 'eligibilityDriven' });
  }
  if (rawPolicy.kind === 'fixedCount') {
    return Object.freeze({
      kind: 'fixedCount',
      continuationCount: requirePositiveInteger(
        rawPolicy.continuationCount,
        `${path}.continuationCount`,
      ),
    });
  }
  if (rawPolicy.kind === 'staged') {
    const stageKeys = freezeUniqueStrings(
      rawPolicy.stages.map((stage) => stage.key),
      `${path}.stages.keys`,
    );
    if (stageKeys.length === 0) {
      fail(`${path}.stages`, 'must not be empty');
    }
    const stages = rawPolicy.stages.map((stage, stageIndex) => {
      const stagePath = `${path}.stages[${stageIndex}]`;
      const roomGameNames = freezeUniqueStrings(stage.roomGameNames, `${stagePath}.roomGameNames`);
      if (roomGameNames.length === 0) {
        fail(`${stagePath}.roomGameNames`, 'must not be empty');
      }
      roomGameNames.forEach((gameName, roomIndex) => {
        const room = requireRoom(
          gameName,
          biomeStepKey,
          rooms,
          `${stagePath}.roomGameNames[${roomIndex}]`,
        );
        if (
          room.mode.kind !== 'authored' ||
          room.kind === 'Intro' ||
          room.kind === 'Opening' ||
          room.kind === 'Preboss'
        ) {
          fail(
            `${stagePath}.roomGameNames[${roomIndex}]`,
            `${gameName} must be an authored continuation room`,
          );
        }
      });
      return Object.freeze({ key: stageKeys[stageIndex] as string, roomGameNames });
    });
    return Object.freeze({ kind: 'staged', stages: Object.freeze(stages) });
  }
  fail(`${path}.kind`, `unknown progression policy ${String(receivedKind)}`);
}

function normalizeBatchPolicy(rawPolicy: GeneratedBatchPolicy, path: string): GeneratedBatchPolicy {
  const receivedKind: unknown = (rawPolicy as { readonly kind?: unknown }).kind;
  if (
    rawPolicy.kind !== 'standard' &&
    rawPolicy.kind !== 'fields' &&
    rawPolicy.kind !== 'clockwork'
  ) {
    fail(`${path}.kind`, `unknown generated-batch policy ${String(receivedKind)}`);
  }
  const fields = normalizeAuthoredFields(rawPolicy.fields, `${path}.fields`);
  if (rawPolicy.kind === 'fields') {
    if (
      fields.length !== 1 ||
      fields[0]?.key !== 'cageOutcome' ||
      fields[0].kind !== 'enum' ||
      fields[0].values.length !== 2 ||
      fields[0].values[0] !== 'min' ||
      fields[0].values[1] !== 'max' ||
      fields[0].defaultValue !== 'min'
    ) {
      fail(`${path}.fields`, 'fields policy requires cageOutcome enum [min, max] with default min');
    }
  } else if (fields.length !== 0) {
    fail(`${path}.fields`, `${rawPolicy.kind} policy does not own authored batch fields`);
  }
  return Object.freeze({ kind: rawPolicy.kind, fields });
}

function normalizeLinearStart(
  rawStart: LinearStartDescriptor,
  biomeStepKey: string,
  rooms: CatalogCollection<RoomDeclaration>,
  path: string,
): LinearStartDescriptor {
  const receivedKind: unknown = (rawStart as { readonly kind?: unknown }).kind;
  if (rawStart.kind === 'fixedEntry') {
    const role = requireNonEmpty(rawStart.role, `${path}.role`);
    const room = requireRoom(rawStart.roomGameName, biomeStepKey, rooms, `${path}.roomGameName`);
    if (room.mode.kind !== 'derived' || room.mode.classification !== 'fixedEntry') {
      fail(`${path}.roomGameName`, `${room.gameName} must be a derived fixed-entry room`);
    }
    return Object.freeze({ kind: 'fixedEntry', role, roomGameName: room.gameName });
  }
  if (rawStart.kind !== 'authoredStart') {
    fail(`${path}.kind`, `unknown linear start descriptor ${String(receivedKind)}`);
  }
  const roomGameNames = freezeUniqueStrings(rawStart.roomGameNames, `${path}.roomGameNames`);
  if (roomGameNames.length === 0) {
    fail(`${path}.roomGameNames`, 'must not be empty');
  }
  if (rawStart.mode === 'fixed' && roomGameNames.length !== 1) {
    fail(`${path}.roomGameNames`, 'fixed start must reference exactly one room');
  }
  if (rawStart.mode !== 'fixed' && rawStart.mode !== 'oneOf') {
    fail(`${path}.mode`, `unknown authored start mode ${String(rawStart.mode)}`);
  }
  roomGameNames.forEach((gameName, roomIndex) => {
    const room = requireRoom(gameName, biomeStepKey, rooms, `${path}.roomGameNames[${roomIndex}]`);
    const requiredKind = rawStart.mode === 'fixed' ? 'Intro' : 'Opening';
    if (room.kind !== requiredKind || room.mode.kind !== 'authored') {
      fail(
        `${path}.roomGameNames[${roomIndex}]`,
        `${gameName} must be an authored ${requiredKind}`,
      );
    }
  });
  return Object.freeze({ kind: 'authoredStart', mode: rawStart.mode, roomGameNames });
}

function normalizeTerminal(
  rawTerminal: TerminalPolicy,
  biomeStepKey: string,
  rooms: CatalogCollection<RoomDeclaration>,
  path: string,
): TerminalPolicy {
  const receivedKind: unknown = (rawTerminal as { readonly kind?: unknown }).kind;
  if (rawTerminal.kind === 'forkedTransition') {
    const room = requireRoom(rawTerminal.roomGameName, biomeStepKey, rooms, `${path}.roomGameName`);
    if (
      room.kind !== 'Preboss' ||
      room.mode.kind !== 'authored' ||
      room.mode.templateKey !== 'ForkedPreboss'
    ) {
      fail(`${path}.roomGameName`, `${room.gameName} must be an authored forked Preboss`);
    }
    if (rawTerminal.exitPolicy.kind !== 'allExitsTerminal') {
      fail(
        `${path}.exitPolicy.kind`,
        `unknown terminal exit policy ${String(rawTerminal.exitPolicy.kind)}`,
      );
    }
    return Object.freeze({
      kind: 'forkedTransition',
      roomGameName: room.gameName,
      exitPolicy: Object.freeze({ kind: 'allExitsTerminal' }),
    });
  }
  if (rawTerminal.kind === 'directTransition') {
    const room = requireRoom(rawTerminal.roomGameName, biomeStepKey, rooms, `${path}.roomGameName`);
    if (
      room.kind !== 'Preboss' ||
      room.mode.kind !== 'authored' ||
      room.mode.templateKey !== 'ShopPreboss'
    ) {
      fail(`${path}.roomGameName`, `${room.gameName} must be an authored direct Preboss`);
    }
    return Object.freeze({ kind: 'directTransition', roomGameName: room.gameName });
  }
  if (rawTerminal.kind === 'fixedAuthoredSlot') {
    const slotKey = requireNonEmpty(rawTerminal.slotKey, `${path}.slotKey`);
    const room = requireRoom(rawTerminal.roomGameName, biomeStepKey, rooms, `${path}.roomGameName`);
    if (
      room.kind !== 'Preboss' ||
      room.mode.kind !== 'authored' ||
      room.mode.templateKey !== 'ShopPreboss'
    ) {
      fail(`${path}.roomGameName`, `${room.gameName} must be an authored shop Preboss`);
    }
    return Object.freeze({ kind: 'fixedAuthoredSlot', slotKey, roomGameName: room.gameName });
  }
  if (rawTerminal.kind === 'generatedTarget') {
    const room = requireRoom(rawTerminal.roomGameName, biomeStepKey, rooms, `${path}.roomGameName`);
    if (
      room.kind !== 'Preboss' ||
      room.mode.kind !== 'authored' ||
      room.mode.templateKey !== 'ShopPreboss'
    ) {
      fail(`${path}.roomGameName`, `${room.gameName} must be an authored shop Preboss`);
    }
    if (rawTerminal.closesBiomeWhenPicked !== true) {
      fail(`${path}.closesBiomeWhenPicked`, 'must be true');
    }
    return Object.freeze({
      kind: 'generatedTarget',
      roomGameName: room.gameName,
      closesBiomeWhenPicked: true,
    });
  }
  fail(`${path}.kind`, `unknown terminal policy ${String(receivedKind)}`);
}

function normalizeCompletion(
  rawCompletion: CompletionDescriptor,
  biomeStepKey: string,
  rooms: CatalogCollection<RoomDeclaration>,
  expectedRouteTransition: 'nextBiome' | 'routeComplete',
  path: string,
): CompletionDescriptor {
  if (rawCompletion.rooms.length === 0) {
    fail(`${path}.rooms`, 'must not be empty');
  }
  const roles = freezeUniqueStrings(
    rawCompletion.rooms.map((room) => room.role),
    `${path}.rooms.roles`,
  );
  const completionRooms = rawCompletion.rooms.map((entry, index) => {
    const entryPath = `${path}.rooms[${index}]`;
    const expectedRole = index === 0 ? 'boss' : 'postboss';
    if (entry.role !== expectedRole || index > 1) {
      fail(`${entryPath}.role`, `completion role ${expectedRole} is required at index ${index}`);
    }
    const room = requireRoom(entry.roomGameName, biomeStepKey, rooms, `${entryPath}.roomGameName`);
    const expectedKind = entry.role === 'boss' ? 'Boss' : 'PostBoss';
    if (
      room.kind !== expectedKind ||
      room.mode.kind !== 'derived' ||
      room.mode.classification !== 'completion'
    ) {
      fail(
        `${entryPath}.roomGameName`,
        `${room.gameName} must be a derived ${expectedKind} completion room`,
      );
    }
    return Object.freeze({
      role: roles[index] as 'boss' | 'postboss',
      roomGameName: room.gameName,
    });
  });
  if (
    rawCompletion.routeTransition.kind !== 'nextBiome' &&
    rawCompletion.routeTransition.kind !== 'routeComplete'
  ) {
    fail(
      `${path}.routeTransition.kind`,
      `unknown route transition ${String(rawCompletion.routeTransition.kind)}`,
    );
  }
  if (rawCompletion.routeTransition.kind !== expectedRouteTransition) {
    fail(`${path}.routeTransition.kind`, `${biomeStepKey} requires ${expectedRouteTransition}`);
  }
  return Object.freeze({
    rooms: Object.freeze(completionRooms),
    routeTransition: Object.freeze({ kind: rawCompletion.routeTransition.kind }),
  });
}

function normalizeLinearLayout(
  layout: Extract<RawBiomeLayoutDeclaration, { readonly kind: 'LinearBiome' }>,
  layoutIndex: number,
  rooms: CatalogCollection<RoomDeclaration>,
  rewardStores: CatalogCollection<RewardStoreDeclaration>,
  expectedRouteTransition: 'nextBiome' | 'routeComplete',
): LinearBiomeLayout {
  const path = `biomeLayouts[${layoutIndex}]`;
  const progressionPolicy = normalizeProgressionPolicy(
    layout.continuation.progressionPolicy,
    layout.biomeStepKey,
    rooms,
    `${path}.continuation.progressionPolicy`,
  );
  const batchPolicy = normalizeBatchPolicy(
    layout.continuation.batchPolicy,
    `${path}.continuation.batchPolicy`,
  );
  const terminal = normalizeTerminal(
    layout.terminal,
    layout.biomeStepKey,
    rooms,
    `${path}.terminal`,
  );
  if (terminal.kind === 'fixedAuthoredSlot') {
    fail(`${path}.terminal.kind`, 'fixed authored terminals require HubBiome');
  }
  if (terminal.kind === 'generatedTarget' && batchPolicy.kind !== 'clockwork') {
    fail(`${path}.terminal.kind`, 'generated terminal targets require clockwork batches');
  }
  if (batchPolicy.kind === 'clockwork' && terminal.kind !== 'generatedTarget') {
    fail(`${path}.continuation.batchPolicy.kind`, 'clockwork batches require a generated terminal');
  }
  const maxBatches = requirePositiveInteger(layout.bounds.maxBatches, `${path}.bounds.maxBatches`);
  const maxTargets = requirePositiveInteger(layout.bounds.maxTargets, `${path}.bounds.maxTargets`);
  const requiredBatchCount =
    progressionPolicy.kind === 'fixedCount'
      ? progressionPolicy.continuationCount
      : progressionPolicy.kind === 'staged'
        ? progressionPolicy.stages.length
        : undefined;
  if (requiredBatchCount !== undefined && requiredBatchCount > maxBatches) {
    fail(`${path}.bounds.maxBatches`, 'must cover every declared continuation');
  }
  return Object.freeze({
    biomeStepKey: layout.biomeStepKey,
    kind: 'LinearBiome',
    start: normalizeLinearStart(layout.start, layout.biomeStepKey, rooms, `${path}.start`),
    entries: normalizeEntries(layout.entries ?? [], layout.biomeStepKey, rooms, `${path}.entries`),
    continuation: Object.freeze({
      progressionPolicy,
      batchPolicy,
      rewardStorePolicy: normalizeRewardStorePolicy(
        layout.continuation.rewardStorePolicy,
        rewardStores,
        `${path}.continuation.rewardStorePolicy`,
      ),
      rewardStoreOverrides: normalizeRewardStoreOverrides(
        layout.continuation.rewardStoreOverrides ?? [],
        layout.biomeStepKey,
        rooms,
        rewardStores,
        `${path}.continuation.rewardStoreOverrides`,
      ),
    }),
    terminal,
    completion: normalizeCompletion(
      layout.completion,
      layout.biomeStepKey,
      rooms,
      expectedRouteTransition,
      `${path}.completion`,
    ),
    fields: normalizeAuthoredFields(layout.fields ?? [], `${path}.fields`),
    bounds: Object.freeze({ maxBatches, maxTargets }),
  });
}

function normalizeHubLayout(
  layout: Extract<RawBiomeLayoutDeclaration, { readonly kind: 'HubBiome' }>,
  layoutIndex: number,
  rooms: CatalogCollection<RoomDeclaration>,
  rewardStores: CatalogCollection<RewardStoreDeclaration>,
  expectedRouteTransition: 'nextBiome' | 'routeComplete',
): HubBiomeLayout {
  const path = `biomeLayouts[${layoutIndex}]`;
  const entries = normalizeEntries(layout.entries, layout.biomeStepKey, rooms, `${path}.entries`);
  const hubRoom = requireRoom(
    layout.hub.roomGameName,
    layout.biomeStepKey,
    rooms,
    `${path}.hub.roomGameName`,
  );
  if (
    hubRoom.kind !== 'Hub' ||
    hubRoom.mode.kind !== 'derived' ||
    hubRoom.mode.classification !== 'hub'
  ) {
    fail(`${path}.hub.roomGameName`, `${hubRoom.gameName} must be a derived Hub room`);
  }
  const restoreRoom = requireRoom(
    layout.hub.restoreRoomGameName,
    layout.biomeStepKey,
    rooms,
    `${path}.hub.restoreRoomGameName`,
  );
  if (restoreRoom.gameName !== hubRoom.gameName) {
    fail(`${path}.hub.restoreRoomGameName`, 'must reference the persistent hub room');
  }
  const slotKeys = freezeUniqueStrings(
    layout.hub.slots.map((slot) => slot.slotKey),
    `${path}.hub.slots.slotKeys`,
  );
  const slots = layout.hub.slots.map((slot, index) => {
    const slotPath = `${path}.hub.slots[${index}]`;
    const room = requireRoom(
      slot.roomGameName,
      layout.biomeStepKey,
      rooms,
      `${slotPath}.roomGameName`,
    );
    if (room.mode.kind !== 'authored') {
      fail(`${slotPath}.roomGameName`, `${room.gameName} must be authored`);
    }
    return Object.freeze({
      slotKey: slotKeys[index] as string,
      roomGameName: room.gameName,
    });
  });
  if (slots.length === 0) {
    fail(`${path}.hub.slots`, 'must not be empty');
  }
  const min = requirePositiveInteger(layout.hub.openCount.min, `${path}.hub.openCount.min`);
  const max = requirePositiveInteger(layout.hub.openCount.max, `${path}.hub.openCount.max`);
  if (max < min || max > slots.length) {
    fail(`${path}.hub.openCount.max`, 'must be between min and the declared slot count');
  }
  const requiredVisits = requirePositiveInteger(
    layout.hub.requiredVisits,
    `${path}.hub.requiredVisits`,
  );
  if (requiredVisits > min) {
    fail(`${path}.hub.requiredVisits`, 'must not exceed the minimum open slot count');
  }
  const terminal = normalizeTerminal(
    layout.terminal,
    layout.biomeStepKey,
    rooms,
    `${path}.terminal`,
  );
  if (terminal.kind !== 'fixedAuthoredSlot') {
    fail(`${path}.terminal.kind`, 'HubBiome requires a fixed authored terminal slot');
  }
  if (
    entries.some(
      (entry) => entry.kind === 'fixedAuthoredSlot' && entry.slotKey === terminal.slotKey,
    )
  ) {
    fail(`${path}.terminal.slotKey`, `duplicates fixed authored slot ${terminal.slotKey}`);
  }
  return Object.freeze({
    biomeStepKey: layout.biomeStepKey,
    kind: 'HubBiome',
    entries,
    hub: Object.freeze({
      roomGameName: hubRoom.gameName,
      slots: Object.freeze(slots),
      openCount: Object.freeze({ min, max }),
      requiredVisits,
      restoreRoomGameName: restoreRoom.gameName,
      rewardStorePolicy: normalizeRewardStorePolicy(
        layout.hub.rewardStorePolicy,
        rewardStores,
        `${path}.hub.rewardStorePolicy`,
      ),
      fields: normalizeAuthoredFields(layout.hub.fields ?? [], `${path}.hub.fields`),
    }),
    terminal,
    completion: normalizeCompletion(
      layout.completion,
      layout.biomeStepKey,
      rooms,
      expectedRouteTransition,
      `${path}.completion`,
    ),
    fields: normalizeAuthoredFields(layout.fields ?? [], `${path}.fields`),
  });
}

export function normalizeBiomeLayouts(
  rawLayouts: readonly RawBiomeLayoutDeclaration[],
  routeTransitions: ReadonlyMap<string, 'nextBiome' | 'routeComplete'>,
  rooms: CatalogCollection<RoomDeclaration>,
  rewardStores: CatalogCollection<RewardStoreDeclaration>,
): CatalogCollection<BiomeLayout> {
  const layouts = rawLayouts.map((layout, layoutIndex): BiomeLayout => {
    const path = `biomeLayouts[${layoutIndex}]`;
    requireNonEmpty(layout.biomeStepKey, `${path}.biomeStepKey`);
    const expectedRouteTransition = routeTransitions.get(layout.biomeStepKey);
    if (expectedRouteTransition === undefined) {
      fail(`${path}.biomeStepKey`, `unknown biome step ${layout.biomeStepKey}`);
    }
    const receivedKind: unknown = (layout as { readonly kind?: unknown }).kind;
    if (layout.kind === 'LinearBiome') {
      return normalizeLinearLayout(
        layout,
        layoutIndex,
        rooms,
        rewardStores,
        expectedRouteTransition,
      );
    }
    if (layout.kind === 'HubBiome') {
      return normalizeHubLayout(layout, layoutIndex, rooms, rewardStores, expectedRouteTransition);
    }
    fail(`${path}.kind`, `unknown biome layout ${String(receivedKind)}`);
  });

  return createCollection(layouts, 'biomeLayouts', (layout) => layout.biomeStepKey, 'biomeStepKey');
}

export function validateDerivedRoomOwnership(
  rooms: CatalogCollection<RoomDeclaration>,
  layouts: CatalogCollection<BiomeLayout>,
): void {
  const owners = new Map<string, string>();
  const register = (gameName: string, owner: string) => {
    const previous = owners.get(gameName);
    if (previous !== undefined) {
      fail(owner, `${gameName} is already owned by ${previous}`);
    }
    owners.set(gameName, owner);
  };

  for (const layout of layouts.values) {
    const path = `biomeLayouts.${layout.biomeStepKey}`;
    if (layout.kind === 'LinearBiome' && layout.start.kind === 'fixedEntry') {
      register(layout.start.roomGameName, `${path}.start`);
    }
    for (const [index, entry] of layout.entries.entries()) {
      if (entry.kind === 'fixedEntry') {
        register(entry.roomGameName, `${path}.entries[${index}]`);
      }
    }
    if (layout.kind === 'HubBiome') {
      register(layout.hub.roomGameName, `${path}.hub`);
    }
    for (const [index, completion] of layout.completion.rooms.entries()) {
      register(completion.roomGameName, `${path}.completion.rooms[${index}]`);
    }
  }

  for (const [index, room] of rooms.values.entries()) {
    if (room.mode.kind === 'derived' && !owners.has(room.gameName)) {
      fail(`rooms[${index}].mode`, `${room.gameName} has no layout owner`);
    }
  }
}
