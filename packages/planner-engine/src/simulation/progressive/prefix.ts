import { semanticAddressKey } from '../../authored-project/addresses';
import type {
  CanonicalAdditionalContinuation,
  CanonicalDecision,
  CanonicalHubVisit,
  CanonicalTarget,
  MaterializedBiomePrefix,
  MaterializedExitDecisionFrontier,
  MaterializedHubVisitFrontier,
} from '../materialization';
import { selectedBatchContinuation } from '../materialization';
import { ownerRegion } from '../finding-regions';
import type { EncounterHistoryBlock } from '../history';
import {
  encounterBlockFinding,
  findingOwnerOrigin,
  locateFinding,
  ownsOccurrence,
  type HubVisitFindingLocation,
  type LocatedFinding,
} from './finding-location';

export function hubVisitFrontier(
  visit: CanonicalHubVisit,
  location: HubVisitFindingLocation,
): MaterializedHubVisitFrontier {
  if (location.phase === 'targetLifecycle') {
    return Object.freeze({
      kind: 'hubVisit',
      origin: visit.origin,
      phase: location.phase,
      target: visit.target,
      localSlots: Object.freeze([]),
      enteredLocalRooms: Object.freeze([]),
      parentRestores: Object.freeze([]),
    });
  }
  if (location.phase === 'sideGeneration') {
    return Object.freeze({
      kind: 'hubVisit',
      origin: visit.origin,
      phase: location.phase,
      target: visit.target,
      localSlots: visit.localSlots,
      enteredLocalRooms: Object.freeze([]),
      parentRestores: Object.freeze([]),
    });
  }
  const localLifecycleIndex = location.localLifecycleIndex;
  if (localLifecycleIndex === undefined) {
    throw new Error(`Hub visit ${visit.visitIndex} local lifecycle has no local owner`);
  }
  const enteredLocalRooms = Object.freeze(
    visit.enteredLocalRooms.slice(0, localLifecycleIndex + 1),
  );
  const enteredOrigins = new Set(enteredLocalRooms.map((slot) => semanticAddressKey(slot.origin)));
  const localSlots = Object.freeze(
    visit.localSlots.map((slot) =>
      enteredOrigins.has(semanticAddressKey(slot.origin)) || !slot.entered
        ? slot
        : Object.freeze({ ...slot, entered: false }),
    ),
  );
  return Object.freeze({
    kind: 'hubVisit',
    origin: visit.origin,
    phase: location.phase,
    target: visit.target,
    localSlots,
    enteredLocalRooms: Object.freeze(
      enteredLocalRooms.map((slot) =>
        localSlots.find(
          (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(slot.origin),
        )!,
      ),
    ),
    // The local owner itself is the stopping room: earlier completed local
    // rooms restore their parent, but no restore may follow the invalid one.
    parentRestores: Object.freeze(visit.parentRestores.slice(0, localLifecycleIndex)),
  });
}

export function exitFrontier(
  decision: Extract<CanonicalDecision, { readonly kind: 'batch' }>,
  targets: readonly CanonicalTarget[] = [],
  additional: readonly CanonicalAdditionalContinuation[] = decision.additional,
): MaterializedExitDecisionFrontier {
  const partialBatch =
    targets.length > 0
      ? Object.freeze({ ...decision, targets: Object.freeze([...targets]) })
      : undefined;
  return Object.freeze({
    kind: 'exitDecision',
    origin: decision.origin,
    parent: decision.parent,
    targets: Object.freeze([...targets]),
    additional,
    ...(partialBatch === undefined ? {} : { partialBatch, batchState: partialBatch.batchState }),
    selectedExitKey: decision.selectedExitKey,
    selectedOrigin: decision.selectedOrigin,
  });
}

export function clampPrefix(
  prefix: MaterializedBiomePrefix,
  located: LocatedFinding,
): MaterializedBiomePrefix {
  // A Judgment finding occurs only after the terminal Boss encounter. The
  // authored prefix is already the exact pre-completion state; trimming its
  // Preboss decision would falsely erase that state rather than merely
  // suppressing the Postboss and later-biome consequences.
  if (located.finding.origin.kind === 'judgmentArcana') return prefix;
  if (located.decisionIndex < 0) {
    return Object.freeze({
      kind: 'biomePrefix',
      routeKey: prefix.routeKey,
      biomeKey: prefix.biomeKey,
      ...(prefix.entryRoom === undefined ? {} : { entryRoom: prefix.entryRoom }),
      decisions: Object.freeze([]),
      biomeState: prefix.biomeState,
    });
  }
  const decision = located.frontierBatch
    ? prefix.frontier?.kind === 'exitDecision'
      ? prefix.frontier.partialBatch
      : undefined
    : prefix.decisions[located.decisionIndex];
  if (decision === undefined) return prefix;
  if (decision.kind === 'hub') {
    if (located.hubVisitIndex !== undefined) {
      const frontierVisit = decision.visits[located.hubVisitIndex];
      if (frontierVisit === undefined) return prefix;
      const phase = located.hubVisitPhase;
      if (phase === undefined) return prefix;
      const frontier = hubVisitFrontier(frontierVisit, {
        visitIndex: located.hubVisitIndex,
        phase,
        ...(located.hubLocalLifecycleIndex === undefined
          ? {}
          : { localLifecycleIndex: located.hubLocalLifecycleIndex }),
      });
      return Object.freeze({
        ...prefix,
        decisions: Object.freeze([
          ...prefix.decisions.slice(0, located.decisionIndex),
          Object.freeze({
            ...decision,
            // The blocked visit is represented by a phase-aware frontier.
            // Completed prior visits remain canonical; replay must not make
            // the blocked visit's later local lifecycle or Hub return true.
            visits: Object.freeze(decision.visits.slice(0, located.hubVisitIndex)),
          }),
        ]),
        frontier,
      });
    }
    return Object.freeze({
      ...prefix,
      // Board targets are all physically generated by the Hub's outgoing
      // checkpoint. A board-owned failure prevents visits, not that already
      // reached board region or its reward producers from existing.
      decisions: Object.freeze([
        ...prefix.decisions.slice(0, located.decisionIndex),
        Object.freeze({ ...decision, visits: Object.freeze([]) }),
      ]),
      frontier: Object.freeze({ kind: 'hubBoard', origin: decision.origin }),
    });
  }
  if (decision.parent.origin.kind === 'hubRoom') {
    return Object.freeze({
      ...prefix,
      decisions: Object.freeze(prefix.decisions.slice(0, located.decisionIndex)),
      // A Hub-owned handoff is one physical generation unit with the Hub.
      // It cannot be replayed as an ordinary non-empty frontier.  Keep the
      // completed board and stop before the blocked handoff target instead;
      // the selected products retain that target's authoring artifacts.
      frontier: exitFrontier(decision),
    });
  }
  const retainedTargets =
    located.targetIndex === undefined
      ? Object.freeze([])
      : located.finding.code === 'rewardMissing'
        ? decision.targets
        : decision.targets.slice(0, located.targetIndex);
  const retainedAdditional =
    located.additionalIndex === undefined
      ? decision.additional
      : decision.additional.slice(0, located.additionalIndex + 1);
  return Object.freeze({
    ...prefix,
    decisions: Object.freeze(
      located.frontierBatch
        ? [...prefix.decisions]
        : prefix.decisions.slice(0, located.decisionIndex),
    ),
    frontier: exitFrontier(decision, retainedTargets, retainedAdditional),
  });
}

/**
 * A selected target's incoming offer is produced with that target, before
 * the target's own room lifecycle. A generic target or incoming-offer
 * finding therefore retains that one target in an interaction-only prefix:
 * its offer can be corrected from the actual offer-time checkpoint, while
 * the execution prefix still excludes the invalid room and every later
 * lifecycle effect. All other generic boundaries use the ordinary clamp.
 */
export function retainedInteractionPrefix(
  prefix: MaterializedBiomePrefix,
  located: LocatedFinding,
): MaterializedBiomePrefix {
  const terminalDecision = prefix.decisions.at(-1);
  if (terminalDecision?.kind === 'batch') {
    const selected = selectedBatchContinuation(terminalDecision);
    if (
      selected?.kind === 'normal' &&
      selected.target.continuation === 'startsCompletion' &&
      ownsOccurrence(findingOwnerOrigin(located.finding), selected.target.room.occurrenceId)
    ) {
      // The selected Preboss and its completion tail are the final authored
      // region. Keep this exact terminal product for reward repair rather
      // than inventing a Hub frontier that history cannot compose.
      return prefix;
    }
  }
  if (located.targetIndex === undefined) return clampPrefix(prefix, located);
  const decision = located.frontierBatch
    ? prefix.frontier?.kind === 'exitDecision'
      ? prefix.frontier.partialBatch
      : undefined
    : prefix.decisions[located.decisionIndex];
  if (decision === undefined || decision.kind !== 'batch') return clampPrefix(prefix, located);
  if (decision.parent.origin.kind === 'hubRoom') return clampPrefix(prefix, located);
  // A batch's physical targets share one reward-store envelope.  Interaction
  // replay therefore has to retain the complete authored target set even when
  // the first blocked owner belongs to an earlier peer.  The execution prefix
  // above remains clamped at that owner, so later room lifecycles are not
  // admitted merely because their offer-time products are needed to resolve
  // the shared store.
  const targets =
    located.targetIndex === undefined ? Object.freeze([]) : Object.freeze([...decision.targets]);
  const additional =
    located.additionalIndex === undefined
      ? decision.additional
      : decision.additional.slice(0, located.additionalIndex + 1);
  return Object.freeze({
    ...prefix,
    decisions: Object.freeze(
      located.frontierBatch
        ? [...prefix.decisions]
        : prefix.decisions.slice(0, located.decisionIndex),
    ),
    frontier: exitFrontier(decision, targets, additional),
  });
}
export function encounterBlockProductPrefix(
  prefix: MaterializedBiomePrefix,
  block: EncounterHistoryBlock,
): MaterializedBiomePrefix {
  const located = locateFinding(prefix, encounterBlockFinding(block), ownerRegion(block.blockedAt));
  if (located === undefined) {
    throw new Error(
      `encounter block ${semanticAddressKey(block.blockedAt)} has no structural owner`,
    );
  }
  const clamped = clampPrefix(prefix, located);
  const decision =
    located.frontierBatch && prefix.frontier?.kind === 'exitDecision'
      ? prefix.frontier.partialBatch
      : prefix.decisions[located.decisionIndex];
  if (decision?.kind !== 'batch') return clamped;
  const created = new Set(
    block.afterValidRecordPrefix.ledgers.roomCreations.map((event) =>
      semanticAddressKey(event.origin),
    ),
  );
  const targets = decision.targets.filter((target) =>
    created.has(semanticAddressKey(target.room.origin)),
  );
  const additional = decision.additional.filter((entry) =>
    created.has(semanticAddressKey(entry.room.origin)),
  );
  const frontier = exitFrontier(decision, targets, additional);
  return Object.freeze({ ...clamped, frontier });
}
