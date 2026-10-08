import type { Catalog } from '../../catalog-schema';
import type { BiomeTopology, ExitDecision, ExitSelection, ExitTargetReference } from '../model';
import {
  additionalExitsForDecision,
  batchTakesOverNormalDoors,
  declaredPhysicalExitKeys,
  exitDecisionForSource,
  selectedExitKey,
  selectedExitTarget,
} from '../topology/query';
import { sameExitDecisionSource } from '../topology/source-identity';
import { applyTopologyRemovalImpact, describeTopologyRemovalImpact } from '../topology/impact';
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

// Frees the highest unselected door only when every declared door is occupied.
function capacityTargets(
  decision: ExitDecision,
  allowedExitKeys: readonly string[],
  rekeySelected: boolean,
): readonly ExitTargetReference[] {
  const allowed = new Set(allowedExitKeys);
  const declared = decision.normal.targets.filter((target) => allowed.has(target.exitKey));
  const selected = selectedExitTarget(decision);
  if (
    !rekeySelected ||
    selected === undefined ||
    allowed.has(selected.exitKey) ||
    allowedExitKeys.length === 0
  ) {
    return declared;
  }
  const siblings = [...declared];
  if (siblings.length >= allowedExitKeys.length) {
    const highest = siblings.reduce((left, right) =>
      allowedExitKeys.indexOf(right.exitKey) > allowedExitKeys.indexOf(left.exitKey) ? right : left,
    );
    siblings.splice(siblings.indexOf(highest), 1);
  }
  const occupied = new Set(siblings.map((target) => target.exitKey));
  const exitKey = allowedExitKeys.find((key) => !occupied.has(key));
  if (exitKey === undefined) {
    throw new Error('capacity reconciliation left no free declared door');
  }
  return Object.freeze(
    [...siblings, Object.freeze({ exitKey, occurrenceId: selected.occurrenceId })].sort(
      (left, right) =>
        allowedExitKeys.indexOf(left.exitKey) - allowedExitKeys.indexOf(right.exitKey),
    ),
  );
}

function reconcileExitDecisionCapacity(
  topology: BiomeTopology,
  decision: ExitDecision,
  allowedExitKeys: readonly string[],
  rekeySelected: boolean,
): BiomeTopology {
  const retained = capacityTargets(decision, allowedExitKeys, rekeySelected);
  const retainedIds = new Set(retained.map((target) => target.occurrenceId));
  const removed = new Set(
    decision.normal.targets
      .filter((target) => !retainedIds.has(target.occurrenceId))
      .map((target) => target.occurrenceId),
  );
  const withoutDownstream =
    removed.size === 0
      ? topology
      : applyTopologyRemovalImpact(topology, describeTopologyRemovalImpact(topology, removed));
  const additionalExits = additionalExitsForDecision(topology, decision);
  const selectedOccurrenceId = selectedExitTarget(decision)?.occurrenceId;
  const selectedTarget = retained.find((target) => target.occurrenceId === selectedOccurrenceId);
  let selection: ExitSelection = Object.freeze({ kind: 'unresolved' });
  const existingSelection = decision.selection;
  if (retained.length === 1 && additionalExits.length === 0) {
    selection = Object.freeze({ kind: 'derived' });
  } else if (existingSelection.kind !== 'additional' && selectedTarget !== undefined) {
    selection = Object.freeze({ kind: 'normal', exitKey: selectedTarget.exitKey });
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

/**
 * `rekey` keeps a selected continuation whose door the source lacks; `prune`
 * removes it with every other undeclared door.
 */
export type UndeclaredSelectedDoor = 'rekey' | 'prune';

export function reconcileExitDecisionToDeclaredCapacity(
  catalog: Catalog,
  located: LocatedBiome,
  topology: BiomeTopology,
  decision: ExitDecision,
  undeclaredSelectedDoor: UndeclaredSelectedDoor,
  command: TopologyCommand | RouteDetourCommand,
): BiomeTopology {
  const allowed = exitKeysForTopologySource(catalog, located, topology, decision.source, command);
  const reconciled = reconcileExitDecisionCapacity(
    topology,
    decision,
    allowed,
    undeclaredSelectedDoor === 'rekey' && !batchTakesOverNormalDoors(catalog, topology, decision),
  );
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
