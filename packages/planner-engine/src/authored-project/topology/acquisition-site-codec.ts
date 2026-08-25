import type { Catalog } from '../../catalog-schema';
import type { AuthoredRewardState } from '../model';
import { parseArtificerReplacementEntryKey } from '../artificer';
import { parseHermesShrineDeliveryEntryKey } from '../hermes-shrine-delivery';
import { parseSeaStarDuplicateSiteKey } from '../sea-star';
import {
  parseTraitGeneratedPickupSiteKey,
  parseNemesisGeneratedPickupSiteKey,
  type SelectedPickupProducer,
} from '../pickup-producers';
import { INFERNAL_CONTRACT_ENTRY_KEY } from '../shop';
import { decodeNullableRewardState } from '../room-state/reward-acquisition-codec';
import { expectExactKeys, expectRecord, failProjectDocument } from '../validation';

export interface AcquisitionSiteOccurrenceContext {
  readonly path: string;
  readonly gameName: string;
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
    const artificerSite =
      pointKey !== 'roomExit' &&
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
    const hasProducer = expectedEntries.some((entryKey) =>
      producerByEntry.has(`${pointKey}\u0000${entryKey}`),
    );
    if (
      hasPickups &&
      !hasProducer &&
      echoLastRewardEntryKeys.size === 0 &&
      !retainedEchoEntry &&
      shopProfileKey === undefined &&
      !artificerSite &&
      !generatedTraitSite &&
      !generatedNemesisSite &&
      !seaStarDuplicateSite &&
      !hermesShrineDeliverySite
    )
      failProjectDocument(
        `${occurrence.path}.acquisitionSites.${pointKey}.pickupEntries`,
        'has no selected pickup producer',
      );
    const pickupEntries = hasPickups
      ? Object.freeze(
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
                artificerSite || seaStarDuplicateSite || hermesArtificerEntry(key)
                  ? { kind: 'producerLifecycle', key: 'RoomReward' }
                  : hermesDeliveryEntry(key)
                    ? { kind: 'producerLifecycle', key: 'HermesShrineDelivery' }
                    : shopProfileKey === undefined
                      ? {
                          kind: 'producerLifecycle',
                          key: echoLastRewardEntryKeys.has(key)
                            ? 'EchoLastReward'
                            : (producerByEntry.get(`${pointKey}\u0000${key}`)
                                ?.producerLifecycleKey ?? ''),
                        }
                      : key === INFERNAL_CONTRACT_ENTRY_KEY
                        ? {
                            kind: 'producerLifecycle',
                            key:
                              catalog.rooms.byKey[occurrence.gameName]?.infernalContractReward
                                ?.producerLifecycleKey ?? '',
                          }
                        : { kind: 'shopProfile', key: shopProfileKey },
                artificerSite ||
                  seaStarDuplicateSite ||
                  hermesDeliveryEntry(key) ||
                  echoLastRewardEntryKeys.has(key)
                  ? false
                  : true,
              ),
            ]),
          ),
        )
      : undefined;
    decoded[pointKey] = Object.freeze({
      ...(pickupEntries === undefined ? {} : { pickupEntries }),
    });
  }
  return Object.freeze(decoded);
}
