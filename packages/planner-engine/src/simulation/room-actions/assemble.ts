import { assessGeneratedPickupPlacement } from '../../authored-project/generated-pickup-placement';
import {
  createBiomeAddress,
  createRoomActionAddress,
  type OccurrenceAddress,
  type AcquisitionEntryAddress,
} from '../../authored-project/addresses';
import { roomActionKey } from '../../authored-project/room-actions/state';
import type { RoomActionReference } from '../../authored-project/model';
import type { AcquisitionEntrySourceFamily } from '../../authored-project/acquisition/entry-source-family';
import {
  roomLifecycleWindowOrdinal,
  scopeRoomLifecycleStructure,
  type RoomLifecycleStructure,
} from '../../authored-project/room-actions/lifecycle-structure';
import {
  assessRoomActionInsertion,
  assessRoomActionOrder,
  keepsTerminalActionLast,
  roomActionOrderContext,
  roomActionPlacementBlockers,
} from '../../authored-project/room-actions/order-assessment';
import type {
  RoomActionCheckpoint,
  RoomActionContribution,
  RoomActionProposal,
  RoomActionRoster,
  RoomActionRosterContribution,
  RoomActionRow,
} from './model';
import type { PlannerTimelineDependency, PlannerTimelineNode } from '../timeline-facts';
import { withRequiredScopes } from './required-scope';

function frozen<T>(value: T): T {
  return Object.freeze(value);
}

export function assembleRoomActionRoster(options: {
  readonly owner: OccurrenceAddress;
  readonly order: readonly RoomActionReference[];
  readonly contributions: readonly RoomActionRosterContribution[];
  /** What created each authored pickup without an active contribution, by action key. */
  readonly retainedSourceFamilies?: ReadonlyMap<string, AcquisitionEntrySourceFamily>;
  readonly lifecycleStructure: RoomLifecycleStructure;
  readonly canonicalRequiredInsertions?: readonly {
    readonly actionKey: string;
    readonly toIndex: number;
  }[];
  /** An action nothing may follow (a left switch press: leaving ends the room). */
  readonly terminalActionKey?: string;
}): RoomActionRoster {
  const actions = options.contributions.filter(
    (entry): entry is RoomActionContribution => entry.kind === 'action',
  );
  const context = roomActionOrderContext({
    contributions: options.contributions,
    lifecycleStructure: options.lifecycleStructure,
    ...(options.terminalActionKey === undefined
      ? {}
      : { terminalActionKey: options.terminalActionKey }),
  });
  const active = context.active;
  const issues = assessRoomActionOrder(options.order, context);
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
    const sourceFamily =
      entry === undefined
        ? options.retainedSourceFamilies?.get(roomActionKey(reference))
        : entry.sourceFamily;
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
      ...(sourceFamily === undefined ? {} : { sourceFamily }),
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
        ...(action.sourceFamily === undefined ? {} : { sourceFamily: action.sourceFamily }),
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
      if (participationOwnedByFeature(row.reference)) continue;
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
      if (participationOwnedByFeature(row.reference)) continue;
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
    if (!authoredKeys.has(row.key) && !participationOwnedByFeature(row.reference)) {
      // A required row may be inserted wherever its window and dependencies
      // allow; its canonical insertion stays authorable as the default restore.
      const canonicalIndex =
        row.participation === 'required'
          ? options.canonicalRequiredInsertions?.find(
              (candidate) => candidate.actionKey === row.key,
            )?.toIndex
          : undefined;
      for (let toIndex = 0; toIndex <= options.order.length; toIndex += 1) {
        const assessment = assessRoomActionInsertion(
          options.order,
          row.reference,
          toIndex,
          context,
        );
        if (assessment.followsTerminal) continue;
        if (toIndex === canonicalIndex) {
          proposals.push(
            frozen({
              kind: 'insert',
              reference: row.reference,
              toIndex,
              order: assessment.order,
              structurallyAuthorable: true,
              canonical: true,
              blockers: frozen([]),
            }),
          );
          continue;
        }
        proposals.push(
          frozen({
            kind: 'insert',
            reference: row.reference,
            toIndex,
            order: assessment.order,
            structurallyAuthorable: assessment.structurallyAuthorable,
            blockers: assessment.blockers,
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
      if (!keepsTerminalActionLast(options.order, order, options.terminalActionKey)) continue;
      const blockers = roomActionPlacementBlockers(order, context);
      proposals.push(
        frozen({
          kind: 'move',
          reference,
          fromIndex,
          toIndex,
          anchorIndex: toIndex < fromIndex ? toIndex : toIndex + 1,
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
            row.placementAssessment.source.shrine.occurrenceId !== owner.occurrenceId ||
            row.placementAssessment.source.shrine.biomeKey !== owner.biomeKey),
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

/** Shop, Shrine and Well purchases and the Postboss rack change only through their feature's command. */
function participationOwnedByFeature(reference: RoomActionReference): boolean {
  return (
    reference.kind === 'interactShopOffer' ||
    reference.kind === 'interactInfernalContractPedestal' ||
    reference.kind === 'purchaseHermesShrineOffer' ||
    reference.kind === 'purchaseStygianWellOffer' ||
    reference.kind === 'interactKeepsakeRack'
  );
}
