import { createAction, createReducer, type Reducer } from '@reduxjs/toolkit';

import type { GamePlanSlotNumber } from '../persistence/gameModuleHost';
import { newProjectCreated, profileLoadSucceeded } from './profileSessionSlice';
import { authoredProjectReplaced, projectIdentityMinted } from './projectWorkspaceSlice';

/** UI-session memory of sends for the loaded project; never persisted or in history. */
export interface GameSendSessionState {
  readonly lastSentSlot: GamePlanSlotNumber | null;
  readonly feedback: { readonly tone: 'success' | 'failure'; readonly text: string } | null;
}

export const gamePlanSent = createAction<{ readonly slot: GamePlanSlotNumber }>(
  'gameSend/planSent',
);
export const gameSendFeedbackShown =
  createAction<NonNullable<GameSendSessionState['feedback']>>('gameSend/feedbackShown');

const INITIAL_STATE: GameSendSessionState = Object.freeze({ lastSentSlot: null, feedback: null });

export function createGameSendSessionReducer(): Reducer<GameSendSessionState> {
  return createReducer(INITIAL_STATE, (builder) => {
    builder
      .addCase(gamePlanSent, (state, action) => ({ ...state, lastSentSlot: action.payload.slot }))
      .addCase(gameSendFeedbackShown, (state, action) => ({ ...state, feedback: action.payload }))
      // Loading, creating or copying the document starts a fresh send session.
      .addCase(newProjectCreated, () => INITIAL_STATE)
      .addCase(profileLoadSucceeded, () => INITIAL_STATE)
      .addCase(authoredProjectReplaced, () => INITIAL_STATE)
      // A saved copy is a different plan; earlier sends belong to the original.
      .addCase(projectIdentityMinted, () => INITIAL_STATE);
  });
}
