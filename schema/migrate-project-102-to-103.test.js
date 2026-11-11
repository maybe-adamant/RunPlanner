import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';
import { migrateProjectDocumentTo } from './migrate-project.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const runner = { configFile: false, logLevel: 'silent' };
const checkpoint = (id) =>
  JSON.parse(
    readFileSync(
      join(root, `test/fixtures/authored-project/checkpoints/${id}.runplanner.json`),
      'utf8',
    ),
  );
/** Schema 102 rows recorded no item content. */
const withoutContent = (document) =>
  JSON.parse(JSON.stringify(document, (key, value) => (key === 'content' ? undefined : value)));
const at102 = (current, revision = 1) => ({
  ...withoutContent(current),
  schemaVersion: 102,
  schemaRevision: revision,
});

/** The G opening's action keys; the checkpoint keeps a pickup of a role its reward lost. */
const gOpening = (document) =>
  document.route.biomes
    .flatMap((biome) => biome.topology?.occurrences ?? [])
    .find((occurrence) => occurrence.occurrenceId === 'golden-g-b1-e1')
    .roomActions.order.map((action) => JSON.stringify(withoutContent(action)));
const stalePickup = JSON.stringify({
  kind: 'interactIncomingReward',
  producerPoint: 'roomRewardPickup',
  acquisitionRole: 'source',
});

const gHost = (document) =>
  document.route.biomes
    .flatMap((biome) => biome.topology?.occurrences ?? [])
    .find((occurrence) => occurrence.occurrenceId === 'golden-g-b1-e1');

describe('schema 102 to 103 migration', () => {
  let step;
  let engine;
  before(async () => {
    ({ module: step } = await runnerImport(
      join(root, 'apps/planner/src/persistence/project-102-to-103.js'),
      runner,
    ));
    ({ module: engine } = await runnerImport(
      fileURLToPath(new URL('./test-support/strict-decode.js', import.meta.url)),
      runner,
    ));
  });
  const migrate = (document) => step.migrateProjectDocument(document, { catalog: engine.catalog });
  /** The plan with the G opening's second door locked, pressed and its fight composed. */
  const lockedDoorFight = (document) => {
    const { catalog } = engine;
    const project = engine.parseProjectDocument(JSON.stringify(document), catalog);
    const biome = engine.createBiomeAddress(project.route.routeKey, 'G');
    const occurrenceId = engine.createOccurrenceId('golden-g-b1-e1');
    const occurrence = engine.createOccurrenceAddress(biome, occurrenceId);
    const reference = { kind: 'unlockExit', exitKey: 'exit2' };
    const action = engine.createRoomActionAddress(
      biome,
      occurrenceId,
      engine.roomActionKey(reference),
    );
    const locked = engine.applyProjectCommand(project, catalog, {
      kind: 'ReplaceLockedExit',
      occurrence,
      exitKey: 'exit2',
      locked: true,
    });
    const pressed = engine.applyProjectCommand(locked, catalog, {
      kind: 'InsertRoomAction',
      action,
      reference,
      index: gHost(locked).roomActions.order.length,
    });
    const capability = engine.unlockExitEncounterSupportForProjectEvaluationAssembly(
      engine.simulateProjectAssembly(catalog, pressed),
      action,
    );
    const customized = engine.applyProjectCommand(pressed, catalog, {
      kind: 'ReplaceLockedExitCustomization',
      occurrence,
      exitKey: 'exit2',
      decisionKey: capability.decisionKey,
      value: capability.initialize(),
    });
    return JSON.parse(engine.encodeProjectDocument(customized));
  };

  it('lifts a plan with nothing to reshape by the version alone', () => {
    const current = checkpoint('underworld-fg');
    const lifted = step.liftProjectDocument(at102(current), engine.catalog);
    assert.equal(lifted.schemaVersion, 103);
    assert.equal('schemaRevision' in lifted, false);
    assert.deepEqual(lifted, current);
  });

  it('moves Well and Pool rolls from their reroll actions onto the Well and Pool', () => {
    const current = checkpoint('underworld-f-stygian-well');
    const legacy = at102(structuredClone(current));
    const room = (document) =>
      document.route.biomes[0].topology.occurrences.find(
        (occurrence) => occurrence.occurrenceId === 'golden-f-preboss-shop:postboss',
      );
    const purchases = room(current)
      .roomActions.order.filter((action) => action.kind === 'purchaseStygianWellOffer')
      .map((action) => action.generationKey);
    const { travelDealRefillKey, ...well } = room(legacy).stygianWell;
    room(legacy).stygianWell = {
      ...well,
      travelDealRefillKey,
      twistResultKeyBySlot: { travelDealRefill: null },
      purchasedGenerationKeys: purchases,
    };
    room(legacy).roomActions.order.push(
      {
        kind: 'rerollStygianWell',
        rerollId: 'r1',
        offerKeyBySlot: { healing: 'HealDropRange' },
        twistResultKeyBySlot: {},
      },
      { kind: 'rerollPurgingPool', rerollId: 'r1', traitKeyBySlot: { left: 'ApolloWeaponBoon' } },
    );
    for (const migrated of [step.liftProjectDocument(legacy), migrate(legacy)]) {
      assert.deepEqual(room(migrated).stygianWell, {
        ...room(current).stygianWell,
        rerollOfferKeyBySlot: { r1: { healing: 'HealDropRange' } },
        twistResultKeyByGeneration: { travelDealRefill: null },
      });
      assert.deepEqual(room(migrated).purgingPool.rerollTraitKeyBySlot, {
        r1: { left: 'ApolloWeaponBoon' },
      });
      assert.deepEqual(room(migrated).roomActions.order.slice(-2), [
        { kind: 'rerollStygianWell', rerollId: 'r1' },
        { kind: 'rerollPurgingPool', rerollId: 'r1' },
      ]);
      assert.deepEqual(
        room(migrated)
          .roomActions.order.filter((action) => action.kind === 'purchaseStygianWellOffer')
          .map((action) => action.generationKey),
        purchases,
      );
      assert.doesNotThrow(() =>
        engine.parseProjectDocument(JSON.stringify(migrated), engine.catalog),
      );
    }
  });

  it('rejects another schema, a later revision or another catalog', () => {
    const legacy = at102(checkpoint('underworld-fg'));
    for (const transform of [step.liftProjectDocument, migrate]) {
      assert.throws(() => transform({ ...legacy, schemaVersion: 101 }), /expects schema 102/);
      assert.throws(
        () => transform({ ...legacy, schemaRevision: 2 }),
        /schema 102\.2 is newer than schema 102's final revision 1/,
      );
      assert.throws(() => transform({ ...legacy, catalogVersion: 'other' }), /expects catalog/);
    }
  });

  it('settles a plan saved under the earlier rules', () => {
    const current = checkpoint('underworld-fg');
    assert.ok(gOpening(current).includes(stalePickup));
    for (const revision of [0, 1]) {
      const migrated = migrate(at102(current, revision));
      assert.equal(migrated.schemaVersion, 103);
      assert.deepEqual(
        gOpening(migrated),
        gOpening(current).filter((action) => action !== stalePickup),
      );
      assert.doesNotThrow(() =>
        engine.parseProjectDocument(JSON.stringify(migrated), engine.catalog),
      );
    }
    // The offline tool runs the same chain.
    assert.deepEqual(migrateProjectDocumentTo(at102(current)), migrate(at102(current)));
  });

  it('moves a press’s locked-door fight onto its door, losslessly', () => {
    const current = lockedDoorFight(checkpoint('underworld-fg'));
    const saved = at102(structuredClone(current));
    const host = gHost(saved);
    const fight = host.encounters.customizationByLockedExit.exit2;
    delete host.encounters.customizationByLockedExit;
    host.roomActions.order.find((row) => row.kind === 'unlockExit').customization = fight;
    assert.deepEqual(step.liftProjectDocument(saved, engine.catalog), current);
    const migrated = migrate(saved);
    assert.deepEqual(gHost(migrated).encounters.customizationByLockedExit, { exit2: fight });
    assert.deepEqual(
      gHost(migrated).roomActions.order.filter((row) => row.kind === 'unlockExit'),
      [{ kind: 'unlockExit', exitKey: 'exit2' }],
    );
    assert.doesNotThrow(() =>
      engine.parseProjectDocument(JSON.stringify(migrated), engine.catalog),
    );
  });

  it('splits a stored Shrine rush into the purchase and its own rush right after it', () => {
    const current = checkpoint('surface-no-hermes-shrine-delivery');
    // Schema 102 stored a rush as a flag on its purchase.
    const stored = JSON.parse(JSON.stringify(at102(current)));
    for (const biome of stored.route.biomes)
      for (const occurrence of biome.topology?.occurrences ?? []) {
        const order = occurrence.roomActions.order;
        const rushed = new Set(
          order.flatMap((action) =>
            action.kind === 'rushHermesShrineOffer' ? [action.generationKey] : [],
          ),
        );
        occurrence.roomActions.order = order.flatMap((action) =>
          action.kind === 'rushHermesShrineOffer'
            ? []
            : action.kind === 'purchaseHermesShrineOffer'
              ? [{ ...action, rushed: rushed.has(action.generationKey) }]
              : [action],
        );
      }
    assert.ok(JSON.stringify(stored).includes('"rushed":true'));
    assert.deepEqual(step.liftProjectDocument(stored, engine.catalog), current);
    assert.deepEqual(migrate(stored), current);
  });

  it('moves Well rolls, a locked-door fight and a Shrine rush through one lift, losslessly', () => {
    // No route holds all three (the Well and locked doors are Underworld's, the
    // Shrine the Surface's); the raw moves read no route, so one document
    // carries both plans' biomes, and each plan alone decodes strictly.
    const underworld = lockedDoorFight(checkpoint('underworld-fg'));
    const shop = (document) =>
      document.route.biomes
        .flatMap((biome) => biome.topology?.occurrences ?? [])
        .find((occurrence) => occurrence.occurrenceId === 'golden-f-preboss-shop:postboss');
    shop(underworld).stygianWell.rerollOfferKeyBySlot = { r1: { healing: 'HealDropRange' } };
    shop(underworld).roomActions.order.push({ kind: 'rerollStygianWell', rerollId: 'r1' });
    const surface = checkpoint('surface-no-hermes-shrine-delivery');
    const current = {
      ...underworld,
      route: { ...underworld.route, biomes: [...underworld.route.biomes, ...surface.route.biomes] },
    };

    const stored = at102(structuredClone(current));
    const well = shop(stored).stygianWell;
    delete well.rerollOfferKeyBySlot;
    well.purchasedGenerationKeys = [];
    shop(stored).roomActions.order.at(-1).offerKeyBySlot = { healing: 'HealDropRange' };
    shop(stored).roomActions.order.at(-1).twistResultKeyBySlot = {};
    const host = gHost(stored);
    const fight = host.encounters.customizationByLockedExit.exit2;
    delete host.encounters.customizationByLockedExit;
    host.roomActions.order.find((row) => row.kind === 'unlockExit').customization = fight;
    const shrine = stored.route.biomes
      .flatMap((biome) => biome.topology?.occurrences ?? [])
      .find((occurrence) => occurrence.occurrenceId === 'surface-n-preboss:postboss');
    shrine.roomActions.order = shrine.roomActions.order.flatMap((action) =>
      action.kind === 'rushHermesShrineOffer'
        ? []
        : action.kind === 'purchaseHermesShrineOffer'
          ? [{ ...action, rushed: action.generationKey === 'initial:first' }]
          : [action],
    );

    // The Surface start is not this document's route start, so its pickup's content cannot
    // be read here; it keeps the content it was saved with.
    const surfaceStart = surface.route.biomes[0].topology.startOccurrenceId;
    const startOf = (document) =>
      document.route.biomes
        .flatMap((biome) => biome.topology?.occurrences ?? [])
        .find((occurrence) => occurrence.occurrenceId === surfaceStart);
    startOf(stored).roomActions = structuredClone(startOf(current).roomActions);

    const lifted = step.liftProjectDocument(stored, engine.catalog);
    assert.deepEqual(lifted, current);
    // Each plan alone decodes strictly and migrates, settlement included, to its 103 form.
    const split = underworld.route.biomes.length;
    const halves = (document) => [
      {
        ...document,
        route: { ...underworld.route, biomes: document.route.biomes.slice(0, split) },
      },
      { ...document, route: { ...surface.route, biomes: document.route.biomes.slice(split) } },
    ];
    const [storedUnderworld, storedSurface] = halves(stored);
    for (const [saved, plan] of [
      [storedUnderworld, underworld],
      [storedSurface, surface],
    ]) {
      const migrated = migrate(saved);
      assert.deepEqual(migrated, { ...plan, projectId: current.projectId, name: current.name });
      assert.doesNotThrow(() =>
        engine.parseProjectDocument(JSON.stringify(migrated), engine.catalog),
      );
    }
  });

  it('stamps each pickup, purchase and sale row with its item’s content, losslessly', () => {
    for (const id of [
      'underworld-world-shop-travel-deal',
      'surface-no-hermes-shrine-delivery',
      'surface-no',
    ]) {
      const current = checkpoint(id);
      const stored = at102(current);
      assert.ok(!JSON.stringify(stored).includes('"content"'));
      assert.ok(JSON.stringify(current).includes('"content"'));
      assert.deepEqual(step.liftProjectDocument(stored, engine.catalog), current);
    }
    // A row whose item is not observed stays without content, to be stamped once it is.
    const current = checkpoint('underworld-f-stygian-well');
    const stored = at102(current);
    const well = (document) =>
      document.route.biomes[0].topology.occurrences.find(
        (occurrence) => occurrence.occurrenceId === 'golden-f-preboss-shop:postboss',
      );
    well(stored).stygianWell.offerKeyBySlot.secondLeft = null;
    const purchase = well(step.liftProjectDocument(stored, engine.catalog)).roomActions.order.find(
      (action) => action.generationKey === 'initial:secondLeft',
    );
    assert.deepEqual(purchase, {
      kind: 'purchaseStygianWellOffer',
      generationKey: 'initial:secondLeft',
    });
    // A pickup of a role its reward never has acts on no item: it stays without content.
    const lifted = step.liftProjectDocument(at102(checkpoint('underworld-fg')), engine.catalog);
    const stale = lifted.route.biomes
      .flatMap((biome) => biome.topology?.occurrences ?? [])
      .find((occurrence) => occurrence.occurrenceId === 'golden-g-b1-e1')
      .roomActions.order.find(
        (action) => action.kind === 'interactIncomingReward' && action.acquisitionRole === 'source',
      );
    assert.deepEqual(JSON.stringify(stale), stalePickup);
  });

  it('lifts by the version alone a plan its settlement leaves as it was', () => {
    const current = checkpoint('surface-n');
    assert.deepEqual(migrate(at102(current)), current);
  });

  it('keeps the bare lift when the plan does not decode or its settlement throws', () => {
    const undecodable = { ...at102(checkpoint('underworld-fg')), route: 'not a route' };
    assert.deepEqual(migrate(undecodable), step.liftProjectDocument(undecodable));
    // A catalog the plan decodes against but its evaluation cannot read makes the settlement throw.
    const legacy = at102(checkpoint('underworld-fg'));
    const catalog = { ...engine.catalog, heroMaxStats: undefined };
    assert.doesNotThrow(() =>
      engine.parseProjectDocument(
        JSON.stringify(step.liftProjectDocument(legacy, catalog)),
        catalog,
      ),
    );
    assert.deepEqual(
      step.migrateProjectDocument(legacy, { catalog }),
      step.liftProjectDocument(legacy, catalog),
    );
  });
});
