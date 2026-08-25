import type {
  AdditionalExitDeclaration,
  CatalogCollection,
  EncounterDefinition,
  EncounterEnvelope,
  EncounterSet,
  EncounterSlotBinding,
  ExitTypeDeclaration,
  PrebossBatchPolicy,
  RoomCaps,
  RoomDeclaration,
  RoomExit,
  RoomForce,
  RoomTemplateKey,
  RoomMode,
  RoomStructuralTag,
} from '@run-planner/engine/catalog-schema';
import type {
  EnteredRewardStoreHistoryPolicy,
  RewardProducerBinding,
} from '@run-planner/engine/reward-kernel';
import type { RequirementExpression } from '@run-planner/engine/requirements';
import type {
  RewardKernelCatalog,
  RewardStoreDeclaration,
} from '@run-planner/engine/reward-kernel';

import type {
  RawAdditionalExitDeclaration,
  RawEncounterSlotBinding,
  RawPrebossBatchPolicy,
  RawRoomDeclaration,
} from '../declarations';
import {
  createCollection,
  freezeUniqueStrings,
  requireNonEmpty,
  requireNonNegativeInteger,
  requirePositiveInteger,
} from './common';
import { fail } from './errors';

function normalizeBoonRarityOverride(
  raw: RawRoomDeclaration['boonRarityOverride'],
  path: string,
): RoomDeclaration['boonRarityOverride'] {
  if (raw === undefined) return undefined;
  for (const [key, amount] of Object.entries(raw)) {
    if (
      !['Rare', 'Epic', 'Duo', 'Legendary'].includes(key) ||
      typeof amount !== 'number' ||
      !Number.isFinite(amount)
    )
      fail(`${path}.${key}`, 'must be a finite supported boon rarity check');
  }
  return Object.freeze({ ...raw });
}
import { normalizeLocalChildren } from './descriptors';
import {
  normalizeRequirement,
  rejectEncounterHistoryRequirements,
  validateRequirementReferences,
} from './requirements';
import { normalizeRewardBinding, requireRewardStoreKey } from './rewardBindings';

function normalizeEnteredStoreHistory(
  policy: EnteredRewardStoreHistoryPolicy,
  stores: CatalogCollection<RewardStoreDeclaration>,
  path: string,
): EnteredRewardStoreHistoryPolicy {
  const receivedKind: unknown = (policy as { readonly kind?: unknown }).kind;
  if (policy.kind === 'none' || policy.kind === 'resolvedOffer') {
    return Object.freeze({ kind: policy.kind });
  }
  if (policy.kind !== 'fixed') {
    fail(`${path}.kind`, `unknown entered-store history policy ${String(receivedKind)}`);
  }
  return Object.freeze({
    kind: 'fixed',
    storeKey: requireRewardStoreKey(policy.storeKey, stores, `${path}.storeKey`),
  });
}

function normalizeCaps(caps: RoomCaps, path: string): RoomCaps {
  return Object.freeze({
    ...(caps.maxAppearancesThisBiome === undefined
      ? {}
      : {
          maxAppearancesThisBiome: requirePositiveInteger(
            caps.maxAppearancesThisBiome,
            `${path}.maxAppearancesThisBiome`,
          ),
        }),
    ...(caps.maxCreationsThisRun === undefined
      ? {}
      : {
          maxCreationsThisRun: requirePositiveInteger(
            caps.maxCreationsThisRun,
            `${path}.maxCreationsThisRun`,
          ),
        }),
    ...(caps.maxCreationsPerRoom === undefined
      ? {}
      : {
          maxCreationsPerRoom: requirePositiveInteger(
            caps.maxCreationsPerRoom,
            `${path}.maxCreationsPerRoom`,
          ),
        }),
  });
}

function normalizeResourcePointSupport(
  raw: RawRoomDeclaration,
  path: string,
): RoomDeclaration['resourcePointSupport'] {
  const support = raw.resourcePointSupport;
  if (support === undefined)
    fail(`${path}.resourcePointSupport`, 'must declare source-backed resource support');
  const families = ['Pickaxe', 'Exorcism', 'Shovel', 'Fishing'] as const;
  const known = new Set(families);
  const supportKeys = new Set(['families', 'capacity', 'ignoresBiomeLimit', 'rules']);
  if (Object.keys(support).some((key) => !supportKeys.has(key))) {
    fail(`${path}.resourcePointSupport`, 'contains unknown field');
  }
  if (support.families.some((family) => !known.has(family)))
    fail(`${path}.resourcePointSupport.families`, 'contains unknown family');
  if (new Set(support.families).size !== support.families.length)
    fail(`${path}.resourcePointSupport.families`, 'must not contain duplicate families');
  if (support.capacity !== 'simpleComplex' && support.capacity !== 'allTools')
    fail(`${path}.resourcePointSupport.capacity`, 'must be simpleComplex or allTools');
  if (support.ignoresBiomeLimit !== undefined && support.ignoresBiomeLimit !== true)
    fail(`${path}.resourcePointSupport.ignoresBiomeLimit`, 'must be true when present');
  if (
    Object.keys(support.rules).length !== families.length ||
    families.some((family) => !(family in support.rules))
  ) {
    fail(`${path}.resourcePointSupport.rules`, 'must contain exactly every resource family');
  }
  const rules: Record<
    string,
    RoomDeclaration['resourcePointSupport']['rules'][(typeof families)[number]]
  > = {};
  for (const family of families) {
    const rule = support.rules[family];
    const ruleKeys = new Set([
      'grantedTraitKey',
      'element',
      'sameFamilyLookback',
      'crossFamilyLookback',
    ]);
    if (Object.keys(rule ?? {}).some((key) => !ruleKeys.has(key))) {
      fail(`${path}.resourcePointSupport.rules.${family}`, 'contains unknown field');
    }
    if (
      rule === undefined ||
      typeof rule.grantedTraitKey !== 'string' ||
      rule.grantedTraitKey.trim() === ''
    )
      fail(`${path}.resourcePointSupport.rules.${family}`, 'must declare a granted trait key');
    if (!['Fire', 'Air', 'Earth', 'Water'].includes(rule.element))
      fail(`${path}.resourcePointSupport.rules.${family}.element`, 'must be a supported element');
    if (!Number.isInteger(rule.sameFamilyLookback) || rule.sameFamilyLookback < 0)
      fail(
        `${path}.resourcePointSupport.rules.${family}.sameFamilyLookback`,
        'must be a non-negative integer',
      );
    const cross = rule.crossFamilyLookback;
    if (
      cross === null ||
      typeof cross !== 'object' ||
      Array.isArray(cross) ||
      Object.keys(cross).length !== families.length ||
      Object.keys(cross).some((key) => !known.has(key as (typeof families)[number])) ||
      families.some((key) => !(key in cross))
    )
      fail(
        `${path}.resourcePointSupport.rules.${family}.crossFamilyLookback`,
        'must contain exactly every resource family',
      );
    const crossFamilyLookback: Record<string, number> = {};
    for (const other of families) {
      const value = cross[other];
      if (!Number.isInteger(value) || value < 0)
        fail(
          `${path}.resourcePointSupport.rules.${family}.crossFamilyLookback.${other}`,
          'must be a non-negative integer',
        );
      crossFamilyLookback[other] = value;
    }
    rules[family] = Object.freeze({
      grantedTraitKey: rule.grantedTraitKey,
      element: rule.element,
      sameFamilyLookback: rule.sameFamilyLookback,
      crossFamilyLookback: Object.freeze(crossFamilyLookback),
    });
  }
  return Object.freeze({
    families: Object.freeze([...support.families]),
    capacity: support.capacity,
    rules: Object.freeze(rules),
    ...(support.ignoresBiomeLimit === true ? { ignoresBiomeLimit: true } : {}),
  });
}

const roomTemplateKinds = {
  Anomaly: 'Combat',
  Chaos: 'Combat',
  ContractBoss: 'Boss',
  Devotion: 'Devotion',
  EphyraCombat: 'Combat',
  EphyraSideRoom: 'Combat',
  ClockworkCombat: 'Combat',
  FixedIntro: 'Intro',
  FixedOpening: 'Opening',
  FixedPreHub: 'PreHub',
  FieldsCombat: 'Combat',
  Fountain: 'Reprieve',
  Miniboss: 'Miniboss',
  RewardlessCombat: 'Combat',
  Shop: 'Shop',
  Preboss: 'Preboss',
  ShipCombat: 'Combat',
  StandardCombat: 'Combat',
  Story: 'Story',
} as const satisfies Readonly<Record<RoomTemplateKey, RoomDeclaration['kind']>>;

const roomTemplateRewardKinds = {
  Anomaly: 'countedChoice',
  Chaos: 'fixed',
  ContractBoss: 'fixed',
  Devotion: 'fixed',
  EphyraCombat: 'countedChoice',
  EphyraSideRoom: 'countedChoice',
  ClockworkCombat: 'countedChoice',
  FixedIntro: 'none',
  FixedOpening: 'countedChoice',
  FixedPreHub: 'countedChoice',
  FieldsCombat: 'none',
  Fountain: 'countedChoice',
  Miniboss: 'countedChoice',
  RewardlessCombat: 'none',
  Shop: 'shop',
  Preboss: 'shop',
  ShipCombat: 'none',
  StandardCombat: 'countedChoice',
  Story: 'fixed',
} as const satisfies Readonly<Record<RoomTemplateKey, RewardProducerBinding['kind']>>;

function validateMode(room: RawRoomDeclaration, path: string): RoomMode {
  const receivedModeKind: unknown = (room.mode as { readonly kind?: unknown } | undefined)?.kind;
  if (room.mode?.kind === 'derived') {
    const classification = room.mode.classification;
    if (classification !== 'hub') {
      fail(
        `${path}.mode.classification`,
        `unknown derived classification ${String(classification)}`,
      );
    }
    if (room.prebossBatchPolicy !== undefined) {
      fail(`${path}.prebossBatchPolicy`, 'is only valid for authored Preboss rooms');
    }
    return Object.freeze({ kind: 'derived', classification });
  }
  if (room.mode?.kind === 'automatic') {
    const role = room.mode.role;
    const expectedKind = role === 'boss' ? 'Boss' : role === 'postboss' ? 'PostBoss' : undefined;
    if (expectedKind === undefined)
      fail(`${path}.mode.role`, `unknown automatic role ${String(role)}`);
    if (room.kind !== expectedKind)
      fail(`${path}.kind`, `${role} automatic room requires ${expectedKind}`);
    if (room.incomingReward.kind !== 'none')
      fail(`${path}.incomingReward.kind`, 'automatic rooms have no incoming reward');
    return Object.freeze({ kind: 'automatic', role });
  }
  if (room.mode?.kind !== 'authored') {
    fail(`${path}.mode.kind`, `unknown room mode ${String(receivedModeKind)}`);
  }
  const templateKey = room.mode.templateKey;
  if (!Object.hasOwn(roomTemplateKinds, templateKey)) {
    fail(`${path}.mode.templateKey`, `unknown room template ${String(templateKey)}`);
  }
  const expectedKind = roomTemplateKinds[templateKey];
  if (room.kind !== expectedKind) {
    fail(`${path}.kind`, `${templateKey} requires room kind ${expectedKind}`);
  }
  const expectedRewardKind = roomTemplateRewardKinds[templateKey];
  if (room.incomingReward.kind !== expectedRewardKind) {
    fail(
      `${path}.incomingReward.kind`,
      `${templateKey} requires reward producer ${expectedRewardKind}`,
    );
  }
  if (templateKey === 'Preboss' && room.prebossBatchPolicy === undefined) {
    fail(`${path}.prebossBatchPolicy`, 'is required by Preboss');
  }
  if (templateKey !== 'Preboss' && room.prebossBatchPolicy !== undefined) {
    fail(`${path}.prebossBatchPolicy`, 'is only valid for Preboss');
  }
  return Object.freeze({ kind: 'authored', templateKey });
}

const structuralTags = new Set<RoomStructuralTag>(['Indoor', 'Outdoor']);
const supportedRoomSetKeys = new Set([
  'F',
  'G',
  'H',
  'I',
  'N',
  'O',
  'P',
  'Q',
  'Anomaly',
  'C',
  'Chaos',
]);

function normalizeStructuralTags(
  rawTags: readonly RoomStructuralTag[],
  path: string,
): readonly RoomStructuralTag[] {
  const tags = freezeUniqueStrings(rawTags, path);
  for (const [index, tag] of tags.entries()) {
    if (!structuralTags.has(tag as RoomStructuralTag)) {
      fail(`${path}[${index}]`, `unknown structural tag ${tag}`);
    }
  }
  return tags as readonly RoomStructuralTag[];
}

function normalizePrebossBatchPolicy(
  raw: RawPrebossBatchPolicy,
  rewards: RewardKernelCatalog,
  path: string,
): PrebossBatchPolicy {
  if (raw.kind === 'retainNormalPeers') {
    return Object.freeze({ kind: 'retainNormalPeers' });
  }
  if (raw.kind !== 'takeOverNormalDoors') {
    fail(
      `${path}.kind`,
      `unknown Preboss batch policy ${String((raw as { kind?: unknown }).kind)}`,
    );
  }
  if (raw.remainingOffers.kind === 'none') {
    return Object.freeze({
      kind: 'takeOverNormalDoors',
      remainingOffers: Object.freeze({ kind: 'none' }),
    });
  }
  if (raw.remainingOffers.kind !== 'counted') {
    fail(
      `${path}.remainingOffers.kind`,
      `unknown remaining Preboss offer policy ${String(
        (raw.remainingOffers as { kind?: unknown }).kind,
      )}`,
    );
  }
  const reward = normalizeRewardBinding(
    raw.remainingOffers.reward,
    rewards,
    `${path}.remainingOffers.reward`,
  );
  if (reward.kind !== 'countedChoice') {
    fail(`${path}.remainingOffers.reward.kind`, 'must be countedChoice');
  }
  return Object.freeze({
    kind: 'takeOverNormalDoors',
    remainingOffers: Object.freeze({ kind: 'counted', reward }),
  });
}

function normalizeForce(force: RoomForce, rewards: RewardKernelCatalog, path: string): RoomForce {
  if (force.kind === 'always') {
    return Object.freeze({ kind: 'always' });
  }
  if (force.kind === 'requirement') {
    const requirement = normalizeRequirement(force.requirement, `${path}.requirement`);
    validateRequirementReferences(requirement, rewards.rewardTypes, `${path}.requirement`);
    rejectEncounterHistoryRequirements(requirement, `${path}.requirement`);
    return Object.freeze({ kind: 'requirement', requirement });
  }
  if (force.kind !== 'depthWindow') {
    fail(`${path}.kind`, `unknown room force ${String((force as { kind?: unknown }).kind)}`);
  }
  const start = requireNonNegativeInteger(force.start, `${path}.start`);
  const deadline = requireNonNegativeInteger(force.deadline, `${path}.deadline`);
  if (deadline < start) {
    fail(`${path}.deadline`, 'must be greater than or equal to start');
  }
  return Object.freeze({ kind: force.kind, axis: force.axis, start, deadline });
}

function validateContextRequirementReferences(
  requirement: RequirementExpression,
  rooms: CatalogCollection<RoomDeclaration>,
  encounterEnvelopes: CatalogCollection<EncounterEnvelope>,
  path: string,
): void {
  if (requirement.kind === 'all' || requirement.kind === 'any') {
    requirement.requirements.forEach((child, index) =>
      validateContextRequirementReferences(
        child,
        rooms,
        encounterEnvelopes,
        `${path}.requirements[${index}]`,
      ),
    );
    return;
  }
  if (requirement.kind === 'not') {
    validateContextRequirementReferences(
      requirement.requirement,
      rooms,
      encounterEnvelopes,
      `${path}.requirement`,
    );
    return;
  }
  if (requirement.kind === 'recordCount' && requirement.record === 'roomsEntered') {
    requirement.keys.forEach((gameName, index) => {
      if (rooms.byKey[gameName] === undefined) {
        fail(`${path}.keys[${index}]`, `unknown room ${gameName}`);
      }
    });
  }
  if (requirement.kind === 'distinctRecordKeyCount' && requirement.record === 'roomsEntered') {
    requirement.keys.forEach((gameName, index) => {
      if (rooms.byKey[gameName] === undefined) {
        fail(`${path}.keys[${index}]`, `unknown room ${gameName}`);
      }
    });
  }
  if (requirement.kind === 'currentBatchRoomCount') {
    requirement.roomGameNames.forEach((gameName, index) => {
      if (rooms.byKey[gameName] === undefined) {
        fail(`${path}.roomGameNames[${index}]`, `unknown room ${gameName}`);
      }
    });
  }
  if (requirement.kind === 'recentEnvelopeSlotCount') {
    const envelope = encounterEnvelopes.byKey[requirement.envelopeKey];
    if (envelope === undefined) {
      fail(`${path}.envelopeKey`, `unknown encounter envelope ${requirement.envelopeKey}`);
    }
    if (!envelope.slots.some((slot) => slot.key === requirement.slotKey)) {
      fail(`${path}.slotKey`, `unknown slot ${requirement.slotKey} in ${requirement.envelopeKey}`);
    }
  }
}

function normalizeEncounterSlotBindings(
  rawBindings: readonly RawEncounterSlotBinding[],
  envelope: EncounterEnvelope,
  definitions: CatalogCollection<EncounterDefinition>,
  sets: CatalogCollection<EncounterSet>,
  path: string,
): readonly EncounterSlotBinding[] {
  const bindings = rawBindings.map((raw, bindingIndex): EncounterSlotBinding => {
    const bindingPath = `${path}[${bindingIndex}]`;
    const receivedKind: unknown = (raw as { readonly kind?: unknown }).kind;
    const slotKey = requireNonEmpty(raw.slotKey, `${bindingPath}.slotKey`);
    if (!envelope.slots.some((slot) => slot.key === slotKey)) {
      fail(`${bindingPath}.slotKey`, `${slotKey} is not a slot in ${envelope.key}`);
    }
    if (raw.kind === 'set') {
      const encounterSetKey = requireNonEmpty(
        raw.encounterSetKey,
        `${bindingPath}.encounterSetKey`,
      );
      if (sets.byKey[encounterSetKey] === undefined) {
        fail(`${bindingPath}.encounterSetKey`, `unknown encounter set ${encounterSetKey}`);
      }
      return Object.freeze({ slotKey, kind: 'set', encounterSetKey });
    }
    if (raw.kind === 'fixed') {
      const encounterDefinitionKey = requireNonEmpty(
        raw.encounterDefinitionKey,
        `${bindingPath}.encounterDefinitionKey`,
      );
      if (definitions.byKey[encounterDefinitionKey] === undefined) {
        fail(
          `${bindingPath}.encounterDefinitionKey`,
          `unknown encounter definition ${encounterDefinitionKey}`,
        );
      }
      return Object.freeze({ slotKey, kind: 'fixed', encounterDefinitionKey });
    }
    fail(`${bindingPath}.kind`, `unknown encounter slot binding ${String(receivedKind)}`);
  });
  const seenSlots = new Set<string>();
  for (const [bindingIndex, binding] of bindings.entries()) {
    if (seenSlots.has(binding.slotKey)) {
      fail(`${path}[${bindingIndex}].slotKey`, `duplicates slot ${binding.slotKey}`);
    }
    seenSlots.add(binding.slotKey);
  }
  if (bindings.length !== envelope.slots.length) {
    fail(path, `must bind every slot in ${envelope.key} exactly once`);
  }
  for (const slot of envelope.slots) {
    if (!seenSlots.has(slot.key)) {
      fail(path, `is missing binding for ${envelope.key}.${slot.key}`);
    }
  }
  return Object.freeze(bindings);
}

function normalizeAdditionalExits(
  rawExits: readonly RawAdditionalExitDeclaration[],
  exitTypes: CatalogCollection<ExitTypeDeclaration>,
  rewards: RewardKernelCatalog,
  path: string,
): readonly AdditionalExitDeclaration[] {
  const keys = freezeUniqueStrings(
    rawExits.map((exit) => exit.key),
    `${path}.keys`,
  );
  return Object.freeze(
    rawExits.map((raw, index): AdditionalExitDeclaration => {
      const exitPath = `${path}[${index}]`;
      if (
        raw.kind !== 'zagreusContract' &&
        raw.kind !== 'naturalChaos' &&
        raw.kind !== 'sparkChaos'
      ) {
        fail(
          `${exitPath}.kind`,
          `unknown additional exit ${String((raw as { kind?: unknown }).kind)}`,
        );
      }
      const key = keys[index];
      const exitTypeKey = requireNonEmpty(raw.exitType, `${exitPath}.exitType`);
      const exitType = exitTypes.byKey[exitTypeKey];
      if (exitType === undefined) {
        fail(`${exitPath}.exitType`, `unknown physical exit type ${exitTypeKey}`);
      }
      if (raw.kind === 'naturalChaos' || raw.kind === 'sparkChaos') {
        const expectedKey = raw.kind;
        if (key !== expectedKey)
          fail(`${exitPath}.key`, `${raw.kind} exit key must be ${expectedKey}`);
        if (exitType.key !== 'ChaosExitDoor')
          fail(`${exitPath}.exitType`, `${raw.kind} exits must use ChaosExitDoor`);
        if (
          exitType.behavior.kind !== 'playerSelected' ||
          exitType.behavior.rewardPreview !== 'hidden'
        )
          fail(`${exitPath}.exitType`, `${raw.kind} exits must be player-selected and hidden`);
        if (raw.kind === 'sparkChaos')
          return Object.freeze({
            kind: 'sparkChaos' as const,
            key: 'sparkChaos' as const,
            physicalExit: Object.freeze({
              type: exitType.key,
              compatibilityPolicyKey: exitType.compatibilityPolicyKey,
              behavior: exitType.behavior,
            }),
          });
        if (key !== 'naturalChaos') {
          fail(`${exitPath}.key`, 'natural Chaos exit key must be naturalChaos');
        }
        if (exitType.key !== 'ChaosExitDoor') {
          fail(`${exitPath}.exitType`, 'natural Chaos exits must use ChaosExitDoor');
        }
        if (
          exitType.behavior.kind !== 'playerSelected' ||
          exitType.behavior.rewardPreview !== 'hidden'
        ) {
          fail(`${exitPath}.exitType`, 'natural Chaos exits must be player-selected and hidden');
        }
        const requirement =
          raw.requirement === undefined
            ? undefined
            : normalizeRequirement(raw.requirement, `${exitPath}.requirement`);
        if (requirement !== undefined) {
          validateRequirementReferences(
            requirement,
            rewards.rewardTypes,
            `${exitPath}.requirement`,
          );
          rejectEncounterHistoryRequirements(requirement, `${exitPath}.requirement`);
        }
        return Object.freeze({
          kind: 'naturalChaos',
          key: 'naturalChaos',
          physicalExit: Object.freeze({
            type: exitType.key,
            compatibilityPolicyKey: exitType.compatibilityPolicyKey,
            behavior: exitType.behavior,
          }),
          ...(requirement === undefined ? {} : { requirement }),
        });
      }
      if (key !== 'zagreusContract') {
        fail(`${exitPath}.key`, 'Zagreus contract exit key must be zagreusContract');
      }
      if (
        exitType.behavior.kind !== 'playerSelected' ||
        exitType.behavior.rewardPreview !== 'hidden'
      ) {
        fail(`${exitPath}.exitType`, 'Zagreus contract exits must be player-selected and hidden');
      }
      const maxEnteredThisRoute = requireNonNegativeInteger(
        raw.maxEnteredThisRoute,
        `${exitPath}.maxEnteredThisRoute`,
      );
      if (maxEnteredThisRoute !== 0) {
        fail(
          `${exitPath}.maxEnteredThisRoute`,
          'Zagreus contract entry limit must be zero prior entries',
        );
      }
      return Object.freeze({
        kind: 'zagreusContract',
        key: 'zagreusContract',
        physicalExit: Object.freeze({
          type: exitType.key,
          compatibilityPolicyKey: exitType.compatibilityPolicyKey,
          behavior: exitType.behavior,
        }),
        targetRoomGameName: requireNonEmpty(
          raw.targetRoomGameName,
          `${exitPath}.targetRoomGameName`,
        ),
        maxEnteredThisRoute,
      });
    }),
  );
}

export function normalizeRooms(
  rawRooms: readonly RawRoomDeclaration[],
  rewards: RewardKernelCatalog,
  encounterEnvelopes: CatalogCollection<EncounterEnvelope>,
  encounterDefinitions: CatalogCollection<EncounterDefinition>,
  encounterSets: CatalogCollection<EncounterSet>,
  exitTypes: CatalogCollection<ExitTypeDeclaration>,
): CatalogCollection<RoomDeclaration> {
  const rooms = rawRooms.map((room, roomIndex): RoomDeclaration => {
    const path = `rooms[${roomIndex}]`;
    requireNonEmpty(room.gameName, `${path}.gameName`);
    requireNonEmpty(room.label, `${path}.label`);
    const roomSetKey = requireNonEmpty(room.roomSetKey, `${path}.roomSetKey`);
    if (!supportedRoomSetKeys.has(roomSetKey)) {
      fail(`${path}.roomSetKey`, `unknown room set ${roomSetKey}`);
    }
    if (room.structuralTags === undefined) {
      fail(`${path}.structuralTags`, 'is required');
    }
    if (room.blockGiftBoons !== undefined && typeof room.blockGiftBoons !== 'boolean') {
      fail(`${path}.blockGiftBoons`, 'must be a boolean when declared');
    }
    if (room.blocksGorgon !== undefined && typeof room.blocksGorgon !== 'boolean') {
      fail(`${path}.blocksGorgon`, 'must be a boolean when declared');
    }
    if (typeof room.advancesExperimentalHammerUses !== 'boolean') {
      fail(`${path}.advancesExperimentalHammerUses`, 'must be a boolean');
    }
    if (room.skipRoomsPerUpgrade !== undefined && typeof room.skipRoomsPerUpgrade !== 'boolean') {
      fail(`${path}.skipRoomsPerUpgrade`, 'must be a boolean when declared');
    }
    const mode = validateMode(room, path);
    const encounterEnvelopeKey = requireNonEmpty(
      room.encounterEnvelopeKey,
      `${path}.encounterEnvelopeKey`,
    );
    const encounterEnvelope = encounterEnvelopes.byKey[encounterEnvelopeKey];
    if (encounterEnvelope === undefined) {
      fail(`${path}.encounterEnvelopeKey`, `unknown encounter envelope ${encounterEnvelopeKey}`);
    }
    const encounterSlotBindings = normalizeEncounterSlotBindings(
      room.encounterSlotBindings,
      encounterEnvelope,
      encounterDefinitions,
      encounterSets,
      `${path}.encounterSlotBindings`,
    );
    if (room.exits.length === 0 && !(mode.kind === 'derived' && mode.classification === 'hub')) {
      fail(`${path}.exits`, 'must not be empty');
    }
    const exits = room.exits.map((exit, exitIndex): RoomExit => {
      const exitPath = `${path}.exits[${exitIndex}]`;
      if (exit.index !== exitIndex + 1) {
        fail(`${exitPath}.index`, `must equal physical exit index ${exitIndex + 1}`);
      }
      const type = requireNonEmpty(exit.type, `${exitPath}.type`);
      const exitType = exitTypes.byKey[type];
      if (exitType === undefined) {
        fail(`${exitPath}.type`, `unknown physical exit type ${type}`);
      }
      return Object.freeze({
        index: exit.index,
        type,
        compatibilityPolicyKey: exitType.compatibilityPolicyKey,
        behavior: exitType.behavior,
      });
    });
    const automaticExits = exits.filter(
      (exit) => exit.behavior.kind === 'automaticHostContinuation',
    );
    const requiresAutomaticHostExit =
      mode.kind === 'authored' &&
      (mode.templateKey === 'Anomaly' || mode.templateKey === 'ContractBoss');
    if (
      requiresAutomaticHostExit
        ? exits.length !== 1 || automaticExits.length !== 1
        : automaticExits.length !== 0
    ) {
      fail(
        `${path}.exits`,
        requiresAutomaticHostExit
          ? `${room.gameName} must declare exactly one automatic host continuation`
          : 'automatic host continuation is not supported by this room',
      );
    }
    if (mode.kind === 'authored' && mode.templateKey === 'Anomaly' && roomSetKey !== 'Anomaly') {
      fail(`${path}.roomSetKey`, 'Anomaly template requires the Anomaly room set');
    }
    if (mode.kind === 'authored' && mode.templateKey === 'ContractBoss' && roomSetKey !== 'C') {
      fail(`${path}.roomSetKey`, 'ContractBoss template requires the C room set');
    }
    if (mode.kind === 'authored' && mode.templateKey === 'Chaos' && roomSetKey !== 'Chaos') {
      fail(`${path}.roomSetKey`, 'Chaos template requires the Chaos room set');
    }
    if (roomSetKey === 'Anomaly') {
      if (mode.kind !== 'authored' || mode.templateKey !== 'Anomaly') {
        fail(`${path}.roomSetKey`, 'Anomaly room set requires authored Anomaly rooms');
      }
    }
    if (roomSetKey === 'C') {
      if (mode.kind !== 'authored' || mode.templateKey !== 'ContractBoss') {
        fail(`${path}.roomSetKey`, 'C room set requires authored ContractBoss rooms');
      }
    }
    if (roomSetKey === 'Chaos') {
      if (mode.kind !== 'authored' || mode.templateKey !== 'Chaos') {
        fail(`${path}.roomSetKey`, 'Chaos room set requires authored Chaos rooms');
      }
      if (
        exits.length !== 1 ||
        exits[0]?.type !== 'ChaosReturnExitDoor' ||
        exits[0].behavior.kind !== 'playerSelected' ||
        exits[0].behavior.rewardPreview !== 'visible'
      ) {
        fail(
          `${path}.exits`,
          'Chaos rooms require one visible player-selected ChaosReturnExitDoor',
        );
      }
      const encounter = encounterSlotBindings[0];
      if (
        encounterEnvelopeKey !== 'SingleEncounter' ||
        encounterSlotBindings.length !== 1 ||
        encounter?.slotKey !== 'Encounter' ||
        encounter.kind !== 'fixed' ||
        encounter.encounterDefinitionKey !== 'Empty_Chaos'
      ) {
        fail(`${path}.encounterSlotBindings`, 'Chaos rooms require fixed Empty_Chaos');
      }
      if (
        room.incomingReward.kind !== 'fixed' ||
        room.incomingReward.rewardType !== 'TrialUpgrade' ||
        room.incomingReward.producerLifecycleKey !== 'RoomReward'
      ) {
        fail(`${path}.incomingReward`, 'Chaos rooms require fixed TrialUpgrade RoomReward');
      }
    }
    const additionalExits = normalizeAdditionalExits(
      room.additionalExits ?? [],
      exitTypes,
      rewards,
      `${path}.additionalExits`,
    );
    if (
      additionalExits.length > 0 &&
      room.additionalExits?.some((exit) => exit.kind === 'zagreusContract') &&
      (room.kind !== 'Shop' || room.incomingReward.kind !== 'shop')
    ) {
      fail(`${path}.additionalExits`, 'additional Zagreus exits require a Shop room');
    }
    const eligibility =
      room.eligibility === undefined
        ? undefined
        : normalizeRequirement(room.eligibility, `${path}.eligibility`);
    if (eligibility !== undefined) {
      validateRequirementReferences(eligibility, rewards.rewardTypes, `${path}.eligibility`);
      rejectEncounterHistoryRequirements(eligibility, `${path}.eligibility`);
    }
    const incomingReward = normalizeRewardBinding(
      room.incomingReward,
      rewards,
      `${path}.incomingReward`,
    );
    const prebossBatchPolicy =
      room.prebossBatchPolicy === undefined
        ? undefined
        : normalizePrebossBatchPolicy(
            room.prebossBatchPolicy,
            rewards,
            `${path}.prebossBatchPolicy`,
          );
    const requiredObjectKeys = new Set<string>();
    const requiredObjects = room.requiredObjects?.map((object, objectIndex) => {
      const objectPath = `${path}.requiredObjects[${objectIndex}]`;
      if (object.key !== 'SoulPylon') {
        fail(`${objectPath}.key`, `unknown required room object ${String(object.key)}`);
      }
      if (object.spawnTiming !== 'roomEntry') {
        fail(`${objectPath}.spawnTiming`, `unknown spawn timing ${String(object.spawnTiming)}`);
      }
      if (object.completionRequirement !== 'destroyBeforeExit') {
        fail(
          `${objectPath}.completionRequirement`,
          `unknown completion requirement ${String(object.completionRequirement)}`,
        );
      }
      if (requiredObjectKeys.has(object.key)) {
        fail(`${objectPath}.key`, `duplicates ${object.key}`);
      }
      requiredObjectKeys.add(object.key);
      return Object.freeze({
        key: 'SoulPylon' as const,
        spawnTiming: 'roomEntry' as const,
        completionRequirement: 'destroyBeforeExit' as const,
      });
    });
    if (requiredObjects !== undefined && requiredObjects.length === 0) {
      fail(`${path}.requiredObjects`, 'must not be empty when declared');
    }
    const forcedRewardStoreKey =
      room.forcedRewardStoreKey === undefined
        ? undefined
        : requireRewardStoreKey(
            room.forcedRewardStoreKey,
            rewards.stores,
            `${path}.forcedRewardStoreKey`,
          );
    const individualRewardStoreKey =
      room.individualRewardStoreKey === undefined
        ? undefined
        : requireRewardStoreKey(
            room.individualRewardStoreKey,
            rewards.stores,
            `${path}.individualRewardStoreKey`,
          );
    for (const [field, storeKey] of [
      ['forcedRewardStoreKey', forcedRewardStoreKey],
      ['individualRewardStoreKey', individualRewardStoreKey],
    ] as const) {
      if (
        storeKey !== undefined &&
        incomingReward.kind === 'countedChoice' &&
        !incomingReward.storeKeys.includes(storeKey)
      ) {
        fail(`${path}.${field}`, `${storeKey} is not accepted by the incoming producer`);
      }
      const remainingReward =
        prebossBatchPolicy?.kind === 'takeOverNormalDoors' &&
        prebossBatchPolicy.remainingOffers.kind === 'counted'
          ? prebossBatchPolicy.remainingOffers.reward
          : undefined;
      if (storeKey !== undefined && !remainingReward?.storeKeys.includes(storeKey)) {
        if (remainingReward !== undefined) {
          fail(`${path}.${field}`, `${storeKey} is not accepted by the remaining-offer producer`);
        }
      }
    }
    const infernalContractReward = (() => {
      const raw = room.infernalContractReward;
      if (raw === undefined) return undefined;
      if (
        room.kind !== 'Preboss' ||
        room.mode.kind !== 'authored' ||
        room.mode.templateKey !== 'Preboss' ||
        incomingReward.kind !== 'shop'
      )
        fail(`${path}.infernalContractReward`, 'requires an authored Preboss Shop');
      if (raw.entryKey !== 'infernalContractReward')
        fail(`${path}.infernalContractReward.entryKey`, 'must be infernalContractReward');
      const expected = [
        'BlindBoxLoot',
        'StackUpgradeBig',
        'StackUpgrade',
        'TalentBigDrop',
        'TalentDrop',
      ] as const;
      if (
        raw.rewardTypes.length !== expected.length ||
        expected.some((rewardType, index) => raw.rewardTypes[index] !== rewardType)
      )
        fail(`${path}.infernalContractReward.rewardTypes`, 'must match ZagPedestalOptions');
      const lifecycle = rewards.producerLifecycles.byKey[raw.producerLifecycleKey];
      if (
        lifecycle === undefined ||
        expected.some((rewardType) => lifecycle.rewardTypes.byKey[rewardType] === undefined)
      )
        fail(
          `${path}.infernalContractReward.producerLifecycleKey`,
          'must support the pedestal pool',
        );
      return Object.freeze({
        entryKey: 'infernalContractReward' as const,
        producerLifecycleKey: lifecycle.key,
        rewardTypes: Object.freeze([...expected]) as unknown as readonly [
          string,
          string,
          string,
          string,
          string,
        ],
      });
    })();
    const fieldsOptionalRewards = (() => {
      const raw = room.fieldsOptionalRewards;
      if (raw === undefined) return undefined;
      if (
        room.mode.kind !== 'authored' ||
        room.mode.templateKey !== 'FieldsCombat' ||
        raw.key !== 'optionalRewards'
      ) {
        fail(`${path}.fieldsOptionalRewards`, 'requires an authored FieldsCombat room');
      }
      const optionalRewardCapacity = requirePositiveInteger(
        raw.optionalRewardCapacity,
        `${path}.fieldsOptionalRewards.optionalRewardCapacity`,
      );
      if (optionalRewardCapacity < 2 || optionalRewardCapacity > 4) {
        fail(
          `${path}.fieldsOptionalRewards.optionalRewardCapacity`,
          'must be within the supported 2..4 map capacity',
        );
      }
      const reward = normalizeRewardBinding(
        raw.reward,
        rewards,
        `${path}.fieldsOptionalRewards.reward`,
      );
      if (
        reward.kind !== 'countedChoice' ||
        reward.storeKeys.length !== 1 ||
        reward.storeKeys[0] !== 'FieldsOptionalRewards'
      ) {
        fail(
          `${path}.fieldsOptionalRewards.reward.storeKeys`,
          'must contain only FieldsOptionalRewards',
        );
      }
      return Object.freeze({
        key: 'optionalRewards' as const,
        optionalRewardCapacity,
        slotKeys: Object.freeze(
          Array.from({ length: optionalRewardCapacity }, (_, index) => `optional${index + 1}`),
        ),
        reward,
      });
    })();
    const boonRarityOverride = normalizeBoonRarityOverride(
      room.boonRarityOverride,
      `${path}.boonRarityOverride`,
    );
    const purgingPool =
      room.purgingPool === undefined
        ? undefined
        : (() => {
            const slotKeys = room.purgingPool.slotKeys;
            if (
              slotKeys.length !== 3 ||
              slotKeys[0] !== 'left' ||
              slotKeys[1] !== 'middle' ||
              slotKeys[2] !== 'right'
            ) {
              fail(`${path}.purgingPool.slotKeys`, 'must be left, middle, right');
            }
            return Object.freeze({
              slotKeys: Object.freeze([...slotKeys]) as readonly ['left', 'middle', 'right'],
            });
          })();
    const challengeSwitchAnchorCount = room.challengeSwitchAnchorCount;
    if (
      challengeSwitchAnchorCount !== undefined &&
      (!Number.isInteger(challengeSwitchAnchorCount) || challengeSwitchAnchorCount < 0)
    )
      fail(`${path}.challengeSwitchAnchorCount`, 'must be a non-negative integer');
    const secretPointAnchorCount = room.secretPointAnchorCount;
    if (
      secretPointAnchorCount !== undefined &&
      (!Number.isInteger(secretPointAnchorCount) || secretPointAnchorCount < 0)
    )
      fail(`${path}.secretPointAnchorCount`, 'must be a non-negative integer');
    const surfaceShop =
      room.surfaceShop === undefined
        ? undefined
        : (() => {
            if (room.surfaceShop.profileKey !== 'SurfaceShop')
              fail(`${path}.surfaceShop.profileKey`, 'must be SurfaceShop');
            if (
              !Number.isFinite(room.surfaceShop.spawnChance) ||
              room.surfaceShop.spawnChance < 0 ||
              room.surfaceShop.spawnChance > 1
            )
              fail(`${path}.surfaceShop.spawnChance`, 'must be a probability from 0 through 1');
            return Object.freeze({
              profileKey: 'SurfaceShop' as const,
              spawnChance: room.surfaceShop.spawnChance,
              forced: room.surfaceShop.forced === true,
            });
          })();
    const roomShop =
      room.roomShop === undefined
        ? undefined
        : (() => {
            if (room.roomShop.profileKey !== 'RoomShop')
              fail(`${path}.roomShop.profileKey`, 'must be RoomShop');
            if (
              !Number.isFinite(room.roomShop.spawnChance) ||
              room.roomShop.spawnChance < 0 ||
              room.roomShop.spawnChance > 1
            )
              fail(`${path}.roomShop.spawnChance`, 'must be a probability from 0 through 1');
            return Object.freeze({
              profileKey: 'RoomShop' as const,
              spawnChance: room.roomShop.spawnChance,
              forced: room.roomShop.forced === true,
            });
          })();

    return Object.freeze({
      gameName: room.gameName,
      label: room.label,
      roomSetKey,
      kind: room.kind,
      mode,
      ...(room.lifecycleProfileKey === undefined
        ? {}
        : {
            lifecycleProfileKey: requireNonEmpty(
              room.lifecycleProfileKey,
              `${path}.lifecycleProfileKey`,
            ),
          }),
      structuralTags: normalizeStructuralTags(room.structuralTags, `${path}.structuralTags`),
      exits: Object.freeze(exits),
      additionalExits,
      incomingReward,
      blockGiftBoons: room.blockGiftBoons ?? false,
      hasKeepsakeRack: room.hasKeepsakeRack ?? false,
      hasRequiredFountain: room.hasRequiredFountain ?? false,
      ...(challengeSwitchAnchorCount === undefined ? {} : { challengeSwitchAnchorCount }),
      ...(purgingPool === undefined ? {} : { purgingPool }),
      ...(surfaceShop === undefined ? {} : { surfaceShop }),
      ...(roomShop === undefined ? {} : { roomShop }),
      ...(secretPointAnchorCount === undefined ? {} : { secretPointAnchorCount }),
      blocksGorgon: room.blocksGorgon ?? false,
      ...(boonRarityOverride === undefined ? {} : { boonRarityOverride }),
      ...(prebossBatchPolicy === undefined ? {} : { prebossBatchPolicy }),
      encounterEnvelopeKey,
      advancesExperimentalHammerUses: room.advancesExperimentalHammerUses,
      skipRoomsPerUpgrade: room.skipRoomsPerUpgrade ?? false,
      encounterSlotBindings,
      ...(forcedRewardStoreKey === undefined ? {} : { forcedRewardStoreKey }),
      ...(individualRewardStoreKey === undefined ? {} : { individualRewardStoreKey }),
      enteredRewardStoreHistory: normalizeEnteredStoreHistory(
        room.enteredRewardStoreHistory,
        rewards.stores,
        `${path}.enteredRewardStoreHistory`,
      ),
      counters: Object.freeze({
        biomeDepthCache: requireNonNegativeInteger(
          room.counters.biomeDepthCache,
          `${path}.counters.biomeDepthCache`,
        ),
        roomHistoryOrdinal: requirePositiveInteger(
          room.counters.roomHistoryOrdinal,
          `${path}.counters.roomHistoryOrdinal`,
        ),
      }),
      caps: normalizeCaps(room.caps, `${path}.caps`),
      resourcePointSupport: normalizeResourcePointSupport(room, path),
      ...(eligibility === undefined ? {} : { eligibility }),
      ...(room.force === undefined
        ? {}
        : { force: normalizeForce(room.force, rewards, `${path}.force`) }),
      ...(requiredObjects === undefined ? {} : { requiredObjects: Object.freeze(requiredObjects) }),
      localChildren: normalizeLocalChildren(
        room.localChildren ?? [],
        `${path}.localChildren`,
        (binding, bindingPath) => {
          const normalized = normalizeRewardBinding(binding, rewards, bindingPath);
          if (normalized.kind !== 'countedChoice') {
            fail(`${bindingPath}.kind`, 'bounded reward slots require countedChoice');
          }
          return normalized;
        },
      ),
      ...(fieldsOptionalRewards === undefined ? {} : { fieldsOptionalRewards }),
      ...(infernalContractReward === undefined ? {} : { infernalContractReward }),
    });
  });

  const collection = createCollection(rooms, 'rooms', (room) => room.gameName, 'gameName');
  const expectedContractDestinations = new Set([
    'F_PreBoss01',
    'G_PreBoss01',
    'H_PreBoss01',
    'I_PreBoss02',
    'N_PreBoss01',
    'O_PreBoss01',
    'P_PreBoss01',
    'Q_PreBoss01',
  ]);
  for (const room of collection.values) {
    if (
      expectedContractDestinations.has(room.gameName) !==
      (room.infernalContractReward !== undefined)
    )
      fail(
        `rooms.${room.gameName}.infernalContractReward`,
        'must match the supported qualifying destination matrix',
      );
  }
  collection.values.forEach((room, roomIndex) => {
    room.additionalExits.forEach((exit, exitIndex) => {
      if (exit.kind !== 'zagreusContract') return;
      const target = collection.byKey[exit.targetRoomGameName];
      const path = `rooms[${roomIndex}].additionalExits[${exitIndex}].targetRoomGameName`;
      if (target === undefined) {
        fail(path, `unknown room ${exit.targetRoomGameName}`);
      }
      if (
        target.roomSetKey !== 'C' ||
        target.kind !== 'Boss' ||
        target.mode.kind !== 'authored' ||
        target.mode.templateKey !== 'ContractBoss' ||
        target.exits.length !== 1 ||
        target.exits[0]?.behavior.kind !== 'automaticHostContinuation'
      ) {
        fail(
          path,
          'Zagreus contract target must be an authored C ContractBoss with automatic host return',
        );
      }
    });
  });
  collection.values.forEach((room, roomIndex) => {
    const path = `rooms[${roomIndex}]`;
    if (room.mode.kind === 'authored' && room.mode.templateKey === 'Preboss') {
      if (room.prebossBatchPolicy?.kind === 'retainNormalPeers') {
        if (room.caps.maxCreationsPerRoom !== 1) {
          fail(
            `${path}.caps.maxCreationsPerRoom`,
            'retainNormalPeers requires maxCreationsPerRoom: 1',
          );
        }
      }
    }
    if (room.mode.kind === 'authored' && room.mode.templateKey === 'FieldsCombat') {
      if (room.individualRewardStoreKey === undefined) {
        fail(`${path}.individualRewardStoreKey`, 'is required by FieldsCombat');
      }
      if (room.fieldsOptionalRewards === undefined) {
        fail(`${path}.fieldsOptionalRewards`, 'FieldsCombat requires optional reward capacity');
      }
      if (room.localChildren.length !== 1) {
        fail(`${path}.localChildren`, 'FieldsCombat requires exactly one cages descriptor');
      }
      const cages = room.localChildren[0];
      if (cages?.kind !== 'boundedRewardSlots' || cages.key !== 'cages') {
        fail(`${path}.localChildren[0]`, 'FieldsCombat requires boundedRewardSlots named cages');
      }
      if (
        cages.slotKeys.length !== 3 ||
        cages.slotKeys[0] !== 'cage1' ||
        cages.slotKeys[1] !== 'cage2' ||
        cages.slotKeys[2] !== 'cage3'
      ) {
        fail(`${path}.localChildren[0].slotKeys`, 'FieldsCombat requires cage1, cage2, cage3');
      }
      if (cages.fields.length !== 0) {
        fail(`${path}.localChildren[0].fields`, 'FieldsCombat cages do not own authored fields');
      }
      if (
        cages.reward.storeKeys.length !== 1 ||
        cages.reward.storeKeys[0] !== room.individualRewardStoreKey
      ) {
        fail(
          `${path}.localChildren[0].reward.storeKeys`,
          `must contain only the FieldsCombat individual store ${room.individualRewardStoreKey}`,
        );
      }
      const envelope = encounterEnvelopes.byKey[room.encounterEnvelopeKey];
      const expectedSlots = ['Passive', 'Cage01', 'Cage02', 'Cage03'];
      if (
        envelope?.key !== 'FieldsEncounter' ||
        envelope.slots.length !== expectedSlots.length ||
        envelope.slots.some((slot, index) => slot.key !== expectedSlots[index]) ||
        envelope.slots[0]?.activation !== 'always' ||
        envelope.slots.slice(1).some((slot) => slot.activation !== 'templateControlled') ||
        envelope.slots[0]?.rewardAttachment !== undefined ||
        envelope.slots.slice(1).some((slot, index) => {
          const attachment = slot.rewardAttachment;
          return (
            attachment?.kind !== 'localReward' ||
            attachment.groupKey !== cages.key ||
            attachment.slotKey !== cages.slotKeys[index]
          );
        }) ||
        room.encounterSlotBindings.some((binding) => binding.kind !== 'set')
      ) {
        fail(
          `${path}.encounterEnvelopeKey`,
          'FieldsCombat requires FieldsEncounter Passive/Cage01/Cage02/Cage03 slot topology and local reward attachments',
        );
      }
    }
    if (
      (room.mode.kind !== 'authored' || room.mode.templateKey !== 'FieldsCombat') &&
      room.fieldsOptionalRewards !== undefined
    ) {
      fail(`${path}.fieldsOptionalRewards`, 'is only valid for FieldsCombat');
    }
    if (room.mode.kind === 'authored' && room.mode.templateKey === 'ShipCombat') {
      const envelope = encounterEnvelopes.byKey[room.encounterEnvelopeKey];
      const intro = envelope?.slots[0];
      const combat1 = envelope?.slots[1];
      const combat2 = envelope?.slots[2];
      const wheel1 = combat1?.rewardAttachment;
      const wheel2 = combat2?.rewardAttachment;
      if (
        envelope?.key !== 'ShipEncounter' ||
        envelope.slots.length !== 3 ||
        intro?.key !== 'Intro' ||
        intro.activation !== 'always' ||
        intro.rewardAttachment !== undefined ||
        combat1?.key !== 'Combat1' ||
        combat1.activation !== 'always' ||
        wheel1?.kind !== 'rewardWheel' ||
        wheel1.key !== 'wheel1' ||
        wheel1.offerKeys.length !== 2 ||
        wheel1.offerKeys[0] !== 'offer1' ||
        wheel1.offerKeys[1] !== 'offer2' ||
        wheel1.offerCount.min !== 1 ||
        wheel1.offerCount.max !== 2 ||
        wheel1.offerCount.defaultValue !== 1 ||
        combat2?.key !== 'Combat2' ||
        combat2.activation !== 'templateControlled' ||
        wheel2?.kind !== 'rewardWheel' ||
        wheel2.key !== 'wheel2' ||
        wheel2.offerKeys.length !== 2 ||
        wheel2.offerKeys[0] !== 'offer1' ||
        wheel2.offerKeys[1] !== 'offer2' ||
        wheel2.offerCount.min !== 1 ||
        wheel2.offerCount.max !== 2 ||
        wheel2.offerCount.defaultValue !== 1 ||
        room.encounterSlotBindings.some((binding) => binding.kind !== 'set')
      ) {
        fail(
          `${path}.encounterEnvelopeKey`,
          'ShipCombat requires ShipEncounter Intro, Combat1/wheel1, and template-controlled Combat2/wheel2 slots',
        );
      }
      if (room.localChildren.length !== 0) {
        fail(`${path}.localChildren`, 'ShipCombat wheels belong to its encounter envelope');
      }
      if (room.enteredRewardStoreHistory.kind !== 'none') {
        fail(
          `${path}.enteredRewardStoreHistory`,
          'ShipCombat history is emitted by its active wheel offer points',
        );
      }
    }
    if (room.eligibility !== undefined) {
      validateContextRequirementReferences(
        room.eligibility,
        collection,
        encounterEnvelopes,
        `rooms[${roomIndex}].eligibility`,
      );
    }
    if (room.force?.kind === 'requirement') {
      validateContextRequirementReferences(
        room.force.requirement,
        collection,
        encounterEnvelopes,
        `rooms[${roomIndex}].force.requirement`,
      );
    }
    for (const [childIndex, child] of room.localChildren.entries()) {
      if (child.kind !== 'fixedRoomSlots') {
        continue;
      }
      for (const [slotIndex, slot] of child.slots.entries()) {
        const referenced = collection.byKey[slot.roomGameName];
        const path = `rooms[${roomIndex}].localChildren[${childIndex}].slots[${slotIndex}].roomGameName`;
        if (referenced === undefined) {
          fail(path, `unknown room ${slot.roomGameName}`);
        }
        if (referenced.roomSetKey !== room.roomSetKey || referenced.mode.kind !== 'authored') {
          fail(path, `${slot.roomGameName} must be an authored room in ${room.roomSetKey}`);
        }
      }
    }
    if (room.mode.kind === 'authored' && room.mode.templateKey === 'EphyraCombat') {
      if (
        room.localChildren.length > 1 ||
        room.localChildren.some((child) => child.kind !== 'fixedRoomSlots')
      ) {
        fail(
          `rooms[${roomIndex}].localChildren`,
          'EphyraCombat accepts at most one fixed-room side group',
        );
      }
      if (room.requiredObjects?.length !== 1 || room.requiredObjects[0]?.key !== 'SoulPylon') {
        fail(`rooms[${roomIndex}].requiredObjects`, 'EphyraCombat requires one SoulPylon');
      }
    }
    if (room.mode.kind === 'authored' && room.mode.templateKey === 'EphyraSideRoom') {
      if (room.localChildren.length !== 0) {
        fail(`rooms[${roomIndex}].localChildren`, 'EphyraSideRoom cannot own local children');
      }
      if (room.requiredObjects !== undefined) {
        fail(`rooms[${roomIndex}].requiredObjects`, 'EphyraSideRoom cannot require room objects');
      }
    }
  });
  return collection;
}
