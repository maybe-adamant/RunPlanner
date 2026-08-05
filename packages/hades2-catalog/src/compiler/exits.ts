import type {
  CatalogCollection,
  ExitBehavior,
  ExitCompatibilityPolicy,
  ExitTypeDeclaration,
  RoomStructuralTag,
} from '@run-planner/engine/catalog-schema';
import type { RawExitTypeDeclaration } from '../declarations';

import { createCollection, requireNonEmpty } from './common';
import { fail } from './errors';

const structuralTags = new Set<RoomStructuralTag>(['Indoor', 'Outdoor']);

function requireStructuralTag(value: RoomStructuralTag, path: string): RoomStructuralTag {
  if (!structuralTags.has(value)) {
    fail(path, `unknown structural tag ${String(value)}`);
  }
  return value;
}

export function normalizeExitTypes(
  rawExitTypes: readonly RawExitTypeDeclaration[],
  policies: CatalogCollection<ExitCompatibilityPolicy>,
): CatalogCollection<ExitTypeDeclaration> {
  const exitTypes = rawExitTypes.map((exitType, index): ExitTypeDeclaration => {
    const path = `exitTypes[${index}]`;
    const key = requireNonEmpty(exitType.key, `${path}.key`);
    const compatibilityPolicyKey = requireNonEmpty(
      exitType.compatibilityPolicyKey,
      `${path}.compatibilityPolicyKey`,
    );
    if (policies.byKey[compatibilityPolicyKey] === undefined) {
      fail(
        `${path}.compatibilityPolicyKey`,
        `unknown exit compatibility policy ${compatibilityPolicyKey}`,
      );
    }
    const behavior = normalizeExitBehavior(exitType.behavior, `${path}.behavior`);
    return Object.freeze({ key, compatibilityPolicyKey, behavior });
  });
  return createCollection(exitTypes, 'exitTypes', (exitType) => exitType.key, 'key');
}

function normalizeExitBehavior(raw: ExitBehavior | undefined, path: string): ExitBehavior {
  if (raw === undefined) {
    return Object.freeze({ kind: 'playerSelected', rewardPreview: 'visible' });
  }
  if (raw.kind === 'playerSelected') {
    if (raw.rewardPreview !== 'visible' && raw.rewardPreview !== 'hidden') {
      fail(`${path}.rewardPreview`, `unknown reward preview ${String(raw.rewardPreview)}`);
    }
    return Object.freeze({ kind: 'playerSelected', rewardPreview: raw.rewardPreview });
  }
  if (raw.kind === 'automaticHostContinuation') {
    if (raw.rewardPreview !== 'hidden') {
      fail(`${path}.rewardPreview`, 'automatic host continuations must hide reward preview');
    }
    return Object.freeze({ kind: 'automaticHostContinuation', rewardPreview: 'hidden' });
  }
  fail(`${path}.kind`, `unknown exit behavior ${String((raw as { kind?: unknown }).kind)}`);
}

export function normalizeExitCompatibilityPolicies(
  rawPolicies: readonly ExitCompatibilityPolicy[],
): CatalogCollection<ExitCompatibilityPolicy> {
  const policies = rawPolicies.map((policy, index): ExitCompatibilityPolicy => {
    const path = `exitCompatibilityPolicies[${index}]`;
    const key = requireNonEmpty(policy.key, `${path}.key`);
    const receivedKind: unknown = (policy as { readonly kind?: unknown }).kind;
    if (policy.kind === 'unconstrained') {
      return Object.freeze({ key, kind: 'unconstrained' });
    }
    if (policy.kind === 'targetHasTag') {
      return Object.freeze({
        key,
        kind: 'targetHasTag',
        targetTag: requireStructuralTag(policy.targetTag, `${path}.targetTag`),
      });
    }
    if (policy.kind === 'sourceTagRequiresTargetTag') {
      return Object.freeze({
        key,
        kind: 'sourceTagRequiresTargetTag',
        sourceTag: requireStructuralTag(policy.sourceTag, `${path}.sourceTag`),
        targetTag: requireStructuralTag(policy.targetTag, `${path}.targetTag`),
      });
    }
    fail(`${path}.kind`, `unknown exit compatibility policy ${String(receivedKind)}`);
  });

  return createCollection(policies, 'exitCompatibilityPolicies', (policy) => policy.key, 'key');
}
