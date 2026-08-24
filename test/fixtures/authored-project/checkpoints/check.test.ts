import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';
import {
  applyProjectCommand,
  createRouteAddress,
  decodeProjectDocument,
  encodeProjectDocument,
} from '@run-planner/engine/authored-project';
import { catalog } from '@run-planner/hades2-catalog';
import { routeResourceAuthoring, simulateProject } from '@run-planner/engine/simulation';
import { checkpointManifest, checkpointSpellDropIntents } from './manifest';
import { checkpointRegistry, loadCheckpoint } from './registry';
import { nFixedOccurrenceIds, nOccurrenceIds } from '../routes/surface';

const checkpointDirectory = resolve(process.cwd(), 'test/fixtures/authored-project/checkpoints');

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function checkpointPath(id: string): string {
  return resolve(checkpointDirectory, `${id}.runplanner.json`);
}

function spellDropSelections(value: unknown, occurrenceId?: string): readonly [string, string][] {
  if (value === null || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  const owner = typeof record.occurrenceId === 'string' ? record.occurrenceId : occurrenceId;
  const reward = record.offer as Record<string, unknown> | undefined;
  const self = (record.traitOffersByAcquisitionRole as Record<string, unknown> | undefined)
    ?.self as Record<string, unknown> | undefined;
  const selected = self?.selectedOptionKey;
  const options = self?.options as readonly Record<string, unknown>[] | undefined;
  const result =
    reward?.rewardType === 'SpellDrop' &&
    owner !== undefined &&
    selected === 'option1' &&
    options?.[0]?.traitKey !== undefined
      ? ([[owner, String(options[0].traitKey)] as const] satisfies readonly [string, string][])
      : [];
  const children = Array.isArray(value) ? value : Object.values(record);
  return Object.freeze([
    ...result,
    ...children.flatMap((child) => spellDropSelections(child, owner)),
  ]);
}

describe('authored-project checkpoint integrity', () => {
  it('closes manifest, registry, and discovered typed JSON files exactly', () => {
    const manifestIds = checkpointManifest.map((entry) => entry.id).sort();
    const registryIds = checkpointRegistry.map(({ entry }) => entry.id).sort();
    const manifestFiles = checkpointManifest.map((entry) => entry.file).sort();
    const discoveredFiles = readdirSync(checkpointDirectory)
      .filter((file) => file.endsWith('.runplanner.json'))
      .sort();
    expect(registryIds).toEqual(manifestIds);
    expect(discoveredFiles).toEqual(manifestFiles);
    expect(new Set(manifestIds).size).toBe(manifestIds.length);
  });

  it('strictly decodes and attests canonical bytes, metadata, and route prefixes', () => {
    for (const { entry, load } of checkpointRegistry) {
      const document = load();
      expect(document).toBe(load());
      const raw = readFileSync(resolve(checkpointDirectory, entry.file), 'utf8');
      expect(encodeProjectDocument(document)).toBe(raw);
      expect(sha256(raw)).toBe(entry.sha256);
      expect(document.schemaVersion).toBe(entry.schemaVersion);
      expect(document.catalogVersion).toBe(entry.catalogVersion);
      const route = document.routes.find((candidate) => candidate.routeKey === entry.route);
      expect(route).toBeDefined();
      expect(route?.biomes.map((biome) => biome.biomeKey)).toEqual(entry.configuredBiomePrefix);
      expect(Object.isFrozen(document)).toBe(true);
      expect(decodeProjectDocument(JSON.parse(raw), catalog)).toBeDefined();
    }
  });

  it('closes every schema-50 SpellDrop migration against its explicit intent ledger', () => {
    const actual = checkpointManifest.flatMap((entry) =>
      spellDropSelections(JSON.parse(readFileSync(checkpointPath(entry.id), 'utf8'))).map(
        ([owner, selected]) => [entry.id, owner, selected] as const,
      ),
    );
    expect(actual.sort()).toEqual([...checkpointSpellDropIntents].sort());
  });

  it('keeps the fixed N alias and representative authored state addressable', () => {
    expect(nFixedOccurrenceIds).toBe(nOccurrenceIds);
    const n = loadCheckpoint('surface-n');
    const occurrenceIds = n.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes[0]?.topology?.occurrences.map((occurrence) => occurrence.occurrenceId);
    expect(occurrenceIds).toContain('surface-n-opening');
    expect(occurrenceIds).toContain('surface-n-prehub');
    expect(checkpointManifest.some((entry) => entry.id === 'surface-n-entry-frontier')).toBe(true);
    expect(
      checkpointManifest.some((entry) => entry.id === 'underworld-f-midshop-pom-frontier'),
    ).toBe(true);
    const chaos = loadCheckpoint('natural-chaos-unresolved-trial');
    const occurrences = chaos.routes[0]?.biomes[0]?.topology?.occurrences;
    const chaosRoom = occurrences?.find(
      (occurrence) => occurrence.occurrenceId === 'fixture-chaos-room',
    );
    expect(checkpointManifest).toHaveLength(25);
    expect(chaosRoom?.gameName).toMatch(/^Chaos_/);
    expect(chaosRoom?.state).toMatchObject({
      kind: 'fixed',
      reward: {
        offer: { rewardType: 'TrialUpgrade' },
        traitOffersByAcquisitionRole: { self: null },
      },
    });
    expect(loadCheckpoint('g-tail-chaos-timepiece-echo')).toBeDefined();
  });

  it('keeps the selected N resource-success checkpoint legal, including its side-room Spirit host', () => {
    const project = loadCheckpoint('surface-n-resources');
    const route = project.routes.find((candidate) => candidate.routeKey === 'Surface');
    if (route === undefined) throw new Error('Surface route is missing');
    const authoring = routeResourceAuthoring(catalog, route);
    expect(authoring.assessmentByFamily.Pickaxe).toEqual({ legal: true, reasons: [] });
    expect(authoring.assessmentByFamily.Exorcism).toEqual({ legal: true, reasons: [] });
    expect(authoring.assessmentByFamily.Shovel).toEqual({ legal: true, reasons: [] });
    expect(authoring.placements.Exorcism).toEqual({
      biomeKey: 'N',
      occurrenceId: 'surface-n-combat11-sideDoor1',
    });

    const evaluation = simulateProject(catalog, project);
    const n = evaluation.routes
      .find((candidate) => candidate.routeKey === 'Surface')
      ?.biomes.find((candidate) => candidate.biomeKey === 'N');
    if (n?.authoring !== 'complete' || n.validity !== 'valid')
      throw new Error('resource checkpoint did not evaluate as a valid complete N');
    const beforeOpeningExit = n.rewards.runStateSnapshots.find(
      (snapshot) =>
        snapshot.owner.kind === 'roomRunStateCheckpoint' &&
        snapshot.owner.occurrenceId === 'surface-n-opening' &&
        snapshot.owner.checkpoint.kind === 'beforeRoomExit',
    );
    const nextRoomEntry = n.rewards.runStateSnapshots.find(
      (snapshot) =>
        snapshot.owner.kind === 'roomRunStateCheckpoint' &&
        snapshot.owner.occurrenceId === 'surface-n-prehub' &&
        snapshot.owner.checkpoint.kind === 'roomEntered',
    );
    expect(beforeOpeningExit?.traits.elementCounts.Fire).toBe(0);
    expect(nextRoomEntry?.traits.elementCounts.Fire).toBe(1);
  });

  it('retains authored incomplete and invalid states while allowing focused deltas', () => {
    const entry = loadCheckpoint('surface-n-entry-frontier');
    const invalid = loadCheckpoint('surface-n-ten-open-invalid');
    const entryTopology = entry.routes.find((route) => route.routeKey === 'Surface')?.biomes[0]
      ?.topology;
    const invalidTopology = invalid.routes.find((route) => route.routeKey === 'Surface')?.biomes[0]
      ?.topology;
    expect(entryTopology?.occurrences).toHaveLength(2);
    const entryPreHub = entryTopology?.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.source.kind === 'occurrence' &&
        decision.source.occurrenceId === 'surface-n-prehub',
    );
    expect(entryPreHub?.kind).toBe('exit');
    expect(entryPreHub && 'normal' in entryPreHub ? entryPreHub.normal.targets : []).toHaveLength(
      0,
    );
    const invalidHub = invalidTopology?.decisions.find((decision) => decision.kind === 'hub');
    expect(invalidHub?.kind).toBe('hub');
    expect(invalidHub && 'openTargets' in invalidHub ? invalidHub.openTargets : []).toHaveLength(
      10,
    );
    expect(
      invalidTopology?.occurrences.some(
        (occurrence) => occurrence.occurrenceId === 'surface-n-combat04',
      ),
    ).toBe(true);
    expect(Object.isFrozen(invalid)).toBe(true);
    expect(invalid).toBe(loadCheckpoint('surface-n-ten-open-invalid'));
  });

  it('keeps a focused command delta off the cached checkpoint identity', () => {
    const base = loadCheckpoint('surface-n');
    const encodedBase = encodeProjectDocument(base);
    const changed = applyProjectCommand(base, catalog, {
      kind: 'ReplaceFearVowRank',
      route: createRouteAddress('Surface'),
      vowKey: 'EnemyDamageShrineUpgrade',
      rank: 1,
    });
    expect(changed).not.toBe(base);
    expect(encodeProjectDocument(base)).toBe(encodedBase);
    expect(loadCheckpoint('surface-n')).toBe(base);
  });

  it('rejects whitespace drift as a stale checkpoint', () => {
    const temporaryDirectory = mkdtempSync(join(checkpointDirectory, '.integrity-'));
    try {
      const id = checkpointManifest[0]!.id;
      const path = join(temporaryDirectory, `${id}.runplanner.json`);
      const canonical = readFileSync(checkpointPath(id), 'utf8');
      writeFileSync(path, `${canonical}\n`);
      expect(readFileSync(path, 'utf8')).not.toBe(encodeProjectDocument(loadCheckpoint(id)));
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
