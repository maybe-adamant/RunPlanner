import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomActionAddress,
  createRoomFeatureAddress,
  roomActionKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { createGoldenFGHIProject } from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNOPQProject } from '@run-planner/test-fixtures/surface';
import type {
  StructuredWorkspaceProjection,
  WorkspaceOccurrenceWorkbenchNode,
} from '@planner/projections/structured-workspace';
import {
  projectStructuredWorkspaceFixture,
  requireWorkspaceBiome,
} from '@planner-test/fixtures/structuredWorkspace';

const use = Object.freeze({ kind: 'interactChallengeSwitch' as const });

function host(project: ProjectDocument, biomeKey: string, occurrenceId: string) {
  return createOccurrenceAddress(
    createBiomeAddress(project.route.routeKey, biomeKey),
    createOccurrenceId(occurrenceId),
  );
}

function observed(
  project: ProjectDocument,
  biomeKey: string,
  occurrenceId: string,
  variantKey: string,
  used = false,
): ProjectDocument {
  const occurrence = host(project, biomeKey, occurrenceId);
  let next = applyProjectCommand(project, catalog, {
    kind: 'ReplaceChallengeSwitch',
    occurrence,
    variantKey,
  });
  if (!used) return next;
  const room = next.route.biomes
    .find((biome) => biome.biomeKey === biomeKey)!
    .topology!.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId)!;
  next = applyProjectCommand(next, catalog, {
    kind: 'InsertRoomAction',
    action: createRoomActionAddress(
      createBiomeAddress(project.route.routeKey, biomeKey),
      occurrence.occurrenceId,
      roomActionKey(use),
    ),
    reference: use,
    index: room.roomActions.order.length,
  });
  return next;
}

function room(
  workspace: StructuredWorkspaceProjection,
  biomeKey: string,
  occurrenceId: string,
): WorkspaceOccurrenceWorkbenchNode['room'] {
  const node = requireWorkspaceBiome(workspace, biomeKey).nodes.find(
    (candidate): candidate is WorkspaceOccurrenceWorkbenchNode =>
      candidate.kind === 'occurrenceWorkbench' && candidate.room.occurrenceId === occurrenceId,
  );
  if (node === undefined) throw new Error(`${occurrenceId} has no room workbench`);
  return node.room;
}

const kindsOf = (summary: WorkspaceOccurrenceWorkbenchNode['room']) =>
  summary.challengeSwitch?.kinds.map((row) => ({
    kind: row.kind,
    selected: row.selected,
    observe: row.observeVariantKey,
    lock: row.lock?.reason,
  }));

describe('challenge switch in the structured workspace', () => {
  it('offers each kind its rollable variant at a host and nothing at a non-host', () => {
    const { workspace } = projectStructuredWorkspaceFixture(createGoldenFGHIProject());

    expect(kindsOf(room(workspace, 'F', 'golden-f-b5-e1'))).toEqual([
      {
        kind: 'perfectClear',
        selected: false,
        observe: 'PerfectClearChallengeSwitch_Pom',
        lock: undefined,
      },
      { kind: 'time', selected: false, observe: 'TimeChallengeSwitch_Money', lock: undefined },
      { kind: 'elite', selected: false, observe: undefined, lock: 'kindUnavailable' },
    ]);
    // A shared spawn rule locks every kind.
    expect(kindsOf(room(workspace, 'F', 'golden-f-b1-e1'))?.map((row) => row.lock)).toEqual([
      'biomeDepth',
      'biomeDepth',
      'biomeDepth',
    ]);
    expect(room(workspace, 'F', 'golden-f-start').challengeSwitch).toBeUndefined();
  });

  it('binds observing, clearing and the observed encounter to the switch commands', () => {
    const project = observed(
      createGoldenFGHIProject(),
      'F',
      'golden-f-b5-e1',
      'PerfectClearChallengeSwitch_MaxHealth',
    );
    const { workspace } = projectStructuredWorkspaceFixture(project);
    const summary = room(workspace, 'F', 'golden-f-b5-e1');
    const owner = host(project, 'F', 'golden-f-b5-e1');
    const interaction = workspace.interactions.challengeSwitches.get(
      summary.challengeSwitch!.interactionKey,
    )!;

    expect(summary.challengeSwitch?.address).toEqual(
      createRoomFeatureAddress(owner, { kind: 'challengeSwitch' }),
    );
    expect(
      summary.challengeSwitch?.kinds[0]?.variants.map((variant) => [
        variant.variantKey,
        variant.selected,
      ]),
    ).toEqual([
      ['PerfectClearChallengeSwitch_Pom', false],
      ['PerfectClearChallengeSwitch_MaxHealth', true],
    ]);
    expect(interaction.observeIntentFor(null).command).toEqual({
      kind: 'ReplaceChallengeSwitch',
      occurrence: owner,
      variantKey: null,
    });
    expect(summary.challengeSwitch?.encounter?.definitionKey).toBe('PerfectClearChallengeF');
    expect(summary.challengeSwitch?.encounter?.composition).toBeDefined();
    const decision = summary.challengeSwitch?.encounter?.customization?.[0];
    expect(decision?.selection.kind).toBe('generated');
    expect(interaction.customization?.intentFor(decision!.key, null).command).toEqual({
      kind: 'ReplaceChallengeSwitchCustomization',
      occurrence: owner,
      decisionKey: decision!.key,
      value: null,
    });
    // The engine's composition capability assesses the switch encounter.
    expect(interaction.customization?.generatedAssessment).toBeDefined();
  });

  it('names the switch use by its kind and groups its claim pickups under the switch', () => {
    const { workspace } = projectStructuredWorkspaceFixture(
      observed(createGoldenFGHIProject(), 'F', 'golden-f-b5-e1', 'TimeChallengeSwitch_Money', true),
    );
    const rows = room(workspace, 'F', 'golden-f-b5-e1').roomActions!.rows;
    const claim = rows.find((row) => row.sourceFamily?.kind === 'challengeSwitch');

    const use = rows.find((row) => row.reference.kind === 'interactChallengeSwitch');
    expect(use?.label).toBe('Use Infernal Trove');
    expect(use?.challengeSwitchKind).toBe('time');
    expect(claim?.addGroup).toEqual({
      key: 'object:challengeSwitch',
      label: 'Challenge Switch',
      object: 'challengeSwitch',
    });
    expect(claim?.labelParts?.origin).toBe('Claimed from the challenge switch');
  });

  it("narrows each Elite attribute draw by the earlier ones and binds the elite's pin", () => {
    const surface = loadSurfaceNOPQProject();
    const owner = host(surface, 'P', 'surface-p-6-1-p_combat10');
    const pinned = applyProjectCommand(
      observed(surface, 'P', 'surface-p-6-1-p_combat10', 'EliteChallengeSwitch_MaxMana'),
      catalog,
      {
        kind: 'ReplaceChallengeSwitchElite',
        occurrence: owner,
        elite: { enemyKey: 'Dragon_Elite', attributeKeys: ['Frenzy'] },
      },
    );
    const { workspace } = projectStructuredWorkspaceFixture(pinned);
    const summary = room(workspace, 'P', 'surface-p-6-1-p_combat10').challengeSwitch!;
    const [first, second] = summary.elite!.attributes;

    expect(summary.encounter).toBeUndefined();
    expect(summary.elite?.enemyKey).toBe('Dragon_Elite');
    expect(first?.key).toBe('Frenzy');
    expect(first?.choices.map((choice) => choice.key)).toContain('Frenzy');
    expect(second?.key).toBeUndefined();
    expect(second?.choices.map((choice) => choice.key)).not.toContain('Frenzy');
    expect(
      workspace.interactions.challengeSwitches
        .get(summary.interactionKey)!
        .eliteIntentFor({ enemyKey: 'Dragon_Elite', attributeKeys: ['Frenzy', 'Blink'] }).command,
    ).toEqual({
      kind: 'ReplaceChallengeSwitchElite',
      occurrence: owner,
      elite: { enemyKey: 'Dragon_Elite', attributeKeys: ['Frenzy', 'Blink'] },
    });
  });

  it("binds a pressed switch's per-kind outcome and Nectar on its use row", () => {
    const project = observed(
      createGoldenFGHIProject(),
      'F',
      'golden-f-b5-e1',
      'TimeChallengeSwitch_Money',
      true,
    );
    const { workspace } = projectStructuredWorkspaceFixture(project);
    const row = room(workspace, 'F', 'golden-f-b5-e1').roomActions!.rows.find(
      (candidate) => candidate.reference.kind === 'interactChallengeSwitch',
    )!;
    const outcome = row.challengeSwitchOutcome!;
    const interaction = workspace.interactions.challengeSwitches.get(outcome.interactionKey)!;

    // Only a finished fight's claim can also drop the Nectar, so it is listed both ways.
    expect(outcome.choices.map((choice) => [choice.outcome, choice.nectar])).toEqual([
      ['left', false],
      ['finished', false],
      ['finished', true],
    ]);
    expect(outcome.choices.find((choice) => choice.key === outcome.current)).toMatchObject({
      outcome: 'finished',
      nectar: false,
    });
    expect(interaction.outcomeIntentFor('left', false)?.command).toMatchObject({
      kind: 'ReplaceChallengeSwitchOutcome',
      outcome: 'left',
      nectarDropped: false,
    });
    expect(interaction.outcomeIntentFor('finished', true)?.command).toMatchObject({
      outcome: 'finished',
      nectarDropped: true,
    });
    expect(interaction.outcomeIntentFor('hitless', false)).toBeUndefined();
    const withNectar = projectStructuredWorkspaceFixture(
      applyProjectCommand(
        project,
        catalog,
        interaction.outcomeIntentFor('finished', true)!.command,
      ),
    ).workspace;
    const nectarOutcome = room(withNectar, 'F', 'golden-f-b5-e1').roomActions!.rows.find(
      (candidate) => candidate.reference.kind === 'interactChallengeSwitch',
    )!.challengeSwitchOutcome!;
    expect(
      nectarOutcome.choices.find((choice) => choice.key === nectarOutcome.current),
    ).toMatchObject({ outcome: 'finished', nectar: true });
    // The claim's gold sits on its Collect row with the estimate's hover, not on the use row.
    expect(row.goldGained).toBeUndefined();
    const claim = room(workspace, 'F', 'golden-f-b5-e1').roomActions!.rows.find(
      (candidate) => candidate.sourceFamily?.kind === 'challengeSwitch',
    );
    expect(claim?.goldGained?.hint).toEqual(expect.any(String));

    const left = projectStructuredWorkspaceFixture(
      applyProjectCommand(project, catalog, interaction.outcomeIntentFor('left', false)!.command),
    ).workspace;
    const leftRows = room(left, 'F', 'golden-f-b5-e1').roomActions!.rows;
    const leftOutcome = leftRows.find(
      (candidate) => candidate.reference.kind === 'interactChallengeSwitch',
    )!.challengeSwitchOutcome!;
    expect(leftOutcome.choices.find((choice) => choice.key === leftOutcome.current)).toMatchObject({
      outcome: 'left',
      nectar: false,
    });
    // A left fight claims nothing.
    expect(leftRows.some((candidate) => candidate.sourceFamily?.kind === 'challengeSwitch')).toBe(
      false,
    );
  });
});
