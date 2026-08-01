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

export function ordinarySourceGameNames(catalog: RewardKernelCatalog): readonly string[] {
  const ordinaryType = catalog.rewardTypes.values.find(
    (rewardType) =>
      rewardType.sourceSupport === 'ordinaryBoonPeer' ||
      rewardType.sourceSupport === 'ordinaryNoPeer',
  );
  if (ordinaryType === undefined) {
    throw new Error('reward kernel has no ordinary-source policy');
  }
  return sourceDomainValues(catalog, ordinaryType);
}

function ordinaryBaseSupport(
  catalog: RewardKernelCatalog,
  rewardType: RewardTypeDeclaration,
  facts: RewardKernelFacts,
): ReadonlySet<string> {
  const ordinarySources = sourceDomainValues(catalog, rewardType);
  const acquired = facts.requirements.records.lootTypeHistory;
  const acquiredSources = new Set(ordinarySources.filter((source) => (acquired[source] ?? 0) > 0));
  return acquiredSources.size >= ORDINARY_SOURCE_CAP ? acquiredSources : new Set(ordinarySources);
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
  const filtered = new Set([...primary].filter((source) => !priorSources.has(source)));
  return filtered.size > 0 ? filtered : ordinaryBaseSupport(catalog, rewardType, facts);
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
      return rewardType.defaultPayload === undefined ? [] : [rewardType.defaultPayload];
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
  if (rewardType === undefined || !isPayloadLocallyValid(catalog, rewardType, offer.payload)) {
    return false;
  }
  if (rewardType.sourceSupport === undefined) {
    return true;
  }
  const declaredPoint = rewardType.sourceResolution;
  const shouldResolve =
    resolution === 'offer'
      ? declaredPoint?.kind === 'offer'
      : declaredPoint?.kind === 'acquisitionRole' &&
        declaredPoint.role === resolution.acquisitionRole;
  if (!shouldResolve) {
    return true;
  }
  return supportedPayloads(catalog, rewardType, facts, peers).some(
    (supported) => offer.payload !== undefined && payloadEquals(supported, offer.payload),
  );
}
