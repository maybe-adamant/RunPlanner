import { createAction, createReducer, type Reducer } from '@reduxjs/toolkit';

import type { GamePlanSlotNumber } from '../persistence/gameModuleHost';
import { newProjectCreated, profileLoadSucceeded } from './profileSessionSlice';
import { authoredProjectReplaced, projectIdentityMinted } from './projectWorkspaceSlice';

export interface GameSendFailure {
  readonly message: string;
  readonly atMs: number;
}

/** UI-session memory of sends for the loaded project; never persisted or in history. */
export interface GameSendSessionState {
  readonly lastSentSlot: GamePlanSlotNumber | null;
  /** The latest send's failure, kept until the next send starts. */
  readonly lastFailure: GameSendFailure | null;
}

export const gameSendStarted = createAction('gameSend/started');
export const gamePlanSent = createAction<{ readonly slot: GamePlanSlotNumber }>(
  'gameSend/planSent',
);
export const gameSendFailed = createAction<GameSendFailure>('gameSend/failed');

const INITIAL_STATE: GameSendSessionState = Object.freeze({
  lastSentSlot: null,
  lastFailure: null,
});

export function createGameSendSessionReducer(): Reducer<GameSendSessionState> {
  return createReducer(INITIAL_STATE, (builder) => {
    builder
      .addCase(gameSendStarted, (state) => ({ ...state, lastFailure: null }))
      .addCase(gamePlanSent, (state, action) => ({ ...state, lastSentSlot: action.payload.slot }))
      .addCase(gameSendFailed, (state, action) => ({ ...state, lastFailure: action.payload }))
      // Loading, creating or copying the document starts a fresh send session.
      .addCase(newProjectCreated, () => INITIAL_STATE)
      .addCase(profileLoadSucceeded, () => INITIAL_STATE)
      .addCase(authoredProjectReplaced, () => INITIAL_STATE)
      // A saved copy is a different plan; earlier sends belong to the original.
      .addCase(projectIdentityMinted, () => INITIAL_STATE);
  });
}
