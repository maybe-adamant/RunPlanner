import type { WorkspaceHubRequirements } from '@planner/projections/structured-workspace';
import type { FindingTargetProps } from '@planner/ui/feedback/useFindingTarget';

function openRoomsText({ current, min, max, met }: WorkspaceHubRequirements['openRooms']): string {
  const range = min === max ? `${min}` : `${min}–${max}`;
  return met ? `${current} rooms open` : `Open ${range} rooms · ${current} open`;
}

function visitsText({
  planned,
  required,
  met,
  fountainUsed,
}: WorkspaceHubRequirements['visits']): string {
  const fountain = fountainUsed ? 'Fountain used' : 'Fountain unused';
  return met
    ? `${planned} planned · ${fountain}`
    : `Visit ${required} rooms · ${planned} planned · ${fountain}`;
}

/**
 * States what one Hub tab still requires. A requirement spread across the
 * board's rooms or map is marked and navigated to here, not on each room.
 */
export function HubRequirementBox({
  findingTarget,
  requirement,
}: {
  readonly findingTarget: FindingTargetProps;
  readonly requirement:
    | { readonly kind: 'openRooms'; readonly value: WorkspaceHubRequirements['openRooms'] }
    | { readonly kind: 'visits'; readonly value: WorkspaceHubRequirements['visits'] };
}) {
  const met =
    requirement.kind === 'openRooms'
      ? requirement.value.met
      : requirement.value.met && requirement.value.fountainUsed;
  return (
    <p
      {...findingTarget}
      className="hub-requirement-box"
      data-met={met}
      role="status"
      tabIndex={-1}
    >
      {requirement.kind === 'openRooms'
        ? openRoomsText(requirement.value)
        : visitsText(requirement.value)}
    </p>
  );
}
