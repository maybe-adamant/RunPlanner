import type { FamiliarDeclaration } from '@run-planner/engine/catalog-schema';

export interface RawFamiliarDeclaration {
  readonly key: string;
  readonly label: string;
  readonly matureTraitUpgradeCount: number;
  readonly maxStatPerStack?: FamiliarDeclaration['maxStatPerStack'];
}
