import {
  resolveTraitAcquisitionOrdinalEffect,
  type Catalog,
  type TraitRarity,
} from '../../catalog-schema';
import type {
  EchoLastRunBoonAddress,
  SemanticAddress,
  TraitOfferAddress,
} from '../../authored-project/addresses';
import type {
  AuthoredTraitOffer,
  AuthoredTraitOfferTraits,
} from '../../authored-project/traits/state';
import type { SimulationState } from '../state/model';
import type {
  EchoLastRunBoonOutcome,
  ResolvedTraitOfferSource,
  TraitAssessment,
  TraitOfferCompositionAssessment,
  TraitOfferCompositionFinding,
  TraitOfferSourceContext,
} from './offer-domain';
import {
  assessTraitOfferComposition,
  limitedSwapUses,
  temporaryBoonRarityUses,
} from './offer-domain';
import { deriveBoonRarityLedger, type BoonRarityFacts } from './rarity';
import { optionIndex } from '../../authored-project/traits/state';
import { assessRansom } from './history/transitions';
import { foldTraitHistoryEvents } from './history/fold';
import { isPomUpgradeTarget } from './history/upgrades';
import {
  assessNaturalSelectionTargets,
  assessSelectedTargetedAcquisition,
  assessTraitOffer,
  traitOfferGenerationInput,
} from './authoring/assessment';
import {
  assessInitialOfferSupport,
  type InitialOfferSupport,
} from './authoring/initial-composition';
import { resolveTraitOfferOptionLevel, type TraitOfferOptionLevelResolution } from './offer-levels';
import type {
  TraitTargetedAcquisitionAssessment,
  TraitHistoryState,
  TraitOfferEvent,
  ChaosPairEvent,
  TraitLevelMutationEvent,
  TraitHistoryEvent,
  DirectTraitGrantEvent,
} from './history/model';
import type { RansomAssessment } from './history/transitions';

function boonRarityProviderForGiver(
  giver: Catalog['traitGivers']['values'][number] | undefined,
): 'olympian' | 'hermes' | undefined {
  if (giver === undefined || giver.rarityPolicy.kind === 'none') return undefined;
  if (giver.providerKind === 'hermes') return 'hermes';
  return giver.providerKind === 'olympian' || giver.shopAwareGodTrait ? 'olympian' : undefined;
}

/** Whether this giver's source screen is affected by Chaos Ordinary and Rejected. */
export function isChaosGodScreenGiver(catalog: Catalog, giverKey: string): boolean {
  return boonRarityProviderForGiver(catalog.traitGivers.byKey[giverKey]) !== undefined;
}

/** Resolves offer-generation overrides at one source-screen frontier.
 * Authored rows stay untouched: stale non-Common fresh rows are assessed as
 * invalid, while exact promoted replacement rows remain legal. */
export function offerGenerationAdjustedGiverSource(
  catalog: Catalog,
  state: SimulationState,
  giverKey: string,
  source: ResolvedTraitOfferSource,
): ResolvedTraitOfferSource {
  const giver = catalog.traitGivers.byKey[giverKey];
  const provider = boonRarityProviderForGiver(giver);
  if (provider === undefined) return source;
  const ordinary = hasActiveChaosSemanticTag(state.traitHistory, 'Ordinary');
  const replacementRollChance =
    limitedSwapUses(state) > 0
      ? 1
      : ordinary
        ? 0
        : (source.replacementRollChance ?? catalog.boonReplacementChance);
  // Native ForceCommon bypasses GetRarityChances entirely. Any facts captured
  // before this source decision therefore describe a different screen and must
  // not cross the forced-rarity frontier.
  const adjusted = {
    ...source,
    replacementRollChance,
    ...(ordinary ? { freshRarityOverride: 'Common' as const } : {}),
  };
  if (ordinary) delete adjusted.boonRarityFacts;
  return Object.freeze(adjusted);
}

export function offerGenerationAdjustedOfferSource(
  catalog: Catalog,
  state: SimulationState,
  offer: AuthoredTraitOffer,
  source: ResolvedTraitOfferSource,
): ResolvedTraitOfferSource {
  return offer.kind === 'traits'
    ? offerGenerationAdjustedGiverSource(catalog, state, offer.giverKey, source)
    : source;
}

/** Drops a previously prepared rescue flag so this resolution derives its own. */
function withoutFinalRescue(source: ResolvedTraitOfferSource): TraitOfferSourceContext {
  const { finalRarityRescueDisabled: _finalRarityRescueDisabled, ...rest } = source;
  void _finalRarityRescueDisabled;
  return rest;
}

/** One complete source-generation context for selected, candidate and draft
 * construction.  Denial only removes final rescue; it never reconstructs
 * history bans or duplicates rarity arithmetic at consumers. */
export function resolveTraitOfferSource(
  catalog: Catalog,
  state: SimulationState,
  giverKey: string,
  source: ResolvedTraitOfferSource,
): ResolvedTraitOfferSource {
  const adjusted = offerGenerationAdjustedGiverSource(catalog, state, giverKey, {
    ...withoutFinalRescue(source),
    resolvedProviderKey: giverKey,
  });
  const facts = boonRarityFactsForOffer(catalog, state, adjusted);
  const denial = catalog.fearVows.byKey.BanUnpickedBoonsShrineUpgrade;
  const finalRarityRescueDisabled =
    (state.arcanaFear.fear.effectiveRanks[denial?.key ?? ''] ?? 0) > 0;
  return Object.freeze({
    ...adjusted,
    ...(facts === undefined ? {} : { boonRarityFacts: facts }),
    ...(finalRarityRescueDisabled ? { finalRarityRescueDisabled: true } : {}),
  });
}

/** Shared Arcana and matured-Favor contributions; callers add only their source-legal modifiers. */
function arcanaAndFavorBoonRarityContributions(
  catalog: Catalog,
  state: SimulationState,
): readonly import('../../catalog-schema').BoonRarityContribution[] {
  const history = state.traitHistory;
  const barrenActive = hasActiveChaosSemanticTag(history, 'Barren');
  const arcana = state.arcanaFear.arcana.active.flatMap((active) => {
    const table = catalog.arcanaCards.byKey[active.key]?.boonRarityContributions;
    // Barren suppresses every currently declared rarity contribution, not a
    // hand-maintained card-name list. The Arcana state itself is untouched,
    // so the independently-derived ledger restores it on maturation.
    if (barrenActive && table !== undefined) return [];
    if (table === undefined) return [];
    const rarity = active.rarity;
    return rarity === 'Common' || rarity === 'Rare' || rarity === 'Epic' || rarity === 'Heroic'
      ? [table[rarity]]
      : [];
  });
  const favor = history.maturedChaosBlessings.flatMap((blessing) => {
    if (catalog.chaos.blessings.byKey[blessing.blessingKey]?.semanticTag !== 'Favor') return [];
    const rare = blessing.blessingValues.rareBonus;
    return typeof rare === 'number'
      ? [
          Object.freeze({
            additive: Object.freeze({ Rare: rare, Epic: 0.1, Duo: 0.1, Legendary: 0.1 }),
          }),
        ]
      : [];
  });
  return Object.freeze([...arcana, ...favor]);
}

function chaosPairRarityFacts(
  catalog: Catalog,
  state: SimulationState,
  source: TraitOfferSourceContext,
): BoonRarityFacts {
  return Object.freeze({
    providerBase: catalog.boonRarityBases.olympian,
    rollOrder: catalog.chaos.rarity.rollOrder,
    ...(source.boonRarityRoomOverride === undefined
      ? {}
      : { roomOverride: source.boonRarityRoomOverride }),
    itemOverride: catalog.chaos.rarity.itemOverride,
    contributions: arcanaAndFavorBoonRarityContributions(catalog, state),
  });
}

/** Exact selected Chaos-pair rarity domain. Fixed outcomes bypass the source roll. */
export function chaosPairRarities(
  catalog: Catalog,
  state: SimulationState,
  source: TraitOfferSourceContext,
  curse: import('../../catalog-schema').ChaosCurseDeclaration | undefined,
  blessing: import('../../catalog-schema').ChaosBlessingDeclaration | undefined,
): readonly TraitRarity[] {
  if (blessing?.fixedRarity === 'Legendary') return Object.freeze(['Legendary']);
  if (curse?.semanticTag === 'Barren') return Object.freeze(['Heroic']);
  if (curse === undefined || blessing === undefined) return Object.freeze([]);
  return deriveBoonRarityLedger(chaosPairRarityFacts(catalog, state, source), [
    'Common',
    'Rare',
    'Epic',
  ]).possibleFreshRarities;
}

/** Validates the selected blessing against the same exact Chaos source domain candidates expose. */
export function assessChaosPairRarity(
  catalog: Catalog,
  state: SimulationState,
  offer: Extract<AuthoredTraitOffer, { readonly kind: 'chaos' }>,
  source: TraitOfferSourceContext,
): TraitAssessment {
  const curse =
    catalog.chaos.curses.byKey[
      offer.curseOptions[optionIndex(offer.selectedOptionKey)]?.curseKey ?? ''
    ];
  const blessing = catalog.chaos.blessings.byKey[offer.blessingKey];
  const legal = chaosPairRarities(catalog, state, source, curse, blessing).includes(offer.rarity);
  return Object.freeze({
    legal,
    findings: legal
      ? Object.freeze([])
      : Object.freeze([
          Object.freeze({
            code: 'rarityRollUnavailable' as const,
            traitKey: offer.blessingKey,
            detail: offer.rarity,
          }),
        ]),
  });
}

/** One branch-aware adapter from existing offer facts to the numeric ledger input. */
export function boonRarityFactsForOffer(
  catalog: Catalog,
  state: SimulationState,
  source: ResolvedTraitOfferSource,
): BoonRarityFacts | undefined {
  if (source.freshRarityOverride !== undefined) return undefined;
  if (source.boonRarityFacts !== undefined) return source.boonRarityFacts;
  const giver =
    source.resolvedProviderKey === undefined
      ? undefined
      : catalog.traitGivers.byKey[source.resolvedProviderKey];
  const provider = boonRarityProviderForGiver(giver);
  if (giver === undefined || provider === undefined) return undefined;
  const history = state.traitHistory;
  const arcanaAndFavor = arcanaAndFavorBoonRarityContributions(catalog, state);
  const traits =
    history.properUpbringingActive !== true
      ? []
      : Object.values(history.equippedTraits).flatMap((equipped) => {
          const contribution =
            catalog.traits.byKey[equipped.traitKey]?.rarityFloorEffect?.boonRarityContribution;
          return contribution === undefined ? [] : [contribution];
        });
  return Object.freeze({
    providerBase: catalog.boonRarityBases[provider],
    rollOrder: giver.boonRarityRollOrder ?? catalog.boonRarityRollOrder,
    ...(source.boonRarityRoomOverride === undefined
      ? {}
      : { roomOverride: source.boonRarityRoomOverride }),
    ...(source.boonRarityItemOverride === undefined
      ? {}
      : { itemOverride: source.boonRarityItemOverride }),
    contributions: Object.freeze([
      ...arcanaAndFavor,
      ...traits,
      ...Array.from({ length: temporaryBoonRarityUses(state, source) }, () =>
        Object.freeze({
          additive: Object.freeze({ Rare: 1, Epic: 0.25, Duo: 0.1, Legendary: 0.1 }),
        }),
      ),
    ]),
  });
}

/** Exact derived fact; active Chaos state is history-owned and never persisted. */
export function hasActiveChaosSemanticTag(
  history: TraitHistoryState,
  tag: import('../../catalog-schema').ChaosSemanticTag,
): boolean {
  return history.activeChaosCurses.some((curse) => curse.semanticTag === tag);
}

export interface ReachedTraitOfferEvaluation {
  readonly address: SemanticAddress;
  readonly acquisitionRole: string;
  /** Exact pre-offer simulation snapshot this evaluation was assessed against. */
  readonly state: SimulationState;
  readonly offer: AuthoredTraitOffer;
  /** Row rarities before Calling Card/provider-keepsake rarification. */
  readonly baseRarities: readonly (TraitRarity | undefined)[];
  readonly source: ResolvedTraitOfferSource;
  readonly assessments: readonly TraitAssessment[];
  /** Frozen option-level outcomes used by candidate projection and settlement. */
  readonly levelResolutions: readonly TraitOfferOptionLevelResolution[];
  /** Native staged support for ordinary Olympian/Hermes screens. */
  readonly generation?: InitialOfferSupport;
  /** Non-generation screen rules, including Rejected on ordinary god offers. */
  readonly composition: TraitOfferCompositionAssessment;
  readonly targetedAcquisition: TraitTargetedAcquisitionAssessment;
  /** Spell tree as settled at this offer, before later biome mutations. */
  readonly settledHexTree?: {
    readonly spellTraitKey: string;
    readonly layoutKey: string;
    readonly rareTalentKeys: readonly string[];
    readonly epicTalentKeys: readonly string[];
    readonly godSent?: {
      readonly olympianTalentKey: string;
      readonly lineageTalentKey: string;
    };
  };
  readonly reached: true;
  readonly chronologicalIndex: number;
}

/** The branch-local evidence published for one reached selected offer. */
export interface TraitOfferBranchAssessment {
  readonly assessments: readonly TraitAssessment[];
  readonly generation?: InitialOfferSupport;
  readonly composition: TraitOfferCompositionAssessment;
  readonly targetedAcquisition: TraitTargetedAcquisitionAssessment;
  readonly persephoneLevelBonusMaximums: readonly (number | undefined)[];
  readonly effectiveLevels: readonly (number | undefined)[];
  readonly settledHexTree?: ReachedTraitOfferEvaluation['settledHexTree'];
}

/**
 * The exact semantic inputs one trait-offer contact consumes. Deduplication
 * compares these rather than serializing the whole snapshot: unrelated
 * chronology, bags and pending acquisition work must not multiply equivalent
 * contexts, and callable capabilities are never faithfully comparable.
 */
export function traitOfferContextIdentity(
  context: Pick<TraitOfferCandidateContext, 'state' | 'source'>,
): readonly unknown[] {
  const state = context.state;
  return Object.freeze([
    context.source,
    state.traitHistory,
    state.arcanaFear,
    state.keepsakes,
    state.equipment,
    state.rewardHistory.useRecord.SpellDrop ?? 0,
    // Normalized so every identity member survives a JSON round trip; an
    // absent recreation and null serialize to the same key either way.
    state.rewardHistory.lastRewardRecreation ?? null,
    state.stygianWell.yarnUses,
    state.stygianWell.hymnUses,
    state.reached.routePosition.routeKey,
    state.reached.routePosition.ordinal,
  ]);
}

/** The same inputs for one reached selected-offer assessment. */
export function traitOfferAssessmentIdentity(
  evaluation: Pick<ReachedTraitOfferEvaluation, 'state' | 'source' | 'offer'>,
): readonly unknown[] {
  return Object.freeze([evaluation.offer, ...traitOfferContextIdentity(evaluation)]);
}

export function traitOfferGenerationLegal(
  evaluation: Pick<ReachedTraitOfferEvaluation, 'generation' | 'composition' | 'assessments'>,
): boolean {
  return (
    (evaluation.generation?.legal ?? true) &&
    evaluation.composition.legal &&
    evaluation.assessments.every((assessment) => assessment.legal)
  );
}

/** Execution input retained only after one authored offer is selected. */
export interface SelectedTraitOfferBranchAssessment extends TraitOfferBranchAssessment {
  readonly baseRarities: readonly (TraitRarity | undefined)[];
  /** Native-order random Arcana draw, resolved from the exact pre-offer state. */
  readonly orderedCirceActivationKeys?: readonly string[];
  /** Echo's exact nested menu after chronology-owned rarity floors are applied. */
  readonly effectiveEchoLastRunBoon?: {
    readonly options: readonly (import('../../authored-project/traits/state').AuthoredEchoLastRunBoonOption & {
      /** Declaration-owned source used by native Echo loot-history attribution. */
      readonly lootHistorySource?: string;
    })[];
    readonly selectedOptionKey: import('../../authored-project/traits/state').TraitOptionKey;
  };
}

/**
 * Data-only selected-offer evidence.  Pre-offer histories and resolved
 * contexts stay behind the exact candidate artifact instead of crossing the
 * reward simulation boundary.
 */
export interface SelectedTraitOfferAssessment {
  readonly address: TraitOfferAddress;
  readonly acquisitionRole: string;
  readonly offer: AuthoredTraitOffer;
  readonly branches: readonly SelectedTraitOfferBranchAssessment[];
  readonly reached: true;
  readonly chronologicalIndex: number;
}

/** Inputs retained by the opaque exact-address candidate capability. */
export interface TraitOfferCandidateContext {
  /** One exact pre-effect snapshot; candidates never borrow facts from another branch. */
  readonly state: SimulationState;
  readonly source: ResolvedTraitOfferSource;
}

export interface TraitContextUnavailable {
  readonly address: SemanticAddress;
  readonly acquisitionRole: string;
  readonly reached: false;
  readonly reason: 'lifecycleNotReached' | 'missingParentAcquisition';
}

function evaluateReachedTraitOfferWithAssessments(
  catalog: Catalog,
  address: SemanticAddress,
  acquisitionRole: string,
  offer: AuthoredTraitOffer,
  state: SimulationState,
  context: ResolvedTraitOfferSource,
  chronologicalIndex: number,
  directAcquisition = false,
  /** Calling Card changes a rolled row after base-offer legality is established. */
  rarificationBaseOffer?: AuthoredTraitOffer,
  assessments?: readonly TraitAssessment[],
  frozenAcquisition = false,
  frozenLevelResolutions?: readonly TraitOfferOptionLevelResolution[],
): ReachedTraitOfferEvaluation {
  const before = state.traitHistory;
  const baseRarities = Object.freeze(
    (rarificationBaseOffer?.kind === 'traits'
      ? rarificationBaseOffer
      : offer.kind === 'traits'
        ? offer
        : undefined
    )?.options.map((option) => option.rarity) ?? [],
  );
  const ordinaryGiver = (() => {
    if (offer.kind === 'chaos') return false;
    const giver = catalog.traitGivers.byKey[offer.giverKey];
    return giver?.providerKind === 'olympian' || giver?.providerKind === 'hermes';
  })();
  const effectiveSource = ordinaryGiver
    ? resolveTraitOfferSource(catalog, state, offer.giverKey, context)
    : offerGenerationAdjustedOfferSource(catalog, state, offer, context);
  // Exact one-result sources (for example, a keepsake equip) are direct
  // acquisitions, not a sparse ordinary offer. They retain the normal
  // trait-level assessment and history event path without inheriting the
  // three-choice offer-composition contract.
  const legalityOffer = rarificationBaseOffer ?? offer;
  const ordinary =
    legalityOffer.kind !== 'chaos' &&
    (() => {
      const giver = catalog.traitGivers.byKey[legalityOffer.giverKey];
      return giver?.providerKind === 'olympian' || giver?.providerKind === 'hermes';
    })();
  const generation =
    directAcquisition || frozenAcquisition || !ordinary
      ? undefined
      : assessInitialOfferSupport({
          ...traitOfferGenerationInput(catalog, legalityOffer.giverKey, state, effectiveSource),
          offer: legalityOffer,
        });
  const baseComposition = directAcquisition
    ? Object.freeze({ applies: false, legal: true, findings: Object.freeze([]) })
    : assessTraitOfferComposition(catalog, legalityOffer);
  const composition = frozenAcquisition
    ? Object.freeze({ applies: false, legal: true, findings: Object.freeze([]) })
    : (() => {
        if (offer.kind === 'chaos') {
          const requirementUnavailable = (
            requirement: import('../../catalog-schema').ChaosOfferRequirement,
          ) => {
            switch (requirement.kind) {
              case 'matureChaosBlessing':
                return before.maturedChaosBlessings.length === 0;
              case 'elementMinimum':
                return before.elementCounts[requirement.element] < requirement.minimum;
              case 'notKeepsake':
                return state.keepsakes.currentKey === requirement.keepsakeKey;
              case 'notAspect':
                return state.equipment.aspectKey === requirement.aspectKey;
              case 'routeKey':
                return state.reached.routePosition.routeKey !== requirement.routeKey;
              case 'routeKeyNot':
                return state.reached.routePosition.routeKey === requirement.routeKey;
            }
          };
          // Every authored curse is part of the generated Chaos screen. A
          // context-invalid peer therefore invalidates the whole frozen offer;
          // otherwise Denial could ban an option that could never have been
          // selected at this frontier.
          const curseUnavailable = offer.curseOptions.some((option) => {
            const curse = catalog.chaos.curses.byKey[option.curseKey];
            return (
              curse === undefined ||
              before.bannedTraitKeys.includes(option.curseKey) ||
              (curse.offerRequirements ?? []).some(requirementUnavailable)
            );
          });
          const blessing = catalog.chaos.blessings.byKey[offer.blessingKey];
          const unavailable =
            curseUnavailable ||
            blessing === undefined ||
            (blessing.offerRequirements ?? []).some(requirementUnavailable);
          return unavailable
            ? Object.freeze({
                applies: true,
                legal: false,
                findings: Object.freeze([Object.freeze({ code: 'chaosPairUnavailable' as const })]),
              })
            : baseComposition;
        }
        if (offer.kind !== 'traits') return baseComposition;
        if (!isChaosGodScreenGiver(catalog, offer.giverKey)) return baseComposition;
        const chaosFindings: TraitOfferCompositionFinding[] = [];
        if (hasActiveChaosSemanticTag(before, 'Rejected')) {
          const blocked = offer.rejectedOptionKey;
          if (blocked === undefined)
            chaosFindings.push(Object.freeze({ code: 'chaosRejectedBlockMissing' }));
          else if (
            blocked === offer.selectedOptionKey ||
            offer.options[optionIndex(blocked)] === undefined
          )
            chaosFindings.push(
              Object.freeze({ code: 'chaosRejectedBlockUnavailable', optionKey: blocked }),
            );
        } else if (offer.rejectedOptionKey !== undefined) {
          chaosFindings.push(
            Object.freeze({
              code: 'chaosRejectedBlockUnavailable',
              optionKey: offer.rejectedOptionKey,
            }),
          );
        }
        return chaosFindings.length === 0
          ? baseComposition
          : Object.freeze({
              ...baseComposition,
              legal: false,
              findings: Object.freeze([...baseComposition.findings, ...chaosFindings]),
            });
      })();
  const rawAssessments = frozenAcquisition
    ? Object.freeze([])
    : (assessments ??
      (legalityOffer.kind === 'chaos'
        ? Object.freeze([assessChaosPairRarity(catalog, state, legalityOffer, effectiveSource)])
        : assessTraitOffer(catalog, legalityOffer, state, effectiveSource)));
  const levelResolutions =
    frozenLevelResolutions ??
    (offer.kind !== 'traits'
      ? Object.freeze([])
      : Object.freeze(
          offer.options.map((option, index) =>
            resolveTraitOfferOptionLevel({
              catalog,
              state,
              source: effectiveSource,
              option,
              ...(rawAssessments[index] === undefined ? {} : { assessment: rawAssessments[index] }),
            }),
          ),
        ));
  // A frozen source row still acquires its targeted effect at the current
  // frontier, after the primary selection has settled. Its resolver sees the
  // selected effective source (including Calling Card), not the base roll.
  const targetedAcquisition = assessSelectedTargetedAcquisition(catalog, offer, state);
  const resolvedAssessments = frozenAcquisition
    ? Object.freeze([])
    : Object.freeze(
        rawAssessments.map((assessment, index) => {
          const resolution = levelResolutions[index];
          return resolution === undefined || resolution.findings.length === 0
            ? assessment
            : Object.freeze({
                ...assessment,
                legal: false,
                findings: Object.freeze([...assessment.findings, ...resolution.findings]),
              });
        }),
      );
  return Object.freeze({
    address,
    acquisitionRole,
    state,
    offer,
    baseRarities,
    source: effectiveSource,
    assessments: resolvedAssessments,
    levelResolutions,
    ...(generation === undefined ? {} : { generation }),
    composition,
    targetedAcquisition,
    reached: true,
    chronologicalIndex,
  });
}

export function evaluateReachedTraitOffer(
  catalog: Catalog,
  address: SemanticAddress,
  acquisitionRole: string,
  offer: AuthoredTraitOffer,
  state: SimulationState,
  source: ResolvedTraitOfferSource,
  chronologicalIndex: number,
  directAcquisition = false,
  /** Calling Card changes a rolled row after base-offer legality is established. */
  rarificationBaseOffer?: AuthoredTraitOffer,
  frozenAcquisition = false,
  frozenLevelResolutions?: readonly TraitOfferOptionLevelResolution[],
): ReachedTraitOfferEvaluation {
  return evaluateReachedTraitOfferWithAssessments(
    catalog,
    address,
    acquisitionRole,
    offer,
    state,
    source,
    chronologicalIndex,
    directAcquisition,
    rarificationBaseOffer,
    undefined,
    frozenAcquisition,
    frozenLevelResolutions,
  );
}

/** Settle one engine-derived BBB replay through the canonical trait-offer fold. */
export function evaluateReachedEchoLastRunBoonOffer(
  catalog: Catalog,
  address: EchoLastRunBoonAddress,
  offer: AuthoredTraitOfferTraits,
  outcome: EchoLastRunBoonOutcome,
  state: SimulationState,
  source: ResolvedTraitOfferSource,
  chronologicalIndex: number,
): ReachedTraitOfferEvaluation {
  const option = offer.options[0];
  if (
    offer.options.length !== 1 ||
    offer.selectedOptionKey !== 'option1' ||
    option === undefined ||
    offer.giverKey !== outcome.option.giverKey ||
    option.traitKey !== outcome.option.traitKey ||
    option.rarity !== outcome.effectiveRarity
  )
    throw new Error('BBB settlement requires its exact engine-derived one-option outcome');
  return evaluateReachedTraitOfferWithAssessments(
    catalog,
    address,
    'echoLastRunSelection',
    offer,
    state,
    source,
    chronologicalIndex,
    true,
    undefined,
    Object.freeze([outcome.assessment]),
  );
}

function denialBannedTraitKeys(
  catalog: Catalog,
  evaluation: ReachedTraitOfferEvaluation,
): readonly string[] | undefined {
  if (evaluation.offer.kind !== 'traits') return undefined;
  const offer = evaluation.offer;
  const denial = catalog.fearVows.byKey.BanUnpickedBoonsShrineUpgrade;
  const effective = evaluation.state.arcanaFear.fear.effectiveRanks[denial?.key ?? ''] ?? 0;
  const giver = catalog.traitGivers.byKey[evaluation.offer.giverKey];
  if (
    denial?.effect?.kind !== 'banUnselectedTraits' ||
    effective <= 0 ||
    !giver?.denialParticipates
  )
    return undefined;
  return Object.freeze(
    offer.options
      .filter((_, index) => index !== optionIndex(offer.selectedOptionKey))
      .slice(0, denial.effect.count)
      .map((option) => option.traitKey),
  );
}

function denialBannedChaosCurseKeys(
  catalog: Catalog,
  evaluation: ReachedTraitOfferEvaluation,
): readonly string[] | undefined {
  if (evaluation.offer.kind !== 'chaos') return undefined;
  const denial = catalog.fearVows.byKey.BanUnpickedBoonsShrineUpgrade;
  const effective = evaluation.state.arcanaFear.fear.effectiveRanks[denial?.key ?? ''] ?? 0;
  if (denial?.effect?.kind !== 'banUnselectedTraits' || effective <= 0) return undefined;
  const selected =
    evaluation.offer.curseOptions[optionIndex(evaluation.offer.selectedOptionKey)]?.curseKey;
  if (selected === undefined) return undefined;
  const distinct: string[] = [];
  for (const [index, option] of evaluation.offer.curseOptions.entries()) {
    if (index === optionIndex(evaluation.offer.selectedOptionKey) || option.curseKey === selected)
      continue;
    if (!distinct.includes(option.curseKey)) distinct.push(option.curseKey);
  }
  return Object.freeze(distinct.slice(0, denial.effect.count));
}

export function recordReachedTraitOffer(
  catalog: Catalog,
  evaluation: ReachedTraitOfferEvaluation,
  sequence: number,
  acquisitionPoint: string,
  acquisitionIdentity?: string,
  echoRepeatedKeepsakeKey?: string,
  eventKind: 'traitOffer' | 'concaveStoneSecondary' = 'traitOffer',
): {
  readonly history: TraitHistoryState;
  readonly event?: TraitOfferEvent | import('./history/model').ConcaveStoneSecondaryEvent;
  readonly ransomAssessment?: RansomAssessment;
} {
  if (evaluation.offer.kind === 'chaos') {
    if (!traitOfferGenerationLegal(evaluation))
      return Object.freeze({ history: evaluation.state.traitHistory });
    const identity = acquisitionIdentity ?? `chaos:${sequence}`;
    const bannedCurseKeys = denialBannedChaosCurseKeys(catalog, evaluation);
    const event: ChaosPairEvent = Object.freeze({
      kind: 'chaosPair',
      owner: evaluation.address,
      acquisitionRole: evaluation.acquisitionRole,
      sequence,
      acquisitionPoint,
      acquisitionIdentity: identity,
      offer: evaluation.offer,
      ...(bannedCurseKeys === undefined ? {} : { bannedCurseKeys }),
    });
    return Object.freeze({
      history: foldTraitHistoryEvents(catalog, [...evaluation.state.traitHistory.events, event]),
    });
  }
  const valid = traitOfferGenerationLegal(evaluation);
  if (!valid) return Object.freeze({ history: evaluation.state.traitHistory });
  if (evaluation.offer.kind !== 'traits')
    return Object.freeze({ history: evaluation.state.traitHistory });
  const selectedOption = evaluation.offer.options[optionIndex(evaluation.offer.selectedOptionKey)];
  if (selectedOption === undefined)
    return Object.freeze({ history: evaluation.state.traitHistory });
  const selectedTraitKey = selectedOption.traitKey;
  // Every reached offer is assessed and retained in the evaluation trace.
  // A selected pickup-producing trait is an ordinary equipped trait; its
  // generated pickups are a later acquisition-site effect.
  const selectedDisposition = catalog.traits.byKey[selectedTraitKey]?.selectedDisposition;
  const requiresAcquisitionOrdinal =
    selectedDisposition?.kind === 'upgradeOccupiedBoonSlot' ||
    (selectedDisposition?.kind === 'producePickups' && selectedDisposition.clock !== undefined);
  const acquisitionOrdinal = evaluation.state.reached.routePosition.ordinal;
  const ordinalEffect =
    requiresAcquisitionOrdinal && selectedDisposition !== undefined
      ? resolveTraitAcquisitionOrdinalEffect(selectedDisposition, acquisitionOrdinal)
      : undefined;
  if (
    selectedDisposition?.kind !== 'equip' &&
    selectedDisposition?.kind !== 'upgradeOccupiedBoonSlot' &&
    selectedDisposition?.kind !== 'directTraitSets' &&
    selectedDisposition?.kind !== 'circe' &&
    selectedDisposition?.kind !== 'echo' &&
    selectedDisposition?.kind !== 'advanceCurrentKeepsake' &&
    selectedDisposition?.kind !== 'worldShopRestock' &&
    selectedDisposition?.kind !== 'naturalSelection' &&
    selectedDisposition?.kind !== 'ransom' &&
    selectedDisposition?.kind !== 'steadyGrowth' &&
    selectedDisposition?.kind !== 'producePickups' &&
    selectedDisposition?.kind !== 'seaStar'
  ) {
    return Object.freeze({ history: evaluation.state.traitHistory });
  }
  const selectedAssessment =
    evaluation.assessments[optionIndex(evaluation.offer.selectedOptionKey)];
  const selectedLevel =
    evaluation.levelResolutions[optionIndex(evaluation.offer.selectedOptionKey)]?.effectiveLevel;
  // Stone's frozen pickup is not another screen, so it must not settle a
  // second post-screen Denial partition.
  const bannedTraitKeys =
    eventKind === 'concaveStoneSecondary' ? undefined : denialBannedTraitKeys(catalog, evaluation);
  const event = Object.freeze({
    kind: eventKind,
    owner: evaluation.address,
    acquisitionRole: evaluation.acquisitionRole,
    sequence,
    giverKey: evaluation.offer.giverKey,
    options: evaluation.offer.options,
    selectedOptionKey: evaluation.offer.selectedOptionKey,
    acquisitionPoint,
    ...(eventKind === 'traitOffer' && acquisitionIdentity !== undefined
      ? { acquisitionIdentity }
      : {}),
    ...(eventKind === 'traitOffer' && echoRepeatedKeepsakeKey !== undefined
      ? { echoRepeatedKeepsakeKey }
      : {}),
    ...(bannedTraitKeys === undefined ? {} : { bannedTraitKeys }),
    ...(selectedAssessment?.replacementTransition === undefined
      ? {}
      : { replacementTransition: selectedAssessment.replacementTransition }),
    ...(evaluation.targetedAcquisition.transition === undefined
      ? {}
      : { targetedAcquisitionTransition: evaluation.targetedAcquisition.transition }),
    ...(selectedLevel === undefined ? {} : { selectedEffectiveLevel: selectedLevel }),
    ...(ordinalEffect?.clockInterval === undefined
      ? {}
      : { pickupProducerInterval: ordinalEffect.clockInterval }),
  }) as TraitOfferEvent | import('./history/model').ConcaveStoneSecondaryEvent;
  const transition = evaluation.targetedAcquisition.transition;
  const mutation: TraitLevelMutationEvent | undefined =
    transition?.kind === 'promoteGodTraitToHeroic' && transition.levelChange !== undefined
      ? Object.freeze({
          kind: 'levelMutation',
          owner: evaluation.address,
          acquisitionRole: evaluation.acquisitionRole,
          sequence,
          acquisitionPoint,
          sourceTraitKey: transition.sourceTraitKey,
          targetTraitKey: transition.targetTraitKey,
          oldLevel: transition.levelChange.oldLevel,
          newLevel: transition.levelChange.newLevel,
        })
      : undefined;
  const immediate: TraitHistoryEvent[] = [event, ...(mutation === undefined ? [] : [mutation])];
  if (selectedDisposition?.kind === 'upgradeOccupiedBoonSlot') {
    const target = evaluation.state.traitHistory.equippedSlots[selectedDisposition.slot];
    if (!isPomUpgradeTarget(catalog, target))
      return Object.freeze({ history: evaluation.state.traitHistory, event });
    immediate.push(
      Object.freeze({
        kind: 'levelMutation',
        owner: evaluation.address,
        acquisitionRole: evaluation.acquisitionRole,
        sequence,
        acquisitionPoint,
        sourceTraitKey: selectedTraitKey,
        targetTraitKey: target.traitKey,
        oldLevel: target.level,
        newLevel: target.level + ordinalEffect!.levelCount!,
      }),
    );
  }
  if (selectedDisposition?.kind === 'naturalSelection') {
    const targets = selectedOption.naturalSelectionTargets;
    const assessment = assessNaturalSelectionTargets(
      catalog,
      evaluation.state.traitHistory,
      selectedDisposition.levelCount,
      selectedDisposition.slots,
      targets,
    );
    if (!assessment.legal || !assessment.complete)
      return Object.freeze({ history: evaluation.state.traitHistory, event });
    for (const { targetTraitKey, oldLevel, newLevel } of assessment.steps) {
      immediate.push(
        Object.freeze({
          kind: 'levelMutation',
          owner: evaluation.address,
          acquisitionRole: evaluation.acquisitionRole,
          sequence,
          acquisitionPoint,
          sourceTraitKey: selectedTraitKey,
          targetTraitKey,
          oldLevel,
          newLevel,
        }),
      );
    }
  }
  const ransomAssessment =
    selectedDisposition?.kind !== 'ransom'
      ? undefined
      : assessRansom(
          catalog,
          foldTraitHistoryEvents(catalog, [...evaluation.state.traitHistory.events, ...immediate]),
          selectedTraitKey,
          evaluation.address,
          evaluation.acquisitionRole,
          sequence,
          acquisitionPoint,
        );
  if (ransomAssessment !== undefined) {
    immediate.push(...ransomAssessment.events);
  }
  const history = foldTraitHistoryEvents(catalog, [
    ...evaluation.state.traitHistory.events,
    ...immediate,
  ]);
  return Object.freeze({
    history,
    event,
    ...(ransomAssessment === undefined ? {} : { ransomAssessment }),
  });
}

/** Appends fixed direct grants without ordinary offer, rarity, Calling Card,
 * Denial, provider-history, or prerequisite processing. */
export function recordDirectTraitGrants(
  catalog: Catalog,
  before: TraitHistoryState,
  sequence: number,
  acquisitionPoint: string,
  sourceTraitKey: string,
  grants: readonly { readonly owner: SemanticAddress; readonly traitKey: string }[],
): TraitHistoryState {
  const events = grants.map(({ owner, traitKey }): DirectTraitGrantEvent => {
    const providers = catalog.traitGivers.values.filter((giver) =>
      giver.traitKeys.includes(traitKey),
    );
    if (providers.length !== 1)
      throw new Error(`direct trait ${traitKey} must resolve to exactly one provider`);
    return Object.freeze({
      kind: 'directTraitGrant',
      owner,
      acquisitionRole: 'directTraitGrant',
      sequence,
      acquisitionPoint,
      sourceTraitKey,
      traitKey,
      giverKey: providers[0]!.key,
    });
  });
  return foldTraitHistoryEvents(catalog, [...before.events, ...events]);
}

/** Folds the one catalog-linked Aspect starting trait before any room checkpoint. */
export function recordAspectStartingTrait(
  catalog: Catalog,
  before: TraitHistoryState,
  owner: SemanticAddress,
  loadout: { readonly aspectKey: string },
): TraitHistoryState {
  const aspect = catalog.aspects.byKey[loadout.aspectKey];
  const starting = aspect?.startingTrait;
  if (starting === undefined) return before;
  return foldTraitHistoryEvents(catalog, [
    ...before.events,
    Object.freeze({
      kind: 'directTraitGrant' as const,
      owner,
      acquisitionRole: 'directTraitGrant' as const,
      sequence: 0,
      acquisitionPoint: 'routeStart',
      sourceTraitKey: aspect!.key,
      traitKey: starting.traitKey,
      giverKey: starting.giverKey,
    }),
  ]);
}

/** Whether a concrete SpellDrop is routed to the Aspect-owned talent frontier. */
export function isAspectSpellDropDormant(catalog: Catalog, aspectKey: string | undefined): boolean {
  return (
    aspectKey !== undefined &&
    catalog.aspects.byKey[aspectKey]?.startingTrait?.giverKey === 'SpellDrop'
  );
}

/** Appends one fixed rarityless trait installed by a concrete non-offer acquisition. */
export function recordFixedAcquisitionTraitGrant(
  catalog: Catalog,
  before: TraitHistoryState,
  owner: SemanticAddress,
  sequence: number,
  acquisitionPoint: string,
  traitKey: string,
): TraitHistoryState {
  const declaration = catalog.traits.byKey[traitKey];
  if (declaration?.rarityDomain.kind !== 'none')
    throw new Error(`fixed acquisition trait ${traitKey} must be declared rarityless`);
  return foldTraitHistoryEvents(catalog, [
    ...before.events,
    Object.freeze({
      kind: 'directTraitGrant' as const,
      owner,
      acquisitionRole: 'directTraitGrant' as const,
      sequence,
      acquisitionPoint,
      sourceTraitKey: traitKey,
      traitKey,
    }),
  ]);
}

/** Exact ownership-only result domain for one source-declared direct pair. */
