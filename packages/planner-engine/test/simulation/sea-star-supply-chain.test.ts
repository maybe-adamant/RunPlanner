import { beforeAll, describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createAcquisitionSiteAddress,
  createBiomeAddress,
  createIncomingRewardAddress,
  createLevelResolutionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createTraitOfferAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  parseClockedTraitGeneratedPickupEntryKey,
  SEA_STAR_DUPLICATE_ENTRY_KEY,
  seaStarDuplicateAcquisitionSite,
  semanticAddressKey,
  type AcquisitionEntryAddress,
  type OccurrenceAddress,
  type ProjectDocument,
  type TraitOfferAddress,
} from '../../src/authored-project';
import {
  createPreparedProjectCandidateSession,
  levelResolutionCandidateForProjectEvaluationAssembly,
  simulateProject,
  simulateProjectAssembly,
} from '../../src/simulation';
import { assembleExecutionProduct } from '../../src/execution-plan';
import { surfaceScheduledLifecycleWithQSupplyChainSlicesProject } from '@run-planner/test-fixtures/scheduled-lifecycle';

const nBiome = createBiomeAddress('Surface', 'N');
const oBiome = createBiomeAddress('Surface', 'O');

function qSlice(project: ProjectDocument, pickupKey: string) {
  for (const biome of project.route.biomes) {
    if (biome.biomeKey !== 'Q') continue;
    for (const occurrence of biome.topology?.occurrences ?? []) {
      for (const [entryKey, entry] of Object.entries(
        occurrence.acquisitionSites?.roomExit?.pickupEntries ?? {},
      )) {
        if (parseClockedTraitGeneratedPickupEntryKey(entryKey)?.pickupKey !== pickupKey) continue;
        const occurrenceAddress: OccurrenceAddress = createOccurrenceAddress(
          createBiomeAddress(project.route.routeKey, 'Q'),
          occurrence.occurrenceId,
        );
        const address: AcquisitionEntryAddress = createAcquisitionEntryAddress(
          createAcquisitionSiteAddress(occurrenceAddress, 'roomExit'),
          entryKey,
        );
        return { occurrenceAddress, address, entry: entry! };
      }
    }
  }
  throw new Error(`missing Q Supply Chain ${pickupKey}`);
}

function replaceWithStartingOutcome(
  project: ProjectDocument,
  trait: TraitOfferAddress,
  giverKey: string,
  selectedOptionKey?: 'option1' | 'option2' | 'option3',
): ProjectDocument {
  const draft = createPreparedProjectCandidateSession(
    catalog,
    simulateProjectAssembly(catalog, project),
  ).traitOfferStartingOutcome(trait, giverKey);
  if (draft === undefined) throw new Error(`no ${giverKey} outcome for ${trait.acquisitionRole}`);
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait,
    value:
      selectedOptionKey === undefined || draft.kind !== 'traits'
        ? draft
        : { ...draft, selectedOptionKey },
  });
}

/** Reauthors each first reached repair from its engine candidate until the route is valid. */
function repairReached(project: ProjectDocument): ProjectDocument {
  let current = project;
  for (let pass = 0; pass < 32; pass += 1) {
    const assembly = simulateProjectAssembly(catalog, current);
    const finding = assembly.evaluation.findings[0];
    if (finding === undefined) return current;
    const origin = finding.origin;
    if (origin.kind === 'traitOffer') {
      // Only the giver bound to the address accepts its outcome.
      const repaired = catalog.traitGivers.values.flatMap((giver) => {
        try {
          return [replaceWithStartingOutcome(current, origin, giver.key)];
        } catch {
          return [];
        }
      })[0];
      if (repaired === undefined) break;
      current = repaired;
    } else if (origin.kind === 'levelResolution') {
      const keys =
        levelResolutionCandidateForProjectEvaluationAssembly(assembly, origin)?.branches[0]
          ?.eligibleTargetTraitKeys ?? [];
      if (keys[0] === undefined) break;
      try {
        current = applyProjectCommand(current, catalog, {
          kind: 'ReplaceLevelResolution',
          levelResolution: origin,
          value: { kind: 'random', targetTraitKey: keys[0] },
        });
      } catch {
        current = applyProjectCommand(current, catalog, {
          kind: 'ReplaceLevelResolution',
          levelResolution: origin,
          value: { kind: 'choice', offeredTraitKeys: keys.slice(0, 3), selectedTraitKey: keys[0] },
        });
      }
    } else if (origin.kind === 'steadyGrowthOutcome') {
      const evidence = finding.evidence as { readonly eligibleTargetKeys?: readonly string[] };
      const targetTraitKey = evidence.eligibleTargetKeys?.[0];
      if (targetTraitKey === undefined) break;
      current = applyProjectCommand(current, catalog, {
        kind: 'ReplaceSteadyGrowthTarget',
        outcome: origin,
        targetTraitKey,
      });
    } else break;
  }
  throw new Error(
    `Sea Star route did not settle: ${JSON.stringify(
      simulateProjectAssembly(catalog, current).evaluation.findings.map((finding) => [
        finding.code,
        finding.evidence,
      ]),
    )}`,
  );
}

/**
 * The Q Supply Chain route with Poseidon replacing Hephaestus, so the O Trial's
 * spurned Poseidon hands over Sea Star before any Slice matures.
 */
function seaStarSupplyChainProject(): ProjectDocument {
  let project = surfaceScheduledLifecycleWithQSupplyChainSlicesProject();
  const miniBoss = createIncomingRewardAddress(nBiome, createOccurrenceId('surface-n-miniBoss01'));
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: miniBoss,
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' } },
  });
  project = replaceWithStartingOutcome(
    project,
    createTraitOfferAddress(miniBoss, 'source'),
    'Poseidon',
    // Sprint leaves the Apollo weapon boon that the Slices target in place.
    'option3',
  );
  const devotion = createIncomingRewardAddress(oBiome, createOccurrenceId('surface-o-devotion'));
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: devotion,
    value: {
      rewardType: 'Devotion',
      payload: {
        kind: 'DevotionPair',
        chosenSource: 'AresUpgrade',
        spurnedSource: 'PoseidonUpgrade',
      },
    },
  });
  project = repairReached(project);
  const spurned = createTraitOfferAddress(devotion, 'spurnedSource');
  const draft = createPreparedProjectCandidateSession(
    catalog,
    simulateProjectAssembly(catalog, project),
  ).traitOfferStartingOutcome(spurned, 'Poseidon');
  if (draft?.kind !== 'traits') throw new Error('missing spurned Poseidon offer');
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: spurned,
    value: {
      ...draft,
      options: [
        { ...draft.options[0], traitKey: 'DoubleRewardBoon' },
        draft.options[1]!,
        draft.options[2]!,
      ],
      selectedOptionKey: 'option1',
    },
  });
  return repairReached(project);
}

/** The target's level when the Slices' host room is left. */
function levelAtHostExit(project: ProjectDocument, host: OccurrenceAddress, traitKey: string) {
  const snapshot = simulateProject(catalog, project)
    .route.biomes.flatMap((biome) =>
      'rewards' in biome ? (biome.rewards?.runStateSnapshots ?? []) : [],
    )
    .find(
      (candidate) =>
        candidate.checkpoint === 'beforeRoomExit' &&
        semanticAddressKey(candidate.owner).includes(`"${host.occurrenceId}","beforeRoomExit"`),
    );
  if (snapshot === undefined) throw new Error(`no pre-exit snapshot at ${host.occurrenceId}`);
  return snapshot.traits.equippedTraits[traitKey]?.level;
}

describe('Sea Star on a Supply Chain Pom Slice', () => {
  let seaStarProject: ProjectDocument;
  beforeAll(() => {
    seaStarProject = seaStarSupplyChainProject();
  });

  function duplicate(project: ProjectDocument) {
    const slice = qSlice(project, 'pom1');
    const source = createAcquisitionRoleAddress(slice.address, 'self');
    const duplicated = applyProjectCommand(project, catalog, {
      kind: 'ReplaceSeaStarResult',
      acquisition: source,
      procced: true,
    });
    const entry = createAcquisitionEntryAddress(
      seaStarDuplicateAcquisitionSite(slice.occurrenceAddress, source),
      SEA_STAR_DUPLICATE_ENTRY_KEY,
    );
    return { slice, source, duplicated, entry, host: slice.occurrenceAddress };
  }

  it('authors the retained Slice with its own unresolved random target', () => {
    const { duplicated, entry, host } = duplicate(seaStarProject);
    const occurrence = duplicated.route.biomes
      .find((biome) => biome.biomeKey === 'Q')!
      .topology!.occurrences.find((candidate) => candidate.occurrenceId === host.occurrenceId)!;
    expect(
      occurrence.acquisitionSites?.[entry.site.pointKey]?.pickupEntries?.[
        SEA_STAR_DUPLICATE_ENTRY_KEY
      ],
    ).toEqual({
      offer: { rewardType: 'StoreRewardRandomStack' },
      traitOffersByAcquisitionRole: {},
      levelResolutionsByAcquisitionRole: { self: { kind: 'random', targetTraitKey: null } },
      dispositionByAcquisitionRole: { self: { kind: 'normal' } },
    });
    const assembly = simulateProjectAssembly(catalog, duplicated);
    expect(
      assembly.evaluation.findings.map((finding) => semanticAddressKey(finding.origin)),
    ).toEqual([semanticAddressKey(createLevelResolutionAddress(entry, 'self'))]);
    expect(
      levelResolutionCandidateForProjectEvaluationAssembly(
        assembly,
        createLevelResolutionAddress(entry, 'self'),
      )?.branches[0]?.eligibleTargetTraitKeys.length,
    ).toBeGreaterThan(0);
  });

  it("settles the second use's stack exactly like the Slice's first", () => {
    const { slice, duplicated, entry } = duplicate(seaStarProject);
    const target = slice.entry.levelResolutionsByAcquisitionRole?.self;
    if (target?.kind !== 'random' || target.targetTraitKey === null)
      throw new Error('fixture Slice lacks its target');
    const resolved = applyProjectCommand(duplicated, catalog, {
      kind: 'ReplaceLevelResolution',
      levelResolution: createLevelResolutionAddress(entry, 'self'),
      value: { kind: 'random', targetTraitKey: target.targetTraitKey },
    });
    const assembly = simulateProjectAssembly(catalog, resolved);
    expect(assembly.evaluation.findings).toEqual([]);
    expect(levelAtHostExit(resolved, slice.occurrenceAddress, target.targetTraitKey)).toBe(
      levelAtHostExit(seaStarProject, slice.occurrenceAddress, target.targetTraitKey)! + 1,
    );

    const roundTripped = decodeProjectDocument(
      JSON.parse(encodeProjectDocument(resolved)),
      catalog,
    );
    expect(roundTripped).toEqual(resolved);

    // The duplicate publishes its own level steering beside its Sea Star producer.
    const product = assembleExecutionProduct({ assembly, catalog });
    const roles = product.occurrences
      .flatMap((occurrence) => occurrence.timeline.transactions)
      .flatMap((transaction) =>
        transaction.kind === 'acquisition' ? transaction.roles : Object.freeze([]),
      );
    const duplicateRole = roles.find((role) => role.producer?.kind === 'seaStarDuplicate');
    expect(duplicateRole).toMatchObject({
      gameName: 'StoreRewardRandomStack',
      levelResolution: { selectedTarget: target.targetTraitKey, levelCount: 1 },
    });
    expect(duplicateRole).not.toHaveProperty('seaStarResult');
    expect(roles.find((role) => role.seaStarResult?.kind === 'proc')).toMatchObject({
      gameName: 'StoreRewardRandomStack',
      levelResolution: { selectedTarget: target.targetTraitKey },
    });
  });

  it('keeps the duplicate as a finding when Sea Star is not held', () => {
    const { source, duplicated } = duplicate(
      surfaceScheduledLifecycleWithQSupplyChainSlicesProject(),
    );
    const findings = simulateProjectAssembly(catalog, duplicated).evaluation.findings;
    expect(findings.map((finding) => [finding.code, semanticAddressKey(finding.origin)])).toEqual([
      ['seaStarDuplicationUnavailable', semanticAddressKey(source)],
    ]);
    expect(findings[0]?.evidence).toMatchObject({ canDuplicate: true, seaStarActive: false });
  });

  it('decodes only a duplicate shaped like its retained Slice', () => {
    const { duplicated, entry, host } = duplicate(seaStarProject);
    const raw = JSON.parse(encodeProjectDocument(duplicated)) as {
      route: {
        biomes: {
          biomeKey: string;
          topology: {
            occurrences: {
              occurrenceId: string;
              acquisitionSites: Record<string, { pickupEntries: Record<string, unknown> }>;
            }[];
          };
        }[];
      };
    };
    const rawDuplicate = () =>
      raw.route.biomes
        .find((biome) => biome.biomeKey === 'Q')!
        .topology.occurrences.find((occurrence) => occurrence.occurrenceId === host.occurrenceId)!
        .acquisitionSites[entry.site.pointKey]!.pickupEntries as Record<
        string,
        Record<string, unknown>
      >;
    expect(decodeProjectDocument(structuredClone(raw), catalog)).toEqual(duplicated);

    delete rawDuplicate()[SEA_STAR_DUPLICATE_ENTRY_KEY]!.levelResolutionsByAcquisitionRole;
    expect(() => decodeProjectDocument(raw, catalog)).toThrow(
      'levelResolutionsByAcquisitionRole: is required for this Pom reward',
    );
    rawDuplicate()[SEA_STAR_DUPLICATE_ENTRY_KEY]!.levelResolutionsByAcquisitionRole = {
      self: { kind: 'choice', offeredTraitKeys: [], selectedTraitKey: null },
    };
    expect(() => decodeProjectDocument(raw, catalog)).toThrow(
      'self.offeredTraitKeys: is not a project document field',
    );
  });
});
