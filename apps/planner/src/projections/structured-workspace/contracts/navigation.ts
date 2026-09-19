import type {
  LevelResolutionAddress,
  SemanticAddress,
  TraitOfferAddress,
} from '@run-planner/engine/authored-project';

import type { WorkspaceAssessment } from '../contract';

/** Transient destination for an entered-room workbench. */
export type WorkspaceRoomTab =
  | 'overview'
  | 'layout'
  | 'actions'
  | 'doors'
  | 'shipIntroActions'
  | 'shipCombat1Actions'
  | 'shipCombat2Actions'
  | 'shipInactiveRepair';

/** Transient destination for one presentation surface of the persistent Hub board. */
export type WorkspaceHubTab = 'overview' | 'timeline' | 'exit';

export interface WorkspaceMarker {
  readonly address: SemanticAddress;
  readonly assessment: WorkspaceAssessment;
  readonly findingCount: number;
  readonly focusKey: string;
}

/** A renderable inspector subject identified without rediscovering containment. */
export type WorkspaceInspectorSubject =
  | {
      readonly frontierFocusKey: string;
      readonly kind: 'frontier';
    }
  | {
      readonly kind: 'node';
      readonly nodeKey: string;
    };

export interface WorkspaceInspectorDestination {
  readonly biomeKey?: string;
  readonly focusAddress: SemanticAddress;
  readonly focusKey: string;
  /** Present for trait owners that must open the transient shared dialog. */
  readonly traitDialogTarget?: TraitOfferAddress;
  /** Present for exact Pom owners that must open the transient Pom dialog. */
  readonly levelResolutionDialogTarget?: LevelResolutionAddress;
  /**
   * Final presentation binding for an exact semantic owner. Omitted only when
   * the owning workspace has no renderable inspector subject.
   */
  readonly inspectorSubject?: WorkspaceInspectorSubject;
  /**
   * Assembly-time containing-node route. It may be a non-node marker for a
   * frontier or coarse owner; React resolves `inspectorSubject` instead.
   */
  readonly nodeKey: string;
  readonly ownerAddress: SemanticAddress;
  /** Finding-only presentation override for controls intentionally hosted in Route Loadout. */
  readonly presentationPanel?: 'overview';
  /** Present when this owner belongs to a specific room-workbench tab. */
  readonly roomTab?: WorkspaceRoomTab;
  /** Present when this owner belongs to a specific Hub-workbench tab. */
  readonly hubTab?: WorkspaceHubTab;
  readonly region: 'inspector' | 'routeRail' | 'structure';
  readonly routeKey?: string;
  /**
   * The selected rendered rail marker key for this exact focus. Absence is
   * intentional for coarse fallback owners and hidden structural sources.
   */
  readonly selectedRailKey?: string;
}

/**
 * The presentation-selected inspector subject when no semantic owner is
 * explicitly focused. This is deliberately distinct from `focusByOwner`:
 * exact owner navigation may redirect a leaf into its containing workbench,
 * while a default may be the active authoring frontier itself.
 */
export type WorkspaceDefaultInspectorDestination =
  | (Extract<WorkspaceInspectorSubject, { readonly kind: 'frontier' }> & {
      readonly selectedRailKey: string;
    })
  | (Extract<WorkspaceInspectorSubject, { readonly kind: 'node' }> & {
      /** Omitted only when the chosen structural node has no rail entry. */
      readonly selectedRailKey?: string;
    });
