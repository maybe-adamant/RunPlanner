import type { Catalog, InRunTraitRarity, KeepsakeRank, TraitRarity } from '../catalog-schema';
import { semanticAddressKey, type SemanticAddress } from '../authored-project/addresses';
import type { AuthoredKeepsakeEquipResults } from '../authored-project/model';
import type { ArcanaFearState } from './arcana-fear';
import {
  attachTraitHistory,
  createTraitHistoryState,
  foldTraitHistoryEvents,
  hasEffectiveInRunUpgrade,
  nextRarity,
  type TraitHistoryState,
} from './trait-history';
import type { RewardBranchState } from './rewards/branch-primitives';
import { assessTraitOption } from './trait-authoring-policies';
import {
  optionIndex,
  type AuthoredGorgonAthenaOffer,
  type AuthoredTraitOffer,
  type AuthoredTraitOfferTraits,
  type TraitOptionKey,
} from '../authored-project/traits';

export type FatedStatus = 'Unknown' | 'Fated' | 'Unfated';
export interface KeepsakeHistoryEntry {
  readonly key: string;
  readonly kind: 'start' | 'retain' | 'replace';
}
export interface KeepsakeState {
  readonly currentKey: string;
  readonly history: readonly KeepsakeHistoryEntry[];
  readonly removedKeys: readonly string[];
  readonly fatedStatus: FatedStatus;
  /** Independent active sources for the nine Olympian reward-pressure effects. */
  readonly olympianSources: readonly OlympianProviderSource[];
  readonly nextOlympianAcquisitionOrder: number;
  /** Retained output of the exact Jeweled Pom equip transition. */
  readonly jeweledPom?: {
    readonly grantedTraitKey: string;
    readonly active: boolean;
    readonly levels: number;
    readonly acquisitionIdentity: string;
  };
  /** Exact temporary direct Hammer acquisitions, retained and expired independently. */
  readonly experimentalHammers: readonly {
    readonly traitKey: string;
    readonly remainingUses: number;
    readonly acquisitionIdentity: string;
    readonly active: boolean;
  }[];
  /** Retained Calling Card ledger; explicit offer actions are its only consumption source. */
  readonly callingCard?: { readonly remainingCharges: number };
  /** Retained Time Piece ledger; conversions consume it in acquisition chronology. */
  readonly timePiece?: { readonly remainingCharges: number };
  /** Fig Leaf total uses and its one-success-per-biome guard. */
  readonly figLeaf?: { readonly remainingUses: number; readonly activatedThisBiome: boolean };
  readonly gorgon?:
    | { readonly status: 'pending'; readonly rarity: TraitRarity }
    | { readonly status: 'consumed' | 'expired' };
  /** Aromatic Phial's one live source use; absent after ordinary replacement. */
  readonly phial?: { readonly status: 'pending' | 'consumed' };
  /** Crystal Figurine source, retaining whether it came from the ordinary slot or Echo. */
  readonly figurine?: {
    readonly origin: 'ordinary' | 'echo';
    readonly status: 'pending' | 'consumed';
    readonly rarity: InRunTraitRarity;
  };
  /** Concave Stone source; Echo replay remains unslotted after consumption. */
  readonly stone?: {
    readonly origin: 'ordinary' | 'echo';
    readonly status: 'pending' | 'consumed';
    readonly rank: KeepsakeRank;
  };
  /** One direct Chaos blessing source and its exact eight-room checkpoint. */
  readonly transcendentEmbryo?: {
    readonly origin: 'ordinary' | 'echo';
    readonly rarity: InRunTraitRarity;
    readonly progress: number;
    readonly markedBlessingKey: string;
    readonly markedBlessingAcquisitionIdentity: string;
  };
}

export interface OlympianProviderSource {
  readonly keepsakeKey: string;
  readonly providerKey: string;
  readonly origin: 'ordinary' | 'echo';
  readonly acquisitionOrder: number;
  readonly remainingForceUses: 0 | 1;
  readonly remainingRarificationUses: 0 | 1;
  readonly maximumSourceRarityLevel: 1 | 2 | 3;
}

export interface FigLeafStateValue {
  readonly remainingUses: number;
  readonly activatedThisBiome: boolean;
}

export type GorgonLifecycleStatus = 'pending' | 'consumed' | 'expired';

/** Declaration-owned rank bonus derived only from canonical equipped-trait history. */
export function activeKeepsakeRankBonus(catalog: Catalog, traitHistory: TraitHistoryState): 0 | 1 {
  for (const equipped of Object.values(traitHistory.equippedTraits)) {
    const disposition = catalog.traits.byKey[equipped.traitKey]?.selectedDisposition;
    if (disposition?.kind === 'advanceCurrentKeepsake') return disposition.rankBonus;
  }
  return 0;
}

/** Resolves a later ordinary equip without persisting a second Cherished flag. */
export function keepsakeRankForEquip(
  catalog: Catalog,
  key: string,
  traitHistory: TraitHistoryState,
): KeepsakeRank {
  const keepsake = catalog.keepsakes.byKey[key];
  if (keepsake === undefined || activeKeepsakeRankBonus(catalog, traitHistory) === 0)
    return keepsake?.rank ?? 'Epic';
  const effect = keepsake.effect;
  if (effect === undefined) return keepsake.rank;
  switch (effect.kind) {
    case 'jeweledPom':
    case 'experimentalHammer':
    case 'callingCard':
    case 'timePiece':
    case 'figLeaf':
    case 'gorgonAmulet':
      return 'Heroic';
    case 'fountainRarity':
      return 'Epic';
    case 'crystalFigurine':
      return 'Heroic';
    case 'concaveStone':
      return 'Heroic';
    case 'transcendentEmbryo':
      return 'Heroic';
    case 'olympianRewardPressure':
      // The source declaration deliberately has no Heroic row.
      return 'Epic';
    case 'moonBeam':
      return 'Heroic';
    default: {
      const exhaustive: never = effect;
      return exhaustive;
    }
  }
}

/**
 * Applies Cherished Heirloom's acquisition-time reconstruction to the current
 * supported keepsake only. Equip-time products deliberately remain outside
 * this transition: Fig Leaf and Experimental Hammer are explicit no-ops, and
 * missing retained ledgers are never recreated.
 */
export function advanceCurrentKeepsake(
  catalog: Catalog,
  state: KeepsakeState,
  rankBonus: 1,
): KeepsakeState {
  const keepsake = catalog.keepsakes.byKey[state.currentKey];
  const effect = keepsake?.effect;
  if (keepsake === undefined || effect === undefined) return state;
  const advancedRank: KeepsakeRank =
    keepsake.rank === 'Epic' && rankBonus === 1 ? 'Heroic' : keepsake.rank;
  switch (effect.kind) {
    case 'gorgonAmulet':
      return state.gorgon?.status === 'pending'
        ? Object.freeze({
            ...state,
            gorgon: Object.freeze({
              status: 'pending' as const,
              rarity: gorgonRarityForRank(catalog, effect, advancedRank),
            }),
          })
        : state;
    case 'fountainRarity':
      return state;
    case 'crystalFigurine':
      return state.figurine?.status === 'pending'
        ? Object.freeze({
            ...state,
            figurine: Object.freeze({
              ...state.figurine,
              rarity: figurineRarityForRank(catalog, effect, advancedRank),
            }),
          })
        : state;
    case 'figLeaf':
      return state;
    case 'experimentalHammer':
      return state;
    case 'jeweledPom':
      return state.jeweledPom === undefined
        ? state
        : Object.freeze({
            ...state,
            jeweledPom: Object.freeze({
              ...state.jeweledPom,
              levels: effect.subsequentEligibleTraitLevelsByRank[advancedRank],
            }),
          });
    case 'concaveStone':
      return state.stone?.status === 'pending'
        ? Object.freeze({
            ...state,
            stone: Object.freeze({ ...state.stone, rank: advancedRank }),
          })
        : state;
    case 'transcendentEmbryo':
      return state.transcendentEmbryo === undefined
        ? state
        : Object.freeze({
            ...state,
            transcendentEmbryo: Object.freeze({
              ...state.transcendentEmbryo,
              rarity: effect.blessingRarityByRank[advancedRank],
            }),
          });
    case 'callingCard':
      return state.callingCard === undefined
        ? state
        : Object.freeze({
            ...state,
            callingCard: Object.freeze({
              remainingCharges:
                state.callingCard.remainingCharges +
                (effect.rarificationChargesByRank[advancedRank] -
                  effect.rarificationChargesByRank[keepsake.rank]),
            }),
          });
    case 'timePiece':
      return state.timePiece === undefined
        ? state
        : Object.freeze({
            ...state,
            timePiece: Object.freeze({
              remainingCharges:
                state.timePiece.remainingCharges +
                (effect.conversionChargesByRank[advancedRank] -
                  effect.conversionChargesByRank[keepsake.rank]),
            }),
          });
    case 'olympianRewardPressure':
      return Object.freeze({
        ...state,
        olympianSources: Object.freeze(
          state.olympianSources.map((source) =>
            source.origin !== 'ordinary'
              ? source
              : Object.freeze({ ...source, remainingRarificationUses: 1 as const }),
          ),
        ),
      });
    case 'moonBeam':
      return state;
    default: {
      const exhaustive: never = effect;
      return exhaustive;
    }
  }
}

function gorgonRarityForRank(
  catalog: Catalog,
  effect: Extract<
    NonNullable<import('../catalog-schema').KeepsakeDeclaration['effect']>,
    { readonly kind: 'gorgonAmulet' }
  >,
  rank: KeepsakeRank,
): TraitRarity {
  const rarity = catalog.traitRarityOrder[effect.rarityLevelByRank[rank] - 1];
  if (rarity === undefined) throw new Error(`Gorgon rank ${rank} has no declared rarity`);
  return rarity;
}

export function figurineRarityForRank(
  catalog: Catalog,
  effect: Extract<
    NonNullable<import('../catalog-schema').KeepsakeDeclaration['effect']>,
    { readonly kind: 'crystalFigurine' }
  >,
  rank: KeepsakeRank,
): InRunTraitRarity {
  const rarity = catalog.traitRarityOrder[effect.rarityLevelByRank[rank] - 1];
  if (rarity === undefined) throw new Error(`Figurine rank ${rank} has no declared rarity`);
  return rarity;
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
  const firstRarity = states[0]?.status === 'pending' ? states[0].rarity : undefined;
  if (
    values.some((value) => value !== first) ||
    states.some((state) =>
      state?.status === 'pending' ? state.rarity !== firstRarity : firstRarity !== undefined,
    )
  )
    throw new Error('Gorgon branch frontier is divergent');
  return first;
}

export function attestPendingGorgonRarity(
  branches: readonly { readonly keepsakes: KeepsakeState }[],
): TraitRarity | undefined {
  const status = attestGorgonBranchState(branches);
  const first = branches[0]?.keepsakes.gorgon;
  return status === 'pending' && first?.status === 'pending' ? first.rarity : undefined;
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

export function jeweledPomEffectForKey(catalog: import('../catalog-schema').Catalog, key: string) {
  const effect = catalog.keepsakes.byKey[key]?.effect;
  return effect?.kind === 'jeweledPom' ? effect : undefined;
}

export function keepsakeEffectByKind<
  K extends NonNullable<import('../catalog-schema').KeepsakeDeclaration['effect']>['kind'],
>(
  catalog: import('../catalog-schema').Catalog,
  kind: K,
):
  | Extract<
      NonNullable<import('../catalog-schema').KeepsakeDeclaration['effect']>,
      { readonly kind: K }
    >
  | undefined {
  return catalog.keepsakes.values.find((keepsake) => keepsake.effect?.kind === kind)?.effect as
    | Extract<
        NonNullable<import('../catalog-schema').KeepsakeDeclaration['effect']>,
        { readonly kind: K }
      >
    | undefined;
}

export interface PhialTraitTargetDomain {
  readonly consumptionTargetKeys: readonly string[];
  readonly mutationTargetKeys: readonly string[];
}

/** The two deliberately different Phial frontiers at one fountain use. */
export function assessPhialTraitTargets(
  catalog: Catalog,
  history: TraitHistoryState,
): PhialTraitTargetDomain {
  const effect = keepsakeEffectByKind(catalog, 'fountainRarity');
  if (effect === undefined)
    return Object.freeze({ consumptionTargetKeys: [], mutationTargetKeys: [] });
  const targetRarity = catalog.traitRarityOrder[effect.targetRarityLevelByRank.Epic - 1];
  if (targetRarity === undefined)
    return Object.freeze({ consumptionTargetKeys: [], mutationTargetKeys: [] });
  const consumptionTargetKeys: string[] = [];
  const mutationTargetKeys: string[] = [];
  for (const equipped of Object.values(history.equippedTraits)) {
    const declaration = catalog.traits.byKey[equipped.traitKey];
    if (declaration === undefined) continue;
    const shopGodTrait = catalog.traitGivers.values.some(
      (giver) => giver.shopAwareGodTrait && giver.traitKeys.includes(equipped.traitKey),
    );
    const eligible =
      shopGodTrait &&
      declaration.usesBoonRarity === true &&
      equipped.rarity === 'Common' &&
      !declaration.blockInRunRarify &&
      declaration.rarityDomain.kind === 'ranked' &&
      declaration.rarityDomain.equippedRarities.includes(targetRarity);
    if (!eligible) continue;
    consumptionTargetKeys.push(equipped.traitKey);
    if (hasEffectiveInRunUpgrade(catalog, equipped.traitKey, equipped))
      mutationTargetKeys.push(equipped.traitKey);
  }
  return Object.freeze({
    consumptionTargetKeys: Object.freeze(consumptionTargetKeys),
    mutationTargetKeys: Object.freeze(mutationTargetKeys),
  });
}

export function equipJeweledPom(
  state: KeepsakeState,
  grantedTraitKey: string,
  levels: number,
  acquisitionIdentity: string,
): KeepsakeState {
  return Object.freeze({
    ...state,
    jeweledPom: Object.freeze({
      grantedTraitKey,
      active: state.fatedStatus === 'Fated',
      levels,
      acquisitionIdentity,
    }),
  });
}

/** One exact direct Hades acquisition; not an ordinary three-option offer. */
export function assessJeweledPomEquipResult(
  catalog: Catalog,
  result: NonNullable<AuthoredKeepsakeEquipResults['jeweledPom']>,
  before: TraitHistoryState,
  fatedStatus: FatedStatus,
): { readonly legal: boolean; readonly findings: readonly string[] } {
  if (fatedStatus !== 'Fated')
    return Object.freeze({
      legal: false,
      findings: Object.freeze(['keepsakeEquipResultUnavailable']),
    });
  const effect = keepsakeEffectByKind(catalog, 'jeweledPom');
  if (effect === undefined)
    return Object.freeze({
      legal: false,
      findings: Object.freeze(['keepsakeEquipResultUnavailable']),
    });
  const assessment = assessTraitOption(
    catalog,
    result.traitKey,
    before,
    { resolvedProviderKey: effect.giverKey },
    result.rarity,
  );
  return Object.freeze({
    legal: assessment.legal,
    findings: Object.freeze(assessment.findings.map((finding) => finding.code)),
  });
}

/** One direct rarityless Hammer acquisition, assessed against the captured pre-equip state. */
export function assessExperimentalHammerEquipResult(
  catalog: Catalog,
  result: NonNullable<AuthoredKeepsakeEquipResults['experimentalHammer']>,
  before: TraitHistoryState,
  loadout: { readonly weaponKey: string; readonly aspectKey: string },
): { readonly legal: boolean; readonly findings: readonly string[] } {
  const domain = catalog.traits.values.filter(
    (trait) =>
      trait.hammerCompatibility !== undefined &&
      assessTraitOption(catalog, trait.key, before, loadout).legal,
  );
  if (result.kind === 'exhausted')
    return Object.freeze({
      legal: domain.length === 0,
      findings: Object.freeze(domain.length === 0 ? [] : ['keepsakeEquipResultUnavailable']),
    });
  const assessment = assessTraitOption(catalog, result.traitKey, before, loadout);
  const trait = catalog.traits.byKey[result.traitKey];
  return Object.freeze({
    legal: trait?.hammerCompatibility !== undefined && assessment.legal,
    findings: Object.freeze([
      ...(trait?.hammerCompatibility === undefined ? ['keepsakeEquipResultUnavailable'] : []),
      ...assessment.findings.map((finding) => finding.code),
    ]),
  });
}

export interface TranscendentEmbryoBlessingContext {
  readonly routeKey?: string;
  readonly aspectKey?: string;
  readonly removedBlessingAcquisitionIdentity?: string;
}

/** The direct Chaos blessing domain; it never creates a Chaos offer/menu. */
export function transcendentEmbryoBlessingKeys(
  catalog: Catalog,
  history: TraitHistoryState,
  rarity: InRunTraitRarity,
  context: TranscendentEmbryoBlessingContext = {},
  excludedBlessingKeys: readonly string[] = [],
): readonly string[] {
  const excluded = new Set(excludedBlessingKeys);
  const matureCount = history.maturedChaosBlessings.filter(
    (blessing) => blessing.acquisitionIdentity !== context.removedBlessingAcquisitionIdentity,
  ).length;
  return Object.freeze(
    catalog.chaos.blessings.values
      .filter((blessing) => {
        if (blessing.fixedRarity !== undefined || excluded.has(blessing.key)) return false;
        return (blessing.offerRequirements ?? []).every((requirement) => {
          switch (requirement.kind) {
            case 'matureChaosBlessing':
              return matureCount > 0;
            case 'elementMinimum':
              return history.elementCounts[requirement.element] >= requirement.minimum;
            case 'notAspect':
              return context.aspectKey !== requirement.aspectKey;
            case 'notKeepsake':
              return true;
            case 'routeKey':
              return context.routeKey === requirement.routeKey;
          }
        });
      })
      .map((blessing) => blessing.key),
  );
}

/** Declaration-derived values used by direct Embryo blessings. */
export function transcendentEmbryoBlessingValues(
  catalog: Catalog,
  blessingKey: string,
  rarity: InRunTraitRarity,
): Readonly<Record<string, number>> {
  const blessing = catalog.chaos.blessings.byKey[blessingKey];
  if (blessing === undefined) return Object.freeze({});
  return Object.freeze(
    Object.fromEntries(
      blessing.operands.map((operand) => [
        operand.key,
        (operand.byRarity?.[rarity] ?? operand).minimum,
      ]),
    ),
  );
}

export function assessTranscendentEmbryoBlessing(
  catalog: Catalog,
  result: NonNullable<AuthoredKeepsakeEquipResults['transcendentEmbryo']>,
  history: TraitHistoryState,
  rarity: InRunTraitRarity,
  context: TranscendentEmbryoBlessingContext = {},
  excludedBlessingKeys: readonly string[] = [],
): { readonly legal: boolean; readonly findings: readonly string[] } {
  const legal = transcendentEmbryoBlessingKeys(
    catalog,
    history,
    rarity,
    context,
    excludedBlessingKeys,
  ).includes(result.blessingKey);
  return Object.freeze({
    legal,
    findings: Object.freeze(legal ? [] : ['keepsakeEquipResultUnavailable']),
  });
}

export function equipTranscendentEmbryo(
  state: KeepsakeState,
  origin: 'ordinary' | 'echo',
  rarity: InRunTraitRarity,
  blessingKey: string,
  acquisitionIdentity: string,
): KeepsakeState {
  return Object.freeze({
    ...state,
    transcendentEmbryo: Object.freeze({
      origin,
      rarity,
      progress: 0,
      markedBlessingKey: blessingKey,
      markedBlessingAcquisitionIdentity: acquisitionIdentity,
    }),
  });
}

export function advanceTranscendentEmbryoProgress(state: KeepsakeState): {
  readonly state: KeepsakeState;
  readonly reached: boolean;
} {
  const source = state.transcendentEmbryo;
  if (source === undefined) return Object.freeze({ state, reached: false });
  const progress = source.progress + 1;
  if (progress < 8)
    return Object.freeze({
      state: Object.freeze({
        ...state,
        transcendentEmbryo: Object.freeze({ ...source, progress }),
      }),
      reached: false,
    });
  return Object.freeze({
    state: Object.freeze({
      ...state,
      transcendentEmbryo: Object.freeze({ ...source, progress: 0 }),
    }),
    reached: true,
  });
}

export interface ReachedTranscendentEmbryoThreshold {
  readonly source: NonNullable<KeepsakeState['transcendentEmbryo']>;
  readonly before: TraitHistoryState;
  readonly eligibleBlessingKeys: readonly string[];
}

export interface TranscendentEmbryoBlessingAssessment {
  readonly legal: boolean;
  readonly blessingKey: string | null;
  readonly eligibleBlessingKeys: readonly string[];
}

export function assessTranscendentEmbryoTransformation(
  _catalog: Catalog,
  threshold: ReachedTranscendentEmbryoThreshold,
  blessingKey: string | null | undefined,
  _context: TranscendentEmbryoBlessingContext = {},
): TranscendentEmbryoBlessingAssessment {
  const selected = blessingKey ?? null;
  const legal =
    threshold.eligibleBlessingKeys.length === 0
      ? selected === null
      : selected !== null && threshold.eligibleBlessingKeys.includes(selected);
  return Object.freeze({
    legal,
    blessingKey: selected,
    eligibleBlessingKeys: threshold.eligibleBlessingKeys,
  });
}

export function replaceTranscendentEmbryoBlessing(
  state: KeepsakeState,
  blessingKey: string,
  acquisitionIdentity: string,
): KeepsakeState {
  const source = state.transcendentEmbryo;
  if (source === undefined) return state;
  return Object.freeze({
    ...state,
    transcendentEmbryo: Object.freeze({
      ...source,
      progress: 0,
      markedBlessingKey: blessingKey,
      markedBlessingAcquisitionIdentity: acquisitionIdentity,
    }),
  });
}

export function applyTranscendentEmbryoEquipResult(
  catalog: Catalog,
  branch: RewardBranchState,
  equippedKeepsakeKey: string,
  result: NonNullable<AuthoredKeepsakeEquipResults['transcendentEmbryo']>,
  owner: SemanticAddress,
  sequence: number,
  origin: 'ordinary' | 'echo',
  equippedRank: KeepsakeRank,
  context: TranscendentEmbryoBlessingContext = {},
): RewardBranchState {
  const keepsake = catalog.keepsakes.byKey[equippedKeepsakeKey];
  const effect = keepsake?.effect;
  if (effect?.kind !== 'transcendentEmbryo') return branch;
  const rarity = effect.blessingRarityByRank[equippedRank];
  const before = branch.traitHistory ?? createTraitHistoryState();
  if (!assessTranscendentEmbryoBlessing(catalog, result, before, rarity, context).legal)
    return branch;
  const acquisitionIdentity = `${semanticAddressKey(owner)}:${sequence}`;
  const history = foldTraitHistoryEvents(catalog, [
    ...before.events,
    Object.freeze({
      kind: 'directChaosBlessing' as const,
      owner,
      acquisitionRole: 'transcendentEmbryoEquip' as const,
      sequence,
      acquisitionPoint: origin === 'echo' ? 'biomeStart' : 'keepsakeEquip',
      acquisitionIdentity,
      blessingKey: result.blessingKey,
      rarity,
      blessingValues: transcendentEmbryoBlessingValues(catalog, result.blessingKey, rarity),
    }),
  ]);
  return Object.freeze({
    ...branch,
    history: attachTraitHistory(branch.history, history),
    traitHistory: history,
    keepsakes: equipTranscendentEmbryo(
      branch.keepsakes,
      origin,
      rarity,
      result.blessingKey,
      acquisitionIdentity,
    ),
  });
}

export function invalidateJeweledPom(state: KeepsakeState): KeepsakeState {
  if (state.jeweledPom === undefined || !state.jeweledPom.active) return state;
  return Object.freeze({
    ...state,
    jeweledPom: Object.freeze({ ...state.jeweledPom, active: false }),
  });
}

export function equipExperimentalHammer(
  state: KeepsakeState,
  traitKey: string,
  remainingUses: number,
  acquisitionIdentity: string,
): KeepsakeState {
  return Object.freeze({
    ...state,
    experimentalHammers: Object.freeze([
      ...state.experimentalHammers,
      Object.freeze({ traitKey, remainingUses, acquisitionIdentity, active: true }),
    ]),
  });
}

/** A qualifying completion consumes exactly one use; expiry is a separate fold event. */
export function advanceExperimentalHammers(state: KeepsakeState): {
  readonly state: KeepsakeState;
  readonly expired: KeepsakeState['experimentalHammers'];
} {
  if (!state.experimentalHammers.some((hammer) => hammer.active))
    return Object.freeze({ state, expired: Object.freeze([]) });
  const expired: KeepsakeState['experimentalHammers'][number][] = [];
  const experimentalHammers = Object.freeze(
    state.experimentalHammers.map((hammer) => {
      if (!hammer.active) return hammer;
      const remainingUses = Math.max(0, hammer.remainingUses - 1);
      const next = Object.freeze({ ...hammer, remainingUses, active: remainingUses > 0 });
      if (remainingUses === 0) expired.push(next);
      return next;
    }),
  );
  return Object.freeze({
    state: Object.freeze({ ...state, experimentalHammers }),
    expired: Object.freeze(expired),
  });
}
export type KeepsakeSelectionUnavailableReason =
  'alreadyEquipped' | 'removed' | 'unfatedEnabling' | 'encounterHistory';

/** Exact non-start rack legality; route start intentionally replaces all history. */
export function keepsakeSelectionUnavailableReason(
  catalog: Catalog,
  state: KeepsakeState,
  key: string,
  encounterBlockedKeepsakeKeys: readonly string[] = [],
): KeepsakeSelectionUnavailableReason | undefined {
  if (state.currentKey === key) return 'alreadyEquipped';
  if (state.removedKeys.includes(key)) return 'removed';
  if (
    state.fatedStatus === 'Unfated' &&
    catalog.keepsakes.byKey[key]?.fatedDisposition === 'enabling'
  )
    return 'unfatedEnabling';
  return encounterBlockedKeepsakeKeys.includes(key) ? 'encounterHistory' : undefined;
}

/**
 * This is intentionally a derivation of the explicit branch products, never
 * a second mutable lifecycle. An opposing identity remains historical even
 * after it is removed, matching the run's irreversible Unfated transition.
 */
export function deriveFatedStatus(
  catalog: Catalog,
  keys: readonly string[],
  activeArcanaKeys: readonly string[] = [],
): FatedStatus {
  if (activeArcanaKeys.some((key) => catalog.arcanaCards.byKey[key]?.fatedIncompatible === true))
    return 'Unfated';
  if (keys.some((key) => catalog.keepsakes.byKey[key]?.fatedDisposition === 'opposing'))
    return 'Unfated';
  return keys.some((key) => catalog.keepsakes.byKey[key]?.fatedDisposition === 'enabling')
    ? 'Fated'
    : 'Unknown';
}
export function createKeepsakeState(
  catalog: Catalog,
  key: string,
  arcanaFear?: ArcanaFearState,
): KeepsakeState {
  const keepsake = catalog.keepsakes.byKey[key];
  const effect = keepsake?.effect;
  const fatedStatus = deriveFatedStatus(
    catalog,
    [key],
    arcanaFear?.arcana.active.map((card) => card.key),
  );
  return Object.freeze({
    currentKey: key,
    history: Object.freeze([{ key, kind: 'start' as const }]),
    removedKeys: Object.freeze([]),
    fatedStatus,
    experimentalHammers: Object.freeze([]),
    olympianSources:
      effect?.kind === 'olympianRewardPressure'
        ? Object.freeze([
            Object.freeze({
              keepsakeKey: key,
              providerKey: effect.providerKey,
              origin: 'ordinary' as const,
              acquisitionOrder: 0,
              remainingForceUses: effect.providerForceUses,
              remainingRarificationUses: effect.providerRarificationUses,
              maximumSourceRarityLevel: effect.maximumSourceRarityLevelByRank[keepsake!.rank],
            }),
          ])
        : Object.freeze([]),
    nextOlympianAcquisitionOrder: effect?.kind === 'olympianRewardPressure' ? 1 : 0,
    ...(effect?.kind === 'callingCard' && keepsake !== undefined
      ? {
          callingCard: Object.freeze({
            remainingCharges:
              fatedStatus === 'Unfated' ? 0 : effect.rarificationChargesByRank[keepsake.rank],
          }),
        }
      : {}),
    ...(effect?.kind === 'timePiece' && keepsake !== undefined
      ? {
          timePiece: Object.freeze({
            remainingCharges:
              fatedStatus === 'Unfated' ? 0 : effect.conversionChargesByRank[keepsake.rank],
          }),
        }
      : {}),
    ...(effect?.kind === 'figLeaf' && keepsake !== undefined
      ? {
          figLeaf: Object.freeze({
            remainingUses: effect.biomeUsesByRank[keepsake.rank],
            activatedThisBiome: false,
          }),
        }
      : {}),
    ...(effect?.kind === 'gorgonAmulet' && keepsake !== undefined
      ? {
          gorgon: Object.freeze({
            status: 'pending' as const,
            rarity: gorgonRarityForRank(catalog, effect, keepsake.rank),
          }),
        }
      : {}),
    ...(effect?.kind === 'fountainRarity'
      ? { phial: Object.freeze({ status: 'pending' as const }) }
      : {}),
    ...(effect?.kind === 'crystalFigurine' && keepsake !== undefined
      ? {
          figurine: Object.freeze({
            origin: 'ordinary' as const,
            status: 'pending' as const,
            rarity: figurineRarityForRank(catalog, effect, keepsake.rank),
          }),
        }
      : {}),
    ...(effect?.kind === 'concaveStone' && keepsake !== undefined
      ? {
          stone: Object.freeze({
            origin: 'ordinary' as const,
            status: 'pending' as const,
            rank: keepsake.rank,
          }),
        }
      : {}),
  });
}
export function applyKeepsakeDisposition(
  catalog: Catalog,
  state: KeepsakeState,
  disposition:
    { readonly kind: 'retain' } | { readonly kind: 'replace'; readonly keepsakeKey: string },
  arcanaFear: ArcanaFearState,
  equippedRank?: KeepsakeRank,
): KeepsakeState {
  const activeArcanaKeys = arcanaFear.arcana.active.map((card) => card.key);
  if (disposition.kind === 'retain') {
    const history = Object.freeze([
      ...state.history,
      { key: state.currentKey, kind: 'retain' as const },
    ]);
    const fatedStatus = deriveFatedStatus(
      catalog,
      history.map((entry) => entry.key),
      activeArcanaKeys,
    );
    return Object.freeze({
      ...state,
      history,
      fatedStatus,
      ...(fatedStatus === 'Unfated' && state.callingCard !== undefined
        ? { callingCard: Object.freeze({ remainingCharges: 0 }) }
        : {}),
      ...(fatedStatus === 'Unfated' && state.timePiece !== undefined
        ? { timePiece: Object.freeze({ remainingCharges: 0 }) }
        : {}),
    });
  }
  // Invalid authored values deliberately remain in the document for repair,
  // but may not create a false chronological run transition.
  const selected = catalog.keepsakes.byKey[disposition.keepsakeKey];
  if (
    selected === undefined ||
    keepsakeSelectionUnavailableReason(catalog, state, disposition.keepsakeKey) !== undefined
  )
    return state;
  const rank = equippedRank ?? selected.rank;
  const history = Object.freeze([
    ...state.history,
    { key: disposition.keepsakeKey, kind: 'replace' as const },
  ]);
  const fatedStatus = deriveFatedStatus(
    catalog,
    history.map((entry) => entry.key),
    activeArcanaKeys,
  );
  const { phial: _phial, figurine: _figurine, ...withoutPhialAndFigurine } = state;
  void _phial;
  void _figurine;
  const stateWithoutTrackedSources =
    state.currentKey === 'UnpickedBoonKeepsake'
      ? (() => {
          const { stone: _stone, ...withoutStone } = withoutPhialAndFigurine;
          void _stone;
          return withoutStone;
        })()
      : withoutPhialAndFigurine;
  const stateWithoutSources =
    state.currentKey === 'RandomBlessingKeepsake'
      ? (() => {
          const { transcendentEmbryo: _transcendentEmbryo, ...withoutTranscendentEmbryo } =
            stateWithoutTrackedSources;
          void _transcendentEmbryo;
          return withoutTranscendentEmbryo;
        })()
      : stateWithoutTrackedSources;
  const withoutOrdinaryOlympian = stateWithoutSources.olympianSources.some(
    (source) => source.origin === 'ordinary',
  )
    ? Object.freeze({
        ...stateWithoutSources,
        olympianSources: Object.freeze(
          stateWithoutSources.olympianSources.filter((source) => source.origin !== 'ordinary'),
        ),
      })
    : stateWithoutSources;
  return Object.freeze({
    ...withoutOrdinaryOlympian,
    currentKey: disposition.keepsakeKey,
    history,
    removedKeys: Object.freeze([...state.removedKeys, state.currentKey]),
    fatedStatus,
    ...(state.gorgon?.status === 'pending'
      ? { gorgon: Object.freeze({ status: 'expired' as const }) }
      : {}),
    ...(selected.effect?.kind === 'callingCard' && state.callingCard === undefined
      ? {
          callingCard: Object.freeze({
            remainingCharges: selected.effect.rarificationChargesByRank[rank],
          }),
        }
      : {}),
    ...(selected.effect?.kind === 'timePiece' && state.timePiece === undefined
      ? {
          timePiece: Object.freeze({
            remainingCharges: selected.effect.conversionChargesByRank[rank],
          }),
        }
      : {}),
    ...(selected.effect?.kind === 'figLeaf' && state.figLeaf === undefined
      ? {
          figLeaf: Object.freeze({
            remainingUses: selected.effect.biomeUsesByRank[rank],
            activatedThisBiome: false,
          }),
        }
      : {}),
    ...(selected.effect?.kind === 'gorgonAmulet' && state.gorgon === undefined
      ? {
          gorgon: Object.freeze({
            status: 'pending' as const,
            rarity: gorgonRarityForRank(catalog, selected.effect, rank),
          }),
        }
      : {}),
    ...(selected.effect?.kind === 'fountainRarity'
      ? { phial: Object.freeze({ status: 'pending' as const }) }
      : {}),
    ...(selected.effect?.kind === 'crystalFigurine'
      ? {
          figurine: Object.freeze({
            origin: 'ordinary' as const,
            status: 'pending' as const,
            rarity: figurineRarityForRank(catalog, selected.effect, rank),
          }),
        }
      : {}),
    ...(selected.effect?.kind === 'concaveStone'
      ? {
          stone: Object.freeze({
            origin: 'ordinary' as const,
            status: 'pending' as const,
            rank,
          }),
        }
      : {}),
    ...(selected.effect?.kind === 'olympianRewardPressure'
      ? {
          olympianSources: Object.freeze([
            ...(withoutOrdinaryOlympian.olympianSources ?? []),
            Object.freeze({
              keepsakeKey: selected.key,
              providerKey: selected.effect.providerKey,
              origin: 'ordinary' as const,
              acquisitionOrder: state.nextOlympianAcquisitionOrder,
              remainingForceUses: selected.effect.providerForceUses,
              remainingRarificationUses: selected.effect.providerRarificationUses,
              maximumSourceRarityLevel:
                selected.effect.maximumSourceRarityLevelByRank[rank === 'Heroic' ? 'Epic' : rank],
            }),
          ]),
          nextOlympianAcquisitionOrder: state.nextOlympianAcquisitionOrder + 1,
        }
      : {}),
    ...(fatedStatus === 'Unfated' && state.callingCard !== undefined
      ? { callingCard: Object.freeze({ remainingCharges: 0 }) }
      : {}),
    ...(fatedStatus === 'Unfated' && state.timePiece !== undefined
      ? { timePiece: Object.freeze({ remainingCharges: 0 }) }
      : {}),
  });
}

export type PhialLifecycleStatus = 'pending' | 'consumed';
export type FigurineLifecycleStatus = 'pending' | 'consumed';

export function consumePhial(state: KeepsakeState): KeepsakeState {
  if (state.phial?.status !== 'pending') return state;
  return Object.freeze({ ...state, phial: Object.freeze({ status: 'consumed' as const }) });
}

export function consumeFigurine(state: KeepsakeState): KeepsakeState {
  const figurine = state.figurine;
  if (figurine?.status !== 'pending') return state;
  if (figurine.origin === 'echo') {
    const { figurine: _figurine, ...withoutFigurine } = state;
    return Object.freeze(withoutFigurine);
  }
  return Object.freeze({ ...state, figurine: Object.freeze({ ...figurine, status: 'consumed' }) });
}

export function consumeConcaveStone(state: KeepsakeState): KeepsakeState {
  const stone = state.stone;
  if (stone?.status !== 'pending') return state;
  return Object.freeze({ ...state, stone: Object.freeze({ ...stone, status: 'consumed' }) });
}

export function concaveStoneProcSupport(
  catalog: Catalog,
  state: KeepsakeState,
): number | undefined {
  const source = state.stone;
  if (source === undefined || source.status !== 'pending') return undefined;
  const effect = keepsakeEffectByKind(catalog, 'concaveStone');
  return effect?.procSupportByRank[source.rank];
}

/** Original generated rows which Stone may select after the primary row. */
export function concaveStoneResidualOptionKeys(
  offer: AuthoredTraitOfferTraits,
  replacementOptionKeys: readonly TraitOptionKey[] = [],
): readonly TraitOptionKey[] {
  const replacements = new Set(replacementOptionKeys);
  return Object.freeze(
    (['option1', 'option2', 'option3'] as const).filter(
      (key) =>
        optionIndex(key) < offer.options.length &&
        key !== offer.selectedOptionKey &&
        key !== offer.rejectedOptionKey &&
        !replacements.has(key),
    ),
  );
}

/** Creates one Common unslotted source when no Figurine source is already present. */
export function applyEchoFigurineReplay(
  catalog: Catalog,
  state: KeepsakeState,
  capturedKeepsakeKey: string,
): KeepsakeState {
  if (capturedKeepsakeKey !== 'BossMetaUpgradeKeepsake' || state.figurine !== undefined)
    return state;
  const effect = catalog.keepsakes.byKey[capturedKeepsakeKey]?.effect;
  if (effect?.kind !== 'crystalFigurine') return state;
  return Object.freeze({
    ...state,
    figurine: Object.freeze({
      origin: 'echo' as const,
      status: 'pending' as const,
      rarity: figurineRarityForRank(catalog, effect, 'Common'),
    }),
  });
}

/** Creates one Common unslotted Stone source when no Stone source is present. */
export function applyEchoConcaveStoneReplay(
  catalog: Catalog,
  state: KeepsakeState,
  capturedKeepsakeKey: string,
): KeepsakeState {
  if (capturedKeepsakeKey !== 'UnpickedBoonKeepsake' || state.stone !== undefined) return state;
  const effect = catalog.keepsakes.byKey[capturedKeepsakeKey]?.effect;
  if (effect?.kind !== 'concaveStone') return state;
  return Object.freeze({
    ...state,
    stone: Object.freeze({ origin: 'echo' as const, status: 'pending' as const, rank: 'Common' }),
  });
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
export function beginBiomeKeepsakeState(state: KeepsakeState): KeepsakeState {
  if (state.figLeaf === undefined || !state.figLeaf.activatedThisBiome) return state;
  return Object.freeze({
    ...state,
    figLeaf: Object.freeze({ ...state.figLeaf, activatedThisBiome: false }),
  });
}

export function applyEchoFigLeafReplay(state: KeepsakeState): KeepsakeState {
  return Object.freeze({
    ...state,
    figLeaf: Object.freeze({
      remainingUses: Math.max(state.figLeaf?.remainingUses ?? 0, 1),
      activatedThisBiome: state.figLeaf?.activatedThisBiome ?? false,
    }),
  });
}

export function applyEchoCallingCardReplay(state: KeepsakeState, charges: number): KeepsakeState {
  return Object.freeze({
    ...state,
    callingCard: Object.freeze({
      remainingCharges: (state.callingCard?.remainingCharges ?? 0) + charges,
    }),
  });
}

export function applyEchoTimePieceReplay(state: KeepsakeState, charges: number): KeepsakeState {
  return Object.freeze({
    ...state,
    timePiece: Object.freeze({
      remainingCharges: (state.timePiece?.remainingCharges ?? 0) + charges,
    }),
  });
}

/** Gift Gift Gift recreates the Common source without occupying the ordinary slot. */
export function applyEchoOlympianRewardPressureReplay(
  catalog: Catalog,
  state: KeepsakeState,
  capturedKeepsakeKey: string,
): KeepsakeState {
  const effect = catalog.keepsakes.byKey[capturedKeepsakeKey]?.effect;
  if (
    effect?.kind !== 'olympianRewardPressure' ||
    state.olympianSources.some((source) => source.origin === 'echo')
  )
    return state;
  return Object.freeze({
    ...state,
    olympianSources: Object.freeze([
      ...state.olympianSources,
      Object.freeze({
        keepsakeKey: capturedKeepsakeKey,
        providerKey: effect.providerKey,
        origin: 'echo' as const,
        acquisitionOrder: state.nextOlympianAcquisitionOrder,
        remainingForceUses: effect.providerForceUses,
        remainingRarificationUses: effect.providerRarificationUses,
        maximumSourceRarityLevel: effect.maximumSourceRarityLevelByRank.Common,
      }),
    ]),
    nextOlympianAcquisitionOrder: state.nextOlympianAcquisitionOrder + 1,
  });
}

/** Every matching non-purchase materialization spends its own active force use. */
export function consumeOlympianProviderMaterialized(
  state: KeepsakeState,
  providerKey: string,
  provenance: 'free' | 'paid',
): KeepsakeState {
  if (provenance === 'paid') return state;
  const previous = state.olympianSources;
  const sources = previous.map((source) =>
    source.providerKey === providerKey && source.remainingForceUses === 1
      ? Object.freeze({ ...source, remainingForceUses: 0 as const })
      : source,
  );
  return sources.some((source, index) => source !== previous[index])
    ? Object.freeze({ ...state, olympianSources: Object.freeze(sources) })
    : state;
}

/** Ordinary setup scans first; Devotion's distinct source loop scans last. */
export function olympianProviderForOffer(
  state: KeepsakeState,
  priorProviderKeys: readonly string[] = [],
  devotion = false,
  interactedProviderKeys: ReadonlySet<string> = new Set(),
): string | undefined {
  const candidates = state.olympianSources.filter(
    (source) =>
      source.remainingForceUses === 1 &&
      !priorProviderKeys.includes(source.providerKey) &&
      (!devotion || interactedProviderKeys.has(source.providerKey)),
  );
  return (devotion ? candidates.at(-1) : candidates[0])?.providerKey;
}

/** Consume one total use and close the current biome opportunity. */
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

export function refreshKeepsakeFatedStatus(
  catalog: Catalog,
  state: KeepsakeState,
  arcanaFear: ArcanaFearState,
): KeepsakeState {
  const fatedStatus = deriveFatedStatus(
    catalog,
    state.history.map((entry) => entry.key),
    arcanaFear.arcana.active.map((card) => card.key),
  );
  if (fatedStatus === state.fatedStatus) return state;
  return Object.freeze({
    ...state,
    fatedStatus,
    ...(fatedStatus === 'Unfated' && state.callingCard !== undefined
      ? { callingCard: Object.freeze({ remainingCharges: 0 }) }
      : {}),
    ...(fatedStatus === 'Unfated' && state.timePiece !== undefined
      ? { timePiece: Object.freeze({ remainingCharges: 0 }) }
      : {}),
  });
}

/** Consume one legal conversion without producing a Gold acquisition. */
export function consumeTimePieceCharge(state: KeepsakeState): KeepsakeState {
  const remaining = state.timePiece?.remainingCharges ?? 0;
  if (state.fatedStatus !== 'Fated' || remaining === 0) return state;
  return Object.freeze({ ...state, timePiece: Object.freeze({ remainingCharges: remaining - 1 }) });
}

/** Replays the persisted row ledger once for every consumer of an offer. */
export function evaluateCallingCardOffer(
  catalog: Catalog,
  state: KeepsakeState,
  offer: AuthoredTraitOffer,
  baseOfferLegal: boolean,
): {
  readonly offer: AuthoredTraitOffer;
  readonly state: KeepsakeState;
  readonly invalidActions: readonly number[];
} {
  if (
    offer.kind !== 'traits' ||
    offer.rarificationActions === undefined ||
    offer.rarificationActions.length === 0
  )
    return Object.freeze({ offer, state, invalidActions: Object.freeze([]) });
  let remaining = state.callingCard?.remainingCharges ?? 0;
  let olympianSources = state.olympianSources ?? Object.freeze([]);
  const options = offer.options.map((option) => ({ ...option }));
  const invalidActions: number[] = [];
  for (const [index, key] of offer.rarificationActions.entries()) {
    const option = options[optionIndex(key)];
    const trait = option === undefined ? undefined : catalog.traits.byKey[option.traitKey];
    const next =
      option?.rarity === undefined
        ? undefined
        : nextRarity(catalog, option.traitKey, option.rarity);
    const rarityLevel =
      option?.rarity === undefined
        ? 0
        : (catalog.traitRarityOrder as readonly string[]).indexOf(option.rarity) + 1;
    // A matching Olympian source owns this action even when its rank cap makes
    // the action unavailable.  Falling through to Calling Card in that case
    // would silently change the source-specific cap into a general upgrade.
    const providerSource = olympianSources.find(
      (source) => source.providerKey === offer.giverKey && source.remainingRarificationUses === 1,
    );
    if (
      baseOfferLegal &&
      providerSource !== undefined &&
      option !== undefined &&
      trait !== undefined &&
      !trait.blockInRunRarify &&
      next !== undefined &&
      rarityLevel <= providerSource.maximumSourceRarityLevel &&
      offer.rejectedOptionKey !== key
    ) {
      options[optionIndex(key)] = { ...option, rarity: next };
      olympianSources = Object.freeze(
        olympianSources
          .map((source) =>
            source === providerSource
              ? Object.freeze({ ...source, remainingRarificationUses: 0 as const })
              : source,
          )
          // An unslotted Gift source is removed only after the nested use is spent.
          .filter((source) => source.origin !== 'echo' || source.remainingRarificationUses > 0),
      );
      continue;
    }
    if (providerSource !== undefined) {
      invalidActions.push(index);
      continue;
    }
    if (
      !baseOfferLegal ||
      state.fatedStatus !== 'Fated' ||
      remaining === 0 ||
      !catalog.traitGivers.byKey[offer.giverKey]?.callingCardMenu ||
      offer.rejectedOptionKey === key ||
      trait === undefined ||
      trait.blockInRunRarify ||
      next === undefined
    ) {
      invalidActions.push(index);
      continue;
    }
    options[optionIndex(key)] = { ...option!, rarity: next };
    remaining -= 1;
  }
  const effective = Object.freeze({
    ...offer,
    options: Object.freeze(options) as typeof offer.options,
  });
  const nextState =
    remaining === (state.callingCard?.remainingCharges ?? 0) &&
    olympianSources === state.olympianSources
      ? state
      : Object.freeze({
          ...state,
          ...(remaining === (state.callingCard?.remainingCharges ?? 0)
            ? {}
            : { callingCard: Object.freeze({ remainingCharges: remaining }) }),
          ...(olympianSources === state.olympianSources ? {} : { olympianSources }),
        });
  return Object.freeze({
    offer: effective,
    state: nextState,
    invalidActions: Object.freeze(invalidActions),
  });
}
