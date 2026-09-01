import { fail } from './primitives';
import type { ExecutionOccurrence, ExecutionPlan } from '../model';

export function validateExecutionReferences(plan: ExecutionPlan): void {
  const occurrences = new Map(plan.occurrences.map((entry) => [entry.id, entry]));
  if (occurrences.size !== plan.occurrences.length) fail('occurrences must have unique IDs');
  const selected = new Set(plan.selectedOccurrenceIds);
  if (selected.size !== plan.selectedOccurrenceIds.length)
    fail('selectedOccurrenceIds must be unique');
  for (const id of plan.selectedOccurrenceIds)
    if (!occurrences.has(id)) fail(`selected occurrence ${id} is missing`);
  if (
    plan.selectedOccurrenceIds.length === 0 ||
    plan.selectedOccurrenceIds[0] !== plan.occurrences[0]?.id
  )
    fail('selectedOccurrenceIds must begin with the opening occurrence');
  const assertRoomReference = (
    reference: { readonly id: string; readonly biomeKey: string; readonly gameName: string },
    label: string,
  ): void => {
    const target = occurrences.get(reference.id);
    if (target === undefined) fail(`${label} ${reference.id} is unresolved`);
    if (target.biomeKey !== reference.biomeKey || target.gameName !== reference.gameName)
      fail(`${label} ${reference.id} contradicts its occurrence identity`);
  };
  const continuations = (entry: ExecutionOccurrence): Set<string> => {
    const result = new Set<string>();
    if (entry.doors.kind === 'batch') {
      for (const target of entry.doors.targets) {
        assertRoomReference(target.room, `${entry.id} door target`);
        result.add(target.room.id);
      }
    } else if (entry.doors.kind === 'fixed') {
      assertRoomReference(entry.doors.target, `${entry.id} fixed target`);
      result.add(entry.doors.target.id);
    }
    for (const additional of entry.overview.additional ?? []) {
      assertRoomReference(additional.room, `${entry.id} additional room`);
      result.add(additional.room.id);
    }
    return result;
  };
  for (let index = 0; index + 1 < plan.selectedOccurrenceIds.length; index += 1) {
    const predecessor = occurrences.get(plan.selectedOccurrenceIds[index]!);
    const successor = plan.selectedOccurrenceIds[index + 1]!;
    if (predecessor === undefined || !continuations(predecessor).has(successor))
      fail(`selectedOccurrenceIds is disconnected at ${plan.selectedOccurrenceIds[index]}`);
  }
  const selectedIndex = new Map(
    plan.selectedOccurrenceIds.map((id, index) => [id, index] as const),
  );
  const transactions = new Map(
    plan.occurrences.flatMap((entry) =>
      entry.timeline.transactions.map((item) => [item.owner, item] as const),
    ),
  );
  const transactionCount = plan.occurrences.reduce(
    (count, entry) => count + entry.timeline.transactions.length,
    0,
  );
  if (transactions.size !== transactionCount)
    fail('transaction owners must be unique across the execution plan');
  const retainedProducers = new Set<string>();
  for (const retained of plan.wellRetainedEffects) {
    if (retainedProducers.has(retained.producerOwner))
      fail(`wellRetainedEffects has duplicate producer ${retained.producerOwner}`);
    retainedProducers.add(retained.producerOwner);
    const producer = transactions.get(retained.producerOwner);
    const consumer = transactions.get(retained.consumerOwner);
    if (producer?.kind !== 'wellPurchase')
      fail(`wellRetainedEffects producer ${retained.producerOwner} is unresolved`);
    if (producer.effect !== retained.effect)
      fail(`wellRetainedEffects effect disagrees for ${retained.producerOwner}`);
    if (consumer === undefined)
      fail(`wellRetainedEffects consumer ${retained.consumerOwner} is unresolved`);
    if (
      retained.effect === 'extended' &&
      (consumer.kind !== 'wellPurchase' || !consumer.extendedDirectPurchase)
    )
      fail(`wellRetainedEffects Extended consumer ${retained.consumerOwner} is invalid`);
    if (
      (retained.effect === 'yarn' || retained.effect === 'hymn') &&
      ((consumer.kind !== 'acquisition' && consumer.kind !== 'shopPurchase') ||
        !consumer.roles.some((role) => role.traitOffer !== undefined))
    )
      fail(`wellRetainedEffects ${retained.effect} consumer ${retained.consumerOwner} is invalid`);
    const producerOccurrence = plan.occurrences.find((entry) =>
      entry.timeline.transactions.some((item) => item.owner === retained.producerOwner),
    );
    const consumerOccurrence = plan.occurrences.find((entry) =>
      entry.timeline.transactions.some((item) => item.owner === retained.consumerOwner),
    );
    if (producerOccurrence === undefined || consumerOccurrence === undefined)
      fail('wellRetainedEffects references an unresolved occurrence');
    const producerOrder = selectedIndex.get(producerOccurrence.id);
    const consumerOrder = selectedIndex.get(consumerOccurrence.id);
    if (producerOrder === undefined || consumerOrder === undefined || consumerOrder < producerOrder)
      fail('wellRetainedEffects must refer to selected route occurrences in order');
    if (producerOrder === consumerOrder)
      fail('wellRetainedEffects must cross selected route occurrences');
  }
  for (const entry of plan.occurrences) {
    continuations(entry);
    if (entry.anomaly !== undefined && entry.biomeKey !== 'G')
      fail(`${entry.id} anomaly payload is only supported for G occurrences`);
    const owners = new Set(entry.timeline.transactions.map((item) => item.owner));
    if (owners.size !== entry.timeline.transactions.length)
      fail(`${entry.id} transaction owners must be unique`);
    for (const item of entry.timeline.transactions) {
      if (item.kind !== 'acquisition' && item.kind !== 'shopPurchase') continue;
      for (const role of item.roles) {
        if (role.producer === undefined || role.producer.sourceOwner === item.sourceOwner) continue;
        const source = entry.timeline.transactions.find(
          (candidate) =>
            (candidate.kind === 'acquisition' || candidate.kind === 'shopPurchase') &&
            candidate.sourceOwner === role.producer!.sourceOwner &&
            candidate.roles.some(
              (candidateRole) => candidateRole.role === role.producer!.sourceRole,
            ),
        );
        if (source === undefined) fail(`${entry.id} has an unresolved producer source`);
        if (
          !entry.timeline.dependencies.some(
            (dependency) =>
              dependency.owner === item.owner && dependency.afterOwner === source.owner,
          )
        )
          fail(`${entry.id} has an unresolved producer dependency`);
      }
    }
    const graph = new Map<string, string[]>();
    for (const dependency of entry.timeline.dependencies) {
      if (!owners.has(dependency.owner) || !owners.has(dependency.afterOwner))
        fail(`${entry.id} has an unresolved dependency owner`);
      const edges = graph.get(dependency.owner) ?? [];
      edges.push(dependency.afterOwner);
      graph.set(dependency.owner, edges);
    }
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (owner: string): void => {
      if (visiting.has(owner)) fail(`${entry.id} has a dependency cycle`);
      if (visited.has(owner)) return;
      visiting.add(owner);
      for (const next of graph.get(owner) ?? []) visit(next);
      visiting.delete(owner);
      visited.add(owner);
    };
    for (const owner of owners) visit(owner);
    const streamKeys = new Set<string>();
    for (const stream of entry.timeline.streams) {
      if (streamKeys.has(stream.key)) fail(`${entry.id} stream keys must be unique`);
      streamKeys.add(stream.key);
      if (stream.owners.length === 0 || new Set(stream.owners).size !== stream.owners.length)
        fail(`${entry.id} stream owners must be unique`);
      for (const owner of stream.owners)
        if (!owners.has(owner)) fail(`${entry.id} has an unresolved stream owner`);
    }
    for (const obligation of entry.timeline.obligations)
      if (!owners.has(obligation.owner)) fail(`${entry.id} has an unresolved obligation owner`);
  }
}
