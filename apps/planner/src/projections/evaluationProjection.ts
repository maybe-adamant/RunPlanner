import { semanticAddressKey, type SemanticAddress } from '@run-planner/engine/authored-project';
import { type Catalog } from '@run-planner/engine/catalog-schema';
import {
  type FindingCode,
  type ProjectBiomeEvaluation,
  type ProjectEvaluation,
  type ProjectRouteEvaluation,
  type SemanticFinding,
} from '@run-planner/engine/simulation';

export type FindingIndex = ReadonlyMap<string, readonly SemanticFinding[]>;

export interface FindingPresentation {
  readonly title: string;
  readonly description: string;
}

export interface StatusPresentation {
  readonly label: string;
  readonly tone: 'blocked' | 'empty' | 'incomplete' | 'invalid' | 'valid';
}

const findingCopy = {
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
    description: 'Add another decision or finish the biome at Preboss.',
  },
  hubOpenSetIncomplete: {
    title: 'Complete the open Hub set',
    description: 'Select nine or ten fixed Ephyra slots for the persistent Hub board.',
  },
  hubVisitOrderIncomplete: {
    title: 'Complete the Hub visit order',
    description: 'Choose six distinct open pylon rooms in player entry order.',
  },
  hubOpenSlotUnavailable: {
    title: 'Hub room cannot be open together',
    description: 'This fixed Ephyra room conflicts with the selected persistent Hub open set.',
  },
  pickedShopStateMissing: {
    title: 'Configure the entered shop',
    description: 'The selected shop needs its complete inventory before simulation can continue.',
  },
  pickedTargetMissing: {
    title: 'Choose an entered exit',
    description: 'Select the one exit the player enters from this decision.',
  },
  targetMissing: {
    title: 'Specify every exit',
    description: 'Complete the missing offer for this physical exit.',
  },
  targetRoomSupportEmpty: {
    title: 'No room can appear here',
    description: 'The game has no eligible room for this exit at its generation point.',
  },
  targetRoomUnavailable: {
    title: 'Room cannot appear here',
    description: 'The selected room is outside the possible room set for this exit.',
  },
  encounterCountUnavailable: {
    title: 'Encounter count cannot occur here',
    description: 'The selected ship encounter count is unavailable when this room begins.',
  },
  sideRoomGenerationUnavailable: {
    title: 'Side room generation cannot occur here',
    description: 'The selected side-room outcome conflicts with Ephyra generation pressure.',
  },
  baseRewardStoreUnavailable: {
    title: 'Reward pool cannot appear here',
    description:
      'The selected reward pool is outside the possible store outcomes for this decision.',
  },
  rewardAcquisitionUnavailable: {
    title: 'Reward cannot be acquired',
    description: 'The selected reward cannot resolve at its acquisition point.',
  },
  rewardBagSupportEmpty: {
    title: 'Reward pool has no possible offer',
    description: 'The counted reward pool cannot produce any supported offer at this point.',
  },
  rewardBagEntryUnavailable: {
    title: 'Reward is unavailable from this pool',
    description: 'The selected reward is not available from the counted pool at this point.',
  },
  rewardPayloadInvalid: {
    title: 'Reward details are invalid',
    description: 'The selected reward and its configured details do not form a valid offer.',
  },
  rewardSourceUnavailable: {
    title: 'Reward source is unavailable',
    description: 'The configured reward source cannot be offered at this point in the route.',
  },
  shopOfferUnavailable: {
    title: 'Shop offer is unavailable',
    description: 'The configured shop inventory cannot be generated together at room entry.',
  },
  shopPurchaseUnavailable: {
    title: 'Shop purchase is unavailable',
    description: 'The selected purchases cannot be acquired in any valid purchase order.',
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
  evaluation: ProjectBiomeEvaluation | undefined,
): StatusPresentation {
  if (evaluation === undefined) {
    return blockedBiomeStatus;
  }
  if (evaluation.completion === 'incomplete') {
    return incompleteBiomeStatus;
  }
  return evaluation.validity === 'valid' ? validBiomeStatus : invalidBiomeStatus;
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
      return `${biomeLabel} · Setting`;
    case 'fixedEntryRoom':
    case 'fixedEntryReward':
    case 'fixedEntryTarget':
      return `${biomeLabel} · Fixed Entry`;
    case 'continuation':
      return `${biomeLabel} · Decision`;
    case 'batchRewardStore':
      return `${biomeLabel} · Reward pool`;
    case 'target':
      return `${biomeLabel} · Exit ${origin.exitIndex}`;
    case 'picked':
      return `${biomeLabel} · Entered exit`;
    case 'incomingReward':
      return `${biomeLabel} · Room reward`;
    case 'localReward':
      return `${biomeLabel} · Local reward ${origin.slotKey}`;
    case 'localChild':
      return `${biomeLabel} · Local room ${origin.slotKey}`;
    case 'localChildGroup':
      return `${biomeLabel} · Local room order`;
    case 'rewardWheel':
      return `${biomeLabel} · Reward wheel`;
    case 'rewardWheelOffer':
      return `${biomeLabel} · Reward wheel offer`;
    case 'hubOpenSet':
      return `${biomeLabel} · Open Hub rooms`;
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
    case 'shopPurchase':
      return `${biomeLabel} · Shop purchase`;
    case 'completionRoom':
      return `${biomeLabel} · ${origin.role === 'boss' ? 'Boss' : 'Postboss'}`;
  }
}
