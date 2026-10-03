import { createBiomeAddress, createOccurrenceAddress, type OccurrenceAddress } from './addresses';
import type { AuthoredRoutePlan, RoomActionReference } from './model';
import {
  HERMES_SHRINE_DELIVERY_SITE_KEY,
  hermesShrineDeliverySourceIsStructurallyActive,
  parseHermesShrineDeliveryEntryKey,
} from './hermes-shrine-delivery';

/** Placement truth is separate from required participation and reward completeness. */
export type GeneratedPickupPlacementAssessment =
  | { readonly kind: 'valid'; readonly source: OccurrenceAddress }
  | { readonly kind: 'unassessed'; readonly source: OccurrenceAddress }
  | {
      readonly kind: 'invalid';
      readonly source: OccurrenceAddress;
      readonly reason: 'sourceInactive';
    };

/** Structural proof requires no reached lifecycle context; live timing remains unassessed. */
export function assessGeneratedPickupPlacement(
  route: AuthoredRoutePlan,
  host: OccurrenceAddress,
  reference: RoomActionReference,
): GeneratedPickupPlacementAssessment | undefined {
  if (
    reference.kind !== 'interactAcquisitionEntry' ||
    reference.siteKey !== HERMES_SHRINE_DELIVERY_SITE_KEY
  )
    return undefined;
  const parsed = parseHermesShrineDeliveryEntryKey(reference.entryKey);
  if (parsed === undefined) return undefined;
  const source = createOccurrenceAddress(
    createBiomeAddress(parsed.routeKey, parsed.biomeKey),
    parsed.sourceOccurrenceId,
  );
  if (
    source.routeKey === host.routeKey &&
    source.biomeKey === host.biomeKey &&
    source.occurrenceId === host.occurrenceId
  )
    return undefined;
  return hermesShrineDeliverySourceIsStructurallyActive(route, parsed)
    ? Object.freeze({ kind: 'unassessed', source })
    : Object.freeze({ kind: 'invalid', source, reason: 'sourceInactive' });
}
