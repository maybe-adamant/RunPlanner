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

/** Puts the Auto choice first among the choices that can be made. */
function withAuto(
  model: ContextualPickerModel<string | null>,
  label: string,
  selected: boolean,
): ContextualPickerModel<string | null> {
  const auto = Object.freeze({
    key: 'auto',
    value: null,
    label,
    state: 'possible' as const,
    selected,
    disabled: false,
  });
  const index = model.sections.findIndex((section) => section.kind === 'category');
  const sections =
    index < 0
      ? [
          ...model.sections.filter((section) => section.kind !== 'unavailable'),
          Object.freeze({
            key: 'auto',
            kind: 'category' as const,
            label: 'Available',
            collapsible: false,
            items: Object.freeze([auto]),
          }),
          ...model.sections.filter((section) => section.kind === 'unavailable'),
        ]
      : model.sections.map((section, at) =>
          at === index
            ? Object.freeze({ ...section, items: Object.freeze([auto, ...section.items]) })
            : section,
        );
  return Object.freeze({
    ...(selected
      ? { selected: auto }
      : model.selected === undefined
        ? {}
        : { selected: model.selected }),
    sections: Object.freeze(sections),
  });
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
  let rooms: ContextualPickerModel<string | null> | undefined;
  return Object.freeze({
    key: requirement.interactionKey,
    owner,
    rooms: Object.freeze({
      load: () =>
        (rooms ??= declaredChoicesPicker<string | null>(
          [
            Object.freeze({ key: 'auto', value: null, label: requirement.autoRoomLabel }),
            ...requirement.rooms.map((room) =>
              Object.freeze({
                key: room.gameName,
                value: room.gameName,
                label: room.label,
                ...(room.exclusion === undefined
                  ? {}
                  : { disabled: true, explanation: exclusionReason(room.exclusion) }),
              }),
            ),
          ],
          value.placeholderRoomGameName,
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
        const model = input.contextualPicker.project<string | null>(
          domain.types.map((option) =>
            Object.freeze({ value: option.key, evaluation: option.evaluation }),
          ),
          (option) =>
            Object.freeze({
              label: labels.get(option.value ?? '') ?? option.value ?? '',
              selected: option.value === value.rewardType,
            }),
          (rewardType) => rewardType ?? 'auto',
        );
        return withAuto(model, requirement.autoRewardLabel, value.rewardType === null);
      },
    }),
    // A pinned reward survives a room change only where the new room's store offers it.
    roomIntent: (placeholderRoomGameName: string | null) =>
      replace(
        placeholderRoomGameName,
        placeholderRoomGameName !== null &&
          value.rewardType !== null &&
          phantomPlaceholderRewardTypes(input.catalog, placeholderRoomGameName).includes(
            value.rewardType,
          )
          ? value.rewardType
          : null,
      ),
    rewardIntent: (rewardType: string | null) => replace(value.placeholderRoomGameName, rewardType),
  });
}
