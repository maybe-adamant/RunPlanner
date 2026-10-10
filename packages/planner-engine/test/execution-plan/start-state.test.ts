import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import type { ProjectDocument } from '@run-planner/engine/authored-project';
import { loadDreamMixedHandoffCheckpoint } from '@run-planner/test-fixtures/checkpoints/dream';
import { loadUnderworldFGHICheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { surfaceShrineDeliveriesProject } from '@run-planner/test-fixtures/surface';
import {
  simulateProject,
  simulateProjectAssembly,
  startInstallationAt,
} from '../../src/simulation';
import {
  assembleExecutionProduct,
  compileExecutionPlan,
  decodeExecutionPlan,
  encodeExecutionPlan,
  ExecutionPlanCodecError,
  type ExecutionPlan,
} from '../../src/execution-plan';
import { ExecutionCompilerError } from '../../src/execution-plan/assembler-errors';
import { withStartPoint } from './support/execution-fixtures';
import fghiWire from './fixtures/underworld-fghi.execution.json';
import qOpeningWire from './fixtures/surface-start-q-opening.execution.json';
import iPrebossWire from './fixtures/underworld-start-i-preboss.execution.json';
import dreamOpeningWire from './fixtures/dream-start-n-opening.execution.json';

function compile(project: ProjectDocument, internalRunModifiers?: boolean): ExecutionPlan {
  return compileExecutionPlan({
    product: assembleExecutionProduct({
      assembly: simulateProjectAssembly(catalog, project),
      catalog,
      ...(internalRunModifiers === undefined ? {} : { internalRunModifiers }),
    }),
  });
}

function failure(run: () => unknown): unknown {
  try {
    run();
  } catch (caught) {
    return caught;
  }
  throw new Error('expected a failure');
}

type Wire = Record<string, unknown> & { startState: Record<string, unknown> };
const clone = (wire: unknown): Wire => structuredClone(wire) as Wire;

describe('execution start state', () => {
  it('publishes an eligible start point, blocks an ineligible one, and is ignored in released builds', () => {
    const base = loadUnderworldFGHICheckpoint();
    const eligible = withStartPoint(base, { biomeKey: 'I', point: 'preboss' });
    const ineligible = withStartPoint(base, { biomeKey: 'N', point: 'preboss' });
    const published = compile(eligible, true);
    expect(published.startState).toMatchObject({
      point: 'preboss',
      biomeKey: 'I',
      occurrenceId: 'golden-i-preboss',
    });
    expect(published).not.toHaveProperty('runModifiers');
    expect(failure(() => compile(ineligible, true))).toBeInstanceOf(ExecutionCompilerError);
    expect(failure(() => compile(ineligible, true))).toMatchObject({
      code: 'startPointIneligible',
      startPointReason: { kind: 'notOnItinerary' },
    });
    const plan = decodeExecutionPlan(fghiWire);
    expect(published.planFingerprint).not.toBe(plan.planFingerprint);
    for (const project of [eligible, ineligible]) {
      const ignored = compile(project);
      expect(ignored).not.toHaveProperty('startState');
      expect(ignored.planFingerprint).toBe(plan.planFingerprint);
    }
  });

  it('translates the engine start installation for an Opening', () => {
    const project = withStartPoint(surfaceShrineDeliveriesProject(), {
      biomeKey: 'Q',
      point: 'opening',
      gold: 120,
    });
    const evaluation = simulateProject(catalog, project);
    const result = startInstallationAt(catalog, project, evaluation, {
      biomeKey: 'Q',
      kind: 'opening',
    });
    if (result.availability !== 'available') throw new Error('Q opening is unavailable');
    const { installation } = result;
    const plan = decodeExecutionPlan(qOpeningWire);
    const start = plan.startState!;
    expect(start).toMatchObject({
      point: 'opening',
      occurrenceId: 'surface-q-intro',
      roomName: installation.startRoomGameName,
      gold: 120,
      biomeVisitOrder: ['N', 'O', 'P'],
      encounterDepth: installation.counters.routeEncounterDepth,
      lastDevotionDepth: installation.counters.lastDevotionDepth,
    });
    // The native Intro resets the biome records itself.
    expect(start).not.toHaveProperty('biome');
    expect(plan.selectedOccurrenceIds.indexOf(start.occurrenceId)).toBeGreaterThan(0);
    expect(start.roomHistory).toEqual(
      installation.roomHistory.map(({ gameName, nextRoomSet }) =>
        nextRoomSet ? { name: gameName, nextRoomSet: true } : { name: gameName },
      ),
    );
    expect(start.hermesDeliveries).toEqual(
      installation.hermesDeliveries.map(({ rewardType, remainingUses }) => ({
        rewardType,
        remainingUses,
      })),
    );
    expect(start.hermesDeliveries).not.toHaveLength(0);
    // The Spell is published once, with its Hex.
    const spell = installation.hex.spellTraitKey;
    expect(spell).toBeDefined();
    expect(start.hex?.spellTraitName).toBe(spell);
    expect(start.traits.map((trait) => trait.name)).toEqual(
      installation.traits.map((trait) => trait.traitKey).filter((key) => key !== spell),
    );
    // The slotted Silver Wheel's equip re-creates its grant; pickups are hidden.
    expect(start.keepsake.traits).toEqual([
      { name: 'ManaOverTimeRefundKeepsake', rarity: 'Epic', slotted: true },
    ]);
    expect(start.maxStats).toEqual({
      maxHealth: installation.maxStats.maxHealth,
      maxMana: installation.maxStats.maxMana,
      hiddenGrants: installation.maxStats.grants,
    });
    expect(start.maxStats.hiddenGrants.map((grant) => grant.source.kind)).toEqual(['pickups']);
    // Collected essences become hidden essence traits; held traits carry their own elements.
    expect(installation.essences).toEqual({ Aether: 0, Earth: 1, Air: 0, Fire: 0, Water: 0 });
    expect(start.elementEssences).toEqual({ Fire: 0, Air: 0, Earth: 1, Water: 0 });
  });

  it('publishes the current biome state for a Preboss start', () => {
    const start = decodeExecutionPlan(iPrebossWire).startState!;
    expect(start).toMatchObject({
      point: 'preboss',
      roomName: 'I_PreBoss02',
      gold: 0,
      biomeVisitOrder: ['F', 'G', 'H', 'I'],
      biome: { clockwork: { remainingClockworkGoals: 0 } },
    });
  });

  it('publishes the Dream visited prefix for a Dream Opening', () => {
    const plan = decodeExecutionPlan(dreamOpeningWire);
    const biomeKeys: readonly string[] = plan.extent.biomeKeys;
    expect(plan.routeKey).toBe('Dream');
    expect(plan.startState).toMatchObject({
      point: 'opening',
      biomeKey: 'N',
      biomeVisitOrder: biomeKeys.slice(0, biomeKeys.indexOf('N')),
    });
  });

  it('prepends the native Dream_Intro prologue and counts it in run depth', () => {
    const project = withStartPoint(loadDreamMixedHandoffCheckpoint(), {
      biomeKey: 'N',
      point: 'opening',
    });
    const evaluation = simulateProject(catalog, project);
    const result = startInstallationAt(catalog, project, evaluation, {
      biomeKey: 'N',
      kind: 'opening',
    });
    if (result.availability !== 'available') throw new Error('N opening is unavailable');
    const { installation } = result;
    const start = compile(project, true).startState!;
    expect(start.roomHistory[0]).toEqual({ name: 'Dream_Intro', nextRoomSet: true });
    expect(start.roomHistory.slice(1).map((record) => record.name)).toEqual(
      installation.roomHistory.map((record) => record.gameName),
    );
    expect(start.lastDevotionDepth).toBe(
      installation.counters.lastDevotionDepth === undefined
        ? undefined
        : installation.counters.lastDevotionDepth + 1,
    );
    expect(start.encounterDepth).toBe(installation.counters.routeEncounterDepth);
  });

  it('round-trips and fingerprints the start state', () => {
    const plan = decodeExecutionPlan(iPrebossWire);
    expect(decodeExecutionPlan(JSON.parse(encodeExecutionPlan(plan)))).toEqual(plan);
    const tampered = clone(iPrebossWire);
    tampered.startState.gold = 1;
    expect(() => decodeExecutionPlan(tampered)).toThrow(/planFingerprint/);
    const stripped = clone(iPrebossWire);
    delete (stripped as Record<string, unknown>).startState;
    expect(() => decodeExecutionPlan(stripped)).toThrow(/planFingerprint/);
  });

  it.each<[string, (start: Record<string, unknown>) => void]>([
    ['an unknown field', (start) => (start.unknown = true)],
    ['a missing field', (start) => delete start.traits],
    ['an unsupported point', (start) => (start.point = 'hub')],
    ['fractional gold', (start) => (start.gold = 1.5)],
    [
      'a false flag',
      (start) => (start.roomHistory = [{ name: 'F_Opening01', nextRoomSet: false }]),
    ],
    ['an unknown trait field', (start) => (start.traits = [{ name: 'X', storedGold: 1 }])],
    ['a duplicate trait', (start) => (start.traits = [{ name: 'X' }, { name: 'X' }])],
    ['an unsupported rarity', (start) => (start.traits = [{ name: 'X', rarity: 'Mythic' }])],
    [
      'a re-derived max-stat source',
      (start) =>
        (start.maxStats = {
          maxHealth: 1,
          maxMana: 0,
          hiddenGrants: [{ source: { kind: 'aspect', key: 'X' }, maxHealth: 1, maxMana: 0 }],
        }),
    ],
    [
      'a keepsake trait without its rarity',
      (start) =>
        (start.keepsake = { keepsakeCache: [], blockedKeepsakes: [], traits: [{ name: 'X' }] }),
    ],
    [
      'two slotted keepsakes',
      (start) =>
        (start.keepsake = {
          keepsakeCache: [],
          blockedKeepsakes: [],
          traits: [
            { name: 'X', rarity: 'Epic', slotted: true },
            { name: 'Y', rarity: 'Epic', slotted: true },
          ],
        }),
    ],
    ['missing essence counts', (start) => delete start.elementEssences],
    [
      'an Aether essence',
      (start) => (start.elementEssences = { Fire: 0, Air: 0, Earth: 0, Water: 0, Aether: 1 }),
    ],
    [
      'a negative essence count',
      (start) => (start.elementEssences = { Fire: -1, Air: 0, Earth: 0, Water: 0 }),
    ],
    [
      'a fractional essence count',
      (start) => (start.elementEssences = { Fire: 0.5, Air: 0, Earth: 0, Water: 0 }),
    ],
  ])('rejects %s', (_, mutate) => {
    const wire = clone(iPrebossWire);
    mutate(wire.startState);
    expect(() => decodeExecutionPlan(wire)).toThrow(ExecutionPlanCodecError);
    expect(() => decodeExecutionPlan(wire)).toThrow(/startState/);
  });

  it.each<[string, Wire, (start: Record<string, unknown>, wire: Wire) => void, RegExp]>([
    [
      'an unselected occurrence',
      clone(iPrebossWire),
      (start) => (start.occurrenceId = 'missing'),
      /must be selected/,
    ],
    [
      'a contradicting room name',
      clone(iPrebossWire),
      (start) => (start.roomName = 'I_PreBoss01'),
      /occurrence identity/,
    ],
    [
      'an Opening that is not its biome’s first room',
      clone(qOpeningWire),
      (start, wire) => {
        const ids = wire.selectedOccurrenceIds as string[];
        const next = ids[ids.indexOf(start.occurrenceId as string) + 1]!;
        const occurrence = (wire.occurrences as { id: string; gameName: string }[]).find(
          (entry) => entry.id === next,
        )!;
        start.occurrenceId = next;
        start.roomName = occurrence.gameName;
      },
      /is not the Q opening/,
    ],
    [
      'a Preboss at the biome’s first room',
      clone(qOpeningWire),
      (start) => {
        start.point = 'preboss';
        start.biomeVisitOrder = ['N', 'O', 'P', 'Q'];
        start.biome = {
          biomeDepthCache: 1,
          biomeEncounterDepth: 1,
          biomeUseRecord: {},
          forfeitConsumed: false,
          dionysusSkipActivated: false,
        };
      },
      /is not the Q preboss/,
    ],
    [
      'a visit order beyond the start',
      clone(qOpeningWire),
      (start) => (start.biomeVisitOrder = ['N', 'O', 'P', 'Q']),
      /biomeVisitOrder/,
    ],
    [
      'an Opening carrying biome records',
      clone(qOpeningWire),
      (start) =>
        (start.biome = {
          biomeDepthCache: 1,
          biomeEncounterDepth: 1,
          biomeUseRecord: {},
          forfeitConsumed: false,
          dionysusSkipActivated: false,
        }),
      /exactly for a Preboss/,
    ],
    [
      'an I Preboss without Clockwork counters',
      clone(iPrebossWire),
      (start) => delete (start.biome as Record<string, unknown>).clockwork,
      /clockwork is present exactly for an I Preboss/,
    ],
  ])('rejects %s in graph validation', (_, wire, mutate, message) => {
    mutate(wire.startState, wire);
    expect(() => decodeExecutionPlan(wire)).toThrow(ExecutionPlanCodecError);
    expect(() => decodeExecutionPlan(wire)).toThrow(message);
  });
});
