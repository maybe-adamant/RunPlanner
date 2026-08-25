import type { AuthoredRewardState } from '@run-planner/engine/authored-project';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import type { CandidateProjectionSession } from '@planner/projections/candidateProjection';
import type { RewardPickerProjectionService } from '@planner/projections/rewardPicker';

import { rewardIntentFor } from './reward-child-command-binding';
import type { WorkspaceRewardControl, WorkspaceRewardInteraction } from '../contract';

/** Binds the authored reward payload controls, including replacement options created by Artificer. */
export function bindRewardPayloadInteractions(input: {
  readonly candidates: CandidateProjectionSession;
  readonly rewardControls: ReadonlyMap<string, WorkspaceRewardControl>;
  readonly artificerOptionsByReplacement: ReadonlyMap<string, readonly AuthoredRewardState[]>;
  readonly rewardPicker: RewardPickerProjectionService;
  readonly semanticAddressKey: (address: WorkspaceRewardControl['owner']['address']) => string;
}): ReadonlyMap<string, WorkspaceRewardInteraction> {
  const rewards = new Map<string, WorkspaceRewardInteraction>();
  for (const [key, control] of input.rewardControls) {
    const artificerOptions = input.artificerOptionsByReplacement.get(
      input.semanticAddressKey(control.owner.address),
    );
    const rewardTypes =
      control.kind === 'countedReward'
        ? input.candidates.countedRewardTypes(
            control.owner,
            control.binding,
            control.offer?.rewardType,
          )
        : Object.freeze([
            ...new Set([
              ...control.rewardTypes,
              ...(artificerOptions ?? []).map((option) => option.offer.rewardType),
            ]),
          ]);
    rewards.set(
      key,
      Object.freeze({
        authoredRewardTypes: rewardTypes,
        choiceLabel: input.rewardPicker.choiceLabel,
        intentFor: (offer: ResolvedRewardOffer) =>
          rewardIntentFor(control.owner, offer, control.derivedShopEntryEdit),
        key,
        load: () =>
          input.candidates.rewardDomain(control.owner, rewardTypes, control.offer ?? undefined),
        model: input.rewardPicker.project,
        owner: control.owner.address,
        selected: control.offer,
        summary: input.rewardPicker.summary,
      }),
    );
  }
  return rewards;
}
