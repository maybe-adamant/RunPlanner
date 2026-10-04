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

export interface NumberRunModifierDeclaration extends RunModifierDeclarationShape {
  readonly kind: 'number';
  readonly default: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  /** Suffix shown after an authored value, such as `×` for a multiplier. */
  readonly unit: string;
}

export type RunModifierDeclaration = BooleanRunModifierDeclaration | NumberRunModifierDeclaration;

function declareRunModifiers<const T extends readonly RunModifierDeclaration[]>(
  declarations: T,
): Readonly<T> {
  for (const declaration of declarations) Object.freeze(declaration);
  return Object.freeze(declarations);
}

/** Authoring shape and stage only; the exporting engine and the module hook own behaviour. */
export const RUN_MODIFIER_DECLARATIONS = declareRunModifiers([
  {
    key: 'enemyGoldDropChanceMultiplier',
    kind: 'number',
    default: 1,
    min: 1,
    max: 5,
    step: 0.1,
    unit: '×',
    label: 'Enemy gold chance',
    description: 'Multiplies eligible gold-drop chances up to 100%; room gold limits still apply.',
    stage: 'released',
  },
]);

type DeclaredRunModifier = (typeof RUN_MODIFIER_DECLARATIONS)[number];
export type RunModifierKey = DeclaredRunModifier['key'];

/** The complete authored settings, every declared modifier present. */
export type RunModifiers = {
  readonly [D in DeclaredRunModifier as D['key']]: D['kind'] extends 'boolean' ? boolean : number;
};

/** Persisted settings: only values that differ from their declared default. */
export type RunModifiersRecord = Readonly<Partial<RunModifiers>>;

export const NATIVE_RUN_MODIFIERS: RunModifiers = Object.freeze(
  Object.fromEntries(
    RUN_MODIFIER_DECLARATIONS.map((declaration) => [declaration.key, declaration.default]),
  ) as RunModifiers,
);

export function runModifierDeclaration(key: RunModifierKey): RunModifierDeclaration {
  const declaration = RUN_MODIFIER_DECLARATIONS.find((candidate) => candidate.key === key);
  if (declaration === undefined) throw new Error(`undeclared run modifier ${key}`);
  return declaration;
}

export function isRunModifierValue(declaration: RunModifierDeclaration, value: unknown): boolean {
  if (declaration.kind === 'boolean') return typeof value === 'boolean';
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= declaration.min &&
    value <= declaration.max
  );
}

/** Read the complete settings without inserting persisted fields. */
export function routeRunModifiers(loadout: Pick<RouteLoadout, 'runModifiers'>): RunModifiers {
  return loadout.runModifiers === undefined
    ? NATIVE_RUN_MODIFIERS
    : Object.freeze({ ...NATIVE_RUN_MODIFIERS, ...loadout.runModifiers });
}

export function isNativeRunModifiers(value: RunModifiers): boolean {
  return RUN_MODIFIER_DECLARATIONS.every(
    (declaration) => value[declaration.key] === declaration.default,
  );
}

/** A finite number outside the declared domain clamps to its nearest bound. */
function healRunModifierValue(declaration: RunModifierDeclaration, raw: unknown): boolean | number {
  if (declaration.kind === 'boolean') return typeof raw === 'boolean' ? raw : declaration.default;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return declaration.default;
  return Math.min(declaration.max, Math.max(declaration.min, raw));
}

/** Unknown keys are dropped; a malformed known value heals toward its declaration. */
export function decodeRunModifiers(value: unknown, path: string): RunModifiers {
  const record = expectRecord(value, path);
  const decoded: Record<string, boolean | number> = {};
  for (const declaration of RUN_MODIFIER_DECLARATIONS)
    decoded[declaration.key] = healRunModifierValue(declaration, record[declaration.key]);
  return Object.freeze(decoded) as RunModifiers;
}

/** Non-default values only; undefined when every value is native. */
export function encodeRunModifiers(value: RunModifiers): RunModifiersRecord | undefined {
  const entries = RUN_MODIFIER_DECLARATIONS.filter(
    (declaration) => value[declaration.key] !== declaration.default,
  ).map((declaration) => [declaration.key, value[declaration.key]]);
  return entries.length === 0
    ? undefined
    : (Object.freeze(Object.fromEntries(entries)) as RunModifiersRecord);
}
