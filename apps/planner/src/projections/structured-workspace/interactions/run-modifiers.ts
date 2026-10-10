import {
  RUN_MODIFIER_DECLARATIONS,
  RUN_MODIFIER_GOLD,
  RUN_MODIFIER_PERCENTAGE,
  createRouteAddress,
  isRunModifierAuthored,
  isRunModifierValue,
  routeRunModifiers,
  type BooleanRunModifierDeclaration,
  type OptionalPercentageRunModifierDeclaration,
  type ProjectDocument,
  type RunModifierDeclaration,
  type RunModifiers,
  type RunModifierValue,
  type RunStartPoint,
  type StartPointRunModifierDeclaration,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import {
  startPointPublicationBlock,
  type StartPointPublicationBlock,
} from '@run-planner/engine/execution-plan';
import { startPointDomain, type ProjectEvaluation } from '@run-planner/engine/simulation';
import { startPointOptionHint } from '@planner/projections/startPointCopy';
import type {
  WorkspaceRunModifierDraftResult,
  WorkspaceRunModifiersControl,
  WorkspaceStartPointControl,
  WorkspaceStartPointRow,
} from '../contracts/structure';

const START_POINT_LABELS = Object.freeze({ opening: 'Opening', preboss: 'Preboss' } as const);

export function startPointLabel(catalog: Catalog, startPoint: Omit<RunStartPoint, 'gold'>): string {
  const biome = catalog.biomes.byKey[startPoint.biomeKey]?.label ?? startPoint.biomeKey;
  return `${biome} · ${START_POINT_LABELS[startPoint.point]}`;
}

/** `internal` declarations are authored only in a development build. */
export function visibleRunModifierDeclarations<D extends RunModifierDeclaration>(
  declarations: readonly D[],
  devBuild: boolean,
): readonly D[] {
  return Object.freeze(
    declarations.filter((declaration) => isRunModifierAuthored(declaration, devBuild)),
  );
}

const optionalHint = (hint: string | undefined) =>
  hint === undefined ? {} : { unavailableHint: hint };

function assertDeclared(declaration: RunModifierDeclaration): void {
  const declared: readonly RunModifierDeclaration[] = RUN_MODIFIER_DECLARATIONS;
  if (!declared.includes(declaration))
    throw new Error(`undeclared run modifier ${declaration.key}`);
}

/** Bind complete edits to the current authored siblings, including in Fresh File. */
export function bindRunModifiers(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  devBuild: boolean,
): WorkspaceRunModifiersControl {
  const { route } = project;
  const value = routeRunModifiers(route.loadout);
  const intentFor = (declaration: RunModifierDeclaration, next: RunModifierValue | undefined) => {
    const replaced: Record<string, RunModifierValue> = { ...value };
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
  const declarations = visibleRunModifierDeclarations(
    RUN_MODIFIER_DECLARATIONS as readonly RunModifierDeclaration[],
    devBuild,
  );
  const startPointDeclaration = declarations.find(
    (declaration): declaration is StartPointRunModifierDeclaration =>
      declaration.kind === 'startPoint',
  );
  const startPointBlock =
    startPointDeclaration === undefined || value.startPoint === undefined
      ? undefined
      : startPointPublicationBlock(catalog, project, evaluation);
  const startPoint =
    startPointDeclaration === undefined
      ? undefined
      : bindStartPoint(
          catalog,
          project,
          evaluation,
          startPointDeclaration,
          value,
          startPointBlock,
          intentFor,
        );
  return Object.freeze({
    value,
    declarations,
    ...(startPoint === undefined ? {} : { startPoint }),
    ...(startPointBlock === undefined ? {} : { startPointBlock }),
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

function bindStartPoint(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  declaration: StartPointRunModifierDeclaration,
  value: RunModifiers,
  block: StartPointPublicationBlock | undefined,
  intentFor: (
    declaration: RunModifierDeclaration,
    next: RunModifierValue | undefined,
  ) => ReturnType<WorkspaceStartPointControl['selectIntent']>,
): WorkspaceStartPointControl {
  const current = value.startPoint;
  let domain: readonly WorkspaceStartPointRow[] | undefined;
  const loadDomain = () => {
    if (domain !== undefined) return domain;
    const all = startPointDomain(catalog, project, evaluation);
    domain = Object.freeze(
      project.route.itineraryBiomeKeys.map((biomeKey) => {
        const options = all.filter((option) => option.biomeKey === biomeKey);
        return Object.freeze({
          biomeKey,
          label: catalog.biomes.byKey[biomeKey]?.label ?? biomeKey,
          options: Object.freeze(
            options.map((option) =>
              Object.freeze({
                biomeKey,
                point: option.point,
                label: START_POINT_LABELS[option.point],
                selected: current?.biomeKey === biomeKey && current.point === option.point,
                ...(option.status.availability === 'available'
                  ? { available: true }
                  : {
                      available: false,
                      ...optionalHint(startPointOptionHint(option.status.reason)),
                    }),
              }),
            ),
          ),
        });
      }),
    );
    return domain;
  };
  const control: WorkspaceStartPointControl = {
    declaration,
    value: current,
    valueLabel: current === undefined ? '' : startPointLabel(catalog, current),
    ...(block?.code === 'startPointIneligible' ? { unavailable: true as const } : {}),
    loadDomain,
    selectIntent: (next) =>
      intentFor(
        declaration,
        next === undefined
          ? undefined
          : {
              biomeKey: next.biomeKey,
              point: next.point,
              ...(current?.gold === undefined ? {} : { gold: current.gold }),
            },
      ),
    goldDraftIntent: (draft) => {
      if (current === undefined) return { kind: 'invalid', message: 'Choose a start point first.' };
      const text = draft.trim();
      if (text === '')
        return {
          kind: 'valid',
          intent: intentFor(declaration, { biomeKey: current.biomeKey, point: current.point }),
        };
      const next = { biomeKey: current.biomeKey, point: current.point, gold: Number(text) };
      if (!isRunModifierValue(declaration, next))
        return {
          kind: 'invalid',
          message: `Enter whole gold between ${RUN_MODIFIER_GOLD.min} and ${RUN_MODIFIER_GOLD.max}, or leave it empty to add none.`,
        };
      return { kind: 'valid', intent: intentFor(declaration, next) };
    },
  };
  return Object.freeze(control);
}
