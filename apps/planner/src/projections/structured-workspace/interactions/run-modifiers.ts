import {
  createRouteAddress,
  isRunModifierValue,
  runModifierDeclaration,
  routeRunModifiers,
  type ProjectDocument,
  type RunModifiers,
} from '@run-planner/engine/authored-project';
import type { WorkspaceRunModifiersControl } from '../contracts/structure';

/** Bind complete edits to the current authored siblings, including in Fresh File. */
export function bindRunModifiers(route: ProjectDocument['route']): WorkspaceRunModifiersControl {
  const value = routeRunModifiers(route.loadout);
  const gold = runModifierDeclaration('enemyGoldDropChanceMultiplier');
  const intentFor = (next: RunModifiers) => ({
    command: {
      kind: 'ReplaceRunModifiers' as const,
      route: createRouteAddress(route.routeKey),
      value: next,
    },
  });
  return Object.freeze({
    value,
    goldDraftIntent: (draft: string) => {
      const multiplier = draft.trim() === '' ? NaN : Number(draft);
      if (gold.kind === 'number' && !isRunModifierValue(gold, multiplier))
        return {
          kind: 'invalid' as const,
          message: `Enter a multiplier between ${gold.min} and ${gold.max}.`,
        };
      return {
        kind: 'valid' as const,
        intent: intentFor({ ...value, enemyGoldDropChanceMultiplier: multiplier }),
      };
    },
  });
}
