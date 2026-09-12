import type {
  AuthoredKeepsakeEquipResults,
  KeepsakeEquipResultAddress,
  KeepsakeSelectionAddress,
  ProjectCommand,
} from '@run-planner/engine/authored-project';
import type { ChaosNumericOperand, InRunTraitRarity } from '@run-planner/engine/catalog-schema';
import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import type { WorkspaceCommandIntent } from '@planner/projections/structured-workspace/contract';

export interface WorkspaceKeepsakeSelectionInteraction {
  readonly key: string;
  /** Candidate-backed identity model; evaluation starts when the picker opens. */
  readonly load: () => ContextualPickerModel<string>;
  readonly owner: KeepsakeSelectionAddress;
  /** Label retained by the trigger before its candidate model is activated. */
  readonly selectedLabel: string;
  readonly selectedKeepsakeKey?: string;
  readonly replaceIntent: (
    keepsakeKey: string,
  ) => WorkspaceCommandIntent<
    Extract<
      ProjectCommand,
      { readonly kind: 'ReplaceStartingKeepsake' | 'ReplacePostbossKeepsake' }
    >
  >;
  readonly removeIntent?: () => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'RemovePostbossKeepsake' }>
  >;
}

/** Closed immediate acquisitions beneath their exact rack selection. */
export type WorkspaceKeepsakeEquipResultInteraction =
  | WorkspaceJeweledPomEquipResultInteraction
  | WorkspaceExperimentalHammerEquipResultInteraction
  | WorkspaceTranscendentEmbryoEquipResultInteraction;

export interface WorkspaceKeepsakeEquipResultDomain {
  readonly picker: ContextualPickerModel<string>;
  readonly transcendentEmbryoSummary?: {
    readonly rarity: InRunTraitRarity;
    readonly operands: readonly ChaosNumericOperand[];
  };
}

export interface WorkspaceJeweledPomEquipResultInteraction {
  readonly key: string;
  readonly owner: KeepsakeEquipResultAddress & { readonly resultKind: 'jeweledPom' };
  readonly value?: AuthoredKeepsakeEquipResults['jeweledPom'];
  readonly load: (
    value?: AuthoredKeepsakeEquipResults['jeweledPom'],
  ) => WorkspaceKeepsakeEquipResultDomain;
  readonly selectedLabel: string;
  readonly intentFor: (
    value: NonNullable<AuthoredKeepsakeEquipResults['jeweledPom']>,
  ) => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'ReplaceJeweledPomEquipResult' }>
  >;
}

export interface WorkspaceExperimentalHammerEquipResultInteraction {
  readonly key: string;
  readonly owner: KeepsakeEquipResultAddress & { readonly resultKind: 'experimentalHammer' };
  readonly value?: AuthoredKeepsakeEquipResults['experimentalHammer'];
  readonly load: (
    value?: AuthoredKeepsakeEquipResults['experimentalHammer'],
  ) => WorkspaceKeepsakeEquipResultDomain;
  readonly selectedLabel: string;
  readonly intentFor: (
    value: NonNullable<AuthoredKeepsakeEquipResults['experimentalHammer']>,
  ) => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'ReplaceExperimentalHammerEquipResult' }>
  >;
}

export interface WorkspaceTranscendentEmbryoEquipResultInteraction {
  readonly key: string;
  readonly owner: KeepsakeEquipResultAddress & { readonly resultKind: 'transcendentEmbryo' };
  readonly value?: AuthoredKeepsakeEquipResults['transcendentEmbryo'];
  readonly load: (
    value?: AuthoredKeepsakeEquipResults['transcendentEmbryo'],
  ) => WorkspaceKeepsakeEquipResultDomain;
  readonly selectedLabel: string;
  readonly outcomeFor: (
    blessingKey: string,
  ) => NonNullable<AuthoredKeepsakeEquipResults['transcendentEmbryo']>;
  readonly intentFor: (
    value: NonNullable<AuthoredKeepsakeEquipResults['transcendentEmbryo']>,
  ) => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'ReplaceTranscendentEmbryoEquipResult' }>
  >;
}
