import type {
  WorkspaceInteractionCatalog,
  WorkspaceUnlockExitEncounter,
} from '@planner/projections/structured-workspace';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { EncounterCustomizationLauncher } from './locals/EncounterPhaseControl';

const isCustomizationFinding = (finding: { readonly code: string }) =>
  finding.code === 'unlockExitCustomizationUnavailable';

/** A pressed locked door's fight: its Combat launcher on the press row. */
export function UnlockExitFightControl({
  encounter,
  interactions,
}: {
  readonly encounter: WorkspaceUnlockExitEncounter;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  return (
    <div className="field-control field-control-inline room-action-unlock-fight">
      <span>Combat</span>
      <EncounterCustomizationLauncher
        interaction={interactions.unlockExitEncounters.get(encounter.interactionKey)}
        subject={{
          address: encounter.address,
          controlId: `unlock-exit-customization-${semanticOwnerControlElementId(encounter.address)}`,
          definitionKey: encounter.definitionKey,
          label: encounter.label,
          identityLabel: encounter.label,
          ...(encounter.customization === undefined
            ? {}
            : { customization: encounter.customization }),
          ...(encounter.composition === undefined ? {} : { composition: encounter.composition }),
          findingFilter: isCustomizationFinding,
        }}
      />
    </div>
  );
}
