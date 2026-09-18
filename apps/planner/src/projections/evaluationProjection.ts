import { semanticAddressKey, type SemanticAddress } from '@run-planner/engine/authored-project';
import { type Catalog } from '@run-planner/engine/catalog-schema';
import {
  type AssessmentIssue,
  type FindingCode,
  type ProjectEvaluation,
  type ProjectRouteEvaluation,
  type SemanticFinding,
} from '@run-planner/engine/simulation';

export type FindingIndex = ReadonlyMap<string, readonly SemanticFinding[]>;

export interface FindingPresentation {
  readonly title: string;
  readonly description?: string;
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
    description: 'Choose an available Min or Max outcome.',
  },
  biomeTopologyMissing: {
    title: 'Create the opening room',
  },
  continuationMissing: {
    title: 'Continue route',
  },
  hubOpenSetIncomplete: {
    title: 'Choose open Hub rooms',
    description: 'Open nine or ten rooms.',
  },
  hubVisitOrderIncomplete: {
    title: 'Choose six Hub visits',
    description: 'Visit six different open rooms.',
  },
  hubOpenSlotUnavailable: {
    title: 'Hub rooms conflict',
  },
  pickedShopStateMissing: {
    title: 'Complete Shop inventory',
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
    title: 'Room unavailable',
  },
  encounterUnavailable: {
    title: 'Encounter unavailable',
  },
  encounterCustomizationUnavailable: {
    title: 'Encounter customization unavailable',
    description: 'Choose an available result or restore Default.',
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
    description: 'Choose from the recorded targets.',
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
  keepsakeEquipResultMissing: {
    title: 'Choose Jeweled Pom result',
    description: 'Choose the granted Hades trait.',
  },
  keepsakeEquipResultUnavailable: {
    title: 'Jeweled Pom result unavailable',
  },
  circeResolutionMissing: {
    title: "Choose Circe's outcome",
    description: 'Choose the Arcana or Vow affected by this trait.',
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
    title: 'Complete All Together',
    description: 'Choose a trait for each element set.',
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
    description: 'Choose a visible option other than your pick.',
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
    title: 'Sea Star duplication unavailable',
  },
  concaveStoneResultMissing: {
    title: 'Choose Concave Stone result',
  },
  concaveStoneResultUnavailable: {
    title: 'Concave Stone result unavailable',
    description: 'Choose an eligible unpicked boon from the offer.',
  },
  artificerReplacementUnavailable: {
    title: 'Artificer reward unavailable',
    description: 'Choose from the current major reward pool.',
  },
  figLeafSkipUnavailable: {
    title: 'Fig Leaf skip unavailable',
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
  transcendentEmbryoOutcomeMissing: {
    title: 'Choose Embryo blessing',
  },
  transcendentEmbryoOutcomeUnavailable: {
    title: 'Embryo blessing unavailable',
  },
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
    description: 'Move or remove the success to satisfy room, spacing, and placement limits.',
  },
  purgingPoolTraitMissing: {
    title: 'Choose a Pool trait',
  },
  purgingPoolTraitUnavailable: {
    title: 'Pool trait unavailable',
  },
  purgingPoolTraitDuplicate: {
    title: 'Duplicate Pool trait',
  },
  purgingPoolWrongCardinality: {
    title: 'Wrong Pool offer count',
  },
  purgingPoolSaleUnavailable: {
    title: 'Pool sale unavailable',
    description: 'Remove the sale or restore its eligible trait.',
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
    description: 'Choose an offer allowed in this slot.',
  },
  hermesShrineInventoryDuplicate: {
    title: 'Duplicate Shrine offer',
    description: 'The two second-group offers must differ.',
  },
  hermesShrineInventoryRequirement: {
    title: 'Shrine offer unavailable',
  },
  hermesShrineDeliveryPlacementRequired: {
    title: 'Place Shrine delivery',
    description: 'Place it in its delivery room before choosing its outcome.',
  },
  echoGoldPickupPlacementRequired: {
    title: 'Place Echo Gold pickup',
    description: 'Place it on the timeline before choosing its outcome.',
  },
  hermesShrineTravelDealRefillMissing: {
    title: 'Choose Travel Deal offer',
  },
  hermesShrineTravelDealRefillUnavailable: {
    title: 'Travel Deal offer unavailable',
    description: 'Check the offer and the purchase that triggers it.',
  },
  stygianWellMissing: {
    title: 'Choose a Well offer',
  },
  stygianWellWrongGroup: {
    title: 'Wrong Well offer group',
    description: 'Choose an item allowed in this slot.',
  },
  stygianWellDuplicate: {
    title: 'Duplicate Well item',
    description: 'The three initial items must differ.',
  },
  stygianWellPlacementUnavailable: {
    title: 'Well placement unavailable',
    description: 'Check room eligibility and spacing between Wells.',
  },
  stygianWellTravelDealRefillUnavailable: {
    title: 'Well Travel Deal offer unavailable',
    description: 'Check the offer and the first purchase that triggers it.',
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
    title: 'Persephone bonus unavailable',
    description: 'Choose a value within the allowed range.',
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

export function presentFinding(finding: SemanticFinding): FindingPresentation {
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
      if (finding.code === 'keepsakeEquipResultMissing') {
        return Object.freeze({
          title: 'Choose Embryo blessing',
        });
      }
      if (finding.code === 'keepsakeEquipResultUnavailable') {
        return Object.freeze({
          title: 'Embryo blessing unavailable',
        });
      }
    }
  }
  return findingCopy[finding.code];
}

export function formatFindingExplanation(copy: FindingPresentation): string {
  return copy.description === undefined ? copy.title : `${copy.title}: ${copy.description}`;
}

/** The engine selects the repair region; presentation only adapts its explanation. */
export function presentAssessmentIssue(issue: AssessmentIssue): FindingPresentation {
  const reason = issue.reasons[0];
  if (reason === undefined) {
    throw new Error(`Assessment issue ${issue.regionKey} has no reason`);
  }
  return presentFinding(reason);
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

export function presentBiomeFeedbackContext(
  catalog: Catalog,
  feedback: BiomeFeedbackPresentation,
): string | undefined {
  const biome = catalog.biomes.byKey[feedback.biomeKey];
  if (biome === undefined) {
    throw new Error(`Feedback references unknown biome ${feedback.biomeKey}`);
  }
  if (feedback.context === 'unassessed') {
    return `${biome.label} is not evaluated yet.`;
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
  return blocker === undefined
    ? 'Finish the earlier biomes before this biome can be evaluated.'
    : `Finish and fix ${blocker.label} before ${biome.label} can be evaluated.`;
}

function numberedDestinationLabel(prefix: string, key: string): string {
  const suffix = key.match(/(\d+)$/)?.[1];
  return suffix === undefined ? prefix : `${prefix} ${Number(suffix)}`;
}

function localRewardDestinationLabel(groupKey: string, slotKey: string): string {
  switch (groupKey) {
    case 'cages':
      return `${numberedDestinationLabel('Cage', slotKey)} reward`;
    default:
      return numberedDestinationLabel('Room reward', slotKey);
  }
}

export function findingDestinationLabel(catalog: Catalog, origin: SemanticAddress): string {
  if (origin.kind === 'nemesisRandomEvent') return 'Nemesis event';
  if (origin.kind === 'project') {
    return 'Project';
  }
  if (origin.kind === 'route') {
    const route = catalog.routes.byKey[origin.routeKey];
    if (route === undefined) {
      throw new Error(`Finding references unknown route ${origin.routeKey}`);
    }
    return route.label;
  }
  if (origin.kind === 'keepsakeSelection' && origin.owner === 'routeStart')
    return 'Starting keepsake';
  if (origin.kind === 'keepsakeEquipResult')
    return origin.resultKind === 'jeweledPom'
      ? 'Jeweled Pom result'
      : origin.resultKind === 'experimentalHammer'
        ? 'Experimental Hammer result'
        : 'Transcendent Embryo result';
  if (origin.kind === 'fountainRarityOutcome') return 'Aromatic Phial fountain target';
  const biome = catalog.biomes.byKey[origin.biomeKey];
  if (biome === undefined) {
    throw new Error(`Finding references unknown biome ${origin.biomeKey}`);
  }
  const biomeLabel = biome.label;
  switch (origin.kind) {
    case 'biome':
      return biomeLabel;
    case 'biomeField':
      return `${biomeLabel} · Biome setting`;
    case 'exitDecision':
      return `${biomeLabel} · Door choice`;
    case 'exitSelection':
      return `${biomeLabel} · Door selection`;
    case 'batchRewardStore':
      return `${biomeLabel} · Reward pool`;
    case 'target': {
      const physicalIndex = /^exit(\d+)$/.exec(origin.exitKey)?.[1];
      return `${biomeLabel} · Door ${physicalIndex === undefined ? origin.exitKey : Number(physicalIndex)}`;
    }
    case 'additionalExit':
      return `${biomeLabel} · Special door`;
    case 'incomingReward':
      return `${biomeLabel} · Room reward`;
    case 'localReward':
      return `${biomeLabel} · ${localRewardDestinationLabel(origin.groupKey, origin.slotKey)}`;
    case 'roomAction':
      return `${biomeLabel} · Room action`;
    case 'travelDealRefillRealization':
      return `${biomeLabel} · Travel Deal refill`;
    case 'roomRunStateCheckpoint':
      return `${biomeLabel} · Run State`;
    case 'localVisitDecision':
      return `${biomeLabel} · Side rooms`;
    case 'localVisitSlot':
      return `${biomeLabel} · ${numberedDestinationLabel('Side room', origin.slotKey)}`;
    case 'localVisitOrder':
      return `${biomeLabel} · Side room order`;
    case 'encounterPhase':
      return `${biomeLabel} · Encounter`;
    case 'gorgonPhase':
      return `${biomeLabel} · Gorgon Athena`;
    case 'rewardWheel':
      return `${biomeLabel} · Reward wheel`;
    case 'rewardWheelOffer':
      return `${biomeLabel} · Reward wheel offer`;
    case 'hubOpenSet':
      return `${biomeLabel} · Open Hub rooms`;
    case 'hubDecision':
      return `${biomeLabel} · Hub`;
    case 'hubRoom':
      return `${biomeLabel} · Hub`;
    case 'hubSlot':
      return `${biomeLabel} · Hub room`;
    case 'hubVisit':
      return `${biomeLabel} · Visit ${origin.visitIndex}`;
    case 'occurrence':
      return `${biomeLabel} · Room`;
    case 'fieldsSpatial':
      return `${biomeLabel} · Fields layout`;
    case 'roomFeature':
      return `${biomeLabel} · Room feature`;
    case 'shopOffer':
      return `${biomeLabel} · Shop offer`;
    case 'acquisitionSite':
      return `${biomeLabel} · Room Timeline`;
    case 'acquisitionEntry':
      return `${biomeLabel} · Acquisition`;
    case 'traitOffer':
      return `${biomeLabel} · Trait offer`;
    case 'traitAcquisitionTarget':
      return `${biomeLabel} · Acquisition target`;
    case 'naturalSelectionResult':
      return `${biomeLabel} · Natural Selection result`;
    case 'steadyGrowthOutcome':
      return `${biomeLabel} · Steady Growth outcome`;
    case 'transcendentEmbryoOutcome':
      return `${biomeLabel} · Transcendent Embryo outcome`;
    case 'acquisitionRole':
      return `${biomeLabel} · Acquisition`;
    case 'circeResolution':
      return `${biomeLabel} · Circe outcome`;
    case 'echoPomTarget':
      return `${biomeLabel} · Pom Pom Pom target`;
    case 'echoLastRunBoon':
      return `${biomeLabel} · Boon Boon Boon outcomes`;
    case 'echoLastReward':
      return `${biomeLabel} · Reward Reward Reward replay`;
    case 'allTogetherSet':
      return `${biomeLabel} · All Together ${origin.setKey} set`;
    case 'echoKeepsakeReplay':
      return `${biomeLabel} · Gift Gift Gift replay`;
    case 'levelResolution':
      return `${biomeLabel} · Pom`;
    case 'judgmentArcana':
      return `${biomeLabel} · Boss Judgment`;
    case 'figurineArcana':
      return `${biomeLabel} · Boss Crystal Figurine`;
    case 'keepsakeSelection':
      return `${biomeLabel} · Postboss keepsake`;
  }
}
