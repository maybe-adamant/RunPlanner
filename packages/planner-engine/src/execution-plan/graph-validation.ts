import type {
  ExecutionDoorTarget,
  ExecutionOccurrence,
  ExecutionResourcePolicy,
  ExecutionStartState,
} from './model';

export interface ExecutionGraphDocument {
  readonly extent: { readonly biomeKeys: readonly string[] };
  readonly selectedOccurrenceIds: readonly string[];
  readonly occurrences: readonly ExecutionOccurrence[];
  readonly resources: ExecutionResourcePolicy;
  readonly startState?: ExecutionStartState;
}

/**
 * A mid-run start names a selected occurrence of a configured biome: the
 * biome's first selected room for an Opening, a later one for a Preboss. The
 * route cursor starts at its index, so every earlier selected occurrence
 * belongs to the biomes the start's visit order has already entered. That a
 * Preboss start names the biome's Preboss room is assembly's guarantee, which
 * the fingerprint carries; occurrences do not publish room kinds.
 */
function validateStartState(
  graph: ExecutionGraphDocument,
  start: ExecutionStartState,
  occurrences: ReadonlyMap<string, ExecutionOccurrence>,
  invalid: (detail: string) => never,
): void {
  const cursor = graph.selectedOccurrenceIds.indexOf(start.occurrenceId);
  if (cursor < 0) invalid('startState.occurrenceId must be selected');
  const target = occurrences.get(start.occurrenceId)!;
  if (target.biomeKey !== start.biomeKey || target.gameName !== start.roomName)
    invalid('startState contradicts its occurrence identity');
  const biomeIndex = graph.extent.biomeKeys.indexOf(start.biomeKey);
  const preboss = start.point === 'preboss';
  if (biomeIndex < 0 || (!preboss && biomeIndex === 0))
    invalid('startState.biomeKey must be a configured biome after the route start');
  const visited = graph.extent.biomeKeys.slice(0, preboss ? biomeIndex + 1 : biomeIndex);
  if (
    start.biomeVisitOrder.length !== visited.length ||
    start.biomeVisitOrder.some((biomeKey, index) => biomeKey !== visited[index])
  )
    invalid('startState.biomeVisitOrder must be the configured biomes entered before the start');
  const firstOfBiome = graph.selectedOccurrenceIds.findIndex(
    (id) => occurrences.get(id)?.biomeKey === start.biomeKey,
  );
  if (preboss ? cursor === firstOfBiome : cursor !== firstOfBiome)
    invalid(`startState.occurrenceId is not the ${start.biomeKey} ${start.point}`);
  if (preboss !== (start.biome !== undefined))
    invalid('startState.biome is present exactly for a Preboss start');
  if (
    start.biome !== undefined &&
    (start.biome.clockwork !== undefined) !== (start.biomeKey === 'I')
  )
    invalid('startState.biome.clockwork is present exactly for an I Preboss');
}

/**
 * Validate the reference graph shared by the engine product and wire document.
 * Callers retain ownership of their boundary-specific error type.
 */
export function validateExecutionGraph(
  graph: ExecutionGraphDocument,
  invalid: (detail: string) => never,
): void {
  const occurrences = new Map(graph.occurrences.map((entry) => [entry.id, entry]));
  if (occurrences.size !== graph.occurrences.length) invalid('occurrences must have unique IDs');

  const selected = new Set(graph.selectedOccurrenceIds);
  if (selected.size !== graph.selectedOccurrenceIds.length)
    invalid('selectedOccurrenceIds must be unique');
  for (const id of graph.selectedOccurrenceIds)
    if (!occurrences.has(id)) invalid(`selected occurrence ${id} is missing`);
  if (
    graph.selectedOccurrenceIds.length === 0 ||
    graph.selectedOccurrenceIds[0] !== graph.occurrences[0]?.id
  )
    invalid('selectedOccurrenceIds must begin with the opening occurrence');

  const assertRoomReference = (
    reference: { readonly id: string; readonly biomeKey: string; readonly gameName: string },
    label: string,
  ): void => {
    const target = occurrences.get(reference.id);
    if (target === undefined) invalid(`${label} ${reference.id} is unresolved`);
    if (target.biomeKey !== reference.biomeKey || target.gameName !== reference.gameName)
      invalid(`${label} ${reference.id} contradicts its occurrence identity`);
  };
  const validateDoorCagePayload = (target: ExecutionDoorTarget, label: string): void => {
    const referenced = occurrences.get(target.room.id);
    if (referenced === undefined) return;
    if (referenced.kind === 'FieldsEncounter') {
      if (target.cageRewards === undefined)
        invalid(`${label} must carry cageRewards for a FieldsEncounter target`);
      const cageCount = referenced.overview.encounterPhases.filter((phase) =>
        /^Cage\d+$/.test(phase.slotKey),
      ).length;
      if (target.cageRewards?.length !== cageCount)
        invalid(`${label}.cageRewards must match the Fields target cage encounter count`);
    } else if (target.cageRewards !== undefined) {
      invalid(`${label}.cageRewards is only valid for a FieldsEncounter target`);
    }
  };
  const validateZagreusContractPresence = (
    target: { readonly id: string; readonly zagreusContractPresent: boolean },
    label: string,
  ): void => {
    const referenced = occurrences.get(target.id);
    if (referenced === undefined) return;
    const expected =
      referenced.overview.additional?.some((additional) => additional.kind === 'zagreusContract') ??
      false;
    if (target.zagreusContractPresent !== expected)
      invalid(`${label}.zagreusContractPresent must match the destination Overview.additional`);
  };
  const continuations = (entry: ExecutionOccurrence): Set<string> => {
    const result = new Set<string>();
    if (entry.doors.kind === 'batch') {
      for (const target of entry.doors.targets) {
        assertRoomReference(target.room, `${entry.id} door target`);
        validateDoorCagePayload(target, `${entry.id} door target ${target.room.id}`);
        validateZagreusContractPresence(
          { id: target.room.id, zagreusContractPresent: target.zagreusContractPresent },
          `${entry.id} door target ${target.room.id}`,
        );
        result.add(target.room.id);
      }
    } else if (entry.doors.kind === 'fixed') {
      assertRoomReference(entry.doors.target, `${entry.id} fixed target`);
      validateZagreusContractPresence(
        { id: entry.doors.target.id, zagreusContractPresent: entry.doors.zagreusContractPresent },
        `${entry.id} fixed target ${entry.doors.target.id}`,
      );
      result.add(entry.doors.target.id);
    }
    for (const additional of entry.overview.additional ?? []) {
      assertRoomReference(additional.room, `${entry.id} additional room`);
      result.add(additional.room.id);
    }
    if (entry.overview.hub !== undefined) {
      for (const slot of entry.overview.hub.slots) {
        assertRoomReference(slot.room, `${entry.id} Hub slot`);
        result.add(slot.room.id);
      }
      assertRoomReference(entry.overview.hub.finalHandoff, `${entry.id} Hub final handoff`);
      result.add(entry.overview.hub.finalHandoff.id);
    }
    for (const slot of entry.overview.localSlots ?? []) {
      if (slot.room !== undefined) {
        assertRoomReference(slot.room, `${entry.id} local slot`);
        result.add(slot.room.id);
      }
    }
    return result;
  };

  for (const occurrence of graph.occurrences) continuations(occurrence);
  for (const occurrence of graph.occurrences) {
    if (
      selected.has(occurrence.id) &&
      occurrence.kind === 'FieldsEncounter' &&
      occurrence.overview.fields === undefined
    )
      invalid(`${occurrence.id}.overview.fields is required for a selected Fields encounter`);
    // Only a selected Ship room is entered, so only it spins its wheels.
    if (
      occurrence.kind === 'ShipEncounter' &&
      (occurrence.overview.rewardWheels?.length ?? 0) !==
        (selected.has(occurrence.id)
          ? occurrence.overview.encounterPhases.filter(
              (phase) => phase.slotKey !== 'Intro' && phase.kind === 'combat',
            ).length
          : 0)
    )
      invalid(`${occurrence.id}.overview.rewardWheels must match the Ship encounter phases`);
  }
  const nHubContinuations = new Set(
    graph.occurrences.flatMap((entry) =>
      entry.overview.hub === undefined
        ? []
        : [
            ...entry.overview.hub.slots.map((slot) => slot.room.id),
            entry.overview.hub.finalHandoff.id,
          ],
    ),
  );
  const nLocalParentBySide = new Map<string, ExecutionOccurrence>();
  for (const entry of graph.occurrences) {
    for (const slot of entry.overview.localSlots ?? []) {
      if (slot.room !== undefined) nLocalParentBySide.set(slot.room.id, entry);
    }
  }
  const hasNativeEphyraContinuation = (
    predecessor: ExecutionOccurrence,
    successor: string,
  ): boolean => {
    if (predecessor.biomeKey !== 'N') return false;
    // A main returns to the Hub after its native completion. A generated side
    // first restores its declared parent, then that same Hub. Neither restore
    // is an execution occurrence or transaction.
    const parent = nLocalParentBySide.get(predecessor.id);
    if (
      parent !== undefined &&
      parent.overview.localSlots?.some((slot) => slot.room?.id === successor)
    )
      return true;
    return (
      nHubContinuations.has(successor) &&
      (predecessor.overview.localSlots !== undefined || parent !== undefined)
    );
  };
  for (let index = 0; index + 1 < graph.selectedOccurrenceIds.length; index += 1) {
    const predecessor = occurrences.get(graph.selectedOccurrenceIds[index]!);
    const successor = graph.selectedOccurrenceIds[index + 1]!;
    if (
      predecessor === undefined ||
      (!hasNativeEphyraContinuation(predecessor, successor) &&
        !continuations(predecessor).has(successor))
    )
      invalid(`selectedOccurrenceIds is disconnected at ${graph.selectedOccurrenceIds[index]}`);
  }

  {
    const resourceOccurrenceIds = graph.resources.occurrences.map((entry) => entry.occurrenceId);
    if (new Set(resourceOccurrenceIds).size !== resourceOccurrenceIds.length)
      invalid('resource occurrences must have unique IDs');
    if (
      resourceOccurrenceIds.length !== graph.selectedOccurrenceIds.length ||
      resourceOccurrenceIds.some((id, index) => id !== graph.selectedOccurrenceIds[index])
    )
      invalid('resource occurrences must follow selectedOccurrenceIds exactly');
    const resourceFamilies = ['Pickaxe', 'Exorcism', 'Shovel', 'Fishing'] as const;
    for (const entry of graph.resources.occurrences) {
      if (!occurrences.has(entry.occurrenceId))
        invalid(`resource occurrence ${entry.occurrenceId} is unresolved`);
      for (const [family, disposition] of Object.entries(entry.pointDispositions)) {
        if (!(resourceFamilies as readonly string[]).includes(family))
          invalid(`resource family ${family} is unsupported`);
        if (disposition !== 'native' && disposition !== 'suppress' && disposition !== 'force')
          invalid(`resource ${family} has unsupported point disposition`);
      }
    }
    for (const family of resourceFamilies) {
      const forced = graph.resources.occurrences.filter(
        (entry) => entry.pointDispositions[family] === 'force',
      );
      if (forced.length > 1) invalid(`resource ${family} has multiple forced points`);
    }
  }

  const transactions = new Map(
    graph.occurrences.flatMap((entry) =>
      entry.timeline.transactions.map((item) => [item.owner, item] as const),
    ),
  );
  const occurrenceByOwner = new Map(
    graph.occurrences.flatMap((entry) =>
      entry.timeline.transactions.map((item) => [item.owner, entry.id] as const),
    ),
  );
  const transactionCount = graph.occurrences.reduce(
    (count, entry) => count + entry.timeline.transactions.length,
    0,
  );
  if (transactions.size !== transactionCount)
    invalid('transaction owners must be unique across the execution plan');

  const dependencyKeys = new Set<string>();
  const dependencyGraph = new Map<string, string[]>();
  for (const entry of graph.occurrences) {
    if (entry.anomaly !== undefined && entry.biomeKey !== 'G')
      invalid(`${entry.id} anomaly payload is only supported for G occurrences`);
    const owners = new Set(entry.timeline.transactions.map((item) => item.owner));
    for (const dependency of entry.timeline.dependencies) {
      if (!owners.has(dependency.owner) || !transactions.has(dependency.afterOwner))
        invalid(`${entry.id} has an unresolved dependency owner`);
      if (dependency.owner === dependency.afterOwner) invalid(`${entry.id} has a self dependency`);
      const dependentOccurrenceId = occurrenceByOwner.get(dependency.owner);
      const prerequisiteOccurrenceId = occurrenceByOwner.get(dependency.afterOwner);
      if (dependentOccurrenceId !== entry.id)
        invalid(`${entry.id} has a dependency owner outside its occurrence`);
      if (dependentOccurrenceId !== prerequisiteOccurrenceId)
        invalid(`${entry.id} has a cross-occurrence dependency`);
      const dependencyKey = `${dependency.owner}\u0000${dependency.afterOwner}`;
      if (dependencyKeys.has(dependencyKey))
        invalid(`duplicate dependency ${dependency.owner} after ${dependency.afterOwner}`);
      dependencyKeys.add(dependencyKey);
      const afterOwners = dependencyGraph.get(dependency.owner) ?? [];
      afterOwners.push(dependency.afterOwner);
      dependencyGraph.set(dependency.owner, afterOwners);
    }
    const obligationCounts = new Map<string, number>();
    for (const obligation of entry.timeline.obligations) {
      if (!owners.has(obligation.owner)) invalid(`${entry.id} has an unresolved obligation owner`);
      obligationCounts.set(obligation.owner, (obligationCounts.get(obligation.owner) ?? 0) + 1);
    }
    for (const transaction of entry.timeline.transactions) {
      const expectedCount = transaction.kind === 'acquisition' ? 0 : 1;
      if ((obligationCounts.get(transaction.owner) ?? 0) !== expectedCount) {
        invalid(
          transaction.kind === 'acquisition'
            ? `${entry.id} must not publish an acquisition obligation for ${transaction.owner}`
            : `${entry.id} must publish exactly one obligation for ${transaction.owner}`,
        );
      }
    }
    if (entry.roomExitConformance !== undefined) {
      if (entry.diagnostics?.beforeRoomExit === undefined)
        invalid(`${entry.id} room-exit conformance has no beforeRoomExit Run State`);
      const kinds = entry.roomExitConformance.facts.map((fact) => fact.kind);
      if (new Set(kinds).size !== kinds.length)
        invalid(`${entry.id} room-exit conformance has duplicate facts`);
      if (entry.diagnostics?.beforeRoomExit !== undefined && !kinds.includes('elementCounts'))
        invalid(`${entry.id} room-exit conformance is missing elementCounts`);
    } else if (entry.diagnostics?.beforeRoomExit !== undefined) {
      invalid(`${entry.id} beforeRoomExit Run State is missing room-exit conformance`);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (owner: string): void => {
    if (visiting.has(owner)) invalid('execution dependencies contain a cycle');
    if (visited.has(owner)) return;
    visiting.add(owner);
    for (const afterOwner of dependencyGraph.get(owner) ?? []) visit(afterOwner);
    visiting.delete(owner);
    visited.add(owner);
  };
  for (const owner of transactions.keys()) visit(owner);
  if (graph.startState !== undefined)
    validateStartState(graph, graph.startState, occurrences, invalid);
}
