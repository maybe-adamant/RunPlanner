import type { ArcanaActivationOrigin, RunStateOwner } from '@run-planner/engine/simulation';
import type { TraitRarity } from '@run-planner/engine/catalog-schema';

/** A read-only checkpoint published by the engine for one outer decision. */
export type WorkspaceRunStateLauncher =
  | {
      readonly availability: 'available';
      readonly owner: RunStateOwner;
      readonly state: WorkspaceRunStatePresentation;
      /** Final structured-stage title, never reconstructed by React. */
      readonly title: string;
    }
  | {
      readonly availability: 'unavailable';
      readonly owner: RunStateOwner;
      readonly title: string;
    };

export interface WorkspaceRunStatePresentation {
  readonly hexProgress: {
    readonly baseSpellLabel?: string;
    readonly layoutLabel?: string;
    readonly baseCapacity?: number;
    readonly effectiveCapacity?: number;
    readonly godSentLabel: 'No Hex' | 'Not added' | 'Added';
    readonly pathOfStarsLabel: 'Ineligible — no Hex' | 'Eligible' | 'Ineligible — tree full';
    readonly bankedPathPoints: number;
    readonly investedPathPoints: number;
  };
  readonly keepsakes: {
    readonly currentLabel: string;
    readonly chronology: readonly {
      readonly biomeNumber: number;
      readonly label: string;
    }[];
    readonly fatedStatus: 'Unknown' | 'Fated' | 'Unfated';
    readonly jeweledPomStatus: 'inactive' | 'active' | 'invalidated';
    readonly experimentalHammers: readonly {
      readonly status: 'active' | 'expired';
      readonly traitLabel: string;
      readonly remainingUses: number;
      readonly acquisitionIdentity: string;
    }[];
    readonly transcendentEmbryo?: {
      readonly origin: 'ordinary' | 'echo';
      readonly rarity: import('@run-planner/engine/catalog-schema').InRunTraitRarity;
      readonly progress: number;
      readonly interval: number;
      readonly markedBlessingLabel: string;
      readonly markedBlessingAcquisitionIdentity: string;
    };
    readonly echoGift?: {
      readonly capturedKeepsakeLabel: string;
      readonly status: 'pending' | 'oneShotApplied' | 'everyBiome' | 'effectNeutral';
      readonly replayCount: number;
    };
    readonly callingCardRemainingCharges?: number;
    /** Future-outcome-only Olympian pressure; no producer internals or editable controls. */
    readonly pendingRewardPriorities: readonly string[];
    readonly olympianSources: readonly {
      readonly providerKey: string;
      readonly providerLabel: string;
      readonly origin: 'ordinary' | 'echo';
      readonly forceRemaining: 0 | 1;
      readonly rarificationRemaining: 0 | 1;
      readonly maximumSourceRarityLevel: 1 | 2 | 3;
    }[];
    readonly timePieceRemainingCharges?: number;
    readonly figLeafRemainingUses?: number;
    readonly figLeafActivatedThisBiome?: boolean;
    readonly gorgonStatus?: 'pending' | 'consumed' | 'expired';
    readonly gorgonRarityLevel?: 1 | 2 | 3 | 4;
    readonly phialStatus?: 'pending' | 'consumed';
    readonly figurineStatus?: 'pending' | 'consumed';
    readonly figurineOrigin?: 'ordinary' | 'echo';
    readonly figurineRarity?: import('@run-planner/engine/catalog-schema').InRunTraitRarity;
    readonly stoneStatus?: 'pending' | 'consumed';
    readonly stoneOrigin?: 'ordinary' | 'echo';
    readonly stoneRank?: import('@run-planner/engine/catalog-schema').KeepsakeRank;
    /** Already-formatted accumulated bonus to damage dealt and taken. */
    readonly discordantBellBonusLabel?: string;
    readonly lionFang?: {
      readonly bonusLabel: string;
      readonly expired: boolean;
      readonly origin: 'ordinary' | 'echo';
    };
  };
  readonly arcana: readonly {
    readonly key: string;
    readonly label: string;
    readonly origin: ArcanaActivationOrigin;
    readonly rarity: TraitRarity;
    readonly roomEntryGrowth?: WorkspaceRunStateGrowth & { readonly maxHealthGranted: number };
  }[];
  readonly artificer?: {
    readonly rarity: import('@run-planner/engine/catalog-schema').InRunTraitRarity;
    readonly spent: number;
    readonly capacity: 1 | 2 | 3 | 4;
    readonly remaining: number;
  };
  readonly bags: readonly WorkspaceRunStateBagPresentation[];
  readonly rewardStoreController: WorkspaceRunStateRewardStoreController;
  readonly counters: readonly { readonly key: string; readonly value: number }[];
  readonly elements: readonly { readonly key: string; readonly value: number }[];
  readonly godPool: {
    readonly inPool: readonly WorkspaceRunStateSource[];
  };
  readonly fear: {
    readonly configuredTotal: number;
    readonly active: readonly {
      readonly key: string;
      readonly label: string;
      readonly rank: number;
    }[];
    readonly disabled: readonly {
      readonly key: string;
      readonly label: string;
      readonly rank: number;
    }[];
    readonly forfeitStatus: 'inactive' | 'available' | 'consumed';
  };
  /** Absent until the run holds or has bought a Well item. */
  readonly stygianWell?: WorkspaceRunStateStygianWell;
  readonly traits: {
    readonly properUpbringingActive?: true;
    readonly coreSlots: readonly WorkspaceRunStateCoreTraitSlot[];
    readonly other: readonly WorkspaceRunStateTrait[];
    readonly banned: readonly WorkspaceRunStateSource[];
    readonly echoShopDuplicateStatus?: 'pending' | 'consumed';
  };
}

export interface WorkspaceRunStateStygianWell {
  readonly timedBuffs: readonly {
    readonly key: string;
    readonly label: string;
    /** Already-formatted remaining uses on the instance's own clock. */
    readonly remainingLabel: string;
  }[];
  readonly charges: readonly { readonly label: string; readonly count: number }[];
  readonly purchases: readonly { readonly label: string; readonly count: number }[];
}

export interface WorkspaceRunStateSource {
  readonly key: string;
  readonly label: string;
}

/** Already-formatted copy; React renders these rows without deciding what an absent value means. */
export interface WorkspaceRunStateRewardStoreController {
  readonly enteredLabel: string;
  readonly ratioLabel: string;
  readonly targetLabel: string;
}

export interface WorkspaceRunStateTrait {
  readonly label: string;
  readonly rarity?: TraitRarity;
  readonly level?: number;
  readonly hammerRank?: 'RankI' | 'RankII';
  readonly traitKey: string;
  readonly steadyGrowthProgress?: number;
  readonly steadyGrowthInterval?: number;
  readonly roomsPerUpgradeGrowth?: WorkspaceRunStateGrowth;
}

/** A max-stat growth cycle: progress toward the next grant, grants and their total. */
export interface WorkspaceRunStateGrowth {
  readonly progress: number;
  readonly interval: number;
  readonly grants: number;
  readonly maxManaGranted: number;
}

export interface WorkspaceRunStateCoreTraitSlot {
  readonly label: string;
  readonly slotKey: string;
  readonly trait?: WorkspaceRunStateTrait;
}

export interface WorkspaceRunStateBagPresentation {
  readonly eligible: WorkspaceRunStateBagSection;
  readonly ineligible: WorkspaceRunStateBagSection;
  readonly label: string;
  readonly remaining: string;
  readonly technicalKey: string;
}

export interface WorkspaceRunStateBagSection {
  readonly entries: readonly WorkspaceRunStateBagEntry[];
  readonly total: string;
}

export interface WorkspaceRunStateBagEntry {
  readonly conditions: readonly WorkspaceRunStateBagCondition[];
  readonly count: string;
  readonly label: string;
  readonly technicalKey: string;
}

export interface WorkspaceRunStateBagCondition {
  readonly count: string;
  readonly explanation: string;
  readonly technicalKey: string;
}
