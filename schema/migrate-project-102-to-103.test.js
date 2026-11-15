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

/** Whole documents compared apart from the revision stamp, which encoding adds and a bare lift omits. */
function assertSameDocument(actual, expected) {
  const unstamped = (document) => {
    const { schemaRevision, ...rest } = document;
    void schemaRevision;
    return rest;
  };
  assert.deepEqual(unstamped(actual), unstamped(expected));
}

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

/** Every occurrence of a document, across its biomes. */
const occurrencesOf = (document) =>
  document.route.biomes.flatMap((biome) => biome.topology?.occurrences ?? []);
const occurrenceOf = (document, occurrenceId) =>
  occurrencesOf(document).find((occurrence) => occurrence.occurrenceId === occurrenceId);

/**
 * The same plan in the earlier reroll shape: each press carries the reward it
 * drew and a cage press its slot, and a rerolled owner holds its effective
 * reward with its outcomes, recording its press only when `pressIds` is set.
 */
function withEarlierRerolls(current, { pressIds = true } = {}) {
  const document = structuredClone(current);
  const records = [];
  for (const occurrence of occurrencesOf(document)) {
    if (occurrence.rerolledIncomingReward !== undefined)
      records.push({
        occurrence,
        kind: 'incoming',
        record: occurrence.rerolledIncomingReward,
        set: (value) => {
          if (value === undefined) delete occurrence.rerolledIncomingReward;
          else occurrence.rerolledIncomingReward = value;
        },
      });
    for (const [slotKey, record] of Object.entries(occurrence.state.rerolledCages ?? {}))
      records.push({
        occurrence,
        kind: 'cage',
        slotKey,
        record,
        set: (value) => {
          if (value === undefined) delete occurrence.state.rerolledCages[slotKey];
          else occurrence.state.rerolledCages[slotKey] = value;
        },
      });
    for (const [wheelKey, wheel] of Object.entries(occurrence.state.wheels ?? {}))
      for (const [offerKey, record] of Object.entries(wheel.rerolledOffers ?? {}))
        records.push({
          occurrence,
          kind: 'wheel',
          wheelKey,
          offerKey,
          record,
          set: (value) => {
            if (value === undefined) delete wheel.rerolledOffers[offerKey];
            else wheel.rerolledOffers[offerKey] = value;
          },
        });
  }
  const resultOf = (rerollId, matches) =>
    records.find((entry) => matches(entry) && Object.hasOwn(entry.record.results, rerollId));
  for (const source of occurrencesOf(document))
    for (const press of source.roomActions.order) {
      if (press.kind !== 'reroll') continue;
      const target = press.target;
      const held = resultOf(press.rerollId, (entry) =>
        target.kind === 'wheelOffer'
          ? entry.kind === 'wheel' &&
            entry.occurrence === source &&
            entry.wheelKey === target.wheelKey &&
            entry.offerKey === target.offerKey
          : entry.kind === (target.kind === 'door' ? 'incoming' : 'cage') &&
            entry.occurrence.occurrenceId === target.occurrenceId,
      );
      press.reward = held.record.results[press.rerollId];
      if (target.kind === 'cage') target.slotKey = held.slotKey;
    }
  for (const biome of document.route.biomes)
    for (const decision of biome.topology?.decisions ?? []) {
      if (decision.kind !== 'hub') continue;
      for (const press of decision.actions) {
        if (press.kind !== 'reroll') continue;
        const slot = decision.openTargets.find((open) => open.hubSlotKey === press.hubSlotKey);
        press.reward = resultOf(
          press.rerollId,
          (entry) =>
            entry.kind === 'incoming' && entry.occurrence.occurrenceId === slot.occurrenceId,
        ).record.results[press.rerollId];
      }
    }
  for (const { record, set } of records)
    set(
      record.acquisition === undefined
        ? undefined
        : {
            offer: record.results[record.pressId],
            ...record.acquisition,
            ...(pressIds ? { pressId: record.pressId } : {}),
          },
    );
  for (const occurrence of occurrencesOf(document)) {
    if (occurrence.state.rerolledCages && Object.keys(occurrence.state.rerolledCages).length === 0)
      delete occurrence.state.rerolledCages;
    for (const wheel of Object.values(occurrence.state.wheels ?? {}))
      if (wheel.rerolledOffers && Object.keys(wheel.rerolledOffers).length === 0)
        delete wheel.rerolledOffers;
  }
  return document;
}

const zeus = { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } };
const hera = { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'HeraUpgrade' } };

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
    assertSameDocument(step.liftProjectDocument(saved, engine.catalog), current);
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
    assertSameDocument(step.liftProjectDocument(stored, engine.catalog), current);
    assertSameDocument(migrate(stored), current);
  });

  it('strips the due phase a delivery row stored, silently', () => {
    const current = checkpoint('surface-no-hermes-shrine-delivery');
    // Schema 102 stored the phase a delivery fell due at on its pickup row.
    const stored = JSON.parse(JSON.stringify(at102(current)));
    for (const occurrence of occurrencesOf(stored))
      occurrence.roomActions.order = occurrence.roomActions.order.map((action) =>
        action.kind === 'interactAcquisitionEntry' && action.siteKey === 'hermesShrineDelivery'
          ? { ...action, encounterPhaseKey: 'Encounter' }
          : action,
      );
    assert.ok(JSON.stringify(stored).includes('"encounterPhaseKey":"Encounter"'));
    assertSameDocument(step.liftProjectDocument(stored, engine.catalog), current);
    assertSameDocument(migrate(stored), current);
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
    assertSameDocument(lifted, current);
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
      assertSameDocument(migrated, { ...plan, projectId: current.projectId, name: current.name });
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

  /** The plan with these edits settled, as its current-schema file. */
  const commanded = (document, ...commands) => {
    const evaluate = (project) => engine.simulateProjectAssembly(engine.catalog, project);
    return JSON.parse(
      engine.encodeProjectDocument(
        commands.reduce(
          (project, command) =>
            engine.settleProjectEdit({
              catalog: engine.catalog,
              before: evaluate(project),
              command,
              evaluate,
            }).assembly.project,
          engine.parseProjectDocument(JSON.stringify(document), engine.catalog),
        ),
      ),
    );
  };
  /** Underworld F's second room presses its first door, the one it takes, once, drawing `reward`. */
  const doorPress = (reward, document = checkpoint('underworld-fg')) => {
    const f = engine.createBiomeAddress('Underworld', 'F');
    return commanded(document, {
      kind: 'InsertReroll',
      occurrence: engine.createOccurrenceAddress(f, engine.createOccurrenceId('golden-f-b2-e1')),
      target: {
        kind: 'door',
        exitKey: 'exit1',
        occurrenceId: engine.createOccurrenceId('golden-f-b3-e1'),
      },
      reward,
      index: occurrenceOf(document, 'golden-f-b2-e1').roomActions.order.length,
    });
  };
  /** The Zeus press with its Boon screen authored on the rerolled reward. */
  const authoredZeus = () => {
    const f = engine.createBiomeAddress('Underworld', 'F');
    return commanded(doorPress(zeus), {
      kind: 'ReplaceTraitOffer',
      trait: engine.createTraitOfferAddress(
        engine.createIncomingRewardAddress(f, engine.createOccurrenceId('golden-f-b3-e1')),
        'source',
      ),
      value: {
        kind: 'traits',
        giverKey: 'Zeus',
        options: [
          { traitKey: 'ZeusWeaponBoon', rarity: 'Common' },
          { traitKey: 'ZeusCastBoon', rarity: 'Common' },
          { traitKey: 'ZeusSprintBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
        rarificationActions: [],
      },
    });
  };
  const target = (document) => occurrenceOf(document, 'golden-f-b3-e1');
  const pressRows = (document, occurrenceId = 'golden-f-b2-e1') =>
    occurrenceOf(document, occurrenceId).roomActions.order.filter((row) => row.kind === 'reroll');

  it('moves door, cage and Hub press results onto the rerolled item, losslessly', () => {
    const door = authoredZeus();
    assert.deepEqual(target(door).rerolledIncomingReward.results, { r1: zeus });
    // A recorded press keeps the outcomes on it; an unrecorded one takes the last press.
    for (const pressIds of [true, false]) {
      const stored = at102(withEarlierRerolls(door, { pressIds }));
      assert.deepEqual(pressRows(stored)[0].reward, zeus);
      assert.equal(target(stored).rerolledIncomingReward.offer.rewardType, 'Boon');
      assertSameDocument(step.liftProjectDocument(stored, engine.catalog), door);
      assert.doesNotThrow(() =>
        engine.parseProjectDocument(JSON.stringify(migrate(stored)), engine.catalog),
      );
    }
    // A cage press's slot is wherever its cage holds its result.
    const fields = checkpoint('nemesis-h-fields');
    const h = engine.createBiomeAddress('Underworld', 'H');
    const caged = commanded(fields, {
      kind: 'InsertReroll',
      occurrence: engine.createOccurrenceAddress(
        h,
        engine.createOccurrenceId('golden-h-miniboss01'),
      ),
      target: {
        kind: 'cage',
        exitKey: 'exit1',
        occurrenceId: engine.createOccurrenceId('golden-h-combat05'),
        slotKey: 'cage1',
      },
      reward: { rewardType: 'MaxHealthDrop' },
      index: occurrenceOf(fields, 'golden-h-miniboss01').roomActions.order.length,
    });
    const storedCage = at102(withEarlierRerolls(caged));
    assert.equal(pressRows(storedCage, 'golden-h-miniboss01')[0].target.slotKey, 'cage1');
    assertSameDocument(step.liftProjectDocument(storedCage, engine.catalog), caged);
    assert.deepEqual(occurrenceOf(caged, 'golden-h-combat05').state.rerolledCages.cage1.results, {
      r1: { rewardType: 'MaxHealthDrop' },
    });
    // A Hub press's result lives on its slot's room.
    const board = commanded(checkpoint('surface-n'), {
      kind: 'InsertHubReroll',
      hub: engine.createHubDecisionAddress(engine.createBiomeAddress('Surface', 'N'), 'hub'),
      hubSlotKey: 'combat05',
      reward: { rewardType: 'MaxHealthDrop' },
      index: 0,
    });
    const storedBoard = at102(withEarlierRerolls(board));
    assertSameDocument(step.liftProjectDocument(storedBoard, engine.catalog), board);
    assert.deepEqual(occurrenceOf(board, 'surface-n-combat05').rerolledIncomingReward.results, {
      r1: { rewardType: 'MaxHealthDrop' },
    });
  });

  it('starts the item of a press with no entered reward unresolved', () => {
    const pressed = doorPress(zeus);
    const stored = at102(withEarlierRerolls(pressed));
    delete target(stored).rerolledIncomingReward;
    assertSameDocument(step.liftProjectDocument(stored, engine.catalog), pressed);
  });

  it('adopts an entered reward its press did not draw, and restamps its pickup rows', () => {
    // The plan entered Hera after a press that drew Zeus.
    const entered = doorPress(hera);
    const stored = at102(withEarlierRerolls(entered, { pressIds: false }));
    pressRows(stored)[0].reward = zeus;
    const lifted = step.liftProjectDocument(stored, engine.catalog);
    assert.deepEqual(target(lifted).rerolledIncomingReward.results, { r1: hera });
    assertSameDocument(lifted, entered);
    // A saved 103 plan's pickup rows recorded the press's own reward; the adopted one replaces it.
    const pickup = {
      kind: 'interactIncomingReward',
      producerPoint: 'roomRewardPickup',
      acquisitionRole: 'source',
    };
    const saved = withEarlierRerolls(entered, { pressIds: false });
    pressRows(saved)[0].reward = zeus;
    target(saved).roomActions.order.push({ ...pickup, content: ['r1', 'Boon', 'ZeusUpgrade'] });
    const restamped = engine.stampRoomActionItemContent(
      engine.moveRerollResultsOntoItems(saved, engine.catalog),
      engine.catalog,
    );
    assert.deepEqual(target(restamped).roomActions.order.at(-1), {
      ...pickup,
      content: ['r1', 'Boon', 'HeraUpgrade'],
    });
    // Without an adoption the recorded content stays.
    const kept = withEarlierRerolls(entered);
    target(kept).roomActions.order.push({ ...pickup, content: ['r1', 'Boon', 'HeraUpgrade'] });
    assert.deepEqual(
      target(engine.moveRerollResultsOntoItems(kept, engine.catalog)).roomActions.order.at(-1),
      { ...pickup, content: ['r1', 'Boon', 'HeraUpgrade'] },
    );
  });

  it('drops the outcomes of a recorded result its owner cannot draw', () => {
    // The plan entered Surface Max Health on a Fields-route door, with Zeus's outcomes left over.
    const stored = at102(withEarlierRerolls(authoredZeus()));
    const undrawable = { rewardType: 'MaxHealthDropBig' };
    pressRows(stored)[0].reward = undrawable;
    target(stored).rerolledIncomingReward.offer = undrawable;
    const lifted = step.liftProjectDocument(stored, engine.catalog);
    assert.deepEqual(target(lifted).rerolledIncomingReward, {
      results: { r1: undrawable },
      pressId: 'r1',
    });
    assert.doesNotThrow(() => engine.parseProjectDocument(JSON.stringify(lifted), engine.catalog));
  });

  it('drops a rerolled reward with no press and a press whose target is gone', () => {
    const current = checkpoint('underworld-fg');
    // A rerolled reward kept after its last press went (OD4).
    const orphaned = at102(withEarlierRerolls(authoredZeus()));
    const source = occurrenceOf(orphaned, 'golden-f-b2-e1');
    source.roomActions.order = source.roomActions.order.filter((row) => row.kind !== 'reroll');
    assert.equal(target(orphaned).rerolledIncomingReward.offer.rewardType, 'Boon');
    const lifted = step.liftProjectDocument(orphaned, engine.catalog);
    assert.equal('rerolledIncomingReward' in target(lifted), false);
    assert.doesNotThrow(() => engine.parseProjectDocument(JSON.stringify(lifted), engine.catalog));
    // A press of a door its room no longer has (OD5) goes with its reward.
    const doorless = at102(structuredClone(current));
    occurrenceOf(doorless, 'golden-f-b2-e1').roomActions.order.push({
      kind: 'reroll',
      rerollId: 'r1',
      target: { kind: 'door', exitKey: 'exit9', occurrenceId: 'golden-f-b3-e2' },
      reward: zeus,
    });
    assert.deepEqual(step.liftProjectDocument(doorless, engine.catalog), current);
    // So does a Hub press of a slot the board closed.
    const board = checkpoint('surface-n');
    const closed = at102(structuredClone(board));
    closed.route.biomes[0].topology.decisions
      .find((decision) => decision.kind === 'hub')
      .actions.unshift({ kind: 'reroll', rerollId: 'r1', hubSlotKey: 'combat04', reward: zeus });
    assert.deepEqual(step.liftProjectDocument(closed, engine.catalog), board);
  });

  it('lifts by the version alone a plan its settlement leaves as it was', () => {
    const current = checkpoint('surface-n');
    assertSameDocument(migrate(at102(current)), current);
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
