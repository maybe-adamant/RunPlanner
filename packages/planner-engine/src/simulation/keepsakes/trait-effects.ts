import type { Catalog, InRunTraitRarity } from '../../catalog-schema';
import type { AuthoredKeepsakeEquipResults } from '../../authored-project/model';
import {
  chaosOperandAuthoringValues,
  chaosOperandsAtRarity,
  normalizeChaosValues,
  optionIndex,
  type AuthoredTranscendentEmbryoOutcome,
  type AuthoredTraitOfferTraits,
  type TraitOptionKey,
} from '../../authored-project/traits';
import { hasEffectiveInRunUpgrade, type TraitHistoryState } from '../trait-history';
import { assessTraitOption } from '../trait-authoring-policies';
import {
  figurineRarityForRank,
  keepsakeEffectByKind,
  type FatedStatus,
  type KeepsakeState,
} from './state';

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
  return chaosOperandAuthoringValues(blessing.operands, rarity);
}

export function assessTranscendentEmbryoBlessing(
  catalog: Catalog,
  result: NonNullable<AuthoredKeepsakeEquipResults['transcendentEmbryo']>,
  history: TraitHistoryState,
  rarity: InRunTraitRarity,
  context: TranscendentEmbryoBlessingContext = {},
  excludedBlessingKeys: readonly string[] = [],
): { readonly legal: boolean; readonly findings: readonly string[] } {
  const keyLegal = transcendentEmbryoBlessingKeys(
    catalog,
    history,
    rarity,
    context,
    excludedBlessingKeys,
  ).includes(result.blessingKey);
  const operands = catalog.chaos.blessings.byKey[result.blessingKey]?.operands ?? [];
  let valuesLegal = operands.length === 0 && Object.keys(result.blessingValues).length === 0;
  if (Object.keys(result.blessingValues).length > 0) {
    try {
      valuesLegal =
        normalizeChaosValues(
          chaosOperandsAtRarity(operands, rarity),
          result.blessingValues,
          'blessingValues',
        ) !== undefined;
    } catch {
      valuesLegal = false;
    }
  }
  const legal = keyLegal && valuesLegal;
  return Object.freeze({
    legal,
    findings: Object.freeze(legal ? [] : ['keepsakeEquipResultUnavailable']),
  });
}

export function equipTranscendentEmbryo(
  state: KeepsakeState,
  origin: 'ordinary' | 'echo',
  rarity: InRunTraitRarity,
  outcome: AuthoredTranscendentEmbryoOutcome,
  acquisitionIdentity: string,
): KeepsakeState {
  return Object.freeze({
    ...state,
    transcendentEmbryo: Object.freeze({
      origin,
      rarity,
      progress: 0,
      markedBlessingKey: outcome.blessingKey,
      markedBlessingValues: outcome.blessingValues,
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
  readonly value: AuthoredTranscendentEmbryoOutcome | null;
  readonly eligibleBlessingKeys: readonly string[];
}

export function assessTranscendentEmbryoTransformation(
  catalog: Catalog,
  threshold: ReachedTranscendentEmbryoThreshold,
  outcome: AuthoredTranscendentEmbryoOutcome | null | undefined,
): TranscendentEmbryoBlessingAssessment {
  const selected = outcome ?? null;
  const keyLegal =
    threshold.eligibleBlessingKeys.length === 0
      ? selected === null
      : selected !== null && threshold.eligibleBlessingKeys.includes(selected.blessingKey);
  const operands =
    selected === null ? [] : (catalog.chaos.blessings.byKey[selected.blessingKey]?.operands ?? []);
  let valuesLegal =
    selected !== null && operands.length === 0 && Object.keys(selected.blessingValues).length === 0;
  if (selected !== null && Object.keys(selected.blessingValues).length > 0) {
    try {
      valuesLegal =
        normalizeChaosValues(
          chaosOperandsAtRarity(operands, threshold.source.rarity),
          selected.blessingValues,
          'blessingValues',
        ) !== undefined;
    } catch {
      valuesLegal = false;
    }
  }
  const legal = selected === null ? keyLegal : keyLegal && valuesLegal;
  return Object.freeze({
    legal,
    blessingKey: selected?.blessingKey ?? null,
    value: selected,
    eligibleBlessingKeys: threshold.eligibleBlessingKeys,
  });
}

export function replaceTranscendentEmbryoBlessing(
  state: KeepsakeState,
  outcome: AuthoredTranscendentEmbryoOutcome,
  acquisitionIdentity: string,
): KeepsakeState {
  const source = state.transcendentEmbryo;
  if (source === undefined) return state;
  return Object.freeze({
    ...state,
    transcendentEmbryo: Object.freeze({
      ...source,
      progress: 0,
      markedBlessingKey: outcome.blessingKey,
      markedBlessingValues: outcome.blessingValues,
      markedBlessingAcquisitionIdentity: acquisitionIdentity,
    }),
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
export type PhialLifecycleStatus = 'pending' | 'consumed';
export type FigurineLifecycleStatus = 'pending' | 'consumed';

export function consumePhial(state: KeepsakeState): KeepsakeState {
  if (state.phial?.status !== 'pending') return state;
  return Object.freeze({ ...state, phial: Object.freeze({ status: 'consumed' as const }) });
}

export function consumeFigurine(state: KeepsakeState): KeepsakeState {
  const { figurine, ...withoutFigurine } = state;
  if (figurine?.status !== 'pending') return state;
  if (figurine.origin === 'echo') return Object.freeze(withoutFigurine);
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
