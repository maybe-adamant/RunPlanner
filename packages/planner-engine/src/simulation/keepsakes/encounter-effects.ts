import type { Catalog } from '../../catalog-schema';
import type { AuthoredGorgonAthenaOffer } from '../../authored-project/traits/state';
import type { GorgonLifecycleStatus, GorgonRarityLevel, KeepsakeState } from './state';

/** Athena's source-local sparse chance override derived from Gorgon's captured level. */
export function gorgonSourceRarityOverride(
  rarityLevel: GorgonRarityLevel,
): import('../../catalog-schema').BoonRarityOverride {
  switch (rarityLevel) {
    case 1:
      return Object.freeze({});
    case 2:
      return Object.freeze({ Rare: 1 });
    case 3:
      return Object.freeze({ Epic: 1 });
    case 4:
      return Object.freeze({ Heroic: 1 });
  }
}

export interface GorgonEligibilityInput {
  readonly status: GorgonLifecycleStatus | undefined;
  readonly biomeDepthCache: number;
  readonly minimumBiomeDepth: number;
  readonly roomBlocked: boolean;
  readonly encounterBlocked: boolean;
  readonly figLeafSkipped: boolean;
  readonly athenaTriggerConditionMet: boolean;
}
export function assessGorgonEligibility(input: GorgonEligibilityInput): boolean {
  return (
    input.status === 'pending' &&
    input.biomeDepthCache >= input.minimumBiomeDepth &&
    !input.roomBlocked &&
    !input.encounterBlocked &&
    !input.figLeafSkipped &&
    input.athenaTriggerConditionMet
  );
}

export interface GorgonCandidateInput {
  readonly status: GorgonLifecycleStatus | undefined;
  readonly naturalAthena: boolean;
  readonly gorgonEligible: boolean;
}

export function assessGorgonChildSettlement(
  catalog: Catalog,
  offer: AuthoredGorgonAthenaOffer | undefined,
): boolean {
  const keepsake = catalog.keepsakes.values.find(
    (candidate) => candidate.effect?.kind === 'gorgonAmulet',
  );
  const effect = keepsake?.effect;
  const giver =
    effect?.kind === 'gorgonAmulet' ? catalog.traitGivers.byKey[effect.providerKey] : undefined;
  return (
    offer !== undefined &&
    offer.traitKeys.length === 3 &&
    new Set(offer.traitKeys).size === 3 &&
    effect?.kind === 'gorgonAmulet' &&
    giver !== undefined &&
    offer.traitKeys.every((traitKey) => giver.traitKeys.includes(traitKey))
  );
}

/** Shared route appearance budget for natural Athena and Gorgon Athena. */
export function assessGorgonCandidate(input: GorgonCandidateInput): {
  readonly naturalPossible: boolean;
  readonly gorgonPossible: boolean;
  readonly nextStatus: GorgonLifecycleStatus | undefined;
} {
  const naturalPossible = input.naturalAthena && input.status !== 'consumed';
  const gorgonPossible = input.gorgonEligible && input.status === 'pending';
  return Object.freeze({
    naturalPossible,
    gorgonPossible,
    nextStatus:
      input.naturalAthena && input.status === 'pending'
        ? 'expired'
        : input.gorgonEligible && input.status === 'pending'
          ? 'consumed'
          : input.status,
  });
}
/** The Gorgon rarity level a pending amulet will grant; none once it settled. */
export function pendingGorgonRarityLevel(keepsakes: KeepsakeState): GorgonRarityLevel | undefined {
  return keepsakes.gorgon?.status === 'pending' ? keepsakes.gorgon.rarityLevel : undefined;
}

export function expirePendingGorgon(state: KeepsakeState): KeepsakeState {
  return state.gorgon?.status === 'pending'
    ? Object.freeze({ ...state, gorgon: Object.freeze({ status: 'expired' as const }) })
    : state;
}

export function consumeGorgonAppearance(state: KeepsakeState): KeepsakeState {
  return state.gorgon?.status === 'pending'
    ? Object.freeze({ ...state, gorgon: Object.freeze({ status: 'consumed' as const }) })
    : state;
}

/** Biome starts reset only Fig Leaf's local opportunity. */
export function applyEchoFigLeafReplay(state: KeepsakeState): KeepsakeState {
  return Object.freeze({
    ...state,
    figLeaf: Object.freeze({
      remainingUses: Math.max(state.figLeaf?.remainingUses ?? 0, 1),
      activatedThisBiome: state.figLeaf?.activatedThisBiome ?? false,
    }),
  });
}
export function consumeFigLeafUse(state: KeepsakeState): KeepsakeState {
  const figLeaf = state.figLeaf;
  if (figLeaf === undefined || figLeaf.remainingUses <= 0 || figLeaf.activatedThisBiome)
    return state;
  return Object.freeze({
    ...state,
    figLeaf: Object.freeze({
      remainingUses: figLeaf.remainingUses - 1,
      activatedThisBiome: true,
    }),
  });
}
