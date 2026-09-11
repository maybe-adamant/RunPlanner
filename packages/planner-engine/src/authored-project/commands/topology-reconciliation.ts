import type { Catalog } from '../../catalog-schema';
import type { BiomeTopology, ExitDecision, ExitSelection } from '../model';
import {
  additionalExitsForDecision,
  declaredPhysicalExitKeys,
  exitDecisionForSource,
  selectedExitKey,
} from '../topology/query';
import { sameExitDecisionSource } from '../topology/source-identity';
import { applyTopologyRemovalImpact, describeTopologyRemovalImpact } from '../topologyImpact';
import { failCommand, type LocatedBiome } from './contract';
import { reconcileNormalTargetEntryStates } from './selection-state';
import type { RouteDetourCommand, TopologyCommand } from './types';

export function exitKeysForTopologySource(
  catalog: Catalog,
  located: LocatedBiome,
  topology: BiomeTopology,
  source: ExitDecision['source'],
  command: TopologyCommand | RouteDetourCommand,
): readonly string[] {
  const declared = declaredPhysicalExitKeys(catalog, located.layout, topology, source);
  if (declared === undefined) {
    failCommand(command, `${source.kind} source has no declaration-owned physical exits`);
  }
  return declared;
}

function replaceExitDecision(topology: BiomeTopology, replacement: ExitDecision): BiomeTopology {
  return Object.freeze({
    ...topology,
    decisions: Object.freeze(
      topology.decisions.map((decision) =>
        decision.kind === 'exit' && sameExitDecisionSource(decision.source, replacement.source)
          ? replacement
          : decision,
      ),
    ),
  });
}

function reconcileExitDecisionCapacity(
  topology: BiomeTopology,
  decision: ExitDecision,
  allowedExitKeys: readonly string[],
): BiomeTopology {
  const allowed = new Set(allowedExitKeys);
  const retained = decision.normal.targets.filter((target) => allowed.has(target.exitKey));
  const removed = new Set(
    decision.normal.targets
      .filter((target) => !allowed.has(target.exitKey))
      .map((target) => target.occurrenceId),
  );
  const withoutDownstream =
    removed.size === 0
      ? topology
      : applyTopologyRemovalImpact(topology, describeTopologyRemovalImpact(topology, removed));
  const additionalExits = additionalExitsForDecision(topology, decision);
  let selection: ExitSelection = Object.freeze({ kind: 'unresolved' });
  const existingSelection = decision.selection;
  if (retained.length === 1 && additionalExits.length === 0) {
    selection = Object.freeze({ kind: 'derived' });
  } else if (
    existingSelection.kind === 'normal' &&
    retained.some((target) => target.exitKey === existingSelection.exitKey)
  ) {
    selection = existingSelection;
  } else if (
    existingSelection.kind === 'additional' &&
    additionalExits.some((exit) => exit.key === existingSelection.additionalExitKey)
  ) {
    selection = existingSelection;
  }
  return replaceExitDecision(
    Object.freeze({
      ...withoutDownstream,
      occurrences: Object.freeze(
        withoutDownstream.occurrences.filter((occurrence) => !removed.has(occurrence.occurrenceId)),
      ),
    }),
    Object.freeze({
      ...decision,
      normal: Object.freeze({ ...decision.normal, targets: Object.freeze(retained) }),
      selection,
    }),
  );
}

export function reconcileExitDecisionToDeclaredCapacity(
  catalog: Catalog,
  located: LocatedBiome,
  topology: BiomeTopology,
  decision: ExitDecision,
  command: TopologyCommand | RouteDetourCommand,
): BiomeTopology {
  const allowed = exitKeysForTopologySource(catalog, located, topology, decision.source, command);
  const reconciled = reconcileExitDecisionCapacity(topology, decision, allowed);
  const reconciledDecision = exitDecisionForSource(reconciled, decision.source);
  if (reconciledDecision === undefined) {
    failCommand(command, 'exit-capacity reconciliation removed its owning decision');
  }
  return reconcileNormalTargetEntryStates(
    catalog,
    located,
    reconciled,
    reconciledDecision,
    selectedExitKey(reconciledDecision),
    command,
  );
}
