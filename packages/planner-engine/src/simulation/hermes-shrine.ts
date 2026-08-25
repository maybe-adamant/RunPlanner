import type { Catalog } from '../catalog-schema';
import type { HermesShrineState } from '../authored-project/model';
import { evaluateRequirement, type RequirementEvaluationContext } from '../requirements/evaluator';
export {
  HERMES_SHRINE_DELIVERY_SITE_KEY,
  hermesShrineDeliveryEntryKey,
  parseHermesShrineDeliveryEntryKey,
} from '../authored-project/hermes-shrine-delivery';
type HermesShrineSlotKey = import('../authored-project/model').HermesShrineSlotKey;
const SLOT_KEYS = [
  'first',
  'secondLeft',
  'secondRight',
] as const satisfies readonly HermesShrineSlotKey[];

/**
 * The source action remains the only authored Shrine delivery fact.  This
 * small evaluator deliberately accepts the lifecycle stream rather than a
 * mutable run-state object: callers can derive both a prefix reservation and
 * a later delivery host without persisting a shadow pending-delivery model.
 */
export interface HermesShrinePurchaseScheduleInput {
  readonly sourceKey: string;
  readonly sourceSequence: number;
  readonly sourceOrigin: import('../authored-project/addresses').OccurrenceAddress;
  readonly rewardType: string;
  readonly delay: 2 | 3 | 4 | 5 | 6 | 7 | 8;
  readonly rushed: boolean;
}

export interface HermesShrineDeliveryLifecycleEvent {
  readonly sequence: number;
  readonly kind: 'encounterEndEffectsApplied' | 'finalPrebossCompletion';
  readonly origin: import('../authored-project/addresses').OccurrenceAddress;
}

export interface DerivedHermesShrineDelivery {
  readonly sourceKey: string;
  readonly sourceOrigin: import('../authored-project/addresses').OccurrenceAddress;
  readonly rewardType: string;
  /** Rush resolves at the source action; ordinary countdowns resolve later. */
  readonly deliveryKind: 'rush' | 'countdown' | 'finalPrebossCompletion' | 'pending';
  readonly hostOrigin?: import('../authored-project/addresses').OccurrenceAddress;
  readonly hostSequence?: number;
  readonly remainingUses: number;
}

/**
 * Derive each independent pending Shrine item from actions plus reached
 * lifecycle events.  The purchase room cannot decrement a newly-created
 * item because only later events are considered.  Callers emit
 * `finalPrebossCompletion` only for the reached fourth-biome Preboss.
 */
export function deriveHermesShrineDeliveries(
  purchases: readonly HermesShrinePurchaseScheduleInput[],
  lifecycle: readonly HermesShrineDeliveryLifecycleEvent[],
): readonly DerivedHermesShrineDelivery[] {
  const orderedEvents = [...lifecycle].sort((left, right) => left.sequence - right.sequence);
  return Object.freeze(
    purchases.map((purchase) => {
      if (purchase.rushed)
        return Object.freeze({
          sourceKey: purchase.sourceKey,
          sourceOrigin: purchase.sourceOrigin,
          rewardType: purchase.rewardType,
          deliveryKind: 'rush' as const,
          hostOrigin: purchase.sourceOrigin,
          hostSequence: purchase.sourceSequence,
          remainingUses: 0,
        });
      let remainingUses = purchase.delay;
      for (const event of orderedEvents) {
        if (event.sequence <= purchase.sourceSequence) continue;
        if (event.kind === 'finalPrebossCompletion')
          return Object.freeze({
            sourceKey: purchase.sourceKey,
            sourceOrigin: purchase.sourceOrigin,
            rewardType: purchase.rewardType,
            deliveryKind: 'finalPrebossCompletion' as const,
            hostOrigin: event.origin,
            hostSequence: event.sequence,
            remainingUses: 0,
          });
        remainingUses -= 1;
        if (remainingUses === 0)
          return Object.freeze({
            sourceKey: purchase.sourceKey,
            sourceOrigin: purchase.sourceOrigin,
            rewardType: purchase.rewardType,
            deliveryKind: 'countdown' as const,
            hostOrigin: event.origin,
            hostSequence: event.sequence,
            remainingUses: 0,
          });
      }
      return Object.freeze({
        sourceKey: purchase.sourceKey,
        sourceOrigin: purchase.sourceOrigin,
        rewardType: purchase.rewardType,
        deliveryKind: 'pending' as const,
        remainingUses,
      });
    }),
  );
}

/**
 * A delayed SpellDrop reserves later generation until its actual pickup
 * settles. A countdown which has reached its host is still pending: its
 * pickup can be stale, unresolved, or fail ordinary settlement.
 */
export function hasPendingHermesSpellDrop(
  deliveries: readonly DerivedHermesShrineDelivery[],
): boolean {
  return deliveries.some(
    (delivery) => delivery.rewardType === 'SpellDrop' && delivery.deliveryKind !== 'rush',
  );
}

/**
 * Lifecycle composition needs one unbranched requirement input. Delayed
 * delivery may carry several independent items, but the Spell reservation is
 * a single boolean that must agree across the seed frontier.
 */
export function attestPendingHermesSpellDrop(
  branches: readonly {
    readonly pendingHermesShrineDeliveries?: Readonly<
      Record<string, { readonly reward: { readonly offer: { readonly rewardType: string } } }>
    >;
  }[],
): boolean {
  const values = branches.map((branch) =>
    Object.values(branch.pendingHermesShrineDeliveries ?? {}).some(
      (delivery) => delivery.reward.offer.rewardType === 'SpellDrop',
    ),
  );
  const first = values[0] ?? false;
  if (values.some((value) => value !== first)) {
    throw new Error('Hermes Shrine Spell reservation frontier is divergent');
  }
  return first;
}

export type HermesShrineInventoryIssue =
  | {
      readonly kind: 'missing';
      readonly slotKey: import('../authored-project/model').HermesShrineSlotKey;
    }
  | {
      readonly kind: 'wrongGroup';
      readonly slotKey: import('../authored-project/model').HermesShrineSlotKey;
    }
  | { readonly kind: 'duplicateSecondGroup' }
  | {
      readonly kind: 'requirement';
      readonly slotKey: import('../authored-project/model').HermesShrineSlotKey;
    };

export interface HermesShrinePlacementAssessment {
  /** Forced Postboss Shrines bypass the ordinary chance/anchor/spacing gate. */
  readonly forced: boolean;
  /** Ordinary entry-time eligibility; retained authored state is never discarded. */
  readonly eligible: boolean;
  /** The two immediately preceding physical entered positions, without identity collapse. */
  readonly priorShrineCount: number;
}

export interface HermesShrineAssessment {
  readonly placement: HermesShrinePlacementAssessment;
  readonly inventoryIssues: readonly HermesShrineInventoryIssue[];
  /** Exact per-slot entry-generation domain after group, peer, and prefix requirements. */
  readonly candidateRewardTypesBySlot: Readonly<Record<HermesShrineSlotKey, readonly string[]>>;
  readonly complete: boolean;
}

/** Presence is assessed even before an ordinary Shrine is authored. */
export interface HermesShrineCandidateContext {
  readonly placement: HermesShrinePlacementAssessment;
  readonly inventory?: HermesShrineAssessment | undefined;
  /** Published only at the exact first qualifying rushed initial purchase. */
  readonly travelDealRefill?: HermesShrineTravelDealRefillAssessment | undefined;
}

/**
 * Travel Deal regenerates one fourth, same-physical-slot Shrine generation.
 * The generation is intentionally not a replacement initial slot: the three
 * visible entry identities remain immutable evidence for the action prefix.
 */
export interface HermesShrineTravelDealRefillAssessment {
  readonly sourceGenerationKey: import('../authored-project/model').HermesShrineGenerationKey;
  readonly candidateRewardTypes: readonly string[];
}

export function assessHermesShrineTravelDealRefill(
  catalog: Catalog,
  shrine: HermesShrineState,
  sourceGenerationKey: import('../authored-project/model').HermesShrineGenerationKey,
  requirements: readonly RequirementEvaluationContext[],
): HermesShrineTravelDealRefillAssessment | undefined {
  const slotKey = sourceGenerationKey.startsWith('initial:')
    ? (sourceGenerationKey.slice('initial:'.length) as HermesShrineSlotKey)
    : undefined;
  if (slotKey === undefined || !SLOT_KEYS.includes(slotKey)) return undefined;
  const profile = catalog.rewards.shops.byKey.SurfaceShop;
  const group = profile?.groups.byKey[profile.slots.byKey[slotKey]?.groupKey ?? ''];
  if (group === undefined) return undefined;
  // The game excludes the rushed interaction and every currently visible
  // initial identity before retrying.  In this compact authored model each
  // initial identity is already visible, so one set expresses both rules.
  const excluded = new Set(
    Object.values(shrine.offerBySlot)
      .filter((offer): offer is NonNullable<typeof offer> => offer !== null)
      .map((offer) => offer.offer.rewardType),
  );
  return Object.freeze({
    sourceGenerationKey,
    candidateRewardTypes: Object.freeze(
      group.options.values
        .filter((option) => !excluded.has(option.rewardType))
        .filter((option) =>
          requirements.every(
            (requirement) =>
              option.requirement === undefined ||
              evaluateRequirement(option.requirement, requirement),
          ),
        )
        .map((option) => option.rewardType),
    ),
  });
}

/** The current room is the final entry; preceding physical positions remain intact. */
export function priorTwoSurfaceShopPresence(
  appearances: readonly { readonly surfaceShopPresent?: boolean; readonly origin?: unknown }[],
): readonly boolean[] {
  return Object.freeze(
    appearances
      .slice(0, -1)
      .slice(-2)
      .map((appearance) => appearance.surfaceShopPresent === true),
  );
}

export function assessHermesShrinePlacement(
  declaration: import('../catalog-schema').RoomDeclaration | undefined,
  priorEnteredShrineFlags: readonly boolean[],
): HermesShrinePlacementAssessment {
  const surfaceShop = declaration?.surfaceShop;
  const forced = surfaceShop?.forced === true;
  const priorShrineCount = priorEnteredShrineFlags.filter(Boolean).length;
  return Object.freeze({
    forced,
    eligible:
      forced ||
      (surfaceShop !== undefined &&
        surfaceShop.spawnChance > 0 &&
        (declaration?.challengeSwitchAnchorCount ?? 0) > 0 &&
        priorShrineCount === 0),
    priorShrineCount,
  });
}

/**
 * Assesses one Shrine at its room-entry frontier. `priorEnteredShrineFlags`
 * deliberately describes physical history positions rather than game-name
 * membership: revisits, side rooms, shops, automatic rooms, and Chaos all
 * occupy a window slot.
 */
export function assessHermesShrine(
  catalog: Catalog,
  declaration: import('../catalog-schema').RoomDeclaration | undefined,
  shrine: HermesShrineState,
  requirements: RequirementEvaluationContext,
  priorEnteredShrineFlags: readonly boolean[],
): HermesShrineAssessment {
  const placement = assessHermesShrinePlacement(declaration, priorEnteredShrineFlags);
  const profile = catalog.rewards.shops.byKey.SurfaceShop;
  const candidateRewardTypesBySlot = Object.freeze(
    Object.fromEntries(
      SLOT_KEYS.map((slotKey) => {
        const group = profile?.groups.byKey[profile.slots.byKey[slotKey]!.groupKey];
        const peer =
          slotKey === 'first'
            ? undefined
            : shrine.offerBySlot[slotKey === 'secondLeft' ? 'secondRight' : 'secondLeft'];
        return [
          slotKey,
          Object.freeze(
            (group?.options.values ?? [])
              .filter(
                (option) =>
                  peer === null ||
                  peer === undefined ||
                  option.rewardType !== peer.offer.rewardType,
              )
              .filter(
                (option) =>
                  option.requirement === undefined ||
                  evaluateRequirement(option.requirement, requirements),
              )
              .map((option) => option.rewardType),
          ),
        ];
      }),
    ) as Record<HermesShrineSlotKey, readonly string[]>,
  );
  const inventoryIssues = assessHermesShrineInventory(catalog, shrine, requirements);
  return Object.freeze({
    placement,
    inventoryIssues,
    candidateRewardTypesBySlot,
    complete: placement.eligible && inventoryIssues.length === 0,
  });
}

/**
 * This is deliberately only the entry-inventory structural gate. Runtime
 * requirements are evaluated by the candidate/reward owner at its exact
 * history frontier; an invalid retained inventory must never masquerade as a
 * visible game StoreOptions list in the meantime.
 */
export function assessHermesShrineInventory(
  catalog: Catalog,
  shrine: HermesShrineState,
  requirements?: RequirementEvaluationContext,
): readonly HermesShrineInventoryIssue[] {
  const profile = catalog.rewards.shops.byKey.SurfaceShop;
  if (profile === undefined) return Object.freeze([{ kind: 'wrongGroup', slotKey: 'first' }]);
  const issues: HermesShrineInventoryIssue[] = [];
  for (const slotKey of SLOT_KEYS) {
    const offer = shrine.offerBySlot[slotKey];
    if (offer === null) {
      issues.push(Object.freeze({ kind: 'missing', slotKey }));
      continue;
    }
    const group = profile.groups.byKey[profile.slots.byKey[slotKey]!.groupKey]!;
    if (!group.rewardTypes.includes(offer.offer.rewardType))
      issues.push(Object.freeze({ kind: 'wrongGroup', slotKey }));
    const option = group.options.values.find(
      (candidate) => candidate.rewardType === offer.offer.rewardType,
    );
    if (
      requirements !== undefined &&
      option?.requirement !== undefined &&
      !evaluateRequirement(option.requirement, requirements)
    )
      issues.push(Object.freeze({ kind: 'requirement', slotKey }));
  }
  const left = shrine.offerBySlot.secondLeft;
  const right = shrine.offerBySlot.secondRight;
  if (left !== null && right !== null && left.offer.rewardType === right.offer.rewardType)
    issues.push(Object.freeze({ kind: 'duplicateSecondGroup' }));
  return Object.freeze(issues);
}
