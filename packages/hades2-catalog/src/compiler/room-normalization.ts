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
  freezeUniqueStrings,
  requireNonEmpty,
  requireNonNegativeInteger,
  requirePositiveInteger,
} from './common';
import { fail } from './errors';

const structuralTags = new Set<RoomStructuralTag>(['Indoor', 'Outdoor']);

function normalizeRoomCaps(caps: RoomCaps, path: string): RoomCaps {
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

function normalizeRoomStructuralTags(
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
  Boss: 'Boss',
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
  PostBoss: 'PostBoss',
  ShipCombat: 'Combat',
  StandardCombat: 'Combat',
  Story: 'Story',
} as const satisfies Readonly<Record<RoomTemplateKey, RoomDeclaration['kind']>>;

const roomTemplateRewardKinds = {
  Anomaly: 'countedChoice',
  Boss: 'none',
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
  PostBoss: 'none',
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
      if (raw.kind !== 'zagreusContract' && raw.kind !== 'chaos') {
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
      if (raw.kind === 'chaos') {
        const expectedKey = 'chaos';
        if (key !== expectedKey) fail(`${exitPath}.key`, `chaos exit key must be ${expectedKey}`);
        if (exitType.key !== 'ChaosExitDoor')
          fail(`${exitPath}.exitType`, 'chaos exits must use ChaosExitDoor');
        if (
          exitType.behavior.kind !== 'playerSelected' ||
          exitType.behavior.rewardPreview !== 'hidden'
        )
          fail(`${exitPath}.exitType`, 'chaos exits must be player-selected and hidden');
        if (typeof raw.canHost !== 'boolean') fail(`${exitPath}.canHost`, 'must be a boolean');
        if (typeof raw.canSpawn !== 'boolean') fail(`${exitPath}.canSpawn`, 'must be a boolean');
        if (raw.canSpawn && !raw.canHost)
          fail(`${exitPath}.canSpawn`, 'cannot be true when canHost is false');
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
          kind: 'chaos',
          key: 'chaos',
          canHost: raw.canHost,
          canSpawn: raw.canSpawn,
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

/** Produces one fully normalized immutable room declaration from its raw declaration. */
export function normalizeRoom(
  room: RawRoomDeclaration,
  roomIndex: number,
  rewards: RewardKernelCatalog,
  encounterEnvelopes: CatalogCollection<EncounterEnvelope>,
  encounterDefinitions: CatalogCollection<EncounterDefinition>,
  encounterSets: CatalogCollection<EncounterSet>,
  exitTypes: CatalogCollection<ExitTypeDeclaration>,
): RoomDeclaration {
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
  if (
    room.advancesHermesShrineDeliveryUses !== undefined &&
    typeof room.advancesHermesShrineDeliveryUses !== 'boolean'
  ) {
    fail(`${path}.advancesHermesShrineDeliveryUses`, 'must be a boolean when declared');
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
  const automaticExits = exits.filter((exit) => exit.behavior.kind === 'automaticHostContinuation');
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
      exits.length === 0 ||
      exits.some(
        (exit, index) =>
          exit.index !== index + 1 ||
          exit.type !== 'ChaosReturnExitDoor' ||
          exit.behavior.kind !== 'playerSelected' ||
          exit.behavior.rewardPreview !== 'visible',
      )
    ) {
      fail(
        `${path}.exits`,
        'Chaos rooms require ordered visible player-selected ChaosReturnExitDoors',
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
  const localChildren = normalizeLocalChildren(
    room.localChildren ?? [],
    `${path}.localChildren`,
    (binding, bindingPath) => {
      const normalized = normalizeRewardBinding(binding, rewards, bindingPath);
      if (normalized.kind !== 'countedChoice') {
        fail(`${bindingPath}.kind`, 'bounded reward slots require countedChoice');
      }
      return normalized;
    },
  );
  const offerRewardBinding = (() => {
    const raw = room.offerRewardBinding;
    if (raw === undefined) {
      return Object.freeze(
        incomingReward.kind === 'none' || incomingReward.kind === 'shop'
          ? { kind: 'none' as const }
          : { kind: 'incomingReward' as const },
      );
    }
    if (raw.kind !== 'localRewardGroup') {
      fail(`${path}.offerRewardBinding.kind`, `unknown binding ${String(raw.kind)}`);
    }
    const group = localChildren.find((child) => child.key === raw.groupKey);
    if (group === undefined) {
      fail(
        `${path}.offerRewardBinding.groupKey`,
        `unknown local reward group ${String(raw.groupKey)}`,
      );
    }
    if (group.kind !== 'boundedRewardSlots') {
      fail(
        `${path}.offerRewardBinding.groupKey`,
        'offer reward groups must reference bounded reward slots',
      );
    }
    if (group.offerRewardCapability !== 'fieldsCages') {
      fail(
        `${path}.offerRewardBinding.groupKey`,
        'offer reward groups must declare the fieldsCages materialization capability',
      );
    }
    return Object.freeze({
      kind: 'localRewardGroup' as const,
      groupKey: group.key,
    });
  })();
  const prebossBatchPolicy =
    room.prebossBatchPolicy === undefined
      ? undefined
      : normalizePrebossBatchPolicy(room.prebossBatchPolicy, rewards, `${path}.prebossBatchPolicy`);
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
      fail(`${path}.infernalContractReward.producerLifecycleKey`, 'must support the pedestal pool');
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
    structuralTags: normalizeRoomStructuralTags(room.structuralTags, `${path}.structuralTags`),
    exits: Object.freeze(exits),
    additionalExits,
    incomingReward,
    offerRewardBinding,
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
    advancesHermesShrineDeliveryUses: room.advancesHermesShrineDeliveryUses ?? true,
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
    caps: normalizeRoomCaps(room.caps, `${path}.caps`),
    resourcePointSupport: normalizeResourcePointSupport(room, path),
    ...(eligibility === undefined ? {} : { eligibility }),
    ...(room.force === undefined
      ? {}
      : { force: normalizeForce(room.force, rewards, `${path}.force`) }),
    ...(requiredObjects === undefined ? {} : { requiredObjects: Object.freeze(requiredObjects) }),
    localChildren,
    ...(fieldsOptionalRewards === undefined ? {} : { fieldsOptionalRewards }),
    ...(infernalContractReward === undefined ? {} : { infernalContractReward }),
  });
}
