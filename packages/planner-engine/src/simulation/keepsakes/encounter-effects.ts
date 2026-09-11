import type { Catalog } from '../../catalog-schema';
import type { AuthoredGorgonAthenaOffer } from '../../authored-project/traits';
import type {
  FigLeafStateValue,
  GorgonLifecycleStatus,
  GorgonRarityLevel,
  KeepsakeState,
} from './state';

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
export function attestGorgonBranchState(
  branches: readonly { readonly keepsakes: KeepsakeState }[],
): GorgonLifecycleStatus | undefined {
  const states = branches.map((branch) => branch.keepsakes.gorgon);
  const values = states.map((state) => state?.status);
  const first = values[0];
  const firstRarityLevel = states[0]?.status === 'pending' ? states[0].rarityLevel : undefined;
  if (
    values.some((value) => value !== first) ||
    states.some((state) =>
      state?.status === 'pending'
        ? state.rarityLevel !== firstRarityLevel
        : firstRarityLevel !== undefined,
    )
  )
    throw new Error('Gorgon branch frontier is divergent');
  return first;
}

export function attestPendingGorgonRarityLevel(
  branches: readonly { readonly keepsakes: KeepsakeState }[],
): GorgonRarityLevel | undefined {
  const status = attestGorgonBranchState(branches);
  const first = branches[0]?.keepsakes.gorgon;
  return status === 'pending' && first?.status === 'pending' ? first.rarityLevel : undefined;
}

/** Attest the branch frontier before lifecycle composition can consume it. */
export function attestFigLeafBranchState(
  branches: readonly { readonly keepsakes: KeepsakeState }[],
): FigLeafStateValue | undefined {
  const values = branches.map((branch) => branch.keepsakes.figLeaf);
  const first = values[0];
  if (first === undefined) {
    if (values.some((value) => value !== undefined)) {
      throw new Error('Fig Leaf branch frontier is divergent');
    }
    return undefined;
  }
  if (
    values.some(
      (value) =>
        value === undefined ||
        value.remainingUses !== first.remainingUses ||
        value.activatedThisBiome !== first.activatedThisBiome,
    )
  ) {
    throw new Error('Fig Leaf branch frontier is divergent');
  }
  return Object.freeze({ ...first });
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
