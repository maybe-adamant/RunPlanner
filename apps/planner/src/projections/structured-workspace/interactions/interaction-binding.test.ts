import { describe, expect, it } from 'vitest';

import * as support from '@planner-test/support/structured-workspace/interaction-binding.test-support';

const {
  bind,
  selectedNChaosFrontierProject,
  catalog,
  applyProjectCommand,
  createExitDecisionAddress,
  createHubDecisionAddress,
  createOccurrenceId,
  createTargetAddress,
  semanticAddressKey,
  loadSurfaceNCompleteHubFrontierProject,
  loadSurfaceNEntryFrontierResolvedProject,
  nBiome,
  nOccurrenceIds,
} = support;

describe('structured workspace interaction binding', () => {
  it('binds the terminal Hub as the generic Door 1 choice and preserves completed handoff', () => {
    const boardProject = loadSurfaceNEntryFrontierResolvedProject();
    const hub = createHubDecisionAddress(nBiome, 'hub');
    const terminalOwner = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: nOccurrenceIds.preHub,
    });
    const terminalTarget = createTargetAddress(nBiome, terminalOwner.source, 'exit1');
    const roomPicker = bind(boardProject, 'Surface', 'N').interactions.rooms.get(
      semanticAddressKey(terminalTarget),
    );
    if (roomPicker?.kind !== 'decisionEntryRoom') {
      throw new Error('terminal Hub Door 1 room interaction is missing');
    }
    const hubChoice = roomPicker
      .load()
      .sections.flatMap((section) => section.items)
      .find((item) => item.value.gameName === 'N_Hub');
    expect(hubChoice).toMatchObject({ disabled: false, state: 'forced' });
    expect(roomPicker.intentFor('N_Hub')).toEqual({
      command: { decision: terminalOwner, hub, kind: 'ReplaceWithHubDecision' },
      focus: { owner: hub, timing: 'after' },
    });

    const handoffProject = loadSurfaceNCompleteHubFrontierProject();
    const handoffOwner = createExitDecisionAddress(nBiome, {
      decisionKey: 'hub',
      kind: 'hubDecision',
    });
    const allocated: ReturnType<typeof createOccurrenceId>[] = [];
    const handoff = bind(handoffProject, 'Surface', 'N', () => {
      const occurrenceId = createOccurrenceId(`bound-hub-handoff-${allocated.length + 1}`);
      allocated.push(occurrenceId);
      return occurrenceId;
    }).interactions.takeoverBatches.get(semanticAddressKey(handoffOwner));
    if (handoff?.presentation !== 'completedHubHandoff') {
      throw new Error('completed Hub handoff interaction is missing');
    }
    expect(allocated).toEqual([]);
    expect(handoff.intent()).toEqual({
      command: {
        decision: handoffOwner,
        gameName: 'N_PreBoss01',
        kind: 'CreateTakeoverBatch',
        targetOccurrenceIds: { preboss: createOccurrenceId('bound-hub-handoff-1') },
      },
      focus: { owner: handoffOwner, timing: 'before' },
    });
    expect(allocated).toHaveLength(1);
  });

  it('binds selected N natural Chaos to the same sole Hub Door 1 choice', () => {
    const project = selectedNChaosFrontierProject();
    const chaos = createOccurrenceId('interaction-binding-n-chaos-room');
    const terminalOwner = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: chaos,
    });
    const terminalTarget = createTargetAddress(nBiome, terminalOwner.source, 'exit1');
    const roomPicker = bind(project, 'Surface', 'N').interactions.rooms.get(
      semanticAddressKey(terminalTarget),
    );
    if (roomPicker?.kind !== 'decisionEntryRoom') {
      throw new Error('selected natural Chaos Hub Door 1 room interaction is missing');
    }
    const items = roomPicker.load().sections.flatMap((section) => section.items);
    expect(items.map((item) => item.value.gameName)).toEqual(['N_Hub']);
    expect(items[0]).toMatchObject({ disabled: false, state: 'forced' });
    expect(roomPicker.intentFor('N_Hub')).toEqual({
      command: {
        decision: terminalOwner,
        hub: createHubDecisionAddress(nBiome, 'hub'),
        kind: 'ReplaceWithHubDecision',
      },
      focus: { owner: createHubDecisionAddress(nBiome, 'hub'), timing: 'after' },
    });
    const authored = applyProjectCommand(project, catalog, roomPicker.intentFor('N_Hub').command);
    const topology = authored.route.biomes.find((biome) => biome.biomeKey === 'N')?.topology;
    expect(topology?.decisions).toContainEqual(
      expect.objectContaining({
        kind: 'hub',
        source: { kind: 'occurrence', occurrenceId: chaos },
      }),
    );
    expect(
      topology?.decisions.some(
        (decision) =>
          decision.kind === 'exit' &&
          decision.source.kind === 'occurrence' &&
          decision.source.occurrenceId === chaos,
      ),
    ).toBe(false);
  });

  it('binds an uncommitted selected N natural Chaos frontier to one atomic Hub command', () => {
    const project = selectedNChaosFrontierProject(false);
    const chaos = createOccurrenceId('interaction-binding-n-chaos-room');
    const terminalOwner = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: chaos,
    });
    const bound = bind(project, 'Surface', 'N');
    const roomPicker = bound.interactions.rooms.get(
      semanticAddressKey(createTargetAddress(nBiome, terminalOwner.source, 'exit1')),
    );
    if (roomPicker?.kind !== 'decisionEntryRoom') {
      throw new Error('uncommitted natural Chaos Hub Door 1 room interaction is missing');
    }
    const items = roomPicker.load().sections.flatMap((section) => section.items);
    expect(items).toEqual([
      expect.objectContaining({ value: expect.objectContaining({ gameName: 'N_Hub' }) }),
    ]);
    expect(items[0]).toMatchObject({ disabled: false, state: 'unassessed' });
    const intent = roomPicker.intentFor('N_Hub');
    expect(intent).toEqual({
      command: {
        decision: terminalOwner,
        edit: {
          hub: createHubDecisionAddress(nBiome, 'hub'),
          kind: 'hub',
        },
        kind: 'InitializeExitDecision',
      },
      focus: { owner: createHubDecisionAddress(nBiome, 'hub'), timing: 'after' },
    });
    const authored = applyProjectCommand(project, catalog, intent.command);
    const topology = authored.route.biomes.find((biome) => biome.biomeKey === 'N')?.topology;
    expect(topology?.decisions).toContainEqual(
      expect.objectContaining({
        kind: 'hub',
        source: { kind: 'occurrence', occurrenceId: chaos },
      }),
    );
  });
});
