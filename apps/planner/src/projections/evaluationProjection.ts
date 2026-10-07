import { semanticAddressKey, type SemanticAddress } from '@run-planner/engine/authored-project';
import { type Catalog } from '@run-planner/engine/catalog-schema';
import {
  type AssessmentIssue,
  type FindingCode,
  type ProjectEvaluation,
  type ProjectRouteEvaluation,
  type SemanticFinding,
} from '@run-planner/engine/simulation';

import type { FindingSelection } from '@planner/state/editorSessionSlice';

export type FindingIndex = ReadonlyMap<string, readonly SemanticFinding[]>;

export interface FindingPresentation {
  readonly title: string;
  readonly description?: string;
}

export type FindingDialogKind = 'traitOffer' | 'encounterCustomization' | 'levelResolution';

/** The dialog whose feedback region explains an inner finding. */
export interface FindingDialogOwner {
  readonly kind: FindingDialogKind;
  readonly owner: SemanticAddress;
}

/** One findings-panel entry; a dialog owner's inner reasons fold into it. */
export interface RepairEntryPresentation extends FindingPresentation {
  readonly dialog?: FindingDialogOwner;
  readonly innerFindingCount?: number;
}

/** Candidate-only trait findings reuse the engine's semantic finding codes. */
export type TraitCandidateFindingCode = FindingCode | 'duplicateOfferedTrait';

export interface StatusPresentation {
  readonly label: string;
  readonly tone: 'blocked' | 'empty' | 'incomplete' | 'invalid' | 'valid';
}

export type BiomeFeedbackContext = 'blocked' | 'complete' | 'prefix' | 'unassessed';

export interface BiomeFeedbackPresentation {
  readonly biomeKey: string;
  readonly blockedByBiomeKey?: string;
  readonly context: BiomeFeedbackContext;
  readonly findingCount: number;
  readonly status: StatusPresentation;
}

export interface RouteFeedbackPresentation {
  readonly biomes: ReadonlyMap<string, BiomeFeedbackPresentation>;
  readonly findingCount: number;
  readonly routeKey: string;
  readonly status: StatusPresentation;
}

export interface ProjectFeedbackPresentation {
  readonly findingCount: number;
  readonly route: RouteFeedbackPresentation;
  readonly status: StatusPresentation;
}

export type BiomeStatusEvaluation =
  | {
      readonly authoring: 'incomplete';
      readonly validity?: 'invalid';
      readonly requiredInput?: unknown;
    }
  | {
      readonly authoring: 'complete';
      readonly validity: 'invalid' | 'valid';
      readonly requiredInput?: unknown;
    };

const embryoBlessingMissing = Object.freeze({ title: 'Choose Embryo blessing' });
const embryoBlessingUnavailable = Object.freeze({ title: 'Embryo blessing unavailable' });

const findingCopy = {
  batchRewardStoreMissing: {
    title: 'Choose a reward pool',
  },
  batchStateMissing: {
    title: 'Configure doors',
  },
  biomeFieldMissing: {
    title: 'Choose a biome setting',
  },
  fieldsCageOutcomeUnavailable: {
    title: 'Fields door roll unavailable',
  },
  biomeTopologyMissing: {
    title: 'Create the opening room',
  },
  continuationMissing: {
    title: 'Open the next room from the Hub',
  },
  hubOpenSetIncomplete: {
    title: 'Choose open Hub rooms',
  },
  hubVisitOrderIncomplete: {
    title: 'Plan Hub visits and use the fountain',
  },
  hubOpenSlotUnavailable: {
    title: 'Hub rooms conflict',
  },
  pickedTargetMissing: {
    title: 'Choose the door taken',
  },
  targetMissing: {
    title: 'Choose a room',
  },
  targetRoomSupportEmpty: {
    title: 'No eligible room',
  },
  targetRoomUnavailable: {
    title: 'Door cannot offer this room',
  },
  encounterUnavailable: {
    title: 'Encounter unavailable',
  },
  encounterCustomizationUnavailable: {
    title: 'Encounter customization unavailable',
    description: 'Fix it or reset the customization.',
  },
  encounterCustomizationRequired: {
    title: 'Customize this encounter',
    description: 'Fresh File plans require customized encounters.',
  },
  encounterIntroductionRequired: {
    title: 'Enemy not introduced',
    description: 'Select its introduction encounter or remove the enemy.',
  },
  encounterSlotActivationUnavailable: {
    title: 'Encounter phase inactive',
    description: 'The room setup does not activate this phase.',
  },
  sideRoomGenerationUnavailable: {
    title: 'Side room generation unavailable',
    description: 'Check the open Hub rooms.',
  },
  baseRewardStoreUnavailable: {
    title: 'Reward pool unavailable',
  },
  rewardAcquisitionUnavailable: {
    title: 'Reward cannot be acquired',
  },
  rewardBagSupportEmpty: {
    title: 'No reward available from pool',
  },
  rewardBagEntryUnavailable: {
    title: 'Reward unavailable from pool',
  },
  rewardPayloadInvalid: {
    title: 'Invalid reward details',
  },
  rewardMissing: {
    title: 'Choose a reward',
  },
  traitOfferMissing: {
    title: 'Choose a trait offer',
  },
  rewardSourceUnavailable: {
    title: 'Reward source unavailable',
  },
  shopOfferUnavailable: {
    title: 'Shop offers conflict',
  },
  shopPurchaseUnavailable: {
    title: 'Purchase order unavailable',
  },
  alreadyEquipped: {
    title: 'Trait already equipped',
  },
  previouslyPicked: {
    title: 'One-time trait already picked',
  },
  missingPrerequisite: {
    title: 'Missing trait prerequisite',
  },
  negativePrerequisite: {
    title: 'Conflicting trait equipped',
  },
  offerContext: {
    title: 'Trait unavailable in this offer',
  },
  elementThreshold: {
    title: 'Not enough elements',
  },
  rarityCount: {
    title: 'Boon rarity requirement unmet',
  },
  rarifiableTarget: {
    title: 'No trait can be rarified',
  },
  targetedAcquisitionNoEligibleTarget: {
    title: 'No eligible target trait',
  },
  targetedAcquisitionTargetMissing: {
    title: 'Choose a target trait',
  },
  targetedAcquisitionTargetUnavailable: {
    title: 'Target trait unavailable',
  },
  occupiedBoonSlot: {
    title: 'Boon slot occupied',
  },
  freshRarityUnavailable: {
    title: 'Initial rarity unavailable',
  },
  rarityRollUnavailable: {
    title: 'Rarity unavailable in this offer',
  },
  replacementUnavailable: {
    title: 'Boon replacement unavailable',
    description: 'This god cannot replace the equipped boon.',
  },
  replacementMaximumRarity: {
    title: 'Heroic boon cannot be replaced',
  },
  replacementRarityMismatch: {
    title: 'Wrong replacement rarity',
    description: 'Use the next rarity above the equipped boon.',
  },
  wrongHammerLoadout: {
    title: 'Hammer incompatible with loadout',
  },
  missingPomTarget: {
    title: 'Choose a Pom target',
  },
  pomWrongOfferCount: {
    title: 'Wrong Pom target count',
  },
  pomSelectedTargetNotOffered: {
    title: 'Pom target was not offered',
  },
  pomTargetUnavailable: {
    title: 'Pom target unavailable',
  },
  judgmentOutcomeMissing: {
    title: 'Choose Judgment cards',
    description: 'Choose inactive Arcana.',
  },
  judgmentOutcomeWrongCardinality: {
    title: 'Wrong Judgment card count',
  },
  judgmentOutcomeTargetUnavailable: {
    title: 'Judgment card unavailable',
    description: 'Choose distinct eligible inactive Arcana.',
  },
  figurineOutcomeMissing: {
    title: 'Choose Crystal Figurine cards',
    description: 'Choose inactive Arcana.',
  },
  figurineOutcomeWrongCardinality: {
    title: 'Wrong Crystal Figurine card count',
  },
  figurineOutcomeTargetUnavailable: {
    title: 'Crystal Figurine card unavailable',
    description: 'Cards must still be inactive after Judgment.',
  },
  keepsakeUnavailable: {
    title: 'Keepsake unavailable',
  },
  erisSpawnUnavailable: {
    title: 'Eris cannot spawn again',
    description: 'Her curse is already on this run.',
  },
  keepsakeEquipResultMissing: {
    title: 'Choose the Hades trait from Jeweled Pom',
  },
  keepsakeEquipResultUnavailable: {
    title: 'Jeweled Pom result unavailable',
  },
  circeResolutionMissing: {
    title: "Choose the Arcana or Vow for Circe's trait",
  },
  circeResolutionWrongCardinality: {
    title: 'Wrong Circe target count',
  },
  circeResolutionTargetUnavailable: {
    title: 'Circe target unavailable',
  },
  circeOptionUnavailable: {
    title: 'Circe trait unavailable',
    description: 'No configured Vow can be removed.',
  },
  echoPomTargetMissing: {
    title: 'Choose Echo Pom target',
    description: 'Choose a highest-level Pom-eligible trait, or no target if none is eligible.',
  },
  echoPomNoTargetUnavailable: {
    title: 'Echo Pom needs a target',
    description: 'A Pom-eligible trait exists; choose one with the highest level.',
  },
  echoPomTargetUnavailable: {
    title: 'Echo Pom target unavailable',
    description: 'Choose a Pom-eligible trait with the highest level.',
  },
  echoLastRunBoonMissing: {
    title: 'Choose Boon Boon Boon outcomes',
    description: 'Choose one to three boons from the previous run.',
  },
  echoLastRunBoonOptionUnavailable: {
    title: 'Boon Boon Boon outcome unavailable',
  },
  traitOfferSelectionUnavailable: {
    title: 'Choose an offered trait',
  },
  allTogetherResultMissing: {
    title: 'Choose All Together traits',
    description: 'One for each element set.',
  },
  allTogetherResultUnavailable: {
    title: 'All Together outcome unavailable',
  },
  bannedTrait: {
    title: 'Trait banned by Denial',
    description: 'It was left unpicked in an earlier offer.',
  },
  chaosRejectedBlockMissing: {
    title: "Choose Rejected's blocked option",
    description: 'It must be visible and not your pick.',
  },
  chaosRejectedBlockUnavailable: {
    title: 'Invalid Rejected block',
    description: 'The blocked option must be visible and cannot be your pick.',
  },
  chaosPairUnavailable: {
    title: 'Chaos pair unavailable',
    description: 'A run prerequisite is unmet.',
  },
  callingCardRarificationUnavailable: {
    title: 'Calling Card rarification unavailable',
  },
  timePieceConversionUnavailable: {
    title: 'Time Piece conversion unavailable',
    description: 'Requires an eligible free pickup and a remaining charge.',
  },
  artificerConversionUnavailable: {
    title: 'Artificer conversion unavailable',
    description: 'Requires an eligible free minor reward and a remaining use.',
  },
  seaStarDuplicationUnavailable: {
    title: 'Sea Star cannot duplicate this pickup',
  },
  concaveStoneResultMissing: {
    title: 'Choose Concave Stone result',
  },
  concaveStoneResultUnavailable: {
    title: 'Concave Stone result unavailable',
    description: 'It must be an unpicked boon from the offer.',
  },
  artificerReplacementUnavailable: {
    title: 'Artificer reward unavailable',
    description: 'Choose from the current major reward pool.',
  },
  figLeafSkipUnavailable: {
    title: 'Fig Leaf skip unavailable',
  },
  gorgonConditionUnavailable: {
    title: 'Gorgon Amulet cannot trigger',
    description: 'This encounter setup does not allow it.',
  },
  aetosAppearanceUnavailable: {
    title: 'Aetos appearance unavailable',
    description: 'Use a supported wave in an eligible encounter; Olympus allows one appearance.',
  },
  naturalSelectionResultMissing: {
    title: 'Choose Natural Selection targets',
  },
  naturalSelectionResultUnavailable: {
    title: 'Natural Selection targets unavailable',
    description: 'Each target must be eligible when its turn is reached.',
  },
  steadyGrowthOutcomeMissing: {
    title: 'Choose Steady Growth target',
  },
  steadyGrowthOutcomeUnavailable: {
    title: 'Steady Growth target unavailable',
    description: 'Choose a trait that can gain rarity.',
  },
  transcendentEmbryoOutcomeMissing: embryoBlessingMissing,
  transcendentEmbryoOutcomeUnavailable: embryoBlessingUnavailable,
  fountainRarityResultMissing: {
    title: 'Choose Aromatic Phial target',
    description: 'Choose a Common boon.',
  },
  fountainRarityResultUnavailable: {
    title: 'Aromatic Phial target unavailable',
    description: 'Choose a Common boon eligible at this fountain.',
  },
  fieldsOptionalCapacityUnavailable: {
    title: 'Nemesis needs a reward position',
    description: 'Remove one optional reward.',
  },
  fieldsSpatialPointMissing: {
    title: 'Choose a Fields position',
  },
  fieldsSpatialPointUnavailable: {
    title: 'Fields position unavailable',
  },
  fieldsSpatialPointDuplicate: {
    title: 'Fields position already used',
  },
  resourcePlacementUnavailable: {
    title: 'Resource success unavailable',
    description: 'It must satisfy room, spacing, and placement limits.',
  },
  purgingPoolTraitMissing: {
    title: 'Choose a Pool of Purging trait',
  },
  purgingPoolTraitUnavailable: {
    title: 'Pool of Purging trait unavailable',
  },
  purgingPoolTraitDuplicate: {
    title: 'Duplicate Pool of Purging trait',
  },
  purgingPoolUnavailable: {
    title: 'Pool of Purging unavailable on this route',
  },
  hermesShrinePlacementUnavailable: {
    title: 'Shrine placement unavailable',
    description: 'Remove the Shrine or choose an eligible room.',
  },
  hermesShrineInventoryMissing: {
    title: 'Choose a Shrine offer',
  },
  hermesShrineInventoryWrongGroup: {
    title: 'Wrong Shrine offer group',
  },
  hermesShrineInventoryDuplicate: {
    title: 'Duplicate Shrine offer',
    description: 'This offer repeats the other second-group offer.',
  },
  hermesShrineInventoryRequirement: {
    title: 'Shrine offer unavailable',
  },
  hermesShrineDeliveryPlacementRequired: {
    title: 'Restore Shrine delivery',
  },
  echoGoldPickupPlacementRequired: {
    title: 'Restore Gold Gold Gold pickup',
  },
  roomActionOrderUnavailable: {
    title: 'Action out of order',
  },
  roomActionPlacementRequired: {
    title: 'Restore required action',
  },
  hermesShrineTravelDealRefillMissing: {
    title: 'Choose Travel Deal offer',
  },
  hermesShrineTravelDealRefillUnavailable: {
    title: 'Travel Deal offer unavailable',
    description: 'Check the purchase that triggers it.',
  },
  stygianWellMissing: {
    title: 'Choose a Well offer',
  },
  stygianWellWrongGroup: {
    title: 'Wrong Well offer group',
  },
  stygianWellDuplicate: {
    title: 'Duplicate Well item',
  },
  stygianWellPlacementUnavailable: {
    title: 'Well placement unavailable',
    description: 'Check room eligibility and spacing between Wells.',
  },
  stygianWellTravelDealRefillUnavailable: {
    title: 'Well Travel Deal offer unavailable',
    description: 'Check the first purchase that triggers it.',
  },
  stygianWellTwistInvalid: {
    title: 'Fateful Twist result unavailable',
    description: 'Check the result and whether Fateful Twist was purchased.',
  },
  ixionChaosMissing: {
    title: "Add Ixion's Chaos gate",
    description: 'Use the first room that can offer a Chaos exit.',
  },
  ixionChaosUnavailable: {
    title: "Ixion's Chaos gate unavailable",
    description: 'Remove the gate or restore the pending Ixion effect.',
  },
  nemesisOutcomeMissing: {
    title: 'Choose Nemesis event result',
  },
  nemesisOutcomeUnavailable: {
    title: 'Nemesis event result unavailable',
  },
  persephoneLevelBonusUnavailable: {
    title: 'Persephone roll unavailable',
  },
  traitOfferGenerationUnavailable: {
    title: 'Trait choices cannot appear together',
  },
  unsupportedSparseTraitOffer: {
    title: 'Offer requires three choices',
  },
} as const satisfies Readonly<Record<FindingCode, FindingPresentation>>;

const projectStatusCopy = {
  empty: { label: 'Empty project', tone: 'empty' },
  incomplete: { label: 'Incomplete', tone: 'incomplete' },
  invalid: { label: 'Invalid', tone: 'invalid' },
  valid: { label: 'Valid', tone: 'valid' },
} as const satisfies Readonly<Record<ProjectEvaluation['status'], StatusPresentation>>;

const routeStatusCopy = {
  empty: { label: 'Not configured', tone: 'empty' },
  incomplete: { label: 'Incomplete', tone: 'incomplete' },
  invalid: { label: 'Invalid', tone: 'invalid' },
  valid: { label: 'Valid', tone: 'valid' },
} as const satisfies Readonly<Record<ProjectRouteEvaluation['status'], StatusPresentation>>;

const incompleteBiomeStatus = Object.freeze({
  label: 'Incomplete',
  tone: 'incomplete',
} as const satisfies StatusPresentation);
const invalidIncompleteBiomeStatus = Object.freeze({
  label: 'Invalid',
  tone: 'invalid',
} as const satisfies StatusPresentation);
const validBiomeStatus = Object.freeze({
  label: 'Complete · Valid',
  tone: 'valid',
} as const satisfies StatusPresentation);
const invalidBiomeStatus = Object.freeze({
  label: 'Complete · Invalid',
  tone: 'invalid',
} as const satisfies StatusPresentation);
const blockedBiomeStatus = Object.freeze({
  label: 'Blocked',
  tone: 'blocked',
} as const satisfies StatusPresentation);
const projectFeedbackCache = new WeakMap<ProjectEvaluation, ProjectFeedbackPresentation>();

export function indexFindingsByOwner(findings: readonly SemanticFinding[]): FindingIndex {
  const mutable = new Map<string, SemanticFinding[]>();
  for (const finding of findings) {
    const key = semanticAddressKey(finding.origin);
    const indexed = mutable.get(key);
    if (indexed === undefined) {
      mutable.set(key, [finding]);
    } else {
      indexed.push(finding);
    }
  }
  return new Map([...mutable].map(([key, indexed]) => [key, Object.freeze(indexed)] as const));
}

export function isChaosGatePositionFinding(finding: SemanticFinding): boolean {
  return (
    finding.code === 'targetRoomUnavailable' &&
    finding.origin.kind === 'additionalExit' &&
    Array.isArray(finding.evidence.failedConditions) &&
    finding.evidence.failedConditions.includes('spawnPointIndex')
  );
}

function count(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

export function presentFinding(finding: SemanticFinding): FindingPresentation {
  if (finding.code === 'hubOpenSetIncomplete') {
    const min = count(finding.evidence.minimumCount);
    const max = count(finding.evidence.maximumCount);
    if (min !== undefined && max !== undefined) {
      return Object.freeze({
        title: `Open ${min === max ? min : `${min}–${max}`} Hub rooms`,
      });
    }
  }
  if (finding.code === 'hubVisitOrderIncomplete') {
    const required = count(finding.evidence.requiredCount);
    const actual = count(finding.evidence.actualCount);
    if (required !== undefined && actual !== undefined) {
      return Object.freeze({
        title:
          actual >= required
            ? 'Use the Hub fountain'
            : finding.evidence.fountainUsed === true
              ? `Plan ${required} Hub visits`
              : `Plan ${required} Hub visits and use the fountain`,
      });
    }
  }
  if (finding.code === 'targetRoomUnavailable' && 'anomalyReplacement' in finding.evidence) {
    return Object.freeze({ title: 'Anomaly cannot occur here' });
  }
  if (
    finding.code === 'targetRoomUnavailable' &&
    Array.isArray(finding.evidence.exclusionReasons) &&
    finding.evidence.exclusionReasons.includes('physicalExitUnavailable')
  ) {
    return Object.freeze({
      title: 'Saved door unavailable',
      description: 'Restore the source room’s doors or use Remove unavailable doors.',
    });
  }
  if (
    finding.code === 'shopPurchaseUnavailable' &&
    finding.evidence.kind === 'travelDealRefillUnavailable'
  ) {
    return Object.freeze({
      title: 'Travel Deal refill unavailable',
      description: 'Check its triggering purchase, or remove this refill.',
    });
  }
  if (finding.code === 'rewardSourceUnavailable') {
    if (finding.evidence.reason === 'staleHermesShrineDelivery') {
      return Object.freeze({ title: 'Shrine delivery is not due here' });
    }
    if (finding.evidence.reason === 'staleClockedTraitPickup') {
      return Object.freeze({ title: 'Supply Chain pickup cannot occur here' });
    }
  }
  if (finding.code === 'roomActionOrderUnavailable') {
    if (finding.evidence.reason === 'dependency' && finding.evidence.checkpointUnavailable === true)
      return Object.freeze({ title: 'Room phase for this action is gone' });
    return Object.freeze({
      title: 'Action out of order',
      description:
        finding.evidence.reason === 'dependency'
          ? finding.evidence.dependencyKind === 'beforeCheckpoint'
            ? 'Move it before its required checkpoint.'
            : 'Move it after its prerequisite.'
          : 'Move it into its allowed room phase.',
    });
  }
  if (isChaosGatePositionFinding(finding)) {
    return Object.freeze({
      title: 'Chaos gate position unavailable',
      description: 'Choose Any or a numbered position on the source room map.',
    });
  }
  if (finding.origin.kind === 'keepsakeEquipResult') {
    if (finding.origin.resultKind === 'experimentalHammer') {
      if (finding.code === 'keepsakeEquipResultMissing') {
        return Object.freeze({
          title: 'Choose Experimental Hammer result',
        });
      }
      if (finding.code === 'keepsakeEquipResultUnavailable') {
        return Object.freeze({
          title: 'Experimental Hammer unavailable',
          description: 'Choose a Hammer compatible with the weapon and aspect.',
        });
      }
    }
    if (finding.origin.resultKind === 'transcendentEmbryo') {
      if (finding.code === 'keepsakeEquipResultMissing') return embryoBlessingMissing;
      if (finding.code === 'keepsakeEquipResultUnavailable') return embryoBlessingUnavailable;
    }
  }
  return findingCopy[finding.code];
}

export function formatFindingExplanation(copy: FindingPresentation): string {
  return copy.description === undefined ? copy.title : `${copy.title}: ${copy.description}`;
}

/** The explanation as one sentence, so several can be joined with spaces. */
export function formatFindingSentence(copy: FindingPresentation): string {
  const text = formatFindingExplanation(copy);
  return text.endsWith('.') ? text : `${text}.`;
}

const dialogKindCopy = {
  traitOffer: 'Trait offer',
  encounterCustomization: 'Encounter customization',
  levelResolution: 'Pom resolution',
} as const satisfies Readonly<Record<FindingDialogKind, string>>;

/** Leading words that are ordinary language rather than game names. */
const ordinaryLead =
  /^(?:Choose|Customize|Wrong|Trait|One-time|Missing|Conflicting|Not|No|Target|Initial|Rarity|Heroic|Invalid|Encounter|Enemy|Offer|Duplicate|Boon(?! Boon Boon))\b/;

/** An inner finding's title continuing its dialog's name, e.g. "Trait offer: wrong replacement rarity". */
/** Dialog card titles for inner findings whose own title already names the dialog's action. */
const dialogTitleByCode: {
  readonly [Kind in FindingDialogKind]?: Partial<Record<FindingCode, string>>;
} = {
  encounterCustomization: {
    encounterCustomizationRequired: 'Encounter customization required',
    encounterCustomizationUnavailable: 'Encounter customization unavailable',
  },
};

function dialogTitle(kind: FindingDialogKind, finding: SemanticFinding): string {
  const mapped = dialogTitleByCode[kind]?.[finding.code];
  if (mapped !== undefined) return mapped;
  const title = presentFinding(finding).title;
  const inner = ordinaryLead.test(title) ? `${title[0]!.toLowerCase()}${title.slice(1)}` : title;
  return `${dialogKindCopy[kind]}: ${inner}`;
}

/** A same-code group's title with its count, where the title has a natural plural. */
const countedTitles: Partial<Record<FindingCode, (count: number) => string>> = {
  fieldsSpatialPointMissing: (n) => `Choose ${n} Fields positions`,
  fieldsSpatialPointUnavailable: (n) => `${n} Fields positions unavailable`,
  fieldsSpatialPointDuplicate: (n) => `${n} Fields positions already used`,
  rewardMissing: (n) => `Choose ${n} rewards`,
  targetMissing: (n) => `Choose ${n} rooms`,
  traitOfferMissing: (n) => `Choose ${n} trait offers`,
  roomActionOrderUnavailable: (n) => `${n} actions out of order`,
  roomActionPlacementRequired: (n) => `Restore ${n} required actions`,
  purgingPoolTraitMissing: (n) => `Choose ${n} Pool of Purging traits`,
  hermesShrineInventoryMissing: (n) => `Choose ${n} Shrine offers`,
  stygianWellMissing: (n) => `Choose ${n} Well offers`,
};

function dialogKindOf(owner: SemanticAddress): FindingDialogKind | undefined {
  switch (owner.kind) {
    case 'traitOffer':
      return 'traitOffer';
    case 'encounterPhase':
      return 'encounterCustomization';
    case 'levelResolution':
      return 'levelResolution';
    default:
      return undefined;
  }
}

/**
 * An issue at a dialog launcher folds its inner reasons into one outer entry.
 * A reason is inner when its origin lies beneath the issue owner, or when a
 * same-origin reason carries dialog-level evidence by the engine's convention:
 * `traitKey`/`optionKey` name one offer option, `decisionKey` names one
 * encounter customization decision, and any level-resolution reason is a Pom
 * target. Reasons describing the launcher's own value stay outer.
 */
export function findingDialogOwner(
  issue: Pick<AssessmentIssue, 'owner'>,
  reason: SemanticFinding,
): FindingDialogOwner | undefined {
  const owner = issue.owner;
  const kind = dialogKindOf(owner);
  if (kind === undefined) return undefined;
  if (semanticAddressKey(reason.origin) !== semanticAddressKey(owner)) return { kind, owner };
  const inner =
    kind === 'traitOffer'
      ? 'traitKey' in reason.evidence || 'optionKey' in reason.evidence
      : kind === 'encounterCustomization'
        ? 'decisionKey' in reason.evidence
        : true;
  return inner ? { kind, owner } : undefined;
}

/**
 * The engine selects the repair region; presentation only adapts its explanation.
 * `repairTarget` names the control that repairs a reason, as the workspace marks it.
 */
export function presentAssessmentIssue(
  issue: AssessmentIssue,
  repairTarget: (finding: SemanticFinding) => string,
): RepairEntryPresentation {
  const reason = issue.reasons[0];
  if (reason === undefined) {
    throw new Error(`Assessment issue ${issue.regionKey} has no reason`);
  }
  const inner = issue.reasons.flatMap((candidate) => {
    const dialog = findingDialogOwner(issue, candidate);
    return dialog === undefined ? [] : [{ dialog, finding: candidate }];
  });
  const first = inner[0];
  if (first !== undefined) {
    const more = inner.length - 1;
    const description =
      more === 0 ? presentFinding(first.finding).description : `+${more} more in its editor`;
    return Object.freeze({
      title: dialogTitle(first.dialog.kind, first.finding),
      ...(description === undefined ? {} : { description }),
      dialog: first.dialog,
      innerFindingCount: inner.length,
    });
  }
  const copy = presentFinding(reason);
  const targets = new Set(issue.reasons.map(repairTarget));
  if (targets.size === 1) return copy;
  // One code repaired at several controls reads as a count where its title has a plural.
  const counted = issue.reasons.every((finding) => finding.code === reason.code)
    ? countedTitles[reason.code]
    : undefined;
  return Object.freeze(
    counted === undefined
      ? { title: copy.title, description: `+${targets.size - 1} more to repair here` }
      : { title: counted(targets.size) },
  );
}

/**
 * Present an engine candidate finding without re-running its eligibility
 * policy. Candidate findings are not project findings, so they do not have a
 * SemanticFinding origin to pass through `presentFinding`.
 */
export function presentTraitCandidateFinding(code: TraitCandidateFindingCode): FindingPresentation {
  if (code === 'duplicateOfferedTrait') {
    return {
      title: 'Trait already offered',
    };
  }
  return findingCopy[code];
}

export function semanticFindingKey(finding: SemanticFinding): string {
  return JSON.stringify([
    finding.code,
    finding.phase,
    semanticAddressKey(finding.origin),
    finding.evidence,
  ]);
}

export function presentProjectStatus(evaluation: ProjectEvaluation): StatusPresentation {
  return projectStatusCopy[evaluation.status];
}

export function presentRouteStatus(evaluation: ProjectRouteEvaluation): StatusPresentation {
  return routeStatusCopy[evaluation.status];
}

export function presentBiomeStatus(
  evaluation: BiomeStatusEvaluation | undefined,
): StatusPresentation {
  if (evaluation === undefined) {
    return blockedBiomeStatus;
  }
  if (evaluation.requiredInput !== undefined) return incompleteBiomeStatus;
  if (evaluation.authoring === 'incomplete') {
    return evaluation.validity === 'invalid' ? invalidIncompleteBiomeStatus : incompleteBiomeStatus;
  }
  return evaluation.validity === 'valid' ? validBiomeStatus : invalidBiomeStatus;
}

function issueBelongsToBiome(
  issue: AssessmentIssue | undefined,
  routeKey: string,
  biomeKey: string,
): boolean {
  if (issue === undefined || !('routeKey' in issue.owner) || !('biomeKey' in issue.owner)) {
    return false;
  }
  return issue.owner.routeKey === routeKey && issue.owner.biomeKey === biomeKey;
}

function biomeFeedback(route: ProjectRouteEvaluation, biomeKey: string): BiomeFeedbackPresentation {
  const evaluation = route.biomes.find((candidate) => candidate.biomeKey === biomeKey);
  if (evaluation === undefined) {
    if (!route.processing.blockedSuffix.includes(biomeKey)) {
      throw new Error(`${route.routeKey} biome ${biomeKey} has no evaluation or blocked region`);
    }
    return Object.freeze({
      biomeKey,
      ...(route.processing.active === null
        ? {}
        : { blockedByBiomeKey: route.processing.active.biomeKey }),
      context: 'blocked',
      findingCount: 0,
      status: blockedBiomeStatus,
    });
  }
  const context: BiomeFeedbackContext =
    evaluation.coverage.kind === 'complete'
      ? 'complete'
      : evaluation.coverage.kind === 'prefix'
        ? 'prefix'
        : 'unassessed';
  return Object.freeze({
    biomeKey,
    context,
    findingCount: issueBelongsToBiome(route.issue, route.routeKey, biomeKey) ? 1 : 0,
    status: presentBiomeStatus(evaluation),
  });
}

export function projectFeedbackHierarchy(
  evaluation: ProjectEvaluation,
): ProjectFeedbackPresentation {
  const existing = projectFeedbackCache.get(evaluation);
  if (existing !== undefined) {
    return existing;
  }
  const route = evaluation.route;
  const biomes = new Map(
    route.configuredBiomeKeys.map(
      (biomeKey) => [biomeKey, biomeFeedback(route, biomeKey)] as const,
    ),
  );
  const routeFeedback = Object.freeze({
    biomes,
    findingCount: route.issue === undefined ? 0 : 1,
    routeKey: route.routeKey,
    status: presentRouteStatus(route),
  });
  const projected = Object.freeze({
    findingCount: evaluation.issue === undefined ? 0 : 1,
    route: routeFeedback,
    status: presentProjectStatus(evaluation),
  });
  projectFeedbackCache.set(evaluation, projected);
  return projected;
}

/**
 * The findings-panel entry for a biome whose view is blocked or not yet
 * evaluated; `blockedAt` names the blocking owner's destination.
 */
export function presentBlockedView(
  catalog: Catalog,
  feedback: BiomeFeedbackPresentation,
  blockedAt: string | undefined,
): FindingPresentation | undefined {
  const biome = catalog.biomes.byKey[feedback.biomeKey];
  if (biome === undefined) {
    throw new Error(`Feedback references unknown biome ${feedback.biomeKey}`);
  }
  if (feedback.context === 'unassessed') {
    return Object.freeze({ title: `${biome.label} is not evaluated yet` });
  }
  if (feedback.context !== 'blocked') {
    return undefined;
  }
  const blocker =
    feedback.blockedByBiomeKey === undefined
      ? undefined
      : catalog.biomes.byKey[feedback.blockedByBiomeKey];
  if (feedback.blockedByBiomeKey !== undefined && blocker === undefined) {
    throw new Error(`Feedback references unknown blocking biome ${feedback.blockedByBiomeKey}`);
  }
  return Object.freeze({
    title:
      blockedAt === undefined
        ? `${biome.label} is blocked`
        : `${biome.label} is blocked at ${blockedAt}`,
    description:
      blocker === undefined
        ? 'Finish the earlier biomes before this biome can be evaluated.'
        : `Finish and fix ${blocker.label} before ${biome.label} can be evaluated.`,
  });
}

/** The navigation intent for the route's next repair, shared by every entry point to it. */
export function nextRepairSelection(
  issue: AssessmentIssue,
  focusByOwner: ReadonlyMap<string, import('./structured-workspace').WorkspaceInspectorDestination>,
): FindingSelection {
  const destination = focusByOwner.get(semanticAddressKey(issue.owner));
  return {
    focusAddress: destination?.focusAddress ?? issue.owner,
    key: issue.regionKey,
    origin: issue.owner,
    ...(destination?.presentationPanel === undefined
      ? {}
      : { presentationPanel: { kind: destination.presentationPanel } as const }),
    // Selection reaches an existing visible launcher. Dialogs remain explicit
    // local editing actions, including for trait offers.
    traitDialogTarget: null,
    levelResolutionDialogTarget: null,
  };
}

export function findingDestinationLabel(
  catalog: Catalog,
  origin: SemanticAddress,
  destination?: import('./structured-workspace').WorkspaceInspectorDestination,
  route?: import('./structured-workspace').WorkspaceRoute,
): string {
  if (
    destination?.presentationPanel === 'overview' ||
    !('biomeKey' in origin) ||
    origin.biomeKey === 'routeStart'
  ) {
    return origin.kind === 'project' ? 'Project' : 'Loadout';
  }
  const biome = catalog.biomes.byKey[origin.biomeKey];
  if (biome === undefined) {
    throw new Error(`Finding references unknown biome ${origin.biomeKey}`);
  }
  const workspaceBiome = route?.biomes.find((value) => value.biomeKey === origin.biomeKey);
  const railKey = destination?.selectedRailKey;
  const frontier = workspaceBiome?.frontier;
  // An uncreated outgoing decision is edited from its existing predecessor,
  // not from a numbered decision that has yet to be authored.
  const predecessorNodeKey =
    frontier?.kind === 'exitDecision' && frontier.marker.focusKey === railKey
      ? frontier.predecessorNodeKey
      : undefined;
  if (railKey !== undefined) {
    for (const entry of workspaceBiome?.rail ?? []) {
      if (
        entry.kind !== 'frontier' &&
        (entry.marker.focusKey === railKey || entry.node.key === predecessorNodeKey)
      ) {
        return `${biome.label} · ${entry.kind === 'hubGroup' ? 'Hub' : entry.label}`;
      }
      if (entry.kind === 'hubGroup') {
        for (const visit of entry.visits) {
          if (visit.marker.focusKey === railKey || visit.node.key === predecessorNodeKey)
            return `${biome.label} · ${visit.label}`;
          const sideVisit = visit.sideVisits.find(
            (side) => side.marker.focusKey === railKey || side.node.key === predecessorNodeKey,
          );
          if (sideVisit !== undefined) return `${biome.label} · ${sideVisit.label}`;
        }
      }
    }
  }
  return biome.label;
}
