import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createAcquisitionSiteAddress,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomActionAddress,
  roomActionKey,
  semanticAddressKey,
  type ProjectCommand,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  createPreparedProjectCandidateSession,
  eliteChallengeAttributeOptions,
  goldLedgerForProjectEvaluationAssembly,
  roomObjectInteractionsForProjectEvaluationAssembly,
  simulateProject,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { loadSurfaceNOPQCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import { loadUnderworldFGHICheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';

import {
  assessChallengeSwitchEntry,
  challengeSwitchPlacementIssues,
  type ChallengeSwitchEntryFacts,
} from '../../src/simulation/commerce/challenge-switch';
import type { RequirementEvaluationContext } from '../../src/requirements/evaluator';
import { assembleExecutionProduct, compileExecutionPlan } from '../../src/execution-plan';
import { decodeExecutionPlan, encodeExecutionPlan } from '../../src/execution-plan';

const interaction = Object.freeze({ kind: 'interactChallengeSwitch' as const });

let cached: ProjectDocument | undefined;
const golden = () => (cached ??= loadUnderworldFGHICheckpoint());
let cachedSurface: ProjectDocument | undefined;
const surface = () => (cachedSurface ??= loadSurfaceNOPQCheckpoint());

function occurrence(project: ProjectDocument, biomeKey: string, occurrenceId: string) {
  return project.route.biomes
    .find((plan) => plan.biomeKey === biomeKey)!
    .topology!.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId)!;
}

/** Observes a switch and, when `used`, appends its interaction (with its claim pickups). */
function withSwitch(
  project: ProjectDocument,
  biomeKey: string,
  occurrenceId: string,
  variantKey: string,
  options: { readonly used?: boolean; readonly outcome?: Partial<ProjectCommand> } = {},
): ProjectDocument {
  const biome = createBiomeAddress(project.route.routeKey, biomeKey);
  const id = createOccurrenceId(occurrenceId);
  let next = applyProjectCommand(project, catalog, {
    kind: 'ReplaceChallengeSwitch',
    occurrence: createOccurrenceAddress(biome, id),
    variantKey,
  });
  if (options.used === true)
    next = applyProjectCommand(next, catalog, {
      kind: 'InsertRoomAction',
      action: createRoomActionAddress(biome, id, roomActionKey(interaction)),
      reference: interaction,
      index: occurrence(next, biomeKey, occurrenceId).roomActions.order.length,
    });
  if (options.outcome !== undefined)
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceChallengeSwitchOutcome',
      occurrence: createOccurrenceAddress(biome, id),
      hitless: true,
      nectarDropped: false,
      ...options.outcome,
    } as ProjectCommand);
  return next;
}

function placementIssues(project: ProjectDocument) {
  return simulateProject(catalog, project)
    .findings.filter((finding) => finding.code === 'challengeSwitchPlacementUnavailable')
    .map((finding) => ({
      occurrenceId: finding.origin.kind === 'roomFeature' ? finding.origin.occurrenceId : undefined,
      ...finding.evidence,
    }));
}

function exitSnapshot(project: ProjectDocument, occurrenceId: string) {
  const result = simulateProject(catalog, project);
  for (const biome of result.route.biomes) {
    if (!('rewards' in biome)) continue;
    const snapshot = biome.rewards.runStateSnapshots.find(
      (candidate) =>
        candidate.checkpoint === 'beforeRoomExit' &&
        semanticAddressKey(candidate.owner).includes(`"${occurrenceId}"`),
    );
    if (snapshot !== undefined) return snapshot;
  }
  throw new Error(`${occurrenceId} exit was not reached`);
}

/** The claim acquisitions the published plan carries for one room. */
function claimAcquisitions(project: ProjectDocument): readonly string[] {
  const assembly = simulateProjectAssembly(catalog, project);
  const plan = compileExecutionPlan({ product: assembleExecutionProduct({ assembly, catalog }) });
  expect(decodeExecutionPlan(JSON.parse(encodeExecutionPlan(plan)))).toEqual(plan);
  const found: string[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value !== null && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      if (record.kind === 'acquisition' && record.producerLifecycleKey === 'ChallengeSwitchLoot')
        found.push((record.reward as { rewardType: string }).rewardType);
      Object.values(record).forEach(visit);
    }
  };
  visit(plan);
  return found;
}

describe('challenge switch spawn rules', () => {
  it('accepts a switch at biome depth five with a free anchor', () => {
    expect(
      placementIssues(
        withSwitch(golden(), 'F', 'golden-f-b5-e1', 'PerfectClearChallengeSwitch_Pom'),
      ),
    ).toEqual([]);
  });

  it('reports a switch before biome depth five', () => {
    expect(
      placementIssues(withSwitch(golden(), 'F', 'golden-f-b1-e1', 'TimeChallengeSwitch_Money')),
    ).toEqual([
      {
        occurrenceId: 'golden-f-b1-e1',
        reason: 'biomeDepth',
        biomeDepthCache: 1,
        minimumBiomeDepth: 5,
      },
    ]);
  });

  it('reports a switch within three rooms of the last one, counted from entry', () => {
    const first = withSwitch(golden(), 'F', 'golden-f-b5-e1', 'TimeChallengeSwitch_Money');
    expect(
      placementIssues(withSwitch(first, 'F', 'golden-f-b7-e1', 'TimeChallengeSwitch_Money')),
    ).toEqual([
      {
        occurrenceId: 'golden-f-b7-e1',
        reason: 'recentSwitch',
        roomsSinceLast: 2,
        minimumRoomsSinceLast: 3,
      },
    ]);
    // An unused switch still sets the spacing; three rooms later is eligible.
    expect(
      placementIssues(withSwitch(first, 'F', 'golden-f-b8-e1', 'TimeChallengeSwitch_Money')),
    ).toEqual([]);
  });

  it('reports a switch whose only anchor a Stygian Well already took', () => {
    const address = createOccurrenceAddress(
      createBiomeAddress('Underworld', 'H'),
      createOccurrenceId('golden-h-combat05'),
    );
    const switchOnly = withSwitch(golden(), 'H', 'golden-h-combat05', 'TimeChallengeSwitch_Money');
    expect(placementIssues(switchOnly)).toEqual([]);
    const withWell = applyProjectCommand(switchOnly, catalog, {
      kind: 'AddStygianWell',
      occurrence: address,
    });
    expect(placementIssues(withWell)).toEqual([
      {
        occurrenceId: 'golden-h-combat05',
        reason: 'noFreeAnchor',
        anchorCount: 1,
        occupants: ['stygianWell'],
      },
    ]);
  });

  it('reports an Elite switch whose kind gate (TalentLegal) fails', () => {
    expect(
      placementIssues(withSwitch(golden(), 'F', 'golden-f-b5-e1', 'EliteChallengeSwitch_MaxMana')),
    ).toEqual([{ occurrenceId: 'golden-f-b5-e1', reason: 'kindUnavailable', switchKind: 'elite' }]);
  });

  it('reports a Pom switch with no upgradable trait', () => {
    const facts = (upgradableTraitCount: number): ChallengeSwitchEntryFacts => ({
      biomeDepthCache: 6,
      appearances: [{}, {}],
      occupants: [],
      requirements: {
        counters: { upgradableTraitCount },
        records: { useRecord: {} },
        currentRoomShopOptionNames: new Set<string>(),
        flags: { allSpellInvested: false },
      } as unknown as RequirementEvaluationContext,
    });
    const assess = (count: number) =>
      challengeSwitchPlacementIssues(
        catalog,
        assessChallengeSwitchEntry(catalog, 2, facts(count)),
        { variantKey: 'PerfectClearChallengeSwitch_Pom', hitless: true, nectarDropped: false },
      );
    expect(assess(0)).toEqual([
      { reason: 'variantUnavailable', variantKey: 'PerfectClearChallengeSwitch_Pom' },
    ]);
    expect(assess(1)).toEqual([]);
  });
});

describe('challenge switch claims', () => {
  it('claims a hitless PerfectClear Max Health without an encounter end or store draw', () => {
    const observed = withSwitch(
      golden(),
      'F',
      'golden-f-b5-e1',
      'PerfectClearChallengeSwitch_MaxHealth',
    );
    const used = withSwitch(
      golden(),
      'F',
      'golden-f-b5-e1',
      'PerfectClearChallengeSwitch_MaxHealth',
      {
        used: true,
      },
    );
    expect(simulateProject(catalog, used).status).toBe('valid');
    const before = exitSnapshot(observed, 'golden-f-b5-e1');
    const after = exitSnapshot(used, 'golden-f-b5-e1');
    expect(after.maxStats.maxHealth - before.maxStats.maxHealth).toBe(25);
    // The claim spawns its reward directly: no counted store moves.
    expect(after.rewardStores).toEqual(before.rewardStores);
    expect(after.bags).toEqual(before.bags);
    const fBiome = simulateProject(catalog, used).route.biomes.find(
      (biome) => biome.biomeKey === 'F',
    );
    if (fBiome === undefined || !('history' in fBiome)) throw new Error('F was not evaluated');
    const events = fBiome.history.events.filter(
      (event) =>
        'origin' in event &&
        event.origin.kind === 'occurrence' &&
        event.origin.occurrenceId === 'golden-f-b5-e1',
    );
    const kinds = events.map((event) => event.kind);
    const claim = kinds.indexOf('challengeSwitchInteracted');
    expect(claim).toBeGreaterThan(kinds.indexOf('outgoingGenerationCheckpoint'));
    // Not an encounter end: no further encounter completion or end effects follow it.
    expect(
      kinds
        .slice(claim)
        .filter(
          (kind) =>
            kind === 'encounterCompleted' ||
            kind === 'encounterEndEffectsApplied' ||
            kind === 'offerPointAcquired',
        ),
    ).toEqual([]);
    expect(claimAcquisitions(used)).toEqual(['MaxHealthDrop']);
  });

  it('claims the Onion after a PerfectClear hit, and a bonus Nectar only when hitless', () => {
    const hit = withSwitch(
      golden(),
      'F',
      'golden-f-b5-e1',
      'PerfectClearChallengeSwitch_MaxHealth',
      {
        used: true,
        outcome: { hitless: false },
      },
    );
    expect(simulateProject(catalog, hit).status).toBe('valid');
    expect(claimAcquisitions(hit)).toEqual(['RoomRewardConsolationPrize']);
    const nectar = withSwitch(
      golden(),
      'F',
      'golden-f-b5-e1',
      'PerfectClearChallengeSwitch_MaxHealth',
      { used: true, outcome: { nectarDropped: true } },
    );
    expect(simulateProject(catalog, nectar).status).toBe('valid');
    expect(claimAcquisitions(nectar)).toEqual(['MaxHealthDrop', 'GiftDrop']);
  });

  it('claims an Elite Max Magick, which a hit does not change', () => {
    // The Surface route holds Selene by P, so TalentLegal admits the Elite kind.
    const observed = withSwitch(
      surface(),
      'P',
      'surface-p-6-1-p_combat10',
      'EliteChallengeSwitch_MaxMana',
    );
    expect(placementIssues(observed)).toEqual([]);
    const used = withSwitch(
      surface(),
      'P',
      'surface-p-6-1-p_combat10',
      'EliteChallengeSwitch_MaxMana',
      {
        used: true,
        outcome: { hitless: false },
      },
    );
    expect(simulateProject(catalog, used).status).toBe('valid');
    expect(
      exitSnapshot(used, 'surface-p-6-1-p_combat10').maxStats.maxMana -
        exitSnapshot(observed, 'surface-p-6-1-p_combat10').maxStats.maxMana,
    ).toBeGreaterThan(0);
    expect(claimAcquisitions(used)).toEqual(['MaxManaDrop']);
  });

  it('opens an Elite Path of Stars claim as its ordinary Path screen', () => {
    const used = withSwitch(
      surface(),
      'P',
      'surface-p-6-1-p_combat10',
      'EliteChallengeSwitch_Talent',
      {
        used: true,
      },
    );
    const result = simulateProject(catalog, used);
    expect(result.status).toBe('incomplete');
    expect(result.findings.map((finding) => finding.code)).toEqual(['hexActivationMissing']);
  });

  it('claims Time gold as a pickup whatever the hit', () => {
    const used = withSwitch(golden(), 'F', 'golden-f-b8-e1', 'TimeChallengeSwitch_Money', {
      used: true,
      outcome: { hitless: false, gold: 35 },
    });
    expect(simulateProject(catalog, used).status).toBe('valid');
    expect(occurrence(used, 'F', 'golden-f-b8-e1').challengeSwitch?.gold).toBe(35);
    expect(claimAcquisitions(used)).toEqual(['Money']);
    // The gold ledger pays the authored value at the claim pickup.
    const room = goldLedgerForProjectEvaluationAssembly(
      catalog,
      simulateProjectAssembly(catalog, used),
    ).roomAt(
      createOccurrenceAddress(
        createBiomeAddress('Underworld', 'F'),
        createOccurrenceId('golden-f-b8-e1'),
      ),
    );
    if (room.availability !== 'available') throw new Error(`room is ${room.reason}`);
    expect(
      room.room.gains
        .filter((gain) => gain.kind === 'challengeSwitchGold')
        .map((gain) => gain.amount?.mean),
    ).toEqual([35]);
  });

  it('leaves an observed but unused switch without claim actions or acquisitions', () => {
    const observed = withSwitch(golden(), 'F', 'golden-f-b5-e1', 'TimeChallengeSwitch_Money');
    expect(simulateProject(catalog, observed).status).toBe('valid');
    expect(claimAcquisitions(observed)).toEqual([]);
  });

  it('lets pickup effects treat the consumable claims as usual and the gold gush as no consumable', () => {
    const conversion = (variantKey: string) => {
      const project = withSwitch(golden(), 'F', 'golden-f-b8-e1', variantKey, { used: true });
      const source = createAcquisitionRoleAddress(
        createAcquisitionEntryAddress(
          createAcquisitionSiteAddress(
            createOccurrenceAddress(
              createBiomeAddress('Underworld', 'F'),
              createOccurrenceId('golden-f-b8-e1'),
            ),
            'challengeSwitch',
          ),
          'reward',
        ),
        'self',
      );
      return createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, project),
      ).evaluate({ kind: 'acquisitionConversion', acquisition: source });
    };
    // Sea Star needs the boon; the claim itself is duplicable and convertible.
    expect(conversion('PerfectClearChallengeSwitch_MaxHealth')).toMatchObject({
      kind: 'acquisitionConversion',
      result: {
        unsupportedEvidence: expect.arrayContaining([
          expect.objectContaining({ canDuplicate: true, blocksSeaStarDuplication: false }),
        ]),
      },
    });
    expect(conversion('TimeChallengeSwitch_Money')).toMatchObject({
      kind: 'acquisitionConversion',
      result: {
        timePieceConvertible: false,
        unsupportedEvidence: expect.arrayContaining([
          expect.objectContaining({ canDuplicate: false }),
        ]),
      },
    });
  });
});

describe('challenge switch variant query', () => {
  const at = (project: ProjectDocument, biomeKey: string, occurrenceId: string) =>
    roomObjectInteractionsForProjectEvaluationAssembly(
      simulateProjectAssembly(catalog, project),
      createOccurrenceAddress(
        createBiomeAddress(project.route.routeKey, biomeKey),
        createOccurrenceId(occurrenceId),
      ),
    )?.challengeSwitch;
  const rollable = (project: ProjectDocument, biomeKey: string, occurrenceId: string) =>
    at(project, biomeKey, occurrenceId)
      ?.variants.filter((variant) => variant.rollable)
      .map((variant) => variant.variantKey);

  it('offers every host its rollable variants at entry, before any switch is observed', () => {
    expect(rollable(golden(), 'F', 'golden-f-b5-e1')).toEqual([
      'TimeChallengeSwitch_Money',
      'PerfectClearChallengeSwitch_Pom',
      'PerfectClearChallengeSwitch_MaxHealth',
    ]);
    expect(
      at(golden(), 'F', 'golden-f-b5-e1')?.variants.find(
        (variant) => variant.variantKey === 'EliteChallengeSwitch_Talent',
      ),
    ).toMatchObject({
      rollable: false,
      lock: 'kindUnavailable',
      command: { kind: 'ReplaceChallengeSwitch', variantKey: 'EliteChallengeSwitch_Talent' },
    });
    expect(rollable(surface(), 'P', 'surface-p-6-1-p_combat10')).toEqual(
      catalog.challengeSwitches.variants.values.map((variant) => variant.key),
    );
    // A room that cannot host a switch has no switch product.
    expect(at(golden(), 'F', 'golden-f-start')).toBeUndefined();
  });

  it('offers nothing where a shared spawn rule breaks', () => {
    const early = at(golden(), 'F', 'golden-f-b1-e1');
    expect(early?.sharedIssues).toEqual([
      { reason: 'biomeDepth', biomeDepthCache: 1, minimumBiomeDepth: 5 },
    ]);
    expect(early?.variants.some((variant) => variant.rollable)).toBe(false);
    const spaced = withSwitch(golden(), 'F', 'golden-f-b5-e1', 'TimeChallengeSwitch_Money');
    expect(rollable(spaced, 'F', 'golden-f-b7-e1')).toEqual([]);
  });
});

describe('Elite switch elite', () => {
  const pin = (project: ProjectDocument, enemyKey: string, attributeKeys: string[]) =>
    applyProjectCommand(project, catalog, {
      kind: 'ReplaceChallengeSwitchElite',
      occurrence: createOccurrenceAddress(
        createBiomeAddress('Surface', 'P'),
        createOccurrenceId('surface-p-6-1-p_combat10'),
      ),
      elite: { enemyKey, attributeKeys },
    });
  const observed = () =>
    withSwitch(surface(), 'P', 'surface-p-6-1-p_combat10', 'EliteChallengeSwitch_MaxMana');
  const eliteIssues = (project: ProjectDocument) =>
    simulateProject(catalog, project)
      .findings.filter((finding) => finding.code === 'challengeSwitchEliteUnavailable')
      .map((finding) => finding.evidence);

  it('accepts an elite of the RoomSet with two attributes it can draw', () => {
    expect(eliteIssues(pin(observed(), 'Dragon_Elite', ['Frenzy', 'Blink']))).toEqual([]);
  });

  it('reports an elite outside the set and attributes the forced draw cannot take', () => {
    expect(eliteIssues(pin(observed(), 'Brute_Elite', []))).toEqual([
      { reason: 'enemyNotInSet', enemyKey: 'Brute_Elite' },
    ]);
    // Metallic is banned for the challenge; Vacuuming is excluded once Frenzy is drawn.
    expect(eliteIssues(pin(observed(), 'Dragon_Elite', ['Metallic', 'Blink']))).toEqual([
      { reason: 'attributeUnavailable', attributeKey: 'Metallic' },
    ]);
    expect(eliteIssues(pin(observed(), 'Dragon_Elite', ['Frenzy', 'Vacuuming']))).toEqual([
      { reason: 'attributeExcluded', attributeKey: 'Vacuuming' },
    ]);
    // Rooting is drawn only in F and H.
    expect(eliteIssues(pin(observed(), 'Dragon_Elite', ['Rooting']))).toEqual([
      { reason: 'attributeUnavailable', attributeKey: 'Rooting' },
    ]);
  });

  it('publishes each elite of the RoomSet with its first-draw attributes, narrowed per draw', () => {
    const product = roomObjectInteractionsForProjectEvaluationAssembly(
      simulateProjectAssembly(catalog, surface()),
      createOccurrenceAddress(
        createBiomeAddress('Surface', 'P'),
        createOccurrenceId('surface-p-6-1-p_combat10'),
      ),
    )?.challengeSwitch?.elite;
    expect(product).toMatchObject({
      encounterKey: 'EliteChallengeP',
      roomSetKey: 'P',
      attributeCount: 2,
    });
    expect(product?.enemies.map((enemy) => enemy.enemyKey)).toEqual([
      'SatyrSapper_Elite',
      'Dragon_Elite',
      'AutomatonEnforcer_Elite',
      'AutomatonBeamer_Elite',
    ]);
    const dragon = product!.enemies.find((enemy) => enemy.enemyKey === 'Dragon_Elite')!;
    expect(dragon.attributeKeys).toContain('Frenzy');
    expect(dragon.attributeKeys).not.toContain('Metallic');
    expect(dragon.attributeKeys).not.toContain('Rooting');
    const encounter = catalog.challengeSwitches.eliteEncounters.byKey.EliteChallengeP!;
    const second = eliteChallengeAttributeOptions(encounter, 'Dragon_Elite', 'P', ['Frenzy']);
    expect(second).not.toContain('Frenzy');
    expect(second).not.toContain('Vacuuming');
    expect(dragon.attributeKeys).toContain('Vacuuming');
    expect(
      eliteChallengeAttributeOptions(encounter, 'Dragon_Elite', 'P', ['Frenzy', 'Blink']),
    ).toEqual([]);
    expect(product?.attributeLabels.Frenzy).toBe('Swifter');
  });
});
