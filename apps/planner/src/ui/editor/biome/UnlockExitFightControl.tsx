import type {
  WorkspaceInteractionCatalog,
  WorkspaceUnlockExitEncounter,
} from '@planner/projections/structured-workspace';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { EncounterCustomizationLauncher } from './locals/EncounterPhaseControl';
import { DoorChips } from './DecisionWorkbench';
import type { DoorChip } from './doorSummary';

const isCustomizationFinding = (finding: { readonly code: string }) =>
  finding.code === 'unlockExitCustomizationUnavailable';

/** A pressed locked door's fight: its Customize launcher on the press row. */
export function UnlockExitFightControl({
  encounter,
  interactions,
}: {
  readonly encounter: WorkspaceUnlockExitEncounter;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  return (
    <EncounterCustomizationLauncher
      interaction={interactions.unlockExitEncounters.get(encounter.interactionKey)}
      subject={{
        address: encounter.address,
        controlId: `unlock-exit-customization-${semanticOwnerControlElementId(encounter.address)}`,
        definitionKey: encounter.definitionKey,
        label: encounter.label,
        identityLabel: encounter.label,
        hoverName: encounter.label,
        ...(encounter.customization === undefined
          ? {}
          : { customization: encounter.customization }),
        ...(encounter.composition === undefined ? {} : { composition: encounter.composition }),
        findingFilter: isCustomizationFinding,
      }}
    />
  );
}

/** The locked door a press opens: its door chip, or its name before the doors are known. */
export function UnlockedDoor({
  chip,
  label,
}: {
  readonly chip?: DoorChip;
  readonly label: string;
}) {
  return chip === undefined ? (
    <span>{label}</span>
  ) : (
    <DoorChips chips={[{ ...chip, picked: false, locked: false }]} label={label} />
  );
}
