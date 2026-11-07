import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  decodeProjectDocument,
  encodeProjectDocument,
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createAcquisitionSiteAddress,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomActionAddress,
  roomActionKey,
  semanticAddressKey,
  type ProjectCommand,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  challengeSwitchEncounterSupportForProjectEvaluationAssembly,
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
import { checkedGoldFights } from '../support/gold-fights';

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
  const current = occurrence(next, biomeKey, occurrenceId).challengeSwitch!;
  if (options.outcome !== undefined)
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceChallengeSwitchOutcome',
      occurrence: createOccurrenceAddress(biome, id),
      outcome: current.outcome,
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
  expect(assembly.evaluation.route.summary.eligibleForExecutionPlan).toBe(true);
  const plan = compileExecutionPlan({
    product: assembleExecutionProduct({ assembly, catalog }),
  });
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

  it("accepts a Fields switch from biome depth one, its RoomSet's own floor", () => {
    expect(
      placementIssues(withSwitch(golden(), 'H', 'golden-h-combat02', 'TimeChallengeSwitch_Money')),
    ).toEqual([]);
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

  it('counts each surface map’s own anchors when a Shrine shares the room', () => {
    const anchorIssues = (biomeKey: string, occurrenceId: string) => {
      const observed = withSwitch(surface(), biomeKey, occurrenceId, 'TimeChallengeSwitch_Money');
      const shrine = applyProjectCommand(observed, catalog, {
        kind: 'SetHermesShrinePresence',
        occurrence: createOccurrenceAddress(
          createBiomeAddress(observed.route.routeKey, biomeKey),
          createOccurrenceId(occurrenceId),
        ),
        present: true,
      });
      return placementIssues(shrine).filter(
        (issue) =>
          issue.occurrenceId === occurrenceId &&
          'reason' in issue &&
          issue.reason === 'noFreeAnchor',
      );
    };
    // Two `ChallengeSwitchBase` anchors: O_Combat02, P_Combat12, Q_Combat10.
    for (const [biomeKey, occurrenceId] of [
      ['O', 'surface-o-combat02'],
      ['P', 'surface-p-8-1-p_combat12'],
      ['Q', 'surface-q-foyer'],
    ] as const)
      expect(anchorIssues(biomeKey, occurrenceId)).toEqual([]);
    // One anchor: O_Combat07, P_Combat03, Q_Combat01.
    for (const [biomeKey, occurrenceId] of [
      ['O', 'surface-o-combat07'],
      ['P', 'surface-p-1-1-p_combat03'],
      ['Q', 'surface-q-ordinary'],
    ] as const)
      expect(anchorIssues(biomeKey, occurrenceId)).toEqual([
        { occurrenceId, reason: 'noFreeAnchor', anchorCount: 1, occupants: ['hermesShrine'] },
      ]);
  });

  it('reports an Elite switch whose kind gate (TalentLegal) fails', () => {
    expect(
      placementIssues(withSwitch(golden(), 'F', 'golden-f-b5-e1', 'EliteChallengeSwitch_MaxMana')),
    ).toEqual([
      {
        occurrenceId: 'golden-f-b5-e1',
        reason: 'kindUnavailable',
        switchKind: 'elite',
        gate: { kind: 'requirement' },
      },
    ]);
  });

  it('names an Elite switch’s biome-depth gate before its requirement', () => {
    const issues = simulateProject(
      catalog,
      withSwitch(surface(), 'O', 'surface-o-combat04', 'EliteChallengeSwitch_MaxMana'),
    )
      .findings.filter((finding) => finding.code === 'challengeSwitchPlacementUnavailable')
      .map((finding) => finding.evidence);
    expect(issues).toContainEqual({
      reason: 'kindUnavailable',
      switchKind: 'elite',
      gate: { kind: 'biomeDepth', biomeDepthCache: 2, minimumBiomeDepth: 3 },
    });
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
        assessChallengeSwitchEntry(catalog, { anchorCount: 2, minimumBiomeDepth: 5 }, facts(count)),
        { variantKey: 'PerfectClearChallengeSwitch_Pom', outcome: 'hitless', nectarDropped: false },
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
        outcome: { outcome: 'failed' },
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

  it('claims a finished Elite’s Max Magick', () => {
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
        outcome: { outcome: 'finished' },
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

  it('claims a finished Time switch’s gold as a pickup at the catalog estimate', () => {
    const used = withSwitch(golden(), 'F', 'golden-f-b8-e1', 'TimeChallengeSwitch_Money', {
      used: true,
      outcome: { outcome: 'finished' },
    });
    expect(simulateProject(catalog, used).status).toBe('valid');
    expect(claimAcquisitions(used)).toEqual(['Money']);
    // The gold ledger pays the fixed estimate at the claim pickup and publishes it on the row.
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
    ).toEqual([90]);
    const estimate = { basis: 'timeSwitchClaim', value: 90, range: { min: 10, max: 100 } };
    const claim = room.room.gains.find((gain) => gain.kind === 'challengeSwitchGold');
    expect(claim?.estimate).toEqual(estimate);
    expect(
      room.room.rows.find(
        (row) => semanticAddressKey(row.roomAction) === semanticAddressKey(claim!.roomAction!),
      )?.estimates,
    ).toEqual([estimate]);
  });

  it('sums a switch fight’s kills at its press and leaves the claimed gold on its pickup', () => {
    const used = withSwitch(golden(), 'F', 'golden-f-b8-e1', 'TimeChallengeSwitch_Money', {
      used: true,
      outcome: { outcome: 'finished' },
    });
    const biome = createBiomeAddress('Underworld', 'F');
    const id = createOccurrenceId('golden-f-b8-e1');
    const room = goldLedgerForProjectEvaluationAssembly(
      catalog,
      simulateProjectAssembly(catalog, used),
    ).roomAt(createOccurrenceAddress(biome, id));
    if (room.availability !== 'available') throw new Error(`room is ${room.reason}`);
    const pressRow = createRoomActionAddress(biome, id, roomActionKey(interaction));
    expect(checkedGoldFights(room.room)).toEqual(
      new Map([
        [
          semanticAddressKey(
            createEncounterPhaseAddress(
              biome,
              { kind: 'occurrence', occurrenceId: id },
              'Encounter',
            ),
          ),
          ['enemies'],
        ],
        [semanticAddressKey(pressRow), ['enemies']],
      ]),
    );
    expect(room.room.gains.filter((gain) => gain.kind === 'enemyGold')[1]?.roomAction).toEqual(
      pressRow,
    );
    // The claim is an exact pickup of its own row, outside the fight.
    const claim = room.room.gains.find((gain) => gain.kind === 'challengeSwitchGold');
    expect(claim?.fight).toBeUndefined();
    expect(claim?.roomAction?.actionKey).toBe(
      roomActionKey({
        kind: 'interactAcquisitionEntry',
        siteKey: 'challengeSwitch',
        entryKey: 'reward',
      }),
    );
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

  it('binds each kind’s observation to its default variant, else its first rollable one', () => {
    const kinds = at(golden(), 'F', 'golden-f-b5-e1')?.kinds;
    expect(
      kinds?.map((kind) => [kind.switchKind, kind.observe?.variantKey, kind.lock?.reason]),
    ).toEqual([
      ['time', 'TimeChallengeSwitch_Money', undefined],
      ['perfectClear', 'PerfectClearChallengeSwitch_Pom', undefined],
      ['elite', undefined, 'kindUnavailable'],
    ]);
    // Where a shared spawn rule breaks, no kind can be observed and each names that rule.
    const early = at(golden(), 'F', 'golden-f-b1-e1')?.kinds;
    expect(
      early?.every((kind) => kind.observe === undefined && kind.lock?.reason === 'biomeDepth'),
    ).toBe(true);
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

describe('challenge switch outcome product', () => {
  const fHost = createOccurrenceAddress(
    createBiomeAddress('Underworld', 'F'),
    createOccurrenceId('golden-f-b8-e1'),
  );
  const product = (project: ProjectDocument) =>
    roomObjectInteractionsForProjectEvaluationAssembly(
      simulateProjectAssembly(catalog, project),
      fHost,
    )?.challengeSwitch?.outcome;

  const claims = (interaction: ReturnType<typeof product>) =>
    interaction?.choices.map((choice) => [choice.outcome, choice.nectarDropped]);

  it('publishes each claim the kind allows, Nectar only after a clean fight, with bound commands', () => {
    expect(product(golden())).toBeUndefined();
    const time = withSwitch(golden(), 'F', 'golden-f-b8-e1', 'TimeChallengeSwitch_Money');
    const finished = product(time);
    expect(finished).toMatchObject({ current: 'finished', nectarDropped: false });
    expect(claims(finished)).toEqual([
      ['left', false],
      ['finished', false],
      ['finished', true],
    ]);
    for (const choice of finished!.choices)
      expect(choice.command).toEqual({
        kind: 'ReplaceChallengeSwitchOutcome',
        occurrence: fHost,
        outcome: choice.outcome,
        nectarDropped: choice.nectarDropped,
      });
    const nectar = finished!.choices.find((choice) => choice.nectarDropped)!.command;
    expect(product(applyProjectCommand(time, catalog, nectar))).toMatchObject({
      current: 'finished',
      nectarDropped: true,
    });
    const leave = finished!.choices.find((choice) => choice.outcome === 'left')!.command;
    const left = product(applyProjectCommand(time, catalog, leave));
    expect(left).toMatchObject({ current: 'left', nectarDropped: false });
    // The list is the kind's, whichever claim is current.
    expect(claims(left)).toEqual(claims(finished));
    const perfect = product(
      withSwitch(golden(), 'F', 'golden-f-b8-e1', 'PerfectClearChallengeSwitch_MaxHealth'),
    );
    expect(perfect).toMatchObject({ current: 'hitless', nectarDropped: false });
    expect(claims(perfect)).toEqual([
      ['left', false],
      ['failed', false],
      ['hitless', false],
      ['hitless', true],
    ]);
  });
});

describe('a left switch fight ends its room', () => {
  const fBiome = createBiomeAddress('Underworld', 'F');
  const hostId = createOccurrenceId('golden-f-b8-e1');
  const left = () =>
    withSwitch(golden(), 'F', 'golden-f-b8-e1', 'TimeChallengeSwitch_Money', {
      used: true,
      outcome: { outcome: 'left' },
    });
  const hostRoom = (project: ProjectDocument) => {
    const f = simulateProjectAssembly(catalog, project).evaluation.route!.biomes.find(
      (biome) => biome.biomeKey === 'F',
    );
    if (f === undefined || !('rewards' in f)) throw new Error('F must be evaluated');
    const snapshot = 'snapshot' in f ? f.snapshot : f.materializedPrefix;
    const room = snapshot.decisions
      .filter((decision) => decision.kind === 'batch')
      .flatMap((decision) => decision.targets.map((target) => target.room))
      .find((candidate) => candidate.occurrenceId === hostId);
    if (room?.kind !== 'authored') throw new Error('switch host is missing');
    return room;
  };

  it('offers no insertion or move past a left press', () => {
    const roster = hostRoom(left()).roomActionRoster;
    const pressKey = roomActionKey(interaction);
    const after = (order: readonly { readonly kind: string }[]) =>
      order.length - order.findIndex((reference) => reference.kind === interaction.kind) - 1;
    expect(after(occurrence(left(), 'F', 'golden-f-b8-e1').roomActions.order)).toBe(0);
    const placing = roster.proposals.filter(
      (proposal) => proposal.kind === 'insert' || proposal.kind === 'move',
    );
    expect(placing.every((proposal) => after(proposal.order) === 0)).toBe(true);
    // A finished fight still offers moving the press earlier.
    const finished = hostRoom(
      withSwitch(golden(), 'F', 'golden-f-b8-e1', 'TimeChallengeSwitch_Money', { used: true }),
    ).roomActionRoster;
    expect(
      finished.proposals.some(
        (proposal) => proposal.kind === 'move' && roomActionKey(proposal.reference) === pressKey,
      ),
    ).toBe(true);
  });

  it('takes a Well purchase in before a left press, and reports a preserved one after it', () => {
    const occurrenceAddress = createOccurrenceAddress(fBiome, hostId);
    let project = applyProjectCommand(left(), catalog, {
      kind: 'AddStygianWell',
      occurrence: occurrenceAddress,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: occurrenceAddress,
      generationKey: 'initial:healing',
      purchased: true,
      itemKey: 'ArmorBoostStore',
    });
    const order = occurrence(project, 'F', 'golden-f-b8-e1').roomActions.order;
    expect(order.map((reference) => reference.kind)).toEqual([
      'interactIncomingReward',
      'purchaseStygianWellOffer',
      'interactChallengeSwitch',
    ]);
    expect(simulateProject(catalog, project).status).toBe('valid');
    const raw = JSON.parse(encodeProjectDocument(project));
    for (const biome of raw.route.biomes)
      for (const entry of biome.topology?.occurrences ?? [])
        if (entry.occurrenceId === 'golden-f-b8-e1')
          entry.roomActions.order = [order[0], order[2], order[1]];
    const result = simulateProject(catalog, decodeProjectDocument(raw, catalog));
    expect(result.status).toBe('invalid');
    expect(
      result.findings.map((finding) => [finding.code, finding.origin, finding.evidence]),
    ).toEqual([
      [
        'challengeSwitchLeftNotLast',
        createRoomActionAddress(fBiome, hostId, roomActionKey(interaction)),
        { followingActionCount: 1 },
      ],
    ]);
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
    expect(product?.pinnedDraws).toBeUndefined();
    // A pinned elite publishes each forced draw; a draw after an unpinned one stays native.
    const pinnedProduct = (attributeKeys: string[]) =>
      roomObjectInteractionsForProjectEvaluationAssembly(
        simulateProjectAssembly(catalog, pin(observed(), 'Dragon_Elite', attributeKeys)),
        createOccurrenceAddress(
          createBiomeAddress('Surface', 'P'),
          createOccurrenceId('surface-p-6-1-p_combat10'),
        ),
      )?.challengeSwitch?.elite.pinnedDraws;
    const none = pinnedProduct([]);
    expect(none?.[0]?.attributeKeys).toEqual(dragon.attributeKeys);
    expect(none?.[1]?.attributeKeys).toEqual([]);
    expect(pinnedProduct(['Frenzy'])?.[1]?.attributeKeys).toEqual(second);
  });
});

describe('challenge switch encounter', () => {
  const fHost = createOccurrenceAddress(
    createBiomeAddress('Underworld', 'F'),
    createOccurrenceId('golden-f-b8-e1'),
  );
  const fBiomeOf = (project: ProjectDocument) => {
    const biome = simulateProject(catalog, project).route.biomes.find(
      (candidate) => candidate.biomeKey === 'F',
    );
    if (biome === undefined || !('history' in biome)) throw new Error('F was not evaluated');
    return biome;
  };
  const switchRecords = (project: ProjectDocument) =>
    fBiomeOf(project).history.ledgers.encounterCompletions.filter(
      (entry) => entry.slotKey === 'challengeSwitch',
    );
  const customize = (project: ProjectDocument, value: unknown) =>
    applyProjectCommand(project, catalog, {
      kind: 'ReplaceChallengeSwitchCustomization',
      occurrence: fHost,
      decisionKey: 'generatedComposition',
      value: value as never,
    });
  const overviewSwitch = (project: ProjectDocument) => {
    const assembly = simulateProjectAssembly(catalog, project);
    const plan = compileExecutionPlan({
      product: assembleExecutionProduct({ assembly, catalog }),
    });
    expect(decodeExecutionPlan(JSON.parse(encodeExecutionPlan(plan)))).toEqual(plan);
    const found: unknown[] = [];
    const visit = (value: unknown) => {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value !== null && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        if (record.challengeSwitch !== undefined) found.push(record.challengeSwitch);
        Object.values(record).forEach(visit);
      }
    };
    visit(plan);
    return found;
  };

  it('runs the encounter native generated at entry at the press, with no encounter end', () => {
    const observed = withSwitch(golden(), 'F', 'golden-f-b8-e1', 'TimeChallengeSwitch_Money');
    const used = withSwitch(golden(), 'F', 'golden-f-b8-e1', 'TimeChallengeSwitch_Money', {
      used: true,
    });
    const press = fBiomeOf(used).history.events.find(
      (event) => event.kind === 'challengeSwitchInteracted',
    );
    expect(press).toMatchObject({
      encounter: {
        encounterKey: 'TimeChallengeF',
        phaseKind: 'combat',
        countsEncounterDepth: true,
      },
    });
    // RecordEncounter, StartEncounter and its completion: the caches, never an end effect.
    expect(switchRecords(observed)).toEqual([]);
    expect(
      switchRecords(used).map((entry) => [entry.encounterKey, entry.encounterEnvelopeKey]),
    ).toEqual([['TimeChallengeF', 'challengeSwitch']]);
    expect(
      fBiomeOf(used).history.events.filter(
        (event) =>
          event.kind === 'encounterEndEffectsApplied' &&
          event.origin.kind === 'occurrence' &&
          event.origin.occurrenceId === 'golden-f-b8-e1',
      ),
    ).toHaveLength(1);
    // The inherited CountsForRoomEncounterDepth advances the encounter depth later rooms read.
    expect(
      fBiomeOf(used).history.ledgers.counters.routeEncounterDepth -
        fBiomeOf(observed).history.ledgers.counters.routeEncounterDepth,
    ).toBe(1);
  });

  it('raises the biome encounter depth later rooms’ requirements read only when pressed', () => {
    const host = 'surface-p-6-1-p_combat10';
    const depths = (project: ProjectDocument) => {
      const biome = simulateProject(catalog, project).route.biomes.find(
        (candidate) => candidate.biomeKey === 'P',
      );
      if (biome === undefined || !('history' in biome)) throw new Error('P was not evaluated');
      return biome.history.rooms.map((room) => [
        room.origin.kind === 'occurrence' ? room.origin.occurrenceId : room.origin.kind,
        room.preparation.ledgers.counters.biomeEncounterDepth,
        room.preOutgoing?.ledgers.counters.biomeEncounterDepth,
      ]);
    };
    const base = depths(surface());
    const observed = depths(withSwitch(surface(), 'P', host, 'EliteChallengeSwitch_MaxMana'));
    const used = depths(
      withSwitch(surface(), 'P', host, 'EliteChallengeSwitch_MaxMana', { used: true }),
    );
    expect(observed).toEqual(base);
    const hostIndex = base.findIndex(([id]) => id === host);
    // The host's own doors are drawn before the press; every later room reads one more.
    expect(used.slice(0, hostIndex + 1)).toEqual(base.slice(0, hostIndex + 1));
    expect(used[hostIndex + 1]).toEqual([
      base[hostIndex + 1]![0],
      (base[hostIndex + 1]![1] as number) + 1,
      (base[hostIndex + 1]![2] as number) + 1,
    ]);
    // The `counterRange` gate on `biomeEncounterDepth` that P room eligibility
    // declares (RoomDataP.lua P_Shop01 BiomeEncounterDepth > 4) reads that counter.
    expect(catalog.rooms.byKey.P_Shop01?.eligibility).toMatchObject({
      requirements: expect.arrayContaining([
        { kind: 'counterRange', axis: 'biomeEncounterDepth', range: { min: 5 } },
      ]),
    });
  });

  it('starts a left fight, counting its depth, but never completes or claims it', () => {
    const finished = withSwitch(golden(), 'F', 'golden-f-b8-e1', 'TimeChallengeSwitch_Money', {
      used: true,
    });
    const left = withSwitch(golden(), 'F', 'golden-f-b8-e1', 'TimeChallengeSwitch_Money', {
      used: true,
      outcome: { outcome: 'left' },
    });
    expect(simulateProject(catalog, left).status).toBe('valid');
    const ledgers = fBiomeOf(left).history.ledgers;
    const slot = (entries: readonly { readonly slotKey: string }[]) =>
      entries.filter((entry) => entry.slotKey === 'challengeSwitch').length;
    expect([slot(ledgers.encounterRecords), slot(ledgers.encounterStarts)]).toEqual([1, 1]);
    expect(slot(ledgers.encounterCompletions)).toBe(0);
    expect(ledgers.counters.routeEncounterDepth).toBe(
      fBiomeOf(finished).history.ledgers.counters.routeEncounterDepth,
    );
    expect(claimAcquisitions(left)).toEqual([]);
    const enemyGold = (project: ProjectDocument) => {
      const room = goldLedgerForProjectEvaluationAssembly(
        catalog,
        simulateProjectAssembly(catalog, project),
      ).roomAt(fHost);
      if (room.availability !== 'available') throw new Error(`room is ${room.reason}`);
      return room.room.gains.filter(
        (gain) => gain.kind === 'enemyGold' && gain.owner?.kind === 'roomFeature',
      );
    };
    expect(enemyGold(left)).toEqual([]);
    expect(enemyGold(finished)).toHaveLength(1);
    // The press's guide row carries how its fight ends.
    const plan = compileExecutionPlan({
      product: assembleExecutionProduct({
        assembly: simulateProjectAssembly(catalog, left),
        catalog,
      }),
    });
    expect(decodeExecutionPlan(JSON.parse(encodeExecutionPlan(plan)))).toEqual(plan);
    expect(JSON.stringify(plan)).toContain('{"kind":"interactChallengeSwitch","outcome":"left"}');
  });

  it('pays the encounter’s kills from its own store at the press', () => {
    const enemyGold = (project: ProjectDocument) => {
      const room = goldLedgerForProjectEvaluationAssembly(
        catalog,
        simulateProjectAssembly(catalog, project),
      ).roomAt(fHost);
      if (room.availability !== 'available') throw new Error(`room is ${room.reason}`);
      return room.room.gains.filter((gain) => gain.kind === 'enemyGold');
    };
    const observed = enemyGold(
      withSwitch(golden(), 'F', 'golden-f-b8-e1', 'PerfectClearChallengeSwitch_MaxHealth'),
    );
    const used = enemyGold(
      withSwitch(golden(), 'F', 'golden-f-b8-e1', 'PerfectClearChallengeSwitch_MaxHealth', {
        used: true,
      }),
    );
    expect(used).toHaveLength(observed.length + 1);
    const paid = used.find((gain) => gain.owner?.kind === 'roomFeature');
    expect(paid?.amount?.mean).toBeGreaterThan(0);
  });

  it('composes a Time or PerfectClear encounter from its entry capability and publishes it', () => {
    const observed = withSwitch(golden(), 'F', 'golden-f-b8-e1', 'TimeChallengeSwitch_Money', {
      used: true,
    });
    const capability = challengeSwitchEncounterSupportForProjectEvaluationAssembly(
      simulateProjectAssembly(catalog, observed),
      fHost,
    );
    expect(capability).toMatchObject({
      decisionKey: 'generatedComposition',
      waveCount: { min: 1, max: 1 },
    });
    const initial = capability!.initialize();
    expect(initial).toBeDefined();
    const customized = customize(observed, initial);
    expect(simulateProject(catalog, customized).status).toBe('valid');
    const product = roomObjectInteractionsForProjectEvaluationAssembly(
      simulateProjectAssembly(catalog, customized),
      fHost,
    )?.challengeSwitch?.encounter;
    expect(product).toMatchObject({
      switchKind: 'time',
      selectedEncounterDefinitionKey: 'TimeChallengeF',
      label: 'Time challenge',
      customization: [
        {
          key: 'generatedComposition',
          value: initial,
          valueSupported: true,
          reset: { kind: 'ReplaceChallengeSwitchCustomization', value: null },
        },
      ],
    });
    // The press records the composed roster's operands for later rolls and gold.
    expect(
      fBiomeOf(customized).history.events.find(
        (event) => event.kind === 'challengeSwitchInteracted',
      ),
    ).toMatchObject({
      encounter: { generatedCustomization: { decisionKey: 'generatedComposition' } },
    });
    const [published] = overviewSwitch(customized) as {
      customization?: { kind: string; waveCount: number; waves: unknown[] }[];
    }[];
    expect(published).toMatchObject({
      variantKey: 'TimeChallengeSwitch_Money',
      encounterKey: 'TimeChallengeF',
      customization: [{ decisionKey: 'generatedComposition', kind: 'generated', waveCount: 1 }],
    });
    expect(published?.customization?.[0]?.waves).toHaveLength(1);
    // An observed, uncustomized switch publishes its encounter, natively rolled.
    expect(overviewSwitch(observed)).toEqual([
      { variantKey: 'TimeChallengeSwitch_Money', encounterKey: 'TimeChallengeF' },
    ]);
  });

  it('reports a composition the entry cannot generate at the switch’s Overview', () => {
    const observed = withSwitch(golden(), 'F', 'golden-f-b8-e1', 'TimeChallengeSwitch_Money', {
      used: true,
    });
    // Only one Elite type may be drawn in F.
    const customized = customize(observed, {
      kind: 'generated',
      waveCount: 1,
      waves: [{ waveIndex: 1, typeKeys: ['Guard_Elite', 'Mage_Elite'] }],
    });
    const result = simulateProject(catalog, customized);
    expect(result.status).toBe('invalid');
    const finding = result.findings.find(
      (candidate) => candidate.code === 'challengeSwitchCustomizationUnavailable',
    );
    expect(finding).toMatchObject({
      origin: { kind: 'roomFeature', occurrenceId: 'golden-f-b8-e1' },
      evidence: { decisionKey: 'generatedComposition', reason: 'compositionInvalid' },
    });
    // The Overview finding stops the room before its Timeline, so the press never runs.
    expect(switchRecords(customized)).toEqual([]);
  });

  it('fields an Elite switch’s pinned elite and publishes it without a composition', () => {
    const pinned = applyProjectCommand(
      withSwitch(surface(), 'P', 'surface-p-6-1-p_combat10', 'EliteChallengeSwitch_MaxMana', {
        used: true,
      }),
      catalog,
      {
        kind: 'ReplaceChallengeSwitchElite',
        occurrence: createOccurrenceAddress(
          createBiomeAddress('Surface', 'P'),
          createOccurrenceId('surface-p-6-1-p_combat10'),
        ),
        elite: { enemyKey: 'Dragon_Elite', attributeKeys: ['Frenzy', 'Blink'] },
      },
    );
    expect(simulateProject(catalog, pinned).status).toBe('valid');
    const assembly = simulateProjectAssembly(catalog, pinned);
    const host = createOccurrenceAddress(
      createBiomeAddress('Surface', 'P'),
      createOccurrenceId('surface-p-6-1-p_combat10'),
    );
    expect(
      challengeSwitchEncounterSupportForProjectEvaluationAssembly(assembly, host),
    ).toBeUndefined();
    expect(
      roomObjectInteractionsForProjectEvaluationAssembly(assembly, host)?.challengeSwitch
        ?.encounter,
    ).toMatchObject({
      switchKind: 'elite',
      selectedEncounterDefinitionKey: 'EliteChallengeP',
      customization: [],
    });
    expect(overviewSwitch(pinned)).toEqual([
      {
        variantKey: 'EliteChallengeSwitch_MaxMana',
        encounterKey: 'EliteChallengeP',
        elite: {
          enemy: {
            choiceKey: 'Dragon_Elite',
            nativeId: catalog.challengeSwitches.eliteEncounters.byKey.EliteChallengeP!.enemies.find(
              (enemy) => enemy.key === 'Dragon_Elite',
            )!.nativeId,
          },
          attributeKeys: ['Frenzy', 'Blink'],
        },
      },
    ]);
  });
});
