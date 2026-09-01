import { ExecutionCompilerError as CompilerError } from '../assembler-errors';
import type { ExecutionOccurrence, ExecutionSemanticProduct } from '../model';

export function validateExecutionProduct(product: ExecutionSemanticProduct): void {
  const occurrences = new Map(product.occurrences.map((occurrence) => [occurrence.id, occurrence]));
  if (occurrences.size !== product.occurrences.length)
    throw new CompilerError('executionCoverageMissing', 'execution occurrence IDs are not unique');
  const selected = new Set(product.selectedOccurrenceIds);
  if (selected.size !== product.selectedOccurrenceIds.length)
    throw new CompilerError(
      'executionCoverageMissing',
      'selected occurrence cursor contains duplicates',
    );
  for (const id of product.selectedOccurrenceIds) {
    if (!occurrences.has(id))
      throw new CompilerError('executionCoverageMissing', `selected occurrence ${id} is missing`);
  }
  if (
    product.selectedOccurrenceIds.length === 0 ||
    product.selectedOccurrenceIds[0] !== product.occurrences[0]?.id
  )
    throw new CompilerError(
      'executionCoverageMissing',
      'selected occurrence cursor has no opening',
    );
  const assertRoomReference = (
    reference: { readonly id: string; readonly biomeKey: string; readonly gameName: string },
    label: string,
  ): void => {
    const target = occurrences.get(reference.id);
    if (target === undefined)
      throw new CompilerError('executionCoverageMissing', `${label} ${reference.id} is missing`);
    if (target.biomeKey !== reference.biomeKey || target.gameName !== reference.gameName)
      throw new CompilerError(
        'executionCoverageMissing',
        `${label} ${reference.id} contradicts its occurrence identity`,
      );
  };
  const continuations = (occurrence: ExecutionOccurrence): Set<string> => {
    const result = new Set<string>();
    if (occurrence.doors.kind === 'batch') {
      for (const target of occurrence.doors.targets) {
        assertRoomReference(target.room, `door target in ${occurrence.id}`);
        result.add(target.room.id);
      }
    } else if (occurrence.doors.kind === 'fixed') {
      assertRoomReference(occurrence.doors.target, `fixed target in ${occurrence.id}`);
      result.add(occurrence.doors.target.id);
    }
    for (const additional of occurrence.overview.additional ?? []) {
      assertRoomReference(additional.room, `additional continuation in ${occurrence.id}`);
      result.add(additional.room.id);
    }
    return result;
  };
  for (const occurrence of product.occurrences) continuations(occurrence);
  const selectedIndex = new Map(
    product.selectedOccurrenceIds.map((id, index) => [id, index] as const),
  );
  const transactionOwners = new Map(
    product.occurrences.flatMap((occurrence) =>
      occurrence.timeline.transactions.map(
        (transaction) => [transaction.owner, transaction] as const,
      ),
    ),
  );
  const transactionCount = product.occurrences.reduce(
    (count, occurrence) => count + occurrence.timeline.transactions.length,
    0,
  );
  if (transactionOwners.size !== transactionCount)
    throw new CompilerError(
      'executionCoverageMissing',
      'execution transaction owners are not globally unique',
    );
  const retainedProducers = new Set<string>();
  for (const retained of product.wellRetainedEffects) {
    if (retainedProducers.has(retained.producerOwner))
      throw new CompilerError(
        'executionCoverageMissing',
        `duplicate retained Well effect for ${retained.producerOwner}`,
      );
    retainedProducers.add(retained.producerOwner);
    const producer = transactionOwners.get(retained.producerOwner);
    const consumer = transactionOwners.get(retained.consumerOwner);
    if (producer?.kind !== 'wellPurchase')
      throw new CompilerError(
        'executionCoverageMissing',
        `retained Well producer ${retained.producerOwner} is missing`,
      );
    if (producer.effect !== retained.effect)
      throw new CompilerError(
        'executionCoverageMissing',
        `retained Well effect disagrees for ${retained.producerOwner}`,
      );
    if (consumer === undefined || retained.consumerOwner === retained.producerOwner)
      throw new CompilerError(
        'executionCoverageMissing',
        `retained Well consumer ${retained.consumerOwner} is missing`,
      );
    if (
      retained.effect === 'extended' &&
      (consumer.kind !== 'wellPurchase' || !consumer.extendedDirectPurchase)
    )
      throw new CompilerError(
        'executionCoverageMissing',
        `retained Extended consumer ${retained.consumerOwner} is not a direct Well purchase`,
      );
    if (
      (retained.effect === 'yarn' || retained.effect === 'hymn') &&
      ((consumer.kind !== 'acquisition' && consumer.kind !== 'shopPurchase') ||
        !consumer.roles.some((role) => role.traitOffer !== undefined))
    )
      throw new CompilerError(
        'executionCoverageMissing',
        `retained ${retained.effect} consumer ${retained.consumerOwner} has no trait offer`,
      );
    const producerOccurrence = product.occurrences.find((entry) =>
      entry.timeline.transactions.some(
        (transaction) => transaction.owner === retained.producerOwner,
      ),
    );
    const consumerOccurrence = product.occurrences.find((entry) =>
      entry.timeline.transactions.some(
        (transaction) => transaction.owner === retained.consumerOwner,
      ),
    );
    const producerOrder =
      producerOccurrence === undefined ? undefined : selectedIndex.get(producerOccurrence.id);
    const consumerOrder =
      consumerOccurrence === undefined ? undefined : selectedIndex.get(consumerOccurrence.id);
    if (
      producerOccurrence === undefined ||
      consumerOccurrence === undefined ||
      producerOrder === undefined ||
      consumerOrder === undefined ||
      consumerOrder < producerOrder
    )
      throw new CompilerError(
        'executionCoverageMissing',
        `retained Well correlation is outside the selected route: ${retained.producerOwner}`,
      );
    if (producerOrder === consumerOrder)
      throw new CompilerError(
        'executionCoverageMissing',
        `retained Well correlation does not cross occurrences: ${retained.producerOwner}`,
      );
  }
  for (let index = 0; index + 1 < product.selectedOccurrenceIds.length; index += 1) {
    const predecessor = occurrences.get(product.selectedOccurrenceIds[index]!);
    const successor = product.selectedOccurrenceIds[index + 1]!;
    if (predecessor === undefined || !continuations(predecessor).has(successor))
      throw new CompilerError(
        'executionCoverageMissing',
        `selected occurrence cursor is disconnected at ${product.selectedOccurrenceIds[index]}`,
      );
  }
  for (const occurrence of product.occurrences) {
    if (occurrence.anomaly !== undefined && occurrence.biomeKey !== 'G')
      throw new CompilerError(
        'executionCoverageMissing',
        `Anomaly payload ${occurrence.id} is outside supported G execution`,
      );
    const transactionOwners = new Set(
      occurrence.timeline.transactions.map((transaction) => transaction.owner),
    );
    for (const transaction of occurrence.timeline.transactions) {
      if (transaction.kind !== 'acquisition' && transaction.kind !== 'shopPurchase') continue;
      for (const role of transaction.roles) {
        if (role.producer === undefined || role.producer.sourceOwner === transaction.sourceOwner)
          continue;
        const sourceTransaction = occurrence.timeline.transactions.find(
          (candidate) =>
            (candidate.kind === 'acquisition' || candidate.kind === 'shopPurchase') &&
            candidate.sourceOwner === role.producer!.sourceOwner &&
            candidate.roles.some(
              (candidateRole) => candidateRole.role === role.producer!.sourceRole,
            ),
        );
        if (sourceTransaction === undefined)
          throw new CompilerError(
            'executionCoverageMissing',
            `generated acquisition ${transaction.owner} lacks its source transaction`,
          );
        if (
          !occurrence.timeline.dependencies.some(
            (dependency) =>
              dependency.owner === transaction.owner &&
              dependency.afterOwner === sourceTransaction.owner,
          )
        )
          throw new CompilerError(
            'executionCoverageMissing',
            `generated acquisition ${transaction.owner} lacks its source dependency`,
          );
      }
    }
    for (const dependency of occurrence.timeline.dependencies) {
      if (!transactionOwners.has(dependency.owner) || !transactionOwners.has(dependency.afterOwner))
        throw new CompilerError(
          'executionCoverageMissing',
          `invalid dependency in ${occurrence.id}: ${dependency.owner} after ${dependency.afterOwner}`,
        );
      if (dependency.owner === dependency.afterOwner)
        throw new CompilerError('executionCoverageMissing', `self dependency in ${occurrence.id}`);
    }
    const dependencyGraph = new Map<string, string[]>();
    for (const dependency of occurrence.timeline.dependencies) {
      const after = dependencyGraph.get(dependency.owner) ?? [];
      after.push(dependency.afterOwner);
      dependencyGraph.set(dependency.owner, after);
    }
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (owner: string): void => {
      if (visiting.has(owner))
        throw new CompilerError('executionCoverageMissing', `dependency cycle in ${occurrence.id}`);
      if (visited.has(owner)) return;
      visiting.add(owner);
      for (const afterOwner of dependencyGraph.get(owner) ?? []) visit(afterOwner);
      visiting.delete(owner);
      visited.add(owner);
    };
    for (const owner of transactionOwners) visit(owner);
    const streamKeys = new Set<string>();
    for (const stream of occurrence.timeline.streams) {
      if (streamKeys.has(stream.key))
        throw new CompilerError('executionCoverageMissing', `duplicate stream in ${occurrence.id}`);
      streamKeys.add(stream.key);
      if (stream.owners.length === 0 || new Set(stream.owners).size !== stream.owners.length)
        throw new CompilerError('executionCoverageMissing', `invalid stream in ${occurrence.id}`);
      for (const owner of stream.owners) {
        if (!transactionOwners.has(owner))
          throw new CompilerError(
            'executionCoverageMissing',
            `stream owner ${owner} is missing in ${occurrence.id}`,
          );
      }
    }
    for (const obligation of occurrence.timeline.obligations) {
      if (!transactionOwners.has(obligation.owner))
        throw new CompilerError(
          'executionCoverageMissing',
          `obligation owner ${obligation.owner} is missing in ${occurrence.id}`,
        );
    }
  }
}
