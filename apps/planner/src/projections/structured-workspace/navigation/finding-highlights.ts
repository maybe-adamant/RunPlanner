import {
  semanticAddressKey,
  type SemanticAddress,
  type TraitOfferAddress,
} from '@run-planner/engine/authored-project';
import type { SemanticFinding } from '@run-planner/engine/simulation';
import type {
  WorkspaceFindingControl,
  WorkspaceInspectorDestination,
} from '../contracts/navigation';

/** The feedback key of a semantic owner, or of one addressless control within it. */
export function findingControlKey(
  address: SemanticAddress,
  control?: WorkspaceFindingControl,
): string {
  const key = semanticAddressKey(address);
  return control === undefined ? key : `${key}#${control}`;
}

/** The Timeline row control whose edit repairs a finding owned by the row itself. */
function roomActionControl(finding: SemanticFinding): WorkspaceFindingControl | undefined {
  switch (finding.code) {
    case 'roomActionPlacementRequired':
      return 'place';
    case 'roomActionOrderUnavailable':
      // An action ordered after a checkpoint that no longer exists should not exist.
      return finding.evidence.checkpointUnavailable === true ? 'delete' : 'move';
    case 'nemesisOutcomeMissing':
    case 'nemesisOutcomeUnavailable':
      return finding.evidence.kind === 'traitTrade' ? 'nemesisTrait' : 'nemesisReward';
    default:
      return undefined;
  }
}

/** The trait picker control of one Boon Boon Boon row. */
export function echoLastRunOptionControl(option: {
  readonly giverKey: string;
  readonly traitKey: string;
  readonly rarity: string;
}): WorkspaceFindingControl {
  return `echoLastRunOption:${option.giverKey}:${option.traitKey}:${option.rarity}`;
}

const groupedOutcomeCodes = new Set<string>([
  'allTogetherResultMissing',
  'allTogetherResultUnavailable',
  'naturalSelectionResultMissing',
  'naturalSelectionResultUnavailable',
]);

/** Boon Boon Boon findings arrive at the Echo choice owner; each names its repairing row. */
function echoLastRunControl(finding: SemanticFinding): WorkspaceFindingControl | undefined {
  if (finding.code === 'echoLastRunBoonOptionUnavailable')
    return typeof finding.evidence.detail === 'string'
      ? (`echoLastRunOption:${finding.evidence.detail}` as const)
      : undefined;
  if (
    finding.code === 'targetedAcquisitionTargetMissing' ||
    finding.code === 'targetedAcquisitionTargetUnavailable'
  )
    return 'echoLastRunTarget';
  // The nested evidence names no set or position, so the group's first row repairs it.
  return groupedOutcomeCodes.has(finding.code) ? 'outcomeFirstRow' : undefined;
}

/** A grouped outcome finding marked at its own owner names the row that repairs it. */
function ownerControl(finding: SemanticFinding): WorkspaceFindingControl | undefined {
  if (finding.origin.kind === 'echoLastRunBoon') return echoLastRunControl(finding);
  // Natural Selection evidence names no position, so its first first-pass row repairs it.
  if (finding.origin.kind === 'naturalSelectionResult') return 'outcomeFirstRow';
  return undefined;
}

/** A finding repaired by one addressless control of its own owner, chosen by its code. */
function codeControl(finding: SemanticFinding): WorkspaceFindingControl | undefined {
  if (finding.origin.kind === 'acquisitionRole' && finding.code === 'seaStarDuplicationUnavailable')
    return 'seaStar';
  // Stone findings arise only for a chosen proc or a required Stone, whose checkbox is fixed.
  if (
    finding.origin.kind === 'traitOffer' &&
    (finding.code === 'concaveStoneResultMissing' ||
      finding.code === 'concaveStoneResultUnavailable')
  )
    return 'concaveStoneTarget';
  return undefined;
}

/** The feedback key of the control that repairs a finding, from its navigation destination. */
export function findingRepairTarget(
  finding: SemanticFinding,
  destinations: ReadonlyMap<string, WorkspaceInspectorDestination>,
): string | undefined {
  const destination = destinations.get(semanticAddressKey(finding.origin));
  if (destination === undefined) return undefined;
  const markAddress =
    destination.markByCode?.[finding.code] ?? destination.markAddress ?? destination.focusAddress;
  const ownMark = semanticAddressKey(markAddress) === semanticAddressKey(finding.origin);
  return findingControlKey(
    markAddress,
    (ownMark ? ownerControl(finding) : undefined) ??
      codeControl(finding) ??
      destination.markControl ??
      (finding.origin.kind === 'roomAction' && ownMark ? roomActionControl(finding) : undefined),
  );
}

/** The trait offer whose dialog edits a finding's origin: the offer itself or its child. */
function editingTraitOffer(origin: SemanticAddress): TraitOfferAddress | undefined {
  if (origin.kind === 'traitOffer') return origin;
  if (origin.kind === 'hexTree')
    return origin.owner.kind === 'traitOffer' ? origin.owner : undefined;
  return 'trait' in origin && origin.trait.kind === 'traitOffer' ? origin.trait : undefined;
}

/**
 * Inside an open trait dialog each finding marks its own owner's control, whatever
 * outer control its navigation destination marks; a nested view's launcher also
 * carries the marks of the rows inside it.
 */
export function indexTraitDialogFindings(
  findings: readonly SemanticFinding[],
  trait: TraitOfferAddress,
): ReadonlyMap<string, readonly SemanticFinding[]> {
  const traitKey = semanticAddressKey(trait);
  const result = new Map<string, SemanticFinding[]>();
  for (const finding of findings) {
    const offer = editingTraitOffer(finding.origin);
    if (offer === undefined || semanticAddressKey(offer) !== traitKey) continue;
    const control = ownerControl(finding) ?? codeControl(finding);
    const keys = [findingControlKey(finding.origin, control)];
    // The nested Boon Boon Boon view opens from its own launcher, which carries its row marks.
    if (finding.origin.kind === 'echoLastRunBoon' && control !== undefined)
      keys.push(findingControlKey(finding.origin));
    for (const key of keys) {
      const group = result.get(key) ?? [];
      group.push(finding);
      result.set(key, group);
    }
  }
  return new Map([...result].map(([key, group]) => [key, Object.freeze(group)]));
}

/** Feedback consumes the completed navigation destination, never origin ancestry. */
export function indexFindingsByRepairTarget(
  findings: readonly SemanticFinding[],
  destinations: ReadonlyMap<string, WorkspaceInspectorDestination>,
): ReadonlyMap<string, readonly SemanticFinding[]> {
  const result = new Map<string, SemanticFinding[]>();
  for (const finding of findings) {
    const key = findingRepairTarget(finding, destinations);
    if (key === undefined) continue;
    const group = result.get(key) ?? [];
    group.push(finding);
    result.set(key, group);
  }
  return new Map([...result].map(([key, group]) => [key, Object.freeze(group)]));
}
