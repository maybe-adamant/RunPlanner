import { rerollAppendIndex, type ProjectDocument } from '@run-planner/engine/authored-project';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import type {
  CandidateProjectionSession,
  RewardDomainCandidateOwner,
} from '@planner/projections/candidates/candidateProjection';
import { declaredChoicesPicker } from '@planner/projections/contextual/contextualPicker';
import type { RewardPickerProjectionService } from '@planner/projections/rewards/rewardPicker';

import { StructuredWorkspaceProjectionContractError } from '../contract';
import type { WorkspaceRewardOfferResolver } from '../contracts/rewards';
import type { WorkspaceRoomRerollsInteraction } from '../contracts/structure';
import type {
  WorkspaceOccurrenceInteractionRequirement,
  WorkspaceRerollRewardTypes,
} from './interaction-requirements';

type RoomRerollsRequirement = Extract<
  WorkspaceOccurrenceInteractionRequirement,
  { readonly kind: 'roomRerolls' }
>;

function unavailableReason(reason: 'notRerollable'): string {
  switch (reason) {
    case 'notRerollable':
      return 'This door cannot be rerolled.';
  }
}

function bindRoomRerolls(
  input: {
    readonly candidates: CandidateProjectionSession;
    readonly project: ProjectDocument;
    readonly rewardPicker: RewardPickerProjectionService;
  },
  requirement: RoomRerollsRequirement,
): WorkspaceRoomRerollsInteraction {
  const { candidates, rewardPicker } = input;
  const rewardTypes = (types: WorkspaceRerollRewardTypes, selected?: ResolvedRewardOffer) =>
    types.kind === 'counted'
      ? candidates.countedRewardTypes(types.owner, types.binding, selected?.rewardType)
      : Object.freeze(selected === undefined ? [] : [selected.rewardType]);
  const resolver = (
    key: string,
    owner: RewardDomainCandidateOwner,
    types: WorkspaceRerollRewardTypes,
    selected?: ResolvedRewardOffer,
  ): WorkspaceRewardOfferResolver =>
    Object.freeze({
      key,
      choiceLabel: rewardPicker.choiceLabel,
      load: () => candidates.rewardDomain(owner, rewardTypes(types, selected), selected),
      model: rewardPicker.project,
      resolvesAtAcquisition: rewardPicker.resolvesAtAcquisition,
      summary: rewardPicker.summary,
    });
  const requireRow = (rowKey: string) => {
    const row = requirement.rows.find((candidate) => candidate.key === rowKey);
    if (row === undefined)
      throw new StructuredWorkspaceProjectionContractError(
        `${rowKey} is not a reroll of ${requirement.interactionKey}`,
      );
    return row;
  };
  const requireTarget = (targetKey: string) => {
    const target = requirement.targets.find((candidate) => candidate.key === targetKey);
    if (target === undefined)
      throw new StructuredWorkspaceProjectionContractError(
        `${targetKey} is not a reroll target of ${requirement.interactionKey}`,
      );
    return target;
  };
  const rowResolvers = new Map<string, WorkspaceRewardOfferResolver>();
  const pendingResolvers = new Map<string, WorkspaceRewardOfferResolver>();
  return Object.freeze({
    key: requirement.interactionKey,
    owner: requirement.owner,
    targets: (selectedKey: string | undefined) =>
      declaredChoicesPicker<string>(
        requirement.targets.map((target) =>
          Object.freeze({
            key: target.key,
            value: target.key,
            label: target.label,
            ...(target.unavailable === undefined
              ? {}
              : { disabled: true, explanation: unavailableReason(target.unavailable) }),
          }),
        ),
        selectedKey,
      ),
    rowReward: (rowKey: string) => {
      const existing = rowResolvers.get(rowKey);
      if (existing !== undefined) return existing;
      const row = requireRow(rowKey);
      const bound = resolver(
        `${requirement.interactionKey}:${rowKey}`,
        { kind: 'reroll', address: row.address },
        row.rewardTypes,
        row.reward,
      );
      rowResolvers.set(rowKey, bound);
      return bound;
    },
    pendingReward: (targetKey: string) => {
      const existing = pendingResolvers.get(targetKey);
      if (existing !== undefined) return existing;
      const target = requireTarget(targetKey);
      const bound = resolver(
        `${requirement.interactionKey}:pending:${targetKey}`,
        {
          kind: 'pendingReroll',
          address: target.rewardOwner,
          surface: requirement.surface,
          target: target.target,
        },
        target.rewardTypes,
      );
      pendingResolvers.set(targetKey, bound);
      return bound;
    },
    replaceRewardIntent: (rowKey: string, reward: ResolvedRewardOffer) => {
      const address = requireRow(rowKey).address;
      return Object.freeze({
        command:
          address.kind === 'hubReroll'
            ? Object.freeze({ kind: 'ReplaceHubRerollReward' as const, reroll: address, reward })
            : Object.freeze({ kind: 'ReplaceRerollReward' as const, action: address, reward }),
      });
    },
    removeIntent: (rowKey: string) => {
      const address = requireRow(rowKey).address;
      return Object.freeze({
        command:
          address.kind === 'hubReroll'
            ? Object.freeze({ kind: 'RemoveHubReroll' as const, reroll: address })
            : Object.freeze({ kind: 'RemoveRoomAction' as const, action: address }),
      });
    },
    appendIntent: (targetKey: string, reward: ResolvedRewardOffer) => {
      const index = rerollAppendIndex(input.project, requirement.surface);
      if (index === undefined)
        throw new StructuredWorkspaceProjectionContractError(
          `${requirement.interactionKey} has no authored room to append to`,
        );
      const owner = requirement.owner;
      const target = requireTarget(targetKey).target;
      if (owner.kind === 'hubDecision') {
        if (target.kind !== 'hubSlot')
          throw new StructuredWorkspaceProjectionContractError(
            `${requirement.interactionKey} names a Hub press by its board slot`,
          );
        return Object.freeze({
          command: Object.freeze({
            kind: 'InsertHubReroll' as const,
            hub: owner,
            hubSlotKey: target.hubSlotKey,
            reward,
            index,
          }),
        });
      }
      if (target.kind === 'hubSlot')
        throw new StructuredWorkspaceProjectionContractError(
          `${requirement.interactionKey} names a room press by its door`,
        );
      return Object.freeze({
        command: Object.freeze({
          kind: 'InsertReroll' as const,
          occurrence: owner,
          target,
          reward,
          index,
        }),
      });
    },
  });
}

/** Binds each room's and Hub stay's Rerolls list over engine candidates. */
export function bindRoomRerollInteractions(input: {
  readonly candidates: CandidateProjectionSession;
  readonly project: ProjectDocument;
  readonly requirements: Iterable<WorkspaceOccurrenceInteractionRequirement>;
  readonly rewardPicker: RewardPickerProjectionService;
}): ReadonlyMap<string, WorkspaceRoomRerollsInteraction> {
  const bound = new Map<string, WorkspaceRoomRerollsInteraction>();
  for (const requirement of input.requirements) {
    if (requirement.kind !== 'roomRerolls') continue;
    if (bound.has(requirement.interactionKey))
      throw new StructuredWorkspaceProjectionContractError(
        `${requirement.interactionKey} has multiple bound reroll lists`,
      );
    bound.set(requirement.interactionKey, bindRoomRerolls(input, requirement));
  }
  return bound;
}
