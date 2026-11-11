import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomActionAddress,
  createRouteAddress,
  createTargetAddress,
  createTraitOfferAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  hermesShrineDeliveryEntryKey,
  roomActionKey,
  semanticAddressKey,
  type ExitDecision,
  type OccurrenceAddress,
  type ProjectCommand,
  type ProjectDocument,
  type ResolvedRerollTarget,
} from '@run-planner/engine/authored-project';
import {
  settleProjectUpgrade,
  stampRoomActionItemContent,
} from '@run-planner/engine/project-migration';
import { roomActionsOnReplacedItems } from '../../src/authored-project/room-actions/replaced-items';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';
import {
  createCompleteFGProject,
  createEchoGoldIAnvilDuplicateProject,
  createGoldenFGHProject,
  echoGoldIPrebossShopId,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenGBiome,
  goldenHBiome,
  goldenIBiome,
  underworldWorldShopTravelDealProject,
} from '@run-planner/test-fixtures/underworld';
import {
  createSurfaceNOHermesShrineDeliveryCheckpoint,
  oBiome,
  oOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import { loadNemesisFieldsCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { loadSurfaceScheduledLifecycleCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';

import { gBiome, gProject } from '../authored-project/support/configured-projects';
import {
  firstSupportedReroll,
  withArcana,
  withGoldenUnderworldJudgments,
} from '../support/rerolls';

const evaluate = (project: ProjectDocument) => simulateProjectAssembly(catalog, project);
const upgrade = (project: ProjectDocument) => settleProjectUpgrade({ catalog, project, evaluate });
// A file saved under the earlier rules: its edits applied without settlement.
const saved = (project: ProjectDocument, ...commands: readonly ProjectCommand[]) =>
  commands.reduce((document, command) => applyProjectCommand(document, catalog, command), project);

function order(project: ProjectDocument, room: OccurrenceAddress): readonly string[] {
  const occurrence = project.route.biomes
    .find((plan) => plan.biomeKey === room.biomeKey)
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === room.occurrenceId);
  if (occurrence === undefined) throw new Error(`${room.occurrenceId} is missing`);
  return occurrence.roomActions.order.map(roomActionKey);
}
const removedIn = (settled: ReturnType<typeof upgrade>, room: OccurrenceAddress) =>
  settled.removedStaleActions
    ?.find((entry) => semanticAddressKey(entry.occurrence) === semanticAddressKey(room))
    ?.actions.map(roomActionKey);
type RawDocument = { route: { biomes: { topology: { occurrences: RawRoom[] } | null }[] } };
type RawRoom = { occurrenceId: string; roomActions: { order: Record<string, unknown>[] } };
type RawSites = {
  acquisitionSites?: Record<string, { pickupEntries?: Record<string, unknown> }>;
};
const raw = (project: ProjectDocument) => JSON.parse(encodeProjectDocument(project)) as RawDocument;
const rawRoom = (document: RawDocument, occurrenceId: string) =>
  document.route.biomes
    .flatMap((biome) => biome.topology?.occurrences ?? [])
    .find((occurrence) => occurrence.occurrenceId === occurrenceId)!;
/** The doors of the batch an occurrence opens. */
function exitTargets(project: ProjectDocument, biomeKey: string, occurrenceId: string) {
  const decision = project.route.biomes
    .find((plan) => plan.biomeKey === biomeKey)
    ?.topology?.decisions.find(
      (candidate): candidate is ExitDecision =>
        candidate.kind === 'exit' &&
        candidate.source.kind === 'occurrence' &&
        candidate.source.occurrenceId === occurrenceId,
    );
  if (decision === undefined) throw new Error(`${occurrenceId} opens no batch`);
  return decision.normal.targets;
}
const findingCodes = (project: ProjectDocument) =>
  evaluate(project).evaluation.findings.map((finding) => finding.code);

describe('upgrade settlement of a plan saved under earlier rules', () => {
  it('removes a stale row the plan kept, announcing it in its room', () => {
    // The G opening keeps a pickup of a role its reward no longer has.
    const gOpening = createOccurrenceAddress(goldenGBiome, createOccurrenceId('golden-g-b1-e1'));
    const stale = roomActionKey({
      kind: 'interactIncomingReward',
      producerPoint: 'roomRewardPickup',
      acquisitionRole: 'source',
    });
    const project = createGoldenFGHProject();
    expect(order(project, gOpening)).toContain(stale);
    const settled = upgrade(project);
    expect(settled.fault).toBeUndefined();
    expect(order(settled.assembly.project, gOpening)).toEqual(
      order(project, gOpening).filter((key) => key !== stale),
    );
    expect(settled.removedStaleActions).toEqual([
      { occurrence: gOpening, actions: [expect.objectContaining({ acquisitionRole: 'source' })] },
    ]);
  });

  it('leaves the rows of rooms the walk does not reach', () => {
    const gOpening = createOccurrenceAddress(goldenGBiome, createOccurrenceId('golden-g-b1-e1'));
    // The plan ends in F, so nothing in G is assessed.
    const project = saved(createGoldenFGHProject(), {
      kind: 'ReplacePlanEnd',
      route: createRouteAddress('Underworld'),
      planEnd: { biomeKey: 'F', occurrenceId: createOccurrenceId('golden-f-start') },
    });
    const settled = upgrade(project);
    expect(settled.fault).toBeUndefined();
    expect(order(settled.assembly.project, gOpening)).toEqual(order(project, gOpening));
    expect(removedIn(settled, gOpening)).toBeUndefined();
  });

  it('leaves a plan with nothing to settle as it is', () => {
    const project = loadSurfaceScheduledLifecycleCheckpoint();
    const settled = upgrade(project);
    expect(settled.assembly.project).toBe(project);
    expect(settled.removedStaleActions).toBeUndefined();
    expect(settled.fault).toBeUndefined();
  });

  describe('rows whose source went earlier', () => {
    it('removes a Gold Gold Gold duplicate whose Echo is gone, keeping its payload', () => {
      const shop = createOccurrenceAddress(goldenIBiome, echoGoldIPrebossShopId);
      const duplicate = roomActionKey({
        kind: 'interactAcquisitionEntry',
        siteKey: 'roomExit',
        entryKey: 'echoDoubleShopReward',
      });
      const project = saved(createEchoGoldIAnvilDuplicateProject(), {
        kind: 'ReplaceTraitSelection',
        trait: createTraitOfferAddress(
          createEncounterPhaseAddress(
            goldenHBiome,
            { kind: 'occurrence', occurrenceId: createOccurrenceId('golden-h-bridge01') },
            'Encounter',
          ),
          'selection',
        ),
        selectedOptionKey: 'option2',
      });
      expect(order(project, shop)).toContain(duplicate);
      const settled = upgrade(project);
      expect(settled.fault).toBeUndefined();
      expect(order(settled.assembly.project, shop)).toEqual(
        order(project, shop).filter((key) => key !== duplicate),
      );
      expect(removedIn(settled, shop)).toEqual([duplicate]);
      const payload = (document: ProjectDocument) =>
        document.route.biomes
          .find((plan) => plan.biomeKey === shop.biomeKey)
          ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === shop.occurrenceId)
          ?.acquisitionSites?.roomExit?.pickupEntries?.echoDoubleShopReward;
      expect(payload(settled.assembly.project)).toEqual(payload(project));
    });

    it('keeps a Gold Gold Gold duplicate placed ahead of every purchase, invalid', () => {
      const shop = createOccurrenceAddress(goldenIBiome, echoGoldIPrebossShopId);
      const duplicate = roomActionKey({
        kind: 'interactAcquisitionEntry',
        siteKey: 'roomExit',
        entryKey: 'echoDoubleShopReward',
      });
      // An earlier build let the duplicate stand before the purchase it copies.
      const document = raw(createEchoGoldIAnvilDuplicateProject());
      const room = rawRoom(document, shop.occurrenceId);
      const row = room.roomActions.order.find(
        (action) => roomActionKey(action as never) === duplicate,
      )!;
      room.roomActions.order = [row, ...room.roomActions.order.filter((action) => action !== row)];
      const project = decodeProjectDocument(document, catalog);
      expect(order(project, shop)[0]).toBe(duplicate);
      const settled = upgrade(project);
      expect(settled.fault).toBeUndefined();
      expect(order(settled.assembly.project, shop)).toEqual(order(project, shop));
      expect(removedIn(settled, shop)).toBeUndefined();
    });

    describe('a matured trait drop', () => {
      const p3 = createOccurrenceAddress(
        createBiomeAddress('Surface', 'P'),
        createOccurrenceId('surface-p-1-1-p_combat03'),
      );
      const isDrop = (key: string) => key.includes('clockedTraitGenerated:');
      const drop = (document: ProjectDocument) => order(document, p3).filter(isDrop);
      /** The drop's producing trait taken by another option, an earlier build keeping its drop. */
      const lostDrop = () => {
        const original = loadSurfaceScheduledLifecycleCheckpoint();
        const swapped = raw(
          saved(original, {
            kind: 'ReplaceTraitSelection',
            trait: createTraitOfferAddress(
              createEncounterPhaseAddress(
                createBiomeAddress('Surface', 'O'),
                { kind: 'occurrence', occurrenceId: createOccurrenceId('surface-o-combat01') },
                'Combat1',
              ),
              'selection',
            ),
            selectedOptionKey: 'option2',
          }),
        );
        rawRoom(swapped, p3.occurrenceId).roomActions = rawRoom(
          raw(original),
          p3.occurrenceId,
        ).roomActions;
        return decodeProjectDocument(swapped, catalog);
      };
      const assessment = (project: ProjectDocument) =>
        evaluate(project)
          .evaluation.route.biomes.flatMap((biome) =>
            'rewards' in biome ? (biome.rewards.generatedPickupPlacements ?? []) : [],
          )
          .find((placement) => placement.assessment.source.kind === 'clockedTraitPickup')
          ?.assessment;

      it('is removed when its trait the run no longer takes', () => {
        const project = lostDrop();
        expect(drop(project)).toHaveLength(1);
        const settled = upgrade(project);
        expect(settled.fault).toBeUndefined();
        expect(drop(settled.assembly.project)).toEqual([]);
        expect(removedIn(settled, p3)).toEqual(drop(project));
      });

      it('goes with its payload: the lift records its row on the item it holds', () => {
        // A 102 plan's rows record no content; the lift stamps each from the item it holds now,
        // so a source-gone drop is never also a replaced row whose payload would be kept.
        const stored = raw(lostDrop()) as unknown as {
          route: { biomes: { topology: { occurrences: RawRoom[] } | null }[] };
        };
        const strip = (value: unknown): unknown =>
          JSON.parse(JSON.stringify(value), (key, entry: unknown) =>
            key === 'content' ? undefined : entry,
          );
        const lifted = decodeProjectDocument(
          stampRoomActionItemContent(strip(stored), catalog) as never,
          catalog,
        );
        const row = rawRoom(raw(lifted), p3.occurrenceId).roomActions.order.find((reference) =>
          String(reference.entryKey).includes('clockedTraitGenerated:'),
        )!;
        const entry = (document: ProjectDocument) =>
          (rawRoom(raw(document), p3.occurrenceId) as unknown as RawSites).acquisitionSites?.[
            String(row.siteKey)
          ]?.pickupEntries?.[String(row.entryKey)];
        expect(entry(lifted)).toBeDefined();
        // The lift stamped the drop row, and with the item it holds now: no replaced row.
        expect(row.content).toEqual(expect.arrayContaining([expect.any(String)]));
        expect(roomActionsOnReplacedItems(lifted, catalog)).toEqual([]);
        const settled = upgrade(lifted);
        expect(settled.fault).toBeUndefined();
        expect(drop(settled.assembly.project)).toEqual([]);
        expect(entry(settled.assembly.project)).toBeUndefined();
      });

      it('stays where its producer is held elsewhere in the walk without it', () => {
        // An earlier build left the drop ahead of the room its trait is taken in.
        const document = raw(loadSurfaceScheduledLifecycleCheckpoint());
        const room = rawRoom(document, p3.occurrenceId);
        const row = room.roomActions.order.find((action) =>
          isDrop(roomActionKey(action as never)),
        )!;
        room.roomActions.order = room.roomActions.order.filter((action) => action !== row);
        const sites = (target: RawRoom) =>
          ((
            target as unknown as { acquisitionSites?: Record<string, unknown> }
          ).acquisitionSites ??= {}) as Record<string, { pickupEntries: Record<string, unknown> }>;
        const entryKey = (row as { entryKey: string }).entryKey;
        const intro = rawRoom(document, 'surface-o-intro');
        intro.roomActions.order = [...intro.roomActions.order, row];
        sites(intro).roomExit = {
          pickupEntries: { [entryKey]: sites(room).roomExit!.pickupEntries[entryKey] },
        };
        delete sites(room).roomExit!.pickupEntries[entryKey];
        if (Object.keys(sites(room).roomExit!.pickupEntries).length === 0)
          delete sites(room).roomExit;
        const project = decodeProjectDocument(document, catalog);
        expect(assessment(project)).toMatchObject({ kind: 'invalid', reason: 'sourceInactive' });
        const settled = upgrade(project);
        expect(settled.fault).toBeUndefined();
        expect(settled.assembly.project).toBe(project);
        expect(settled.removedStaleActions).toBeUndefined();
      });

      it('stays when the walk without it stops short of the plan', () => {
        // The last biome has no start, so the plan is incomplete past the drop.
        const project = saved(lostDrop(), {
          kind: 'ClearTopology',
          biome: createBiomeAddress('Surface', 'Q'),
        });
        expect(assessment(project)).toMatchObject({ kind: 'invalid', reason: 'sourceInactive' });
        const settled = upgrade(project);
        expect(settled.fault).toBeUndefined();
        expect(drop(settled.assembly.project)).toEqual(drop(project));
        expect(removedIn(settled, p3)).toBeUndefined();
      });

      it('stays when it sits past where the walk stops', () => {
        const project = saved(lostDrop(), {
          kind: 'ReplacePlanEnd',
          route: createRouteAddress('Surface'),
          planEnd: { biomeKey: 'O', occurrenceId: createOccurrenceId('surface-o-combat01') },
        });
        expect(assessment(project)).toBeUndefined();
        const settled = upgrade(project);
        expect(settled.fault).toBeUndefined();
        expect(drop(settled.assembly.project)).toEqual(drop(project));
        expect(removedIn(settled, p3)).toBeUndefined();
      });
    });

    it('removes a countdown delivery whose Shrine purchase is gone', () => {
      const shrine = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
      const host = createOccurrenceAddress(oBiome, oOccurrenceIds.devotion);
      const delivery = roomActionKey({
        kind: 'interactAcquisitionEntry',
        siteKey: 'hermesShrineDelivery',
        entryKey: hermesShrineDeliveryEntryKey(shrine, 'initial:secondLeft'),
        encounterPhaseKey: 'Encounter',
      });
      // An earlier build left the delivery when its purchase was undone.
      const document = raw(createSurfaceNOHermesShrineDeliveryCheckpoint());
      const shrineRoom = rawRoom(document, shrine.occurrenceId);
      shrineRoom.roomActions.order = shrineRoom.roomActions.order.filter(
        (action) =>
          !(
            action.kind === 'purchaseHermesShrineOffer' &&
            action.generationKey === 'initial:secondLeft'
          ),
      );
      const project = decodeProjectDocument(document, catalog);
      expect(order(project, host)).toContain(delivery);
      const settled = upgrade(project);
      expect(settled.fault).toBeUndefined();
      expect(order(settled.assembly.project, host)).not.toContain(delivery);
      expect(removedIn(settled, host)).toEqual([delivery]);
    });

    it('keeps a Travel Deal refill whose enabler is gone, invalid with its finding', () => {
      const shop = createOccurrenceAddress(
        goldenFBiome,
        createOccurrenceId('golden-f-preboss-shop'),
      );
      const project = saved(underworldWorldShopTravelDealProject(), {
        kind: 'ReplaceTraitSelection',
        trait: createTraitOfferAddress(
          createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(8, 1)),
          'self',
        ),
        selectedOptionKey: 'option2',
      });
      const settled = upgrade(project);
      expect(settled.fault).toBeUndefined();
      expect(order(settled.assembly.project, shop)).toEqual(order(project, shop));
      expect(removedIn(settled, shop)).toBeUndefined();
      expect(settled.assembly.evaluation.findings).toContainEqual(
        expect.objectContaining({
          code: 'shopPurchaseUnavailable',
          evidence: { kind: 'travelDealRefillUnavailable' },
        }),
      );
    });
  });

  describe('exit capacity', () => {
    const prebossSource = createOccurrenceId('golden-g-b7-e1');
    const room = createOccurrenceAddress(goldenGBiome, prebossSource);
    const sourceDecision = { kind: 'occurrence' as const, occurrenceId: prebossSource };
    const doors = (project: ProjectDocument) =>
      exitTargets(project, 'G', prebossSource).map((target) => target.exitKey);
    const swap: ProjectCommand = {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: room,
      gameName: 'G_Combat12',
    };
    const wide = () => createCompleteFGProject({ prebossSource: 'G_Combat14' });

    it('takes an unselected door its room no longer has, announcing it', () => {
      const project = saved(wide(), swap);
      expect(doors(project)).toEqual(['exit1', 'exit2', 'exit3']);
      const settled = upgrade(project);
      expect(settled.fault).toBeUndefined();
      expect(doors(settled.assembly.project)).toEqual(['exit1', 'exit2']);
      expect(
        settled.removedStaleActions?.find(
          (entry) => semanticAddressKey(entry.occurrence) === semanticAddressKey(room),
        ),
      ).toEqual({
        occurrence: room,
        actions: [],
        doors: [expect.objectContaining({ exitKey: 'exit3' })],
      });
      expect(settled.assembly.evaluation.summary.eligibleForExecutionPlan).toBe(true);
    });

    it('keeps the lost door when it is the one taken, with its finding', () => {
      const project = saved(
        wide(),
        {
          kind: 'SetExitSelection',
          selection: createExitSelectionAddress(goldenGBiome, sourceDecision),
          value: { kind: 'normal', exitKey: 'exit3' },
        },
        swap,
      );
      const settled = upgrade(project);
      expect(settled.fault).toBeUndefined();
      expect(doors(settled.assembly.project)).toEqual(['exit1', 'exit2', 'exit3']);
      expect(removedIn(settled, room)).toBeUndefined();
      expect(
        settled.assembly.evaluation.findings
          .filter(
            (finding) =>
              semanticAddressKey(finding.origin) ===
              semanticAddressKey(createTargetAddress(goldenGBiome, sourceDecision, 'exit3')),
          )
          .map((finding) => finding.code),
      ).toEqual(['targetRoomUnavailable']);
    });
  });

  it('gives a takeover batch narrower than its source the Preboss doors it lacks', () => {
    const intro = createOccurrenceId('upgrade-intro');
    const source = {
      kind: 'occurrence' as const,
      occurrenceId: createOccurrenceId('upgrade-source'),
    };
    const shop = createOccurrenceId('upgrade-shop');
    const project = saved(
      gProject(),
      { kind: 'CreateStart', biome: gBiome, occurrenceId: intro },
      {
        kind: 'CreateBatch',
        decision: createExitDecisionAddress(gBiome, { kind: 'occurrence', occurrenceId: intro }),
      },
      {
        kind: 'ReplaceBatchRewardStore',
        rewardStore: createBatchRewardStoreAddress(gBiome, {
          kind: 'occurrence',
          occurrenceId: intro,
        }),
        storeKey: 'RunProgress',
      },
      {
        kind: 'CreateTarget',
        target: createTargetAddress(gBiome, { kind: 'occurrence', occurrenceId: intro }, 'exit1'),
        occurrenceId: source.occurrenceId,
        gameName: 'G_MiniBoss02',
      },
      {
        kind: 'CreateTakeoverBatch',
        decision: createExitDecisionAddress(gBiome, source),
        gameName: 'G_PreBoss01',
        targetOccurrenceIds: { exit1: shop },
      },
      {
        kind: 'ReplaceOccurrenceRoom',
        occurrence: createOccurrenceAddress(gBiome, source.occurrenceId),
        gameName: 'G_Combat04',
      },
    );
    const targets = (document: ProjectDocument) => exitTargets(document, 'G', source.occurrenceId);
    expect(targets(project).map((target) => target.exitKey)).toEqual(['exit1']);
    const settled = upgrade(project);
    expect(settled.fault).toBeUndefined();
    expect(targets(settled.assembly.project)).toEqual([
      { exitKey: 'exit1', occurrenceId: shop },
      { exitKey: 'exit2', occurrenceId: `${source.occurrenceId}:exit2` },
    ]);
  });

  it('keeps a cage reroll whose cage is no longer played, invalid', () => {
    // The saved plan cannot show whether the press ever found its cage.
    const h = createBiomeAddress('Underworld', 'H');
    const intro = createOccurrenceAddress(h, createOccurrenceId('golden-h-intro'));
    const cage3: ResolvedRerollTarget = {
      kind: 'cage',
      exitKey: 'exit1',
      occurrenceId: createOccurrenceId('golden-h-combat02'),
      slotKey: 'cage3',
    };
    const cageOutcome = (outcome: 'min' | 'max'): ProjectCommand => ({
      kind: 'ReplaceFieldsCageOutcome',
      decision: createExitDecisionAddress(h, {
        kind: 'occurrence',
        occurrenceId: intro.occurrenceId,
      }),
      cageOutcome: outcome,
    });
    const rerolls = (document: ProjectDocument) =>
      order(document, intro).filter((key) => key.startsWith('["reroll"'));
    const raised = saved(
      withGoldenUnderworldJudgments(withArcana(loadNemesisFieldsCheckpoint(), ['DoorReroll'])),
      cageOutcome('max'),
    );
    const pressed = saved(raised, {
      kind: 'InsertReroll',
      occurrence: intro,
      target: cage3,
      reward: { rewardType: 'RoomMoneyDrop' },
      index: order(raised, intro).length,
    });
    const action = createRoomActionAddress(h, intro.occurrenceId, rerolls(pressed)[0]!);
    const project = saved(
      pressed,
      {
        kind: 'ReplaceRerollReward',
        action,
        reward: firstSupportedReroll(pressed, action, 'RunProgress'),
      },
      cageOutcome('min'),
    );
    expect(rerolls(project)).toHaveLength(1);
    expect(findingCodes(project)).toContain('rerollTargetUnavailable');
    const settled = upgrade(project);
    expect(settled.fault).toBeUndefined();
    expect(rerolls(settled.assembly.project)).toEqual(rerolls(project));
    expect(removedIn(settled, intro)).toBeUndefined();
  });

  it('keeps a cage reroll whose target room never held its cage, invalid', () => {
    const h = createBiomeAddress('Underworld', 'H');
    const intro = createOccurrenceAddress(h, createOccurrenceId('golden-h-intro'));
    const combat02 = createOccurrenceId('golden-h-combat02');
    const rerolls = (document: ProjectDocument) =>
      order(document, intro).filter((key) => key.startsWith('["reroll"'));
    const fields = withGoldenUnderworldJudgments(
      withArcana(loadNemesisFieldsCheckpoint(), ['DoorReroll']),
    );
    // Pressed at the third cage while the room played two, with no third cage ever authored.
    const pressed = raw(
      saved(fields, {
        kind: 'InsertReroll',
        occurrence: intro,
        target: { kind: 'cage', exitKey: 'exit1', occurrenceId: combat02, slotKey: 'cage3' },
        reward: { rewardType: 'RoomMoneyDrop' },
        index: order(fields, intro).length,
      }),
    );
    const target = rawRoom(pressed, combat02) as unknown as {
      state: { cages: Record<string, unknown> };
    };
    target.state.cages = { ...target.state.cages, cage3: null };
    const project = decodeProjectDocument(pressed, catalog);
    expect(findingCodes(project)).toContain('rerollTargetUnavailable');
    const settled = upgrade(project);
    expect(settled.fault).toBeUndefined();
    expect(rerolls(settled.assembly.project)).toEqual(rerolls(project));
    expect(removedIn(settled, intro)).toBeUndefined();
  });
});
