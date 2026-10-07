import { semanticAddressKey, type SemanticAddress } from '@run-planner/engine/authored-project';
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

/** A finding repaired by one addressless control of its own owner, chosen by its code. */
function codeControl(finding: SemanticFinding): WorkspaceFindingControl | undefined {
  if (finding.origin.kind === 'acquisitionRole' && finding.code === 'seaStarDuplicationUnavailable')
    return 'seaStar';
  // The next visit is chosen by appending any unvisited room.
  if (finding.origin.kind === 'hubVisit' && finding.code === 'hubVisitOrderIncomplete')
    return 'visitChoice';
  return undefined;
}

/** Feedback consumes the completed navigation destination, never origin ancestry. */
export function indexFindingsByRepairTarget(
  findings: readonly SemanticFinding[],
  destinations: ReadonlyMap<string, WorkspaceInspectorDestination>,
): ReadonlyMap<string, readonly SemanticFinding[]> {
  const result = new Map<string, SemanticFinding[]>();
  for (const finding of findings) {
    const destination = destinations.get(semanticAddressKey(finding.origin));
    if (destination === undefined) continue;
    const markAddress =
      destination.markByCode?.[finding.code] ?? destination.markAddress ?? destination.focusAddress;
    const key = findingControlKey(
      markAddress,
      codeControl(finding) ??
        destination.markControl ??
        (finding.origin.kind === 'roomAction' &&
        semanticAddressKey(markAddress) === semanticAddressKey(finding.origin)
          ? roomActionControl(finding)
          : undefined),
    );
    const group = result.get(key) ?? [];
    group.push(finding);
    result.set(key, group);
  }
  return new Map([...result].map(([key, group]) => [key, Object.freeze(group)]));
}
