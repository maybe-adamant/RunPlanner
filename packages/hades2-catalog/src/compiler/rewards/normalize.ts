import type { CatalogCollection } from '@run-planner/engine/catalog-schema';
import type { RequirementExpression } from '@run-planner/engine/requirements';
import type {
  AcquisitionLifecycleBinding,
  AcquisitionRoleResolution,
  AcquisitionRoleDeclaration,
  ConcreteAcquisitionDeclaration,
  PayloadDomainDeclaration,
  ProducerLifecycleProfileDeclaration,
  ProducerLifecyclePointKey,
  ProducerRewardLifecycleDeclaration,
  RewardKernelCatalog,
  RewardStoreDeclaration,
  RewardTypeDeclaration,
  ShopGroupDeclaration,
  ShopOptionEntry,
  ShopProfileDeclaration,
  ShopSlotDeclaration,
  SourceResolutionPoint,
} from '@run-planner/engine/reward-kernel';

import { createCollection, requireNonEmpty, requirePositiveInteger } from '../common';
import { fail } from '../errors';
import { normalizeRequirement, rejectEncounterHistoryRequirements } from '../requirements';
import type {
  RawRewardKernelInput,
  RawRewardTypeDeclaration,
  RawShopOptionEntryDeclaration,
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
const PRODUCER_LIFECYCLE_POINTS = [
  'afterCombat',
  'afterUnwrap',
  'beforeCombat',
  'echoReplay',
  'purchase',
  'roomRewardPickup',
  'roomExit',
] as const;
const LEVEL_RESOLUTION_EFFECT_KINDS = [
  'visibleChoice',
  'randomTarget',
  'randomTargetIfAvailable',
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

function normalizePayloadDomains(
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

function normalizeAcquisitions(
  raw: RawRewardKernelInput['acquisitions'],
): CatalogCollection<ConcreteAcquisitionDeclaration> {
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
    'SpellDrop',
    'MaxHealthDrop',
    'MaxHealthDropBig',
    'MaxHealthDropSmall',
    'EmptyMaxHealthSmallDrop',
    'MaxManaDrop',
    'MaxManaDropBig',
    'MaxManaDropSmall',
    'TalentDrop',
    'TalentBigDrop',
    'MinorTalentDrop',
    'ArmorBoost',
    'ArmorBigBoost',
    'LastStandDrop',
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
      ) {
        fail(`acquisitions[${index}].goldConversionEligible`, 'must be boolean');
      }
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
  )
    fail('acquisitions', 'must declare the exact Artificer conversion eligibility set');
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
    'TrialUpgrade',
    'MaxHealthDrop',
    'MaxHealthDropBig',
    'MaxManaDrop',
    'MaxManaDropBig',
    'RoomMoneyDrop',
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

function normalizeRewardTypes(
  raw: readonly RawRewardTypeDeclaration[],
  domains: CatalogCollection<PayloadDomainDeclaration>,
  acquisitions: CatalogCollection<ConcreteAcquisitionDeclaration>,
): CatalogCollection<RewardTypeDeclaration> {
  const rewardTypes = raw.map((rewardType, index): RewardTypeDeclaration => {
    const path = `rewardTypes[${index}]`;
    const gameName = requireNonEmpty(rewardType.gameName, `${path}.gameName`);
    const roles = createCollection(
      rewardType.acquisitionRoles.map((role, roleIndex): AcquisitionRoleDeclaration =>
        (() => {
          const rolePath = `${path}.acquisitionRoles[${roleIndex}]`;
          if (
            role.blocksGoldConversion !== undefined &&
            typeof role.blocksGoldConversion !== 'boolean'
          ) {
            fail(`${rolePath}.blocksGoldConversion`, 'must be boolean');
          }
          return Object.freeze({
            key: requireNonEmpty(role.key, `${rolePath}.key`),
            resolution: normalizeRoleResolution(role.resolution, `${rolePath}.resolution`),
            ...(role.blocksGoldConversion === true ? { blocksGoldConversion: true as const } : {}),
          });
        })(),
      ),
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
  ) {
    fail(
      'rewardTypes',
      'must declare BlindBoxLoot.hiddenSource as the exact Time Piece role blocker',
    );
  }

  for (const rewardType of collection.values) {
    const path = `rewardTypes.${rewardType.gameName}`;
    const domain =
      rewardType.payloadDomain === undefined ? undefined : domains.byKey[rewardType.payloadDomain];
    if (rewardType.payloadDomain !== undefined && domain === undefined) {
      fail(`${path}.payloadDomain`, `unknown payload domain ${rewardType.payloadDomain}`);
    }
    if ((rewardType.sourceSupport === undefined) !== (rewardType.sourceResolution === undefined)) {
      fail(path, 'sourceSupport and sourceResolution must be declared together');
    }
    if (domain !== undefined && rewardType.sourceSupport === undefined) {
      fail(`${path}.sourceSupport`, 'is required by a source-bearing payload domain');
    }
    if (rewardType.sourceSupport !== undefined && domain === undefined) {
      fail(`${path}.sourceSupport`, 'requires a payload domain');
    }
    if (
      (rewardType.sourceSupport === 'ordinaryBoonPeer' ||
        rewardType.sourceSupport === 'ordinaryNoPeer') &&
      domain?.kind !== 'oneOf'
    ) {
      fail(`${path}.sourceSupport`, 'ordinary source policies require a oneOf payload domain');
    }
    if (rewardType.sourceSupport === 'devotionAcquiredPair' && domain?.kind !== 'distinctPair') {
      fail(
        `${path}.sourceSupport`,
        'Devotion source policy requires a distinctPair payload domain',
      );
    }
    if (rewardType.sourceResolution?.kind === 'acquisitionRole') {
      const sourceRole = rewardType.acquisitionRoles.byKey[rewardType.sourceResolution.role];
      if (sourceRole === undefined) {
        fail(`${path}.sourceResolution.role`, 'must reference a declared acquisition role');
      }
      if (sourceRole.resolution.kind !== 'payloadSource') {
        fail(`${path}.sourceResolution.role`, 'must reference a payloadSource acquisition role');
      }
    }
    for (const role of rewardType.acquisitionRoles.values) {
      const rolePath = `${path}.acquisitionRoles.${role.key}.resolution`;
      if (role.resolution.kind === 'self') {
        const acquisition = acquisitions.byKey[rewardType.gameName];
        if (acquisition?.kind !== role.resolution.acquisitionKind) {
          fail(rolePath, 'self role must reference a matching concrete acquisition');
        }
      } else if (role.resolution.kind === 'fixed') {
        const acquisition = acquisitions.byKey[role.resolution.acquisition.gameName];
        if (acquisition?.kind !== role.resolution.acquisition.kind) {
          fail(rolePath, 'fixed role must reference a matching concrete acquisition');
        }
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
        ) {
          fail(rolePath, 'payload source domain must resolve matching concrete acquisitions');
        }
      }
    }
  }

  const ordinaryTypes = collection.values.filter(
    (rewardType) =>
      rewardType.sourceSupport === 'ordinaryBoonPeer' ||
      rewardType.sourceSupport === 'ordinaryNoPeer',
  );
  const ordinaryDomain = ordinaryTypes[0]?.payloadDomain;
  if (ordinaryDomain === undefined) {
    fail('rewardTypes', 'must declare at least one ordinary-source policy');
  }
  for (const rewardType of ordinaryTypes) {
    if (rewardType.payloadDomain !== ordinaryDomain) {
      fail(
        `rewardTypes.${rewardType.gameName}.payloadDomain`,
        `ordinary-source policies must share ${ordinaryDomain}`,
      );
    }
  }
  for (const rewardType of collection.values) {
    if (rewardType.sourceSupport !== 'devotionAcquiredPair') {
      continue;
    }
    const pairDomain =
      rewardType.payloadDomain === undefined ? undefined : domains.byKey[rewardType.payloadDomain];
    if (pairDomain?.kind !== 'distinctPair' || pairDomain.valueDomain !== ordinaryDomain) {
      fail(
        `rewardTypes.${rewardType.gameName}.payloadDomain`,
        `Devotion source policy must use the ordinary-source domain ${ordinaryDomain}`,
      );
    }
  }
  return collection;
}

function validateRequirementRewardReferences(
  requirement: RequirementExpression,
  rewardTypes: CatalogCollection<RewardTypeDeclaration>,
  path: string,
): void {
  switch (requirement.kind) {
    case 'all':
    case 'any':
      requirement.requirements.forEach((child, index) =>
        validateRequirementRewardReferences(child, rewardTypes, `${path}.requirements[${index}]`),
      );
      return;
    case 'not':
      validateRequirementRewardReferences(
        requirement.requirement,
        rewardTypes,
        `${path}.requirement`,
      );
      return;
    case 'notInCurrentRoomShopOptions':
    case 'currentRoomRewardExcludes': {
      const values =
        requirement.kind === 'notInCurrentRoomShopOptions'
          ? [requirement.rewardType]
          : requirement.rewardTypes;
      values.forEach((value, index) => {
        if (rewardTypes.byKey[value] === undefined) {
          fail(`${path}.rewardTypes[${index}]`, `unknown reward type ${value}`);
        }
      });
      return;
    }
    case 'recordCount':
    case 'distinctRecordKeyCount':
    case 'counterRange':
    case 'clockworkGoalsRemaining':
    case 'clockworkNonGoalCapacity':
    case 'currentBatchRoomCount':
    case 'currentBatchTargetCount':
    case 'flagEquals':
    case 'authoredCondition':
    case 'minExits':
    case 'minRoomsSinceEvent':
    case 'recentEnvelopeSlotCount':
      return;
  }
}

function normalizeAndValidateRequirement(
  requirement: RequirementExpression,
  rewardTypes: CatalogCollection<RewardTypeDeclaration>,
  path: string,
): RequirementExpression {
  const normalized = normalizeRequirement(requirement, path);
  validateRequirementRewardReferences(normalized, rewardTypes, path);
  rejectEncounterHistoryRequirements(normalized, path);
  return normalized;
}

function normalizeStores(
  raw: RawRewardKernelInput['stores'],
  rewardTypes: CatalogCollection<RewardTypeDeclaration>,
): CatalogCollection<RewardStoreDeclaration> {
  return createCollection(
    raw.map((store, storeIndex): RewardStoreDeclaration => {
      const path = `stores[${storeIndex}]`;
      requireNonEmpty(store.key, `${path}.key`);
      if (store.entries.length === 0) {
        fail(`${path}.entries`, 'must not be empty');
      }
      const entries = store.entries.map((entry, entryIndex) => {
        const entryPath = `${path}.entries[${entryIndex}]`;
        if (rewardTypes.byKey[entry.rewardType] === undefined) {
          fail(`${entryPath}.rewardType`, `unknown reward type ${entry.rewardType}`);
        }
        return Object.freeze({
          index: entryIndex,
          rewardType: entry.rewardType,
          allowDuplicates: entry.allowDuplicates ?? false,
          ...(entry.requirement === undefined
            ? {}
            : {
                requirement: normalizeAndValidateRequirement(
                  entry.requirement,
                  rewardTypes,
                  `${entryPath}.requirement`,
                ),
              }),
        });
      });
      return Object.freeze({ key: store.key, entries: Object.freeze(entries) });
    }),
    'stores',
    (store) => store.key,
  );
}

function normalizeShopOption(
  raw: RawShopOptionEntryDeclaration,
  rewardTypes: CatalogCollection<RewardTypeDeclaration>,
  path: string,
): ShopOptionEntry {
  const boonRarityOverride = raw.boonRarityOverride;
  if (boonRarityOverride !== undefined) {
    for (const [key, value] of Object.entries(boonRarityOverride)) {
      if (
        !['Rare', 'Epic', 'Duo', 'Legendary'].includes(key) ||
        typeof value !== 'number' ||
        !Number.isFinite(value)
      )
        fail(`${path}.boonRarityOverride.${key}`, 'must be a finite supported boon rarity check');
    }
  }
  const rewardType = rewardTypes.byKey[raw.rewardType];
  if (rewardType === undefined) {
    fail(`${path}.rewardType`, `unknown reward type ${raw.rewardType}`);
  }
  const acquisitionLifecycle = normalizeAcquisitionLifecycle(
    raw.acquisitionLifecycle,
    rewardType,
    'purchase',
    path,
  );
  const rawInteraction = raw.purchaseInteraction;
  if (rawInteraction === undefined) fail(`${path}.purchaseInteraction`, 'is required');
  const purchaseInteraction =
    rawInteraction.kind === 'resolvedOfferSource'
      ? Object.freeze({ kind: 'resolvedOfferSource' as const })
      : rawInteraction.kind === 'fixed'
        ? Object.freeze({
            kind: 'fixed' as const,
            gameName: requireNonEmpty(
              rawInteraction.gameName,
              `${path}.purchaseInteraction.gameName`,
            ),
          })
        : fail(`${path}.purchaseInteraction.kind`, 'must be fixed or resolvedOfferSource');
  if (
    purchaseInteraction.kind === 'resolvedOfferSource' &&
    rewardType.sourceResolution?.kind !== 'offer'
  )
    fail(
      `${path}.purchaseInteraction`,
      'resolvedOfferSource requires offer-time source resolution',
    );
  return Object.freeze({
    key: requireNonEmpty(raw.key, `${path}.key`),
    rewardType: rewardType.gameName,
    ...(raw.requirement === undefined
      ? {}
      : {
          requirement: normalizeAndValidateRequirement(
            raw.requirement,
            rewardTypes,
            `${path}.requirement`,
          ),
        }),
    ...(raw.purchaseRequirement === undefined
      ? {}
      : {
          purchaseRequirement: normalizeAndValidateRequirement(
            raw.purchaseRequirement,
            rewardTypes,
            `${path}.purchaseRequirement`,
          ),
        }),
    acquisitionLifecycle,
    purchaseInteraction,
    ...(boonRarityOverride === undefined
      ? {}
      : { boonRarityOverride: Object.freeze({ ...boonRarityOverride }) }),
  });
}

function normalizeAcquisitionLifecycle(
  raw: readonly AcquisitionLifecycleBinding[] | undefined,
  rewardType: RewardTypeDeclaration,
  defaultLifecyclePoint: ProducerLifecyclePointKey,
  path: string,
): readonly AcquisitionLifecycleBinding[] {
  const rawLifecycle: readonly AcquisitionLifecycleBinding[] =
    raw ??
    rewardType.acquisitionRoles.values.map((role) => ({
      role: role.key,
      lifecyclePoint: defaultLifecyclePoint,
    }));
  const seenRoles = new Set<string>();
  const acquisitionLifecycle = rawLifecycle.map((binding, index) => {
    const bindingPath = `${path}.acquisitionLifecycle[${index}]`;
    requireNonEmpty(binding.role, `${bindingPath}.role`);
    if (seenRoles.has(binding.role)) {
      fail(`${bindingPath}.role`, `duplicates ${binding.role}`);
    }
    if (rewardType.acquisitionRoles.byKey[binding.role] === undefined) {
      fail(`${bindingPath}.role`, `unknown acquisition role ${binding.role}`);
    }
    seenRoles.add(binding.role);
    const effect = binding.levelResolutionEffect;
    if (
      binding.blocksArtificerConversion !== undefined &&
      binding.blocksArtificerConversion !== true
    )
      fail(`${bindingPath}.blocksArtificerConversion`, 'must be true when present');
    if (effect !== undefined) {
      requireClosedValue(
        effect.kind,
        LEVEL_RESOLUTION_EFFECT_KINDS,
        `${bindingPath}.levelResolutionEffect.kind`,
      );
      if (effect.levelCount !== 1 && effect.levelCount !== 2 && effect.levelCount !== 3) {
        fail(`${bindingPath}.levelResolutionEffect.levelCount`, 'must be 1, 2, or 3');
      }
      if (effect.kind !== 'visibleChoice' && effect.levelCount !== 1) {
        fail(`${bindingPath}.levelResolutionEffect.levelCount`, 'random level effects require 1');
      }
    }
    return Object.freeze({
      role: binding.role,
      lifecyclePoint: requireClosedValue(
        binding.lifecyclePoint,
        PRODUCER_LIFECYCLE_POINTS,
        `${bindingPath}.lifecyclePoint`,
      ),
      ...(effect === undefined ? {} : { levelResolutionEffect: Object.freeze({ ...effect }) }),
      ...(binding.blocksArtificerConversion === true
        ? { blocksArtificerConversion: true as const }
        : {}),
    });
  });
  if (seenRoles.size !== rewardType.acquisitionRoles.values.length) {
    fail(`${path}.acquisitionLifecycle`, 'must bind every reward acquisition role exactly once');
  }
  return Object.freeze(acquisitionLifecycle);
}

function normalizeShops(
  raw: RawRewardKernelInput['shops'],
  rewardTypes: CatalogCollection<RewardTypeDeclaration>,
): CatalogCollection<ShopProfileDeclaration> {
  const echoDuplicateKeyPrefix = 'echoDoubleShop:';
  const reservedSupplementalKeys = new Set([
    'infernalContractReward',
    'travelDealRefill',
    'echoDoubleShopReward',
  ]);
  return createCollection(
    raw.map((profile, profileIndex): ShopProfileDeclaration => {
      const path = `shops[${profileIndex}]`;
      const key = requireNonEmpty(profile.key, `${path}.key`);
      if (profile.groups.length === 0) {
        fail(`${path}.groups`, 'must not be empty');
      }
      const groups = createCollection(
        profile.groups.map((group, groupIndex): ShopGroupDeclaration => {
          const groupPath = `${path}.groups[${groupIndex}]`;
          const offerCount = requirePositiveInteger(group.offerCount, `${groupPath}.offerCount`);
          if (offerCount > group.options.length) {
            fail(`${groupPath}.offerCount`, 'cannot exceed the number of option entries');
          }
          const options = createCollection(
            group.options.map((option, optionIndex) =>
              normalizeShopOption(option, rewardTypes, `${groupPath}.options[${optionIndex}]`),
            ),
            `${groupPath}.options`,
            (option) => option.key,
          );
          const groupRewardTypes = Object.freeze([
            ...new Set(options.values.map((option) => option.rewardType)),
          ]);
          return Object.freeze({
            key: requireNonEmpty(group.key, `${groupPath}.key`),
            offerCount,
            options,
            rewardTypes: groupRewardTypes,
          });
        }),
        `${path}.groups`,
        (group) => group.key,
      );
      const expectedGroupKeys = groups.values.flatMap((group) =>
        Array.from({ length: group.offerCount }, () => group.key),
      );
      if (profile.slots.length !== expectedGroupKeys.length) {
        fail(`${path}.slots`, `must declare exactly ${expectedGroupKeys.length} emitted slots`);
      }
      const slots = createCollection(
        profile.slots.map((slot, slotIndex): ShopSlotDeclaration => {
          const slotPath = `${path}.slots[${slotIndex}]`;
          const groupKey = requireNonEmpty(slot.groupKey, `${slotPath}.groupKey`);
          const expectedGroupKey = expectedGroupKeys[slotIndex];
          if (groupKey !== expectedGroupKey) {
            fail(`${slotPath}.groupKey`, `expected ${String(expectedGroupKey)}`);
          }
          const group = groups.byKey[groupKey];
          if (group === undefined) {
            fail(`${slotPath}.groupKey`, `unknown shop group ${groupKey}`);
          }
          const slotKey = requireNonEmpty(slot.key, `${slotPath}.key`);
          if (slotKey.startsWith(echoDuplicateKeyPrefix))
            fail(`${slotPath}.key`, `must not use reserved prefix ${echoDuplicateKeyPrefix}`);
          if (reservedSupplementalKeys.has(slotKey))
            fail(`${slotPath}.key`, `must not use reserved supplemental key ${slotKey}`);
          return Object.freeze({
            key: slotKey,
            label: requireNonEmpty(slot.label, `${slotPath}.label`),
            groupKey,
          });
        }),
        `${path}.slots`,
        (slot) => slot.key,
      );
      return Object.freeze({
        key,
        groups,
        slots,
        slotCount: slots.values.length,
      });
    }),
    'shops',
    (shop) => shop.key,
  );
}

function normalizeProducerLifecycles(
  raw: RawRewardKernelInput['producerLifecycles'],
  rewardTypes: CatalogCollection<RewardTypeDeclaration>,
): CatalogCollection<ProducerLifecycleProfileDeclaration> {
  return createCollection(
    raw.map((profile, profileIndex): ProducerLifecycleProfileDeclaration => {
      const path = `producerLifecycles[${profileIndex}]`;
      const key = requireNonEmpty(profile.key, `${path}.key`);
      const defaultLifecyclePoint = requireClosedValue(
        profile.defaultLifecyclePoint,
        PRODUCER_LIFECYCLE_POINTS,
        `${path}.defaultLifecyclePoint`,
      );
      if (profile.rewardTypes.length === 0) {
        fail(`${path}.rewardTypes`, 'must not be empty');
      }
      const supportedRewardTypes = profile.rewardTypes.map((rewardTypeName, rewardTypeIndex) => {
        const rewardTypePath = `${path}.rewardTypes[${rewardTypeIndex}]`;
        const normalizedName = requireNonEmpty(rewardTypeName, rewardTypePath);
        const rewardType = rewardTypes.byKey[normalizedName];
        if (rewardType === undefined) {
          fail(rewardTypePath, `unknown reward type ${normalizedName}`);
        }
        return rewardType;
      });
      if (
        new Set(supportedRewardTypes.map((rewardType) => rewardType.gameName)).size !==
        supportedRewardTypes.length
      ) {
        fail(`${path}.rewardTypes`, 'must be unique');
      }
      const supportedNames = new Set(supportedRewardTypes.map((rewardType) => rewardType.gameName));
      const overrides = new Map<string, readonly AcquisitionLifecycleBinding[]>();
      for (const [overrideIndex, override] of (profile.overrides ?? []).entries()) {
        const overridePath = `${path}.overrides[${overrideIndex}]`;
        const rewardTypeName = requireNonEmpty(override.rewardType, `${overridePath}.rewardType`);
        const rewardType = rewardTypes.byKey[rewardTypeName];
        if (rewardType === undefined) {
          fail(`${overridePath}.rewardType`, `unknown reward type ${rewardTypeName}`);
        }
        if (!supportedNames.has(rewardTypeName)) {
          fail(`${overridePath}.rewardType`, `${rewardTypeName} is not supported by ${key}`);
        }
        if (overrides.has(rewardTypeName)) {
          fail(`${overridePath}.rewardType`, `duplicates ${rewardTypeName}`);
        }
        overrides.set(
          rewardTypeName,
          normalizeAcquisitionLifecycle(
            override.acquisitionLifecycle,
            rewardType,
            defaultLifecyclePoint,
            overridePath,
          ),
        );
      }
      const normalizedRewardTypes = createCollection(
        supportedRewardTypes.map((rewardType): ProducerRewardLifecycleDeclaration =>
          Object.freeze({
            rewardType: rewardType.gameName,
            acquisitionLifecycle:
              overrides.get(rewardType.gameName) ??
              normalizeAcquisitionLifecycle(
                undefined,
                rewardType,
                defaultLifecyclePoint,
                `${path}.rewardTypes.${rewardType.gameName}`,
              ),
          }),
        ),
        `${path}.rewardTypes`,
        (rewardType) => rewardType.rewardType,
        'rewardType',
      );
      return Object.freeze({ key, rewardTypes: normalizedRewardTypes });
    }),
    'producerLifecycles',
    (profile) => profile.key,
  );
}

export function createRewardKernelCatalog(input: RawRewardKernelInput): RewardKernelCatalog {
  const payloadDomains = normalizePayloadDomains(input.payloadDomains);
  const acquisitions = normalizeAcquisitions(input.acquisitions);
  const rewardTypes = normalizeRewardTypes(input.rewardTypes, payloadDomains, acquisitions);
  const stores = normalizeStores(input.stores, rewardTypes);
  const shops = normalizeShops(input.shops, rewardTypes);
  const producerLifecycles = normalizeProducerLifecycles(input.producerLifecycles, rewardTypes);
  const echoLastRewardProfile = producerLifecycles.byKey.EchoLastReward;
  const recreationRewardTypes = acquisitions.values.flatMap((acquisition) =>
    acquisition.lastRewardRecreation === undefined
      ? []
      : [acquisition.lastRewardRecreation.offer.rewardType],
  );
  if (
    echoLastRewardProfile === undefined ||
    echoLastRewardProfile.rewardTypes.values.length !== recreationRewardTypes.length ||
    echoLastRewardProfile.rewardTypes.values.some(
      (entry) => !recreationRewardTypes.includes(entry.rewardType),
    )
  ) {
    fail(
      'producerLifecycles.EchoLastReward',
      'must support the exact Echo last-reward recreation set',
    );
  }
  for (const entry of echoLastRewardProfile.rewardTypes.values) {
    const lifecycle = entry.acquisitionLifecycle;
    const binding = lifecycle[0];
    if (
      lifecycle.length !== 1 ||
      binding?.role !== 'self' ||
      binding.lifecyclePoint !== 'echoReplay' ||
      binding.blocksArtificerConversion !== true
    ) {
      fail(
        `producerLifecycles.EchoLastReward.${entry.rewardType}`,
        'must bind exactly self at echoReplay and block Artificer conversion',
      );
    }
    const effect = binding.levelResolutionEffect;
    if (entry.rewardType === 'GiftDrop') {
      if (effect?.kind !== 'randomTargetIfAvailable' || effect.levelCount !== 1) {
        fail(
          'producerLifecycles.EchoLastReward.GiftDrop',
          'must apply randomTargetIfAvailable levelCount 1',
        );
      }
    } else if (effect !== undefined) {
      fail(
        `producerLifecycles.EchoLastReward.${entry.rewardType}`,
        'must not apply a level-resolution effect',
      );
    }
  }
  for (const acquisition of acquisitions.values) {
    const recreation = acquisition.lastRewardRecreation;
    if (recreation === undefined) continue;
    const rewardType = rewardTypes.byKey[recreation.offer.rewardType];
    const lifecycle = producerLifecycles.byKey[recreation.producerLifecycleKey];
    if (rewardType === undefined)
      fail(
        `acquisitions.${acquisition.gameName}.lastRewardRecreation.offer.rewardType`,
        `unknown reward type ${recreation.offer.rewardType}`,
      );
    if (lifecycle?.rewardTypes.byKey[recreation.offer.rewardType] === undefined)
      fail(
        `acquisitions.${acquisition.gameName}.lastRewardRecreation`,
        `${recreation.offer.rewardType} is not supported by ${recreation.producerLifecycleKey}`,
      );
    if (
      rewardType?.gameName !== acquisition.gameName ||
      rewardType.acquisitionRoles.values.length !== 1 ||
      rewardType.acquisitionRoles.values[0]?.key !== 'self' ||
      rewardType.acquisitionRoles.values[0].resolution.kind !== 'self' ||
      rewardType.acquisitionRoles.values[0].resolution.acquisitionKind !== acquisition.kind
    ) {
      fail(
        `acquisitions.${acquisition.gameName}.lastRewardRecreation.offer`,
        'must recreate the exact self acquisition source',
      );
    }
  }
  return Object.freeze({
    payloadDomains,
    acquisitions,
    rewardTypes,
    stores,
    shops,
    producerLifecycles,
  });
}
