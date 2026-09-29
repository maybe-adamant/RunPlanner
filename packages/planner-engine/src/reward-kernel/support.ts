import { evaluateRequirement } from '../requirements/evaluator';
import type { RewardTypeDeclaration } from './model';
import type {
  DevotionPairPayload,
  ResolvedRewardOffer,
  RewardKernelCatalog,
  RewardKernelFacts,
  RewardPayload,
  RewardPeerContext,
} from './model';

const ORDINARY_SOURCE_CAP = 4;

function payloadSources(payload: RewardPayload): readonly string[] {
  return payload.kind === 'BoonSource'
    ? [payload.source]
    : [payload.chosenSource, payload.spurnedSource];
}

function sourceDomainValues(
  catalog: RewardKernelCatalog,
  rewardType: RewardTypeDeclaration,
): readonly string[] {
  const domain =
    rewardType.payloadDomain === undefined
      ? undefined
      : catalog.payloadDomains.byKey[rewardType.payloadDomain];
  if (domain?.kind === 'oneOf') {
    return domain.values;
  }
  if (domain?.kind === 'distinctPair') {
    const valueDomain = catalog.payloadDomains.byKey[domain.valueDomain];
    if (valueDomain?.kind === 'oneOf') {
      return valueDomain.values;
    }
  }
  throw new Error(`${rewardType.gameName} has no normalized source domain`);
}

/**
 * Enumerates every complete offer admitted by one reward type's normalized
 * local payload domain. Contextual source, peer, bag, and history support is
 * deliberately evaluated later by the reward simulation.
 */
export function locallyValidRewardOffers(
  catalog: RewardKernelCatalog,
  rewardTypeGameName: string,
): readonly ResolvedRewardOffer[] {
  const rewardType = catalog.rewardTypes.byKey[rewardTypeGameName];
  if (rewardType === undefined) {
    throw new Error(`reward type ${rewardTypeGameName} is missing`);
  }
  if (rewardType.payloadDomain === undefined) {
    return Object.freeze([Object.freeze({ rewardType: rewardType.gameName })]);
  }
  const domain = catalog.payloadDomains.byKey[rewardType.payloadDomain];
  if (domain?.kind === 'oneOf') {
    return Object.freeze(
      domain.values.map((source) =>
        Object.freeze({
          rewardType: rewardType.gameName,
          payload: Object.freeze({ kind: 'BoonSource' as const, source }),
        }),
      ),
    );
  }
  if (domain?.kind !== 'distinctPair') {
    throw new Error(`${rewardType.gameName} has no normalized payload domain`);
  }
  const values = sourceDomainValues(catalog, rewardType);
  return Object.freeze(
    values.flatMap((chosenSource) =>
      values
        .filter((spurnedSource) => spurnedSource !== chosenSource)
        .map((spurnedSource) =>
          Object.freeze({
            rewardType: rewardType.gameName,
            payload: Object.freeze({
              kind: 'DevotionPair' as const,
              chosenSource,
              spurnedSource,
            }),
          }),
        ),
    ),
  );
}

/** Policies that resolve one source from the shared ordinary god domain. */
export function isOrdinarySourcePolicy(policy: RewardTypeDeclaration['sourceSupport']): boolean {
  return (
    policy === 'ordinaryBoonPeer' || policy === 'ordinaryInteracted' || policy === 'ordinaryNoPeer'
  );
}

export function ordinarySourceGameNames(catalog: RewardKernelCatalog): readonly string[] {
  const ordinaryType = catalog.rewardTypes.values.find((rewardType) =>
    isOrdinarySourcePolicy(rewardType.sourceSupport),
  );
  if (ordinaryType === undefined) {
    throw new Error('reward kernel has no ordinary-source policy');
  }
  return sourceDomainValues(catalog, ordinaryType);
}

function sourceRequirementMet(
  catalog: RewardKernelCatalog,
  source: string,
  facts: RewardKernelFacts,
): boolean {
  const requirement = catalog.acquisitions.byKey[source]?.lootRequirement;
  return requirement === undefined || evaluateRequirement(requirement, facts.requirements);
}

/** Ordinary gods whose declared loot requirement holds, independent of the run's god cap. */
export function eligibleOrdinarySourceGameNames(
  catalog: RewardKernelCatalog,
  facts: RewardKernelFacts,
): readonly string[] {
  return ordinarySourceGameNames(catalog).filter((source) =>
    sourceRequirementMet(catalog, source, facts),
  );
}

function ordinaryBaseSupport(
  catalog: RewardKernelCatalog,
  rewardType: RewardTypeDeclaration,
  facts: RewardKernelFacts,
): ReadonlySet<string> {
  const ordinarySources = sourceDomainValues(catalog, rewardType);
  const acquired = facts.requirements.records.lootTypeHistory;
  const acquiredSources = new Set(ordinarySources.filter((source) => (acquired[source] ?? 0) > 0));
  const capped =
    acquiredSources.size >= ORDINARY_SOURCE_CAP ? acquiredSources : new Set(ordinarySources);
  // `GetEligibleLootNames` applies each god's loot requirement after the cap.
  return new Set([...capped].filter((source) => sourceRequirementMet(catalog, source, facts)));
}

function ordinaryPeerSupport(
  catalog: RewardKernelCatalog,
  rewardType: RewardTypeDeclaration,
  facts: RewardKernelFacts,
  peers: RewardPeerContext,
): ReadonlySet<string> {
  const ordinarySources = sourceDomainValues(catalog, rewardType);
  const acquired = facts.requirements.records.lootTypeHistory;
  const acquiredSources = new Set(ordinarySources.filter((source) => (acquired[source] ?? 0) > 0));
  const priorSources = new Set<string>();
  for (const offer of peers.priorOffers) {
    if (
      catalog.rewardTypes.byKey[offer.rewardType]?.sourceSupport === 'ordinaryBoonPeer' &&
      offer.payload?.kind === 'BoonSource'
    ) {
      priorSources.add(offer.payload.source);
    }
  }
  const capSources = new Set([...acquiredSources, ...priorSources]);
  const primary =
    capSources.size >= ORDINARY_SOURCE_CAP ? acquiredSources : new Set(ordinarySources);
  const filtered = new Set(
    [...primary].filter(
      (source) => !priorSources.has(source) && sourceRequirementMet(catalog, source, facts),
    ),
  );
  return filtered.size > 0 ? filtered : ordinaryBaseSupport(catalog, rewardType, facts);
}

/**
 * Shop boon gods (`GetEligibleInteractedGods`): eligible gods already picked up
 * on this file, or every eligible god when none has been.
 */
function interactedOrdinarySupport(
  catalog: RewardKernelCatalog,
  rewardType: RewardTypeDeclaration,
  facts: RewardKernelFacts,
): ReadonlySet<string> {
  const eligible = ordinaryBaseSupport(catalog, rewardType, facts);
  const pickups = facts.requirements.records.lifetimeGodPickupRecord;
  if (pickups === undefined) throw new Error('shop god support requires the god pickup record');
  const interacted = new Set([...eligible].filter((source) => (pickups[source] ?? 0) > 0));
  return interacted.size > 0 ? interacted : eligible;
}

function devotionSupport(
  catalog: RewardKernelCatalog,
  rewardType: RewardTypeDeclaration,
  facts: RewardKernelFacts,
): readonly DevotionPairPayload[] {
  const acquired = sourceDomainValues(catalog, rewardType).filter(
    (source) => (facts.requirements.records.lootTypeHistory[source] ?? 0) > 0,
  );
  return acquired.flatMap((chosenSource) =>
    acquired
      .filter((spurnedSource) => spurnedSource !== chosenSource)
      .map((spurnedSource) => ({
        kind: 'DevotionPair' as const,
        chosenSource,
        spurnedSource,
      })),
  );
}

export function supportedPayloads(
  catalog: RewardKernelCatalog,
  rewardType: RewardTypeDeclaration,
  facts: RewardKernelFacts,
  peers: RewardPeerContext = { priorOffers: [] },
): readonly RewardPayload[] {
  switch (rewardType.sourceSupport) {
    case undefined:
      return [];
    case 'ordinaryBoonPeer':
      return [...ordinaryPeerSupport(catalog, rewardType, facts, peers)].map((source) => ({
        kind: 'BoonSource',
        source,
      }));
    case 'ordinaryNoPeer':
      return [...ordinaryBaseSupport(catalog, rewardType, facts)].map((source) => ({
        kind: 'BoonSource',
        source,
      }));
    case 'ordinaryInteracted':
      return [...interactedOrdinarySupport(catalog, rewardType, facts)].map((source) => ({
        kind: 'BoonSource',
        source,
      }));
    case 'devotionAcquiredPair':
      return devotionSupport(catalog, rewardType, facts);
  }
  throw new Error(`unknown source-support policy ${String(rewardType.sourceSupport)}`);
}

function payloadEquals(left: RewardPayload, right: RewardPayload): boolean {
  if (left.kind !== right.kind) {
    return false;
  }
  if (left.kind === 'BoonSource' && right.kind === 'BoonSource') {
    return left.source === right.source;
  }
  return (
    left.kind === 'DevotionPair' &&
    right.kind === 'DevotionPair' &&
    left.chosenSource === right.chosenSource &&
    left.spurnedSource === right.spurnedSource
  );
}

export function isPayloadLocallyValid(
  catalog: RewardKernelCatalog,
  rewardType: RewardTypeDeclaration,
  payload: RewardPayload | undefined,
): boolean {
  if (rewardType.payloadDomain === undefined) {
    return payload === undefined;
  }
  if (payload === undefined) {
    return false;
  }
  const domain = catalog.payloadDomains.byKey[rewardType.payloadDomain];
  if (domain === undefined) {
    return false;
  }
  if (domain.kind === 'oneOf') {
    return payload.kind === 'BoonSource' && domain.values.includes(payload.source);
  }
  if (payload.kind !== 'DevotionPair' || payload.chosenSource === payload.spurnedSource) {
    return false;
  }
  const sourceDomain = catalog.payloadDomains.byKey[domain.valueDomain];
  return (
    sourceDomain?.kind === 'oneOf' &&
    payloadSources(payload).every((source) => sourceDomain.values.includes(source))
  );
}

export function isOfferSupportedAtResolutionPoint(
  catalog: RewardKernelCatalog,
  offer: ResolvedRewardOffer,
  facts: RewardKernelFacts,
  resolution: 'offer' | { readonly acquisitionRole: string },
  peers: RewardPeerContext = { priorOffers: [] },
): boolean {
  const rewardType = catalog.rewardTypes.byKey[offer.rewardType];
  if (rewardType === undefined) return false;
  const declaredPoint = rewardType.sourceResolution;
  const deferredAtOffer =
    resolution === 'offer' &&
    declaredPoint?.kind === 'acquisitionRole' &&
    offer.payload === undefined;
  if (!deferredAtOffer && !isPayloadLocallyValid(catalog, rewardType, offer.payload)) return false;
  if (deferredAtOffer) return true;
  const shouldResolve =
    resolution === 'offer'
      ? declaredPoint?.kind === 'offer'
      : declaredPoint?.kind === 'acquisitionRole' &&
        declaredPoint.role === resolution.acquisitionRole;
  if (!shouldResolve) return true;
  if (rewardType.sourceSupport === undefined) return true;
  return supportedPayloads(catalog, rewardType, facts, peers).some(
    (supported) => offer.payload !== undefined && payloadEquals(supported, offer.payload),
  );
}
