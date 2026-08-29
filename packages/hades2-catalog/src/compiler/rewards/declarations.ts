import type { CatalogCollection } from '@run-planner/engine/catalog-schema';
import type {
  AcquisitionRoleDeclaration,
  AcquisitionRoleResolution,
  ConcreteAcquisitionDeclaration,
  PayloadDomainDeclaration,
  RewardTypeDeclaration,
  SourceResolutionPoint,
} from '@run-planner/engine/reward-kernel';

import { createCollection, requireNonEmpty } from '../common';
import { fail } from '../errors';
import type {
  RawRewardKernelInput,
  RawRewardTypeDeclaration,
} from '../../declarations/rewards/types';

const ACQUISITION_KINDS = ['consumable', 'loot', 'resource'] as const;
const HISTORY_PROJECTIONS = ['consumableAndUse', 'lootAndUse'] as const;
const OFFER_PROJECTIONS = ['devotionSpacing', 'none'] as const;
const PAYLOAD_DOMAIN_KINDS = ['distinctPair', 'oneOf'] as const;
const ROLE_RESOLUTION_KINDS = ['fixed', 'payloadSource', 'self'] as const;
const PAYLOAD_SOURCE_FIELDS = ['chosenSource', 'source', 'spurnedSource'] as const;
const SOURCE_RESOLUTION_KINDS = ['acquisitionRole', 'offer'] as const;
const SOURCE_SUPPORT_POLICIES = [
  'devotionAcquiredPair',
  'ordinaryBoonPeer',
  'ordinaryNoPeer',
] as const;

function requireClosedValue<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  path: string,
): Values[number] {
  if (typeof value !== 'string' || !(values as readonly string[]).includes(value)) {
    fail(path, `must be one of ${values.join(', ')}`);
  }
  return value as Values[number];
}

function normalizeRoleResolution(
  resolution: AcquisitionRoleResolution,
  path: string,
): AcquisitionRoleResolution {
  requireClosedValue(resolution.kind, ROLE_RESOLUTION_KINDS, `${path}.kind`);
  switch (resolution.kind) {
    case 'self':
      return Object.freeze({
        kind: 'self',
        acquisitionKind: requireClosedValue(
          resolution.acquisitionKind,
          ACQUISITION_KINDS,
          `${path}.acquisitionKind`,
        ),
      });
    case 'fixed':
      return Object.freeze({
        kind: 'fixed',
        acquisition: Object.freeze({
          kind: requireClosedValue(
            resolution.acquisition.kind,
            ACQUISITION_KINDS,
            `${path}.acquisition.kind`,
          ),
          gameName: requireNonEmpty(
            resolution.acquisition.gameName,
            `${path}.acquisition.gameName`,
          ),
        }),
      });
    case 'payloadSource':
      return Object.freeze({
        kind: 'payloadSource',
        acquisitionKind: requireClosedValue(
          resolution.acquisitionKind,
          ACQUISITION_KINDS,
          `${path}.acquisitionKind`,
        ),
        field: requireClosedValue(resolution.field, PAYLOAD_SOURCE_FIELDS, `${path}.field`),
      });
  }
}

function normalizeSourceResolution(
  resolution: SourceResolutionPoint,
  path: string,
): SourceResolutionPoint {
  requireClosedValue(resolution.kind, SOURCE_RESOLUTION_KINDS, `${path}.kind`);
  if (resolution.kind === 'offer') {
    return Object.freeze({ kind: 'offer' });
  }
  return Object.freeze({
    kind: 'acquisitionRole',
    role: requireNonEmpty(resolution.role, `${path}.role`),
  });
}

export function normalizePayloadDomains(
  raw: RawRewardKernelInput['payloadDomains'],
): CatalogCollection<PayloadDomainDeclaration> {
  const domains = raw.map((domain, index): PayloadDomainDeclaration => {
    const path = `payloadDomains[${index}]`;
    requireNonEmpty(domain.key, `${path}.key`);
    requireClosedValue(domain.kind, PAYLOAD_DOMAIN_KINDS, `${path}.kind`);
    if (domain.kind === 'oneOf') {
      if (domain.values.length === 0) {
        fail(`${path}.values`, 'must not be empty');
      }
      const values = domain.values.map((value, valueIndex) =>
        requireNonEmpty(value, `${path}.values[${valueIndex}]`),
      );
      if (new Set(values).size !== values.length) {
        fail(`${path}.values`, 'must be unique');
      }
      return Object.freeze({ key: domain.key, kind: 'oneOf', values: Object.freeze(values) });
    }
    return Object.freeze({
      key: domain.key,
      kind: 'distinctPair',
      valueDomain: requireNonEmpty(domain.valueDomain, `${path}.valueDomain`),
    });
  });
  const collection = createCollection(domains, 'payloadDomains', (domain) => domain.key);
  for (const domain of collection.values) {
    if (domain.kind === 'distinctPair' && collection.byKey[domain.valueDomain]?.kind !== 'oneOf') {
      fail(`payloadDomains.${domain.key}.valueDomain`, 'must reference a oneOf domain');
    }
  }
  return collection;
}

export function normalizeAcquisitions(
  raw: RawRewardKernelInput['acquisitions'],
): CatalogCollection<ConcreteAcquisitionDeclaration> {
  const pathPointGrants = new Map([
    ['MinorTalentDrop', 1],
    ['TalentDrop', 3],
    ['TalentBigDrop', 5],
  ]);
  for (const [index, acquisition] of raw.entries()) {
    const expected = pathPointGrants.get(acquisition.gameName);
    if (expected === undefined) {
      if (acquisition.pathPointGrant !== undefined)
        fail(`acquisitions[${index}].pathPointGrant`, 'is reserved to concrete Path rewards');
    } else if (acquisition.pathPointGrant !== expected)
      fail(`acquisitions[${index}].pathPointGrant`, `must equal ${expected}`);
  }
  for (const [index, acquisition] of raw.entries()) {
    if (typeof acquisition.canDuplicate !== 'boolean')
      fail(`acquisitions[${index}].canDuplicate`, 'must be boolean');
  }
  const goldConversionEligible = new Set([
    'AphroditeUpgrade',
    'ApolloUpgrade',
    'AresUpgrade',
    'DemeterUpgrade',
    'HephaestusUpgrade',
    'HeraUpgrade',
    'HestiaUpgrade',
    'PoseidonUpgrade',
    'ZeusUpgrade',
    'HermesUpgrade',
    'StackUpgrade',
    'StackUpgradeBig',
    'StackUpgradeTriple',
    'WeaponUpgrade',
    'TrialUpgrade',
    'SpellDrop',
    'MaxHealthDrop',
    'MaxHealthDropBig',
    'MaxHealthDropSmall',
    'EmptyMaxHealthSmallDrop',
    'EmptyMaxHealthDrop',
    'MaxManaDrop',
    'MaxManaDropBig',
    'MaxManaDropSmall',
    'TalentDrop',
    'TalentBigDrop',
    'MinorTalentDrop',
    'ArmorBoost',
    'ArmorBigBoost',
    'LastStandDrop',
    'RoomRewardConsolationPrize',
    'GiftDrop',
    'MetaCurrencyDrop',
    'MetaCurrencyBigDrop',
    'MetaCardPointsCommonDrop',
    'MetaCardPointsCommonBigDrop',
    'MemPointsCommonDrop',
  ]);
  const artificerConversionEligible = new Set([
    'GiftDrop',
    'MetaCurrencyDrop',
    'MetaCurrencyBigDrop',
    'MetaCardPointsCommonDrop',
    'MetaCardPointsCommonBigDrop',
    'MemPointsCommonDrop',
  ]);
  const declaredEligible = raw
    .filter((acquisition, index) => {
      if (
        acquisition.goldConversionEligible !== undefined &&
        typeof acquisition.goldConversionEligible !== 'boolean'
      )
        fail(`acquisitions[${index}].goldConversionEligible`, 'must be boolean');
      return acquisition.goldConversionEligible === true;
    })
    .map((acquisition) => acquisition.gameName);
  if (
    declaredEligible.length !== goldConversionEligible.size ||
    declaredEligible.some((gameName) => !goldConversionEligible.has(gameName)) ||
    [...goldConversionEligible].some((gameName) => !declaredEligible.includes(gameName))
  ) {
    fail('acquisitions', 'must declare the exact Time Piece gold-conversion eligibility set');
  }
  const declaredArtificerEligible = raw
    .filter((acquisition, index) => {
      if (
        acquisition.artificerConversionEligible !== undefined &&
        typeof acquisition.artificerConversionEligible !== 'boolean'
      )
        fail(`acquisitions[${index}].artificerConversionEligible`, 'must be boolean');
      return acquisition.artificerConversionEligible === true;
    })
    .map((acquisition) => acquisition.gameName);
  if (
    declaredArtificerEligible.length !== artificerConversionEligible.size ||
    declaredArtificerEligible.some((gameName) => !artificerConversionEligible.has(gameName)) ||
    [...artificerConversionEligible].some(
      (gameName) => !declaredArtificerEligible.includes(gameName),
    )
  ) {
    fail('acquisitions', 'must declare the exact Artificer conversion eligibility set');
  }
  const lastRewardEligible = new Set([
    'AphroditeUpgrade',
    'ApolloUpgrade',
    'AresUpgrade',
    'DemeterUpgrade',
    'HephaestusUpgrade',
    'HeraUpgrade',
    'HestiaUpgrade',
    'PoseidonUpgrade',
    'ZeusUpgrade',
    'HermesUpgrade',
    'StackUpgrade',
    'StackUpgradeBig',
    'StackUpgradeTriple',
    'WeaponUpgrade',
    'MaxHealthDrop',
    'MaxHealthDropBig',
    'MaxManaDrop',
    'MaxManaDropBig',
    'RoomMoneyDrop',
    'RoomMoneySmallDrop',
    'RoomMoneyTripleDrop',
    'TalentDrop',
    'TalentBigDrop',
    'GiftDrop',
    'MetaCurrencyDrop',
    'MetaCurrencyBigDrop',
    'MetaCardPointsCommonDrop',
    'MetaCardPointsCommonBigDrop',
    'MemPointsCommonDrop',
  ]);
  const declaredLastRewardEligible = raw
    .filter((acquisition) => acquisition.lastRewardRecreation !== undefined)
    .map((acquisition) => acquisition.gameName);
  if (
    declaredLastRewardEligible.length !== lastRewardEligible.size ||
    declaredLastRewardEligible.some((gameName) => !lastRewardEligible.has(gameName)) ||
    [...lastRewardEligible].some((gameName) => !declaredLastRewardEligible.includes(gameName))
  ) {
    fail('acquisitions', 'must declare the exact Echo last-reward eligibility set');
  }
  return createCollection(
    raw.map((acquisition, index) =>
      Object.freeze({
        gameName: requireNonEmpty(acquisition.gameName, `acquisitions[${index}].gameName`),
        kind: requireClosedValue(
          acquisition.kind,
          ACQUISITION_KINDS,
          `acquisitions[${index}].kind`,
        ),
        historyProjection: requireClosedValue(
          acquisition.historyProjection,
          HISTORY_PROJECTIONS,
          `acquisitions[${index}].historyProjection`,
        ),
        goldConversionEligible: goldConversionEligible.has(acquisition.gameName),
        artificerConversionEligible: artificerConversionEligible.has(acquisition.gameName),
        canDuplicate: acquisition.canDuplicate,
        ...(acquisition.pathPointGrant === undefined
          ? {}
          : { pathPointGrant: acquisition.pathPointGrant }),
        ...(acquisition.lastRewardRecreation === undefined
          ? {}
          : {
              lastRewardRecreation: Object.freeze({
                offer: Object.freeze({
                  rewardType: requireNonEmpty(
                    acquisition.lastRewardRecreation.rewardType,
                    `acquisitions[${index}].lastRewardRecreation.rewardType`,
                  ),
                }),
                producerLifecycleKey: requireClosedValue(
                  acquisition.lastRewardRecreation.producerLifecycleKey,
                  ['EchoLastReward'] as const,
                  `acquisitions[${index}].lastRewardRecreation.producerLifecycleKey`,
                ),
              }),
            }),
        ...(acquisition.levelResolutionEffect === undefined
          ? {}
          : { levelResolutionEffect: Object.freeze(acquisition.levelResolutionEffect) }),
        ...(acquisition.elementContributions === undefined
          ? {}
          : { elementContributions: Object.freeze(acquisition.elementContributions) }),
        ...(acquisition.grantedTraitKey === undefined
          ? {}
          : {
              grantedTraitKey: requireNonEmpty(
                acquisition.grantedTraitKey,
                `acquisitions[${index}].grantedTraitKey`,
              ),
            }),
      }),
    ),
    'acquisitions',
    (acquisition) => acquisition.gameName,
    'gameName',
  );
}

export function normalizeRewardTypes(
  raw: readonly RawRewardTypeDeclaration[],
  domains: CatalogCollection<PayloadDomainDeclaration>,
  acquisitions: CatalogCollection<ConcreteAcquisitionDeclaration>,
): CatalogCollection<RewardTypeDeclaration> {
  const rewardTypes = raw.map((rewardType, index): RewardTypeDeclaration => {
    const path = `rewardTypes[${index}]`;
    const gameName = requireNonEmpty(rewardType.gameName, `${path}.gameName`);
    const roles = createCollection(
      rewardType.acquisitionRoles.map((role, roleIndex): AcquisitionRoleDeclaration => {
        const rolePath = `${path}.acquisitionRoles[${roleIndex}]`;
        if (
          role.blocksGoldConversion !== undefined &&
          typeof role.blocksGoldConversion !== 'boolean'
        )
          fail(`${rolePath}.blocksGoldConversion`, 'must be boolean');
        return Object.freeze({
          key: requireNonEmpty(role.key, `${rolePath}.key`),
          resolution: normalizeRoleResolution(role.resolution, `${rolePath}.resolution`),
          ...(role.traitGiverKey === undefined
            ? {}
            : { traitGiverKey: requireNonEmpty(role.traitGiverKey, `${rolePath}.traitGiverKey`) }),
          ...(role.blocksGoldConversion === true ? { blocksGoldConversion: true as const } : {}),
        });
      }),
      `${path}.acquisitionRoles`,
      (role) => role.key,
    );
    return Object.freeze({
      gameName,
      label: requireNonEmpty(rewardType.label, `${path}.label`),
      ...(rewardType.payloadDomain === undefined
        ? {}
        : { payloadDomain: requireNonEmpty(rewardType.payloadDomain, `${path}.payloadDomain`) }),
      ...(rewardType.sourceSupport === undefined
        ? {}
        : {
            sourceSupport: requireClosedValue(
              rewardType.sourceSupport,
              SOURCE_SUPPORT_POLICIES,
              `${path}.sourceSupport`,
            ),
          }),
      ...(rewardType.sourceResolution === undefined
        ? {}
        : {
            sourceResolution: normalizeSourceResolution(
              rewardType.sourceResolution,
              `${path}.sourceResolution`,
            ),
          }),
      offerProjection: requireClosedValue(
        rewardType.offerProjection ?? 'none',
        OFFER_PROJECTIONS,
        `${path}.offerProjection`,
      ),
      acquisitionRoles: roles,
    });
  });
  const collection = createCollection(
    rewardTypes,
    'rewardTypes',
    (rewardType) => rewardType.gameName,
    'gameName',
  );
  const goldConversionBlockers = collection.values.flatMap((rewardType) =>
    rewardType.acquisitionRoles.values
      .filter((role) => role.blocksGoldConversion === true)
      .map((role) => `${rewardType.gameName}.${role.key}`),
  );
  if (
    goldConversionBlockers.length !== 1 ||
    goldConversionBlockers[0] !== 'BlindBoxLoot.hiddenSource'
  )
    fail(
      'rewardTypes',
      'must declare BlindBoxLoot.hiddenSource as the exact Time Piece role blocker',
    );
  for (const rewardType of collection.values) {
    const path = `rewardTypes.${rewardType.gameName}`;
    const domain =
      rewardType.payloadDomain === undefined ? undefined : domains.byKey[rewardType.payloadDomain];
    if (rewardType.payloadDomain !== undefined && domain === undefined)
      fail(`${path}.payloadDomain`, `unknown payload domain ${rewardType.payloadDomain}`);
    if ((rewardType.sourceSupport === undefined) !== (rewardType.sourceResolution === undefined))
      fail(path, 'sourceSupport and sourceResolution must be declared together');
    if (domain !== undefined && rewardType.sourceSupport === undefined)
      fail(`${path}.sourceSupport`, 'is required by a source-bearing payload domain');
    if (rewardType.sourceSupport !== undefined && domain === undefined)
      fail(`${path}.sourceSupport`, 'requires a payload domain');
    if (
      (rewardType.sourceSupport === 'ordinaryBoonPeer' ||
        rewardType.sourceSupport === 'ordinaryNoPeer') &&
      domain?.kind !== 'oneOf'
    )
      fail(`${path}.sourceSupport`, 'ordinary source policies require a oneOf payload domain');
    if (rewardType.sourceSupport === 'devotionAcquiredPair' && domain?.kind !== 'distinctPair')
      fail(
        `${path}.sourceSupport`,
        'Devotion source policy requires a distinctPair payload domain',
      );
    if (rewardType.sourceResolution?.kind === 'acquisitionRole') {
      const sourceRole = rewardType.acquisitionRoles.byKey[rewardType.sourceResolution.role];
      if (sourceRole === undefined)
        fail(`${path}.sourceResolution.role`, 'must reference a declared acquisition role');
      if (sourceRole.resolution.kind !== 'payloadSource')
        fail(`${path}.sourceResolution.role`, 'must reference a payloadSource acquisition role');
    }
    for (const role of rewardType.acquisitionRoles.values) {
      const rolePath = `${path}.acquisitionRoles.${role.key}.resolution`;
      if (role.resolution.kind === 'self') {
        const acquisition = acquisitions.byKey[rewardType.gameName];
        if (acquisition?.kind !== role.resolution.acquisitionKind)
          fail(rolePath, 'self role must reference a matching concrete acquisition');
      } else if (role.resolution.kind === 'fixed') {
        const acquisition = acquisitions.byKey[role.resolution.acquisition.gameName];
        if (acquisition?.kind !== role.resolution.acquisition.kind)
          fail(rolePath, 'fixed role must reference a matching concrete acquisition');
      } else if (domain === undefined) {
        fail(rolePath, 'payloadSource role requires a payload domain');
      } else if (
        (domain.kind === 'oneOf' && role.resolution.field !== 'source') ||
        (domain.kind === 'distinctPair' && role.resolution.field === 'source')
      ) {
        fail(rolePath, `field is incompatible with payload domain ${domain.key}`);
      } else {
        const acquisitionKind = role.resolution.acquisitionKind;
        const valueDomain = domain.kind === 'oneOf' ? domain : domains.byKey[domain.valueDomain];
        if (
          valueDomain?.kind !== 'oneOf' ||
          valueDomain.values.some((source) => acquisitions.byKey[source]?.kind !== acquisitionKind)
        )
          fail(rolePath, 'payload source domain must resolve matching concrete acquisitions');
      }
    }
  }
  const ordinaryTypes = collection.values.filter(
    (rewardType) =>
      rewardType.sourceSupport === 'ordinaryBoonPeer' ||
      rewardType.sourceSupport === 'ordinaryNoPeer',
  );
  const ordinaryDomain = ordinaryTypes[0]?.payloadDomain;
  if (ordinaryDomain === undefined)
    fail('rewardTypes', 'must declare at least one ordinary-source policy');
  for (const rewardType of ordinaryTypes)
    if (rewardType.payloadDomain !== ordinaryDomain)
      fail(
        `rewardTypes.${rewardType.gameName}.payloadDomain`,
        `ordinary-source policies must share ${ordinaryDomain}`,
      );
  for (const rewardType of collection.values) {
    if (rewardType.sourceSupport !== 'devotionAcquiredPair') continue;
    const pairDomain =
      rewardType.payloadDomain === undefined ? undefined : domains.byKey[rewardType.payloadDomain];
    if (pairDomain?.kind !== 'distinctPair' || pairDomain.valueDomain !== ordinaryDomain)
      fail(
        `rewardTypes.${rewardType.gameName}.payloadDomain`,
        `Devotion source policy must use the ordinary-source domain ${ordinaryDomain}`,
      );
  }
  return collection;
}
