import type { BiomeLayout, Catalog, RoomDeclaration } from '../catalog-schema';

import type {
  BiomeTopology,
  ExitDecision,
  FieldsCombatAction,
  FieldsCombatState,
  OccurrenceId,
} from './model';
import { encounterEnvelopeSlots } from './room-state/encounters';
import { normalDecisionProgressionForLayout } from './topology/query';

export interface FieldsCageActionDomainEntry {
  readonly phaseKey: string;
  readonly slotKey: string;
}

export type FieldsActionOrderIssue =
  | { readonly kind: 'missing'; readonly action: FieldsCombatAction }
  | { readonly kind: 'inactive'; readonly action: FieldsCombatAction }
  | { readonly kind: 'dependency'; readonly action: FieldsCombatAction };

export interface FieldsActionOrderAssessment {
  readonly issues: readonly FieldsActionOrderIssue[];
  readonly valid: boolean;
}

export interface FieldsActionOrderProposal {
  readonly kind: 'insert' | 'move' | 'remove';
  readonly action: FieldsCombatAction;
  readonly fromIndex?: number;
  readonly toIndex?: number;
  readonly order: readonly FieldsCombatAction[];
  readonly assessment: FieldsActionOrderAssessment;
  /** This one edit either completes the sequence or strictly repairs it. */
  readonly structurallyAuthorable: boolean;
}

export function fieldsActionKey(action: FieldsCombatAction): string {
  return action.kind === 'completeCage'
    ? `complete:${action.phaseKey}`
    : `interact:${action.slotKey}`;
}

/** Exact declaration-owned cage phase/reward pairs in preparation order. */
export function fieldsCageActionDomain(
  catalog: Catalog,
  room: RoomDeclaration,
): readonly FieldsCageActionDomainEntry[] {
  if (room.mode.kind !== 'authored' || room.mode.templateKey !== 'FieldsCombat') {
    throw new Error(`${room.gameName} does not own Fields actions`);
  }
  const descriptor = room.localChildren.find(
    (child) => child.kind === 'boundedRewardSlots' && child.key === 'cages',
  );
  if (descriptor?.kind !== 'boundedRewardSlots') {
    throw new Error(`${room.gameName} has no bounded Fields cages`);
  }
  const pairs = encounterEnvelopeSlots(catalog, room, room.gameName).flatMap((phase) => {
    const attachment = phase.rewardAttachment;
    return attachment?.kind === 'localReward' && attachment.groupKey === descriptor.key
      ? [Object.freeze({ phaseKey: phase.key, slotKey: attachment.slotKey })]
      : [];
  });
  if (
    pairs.length !== descriptor.slotKeys.length ||
    pairs.some((pair, index) => pair.slotKey !== descriptor.slotKeys[index])
  ) {
    throw new Error(`${room.gameName} has an inconsistent Fields action domain`);
  }
  return Object.freeze(pairs);
}

export function createDefaultFieldsActionOrder(
  catalog: Catalog,
  room: RoomDeclaration,
  activeCageCount: number,
): readonly FieldsCombatAction[] {
  const domain = fieldsCageActionDomain(catalog, room);
  if (
    !Number.isInteger(activeCageCount) ||
    activeCageCount <= 0 ||
    activeCageCount > domain.length
  ) {
    throw new Error(`${room.gameName} cannot default ${String(activeCageCount)} Fields cages`);
  }
  return Object.freeze(
    domain
      .slice(0, activeCageCount)
      .flatMap((entry) => [
        Object.freeze({ kind: 'completeCage' as const, phaseKey: entry.phaseKey }),
        Object.freeze({ kind: 'interactCageReward' as const, slotKey: entry.slotKey }),
      ]),
  );
}

function fieldsCageCapacity(room: RoomDeclaration): number {
  const cages = room.localChildren.find(
    (child) => child.kind === 'boundedRewardSlots' && child.key === 'cages',
  );
  if (cages?.kind !== 'boundedRewardSlots') {
    throw new Error(`${room.gameName} has no Fields cage capacity`);
  }
  return cages.maxActiveSlots;
}

/** One Min/Max numeric policy shared by construction and selected simulation. */
export function deriveFieldsActiveCageCount(
  decision: ExitDecision,
  policy: {
    readonly minDoorCageRewards: number;
    readonly maxDoorCageRewards: number;
  },
  targetCapacities: readonly number[],
): number | undefined {
  if (decision.normal.kind !== 'batch' || decision.normal.batchState === null) return undefined;
  if (targetCapacities.some((capacity) => !Number.isInteger(capacity) || capacity <= 0)) {
    throw new Error('Fields target capacities must be positive integers');
  }
  return decision.normal.batchState.cageOutcome === 'min'
    ? policy.minDoorCageRewards
    : Math.min(policy.maxDoorCageRewards, ...targetCapacities);
}

/** Exact active count passed into a new or replacement Fields room default. */
export function fieldsDefaultActiveCageCount(options: {
  readonly catalog: Catalog;
  readonly layout: BiomeLayout;
  readonly topology: BiomeTopology;
  readonly decision: ExitDecision;
  readonly room: RoomDeclaration;
  readonly replacingOccurrenceId?: OccurrenceId;
}): number | undefined {
  const { catalog, layout, topology, decision, room, replacingOccurrenceId } = options;
  if (room.mode.kind !== 'authored' || room.mode.templateKey !== 'FieldsCombat') return undefined;
  const progression = normalDecisionProgressionForLayout(layout);
  if (
    progression?.batchPolicy.kind !== 'fields' ||
    decision.normal.kind !== 'batch' ||
    decision.normal.batchState === null
  ) {
    throw new Error(`${room.gameName} has no selected Fields batch outcome`);
  }
  const policy = progression.batchPolicy;
  const targetCapacities = decision.normal.targets.map((target) => {
    if (target.occurrenceId === replacingOccurrenceId) return fieldsCageCapacity(room);
    const occurrence = topology.occurrences.find(
      (candidate) => candidate.occurrenceId === target.occurrenceId,
    );
    const targetRoom =
      occurrence === undefined ? undefined : catalog.rooms.byKey[occurrence.gameName];
    return targetRoom?.mode.kind === 'authored' && targetRoom.mode.templateKey === 'FieldsCombat'
      ? fieldsCageCapacity(targetRoom)
      : policy.maxDoorCageRewards;
  });
  if (replacingOccurrenceId === undefined) targetCapacities.push(fieldsCageCapacity(room));
  return deriveFieldsActiveCageCount(decision, policy, targetCapacities);
}

export function assessFieldsActionOrder(
  catalog: Catalog,
  room: RoomDeclaration,
  state: FieldsCombatState,
  activeCageCount: number,
): FieldsActionOrderAssessment {
  const domain = fieldsCageActionDomain(catalog, room);
  if (
    !Number.isInteger(activeCageCount) ||
    activeCageCount <= 0 ||
    activeCageCount > domain.length
  ) {
    throw new Error(`${room.gameName} cannot assess ${String(activeCageCount)} Fields cages`);
  }
  const active = domain.slice(0, activeCageCount);
  const activeKeys = new Set(
    active.flatMap((entry) => [`complete:${entry.phaseKey}`, `interact:${entry.slotKey}`]),
  );
  const orderIndex = new Map(
    state.actionOrder.map((action, index) => [fieldsActionKey(action), index] as const),
  );
  const issues: FieldsActionOrderIssue[] = [];
  for (const action of state.actionOrder) {
    if (!activeKeys.has(fieldsActionKey(action))) {
      issues.push(Object.freeze({ kind: 'inactive', action }));
    }
  }
  for (const entry of active) {
    const completion = Object.freeze({
      kind: 'completeCage' as const,
      phaseKey: entry.phaseKey,
    });
    const interaction = Object.freeze({
      kind: 'interactCageReward' as const,
      slotKey: entry.slotKey,
    });
    const completionIndex = orderIndex.get(fieldsActionKey(completion));
    const interactionIndex = orderIndex.get(fieldsActionKey(interaction));
    if (completionIndex === undefined) {
      issues.push(Object.freeze({ kind: 'missing', action: completion }));
    }
    if (interactionIndex === undefined) {
      issues.push(Object.freeze({ kind: 'missing', action: interaction }));
    } else if (completionIndex === undefined || interactionIndex < completionIndex) {
      issues.push(Object.freeze({ kind: 'dependency', action: interaction }));
    }
  }
  return Object.freeze({ issues: Object.freeze(issues), valid: issues.length === 0 });
}

function frozenOrder(order: readonly FieldsCombatAction[]): readonly FieldsCombatAction[] {
  return Object.freeze(order.map((action) => Object.freeze({ ...action })));
}

/**
 * Complete bounded one-edit proposals from the current sequence. Required
 * active actions are never removable; inactive retained actions are.
 */
export function fieldsActionOrderProposals(
  catalog: Catalog,
  room: RoomDeclaration,
  state: FieldsCombatState,
  activeCageCount: number,
): readonly FieldsActionOrderProposal[] {
  const currentAssessment = assessFieldsActionOrder(catalog, room, state, activeCageCount);
  const proposals: FieldsActionOrderProposal[] = [];
  const seen = new Set<string>();
  const add = (
    proposal: Omit<FieldsActionOrderProposal, 'assessment' | 'order' | 'structurallyAuthorable'> & {
      readonly order: readonly FieldsCombatAction[];
    },
  ) => {
    const order = frozenOrder(proposal.order);
    const key = order.map(fieldsActionKey).join('|');
    if (seen.has(key)) return;
    seen.add(key);
    const assessment = assessFieldsActionOrder(
      catalog,
      room,
      Object.freeze({ ...state, actionOrder: order }),
      activeCageCount,
    );
    proposals.push(
      Object.freeze({
        ...proposal,
        order,
        assessment,
        structurallyAuthorable:
          assessment.valid || assessment.issues.length < currentAssessment.issues.length,
      }),
    );
  };

  for (const [fromIndex, action] of state.actionOrder.entries()) {
    for (let toIndex = 0; toIndex < state.actionOrder.length; toIndex += 1) {
      if (toIndex === fromIndex) continue;
      const order = [...state.actionOrder];
      order.splice(fromIndex, 1);
      order.splice(toIndex, 0, action);
      add({ kind: 'move', action, fromIndex, toIndex, order });
    }
  }

  for (const issue of currentAssessment.issues) {
    if (issue.kind === 'missing') {
      for (let toIndex = 0; toIndex <= state.actionOrder.length; toIndex += 1) {
        const order = [...state.actionOrder];
        order.splice(toIndex, 0, issue.action);
        add({ kind: 'insert', action: issue.action, toIndex, order });
      }
    } else if (issue.kind === 'inactive') {
      const fromIndex = state.actionOrder.findIndex(
        (action) => fieldsActionKey(action) === fieldsActionKey(issue.action),
      );
      if (fromIndex >= 0) {
        add({
          kind: 'remove',
          action: issue.action,
          fromIndex,
          order: state.actionOrder.filter((_, index) => index !== fromIndex),
        });
      }
    }
  }
  return Object.freeze(proposals);
}
