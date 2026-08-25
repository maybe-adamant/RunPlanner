import type { StygianWellState } from '../authored-project/model';
import type { Catalog, RoomDeclaration } from '../catalog-schema';

export const STYGIAN_WELL_SLOT_KEYS = ['healing', 'secondLeft', 'secondRight'] as const;
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
    Record<import('../authored-project/model').StygianWellSlotKey, readonly string[]>
  >;
  readonly travelDealRefill?: {
    readonly sourceGenerationKey: import('../authored-project/model').StygianWellGenerationKey;
    readonly candidateItemKeys: readonly string[];
  };
  readonly twistCandidateItemKeysByGeneration: Readonly<
    Partial<Record<import('../authored-project/model').StygianWellGenerationKey, readonly string[]>>
  >;
  readonly issues: readonly (
    | 'missing'
    | 'wrongGroup'
    | 'duplicate'
    | 'refillMissing'
    | 'refillUnavailable'
    | 'refillWrongGroup'
    | 'refillDuplicate'
    | 'twistMissing'
    | 'twistInvalid'
    | 'twistOrphan'
  )[];
}

export interface StygianWellPlacementAssessment {
  readonly forced: boolean;
  readonly eligible: boolean;
  readonly priorWellCount: number;
}

export interface StygianWellCandidateContext {
  readonly placement: StygianWellPlacementAssessment;
  readonly inventory?: StygianWellAssessment;
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

/** Inventory-level assessment intentionally contains no price or pickup policy. */
export function assessStygianWell(
  catalog: Catalog,
  room: RoomDeclaration | undefined,
  well: StygianWellState,
  state?: Pick<StygianWellRunState, 'discountUses' | 'emptySlotUses'>,
  traitHistory?: import('./traits').TraitHistoryState,
  priorEnteredWellFlags: readonly boolean[] = Object.freeze([]),
  firstPurchaseGenerationKey?: import('../authored-project/model').StygianWellGenerationKey,
  hasTravelDeal = false,
): StygianWellAssessment {
  const declaration = room?.roomShop;
  const placement = assessStygianWellPlacement(room, priorEnteredWellFlags);
  const profile = catalog.rewards.shops.byKey.RoomShop;
  const hasEmptyPrimaryOrSecondary =
    traitHistory === undefined ||
    traitHistory.equippedSlots.Attack === undefined ||
    traitHistory.equippedSlots.Special === undefined;
  const activeDiscount = (state?.discountUses.length ?? 0) > 0;
  const activeEmptySlot = (state?.emptySlotUses.length ?? 0) > 0;
  const candidate = (slot: 'healing' | 'secondLeft' | 'secondRight') =>
    Object.freeze(
      [
        ...(profile?.slots.values.find((entry) => entry.key === slot)?.groupKey === 'Healing'
          ? (profile.groups.byKey.Healing?.options.values ?? [])
          : (profile?.groups.byKey.Other?.options.values ?? [])),
      ]
        .filter((option) => {
          const requirements = option.stygianWell?.offerRequirements ?? [];
          if (requirements.includes('inactive')) {
            if (option.stygianWell?.effect === 'discount' && activeDiscount) return false;
            if (option.stygianWell?.effect === 'emptySlot' && activeEmptySlot) return false;
          }
          return !requirements.includes('emptyAttackOrSpecial') || hasEmptyPrimaryOrSecondary;
        })
        .map((option) => option.key),
    );
  const domains = Object.freeze({
    healing: candidate('healing'),
    secondLeft: candidate('secondLeft'),
    secondRight: candidate('secondRight'),
  });
  const purchased = new Set(well.purchasedGenerationKeys ?? []);
  const twistResults = new Set(
    twistResultItemKeys(catalog).filter((itemKey) => {
      const option = wellOption(catalog, itemKey);
      return option?.stygianWell?.effect !== 'discount' || !activeDiscount;
    }),
  );
  const itemForGeneration = (
    generation: import('../authored-project/model').StygianWellGenerationKey,
  ) => {
    if (generation === 'travelDealRefill') return well.travelDealRefillKey;
    return well.offerKeyBySlot[
      generation.slice('initial:'.length) as import('../authored-project/model').StygianWellSlotKey
    ];
  };
  const sourceSlot = firstPurchaseGenerationKey?.startsWith('initial:')
    ? (firstPurchaseGenerationKey.slice(
        'initial:'.length,
      ) as import('../authored-project/model').StygianWellSlotKey)
    : undefined;
  const excluded = new Set(
    Object.values(well.offerKeyBySlot).filter((key): key is string => key !== null),
  );
  const travelDealRefill =
    !hasTravelDeal || sourceSlot === undefined
      ? undefined
      : Object.freeze({
          sourceGenerationKey: firstPurchaseGenerationKey!,
          candidateItemKeys: Object.freeze(domains[sourceSlot].filter((key) => !excluded.has(key))),
        });
  const twistCandidateItemKeysByGeneration = Object.freeze(
    Object.fromEntries(
      (
        [
          'initial:healing',
          'initial:secondLeft',
          'initial:secondRight',
          'travelDealRefill',
        ] as const
      )
        .filter(
          (generation) =>
            purchased.has(generation) && itemForGeneration(generation) === 'RandomStoreItem',
        )
        .map((generation) => [generation, Object.freeze([...twistResults])]),
    ),
  );
  if (!well.interacted)
    return Object.freeze({
      placement,
      interacted: false,
      forced: declaration?.forced === true,
      eligible: placement.eligible,
      complete: false,
      candidateItemKeysBySlot: domains,
      ...(travelDealRefill === undefined ? {} : { travelDealRefill }),
      twistCandidateItemKeysByGeneration,
      issues: Object.freeze([]),
    });
  const values = STYGIAN_WELL_SLOT_KEYS.map((key) => well.offerKeyBySlot[key]);
  const issues: StygianWellAssessment['issues'][number][] = [];
  if (values.some((value) => value === null)) issues.push('missing');
  for (const key of STYGIAN_WELL_SLOT_KEYS)
    if (well.offerKeyBySlot[key] !== null && !domains[key].includes(well.offerKeyBySlot[key]!))
      issues.push('wrongGroup');
  const selected = values.filter((value): value is string => value !== null);
  if (new Set(selected).size !== selected.length) issues.push('duplicate');
  if (
    travelDealRefill !== undefined &&
    (well.travelDealRefillKey === undefined || well.travelDealRefillKey === null)
  ) {
    issues.push('refillMissing');
  } else if (well.travelDealRefillKey !== undefined && well.travelDealRefillKey !== null) {
    if (travelDealRefill === undefined) issues.push('refillUnavailable');
    else if (!travelDealRefill.candidateItemKeys.includes(well.travelDealRefillKey)) {
      const sourceDomain = sourceSlot === undefined ? [] : domains[sourceSlot];
      issues.push(
        sourceDomain.includes(well.travelDealRefillKey) ? 'refillDuplicate' : 'refillWrongGroup',
      );
    }
  }
  for (const generation of [
    'initial:healing',
    'initial:secondLeft',
    'initial:secondRight',
    'travelDealRefill',
  ] as const) {
    const result =
      well.twistResultKeyBySlot?.[
        generation === 'travelDealRefill'
          ? 'travelDealRefill'
          : (generation.slice(
              'initial:'.length,
            ) as import('../authored-project/model').StygianWellSlotKey)
      ];
    const isPurchasedTwist =
      purchased.has(generation) && itemForGeneration(generation) === 'RandomStoreItem';
    if (isPurchasedTwist && (result === undefined || result === null)) issues.push('twistMissing');
    else if (isPurchasedTwist && !twistResults.has(result!)) issues.push('twistInvalid');
    else if (!isPurchasedTwist && result !== undefined && result !== null)
      issues.push('twistOrphan');
  }
  return Object.freeze({
    placement,
    interacted: true,
    forced: declaration?.forced === true,
    eligible: placement.eligible,
    complete: issues.length === 0,
    candidateItemKeysBySlot: domains,
    ...(travelDealRefill === undefined ? {} : { travelDealRefill }),
    twistCandidateItemKeysByGeneration,
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
