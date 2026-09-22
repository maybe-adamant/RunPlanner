import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createOccurrenceId,
  encodeProjectDocument,
  semanticAddressKey,
  type ProjectDocument,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import { simulateProject, simulateProjectAssembly } from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { loadProjectDocument } from '@planner/persistence/projectDocumentLoader';
import { loadSurfaceNOProject, loadSurfaceNOPQProject } from '@run-planner/test-fixtures/surface';
import { createCandidateSessionFactory } from '@planner/projections/candidates/candidateProjection';
import { createContextualOptionResolver } from '@planner/projections/contextual/contextualOptions';
import { createContextualPickerProjection } from '@planner/projections/contextual/contextualPicker';
import { createRewardPickerProjection } from '@planner/projections/rewards/rewardPicker';
import { createTraitDomainProjection } from '@planner/projections/rewards/traitDomainProjection';
import {
  createStructuredWorkspaceProjection,
  type StructuredWorkspaceProjection,
} from '@planner/projections/structured-workspace';

const contextualPicker = createContextualPickerProjection(createContextualOptionResolver(catalog));
const projection = createStructuredWorkspaceProjection(
  catalog,
  {
    candidateSessions: createCandidateSessionFactory(catalog),
    contextualPicker,
    rewardPicker: createRewardPickerProjection(catalog, contextualPicker),
    traitDomain: createTraitDomainProjection(catalog, contextualPicker),
  },
  () => createOccurrenceId('boss-door-store-start'),
);

function project(document: ProjectDocument): StructuredWorkspaceProjection {
  return projection.project(simulateProjectAssembly(catalog, document));
}

/**
 * A save whose Preboss -> Boss link carries no boss-door store: the field is
 * wire-optional, so a document may legitimately omit it and must then decode as
 * an unresolved store. It is loaded through the app's own loader so the witness
 * runs the real decode path.
 */
function unresolvedBossDoorProject(): ProjectDocument {
  const encoded = JSON.parse(encodeProjectDocument(loadSurfaceNOProject())) as {
    route: {
      biomes: readonly {
        biomeKey: string;
        topology: { fixedRoomLinks: { rewardStoreKey?: string }[] } | null;
      }[];
    };
  };
  const links =
    encoded.route.biomes.find((biome) => biome.biomeKey === 'O')?.topology?.fixedRoomLinks ?? [];
  let stripped = 0;
  for (const link of links) {
    if (link.rewardStoreKey === undefined) continue;
    delete link.rewardStoreKey;
    stripped += 1;
  }
  if (stripped !== 1) throw new Error('the O checkpoint no longer carries one boss-door store');
  return loadProjectDocument(JSON.stringify(encoded), catalog).project;
}

/** The one unresolved boss door the corrected completeness pass raises. */
function bossDoorFinding(workspace: StructuredWorkspaceProjection): SemanticAddress {
  const origins = [...workspace.findingsByRepairTarget.values()]
    .flat()
    .filter((finding) => finding.code === 'batchRewardStoreMissing')
    .map((finding) => finding.origin)
    .filter((origin) => origin.kind === 'batchRewardStore' && origin.source.kind === 'occurrence');
  const first = origins[0];
  if (first === undefined) throw new Error('no boss-door reward-store finding was raised');
  return first;
}

describe('boss-door reward store workspace binding', () => {
  it('routes the unresolved boss-door finding to its Preboss node and publishes the selector', () => {
    const workspace = project(unresolvedBossDoorProject());
    const origin = bossDoorFinding(workspace);
    const key = semanticAddressKey(origin);

    // The finding routes rather than throwing: an exact destination on a real node.
    const destination = workspace.focusByOwner.get(key);
    expect(destination).toBeDefined();
    expect(destination?.inspectorSubject?.kind).toBe('node');
    expect(destination?.region).toBe('structure');
    const biome = workspace.route.biomes.find(
      (candidate) => candidate.biomeKey === destination?.biomeKey,
    );
    const node = biome?.nodes.find((candidate) => candidate.key === destination?.nodeKey);
    expect(node?.kind).toBe('occurrenceWorkbench');

    // The selector is an ordinary batch reward-store interaction, unselected.
    const interaction = workspace.interactions.batchRewardStores.get(key);
    expect(interaction).toBeDefined();
    expect(interaction?.selected).toBeUndefined();
    expect(interaction?.choices.length ?? 0).toBeGreaterThan(0);

    // It is published on the Preboss room itself.
    if (node?.kind !== 'occurrenceWorkbench') throw new Error('unreachable');
    expect(node.room.kind).toBe('Preboss');
    expect(node.room.bossDoorRewardStore?.address).toEqual(origin);
  });

  it('repairs through ReplaceBossDoorRewardStore and clears the finding', () => {
    const before = project(unresolvedBossDoorProject());
    const origin = bossDoorFinding(before);
    const key = semanticAddressKey(origin);
    const interaction = before.interactions.batchRewardStores.get(key);
    if (interaction === undefined) throw new Error('missing boss-door interaction');
    const storeKey = interaction.choices[0]?.value;
    if (storeKey === undefined) throw new Error('boss-door policy offered no store');

    const intent = interaction.intentFor(storeKey);
    expect(intent.command.kind).toBe('ReplaceBossDoorRewardStore');

    const repaired = applyProjectCommand(unresolvedBossDoorProject(), catalog, intent.command);
    const after = project(repaired);
    const repairedFindings = [...after.findingsByRepairTarget.values()]
      .flat()
      .filter(
        (finding) =>
          finding.code === 'batchRewardStoreMissing' && semanticAddressKey(finding.origin) === key,
      );
    expect(repairedFindings).toEqual([]);
    expect(after.interactions.batchRewardStores.get(key)?.selected).toBe(storeKey);
    // A save without the field decodes unresolved, surfaces the finding, and
    // the command alone returns it to a valid route.
    expect(simulateProject(catalog, repaired).findings).toEqual([]);

    // The selector keeps working on the now-COMPLETE biome. The candidate path
    // resolves a boss door only from a prefix, so without a published support
    // entry every option here degraded to `targetNotReachable` — an authored
    // boss store would have gone permanently unselectable.
    const options = after.interactions.batchRewardStores.get(key)?.load() ?? [];
    expect(options.length).toBe(interaction.choices.length);
    for (const option of options) {
      expect(option.evaluation.kind).toBe('batchRewardStore');
      if (option.evaluation.kind !== 'batchRewardStore') throw new Error('unreachable');
      expect(option.evaluation.result.enteredStoreCount).toBeGreaterThan(0);
      expect(option.evaluation.result.supportStoreKeys.length).toBeGreaterThan(0);
      expect(option.evaluation.result.selectedPossible).toBe(
        option.evaluation.result.supportStoreKeys.includes(option.value),
      );
    }
  });

  it('shows a saturated boss door as unsupported rather than unreachable', () => {
    // P's boss door is the saturated case: 17 entered / 2 meta at the Preboss's
    // exit, so RunProgress is out of support. The option must come back as a
    // real support verdict carrying its reason, never as an unreachable target.
    const workspace = project(loadSurfaceNOPQProject());
    const owner = createBatchRewardStoreAddress(createBiomeAddress('Surface', 'P'), {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('surface-p-preboss-shop'),
    });
    const interaction = workspace.interactions.batchRewardStores.get(semanticAddressKey(owner));
    if (interaction === undefined) throw new Error('missing P boss-door interaction');
    expect(interaction.selected).toBe('MetaProgress');
    const byValue = new Map(interaction.load().map((option) => [option.value, option.evaluation]));
    for (const [value, possible] of [
      ['MetaProgress', true],
      ['RunProgress', false],
    ] as const) {
      const evaluation = byValue.get(value);
      if (evaluation?.kind !== 'batchRewardStore') throw new Error(`${value} lost its support`);
      expect(evaluation.result.selectedPossible).toBe(possible);
      expect(evaluation.result.supportStoreKeys).toEqual(['MetaProgress']);
    }
  });

  it('refuses a store the boss-door policy does not offer', () => {
    const document = unresolvedBossDoorProject();
    const before = project(document);
    const origin = bossDoorFinding(before);
    if (origin.kind !== 'batchRewardStore') throw new Error('unreachable');
    expect(() =>
      applyProjectCommand(document, catalog, {
        kind: 'ReplaceBossDoorRewardStore',
        rewardStore: createBatchRewardStoreAddress(
          createBiomeAddress(origin.routeKey, origin.biomeKey),
          origin.source,
        ),
        storeKey: 'NotAStore',
      }),
    ).toThrow();
  });
});
