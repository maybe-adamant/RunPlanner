import { semanticAddressKey, type OccurrenceAddress } from '../../authored-project/addresses';
import type { StygianWellState } from '../../authored-project/model';
import type { Catalog, RoomDeclaration } from '../../catalog-schema';

export const STYGIAN_WELL_SLOT_KEYS = ['healing', 'secondLeft', 'secondRight'] as const;
/** Closed planner payload for one declaration-owned Well effect. */
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
function wellOption(catalog: Catalog, itemKey: string) {
  return catalog.rewards.shops.byKey.RoomShop?.groups.values
    .flatMap((group) => group.options.values)
    .find((option) => option.key === itemKey);
}

export function twistResultItemKeys(catalog: Catalog): readonly string[] {
  return Object.freeze([
    ...(wellOption(catalog, 'RandomStoreItem')?.stygianWell?.nestedResultItemKeys ?? []),
  ]);
}

export function extendedWellItemKeys(catalog: Catalog): readonly string[] {
  return Object.freeze([
    ...(wellOption(catalog, 'ExtendedShopTrait')?.stygianWell?.extendedDirectPurchaseItemKeys ??
      []),
  ]);
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

export type StygianWellInventoryAssessmentIssue =
  | {
      readonly kind: 'missing' | 'wrongGroup';
      readonly generationKey: import('../../authored-project/model').StygianWellGenerationKey;
    }
  | { readonly kind: 'duplicate' };

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
  priorEnteredWellFlags: readonly boolean[],
): StygianWellPlacementAssessment {
  const roomShop = declaration?.roomShop;
  const forced = roomShop?.forced === true;
  const priorWellCount = priorEnteredWellFlags.filter(Boolean).length;
  return Object.freeze({
    forced,
    eligible:
      forced ||
      (roomShop !== undefined &&
        roomShop.spawnChance > 0 &&
        (declaration?.challengeSwitchAnchorCount ?? 0) > 0 &&
        priorWellCount === 0),
    priorWellCount,
  });
}

function wellCandidateItemKeys(
  catalog: Catalog,
  routeKey: string,
  state: Pick<StygianWellRunState, 'discountUses' | 'emptySlotUses'> | undefined,
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
        if (requirements.includes('inactive')) {
          if (option.stygianWell?.effect === 'discount' && (state?.discountUses.length ?? 0) > 0)
            return false;
          if (option.stygianWell?.effect === 'emptySlot' && (state?.emptySlotUses.length ?? 0) > 0)
            return false;
        }
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
  well: StygianWellState,
  state?: Pick<StygianWellRunState, 'discountUses' | 'emptySlotUses'>,
  traitHistory?: import('../traits').TraitHistoryState,
  priorEnteredWellFlags: readonly boolean[] = Object.freeze([]),
): StygianWellAssessment {
  const declaration = room?.roomShop;
  const placement = assessStygianWellPlacement(room, priorEnteredWellFlags);
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
  const values = STYGIAN_WELL_SLOT_KEYS.map((key) => well.offerKeyBySlot[key]);
  const issues: StygianWellInventoryAssessmentIssue[] = [];
  for (const key of STYGIAN_WELL_SLOT_KEYS) {
    const generationKey = `initial:${key}` as const;
    if (well.offerKeyBySlot[key] === null) {
      issues.push({ kind: 'missing', generationKey });
    } else if (!domains[key].includes(well.offerKeyBySlot[key]!)) {
      issues.push({ kind: 'wrongGroup', generationKey });
    }
  }
  const selected = values.filter((value): value is string => value !== null);
  if (new Set(selected).size !== selected.length) issues.push({ kind: 'duplicate' });
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
  state: Pick<StygianWellRunState, 'discountUses' | 'emptySlotUses'>,
  traitHistory: import('../traits').TraitHistoryState | undefined,
  firstPurchaseGenerationKey:
    import('../../authored-project/model').StygianWellGenerationKey | undefined,
): StygianWellPurchaseAssessment {
  const activeDiscount = state.discountUses.length > 0;
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
          twistResultItemKeys(catalog).filter((key) => {
            const option = wellOption(catalog, key);
            return option?.stygianWell?.effect !== 'discount' || !activeDiscount;
          }),
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

/** Only modeled state; neutral items still have an immediate atomic action. */
export interface StygianWellRunState {
  readonly sparkUses: number;
  readonly yarnUses: number;
  readonly hymnUses: number;
  readonly discountUses: readonly number[];
  readonly emptySlotUses: readonly number[];
  readonly extendedUses: number;
}

/** Encounter durations are non-negative; Extended instances use negative Boss-use counters. */
export function advanceStygianWellEncounterUses(state: StygianWellRunState): StygianWellRunState {
  return {
    ...state,
    discountUses: state.discountUses
      .map((use) => (use > 0 ? use - 1 : use))
      .filter((use) => use !== 0),
    emptySlotUses: state.emptySlotUses
      .map((use) => (use > 0 ? use - 1 : use))
      .filter((use) => use !== 0),
  };
}

export function advanceStygianWellBossUses(state: StygianWellRunState): StygianWellRunState {
  return {
    ...state,
    discountUses: state.discountUses
      .map((use) => (use < 0 ? use + 1 : use))
      .filter((use) => use !== 0),
    emptySlotUses: state.emptySlotUses
      .map((use) => (use < 0 ? use + 1 : use))
      .filter((use) => use !== 0),
  };
}
export function applyStygianWellPurchase(
  catalog: Catalog,
  state: StygianWellRunState,
  itemKey: string,
  directPurchase = true,
): StygianWellRunState {
  const option = wellOption(catalog, itemKey);
  const effect = option?.stygianWell?.effect ?? 'neutral';
  const extended =
    directPurchase && state.extendedUses > 0 && extendedWellItemKeys(catalog).includes(itemKey);
  const duration = extended ? -2 : 6;
  const base = {
    ...state,
    extendedUses: extended ? Math.max(0, state.extendedUses - 1) : state.extendedUses,
  };
  switch (effect) {
    case 'spark':
      return { ...base, sparkUses: base.sparkUses + 1 };
    case 'yarn':
      return { ...base, yarnUses: base.yarnUses + 1 };
    case 'hymn':
      return { ...base, hymnUses: base.hymnUses + 1 };
    case 'discount':
      return { ...base, discountUses: [...base.discountUses, duration] };
    case 'emptySlot':
      return { ...base, emptySlotUses: [...base.emptySlotUses, duration] };
    case 'extended':
      return { ...state, extendedUses: state.extendedUses + 1 };
    default:
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
