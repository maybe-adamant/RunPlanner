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

export type RunModifierDeclaration =
  BooleanRunModifierDeclaration | OptionalPercentageRunModifierDeclaration;

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
]);

type DeclaredRunModifier = (typeof RUN_MODIFIER_DECLARATIONS)[number];
type OptionalRunModifier = Extract<DeclaredRunModifier, { readonly kind: 'optionalPercentage' }>;
type RequiredRunModifier = Exclude<DeclaredRunModifier, OptionalRunModifier>;
export type RunModifierKey = DeclaredRunModifier['key'];

/** The complete authored settings; an optional modifier is present only while enabled. */
export type RunModifiers = {
  readonly [D in RequiredRunModifier as D['key']]: boolean;
} & {
  readonly [D in OptionalRunModifier as D['key']]?: number;
};

/** Persisted settings: only values that differ from native. */
export type RunModifiersRecord = Readonly<Partial<RunModifiers>>;

type RunModifierValues = Readonly<Record<string, boolean | number | undefined>>;

export const NATIVE_RUN_MODIFIERS: RunModifiers = Object.freeze(
  Object.fromEntries(
    RUN_MODIFIER_DECLARATIONS.flatMap((declaration: RunModifierDeclaration) =>
      declaration.kind === 'boolean' ? [[declaration.key, declaration.default]] : [],
    ),
  ) as RunModifiers,
);

export function runModifierDeclaration(key: RunModifierKey): RunModifierDeclaration {
  const declaration = RUN_MODIFIER_DECLARATIONS.find((candidate) => candidate.key === key);
  if (declaration === undefined) throw new Error(`undeclared run modifier ${key}`);
  return declaration;
}

/** A present value within its declared domain; an optional modifier's absence is checked by its owner. */
export function isRunModifierValue(declaration: RunModifierDeclaration, value: unknown): boolean {
  if (declaration.kind === 'boolean') return typeof value === 'boolean';
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

function nativeRunModifierValue(declaration: RunModifierDeclaration): boolean | undefined {
  return declaration.kind === 'boolean' ? declaration.default : undefined;
}

export function isNativeRunModifiers(value: RunModifiers): boolean {
  const values: RunModifierValues = value;
  return RUN_MODIFIER_DECLARATIONS.every(
    (declaration: RunModifierDeclaration) =>
      values[declaration.key] === nativeRunModifierValue(declaration),
  );
}

/** A finite number outside the declared domain clamps to its nearest bound. */
function healRunModifierValue(
  declaration: RunModifierDeclaration,
  raw: unknown,
): boolean | number | undefined {
  if (declaration.kind === 'boolean') return typeof raw === 'boolean' ? raw : declaration.default;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined;
  return Math.min(RUN_MODIFIER_PERCENTAGE.max, Math.max(RUN_MODIFIER_PERCENTAGE.min, raw));
}

/** Unknown keys are dropped; a malformed known value heals toward its declaration. */
export function decodeRunModifiers(value: unknown, path: string): RunModifiers {
  const record = expectRecord(value, path);
  const decoded: Record<string, boolean | number> = {};
  for (const declaration of RUN_MODIFIER_DECLARATIONS) {
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
