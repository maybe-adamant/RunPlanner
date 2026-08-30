import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  acquisitionSiteStorageKey,
  artificerAcquisitionSite,
  artificerReplacementEntryKey,
  createAcquisitionSiteAddress,
  createAcquisitionEntryAddress,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createLevelResolutionAddress,
  createAcquisitionRoleAddress,
  createRouteStartKeepsakeSelectionAddress,
  createOccurrenceAddress,
  createRoomActionAddress,
  createTraitOfferAddress,
  createProjectHistory,
  createRouteAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  redoProjectHistory,
  roomActionKey,
  type ProjectDocument,
  undoProjectHistory,
} from '@run-planner/engine/authored-project';
import { selectedPickupProducers } from '@run-planner/engine/authored-project';
import {
  blockedOccurrenceRoomForProjectEvaluationAssembly,
  createPreparedProjectCandidateSession,
  levelResolutionCandidateForProjectEvaluationAssembly,
  simulateProject,
  simulateProjectAssembly,
  type TraitHistoryEvent,
} from '@run-planner/engine/simulation';
import {
  authorLegalTraitOffers,
  authorTestArtificerReplacement,
  editTestRoomActionOrder,
} from '@run-planner/test-fixtures/shared';
import {
  createCompleteFGProject,
  createGoldenFGHIProject,
  goldenGBiome,
} from '@run-planner/test-fixtures/underworld';
import { createCompleteNProject } from '../authored-project/support/complete-n-project';

function narcissusOccurrence(project: ProjectDocument) {
  const occurrence = project.route.biomes
    .find((biome) => biome.biomeKey === 'G')
    ?.topology?.occurrences.find((candidate) => candidate.gameName === 'G_Story01');
  if (occurrence === undefined)
    throw new Error('Golden G fixture has no Narcissus story occurrence');
  return occurrence;
}

function replacePickupActions(
  project: ProjectDocument,
  site: ReturnType<typeof createAcquisitionSiteAddress>,
  entryKeys: readonly string[],
): ProjectDocument {
  if (site.owner.kind !== 'occurrence') throw new Error('pickup site is not occurrence-owned');
  const siteKey = site.pointKey === 'roomExit' ? 'roomExit' : acquisitionSiteStorageKey(site);
  return editTestRoomActionOrder(project, catalog, site.owner, (order) => [
    ...order.filter(
      (reference) => reference.kind !== 'interactAcquisitionEntry' || reference.siteKey !== siteKey,
    ),
    ...entryKeys.map((entryKey) => ({
      kind: 'interactAcquisitionEntry' as const,
      siteKey,
      entryKey,
    })),
  ]);
}

function selectNarcissus(project: ProjectDocument, traitKeys: readonly [string, string, string]) {
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
      options: traitKeys.map((traitKey) => ({ traitKey })) as [
        { traitKey: string },
        { traitKey: string },
        { traitKey: string },
      ],
      selectedOptionKey: 'option1',
    },
  });
}

function evaluatedG(project: ProjectDocument) {
  const g = simulateProject(catalog, project).route?.biomes.find((biome) => biome.biomeKey === 'G');
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
  const siteKey = Object.entries(occurrence.acquisitionSites ?? {}).find(([, site]) =>
    Object.hasOwn(site.pickupEntries ?? {}, key),
  )?.[0];
  if (siteKey === undefined) throw new Error(`Narcissus has no ${key} pickup entry`);
  return createAcquisitionEntryAddress(
    createAcquisitionSiteAddress(
      createOccurrenceAddress(goldenGBiome, occurrence.occurrenceId),
      siteKey,
    ),
    key,
  );
}

function pickupSite(project: ProjectDocument) {
  const occurrence = narcissusOccurrence(project);
  const siteKey = Object.entries(occurrence.acquisitionSites ?? {}).find(
    ([, site]) => Object.keys(site.pickupEntries ?? {}).length > 0,
  )?.[0];
  if (siteKey === undefined) throw new Error('Narcissus has no generated pickup site');
  return createAcquisitionSiteAddress(
    createOccurrenceAddress(goldenGBiome, occurrence.occurrenceId),
    siteKey,
  );
}

describe('Narcissus pickup producer', () => {
  it('converts and later picks up an ordered Narcissus Artificer replacement', () => {
    let project = selectNarcissus(createGoldenFGHIProject(), [
      'NarcissusB',
      'NarcissusC',
      'NarcissusF',
    ]);
    const ashes = pickupEntry(project, 'ashes');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceManualArcanaSelection',
      route: createRouteAddress('Underworld'),
      arcanaKeys: ['ChanneledCast', 'HealthRegen', 'BonusDodge', 'MetaToRunUpgrade'],
    });
    project = authorTestArtificerReplacement(
      project,
      catalog,
      createAcquisitionRoleAddress(ashes, 'self'),
      Object.freeze({
        offer: Object.freeze({ rewardType: 'MaxHealthDrop' }),
        traitOffersByAcquisitionRole: Object.freeze({}),
        dispositionByAcquisitionRole: Object.freeze({
          self: Object.freeze({ kind: 'normal' as const }),
        }),
      }),
    );
    const occurrence = createOccurrenceAddress(
      goldenGBiome,
      narcissusOccurrence(project).occurrenceId,
    );
    const replacementSite = artificerAcquisitionSite(occurrence, ashes);
    const replacementKey = artificerReplacementEntryKey(ashes, 'self');
    project = replacePickupActions(project, ashes.site, ['ashes']);
    project = replacePickupActions(project, replacementSite, [replacementKey]);
    const branch = evaluatedG(project).rewards.branches[0];
    const replacement = createAcquisitionEntryAddress(replacementSite, replacementKey);
    expect(branch?.events).toContainEqual(
      expect.objectContaining({
        kind: 'artificerConversion',
        origin: ashes,
      }),
    );
    expect(branch?.events).toContainEqual(
      expect.objectContaining({ kind: 'concreteAcquisition', origin: replacement }),
    );
  });

  it.each([
    ['NarcissusB', 'ashes', 'MetaCardPointsCommonDrop'],
    ['NarcissusD', 'psyche', 'MemPointsCommonDrop'],
    ['NarcissusD', 'maxMana', 'MaxManaDrop'],
    ['NarcissusE', 'bones', 'MetaCurrencyDrop'],
    ['NarcissusE', 'maxHealth', 'MaxHealthDrop'],
    ['NarcissusH', 'lastStand', 'LastStandDrop'],
  ] as const)(
    'settles %s %s normally or through Time Piece as one exact free pickup',
    (traitKey, entryKey, acquisitionGameName) => {
      let normalProject = selectNarcissus(createGoldenFGHIProject(), [
        traitKey,
        'NarcissusC',
        'NarcissusF',
      ]);
      const entry = pickupEntry(normalProject, entryKey);
      const before = evaluatedG(normalProject).rewards.branches[0];
      normalProject = replacePickupActions(normalProject, entry.site, [entryKey]);
      const normal = evaluatedG(normalProject).rewards.branches[0];
      expect(normal?.history.useRecord[acquisitionGameName]).toBe(
        (before?.history.useRecord[acquisitionGameName] ?? 0) + 1,
      );
      expect(normal?.history.consumableRecord[acquisitionGameName]).toBe(
        (before?.history.consumableRecord[acquisitionGameName] ?? 0) + 1,
      );
      expect(normal?.events).toContainEqual(
        expect.objectContaining({
          kind: 'concreteAcquisition',
          acquisition: expect.objectContaining({
            acquisition: expect.objectContaining({ gameName: acquisitionGameName }),
          }),
          settlement: expect.objectContaining({
            entry: expect.objectContaining({ entryKey }),
          }),
        }),
      );

      let convertedProject = applyProjectCommand(normalProject, catalog, {
        kind: 'ReplaceStartingKeepsake',
        selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
        keepsakeKey: 'GoldifyKeepsake',
      });
      convertedProject = applyProjectCommand(convertedProject, catalog, {
        kind: 'ReplaceAcquisitionDisposition',
        acquisition: createAcquisitionRoleAddress(entry, 'self'),
        value: { kind: 'timePiece' },
      });
      const converted = evaluatedG(convertedProject).rewards.branches[0];
      expect(converted?.history.useRecord[acquisitionGameName]).toBe(
        before?.history.useRecord[acquisitionGameName],
      );
      expect(converted?.history.consumableRecord[acquisitionGameName]).toBe(
        before?.history.consumableRecord[acquisitionGameName],
      );
      expect(converted?.keepsakes.timePiece?.remainingCharges).toBe(3);
      expect(converted?.events).toContainEqual(
        expect.objectContaining({
          kind: 'conversionToGold',
          acquisition: expect.objectContaining({
            acquisition: expect.objectContaining({ gameName: acquisitionGameName }),
          }),
          settlement: expect.objectContaining({ entry: expect.objectContaining({ entryKey }) }),
        }),
      );
    },
  );

  it('retains the exact blocked Narcissus roster so a later optional pickup remains authorable', () => {
    let project = selectNarcissus(createGoldenFGHIProject(), [
      'NarcissusD',
      'NarcissusB',
      'NarcissusE',
    ]);
    const occurrence = narcissusOccurrence(project);
    const site = pickupEntry(project, 'psyche').site;
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition: createAcquisitionRoleAddress(
        createAcquisitionEntryAddress(site, 'psyche'),
        'self',
      ),
      value: { kind: 'timePiece' },
    });
    project = replacePickupActions(project, site, ['psyche']);

    const assembly = simulateProjectAssembly(catalog, project);
    const blocked = blockedOccurrenceRoomForProjectEvaluationAssembly(
      assembly,
      createOccurrenceAddress(goldenGBiome, occurrence.occurrenceId),
    );
    const maxMana = blocked?.roomActionRoster.rows.find(
      (row) =>
        row.reference.kind === 'interactAcquisitionEntry' && row.reference.entryKey === 'maxMana',
    );
    expect(maxMana).toMatchObject({
      participation: 'optional',
      window: { kind: 'postOutgoing' },
      rank: null,
      stale: false,
    });
    expect(
      blocked?.roomActionRoster.proposals.some(
        (proposal) =>
          proposal.kind === 'insert' &&
          proposal.reference.kind === 'interactAcquisitionEntry' &&
          proposal.reference.entryKey === 'maxMana' &&
          proposal.structurallyAuthorable,
      ),
    ).toBe(true);

    const laterOccurrence = project.route.biomes
      .find((biome) => biome.biomeKey === 'G')
      ?.topology?.occurrences.find(
        (candidate) =>
          candidate.occurrenceId !== occurrence.occurrenceId && candidate.gameName === 'G_Combat03',
      );
    if (laterOccurrence === undefined) throw new Error('Golden G has no later Combat 03');
    expect(
      blockedOccurrenceRoomForProjectEvaluationAssembly(
        assembly,
        createOccurrenceAddress(goldenGBiome, laterOccurrence.occurrenceId),
      ),
    ).toBeUndefined();
  });

  it('materializes the complete Ashes, Psyche, and Bones producer-owned entry sets', () => {
    const cases = [
      [
        'NarcissusB',
        {
          ashes: { offer: { rewardType: 'MetaCardPointsCommonDrop' } },
        },
      ],
      [
        'NarcissusD',
        {
          psyche: { offer: { rewardType: 'MemPointsCommonDrop' } },
          maxMana: { offer: { rewardType: 'MaxManaDrop' } },
        },
      ],
      [
        'NarcissusE',
        {
          bones: { offer: { rewardType: 'MetaCurrencyDrop' } },
          maxHealth: { offer: { rewardType: 'MaxHealthDrop' } },
        },
      ],
    ] as const;

    for (const [traitKey, pickupEntries] of cases) {
      const project = selectNarcissus(createGoldenFGHIProject(), [
        traitKey,
        'NarcissusC',
        'NarcissusF',
      ]);
      const site = pickupSite(project);
      expect(narcissusOccurrence(project).acquisitionSites?.[site.pointKey]).toMatchObject({
        pickupEntries,
      });
    }
  });

  it('retains absent, normal, and Time Piece converted optional pickup states in the canonical route', () => {
    let project = selectNarcissus(createGoldenFGHIProject(), [
      'NarcissusH',
      'NarcissusB',
      'NarcissusC',
    ]);
    const entry = pickupEntry(project, 'lastStand');
    const site = pickupSite(project);
    const absent = evaluatedG(project);
    expect(narcissusOccurrence(project).roomActions.order).not.toContainEqual({
      kind: 'interactAcquisitionEntry',
      siteKey: site.pointKey,
      entryKey: 'lastStand',
    });
    project = replacePickupActions(project, site, ['lastStand']);
    const normal = evaluatedG(project);
    expect(normal.rewards.branches[0]?.history.consumableRecord.LastStandDrop).toBe(1);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'GoldifyKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionDisposition',
      acquisition: createAcquisitionRoleAddress(entry, 'self'),
      value: { kind: 'timePiece' },
    });
    const converted = evaluatedG(project);
    expect(converted.rewards.branches[0]?.history.consumableRecord.LastStandDrop).toBeUndefined();
    expect(converted.rewards.branches[0]?.events).toContainEqual(
      expect.objectContaining({ kind: 'conversionToGold' }),
    );
    expect(absent.authoring).toBe('complete');
  });

  it('never converts Narcissus’s free Blind Box or its auto-activated hidden source', () => {
    let project = selectNarcissus(createGoldenFGHIProject(), [
      'NarcissusI',
      'NarcissusB',
      'NarcissusC',
    ]);
    const entry = pickupEntry(project, 'mysteryBoon');
    project = replacePickupActions(project, entry.site, ['mysteryBoon']);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'GoldifyKeepsake',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry,
      value: {
        rewardType: 'BlindBoxLoot',
        payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
      },
    });
    project = authorLegalTraitOffers(project);
    const normalBranch = evaluatedG(project).rewards.branches[0];
    expect(normalBranch?.history.consumableRecord.BlindBoxLoot).toBe(1);
    expect(normalBranch?.history.lastRewardRecreation?.offer.rewardType).toBe('HestiaUpgrade');
    expect(
      normalBranch?.traitHistory?.events.some(
        (event) =>
          event.kind === 'traitOffer' &&
          event.owner.kind === 'acquisitionEntry' &&
          event.owner.entryKey === 'mysteryBoon',
      ),
    ).toBe(true);
    expect(normalBranch?.traitHistory?.equippedTraits.NarcissusI).toBeDefined();
    const box = createAcquisitionRoleAddress(entry, 'box');
    const hiddenSource = createAcquisitionRoleAddress(entry, 'hiddenSource');
    const cases = [
      {
        acquisition: box,
        evidence: { goldConversionEligible: false, blocksGoldConversion: false },
      },
      {
        acquisition: hiddenSource,
        evidence: { goldConversionEligible: true, blocksGoldConversion: true },
      },
    ] as const;
    for (const testCase of cases) {
      const retainedInvalid = applyProjectCommand(project, catalog, {
        kind: 'ReplaceAcquisitionDisposition',
        acquisition: testCase.acquisition,
        value: { kind: 'timePiece' },
      });

      const g = evaluatedG(retainedInvalid);
      const branch = g.rewards.branches[0];
      expect(branch?.keepsakes.timePiece?.remainingCharges).toBe(4);
      expect(branch?.events.filter((event) => event.kind === 'conversionToGold')).toEqual([]);
      expect(
        g.rewards.findings.filter((finding) => finding.code === 'timePieceConversionUnavailable'),
      ).toContainEqual(
        expect.objectContaining({
          origin: testCase.acquisition,
          evidence: expect.objectContaining({
            ...testCase.evidence,
            instanceProvenance: 'free',
          }),
        }),
      );

      const candidates = createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, retainedInvalid),
      );
      expect(
        candidates.evaluate({
          kind: 'acquisitionConversion',
          acquisition: testCase.acquisition,
        }),
      ).toMatchObject({
        kind: 'acquisitionConversion',
        result: {
          timePieceSupported: false,
          timePieceConvertible: false,
          artificerSupported: false,
          artificerConvertible: false,
        },
      });
    }
  });

  it('equips the selected Narcissus trait and settles its elemental pickups', () => {
    const project = selectNarcissus(createGoldenFGHIProject(), [
      'NarcissusG',
      'NarcissusB',
      'NarcissusC',
    ]);
    const occurrence = narcissusOccurrence(project);
    const site = pickupEntry(project, 'elementalBoost1').site;
    expect(occurrence.acquisitionSites?.[site.pointKey]).toMatchObject({
      pickupEntries: {
        elementalBoost1: { offer: { rewardType: 'ElementalBoost' } },
        elementalBoost2: { offer: { rewardType: 'ElementalBoost' } },
      },
    });

    const simulation = simulateProject(catalog, project);
    const g = simulation.route.biomes.find((biome) => biome.biomeKey === 'G');
    if (g?.authoring !== 'complete') throw new Error('Golden G did not simulate');
    const histories = g.rewards.branches.map((branch) => branch.traitHistory);
    expect(histories[0]?.events.filter((event) => event.kind === 'elementContribution')).toEqual(
      [],
    );
    expect(histories.every((history) => history?.equippedTraits.NarcissusG !== undefined)).toBe(
      true,
    );
    expect(
      histories.every((history) =>
        history?.events.some(
          (event) =>
            event.kind === 'traitOffer' &&
            event.owner.kind === 'encounterPhase' &&
            event.owner.phaseKey === 'Encounter' &&
            event.giverKey === 'Narcissus',
        ),
      ),
    ).toBe(true);
  });

  it.each([['A'], ['B'], ['C'], ['D'], ['E'], ['F'], ['G'], ['H']] as const)(
    'records Narcissus%s as an equipped trait, including empty F',
    (suffix) => {
      const traitKey = `Narcissus${suffix}`;
      const options = ['NarcissusA', 'NarcissusB', 'NarcissusC', 'NarcissusD'].filter(
        (candidate) => candidate !== traitKey,
      );
      while (options.length < 3) options.push('NarcissusD');
      const project = selectNarcissus(createGoldenFGHIProject(), [
        traitKey,
        ...options.slice(0, 2),
      ] as [string, string, string]);
      const histories = evaluatedG(project).rewards.branches.map((branch) => branch.traitHistory);
      expect(histories).not.toHaveLength(0);
      expect(histories.every((history) => history?.equippedTraits[traitKey] !== undefined)).toBe(
        true,
      );
    },
  );

  it('materializes Precious Metals Gold as a source-faithful Currency pickup', () => {
    let project = selectNarcissus(createGoldenFGHIProject(), [
      'NarcissusC',
      'NarcissusB',
      'NarcissusD',
    ]);
    const site = pickupSite(project);
    expect(narcissusOccurrence(project).acquisitionSites?.[site.pointKey]).toMatchObject({
      pickupEntries: { currency: { offer: { rewardType: 'Currency' } } },
    });

    project = replacePickupActions(project, pickupSite(project), ['currency']);
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
    const site = pickupSite(project);
    expect(narcissusOccurrence(project).acquisitionSites?.[site.pointKey]).toMatchObject({
      pickupEntries: {
        pom: {
          offer: { rewardType: 'StoreRewardRandomStack' },
          levelResolutionsByAcquisitionRole: expect.any(Object),
        },
      },
    });
  });

  it('keeps the preferred Last Stand pickup authorable without a Death Defiance condition', () => {
    const disabled = selectNarcissus(createGoldenFGHIProject(), [
      'NarcissusH',
      'NarcissusB',
      'NarcissusC',
    ]);
    const disabledG = simulateProject(catalog, disabled).route?.biomes.find(
      (biome) => biome.biomeKey === 'G',
    );
    expect(disabledG?.authoring).toBe('complete');
    const site = pickupSite(disabled);
    expect(narcissusOccurrence(disabled).acquisitionSites?.[site.pointKey]).toMatchObject({
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
    const site = pickupEntry(project, 'elementalBoost1').site;
    const reference = {
      kind: 'interactAcquisitionEntry' as const,
      siteKey: site.pointKey,
      entryKey: 'elementalBoost1',
    };
    const ordered = applyProjectHistoryCommand(history, catalog, {
      kind: 'InsertRoomAction',
      action: createRoomActionAddress(
        goldenGBiome,
        occurrence.occurrenceId,
        roomActionKey(reference),
      ),
      reference,
      index: occurrence.roomActions.order.length,
    });
    expect(ordered.present).toMatchObject({
      route: expect.any(Object),
    });
    expect(undoProjectHistory(ordered).present).toBe(history.present);
    const redone = redoProjectHistory(undoProjectHistory(ordered)).present;
    expect(narcissusOccurrence(redone)).toMatchObject({
      roomActions: { order: expect.arrayContaining([reference]) },
      acquisitionSites: {
        [site.pointKey]: {
          pickupEntries: {
            elementalBoost1: { offer: { rewardType: 'ElementalBoost' } },
            elementalBoost2: { offer: { rewardType: 'ElementalBoost' } },
          },
        },
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
    const site = pickupEntry(project, 'elementalBoost2').site;
    project = replacePickupActions(project, site, ['elementalBoost2']);
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
          { traitKey: 'NarcissusA' },
          { traitKey: 'NarcissusD' },
          { traitKey: 'NarcissusE' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    expect(
      narcissusOccurrence(reconciled.present).acquisitionSites?.[
        pickupSite(reconciled.present).pointKey
      ]?.pickupEntries,
    ).toEqual(expect.objectContaining({ pom: expect.any(Object) }));
    expect(narcissusOccurrence(reconciled.present).roomActions.order).not.toContainEqual({
      kind: 'interactAcquisitionEntry',
      siteKey: site.pointKey,
      entryKey: 'elementalBoost2',
    });
    expect(undoProjectHistory(reconciled).present).toBe(history.present);
  });

  it('round-trips source-scoped pickups and rejects an unknown entry', () => {
    const project = selectNarcissus(createGoldenFGHIProject(), [
      'NarcissusG',
      'NarcissusB',
      'NarcissusC',
    ]);
    const encoded = JSON.parse(encodeProjectDocument(project)) as {
      route: {
        biomes: Array<{ topology: { occurrences: Array<Record<string, unknown>> } | null }>;
      };
    };
    expect(decodeProjectDocument(encoded, catalog)).toEqual(project);
    const story = encoded.route!.biomes[1]!.topology!.occurrences.find(
      (entry) => entry.gameName === 'G_Story01',
    )!;
    const sourceSiteKey = pickupSite(project).pointKey;
    const site = (
      story.acquisitionSites as Record<string, { pickupEntries: Record<string, unknown> }>
    )[sourceSiteKey];
    if (site === undefined) throw new Error('encoded Narcissus source site is missing');
    site.pickupEntries.extra = { offer: { rewardType: 'ElementalBoost' } };
    expect(() => decodeProjectDocument(encoded, catalog)).toThrow(/pickupEntries/);

    const forged = JSON.parse(encodeProjectDocument(project)) as typeof encoded;
    const forgedStory = forged.route!.biomes[1]!.topology!.occurrences.find(
      (entry) => entry.gameName === 'G_Story01',
    )!;
    (forgedStory.acquisitionSites as Record<string, unknown>)['traitGenerated:forged:option1'] = {
      pickupEntries: {},
    };
    expect(() => decodeProjectDocument(forged, catalog)).toThrow(
      /does not name a selected generated-pickup source/,
    );

    const malformed = JSON.parse(encodeProjectDocument(project)) as typeof encoded;
    const malformedStory = malformed.route!.biomes[1]!.topology!.occurrences.find(
      (entry) => entry.gameName === 'G_Story01',
    )!;
    (malformedStory.acquisitionSites as Record<string, unknown>)['traitGenerated:'] = {
      pickupEntries: {},
    };
    expect(() => decodeProjectDocument(malformed, catalog)).toThrow(
      /invalid generated-pickup site key/,
    );
  });

  it('rejects a selected pickup producer whose source-scoped site omits pickupEntries', () => {
    const project = selectNarcissus(createGoldenFGHIProject(), [
      'NarcissusG',
      'NarcissusB',
      'NarcissusC',
    ]);
    const encoded = JSON.parse(encodeProjectDocument(project)) as {
      route: {
        biomes: Array<{ topology: { occurrences: Array<Record<string, unknown>> } | null }>;
      };
    };
    const story = encoded.route!.biomes[1]!.topology!.occurrences.find(
      (entry) => entry.gameName === 'G_Story01',
    )!;
    const sourceSiteKey = pickupSite(project).pointKey;
    const site = (story.acquisitionSites as Record<string, Record<string, unknown>>)[sourceSiteKey];
    if (site === undefined) throw new Error('encoded Narcissus source site is missing');
    delete site.pickupEntries;
    expect(() => decodeProjectDocument(encoded, catalog)).toThrow(/pickupEntries/);
  });

  it('preserves ordinary Shop schema-34 state and rejects non-derived pickup entries', () => {
    const shop = createCompleteNProject();
    const encoded = JSON.parse(encodeProjectDocument(shop)) as {
      route: {
        biomes: Array<{ topology: { occurrences: Array<Record<string, unknown>> } | null }>;
      };
    };
    expect(decodeProjectDocument(encoded, catalog)).toEqual(shop);
    const occurrence = encoded.route!.biomes[0]!.topology!.occurrences.find(
      (entry) =>
        (entry.state as { kind?: string } | undefined)?.kind === 'shop' &&
        (entry.acquisitionSites as { roomExit?: unknown } | undefined)?.roomExit !== undefined,
    );
    if (occurrence === undefined) throw new Error('N fixture has no Shop acquisition site');
    const state = occurrence.state as {
      shop: { offers: Record<string, { reward: unknown }> };
    };
    (occurrence.acquisitionSites as { roomExit: Record<string, unknown> }).roomExit.pickupEntries =
      {
        copiedOffer: state.shop.offers.Boon!.reward,
      };
    expect(() => decodeProjectDocument(encoded, catalog)).toThrow(
      /supported supplemental Shop entry/,
    );
  });

  it('keeps Narcissus BlindBox source dormant until picked, then records its entry-owned fresh offer', () => {
    let project = selectNarcissus(createGoldenFGHIProject(), [
      'NarcissusI',
      'NarcissusB',
      'NarcissusC',
    ]);
    const occurrence = narcissusOccurrence(project);
    const pickup = pickupEntry(project, 'mysteryBoon');
    const entry = occurrence.acquisitionSites?.[pickup.site.pointKey]?.pickupEntries?.mysteryBoon;
    expect(entry).toBeNull();
    let simulation = simulateProject(catalog, project);
    let g = simulation.route.biomes.find((biome) => biome.biomeKey === 'G');
    if (g?.authoring !== 'complete') throw new Error('Golden G did not simulate');
    expect(
      g.rewards.branches[0]?.traitHistory?.events.some(
        (event) => event.kind === 'traitOffer' && event.owner.kind === 'acquisitionEntry',
      ),
    ).toBe(false);

    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry: pickup,
      value: {
        rewardType: 'BlindBoxLoot',
        payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
      },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(pickup, 'hiddenSource'),
      value: {
        kind: 'traits',
        giverKey: 'Hestia',
        options: [
          { traitKey: 'HestiaWeaponBoon', rarity: 'Common' },
          { traitKey: 'HestiaSpecialBoon', rarity: 'Common' },
          { traitKey: 'HestiaSprintBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    project = replacePickupActions(project, pickup.site, ['mysteryBoon']);
    simulation = simulateProject(catalog, project);
    g = simulation.route.biomes.find((biome) => biome.biomeKey === 'G');
    if (g?.authoring !== 'complete') throw new Error('Golden G did not simulate');
    expect(g.rewards.selectedTraitOffers).toContainEqual(
      expect.objectContaining({
        address: expect.objectContaining({
          owner: expect.objectContaining({ kind: 'acquisitionEntry', entryKey: 'mysteryBoon' }),
        }),
      }),
    );
  });

  it('derives Buried Treasure from the real Narcissus Story BlindBox source without Bones', () => {
    let project = selectNarcissus(createGoldenFGHIProject(), [
      'NarcissusI',
      'NarcissusB',
      'NarcissusC',
    ]);
    const mysteryBoon = pickupEntry(project, 'mysteryBoon');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry: mysteryBoon,
      value: {
        rewardType: 'BlindBoxLoot',
        payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' },
      },
    });
    const hiddenSource = createTraitOfferAddress(mysteryBoon, 'hiddenSource');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: hiddenSource,
      value: {
        kind: 'traits',
        giverKey: 'Poseidon',
        options: [
          { traitKey: 'RoomRewardBonusBoon', rarity: 'Common' },
          { traitKey: 'PoseidonWeaponBoon', rarity: 'Common' },
          { traitKey: 'PoseidonSpecialBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
        rarificationActions: [],
      },
    });
    const producer = selectedPickupProducers(
      catalog,
      goldenGBiome,
      narcissusOccurrence(project),
    ).find((candidate) => candidate.traitKey === 'RoomRewardBonusBoon');
    expect(producer?.pickups.map((pickup) => pickup.key)).toEqual([
      'smallGold',
      'tinyGold1',
      'tinyGold2',
      'minorHeal1',
      'minorHeal2',
    ]);
    if (producer === undefined) throw new Error('Buried Treasure producer is missing');
    expect(narcissusOccurrence(project).acquisitionSites?.[producer.siteKey]).toMatchObject({
      pickupEntries: {
        smallGold: { offer: { rewardType: 'RoomMoneySmallDrop' } },
        tinyGold1: { offer: { rewardType: 'RoomMoneyTinyDrop' } },
        tinyGold2: { offer: { rewardType: 'RoomMoneyTinyDrop' } },
        minorHeal1: { offer: { rewardType: 'HealDropMinor' } },
        minorHeal2: { offer: { rewardType: 'HealDropMinor' } },
      },
    });
    expect(decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog)).toEqual(
      project,
    );
  });

  it('keeps the generated outgoing G batch byte-identical across Narcissus pickup edits', () => {
    const baseline = createCompleteFGProject();
    const descriptor = selectNarcissus(baseline, ['NarcissusI', 'NarcissusB', 'NarcissusC']);
    const ordered = replacePickupActions(descriptor, pickupSite(descriptor), ['mysteryBoon']);
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
    completed = replacePickupActions(completed, pickupSite(completed), ['mysteryBoon']);
    const entry = pickupEntry(completed, 'mysteryBoon');
    completed = applyProjectCommand(completed, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry,
      value: {
        rewardType: 'BlindBoxLoot',
        payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
      },
    });
    completed = applyProjectCommand(completed, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(entry, 'hiddenSource'),
      value: {
        kind: 'traits',
        giverKey: 'Hestia',
        options: [
          { traitKey: 'HestiaWeaponBoon', rarity: 'Common' },
          { traitKey: 'HestiaSpecialBoon', rarity: 'Common' },
          { traitKey: 'HestiaSprintBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
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

    const site = pickupSite(completed);
    expect(
      narcissusOccurrence(incomplete).acquisitionSites?.[site.pointKey]?.pickupEntries,
    ).toEqual(occurrence.acquisitionSites?.[site.pointKey]?.pickupEntries);
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
    const pickedElemental = replacePickupActions(elemental, pickupSite(elemental), [
      'elementalBoost2',
      'elementalBoost1',
    ]);
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
    pom = replacePickupActions(pom, pickupSite(pom), ['pom']);
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
    blindBox = replacePickupActions(blindBox, pickupSite(blindBox), ['mysteryBoon']);
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

    let lastStand = selectNarcissus(createCompleteFGProject(), [
      'NarcissusH',
      'NarcissusB',
      'NarcissusC',
    ]);
    lastStand = replacePickupActions(lastStand, pickupSite(lastStand), ['lastStand']);
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
    const entry = pickupEntry(project, 'mysteryBoon');
    project = replacePickupActions(project, entry.site, ['mysteryBoon']);
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
      result: { supported: false },
    });
    let applied = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry,
      value: replacement,
    });
    applied = applyProjectCommand(applied, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(entry, 'hiddenSource'),
      value: {
        kind: 'traits',
        giverKey: 'Hestia',
        options: [
          { traitKey: 'HestiaWeaponBoon', rarity: 'Common' },
          { traitKey: 'HestiaSpecialBoon', rarity: 'Common' },
          { traitKey: 'HestiaSprintBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
    });
    expect(
      narcissusOccurrence(applied).acquisitionSites?.[entry.site.pointKey]?.pickupEntries
        ?.mysteryBoon?.traitOffersByAcquisitionRole.hiddenSource?.giverKey,
    ).toBe('Hestia');
    const appliedG = simulateProject(catalog, applied).route?.biomes.find(
      (biome) => biome.biomeKey === 'G',
    );
    if (appliedG?.authoring !== 'complete') throw new Error('applied Narcissus G did not simulate');
    // Completing the exact entry-owned reward and fresh trait offer retains
    // the reachable acquisition product.
    expect(appliedG.rewards.branches.length).toBeGreaterThan(0);
    expect(
      session.evaluate({
        kind: 'acquisitionEntryOffer',
        entry,
        value: { rewardType: 'MaxHealthDrop' },
      }),
    ).toMatchObject({ kind: 'acquisitionEntryOffer', result: { supported: false } });
  });

  it('publishes an active unpicked payload frontier without acquiring or blocking its candidate', () => {
    const project = selectNarcissus(createCompleteFGProject(), [
      'NarcissusI',
      'NarcissusB',
      'NarcissusC',
    ]);
    const occurrence = narcissusOccurrence(project);
    const entry = pickupEntry(project, 'mysteryBoon');
    expect(occurrence.roomActions.order).not.toContainEqual({
      kind: 'interactAcquisitionEntry',
      siteKey: entry.site.pointKey,
      entryKey: 'mysteryBoon',
    });
    const assembly = simulateProjectAssembly(catalog, project);
    const evaluated = assembly.evaluation.route.biomes.find((biome) => biome.biomeKey === 'G');
    expect(evaluated?.findings).toContainEqual(
      expect.objectContaining({ code: 'rewardMissing', origin: entry }),
    );
    const session = createPreparedProjectCandidateSession(catalog, assembly);
    expect(
      session.evaluate({
        kind: 'acquisitionEntryOffer',
        entry,
        value: {
          rewardType: 'BlindBoxLoot',
          payload: { kind: 'BoonSource', source: 'HestiaUpgrade' },
        },
      }),
    ).toMatchObject({ kind: 'acquisitionEntryOffer', result: { supported: true } });
    expect(
      evaluated !== undefined &&
        'rewards' in evaluated &&
        evaluated.rewards.branches.some((branch) =>
          branch.events.some(
            (event) =>
              event.kind === 'concreteAcquisition' &&
              event.settlement?.entry.entryKey === 'mysteryBoon',
          ),
        ),
    ).toBe(false);
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
      selectedPickupProducers(
        catalog,
        goldenGBiome,
        Object.freeze({
          ...occurrence,
          encounters: Object.freeze({
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
        }),
      ).find((producer) => producer.traitKey === 'NarcissusI'),
    ).toMatchObject({ traitKey: 'NarcissusI', producerLifecycleKey: 'NarcissusPickup' });
  });
});
