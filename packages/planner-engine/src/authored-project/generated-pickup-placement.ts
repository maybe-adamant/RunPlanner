import type { OccurrenceAddress } from './addresses';
import type { AuthoredRoutePlan, HermesShrineGenerationKey, RoomActionReference } from './model';
import {
  HERMES_SHRINE_DELIVERY_SITE_KEY,
  hermesShrineDeliverySourceAddress,
  hermesShrineDeliverySourceIsStructurallyActive,
  isSameRoomDelivery,
  parseHermesShrineDeliveryEntryKey,
} from './hermes-shrine-delivery';

export type GeneratedPickupSource =
  | {
      readonly kind: 'hermesShrineDelivery';
      /** The Shrine room that sold the item. */
      readonly shrine: OccurrenceAddress;
      /** The Shrine stock the item was bought from. */
      readonly generationKey: HermesShrineGenerationKey;
    }
  | {
      readonly kind: 'clockedTraitPickup';
      readonly acquisitionIdentity: string;
    };

/** Placement truth is separate from required participation and reward completeness. */
export type GeneratedPickupPlacementAssessment =
  | { readonly kind: 'valid'; readonly source: GeneratedPickupSource }
  | { readonly kind: 'unassessed'; readonly source: GeneratedPickupSource }
  | {
      readonly kind: 'invalid';
      readonly source: GeneratedPickupSource;
      readonly reason: 'sourceInactive' | 'dueContactMismatch';
    };

export function hermesShrineDeliveryPickupSource(
  shrine: OccurrenceAddress,
  generationKey: HermesShrineGenerationKey,
): GeneratedPickupSource {
  return Object.freeze({ kind: 'hermesShrineDelivery', shrine, generationKey });
}

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
  const shrine = hermesShrineDeliverySourceAddress(parsed);
  if (isSameRoomDelivery(shrine, host)) return undefined;
  const source = hermesShrineDeliveryPickupSource(shrine, parsed.generationKey);
  return hermesShrineDeliverySourceIsStructurallyActive(route, parsed)
    ? Object.freeze({ kind: 'unassessed', source })
    : Object.freeze({ kind: 'invalid', source, reason: 'sourceInactive' });
}

/** Retained placements with independent structural proof, without lifecycle products. */
export function structurallyInvalidGeneratedPickupPlacements(
  route: AuthoredRoutePlan,
  host: OccurrenceAddress,
  order: readonly RoomActionReference[],
): readonly {
  readonly reference: RoomActionReference;
  readonly assessment: Extract<GeneratedPickupPlacementAssessment, { readonly kind: 'invalid' }>;
}[] {
  return Object.freeze(
    order.flatMap((reference) => {
      const assessment = assessGeneratedPickupPlacement(route, host, reference);
      return assessment?.kind === 'invalid' ? [Object.freeze({ reference, assessment })] : [];
    }),
  );
}
