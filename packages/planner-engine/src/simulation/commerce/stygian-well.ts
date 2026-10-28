import { semanticAddressKey, type OccurrenceAddress } from '../../authored-project/addresses';
import { routeRoomShop } from '../../authored-project/route-profile';
import type {
  StygianWellGenerationKey,
  StygianWellSlotKey,
  StygianWellState,
} from '../../authored-project/model';
import { STYGIAN_WELL_SLOT_KEYS } from '../../authored-project/feature-rolls';
import type { FeatureRerollOption } from './feature-rolls';
import type { Catalog, RoomDeclaration } from '../../catalog-schema';
import type { StygianWellClock, StygianWellGrant } from '../../reward-kernel';

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

/** The Well item that grants one charge kind. */
export function stygianWellChargeItemKey(
  catalog: Catalog,
  charge: Extract<StygianWellGrant, { readonly kind: 'charge' }>['charge'],
): string | undefined {
  return wellOptions(catalog).find((option) => {
    const grant = option.stygianWell?.grant;
    return grant?.kind === 'charge' && grant.charge === charge;
  })?.key;
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
  readonly kind: 'wrongGroup' | 'duplicate';
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
  | StygianWellEntryCandidateContext
  | { readonly purchase: StygianWellPurchaseAssessment }
  | { readonly roll: StygianWellRollAssessment };

/** One Well reroll's restock, assessed against the branch state at the reroll. */
export interface StygianWellRollAssessment {
  readonly rollKey: string;
  /** Every slot not bought earlier in the room; bought slots stay blank. */
  readonly offeredSlotKeys: readonly StygianWellSlotKey[];
  readonly candidateItemKeysBySlot: Readonly<Record<StygianWellSlotKey, readonly string[]>>;
  /** Pinned slots only; an unpinned slot stays native. */
  readonly issues: readonly {
    readonly kind: 'wrongGroup' | 'duplicate' | 'notOffered';
    readonly slotKey: StygianWellSlotKey;
  }[];
}

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
        readonly kind: 'refillWrongGroup' | 'refillDuplicate';
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
  // A blank slot stays native; only a pinned one is assessed.
  const issues: StygianWellInventoryAssessmentIssue[] = [];
  for (const key of STYGIAN_WELL_SLOT_KEYS) {
    const itemKey = well.offerKeyBySlot[key];
    if (itemKey !== null && !domains[key].includes(itemKey))
      issues.push({ kind: 'wrongGroup', generationKey: `initial:${key}` });
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
    forced: declaration?.forced === true,
    eligible: placement.eligible,
    complete: issues.length === 0,
    candidateItemKeysBySlot: domains,
    issues: Object.freeze(issues),
  });
}

/** Assesses one Well reroll's pinned restock against the branch state at the reroll. */
export function assessStygianWellRoll(
  catalog: Catalog,
  routeKey: string,
  rollKey: string,
  offerKeyBySlot: Readonly<Partial<Record<StygianWellSlotKey, string>>>,
  offeredSlotKeys: readonly StygianWellSlotKey[],
  state: Pick<StygianWellRunState, 'timedInstances'>,
  traitHistory: import('../traits').TraitHistoryState | undefined,
): StygianWellRollAssessment {
  const candidateItemKeysBySlot = Object.freeze(
    Object.fromEntries(
      STYGIAN_WELL_SLOT_KEYS.map((slotKey) => [
        slotKey,
        wellCandidateItemKeys(catalog, routeKey, state, traitHistory, slotKey),
      ]),
    ) as Record<StygianWellSlotKey, readonly string[]>,
  );
  const issues: StygianWellRollAssessment['issues'][number][] = [];
  STYGIAN_WELL_SLOT_KEYS.forEach((slotKey, index) => {
    const itemKey = offerKeyBySlot[slotKey];
    if (itemKey === undefined) return;
    if (!offeredSlotKeys.includes(slotKey)) issues.push({ kind: 'notOffered', slotKey });
    else if (!candidateItemKeysBySlot[slotKey].includes(itemKey))
      issues.push({ kind: 'wrongGroup', slotKey });
    else if (
      STYGIAN_WELL_SLOT_KEYS.slice(0, index).some(
        (earlier) => offeredSlotKeys.includes(earlier) && offerKeyBySlot[earlier] === itemKey,
      )
    )
      issues.push({ kind: 'duplicate', slotKey });
  });
  return Object.freeze({
    rollKey,
    offeredSlotKeys: Object.freeze([...offeredSlotKeys]),
    candidateItemKeysBySlot,
    issues: Object.freeze(issues),
  });
}

/** The pending restock a new Well reroll would offer, from the branch state at its point. */
export function stygianWellRestockCandidates(
  catalog: Catalog,
  routeKey: string,
  state: Pick<StygianWellRunState, 'timedInstances'>,
  traitHistory: import('../traits').TraitHistoryState | undefined,
): Readonly<Record<StygianWellSlotKey, readonly string[]>> {
  return assessStygianWellRoll(catalog, routeKey, '', {}, [], state, traitHistory)
    .candidateItemKeysBySlot;
}

/** One purchase's item and, when it is the room's first, the slot Travel Deal restocks. */
export interface StygianWellPurchaseInput {
  readonly generationKey: StygianWellGenerationKey;
  readonly itemKey: string;
  readonly twistResultKey: string | null | undefined;
  /** Present for the room's first purchase from a roll slot. */
  readonly firstPurchase?: {
    readonly slotKey: StygianWellSlotKey;
    /** The items the roll shows when it is bought; the restock excludes them. */
    readonly rollItemKeys: readonly string[];
    readonly travelDealRefillKey: string | null | undefined;
  };
}

/** Assesses one reached Well purchase against its exact pre-effect branch state. */
export function assessStygianWellPurchase(
  catalog: Catalog,
  routeKey: string,
  purchase: StygianWellPurchaseInput,
  state: Pick<StygianWellRunState, 'timedInstances'>,
  traitHistory: import('../traits').TraitHistoryState | undefined,
): StygianWellPurchaseAssessment {
  const { generationKey, itemKey } = purchase;
  const issues: StygianWellPurchaseAssessment['issues'][number][] = [];
  const first = purchase.firstPurchase;
  const travelDealRefill =
    first === undefined || traitHistory?.equippedTraits.RestockBoon === undefined
      ? undefined
      : (() => {
          const sourceDomain = wellCandidateItemKeys(
            catalog,
            routeKey,
            state,
            traitHistory,
            first.slotKey,
          );
          const candidateItemKeys = Object.freeze(
            sourceDomain.filter((key) => !first.rollItemKeys.includes(key)),
          );
          // An unpinned restock stays native until its purchase needs it.
          const refill = first.travelDealRefillKey;
          if (refill !== undefined && refill !== null && !candidateItemKeys.includes(refill))
            issues.push({
              kind: sourceDomain.includes(refill) ? 'refillDuplicate' : 'refillWrongGroup',
              generationKey: 'travelDealRefill',
            });
          return Object.freeze({
            sourceGenerationKey: generationKey as Exclude<
              StygianWellGenerationKey,
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
    const result = purchase.twistResultKey;
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

/** What can be done at the end of a Well's authored sequence, where a new action is appended. */
export interface StygianWellInteraction {
  readonly historySequence: number;
  /** The roll on show there: `initial` or a Well reroll's id. */
  readonly rollKey: string;
  /** Each slot that can be bought there, then the live Travel Deal refill. */
  readonly offers: readonly {
    readonly generationKey: StygianWellGenerationKey;
    readonly slotKey: StygianWellSlotKey;
    /** Null while the slot is unpinned. */
    readonly itemKey: string | null;
  }[];
  readonly reroll: FeatureRerollOption;
  /** The slots a reroll appended there restocks, with each one's candidates. */
  readonly pendingRoll: {
    readonly offeredSlotKeys: readonly StygianWellSlotKey[];
    readonly candidateItemKeysBySlot: Readonly<Record<StygianWellSlotKey, readonly string[]>>;
  };
}

export interface StygianWellRollCapability {
  readonly offeredSlotKeys: readonly StygianWellSlotKey[];
  readonly candidateItemKeysBySlot: Readonly<Record<StygianWellSlotKey, readonly string[]>>;
}

export interface StygianWellCandidateCapability {
  readonly assessments: readonly StygianWellCandidateContext[];
  readonly placementEligible: boolean;
  readonly required: boolean;
  readonly present: boolean;
  /** The initial roll's candidates. */
  readonly candidateItemKeysBySlot: Readonly<Record<StygianWellSlotKey, readonly string[]>>;
  /** Each reached Well reroll's restock, by its reroll id. */
  readonly rolls: Readonly<Record<string, StygianWellRollCapability>>;
  readonly travelDealRefill?: {
    readonly sourceGenerationKey: StygianWellGenerationKey;
    readonly candidateItemKeys: readonly string[];
  };
  readonly twistCandidateItemKeysByGeneration: Readonly<
    Partial<Record<StygianWellGenerationKey, readonly string[]>>
  >;
  /** Undefined while the Well's sequence is unreached. */
  readonly interaction?: StygianWellInteraction;
}

export interface StygianWellCandidateArtifacts {
  readonly at: (occurrence: OccurrenceAddress) => StygianWellCandidateCapability | undefined;
}

/** The values every branch agrees on, in the first branch's order. */
function agreed(lists: readonly (readonly string[])[]): readonly string[] {
  const [first, ...rest] = lists;
  return Object.freeze((first ?? []).filter((key) => rest.every((list) => list.includes(key))));
}

function agreedBySlot(
  records: readonly Readonly<Record<StygianWellSlotKey, readonly string[]>>[],
): Readonly<Record<StygianWellSlotKey, readonly string[]>> {
  return Object.freeze(
    Object.fromEntries(
      STYGIAN_WELL_SLOT_KEYS.map((slotKey) => [
        slotKey,
        agreed(records.map((record) => record[slotKey])),
      ]),
    ) as Record<StygianWellSlotKey, readonly string[]>,
  );
}

export function createStygianWellCandidateArtifacts(
  contexts: ReadonlyMap<string, readonly StygianWellCandidateContext[]>,
  interactions: ReadonlyMap<string, StygianWellInteraction> = new Map(),
): StygianWellCandidateArtifacts {
  const privateContexts = new Map(contexts);
  const privateInteractions = new Map(interactions);
  return Object.freeze({
    at: (occurrence: OccurrenceAddress) => {
      const key = semanticAddressKey(occurrence);
      const assessments = privateContexts.get(key);
      if (assessments === undefined || assessments.length === 0) return undefined;
      const entryAssessments = assessments.filter(
        (assessment): assessment is StygianWellEntryCandidateContext => 'placement' in assessment,
      );
      const purchases = assessments.flatMap((assessment) =>
        'purchase' in assessment ? [assessment.purchase] : [],
      );
      const rolls = assessments.flatMap((assessment) =>
        'roll' in assessment ? [assessment.roll] : [],
      );
      const refills = purchases.flatMap((purchase) =>
        purchase.travelDealRefill === undefined ? [] : [purchase.travelDealRefill],
      );
      const travelDealRefill = refills[0];
      const twistGenerations = [
        ...new Set(
          purchases.flatMap((purchase) =>
            purchase.twistCandidateItemKeys === undefined ? [] : [purchase.generationKey],
          ),
        ),
      ];
      const interaction = privateInteractions.get(key);
      return Object.freeze({
        assessments,
        placementEligible: entryAssessments.every((assessment) => assessment.placement.eligible),
        required: entryAssessments.every((assessment) => assessment.placement.forced),
        present:
          entryAssessments.length > 0 &&
          entryAssessments.every((assessment) => assessment.inventory !== undefined),
        candidateItemKeysBySlot: agreedBySlot(
          entryAssessments.flatMap((assessment) =>
            assessment.inventory === undefined
              ? []
              : [assessment.inventory.candidateItemKeysBySlot],
          ),
        ),
        rolls: Object.freeze(
          Object.fromEntries(
            [...new Set(rolls.map((roll) => roll.rollKey))].map((rollKey) => {
              const same = rolls.filter((roll) => roll.rollKey === rollKey);
              return [
                rollKey,
                Object.freeze({
                  offeredSlotKeys: same[0]!.offeredSlotKeys,
                  candidateItemKeysBySlot: agreedBySlot(
                    same.map((roll) => roll.candidateItemKeysBySlot),
                  ),
                }),
              ];
            }),
          ),
        ),
        ...(travelDealRefill === undefined
          ? {}
          : {
              travelDealRefill: Object.freeze({
                sourceGenerationKey: travelDealRefill.sourceGenerationKey,
                candidateItemKeys: agreed(
                  refills.map((refill) =>
                    refill.sourceGenerationKey === travelDealRefill.sourceGenerationKey
                      ? refill.candidateItemKeys
                      : [],
                  ),
                ),
              }),
            }),
        twistCandidateItemKeysByGeneration: Object.freeze(
          Object.fromEntries(
            twistGenerations.map((generationKey) => [
              generationKey,
              agreed(
                purchases
                  .filter(
                    (purchase) =>
                      purchase.generationKey === generationKey &&
                      purchase.twistCandidateItemKeys !== undefined,
                  )
                  .map((purchase) => purchase.twistCandidateItemKeys!),
              ),
            ]),
          ),
        ),
        ...(interaction === undefined ? {} : { interaction }),
      });
    },
  });
}

export function createEmptyStygianWellCandidateArtifacts(): StygianWellCandidateArtifacts {
  return Object.freeze({ at: () => undefined });
}
