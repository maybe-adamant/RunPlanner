import { assessGeneratedPickupPlacement } from '../../authored-project/generated-pickup-placement';
import {
  createBiomeAddress,
  createRoomActionAddress,
  type OccurrenceAddress,
  type AcquisitionEntryAddress,
} from '../../authored-project/addresses';
import { roomActionKey } from '../../authored-project/room-actions/state';
import type { RoomActionReference } from '../../authored-project/model';
import {
  roomLifecycleWindowOrdinal,
  scopeRoomLifecycleStructure,
  type RoomLifecycleStructure,
} from '../../authored-project/room-actions/lifecycle-structure';
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
import type { PlannerTimelineDependency, PlannerTimelineNode } from '../timeline-facts';
import { withRequiredScopes } from './required-scope';

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
            dependency,
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
            dependency,
            checkpointUnavailable: true,
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
            dependency,
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
          window: right.window,
          precedingAction: left.reference,
          precedingWindow: left.window,
        }),
      );
    }
  }
  return frozen(issues);
}

export function assembleRoomActionRoster(options: {
  readonly owner: OccurrenceAddress;
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
      .filter(
        (issue) =>
          issue.kind !== 'unrankedRequired' &&
          !(issue.kind === 'stale' && issue.reference.kind === 'sellPurgingPoolTrait'),
      )
      .map((issue) => roomActionKey(issue.reference)),
  );
  const rows: RoomActionRow[] = options.order.map((reference, index) => {
    const entry = active.get(roomActionKey(reference));
    // A cleared Pool slot retains its sale in chronological authoring. It has
    // no active contribution, but must still reach post-outgoing simulation so
    // that the exact stale-sale finding is emitted instead of silently
    // dropping the action.
    const retainedPurgingPoolSale =
      entry === undefined && reference.kind === 'sellPurgingPoolTrait';
    return frozen({
      reference,
      key: roomActionKey(reference),
      owner:
        entry?.owner ??
        createRoomActionAddress(
          createBiomeAddress(options.owner.routeKey, options.owner.biomeKey),
          options.owner.occurrenceId,
          roomActionKey(reference),
        ),
      participation: entry?.participation ?? 'optional',
      window:
        entry?.window ??
        (retainedPurgingPoolSale
          ? frozen({ kind: 'postOutgoing' })
          : frozen({ kind: 'standard', phase: 'afterCombat' })),
      dependencies: entry?.dependencies ?? frozen([]),
      rank: index + 1,
      stale: entry === undefined,
      executable:
        (entry !== undefined || retainedPurgingPoolSale) &&
        !issueKeys.has(roomActionKey(reference)),
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
          blockers: frozen([]),
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
          blockers: frozen([]),
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
            blockers: frozen([]),
          }),
        );
        continue;
      }
      for (let toIndex = 0; toIndex <= options.order.length; toIndex += 1) {
        const order = [...options.order];
        order.splice(toIndex, 0, row.reference);
        const blockers = frozen(
          assessOrder(order, active, checkpointContributions, options.lifecycleStructure).filter(
            (issue) => issue.kind === 'dependency' || issue.kind === 'window',
          ),
        );
        proposals.push(
          frozen({
            kind: 'insert',
            reference: row.reference,
            toIndex,
            order: frozen(order),
            structurallyAuthorable: blockers.length === 0,
            blockers,
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
      const blockers = frozen(
        assessOrder(order, active, checkpointContributions, options.lifecycleStructure).filter(
          (issue) => issue.kind === 'dependency' || issue.kind === 'window',
        ),
      );
      proposals.push(
        frozen({
          kind: 'move',
          reference,
          fromIndex,
          toIndex,
          order: frozen(order),
          structurallyAuthorable: blockers.length === 0,
          blockers,
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
  const activeByKey = new Map(
    rows.flatMap((row) => (row.stale || row.rank === null ? [] : [[row.key, row] as const])),
  );
  const timelineNodes: PlannerTimelineNode[] = [];
  const timelineDependencies: PlannerTimelineDependency[] = [];
  for (const row of rows) {
    if (row.stale || row.rank === null) continue;
    timelineNodes.push(
      frozen({
        owner: row.owner,
        // An active row is authored participation regardless of whether the
        // room originally offered it as optional. Execution publication drops
        // inactive optional rows and publishes every active row as intent.
        included: true,
      }),
    );
    for (const dependency of row.dependencies) {
      if (dependency.kind !== 'afterAction' || dependency.authoringOnly === true) continue;
      const after = activeByKey.get(roomActionKey(dependency.action));
      if (after === undefined) continue;
      timelineDependencies.push(frozen({ owner: row.owner, afterOwner: after.owner }));
    }
  }
  return frozen({
    lifecycleStructure: options.lifecycleStructure,
    rows: withRequiredScopes(rows, options.lifecycleStructure),
    checkpoints: frozen(checkpoints),
    issues,
    proposals: frozen(proposals),
    timelineFacts: frozen({
      nodes: frozen(timelineNodes),
      dependencies: frozen(timelineDependencies),
    }),
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
    rows: withRequiredScopes(
      roster.rows.map((row) =>
        'phaseKey' in row.reference && !active.has(row.reference.phaseKey)
          ? frozen({ ...row, stale: true, executable: false })
          : row,
      ),
      lifecycleStructure,
    ),
  });
}

/** Authoring repair assessment does not change the evaluated roster's execution facts. */
export function assessRoomActionPlacements(
  route: import('../../authored-project/model').AuthoredRoutePlan,
  owner: OccurrenceAddress,
  roster: RoomActionRoster,
  reachedPlacements: readonly import('../rewards/acquisition/contracts').GeneratedPickupPlacement[] = [],
  acquisitionEntries: readonly {
    readonly address: AcquisitionEntryAddress;
    readonly kind: import('../rewards/acquisition/artifacts').DerivedAcquisitionEntryCandidateCapability['kind'];
    readonly participation?: 'required' | 'optional';
    readonly retainedSourceMismatch?: boolean;
  }[] = [],
): RoomActionRoster {
  const requiredGold = acquisitionEntries.some(
    (entry) =>
      entry.address.site.owner.kind === 'occurrence' &&
      entry.address.site.owner.occurrenceId === owner.occurrenceId &&
      entry.address.site.biomeKey === owner.biomeKey &&
      entry.address.site.pointKey === 'roomExit' &&
      entry.address.entryKey === 'echoDoubleShopReward' &&
      entry.kind === 'echoDoubleShopReward' &&
      entry.participation === 'required' &&
      entry.retainedSourceMismatch !== true,
  );
  const rows = roster.rows.map((row) => {
    const structural = assessGeneratedPickupPlacement(route, owner, row.reference);
    const reference = row.reference;
    const reached =
      reference.kind !== 'interactAcquisitionEntry'
        ? undefined
        : reachedPlacements.find(
            (placement) =>
              placement.address.site.owner.kind === 'occurrence' &&
              placement.address.site.owner.occurrenceId === owner.occurrenceId &&
              placement.address.site.biomeKey === owner.biomeKey &&
              placement.address.entryKey === reference.entryKey &&
              placement.address.site.pointKey === reference.siteKey,
          )?.assessment;
    const placementAssessment =
      structural?.kind === 'invalid' ? structural : (reached ?? structural);
    return placementAssessment === undefined ? row : frozen({ ...row, placementAssessment });
  });
  const invalidKeys = new Set(
    rows
      .filter(
        (row) =>
          row.placementAssessment?.kind === 'invalid' &&
          (row.placementAssessment.source.kind === 'clockedTraitPickup' ||
            row.placementAssessment.source.occurrenceId !== owner.occurrenceId ||
            row.placementAssessment.source.biomeKey !== owner.biomeKey),
      )
      .map((row) => row.key),
  );
  return frozen({
    ...roster,
    rows: frozen(rows),
    proposals: frozen([
      ...roster.proposals.filter(
        (proposal) =>
          !invalidKeys.has(roomActionKey(proposal.reference)) &&
          !(
            requiredGold &&
            proposal.kind === 'remove' &&
            proposal.reference.kind === 'interactAcquisitionEntry' &&
            proposal.reference.siteKey === 'roomExit' &&
            proposal.reference.entryKey === 'echoDoubleShopReward'
          ),
      ),
      ...rows
        .filter((row) => invalidKeys.has(row.key) && row.rank !== null)
        .map((row): RoomActionProposal =>
          frozen({
            kind:
              row.reference.kind === 'interactAcquisitionEntry' &&
              row.reference.siteKey === 'hermesShrineDelivery'
                ? 'unplace'
                : 'remove',
            reference: row.reference,
            fromIndex: row.rank! - 1,
            order: frozen(
              roster.rows
                .filter((candidate) => candidate.rank !== null && candidate.key !== row.key)
                .map((candidate) => candidate.reference),
            ),
            structurallyAuthorable: true,
            blockers: frozen([]),
          }),
        ),
    ]),
  });
}
