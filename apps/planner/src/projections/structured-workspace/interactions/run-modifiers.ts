import {
  RUN_MODIFIER_DECLARATIONS,
  createRouteAddress,
  isRunModifierValue,
  routeRunModifiers,
  type BooleanRunModifierDeclaration,
  type NumberRunModifierDeclaration,
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
  const intentFor = (declaration: RunModifierDeclaration, next: boolean | number) => ({
    command: {
      kind: 'ReplaceRunModifiers' as const,
      route: createRouteAddress(route.routeKey),
      value: { ...value, [declaration.key]: next } as RunModifiers,
    },
  });
  return Object.freeze({
    value,
    declarations: visibleRunModifierDeclarations(RUN_MODIFIER_DECLARATIONS, devBuild),
    setValue: (declaration: BooleanRunModifierDeclaration, next: boolean) => {
      assertDeclared(declaration);
      return intentFor(declaration, next);
    },
    draftIntent: (
      declaration: NumberRunModifierDeclaration,
      draft: string,
    ): WorkspaceRunModifierDraftResult => {
      assertDeclared(declaration);
      const next = draft.trim() === '' ? NaN : Number(draft);
      if (!isRunModifierValue(declaration, next))
        return {
          kind: 'invalid',
          message: `Enter a value between ${declaration.min} and ${declaration.max}.`,
        };
      return { kind: 'valid', intent: intentFor(declaration, next) };
    },
  });
}
