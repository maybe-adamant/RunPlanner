import type { Catalog } from '@run-planner/engine';

export type ActiveBiomeCapability = 'authorable' | 'simulatable' | 'editable';

export interface BiomeCapability {
  readonly biomeKey: string;
  readonly declared: true;
  readonly authorable: boolean;
  readonly simulatable: boolean;
  readonly editable: boolean;
}

export interface PlannerCapabilities {
  readonly values: readonly BiomeCapability[];
  readonly byBiomeKey: Readonly<Record<string, BiomeCapability>>;
}

export interface PlannerCapabilityDefinition {
  readonly authorableBiomeKeys: readonly string[];
  readonly simulatableBiomeKeys: readonly string[];
  readonly editableBiomeKeys: readonly string[];
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
  const placedBiomeKeys = new Set(catalog.routes.values.flatMap((route) => route.biomeKeys));
  const declaredBiomeKeys = catalog.biomes.values
    .filter(
      (biome) =>
        placedBiomeKeys.has(biome.key) && catalog.biomeLayouts.byKey[biome.key] !== undefined,
    )
    .map((biome) => biome.key);
  const declared = new Set(declaredBiomeKeys);
  const authorable = normalizeActiveSet(
    definition.authorableBiomeKeys,
    'capabilities.authorableBiomeKeys',
    declared,
  );
  const simulatable = normalizeActiveSet(
    definition.simulatableBiomeKeys,
    'capabilities.simulatableBiomeKeys',
    declared,
  );
  const editable = normalizeActiveSet(
    definition.editableBiomeKeys,
    'capabilities.editableBiomeKeys',
    declared,
  );

  for (const biomeKey of editable) {
    if (!authorable.has(biomeKey)) {
      throw new PlannerCapabilityContractError(
        'capabilities.editableBiomeKeys',
        `${biomeKey} must also be authorable`,
      );
    }
  }

  const values = declaredBiomeKeys.map((biomeKey) =>
    Object.freeze({
      biomeKey,
      declared: true as const,
      authorable: authorable.has(biomeKey),
      simulatable: simulatable.has(biomeKey),
      editable: editable.has(biomeKey),
    }),
  );

  return Object.freeze({
    values: Object.freeze(values),
    byBiomeKey: Object.freeze(
      Object.fromEntries(values.map((capability) => [capability.biomeKey, capability])),
    ),
  });
}

export function hasBiomeCapability(
  capabilities: PlannerCapabilities,
  biomeKey: string,
  capability: ActiveBiomeCapability,
): boolean {
  return capabilities.byBiomeKey[biomeKey]?.[capability] === true;
}

export function requireBiomeCapability(
  capabilities: PlannerCapabilities,
  biomeKey: string,
  capability: ActiveBiomeCapability,
  path: string,
): void {
  if (!hasBiomeCapability(capabilities, biomeKey, capability)) {
    throw new PlannerCapabilityContractError(path, `${biomeKey} is not ${capability}`);
  }
}
