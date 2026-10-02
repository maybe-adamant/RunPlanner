import {
  ProjectDocumentContractError,
  createRouteAddress,
  decodeRunModifiers,
  routeRunModifiers,
  type ProjectDocument,
  type RunModifiers,
} from '@run-planner/engine/authored-project';
import type { WorkspaceRunModifiersControl } from '../contracts/structure';

/** Bind complete edits to the current authored siblings, including in Fresh File. */
export function bindRunModifiers(route: ProjectDocument['route']): WorkspaceRunModifiersControl {
  const value = routeRunModifiers(route.loadout);
  const intentFor = (next: RunModifiers) => ({
    command: {
      kind: 'ReplaceRunModifiers' as const,
      route: createRouteAddress(route.routeKey),
      value: next,
    },
  });
  return Object.freeze({
    value,
    setCrits: (enabled: boolean) => intentFor({ ...value, guaranteeEligibleCrits: enabled }),
    setDoubleDamage: (enabled: boolean) =>
      intentFor({ ...value, guaranteeEligibleDoubleDamage: enabled }),
    goldDraftIntent: (draft: string) => {
      try {
        const next = decodeRunModifiers(
          {
            ...value,
            enemyGoldDropChanceMultiplier: draft.trim() === '' ? NaN : Number(draft),
          },
          'runModifiers',
        );
        return { kind: 'valid' as const, intent: intentFor(next) };
      } catch (error) {
        if (!(error instanceof ProjectDocumentContractError)) throw error;
        return { kind: 'invalid' as const, message: 'Enter a finite multiplier of at least 1.' };
      }
    },
  });
}
