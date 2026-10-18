import { createSlice, type PayloadAction, type Reducer } from '@reduxjs/toolkit';
import type { DraftRefusal, DraftReport } from '@run-planner/engine/simulation';

import { authoredProjectReplaced } from './projectWorkspaceSlice';
import { newProjectCreated, profileLoadSucceeded } from './profileSessionSlice';

/** The last draft run; a drafted result has already been applied to the project. */
export type DraftRunState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'running'; readonly seed: number; readonly startedAt: number }
  | {
      readonly kind: 'drafted';
      readonly seed: number;
      readonly report: DraftReport;
      readonly attempts: number;
    }
  | { readonly kind: 'failed'; readonly biomeKey: string; readonly reasons: readonly string[] }
  | { readonly kind: 'refused'; readonly refusals: readonly DraftRefusal[] }
  /** The project changed while drafting, so the result was not applied. */
  | { readonly kind: 'superseded' };

/** The in-memory draft spec beyond the loadout; never saved and never in authored history. */
export interface DraftSessionState {
  readonly godKeys: readonly string[];
  readonly storyNpcByBiome: Readonly<Record<string, string>>;
  readonly fieldNpcsByBiome: Readonly<Record<string, readonly string[]>>;
  readonly basketTraitKeys: readonly string[];
  /** Rack keepsake by slot index; a missing or null entry keeps the held keepsake. */
  readonly rackKeepsakeKeys: readonly (string | null)[];
  readonly seed: number;
  readonly run: DraftRunState;
}

function toggled(values: readonly string[], value: string): string[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

function initialState(seed: number): DraftSessionState {
  return {
    godKeys: [],
    storyNpcByBiome: {},
    fieldNpcsByBiome: {},
    basketTraitKeys: [],
    rackKeepsakeKeys: [],
    seed,
    run: { kind: 'idle' },
  };
}

const draftSessionSlice = createSlice({
  name: 'draftSession',
  initialState: initialState(1),
  reducers: {
    draftGodToggled(state, action: PayloadAction<string>) {
      state.godKeys = toggled(state.godKeys, action.payload);
    },
    draftStoryNpcToggled(state, action: PayloadAction<{ biomeKey: string; npcKey: string }>) {
      const { biomeKey, npcKey } = action.payload;
      if (state.storyNpcByBiome[biomeKey] === npcKey) delete state.storyNpcByBiome[biomeKey];
      else state.storyNpcByBiome[biomeKey] = npcKey;
    },
    draftFieldNpcToggled(state, action: PayloadAction<{ biomeKey: string; npcKey: string }>) {
      const { biomeKey, npcKey } = action.payload;
      // A field NPC appears once per run, so choosing it in one biome moves it there.
      for (const [otherKey, npcKeys] of Object.entries(state.fieldNpcsByBiome))
        if (otherKey !== biomeKey && npcKeys.includes(npcKey))
          state.fieldNpcsByBiome[otherKey] = npcKeys.filter((key) => key !== npcKey);
      state.fieldNpcsByBiome[biomeKey] = toggled(state.fieldNpcsByBiome[biomeKey] ?? [], npcKey);
    },
    draftBasketTraitToggled(state, action: PayloadAction<string>) {
      state.basketTraitKeys = toggled(state.basketTraitKeys, action.payload);
    },
    draftRackKeepsakeReplaced(
      state,
      action: PayloadAction<{ index: number; keepsakeKey: string | null }>,
    ) {
      const racks = [...state.rackKeepsakeKeys];
      while (racks.length <= action.payload.index) racks.push(null);
      racks[action.payload.index] = action.payload.keepsakeKey;
      state.rackKeepsakeKeys = racks;
    },
    draftRunStarted(state, action: PayloadAction<{ seed: number; startedAt: number }>) {
      state.seed = action.payload.seed;
      state.run = { kind: 'running', ...action.payload };
    },
    draftRunSettled(state, action: PayloadAction<Exclude<DraftRunState, { kind: 'running' }>>) {
      return { ...state, run: action.payload };
    },
    draftRunCancelled(state) {
      state.run = { kind: 'idle' };
    },
  },
});

export const {
  draftGodToggled,
  draftStoryNpcToggled,
  draftFieldNpcToggled,
  draftBasketTraitToggled,
  draftRackKeepsakeReplaced,
  draftRunStarted,
  draftRunSettled,
  draftRunCancelled,
} = draftSessionSlice.actions;

/** A different project starts from an empty spec. */
export function createDraftSessionReducer(seed: number): Reducer<DraftSessionState> {
  const fresh = initialState(seed);
  return (state = fresh, action) => {
    if (
      authoredProjectReplaced.match(action) ||
      newProjectCreated.match(action) ||
      profileLoadSucceeded.match(action)
    )
      return { ...fresh, seed: state.seed };
    return draftSessionSlice.reducer(state, action);
  };
}
