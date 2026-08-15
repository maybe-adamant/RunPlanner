import type { RequirementEvaluationContext } from '../requirements/evaluator';
import type {
  ConcreteAcquisitionAddress,
  ConcreteAcquisitionEvent,
  ResolvedRewardOffer,
  RewardHistoryState,
  RewardKernelCatalog,
  RewardKernelFacts,
  ProducerLifecyclePointKey,
} from './model';

const EMPTY_RECORD = Object.freeze({}) as Readonly<Record<string, number>>;

function assertNever(value: never): never {
  throw new Error(`unknown reward projection ${String(value)}`);
}

export function createRewardHistoryState(): RewardHistoryState {
  return Object.freeze({
    offerHistory: Object.freeze([]),
    useRecord: EMPTY_RECORD,
    biomeUseRecord: EMPTY_RECORD,
    currentRoomUseRecord: EMPTY_RECORD,
    lootTypeHistory: EMPTY_RECORD,
    lootBiomeRecord: EMPTY_RECORD,
    consumableRecord: EMPTY_RECORD,
    traitFacts: Object.freeze({
      upgradableTraitCount: 0,
      elementCounts: EMPTY_RECORD,
      highestBaseElementCount: 0,
      godBoonRarityCounts: EMPTY_RECORD,
    }),
  });
}

export function beginCurrentRoomRewardHistory(history: RewardHistoryState): RewardHistoryState {
  return Object.keys(history.currentRoomUseRecord).length === 0
    ? history
    : Object.freeze({ ...history, currentRoomUseRecord: EMPTY_RECORD });
}

export function beginBiomeRewardHistory(history: RewardHistoryState): RewardHistoryState {
  if (
    Object.keys(history.biomeUseRecord).length === 0 &&
    Object.keys(history.lootBiomeRecord).length === 0 &&
    Object.keys(history.currentRoomUseRecord).length === 0
  ) {
    return history;
  }
  return Object.freeze({
    ...history,
    biomeUseRecord: EMPTY_RECORD,
    currentRoomUseRecord: EMPTY_RECORD,
    lootBiomeRecord: EMPTY_RECORD,
  });
}

function increment(
  record: Readonly<Record<string, number>>,
  key: string,
): Readonly<Record<string, number>> {
  return Object.freeze({ ...record, [key]: (record[key] ?? 0) + 1 });
}

/** Records one source-resolved direct loot interaction without fabricating a pickup. */
export function recordLootTypeHistorySource(
  history: RewardHistoryState,
  source: string,
): RewardHistoryState {
  if (source.trim().length === 0) throw new Error('loot history source must not be blank');
  return Object.freeze({
    ...history,
    lootTypeHistory: increment(history.lootTypeHistory, source),
  });
}

export function applyOfferProjection(
  catalog: RewardKernelCatalog,
  history: RewardHistoryState,
  offer: ResolvedRewardOffer,
  facts: RewardKernelFacts,
): RewardHistoryState {
  const rewardType = catalog.rewardTypes.byKey[offer.rewardType];
  if (rewardType === undefined) {
    throw new Error(`unknown reward type ${offer.rewardType}`);
  }
  const offerHistory = Object.freeze([...history.offerHistory, offer]);
  switch (rewardType.offerProjection) {
    case 'none':
      return Object.freeze({ ...history, offerHistory });
    case 'devotionSpacing':
      return Object.freeze({
        ...history,
        offerHistory,
        lastDevotionDepth: facts.requirements.runDepthCache,
      });
    default:
      return assertNever(rewardType.offerProjection);
  }
}

export function resolveAcquisitionRole(
  catalog: RewardKernelCatalog,
  offer: ResolvedRewardOffer,
  roleKey: string,
  lifecyclePoint: ProducerLifecyclePointKey,
): ConcreteAcquisitionEvent {
  const rewardType = catalog.rewardTypes.byKey[offer.rewardType];
  const role = rewardType?.acquisitionRoles.byKey[roleKey];
  if (rewardType === undefined || role === undefined) {
    throw new Error(`unknown acquisition role ${offer.rewardType}.${roleKey}`);
  }

  let acquisition: ConcreteAcquisitionAddress;
  switch (role.resolution.kind) {
    case 'self':
      acquisition = { kind: role.resolution.acquisitionKind, gameName: rewardType.gameName };
      break;
    case 'fixed':
      acquisition = role.resolution.acquisition;
      break;
    case 'payloadSource': {
      const payload = offer.payload;
      if (payload === undefined || !(role.resolution.field in payload)) {
        throw new Error(`${offer.rewardType}.${roleKey} cannot resolve its payload source`);
      }
      const gameName = payload[role.resolution.field as keyof typeof payload];
      if (typeof gameName !== 'string') {
        throw new Error(`${offer.rewardType}.${roleKey} resolved a non-string payload source`);
      }
      acquisition = { kind: role.resolution.acquisitionKind, gameName };
      break;
    }
  }
  return Object.freeze({ role: roleKey, lifecyclePoint, acquisition: Object.freeze(acquisition) });
}

export function applyConcreteAcquisition(
  catalog: RewardKernelCatalog,
  history: RewardHistoryState,
  acquisition: ConcreteAcquisitionAddress,
): RewardHistoryState {
  const declaration = catalog.acquisitions.byKey[acquisition.gameName];
  if (declaration === undefined || declaration.kind !== acquisition.kind) {
    throw new Error(`unknown concrete acquisition ${acquisition.kind}:${acquisition.gameName}`);
  }

  const common = {
    useRecord: increment(history.useRecord, acquisition.gameName),
    biomeUseRecord: increment(history.biomeUseRecord, acquisition.gameName),
    currentRoomUseRecord: increment(history.currentRoomUseRecord, acquisition.gameName),
    ...(declaration.lastRewardRecreation === undefined
      ? {}
      : { lastRewardRecreation: declaration.lastRewardRecreation }),
  };
  // Trait upgradeability is derived solely from the equipped-trait ledger in
  // the trait authority. Reward acquisition remains the exact loot/use ledger
  // and must not manufacture a shadow trait counter.
  switch (declaration.historyProjection) {
    case 'lootAndUse':
      return Object.freeze({
        ...history,
        ...common,
        lootTypeHistory: increment(history.lootTypeHistory, acquisition.gameName),
        lootBiomeRecord: increment(history.lootBiomeRecord, acquisition.gameName),
      });
    case 'consumableAndUse':
      return Object.freeze({
        ...history,
        ...common,
        consumableRecord: increment(history.consumableRecord, acquisition.gameName),
      });
    default:
      return assertNever(declaration.historyProjection);
  }
}

export function factsWithHistory(
  facts: RewardKernelFacts,
  history: RewardHistoryState,
  currentRoomShopOptionNames: ReadonlySet<string>,
): RewardKernelFacts {
  const base = facts.requirements;
  const requirements: RequirementEvaluationContext = Object.freeze({
    ...base,
    counters: Object.freeze({
      ...base.counters,
      // Trait eligibility is derived from the equipped-trait ledger.  The
      // required history fold is the sole source of this fact.
      upgradableTraitCount: history.traitFacts.upgradableTraitCount,
    }),
    records: Object.freeze({
      ...base.records,
      useRecord: history.useRecord,
      biomeUseRecord: history.biomeUseRecord,
      lootTypeHistory: history.lootTypeHistory,
    }),
    currentRoomShopOptionNames,
    lastEventRunDepthCaches: Object.freeze({
      ...base.lastEventRunDepthCaches,
      ...(history.lastDevotionDepth === undefined ? {} : { Devotion: history.lastDevotionDepth }),
    }),
  });
  return Object.freeze({ ...facts, requirements });
}
