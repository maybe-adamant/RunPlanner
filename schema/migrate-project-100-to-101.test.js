import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const runner = { configFile: false, logLevel: 'silent' };
const checkpoint = (id) =>
  JSON.parse(
    readFileSync(
      join(root, `test/fixtures/authored-project/checkpoints/${id}.runplanner.json`),
      'utf8',
    ),
  );

/** Every stored kill-race outcome, by occurrence and phase. */
function outcomes(document) {
  return Object.fromEntries(
    document.route.biomes.flatMap((biome) =>
      (biome.topology?.occurrences ?? []).flatMap((occurrence) =>
        Object.entries(occurrence.encounters?.nemesisBetOutcomeByPhase ?? {}).map(
          ([phase, outcome]) => [`${occurrence.occurrenceId}:${phase}`, outcome],
        ),
      ),
    ),
  );
}

const toyDocument = (occurrences) => ({
  schemaVersion: 100,
  schemaRevision: 1,
  projectId: 'run-plan-1',
  name: 'Run',
  catalogVersion: '0.55.0-anvil-of-fates',
  route: { routeKey: 'Underworld', biomes: [{ biomeKey: 'F', topology: { occurrences } }] },
});

describe('schema 100 to 101 migration', () => {
  let step;
  let engine;
  before(async () => {
    ({ module: step } = await runnerImport(
      join(root, 'apps/planner/src/persistence/project-100-to-101.js'),
      runner,
    ));
    ({ module: engine } = await runnerImport(
      fileURLToPath(new URL('./test-support/strict-decode.js', import.meta.url)),
      runner,
    ));
  });
  const migrate = (document) => step.migrateProjectDocument(document, { catalog: engine.catalog });
  const decode = (document) =>
    engine.parseProjectDocument(JSON.stringify(document), engine.catalog);
  const canonical = (document) => engine.encodeProjectDocument(decode(document));

  it('completes a settled schema 100 document into the current project', () => {
    const current = checkpoint('nemesis-f-trait-trade');
    const settled = { ...engine.legacySchema100Body(current), schemaVersion: 100 };
    assert.deepEqual(outcomes(settled), {});
    assert.throws(() => decode(settled));
    const migrated = migrate(settled);
    assert.equal(migrated.schemaVersion, 101);
    assert.equal('schemaRevision' in migrated, false);
    assert.equal(canonical(migrated), canonical(current));
    assert.equal(settled.schemaVersion, 100);
  });

  it('fills only the omitted wins, keeping a stored tie or loss', () => {
    const current = checkpoint('nemesis-f-trait-trade');
    const [tie, loss] = Object.keys(outcomes(current));
    assert.ok(tie !== undefined && loss !== undefined);
    const settled = { ...engine.legacySchema100Body(current), schemaVersion: 100 };
    for (const biome of settled.route.biomes)
      for (const occurrence of biome.topology?.occurrences ?? [])
        for (const [key, value] of [
          [tie, 'tie'],
          [loss, 'loss'],
        ]) {
          const [occurrenceId, phase] = key.split(':');
          if (occurrence.occurrenceId !== occurrenceId) continue;
          occurrence.encounters.nemesisBetOutcomeByPhase = {
            ...occurrence.encounters.nemesisBetOutcomeByPhase,
            [phase]: value,
          };
        }
    const migrated = migrate(settled);
    assert.doesNotThrow(() => decode(migrated));
    assert.deepEqual(outcomes(migrated), {
      ...Object.fromEntries(Object.keys(outcomes(current)).map((key) => [key, 'win'])),
      [tie]: 'tie',
      [loss]: 'loss',
    });
  });

  it('reshapes a schema 100 save with Well and Pool counts and interaction flags', () => {
    const room = {
      occurrenceId: 'postboss',
      gameName: 'F_PostBoss01',
      stygianWell: {
        interacted: true,
        offerKeyBySlot: { healing: 'HealDropRange' },
        rerollCount: 2,
      },
      purgingPool: {
        interacted: false,
        traitKeyBySlot: { left: 'ApolloWeaponBoon', middle: null },
        rerollCount: 1,
      },
      roomActions: { order: [{ kind: 'useFountain' }] },
    };
    const source = toyDocument([room]);
    const [migrated] = migrate(source).route.biomes[0].topology.occurrences;
    // An interacted Well keeps its stock; an uninteracted Pool's slots go native.
    assert.deepEqual(migrated.stygianWell, { offerKeyBySlot: { healing: 'HealDropRange' } });
    assert.deepEqual(migrated.purgingPool, { traitKeyBySlot: { left: null, middle: null } });
    assert.deepEqual(migrated.roomActions.order, [
      { kind: 'useFountain' },
      { kind: 'rerollStygianWell', rerollId: 'r1', offerKeyBySlot: {} },
      { kind: 'rerollStygianWell', rerollId: 'r2', offerKeyBySlot: {} },
    ]);
    assert.equal(room.stygianWell.rerollCount, 2);
  });

  it('turns trait, Chaos and Pom screen counts into unauthored earlier screens', () => {
    const traits = { kind: 'traits', giverKey: 'Zeus', options: [], rerollCount: 2 };
    const chaos = { kind: 'chaos', giverKey: 'Chaos', curseOptions: [], rerollCount: 1 };
    const pom = { kind: 'choice', offeredTraitKeys: [], selectedTraitKey: null, rerollCount: 3 };
    const room = {
      occurrenceId: 'combat',
      gameName: 'F_Combat01',
      state: {
        kind: 'counted',
        reward: {
          traitOffersByAcquisitionRole: { source: traits, chaos },
          levelResolutionsByAcquisitionRole: { self: pom },
        },
      },
      roomActions: { order: [] },
    };
    const [migrated] = migrate(toyDocument([room])).route.biomes[0].topology.occurrences;
    const reward = migrated.state.reward;
    assert.deepEqual(reward.traitOffersByAcquisitionRole.source, {
      kind: 'traits',
      giverKey: 'Zeus',
      options: [],
      rerolledScreens: [null, null],
    });
    assert.deepEqual(reward.traitOffersByAcquisitionRole.chaos.rerolledScreens, [null]);
    assert.deepEqual(reward.levelResolutionsByAcquisitionRole.self.rerolledScreens, [
      null,
      null,
      null,
    ]);
    assert.equal(traits.rerollCount, 2);
  });

  it('moves each Shrine purchase delay onto its item and gives unbought items the default', () => {
    const room = {
      occurrenceId: 'shrine',
      gameName: 'N_Combat01',
      hermesShrine: {
        offerBySlot: {
          first: { rewardType: 'HealBigDrop' },
          secondLeft: { rewardType: 'MaxHealthDrop' },
          secondRight: null,
        },
        purchaseBySlot: { first: { delay: 6 } },
        travelDealRefill: { offer: { rewardType: 'MaxManaDrop' }, purchase: { delay: 4 } },
      },
      roomActions: {
        order: [
          { kind: 'purchaseHermesShrineOffer', generationKey: 'initial:first', rushed: true },
        ],
      },
    };
    const [migrated] = migrate(toyDocument([room])).route.biomes[0].topology.occurrences;
    assert.deepEqual(migrated.hermesShrine, {
      offerBySlot: {
        first: { rewardType: 'HealBigDrop', delay: 6 },
        secondLeft: { rewardType: 'MaxHealthDrop', delay: 2 },
        secondRight: null,
      },
      travelDealRefill: { offer: { rewardType: 'MaxManaDrop', delay: 4 } },
    });
    assert.deepEqual(migrated.roomActions, room.roomActions);
  });

  describe('two-offer Ship wheels', () => {
    const occurrenceId = 'surface-o-combat04';
    let biome;
    let wheel;
    let offer;
    let twoOffered;
    before(() => {
      biome = engine.createBiomeAddress('Surface', 'O');
      wheel = engine.createRewardWheelAddress(biome, occurrenceId, 'wheel1');
      offer = (offerKey) =>
        engine.createRewardWheelOfferAddress(biome, occurrenceId, 'wheel1', offerKey);
      let project = decode(checkpoint('surface-no'));
      for (const command of [
        { kind: 'ReplaceRewardWheelOfferCount', wheel, offerCount: 2 },
        {
          kind: 'ReplaceRewardWheelOffer',
          offer: offer('offer1'),
          value: { rewardType: 'MaxHealthDrop' },
        },
        {
          kind: 'ReplaceRewardWheelOffer',
          offer: offer('offer2'),
          value: { rewardType: 'RoomMoneyDrop' },
        },
        { kind: 'ReplaceRewardWheelPicked', wheel, pickedOfferIndex: 2 },
      ])
        project = engine.applyProjectCommand(project, engine.catalog, command);
      twoOffered = {
        ...engine.legacySchema100Body(JSON.parse(engine.encodeProjectDocument(project))),
        schemaVersion: 100,
      };
    });
    const wheelState = (document) =>
      document.route.biomes
        .flatMap((entry) => entry.topology?.occurrences ?? [])
        .find((occurrence) => occurrence.occurrenceId === occurrenceId).state.wheels.wheel1;

    it('keeps a wheel the plan does not block', () => {
      const migrated = migrate(twoOffered);
      const state = wheelState(migrated);
      assert.equal(state.offers.offer1.offer.rewardType, 'MaxHealthDrop');
      assert.equal(state.offers.offer2.offer.rewardType, 'RoomMoneyDrop');
      assert.equal(state.pickedOfferIndex, 2);
      assert.doesNotThrow(() => decode(migrated));
    });

    it('exchanges a wheel valid only the other way round, with its pick', () => {
      // The judge blocks the wheel while Max Health leads it.
      const judge = (project) => {
        const state = project.route.biomes
          .flatMap((entry) => entry.topology?.occurrences ?? [])
          .find((occurrence) => occurrence.occurrenceId === occurrenceId).state.wheels.wheel1;
        return state.offers.offer1?.offer.rewardType === 'MaxHealthDrop'
          ? { kind: 'invalid', owner: wheel, reasons: [{ origin: offer('offer1') }] }
          : undefined;
      };
      const migrated = step.migrateProjectDocumentJudgedBy(twoOffered, engine.catalog, judge);
      const state = wheelState(migrated);
      assert.equal(state.offers.offer1.offer.rewardType, 'RoomMoneyDrop');
      assert.equal(state.offers.offer2.offer.rewardType, 'MaxHealthDrop');
      assert.equal(state.pickedOfferIndex, 1);
      assert.equal(migrated.schemaVersion, 101);
      assert.doesNotThrow(() => decode(migrated));
    });
  });

  it('rejects another source schema or catalog', () => {
    const source = toyDocument([]);
    assert.throws(() => migrate({ ...source, schemaVersion: 99 }), /expects schema 100/);
    assert.throws(() => migrate({ ...source, catalogVersion: 'other' }), /expects catalog/);
  });
});
