import type { RunStateOwner } from '@run-planner/engine/simulation';

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

/**
 * Display rows for the Run State sheet. Every tab renders the same row and
 * section shapes; an empty section is omitted and an empty tab has no sections.
 */
export interface WorkspaceRunStatePresentation {
  /** One-line checkpoint moment, such as `Before Combat 12 · Oceanus`. */
  readonly moment: string;
  /** Aspect and familiar rows that open the Overview. */
  readonly loadout: readonly WorkspaceRunStateRow[];
  /** Max Health and Max Magick, then their flat sources for the Sources disclosure. */
  readonly maxStats: {
    readonly rows: readonly WorkspaceRunStateRow[];
    readonly sources: readonly WorkspaceRunStateRow[];
  };
  readonly overview: readonly WorkspaceRunStateSection[];
  readonly effects: readonly WorkspaceRunStateSection[];
  readonly keepsakes: readonly WorkspaceRunStateSection[];
  readonly arcana: readonly WorkspaceRunStateSection[];
  readonly fear: readonly WorkspaceRunStateSection[];
  readonly moreInfo: {
    readonly sections: readonly WorkspaceRunStateSection[];
    readonly bags: readonly WorkspaceRunStateBagPresentation[];
  };
}

export interface WorkspaceRunStateSection {
  readonly key: string;
  readonly heading?: string;
  /** Muted explanatory copy under the heading. */
  readonly note?: string;
  readonly rows: readonly WorkspaceRunStateRow[];
}

/** `Name (bracket)` on the left, `right` in the fixed right column. */
export interface WorkspaceRunStateRow {
  readonly key: string;
  readonly name: string;
  /** Already-formatted clock or current value, including its parentheses. */
  readonly bracket?: string;
  /** Rarity, level, rank or a plain value. */
  readonly right?: string;
}

export interface WorkspaceRunStateBagPresentation {
  readonly eligible: WorkspaceRunStateBagSection;
  readonly ineligible: WorkspaceRunStateBagSection;
  readonly label: string;
  /** Remaining, eligible and ineligible totals. */
  readonly rows: readonly WorkspaceRunStateRow[];
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
