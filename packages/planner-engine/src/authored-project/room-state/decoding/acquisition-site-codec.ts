import type { Catalog } from '../../../catalog-schema';
import type { AuthoredRewardState } from '../../model';
import { parseArtificerReplacementEntryKey } from '../../acquisition/artificer';
import { parseHermesShrineDeliveryEntryKey } from '../../hermes-shrine-delivery';
import {
  parseSeaStarDuplicateSiteKey,
  seaStarDuplicateUsesFreshObject,
} from '../../acquisition/sea-star';
import {
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  semanticAddressKey,
} from '../../addresses';
import type { LevelResolutionEffectSource } from '../../../reward-kernel/level-effects';
import {
  parseClockedTraitGeneratedPickupEntryKey,
  parseTraitGeneratedPickupSiteKey,
  parseNemesisGeneratedPickupSiteKey,
  type SelectedPickupProducer,
} from '../../acquisition/pickup-producers';
import {
  INFERNAL_CONTRACT_PEDESTAL_SITE_KEY,
  infernalContractPedestalProfile,
} from '../../infernal-contract-pedestal';
import { decodeNullableRewardState } from './reward-acquisition-codec';
import { expectExactKeys, expectRecord, failProjectDocument } from '../../validation';
import { ERIS_GIFT_SITE_KEY } from '../../acquisition/eris-gift';

export interface AcquisitionSiteOccurrenceContext {
  readonly path: string;
  readonly gameName: string;
  readonly routeKey: string;
  readonly biomeKey: string;
  readonly occurrenceId: string;
}

export function decodeAcquisitionSites(
  value: unknown,
  occurrence: AcquisitionSiteOccurrenceContext,
  catalog: Catalog,
  pickupProducers: readonly SelectedPickupProducer[],
  echoLastRewardEntryKeys: ReadonlySet<string>,
  shopProfileKey: string | undefined,
): Readonly<
  Record<
    string,
    {
      readonly pickupEntries?: Readonly<Record<string, AuthoredRewardState | null>>;
    }
  >
> {
  const sites = expectRecord(value, `${occurrence.path}.acquisitionSites`);
  const decoded: Record<
    string,
    {
      readonly pickupEntries?: Readonly<Record<string, AuthoredRewardState | null>>;
    }
  > = {};
  const producerByEntry = new Map<string, SelectedPickupProducer>();
  for (const producer of pickupProducers) {
    for (const pickup of producer.pickups) {
      producerByEntry.set(`${producer.siteKey}\u0000${pickup.key}`, producer);
    }
  }
  const levelEffectSourceByEntry = new Map<string, LevelResolutionEffectSource>();
  const deferredSeaStarSites: {
    readonly pointKey: string;
    readonly decodeEntries: (
      levelEffectSource: (entryKey: string) => LevelResolutionEffectSource,
    ) => Readonly<Record<string, AuthoredRewardState | null>>;
  }[] = [];
  for (const [pointKey, rawSite] of Object.entries(sites)) {
    const generatedTraitSite = parseTraitGeneratedPickupSiteKey(pointKey) !== undefined;
    const generatedNemesisSite = parseNemesisGeneratedPickupSiteKey(pointKey) !== undefined;
    const seaStarDuplicateSite = parseSeaStarDuplicateSiteKey(pointKey) !== undefined;
    if (pointKey.startsWith('traitGenerated:') && !generatedTraitSite)
      failProjectDocument(
        `${occurrence.path}.acquisitionSites.${pointKey}`,
        'has an invalid generated-pickup site key',
      );
    if (pointKey.startsWith('nemesisGenerated:') && !generatedNemesisSite)
      failProjectDocument(
        `${occurrence.path}.acquisitionSites.${pointKey}`,
        'has an invalid Nemesis generated-pickup site key',
      );
    const hermesShrineDeliverySite = pointKey === 'hermesShrineDelivery';
    const hermesDeliveryEntry = (entryKey: string) =>
      hermesShrineDeliverySite && parseHermesShrineDeliveryEntryKey(entryKey) !== undefined;
    const hermesArtificerEntry = (entryKey: string) =>
      hermesShrineDeliverySite && parseArtificerReplacementEntryKey(entryKey) !== undefined;
    const pedestalSite = pointKey === INFERNAL_CONTRACT_PEDESTAL_SITE_KEY;
    const artificerSite =
      pointKey !== 'roomExit' &&
      !pedestalSite &&
      pointKey !== ERIS_GIFT_SITE_KEY &&
      !generatedTraitSite &&
      !generatedNemesisSite &&
      !seaStarDuplicateSite &&
      !hermesShrineDeliverySite;
    const site = expectRecord(rawSite, `${occurrence.path}.acquisitionSites.${pointKey}`);
    const hasPickups = site.pickupEntries !== undefined;
    expectExactKeys(
      site,
      hasPickups ? ['pickupEntries'] : [],
      `${occurrence.path}.acquisitionSites.${pointKey}`,
    );
    const retainedEchoEntry =
      hasPickups &&
      Object.keys(
        expectRecord(
          site.pickupEntries,
          `${occurrence.path}.acquisitionSites.${pointKey}.pickupEntries`,
        ),
      ).some((key) => echoLastRewardEntryKeys.has(key));
    const expectedEntries = Object.keys(site.pickupEntries ?? {});
    const hasClockedTraitPickup = expectedEntries.some(
      (entryKey) =>
        pointKey === 'roomExit' && parseClockedTraitGeneratedPickupEntryKey(entryKey) !== undefined,
    );
    const hasProducer = expectedEntries.some((entryKey) =>
      producerByEntry.has(`${pointKey}\u0000${entryKey}`),
    );
    if (
      hasPickups &&
      !hasProducer &&
      !hasClockedTraitPickup &&
      echoLastRewardEntryKeys.size === 0 &&
      !retainedEchoEntry &&
      shopProfileKey === undefined &&
      !artificerSite &&
      !generatedTraitSite &&
      !generatedNemesisSite &&
      !seaStarDuplicateSite &&
      !hermesShrineDeliverySite &&
      !pedestalSite
    )
      failProjectDocument(
        `${occurrence.path}.acquisitionSites.${pointKey}.pickupEntries`,
        'has no selected pickup producer',
      );
    const decodeEntries = (
      levelEffectSource: (entryKey: string) => LevelResolutionEffectSource,
    ): Readonly<Record<string, AuthoredRewardState | null>> =>
      Object.freeze(
        Object.fromEntries(
          Object.entries(
            expectRecord(
              site.pickupEntries,
              `${occurrence.path}.acquisitionSites.${pointKey}.pickupEntries`,
            ),
          ).map(([key, raw]) => [
            key,
            decodeNullableRewardState(
              raw,
              catalog,
              `${occurrence.path}.acquisitionSites.${pointKey}.pickupEntries.${key}`,
              levelEffectSource(key),
              occurrence.routeKey,
              artificerSite ||
                seaStarDuplicateSite ||
                hermesDeliveryEntry(key) ||
                echoLastRewardEntryKeys.has(key)
                ? false
                : true,
            ),
          ]),
        ),
      );
    if (seaStarDuplicateSite && hasPickups) {
      deferredSeaStarSites.push({ pointKey, decodeEntries });
      continue;
    }
    const levelEffectSource = (key: string): LevelResolutionEffectSource =>
      artificerSite || hermesArtificerEntry(key)
        ? { kind: 'producerLifecycle', key: 'RoomReward' }
        : hermesDeliveryEntry(key)
          ? { kind: 'producerLifecycle', key: 'HermesShrineDelivery' }
          : pedestalSite
            ? {
                kind: 'shopProfile',
                key: infernalContractPedestalProfile(catalog, occurrence.gameName)?.key ?? '',
              }
            : pointKey === 'roomExit' && parseClockedTraitGeneratedPickupEntryKey(key) !== undefined
              ? { kind: 'producerLifecycle', key: 'GeneratedTraitPickup' }
              : shopProfileKey === undefined
                ? {
                    kind: 'producerLifecycle',
                    key: echoLastRewardEntryKeys.has(key)
                      ? 'EchoLastReward'
                      : (producerByEntry.get(`${pointKey}\u0000${key}`)?.producerLifecycleKey ??
                        ''),
                  }
                : { kind: 'shopProfile', key: shopProfileKey };
    for (const key of Object.keys(site.pickupEntries ?? {}))
      levelEffectSourceByEntry.set(`${pointKey}\u0000${key}`, levelEffectSource(key));
    const pickupEntries = hasPickups ? decodeEntries(levelEffectSource) : undefined;
    decoded[pointKey] = Object.freeze({
      ...(pickupEntries === undefined ? {} : { pickupEntries }),
    });
  }
  // A retained consumable duplicate settles through its source's own producer,
  // so it is decoded after that source; a fresh loot duplicate is a RoomReward.
  for (const { pointKey, decodeEntries } of deferredSeaStarSites) {
    const levelEffectSource = seaStarDuplicateLevelEffectSource(
      catalog,
      pointKey,
      occurrence,
      decoded,
      levelEffectSourceByEntry,
    );
    decoded[pointKey] = Object.freeze({ pickupEntries: decodeEntries(() => levelEffectSource) });
  }
  return Object.freeze(
    Object.fromEntries(Object.keys(sites).map((pointKey) => [pointKey, decoded[pointKey]!])),
  );
}

function seaStarDuplicateLevelEffectSource(
  catalog: Catalog,
  pointKey: string,
  occurrence: AcquisitionSiteOccurrenceContext,
  decoded: Readonly<
    Record<
      string,
      { readonly pickupEntries?: Readonly<Record<string, AuthoredRewardState | null>> }
    >
  >,
  levelEffectSourceByEntry: ReadonlyMap<string, LevelResolutionEffectSource>,
): LevelResolutionEffectSource {
  const roomReward = { kind: 'producerLifecycle', key: 'RoomReward' } as const;
  const parsed = parseSeaStarDuplicateSiteKey(pointKey);
  if (parsed === undefined) return roomReward;
  const occurrenceAddress = createOccurrenceAddress(
    createBiomeAddress(occurrence.routeKey, occurrence.biomeKey),
    createOccurrenceId(occurrence.occurrenceId),
  );
  for (const [sourcePointKey, site] of Object.entries(decoded)) {
    for (const [entryKey, entry] of Object.entries(site.pickupEntries ?? {})) {
      const owner = createAcquisitionEntryAddress(
        createAcquisitionSiteAddress(occurrenceAddress, sourcePointKey),
        entryKey,
      );
      if (semanticAddressKey(owner) !== parsed.sourceKey) continue;
      if (
        entry === null ||
        catalog.rewards.rewardTypes.byKey[entry.offer.rewardType]?.acquisitionRoles.byKey[
          parsed.acquisitionRole
        ] === undefined ||
        seaStarDuplicateUsesFreshObject(catalog, entry, parsed.acquisitionRole)
      )
        return roomReward;
      return levelEffectSourceByEntry.get(`${sourcePointKey}\u0000${entryKey}`) ?? roomReward;
    }
  }
  return roomReward;
}
