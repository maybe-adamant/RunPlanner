import { useRef, useState } from 'react';
import type { SemanticAddress } from '@run-planner/engine/authored-project';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceCommandIntent,
  type WorkspaceInteractionCatalog,
  type WorkspaceMixedBatchNode,
  type WorkspaceOrdinaryBatchNode,
  type WorkspaceRoomPlanEnd,
  type WorkspaceTakeoverBatchNode,
} from '@planner/projections/structured-workspace';
import { rewardIcon } from '@planner/ui/artwork/rewardIcon';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import type {
  ContextualPickerItem,
  ContextualPickerModel,
  ContextualPickerSection,
} from '@planner/projections/contextual/contextualPicker';
import { ContextualPickerPopover } from '@planner/ui/controls/ContextualPicker';
import { hintProps } from '@planner/ui/controls/hint';
import { useCommandIntent, useCommandsIntent } from '@planner/ui/controls/useCommandIntent';
import { candidateWaitingHint } from '@planner/ui/feedback/candidatePresentation';
import {
  useAuthoringLocked,
  useFindingMark,
  type FindingMarkProps,
} from '@planner/ui/feedback/useFindingTarget';
import { DoorChipFace } from './DecisionWorkbench';
import { doorChipMapLink, doorRewardIcons, type DoorChip } from './doorSummary';
import { BiomeWorkspaceContractError } from './workspaceContract';
import { planEndUnavailableHint } from './PlanEndAction';
import {
  highlightOwner,
  useRoomMapHighlightActions,
  useRoomMapLinks,
  useRoomMapPointedAmong,
  type RoomMapHighlight,
} from './room-map/roomMapHighlight';

/** One way out of a room on its Leave room picker: a door, the Chaos gate or the Contract door. */
export interface LeaveOption {
  readonly key: string;
  /** Its name, spoken and shown where it has no chip. */
  readonly label: string;
  /** Its face: the door's room and rewards. */
  readonly chip?: DoorChip;
  /** Why it cannot be picked here. */
  readonly disabledHint?: string | undefined;
  /** Picks it; absent where it is the room's only way out. */
  readonly intent?: WorkspaceCommandIntent;
}

const endKey = 'plan-end';
const continueKey = 'plan-continue';

/** Ending the plan as a way out: a stop chip and its name. */
function PlanEndFace() {
  return (
    <>
      <span aria-hidden="true" className="plan-end-chip">
        <span className="plan-end-chip-glyph" />
      </span>
      <span className="timeline-leave-text">End plan</span>
    </>
  );
}

function OptionFace({ option }: { readonly option: LeaveOption }) {
  return option.chip === undefined ? (
    <span className="timeline-leave-text">{option.label}</span>
  ) : (
    <span
      className="timeline-door-chip"
      data-unavailable={option.chip.unavailable || option.disabledHint !== undefined || undefined}
    >
      <DoorChipFace chip={option.chip} />
    </span>
  );
}

/**
 * How the room is left, picked on its last Timeline row: each way out, then
 * ending the plan here. Ending the plan keeps the picked way underneath, so
 * picking it again continues the plan through it.
 */
export function LeavePicker({
  chosenKey,
  findingMark,
  id,
  options,
  planEnd,
  readinessOwner,
}: {
  /** The way out picked, kept while the plan ends here. */
  readonly chosenKey: string | undefined;
  readonly findingMark?: FindingMarkProps | undefined;
  readonly id: string;
  readonly options: readonly LeaveOption[];
  readonly planEnd: WorkspaceRoomPlanEnd | undefined;
  /** The owner whose readiness says whether the pick is reached yet. */
  readonly readinessOwner?: SemanticAddress | undefined;
}) {
  const executeIntent = useCommandIntent();
  const executeCommands = useCommandsIntent();
  const [open, setOpen] = useState(false);
  const mapPreview = useRoomMapHighlightActions();
  const mapLinks = useRoomMapLinks();
  const previewed = useRef<RoomMapHighlight | undefined>(undefined);
  const ended = planEnd?.relation === 'end';
  // Past the end the pick is locked as unreached; it still continues the plan from here.
  const waiting = useAuthoringLocked(readinessOwner) && !ended;
  const pointed = useRoomMapPointedAmong(
    options.map((option) => (option.chip === undefined ? undefined : doorChipMapLink(option.chip))),
  );
  const chosen = options.find((option) => option.key === chosenKey);
  const chosenLink = ended || chosen?.chip === undefined ? undefined : doorChipMapLink(chosen.chip);

  const preview = (link: RoomMapHighlight | undefined) => {
    const last = previewed.current;
    if (last !== undefined && (link === undefined || highlightOwner(last) !== highlightOwner(link)))
      mapPreview?.release(last);
    previewed.current = link;
    if (link !== undefined) mapPreview?.show(link);
  };

  const pick = (key: string) => {
    if (planEnd !== undefined && key === endKey) {
      if (!ended) executeIntent(planEnd.endIntent);
      return;
    }
    if (planEnd !== undefined && key === continueKey) {
      executeIntent(planEnd.removeIntent);
      return;
    }
    const option = options.find((candidate) => candidate.key === key);
    if (option === undefined) return;
    if (ended && planEnd !== undefined) {
      if (option.key === chosenKey || option.intent === undefined)
        executeIntent(planEnd.removeIntent);
      // Continuing through another way is one edit.
      else executeCommands({ commands: [planEnd.removeIntent.command, option.intent.command] });
      return;
    }
    if (option.key !== chosenKey && option.intent !== undefined) executeIntent(option.intent);
  };

  const model = (): ContextualPickerModel<string> => {
    const item = (
      key: string,
      label: string,
      selected: boolean,
      disabled: boolean,
    ): ContextualPickerItem<string> => ({
      key,
      value: key,
      label,
      ariaLabel: label,
      selected,
      disabled,
      state: disabled ? 'impossible' : 'possible',
    });
    const ways = options.map((option) =>
      item(
        option.key,
        option.label,
        !ended && option.key === chosenKey,
        option.disabledHint !== undefined,
      ),
    );
    const availability = planEnd === undefined || ended ? undefined : planEnd.availability();
    // Where no way out can be picked, continuing the plan is its own choice.
    const continues = ended && ways.every((way) => way.disabled);
    const endings =
      planEnd === undefined
        ? []
        : [
            item(endKey, 'End plan here', ended, availability?.available === false),
            ...(continues ? [item(continueKey, 'Continue planning', false, false)] : []),
          ];
    const items = [...ways, ...endings];
    const selected = items.find((candidate) => candidate.selected);
    const section: ContextualPickerSection<string> = {
      key: 'ways',
      kind: 'category',
      label: '',
      collapsible: false,
      items,
    };
    return { ...(selected === undefined ? {} : { selected }), sections: [section] };
  };

  const hint = (item: ContextualPickerItem<string>): string | undefined => {
    if (item.key === endKey)
      return ended || planEnd === undefined
        ? undefined
        : planEndUnavailableHint(planEnd.availability());
    const option = options.find((candidate) => candidate.key === item.key);
    return option?.disabledHint;
  };

  const marked = findingMark !== undefined && findingMark['data-has-findings'];
  const { 'data-map-pointed': _pointed, ...triggerLinks } = mapLinks(chosenLink);
  void _pointed;
  return (
    <span className="timeline-leave-door">
      <ContextualPickerPopover<string>
        choiceLabel="Leave room"
        itemFace={(item) => {
          if (item.key === endKey) return <PlanEndFace />;
          const option = options.find((candidate) => candidate.key === item.key);
          return option === undefined ? undefined : <OptionFace option={option} />;
        }}
        itemHint={hint}
        model={open ? model() : { sections: [] }}
        onActiveChange={(item) => {
          const option = options.find((candidate) => candidate.key === item?.key);
          preview(option?.chip === undefined ? undefined : doorChipMapLink(option.chip));
        }}
        onOpenChange={(next) => {
          if (!next) preview(undefined);
          setOpen(next && !waiting);
        }}
        onSelect={pick}
        open={open && !waiting}
        searchable={false}
        side="bottom"
      >
        <button
          {...triggerLinks}
          {...(marked ? findingMark : {})}
          {...hintProps(
            waiting ? candidateWaitingHint : ended ? undefined : chosen?.label,
            marked ? findingMark['aria-description'] : undefined,
            'Exit door',
          )}
          aria-expanded={open && !waiting}
          aria-haspopup="listbox"
          aria-label="Exit door"
          className="timeline-door-chip timeline-door-option timeline-leave-picker"
          data-map-pointed={pointed || undefined}
          disabled={waiting}
          id={id}
          type="button"
        >
          {ended ? (
            <PlanEndFace />
          ) : chosen === undefined ? (
            <span aria-hidden="true" className="timeline-door-chip-blank">
              ?
            </span>
          ) : chosen.chip === undefined ? (
            <span className="timeline-leave-text">{chosen.label}</span>
          ) : (
            <DoorChipFace chip={chosen.chip} />
          )}
        </button>
      </ContextualPickerPopover>
    </span>
  );
}

type BatchNode = WorkspaceOrdinaryBatchNode | WorkspaceMixedBatchNode | WorkspaceTakeoverBatchNode;

/**
 * A batch's Leave room picker: every door the batch offers, plus its Chaos
 * Gate or Contract; a lone door is the way out with nothing else to pick.
 */
export function BatchExitPicker({
  interactions,
  lockedAtLeave = [],
  node,
  planEnd,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  /** Doors still locked when the room is left: offered only while one is the saved pick. */
  readonly lockedAtLeave?: readonly string[];
  readonly node: BatchNode;
  readonly planEnd: WorkspaceRoomPlanEnd | undefined;
}) {
  const findingMark = useFindingMark();
  const selectionAddress = node.selection.address;
  if (selectionAddress.kind !== 'exitSelection')
    throw new BiomeWorkspaceContractError('A batch selection must own an exit-selection address.');
  const additional = [node.zagreusContract, node.chaos].flatMap((control) =>
    control === undefined ? [] : [control],
  );
  const lone =
    node.targets.length === 1 && additional.length === 0 && node.missingTargets.length === 0;
  const interaction =
    node.targets.length > 1 || additional.length > 0
      ? interactions.exitSelections.get(workspaceInteractionKey(selectionAddress))
      : undefined;
  const additionalIntent = (control: (typeof additional)[number]) => {
    const key = workspaceInteractionKey(control.owner);
    return 'kind' in control
      ? requireWorkspaceInteraction(interactions.chaosExits, key).selectIntent
      : requireWorkspaceInteraction(interactions.zagreusContracts, key).selectIntent;
  };
  const waitsOnDoors =
    lone || interaction !== undefined ? undefined : 'Fill the remaining doors first.';
  const options: LeaveOption[] = [
    ...node.targets
      .filter(
        (target) =>
          !lockedAtLeave.includes(target.exitKey) ||
          interaction?.selectedExitKey === target.exitKey,
      )
      .map((target): LeaveOption => {
        const label = `Door ${target.index} · ${target.door.room.label}`;
        const unavailable = target.physicalState === 'unavailable';
        return {
          key: target.exitKey,
          label,
          chip: {
            key: target.exitKey,
            doorIndex: target.index,
            label,
            roomIcon: target.door.room.roomIcon,
            rewards: doorRewardIcons(target, 'final'),
            ...(unavailable ? { unavailable: true } : {}),
          },
          disabledHint: unavailable ? 'This saved room is no longer offered here.' : waitsOnDoors,
          ...(lone
            ? {}
            : {
                intent: {
                  command: {
                    kind: 'SetExitSelection',
                    selection: selectionAddress,
                    value: { kind: 'normal', exitKey: target.exitKey },
                  },
                  focus: { owner: selectionAddress, timing: 'after' },
                },
              }),
        };
      }),
    ...additional.map((control): LeaveOption => {
      const key = workspaceInteractionKey(control.owner);
      return {
        key,
        label: control.exitTypeLabel,
        chip: {
          key,
          additionalExit: 'kind' in control ? 'chaos' : 'zagreusContract',
          label: control.exitTypeLabel,
          roomIcon: control.door.room.roomIcon,
          rewards: [rewardIcon(control.fixedRewardType)],
        },
        disabledHint: waitsOnDoors,
        intent: additionalIntent(control),
      };
    }),
  ];
  const picked = additional.find((control) => control.selected);
  const chosenKey = lone
    ? node.targets[0]!.exitKey
    : picked === undefined
      ? interaction?.selectedExitKey
      : workspaceInteractionKey(picked.owner);
  return (
    <LeavePicker
      chosenKey={chosenKey}
      findingMark={findingMark(selectionAddress)}
      id={semanticOwnerControlElementId(selectionAddress)}
      options={options}
      planEnd={planEnd}
      readinessOwner={selectionAddress}
    />
  );
}
