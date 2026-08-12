import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createAcquisitionSiteAddress,
  createAcquisitionEntryAddress,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createLevelResolutionAddress,
  createOccurrenceAddress,
  createTraitOfferAddress,
  createProjectHistory,
  decodeProjectDocument,
  encodeProjectDocument,
  redoProjectHistory,
  type ProjectDocument,
  undoProjectHistory,
} from '@run-planner/engine/authored-project';
import { selectedPickupProducer } from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  levelResolutionCandidateForProjectEvaluationAssembly,
  simulateProject,
  simulateProjectAssembly,
  type TraitHistoryEvent,
} from '@run-planner/engine/simulation';
import {
  authorLegalTraitOffers,
  createCompleteFGProject,
  createGoldenFGHIProject,
  goldenGBiome,
} from '@run-planner/test-fixtures';
import { createCompleteNProject } from '../authored-project/support/complete-n-project';

function narcissusOccurrence(project: ProjectDocument) {
  const occurrence = project.routes
    .flatMap((route) => route.biomes)
    .find((biome) => biome.biomeKey === 'G')
    ?.topology?.occurrences.find((candidate) => candidate.gameName === 'G_Story01');
  if (occurrence === undefined)
    throw new Error('Golden G fixture has no Narcissus story occurrence');
  return occurrence;
}

function selectNarcissus(
  project: ProjectDocument,
  traitKeys: readonly [string, string, string],
  deathDefianceConditionMet = false,
) {
  const occurrence = narcissusOccurrence(project);
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(
      createEncounterPhaseAddress(
        goldenGBiome,
        { kind: 'occurrence', occurrenceId: occurrence.occurrenceId },
        'Encounter',
      ),
      'selection',
    ),
    value: {
      kind: 'traits',
      giverKey: 'Narcissus',
      options: traitKeys.map((traitKey) => ({ traitKey, rarity: 'Common' })) as [
        { traitKey: string; rarity: 'Common' },
        { traitKey: string; rarity: 'Common' },
        { traitKey: string; rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
      deathDefianceConditionMet,
    },
  });
}

function evaluatedG(project: ProjectDocument) {
  const g = simulateProject(catalog, project)
    .routes.find((route) => route.routeKey === 'Underworld')
    ?.biomes.find((biome) => biome.biomeKey === 'G');
  if (g === undefined || !('rewards' in g)) throw new Error('G did not publish reward products');
  return g;
}

function narcissusOutgoingBatch(project: ProjectDocument) {
  const occurrence = narcissusOccurrence(project);
  const g = evaluatedG(project);
  const snapshot = 'snapshot' in g ? g.snapshot : g.materializedPrefix;
  const batch = snapshot.decisions.find(
    (decision) =>
      decision.kind === 'batch' &&
      decision.source.kind === 'occurrence' &&
      decision.source.occurrenceId === occurrence.occurrenceId,
  );
  if (batch === undefined) throw new Error('Narcissus has no generated outgoing batch');
  return batch;
}

function pickupEntry(project: ProjectDocument, key: string) {
  const occurrence = narcissusOccurrence(project);
  return createAcquisitionEntryAddress(
    createAcquisitionSiteAddress(
      createOccurrenceAddress(goldenGBiome, occurrence.occurrenceId),
      'roomExit',
    ),
    key,
  );
}

function pickupSite(project: ProjectDocument) {
  return pickupEntry(project, 'placeholder').site;
}

describe('Narcissus pickup producer', () => {
  it('keeps the descriptor out of equipped history and settles selected elemental pickups at G room exit', () => {
    let project = selectNarcissus(createGoldenFGHIProject(), [
      'NarcissusG',
      'NarcissusB',
      'NarcissusC',
    ]);
    const occurrence = narcissusOccurrence(project);
    const site = createAcquisitionSiteAddress(
      createOccurrenceAddress(goldenGBiome, occurrence.occurrenceId),
      'roomExit',
    );
    expect(occurrence.acquisitionSites?.roomExit).toMatchObject({
      order: [],
      pickupEntries: {
        elementalBoost1: { offer: { rewardType: 'ElementalBoost' } },
        elementalBoost2: { offer: { rewardType: 'ElementalBoost' } },
      },
    });

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionOrder',
      site,
      entryKeys: ['elementalBoost2', 'elementalBoost1'],
    });
    const simulation = simulateProject(catalog, project);
    const g = simulation.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'G');
    if (g?.authoring !== 'complete') throw new Error('Golden G did not simulate');
    const histories = g.rewards.branches.map((branch) => branch.traitHistory);
    expect(histories[0]?.events.filter((event) => event.kind === 'elementContribution')).toEqual([
      expect.objectContaining({ owner: expect.objectContaining({ entryKey: 'elementalBoost2' }) }),
      expect.objectContaining({ owner: expect.objectContaining({ entryKey: 'elementalBoost1' }) }),
    ]);
    expect(histories.every((history) => history?.equippedTraits.NarcissusG === undefined)).toBe(
      true,
    );
    expect(
      histories.every(
        (history) =>
          !history?.events.some(
            (event) =>
              event.kind === 'traitOffer' &&
              event.owner.kind === 'encounterPhase' &&
              event.owner.phaseKey === 'Encounter' &&
              event.giverKey === 'Narcissus',
          ),
      ),
    ).toBe(true);
  });

  it('materializes Precious Metals Gold as a source-faithful Currency pickup', () => {
    let project = selectNarcissus(createGoldenFGHIProject(), [
      'NarcissusC',
      'NarcissusB',
      'NarcissusD',
    ]);
    expect(narcissusOccurrence(project).acquisitionSites?.roomExit).toMatchObject({
      order: [],
      pickupEntries: { currency: { offer: { rewardType: 'Currency' } } },
    });

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionOrder',
      site: pickupSite(project),
      entryKeys: ['currency'],
    });
    const histories = evaluatedG(project).rewards.branches.map((branch) => branch.history);
    expect(histories.length).toBeGreaterThan(0);
    expect(
      histories.every(
        (history) => history.useRecord.Currency === 1 && history.consumableRecord.Currency === 1,
      ),
    ).toBe(true);
  });

  it('reconciles the default Pom pickup when its producing descriptor is selected again', () => {
    const project = selectNarcissus(createGoldenFGHIProject(), [
      'NarcissusA',
      'NarcissusD',
      'NarcissusE',
    ]);
    expect(narcissusOccurrence(project).acquisitionSites?.roomExit).toMatchObject({
      pickupEntries: {
        pom: {
          offer: { rewardType: 'StoreRewardRandomStack' },
          levelResolutionsByAcquisitionRole: expect.any(Object),
        },
      },
    });
  });

  it('admits the Last Stand pickup only when the local Death Defiance condition is true', () => {
    const disabled = selectNarcissus(createGoldenFGHIProject(), [
      'NarcissusH',
      'NarcissusB',
      'NarcissusC',
    ]);
    const disabledG = simulateProject(catalog, disabled)
      .routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'G');
    expect(
      disabledG?.authoring === 'complete' && disabledG.rewards.findings.length,
    ).toBeGreaterThan(0);
    const enabled = selectNarcissus(
      createGoldenFGHIProject(),
      ['NarcissusH', 'NarcissusB', 'NarcissusC'],
      true,
    );
    expect(narcissusOccurrence(enabled).acquisitionSites?.roomExit).toMatchObject({
      order: [],
      pickupEntries: { lastStand: { offer: { rewardType: 'LastStandDrop' } } },
    });
  });

  it('keeps pickup entry detail through an undoable selected-order edit', () => {
    const project = selectNarcissus(createGoldenFGHIProject(), [
      'NarcissusG',
      'NarcissusB',
      'NarcissusC',
    ]);
    const occurrence = narcissusOccurrence(project);
    const history = createProjectHistory(project);
    const ordered = applyProjectHistoryCommand(history, catalog, {
      kind: 'ReplaceAcquisitionOrder',
      site: createAcquisitionSiteAddress(
        createOccurrenceAddress(goldenGBiome, occurrence.occurrenceId),
        'roomExit',
      ),
      entryKeys: ['elementalBoost1'],
    });
    expect(ordered.present).toMatchObject({
      routes: expect.any(Array),
    });
    expect(undoProjectHistory(ordered).present).toBe(history.present);
    const redone = redoProjectHistory(undoProjectHistory(ordered)).present;
    expect(narcissusOccurrence(redone).acquisitionSites?.roomExit).toMatchObject({
      order: ['elementalBoost1'],
      pickupEntries: {
        elementalBoost1: { offer: { rewardType: 'ElementalBoost' } },
        elementalBoost2: { offer: { rewardType: 'ElementalBoost' } },
      },
    });
  });

  it('reconciles obsolete pickup entries and their order when the descriptor changes', () => {
    let project = selectNarcissus(createGoldenFGHIProject(), [
      'NarcissusG',
      'NarcissusB',
      'NarcissusC',
    ]);
    const occurrence = narcissusOccurrence(project);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionOrder',
      site: createAcquisitionSiteAddress(
        createOccurrenceAddress(goldenGBiome, occurrence.occurrenceId),
        'roomExit',
      ),
      entryKeys: ['elementalBoost2'],
    });
    const history = createProjectHistory(project);
    const reconciled = applyProjectHistoryCommand(history, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(
        createEncounterPhaseAddress(
          goldenGBiome,
          { kind: 'occurrence', occurrenceId: occurrence.occurrenceId },
          'Encounter',
        ),
        'selection',
      ),
      value: {
        kind: 'traits',
        giverKey: 'Narcissus',
        options: [
          { traitKey: 'NarcissusA', rarity: 'Common' },
          { traitKey: 'NarcissusD', rarity: 'Common' },
          { traitKey: 'NarcissusE', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
        deathDefianceConditionMet: false,
      },
    });
    expect(narcissusOccurrence(reconciled.present).acquisitionSites?.roomExit).toEqual({
      order: [],
      pickupEntries: expect.objectContaining({ pom: expect.any(Object) }),
    });
    expect(undoProjectHistory(reconciled).present).toBe(history.present);
  });

  it('round-trips schema-20 site-owned pickups and rejects an unknown entry', () => {
    const project = selectNarcissus(createGoldenFGHIProject(), [
      'NarcissusG',
      'NarcissusB',
      'NarcissusC',
    ]);
    const encoded = JSON.parse(encodeProjectDocument(project)) as {
      routes: Array<{
        biomes: Array<{ topology: { occurrences: Array<Record<string, unknown>> } | null }>;
      }>;
    };
    expect(decodeProjectDocument(encoded, catalog)).toEqual(project);
    const story = encoded.routes[0]!.biomes[1]!.topology!.occurrences.find(
      (entry) => entry.gameName === 'G_Story01',
    )!;
    const site = (
      story.acquisitionSites as { roomExit: { pickupEntries: Record<string, unknown> } }
    ).roomExit;
    site.pickupEntries.extra = { offer: { rewardType: 'ElementalBoost' } };
    expect(() => decodeProjectDocument(encoded, catalog)).toThrow(/pickupEntries/);
  });

  it('rejects a selected pickup producer whose schema-20 site omits pickupEntries', () => {
    const project = selectNarcissus(createGoldenFGHIProject(), [
      'NarcissusG',
      'NarcissusB',
      'NarcissusC',
    ]);
    const encoded = JSON.parse(encodeProjectDocument(project)) as {
      routes: Array<{
        biomes: Array<{ topology: { occurrences: Array<Record<string, unknown>> } | null }>;
      }>;
    };
    const story = encoded.routes[0]!.biomes[1]!.topology!.occurrences.find(
      (entry) => entry.gameName === 'G_Story01',
    )!;
    delete (story.acquisitionSites as { roomExit: Record<string, unknown> }).roomExit.pickupEntries;
    expect(() => decodeProjectDocument(encoded, catalog)).toThrow(/requires pickupEntries/);
  });

  it('preserves ordinary Shop schema-20 state and rejects copied pickup entries', () => {
    const shop = createCompleteNProject();
    const encoded = JSON.parse(encodeProjectDocument(shop)) as {
      routes: Array<{
        biomes: Array<{ topology: { occurrences: Array<Record<string, unknown>> } | null }>;
      }>;
    };
    expect(decodeProjectDocument(encoded, catalog)).toEqual(shop);
    const occurrence = encoded.routes[1]!.biomes[0]!.topology!.occurrences.find(
      (entry) =>
        (entry.state as { kind?: string } | undefined)?.kind === 'shop' &&
        (entry.acquisitionSites as { roomExit?: unknown } | undefined)?.roomExit !== undefined,
    );
    if (occurrence === undefined) throw new Error('N fixture has no Shop acquisition site');
    (occurrence.acquisitionSites as { roomExit: Record<string, unknown> }).roomExit.pickupEntries =
      {};
    expect(() => decodeProjectDocument(encoded, catalog)).toThrow(/pickupEntries/);
  });

  it('keeps Narcissus BlindBox source dormant until picked, then records its entry-owned fresh offer', () => {
    let project = selectNarcissus(createGoldenFGHIProject(), [
      'NarcissusI',
      'NarcissusB',
      'NarcissusC',
    ]);
    const occurrence = narcissusOccurrence(project);
    const entry = occurrence.acquisitionSites?.roomExit?.pickupEntries?.mysteryBoon;
    expect(entry).toMatchObject({
      offer: { rewardType: 'BlindBoxLoot' },
      traitOffersByAcquisitionRole: expect.any(Object),
    });
    let simulation = simulateProject(catalog, project);
    let g = simulation.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'G');
    if (g?.authoring !== 'complete') throw new Error('Golden G did not simulate');
    expect(
      g.rewards.branches[0]?.traitHistory?.events.some(
        (event) => event.kind === 'traitOffer' && event.owner.kind === 'acquisitionEntry',
      ),
    ).toBe(false);

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry: createAcquisitionEntryAddress(
        createAcquisitionSiteAddress(
          createOccurrenceAddress(goldenGBiome, occurrence.occurrenceId),
          'roomExit',
        ),
        'mysteryBoon',
      ),
      value: {
        rewardType: 'BlindBoxLoot',
        payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
      },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionOrder',
      site: createAcquisitionSiteAddress(
        createOccurrenceAddress(goldenGBiome, occurrence.occurrenceId),
        'roomExit',
      ),
      entryKeys: ['mysteryBoon'],
    });
    simulation = simulateProject(catalog, project);
    g = simulation.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'G');
    if (g?.authoring !== 'complete') throw new Error('Golden G did not simulate');
    expect(g.rewards.selectedTraitOffers).toContainEqual(
      expect.objectContaining({
        address: expect.objectContaining({
          owner: expect.objectContaining({ kind: 'acquisitionEntry', entryKey: 'mysteryBoon' }),
        }),
      }),
    );
  });

  it('keeps the generated outgoing G batch byte-identical across Narcissus pickup edits', () => {
    const baseline = createCompleteFGProject();
    const descriptor = selectNarcissus(baseline, ['NarcissusI', 'NarcissusB', 'NarcissusC']);
    const ordered = applyProjectCommand(descriptor, catalog, {
      kind: 'ReplaceAcquisitionOrder',
      site: pickupSite(descriptor),
      entryKeys: ['mysteryBoon'],
    });
    const repaired = applyProjectCommand(ordered, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry: pickupEntry(ordered, 'mysteryBoon'),
      value: {
        rewardType: 'BlindBoxLoot',
        payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
      },
    });

    expect(narcissusOutgoingBatch(descriptor)).toEqual(narcissusOutgoingBatch(baseline));
    expect(narcissusOutgoingBatch(ordered)).toEqual(narcissusOutgoingBatch(descriptor));
    expect(narcissusOutgoingBatch(repaired)).toEqual(narcissusOutgoingBatch(descriptor));
  });

  it('retains the exact Narcissus pickup frontier when its outgoing decision is absent', () => {
    let completed = selectNarcissus(createCompleteFGProject(), [
      'NarcissusI',
      'NarcissusB',
      'NarcissusC',
    ]);
    completed = applyProjectCommand(completed, catalog, {
      kind: 'ReplaceAcquisitionOrder',
      site: pickupSite(completed),
      entryKeys: ['mysteryBoon'],
    });
    const entry = pickupEntry(completed, 'mysteryBoon');
    completed = applyProjectCommand(completed, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry,
      value: {
        rewardType: 'BlindBoxLoot',
        payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
      },
    });
    const occurrence = narcissusOccurrence(completed);
    const incomplete = applyProjectCommand(completed, catalog, {
      kind: 'RemoveExitDecision',
      decision: createExitDecisionAddress(goldenGBiome, {
        kind: 'occurrence',
        occurrenceId: occurrence.occurrenceId,
      }),
    });

    expect(narcissusOccurrence(incomplete).acquisitionSites?.roomExit?.pickupEntries).toEqual(
      occurrence.acquisitionSites?.roomExit?.pickupEntries,
    );
    const completeG = evaluatedG(completed);
    const incompleteG = evaluatedG(incomplete);
    expect(incompleteG.authoring).toBe('incomplete');
    const selectedChild = (project: ProjectDocument) =>
      evaluatedG(project).rewards.selectedTraitOffers.filter(
        (offer) =>
          offer.address.owner.kind === 'acquisitionEntry' &&
          offer.address.owner.entryKey === 'mysteryBoon',
      );
    const childFindings = (project: ProjectDocument) =>
      evaluatedG(project).rewards.findings.filter((finding) => {
        const owner =
          finding.origin.kind === 'traitOffer' || finding.origin.kind === 'levelResolution'
            ? finding.origin.owner
            : finding.origin;
        return owner.kind === 'acquisitionEntry' && owner.entryKey === 'mysteryBoon';
      });
    expect(selectedChild(incomplete)).toEqual(selectedChild(completed));
    expect(childFindings(incomplete)).toEqual(childFindings(completed));
    expect(incompleteG.rewards.branches).toEqual(completeG.rewards.branches);
    const candidateValue = {
      rewardType: 'BlindBoxLoot' as const,
      payload: { kind: 'BoonSource' as const, source: 'HestiaUpgrade' as const },
    };
    expect(
      createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, incomplete),
      ).evaluate({
        kind: 'acquisitionEntryOffer',
        entry,
        value: candidateValue,
      }),
    ).toEqual(
      createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, completed),
      ).evaluate({
        kind: 'acquisitionEntryOffer',
        entry,
        value: candidateValue,
      }),
    );
  });

  it('leaves unpicked pickups out of history and folds each picked Narcissus output at its declared boundary', () => {
    const elemental = selectNarcissus(createCompleteFGProject(), [
      'NarcissusG',
      'NarcissusB',
      'NarcissusC',
    ]);
    expect(
      evaluatedG(elemental).rewards.branches.every(
        (branch) =>
          !branch.events.some(
            (event) =>
              event.kind === 'concreteAcquisition' &&
              event.settlement?.entry.entryKey === 'elementalBoost1',
          ),
      ),
    ).toBe(true);
    const pickedElemental = applyProjectCommand(elemental, catalog, {
      kind: 'ReplaceAcquisitionOrder',
      site: pickupSite(elemental),
      entryKeys: ['elementalBoost2', 'elementalBoost1'],
    });
    expect(
      evaluatedG(pickedElemental).rewards.branches[0]?.traitHistory?.events.filter(
        (event) => event.kind === 'elementContribution',
      ),
    ).toEqual([
      expect.objectContaining({ owner: expect.objectContaining({ entryKey: 'elementalBoost2' }) }),
      expect.objectContaining({ owner: expect.objectContaining({ entryKey: 'elementalBoost1' }) }),
    ]);

    let pom = selectNarcissus(createCompleteFGProject(), [
      'NarcissusA',
      'NarcissusD',
      'NarcissusE',
    ]);
    pom = authorLegalTraitOffers(pom);
    pom = applyProjectCommand(pom, catalog, {
      kind: 'ReplaceAcquisitionOrder',
      site: pickupSite(pom),
      entryKeys: ['pom'],
    });
    const pomEntry = pickupEntry(pom, 'pom');
    const pomResolution = createLevelResolutionAddress(pomEntry, 'self');
    const pomAssembly = simulateProjectAssembly(catalog, pom);
    const pomTarget = levelResolutionCandidateForProjectEvaluationAssembly(
      pomAssembly,
      pomResolution,
    )?.branches[0]?.eligibleTargetTraitKeys[0];
    if (pomTarget === undefined) throw new Error('Narcissus Pom has no eligible target');
    pom = applyProjectCommand(pom, catalog, {
      kind: 'ReplaceLevelResolution',
      levelResolution: pomResolution,
      value: { kind: 'random', targetTraitKey: pomTarget },
    });
    const pomMutation = evaluatedG(pom).rewards.branches[0]?.traitHistory?.events.find(
      (event): event is Extract<TraitHistoryEvent, { readonly kind: 'levelMutation' }> =>
        event.kind === 'levelMutation' &&
        event.owner.kind === 'levelResolution' &&
        event.owner.owner.kind === 'acquisitionEntry' &&
        event.owner.owner.entryKey === 'pom' &&
        event.targetTraitKey === pomTarget,
    );
    if (pomMutation === undefined)
      throw new Error('Narcissus Pom did not mutate its selected target');
    expect(pomMutation.newLevel).toBe(pomMutation.oldLevel + 1);

    let blindBox = selectNarcissus(createCompleteFGProject(), [
      'NarcissusI',
      'NarcissusB',
      'NarcissusC',
    ]);
    blindBox = applyProjectCommand(blindBox, catalog, {
      kind: 'ReplaceAcquisitionOrder',
      site: pickupSite(blindBox),
      entryKeys: ['mysteryBoon'],
    });
    blindBox = authorLegalTraitOffers(blindBox);
    const blindBoxEntry = pickupEntry(blindBox, 'mysteryBoon');
    blindBox = applyProjectCommand(blindBox, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry: blindBoxEntry,
      value: {
        rewardType: 'BlindBoxLoot',
        payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
      },
    });
    blindBox = authorLegalTraitOffers(blindBox);
    const blindBoxHistory = evaluatedG(blindBox).rewards.branches[0]?.traitHistory;
    const blindBoxOffer = blindBoxHistory?.events.find(
      (event): event is Extract<TraitHistoryEvent, { readonly kind: 'traitOffer' }> =>
        event.kind === 'traitOffer' &&
        event.owner.kind === 'acquisitionEntry' &&
        event.owner.entryKey === 'mysteryBoon',
    );
    if (blindBoxOffer === undefined)
      throw new Error('picked BlindBox did not equip its fresh offer');
    expect(blindBoxOffer.giverKey).toBe('Hestia');
    const selectedBlindBoxTrait =
      blindBoxOffer.options[
        blindBoxOffer.selectedOptionKey === 'option1'
          ? 0
          : blindBoxOffer.selectedOptionKey === 'option2'
            ? 1
            : 2
      ]!.traitKey;
    expect(blindBoxHistory?.equippedTraits[selectedBlindBoxTrait]).toBeDefined();

    let lastStand = selectNarcissus(
      createCompleteFGProject(),
      ['NarcissusH', 'NarcissusB', 'NarcissusC'],
      true,
    );
    lastStand = applyProjectCommand(lastStand, catalog, {
      kind: 'ReplaceAcquisitionOrder',
      site: pickupSite(lastStand),
      entryKeys: ['lastStand'],
    });
    expect(evaluatedG(lastStand).rewards.branches[0]?.events).toContainEqual(
      expect.objectContaining({
        kind: 'concreteAcquisition',
        acquisition: expect.objectContaining({
          acquisition: expect.objectContaining({ gameName: 'LastStandDrop' }),
        }),
        settlement: expect.objectContaining({
          entry: expect.objectContaining({ entryKey: 'lastStand' }),
        }),
      }),
    );
  });

  it('publishes a picked pickup payload frontier at its exact entry history', () => {
    let project = selectNarcissus(createCompleteFGProject(), [
      'NarcissusI',
      'NarcissusB',
      'NarcissusC',
    ]);
    const occurrence = narcissusOccurrence(project);
    const entry = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(
        createOccurrenceAddress(goldenGBiome, occurrence.occurrenceId),
        'roomExit',
      ),
      'mysteryBoon',
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionOrder',
      site: entry.site,
      entryKeys: ['mysteryBoon'],
    });
    project = authorLegalTraitOffers(project);
    const session = createPreparedProjectCandidateSession(
      catalog,
      simulateProjectAssembly(catalog, project),
    );
    const replacement = {
      rewardType: 'BlindBoxLoot' as const,
      payload: { kind: 'BoonSource' as const, source: 'HestiaUpgrade' as const },
    };
    expect(
      session.evaluate({ kind: 'acquisitionEntryOffer', entry, value: replacement }),
    ).toMatchObject({
      kind: 'acquisitionEntryOffer',
      result: { supported: true },
    });
    const applied = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry,
      value: replacement,
    });
    expect(
      narcissusOccurrence(applied).acquisitionSites?.roomExit?.pickupEntries?.mysteryBoon
        ?.traitOffersByAcquisitionRole.hiddenSource?.giverKey,
    ).toBe('Hestia');
    const appliedG = simulateProject(catalog, applied)
      .routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'G');
    if (appliedG?.authoring !== 'complete') throw new Error('applied Narcissus G did not simulate');
    // Candidate support means the exact entry fold retains a branch. The
    // command may still expose an invalid default child for repair, but it
    // must not erase the reachable acquisition product.
    expect(appliedG.rewards.branches.length).toBeGreaterThan(0);
    expect(
      session.evaluate({
        kind: 'acquisitionEntryOffer',
        entry,
        value: { rewardType: 'MaxHealthDrop' },
      }),
    ).toMatchObject({ kind: 'acquisitionEntryOffer', result: { supported: false } });
  });

  it('locates a selected pickup producer across every encounter phase', () => {
    const project = selectNarcissus(createGoldenFGHIProject(), [
      'NarcissusI',
      'NarcissusB',
      'NarcissusC',
    ]);
    const occurrence = narcissusOccurrence(project);
    const selected = occurrence.encounters.traitOffersByPhase?.Encounter?.Story_Narcissus_01;
    if (selected === undefined) throw new Error('Narcissus encounter offer is missing');
    expect(
      selectedPickupProducer(
        catalog,
        Object.freeze({
          ...occurrence.encounters,
          traitOffersByPhase: Object.freeze({
            Other: Object.freeze({
              unrelated: Object.freeze({
                kind: 'traits',
                giverKey: 'Apollo',
                options: [
                  { traitKey: 'ApolloWeaponBoon', rarity: 'Common' as const },
                  { traitKey: 'ApolloSpecialBoon', rarity: 'Common' as const },
                  { traitKey: 'ApolloCastBoon', rarity: 'Common' as const },
                ] as const,
                selectedOptionKey: 'option1' as const,
              }),
            }),
            ...(occurrence.encounters.traitOffersByPhase ?? {}),
          }),
        }),
      ),
    ).toMatchObject({ traitKey: 'NarcissusI', disposition: { kind: 'producePickups' } });
  });
});
