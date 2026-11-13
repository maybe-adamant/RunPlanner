import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createIncomingRewardAddress,
  createProjectAddress,
  createRoomFeatureAddress,
  createShopOfferAddress,
  createTraitOfferAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  roomActionKey,
  semanticAddressKey,
  type OccurrenceAddress,
  type ProjectCommand,
  type ProjectDocument,
  type RoomOccurrence,
} from '@run-planner/engine/authored-project';
import {
  hermesShrineCandidateForProjectEvaluationAssembly,
  settleProjectEdit,
  simulateProjectAssembly,
  stygianWellCandidateForProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';
import { settleProjectUpgrade } from '@run-planner/engine/project-migration';
import { loadCheckpoint } from '@run-planner/test-fixtures/checkpoints/registry';
import { stockFills } from '../../../src/simulation/stock-fill';
import { candidateArtifactsForProjectEvaluationAssembly } from '../../../src/simulation/evaluation/project-evaluation-assembly';

const f = createBiomeAddress('Underworld', 'F');
const evaluate = (project: ProjectDocument) => simulateProjectAssembly(catalog, project);
const settle = (project: ProjectDocument, command: ProjectCommand) =>
  settleProjectEdit({ catalog, before: evaluate(project), command, evaluate });
const occurrenceOf = (project: ProjectDocument, room: OccurrenceAddress): RoomOccurrence =>
  project.route.biomes
    .find((plan) => plan.biomeKey === room.biomeKey)!
    .topology!.occurrences.find((candidate) => candidate.occurrenceId === room.occurrenceId)!;
const findingCodes = (project: ProjectDocument) =>
  evaluate(project).evaluation.findings.map((finding) => ({
    code: finding.code,
    origin: semanticAddressKey(finding.origin),
    evidence: finding.evidence,
  }));

describe('stock filled on first reach', () => {
  const well = createOccurrenceAddress(f, createOccurrenceId('golden-f-preboss-shop:postboss'));
  const refillPurchase = {
    kind: 'purchaseStygianWellOffer',
    generationKey: 'travelDealRefill',
  } as const;
  const wellCapability = (project: ProjectDocument) =>
    stygianWellCandidateForProjectEvaluationAssembly(evaluate(project), well)!;

  describe('a Stygian Well', () => {
    it('stocks a blank roll with distinct legal items, the same way every time', () => {
      const project = loadCheckpoint('underworld-f-stygian-well');
      let blank = project;
      for (const slotKey of ['healing', 'secondLeft', 'secondRight'] as const)
        blank = applyProjectCommand(blank, catalog, {
          kind: 'ReplaceStygianWellOffer',
          occurrence: well,
          slotKey,
          itemKey: null,
        });
      expect(findingCodes(blank).map((finding) => finding.code)).toEqual([
        'stygianWellMissing',
        'stygianWellMissing',
        'stygianWellMissing',
      ]);
      // Any edit that reaches the blank roll stocks it in the same edit.
      const edit: ProjectCommand = {
        kind: 'ReplaceStygianWellTravelDealRefill',
        occurrence: well,
        itemKey: 'ExtendedShopTrait',
      };
      const settled = settle(blank, edit);
      expect(settled.fault).toBeUndefined();
      const stock = occurrenceOf(settled.assembly.project, well).stygianWell!.offerKeyBySlot;
      const candidates = wellCapability(settled.assembly.project).candidateItemKeysBySlot;
      for (const slotKey of ['healing', 'secondLeft', 'secondRight'] as const)
        expect(candidates[slotKey]).toContain(stock[slotKey]);
      expect(new Set(Object.values(stock)).size).toBe(3);
      expect(
        occurrenceOf(settle(blank, edit).assembly.project, well).stygianWell!.offerKeyBySlot,
      ).toEqual(stock);
    });

    it('stocks a bought Fateful Twist result with the purchase that reaches it', () => {
      let project = settle(loadCheckpoint('underworld-f-stygian-well'), {
        kind: 'ReplaceStygianWellOffer',
        occurrence: well,
        slotKey: 'secondRight',
        itemKey: 'RandomStoreItem',
      }).assembly.project;
      project = settle(project, {
        kind: 'SetStygianWellPurchase',
        occurrence: well,
        generationKey: 'initial:secondRight',
        purchased: true,
      }).assembly.project;
      const result = occurrenceOf(project, well).stygianWell!.twistResultKeyByGeneration?.[
        'initial:secondRight'
      ];
      expect(
        wellCapability(project).twistCandidateItemKeysByGeneration['initial:secondRight'],
      ).toContain(result);
    });

    it('keeps a stored refill with its finding when its trigger stays and it turns illegal', () => {
      // Restocking the roll with the refill's item makes the refill a duplicate of it.
      const settled = settle(loadCheckpoint('underworld-f-stygian-well'), {
        kind: 'ReplaceStygianWellOffer',
        occurrence: well,
        slotKey: 'secondRight',
        itemKey: 'ExtendedShopTrait',
      });
      expect(settled.fault).toBeUndefined();
      const project = settled.assembly.project;
      expect(occurrenceOf(project, well).stygianWell!.travelDealRefillKey).toBe(
        'ExtendedShopTrait',
      );
      expect(findingCodes(project)).toContainEqual({
        code: 'stygianWellTravelDealRefillUnavailable',
        origin: semanticAddressKey(
          createRoomFeatureAddress(well, {
            kind: 'stygianWellOffer',
            generationKey: 'travelDealRefill',
          }),
        ),
        evidence: { reason: 'refillDuplicate' },
      });
      expect(occurrenceOf(project, well).roomActions.order.map(roomActionKey)).toContain(
        roomActionKey(refillPurchase),
      );
    });

    it('replaces the refill and its purchase when another purchase triggers it', () => {
      // Unbuying the first purchase makes the next one restock its slot.
      const settled = settle(loadCheckpoint('underworld-f-stygian-well'), {
        kind: 'SetStygianWellPurchase',
        occurrence: well,
        generationKey: 'initial:secondLeft',
        purchased: false,
      });
      expect(settled.fault).toBeUndefined();
      const project = settled.assembly.project;
      expect(occurrenceOf(project, well).roomActions.order.map(roomActionKey)).not.toContain(
        roomActionKey(refillPurchase),
      );
      const refill = wellCapability(project).travelDealRefill!;
      expect(refill.sourceGenerationKey).toBe('initial:secondRight');
      expect(refill.candidateItemKeys).toContain(
        occurrenceOf(project, well).stygianWell!.travelDealRefillKey,
      );
      expect(settled.removedStaleActions).toBeUndefined();
      expect(findingCodes(project)).toEqual([]);
    });
  });

  describe('a Hermes Shrine', () => {
    const n = createBiomeAddress('Surface', 'N');
    const o = createBiomeAddress('Surface', 'O');
    const shrine = createOccurrenceAddress(n, createOccurrenceId('surface-n-preboss:postboss'));
    const oShrine = createOccurrenceAddress(o, createOccurrenceId('surface-o-preboss:postboss'));
    const shrineCapability = (project: ProjectDocument, room: OccurrenceAddress) =>
      hermesShrineCandidateForProjectEvaluationAssembly(evaluate(project), room)!;

    it('stocks a blank Shrine with distinct second-group items', () => {
      const raw = JSON.parse(encodeProjectDocument(loadCheckpoint('surface-shrine-travel-deal')));
      for (const plan of raw.route.biomes)
        for (const room of plan.topology?.occurrences ?? [])
          if (room.occurrenceId === oShrine.occurrenceId)
            room.hermesShrine.offerBySlot = { first: null, secondLeft: null, secondRight: null };
      const blank = decodeProjectDocument(raw, catalog);
      expect(findingCodes(blank).map((finding) => finding.code)).toContain(
        'hermesShrineInventoryMissing',
      );
      const settled = settle(blank, {
        kind: 'SetHermesShrineOfferDelay',
        occurrence: shrine,
        generationKey: 'initial:first',
        delay: 3,
      });
      expect(settled.fault).toBeUndefined();
      const stock = occurrenceOf(settled.assembly.project, oShrine).hermesShrine!.offerBySlot;
      const candidates = shrineCapability(
        settled.assembly.project,
        oShrine,
      ).candidateRewardTypesBySlot;
      expect(candidates.first).toContain(stock.first?.rewardType);
      expect(stock.secondLeft?.rewardType).not.toBe(stock.secondRight?.rewardType);
      expect(findingCodes(settled.assembly.project)).toEqual([]);
    });

    it('replaces the refill and its purchase when another rush triggers it', () => {
      let project = loadCheckpoint('surface-shrine-travel-deal');
      project = settle(project, {
        kind: 'PurchaseHermesShrineOffer',
        occurrence: shrine,
        generationKey: 'initial:secondLeft',
      }).assembly.project;
      project = settle(project, {
        kind: 'SetHermesShrineRush',
        occurrence: shrine,
        generationKey: 'initial:secondLeft',
        rushed: true,
      }).assembly.project;
      expect(shrineCapability(project, shrine).travelDealRefill?.sourceGenerationKey).toBe(
        'initial:first',
      );
      // Unbuying the first item takes its rush: the second rush now restocks its slot.
      const settled = settle(project, {
        kind: 'SetHermesShrinePurchase',
        occurrence: shrine,
        generationKey: 'initial:first',
        purchased: false,
      });
      expect(settled.fault).toBeUndefined();
      const after = settled.assembly.project;
      const refill = shrineCapability(after, shrine).travelDealRefill!;
      expect(refill.sourceGenerationKey).toBe('initial:secondLeft');
      expect(refill.candidateRewardTypes).toContain(
        occurrenceOf(after, shrine).hermesShrine!.travelDealRefill?.offer?.rewardType,
      );
      expect(occurrenceOf(after, shrine).roomActions.order.map(roomActionKey)).not.toContain(
        roomActionKey({ kind: 'purchaseHermesShrineOffer', generationKey: 'travelDealRefill' }),
      );
    });
  });

  describe('a Purging Pool', () => {
    const pool = createOccurrenceAddress(f, createOccurrenceId('golden-f-preboss-shop:postboss'));

    // Taking Hera's Sprint instead leaves the listed Cast unheld, so the entry list is stale.
    const takeHerasSprint = (project: ProjectDocument): ProjectCommand => {
      const heraRoom = createOccurrenceId('golden-f-b6-e1');
      const hera = createTraitOfferAddress(createIncomingRewardAddress(f, heraRoom), 'source');
      const room = occurrenceOf(project, createOccurrenceAddress(f, heraRoom));
      const offer =
        room.state.kind === 'counted'
          ? room.state.reward!.traitOffersByAcquisitionRole!.source!
          : undefined;
      if (offer?.kind !== 'traits') throw new Error('expected the Hera offer');
      return {
        kind: 'ReplaceTraitOffer',
        trait: hera,
        value: { ...offer, selectedOptionKey: 'option2' },
      };
    };
    const poolFindings = (project: ProjectDocument) =>
      findingCodes(project)
        .filter((finding) => finding.code.startsWith('purgingPool'))
        .map((finding) => finding.code);

    it('redraws the unsold slots of a list an edit elsewhere leaves stale, keeping the sold one', () => {
      const project = loadCheckpoint('underworld-f-pool');
      const before = occurrenceOf(project, pool).purgingPool!.traitKeyBySlot;
      expect(before.middle).toBe('HeraCastBoon');
      const settled = settle(project, takeHerasSprint(project));
      expect(settled.fault).toBeUndefined();
      const after = occurrenceOf(settled.assembly.project, pool).purgingPool!.traitKeyBySlot;
      expect(after.left).toBe(before.left);
      expect(after.middle).not.toBe('HeraCastBoon');
      expect(new Set(Object.values(after)).size).toBe(3);
      expect(
        findingCodes(settled.assembly.project).filter((finding) =>
          finding.code.startsWith('purgingPool'),
        ),
      ).toEqual([]);
    });

    it('keeps a value set on the list itself, with its finding', () => {
      const project = loadCheckpoint('underworld-f-pool');
      const before = occurrenceOf(project, pool).purgingPool!.traitKeyBySlot;
      // A listed boon the run does not hold is the list's own finding, not a regenerated list.
      const settled = settle(project, {
        kind: 'ReplacePurgingPoolSlot',
        occurrence: pool,
        slotKey: 'middle',
        traitKey: 'AphroditeWeaponBoon',
      });
      expect(settled.fault).toBeUndefined();
      const after = occurrenceOf(settled.assembly.project, pool).purgingPool!.traitKeyBySlot;
      expect(after).toEqual({ ...before, middle: 'AphroditeWeaponBoon' });
      expect(poolFindings(settled.assembly.project)).toEqual(['purgingPoolTraitUnavailable']);
      // A later edit did not make it stale: the list keeps its value and finding.
      const later = settle(settled.assembly.project, {
        kind: 'RenameProject',
        project: createProjectAddress(),
        name: 'Renamed',
      });
      expect(later.fault).toBeUndefined();
      expect(occurrenceOf(later.assembly.project, pool).purgingPool!.traitKeyBySlot).toEqual(after);
      expect(poolFindings(later.assembly.project)).toEqual(['purgingPoolTraitUnavailable']);
    });

    it('keeps a stale list of a plan saved before schema 103, with its finding', () => {
      const project = loadCheckpoint('underworld-f-pool');
      // Saved under the earlier rules: the trait edit applied without settlement.
      const saved = applyProjectCommand(project, catalog, takeHerasSprint(project));
      const listed = occurrenceOf(saved, pool).purgingPool!.traitKeyBySlot;
      expect(poolFindings(saved)).toEqual(['purgingPoolTraitUnavailable']);
      const upgraded = settleProjectUpgrade({ catalog, project: saved, evaluate });
      expect(upgraded.fault).toBeUndefined();
      expect(occurrenceOf(upgraded.assembly.project, pool).purgingPool!.traitKeyBySlot).toEqual(
        listed,
      );
      expect(poolFindings(upgraded.assembly.project)).toEqual(['purgingPoolTraitUnavailable']);
    });
  });

  describe('a World Shop', () => {
    const shop = createOccurrenceAddress(f, createOccurrenceId('golden-f-preboss-shop'));
    const shopState = (project: ProjectDocument) => {
      const state = occurrenceOf(project, shop).state;
      return state.kind === 'shop' ? state.shop! : undefined;
    };
    const refillRow = roomActionKey({
      kind: 'interactAcquisitionEntry',
      siteKey: 'roomExit',
      entryKey: 'travelDealRefill',
    });

    it('replaces the Travel Deal item and its purchase when another purchase restocks', () => {
      // Buying Minor first makes it the purchase Travel Deal restocks on.
      const settled = settle(loadCheckpoint('underworld-world-shop-travel-deal'), {
        kind: 'ReplaceShopPurchaseParticipation',
        offer: createShopOfferAddress(f, shop.occurrenceId, 'Minor'),
        purchased: true,
        index: 0,
      });
      expect(settled.fault).toBeUndefined();
      const project = settled.assembly.project;
      expect(occurrenceOf(project, shop).roomActions.order.map(roomActionKey)).not.toContain(
        refillRow,
      );
      // The new item is drawn at the purchase that restocks it, from the restocked slot's values.
      expect(shopState(project)?.travelDealRefill?.reward).toBeDefined();
      expect(findingCodes(project).map((finding) => finding.code)).not.toContain('rewardMissing');
    });

    it('leaves a slot with no legal value blank and stocks the slots after it', () => {
      const project = loadCheckpoint('underworld-world-shop-travel-deal');
      const slots = catalog.rewards.shops.byKey[shopState(project)!.profileKey]!.slots.values;
      const blank = slots.reduce(
        (document, slot) =>
          applyProjectCommand(document, catalog, {
            kind: 'ClearShopOffer',
            offer: createShopOfferAddress(f, shop.occurrenceId, slot.key),
          }),
        project,
      );
      const artifacts = candidateArtifactsForProjectEvaluationAssembly(evaluate(blank));
      const reached = artifacts.biomeAt(f)!;
      const first = semanticAddressKey(createShopOfferAddress(f, shop.occurrenceId, slots[0]!.key));
      // The first slot admits no value here.
      const unfillable = {
        ...artifacts,
        biomeAt: () => ({
          ...reached,
          rewardProducers: {
            ...reached.rewardProducers,
            at: (owner: Parameters<typeof reached.rewardProducers.at>[0]) => {
              const producer = reached.rewardProducers.at(owner);
              if (producer === undefined || semanticAddressKey(owner) !== first) return producer;
              return {
                ...producer,
                evaluateShopOption: (
                  ...input: Parameters<NonNullable<typeof producer.evaluateShopOption>>
                ) => ({ ...producer.evaluateShopOption!(...input), supported: false }),
              };
            },
          },
        }),
      } as typeof artifacts;
      expect(stockFills(catalog, blank, unfillable, () => false).map((fill) => fill.owner)).toEqual(
        [createShopOfferAddress(f, shop.occurrenceId, slots[1]!.key)],
      );
    });

    it('stocks every blank slot of a reached Shop, the same way every time', () => {
      const project = loadCheckpoint('underworld-world-shop-travel-deal');
      const shopProfile = catalog.rewards.shops.byKey[shopState(project)!.profileKey]!;
      const blank = shopProfile.slots.values.reduce(
        (document, slot) =>
          applyProjectCommand(document, catalog, {
            kind: 'ClearShopOffer',
            offer: createShopOfferAddress(f, shop.occurrenceId, slot.key),
          }),
        project,
      );
      // Any edit that reaches the Shop stocks it: here, buying its first slot.
      const settled = settle(blank, {
        kind: 'ReplaceShopPurchaseParticipation',
        offer: createShopOfferAddress(f, shop.occurrenceId, shopProfile.slots.values[0]!.key),
        purchased: true,
        index: 0,
      });
      expect(settled.fault).toBeUndefined();
      const stocked = shopState(settled.assembly.project)!;
      const filled = shopProfile.slots.values.map((slot) => stocked.offers[slot.key]?.reward);
      expect(filled).not.toContain(undefined);
      expect(filled).not.toContain(null);
      expect(
        findingCodes(settled.assembly.project).filter(
          (finding) => finding.code === 'rewardMissing',
        ),
      ).toEqual([]);
      // The same blank Shop stocks the same way every time.
      expect(
        shopState(
          settle(blank, {
            kind: 'ReplaceShopPurchaseParticipation',
            offer: createShopOfferAddress(f, shop.occurrenceId, shopProfile.slots.values[0]!.key),
            purchased: true,
            index: 0,
          }).assembly.project,
        ),
      ).toEqual(stocked);
    });
  });
});
