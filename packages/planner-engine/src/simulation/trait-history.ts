import type { Catalog, TraitElement, TraitRarity } from '../catalog-schema';
import type { EchoKeepsakeReplayAddress } from '../authored-project/addresses';
import type { SemanticAddress } from '../authored-project/addresses';
import type {
  AuthoredTraitOfferTraits,
  AuthoredChaosTraitOffer,
  EquippedTrait,
  TraitOptionKey,
} from '../authored-project/traits';
import type { RewardHistoryState } from '../reward-kernel/model';
export type { TraitFindingCode } from './model';
import { optionIndex } from '../authored-project/traits';

export interface TraitOfferEvent {
  readonly kind: 'traitOffer';
  readonly owner: SemanticAddress;
  readonly acquisitionRole: string;
  readonly sequence: number;
  readonly giverKey: string;
  readonly options: AuthoredTraitOfferTraits['options'];
  readonly selectedOptionKey: TraitOptionKey;
  readonly acquisitionPoint: string;
  readonly acquisitionIdentity?: string;
  readonly echoRepeatedKeepsakeKey?: string;
  /** Exact unselected materialized keys banned by an effective Vow of Denial. */
  readonly bannedTraitKeys?: readonly string[];
  /** Derived from the pre-offer state; never persisted in authored state. */
  readonly replacementTransition?: TraitReplacementTransition;
  /** Exact declaration-owned acquisition mutation derived from pre-offer state. */
  readonly targetedAcquisitionTransition?: TraitTargetedAcquisitionTransition;
  /** Derived selected-row level from the frozen offer frontier. */
  readonly selectedEffectiveLevel?: number;
}

/** A frozen Concave Stone pickup, distinct from the original generated offer. */
export interface ConcaveStoneSecondaryEvent {
  readonly kind: 'concaveStoneSecondary';
  readonly owner: SemanticAddress;
  readonly acquisitionRole: 'concaveStoneSecondary';
  readonly sequence: number;
  readonly giverKey: string;
  readonly options: AuthoredTraitOfferTraits['options'];
  readonly selectedOptionKey: TraitOptionKey;
  readonly acquisitionPoint: string;
  readonly acquisitionIdentity?: string;
  readonly echoRepeatedKeepsakeKey?: string;
  readonly bannedTraitKeys?: readonly string[];
  readonly replacementTransition?: TraitReplacementTransition;
  readonly targetedAcquisitionTransition?: TraitTargetedAcquisitionTransition;
  /** Derived selected-row level from the frozen offer frontier. */
  readonly selectedEffectiveLevel?: number;
}

/** A closed derived mutation of an already-equipped Pom-eligible trait. */
export interface TraitLevelMutationEvent {
  readonly kind: 'levelMutation';
  readonly owner: SemanticAddress;
  readonly acquisitionRole: string;
  readonly sequence: number;
  readonly acquisitionPoint: string;
  readonly sourceTraitKey?: string;
  readonly targetTraitKey: string;
  readonly oldLevel: number;
  readonly newLevel: number;
  readonly giverKey?: never;
  readonly options?: never;
  readonly selectedOptionKey?: never;
  readonly replacementTransition?: never;
  readonly targetedAcquisitionTransition?: never;
}
export interface SteadyGrowthProgressEvent {
  readonly kind: 'steadyGrowthProgress';
  readonly owner: SemanticAddress;
  readonly acquisitionRole: 'steadyGrowth';
  readonly sequence: number;
  readonly acquisitionPoint: 'encounterEndEffectsApplied';
  readonly traitKey: string;
  readonly acquisitionIdentity: string;
  readonly oldProgress: number;
  readonly newProgress: number;
  readonly requiredInterval: number;
}
/** One automatic Steady Growth promotion at its owning end-effects checkpoint. */
interface TraitRarityMutationEventBase {
  readonly kind: 'rarityMutation';
  readonly owner: SemanticAddress;
  readonly sequence: number;
  readonly targetTraitKey: string;
  readonly oldRarity: TraitRarity;
  readonly newRarity: TraitRarity;
}

export type TraitRarityMutationEvent =
  | (TraitRarityMutationEventBase & {
      readonly acquisitionRole: 'steadyGrowth';
      readonly acquisitionPoint: 'encounterEndEffectsApplied';
      readonly sourceTraitKey: string;
      readonly resetSteadyGrowthProgress?: true;
    })
  | (TraitRarityMutationEventBase & {
      readonly acquisitionRole: 'fountainRarity';
      readonly acquisitionPoint: 'fountainUsed';
      readonly sourceTraitKey?: never;
      readonly resetSteadyGrowthProgress?: never;
    });

/** Concrete non-trait acquisition contribution, retained in the same ordered
 * trait facts ledger so later offer requirements see it. */
export interface TraitElementContributionEvent {
  readonly kind: 'elementContribution';
  readonly owner: SemanticAddress;
  readonly acquisitionRole: string;
  readonly sequence: number;
  readonly acquisitionPoint: string;
  readonly contributions: Readonly<Partial<Record<TraitElement, number>>>;
}

/** One fixed rarityless trait installed directly by another acquired trait. */
export interface DirectTraitGrantEvent {
  readonly kind: 'directTraitGrant';
  readonly owner: SemanticAddress;
  readonly acquisitionRole: 'directTraitGrant';
  readonly sequence: number;
  readonly acquisitionPoint: string;
  readonly sourceTraitKey: string;
  readonly traitKey: string;
  /** Absent only for a fixed non-offer acquisition such as Infernal Contract. */
  readonly giverKey?: string;
}
/** A closed lifecycle removal (currently Jeweled Pom's Fated cleanup). */
export interface TraitRemovalEvent {
  readonly kind: 'traitRemoval';
  readonly owner: SemanticAddress;
  readonly acquisitionRole: string;
  readonly sequence: number;
  readonly acquisitionPoint: string;
  readonly traitKey: string;
  readonly acquisitionIdentity?: string;
  /** Existing lifecycle cleanup is identity-owned; Ransom removes current key membership. */
  readonly match: 'acquisitionIdentity' | 'currentTraitKey';
}

export interface ChaosCurseInstance {
  readonly acquisitionIdentity: string;
  readonly owner: SemanticAddress;
  readonly curseKey: string;
  readonly duration: number;
  readonly remaining: number;
  readonly clock: import('../catalog-schema').ChaosClockKind;
  readonly semanticTag?: import('../catalog-schema').ChaosSemanticTag;
  readonly curseValues: Readonly<Record<string, number>>;
  readonly blessingKey: string;
  readonly rarity: AuthoredChaosTraitOffer['rarity'];
  readonly blessingValues: Readonly<Record<string, number>>;
}

export interface ChaosBlessingInstance {
  readonly acquisitionIdentity: string;
  readonly blessingKey: string;
  readonly rarity: AuthoredChaosTraitOffer['rarity'];
  readonly blessingValues: Readonly<Record<string, number>>;
}

export interface ChaosPairEvent {
  readonly kind: 'chaosPair';
  readonly owner: SemanticAddress;
  readonly acquisitionRole: string;
  readonly sequence: number;
  readonly acquisitionPoint: string;
  readonly acquisitionIdentity: string;
  readonly offer: AuthoredChaosTraitOffer;
}

/** A direct, already-matured Chaos blessing (Transcendent Embryo). */
export interface DirectChaosBlessingEvent {
  readonly kind: 'directChaosBlessing';
  readonly owner: SemanticAddress;
  readonly acquisitionRole: 'transcendentEmbryoEquip' | 'transcendentEmbryoTransformation';
  readonly sequence: number;
  readonly acquisitionPoint: string;
  readonly acquisitionIdentity: string;
  readonly blessingKey: string;
  readonly rarity: Extract<TraitRarity, 'Common' | 'Rare' | 'Epic' | 'Heroic'>;
  readonly blessingValues: Readonly<Record<string, number>>;
}

/** Removes one exact direct Chaos blessing instance owned by Embryo. */
export interface DirectChaosBlessingRemovalEvent {
  readonly kind: 'directChaosBlessingRemoval';
  readonly owner: SemanticAddress;
  readonly acquisitionRole:
    'transcendentEmbryoTransformation' | 'transcendentEmbryoRackReplacement';
  readonly sequence: number;
  readonly acquisitionPoint: string;
  readonly acquisitionIdentity: string;
}

export interface ChaosClockEvent {
  readonly kind: 'chaosClock';
  readonly sequence: number;
  readonly clock: import('../catalog-schema').ChaosClockKind;
  /** The originating selected pair provides stable chronology ownership. */
  readonly owner: SemanticAddress;
  readonly acquisitionRole: 'chaosClock';
}

/** One declaration-owned Gift Gift Gift attempt at a succeeding biome start. */
export interface EchoKeepsakeReplayEvent {
  readonly kind: 'echoKeepsakeReplay';
  readonly owner: EchoKeepsakeReplayAddress;
  readonly acquisitionRole: 'echoKeepsakeReplay';
  readonly sequence: number;
  readonly acquisitionPoint: 'biomeStart';
  readonly traitKey: 'EchoRepeatKeepsakeBoon';
  readonly acquisitionIdentity: string;
  readonly capturedKeepsakeKey: string;
}

export type TraitHistoryEvent =
  | TraitOfferEvent
  | ConcaveStoneSecondaryEvent
  | TraitLevelMutationEvent
  | SteadyGrowthProgressEvent
  | TraitRarityMutationEvent
  | TraitElementContributionEvent
  | DirectTraitGrantEvent
  | TraitRemovalEvent
  | EchoKeepsakeReplayEvent
  | ChaosPairEvent
  | DirectChaosBlessingEvent
  | DirectChaosBlessingRemovalEvent
  | ChaosClockEvent;

export interface TraitReplacementTransition {
  readonly slot: string;
  readonly replacedTraitKey: string;
  readonly oldRarity: TraitRarity;
  readonly newTraitKey: string;
  readonly requiredRarity: TraitRarity;
  /** Sacrificial Hymn adds levels only to its one forced replacement row. */
  readonly levelBonus?: number;
}

interface TraitTargetedAcquisitionTransitionBase {
  readonly sourceTraitKey: string;
  readonly targetTraitKey: string;
}

export type TraitTargetedAcquisitionTransition =
  | (TraitTargetedAcquisitionTransitionBase & {
      readonly kind: 'promoteGodTraitToHeroic';
      readonly oldRarity: TraitRarity;
      readonly newRarity: 'Heroic';
      readonly oldLevel: number;
      readonly newLevel: number;
    })
  | (TraitTargetedAcquisitionTransitionBase & {
      readonly kind: 'upgradeHammerToRank2';
      readonly oldHammerRank: 'RankI';
      readonly newHammerRank: 'RankII';
    });

export interface TraitTargetedAcquisitionAssessment {
  readonly applies: boolean;
  readonly legal: boolean;
  readonly sourceTraitKey?: string;
  readonly targetTraitKey?: string;
  readonly findings: readonly TraitAssessmentFinding[];
  readonly transition?: TraitTargetedAcquisitionTransition;
}

/** Data-only result of one Ransom after its outer trait has been equipped. */
export interface RansomAssessment {
  readonly applies: boolean;
  readonly events: readonly (TraitRemovalEvent | TraitLevelMutationEvent)[];
  readonly removedTraitKeys: readonly string[];
  readonly removedCount: number;
  readonly levelBonus: number;
  readonly buffedTraitKeys: readonly string[];
  readonly resultingHistory: TraitHistoryState;
}

export interface TraitHistoryState {
  readonly events: readonly TraitHistoryEvent[];
  readonly equippedTraits: Readonly<Record<string, EquippedTrait>>;
  /** All six declaration-owned equipment slots. */
  readonly equippedSlots: Readonly<Record<string, EquippedTrait>>;
  readonly elementCounts: Readonly<Record<TraitElement, number>>;
  readonly highestBaseElementCount: number;
  readonly godBoonRarityCounts: Readonly<Record<string, number>>;
  readonly upgradableTraitCount: number;
  /** Route-wide exact trait keys excluded from later offer eligibility. */
  readonly bannedTraitKeys: readonly string[];
  /** Exact traits selected from prior offer screens, including traits later removed. */
  readonly previouslyPickedTraitKeys: readonly string[];
  /** Exact activation fact for Proper Upbringing's promotion and future offers. */
  readonly properUpbringingActive?: true;
  readonly activeChaosCurses: readonly ChaosCurseInstance[];
  readonly maturedChaosBlessings: readonly ChaosBlessingInstance[];
}

/** Traits whose existing level can be mutated by run effects. */
export function isLevelBearingTrait(catalog: Catalog, traitKey: string): boolean {
  const declaration = catalog.traits.byKey[traitKey];
  return (
    declaration?.isCoreGodTrait === true &&
    declaration.rarityDomain.kind === 'ranked' &&
    !declaration.blockStacking
  );
}
/** The sole supported Pom target predicate. */
export function isPomEligibleTrait(catalog: Catalog, traitKey: string): boolean {
  const declaration = catalog.traits.byKey[traitKey];
  return declaration?.isCoreGodTrait === true && isLevelBearingTrait(catalog, traitKey);
}

/**
 * Whether one additional in-run level or rarity mutation can still improve an
 * equipped trait. Most traits have no declared cap; the three cooldown-bound
 * Hephaestus traits provide the exact current-level boundary.
 *
 * Proper Upbringing deliberately does not consume this predicate: its source
 * path directly promotes every eligible Common trait to Rare.
 */
export function hasEffectiveInRunUpgrade(
  catalog: Catalog,
  traitKey: string,
  trait: Pick<EquippedTrait, 'rarity' | 'level'>,
): boolean {
  if (trait.rarity === undefined || trait.level === undefined) return true;
  if (
    trait.rarity !== 'Common' &&
    trait.rarity !== 'Rare' &&
    trait.rarity !== 'Epic' &&
    trait.rarity !== 'Heroic'
  )
    return true;
  const maximum = catalog.traits.byKey[traitKey]?.maximumEligibleLevelByRarity?.[trait.rarity];
  return maximum === undefined || trait.level <= maximum;
}

/** The full current-frontier domain shared by Poms and Natural Selection. */
export function isPomUpgradeTarget(
  catalog: Catalog,
  trait: EquippedTrait | undefined,
): trait is EquippedTrait & { readonly level: number } {
  return (
    trait !== undefined &&
    trait.level !== undefined &&
    isPomEligibleTrait(catalog, trait.traitKey) &&
    hasEffectiveInRunUpgrade(catalog, trait.traitKey, trait)
  );
}

/** Computes the declaration-owned provider-index transform without consulting acquisition origin. */
export function assessRansom(
  catalog: Catalog,
  before: TraitHistoryState,
  sourceTraitKey: string,
  owner: SemanticAddress,
  acquisitionRole: string,
  sequence: number,
  acquisitionPoint: string,
): RansomAssessment {
  const disposition = catalog.traits.byKey[sourceTraitKey]?.selectedDisposition;
  if (disposition?.kind !== 'ransom')
    return Object.freeze({
      applies: false,
      events: Object.freeze([]),
      removedTraitKeys: Object.freeze([]),
      removedCount: 0,
      levelBonus: 0,
      buffedTraitKeys: Object.freeze([]),
      resultingHistory: before,
    });
  const removedTraitKeys = Object.values(before.equippedTraits)
    .filter((trait) =>
      catalog.traitGivers.byKey[disposition.removeGiverKey]?.traitKeys.includes(trait.traitKey),
    )
    .map((trait) => trait.traitKey);
  const removals: TraitRemovalEvent[] = removedTraitKeys.map((traitKey) =>
    Object.freeze({
      kind: 'traitRemoval' as const,
      owner,
      acquisitionRole,
      sequence,
      acquisitionPoint,
      traitKey,
      match: 'currentTraitKey' as const,
    }),
  );
  const afterRemoval = foldTraitHistoryEvents(catalog, [...before.events, ...removals]);
  const levelBonus = removedTraitKeys.length * disposition.levelsPerRemovedIdentity;
  const buffed = Object.values(afterRemoval.equippedTraits).filter(
    (trait) =>
      catalog.traitGivers.byKey[disposition.buffGiverKey]?.traitKeys.includes(trait.traitKey) &&
      isLevelBearingTrait(catalog, trait.traitKey) &&
      trait.level !== undefined,
  );
  const mutations: TraitLevelMutationEvent[] = buffed.map((trait) =>
    Object.freeze({
      kind: 'levelMutation' as const,
      owner,
      acquisitionRole,
      sequence,
      acquisitionPoint,
      sourceTraitKey,
      targetTraitKey: trait.traitKey,
      oldLevel: trait.level!,
      newLevel: trait.level! + levelBonus,
    }),
  );
  return Object.freeze({
    applies: true,
    events: Object.freeze([...removals, ...mutations]),
    removedTraitKeys: Object.freeze(removedTraitKeys),
    removedCount: removedTraitKeys.length,
    levelBonus,
    buffedTraitKeys: Object.freeze(buffed.map((trait) => trait.traitKey)),
    resultingHistory: foldTraitHistoryEvents(catalog, [
      ...before.events,
      ...removals,
      ...mutations,
    ]),
  });
}

const emptyElements = Object.freeze({ Aether: 0, Earth: 0, Air: 0, Fire: 0, Water: 0 });
const BASE_ELEMENTS: readonly TraitElement[] = Object.freeze(['Earth', 'Air', 'Fire', 'Water']);
const ORDINARY_EQUIPMENT_SLOTS = new Set(['Melee', 'Secondary', 'Ranged', 'Rush', 'Mana']);

function combinedElementFacts(
  fromTraits: ReturnType<typeof deriveFacts>,
  pickupElements: Readonly<Record<TraitElement, number>>,
) {
  const elementCounts = Object.freeze({
    Aether: fromTraits.elementCounts.Aether + pickupElements.Aether,
    Earth: fromTraits.elementCounts.Earth + pickupElements.Earth,
    Air: fromTraits.elementCounts.Air + pickupElements.Air,
    Fire: fromTraits.elementCounts.Fire + pickupElements.Fire,
    Water: fromTraits.elementCounts.Water + pickupElements.Water,
  });
  return Object.freeze({
    ...fromTraits,
    elementCounts,
    highestBaseElementCount: Math.max(...BASE_ELEMENTS.map((element) => elementCounts[element])),
  });
}

export function createTraitHistoryState(): TraitHistoryState {
  return Object.freeze({
    events: Object.freeze([]),
    equippedTraits: Object.freeze({}),
    equippedSlots: Object.freeze({}),
    elementCounts: emptyElements,
    highestBaseElementCount: 0,
    godBoonRarityCounts: Object.freeze({}),
    upgradableTraitCount: 0,
    bannedTraitKeys: Object.freeze([]),
    previouslyPickedTraitKeys: Object.freeze([]),
    activeChaosCurses: Object.freeze([]),
    maturedChaosBlessings: Object.freeze([]),
  });
}

function deriveFacts(catalog: Catalog, equippedTraits: Readonly<Record<string, EquippedTrait>>) {
  const elements: Record<TraitElement, number> = { Aether: 0, Earth: 0, Air: 0, Fire: 0, Water: 0 };
  const slots: Record<string, EquippedTrait> = {};
  const rarityCounts: Record<string, number> = {};
  let upgradable = 0;
  for (const equipped of Object.values(equippedTraits)) {
    const declaration = catalog.traits.byKey[equipped.traitKey];
    if (declaration === undefined) continue;
    for (const [element, amount] of Object.entries(declaration.elementContributions)) {
      if (amount !== undefined) elements[element as TraitElement] += amount;
    }
    if (declaration.equipmentSlot !== undefined) slots[declaration.equipmentSlot] = equipped;
    if (
      declaration.usesBoonRarity &&
      equipped.rarity !== undefined &&
      !declaration.excludeFromRarityCount
    ) {
      rarityCounts[equipped.rarity] = (rarityCounts[equipped.rarity] ?? 0) + 1;
    }
    if (isPomUpgradeTarget(catalog, equipped)) upgradable += 1;
  }
  const highestBaseElementCount = Math.max(
    elements.Earth,
    elements.Air,
    elements.Fire,
    elements.Water,
  );
  return Object.freeze({
    equippedSlots: Object.freeze(slots),
    elementCounts: Object.freeze(elements),
    highestBaseElementCount,
    godBoonRarityCounts: Object.freeze(rarityCounts),
    upgradableTraitCount: upgradable,
  });
}

/** The ordinary five-slot view is derived from the one complete equipment ledger. */
export function ordinaryEquippedSlots(
  history: TraitHistoryState,
): Readonly<Record<string, EquippedTrait>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(history.equippedSlots).filter(([slot]) => ORDINARY_EQUIPMENT_SLOTS.has(slot)),
    ),
  );
}

function activeRarityFloorSources(
  catalog: Catalog,
  equippedTraits: Readonly<Record<string, EquippedTrait>>,
  elementCounts: Readonly<Record<TraitElement, number>>,
): ReadonlySet<string> {
  const active = new Set<string>();
  for (const equipped of Object.values(equippedTraits)) {
    const declaration = catalog.traits.byKey[equipped.traitKey];
    const effect = declaration?.rarityFloorEffect;
    if (effect === undefined) continue;
    const activeForLedger = Object.entries(effect.activationElementMinimums).every(
      ([element, minimum]) => (elementCounts[element as TraitElement] ?? 0) >= minimum,
    );
    if (activeForLedger) active.add(equipped.traitKey);
  }
  return active;
}

function withRarityAndSteadyGrowthCredit(
  catalog: Catalog,
  trait: EquippedTrait,
  rarity: TraitRarity,
  resetSteadyGrowthProgress = false,
): EquippedTrait {
  const disposition = catalog.traits.byKey[trait.traitKey]?.selectedDisposition;
  if (disposition?.kind !== 'steadyGrowth' || trait.rarity === undefined)
    return Object.freeze({ ...trait, rarity });
  const oldInterval = disposition.intervalsByRarity[trait.rarity as 'Common'];
  const newInterval = disposition.intervalsByRarity[rarity as 'Common'];
  if (oldInterval === undefined || newInterval === undefined)
    return Object.freeze({ ...trait, rarity });
  const progress = resetSteadyGrowthProgress
    ? 0
    : newInterval - Math.min(oldInterval - (trait.steadyGrowthProgress ?? 0), newInterval);
  return Object.freeze({ ...trait, rarity, steadyGrowthProgress: progress });
}

function promoteActiveFloorTargets(
  catalog: Catalog,
  equippedTraits: Record<string, EquippedTrait>,
  activeSources: ReadonlySet<string>,
  events: readonly TraitOfferEvent[],
): void {
  if (activeSources.size === 0) return;
  const effects = [...activeSources].flatMap((sourceKey) => {
    const declaration = catalog.traits.byKey[sourceKey];
    return declaration?.rarityFloorEffect === undefined
      ? []
      : [{ sourceKey, effect: declaration.rarityFloorEffect }];
  });
  if (effects.length === 0) return;
  const promotedKeys: string[] = [];
  for (const [traitKey, equipped] of Object.entries(equippedTraits)) {
    const declaration = catalog.traits.byKey[traitKey];
    if (
      declaration === undefined ||
      !declaration.usesBoonRarity ||
      declaration.blockInRunRarify ||
      activeSources.has(traitKey) ||
      declaration.rarityDomain.kind !== 'ranked' ||
      !declaration.rarityDomain.equippedRarities.includes('Rare') ||
      equipped.rarity !== 'Common' ||
      effects.every(
        ({ effect }) => effect.fromRarity !== 'Common' || effect.minimumRarity !== 'Rare',
      )
    )
      continue;
    equippedTraits[traitKey] = withRarityAndSteadyGrowthCredit(catalog, equipped, 'Rare');
    promotedKeys.push(traitKey);
  }
  for (const event of events) {
    const transition = event.targetedAcquisitionTransition;
    if (
      transition?.kind !== 'promoteGodTraitToHeroic' ||
      !promotedKeys.includes(transition.sourceTraitKey)
    )
      continue;
    const target = equippedTraits[transition.targetTraitKey];
    if (target?.level === undefined) continue;
    equippedTraits[transition.targetTraitKey] = Object.freeze({
      ...target,
      level: target.level + 1,
    });
  }
}

export function foldTraitHistoryEvents(
  catalog: Catalog,
  events: readonly TraitHistoryEvent[],
): TraitHistoryState {
  const equipped: Record<string, EquippedTrait> = {};
  const bannedTraitKeys = new Set<string>();
  const previouslyPickedTraitKeys = new Set<string>();
  const pickupElements: Record<TraitElement, number> = {
    Aether: 0,
    Earth: 0,
    Air: 0,
    Fire: 0,
    Water: 0,
  };
  let activeSources: ReadonlySet<string> = new Set();
  let activeChaos: ChaosCurseInstance[] = [];
  const maturedChaos: ChaosBlessingInstance[] = [];
  // Stable ordering retains the producer/purchase chronology already encoded
  // by construction. A targeted acquisition appends its mutation immediately
  // after its own offer, so no global same-sequence reordering is required.
  const ordered = [...events].sort((left, right) => left.sequence - right.sequence);
  for (let index = 0; index < ordered.length;) {
    const sequence = ordered[index]!.sequence;
    const group: TraitHistoryEvent[] = [];
    while (ordered[index]?.sequence === sequence) group.push(ordered[index++]!);
    for (const event of group) {
      if (event.kind === 'directChaosBlessing') {
        const blessing = catalog.chaos.blessings.byKey[event.blessingKey];
        if (blessing === undefined) continue;
        maturedChaos.push(
          Object.freeze({
            acquisitionIdentity: event.acquisitionIdentity,
            blessingKey: event.blessingKey,
            rarity: event.rarity,
            blessingValues: event.blessingValues,
          }),
        );
        const outcome = blessing.derivedOutcome;
        if (outcome?.kind === 'creation')
          for (const element of ['Aether', 'Earth', 'Air', 'Fire', 'Water'] as const)
            pickupElements[element] += outcome.elementsPerElementByRarity[event.rarity];
        continue;
      }
      if (event.kind === 'directChaosBlessingRemoval') {
        const index = maturedChaos.findIndex(
          (blessing) => blessing.acquisitionIdentity === event.acquisitionIdentity,
        );
        if (index < 0) continue;
        const [removed] = maturedChaos.splice(index, 1);
        const outcome = catalog.chaos.blessings.byKey[removed!.blessingKey]?.derivedOutcome;
        if (outcome?.kind === 'creation')
          for (const element of ['Aether', 'Earth', 'Air', 'Fire', 'Water'] as const)
            pickupElements[element] -=
              outcome.elementsPerElementByRarity[
                removed!.rarity === 'Legendary' ? 'Heroic' : removed!.rarity
              ];
        continue;
      }
      if (event.kind === 'chaosPair') {
        const curse = catalog.chaos.curses.byKey[event.offer.curseKey];
        if (curse !== undefined)
          activeChaos = [
            ...activeChaos,
            Object.freeze({
              acquisitionIdentity: event.acquisitionIdentity,
              owner: event.owner,
              curseKey: event.offer.curseKey,
              duration: event.offer.duration,
              remaining: event.offer.duration,
              clock: curse.clock,
              ...(curse.semanticTag === undefined ? {} : { semanticTag: curse.semanticTag }),
              curseValues: event.offer.curseValues,
              blessingKey: event.offer.blessingKey,
              rarity: event.offer.rarity,
              blessingValues: event.offer.blessingValues,
            }),
          ];
        continue;
      }
      if (event.kind === 'chaosClock') {
        const survivors: ChaosCurseInstance[] = [];
        for (const active of activeChaos) {
          if (active.clock !== event.clock) {
            survivors.push(active);
            continue;
          }
          const remaining = active.remaining - 1;
          if (remaining > 0) {
            survivors.push(Object.freeze({ ...active, remaining }));
            continue;
          }
          maturedChaos.push(
            Object.freeze({
              acquisitionIdentity: active.acquisitionIdentity,
              blessingKey: active.blessingKey,
              rarity: active.rarity,
              blessingValues: active.blessingValues,
            }),
          );
          const outcome = catalog.chaos.blessings.byKey[active.blessingKey]?.derivedOutcome;
          if (outcome?.kind === 'creation')
            for (const element of ['Aether', 'Earth', 'Air', 'Fire', 'Water'] as const)
              pickupElements[element] +=
                outcome.elementsPerElementByRarity[
                  active.rarity === 'Legendary' ? 'Heroic' : active.rarity
                ];
        }
        activeChaos = survivors;
        continue;
      }
      if (event.kind === 'levelMutation') {
        const target = equipped[event.targetTraitKey];
        if (
          target !== undefined &&
          target.level === event.oldLevel &&
          event.newLevel > event.oldLevel &&
          isLevelBearingTrait(catalog, event.targetTraitKey)
        ) {
          equipped[event.targetTraitKey] = Object.freeze({ ...target, level: event.newLevel });
        }
        continue;
      }
      if (event.kind === 'steadyGrowthProgress') {
        const target = equipped[event.traitKey];
        if (
          target?.acquisitionIdentity === event.acquisitionIdentity &&
          (target.steadyGrowthProgress ?? 0) === event.oldProgress &&
          event.newProgress >= 0 &&
          event.newProgress < event.requiredInterval
        )
          equipped[event.traitKey] = Object.freeze({
            ...target,
            steadyGrowthProgress: event.newProgress,
          });
        continue;
      }
      if (event.kind === 'rarityMutation') {
        const target = equipped[event.targetTraitKey];
        const directFountainPromotion =
          event.acquisitionRole === 'fountainRarity' &&
          event.acquisitionPoint === 'fountainUsed' &&
          event.oldRarity === 'Common' &&
          event.newRarity === 'Heroic';
        if (
          target?.rarity === event.oldRarity &&
          (directFountainPromotion ||
            nextRarity(catalog, event.targetTraitKey, event.oldRarity) === event.newRarity)
        )
          equipped[event.targetTraitKey] = withRarityAndSteadyGrowthCredit(
            catalog,
            target,
            event.newRarity,
            event.resetSteadyGrowthProgress === true,
          );
        continue;
      }
      if (event.kind === 'elementContribution') {
        for (const [element, value] of Object.entries(event.contributions)) {
          pickupElements[element as TraitElement] += value ?? 0;
        }
        continue;
      }
      if (event.kind === 'traitRemoval') {
        if (
          event.match === 'currentTraitKey' ||
          equipped[event.traitKey]?.acquisitionIdentity === event.acquisitionIdentity
        )
          delete equipped[event.traitKey];
        continue;
      }
      if (event.kind === 'echoKeepsakeReplay') {
        const gift = equipped[event.traitKey];
        if (
          gift?.acquisitionIdentity === event.acquisitionIdentity &&
          gift.echoRepeatedKeepsakeKey === event.capturedKeepsakeKey
        )
          equipped[event.traitKey] = Object.freeze({
            ...gift,
            echoKeepsakeReplayCount: (gift.echoKeepsakeReplayCount ?? 0) + 1,
          });
        continue;
      }
      if (event.kind === 'directTraitGrant') {
        if (equipped[event.traitKey] !== undefined) continue;
        const giver =
          event.giverKey === undefined ? undefined : catalog.traitGivers.byKey[event.giverKey];
        const declaration = catalog.traits.byKey[event.traitKey];
        const linkedAspectGrant = catalog.aspects.byKey[event.sourceTraitKey]?.startingTrait;
        if (
          declaration === undefined ||
          (event.giverKey !== undefined &&
            (giver === undefined ||
              (!giver.traitKeys.includes(event.traitKey) &&
                (linkedAspectGrant?.traitKey !== event.traitKey ||
                  linkedAspectGrant.giverKey !== event.giverKey))))
        )
          continue;
        equipped[event.traitKey] = Object.freeze({
          traitKey: event.traitKey,
          giverKey: giver?.key ?? event.sourceTraitKey,
          providerKind: giver?.providerKind ?? 'npc',
          ...(isLevelBearingTrait(catalog, event.traitKey) ? { level: 1 } : {}),
          sourceRole: event.acquisitionRole,
        });
        continue;
      }
      if (event.kind !== 'traitOffer' && event.kind !== 'concaveStoneSecondary') continue;
      const option = event.options[optionIndex(event.selectedOptionKey)];
      for (const traitKey of event.bannedTraitKeys ?? []) bannedTraitKeys.add(traitKey);
      if (option !== undefined) previouslyPickedTraitKeys.add(option.traitKey);
      if (option === undefined || equipped[option.traitKey] !== undefined) continue;
      const giver = catalog.traitGivers.byKey[event.giverKey];
      const declaration = catalog.traits.byKey[option.traitKey];
      if (giver === undefined || declaration === undefined) continue;
      // A malformed history must never accumulate two simultaneous traits in
      // one declaration-owned equipment slot. Normal eligibility reports the
      // invalid second offer earlier; this is the final fold attestation.
      if (
        event.replacementTransition === undefined &&
        declaration.equipmentSlot === 'Spell' &&
        Object.values(equipped).some(
          (existing) => catalog.traits.byKey[existing.traitKey]?.equipmentSlot === 'Spell',
        )
      )
        continue;
      const replacementLevel =
        event.replacementTransition === undefined
          ? undefined
          : equipped[event.replacementTransition.replacedTraitKey]?.level;
      if (event.replacementTransition !== undefined) {
        delete equipped[event.replacementTransition.replacedTraitKey];
      }
      equipped[option.traitKey] = Object.freeze({
        traitKey: option.traitKey,
        giverKey: giver.key,
        providerKind: giver.providerKind,
        ...(option.rarity === undefined ? {} : { rarity: option.rarity }),
        ...(isLevelBearingTrait(catalog, option.traitKey)
          ? { level: event.selectedEffectiveLevel ?? 1 }
          : {}),
        ...(declaration.hammerCompatibility === undefined ? {} : { hammerRank: 'RankI' as const }),
        sourceRole: event.acquisitionRole,
        ...(event.acquisitionIdentity === undefined
          ? {}
          : { acquisitionIdentity: event.acquisitionIdentity }),
        ...(event.echoRepeatedKeepsakeKey === undefined
          ? {}
          : {
              echoRepeatedKeepsakeKey: event.echoRepeatedKeepsakeKey,
              echoKeepsakeReplayCount: 0,
            }),
      });
      const targeted = event.targetedAcquisitionTransition;
      if (targeted !== undefined) {
        const target = equipped[targeted.targetTraitKey];
        if (target !== undefined) {
          switch (targeted.kind) {
            case 'promoteGodTraitToHeroic':
              equipped[targeted.targetTraitKey] = withRarityAndSteadyGrowthCredit(
                catalog,
                target,
                targeted.newRarity,
              );
              break;
            case 'upgradeHammerToRank2':
              equipped[targeted.targetTraitKey] = Object.freeze({
                ...target,
                hammerRank: targeted.newHammerRank,
              });
              break;
          }
        }
      }
      if (event.replacementTransition !== undefined && event.selectedEffectiveLevel === undefined) {
        const replacement = equipped[event.replacementTransition.newTraitKey];
        if (replacement !== undefined && replacementLevel !== undefined) {
          equipped[event.replacementTransition.newTraitKey] = Object.freeze({
            ...replacement,
            level: replacementLevel + (event.replacementTransition.levelBonus ?? 0),
          });
        }
      }
    }
    const fromTraits = deriveFacts(catalog, equipped);
    const afterAcquisition = combinedElementFacts(fromTraits, pickupElements);
    const nextActiveSources = activeRarityFloorSources(
      catalog,
      equipped,
      afterAcquisition.elementCounts,
    );
    const newlyActive = new Set(
      [...nextActiveSources].filter((sourceKey) => !activeSources.has(sourceKey)),
    );
    promoteActiveFloorTargets(
      catalog,
      equipped,
      newlyActive,
      ordered
        .slice(0, index)
        .filter((event): event is TraitOfferEvent => event.kind === 'traitOffer'),
    );
    activeSources = nextActiveSources;
  }
  const fromTraits = deriveFacts(catalog, equipped);
  const derived = combinedElementFacts(fromTraits, pickupElements);
  return Object.freeze({
    events: Object.freeze(ordered),
    bannedTraitKeys: Object.freeze([...bannedTraitKeys]),
    previouslyPickedTraitKeys: Object.freeze([...previouslyPickedTraitKeys]),
    equippedTraits: Object.freeze(equipped),
    ...derived,
    ...(activeSources.size === 0 ? {} : { properUpbringingActive: true as const }),
    activeChaosCurses: Object.freeze(activeChaos),
    maturedChaosBlessings: Object.freeze(maturedChaos),
  });
}

/** Advances only one already-recorded lifecycle checkpoint. */
export function advanceChaosClock(
  catalog: Catalog,
  before: TraitHistoryState,
  sequence: number,
  clock: import('../catalog-schema').ChaosClockKind,
): TraitHistoryState {
  const owner = before.activeChaosCurses.find((active) => active.clock === clock)?.owner;
  if (owner === undefined) return before;
  return foldTraitHistoryEvents(catalog, [
    ...before.events,
    Object.freeze({
      kind: 'chaosClock' as const,
      sequence,
      clock,
      owner,
      acquisitionRole: 'chaosClock' as const,
    }),
  ]);
}

export interface ReachedSteadyGrowthThreshold {
  readonly traitKey: string;
  readonly acquisitionIdentity: string;
  readonly requiredInterval: number;
  /** Immutable pre-checkpoint frontier; candidates and settlement share it. */
  readonly before: TraitHistoryState;
  readonly eligibleTargetKeys: readonly string[];
}

export interface SteadyGrowthTargetAssessment {
  readonly legal: boolean;
  readonly targetTraitKey: string | null;
  readonly eligibleTargetKeys: readonly string[];
  readonly nextRarity?: TraitRarity;
}

/** Assesses the exact random result from one already-reached threshold frontier. */
export function assessSteadyGrowthTarget(
  catalog: Catalog,
  threshold: ReachedSteadyGrowthThreshold,
  targetTraitKey: string | null | undefined,
): SteadyGrowthTargetAssessment {
  if (threshold.eligibleTargetKeys.length === 0)
    return Object.freeze({
      legal: targetTraitKey === null || targetTraitKey === undefined,
      targetTraitKey: null,
      eligibleTargetKeys: threshold.eligibleTargetKeys,
    });
  if (targetTraitKey === null || targetTraitKey === undefined)
    return Object.freeze({
      legal: false,
      targetTraitKey: null,
      eligibleTargetKeys: threshold.eligibleTargetKeys,
    });
  if (!threshold.eligibleTargetKeys.includes(targetTraitKey))
    return Object.freeze({
      legal: false,
      targetTraitKey,
      eligibleTargetKeys: threshold.eligibleTargetKeys,
    });
  const current = threshold.before.equippedTraits[targetTraitKey];
  const next =
    current?.rarity === undefined ? undefined : nextRarity(catalog, targetTraitKey, current.rarity);
  return Object.freeze({
    legal: next !== undefined,
    targetTraitKey,
    eligibleTargetKeys: threshold.eligibleTargetKeys,
    ...(next === undefined ? {} : { nextRarity: next }),
  });
}

/** Applies the forced result without introducing a second effect scheduler. */
export function settleSteadyGrowthThreshold(
  catalog: Catalog,
  history: TraitHistoryState,
  owner: SemanticAddress,
  sequence: number,
  threshold: ReachedSteadyGrowthThreshold,
  targetTraitKey: string | null | undefined,
): { readonly history: TraitHistoryState; readonly assessment: SteadyGrowthTargetAssessment } {
  const assessment = assessSteadyGrowthTarget(catalog, threshold, targetTraitKey);
  if (
    !assessment.legal ||
    assessment.targetTraitKey === null ||
    assessment.nextRarity === undefined
  )
    return Object.freeze({ history, assessment });
  const target = history.equippedTraits[assessment.targetTraitKey];
  if (target?.rarity === undefined) return Object.freeze({ history, assessment });
  const event: TraitRarityMutationEvent = Object.freeze({
    kind: 'rarityMutation',
    owner,
    acquisitionRole: 'steadyGrowth',
    sequence,
    acquisitionPoint: 'encounterEndEffectsApplied',
    sourceTraitKey: threshold.traitKey,
    targetTraitKey: assessment.targetTraitKey,
    oldRarity: target.rarity,
    newRarity: assessment.nextRarity,
    ...(assessment.targetTraitKey === threshold.traitKey
      ? { resetSteadyGrowthProgress: true as const }
      : {}),
  });
  return Object.freeze({
    history: foldTraitHistoryEvents(catalog, [...history.events, event]),
    assessment,
  });
}

/** Applies Phial's direct Common-to-Heroic mutation at its fountain action. */
export function settleFountainRarityMutation(
  catalog: Catalog,
  history: TraitHistoryState,
  owner: SemanticAddress,
  sequence: number,
  targetTraitKey: string,
): { readonly history: TraitHistoryState; readonly legal: boolean } {
  const target = history.equippedTraits[targetTraitKey];
  const next = catalog.traitRarityOrder[3];
  if (target === undefined || target.rarity !== 'Common' || next !== 'Heroic')
    return Object.freeze({ history, legal: false });
  const event: TraitRarityMutationEvent = Object.freeze({
    kind: 'rarityMutation',
    owner,
    acquisitionRole: 'fountainRarity',
    sequence,
    acquisitionPoint: 'fountainUsed',
    targetTraitKey,
    oldRarity: target.rarity,
    newRarity: next,
  });
  return Object.freeze({
    history: foldTraitHistoryEvents(catalog, [...history.events, event]),
    legal: true,
  });
}

/** Folds one already-emitted qualifying encounter-end-effects checkpoint. */
export function advanceSteadyGrowthProgress(
  catalog: Catalog,
  before: TraitHistoryState,
  owner: SemanticAddress,
  sequence: number,
): {
  readonly history: TraitHistoryState;
  readonly thresholds: readonly ReachedSteadyGrowthThreshold[];
} {
  const events: SteadyGrowthProgressEvent[] = [];
  const thresholds: ReachedSteadyGrowthThreshold[] = [];
  for (const trait of Object.values(before.equippedTraits)) {
    const disposition = catalog.traits.byKey[trait.traitKey]?.selectedDisposition;
    if (
      disposition?.kind !== 'steadyGrowth' ||
      trait.acquisitionIdentity === undefined ||
      trait.rarity === undefined ||
      disposition.intervalsByRarity[trait.rarity as 'Common'] === undefined
    )
      continue;
    const requiredInterval = disposition.intervalsByRarity[trait.rarity as 'Common'];
    const oldProgress = trait.steadyGrowthProgress ?? 0;
    const reached = oldProgress + 1 >= requiredInterval;
    events.push(
      Object.freeze({
        kind: 'steadyGrowthProgress',
        owner,
        acquisitionRole: 'steadyGrowth',
        sequence,
        acquisitionPoint: 'encounterEndEffectsApplied',
        traitKey: trait.traitKey,
        acquisitionIdentity: trait.acquisitionIdentity,
        oldProgress,
        newProgress: reached ? 0 : oldProgress + 1,
        requiredInterval,
      }),
    );
    if (!reached) continue;
    const candidates = Object.values(before.equippedTraits).filter((candidate) => {
      const declaration = catalog.traits.byKey[candidate.traitKey];
      return (
        declaration?.usesBoonRarity === true &&
        candidate.rarity !== undefined &&
        !declaration.blockInRunRarify &&
        nextRarity(catalog, candidate.traitKey, candidate.rarity) !== undefined &&
        hasEffectiveInRunUpgrade(catalog, candidate.traitKey, candidate)
      );
    });
    const eligibleTargetKeys = candidates
      .filter((candidate) => candidates.length === 1 || candidate.traitKey !== trait.traitKey)
      .map((candidate) => candidate.traitKey);
    thresholds.push(
      Object.freeze({
        traitKey: trait.traitKey,
        acquisitionIdentity: trait.acquisitionIdentity,
        requiredInterval,
        before,
        eligibleTargetKeys: Object.freeze(eligibleTargetKeys),
      }),
    );
  }
  return Object.freeze({
    history:
      events.length === 0 ? before : foldTraitHistoryEvents(catalog, [...before.events, ...events]),
    thresholds: Object.freeze(thresholds),
  });
}

export function traitDerivedFacts(history: TraitHistoryState) {
  return Object.freeze({
    upgradableTraitCount: history.upgradableTraitCount,
    elementCounts: history.elementCounts,
    highestBaseElementCount: history.highestBaseElementCount,
    godBoonRarityCounts: history.godBoonRarityCounts,
  });
}

export function attachTraitHistory(
  rewardHistory: RewardHistoryState,
  traitHistory: TraitHistoryState,
): RewardHistoryState {
  return Object.freeze({
    ...rewardHistory,
    traitFacts: traitDerivedFacts(traitHistory),
  });
}

/** Declaration-owned advancement order shared by history and effect policies. */
export function nextRarity(
  catalog: Catalog,
  traitKey: string,
  rarity: TraitRarity,
): TraitRarity | undefined {
  const declaration = catalog.traits.byKey[traitKey];
  if (declaration?.rarityDomain.kind !== 'ranked') return undefined;
  const index = catalog.traitRarityOrder.indexOf(
    rarity as (typeof catalog.traitRarityOrder)[number],
  );
  const next = catalog.traitRarityOrder[index + 1];
  return next !== undefined && declaration.rarityDomain.equippedRarities.includes(next)
    ? next
    : undefined;
}

import type { TraitAssessmentFinding } from './trait-offers';
