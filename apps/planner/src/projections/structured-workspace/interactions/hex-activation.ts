import type {
  AcquisitionRoleAddress,
  AuthoredHexActivation,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { HexActivationCandidateCapability } from '@run-planner/engine/simulation';

import { presentHexActivationDraftIssues } from '@planner/projections/evaluationProjection';
import type {
  WorkspaceHexActivationBoard,
  WorkspaceHexActivationInteraction,
  WorkspaceHexActivationNode,
} from '../contracts/traits';
import { projectHexBoardNodes } from './trait-offers/hex';

/** The plain tree at one Path screen: each node's state for the selection and its findings. */
export function projectHexActivationBoard(
  catalog: Catalog,
  capability: HexActivationCandidateCapability,
  selection: readonly string[],
): WorkspaceHexActivationBoard | undefined {
  const hex = catalog.hexes.byKey[capability.spellTraitKey];
  const layout = hex?.layouts.byKey[capability.tree.layoutKey];
  if (hex === undefined || layout === undefined) return undefined;
  const board = projectHexBoardNodes(
    hex,
    layout,
    capability.tree,
    (node) =>
      capability.godSentAdded || (node.kind !== 'olympianSpell' && node.kind !== 'olympianCount'),
  );
  const invested = new Set(capability.investedNodeKeys);
  const selected = new Set(selection);
  const available = new Set(capability.availableNodeKeys(selection));
  const violations = capability.assess(selection);
  const conflicting = new Set(
    violations.flatMap((violation) => ('nodeKey' in violation ? [violation.nodeKey] : [])),
  );
  const nodes = board.map((node): WorkspaceHexActivationNode => {
    const conflict = conflicting.has(node.nodeKey);
    // A saved selection that conflicts stays removable, even on an invested node.
    if (selected.has(node.nodeKey))
      return Object.freeze({
        ...node,
        state: 'selected',
        conflict,
        toggled: Object.freeze(selection.filter((key) => key !== node.nodeKey)),
      });
    if (invested.has(node.nodeKey))
      return Object.freeze({
        ...node,
        state: 'invested',
        conflict,
        hint: 'Invested on an earlier Path of Stars screen.',
      });
    if (available.has(node.nodeKey))
      return Object.freeze({
        ...node,
        state: 'available',
        conflict,
        toggled: Object.freeze([...selection, node.nodeKey]),
      });
    return Object.freeze({ ...node, state: 'unavailable', conflict });
  });
  const labels = new Map(nodes.map((node) => [node.nodeKey, node.talentLabel]));
  return Object.freeze({
    treeLabel: `${catalog.traits.byKey[capability.spellTraitKey]?.label ?? capability.spellTraitKey} Hex tree`,
    nodes: Object.freeze(nodes),
    pointsLabel: `${selection.length} of ${capability.count} points`,
    issues: presentHexActivationDraftIssues(violations, (key) => labels.get(key) ?? key),
  });
}

/**
 * `Edit Path of Stars`, summarised by the talents the screen invests. The tree
 * naming them is the reached screen's, so a lost context shows no summary.
 */
function launcherFor(
  catalog: Catalog,
  capability: HexActivationCandidateCapability | undefined,
  value: AuthoredHexActivation | undefined,
): WorkspaceHexActivationInteraction['launcher'] {
  const keys = value?.selectedNodeKeys ?? [];
  const unsummarised = Object.freeze({ label: 'Edit Path of Stars' });
  if (capability === undefined || keys.length === 0) return unsummarised;
  const hex = catalog.hexes.byKey[capability.spellTraitKey];
  const layout = hex?.layouts.byKey[capability.tree.layoutKey];
  if (hex === undefined || layout === undefined) return unsummarised;
  const labels = new Map(
    projectHexBoardNodes(hex, layout, capability.tree).map((node) => [
      node.nodeKey,
      node.talentLabel,
    ]),
  );
  return Object.freeze({
    label: 'Edit Path of Stars',
    detail: condensedTalents(keys.map((key) => labels.get(key) ?? key)),
  });
}

/** Talents in first-appearance order, a repeat counted once: "Omen ×2, Sting". */
export function condensedTalents(talents: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const talent of talents) counts.set(talent, (counts.get(talent) ?? 0) + 1);
  return [...counts]
    .map(([talent, count]) => (count === 1 ? talent : `${talent} ×${count}`))
    .join(', ');
}

/** Binds one Path screen role; absent where neither the engine nor the reward has a screen. */
export function bindHexActivationInteraction(input: {
  readonly catalog: Catalog;
  readonly address: AcquisitionRoleAddress;
  readonly capability: HexActivationCandidateCapability | undefined;
  readonly value: AuthoredHexActivation | undefined;
}): WorkspaceHexActivationInteraction | undefined {
  const { address, capability, catalog, value } = input;
  if (capability === undefined && value === undefined) return undefined;
  return Object.freeze({
    contextReached: capability !== undefined,
    launcher: launcherFor(catalog, capability, value),
    selectedNodeKeys: value?.selectedNodeKeys,
    boardFor: (selection: readonly string[]) =>
      capability === undefined
        ? undefined
        : projectHexActivationBoard(catalog, capability, selection),
    intentFor: (selectedNodeKeys: readonly string[]) =>
      Object.freeze({
        command: Object.freeze({
          kind: 'ReplaceHexActivation' as const,
          acquisition: address,
          value: Object.freeze({ selectedNodeKeys: Object.freeze([...selectedNodeKeys]) }),
        }),
        focus: Object.freeze({ owner: address, timing: 'after' as const }),
      }),
  });
}
