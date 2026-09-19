import type { CatalogCollection } from '../normalized/collection';

export type TraitProviderKind = 'olympian' | 'hermes' | 'hammer' | 'npc' | 'spell' | 'chaos';

/** Closed numeric operand metadata for the paired Chaos result.  This is
 * deliberately declaration data, rather than a reusable modifier language. */
export interface ChaosNumericOperand {
  readonly key: string;
  readonly label: string;
  readonly minimum: number;
  readonly maximum: number;
  readonly step: number;
  /** Catalog-owned legal starting value for authoring this operand. */
  readonly authoringDefault: number;
  readonly integer?: true;
  /** Blessing values are processed against the selected shared rarity. */
  readonly byRarity?: Readonly<
    Partial<
      Record<
        Extract<TraitRarity, 'Common' | 'Rare' | 'Epic' | 'Heroic' | 'Legendary'>,
        ChaosNumericOperandDomain
      >
    >
  >;
}

export interface ChaosNumericOperandDomain {
  readonly minimum: number;
  readonly maximum: number;
  readonly step: number;
  /** Catalog-owned legal starting value for authoring this rarity domain. */
  readonly authoringDefault: number;
  readonly integer?: true;
}

export type ChaosClockKind = 'encounters' | 'locations' | 'godBoonScreens';
export type ChaosSemanticTag = 'Creation' | 'Favor' | 'Ordinary' | 'Rejected' | 'Barren';
/** Closed source eligibility facts for a selected Chaos pair. */
export type ChaosOfferRequirement =
  | { readonly kind: 'matureChaosBlessing' }
  | { readonly kind: 'elementMinimum'; readonly element: TraitElement; readonly minimum: number }
  | { readonly kind: 'notKeepsake'; readonly keepsakeKey: string }
  | { readonly kind: 'notAspect'; readonly aspectKey: string }
  | { readonly kind: 'routeKey'; readonly routeKey: 'Underworld' };

export interface ChaosCurseDeclaration {
  readonly key: string;
  readonly label: string;
  readonly clock: ChaosClockKind;
  readonly duration: ChaosNumericOperand;
  readonly operands: readonly ChaosNumericOperand[];
  readonly semanticTag?: ChaosSemanticTag;
  readonly offerRequirements?: readonly ChaosOfferRequirement[];
}

export interface ChaosBlessingDeclaration {
  readonly key: string;
  readonly label: string;
  readonly operands: readonly ChaosNumericOperand[];
  readonly semanticTag?: ChaosSemanticTag;
  readonly fixedRarity?: 'Legendary';
  /** Closed, game-owned outcome facts for the small Chaos set whose values are
   * fixed/derived rather than authored rolls. */
  readonly derivedOutcome?: ChaosDerivedOutcome;
  readonly offerRequirements?: readonly ChaosOfferRequirement[];
}

export type ChaosDerivedOutcome =
  | {
      readonly kind: 'creation';
      readonly elementsPerElementByRarity: Readonly<
        Record<'Common' | 'Rare' | 'Epic' | 'Heroic', number>
      >;
    }
  | {
      readonly kind: 'celerity';
      readonly moveSpeedPercentByRarity: Readonly<
        Record<'Common' | 'Rare' | 'Epic' | 'Heroic', number>
      >;
      readonly sprintVelocityByRarity: Readonly<
        Record<'Common' | 'Rare' | 'Epic' | 'Heroic', number>
      >;
      readonly sprintCapByRarity: Readonly<Record<'Common' | 'Rare' | 'Epic' | 'Heroic', number>>;
    }
  | {
      readonly kind: 'chant';
      readonly damagePerAetherPercentByRarity: Readonly<
        Record<'Common' | 'Rare' | 'Epic' | 'Heroic', number>
      >;
    }
  | { readonly kind: 'defiance'; readonly healthPercent: 40; readonly magickPercent: 40 };

export interface ChaosTraitCatalog {
  readonly curses: CatalogCollection<ChaosCurseDeclaration>;
  readonly blessings: CatalogCollection<ChaosBlessingDeclaration>;
  /** TrialUpgrade's sparse source override and exact low-to-high roll checks. */
  readonly rarity: {
    readonly itemOverride: BoonRarityOverride;
    readonly rollOrder: BoonRarityRollOrder;
  };
}

/** Rarities that can exist on an equipped trait or a fresh offer. */
export type TraitRarity = 'Common' | 'Rare' | 'Epic' | 'Heroic' | 'Legendary' | 'Duo';
export type InRunTraitRarity = Extract<TraitRarity, 'Common' | 'Rare' | 'Epic' | 'Heroic'>;

/** Ordered non-Common checks used by fresh god-trait boon rolls. */
export type BoonRarityCheck = 'Rare' | 'Epic' | 'Heroic' | 'Duo' | 'Legendary';
export type BoonRarityValues = Readonly<Record<BoonRarityCheck, number>>;
export type BoonRarityOverride = Readonly<Partial<BoonRarityValues>>;
export type BoonRarityRollOrder = readonly TraitRarity[];
export interface BoonRarityContribution {
  readonly additive?: BoonRarityOverride;
  readonly multiplicative?: BoonRarityOverride;
}

/** The player-facing boon-rarity vocabulary a declaration participates in.
 *
 * `none` is explicit for every planner-rarityless trait. It covers Hammers,
 * whose independent Rank I/II state is not rarity, and NPC traits whose source
 * uses internal scaling tiers without exposing or mutating boon rarity.
 */
export type TraitRarityDomain =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'ranked';
      readonly freshOfferRarities: readonly TraitRarity[];
      readonly equippedRarities: readonly TraitRarity[];
    };

export type TraitElement = 'Aether' | 'Earth' | 'Air' | 'Fire' | 'Water';

/**
 * One declaration-owned, scalable god-trait rarity floor.  This intentionally
 * remains a closed product rather than a general trait-effect language.
 */
export interface ScalableGodTraitRarityFloorEffect {
  readonly activationElementMinimums: Readonly<Partial<Record<TraitElement, number>>>;
  readonly fromRarity: 'Common';
  readonly minimumRarity: 'Rare';
}

export interface ProperUpbringingEffect extends ScalableGodTraitRarityFloorEffect {
  readonly boonRarityContribution: BoonRarityContribution;
}

/** One acquisition-time transition targeting exactly one equipped trait. */
export interface PromoteGodTraitToHeroicAcquisition {
  readonly kind: 'promoteGodTraitToHeroic';
  readonly target: 'superchargeableGodTrait';
}

/** Player-facing Rank II progression for one eligible equipped Daedalus Hammer. */
export interface UpgradeHammerToRank2Acquisition {
  readonly kind: 'upgradeHammerToRank2';
  readonly target: 'upgradableHammer';
  readonly targetCountByAcquisitionOrdinal: readonly [number, number, number, number];
}

export type TargetedTraitAcquisition =
  PromoteGodTraitToHeroicAcquisition | UpgradeHammerToRank2Acquisition;

export type TraitOrdinaryBoonSlot = 'Melee' | 'Secondary' | 'Ranged' | 'Rush' | 'Mana';
export type TraitEquipmentSlot = TraitOrdinaryBoonSlot | 'Spell';

export type DirectTraitSetKey = 'earth' | 'fire' | 'air' | 'water';

/** One closed source-owned direct-grant pair. This is deliberately narrower
 * than a generic trait callback/effect language. */
export interface DirectTraitSetDeclaration {
  readonly key: DirectTraitSetKey;
  readonly traitKeys: readonly [string, string];
}

/** Selection either equips, produces declared concrete pickups, or has no
 * modeled run effect. Pickup detail remains owned by the acquisition entry. */
export type TraitSelectedDisposition =
  | { readonly kind: 'equip' }
  | {
      /** Icarus equips the source, then increases the eligible trait occupying this slot. */
      readonly kind: 'upgradeOccupiedBoonSlot';
      readonly slot: 'Melee' | 'Secondary';
      readonly levelCountByAcquisitionOrdinal: TraitAcquisitionOrdinalValues;
    }
  | {
      readonly kind: 'naturalSelection';
      readonly slots: readonly [
        TraitOrdinaryBoonSlot,
        TraitOrdinaryBoonSlot,
        TraitOrdinaryBoonSlot,
        TraitOrdinaryBoonSlot,
        TraitOrdinaryBoonSlot,
      ];
      readonly levelCount: 8;
    }
  | {
      readonly kind: 'ransom';
      readonly removeGiverKey: 'Hera' | 'Zeus';
      readonly buffGiverKey: 'Hera' | 'Zeus';
      readonly levelsPerRemovedIdentity: 4;
    }
  | {
      readonly kind: 'steadyGrowth';
      readonly intervalsByRarity: Readonly<Record<'Common' | 'Rare' | 'Epic' | 'Heroic', number>>;
    }
  | {
      /** Equips the outer trait, then resolves one direct rarityless grant per set. */
      readonly kind: 'directTraitSets';
      readonly sets: readonly [
        DirectTraitSetDeclaration,
        DirectTraitSetDeclaration,
        DirectTraitSetDeclaration,
        DirectTraitSetDeclaration,
      ];
    }
  | {
      /** Echo always equips the outer rarityless identity before this closed effect settles. */
      readonly kind: 'echo';
      readonly effect: 'numericNoOp' | 'survive' | 'doubleLevel' | 'lastRunBoon' | 'lastReward';
    }
  | {
      /** Gift Gift Gift snapshots the current eligible keepsake into this equipped identity. */
      readonly kind: 'echo';
      readonly effect: 'repeatKeepsake';
      readonly excludedKeepsakeKeys: readonly string[];
    }
  | {
      /** One equipped Echo trait duplicates the first eligible World Shop acquisition. */
      readonly kind: 'echo';
      readonly effect: 'doubleShop';
      readonly excludedRewardTypes: readonly string[];
    }
  | {
      /** Hermes Travel Deal: numeric discount is catalog truth while simulation uses one refill. */
      readonly kind: 'worldShopRestock';
      readonly refillCount: 1;
      readonly discountByRarity: Readonly<Record<'Common' | 'Rare' | 'Epic' | 'Heroic', number>>;
    }
  | { readonly kind: 'advanceCurrentKeepsake'; readonly rankBonus: 1 }
  | {
      readonly kind: 'circe';
      readonly effect: 'activateArcana' | 'promoteArcana' | 'disableFear';
      readonly selectionCountByAcquisitionOrdinal: TraitAcquisitionOrdinalValues;
    }
  | {
      readonly kind: 'producePickups';
      readonly producerLifecycleKey: string;
      readonly pickups: readonly TraitPickupDeclaration[];
      /** Repeating producers defer these pickups to each qualifying encounter-end threshold. */
      readonly clock?: {
        readonly kind: 'qualifyingEncounterEndEffects';
        readonly intervalByAcquisitionOrdinal: TraitAcquisitionOrdinalValues;
      };
    }
  | { readonly kind: 'seaStar' }
  | { readonly kind: 'noOp' };

export interface TraitPickupDeclaration {
  readonly key: string;
  readonly rewardType: string;
  /** This physical pickup appears only at and after the declared acquisition position. */
  readonly minimumAcquisitionOrdinal?: 2 | 3 | 4;
  /** Buried Treasure's Bones drop does not exist when the source is a Story reward. */
  readonly excludeStorySource?: true;
}

/** The only acquisition-ordinal matrix supported for the audited NPC effects. */
export type TraitAcquisitionOrdinalValues = readonly [number, number, number, number];

/** Complete selected-disposition facts resolved once at an exact acquisition ordinal. */
export interface ResolvedTraitAcquisitionOrdinalEffect {
  readonly pickups: readonly TraitPickupDeclaration[];
  readonly levelCount?: number;
  readonly clockInterval?: number;
  readonly circeSelectionCount?: number;
}

function ordinalValue(values: TraitAcquisitionOrdinalValues, ordinal: number): number {
  if (!Number.isInteger(ordinal) || ordinal < 1 || ordinal > values.length)
    throw new Error(`unsupported acquisition ordinal ${ordinal}`);
  return values[ordinal - 1]!;
}

/** Resolves only the declaration-backed NPC values which vary by acquisition position. */
export function resolveTraitAcquisitionOrdinalEffect(
  disposition: TraitSelectedDisposition,
  ordinal: number,
): ResolvedTraitAcquisitionOrdinalEffect {
  if (disposition.kind === 'circe')
    return Object.freeze({
      pickups: Object.freeze([]),
      circeSelectionCount: ordinalValue(disposition.selectionCountByAcquisitionOrdinal, ordinal),
    });
  if (disposition.kind === 'upgradeOccupiedBoonSlot')
    return Object.freeze({
      pickups: Object.freeze([]),
      levelCount: ordinalValue(disposition.levelCountByAcquisitionOrdinal, ordinal),
    });
  if (disposition.kind !== 'producePickups') return Object.freeze({ pickups: Object.freeze([]) });
  if (!Number.isInteger(ordinal) || ordinal < 1 || ordinal > 4)
    throw new Error(`unsupported acquisition ordinal ${ordinal}`);
  const pickups = disposition.pickups.filter(
    (pickup) =>
      pickup.minimumAcquisitionOrdinal === undefined || ordinal >= pickup.minimumAcquisitionOrdinal,
  );
  return Object.freeze({
    pickups: Object.freeze(pickups),
    ...(disposition.clock === undefined
      ? {}
      : { clockInterval: ordinalValue(disposition.clock.intervalByAcquisitionOrdinal, ordinal) }),
  });
}

export type HexLayoutKey = 'Lung' | 'Pyramid' | 'Maze' | 'Nacelle';

export interface HexLayoutDeclaration {
  readonly key: HexLayoutKey;
  readonly label: string;
  readonly baseCapacity: number;
  readonly rareCount: number;
  readonly epicCount: number;
}

export interface HexTalentCandidateDeclaration {
  readonly key: string;
  readonly label: string;
}

export interface HexGodSentDeclaration {
  readonly providerKey: string;
  readonly forceKeepsakeKey: string;
  readonly olympianTalentKey: string;
  readonly olympianTalentLabel: string;
  readonly lineageTalentKey: string;
  readonly lineageTalentLabel: string;
  readonly capacityDelta: 2;
}

/** Frozen high-value outcome data for one generated Hex tree. */
export interface HexDeclaration {
  readonly spellTraitKey: string;
  readonly label: string;
  readonly layouts: CatalogCollection<HexLayoutDeclaration>;
  readonly rareCandidates: CatalogCollection<HexTalentCandidateDeclaration>;
  readonly epicCandidates: CatalogCollection<HexTalentCandidateDeclaration>;
  readonly godSent: HexGodSentDeclaration;
}

export type TraitOfferContextKey = 'devotionNoDuo' | 'blockGiftBoons' | 'circeRemovableFearVow';

export type TraitRequirementExpression =
  | {
      readonly kind: 'all';
      readonly requirements: readonly TraitRequirementExpression[];
    }
  | {
      /** A canonical reward-use prefix fact, not an authored predicate. */
      readonly kind: 'settledSpellDrop';
    }
  | {
      readonly kind: 'anyEquippedTrait';
      readonly traitKeys: readonly string[];
    }
  | {
      readonly kind: 'notEquippedTrait';
      readonly traitKeys: readonly string[];
    }
  | {
      readonly kind: 'elementCount';
      readonly element: TraitElement;
      readonly minimum: number;
    }
  | {
      readonly kind: 'highestBaseElementCount';
      readonly minimum: number;
    }
  | {
      readonly kind: 'godBoonRarityCount';
      readonly rarity: TraitRarity;
      readonly minimum: number;
      readonly maximum?: number;
    }
  | {
      readonly kind: 'rarifiableTrait';
    }
  | {
      readonly kind: 'upgradableTrait';
    }
  | {
      readonly kind: 'offerContext';
      readonly context: TraitOfferContextKey;
      readonly required: boolean;
    }
  | {
      readonly kind: 'manualArcanaGraspCost';
      readonly minimum: number;
    };

export interface WeaponDeclaration {
  readonly key: string;
  readonly label: string;
  readonly aspectKeys: readonly string[];
  readonly defaultAspectKey: string;
}

export interface AspectDeclaration {
  readonly key: string;
  readonly label: string;
  readonly weaponKey: string;
  readonly startingTrait?: { readonly traitKey: string; readonly giverKey: string };
  /** Narrow reward-side contribution from an equipped aspect. */
  readonly traitOfferLevelBonus?: {
    readonly maximumBonus: number;
    readonly upgradedMaximumBonus: number;
    readonly upgradeTraitKey: string;
  };
}

export interface HammerCompatibility {
  readonly weaponKey: string;
  readonly aspectKeys: readonly string[];
  /** Source-declared internal Legendary level, presented by the planner as Rank II. */
  readonly supportsRankII: boolean;
}

export interface TraitDeclaration {
  readonly key: string;
  readonly label: string;
  readonly rarityDomain: TraitRarityDomain;
  /** Current-state and offer-context predicates used by every offer source. */
  readonly eligibilityRequirements: readonly TraitRequirementExpression[];
  /** Native boon prerequisite groups used by ordinary generation only. */
  readonly linkedBoonRequirements: readonly TraitRequirementExpression[];
  readonly equipmentSlot?: TraitEquipmentSlot;
  readonly elementContributions: Readonly<Partial<Record<TraitElement, number>>>;
  readonly usesBoonRarity: boolean;
  /** May enter the initial offer as a linked priority seed, or be skipped. */
  readonly optionalLinkedPriority?: boolean;
  readonly isCoreGodTrait: boolean;
  readonly blockStacking: boolean;
  /** Source `BlockOfferIfPreviouslyPicked`; survives later trait removal. */
  readonly blockOfferIfPreviouslyPicked: boolean;
  readonly blockInRunRarify: boolean;
  /** A qualifying non-final boss payout blocks this equipped instance from later rarification. */
  readonly nonFinalBossRarityBlock?: true;
  readonly excludeFromRarityCount: boolean;
  readonly rarityFloorEffect?: ProperUpbringingEffect;
  readonly targetedAcquisition?: TargetedTraitAcquisition;
  /**
   * The largest current level from which an in-run level or rarity upgrade
   * still changes this trait. This is intentionally declaration-owned so
   * Pom-derived effects and generic in-run rarity promotion agree.
   */
  readonly maximumEligibleLevelByRarity?: Readonly<Record<InRunTraitRarity, number>>;
  readonly selectedDisposition: TraitSelectedDisposition;
  readonly selfExclusion?: string;
  readonly hammerCompatibility?: HammerCompatibility;
}

/** The rarity controls a giver exposes while authoring a fresh offer. */
export type TraitGiverRarityPolicy =
  | { readonly kind: 'none' }
  | { readonly kind: 'fixed'; readonly rarity: TraitRarity }
  | { readonly kind: 'selectable'; readonly rarities: readonly TraitRarity[] };

export interface TraitGiverDeclaration {
  readonly key: string;
  readonly label: string;
  readonly providerKind: TraitProviderKind;
  /** Exact `IsGodTrait(_, { ForShop = true })` giver membership; not provider-kind inference. */
  readonly shopAwareGodTrait: boolean;
  readonly traitKeys: readonly string[];
  /** Source-declared priority/core traits used by first Olympian offers. */
  readonly priorityTraitKeys: readonly string[];
  readonly rarityPolicy: TraitGiverRarityPolicy;
  /** Source `RarityRollOrder`; absent means the catalog-wide boon default. */
  readonly boonRarityRollOrder?: BoonRarityRollOrder;
  /** Closed source-menu participation normalized for Calling Card. */
  readonly callingCardMenu: boolean;
  readonly denialParticipates?: boolean;
  /** Ordered initial-spell button bonuses, owned by the SpellDrop giver. */
  readonly selectedOptionPathPointBonuses?: readonly [0, 1, 2];
}

/** One giver-preserving source variant in Echo's audited previous-run approximation. */
export interface EchoLastRunBoonVariantDeclaration {
  readonly key: string;
  readonly giverKey: string;
  readonly traitKey: string;
  /** Present only when source `GetLootSourceName` records this provider. */
  readonly lootHistorySource?: string;
}

export interface EchoLastRunBoonCatalog {
  readonly variants: CatalogCollection<EchoLastRunBoonVariantDeclaration>;
}

export interface TraitOfferContextDeclaration {
  readonly key: TraitOfferContextKey;
  readonly kind: 'rewardRarityBlock' | 'roomFlag' | 'authoredCondition';
  readonly blockedRarity?: TraitRarity;
  readonly roomFlag?: 'BlockGiftBoons';
  readonly authoredCondition?: 'circeRemovableFearVow';
}

export interface TraitCatalog {
  readonly rarityOrder: readonly ['Common', 'Rare', 'Epic', 'Heroic'];
  readonly elements: readonly TraitElement[];
  readonly baseElements: readonly ['Earth', 'Air', 'Fire', 'Water'];
  readonly offerContexts: CatalogCollection<TraitOfferContextDeclaration>;
  readonly weapons: CatalogCollection<WeaponDeclaration>;
  readonly aspects: CatalogCollection<AspectDeclaration>;
  readonly traits: CatalogCollection<TraitDeclaration>;
  readonly givers: CatalogCollection<TraitGiverDeclaration>;
  /** Source `TraitRarityData.BoonRarityRollOrder`. */
  readonly boonRarityRollOrder: BoonRarityRollOrder;
  /** Complete source base ledgers for the only fresh-roll providers this slice supports. */
  readonly boonRarityBases: Readonly<Record<'olympian' | 'hermes', BoonRarityValues>>;
  /** Source `HeroData.BoonData.ReplaceChance` for ordinary replacement rolls. */
  readonly boonReplacementChance: number;
  readonly chaos: ChaosTraitCatalog;
  readonly echoLastRunBoon: EchoLastRunBoonCatalog;
  readonly hexes: CatalogCollection<HexDeclaration>;
}
