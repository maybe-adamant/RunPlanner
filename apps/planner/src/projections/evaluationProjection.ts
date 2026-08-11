import { semanticAddressKey, type SemanticAddress } from '@run-planner/engine/authored-project';
import { type Catalog } from '@run-planner/engine/catalog-schema';
import {
  type FindingCode,
  type ProjectEvaluation,
  type ProjectRouteEvaluation,
  type SemanticFinding,
} from '@run-planner/engine/simulation';

export type FindingIndex = ReadonlyMap<string, readonly SemanticFinding[]>;

export interface FindingPresentation {
  readonly title: string;
  readonly description: string;
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
  readonly routes: ReadonlyMap<string, RouteFeedbackPresentation>;
  readonly status: StatusPresentation;
}

export type BiomeStatusEvaluation =
  | { readonly authoring: 'incomplete'; readonly validity?: 'invalid' }
  | { readonly authoring: 'complete'; readonly validity: 'invalid' | 'valid' };

const findingCopy = {
  batchRewardStoreMissing: {
    title: 'Choose a reward pool',
    description: 'Choose the reward pool before choosing rooms for these doors.',
  },
  batchStateMissing: {
    title: 'Finish setting up these doors',
    description: 'Choose the door setup before choosing rooms for these doors.',
  },
  biomeFieldMissing: {
    title: 'Choose the biome setting',
    description: 'Choose the required biome setting before building its doors.',
  },
  fieldsCageOutcomeUnavailable: {
    title: 'Fields door roll cannot occur here',
    description: 'The selected Min or Max outcome is unavailable at this point in the Fields.',
  },
  biomeTopologyMissing: {
    title: 'Start this biome',
    description: 'Choose a starting room before building its route.',
  },
  continuationMissing: {
    title: 'Continue this route',
    description: 'Continue from here to complete this route.',
  },
  hubOpenSetIncomplete: {
    title: 'Choose open Hub rooms',
    description: 'Choose nine or ten Ephyra rooms to keep open in the Hub.',
  },
  hubVisitOrderIncomplete: {
    title: 'Choose all six Hub visits',
    description: 'Choose six different open Hub rooms in the order you enter them.',
  },
  hubOpenSlotUnavailable: {
    title: 'Hub room cannot be open together',
    description: 'This Ephyra room cannot stay open with the selected Hub rooms.',
  },
  pickedShopStateMissing: {
    title: 'Finish setting up this Shop',
    description: 'Choose every Shop offer before continuing.',
  },
  pickedTargetMissing: {
    title: 'Choose the door taken',
    description: 'Choose the one door taken from these doors.',
  },
  targetMissing: {
    title: 'Choose a room for every door',
    description: 'Choose a room for this door.',
  },
  targetRoomSupportEmpty: {
    title: 'No room can appear here',
    description: 'The game has no room to offer when this door appears.',
  },
  targetRoomUnavailable: {
    title: 'Room cannot appear here',
    description: 'The selected room is not among the rooms that can be offered for this door.',
  },
  encounterUnavailable: {
    title: 'Encounter cannot occur here',
    description: 'The selected encounter is unavailable when this room begins.',
  },
  encounterSlotActivationUnavailable: {
    title: 'Encounter phase is not active',
    description: 'The selected room setup does not activate this encounter phase.',
  },
  sideRoomGenerationUnavailable: {
    title: 'Side room generation cannot occur here',
    description: 'This side-room setup is not available with the selected Hub rooms.',
  },
  baseRewardStoreUnavailable: {
    title: 'Reward pool cannot appear here',
    description:
      'The selected reward pool is not one of the available reward pools for these doors.',
  },
  rewardAcquisitionUnavailable: {
    title: 'Reward cannot be acquired',
    description: 'The selected reward cannot be acquired here.',
  },
  rewardBagSupportEmpty: {
    title: 'Reward pool has no possible offer',
    description: 'This reward pool cannot offer a reward here.',
  },
  rewardBagEntryUnavailable: {
    title: 'Reward is unavailable from this pool',
    description: 'The selected reward is not available from this reward pool.',
  },
  rewardPayloadInvalid: {
    title: 'Reward details are invalid',
    description: 'The selected reward and its configured details do not form a valid offer.',
  },
  rewardSourceUnavailable: {
    title: 'Reward source is unavailable',
    description: 'The selected reward source cannot be offered at this point in the route.',
  },
  shopOfferUnavailable: {
    title: 'Shop offer is unavailable',
    description: 'These Shop offers cannot appear together.',
  },
  shopPurchaseUnavailable: {
    title: 'Shop purchase is unavailable',
    description: 'The selected purchase order cannot be completed.',
  },
  alreadyEquipped: {
    title: 'Trait is already equipped',
    description: 'This trait cannot be offered again while it is equipped.',
  },
  missingPrerequisite: {
    title: 'Trait prerequisite is missing',
    description: 'The current equipped-trait history does not satisfy this prerequisite.',
  },
  negativePrerequisite: {
    title: 'Trait prerequisite is blocked',
    description: 'A trait that must be absent is currently equipped.',
  },
  offerContext: {
    title: 'Trait offer context is blocked',
    description: 'This trait is not legal in the current reward or room context.',
  },
  elementThreshold: {
    title: 'Element threshold is unmet',
    description: 'The equipped element totals are below this trait offer requirement.',
  },
  rarityCount: {
    title: 'Rarity threshold is unmet',
    description: 'The equipped god-boon rarity totals are outside this trait offer requirement.',
  },
  rarifiableTarget: {
    title: 'No rarifiable trait is equipped',
    description: 'This offer requires an equipped trait that can be rarified.',
  },
  targetedAcquisitionNoEligibleTarget: {
    title: 'No eligible acquisition target is equipped',
    description: 'This offer requires an equipped trait that can receive its acquisition effect.',
  },
  targetedAcquisitionTargetMissing: {
    title: 'Acquisition target is missing',
    description: 'Choose which eligible equipped trait received this acquisition effect.',
  },
  targetedAcquisitionTargetUnavailable: {
    title: 'Acquisition target is unavailable',
    description: 'The selected equipped trait cannot receive this acquisition effect.',
  },
  occupiedBoonSlot: {
    title: 'Ordinary boon slot is occupied',
    description: 'The ordinary boon slot for this trait already has an equipped trait.',
  },
  freshRarityUnavailable: {
    title: 'Fresh rarity is unavailable',
    description: 'This rarity is not offered when the trait is acquired fresh.',
  },
  rarityBelowActiveFloor: {
    title: 'Rarity is below the active floor',
    description: 'Proper Upbringing keeps fresh scalable god-trait offers at Rare or higher.',
  },
  replacementUnavailable: {
    title: 'Trait replacement is unavailable',
    description: 'This occupied boon slot cannot be replaced by the selected giver.',
  },
  replacementMaximumRarity: {
    title: 'Trait is already Heroic',
    description: 'A Heroic occupant has no supported replacement rarity.',
  },
  replacementRarityMismatch: {
    title: 'Replacement rarity is incorrect',
    description: 'Use the exact next rarity required by the occupied trait.',
  },
  replacementCompositionExceeded: {
    title: 'Too many replacements',
    description: 'This offer contains more replacements than its ordinary pool allows.',
  },
  wrongHammerLoadout: {
    title: 'Hammer is incompatible with this loadout',
    description: 'This Hammer trait does not support the selected weapon and aspect.',
  },
  nonPriorityTrait: {
    title: 'First Olympian offer needs a priority trait',
    description: 'Every option in the first Olympian offer must be a priority trait.',
  },
  missingAttackOrSpecial: {
    title: 'First Olympian offer needs Attack or Special',
    description: 'The first Olympian offer must include an Attack or Special trait.',
  },
  missingPomTarget: {
    title: 'Choose a Pom target',
    description: 'Record the trait that receives this Pom.',
  },
  pomWrongOfferCount: {
    title: 'Pom target count is incorrect',
    description: 'Use the complete target list available at this point.',
  },
  pomSelectedTargetNotOffered: {
    title: 'Pom target was not offered',
    description: 'Choose one of this Pom’s recorded targets.',
  },
  pomTargetUnavailable: {
    title: 'Pom target is unavailable',
    description: 'This trait cannot receive the Pom at this point in the route.',
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
  return findingCopy[finding.code];
}

/**
 * Present an engine candidate finding without re-running its eligibility
 * policy. Candidate findings are not project findings, so they do not have a
 * SemanticFinding origin to pass through `presentFinding`.
 */
export function presentTraitCandidateFinding(code: TraitCandidateFindingCode): FindingPresentation {
  if (code === 'duplicateOfferedTrait') {
    return {
      title: 'Trait is offered more than once',
      description: 'Each trait offer must contain three distinct alternatives.',
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
  if (evaluation.authoring === 'incomplete') {
    return evaluation.validity === 'invalid' ? invalidIncompleteBiomeStatus : incompleteBiomeStatus;
  }
  return evaluation.validity === 'valid' ? validBiomeStatus : invalidBiomeStatus;
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
    findingCount: evaluation.findings.length,
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
  const routes = new Map<string, RouteFeedbackPresentation>();
  for (const route of evaluation.routes) {
    const biomes = new Map(
      route.configuredBiomeKeys.map(
        (biomeKey) => [biomeKey, biomeFeedback(route, biomeKey)] as const,
      ),
    );
    routes.set(
      route.routeKey,
      Object.freeze({
        biomes,
        findingCount: route.findings.length,
        routeKey: route.routeKey,
        status: presentRouteStatus(route),
      }),
    );
  }
  const projected = Object.freeze({
    findingCount: evaluation.findings.length,
    routes,
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
    return `${biome.label} is not evaluated yet. You can still edit it.`;
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
    ? 'Finish the earlier biomes before this biome can be evaluated. You can still edit it.'
    : `Finish and fix ${blocker.label} before ${biome.label} can be evaluated. You can still edit it.`;
}

function numberedDestinationLabel(prefix: string, key: string): string {
  const suffix = key.match(/(\d+)$/)?.[1];
  return suffix === undefined ? prefix : `${prefix} ${Number(suffix)}`;
}

function localRewardDestinationLabel(groupKey: string, slotKey: string): string {
  switch (groupKey) {
    case 'cages':
      return `${numberedDestinationLabel('Cage', slotKey)} reward`;
    case 'sideRooms':
      return `${numberedDestinationLabel('Side room', slotKey)} reward`;
    default:
      return numberedDestinationLabel('Room reward', slotKey);
  }
}

export function findingDestinationLabel(catalog: Catalog, origin: SemanticAddress): string {
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
    case 'localChild':
      return `${biomeLabel} · ${numberedDestinationLabel('Side room', origin.slotKey)}`;
    case 'localChildGroup':
      return `${biomeLabel} · Side room order`;
    case 'encounterPhase':
      return `${biomeLabel} · Encounter`;
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
    case 'shopOffer':
      return `${biomeLabel} · Shop offer`;
    case 'acquisitionSite':
      return `${biomeLabel} · Acquisitions`;
    case 'acquisitionEntry':
      return `${biomeLabel} · Acquisition`;
    case 'traitOffer':
      return `${biomeLabel} · Trait offer`;
    case 'levelResolution':
      return `${biomeLabel} · Pom`;
    case 'completionRoom':
      return `${biomeLabel} · ${origin.role === 'boss' ? 'Boss' : 'Postboss'}`;
  }
}
