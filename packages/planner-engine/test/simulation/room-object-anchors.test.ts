import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  type ProjectCommand,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  roomObjectAnchorSlotsForProjectEvaluationAssembly,
  simulateProjectAssembly,
  type RoomAnchorSlots,
} from '@run-planner/engine/simulation';
import { loadSurfaceNOPQCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import { loadUnderworldFGHICheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';

let cachedUnderworld: ProjectDocument | undefined;
const underworld = () => (cachedUnderworld ??= loadUnderworldFGHICheckpoint());
let cachedSurface: ProjectDocument | undefined;
const surface = () => (cachedSurface ??= loadSurfaceNOPQCheckpoint());

function address(project: ProjectDocument, biomeKey: string, occurrenceId: string) {
  return createOccurrenceAddress(
    createBiomeAddress(project.route.routeKey, biomeKey),
    createOccurrenceId(occurrenceId),
  );
}

function slotsOf(
  project: ProjectDocument,
  biomeKey: string,
  occurrenceId: string,
): RoomAnchorSlots {
  const slots = roomObjectAnchorSlotsForProjectEvaluationAssembly(
    catalog,
    simulateProjectAssembly(catalog, project),
    address(project, biomeKey, occurrenceId),
  );
  if (slots === undefined) throw new Error(`${occurrenceId} has no anchor slots`);
  return slots;
}

function apply(project: ProjectDocument, commands: readonly ProjectCommand[]): ProjectDocument {
  return commands.reduce((next, command) => applyProjectCommand(next, catalog, command), project);
}

/** Each slot's occupant and its choices as kind@landing slot. */
function layout(slots: RoomAnchorSlots) {
  return slots.slots.map((slot) => ({
    occupant: slot.occupant ?? null,
    fixed: slot.fixed,
    choices: slot.choices.map((choice) =>
      choice.kind === null ? null : `${choice.kind}@${String(choice.slotIndex)}`,
    ),
  }));
}

function object(slots: RoomAnchorSlots, kind: string) {
  const found = slots.objects.find((candidate) => candidate.kind === kind);
  if (found === undefined) throw new Error(`no ${kind}`);
  return found;
}

function placementFindings(project: ProjectDocument, occurrenceId: string) {
  return simulateProjectAssembly(catalog, project)
    .evaluation.findings.filter(
      (finding) =>
        finding.code.endsWith('PlacementUnavailable') &&
        'occurrenceId' in finding.origin &&
        finding.origin.occurrenceId === occurrenceId,
    )
    .map((finding) => finding.code);
}

describe('room object anchor slots', () => {
  it('fills a one-anchor room with the Well or the switch, and replaces one with the other', () => {
    const project = underworld();
    const empty = slotsOf(project, 'H', 'golden-h-combat05');
    expect(empty.anchorCount).toBe(1);
    expect(empty.objects.map((candidate) => candidate.kind)).toEqual([
      'stygianWell',
      'challengeSwitch',
    ]);
    expect(layout(empty)).toEqual([
      {
        occupant: null,
        fixed: false,
        choices: [null, 'stygianWell@0', 'challengeSwitch@0'],
      },
    ]);
    const switchChoice = empty.slots[0]!.choices.find(
      (choice) => choice.kind === 'challengeSwitch',
    )!;
    expect(switchChoice.commands).toEqual([
      {
        kind: 'ReplaceChallengeSwitch',
        occurrence: address(project, 'H', 'golden-h-combat05'),
        variantKey: 'TimeChallengeSwitch_Money',
      },
    ]);

    const withWell = apply(
      project,
      empty.slots[0]!.choices.find((choice) => choice.kind === 'stygianWell')!.commands,
    );
    const full = slotsOf(withWell, 'H', 'golden-h-combat05');
    expect(object(full, 'stygianWell')).toMatchObject({ present: true, slotIndex: 0 });
    // The switch's own rules hold; only the anchor the Well took refuses it.
    expect(object(full, 'challengeSwitch').refusals).toEqual([
      { reason: 'noFreeAnchor', anchorCount: 1, occupants: ['stygianWell'] },
    ]);
    expect(object(full, 'challengeSwitch').place).toBeUndefined();
    expect(object(full, 'challengeSwitch')).toMatchObject({
      kinds: [
        { switchKind: 'time', observe: { variantKey: 'TimeChallengeSwitch_Money' } },
        { switchKind: 'perfectClear', observe: { variantKey: 'PerfectClearChallengeSwitch_Pom' } },
        { switchKind: 'elite', lock: { reason: 'kindUnavailable' } },
      ],
    });
    expect(layout(full)).toEqual([
      {
        occupant: 'stygianWell',
        fixed: false,
        choices: ['stygianWell@0', null, 'challengeSwitch@0'],
      },
    ]);

    const replaced = apply(
      withWell,
      full.slots[0]!.choices.find((choice) => choice.kind === 'challengeSwitch')!.commands,
    );
    const after = slotsOf(replaced, 'H', 'golden-h-combat05');
    expect(object(after, 'stygianWell').present).toBe(false);
    expect(object(after, 'challengeSwitch')).toMatchObject({ present: true, slotIndex: 0 });
    expect(placementFindings(replaced, 'golden-h-combat05')).toEqual([]);
  });

  it('leaves a preserved switch past the anchors unanchored, with its finding', () => {
    const project = underworld();
    const owner = address(project, 'H', 'golden-h-combat05');
    const both = apply(project, [
      {
        kind: 'ReplaceChallengeSwitch',
        occurrence: owner,
        variantKey: 'TimeChallengeSwitch_Money',
      },
      { kind: 'AddStygianWell', occurrence: owner },
    ]);
    const slots = slotsOf(both, 'H', 'golden-h-combat05');
    expect(slots.unanchored).toEqual(['challengeSwitch']);
    expect(object(slots, 'challengeSwitch').slotIndex).toBeUndefined();
    expect(object(slots, 'challengeSwitch').remove).toMatchObject({ variantKey: null });
    expect(placementFindings(both, 'golden-h-combat05')).toEqual([
      'challengeSwitchPlacementUnavailable',
    ]);
  });

  it('holds a Well and a switch on two F and G anchors in native order', () => {
    for (const [biomeKey, occurrenceId] of [
      ['F', 'golden-f-b5-e1'],
      ['G', 'golden-g-b4-e1'],
    ] as const) {
      const project = underworld();
      const empty = slotsOf(project, biomeKey, occurrenceId);
      expect(empty.anchorCount).toBe(2);
      const withSwitch = apply(
        project,
        empty.slots[0]!.choices.find((choice) => choice.kind === 'challengeSwitch')!.commands,
      );
      const one = slotsOf(withSwitch, biomeKey, occurrenceId);
      // The Well spawns first, so adding it in the free slot moves the switch to the second.
      expect(layout(one)).toEqual([
        {
          occupant: 'challengeSwitch',
          fixed: false,
          choices: ['challengeSwitch@0', null, 'stygianWell@0'],
        },
        { occupant: null, fixed: false, choices: [null, 'stygianWell@0'] },
      ]);
      const both = apply(
        withSwitch,
        one.slots[1]!.choices.find((choice) => choice.kind === 'stygianWell')!.commands,
      );
      const two = slotsOf(both, biomeKey, occurrenceId);
      expect(layout(two)).toEqual([
        { occupant: 'stygianWell', fixed: false, choices: ['stygianWell@0', null] },
        { occupant: 'challengeSwitch', fixed: false, choices: ['challengeSwitch@1', null] },
      ]);
      expect(two.unanchored).toEqual([]);
      expect(placementFindings(both, occurrenceId)).toEqual([]);
    }
  });

  it('holds a Shrine and a switch on two O and P anchors', () => {
    for (const [biomeKey, occurrenceId] of [
      ['O', 'surface-o-combat02'],
      ['P', 'surface-p-8-1-p_combat12'],
    ] as const) {
      const project = surface();
      const empty = slotsOf(project, biomeKey, occurrenceId);
      expect(empty.objects.map((candidate) => candidate.kind)).toEqual([
        'hermesShrine',
        'challengeSwitch',
      ]);
      expect(layout(empty)[0]?.choices).toEqual([null, 'hermesShrine@0', 'challengeSwitch@0']);
      const both = apply(project, [
        empty.slots[0]!.choices.find((choice) => choice.kind === 'challengeSwitch')!.commands[0]!,
        object(empty, 'hermesShrine').place!,
      ]);
      const two = slotsOf(both, biomeKey, occurrenceId);
      expect(two.slots.map((slot) => slot.occupant)).toEqual(['hermesShrine', 'challengeSwitch']);
      expect(object(two, 'hermesShrine').remove).toMatchObject({
        kind: 'SetHermesShrinePresence',
        present: false,
      });
      expect(placementFindings(both, occurrenceId)).toEqual([]);
    }
  });

  it('counts a Q map’s two anchors before its switch is reachable', () => {
    const slots = slotsOf(surface(), 'Q', 'surface-q-foyer');
    expect(slots.anchorCount).toBe(2);
    expect(object(slots, 'challengeSwitch').refusals).toEqual([
      expect.objectContaining({ reason: 'biomeDepth' }),
    ]);
  });

  it('offers three I anchors, each empty while the Well and switch are too early', () => {
    const slots = slotsOf(underworld(), 'I', 'golden-i-combat01');
    expect(slots.anchorCount).toBe(3);
    expect(object(slots, 'stygianWell').refusals).toContainEqual(
      expect.objectContaining({ reason: 'biomeDepth', minimumBiomeDepth: 3 }),
    );
    expect(object(slots, 'challengeSwitch').refusals).toEqual([
      expect.objectContaining({ reason: 'biomeDepth', minimumBiomeDepth: 5 }),
    ]);
    expect(layout(slots)).toEqual(
      Array.from({ length: 3 }, () => ({ occupant: null, fixed: false, choices: [null] })),
    );
  });

  it('fixes the forced Well and the Pool on the F, G and H Postboss anchors', () => {
    for (const [biomeKey, occurrenceId] of [
      ['F', 'golden-f-preboss-shop:postboss'],
      ['G', 'golden-g-preboss-shop:postboss'],
      ['H', 'golden-h-preboss-shop:postboss'],
    ] as const) {
      const slots = slotsOf(underworld(), biomeKey, occurrenceId);
      expect(slots.objects.map((candidate) => [candidate.kind, candidate.fixed])).toEqual([
        ['stygianWell', true],
        ['purgingPool', true],
      ]);
      expect(slots.objects.every((candidate) => candidate.remove === undefined)).toBe(true);
      expect(layout(slots)).toEqual([
        { occupant: 'stygianWell', fixed: true, choices: ['stygianWell@0'] },
        { occupant: 'purgingPool', fixed: true, choices: ['purgingPool@1'] },
      ]);
    }
  });

  it('fixes the forced Shrine on the N, O and P Postboss anchor', () => {
    for (const [biomeKey, occurrenceId] of [
      ['N', 'surface-n-preboss:postboss'],
      ['O', 'surface-o-preboss:postboss'],
      ['P', 'surface-p-preboss-shop:postboss'],
    ] as const)
      expect(layout(slotsOf(surface(), biomeKey, occurrenceId))).toEqual([
        { occupant: 'hermesShrine', fixed: true, choices: ['hermesShrine@0'] },
      ]);
  });

  it('gives a room with no anchor no slot, and refuses its Shrine for want of one', () => {
    const slots = slotsOf(surface(), 'O', 'surface-o-combat01');
    expect(slots.anchorCount).toBe(0);
    expect(slots.slots).toEqual([]);
    expect(object(slots, 'hermesShrine').refusals).toEqual([
      { reason: 'noFreeAnchor', anchorCount: 0, occupants: [] },
    ]);
    expect(object(slots, 'hermesShrine').place).toBeUndefined();
  });
});
