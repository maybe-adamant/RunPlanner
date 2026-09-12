import { describe, expect, it } from 'vitest';

import * as support from '@planner-test/support/structured-workspace/interaction-binding.test-support';

const {
  bind,
  catalog,
  applyProjectCommand,
  createHubDecisionAddress,
  createOccurrenceId,
  semanticAddressKey,
  loadSurfaceNOPQProject,
  nBiome,
  nVisitSlotKeys,
} = support;

describe('structured workspace interaction binding', () => {
  it('binds one provisional Hub-slot identity per explicit opening attempt', () => {
    const project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      hub: createHubDecisionAddress(nBiome, 'hub'),
      hubSlotKeys: nVisitSlotKeys.slice(0, 5),
      kind: 'ReplaceHubVisitOrder',
    });
    const allocated: ReturnType<typeof createOccurrenceId>[] = [];
    const { interactions } = bind(project, 'Surface', 'N', () => {
      const occurrenceId = createOccurrenceId(`bound-hub-opening-${allocated.length + 1}`);
      allocated.push(occurrenceId);
      return occurrenceId;
    });
    const slot = [...interactions.hubSlots.values()].find((candidate) => !candidate.selected);
    if (slot === undefined) throw new Error('closed Hub-slot interaction is missing');

    expect(allocated).toEqual([]);
    const firstAttempt = slot.beginOpeningAttempt();
    const firstAttemptIds = [...allocated];
    expect(firstAttemptIds[0]).toBe(createOccurrenceId('bound-hub-opening-1'));
    expect(firstAttemptIds.length).toBeGreaterThan(1);
    const firstCandidates = firstAttempt.load();
    expect(firstAttempt.load()).toBe(firstCandidates);
    const firstIntent = firstAttempt.intentFor(true);
    expect(firstIntent.command).toMatchObject({
      kind: 'OpenHubSlot',
      occurrenceId: firstAttemptIds[0],
      slot: slot.owner,
    });
    if (firstIntent.command.kind !== 'OpenHubSlot') {
      throw new Error('Hub opening intent is missing');
    }
    expect(Object.values(firstIntent.command.localOccurrenceIdsBySlot)).toEqual(
      firstAttemptIds.slice(1),
    );
    expect(allocated).toHaveLength(firstAttemptIds.length);

    const secondAttempt = slot.beginOpeningAttempt();
    expect(secondAttempt).not.toBe(firstAttempt);
    expect(allocated).toHaveLength(firstAttemptIds.length * 2);
    expect(secondAttempt.key).toContain(`bound-hub-opening-${firstAttemptIds.length + 1}`);
  });

  it('binds Hub closure and complete visit-order proposals to exact commands', () => {
    const project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      hub: createHubDecisionAddress(nBiome, 'hub'),
      hubSlotKeys: nVisitSlotKeys.slice(0, 5),
      kind: 'ReplaceHubVisitOrder',
    });
    const { interactions } = bind(project, 'Surface', 'N');
    const opened = [...interactions.hubSlots.values()].find(
      (candidate) => candidate.selected && candidate.close !== undefined,
    );
    if (opened?.selected !== true || opened.close === undefined) {
      throw new Error('closable Hub-slot interaction is missing');
    }
    const closeCandidate = opened.close.load().find((candidate) => !candidate.value);
    if (closeCandidate === undefined) throw new Error('Hub closure candidate is missing');
    expect(opened.close.intentFor(false)).toEqual({
      command: { kind: 'CloseHubSlot', slot: opened.owner },
    });

    const hub = createHubDecisionAddress(nBiome, 'hub');
    const visitOrder = interactions.hubVisitOrders.get(semanticAddressKey(hub));
    if (visitOrder === undefined) throw new Error('Hub visit-order interaction is missing');
    expect(interactions.hubVisitOrders).toHaveLength(1);
    const reordered = [
      visitOrder.selectedHubSlotKeys[0]!,
      visitOrder.selectedHubSlotKeys[2]!,
      visitOrder.selectedHubSlotKeys[1]!,
      ...visitOrder.selectedHubSlotKeys.slice(3),
    ];
    const replacement = visitOrder.proposalFor(reordered);

    expect(visitOrder.proposalFor(reordered)).toBe(replacement);
    expect(replacement.selected).toEqual(reordered);
    expect(replacement.intent()).toEqual({
      command: {
        hub,
        hubSlotKeys: reordered,
        kind: 'ReplaceHubVisitOrder',
      },
    });
    const shortened = visitOrder.proposalFor(visitOrder.selectedHubSlotKeys.slice(0, 3));
    expect(shortened.intent()).toEqual({
      command: {
        hub,
        hubSlotKeys: visitOrder.selectedHubSlotKeys.slice(0, 3),
        kind: 'ReplaceHubVisitOrder',
      },
    });
  });
});
