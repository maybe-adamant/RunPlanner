import { phantomPlaceholderRewardTypes } from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { PhantomPlaceholderExclusion } from '@run-planner/engine/simulation';
import type { CandidateProjectionSession } from '@planner/projections/candidates/candidateProjection';
import {
  declaredChoicesPicker,
  type ContextualPickerModel,
  type ContextualPickerProjectionService,
} from '@planner/projections/contextual/contextualPicker';

import type { WorkspacePhantomExitInteraction } from '../contracts/structure';
import type { WorkspaceOccurrenceInteractionRequirement } from './interaction-requirements';

type PhantomExitRequirement = Extract<
  WorkspaceOccurrenceInteractionRequirement,
  { readonly kind: 'phantomExit' }
>;

function exclusionReason(exclusion: PhantomPlaceholderExclusion): string {
  switch (exclusion) {
    case 'currentRoom':
      return 'This room.';
    case 'creationCap':
      return 'Already created this run.';
  }
}

/** Binds one hidden door's room and reward pickers over engine candidates. */
export function bindPhantomExitInteraction(input: {
  readonly candidates: CandidateProjectionSession;
  readonly catalog: Catalog;
  readonly contextualPicker: ContextualPickerProjectionService;
  readonly requirement: PhantomExitRequirement;
}): WorkspacePhantomExitInteraction {
  const { requirement } = input;
  const { owner, value } = requirement;
  const replace = (placeholderRoomGameName: string | null, rewardType: string | null) =>
    Object.freeze({
      command: Object.freeze({
        kind: 'ReplacePhantomExit' as const,
        exit: owner,
        value: Object.freeze({ placeholderRoomGameName, rewardType }),
      }),
    });
  let rooms: ContextualPickerModel<string> | undefined;
  return Object.freeze({
    key: requirement.interactionKey,
    owner,
    rooms: Object.freeze({
      load: () =>
        (rooms ??= declaredChoicesPicker<string>(
          requirement.rooms.map((room) =>
            Object.freeze({
              key: room.gameName,
              value: room.gameName,
              label: room.label,
              ...(room.exclusion === undefined
                ? {}
                : { disabled: true, explanation: exclusionReason(room.exclusion) }),
            }),
          ),
          requirement.effectiveRoomGameName,
        )),
    }),
    rewards: Object.freeze({
      load: async () => {
        const domain = await input.candidates.rewardDomain(
          { kind: 'phantomExit', address: owner },
          requirement.rewardTypes.map((type) => type.rewardType),
        );
        const labels = new Map(
          requirement.rewardTypes.map((type) => [type.rewardType, type.label]),
        );
        return input.contextualPicker.project<string>(
          domain.types.map((option) =>
            Object.freeze({ value: option.key, evaluation: option.evaluation }),
          ),
          (option) =>
            Object.freeze({
              label: labels.get(option.value) ?? option.value,
              selected: option.value === requirement.effectiveRewardType,
            }),
          (rewardType) => rewardType,
        );
      },
    }),
    // A pinned reward survives a room change only where the new room's store offers it.
    roomIntent: (placeholderRoomGameName: string) =>
      replace(
        placeholderRoomGameName,
        value.rewardType !== null &&
          phantomPlaceholderRewardTypes(input.catalog, placeholderRoomGameName).includes(
            value.rewardType,
          )
          ? value.rewardType
          : null,
      ),
    rewardIntent: (rewardType: string) => replace(value.placeholderRoomGameName, rewardType),
    resetIntent: () => replace(null, null),
  });
}
