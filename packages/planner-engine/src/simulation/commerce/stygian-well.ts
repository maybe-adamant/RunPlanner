import { semanticAddressKey, type OccurrenceAddress } from '../../authored-project/addresses';
import { routeRoomShop } from '../../authored-project/route-profile';
import type { StygianWellState } from '../../authored-project/model';
import type { Catalog, RoomDeclaration } from '../../catalog-schema';
import type { StygianWellClock, StygianWellGrant } from '../../reward-kernel';

export const STYGIAN_WELL_SLOT_KEYS = ['healing', 'secondLeft', 'secondRight'] as const;
/** Closed planner-modeled effect a Well offer publishes; derived from its declared grant. */
export type StygianWellEffect =
  | 'neutral'
  | 'spark'
  | 'yarn'
  | 'hymn'
  | 'discount'
  | 'emptySlot'
  | 'extended'
  | 'twist'
  | 'lastStand';
type ExtendedCharge = Extract<StygianWellGrant, { readonly charge: 'extended' }>;

function wellOptions(catalog: Catalog) {
  return (
    catalog.rewards.shops.byKey.RoomShop?.groups.values.flatMap((group) => group.options.values) ??
    []
  );
}

function wellOption(catalog: Catalog, itemKey: string) {
  return wellOptions(catalog).find((option) => option.key === itemKey);
}

export function stygianWellGrant(catalog: Catalog, itemKey: string): StygianWellGrant | undefined {
  return wellOption(catalog, itemKey)?.stygianWell?.grant;
}

export function stygianWellOfferEffect(grant: StygianWellGrant): StygianWellEffect {
  switch (grant.kind) {
    case 'charge':
      return grant.charge;
    case 'twist':
      return 'twist';
    case 'timedTrait':
    case 'consumable':
      return grant.publishedEffect ?? 'neutral';
    case 'ledger':
    case 'immediate':
      return 'neutral';
  }
}

export function twistResultItemKeys(catalog: Catalog): readonly string[] {
  const grant = wellOptions(catalog).find((option) => option.stygianWell?.grant.kind === 'twist')
    ?.stygianWell?.grant;
  return Object.freeze([...(grant?.kind === 'twist' ? grant.pool : [])]);
}

function extendedCharge(catalog: Catalog): ExtendedCharge | undefined {
  for (const option of wellOptions(catalog)) {
    const grant = option.stygianWell?.grant;
    if (grant?.kind === 'charge' && grant.charge === 'extended') return grant;
  }
  return undefined;
}

export function extendedWellItemKeys(catalog: Catalog): readonly string[] {
  return Object.freeze([...(extendedCharge(catalog)?.eligibleItemKeys ?? [])]);
}

/** Native `HasNone` self-gate: the item is withheld while its own trait is active. */
function inactiveGateBlocked(
  option: ReturnType<typeof wellOption>,
  state: Pick<StygianWellRunState, 'timedInstances'> | undefined,
): boolean {
  const grant = option?.stygianWell?.grant;
  return (
    option?.stygianWell?.offerRequirements?.includes('inactive') === true &&
    grant?.kind === 'timedTrait' &&
    (state?.timedInstances.some((instance) => instance.traitKey === grant.traitKey) ?? false)
  );
}

export interface StygianWellAssessment {
  readonly placement: StygianWellPlacementAssessment;
  readonly interacted: boolean;
  readonly forced: boolean;
  readonly eligible: boolean;
  readonly complete: boolean;
  readonly candidateItemKeysBySlot: Readonly<
    Record<import('../../authored-project/model').StygianWellSlotKey, readonly string[]>
  >;
  readonly issues: readonly StygianWellInventoryAssessmentIssue[];
}

/** A duplicate names the slot that repeats an earlier slot. */
export interface StygianWellInventoryAssessmentIssue {
  readonly kind: 'missing' | 'wrongGroup' | 'duplicate';
  readonly generationKey: import('../../authored-project/model').StygianWellGenerationKey;
}

export interface StygianWellPlacementAssessment {
  readonly forced: boolean;
  readonly eligible: boolean;
  readonly priorWellCount: number;
}

export interface StygianWellEntryCandidateContext {
  readonly placement: StygianWellPlacementAssessment;
  readonly inventory?: StygianWellAssessment;
}

export type StygianWellCandidateContext =
  StygianWellEntryCandidateContext | { readonly purchase: StygianWellPurchaseAssessment };

export interface StygianWellPurchaseAssessment {
  readonly generationKey: import('../../authored-project/model').StygianWellGenerationKey;
  readonly travelDealRefill?: {
    readonly sourceGenerationKey: Exclude<
      import('../../authored-project/model').StygianWellGenerationKey,
      'travelDealRefill'
    >;
    readonly candidateItemKeys: readonly string[];
  };
  readonly twistCandidateItemKeys?: readonly string[];
  readonly issues: readonly (
    | {
        readonly kind: 'refillMissing' | 'refillWrongGroup' | 'refillDuplicate';
        readonly generationKey: 'travelDealRefill';
      }
    | {
        readonly kind: 'twistMissing' | 'twistInvalid';
        readonly generationKey: import('../../authored-project/model').StygianWellGenerationKey;
      }
  )[];
}

/** The entry ledger includes the current room; Wells require three intervening rooms. */
export function priorThreeRoomShopPresence(
  appearances: readonly { readonly roomShopPresent?: boolean }[],
): readonly boolean[] {
  return Object.freeze(
    appearances
      .slice(0, -1)
      .slice(-3)
      .map((appearance) => appearance.roomShopPresent === true),
  );
}

export function assessStygianWellPlacement(
  declaration: RoomDeclaration | undefined,
  routeKey: string,
  priorEnteredWellFlags: readonly boolean[],
  biomeDepthCache: number,
): StygianWellPlacementAssessment {
  const roomShop = routeRoomShop(declaration, routeKey);
  const forced = roomShop?.forced === true;
  const priorWellCount = priorEnteredWellFlags.filter(Boolean).length;
  return Object.freeze({
    forced,
    eligible:
      forced ||
      (roomShop !== undefined &&
        biomeDepthCache >= 3 &&
        roomShop.spawnChance > 0 &&
        (declaration?.challengeSwitchAnchorCount ?? 0) > 0 &&
        priorWellCount === 0),
    priorWellCount,
  });
}

function wellCandidateItemKeys(
  catalog: Catalog,
  routeKey: string,
  state: Pick<StygianWellRunState, 'timedInstances'> | undefined,
  traitHistory: import('../traits').TraitHistoryState | undefined,
  slot: import('../../authored-project/model').StygianWellSlotKey,
): readonly string[] {
  const profile = catalog.rewards.shops.byKey.RoomShop;
  const hasEmptyPrimaryOrSecondary =
    traitHistory === undefined ||
    traitHistory.equippedSlots.Attack === undefined ||
    traitHistory.equippedSlots.Special === undefined;
  return Object.freeze(
    [
      ...(profile?.slots.values.find((entry) => entry.key === slot)?.groupKey === 'Healing'
        ? (profile.groups.byKey.Healing?.options.values ?? [])
        : (profile?.groups.byKey.Other?.options.values ?? [])),
    ]
      .filter((option) => {
        if (option.stygianWell?.excludedRouteKeys?.includes(routeKey)) return false;
        const requirements = option.stygianWell?.offerRequirements ?? [];
        if (inactiveGateBlocked(option, state)) return false;
        return !requirements.includes('emptyAttackOrSpecial') || hasEmptyPrimaryOrSecondary;
      })
      .map((option) => option.key),
  );
}

/** Inventory-level assessment intentionally contains no price or pickup policy. */
export function assessStygianWell(
  catalog: Catalog,
  routeKey: string,
  room: RoomDeclaration | undefined,
  biomeDepthCache: number,
  well: StygianWellState,
  state?: Pick<StygianWellRunState, 'timedInstances'>,
  traitHistory?: import('../traits').TraitHistoryState,
  priorEnteredWellFlags: readonly boolean[] = Object.freeze([]),
): StygianWellAssessment {
  const declaration = routeRoomShop(room, routeKey);
  const placement = assessStygianWellPlacement(
    room,
    routeKey,
    priorEnteredWellFlags,
    biomeDepthCache,
  );
  const domains = Object.freeze({
    healing: wellCandidateItemKeys(catalog, routeKey, state, traitHistory, 'healing'),
    secondLeft: wellCandidateItemKeys(catalog, routeKey, state, traitHistory, 'secondLeft'),
    secondRight: wellCandidateItemKeys(catalog, routeKey, state, traitHistory, 'secondRight'),
  });
  if (!well.interacted)
    return Object.freeze({
      placement,
      interacted: false,
      forced: declaration?.forced === true,
      eligible: placement.eligible,
      complete: false,
      candidateItemKeysBySlot: domains,
      issues: Object.freeze([]),
    });
  const issues: StygianWellInventoryAssessmentIssue[] = [];
  for (const key of STYGIAN_WELL_SLOT_KEYS) {
    const generationKey = `initial:${key}` as const;
    if (well.offerKeyBySlot[key] === null) {
      issues.push({ kind: 'missing', generationKey });
    } else if (!domains[key].includes(well.offerKeyBySlot[key]!)) {
      issues.push({ kind: 'wrongGroup', generationKey });
    }
  }
  STYGIAN_WELL_SLOT_KEYS.forEach((key, index) => {
    const value = well.offerKeyBySlot[key];
    if (
      value !== null &&
      STYGIAN_WELL_SLOT_KEYS.slice(0, index).some(
        (earlier) => well.offerKeyBySlot[earlier] === value,
      )
    )
      issues.push({ kind: 'duplicate', generationKey: `initial:${key}` });
  });
  return Object.freeze({
    placement,
    interacted: true,
    forced: declaration?.forced === true,
    eligible: placement.eligible,
    complete: issues.length === 0,
    candidateItemKeysBySlot: domains,
    issues: Object.freeze(issues),
  });
}

/** Assesses one reached Well purchase against its exact pre-effect branch state. */
export function assessStygianWellPurchase(
  catalog: Catalog,
  routeKey: string,
  well: StygianWellState,
  generationKey: import('../../authored-project/model').StygianWellGenerationKey,
  state: Pick<StygianWellRunState, 'timedInstances'>,
  traitHistory: import('../traits').TraitHistoryState | undefined,
  firstPurchaseGenerationKey:
    import('../../authored-project/model').StygianWellGenerationKey | undefined,
): StygianWellPurchaseAssessment {
  const slot = generationKey.startsWith('initial:')
    ? (generationKey.slice(
        'initial:'.length,
      ) as import('../../authored-project/model').StygianWellSlotKey)
    : undefined;
  const itemKey =
    generationKey === 'travelDealRefill'
      ? well.travelDealRefillKey
      : slot === undefined
        ? undefined
        : well.offerKeyBySlot[slot];
  const issues: StygianWellPurchaseAssessment['issues'][number][] = [];
  const isFirstInitialPurchase = firstPurchaseGenerationKey === generationKey && slot !== undefined;
  const travelDealRefill =
    !isFirstInitialPurchase || traitHistory?.equippedTraits.RestockBoon === undefined
      ? undefined
      : (() => {
          const selected = Object.values(well.offerKeyBySlot).filter(
            (key): key is string => key !== null,
          );
          const sourceDomain = wellCandidateItemKeys(catalog, routeKey, state, traitHistory, slot);
          const candidateItemKeys = Object.freeze(
            sourceDomain.filter((key) => !selected.includes(key)),
          );
          const refill = well.travelDealRefillKey;
          if (refill === undefined || refill === null)
            issues.push({ kind: 'refillMissing', generationKey: 'travelDealRefill' });
          else if (!candidateItemKeys.includes(refill))
            issues.push({
              kind: sourceDomain.includes(refill) ? 'refillDuplicate' : 'refillWrongGroup',
              generationKey: 'travelDealRefill',
            });
          return Object.freeze({
            sourceGenerationKey: generationKey as Exclude<
              import('../../authored-project/model').StygianWellGenerationKey,
              'travelDealRefill'
            >,
            candidateItemKeys,
          });
        })();
  const twistCandidateItemKeys =
    itemKey !== 'RandomStoreItem'
      ? undefined
      : Object.freeze(
          twistResultItemKeys(catalog).filter(
            (key) => !inactiveGateBlocked(wellOption(catalog, key), state),
          ),
        );
  if (twistCandidateItemKeys !== undefined) {
    const childKey = generationKey === 'travelDealRefill' ? 'travelDealRefill' : slot!;
    const result = well.twistResultKeyBySlot?.[childKey];
    if (result === undefined || result === null)
      issues.push({ kind: 'twistMissing', generationKey });
    else if (!twistCandidateItemKeys.includes(result))
      issues.push({ kind: 'twistInvalid', generationKey });
  }
  return Object.freeze({
    generationKey,
    ...(travelDealRefill === undefined ? {} : { travelDealRefill }),
    ...(twistCandidateItemKeys === undefined ? {} : { twistCandidateItemKeys }),
    issues: Object.freeze(issues),
  });
}

/** One active timed Well trait; repurchases are separate instances. */
export interface StygianWellTimedInstance {
  /** The Well item that granted it. */
  readonly itemKey: string;
  /** The native trait it adds. */
  readonly traitKey: string;
  readonly clock: StygianWellClock;
  readonly remainingUses: number;
  readonly source: {
    readonly occurrence: OccurrenceAddress;
    readonly generationKey: import('../../authored-project/model').StygianWellGenerationKey;
  };
}

/** Well holdings retained after the purchase room. */
export interface StygianWellRunState {
  readonly sparkUses: number;
  readonly yarnUses: number;
  readonly hymnUses: number;
  /** Archaic Seal charges awaiting an eligible direct purchase. */
  readonly extendedUses: number;
  readonly timedInstances: readonly StygianWellTimedInstance[];
  /** Native `WellShopPurchases`: direct purchases by item key; Twist results are not counted. */
  readonly directPurchases: Readonly<Record<string, number>>;
}

/**
 * The legality subset that room-exit conformance and execution diagnostics
 * observe: charges and the self-gated timed traits that withhold later Well
 * offers. Boss-clocked instances are negative remaining uses.
 */
export interface StygianWellLegalityState {
  readonly sparkUses: number;
  readonly yarnUses: number;
  readonly hymnUses: number;
  readonly discountUses: readonly number[];
  readonly emptySlotUses: readonly number[];
  readonly extendedUses: number;
}

export function projectStygianWellLegality(
  catalog: Catalog,
  state: StygianWellRunState,
): StygianWellLegalityState {
  const usesFor = (effect: 'discount' | 'emptySlot') =>
    Object.freeze(
      state.timedInstances
        .filter((instance) => {
          const option = wellOption(catalog, instance.itemKey);
          const grant = option?.stygianWell?.grant;
          return (
            option?.stygianWell?.offerRequirements?.includes('inactive') === true &&
            grant?.kind === 'timedTrait' &&
            grant.publishedEffect === effect
          );
        })
        .map((instance) =>
          instance.clock === 'bosses' ? -instance.remainingUses : instance.remainingUses,
        ),
    );
  return Object.freeze({
    sparkUses: state.sparkUses,
    yarnUses: state.yarnUses,
    hymnUses: state.hymnUses,
    discountUses: usesFor('discount'),
    emptySlotUses: usesFor('emptySlot'),
    extendedUses: state.extendedUses,
  });
}

const CHARGE_FIELDS = Object.freeze({
  spark: 'sparkUses',
  yarn: 'yarnUses',
  hymn: 'hymnUses',
  extended: 'extendedUses',
} as const);

/** Spends one use of every instance on `clock` and removes expired instances. */
export function advanceStygianWellClock(
  state: StygianWellRunState,
  clock: StygianWellClock,
): StygianWellRunState {
  if (!state.timedInstances.some((instance) => instance.clock === clock)) return state;
  return Object.freeze({
    ...state,
    timedInstances: Object.freeze(
      state.timedInstances
        .map((instance) =>
          instance.clock === clock
            ? Object.freeze({ ...instance, remainingUses: instance.remainingUses - 1 })
            : instance,
        )
        .filter((instance) => instance.remainingUses > 0),
    ),
  });
}

/**
 * Applies one Well item. A direct purchase is counted and may consume an
 * Archaic Seal; a Twist result is neither counted nor extended. Every timed
 * trait is a new instance.
 */
export function applyStygianWellPurchase(
  catalog: Catalog,
  state: StygianWellRunState,
  itemKey: string,
  source: StygianWellTimedInstance['source'],
  directPurchase: boolean,
): StygianWellRunState {
  const grant = stygianWellGrant(catalog, itemKey);
  const seal = extendedCharge(catalog);
  const extended =
    directPurchase &&
    state.extendedUses > 0 &&
    seal !== undefined &&
    seal.eligibleItemKeys.includes(itemKey);
  const base: StygianWellRunState = Object.freeze({
    ...state,
    extendedUses: extended ? state.extendedUses - 1 : state.extendedUses,
    directPurchases: directPurchase
      ? Object.freeze({
          ...state.directPurchases,
          [itemKey]: (state.directPurchases[itemKey] ?? 0) + 1,
        })
      : state.directPurchases,
  });
  if (grant === undefined) return base;
  switch (grant.kind) {
    case 'charge': {
      const field = CHARGE_FIELDS[grant.charge];
      return Object.freeze({ ...base, [field]: base[field] + 1 });
    }
    case 'timedTrait':
      return Object.freeze({
        ...base,
        timedInstances: Object.freeze([
          ...base.timedInstances,
          Object.freeze({
            itemKey,
            traitKey: grant.traitKey,
            clock: extended ? ('bosses' as const) : grant.clock,
            remainingUses: extended ? seal!.bossExtension : grant.initialUses,
            source,
          }),
        ]),
      });
    case 'consumable':
    case 'ledger':
    case 'immediate':
    case 'twist':
      return base;
  }
}

export interface StygianWellCandidateCapability {
  readonly assessments: readonly StygianWellCandidateContext[];
  readonly placementEligible: boolean;
  readonly required: boolean;
  readonly present: boolean;
  readonly interacted: boolean;
  readonly candidateItemKeysBySlot: Readonly<
    Record<import('../../authored-project/model').StygianWellSlotKey, readonly string[]>
  >;
  readonly travelDealRefill?: {
    readonly sourceGenerationKey: import('../../authored-project/model').StygianWellGenerationKey;
    readonly candidateItemKeys: readonly string[];
  };
  readonly twistCandidateItemKeysByGeneration: Readonly<
    Partial<
      Record<import('../../authored-project/model').StygianWellGenerationKey, readonly string[]>
    >
  >;
}

export interface StygianWellCandidateArtifacts {
  readonly at: (occurrence: OccurrenceAddress) => StygianWellCandidateCapability | undefined;
}

export function createStygianWellCandidateArtifacts(
  contexts: ReadonlyMap<string, readonly StygianWellCandidateContext[]>,
): StygianWellCandidateArtifacts {
  const privateContexts = new Map(contexts);
  return Object.freeze({
    at: (occurrence: OccurrenceAddress) => {
      const assessments = privateContexts.get(semanticAddressKey(occurrence));
      if (assessments === undefined || assessments.length === 0) return undefined;
      const entryAssessments = assessments.filter(
        (assessment): assessment is StygianWellEntryCandidateContext => 'placement' in assessment,
      );
      const firstEntry = entryAssessments[0];
      const purchaseContexts = (
        generationKey: import('../../authored-project/model').StygianWellGenerationKey,
      ) =>
        assessments.filter(
          (assessment): assessment is { readonly purchase: StygianWellPurchaseAssessment } =>
            'purchase' in assessment && assessment.purchase.generationKey === generationKey,
        );
      const refillContexts = purchaseContexts('initial:healing')
        .concat(purchaseContexts('initial:secondLeft'), purchaseContexts('initial:secondRight'))
        .filter((assessment) => assessment.purchase.travelDealRefill !== undefined);
      const travelDealRefill = refillContexts[0]?.purchase.travelDealRefill;
      return Object.freeze({
        assessments,
        placementEligible: entryAssessments.every((assessment) => assessment.placement.eligible),
        required: entryAssessments.every((assessment) => assessment.placement.forced),
        present:
          entryAssessments.length > 0 &&
          entryAssessments.every((assessment) => assessment.inventory !== undefined),
        interacted: entryAssessments.every(
          (assessment) => assessment.inventory?.interacted === true,
        ),
        candidateItemKeysBySlot: Object.freeze(
          Object.fromEntries(
            (['healing', 'secondLeft', 'secondRight'] as const).map((slotKey) => [
              slotKey,
              Object.freeze(
                (firstEntry?.inventory?.candidateItemKeysBySlot[slotKey] ?? []).filter((itemKey) =>
                  entryAssessments.every(
                    (assessment) =>
                      assessment.inventory?.candidateItemKeysBySlot[slotKey].includes(itemKey) ===
                      true,
                  ),
                ),
              ),
            ]),
          ) as Record<import('../../authored-project/model').StygianWellSlotKey, readonly string[]>,
        ),
        ...(travelDealRefill === undefined
          ? {}
          : {
              travelDealRefill: Object.freeze({
                sourceGenerationKey: travelDealRefill.sourceGenerationKey,
                candidateItemKeys: Object.freeze(
                  travelDealRefill.candidateItemKeys.filter((itemKey) =>
                    refillContexts.every(
                      (assessment) =>
                        assessment.purchase.travelDealRefill?.sourceGenerationKey ===
                          travelDealRefill.sourceGenerationKey &&
                        assessment.purchase.travelDealRefill.candidateItemKeys.includes(itemKey),
                    ),
                  ),
                ),
              }),
            }),
        twistCandidateItemKeysByGeneration: Object.freeze(
          Object.fromEntries(
            (
              [
                'initial:healing',
                'initial:secondLeft',
                'initial:secondRight',
                'travelDealRefill',
              ] as const
            ).flatMap((generationKey) => {
              const generationContexts = purchaseContexts(generationKey).filter(
                (assessment) => assessment.purchase.twistCandidateItemKeys !== undefined,
              );
              const itemKeys = generationContexts[0]?.purchase.twistCandidateItemKeys;
              if (itemKeys === undefined) return [];
              return [
                [
                  generationKey,
                  Object.freeze(
                    itemKeys.filter((itemKey) =>
                      generationContexts.every(
                        (assessment) =>
                          assessment.purchase.twistCandidateItemKeys?.includes(itemKey) === true,
                      ),
                    ),
                  ),
                ] as const,
              ];
            }),
          ),
        ),
      });
    },
  });
}

export function createEmptyStygianWellCandidateArtifacts(): StygianWellCandidateArtifacts {
  return Object.freeze({ at: () => undefined });
}
