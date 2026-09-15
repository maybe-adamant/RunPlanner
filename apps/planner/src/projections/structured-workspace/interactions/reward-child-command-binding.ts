import type { WorkspaceRewardInteraction } from '../contracts/rewards';
import {
  semanticAddressKey,
  type ProjectCommand,
  type TraitOfferAddress,
  type LevelResolutionAddress,
} from '@run-planner/engine/authored-project';
import type {
  AuthoredLevelResolution,
  AuthoredTraitOffer,
} from '@run-planner/engine/authored-project';

import { StructuredWorkspaceProjectionContractError } from '../contract';
import type { WorkspaceCommandIntent } from '../contract';
import type { WorkspaceRewardControl } from '../contracts/rewards';

type RewardPayloadCommand = Extract<
  ProjectCommand,
  {
    readonly kind:
      | 'ReplaceIncomingReward'
      | 'ReplaceLocalReward'
      | 'ReplaceRewardWheelOffer'
      | 'ReplaceAcquisitionEntryOffer';
  }
>;

type RewardPayloadOwner = Exclude<WorkspaceRewardControl['owner'], { readonly kind: 'shopOffer' }>;

function rewardCommandFor(
  owner: RewardPayloadOwner,
  value: Parameters<WorkspaceRewardInteraction['intentFor']>[0],
): RewardPayloadCommand {
  switch (owner.kind) {
    case 'incomingReward':
      return Object.freeze({ kind: 'ReplaceIncomingReward', reward: owner.address, value });
    case 'localReward':
      return Object.freeze({ kind: 'ReplaceLocalReward', reward: owner.address, value });
    case 'rewardWheelOffer':
      return Object.freeze({ kind: 'ReplaceRewardWheelOffer', offer: owner.address, value });
    case 'acquisitionEntry':
      return Object.freeze({ kind: 'ReplaceAcquisitionEntryOffer', entry: owner.address, value });
  }
}

export function rewardIntentFor(
  owner: RewardPayloadOwner,
  value: Parameters<WorkspaceRewardInteraction['intentFor']>[0],
): WorkspaceCommandIntent<RewardPayloadCommand> {
  return Object.freeze({ command: rewardCommandFor(owner, value) });
}

export function traitOfferCommandFor(
  owner: TraitOfferAddress,
  value: AuthoredTraitOffer,
): Extract<ProjectCommand, { readonly kind: 'ReplaceTraitOffer' | 'ReplaceGorgonAthenaOffer' }> {
  if (owner.owner.kind === 'gorgonPhase') {
    if (value.kind !== 'traits' || value.options.length !== 3) {
      throw new StructuredWorkspaceProjectionContractError(
        `${semanticAddressKey(owner)} requires exactly three Gorgon Athena traits`,
      );
    }
    return Object.freeze({
      kind: 'ReplaceGorgonAthenaOffer' as const,
      trait: owner,
      value: Object.freeze({
        traitKeys: Object.freeze(value.options.map((option) => option.traitKey)) as readonly [
          string,
          string,
          string,
        ],
        selectedOptionKey: value.selectedOptionKey,
      }),
    });
  }
  return Object.freeze({ kind: 'ReplaceTraitOffer' as const, trait: owner, value });
}

export function ordinaryTraitOfferCommandFor(
  owner: TraitOfferAddress,
  value: AuthoredTraitOffer,
): Extract<ProjectCommand, { readonly kind: 'ReplaceTraitOffer' }> {
  return Object.freeze({ kind: 'ReplaceTraitOffer' as const, trait: owner, value });
}

export function levelResolutionCommandFor(
  owner: LevelResolutionAddress,
  value: AuthoredLevelResolution,
): Extract<ProjectCommand, { readonly kind: 'ReplaceLevelResolution' }> {
  return Object.freeze({ kind: 'ReplaceLevelResolution' as const, levelResolution: owner, value });
}
