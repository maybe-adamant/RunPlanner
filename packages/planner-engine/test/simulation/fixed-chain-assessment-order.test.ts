import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createOccurrenceId,
  decodeProjectDocument,
  encodeProjectDocument,
  semanticAddressKey,
  type BatchRewardStoreAddress,
  type ProjectDocument,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import { simulateProject, simulateProjectAssembly } from '@run-planner/engine/simulation';
import { createGoldenFGHIProject } from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNOProject, loadSurfaceNOPQProject } from '@run-planner/test-fixtures/surface';

/**
 * A fixed chain runs source room -> boss -> postboss, and the door's reward
 * store is decided as the source room is left. Every required input inside that
 * chain must therefore participate in the agenda at its true position, so the
 * earliest one owns the assessment issue whatever the later inputs are.
 */

interface WireOccurrence {
  readonly occurrenceId: string;
  hermesShrine?: { offerBySlot: Record<string, unknown> };
}

interface WireLink {
  readonly sourceOccurrenceId: string;
  readonly targetOccurrenceId: string;
  rewardStoreKey?: string;
}

interface WireDocument {
  readonly route: {
    readonly biomes: readonly {
      readonly biomeKey: string;
      readonly topology: {
        readonly fixedRoomLinks: readonly WireLink[];
        readonly occurrences: readonly WireOccurrence[];
      } | null;
    }[];
  };
}

/**
 * Rewrites the saved document rather than issuing commands: an unauthored
 * boss-door store and an unauthored forced Shrine are both states a real save
 * reaches, and neither has a command that clears it.
 */
function rewritten(
  document: ProjectDocument,
  biomeKey: string,
  edit: (topology: NonNullable<WireDocument['route']['biomes'][number]['topology']>) => void,
): ProjectDocument {
  const wire = JSON.parse(encodeProjectDocument(document)) as WireDocument;
  const topology = wire.route.biomes.find((biome) => biome.biomeKey === biomeKey)?.topology;
  if (topology === null || topology === undefined) {
    throw new Error(`${biomeKey} carries no topology to rewrite`);
  }
  edit(topology);
  return decodeProjectDocument(JSON.parse(JSON.stringify(wire)) as never, catalog);
}

function withoutBossDoorStore(document: ProjectDocument, biomeKey: string): ProjectDocument {
  return rewritten(document, biomeKey, (topology) => {
    const stripped = topology.fixedRoomLinks.filter((link) => link.rewardStoreKey !== undefined);
    if (stripped.length !== 1) throw new Error(`${biomeKey} no longer carries one boss-door store`);
    for (const link of stripped) delete link.rewardStoreKey;
  });
}

function withoutPostbossShrineOffers(document: ProjectDocument, biomeKey: string): ProjectDocument {
  return rewritten(document, biomeKey, (topology) => {
    let cleared = 0;
    for (const occurrence of topology.occurrences) {
      if (occurrence.hermesShrine === undefined) continue;
      for (const slot of Object.keys(occurrence.hermesShrine.offerBySlot)) {
        occurrence.hermesShrine.offerBySlot[slot] = null;
        cleared += 1;
      }
    }
    if (cleared === 0) throw new Error(`${biomeKey} no longer carries a Shrine to clear`);
  });
}

function bossDoorStore(
  routeKey: string,
  biomeKey: string,
  sourceOccurrenceId: string,
): BatchRewardStoreAddress {
  return createBatchRewardStoreAddress(createBiomeAddress(routeKey, biomeKey), {
    kind: 'occurrence',
    occurrenceId: createOccurrenceId(sourceOccurrenceId),
  });
}

function biomeAgenda(document: ProjectDocument, biomeKey: string) {
  const biome = simulateProjectAssembly(catalog, document).evaluation.route.biomes.find(
    (candidate) => candidate.biomeKey === biomeKey,
  );
  if (biome === undefined) throw new Error(`${biomeKey} lost its evaluation`);
  if (biome.requiredInput === undefined) {
    throw new Error(`${biomeKey} was expected to stop at a required input`);
  }
  return {
    frontier: 'frontier' in biome ? biome.frontier : undefined,
    requiredInput: biome.requiredInput,
    issueOwner: biome.issue?.owner,
    issueReasonCodes: biome.issue?.reasons.map((reason) => reason.code) ?? [],
    findings: biome.findings,
  };
}

/** The rooms the chain reached, in entry order, from the assessed ledger. */
function assessedRooms(document: ProjectDocument, biomeKey: string): readonly string[] {
  const biome = simulateProjectAssembly(catalog, document).evaluation.route.biomes.find(
    (candidate) => candidate.biomeKey === biomeKey,
  );
  if (biome === undefined || !('history' in biome)) {
    throw new Error(`${biomeKey} composed no history`);
  }
  return biome.history.ledgers.enteredRewardStores
    .filter((entry) => entry.gameName.startsWith(`${biomeKey}_`))
    .map((entry) => entry.gameName);
}

describe('fixed-chain assessment order', () => {
  for (const [routeKey, biomeKey, sourceOccurrenceId] of [
    ['Surface', 'O', 'surface-o-preboss'],
    ['Surface', 'P', 'surface-p-preboss-shop'],
  ] as const) {
    it(`names the ${biomeKey} boss-door store ahead of its own postboss input`, () => {
      const base = biomeKey === 'O' ? loadSurfaceNOProject() : loadSurfaceNOPQProject();
      const document = withoutPostbossShrineOffers(withoutBossDoorStore(base, biomeKey), biomeKey);
      const agenda = biomeAgenda(document, biomeKey);
      const owner = bossDoorStore(routeKey, biomeKey, sourceOccurrenceId);

      // The door is left before the boss is entered, so it owns the agenda even
      // though the postboss Shrine is equally unauthored.
      expect(agenda.frontier).toEqual(owner);
      expect(agenda.requiredInput).toEqual(owner);
      expect(agenda.issueOwner).toEqual(owner);
      expect(agenda.issueReasonCodes).toEqual(['batchRewardStoreMissing']);

      // The structural and chronological passes both own this required input;
      // the published findings carry one copy of it.
      const published = (findings: readonly { code: string; origin: SemanticAddress }[]) =>
        findings.filter(
          (finding) =>
            finding.code === 'batchRewardStoreMissing' &&
            semanticAddressKey(finding.origin) === semanticAddressKey(owner),
        );
      expect(published(agenda.findings)).toHaveLength(1);
      expect(published(simulateProject(catalog, document).findings)).toHaveLength(1);
    });
  }

  it('leaves a later postboss input owning the agenda when the door is authored', () => {
    const agenda = biomeAgenda(withoutPostbossShrineOffers(loadSurfaceNOProject(), 'O'), 'O');
    expect(agenda.requiredInput).toMatchObject({
      kind: 'roomFeature',
      occurrenceId: 'surface-o-preboss:postboss',
    });
    // The Shrine's three slots are one atomic region, so all three are reasons.
    expect(new Set(agenda.issueReasonCodes)).toEqual(new Set(['hermesShrineInventoryMissing']));
  });

  it('names the door when it is the only unauthored input in the chain', () => {
    const agenda = biomeAgenda(withoutBossDoorStore(loadSurfaceNOProject(), 'O'), 'O');
    expect(agenda.requiredInput).toEqual(bossDoorStore('Surface', 'O', 'surface-o-preboss'));
    expect(agenda.issueReasonCodes).toEqual(['batchRewardStoreMissing']);
  });

  it('stops the chain at a store the controller forbids and resumes it on repair', () => {
    // P's door is saturated at its source room's exit (17 entered / 2 meta), so
    // RunProgress is out of support there and the door is never taken.
    const owner = bossDoorStore('Surface', 'P', 'surface-p-preboss-shop');
    const forbidden = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceBossDoorRewardStore',
      rewardStore: owner,
      storeKey: 'RunProgress',
    });

    const blocked = simulateProjectAssembly(catalog, forbidden).evaluation.route.biomes.find(
      (candidate) => candidate.biomeKey === 'P',
    );
    if (blocked === undefined || blocked.coverage.kind !== 'prefix') {
      throw new Error('P lost its prefix coverage');
    }
    expect(blocked.coverage.blockedAt).toEqual(owner);
    expect(blocked.issue?.owner).toEqual(owner);
    expect(blocked.issue?.reasons.map((reason) => reason.code)).toEqual([
      'baseRewardStoreUnavailable',
    ]);

    // The source room stays reached; the boss and postboss behind the door do
    // not, so their entries and the findings they would raise are withheld.
    const stopped = assessedRooms(forbidden, 'P');
    expect(stopped).toContain('P_PreBoss01');
    expect(stopped).not.toContain('P_Boss01');
    expect(blocked.findings.map((finding) => finding.code)).toEqual(['baseRewardStoreUnavailable']);

    // The one command that owns the store returns the whole suffix.
    const repaired = applyProjectCommand(forbidden, catalog, {
      kind: 'ReplaceBossDoorRewardStore',
      rewardStore: owner,
      storeKey: 'MetaProgress',
    });
    expect(assessedRooms(repaired, 'P')).toEqual(assessedRooms(loadSurfaceNOPQProject(), 'P'));
    expect(simulateProject(catalog, repaired).findings).toEqual([]);
  });

  for (const [project, routeKey, biomeKey, sourceOccurrenceId] of [
    [createGoldenFGHIProject, 'Underworld', 'G', 'golden-g-preboss-shop'],
    [loadSurfaceNOPQProject, 'Surface', 'Q', 'surface-q-preboss'],
  ] as const) {
    it(`names the ${biomeKey} boss-door store where the chain has no later input`, () => {
      const agenda = biomeAgenda(withoutBossDoorStore(project(), biomeKey), biomeKey);
      const owner = bossDoorStore(routeKey, biomeKey, sourceOccurrenceId);
      expect(agenda.requiredInput).toEqual(owner);
      expect(agenda.issueOwner).toEqual(owner);
      expect(agenda.issueReasonCodes).toEqual(['batchRewardStoreMissing']);
      expect(
        agenda.findings.filter((finding) => finding.code === 'batchRewardStoreMissing'),
      ).toHaveLength(1);
    });
  }
});
