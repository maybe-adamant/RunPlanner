import {
  createBiomeAddress,
  createCompletionRoomActionAddress,
  createRoomActionAddress,
  type CompletionRoomAddress,
  type OccurrenceAddress,
} from '../../authored-project/addresses';
import { roomActionKey } from '../../authored-project/room-actions';
import type { RoomActionReference } from '../../authored-project/model';
import {
  roomLifecycleWindowOrdinal,
  scopeRoomLifecycleStructure,
  type RoomLifecycleStructure,
} from '../../authored-project/room-action-domain';
import type {
  RoomActionCheckpoint,
  RoomActionCheckpointContribution,
  RoomActionContribution,
  RoomActionProposal,
  RoomActionRoster,
  RoomActionRosterContribution,
  RoomActionRosterIssue,
  RoomActionRow,
} from './model';

function frozen<T>(value: T): T {
  return Object.freeze(value);
}

function assessOrder(
  order: readonly RoomActionReference[],
  active: ReadonlyMap<string, RoomActionContribution>,
  checkpoints: ReadonlyMap<string, RoomActionCheckpointContribution>,
  lifecycleStructure: RoomLifecycleStructure,
): readonly RoomActionRosterIssue[] {
  const issues: RoomActionRosterIssue[] = [];
  const indexes = new Map(order.map((reference, index) => [roomActionKey(reference), index]));
  const checkpointAfterIndex = (checkpointKey: string): number => {
    if (!checkpointKey.startsWith('nextPhaseUsable:')) return -1;
    const checkpoint = checkpoints.get(checkpointKey);
    if (checkpoint === undefined) return -1;
    const required = [...active.values()].filter((entry) => entry.participation === 'required');
    const wheelKey = checkpointKey.slice('nextPhaseUsable:'.length);
    const matching = required.filter(
      (entry) => entry.window.kind === 'shipPostCombat' && entry.window.wheelKey === wheelKey,
    );
    return matching.reduce(
      (rank, entry) => Math.max(rank, indexes.get(roomActionKey(entry.reference)) ?? -1),
      -1,
    );
  };
  for (const reference of order) {
    const entry = active.get(roomActionKey(reference));
    if (entry === undefined) {
      issues.push(frozen({ kind: 'stale', reference }));
      continue;
    }
    for (const dependency of entry.dependencies) {
      const ownIndex = indexes.get(roomActionKey(reference));
      if (dependency.kind === 'afterAction') {
        const dependencyIndex = indexes.get(roomActionKey(dependency.action));
        if (dependencyIndex !== undefined && ownIndex !== undefined && ownIndex > dependencyIndex)
          continue;
        issues.push(
          frozen({
            kind: 'dependency',
            reference,
            detail: `must follow ${roomActionKey(dependency.action)}`,
          }),
        );
        continue;
      }
      const checkpoint = checkpoints.get(dependency.checkpointKey);
      if (checkpoint === undefined || ownIndex === undefined) {
        issues.push(
          frozen({
            kind: 'dependency',
            reference,
            detail: `has unknown checkpoint ${dependency.checkpointKey}`,
          }),
        );
        continue;
      }
      const ownRank = roomLifecycleWindowOrdinal(lifecycleStructure, entry.window);
      const checkpointWindowRank = roomLifecycleWindowOrdinal(
        lifecycleStructure,
        checkpoint.window,
      );
      const valid =
        dependency.kind === 'afterCheckpoint'
          ? ownRank >= checkpointWindowRank &&
            indexes.get(roomActionKey(reference))! >= checkpointAfterIndex(dependency.checkpointKey)
          : ownRank <= checkpointWindowRank;
      if (!valid) {
        issues.push(
          frozen({
            kind: 'dependency',
            reference,
            detail: `${dependency.kind} ${dependency.checkpointKey}`,
          }),
        );
      }
    }
  }
  for (const entry of active.values()) {
    if (entry.participation === 'required' && !indexes.has(roomActionKey(entry.reference))) {
      issues.push(frozen({ kind: 'unrankedRequired', reference: entry.reference }));
    }
  }
  const ranked = order.flatMap((reference) => {
    const entry = active.get(roomActionKey(reference));
    return entry === undefined ? [] : [entry];
  });
  for (let index = 1; index < ranked.length; index += 1) {
    const left = ranked[index - 1]!;
    const right = ranked[index]!;
    if (
      roomLifecycleWindowOrdinal(lifecycleStructure, left.window) >
      roomLifecycleWindowOrdinal(lifecycleStructure, right.window)
    ) {
      issues.push(
        frozen({
          kind: 'window',
          reference: right.reference,
          detail: 'crosses a fixed lifecycle window',
        }),
      );
    }
  }
  return frozen(issues);
}

export function assembleRoomActionRoster(options: {
  readonly owner: OccurrenceAddress | (CompletionRoomAddress & { readonly role: 'postboss' });
  readonly order: readonly RoomActionReference[];
  readonly contributions: readonly RoomActionRosterContribution[];
  readonly lifecycleStructure: RoomLifecycleStructure;
  readonly canonicalRequiredInsertions?: readonly {
    readonly actionKey: string;
    readonly toIndex: number;
  }[];
}): RoomActionRoster {
  const actions = options.contributions.filter(
    (entry): entry is RoomActionContribution => entry.kind === 'action',
  );
  const active = new Map(actions.map((entry) => [roomActionKey(entry.reference), entry]));
  const checkpointContributions = new Map(
    options.contributions
      .filter((entry): entry is RoomActionCheckpointContribution => entry.kind === 'checkpoint')
      .map((entry) => [entry.checkpointKey, entry]),
  );
  const issues = assessOrder(
    options.order,
    active,
    checkpointContributions,
    options.lifecycleStructure,
  );
  const issueKeys = new Set(
    issues
      .filter((issue) => issue.kind !== 'unrankedRequired')
      .map((issue) => roomActionKey(issue.reference)),
  );
  const rows: RoomActionRow[] = options.order.map((reference, index) => {
    const entry = active.get(roomActionKey(reference));
    return frozen({
      reference,
      key: roomActionKey(reference),
      owner:
        entry?.owner ??
        (options.owner.kind === 'occurrence'
          ? createRoomActionAddress(
              createBiomeAddress(options.owner.routeKey, options.owner.biomeKey),
              options.owner.occurrenceId,
              roomActionKey(reference),
            )
          : createCompletionRoomActionAddress(options.owner, roomActionKey(reference))),
      participation: entry?.participation ?? 'optional',
      window: entry?.window ?? frozen({ kind: 'standard', phase: 'afterCombat' }),
      dependencies: entry?.dependencies ?? frozen([]),
      rank: index + 1,
      stale: entry === undefined,
      executable: entry !== undefined && !issueKeys.has(roomActionKey(reference)),
    });
  });
  for (const action of actions) {
    if (
      options.order.some(
        (reference) => roomActionKey(reference) === roomActionKey(action.reference),
      )
    )
      continue;
    rows.push(
      frozen({
        reference: action.reference,
        key: roomActionKey(action.reference),
        owner: action.owner,
        participation: action.participation,
        window: action.window,
        dependencies: action.dependencies,
        rank: null,
        stale: false,
        executable: false,
      }),
    );
  }
  const proposals: RoomActionProposal[] = [];
  const authoredKeys = new Set(options.order.map(roomActionKey));
  for (const row of rows) {
    if (row.stale) {
      if (row.reference.kind === 'interactShopOffer') continue;
      const fromIndex = options.order.findIndex(
        (reference) => roomActionKey(reference) === row.key,
      );
      proposals.push(
        frozen({
          kind: 'remove',
          reference: row.reference,
          fromIndex,
          order: frozen(options.order.filter((_, index) => index !== fromIndex)),
          structurallyAuthorable: true,
        }),
      );
      continue;
    }
    if (row.rank !== null && row.participation === 'optional') {
      if (row.reference.kind === 'interactShopOffer') continue;
      const fromIndex = row.rank - 1;
      proposals.push(
        frozen({
          kind: 'remove',
          reference: row.reference,
          fromIndex,
          order: frozen(options.order.filter((_, index) => index !== fromIndex)),
          structurallyAuthorable: true,
        }),
      );
    }
    if (!authoredKeys.has(row.key)) {
      const canonicalRequired =
        row.participation === 'required'
          ? options.canonicalRequiredInsertions?.find(
              (candidate) => candidate.actionKey === row.key,
            )
          : undefined;
      if (canonicalRequired !== undefined) {
        const order = [...options.order];
        order.splice(canonicalRequired.toIndex, 0, row.reference);
        proposals.push(
          frozen({
            kind: 'insert',
            reference: row.reference,
            toIndex: canonicalRequired.toIndex,
            order: frozen(order),
            structurallyAuthorable: true,
          }),
        );
        continue;
      }
      for (let toIndex = 0; toIndex <= options.order.length; toIndex += 1) {
        const order = [...options.order];
        order.splice(toIndex, 0, row.reference);
        proposals.push(
          frozen({
            kind: 'insert',
            reference: row.reference,
            toIndex,
            order: frozen(order),
            structurallyAuthorable: !assessOrder(
              order,
              active,
              checkpointContributions,
              options.lifecycleStructure,
            ).some((issue) => issue.kind === 'dependency' || issue.kind === 'window'),
          }),
        );
      }
    }
  }
  for (let fromIndex = 0; fromIndex < options.order.length; fromIndex += 1) {
    const reference = options.order[fromIndex]!;
    if (!active.has(roomActionKey(reference))) continue;
    for (let toIndex = 0; toIndex < options.order.length; toIndex += 1) {
      if (fromIndex === toIndex) continue;
      const order = [...options.order];
      order.splice(fromIndex, 1);
      order.splice(toIndex, 0, reference);
      proposals.push(
        frozen({
          kind: 'move',
          reference,
          fromIndex,
          toIndex,
          order: frozen(order),
          structurallyAuthorable: !assessOrder(
            order,
            active,
            checkpointContributions,
            options.lifecycleStructure,
          ).some((issue) => issue.kind === 'dependency' || issue.kind === 'window'),
        }),
      );
    }
  }
  const lastRequiredRank = rows.reduce(
    (rank, row) =>
      row.rank !== null && row.participation === 'required' && row.window.kind !== 'postOutgoing'
        ? Math.max(rank, row.rank)
        : rank,
    0,
  );
  const checkpoints: RoomActionCheckpoint[] = options.contributions
    .filter((entry) => entry.kind === 'checkpoint')
    .map((entry) =>
      frozen({
        checkpointKey: entry.checkpointKey,
        label: entry.label,
        window: entry.window,
        afterRank:
          entry.checkpointKey === 'outgoingGeneration'
            ? lastRequiredRank
            : entry.checkpointKey.startsWith('nextPhaseUsable:')
              ? (() => {
                  const wheelKey = entry.checkpointKey.slice('nextPhaseUsable:'.length);
                  return rows.reduce(
                    (rank, row) =>
                      row.rank !== null &&
                      row.participation === 'required' &&
                      row.window.kind === 'shipPostCombat' &&
                      row.window.wheelKey === wheelKey
                        ? Math.max(rank, row.rank)
                        : rank,
                    0,
                  );
                })()
              : entry.checkpointKey === 'exitUsable'
                ? rows.reduce(
                    (rank, row) =>
                      row.rank !== null && row.participation === 'required'
                        ? Math.max(rank, row.rank)
                        : rank,
                    0,
                  )
                : rows.reduce(
                    (rank, row) =>
                      row.rank !== null &&
                      roomLifecycleWindowOrdinal(options.lifecycleStructure, row.window) <=
                        roomLifecycleWindowOrdinal(options.lifecycleStructure, entry.window)
                        ? Math.max(rank, row.rank)
                        : rank,
                    0,
                  ),
      }),
    );
  return frozen({
    lifecycleStructure: options.lifecycleStructure,
    rows: frozen(rows),
    checkpoints: frozen(checkpoints),
    issues,
    proposals: frozen(proposals),
    valid: issues.length === 0,
  });
}

/** Restrict execution to an engine-assessed active phase prefix without mutating authorship. */
export function scopeRoomActionRoster(
  roster: RoomActionRoster,
  activePhaseKeys: readonly string[],
): RoomActionRoster {
  const lifecycleStructure = scopeRoomLifecycleStructure(
    roster.lifecycleStructure,
    activePhaseKeys,
  );
  if (lifecycleStructure === roster.lifecycleStructure) return roster;
  const active = new Set(activePhaseKeys);
  return frozen({
    ...roster,
    lifecycleStructure,
    rows: frozen(
      roster.rows.map((row) =>
        'phaseKey' in row.reference && !active.has(row.reference.phaseKey)
          ? frozen({ ...row, stale: true, executable: false })
          : row,
      ),
    ),
  });
}
