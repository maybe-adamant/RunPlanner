import type { RouteLoadout } from './model';
import { expectRecord } from './validation';

interface RunModifierDeclarationShape {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  /** `internal` modifiers are authored only in a development build. */
  readonly stage: 'released' | 'internal';
}

export interface BooleanRunModifierDeclaration extends RunModifierDeclarationShape {
  readonly kind: 'boolean';
  readonly default: boolean;
}

/** Absent is native; a present value is an enabled percentage in the shared domain. */
export interface OptionalPercentageRunModifierDeclaration extends RunModifierDeclarationShape {
  readonly kind: 'optionalPercentage';
}

/** Absent is a normal run; a present value starts the run at a biome's Opening or Preboss. */
export interface StartPointRunModifierDeclaration extends RunModifierDeclarationShape {
  readonly kind: 'startPoint';
}

export type RunModifierDeclaration =
  | BooleanRunModifierDeclaration
  | OptionalPercentageRunModifierDeclaration
  | StartPointRunModifierDeclaration;

/** Modifiers the execution plan's `runModifiers` record carries. */
export type ExecutionRunModifierDeclaration = Exclude<
  RunModifierDeclaration,
  StartPointRunModifierDeclaration
>;

/** A mid-run start; the biome may dangle from the route. */
export interface RunStartPoint {
  readonly biomeKey: string;
  readonly point: 'opening' | 'preboss';
  /** Base gold added to the game's own starting gold; absent adds none. */
  readonly gold?: number;
}

/** Domain of a start point's gold. */
export const RUN_MODIFIER_GOLD = Object.freeze({ min: 0, max: 99_999, step: 1 } as const);

/** Domain of every enabled optional-percentage modifier. */
export const RUN_MODIFIER_PERCENTAGE = Object.freeze({
  min: 0,
  max: 100,
  step: 1,
  unit: '%',
} as const);

function declareRunModifiers<const T extends readonly RunModifierDeclaration[]>(
  declarations: T,
): Readonly<T> {
  for (const declaration of declarations) Object.freeze(declaration);
  return Object.freeze(declarations);
}

/** Authoring shape and stage only; the exporting engine and the module hook own behaviour. */
export const RUN_MODIFIER_DECLARATIONS = declareRunModifiers([
  {
    key: 'enemyGoldDropChance',
    kind: 'optionalPercentage',
    label: 'Enemy gold drop chance',
    description: 'Eligible enemies drop gold at this chance; room gold limits still apply.',
    stage: 'released',
  },
  {
    key: 'encounterGoldRange',
    kind: 'optionalPercentage',
    label: 'Encounter gold range',
    description: "Each encounter's gold budget is fixed at this point of its native range.",
    stage: 'released',
  },
  {
    key: 'startPoint',
    kind: 'startPoint',
    label: 'Practice mode',
    description: "Starts the run at a later biome's Opening or at a biome's Preboss.",
    stage: 'released',
  },
]);

type DeclaredRunModifier = (typeof RUN_MODIFIER_DECLARATIONS)[number];
type OptionalRunModifier = Extract<DeclaredRunModifier, { readonly kind: 'optionalPercentage' }>;
type StartPointRunModifier = Extract<DeclaredRunModifier, { readonly kind: 'startPoint' }>;
type RequiredRunModifier = Exclude<
  DeclaredRunModifier,
  OptionalRunModifier | StartPointRunModifier
>;
export type RunModifierKey = DeclaredRunModifier['key'];

/** The run modifiers the execution plan publishes; an optional modifier is present only while enabled. */
export type ExecutionRunModifiers = {
  readonly [D in RequiredRunModifier as D['key']]: boolean;
} & {
  readonly [D in OptionalRunModifier as D['key']]?: number;
};

/** The complete authored settings; an optional modifier is present only while set. */
export type RunModifiers = ExecutionRunModifiers & {
  readonly [D in StartPointRunModifier as D['key']]?: RunStartPoint;
};

/** Persisted settings: only values that differ from native. */
export type RunModifiersRecord = Readonly<Partial<RunModifiers>>;

export type RunModifierValue = boolean | number | RunStartPoint;
type RunModifierValues = Readonly<Record<string, RunModifierValue | undefined>>;

export const EXECUTION_RUN_MODIFIER_DECLARATIONS: readonly ExecutionRunModifierDeclaration[] =
  Object.freeze(
    (RUN_MODIFIER_DECLARATIONS as readonly RunModifierDeclaration[]).filter(
      (declaration): declaration is ExecutionRunModifierDeclaration =>
        declaration.kind !== 'startPoint',
    ),
  );

export const NATIVE_RUN_MODIFIERS: RunModifiers = Object.freeze(
  Object.fromEntries(
    RUN_MODIFIER_DECLARATIONS.flatMap((declaration: RunModifierDeclaration) =>
      declaration.kind === 'boolean' ? [[declaration.key, declaration.default]] : [],
    ),
  ) as RunModifiers,
);

/** Whether a modifier is authored and published; `internal` ones only when internal modifiers are enabled. */
export function isRunModifierAuthored(
  declaration: RunModifierDeclaration,
  internalRunModifiers: boolean,
): boolean {
  return internalRunModifiers || declaration.stage === 'released';
}

export function runModifierDeclaration(key: RunModifierKey): RunModifierDeclaration {
  const declaration = RUN_MODIFIER_DECLARATIONS.find((candidate) => candidate.key === key);
  if (declaration === undefined) throw new Error(`undeclared run modifier ${key}`);
  return declaration;
}

/** A present value within its declared domain; an optional modifier's absence is checked by its owner. */
export function isRunModifierValue(declaration: RunModifierDeclaration, value: unknown): boolean {
  if (declaration.kind === 'boolean') return typeof value === 'boolean';
  if (declaration.kind === 'startPoint') {
    const healed = healStartPoint(value);
    return healed !== undefined && sameStartPoint(healed, value as RunStartPoint);
  }
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= RUN_MODIFIER_PERCENTAGE.min &&
    value <= RUN_MODIFIER_PERCENTAGE.max
  );
}

/** Read the complete settings without inserting persisted fields. */
export function routeRunModifiers(loadout: Pick<RouteLoadout, 'runModifiers'>): RunModifiers {
  return loadout.runModifiers === undefined
    ? NATIVE_RUN_MODIFIERS
    : Object.freeze({ ...NATIVE_RUN_MODIFIERS, ...loadout.runModifiers });
}

/** The execution-published modifiers, or undefined when every one is native. */
export function executionRunModifiers(value: RunModifiers): ExecutionRunModifiers | undefined {
  const values: RunModifierValues = value;
  if (
    EXECUTION_RUN_MODIFIER_DECLARATIONS.every(
      (declaration) => values[declaration.key] === nativeRunModifierValue(declaration),
    )
  )
    return undefined;
  return Object.freeze(
    Object.fromEntries(
      EXECUTION_RUN_MODIFIER_DECLARATIONS.flatMap((declaration) =>
        values[declaration.key] === undefined ? [] : [[declaration.key, values[declaration.key]]],
      ),
    ),
  ) as ExecutionRunModifiers;
}

function nativeRunModifierValue(declaration: RunModifierDeclaration): boolean | undefined {
  return declaration.kind === 'boolean' ? declaration.default : undefined;
}

function sameStartPoint(left: RunStartPoint, right: RunStartPoint): boolean {
  return left.biomeKey === right.biomeKey && left.point === right.point && left.gold === right.gold;
}

/** Value equality for one modifier; a start point compares by its fields. */
export function sameRunModifierValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (typeof left !== 'object' || typeof right !== 'object' || left === null || right === null)
    return false;
  return sameStartPoint(left as RunStartPoint, right as RunStartPoint);
}

/** A malformed shape is absent; malformed gold is absent; finite gold clamps to an integer in its domain. */
function healStartPoint(raw: unknown): RunStartPoint | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  const { biomeKey, point, gold } = raw as Record<string, unknown>;
  if (typeof biomeKey !== 'string' || biomeKey.length === 0) return undefined;
  if (point !== 'opening' && point !== 'preboss') return undefined;
  if (typeof gold !== 'number' || !Number.isFinite(gold)) return Object.freeze({ biomeKey, point });
  const healedGold = Math.min(
    RUN_MODIFIER_GOLD.max,
    Math.max(RUN_MODIFIER_GOLD.min, Math.round(gold)),
  );
  return Object.freeze({ biomeKey, point, gold: healedGold });
}

/** A finite number outside the declared domain clamps to its nearest bound. */
function healRunModifierValue(
  declaration: RunModifierDeclaration,
  raw: unknown,
): RunModifierValue | undefined {
  if (declaration.kind === 'boolean') return typeof raw === 'boolean' ? raw : declaration.default;
  if (declaration.kind === 'startPoint') return healStartPoint(raw);
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined;
  return Math.min(RUN_MODIFIER_PERCENTAGE.max, Math.max(RUN_MODIFIER_PERCENTAGE.min, raw));
}

/** Unknown keys are dropped; a malformed known value heals toward its declaration. */
export function decodeRunModifiers(value: unknown, path: string): RunModifiers {
  const record = expectRecord(value, path);
  const decoded: Record<string, RunModifierValue> = {};
  for (const declaration of RUN_MODIFIER_DECLARATIONS as readonly RunModifierDeclaration[]) {
    const healed = healRunModifierValue(declaration, record[declaration.key]);
    if (healed !== undefined) decoded[declaration.key] = healed;
  }
  return Object.freeze(decoded) as RunModifiers;
}

/** Non-native values only; undefined when every value is native. */
export function encodeRunModifiers(value: RunModifiers): RunModifiersRecord | undefined {
  const values: RunModifierValues = value;
  const entries = RUN_MODIFIER_DECLARATIONS.filter(
    (declaration: RunModifierDeclaration) =>
      values[declaration.key] !== nativeRunModifierValue(declaration),
  ).map((declaration) => [declaration.key, values[declaration.key]]);
  return entries.length === 0
    ? undefined
    : (Object.freeze(Object.fromEntries(entries)) as RunModifiersRecord);
}
