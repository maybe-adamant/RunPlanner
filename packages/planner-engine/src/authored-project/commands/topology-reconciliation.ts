import type { Catalog } from '../../catalog-schema';
import {
  createBiomeAddress,
  createExitDecisionAddress,
  type ExitDecisionAddress,
} from '../addresses';
import type {
  BiomeTopology,
  ExitDecision,
  ExitSelection,
  ExitTargetReference,
  ProjectDocument,
} from '../model';
import {
  additionalExitsForDecision,
  batchTakesOverNormalDoors,
  declaredPhysicalExitKeys,
  exitDecisionForSource,
  selectedExitKey,
  selectedExitTarget,
  takeoverPrebossDeclarationForBatch,
  takeoverPrebossFillsDeclaredExits,
} from '../topology/query';
import { sameExitDecisionSource } from '../topology/source-identity';
import { applyTopologyRemovalImpact, describeTopologyRemovalImpact } from '../topology/impact';
import { failCommand, locateConfiguredBiome, type LocatedBiome } from './contract';
import { reconcileNormalTargetEntryStates } from './selection-state';
import { exitKeysForTopologySource, updateTopology } from './topology/construction';
import { reconcileTakeoverBatchExits } from './topology/takeover';
import type { ProjectCommand, RouteDetourCommand } from './types';

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
  undeclaredSelectedDoor: UndeclaredSelectedDoor,
): readonly ExitTargetReference[] {
  const allowed = new Set(allowedExitKeys);
  const selected = selectedExitTarget(decision);
  if (undeclaredSelectedDoor === 'keep') {
    return decision.normal.targets.filter(
      (target) => allowed.has(target.exitKey) || target === selected,
    );
  }
  const declared = decision.normal.targets.filter((target) => allowed.has(target.exitKey));
  if (
    undeclaredSelectedDoor !== 'rekey' ||
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
  undeclaredSelectedDoor: UndeclaredSelectedDoor,
): BiomeTopology {
  const retained = capacityTargets(decision, allowedExitKeys, undeclaredSelectedDoor);
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
 * `rekey` moves a selected continuation whose door the source lacks onto a
 * free declared door; `prune` removes it with every other undeclared door;
 * `keep` leaves it where it is, the owner's route decision. Only `keep`
 * applies to a takeover batch, whose undeclared doors otherwise always go.
 */
export type UndeclaredSelectedDoor = 'rekey' | 'prune' | 'keep';

export function reconcileExitDecisionToDeclaredCapacity(
  catalog: Catalog,
  located: LocatedBiome,
  topology: BiomeTopology,
  decision: ExitDecision,
  undeclaredSelectedDoor: UndeclaredSelectedDoor,
  command: ProjectCommand | RouteDetourCommand,
): BiomeTopology {
  if (batchTakesOverNormalDoors(catalog, topology, decision)) {
    return reconcileTakeoverBatchExits(
      catalog,
      located,
      topology,
      decision,
      undeclaredSelectedDoor === 'keep' ? 'settle' : 'removeUndeclared',
      command,
    );
  }
  const allowed = exitKeysForTopologySource(catalog, located, topology, decision.source, command);
  const reconciled = reconcileExitDecisionCapacity(
    topology,
    decision,
    allowed,
    undeclaredSelectedDoor,
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

/**
 * A generated batch whose doors disagree with its source's declared exits: the
 * unselected targets on doors the source no longer has, and the declared doors
 * a takeover Preboss fills that the batch lacks. A selected target on such a
 * door is the owner's route decision and stays, with its finding.
 */
export interface ExitCapacityDrift {
  readonly decision: ExitDecisionAddress;
  readonly undeclared: readonly ExitTargetReference[];
  readonly missing: readonly string[];
}

/** Every batch of the route whose doors drifted from its source's declared exits. */
export function exitCapacityDrifts(
  document: ProjectDocument,
  catalog: Catalog,
): readonly ExitCapacityDrift[] {
  const drifts: ExitCapacityDrift[] = [];
  for (const plan of document.route.biomes) {
    const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
    const topology = plan.topology;
    // Only a generated layout retains a door its source does not declare.
    if (layout?.progression.kind !== 'generated' || topology == null) continue;
    const biome = createBiomeAddress(document.route.routeKey, plan.biomeKey);
    for (const decision of topology.decisions) {
      if (decision.kind !== 'exit' || decision.source.kind !== 'occurrence') continue;
      const declared = declaredPhysicalExitKeys(catalog, layout, topology, decision.source);
      if (declared === undefined) continue;
      const selected = selectedExitTarget(decision);
      const undeclared = decision.normal.targets.filter(
        (target) => !declared.includes(target.exitKey) && target !== selected,
      );
      const takeover = takeoverPrebossDeclarationForBatch(catalog, topology, decision);
      const missing =
        takeover !== undefined && takeoverPrebossFillsDeclaredExits(takeover, declared.length)
          ? declared.filter(
              (exitKey) => !decision.normal.targets.some((target) => target.exitKey === exitKey),
            )
          : [];
      if (undeclared.length === 0 && missing.length === 0) continue;
      drifts.push(
        Object.freeze({
          decision: createExitDecisionAddress(biome, decision.source),
          undeclared: Object.freeze(undeclared),
          missing: Object.freeze(missing),
        }),
      );
    }
  }
  return Object.freeze(drifts);
}

/**
 * Settles one drifted batch to its source's declared exits: its unselected
 * undeclared doors go with their downstream topology, and a takeover batch
 * gains a default Preboss offer at each missing door its Preboss fills. The
 * failing contact of a contract error is the edit that left the drift.
 */
export function settleExitCapacity(
  document: ProjectDocument,
  catalog: Catalog,
  decision: ExitDecisionAddress,
  edit: ProjectCommand,
): ProjectDocument {
  const located = locateConfiguredBiome(document, catalog, decision.biomeKey);
  const topology = located?.plan.topology;
  const current = topology == null ? undefined : exitDecisionForSource(topology, decision.source);
  if (located === undefined || topology == null || current === undefined)
    failCommand(edit, `exit decision ${decision.biomeKey} is not configured`);
  const reconciled = reconcileExitDecisionToDeclaredCapacity(
    catalog,
    located,
    topology,
    current,
    'keep',
    edit,
  );
  return reconciled === topology ? document : updateTopology(document, located, reconciled);
}
