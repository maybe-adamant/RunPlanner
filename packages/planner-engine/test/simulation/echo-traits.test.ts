import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createEncounterPhaseAddress,
  createEchoPomTargetAddress,
  createExitSelectionAddress,
  createOccurrenceId,
  createTraitOfferAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  semanticAddressKey,
  type AuthoredTraitOfferTraits,
} from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { createGoldenFGHProject, goldenHBiome } from '@run-planner/test-fixtures';
import { describe, expect, it } from 'vitest';

import { createTraitOfferCandidateArtifacts } from '../../src/simulation/candidate-artifacts';
import {
  evaluateEchoPomTargetDomain,
  evaluateTraitOfferFocusedOptionCandidate,
} from '../../src/simulation/candidates/trait-offer';
import { processEncounterTraitOffer } from '../../src/simulation/rewards/processing';
import {
  attachTraitHistory,
  createTraitHistoryState,
  foldTraitHistoryEvents,
  type TraitHistoryEvent,
} from '../../src/simulation/traits';
import { initializeTestRewardBranches } from '../support/arcana-fear';

type JsonRecord = Record<string, unknown>;

const bridgeId = createOccurrenceId('golden-h-bridge01');
const echoOwner = createTraitOfferAddress(
  createEncounterPhaseAddress(
    goldenHBiome,
    { kind: 'occurrence', occurrenceId: bridgeId },
    'Encounter',
  ),
  'selection',
);

function echoOffer(
  selectedOptionKey: AuthoredTraitOfferTraits['selectedOptionKey'],
  options: AuthoredTraitOfferTraits['options'],
  deathDefianceConditionMet = false,
): AuthoredTraitOfferTraits {
  return Object.freeze({
    kind: 'traits',
    giverKey: 'Echo',
    options,
    selectedOptionKey,
    rarificationActions: Object.freeze([]),
    deathDefianceConditionMet,
  });
}

function echoTraitOption(traitKey: string): AuthoredTraitOfferTraits['options'][number] {
  return traitKey === 'EchoDoubleLevelBoon'
    ? Object.freeze({ traitKey, rarity: 'Common', echoPomTarget: null })
    : Object.freeze({ traitKey, rarity: 'Common' });
}

function baseBranch(history = createTraitHistoryState()) {
  const base = initializeTestRewardBranches()[0]!;
  return Object.freeze({
    ...base,
    history: attachTraitHistory(base.history, history),
    traitHistory: history,
  });
}

function priorLeveledTraits() {
  const options = [
    ['Apollo', 'ApolloWeaponBoon'],
    ['Zeus', 'ZeusWeaponBoon'],
    ['Hestia', 'HestiaWeaponBoon'],
  ] as const;
  const events: TraitHistoryEvent[] = options.map(([giverKey, traitKey], index) =>
    Object.freeze({
      kind: 'traitOffer' as const,
      owner: echoOwner.owner,
      acquisitionRole: `prior${index}`,
      sequence: index + 1,
      giverKey,
      options: Object.freeze([
        { traitKey, rarity: 'Common' },
      ]) as AuthoredTraitOfferTraits['options'],
      selectedOptionKey: 'option1' as const,
      acquisitionPoint: 'prior',
    }),
  );
  events.push(
    Object.freeze({
      kind: 'levelMutation' as const,
      owner: echoOwner.owner,
      acquisitionRole: 'priorApolloPom',
      sequence: 4,
      acquisitionPoint: 'prior',
      targetTraitKey: 'ApolloWeaponBoon',
      oldLevel: 1,
      newLevel: 3,
    }),
    Object.freeze({
      kind: 'levelMutation' as const,
      owner: echoOwner.owner,
      acquisitionRole: 'priorZeusPom',
      sequence: 5,
      acquisitionPoint: 'prior',
      targetTraitKey: 'ZeusWeaponBoon',
      oldLevel: 1,
      newLevel: 3,
    }),
    Object.freeze({
      kind: 'levelMutation' as const,
      owner: echoOwner.owner,
      acquisitionRole: 'priorHestiaPom',
      sequence: 6,
      acquisitionPoint: 'prior',
      targetTraitKey: 'HestiaWeaponBoon',
      oldLevel: 1,
      newLevel: 2,
    }),
  );
  return foldTraitHistoryEvents(catalog, events);
}

function echoOfferInDocument(document: JsonRecord): JsonRecord {
  const route = (document.routes as JsonRecord[]).find(
    (candidate) => candidate.routeKey === 'Underworld',
  )!;
  const biome = (route.biomes as JsonRecord[]).find((candidate) => candidate.biomeKey === 'H')!;
  const topology = biome.topology as JsonRecord;
  const occurrence = (topology.occurrences as JsonRecord[]).find(
    (candidate) => candidate.occurrenceId === bridgeId,
  )!;
  const encounters = occurrence.encounters as JsonRecord;
  const byPhase = encounters.traitOffersByPhase as JsonRecord;
  return ((byPhase.Encounter as JsonRecord).Story_Echo_01 ?? {}) as JsonRecord;
}

describe('Echo Gate A direct choices', () => {
  it.each([
    [false, ['DiminishingDodgeBoon', 'DiminishingHealthAndManaBoon', 'EchoDoubleLevelBoon']],
    [true, ['EchoDeathDefianceRefill', 'DiminishingDodgeBoon', 'EchoDoubleLevelBoon']],
  ] as const)(
    'keeps ordinary exact-three offers legal with DD condition %s',
    (deathDefianceConditionMet, optionTraitKeys) => {
      const project = createGoldenFGHProject();
      const evaluation = simulateProjectAssembly(catalog, project).evaluation;
      const value = echoOffer(
        'option1',
        [
          echoTraitOption(optionTraitKeys[0]),
          echoTraitOption(optionTraitKeys[1]),
          echoTraitOption(optionTraitKeys[2]),
        ],
        deathDefianceConditionMet,
      );
      const candidateArtifacts = createTraitOfferCandidateArtifacts(
        catalog,
        new Map([
          [
            semanticAddressKey(echoOwner),
            [
              Object.freeze({
                before: createTraitHistoryState(),
                context: Object.freeze({
                  resolvedProviderKey: 'Echo',
                  deathDefianceConditionMet,
                }),
              }),
            ],
          ],
        ]),
      );
      expect(
        (['option1', 'option2', 'option3'] as const).map((optionKey) =>
          evaluateTraitOfferFocusedOptionCandidate(
            catalog,
            project,
            evaluation,
            candidateArtifacts,
            { kind: 'traitOfferFocusedOption', trait: echoOwner, value, optionKey },
          ),
        ),
      ).toEqual([
        expect.objectContaining({ result: expect.objectContaining({ supported: true }) }),
        expect.objectContaining({ result: expect.objectContaining({ supported: true }) }),
        expect.objectContaining({ result: expect.objectContaining({ supported: true }) }),
      ]);
    },
  );

  it('marks Survive unavailable, without affecting the three unconditional identities', () => {
    const project = createGoldenFGHProject();
    const evaluation = simulateProjectAssembly(catalog, project).evaluation;
    const value = echoOffer('option1', [
      { traitKey: 'EchoDeathDefianceRefill', rarity: 'Common' },
      { traitKey: 'DiminishingDodgeBoon', rarity: 'Common' },
      { traitKey: 'DiminishingHealthAndManaBoon', rarity: 'Common' },
    ]);
    const candidateArtifacts = createTraitOfferCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(echoOwner),
          [
            Object.freeze({
              before: createTraitHistoryState(),
              context: Object.freeze({
                resolvedProviderKey: 'Echo',
                deathDefianceConditionMet: false,
              }),
            }),
          ],
        ],
      ]),
    );
    const survive = evaluateTraitOfferFocusedOptionCandidate(
      catalog,
      project,
      evaluation,
      candidateArtifacts,
      { kind: 'traitOfferFocusedOption', trait: echoOwner, value, optionKey: 'option1' },
    );
    expect(survive).toMatchObject({
      kind: 'traitOfferFocusedOption',
      result: { supported: false },
    });
  });

  it('settles an explicit empty-domain Pom as a legal outer-only no-op', () => {
    const project = createGoldenFGHProject();
    const evaluation = simulateProjectAssembly(catalog, project).evaluation;
    const value = echoOffer('option1', [
      { traitKey: 'EchoDoubleLevelBoon', rarity: 'Common', echoPomTarget: null },
      { traitKey: 'DiminishingDodgeBoon', rarity: 'Common' },
      { traitKey: 'DiminishingHealthAndManaBoon', rarity: 'Common' },
    ]);
    const candidateArtifacts = createTraitOfferCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(echoOwner),
          [
            Object.freeze({
              before: createTraitHistoryState(),
              context: Object.freeze({ resolvedProviderKey: 'Echo' }),
            }),
          ],
        ],
      ]),
    );
    expect(
      evaluateEchoPomTargetDomain(catalog, project, evaluation, candidateArtifacts, {
        kind: 'echoPomTargetDomain',
        trait: echoOwner,
        value,
        optionKey: 'option1',
      }),
    ).toEqual({
      kind: 'echoPomTargetDomain',
      result: { traitKeys: [], emptyNoOpAllowed: true },
    });
    const findings = new Map();
    const result = processEncounterTraitOffer(
      catalog,
      baseBranch(),
      echoOwner.owner,
      value,
      10,
      'encounterCompleted',
      findings,
    );
    expect(result.traitHistory?.equippedTraits.EchoDoubleLevelBoon).toMatchObject({
      rarity: 'Common',
    });
    expect(result.traitHistory?.events.map((event) => event.kind)).toEqual(['traitOffer']);
    expect(findings.size).toBe(0);
  });

  it.each([
    ['DiminishingDodgeBoon', false],
    ['DiminishingHealthAndManaBoon', false],
    ['EchoDeathDefianceRefill', true],
    ['EchoDoubleLevelBoon', false],
  ] as const)('retains %s as a fixed-Common outer acquisition', (traitKey, dd) => {
    const siblingKeys = [
      'DiminishingDodgeBoon',
      'DiminishingHealthAndManaBoon',
      'EchoDoubleLevelBoon',
    ]
      .filter((key) => key !== traitKey)
      .slice(0, 2);
    if (siblingKeys[0] === undefined || siblingKeys[1] === undefined)
      throw new Error('Echo test offer requires two siblings');
    const findings = new Map();
    const result = processEncounterTraitOffer(
      catalog,
      baseBranch(),
      echoOwner.owner,
      echoOffer(
        'option1',
        [
          echoTraitOption(traitKey),
          echoTraitOption(siblingKeys[0]),
          echoTraitOption(siblingKeys[1]),
        ],
        dd,
      ),
      10,
      'encounterCompleted',
      findings,
    );
    expect(result.traitHistory?.equippedTraits[traitKey]).toMatchObject({
      traitKey,
      giverKey: 'Echo',
      rarity: 'Common',
    });
    expect(findings.size).toBe(0);
  });

  it('rejects Survive when its source-local DD condition is false', () => {
    const findings = new Map();
    const result = processEncounterTraitOffer(
      catalog,
      baseBranch(),
      echoOwner.owner,
      echoOffer('option1', [
        { traitKey: 'EchoDeathDefianceRefill', rarity: 'Common' },
        { traitKey: 'DiminishingDodgeBoon', rarity: 'Common' },
        { traitKey: 'DiminishingHealthAndManaBoon', rarity: 'Common' },
      ]),
      10,
      'encounterCompleted',
      findings,
    );
    expect(result.traitHistory?.equippedTraits.EchoDeathDefianceRefill).toBeUndefined();
    expect([...findings.values()].map((entry) => entry.finding.code)).toContain('offerContext');
  });

  it('offers only greatest-level Pom ties and doubles the selected current level', () => {
    const history = priorLeveledTraits();
    const offer = echoOffer('option1', [
      { traitKey: 'EchoDoubleLevelBoon', rarity: 'Common', echoPomTarget: 'ZeusWeaponBoon' },
      { traitKey: 'DiminishingDodgeBoon', rarity: 'Common' },
      { traitKey: 'DiminishingHealthAndManaBoon', rarity: 'Common' },
    ]);
    const capability = createTraitOfferCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(echoOwner),
          [
            Object.freeze({
              before: history,
              context: Object.freeze({ resolvedProviderKey: 'Echo' }),
            }),
          ],
        ],
      ]),
    ).at(echoOwner);
    expect(capability?.echoPomTargets(offer, 'option1')).toEqual([
      ['ApolloWeaponBoon', 'ZeusWeaponBoon'],
    ]);

    const result = processEncounterTraitOffer(
      catalog,
      baseBranch(history),
      echoOwner.owner,
      offer,
      10,
      'encounterCompleted',
    );
    expect(result.traitHistory?.equippedTraits.ZeusWeaponBoon?.level).toBe(6);
    expect(result.traitHistory?.equippedTraits.ApolloWeaponBoon?.level).toBe(3);
    expect(result.traitHistory?.equippedTraits.HestiaWeaponBoon?.level).toBe(2);
    expect(result.traitHistory?.equippedTraits.EchoDoubleLevelBoon).toBeDefined();
    expect(result.traitHistory?.events.slice(-2).map((event) => event.kind)).toEqual([
      'traitOffer',
      'levelMutation',
    ]);
  });

  it.each([
    ['missing', undefined, 'echoPomTargetMissing'],
    ['false no-target', null, 'echoPomNoTargetUnavailable'],
    ['lower-level target', 'HestiaWeaponBoon', 'echoPomTargetUnavailable'],
  ] as const)('retains the outer Pom acquisition for a %s child', (_label, target, code) => {
    const history = priorLeveledTraits();
    const findings = new Map();
    const option = {
      traitKey: 'EchoDoubleLevelBoon',
      rarity: 'Common' as const,
      ...(target === undefined ? {} : { echoPomTarget: target }),
    };
    const result = processEncounterTraitOffer(
      catalog,
      baseBranch(history),
      echoOwner.owner,
      echoOffer('option1', [
        option,
        { traitKey: 'DiminishingDodgeBoon', rarity: 'Common' },
        { traitKey: 'DiminishingHealthAndManaBoon', rarity: 'Common' },
      ]),
      10,
      'encounterCompleted',
      findings,
    );
    expect(result.traitHistory?.equippedTraits.EchoDoubleLevelBoon).toBeDefined();
    expect(result.traitHistory?.equippedTraits.HestiaWeaponBoon?.level).toBe(2);
    expect([...findings.values()].map((entry) => entry.finding.code)).toContain(code);
  });

  it('binds the real H Bridge offer, preserves its strict child through codec, and publishes Run State', () => {
    let project = createGoldenFGHProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenHBiome, {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId('golden-h-combat09'),
      }),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    const bridge = project.routes
      .find((route) => route.routeKey === 'Underworld')!
      .biomes.find((biome) => biome.biomeKey === 'H')!
      .topology!.occurrences.find((occurrence) => occurrence.occurrenceId === bridgeId)!;
    const offer = bridge.encounters.traitOffersByPhase?.Encounter?.Story_Echo_01;
    expect(offer).toEqual({
      kind: 'traits',
      giverKey: 'Echo',
      options: [
        { traitKey: 'DiminishingDodgeBoon', rarity: 'Common' },
        { traitKey: 'DiminishingHealthAndManaBoon', rarity: 'Common' },
        { traitKey: 'EchoDoubleLevelBoon', rarity: 'Common', echoPomTarget: null },
      ],
      selectedOptionKey: 'option1',
      rarificationActions: [],
      deathDefianceConditionMet: false,
    });
    const decoded = decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog);
    expect(decoded.schemaVersion).toBe(31);
    const assembly = simulateProjectAssembly(catalog, decoded);
    const h = assembly.evaluation.routes
      .find((route) => route.routeKey === 'Underworld')!
      .biomes.find((biome) => biome.biomeKey === 'H')!;
    if (!('rewards' in h)) throw new Error('H must be evaluated');
    expect(
      h.rewards.runStateSnapshots.some(
        (snapshot) => snapshot.traits.equippedTraits.DiminishingDodgeBoon !== undefined,
      ),
    ).toBe(true);
    if (offer?.kind !== 'traits') throw new Error('Echo offer must be traits');
    expect(
      createPreparedProjectCandidateSession(catalog, assembly).evaluate({
        kind: 'echoPomTargetDomain',
        trait: echoOwner,
        value: offer,
        optionKey: 'option3',
      }).kind,
    ).toBe('echoPomTargetDomain');
  });

  it('rejects unknown and non-Pom encoded Echo target children', () => {
    const project = createGoldenFGHProject();
    const unknownDocument = JSON.parse(encodeProjectDocument(project)) as JsonRecord;
    const unknownOffer = echoOfferInDocument(unknownDocument);
    const unknownOptions = unknownOffer.options as JsonRecord[];
    unknownOptions[2]!.echoPomTarget = 'UnknownTrait';
    expect(() => decodeProjectDocument(unknownDocument, catalog)).toThrow(
      'unknown trait UnknownTrait',
    );

    const misplaced = JSON.parse(encodeProjectDocument(project)) as JsonRecord;
    const misplacedOffer = echoOfferInDocument(misplaced);
    (misplacedOffer.options as JsonRecord[])[0]!.echoPomTarget = null;
    expect(() => decodeProjectDocument(misplaced, catalog)).toThrow(
      'is supported only by Echo Pom',
    );

    const malformed = JSON.parse(encodeProjectDocument(project)) as JsonRecord;
    const malformedOffer = echoOfferInDocument(malformed);
    (malformedOffer.options as JsonRecord[])[2]!.echoPomTarget = 7;
    expect(() => decodeProjectDocument(malformed, catalog)).toThrow('must be a trait key or null');
  });

  it('retains the real H invalid Pom outer checkpoint and excludes later state', () => {
    let project = createGoldenFGHProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenHBiome, {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId('golden-h-combat09'),
      }),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    const bridge = project.routes[0]!.biomes.find(
      (biome) => biome.biomeKey === 'H',
    )!.topology!.occurrences.find((occurrence) => occurrence.occurrenceId === bridgeId)!;
    const offer = bridge.encounters.traitOffersByPhase?.Encounter?.Story_Echo_01;
    if (offer?.kind !== 'traits') throw new Error('Echo offer must be traits');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: echoOwner,
      value: Object.freeze({
        ...offer,
        selectedOptionKey: 'option3',
        options: Object.freeze([
          offer.options[0],
          offer.options[1],
          Object.freeze({ ...offer.options[2], echoPomTarget: 'ZeusWeaponBoon' }),
        ]) as AuthoredTraitOfferTraits['options'],
      }),
    });
    const h = simulateProjectAssembly(catalog, project).evaluation.routes[0]!.biomes.find(
      (biome) => biome.biomeKey === 'H',
    )!;
    if (!('rewards' in h)) throw new Error('H must be evaluated');
    const child = createEchoPomTargetAddress(echoOwner, 'option3');
    expect(h.coverage).toMatchObject({ kind: 'prefix', blockedAt: child });
    expect(h.rewards.branches).toHaveLength(1);
    expect(h.rewards.branches[0]?.traitHistory?.equippedTraits).toMatchObject({
      ApolloWeaponBoon: { level: 3 },
      EchoDoubleLevelBoon: { rarity: 'Common' },
    });
    expect(h.rewards.branches[0]?.traitHistory?.equippedTraits.ZeusWeaponBoon).toBeUndefined();
    expect(h.findings).toContainEqual(
      expect.objectContaining({ code: 'echoPomTargetUnavailable', origin: child }),
    );
    const echoSnapshots = h.rewards.runStateSnapshots.filter(
      (snapshot) => snapshot.traits.equippedTraits.EchoDoubleLevelBoon?.rarity === 'Common',
    );
    expect(echoSnapshots).toHaveLength(1);
    expect(echoSnapshots[0]?.owner).toMatchObject({
      kind: 'exitDecision',
      source: { kind: 'occurrence', occurrenceId: bridgeId },
    });
    expect(
      h.rewards.runStateAvailability.some((entry) => entry.availability === 'unavailable'),
    ).toBe(true);
    expect(
      project.routes[0]!.biomes.find((biome) => biome.biomeKey === 'H')!.topology!.occurrences.some(
        (occurrence) => occurrence.occurrenceId === 'golden-h-combat05',
      ),
    ).toBe(true);
    expect(
      h.rewards.branches[0]?.events.some(
        (event) =>
          'occurrenceId' in event.origin && event.origin.occurrenceId === 'golden-h-combat05',
      ),
    ).toBe(false);
  });
});
