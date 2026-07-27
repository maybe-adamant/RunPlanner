import type { WorkspaceTopologyRemovalScope } from '../../../projections/structuredWorkspace';

/** Turns engine-derived removal scope into compact renderer text. */
export function topologyRemovalScopeSummary(scope: WorkspaceTopologyRemovalScope): string {
  const parts = [
    scope.removedOccurrenceIds.length === 0
      ? undefined
      : `${scope.removedOccurrenceIds.length} ${
          scope.removedOccurrenceIds.length === 1 ? 'room occurrence' : 'room occurrences'
        }`,
    scope.removedDecisionOwners.length === 0
      ? undefined
      : `${scope.removedDecisionOwners.length} ${
          scope.removedDecisionOwners.length === 1 ? 'exit decision' : 'exit decisions'
        }`,
    scope.removedHubDecisionKeys.length === 0
      ? undefined
      : `${scope.removedHubDecisionKeys.length} ${
          scope.removedHubDecisionKeys.length === 1 ? 'Hub board' : 'Hub boards'
        }`,
  ].filter((value): value is string => value !== undefined);
  return parts.length === 0 ? 'no authored topology' : parts.join(' and ');
}
