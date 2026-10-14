import {
  createExitDecisionAddress,
  createHubDecisionAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';

import type {
  WorkspaceStartInteractionRequirement,
  WorkspaceTopologyRemovalInteractionRequirement,
} from '../interactions/interaction-requirements';
import type { WorkspaceBiomeSource } from '../source-index';

/**
 * All topology-owned workspace products for one biome. It intentionally keeps
 * command requirements separate from decision and Hub presentation assembly.
 */
export interface WorkspaceTopologyInteractionAssembly {
  readonly startInteractionRequirements: readonly WorkspaceStartInteractionRequirement[];
  readonly topologyRemovalInteractionRequirements: readonly WorkspaceTopologyRemovalInteractionRequirement[];
}

/**
 * The topology adapter receives only addressed biome source. It does not
 * receive projection context, candidate services, markers, interaction maps,
 * or rendered nodes.
 */
export interface WorkspaceTopologyInteractionAssemblyInput {
  readonly source: WorkspaceBiomeSource;
}

function topologyRemovalInteractionRequirements(
  input: WorkspaceTopologyInteractionAssemblyInput,
): readonly WorkspaceTopologyRemovalInteractionRequirement[] {
  const { biome, plan } = input.source;
  const topology = plan.topology;
  if (topology === null) return Object.freeze([]);
  const removals: WorkspaceTopologyRemovalInteractionRequirement['removals'][number][] = [
    Object.freeze({
      command: Object.freeze({ kind: 'ClearTopology' as const, biome }),
      key: semanticAddressKey(biome),
      owner: biome,
    }),
  ];
  for (const decision of topology.decisions) {
    if (decision.kind === 'hub') {
      const owner = createHubDecisionAddress(biome, decision.hubKey);
      removals.push(
        Object.freeze({
          command: Object.freeze({ kind: 'RemoveHubDecision' as const, hub: owner }),
          key: semanticAddressKey(owner),
          owner,
        }),
      );
    } else if (decision.kind === 'exit' && decision.source.kind === 'occurrence') {
      // The completed-Hub exit is removed only with its Hub.
      const owner = createExitDecisionAddress(biome, decision.source);
      removals.push(
        Object.freeze({
          command: Object.freeze({ kind: 'RemoveExitDecision' as const, decision: owner }),
          key: semanticAddressKey(owner),
          owner,
        }),
      );
    }
  }
  return Object.freeze([
    Object.freeze({
      kind: 'topologyRemovals' as const,
      owner: biome,
      removals: Object.freeze(removals),
    }),
  ]);
}

function startInteractionRequirements(
  source: WorkspaceBiomeSource,
): readonly WorkspaceStartInteractionRequirement[] {
  const { biome, plan } = source;
  if (plan.topology !== null) return Object.freeze([]);
  return Object.freeze([
    Object.freeze({
      kind: 'start' as const,
      owner: biome,
    }),
  ]);
}

export function assembleWorkspaceTopologyInteractions(
  input: WorkspaceTopologyInteractionAssemblyInput,
): WorkspaceTopologyInteractionAssembly {
  return Object.freeze({
    startInteractionRequirements: startInteractionRequirements(input.source),
    topologyRemovalInteractionRequirements: topologyRemovalInteractionRequirements(input),
  });
}
