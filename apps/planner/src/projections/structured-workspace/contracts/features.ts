import type {
  WorkspaceCommandIntent,
  WorkspaceFeatureAssessment,
  WorkspaceFeaturePresence,
  WorkspaceInteractionChoice,
} from '@planner/projections/structured-workspace/contract';
import type {
  AdditionalExitAddress,
  OccurrenceAddress,
  ProjectCommand,
  RoomFeatureAddress,
} from '@run-planner/engine/authored-project';
import type { WorkspaceMarker } from './navigation';
import type { WorkspaceDoorContract } from './structure';

export type WorkspaceRoomFeature =
  | {
      readonly kind: 'nemesisEvent';
      readonly action: 'add' | 'remove';
      readonly interactionKey: string;
    }
  | {
      readonly kind: 'zagreusContract';
      readonly action: 'add';
      readonly presence: Extract<WorkspaceFeaturePresence, { readonly kind: 'optionalAbsent' }>;
      readonly control: WorkspaceZagreusSpawnControl;
    }
  | {
      readonly kind: 'zagreusContract';
      readonly action: 'remove';
      readonly presence: Extract<WorkspaceFeaturePresence, { readonly kind: 'optionalPresent' }>;
      readonly owner: AdditionalExitAddress;
    }
  | {
      readonly kind: 'chaos';
      readonly action: 'add';
      readonly presence: Extract<WorkspaceFeaturePresence, { readonly kind: 'optionalAbsent' }>;
      readonly control: WorkspaceChaosSpawnControl;
    }
  | {
      readonly kind: 'chaos';
      readonly action: 'remove';
      readonly marker: WorkspaceMarker;
      readonly presence:
        | Extract<WorkspaceFeaturePresence, { readonly kind: 'optionalPresent' }>
        | Extract<WorkspaceFeaturePresence, { readonly kind: 'forcedPresent' }>;
      readonly owner: AdditionalExitAddress;
    }
  | {
      /** Fixed Postboss inventory; candidates are produced by the engine assessment. */
      readonly kind: 'purgingPool';
      readonly assessment: WorkspaceFeatureAssessment;
      readonly inventoryAddress: RoomFeatureAddress;
      readonly inventoryMarker: WorkspaceMarker;
      readonly interactionKey: string;
      readonly interacted: boolean;
      readonly slots: readonly {
        readonly candidateTraitKeys: readonly string[];
        readonly candidateTraits: readonly { readonly key: string; readonly label: string }[];
        readonly interactionKey: string;
        readonly key: 'left' | 'middle' | 'right';
        readonly label: string;
        readonly address: RoomFeatureAddress;
        readonly marker: WorkspaceMarker;
        readonly sale?: { readonly sold: boolean };
        readonly traitLabel?: string;
        readonly traitKey: string | null;
      }[];
    }
  | {
      /** Shrine inventory is always visible and authored once present. */
      readonly kind: 'hermesShrine';
      readonly assessment: WorkspaceFeatureAssessment;
      readonly presence: WorkspaceFeaturePresence;
      readonly presenceAddress: RoomFeatureAddress;
      readonly presenceMarker: WorkspaceMarker;
      readonly inventoryAddress?: RoomFeatureAddress;
      readonly inventoryMarker?: WorkspaceMarker;
      readonly presenceInteractionKey?: string;
      readonly slots: readonly {
        readonly key: import('@run-planner/engine/authored-project').HermesShrineSlotKey;
        readonly address: RoomFeatureAddress;
        readonly marker: WorkspaceMarker;
        readonly label: string;
        readonly rewardType: string | null;
        readonly rewardLabel?: string;
        readonly candidateRewardTypes: readonly string[];
        readonly candidateRewards: readonly {
          readonly rewardType: string;
          readonly label: string;
        }[];
        readonly offerInteractionKey: string;
        readonly purchaseInteractionKey: string;
        readonly purchase:
          import('@run-planner/engine/authored-project').HermesShrinePurchase | null;
      }[];
      readonly travelDealRefill?: {
        readonly address: RoomFeatureAddress;
        readonly marker: WorkspaceMarker;
        readonly rewardType: string | null;
        readonly rewardLabel?: string;
        readonly candidateRewardTypes: readonly string[];
        readonly candidateRewards: readonly {
          readonly rewardType: string;
          readonly label: string;
        }[];
        readonly offerInteractionKey: string;
        readonly purchaseInteractionKey: string;
        readonly purchase:
          import('@run-planner/engine/authored-project').HermesShrinePurchase | null;
      };
    }
  | {
      readonly kind: 'stygianWell';
      readonly assessment: WorkspaceFeatureAssessment;
      readonly presence: WorkspaceFeaturePresence;
      readonly presenceAddress: RoomFeatureAddress;
      readonly presenceMarker: WorkspaceMarker;
      readonly inventoryAddress?: RoomFeatureAddress;
      readonly inventoryMarker?: WorkspaceMarker;
      readonly presenceInteractionKey?: string;
      readonly interactionKey?: string;
      readonly interacted: boolean;
      readonly slots: readonly {
        readonly key:
          import('@run-planner/engine/authored-project').StygianWellSlotKey | 'travelDealRefill';
        readonly generationKey: import('@run-planner/engine/authored-project').StygianWellGenerationKey;
        readonly address: RoomFeatureAddress;
        readonly marker: WorkspaceMarker;
        readonly label: string;
        readonly itemKey: string | null;
        readonly itemLabel?: string;
        readonly candidateItemKeys: readonly string[];
        readonly candidateItems: readonly { readonly key: string; readonly label: string }[];
        readonly offerInteractionKey: string;
        readonly purchaseInteractionKey: string;
        readonly purchased: boolean;
      }[];
    };

export interface WorkspaceZagreusContractControl {
  readonly door: WorkspaceDoorContract;
  readonly marker: WorkspaceMarker;
  readonly owner: AdditionalExitAddress;
  readonly selected: boolean;
}

/** Availability is source-room-local; the additional exit remains decision-owned. */
export interface WorkspaceZagreusSpawnControl {
  readonly marker: WorkspaceMarker;
  readonly materialized: boolean;
  readonly owner: AdditionalExitAddress;
}

export interface WorkspaceChaosExitControl {
  readonly door: WorkspaceDoorContract;
  readonly forced: boolean;
  readonly kind: 'chaos';
  readonly mapChoices: readonly WorkspaceInteractionChoice<string>[];
  readonly marker: WorkspaceMarker;
  readonly owner: AdditionalExitAddress;
  readonly selected: boolean;
}

export interface WorkspaceChaosSpawnControl {
  readonly authorable: boolean;
  readonly marker: WorkspaceMarker;
  readonly owner: AdditionalExitAddress;
}

/** A complete route command bound to one resource-family control at its host room. */
export interface WorkspaceResourcePlacementInteraction {
  readonly intent: WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'ReplaceResourcePlacement' }>
  >;
  readonly key: string;
  readonly owner: OccurrenceAddress;
}

/** The Midshop workbench presents the declared additional door without making it a normal target. */
export interface WorkspaceZagreusContractInteraction {
  readonly key: string;
  readonly owner: AdditionalExitAddress;
  readonly removeIntent: WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'RemoveZagreusContract' }>
  >;
  readonly selectIntent: WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'SetExitSelection' }>
  >;
}

/** Source-room availability binds only the creation command. */
export interface WorkspaceZagreusSpawnInteraction {
  readonly key: string;
  readonly owner: AdditionalExitAddress;
  readonly spawnIntent: () => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'AddZagreusContract' }>
  >;
}

/** A Chaos gate is authored at its source and selected at its outgoing decision. */
export interface WorkspaceChaosExitInteraction {
  readonly key: string;
  readonly owner: AdditionalExitAddress;
  readonly mapIntent: (
    gameName: string,
  ) => WorkspaceCommandIntent<Extract<ProjectCommand, { readonly kind: 'ReplaceChaosMap' }>>;
  readonly removeIntent?: WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'RemoveChaos' }>
  >;
  readonly selectIntent: WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'SetExitSelection' }>
  >;
}

/** Availability belongs to the active source room; the authored gate remains occurrence-owned. */
export interface WorkspaceChaosSpawnInteraction {
  readonly key: string;
  readonly owner: AdditionalExitAddress;
  readonly spawnIntent: () => WorkspaceCommandIntent<
    Extract<ProjectCommand, { readonly kind: 'AddChaos' }>
  >;
}
