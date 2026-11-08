import type { WorkspaceAnchorObject } from '@planner/projections/structured-workspace';
import type { ChallengeSwitchKind } from '@run-planner/engine/catalog-schema';
import { challengeSwitchKindLabel } from '@planner/projections/challengeSwitchCopy';
import { challengeSwitchIcon, roomObjectIcon } from '@planner/ui/artwork/roomArtwork';

const objectNames: Readonly<Record<WorkspaceAnchorObject, string>> = Object.freeze({
  stygianWell: 'Stygian Well',
  purgingPool: 'Pool of Purging',
  hermesShrine: 'Hermes Shrine',
  challengeSwitch: 'Challenge Switch',
});

/** What an anchor holds: an object, or a switch of one type. */
export interface HeldObject {
  readonly object: WorkspaceAnchorObject;
  readonly switchKind?: ChallengeSwitchKind | undefined;
}

export const heldObjectName = (held: HeldObject): string =>
  held.switchKind === undefined
    ? objectNames[held.object]
    : challengeSwitchKindLabel(held.switchKind);

export const heldObjectIcon = (held: HeldObject) =>
  held.switchKind === undefined
    ? roomObjectIcon(held.object)
    : challengeSwitchIcon(held.switchKind);
