import { semanticAddressKey, type DerivedShopEntryEditCommand, type ProjectCommand, type TraitOfferAddress, type LevelResolutionAddress } from '@run-planner/engine/authored-project';
import type { AuthoredLevelResolution, AuthoredTraitOffer } from '@run-planner/engine/authored-project';

import { StructuredWorkspaceProjectionContractError } from '../contract';
import type { WorkspaceCommandIntent, WorkspaceRewardControl, WorkspaceRewardInteraction } from '../contract';

type RewardPayloadCommand = Extract<
  ProjectCommand,
  {
    readonly kind:
      | 'ReplaceIncomingReward'
      | 'ReplaceLocalReward'
      | 'ReplaceRewardWheelOffer'
      | 'ReplaceShopOffer'
      | 'ReplaceAcquisitionEntryOffer';
  }
>;

export function derivedShopPayloadIntent<Command extends ProjectCommand>(
  materialization: WorkspaceRewardControl['derivedShopEntryEdit'],
  edit: Command,
): WorkspaceCommandIntent<
  | Command
  | DerivedShopEntryEditCommand
  | Extract<ProjectCommand, { readonly kind: 'ReplaceAcquisitionDisposition' }>
> {
  if (materialization === undefined) return Object.freeze({ command: edit });
  if (
    edit.kind !== 'ReplaceAcquisitionEntryOffer' &&
    edit.kind !== 'ReplaceTraitOffer' &&
    edit.kind !== 'ReplaceGorgonAthenaOffer' &&
    edit.kind !== 'ReplaceTraitSelection' &&
    edit.kind !== 'ReplaceLevelResolution' &&
    edit.kind !== 'ReplaceAcquisitionDisposition'
  )
    throw new StructuredWorkspaceProjectionContractError(
      `${edit.kind} cannot edit a derived Shop entry`,
    );
  return Object.freeze({
    command: Object.freeze({
      kind: 'EditDerivedShopEntry' as const,
      ...materialization,
      edit: edit as DerivedShopEntryEditCommand['edit'],
    }),
  });
}

function rewardCommandFor(
  owner: WorkspaceRewardControl['owner'],
  value: Parameters<WorkspaceRewardInteraction['intentFor']>[0],
): RewardPayloadCommand {
  switch (owner.kind) {
    case 'incomingReward':
      return Object.freeze({ kind: 'ReplaceIncomingReward', reward: owner.address, value });
    case 'localReward':
      return Object.freeze({ kind: 'ReplaceLocalReward', reward: owner.address, value });
    case 'rewardWheelOffer':
      return Object.freeze({ kind: 'ReplaceRewardWheelOffer', offer: owner.address, value });
    case 'shopOffer':
      return Object.freeze({ kind: 'ReplaceShopOffer', offer: owner.address, value });
    case 'acquisitionEntry':
      return Object.freeze({ kind: 'ReplaceAcquisitionEntryOffer', entry: owner.address, value });
  }
}

export function rewardIntentFor(
  owner: WorkspaceRewardControl['owner'],
  value: Parameters<WorkspaceRewardInteraction['intentFor']>[0],
  materialization: WorkspaceRewardControl['derivedShopEntryEdit'],
): WorkspaceCommandIntent<
  | RewardPayloadCommand
  | DerivedShopEntryEditCommand
  | Extract<ProjectCommand, { readonly kind: 'ReplaceAcquisitionDisposition' }>
> {
  const command = rewardCommandFor(owner, value);
  if (materialization === undefined) return Object.freeze({ command });
  if (command.kind !== 'ReplaceAcquisitionEntryOffer') {
    throw new StructuredWorkspaceProjectionContractError(
      `${semanticAddressKey(owner.address)} cannot own a derived Shop payload edit`,
    );
  }
  return derivedShopPayloadIntent(materialization, command);
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
