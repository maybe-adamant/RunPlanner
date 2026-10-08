import {
  RUN_MODIFIER_DECLARATIONS,
  RUN_MODIFIER_PERCENTAGE,
  createRouteAddress,
  isRunModifierValue,
  routeRunModifiers,
  type BooleanRunModifierDeclaration,
  type OptionalPercentageRunModifierDeclaration,
  type ProjectDocument,
  type RunModifierDeclaration,
  type RunModifiers,
} from '@run-planner/engine/authored-project';
import type {
  WorkspaceRunModifierDraftResult,
  WorkspaceRunModifiersControl,
} from '../contracts/structure';

/** `released` declarations are always authored; `internal` ones only in a development build. */
export function visibleRunModifierDeclarations<D extends RunModifierDeclaration>(
  declarations: readonly D[],
  devBuild: boolean,
): readonly D[] {
  return Object.freeze(
    declarations.filter((declaration) => devBuild || declaration.stage === 'released'),
  );
}

function assertDeclared(declaration: RunModifierDeclaration): void {
  const declared: readonly RunModifierDeclaration[] = RUN_MODIFIER_DECLARATIONS;
  if (!declared.includes(declaration))
    throw new Error(`undeclared run modifier ${declaration.key}`);
}

/** Bind complete edits to the current authored siblings, including in Fresh File. */
export function bindRunModifiers(
  route: ProjectDocument['route'],
  devBuild: boolean,
): WorkspaceRunModifiersControl {
  const value = routeRunModifiers(route.loadout);
  const intentFor = (declaration: RunModifierDeclaration, next: boolean | number | undefined) => {
    const replaced: Record<string, boolean | number> = { ...value };
    if (next === undefined) delete replaced[declaration.key];
    else replaced[declaration.key] = next;
    return {
      command: {
        kind: 'ReplaceRunModifiers' as const,
        route: createRouteAddress(route.routeKey),
        value: replaced as RunModifiers,
      },
    };
  };
  return Object.freeze({
    value,
    declarations: visibleRunModifierDeclarations(RUN_MODIFIER_DECLARATIONS, devBuild),
    setValue: (declaration: BooleanRunModifierDeclaration, next: boolean) => {
      assertDeclared(declaration);
      return intentFor(declaration, next);
    },
    clearValue: (declaration: OptionalPercentageRunModifierDeclaration) => {
      assertDeclared(declaration);
      return intentFor(declaration, undefined);
    },
    draftIntent: (
      declaration: OptionalPercentageRunModifierDeclaration,
      draft: string,
    ): WorkspaceRunModifierDraftResult => {
      assertDeclared(declaration);
      const next = draft.trim() === '' ? NaN : Number(draft);
      if (!isRunModifierValue(declaration, next))
        return {
          kind: 'invalid',
          message: `Enter a value between ${RUN_MODIFIER_PERCENTAGE.min} and ${RUN_MODIFIER_PERCENTAGE.max}.`,
        };
      return { kind: 'valid', intent: intentFor(declaration, next) };
    },
  });
}
