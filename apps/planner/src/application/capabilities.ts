import type { Catalog } from '@run-planner/core';

export type ActiveBiomeCapability = 'authorable' | 'simulatable' | 'editable';

export interface BiomeCapability {
  readonly biomeStepKey: string;
  readonly declared: true;
  readonly authorable: boolean;
  readonly simulatable: boolean;
  readonly editable: boolean;
}

export interface PlannerCapabilities {
  readonly values: readonly BiomeCapability[];
  readonly byBiomeStepKey: Readonly<Record<string, BiomeCapability>>;
}

export interface PlannerCapabilityDefinition {
  readonly authorableBiomeStepKeys: readonly string[];
  readonly simulatableBiomeStepKeys: readonly string[];
  readonly editableBiomeStepKeys: readonly string[];
}

export class PlannerCapabilityContractError extends Error {
  readonly path: string;
  readonly detail: string;

  constructor(path: string, detail: string) {
    super(`${path}: ${detail}`);
    this.name = 'PlannerCapabilityContractError';
    this.path = path;
    this.detail = detail;
  }
}

function normalizeActiveSet(
  keys: readonly string[],
  path: string,
  declared: ReadonlySet<string>,
): ReadonlySet<string> {
  const normalized = new Set<string>();
  for (const [index, key] of keys.entries()) {
    if (normalized.has(key)) {
      throw new PlannerCapabilityContractError(`${path}[${index}]`, `duplicates ${key}`);
    }
    if (!declared.has(key)) {
      throw new PlannerCapabilityContractError(`${path}[${index}]`, `${key} is not declared`);
    }
    normalized.add(key);
  }
  return normalized;
}

export function createPlannerCapabilities(
  catalog: Catalog,
  definition: PlannerCapabilityDefinition,
): PlannerCapabilities {
  const declaredBiomeStepKeys = catalog.routes.values
    .flatMap((route) => route.biomeSteps)
    .filter((step) => catalog.biomeLayouts.byKey[step.key] !== undefined)
    .map((step) => step.key);
  const declared = new Set(declaredBiomeStepKeys);
  const authorable = normalizeActiveSet(
    definition.authorableBiomeStepKeys,
    'capabilities.authorableBiomeStepKeys',
    declared,
  );
  const simulatable = normalizeActiveSet(
    definition.simulatableBiomeStepKeys,
    'capabilities.simulatableBiomeStepKeys',
    declared,
  );
  const editable = normalizeActiveSet(
    definition.editableBiomeStepKeys,
    'capabilities.editableBiomeStepKeys',
    declared,
  );

  for (const biomeStepKey of editable) {
    if (!authorable.has(biomeStepKey)) {
      throw new PlannerCapabilityContractError(
        'capabilities.editableBiomeStepKeys',
        `${biomeStepKey} must also be authorable`,
      );
    }
  }

  const values = declaredBiomeStepKeys.map((biomeStepKey) =>
    Object.freeze({
      biomeStepKey,
      declared: true as const,
      authorable: authorable.has(biomeStepKey),
      simulatable: simulatable.has(biomeStepKey),
      editable: editable.has(biomeStepKey),
    }),
  );

  return Object.freeze({
    values: Object.freeze(values),
    byBiomeStepKey: Object.freeze(
      Object.fromEntries(values.map((capability) => [capability.biomeStepKey, capability])),
    ),
  });
}

export function hasBiomeCapability(
  capabilities: PlannerCapabilities,
  biomeStepKey: string,
  capability: ActiveBiomeCapability,
): boolean {
  return capabilities.byBiomeStepKey[biomeStepKey]?.[capability] === true;
}

export function requireBiomeCapability(
  capabilities: PlannerCapabilities,
  biomeStepKey: string,
  capability: ActiveBiomeCapability,
  path: string,
): void {
  if (!hasBiomeCapability(capabilities, biomeStepKey, capability)) {
    throw new PlannerCapabilityContractError(path, `${biomeStepKey} is not ${capability}`);
  }
}
